# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package files for workspace setup
COPY package*.json ./
COPY turbo.json ./

# Copy workspace packages
COPY packages ./packages

# Copy the app
COPY apps/recommender-service ./apps/recommender-service

# Install dependencies
RUN npm install

# Build the app
WORKDIR /app/apps/recommender-service
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy root package files for workspace setup
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/turbo.json ./

# Copy built workspace packages
COPY --from=builder /app/packages ./packages

# Copy the app package.json
COPY --from=builder /app/apps/recommender-service/package*.json ./apps/recommender-service/

# Install all dependencies (including workspace packages)
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/apps/recommender-service/dist ./apps/recommender-service/dist

# Set working directory to the app
WORKDIR /app/apps/recommender-service

# Expose port
EXPOSE 6000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=6000

# Start the app
CMD ["node", "dist/index.js"]

