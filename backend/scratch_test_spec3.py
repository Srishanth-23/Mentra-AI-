import os
from models.db import init_db, get_db_connection
from services.teaching_service import (
    start_teaching_session,
    generate_novice_response,
    evaluate_teaching_session,
    calculate_teaching_mastery_boost
)

def test_spec3_teaching_flow():
    print("--- STARTING EXTENSION SPEC 3 VERIFICATION TESTS ---")

    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Setup dummy document and concept
    cursor.execute("DELETE FROM teaching_evaluations WHERE teaching_session_id IN (SELECT id FROM teaching_sessions WHERE document_id = 8888);")
    cursor.execute("DELETE FROM teaching_messages WHERE teaching_session_id IN (SELECT id FROM teaching_sessions WHERE document_id = 8888);")
    cursor.execute("DELETE FROM teaching_sessions WHERE document_id = 8888;")
    cursor.execute("DELETE FROM personal_concept_edges WHERE document_id = 8888;")
    cursor.execute("DELETE FROM misconception_patterns WHERE document_id = 8888;")
    cursor.execute("DELETE FROM misconception_embeddings WHERE concept_id IN (88801, 88802);")
    cursor.execute("DELETE FROM concepts WHERE document_id = 8888;")
    cursor.execute("DELETE FROM documents WHERE id = 8888;")
    conn.commit()

    cursor.execute("INSERT INTO documents (id, filename) VALUES (8888, 'test_physics_adv.pdf');")
    cursor.execute("INSERT INTO concepts (id, document_id, name, summary, prerequisite_ids) VALUES (88801, 8888, 'Kinematics', 'Study of motion without forces.', '[]');")
    cursor.execute("INSERT INTO concepts (id, document_id, name, summary, prerequisite_ids) VALUES (88802, 8888, 'Work & Energy', 'Work transfers energy to systems.', '[88801]');")
    conn.commit()

    # 1. Test Generic Mode (No logged misconceptions exist)
    session1 = start_teaching_session(document_id=8888, concept_id=88802)
    print(f"Session 1 (Generic Mode): {session1['is_generic_mode']}")
    assert session1['is_generic_mode'] == True
    assert "Alex" in session1['opening_message']
    print("[SUCCESS] Generic Novice Mode initialization verified.")

    # 2. Test Turn Bounded Response Loop
    res1 = generate_novice_response(session1['session_id'], "Work equals force times displacement in direction of motion.")
    print(f"Novice response turn 1: {res1['novice_response']}")
    assert res1['turn_count'] == 1
    assert res1['conversation_ended'] == False
    print("[SUCCESS] Bounded dialogue turn counting verified.")

    # 3. Test Formula Boost Math (Explicit & Capped)
    boost1 = calculate_teaching_mastery_boost("High", [88801], 1, True)
    print(f"Calculated boost (High, 100% coverage, resolved): {boost1}")
    assert boost1 == 0.20  # 0.15 + 0.10 = 0.25 -> capped at 0.20

    boost2 = calculate_teaching_mastery_boost("Low", [], 1, False)
    print(f"Calculated boost (Unresolved): {boost2}")
    assert boost2 == 0.0

    print("[SUCCESS] Explicit Capped Mastery Boost Formula verified.")

    # 4. Test Evaluation Execution
    eval_res = evaluate_teaching_session(session1['session_id'])
    print(f"Evaluation result: {eval_res['clarity']}, Resolved: {eval_res['misconception_resolved']}")
    assert "mastery_boost_applied" in eval_res
    print("[SUCCESS] Session evaluation and mastery boost application verified.")

    # Clean up test rows
    cursor.execute("DELETE FROM teaching_evaluations WHERE teaching_session_id IN (SELECT id FROM teaching_sessions WHERE document_id = 8888);")
    cursor.execute("DELETE FROM teaching_messages WHERE teaching_session_id IN (SELECT id FROM teaching_sessions WHERE document_id = 8888);")
    cursor.execute("DELETE FROM teaching_sessions WHERE document_id = 8888;")
    cursor.execute("DELETE FROM personal_concept_edges WHERE document_id = 8888;")
    cursor.execute("DELETE FROM misconception_patterns WHERE document_id = 8888;")
    cursor.execute("DELETE FROM misconception_embeddings WHERE concept_id IN (88801, 88802);")
    cursor.execute("DELETE FROM concepts WHERE document_id = 8888;")
    cursor.execute("DELETE FROM documents WHERE id = 8888;")
    conn.commit()
    conn.close()

    print("--- ALL EXTENSION SPEC 3 TESTS PASSED SUCCESSFULLY ---")

if __name__ == "__main__":
    test_spec3_teaching_flow()
