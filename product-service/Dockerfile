# product-service/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias
RUN npm install

# Generar Prisma client
RUN npx prisma generate

# Copiar el resto del código
COPY . .

# Build
RUN npm run build

# ---------- PRODUCTION STAGE ----------
FROM node:20-alpine

WORKDIR /app

# Copiar package.json
COPY --from=builder /app/package*.json ./

# Copiar node_modules completo
COPY --from=builder /app/node_modules ./node_modules

# Copiar build
COPY --from=builder /app/dist ./dist

# Copiar prisma
COPY --from=builder /app/prisma ./prisma

EXPOSE 3002

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]