# Mentra

Evidence-grounded, adaptive learning copilot. Upload study material, get a grounded tutor, adaptive quizzes, mastery tracking, and a personalized recovery plan.

## Read in this order
1. `docs/PRD.md` — what we're building and why, MVP scope, known limitations
2. `docs/ARCHITECTURE.md` — system layers and how they connect
3. `docs/DB_SCHEMA.md` — data model
4. `docs/API_SPEC.md` — routes and contracts
5. `docs/PROMPTS.md` — exact LLM prompt chains
6. `docs/FREE_LLM_SETUP.md` — how to get and use free Gemini/Groq API keys
7. `docs/TASKS.md` — build checklist, work through in order

## Stack
- Frontend: React + Tailwind
- Backend: FastAPI (Python, async)
- LLM: Google Gemini API (free tier, no card required) — `gemini-2.0-flash` or `gemini-2.5-flash`
- Embeddings + retrieval: Gemini `text-embedding-004` (free) + FAISS
- Optional: Groq (free) for faster quiz-grading calls if latency matters during the demo
- DB: SQLite
- Doc parsing: PyMuPDF

Get a Gemini key at https://aistudio.google.com/apikey — takes under a minute, no billing setup.


## Setup
```bash
# backend
cd backend
pip install -r requirements.txt --break-system-packages
cp ../.env.example .env   # fill in API keys
uvicorn main:app --reload

# frontend
cd frontend
npm install
npm run dev
```

## Env vars
See `.env.example`.
