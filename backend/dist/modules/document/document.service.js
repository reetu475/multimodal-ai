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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DocumentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const common_1 = require("@nestjs/common");
const gemini_service_1 = require("../ai/gemini.service");
const chroma_service_1 = require("../vector/chroma.service");
const queue_service_1 = require("../queue/queue.service");
const processor_service_1 = require("../queue/processor.service");
const path = require("path");
const fs = require("fs");
let DocumentService = DocumentService_1 = class DocumentService {
    constructor(queueService, queueProcessor, geminiService, chromaService) {
        this.queueService = queueService;
        this.queueProcessor = queueProcessor;
        this.geminiService = geminiService;
        this.chromaService = chromaService;
        this.logger = new common_1.Logger(DocumentService_1.name);
        this.dbStore = new Map();
        const uploadsDir = path.resolve('./uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
    }
    async registerDocument(file) {
        const documentId = 'doc_' + Math.random().toString(36).substring(2, 11);
        const uploadsDir = path.resolve('./uploads');
        const localFilePath = path.join(uploadsDir, `${documentId}_${file.originalname}`);
        fs.writeFileSync(localFilePath, file.buffer);
        const record = {
            id: documentId,
            fileName: file.originalname,
            mimeType: file.mimetype,
            status: 'PENDING',
            progress: 0,
            filePath: localFilePath,
            createdAt: new Date(),
        };
        this.dbStore.set(documentId, record);
        this.logger.log(`Document registered: ${documentId}. Triggering extraction job...`);
        const jobData = {
            documentId,
            filePath: localFilePath,
            fileName: file.originalname,
            mimeType: file.mimetype,
        };
        await this.queueService.addJob(`process-${documentId}`, jobData, async () => {
            await this.queueProcessor.processJob(jobData);
        });
        return record;
    }
    async getAllDocuments() {
        return Array.from(this.dbStore.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    async getDocument(id) {
        const doc = this.dbStore.get(id);
        if (!doc) {
            throw new common_1.NotFoundException(`Document with ID ${id} not found`);
        }
        return doc;
    }
    async updateDocument(id, updates) {
        const doc = await this.getDocument(id);
        const updated = { ...doc, ...updates };
        this.dbStore.set(id, updated);
        return updated;
    }
    async queryDocuments(query, documentIds) {
        try {
            this.logger.log(`Embedding search query: "${query}"`);
            const queryEmbedding = await this.geminiService.getEmbeddings(query);
            const contextMatches = await this.chromaService.querySimilarity(queryEmbedding, 5, documentIds);
            if (contextMatches.length === 0) {
                return {
                    answer: "I couldn't find any relevant sections in the processed documents to answer your question.",
                    citations: [],
                };
            }
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
        }
        catch (error) {
            this.logger.error(`Error querying documents: ${error.message}`);
            throw error;
        }
    }
    async deleteDocument(id) {
        const doc = this.dbStore.get(id);
        if (!doc) {
            throw new common_1.NotFoundException(`Document with ID ${id} not found`);
        }
        try {
            await this.chromaService.deleteDocumentVectors(id);
            if (fs.existsSync(doc.filePath)) {
                fs.unlinkSync(doc.filePath);
            }
            this.dbStore.delete(id);
            return true;
        }
        catch (error) {
            this.logger.error(`Error deleting document: ${error.message}`);
            throw error;
        }
    }
};
exports.DocumentService = DocumentService;
exports.DocumentService = DocumentService = DocumentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => processor_service_1.QueueProcessor))),
    __metadata("design:paramtypes", [queue_service_1.QueueService,
        processor_service_1.QueueProcessor,
        gemini_service_1.GeminiService,
        chroma_service_1.ChromaService])
], DocumentService);
//# sourceMappingURL=document.service.js.map