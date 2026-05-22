"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
const express = require("express");
const net = require("net");
async function checkRedis(host = 'localhost', port = 6379) {
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
    const logger = new common_1.Logger('Bootstrap');
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisAlive = await checkRedis(redisHost, redisPort);
    process.env.REDIS_AVAILABLE = redisAlive ? 'true' : 'false';
    logger.log(`Redis connection state checked. Available: ${redisAlive}`);
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });
    app.use(express.json({ limit: '100mb' }));
    app.use(express.urlencoded({ limit: '100mb', extended: true }));
    app.setGlobalPrefix('api/v1');
    const port = process.env.PORT || 5000;
    await app.listen(port);
    logger.log(`Application is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
//# sourceMappingURL=main.js.map