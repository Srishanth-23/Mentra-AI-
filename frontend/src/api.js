const API_BASE = import.meta.env.VITE_API_BASE || 'https://mentra-ai-qra2.onrender.com';

export async function ingestDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/ingest`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to process study material document.');
  }
  return res.json();
}

export async function confirmConcepts(conceptId, prerequisiteIds) {
  const res = await fetch(`${API_BASE}/concepts/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept_id: conceptId, prerequisite_ids: prerequisiteIds }),
  });
  if (!res.ok) throw new Error('Failed to update concept graph edge.');
  return res.json();
}

export async function askQuestion(question, documentId) {
  const res = await fetch(`${API_BASE}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, document_id: documentId }),
  });
  if (!res.ok) throw new Error('Failed to retrieve grounded answer.');
  return res.json();
}

export async function generateQuiz(conceptId, difficulty = 'medium') {
  const res = await fetch(`${API_BASE}/quiz/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ concept_id: conceptId, difficulty }),
  });
  if (!res.ok) throw new Error('Failed to generate adaptive quiz.');
  return res.json();
}

export async function gradeQuiz(questionId, studentAnswer, confidenceStated, responseTimeMs = 4000) {
  const res = await fetch(`${API_BASE}/quiz/grade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_id: questionId,
      student_answer: studentAnswer,
      confidence_stated: confidenceStated,
      response_time_ms: responseTimeMs,
    }),
  });
  if (!res.ok) throw new Error('Failed to submit quiz attempt for grading.');
  return res.json();
}

export async function getMastery(documentId) {
  const res = await fetch(`${API_BASE}/mastery/${documentId}`);
  if (!res.ok) throw new Error('Failed to load document concept mastery scores.');
  return res.json();
}

export async function getRecoveryPlan(documentId) {
  const res = await fetch(`${API_BASE}/recovery-plan/${documentId}`);
  if (!res.ok) throw new Error('Failed to load weak-topic recovery plan.');
  return res.json();
}

export async function deleteDocumentData(documentId) {
  const res = await fetch(`${API_BASE}/privacy/delete/${documentId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to purge session data.');
  return res.json();
}

export async function getMisconceptionPatterns(documentId) {
  const res = await fetch(`${API_BASE}/misconception-patterns/${documentId}`);
  if (!res.ok) throw new Error('Failed to load misconception patterns.');
  return res.json();
}

export async function getGlobalConceptHistory(conceptId) {
  const res = await fetch(`${API_BASE}/global-concepts/history/${conceptId}`);
  if (!res.ok) throw new Error('Failed to load global concept history.');
  return res.json();
}

export async function getPersonalGraph(documentId) {
  const res = await fetch(`${API_BASE}/personal-graph/${documentId}`);
  if (!res.ok) throw new Error('Failed to load personal concept graph.');
  return res.json();
}

export async function getGraphDrift(documentId) {
  const res = await fetch(`${API_BASE}/graph-drift/${documentId}`);
  if (!res.ok) throw new Error('Failed to load graph drift summary.');
  return res.json();
}

export async function getTracedMisconceptions(documentId) {
  const res = await fetch(`${API_BASE}/misconceptions/${documentId}/traced`);
  if (!res.ok) throw new Error('Failed to load traced misconceptions.');
  return res.json();
}

export async function startTeachingSession(documentId, conceptId) {
  const res = await fetch(`${API_BASE}/teaching/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId, concept_id: conceptId }),
  });
  if (!res.ok) throw new Error('Failed to start teaching session.');
  return res.json();
}

export async function sendTeachingMessage(sessionId, studentMessage) {
  const res = await fetch(`${API_BASE}/teaching/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, student_message: studentMessage }),
  });
  if (!res.ok) throw new Error('Failed to send teaching message to Novice.');
  return res.json();
}

export async function evaluateTeachingSession(sessionId) {
  const res = await fetch(`${API_BASE}/teaching/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!res.ok) throw new Error('Failed to evaluate teaching session.');
  return res.json();
}

export async function getTeachingHistory(conceptId) {
  const res = await fetch(`${API_BASE}/teaching/history/${conceptId}`);
  if (!res.ok) throw new Error('Failed to load teaching session history.');
  return res.json();
}

export async function analyzeSpokenModel(documentId, conceptId, transcript) {
  const res = await fetch(`${API_BASE}/speak-your-model/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ document_id: documentId, concept_id: conceptId, transcript }),
  });
  if (!res.ok) throw new Error('Failed to analyze spoken explanation.');
  return res.json();
}

export async function updateDocumentLanguage(documentId, languageCode, simplifyMode = false) {
  const res = await fetch(`${API_BASE}/documents/${documentId}/language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language_code: languageCode, simplify_mode: simplifyMode }),
  });
  if (!res.ok) throw new Error('Failed to update document language preference.');
  return res.json();
}


