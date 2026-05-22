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
var QueueProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BullQueueConsumer = exports.QueueProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const document_service_1 = require("../document/document.service");
const gemini_service_1 = require("../ai/gemini.service");
const chroma_service_1 = require("../vector/chroma.service");
const fs = require("fs");
const pdf = require("pdf-parse");
const mammoth = require("mammoth");
let QueueProcessor = QueueProcessor_1 = class QueueProcessor {
    constructor(documentService, geminiService, chromaService) {
        this.documentService = documentService;
        this.geminiService = geminiService;
        this.chromaService = chromaService;
        this.logger = new common_1.Logger(QueueProcessor_1.name);
    }
    async processJob(data) {
        const { documentId, filePath, fileName, mimeType } = data;
        this.logger.log(`Starting document analysis for: ${documentId} (${fileName})`);
        try {
            await this.documentService.updateDocument(documentId, {
                status: 'PROCESSING',
                progress: 15,
            });
            let extractedText = '';
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
            else if (mimeType.startsWith('image/') ||
                mimeType.startsWith('audio/') ||
                mimeType.startsWith('video/')) {
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
            const chunks = this.chunkText(extractedText, 800, 150);
            this.logger.log(`Split document into ${chunks.length} chunks`);
            const embeddings = [];
            const metadatas = [];
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
                                chartType: { type: 'STRING' },
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
            const result = await this.geminiService.generateStructured(analysisPrompt, analysisSchema);
            await this.documentService.updateDocument(documentId, {
                status: 'COMPLETED',
                progress: 100,
                summary: result.summary,
                sentiment: result.sentiment,
                entities: result.entities,
                visualizations: result.visualizations,
            });
            this.logger.log(`Successfully completed background processing for Document: ${documentId}`);
        }
        catch (error) {
            this.logger.error(`Failed to process Document: ${documentId} - Error: ${error.message}`, error.stack);
            await this.documentService.updateDocument(documentId, {
                status: 'FAILED',
                progress: 100,
            });
        }
    }
    chunkText(text, chunkSize = 1000, chunkOverlap = 200) {
        const chunks = [];
        let index = 0;
        while (index < text.length) {
            const chunk = text.substring(index, index + chunkSize);
            chunks.push(chunk);
            index += chunkSize - chunkOverlap;
        }
        return chunks;
    }
};
exports.QueueProcessor = QueueProcessor;
exports.QueueProcessor = QueueProcessor = QueueProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)((0, common_1.forwardRef)(() => document_service_1.DocumentService))),
    __metadata("design:paramtypes", [document_service_1.DocumentService,
        gemini_service_1.GeminiService,
        chroma_service_1.ChromaService])
], QueueProcessor);
let BullQueueConsumer = class BullQueueConsumer {
    constructor(processor) {
        this.processor = processor;
    }
    async handleProcess(job) {
        await this.processor.processJob(job.data);
    }
};
exports.BullQueueConsumer = BullQueueConsumer;
__decorate([
    (0, bull_1.Process)('process'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BullQueueConsumer.prototype, "handleProcess", null);
exports.BullQueueConsumer = BullQueueConsumer = __decorate([
    (0, bull_1.Processor)('document-processing'),
    __metadata("design:paramtypes", [QueueProcessor])
], BullQueueConsumer);
//# sourceMappingURL=processor.service.js.map