import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChromaClient, Collection } from 'chromadb';

@Injectable()
export class ChromaService implements OnModuleInit {
  private readonly logger = new Logger(ChromaService.name);
  private client: ChromaClient;
  private defaultCollectionName = 'multimodal_documents';
  
  // Local In-Memory Vector Fallback Store
  private readonly fallbackStore: Array<{
    id: string;
    documentId: string;
    embedding: number[];
    metadata: any;
    document: string;
  }> = [];

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const chromaUrl = this.configService.get<string>('CHROMA_URL', 'https://api.trychroma.com');
    const apiKey = this.configService.get<string>('CHROMA_CLOUD_API_KEY');
    const tenant = this.configService.get<string>('CHROMA_CLOUD_TENANT', 'default');
    const database = this.configService.get<string>('CHROMA_CLOUD_DATABASE', 'default');

    this.logger.log(`Connecting to ChromaDB Cloud at ${chromaUrl} (Tenant: ${tenant}, DB: ${database})...`);

    try {
      // Connect to ChromaDB Cloud using auth credentials
      const clientConfig: any = { path: chromaUrl };

      if (apiKey && apiKey !== 'your_chroma_cloud_api_key_here') {
        clientConfig.tenant = tenant;
        clientConfig.database = database;
        clientConfig.auth = {
          provider: 'token',
          credentials: apiKey,
        };
      }

      this.client = new ChromaClient(clientConfig);
      
      // Heartbeat check to confirm connectivity
      const version = await this.client.version();
      this.logger.log(`ChromaDB Cloud connected successfully. Version: ${version}`);
      
      // Warmup/Initialize default collection
      await this.getOrCreateCollection(this.defaultCollectionName);
    } catch (error) {
      this.logger.error(`Failed to connect to ChromaDB Cloud: ${error.message}. Using mock/offline fallback mode.`);
      this.client = null;
    }
  }

  /**
   * Helper function to compute cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
  }

  private addChunksToFallbackStore(documentId: string, chunks: string[], embeddings: number[][], metadatas: any[]) {
    for (let i = 0; i < chunks.length; i++) {
      this.fallbackStore.push({
        id: `${documentId}_chunk_${i}`,
        documentId,
        embedding: embeddings[i],
        metadata: metadatas[i],
        document: chunks[i],
      });
    }
    this.logger.log(`Successfully added ${chunks.length} chunks to local store fallback.`);
  }

  private queryFallbackStore(queryEmbedding: number[], nResults = 5, documentIds?: string[]): any[] {
    let candidates = this.fallbackStore;

    if (documentIds && documentIds.length > 0) {
      candidates = candidates.filter((item) => documentIds.includes(item.documentId));
    }

    const scored = candidates.map((item) => {
      const similarity = this.cosineSimilarity(queryEmbedding, item.embedding);
      return {
        content: item.document,
        metadata: item.metadata,
        distance: 1 - similarity,
      };
    });

    scored.sort((a, b) => a.distance - b.distance);

    const results = scored.slice(0, nResults);
    this.logger.log(`Local semantic search completed. Found ${results.length} matches.`);
    return results;
  }

  /**
   * Gets or creates a vector collection in ChromaDB
   */
  async getOrCreateCollection(name: string): Promise<Collection | null> {
    if (!this.client) {
      return null;
    }
    try {
      return await this.client.getOrCreateCollection({
        name,
      });
    } catch (error) {
      this.logger.error(`Error in getOrCreateCollection: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inserts text chunks and their embeddings into ChromaDB or local fallback store
   */
  async addDocumentChunks(
    documentId: string,
    chunks: string[],
    embeddings: number[][],
    metadatas: any[],
  ): Promise<boolean> {
    const sanitizedMetadatas = metadatas.map((m, i) => ({
      documentId,
      chunkIndex: i,
      pageNumber: m.pageNumber || 0,
      timestampStart: m.timestampStart || '',
      timestampEnd: m.timestampEnd || '',
      speakerId: m.speakerId || '',
      fileName: m.fileName || '',
    }));

    if (!this.client) {
      this.logger.warn('ChromaDB client offline. Storing chunks in local in-memory fallback store.');
      this.addChunksToFallbackStore(documentId, chunks, embeddings, sanitizedMetadatas);
      return true;
    }

    try {
      const collection = await this.getOrCreateCollection(this.defaultCollectionName);
      if (!collection) return false;

      const ids = chunks.map((_, i) => `${documentId}_chunk_${i}`);

      this.logger.log(`Adding ${chunks.length} chunks to ChromaDB collection...`);
      await collection.add({
        ids,
        embeddings,
        metadatas: sanitizedMetadatas,
        documents: chunks,
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to add chunks to ChromaDB: ${error.message}. Using local fallback store.`);
      this.addChunksToFallbackStore(documentId, chunks, embeddings, sanitizedMetadatas);
      this.client = null;
      return true;
    }
  }

  /**
   * Queries ChromaDB or local fallback store for semantic similarity matches
   */
  async querySimilarity(
    queryEmbedding: number[],
    nResults = 5,
    documentIds?: string[],
  ): Promise<any[]> {
    if (!this.client) {
      this.logger.warn('ChromaDB client offline. Running semantic search over local in-memory store...');
      return this.queryFallbackStore(queryEmbedding, nResults, documentIds);
    }

    try {
      const collection = await this.getOrCreateCollection(this.defaultCollectionName);
      if (!collection) return [];

      const queryParams: any = {
        queryEmbeddings: [queryEmbedding],
        nResults,
      };

      // Add filtering by document IDs if provided
      if (documentIds && documentIds.length > 0) {
        queryParams.where = {
          documentId: {
            $in: documentIds,
          },
        };
      }

      this.logger.log(`Querying ChromaDB for similarity...`);
      const response = await collection.query(queryParams);

      // Flatten and format results
      const results = [];
      if (response && response.documents && response.documents[0]) {
        const docs = response.documents[0];
        const metadatas = response.metadatas[0];
        const distances = response.distances ? response.distances[0] : [];

        for (let i = 0; i < docs.length; i++) {
          results.push({
            content: docs[i],
            metadata: metadatas[i],
            distance: distances[i] || 0,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to query ChromaDB: ${error.message}. Using local fallback store.`);
      this.client = null;
      return this.queryFallbackStore(queryEmbedding, nResults, documentIds);
    }
  }

  /**
   * Deletes all vectors corresponding to a specific document ID from ChromaDB or local fallback store
   */
  async deleteDocumentVectors(documentId: string): Promise<boolean> {
    if (!this.client) {
      this.logger.log(`Deleting all vectors for documentId ${documentId} from local fallback store...`);
      const beforeCount = this.fallbackStore.length;
      for (let i = this.fallbackStore.length - 1; i >= 0; i--) {
        if (this.fallbackStore[i].documentId === documentId) {
          this.fallbackStore.splice(i, 1);
        }
      }
      this.logger.log(`Deleted ${beforeCount - this.fallbackStore.length} vectors from local store.`);
      return true;
    }

    try {
      const collection = await this.getOrCreateCollection(this.defaultCollectionName);
      if (!collection) return false;

      this.logger.log(`Deleting all vectors for documentId ${documentId} from ChromaDB...`);
      await collection.delete({
        where: {
          documentId: {
            $eq: documentId,
          },
        },
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete vectors from ChromaDB: ${error.message}`);
      throw error;
    }
  }
}
