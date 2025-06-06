import os
import json
import shutil
import hashlib
from datetime import datetime
from pathlib import Path
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class DocumentManager:
    def __init__(self, data_folder: str, metadata_file: str = "document_metadata.json"):
        self.data_folder = Path(data_folder)
        self.metadata_file = self.data_folder / metadata_file
        self.ensure_metadata_exists()
    
    def ensure_metadata_exists(self):
        """Создает структуру метаданных если не существует"""
        self.data_folder.mkdir(parents=True, exist_ok=True)
        
        if not self.metadata_file.exists():
            initial_metadata = {"documents": []}
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(initial_metadata, f, ensure_ascii=False, indent=2)
    
    def load_metadata(self) -> Dict[str, Any]:
        """Загружает метаданные"""
        try:
            with open(self.metadata_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading metadata: {e}")
            return {"documents": []}
    
    def save_metadata(self, metadata: Dict[str, Any]):
        """Сохраняет метаданные"""
        try:
            with open(self.metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Error saving metadata: {e}")
    
    def calculate_hash(self, file_path: str) -> str:
        """Вычисляет хеш файла"""
        hash_md5 = hashlib.md5()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def add_document(self, file_path: str, title: Optional[str] = None, 
                    description: str = "", tags: Optional[List[str]] = None) -> Dict[str, Any]:
        """Добавляет документ в систему"""
        metadata = self.load_metadata()
        file_path = Path(file_path)
        filename = file_path.name
        
        # Вычисляем хеш
        file_hash = self.calculate_hash(str(file_path))
        
        # Проверяем дубликаты
        for existing_doc in metadata["documents"]:
            if existing_doc.get("file_hash") == file_hash and existing_doc.get("status") == "active":
                logger.info(f"Document with same content already exists: {existing_doc['id']}")
                return existing_doc
        
        # Создаем новый документ
        doc_id = self.generate_id()
        timestamp = datetime.now().isoformat()
        
        # Копируем файл в data folder
        new_filename = f"{timestamp.replace(':', '-')}_{filename}"
        dest_path = self.data_folder / new_filename
        shutil.copy2(file_path, dest_path)
        
        new_doc = {
            "id": doc_id,
            "original_filename": filename,
            "stored_filename": new_filename,
            "title": title or filename,
            "description": description,
            "tags": tags or [],
            "upload_date": timestamp,
            "file_hash": file_hash,
            "file_size": file_path.stat().st_size,
            "status": "active"
        }
        
        metadata["documents"].append(new_doc)
        self.save_metadata(metadata)
        
        logger.info(f"Document added: {doc_id} - {filename}")
        return new_doc
    
    def delete_document_by_id(self, doc_id: str):
        """Помечает документ как удаленный"""
        metadata = self.load_metadata()
        
        for doc in metadata["documents"]:
            if doc["id"] == doc_id:
                doc["status"] = "deleted"
                doc["deleted_date"] = datetime.now().isoformat()
                
                # Опционально: удаляем физический файл
                file_path = self.data_folder / doc["stored_filename"]
                if file_path.exists():
                    file_path.unlink()
                
                logger.info(f"Document deleted: {doc_id}")
                break
        
        self.save_metadata(metadata)
    
    def get_active_documents(self) -> List[Dict[str, Any]]:
        """Возвращает список активных документов"""
        metadata = self.load_metadata()
        return [doc for doc in metadata["documents"] if doc.get("status") == "active"]
    
    def get_document_by_id(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """Получает документ по ID"""
        metadata = self.load_metadata()
        for doc in metadata["documents"]:
            if doc["id"] == doc_id:
                return doc
        return None
    
    def generate_id(self) -> str:
        """Генерирует уникальный ID"""
        return f"doc_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"
    
    def search_documents(self, query: str) -> List[Dict[str, Any]]:
        """Поиск документов по названию и тегам"""
        query_lower = query.lower()
        results = []
        
        for doc in self.get_active_documents():
            # Поиск в названии
            if query_lower in doc["title"].lower():
                results.append(doc)
                continue
            
            # Поиск в тегах
            if any(query_lower in tag.lower() for tag in doc.get("tags", [])):
                results.append(doc)
                continue
            
            # Поиск в описании
            if query_lower in doc.get("description", "").lower():
                results.append(doc)
        
        return results
    
    def get_statistics(self) -> Dict[str, Any]:
        """Возвращает статистику по документам"""
        metadata = self.load_metadata()
        active_docs = [doc for doc in metadata["documents"] if doc.get("status") == "active"]
        
        total_size = sum(doc.get("file_size", 0) for doc in active_docs)
        
        # Группировка по расширениям
        extensions = {}
        for doc in active_docs:
            ext = Path(doc["original_filename"]).suffix.lower()
            extensions[ext] = extensions.get(ext, 0) + 1
        
        return {
            "total_documents": len(active_docs),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
            "file_types": extensions,
            "oldest_document": min((doc["upload_date"] for doc in active_docs), default=None),
            "newest_document": max((doc["upload_date"] for doc in active_docs), default=None)
        }