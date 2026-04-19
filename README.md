# 🧠 DevsInsights — Scalable E-Commerce Backend

A distributed e-commerce backend designed to explore **real-world scalability challenges**, not just CRUD operations.

This project focuses on building and evolving a **microservices-based system** with practical engineering decisions such as idempotency, event-driven communication, and concurrency-safe inventory handling.

---

## 🚀 Architecture Overview

The system is structured into domain-driven services:

* **Gateway** — entry point (HTTP routing & auth validation)
* **User Service** — authentication, sessions, audit logs
* **Product Service** — catalog & inventory management
* **Order Service** — order lifecycle & orchestration
* **Payment Service** — payment processing & callbacks

Each service:

* owns its own database
* communicates via HTTP + RabbitMQ
* is containerized with Docker

---

## ⚙️ Tech Stack

* Node.js / TypeScript
* Prisma ORM
* RabbitMQ (event-driven communication)
* Redis (shared infra)
* Docker & Docker Compose

---

## 🧩 Key Engineering Concepts

### ✅ Idempotent Order Creation

Prevents duplicate orders during retries or network issues.

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

---

## 📈 Roadmap

* [ ] Refactor OrderService into modular use-case services
* [ ] Implement Saga pattern for checkout flow
* [ ] Standardize event contracts across services
* [ ] Add structured logging & tracing
* [ ] Improve test coverage (integration tests)

---

## 🧠 Why This Project Exists

Most backend projects stop at CRUD.

This one focuses on:

* scaling concerns
* distributed system tradeoffs
* real-world failure scenarios

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
