import { AIProviderFactory } from './aiProviderFactory';
import { vectorService } from './vectorService';
import { logger } from '../utils/logger';
import { MODELS } from '../constants/models';

export class MetaMemoryService {
  
  /**
   * Periodic "Dreaming" Cycle.
   * Analyzes recent vector entries to update the high-level understanding of the project.
   */
  async synthesizeStateOfTheUnion() {
    logger.info('[MetaMemory] Starting synthesis cycle...');
    
    // 1. Gather Raw Data
    const recent = vectorService.getRecentEntries(50);
    if (recent.length < 5) {
        logger.info('[MetaMemory] Not enough data to synthesize.');
        return null;
    }

    const memoryDump = recent
        .filter(m => m.metadata.text && m.metadata.text.length > 20)
        .map(m => `[${m.metadata.type?.toUpperCase() || 'INFO'} | ${m.metadata.timestamp || 'N/A'}] ${m.metadata.text.substring(0, 300)}...`)
        .join('\n');

    // 2. Perform Cognitive Analysis
    try {
        const groq = await AIProviderFactory.getProvider('groq');
        
        const prompt = `Act as the Chief Architect of this software project. 
        Review the following log of recent AI interactions, code changes, and memory snippets.
        
        RECENT MEMORY LOG:
        ${memoryDump}
        
        TASK:
        Synthesize a "State of the Union" report. 
        1. Identify the current active workstream (what feature are we building?).
        2. Note any architectural decisions made.
        3. List open technical debt or unresolved errors. 
        
        Output format:
        "## Active Context: [Summary]
         ## Architecture Notes: [Bullet points]
         ## Risks: [Bullet points]"
         
        Keep it concise and high-density.`;

        const summary = await groq.complete([
            { role: 'system', content: 'You are the Meta-Memory subsystem.' },
            { role: 'user', content: prompt }
        ], { 
            model: MODELS.GROQ.LLAMA_3_3_70B || 'llama-3.3-70b-versatile',
            temperature: 0.2 
        });

        // 3. Commit to Long-Term Memory
        await vectorService.addEntry(summary, {
            type: 'meta_summary',
            timestamp: new Date().toISOString(),
            source: 'meta_memory_service'
        });

        logger.info('[MetaMemory] Synthesis complete. New meta-summary stored.');
        return summary;

    } catch (error: any) {
        logger.error(`[MetaMemory] Synthesis failed: ${error.message}`);
        throw error;
    }
  }
}

export const metaMemoryService = new MetaMemoryService();
