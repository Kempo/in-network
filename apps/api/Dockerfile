# syntax=docker/dockerfile:1
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY mcp/package.json mcp/package.json
RUN npm ci

FROM deps AS build
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY mcp/package.json mcp/package.json
RUN npm ci --omit=dev
COPY --from=build /app/apps/api/dist apps/api/dist
# runMigrations reads ./src/db/migrations at runtime; ship the SQL (not compiled).
COPY apps/api/src/db/migrations apps/api/src/db/migrations
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/index.js"]
