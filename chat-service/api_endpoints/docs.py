from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
import os
import aiofiles
from pathlib import Path
import logging
from typing import Optional

from data_management.document_manager import DocumentManager
from core.async_processor import AsyncDocumentProcessor
from app.utils import find_similar_files_async
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize document managers
teacher_doc_manager = DocumentManager(settings.data_folder)
student_doc_manager = DocumentManager(settings.data_folder_stud)

@router.get("/teacher/docs")
async def list_teacher_docs():
    """Список документов для преподавателей"""
    return teacher_doc_manager.get_active_documents()

@router.get("/student/docs")
async def list_student_docs():
    """Список документов для студентов"""
    return student_doc_manager.get_active_documents()

@router.post("/{role}/docs/upload")
async def upload_doc(
    role: str,
    request: Request,
    file: UploadFile = File(...),
    replace_doc_id: str = Form(None)
):
    """Асинхронная загрузка документа с автоматической переиндексацией"""
    try:
        if role not in ["teacher", "student"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Проверка размера файла
        if file.size and file.size > settings.max_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size: {settings.max_file_size / (1024*1024):.1f}MB"
            )
        
        # Выбираем менеджеры
        doc_manager = teacher_doc_manager if role == "teacher" else student_doc_manager
        vectorstore_manager = request.state.teacher_vectorstore if role == "teacher" else request.state.student_vectorstore
        
        # Сохраняем файл асинхронно
        data_folder = settings.data_folder if role == "teacher" else settings.data_folder_stud
        temp_path = Path(data_folder) / file.filename
        
        content = await file.read()
        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(content)
        
        # Управление документами
        if replace_doc_id:
            doc_manager.delete_document_by_id(replace_doc_id)
            new_doc = doc_manager.add_document(str(temp_path))
            action = f"Replaced {replace_doc_id} → {new_doc['id']}"
        else:
            new_doc = doc_manager.add_document(str(temp_path))
            action = f"Added new document {new_doc['id']}"
        
        # Асинхронная переиндексация
        logger.info(f"Triggering reindex for {role} after upload")
        await vectorstore_manager.rebuild_index()
        
        # Очищаем кеш
        cache_manager = request.state.cache
        if cache_manager:
            await cache_manager.clear_pattern(f"{role}_chat:*")
            await cache_manager.clear_pattern("search_*")
        
        return {
            "message": "Document uploaded and indexed successfully",
            "file_action": action,
            "document_id": new_doc['id']
        }
        
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{role}/docs/check_similarity")
async def check_doc_similarity(
    role: str,
    request: Request,
    file: UploadFile = File(...)
):
    """Асинхронная проверка на дубликаты"""
    try:
        if role not in ["teacher", "student"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Сохраняем временный файл
        temp_dir = Path("temp")
        temp_dir.mkdir(exist_ok=True)
        temp_path = temp_dir / file.filename
        
        content = await file.read()
        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(content)
        
        # Извлекаем текст асинхронно
        processor = AsyncDocumentProcessor()
        chunks = await processor.process_document(temp_path)
        
        if not chunks:
            return {"possible_duplicates": []}
        
        # Объединяем текст из чанков
        full_text = " ".join(chunk["text"] for chunk in chunks[:10])  # Берем первые 10 чанков
        
        # Ищем похожие файлы
        folder = settings.data_folder if role == "teacher" else settings.data_folder_stud
        duplicates = await find_similar_files_async(full_text, folder, threshold=0.7)
        
        # Удаляем временный файл
        temp_path.unlink()
        
        return {"possible_duplicates": duplicates}
        
    except Exception as e:
        logger.error(f"Similarity check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{role}/docs/analyze")
async def analyze_doc(
    role: str,
    request: Request,
    file: UploadFile = File(...),
    question: str = Form("")
):
    """Асинхронный анализ документа"""
    try:
        if role not in ["teacher", "student"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        # Обрабатываем файл
        processor = AsyncDocumentProcessor()
        temp_path = Path("temp") / file.filename
        
        content = await file.read()
        async with aiofiles.open(temp_path, 'wb') as f:
            await f.write(content)
        
        # Извлекаем текст
        chunks = await processor.process_document(temp_path)
        temp_path.unlink()
        
        if not chunks:
            return {"answer": "Не удалось извлечь текст из файла"}
        
        file_text = "\n".join(chunk["text"] for chunk in chunks)
        
        # Используем chat assistant для анализа
        from app.chat_assistant import ChatAssistant
        from app.prompts import get_teacher_prompt_template, get_student_prompt_template
        
        vectorstore_manager = request.state.teacher_vectorstore if role == "teacher" else request.state.student_vectorstore
        prompt = get_teacher_prompt_template() if role == "teacher" else get_student_prompt_template()
        
        assistant = ChatAssistant(
            vectorstore_manager=vectorstore_manager,
            prompt_template=prompt,
            cache_manager=request.state.cache
        )
        
        # Формируем запрос
        full_query = f"Проанализируй следующий документ:\n\n{file_text[:3000]}...\n\n{question if question else 'Дай краткое описание документа.'}"
        
        answer, sources = await assistant.get_answer_async(full_query, "temp_analysis")
        
        return {"answer": answer, "sources": sources}
        
    except Exception as e:
        logger.error(f"Document analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{role}/docs/{doc_id}")
async def delete_doc(role: str, doc_id: str, request: Request):
    """Удаление документа"""
    try:
        if role not in ["teacher", "student"]:
            raise HTTPException(status_code=400, detail="Invalid role")
        
        doc_manager = teacher_doc_manager if role == "teacher" else student_doc_manager
        vectorstore_manager = request.state.teacher_vectorstore if role == "teacher" else request.state.student_vectorstore
        
        # Удаляем документ
        doc_manager.delete_document_by_id(doc_id)
        
        # Переиндексируем
        await vectorstore_manager.rebuild_index()
        
        # Очищаем кеш
        cache_manager = request.state.cache
        if cache_manager:
            await cache_manager.clear_pattern(f"{role}_chat:*")
        
        return {"message": f"Document {doc_id} deleted successfully"}
        
    except Exception as e:
        logger.error(f"Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))