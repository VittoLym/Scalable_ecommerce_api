# product-service

Product catalog, categories and inventory.

- Stock reservation is a single conditional `updateMany` inside a transaction, so concurrent orders cannot oversell. Reservations expire after 15 minutes.
- PostgreSQL through Prisma, Redis and RabbitMQ.

## Run

```bash
cp .env.example .env
npm ci
npx prisma generate       # generate the Prisma client
npm run start:dev
```

Default port: `3002`. To run the whole system use `docker compose up --build` from the repository root (see the main [README](../README.md)).

## Tests

```bash
npm test
```

Unit tests cover the atomic reservation flow, reservation expiry and input validation. `ProductCategoryService` is not covered yet.