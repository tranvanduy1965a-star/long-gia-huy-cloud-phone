# Build from the repository root:
# docker build -f cloud-api/Dockerfile -t long-gia-huy-cloud-phone .
FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# better-sqlite3 may need native compilation when a prebuilt binary is unavailable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY cloud-api/package.json ./cloud-api/package.json
WORKDIR /app/cloud-api
RUN npm install --omit=dev \
    && apt-get purge -y --auto-remove python3 make g++ \
    && rm -rf /root/.npm

COPY cloud-api/ ./
COPY index.html /app/index.html

RUN mkdir -p /data /app/cloud-sdk \
    && chown -R node:node /app /data

ENV PORT=3000
ENV DB_PATH=/data/cloudphone.sqlite
VOLUME ["/data"]
EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
