import React from 'react';

export default function LoadingIndicator({ text = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 p-6 text-xs font-label-mono text-primary animate-in fade-in duration-200">
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-2 h-2 rounded-full bg-primary animate-bounce"></span>
      </div>
      <span className="font-semibold tracking-wide">{text}</span>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-surface-container-low border border-outline-variant/20 rounded-2xl w-fit">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-1.5 h-1.5 rounded-full bg-secondary/60 animate-bounce"></span>
    </div>
  );
}
