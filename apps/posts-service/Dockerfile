FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./

COPY packages ./packages
COPY apps/posts-service ./apps/posts-service

RUN mkdir -p /root/.local/share

RUN npm install

RUN npx turbo build --filter=posts-service

WORKDIR /app/apps/posts-service

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]

