import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  type CreateOrderDto,
  type UpdateOrderDto,
  type UserResponse,
} from '@app/contracts';
import { PrismaService } from './prisma.service.js';
import { rpcRequest, remoteError } from '../../../libs/transport/src/rpc.js';
import { randomUUID } from 'node:crypto';
import type { OrderCreatedEvent } from '@app/contracts';
@Injectable()
export class OrdersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('USERS_SERVICE') private readonly usersClient: ClientProxy,
  ) {}
  private async requireUser(id: number) {
    try {
      await rpcRequest<UserResponse>(this.usersClient, 'users.findOne', { id });
    } catch (error) {
      const remote = remoteError(
        error instanceof RpcException ? error.getError() : error,
      );
      if (remote.statusCode === 404)
        throw new RpcException({
          statusCode: 400,
          message: 'Usuário inválido',
        });
      throw error;
    }
  }
  async create(data: CreateOrderDto) {
    await this.requireUser(data.userId);
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data });
      const event: OrderCreatedEvent = {
        eventId: randomUUID(),
        orderId: order.id,
        userId: order.userId,
        total: order.total.toString(),
        occurredAt: new Date().toISOString(),
      };
      await tx.outboxEvent.create({
        data: {
          id: event.eventId,
          eventType: 'order.created',
          payload: {
            eventId: event.eventId,
            orderId: event.orderId,
            userId: event.userId,
            total: event.total,
            occurredAt: event.occurredAt,
          },
        },
      });
      return order;
    });
  }
  findAll() {
    return this.prisma.order.findMany({ orderBy: { id: 'asc' } });
  }
  findByUser(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    });
  }
  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order)
      throw new RpcException({
        statusCode: 404,
        message: 'Pedido não encontrado',
      });
    return order;
  }
  async update(id: number, data: UpdateOrderDto) {
    await this.findOne(id);
    if (data.userId !== undefined) await this.requireUser(data.userId);
    return this.prisma.order.update({ where: { id }, data });
  }
  remove(id: number) {
    return this.prisma.order.delete({ where: { id } });
  }
}
