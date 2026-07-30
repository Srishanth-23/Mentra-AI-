# MENTRA AI — TECHNICAL PRODUCT SPECIFICATION & BUILD DOCUMENTATION

This document defines the complete product architecture, design principles, database schema, algorithms, API contracts, and implementation details for **Mentra AI** — an evidence-grounded, adaptive learning copilot.

---

## 1. Product Identity & Core Philosophy

Mentra is an evidence-grounded academic copilot for university students. A student uploads course study material; Mentra extracts academic concepts, teaches with verified source citations, tests adaptively, tracks doubts and quiz failures, and generates an honest recovery plan.

### Core Design Principle: Honest Transparency
Every score, metric, or recommendation displayed in Mentra is paired with an adjacent, plain-language **basis string** explaining exactly how it was computed. 
Mentra **never** presents bare ungrounded numbers, fake neural health indexes, or predicted university grades.

---

## 2. Non-Negotiable Product Rules

### Banned Content & Hype Language
- **Banned Claims**: No "Predicted University Grade", "Est. Score: X%", "Memory Decay Window", or "Neural Knowledge Health".
- **Banned Branding Language**: No "Neural", "Cognitive Command Center", "AI Cognitive Competency Radar", "Real-time telemetry", "16-mark structured exam answer generator".
- **Required Basis Strings**: Every displayed mastery percentage or remediation item MUST have an adjacent plain-language basis string:
  ```
  [Score] — [Basis: "Estimated from N quiz answers (X% accuracy), average stated confidence Y/5, last practiced Z days ago, and D tutor questions asked about this topic."]
  ```

---

## 3. Technology Stack

- **Frontend**: React + TailwindCSS (built with Vite), responsive web app.
- **Backend**: FastAPI (Python async framework).
- **LLM**: Google Gemini API (`gemini-2.0-flash` with API key rotation manager).
- **Embeddings**: Gemini `text-embedding-004`.
- **Vector Search**: FAISS in-memory vector index manager per document.
- **Database**: SQLite (`mentra.db` with WAL journal mode).
- **Doc Parsing**: PyMuPDF (`fitz`).

---

## 4. Authoritative Database Schema

```sql
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  page_num INTEGER NOT NULL,
  embedding_vector BLOB
);

CREATE TABLE concepts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT,
  prerequisite_ids TEXT,               -- JSON array string of prerequisite concept IDs
  prerequisites_confirmed BOOLEAN DEFAULT 0,
  exam_frequency INTEGER DEFAULT 0     -- Count of exam date tags (e.g. Nov/Dec 2020) found near concept
);

CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options TEXT NOT NULL,               -- JSON array string
  correct_answer TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium',    -- easy | medium | hard
  validated BOOLEAN DEFAULT 0
);

CREATE TABLE quiz_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  student_answer TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  confidence_stated INTEGER,           -- Self-reported 1 to 5 confidence scale
  response_time_ms INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mastery_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id INTEGER UNIQUE REFERENCES concepts(id) ON DELETE CASCADE,
  score REAL NOT NULL,
  basis TEXT NOT NULL,                 -- Plain-language justification string
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  doubt_count INTEGER DEFAULT 0       -- Incremented each time student asks Tutor about concept
);

CREATE TABLE recovery_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  source_chunk_ids TEXT,              -- JSON array string of chunk IDs
  suggested_order INTEGER,
  impact_score REAL                   -- Calculated impact score
);

CREATE TABLE answers_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  concept_id INTEGER REFERENCES concepts(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer_text TEXT NOT NULL,
  grounding_strength TEXT NOT NULL,    -- High | Medium | Low
  cited_chunk_ids TEXT,               -- JSON array string
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 5. Concept Extraction & Exam Frequency Pipeline

1. **Header/Footer Repetition Filter (`chunking.py`)**:
   - Computes line frequencies across pages. Any line appearing on $\ge 60\%$ of pages with length $< 100$ characters is identified as boilerplate header/footer/logo and stripped.
2. **Administrative Metadata Pre-Filter (`concept_extraction.py`)**:
   - Drops lines matching cover-page metadata patterns (`SUBJECT CODE`, `SUBJECT NAME`, `COURSE OBJECTIVES`, `COURSE OUTCOMES`, `CO-PO MAPPING`, `DEPARTMENT`, `BATCH`, `YEAR/SEM`, `RBT Level`).
3. **LLM Extraction Prompt**:
   - Instructs Gemini to extract 8-15 core academic concepts (teachable ideas, models, architectures) while ignoring administrative metadata.
4. **Regex Exam-Tag Frequency Pass**:
   - Runs regex `r'\((?:Nov|Dec|May|Apr|Jan|Jun|Jul|Aug|Sep|Oct)[/\-]?(?:Nov|Dec|May|Apr|Jan|Jun|Jul|Aug|Sep|Oct)?\s*[\'\-]?\d{2,4}\)'` over original text.
   - Stores count in `concepts.exam_frequency`.

---

## 6. Mentra Tutor Subsystem

- **Branding**: *"Mentra Tutor — Grounded answers from your notes."*
- **Doubt Tracking**: Every question asked increments `mastery_scores.doubt_count` for that concept via `/ask` endpoint, triggering recalculation of concept mastery and recovery plan impact.
- **Doubt Indicator**: Surfaces transparent feedback: `"Asked N questions about [concept] — factored into recovery plan."`
- **Retrieval Practice Mode**: Optional user toggle prompting students to write a 1-line recall attempt from memory before revealing the grounded answer.
- **Inline "Test Yourself" Quiz Handoff**: Button under every tutor answer (`"Test yourself on this topic ➔"`) generates a single-question recall quiz immediately without leaving conversation context.
- **Grounding Badges & Citations**: Displays grounding strength (*Strongly supported by notes*, *Partially supported*, *Not clearly covered*) and page-specific chunk citations (`[p.4]`).

---

## 7. Mastery Engine & Recovery Plan Formulas

### Mastery Score Calculation (`mastery_engine.py`)
Combines quiz accuracy, average stated confidence (1-5), doubt count penalty ($0.04$ per question up to $0.20$), and practice recency:
$$\text{Score} = \text{Clamp}\left(0.10, 1.0, (\text{Accuracy} \times 0.70) + (\text{ConfidenceMultiplier} \times 0.30) - \text{DoubtPenalty}\right)$$

Every score persists a plain-language basis:
`"Estimated from N quiz answers (X% accuracy), average stated confidence Y/5, and Z tutor questions asked about this topic."`

### Recovery Plan Impact Formula (`recovery_engine.py`)
$$\text{Impact} = (1 - \text{Mastery}) \times (1 + \text{ConfirmedDependents}) \times (1 + \text{ExamFrequency})$$
Where `ConfirmedDependents` counts only prerequisite links explicitly confirmed by the student (`prerequisites_confirmed = 1`).

**Reason String Output**:
`"Asked in exams 3 times · 40% mastery. Reviewing prerequisite concepts (Y) will rebuild foundational understanding."`

---

## 8. Design System

- **Ink Navy (`#1B2A4A`)**: Headers, primary text, dark action buttons.
- **Paper Cream (`#FAF7F0`)**: Main page background and card surfaces.
- **Mastery Sage (`#6B8F71`)**: Progress bars, high mastery, correct quiz answers.
- **Alert Clay (`#C4634A`)**: Weak topics, low mastery, incorrect quiz answers.
- **Neutral Gray (`#8A8578`)**: Secondary text, metadata, subtle borders.
- **Highlighter Amber (`#E8A33D`)**: **RESERVED EXCLUSIVELY** for citations, page badges `[p.4]`, evidence marks, and grounding strength badges.

---

## 9. Core Backend API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/ingest` | Parses PDF/TXT, strips headers & metadata, extracts concepts, computes exam frequency, builds FAISS index. |
| `GET` | `/mastery/{doc_id}` | Retrieves all concept mastery scores paired with mandatory plain-language basis strings. |
| `GET` | `/recovery-plan/{doc_id}` | Retrieves ranked remediation plan using $\text{Impact} = (1 - M) \times (1 + CD) \times (1 + EF)$. |
| `POST` | `/ask` | Performs 2-pass RAG retrieval, generates answer with citations, increments concept `doubt_count`. |
| `POST` | `/concepts/confirm` | Confirms prerequisite links, updating `prerequisites_confirmed = 1`. |
| `POST` | `/quiz/generate` | Generates 5-question adaptive quiz for a selected concept. |
| `POST` | `/quiz/grade` | Grades quiz attempt, records confidence, updates `quiz_attempts` and concept mastery. |
| `POST` | `/exam/predict-questions` | Generates Part A (2-Mark) and Part B (16-Mark Essay with Mermaid Diagram) model question paper. |
| `DELETE` | `/privacy/delete/{doc_id}` | Purges all session data for a document from SQLite database. |

---

## 10. Verification Status

- **Backend Import & Schema Verification**: Passed via `python test_backend.py`.
- **Frontend Compilation**: Passed via Vite production build (`npm run build`, 0 errors).
- **Design & Tone Audit**: Passed. All banned claims and hype terms removed.
