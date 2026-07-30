from fastapi import APIRouter
from typing import List, Dict, Any
from services.misconception_service import get_misconception_patterns_for_document

router = APIRouter()

@router.get("/misconception-patterns/{document_id}")
async def get_misconception_patterns(document_id: int):
    patterns = get_misconception_patterns_for_document(document_id)
    return {"document_id": document_id, "patterns": patterns}
