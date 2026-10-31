import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'notifications/schema.prisma',
  migrations: { path: 'notifications/migrations' },
  datasource: {
    url:
      process.env.NOTIFICATIONS_DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5434/notifications_db',
  },
});
