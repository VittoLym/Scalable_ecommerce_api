# user-service

Authentication, sessions and user data.

- Registration with email verification, login, refresh token rotation, logout and password reset.
- Refresh tokens are stored hashed in per-device sessions that can be revoked. Access tokens are short-lived JWTs.
- Audit logs for login, registration and account changes. Soft delete for users.
- PostgreSQL through Prisma, Redis, RabbitMQ and SMTP for emails.

## Run

```bash
cp .env.example .env
npm ci
npx prisma generate       # generate the Prisma client
npm run start:dev
```

Default port: `3001`. To run the whole system use `docker compose up --build` from the repository root (see the main [README](../README.md)).

## Tests

```bash
npm test
```

Unit tests cover `AuthService` and `UserService` with mocked Prisma, JWT and email. Defects found while writing them were fixed and are kept as regression tests; remaining ideas are tracked as `it.todo`.