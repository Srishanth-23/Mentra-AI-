from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.teaching_service import (
    start_teaching_session,
    generate_novice_response,
    evaluate_teaching_session,
    get_teaching_history_for_concept
)

router = APIRouter()

class StartSessionRequest(BaseModel):
    document_id: int
    concept_id: int

class MessageRequest(BaseModel):
    session_id: int
    student_message: str

class EvaluateRequest(BaseModel):
    session_id: int

@router.post("/teaching/start")
async def start_session(req: StartSessionRequest):
    try:
        data = start_teaching_session(req.document_id, req.concept_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start teaching session: {str(e)}")

@router.post("/teaching/message")
async def send_message(req: MessageRequest):
    try:
        data = generate_novice_response(req.session_id, req.student_message)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate novice response: {str(e)}")

@router.post("/teaching/evaluate")
async def evaluate_session(req: EvaluateRequest):
    try:
        data = evaluate_teaching_session(req.session_id)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to evaluate teaching session: {str(e)}")

@router.get("/teaching/history/{concept_id}")
async def get_history(concept_id: int):
    try:
        history = get_teaching_history_for_concept(concept_id)
        return {"concept_id": concept_id, "sessions": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load teaching history: {str(e)}")
