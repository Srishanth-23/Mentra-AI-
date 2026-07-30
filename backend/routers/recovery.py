from fastapi import APIRouter
from services.recovery_engine import generate_recovery_plan

router = APIRouter()

@router.get("/recovery-plan/{document_id}")
async def get_recovery_plan(document_id: int):
    plan = generate_recovery_plan(document_id)
    return {"plan": plan}
