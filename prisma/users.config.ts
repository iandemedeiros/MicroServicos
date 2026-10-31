import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'users/schema.prisma',
  migrations: { path: 'users/migrations' },
  datasource: {
    url:
      process.env.USERS_DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/users_db',
  },
});
