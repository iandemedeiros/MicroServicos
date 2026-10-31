import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/users/client.js';
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.USERS_DATABASE_URL;
    if (!connectionString)
      throw new Error('USERS_DATABASE_URL não configurada');
    super({ adapter: new PrismaPg({ connectionString }) });
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
