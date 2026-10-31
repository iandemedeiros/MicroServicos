import { Test } from '@nestjs/testing';
import type { INestApplication, INestMicroservice } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import request from 'supertest';
import type { Server, AddressInfo } from 'node:net';
import { UsersController as GatewayController } from '../apps/api-gateway/src/users.controller.js';
import { UsersModule } from '../apps/users/src/users.module.js';
import { PrismaService } from '../apps/users/src/prisma.service.js';

describe('HTTP → TCP → UsersService → Prisma', () => {
  let gateway: INestApplication;
  let users: INestMicroservice;
  const rows = [
    { id: 1, name: 'Ana' },
    { id: 2, name: 'Carlos' },
  ];
  const prisma = {
    user: {
      findMany: vi.fn().mockResolvedValue(rows),
      findUnique: vi.fn(({ where }: { where: { id: number } }) =>
        Promise.resolve(rows.find((u) => u.id === where.id) ?? null),
      ),
    },
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [UsersModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    users = module.createNestMicroservice({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 0 },
    });
    await users.listen();
    const address = users.unwrap<Server>().address() as AddressInfo;
    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: address.port },
    });
    const gatewayModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [{ provide: 'USERS_SERVICE', useValue: client }],
    }).compile();
    gateway = gatewayModule.createNestApplication();
    await gateway.init();
  });

  afterAll(async () => {
    await gateway?.close();
    await users?.close();
  });

  it('lista os usuários por TCP', async () => {
    await request(gateway.getHttpServer())
      .get('/users')
      .expect(200)
      .expect(rows);
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
  });
  it('consulta um usuário por id', async () => {
    await request(gateway.getHttpServer())
      .get('/users/1')
      .expect(200)
      .expect(rows[0]);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });
  it('retorna 404 para usuário ausente', async () => {
    await request(gateway.getHttpServer()).get('/users/999').expect(404);
  });
  it('rejeita id inválido antes de acessar o serviço', async () => {
    prisma.user.findUnique.mockClear();
    await request(gateway.getHttpServer()).get('/users/abc').expect(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
