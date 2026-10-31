import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/users/client.js';

if (!process.env.USERS_DATABASE_URL)
  throw new Error('USERS_DATABASE_URL não configurada');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.USERS_DATABASE_URL }),
});
try {
  for (const user of [
    { name: 'Ana', email: 'ana@email.com' },
    { name: 'Carlos', email: 'carlos@email.com' },
  ]) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
  }
} finally {
  await prisma.$disconnect();
}
