import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Collection } from 'chromadb';
export declare class ChromaService implements OnModuleInit {
    private configService;
    private readonly logger;
    private client;
    private defaultCollectionName;
    private readonly fallbackStore;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    private cosineSimilarity;
    getOrCreateCollection(name: string): Promise<Collection | null>;
    addDocumentChunks(documentId: string, chunks: string[], embeddings: number[][], metadatas: any[]): Promise<boolean>;
    querySimilarity(queryEmbedding: number[], nResults?: number, documentIds?: string[]): Promise<any[]>;
    deleteDocumentVectors(documentId: string): Promise<boolean>;
}
