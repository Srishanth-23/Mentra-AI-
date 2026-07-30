# Architecture — Mentra

```
┌─────────────────────────────────────────────────────────┐
│                FRONTEND (React + Tailwind)                │
│  Upload → Concept Map → Chat/Tutor → Quiz → Dashboard     │
└───────────────────────────┬─────────────────────────────┘
                             │ REST
┌───────────────────────────▼─────────────────────────────┐
│                  API LAYER (FastAPI)                      │
│  /ingest /ask /quiz/generate /quiz/grade                  │
│  /mastery /recovery-plan /concepts/confirm                │
└──────┬──────────────┬──────────────┬──────────────┬──────┘
       │              │              │              │
┌──────▼─────┐ ┌──────▼──────┐ ┌────▼──────┐ ┌──────▼──────┐
│ Ingestion   │ │ Retrieval +  │ │ Reasoning │ │ Pedagogy    │
│ chunk →     │ │ Reliability  │ │ (LLM +    │ │ mastery,    │
│ embed →     │ │ Scoring      │ │ citations)│ │ concept     │
│ concepts    │ │ (FAISS)      │ │           │ │ graph, quiz │
│             │ │              │ │           │ │ validator   │
└─────────────┘ └──────────────┘ └───────────┘ └─────────────┘
                             │
                    ┌────────▼────────┐
                    │ SQLite/Postgres  │
                    └──────────────────┘
```

## Layer responsibilities

**Ingestion** — PyMuPDF parses PDF → text chunked (~300-500 tokens, overlap ~50) → each chunk embedded → LLM call extracts 8-15 concepts with summaries and suggested prerequisites from full doc text.

**Retrieval + Reliability Scoring** — top-k chunks retrieved via FAISS cosine similarity for a given question → each chunk scored for relevance via a second lightweight LLM judgment call → chunks below threshold dropped → surviving chunks' average score becomes grounding_strength (High/Medium/Low).

**Reasoning** — LLM generates the answer using only surviving chunks, with citations back to chunk IDs/page numbers.

**Pedagogy** — quiz generation per concept (difficulty-adjusted based on current mastery score) → validator LLM call checks each question is answerable from its cited chunk and the marked answer is correct → grading logic updates mastery score and logs doubt/misconception patterns → recovery plan engine ranks weak concepts using dependency graph + mastery scores.

## Folder structure (suggested)
```
mentra/
  backend/
    main.py
    routers/
      ingest.py
      ask.py
      quiz.py
      mastery.py
      recovery.py
    services/
      chunking.py
      embeddings.py
      retrieval.py
      reliability_scoring.py
      concept_extraction.py
      quiz_generation.py
      quiz_validator.py
      mastery_engine.py
      recovery_engine.py
    models/
      db.py
      schema.sql
    requirements.txt
  frontend/
    src/
      pages/ (Upload, ConceptMap, Tutor, Quiz, Dashboard)
      components/
      api/
    package.json
  docs/
  .env.example
  README.md
```
