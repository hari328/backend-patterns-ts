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

# Copy package files
COPY apps/recommender-service/package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/apps/recommender-service/dist ./dist

# Expose port
EXPOSE 7000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=7000

# Start the app
CMD ["node", "dist/index.js"]

