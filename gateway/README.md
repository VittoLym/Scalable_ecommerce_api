# gateway

HTTP entry point of the system.

- Validates the JWT (`JWT_SECRET`, shared with user-service) and proxies requests to the user, product, order and payment services using the `*_SERVICE_URL` variables.
- Category routes (`/products/category/...`) are forwarded to product-service through `CATEGORY_SERVICE_URL`.
- Stateless: it has no database.

## Run

```bash
cp .env.example .env
npm ci
npm run start:dev
```

Default port: `3000`. To run the whole system use `docker compose up --build` from the repository root (see the main [README](../README.md)).

## Tests

No unit tests yet.