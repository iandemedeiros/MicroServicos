import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import {
  type CreateUserDto,
  type UpdateUserDto,
  type OrderResponse,
} from '@app/contracts';
import { PrismaService } from './prisma.service.js';
import { rpcRequest } from '../../../libs/transport/src/rpc.js';
@Injectable()
export class UsersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject('ORDERS_SERVICE') private readonly ordersClient: ClientProxy,
  ) {}
  create(data: CreateUserDto) {
    return this.prisma.user.create({ data });
  }
  findAll() {
    return this.prisma.user.findMany({ orderBy: { id: 'asc' } });
  }
  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user)
      throw new RpcException({
        statusCode: 404,
        message: 'Usuário não encontrado',
      });
    return user;
  }
  update(id: number, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }
  async remove(id: number) {
    await this.findOne(id);
    const orders = await rpcRequest<OrderResponse[]>(
      this.ordersClient,
      'orders.findByUser',
      { userId: id },
    );
    if (orders.length)
      throw new RpcException({
        statusCode: 409,
        message: 'Usuário possui pedidos',
      });
    return this.prisma.user.delete({ where: { id } });
  }
}
