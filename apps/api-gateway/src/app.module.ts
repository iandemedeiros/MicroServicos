import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { tcpClient } from '../../../libs/transport/src/clients.js';
import { UsersController } from './users.controller.js';
import { OrdersController } from './orders.controller.js';
@Module({
  imports: [ClientsModule.register([tcpClient('USERS'), tcpClient('ORDERS')])],
  controllers: [UsersController, OrdersController],
})
export class AppModule {}
