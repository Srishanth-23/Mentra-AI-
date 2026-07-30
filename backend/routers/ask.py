import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from models.db import get_db_connection
from services.embeddings import embed_query, get_or_create_index
from services.reliability_scoring import generate_grounded_answer
from services.mastery_engine import calculate_concept_mastery
from services.recovery_engine import update_recovery_plan

router = APIRouter()

class AskRequest(BaseModel):
    question: str
    document_id: int

@router.post("/ask")
async def ask_question(req: AskRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Fetch chunks for document if FAISS index is empty in memory
    faiss_manager = get_or_create_index(req.document_id)
    if faiss_manager.index.ntotal == 0:
        chunks_db = cursor.execute(
            "SELECT id, document_id, text, page_num, embedding_vector FROM chunks WHERE document_id = ?",
            (req.document_id,)
        ).fetchall()
        if not chunks_db:
            conn.close()
            raise HTTPException(status_code=404, detail="Document not found or has no chunks.")

        chunks = []
        embeddings = []
        for c in chunks_db:
            chunks.append({"id": c["id"], "document_id": c["document_id"], "text": c["text"], "page_num": c["page_num"]})
            if c["embedding_vector"]:
                try:
                    embeddings.append(json.loads(c["embedding_vector"].decode("utf-8")))
                except Exception:
                    embeddings.append([0.0] * 768)
            else:
                embeddings.append([0.0] * 768)
        faiss_manager.add_chunks(chunks, embeddings)

    # 2. Search FAISS index
    q_emb = embed_query(req.question)
    candidate_chunks = faiss_manager.search(q_emb, top_k=4)

    # If vector search yielded empty fallback
    if not candidate_chunks:
        chunks_db = cursor.execute(
            "SELECT id, text, page_num FROM chunks WHERE document_id = ? LIMIT 3",
            (req.document_id,)
        ).fetchall()
        candidate_chunks = [{"id": c["id"], "text": c["text"], "page_num": c["page_num"]} for c in chunks_db]

    # 3. Match question to relevant concept in document
    concepts_db = cursor.execute(
        "SELECT id, name, exam_frequency FROM concepts WHERE document_id = ?",
        (req.document_id,)
    ).fetchall()

    matched_concept = None
    if concepts_db:
        q_lower = req.question.lower()
        for c in concepts_db:
            c_name_lower = c["name"].lower()
            if c_name_lower in q_lower or any(kw in q_lower for kw in c_name_lower.split() if len(kw) > 3):
                matched_concept = c
                break
        if not matched_concept:
            matched_concept = concepts_db[0]

    concept_id = matched_concept["id"] if matched_concept else None
    concept_name = matched_concept["name"] if matched_concept else "Core Topic"
    exam_frequency = matched_concept["exam_frequency"] if matched_concept and "exam_frequency" in matched_concept.keys() else 0

    # 4. Increment doubt_count in mastery_scores
    doubt_count = 1
    if concept_id:
        existing = cursor.execute(
            "SELECT doubt_count FROM mastery_scores WHERE concept_id = ?",
            (concept_id,)
        ).fetchone()
        if existing:
            doubt_count = (existing["doubt_count"] or 0) + 1
            cursor.execute(
                "UPDATE mastery_scores SET doubt_count = ? WHERE concept_id = ?",
                (doubt_count, concept_id)
            )
        else:
            doubt_count = 1

        conn.commit()

        # Recalculate mastery & update recovery plan with new doubt count
        calculate_concept_mastery(concept_id, external_conn=conn)
        update_recovery_plan(req.document_id, external_conn=conn)

    # Fetch document language & simplify mode settings
    doc_settings = cursor.execute(
        "SELECT preferred_language, simplify_mode FROM documents WHERE id = ?",
        (req.document_id,)
    ).fetchone()
    lang_code = doc_settings["preferred_language"] if doc_settings and doc_settings["preferred_language"] else "en"
    simplify_mode = bool(doc_settings["simplify_mode"]) if doc_settings and "simplify_mode" in doc_settings.keys() else False

    # 5. 2-pass RAG generation + Reliability scoring with Multilingual & Simplify support
    answer, citations, grounding_strength = generate_grounded_answer(
        req.question, 
        candidate_chunks, 
        lang_code=lang_code, 
        simplify_mode=simplify_mode
    )

    # 6. Log Q&A in answers_log using existing connection
    cited_ids = [c.get("chunk_id", 0) for c in citations]
    cursor.execute("""
    INSERT INTO answers_log (concept_id, question, answer_text, grounding_strength, cited_chunk_ids)
    VALUES (?, ?, ?, ?, ?)
    """, (concept_id, req.question, answer, grounding_strength, json.dumps(cited_ids)))

    conn.commit()
    conn.close()

    return {
        "answer": answer,
        "citations": citations,
        "grounding_strength": grounding_strength,
        "concept_id": concept_id,
        "concept_name": concept_name,
        "doubt_count": doubt_count,
        "exam_frequency": exam_frequency,
        "language_code": lang_code,
        "simplify_mode": simplify_mode
    }

class LanguageSettingsRequest(BaseModel):
    language_code: str
    simplify_mode: Optional[bool] = False

@router.post("/documents/{doc_id}/language")
async def update_document_language(doc_id: int, req: LanguageSettingsRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    doc = cursor.execute("SELECT id FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        conn.close()
        raise HTTPException(status_code=404, detail="Document not found")
        
    cursor.execute(
        "UPDATE documents SET preferred_language = ?, simplify_mode = ? WHERE id = ?",
        (req.language_code.lower(), 1 if req.simplify_mode else 0, doc_id)
    )
    conn.commit()
    conn.close()
    
    from services.prompt_utils import get_language_name
    return {
        "status": "success",
        "document_id": doc_id,
        "language_code": req.language_code,
        "language_name": get_language_name(req.language_code),
        "simplify_mode": req.simplify_mode
    }
