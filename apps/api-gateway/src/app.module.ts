import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersController } from './users.controller.js';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_SERVICE',
        transport: Transport.TCP,
        options: {
          host: process.env.USERS_HOST ?? '127.0.0.1',
          port: Number(process.env.USERS_PORT ?? 3001),
        },
      },
    ]),
  ],
  controllers: [UsersController],
})
export class AppModule {}
