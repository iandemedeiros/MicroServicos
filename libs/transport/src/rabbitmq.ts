import { Transport, type RmqOptions } from '@nestjs/microservices';

export function rabbitConfig() {
  const queue =
    process.env.RABBITMQ_NOTIFICATIONS_QUEUE ?? 'notifications_queue';
  const prefix = queue.replace(/_queue$/, '');
  return {
    url: process.env.RABBITMQ_URL ?? 'amqp://app:app123@localhost:5672',
    queue,
    dlq: `${prefix}_dlq`,
    dlx: `${prefix}.dlx`,
    failedKey: 'notifications.failed',
  };
}

export function notificationQueueOptions() {
  const config = rabbitConfig();
  return {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': config.dlx,
      'x-dead-letter-routing-key': config.failedKey,
    },
  };
}

export function notificationsTransport(): RmqOptions {
  const config = rabbitConfig();
  return {
    transport: Transport.RMQ,
    options: {
      urls: [config.url],
      queue: config.queue,
      queueOptions: notificationQueueOptions(),
      noAck: false,
      prefetchCount: 1,
    },
  };
}
