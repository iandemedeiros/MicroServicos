import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Transport } from '@nestjs/microservices';
import { OrdersModule } from './orders.module.js';
const app = await NestFactory.createMicroservice(OrdersModule, {
  transport: Transport.TCP,
  options: {
    host: process.env.ORDERS_HOST ?? '127.0.0.1',
    port: Number(process.env.ORDERS_PORT ?? 3002),
  },
});
app.enableShutdownHooks();
await app.listen();
