from langchain.embeddings.base import Embeddings
from sentence_transformers import SentenceTransformer
from typing import List
import numpy as np
import logging

logger = logging.getLogger(__name__)

class MyEmbeddings(Embeddings):
    def __init__(self, model_name: str = 'all-MiniLM-L12-v2'):
        """Инициализация с кешированием модели"""
        self.model_name = model_name
        self._model = None
        logger.info(f"Initializing embeddings with model: {model_name}")
    
    @property
    def model(self):
        """Ленивая загрузка модели"""
        if self._model is None:
            logger.info(f"Loading sentence transformer model: {self.model_name}")
            self._model = SentenceTransformer(self.model_name)
        return self._model
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Встраивание списка документов"""
        if not texts:
            return []
        
        # Батчевая обработка для эффективности
        embeddings = self.model.encode(
            texts,
            convert_to_numpy=True,
            show_progress_bar=len(texts) > 100,
            batch_size=32
        )
        
        return embeddings.tolist()
    
    def embed_query(self, text: str) -> List[float]:
        """Встраивание одного запроса"""
        embedding = self.model.encode(
            [text],
            convert_to_numpy=True
        )[0]
        
        return embedding.tolist()

# Глобальный экземпляр
embeddings = MyEmbeddings()