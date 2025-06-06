import hashlib
import json
import asyncio
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import faiss
import numpy as np
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document
import aiofiles
import logging

from config import settings
from core.cache_manager import CacheManager

logger = logging.getLogger(__name__)

class VectorstoreManager:
    def __init__(self, data_folder: str, index_folder: str, embeddings):
        self.data_folder = Path(data_folder)
        self.index_folder = Path(index_folder)
        self.embeddings = embeddings
        self.cache = CacheManager()
        self.vectorstore: Optional[FAISS] = None
        self._lock = asyncio.Lock()
        
        # Создаем директории
        self.index_folder.mkdir(parents=True, exist_ok=True)
        
    async def initialize(self):
        """Асинхронная инициализация векторного хранилища"""
        async with self._lock:
            if await self.should_rebuild_index():
                logger.info(f"Rebuilding index for {self.data_folder}")
                await self.rebuild_index()
            else:
                logger.info(f"Loading existing index for {self.data_folder}")
                await self.load_index()
    
    async def get_folder_hash(self) -> str:
        """Асинхронно вычисляет хеш всех файлов в папке"""
        files_data = {}
        
        # Собираем информацию о файлах асинхронно
        tasks = []
        for file_path in self.data_folder.glob("**/*"):
            if file_path.is_file() and file_path.suffix.lower() in ['.pdf', '.docx', '.txt']:
                tasks.append(self._get_file_info(file_path))
        
        if tasks:
            file_infos = await asyncio.gather(*tasks)
            for file_path, info in file_infos:
                files_data[str(file_path)] = info
        
        return hashlib.md5(json.dumps(files_data, sort_keys=True).encode()).hexdigest()
    
    async def _get_file_info(self, file_path: Path) -> Tuple[Path, Dict]:
        """Получает информацию о файле асинхронно"""
        stat = file_path.stat()
        return file_path, {
            "size": stat.st_size,
            "mtime": stat.st_mtime
        }
    
    async def should_rebuild_index(self) -> bool:
        """Проверяет, нужно ли пересоздавать индекс"""
        hash_file = self.index_folder / "folder_hash.txt"
        index_file = self.index_folder / "index.faiss"
        
        if not hash_file.exists() or not index_file.exists():
            return True
        
        # Проверяем кеш
        cached_hash = await self.cache.get("folder_hash_" + str(self.data_folder))
        if cached_hash:
            return False
        
        # Сравниваем хеши
        current_hash = await self.get_folder_hash()
        async with aiofiles.open(hash_file, 'r') as f:
            stored_hash = (await f.read()).strip()
        
        needs_rebuild = current_hash != stored_hash
        
        if not needs_rebuild:
            # Сохраняем в кеш
            await self.cache.set("folder_hash_" + str(self.data_folder), current_hash, ttl=3600)
        
        return needs_rebuild
    
    async def rebuild_index(self):
        """Асинхронно пересоздает векторный индекс"""
        from core.async_processor import AsyncDocumentProcessor
        
        processor = AsyncDocumentProcessor()
        
        # Обрабатываем документы асинхронно
        all_chunks = []
        file_paths = list(self.data_folder.glob("**/*"))
        valid_files = [f for f in file_paths if f.suffix.lower() in ['.pdf', '.docx', '.txt']]
        
        logger.info(f"Processing {len(valid_files)} documents")
        
        # Обрабатываем батчами для оптимизации памяти
        batch_size = 10
        for i in range(0, len(valid_files), batch_size):
            batch = valid_files[i:i + batch_size]
            batch_chunks = await processor.process_documents_batch(batch)
            all_chunks.extend(batch_chunks)
        
        if all_chunks:
            # Создаем документы для LangChain
            documents = [
                Document(
                    page_content=chunk["text"],
                    metadata=chunk.get("metadata", {})
                )
                for chunk in all_chunks
            ]
            
            # Создаем векторное хранилище
            logger.info(f"Creating vectorstore with {len(documents)} chunks")
            self.vectorstore = await self._create_vectorstore_async(documents)
            
            # Сохраняем индекс
            await self.save_index()
            
            # Сохраняем хеш
            current_hash = await self.get_folder_hash()
            await self.save_folder_hash(current_hash)
            
            # Очищаем кеш
            await self.cache.delete("folder_hash_" + str(self.data_folder))
        else:
            logger.warning("No documents to index")
            # Создаем пустое хранилище
            self.vectorstore = await self._create_vectorstore_async([
                Document(page_content="Empty index", metadata={})
            ])
    
    async def _create_vectorstore_async(self, documents: List[Document]) -> FAISS:
        """Асинхронно создает векторное хранилище"""
        loop = asyncio.get_event_loop()
        
        # Выполняем тяжелую операцию в thread pool
        vectorstore = await loop.run_in_executor(
            None,
            FAISS.from_documents,
            documents,
            self.embeddings
        )
        
        return vectorstore
    
    async def save_index(self):
        """Асинхронно сохраняет индекс"""
        if not self.vectorstore:
            return
        
        loop = asyncio.get_event_loop()
        
        # Сохраняем в thread pool
        await loop.run_in_executor(
            None,
            self.vectorstore.save_local,
            str(self.index_folder)
        )
        
        logger.info(f"Index saved to {self.index_folder}")
    
    async def load_index(self):
        """Асинхронно загружает существующий индекс"""
        loop = asyncio.get_event_loop()
        
        try:
            # Загружаем в thread pool - исправленная версия
            self.vectorstore = await loop.run_in_executor(
                None,
                lambda: FAISS.load_local(
                    str(self.index_folder),
                    self.embeddings,
                    allow_dangerous_deserialization=True
                )
            )
            logger.info(f"Index loaded from {self.index_folder}")
        except Exception as e:
            logger.error(f"Failed to load index: {e}")
            await self.rebuild_index()
    
    async def save_folder_hash(self, hash_value: str):
        """Сохраняет хеш папки"""
        hash_file = self.index_folder / "folder_hash.txt"
        async with aiofiles.open(hash_file, 'w') as f:
            await f.write(hash_value)
    
    async def search(self, query: str, k: int = 5) -> List[Document]:
        """Асинхронный поиск с кешированием"""
        if not self.vectorstore:
            return []
        
        # Проверяем кеш
        cache_key = f"search_{hashlib.md5(query.encode()).hexdigest()}_{k}"
        cached_result = await self.cache.get(cache_key)
        if cached_result:
            logger.debug(f"Cache hit for query: {query[:50]}...")
            return cached_result
        
        # Выполняем поиск
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            self.vectorstore.similarity_search,
            query,
            k
        )
        
        # Кешируем результат
        await self.cache.set(cache_key, results, ttl=settings.cache_ttl)
        
        return results
    
    async def add_documents(self, documents: List[Document]):
        """Асинхронно добавляет документы в индекс"""
        if not self.vectorstore:
            return
        
        async with self._lock:
            loop = asyncio.get_event_loop()
            
            # Добавляем документы
            await loop.run_in_executor(
                None,
                self.vectorstore.add_documents,
                documents
            )
            
            # Сохраняем обновленный индекс
            await self.save_index()
            
            # Обновляем хеш
            current_hash = await self.get_folder_hash()
            await self.save_folder_hash(current_hash)
            
            # Очищаем кеш поиска
            await self.cache.clear_pattern("search_*")