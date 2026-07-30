import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { confirmConcepts, getPersonalGraph, getGraphDrift } from '../api';

export default function ConceptMapView({ currentDoc, onStartTutor, onStartTeachNovice, onStartSpeakModel }) {
  const [concepts, setConcepts] = useState(currentDoc?.concepts || []);
  const [viewMode, setViewMode] = useState('mindmap'); // 'mindmap' | 'cards'
  const [graphPerspective, setGraphPerspective] = useState('canonical'); // 'canonical' | 'personal'
  const [personalGraphData, setPersonalGraphData] = useState(null);
  const [driftSummary, setDriftSummary] = useState(null);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [confirmedMap, setConfirmedMap] = useState({});
  const [msg, setMsg] = useState('');
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!currentDoc?.document_id) return;
    async function loadPersonalGraphData() {
      try {
        const [pgData, driftData] = await Promise.all([
          getPersonalGraph(currentDoc.document_id).catch(() => null),
          getGraphDrift(currentDoc.document_id).catch(() => null),
        ]);
        setPersonalGraphData(pgData);
        setDriftSummary(driftData);
      } catch (err) {
        console.error("Error loading personal graph data:", err);
      }
    }
    loadPersonalGraphData();
  }, [currentDoc]);

  if (!currentDoc || !concepts.length) {
    return (
      <div className="text-center py-20 text-secondary text-sm font-label-mono">
        No concepts extracted yet. Please upload a study material document first.
      </div>
    );
  }

  const rootTitle = currentDoc.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.15, 1.8));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 0.15, 0.6));
  const handleResetZoom = () => setZoomLevel(1);

  const handlePrereqToggle = async (conceptId, targetPrereqId) => {
    const concept = concepts.find((c) => c.id === conceptId);
    if (!concept) return;

    let updatedPrereqs = concept.suggested_prerequisites || [];
    if (updatedPrereqs.includes(targetPrereqId)) {
      updatedPrereqs = updatedPrereqs.filter((id) => id !== targetPrereqId);
    } else {
      updatedPrereqs = [...updatedPrereqs, targetPrereqId];
    }

    const updatedConcepts = concepts.map((c) =>
      c.id === conceptId ? { ...c, suggested_prerequisites: updatedPrereqs } : c
    );
    setConcepts(updatedConcepts);

    try {
      await confirmConcepts(conceptId, updatedPrereqs);
      setConfirmedMap((prev) => ({ ...prev, [conceptId]: true }));
      setMsg(`Updated links for concept "${concept.name}"`);

      // Refresh personal graph & drift summary
      const [pgData, driftData] = await Promise.all([
        getPersonalGraph(currentDoc.document_id).catch(() => null),
        getGraphDrift(currentDoc.document_id).catch(() => null),
      ]);
      setPersonalGraphData(pgData);
      setDriftSummary(driftData);

      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showRootDrawer, setShowRootDrawer] = useState(false);

  const [themeMode, setThemeMode] = useState('light'); // 'light' (Paper Cream default) | 'dark'
  const [expandedNodes, setExpandedNodes] = useState({});

  const toggleNodeExpand = (id, e) => {
    e.stopPropagation();
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Theme styling tokens — Paper Cream Academic Palette
  const isDark = themeMode === 'dark';
  const theme = {
    bg: isDark ? 'bg-[#1E1A16]' : 'bg-[#F5F0E6]',
    topBarBg: isDark ? 'bg-[#2A241D] border-[#3A332A]' : 'bg-[#EFE9DD] border-[#E2D9CB]',
    topBarText: isDark ? 'text-[#F0E6D2]' : 'text-[#2C221E]',
    toolbarBg: isDark ? 'bg-[#2A241D]/90 border-[#3A332A] text-[#A69C8C]' : 'bg-[#FFFDF7]/90 border-[#E2D9CB] text-[#786C5E]',
    rootBg: isDark ? 'bg-[#3D352B] border-[#D9A441]/40 text-[#F0E6D2]' : 'bg-[#FFFDF7] border-[#8C6D3B]/40 text-[#2C221E]',
    nodeBg: isDark ? 'bg-[#2A241D] hover:bg-[#332C23] text-[#F0E6D2] border-[#3A332A]' : 'bg-[#FFFDF7] hover:bg-[#EFE9DD] text-[#2C221E] border-[#E2D9CB]',
    selectedNodeBg: isDark ? 'bg-[#3D352B] text-[#F0E6D2] ring-2 ring-[#D9A441]' : 'bg-[#EFE9DD] text-[#2C221E] ring-2 ring-[#D9A441]',
    strokeColor: '#D9A441',
    strokeDefault: isDark ? '#6B6255' : '#CFC4B2',
    drawerBg: isDark ? 'bg-[#2A241D] border-[#3A332A] text-[#F0E6D2]' : 'bg-[#FFFDF7] border-[#E2D9CB] text-[#2C221E]',
  };

  // Node Positions for Mindmap Tree Canvas
  const nodeHeight = 56;
  const nodeGap = 24;
  const totalHeight = Math.max(520, concepts.length * (nodeHeight + nodeGap) + 120);
  const rootX = 140;
  const rootY = totalHeight / 2;
  const targetX = 500;

  const handleRootClick = () => {
    setIsCollapsed(!isCollapsed);
    setShowRootDrawer(!showRootDrawer);
  };

  // Helper map for personal graph edges
  const personalEdgeMap = {};
  if (personalGraphData?.personal_edges) {
    personalGraphData.personal_edges.forEach((pe) => {
      const key = `${pe.from_concept_id}->${pe.to_concept_id}`;
      personalEdgeMap[key] = pe;
    });
  }

  return (
    <div className={`flex-1 flex flex-col min-h-[calc(100vh-4rem)] ${theme.bg} transition-colors duration-300 relative overflow-hidden select-none`}>
      {/* Streamlined Top Bar Header */}
      <div className={`px-6 py-3.5 border-b ${theme.topBarBg} flex flex-wrap items-center justify-between gap-4 z-20 shadow-xs`}>
        {/* Title & Badge */}
        <div className="flex items-center gap-3">
          <h2 className={`text-xl font-semibold font-heading ${theme.topBarText}`}>
            Concept Graph
          </h2>
          <span className="mentra-badge bg-[#E7E0D3] text-[#2C221E] border border-[#CFC4B2] shrink-0">
            {concepts.length} Modules
          </span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Canonical vs Personal Graph Toggle */}
          <div className={`p-0.5 rounded-lg border flex items-center gap-0.5 ${isDark ? 'bg-[#2a303c] border-white/10' : 'bg-surface-container border-outline-variant/30'}`}>
            <button
              onClick={() => setGraphPerspective('canonical')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1 transition-all ${
                graphPerspective === 'canonical'
                  ? 'bg-primary text-surface shadow-xs font-medium'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm" data-icon="account_tree">account_tree</span>
              <span>Canonical</span>
            </button>
            <button
              onClick={() => setGraphPerspective('personal')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1 transition-all ${
                graphPerspective === 'personal'
                  ? 'bg-primary text-surface shadow-xs font-medium'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm" data-icon="person_search">person_search</span>
              <span>Your View</span>
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className={`p-0.5 rounded-lg border flex items-center gap-0.5 ${isDark ? 'bg-[#2a303c] border-white/10' : 'bg-surface-container border-outline-variant/30'}`}>
            <button
              onClick={() => setViewMode('mindmap')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1 transition-all ${
                viewMode === 'mindmap'
                  ? 'bg-primary text-surface shadow-xs font-medium'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm" data-icon="schema">schema</span>
              <span>Tree</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-mono flex items-center gap-1 transition-all ${
                viewMode === 'cards'
                  ? 'bg-primary text-surface shadow-xs font-medium'
                  : 'opacity-70 hover:opacity-100'
              }`}
            >
              <span className="material-symbols-outlined text-sm" data-icon="grid_view">grid_view</span>
              <span>Cards</span>
            </button>
          </div>

          <button
            onClick={onStartTutor}
            className="bg-primary text-surface px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95 hover:opacity-90"
          >
            <span className="material-symbols-outlined text-sm" data-icon="chat">chat</span>
            <span>Ask Tutor</span>
          </button>
        </div>
      </div>

      {/* Graph Drift Banner (Plain-Language Summary) */}
      {driftSummary?.summary_sentence && (
        <div className={`px-8 py-3.5 border-b text-xs font-label-mono flex items-center gap-2.5 z-10 transition-colors ${
          graphPerspective === 'personal'
            ? 'bg-primary/10 border-primary/20 text-primary font-semibold'
            : isDark ? 'bg-[#1e232d] border-white/5 text-slate-300' : 'bg-surface-container-lowest border-outline-variant/15 text-secondary'
        }`}>
          <span className="material-symbols-outlined text-base text-primary" data-icon="info">info</span>
          <span>{driftSummary.summary_sentence}</span>
          {graphPerspective === 'canonical' && driftSummary.drift_counts?.total_differences > 0 && (
            <button
              onClick={() => setGraphPerspective('personal')}
              className="ml-auto underline font-bold hover:text-primary transition-colors shrink-0"
            >
              Switch to Your View ➔
            </button>
          )}
        </div>
      )}

      {msg && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-mastery-sage text-white px-4 py-2 rounded-full font-label-mono text-xs shadow-lg flex items-center gap-2">
          <span>✓</span> {msg}
        </div>
      )}

      {/* VIEW MODE 1: INTERACTIVE MINDMAP CANVAS */}
      {viewMode === 'mindmap' && (
        <div className="flex-1 relative overflow-auto concept-canvas flex items-center justify-center p-8">
          {/* Left Canvas Toolbar Controls */}
          <div className={`absolute left-8 top-12 z-30 flex flex-col rounded-xl overflow-hidden shadow-md ${theme.toolbarBg}`}>
            <button
              onClick={handleResetZoom}
              title="Fit View"
              className="p-3 border-b border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-lg" data-icon="unfold_more">unfold_more</span>
            </button>
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-3 border-b border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-lg" data-icon="add">add</span>
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-3 border-b border-white/10 hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-lg" data-icon="remove">remove</span>
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Expand All Branches" : "Collapse All Branches"}
              className="p-3 hover:bg-white/10 transition-colors"
            >
              <span className="material-symbols-outlined text-lg" data-icon={isCollapsed ? "unfold_more" : "compress"}>
                {isCollapsed ? 'unfold_more' : 'compress'}
              </span>
            </button>
          </div>

          {/* Scalable Mindmap Graph Area */}
          <div
            style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
            className="transition-transform duration-200 ease-out my-auto"
          >
            <svg
              width="1050"
              height={totalHeight}
              className="overflow-visible"
            >
              {/* Curved Connecting Bezier Branch Lines */}
              {!isCollapsed && concepts.map((concept, index) => {
                const nodeY = 50 + index * (nodeHeight + nodeGap) + nodeHeight / 2;
                const controlX = (rootX + 220) + (targetX - (rootX + 220)) * 0.5;

                // Check for personal edge overrides
                let stroke = selectedConcept?.id === concept.id ? theme.strokeColor : theme.strokeDefault;
                let strokeWidth = selectedConcept?.id === concept.id ? '3' : '2';
                let strokeDasharray = 'none';
                let opacity = '0.9';

                if (graphPerspective === 'personal') {
                  const pe = Object.values(personalEdgeMap).find(e => e.to_concept_id === concept.id || e.from_concept_id === concept.id);
                  if (pe) {
                    if (pe.edge_type === 'strengthened' || pe.edge_type === 'added') {
                      stroke = isDark ? '#a5b4fc' : '#0f172a'; // Ink navy (solid)
                      strokeWidth = '3';
                    } else if (pe.edge_type === 'weakened' || pe.edge_type === 'removed') {
                      stroke = isDark ? '#64748b' : '#94a3b8';
                      strokeDasharray = '4 4';
                      opacity = '0.4';
                    }
                  }
                }

                return (
                  <g key={`branch-${concept.id}`}>
                    <path
                      d={`M ${rootX + 220} ${rootY} C ${controlX} ${rootY}, ${controlX} ${nodeY}, ${targetX} ${nodeY}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDasharray}
                      className="transition-all duration-300 ease-in-out"
                      style={{ opacity }}
                    />
                  </g>
                );
              })}

              {/* Central Root Node */}
              <foreignObject x={rootX - 50} y={rootY - 28} width="270" height="56">
                <div
                  onClick={handleRootClick}
                  className={`w-full h-full rounded-xl px-4 py-2.5 flex items-center justify-between shadow-lg font-bold text-xs cursor-pointer hover:brightness-105 transition-all group ${theme.rootBg}`}
                >
                  <span className="truncate pr-1.5 text-ellipsis overflow-hidden whitespace-nowrap" title={rootTitle}>
                    {rootTitle}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRootClick();
                    }}
                    className="w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-xs flex items-center justify-center font-mono shrink-0 border border-primary/20 transition-transform group-hover:scale-105 active:scale-95"
                    title={isCollapsed ? "Expand Mindmap Tree" : "Collapse Mindmap Tree"}
                  >
                    {isCollapsed ? '>' : '<'}
                  </button>
                </div>
              </foreignObject>

              {/* Level 1 Module Nodes & Expandable Nested Sub-topics */}
              {!isCollapsed && concepts.map((concept, index) => {
                const nodeY = 50 + index * (nodeHeight + nodeGap);
                const isSelected = selectedConcept?.id === concept.id;
                const isExpanded = expandedNodes[concept.id];
                const subTopics = concept.sub_topics || ['Core Principles', 'Key Mechanisms'];

                return (
                  <g key={concept.id}>
                    <foreignObject
                      x={targetX}
                      y={nodeY}
                      width="360"
                      height={nodeHeight}
                    >
                      <div
                        onClick={() => setSelectedConcept(isSelected ? null : concept)}
                        className={`w-full h-full rounded-xl px-4 py-2.5 flex items-center justify-between cursor-pointer transition-all duration-200 shadow-md ${
                          isSelected ? theme.selectedNodeBg : theme.nodeBg
                        }`}
                      >
                        <span className="text-xs font-semibold truncate pr-2 font-body-md">
                          {concept.name}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {subTopics.length > 0 && (
                            <span
                              onClick={(e) => toggleNodeExpand(concept.id, e)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 font-mono font-bold transition-all"
                              title="Toggle Sub-topics"
                            >
                              {isExpanded ? '−' : `+${subTopics.length}`}
                            </span>
                          )}
                          <button
                            title="View Module Details"
                            className="w-6 h-6 rounded-md flex items-center justify-center text-xs transition-colors bg-white/20 hover:bg-white/30"
                          >
                            {isSelected ? '✕' : '>'}
                          </button>
                        </div>
                      </div>
                    </foreignObject>

                    {/* Level 2 Expandable Sub-topic Branch Nodes */}
                    {isExpanded && subTopics.map((sub, sIdx) => {
                      const subY = nodeY + (sIdx + 1) * 36;
                      return (
                        <g key={`sub-${concept.id}-${sIdx}`}>
                          <path
                            d={`M ${targetX + 360} ${nodeY + nodeHeight/2} C ${targetX + 410} ${nodeY + nodeHeight/2}, ${targetX + 410} ${subY + 14}, ${targetX + 440} ${subY + 14}`}
                            fill="none"
                            stroke={theme.strokeColor}
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                          <foreignObject x={targetX + 440} y={subY} width="220" height="32">
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedConcept({ name: sub, summary: `Sub-concept topic under ${concept.name}.`, suggested_prerequisites: [concept.name] });
                              }}
                              className={`w-full h-full rounded-lg px-3 py-1.5 text-[11px] font-medium border flex items-center justify-between cursor-pointer transition-all shadow-xs ${
                                isDark ? 'bg-[#3b4252] text-slate-200 border-indigo-400/30 hover:bg-indigo-900' : 'bg-surface-container-high text-primary border-outline-variant/30 hover:bg-primary/10'
                              }`}
                            >
                              <span className="truncate">{sub}</span>
                              <span className="text-[10px] opacity-70">›</span>
                            </div>
                          </foreignObject>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: CARDS GRID (WARM PAPER THEME) */}
      {viewMode === 'cards' && (
        <div className="flex-1 overflow-auto p-8 max-w-[1100px] mx-auto w-full bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-24">
            {concepts.map((concept, index) => {
              const isConfirmed = confirmedMap[concept.id];
              const prereqNames = (concept.suggested_prerequisites || [])
                .map((pId) => concepts.find((c) => c.id === pId)?.name)
                .filter(Boolean);

              return (
                <motion.div
                  key={concept.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05, ease: "easeOut" }}
                  className="bg-surface-container-lowest border border-outline-variant/30 p-6 flex flex-col justify-between space-y-4 rounded-xl shadow-xs hover:shadow-md transition-all active:scale-[0.98]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-label-mono text-xs text-primary font-bold uppercase tracking-wider block">
                        Concept #{index + 1}
                      </span>
                      {isConfirmed ? (
                        <span className="font-label-mono text-[10px] text-mastery-sage font-bold uppercase">
                          Confirmed ✓
                        </span>
                      ) : (
                        <span className="font-label-mono text-[10px] text-on-tertiary-container font-bold uppercase">
                          AI Extracted
                        </span>
                      )}
                    </div>
                    <h4 className="font-heading text-xl text-primary font-semibold mb-2">{concept.name}</h4>
                    <p className="font-body text-sm leading-relaxed text-secondary">{concept.summary}</p>

                    {/* Section 7 Extension: Neutral Gray Cross-Document Concept Memory Badge */}
                    {concept.global_history?.has_history && concept.global_history.linked_documents?.[0] && (
                      <div
                        className="mt-3 px-2.5 py-1 bg-surface-container-high border border-outline-variant/30 text-secondary rounded font-label-mono text-[10px] flex items-center gap-1.5 cursor-help"
                        title={`You showed ${concept.global_history.linked_documents[0].mastery_score}% mastery of this concept in ${concept.global_history.linked_documents[0].filename}`}
                      >
                        <span className="material-symbols-outlined text-[12px] font-bold" data-icon="sync">sync</span>
                        <span>↺ Seen in {concept.global_history.linked_documents[0].filename} ({concept.global_history.linked_documents[0].mastery_score}% prior mastery)</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-outline-variant/15 space-y-3">
                    <div className="flex items-center justify-between text-xs font-label-mono">
                      <span className="text-secondary">Prerequisites:</span>
                      <button
                        onClick={() => setEditingId(editingId === concept.id ? null : concept.id)}
                        className="text-primary font-bold hover:underline"
                      >
                        {editingId === concept.id ? 'Close' : 'Edit ✏️'}
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {prereqNames.length > 0 ? (
                        prereqNames.map((name, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 bg-surface-container-high text-primary rounded border border-outline-variant/20 font-citation">
                            {name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-outline italic">None (Foundational topic)</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* SELECTED CONCEPT SLIDE-OUT DRAWER (WARM THEME) */}
      {selectedConcept && (
        <div className="absolute right-6 bottom-6 top-24 w-96 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl shadow-2xl p-6 z-40 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/15 pb-3">
              <span className="text-xs font-label-mono uppercase tracking-widest text-primary font-bold">
                Concept Details
              </span>
              <button
                onClick={() => setSelectedConcept(null)}
                className="text-secondary hover:text-primary p-1 rounded-full hover:bg-surface-container text-xs"
              >
                ✕
              </button>
            </div>

            <h3 className="text-xl font-semibold text-primary mb-3 font-heading">{selectedConcept.name}</h3>
            <p className="text-base text-secondary leading-relaxed font-body mb-6">
              {selectedConcept.summary || 'Detailed academic concept breakdowns and evidence-backed citations.'}
            </p>

            <div className="space-y-2">
              <h5 className="text-xs font-label-mono uppercase tracking-wider text-secondary font-bold">
                Suggested Prerequisites:
              </h5>
              <div className="flex flex-wrap gap-2">
                {(selectedConcept.suggested_prerequisites || []).length > 0 ? (
                  (selectedConcept.suggested_prerequisites || []).map((pId) => {
                    const prereq = concepts.find((c) => c.id === pId);
                    return (
                      <span key={pId} className="px-3 py-1 bg-surface-container-high text-primary rounded-lg text-xs border border-outline-variant/20 font-medium">
                        {prereq ? prereq.name : `Concept #${pId}`}
                      </span>
                    );
                  })
                ) : (
                  <span className="text-xs text-outline italic">None (Foundational concept)</span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2.5 mt-4">
            <button
              onClick={() => {
                onStartTutor();
              }}
              className="w-full bg-primary hover:opacity-90 text-surface font-label-mono font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
            >
              <span className="material-symbols-outlined text-sm" data-icon="forum">forum</span>
              <span>Ask Tutor About {selectedConcept.name.split(' ')[0]}</span>
            </button>

            {onStartTeachNovice && (
              <button
                onClick={() => onStartTeachNovice(selectedConcept)}
                className="w-full bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-primary font-label-mono font-bold py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
              >
                <span className="material-symbols-outlined text-sm text-primary" data-icon="school">school</span>
                <span>Teach the Novice (Alex)</span>
              </button>
            )}

            {onStartSpeakModel && (
              <button
                onClick={() => onStartSpeakModel(selectedConcept)}
                className="w-full bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/30 text-primary font-label-mono font-bold py-2.5 rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
              >
                <span className="material-symbols-outlined text-sm text-primary" data-icon="mic">mic</span>
                <span>Speak Your Model (Voice)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ROOT DOCUMENT OVERVIEW DRAWER */}
      {showRootDrawer && !selectedConcept && (
        <div className="absolute right-6 bottom-6 top-24 w-96 bg-surface-container-lowest border border-primary/20 rounded-2xl shadow-2xl p-6 z-40 flex flex-col justify-between animate-in slide-in-from-right duration-200">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-outline-variant/15 pb-3">
              <span className="text-xs font-label-mono uppercase tracking-widest text-primary font-bold">
                Document Mindmap Overview
              </span>
              <button
                onClick={() => setShowRootDrawer(false)}
                className="text-secondary hover:text-primary p-1 rounded-full hover:bg-surface-container text-xs"
              >
                ✕
              </button>
            </div>

            <h3 className="text-xl font-bold text-primary mb-2 font-headline-md">{rootTitle}</h3>
            <p className="text-xs text-secondary font-label-mono mb-4">
              File: {currentDoc.filename} • {concepts.length} Extracted Academic Concepts
            </p>

            <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 mb-6">
              <div className="flex items-center justify-between text-xs">
                <span className="text-secondary font-label-mono">Tree Status:</span>
                <span className="font-bold text-primary font-label-mono uppercase">
                  {isCollapsed ? 'Collapsed' : 'Fully Expanded'}
                </span>
              </div>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="w-full py-2 bg-surface-container-high hover:bg-surface-container-highest text-primary rounded text-xs font-label-mono font-bold transition-all border border-outline-variant/30"
              >
                {isCollapsed ? 'Expand Mindmap Tree' : 'Collapse Mindmap Tree'}
              </button>
            </div>
          </div>

          <button
            onClick={onStartTutor}
            className="w-full mt-4 bg-primary hover:opacity-90 text-surface font-label-mono font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 text-xs"
          >
            <span className="material-symbols-outlined text-sm" data-icon="forum">forum</span>
            <span>Ask Tutor About Full Document</span>
          </button>
        </div>
      )}
    </div>
  );
}
