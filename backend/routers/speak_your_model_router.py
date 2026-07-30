from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.speak_your_model_service import (
    analyze_spoken_explanation,
    get_speak_your_model_history
)

router = APIRouter()

class AnalyzeSpokenRequest(BaseModel):
    document_id: int
    concept_id: int
    transcript: str

@router.post("/speak-your-model/analyze")
async def analyze_spoken_model(req: AnalyzeSpokenRequest):
    try:
        if not req.transcript or len(req.transcript.strip()) < 5:
            raise HTTPException(status_code=400, detail="Transcript is too short to analyze.")
        res = analyze_spoken_explanation(req.document_id, req.concept_id, req.transcript.strip())
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze spoken explanation: {str(e)}")

@router.get("/speak-your-model/history/{concept_id}")
async def get_history(concept_id: int):
    try:
        history = get_speak_your_model_history(concept_id)
        return {"concept_id": concept_id, "sessions": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve speak-your-model history: {str(e)}")
