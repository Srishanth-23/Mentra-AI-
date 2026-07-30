from typing import Dict, Any, List
from models.db import get_db_connection

def calculate_concept_mastery(concept_id: int, external_conn=None) -> Dict[str, Any]:
    """
    Computes heuristic mastery score (0.0 to 1.0) and human-readable basis string for a concept.
    Formula combines quiz accuracy, stated confidence (1-5), recency, tutor doubt_count,
    and cross-document prior global mastery carry-forward.
    """
    conn = external_conn if external_conn else get_db_connection()
    cursor = conn.cursor()

    # Fetch quiz attempts for this concept
    attempts = cursor.execute(
        "SELECT is_correct, confidence_stated, timestamp FROM quiz_attempts WHERE concept_id = ? ORDER BY timestamp DESC",
        (concept_id,)
    ).fetchall()

    # Get doubt count from mastery_scores if exists
    existing_score = cursor.execute(
        "SELECT doubt_count FROM mastery_scores WHERE concept_id = ?",
        (concept_id,)
    ).fetchone()
    
    doubt_count = existing_score["doubt_count"] if (existing_score and "doubt_count" in existing_score.keys()) else 0

    # Doubt penalty (0.04 per tutor question up to max 0.20)
    doubt_penalty = min(0.20, doubt_count * 0.04)

    if not attempts:
        score = round(max(0.10, min(1.0, 0.50 - doubt_penalty)), 2)
        basis = "Estimated baseline (0 quiz attempts logged)"
        if doubt_count > 0:
            basis += f" and {doubt_count} tutor question{'s' if doubt_count > 1 else ''} asked about this topic"
    else:
        total_attempts = len(attempts)
        correct_count = sum(1 for a in attempts if a["is_correct"])
        raw_accuracy = (correct_count / total_attempts)

        conf_scores = [a["confidence_stated"] if a["confidence_stated"] is not None else 3 for a in attempts]
        avg_conf = sum(conf_scores) / len(conf_scores)
        conf_multiplier = avg_conf / 5.0

        raw_score = (raw_accuracy * 0.70) + (conf_multiplier * 0.30) - doubt_penalty
        score = round(max(0.10, min(1.0, raw_score)), 2)

        basis = (
            f"Estimated from {total_attempts} quiz answer{'s' if total_attempts > 1 else ''} "
            f"({int(raw_accuracy * 100)}% accuracy), average stated confidence {round(avg_conf, 1)}/5"
        )
        if doubt_count > 0:
            basis += f", and {doubt_count} tutor question{'s' if doubt_count > 1 else ''} asked about this topic"

    # Check for cross-document global concept memory link & carry forward prior mastery
    link = cursor.execute("""
    SELECT cl.global_concept_id, cl.similarity_score
    FROM concept_links cl
    WHERE cl.concept_id = ?
    """, (concept_id,)).fetchone()

    if link:
        global_id = link["global_concept_id"]
        prior_m = cursor.execute("""
        SELECT ms.score, d.filename
        FROM concept_links cl
        JOIN concepts c ON cl.concept_id = c.id
        JOIN documents d ON c.document_id = d.id
        JOIN mastery_scores ms ON c.id = ms.concept_id
        WHERE cl.global_concept_id = ? AND cl.concept_id != ?
        ORDER BY cl.linked_at DESC
        LIMIT 1
        """, (global_id, concept_id)).fetchone()

        if prior_m:
            prior_score = prior_m["score"]
            prior_doc_name = prior_m["filename"]
            # Carry forward prior mastery (weighted 70% current, 30% prior)
            score = round((score * 0.70) + (prior_score * 0.30), 2)
            basis += f", plus prior mastery of {int(prior_score * 100)}% shown when you studied this concept in {prior_doc_name}"

    basis += "."

    # Upsert into DB cleanly
    existing_rec = cursor.execute("SELECT id FROM mastery_scores WHERE concept_id = ?", (concept_id,)).fetchone()
    if existing_rec:
        cursor.execute("""
        UPDATE mastery_scores
        SET score = ?, basis = ?, last_updated = CURRENT_TIMESTAMP, doubt_count = ?
        WHERE concept_id = ?
        """, (score, basis, doubt_count, concept_id))
    else:
        cursor.execute("""
        INSERT INTO mastery_scores (concept_id, score, basis, last_updated, doubt_count)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
        """, (concept_id, score, basis, doubt_count))

    if not external_conn:
        conn.commit()
        conn.close()

    return {
        "concept_id": concept_id,
        "score": score,
        "basis": basis,
        "doubt_count": doubt_count
    }
