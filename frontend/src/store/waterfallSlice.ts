import { StateCreator } from 'zustand';
import { AppState } from './types';
import { fetchWithRetry, getSecret } from '../lib/api-client';
import { API_BASE_URL } from '../lib/config';
import { waterfallStateMachine } from '../lib/waterfallStateMachine';
import { WATERFALL_PRESETS_BY_KEY } from '../lib/waterfallPresets';

export type WaterfallModelChoice = 'A' | 'B' | { model: string; provider: string };
export interface WaterfallModelSelection {
  architect: WaterfallModelChoice;
  reasoner: WaterfallModelChoice;
  executor: WaterfallModelChoice;
  reviewer: WaterfallModelChoice;
}

// Default to groq-speed — fastest honest pipeline
export const DEFAULT_MODEL_SELECTION: WaterfallModelSelection =
  WATERFALL_PRESETS_BY_KEY['groq-speed']!.selection as WaterfallModelSelection;

interface WaterfallStepBase { message?: string; score?: number; issues?: { severity: string; message: string }[]; estimate?: string; [key: string]: unknown }
interface ArchitectData extends WaterfallStepBase { plan: string }
interface ReasonerData extends WaterfallStepBase { reasoning: string }
interface ExecutorData extends WaterfallStepBase { code: string }
interface ReviewerData extends WaterfallStepBase { review: string }
type WaterfallStepPayload = ArchitectData | ReasonerData | ExecutorData | ReviewerData | WaterfallStepBase;

export interface WaterfallStepData {
  status: 'idle' | 'processing' | 'completed' | 'error' | 'paused';
  data: WaterfallStepPayload | null;
  error: string | null;
}

export interface WaterfallSlice {
  waterfall: {
    prompt: string;
    currentStep: 'architect' | 'reasoner' | 'executor' | 'reviewer' | null;
    steps: {
      architect: WaterfallStepData;
      reasoner: WaterfallStepData;
      executor: WaterfallStepData;
      reviewer: WaterfallStepData;
    };
  };
  waterfallAbortController: AbortController | null;
  waterfallModelSelection: WaterfallModelSelection;
  waterfallPresetKey: string;

  setWaterfallPrompt: (prompt: string) => void;
  setWaterfallModelChoice: (stage: keyof WaterfallModelSelection, choice: WaterfallModelChoice) => void;
  setWaterfallPreset: (presetKey: string) => void;
  setWaterfallCustomStage: (stage: keyof WaterfallModelSelection, override: { model: string; provider: string }) => void;
  runFullWaterfall: (prompt: string, forceProceed?: boolean) => Promise<void>;
  proceedWithWaterfall: () => void;
  runWaterfallStep: (step: 'architect' | 'reasoner' | 'executor' | 'reviewer', input: any) => Promise<void>;
  cancelWaterfall: () => void;
  resetWaterfall: () => void;
  editPlanDraft: string | null;
  setEditPlanDraft: (draft: string | null) => void;
  applyEditedPlan: () => void;
  retryCount: number;
}

const initialStepState: WaterfallStepData = { status: 'idle', data: null, error: null };

export const createWaterfallSlice: StateCreator<AppState, [], [], WaterfallSlice> = (set, get) => ({
  waterfall: {
    prompt: '',
    currentStep: null,
    steps: {
      architect: { ...initialStepState },
      reasoner: { ...initialStepState },
      executor: { ...initialStepState },
      reviewer: { ...initialStepState }
    }
  },
  waterfallAbortController: null,
  waterfallModelSelection: { ...DEFAULT_MODEL_SELECTION },
  waterfallPresetKey: 'groq-speed',
  editPlanDraft: null,
  retryCount: 0,

  setWaterfallPrompt: (prompt) => set((state) => ({
    waterfall: { ...state.waterfall, prompt }
  })),

  setWaterfallModelChoice: (stage, choice) => set((state) => ({
    waterfallModelSelection: { ...state.waterfallModelSelection, [stage]: choice }
  })),

  setWaterfallPreset: (presetKey) => {
    const preset = WATERFALL_PRESETS_BY_KEY[presetKey];
    if (!preset) return;
    set({ waterfallPresetKey: presetKey, waterfallModelSelection: { ...preset.selection } as WaterfallModelSelection });
  },

  setWaterfallCustomStage: (stage, override) => set((state) => ({
    waterfallPresetKey: 'custom',
    waterfallModelSelection: { ...state.waterfallModelSelection, [stage]: override },
  })),

  resetWaterfall: () => {
    const { waterfallAbortController } = get();
    if (waterfallAbortController) waterfallAbortController.abort();
    
    set({
      waterfall: {
        prompt: '',
        currentStep: null,
        steps: {
          architect: { ...initialStepState },
          reasoner: { ...initialStepState },
          executor: { ...initialStepState },
          reviewer: { ...initialStepState }
        }
      },
      waterfallAbortController: null,
      waterfallPresetKey: 'groq-speed',
      editPlanDraft: null,
      retryCount: 0,
    });
  },

  cancelWaterfall: () => {
    const { waterfallAbortController } = get();
    if (waterfallAbortController) {
      waterfallAbortController.abort();
      set((state) => ({
        waterfallAbortController: null,
        waterfall: {
          ...state.waterfall,
          steps: {
            ...state.waterfall.steps,
            [state.waterfall.currentStep || 'architect']: { 
              status: 'error', 
              data: null, 
              error: 'Cancelled by user.' 
            }
          }
        }
      }));
    }
  },

  proceedWithWaterfall: () => {
    const { waterfall } = get();
    get().runFullWaterfall(waterfall.prompt, true);
  },

  setEditPlanDraft: (draft) => set({ editPlanDraft: draft }),

  applyEditedPlan: () => {
    const { editPlanDraft } = get();
    if (!editPlanDraft) return;
    try {
      const parsed = JSON.parse(editPlanDraft);
      set((state) => ({
        editPlanDraft: null,
        waterfall: {
          ...state.waterfall,
          steps: {
            ...state.waterfall.steps,
            architect: {
              ...state.waterfall.steps.architect,
              data: { ...state.waterfall.steps.architect.data, ...parsed }
            }
          }
        }
      }));
    } catch {
      // Invalid JSON — silently ignore, keep draft open
    }
  },

  runFullWaterfall: async (prompt: string, forceProceed: boolean = false) => {
    const { globalProvider, notepadContent, openFiles, waterfallAbortController, waterfallModelSelection } = get();
    
    if (waterfallAbortController) waterfallAbortController.abort();

    const controller = new AbortController();
    
    // Push pipeline start to activity feed
    get().addActivity({
      id: `wf_${Date.now()}`,
      timestamp: Date.now(),
      type: 'waterfall',
      content: forceProceed ? 'Pipeline resumed (gate approved)' : `Pipeline started: "${prompt.slice(0, 80)}${prompt.length > 80 ? '…' : ''}"`,
    });

    // Only reset state if starting fresh (not proceeding from pause)
    if (!forceProceed) {
      set((state) => ({
        waterfallAbortController: controller,
        waterfall: {
          ...state.waterfall,
          prompt,
          currentStep: 'architect',
          steps: {
            ...initialStepState,
            architect: { status: 'processing', data: { message: 'Analyzing requirements...' }, error: null },
            reasoner: { ...initialStepState },
            executor: { ...initialStepState },
            reviewer: { ...initialStepState }
          }
        }
      }));
    } else {
      // If proceeding, we just update the controller and keep state
      set({ waterfallAbortController: controller });
    }

    try {
      const secret = await getSecret();
      const response = await fetch(`${API_BASE_URL}/waterfall`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Solvent-Secret': secret
        },
        body: JSON.stringify({ prompt, globalProvider, notepadContent, openFiles, forceProceed, modelSelection: waterfallModelSelection }),
        signal: controller.signal
      });

      if (!response.body) throw new Error('No response body');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      const processSSELine = (line: string) => {
        if (!line.startsWith('data: ')) return;
        try {
          const payload = JSON.parse(line.slice(6));
          const { phase, message, estimate } = payload;

          if (phase === 'retrying') {
            set((state) => ({ retryCount: state.retryCount + 1 }));
          }

          // Push stage-transition activity events
          const stageNames: Record<string, string> = {
            architecting: 'Architect', reasoning: 'Reasoner', executing: 'Executor', reviewing: 'Reviewer',
          };
          if (stageNames[phase]) {
            get().addActivity({
              id: `wf_${phase}_${Date.now()}`,
              timestamp: Date.now(),
              type: 'waterfall',
              content: `${stageNames[phase]} stage started`,
            });
          }

          if (phase === 'final' && payload.status !== 'paused') {
            const score = payload.reviewer?.score;
            get().addActivity({
              id: `wf_done_${Date.now()}`,
              timestamp: Date.now(),
              type: 'waterfall',
              content: `Pipeline complete${score != null ? ` — Score: ${score}/100` : ''}`,
            });
          }

          set((state) => {
            // HANDLE GATING
            if (phase === 'gated') {
               return {
                 waterfall: {
                   ...state.waterfall,
                   currentStep: 'architect',
                   steps: {
                     ...state.waterfall.steps,
                     architect: {
                       status: 'paused',
                       data: { ...state.waterfall.steps.architect.data, estimate },
                       error: message
                     }
                   }
                 }
               };
            }

            if (phase === 'final') {
               // Gate early-return: backend returned { status: 'paused', architect } — don't overwrite stages
               if (payload.status === 'paused') {
                 return {
                   waterfall: {
                     ...state.waterfall,
                     currentStep: 'architect',
                     steps: {
                       ...state.waterfall.steps,
                       architect: {
                         status: 'paused',
                         data: payload.architect,
                         error: payload.estimate ? 'Resource gate: awaiting approval' : null
                       }
                     }
                   }
                 };
               }
               // Real completion: all 4 stages have data
               return {
                 waterfall: {
                   ...state.waterfall,
                   currentStep: 'reviewer',
                   steps: {
                     architect: { status: 'completed', data: payload.architect, error: null },
                     reasoner: { status: 'completed', data: payload.reasoner, error: null },
                     executor: { status: 'completed', data: payload.executor, error: null },
                     reviewer: { status: 'completed', data: payload.reviewer, error: null }
                   }
                 }
               };
            } else if (phase === 'error') {
               // Don't throw inside set() — write error state directly
               const errorStep = state.waterfall.currentStep || 'architect';
               return {
                 waterfall: {
                   ...state.waterfall,
                   steps: {
                     ...state.waterfall.steps,
                     [errorStep]: {
                       status: 'error' as const,
                       data: null,
                       error: message || 'Unknown waterfall error'
                     }
                   }
                 }
               };
            }

            const newWaterfall = waterfallStateMachine.transition(state.waterfall, phase, payload);
            return { waterfall: newWaterfall };
          });
        } catch (e: unknown) {
          if (import.meta.env.DEV) console.warn('[Waterfall] Failed to process SSE line:', e);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Accumulate chunks — SSE events can span multiple TCP frames
        sseBuffer += decoder.decode(value, { stream: true });

        // Split by newlines, keep last (possibly incomplete) line in buffer
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        for (const line of lines) {
          processSSELine(line);
        }
      }

      // Process any remaining buffered data after stream ends
      if (sseBuffer.trim()) {
        processSSELine(sseBuffer.trim());
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
      } else {
        set((state) => ({
          waterfall: {
            ...state.waterfall,
            steps: {
              ...state.waterfall.steps,
              [state.waterfall.currentStep || 'architect']: { 
                status: 'error', 
                data: null, 
                error: error.message 
              }
            }
          }
        }));
      }
    } finally {
      set({ waterfallAbortController: null });
    }
  },

  runWaterfallStep: async (step, input) => {
    // ... (same as before)
    const currentState = get().waterfall;
    if (!waterfallStateMachine.canTransition(currentState.currentStep, step)) {
       if (import.meta.env.DEV) console.warn(`[Waterfall] Manual step blocked: ${currentState.currentStep} -> ${step}`);
    }

    set((state) => ({
      waterfall: {
        ...state.waterfall,
        currentStep: step,
        steps: {
          ...state.waterfall.steps,
          [step]: { ...state.waterfall.steps[step], status: 'processing', error: null }
        }
      }
    }));

    try {
      const { globalProvider } = get();
      const context = step === 'reviewer' ? { plan: get().waterfall.steps.reasoner.data } : undefined;

      const data = await fetchWithRetry(`${API_BASE_URL}/waterfall/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          input,
          context,
          globalProvider
        })
      });

      set((state) => ({
        waterfall: {
          ...state.waterfall,
          steps: {
            ...state.waterfall.steps,
            [step]: { status: 'completed', data, error: null }
          }
        }
      }));
    } catch (error: any) {
      set((state) => ({
        waterfall: {
          ...state.waterfall,
          steps: {
            ...state.waterfall.steps,
            [step]: { ...state.waterfall.steps[step], status: 'error', error: error.message }
          }
        }
      }));
    }
  }
});