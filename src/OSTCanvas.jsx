import { useState, useCallback, useEffect, useRef } from "react";
import { Tldraw, createShapeId, DefaultColorStyle, toRichText, renderPlaintextFromRichText } from "tldraw";

// Layout constants
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 200;

// Color mapping for node types
const NODE_COLORS = {
  outcome: { bg: "#fef3c7", border: "#f59e0b", text: "#92400e", tldraw: "yellow" },
  opportunity: { bg: "#f3e8ff", border: "#a855f7", text: "#6b21a8", tldraw: "violet" },
  solution: { bg: "#dcfce7", border: "#22c55e", text: "#166534", tldraw: "green" },
  experiment: { bg: "#e0f2fe", border: "#0ea5e9", text: "#075985", tldraw: "blue" },
};

// Generate tldraw shapes + arrows from tree data
function treeDataToShapes(treeData, positions) {
  const shapes = [];
  const bindings = [];

  if (!treeData || !treeData.outcome) return { shapes, bindings };

  // Calculate layout positions if not provided
  const layout = positions || calculateLayout(treeData);

  // Outcome node
  const outcomeId = createShapeId(treeData.outcome.id);
  shapes.push({
    id: outcomeId,
    type: "geo",
    x: layout[treeData.outcome.id]?.x ?? 400,
    y: layout[treeData.outcome.id]?.y ?? 50,
    props: {
      w: NODE_WIDTH,
      h: NODE_HEIGHT,
      geo: "rectangle",
      richText: toRichText(treeData.outcome.text || "Desired Outcome"),
      color: NODE_COLORS.outcome.tldraw,
      fill: "solid",
      size: "s",
      font: "sans",
      align: "middle",
      verticalAlign: "middle",
    },
    meta: { nodeType: "outcome", nodeId: treeData.outcome.id },
  });

  // Opportunities
  (treeData.opportunities || []).forEach((opp) => {
    const oppId = createShapeId(opp.id);
    shapes.push({
      id: oppId,
      type: "geo",
      x: layout[opp.id]?.x ?? 400,
      y: layout[opp.id]?.y ?? 200,
      props: {
        w: NODE_WIDTH,
        h: NODE_HEIGHT,
        geo: "rectangle",
        richText: toRichText(opp.text || "Opportunity"),
        color: NODE_COLORS.opportunity.tldraw,
        fill: "solid",
        size: "s",
        font: "sans",
        align: "middle",
        verticalAlign: "middle",
      },
      meta: { nodeType: "opportunity", nodeId: opp.id },
    });

    // Arrow from outcome to opportunity — all start from center-bottom to form a shared trunk
    const arrowId = createShapeId(`arrow-${treeData.outcome.id}-${opp.id}`);
    shapes.push({
      id: arrowId,
      type: "arrow",
      x: 0,
      y: 0,
      props: {
        kind: "elbow",
        color: "grey",
        size: "s",
        bend: 0,
        elbowMidPoint: 0.5,
        arrowheadStart: "none",
        arrowheadEnd: "arrow",
        start: { x: 0, y: 0 },
        end: { x: 0, y: 0 },
      },
    });
    bindings.push(
      { fromId: arrowId, toId: outcomeId, type: "arrow", props: { terminal: "start", normalizedAnchor: { x: 0.5, y: 1 }, isExact: true, isPrecise: true } },
      { fromId: arrowId, toId: oppId, type: "arrow", props: { terminal: "end", normalizedAnchor: { x: 0.5, y: 0 }, isExact: true, isPrecise: true } }
    );

    // Solutions
    (opp.solutions || []).forEach((sol) => {
      const solId = createShapeId(sol.id);
      shapes.push({
        id: solId,
        type: "geo",
        x: layout[sol.id]?.x ?? 400,
        y: layout[sol.id]?.y ?? 350,
        props: {
          w: NODE_WIDTH,
          h: NODE_HEIGHT,
          geo: "rectangle",
          richText: toRichText(sol.text || "Solution"),
          color: NODE_COLORS.solution.tldraw,
          fill: "solid",
          size: "s",
          font: "sans",
          align: "middle",
          verticalAlign: "middle",
        },
        meta: { nodeType: "solution", nodeId: sol.id, parentId: opp.id },
      });

      // Arrow from opportunity to solution
      const solArrowId = createShapeId(`arrow-${opp.id}-${sol.id}`);
      shapes.push({
        id: solArrowId,
        type: "arrow",
        x: 0,
        y: 0,
        props: {
          kind: "elbow",
          color: "grey",
          size: "s",
          bend: 0,
          elbowMidPoint: 0.5,
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
        },
      });
      bindings.push(
        { fromId: solArrowId, toId: oppId, type: "arrow", props: { terminal: "start", normalizedAnchor: { x: 0.5, y: 1 }, isExact: false, isPrecise: false } },
        { fromId: solArrowId, toId: solId, type: "arrow", props: { terminal: "end", normalizedAnchor: { x: 0.5, y: 0 }, isExact: false, isPrecise: false } }
      );

      // Experiments
      (sol.experiments || []).forEach((exp) => {
        const expId = createShapeId(exp.id);
        shapes.push({
          id: expId,
          type: "geo",
          x: layout[exp.id]?.x ?? 400,
          y: layout[exp.id]?.y ?? 500,
          props: {
            w: NODE_WIDTH,
            h: NODE_HEIGHT,
            geo: "rectangle",
            richText: toRichText(exp.text || "Experiment"),
            color: NODE_COLORS.experiment.tldraw,
            fill: "solid",
            size: "s",
            font: "sans",
            align: "middle",
            verticalAlign: "middle",
          },
          meta: { nodeType: "experiment", nodeId: exp.id, parentId: sol.id, grandParentId: opp.id },
        });

        // Arrow from solution to experiment
        const expArrowId = createShapeId(`arrow-${sol.id}-${exp.id}`);
        shapes.push({
          id: expArrowId,
          type: "arrow",
          x: 0,
          y: 0,
          props: {
            kind: "elbow",
            color: "grey",
            size: "s",
            bend: 0,
            elbowMidPoint: 0.5,
            arrowheadStart: "none",
            arrowheadEnd: "arrow",
            start: { x: 0, y: 0 },
            end: { x: 0, y: 0 },
          },
        });
        bindings.push(
          { fromId: expArrowId, toId: solId, type: "arrow", props: { terminal: "start", normalizedAnchor: { x: 0.5, y: 1 }, isExact: false, isPrecise: false } },
          { fromId: expArrowId, toId: expId, type: "arrow", props: { terminal: "end", normalizedAnchor: { x: 0.5, y: 0 }, isExact: false, isPrecise: false } }
        );
      });
    });
  });

  return { shapes, bindings };
}

// Calculate hierarchical tree layout positions
function calculateLayout(treeData) {
  const positions = {};
  if (!treeData || !treeData.outcome) return positions;

  // Count total leaf nodes for width calculation
  let totalLeaves = 0;
  const oppWidths = [];

  (treeData.opportunities || []).forEach((opp) => {
    let oppLeafCount = 0;
    (opp.solutions || []).forEach((sol) => {
      const expCount = Math.max((sol.experiments || []).length, 1);
      oppLeafCount += expCount;
    });
    oppLeafCount = Math.max(oppLeafCount, 1);
    oppWidths.push(oppLeafCount);
    totalLeaves += oppLeafCount;
  });

  totalLeaves = Math.max(totalLeaves, 1);
  const totalWidth = totalLeaves * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;

  // Outcome centered at top
  positions[treeData.outcome.id] = { x: totalWidth / 2 - NODE_WIDTH / 2, y: 50 };

  // Layout each opportunity subtree
  let currentX = 0;

  (treeData.opportunities || []).forEach((opp, oppIdx) => {
    const oppWidth = oppWidths[oppIdx] * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;
    const oppCenterX = currentX + oppWidth / 2;

    positions[opp.id] = { x: oppCenterX - NODE_WIDTH / 2, y: 50 + VERTICAL_GAP };

    // Solutions
    let solX = currentX;
    (opp.solutions || []).forEach((sol) => {
      const expCount = Math.max((sol.experiments || []).length, 1);
      const solWidth = expCount * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;
      const solCenterX = solX + solWidth / 2;

      positions[sol.id] = { x: solCenterX - NODE_WIDTH / 2, y: 50 + VERTICAL_GAP * 2 };

      // Experiments
      (sol.experiments || []).forEach((exp, expIdx) => {
        positions[exp.id] = {
          x: solX + expIdx * (NODE_WIDTH + HORIZONTAL_GAP),
          y: 50 + VERTICAL_GAP * 3,
        };
      });

      solX += solWidth + HORIZONTAL_GAP;
    });

    currentX += oppWidth + HORIZONTAL_GAP;
  });

  return positions;
}

// Extract tree data from tldraw shapes (for text edits)
function shapesToTreeData(editor, currentData) {
  const allShapes = editor.getCurrentPageShapes();
  const geoShapes = allShapes.filter((s) => s.type === "geo" && s.meta?.nodeType);

  const newData = JSON.parse(JSON.stringify(currentData));

  geoShapes.forEach((shape) => {
    const { nodeType, nodeId, parentId, grandParentId } = shape.meta;
    const text = shape.props?.richText ? renderPlaintextFromRichText(editor, shape.props.richText) : "";

    if (nodeType === "outcome") {
      newData.outcome.text = text;
    } else if (nodeType === "opportunity") {
      const opp = newData.opportunities.find((o) => o.id === nodeId);
      if (opp) opp.text = text;
    } else if (nodeType === "solution") {
      const opp = newData.opportunities.find((o) => o.id === parentId);
      if (opp) {
        const sol = opp.solutions.find((s) => s.id === nodeId);
        if (sol) sol.text = text;
      }
    } else if (nodeType === "experiment") {
      const opp = newData.opportunities.find((o) => o.id === grandParentId);
      if (opp) {
        const sol = opp.solutions.find((s) => s.id === parentId);
        if (sol) {
          const exp = sol.experiments.find((e) => e.id === nodeId);
          if (exp) exp.text = text;
        }
      }
    }
  });

  return newData;
}

// Generate a unique ID
function genId() {
  return Math.random().toString(36).substring(2, 10);
}

// Get all node IDs belonging to an opportunity's chain (including outcome)
function getChainNodeIds(opportunityId, treeData) {
  const ids = new Set();
  ids.add(treeData.outcome.id);
  ids.add(opportunityId);

  const opp = (treeData.opportunities || []).find((o) => o.id === opportunityId);
  if (opp) {
    (opp.solutions || []).forEach((sol) => {
      ids.add(sol.id);
      (sol.experiments || []).forEach((exp) => {
        ids.add(exp.id);
      });
    });
  }
  return ids;
}

// Get the opportunity ID that a node belongs to
function getOpportunityForNode(shape, treeData) {
  if (!shape?.meta) return null;
  const { nodeType, nodeId, parentId, grandParentId } = shape.meta;
  if (nodeType === "opportunity") return nodeId;
  if (nodeType === "solution") return parentId;
  if (nodeType === "experiment") return grandParentId;
  if (nodeType === "outcome") return null;
  return null;
}

export default function OSTCanvas({ data, onChange }) {
  const editorRef = useRef(null);
  const [initialized, setInitialized] = useState(false);
  const [focusedOpportunityId, setFocusedOpportunityId] = useState(null);
  const focusedRef = useRef(null);
  focusedRef.current = focusedOpportunityId;

  const treeData = data || {
    outcome: { id: "outcome", text: "Desired Outcome" },
    opportunities: [],
  };

  const dataRef = useRef(treeData);
  dataRef.current = treeData;

  // Build initial snapshot
  const initialSnapshot = useRef(null);
  if (!initialSnapshot.current) {
    const positions = treeData.positions || calculateLayout(treeData);
    const { shapes, bindings } = treeDataToShapes(treeData, positions);
    initialSnapshot.current = { shapes, bindings };
  }

  const handleMount = useCallback((editor) => {
    editorRef.current = editor;

    // Create initial shapes
    const { shapes, bindings } = initialSnapshot.current;
    
    if (shapes.length > 0) {
      editor.createShapes(shapes);
      if (bindings.length > 0) {
        editor.createBindings(bindings);
      }
      // Center content at 100% zoom
      setTimeout(() => {
        editor.resetZoom();
        const bounds = editor.getCurrentPageBounds();
        if (bounds) {
          editor.centerOnPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });
        }
      }, 100);
    }

    setInitialized(true);

    // Click handler for chain focus
    const handlePointerUp = (info) => {
      // Small delay to let tldraw process the click first
      setTimeout(() => {
        const selectedShapes = editor.getSelectedShapes();
        const clickedShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

        if (!clickedShape || clickedShape.type !== "geo" || !clickedShape.meta?.nodeType) {
          // Clicked empty canvas or non-node — clear focus
          if (focusedRef.current) {
            setFocusedOpportunityId(null);
            focusedRef.current = null;
            applyFocusOpacity(editor, null);
          }
          return;
        }

        const { nodeType } = clickedShape.meta;

        if (nodeType === "opportunity") {
          const clickedId = clickedShape.meta.nodeId;
          if (focusedRef.current === clickedId) {
            // Toggle off
            setFocusedOpportunityId(null);
            focusedRef.current = null;
            applyFocusOpacity(editor, null);
          } else {
            // Focus this chain
            const chainIds = getChainNodeIds(clickedId, dataRef.current);
            setFocusedOpportunityId(clickedId);
            focusedRef.current = clickedId;
            applyFocusOpacity(editor, chainIds);
          }
        } else if (nodeType === "outcome") {
          // Clicking outcome clears focus
          if (focusedRef.current) {
            setFocusedOpportunityId(null);
            focusedRef.current = null;
            applyFocusOpacity(editor, null);
          }
        } else {
          // Clicked a solution or experiment — focus its parent opportunity chain
          const oppId = getOpportunityForNode(clickedShape, dataRef.current);
          if (oppId && oppId !== focusedRef.current) {
            const chainIds = getChainNodeIds(oppId, dataRef.current);
            setFocusedOpportunityId(oppId);
            focusedRef.current = oppId;
            applyFocusOpacity(editor, chainIds);
          } else if (oppId && oppId === focusedRef.current) {
            // Already focused on this chain — toggle off
            setFocusedOpportunityId(null);
            focusedRef.current = null;
            applyFocusOpacity(editor, null);
          }
        }
      }, 50);
    };

    editor.on("pointer_up", handlePointerUp);

    // Listen for shape changes (text edits, moves)
    const handleChange = () => {
      if (!editorRef.current) return;
      const newData = shapesToTreeData(editorRef.current, dataRef.current);
      
      // Save positions
      const allShapes = editorRef.current.getCurrentPageShapes();
      const positions = {};
      allShapes.forEach((s) => {
        if (s.type === "geo" && s.meta?.nodeId) {
          positions[s.meta.nodeId] = { x: s.x, y: s.y };
        }
      });
      newData.positions = positions;

      onChange(newData);
    };

    // Debounced change handler
    let timeout;
    const debouncedChange = () => {
      clearTimeout(timeout);
      timeout = setTimeout(handleChange, 500);
    };

    editor.sideEffects.registerAfterChangeHandler("shape", debouncedChange);
  }, [onChange]);

  // Sync external data changes (e.g., from discovery table) into the canvas
  const prevOppCountRef = useRef((treeData.opportunities || []).length);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !initialized) return;

    const currentOpps = treeData.opportunities || [];
    const prevCount = prevOppCountRef.current;

    // Detect if opportunities changed externally (count changed or names differ)
    if (currentOpps.length !== prevCount) {
      prevOppCountRef.current = currentOpps.length;
      const positions = calculateLayout(treeData);
      rebuildCanvas(editor, treeData, positions);
    } else {
      // Check if any text changed
      const allShapes = editor.getCurrentPageShapes();
      const oppShapes = allShapes.filter(s => s.meta?.nodeType === "opportunity");
      const needsRebuild = currentOpps.some(opp => {
        const shape = oppShapes.find(s => s.meta?.nodeId === opp.id);
        if (!shape) return true;
        const shapeText = shape.props?.richText ? renderPlaintextFromRichText(editor, shape.props.richText) : "";
        return shapeText !== opp.text;
      });
      if (needsRebuild) {
        const positions = treeData.positions || calculateLayout(treeData);
        rebuildCanvas(editor, treeData, positions);
      }
    }
  }, [treeData, initialized]);

  // Toolbar actions
  const addOpportunity = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const newId = genId();
    const newOpp = { id: newId, text: "New Opportunity", solutions: [] };
    const newData = { ...dataRef.current, opportunities: [...(dataRef.current.opportunities || []), newOpp] };
    
    // Recalculate layout
    const positions = calculateLayout(newData);
    newData.positions = positions;
    onChange(newData);

    // Recreate all shapes
    rebuildCanvas(editor, newData, positions);
  };

  const addSolution = () => {
    const editor = editorRef.current;
    if (!editor) return;

    // Find selected opportunity
    const selected = editor.getSelectedShapes();
    const oppShape = selected.find((s) => s.meta?.nodeType === "opportunity");
    if (!oppShape) {
      alert("Select an opportunity (purple node) first");
      return;
    }

    const newId = genId();
    const newSol = { id: newId, text: "New Solution", experiments: [] };
    const newData = JSON.parse(JSON.stringify(dataRef.current));
    const opp = newData.opportunities.find((o) => o.id === oppShape.meta.nodeId);
    if (opp) {
      opp.solutions.push(newSol);
      const positions = calculateLayout(newData);
      newData.positions = positions;
      onChange(newData);
      rebuildCanvas(editor, newData, positions);
    }
  };

  const addExperiment = () => {
    const editor = editorRef.current;
    if (!editor) return;

    // Find selected solution
    const selected = editor.getSelectedShapes();
    const solShape = selected.find((s) => s.meta?.nodeType === "solution");
    if (!solShape) {
      alert("Select a solution (green node) first");
      return;
    }

    const newId = genId();
    const newExp = { id: newId, text: "New Experiment" };
    const newData = JSON.parse(JSON.stringify(dataRef.current));
    const opp = newData.opportunities.find((o) => o.id === solShape.meta.parentId);
    if (opp) {
      const sol = opp.solutions.find((s) => s.id === solShape.meta.nodeId);
      if (sol) {
        sol.experiments.push(newExp);
        const positions = calculateLayout(newData);
        newData.positions = positions;
        onChange(newData);
        rebuildCanvas(editor, newData, positions);
      }
    }
  };

  const deleteSelected = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const selected = editor.getSelectedShapes();
    const nodeShape = selected.find((s) => s.type === "geo" && s.meta?.nodeType && s.meta.nodeType !== "outcome");
    if (!nodeShape) return;

    const { nodeType, nodeId, parentId, grandParentId } = nodeShape.meta;
    const newData = JSON.parse(JSON.stringify(dataRef.current));

    if (nodeType === "opportunity") {
      newData.opportunities = newData.opportunities.filter((o) => o.id !== nodeId);
    } else if (nodeType === "solution") {
      const opp = newData.opportunities.find((o) => o.id === parentId);
      if (opp) opp.solutions = opp.solutions.filter((s) => s.id !== nodeId);
    } else if (nodeType === "experiment") {
      const opp = newData.opportunities.find((o) => o.id === grandParentId);
      if (opp) {
        const sol = opp.solutions.find((s) => s.id === parentId);
        if (sol) sol.experiments = sol.experiments.filter((e) => e.id !== nodeId);
      }
    }

    const positions = calculateLayout(newData);
    newData.positions = positions;
    onChange(newData);
    rebuildCanvas(editor, newData, positions);
  };

  // Apply opacity to shapes based on focus state
  const applyFocusOpacity = (editor, chainNodeIds) => {
    const allShapes = editor.getCurrentPageShapes();
    const updates = [];

    if (!chainNodeIds) {
      // Clear focus — restore all to full opacity
      allShapes.forEach((shape) => {
        if (shape.opacity !== 1) {
          updates.push({ id: shape.id, type: shape.type, opacity: 1 });
        }
      });
    } else {
      // Dim non-focused, highlight focused
      allShapes.forEach((shape) => {
        if (shape.type === "geo" && shape.meta?.nodeId) {
          const inChain = chainNodeIds.has(shape.meta.nodeId);
          const targetOpacity = inChain ? 1 : 0.2;
          if (shape.opacity !== targetOpacity) {
            updates.push({ id: shape.id, type: shape.type, opacity: targetOpacity });
          }
        } else if (shape.type === "arrow") {
          // Check if arrow connects nodes in the chain via bindings
          const arrowBindings = editor.getBindingsFromShape(shape, "arrow");
          const connectedNodeIds = arrowBindings.map((b) => {
            const targetShape = editor.getShape(b.toId);
            return targetShape?.meta?.nodeId;
          }).filter(Boolean);
          const inChain = connectedNodeIds.length > 0 && connectedNodeIds.every((id) => chainNodeIds.has(id));
          const targetOpacity = inChain ? 1 : 0.2;
          if (shape.opacity !== targetOpacity) {
            updates.push({ id: shape.id, type: shape.type, opacity: targetOpacity });
          }
        }
      });
    }

    if (updates.length > 0) {
      editor.updateShapes(updates);
    }
  };

  const rebuildCanvas = (editor, newData, positions) => {
    // Clear all shapes
    const allShapeIds = editor.getCurrentPageShapeIds();
    if (allShapeIds.size > 0) {
      editor.deleteShapes([...allShapeIds]);
    }

    // Recreate
    const { shapes, bindings } = treeDataToShapes(newData, positions);
    if (shapes.length > 0) {
      editor.createShapes(shapes);
      if (bindings.length > 0) {
        editor.createBindings(bindings);
      }
    }

    // Re-apply focus if active
    if (focusedRef.current) {
      const oppStillExists = (newData.opportunities || []).some((o) => o.id === focusedRef.current);
      if (oppStillExists) {
        const chainIds = getChainNodeIds(focusedRef.current, newData);
        setTimeout(() => applyFocusOpacity(editor, chainIds), 10);
      } else {
        setFocusedOpportunityId(null);
        focusedRef.current = null;
      }
    }

    setTimeout(() => {
      editor.zoomToFit({ animation: { duration: 200 } });
    }, 100);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2">OST Canvas</span>
        <button
          onClick={addOpportunity}
          className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors font-medium"
        >
          + Opportunity
        </button>
        <button
          onClick={addSolution}
          className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors font-medium"
        >
          + Solution
        </button>
        <button
          onClick={addExperiment}
          className="px-3 py-1.5 text-xs bg-sky-600 text-white rounded-md hover:bg-sky-700 transition-colors font-medium"
        >
          + Experiment
        </button>
        {focusedOpportunityId && (
          <button
            onClick={() => {
              setFocusedOpportunityId(null);
              focusedRef.current = null;
              if (editorRef.current) applyFocusOpacity(editorRef.current, null);
            }}
            className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-md hover:bg-amber-600 transition-colors font-medium"
          >
            Clear Focus
          </button>
        )}
        <button
          onClick={deleteSelected}
          className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium ml-auto"
        >
          Delete Selected
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <Tldraw
          onMount={handleMount}
          inferDarkMode
          components={{
            Toolbar: null,
            StylePanel: null,
            PageMenu: null,
            ActionsMenu: null,
            MainMenu: null,
            NavigationPanel: null,
            HelpMenu: null,
            ZoomMenu: null,
            Minimap: null,
          }}
          options={{
            maxPages: 1,
          }}
        />
      </div>
    </div>
  );
}
