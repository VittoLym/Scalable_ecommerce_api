# AGENTS.md

Instructions for AI coding agents working in this repository. Humans can read it too.

## Project overview

Microservices e-commerce backend built with NestJS and TypeScript. Each service owns its own PostgreSQL database (Prisma) and communicates over HTTP and RabbitMQ.

| Folder | Responsibility |
|---|---|
| `gateway/` | HTTP entry point, routing and auth validation |
| `user-service/` | Authentication, sessions, refresh tokens, audit logs |
| `product-service/` | Catalog and inventory, atomic stock reservation |
| `order-service/` | Order lifecycle and orchestration |
| `payment-service/` | Payment processing and callbacks |

## Commands

Run these inside the service folder you are working on.

```bash
npm ci                    # install dependencies
npx prisma generate       # generate the Prisma client
npm run start:dev         # run in watch mode
npm test                  # unit tests (Jest)
npm run lint
```

From the repository root: `docker compose up --build` starts the infrastructure and services.

All five services expose `start:dev`, `lint` and `test`.

## Conventions

- Business logic lives in `*.service.ts`. Controllers stay thin: validate the DTO, call the service, return the result.
- DTOs use `class-validator` and `class-transformer`.
- Messaging uses `@nestjs/microservices` with RabbitMQ. Existing message names follow the pattern `domain.action`, for example `order.created`, `payment.processed`, `inventory.check` and `stock.reserved`. Reuse that pattern.
- Tests are Jest `*.spec.ts` files next to the code they test. Mock `PrismaService` and `EventsService`; do not hit a real database in unit tests.
- Commits follow Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `ci:`.

## Rules for agents

Do:
- Run `npm test` in the affected service before proposing a change.
- Add or update tests for any behavior you change.
- Keep changes small and explain the reasoning in the commit message.

Ask first:
- Any change to `schema.prisma` or database migrations.
- Any change to message names or payloads shared between services.
- Adding a new dependency.

Do not:
- Commit `.env` files or any secret.
- Replace the stock reservation in `product-service` with a read-then-write flow. It must stay a single conditional `updateMany` inside a transaction, because that is what prevents overselling.
- Delete or silence `it.todo` and `it.failing` tests. They document known issues. When the underlying bug is fixed, turn the test into a regular one instead of deleting it.

## Known issues

Documented as pending tests in `order-service/src/order.service.spec.ts`: client-supplied prices used for totals, idempotency race condition, orders created without in-stock items, CSV export, ownership checks in `addItems` and `updateShippingAddress`, and soft-deleted orders still being returned.

In `user-service`, the auth gaps found by the unit tests (token validation in `/auth/validate`, client-supplied role on public registration, refresh/login secret mismatch, null password hashes and soft-deleted users in `validateUser`) were fixed and are covered by regression tests. Some `it.todo` entries remain in `auth.service.spec.ts` and `user.service.spec.ts`.

## Division of work

The architecture, data models and service-layer business logic are written and owned by the maintainer. Agents may help with repetitive boilerplate (controllers, DTOs), tests and documentation, and all agent output must be reviewed before merging.