# Imagem só do serviço de cobrança. O contexto de build é a raiz do repositório.
# Node 24, processo final sem root. A chave privada não entra na imagem.
FROM node:24-bookworm-slim AS build
WORKDIR /src
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
RUN npm ci && npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /src/dist/src ./dist/src
COPY billing/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /data \
  && chown -R node:node /app /data
USER node
EXPOSE 4330
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/billing-service.js"]
