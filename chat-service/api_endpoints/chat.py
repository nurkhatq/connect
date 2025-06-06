from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import logging

from app.history import ChatHistoryResponse, ChatDeleteResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# Импортируем assistant'ов из других модулей
from api_endpoints.teacher import teacher_assistant
from api_endpoints.student import student_assistant

class ChatClearRequest(BaseModel):
    session_id: str = "default"

@router.get("/{role}/chat/clear")
async def clear_chat(role: str, request: Request, session_id: str = "default"):
    """Очистить историю чата"""
    if role.lower() == "teacher":
        if teacher_assistant:
            teacher_assistant.clear_history(session_id)
    elif role.lower() == "student":
        if student_assistant:
            student_assistant.clear_history(session_id)
    else:
        raise HTTPException(status_code=404, detail="Role not found")
    
    # Очищаем кеш
    cache_manager = request.state.cache
    if cache_manager:
        await cache_manager.clear_pattern(f"{role}_chat:{session_id}:*")
    
    return {"message": "История чата очищена"}

@router.get("/{role}/chat/history", response_model=ChatHistoryResponse)
async def get_chat_history(role: str, session_id: str = "default"):
    """Получить историю чата"""
    if role.lower() == "teacher":
        hist = teacher_assistant.histories.get(session_id, []) if teacher_assistant else []
    elif role.lower() == "student":
        hist = student_assistant.histories.get(session_id, []) if student_assistant else []
    else:
        raise HTTPException(status_code=404, detail="Role not found")
    
    conversation = [
        {
            "id": idx,
            "role": entry["role"],
            "content": entry["content"],
            "time": entry.get("timestamp", entry.get("time", "")),
            "sources": entry.get("sources", [])
        }
        for idx, entry in enumerate(hist)
    ]
    
    return {"session_id": session_id, "history": conversation}

@router.delete("/{role}/chat/history", response_model=ChatDeleteResponse)
async def delete_chat_message(
    role: str,
    session_id: str = "default",
    message_id: int = None
):
    """Удалить сообщение из истории"""
    if role.lower() == "teacher":
        hist = teacher_assistant.histories.get(session_id, []) if teacher_assistant else []
    elif role.lower() == "student":
        hist = student_assistant.histories.get(session_id, []) if student_assistant else []
    else:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if message_id is None or message_id < 0 or message_id >= len(hist):
        raise HTTPException(status_code=400, detail="Invalid message_id")
    
    hist.pop(message_id)
    return {"message": f"Deleted message {message_id} from session {session_id}"}

@router.get("/endpoints")
async def list_endpoints():
    """Список всех доступных endpoints"""
    return {
        "chat": {
            "teacher": {
                "chat": "POST /api/teacher/chat",
                "history": "GET /api/teacher/chat/history",
                "clear": "GET /api/teacher/chat/clear"
            },
            "student": {
                "chat": "POST /api/student/chat",
                "history": "GET /api/student/chat/history",
                "clear": "GET /api/student/chat/clear"
            }
        },
        "documents": {
            "list": "GET /api/{role}/docs",
            "upload": "POST /api/{role}/docs/upload",
            "check_similarity": "POST /api/{role}/docs/check_similarity",
            "analyze": "POST /api/{role}/docs/analyze"
        },
        "flowchart": {
            "generate": "POST /api/{role}/flowchart"
        },
        "generate": {
            "file": "POST /api/generate",
            "practice_plan": "POST /api/generate_practice_plan"
        }
    }