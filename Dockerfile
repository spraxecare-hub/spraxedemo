# If you prefer deploying via Render's "Docker" option.

FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies (npm ci requires package-lock.json)
COPY package.json package-lock.json ./
RUN npm ci


FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy only what's needed to run next start
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Render provides PORT; default to 10000 for local runs
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
