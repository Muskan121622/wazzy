import sys
import os
import traceback
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, List

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from services.agent import run_agent_chat

router = APIRouter(prefix="/api/chat", tags=["Agent Chat"])

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    user_message: str
    trip_id: str = "trip_1"
    destination: Optional[str] = None
    history: Optional[List[ChatMessage]] = []  # Conversation history for session memory

@router.post("")
def chat_with_agent(req: ChatRequest):
    try:
        history = [{"role": m.role, "content": m.content} for m in (req.history or [])]
        res = run_agent_chat(
            req.user_message,
            trip_id=req.trip_id,
            destination=req.destination,
            history=history
        )
        return res
    except Exception as e:
        tb = traceback.format_exc()
        print(f"[CHAT ERROR] {e}\n{tb}")
        return {
            "reply": f"TripOS Agent encountered an error. Please try again. ({str(e)[:120]})",
            "tool_executed": None,
            "tool_args": {},
            "tool_result": None,
            "rag_context": []
        }
