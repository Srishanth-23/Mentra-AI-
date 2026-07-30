# Prompt Chains — Mentra

Each feature below is TWO LLM calls where noted — this is intentional and is what makes the system more reliable than a single-shot RAG chatbot.

## 1. Concept extraction (one call)
Input: full document text (or chunked + summarized if too long).
Output: JSON list of 8-15 concepts, each with name, one-line summary, and suggested prerequisite concept names.
Instruction: explicitly tell the model the prerequisites are a *guess* to be confirmed by a human — this framing should carry into the UI copy too.

## 2. Grounded answer (two calls)
**Call A — relevance scoring:** for each of the top-k retrieved chunks, ask the model to score 0-1 how relevant/sufficient it is to answer the question. Drop chunks below threshold (e.g. 0.5).
**Call B — answer generation:** generate the answer using only surviving chunks, instructed to cite chunk IDs inline and to say "not covered in the material" if surviving chunks are insufficient rather than filling gaps from general knowledge.
`grounding_strength` = High/Medium/Low mapped from the average relevance score of chunks actually used.

## 3. Quiz generation (two calls)
**Call A — generate:** given a concept + its source chunk(s) + target difficulty, generate one multiple-choice question with 4 options and the correct answer, citing the source chunk.
**Call B — validate:** given the generated question, options, marked answer, and source chunk, ask the model to check (a) is this answerable from the chunk, (b) is the marked answer actually correct, (c) is it conceptual rather than trivia. If it fails any check, discard and regenerate (cap retries at 2).

## 4. Misconception explanation (one call)
Input: question, student's wrong answer, correct answer, source chunk.
Output: (a) plain-language likely misconception, (b) which part of the source chunk clarifies it, (c) one short follow-up question testing the same concept differently.

## 5. Recovery plan ranking (rules + one call)
Rules-based: rank concepts by (low mastery score) × (number of confirmed dependents affected).
LLM call: given the ranked list + mastery basis + dependency chain, generate a short plain-language "reason" string per concept, e.g. "You're weak here likely because prerequisite concepts X and Y are also weak."

## General prompting rules
- Every prompt that generates something shown to the student must include an instruction to stay strictly within the provided source text — no outside knowledge injected silently.
- Every "score" or "mastery" output must come with a one-line basis string, never a bare number.
- Keep temperature low (0-0.3) for grading/validation calls; slightly higher (0.5-0.7) is fine for explanation phrasing.
