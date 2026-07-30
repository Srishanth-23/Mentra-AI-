import json
from typing import Dict, Any, List, Optional
from models.db import get_db_connection

def upsert_personal_edge(
    document_id: int,
    from_concept_id: int,
    to_concept_id: int,
    edge_type: str,
    reason: str,
    external_conn=None
):
    """
    Inserts or updates a student-specific personal edge delta.
    edge_type: 'strengthened' | 'weakened' | 'added' | 'removed'
    """
    conn = external_conn if external_conn else get_db_connection()
    cursor = conn.cursor()

    existing = cursor.execute("""
    SELECT id FROM personal_concept_edges
    WHERE document_id = ? AND from_concept_id = ? AND to_concept_id = ?
    """, (document_id, from_concept_id, to_concept_id)).fetchone()

    if existing:
        cursor.execute("""
        UPDATE personal_concept_edges
        SET edge_type = ?, reason = ?, created_at = CURRENT_TIMESTAMP
        WHERE id = ?
        """, (edge_type, reason, existing["id"]))
    else:
        cursor.execute("""
        INSERT INTO personal_concept_edges (document_id, from_concept_id, to_concept_id, edge_type, reason)
        VALUES (?, ?, ?, ?, ?)
        """, (document_id, from_concept_id, to_concept_id, edge_type, reason))

    if not external_conn:
        conn.commit()
        conn.close()

def update_personal_graph(document_id: int, concept_id: int, external_conn=None):
    """
    Evaluates personal graph delta rules for a concept using only logged signals.
    No forecasting or fabricated numbers.
    """
    conn = external_conn if external_conn else get_db_connection()
    cursor = conn.cursor()

    concept = cursor.execute(
        "SELECT id, prerequisite_ids, prerequisites_confirmed FROM concepts WHERE id = ?",
        (concept_id,)
    ).fetchone()

    if not concept:
        if not external_conn:
            conn.close()
        return

    p_ids = []
    if concept["prerequisite_ids"]:
        try:
            p_ids = json.loads(concept["prerequisite_ids"])
        except Exception:
            p_ids = []

    # Rule 1: student confirmed a prerequisite -> strengthen
    if concept["prerequisites_confirmed"]:
        for prereq_id in p_ids:
            prereq = cursor.execute("SELECT name FROM concepts WHERE id = ?", (prereq_id,)).fetchone()
            prereq_name = prereq["name"] if prereq else "prerequisite"
            upsert_personal_edge(
                document_id=document_id,
                from_concept_id=prereq_id,
                to_concept_id=concept_id,
                edge_type="strengthened",
                reason=f"You confirmed the prerequisite connection to {prereq_name}.",
                external_conn=conn
            )

    # Rule 3: repeated misconceptions trace back to a specific prerequisite (>= 2 occurrences)
    traced_rows = cursor.execute("""
    SELECT traced_prerequisite_id, COUNT(*) as cnt
    FROM misconception_patterns mp
    JOIN misconception_embeddings me ON mp.misconception_embedding_id_1 = me.id
    WHERE me.concept_id = ? AND mp.traced_prerequisite_id IS NOT NULL
    GROUP BY mp.traced_prerequisite_id
    HAVING cnt >= 2
    """, (concept_id,)).fetchall()

    for row in traced_rows:
        prereq_id = row["traced_prerequisite_id"]
        count = row["cnt"]
        prereq = cursor.execute("SELECT name FROM concepts WHERE id = ?", (prereq_id,)).fetchone()
        prereq_name = prereq["name"] if prereq else "this prerequisite"
        upsert_personal_edge(
            document_id=document_id,
            from_concept_id=prereq_id,
            to_concept_id=concept_id,
            edge_type="added",
            reason=f"Added because {count} of your logged mistakes on this concept traced back to {prereq_name}.",
            external_conn=conn
        )

    # Rule 4: consistently high mastery (>= 0.85) + 0 misconceptions -> weaken edge
    mastery_row = cursor.execute(
        "SELECT score FROM mastery_scores WHERE concept_id = ?",
        (concept_id,)
    ).fetchone()
    mastery_score = mastery_row["score"] if mastery_row else 0.50

    misc_count_row = cursor.execute("""
    SELECT COUNT(*) as cnt FROM misconception_embeddings WHERE concept_id = ?
    """, (concept_id,)).fetchone()
    misc_count = misc_count_row["cnt"] if misc_count_row else 0

    if mastery_score >= 0.85 and misc_count == 0 and p_ids:
        for prereq_id in p_ids:
            upsert_personal_edge(
                document_id=document_id,
                from_concept_id=prereq_id,
                to_concept_id=concept_id,
                edge_type="weakened",
                reason="You've shown strong mastery here without needing this prerequisite reinforced.",
                external_conn=conn
            )

    if not external_conn:
        conn.commit()
        conn.close()

def get_personal_graph(document_id: int) -> Dict[str, Any]:
    """
    Returns canonical concepts + layered personal edges.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    concepts = cursor.execute(
        "SELECT id, name, summary, prerequisite_ids, prerequisites_confirmed, exam_frequency FROM concepts WHERE document_id = ?",
        (document_id,)
    ).fetchall()

    nodes = [dict(c) for c in concepts]

    # Fetch canonical edges
    canonical_edges = []
    for c in concepts:
        p_ids = []
        if c["prerequisite_ids"]:
            try:
                p_ids = json.loads(c["prerequisite_ids"])
            except Exception:
                p_ids = []
        for p_id in p_ids:
            canonical_edges.append({
                "from_concept_id": p_id,
                "to_concept_id": c["id"],
                "confirmed": bool(c["prerequisites_confirmed"])
            })

    # Fetch personal edge deltas
    p_edges_db = cursor.execute("""
    SELECT from_concept_id, to_concept_id, edge_type, reason, created_at
    FROM personal_concept_edges
    WHERE document_id = ?
    """, (document_id,)).fetchall()

    personal_edges = [dict(pe) for pe in p_edges_db]

    conn.close()

    return {
        "document_id": document_id,
        "nodes": nodes,
        "canonical_edges": canonical_edges,
        "personal_edges": personal_edges
    }

def get_graph_drift_summary(document_id: int) -> Dict[str, Any]:
    """
    Computes count-based drift summary and plain-language sentence.
    No score out of 100, no unvalidated forecast.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    edges = cursor.execute("""
    SELECT edge_type FROM personal_concept_edges WHERE document_id = ?
    """, (document_id,)).fetchall()

    conn.close()

    strengthened_count = len([e for e in edges if e["edge_type"] == "strengthened"])
    weakened_count = len([e for e in edges if e["edge_type"] == "weakened"])
    added_count = len([e for e in edges if e["edge_type"] == "added"])
    removed_count = len([e for e in edges if e["edge_type"] == "removed"])

    total_drift_points = strengthened_count + weakened_count + added_count + removed_count

    if total_drift_points == 0:
        summary_sentence = "Your personal understanding map currently matches the canonical structure extracted from your document."
    else:
        parts = []
        if added_count > 0:
            parts.append(f"added {added_count} prerequisite link{'s' if added_count > 1 else ''} based on your mistakes")
        if strengthened_count > 0:
            parts.append(f"strengthened {strengthened_count} link{'s' if strengthened_count > 1 else ''} by confirming them directly")
        if weakened_count > 0:
            parts.append(f"weakened {weakened_count} link{'s' if weakened_count > 1 else ''} due to high demonstrated mastery")
        if removed_count > 0:
            parts.append(f"removed {removed_count} link{'s' if removed_count > 1 else ''}")

        summary_sentence = f"Your personal understanding map differs from the document's structure in {total_drift_points} place{'s' if total_drift_points > 1 else ''}: you've " + ", and ".join(parts) + "."

    return {
        "document_id": document_id,
        "drift_counts": {
            "strengthened_count": strengthened_count,
            "weakened_count": weakened_count,
            "added_count": added_count,
            "removed_count": removed_count,
            "total_differences": total_drift_points
        },
        "summary_sentence": summary_sentence
    }
