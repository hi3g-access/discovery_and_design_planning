import { useState, useEffect, useRef } from "react";

// Loading Indicator Component
const LoadingIndicator = ({ message = "Processing...", className = "" }) => {
  return (
    <>
      <style>{`
        @keyframes shimmer-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
      <div className={`w-full py-2 ${className}`}>
        <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
          {message}
        </div>
        <div className="relative h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="absolute h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-400 dark:via-indigo-500 to-transparent"
            style={{
              animation: 'shimmer-slide 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    </>
  );
};

export default function TaskChat({ 
  language,
  chatMessages,
  setChatMessages,
  chatLoading,
  githubAIKey,
  setGitHubAIKey,
  appMode,
  sendChatMessage,
  handleApplyProposal,
  chatEndRef,
  translations
}) {
  const t = (translations[language] || translations.en).chat;
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading, chatEndRef]);

  const handleSend = () => {
    const msg = inputValue.trim();
    if (!msg || chatLoading) return;
    setInputValue("");
    sendChatMessage(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!githubAIKey) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-[260px]">
          <svg className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.noKey}</p>
          <input
            type="password"
            placeholder="ghp_... or github_pat_..."
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-600"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                setGitHubAIKey(e.target.value.trim());
                localStorage.setItem("githubAIKey", e.target.value.trim());
              }
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) {
                setGitHubAIKey(e.target.value.trim());
                localStorage.setItem("githubAIKey", e.target.value.trim());
              }
            }}
          />
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Press Enter to save. Needs <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">models:read</code> scope.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {chatMessages.length === 0 && (
          <div className="text-xs text-slate-400 dark:text-slate-500 text-center mt-8 leading-relaxed px-2">
            {appMode === "discovery" ? (
              <div className="space-y-2">
                <p className="font-medium text-slate-500 dark:text-slate-400">Discovery Assistant</p>
                <p>Ask me to help you find opportunities, suggest table rows, or refine your Opportunity Solution Tree.</p>
                <div className="mt-3 text-left space-y-1 text-[10px] text-slate-400 dark:text-slate-500">
                  <p className="font-medium text-slate-500 dark:text-slate-400 mb-1">Try:</p>
                  <p>"What opportunities might exist for this outcome?"</p>
                  <p>"Suggest interview questions for discovery"</p>
                  <p>"Help me prioritize these opportunities"</p>
                </div>
              </div>
            ) : t.placeholder}
          </div>
        )}
        {chatMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
              msg.role === 'user'
                ? 'bg-slate-800 dark:bg-slate-600 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
            }`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {/* Proposal cards */}
              {msg.proposals && msg.proposals.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.proposals.map((proposal, idx) => {
                    // Human-readable labels for discovery table columns
                    const colLabels = { col_opp: "Opportunity", col_rprio: "Priority", col_iprio: "Impact", col_obj: "Objective", col_about: "About", col_impact: "Impact area", col_dk: "DK evidence", col_se: "SE evidence", col_proto: "Prototype", col_b2b: "B2B context", col_sol: "Solution idea", col_exp: "Experiment" };
                    const isDiscoveryRow = proposal.field === "_addRow" && proposal.section === "discoveryTable";
                    const friendlyTitle = isDiscoveryRow ? "Add row to table" : proposal.field === "_add" ? "Add item" : `Update ${proposal.field}`;

                    return (
                    <div key={idx} className={`rounded-md border p-2 ${
                      proposal.applied
                        ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30'
                        : 'border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] uppercase tracking-wide font-semibold text-blue-600 dark:text-blue-400 mb-1">{friendlyTitle}</div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 rounded p-1.5 border border-slate-200 dark:border-slate-600 whitespace-pre-wrap break-words">
                            {isDiscoveryRow && typeof proposal.value === 'object' ? (
                              <div className="space-y-1">
                                {Object.entries(proposal.value).map(([key, val]) => val ? (
                                  <div key={key}><span className="font-medium text-slate-700 dark:text-slate-300">{colLabels[key] || key}:</span> {val}</div>
                                ) : null)}
                              </div>
                            ) : typeof proposal.value === 'string' ? proposal.value : JSON.stringify(proposal.value, null, 2)}
                          </div>
                          {proposal.reason && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic">{proposal.reason}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {proposal.applied ? (
                          <span className="text-[10px] font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {t.applied}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApplyProposal(msg.id, idx)}
                              className="px-2 py-0.5 text-[10px] font-medium bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                            >
                              {t.accept}
                            </button>
                            <button
                              onClick={() => {
                                setChatMessages(prev => prev.map(m => {
                                  if (m.id !== msg.id || !m.proposals) return m;
                                  const newProposals = m.proposals.filter((_, i) => i !== idx);
                                  return { ...m, proposals: newProposals.length > 0 ? newProposals : null };
                                }));
                              }}
                              className="px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                              {t.reject}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 min-w-[200px]">
              <LoadingIndicator message="AI is thinking..." className="py-1" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              // Auto-resize
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKeyDown}
            placeholder={t.placeholder}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || chatLoading}
            className="px-3 py-2 bg-slate-800 dark:bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700 dark:hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            title={t.send}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
