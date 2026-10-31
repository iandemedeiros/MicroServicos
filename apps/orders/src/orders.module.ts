import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { tcpClient } from '../../../libs/transport/src/clients.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PrismaService } from './prisma.service.js';
@Module({
  imports: [ClientsModule.register([tcpClient('USERS')])],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
})
export class OrdersModule {}
