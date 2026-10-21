# Imagem só do serviço de cobrança. O contexto de build é a raiz do repositório.
# Node 24. O entrypoint começa como root para ajustar /data e depois vira node.
# A chave privada não entra na imagem.
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
# Só fastify, zod e as dependências deles. util-linux traz o setpriv.
RUN apt-get update \
  && apt-get install -y --no-install-recommends util-linux \
  && rm -rf /var/lib/apt/lists/* \
  && printf '%s\n' '{"name":"localneuron-billing","private":true,"type":"module","dependencies":{"fastify":"5.12.7","zod":"4.3.6"}}' > package.json \
  && npm install --omit=dev --no-audit --no-fund \
  && npm cache clean --force \
  && mkdir -p /data dist/src \
  && chown -R node:node /app /data
COPY --from=build /src/dist/src/billing-service.js ./dist/src/billing-service.js
COPY billing/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod 755 /usr/local/bin/docker-entrypoint.sh
EXPOSE 4330
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/src/billing-service.js"]
