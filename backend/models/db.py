import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "mentra.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH, timeout=60.0, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=60000;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    conn.execute("PRAGMA journal_mode=WAL;")
    cursor = conn.cursor()
    
    cursor.executescript("""
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      preferred_language TEXT DEFAULT 'en',
      simplify_mode BOOLEAN DEFAULT 0,
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      page_num INTEGER NOT NULL,
      embedding_vector BLOB
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      summary TEXT,
      prerequisite_ids TEXT,               -- JSON array string, LLM-suggested
      prerequisites_confirmed BOOLEAN DEFAULT 0,
      exam_frequency INTEGER DEFAULT 0     -- count of exam-date tags found near concept
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      options TEXT NOT NULL,               -- JSON array string
      correct_answer TEXT NOT NULL,
      difficulty TEXT DEFAULT 'medium',    -- easy | medium | hard
      validated BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
      student_answer TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL,
      confidence_stated INTEGER,          -- 1-5 self-reported
      response_time_ms INTEGER,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mastery_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept_id INTEGER UNIQUE REFERENCES concepts(id) ON DELETE CASCADE,
      score REAL NOT NULL,
      basis TEXT NOT NULL,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      doubt_count INTEGER DEFAULT 0       -- incremented every time student asks Tutor about concept
    );

    CREATE TABLE IF NOT EXISTS recovery_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      source_chunk_ids TEXT,              -- JSON array string,
      suggested_order INTEGER,
      impact_score REAL
    );

    CREATE TABLE IF NOT EXISTS answers_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      grounding_strength TEXT NOT NULL,    -- High | Medium | Low
      cited_chunk_ids TEXT,               -- JSON array string
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Extension Spec Tables: Misconception Fingerprinting
    CREATE TABLE IF NOT EXISTS misconception_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_attempt_id INTEGER REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      misconception_text TEXT NOT NULL,
      embedding_vector BLOB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS misconception_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      misconception_embedding_id_1 INTEGER REFERENCES misconception_embeddings(id),
      misconception_embedding_id_2 INTEGER REFERENCES misconception_embeddings(id),
      similarity_score REAL NOT NULL,
      pattern_description TEXT NOT NULL,
      detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Extension Spec Tables: Cross-Document Concept Memory
    CREATE TABLE IF NOT EXISTS global_concepts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      canonical_name TEXT NOT NULL,
      embedding_vector BLOB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS concept_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      global_concept_id INTEGER REFERENCES global_concepts(id) ON DELETE CASCADE,
      similarity_score REAL NOT NULL,
      linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Extension Spec 2: Personal Concept Graph & Prerequisite Tracing
    CREATE TABLE IF NOT EXISTS personal_concept_edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      from_concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      to_concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      edge_type TEXT NOT NULL,             -- 'strengthened' | 'weakened' | 'added' | 'removed'
      reason TEXT NOT NULL,                -- plain-language explanation
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Extension Spec 3: Teach the Novice (Teachable Agent Mode)
    CREATE TABLE IF NOT EXISTS teaching_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      source_misconception_pattern_id INTEGER REFERENCES misconception_patterns(id),
      is_generic_mode BOOLEAN DEFAULT 0,
      status TEXT DEFAULT 'in_progress',   -- 'in_progress' | 'completed' | 'abandoned'
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teaching_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teaching_session_id INTEGER REFERENCES teaching_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,                  -- 'novice' | 'student'
      message_text TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teaching_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teaching_session_id INTEGER REFERENCES teaching_sessions(id) ON DELETE CASCADE,
      clarity_score TEXT NOT NULL,          -- 'High' | 'Medium' | 'Low'
      prerequisite_coverage TEXT NOT NULL,
      old_misconception_resolved BOOLEAN NOT NULL,
      evaluation_reasoning TEXT NOT NULL,
      mastery_boost_applied REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Extension Spec 4: Speak Your Model (Voice-Driven Calibration)
    CREATE TABLE IF NOT EXISTS speak_your_model_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
      concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
      transcript TEXT NOT NULL,
      analysis_result TEXT NOT NULL,        -- JSON string of analysis findings
      personal_edges_updated TEXT,          -- JSON array of edge IDs affected
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_mastery_scores_concept_id ON mastery_scores(concept_id);
    """)
    
    # Check and perform lightweight column migrations if DB already exists
    table_info_concepts = [row['name'] for row in cursor.execute("PRAGMA table_info(concepts);").fetchall()]
    if 'exam_frequency' not in table_info_concepts:
        cursor.execute("ALTER TABLE concepts ADD COLUMN exam_frequency INTEGER DEFAULT 0;")

    table_info_mastery = [row['name'] for row in cursor.execute("PRAGMA table_info(mastery_scores);").fetchall()]
    if 'doubt_count' not in table_info_mastery:
        cursor.execute("ALTER TABLE mastery_scores ADD COLUMN doubt_count INTEGER DEFAULT 0;")

    table_info_recovery = [row['name'] for row in cursor.execute("PRAGMA table_info(recovery_plans);").fetchall()]
    if 'impact_score' not in table_info_recovery:
        cursor.execute("ALTER TABLE recovery_plans ADD COLUMN impact_score REAL DEFAULT 0;")

    table_info_answers = [row['name'] for row in cursor.execute("PRAGMA table_info(answers_log);").fetchall()]
    if 'concept_id' not in table_info_answers:
        cursor.execute("ALTER TABLE answers_log ADD COLUMN concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE;")

    table_info_misc_pat = [row['name'] for row in cursor.execute("PRAGMA table_info(misconception_patterns);").fetchall()]
    if 'traced_prerequisite_id' not in table_info_misc_pat:
        cursor.execute("ALTER TABLE misconception_patterns ADD COLUMN traced_prerequisite_id INTEGER REFERENCES concepts(id);")
    if 'trace_confidence' not in table_info_misc_pat:
        cursor.execute("ALTER TABLE misconception_patterns ADD COLUMN trace_confidence TEXT;")
    if 'taught_through' not in table_info_misc_pat:
        cursor.execute("ALTER TABLE misconception_patterns ADD COLUMN taught_through BOOLEAN DEFAULT 0;")
    if 'taught_through_session_id' not in table_info_misc_pat:
        cursor.execute("ALTER TABLE misconception_patterns ADD COLUMN taught_through_session_id INTEGER REFERENCES teaching_sessions(id);")

    table_info_docs = [row['name'] for row in cursor.execute("PRAGMA table_info(documents);").fetchall()]
    if 'preferred_language' not in table_info_docs:
        cursor.execute("ALTER TABLE documents ADD COLUMN preferred_language TEXT DEFAULT 'en';")
    if 'simplify_mode' not in table_info_docs:
        cursor.execute("ALTER TABLE documents ADD COLUMN simplify_mode BOOLEAN DEFAULT 0;")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database schema verified and initialized.")
