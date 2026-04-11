import { Job } from 'bullmq';
import { aiService } from '../services/aiService';
import { logger } from '../utils/logger';

export interface ImageGenJobData {
  prompt: string;
  model?: string;
}

export async function imageGenJob(job: Job<ImageGenJobData>): Promise<unknown> {
  const { prompt, model } = job.data;
  
  logger.info(`[ImageGenJob] Starting image generation for prompt: ${prompt.substring(0, 50)}...`);
  
  try {
    // Report initial progress
    await job.updateProgress(10);
    
    // Generate the image using aiService
    const result = await aiService.generateImage(prompt, model);
    
    // Report completion
    await job.updateProgress(100);
    
    logger.info(`[ImageGenJob] Completed image generation for prompt: ${prompt.substring(0, 50)}...`);
    
    return {
      success: true,
      imageUrl: result.imageUrl,
      fileName: result.fileName,
      info: result.info,
      generatedAt: new Date().toISOString()
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`[ImageGenJob] Failed image generation for prompt: ${prompt.substring(0, 50)}...`, error);

    // Throw error to mark job as failed
    throw new Error(`Image generation failed: ${err.message}`);
  }
}