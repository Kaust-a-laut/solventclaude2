// Local types for PiP window (separate Electron context = separate store)
export interface LocalOverseerDecision {
  id: string;
  decision: string;
  intervention?: { needed: boolean; type: 'warning' | 'suggestion' | 'action'; message: string } | null;
  timestamp: number;
  trigger?: string;
}

export interface LocalActiveMission {
  jobId: string;
  goal: string;
  missionType: string;
  status: 'queued' | 'active' | 'complete' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
}

export const MISSION_TEMPLATES = [
  {
    id: 'consultation', label: 'Consultation', desc: 'PM + Engineer + Security',
    cardCls:   'bg-jb-purple/5 border-jb-purple/15',
    activeCls: 'bg-jb-purple/20 border-jb-purple/40 text-jb-purple',
    headerCls: 'text-jb-purple',
    iconCls:   'text-jb-purple',
  },
  {
    id: 'refinement', label: 'Refinement', desc: 'Adversarial critic + optimizer',
    cardCls:   'bg-jb-accent/5 border-jb-accent/15',
    activeCls: 'bg-jb-accent/20 border-jb-accent/40 text-jb-accent',
    headerCls: 'text-jb-accent',
    iconCls:   'text-jb-accent',
  },
];

export const interventionColor: Record<string, string> = {
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  suggestion: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  action: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
};

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function phaseLabel(progress: number, status: string): string {
  if (status === 'queued') return 'Queued...';
  if (status === 'complete') return 'Complete';
  if (status === 'failed') return 'Failed';
  if (progress < 75) return 'Agents analyzing...';
  if (progress < 90) return 'Synthesizing...';
  return 'Saving to memory...';
}
