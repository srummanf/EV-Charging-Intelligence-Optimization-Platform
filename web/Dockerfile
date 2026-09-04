# EV Charging Platform dashboard — build from the repo root:
#   docker build -f web/Dockerfile -t evcharging-web .
#   docker run -p 3000:3000 -e NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 evcharging-web
#
# NEXT_PUBLIC_* is inlined at build time, so pass the API URL as a build arg for a real
# deploy; the runtime default points at a sibling "api" service (see docker-compose.yml).

FROM node:22-slim AS deps
WORKDIR /app
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
