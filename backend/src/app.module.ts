import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { DocumentController } from './modules/document/document.controller';
import { DocumentService } from './modules/document/document.service';
import { GeminiService } from './modules/ai/gemini.service';
import { ChromaService } from './modules/vector/chroma.service';
import { QueueService } from './modules/queue/queue.service';
import { QueueProcessor, BullQueueConsumer } from './modules/queue/processor.service';

// Dynamically construct imports and providers based on Redis availability check
const dynamicImports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
  }),
];

const dynamicProviders: any[] = [
  DocumentService,
  GeminiService,
  ChromaService,
  QueueService,
  QueueProcessor,
];

if (process.env.REDIS_AVAILABLE === 'true') {
  dynamicImports.push(
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'document-processing',
    })
  );
  dynamicProviders.push(BullQueueConsumer);
}

@Module({
  imports: dynamicImports,
  controllers: [DocumentController],
  providers: dynamicProviders,
})
export class AppModule {}
