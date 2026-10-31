import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  CreateOrderDto,
  UpdateOrderDto,
  OrderIdDto,
  type OrderResponse,
  OrdersByUserDto,
} from '@app/contracts';
import { dtoPipe } from '../../../libs/transport/src/validation.js';
import { httpRequest } from '../../../libs/transport/src/rpc.js';
@Controller('orders')
export class OrdersController {
  constructor(@Inject('ORDERS_SERVICE') private readonly client: ClientProxy) {}
  @Post()
  create(@Body(dtoPipe(CreateOrderDto)) dto: CreateOrderDto) {
    return httpRequest<OrderResponse>(this.client, 'orders.create', dto);
  }
  @Get()
  findAll() {
    return httpRequest<OrderResponse[]>(this.client, 'orders.findAll', {});
  }
  @Get('user/:userId')
  findByUser(@Param(dtoPipe(OrdersByUserDto)) dto: OrdersByUserDto) {
    return this.byUser(dto);
  }
  private byUser(dto: OrdersByUserDto) {
    return httpRequest<OrderResponse[]>(this.client, 'orders.findByUser', dto);
  }
  @Get(':id')
  findOne(@Param(dtoPipe(OrderIdDto)) dto: OrderIdDto) {
    return httpRequest<OrderResponse>(this.client, 'orders.findOne', dto);
  }
  @Patch(':id')
  update(
    @Param(dtoPipe(OrderIdDto)) dto: OrderIdDto,
    @Body(dtoPipe(UpdateOrderDto)) data: UpdateOrderDto,
  ) {
    return httpRequest<OrderResponse>(this.client, 'orders.update', {
      id: dto.id,
      data,
    });
  }
  @Delete(':id')
  remove(@Param(dtoPipe(OrderIdDto)) dto: OrderIdDto) {
    return httpRequest<OrderResponse>(this.client, 'orders.remove', dto);
  }
}
