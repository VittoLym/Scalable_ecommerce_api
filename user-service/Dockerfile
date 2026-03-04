# user-service/Dockerfile (CORREGIDO)
FROM node:20-alpine AS builder

# Instalar git solo en builder (necesario para algunas dependencias)
RUN apk add --no-cache git

WORKDIR /app

# Copiar package files
COPY package*.json ./
COPY prisma ./prisma/

# Instalar TODAS las dependencias (incluyendo dev)
RUN npm install

# Generar Prisma client
RUN npx prisma generate

# Copiar el resto del código
COPY . .

# Build de la aplicación
RUN npm run build

RUN echo "🏗️  Resultado del build:" && (ls -la dist/ || echo "❌ dist/ no existe!")
# ---------- PRODUCTION STAGE ----------
FROM node:20-alpine

# No necesitamos git en producción a menos que alguna dependencia runtime lo requiera
# Si alguna dependencia runtime necesita git, descomenta la siguiente línea:
# RUN apk add --no-cache git

WORKDIR /app

# Copiar package.json y package-lock.json
COPY --from=builder /app/package*.json ./

# Copiar node_modules COMPLETO desde builder (ya incluye todas las dependencias)
COPY --from=builder /app/node_modules ./node_modules

# Copiar el build
COPY --from=builder /app/dist ./dist

# Copiar prisma (para migraciones)
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001

# Comando para producción
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]