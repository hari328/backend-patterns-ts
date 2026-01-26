FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY turbo.json ./

COPY packages ./packages
COPY apps/posts-service ./apps/posts-service

RUN npm install

WORKDIR /app/apps/posts-service
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "dist/index.js"]

