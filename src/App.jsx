/**
 * WCAG 2.1 AA Accessibility Guidelines
 * 
 * This application follows WCAG 2.1 Level AA standards:
 * 
 * 1. Text Size: Minimum 14px (text-sm) for body text, with 16px preferred
 * 2. Touch Targets: Interactive elements minimum 44x44px (py-2.5+ for buttons)
 * 3. Color Contrast: 
 *    - Normal text: 4.5:1 minimum (slate-600+ on white)
 *    - Large text (18px+): 3:1 minimum (slate-500+ on white)
 * 4. Focus Indicators: Visible focus rings (ring-2, ring-slate-400+)
 * 5. Border Contrast: Borders minimum 3:1 against background (slate-300+ on white)
 * 
 * Color usage:
 * - Use slate-600/700 for primary text (not slate-400/500 for body text)
 * - Use border-slate-300+ for visible borders (not slate-100/200 for important dividers)
 * - Links should have 4.5:1 contrast (blue-600+) and underline for identification
 * 
 * UI Guidelines:
 * - Always use simple vector SVG icons (not emojis) for consistency across platforms
 * - See AudioIcon, FolderIcon, TextIcon components as examples
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import OSTCanvas from "./OSTCanvas.jsx";
import DocumentsSection from "./DocumentsSection.jsx";
import FeedbackSection from "./FeedbackSection.jsx";
import TaskChat from "./TaskChat.jsx";
import GitHubSync, { HybridStorage } from "./githubSync.js";

// --- Encryption Utilities for Secure localStorage ---
// Uses Web Crypto API to encrypt sensitive data at rest

const ENCRYPTION_KEY_NAME = "req_analyzer_key_v1";
const ENCRYPTION_SALT = "requirement-analyzer-secure-2026"; // In production, use unique per-installation salt

// Generate or retrieve encryption key
const getEncryptionKey = async () => {
  // For automatic encryption, we derive a key from a constant
  // For password-protected mode, replace this with PBKDF2 from user password
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(ENCRYPTION_SALT),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  
  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("secure-telco-mode"),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
};

// Encrypt data
const encryptData = async (data) => {
  try {
    const key = await getEncryptionKey();
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM
    
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(data)
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64 for localStorage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error("Encryption failed:", error);
    return data; // Fallback to unencrypted if encryption fails
  }
};

// Decrypt data
const decryptData = async (encryptedData) => {
  // If data is null or empty, return null
  if (!encryptedData || encryptedData.trim() === '') {
    return null;
  }
  
  try {
    const key = await getEncryptionKey();
    const decoder = new TextDecoder();
    
    // Decode from base64 with better error handling
    let combined;
    try {
      combined = new Uint8Array(
        atob(encryptedData).split('').map(char => char.charCodeAt(0))
      );
    } catch (atobError) {
      console.warn("Base64 decode failed, trying as plain JSON:", atobError);
      // Try to parse as unencrypted JSON
      try {
        JSON.parse(encryptedData);
        return encryptedData;
      } catch (jsonError) {
        console.error("Data is neither base64 nor valid JSON", jsonError);
        return null;
      }
    }
    
    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted
    );
    
    return decoder.decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    // If decryption fails, might be old unencrypted data - try to validate it
    try {
      // Test if it's valid JSON
      JSON.parse(encryptedData);
      console.log("Data appears to be unencrypted JSON, using as-is");
      return encryptedData;
    } catch (parseError) {
      console.error("Data is neither encrypted nor valid JSON", parseError);
      return null;
    }
  }
};

// Secure localStorage wrapper
const secureStorage = {
  async setItem(key, value) {
    try {
      const encrypted = await encryptData(value);
      localStorage.setItem(key, encrypted);
      console.log('[SECURE STORAGE] Saved encrypted data for key:', key);
    } catch (error) {
      console.error('[SECURE STORAGE] Failed to save:', error);
      throw error;
    }
  },
  
  async getItem(key) {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) {
        console.log('[SECURE STORAGE] No data found for key:', key);
        return null;
      }
      console.log('[SECURE STORAGE] Found data for key:', key);
      const decrypted = await decryptData(encrypted);
      if (!decrypted) {
        console.error('[SECURE STORAGE] Decryption returned null, clearing corrupted data');
        localStorage.removeItem(key);
        return null;
      }
      return decrypted;
    } catch (error) {
      console.error('[SECURE STORAGE] Failed to get, clearing corrupted data:', error);
      localStorage.removeItem(key);
      return null;
    }
  },
  
  removeItem(key) {
    localStorage.removeItem(key);
    console.log('[SECURE STORAGE] Removed key:', key);
  }
};

const generateId = () => Math.random().toString(36).slice(2, 10);

// Translation dictionaries
const TRANSLATIONS = {
  en: {
    sections: {
      overview: "Overview",
      problem: "Problem & Purpose",
      context: "User Context",
      assumptions: "Assumptions",
      edges: "Edge Cases",
      scope: "Scope & Versions",
      acceptance: "Acceptance Criteria",
      questions: "Open Questions",
      notes: "Notes",
      summary: "Summary",
      mapping: "Mapping",
      designRefs: "Design References",
      codeRefs: "Code References",
      design: "Design System",
      research: "User Research",
      wireframe: "Structure"
    },
    fields: {
      featureName: "Feature Name",
      date: "Date",
      stakeholders: "Stakeholders / Source",
      origin: "Requirement Origin",
      targetVersion: "Target Version",
      description: "Brief Description",
      problem: "What problem does this solve?",
      who: "Who experiences this problem?",
      outcome: "What's the desired business outcome?",
      metrics: "How will we measure success?",
      ifNotBuilt: "What happens if we don't build this?",
      segments: "Target user segment(s)",
      workflow: "Current workflow",
      workarounds: "Existing workarounds",
      triggers: "What triggers the need?",
      beforeAfter: "What happens before and after?",
      confidence: "Overall Confidence",
      concerns: "Key Concerns or Risks",
      nextSteps: "Next Steps",
      designSystemName: "Design System Name",
      designVersion: "Version",
      componentLibrary: "Component Library Reference",
      tokensLink: "Design Tokens Documentation",
      figmaDesignUrl: "Figma File URL",
      mcpInstructions: "Figma MCP Setup Instructions"
    },
    chat: {
      title: "AI Chat",
      actions: "Actions",
      placeholder: "Ask about this task...",
      send: "Send",
      accept: "Accept",
      reject: "Dismiss",
      thinking: "Thinking...",
      noKey: "Enter your GitHub Personal Access Token below to enable AI-powered discovery assistance.",
      secureMode: "AI Chat is disabled in secure mode.",
      proposalLabel: "Suggested change",
      applied: "Applied",
      field: "Field",
      reason: "Reason",
    }
  },
  da: {
    sections: {
      overview: "Oversigt",
      problem: "Problem & Formål",
      context: "Brugerkontekst",
      assumptions: "Antagelser",
      edges: "Særtilfælde",
      scope: "Omfang & Versioner",
      acceptance: "Acceptkriterier",
      questions: "Åbne Spørgsmål",
      noter: "Noter",
      summary: "Opsummering",
      mapping: "Kortlægning",
      designRefs: "Design Referencer",
      codeRefs: "Kode Referencer",
      design: "Design System",
      research: "Brugerundersøgelse",
      wireframe: "Struktur"
    },
    fields: {
      featureName: "Funktionsnavn",
      date: "Dato",
      stakeholders: "Interessenter / Kilde",
      origin: "Kravenes Oprindelse",
      targetVersion: "Målversion",
      description: "Kort Beskrivelse",
      problem: "Hvilket problem løser dette?",
      who: "Hvem oplever dette problem?",
      outcome: "Hvad er det ønskede forretningsmæssige resultat?",
      metrics: "Hvordan vil vi måle succes?",
      ifNotBuilt: "Hvad sker der, hvis vi ikke bygger dette?",
      segments: "Målbrugergruppe(r)",
      workflow: "Nuværende arbejdsgang",
      workarounds: "Eksisterende løsninger",
      triggers: "Hvad udløser behovet?",
      beforeAfter: "Hvad sker der før og efter?",
      confidence: "Samlet Tillid",
      concerns: "Nøglebekymringer eller Risici",
      nextSteps: "Næste Skridt",
      designSystemName: "Design System Navn",
      designVersion: "Version",
      componentLibrary: "Komponentbibliotek Reference",
      tokensLink: "Design Tokens Dokumentation",
      figmaDesignUrl: "Figma Fil URL",
      mcpInstructions: "Figma MCP Opsætningsinstruktioner"
    },
    chat: {
      title: "AI Chat",
      actions: "Handlinger",
      placeholder: "Spørg om denne opgave...",
      send: "Send",
      accept: "Acceptér",
      reject: "Afvis",
      thinking: "Tænker...",
      noKey: "Indtast dit GitHub Personal Access Token herunder for at aktivere AI-assisteret discovery.",
      secureMode: "AI Chat er deaktiveret i sikker tilstand.",
      proposalLabel: "Foreslået ændring",
      applied: "Anvendt",
      field: "Felt",
      reason: "Årsag",
    }
  },
  sv: {
    sections: {
      overview: "Översikt",
      problem: "Problem & Syfte",
      context: "Användarkontext",
      assumptions: "Antaganden",
      edges: "Specialfall",
      scope: "Omfattning & Versioner",
      acceptance: "Acceptanskriterier",
      questions: "Öppna Frågor",
      notes: "Anteckningar",
      summary: "Sammanfattning",
      mapping: "Kartläggning",
      designRefs: "Designreferenser",
      codeRefs: "Kodreferenser",
      design: "Design System",
      research: "Användarforskning",
      wireframe: "Struktur"
    },
    fields: {
      featureName: "Funktionsnamn",
      date: "Datum",
      stakeholders: "Intressenter / Källa",
      origin: "Kravursprung",
      targetVersion: "Målversion",
      description: "Kort Beskrivning",
      problem: "Vilket problem löser detta?",
      who: "Vem upplever detta problem?",
      outcome: "Vad är det önskade affärsresultatet?",
      metrics: "Hur ska vi mäta framgång?",
      ifNotBuilt: "Vad händer om vi inte bygger detta?",
      segments: "Målanvändargrupp(er)",
      workflow: "Nuvarande arbetsflöde",
      workarounds: "Befintliga lösningar",
      triggers: "Vad utlöser behovet?",
      beforeAfter: "Vad händer före och efter?",
      confidence: "Övergripande Förtroende",
      concerns: "Viktiga Bekymmer eller Risker",
      nextSteps: "Nästa Steg",
      designSystemName: "Design System Namn",
      designVersion: "Version",
      componentLibrary: "Komponentbibliotek Referens",
      tokensLink: "Design Tokens Dokumentation",
      figmaDesignUrl: "Figma Fil URL",
      mcpInstructions: "Figma MCP Installationsinstruktioner"
    },
    chat: {
      title: "AI Chatt",
      actions: "Åtgärder",
      placeholder: "Fråga om denna uppgift...",
      send: "Skicka",
      accept: "Godkänn",
      reject: "Avvisa",
      thinking: "Tänker...",
      noKey: "Ange ditt GitHub Personal Access Token nedan för att aktivera AI-driven discovery-assistans.",
      secureMode: "AI Chatt är inaktiverad i säkert läge.",
      proposalLabel: "Föreslagen ändring",
      applied: "Tillämpad",
      field: "Fält",
      reason: "Anledning",
    }
  }
};

const SECTIONS = [
  { id: "overview", label: "Overview", icon: "◉" },
  { id: "problem", label: "Problem & Purpose", icon: "◎" },
  { id: "context", label: "User Context", icon: "◈" },
  { id: "assumptions", label: "Assumptions", icon: "◇" },
  { id: "edges", label: "Edge Cases", icon: "◆" },
  { id: "scope", label: "Scope & Versions", icon: "◫" },
  { id: "acceptance", label: "Acceptance Criteria", icon: "◈" },
  { id: "questions", label: "Open Questions", icon: "◻" },
  { id: "notes", label: "Notes", icon: "◐" },
  { id: "research", label: "User Research", icon: "◎" },
  { id: "designRefs", label: "Design References", icon: "◱" },
  { id: "codeRefs", label: "Code References", icon: "◇" },
  { id: "design", label: "Design System", icon: "◆" },
  { id: "wireframe", label: "Structure", icon: "◧" },
  { id: "summary", label: "Summary", icon: "◼" },
];

const DISCOVERY_SECTIONS = [
  { id: "discoveryTable", label: "Discovery Research", icon: "◫" },
  { id: "opportunityTree", label: "Opportunity Solution Tree", icon: "◆" },
];

const DISCOVERY_SECTIONS_RIGHT = [
  { id: "sourceDocuments", label: "Research Data", icon: "◉" },
  { id: "feedback", label: "Tre.se Feedback", icon: "◈" },
];

const ORIGIN_OPTIONS = [
  "User Research", "Business Metric", "Competitor Analysis",
  "Stakeholder Request", "Technical Debt", "Legal", "Other",
];

const VERSION_PHASES = ["MVP", "V1", "V2", "V3", "Future", "Cut"];
const VERSION_COLORS = {
  MVP: { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
  V1: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  V2: { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200", dot: "bg-teal-500" },
  V3: { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
  Future: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", dot: "bg-slate-400" },
  Cut: { bg: "bg-red-50", text: "text-red-500", border: "border-red-200", dot: "bg-red-400" },
};
const PRIORITY_LEVELS = ["Must", "Should", "Could", "Won't"];

const ASSUMPTION_STATUSES = ["Unvalidated", "Needs Research", "Validated", "Disproven"];
const QUESTION_TYPES = ["Stakeholder", "User Research", "Developer", "Designer", "Business Analyst"];
const QUESTION_STATUSES = ["Open", "Answered"];
const CONFIDENCE_LEVELS = ["Low", "Medium", "High"];

const EDGE_CASE_ITEMS = [
  { id: "empty", label: "Empty state", hint: "What does the user see when there's no data?" },
  { id: "error", label: "Error state", hint: "What happens when something fails?" },
  { id: "loading", label: "Loading state", hint: "What's shown during data fetch or processing?" },
  { id: "firstTime", label: "First-time experience", hint: "How does a new user encounter this?" },
  { id: "returning", label: "Returning user", hint: "Does behavior change for repeat use?" },
  { id: "permissions", label: "Permission / access variations", hint: "Different roles, restricted access?" },
  { id: "offline", label: "Offline / connectivity", hint: "What if the connection drops?" },
  { id: "dataLimits", label: "Data extremes", hint: "Too much data? Too little? Unexpected formats?" },
  { id: "mobile", label: "Responsive / mobile", hint: "Does this need to work across breakpoints?" },
  { id: "accessibility", label: "Accessibility", hint: "Keyboard nav, screen readers, contrast?" },
];

const createBlankAnalysis = (name = "Untitled Design Task", projectMode = "design-specs") => ({
  id: generateId(),
  name,
  projectMode,
  phase: "",
  gistId: "",
  jiraTicket: "",
  secureMode: false,
  language: "en",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  overview: { featureName: "", date: "", requestor: "", description: "", origin: "", originOther: "" },
  problem: { problem: "", who: "", outcome: "", metrics: "", ifNotBuilt: "" },
  context: { segments: "", workflow: "", workarounds: "", triggers: "", beforeAfter: "" },
  assumptions: [],
  edges: EDGE_CASE_ITEMS.reduce((acc, item) => {
    acc[item.id] = { considered: false, notes: "" };
    return acc;
  }, {}),
  scope: {
    affected: "",
    newPatterns: "",
    technical: "",
    items: [],
  },
  questions: [],
  acceptanceCriteria: [],
  actions: [],
  research: { rounds: [] },
  mapping: { figmaUrl: "" },
  designRefs: { references: [], notes: "" },
  codeRefs: { repos: [] },
  design: { figmaUrl: "", systemName: "", version: "", componentLibrary: "", tokensLink: "", mcpInstructions: "" },
  wireframe: { iaSteps: [] },
  notes: "",
  summary: { confidence: "", concerns: "", nextSteps: "", aiTask: "", includedSections: {
    overview: true, problem: true, context: true, assumptions: false, edges: false,
    scope: true, acceptance: true, questions: false, notes: false, research: false, mapping: false, designRefs: false, codeRefs: false, design: true, wireframe: false, actions: false
  } },
  // Discovery mode: outcomes (each outcome has its own discovery table + OST)
  outcomes: [],
  activeOutcomeId: null,
});

const createOutcome = (name) => ({
  id: generateId(),
  name,
  status: "active",
  createdAt: new Date().toISOString(),
  discoveryTable: null,
  opportunityTree: { outcome: { id: "outcome", text: name }, opportunities: [] },
});

// Migrate old analysis data to current structure
const migrateAnalysis = (analysis) => {
  const blank = createBlankAnalysis();
  const migrated = {
    ...blank,
    ...analysis,
    notes: analysis.notes ?? "",
    gistId: analysis.gistId ?? "",
    jiraTicket: analysis.jiraTicket ?? "",
    secureMode: analysis.secureMode ?? false,
    language: analysis.language ?? "en",
  };

  // Migrate old mapping.figmaUrl to designRefs
  if (!migrated.designRefs || !Array.isArray(migrated.designRefs?.references)) {
    const refs = [];
    const oldUrl = analysis.mapping?.figmaUrl?.trim();
    if (oldUrl) {
      refs.push({ id: generateId(), type: oldUrl.includes("figjam") || oldUrl.includes("board") ? "figjam" : "figma", url: oldUrl, label: "", status: analysis.mapping?.status || "wip" });
    }
    migrated.designRefs = { references: refs, notes: "" };
  }

  // Ensure codeRefs exists
  if (!migrated.codeRefs || !Array.isArray(migrated.codeRefs?.repos)) {
    migrated.codeRefs = { repos: [] };
  }

  // Ensure includedSections has new keys
  if (migrated.summary?.includedSections) {
    if (migrated.summary.includedSections.designRefs === undefined) migrated.summary.includedSections.designRefs = false;
    if (migrated.summary.includedSections.codeRefs === undefined) migrated.summary.includedSections.codeRefs = false;
  }

  // Migrate discoveryTable + opportunityTree into outcomes (if not already migrated)
  if (!migrated.outcomes || !Array.isArray(migrated.outcomes)) {
    migrated.outcomes = [];
    migrated.activeOutcomeId = null;
  }
  if (migrated.outcomes.length === 0 && (migrated.discoveryTable || migrated.opportunityTree)) {
    // Existing data → create a default outcome from it
    const outcomeName = migrated.opportunityTree?.outcome?.text || "Default Outcome";
    const defaultOutcome = {
      id: generateId(),
      name: outcomeName,
      status: "active",
      createdAt: migrated.createdAt || new Date().toISOString(),
      discoveryTable: migrated.discoveryTable || null,
      opportunityTree: migrated.opportunityTree || { outcome: { id: "outcome", text: outcomeName }, opportunities: [] },
    };
    migrated.outcomes = [defaultOutcome];
    migrated.activeOutcomeId = defaultOutcome.id;
  }
  // Clean up legacy top-level fields (keep for backward compat but outcomes is source of truth)
  delete migrated.discoveryTable;
  delete migrated.opportunityTree;

  return migrated;
};

// GitHub Gist API functions
const saveToGist = async (analysis, token) => {
  const headers = {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28"
  };
  
  const gistData = {
    description: `Requirement Analysis: ${analysis.name}`,
    public: false,
    files: {
      "analysis.json": {
        content: JSON.stringify(analysis, null, 2)
      }
    }
  };

  try {
    if (analysis.gistId) {
      // Update existing gist
      const response = await fetch(`https://api.github.com/gists/${analysis.gistId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(gistData)
      });
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      return await response.json();
    } else {
      // Create new gist
      const response = await fetch("https://api.github.com/gists", {
        method: "POST",
        headers,
        body: JSON.stringify(gistData)
      });
      if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
      return await response.json();
    }
  } catch (error) {
    console.error("Failed to save gist:", error);
    throw error;
  }
};

const loadFromGist = async (gistId, token) => {
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, { headers });
    if (!response.ok) throw new Error(`GitHub API error: ${response.status}`);
    const gist = await response.json();
    const file = gist.files["analysis.json"];
    if (!file) throw new Error("No analysis.json found in gist");
    return JSON.parse(file.content);
  } catch (error) {
    console.error("Failed to load gist:", error);
    throw error;
  }
};

// Audio analysis functions
let mediaRecorder = null;
let audioChunks = [];
let recognition = null;

const startAudioRecording = async (onTranscript) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    // Initialize Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        onTranscript(finalTranscript, interimTranscript);
      };

      recognition.start();
    }

    mediaRecorder.start();
    return true;
  } catch (error) {
    console.error("Error starting recording:", error);
    return false;
  }
};

const stopAudioRecording = () => {
  return new Promise((resolve) => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        resolve(audioBlob);
      };
      mediaRecorder.stop();
    } else {
      resolve(null);
    }

    if (recognition) {
      recognition.stop();
      recognition = null;
    }
  });
};

const analyzeWithGitHub = async (transcript, githubAIKey) => {
  if (!githubAIKey) return null;
  
  try {
    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${githubAIKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'You are a UX/product design assistant. Analyze the transcript and extract information into these sections: problem (what problem and why it matters), context (user context and personas), assumptions (unvalidated assumptions), edges (edge cases), scope (in/out of scope), questions (open questions), actions (requirement analysis action items like "Interview users", "Review analytics", "Create wireframes" - NOT development/implementation tasks), notes (additional notes). Return as compact JSON with section keys and string values. Be concise.'
        }, {
          role: 'user',
          content: transcript
        }],
        temperature: 0.7,
        max_tokens: 1500
      })
    });

    if (!response.ok) throw new Error('GitHub API error');
    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Try to parse as JSON, fallback to text
    try {
      return JSON.parse(content);
    } catch {
      return { notes: content };
    }
  } catch (error) {
    console.error('Failed to analyze with GitHub:', error);
    return null;
  }
};

const analyzeImage = async (imageBase64, githubAIKey) => {
  if (!githubAIKey) {
    return {
      notes: 'Image uploaded but no AI token provided.',
      _fallback: true,
      _reason: 'No GitHub token provided'
    };
  }
  
  try {
    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${githubAIKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'You are analyzing images (screenshots of Jira tickets, requirements docs, wireframes, designs, emails, etc). Extract structured information and return ONLY a valid JSON object (no markdown, no code blocks, no explanation). Use these fields (omit if not found): featureName (short title), date (any date mentioned), requestor (who requested/stakeholders), origin (one of: User Research, Business Metric, Competitor Analysis, Stakeholder Request, Technical Debt, Legal, Other), description (brief summary), problem (problem statement), who (target users), outcome (business outcome), segments (user segments), workflow (current workflow), assumptions (array of strings), questions (array of strings), actions (array of requirement analysis tasks like "Schedule user interview", "Review competitor solutions", "Create user flow", NOT implementation/development tasks), notes (array of additional points). Return raw JSON only.'
        }, {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this image and extract all relevant requirement information.' },
            { type: 'image_url', image_url: { url: imageBase64 } }
          ]
        }],
        temperature: 0.5,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API returned ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Strip markdown code blocks if present
    content = content.trim();
    
    if (content.startsWith('```')) {
      const match = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) {
        content = match[1].trim();
      }
    }
    
    content = content.replace(/^`+|`+$/g, '').trim();
    
    try {
      const parsed = JSON.parse(content);
      console.log('Successfully parsed AI image response:', parsed);
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError, 'Content:', content);
      return { 
        notes: 'Failed to parse AI response. Raw content:\n\n' + content,
        _fallback: true,
        _reason: 'JSON parsing failed: ' + parseError.message
      };
    }
  } catch (error) {
    console.error('Failed to analyze image:', error);
    return {
      notes: 'Image analysis failed: ' + error.message,
      _fallback: true,
      _reason: error.message || 'API request failed'
    };
  }
};

// Extract text from PDF file
const extractTextFromPDF = async (file) => {
  try {
    // Dynamically import PDF.js only when needed
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure worker using dynamic import for Vite bundling
    const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('Failed to extract text from PDF:', error);
    throw new Error('Failed to read PDF file: ' + error.message);
  }
};

const analyzePastedText = async (text, githubAIKey) => {
  if (!githubAIKey) {
    // Fallback without AI: add to notes as bullet points
    return {
      notes: text.split('\n').filter(line => line.trim()).map(line => `• ${line.trim()}`).join('\n'),
      _fallback: true,
      _reason: 'No GitHub token provided'
    };
  }
  
  try {
    const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${githubAIKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'system',
          content: 'You are analyzing pasted text (like Jira tickets, requirements docs, emails, etc). Extract structured information and return ONLY a valid JSON object (no markdown, no code blocks, no explanation). Use these fields (omit if not found): featureName (short title), date (any date mentioned), requestor (who requested/stakeholders), origin (one of: User Research, Business Metric, Competitor Analysis, Stakeholder Request, Technical Debt, Legal, Other), description (brief summary), problem (problem statement), who (target users), outcome (business outcome), segments (user segments), workflow (current workflow), assumptions (array of strings), questions (array of strings), acceptanceCriteria (array of strings describing what must be true for feature to be complete), actions (array of requirement analysis tasks like "Schedule user interview", "Review competitor solutions", "Create user flow", NOT implementation/development tasks), notes (array of additional points). Return raw JSON only.'
        }, {
          role: 'user',
          content: text
        }],
        temperature: 0.5,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API returned ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Strip markdown code blocks if present (try multiple patterns)
    content = content.trim();
    
    // Remove ```json ... ``` blocks
    if (content.startsWith('```')) {
      const match = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
      if (match) {
        content = match[1].trim();
      }
    }
    
    // Remove any remaining backticks
    content = content.replace(/^`+|`+$/g, '').trim();
    
    try {
      const parsed = JSON.parse(content);
      console.log('Successfully parsed AI response:', parsed);
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError, 'Content:', content);
      return { 
        notes: 'Failed to parse AI response. Raw content:\n\n' + content,
        _fallback: true,
        _reason: 'JSON parsing failed: ' + parseError.message
      };
    }
  } catch (error) {
    console.error('Failed to analyze pasted text:', error);
    // Fallback: add to notes
    return {
      notes: text.split('\n').filter(line => line.trim()).map(line => `• ${line.trim()}`).join('\n'),
      _fallback: true,
      _reason: error.message || 'API request failed'
    };
  }
};

function getCompletion(analysis) {
  let filled = 0, total = 0;
  const check = (val) => { total++; if (val && String(val).trim()) filled++; };
  Object.values(analysis.overview).forEach(check);
  check(analysis.phase);
  Object.values(analysis.problem).forEach(check);
  Object.values(analysis.context).forEach(check);
  total++; if (analysis.assumptions.length > 0) filled++;
  total++; if (Object.values(analysis.edges).filter((e) => e.considered).length > 0) filled++;
  check(analysis.scope.affected); check(analysis.scope.newPatterns); check(analysis.scope.technical);
  total++; if (analysis.scope.items.length > 0) filled++;
  total++; if (analysis.questions.length > 0) filled++;
  total++; if ((analysis.actions || []).length > 0) filled++;
  Object.values(analysis.summary).forEach(check);
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

function getTaskCount(analysis) {
  let filled = 0, total = 0;
  const check = (val) => { total++; if (val && String(val).trim()) filled++; };
  Object.values(analysis.overview).forEach(check);
  check(analysis.phase);
  Object.values(analysis.problem).forEach(check);
  Object.values(analysis.context).forEach(check);
  total++; if (analysis.assumptions.length > 0) filled++;
  total++; if (Object.values(analysis.edges).filter((e) => e.considered).length > 0) filled++;
  check(analysis.scope.affected); check(analysis.scope.newPatterns); check(analysis.scope.technical);
  total++; if (analysis.scope.items.length > 0) filled++;
  total++; if (analysis.questions.length > 0) filled++;
  total++; if ((analysis.actions || []).length > 0) filled++;
  Object.values(analysis.summary).forEach(check);
  return { filled, total };
}

function getSectionCompletion(analysis, sectionId) {
  let filled = 0, total = 0;
  const check = (val) => { total++; if (val && String(val).trim()) filled++; };
  switch (sectionId) {
    case "overview":
      Object.values(analysis.overview).forEach(check);
      check(analysis.phase);
      break;
    case "problem": Object.values(analysis.problem).forEach(check); break;
    case "context": Object.values(analysis.context).forEach(check); break;
    case "assumptions": total = 1; if (analysis.assumptions.length > 0) filled = 1; break;
    case "edges":
      total = EDGE_CASE_ITEMS.length;
      filled = Object.values(analysis.edges).filter((e) => e.considered).length;
      break;
    case "scope":
      check(analysis.scope.affected); check(analysis.scope.newPatterns); check(analysis.scope.technical);
      total++; if (analysis.scope.items.length > 0) filled++;
      break;
    case "questions": total = 1; if (analysis.questions.length > 0) filled = 1; break;
    case "acceptance": total = 1; if ((analysis.acceptanceCriteria || []).length > 0) filled = 1; break;
    case "actions": total = 1; if ((analysis.actions || []).length > 0) filled = 1; break;
    case "mapping": 
      total = 1; 
      if (analysis.mapping?.figmaUrl?.trim()) filled = 1; 
      break;
    case "designRefs":
      total = 1;
      if ((analysis.designRefs?.references || []).length > 0) filled = 1;
      break;
    case "codeRefs":
      total = 1;
      if ((analysis.codeRefs?.repos || []).length > 0) filled = 1;
      break;
    case "design":
      check(analysis.design?.figmaUrl);
      check(analysis.design?.systemName);
      check(analysis.design?.version);
      check(analysis.design?.componentLibrary);
      check(analysis.design?.tokensLink);
      check(analysis.design?.mcpInstructions);
      break;
    case "notes": check(analysis.notes); break;
    case "research": total = 1; if ((analysis.research?.rounds || []).length > 0) filled = 1; break;
    case "wireframe": total = 1; if ((analysis.wireframe?.iaSteps || []).length > 0) filled = 1; break;
    case "summary": Object.values(analysis.summary).forEach(check); break;
  }
  return total > 0 ? Math.round((filled / total) * 100) : 0;
}

function exportToMarkdown(a) {
  if (!a) return "No analysis selected.";
  
  const lines = [];
  const h = (t) => lines.push(`\n## ${t}`);
  const f = (label, val) => { if (val?.trim()) lines.push(`**${label}:** ${val}`); };
  lines.push(`# ${a.name || "Untitled Design Task"}`);
  lines.push(`*Created: ${new Date(a.createdAt).toLocaleDateString()}*`);
  if (a.phase) lines.push(`*Target Phase: ${a.phase}*`);
  if (a.jiraTicket) lines.push(`*JIRA Ticket: ${a.jiraTicket}*`);

  h("Overview");
  f("Feature", a.overview?.featureName); f("Date", a.overview?.date);
  f("Stakeholders", a.overview?.requestor); 
  f("Origin", a.overview?.origin === "Other" && a.overview?.originOther ? `Other: ${a.overview.originOther}` : a.overview?.origin);
  if (a.overview?.description) lines.push(`\n${a.overview.description}`);

  h("Problem & Purpose");
  f("Problem", a.problem?.problem); f("Who", a.problem?.who);
  f("Business Outcome", a.problem?.outcome); f("Success Metrics", a.problem?.metrics);
  f("If Not Built", a.problem?.ifNotBuilt);

  h("User Context");
  f("Target Segments", a.context?.segments); f("Current Workflow", a.context?.workflow);
  f("Workarounds", a.context?.workarounds); f("Triggers", a.context?.triggers);
  f("Before/After", a.context?.beforeAfter);

  h("Assumptions");
  if (!a.assumptions || a.assumptions.length === 0) lines.push("*No assumptions logged yet.*");
  else a.assumptions.forEach((item, i) => lines.push(`${i + 1}. [${item.status}] ${item.text}`));

  h("Edge Cases");
  EDGE_CASE_ITEMS.forEach((ec) => {
    const d = a.edges?.[ec.id];
    if (d?.considered) lines.push(`- [x] **${ec.label}**${d.notes ? `: ${d.notes}` : ""}`);
    else lines.push(`- [ ] ${ec.label}`);
  });

  h("Scope & Versions");
  f("Affected Features", a.scope?.affected); f("New Patterns Needed", a.scope?.newPatterns);
  f("Technical Constraints", a.scope?.technical);
  if (a.scope?.items && a.scope.items.length > 0) {
    lines.push("\n### Scope Items by Version");
    const byVersion = {};
    a.scope.items.forEach((item) => {
      const v = item.version || "Unassigned";
      if (!byVersion[v]) byVersion[v] = [];
      byVersion[v].push(item);
    });
    Object.entries(byVersion).forEach(([version, items]) => {
      lines.push(`\n**${version}**`);
      items.forEach((item) => {
        const priority = item.priority ? ` [${item.priority}]` : "";
        lines.push(`- ${item.item}${priority}${item.description ? ` — ${item.description}` : ""}`);
      });
    });
  }

  h("Acceptance Criteria");
  if (!a.acceptanceCriteria || a.acceptanceCriteria.length === 0) lines.push("*No acceptance criteria defined yet.*");
  else {
    const priorities = ["Must Have", "Should Have", "Nice to Have"];
    priorities.forEach(priority => {
      const items = a.acceptanceCriteria.filter(c => c.priority === priority);
      if (items.length > 0) {
        lines.push(`\n**${priority}**`);
        items.forEach((c, i) => {
          const status = c.status === "Done" ? "X" : c.status === "In Progress" ? "~" : " ";
          lines.push(`${i + 1}. [${status}] ${c.text}`);
          if (c.notes?.trim()) lines.push(`   - ${c.notes}`);
        });
      }
    });
  }

  h("Open Questions");
  if (!a.questions || a.questions.length === 0) lines.push("*No questions logged yet.*");
  else a.questions.forEach((q, i) => {
    const status = q.status === "Answered" ? "Y" : "?";
    lines.push(`${i + 1}. [${status}] (${q.type}) ${q.text}`);
    if (q.answer?.trim()) lines.push(`   - ${q.answer}`);
  });

  h("Action Items");
  if (!a.actions || a.actions.length === 0) lines.push("*No actions logged yet.*");
  else a.actions.forEach((item, i) => lines.push(`${i + 1}. [${item.completed ? "X" : " "}] ${item.text}`));

  h("Mapping");
  if (a.mapping?.figmaUrl) {
    lines.push(`Figma Embed: ${a.mapping.figmaUrl}`);
  } else {
    lines.push("*No mapping URL set.*");
  }

  h("Design References");
  if (a.designRefs?.references?.length > 0) {
    a.designRefs.references.forEach((ref, i) => {
      const typeLabel = DESIGN_REF_TYPE_LABELS[ref.type] || ref.type;
      lines.push(`${i + 1}. [${typeLabel}] ${ref.label || 'Untitled'} — ${ref.url || '(no URL)'} (${ref.status || 'wip'})`);
    });
    if (a.designRefs.notes?.trim()) lines.push(`\n**Notes:** ${a.designRefs.notes}`);
  } else {
    lines.push("*No design references yet.*");
  }

  h("Code References");
  if (a.codeRefs?.repos?.length > 0) {
    a.codeRefs.repos.forEach((repo, i) => {
      const typeLabel = CODE_REF_TYPE_LABELS[repo.type] || repo.type;
      const branch = repo.branch ? ` (${repo.branch})` : '';
      lines.push(`${i + 1}. [${typeLabel}] ${repo.label || 'Untitled'} — ${repo.url || '(no URL)'}${branch}`);
      if (repo.notes?.trim()) lines.push(`   - ${repo.notes}`);
    });
  } else {
    lines.push("*No code references yet.*");
  }

  h("Design System");
  f("Design System Name", a.design?.systemName);
  f("Version", a.design?.version);
  f("Component Library", a.design?.componentLibrary);
  f("Design Tokens Link", a.design?.tokensLink);
  if (a.design?.figmaUrl) {
    lines.push(`Figma File: ${a.design.figmaUrl}`);
  }
  if (a.design?.mcpInstructions?.trim()) {
    lines.push(`\n**Figma MCP Setup Instructions:**`);
    lines.push(a.design.mcpInstructions);
  }
  if (!a.design?.systemName && !a.design?.figmaUrl) {
    lines.push("*No design system reference set.*");
  }

  h("Notes");
  if (a.notes?.trim()) lines.push(a.notes);
  else lines.push("*No notes.*");

  h("Summary");
  f("Confidence", a.summary?.confidence); f("Key Concerns", a.summary?.concerns);
  f("Next Steps", a.summary?.nextSteps);
  return lines.join("\n");
}

// Import from Markdown
function importFromMarkdown(markdown) {
  const lines = markdown.split("\n");
  const analysis = createBlankAnalysis();
  
  let currentSection = "";
  let buffer = [];
  
  const parseField = (line) => {
    const match = line.match(/\*\*([^:]+):\*\*\s*(.+)/);
    return match ? { label: match[1].trim(), value: match[2].trim() } : null;
  };
  
  const processSection = () => {
    const content = buffer.join("\n").trim();
    
    switch(currentSection) {
      case "Overview":
        buffer.forEach(line => {
          const field = parseField(line);
          if (!field) {
            if (line && !line.startsWith("**") && analysis.overview.description === "") {
              analysis.overview.description = content.split("\n").filter(l => !l.startsWith("**")).join("\n").trim();
            }
            return;
          }
          if (field.label === "Feature") analysis.overview.featureName = field.value;
          if (field.label === "Date") analysis.overview.date = field.value;
          if (field.label === "Stakeholders") analysis.overview.requestor = field.value;
          if (field.label === "Origin") {
            // Check if it's "Other: something"
            if (field.value.startsWith("Other: ")) {
              analysis.overview.origin = "Other";
              analysis.overview.originOther = field.value.substring(7);
            } else {
              analysis.overview.origin = field.value;
            }
          }
        });
        break;
        
      case "Problem & Purpose":
        buffer.forEach(line => {
          const field = parseField(line);
          if (!field) return;
          if (field.label === "Problem") analysis.problem.problem = field.value;
          if (field.label === "Who") analysis.problem.who = field.value;
          if (field.label === "Business Outcome") analysis.problem.outcome = field.value;
          if (field.label === "Success Metrics") analysis.problem.metrics = field.value;
          if (field.label === "If Not Built") analysis.problem.ifNotBuilt = field.value;
        });
        break;
        
      case "User Context":
        buffer.forEach(line => {
          const field = parseField(line);
          if (!field) return;
          if (field.label === "Target Segments") analysis.context.segments = field.value;
          if (field.label === "Current Workflow") analysis.context.workflow = field.value;
          if (field.label === "Workarounds") analysis.context.workarounds = field.value;
          if (field.label === "Triggers") analysis.context.triggers = field.value;
          if (field.label === "Before/After") analysis.context.beforeAfter = field.value;
        });
        break;
        
      case "Assumptions":
        buffer.forEach(line => {
          const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s*(.+)/);
          if (match) {
            analysis.assumptions.push({
              id: generateId(),
              text: match[2].trim(),
              status: match[1].trim()
            });
          }
        });
        break;
        
      case "Design actions":  // Legacy support for old exports
      case "Action Items":
        buffer.forEach(line => {
          const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s*(.+)/);
          if (match) {
            analysis.actions.push({
              id: generateId(),
              text: match[2].trim(),
              completed: match[1].trim() === "X",
              note: ""
            });
          }
        });
        break;
        
      case "Acceptance Criteria":
        let currentPriority = "Must Have";
        buffer.forEach(line => {
          if (line.startsWith("**Must Have**")) currentPriority = "Must Have";
          else if (line.startsWith("**Should Have**")) currentPriority = "Should Have";
          else if (line.startsWith("**Nice to Have**")) currentPriority = "Nice to Have";
          else {
            const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s*(.+)/);
            if (match) {
              const status = match[1].trim() === "X" ? "Done" : match[1].trim() === "~" ? "In Progress" : "Not Started";
              analysis.acceptanceCriteria.push({
                id: generateId(),
                text: match[2].trim(),
                priority: currentPriority,
                status: status,
                notes: ""
              });
            }
          }
        });
        break;
        
      case "Open Questions":
        buffer.forEach(line => {
          const match = line.match(/^\d+\.\s*\[([^\]]+)\]\s*\(([^)]+)\)\s*(.+)/);
          if (match) {
            analysis.questions.push({
              id: generateId(),
              text: match[3].trim(),
              type: match[2].trim(),
              status: match[1].trim() === "Y" ? "Answered" : "Open",
              answer: ""
            });
          }
        });
        break;
        
      case "Mapping":
        const figmaMatch = content.match(/Figma Embed:\s*(.+)/);
        if (figmaMatch) {
          analysis.mapping = { figmaUrl: figmaMatch[1].trim() };
        }
        break;
        
      case "Design System":
        buffer.forEach(line => {
          const field = parseField(line);
          if (!field) return;
          if (field.label === "Design System Name") analysis.design.systemName = field.value;
          if (field.label === "Version") analysis.design.version = field.value;
          if (field.label === "Component Library") analysis.design.componentLibrary = field.value;
          if (field.label === "Design Tokens Link") analysis.design.tokensLink = field.value;
        });
        const designFigmaMatch = content.match(/Figma File:\s*(.+)/);
        if (designFigmaMatch) {
          analysis.design.figmaUrl = designFigmaMatch[1].trim();
        }
        const mcpMatch = content.match(/\*\*Figma MCP Setup Instructions:\*\*\s*([\s\S]+?)(?=\n\n|$)/);
        if (mcpMatch) {
          analysis.design.mcpInstructions = mcpMatch[1].trim();
        }
        break;
        
      case "Notes":
        if (content && !content.includes("*No notes.*")) {
          analysis.notes = content;
        }
        break;
        
      case "Summary":
        buffer.forEach(line => {
          const field = parseField(line);
          if (!field) return;
          if (field.label === "Confidence") analysis.summary.confidence = field.value;
          if (field.label === "Key Concerns") analysis.summary.concerns = field.value;
          if (field.label === "Next Steps") analysis.summary.nextSteps = field.value;
        });
        break;
    }
    
    buffer = [];
  };
  
  lines.forEach((line, index) => {
    // Extract title from first line
    if (index === 0 && line.startsWith("# ")) {
      analysis.name = line.substring(2).trim();
      return;
    }
    
    // Extract phase
    if (line.startsWith("*Target Phase:")) {
      const match = line.match(/\*Target Phase:\s*([^*]+)\*/);
      if (match) analysis.phase = match[1].trim();
      return;
    }
    
    // Extract JIRA ticket
    if (line.startsWith("*JIRA Ticket:")) {
      const match = line.match(/\*JIRA Ticket:\s*([^*]+)\*/);
      if (match) analysis.jiraTicket = match[1].trim();
      return;
    }
    
    // Section headers
    if (line.startsWith("## ")) {
      if (currentSection) processSection();
      currentSection = line.substring(3).trim();
      return;
    }
    
    // Skip empty lines at start of section
    if (!buffer.length && !line.trim()) return;
    
    // Add to buffer
    if (line.trim()) {
      buffer.push(line);
    }
  });
  
  // Process final section
  if (currentSection) processSection();
  
  return analysis;
}

// --- UI Components ---

const AutoResizeTextarea = ({ value, onChange, rows, className, placeholder }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = 'auto';
      const minHeight = rows * 28; // ~28px per row for larger text
      el.style.height = Math.max(el.scrollHeight, minHeight) + 'px';
    }
  }, [value, rows]);
  return (
    <textarea
      ref={ref}
      className={className}
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ overflow: 'hidden', lineHeight: '1.6' }}
    />
  );
};

const Field = ({ label, hint, placeholder, value, onChange, multiline = false, rows = 3 }) => (
  <div className="mb-5">
    <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-2">{label}</label>
    {hint && <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">{hint}</p>}
    {multiline ? (
      <AutoResizeTextarea
        className="w-full px-4 py-3 text-base border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 resize-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
        rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    ) : (
      <input
        type="text"
        className="w-full px-4 py-3 text-base border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
        value={value || ""} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    )}
  </div>
);

const Select = ({ label, hint, value, options, onChange, allowEmpty = true }) => (
  <div className="mb-5">
    <label className="block text-base font-medium text-slate-700 dark:text-slate-300 mb-2">{label}</label>
    {hint && <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 leading-relaxed">{hint}</p>}
    <select
      className="w-full px-4 py-3 text-base border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
      value={value || ""} onChange={(e) => onChange(e.target.value)}
    >
      {allowEmpty && <option value="">Select...</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

const VersionBadge = ({ version, size = "sm" }) => {
  if (!version) return null;
  const colors = VERSION_COLORS[version] || VERSION_COLORS.Future;
  const sizeClass = size === "xs" ? "text-xs px-1.5 py-0" : "text-xs px-2 py-0.5";
  return (
    <span className={`${sizeClass} rounded-full font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
      {version}
    </span>
  );
};

const Pill = ({ active, onClick, children, completion, count }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all whitespace-nowrap ${
      active ? "bg-slate-800 dark:bg-slate-600 text-white font-medium" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
    }`}
  >
    <span>{children}</span>
    {count !== undefined && count > 0 && (
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
        active ? "bg-slate-600 dark:bg-slate-700 text-slate-200" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
      }`}>
        {count}
      </span>
    )}
  </button>
);

const SectionHeader = ({ title, description }) => (
  <div className="mb-8 pb-5 border-b border-slate-100 dark:border-slate-700">
    <h2 className="text-2xl font-semibold text-slate-800 dark:text-slate-200 leading-tight">{title}</h2>
    {description && <p className="text-base text-slate-600 dark:text-slate-400 mt-3 leading-relaxed max-w-prose">{description}</p>}
  </div>
);

// --- Section Components ---

const OverviewSection = ({ data, phase, jiraTicket, secureMode, language, projectMode, audioModalOpen, pasteModalOpen, onChange, onPhaseChange, onJiraTicketChange, onSecureModeChange, onLanguageChange, onOpenAudioModal, onOpenPasteModal }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  
  return (
  <div>
    <SectionHeader title={t.sections.overview} description="Basic information about the feature requirement." />
    
    {/* Language Selector */}
    <div className="mb-6">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Task Language</label>
      <div className="flex gap-2">
        {['en', 'da', 'sv'].map((lang) => (
          <button
            key={lang}
            onClick={() => onLanguageChange(lang)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              language === lang
                ? "bg-slate-800 dark:bg-slate-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
            }`}
          >
            {lang === 'en' ? 'English' : lang === 'da' ? 'Dansk' : 'Svenska'}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Choose the language for section titles and field labels in this task</p>
    </div>
    
    {/* Secure Mode & AI Features */}
    <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Secure Mode</label>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enable encryption and disable external services for sensitive data</p>
        </div>
        <button
          onClick={() => onSecureModeChange(!secureMode)}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
            secureMode
              ? "bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600"
              : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          {secureMode ? "ON" : "OFF"}
        </button>
      </div>
      
      {/* AI Analysis Buttons - Only visible when secure mode is OFF */}
      {!secureMode && (
        <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onOpenAudioModal}
            className="flex-1 px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Audio Analysis
          </button>
          <button
            onClick={onOpenPasteModal}
            className="flex-1 px-4 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors flex items-center justify-center gap-2 font-medium"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Text Analysis
          </button>
        </div>
      )}
      
      {secureMode && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium pt-3 border-t border-slate-200 dark:border-slate-700">
          ✓ Data encrypted • External services disabled • GitHub sync hidden
        </p>
      )}
    </div>
    
    <Field label="JIRA Ticket" value={jiraTicket} onChange={onJiraTicketChange} placeholder="e.g., PROJ-123" />
    <div className="grid grid-cols-2 gap-4">
      <Field label={t.fields.featureName} value={data.featureName} onChange={(v) => onChange({ ...data, featureName: v })} />
      <Field label={t.fields.date} value={data.date} onChange={(v) => onChange({ ...data, date: v })} />
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Field label={t.fields.stakeholders} value={data.requestor} onChange={(v) => onChange({ ...data, requestor: v })} />
      <Select label={t.fields.origin} value={data.origin} options={ORIGIN_OPTIONS} onChange={(v) => onChange({ ...data, origin: v })} />
    </div>
    {data.origin === "Other" && (
      <Field label="Specify Other Origin" value={data.originOther} onChange={(v) => onChange({ ...data, originOther: v })} />
    )}
    {projectMode === "design-specs" && (
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.fields.targetVersion}</label>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Which release phase is this analysis targeting?</p>
        <div className="flex gap-2 flex-wrap">
          {VERSION_PHASES.filter((v) => v !== "Cut").map((v) => {
            const colors = VERSION_COLORS[v];
            const isActive = phase === v;
            return (
              <button
                key={v}
                onClick={() => onPhaseChange(isActive ? "" : v)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-1 ring-slate-300`
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                {v}
              </button>
            );
          })}
        </div>
      </div>
    )}
    <Field label={t.fields.description} hint="What is this feature in one or two sentences?" multiline value={data.description} onChange={(v) => onChange({ ...data, description: v })} />
  </div>
  );
};

const ProblemSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  return (
  <div>
    <SectionHeader title={t.sections.problem} description="Understand the why before the what." />
    <Field label={t.fields.problem} multiline hint="Be specific. Vague problems lead to vague solutions." value={data.problem} onChange={(v) => onChange({ ...data, problem: v })} />
    <Field label={t.fields.who} multiline hint="Which users, how often, and in what circumstances?" value={data.who} onChange={(v) => onChange({ ...data, who: v })} />
    <Field label={t.fields.outcome} multiline value={data.outcome} onChange={(v) => onChange({ ...data, outcome: v })} />
    <Field label={t.fields.metrics} multiline hint="If stakeholders can't define this, the requirement isn't ready." value={data.metrics} onChange={(v) => onChange({ ...data, metrics: v })} />
    <Field label={t.fields.ifNotBuilt} multiline hint="Helps gauge urgency and priority." value={data.ifNotBuilt} onChange={(v) => onChange({ ...data, ifNotBuilt: v })} />
  </div>
  );
};

const UserContextSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  return (
  <div>
    <SectionHeader title={t.sections.context} description="Map the who, when, and current reality." />
    <Field label={t.fields.segments} multiline value={data.segments} onChange={(v) => onChange({ ...data, segments: v })} />
    <Field label={t.fields.workflow} multiline hint="What does the user do today without this feature?" value={data.workflow} onChange={(v) => onChange({ ...data, workflow: v })} />
    <Field label={t.fields.workarounds} multiline hint="If there's no workaround, question whether the problem is real. If there is, study it — your solution must beat it." value={data.workarounds} onChange={(v) => onChange({ ...data, workarounds: v })} />
    <Field label={t.fields.triggers} multiline hint="What moment or event causes the user to want this?" value={data.triggers} onChange={(v) => onChange({ ...data, triggers: v })} />
    <Field label={t.fields.beforeAfter} multiline hint="The surrounding flow shapes constraints on your design." value={data.beforeAfter} onChange={(v) => onChange({ ...data, beforeAfter: v })} />
  </div>
  );
};

const AssumptionsSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [statusFilter, setStatusFilter] = useState("Open");
  const addItem = () => onChange([...data, { id: generateId(), text: "", status: "Unvalidated", tags: [] }]);
  const updateItem = (id, field, val) =>
    onChange(data.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
  const removeItem = (id) => onChange(data.filter((item) => item.id !== id));

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  const textareaRef = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  // Filter by status: Open = Unvalidated/Needs Research, Answered = Validated/Disproven
  const filteredData = statusFilter === "Open" 
    ? data.filter(item => item.status === "Unvalidated" || item.status === "Needs Research")
    : data.filter(item => item.status === "Validated" || item.status === "Disproven");

  return (
    <div>
      <SectionHeader title={t.sections.assumptions} description="Every requirement carries hidden assumptions. Name them so you can validate or flag them." />
      {data.length > 0 && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter("Open")}
              className={`px-2 py-1 text-xs rounded ${
                statusFilter === "Open" ? "bg-slate-800 dark:bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setStatusFilter("Answered")}
              className={`px-2 py-1 text-xs rounded ${
                statusFilter === "Answered" ? "bg-slate-800 dark:bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              Answered
            </button>
          </div>
        </div>
      )}
      {data.length === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border border-dashed border-slate-200 dark:border-slate-600 rounded-lg mb-4">
          No assumptions logged yet. Start adding them below.
        </div>
      )}
      <div className="space-y-3 mb-4">
        {filteredData.map((item, i) => (
          <div key={item.id} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-400 mt-2.5 font-mono w-5 shrink-0">{i + 1}</span>
            <div className="flex-1 space-y-2">
              <textarea
                ref={textareaRef}
                className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none overflow-hidden"
                style={{ minHeight: "36px" }}
                placeholder="Describe the assumption..."
                value={item.text}
                onChange={(e) => {
                  updateItem(item.id, "text", e.target.value);
                  autoResize(e);
                }}
                onInput={autoResize}
                rows={1}
              />
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  className="px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                  value={item.status} onChange={(e) => updateItem(item.id, "status", e.target.value)}
                >
                  {ASSUMPTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(item.tags || []).includes("B2B")}
                    onChange={(e) => {
                      const tags = item.tags || [];
                      updateItem(item.id, "tags", e.target.checked ? [...tags.filter(t => t !== "B2B"), "B2B"] : tags.filter(t => t !== "B2B"));
                    }}
                    className="rounded border-slate-300 text-slate-600 focus:ring-slate-300"
                  />
                  B2B
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(item.tags || []).includes("B2C")}
                    onChange={(e) => {
                      const tags = item.tags || [];
                      updateItem(item.id, "tags", e.target.checked ? [...tags.filter(t => t !== "B2C"), "B2C"] : tags.filter(t => t !== "B2C"));
                    }}
                    className="rounded border-slate-300 text-slate-600 focus:ring-slate-300"
                  />
                  B2C
                </label>
              </div>
            </div>
            <button onClick={() => removeItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 text-lg mt-1.5 px-1">×</button>
          </div>
        ))}
      </div>
      <button onClick={addItem} className="text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
        + Add assumption
      </button>
    </div>
  );
};

const EdgeCasesSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const toggle = (id) => onChange({ ...data, [id]: { ...data[id], considered: !data[id].considered } });
  const setNotes = (id, notes) => onChange({ ...data, [id]: { ...data[id], notes } });
  const consideredCount = Object.values(data).filter((e) => e.considered).length;

  return (
    <div>
      <SectionHeader title={t.sections.edges} description="Requirements almost never cover these. They're where most design complexity lives." />
      <p className="text-xs text-slate-500 mb-4">{consideredCount} of {EDGE_CASE_ITEMS.length} considered</p>
      <div className="space-y-2">
        {EDGE_CASE_ITEMS.map((ec) => {
          const d = data[ec.id] || { considered: false, notes: "" };
          return (
            <div key={ec.id} className={`border rounded-lg transition-colors ${d.considered ? "border-emerald-200 bg-emerald-50/30" : "border-slate-100 bg-white"}`}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => toggle(ec.id)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  d.considered ? "border-emerald-500 bg-emerald-500" : "border-slate-300"
                }`}>
                  {d.considered && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-700">{ec.label}</span>
                  <span className="text-xs text-slate-400 ml-2">{ec.hint}</span>
                </div>
              </div>
              {d.considered && (
                <div className="px-4 pb-3 pl-12">
                  <textarea
                    className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 resize-y"
                    rows={2} placeholder="Notes on how you'll handle this..."
                    value={d.notes} onChange={(e) => setNotes(ec.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ScopeSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const items = data.items || [];
  const setField = (field, val) => onChange({ ...data, [field]: val });
  const setItems = (newItems) => onChange({ ...data, items: newItems });

  const addItem = () =>
    setItems([...items, { id: generateId(), item: "", description: "", version: "MVP", priority: "Must" }]);
  const updateItem = (id, field, val) =>
    setItems(items.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  const removeItem = (id) => setItems(items.filter((it) => it.id !== id));

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  const textareaRef = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  // Group items by version for the summary view
  const byVersion = useMemo(() => {
    const grouped = {};
    VERSION_PHASES.forEach((v) => { grouped[v] = []; });
    grouped["Unassigned"] = [];
    items.forEach((it) => {
      const v = it.version || "Unassigned";
      if (!grouped[v]) grouped[v] = [];
      grouped[v].push(it);
    });
    return grouped;
  }, [items]);

  const [viewMode, setViewMode] = useState("list"); // "list" or "versions"

  return (
    <div>
      <SectionHeader title={t.sections.scope} description="Break the feature into scope items and assign each to a release version." />

      {/* Dependencies */}
      <Field label="Affected existing features" multiline hint="What current functionality does this change or interact with?" value={data.affected} onChange={(v) => setField("affected", v)} />
      <Field label="New components or patterns needed" multiline hint="Can you reuse existing patterns, or does this require new ones?" value={data.newPatterns} onChange={(v) => setField("newPatterns", v)} />
      <Field label="Technical dependencies or constraints" multiline value={data.technical} onChange={(v) => setField("technical", v)} />

      {/* Scope items */}
      <div className="border-t border-slate-100 pt-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Scope Items</p>
            <p className="text-xs text-slate-400 mt-0.5">{items.length} item{items.length !== 1 ? "s" : ""} across {Object.values(byVersion).filter((arr) => arr.length > 0).length} version{Object.values(byVersion).filter((arr) => arr.length > 0).length !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === "list" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("versions")}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === "versions" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500"}`}
            >
              By Version
            </button>
          </div>
        </div>

        {items.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg mb-4">
            No scope items yet. Add items and assign them to versions.
          </div>
        )}

        {/* List view */}
        {viewMode === "list" && items.length > 0 && (
          <div className="space-y-2 mb-4">
            {items.map((item, i) => {
              const colors = VERSION_COLORS[item.version] || VERSION_COLORS.Future;
              return (
                <div key={item.id} className={`p-3 rounded-lg border ${colors.border} bg-white`}>
                  <div className="flex gap-2 items-start">
                    <div className={`w-1 self-stretch rounded-full shrink-0 ${colors.dot}`} />
                    <div className="flex-1 space-y-2">
                      <textarea
                        ref={textareaRef}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 font-medium resize-none overflow-hidden"
                        style={{ minHeight: "36px" }}
                        placeholder="Scope item name..."
                        value={item.item}
                        onChange={(e) => {
                          updateItem(item.id, "item", e.target.value);
                          autoResize(e);
                        }}
                        onInput={autoResize}
                        rows={1}
                      />
                      <textarea
                        ref={textareaRef}
                        className="w-full px-2 py-1.5 text-xs border border-slate-100 rounded bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none overflow-hidden"
                        style={{ minHeight: "32px" }}
                        placeholder="Brief description (optional)..."
                        value={item.description}
                        onChange={(e) => {
                          updateItem(item.id, "description", e.target.value);
                          autoResize(e);
                        }}
                        onInput={autoResize}
                        rows={1}
                      />
                      <div className="flex gap-2 flex-wrap items-center">
                        <select
                          className={`px-2 py-1 text-xs rounded-full font-medium border ${colors.bg} ${colors.text} ${colors.border} focus:outline-none`}
                          value={item.version} onChange={(e) => updateItem(item.id, "version", e.target.value)}
                        >
                          {VERSION_PHASES.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                        <select
                          className="px-2 py-1 text-xs border border-slate-200 rounded bg-white focus:outline-none"
                          value={item.priority} onChange={(e) => updateItem(item.id, "priority", e.target.value)}
                        >
                          {PRIORITY_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-slate-300 hover:text-red-400 text-lg mt-1 px-1">×</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Version grouped view */}
        {viewMode === "versions" && items.length > 0 && (
          <div className="space-y-4 mb-4">
            {VERSION_PHASES.map((version) => {
              const versionItems = byVersion[version] || [];
              if (versionItems.length === 0) return null;
              const colors = VERSION_COLORS[version];
              return (
                <div key={version} className={`rounded-lg border ${colors.border} overflow-hidden`}>
                  <div className={`px-4 py-2 ${colors.bg} flex items-center justify-between`}>
                    <span className={`text-sm font-semibold ${colors.text}`}>{version}</span>
                    <span className={`text-xs ${colors.text} opacity-70`}>{versionItems.length} item{versionItems.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {versionItems.map((item) => (
                      <div key={item.id} className="px-4 py-2.5 flex items-center gap-3 bg-white">
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${
                          item.priority === "Must" ? "bg-red-50 text-red-600 border-red-200" :
                          item.priority === "Should" ? "bg-amber-50 text-amber-600 border-amber-200" :
                          item.priority === "Could" ? "bg-blue-50 text-blue-600 border-blue-200" :
                          "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                          {item.priority}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">{item.item || "Unnamed item"}</p>
                          {item.description && <p className="text-xs text-slate-400 truncate">{item.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={addItem} className="text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
          + Add scope item
        </button>

        {/* Version summary bar */}
        {items.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Version distribution</p>
            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100">
              {VERSION_PHASES.map((v) => {
                const count = (byVersion[v] || []).length;
                if (count === 0) return null;
                const pct = (count / items.length) * 100;
                return (
                  <div
                    key={v}
                    className={`${VERSION_COLORS[v].dot} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${v}: ${count} item${count !== 1 ? "s" : ""}`}
                  />
                );
              })}
            </div>
            <div className="flex gap-3 mt-2 flex-wrap">
              {VERSION_PHASES.map((v) => {
                const count = (byVersion[v] || []).length;
                if (count === 0) return null;
                return (
                  <span key={v} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className={`w-2 h-2 rounded-full ${VERSION_COLORS[v].dot}`} />
                    {v}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const AcceptanceCriteriaSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [statusFilter, setStatusFilter] = useState("Not Started");
  
  const addItem = () =>
    onChange([...data, { 
      id: generateId(), 
      text: "", 
      priority: "Must Have", 
      status: "Not Started",
      notes: "" 
    }]);
    
  const updateItem = (id, field, val) =>
    onChange(data.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
    
  const removeItem = (id) => onChange(data.filter((item) => item.id !== id));

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  const textareaRef = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  const priorities = ["Must Have", "Should Have", "Nice to Have"];
  const statuses = ["Not Started", "In Progress", "Done"];
  
  // Filter by status
  const filteredData = data.filter(item => item.status === statusFilter);
  
  // Group by priority
  const groupedByPriority = priorities.reduce((acc, priority) => {
    acc[priority] = filteredData.filter(item => item.priority === priority);
    return acc;
  }, {});

  const notStartedCount = data.filter(c => c.status === "Not Started").length;
  const inProgressCount = data.filter(c => c.status === "In Progress").length;
  const doneCount = data.filter(c => c.status === "Done").length;

  const renderCriterion = (item, index) => (
    <div key={item.id} className={`p-3 rounded-lg border ${
      item.status === "Done" 
        ? "bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-800/40" 
        : item.status === "In Progress"
        ? "bg-blue-50/30 dark:bg-blue-900/10 border-blue-200/60 dark:border-blue-800/40"
        : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
    }`}>
      <div className="flex gap-2 items-start">
        <span className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono w-5 shrink-0">{index + 1}</span>
        <div className="flex-1 space-y-2">
          <textarea
            ref={textareaRef}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none overflow-hidden"
            style={{ minHeight: "36px" }}
            placeholder="Define an acceptance criterion..."
            value={item.text}
            onChange={(e) => {
              updateItem(item.id, "text", e.target.value);
              autoResize(e);
            }}
            onInput={autoResize}
            rows={1}
          />
          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={item.priority}
              onChange={(e) => updateItem(item.id, "priority", e.target.value)}
              className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-500"
            >
              {priorities.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={item.status}
              onChange={(e) => updateItem(item.id, "status", e.target.value)}
              className="text-xs px-2 py-1 border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-500"
            >
              {statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={() => removeItem(item.id)}
              className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 text-lg px-1 ml-auto"
            >×</button>
          </div>
          {item.notes !== undefined && (
            <textarea
              ref={textareaRef}
              className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none overflow-hidden"
              style={{ minHeight: "32px" }}
              placeholder="Additional notes or context..."
              value={item.notes}
              onChange={(e) => {
                updateItem(item.id, "notes", e.target.value);
                autoResize(e);
              }}
              onInput={autoResize}
              rows={1}
            />
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader 
        title={t.sections.acceptance || "Acceptance Criteria"} 
        description="What must be true for this feature to be considered complete and successful?" 
      />
      {data.length > 0 && (
        <div className="mb-4">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter("Not Started")}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                statusFilter === "Not Started"
                  ? "bg-slate-800 dark:bg-slate-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              Not Started {notStartedCount > 0 && `(${notStartedCount})`}
            </button>
            <button
              onClick={() => setStatusFilter("In Progress")}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                statusFilter === "In Progress"
                  ? "bg-slate-800 dark:bg-slate-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              In Progress {inProgressCount > 0 && `(${inProgressCount})`}
            </button>
            <button
              onClick={() => setStatusFilter("Done")}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                statusFilter === "Done"
                  ? "bg-slate-800 dark:bg-slate-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              Done {doneCount > 0 && `(${doneCount})`}
            </button>
          </div>
        </div>
      )}
      {data.length === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border border-dashed border-slate-200 dark:border-slate-600 rounded-lg mb-4">
          No acceptance criteria defined yet.
        </div>
      )}
      <div className="space-y-4 mb-4">
        {priorities.map(priority => {
          const items = groupedByPriority[priority];
          if (!items || items.length === 0) return null;
          return (
            <div key={priority} className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                {priority}
              </h3>
              {items.map((item, i) => renderCriterion(item, i))}
            </div>
          );
        })}
      </div>
      <button 
        onClick={addItem} 
        className="text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
      >
        + Add criterion
      </button>
    </div>
  );
};

const QuestionsSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const [statusFilter, setStatusFilter] = useState("Open");
  const addItem = () =>
    onChange([...data, { id: generateId(), text: "", type: "Stakeholder", status: "Open", answer: "", dependency: false, tags: [] }]);
  const updateItem = (id, field, val) =>
    onChange(data.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
  const removeItem = (id) => onChange(data.filter((item) => item.id !== id));
  const openCount = data.filter((q) => q.status === "Open").length;

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  const textareaRef = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  // Filter by status first
  const filteredData = data.filter(item => item.status === statusFilter);
  
  // Group questions: non-dependencies first, then by type for dependencies
  // Keep questions in main section if dependency is checked but no valid type selected yet
  const nonDependencies = filteredData.filter(item => !item.dependency || (item.dependency && !QUESTION_TYPES.includes(item.type)));
  const dependencies = filteredData.filter(item => item.dependency && QUESTION_TYPES.includes(item.type));
  const groupedDependencies = QUESTION_TYPES.reduce((acc, type) => {
    acc[type] = dependencies.filter(item => item.type === type);
    return acc;
  }, {});

  const renderQuestion = (item, index, showNumber = true) => (
    <div key={item.id} className={`p-3 rounded-lg border ${
      item.status === "Answered" 
        ? "bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600" 
        : "bg-amber-50/30 dark:bg-amber-900/10 border-amber-200/60 dark:border-amber-800/40"
    }`}>
      <div className="flex gap-2 items-start">
        {showNumber && <span className="text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono w-5 shrink-0">{index + 1}</span>}
        <div className="flex-1 space-y-2">
          <textarea
            ref={textareaRef}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none overflow-hidden"
            style={{ minHeight: "36px" }}
            placeholder="What do you need to find out?"
            value={item.text}
            onChange={(e) => {
              updateItem(item.id, "text", e.target.value);
              autoResize(e);
            }}
            onInput={autoResize}
            rows={1}
          />
          <div className="flex gap-2 flex-wrap items-center">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={item.dependency || false}
                onChange={(e) => updateItem(item.id, "dependency", e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 focus:ring-slate-300 dark:focus:ring-slate-500"
              />
              Dependency
            </label>
            {item.dependency && (
              <select
                className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                value={QUESTION_TYPES.includes(item.type) ? item.type : ""}
                onChange={(e) => updateItem(item.id, "type", e.target.value)}
              >
                {!QUESTION_TYPES.includes(item.type) && <option value="">Select type...</option>}
                {QUESTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            <select
              className="px-2 py-1 text-xs border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              value={item.status} onChange={(e) => updateItem(item.id, "status", e.target.value)}
            >
              {QUESTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={(item.tags || []).includes("B2B")}
                onChange={(e) => {
                  const tags = item.tags || [];
                  updateItem(item.id, "tags", e.target.checked ? [...tags.filter(t => t !== "B2B"), "B2B"] : tags.filter(t => t !== "B2B"));
                }}
                className="rounded border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 focus:ring-slate-300 dark:focus:ring-slate-500"
              />
              B2B
            </label>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={(item.tags || []).includes("B2C")}
                onChange={(e) => {
                  const tags = item.tags || [];
                  updateItem(item.id, "tags", e.target.checked ? [...tags.filter(t => t !== "B2C"), "B2C"] : tags.filter(t => t !== "B2C"));
                }}
                className="rounded border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 focus:ring-slate-300 dark:focus:ring-slate-500"
              />
              B2C
            </label>
          </div>
          {item.status === "Answered" && (
            <textarea
              ref={textareaRef}
              className="w-full px-2 py-1.5 text-sm border border-emerald-200 dark:border-emerald-800 rounded bg-emerald-50 dark:bg-emerald-900/20 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-300 dark:focus:ring-emerald-700 resize-none overflow-hidden"
              style={{ minHeight: "36px" }}
              placeholder="Answer..."
              value={item.answer}
              onChange={(e) => {
                updateItem(item.id, "answer", e.target.value);
                autoResize(e);
              }}
              onInput={autoResize}
              rows={1}
            />
          )}
        </div>
        <button onClick={() => removeItem(item.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 text-lg mt-1 px-1">×</button>
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title={t.sections.questions} description="What you don't know. Surface these early — they're your blocker list." />
      {data.length > 0 && (
        <div className="flex items-center justify-end mb-4">
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter("Open")}
              className={`px-2 py-1 text-xs rounded ${
                statusFilter === "Open" ? "bg-slate-800 dark:bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setStatusFilter("Answered")}
              className={`px-2 py-1 text-xs rounded ${
                statusFilter === "Answered" ? "bg-slate-800 dark:bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              Answered
            </button>
          </div>
        </div>
      )}
      {data.length === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border border-dashed border-slate-200 dark:border-slate-600 rounded-lg mb-4">
          No questions logged yet.
        </div>
      )}
      <div className="space-y-4 mb-4">
        {nonDependencies.length > 0 && (
          <div className="space-y-3">
            {nonDependencies.map((item, i) => renderQuestion(item, i))}
          </div>
        )}
        {QUESTION_TYPES.map(type => {
          const items = groupedDependencies[type];
          if (!items || items.length === 0) return null;
          return (
            <div key={type} className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mt-6">{type}</h3>
              {items.map((item) => renderQuestion(item, 0, false))}
            </div>
          );
        })}
      </div>
      <button onClick={addItem} className="text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
        + Add question
      </button>
    </div>
  );
};

const ActionsSection = ({ data, onChange }) => {
  const [statusFilter, setStatusFilter] = useState("To Do");
  const [expandedNotes, setExpandedNotes] = useState({});
  const addItem = () => onChange([...data, { id: generateId(), text: "", completed: false, note: "" }]);
  const updateItem = (id, field, val) =>
    onChange(data.map((item) => (item.id === id ? { ...item, [field]: val } : item)));
  const removeItem = (id) => onChange(data.filter((item) => item.id !== id));
  const toggleNote = (id) => setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }));

  const autoResize = (e) => {
    e.target.style.height = "auto";
    e.target.style.height = e.target.scrollHeight + "px";
  };

  const textareaRef = (el) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  };

  const completedCount = data.filter(item => item.completed).length;
  const filteredData = statusFilter === "To Do" 
    ? data.filter(item => !item.completed)
    : data.filter(item => item.completed);

  return (
    <div>
      {data.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">{completedCount} of {data.length} completed</p>
          <div className="flex gap-1">
            <button
              onClick={() => setStatusFilter("To Do")}
              className={`px-2 py-1 text-xs rounded ${
                statusFilter === "To Do" ? "bg-slate-800 dark:bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              To Do
            </button>
            <button
              onClick={() => setStatusFilter("Done")}
              className={`px-2 py-1 text-xs rounded ${
                statusFilter === "Done" ? "bg-slate-800 dark:bg-slate-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600"
              }`}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {data.length === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm border border-dashed border-slate-200 dark:border-slate-600 rounded-lg mb-4">
          No action items yet. Add tasks below.
        </div>
      )}
      <div className="space-y-2 mb-4">
        {filteredData.map((item) => (
          <div key={item.id} className={`rounded-lg ${item.completed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600'}`}>
            <div className="flex gap-3 items-start p-3">
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(e) => updateItem(item.id, "completed", e.target.checked)}
                className={`w-5 h-5 mt-1 rounded focus:ring-2 shrink-0 ${item.completed ? 'border-green-400 dark:border-green-500 text-green-600 dark:text-green-500 focus:ring-green-400 dark:focus:ring-green-500' : 'border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-200 focus:ring-slate-400 dark:focus:ring-slate-500'}`}
              />
              <div className="flex-1 min-w-0">
                <textarea
                  ref={textareaRef}
                  className={`w-full text-sm border-none bg-transparent focus:outline-none resize-none overflow-hidden ${item.completed ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-slate-100'}`}
                  style={{ minHeight: "24px" }}
                  placeholder="Describe the action..."
                  value={item.text}
                  onChange={(e) => {
                    updateItem(item.id, "text", e.target.value);
                    autoResize(e);
                  }}
                  onInput={autoResize}
                  rows={1}
                />
                {expandedNotes[item.id] && (
                  <textarea
                    ref={textareaRef}
                    className="w-full mt-2 px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none overflow-hidden text-slate-900 dark:text-slate-100"
                    style={{ minHeight: "36px" }}
                    placeholder="Add a note or link..."
                    value={item.note || ""}
                    onChange={(e) => {
                      updateItem(item.id, "note", e.target.value);
                      autoResize(e);
                    }}
                    onInput={autoResize}
                    rows={1}
                  />
                )}
              </div>
              <div className="flex items-center gap-1">
                {item.completed && (
                  <button
                    onClick={() => toggleNote(item.id)}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm shrink-0"
                  >
                    {expandedNotes[item.id] ? '⌄' : '⌃'}
                  </button>
                )}
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 text-lg shrink-0"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={addItem} className="text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-50 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2.5 hover:border-slate-400 dark:hover:border-slate-500 transition-colors font-medium">
        + Add Action
      </button>
    </div>
  );
};

const NotesSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  return (
  <div>
    <SectionHeader title={t.sections.notes} description="Additional notes, observations, or reminders about this requirement." />
    <Field label="Notes" multiline hint="Use this space for any additional information that doesn't fit elsewhere." rows={10} value={data} onChange={onChange} />
  </div>
  );
};

const RESEARCH_METHODOLOGIES = [
  "Usability Testing", "A/B Testing", "User Interview", "Survey",
  "Card Sorting", "Tree Testing", "Heuristic Review", "Contextual Inquiry", "Other"
];

const UserResearchSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const rounds = data.rounds || [];
  
  const addRound = () => {
    const newRound = {
      id: Math.random().toString(36).slice(2, 10),
      name: `Round ${rounds.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      methodology: "",
      participants: "",
      hypotheses: "",
      scenarios: [],
      findings: "",
      recommendations: ""
    };
    onChange({ ...data, rounds: [...rounds, newRound] });
  };
  
  const updateRound = (id, updates) => {
    onChange({ ...data, rounds: rounds.map(r => r.id === id ? { ...r, ...updates } : r) });
  };
  
  const deleteRound = (id) => {
    onChange({ ...data, rounds: rounds.filter(r => r.id !== id) });
  };
  
  const addScenario = (roundId) => {
    const round = rounds.find(r => r.id === roundId);
    if (!round) return;
    const newScenario = { id: Math.random().toString(36).slice(2, 10), task: "", expectedOutcome: "", result: "", notes: "" };
    updateRound(roundId, { scenarios: [...(round.scenarios || []), newScenario] });
  };
  
  const updateScenario = (roundId, scenarioId, updates) => {
    const round = rounds.find(r => r.id === roundId);
    if (!round) return;
    updateRound(roundId, { scenarios: (round.scenarios || []).map(s => s.id === scenarioId ? { ...s, ...updates } : s) });
  };
  
  const deleteScenario = (roundId, scenarioId) => {
    const round = rounds.find(r => r.id === roundId);
    if (!round) return;
    updateRound(roundId, { scenarios: (round.scenarios || []).filter(s => s.id !== scenarioId) });
  };
  
  const [expandedRounds, setExpandedRounds] = useState({});
  const toggleExpand = (id) => setExpandedRounds(prev => ({ ...prev, [id]: !prev[id] }));
  
  return (
    <div>
      <SectionHeader title={t.sections.research || "User Research"} description="Plan research rounds, document test scenarios, and capture findings to iterate on your design." />
      
      {rounds.length === 0 && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          <svg className="w-10 h-10 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">No research rounds yet</p>
          <p className="text-xs mt-1">Add a round to plan and document user testing</p>
        </div>
      )}
      
      <div className="space-y-3">
        {rounds.map((round, idx) => {
          const isExpanded = expandedRounds[round.id] !== false;
          const scenarioCount = (round.scenarios || []).length;
          const hasFindings = round.findings?.trim();
          
          return (
            <div key={round.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 cursor-pointer"
                onClick={() => toggleExpand(round.id)}
              >
                <div className="flex items-center gap-3">
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{round.name || `Round ${idx + 1}`}</span>
                  {round.methodology && <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">{round.methodology}</span>}
                  {scenarioCount > 0 && <span className="text-xs text-slate-500 dark:text-slate-400">{scenarioCount} scenario{scenarioCount !== 1 ? 's' : ''}</span>}
                  {hasFindings && <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded">Has findings</span>}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRound(round.id); }}
                  className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                  title="Delete round"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              
              {isExpanded && (
                <div className="px-4 py-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Round Name</label>
                      <input
                        type="text"
                        value={round.name || ""}
                        onChange={(e) => updateRound(round.id, { name: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Date</label>
                      <input
                        type="date"
                        value={round.date || ""}
                        onChange={(e) => updateRound(round.id, { date: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Methodology</label>
                    <select
                      value={round.methodology || ""}
                      onChange={(e) => updateRound(round.id, { methodology: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
                    >
                      <option value="">Select methodology...</option>
                      {RESEARCH_METHODOLOGIES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Participants</label>
                    <AutoResizeTextarea
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none"
                      rows={2}
                      value={round.participants || ""}
                      onChange={(e) => updateRound(round.id, { participants: e.target.value })}
                      placeholder="Number and type of participants, recruitment criteria..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hypotheses</label>
                    <AutoResizeTextarea
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none"
                      rows={2}
                      value={round.hypotheses || ""}
                      onChange={(e) => updateRound(round.id, { hypotheses: e.target.value })}
                      placeholder="What are you trying to validate or learn?"
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">Test Scenarios</label>
                      <button
                        onClick={() => addScenario(round.id)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                      >
                        + Add scenario
                      </button>
                    </div>
                    
                    {(round.scenarios || []).length === 0 && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 italic">No test scenarios defined yet</p>
                    )}
                    
                    <div className="space-y-2">
                      {(round.scenarios || []).map((scenario, sIdx) => (
                        <div key={scenario.id} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-800">
                          <div className="flex items-start justify-between mb-2">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Scenario {sIdx + 1}</span>
                            <button
                              onClick={() => deleteScenario(round.id, scenario.id)}
                              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={scenario.task || ""}
                              onChange={(e) => updateScenario(round.id, scenario.id, { task: e.target.value })}
                              placeholder="Task: What the user should try to do..."
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
                            />
                            <input
                              type="text"
                              value={scenario.expectedOutcome || ""}
                              onChange={(e) => updateScenario(round.id, scenario.id, { expectedOutcome: e.target.value })}
                              placeholder="Expected outcome: What success looks like..."
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
                            />
                            <select
                              value={scenario.result || ""}
                              onChange={(e) => updateScenario(round.id, scenario.id, { result: e.target.value })}
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
                            >
                              <option value="">Result: Not tested yet</option>
                              <option value="pass">✓ Pass — Users completed successfully</option>
                              <option value="partial">◐ Partial — Completed with difficulty</option>
                              <option value="fail">✗ Fail — Users could not complete</option>
                            </select>
                            <AutoResizeTextarea
                              className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none"
                              rows={1}
                              value={scenario.notes || ""}
                              onChange={(e) => updateScenario(round.id, scenario.id, { notes: e.target.value })}
                              placeholder="Observations, quotes, notable behaviors..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Findings</label>
                    <AutoResizeTextarea
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none"
                      rows={3}
                      value={round.findings || ""}
                      onChange={(e) => updateRound(round.id, { findings: e.target.value })}
                      placeholder="Key observations, patterns, pain points discovered..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Recommendations</label>
                    <AutoResizeTextarea
                      className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none"
                      rows={3}
                      value={round.recommendations || ""}
                      onChange={(e) => updateRound(round.id, { recommendations: e.target.value })}
                      placeholder="Design changes, iterations, or next steps based on findings..."
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <button
        onClick={addRound}
        className="mt-4 w-full px-4 py-2.5 text-sm font-medium border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        + Add Research Round
      </button>
    </div>
  );
};

const DESIGN_REF_TYPES = ["figma", "figjam", "image"];
const DESIGN_REF_TYPE_LABELS = { figma: "Figma", figjam: "Figjam", image: "Image" };

const DesignReferencesSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const references = data.references || [];

  const addReference = () => {
    onChange({ ...data, references: [...references, { id: generateId(), type: "figma", url: "", label: "", status: "wip", imageData: "" }] });
  };
  const updateRef = (id, updates) => {
    onChange({ ...data, references: references.map(r => r.id === id ? { ...r, ...updates } : r) });
  };
  const removeRef = (id) => {
    onChange({ ...data, references: references.filter(r => r.id !== id) });
  };
  const handleImageUpload = (id, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Image too large. Max 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => updateRef(id, { imageData: ev.target.result, url: file.name });
    reader.readAsDataURL(file);
  };

  return (
  <div>
    <SectionHeader title={t.sections.designRefs || "Design References"} description="Figma files, Figjam boards, and reference images for this design task." />
    
    {references.length === 0 && (
      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
        <p className="text-3xl mb-2">◱</p>
        <p className="text-sm">No design references yet. Add Figma links, Figjam boards, or images.</p>
      </div>
    )}

    <div className="space-y-4">
      {references.map((ref, idx) => (
        <div key={ref.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0">#{idx + 1}</span>
              <input
                type="text"
                value={ref.label || ""}
                onChange={(e) => updateRef(ref.id, { label: e.target.value })}
                placeholder="Label (e.g., Main flow, Login screen...)"
                className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <button onClick={() => removeRef(ref.id)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm shrink-0" title="Remove">✕</button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            {/* Type selector */}
            <div className="flex items-center gap-1">
              {DESIGN_REF_TYPES.map(type => (
                <button
                  key={type}
                  onClick={() => updateRef(ref.id, { type, imageData: type !== "image" ? "" : ref.imageData })}
                  className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                    ref.type === type
                      ? 'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-500'
                      : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300'
                  }`}
                >
                  {DESIGN_REF_TYPE_LABELS[type]}
                </button>
              ))}
            </div>

            {/* Status toggle */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => updateRef(ref.id, { status: 'wip' })}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                  ref.status === 'wip'
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700'
                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                }`}
              >WIP</button>
              <button
                onClick={() => updateRef(ref.id, { status: 'final' })}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                  ref.status === 'final'
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700'
                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600'
                }`}
              >Final</button>
            </div>
          </div>

          {/* URL input for figma/figjam */}
          {ref.type !== "image" && (
            <div className="mb-3">
              <input
                type="text"
                value={ref.url || ""}
                onChange={(e) => updateRef(ref.id, { url: e.target.value })}
                placeholder={ref.type === "figjam" ? "https://embed.figma.com/board/..." : "https://embed.figma.com/design/..."}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
              />
            </div>
          )}

          {/* Image upload for image type */}
          {ref.type === "image" && (
            <div className="mb-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(ref.id, e)}
                className="block w-full text-sm text-slate-500 dark:text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-100 dark:file:bg-slate-600 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200"
              />
            </div>
          )}

          {/* Preview: iframe for figma/figjam, thumbnail for image */}
          {ref.type !== "image" && ref.url && (
            <details className="mt-2">
              <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">Show embed preview</summary>
              <div className="mt-2 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800" style={{ height: "400px" }}>
                <iframe style={{ border: "none" }} width="100%" height="100%" src={ref.url} allowFullScreen className="w-full h-full" />
              </div>
            </details>
          )}
          {ref.type === "image" && ref.imageData && (
            <details className="mt-2" open>
              <summary className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">Show image preview</summary>
              <div className="mt-2">
                <img src={ref.imageData} alt={ref.label || "Reference"} className="max-w-full rounded-lg border border-slate-200 dark:border-slate-700" style={{ maxHeight: "400px" }} />
              </div>
            </details>
          )}
        </div>
      ))}
    </div>

    <button
      onClick={addReference}
      className="mt-4 w-full px-4 py-2.5 text-sm font-medium border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
    >
      + Add Reference
    </button>

    <div className="mt-4">
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Notes</label>
      <AutoResizeTextarea
        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 resize-none"
        rows={2}
        value={data.notes || ""}
        onChange={(e) => onChange({ ...data, notes: e.target.value })}
        placeholder="General notes about design references..."
      />
    </div>
  </div>
  );
};

const CODE_REF_TYPES = ["prototype", "production", "package", "docs", "other"];
const CODE_REF_TYPE_LABELS = { prototype: "Prototype", production: "Production", package: "Package/Library", docs: "Documentation", other: "Other" };

const CodeReferencesSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const repos = data.repos || [];

  const addRepo = () => {
    onChange({ ...data, repos: [...repos, { id: generateId(), url: "", label: "", type: "prototype", branch: "", notes: "" }] });
  };
  const updateRepo = (id, updates) => {
    onChange({ ...data, repos: repos.map(r => r.id === id ? { ...r, ...updates } : r) });
  };
  const removeRepo = (id) => {
    onChange({ ...data, repos: repos.filter(r => r.id !== id) });
  };

  return (
  <div>
    <SectionHeader title={t.sections.codeRefs || "Code References"} description="GitHub repos, prototype links, package references, and documentation for this feature." />

    {repos.length === 0 && (
      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
        <p className="text-3xl mb-2">◇</p>
        <p className="text-sm">No code references yet. Add GitHub repos, prototypes, or documentation links.</p>
      </div>
    )}

    <div className="space-y-3">
      {repos.map((repo, idx) => (
        <div key={repo.id} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0">#{idx + 1}</span>
              <input
                type="text"
                value={repo.label || ""}
                onChange={(e) => updateRepo(repo.id, { label: e.target.value })}
                placeholder="Label (e.g., Frontend repo, API docs...)"
                className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <button onClick={() => removeRepo(repo.id)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors text-sm shrink-0" title="Remove">✕</button>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {CODE_REF_TYPES.map(type => (
              <button
                key={type}
                onClick={() => updateRepo(repo.id, { type })}
                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                  repo.type === type
                    ? 'bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-500'
                    : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300'
                }`}
              >
                {CODE_REF_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div className="sm:col-span-3">
              <input
                type="text"
                value={repo.url || ""}
                onChange={(e) => updateRepo(repo.id, { url: e.target.value })}
                placeholder="https://github.com/org/repo"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
              />
            </div>
            <div>
              <input
                type="text"
                value={repo.branch || ""}
                onChange={(e) => updateRepo(repo.id, { branch: e.target.value })}
                placeholder="Branch/tag"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500"
              />
            </div>
          </div>

          <div className="mt-2">
            <input
              type="text"
              value={repo.notes || ""}
              onChange={(e) => updateRepo(repo.id, { notes: e.target.value })}
              placeholder="Notes (e.g., check /src/components for patterns...)"
              className="w-full px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-300"
            />
          </div>
        </div>
      ))}
    </div>

    <button
      onClick={addRepo}
      className="mt-4 w-full px-4 py-2.5 text-sm font-medium border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
    >
      + Add Code Reference
    </button>
  </div>
  );
};

const DESIGN_SYSTEM_PRESETS = {
  'b2c': {
    label: 'Live B2C (tre.se)',
    systemName: 'Tre Consumer Design System',
    description: 'Consumer-facing design system for tre.se. Swedish locale, responsive, dark navy primary color.',
  },
  'b2b': {
    label: 'Live B2B (Tre Företag)',
    systemName: 'Tre Business Design System',
    description: 'Business-facing design system for Tre Företag. Swedish locale, professional tone, enterprise patterns.',
  },
  'custom': {
    label: 'Custom / Other',
    systemName: '',
    description: '',
  },
};

const DesignSystemSection = ({ data, language, onChange }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const preset = data.preset || 'custom';
  
  const handlePresetChange = (presetId) => {
    const p = DESIGN_SYSTEM_PRESETS[presetId];
    if (presetId === 'custom') {
      onChange({ ...data, preset: presetId });
    } else {
      onChange({
        ...data,
        preset: presetId,
        systemName: p.systemName,
      });
    }
  };
  
  return (
  <div>
    <SectionHeader title={t.sections.design} description="Reference your design system for consistent component usage and AI context." />
    
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Design System</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(DESIGN_SYSTEM_PRESETS).map(([id, p]) => (
            <button
              key={id}
              onClick={() => handlePresetChange(id)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                preset === id
                  ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-800 border-slate-800 dark:border-slate-200'
                  : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset !== 'custom' && DESIGN_SYSTEM_PRESETS[preset]?.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{DESIGN_SYSTEM_PRESETS[preset].description}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.fields.designSystemName}</label>
        <input
          type="text"
          value={data.systemName || ""}
          onChange={(e) => onChange({ ...data, systemName: e.target.value })}
          placeholder="e.g., Material Design, Carbon, Polaris"
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.fields.designVersion}</label>
        <input
          type="text"
          value={data.version || ""}
          onChange={(e) => onChange({ ...data, version: e.target.value })}
          placeholder="e.g., v3.2, 2024.1"
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.fields.componentLibrary}</label>
        <input
          type="text"
          value={data.componentLibrary || ""}
          onChange={(e) => onChange({ ...data, componentLibrary: e.target.value })}
          placeholder="e.g., @company/design-system, npm package name"
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Package or repository reference for the component library</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.fields.tokensLink}</label>
        <input
          type="url"
          value={data.tokensLink || ""}
          onChange={(e) => onChange({ ...data, tokensLink: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Link to design tokens documentation (colors, typography, spacing)</p>
      </div>

      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.fields.figmaDesignUrl}</label>
        <input
          type="url"
          value={data.figmaUrl || ""}
          onChange={(e) => onChange({ ...data, figmaUrl: e.target.value })}
          placeholder="https://www.figma.com/design/..."
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Link to your Figma design system file</p>
        
        {data.figmaUrl && (
          <a
            href={data.figmaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 3c-1.093 0-2 .907-2 2v14c0 1.093.907 2 2 2h6v-2H5V5h6V3H5zm9 0v2h5v14h-5v2h5c1.093 0 2-.907 2-2V5c0-1.093-.907-2-2-2h-5zm-2 5v3H9v2h3v3h2v-3h3v-2h-3V8h-2z"/>
            </svg>
            Open in Figma
          </a>
        )}
      </div>

      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t.fields.mcpInstructions}</label>
        <textarea
          value={data.mcpInstructions || ""}
          onChange={(e) => onChange({ ...data, mcpInstructions: e.target.value })}
          placeholder={"Example MCP setup command:\nnpx -y @modelcontextprotocol/server-figma --access-token YOUR_TOKEN --file-key abc123\n\nOr include instructions for your specific MCP configuration for AI agents to access this Figma file."}
          rows={6}
          className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          <strong>For AI Context:</strong> Provide setup instructions or MCP connection details so AI agents (like GitHub Copilot with Figma MCP) can access design system components, tokens, and patterns programmatically. This helps AI provide context-aware design suggestions.
        </p>
      </div>
    </div>
  </div>
  );
};

const WireframeSection = ({ data, analysis, language, githubAIKey, onChange }) => {
  const [iaGenerating, setIaGenerating] = useState(false);
  const [wireframeGenerating, setWireframeGenerating] = useState(null); // step id being generated
  const [expandedStep, setExpandedStep] = useState(null);
  const steps = data.iaSteps || [];

  const generateIASkeleton = async () => {
    if (!githubAIKey) return;
    setIaGenerating(true);
    try {
      const briefContext = [
        analysis.overview?.description && `Description: ${analysis.overview.description}`,
        analysis.overview?.featureName && `Feature: ${analysis.overview.featureName}`,
        analysis.problem?.problem && `Problem: ${analysis.problem.problem}`,
        analysis.problem?.outcome && `Desired outcome: ${analysis.problem.outcome}`,
        analysis.context?.workflow && `Current workflow: ${analysis.context.workflow}`,
        analysis.context?.segments && `Users: ${analysis.context.segments}`,
        analysis.scope?.affected && `Affected areas: ${analysis.scope.affected}`,
        ...(analysis.acceptanceCriteria || []).filter(c => c.text?.trim()).map(c => `Criteria [${c.priority}]: ${c.text}`),
        ...(analysis.scope?.items || []).filter(i => i.text?.trim() && i.version !== 'Cut').map(i => `Scope [${i.version}]: ${i.text}`),
      ].filter(Boolean).join('\n');

      const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${githubAIKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: 'You are a UX/IA architect. Given a feature brief, generate an information architecture skeleton as a list of screens/steps the user will go through. Return a JSON array of objects with "name" (short screen/step name), "description" (one sentence explaining the purpose), and "type" (either "frontend" for user-facing screens/pages/forms or "backend" for server-side processing, API calls, third-party integrations, data sync, authentication services, or any step without a visible UI). Order them in the logical user flow. Keep it to 4-10 steps. Return ONLY the JSON array, no markdown.'
          }, {
            role: 'user',
            content: briefContext
          }],
          temperature: 0.7,
          max_tokens: 1500
        })
      });
      if (!response.ok) throw new Error('API error');
      const result = await response.json();
      const content = result.choices[0].message.content;
      const parsed = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      if (Array.isArray(parsed)) {
        const newSteps = parsed.map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          name: s.name || `Step ${i + 1}`,
          description: s.description || '',
          type: s.type === 'backend' ? 'backend' : 'frontend',
          designTask: s.type !== 'backend',
          wireframe: '',
          detailLevel: 'medium',
          prompt: ''
        }));
        onChange({ ...data, iaSteps: newSteps });
      }
    } catch (err) {
      console.error('IA generation failed:', err);
    } finally {
      setIaGenerating(false);
    }
  };

  const generateWireframe = async (stepId) => {
    if (!githubAIKey) return;
    const step = steps.find(s => s.id === stepId);
    if (!step) return;
    setWireframeGenerating(stepId);
    try {
      const contextParts = [
        analysis.overview?.featureName && `Feature: ${analysis.overview.featureName}`,
        analysis.overview?.description && `Description: ${analysis.overview.description}`,
        analysis.design?.systemName && `Design System: ${analysis.design.systemName}`,
        analysis.context?.segments && `Target users: ${analysis.context.segments}`,
      ].filter(Boolean).join('\n');

      const iaContext = steps.map((s, i) => `${i + 1}. ${s.name}: ${s.description}`).join('\n');
      const promptExtra = step.prompt?.trim() ? `\nAdditional instructions: ${step.prompt}` : '';

      const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${githubAIKey}` },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'system',
            content: `You are a UX wireframe specialist. Create an ASCII wireframe for a screen/step using box-drawing characters. Detail level: ${step.detailLevel === 'high' ? 'HIGH - include all UI elements, labels, placeholder text, buttons, form fields, navigation, status indicators' : 'MEDIUM - show main layout areas, key elements, primary actions'}. Use characters like ┌─┐│└─┘├┤┬┴┼ for borders, ═ for emphasis, [ Button ] for buttons, [___________] for inputs, (○) (●) for radio, [☐] [☑] for checkboxes. Keep width under 70 characters. Return ONLY the ASCII wireframe, no explanations.`
          }, {
            role: 'user',
            content: `Screen: ${step.name}\nPurpose: ${step.description}\n\nFull IA flow:\n${iaContext}\n\nProject context:\n${contextParts}${promptExtra}`
          }],
          temperature: 0.7,
          max_tokens: 2000
        })
      });
      if (!response.ok) throw new Error('API error');
      const result = await response.json();
      const wireframeText = result.choices[0].message.content.replace(/```[a-z]*\n?/g, '').replace(/```/g, '').trim();
      const updated = steps.map(s => s.id === stepId ? { ...s, wireframe: wireframeText } : s);
      onChange({ ...data, iaSteps: updated });
    } catch (err) {
      console.error('Wireframe generation failed:', err);
    } finally {
      setWireframeGenerating(null);
    }
  };

  const updateStep = (stepId, field, value) => {
    const updated = steps.map(s => s.id === stepId ? { ...s, [field]: value } : s);
    onChange({ ...data, iaSteps: updated });
  };

  const addStep = () => {
    const newStep = {
      id: `step-${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      description: '',
      type: 'frontend',
      designTask: true,
      wireframe: '',
      detailLevel: 'medium',
      prompt: ''
    };
    onChange({ ...data, iaSteps: [...steps, newStep] });
  };

  const deleteStep = (stepId) => {
    onChange({ ...data, iaSteps: steps.filter(s => s.id !== stepId) });
  };

  const moveStep = (index, direction) => {
    const newSteps = [...steps];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    onChange({ ...data, iaSteps: newSteps });
  };

  return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Structure</h2>
      <div className="flex items-center gap-2">
        <button
          onClick={addStep}
          className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        >
          + Add Screen
        </button>
        <button
          onClick={generateIASkeleton}
          disabled={iaGenerating || !githubAIKey}
          className="px-4 py-2 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {iaGenerating ? 'Generating...' : steps.length > 0 ? 'Regenerate IA' : 'Generate IA from Brief'}
        </button>
      </div>
    </div>

    {!githubAIKey && (
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Set your GitHub AI key in the Overview tab to enable AI generation.
      </p>
    )}

    {/* IA Sitemap Diagram — Vertical with inline expansion */}
    {steps.length > 0 && (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Information Architecture</p>
        <div className="flex flex-col items-center gap-0">
          {steps.map((step, index) => {
            const isExpanded = expandedStep === step.id;
            return (
            <div key={step.id} className="flex flex-col items-center w-full">
              <div className={`w-full max-w-md mx-auto rounded-lg border-2 transition-all ${step.type === 'backend' ? 'border-dashed ' : ''}${
                  isExpanded
                    ? step.type === 'backend'
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-50/50 dark:bg-amber-900/20 shadow-md'
                      : 'border-slate-800 dark:border-slate-300 bg-slate-50 dark:bg-slate-700/50 shadow-md'
                    : step.type === 'backend'
                      ? step.wireframe
                        ? 'border-amber-400 dark:border-amber-500/60 bg-white dark:bg-slate-800 hover:border-amber-500 dark:hover:border-amber-400'
                        : 'border-amber-200 dark:border-amber-600/40 bg-white dark:bg-slate-800 hover:border-amber-400 dark:hover:border-amber-500/60'
                      : step.wireframe
                        ? 'border-slate-400 dark:border-slate-500 bg-white dark:bg-slate-800 hover:border-slate-600 dark:hover:border-slate-400'
                        : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500'
                }`}>
                {/* Clickable header */}
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full px-4 py-3 text-left"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{step.name}</span>
                        {step.type === 'backend' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-medium">Backend</span>
                        )}
                        {step.designTask && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium">Design</span>
                        )}
                      </div>
                      {!isExpanded && step.description && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 block mt-0.5">{step.description}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {step.wireframe && (
                        <span className="w-2.5 h-2.5 bg-green-500 rounded-full" title="Has wireframe" />
                      )}
                      <span className={`text-xs text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>⌄</span>
                    </div>
                  </div>
                </button>

                {/* Expanded inline content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-200/50 dark:border-slate-600/50 pt-3">
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateStep(step.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 text-sm font-medium border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      placeholder="Screen name"
                    />
                    <AutoResizeTextarea
                      value={step.description}
                      onChange={(e) => updateStep(step.id, 'description', e.target.value)}
                      placeholder="Screen purpose / description"
                      rows={1}
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none"
                    />

                    {/* Type + Design toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {['frontend', 'backend'].map(t => (
                          <button
                            key={t}
                            onClick={() => updateStep(step.id, 'type', t)}
                            className={`px-2.5 py-1.5 text-xs rounded font-medium ${(step.type || 'frontend') === t
                              ? t === 'backend'
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-600'
                                : 'bg-slate-800 dark:bg-slate-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                          >
                            {t === 'frontend' ? 'Frontend' : 'Backend'}
                          </button>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <span className="text-xs text-slate-500 dark:text-slate-400">Design task</span>
                        <button
                          onClick={() => updateStep(step.id, 'designTask', !step.designTask)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${step.designTask ? 'bg-blue-500 dark:bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${step.designTask ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </label>
                    </div>

                    {/* Wireframe controls */}
                    <div className="space-y-3 pt-1 border-t border-slate-200/50 dark:border-slate-600/50">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Detail:</span>
                          {['medium', 'high'].map(level => (
                            <button
                              key={level}
                              onClick={() => updateStep(step.id, 'detailLevel', level)}
                              className={`px-2 py-1 text-xs rounded ${step.detailLevel === level ? 'bg-slate-800 dark:bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                            >
                              {level === 'medium' ? 'Medium' : 'High'}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={step.prompt || ''}
                          onChange={(e) => updateStep(step.id, 'prompt', e.target.value)}
                          placeholder="Refinement prompt (e.g. 'two columns', 'add sidebar')"
                          className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>

                      {step.wireframe && (
                        <textarea
                          value={step.wireframe}
                          onChange={(e) => updateStep(step.id, 'wireframe', e.target.value)}
                          rows={Math.min(Math.max(step.wireframe.split('\n').length + 1, 8), 30)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 font-mono leading-relaxed"
                          style={{ tabSize: 4 }}
                        />
                      )}

                      {/* Bottom bar: Delete left, Move center, Update right */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-600/50">
                        <button onClick={() => { deleteStep(step.id); setExpandedStep(null); }} className="px-2.5 py-1.5 text-xs rounded border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium">Delete</button>
                        <div className="flex items-center gap-1">
                          <button onClick={() => moveStep(index, -1)} disabled={index === 0} className="px-3 py-1.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-700 font-medium">⌃ Up</button>
                          <button onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1} className="px-3 py-1.5 text-xs rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-100 dark:disabled:hover:bg-slate-700 font-medium">⌄ Down</button>
                        </div>
                        <button
                          onClick={() => generateWireframe(step.id)}
                          disabled={wireframeGenerating === step.id || !githubAIKey}
                          className="px-3 py-1.5 text-xs bg-slate-800 dark:bg-slate-700 text-white rounded hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        >
                          {wireframeGenerating === step.id ? 'Updating...' : step.wireframe ? 'Update wireframe' : 'Generate wireframe'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {index < steps.length - 1 && (
                <span className="text-slate-300 dark:text-slate-600 text-sm my-1">↓</span>
              )}
            </div>
            );
          })}
        </div>
      </div>
    )}

    {steps.length === 0 && !iaGenerating && (
      <div className="text-center py-12 text-slate-400 dark:text-slate-500">
        <p className="text-3xl mb-2">◧</p>
        <p className="text-sm">Generate an IA sitemap from your brief data, or add screens manually.</p>
      </div>
    )}
  </div>
  );
};

const AI_BRIEF_SECTIONS = [
  { id: 'overview', label: 'Overview', description: 'Feature name, description, stakeholders', recommended: true },
  { id: 'problem', label: 'Problem & Purpose', description: 'Problem statement, business outcome, metrics', recommended: true },
  { id: 'context', label: 'User Context', description: 'User segments, workflow, workarounds', recommended: true },
  { id: 'assumptions', label: 'Assumptions', description: 'Validated and unvalidated assumptions', recommended: false },
  { id: 'edges', label: 'Edge Cases', description: 'Technical constraints and edge cases', recommended: false },
  { id: 'scope', label: 'Scope & Versions', description: 'Scope items, versioning, technical notes', recommended: true },
  { id: 'acceptance', label: 'Acceptance Criteria', description: 'Must have, should have, nice to have', recommended: true },
  { id: 'questions', label: 'Open Questions', description: 'Pending and resolved questions', recommended: false },
  { id: 'notes', label: 'Notes', description: 'Additional context and notes', recommended: false },
  { id: 'research', label: 'User Research', description: 'Research plans, test scenarios, findings', recommended: false },
  { id: 'mapping', label: 'Mapping', description: 'Figma/Figjam visual references (legacy)', recommended: false },
  { id: 'designRefs', label: 'Design References', description: 'Figma files, Figjam boards, reference images', recommended: false },
  { id: 'codeRefs', label: 'Code References', description: 'GitHub repos, prototypes, documentation', recommended: false },
  { id: 'design', label: 'Design System', description: 'Design system, tokens, MCP config', recommended: true },
  { id: 'wireframe', label: 'Structure', description: 'IA sitemap and ASCII wireframes', recommended: false },
  { id: 'actions', label: 'Action Items', description: 'Task list and next steps', recommended: false },
];

const RECOMMENDED_SECTIONS = AI_BRIEF_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: s.recommended }), {});

const BRIEF_FILE_GROUPS = [
  { id: 'core-brief', label: 'Core Brief', filename: 'core-brief', sections: ['overview', 'problem', 'context', 'scope', 'acceptance'], description: 'Primary design brief with problem, context, and requirements' },
  { id: 'research', label: 'Research & Discovery', filename: 'research', sections: ['research', 'assumptions', 'questions', 'edges'], description: 'User research findings, assumptions, open questions, edge cases' },
  { id: 'references', label: 'References', filename: 'references', sections: ['mapping', 'designRefs', 'codeRefs', 'design', 'wireframe'], description: 'Design files, code repos, design system, wireframes' },
  { id: 'operational', label: 'Operational', filename: 'operational', sections: ['actions', 'notes'], description: 'Action items and additional notes' },
];

function estimateTokenCount(analysis, sectionIds) {
  let wordCount = 0;
  const countStr = (s) => { if (s?.trim()) wordCount += s.trim().split(/\s+/).length; };
  const countArr = (arr, key) => { (arr || []).forEach(item => { if (key) countStr(item[key]); else Object.values(item).forEach(v => { if (typeof v === 'string') countStr(v); }); }); };
  sectionIds.forEach(id => {
    switch (id) {
      case 'overview': Object.values(analysis.overview || {}).forEach(countStr); break;
      case 'problem': Object.values(analysis.problem || {}).forEach(countStr); break;
      case 'context': Object.values(analysis.context || {}).forEach(countStr); break;
      case 'scope': Object.values(analysis.scope || {}).forEach(v => { if (typeof v === 'string') countStr(v); }); countArr(analysis.scope?.items); break;
      case 'acceptance': countArr(analysis.acceptanceCriteria, 'text'); break;
      case 'assumptions': countArr(analysis.assumptions, 'text'); break;
      case 'questions': countArr(analysis.questions, 'text'); break;
      case 'edges': Object.values(analysis.edges || {}).forEach(e => countStr(e.notes)); break;
      case 'research': (analysis.research?.rounds || []).forEach(r => { countStr(r.findings); countStr(r.recommendations); countStr(r.hypotheses); }); break;
      case 'designRefs': countArr(analysis.designRefs?.references, 'label'); break;
      case 'codeRefs': countArr(analysis.codeRefs?.repos, 'notes'); break;
      case 'design': Object.values(analysis.design || {}).forEach(countStr); break;
      case 'wireframe': (analysis.wireframe?.iaSteps || []).forEach(s => { countStr(s.wireframe); countStr(s.description); }); break;
      case 'actions': countArr(analysis.actions, 'text'); break;
      case 'notes': countStr(analysis.notes); break;
    }
  });
  return Math.round(wordCount * 1.3); // ~1.3 tokens per word for structured markdown
}

const SummarySection = ({ data, language, onChange, onGenerateAIBrief, analysis }) => {
  const t = TRANSLATIONS[language] || TRANSLATIONS.en;
  const included = data.includedSections || { ...RECOMMENDED_SECTIONS };
  
  const toggleSection = (id) => {
    onChange({ ...data, includedSections: { ...included, [id]: !included[id] } });
  };
  
  const allSelected = AI_BRIEF_SECTIONS.every(s => included[s.id]);
  const toggleAll = () => {
    const newVal = !allSelected;
    const newIncluded = AI_BRIEF_SECTIONS.reduce((acc, s) => ({ ...acc, [s.id]: newVal }), {});
    onChange({ ...data, includedSections: newIncluded });
  };
  const resetToRecommended = () => {
    onChange({ ...data, includedSections: { ...RECOMMENDED_SECTIONS } });
  };
  const isRecommended = AI_BRIEF_SECTIONS.every(s => !!included[s.id] === !!s.recommended);
  
  return (
  <div>
    <SectionHeader title={t.sections.summary} description="Your overall assessment and what needs to happen next." />
    <Select label={t.fields.confidence} hint="How ready is this requirement for design?" value={data.confidence} options={CONFIDENCE_LEVELS} onChange={(v) => onChange({ ...data, confidence: v })} />
    <Field label={t.fields.concerns} multiline hint="What worries you most about this requirement?" value={data.concerns} onChange={(v) => onChange({ ...data, concerns: v })} />
    <Field label={t.fields.nextSteps} multiline hint="What actions should happen before design work begins?" rows={4} value={data.nextSteps} onChange={(v) => onChange({ ...data, nextSteps: v })} />
    
    {/* Tasks for AI */}
    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Tasks for AI</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Define what the AI should do and which sections to include in the design brief.</p>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">AI Task Description</label>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">Describe the specific task for the AI design tool. Be concrete about what to design, which patterns to follow, and any constraints.</p>
        <AutoResizeTextarea
          className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 resize-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          rows={4}
          value={data.aiTask || ""}
          onChange={(e) => onChange({ ...data, aiTask: e.target.value })}
          placeholder={"e.g., Create a responsive email settings page with a 2FA toggle. Follow the existing design system patterns. Include error states for invalid email and failed verification. Target both B2B admin and B2C end-user flows."}
        />
      </div>
      
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Sections to Include in Brief</label>
          <div className="flex items-center gap-3">
            {!isRecommended && (
              <button
                onClick={resetToRecommended}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium"
              >
                Reset to recommended
              </button>
            )}
            <button
              onClick={toggleAll}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">Only checked sections will be included in the exported .md file. Exclude empty or irrelevant sections to keep the brief focused.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {AI_BRIEF_SECTIONS.map(section => (
            <label
              key={section.id}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                included[section.id]
                  ? 'bg-slate-50 dark:bg-slate-700/50 border-slate-300 dark:border-slate-600'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={!!included[section.id]}
                onChange={() => toggleSection(section.id)}
                className="mt-0.5 rounded border-slate-300 dark:border-slate-500 text-slate-800 dark:text-slate-300 focus:ring-slate-400"
              />
              <div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {section.label}
                  {section.recommended && <span className="ml-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">recommended</span>}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{section.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </div>
    
    {/* Multi-file split proposal */}
    {(() => {
      const selectedIds = AI_BRIEF_SECTIONS.filter(s => included[s.id]).map(s => s.id);
      const activeGroups = BRIEF_FILE_GROUPS.filter(g => g.sections.some(s => selectedIds.includes(s)));
      const multiFileMode = data.multiFileMode || false;
      const showProposal = activeGroups.length >= 2 && selectedIds.length >= 5;
      
      if (!showProposal) return null;
      
      const taskSlug = (analysis?.name || 'untitled').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);
      
      return (
        <div className="mt-4 p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Suggested file split</h4>
            <button
              onClick={() => onChange({ ...data, multiFileMode: !multiFileMode })}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                multiFileMode
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-600'
                  : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600'
              }`}
            >
              {multiFileMode ? 'Multi-file ✓' : 'Single file'}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            With {selectedIds.length} sections selected across {activeGroups.length} groups, splitting into separate files keeps each within AI context window limits and groups related content for more focused processing.
          </p>
          <div className="space-y-2">
            {activeGroups.map(group => {
              const groupSections = group.sections.filter(s => selectedIds.includes(s));
              const tokens = analysis ? estimateTokenCount(analysis, groupSections) : 0;
              return (
                <div key={group.id} className="flex items-start gap-3 p-2 rounded bg-white dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-300">{taskSlug}-{group.filename}.md</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {groupSections.map(s => AI_BRIEF_SECTIONS.find(bs => bs.id === s)?.label || s).join(', ')}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 tabular-nums">
                    ~{tokens > 0 ? tokens.toLocaleString() : '—'} tokens
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">
            Token estimates are approximate (~1.3 tokens/word). Each file includes a header referencing the companion files.
          </p>
        </div>
      );
    })()}
    
    {/* AI Design Brief Button */}
    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <button
        onClick={onGenerateAIBrief}
        className="w-full px-4 py-3 text-sm bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 dark:from-purple-700 dark:to-blue-700 dark:hover:from-purple-800 dark:hover:to-blue-800 text-white rounded-lg transition-all font-medium flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        {(() => {
          const selectedIds = AI_BRIEF_SECTIONS.filter(s => included[s.id]).map(s => s.id);
          const activeGroups = BRIEF_FILE_GROUPS.filter(g => g.sections.some(s => selectedIds.includes(s)));
          if (data.multiFileMode && activeGroups.length >= 2) return `Generate Brief (${activeGroups.length} files)`;
          return 'Create Design Brief for AI';
        })()}
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 text-center">
        For internally approved AI assisted design tools (currently Figma Make, VS code and CoPilot)
      </p>
    </div>
  </div>
  );
};

// Audio Icon Component
const AudioIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);

// Folder Icon Component
const FolderIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

// Text/Document Icon Component
const TextIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

// Import Markdown Modal Component
const ImportMarkdownModal = ({ isOpen, onClose, onImportNew, onImportExisting, analysisName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Import Markdown</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">×</button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            Choose how to import this markdown file:
          </p>

          <div className="space-y-3">
            <button
              onClick={onImportNew}
              className="w-full px-4 py-3 text-left border-2 border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="font-medium text-slate-800 dark:text-slate-200 mb-1">Create New Task</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Import as a new design task</div>
            </button>

            <button
              onClick={onImportExisting}
              className="w-full px-4 py-3 text-left border-2 border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <div className="font-medium text-slate-800 dark:text-slate-200 mb-1">Add to Current Task</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">Merge with "{analysisName}"</div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

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

// Paste & Analyze Modal Component
const PasteAnalyzeModal = ({ 
  isOpen, 
  onClose, 
  pastedText, 
  onTextChange, 
  onAnalyze, 
  analyzing, 
  results,
  onApply,
  githubAIKey,
  onSetGitHubAIKey,
  onDeleteField,
  onUpdateField,
  pastedImage,
  onImageChange,
  onImageAnalyze,
  pastedPdf,
  onPdfChange,
  onPdfAnalyze,
  activeAnalysis,
  mergeModes,
  onSetMergeMode
}) => {
  const [activeTab, setActiveTab] = useState('text');
  const [isDragging, setIsDragging] = useState(false);
  const imagePasteAreaRef = useRef(null);
  
  // Auto-focus image paste area when image tab is activated
  useEffect(() => {
    if (activeTab === 'image' && imagePasteAreaRef.current) {
      imagePasteAreaRef.current.focus();
    }
  }, [activeTab]);
  
  // Document-level paste listener when image tab is active and modal is open
  useEffect(() => {
    if (!isOpen || activeTab !== 'image') return;
    const handleDocPaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => onImageChange(event.target.result);
            reader.readAsDataURL(file);
          }
          return;
        }
      }
    };
    document.addEventListener('paste', handleDocPaste);
    return () => document.removeEventListener('paste', handleDocPaste);
  }, [isOpen, activeTab, onImageChange]);
  
  if (!isOpen) return null;

  const hasResults = results && Object.keys(results).length > 0;
  
  // Helper to get existing content for a field
  const getExistingContent = (fieldName) => {
    console.log('[PASTE MODAL] getExistingContent called:', fieldName);
    console.log('[PASTE MODAL] activeAnalysis:', activeAnalysis);
    
    if (!activeAnalysis) {
      console.log('[PASTE MODAL] No activeAnalysis!');
      return '';
    }
    
    console.log('[PASTE MODAL] activeAnalysis.overview:', activeAnalysis.overview);
    console.log('[PASTE MODAL] activeAnalysis.problem:', activeAnalysis.problem);
    
    // Helper to safely convert to string
    const toSafeString = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.join('\n');
      if (typeof val === 'object') return JSON.stringify(val, null, 2);
      return String(val);
    };
    
    // Map field names to analysis structure
    if (fieldName === 'featureName') {
      const value = toSafeString(activeAnalysis.overview?.featureName);
      console.log('[PASTE MODAL] featureName value:', value);
      return value;
    }
    if (fieldName === 'date') return toSafeString(activeAnalysis.overview?.date);
    if (fieldName === 'requestor') return toSafeString(activeAnalysis.overview?.requestor);
    if (fieldName === 'origin') return toSafeString(activeAnalysis.overview?.origin);
    if (fieldName === 'description') {
      const value = toSafeString(activeAnalysis.overview?.description);
      console.log('[PASTE MODAL] description value:', value);
      return value;
    }
    if (fieldName === 'problem') {
      const value = toSafeString(activeAnalysis.problem?.problem);
      console.log('[PASTE MODAL] problem value:', value);
      return value;
    }
    if (fieldName === 'who') return toSafeString(activeAnalysis.problem?.who);
    if (fieldName === 'outcome') return toSafeString(activeAnalysis.problem?.outcome);
    if (fieldName === 'segments') return toSafeString(activeAnalysis.context?.segments);
    if (fieldName === 'workflow') return toSafeString(activeAnalysis.context?.workflow);
    
    return '';
  };
  
  // Component to render a field with existing content and merge options
  const FieldDisplay = ({ fieldName, value, section, sectionColor, label }) => {
    // Helper to ensure value is always a string
    const toSafeString = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.join('\n');
      if (typeof val === 'object') return JSON.stringify(val, null, 2);
      return String(val);
    };
    
    const safeValue = toSafeString(value);
    
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(safeValue);
    
    const existingContent = getExistingContent(fieldName);
    const hasExisting = existingContent && existingContent.trim().length > 0;
    const mergeMode = mergeModes[fieldName] || 'replace';
    
    console.log('[FIELD DISPLAY]', {
      fieldName,
      existingContent,
      hasExisting,
      'existingContent.length': existingContent?.length,
      'value.length': value?.length,
      mergeMode
    });
    
    // Update editValue when value prop changes
    useEffect(() => {
      setEditValue(toSafeString(value));
    }, [value]);
    
    const handleSave = () => {
      onUpdateField(fieldName, editValue);
      setIsEditing(false);
    };
    
    const handleCancel = () => {
      setEditValue(toSafeString(value));
      setIsEditing(false);
    };
    
    return (
      <div className={`border border-${sectionColor}-200 dark:border-${sectionColor}-800 rounded-lg p-3 bg-${sectionColor}-50 dark:bg-${sectionColor}-900/20`}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold text-${sectionColor}-700 dark:text-${sectionColor}-300 px-2 py-0.5 bg-${sectionColor}-100 dark:bg-${sectionColor}-800 rounded`}>
              {section}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Edit this field"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            ) : null}
            <button
              onClick={() => onDeleteField(fieldName)}
              className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Delete this field"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Show existing content if any */}
        {hasExisting && (
          <div className="mb-2 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Existing content:</div>
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-16 overflow-y-auto">
              {existingContent}
            </div>
          </div>
        )}
        
        {/* Merge mode options if existing content */}
        {hasExisting && (
          <div className="mb-2 flex items-center gap-4 bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Action:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`merge-${fieldName}`}
                value="replace"
                checked={mergeMode === 'replace'}
                onChange={() => onSetMergeMode(fieldName, 'replace')}
                className="text-slate-800 focus:ring-slate-400"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">Replace</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`merge-${fieldName}`}
                value="add"
                checked={mergeMode === 'add'}
                onChange={() => onSetMergeMode(fieldName, 'add')}
                className="text-slate-800 focus:ring-slate-400"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">Add to existing</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name={`merge-${fieldName}`}
                value="skip"
                checked={mergeMode === 'skip'}
                onChange={() => onSetMergeMode(fieldName, 'skip')}
                className="text-slate-800 focus:ring-slate-400"
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">Skip</span>
            </label>
          </div>
        )}
        
        <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">New content:</div>
        {isEditing ? (
          <div>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-500 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
              rows={Math.min(Math.max(3, editValue.split('\n').length), 10)}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleSave}
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-medium bg-slate-200 hover:bg-slate-300 dark:bg-slate-600 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className={`text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap ${safeValue.length > 100 ? 'max-h-24 overflow-y-auto' : ''}`}>
            {safeValue}
          </div>
        )}
      </div>
    );
  };
  
  const handleImageDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (let file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => onImageChange(event.target.result);
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        onImageChange(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      onPdfChange(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200">Paste & Analyze</h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">×</button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'text'
                ? 'border-slate-800 dark:border-slate-200 text-slate-800 dark:text-slate-200'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Text
          </button>
          <button
            onClick={() => setActiveTab('image')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'image'
                ? 'border-slate-800 dark:border-slate-200 text-slate-800 dark:text-slate-200'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Image
          </button>
          <button
            onClick={() => setActiveTab('pdf')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'pdf'
                ? 'border-slate-800 dark:border-slate-200 text-slate-800 dark:text-slate-200'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            PDF
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'text' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Paste Text</label>
              <textarea
                value={pastedText}
                onChange={(e) => onTextChange(e.target.value)}
                placeholder="Paste your Jira ticket, requirements, or any text here..."
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                rows={10}
              />
              {!hasResults && pastedText.trim() && (
                <>
                  <button
                    onClick={onAnalyze}
                    disabled={analyzing}
                    className="mt-3 px-4 py-2 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {analyzing ? 'Analyzing...' : (githubAIKey ? 'Analyze with AI' : 'Analyze')}
                  </button>
                  {analyzing && <LoadingIndicator message="Analyzing text..." className="mt-3" />}
                </>
              )}
            </div>
          )}
          
          {activeTab === 'image' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Paste or Upload Image</label>
              <div 
                ref={imagePasteAreaRef}
                className={`w-full min-h-[240px] border-2 border-dashed rounded-lg flex items-center justify-center p-4 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 focus:border-slate-400 dark:focus:border-slate-500 cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50'
                }`}
                onDrop={handleImageDrop}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onClick={() => imagePasteAreaRef.current?.focus()}
                tabIndex={0}
                role="button"
                aria-label="Drop or paste image here"
              >
                {pastedImage ? (
                  <div className="w-full">
                    <img src={pastedImage} alt="Pasted content" className="max-w-full max-h-[400px] mx-auto rounded" />
                    <button
                      onClick={() => onImageChange(null)}
                      className="mt-3 px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-600 hover:border-red-400 dark:hover:border-red-500 rounded transition-colors"
                    >
                      Clear Image
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 font-medium">{isDragging ? 'Drop image here' : 'Drag & drop, or paste (Cmd+V) an image'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">or</p>
                    <label className="inline-block px-4 py-2 text-sm bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors cursor-pointer">
                      Choose File
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Screenshot Jira tickets, wireframes, designs, etc.</p>
                  </div>
                )}
              </div>
              {!hasResults && pastedImage && (
                <>
                  <button
                    onClick={onImageAnalyze}
                    disabled={analyzing}
                    className="mt-3 px-4 py-2 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {analyzing ? 'Analyzing...' : (githubAIKey ? 'Analyze with AI' : 'Analyze')}
                  </button>
                  {analyzing && <LoadingIndicator message="Analyzing image..." className="mt-3" />}
                </>
              )}
            </div>
          )}

          {activeTab === 'pdf' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Upload PDF</label>
              <div className="w-full min-h-[240px] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center p-4">
                {pastedPdf ? (
                  <div className="w-full text-center">
                    <svg className="w-16 h-16 mx-auto text-red-500 dark:text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">{pastedPdf.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{(pastedPdf.size / 1024).toFixed(1)} KB</p>
                    <button
                      onClick={() => onPdfChange(null)}
                      className="px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-600 hover:border-red-400 dark:hover:border-red-500 rounded transition-colors"
                    >
                      Clear PDF
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">Upload a PDF document</p>
                    <label className="inline-block px-4 py-2 text-sm bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors cursor-pointer">
                      Choose PDF File
                      <input type="file" accept="application/pdf,.pdf" onChange={handlePdfUpload} className="hidden" />
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Upload requirement documents, specifications, etc.</p>
                  </div>
                )}
              </div>
              {!hasResults && pastedPdf && (
                <>
                  <button
                    onClick={onPdfAnalyze}
                    disabled={analyzing}
                    className="mt-3 px-4 py-2 text-sm bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {analyzing ? 'Analyzing...' : (githubAIKey ? 'Analyze with AI' : 'Analyze')}
                  </button>
                  {analyzing && <LoadingIndicator message="Processing PDF..." className="mt-3" />}
                </>
              )}
            </div>
          )}

          {/* GitHub AI Key Input */}
          {!githubAIKey && (pastedText.trim() || pastedImage || pastedPdf) && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                Add a GitHub Personal Access Token for AI-powered field extraction. Without it, content will be added to notes as bullet points.
              </p>
              <input
                type="password"
                placeholder="github_pat_... or ghp_..."
                value={githubAIKey || ''}
                onChange={(e) => onSetGitHubAIKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-600"
              />
            </div>
          )}
          
          {/* GitHub AI Key Status */}
          {githubAIKey && (pastedText.trim() || pastedImage || pastedPdf) && (
            <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-1">GitHub Token: Active</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {!hasResults ? 'Click "Analyze with AI" to extract structured information.' : 'Token is saved. Clear to enter a new one.'}
                </p>
              </div>
              <button
                onClick={() => onSetGitHubAIKey('')}
                className="ml-4 px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-300 dark:border-red-600 hover:border-red-400 dark:hover:border-red-500 rounded transition-colors"
              >
                Clear Token
              </button>
            </div>
          )}

          {/* Results Preview */}
          {hasResults && (
            <div>
              {/* Fallback Warning */}
              {results._fallback && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">Basic formatting applied</p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300">
                    {results._reason || 'AI extraction was not used.'}
                    {results._reason && results._reason.includes('token') ? '' : ' Clear the token above and add a valid GitHub Personal Access Token to use AI-powered extraction.'}
                  </p>
                </div>
              )}
              
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                {results._fallback ? 'Extracted Information' : 'Fields to Populate'}
              </h4>
              
              {/* Field Mapping Display */}
              <div className="space-y-2 mb-4">
                {results.featureName && (
                  <FieldDisplay 
                    fieldName="featureName" 
                    value={results.featureName} 
                    section="Overview" 
                    sectionColor="blue" 
                    label="Feature Name" 
                  />
                )}
                
                {results.date && (
                  <FieldDisplay 
                    fieldName="date" 
                    value={results.date} 
                    section="Overview" 
                    sectionColor="blue" 
                    label="Date" 
                  />
                )}
                
                {results.requestor && (
                  <FieldDisplay 
                    fieldName="requestor" 
                    value={results.requestor} 
                    section="Overview" 
                    sectionColor="blue" 
                    label="Requestor" 
                  />
                )}
                
                {results.origin && (
                  <FieldDisplay 
                    fieldName="origin" 
                    value={results.origin} 
                    section="Overview" 
                    sectionColor="blue" 
                    label="Origin" 
                  />
                )}
                
                {results.description && (
                  <FieldDisplay 
                    fieldName="description" 
                    value={results.description} 
                    section="Overview" 
                    sectionColor="blue" 
                    label="Description" 
                  />
                )}
                
                {results.problem && (
                  <FieldDisplay 
                    fieldName="problem" 
                    value={results.problem} 
                    section="Problem" 
                    sectionColor="purple" 
                    label="Problem Statement" 
                  />
                )}
                
                {results.who && (
                  <FieldDisplay 
                    fieldName="who" 
                    value={results.who} 
                    section="Problem" 
                    sectionColor="purple" 
                    label="Who (Target Users)" 
                  />
                )}
                
                {results.outcome && (
                  <FieldDisplay 
                    fieldName="outcome" 
                    value={results.outcome} 
                    section="Problem" 
                    sectionColor="purple" 
                    label="Outcome" 
                  />
                )}
                
                {results.segments && (
                  <FieldDisplay 
                    fieldName="segments" 
                    value={results.segments} 
                    section="Context" 
                    sectionColor="green" 
                    label="User Segments" 
                  />
                )}
                
                {results.workflow && (
                  <FieldDisplay 
                    fieldName="workflow" 
                    value={results.workflow} 
                    section="Context" 
                    sectionColor="green" 
                    label="Current Workflow" 
                  />
                )}
                
                {results.assumptions && Array.isArray(results.assumptions) && results.assumptions.length > 0 && (
                  <div className="border border-orange-200 rounded-lg p-3 bg-orange-50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-orange-700 px-2 py-0.5 bg-orange-100 rounded">Assumptions</span>
                        <span className="text-xs font-medium text-slate-600">{results.assumptions.length} item(s)</span>
                      </div>
                      <button
                        onClick={() => onDeleteField('assumptions')}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete this field"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-sm text-slate-700 space-y-2">
                      {results.assumptions.map((item, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 p-2 border border-orange-200 rounded bg-white">
                          <span className="flex-1">{item}</span>
                          <button
                            onClick={() => {
                              const newAssumptions = results.assumptions.filter((_, index) => index !== i);
                              if (newAssumptions.length === 0) {
                                onDeleteField('assumptions');
                              } else {
                                onUpdateField('assumptions', newAssumptions);
                              }
                            }}
                            className="text-slate-400 hover:text-red-500 text-lg px-1 transition-colors shrink-0"
                            title="Delete this assumption"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {results.questions && Array.isArray(results.questions) && results.questions.length > 0 && (
                  <div className="border border-pink-200 rounded-lg p-3 bg-pink-50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-pink-700 px-2 py-0.5 bg-pink-100 rounded">Questions</span>
                        <span className="text-xs font-medium text-slate-600">{results.questions.length} item(s)</span>
                      </div>
                      <button
                        onClick={() => onDeleteField('questions')}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete this field"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-sm text-slate-700 space-y-2">
                      {results.questions.map((item, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 p-2 border border-pink-200 rounded bg-white">
                          <span className="flex-1">{item}</span>
                          <button
                            onClick={() => {
                              const newQuestions = results.questions.filter((_, index) => index !== i);
                              if (newQuestions.length === 0) {
                                onDeleteField('questions');
                              } else {
                                onUpdateField('questions', newQuestions);
                              }
                            }}
                            className="text-slate-400 hover:text-red-500 text-lg px-1 transition-colors shrink-0"
                            title="Delete this question"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {results.acceptanceCriteria && Array.isArray(results.acceptanceCriteria) && results.acceptanceCriteria.length > 0 && (
                  <div className="border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 bg-emerald-50 dark:bg-emerald-900/20">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-800 rounded">Acceptance Criteria</span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{results.acceptanceCriteria.length} item(s)</span>
                      </div>
                      <button
                        onClick={() => onDeleteField('acceptanceCriteria')}
                        className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Delete this field"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300 space-y-2">
                      {results.acceptanceCriteria.map((item, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 p-2 border border-emerald-200 dark:border-emerald-700 rounded bg-white dark:bg-slate-800">
                          <span className="flex-1">{item}</span>
                          <button
                            onClick={() => {
                              const newCriteria = results.acceptanceCriteria.filter((_, index) => index !== i);
                              if (newCriteria.length === 0) {
                                onDeleteField('acceptanceCriteria');
                              } else {
                                onUpdateField('acceptanceCriteria', newCriteria);
                              }
                            }}
                            className="text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 text-lg px-1 transition-colors shrink-0"
                            title="Delete this criterion"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {results.actions && Array.isArray(results.actions) && results.actions.length > 0 && (
                  <div className="border border-indigo-200 rounded-lg p-3 bg-indigo-50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-indigo-700 px-2 py-0.5 bg-indigo-100 rounded">Actions</span>
                        <span className="text-xs font-medium text-slate-600">{results.actions.length} item(s)</span>
                      </div>
                      <button
                        onClick={() => onDeleteField('actions')}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete this field"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-sm text-slate-700 space-y-2">
                      {results.actions.map((item, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 p-2 border border-indigo-200 rounded bg-white">
                          <span className="flex-1">{item}</span>
                          <button
                            onClick={() => {
                              const newActions = results.actions.filter((_, index) => index !== i);
                              if (newActions.length === 0) {
                                onDeleteField('actions');
                              } else {
                                onUpdateField('actions', newActions);
                              }
                            }}
                            className="text-slate-400 hover:text-red-500 text-lg px-1 transition-colors shrink-0"
                            title="Delete this action"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {results.notes && (
                  <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 px-2 py-0.5 bg-slate-100 rounded">Notes</span>
                      </div>
                      <button
                        onClick={() => onDeleteField('notes')}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                        title="Delete this field"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="text-sm text-slate-700">
                      {Array.isArray(results.notes) ? (
                        results.notes.map((note, i) => <div key={i}>• {note}</div>)
                      ) : (
                        <div className="whitespace-pre-wrap">{results.notes}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:border-slate-400 transition-colors"
          >
            Cancel
          </button>
          {hasResults && (
            <button
              onClick={onApply}
              className="px-4 py-2 text-sm font-medium bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Apply to Task
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Audio Analysis Modal Component
const AudioAnalysisModal = ({
  isOpen,
  onClose,
  isRecording,
  transcript,
  audioProcessing,
  aiSuggestions,
  selectedSections,
  onToggleSection,
  onUpdateSuggestion,
  onStartRecording,
  onStopRecording,
  onFileUpload,
  onAnalyze,
  onApply,
  githubAIKey,
  onSetGitHubAIKey,
  activeAnalysis,
  mergeModes,
  onSetMergeMode
}) => {
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const hasTranscript = transcript && transcript.trim().length > 0;
  const hasSuggestions = Object.keys(aiSuggestions).length > 0;
  
  // Helper to get existing content for a field
  const getExistingContent = (section) => {
    if (!activeAnalysis) return '';
    
    // Helper to safely convert to string
    const toSafeString = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.join('\n');
      if (typeof val === 'object') return JSON.stringify(val, null, 2);
      return String(val);
    };
    
    // Direct fields
    if (activeAnalysis[section]) {
      return toSafeString(activeAnalysis[section]);
    }
    
    // Nested fields
    if (section === 'description') return toSafeString(activeAnalysis.overview?.description);
    if (section === 'featureName') return toSafeString(activeAnalysis.overview?.featureName);
    if (section === 'problem') return toSafeString(activeAnalysis.problem?.problem);
    if (section === 'who') return toSafeString(activeAnalysis.problem?.who);
    if (section === 'outcome') return toSafeString(activeAnalysis.problem?.outcome);
    if (section === 'segments') return toSafeString(activeAnalysis.context?.segments);
    if (section === 'workflow') return toSafeString(activeAnalysis.context?.workflow);
    
    return '';
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <AudioIcon className="w-5 h-5" />
            Audio Analysis
          </h3>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Recording Controls */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <button
                onClick={isRecording ? onStopRecording : onStartRecording}
                disabled={audioProcessing}
                className={`px-4 py-2.5 text-sm rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-slate-800 dark:bg-slate-600 text-white hover:bg-slate-700 dark:hover:bg-slate-500'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRecording ? (
                  <>
                    <span className="w-3 h-3 bg-white rounded-sm"></span>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <AudioIcon className="w-4 h-4" />
                    Start Recording
                  </>
                )}
              </button>
              <span className="text-slate-400">or</span>
              <label className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer font-medium flex items-center gap-2">
                <FolderIcon className="w-4 h-4" />
                Upload Audio
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.wav,.m4a,.ogg,.webm"
                  onChange={onFileUpload}
                  className="hidden"
                  disabled={audioProcessing || isRecording}
                />
              </label>
              {audioProcessing && <LoadingIndicator message="Processing audio..." className="" />}
            </div>
            {isRecording && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                Recording in progress...
              </div>
            )}
          </div>

          {/* Transcript */}
          {hasTranscript && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">Transcript</label>
              <textarea
                value={transcript}
                readOnly
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-50 text-slate-700 font-mono"
                rows={6}
              />
              {!hasSuggestions && (
                <button
                  onClick={onAnalyze}
                  disabled={audioProcessing}
                  className="mt-3 px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  {githubAIKey ? 'Analyze with AI' : 'Prepare Suggestions'}
                </button>
              )}
            </div>
          )}

          {/* AI Suggestions */}
          {hasSuggestions && (
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">Suggested Updates</h4>
              <div className="space-y-3">
                {Object.entries(aiSuggestions).map(([section, content]) => {
                  const existingContent = getExistingContent(section);
                  const hasExisting = existingContent && existingContent.trim().length > 0;
                  const mergeMode = mergeModes[section] || 'replace';
                  
                  // Ensure content is a string
                  const safeContent = (() => {
                    if (content == null) return '';
                    if (typeof content === 'string') return content;
                    if (Array.isArray(content)) return content.join('\n');
                    if (typeof content === 'object') return JSON.stringify(content, null, 2);
                    return String(content);
                  })();
                  
                  return (
                    <div key={section} className="border border-slate-200 dark:border-slate-600 rounded-lg p-3 bg-white dark:bg-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selectedSections[section] !== false}
                          onChange={() => onToggleSection(section)}
                          className="rounded border-slate-300 dark:border-slate-500 text-slate-800 focus:ring-slate-400"
                        />
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">{section}</label>
                      </div>
                      
                      {/* Show existing content if any */}
                      {hasExisting && (
                        <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded">
                          <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Existing content:</div>
                          <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap max-h-20 overflow-y-auto">
                            {existingContent}
                          </div>
                        </div>
                      )}
                      
                      {/* Merge mode options if existing content */}
                      {hasExisting && (
                        <div className="mb-2 flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`merge-${section}`}
                              value="replace"
                              checked={mergeMode === 'replace'}
                              onChange={() => onSetMergeMode(section, 'replace')}
                              className="text-slate-800 focus:ring-slate-400"
                            />
                            <span className="text-xs text-slate-600 dark:text-slate-400">Replace</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`merge-${section}`}
                              value="add"
                              checked={mergeMode === 'add'}
                              onChange={() => onSetMergeMode(section, 'add')}
                              className="text-slate-800 focus:ring-slate-400"
                            />
                            <span className="text-xs text-slate-600 dark:text-slate-400">Add to existing</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`merge-${section}`}
                              value="skip"
                              checked={mergeMode === 'skip'}
                              onChange={() => onSetMergeMode(section, 'skip')}
                              className="text-slate-800 focus:ring-slate-400"
                            />
                            <span className="text-xs text-slate-600 dark:text-slate-400">Skip</span>
                          </label>
                        </div>
                      )}
                      
                      <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">New content:</div>
                      <textarea
                        value={safeContent}
                        onChange={(e) => onUpdateSuggestion(section, e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-500 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 resize-none"
                        rows={3}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* GitHub AI Key Input */}
          {!githubAIKey && hasTranscript && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                Add a GitHub Personal Access Token for AI-powered analysis, or continue manually.
              </p>
              <input
                type="password"
                placeholder="github_pat_... or ghp_..."
                value={githubAIKey}
                onChange={(e) => onSetGitHubAIKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-blue-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          )}
          
          {/* GitHub AI Key Status */}
          {githubAIKey && hasTranscript && (
            <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800 mb-1">GitHub Token: Active</p>
                <p className="text-xs text-slate-600">Token is saved. Clear to enter a new one.</p>
              </div>
              <button
                onClick={() => onSetGitHubAIKey('')}
                className="ml-4 px-3 py-1 text-xs text-red-600 hover:text-red-800 border border-red-300 hover:border-red-400 rounded transition-colors"
              >
                Clear Token
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
          >
            Cancel
          </button>
          {hasSuggestions && (
            <button
              onClick={onApply}
              className="px-4 py-2 text-sm font-medium bg-slate-800 dark:bg-slate-600 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-500 transition-colors"
            >
              Apply Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Mode Switcher (Segmented Control) ---
const ModeSwitch = ({ mode, onChange }) => {
  return (
    <div className="inline-flex items-center bg-slate-200 dark:bg-slate-700 rounded-lg p-1.5 gap-1.5 border-2 border-slate-300 dark:border-slate-600">
      <button
        onClick={() => onChange("discovery")}
        className={`px-5 py-2.5 text-base font-semibold rounded-md transition-all whitespace-nowrap ${
          mode === "discovery"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md border-2 border-slate-900 dark:border-slate-100"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 border-2 border-transparent"
        }`}
        aria-pressed={mode === "discovery"}
      >
        Discovery
      </button>
      <button
        onClick={() => onChange("design-specs")}
        className={`px-5 py-2.5 text-base font-semibold rounded-md transition-all whitespace-nowrap ${
          mode === "design-specs"
            ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-md border-2 border-slate-900 dark:border-slate-100"
            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 border-2 border-transparent"
        }`}
        aria-pressed={mode === "design-specs"}
      >
        Design
      </button>
    </div>
  );
};

// --- Expandable Evidence Cell (read-only, shows 1 quote collapsed, chevron to expand) ---
const ExpandableEvidenceCell = ({ value }) => {
  const [expanded, setExpanded] = useState(false);
  if (!value || value.trim() === "") return <span className="text-xs text-slate-400 italic">—</span>;
  const quotes = value.split("\n\n").filter(q => q.trim());
  const primaryQuote = quotes[0];
  const hasMore = quotes.length > 1;

  return (
    <div className="relative group/ev">
      <div className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
        <p className="whitespace-pre-wrap">{expanded ? value : primaryQuote}</p>
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-0.5 text-[10px] text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 font-medium transition-colors"
        >
          <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          {expanded ? "Show less" : `+${quotes.length - 1} more`}
        </button>
      )}
    </div>
  );
};

// --- Discovery Research Table ---
const DiscoveryTableSection = ({ data, outcomeName, onChange }) => {
  const [draggedRowIndex, setDraggedRowIndex] = useState(null);
  const [columnOrganizer, setColumnOrganizer] = useState(false);
  const [columnWidths, setColumnWidths] = useState({});
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const resizingRef = useRef(null);
  const tableRef = useRef(null);

  const handleResizeStart = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const th = e.target.closest('th');
    const startWidth = th.offsetWidth;
    resizingRef.current = { colId, startX, startWidth };
    const handleMouseMove = (moveEvent) => {
      if (!resizingRef.current) return;
      const diff = moveEvent.clientX - resizingRef.current.startX;
      const newWidth = Math.max(60, resizingRef.current.startWidth + diff);
      setColumnWidths(prev => ({ ...prev, [resizingRef.current.colId]: newWidth }));
    };
    const handleMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const DEFAULT_COLUMNS = [
      { id: "col_opp", name: "Opportunity", visible: true },
      { id: "col_rprio", name: "Research ranked prio", visible: true },
      { id: "col_iprio", name: "Internal prio level", visible: true },
      { id: "col_obj", name: "Business objectives", visible: true },
      { id: "col_about", name: "About", visible: true },
      { id: "col_impact", name: "Impact", visible: true },
      { id: "col_dk", name: "DK prior portal", visible: true },
      { id: "col_se", name: "SE prior portal - redesigned Mitt3", visible: true },
      { id: "col_proto", name: "Prototype test (2024)", visible: true },
      { id: "col_b2b", name: "B2B admin portal (2026)", visible: true },
      { id: "col_sol", name: "Solutions", visible: true },
      { id: "col_exp", name: "Experiment", visible: true },
  ];

  const tableData = (data && data.rows) ? data : {
    columns: DEFAULT_COLUMNS,
    rows: [],
  };

  const updateData = (updates) => { onChange({ ...tableData, ...updates }); };

  const addRow = () => {
    const newRow = { id: generateId(), cells: tableData.columns.reduce((acc, col) => ({ ...acc, [col.id]: "" }), {}) };
    updateData({ rows: [...tableData.rows, newRow] });
  };
  const updateCell = (rowId, columnId, value) => {
    updateData({ rows: tableData.rows.map(row => row.id === rowId ? { ...row, cells: { ...row.cells, [columnId]: value } } : row) });
  };
  const deleteRow = (rowId) => { updateData({ rows: tableData.rows.filter(row => row.id !== rowId) }); };
  const addColumn = () => {
    const newCol = { id: generateId(), name: "New Column", visible: true };
    updateData({ columns: [...tableData.columns, newCol], rows: tableData.rows.map(row => ({ ...row, cells: { ...row.cells, [newCol.id]: "" } })) });
  };
  const updateColumnName = (colId, name) => { updateData({ columns: tableData.columns.map(c => c.id === colId ? { ...c, name } : c) }); };
  const toggleColumnVisibility = (colId) => { updateData({ columns: tableData.columns.map(c => c.id === colId ? { ...c, visible: !c.visible } : c) }); };
  const deleteColumn = (colId) => { updateData({ columns: tableData.columns.filter(c => c.id !== colId), rows: tableData.rows.map(r => { const cells = { ...r.cells }; delete cells[colId]; return { ...r, cells }; }) }); };

  const handleDragStart = (e, index) => { setDraggedRowIndex(index); e.dataTransfer.effectAllowed = "move"; };
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedRowIndex === null || draggedRowIndex === index) return;
    const newRows = [...tableData.rows];
    const dragged = newRows[draggedRowIndex];
    newRows.splice(draggedRowIndex, 1);
    newRows.splice(index, 0, dragged);
    updateData({ rows: newRows });
    setDraggedRowIndex(index);
  };
  const handleDragEnd = () => { setDraggedRowIndex(null); };

  const visibleColumns = tableData.columns.filter(col => col.visible);

  return (
    <div>
      {outcomeName && (
        <div className="mb-4 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Outcome:</span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{outcomeName}</span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Track opportunities, priorities, and evidence for informed decision-making.</p>
        </div>
      )}
      <div className="flex items-center justify-end mb-4">
        <button onClick={() => setColumnOrganizer(!columnOrganizer)} className="px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg hover:border-slate-400 dark:hover:border-slate-500 transition-colors font-medium flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          Organize Columns
        </button>
      </div>
      {columnOrganizer && (
        <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Column Visibility</h3>
          <div className="space-y-2">
            {tableData.columns.map((col) => (
              <div key={col.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <input type="checkbox" checked={col.visible} onChange={() => toggleColumnVisibility(col.id)} className="w-4 h-4 rounded" />
                  <input type="text" value={col.name} onChange={(e) => updateColumnName(col.id, e.target.value)} className="flex-1 px-2 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400" />
                </div>
                <button onClick={() => deleteColumn(col.id)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete column">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {tableData.rows.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-600 rounded-lg">
          <svg className="w-8 h-8 mx-auto mb-3 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18M3 18h18M3 6h18" />
          </svg>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Start your discovery research</p>
          <p className="text-xs mt-1 mb-4">Add your first opportunity row to begin analysing this outcome</p>
          <button onClick={addRow} className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            + Add first row
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
          <table ref={tableRef} className="w-full" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              {visibleColumns.map((col) => {
                const minWidths = { col_opp: 180, col_rprio: 80, col_iprio: 80, col_obj: 160, col_about: 180, col_impact: 140, col_dk: 160, col_se: 160, col_proto: 140, col_b2b: 140, col_sol: 180, col_exp: 180 };
                const w = columnWidths[col.id] || minWidths[col.id] || 140;
                return <col key={col.id} style={{ width: w + 'px', minWidth: (minWidths[col.id] || 140) + 'px' }} />;
              })}
              <col style={{ width: '40px' }} />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800"></th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-l border-slate-200 dark:border-slate-700" colSpan={1}>Common needs level 1</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 border-l border-slate-200 dark:border-slate-700" colSpan={2}>Priority (Now, Next, Later)</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 border-l border-slate-200 dark:border-slate-700" colSpan={1}>Objectives</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 border-l border-slate-200 dark:border-slate-700" colSpan={2}>Analysis</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border-l border-slate-200 dark:border-slate-700" colSpan={4}>Evidence</th>
                <th className="px-2 py-1.5 text-left text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border-l border-slate-200 dark:border-slate-700" colSpan={2}>
                  <div className="flex items-center gap-2">
                    <span>Going forward</span>
                    <button
                      onClick={() => setShowAiSuggestions(!showAiSuggestions)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium rounded-sm transition-colors cursor-pointer ${showAiSuggestions ? 'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200' : 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'}`}
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2 5h5l-4 3.5 1.5 5L8 11.5 3.5 14.5 5 9.5 1 6h5L8 1z"/></svg>
                      AI {showAiSuggestions ? 'on' : 'off'}
                    </button>
                  </div>
                </th>
                <th className="px-2 py-1.5 bg-slate-50 dark:bg-slate-800"></th>
              </tr>
              <tr>
                <th className="px-2 py-2 text-left bg-slate-50 dark:bg-slate-800"></th>
                {visibleColumns.map((col) => (
                  <th key={col.id} className="px-2 py-2 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 relative group" title={col.name}>
                    <span className="truncate block pr-2">{col.name}</span>
                    <div onMouseDown={(e) => handleResizeStart(e, col.id)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-400/50 group-hover:bg-slate-300/50 dark:group-hover:bg-slate-600/50" />
                  </th>
                ))}
                <th className="px-2 py-2 text-left border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"></th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900">
              {tableData.rows.map((row, rowIndex) => (
                <tr key={row.id} draggable onDragStart={(e) => handleDragStart(e, rowIndex)} onDragOver={(e) => handleDragOver(e, rowIndex)} onDragEnd={handleDragEnd}
                  className={`border-t border-slate-200 dark:border-slate-700 ${draggedRowIndex === rowIndex ? 'opacity-50' : ''} hover:bg-slate-50/50 dark:hover:bg-slate-800/30`}>
                  <td className="px-2 py-2 cursor-move align-top">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                  </td>
                  {visibleColumns.map((col) => {
                    const sectionBg =
                      col.id === "col_opp" ? "bg-amber-50/40 dark:bg-amber-900/10" :
                      (col.id === "col_dk" || col.id === "col_se" || col.id === "col_proto" || col.id === "col_b2b") ? "bg-purple-50/40 dark:bg-purple-900/10" :
                      (col.id === "col_sol" || col.id === "col_exp") ? "bg-emerald-50/40 dark:bg-emerald-900/10" : "";
                    const isAiColumn = col.id === "col_sol" || col.id === "col_exp";
                    const isEvidenceColumn = col.id === "col_dk" || col.id === "col_se" || col.id === "col_proto" || col.id === "col_b2b";
                    const cellValue = row.cells[col.id] || "";
                    const teamKey = col.id + "_team";
                    const teamValue = row.cells[teamKey] || "";
                    return (
                      <td key={col.id} className={`px-2 py-1 border-l border-slate-200 dark:border-slate-700 align-top ${sectionBg}`}>
                        {isEvidenceColumn ? (
                          <ExpandableEvidenceCell value={cellValue} />
                        ) : isAiColumn ? (
                          <div className="flex flex-col gap-1.5">
                            {showAiSuggestions && (
                              <div>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 rounded-sm mb-0.5">
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2 5h5l-4 3.5 1.5 5L8 11.5 3.5 14.5 5 9.5 1 6h5L8 1z"/></svg>
                                  AI suggestion
                                </span>
                                <textarea
                                  value={cellValue}
                                  onChange={(e) => { updateCell(row.id, col.id, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                  ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                  className="w-full px-1 py-1 text-xs border-none bg-transparent text-slate-500 dark:text-slate-400 italic focus:outline-none focus:ring-2 focus:ring-emerald-300 dark:focus:ring-emerald-600 rounded resize-none overflow-hidden"
                                  placeholder="AI suggestion..."
                                />
                              </div>
                            )}
                            <div className={showAiSuggestions ? "border-t border-slate-200 dark:border-slate-600 pt-1.5" : ""}>
                              <textarea
                                value={teamValue}
                                onChange={(e) => { updateCell(row.id, teamKey, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                                ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                                className="w-full px-1 py-1 text-xs border-none bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-600 rounded resize-none overflow-hidden"
                                placeholder=""
                              />
                            </div>
                          </div>
                        ) : (
                          <textarea
                            value={cellValue}
                            onChange={(e) => { updateCell(row.id, col.id, e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
                            className={`w-full px-1 py-1 text-xs border-none bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600 rounded resize-none overflow-hidden ${col.id === "col_opp" ? "font-bold" : ""}`}
                            placeholder=""
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-2 border-l border-slate-200 dark:border-slate-700 align-top">
                    <button onClick={() => deleteRow(row.id)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete row">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- Main App ---

export default function RequirementAnalyzer() {
  const [analyses, setAnalyses] = useState([createBlankAnalysis("Sample: Dark Mode Toggle")]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeId, setActiveId] = useState(() => analyses[0]?.id);
  const [activeSection, setActiveSection] = useState(() => {
    const saved = localStorage.getItem("activeSection");
    return saved || "discoveryTable";
  });
  const [showExport, setShowExport] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [actionsPanelOpen, setActionsPanelOpen] = useState(true);
  const [phaseFilter, setPhaseFilter] = useState("All");
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem("githubToken") || "");
  const [loadGistId, setLoadGistId] = useState("");
  const [gistLoading, setGistLoading] = useState(false);
  const [gistExpanded, setGistExpanded] = useState(false);
  const [syncOptionsExpanded, setSyncOptionsExpanded] = useState(false);
  
  // GitHub Repository Sync (Option 2)
  const [githubRepoOwner, setGithubRepoOwner] = useState(() => localStorage.getItem("githubRepoOwner") || "");
  const [githubRepoName, setGithubRepoName] = useState(() => localStorage.getItem("githubRepoName") || "");
  const [githubRepoBranch, setGithubRepoBranch] = useState(() => localStorage.getItem("githubRepoBranch") || "data");
  const [githubRepoExpanded, setGithubRepoExpanded] = useState(false);
  const [githubSyncStatus, setGithubSyncStatus] = useState(null);
  const githubSyncRef = useRef(null);
  const [audioModalOpen, setAudioModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [githubAIKey, setGitHubAIKey] = useState(() => localStorage.getItem("githubAIKey") || "");
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [selectedSections, setSelectedSections] = useState({});
  const [mergeModes, setMergeModes] = useState({}); // 'replace', 'add', or 'skip' for each field with existing content
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importedMarkdown, setImportedMarkdown] = useState("");
  const [importMode, setImportMode] = useState(""); // "new" or "existing"
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pastedImage, setPastedImage] = useState(null);
  const [pastedPdf, setPastedPdf] = useState(null);
  const [pasteAnalyzing, setPasteAnalyzing] = useState(false);
  const [pasteResults, setPasteResults] = useState(null);
  const [pasteMergeModes, setPasteMergeModes] = useState({}); // 'replace', 'add', or 'skip' for paste results
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  
  // Global app mode: Discovery vs Design Specs
  const [appMode, setAppMode] = useState(() => localStorage.getItem("appMode") || "design-specs");

  // Outcome wizard state
  const [outcomeWizardOpen, setOutcomeWizardOpen] = useState(false);
  const [outcomeWizardStep, setOutcomeWizardStep] = useState(1);
  const [outcomeWizardName, setOutcomeWizardName] = useState("");
  const [outcomeWizardConfirmed, setOutcomeWizardConfirmed] = useState(false);
  const [showArchivedOutcomes, setShowArchivedOutcomes] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
  
  // AI Chat state (ephemeral — cleared on reload and task switch)
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState("actions"); // 'actions' | 'chat'
  const chatEndRef = useRef(null);
  
  const fileInputRef = useRef(null);

  // Check if any analysis has secure mode enabled
  const hasSecureAnalysis = useMemo(() => 
    analyses.some(a => a.secureMode === true),
    [analyses]
  );

  // Load data on mount from API (shared database)
  useEffect(() => {
    const loadData = async () => {
      console.log('[LOAD] Starting data load from API...');
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const rows = await response.json();
          console.log('[LOAD] API returned', rows.length, 'projects');
          if (rows.length > 0) {
            const projects = rows.map(r => migrateAnalysis(typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
            setAnalyses(projects);
            if (!activeId || !projects.find(a => a.id === activeId)) {
              setActiveId(projects[0].id);
            }
          } else {
            console.log('[LOAD] No projects in DB, using defaults');
          }
        } else {
          console.warn('[LOAD] API error, falling back to localStorage');
          // Fallback to localStorage for local dev
          let saved = await secureStorage.getItem("requirementAnalyses");
          if (!saved) saved = localStorage.getItem("requirementAnalyses");
          if (saved) {
            const parsed = JSON.parse(saved);
            const migrated = Array.isArray(parsed) ? parsed.map(migrateAnalysis) : [];
            if (migrated.length > 0) {
              setAnalyses(migrated);
              if (!activeId || !migrated.find(a => a.id === activeId)) {
                setActiveId(migrated[0].id);
              }
            }
          }
        }
      } catch (error) {
        console.error("[LOAD] Failed to load data:", error);
        // Fallback to localStorage for local dev
        try {
          let saved = localStorage.getItem("requirementAnalyses");
          if (saved) {
            const parsed = JSON.parse(saved);
            const migrated = Array.isArray(parsed) ? parsed.map(migrateAnalysis) : [];
            if (migrated.length > 0) {
              setAnalyses(migrated);
              if (!activeId || !migrated.find(a => a.id === activeId)) {
                setActiveId(migrated[0].id);
              }
            }
          }
        } catch (e) { /* ignore */ }
      } finally {
        console.log('[LOAD] Load complete, setting dataLoaded = true');
        setDataLoaded(true);
      }
    };
    loadData();
  }, []); // Only run on mount

  // Apply dark mode class to document
  useEffect(() => {
    console.log('Dark mode changed:', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
      console.log('Added dark class');
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Removed dark class');
    }
    localStorage.setItem("darkMode", darkMode);
  }, [darkMode]);

  // Load from URL share link on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedData = params.get("data");
    if (sharedData) {
      try {
        const decoded = JSON.parse(atob(sharedData));
        const migrated = migrateAnalysis(decoded);
        setAnalyses([migrated]);
        setActiveId(migrated.id);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error("Failed to decode shared link:", err);
      }
    }
  }, []);

  // Save to database whenever analyses change
  const saveTimeoutRef = useRef(null);
  useEffect(() => {
    const saveData = async () => {
      if (dataLoaded) {
        console.log('[SAVE] Saving', analyses.length, 'projects to API...');
        try {
          const response = await fetch('/api/projects', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projects: analyses })
          });
          if (response.ok) {
            console.log('[SAVE] Saved to API');
          } else {
            console.warn('[SAVE] API save failed, saving to localStorage as backup');
            localStorage.setItem("requirementAnalyses", JSON.stringify(analyses));
          }
        } catch (error) {
          console.warn('[SAVE] API unreachable, saving to localStorage:', error);
          localStorage.setItem("requirementAnalyses", JSON.stringify(analyses));
        }
      }
    };
    // Debounce saves to avoid hammering the API
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveData, 1000);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [analyses, dataLoaded]);

  // Poll for updates from other team members every 10 seconds
  useEffect(() => {
    if (!dataLoaded) return;
    const poll = setInterval(async () => {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) return;
        const rows = await response.json();
        if (rows.length > 0) {
          const projects = rows.map(r => migrateAnalysis(typeof r.data === 'string' ? JSON.parse(r.data) : r.data));
          // Only update if data actually changed (compare by updated_at timestamps)
          const remoteTimestamps = rows.map(r => r.updated_at).sort().join(',');
          const localTimestamps = analyses.map(a => a.updatedAt || '').sort().join(',');
          if (remoteTimestamps !== localTimestamps) {
            console.log('[POLL] Remote changes detected, updating...');
            setAnalyses(projects);
          }
        }
      } catch { /* ignore poll failures */ }
    }, 10000);
    return () => clearInterval(poll);
  }, [dataLoaded, analyses]);

  // Remove old secure mode preference (no longer needed)
  useEffect(() => {
    localStorage.removeItem("secureMode");
  }, []);

  // Save active section to localStorage
  useEffect(() => {
    localStorage.setItem("activeSection", activeSection);
  }, [activeSection]);

  // Save GitHub token to localStorage
  useEffect(() => {
    if (githubToken) {
      localStorage.setItem("githubToken", githubToken);
    } else {
      localStorage.removeItem("githubToken");
    }
  }, [githubToken]);

  // Save GitHub AI key to localStorage
  useEffect(() => {
    if (githubAIKey) {
      localStorage.setItem("githubAIKey", githubAIKey);
    } else {
      localStorage.removeItem("githubAIKey");
    }
  }, [githubAIKey]);

  // Save GitHub Repository settings to localStorage
  useEffect(() => {
    if (githubRepoOwner) localStorage.setItem("githubRepoOwner", githubRepoOwner);
    else localStorage.removeItem("githubRepoOwner");
  }, [githubRepoOwner]);

  useEffect(() => {
    if (githubRepoName) localStorage.setItem("githubRepoName", githubRepoName);
    else localStorage.removeItem("githubRepoName");
  }, [githubRepoName]);

  useEffect(() => {
    localStorage.setItem("githubRepoBranch", githubRepoBranch);
  }, [githubRepoBranch]);

  // Initialize GitHub Sync instance
  useEffect(() => {
    if (!githubSyncRef.current) {
      githubSyncRef.current = new GitHubSync({
        token: githubToken,
        owner: githubRepoOwner,
        repo: githubRepoName,
        branch: githubRepoBranch,
        filePath: 'requirement-analyzer-data.json'
      });

      // Listen to sync status updates
      githubSyncRef.current.addListener((status) => {
        setGithubSyncStatus(status);
      });
    } else {
      // Update configuration
      githubSyncRef.current.updateConfig({
        token: githubToken,
        owner: githubRepoOwner,
        repo: githubRepoName,
        branch: githubRepoBranch,
      });
    }
  }, [githubToken, githubRepoOwner, githubRepoName, githubRepoBranch]);

  // Auto-save to GitHub when analyses change
  useEffect(() => {
    const saveToGitHub = async () => {
      if (dataLoaded && githubSyncRef.current && githubSyncRef.current.isConfigured() && !hasSecureAnalysis) {
        try {
          const hybridStorage = new HybridStorage(githubSyncRef.current, 'requirementAnalyses');
          await hybridStorage.save(analyses, false); // false = debounced auto-save
        } catch (error) {
          console.error('[GitHub Sync] Auto-save failed:', error);
        }
      }
    };
    saveToGitHub();
  }, [analyses, dataLoaded, hasSecureAnalysis]);

  // Reset chat messages when switching tasks
  useEffect(() => {
    setChatMessages([]);
    setChatLoading(false);
  }, [activeId]);

  const active = useMemo(() => analyses.find((a) => a.id === activeId), [analyses, activeId]);

  // Ensure active project matches current mode
  useEffect(() => {
    if (!active) return;
    
    const activeProjectMode = active.projectMode || "design-specs";
    if (activeProjectMode !== appMode) {
      // Active project doesn't match current mode, switch to correct mode projects
      const modeProjects = analyses.filter(a => (a.projectMode || "design-specs") === appMode);
      if (modeProjects.length > 0) {
        setActiveId(modeProjects[0].id);
      } else {
        // No projects in current mode, create one
        const newProject = createBlankAnalysis(
          appMode === "discovery" ? "Untitled Discovery" : "Untitled Design Task",
          appMode
        );
        setAnalyses(prev => [newProject, ...prev]);
        setActiveId(newProject.id);
      }
    }
  }, [active, appMode, analyses]);

  // Active outcome for discovery mode
  const activeOutcome = useMemo(() => {
    if (!active || !active.outcomes || !active.activeOutcomeId) return null;
    return active.outcomes.find((o) => o.id === active.activeOutcomeId) || null;
  }, [active]);

  const filteredAnalyses = useMemo(() => {
    // Filter by project mode first
    const modeFiltered = analyses.filter((a) => (a.projectMode || "design-specs") === appMode);
    if (phaseFilter === "All") return modeFiltered;
    if (phaseFilter === "Untagged") return modeFiltered.filter((a) => !a.phase);
    return modeFiltered.filter((a) => a.phase === phaseFilter);
  }, [analyses, phaseFilter, appMode]);

  const updateActive = useCallback(
    (sectionKey, value) => {
      setAnalyses((prev) =>
        prev.map((a) =>
          a.id === activeId ? { ...a, [sectionKey]: value, updatedAt: new Date().toISOString() } : a
        )
      );
    },
    [activeId]
  );

  const updatePhase = useCallback(
    (phase) => {
      setAnalyses((prev) =>
        prev.map((a) =>
          a.id === activeId ? { ...a, phase, updatedAt: new Date().toISOString() } : a
        )
      );
    },
    [activeId]
  );

  // Sync discovery table opportunities → OST canvas (scoped to active outcome)
  const syncTableToOST = useCallback((tableData) => {
    if (!tableData || !tableData.rows) return;

    setAnalyses((prev) =>
      prev.map((a) => {
        if (a.id !== activeId) return a;
        if (!a.activeOutcomeId || !a.outcomes) return a;

        const outcomeIdx = a.outcomes.findIndex((o) => o.id === a.activeOutcomeId);
        if (outcomeIdx === -1) return a;

        const outcome = a.outcomes[outcomeIdx];
        const currentTree = outcome.opportunityTree || { outcome: { id: "outcome", text: outcome.name }, opportunities: [] };
        const existingOpps = currentTree.opportunities || [];

        // Build map of existing opportunities by their source row ID
        const existingByRowId = {};
        existingOpps.forEach((opp) => {
          if (opp.sourceRowId) existingByRowId[opp.sourceRowId] = opp;
        });

        // Create/update opportunities from table rows
        const newOpps = tableData.rows.map((row) => {
          const oppName = row.cells?.col_opp || "Untitled Opportunity";
          const existing = existingByRowId[row.id];
          if (existing) {
            return { ...existing, text: oppName };
          } else {
            return {
              id: row.id.replace("row_", "opp_"),
              sourceRowId: row.id,
              text: oppName,
              solutions: [],
            };
          }
        });

        const newTree = { ...currentTree, opportunities: newOpps };
        delete newTree.positions;

        const newOutcomes = [...a.outcomes];
        newOutcomes[outcomeIdx] = { ...outcome, opportunityTree: newTree };

        return { ...a, outcomes: newOutcomes, updatedAt: new Date().toISOString() };
      })
    );
  }, [activeId]);

  // Initial sync: populate OST from table data if OST has no opportunities yet
  useEffect(() => {
    if (!dataLoaded || !active || !activeOutcome) return;
    const table = activeOutcome.discoveryTable;
    const tree = activeOutcome.opportunityTree;
    // Only sync if table has rows and OST has no opportunities (or no tree at all)
    if (table && table.rows && table.rows.length > 0) {
      if (!tree || !tree.opportunities || tree.opportunities.length === 0) {
        syncTableToOST(table);
      }
    }
  }, [activeId, active?.activeOutcomeId, dataLoaded]); // Run after data loads or outcome switch

  // --- AI Chat ---
  const sendChatMessage = useCallback(async (userMessage) => {
    if (!githubAIKey || !active) return;

    const userMsg = { id: generateId(), role: 'user', content: userMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);

    // Serialize task data for context (strip large blobs)
    const taskContext = { ...active };
    delete taskContext.mapping; // figma url not useful for chat
    delete taskContext.designRefs; // design ref URLs/images not useful for chat
    delete taskContext.codeRefs; // code ref URLs not useful for chat

    let systemPrompt;
    if (appMode === "discovery") {
      const outcomeContext = activeOutcome ? {
        outcomeName: activeOutcome.name,
        discoveryTable: activeOutcome.discoveryTable,
        opportunityTree: activeOutcome.opportunityTree
      } : null;

      systemPrompt = `You are an expert product discovery assistant grounded in Teresa Torres' Opportunity Solution Tree (OST) framework and Continuous Discovery Habits.

## OST Framework Reference
The Opportunity Solution Tree is a visual tool that maps:
- **Outcome** (top): A measurable business or product outcome the team is driving toward (e.g. "Reduce task completion time")
- **Opportunities** (middle): Customer needs, pain points, or desires discovered through research. Opportunities are NOT features or solutions. They represent the customer's world. Good opportunities are specific, distinct, and actionable.
- **Solutions** (below opportunities): Ideas that address a specific opportunity. Multiple solutions can map to one opportunity. Solutions should be lightweight and testable.
- **Experiments** (bottom): Small, fast tests to validate assumptions behind a solution before committing to build it. Types include: prototype tests, one-question surveys, data mining, concierge tests.

Key principles:
- Work top-down: define the outcome first, then discover opportunities through customer interviews, then ideate solutions, then test assumptions.
- Opportunities come from what customers say, do, and feel — not from what stakeholders request.
- Compare and contrast opportunities before choosing which to pursue.
- Break large opportunities into smaller, more specific child opportunities.
- Never skip from outcome directly to solution — always identify the opportunity layer.
- Use "story mapping" structure: opportunities are needs/pain points in the customer's journey.
- Assumption mapping: for each solution, identify desirability, viability, feasibility, and usability assumptions. Test the riskiest first.

Your ONLY focus is helping with product discovery tasks:
- Identifying customer opportunities, needs, and pain points related to the current outcome
- Suggesting rows for the discovery table (opportunities, prioritization, solutions, experiments)
- Helping structure and refine the Opportunity Solution Tree
- Advising on discovery research methods and interview questions
- Analysing patterns across discovery data

You must NOT help with unrelated topics. If the user asks about something outside product discovery, politely redirect them to focus on discovery work.

Current outcome: ${outcomeContext ? outcomeContext.outcomeName : "(none selected)"}
Discovery project: "${active?.name || "Untitled"}"

Available research data (user research interview transcripts):
- DK — Enreach, DK — Jettime, DK — Visma (Denmark market)
- SE — Ambea, SE — Bico, SE — Carla, SE — FedEx, SE — Investor (Sweden market)
These are customer interview transcripts accessible via the "Research Data" tab. Reference them when suggesting research-backed opportunities.

${outcomeContext ? `Current discovery table data:
${JSON.stringify(outcomeContext.discoveryTable, null, 2)}

Opportunity tree:
${JSON.stringify(outcomeContext.opportunityTree, null, 2)}` : "No outcome selected yet."}

When you want to suggest adding rows to the discovery table, include a JSON block:
\`\`\`json
{"proposals": [{"section": "discoveryTable", "field": "_addRow", "value": {"col_opp": "opportunity text", "col_rprio": "High/Medium/Low", "col_sol": "potential solution"}, "reason": "<brief reason>"}]}
\`\`\`

Be concise and actionable. Respond in the same language the user writes in.`;
    } else {
      systemPrompt = `You are an expert UX/product design assistant helping analyze a requirement task. You have full access to the current task data below.

Current section the user is viewing: "${activeSection}"

Task data:
${JSON.stringify(taskContext, null, 2)}

Your role:
1. Answer questions about what is known and what is missing in this task
2. Identify gaps, risks, or inconsistencies
3. Suggest improvements to specific fields

When the user asks you to make changes or you want to suggest edits, include a JSON block in your response with this exact format:
\`\`\`json
{"proposals": [{"section": "<top-level key like problem, overview, context, etc>", "field": "<field name within that section>", "value": "<proposed new value>", "reason": "<brief reason>"}]}
\`\`\`

For array fields (assumptions, questions, actions, acceptanceCriteria), use the field "_add" and provide an object to append.
Only include the JSON block when proposing concrete changes. For general answers, just respond in plain text.
Be concise and actionable. Respond in the same language the user writes in.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatMessages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

    try {
      const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${githubAIKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          temperature: 0.5,
          max_tokens: 2000
        })
      });

      if (!response.ok) throw new Error('API error: ' + response.status);
      const data = await response.json();
      const content = data.choices[0].message.content;

      // Parse proposals from response
      let proposals = null;
      let displayContent = content;
      const jsonMatch = content.match(/```json\s*\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.proposals && Array.isArray(parsed.proposals)) {
            proposals = parsed.proposals.map(p => ({ ...p, applied: false }));
          }
          // Remove the JSON block from display text
          displayContent = content.replace(/```json\s*\n?[\s\S]*?\n?```/, '').trim();
        } catch { /* ignore parse errors, show raw */ }
      }

      const assistantMsg = {
        id: generateId(),
        role: 'assistant',
        content: displayContent,
        proposals
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.'
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setChatLoading(false);
    }
  }, [githubAIKey, active, activeSection, appMode, activeOutcome]);

  const handleApplyProposal = useCallback((messageId, proposalIndex) => {
    setChatMessages(prev => prev.map(msg => {
      if (msg.id !== messageId || !msg.proposals) return msg;
      const proposal = msg.proposals[proposalIndex];
      if (!proposal || proposal.applied) return msg;

      // Apply the change
      const section = proposal.section;
      const field = proposal.field;
      const value = proposal.value;

      if (field === '_add') {
        // Append to array field
        const currentArray = active[section] || [];
        if (Array.isArray(currentArray)) {
          const newItem = { id: generateId(), ...value };
          updateActive(section, [...currentArray, newItem]);
        }
      } else if (active[section] && typeof active[section] === 'object' && !Array.isArray(active[section])) {
        // Update a field within an object section
        updateActive(section, { ...active[section], [field]: value });
      } else {
        // Direct field update (e.g., notes)
        updateActive(section, value);
      }

      // Mark proposal as applied
      const newProposals = [...msg.proposals];
      newProposals[proposalIndex] = { ...proposal, applied: true };
      return { ...msg, proposals: newProposals };
    }));
  }, [active, updateActive]);

  const createNew = () => {
    const newA = createBlankAnalysis(appMode === "discovery" ? "Untitled Discovery" : "Untitled Design Task", appMode);
    setAnalyses((prev) => [newA, ...prev]);
    setActiveId(newA.id);
    setActiveSection(appMode === "discovery" ? "discoveryTable" : "overview");
    setPhaseFilter("All");
  };

  const deleteAnalysis = (id) => {
    setAnalyses((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (next.length === 0) {
        const blank = createBlankAnalysis();
        setActiveId(blank.id);
        return [blank];
      }
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  };

  // --- Outcome CRUD ---
  const addOutcome = useCallback((name) => {
    const newOutcome = createOutcome(name);
    setAnalyses((prev) =>
      prev.map((a) => {
        if (a.id !== activeId) return a;
        return {
          ...a,
          outcomes: [...(a.outcomes || []), newOutcome],
          activeOutcomeId: newOutcome.id,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  }, [activeId]);

  const archiveOutcome = useCallback((outcomeId) => {
    setAnalyses((prev) =>
      prev.map((a) => {
        if (a.id !== activeId) return a;
        const newOutcomes = (a.outcomes || []).map((o) =>
          o.id === outcomeId ? { ...o, status: "archived" } : o
        );
        // If archiving the active outcome, switch to first active one
        let newActiveId = a.activeOutcomeId;
        if (a.activeOutcomeId === outcomeId) {
          const nextActive = newOutcomes.find((o) => o.status === "active" && o.id !== outcomeId);
          newActiveId = nextActive ? nextActive.id : null;
        }
        return { ...a, outcomes: newOutcomes, activeOutcomeId: newActiveId, updatedAt: new Date().toISOString() };
      })
    );
  }, [activeId]);

  const switchOutcome = useCallback((outcomeId) => {
    setAnalyses((prev) =>
      prev.map((a) => {
        if (a.id !== activeId) return a;
        return { ...a, activeOutcomeId: outcomeId, updatedAt: new Date().toISOString() };
      })
    );
  }, [activeId]);

  const updateOutcomeField = useCallback((outcomeId, field, value) => {
    setAnalyses((prev) =>
      prev.map((a) => {
        if (a.id !== activeId) return a;
        const newOutcomes = (a.outcomes || []).map((o) =>
          o.id === outcomeId ? { ...o, [field]: value } : o
        );
        return { ...a, outcomes: newOutcomes, updatedAt: new Date().toISOString() };
      })
    );
  }, [activeId]);

  const updateName = (name) => {
    setAnalyses((prev) => prev.map((a) => {
      if (a.id === activeId) {
        return { 
          ...a, 
          name,
          overview: { ...a.overview, featureName: name }
        };
      }
      return a;
    }));
  };

  const handleExportMd = () => { if (active) setShowExport(true); };

  const handleGenerateAIBrief = () => {
    console.log('[GENERATE AI BRIEF] Button clicked');
    if (!active) {
      console.error('[GENERATE AI BRIEF] No active analysis');
      return;
    }
    const a = active; // active is already the analysis object
    console.log('[GENERATE AI BRIEF] Active analysis:', a.name);
    if (!a) {
      console.error('[GENERATE AI BRIEF] Analysis is null');
      return;
    }

    const lines = [];
    const h = (t, level = 2) => lines.push(`\n${"#".repeat(level)} ${t}`);
    const f = (label, val) => { if (val?.trim()) lines.push(`**${label}:** ${val}`); };

    const inc = a.summary?.includedSections || { ...RECOMMENDED_SECTIONS };
    const isIncluded = (id) => !!inc[id];

    // Title and metadata
    lines.push(`# AI Design Brief: ${a.name || "Untitled Design Task"}`);
    lines.push(`*Generated: ${new Date().toLocaleDateString()} | Target Phase: ${a.phase || "Not set"}*`);
    if (a.jiraTicket) lines.push(`*JIRA: ${a.jiraTicket}*`);

    // AI Task (always included if present)
    if (a.summary?.aiTask?.trim()) {
      h("AI Task");
      lines.push(a.summary.aiTask);
    }

    // Executive Summary
    if (isIncluded('overview') || isIncluded('problem')) {
      h("Executive Summary");
      if (isIncluded('overview')) {
        f("Feature", a.overview?.featureName);
      }
      if (isIncluded('problem')) {
        f("Problem Statement", a.problem?.problem);
        f("Business Outcome", a.problem?.outcome);
        f("Success Metrics", a.problem?.metrics);
      }
      if (isIncluded('overview') && a.overview?.description) lines.push(`\n${a.overview.description}`);
    }

    // User Context & Research
    if (isIncluded('context')) {
    h("User Context & Research");
    f("Target Users", a.problem?.who);
    f("User Segments", a.context?.segments);
    f("Current Workflow", a.context?.workflow);
    f("Workarounds in Use", a.context?.workarounds);
    f("Triggers/Entry Points", a.context?.triggers);
    if (a.context?.beforeAfter) {
      lines.push(`\n**Before/After Scenario:**`);
      lines.push(a.context.beforeAfter);
    }
    }

    // Requirements & Scope
    if (isIncluded('scope')) {
    h("Requirements & Scope");
    f("Affected Features", a.scope?.affected);
    f("New Patterns Needed", a.scope?.newPatterns);
    if (a.scope?.items && a.scope.items.length > 0) {
      lines.push(`\n**Scope Items by Version:**`);
      const byVersion = {};
      a.scope.items.forEach((item) => {
        const v = item.version || "Unassigned";
        if (!byVersion[v]) byVersion[v] = [];
        byVersion[v].push(item);
      });
      Object.entries(byVersion).forEach(([version, items]) => {
        lines.push(`\n*${version}:*`);
        items.forEach((item) => {
          const priority = item.priority ? ` [${item.priority}]` : "";
          lines.push(`- ${item.item}${priority}${item.description ? ` — ${item.description}` : ""}`);
        });
      });
    }
    }

    // Acceptance Criteria
    if (isIncluded('acceptance')) {
    h("Acceptance Criteria");
    if (!a.acceptanceCriteria || a.acceptanceCriteria.length === 0) {
      lines.push("*No acceptance criteria defined yet.*");
    } else {
      const mustHave = a.acceptanceCriteria.filter(c => c.priority === "Must Have");
      const shouldHave = a.acceptanceCriteria.filter(c => c.priority === "Should Have");
      const niceToHave = a.acceptanceCriteria.filter(c => c.priority === "Nice to Have");
      
      if (mustHave.length > 0) {
        lines.push(`\n**Must Have (${mustHave.length}):**`);
        mustHave.forEach(c => {
          const status = c.status === "Done" ? "✓" : c.status === "In Progress" ? "→" : "○";
          lines.push(`- ${status} ${c.text}`);
        });
      }
      if (shouldHave.length > 0) {
        lines.push(`\n**Should Have (${shouldHave.length}):**`);
        shouldHave.forEach(c => {
          const status = c.status === "Done" ? "✓" : c.status === "In Progress" ? "→" : "○";
          lines.push(`- ${status} ${c.text}`);
        });
      }
      if (niceToHave.length > 0) {
        lines.push(`\n**Nice to Have (${niceToHave.length}):**`);
        niceToHave.forEach(c => {
          const status = c.status === "Done" ? "✓" : c.status === "In Progress" ? "→" : "○";
          lines.push(`- ${status} ${c.text}`);
        });
      }
    }
    }

    // Visual References (legacy mapping)
    if (isIncluded('mapping')) {
    h("Visual References & Mapping");
    if (a.mapping?.figmaUrl) {
      lines.push(`Figma: ${a.mapping.figmaUrl}`);
      lines.push(`\n*Use this Figma file as the visual reference for all design decisions.*`);
    } else {
      lines.push("*No visual references available yet.*");
    }
    }

    // Design References
    if (isIncluded('designRefs')) {
    h("Design References");
    const refs = a.designRefs?.references || [];
    if (refs.length > 0) {
      refs.forEach((ref) => {
        const typeLabel = DESIGN_REF_TYPE_LABELS[ref.type] || ref.type;
        const statusLabel = ref.status === 'final' ? '✓ Final' : '⟳ WIP';
        lines.push(`- **${ref.label || 'Untitled'}** [${typeLabel}] — ${ref.url || '(no URL)'} (${statusLabel})`);
      });
      if (a.designRefs.notes?.trim()) {
        lines.push(`\n**Notes:** ${a.designRefs.notes}`);
      }
    } else {
      lines.push("*No design references yet.*");
    }
    }

    // Code References
    if (isIncluded('codeRefs')) {
    h("Code References");
    const repos = a.codeRefs?.repos || [];
    if (repos.length > 0) {
      const byType = {};
      repos.forEach(r => {
        const t = r.type || 'other';
        if (!byType[t]) byType[t] = [];
        byType[t].push(r);
      });
      Object.entries(byType).forEach(([type, items]) => {
        lines.push(`\n**${CODE_REF_TYPE_LABELS[type] || type}:**`);
        items.forEach(r => {
          const branch = r.branch ? ` (${r.branch})` : '';
          lines.push(`- ${r.label || 'Untitled'}: ${r.url || '(no URL)'}${branch}`);
          if (r.notes?.trim()) lines.push(`  ${r.notes}`);
        });
      });
    } else {
      lines.push("*No code references yet.*");
    }
    }

    // Design System Reference
    if (isIncluded('design')) {
    h("Design System Reference");
    if (a.design?.systemName || a.design?.figmaUrl) {
      if (a.design.systemName) lines.push(`**Design System:** ${a.design.systemName}${a.design.version ? ` (${a.design.version})` : ""}`);
      if (a.design.componentLibrary) lines.push(`**Component Library:** ${a.design.componentLibrary}`);
      if (a.design.tokensLink) lines.push(`**Design Tokens:** ${a.design.tokensLink}`);
      if (a.design.figmaUrl) {
        lines.push(`**Figma File:** ${a.design.figmaUrl}`);
        lines.push(`\n*Reference this Figma file for the canonical design system components, patterns, and tokens.*`);
      }
      if (a.design.mcpInstructions?.trim()) {
        lines.push(`\n**Figma MCP Access:**`);
        lines.push(a.design.mcpInstructions);
        lines.push(`\n*AI agents with Figma MCP configured can access design system details programmatically for context-aware design suggestions.*`);
      }
    } else {
      lines.push("*No design system reference configured.*");
    }
    }

    // Constraints & Edge Cases
    if (isIncluded('edges')) {
    h("Technical Constraints & Edge Cases");
    f("Technical Constraints", a.scope?.technical);
    if (a.edges && Object.keys(a.edges).length > 0) {
      const consideredEdges = EDGE_CASE_ITEMS.filter(ec => a.edges[ec.id]?.considered);
      if (consideredEdges.length > 0) {
        lines.push(`\n**Edge Cases to Consider:**`);
        consideredEdges.forEach((ec) => {
          const d = a.edges[ec.id];
          lines.push(`- ✓ **${ec.label}**${d.notes ? `: ${d.notes}` : ""}`);
        });
      }
    }
    }
    if (isIncluded('assumptions') && a.assumptions && a.assumptions.length > 0) {
      const validAssumptions = a.assumptions.filter(item => item.text?.trim());
      if (validAssumptions.length > 0) {
        lines.push(`\n**Assumptions:**`);
        validAssumptions.forEach((item) => {
          lines.push(`- [${item.status}] ${item.text}`);
        });
      }
    }

    // Open Questions
    if (isIncluded('questions')) {
    h("Open Questions & Decisions Needed");
    if (!a.questions || a.questions.length === 0) {
      lines.push("*No open questions at this time.*");
    } else {
      const validQuestions = a.questions.filter(q => q.text?.trim());
      const unanswered = validQuestions.filter(q => q.status !== "Answered");
      const answered = validQuestions.filter(q => q.status === "Answered");
      if (unanswered.length > 0) {
        lines.push(`\n**Pending (${unanswered.length}):**`);
        unanswered.forEach((q) => {
          lines.push(`- (${q.type}) ${q.text}`);
        });
      }
      if (answered.length > 0) {
        lines.push(`\n**Resolved (${answered.length}):**`);
        answered.forEach((q) => {
          lines.push(`- (${q.type}) ${q.text}`);
          if (q.answer?.trim()) lines.push(`  → ${q.answer}`);
        });
      }
    }
    }

    // Next Steps & Actions
    h("Next Steps & Actions");
    f("Design Lead Next Steps", a.summary?.nextSteps);
    f("Confidence Level", a.summary?.confidence);
    f("Key Concerns", a.summary?.concerns);
    if (isIncluded('actions') && a.actions && a.actions.length > 0) {
      lines.push(`\n**Action Items:**`);
      a.actions.forEach((item) => {
        lines.push(`- [${item.completed ? "X" : " "}] ${item.text}`);
      });
    }

    // Additional Context
    if (isIncluded('notes') && a.notes?.trim()) {
      h("Additional Context & Notes");
      lines.push(a.notes);
    }

    // User Research
    if (isIncluded('research') && a.research?.rounds && a.research.rounds.length > 0) {
      h("User Research");
      a.research.rounds.forEach((round) => {
        lines.push(`\n### ${round.name || 'Research Round'}`);
        if (round.date) lines.push(`*Date: ${round.date}*`);
        if (round.methodology) lines.push(`*Methodology: ${round.methodology}*`);
        if (round.participants?.trim()) f("Participants", round.participants);
        if (round.hypotheses?.trim()) {
          lines.push(`\n**Hypotheses:**`);
          lines.push(round.hypotheses);
        }
        if (round.scenarios && round.scenarios.length > 0) {
          const validScenarios = round.scenarios.filter(s => s.task?.trim());
          if (validScenarios.length > 0) {
            lines.push(`\n**Test Scenarios:**`);
            validScenarios.forEach((s, i) => {
              const resultIcon = s.result === 'pass' ? '✓' : s.result === 'partial' ? '◐' : s.result === 'fail' ? '✗' : '○';
              lines.push(`${i + 1}. ${resultIcon} ${s.task}`);
              if (s.expectedOutcome?.trim()) lines.push(`   Expected: ${s.expectedOutcome}`);
              if (s.notes?.trim()) lines.push(`   Notes: ${s.notes}`);
            });
          }
        }
        if (round.findings?.trim()) {
          lines.push(`\n**Findings:**`);
          lines.push(round.findings);
        }
        if (round.recommendations?.trim()) {
          lines.push(`\n**Recommendations:**`);
          lines.push(round.recommendations);
        }
      });
    }

    // Wireframes
    if (isIncluded('wireframe') && a.wireframe?.iaSteps && a.wireframe.iaSteps.length > 0) {
      h("Information Architecture");
      const designSteps = a.wireframe.iaSteps.filter(s => s.designTask);
      const nonDesignSteps = a.wireframe.iaSteps.filter(s => !s.designTask);
      a.wireframe.iaSteps.forEach((step, i) => {
        const tag = step.type === 'backend' ? ' `[Backend]`' : '';
        const design = step.designTask ? ' 🎨' : '';
        lines.push(`${i + 1}. **${step.name}**${tag}${design}${step.description ? ` — ${step.description}` : ''}`);
      });
      if (designSteps.length > 0) {
        lines.push(`\n**Screens to design/prototype (${designSteps.length}):** ${designSteps.map(s => s.name).join(', ')}`);
      }

      const stepsWithWireframes = a.wireframe.iaSteps.filter(s => s.wireframe?.trim());
      if (stepsWithWireframes.length > 0) {
        h("Wireframes");
        stepsWithWireframes.forEach((step) => {
          lines.push(`\n### ${step.name}`);
          lines.push('```');
          lines.push(step.wireframe);
          lines.push('```');
        });
      }
    }

    // Footer
    lines.push(`\n---`);
    lines.push(`*This AI Design Brief was auto-generated from the Requirements Analyzer.*`);
    lines.push(`*Use this document to provide comprehensive context to AI design tools.*`);

    const mdContent = lines.join("\n");
    const taskSlug = (a.name || 'untitled').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40);

    // Check if multi-file mode is active
    const selectedIds = AI_BRIEF_SECTIONS.filter(s => inc[s.id]).map(s => s.id);
    const activeGroups = BRIEF_FILE_GROUPS.filter(g => g.sections.some(s => selectedIds.includes(s)));
    const multiFileMode = a.summary?.multiFileMode && activeGroups.length >= 2;

    if (!multiFileMode) {
      // Single file download
      const blob = new Blob([mdContent], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${taskSlug}_AI_Brief.md`;
      console.log('[GENERATE AI BRIEF] Triggering download:', link.download);
      link.click();
      URL.revokeObjectURL(url);
    } else {
      // Multi-file: generate one brief per active group
      const groupFiles = activeGroups.map(group => {
        const groupSectionIds = group.sections.filter(s => selectedIds.includes(s));
        const companionFiles = activeGroups.filter(g => g.id !== group.id).map(g => `${taskSlug}-${g.filename}.md`);

        const gLines = [];
        gLines.push(`# ${a.name || "Untitled Design Task"} — ${group.label}`);
        gLines.push(`*Generated: ${new Date().toLocaleDateString()} | Target Phase: ${a.phase || "Not set"}*`);
        if (a.jiraTicket) gLines.push(`*JIRA: ${a.jiraTicket}*`);
        if (companionFiles.length > 0) {
          gLines.push(`\n> **Companion files:** ${companionFiles.join(', ')}`);
        }
        if (a.summary?.aiTask?.trim() && group.id === 'core-brief') {
          gLines.push(`\n## AI Task`);
          gLines.push(a.summary.aiTask);
        }

        // Re-use the same generation logic but only for this group's sections
        const gInc = (id) => groupSectionIds.includes(id);
        const gh = (t, level = 2) => gLines.push(`\n${"#".repeat(level)} ${t}`);
        const gf = (label, val) => { if (val?.trim()) gLines.push(`**${label}:** ${val}`); };

        if (gInc('overview') || gInc('problem')) {
          gh("Executive Summary");
          if (gInc('overview')) gf("Feature", a.overview?.featureName);
          if (gInc('problem')) {
            gf("Problem Statement", a.problem?.problem);
            gf("Business Outcome", a.problem?.outcome);
            gf("Success Metrics", a.problem?.metrics);
          }
          if (gInc('overview') && a.overview?.description) gLines.push(`\n${a.overview.description}`);
        }
        if (gInc('context')) {
          gh("User Context & Research");
          gf("Target Users", a.problem?.who); gf("User Segments", a.context?.segments);
          gf("Current Workflow", a.context?.workflow); gf("Workarounds in Use", a.context?.workarounds);
          gf("Triggers/Entry Points", a.context?.triggers);
          if (a.context?.beforeAfter) { gLines.push(`\n**Before/After Scenario:**`); gLines.push(a.context.beforeAfter); }
        }
        if (gInc('scope')) {
          gh("Requirements & Scope");
          gf("Affected Features", a.scope?.affected); gf("New Patterns Needed", a.scope?.newPatterns);
          if (a.scope?.items?.length > 0) {
            gLines.push(`\n**Scope Items by Version:**`);
            const byV = {}; a.scope.items.forEach(i => { const v = i.version || "Unassigned"; if (!byV[v]) byV[v] = []; byV[v].push(i); });
            Object.entries(byV).forEach(([v, items]) => { gLines.push(`\n*${v}:*`); items.forEach(i => { gLines.push(`- ${i.item}${i.priority ? ` [${i.priority}]` : ''}${i.description ? ` — ${i.description}` : ''}`); }); });
          }
        }
        if (gInc('acceptance') && a.acceptanceCriteria?.length > 0) {
          gh("Acceptance Criteria");
          ["Must Have", "Should Have", "Nice to Have"].forEach(p => {
            const items = a.acceptanceCriteria.filter(c => c.priority === p);
            if (items.length > 0) { gLines.push(`\n**${p} (${items.length}):**`); items.forEach(c => { const s = c.status === "Done" ? "✓" : c.status === "In Progress" ? "→" : "○"; gLines.push(`- ${s} ${c.text}`); }); }
          });
        }
        if (gInc('research') && a.research?.rounds?.length > 0) {
          gh("User Research");
          a.research.rounds.forEach(r => { gLines.push(`\n### ${r.name || 'Research Round'}`); if (r.findings?.trim()) { gLines.push(`**Findings:** ${r.findings}`); } if (r.recommendations?.trim()) { gLines.push(`**Recommendations:** ${r.recommendations}`); } });
        }
        if (gInc('assumptions') && a.assumptions?.length > 0) {
          gh("Assumptions");
          a.assumptions.filter(i => i.text?.trim()).forEach(i => gLines.push(`- [${i.status}] ${i.text}`));
        }
        if (gInc('questions') && a.questions?.length > 0) {
          gh("Open Questions");
          const pending = a.questions.filter(q => q.text?.trim() && q.status !== "Answered");
          const answered = a.questions.filter(q => q.text?.trim() && q.status === "Answered");
          if (pending.length > 0) { gLines.push(`\n**Pending (${pending.length}):**`); pending.forEach(q => gLines.push(`- (${q.type}) ${q.text}`)); }
          if (answered.length > 0) { gLines.push(`\n**Resolved (${answered.length}):**`); answered.forEach(q => { gLines.push(`- (${q.type}) ${q.text}`); if (q.answer?.trim()) gLines.push(`  → ${q.answer}`); }); }
        }
        if (gInc('edges')) {
          gh("Edge Cases");
          gf("Technical Constraints", a.scope?.technical);
          const considered = EDGE_CASE_ITEMS.filter(ec => a.edges?.[ec.id]?.considered);
          if (considered.length > 0) { considered.forEach(ec => { const d = a.edges[ec.id]; gLines.push(`- ✓ **${ec.label}**${d.notes ? `: ${d.notes}` : ''}`); }); }
        }
        if (gInc('designRefs')) {
          gh("Design References");
          const refs = a.designRefs?.references || [];
          if (refs.length > 0) { refs.forEach(ref => { gLines.push(`- **${ref.label || 'Untitled'}** [${DESIGN_REF_TYPE_LABELS[ref.type] || ref.type}] — ${ref.url || '(no URL)'} (${ref.status === 'final' ? '✓ Final' : '⟳ WIP'})`); }); if (a.designRefs.notes?.trim()) gLines.push(`\n**Notes:** ${a.designRefs.notes}`); }
        }
        if (gInc('codeRefs')) {
          gh("Code References");
          const repos = a.codeRefs?.repos || [];
          if (repos.length > 0) { const byType = {}; repos.forEach(r => { const t = r.type || 'other'; if (!byType[t]) byType[t] = []; byType[t].push(r); }); Object.entries(byType).forEach(([type, items]) => { gLines.push(`\n**${CODE_REF_TYPE_LABELS[type] || type}:**`); items.forEach(r => { gLines.push(`- ${r.label || 'Untitled'}: ${r.url || '(no URL)'}${r.branch ? ` (${r.branch})` : ''}`); if (r.notes?.trim()) gLines.push(`  ${r.notes}`); }); }); }
        }
        if (gInc('mapping') && a.mapping?.figmaUrl) {
          gh("Visual References (Legacy)");
          gLines.push(`Figma: ${a.mapping.figmaUrl}`);
        }
        if (gInc('design')) {
          gh("Design System Reference");
          if (a.design?.systemName) gLines.push(`**Design System:** ${a.design.systemName}${a.design.version ? ` (${a.design.version})` : ''}`);
          if (a.design?.componentLibrary) gLines.push(`**Component Library:** ${a.design.componentLibrary}`);
          if (a.design?.figmaUrl) gLines.push(`**Figma File:** ${a.design.figmaUrl}`);
          if (a.design?.mcpInstructions?.trim()) { gLines.push(`\n**Figma MCP Access:**`); gLines.push(a.design.mcpInstructions); }
        }
        if (gInc('wireframe') && a.wireframe?.iaSteps?.length > 0) {
          gh("Information Architecture");
          a.wireframe.iaSteps.forEach((step, i) => { gLines.push(`${i + 1}. **${step.name}**${step.type === 'backend' ? ' [Backend]' : ''}${step.description ? ` — ${step.description}` : ''}`); });
          const withWf = a.wireframe.iaSteps.filter(s => s.wireframe?.trim());
          if (withWf.length > 0) { gh("Wireframes"); withWf.forEach(s => { gLines.push(`\n### ${s.name}`); gLines.push('```'); gLines.push(s.wireframe); gLines.push('```'); }); }
        }
        if (gInc('actions') && a.actions?.length > 0) {
          gh("Action Items");
          a.actions.forEach(i => gLines.push(`- [${i.completed ? "X" : " "}] ${i.text}`));
        }
        if (gInc('notes') && a.notes?.trim()) {
          gh("Additional Notes");
          gLines.push(a.notes);
        }

        gLines.push(`\n---`);
        gLines.push(`*Auto-generated from Requirements Analyzer — ${group.label}*`);

        return { filename: `${taskSlug}-${group.filename}.md`, content: gLines.join("\n") };
      });

      // Download each file sequentially with small delay
      groupFiles.forEach((file, i) => {
        setTimeout(() => {
          const blob = new Blob([file.content], { type: "text/markdown" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = file.filename;
          link.click();
          URL.revokeObjectURL(url);
        }, i * 300);
      });
      console.log(`[GENERATE AI BRIEF] Multi-file download: ${groupFiles.length} files`);
    }
    console.log('[GENERATE AI BRIEF] Download complete');
  };

  const handleImportMd = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const markdown = e.target.result;
      setImportedMarkdown(markdown);
      setImportModalOpen(true);
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = "";
  };

  const handleImportNew = () => {
    if (!importedMarkdown) return;
    
    try {
      const imported = importFromMarkdown(importedMarkdown);
      setAnalyses((prev) => [imported, ...prev]);
      setActiveId(imported.id);
      setActiveSection("overview");
      setImportModalOpen(false);
      setImportedMarkdown("");
      alert(`Created new task: ${imported.name}`);
    } catch (error) {
      alert(`Failed to import markdown:\n${error.message}`);
    }
  };

  const handleImportExisting = () => {
    if (!importedMarkdown || !active) return;
    
    try {
      const imported = importFromMarkdown(importedMarkdown);
      
      // Merge with existing analysis
      setAnalyses((prev) =>
        prev.map((a) => {
          if (a.id !== activeId) return a;
          
          return {
            ...a,
            // Merge arrays
            assumptions: [...a.assumptions, ...imported.assumptions],
            questions: [...a.questions, ...imported.questions],
            actions: [...(a.actions || []), ...imported.actions],
            // Append text fields
            notes: a.notes ? `${a.notes}\n\n${imported.notes}` : imported.notes,
            // Keep existing values but allow imported ones to fill empty fields
            overview: {
              featureName: a.overview.featureName || imported.overview.featureName,
              date: a.overview.date || imported.overview.date,
              requestor: a.overview.requestor || imported.overview.requestor,
              origin: a.overview.origin || imported.overview.origin,
              originOther: a.overview.originOther || imported.overview.originOther,
              description: a.overview.description ? `${a.overview.description}\n\n${imported.overview.description}` : imported.overview.description,
            },
            problem: {
              problem: a.problem.problem || imported.problem.problem,
              who: a.problem.who || imported.problem.who,
              outcome: a.problem.outcome || imported.problem.outcome,
              metrics: a.problem.metrics || imported.problem.metrics,
              ifNotBuilt: a.problem.ifNotBuilt || imported.problem.ifNotBuilt,
            },
            context: {
              segments: a.context.segments || imported.context.segments,
              workflow: a.context.workflow || imported.context.workflow,
              workarounds: a.context.workarounds || imported.context.workarounds,
              triggers: a.context.triggers || imported.context.triggers,
              beforeAfter: a.context.beforeAfter || imported.context.beforeAfter,
            },
            summary: {
              confidence: a.summary.confidence || imported.summary.confidence,
              concerns: a.summary.concerns || imported.summary.concerns,
              nextSteps: a.summary.nextSteps || imported.summary.nextSteps,
            },
            updatedAt: new Date().toISOString(),
          };
        })
      );
      
      setImportModalOpen(false);
      setImportedMarkdown("");
      alert("Merged markdown content with current task");
    } catch (error) {
      alert(`Failed to import markdown:\n${error.message}`);
    }
  };

  const handlePasteAnalyze = async () => {
    if (!pastedText.trim()) return;
    
    setPasteAnalyzing(true);
    
    try {
      const results = await analyzePastedText(pastedText, githubAIKey);
      setPasteResults(results);
    } catch (error) {
      alert(`Failed to analyze text:\n${error.message}`);
    } finally {
      setPasteAnalyzing(false);
    }
  };

  const handleImageAnalyze = async () => {
    if (!pastedImage) return;
    
    setPasteAnalyzing(true);
    
    try {
      const results = await analyzeImage(pastedImage, githubAIKey);
      setPasteResults(results);
    } catch (error) {
      alert(`Failed to analyze image:\n${error.message}`);
    } finally {
      setPasteAnalyzing(false);
    }
  };

  const handlePdfAnalyze = async () => {
    if (!pastedPdf) return;
    
    setPasteAnalyzing(true);
    
    try {
      // Extract text from PDF
      const text = await extractTextFromPDF(pastedPdf);
      // Analyze the extracted text
      const results = await analyzePastedText(text, githubAIKey);
      setPasteResults(results);
    } catch (error) {
      alert(`Failed to analyze PDF:\n${error.message}`);
    } finally {
      setPasteAnalyzing(false);
    }
  };

  const handleApplyPasteResults = () => {
    if (!pasteResults || !active) return;
    
    setAnalyses((prev) =>
      prev.map((a) => {
        if (a.id !== activeId) return a;
        
        const updated = { ...a, updatedAt: new Date().toISOString() };
        
        // Helper to apply field based on merge mode
        const applyField = (fieldName, value, currentValue) => {
          if (!value) return currentValue;
          
          // Ensure values are strings
          const safeValue = typeof value === 'string' ? value : 
                           Array.isArray(value) ? value.join('\n') : 
                           typeof value === 'object' ? JSON.stringify(value, null, 2) : 
                           String(value);
          const safeCurrentValue = typeof currentValue === 'string' ? currentValue : String(currentValue || '');
          
          const mergeMode = pasteMergeModes[fieldName] || 'replace';
          if (!safeCurrentValue || safeCurrentValue.trim() === '') {
            return safeValue;
          }
          
          if (mergeMode === 'add') {
            return `${safeCurrentValue}\n\n${safeValue}`;
          }
          
          if (mergeMode === 'skip') {
            return safeCurrentValue; // keep existing, ignore new
          }
          
          return safeValue; // replace mode
        };
        
        // Update overview fields
        if (pasteResults.featureName) {
          updated.overview = { 
            ...updated.overview, 
            featureName: applyField('featureName', pasteResults.featureName, updated.overview.featureName)
          };
        }
        if (pasteResults.date) {
          updated.overview = { 
            ...updated.overview, 
            date: applyField('date', pasteResults.date, updated.overview.date)
          };
        }
        if (pasteResults.requestor) {
          updated.overview = { 
            ...updated.overview, 
            requestor: applyField('requestor', pasteResults.requestor, updated.overview.requestor)
          };
        }
        if (pasteResults.origin) {
          updated.overview = { 
            ...updated.overview, 
            origin: applyField('origin', pasteResults.origin, updated.overview.origin)
          };
        }
        if (pasteResults.description) {
          updated.overview = { 
            ...updated.overview, 
            description: applyField('description', pasteResults.description, updated.overview.description)
          };
        }
        
        // Update problem fields
        if (pasteResults.problem) {
          updated.problem = { 
            ...updated.problem, 
            problem: applyField('problem', pasteResults.problem, updated.problem.problem)
          };
        }
        if (pasteResults.who) {
          updated.problem = { 
            ...updated.problem, 
            who: applyField('who', pasteResults.who, updated.problem.who)
          };
        }
        if (pasteResults.outcome) {
          updated.problem = { 
            ...updated.problem, 
            outcome: applyField('outcome', pasteResults.outcome, updated.problem.outcome)
          };
        }
        
        // Update context fields
        if (pasteResults.segments) {
          updated.context = { 
            ...updated.context, 
            segments: applyField('segments', pasteResults.segments, updated.context.segments)
          };
        }
        if (pasteResults.workflow) {
          updated.context = { 
            ...updated.context, 
            workflow: applyField('workflow', pasteResults.workflow, updated.context.workflow)
          };
        }
        
        // Append arrays (always append, no merge mode)
        if (pasteResults.assumptions && Array.isArray(pasteResults.assumptions)) {
          updated.assumptions = [...updated.assumptions, ...pasteResults.assumptions];
        }
        if (pasteResults.questions && Array.isArray(pasteResults.questions)) {
          updated.questions = [...updated.questions, ...pasteResults.questions];
        }
        if (pasteResults.acceptanceCriteria && Array.isArray(pasteResults.acceptanceCriteria)) {
          const newCriteria = pasteResults.acceptanceCriteria.map(text => ({ 
            id: generateId(), 
            text, 
            priority: "Must Have", 
            status: "Not Started",
            notes: "" 
          }));
          updated.acceptanceCriteria = [...(updated.acceptanceCriteria || []), ...newCriteria];
        }
        if (pasteResults.actions && Array.isArray(pasteResults.actions)) {
          const newActions = pasteResults.actions.map(text => ({ id: generateId(), text, completed: false }));
          updated.actions = [...(updated.actions || []), ...newActions];
        }
        
        // Append notes
        if (pasteResults.notes) {
          const notesText = Array.isArray(pasteResults.notes) 
            ? pasteResults.notes.map(n => `• ${n}`).join('\n')
            : pasteResults.notes;
          updated.notes = updated.notes 
            ? `${updated.notes}\n\n${notesText}` 
            : notesText;
        }
        
        return updated;
      })
    );
    
    setPasteModalOpen(false);
    setPastedText("");
    setPastedImage(null);
    setPastedPdf(null);
    setPasteResults(null);
    setPasteMergeModes({});
    alert("Applied extracted information to task");
  };

  const handleDeletePasteField = (fieldName) => {
    setPasteResults(prev => {
      if (!prev) return prev;
      const updated = { ...prev };
      delete updated[fieldName];
      return updated;
    });
  };

  const handleUpdatePasteField = (fieldName, value) => {
    setPasteResults(prev => {
      if (!prev) return prev;
      return { ...prev, [fieldName]: value };
    });
  };

  const handleSetPasteMergeMode = (fieldName, mode) => {
    setPasteMergeModes(prev => ({ ...prev, [fieldName]: mode }));
  };

  const handleExportJson = () => {
    if (!active) return;
    const encoded = btoa(JSON.stringify(active));
    const url = `${window.location.origin}${window.location.pathname}?data=${encoded}`;
    
    // Try to copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        alert("Share link copied to clipboard! Anyone with this link can view this analysis.");
      }).catch((err) => {
        console.error("Clipboard write failed:", err);
        // Show URL in prompt as fallback
        prompt("Copy this share link:", url);
      });
    } else {
      // Browser doesn't support clipboard API, show URL in prompt
      prompt("Copy this share link:", url);
    }
  };

  const handleSaveToGist = async () => {
    if (!active || !githubToken) {
      alert("Please enter your GitHub token first.");
      return;
    }
    
    setGistLoading(true);
    try {
      const gist = await saveToGist(active, githubToken);
      // Update analysis with gist ID
      setAnalyses(prev => prev.map(a => 
        a.id === activeId ? { ...a, gistId: gist.id } : a
      ));
      navigator.clipboard.writeText(gist.html_url);
      alert(`Saved to GitHub Gist!\n\nGist URL copied to clipboard:\n${gist.html_url}\n\nGist ID (for loading): ${gist.id}`);
    } catch (error) {
      alert(`Failed to save to GitHub Gist:\n${error.message}\n\nMake sure your token has 'gist' scope.`);
    } finally {
      setGistLoading(false);
    }
  };

  const handleLoadFromGist = async () => {
    if (!loadGistId.trim()) {
      alert("Please enter a Gist ID.");
      return;
    }
    
    setGistLoading(true);
    try {
      const data = await loadFromGist(loadGistId.trim(), githubToken);
      const migrated = migrateAnalysis(data);
      setAnalyses(prev => [...prev, migrated]);
      setActiveId(migrated.id);
      setLoadGistId("");
      alert(`Loaded analysis: ${migrated.name}`);
    } catch (error) {
      alert(`Failed to load from GitHub Gist:\n${error.message}\n\nMake sure the Gist ID is correct and the gist is accessible.`);
    } finally {
      setGistLoading(false);
    }
  };

  // GitHub Repository Sync handlers
  const handleLoadFromGitHub = async () => {
    if (!githubSyncRef.current || !githubSyncRef.current.isConfigured()) {
      alert("Please configure GitHub repository settings first:\n- Owner (your GitHub username or org)\n- Repository name\n- Personal access token");
      return;
    }

    try {
      const data = await githubSyncRef.current.loadData();
      if (data && Array.isArray(data)) {
        const migrated = data.map(migrateAnalysis);
        setAnalyses(migrated);
        if (migrated.length > 0) {
          setActiveId(migrated[0].id);
        }
        alert(`Successfully loaded ${migrated.length} analysis/analyses from GitHub!`);
      } else {
        alert("No data found in GitHub repository. Data will be saved on next change.");
      }
    } catch (error) {
      alert(`Failed to load from GitHub:\n${error.message}\n\nMake sure:\n- Repository exists and you have access\n- Token has 'repo' scope\n- Branch name is correct`);
    }
  };

  const handleSaveToGitHub = async () => {
    if (!githubSyncRef.current || !githubSyncRef.current.isConfigured()) {
      alert("Please configure GitHub repository settings first.");
      return;
    }

    try {
      const hybridStorage = new HybridStorage(githubSyncRef.current, 'requirementAnalyses');
      await hybridStorage.syncNow(analyses);
      alert("Successfully saved all analyses to GitHub!");
    } catch (error) {
      alert(`Failed to save to GitHub:\n${error.message}`);
    }
  };

  // Audio analysis handlers
  const handleStartRecording = async () => {
    setAudioProcessing(true);
    setTranscript("");
    const success = await startAudioRecording((finalTranscript, interimTranscript) => {
      setTranscript(prev => {
        const newTranscript = prev + finalTranscript;
        return newTranscript;
      });
    });
    if (success) {
      setIsRecording(true);
    } else {
      alert("Failed to start recording. Please check microphone permissions.");
    }
    setAudioProcessing(false);
  };

  const handleStopRecording = async () => {
    setAudioProcessing(true);
    await stopAudioRecording();
    setIsRecording(false);
    setAudioProcessing(false);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAudioProcessing(true);
    alert("Audio file transcription from uploads is not yet supported in the browser. Please use the recording feature or manually enter your content.");
    setAudioProcessing(false);
  };

  const handleAnalyzeTranscript = async () => {
    if (!transcript) return;
    
    setAudioProcessing(true);
    
    if (githubAIKey) {
      // Analyze with GitHub AI
      const suggestions = await analyzeWithGitHub(transcript, githubAIKey);
      if (suggestions) {
        setAiSuggestions(suggestions);
        // Initialize all sections as selected
        const selected = {};
        Object.keys(suggestions).forEach(key => { selected[key] = true; });
        setSelectedSections(selected);
      } else {
        alert("Failed to analyze with OpenAI. Please check your API key.");
      }
    } else {
      // Manual mode - put transcript in notes
      setAiSuggestions({ notes: transcript });
      setSelectedSections({ notes: true });
    }
    
    setAudioProcessing(false);
  };

  const handleToggleSection = (section) => {
    setSelectedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleUpdateSuggestion = (section, content) => {
    setAiSuggestions(prev => ({ ...prev, [section]: content }));
  };

  const handleSetMergeMode = (section, mode) => {
    setMergeModes(prev => ({ ...prev, [section]: mode }));
  };
  
  // Helper to get current value of a field from active analysis
  const getActiveFieldValue = (section) => {
    if (!active) return '';
    
    // Helper to safely convert to string
    const toSafeString = (val) => {
      if (val == null) return '';
      if (typeof val === 'string') return val;
      if (Array.isArray(val)) return val.join('\n');
      if (typeof val === 'object') return JSON.stringify(val, null, 2);
      return String(val);
    };
    
    // Direct fields
    if (active[section]) {
      return toSafeString(active[section]);
    }
    
    // Nested fields
    if (section === 'description') return toSafeString(active.overview?.description);
    if (section === 'featureName') return toSafeString(active.overview?.featureName);
    if (section === 'problem') return toSafeString(active.problem?.problem);
    if (section === 'who') return toSafeString(active.problem?.who);
    if (section === 'outcome') return toSafeString(active.problem?.outcome);
    if (section === 'segments') return toSafeString(active.context?.segments);
    if (section === 'workflow') return toSafeString(active.context?.workflow);
    
    return '';
  };

  const handleApplyAudioChanges = () => {
    Object.entries(aiSuggestions).forEach(([section, content]) => {
      // Ensure content is a string
      const safeContent = typeof content === 'string' ? content : 
                         Array.isArray(content) ? content.join('\n') : 
                         typeof content === 'object' ? JSON.stringify(content, null, 2) : 
                         String(content || '');
      
      if (selectedSections[section] !== false && safeContent.trim()) {
        const existingContent = getActiveFieldValue(section);
        const mergeMode = mergeModes[section] || 'replace';
        
        let finalContent = safeContent;
        if (existingContent && existingContent.trim()) {
          if (mergeMode === 'add') {
            // Add new content to existing
            finalContent = `${existingContent}\n\n${safeContent}`;
          } else if (mergeMode === 'skip') {
            // Keep existing, ignore new
            finalContent = existingContent;
          }
        }
        
        updateActive(section, finalContent);
      }
    });
    
    // Reset audio modal state
    setAudioModalOpen(false);
    setTranscript("");
    setAiSuggestions({});
    setSelectedSections({});
    setMergeModes({});
    setIsRecording(false);
  };

  const handleCloseAudioModal = () => {
    if (isRecording) {
      handleStopRecording();
    }
    setAudioModalOpen(false);
    setTranscript("");
    setAiSuggestions({});
    setSelectedSections({});
    setMergeModes({});
  };

  if (!active) return null;
  const completion = getCompletion(active);
  const { filled: tasksFilled, total: tasksTotal } = getTaskCount(active);

  // Count analyses per phase for the filter
  const phaseCounts = useMemo(() => {
    const counts = { All: analyses.length, Untagged: 0 };
    VERSION_PHASES.forEach((v) => { counts[v] = 0; });
    analyses.forEach((a) => {
      if (!a.phase) counts.Untagged++;
      else if (counts[a.phase] !== undefined) counts[a.phase]++;
    });
    return counts;
  }, [analyses]);

  const renderSection = () => {
    const lang = active.language || "en";
    switch (activeSection) {
      case "overview": return <OverviewSection 
        data={active.overview} 
        phase={active.phase} 
        jiraTicket={active.jiraTicket} 
        secureMode={active.secureMode || false}
        language={lang}
        projectMode={active.projectMode || "design-specs"}
        audioModalOpen={audioModalOpen}
        pasteModalOpen={pasteModalOpen}
        onChange={(v) => {
          // Sync task name when feature name changes
          if (v.featureName !== active.overview.featureName) {
            setAnalyses((prev) => prev.map((a) => 
              a.id === activeId ? { ...a, name: v.featureName, overview: v, updatedAt: new Date().toISOString() } : a
            ));
          } else {
            updateActive("overview", v);
          }
        }} 
        onPhaseChange={updatePhase} 
        onJiraTicketChange={(v) => updateActive("jiraTicket", v)}
        onSecureModeChange={(v) => updateActive("secureMode", v)}
        onLanguageChange={(v) => updateActive("language", v)}
        onOpenAudioModal={() => setAudioModalOpen(true)}
        onOpenPasteModal={() => setPasteModalOpen(true)}
      />;
      case "problem": return <ProblemSection data={active.problem} language={lang} onChange={(v) => updateActive("problem", v)} />;
      case "context": return <UserContextSection data={active.context} language={lang} onChange={(v) => updateActive("context", v)} />;
      case "assumptions": return <AssumptionsSection data={active.assumptions} language={lang} onChange={(v) => updateActive("assumptions", v)} />;
      case "edges": return <EdgeCasesSection data={active.edges} language={lang} onChange={(v) => updateActive("edges", v)} />;
      case "scope": return <ScopeSection data={active.scope} language={lang} onChange={(v) => updateActive("scope", v)} />;
      case "acceptance": return <AcceptanceCriteriaSection data={active.acceptanceCriteria || []} language={lang} onChange={(v) => updateActive("acceptanceCriteria", v)} />;
      case "questions": return <QuestionsSection data={active.questions} language={lang} onChange={(v) => updateActive("questions", v)} />;
      case "notes": return <NotesSection data={active.notes} language={lang} onChange={(v) => updateActive("notes", v)} />;
      case "research": return <UserResearchSection data={active.research || { rounds: [] }} language={lang} onChange={(v) => updateActive("research", v)} />;
      case "designRefs": return <DesignReferencesSection data={active.designRefs || { references: [], notes: "" }} language={lang} onChange={(v) => updateActive("designRefs", v)} />;
      case "codeRefs": return <CodeReferencesSection data={active.codeRefs || { repos: [] }} language={lang} onChange={(v) => updateActive("codeRefs", v)} />;
      case "design": return <DesignSystemSection data={active.design || {}} language={lang} onChange={(v) => updateActive("design", v)} />;
      case "wireframe": return <WireframeSection data={active.wireframe || { iaSteps: [] }} analysis={active} language={lang} githubAIKey={githubAIKey} onChange={(v) => updateActive("wireframe", v)} />;
      case "summary": return <SummarySection data={active.summary} language={lang} analysis={active} onChange={(v) => updateActive("summary", v)} onGenerateAIBrief={() => handleGenerateAIBrief()} />;
      // Discovery mode sections (scoped to active outcome)
      case "discoveryTable": {
        if (!activeOutcome) return <div className="text-center py-12 text-slate-500 dark:text-slate-400"><p className="text-sm">No outcome selected.</p><p className="text-xs mt-1">Create an outcome in the sidebar to start.</p></div>;
        return <DiscoveryTableSection data={activeOutcome.discoveryTable} outcomeName={activeOutcome.name} onChange={(v) => { updateOutcomeField(activeOutcome.id, "discoveryTable", v); syncTableToOST(v); }} />;
      }
      case "opportunityTree": {
        if (!activeOutcome) return <div className="text-center py-12 text-slate-500 dark:text-slate-400"><p className="text-sm">No outcome selected.</p><p className="text-xs mt-1">Create an outcome in the sidebar to start.</p></div>;
        return <OSTCanvas data={activeOutcome.opportunityTree} onChange={(v) => updateOutcomeField(activeOutcome.id, "opportunityTree", v)} />;
      }
      case "sourceDocuments": return <DocumentsSection />;
      case "feedback": return <FeedbackSection />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Top bar - spans full width */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3">
        <div className="flex flex-col gap-3">
          {/* Row 1: Mode Switcher + controls */}
          <div className="flex items-center gap-4">
            <ModeSwitch 
              mode={appMode} 
              onChange={(newMode) => {
                setAppMode(newMode);
                localStorage.setItem("appMode", newMode);
                setActiveSection(newMode === "discovery" ? "discoveryTable" : "overview");
                // Switch to first project in the new mode, or create one if none exist
                const modeProjects = analyses.filter(a => (a.projectMode || "design-specs") === newMode);
                if (modeProjects.length > 0) {
                  setActiveId(modeProjects[0].id);
                } else {
                  // No projects in this mode, create a new one
                  const newProject = createBlankAnalysis(
                    newMode === "discovery" ? "Untitled Discovery" : "Untitled Design Task",
                    newMode
                  );
                  setAnalyses(prev => [newProject, ...prev]);
                  setActiveId(newProject.id);
                }
              }} 
            />
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <div className={appMode === "discovery" ? "opacity-0 pointer-events-none" : ""}>
                {active.phase && <VersionBadge version={active.phase} />}
              </div>
              <div className={`flex items-center gap-2 ${appMode === "discovery" ? "opacity-0 pointer-events-none" : ""}`}>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${completion === 100 ? "bg-emerald-500" : "bg-slate-400"}`}
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 w-10">{tasksFilled}/{tasksTotal}</span>
              </div>
              <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
                  title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {darkMode ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => { setActionsPanelOpen(!actionsPanelOpen); if (!actionsPanelOpen && appMode === "discovery") setRightPanelTab("chat"); }}
                  className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
                    actionsPanelOpen 
                      ? "bg-slate-800 dark:bg-slate-600 text-white hover:bg-slate-700 dark:hover:bg-slate-500" 
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700"
                  }`}
                  title={actionsPanelOpen ? "Close panel" : "Open panel"}
                >
                  {actionsPanelOpen ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      <span>{appMode === "discovery" ? "Discovery AI" : "Open Actions"}</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </>
                  )}
                </button>
            </div>
          </div>
          {/* Visual separator between main tabs and sub-tabs */}
          <div className="border-t border-slate-200 dark:border-slate-700"></div>
          {/* Row 2: Section nav pills */}
          <div className="flex gap-1 flex-wrap items-center">
            {(appMode === "discovery" ? DISCOVERY_SECTIONS : SECTIONS).map((s) => {
              const lang = active.language || "en";
              const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
              const getCountText = () => {
                if (s.id === "assumptions") {
                  const open = active.assumptions.filter(a => a.status === "Unvalidated" || a.status === "Needs Research").length;
                  return `${open}`;
                }
                if (s.id === "questions") {
                  const open = active.questions.filter(q => q.status === "Open").length;
                  return `${open}`;
                }
                return undefined;
              };
              return (
                <Pill
                  key={s.id}
                  active={activeSection === s.id}
                  onClick={() => setActiveSection(s.id)}
                  completion={s.id !== "assumptions" && s.id !== "questions" ? getSectionCompletion(active, s.id) : undefined}
                  count={getCountText()}
                >
                  <span className="mr-1 opacity-60">{s.icon}</span>
                  {t.sections[s.id] || s.label}
                </Pill>
              );
            })}
            {appMode === "discovery" && (
              <>
                <div className="ml-auto" />
                {DISCOVERY_SECTIONS_RIGHT.map((s) => {
                  const lang = active.language || "en";
                  const t = TRANSLATIONS[lang] || TRANSLATIONS.en;
                  return (
                    <Pill
                      key={s.id}
                      active={activeSection === s.id}
                      onClick={() => setActiveSection(s.id)}
                    >
                      <span className="mr-1 opacity-60">{s.icon}</span>
                      {t.sections[s.id] || s.label}
                    </Pill>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Below header: Sidebar + Content + Right Panel */}
      <div className="flex flex-1 min-h-0">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0">

          {/* Phase filter - only show in design mode */}
          {appMode === "design-specs" && (
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex gap-1 flex-wrap">
                {["All", ...VERSION_PHASES.filter((v) => v !== "Cut"), "Untagged"].map((f) => {
                  const count = phaseCounts[f] || 0;
                  if (f !== "All" && count === 0) return null;
                  const isActive = phaseFilter === f;
                  const colors = VERSION_COLORS[f];
                  return (
                    <button
                      key={f}
                      onClick={() => setPhaseFilter(f)}
                      className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                        isActive
                          ? colors
                            ? `${colors.bg} ${colors.text} font-medium`
                            : "bg-slate-800 text-white font-medium"
                          : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                      }`}
                    >
                      {f} {count > 0 && <span className="opacity-60">{count}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto py-2">
            {filteredAnalyses.map((a) => {
              const comp = getCompletion(a);
              return (
                <div key={a.id}>
                <div
                  onClick={() => { 
                    if (a.id !== activeId) {
                      setActiveId(a.id); 
                      setActiveSection(appMode === "discovery" ? "discoveryTable" : "overview");
                    }
                  }}
                  onDoubleClick={() => setEditingProjectId(a.id)}
                  className={`mx-2 mb-1 px-3 py-2.5 rounded-lg cursor-pointer group transition-colors ${
                    a.id === activeId ? "bg-slate-100 dark:bg-slate-700" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  {a.jiraTicket && (
                    <div className="text-[10px] font-semibold tracking-wider text-slate-600 dark:text-slate-400 uppercase mb-1">
                      {a.jiraTicket}
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-1">
                    {editingProjectId === a.id ? (
                      <input
                        autoFocus
                        className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1 bg-white dark:bg-slate-600 border border-indigo-300 dark:border-indigo-600 rounded px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-indigo-400"
                        defaultValue={a.name || ""}
                        onBlur={(e) => { updateName(e.target.value); setEditingProjectId(null); }}
                        onKeyDown={(e) => { 
                          if (e.key === "Enter") { updateName(e.target.value); setEditingProjectId(null); }
                          if (e.key === "Escape") setEditingProjectId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span 
                        className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1 break-words"
                        onClick={(e) => { if (a.id === activeId) { e.stopPropagation(); setEditingProjectId(a.id); } }}
                        title={a.id === activeId ? "Click to rename" : ""}
                      >
                        {a.name || (appMode === "discovery" ? "Untitled Discovery" : "Untitled Design Task")}
                      </span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {a.secureMode && (
                        <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700" title="Secure mode enabled">
                          <svg className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </div>
                      )}
                      {appMode === "design-specs" && a.phase && <VersionBadge version={a.phase} size="xs" />}
                      {analyses.length > 1 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                          className="text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-500 opacity-0 group-hover:opacity-100 text-sm ml-1"
                        >×</button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Outcome sub-list for discovery mode */}
                {appMode === "discovery" && a.id === activeId && (
                  <div className="mx-2 mb-1">
                    {/* Active outcomes */}
                    {(a.outcomes || []).filter((o) => o.status === "active").map((o) => (
                      <div
                        key={o.id}
                        onClick={(e) => { e.stopPropagation(); switchOutcome(o.id); }}
                        className={`ml-4 px-2.5 py-1.5 rounded-md cursor-pointer group/outcome flex items-center gap-2 transition-colors ${
                          o.id === a.activeOutcomeId
                            ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${o.id === a.activeOutcomeId ? "bg-indigo-500" : "bg-slate-300 dark:bg-slate-500"}`} />
                        <span className={`text-xs flex-1 truncate ${o.id === a.activeOutcomeId ? "font-medium text-indigo-700 dark:text-indigo-300" : "text-slate-600 dark:text-slate-400"}`}>{o.name}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); archiveOutcome(o.id); }}
                          className="text-slate-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400 opacity-0 group-hover/outcome:opacity-100 transition-opacity"
                          title="Archive outcome"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {/* Archived outcomes toggle */}
                    {(a.outcomes || []).some((o) => o.status === "archived") && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowArchivedOutcomes(!showArchivedOutcomes); }}
                          className="ml-4 px-2.5 py-1 text-[10px] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                          {showArchivedOutcomes ? "Hide" : "Show"} archived ({(a.outcomes || []).filter((o) => o.status === "archived").length})
                        </button>
                        {showArchivedOutcomes && (a.outcomes || []).filter((o) => o.status === "archived").map((o) => (
                          <div
                            key={o.id}
                            className="ml-4 px-2.5 py-1.5 rounded-md flex items-center gap-2 opacity-50"
                          >
                            <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-300 dark:bg-slate-600" />
                            <span className="text-xs flex-1 truncate text-slate-400 dark:text-slate-500 line-through">{o.name}</span>
                          </div>
                        ))}
                      </>
                    )}

                    {/* + New Outcome button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setOutcomeWizardOpen(true); setOutcomeWizardStep(1); setOutcomeWizardName(""); setOutcomeWizardConfirmed(false); }}
                      className="ml-4 px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors w-full text-left"
                    >
                      + New Outcome
                    </button>


                  </div>
                )}
                </div>
              );
            })}
            {filteredAnalyses.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                No analyses in this phase.
              </div>
            )}
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
            {/* New Design Task / Discovery Button */}
            <button
              onClick={createNew}
              className="w-full py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors font-medium"
            >
              {appMode === "discovery" ? "+ New discovery project" : "+ New design task"}
            </button>
            
            {/* Export Options Section */}
            {syncOptionsExpanded && (
              <div className="space-y-2 mb-2">
                {/* GitHub Gist Sync - Only when current analysis doesn't have secure mode */}
                {!active?.secureMode && gistExpanded && (
                  <div className="space-y-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                    {/* GitHub Token */}
                    <div>
                      <label className="text-sm text-slate-700 dark:text-slate-200 mb-1 block font-medium">GitHub Token</label>
                      <input
                        type="password"
                        placeholder="ghp_..."
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                      />
                      <a
                        href="https://github.com/settings/tokens/new?description=Requirement%20Analyzer&scopes=gist"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline mt-1 inline-block"
                      >
                        Create token
                      </a>
                    </div>
                    
                    {/* Save to Gist */}
                    <button
                      onClick={handleSaveToGist}
                      disabled={gistLoading || !githubToken}
                      className="w-full py-2.5 text-sm text-white bg-slate-800 dark:bg-slate-600 hover:bg-slate-700 dark:hover:bg-slate-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {gistLoading ? "Saving..." : active?.gistId ? "Update Gist" : "Save to Gist"}
                    </button>
                    
                    {/* Load from Gist */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Gist ID"
                        value={loadGistId}
                        onChange={(e) => setLoadGistId(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                      />
                      <button
                        onClick={handleLoadFromGist}
                        disabled={gistLoading || !loadGistId.trim()}
                        className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded hover:border-slate-400 dark:hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                )}
                
                {!active?.secureMode && (
                  <button
                    onClick={() => setGistExpanded(!gistExpanded)}
                    className="w-full py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors flex items-center justify-center gap-1"
                    title="Cloud backup: Saves your active task to GitHub as a private gist. Share the Gist ID with others to let them import a copy. Changes don't auto-sync between people - each save/load creates an independent snapshot."
                  >
                    GitHub Gist {gistExpanded ? "⌄" : "⌃"}
                  </button>
                )}
                
                {/* GitHub Repository Sync (Option 2 - Persistent Storage) */}
                {!active?.secureMode && githubRepoExpanded && (
                  <div className="space-y-2 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 p-2 bg-blue-50 dark:bg-slate-700 rounded">
                      💾 <strong>Auto-saves all analyses</strong> to your GitHub repository with version history
                    </div>
                    
                    {/* GitHub Token */}
                    <div>
                      <label className="text-sm text-slate-700 dark:text-slate-200 mb-1 block font-medium">GitHub Token</label>
                      <input
                        type="password"
                        placeholder="ghp_..."
                        value={githubToken}
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                      />
                      <a
                        href="https://github.com/settings/tokens/new?description=Requirement%20Analyzer&scopes=repo"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline mt-1 inline-block"
                      >
                        Create token (needs 'repo' scope)
                      </a>
                    </div>
                    
                    {/* Repository Owner */}
                    <div>
                      <label className="text-sm text-slate-700 dark:text-slate-200 mb-1 block font-medium">Repository Owner</label>
                      <input
                        type="text"
                        placeholder="your-username or organization"
                        value={githubRepoOwner}
                        onChange={(e) => setGithubRepoOwner(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                      />
                    </div>
                    
                    {/* Repository Name */}
                    <div>
                      <label className="text-sm text-slate-700 dark:text-slate-200 mb-1 block font-medium">Repository Name</label>
                      <input
                        type="text"
                        placeholder="my-requirements-data"
                        value={githubRepoName}
                        onChange={(e) => setGithubRepoName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                      />
                    </div>
                    
                    {/* Branch Name */}
                    <div>
                      <label className="text-sm text-slate-700 dark:text-slate-200 mb-1 block font-medium">Branch Name</label>
                      <input
                        type="text"
                        placeholder="data"
                        value={githubRepoBranch}
                        onChange={(e) => setGithubRepoBranch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Data will be stored in a separate branch</p>
                    </div>
                    
                    {/* Sync Status */}
                    {githubSyncStatus && (
                      <div className={`text-xs p-2 rounded ${
                        githubSyncStatus.status === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' :
                        githubSyncStatus.status === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' :
                        githubSyncStatus.status === 'saving' || githubSyncStatus.status === 'loading' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' :
                        'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}>
                        {githubSyncStatus.message}
                      </div>
                    )}
                    
                    {/* Manual Save/Load Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveToGitHub}
                        disabled={!githubSyncRef.current?.isConfigured()}
                        className="flex-1 py-2.5 text-sm text-white bg-slate-800 dark:bg-slate-600 hover:bg-slate-700 dark:hover:bg-slate-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Save Now
                      </button>
                      <button
                        onClick={handleLoadFromGitHub}
                        disabled={!githubSyncRef.current?.isConfigured()}
                        className="flex-1 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-600 rounded hover:border-slate-400 dark:hover:border-slate-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                )}
                
                {!active?.secureMode && (
                  <button
                    onClick={() => setGithubRepoExpanded(!githubRepoExpanded)}
                    className="w-full py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors flex items-center justify-center gap-1"
                    title="Persistent storage: Auto-saves all your analyses to a GitHub repository with full version history. Perfect for team collaboration and backup."
                  >
                    GitHub Repository Sync {githubRepoExpanded ? "⌄" : "⌃"}
                  </button>
                )}
                
                {/* Share Link */}
                <button
                  onClick={handleExportJson}
                  className="w-full py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
                >
                  Share active task
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImportMd}
                  accept=".md,.markdown,.txt"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="w-full py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
                >
                  Import Markdown
                </button>
                <button onClick={handleExportMd} className="w-full py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors">
                  Export as Markdown
                </button>
              </div>
            )}
            
            {/* Export Options Toggle Button */}
            <button
              onClick={() => setSyncOptionsExpanded(!syncOptionsExpanded)}
              className="w-full py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-600 rounded-lg hover:border-slate-300 dark:hover:border-slate-500 transition-colors flex items-center justify-center gap-1"
            >
              Export options {syncOptionsExpanded ? "⌄" : "⌃"}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeSection === "opportunityTree" || activeSection === "sourceDocuments" || activeSection === "feedback" ? (
          <div className="h-full p-8">{renderSection()}</div>
        ) : (
          <div className={activeSection === "mapping" || activeSection === "discoveryTable" ? "px-8 py-10" : "max-w-3xl mx-auto px-8 py-10"}>
            {renderSection()}
          </div>
        )}
      </div>

      {/* Right Panel — Actions / AI Chat tabs */}
      {actionsPanelOpen && (
        <div className="w-80 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                {appMode !== "discovery" && (
                  <button
                    onClick={() => setRightPanelTab("actions")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      rightPanelTab === "actions"
                        ? "bg-slate-800 dark:bg-slate-600 text-white"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {(TRANSLATIONS[active?.language] || TRANSLATIONS.en).chat.actions}
                  </button>
                )}
                {!active?.secureMode && (
                  <button
                    onClick={() => setRightPanelTab("chat")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
                      rightPanelTab === "chat" || appMode === "discovery"
                        ? "bg-slate-800 dark:bg-slate-600 text-white"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {appMode === "discovery" ? "Discovery AI" : (TRANSLATIONS[active?.language] || TRANSLATIONS.en).chat.title}
                  </button>
                )}
              </div>
              <button onClick={() => setActionsPanelOpen(false)} className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" title="Close panel">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
          {rightPanelTab === "actions" && appMode !== "discovery" ? (
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ActionsSection data={active.actions || []} onChange={(v) => updateActive("actions", v)} />
            </div>
          ) : (
            <TaskChat 
              language={active?.language || "en"}
              chatMessages={chatMessages}
              setChatMessages={setChatMessages}
              chatLoading={chatLoading}
              githubAIKey={githubAIKey}
              setGitHubAIKey={setGitHubAIKey}
              appMode={appMode}
              sendChatMessage={sendChatMessage}
              handleApplyProposal={handleApplyProposal}
              chatEndRef={chatEndRef}
              translations={TRANSLATIONS}
            />
          )}
        </div>
      )}

      {/* Audio Analysis Modal - Only when current analysis doesn't have secure mode */}
      {!active?.secureMode && (
        <AudioAnalysisModal
          isOpen={audioModalOpen}
          onClose={handleCloseAudioModal}
          isRecording={isRecording}
          transcript={transcript}
          audioProcessing={audioProcessing}
          aiSuggestions={aiSuggestions}
          selectedSections={selectedSections}
          onToggleSection={handleToggleSection}
          onUpdateSuggestion={handleUpdateSuggestion}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onFileUpload={handleFileUpload}
          onAnalyze={handleAnalyzeTranscript}
          onApply={handleApplyAudioChanges}
          githubAIKey={githubAIKey}
          onSetGitHubAIKey={setGitHubAIKey}
          activeAnalysis={active}
          mergeModes={mergeModes}
          onSetMergeMode={handleSetMergeMode}
        />
      )}

      {/* Paste & Analyze Modal - Only when current analysis doesn't have secure mode */}
      {!active?.secureMode && (
        <PasteAnalyzeModal
          isOpen={pasteModalOpen}
          onClose={() => {
            setPasteModalOpen(false);
            setPastedText("");
            setPastedImage(null);
            setPastedPdf(null);
            setPasteResults(null);
            setPasteMergeModes({});
          }}
          pastedText={pastedText}
          onTextChange={setPastedText}
          pastedImage={pastedImage}
          onImageChange={setPastedImage}
          pastedPdf={pastedPdf}
          onPdfChange={setPastedPdf}
          onAnalyze={handlePasteAnalyze}
          onImageAnalyze={handleImageAnalyze}
          onPdfAnalyze={handlePdfAnalyze}
          analyzing={pasteAnalyzing}
          results={pasteResults}
          onApply={handleApplyPasteResults}
          githubAIKey={githubAIKey}
          onSetGitHubAIKey={setGitHubAIKey}
          onDeleteField={handleDeletePasteField}
          onUpdateField={handleUpdatePasteField}
          activeAnalysis={active}
          mergeModes={pasteMergeModes}
          onSetMergeMode={handleSetPasteMergeMode}
        />
      )}

      {/* Import Markdown Modal */}
      <ImportMarkdownModal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          setImportedMarkdown("");
        }}
        onImportNew={handleImportNew}
        onImportExisting={handleImportExisting}
        hasActiveTask={!!active}
      />

      {/* Markdown Export Modal */}
      {showExport && active && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-8" onClick={() => setShowExport(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">Markdown Export</h3>
              <button onClick={() => setShowExport(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                {exportToMarkdown(active)}
              </pre>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-2">
              <button
                onClick={() => { 
                  navigator.clipboard.writeText(exportToMarkdown(active))
                    .then(() => alert('Markdown copied to clipboard!'))
                    .catch(err => console.error('Failed to copy:', err));
                }}
                className="px-4 py-2 text-sm font-medium bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Outcome Creation Wizard Modal */}
      {outcomeWizardOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-8" onClick={() => setOutcomeWizardOpen(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                {outcomeWizardStep === 1 ? "New Outcome" : "Confirm New Outcome"}
              </h3>
              <button onClick={() => setOutcomeWizardOpen(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-5">
              {outcomeWizardStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    An outcome defines a desired result. Each outcome gets its own discovery table and opportunity tree.
                  </p>
                  <div>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 block mb-1">Outcome name</label>
                    <input
                      type="text"
                      autoFocus
                      value={outcomeWizardName}
                      onChange={(e) => setOutcomeWizardName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && outcomeWizardName.trim()) setOutcomeWizardStep(2); }}
                      placeholder="e.g. Reduce task completion time for admins"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
              {outcomeWizardStep === 2 && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">This requires fresh analysis work</p>
                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1.5 list-disc pl-4">
                      <li>Creating a new outcome starts with an empty discovery table</li>
                      <li>You'll need to re-analyse research data through the lens of this new outcome</li>
                      <li>This ensures each outcome has focused, relevant opportunities</li>
                    </ul>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={outcomeWizardConfirmed}
                      onChange={(e) => setOutcomeWizardConfirmed(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">I understand this requires fresh analysis work</span>
                  </label>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-between">
              {outcomeWizardStep === 2 && (
                <button
                  onClick={() => setOutcomeWizardStep(1)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Back
                </button>
              )}
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => setOutcomeWizardOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                {outcomeWizardStep === 1 && (
                  <button
                    onClick={() => setOutcomeWizardStep(2)}
                    disabled={!outcomeWizardName.trim()}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                )}
                {outcomeWizardStep === 2 && (
                  <button
                    onClick={() => {
                      addOutcome(outcomeWizardName.trim());
                      setOutcomeWizardOpen(false);
                      setActiveSection("discoveryTable");
                    }}
                    disabled={!outcomeWizardConfirmed}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Outcome
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}