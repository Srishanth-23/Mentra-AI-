from fastapi import APIRouter
from typing import Dict, Any
from services.global_memory_service import get_concept_global_history

router = APIRouter()

@router.get("/global-concepts/history/{concept_id}")
async def get_global_concept_history(concept_id: int):
    return get_concept_global_history(concept_id)
