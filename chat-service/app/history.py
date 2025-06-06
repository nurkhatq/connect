from typing import List, Dict
from datetime import datetime
from pydantic import BaseModel

class ChatHistoryResponse(BaseModel):
    session_id: str
    history: List[Dict]

class ChatDeleteResponse(BaseModel):
    message: str