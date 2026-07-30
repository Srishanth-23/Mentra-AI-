import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateQuiz, gradeQuiz } from '../api';

export default function QuizView({ currentDoc, onQuizComplete }) {
  const concepts = currentDoc?.concepts || [];
  const [selectedConcept, setSelectedConcept] = useState(concepts[0]?.id || '');
  const [difficulty, setDifficulty] = useState('medium');
  
  // Quiz State
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confidence, setConfidence] = useState(3);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [gradingResult, setGradingResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [grading, setGrading] = useState(false);
  const [scoreHistory, setScoreHistory] = useState([]);

  const handleStartQuiz = async (overrideConceptId = null) => {
    const topicId = overrideConceptId || selectedConcept;
    if (!topicId) return;
    setLoading(true);
    setGradingResult(null);
    setQuestions([]);
    setCurrentIndex(0);
    setScoreHistory([]);

    try {
      const res = await generateQuiz(topicId, difficulty);
      setQuestions(res.questions || []);
    } catch (err) {
      alert('Error generating adaptive quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleGrade = async () => {
    if (!selectedAnswer || !questions[currentIndex]) return;
    setGrading(true);

    const currentQ = questions[currentIndex];
    try {
      const res = await gradeQuiz(currentQ.id, selectedAnswer, confidence, 4000);
      setGradingResult(res);
      setScoreHistory((prev) => [...prev, { isCorrect: res.is_correct }]);
    } catch (err) {
      alert('Error grading quiz question.');
    } finally {
      setGrading(false);
    }
  };

  const handleNext = () => {
    setGradingResult(null);
    setSelectedAnswer('');
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      if (onQuizComplete) onQuizComplete();
    }
  };

  const currentQ = questions[currentIndex];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 space-y-8 bg-background min-h-screen text-on-surface font-body-md">
      {/* Top Header Banner */}
      <div className="bg-surface-container-high border border-outline-variant/30 p-6 md:p-8 rounded-xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-primary text-base" data-icon="psychology">psychology</span>
            <span className="font-mono text-xs text-primary font-medium uppercase tracking-wide block">
              Mentra Adaptive Recall Engine
            </span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-semibold text-primary">
            Interactive Concept Recall Quiz
          </h1>
          <p className="font-body text-base text-secondary mt-1 max-w-xl">
            LLM-validated adaptive questions with confidence calibration to build long-term concept mastery.
          </p>
        </div>
      </div>

      {/* Quiz Configuration (Visual Topic Cards & Difficulty Badges) */}
      {questions.length === 0 && (
        <div className="space-y-8">
          {/* Step 1: Select Topic Card Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-md text-lg font-bold text-primary flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-mono font-bold">1</span>
                Select Target Syllabus Concept
              </h2>
              <span className="text-xs text-secondary font-label-mono">
                {concepts.length} Topics Available
              </span>
            </div>

            {concepts.length === 0 ? (
              <div className="p-8 text-center bg-surface-container-lowest border border-outline-variant/20 rounded-xl text-secondary text-xs font-label-mono">
                No concepts found. Upload a study document first.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {concepts.map((c) => {
                  const isSelected = selectedConcept === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedConcept(c.id)}
                      className={`p-5 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-3 relative group ${
                        isSelected
                          ? 'bg-surface-container-lowest border-primary ring-2 ring-primary/20 shadow-md translate-y-[-2px]'
                          : 'bg-surface-container-lowest border-outline-variant/30 hover:border-primary/40 hover:bg-surface-container-high'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="material-symbols-outlined text-primary text-xl" data-icon="menu_book">
                          menu_book
                        </span>
                        <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs transition-all ${
                          isSelected ? 'bg-primary border-primary text-surface font-bold' : 'border-outline-variant/40 text-transparent'
                        }`}>
                          ✓
                        </span>
                      </div>

                      <div>
                        <h3 className="font-bold text-sm text-primary line-clamp-1 font-headline-md">
                          {c.name}
                        </h3>
                        <p className="text-xs text-secondary line-clamp-2 mt-1 font-body-md leading-relaxed">
                          {c.summary || 'Core pedagogical concept extracted from syllabus notes.'}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-outline-variant/15 flex items-center justify-between text-[11px] font-label-mono">
                        <span className="text-secondary">Prereqs: {c.suggested_prerequisites?.length || 0}</span>
                        <span className={`font-bold ${isSelected ? 'text-primary' : 'text-secondary'}`}>
                          {isSelected ? 'Selected' : 'Click to Select'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Target Difficulty Selector Badges */}
          <div className="space-y-4 pt-4 border-t border-outline-variant/20">
            <h2 className="font-headline-md text-lg font-bold text-primary flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-mono font-bold">2</span>
              Select Target Difficulty Level
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { id: 'easy', label: 'Easy (Foundational)', desc: 'Basic definitions & key terminology recall', color: 'border-emerald-500/40 text-emerald-700 bg-emerald-50/50' },
                { id: 'medium', label: 'Medium (Conceptual)', desc: 'Workflow mechanics & application questions', color: 'border-amber-500/40 text-amber-700 bg-amber-50/50' },
                { id: 'hard', label: 'Hard (Advanced)', desc: 'Analytical & comparative questions', color: 'border-rose-500/40 text-rose-700 bg-rose-50/50' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    difficulty === d.id
                      ? `${d.color} ring-2 ring-primary/20 shadow-xs font-bold`
                      : 'bg-surface-container-lowest border-outline-variant/30 text-secondary hover:bg-surface-container-high'
                  }`}
                >
                  <div className="font-bold text-xs font-label-mono mb-1">{d.label}</div>
                  <div className="text-[11px] font-body-md opacity-80">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Launch Quiz CTA */}
          <button
            onClick={() => handleStartQuiz()}
            disabled={loading || !selectedConcept}
            className="w-full py-4 bg-primary text-surface font-label-mono text-xs uppercase tracking-wider font-bold rounded-xl hover:opacity-95 transition-all shadow-md active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-base animate-spin" data-icon="sync">sync</span>
                <span>Generating Validated Quiz...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base" data-icon="play_arrow">play_arrow</span>
                <span>Generate & Start Adaptive Quiz</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Active Question Cards & Confidence Slider */}
      {questions.length > 0 && currentQ && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
          {/* Progress Header */}
          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-4 font-label-mono text-xs">
            <span className="font-bold text-primary">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <div className="flex items-center gap-2">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-full transition-all ${
                    idx === currentIndex
                      ? 'bg-primary ring-2 ring-primary/30 scale-110'
                      : scoreHistory[idx]
                      ? scoreHistory[idx].isCorrect
                        ? 'bg-mastery-sage'
                        : 'bg-alert-clay'
                      : 'bg-outline-variant/40'
                  }`}
                />
              ))}
            </div>
          </div>

          <h2 className="font-headline-md text-lg md:text-xl font-bold text-primary leading-relaxed">
            {currentQ.question_text}
          </h2>

          {/* Options Grid */}
          <div className="space-y-3">
            {JSON.parse(typeof currentQ.options === 'string' ? currentQ.options : JSON.stringify(currentQ.options)).map(
              (opt, idx) => (
                <button
                  key={idx}
                  disabled={!!gradingResult}
                  onClick={() => setSelectedAnswer(opt)}
                  className={`w-full text-left p-4 rounded-xl text-xs font-body-md border transition-all flex items-start gap-3 ${
                    selectedAnswer === opt
                      ? 'bg-primary text-surface border-primary font-bold shadow-xs'
                      : 'bg-surface-container-low border-outline-variant/30 text-on-surface hover:bg-surface-container-high'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-full text-[11px] font-mono font-bold flex items-center justify-center shrink-0 border ${
                    selectedAnswer === opt ? 'bg-surface/20 text-surface border-surface/30' : 'bg-surface text-primary border-outline-variant/30'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  <span className="mt-0.5 leading-relaxed">{opt}</span>
                </button>
              )
            )}
          </div>

          {/* Stated Confidence Slider */}
          {!gradingResult && (
            <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl space-y-2">
              <div className="flex items-center justify-between font-label-mono text-xs">
                <span className="text-secondary font-bold">State Your Confidence Level:</span>
                <span className="text-primary font-bold">{confidence} / 5 ({confidence >= 4 ? 'High' : confidence >= 3 ? 'Medium' : 'Low'})</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={confidence}
                onChange={(e) => setConfidence(parseInt(e.target.value))}
                className="w-full text-primary accent-primary cursor-pointer"
              />
            </div>
          )}

          {!gradingResult && (
            <button
              onClick={handleGrade}
              disabled={!selectedAnswer || grading}
              className="w-full py-4 bg-primary text-surface font-label-mono text-xs uppercase tracking-wider font-bold rounded-xl hover:opacity-95 transition-all shadow-md active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {grading ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin" data-icon="sync">sync</span>
                  <span>Evaluating Answer...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base" data-icon="check_circle">check_circle</span>
                  <span>Submit Answer ➔</span>
                </>
              )}
            </button>
          )}

          {/* Diagnosis Box */}
          <AnimatePresence>
            {gradingResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`p-6 border rounded-xl space-y-4 transition-colors duration-300 ${
                  gradingResult.is_correct
                    ? 'bg-mastery-sage/10 border-mastery-sage/30'
                    : 'bg-alert-clay/10 border-alert-clay/30'
                }`}
              >
                <div className="flex items-center justify-between font-label-mono text-xs">
                  <span
                    className={`font-bold px-3 py-1 rounded-full text-xs flex items-center gap-1.5 transition-all ${
                      gradingResult.is_correct
                        ? 'bg-mastery-sage/20 text-mastery-sage border border-mastery-sage/40'
                        : 'bg-alert-clay/20 text-alert-clay border border-alert-clay/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {gradingResult.is_correct ? 'check' : 'error'}
                    </span>
                    <span>{gradingResult.is_correct ? 'Correct Answer ✓' : 'Incorrect Answer'}</span>
                  </span>

                  {gradingResult.mastery && (
                    <span className="text-secondary font-label-mono">
                      Updated Mastery Score: <strong className="text-primary">{gradingResult.mastery.score}</strong>
                    </span>
                  )}
                </div>

                {!gradingResult.is_correct && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                    className="space-y-3 font-body-md text-xs overflow-hidden"
                  >
                    <div className="p-4 bg-surface border border-alert-clay/30 rounded-lg text-alert-clay">
                      <p className="font-label-mono font-bold mb-1 uppercase tracking-wider text-[11px]">
                        Misconception Explanation:
                      </p>
                      <p className="leading-relaxed">{gradingResult.misconception_explanation}</p>
                    </div>

                    {gradingResult.followup_question && (
                      <div className="p-4 bg-surface border border-outline-variant/30 rounded-lg text-primary">
                        <p className="font-label-mono font-bold mb-1 uppercase tracking-wider text-[11px]">
                          Reinforcement Question:
                        </p>
                        <p className="leading-relaxed">{gradingResult.followup_question}</p>
                      </div>
                    )}
                  </motion.div>
                )}

                <button
                  onClick={handleNext}
                  className="w-full py-3.5 bg-primary text-surface font-label-mono text-xs uppercase tracking-wider font-bold rounded-xl hover:opacity-90 transition-all shadow-md active:scale-[0.98]"
                >
                  {currentIndex + 1 < questions.length ? 'Next Question ➔' : 'Complete Quiz & View Mastery'}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
