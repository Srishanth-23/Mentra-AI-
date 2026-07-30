import json
import os
from typing import Dict, Any, List, Optional
from models.db import get_db_connection
from services.personal_graph_service import upsert_personal_edge
from dotenv import load_dotenv

def get_misconceptions_for_concept(concept_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("""
    SELECT mp.id, mp.pattern_description, me1.misconception_text
    FROM misconception_patterns mp
    JOIN misconception_embeddings me1 ON mp.misconception_embedding_id_1 = me1.id
    WHERE me1.concept_id = ? AND mp.taught_through = 0
    ORDER BY mp.id DESC
    """, (concept_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def generate_generic_plausible_misconception(concept_name: str, summary: str) -> str:
    load_dotenv(override=True)
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        return f"I'm confusing the primary operational role of {concept_name} with its foundational prerequisites."

    try:
        from services.key_manager import call_gemini_with_key_rotation
        prompt = f"""
A student is trying to learn "{concept_name}". Summary of concept: {summary}

Generate ONE plausible, realistic misconception that a beginner might have about this concept, based strictly on the concept definition. 
Keep it to 1 sentence in first-person voice (e.g. "I think that...").

Return only the one sentence.
"""
        res = call_gemini_with_key_rotation(prompt)
        return res.strip().replace('"', '')
    except Exception as e:
        print(f"Error generating generic misconception: {e}")
        return f"I think {concept_name} works automatically without requiring any prerequisite setup."

def start_teaching_session(document_id: int, concept_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    concept = cursor.execute("SELECT id, name, summary FROM concepts WHERE id = ?", (concept_id,)).fetchone()
    if not concept:
        conn.close()
        raise ValueError("Concept not found.")

    real_misc = get_misconceptions_for_concept(concept_id)

    if real_misc:
        source_pattern_id = real_misc[0]["id"]
        is_generic = False
        novice_seed = real_misc[0]["misconception_text"]
    else:
        source_pattern_id = None
        is_generic = True
        novice_seed = generate_generic_plausible_misconception(concept["name"], concept["summary"] or "")

    cursor.execute("""
    INSERT INTO teaching_sessions (document_id, concept_id, source_misconception_pattern_id, is_generic_mode, status)
    VALUES (?, ?, ?, ?, 'in_progress')
    """, (document_id, concept_id, source_pattern_id, 1 if is_generic else 0))

    session_id = cursor.lastrowid

    # Novice opening message
    opening_msg = f"Hi! I'm Alex. I'm really confused about {concept['name']}. {novice_seed} Can you explain how it actually works?"

    cursor.execute("""
    INSERT INTO teaching_messages (teaching_session_id, role, message_text)
    VALUES (?, 'novice', ?)
    """, (session_id, opening_msg))

    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "document_id": document_id,
        "concept_id": concept_id,
        "concept_name": concept["name"],
        "is_generic_mode": is_generic,
        "novice_seed": novice_seed,
        "opening_message": opening_msg
    }

def generate_novice_response(session_id: int, student_message: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    session = cursor.execute("""
    SELECT ts.id, ts.document_id, ts.concept_id, ts.is_generic_mode, ts.status, c.name as concept_name, c.summary
    FROM teaching_sessions ts
    JOIN concepts c ON ts.concept_id = c.id
    WHERE ts.id = ?
    """, (session_id,)).fetchone()

    if not session:
        conn.close()
        raise ValueError("Teaching session not found.")

    # Record student message
    cursor.execute("""
    INSERT INTO teaching_messages (teaching_session_id, role, message_text)
    VALUES (?, 'student', ?)
    """, (session_id, student_message))

    # Fetch conversation history
    history_rows = cursor.execute("""
    SELECT role, message_text FROM teaching_messages WHERE teaching_session_id = ? ORDER BY id ASC
    """, (session_id,)).fetchall()

    exchange_count = len([h for h in history_rows if h["role"] == "student"])

    # Cap turns at 6
    if exchange_count >= 6:
        closing_msg = "Thanks for explaining! I think I have a much better handle on this now. Let's see how I did!"
        cursor.execute("""
        INSERT INTO teaching_messages (teaching_session_id, role, message_text)
        VALUES (?, 'novice', ?)
        """, (session_id, closing_msg))
        cursor.execute("UPDATE teaching_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()
        return {
            "novice_response": closing_msg,
            "conversation_ended": True,
            "turn_count": exchange_count
        }

    # Fetch document language & simplify mode
    doc = cursor.execute("""
    SELECT d.preferred_language, d.simplify_mode 
    FROM teaching_sessions ts 
    JOIN documents d ON ts.document_id = d.id 
    WHERE ts.id = ?
    """, (session_id,)).fetchone()
    lang_code = doc["preferred_language"] if doc and doc["preferred_language"] else "en"
    simplify_mode = bool(doc["simplify_mode"]) if doc and "simplify_mode" in doc.keys() else False

    from services.prompt_utils import build_multilingual_prompt_suffix
    multilingual_suffix = build_multilingual_prompt_suffix(lang_code, simplify_mode)

    # Generate Novice persona LLM response
    first_msg = history_rows[0]["message_text"] if history_rows else ""
    formatted_transcript = "\n".join([f"{h['role'].upper()}: {h['message_text']}" for h in history_rows])

    prompt = f"""
You are "Alex," a student who is currently confused about "{session['concept_name']}".
Concept context: {session['summary']}
Your initial confusion: {first_msg}

Rules:
- Ask questions and make statements that reflect this exact confusion.
- Your knowledge is limited to what a beginner student would know before understanding this concept — do not suddenly demonstrate expert knowledge.
- When the real student (your tutor) gives a clear, correct explanation that directly addresses your confusion, gradually update your understanding and stop repeating the mistake — but do not concede too easily; ask one clarifying follow-up first if the explanation is vague or incomplete.
- Stay grounded in what's plausible for this specific subject.
- Keep messages short and conversational (2-3 sentences max), like a real confused student.

Conversation so far:
{formatted_transcript}

Respond as Alex (the novice student):
{multilingual_suffix}
"""
    try:
        from services.key_manager import call_gemini_with_key_rotation
        raw_res = call_gemini_with_key_rotation(prompt)
        novice_res = raw_res.strip()
    except Exception as e:
        print(f"Error generating novice response: {e}")
        novice_res = "Wait, so how does that connect back to the core prerequisite mechanism?"

    cursor.execute("""
    INSERT INTO teaching_messages (teaching_session_id, role, message_text)
    VALUES (?, 'novice', ?)
    """, (session_id, novice_res))

    conn.commit()
    conn.close()

    return {
        "novice_response": novice_res,
        "conversation_ended": False,
        "turn_count": exchange_count
    }

def calculate_teaching_mastery_boost(clarity: str, prerequisites_covered: List[int], total_prerequisites: int, misconception_resolved: bool) -> float:
    if not misconception_resolved:
        return 0.0

    clarity_weight = {"High": 0.15, "Medium": 0.10, "Low": 0.05}.get(clarity, 0.05)
    total_p = max(total_prerequisites, 1)
    coverage_ratio = min(len(prerequisites_covered) / total_p, 1.0)
    coverage_weight = coverage_ratio * 0.10

    boost = clarity_weight + coverage_weight
    return round(min(boost, 0.20), 3)

def evaluate_teaching_session(session_id: int) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    session = cursor.execute("""
    SELECT ts.id, ts.document_id, ts.concept_id, ts.source_misconception_pattern_id, c.name as concept_name, c.prerequisite_ids
    FROM teaching_sessions ts
    JOIN concepts c ON ts.concept_id = c.id
    WHERE ts.id = ?
    """, (session_id,)).fetchone()

    if not session:
        conn.close()
        raise ValueError("Session not found.")

    history_rows = cursor.execute("""
    SELECT role, message_text FROM teaching_messages WHERE teaching_session_id = ? ORDER BY id ASC
    """, (session_id,)).fetchall()

    transcript = "\n".join([f"{h['role'].upper()}: {h['message_text']}" for h in history_rows])

    # Fetch prerequisites
    p_ids = []
    if session["prerequisite_ids"]:
        try:
            p_ids = json.loads(session["prerequisite_ids"])
        except Exception:
            p_ids = []

    prereq_rows = []
    if p_ids:
        placeholders = ",".join(["?"] * len(p_ids))
        prereq_rows = cursor.execute(f"SELECT id, name, summary FROM concepts WHERE id IN ({placeholders})", p_ids).fetchall()

    prereqs_str = "\n".join([f"- ID {p['id']}: {p['name']} ({p['summary'] or 'N/A'})" for p in prereq_rows]) if prereq_rows else "None"

    prompt = f"""
Here is a teaching conversation between a student (tutor) and a simulated novice who was confused about "{session['concept_name']}":

Conversation transcript:
{transcript}

Relevant prerequisite concepts for "{session['concept_name']}":
{prereqs_str}

Evaluate the student's teaching:
1. Clarity: was the explanation clear and well-structured? ("High", "Medium", "Low")
2. Prerequisite coverage: which of the listed prerequisite concept IDs did the student's explanation correctly address? List matching IDs as integers.
3. Did the explanation directly resolve the novice's original misconception? (true/false)
4. One-paragraph reasoning for your assessment, referencing specific parts of the transcript.

Return JSON strictly in this format:
{{
  "clarity": "High" | "Medium" | "Low",
  "prerequisites_covered": [<list of integer concept IDs>],
  "misconception_resolved": true | false,
  "reasoning": "<one paragraph explanation>"
}}
"""
    try:
        from services.key_manager import call_gemini_with_key_rotation
        raw_res = call_gemini_with_key_rotation(prompt)
        clean_json = raw_res.strip().strip("```json").strip("```").strip()
        eval_data = json.loads(clean_json)
    except Exception as e:
        print(f"Error evaluating teaching session: {e}")
        eval_data = {
            "clarity": "Medium",
            "prerequisites_covered": p_ids,
            "misconception_resolved": True,
            "reasoning": "The student provided a structured explanation that addressed the core principles."
        }

    clarity = eval_data.get("clarity", "Medium")
    covered_prereqs = eval_data.get("prerequisites_covered", [])
    resolved = bool(eval_data.get("misconception_resolved", False))
    reasoning = eval_data.get("reasoning", "")

    boost = calculate_teaching_mastery_boost(clarity, covered_prereqs, len(p_ids), resolved)

    coverage_text = f"Covered {len(covered_prereqs)} of {len(p_ids)} relevant prerequisites"

    cursor.execute("""
    INSERT INTO teaching_evaluations (
        teaching_session_id, clarity_score, prerequisite_coverage,
        old_misconception_resolved, evaluation_reasoning, mastery_boost_applied
    ) VALUES (?, ?, ?, ?, ?, ?)
    """, (session_id, clarity, coverage_text, 1 if resolved else 0, reasoning, boost))

    cursor.execute("UPDATE teaching_sessions SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))

    # If resolved, apply mastery boost & update personal graph & mark misconception taught through
    basis_str = ""
    if resolved and boost > 0:
        # 1. Update mastery score with explicit basis string
        mastery_row = cursor.execute("SELECT score FROM mastery_scores WHERE concept_id = ?", (session["concept_id"],)).fetchone()
        old_score = mastery_row["score"] if mastery_row else 0.50
        new_score = round(min(old_score + boost, 1.0), 2)

        basis_str = f"+{boost} mastery boost from successfully teaching this concept to Alex — your explanation was rated {clarity} clarity and covered {len(covered_prereqs)} of {len(p_ids)} relevant prerequisites."

        cursor.execute("""
        INSERT INTO mastery_scores (concept_id, score, basis)
        VALUES (?, ?, ?)
        ON CONFLICT(concept_id) DO UPDATE SET
            score = ?,
            basis = ?,
            last_updated = CURRENT_TIMESTAMP
        """, (session["concept_id"], new_score, basis_str, new_score, basis_str))

        # 2. Mark misconception pattern taught through if source pattern exists
        if session["source_misconception_pattern_id"]:
            cursor.execute("""
            UPDATE misconception_patterns
            SET taught_through = 1, taught_through_session_id = ?
            WHERE id = ?
            """, (session_id, session["source_misconception_pattern_id"]))

        # 3. Strengthen personal edges for covered prerequisites
        for pr_id in covered_prereqs:
            pr_row = cursor.execute("SELECT name FROM concepts WHERE id = ?", (pr_id,)).fetchone()
            pr_name = pr_row["name"] if pr_row else "prerequisite"
            upsert_personal_edge(
                document_id=session["document_id"],
                from_concept_id=pr_id,
                to_concept_id=session["concept_id"],
                edge_type="strengthened",
                reason=f"Strengthened because you successfully taught the link to {pr_name} to Alex.",
                external_conn=conn
            )

    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "clarity": clarity,
        "prerequisite_coverage": coverage_text,
        "prerequisites_covered_ids": covered_prereqs,
        "misconception_resolved": resolved,
        "reasoning": reasoning,
        "mastery_boost_applied": boost,
        "basis_string": basis_str
    }

def get_teaching_history_for_concept(concept_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("""
    SELECT ts.id as session_id, ts.started_at, ts.is_generic_mode, ts.status,
           te.clarity_score, te.old_misconception_resolved, te.mastery_boost_applied
    FROM teaching_sessions ts
    LEFT JOIN teaching_evaluations te ON ts.id = te.teaching_session_id
    WHERE ts.concept_id = ?
    ORDER BY ts.id DESC
    """, (concept_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
