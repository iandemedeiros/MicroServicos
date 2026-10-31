import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { tcpClient } from '../../../libs/transport/src/clients.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { PrismaService } from './prisma.service.js';
@Module({
  imports: [ClientsModule.register([tcpClient('ORDERS')])],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
