from fastapi import APIRouter, HTTPException
from services.personal_graph_service import get_personal_graph, get_graph_drift_summary
from services.misconception_service import get_misconception_patterns_for_document

router = APIRouter()

@router.get("/personal-graph/{document_id}")
async def get_personal_concept_graph(document_id: int):
    try:
        graph = get_personal_graph(document_id)
        return graph
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving personal graph: {str(e)}")

@router.get("/graph-drift/{document_id}")
async def get_graph_drift(document_id: int):
    try:
        summary = get_graph_drift_summary(document_id)
        return summary
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving graph drift summary: {str(e)}")

@router.get("/misconceptions/{document_id}/traced")
async def get_traced_misconceptions(document_id: int):
    try:
        patterns = get_misconception_patterns_for_document(document_id)
        traced_patterns = [p for p in patterns if p.get("traced_prerequisite_id")]
        return {
            "document_id": document_id,
            "patterns": patterns,
            "traced_patterns": traced_patterns
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving traced misconceptions: {str(e)}")
