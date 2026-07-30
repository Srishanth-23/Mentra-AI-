import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { analyzeSpokenModel } from '../api';
import LoadingIndicator from './LoadingIndicator';

export default function SpeakYourModelView({ currentDoc, concept, onBack, onNavigateTab }) {
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(90);
  const [transcript, setTranscript] = useState('');
  const [speechSupported, setSpeechSupported] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [speakingTTS, setSpeakingTTS] = useState(false);

  const recognitionRef = useRef(null);
  const timerIntervalRef = useRef(null);

  useEffect(() => {
    // Check browser Web Speech API support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const startRecording = () => {
    if (!speechSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    let finalTranscriptText = '';

    recognitionRef.current.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscriptText += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscriptText + interim);
    };

    recognitionRef.current.onerror = (err) => {
      console.error("Speech recognition error:", err);
    };

    recognitionRef.current.start();
    setIsRecording(true);
    setTimer(90);

    timerIntervalRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setIsRecording(false);
  };

  const handleAnalyze = async () => {
    if (!transcript.trim() || analyzing || !concept || !currentDoc) return;
    setAnalyzing(true);
    try {
      const res = await analyzeSpokenModel(currentDoc.document_id, concept.id, transcript.trim());
      setAnalysisResult(res);

      // Trigger browser native TTS read-aloud of summary
      speakTTSFeedback(res);
    } catch (err) {
      console.error("Error analyzing spoken model:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const speakTTSFeedback = (res) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const textToSpeak = `Your spoken explanation for ${concept?.name} was rated ${res.overall_tier}. ` +
      (res.accurate_points?.length ? `Key accurate points: ${res.accurate_points.join('. ')}. ` : '') +
      (res.gaps_or_errors?.length ? `Areas to refine: ${res.gaps_or_errors.join('. ')}.` : '');

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = 1.0;
    utterance.onend = () => setSpeakingTTS(false);
    utterance.onerror = () => setSpeakingTTS(false);

    setSpeakingTTS(true);
    window.speechSynthesis.speak(utterance);
  };

  const stopTTS = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeakingTTS(false);
    }
  };

  return (
    <div className="max-w-[900px] mx-auto px-4 py-6 space-y-6 font-body-md min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Top Header Bar */}
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
              <span className="material-symbols-outlined text-primary text-xl" data-icon="mic">mic</span>
              <span>Speak Your Model: {concept?.name}</span>
            </h2>
          </div>

          <span className="font-mono text-xs text-secondary">
            Voice-Driven Calibration
          </span>
        </div>

        {/* Browser Speech Compatibility Notice */}
        {!speechSupported && (
          <div className="p-3 bg-alert-clay/10 border border-alert-clay/30 rounded-lg text-xs font-mono text-alert-clay flex items-center gap-2">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>Voice input isn't supported in this browser — try Chrome or Edge to record audio live. You can still type your explanation below to test calibration.</span>
          </div>
        )}
      </div>

      {/* Recording Canvas & Controls */}
      <div className="bg-surface-container-lowest border border-outline-variant/30 p-8 rounded-xl space-y-6 shadow-xs text-center flex flex-col items-center justify-center">
        {/* Animated Waveform Amplitude Bar */}
        <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-xs">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`w-2.5 rounded-full transition-all duration-300 ${
                isRecording
                  ? 'bg-primary animate-pulse'
                  : 'bg-surface-container-high'
              }`}
              style={{
                height: isRecording ? `${Math.floor(Math.random() * 40) + 16}px` : '12px',
                animationDelay: `${i * 120}ms`
              }}
            />
          ))}
        </div>

        {/* Record / Stop Button */}
        <div className="space-y-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={!speechSupported && !transcript}
              className="w-20 h-20 rounded-full bg-primary text-surface hover:brightness-110 flex items-center justify-center shadow-lg transition-all active:scale-95 mx-auto"
              title="Start Recording (90s max)"
            >
              <span className="material-symbols-outlined text-3xl">mic</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-alert-clay text-white hover:brightness-110 flex items-center justify-center shadow-lg transition-all active:scale-95 mx-auto animate-pulse"
              title="Stop Recording"
            >
              <span className="material-symbols-outlined text-3xl">stop</span>
            </button>
          )}

          <div className="font-mono text-xs text-secondary font-medium">
            {isRecording ? `Recording... ${timer}s remaining` : 'Click microphone to explain out loud (90s max)'}
          </div>
        </div>

        {/* Live Transcript Display Box */}
        <div className="w-full text-left space-y-2">
          <label className="font-mono text-xs text-secondary font-medium uppercase tracking-wide block">
            Transcript (Web Speech Native):
          </label>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your spoken words will appear here automatically..."
            rows={4}
            className="w-full p-4 rounded-xl border border-outline-variant/30 bg-surface-container-low text-base font-body text-on-surface outline-none resize-none"
          />
        </div>

        {!analysisResult && (
          <div className="w-full max-w-sm">
            {analyzing ? (
              <LoadingIndicator text="Analyzing Spoken Explanation..." />
            ) : (
              <button
                onClick={handleAnalyze}
                disabled={!transcript.trim()}
                className="w-full py-3 bg-primary text-surface rounded-xl font-body font-medium text-sm hover:opacity-90 active:scale-95 disabled:opacity-40 transition-all shadow-md flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">analytics</span>
                <span>Analyze Spoken Model ➔</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Analysis Results Card */}
      {analysisResult && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 p-6 rounded-xl space-y-4 shadow-md animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-3">
            <h3 className="font-heading text-xl font-semibold text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-primary" data-icon="psychology">psychology</span>
              <span>Mental Model Calibration Results</span>
            </h3>

            <div className="flex items-center gap-3">
              <span className={`mentra-badge ${
                analysisResult.overall_tier === 'Strong'
                  ? 'bg-mastery-sage/20 text-mastery-sage border border-mastery-sage/40'
                  : analysisResult.overall_tier === 'Partial'
                  ? 'bg-surface-container-high text-primary border border-outline-variant/30'
                  : 'bg-alert-clay/10 text-alert-clay border border-alert-clay/30'
              }`}>
                {analysisResult.overall_tier} Tier
              </span>

              {speakingTTS ? (
                <button
                  onClick={stopTTS}
                  className="px-3 py-1 bg-alert-clay/20 text-alert-clay font-label-mono text-xs font-bold rounded flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">volume_off</span>
                  <span>Stop Voice</span>
                </button>
              ) : (
                <button
                  onClick={() => speakTTSFeedback(analysisResult)}
                  className="px-3 py-1 bg-surface-container-high hover:bg-surface-container-highest font-label-mono text-xs font-bold text-primary rounded border border-outline-variant/30 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">volume_up</span>
                  <span>Listen TTS</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-body-md">
            {/* Accurate Points */}
            <div className="p-4 bg-mastery-sage/10 border border-mastery-sage/25 rounded-lg space-y-2">
              <h4 className="font-label-mono font-bold text-mastery-sage uppercase text-[11px] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>Accurate & Well-Grounded</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-on-surface text-xs leading-relaxed">
                {analysisResult.accurate_points?.map((pt, i) => (
                  <li key={i}>{pt}</li>
                ))}
              </ul>
            </div>

            {/* Gaps or Errors */}
            <div className="p-4 bg-surface-container-low border border-outline-variant/20 rounded-lg space-y-2">
              <h4 className="font-label-mono font-bold text-secondary uppercase text-[11px] flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">error_outline</span>
                <span>Areas to Refine</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-on-surface text-xs leading-relaxed">
                {analysisResult.gaps_or_errors?.length > 0 ? (
                  analysisResult.gaps_or_errors.map((gap, i) => <li key={i}>{gap}</li>)
                ) : (
                  <li className="italic text-secondary">No significant gaps detected!</li>
                )}
              </ul>
            </div>
          </div>

          {/* Basis & Edge Updates */}
          {analysisResult.mastery_boost_applied > 0 && (
            <div className="p-4 bg-surface-container-low border border-outline-variant/25 rounded-lg space-y-2 font-label-mono text-xs">
              <div className="flex items-center gap-2 text-primary font-bold">
                <span className="material-symbols-outlined text-base">trending_up</span>
                <span>Mastery Boost Applied (+{analysisResult.mastery_boost_applied})</span>
              </div>
              <p className="text-[11px] text-secondary leading-normal">
                {analysisResult.basis_string}
              </p>
              <button
                onClick={() => onNavigateTab && onNavigateTab('concepts')}
                className="text-[11px] text-primary underline font-bold hover:opacity-80 transition-opacity block pt-1"
              >
                Prerequisite edge strengthened in Your View ➔
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
