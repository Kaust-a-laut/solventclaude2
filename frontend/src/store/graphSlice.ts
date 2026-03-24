import { StateCreator } from 'zustand';
import { AppState, GraphNode, GraphEdge, OverseerDecision, ActiveMission, ActivityEvent } from './types';

export interface GraphSlice {
  graphNodes: GraphNode[];
  graphEdges: GraphEdge[];
  showKnowledgeMap: boolean;
  supervisorInsight: string | null;
  activities: ActivityEvent[];
  overseerDecisions: OverseerDecision[];
  activeMissions: ActiveMission[];

  addGraphNode: (node: GraphNode) => void;
  addGraphEdge: (edge: GraphEdge) => void;
  removeGraphNode: (id: string) => void;
  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setShowKnowledgeMap: (show: boolean) => void;
  setSupervisorInsight: (insight: string | null) => void;
  addActivity: (activity: ActivityEvent) => void;
  addOverseerDecision: (decision: Omit<OverseerDecision, 'id' | 'timestamp'> & { trigger?: string }) => void;
  clearOverseerDecisions: () => void;
  upsertMission: (mission: Partial<ActiveMission> & { jobId: string }) => void;
}

export const createGraphSlice: StateCreator<AppState, [], [], GraphSlice> = (set) => ({
  graphNodes: [],
  graphEdges: [],
  showKnowledgeMap: false,
  supervisorInsight: null,
  activities: [],
  overseerDecisions: [],
  activeMissions: [],

  addGraphNode: (node) => set((state) => ({
    graphNodes: [...state.graphNodes.filter(n => n.id !== node.id), node]
  })),
  addGraphEdge: (edge) => set((state) => ({
    graphEdges: [...state.graphEdges, edge]
  })),
  removeGraphNode: (id) => set((state) => ({
    graphNodes: state.graphNodes.filter(n => n.id !== id),
    graphEdges: state.graphEdges.filter(e => e.source !== id && e.target !== id)
  })),
  setGraphData: (nodes, edges) => set({ graphNodes: nodes, graphEdges: edges }),
  setShowKnowledgeMap: (show) => set({ showKnowledgeMap: show }),
  setSupervisorInsight: (insight) => set({ supervisorInsight: insight }),
  addActivity: (activity) => set((state) => ({
    activities: [activity, ...state.activities].slice(0, 100)
  })),
  addOverseerDecision: (decision) => set((state) => ({
    overseerDecisions: [
      { ...decision, id: `od_${Date.now()}`, timestamp: Date.now() },
      ...state.overseerDecisions
    ].slice(0, 20) // Keep last 20 decisions
  })),
  clearOverseerDecisions: () => set({ overseerDecisions: [] }),
  upsertMission: (update) => set((state) => {
    const existing = state.activeMissions.find(m => m.jobId === update.jobId);
    if (existing) {
      return {
        activeMissions: state.activeMissions.map(m =>
          m.jobId === update.jobId ? { ...m, ...update } : m
        )
      };
    }
    // New mission — create with defaults
    const newMission: ActiveMission = {
      goal: '',
      missionType: 'consultation',
      status: 'queued',
      progress: 0,
      startedAt: Date.now(),
      ...update
    };
    return { activeMissions: [newMission, ...state.activeMissions].slice(0, 10) };
  }),
});
