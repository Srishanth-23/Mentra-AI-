import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from models.db import get_db_connection
from services.quiz_generation import generate_quiz_questions_for_concept, generate_misconception_explanation
from services.mastery_engine import calculate_concept_mastery

router = APIRouter()

class QuizGenerateRequest(BaseModel):
    concept_id: int
    difficulty: Optional[str] = "medium"

class QuizGradeRequest(BaseModel):
    question_id: int
    student_answer: str
    confidence_stated: Optional[int] = 3
    response_time_ms: Optional[int] = 5000

@router.post("/quiz/generate")
async def generate_quiz(req: QuizGenerateRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    concept = cursor.execute(
        "SELECT id, document_id, name, summary FROM concepts WHERE id = ?",
        (req.concept_id,)
    ).fetchone()

    if not concept:
        conn.close()
        raise HTTPException(status_code=404, detail="Concept not found.")

    chunks_db = cursor.execute(
        "SELECT text, page_num FROM chunks WHERE document_id = ? LIMIT 3",
        (concept["document_id"],)
    ).fetchall()
    chunks = [{"text": c["text"], "page_num": c["page_num"]} for c in chunks_db]

    # Fetch document language & simplify mode settings
    doc_settings = cursor.execute(
        "SELECT preferred_language, simplify_mode FROM documents WHERE id = ?",
        (concept["document_id"],)
    ).fetchone()
    lang_code = doc_settings["preferred_language"] if doc_settings and doc_settings["preferred_language"] else "en"
    simplify_mode = bool(doc_settings["simplify_mode"]) if doc_settings and "simplify_mode" in doc_settings.keys() else False

    # Generate validated questions in target language
    questions_data = generate_quiz_questions_for_concept(
        concept_name=concept["name"],
        concept_summary=concept["summary"],
        chunks=chunks,
        difficulty=req.difficulty,
        count=5,
        lang_code=lang_code,
        simplify_mode=simplify_mode
    )

    output_questions = []
    for q in questions_data:
        cursor.execute("""
        INSERT INTO questions (concept_id, question_text, options, correct_answer, difficulty, validated)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            req.concept_id,
            q["question_text"],
            json.dumps(q["options"]),
            q["correct_answer"],
            q.get("difficulty", req.difficulty),
            1 if q.get("validated", True) else 0
        ))
        q_id = cursor.lastrowid
        output_questions.append({
            "id": q_id,
            "concept_id": req.concept_id,
            "question_text": q["question_text"],
            "options": q["options"],
            "difficulty": q.get("difficulty", req.difficulty)
        })

    conn.commit()
    conn.close()

    return {"questions": output_questions}

@router.post("/quiz/grade")
async def grade_quiz(req: QuizGradeRequest):
    conn = get_db_connection()
    cursor = conn.cursor()

    q_row = cursor.execute(
        "SELECT id, concept_id, question_text, options, correct_answer FROM questions WHERE id = ?",
        (req.question_id,)
    ).fetchone()

    if not q_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Question not found.")

    is_correct = (req.student_answer.strip().lower() == q_row["correct_answer"].strip().lower())

    # Log attempt
    cursor.execute("""
    INSERT INTO quiz_attempts (concept_id, question_id, student_answer, is_correct, confidence_stated, response_time_ms)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (
        q_row["concept_id"],
        req.question_id,
        req.student_answer,
        1 if is_correct else 0,
        req.confidence_stated,
        req.response_time_ms
    ))
    conn.commit()

    # Recalculate concept mastery score using existing connection
    mastery_data = calculate_concept_mastery(q_row["concept_id"], external_conn=conn)

    # If incorrect, generate misconception diagnosis & fingerprint pattern
    misconception_explanation = ""
    followup_question = ""
    cited_chunk = {}
    detected_pattern = None

    if not is_correct:
        attempt_id = cursor.lastrowid
        # Fetch concept document chunks for context
        c_row = cursor.execute("SELECT document_id FROM concepts WHERE id = ?", (q_row["concept_id"],)).fetchone()
        chunk_row = None
        if c_row:
            chunk_row = cursor.execute(
                "SELECT id, text, page_num FROM chunks WHERE document_id = ? LIMIT 1",
                (c_row["document_id"],)
            ).fetchone()

        chunk_text = chunk_row["text"] if chunk_row else ""
        if chunk_row:
            cited_chunk = {"chunk_id": chunk_row["id"], "page": chunk_row["page_num"]}

        doc_settings = cursor.execute(
            "SELECT preferred_language, simplify_mode FROM documents WHERE id = ?",
            (c_row["document_id"],)
        ).fetchone() if c_row else None
        lang_code = doc_settings["preferred_language"] if doc_settings and doc_settings["preferred_language"] else "en"
        simplify_mode = bool(doc_settings["simplify_mode"]) if doc_settings and "simplify_mode" in doc_settings.keys() else False

        diagnosis = generate_misconception_explanation(
            question_text=q_row["question_text"],
            student_answer=req.student_answer,
            correct_answer=q_row["correct_answer"],
            source_chunk_text=chunk_text,
            lang_code=lang_code,
            simplify_mode=simplify_mode
        )
        misconception_explanation = diagnosis.get("explanation", "")
        followup_question = diagnosis.get("followup_question", "")

        if c_row and misconception_explanation:
            from services.misconception_service import process_misconception_fingerprint
            detected_pattern = process_misconception_fingerprint(
                quiz_attempt_id=attempt_id,
                concept_id=q_row["concept_id"],
                misconception_text=misconception_explanation,
                document_id=c_row["document_id"]
            )

    conn.commit()
    conn.close()

    return {
        "is_correct": is_correct,
        "correct_answer": q_row["correct_answer"],
        "mastery": mastery_data,
        "misconception_explanation": misconception_explanation,
        "cited_chunk": cited_chunk,
        "followup_question": followup_question,
        "detected_pattern": detected_pattern
    }
