FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src
RUN node node_modules/prisma/build/index.js generate --schema prisma/schema.postgresql.prisma
RUN npm run build
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/tsconfig.json ./
EXPOSE 4000
CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --schema prisma/schema.postgresql.prisma --skip-generate && node node_modules/ts-node/dist/bin.js prisma/seed.ts && node dist/main.js"]
