# PRD — Mentra

## Problem
Students learning from their own materials have no reliable way to know what they don't know. Existing tools chat, summarize, or tutor — none close the loop from wrong answer → diagnosed root cause → evidence-backed recovery plan.

## One-line pitch
Mentra turns any study material into a trusted tutor that teaches with citations, tests adaptively, diagnoses why a student is stuck, and prescribes a personalized recovery plan.

## Differentiation
| Existing product | Strong at | What Mentra adds |
|---|---|---|
| NotebookLM | Grounded Q&A, citations | Pedagogy loop: quizzes, mastery scoring, recovery plans |
| Khanmigo | Socratic tutoring | Document-grounded, personalized concept graph |
| Quizlet Q-Chat | Adaptive quizzes | Mastery graph, misconception diagnosis, recovery planning |
| Duolingo Max | Explain-my-mistake | Multi-subject, concept dependency analysis |
| LearnLM tools | Pedagogy-aware behavior | Concrete product: memory, evidence, analytics, next-step planning |

## Novelty contribution
**Evidence Reliability Scoring**: retrieved chunks are scored for relevance/reliability before generation; the score is surfaced to the student as a grounding-strength indicator (High/Medium/Low). This is the technical answer to "what's new here vs. standard RAG."

## MVP scope
- Upload one PDF / notes set
- Auto-extract 8–15 concepts
- Concept map + summaries, with editable/confirmable prerequisite links
- Grounded Q&A with citations + grounding-strength indicator
- Adaptive 5-question quiz, LLM-validated before shown to student
- Mastery score per concept (heuristic, clearly labeled as such)
- "Explain My Mistake" on wrong answers
- Weak-topic recovery plan, ranked, with reasons + citations
- Dashboard: concept map, mastery heatmap, recovery plan panel

## Explicitly out of scope for MVP
- Diagrams, equations, handwritten notes
- Deep student modeling (forgetting curves, motivation, attention)
- Production-scale retrieval/storage
- Formal learning-outcome evaluation study
- Enterprise privacy/compliance

## Known limitations (state these proactively, don't hide them)
1. Mastery score is a heuristic, not a validated psychometric assessment.
2. Concept dependency graph is LLM-suggested and may be wrong — shown to student for confirmation.
3. Grounding reduces hallucination, does not eliminate it — reflected in the grounding-strength indicator.
4. Text-only; no diagram/equation understanding in MVP.
5. Student model captures accuracy, confidence, response time, doubt frequency — not the full picture.
6. In-memory FAISS is demo-scale, not production-scale.
7. No formal evaluation; at most, one internal before/after signal from test users.
8. Basic privacy only: data stored per session, deletable on request, sent to LLM provider per their terms.

## Rubric alignment
| Area | What we show |
|---|---|
| Educational Impact | Personalized recovery plan, honest mastery framing |
| Creative AI/ML | Evidence reliability scoring, misconception detection, validated adaptive quizzes |
| Technical Execution | End-to-end pipeline, editable concept graph, modular backend |
| Pitch & Demo | Scattered notes → mastery engine in under 2 minutes |
