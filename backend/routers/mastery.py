from fastapi import APIRouter, HTTPException
from models.db import get_db_connection

router = APIRouter()

@router.get("/mastery/{document_id}")
async def get_document_mastery(document_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    concepts = cursor.execute(
        "SELECT id, name, summary FROM concepts WHERE document_id = ?",
        (document_id,)
    ).fetchall()

    if not concepts:
        conn.close()
        raise HTTPException(status_code=404, detail="Document concepts not found.")

    output = []
    for c in concepts:
        m_row = cursor.execute(
            "SELECT score, basis, doubt_count, last_updated FROM mastery_scores WHERE concept_id = ?",
            (c["id"],)
        ).fetchone()

        score = m_row["score"] if m_row else 0.50
        basis = m_row["basis"] if m_row else "heuristic: baseline default score (0 attempts)"
        doubt_count = m_row["doubt_count"] if m_row else 0

        output.append({
            "concept_id": c["id"],
            "name": c["name"],
            "summary": c["summary"],
            "score": score,
            "basis": basis,
            "doubt_count": doubt_count
        })

    conn.close()
    return {"concepts": output}
