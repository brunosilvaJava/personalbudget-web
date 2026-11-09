# Two stages: Node builds dist/, nginx serves it and proxies /api to the back-end.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
# The official image renders /etc/nginx/templates/*.template with the environment on start.
# The back-end address is the service name in the back's compose; change it here or in compose.
ENV API_UPSTREAM=http://personal_budget:8080
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
