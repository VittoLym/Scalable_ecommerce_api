# 🧠 DevsInsights — Scalable E-Commerce Backend

A distributed e-commerce backend designed to explore **real-world scalability challenges**, not just CRUD operations.

This project focuses on building and evolving a **microservices-based system** with practical engineering decisions such as idempotency, event-driven communication, and concurrency-safe inventory handling.

---
   ![CI](https://github.com/VittoLym/Scalable_ecommerce_api/actions/workflows/ci.yml/badge.svg)
---
## 🚀 Architecture Overview

The system is structured into domain-driven services:

* **Gateway** — entry point (HTTP routing & auth validation)
* **User Service** — authentication, sessions, audit logs
* **Product Service** — catalog & inventory management
* **Order Service** — order lifecycle & orchestration
* **Payment Service** — payment processing & callbacks

Each service:

* communicates via HTTP + RabbitMQ
* is containerized with Docker

Data ownership: `user-service`, `product-service` and `order-service` each own a PostgreSQL database (Prisma). The gateway is stateless. `payment-service` has a database provisioned for upcoming payment persistence, but does not use it yet.

---

## ⚙️ Tech Stack

- Node.js / TypeScript, NestJS
- Prisma ORM, PostgreSQL
- RabbitMQ (event-driven communication)
- Redis (shared infra)
- MercadoPago for checkout (a Stripe service exists but is not wired into a module yet)
- Jest (unit tests), GitHub Actions (CI)
- Docker & Docker Compose
---

## ▶️ Getting started

Requires Docker and Docker Compose.

```bash
# 1. Create the env files from the examples
for s in gateway user-service product-service order-service payment-service; do cp $s/.env.example $s/.env; done
# PowerShell: foreach ($s in 'gateway','user-service','product-service','order-service','payment-service') { Copy-Item "$s/.env.example" "$s/.env" }

# 2. Set JWT_SECRET (gateway and user-service must share it) and JWT_REFRESH_SECRET (user-service)

# 3. Start everything
docker compose up --build
```

| Component | URL / port |
|---|---|
| Gateway | http://localhost:3000 |
| user / product / order / payment service | 3001 / 3002 / 3003 / 3004 |
| RabbitMQ management | http://localhost:15672 (guest / guest) |
| PostgreSQL (user / product / order / payment) | 5433 / 5434 / 5435 / 5436 |

Notes:

- Email features (verification, password reset) need real SMTP credentials in `user-service/.env`.
- Payments need MercadoPago credentials and a public `API_URL` (a tunnel such as ngrok when running locally).
- To use a hosted PostgreSQL (for example Neon) instead of the local containers, put its URL in `DATABASE_URL` with `sslmode=require` and run compose with `PGSSLMODE=require`.

---

## 🧩 Key Engineering Concepts

### ✅ Idempotent Order Creation

Prevents duplicate orders during retries or network issues. Known limitation: a race between the lookup and the insert under truly concurrent retries is documented as a pending test (`it.todo`).

### ✅ Product Snapshots in Orders

Orders store product data at purchase time to preserve historical consistency.

### ✅ Session-Based Authentication

Includes refresh tokens, session revocation, audit logs, and device tracking.

### ✅ Concurrency-Safe Inventory Reservation

Stock updates are handled atomically to prevent overselling under high load.

### ✅ Hybrid Communication Model

* HTTP for synchronous flows
* RabbitMQ for async processing

---

## ⚠️ Current Challenges (Intentionally Documented)

This project is not presented as “perfect”, but as an evolving system.

* OrderService acting as a **god service** (being refactored)
* Partial event-driven architecture (RPC vs true events)
* Lack of saga orchestration for checkout flows
* Ongoing improvements in contracts and observability

👉 These are **real problems found in production systems**, and part of the learning process.

---

## 🔧 Recent Improvements

* Fixed **refresh/logout token logic** (session consistency)
* Implemented **atomic stock reservation** to prevent race conditions
* Improved internal consistency of auth flows
* Fixed auth gaps exposed by the user-service unit tests: `/auth/validate` now verifies the JWT and an active session, public registration ignores a client-supplied role, and refresh/logout share the same secret fallback

---

## 🧪 Testing

Unit tests run with Jest and execute on every push through GitHub Actions.

```bash
cd order-service && npm test
cd product-service && npm test
cd user-service && npm test
```

Currently covered:

- **order-service**: idempotent order creation, order status transitions and permissions, payment flows
- **product-service**: atomic stock reservation (conditional update inside a transaction), reservation expiry, input validation
- **user-service**: `AuthService` (login, refresh token rotation, logout, email verification, registration, password reset, token validation) and `UserService`

Known issues found while writing the tests are documented as pending tests (`it.todo`) in `order.service.spec.ts`. The auth defects found in user-service were fixed and kept as regression tests. `payment-service` and the gateway do not have unit tests yet.

---

## 📈 Roadmap

* [ ] Refactor OrderService into modular use-case services
* [ ] Implement Saga pattern for checkout flow
* [ ] Standardize event contracts across services
* [ ] Add structured logging & tracing
* [x] Unit tests and CI for order, product and user services
* [ ] Unit tests for payment-service and the gateway
* [ ] Integration tests with a real PostgreSQL (concurrent stock reservations)
---

## 🧠 Why This Project Exists

Most backend projects stop at CRUD.

This one focuses on:

* scaling concerns
* distributed system tradeoffs
* real-world failure scenarios

---

## 🤖 How I used AI in this project

I want to be transparent about where AI helped and where it did not.

**Written and decided by me**
- The data models and the Prisma setup, including the `adapter-pg` configuration.
- The architecture and the structure of every microservice.
- The business logic in the service layer: order lifecycle, idempotent order creation, atomic stock reservation and the auth/session flows.

**Delegated to AI**
- **ChatGPT**, as a consultant for questions and repetitive tasks. The controllers were generated from the functionality I described for each microservice, because they are repetitive boilerplate. The services behind them are mine.
- **Claude**, to draft the unit tests, the GitHub Actions workflow and parts of the documentation from my existing code.

**How I verified it**
- I reviewed the generated controllers and checked that they do what I specified. Most of them were usable as generated, with small adjustments where needed.
- I ran the unit tests locally and in CI (GitHub Actions) before merging.
- Writing the tests exposed real issues in my own code. I kept them visible as pending tests (`it.todo`) instead of hiding them, and they are tracked in the roadmap.

Agent instructions for this repo are in [`AGENTS.md`](./AGENTS.md).

---

## 📌 Dev Philosophy

> “Building systems that reflect real-world complexity, not tutorial simplicity.”

---

## 🤝 Contributing / Exploring

This is part of an ongoing series of backend experiments and improvements.

Feel free to explore the code, suggest improvements, or fork the project.

---

## 🔗 About

Built and maintained under **DevsInsights**
Focused on systems, automation, and scalable backend architecture.