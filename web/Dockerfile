# syntax=docker/dockerfile:1

# Same image is used both as the long-running web service (`npm start`) and as the
# one-off scheduled ingestion task (`npx tsx scripts/ingest-cpi.ts`), so it keeps the
# full node_modules (including devDependencies like tsx) rather than Next's
# standalone output, which only bundles what `next start` itself needs.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/lib ./lib
COPY --from=build /app/tsconfig.json ./tsconfig.json
USER nextjs
EXPOSE 3000
CMD ["npm", "start"]
