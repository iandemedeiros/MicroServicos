import { Test } from '@nestjs/testing';
import type { INestApplication, INestMicroservice } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import request from 'supertest';
import type { Server, AddressInfo } from 'node:net';
import { UsersController } from '../apps/api-gateway/src/users.controller.js';
import { OrdersController } from '../apps/api-gateway/src/orders.controller.js';
import { UsersModule } from '../apps/users/src/users.module.js';
import { OrdersModule } from '../apps/orders/src/orders.module.js';
import { PrismaService as UsersPrisma } from '../apps/users/src/prisma.service.js';
import { PrismaService as OrdersPrisma } from '../apps/orders/src/prisma.service.js';
import { firstValueFrom } from 'rxjs';
import { OutboxPublisher } from '../apps/orders/src/outbox.publisher.js';

function memoryModel() {
  const rows: Record<string, unknown>[] = [];
  let nextId = 1;
  const missing = () => Object.assign(new Error('missing'), { code: 'P2025' });
  return {
    rows,
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      if (data.email && rows.some((r) => r.email === data.email))
        throw Object.assign(new Error('duplicate'), { code: 'P2002' });
      const row = {
        id: nextId++,
        createdAt: new Date().toISOString(),
        ...data,
      };
      rows.push(row);
      return row;
    }),
    findMany: vi.fn(async ({ where }: { where?: { userId: number } } = {}) =>
      rows.filter((r) => !where || r.userId === where.userId),
    ),
    findUnique: vi.fn(
      async ({ where }: { where: { id: number } }) =>
        rows.find((r) => r.id === where.id) ?? null,
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw missing();
        Object.assign(
          row,
          Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          ),
        );
        return row;
      },
    ),
    delete: vi.fn(async ({ where }: { where: { id: number } }) => {
      const i = rows.findIndex((r) => r.id === where.id);
      if (i < 0) throw missing();
      return rows.splice(i, 1)[0];
    }),
  };
}

describe('Gateway → Users / Orders → Users via TCP', () => {
  let gateway: INestApplication;
  let users: INestMicroservice;
  let orders: INestMicroservice;
  let usersClient: ClientProxy;
  let ordersClient: ClientProxy;
  const user = memoryModel();
  const order = memoryModel();
  const outboxEvent = { create: vi.fn().mockResolvedValue({}) };
  const client = (app: INestMicroservice) =>
    ClientProxyFactory.create({
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: (app.unwrap<Server>().address() as AddressInfo).port,
      },
    });
  beforeAll(async () => {
    const u = await Test.createTestingModule({ imports: [UsersModule] })
      .overrideProvider(UsersPrisma)
      .useValue({ user })
      .overrideProvider('ORDERS_SERVICE')
      .useValue({
        send: (pattern: string, payload: unknown) =>
          ordersClient.send(pattern, payload),
      })
      .compile();
    users = u.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await users.listen();
    usersClient = client(users);
    const o = await Test.createTestingModule({ imports: [OrdersModule] })
      .overrideProvider(OrdersPrisma)
      .useValue({
        order,
        $transaction: (callback: (tx: unknown) => unknown) =>
          callback({ order, outboxEvent }),
      })
      .overrideProvider(OutboxPublisher)
      .useValue({})
      .overrideProvider('USERS_SERVICE')
      .useValue(usersClient)
      .compile();
    orders = o.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await orders.listen();
    ordersClient = client(orders);
    const g = await Test.createTestingModule({
      controllers: [UsersController, OrdersController],
      providers: [
        { provide: 'USERS_SERVICE', useValue: usersClient },
        { provide: 'ORDERS_SERVICE', useValue: ordersClient },
      ],
    }).compile();
    gateway = g.createNestApplication();
    await gateway.init();
  });
  afterAll(async () => {
    await gateway?.close();
    usersClient?.close();
    ordersClient?.close();
    await orders?.close();
    await users?.close();
  });
  const http = () => request(gateway.getHttpServer());
  it('valida DTO HTTP e rejeita campos extras', async () => {
    await http()
      .post('/users')
      .send({ name: 'A', email: 'invalid' })
      .expect(400);
    await http()
      .post('/users')
      .send({ name: 'Ana', email: 'ana@email.com', admin: true })
      .expect(400);
    expect(user.create).not.toHaveBeenCalled();
  });
  it('valida DTO em chamadas TCP diretas', async () => {
    await expect(
      firstValueFrom(
        usersClient.send('users.create', { name: 'A', email: 'invalid' }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      firstValueFrom(
        usersClient.send('users.update', { id: 1, data: { email: 'invalid' } }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      firstValueFrom(
        ordersClient.send('orders.create', {
          userId: 1,
          description: 'Notebook',
          total: 1.234,
        }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('cria, lista, busca e atualiza usuários', async () => {
    await http()
      .post('/users')
      .send({ name: 'Ana', email: 'ana@email.com' })
      .expect(201);
    const all = await http().get('/users').expect(200);
    expect(all.body).toHaveLength(1);
    await http().get('/users/1').expect(200);
    const updated = await http()
      .patch('/users/1')
      .send({ name: 'Ana Maria' })
      .expect(200);
    expect(updated.body.name).toBe('Ana Maria');
  });
  it('traduz email duplicado e registros ausentes', async () => {
    await http()
      .post('/users')
      .send({ name: 'Ana', email: 'ana@email.com' })
      .expect(409);
    await http().get('/users/999').expect(404);
    await http().patch('/users/999').send({ name: 'Maria' }).expect(404);
    await http().delete('/users/999').expect(404);
  });
  it('rejeita IDs inválidos', async () => {
    await http().get('/users/abc').expect(400);
    await http().get('/users/0').expect(400);
    await http().get('/orders/-1').expect(400);
  });
  it('não persiste pedido de usuário inexistente', async () => {
    await http()
      .post('/orders')
      .send({ userId: 999, description: 'Notebook', total: 4500 })
      .expect(400);
    expect(order.create).not.toHaveBeenCalled();
  });
  it('cria pedido consultando Users e lista por usuário', async () => {
    await http()
      .post('/orders')
      .send({ userId: 1, description: 'Notebook', total: 4500 })
      .expect(201);
    expect(user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
    const all = await http().get('/orders').expect(200);
    expect(all.body).toHaveLength(1);
    await http().get('/orders/1').expect(200);
    const byUser = await http().get('/orders/user/1').expect(200);
    expect(byUser.body).toHaveLength(1);
  });
  it('bloqueia exclusão de usuário com pedidos', async () => {
    await http().delete('/users/1').expect(409);
    expect(user.delete).not.toHaveBeenCalled();
  });
  it('valida atualização de pedidos e novos usuários', async () => {
    await http().patch('/orders/1').send({ total: 0 }).expect(400);
    await http().patch('/orders/1').send({ userId: 999 }).expect(400);
    const result = await http()
      .patch('/orders/1')
      .send({ description: 'Notebook novo', total: 4000 })
      .expect(200);
    expect(result.body.total).toBe(4000);
  });
  it('remove pedido, permite excluir usuário e traduz pedido ausente', async () => {
    await http().delete('/orders/1').expect(200);
    await http().get('/orders/1').expect(404);
    await http().delete('/orders/999').expect(404);
    await http().delete('/users/1').expect(200);
  });
});
