import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { connect } from 'amqplib';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as OrdersPrisma } from '../dist/generated/orders/client.js';
import { PrismaClient as NotificationsPrisma } from '../dist/generated/notifications/client.js';
import { OrdersService } from '../dist/apps/orders/src/orders.service.js';
import { NotificationsService } from '../dist/apps/notifications/src/notifications.service.js';
import { of } from 'rxjs';

// Explicit opt-in test: requires migrated local databases and RabbitMQ.
const suffix = randomUUID();
const queue = `test_${suffix}_queue`;
const dlq = `test_${suffix}_dlq`;
const dlx = `test_${suffix}.dlx`;
const freePort = async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return String(port);
};
const env = {
  ...process.env,
  USERS_DATABASE_URL:
    process.env.USERS_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/users_db',
  ORDERS_DATABASE_URL:
    process.env.ORDERS_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5433/orders_db',
  NOTIFICATIONS_DATABASE_URL:
    process.env.NOTIFICATIONS_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5434/notifications_db',
  RABBITMQ_URL: process.env.RABBITMQ_URL ?? 'amqp://app:app123@localhost:5672',
  RABBITMQ_NOTIFICATIONS_QUEUE: queue,
  NOTIFICATIONS_SIMULATE_FAILURE: 'true',
  PORT: await freePort(),
  USERS_PORT: await freePort(),
  ORDERS_PORT: await freePort(),
  USERS_HOST: '127.0.0.1',
  ORDERS_HOST: '127.0.0.1',
};
const ordersDb = new OrdersPrisma({
  adapter: new PrismaPg({ connectionString: env.ORDERS_DATABASE_URL }),
});
const notificationsDb = new NotificationsPrisma({
  adapter: new PrismaPg({ connectionString: env.NOTIFICATIONS_DATABASE_URL }),
});
const children = [];
let logs = '';
let connection;
let channel;
let userId;
const eventIds = [];
const orderIds = [];
const start = (app, overrides = {}) => {
  const child = spawn(process.execPath, [`dist/apps/${app}/src/main.js`], {
    env: { ...env, ...overrides },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (data) => {
    logs += data;
  });
  child.stderr.on('data', (data) => {
    logs += data;
  });
  children.push(child);
  return child;
};
const stop = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await closed;
};
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const until = async (check, label) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await pause(200);
  }
  throw new Error(`Prazo excedido: ${label}\n${logs.slice(-6000)}`);
};
const http = async (route, method = 'GET', body, status = 200) => {
  const result = await fetch(`http://127.0.0.1:${env.PORT}${route}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await result.json();
  assert.equal(result.status, status, JSON.stringify(data));
  return data;
};
const publish = async (event) =>
  new Promise((resolve, reject) => {
    channel.sendToQueue(
      queue,
      Buffer.from(JSON.stringify({ pattern: 'order.created', data: event })),
      { persistent: true, messageId: event.eventId },
      (error) => (error ? reject(error) : resolve()),
    );
  });

try {
  assert.equal(
    await ordersDb.outboxEvent.count({ where: { publishedAt: null } }),
    0,
    'Execute este teste em bancos locais sem eventos pendentes e sem outras instâncias Orders ativas',
  );
  connection = await connect(env.RABBITMQ_URL, { timeout: 5000 });
  channel = await connection.createConfirmChannel();
  start('users');
  let ordersWorker = start('orders', {
    RABBITMQ_URL: `amqp://app:app123@127.0.0.1:${await freePort()}`,
  });
  start('api-gateway');
  await until(async () => {
    try {
      await http('/users');
      await http('/orders');
      return true;
    } catch {
      return false;
    }
  }, 'aplicações TCP/HTTP');
  const user = await http(
    '/users',
    'POST',
    { name: 'Messaging Test', email: `test-${suffix}@example.com` },
    201,
  );
  userId = user.id;

  // Inject an outbox write failure while using a genuine Prisma transaction.
  const service = new OrdersService(
    {
      $transaction: (callback) =>
        ordersDb.$transaction((tx) =>
          callback({
            order: tx.order,
            outboxEvent: {
              create: async () => {
                throw new Error('outbox write failed');
              },
            },
          }),
        ),
    },
    { send: () => of(user) },
  );
  const description = `rollback-${suffix}`;
  await assert.rejects(
    service.create({ userId, description, total: 1 }),
    /outbox write failed/,
  );
  assert.equal(await ordersDb.order.count({ where: { description } }), 0);

  // The consumer is offline; HTTP still succeeds and RabbitMQ stores the event.
  const order = await http(
    '/orders',
    'POST',
    { userId, description: `Notebook ${suffix}`, total: 4500.25 },
    201,
  );
  orderIds.push(order.id);
  const row = await ordersDb.outboxEvent.findFirstOrThrow({
    where: { payload: { path: ['orderId'], equals: order.id } },
  });
  eventIds.push(row.id);
  await until(
    async () => logs.includes(`Evento ${row.id} permanece pendente`),
    'falha do broker sem perda do pedido',
  );
  assert.equal(
    (await ordersDb.outboxEvent.findUniqueOrThrow({ where: { id: row.id } }))
      .publishedAt,
    null,
  );
  await stop(ordersWorker);
  ordersWorker = start('orders');
  await until(
    async () =>
      Boolean(
        (await ordersDb.outboxEvent.findUnique({ where: { id: row.id } }))
          .publishedAt,
      ),
    'publicação confirmada',
  );
  assert.equal((await channel.checkQueue(queue)).messageCount, 1);
  let worker = start('notifications');
  await until(
    async () =>
      Boolean(
        await notificationsDb.notification.findUnique({
          where: { eventId: row.id },
        }),
      ),
    'consumo e persistência',
  );
  assert.equal(
    (
      await notificationsDb.notification.findUniqueOrThrow({
        where: { eventId: row.id },
      })
    ).total.toString(),
    '4500.25',
  );

  // Restart the process before replaying the same event; deduplication survives.
  await stop(worker);
  worker = start('notifications');
  await publish(row.payload);
  await until(async () => {
    const state = await channel.checkQueue(queue);
    return state.consumerCount === 1 && state.messageCount === 0;
  }, 'reentrega após reinício');
  assert.equal(
    await notificationsDb.notification.count({ where: { eventId: row.id } }),
    1,
  );
  const notificationService = new NotificationsService(notificationsDb);
  const duplicate = await Promise.all([
    notificationService.sendOrderNotification(row.payload),
    notificationService.sendOrderNotification(row.payload),
  ]);
  assert.ok(duplicate.every((result) => result.duplicate));

  // A new event delivered concurrently also produces exactly one database effect.
  const concurrent = { ...row.payload, eventId: randomUUID() };
  eventIds.push(concurrent.eventId);
  const outcomes = await Promise.all([
    notificationService.sendOrderNotification(concurrent),
    notificationService.sendOrderNotification(concurrent),
  ]);
  assert.equal(outcomes.filter((result) => !result.duplicate).length, 1);
  assert.equal(
    await notificationsDb.notification.count({
      where: { eventId: concurrent.eventId },
    }),
    1,
  );

  const failure = await http(
    '/orders',
    'POST',
    { userId, description: 'Simulated failure', total: 9999 },
    201,
  );
  orderIds.push(failure.id);
  const failureEvent = await ordersDb.outboxEvent.findFirstOrThrow({
    where: { payload: { path: ['orderId'], equals: failure.id } },
  });
  eventIds.push(failureEvent.id);
  await until(
    async () => (await channel.checkQueue(dlq)).messageCount === 1,
    'NACK e DLQ',
  );
  assert.equal(
    await notificationsDb.processedEvent.count({
      where: { eventId: failureEvent.id },
    }),
    0,
  );
  assert.equal(
    await notificationsDb.notification.count({
      where: { eventId: failureEvent.id },
    }),
    0,
  );

  // Simulated failure is opt-in. Replaying the preserved event after repair works.
  await stop(worker);
  start('notifications', { NOTIFICATIONS_SIMULATE_FAILURE: 'false' });
  const dead = await channel.get(dlq, { noAck: false });
  assert.ok(dead);
  await publish(JSON.parse(dead.content.toString()).data);
  channel.ack(dead);
  await until(
    async () =>
      Boolean(
        await notificationsDb.notification.findUnique({
          where: { eventId: failureEvent.id },
        }),
      ),
    'reprocessamento da DLQ',
  );
  console.log(
    'OK: rollback pedido/outbox; criação com broker indisponível e recuperação; publicação confirmada com consumidor offline; ACK; deduplicação após restart e sob concorrência; NACK/DLQ e reprocessamento.',
  );
} finally {
  await Promise.all(children.map(stop));
  await ordersDb.outboxEvent.deleteMany({ where: { id: { in: eventIds } } });
  await ordersDb.order.deleteMany({ where: { id: { in: orderIds } } });
  await notificationsDb.notification.deleteMany({
    where: { eventId: { in: eventIds } },
  });
  await notificationsDb.processedEvent.deleteMany({
    where: { eventId: { in: eventIds } },
  });
  // Only records and broker resources created by this isolated run are removed.
  if (userId) {
    const { PrismaClient: UsersPrisma } =
      await import('../dist/generated/users/client.js');
    const usersDb = new UsersPrisma({
      adapter: new PrismaPg({ connectionString: env.USERS_DATABASE_URL }),
    });
    try {
      await usersDb.user.delete({ where: { id: userId } });
    } finally {
      await usersDb.$disconnect();
    }
  }
  if (channel) {
    await channel.deleteQueue(queue).catch(() => {});
    await channel.deleteQueue(dlq).catch(() => {});
    await channel.deleteExchange(dlx).catch(() => {});
    await channel.close().catch(() => {});
  }
  await connection?.close();
  await ordersDb.$disconnect();
  await notificationsDb.$disconnect();
}
