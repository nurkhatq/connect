from langchain_openai import OpenAIEmbeddings
from langchain.embeddings.base import Embeddings
from typing import List
import logging
import os

logger = logging.getLogger(__name__)

# Вариант 1: Использование OpenAI embeddings
class OpenAIEmbeddingsWrapper(Embeddings):
    def __init__(self):
        """Инициализация OpenAI embeddings"""
        self.embeddings = OpenAIEmbeddings(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model="text-embedding-ada-002"
        )
        logger.info("Initialized OpenAI embeddings")
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Встраивание списка документов"""
        return self.embeddings.embed_documents(texts)
    
    def embed_query(self, text: str) -> List[float]:
        """Встраивание одного запроса"""
        return self.embeddings.embed_query(text)

# Вариант 2: Использование HuggingFace embeddings (без sentence-transformers)
class HuggingFaceEmbeddingsLocal(Embeddings):
    def __init__(self, model_name: str = "sentence-transformers/all-MiniLM-L12-v2"):
        """Инициализация с использованием transformers напрямую"""
        try:
            from transformers import AutoTokenizer, AutoModel
            import torch
            
            self.tokenizer = AutoTokenizer.from_pretrained(model_name)
            self.model = AutoModel.from_pretrained(model_name)
            self.model.eval()
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            self.model.to(self.device)
            logger.info(f"Initialized HuggingFace embeddings with model: {model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize HuggingFace embeddings: {e}")
            raise
    
    def mean_pooling(self, model_output, attention_mask):
        """Mean pooling для получения sentence embeddings"""
        import torch
        token_embeddings = model_output[0]
        input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
        return torch.sum(token_embeddings * input_mask_expanded, 1) / torch.clamp(input_mask_expanded.sum(1), min=1e-9)
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Общий метод для встраивания текстов"""
        import torch
        
        # Токенизация
        encoded_input = self.tokenizer(
            texts,
            padding=True,
            truncation=True,
            return_tensors='pt',
            max_length=512
        )
        
        # Перемещаем на устройство
        encoded_input = {k: v.to(self.device) for k, v in encoded_input.items()}
        
        # Получаем embeddings
        with torch.no_grad():
            model_output = self.model(**encoded_input)
        
        # Mean pooling
        embeddings = self.mean_pooling(model_output, encoded_input['attention_mask'])
        
        # Нормализация
        embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
        
        return embeddings.cpu().numpy().tolist()
    
    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """Встраивание списка документов"""
        if not texts:
            return []
        
        # Обрабатываем батчами для эффективности
        batch_size = 32
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = self.embed_texts(batch)
            all_embeddings.extend(batch_embeddings)
        
        return all_embeddings
    
    def embed_query(self, text: str) -> List[float]:
        """Встраивание одного запроса"""
        return self.embed_texts([text])[0]

# Выбираем реализацию в зависимости от настроек
def get_embeddings():
    """Фабрика для создания embeddings"""
    use_openai = os.getenv("USE_OPENAI_EMBEDDINGS", "false").lower() == "true"
    
    if use_openai:
        logger.info("Using OpenAI embeddings")
        return OpenAIEmbeddingsWrapper()
    else:
        try:
            # Пробуем использовать локальные embeddings
            logger.info("Using local HuggingFace embeddings")
            return HuggingFaceEmbeddingsLocal()
        except Exception as e:
            logger.warning(f"Failed to load local embeddings: {e}")
            logger.info("Falling back to OpenAI embeddings")
            return OpenAIEmbeddingsWrapper()

# Глобальный экземпляр
embeddings = get_embeddings()