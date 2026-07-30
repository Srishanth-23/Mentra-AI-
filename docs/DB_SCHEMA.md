# DB Schema — Mentra

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY,
  filename TEXT,
  uploaded_at TIMESTAMP
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  text TEXT,
  page_num INTEGER,
  embedding_vector BLOB
);

CREATE TABLE concepts (
  id INTEGER PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id),
  name TEXT,
  summary TEXT,
  prerequisite_ids TEXT,          -- JSON array, LLM-suggested
  prerequisites_confirmed BOOLEAN DEFAULT FALSE
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY,
  concept_id INTEGER REFERENCES concepts(id),
  question_text TEXT,
  options TEXT,                   -- JSON array
  correct_answer TEXT,
  difficulty TEXT,                -- easy | medium | hard
  validated BOOLEAN DEFAULT FALSE -- passed quiz-validator LLM check
);

CREATE TABLE quiz_attempts (
  id INTEGER PRIMARY KEY,
  concept_id INTEGER REFERENCES concepts(id),
  question_id INTEGER REFERENCES questions(id),
  student_answer TEXT,
  is_correct BOOLEAN,
  confidence_stated INTEGER,      -- 1-5 self-reported
  response_time_ms INTEGER,
  timestamp TIMESTAMP
);

CREATE TABLE mastery_scores (
  id INTEGER PRIMARY KEY,
  concept_id INTEGER REFERENCES concepts(id),
  score REAL,
  basis TEXT,                     -- e.g. "heuristic: accuracy+confidence+recency"
  last_updated TIMESTAMP,
  doubt_count INTEGER DEFAULT 0
);

CREATE TABLE recovery_plans (
  id INTEGER PRIMARY KEY,
  concept_id INTEGER REFERENCES concepts(id),
  reason TEXT,
  source_chunk_ids TEXT,          -- JSON array
  suggested_order INTEGER
);

CREATE TABLE answers_log (
  id INTEGER PRIMARY KEY,
  question TEXT,
  answer_text TEXT,
  grounding_strength TEXT,        -- High | Medium | Low
  cited_chunk_ids TEXT,           -- JSON array
  timestamp TIMESTAMP
);
```

## Notes
- `prerequisite_ids` stays unconfirmed (LLM-suggested) until the student/teacher confirms via `/concepts/confirm` — only confirmed edges feed the recovery plan ranking.
- `mastery_scores.basis` is always populated with a human-readable string — never show a bare number in the UI without it.
- `embedding_vector` stored as BLOB for SQLite simplicity; swap to a proper vector column if moving to Postgres + pgvector later.
