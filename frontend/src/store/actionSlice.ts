import { StateCreator } from 'zustand';
import { AppState, Message } from './types';
import { ChatService } from '../services/ChatService';
import { fetchWithRetry } from '../lib/api-client';
import { API_BASE_URL } from '../lib/config';

export interface ActionSlice {
  sendMessage: (content: string, image?: string | null) => Promise<void>;
  generateImageAction: (prompt: string) => Promise<void>;
}

export const createActionSlice: StateCreator<AppState, [], [], ActionSlice> = (set, get) => ({
  sendMessage: async (content: string, image: string | null = null) => {
    const state = get();
    if (state.isProcessing) return;

    // Detect image generation intent via the backend's single authoritative implementation.
    // This replaces the duplicated regex that previously lived here in the frontend.
    let isImageRequest = false;
    let imagePrompt = content;
    try {
      const intentResult = await fetchWithRetry(`${API_BASE_URL}/detect-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, mode: state.currentMode }),
        retries: 1
      }) as { isImageRequest: boolean; imagePrompt: string };
      isImageRequest = intentResult.isImageRequest;
      imagePrompt = intentResult.imagePrompt || content;
    } catch {
      // Intent detection is non-critical; fall through to normal chat on failure
    }

    if (isImageRequest) {
      return state.generateImageAction(imagePrompt);
    }

    // Prepend browser injected context if present
    let finalContent = content;
    if (state.browserInjectedContext) {
      finalContent = `[Browser Context]\n${state.browserInjectedContext}\n\n${content}`;
      state.setBrowserInjectedContext(null);
    }

    const userMessage: Message = { role: 'user', content: finalContent, image };
    state.addMessage(userMessage, state.currentMode);
    state.setIsProcessing(true);

    if (window.electron?.logAction) {
      window.electron.logAction({ type: 'user_message', content, mode: state.currentMode });
    }

    try {
      const result = await ChatService.sendMessage({
        messages: state.messages,
        codingHistory: state.sessions['coding'] ?? [],
        currentMode: state.currentMode,
        modeConfigs: state.modeConfigs,
        selectedCloudModel: state.selectedCloudModel,
        selectedLocalModel: state.selectedLocalModel,
        selectedCloudProvider: state.selectedCloudProvider,
        globalProvider: state.globalProvider,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        deviceInfo: state.deviceInfo,
        notepadContent: state.notepadContent,
        openFiles: state.openFiles,
        browserContext: {
          history: state.browserHistory,
          lastSearchResults: state.lastSearchResults
        },
        apiKeys: state.apiKeys,
        thinkingModeEnabled: state.thinkingModeEnabled,
        imageProvider: state.imageProvider,
        activeFile: state.activeFile
      }, finalContent, image);

      if (result.updatedNotepad) {
        state.setNotepadContent(result.updatedNotepad);
      }

      state.addMessage({ 
        role: 'assistant', 
        content: result.response,
        model: result.model,
        isGeneratedImage: result.isGeneratedImage,
        imageUrl: result.imageUrl,
        provenance: result.provenance // Attach provenance to the message
      }, state.currentMode);

      if (result.isGeneratedImage && result.imageUrl) {
        state.setLastGeneratedImage(result.imageUrl);
      }

      // Code Extraction & Auto-Update
      if (state.currentMode === 'coding' || result.response.includes('```')) {
        const codeBlocks = result.response.match(/```(?:[a-z]*)\n([\s\S]*?)```/g);
        if (codeBlocks && codeBlocks.length > 0) {
          const lastBlock = codeBlocks[codeBlocks.length - 1];
          const cleanedCode = lastBlock.replace(/```[a-z]*\n/g, '').replace(/```/g, '').trim();
          
          if (state.activeFile) {
            const newFiles = state.openFiles.map(f => 
              f.path === state.activeFile ? { ...f, content: cleanedCode } : f
            );
            state.setOpenFiles(newFiles);
            
            if (window.electron?.logAction) {
              window.electron.logAction({ type: 'ai_code_update', path: state.activeFile });
            }
          }
        }
      }

      if (result.newGraphData && result.newGraphData.nodes) {
        const mergedNodes = [...state.graphNodes];
        result.newGraphData.nodes.forEach((newNode: any) => {
          if (!mergedNodes.find(n => n.id === newNode.id)) {
            mergedNodes.push(newNode);
          }
        });
        const mergedEdges = [...state.graphEdges, ...(result.newGraphData.edges || [])];
        state.setGraphData(mergedNodes, mergedEdges);
      }
    } catch (error: any) {
      const errorMessage = error.body?.error || error.message || 'Service unavailable.';
      state.addMessage({
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        model: 'System'
      });
    } finally {
      state.setIsProcessing(false);
    }
  },

  generateImageAction: async (prompt: string) => {
    const state = get();
    state.addMessage({ role: 'user', content: `Generate an image of: ${prompt}` });
    state.setIsProcessing(true);

    try {
      const imageUrl = await ChatService.generateImage(
        prompt, 
        state.imageProvider, 
        state.apiKeys,
        { localUrl: state.localImageUrl }
      );
      state.setLastGeneratedImage(imageUrl);
      state.addMessage({ 
        role: 'assistant', 
        content: `Here is the image I generated for: "${prompt}"`,
        model: state.imageProvider,
        isGeneratedImage: true,
        imageUrl
      });
    } catch (error: any) {
      const errorMessage = error.body?.error || error.message || 'Image generation failed.';
      state.addMessage({
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        model: 'Image Generator'
      });
    } finally {
      state.setIsProcessing(false);
    }
  }
});
