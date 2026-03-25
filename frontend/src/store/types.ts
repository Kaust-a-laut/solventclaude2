import { ChatSlice } from './chatSlice';
import { SettingsSlice } from './settingsSlice';
import { GraphSlice } from './graphSlice';
import { ActionSlice } from './actionSlice';
import { WaterfallSlice } from './waterfallSlice';
import { CodingSlice } from './codingSlice';
import { CollaborateSlice } from './collaborateSlice';
import { PerformanceSlice } from './performanceSlice';

export interface ProvenanceItem {
  id: string;
  text: string;
  type: string;
  source?: string;
  score: number;
  status: 'active' | 'suppressed';
  reason?: string;
}

export interface ContextProvenance {
  workspaceFiles: string[];
  active: ProvenanceItem[];
  suppressed: ProvenanceItem[];
  counts: {
    workspace: number;
    local: number;
    global: number;
    rules: number;
  };
}

export interface Message {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  model?: string;
  image?: string | null;
  thinking?: string;
  isGeneratedImage?: boolean;
  imageUrl?: string;
  provenance?: ContextProvenance; // Tracking where the AI drew its context from
}

export interface OverseerDecision {
  id: string;
  decision: string;
  intervention?: {
    needed: boolean;
    type: 'warning' | 'suggestion' | 'action';
    message: string;
    toolToExecute?: { name: string; args: Record<string, unknown> } | null;
  };
  crystallize?: { content: string; type: string } | null;
  mentalMapUpdate?: string;
  timestamp: number;
  trigger?: string; // the activity that fired this
}

export interface ActiveMission {
  jobId: string;
  goal: string;
  missionType: string;
  status: 'queued' | 'active' | 'complete' | 'failed';
  progress: number;
  result?: unknown;
  error?: string;
  startedAt: number;
}

export interface GraphNode {
  id: string;
  title: string;
  description?: string;
  mode?: string;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  data?: string;
}

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  windowSize: {
    width: number;
    height: number;
  };
}

export interface PageContent {
  title: string;
  content: string;
  excerpt?: string;
  siteName?: string;
  author?: string;
  publishedDate?: string;
  url: string;
}

export interface SearchResultSet {
  results: any[];
  answerBox?: any;
  relatedSearches?: { query: string }[];
  error?: string;
}

export interface ActivityEvent {
  id: string;
  type: string;
  message?: string;
  content?: string;
  timestamp: string | number;
  source?: string;
  [key: string]: unknown;
}

export interface BrowserTab {
  id: string;
  label: string;
  url: string;
  type: 'search' | 'reader' | 'idle';
  searchResults?: SearchResultSet | null;
  pageContent?: PageContent | null;
  searchPage?: number;
  isLoading?: boolean;
}

export type AppState = ChatSlice & SettingsSlice & GraphSlice & ActionSlice & WaterfallSlice & CodingSlice & CollaborateSlice & PerformanceSlice;
