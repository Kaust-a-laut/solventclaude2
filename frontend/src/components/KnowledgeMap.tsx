import React, { useEffect, useRef, useState } from 'react';
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceX, forceY, SimulationLinkDatum } from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3Zoom } from 'd3-zoom';
import { drag as d3Drag } from 'd3-drag';
import { useAppStore, GraphNode, GraphEdge } from '../store/useAppStore';
import { TIER_CONFIG } from '../lib/performanceTier';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { X, Save } from 'lucide-react';

type SimNode = GraphNode & { x: number; y: number; fx?: number | null; fy?: number | null };

export const KnowledgeMap = () => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { graphNodes, graphEdges, deviceInfo, setGraphData } = useAppStore();
  const activeTier = useAppStore(state => state.activeTier);
  const tierConfig = TIER_CONFIG[activeTier];
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);
  const [edgeData, setEdgeData] = useState("");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Handle Resize for the Knowledge Map container
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || dimensions.width === 0 || dimensions.height === 0) return;

    const { width, height } = dimensions;

    // Tier-aware node cap
    let displayNodes = graphNodes;
    let displayEdges = graphEdges;
    if (displayNodes.length > tierConfig.knowledgeMapMaxNodes) {
      const nodeSet = new Set(displayNodes.slice(0, tierConfig.knowledgeMapMaxNodes).map(n => n.id));
      displayNodes = displayNodes.slice(0, tierConfig.knowledgeMapMaxNodes);
      displayEdges = displayEdges.filter(e => nodeSet.has(e.source as string) && nodeSet.has(e.target as string));
    }

    // Clear previous graph
    select(svgRef.current).selectAll("*").remove();

    const svg = select(svgRef.current)
      .attr("viewBox", [0, 0, width, height])
      .attr("preserveAspectRatio", "xMidYMid meet");

    // Container for zoomable content
    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const nodes = displayNodes.map(n => ({ ...n, x: width / 2, y: height / 2 })) as SimNode[];
    const links = displayEdges as unknown as SimulationLinkDatum<SimNode>[];

    const simulation = forceSimulation<SimNode>(nodes)
      .force("link", forceLink<SimNode, SimulationLinkDatum<SimNode>>(links).id((d) => d.id).distance(100))
      .force("charge", forceManyBody().strength(-400))
      .force("center", forceCenter(width / 2, height / 2))
      .force("x", forceX(width / 2).strength(0.1))
      .force("y", forceY(height / 2).strength(0.1));

    // Faster cooldown for lite tier
    simulation.alphaDecay(activeTier === 'lite' ? 0.05 : 0.0228);

    // --- VISUALIZATION HELPERS ---
    const getNodeColor = (d: SimNode) => {
      // 1. Crystallized Memory Types
      if (d.type === 'permanent_rule') return '#F59E0B'; // Gold (Law)
      if (d.type === 'solution_pattern') return '#06B6D4'; // Cyan (Blueprint)
      if (d.type === 'architectural_decision') return '#9D5BD2'; // Purple (Wisdom)
      if (d.type === 'user_preference') return '#EC4899'; // Pink (User)

      // 2. Standard Types
      if (d.id.startsWith('node_')) return '#3C71F7'; // Standard Blue
      return '#64748B'; // Slate (Unknown)
    };

    // Define holographic gradients and filters
    const defs = svg.append("defs");

    const nodeGradient = defs.append("radialGradient")
      .attr("id", "nodeHologram")
      .attr("cx", "30%")
      .attr("cy", "30%");
    nodeGradient.append("stop").attr("offset", "0%").attr("stop-color", "#ffffff").attr("stop-opacity", 0.8);
    nodeGradient.append("stop").attr("offset", "100%").attr("stop-color", "currentColor").attr("stop-opacity", 0.4);

    defs.selectAll("marker")
      .data(["end"])
      .enter().append("marker")
      .attr("id", String)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "rgba(157, 91, 210, 0.4)");

    const link = g.append("g")
      .selectAll("line")
      .data(displayEdges)
      .join("line")
      .attr("stroke", "rgba(157, 91, 210, 0.15)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4")
      .attr("cursor", "pointer")
      .on("mouseover", function() { select(this).attr("stroke", "#3C71F7").attr("stroke-width", 2).attr("stroke-dasharray", null); })
      .on("mouseout", function() { select(this).attr("stroke", "rgba(157, 91, 210, 0.15)").attr("stroke-width", 1).attr("stroke-dasharray", "4,4"); })
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedEdge(d);
        const resolvedSrc = d.source as unknown as SimNode | string;
        const resolvedTgt = d.target as unknown as SimNode | string;
        setEdgeData(d.data || JSON.stringify({ source: typeof resolvedSrc === 'object' ? resolvedSrc.id : resolvedSrc, target: typeof resolvedTgt === 'object' ? resolvedTgt.id : resolvedTgt, status: "pending" }, null, 2));
      });

    const dragBehavior = d3Drag<SVGGElement, SimNode>()
      .on("start", function(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
        select(event.sourceEvent.currentTarget).attr("cursor", "grabbing");
      })
      .on("drag", function(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      })
      .on("end", function(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
        select(event.sourceEvent.currentTarget).attr("cursor", "grab");
      });

    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "grab")
      // d3 DragBehavior generics don't align with .join() BaseType union; bypass with opaque cast
      .call(dragBehavior as unknown as (sel: unknown) => void)
      .on("mouseover", (event, d: SimNode) => {
         select(event.currentTarget).select("circle.outer-glow").attr("r", 14).attr("opacity", 0.4);
         setHoveredNode(d);
      })
      .on("mouseout", (event, d) => {
         select(event.currentTarget).select("circle.outer-glow").attr("r", 10).attr("opacity", 0.2);
         setHoveredNode(null);
      });

    // Node Outer Glow (Liquid Aura)
    node.append("circle")
      .attr("class", "outer-glow")
      .attr("r", 10)
      .attr("fill", (d: SimNode) => getNodeColor(d))
      .attr("filter", "blur(4px)")
      .attr("opacity", 0.2)
      .style("transition", "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)");

    // Node Core (Holographic Drop)
    node.append("circle")
      .attr("r", 6)
      .attr("fill", "url(#nodeHologram)")
      .style("color", (d: SimNode) => getNodeColor(d))
      .attr("stroke", "rgba(255,255,255,0.2)")
      .attr("stroke-width", 0.5)
      .style("box-shadow", "inset 0 0 10px rgba(255,255,255,0.5)");

    // Labels
    node.append("text")
      .text((d: SimNode) => d.title)
      .attr("x", 10)
      .attr("y", 4)
      .style("font-size", "9px")
      .style("font-weight", "900")
      .style("text-transform", "uppercase")
      .style("letter-spacing", "0.1em")
      .style("fill", "rgba(255, 255, 255, 0.6)")
      .style("pointer-events", "none")
      .style("font-family", "'JetBrains Mono', monospace");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: SimulationLinkDatum<SimNode>) => (d.source as SimNode).x)
        .attr("y1", (d: SimulationLinkDatum<SimNode>) => (d.source as SimNode).y)
        .attr("x2", (d: SimulationLinkDatum<SimNode>) => (d.target as SimNode).x)
        .attr("y2", (d: SimulationLinkDatum<SimNode>) => (d.target as SimNode).y);

      node.attr("transform", (d: SimNode) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [graphNodes, graphEdges, dimensions, activeTier, tierConfig]);

  const handleSaveEdgeData = () => {
    if (!selectedEdge) return;

    // Update the edge data in the store
    const newEdges = graphEdges.map(e => {
        // d3 modifies the source/target objects, so we check IDs
        const sId = (e.source as { id?: string })?.id ?? e.source;
        const tId = (e.target as { id?: string })?.id ?? e.target;
        const selSId = (selectedEdge.source as { id?: string })?.id ?? selectedEdge.source;
        const selTId = (selectedEdge.target as { id?: string })?.id ?? selectedEdge.target;

        if (sId === selSId && tId === selTId) {
            return { ...e, data: edgeData };
        }
        return e;
    });

    setGraphData(graphNodes, newEdges);

    setSelectedEdge(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden pointer-events-auto" onClick={() => setSelectedEdge(null)}>
      <svg 
        ref={svgRef}
        className="w-full h-full cursor-crosshair block touch-none"
        onClick={(e) => e.stopPropagation()}
      />
      
      {/* Empty State */}
      {graphNodes.length === 0 && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center opacity-20">
               <div className="text-[11px] font-black uppercase tracking-[0.5em] text-slate-300">Awaiting Data</div>
            </div>
         </div>
      )}

      {/* Info Card Overlay */}
      <AnimatePresence>
        {hoveredNode && !selectedEdge && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 pointer-events-none will-change-transform",
              deviceInfo.isMobile ? "bottom-4 left-4 right-4 p-4" : "bottom-8 left-8 right-8 p-5"
            )}
          >
             <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">{hoveredNode.title}</h3>
                <span className="text-[11px] font-mono text-slate-300 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{hoveredNode.id}</span>
             </div>
             <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                {hoveredNode.description || "No detailed metrics available for this node."}
             </p>
             <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-jb-accent animate-pulse" />
                <span className="text-[11px] font-black text-jb-accent uppercase tracking-widest">Active Node</span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edge Editor Modal */}
      <AnimatePresence>
        {selectedEdge && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden flex flex-col will-change-transform"
          >
            <div className="h-12 bg-white/5 border-b border-white/5 flex items-center justify-between px-4">
                <div className="flex items-center gap-2 text-slate-300">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Edge Interceptor</span>
                </div>
                <button 
                    onClick={() => setSelectedEdge(null)}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all"
                >
                    <X size={14} />
                </button>
            </div>
            <div className="p-4 flex-1">
                <textarea 
                    value={edgeData}
                    onChange={(e) => setEdgeData(e.target.value)}
                    className="w-full h-40 bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-slate-300 outline-none focus:border-jb-accent resize-none"
                    placeholder="Edge communication data..."
                />
            </div>
            <div className="p-4 pt-0">
                <button 
                    onClick={handleSaveEdgeData}
                    className="w-full py-2 bg-jb-accent hover:bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                    <Save size={12} /> Override & Re-Feed
                </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};