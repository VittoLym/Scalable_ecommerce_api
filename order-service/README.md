# order-service

Order lifecycle and orchestration.

- Idempotent order creation, product snapshots stored with each order, status transitions and permissions.
- Talks to user-service and product-service (`USER_SERVICE_URL`, `PRODUCT_SERVICE_URL`) and listens to payment events over RabbitMQ.
- PostgreSQL through Prisma.

## Run

```bash
cp .env.example .env
npm ci
npx prisma generate       # generate the Prisma client
npm run start:dev
```

Default port: `3003`. To run the whole system use `docker compose up --build` from the repository root (see the main [README](../README.md)).

## Tests

```bash
npm test
```

Known issues found by the tests (client-supplied prices, idempotency race, ownership checks, soft-deleted orders) are documented as `it.todo` / `it.failing` in `src/order.service.spec.ts`.