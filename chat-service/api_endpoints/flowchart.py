from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from langchain.prompts.prompt import PromptTemplate
from langchain_openai import ChatOpenAI
import logging

from app.prompts import get_teacher_flowchart_prompt, get_student_flowchart_prompt
from app.utils import extract_sources_list
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

class ChatRequest(BaseModel):
    query: str
    session_id: str = "default"

@router.post("/teacher/flowchart")
async def teacher_flowchart(payload: ChatRequest, request: Request):
    """Генерация блок-схемы для преподавателей"""
    try:
        vectorstore_manager = request.state.teacher_vectorstore
        cache_manager = request.state.cache
        
        # Проверяем кеш
        cache_key = f"flowchart:teacher:{payload.query[:100]}"
        if cache_manager:
            cached = await cache_manager.get(cache_key)
            if cached:
                return JSONResponse(cached)
        
        # Поиск релевантных документов
        relevant_docs = await vectorstore_manager.search(payload.query, k=3)
        context = "\n".join(doc.page_content for doc in relevant_docs)
        sources = extract_sources_list(relevant_docs)
        
        # Создаем prompt
        prompt = PromptTemplate(
            template=get_teacher_flowchart_prompt(),
            input_variables=["context", "question"]
        )
        
        # Генерируем Mermaid код
        llm = ChatOpenAI(
            openai_api_key=settings.openai_api_key,
            temperature=0,
            model_name=settings.openai_model
        )
        
        chain = prompt | llm
        response = await chain.ainvoke({
            "context": context,
            "question": payload.query
        })
        
        mermaid_code = response.content.strip()
        
        result = {
            "mermaid": mermaid_code,
            "sources": sources
        }
        
        # Кешируем результат
        if cache_manager:
            await cache_manager.set(cache_key, result, ttl=settings.cache_ttl)
        
        return JSONResponse(result)
        
    except Exception as e:
        logger.error(f"Flowchart generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/student/flowchart")
async def student_flowchart(payload: ChatRequest, request: Request):
    """Генерация блок-схемы для студентов"""
    try:
        vectorstore_manager = request.state.student_vectorstore
        cache_manager = request.state.cache
        
        # Проверяем кеш
        cache_key = f"flowchart:student:{payload.query[:100]}"
        if cache_manager:
            cached = await cache_manager.get(cache_key)
            if cached:
                return JSONResponse(cached)
        
        # Поиск релевантных документов
        relevant_docs = await vectorstore_manager.search(payload.query, k=3)
        context = "\n".join(doc.page_content for doc in relevant_docs)
        sources = extract_sources_list(relevant_docs)
        
        # Создаем prompt
        prompt = PromptTemplate(
            template=get_student_flowchart_prompt(),
            input_variables=["context", "question"]
        )
        
        # Генерируем Mermaid код
        llm = ChatOpenAI(
            openai_api_key=settings.openai_api_key,
            temperature=0,
            model_name=settings.openai_model
        )
        
        chain = prompt | llm
        response = await chain.ainvoke({
            "context": context,
            "question": payload.query
        })
        
        mermaid_code = response.content.strip()
        
        result = {
            "mermaid": mermaid_code,
            "sources": sources
        }
        
        # Кешируем результат
        if cache_manager:
            await cache_manager.set(cache_key, result, ttl=settings.cache_ttl)
        
        return JSONResponse(result)
        
    except Exception as e:
        logger.error(f"Flowchart generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))