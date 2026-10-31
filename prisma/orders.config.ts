import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'orders/schema.prisma',
  migrations: { path: 'orders/migrations' },
  datasource: {
    url:
      process.env.ORDERS_DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5433/orders_db',
  },
});
