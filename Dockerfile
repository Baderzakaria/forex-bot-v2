FROM node:20-alpine AS deps
WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8788
ENV DB_PATH=/data/forex-bot.db

RUN apk add --no-cache libstdc++

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY src ./src
COPY data ./data

EXPOSE 8788

CMD ["node", "src/index.js"]
