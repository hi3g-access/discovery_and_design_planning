import { useState, useEffect, useCallback } from "react";
import mammoth from "mammoth";

const BASE_PATH = import.meta.env.BASE_URL + "documents/";

export default function DocumentsSection() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docContent, setDocContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMarket, setFilterMarket] = useState("all");

  useEffect(() => {
    fetch(BASE_PATH + "manifest.json")
      .then((r) => r.json())
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  const loadDocument = useCallback(async (doc) => {
    setSelectedDoc(doc);
    setLoading(true);
    try {
      const response = await fetch(BASE_PATH + doc.filename);
      const arrayBuffer = await response.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer });
      setDocContent(result.value);
    } catch (e) {
      setDocContent("<p class='text-red-500'>Failed to load document.</p>");
    }
    setLoading(false);
  }, []);

  const filteredDocs = documents.filter((d) => {
    if (filterMarket !== "all" && d.market !== filterMarket) return false;
    if (searchTerm && !d.label.toLowerCase().includes(searchTerm.toLowerCase()) && !d.company.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const markets = [...new Set(documents.map((d) => d.market))];

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Source Documents</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Interview transcripts and research source material.</p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Document list sidebar */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <select
              value={filterMarket}
              onChange={(e) => setFilterMarket(e.target.value)}
              className="px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">All</option>
              {markets.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800">
            {filteredDocs.map((doc) => (
              <button
                key={doc.id}
                onClick={() => loadDocument(doc)}
                className={`w-full text-left px-3 py-2.5 text-xs border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors ${
                  selectedDoc?.id === doc.id
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                }`}
              >
                <span className="inline-block w-6 text-[10px] font-medium text-slate-400 dark:text-slate-500">{doc.market}</span>
                {doc.company}
              </button>
            ))}
            {filteredDocs.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">No documents found</p>
            )}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">{documents.length} documents</p>
        </div>

        {/* Document reader */}
        <div className="flex-1 min-w-0 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-y-auto">
          {!selectedDoc ? (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
              Select a document to read
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
              Loading...
            </div>
          ) : (
            <div className="p-6">
              <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedDoc.label}</h3>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{selectedDoc.filename}</span>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_p]:mb-2 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1.5 [&_table]:text-xs [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:dark:border-slate-600 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-slate-200 [&_th]:dark:border-slate-600 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-slate-50 [&_th]:dark:bg-slate-700"
                dangerouslySetInnerHTML={{ __html: docContent }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
