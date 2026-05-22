"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var ChromaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChromaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const chromadb_1 = require("chromadb");
let ChromaService = ChromaService_1 = class ChromaService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(ChromaService_1.name);
        this.defaultCollectionName = 'multimodal_documents';
        this.fallbackStore = [];
    }
    async onModuleInit() {
        const chromaUrl = this.configService.get('CHROMA_URL', 'https://api.trychroma.com');
        const apiKey = this.configService.get('CHROMA_CLOUD_API_KEY');
        const tenant = this.configService.get('CHROMA_CLOUD_TENANT', 'default');
        const database = this.configService.get('CHROMA_CLOUD_DATABASE', 'default');
        this.logger.log(`Connecting to ChromaDB Cloud at ${chromaUrl} (Tenant: ${tenant}, DB: ${database})...`);
        try {
            const clientConfig = { path: chromaUrl };
            if (apiKey && apiKey !== 'your_chroma_cloud_api_key_here') {
                clientConfig.tenant = tenant;
                clientConfig.database = database;
                clientConfig.auth = {
                    provider: 'token',
                    credentials: apiKey,
                };
            }
            this.client = new chromadb_1.ChromaClient(clientConfig);
            const version = await this.client.version();
            this.logger.log(`ChromaDB Cloud connected successfully. Version: ${version}`);
            await this.getOrCreateCollection(this.defaultCollectionName);
        }
        catch (error) {
            this.logger.error(`Failed to connect to ChromaDB Cloud: ${error.message}. Using mock/offline fallback mode.`);
            this.client = null;
        }
    }
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length)
            return 0;
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
    async getOrCreateCollection(name) {
        if (!this.client) {
            return null;
        }
        try {
            return await this.client.getOrCreateCollection({
                name,
            });
        }
        catch (error) {
            this.logger.error(`Error in getOrCreateCollection: ${error.message}`);
            throw error;
        }
    }
    async addDocumentChunks(documentId, chunks, embeddings, metadatas) {
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
            for (let i = 0; i < chunks.length; i++) {
                this.fallbackStore.push({
                    id: `${documentId}_chunk_${i}`,
                    documentId,
                    embedding: embeddings[i],
                    metadata: sanitizedMetadatas[i],
                    document: chunks[i],
                });
            }
            this.logger.log(`Successfully added ${chunks.length} chunks to local store fallback.`);
            return true;
        }
        try {
            const collection = await this.getOrCreateCollection(this.defaultCollectionName);
            if (!collection)
                return false;
            const ids = chunks.map((_, i) => `${documentId}_chunk_${i}`);
            this.logger.log(`Adding ${chunks.length} chunks to ChromaDB collection...`);
            await collection.add({
                ids,
                embeddings,
                metadatas: sanitizedMetadatas,
                documents: chunks,
            });
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to add chunks to ChromaDB: ${error.message}`);
            throw error;
        }
    }
    async querySimilarity(queryEmbedding, nResults = 5, documentIds) {
        if (!this.client) {
            this.logger.warn('ChromaDB client offline. Running semantic search over local in-memory store...');
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
        try {
            const collection = await this.getOrCreateCollection(this.defaultCollectionName);
            if (!collection)
                return [];
            const queryParams = {
                queryEmbeddings: [queryEmbedding],
                nResults,
            };
            if (documentIds && documentIds.length > 0) {
                queryParams.where = {
                    documentId: {
                        $in: documentIds,
                    },
                };
            }
            this.logger.log(`Querying ChromaDB for similarity...`);
            const response = await collection.query(queryParams);
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
        }
        catch (error) {
            this.logger.error(`Failed to query ChromaDB: ${error.message}`);
            throw error;
        }
    }
    async deleteDocumentVectors(documentId) {
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
            if (!collection)
                return false;
            this.logger.log(`Deleting all vectors for documentId ${documentId} from ChromaDB...`);
            await collection.delete({
                where: {
                    documentId: {
                        $eq: documentId,
                    },
                },
            });
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to delete vectors from ChromaDB: ${error.message}`);
            throw error;
        }
    }
};
exports.ChromaService = ChromaService;
exports.ChromaService = ChromaService = ChromaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ChromaService);
//# sourceMappingURL=chroma.service.js.map