import { Injectable, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { GeminiService } from '../ai/gemini.service';
import { ChromaService } from '../vector/chroma.service';
import { QueueService } from '../queue/queue.service';
import { QueueProcessor } from '../queue/processor.service';
import * as path from 'path';
import * as fs from 'fs';

export interface DocumentRecord {
  id: string;
  fileName: string;
  mimeType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  filePath: string;
  createdAt: Date;
  summary?: string;
  errorMessage?: string;
  entities?: Array<{ name: string; type: string }>;
  sentiment?: string;
  visualizations?: Array<{
    chartType: 'bar' | 'line' | 'pie';
    title: string;
    xAxis: string;
    yAxis: string;
    data: Array<Record<string, any>>;
  }>;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  
  // In-memory Database Store
  private readonly dbStore = new Map<string, DocumentRecord>();

  constructor(
    private readonly queueService: QueueService,
    @Inject(forwardRef(() => QueueProcessor))
    private readonly queueProcessor: QueueProcessor,
    private readonly geminiService: GeminiService,
    private readonly chromaService: ChromaService,
  ) {
    // Create uploads directory if it doesn't exist
    const uploadsDir = path.resolve('./uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }

  /**
   * Initializes a document record and pushes processing job to Queue
   */
  async registerDocument(file: Express.Multer.File): Promise<DocumentRecord> {
    const documentId = 'doc_' + Math.random().toString(36).substring(2, 11);
    
    // Save file locally for processing
    const uploadsDir = path.resolve('./uploads');
    const localFilePath = path.join(uploadsDir, `${documentId}_${file.originalname}`);
    fs.writeFileSync(localFilePath, file.buffer);

    const record: DocumentRecord = {
      id: documentId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      status: 'PENDING',
      progress: 0,
      filePath: localFilePath,
      createdAt: new Date(),
      errorMessage: undefined,
    };

    this.dbStore.set(documentId, record);
    this.logger.log(`Document registered: ${documentId}. Triggering extraction job...`);

    const jobData = {
      documentId,
      filePath: localFilePath,
      fileName: file.originalname,
      mimeType: file.mimetype,
    };

    // Add processing job via QueueService (supporting in-memory fallback)
    await this.queueService.addJob(
      `process-${documentId}`,
      jobData,
      async () => {
        await this.queueProcessor.processJob(jobData);
      }
    );

    return record;
  }

  /**
   * Retrieves all document records
   */
  async getAllDocuments(): Promise<DocumentRecord[]> {
    return Array.from(this.dbStore.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Retrieves single document record
   */
  async getDocument(id: string): Promise<DocumentRecord> {
    const doc = this.dbStore.get(id);
    if (!doc) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }
    return doc;
  }

  /**
   * Updates document database status
   */
  async updateDocument(id: string, updates: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const doc = await this.getDocument(id);
    const updated = { ...doc, ...updates };
    this.dbStore.set(id, updated);
    return updated;
  }

  /**
   * Executes RAG (Retrieval-Augmented Generation) query over vectors
   */
  async queryDocuments(query: string, documentIds?: string[]): Promise<{ answer: string; citations: any[] }> {
    try {
      // 1. Convert user question to vector embedding
      this.logger.log(`Embedding search query: "${query}"`);
      const queryEmbedding = await this.geminiService.getEmbeddings(query);

      // 2. Query similarity in ChromaDB Cloud
      const contextMatches = await this.chromaService.querySimilarity(
        queryEmbedding,
        5, // Retrieve top 5 closest chunks
        documentIds
      );

      if (contextMatches.length === 0) {
        return {
          answer: "I couldn't find any relevant sections in the processed documents to answer your question.",
          citations: [],
        };
      }

      // 3. Construct prompt incorporating context matches
      const contextText = contextMatches
        .map((match, i) => `[Source ${i + 1}]: ${match.metadata.fileName} (Page ${match.metadata.pageNumber || 'N/A'})\nContent: ${match.content}`)
        .join('\n\n');

      const systemPrompt = `You are a helpful AI assistant analyzing a multimodal corpus.
Answer the user's question based strictly on the provided document excerpts. If the context does not contain the answer, state that you cannot answer based on the documents. Keep your answer professional, clear, and objective.

EXCERPTS FROM DOCUMENTS:
${contextText}

QUESTION:
${query}

ANSWER:`;

      // 4. Generate reasoning response using Gemini
      this.logger.log(`Generating final answer using Gemini...`);
      const answer = await this.geminiService.generateText(systemPrompt);

      return {
        answer,
        citations: contextMatches.map((m) => ({
          fileName: m.metadata.fileName,
          pageNumber: m.metadata.pageNumber,
          chunkIndex: m.metadata.chunkIndex,
          preview: m.content.substring(0, 150) + '...',
          distance: m.distance,
        })),
      };
    } catch (error) {
      this.logger.error(`Error querying documents: ${error.message}`);
      throw error;
    }
  }

  /**
   * Deletes a document, its file assets, and its vector embeddings
   */
  async deleteDocument(id: string): Promise<boolean> {
    const doc = this.dbStore.get(id);
    if (!doc) {
      throw new NotFoundException(`Document with ID ${id} not found`);
    }

    try {
      // 1. Delete vectors
      await this.chromaService.deleteDocumentVectors(id);

      // 2. Remove physical file
      if (fs.existsSync(doc.filePath)) {
        fs.unlinkSync(doc.filePath);
      }

      // 3. Remove metadata registry
      this.dbStore.delete(id);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting document: ${error.message}`);
      throw error;
    }
  }
}
