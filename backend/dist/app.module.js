"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bull_1 = require("@nestjs/bull");
const document_controller_1 = require("./modules/document/document.controller");
const document_service_1 = require("./modules/document/document.service");
const gemini_service_1 = require("./modules/ai/gemini.service");
const chroma_service_1 = require("./modules/vector/chroma.service");
const queue_service_1 = require("./modules/queue/queue.service");
const processor_service_1 = require("./modules/queue/processor.service");
const dynamicImports = [
    config_1.ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env',
    }),
];
const dynamicProviders = [
    document_service_1.DocumentService,
    gemini_service_1.GeminiService,
    chroma_service_1.ChromaService,
    queue_service_1.QueueService,
    processor_service_1.QueueProcessor,
];
if (process.env.REDIS_AVAILABLE === 'true') {
    dynamicImports.push(bull_1.BullModule.forRootAsync({
        imports: [config_1.ConfigModule],
        useFactory: async (configService) => ({
            redis: {
                host: configService.get('REDIS_HOST', 'localhost'),
                port: configService.get('REDIS_PORT', 6379),
            },
        }),
        inject: [config_1.ConfigService],
    }), bull_1.BullModule.registerQueue({
        name: 'document-processing',
    }));
    dynamicProviders.push(processor_service_1.BullQueueConsumer);
}
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: dynamicImports,
        controllers: [document_controller_1.DocumentController],
        providers: dynamicProviders,
    })
], AppModule);
//# sourceMappingURL=app.module.js.map