FROM node:24-bookworm-slim
WORKDIR /opt/foundry
COPY package*.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/modules/package.json packages/modules/package.json
COPY packages/sdk/package.json packages/sdk/package.json
RUN npm ci
COPY . .
RUN npm run build && chown -R node:node /opt/foundry
USER node
ENV NODE_ENV=production
EXPOSE 3000 4100
CMD ["node", "--import", "tsx", "server/runtime-main.ts"]
