# Nest Microservices

Monorepo NestJS didático: HTTP → API Gateway → TCP → UsersService → Prisma → PostgreSQL.

- `apps/api-gateway`: HTTP na porta 3000; não acessa o banco.
- `apps/users`: mensagens `users.findAll` e `users.findOne` via TCP na porta 3001; possui o acesso ao Prisma.

## Preparação

Requisitos: Node.js 24, npm e PostgreSQL (ou Docker Compose).

```powershell
npm.cmd install
Copy-Item .env.example .env
docker compose up -d
npm.cmd run prisma:generate
npm.cmd exec prisma migrate deploy
npm.cmd run db:seed
```

Se já houver PostgreSQL disponível, ajuste `DATABASE_URL` em `.env` e dispense Docker. As credenciais do Compose são apenas para desenvolvimento local. O Prisma 6 mantém a API `PrismaService extends PrismaClient` do tutorial. O seed insere Ana e Carlos com IDs 1 e 2, sem duplicar registros nas próximas execuções.

## Executar

Em dois terminais separados na raiz:

```powershell
# Terminal 1
npm.cmd run start:users:dev
```

```powershell
# Terminal 2
npm.cmd run start:dev
```

```powershell
curl.exe http://localhost:3000/users
curl.exe http://localhost:3000/users/1
```

`GET /users` lista os usuários. `GET /users/:id` busca por ID, retorna 400 para ID inválido e 404 para usuário ausente. As mensagens têm limite de espera de cinco segundos. O serviço de usuários não expõe HTTP.

Ajuste `PORT`, `USERS_HOST` e `USERS_PORT` em `.env` se necessário. Nesta execução local, gateway e serviço usam o mesmo endereço TCP.

## Verificar e compilar

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run lint
npm.cmd exec tsc --noEmit
```

Os testes abrem um servidor TCP em porta dinâmica e verificam o fluxo HTTP até o serviço, com Prisma simulado. Não exigem PostgreSQL e não validam conexão real com o banco.

Após compilar, execute `npm.cmd run start:users:prod` e `npm.cmd run start:prod` em terminais separados.

Para evoluir o schema, altere `prisma/schema.prisma` e execute `npm.cmd run db:migrate -- --name nome_da_alteracao`. Versione as migrações geradas.
