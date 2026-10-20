# GoldBox Rerolled: the web app and its accounts/sync server in one image (docs/server.md, "Docker").
# Build from the repository root:   docker build -t goldbox-rerolled .
# No game files and no secrets go into the image; players import their own game files in the browser.

# ---- stage 1: build the web app (web/dist)
FROM node:24.22.0-alpine3.24 AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
# the type check covers the server too (web/tsconfig.json includes ../server)
COPY server/ /src/server/
RUN npm run build

# ---- stage 2: the server, run by Node directly (type stripping), no dependencies
FROM node:24.22.0-alpine3.24
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    WEB_ROOT=/app/web/dist \
    COOKIE_SECURE=1 \
    TRUST_PROXY=0 \
    SIGNUP=open \
    MAX_USERS=1000 \
    QUOTA_MB=20
WORKDIR /app
COPY server/*.ts server/
COPY --from=web /src/web/dist web/dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/v1/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "server/main.ts"]
