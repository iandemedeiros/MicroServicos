import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { connect } from 'amqplib';
import { NotificationsModule } from './notifications.module.js';
import {
  rabbitConfig,
  notificationsTransport,
} from '../../../libs/transport/src/rabbitmq.js';
import { setupRabbitmq } from '../../../libs/transport/src/rabbitmq-topology.js';

const connection = await connect(rabbitConfig().url, { timeout: 5000 });
try {
  const channel = await connection.createChannel();
  try {
    await setupRabbitmq(channel);
  } finally {
    await channel.close();
  }
} finally {
  await connection.close();
}
const app = await NestFactory.createMicroservice(
  NotificationsModule,
  notificationsTransport(),
);
app.enableShutdownHooks();
await app.listen();
