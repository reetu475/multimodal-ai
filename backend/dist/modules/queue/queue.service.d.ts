import { Queue } from 'bull';
export declare class QueueService {
    private readonly bullQueue;
    private readonly logger;
    private isRedisAvailable;
    constructor(bullQueue: Queue | null);
    addJob(name: string, data: any, fallbackProcessor: () => Promise<void>): Promise<void>;
    private runInMemory;
}
