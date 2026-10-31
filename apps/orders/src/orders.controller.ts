import { Controller, Inject, UseFilters } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateOrderDto,
  UpdateOrderMessage,
  OrderIdDto,
  OrdersByUserDto,
} from '@app/contracts';
import { dtoPipe } from '../../../libs/transport/src/validation.js';
import { RpcErrorsFilter } from '../../../libs/transport/src/rpc.js';
import { OrdersService } from './orders.service.js';
@Controller()
@UseFilters(RpcErrorsFilter)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly service: OrdersService) {}
  @MessagePattern('orders.create')
  create(@Payload(dtoPipe(CreateOrderDto, true)) dto: CreateOrderDto) {
    return this.service.create(dto);
  }
  @MessagePattern('orders.findAll')
  findAll() {
    return this.service.findAll();
  }
  @MessagePattern('orders.findOne')
  findOne(@Payload(dtoPipe(OrderIdDto, true)) dto: OrderIdDto) {
    return this.service.findOne(dto.id);
  }
  @MessagePattern('orders.update')
  update(@Payload(dtoPipe(UpdateOrderMessage, true)) dto: UpdateOrderMessage) {
    return this.service.update(dto.id, dto.data);
  }
  @MessagePattern('orders.remove')
  remove(@Payload(dtoPipe(OrderIdDto, true)) dto: OrderIdDto) {
    return this.service.remove(dto.id);
  }
  @MessagePattern('orders.findByUser')
  findByUser(@Payload(dtoPipe(OrdersByUserDto, true)) dto: OrdersByUserDto) {
    return this.service.findByUser(dto.userId);
  }
}
