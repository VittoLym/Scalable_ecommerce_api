# payment-service

Payment processing and provider callbacks.

- Creates MercadoPago payment preferences and handles the success and failure callbacks, notifying order-service over RabbitMQ.
- `API_URL` must be reachable from the payment provider, so locally it needs a tunnel (ngrok, cloudflared...).
- A Stripe service exists but is not wired into a module yet. A `payment-db` PostgreSQL container is provisioned for future payment persistence; the service does not use a database today.

## Run

```bash
cp .env.example .env
npm ci
npm run start:dev
```

Default port: `3004`. To run the whole system use `docker compose up --build` from the repository root (see the main [README](../README.md)).

## Tests

No unit tests yet.