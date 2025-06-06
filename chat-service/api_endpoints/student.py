from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import logging

from app.chat_assistant import ChatAssistant
from app.utils import extract_sources_list
from app.prompts import get_student_prompt_template
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# Глобальная переменная для assistant
student_assistant = None

class ChatRequest(BaseModel):
    query: str
    session_id: str = "default"

class ChatResponse(BaseModel):
    answer: str
    sources: list = []

@router.post("/chat", response_model=ChatResponse)
async def student_chat(payload: ChatRequest, request: Request):
    """Оптимизированный chat endpoint для студентов"""
    try:
        # Получаем vectorstore manager из request state
        vectorstore_manager = request.state.student_vectorstore
        cache_manager = request.state.cache
        
        if not vectorstore_manager:
            raise HTTPException(status_code=503, detail="Vectorstore not initialized")
        
        # Проверяем кеш
        cache_key = f"student_chat:{payload.session_id}:{payload.query[:100]}"
        cached_response = await cache_manager.get(cache_key) if cache_manager else None
        
        if cached_response:
            logger.info(f"Cache hit for student chat query")
            return ChatResponse(**cached_response)
        
        # Инициализируем assistant если нужно
        global student_assistant
        if not student_assistant:
            student_assistant = ChatAssistant(
                vectorstore_manager=vectorstore_manager,
                prompt_template=get_student_prompt_template(),
                cache_manager=cache_manager
            )
        
        # Получаем ответ
        answer, sources = await student_assistant.get_answer_async(
            payload.query,
            payload.session_id
        )
        
        response = ChatResponse(answer=answer, sources=sources)
        
        # Кешируем
        if cache_manager:
            await cache_manager.set(cache_key, response.dict(), ttl=settings.cache_ttl)
        
        return response
        
    except Exception as e:
        logger.error(f"Error in student chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/history/{session_id}")
async def get_history(session_id: str):
    """Получить историю чата"""
    if student_assistant:
        return {"history": student_assistant.get_history(session_id)}
    return {"history": []}

@router.delete("/history/{session_id}")
async def clear_history(session_id: str, request: Request):
    """Очистить историю чата"""
    if student_assistant:
        student_assistant.clear_history(session_id)
        
        # Очищаем кеш
        cache_manager = request.state.cache
        if cache_manager:
            await cache_manager.clear_pattern(f"student_chat:{session_id}:*")
    
    return {"message": "История чата очищена"}