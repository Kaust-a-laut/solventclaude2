import { Job } from 'bullmq';
import { memoryConsolidationService } from '../services/memoryConsolidationService';
import { logger } from '../utils/logger';

export interface MemoryMaintenanceJobData {
  type?: string;
  data?: any;
}

export async function memoryMaintenanceJob(job: Job<MemoryMaintenanceJobData>): Promise<any> {
  const jobType = job.data?.type || job.name;

  // Route to the appropriate handler based on job type
  switch (jobType) {
    case 'memory-consolidation': {
      const { mode, messages } = job.data?.data || {};
      logger.info(`[MemoryMaintenanceJob] Running consolidation for mode: ${mode}`);
      await memoryConsolidationService.consolidateSession(mode, messages);
      return { success: true, type: 'consolidation', completedAt: new Date().toISOString() };
    }

    case 'memory-extraction': {
      const { content } = job.data?.data || {};
      logger.info('[MemoryMaintenanceJob] Running knowledge extraction');
      await memoryConsolidationService.extractKnowledge(content);
      return { success: true, type: 'extraction', completedAt: new Date().toISOString() };
    }

    default: {
      // Original maintenance flow
      logger.info('[MemoryMaintenanceJob] Starting memory maintenance...');

      try {
        await job.updateProgress(10);
        await memoryConsolidationService.runAmnesiaCycle();
        await job.updateProgress(70);
        await memoryConsolidationService.compressOlderMemories();
        await job.updateProgress(100);

        logger.info('[MemoryMaintenanceJob] Completed memory maintenance');
        return {
          success: true,
          message: 'Memory maintenance completed successfully',
          completedAt: new Date().toISOString()
        };
      } catch (error: any) {
        logger.error('[MemoryMaintenanceJob] Failed memory maintenance', error);
        throw new Error(`Memory maintenance failed: ${error.message}`);
      }
    }
  }
}