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
var QueueService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueService = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
let QueueService = QueueService_1 = class QueueService {
    constructor(bullQueue) {
        this.bullQueue = bullQueue;
        this.logger = new common_1.Logger(QueueService_1.name);
        this.isRedisAvailable = false;
        this.isRedisAvailable = process.env.REDIS_AVAILABLE === 'true' && !!this.bullQueue;
        this.logger.log(`Queue initialised. Mode: ${this.isRedisAvailable ? 'BullMQ (Redis)' : 'In-Memory Fallback'}`);
    }
    async addJob(name, data, fallbackProcessor) {
        if (this.isRedisAvailable && this.bullQueue) {
            try {
                this.logger.log(`Enqueuing job "${name}" to BullMQ (Redis)...`);
                await this.bullQueue.add('process', data, {
                    attempts: 2,
                    backoff: 5000,
                });
            }
            catch (error) {
                this.logger.warn(`Failed to enqueue to BullMQ: ${error.message}. Falling back to In-Memory...`);
                this.runInMemory(fallbackProcessor);
            }
        }
        else {
            this.logger.log(`Redis not available. Processing job "${name}" in-memory...`);
            this.runInMemory(fallbackProcessor);
        }
    }
    runInMemory(processor) {
        setTimeout(async () => {
            try {
                await processor();
            }
            catch (error) {
                this.logger.error(`Error in In-Memory job execution: ${error.message}`);
            }
        }, 100);
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = QueueService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)((0, bull_1.getQueueToken)('document-processing'))),
    __metadata("design:paramtypes", [Object])
], QueueService);
//# sourceMappingURL=queue.service.js.map