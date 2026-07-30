from fastapi import APIRouter, HTTPException
from models.db import get_db_connection

router = APIRouter()

@router.delete("/privacy/delete/{document_id}")
async def delete_document_data(document_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()

    doc = cursor.execute("SELECT id FROM documents WHERE id = ?", (document_id,)).fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found.")

    cursor.execute("DELETE FROM documents WHERE id = ?", (document_id,))
    cursor.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
    
    # Delete cascade via concept IDs
    cursor.execute("DELETE FROM questions WHERE concept_id IN (SELECT id FROM concepts WHERE document_id = ?)", (document_id,))
    cursor.execute("DELETE FROM quiz_attempts WHERE concept_id IN (SELECT id FROM concepts WHERE document_id = ?)", (document_id,))
    cursor.execute("DELETE FROM mastery_scores WHERE concept_id IN (SELECT id FROM concepts WHERE document_id = ?)", (document_id,))
    cursor.execute("DELETE FROM recovery_plans WHERE concept_id IN (SELECT id FROM concepts WHERE document_id = ?)", (document_id,))
    cursor.execute("DELETE FROM concepts WHERE document_id = ?", (document_id,))
    cursor.execute("DELETE FROM answers_log WHERE document_id = ?", (document_id,))

    conn.commit()
    conn.close()

    return {"message": f"All session data for document ID {document_id} deleted successfully."}
