import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bull';
import { DocumentService } from '../document/document.service';
import { GeminiService } from '../ai/gemini.service';
import { ChromaService } from '../vector/chroma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as pdf from 'pdf-parse';
import * as mammoth from 'mammoth';

@Injectable()
export class QueueProcessor {
  private readonly logger = new Logger(QueueProcessor.name);

  constructor(
    @Inject(forwardRef(() => DocumentService))
    private readonly documentService: DocumentService,
    private readonly geminiService: GeminiService,
    private readonly chromaService: ChromaService,
  ) {}

  /**
   * Core processing logic used by both BullMQ and In-Memory fallback queue
   */
  async processJob(data: { documentId: string; filePath: string; fileName: string; mimeType: string }) {
    const { documentId, filePath, fileName, mimeType } = data;
    this.logger.log(`Starting document analysis for: ${documentId} (${fileName})`);

    try {
      // 1. Update status to PROCESSING
      await this.documentService.updateDocument(documentId, {
        status: 'PROCESSING',
        progress: 15,
        errorMessage: undefined,
      });

      let extractedText = '';

      // 2. Perform file extraction based on MIME Type
      if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'application/json') {
        extractedText = fs.readFileSync(filePath, 'utf-8');
      } 
      else if (mimeType === 'application/pdf') {
        const fileBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(fileBuffer);
        extractedText = pdfData.text;
      } 
      else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const fileBuffer = fs.readFileSync(filePath);
        const docResult = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = docResult.value;
      } 
      else if (
        mimeType.startsWith('image/') || 
        mimeType.startsWith('audio/') || 
        mimeType.startsWith('video/')
      ) {
        await this.documentService.updateDocument(documentId, { progress: 30 });
        const mediaPrompt = `Please transcribe and analyze this media file.
Extract all audio transcripts, dialog, captions, visual content descriptions, and structured text tables.
Render the output as comprehensive Markdown.`;
        
        extractedText = await this.geminiService.analyzeMediaFile(filePath, mimeType, mediaPrompt);
      } 
      else {
        throw new Error(`Unsupported file type: ${mimeType}`);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error('No content could be extracted from the document.');
      }

      await this.documentService.updateDocument(documentId, { progress: 50 });

      // 3. Chunk the document text
      const chunks = this.chunkText(extractedText, 800, 150);
      this.logger.log(`Split document into ${chunks.length} chunks`);

      // 4. Generate embeddings and upload chunks to ChromaDB Cloud
      const embeddings: number[][] = [];
      const metadatas: any[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.geminiService.getEmbeddings(chunk);
        embeddings.push(embedding);
        metadatas.push({
          fileName,
          pageNumber: Math.floor(i / 3) + 1,
        });
      }

      await this.chromaService.addDocumentChunks(documentId, chunks, embeddings, metadatas);
      await this.documentService.updateDocument(documentId, { progress: 75 });

      // 5. Generate structured synthesis & visualization schemas using Gemini JSON schema
      this.logger.log(`Synthesizing document insights...`);
      const analysisPrompt = `Analyze the following extracted content of the file "${fileName}".
Provide a concise summary, key entities, overall sentiment, and some relevant visual charts (at least 1, up to 3) representing statistics, ratios, or timeline milestones mentioned in the text.
If no direct numbers or metrics are available, create a chart showing the frequency of key concepts or categories mentioned.

CONTENT TO ANALYZE:
${extractedText.substring(0, 15000)}
`;

      const analysisSchema = {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          sentiment: { type: 'STRING' },
          entities: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                type: { type: 'STRING' },
              },
              required: ['name', 'type'],
            },
          },
          visualizations: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                chartType: { type: 'STRING' }, // bar, line, pie
                title: { type: 'STRING' },
                xAxis: { type: 'STRING' },
                yAxis: { type: 'STRING' },
                data: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                  },
                },
              },
              required: ['chartType', 'title', 'xAxis', 'yAxis', 'data'],
            },
          },
        },
        required: ['summary', 'sentiment', 'entities', 'visualizations'],
      };

      const result = await this.geminiService.generateStructured<any>(
        analysisPrompt,
        analysisSchema
      );

      // 6. Update database record to COMPLETED with structural analysis results
      await this.documentService.updateDocument(documentId, {
        status: 'COMPLETED',
        progress: 100,
        errorMessage: undefined,
        summary: result.summary,
        sentiment: result.sentiment,
        entities: result.entities,
        visualizations: result.visualizations,
      });

      this.logger.log(`Successfully completed background processing for Document: ${documentId}`);
    } catch (error) {
      this.logger.error(`Failed to process Document: ${documentId} - Error: ${error.message}`, error.stack);
      
      await this.documentService.updateDocument(documentId, {
        status: 'FAILED',
        progress: 100,
        errorMessage: error.message,
      });
    }
  }

  private chunkText(text: string, chunkSize = 1000, chunkOverlap = 200): string[] {
    const chunks: string[] = [];
    let index = 0;

    while (index < text.length) {
      const chunk = text.substring(index, index + chunkSize);
      chunks.push(chunk);
      index += chunkSize - chunkOverlap;
    }

    return chunks;
  }
}

/**
 * BullMQ Consumer wrapper. Only activated when Redis is running.
 */
@Processor('document-processing')
export class BullQueueConsumer {
  constructor(private readonly processor: QueueProcessor) {}

  @Process('process')
  async handleProcess(job: Job<any>) {
    await this.processor.processJob(job.data);
  }
}
