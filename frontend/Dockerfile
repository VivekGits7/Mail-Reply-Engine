FROM oven/bun:1.4.2-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

ARG APP_API_URL
ARG APP_URL
ENV APP_API_URL=${APP_API_URL}
ENV APP_URL=${APP_URL}
ARG APP_ENV=development
ENV APP_ENV=${APP_ENV}

RUN test -n "$APP_API_URL" && bun --bun run build

FROM nginx:1.27-alpine

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV FRONTEND_PORT=2102

EXPOSE 2102

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:${FRONTEND_PORT}/healthz || exit 1
