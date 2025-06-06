# chat-service/scripts/initialize_metadata.py
# Минимальная версия только для студентов

import os
import sys
import asyncio
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_management.document_manager import DocumentManager
from core.vectorstore_manager import VectorstoreManager
from app.embeddings import embeddings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def initialize_metadata_for_files(file_list, data_folder, rebuild_index=True):
    """Initialize metadata for a list of files"""
    manager = DocumentManager(data_folder)
    added_count = 0
    
    for file_name in file_list:
        file_path = os.path.join(data_folder, file_name)
        if os.path.exists(file_path):
            doc = manager.add_document(
                file_path,
                title=file_name.split('.')[0],
                description="Документ для студентов AITU"
            )
            logger.info(f"Added metadata for: {file_name}")
            added_count += 1
        else:
            logger.warning(f"File not found: {file_name}")
    
    logger.info(f"Added metadata for {added_count} files")
    
    if rebuild_index and added_count > 0:
        logger.info("Rebuilding vector index...")
        index_folder = os.path.join(os.path.dirname(data_folder), "indexes_stud")
        vectorstore_manager = VectorstoreManager(data_folder, index_folder, embeddings)
        await vectorstore_manager.initialize()
        logger.info("Vector index rebuilt successfully")

async def main():
    # ТОЛЬКО ДЛЯ СТУДЕНТОВ
    data_folder = "/app/data_stud"
    
    student_files = [
        "AITU_Excellence_Test.docx",
        # Добавьте другие файлы если есть
    ]
    
    await initialize_metadata_for_files(student_files, data_folder, rebuild_index=True)
    logger.info("Student metadata initialization complete.")

if __name__ == "__main__":
    asyncio.run(main())