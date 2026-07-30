import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import mermaid from 'mermaid';
import { askQuestion, getMastery, generateQuiz } from '../api';
import { TypingIndicator } from './LoadingIndicator';

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
});

function MermaidDiagram({ code }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && code) {
      const cleanCode = code.trim();
      const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
      mermaid.render(id, cleanCode)
        .then(({ svg }) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
        })
        .catch(() => {
          if (containerRef.current) {
            containerRef.current.innerHTML = `<pre class="text-xs font-mono p-3 bg-surface-container rounded overflow-x-auto">${cleanCode}</pre>`;
          }
        });
    }
  }, [code]);

  return (
    <div className="my-4 p-4 bg-surface-container-low border border-primary/20 rounded-md overflow-x-auto shadow-xs">
      <div className="text-[10px] font-label-mono uppercase tracking-widest text-primary font-bold mb-3 flex items-center gap-1.5 border-b border-primary/10 pb-2">
        <span className="material-symbols-outlined text-sm" data-icon="schema">schema</span>
        <span>Visual Architecture & System Flow Diagram</span>
      </div>
      <div ref={containerRef} className="flex justify-center" />
    </div>
  );
}

export function FormattedAnswer({ text }) {
  if (!text) return null;

  // Split text into normal text sections and code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-3 font-body text-on-surface leading-relaxed text-base">
      {parts.map((part, index) => {
        if (!part) return null;

        if (part.startsWith('```')) {
          if (part.startsWith('```mermaid')) {
            const code = part.replace(/^```mermaid\s*/, '').replace(/```$/, '');
            return <MermaidDiagram key={index} code={code} />;
          } else {
            const cleanCode = part.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
            return (
              <div key={index} className="my-3">
                <pre className="font-mono text-xs p-3 bg-surface-container-low border border-outline-variant/25 rounded overflow-x-auto leading-normal text-primary">
                  {cleanCode}
                </pre>
              </div>
            );
          }
        }

        const lines = part.split('\n');
        const elements = [];

        lines.forEach((line, lIdx) => {
          const trimmed = line.trim();
          if (!trimmed) {
            elements.push(<div key={`space-${lIdx}`} className="h-1" />);
            return;
          }

          if (trimmed.startsWith('###') || (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 60)) {
            const headingText = trimmed.replace(/^###\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
            elements.push(
              <h3 key={`h3-${lIdx}`} className="font-bold text-sm text-primary mt-3 mb-1 uppercase tracking-wide border-b border-outline-variant/15 pb-1">
                {headingText}
              </h3>
            );
            return;
          }

          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const bulletContent = trimmed.substring(2);
            elements.push(
              <div key={`bullet-${lIdx}`} className="flex items-start gap-2 pl-2 my-1">
                <span className="text-primary font-bold text-xs">•</span>
                <span className="flex-1" dangerouslySetInnerHTML={{
                  __html: bulletContent.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary font-bold">$1</strong>')
                }} />
              </div>
            );
            return;
          }

          elements.push(
            <p key={`p-${lIdx}`} className="my-1 leading-relaxed" dangerouslySetInnerHTML={{
              __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary font-bold">$1</strong>')
            }} />
          );
        });

        return <div key={index} className="space-y-1">{elements}</div>;
      })}
    </div>
  );
}

export default function TutorView({ currentDoc, preferredLanguage = 'en', simplifyMode = false, previousLanguage = null }) {
  const [messages, setMessages] = useState([
    {
      sender: 'tutor',
      text: `Hello! I am Mentra Tutor — grounded answers strictly from "${currentDoc?.filename || 'your study material'}". Ask any question about concepts, definitions, or mechanisms in your notes.`,
      citations: [],
      grounding_strength: 'High',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [concepts, setConcepts] = useState(currentDoc?.concepts || []);
  const [expandedCitations, setExpandedCitations] = useState({});
  
  // Retrieval Practice Mode state
  const [retrievalPractice, setRetrievalPractice] = useState(false);
  const [userAttempt, setUserAttempt] = useState('');
  const [awaitingAttemptFor, setAwaitingAttemptFor] = useState(null);

  // Inline Test Yourself Quiz State per message
  const [inlineQuizzes, setInlineQuizzes] = useState({});
  const [quizLoadingMsgIdx, setQuizLoadingMsgIdx] = useState(null);

  const toggleCitationExpand = (idx) => {
    setExpandedCitations(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  useEffect(() => {
    if (currentDoc?.document_id && (!concepts || concepts.length === 0)) {
      getMastery(currentDoc.document_id)
        .then((data) => {
          if (data && data.concepts && data.concepts.length > 0) {
            setConcepts(data.concepts);
          }
        })
        .catch(() => {});
    }
  }, [currentDoc]);

  const submitQuery = async (queryText = null, studentAttemptText = null, e = null) => {
    if (e) e.preventDefault();
    const userQuery = (queryText || input).trim();
    if (!userQuery || !currentDoc || loading) return;

    if (retrievalPractice && !studentAttemptText && awaitingAttemptFor !== userQuery) {
      setAwaitingAttemptFor(userQuery);
      return;
    }

    setInput('');
    setAwaitingAttemptFor(null);
    const attemptToSave = studentAttemptText || userAttempt;
    setUserAttempt('');

    setMessages((prev) => [
      ...prev,
      {
        sender: 'user',
        text: userQuery,
        studentAttempt: attemptToSave,
      },
    ]);
    setLoading(true);

    try {
      const res = await askQuestion(userQuery, currentDoc.document_id);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: res.answer,
          citations: res.citations || [],
          grounding_strength: res.grounding_strength || 'Medium',
          concept_id: res.concept_id,
          concept_name: res.concept_name,
          doubt_count: res.doubt_count || 1,
          exam_frequency: res.exam_frequency || 0,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: 'Sorry, I encountered an issue retrieving the grounded answer. Please try again.',
          citations: [],
          grounding_strength: 'Low',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => submitQuery(null, null, e);

  // Single-Click Inline "Test Yourself" Quiz Generation
  const handleTestYourself = async (msgIndex, conceptId) => {
    const targetConceptId = conceptId || (concepts[0]?.id || 1);
    setQuizLoadingMsgIdx(msgIndex);
    try {
      const res = await generateQuiz(targetConceptId, 'medium');
      if (res && res.questions && res.questions.length > 0) {
        const q = res.questions[0];
        setInlineQuizzes((prev) => ({
          ...prev,
          [msgIndex]: {
            question_text: q.question_text,
            options: q.options,
            correct_answer: q.correct_answer,
            selected_option: null,
          },
        }));
      }
    } catch (err) {
      alert('Unable to generate inline test question right now.');
    } finally {
      setQuizLoadingMsgIdx(null);
    }
  };

  const handleSelectInlineOption = (msgIdx, opt) => {
    setInlineQuizzes((prev) => ({
      ...prev,
      [msgIdx]: {
        ...prev[msgIdx],
        selected_option: opt,
      },
    }));
  };

  // Dynamic suggestion generator
  const getDynamicSuggestions = () => {
    const conceptNames = concepts
      .map((c) => (typeof c === 'string' ? c : c?.name || c?.concept_name))
      .filter(Boolean);

    const fallbackConcepts = ['Core Architecture', 'Key Principles', 'System Components', 'Main Workflow'];
    const activeConcepts = conceptNames.length > 0 ? conceptNames : fallbackConcepts;

    const pool = [];
    activeConcepts.forEach((c) => {
      pool.push(`Explain the core mechanism of ${c}.`);
      pool.push(`What are key technical terms and definitions for ${c}?`);
      pool.push(`What are practical applications of ${c}?`);
    });

    const askedTexts = messages
      .filter((m) => m.sender === 'user')
      .map((m) => m.text.toLowerCase().trim());

    const unaskedPool = pool.filter((s) => {
      const lowerS = s.toLowerCase().trim();
      return !askedTexts.some((asked) => asked === lowerS || asked.includes(lowerS) || lowerS.includes(asked));
    });

    const uniquePool = Array.from(new Set(unaskedPool));
    return uniquePool.slice(0, 3);
  };

  const suggestions = getDynamicSuggestions();

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col relative bg-background font-body-md text-on-background">
      {/* Header bar */}
      <div className="bg-surface border-b border-outline-variant/15 px-4 md:px-12 py-3 flex items-center justify-between text-xs font-label-mono">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-sm" data-icon="menu_book">menu_book</span>
          <span className="font-bold text-primary">Mentra Tutor — Grounded answers from your notes</span>
        </div>

        {/* Retrieval Practice Mode Toggle */}
        <label className="flex items-center gap-2 cursor-pointer text-secondary hover:text-primary transition-colors">
          <input
            type="checkbox"
            checked={retrievalPractice}
            onChange={(e) => setRetrievalPractice(e.target.checked)}
            className="rounded text-primary focus:ring-0 w-3.5 h-3.5"
          />
          <span className="text-[11px]">Retrieval Practice Mode</span>
        </label>
      </div>

      {/* Chat Message Area */}
      <div className="flex-grow max-w-[800px] mx-auto w-full px-4 md:px-12 py-8 flex flex-col gap-8">
        {messages.map((msg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="w-full space-y-3"
          >
            {msg.sender === 'user' ? (
              <div className="flex flex-col items-end gap-1.5 w-full">
                <div className="bg-surface-container text-on-surface-variant px-4 py-3 rounded-xl max-w-[85%] border border-outline-variant/10">
                  <p className="text-sm">{msg.text}</p>

                  {/* Student 1-line Retrieval Attempt if present */}
                  {msg.studentAttempt && (
                    <div className="mt-2 pt-2 border-t border-outline-variant/20 font-label-mono text-[11px] text-secondary">
                      <span className="font-bold text-primary block">Your Recall Attempt:</span>
                      <p className="italic">"{msg.studentAttempt}"</p>
                    </div>
                  )}
                </div>
                <span className="font-label-mono text-[10px] uppercase text-secondary mr-2">
                  Student Question
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-sm" data-icon="auto_awesome">
                      auto_awesome
                    </span>
                    <span className="font-label-mono text-xs uppercase tracking-widest text-primary font-bold">
                      Mentra Tutor
                    </span>
                  </div>

                  {/* Grounding Strength Badge */}
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="mentra-badge bg-highlighter/20 text-on-surface border border-highlighter/40">
                      {msg.grounding_strength === 'High'
                        ? 'Strongly supported by notes'
                        : msg.grounding_strength === 'Medium'
                        ? 'Partially supported'
                        : 'Not clearly covered'}
                    </span>
                  </div>
                </div>

                {/* Paper Cream Card */}
                <div className="bg-surface-container-lowest border border-outline-variant/20 p-6 rounded-lg shadow-xs space-y-4">
                  <FormattedAnswer text={msg.text} />

                  {/* Citations with Section 4 Citation Honesty Disclosure */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-3 border-t border-outline-variant/15 space-y-2">
                      <span className="font-mono text-xs uppercase tracking-wide text-secondary font-medium block">
                        Source Citations & Evidence Traceability:
                      </span>
                      <div className="flex flex-col gap-2">
                        {msg.citations.map((cite, idx) => {
                          const citeKey = `${index}-${idx}`;
                          const isExpanded = expandedCitations[citeKey];
                          const isTranslated = preferredLanguage && preferredLanguage !== 'en';

                          return (
                            <div key={idx} className="bg-surface-container-low border border-outline-variant/20 p-2.5 rounded-lg font-mono text-xs space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="mentra-badge bg-highlighter/20 text-on-surface border border-highlighter/40">
                                    [p.{cite.page}]
                                  </span>
                                  {isTranslated && (
                                    <span className="text-[10px] text-secondary">
                                      — Translated from original document (English).
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => toggleCitationExpand(citeKey)}
                                  className="text-[11px] text-primary hover:underline font-medium"
                                >
                                  {isExpanded ? 'Hide original text' : 'View original text'}
                                </button>
                              </div>

                              <p className="text-secondary italic">"{cite.snippet}"</p>

                              {isExpanded && (
                                <div className="p-2 rounded bg-white/40 border border-outline-variant/30 text-[11px] text-[#2C221E] space-y-1 animate-in fade-in duration-150">
                                  <span className="font-bold block text-primary">Original Untranslated Source (Chunk #{cite.chunk_id}):</span>
                                  <p className="not-italic font-mono">{cite.snippet}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Mid-Session Language Mismatch Disclosure Note */}
                  {previousLanguage && preferredLanguage !== previousLanguage && index === messages.length - 1 && (
                    <div className="p-2 rounded bg-[#EFE9DD] border border-[#E2D9CB] font-mono text-[11px] text-[#786C5E] flex items-center gap-1.5">
                      <span>ℹ️</span>
                      <span>Note: Earlier messages in this session were generated in previous language mode ({previousLanguage}).</span>
                    </div>
                  )}

                  {/* Doubt Count & Exam Frequency Footer */}
                  <div className="pt-3 border-t border-outline-variant/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-label-mono text-[11px] text-secondary">
                    <div>
                      {msg.concept_name && (
                        <span>
                          Asked <strong className="text-primary">{msg.doubt_count}</strong> question{msg.doubt_count > 1 ? 's' : ''} about <strong>{msg.concept_name}</strong> — factored into recovery plan.
                        </span>
                      )}
                    </div>

                    {msg.exam_frequency > 0 && (
                      <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        Appeared in exams {msg.exam_frequency} times
                      </span>
                    )}
                  </div>

                  {/* "Test yourself on this" Inline Quiz Handoff */}
                  <div className="pt-3 border-t border-outline-variant/15">
                    <button
                      onClick={() => handleTestYourself(index, msg.concept_id)}
                      disabled={quizLoadingMsgIdx === index}
                      className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary font-label-mono text-xs font-bold rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm" data-icon="quiz">quiz</span>
                      <span>
                        {quizLoadingMsgIdx === index ? 'Generating Inline Quiz...' : 'Test yourself on this topic ➔'}
                      </span>
                    </button>

                    {/* Inline Quiz Question Display */}
                    {inlineQuizzes[index] && (
                      <div className="mt-3 p-4 bg-surface-container-low border border-outline-variant/30 rounded-lg space-y-3">
                        <div className="flex items-center justify-between font-label-mono text-[10px] text-primary font-bold">
                          <span>INLINE RECALL QUIZ</span>
                          <span>1 Question</span>
                        </div>

                        <p className="text-xs font-bold text-primary">
                          {inlineQuizzes[index].question_text}
                        </p>

                        <div className="space-y-1.5">
                          {inlineQuizzes[index].options.map((opt, oIdx) => {
                            const isSelected = inlineQuizzes[index].selected_option === opt;
                            const isCorrect = opt === inlineQuizzes[index].correct_answer;
                            let btnStyle = 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/40';

                            if (inlineQuizzes[index].selected_option) {
                              if (isCorrect) btnStyle = 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold';
                              else if (isSelected) btnStyle = 'bg-rose-50 border-rose-300 text-rose-800';
                            }

                            return (
                              <button
                                key={oIdx}
                                onClick={() => handleSelectInlineOption(index, opt)}
                                className={`w-full p-2.5 border rounded text-left text-xs font-body-md transition-all flex items-center justify-between ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {inlineQuizzes[index].selected_option && isCorrect && (
                                  <span className="font-label-mono text-[10px] text-emerald-700 font-bold">✓ Correct</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/20 rounded-xl text-xs font-label-mono text-primary">
            <TypingIndicator />
            <span>Searching FAISS chunks & verifying source grounding...</span>
          </div>
        )}

        {/* Retrieval Practice Prompt Overlay if waiting for student attempt */}
        {awaitingAttemptFor && (
          <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-lg space-y-3">
            <div className="flex items-center gap-2 font-label-mono text-xs text-amber-900 font-bold">
              <span className="material-symbols-outlined text-sm" data-icon="edit_note">edit_note</span>
              <span>Retrieval Practice Active: Try answering in 1 line first!</span>
            </div>
            <input
              type="text"
              value={userAttempt}
              onChange={(e) => setUserAttempt(e.target.value)}
              placeholder="Write your 1-line recall attempt from memory..."
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded p-2.5 text-xs font-body-md focus:ring-0 focus:border-primary"
            />
            <div className="flex justify-end gap-2 font-label-mono text-xs">
              <button
                onClick={() => submitQuery(awaitingAttemptFor, 'Skipped recall attempt')}
                className="px-3 py-1.5 text-secondary hover:text-primary"
              >
                Skip Attempt
              </button>
              <button
                onClick={() => submitQuery(awaitingAttemptFor, userAttempt)}
                className="px-4 py-1.5 bg-primary text-surface font-bold rounded"
              >
                Submit Attempt & See Answer
              </button>
            </div>
          </div>
        )}

        {/* Recommended Questions */}
        {suggestions.length > 0 && !awaitingAttemptFor && (
          <div className="flex flex-col gap-2.5 mt-2">
            <span className="font-label-mono text-[10px] uppercase tracking-widest text-secondary font-bold">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, idx) => (
                <button
                  key={`${s}-${idx}`}
                  onClick={() => submitQuery(s)}
                  disabled={loading}
                  className="bg-surface-container-low border border-outline-variant/20 px-3 py-1.5 text-primary font-body-md text-xs hover:border-primary/40 rounded transition-all text-left disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="sticky bottom-0 bg-surface/90 backdrop-blur-md border-t border-outline-variant/15 w-full mt-auto">
        <div className="max-w-[800px] mx-auto px-4 md:px-12 py-3">
          <form onSubmit={handleSend} className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about your study material..."
              className="w-full bg-surface-container-lowest border-0 border-b border-outline-variant/40 focus:border-primary focus:ring-0 font-body-md py-3 pl-3 pr-14 text-sm placeholder:text-secondary/60 placeholder:font-label-mono"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="absolute right-2 bg-primary text-surface p-2 w-8 h-8 flex items-center justify-center rounded hover:opacity-90 disabled:opacity-40 transition-all"
            >
              <span className="material-symbols-outlined text-base" data-icon="arrow_upward">
                arrow_upward
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
