import { useState, useCallback } from "react";

const FLOW_URL =
  "https://defaultd3d38dfff85c4026842dc215eb6b35.60.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/d24e663cdc9f421bac26fde7d50daf16/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=I14RCy0kXmzmPSbGtHsIPcTuaKZXh-X4xFDDv92hd6M";

export default function FeedbackSection() {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(FLOW_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (response.status === 200 || response.status === 201) {
        const data = await response.json();
        setFeedback(data);
      } else if (response.status === 202) {
        setError("Flow triggered (202). Add a Response action in Power Automate to return data.");
      } else {
        setError(`Unexpected status: ${response.status}`);
      }
      setLastFetched(new Date());
    } catch (err) {
      setError(`Failed to fetch: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Tre.se Feedback</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Customer feedback collected from tre.se
          </p>
        </div>
        <button
          onClick={fetchFeedback}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          {loading ? (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          )}
          {loading ? "Fetching..." : "Fetch Latest"}
        </button>
      </div>

      {lastFetched && (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">
          Last fetched: {lastFetched.toLocaleTimeString()}
        </p>
      )}

      {error && (
        <div className="mb-3 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
        {!feedback && !loading && !error && (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
            Click "Fetch Latest" to load feedback
          </div>
        )}

        {feedback && Array.isArray(feedback) && (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {feedback.map((item, idx) => (
              <div key={idx} className="px-4 py-3">
                {item.title && <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.title}</p>}
                {item.content && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{item.content}</p>}
                {item.date && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{item.date}</p>}
                {item.rating && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Rating: {item.rating}</p>}
                {!item.title && !item.content && (
                  <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{JSON.stringify(item, null, 2)}</pre>
                )}
              </div>
            ))}
          </div>
        )}

        {feedback && !Array.isArray(feedback) && (
          <div className="p-4">
            <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{JSON.stringify(feedback, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
