import { AIProviderFactory } from './aiProviderFactory';
import { vectorService } from './vectorService';
import { logger } from '../utils/logger';
import { ChatMessage } from '../types/ai';

export class MemoryConsolidationService {
  /**
   * Summarizes a conversation segment and stores it in the vector database.
   * This reduces context window usage and improves long-term recall.
   */
  async consolidateSession(mode: string, messages: ChatMessage[]) {
    if (messages.length < 4) return; // Only consolidate substantial threads

    try {
      const groq = await AIProviderFactory.getProvider('groq');
      const textToSummarize = messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n\n');

      const prompt = `Act as the Solvent AI Memory Architect. 
      Analyze this conversation from the "${mode}" mode and extract key technical decisions, discovered facts, or implementation details.
      
      CONVERSATION:
      ${textToSummarize}

      TASK:
      Create a "Memory Snippet" that is concise, technical, and high-density. 
      Focus on WHAT was done and WHY. 
      Format: [MODE: ${mode}] Summary of key insights.`;

      const summary = await groq.complete([
        { role: 'system', content: 'You are a technical archivist.' },
        { role: 'user', content: prompt }
      ], { model: 'llama-3.3-70b-versatile', temperature: 0.1 });

      logger.info(`[Memory] Consolidating segment for mode: ${mode}`);
      
      // Store in vector DB
      await vectorService.addEntry(summary, { 
        type: 'memory_consolidation', 
        mode,
        timestamp: new Date().toISOString() 
      });

      return summary;
    } catch (error) {
      logger.error('[Memory] Consolidation failed', error);
    }
  }

  /**
   * Identifies if a specific piece of information should be "pinned" to long-term memory.
   * Adaptive: Categorizes the memory (Rule, Preference, Architecture).
   * Contextual: Updates visible notes for immediate bridging.
   */
  async extractKnowledge(content: string) {
    if (content.length < 50) return;

    try {
      const groq = await AIProviderFactory.getProvider('groq');
      
      // 1. Fetch potentially conflicting existing memories
      const existingContext = await vectorService.search(content, 3, { type: 'permanent_rule' });
      const contextStr = existingContext.map(m => `[ID: ${m.id}] ${m.metadata.text}`).join('\n');

      const prompt = `Analyze this text for "Crystallizable Knowledge" (Rules/Facts).
      Also check if it CONTRADICTS any existing memories, or if it is RELATED to any existing memories.
      
      NEW TEXT: "${content.substring(0, 2000)}..."
      
      EXISTING MEMORIES:
      ${contextStr || "None"}
      
      Output JSON ONLY:
      {
        "isWorthRemembering": boolean,
        "category": "technical_fact" | "project_rule" | "user_preference" | "architectural_decision" | null,
        "conciseStatement": "The exact rule or fact to store",
        "tags": ["tag1", "tag2"],
        "links": ["ID_OF_RELATED_MEMORY_1", "ID_OF_RELATED_MEMORY_2"],
        "contradiction": {
           "found": boolean,
           "conflictingMemoryId": "ID_OF_OLD_MEMORY" (or null),
           "reason": "Why it contradicts",
           "severity": "LOW" | "HIGH"
        }
      }`;

      const res = await groq.complete([
        { role: 'system', content: 'You are the Memory Architect. You detect new knowledge, links, AND contradictions.' },
        { role: 'user', content: prompt }
      ], { model: 'llama-3.3-70b-versatile', temperature: 0, jsonMode: true });

      const cleaned = res.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      const analysis = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

      // Dynamic import to avoid circular dependency
      const { toolService } = require('./toolService');

      let newMemoryId: string | undefined;

      // 2. Crystallize New Memory
      if (analysis.isWorthRemembering && analysis.conciseStatement) {
        newMemoryId = await vectorService.addEntry(analysis.conciseStatement, {
          type: analysis.category || 'technical_fact',
          tier: 'crystallized',
          tags: analysis.tags || [],
          links: analysis.links || [],
          confidence: 'HIGH',
          source: 'chat'
        });
        logger.info(`[Memory] Crystallized: ${analysis.conciseStatement.substring(0, 40)}... with ID: ${newMemoryId}`);
      }

      // 3. Handle Contradictions
      if (analysis.contradiction && analysis.contradiction.found && analysis.contradiction.conflictingMemoryId) {
         if (analysis.contradiction.severity === 'LOW' || analysis.category === 'user_preference') {
           // Auto-deprecate low-stakes or preference updates
           await vectorService.deprecateEntry(analysis.contradiction.conflictingMemoryId, `Superseded by ${newMemoryId}: ${analysis.contradiction.reason}`);
           logger.info(`[Memory] Auto-resolved low-stakes contradiction. Deprecated ${analysis.contradiction.conflictingMemoryId}`);
         } else {
           logger.info(`[Memory] High-stakes contradiction detected with ${analysis.contradiction.conflictingMemoryId}. Requesting user clarification.`);
           
           const { supervisorService } = require('./supervisorService');
           
           supervisorService.emitClarificationRequest({
             type: 'memory_conflict',
             question: `I detected a conflict. Existing rule: "[${analysis.contradiction.conflictingMemoryId}]" vs New info: "${analysis.conciseStatement}". Should I overwrite the old rule?`,
             data: {
               oldMemoryId: analysis.contradiction.conflictingMemoryId,
               newContent: analysis.conciseStatement,
               newType: analysis.category,
               newId: newMemoryId
             }
           });
         }
      }

    } catch (e) {
      // Silent fail is acceptable for background processes
    }
  }

  /**
   * Compresses older episodic memories into high-level summaries to maintain efficiency.
   */
  async compressOlderMemories() {
    logger.info('[Memory] Starting compression of older episodic memories...');
    const allRecent = vectorService.getRecentEntries(500);
    const olderEpisodic = allRecent.filter(m => 
      m.metadata.tier === 'episodic' && 
      (Date.now() - new Date(m.metadata.createdAt).getTime()) > 1000 * 60 * 60 * 24 * 3 // Older than 3 days
    );

    if (olderEpisodic.length < 20) return;

    try {
      const groq = await AIProviderFactory.getProvider('groq');
      const textToCompress = olderEpisodic.map(m => `[${m.metadata.type}] ${m.metadata.text}`).join('\n');
      
      const prompt = `Summarize these older episodic memories into a single, high-density architectural summary. 
      Retain all technical decisions and key facts, but discard conversational noise.
      
      MEMORIES:
      ${textToCompress.substring(0, 10000)}
      
      Output ONLY the concise summary.`;

      const summary = await groq.complete([
        { role: 'system', content: 'You are a technical archivist.' },
        { role: 'user', content: prompt }
      ], { model: 'llama-3.3-70b-versatile', temperature: 0.1 });

      // Store the compressed summary
      await vectorService.addEntry(summary, {
        type: 'compressed_episodic_summary',
        tier: 'archived',
        importance: 3,
        source: 'memory_consolidation_service'
      });

      // Deprecate the old ones
      for (const m of olderEpisodic) {
        await vectorService.deprecateEntry(m.id, 'Compressed into episodic summary');
      }

      logger.info(`[Memory] Compressed ${olderEpisodic.length} episodic memories.`);
    } catch (error) {
      logger.error('[Memory] Compression failed', error);
    }
  }

  /**
   * The "Amnesia Cycle": Periodically reflects over recent knowledge to generate 
   * high-density Meta-Summaries for long-term project evolution tracking.
   */
  async runAmnesiaCycle() {
    logger.info('[Memory] Starting Dual-Output Amnesia Cycle...');
    
    // Trigger compression of older memories first
    await this.compressOlderMemories().catch(e => logger.error('[Memory] Compression during Amnesia Cycle failed', e));

    const recentEntries = await vectorService.getRecentEntries(200);
    const content = recentEntries
      .map(m => `[TYPE: ${m.metadata.type}] ${m.metadata.text}`)
      .join('\n---\n');

    const promptText = `Act as the Solvent AI Amnesia Agent. 
    Analyze the latest 200 project interactions. You must produce TWO distinct outputs in a single JSON object.

    OUTPUT 1: PROJECT META-SUMMARY
    - Focus: Specific tech stack (e.g., Rust, Node), file names (e.g., server.ts), and project-specific variable names.
    - Goal: Total coherence for the CURRENT project.

    OUTPUT 2: UNIVERSAL ENGINEERING PATTERN
    - Focus: Abstract architectural principles and design patterns.
    - CRITICAL SECURITY CONSTRAINT: You MUST STRIP all project-specific names, specific file paths, and ANY internal variable or header names (e.g., sv_auth, Chronos, InternalKey). 
    - Replace specifics with generic terms like "Authentication Header", "Sharding Logic", "Primary Service".
    - Goal: Anonymized cross-project inspiration.

    RECENT MEMORIES:
    ${content.substring(0, 10000)}

    Respond with ONLY a valid JSON object:
    {
      "specific": "High-density project-specific summary",
      "universal": "Abstract engineering pattern or principle"
    }`;

    const providers = [
      { name: 'gemini', model: 'gemini-2.5-pro' },
      { name: 'gemini', model: 'gemini-2.0-flash' },
      { name: 'groq', model: 'llama-3.3-70b-versatile' },
      { name: 'ollama', model: 'qwen2.5-coder:7b' }
    ];

    for (const providerInfo of providers) {
      let attempts = 0;
      const maxProviderAttempts = 2;

      while (attempts < maxProviderAttempts) {
        try {
          const provider = await AIProviderFactory.getProvider(providerInfo.name);
          logger.info(`[Memory] Attempting Amnesia Cycle with ${providerInfo.name} (Attempt ${attempts + 1})...`);
          
          const res = await provider.complete([
            { role: 'system', content: 'You are a technical archivist. You perform retrospectives and extract abstract patterns. You MUST respond in valid JSON. Do not use any tools.' },
            { role: 'user', content: promptText }
          ], { 
            model: providerInfo.model, 
            temperature: 0.1, 
            jsonMode: true,
            shouldSearch: false 
          });

          const cleaned = res.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
          const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
          const result = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);

          // Success - Store Results
          await vectorService.addEntry(result.specific, {
            type: 'meta_summary',
            tier: 'meta-summary',
            isAnchor: true,
            importance: 5,
            timestamp: new Date().toISOString()
          });

          await vectorService.addEntry(result.universal, {
            type: 'universal_pattern',
            tier: 'meta-summary',
            isUniversal: true,
            importance: 4,
            timestamp: new Date().toISOString()
          });

          logger.info(`[Memory] Dual-Output Amnesia Cycle complete via ${providerInfo.name}.`);
          return result;

        } catch (err: any) {
          attempts++;
          const isRateLimit = err.message.includes('429') || err.message.includes('quota');
          
          if (isRateLimit && attempts < maxProviderAttempts) {
            const delay = 2000 * attempts;
            logger.warn(`[Memory] Rate limited on ${providerInfo.name}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          logger.warn(`[Memory] Amnesia Cycle failed with ${providerInfo.name}: ${err.message}`);
          break; // Switch to next provider
        }
      }
    }

    throw new Error('All providers failed for Amnesia Cycle.');
  }
}

export const memoryConsolidationService = new MemoryConsolidationService();