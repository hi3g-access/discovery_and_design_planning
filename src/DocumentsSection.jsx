import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import mammoth from "mammoth";

const BASE_PATH = import.meta.env.BASE_URL + "documents/";
const STORAGE_KEY = "documentSections";

// Section definitions
const SECTIONS = [
  { id: 1, key: "s1", label: "Interview", color: "light", borderColor: "border-l-slate-300" },
  { id: 2, key: "s2", labelDK: "Portal Demo (DK prior portal)", labelSE: "Portal Demo (SE prior portal - Mitt3)", color: "medium", borderColor: "border-l-slate-400" },
  { id: 3, key: "s3", label: "Prototype Test", color: "dark", borderColor: "border-l-slate-500" },
];

// Heuristic keywords for auto-detection
const SECTION2_KEYWORDS = [
  "admin portal", "go into the", "share my screen", "let me show",
  "log in to the portal", "current portal", "log into the",
  "show me how you", "screen share", "let me share", "share screen",
  "walk me through", "show us how", "open the portal",
];
const SECTION3_KEYWORDS = [
  "prototype", "new solution", "share the link", "figma",
  "new design", "user test", "look at the new", "early version",
  "test the new", "new portal", "redesign", "mock", "wireframe",
];

function getSectionLabel(sectionDef, market) {
  if (sectionDef.id === 2) return market === "DK" ? sectionDef.labelDK : sectionDef.labelSE;
  return sectionDef.label;
}

function loadSections() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveSections(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function parseHtmlToParagraphs(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements = doc.body.children;
  const paragraphs = [];
  for (let i = 0; i < elements.length; i++) {
    paragraphs.push(elements[i].outerHTML);
  }
  return paragraphs;
}

function extractText(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

function detectSections(paragraphs) {
  let section2Start = null;
  let section3Start = null;

  // Skip the first ~15 paragraphs for section 2 detection (intro/greetings)
  const minSection2Start = Math.min(15, Math.floor(paragraphs.length * 0.1));
  const minSection3Start = (idx) => idx + 10; // Section 3 must be at least 10 paragraphs after section 2

  for (let i = minSection2Start; i < paragraphs.length; i++) {
    const text = extractText(paragraphs[i]).toLowerCase();
    if (section2Start === null) {
      for (const kw of SECTION2_KEYWORDS) {
        if (text.includes(kw)) { section2Start = i; break; }
      }
    }
    if (section2Start !== null && section3Start === null && i >= minSection3Start(section2Start)) {
      for (const kw of SECTION3_KEYWORDS) {
        if (text.includes(kw)) { section3Start = i; break; }
      }
    }
    if (section2Start !== null && section3Start !== null) break;
  }

  return { section2Start, section3Start };
}

function getSectionForParagraph(idx, boundaries) {
  const { section2Start, section3Start } = boundaries;
  if (section3Start !== null && idx >= section3Start) return 3;
  if (section2Start !== null && idx >= section2Start) return 2;
  return 1;
}

export default function DocumentsSection() {
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docContent, setDocContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMarket, setFilterMarket] = useState("all");
  const [sections, setSections] = useState(loadSections);
  const [contextMenu, setContextMenu] = useState(null); // { idx, x, y }
  const readerRef = useRef(null);
  const sectionRefs = useRef({});

  useEffect(() => {
    fetch(BASE_PATH + "manifest.json")
      .then((r) => r.json())
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, []);

  const paragraphs = useMemo(() => {
    if (!docContent) return [];
    return parseHtmlToParagraphs(docContent);
  }, [docContent]);

  // Get or auto-detect boundaries for current doc
  const boundaries = useMemo(() => {
    if (!selectedDoc || paragraphs.length === 0) return { section2Start: null, section3Start: null };
    const stored = sections[selectedDoc.id];
    if (stored) return stored;
    // Auto-detect
    const detected = detectSections(paragraphs);
    return detected;
  }, [selectedDoc, paragraphs, sections]);

  const loadDocument = useCallback(async (doc) => {
    setSelectedDoc(doc);
    setLoading(true);
    setContextMenu(null);
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

  const setBoundary = useCallback((sectionNum, paragraphIdx) => {
    if (!selectedDoc) return;
    const current = sections[selectedDoc.id] || { ...boundaries };
    const updated = { ...current };
    if (sectionNum === 2) {
      updated.section2Start = paragraphIdx;
      // Ensure section3 is after section2
      if (updated.section3Start !== null && updated.section3Start <= paragraphIdx) {
        updated.section3Start = null;
      }
    } else if (sectionNum === 3) {
      updated.section3Start = paragraphIdx;
      // Ensure section2 is before section3
      if (updated.section2Start === null || updated.section2Start >= paragraphIdx) {
        updated.section2Start = Math.max(0, paragraphIdx - 1);
      }
    }
    const newSections = { ...sections, [selectedDoc.id]: updated };
    setSections(newSections);
    saveSections(newSections);
    setContextMenu(null);
  }, [selectedDoc, sections, boundaries]);

  const handleParagraphClick = useCallback((e, idx) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setContextMenu({ idx, x: rect.right + 8, y: rect.top });
  }, []);

  const scrollToSection = useCallback((sectionNum) => {
    const el = sectionRefs.current[sectionNum];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const filteredDocs = documents.filter((d) => {
    if (filterMarket !== "all" && d.market !== filterMarket) return false;
    if (searchTerm && !d.label.toLowerCase().includes(searchTerm.toLowerCase()) && !d.company.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  const markets = [...new Set(documents.map((d) => d.market))];

  const hasSections = boundaries.section2Start !== null || boundaries.section3Start !== null;

  // Build rendered content with section dividers
  const renderContent = () => {
    if (paragraphs.length === 0) return null;
    const items = [];
    let lastSection = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const currentSection = getSectionForParagraph(i, boundaries);

      // Insert section divider when section changes
      if (currentSection !== lastSection) {
        const sectionDef = SECTIONS[currentSection - 1];
        const anchorId = `${selectedDoc.id}-s${currentSection}`;
        const label = getSectionLabel(sectionDef, selectedDoc.market);
        const bgColors = { light: "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700", medium: "bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-600", dark: "bg-slate-150 dark:bg-slate-800/80 border-slate-400 dark:border-slate-500" };
        items.push(
          <div
            key={`divider-${currentSection}`}
            id={anchorId}
            ref={(el) => { sectionRefs.current[currentSection] = el; }}
            className={`flex items-center gap-2 px-3 py-2 my-3 rounded-md border ${bgColors[sectionDef.color]} sticky top-0 z-10`}
          >
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">§{currentSection}</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
            <span className="ml-auto text-[9px] text-slate-400">¶{i}</span>
          </div>
        );
        lastSection = currentSection;
      }

      // Render paragraph with section color coding
      const sectionDef = SECTIONS[currentSection - 1];
      items.push(
        <div
          key={`p-${i}`}
          className={`border-l-2 ${sectionDef.borderColor} pl-3 py-0.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group relative`}
          onClick={(e) => handleParagraphClick(e, i)}
        >
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_p]:mb-0 [&_h1]:text-base [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:mb-1 [&_table]:text-xs"
            dangerouslySetInnerHTML={{ __html: paragraphs[i] }}
          />
          <span className="absolute right-1 top-1 text-[8px] text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">¶{i}</span>
        </div>
      );
    }

    return items;
  };

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
            {filteredDocs.map((doc) => {
              const docSections = sections[doc.id];
              const hasStored = docSections && (docSections.section2Start !== null || docSections.section3Start !== null);
              return (
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
                  {hasStored && <span className="ml-1 text-[9px] text-green-500" title="Sections set">●</span>}
                </button>
              );
            })}
            {filteredDocs.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-400 text-center">No documents found</p>
            )}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">{documents.length} documents</p>
        </div>

        {/* Document reader */}
        <div ref={readerRef} className="flex-1 min-w-0 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 overflow-y-auto relative">
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
              {/* Document header with section jump buttons */}
              <div className="mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{selectedDoc.label}</h3>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{selectedDoc.filename}</span>
                  </div>
                  {hasSections && (
                    <div className="flex gap-1">
                      <button onClick={() => scrollToSection(1)} className="px-2 py-1 text-[10px] font-medium rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60 transition-colors" title="Jump to Interview section">§1</button>
                      {boundaries.section2Start !== null && (
                        <button onClick={() => scrollToSection(2)} className="px-2 py-1 text-[10px] font-medium rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors" title="Jump to Portal Demo section">§2</button>
                      )}
                      {boundaries.section3Start !== null && (
                        <button onClick={() => scrollToSection(3)} className="px-2 py-1 text-[10px] font-medium rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors" title="Jump to Prototype Test section">§3</button>
                      )}
                    </div>
                  )}
                </div>
                {!hasSections && paragraphs.length > 0 && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">⚠ No section boundaries detected — click any paragraph to set them</p>
                )}
              </div>

              {/* Rendered paragraphs with section dividers */}
              <div className="space-y-0.5">
                {renderContent()}
              </div>
            </div>
          )}

          {/* Context menu for setting section boundaries */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-lg py-1 min-w-[180px]"
              style={{ left: Math.min(contextMenu.x, window.innerWidth - 200), top: contextMenu.y }}
            >
              <div className="px-3 py-1 text-[10px] text-slate-400 border-b border-slate-100 dark:border-slate-700">
                Paragraph ¶{contextMenu.idx}
              </div>
              <button
                onClick={() => setBoundary(2, contextMenu.idx)}
                className="w-full text-left px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
              >
                Set as §2 start ({selectedDoc?.market === "DK" ? "Portal Demo DK" : "Portal Demo Mitt3"})
              </button>
              <button
                onClick={() => setBoundary(3, contextMenu.idx)}
                className="w-full text-left px-3 py-1.5 text-xs text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
              >
                Set as §3 start (Prototype Test)
              </button>
              <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1">
                <button
                  onClick={() => setContextMenu(null)}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close context menu when clicking outside */}
      {contextMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
      )}
    </div>
  );
}
