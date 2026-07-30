import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from models.db import get_db_connection
from services.personal_graph_service import update_personal_graph

router = APIRouter()

class ConfirmConceptsRequest(BaseModel):
    concept_id: int
    prerequisite_ids: List[int]

@router.post("/concepts/confirm")
async def confirm_concepts(req: ConfirmConceptsRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    concept = cursor.execute("SELECT id, document_id FROM concepts WHERE id = ?", (req.concept_id,)).fetchone()
    if not concept:
        conn.close()
        raise HTTPException(status_code=404, detail="Concept not found.")

    document_id = concept["document_id"]

    cursor.execute("""
    UPDATE concepts
    SET prerequisite_ids = ?, prerequisites_confirmed = 1
    WHERE id = ?
    """, (json.dumps(req.prerequisite_ids), req.concept_id))

    conn.commit()

    # Update personal concept graph deltas
    update_personal_graph(document_id, req.concept_id, external_conn=conn)

    conn.commit()
    conn.close()

    return {
        "concept_id": req.concept_id,
        "prerequisites_confirmed": True
    }
