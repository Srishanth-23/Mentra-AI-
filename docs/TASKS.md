# Build Tasks — Mentra

## Day 1 — Ingestion + Grounded Q&A
- [x] FastAPI project scaffold, SQLite DB with schema from `DB_SCHEMA.md`
- [x] PyMuPDF PDF parsing → chunking (~300-500 tokens, overlap ~50)
- [x] Embedding generation + FAISS index per document
- [x] Concept extraction LLM call → `/ingest` endpoint
- [x] Retrieval + reliability scoring (two-call pattern from `PROMPTS.md`)
- [x] `/ask` endpoint returning answer + citations + grounding_strength
- [x] Minimal frontend: upload page + chat page wired to `/ingest` and `/ask`

## Day 2 — Quiz + Mastery
- [x] Quiz generation + validator two-call pattern → `/quiz/generate`
- [x] `/quiz/grade` with misconception explanation + follow-up question
- [x] Mastery scoring engine (heuristic: accuracy + confidence + recency), always paired with a `basis` string
- [x] `/mastery/{document_id}` endpoint
- [x] Concept map UI with editable/confirmable prerequisite links → `/concepts/confirm`
- [x] Quiz-taking UI with confidence slider before each answer

## Day 3 — Recovery Plan + Dashboard + Polish
- [x] Recovery plan ranking logic (rules + LLM reason generation)
- [x] `/recovery-plan/{document_id}` endpoint
- [x] Dashboard UI: concept map, mastery heatmap, recovery plan panel
- [x] "Delete my data" endpoint + button (privacy talking point)
- [x] End-to-end run-through, fix broken states
- [x] Rehearse 2-minute demo script (in `PRD.md` / pitch deck)

## Stretch (only if ahead of schedule)
- [x] Simplify/multilingual explanation mode
- [x] Swap heuristic mastery for simple Bayesian Knowledge Tracing
- [x] Teacher/parent dashboard view
