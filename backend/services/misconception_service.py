import json
import math
import os
import google.generativeai as genai
from typing import List, Dict, Any, Optional
from models.db import get_db_connection
from services.embeddings import embed_texts
from dotenv import load_dotenv

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculates cosine similarity between two vector lists."""
    if not vec1 or not vec2 or len(vec1) != len(vec2):
        return 0.0
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = math.sqrt(sum(a * a for a in vec1))
    norm2 = math.sqrt(sum(b * b for b in vec2))
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)

def generate_pattern_description(misc1: str, misc2: str) -> str:
    """Uses LLM to describe shared reasoning error in 1 sentence."""
    load_dotenv(override=True)
    key = os.environ.get("GEMINI_API_KEY", "").strip()

    if not key:
        return "Both mistakes reflect a shared conceptual confusion in core mechanisms."

    try:
        from services.key_manager import call_gemini_with_key_rotation

        prompt = f"""
Two misconceptions were flagged as similar. Describe in ONE plain-language 
sentence what reasoning error they share, even though they may be about 
different topics. Be specific about the pattern, not generic.

Misconception 1: {misc1}
Misconception 2: {misc2}

Example output: "Both mistakes come from confusing 'necessary' conditions with 'sufficient' conditions."

Return only the one sentence, no preamble.
        """

        raw = call_gemini_with_key_rotation(prompt)
        return raw.strip().replace('"', '')
    except Exception as e:
        print(f"Misconception pattern LLM error: {e}")
        return "Both mistakes involve similar reasoning gaps in defining core functional requirements."

def trace_misconception_to_prerequisite(concept_id: int, misconception_text: str) -> Optional[Dict[str, Any]]:
    """
    Uses the existing concept dependency graph (canonical + personal).
    Runs a single classification call to check if misconception traces back to a prerequisite gap.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    concept = cursor.execute("SELECT id, name, summary, prerequisite_ids, document_id FROM concepts WHERE id = ?", (concept_id,)).fetchone()
    if not concept:
        conn.close()
        return None

    # Fetch canonical prerequisite IDs
    prereq_ids = []
    if concept["prerequisite_ids"]:
        try:
            prereq_ids = json.loads(concept["prerequisite_ids"])
        except Exception:
            prereq_ids = []

    # Fetch personal added/strengthened edges for this concept
    personal_edges = cursor.execute("""
    SELECT from_concept_id FROM personal_concept_edges
    WHERE to_concept_id = ? AND edge_type IN ('strengthened', 'added')
    """, (concept_id,)).fetchall()

    for pe in personal_edges:
        if pe["from_concept_id"] not in prereq_ids:
            prereq_ids.append(pe["from_concept_id"])

    if not prereq_ids:
        conn.close()
        return None  # Foundational concept, nothing to trace to

    # Fetch candidate prerequisite names + summaries
    placeholders = ",".join(["?"] * len(prereq_ids))
    candidates_db = cursor.execute(
        f"SELECT id, name, summary FROM concepts WHERE id IN ({placeholders})",
        prereq_ids
    ).fetchall()
    conn.close()

    if not candidates_db:
        return None

    cand_list_str = "\n".join([f"- ID {c['id']}: {c['name']} (Summary: {c['summary'] or 'N/A'})" for c in candidates_db])

    prompt = f"""
A student made this mistake while learning "{concept['name']}":
{misconception_text}

Here are the prerequisite concepts for "{concept['name']}", each with a summary:
{cand_list_str}

Does this mistake most likely stem from a gap in understanding one of these specific prerequisites? If yes, name which one and explain briefly why. If the mistake doesn't clearly trace back to any of them, say so explicitly — do not force a match.

Return JSON strictly in this format:
{{
  "prerequisite_id": <id number or null>,
  "confidence": "High" | "Medium" | "Low",
  "reasoning": "<one sentence explanation>"
}}
"""

    try:
        from services.key_manager import call_gemini_with_key_rotation
        raw_res = call_gemini_with_key_rotation(prompt)
        clean_json = raw_res.strip().strip("```json").strip("```").strip()
        data = json.loads(clean_json)
        return {
            "prerequisite_id": data.get("prerequisite_id"),
            "confidence": data.get("confidence", "Medium"),
            "reasoning": data.get("reasoning", "")
        }
    except Exception as e:
        print(f"Error tracing misconception to prerequisite: {e}")
        return None

def process_misconception_fingerprint(quiz_attempt_id: int, concept_id: int, misconception_text: str, document_id: int) -> Optional[Dict[str, Any]]:
    """
    Embeds misconception text, compares against prior misconceptions for document,
    and detects recurring reasoning patterns if similarity >= 0.75.
    """
    if not misconception_text or not quiz_attempt_id:
        return None

    # 1. Embed misconception text
    embeddings = embed_texts([misconception_text], task_type="retrieval_document")
    if not embeddings or not embeddings[0]:
        return None
    
    new_vector = embeddings[0]

    conn = get_db_connection()
    cursor = conn.cursor()

    # 2. Save misconception embedding
    cursor.execute("""
    INSERT INTO misconception_embeddings (quiz_attempt_id, concept_id, misconception_text, embedding_vector)
    VALUES (?, ?, ?, ?)
    """, (quiz_attempt_id, concept_id, misconception_text, bytes(json.dumps(new_vector), "utf-8")))
    new_embedding_id = cursor.lastrowid

    # 3. Fetch prior misconception embeddings for this document
    prior_rows = cursor.execute("""
    SELECT me.id, me.quiz_attempt_id, me.concept_id, me.misconception_text, me.embedding_vector, c.name as concept_name
    FROM misconception_embeddings me
    JOIN concepts c ON me.concept_id = c.id
    WHERE c.document_id = ? AND me.id != ?
    ORDER BY me.id DESC
    """, (document_id, new_embedding_id)).fetchall()

    detected_pattern = None

    for prior in prior_rows:
        try:
            prior_vector = json.loads(prior["embedding_vector"].decode("utf-8"))
        except Exception:
            continue

        sim = cosine_similarity(new_vector, prior_vector)
        if sim >= 0.75:
            # 4. Generate pattern description
            desc = generate_pattern_description(misconception_text, prior["misconception_text"])
            
            # Format required honest phrasing
            pattern_text = f"Detected pattern (not a confirmed diagnosis): this looks similar to your mistake on {prior['concept_name']} — {desc} Worth double-checking, not necessarily the same issue."

            # 5. Trace prerequisite link if available
            traced_info = trace_misconception_to_prerequisite(concept_id, misconception_text)
            traced_prereq_id = traced_info.get("prerequisite_id") if traced_info else None
            trace_conf = traced_info.get("confidence") if (traced_info and traced_prereq_id) else None

            cursor.execute("""
            INSERT INTO misconception_patterns (
                document_id, misconception_embedding_id_1, misconception_embedding_id_2,
                similarity_score, pattern_description, traced_prerequisite_id, trace_confidence
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (document_id, prior["id"], new_embedding_id, round(sim, 2), pattern_text, traced_prereq_id, trace_conf))

            pattern_id = cursor.lastrowid

            # Trigger personal concept graph update if traced prerequisite is found
            if traced_prereq_id:
                try:
                    from services.personal_graph_service import update_personal_graph
                    update_personal_graph(document_id, concept_id, external_conn=conn)
                except Exception as e:
                    print(f"Error updating personal graph on traced misconception: {e}")

            traced_name = None
            if traced_prereq_id:
                pr_row = cursor.execute("SELECT name FROM concepts WHERE id = ?", (traced_prereq_id,)).fetchone()
                if pr_row:
                    traced_name = pr_row["name"]

            detected_pattern = {
                "id": pattern_id,
                "document_id": document_id,
                "similarity_score": round(sim, 2),
                "pattern_description": pattern_text,
                "concept_1": prior["concept_name"],
                "concept_2": cursor.execute("SELECT name FROM concepts WHERE id = ?", (concept_id,)).fetchone()["name"],
                "misconception_1": prior["misconception_text"],
                "misconception_2": misconception_text,
                "traced_prerequisite_id": traced_prereq_id,
                "traced_prerequisite_name": traced_name,
                "trace_confidence": trace_conf
            }
            break

    conn.commit()
    conn.close()

    return detected_pattern

def get_misconception_patterns_for_document(document_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()

    rows = cursor.execute("""
    SELECT mp.id, mp.document_id, mp.similarity_score, mp.pattern_description, mp.detected_at,
           mp.traced_prerequisite_id, mp.trace_confidence,
           me1.misconception_text as misc1, c1.name as concept1,
           me2.misconception_text as misc2, c2.name as concept2,
           tc.name as traced_prerequisite_name
    FROM misconception_patterns mp
    JOIN misconception_embeddings me1 ON mp.misconception_embedding_id_1 = me1.id
    JOIN concepts c1 ON me1.concept_id = c1.id
    JOIN misconception_embeddings me2 ON mp.misconception_embedding_id_2 = me2.id
    JOIN concepts c2 ON me2.concept_id = c2.id
    LEFT JOIN concepts tc ON mp.traced_prerequisite_id = tc.id
    WHERE mp.document_id = ?
    ORDER BY mp.id DESC
    """, (document_id,)).fetchall()

    conn.close()

    return [
        {
            "id": r["id"],
            "document_id": r["document_id"],
            "similarity_score": r["similarity_score"],
            "pattern_description": r["pattern_description"],
            "detected_at": r["detected_at"],
            "concept_1": r["concept1"],
            "concept_2": r["concept2"],
            "misconception_1": r["misc1"],
            "misconception_2": r["misc2"],
            "traced_prerequisite_id": r["traced_prerequisite_id"],
            "traced_prerequisite_name": r["traced_prerequisite_name"],
            "trace_confidence": r["trace_confidence"]
        }
        for r in rows
    ]
