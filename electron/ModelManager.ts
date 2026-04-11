import Store from 'electron-store';
import { net, BrowserWindow } from 'electron';

const store = new Store();

// Helper to calculate cost (rough estimation)
const calculateCost = (model: string, tokens: number) => {
  // Mock pricing logic
  if (model.includes('free') || model.includes('ollama')) return 0;
  if (model.includes('gpt-4') || model.includes('opus')) return (tokens / 1000) * 0.03;
  return (tokens / 1000) * 0.001; // Default cheap
};

const API = {
  call: async (modelStr: string, messages: any[]) => {
    // Parse provider/model from string "provider/model"
    let provider = 'gemini';
    let modelName = modelStr;

    if (modelStr.includes('/')) {
      [provider, modelName] = modelStr.split('/');
    } else if (modelStr.startsWith('gpt') || modelStr.startsWith('o1')) {
        provider = 'openrouter'; // Assume openrouter for openai models if not specified
    }

    // Adjust provider for backend compatibility
    if (provider === 'local') provider = 'ollama';

    const payload = {
      provider,
      model: modelName,
      messages,
      smartRouter: false // We are doing the routing here
    };

    // Use built-in fetch (Node 18+)
    const response = await fetch('http://localhost:3001/api/v1/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-solvent-secret': 'solvent_internal_dev_secret' 
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error: any = new Error(`API Error: ${response.statusText}`);
        error.status = response.status;
        // Try to parse body for more info
        try {
            const errBody = await response.json();
            if (errBody.error) error.message = errBody.error;
        } catch (e) {
            // Body not parseable — continue with default error message
        }
        throw error;
    }

    const data = await response.json();
    
    // Track usage (Mocking token count if not provided)
    const usage = (data.usage?.totalTokens || 100);
    ModelManager.trackUsage(modelStr, usage);

    return data;
  }
};

export const ModelManager = {
  // 1. Persistent Storage for Preferences
  getPreference: (tier: 'planner' | 'executor') => {
    return store.get(`model_prefs.${tier}`, {
      primary: tier === 'planner' ? 'openrouter/anthropic/claude-3-opus' : 'openrouter/google/gemini-2.0-flash-exp:free',
      fallback: 'ollama/llama3',
      autoShift: true
    }) as any;
  },

  setPreference: (tier: 'planner' | 'executor', prefs: any) => {
    store.set(`model_prefs.${tier}`, prefs);
  },

  // 2. The Execution Engine with Built-in Fallback
  execute: async (tier: 'planner' | 'executor', messages: any[]) => {
    const pref = ModelManager.getPreference(tier);
    
    try {
      // Primary Attempt
      console.log(`[ModelManager] Executing ${tier} with primary: ${pref.primary}`);
      const result = await API.call(pref.primary, messages);
      // Broadcast success (primary)
      BrowserWindow.getAllWindows().forEach(w => w.webContents.send('model-status', { status: 'primary', model: pref.primary }));
      return result;
    } catch (err: any) {
      if (pref.autoShift && ModelManager.isRecoverable(err)) {
        console.warn(`[ModelManager] Primary ${pref.primary} failed. Shifting to ${pref.fallback}`);
        // Broadcast failover
        BrowserWindow.getAllWindows().forEach(w => w.webContents.send('model-status', { status: 'fallback', model: pref.fallback }));
        return await API.call(pref.fallback, messages);
      }
      throw err;
    }
  },

  isRecoverable: (err: any) => {
    // 429 = Rate Limit, 503 = Service Down
    return [429, 503, 504].includes(err.status) || err.code === 'ECONNREFUSED';
  },

  // 3. Usage Tracking
  trackUsage: (model: string, tokens: number) => {
      const current = store.get('usage', { tokens: 0, cost: 0, requests: 0 }) as any;
      const cost = calculateCost(model, tokens);
      
      store.set('usage', {
          tokens: current.tokens + tokens,
          cost: current.cost + cost,
          requests: current.requests + 1
      });
  },

  getUsage: () => {
      return store.get('usage', { tokens: 0, cost: 0, requests: 0 });
  },
  
  // Reset usage (e.g. for "Top Up" simulation or daily reset)
  resetUsage: () => {
      store.set('usage', { tokens: 0, cost: 0, requests: 0 });
  }
};
