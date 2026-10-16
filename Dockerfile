FROM node:22-alpine AS base
WORKDIR /app

# 1. Installer les dépendances
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2. Construire l'application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Fausse adresse, juste pour que Prisma puisse générer son code pendant le build
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

# 3. Outil qui crée / met à jour les tables
FROM base AS migrator
COPY --from=builder /app ./
CMD ["npx", "prisma", "migrate", "deploy"]

# 4. Image finale : la plus légère
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/generated ./generated
USER app
EXPOSE 3000
CMD ["node", "server.js"]