import json
from typing import List, Dict, Any
from models.db import get_db_connection

def generate_recovery_plan(document_id: int, external_conn=None) -> List[Dict[str, Any]]:
    conn = external_conn if external_conn else get_db_connection()
    cursor = conn.cursor()

    # Clear existing recovery plan rows for this document
    concepts = cursor.execute(
        "SELECT id, name, summary, prerequisite_ids, prerequisites_confirmed, exam_frequency FROM concepts WHERE document_id = ?",
        (document_id,)
    ).fetchall()

    if not concepts:
        if not external_conn:
            conn.close()
        return []

    concept_ids = [c["id"] for c in concepts]
    concept_dict = {c["id"]: dict(c) for c in concepts}
    concept_names = {c["id"]: c["name"] for c in concepts}

    # Clear existing recovery plan entries for these concepts
    placeholders = ",".join(["?"] * len(concept_ids))
    cursor.execute(f"DELETE FROM recovery_plans WHERE concept_id IN ({placeholders})", concept_ids)

    # Count CONFIRMED dependents only
    confirmed_dependents_count: Dict[int, int] = {c["id"]: 0 for c in concepts}
    prereqs: Dict[int, List[int]] = {}

    for c in concepts:
        p_ids = []
        if c["prerequisite_ids"]:
            try:
                p_ids = json.loads(c["prerequisite_ids"])
            except Exception:
                p_ids = []
        prereqs[c["id"]] = p_ids

        # If prerequisites are confirmed by user, increment confirmed dependents count
        if c["prerequisites_confirmed"]:
            for p_id in p_ids:
                if p_id in confirmed_dependents_count:
                    confirmed_dependents_count[p_id] += 1

    # Fetch mastery scores & basis strings
    mastery: Dict[int, float] = {}
    basis_map: Dict[int, str] = {}

    for c in concepts:
        m = cursor.execute(
            "SELECT score, basis FROM mastery_scores WHERE concept_id = ?",
            (c["id"],)
        ).fetchone()
        if m:
            mastery[c["id"]] = m["score"]
            basis_map[c["id"]] = m["basis"]
        else:
            mastery[c["id"]] = 0.50
            basis_map[c["id"]] = "Estimated baseline (0 attempts logged)"

    # Formula: Impact = (1 - Mastery) * (1 + ConfirmedDependents) * (1 + ExamFrequency)
    ranked_concepts = []
    for c_id, c in concept_dict.items():
        score = mastery[c_id]
        exam_freq = c.get("exam_frequency", 0) or 0
        conf_deps = confirmed_dependents_count.get(c_id, 0)

        impact = (1.0 - score) * (1 + conf_deps) * (1 + exam_freq)

        if score < 0.85:  # Only suggest remediation for concepts under 85% mastery
            ranked_concepts.append({
                "concept_id": c_id,
                "name": c["name"],
                "mastery_score": score,
                "exam_frequency": exam_freq,
                "confirmed_dependents": conf_deps,
                "basis": basis_map.get(c_id, ""),
                "prereq_names": [concept_names[p] for p in prereqs.get(c_id, []) if p in concept_names],
                "impact": impact
            })

    ranked_concepts.sort(key=lambda x: x["impact"], reverse=True)

    plan_output = []
    for idx, item in enumerate(ranked_concepts[:5]):
        c_id = item["concept_id"]
        c_name = item["name"]
        m_score = item["mastery_score"]
        exam_freq = item["exam_frequency"]
        p_names = item["prereq_names"]

        # Plain-language reason string explicitly mentioning exam frequency if present
        if exam_freq > 0:
            exam_prefix = f"Asked in exams {exam_freq} time{'s' if exam_freq > 1 else ''} · "
        else:
            exam_prefix = ""

        if p_names:
            reason_str = f"{exam_prefix}{int(m_score * 100)}% mastery. Reviewing prerequisite concepts ({', '.join(p_names)}) will rebuild foundational understanding."
        else:
            reason_str = f"{exam_prefix}{int(m_score * 100)}% mastery. Direct review of core principles is recommended."

        # Fetch source chunks specifically relevant to this concept
        chunks = cursor.execute(
            "SELECT id FROM chunks WHERE document_id = ? AND text LIKE ? LIMIT 3",
            (document_id, f"%{c_name}%")
        ).fetchall()
        if not chunks:
            first_word = c_name.split()[0] if c_name else ""
            if len(first_word) > 3:
                chunks = cursor.execute(
                    "SELECT id FROM chunks WHERE document_id = ? AND text LIKE ? LIMIT 3",
                    (document_id, f"%{first_word}%")
                ).fetchall()
        if not chunks:
            chunks = cursor.execute(
                "SELECT id FROM chunks WHERE document_id = ? LIMIT 2",
                (document_id,)
            ).fetchall()
        chunk_ids = [ch["id"] for ch in chunks]

        plan_item = {
            "concept_id": c_id,
            "concept_name": c_name,
            "mastery_score": m_score,
            "reason": reason_str,
            "source_chunk_ids": chunk_ids,
            "suggested_order": idx + 1,
            "impact_score": round(item["impact"], 2)
        }
        plan_output.append(plan_item)

        # Save into recovery_plans DB table
        cursor.execute("""
        INSERT INTO recovery_plans (concept_id, reason, source_chunk_ids, suggested_order, impact_score)
        VALUES (?, ?, ?, ?, ?)
        """, (c_id, reason_str, json.dumps(chunk_ids), idx + 1, round(item["impact"], 2)))

    if not external_conn:
        conn.commit()
        conn.close()

    return plan_output

def update_recovery_plan(document_id: int, external_conn=None):
    return generate_recovery_plan(document_id, external_conn=external_conn)
