import type { Channel } from 'amqplib';
import { notificationQueueOptions, rabbitConfig } from './rabbitmq.js';

export async function setupRabbitmq(channel: Channel) {
  const config = rabbitConfig();
  await channel.assertExchange(config.dlx, 'direct', { durable: true });
  await channel.assertQueue(config.dlq, { durable: true });
  await channel.bindQueue(config.dlq, config.dlx, config.failedKey);
  await channel.assertQueue(config.queue, notificationQueueOptions());
}
