import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { startTeachingSession, sendTeachingMessage, evaluateTeachingSession } from '../api';
import LoadingIndicator, { TypingIndicator } from './LoadingIndicator';

export default function TeachNoviceView({ currentDoc, concept, onBack, onNavigateTab }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState(null);
  const [turnCount, setTurnCount] = useState(0);

  useEffect(() => {
    if (!currentDoc || !concept) return;
    async function initSession() {
      setLoading(true);
      try {
        const res = await startTeachingSession(currentDoc.document_id, concept.id);
        setSession(res);
        setMessages([
          { role: 'novice', message_text: res.opening_message }
        ]);
      } catch (err) {
        console.error("Error starting teaching session:", err);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, [currentDoc, concept]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMsg.trim() || sending || !session) return;

    const userText = inputMsg.trim();
    setInputMsg('');
    setMessages((prev) => [...prev, { role: 'student', message_text: userText }]);
    setSending(true);

    try {
      const res = await sendTeachingMessage(session.session_id, userText);
      setMessages((prev) => [...prev, { role: 'novice', message_text: res.novice_response }]);
      setTurnCount(res.turn_count || turnCount + 1);

      if (res.conversation_ended) {
        // Automatically evaluate session
        handleEvaluateSession();
      }
    } catch (err) {
      console.error("Error sending teaching message:", err);
    } finally {
      setSending(false);
    }
  };

  const handleEvaluateSession = async () => {
    if (!session || evaluating) return;
    setEvaluating(true);
    try {
      const evalRes = await evaluateTeachingSession(session.session_id);
      setEvaluation(evalRes);
    } catch (err) {
      console.error("Error evaluating session:", err);
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto py-20 px-4">
        <LoadingIndicator text={`Initializing Teachable Agent Session for "${concept?.name || 'Topic'}"...`} />
      </div>
    );
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 py-6 space-y-6 font-body-md min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Top Session Header & Mode Indicator */}
      <div className="bg-surface-container-lowest border border-outline-variant/25 p-5 rounded-xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg border border-outline-variant/30 hover:bg-surface-container text-primary font-medium text-xs flex items-center gap-1 font-mono"
            >
              ← Back
            </button>
            <h2 className="font-heading text-xl font-semibold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl" data-icon="school">school</span>
              <span>Teach Alex: {concept?.name}</span>
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-secondary font-medium">
              Turn {turnCount}/6
            </span>
            {!evaluation && (
              <button
                onClick={handleEvaluateSession}
                disabled={evaluating || messages.length < 3}
                className="px-3 py-1 bg-primary text-surface rounded-md font-mono text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-all shadow-xs"
              >
                {evaluating ? 'Evaluating...' : 'Finish & Evaluate ➔'}
              </button>
            )}
          </div>
        </div>

        {/* Real Mode vs Generic Mode Banner */}
        <div className={`p-3 rounded-lg border text-xs font-mono flex items-center gap-2.5 ${
          session?.is_generic_mode
            ? 'bg-surface-container-high border-outline-variant/30 text-secondary'
            : 'bg-primary/10 border-primary/20 text-primary font-medium'
        }`}>
          <span className="material-symbols-outlined text-base" data-icon="info">info</span>
          <span>
            {session?.is_generic_mode
              ? "You haven't made a logged mistake on this topic yet, so Alex's confusion here is a plausible generic misunderstanding, not based on your own history."
              : "Alex is confused in the same way you were — based on your actual quiz history on this topic."}
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {messages.map((m, idx) => {
          const isStudent = m.role === 'student';
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className={`flex gap-3 ${isStudent ? 'justify-end' : 'justify-start'}`}
            >
              {!isStudent && (
                <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/30 text-primary font-medium text-xs flex items-center justify-center shrink-0">
                  Alex
                </div>
              )}
              <div
                className={`max-w-[75%] p-4 rounded-2xl text-base leading-normal font-body shadow-xs ${
                  isStudent
                    ? 'bg-primary text-surface rounded-tr-none font-medium'
                    : 'bg-surface-container-lowest border border-outline-variant/25 text-on-surface rounded-tl-none'
                }`}
              >
                {m.message_text}
              </div>
              {isStudent && (
                <div className="w-8 h-8 rounded-full bg-primary text-surface font-medium text-xs flex items-center justify-center shrink-0">
                  You
                </div>
              )}
            </motion.div>
          );
        })}
        {sending && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/30 text-primary font-medium text-xs flex items-center justify-center shrink-0">
              Alex
            </div>
            <TypingIndicator />
          </div>
        )}
      </div>

      {/* Post-Session Evaluation Summary Card */}
      {evaluation && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-xl space-y-4 shadow-md animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
            <h3 className="font-heading text-xl font-semibold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" data-icon="analytics">analytics</span>
              <span>Teaching Evaluation Results</span>
            </h3>
            <span className={`mentra-badge ${
              evaluation.misconception_resolved
                ? 'bg-mastery-sage/20 text-mastery-sage border border-mastery-sage/40'
                : 'bg-surface-container-high text-secondary border border-outline-variant/30'
            }`}>
              {evaluation.misconception_resolved ? 'Misconception Resolved ✓' : 'Still Confused — Retry Encouraged'}
            </span>
          </div>

          <p className="text-base text-on-surface leading-relaxed font-body">
            {evaluation.reasoning}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-label-mono text-xs">
            <div className="p-3 bg-surface-container-low border border-outline-variant/20 rounded-lg space-y-1">
              <span className="text-secondary block font-bold text-[10px] uppercase">Explanation Clarity Tier</span>
              <span className="text-primary font-bold">{evaluation.clarity} Clarity</span>
            </div>
            <div className="p-3 bg-surface-container-low border border-outline-variant/20 rounded-lg space-y-1">
              <span className="text-secondary block font-bold text-[10px] uppercase">Prerequisites Covered</span>
              <span className="text-primary font-bold">{evaluation.prerequisite_coverage}</span>
            </div>
          </div>

          {/* Basis String & Boost Section */}
          {evaluation.misconception_resolved && evaluation.mastery_boost_applied > 0 ? (
            <div className="p-4 bg-mastery-sage/10 border border-mastery-sage/30 rounded-lg space-y-2 font-label-mono text-xs">
              <div className="flex items-center gap-2 text-mastery-sage font-bold">
                <span className="material-symbols-outlined text-base">trending_up</span>
                <span>Mastery Boost Applied (+{evaluation.mastery_boost_applied})</span>
              </div>
              <p className="text-[11px] text-secondary leading-normal">
                {evaluation.basis_string}
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => onNavigateTab && onNavigateTab('concepts')}
                  className="text-[11px] text-primary underline font-bold hover:opacity-80 transition-opacity"
                >
                  Edge strengthened in Your View ➔
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-lg space-y-2 font-label-mono text-xs text-secondary">
              <p className="font-bold text-primary">Alex is still a bit confused — want to try explaining this differently?</p>
              <p className="text-[11px] font-normal">No mastery boost was applied. You can retry anytime without penalty.</p>
            </div>
          )}
        </div>
      )}

      {/* Chat Input Bar */}
      {!evaluation && (
        <form onSubmit={handleSendMessage} className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant/30 p-2.5 rounded-xl shadow-xs">
          <input
            type="text"
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder={`Explain ${concept?.name} to Alex in simple terms...`}
            disabled={sending}
            className="flex-1 bg-transparent px-3 py-2 text-xs font-body-md outline-none text-on-surface placeholder:text-outline"
          />
          <button
            type="submit"
            disabled={!inputMsg.trim() || sending}
            className="px-4 py-2 bg-primary text-surface rounded-lg font-label-mono text-xs font-bold hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-xs"
          >
            <span>Send</span>
            <span className="material-symbols-outlined text-sm" data-icon="send">send</span>
          </button>
        </form>
      )}
    </div>
  );
}
