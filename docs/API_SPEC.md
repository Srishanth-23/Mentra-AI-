# API Spec — Mentra

## POST /ingest
Upload doc, returns extracted concepts + suggested concept map.
```json
// request: multipart/form-data, file
// response
{
  "document_id": 1,
  "concepts": [
    {"id": 1, "name": "Gradient Descent", "summary": "...", "suggested_prerequisites": [2,3]}
  ]
}
```

## POST /concepts/confirm
User confirms/edits the dependency graph.
```json
// request
{ "concept_id": 1, "prerequisite_ids": [2, 3] }
// response
{ "concept_id": 1, "prerequisites_confirmed": true }
```

## POST /ask
Grounded Q&A.
```json
// request
{ "question": "What is gradient descent?", "document_id": 1 }
// response
{
  "answer": "...",
  "citations": [{"chunk_id": 12, "page": 4, "snippet": "..."}],
  "grounding_strength": "High"
}
```

## POST /quiz/generate
```json
// request
{ "concept_id": 1, "difficulty": "medium" }
// response
{
  "questions": [
    {"id": 5, "question_text": "...", "options": ["A","B","C","D"], "difficulty": "medium"}
  ]
}
```

## POST /quiz/grade
```json
// request
{
  "question_id": 5,
  "student_answer": "B",
  "confidence_stated": 3,
  "response_time_ms": 8200
}
// response
{
  "is_correct": false,
  "correct_answer": "A",
  "misconception_explanation": "...",
  "cited_chunk": {"chunk_id": 12, "page": 4},
  "followup_question": "..."
}
```

## GET /mastery/{document_id}
```json
{
  "concepts": [
    {"concept_id": 1, "name": "Gradient Descent", "score": 0.62, "basis": "heuristic: accuracy+confidence+recency"}
  ]
}
```

## GET /recovery-plan/{document_id}
```json
{
  "plan": [
    {
      "concept_id": 1,
      "reason": "Missed prerequisite concepts: Linear Algebra, Calculus",
      "source_chunk_ids": [3, 7],
      "suggested_order": 1
    }
  ]
}
```
