import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);
  private isRedisAvailable = false;

  constructor(
    @Optional() @Inject(getQueueToken('document-processing')) private readonly bullQueue: Queue | null,
  ) {
    this.isRedisAvailable = process.env.REDIS_AVAILABLE === 'true' && !!this.bullQueue;
    this.logger.log(`Queue initialised. Mode: ${this.isRedisAvailable ? 'BullMQ (Redis)' : 'In-Memory Fallback'}`);
  }

  /**
   * Adds a job to the queue. If Redis is down, runs it in-memory.
   */
  async addJob(name: string, data: any, fallbackProcessor: () => Promise<void>) {
    if (this.isRedisAvailable && this.bullQueue) {
      try {
        this.logger.log(`Enqueuing job "${name}" to BullMQ (Redis)...`);
        await this.bullQueue.add('process', data, {
          attempts: 2,
          backoff: 5000,
        });
      } catch (error) {
        this.logger.warn(`Failed to enqueue to BullMQ: ${error.message}. Falling back to In-Memory...`);
        this.runInMemory(fallbackProcessor);
      }
    } else {
      this.logger.log(`Redis not available. Processing job "${name}" in-memory...`);
      this.runInMemory(fallbackProcessor);
    }
  }

  private runInMemory(processor: () => Promise<void>) {
    // Run asynchronously to prevent blocking the request-response thread
    setTimeout(async () => {
      try {
        await processor();
      } catch (error) {
        this.logger.error(`Error in In-Memory job execution: ${error.message}`);
      }
    }, 100);
  }
}
