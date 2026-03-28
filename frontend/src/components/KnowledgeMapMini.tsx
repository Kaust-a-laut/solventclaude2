import React from 'react';
import { useAppStore } from '../store/useAppStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, Expand, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export const KnowledgeMapMini = () => {
  const { graphNodes, graphEdges, showKnowledgeMap, setShowKnowledgeMap } = useAppStore();

  // Don't show if knowledge map is already open
  if (showKnowledgeMap) return null;

  // Don't show if no data
  if (graphNodes.length === 0) return null;

  // Get node type colors for visualization
  const getNodeColor = (node: any) => {
    if (node.type === 'permanent_rule') return '#F59E0B';
    if (node.type === 'solution_pattern') return '#06B6D4';
    if (node.type === 'architectural_decision') return '#9D5BD2';
    if (node.type === 'user_preference') return '#EC4899';
    return '#3C71F7';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      className="fixed bottom-6 right-6 z-40"
    >
      <button
        onClick={() => setShowKnowledgeMap(true)}
        className="group relative"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-jb-purple/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Main container */}
        <div className={cn(
          "relative w-20 h-20 rounded-2xl bg-black/90 border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl",
          "hover:border-jb-purple/40 hover:scale-105 transition-all duration-300",
          "group-hover:shadow-[0_0_30px_-5px_rgba(157,91,210,0.4)]"
        )}>
          {/* Mini force-directed visualization */}
          <svg className="w-full h-full p-2" viewBox="0 0 64 64">
            {/* Draw edges first */}
            {graphEdges.slice(0, 15).map((edge: any, i: number) => {
              const sourceNode = graphNodes.find((n: any) => n.id === (edge.source?.id || edge.source));
              const targetNode = graphNodes.find((n: any) => n.id === (edge.target?.id || edge.target));
              if (!sourceNode || !targetNode) return null;

              const sourceIndex = graphNodes.indexOf(sourceNode);
              const targetIndex = graphNodes.indexOf(targetNode);

              const sx = 8 + (sourceIndex % 5) * 11;
              const sy = 8 + Math.floor(sourceIndex / 5) * 11;
              const tx = 8 + (targetIndex % 5) * 11;
              const ty = 8 + Math.floor(targetIndex / 5) * 11;

              return (
                <line
                  key={`edge-${i}`}
                  x1={sx}
                  y1={sy}
                  x2={tx}
                  y2={ty}
                  stroke="rgba(157, 91, 210, 0.2)"
                  strokeWidth="0.5"
                />
              );
            })}

            {/* Draw nodes */}
            {graphNodes.slice(0, 20).map((node: any, i: number) => {
              const x = 8 + (i % 5) * 11;
              const y = 8 + Math.floor(i / 5) * 11;
              return (
                <g key={node.id}>
                  {/* Glow */}
                  <circle
                    cx={x}
                    cy={y}
                    r={4}
                    fill={getNodeColor(node)}
                    opacity={0.2}
                    filter="blur(2px)"
                  />
                  {/* Node */}
                  <circle
                    cx={x}
                    cy={y}
                    r={2.5}
                    fill={getNodeColor(node)}
                    className={i < 3 ? "animate-pulse" : ""}
                  />
                </g>
              );
            })}
          </svg>

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-2">
            <div className="flex items-center gap-1.5">
              <Expand size={10} className="text-white" />
              <span className="text-[11px] font-black text-white uppercase tracking-wider">
                Expand
              </span>
            </div>
          </div>
        </div>

        {/* Node count badge */}
        <div className="absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 bg-jb-purple rounded-full shadow-lg">
          <Network size={10} className="text-white" />
          <span className="text-[11px] font-black text-white">
            {graphNodes.length}
          </span>
        </div>

        {/* New nodes indicator */}
        <AnimatePresence>
          {graphNodes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute -top-8 right-0 flex items-center gap-1 px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full"
            >
              <Sparkles size={10} className="text-emerald-400" />
              <span className="text-[11px] font-bold text-emerald-400">Live</span>
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        <p className="text-[11px] font-bold text-white">Knowledge Map</p>
        <p className="text-[11px] text-slate-500">
          {graphNodes.length} nodes • {graphEdges.length} connections
        </p>
      </div>
    </motion.div>
  );
};
