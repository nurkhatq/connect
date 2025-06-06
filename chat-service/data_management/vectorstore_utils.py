import os
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
from langchain_community.vectorstores import FAISS
from langchain.docstore.document import Document

from data_management.document_processor import process_document_folder

logger = logging.getLogger(__name__)

async def load_or_rebuild_vectorstore(
    data_folder: str,
    indexes_folder: str,
    embeddings,
    force_rebuild: bool = False
) -> Optional[FAISS]:
    """Асинхронная загрузка или пересоздание векторного хранилища"""
    data_path = Path(data_folder)
    index_path = Path(indexes_folder)
    
    # Создаем директории
    data_path.mkdir(parents=True, exist_ok=True)
    index_path.mkdir(parents=True, exist_ok=True)
    
    fingerprint_file = index_path / "index_fingerprint.json"
    faiss_index = index_path / "index.faiss"
    
    # Вычисляем текущий fingerprint
    current_fingerprint = await calculate_folder_fingerprint(data_path)
    
    # Проверяем нужно ли пересоздавать
    if not force_rebuild and faiss_index.exists() and fingerprint_file.exists():
        try:
            with open(fingerprint_file, 'r') as f:
                stored_fingerprint = json.load(f)
            
            if stored_fingerprint == current_fingerprint:
                logger.info(f"Loading existing vectorstore from {indexes_folder}")
                # Загружаем существующий индекс
                vectorstore = FAISS.load_local(
                    str(index_path),
                    embeddings,
                    allow_dangerous_deserialization=True
                )
                return vectorstore
        except Exception as e:
            logger.error(f"Failed to load existing vectorstore: {e}")
    
    # Пересоздаем индекс
    logger.info(f"Building vectorstore for {data_folder}")
    
    # Обрабатываем документы
    chunks = process_document_folder(
        str(data_path),
        min_words_per_page=30,
        target_chunk_size=512,
        min_chunk_size=256,
        overlap_size=150,
        include_metadata=True
    )
    
    if not chunks:
        logger.warning(f"No documents found in {data_folder}")
        # Создаем пустой индекс
        empty_doc = Document(
            page_content="Empty vectorstore",
            metadata={"empty": True}
        )
        vectorstore = FAISS.from_documents([empty_doc], embeddings)
    else:
        # Создаем документы для LangChain
        documents = []
        for chunk in chunks:
            doc = Document(
                page_content=chunk.get("text", ""),
                metadata=chunk.get("metadata", {})
            )
            documents.append(doc)
        
        logger.info(f"Creating vectorstore with {len(documents)} chunks")
        vectorstore = FAISS.from_documents(documents, embeddings)
    
    # Сохраняем индекс
    vectorstore.save_local(str(index_path))
    
    # Сохраняем fingerprint
    with open(fingerprint_file, 'w') as f:
        json.dump(current_fingerprint, f, indent=2)
    
    logger.info(f"Vectorstore saved to {indexes_folder}")
    return vectorstore

async def calculate_folder_fingerprint(folder_path: Path) -> Dict[str, Any]:
    """Вычисляет fingerprint папки для определения изменений"""
    fingerprint = {}
    
    for file_path in folder_path.rglob("*"):
        if file_path.is_file() and file_path.suffix.lower() in ['.pdf', '.docx', '.txt']:
            relative_path = file_path.relative_to(folder_path)
            stat = file_path.stat()
            
            fingerprint[str(relative_path)] = {
                "size": stat.st_size,
                "mtime": stat.st_mtime
            }
    
    # Создаем хеш от fingerprint
    fingerprint_str = json.dumps(fingerprint, sort_keys=True)
    fingerprint_hash = hashlib.md5(fingerprint_str.encode()).hexdigest()
    
    return {
        "hash": fingerprint_hash,
        "files_count": len(fingerprint),
        "files": fingerprint
    }

async def initialize_vectorstores():
    """Инициализирует векторные хранилища при старте"""
    from app.embeddings import embeddings
    from config import settings
    
    logger.info("Initializing vectorstores...")
    
    # Инициализируем для преподавателей
    teacher_vs = await load_or_rebuild_vectorstore(
        settings.data_folder,
        settings.indexes_folder,
        embeddings
    )
    
    # Инициализируем для студентов
    student_vs = await load_or_rebuild_vectorstore(
        settings.data_folder_stud,
        settings.indexes_folder_stud,
        embeddings
    )
    
    logger.info("Vectorstores initialization complete")
    
    return teacher_vs, student_vs