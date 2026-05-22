import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class GeminiService implements OnModuleInit {
    private configService;
    private readonly logger;
    private ai;
    private apiKey;
    constructor(configService: ConfigService);
    onModuleInit(): void;
    generateText(prompt: string, model?: string): Promise<string>;
    generateStructured<T>(prompt: string, schema: any, model?: string): Promise<T>;
    getEmbeddings(text: string): Promise<number[]>;
    private getMockEmbeddings;
    analyzeMediaFile(filePath: string, mimeType: string, prompt: string, model?: string): Promise<string>;
}
