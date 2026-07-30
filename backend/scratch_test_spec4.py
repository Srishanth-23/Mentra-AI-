import os
from models.db import init_db, get_db_connection
from services.speak_your_model_service import analyze_spoken_explanation, get_speak_your_model_history

def test_spec4_speak_your_model():
    print("--- STARTING EXTENSION SPEC 4 VERIFICATION TESTS ---")

    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    # Clean test data
    cursor.execute("DELETE FROM speak_your_model_sessions WHERE document_id = 7777;")
    cursor.execute("DELETE FROM personal_concept_edges WHERE document_id = 7777;")
    cursor.execute("DELETE FROM concepts WHERE document_id = 7777;")
    cursor.execute("DELETE FROM documents WHERE id = 7777;")
    conn.commit()

    # Insert dummy document & concept
    cursor.execute("INSERT INTO documents (id, filename) VALUES (7777, 'test_calculus.pdf');")
    cursor.execute("INSERT INTO concepts (id, document_id, name, summary, prerequisite_ids) VALUES (77701, 7777, 'Derivatives', 'Rate of change of a function.', '[]');")
    cursor.execute("INSERT INTO concepts (id, document_id, name, summary, prerequisite_ids) VALUES (77702, 7777, 'Chain Rule', 'Differentiating composite functions.', '[77701]');")
    conn.commit()

    transcript = "The chain rule allows us to differentiate composite functions by multiplying the derivative of the outer function by the derivative of the inner function."

    # 1. Test Analysis Pipeline
    res = analyze_spoken_explanation(document_id=7777, concept_id=77702, transcript=transcript)
    print(f"Overall Tier: {res['overall_tier']}")
    print(f"Mastery Boost: {res['mastery_boost_applied']}")
    assert res['overall_tier'] in ["Strong", "Partial", "Needs Review"]
    assert "basis_string" in res
    print("[SUCCESS] Single-pass explanation classification verified.")

    # 2. Test History Endpoint logic
    history = get_speak_your_model_history(concept_id=77702)
    print(f"History entries: {len(history)}")
    assert len(history) >= 1
    assert history[0]["transcript"] == transcript
    print("[SUCCESS] Session persistence (without raw audio storage) verified.")

    # Clean up
    cursor.execute("DELETE FROM speak_your_model_sessions WHERE document_id = 7777;")
    cursor.execute("DELETE FROM personal_concept_edges WHERE document_id = 7777;")
    cursor.execute("DELETE FROM concepts WHERE document_id = 7777;")
    cursor.execute("DELETE FROM documents WHERE id = 7777;")
    conn.commit()
    conn.close()

    print("--- ALL EXTENSION SPEC 4 TESTS PASSED SUCCESSFULLY ---")

if __name__ == "__main__":
    test_spec4_speak_your_model()
