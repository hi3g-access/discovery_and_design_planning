import { useState, useCallback } from "react";

const FLOW_URL =
  "https://defaultd3d38dfff85c4026842dc215eb6b35.60.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/d24e663cdc9f421bac26fde7d50daf16/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=I14RCy0kXmzmPSbGtHsIPcTuaKZXh-X4xFDDv92hd6M";

export default function FeedbackSection() {
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [manualFeedback, setManualFeedback] = useState([]);
  const [pastedText, setPastedText] = useState("");
  const [selectedTags, setSelectedTags] = useState([]);
  const [customTag, setCustomTag] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const predefinedTags = [
    "Account Management",
    "Sorting/Filtering",
    "UI/UX",
    "Performance",
    "Bug",
    "Feature Request",
    "Other"
  ];

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

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addManualFeedback = () => {
    if (!pastedText.trim()) return;

    const tags = [...selectedTags];
    if (customTag.trim()) {
      tags.push(customTag.trim());
    }

    const newFeedback = {
      content: pastedText.trim(),
      tags,
      date: new Date().toISOString(),
      source: "manual",
    };

    setManualFeedback((prev) => [newFeedback, ...prev]);
    setPastedText("");
    setSelectedTags([]);
    setCustomTag("");
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Feedback</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Customer feedback from multiple sources
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Feedback
          </button>
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

      {showAddForm && (
        <div className="mb-3 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Add Feedback</h3>
          
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste feedback text here..."
            className="w-full h-24 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none mb-3"
          />

          <div className="mb-3">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              Tags (select all that apply)
            </label>
            <div className="flex flex-wrap gap-2">
              {predefinedTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                    selectedTags.includes(tag)
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 block">
              Custom Tag (optional)
            </label>
            <input
              type="text"
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Enter custom tag..."
              className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => {
                setShowAddForm(false);
                setPastedText("");
                setSelectedTags([]);
                setCustomTag("");
              }}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={addManualFeedback}
              disabled={!pastedText.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add Feedback
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
        {!feedback && !loading && !error && manualFeedback.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
            Click "Add Feedback" to manually add feedback or "Fetch Latest" to load from Power Automate
          </div>
        )}

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {manualFeedback.map((item, idx) => (
            <div key={`manual-${idx}`} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap flex-1">
                  {item.content}
                </p>
              </div>
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {item.tags.map((tag, tagIdx) => (
                    <span
                      key={tagIdx}
                      className="px-2 py-0.5 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {new Date(item.date).toLocaleString()}
                </p>
                <span className="px-1.5 py-0.5 text-[9px] rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                  Manual
                </span>
              </div>
            </div>
          ))}

          {feedback && Array.isArray(feedback) && feedback.map((item, idx) => (
            <div key={`fetched-${idx}`} className="px-4 py-3">
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

        {feedback && !Array.isArray(feedback) && (
          <div className="p-4">
            <pre className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{JSON.stringify(feedback, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
