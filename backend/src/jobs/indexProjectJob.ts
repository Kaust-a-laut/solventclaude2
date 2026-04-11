import { Job } from 'bullmq';
import { vectorService } from '../services/vectorService';
import { logger } from '../utils/logger';

export interface IndexProjectJobData {
  projectPath: string;
}

export async function indexProjectJob(job: Job<IndexProjectJobData>): Promise<unknown> {
  const { projectPath } = job.data;
  
  logger.info(`[IndexProjectJob] Starting indexing for project: ${projectPath}`);
  
  try {
    // Report initial progress
    await job.updateProgress(5);
    
    // Wrap the vectorService.indexProject method
    await vectorService.indexProject(projectPath);
    
    // Report completion
    await job.updateProgress(100);
    
    logger.info(`[IndexProjectJob] Completed indexing for project: ${projectPath}`);
    
    return {
      success: true,
      message: `Successfully indexed project: ${projectPath}`,
      indexedAt: new Date().toISOString()
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[IndexProjectJob] Failed to index project: ${projectPath}`, error);

    // Throw error to mark job as failed
    throw new Error(`Indexing failed: ${err.message}`);
  }
}