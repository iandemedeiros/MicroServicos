import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  for (const user of [
    { id: 1, name: 'Ana' },
    { id: 2, name: 'Carlos' },
  ]) {
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: user,
    });
  }
} finally {
  await prisma.$disconnect();
}
