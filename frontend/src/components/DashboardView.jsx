import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getMastery, getRecoveryPlan, getMisconceptionPatterns } from '../api';

export default function DashboardView({ currentDoc, onSelectConceptForQuiz, onSelectConceptForTeaching, onNavigateTab }) {
  const [masteryList, setMasteryList] = useState([]);
  const [recoveryPlan, setRecoveryPlan] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentDoc) return;
    async function loadDashboardData() {
      setLoading(true);
      try {
        const [mRes, rRes, pRes] = await Promise.all([
          getMastery(currentDoc.document_id),
          getRecoveryPlan(currentDoc.document_id),
          getMisconceptionPatterns(currentDoc.document_id).catch(() => ({ patterns: [] })),
        ]);
        setMasteryList(mRes.concepts || []);
        setRecoveryPlan(rRes.plan || []);
        setPatterns(pRes.patterns || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboardData();
  }, [currentDoc]);

  if (!currentDoc) {
    return (
      <div className="max-w-[700px] mx-auto py-20 px-4 text-center space-y-4 font-body-md">
        <div className="w-12 h-12 bg-surface-container-high border border-outline-variant/30 rounded-lg flex items-center justify-center mx-auto text-primary">
          <span className="material-symbols-outlined text-2xl" data-icon="dashboard">dashboard</span>
        </div>
        <h2 className="font-headline-lg text-lg font-bold text-primary">No Active Study Material</h2>
        <p className="text-secondary text-xs max-w-sm mx-auto">
          Upload course notes or study material to view concept mastery scores, recurring error patterns, and recovery recommendations.
        </p>
      </div>
    );
  }

  const totalConcepts = masteryList.length || 1;
  const avgScore = Math.round(
    (masteryList.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalConcepts) * 100
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 space-y-8 font-body-md">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest border border-outline-variant/20 p-6 md:p-8 rounded-lg shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="font-mono text-xs uppercase tracking-wide text-secondary font-medium">
            STUDY DASHBOARD & MASTERY TRACKER
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-primary">
            {currentDoc.filename || 'Study Material Analytics'}
          </h1>
          <p className="font-body text-sm text-secondary">
            Average Mastery: <strong className="text-primary font-medium">{avgScore}%</strong> across {masteryList.length} extracted topics.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => onNavigateTab && onNavigateTab('tutor')}
            className="px-4 py-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant/30 text-primary rounded-md font-body text-sm font-medium transition-all"
          >
            Ask Tutor
          </button>
          <button
            onClick={() => onNavigateTab && onNavigateTab('quiz')}
            className="px-4 py-2 bg-primary text-surface hover:opacity-90 rounded-md font-body text-sm font-medium transition-all shadow-xs"
          >
            Take Adaptive Quiz
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs font-mono text-primary animate-pulse bg-surface-container-low rounded-lg border border-outline-variant/20">
          Loading concept mastery scores & misconception patterns...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Grid: Concept Progress & Recovery Plan */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column (7 cols): Concept Mastery Progress */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                <h2 className="font-heading text-xl font-semibold text-primary">
                  Concept Progress & Mastery Scores
                </h2>
                <span className="font-mono text-xs text-secondary">
                  {masteryList.length} Topics
                </span>
              </div>

              <div className="space-y-3">
                {masteryList.map((item, index) => {
                  const pct = Math.round((item.score || 0) * 100);
                  const scoreColor =
                    pct >= 75 ? 'text-mastery-sage' : pct >= 50 ? 'text-primary' : 'text-alert-clay';
                  const barColor =
                    pct >= 75 ? 'bg-mastery-sage' : pct >= 50 ? 'bg-primary' : 'bg-alert-clay';

                  return (
                    <motion.div
                      key={item.concept_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.04, ease: "easeOut" }}
                      className="bg-surface-container-lowest border border-outline-variant/20 p-4 rounded-lg space-y-2 hover:shadow-xs transition-shadow"
                    >
                      <div className="flex items-center justify-between text-base font-medium">
                        <h3 className="text-primary font-heading font-semibold text-lg">{item.name}</h3>
                        <span className={`font-mono text-xs font-medium ${scoreColor}`}>{pct}% Mastery</span>
                      </div>

                      <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-400 ease-out ${barColor}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* MANDATORY Plain-Language Basis String */}
                      <div className="pt-1 flex items-start gap-1.5 font-mono text-xs text-secondary leading-normal">
                        <span className="mentra-badge bg-highlighter/20 text-on-surface border border-highlighter/40 shrink-0 font-medium">
                          BASIS
                        </span>
                        <span>
                          {item.basis || `Estimated from quiz attempts, confidence ratings, and tutor inquiries for this topic.`}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Right Column (5 cols): Prioritized Recovery Plan */}
            <div className="lg:col-span-5 space-y-4">
              <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
                <h2 className="font-heading text-xl font-semibold text-primary">
                  Recovery Plan & Remediation Steps
                </h2>
                <span className="font-mono text-xs uppercase font-medium text-secondary">
                  Prioritized Order
                </span>
              </div>

              <div className="space-y-3">
                {recoveryPlan.length === 0 ? (
                  <div className="p-6 bg-surface-container-low border border-outline-variant/20 rounded-lg text-center font-mono text-xs text-mastery-sage space-y-1">
                    <span className="material-symbols-outlined text-xl block">check_circle</span>
                    <p className="font-medium">High mastery across all extracted topics!</p>
                    <p className="text-xs text-secondary font-normal">No immediate recovery steps needed.</p>
                  </div>
                ) : (
                  recoveryPlan.map((step) => (
                    <div
                      key={step.concept_id}
                      className="bg-surface-container-lowest border border-outline-variant/25 p-4 rounded-lg space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="px-2 py-0.5 bg-primary/10 text-primary font-medium uppercase rounded-sm">
                          STEP #{step.suggested_order} PRIORITY
                        </span>
                        <span className="text-secondary font-medium">
                          Mastery: {Math.round((step.mastery_score || 0) * 100)}%
                        </span>
                      </div>

                      <h3 className="font-heading text-lg text-primary font-semibold">{step.concept_name}</h3>
                      <p className="text-sm font-body text-secondary leading-normal">{step.reason}</p>

                      <button
                        onClick={() => onSelectConceptForQuiz(step.concept_id)}
                        className="w-full py-2 bg-primary text-surface font-body text-xs font-medium rounded-md hover:opacity-90 transition-all text-center"
                      >
                        Remediate Topic ➔
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Section 6 & 8 Extension UI: Your Recurring Patterns & Teach Novice Panel */}
          <div className="bg-surface-container-lowest border border-outline-variant/20 p-6 rounded-lg space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
              <div>
                <h2 className="font-heading text-xl font-semibold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl" data-icon="fingerprint">fingerprint</span>
                  <span>Recurring Patterns & Teachable Novice</span>
                </h2>
                <p className="text-sm text-secondary font-body mt-0.5">
                  Mistakes that share a reasoning error. Teach Alex to resolve misconceptions and boost topic mastery.
                </p>
              </div>
            </div>

            {patterns.length === 0 ? (
              <div className="p-6 bg-surface-container-low border border-outline-variant/20 rounded-lg text-center font-mono text-xs text-secondary space-y-1">
                <span className="material-symbols-outlined text-xl block text-secondary/60">analytics</span>
                <p className="font-medium text-primary">Patterns need at least 2 mistakes to compare — keep going.</p>
                <p className="text-xs text-secondary font-normal">Take more adaptive quiz questions to detect recurring reasoning gaps.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patterns.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 bg-surface-container-low border border-outline-variant/25 rounded-lg space-y-3"
                  >
                    {/* Concept Pair Badge */}
                    <div className="flex items-center gap-2 font-mono text-xs text-primary font-medium">
                      <span className="bg-surface-container-lowest border border-outline-variant/30 px-2.5 py-1 rounded">
                        {p.concept_1}
                      </span>
                      <span>↔</span>
                      <span className="bg-surface-container-lowest border border-outline-variant/30 px-2.5 py-1 rounded">
                        {p.concept_2}
                      </span>
                    </div>

                    {/* Formatted Pattern Description */}
                    <p className="text-sm font-body text-on-surface leading-relaxed">
                      {p.pattern_description}
                    </p>

                    {/* Traced Prerequisite Gap Citation if available */}
                    {p.traced_prerequisite_name && (
                      <div className="p-2 bg-surface-container-lowest border border-outline-variant/30 rounded font-mono text-xs text-primary flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary" data-icon="account_tree">account_tree</span>
                        <span>This traces back to a gap in <strong>{p.traced_prerequisite_name}</strong> — {p.trace_confidence || 'Medium'} confidence.</span>
                      </div>
                    )}

                    {/* Amber Evidence Citation Tag & Teach Novice Action */}
                    <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between font-mono text-xs">
                      <span className="mentra-badge bg-highlighter/20 text-on-surface border border-highlighter/40 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs" data-icon="search">search</span>
                        Pattern Evidence (Similarity: {Math.round(p.similarity_score * 100)}%)
                      </span>

                      {p.taught_through ? (
                        <span className="px-2 py-0.5 bg-mastery-sage/20 text-mastery-sage border border-mastery-sage/40 rounded font-bold">
                          Taught Through ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelectConceptForTeaching && onSelectConceptForTeaching(p.concept_1)}
                          className="px-2.5 py-1 bg-primary text-surface font-bold rounded hover:opacity-90 transition-opacity flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[12px]">school</span>
                          <span>Teach Alex ➔</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
