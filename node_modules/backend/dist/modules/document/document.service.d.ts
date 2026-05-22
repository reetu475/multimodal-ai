import { GeminiService } from '../ai/gemini.service';
import { ChromaService } from '../vector/chroma.service';
import { QueueService } from '../queue/queue.service';
import { QueueProcessor } from '../queue/processor.service';
export interface DocumentRecord {
    id: string;
    fileName: string;
    mimeType: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    progress: number;
    filePath: string;
    createdAt: Date;
    summary?: string;
    entities?: Array<{
        name: string;
        type: string;
    }>;
    sentiment?: string;
    visualizations?: Array<{
        chartType: 'bar' | 'line' | 'pie';
        title: string;
        xAxis: string;
        yAxis: string;
        data: Array<Record<string, any>>;
    }>;
}
export declare class DocumentService {
    private readonly queueService;
    private readonly queueProcessor;
    private readonly geminiService;
    private readonly chromaService;
    private readonly logger;
    private readonly dbStore;
    constructor(queueService: QueueService, queueProcessor: QueueProcessor, geminiService: GeminiService, chromaService: ChromaService);
    registerDocument(file: Express.Multer.File): Promise<DocumentRecord>;
    getAllDocuments(): Promise<DocumentRecord[]>;
    getDocument(id: string): Promise<DocumentRecord>;
    updateDocument(id: string, updates: Partial<DocumentRecord>): Promise<DocumentRecord>;
    queryDocuments(query: string, documentIds?: string[]): Promise<{
        answer: string;
        citations: any[];
    }>;
    deleteDocument(id: string): Promise<boolean>;
}
