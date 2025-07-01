FROM node:18-alpine

WORKDIR /app

# Install required dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application with verbose output
RUN npm run build || (echo "Build failed, listing installed packages:" && npm list typescript && exit 1)

# Remove dev dependencies and clean cache
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Create storage directory
RUN mkdir -p /app/storage && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

CMD ["npm", "start"]