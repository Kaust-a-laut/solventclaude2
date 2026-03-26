import { StateCreator } from 'zustand';
import { AppState } from './types';
import { getSecret } from '../lib/api-client';
import { API_BASE_URL } from '../lib/config';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollaborateMessage {
  id: string;
  agentId: string;
  agentName: string;
  content: string;
  turnNumber: number;
  type: string;
  addressing?: string;
  streamingContent?: string;
  isStreaming: boolean;
}

export interface CollaborateAgent {
  id: string;
  name: string;
  role: string;
}

export interface CollaborateSlice {
  collaborate: {
    sessionId: string | null;
    goal: string;
    missionType: string;
    status: 'idle' | 'active' | 'converging' | 'synthesizing' | 'complete' | 'failed';
    agents: CollaborateAgent[];
    messages: CollaborateMessage[];
    synthesis: string | null;
    currentRound: number;
    consensusScore: number;
    activeAgentId: string | null;
    error: string | null;
  };
  collaborateAbortController: AbortController | null;
  startConversation: (goal: string, missionType: string) => Promise<void>;
  injectUserMessage: (message: string) => Promise<void>;
  triggerSynthesizeNow: () => Promise<void>;
  cancelConversation: () => void;
  resetConversation: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialCollaborateState: CollaborateSlice['collaborate'] = {
  sessionId: null,
  goal: '',
  missionType: 'consultation',
  status: 'idle',
  agents: [],
  messages: [],
  synthesis: null,
  currentRound: 0,
  consensusScore: 0,
  activeAgentId: null,
  error: null,
};

// ─── Slice creator ────────────────────────────────────────────────────────────

export const createCollaborateSlice: StateCreator<AppState, [], [], CollaborateSlice> = (set, get) => ({
  collaborate: { ...initialCollaborateState },
  collaborateAbortController: null,

  startConversation: async (goal: string, missionType: string) => {
    const { collaborateAbortController } = get();
    if (collaborateAbortController) collaborateAbortController.abort();

    const controller = new AbortController();

    set({
      collaborateAbortController: controller,
      collaborate: {
        ...initialCollaborateState,
        goal,
        missionType,
        status: 'active',
      },
    });

    try {
      const secret = await getSecret();
      const response = await fetch(`${API_BASE_URL}/collaborate/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Solvent-Secret': secret,
        },
        body: JSON.stringify({ goal, missionType }),
        signal: controller.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      const processSSELine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        try {
          const payload = JSON.parse(line.slice(6));
          const { event, data } = payload;

          set((state) => {
            const collab = { ...state.collaborate };

            switch (event) {
              case 'session_start':
                collab.sessionId = data.sessionId as string;
                collab.agents = data.agents as CollaborateAgent[];
                break;

              case 'agent_thinking':
                collab.activeAgentId = data.agentId as string;
                break;

              case 'agent_token': {
                // Update streaming content for the active agent
                const agentId = data.agentId as string;
                const existingIdx = collab.messages.findIndex(
                  m => m.agentId === agentId && m.isStreaming
                );
                if (existingIdx >= 0) {
                  const msgs = [...collab.messages];
                  msgs[existingIdx] = {
                    ...msgs[existingIdx],
                    streamingContent: (msgs[existingIdx].streamingContent || '') + (data.token as string),
                  };
                  collab.messages = msgs;
                } else {
                  collab.messages = [
                    ...collab.messages,
                    {
                      id: `streaming-${agentId}-${Date.now()}`,
                      agentId,
                      agentName: collab.agents.find(a => a.id === agentId)?.name || agentId,
                      content: '',
                      turnNumber: 0,
                      type: 'contribution',
                      isStreaming: true,
                      streamingContent: data.token as string,
                    },
                  ];
                }
                break;
              }

              case 'agent_done': {
                const agentId = data.agentId as string;
                // Replace streaming message with final
                const msgs = collab.messages.filter(
                  m => !(m.agentId === agentId && m.isStreaming)
                );
                msgs.push({
                  id: `msg-${agentId}-${data.turnNumber}`,
                  agentId,
                  agentName: data.agentName as string,
                  content: data.content as string,
                  turnNumber: data.turnNumber as number,
                  type: data.type as string,
                  addressing: data.addressing as string | undefined,
                  isStreaming: false,
                });
                collab.messages = msgs;
                collab.activeAgentId = null;
                break;
              }

              case 'round_complete':
                collab.currentRound = data.round as number;
                collab.consensusScore = data.consensusScore as number;
                break;

              case 'synthesizing':
                collab.status = 'synthesizing';
                collab.activeAgentId = null;
                break;

              case 'synthesis_token':
                // Accumulate synthesis content
                collab.synthesis = (collab.synthesis || '') + (data.token as string);
                break;

              case 'synthesis_done':
                collab.synthesis = data.synthesis as string;
                break;

              case 'session_complete':
                collab.status = 'complete';
                collab.activeAgentId = null;
                break;

              case 'error':
                collab.status = 'failed';
                collab.error = data.message as string;
                collab.activeAgentId = null;
                break;
            }

            return { collaborate: collab };
          });
        } catch (e) {
          console.warn('[Collaborate] Failed to process SSE line:', e);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          processSSELine(line);
        }
      }

      if (sseBuffer.trim()) {
        processSSELine(sseBuffer.trim());
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[Collaborate] Request cancelled');
      } else {
        set((state) => ({
          collaborate: {
            ...state.collaborate,
            status: 'failed',
            error: error.message,
            activeAgentId: null,
          },
        }));
      }
    } finally {
      set({ collaborateAbortController: null });
    }
  },

  injectUserMessage: async (message: string) => {
    const { collaborate } = get();
    if (!collaborate.sessionId) return;

    try {
      const secret = await getSecret();
      await fetch(`${API_BASE_URL}/collaborate/inject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Solvent-Secret': secret,
        },
        body: JSON.stringify({
          sessionId: collaborate.sessionId,
          message,
        }),
      });
    } catch (e) {
      console.warn('[Collaborate] Failed to inject message:', e);
    }
  },

  triggerSynthesizeNow: async () => {
    const { collaborate } = get();
    if (!collaborate.sessionId) return;

    try {
      const secret = await getSecret();
      await fetch(`${API_BASE_URL}/collaborate/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Solvent-Secret': secret,
        },
        body: JSON.stringify({ sessionId: collaborate.sessionId }),
      });
    } catch (e) {
      console.warn('[Collaborate] Failed to trigger synthesis:', e);
    }
  },

  cancelConversation: () => {
    const { collaborateAbortController } = get();
    if (collaborateAbortController) {
      collaborateAbortController.abort();
      set((state) => ({
        collaborateAbortController: null,
        collaborate: {
          ...state.collaborate,
          status: 'failed',
          error: 'Cancelled by user',
          activeAgentId: null,
        },
      }));
    }
  },

  resetConversation: () => {
    const { collaborateAbortController } = get();
    if (collaborateAbortController) collaborateAbortController.abort();

    set({
      collaborateAbortController: null,
      collaborate: { ...initialCollaborateState },
    });
  },
});
