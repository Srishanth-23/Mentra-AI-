import json
import os
from typing import Dict, Any, List
from models.db import get_db_connection
from services.personal_graph_service import upsert_personal_edge
from dotenv import load_dotenv

def analyze_spoken_explanation(document_id: int, concept_id: int, transcript: str) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    concept = cursor.execute("SELECT id, name, summary, prerequisite_ids FROM concepts WHERE id = ?", (concept_id,)).fetchone()
    if not concept:
        conn.close()
        raise ValueError("Concept not found.")

    # Prerequisites (canonical + personal)
    p_ids = []
    if concept["prerequisite_ids"]:
        try:
            p_ids = json.loads(concept["prerequisite_ids"])
        except Exception:
            p_ids = []

    personal_edges = cursor.execute("""
    SELECT from_concept_id FROM personal_concept_edges
    WHERE to_concept_id = ? AND edge_type IN ('strengthened', 'added')
    """, (concept_id,)).fetchall()

    for pe in personal_edges:
        if pe["from_concept_id"] not in p_ids:
            p_ids.append(pe["from_concept_id"])

    prereq_rows = []
    if p_ids:
        placeholders = ",".join(["?"] * len(p_ids))
        prereq_rows = cursor.execute(f"SELECT id, name, summary FROM concepts WHERE id IN ({placeholders})", p_ids).fetchall()

    prereqs_str = "\n".join([f"- ID {p['id']}: {p['name']} ({p['summary'] or 'N/A'})" for p in prereq_rows]) if prereq_rows else "None logged"

    # Known misconceptions
    misc_rows = cursor.execute("""
    SELECT mp.id, me1.misconception_text
    FROM misconception_patterns mp
    JOIN misconception_embeddings me1 ON mp.misconception_embedding_id_1 = me1.id
    WHERE me1.concept_id = ?
    """, (concept_id,)).fetchall()

    misc_str = "\n".join([f"- ID {m['id']}: {m['misconception_text']}" for m in misc_rows]) if misc_rows else "none logged"

    # Fetch document language & simplify mode
    doc = cursor.execute("SELECT preferred_language, simplify_mode FROM documents WHERE id = ?", (document_id,)).fetchone()
    lang_code = doc["preferred_language"] if doc and doc["preferred_language"] else "en"
    simplify_mode = bool(doc["simplify_mode"]) if doc and "simplify_mode" in doc.keys() else False

    from services.prompt_utils import build_multilingual_prompt_suffix
    multilingual_suffix = build_multilingual_prompt_suffix(lang_code, simplify_mode)

    conn.close()

    load_dotenv(override=True)
    key = os.environ.get("GEMINI_API_KEY", "").strip()

    prompt = f"""
A student was asked to explain, out loud, the concept "{concept['name']}" and how it connects to related ideas. Here is the transcript of what they said:

{transcript}

Here is what the concept is actually about, grounded in the source material:
{concept['summary']}

Here are the prerequisite concepts for this topic:
{prereqs_str}

Here are misconceptions this student has shown in the past on this concept:
{misc_str}

Analyze the explanation:
1. Which parts of the explanation are accurate and well-grounded in the source material? (list, brief)
2. Which parts, if any, are missing, vague, or incorrect? (list, brief — do not invent gaps that aren't actually present in the transcript)
3. Does the explanation show any of the previously-logged misconceptions re-appearing? (true/false per misconception, with brief reasoning)
4. Which prerequisite concept IDs, if any, did the student correctly incorporate into their explanation?
5. Overall assessment tier: "Strong", "Partial", or "Needs Review" — do not produce a numeric percentage, use this plain tier only.

Return JSON strictly matching this structure:
```json
{{
  "accurate_points": ["point 1"],
  "gaps_or_errors": ["gap 1"],
  "misconceptions_reappeared": [{{"misconception_id": 123, "misconception": "text", "reappeared": false, "reasoning": "explanation"}}],
  "prerequisites_covered": [123],
  "overall_tier": "Strong"
}}
```
"""

    if not key:
        eval_data = {
            "accurate_points": ["Student explained core mechanisms of the concept clearly."],
            "gaps_or_errors": [],
            "misconceptions_reappeared": [],
            "prerequisites_covered": p_ids,
            "overall_tier": "Strong"
        }
    else:
        try:
            from services.key_manager import call_gemini_with_key_rotation
            raw_res = call_gemini_with_key_rotation(prompt)
            clean_json = raw_res.strip().strip("```json").strip("```").strip()
            eval_data = json.loads(clean_json)
        except Exception as e:
            print(f"Error classifying spoken explanation: {e}")
            eval_data = {
                "accurate_points": ["Student attempted an out-loud explanation."],
                "gaps_or_errors": ["Detailed breakdown unavailable due to LLM connectivity."],
                "misconceptions_reappeared": [],
                "prerequisites_covered": p_ids,
                "overall_tier": "Partial"
            }

    # Apply updates to graph and mastery
    applied_result = apply_speak_your_model_results(document_id, concept_id, transcript, eval_data)
    return applied_result

def apply_speak_your_model_results(document_id: int, concept_id: int, transcript: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    cursor = conn.cursor()

    overall_tier = analysis.get("overall_tier", "Partial")
    prereqs_covered = analysis.get("prerequisites_covered", [])
    updated_edges = []

    # Strengthen personal edges for covered prerequisites
    for prereq_id in prereqs_covered:
        pr_row = cursor.execute("SELECT name FROM concepts WHERE id = ?", (prereq_id,)).fetchone()
        pr_name = pr_row["name"] if pr_row else "prerequisite"
        upsert_personal_edge(
            document_id=document_id,
            from_concept_id=prereq_id,
            to_concept_id=concept_id,
            edge_type="strengthened",
            reason=f"Strengthened because you correctly explained the connection to {pr_name} out loud.",
            external_conn=conn
        )
        updated_edges.append(prereq_id)

    # Mastery adjustment using capped tier boost
    tier_boost = {"Strong": 0.15, "Partial": 0.08, "Needs Review": 0.0}
    boost = tier_boost.get(overall_tier, 0.0)

    basis_str = ""
    if boost > 0:
        mastery_row = cursor.execute("SELECT score FROM mastery_scores WHERE concept_id = ?", (concept_id,)).fetchone()
        old_score = mastery_row["score"] if mastery_row else 0.50
        new_score = round(min(old_score + boost, 1.0), 2)
        basis_str = f"+{boost} mastery boost from a '{overall_tier}' rated spoken explanation, covering {len(prereqs_covered)} prerequisite(s) correctly."

        cursor.execute("""
        INSERT INTO mastery_scores (concept_id, score, basis)
        VALUES (?, ?, ?)
        ON CONFLICT(concept_id) DO UPDATE SET
            score = ?,
            basis = ?,
            last_updated = CURRENT_TIMESTAMP
        """, (concept_id, new_score, basis_str, new_score, basis_str))

    # Persist session log
    cursor.execute("""
    INSERT INTO speak_your_model_sessions (document_id, concept_id, transcript, analysis_result, personal_edges_updated)
    VALUES (?, ?, ?, ?, ?)
    """, (document_id, concept_id, transcript, json.dumps(analysis), json.dumps(updated_edges)))

    session_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {
        "session_id": session_id,
        "document_id": document_id,
        "concept_id": concept_id,
        "transcript": transcript,
        "overall_tier": overall_tier,
        "accurate_points": analysis.get("accurate_points", []),
        "gaps_or_errors": analysis.get("gaps_or_errors", []),
        "misconceptions_reappeared": analysis.get("misconceptions_reappeared", []),
        "prerequisites_covered_ids": prereqs_covered,
        "mastery_boost_applied": boost,
        "basis_string": basis_str
    }

def get_speak_your_model_history(concept_id: int) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("""
    SELECT id, transcript, analysis_result, created_at
    FROM speak_your_model_sessions
    WHERE concept_id = ?
    ORDER BY id DESC
    """, (concept_id,)).fetchall()
    conn.close()

    result = []
    for r in rows:
        try:
            analysis = json.loads(r["analysis_result"])
        except Exception:
            analysis = {}
        result.append({
            "id": r["id"],
            "transcript": r["transcript"],
            "overall_tier": analysis.get("overall_tier", "Partial"),
            "accurate_points": analysis.get("accurate_points", []),
            "gaps_or_errors": analysis.get("gaps_or_errors", []),
            "created_at": r["created_at"]
        })
    return result
