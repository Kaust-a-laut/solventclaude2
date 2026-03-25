import { Queue, Worker, Job, QueueEvents, UnrecoverableError } from 'bullmq';
import Redis from 'ioredis';
import { logger } from '../utils/logger';

export enum TaskQueue {
  DEFAULT = 'default',
  INDEXING = 'indexing',
  MEMORY_GARDENING = 'memory_gardening',
  IMAGE_GEN = 'image_gen',
  ORCHESTRATION = 'orchestration'
}

export interface TaskPayload {
  type: string;
  data: any;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class TaskService {
  private redis: Redis;
  private queues: Map<TaskQueue, Queue> = new Map();
  private workers: Map<TaskQueue, Worker> = new Map();
  private queueEvents: Map<TaskQueue, QueueEvents> = new Map();

  constructor(redisUrl: string = 'redis://127.0.0.1:6379') {
    this.redis = new Redis(redisUrl);
    
    // Initialize all queues — each Queue gets its own connection per BullMQ recommendation
    Object.values(TaskQueue).forEach(queueName => {
      this.queues.set(queueName, new Queue(queueName, { 
        connection: this.redis.duplicate(),
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: {
            age: 24 * 3600, // Keep failed jobs for 24 hours
          },
        }
      }));
    });
  }

  getQueue(queueName: TaskQueue): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    return queue;
  }

  /**
   * Lazily creates and caches a QueueEvents instance for the given queue.
   * QueueEvents requires a dedicated Redis connection per BullMQ design.
   */
  getQueueEvents(queueName: TaskQueue): QueueEvents {
    if (!this.queueEvents.has(queueName)) {
      const qe = new QueueEvents(queueName, { connection: this.redis.duplicate() });
      this.queueEvents.set(queueName, qe);
    }
    return this.queueEvents.get(queueName)!;
  }

  async dispatchJob(queueName: TaskQueue, jobName: string, payload: TaskPayload, opts?: any): Promise<string> {
    const queue = this.getQueue(queueName);
    const job = await queue.add(jobName, payload, opts);
    logger.info(`[TaskService] Dispatched job ${jobName} to queue ${queueName} with ID ${job.id}`);
    return job.id!;
  }

  async dispatchIndexingJob(projectPath: string, opts?: any): Promise<string> {
    return this.dispatchJob(
      TaskQueue.INDEXING,
      'index-project',
      { type: 'index-project', data: { projectPath } },
      opts
    );
  }

  async dispatchMemoryMaintenanceJob(opts?: any): Promise<string> {
    return this.dispatchJob(
      TaskQueue.MEMORY_GARDENING,
      'memory-maintenance',
      { type: 'memory-maintenance', data: {} },
      opts
    );
  }

  /**
   * Enqueue a memory consolidation or extraction job with retry support.
   */
  async enqueueMemoryJob(jobType: 'consolidation' | 'extraction', data: any): Promise<string> {
    return this.dispatchJob(
      TaskQueue.MEMORY_GARDENING,
      `memory-${jobType}`,
      { type: `memory-${jobType}`, data },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
  }

  async dispatchImageGenerationJob(prompt: string, model?: string, opts?: any): Promise<string> {
    return this.dispatchJob(
      TaskQueue.IMAGE_GEN,
      'image-generation',
      { type: 'image-generation', data: { prompt, model } },
      opts
    );
  }

  async dispatchOrchestrationJob(
    templateId: string,
    goal: string,
    template: any,
    options?: { providerOverride?: string; modelOverride?: string },
    opts?: any
  ): Promise<string> {
    return this.dispatchJob(
      TaskQueue.ORCHESTRATION,
      'orchestration-mission',
      {
        type: 'orchestration-mission',
        data: {
          templateId,
          goal,
          template,
          providerOverride: options?.providerOverride,
          modelOverride: options?.modelOverride
        }
      },
      opts
    );
  }

  async getJobStatus(jobId: string): Promise<{ status: string; progress: number; result?: any; error?: string }> {
    // Look for the job in all queues — use getState() for a single Redis round-trip
    for (const queue of this.queues.values()) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        const progress = typeof job.progress === 'number' ? job.progress : (state === 'completed' || state === 'failed' ? 100 : 0);

        return {
          status: state,
          progress,
          result: state === 'completed' ? job.returnvalue : undefined,
          error: state === 'failed' ? job.failedReason : undefined,
        };
      }
    }
    
    // Job not found — likely already removed after completion (removeOnComplete: true)
    return {
      status: 'unknown',
      progress: 0
    };
  }

  async scheduleMaintenance(opts?: any): Promise<string> {
    // Schedule a maintenance job with a delay to avoid immediate execution
    return this.dispatchJob(
      TaskQueue.MEMORY_GARDENING,
      'scheduled-maintenance',
      { type: 'scheduled-maintenance', data: {} },
      { 
        ...opts,
        delay: 5000 // 5 seconds delay by default
      }
    );
  }

  async close(): Promise<void> {
    logger.info('[TaskService] Closing all workers and connections...');
    
    // Close all workers
    for (const worker of this.workers.values()) {
      await worker.close();
    }
    
    // Close all queue events
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }
    
    // Disconnect from Redis
    await this.redis.quit();
    
    logger.info('[TaskService] All connections closed.');
  }
}

// Export singleton instance
export const taskService = new TaskService();