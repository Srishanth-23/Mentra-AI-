import json
from typing import List, Dict, Any, Optional
from models.db import get_db_connection
from services.embeddings import embed_texts
from services.misconception_service import cosine_similarity

def link_concepts_to_global_memory(document_id: int, saved_concepts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Compares newly extracted concepts against global_concepts from prior uploads.
    Links concepts if similarity >= 0.80, or creates a new global_concept identity.
    """
    if not saved_concepts:
        return []

    conn = get_db_connection()
    cursor = conn.cursor()

    # Fetch all existing global_concepts across all prior documents
    global_rows = cursor.execute("SELECT id, canonical_name, embedding_vector FROM global_concepts").fetchall()

    existing_globals = []
    for g in global_rows:
        try:
            vec = json.loads(g["embedding_vector"].decode("utf-8"))
            existing_globals.append({
                "id": g["id"],
                "canonical_name": g["canonical_name"],
                "vector": vec
            })
        except Exception:
            continue

    linked_results = []

    for c in saved_concepts:
        concept_id = c["id"]
        c_summary = c.get("summary") or c.get("name", "Core Concept")

        # Embed concept summary text
        embs = embed_texts([c_summary], task_type="retrieval_document")
        if not embs or not embs[0]:
            continue
        
        c_vec = embs[0]

        best_match = None
        best_similarity = 0.0

        for g in existing_globals:
            sim = cosine_similarity(c_vec, g["vector"])
            if sim > best_similarity:
                best_similarity = sim
                best_match = g

        if best_match and best_similarity >= 0.80:
            # Link to existing global concept
            global_id = best_match["id"]
            cursor.execute("""
            INSERT INTO concept_links (concept_id, global_concept_id, similarity_score)
            VALUES (?, ?, ?)
            """, (concept_id, global_id, round(best_similarity, 2)))

            linked_results.append({
                "concept_id": concept_id,
                "global_concept_id": global_id,
                "canonical_name": best_match["canonical_name"],
                "similarity_score": round(best_similarity, 2),
                "is_new_global": False
            })
        else:
            # Create new global concept identity
            canonical_name = c.get("name", "Core Concept")
            cursor.execute("""
            INSERT INTO global_concepts (canonical_name, embedding_vector)
            VALUES (?, ?)
            """, (canonical_name, bytes(json.dumps(c_vec), "utf-8")))
            new_global_id = cursor.lastrowid

            cursor.execute("""
            INSERT INTO concept_links (concept_id, global_concept_id, similarity_score)
            VALUES (?, ?, ?)
            """, (concept_id, new_global_id, 1.0))

            # Add to local existing_globals list for subsequent concepts in same document
            existing_globals.append({
                "id": new_global_id,
                "canonical_name": canonical_name,
                "vector": c_vec
            })

            linked_results.append({
                "concept_id": concept_id,
                "global_concept_id": new_global_id,
                "canonical_name": canonical_name,
                "similarity_score": 1.0,
                "is_new_global": True
            })

    conn.commit()
    conn.close()

    return linked_results

def get_concept_global_history(concept_id: int) -> Dict[str, Any]:
    """Retrieves prior document links and mastery history for a concept."""
    conn = get_db_connection()
    cursor = conn.cursor()

    link = cursor.execute("""
    SELECT cl.global_concept_id, cl.similarity_score, gc.canonical_name
    FROM concept_links cl
    JOIN global_concepts gc ON cl.global_concept_id = gc.id
    WHERE cl.concept_id = ?
    """, (concept_id,)).fetchone()

    if not link:
        conn.close()
        return {"concept_id": concept_id, "has_history": False, "linked_documents": []}

    global_id = link["global_concept_id"]

    # Fetch all other document concepts linked to this global concept
    prior_links = cursor.execute("""
    SELECT cl.concept_id, cl.linked_at, c.name, d.id as doc_id, d.filename, ms.score as mastery_score
    FROM concept_links cl
    JOIN concepts c ON cl.concept_id = c.id
    JOIN documents d ON c.document_id = d.id
    LEFT JOIN mastery_scores ms ON c.id = ms.concept_id
    WHERE cl.global_concept_id = ? AND cl.concept_id != ?
    ORDER BY cl.linked_at DESC
    """, (global_id, concept_id)).fetchall()

    conn.close()

    linked_docs = [
        {
            "concept_id": r["concept_id"],
            "document_id": r["doc_id"],
            "filename": r["filename"],
            "concept_name": r["name"],
            "mastery_score": round(r["mastery_score"] * 100) if r["mastery_score"] is not None else 50,
            "linked_at": r["linked_at"]
        }
        for r in prior_links
    ]

    return {
        "concept_id": concept_id,
        "global_concept_id": global_id,
        "canonical_name": link["canonical_name"],
        "has_history": len(linked_docs) > 0,
        "linked_documents": linked_docs
    }
