# NestJS Microservices — Parte 2

Monorepo com API Gateway HTTP (3000), Users TCP (3001) e Orders TCP (3002). Cada serviço possui seu próprio PostgreSQL, schema e client Prisma 7. Orders consulta Users por TCP antes de criar pedidos ou alterar seu usuário.

Os contratos ficam em `libs/contracts`, importados por `@app/contracts`. Validação, clientes TCP e tradução de erros ficam em `libs/transport`; nenhuma dessas bibliotecas acessa bancos.

## Preparação

Requisitos: Node.js 24, npm e Docker Compose, ou dois bancos PostgreSQL existentes.

```powershell
npm.cmd install
Copy-Item .env.example .env
# Ajuste as URLs se usar bancos existentes.
docker compose up -d
npm.cmd run prisma:generate
npm.cmd run db:deploy
npm.cmd run db:seed
```

O Compose cria Users em `localhost:5432/users_db` e Orders em `localhost:5433/orders_db`. São instâncias e volumes separados. O volume de Users desta parte é novo; os dados e o volume da Parte 1 não são apagados nem migrados automaticamente. Não sobrescreva um `.env` existente sem preservar suas configurações.

Os arquivos de configuração Prisma usam caminhos relativos à pasta `prisma`, onde estão localizados. URLs são carregadas de `USERS_DATABASE_URL` e `ORDERS_DATABASE_URL`; as configurações da CLI possuem valores locais padrão para permitir geração sem banco. Os processos exigem as variáveis correspondentes.

O seed usa emails únicos, preserva registros existentes e deixa o banco gerar IDs. Consulte `GET /users` para obter os IDs reais.

## Executar

Execute cada comando em um terminal separado:

```powershell
npm.cmd run start:users:dev
npm.cmd run start:orders:dev
npm.cmd run start:dev
```

Os scripts usam `tsx` para resolver contratos compartilhados em desenvolvimento. Os pipes declaram explicitamente os DTOs, garantindo validação mesmo sem metadados de tipos emitidos pelo executor. O build usa TypeScript e reescreve os aliases para imports relativos compatíveis com Node ESM.

Para compilar e executar os arquivos JavaScript:

```powershell
npm.cmd run build
# Em três terminais:
npm.cmd run start:users:prod
npm.cmd run start:orders:prod
npm.cmd run start:prod
```

## Rotas

| Método | Rota | Operação |
| --- | --- | --- |
| POST | `/users` | Criar usuário: `name`, `email` |
| GET | `/users` | Listar usuários |
| GET | `/users/:id` | Buscar usuário |
| PATCH | `/users/:id` | Atualizar `name` e/ou `email` |
| DELETE | `/users/:id` | Excluir usuário sem pedidos |
| POST | `/orders` | Criar pedido: `userId`, `description`, `total` |
| GET | `/orders` | Listar pedidos |
| GET | `/orders/user/:userId` | Listar pedidos de um usuário |
| GET | `/orders/:id` | Buscar pedido |
| PATCH | `/orders/:id` | Atualizar `userId`, `description` e/ou `total` |
| DELETE | `/orders/:id` | Excluir pedido |

Exemplo com PowerShell:

```powershell
$user = Invoke-RestMethod http://localhost:3000/users -Method Post -ContentType 'application/json' -Body '{"name":"Maria","email":"maria@email.com"}'
$body = @{ userId = $user.id; description = 'Notebook'; total = 4500 } | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/orders -Method Post -ContentType 'application/json' -Body $body
```

Nome e descrição exigem ao menos três caracteres. Email deve ser válido e único. IDs são inteiros positivos. O total exige duas casas decimais no máximo e fica entre 0,01 e 99.999.999,99. O Prisma serializa Decimal como string na resposta real; o DTO recebe number conforme o tutorial. Campos extras e valores nulos nos campos de atualização são rejeitados.

## Mensagens e erros

Cada domínio expõe `create`, `findAll`, `findOne`, `update` e `remove`, por exemplo `users.create`. Orders também expõe `orders.findByUser`.

- Criação recebe o DTO diretamente.
- Busca e exclusão recebem `{ id: 1 }`.
- Atualização recebe `{ id: 1, data: { ... } }`, com validação do DTO aninhado.
- Listagem recebe `{}`; busca de pedidos por usuário recebe `{ userId: 1 }`.

As fronteiras HTTP e TCP validam os dados. O filtro RPC padroniza `{ statusCode, message }`: validação/usuário inválido 400, registro ausente 404, email duplicado/usuário com pedidos 409, indisponibilidade 503 e timeout 504. Falhas internas retornam mensagem genérica 500. O Gateway aguarda até cinco segundos; chamadas entre serviços aguardam três segundos.

A exclusão de usuário consulta Orders e falha se houver pedidos ou se Orders estiver indisponível. Essa checagem é didática: não é uma transação distribuída e pode disputar com uma criação concorrente de pedido. Garantia estrita de integridade entre bancos exige protocolo adicional. Não há cascade ou chave estrangeira entre serviços.

## Verificação e migrações

```powershell
npm.cmd test
npm.cmd run test:e2e
npm.cmd run lint
npm.cmd exec tsc --noEmit
```

Os testes de integração usam HTTP real e dois servidores TCP em portas dinâmicas, com persistência simulada. Verificam CRUD, validação nas duas fronteiras, erros RPC, usuário inexistente e bloqueio da exclusão com pedidos. Testes adicionais verificam timeout e indisponibilidade. Não substituem a verificação com PostgreSQL real.

Para evoluir cada schema:

```powershell
npm.cmd run db:migrate:users -- --name alter_users
npm.cmd run db:migrate:orders -- --name alter_orders
npm.cmd run prisma:generate
```

`db:deploy` aplica as migrações versionadas nos dois bancos. A migração antiga da Parte 1 permanece em `prisma/migrations` apenas como histórico; as configurações atuais usam `prisma/users/migrations` e `prisma/orders/migrations`.

RabbitMQ, notificações, autenticação e circuit breakers ficam para as próximas etapas.
