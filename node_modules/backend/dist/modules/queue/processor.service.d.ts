import { Job } from 'bull';
import { DocumentService } from '../document/document.service';
import { GeminiService } from '../ai/gemini.service';
import { ChromaService } from '../vector/chroma.service';
export declare class QueueProcessor {
    private readonly documentService;
    private readonly geminiService;
    private readonly chromaService;
    private readonly logger;
    constructor(documentService: DocumentService, geminiService: GeminiService, chromaService: ChromaService);
    processJob(data: {
        documentId: string;
        filePath: string;
        fileName: string;
        mimeType: string;
    }): Promise<void>;
    private chunkText;
}
export declare class BullQueueConsumer {
    private readonly processor;
    constructor(processor: QueueProcessor);
    handleProcess(job: Job<any>): Promise<void>;
}
