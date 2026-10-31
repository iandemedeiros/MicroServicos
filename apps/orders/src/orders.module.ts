import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { tcpClient } from '../../../libs/transport/src/clients.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { PrismaService } from './prisma.service.js';
import { ScheduleModule } from '@nestjs/schedule';
import { OutboxPublisher } from './outbox.publisher.js';
import { RabbitPublisher } from './rabbit.publisher.js';
@Module({
  imports: [
    ScheduleModule.forRoot(),
    ClientsModule.register([tcpClient('USERS')]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService, OutboxPublisher, RabbitPublisher],
})
export class OrdersModule {}
