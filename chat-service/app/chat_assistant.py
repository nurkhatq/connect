from typing import List, Dict, Tuple, Optional
from datetime import datetime
import asyncio
import logging
from langchain_openai import ChatOpenAI
from langchain.chains import ConversationalRetrievalChain
from langchain.prompts import PromptTemplate

from config import settings
from core.vectorstore_manager import VectorstoreManager
from core.cache_manager import CacheManager

logger = logging.getLogger(__name__)

class ChatAssistant:
    def __init__(
        self,
        vectorstore_manager: VectorstoreManager,
        prompt_template: str,
        cache_manager: Optional[CacheManager] = None
    ):
        self.vectorstore_manager = vectorstore_manager
        self.cache_manager = cache_manager
        self.histories: Dict[str, List[Dict]] = {}
        
        # Initialize LLM
        self.llm = ChatOpenAI(
            openai_api_key=settings.openai_api_key,
            temperature=settings.openai_temperature,
            model_name=settings.openai_model
        )
        
        # Create prompt
        self.prompt = PromptTemplate(
            template=prompt_template,
            input_variables=["chat_history", "context", "question"]
        )
        
        # QA chain будет создаваться динамически
        self._qa_chain = None
    
    def _get_qa_chain(self):
        """Ленивая инициализация QA chain"""
        if not self._qa_chain and self.vectorstore_manager.vectorstore:
            self._qa_chain = ConversationalRetrievalChain.from_llm(
                llm=self.llm,
                retriever=self.vectorstore_manager.vectorstore.as_retriever(
                    search_kwargs={"k": settings.vector_search_k}
                ),
                return_source_documents=True,
                combine_docs_chain_kwargs={"prompt": self.prompt}
            )
        return self._qa_chain
    
    async def get_answer_async(self, user_query: str, session_id: str = "default") -> Tuple[str, List[str]]:
        """Асинхронное получение ответа с кешированием"""
        if session_id not in self.histories:
            self.histories[session_id] = []
        
        # Проверяем кеш для похожих вопросов
        if self.cache_manager:
            cache_key = f"answer:{user_query[:100]}"
            cached_answer = await self.cache_manager.get(cache_key)
            if cached_answer and isinstance(cached_answer, dict):
                logger.debug(f"Using cached answer for similar query")
                answer = cached_answer.get("answer", "")
                sources = cached_answer.get("sources", [])
                
                # Добавляем в историю
                self._add_to_history(session_id, user_query, answer, sources)
                return answer, sources
        
        # Используем оптимизированный векторный поиск
        relevant_docs = await self.vectorstore_manager.search(
            user_query,
            k=settings.vector_search_k
        )
        
        # Конвертируем историю
        chat_history = self._convert_history(session_id)
        
        # Запускаем chain в executor для избежания блокировки
        qa_chain = self._get_qa_chain()
        if not qa_chain:
            logger.error("QA chain not initialized")
            return "Извините, сервис временно недоступен.", []
        
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: qa_chain({
                "question": user_query,
                "chat_history": chat_history
            })
        )
        
        answer = result.get("answer", "")
        source_docs = result.get("source_documents", [])
        sources = self._extract_sources(source_docs)
        
        # Кешируем ответ
        if self.cache_manager:
            await self.cache_manager.set(
                cache_key,
                {"answer": answer, "sources": sources},
                ttl=settings.cache_ttl
            )
        
        # Добавляем в историю
        self._add_to_history(session_id, user_query, answer, sources)
        
        return answer, sources
    
    def _add_to_history(self, session_id: str, query: str, answer: str, sources: List[str]):
        """Добавляет запись в историю"""
        timestamp = datetime.now().isoformat()
        
        self.histories[session_id].append({
            "role": "user",
            "content": query,
            "timestamp": timestamp
        })
        
        self.histories[session_id].append({
            "role": "assistant",
            "content": answer,
            "sources": sources,
            "timestamp": timestamp
        })
        
        # Ограничиваем размер истории
        max_history = 100
        if len(self.histories[session_id]) > max_history * 2:
            self.histories[session_id] = self.histories[session_id][-max_history * 2:]
    
    def _convert_history(self, session_id: str) -> List[Tuple[str, str]]:
        """Конвертирует историю в формат LangChain"""
        history = self.histories.get(session_id, [])
        pairs = []
        last_user = None
        
        for entry in history[-20:]:  # Берем последние 10 пар
            if entry["role"] == "user":
                last_user = entry["content"]
            elif entry["role"] == "assistant" and last_user:
                pairs.append((last_user, entry["content"]))
                last_user = None
        
        return pairs
    
    def _extract_sources(self, source_docs) -> List[str]:
        """Извлекает уникальные источники"""
        seen = set()
        sources = []
        
        for doc in source_docs:
            file_name = doc.metadata.get("file_name", "Unknown")
            if file_name not in seen:
                seen.add(file_name)
                sources.append(file_name)
        
        return sources[:5]  # Ограничиваем количество источников
    
    def get_history(self, session_id: str) -> List[Dict]:
        """Получает историю чата"""
        return self.histories.get(session_id, [])
    
    def clear_history(self, session_id: str):
        """Очищает историю чата"""
        if session_id in self.histories:
            self.histories[session_id] = []