import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { ClientProxyFactory } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { OrderCreatedEvent } from '../libs/contracts/src/events.js';
import { notificationsTransport } from '../libs/transport/src/rabbitmq.js';

const [orderId, userId, total, eventId] = process.argv.slice(2);
const event = plainToInstance(OrderCreatedEvent, {
  eventId: eventId ?? randomUUID(),
  orderId: Number(orderId),
  userId: Number(userId),
  total,
  occurredAt: new Date().toISOString(),
});
await validateOrReject(event);
const transport = notificationsTransport();
const client = ClientProxyFactory.create({
  ...transport,
  options: { ...transport.options, persistent: true },
});
try {
  await firstValueFrom(client.emit('order.created', event).pipe(timeout(5000)));
  console.log(`Evento de laboratório enviado: ${event.eventId}`);
} finally {
  client.close();
}
