import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import * as express from 'express';
import * as net from 'net';

async function checkRedis(host = 'localhost', port = 6379): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection(port, host);
    socket.setTimeout(800);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  // Dynamic Redis availability check
  const redisHost = process.env.REDIS_HOST || 'localhost';
  const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisAlive = await checkRedis(redisHost, redisPort);
  
  process.env.REDIS_AVAILABLE = redisAlive ? 'true' : 'false';
  logger.log(`Redis connection state checked. Available: ${redisAlive}`);

  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for frontend requests
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Enable large body payloads for direct file uploads if not using S3 bypass
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Set global API prefix
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 5000;
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
