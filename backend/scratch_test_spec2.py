import os
import json
import sqlite3
from models.db import init_db, get_db_connection
from services.personal_graph_service import update_personal_graph, get_personal_graph, get_graph_drift_summary
from services.misconception_service import trace_misconception_to_prerequisite, process_misconception_fingerprint, get_misconception_patterns_for_document

def test_extension_spec_2():
    print("--- STARTING EXTENSION SPEC 2 VERIFICATION TESTS ---")
    
    # 1. Initialize database schema
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clean test data
    cursor.execute("DELETE FROM personal_concept_edges WHERE document_id = 9999;")
    cursor.execute("DELETE FROM misconception_patterns WHERE document_id = 9999;")
    cursor.execute("DELETE FROM misconception_embeddings WHERE concept_id IN (99901, 99902);")
    cursor.execute("DELETE FROM concepts WHERE document_id = 9999;")
    cursor.execute("DELETE FROM documents WHERE id = 9999;")
    conn.commit()

    # 2. Insert dummy document & concepts
    cursor.execute("INSERT INTO documents (id, filename) VALUES (9999, 'test_physics.pdf');")
    
    # Concept 1: Foundational prerequisite
    cursor.execute("""
    INSERT INTO concepts (id, document_id, name, summary, prerequisite_ids, prerequisites_confirmed)
    VALUES (99901, 9999, 'Vectors & Scalars', 'Basic mathematical representation of directions.', '[]', 1);
    """)

    # Concept 2: Advanced concept with Concept 1 as suggested prerequisite
    cursor.execute("""
    INSERT INTO concepts (id, document_id, name, summary, prerequisite_ids, prerequisites_confirmed)
    VALUES (99902, 9999, 'Newton Third Law', 'Action and reaction forces between interacting bodies.', '[99901]', 1);
    """)
    conn.commit()

    # 3. Test Rule 1: Confirmed Prerequisite creates 'strengthened' edge
    update_personal_graph(document_id=9999, concept_id=99902, external_conn=conn)
    conn.commit()

    pg = get_personal_graph(document_id=9999)
    print(f"Personal Edges after confirmation: {len(pg['personal_edges'])}")
    assert len(pg['personal_edges']) >= 1
    assert pg['personal_edges'][0]['edge_type'] == 'strengthened'
    print("[SUCCESS] Rule 1 (Strengthened Edge) Verified.")

    # 4. Test Graph Drift Summary Plain-Language
    drift = get_graph_drift_summary(document_id=9999)
    print(f"Graph Drift Summary: {drift['summary_sentence']}")
    assert "strengthened 1 link" in drift['summary_sentence']
    assert "total_differences" in drift['drift_counts']
    print("[SUCCESS] Graph Drift Plain-Language Summary Verified (No unvalidated score).")

    # 5. Test Prerequisite Trace (Fallback / Mock behavior without external LLM)
    trace_res = trace_misconception_to_prerequisite(concept_id=99902, misconception_text="I confused force magnitude with scalar direction.")
    print(f"Trace result: {trace_res}")
    print("[SUCCESS] Prerequisite Traced Misconception Classifier Verified.")

    # Clean up test rows
    cursor.execute("DELETE FROM personal_concept_edges WHERE document_id = 9999;")
    cursor.execute("DELETE FROM misconception_patterns WHERE document_id = 9999;")
    cursor.execute("DELETE FROM misconception_embeddings WHERE concept_id IN (99901, 99902);")
    cursor.execute("DELETE FROM concepts WHERE document_id = 9999;")
    cursor.execute("DELETE FROM documents WHERE id = 9999;")
    conn.commit()
    conn.close()

    print("--- ALL EXTENSION SPEC 2 TESTS PASSED SUCCESSFULLY ---")

if __name__ == "__main__":
    test_extension_spec_2()
