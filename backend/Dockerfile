# Multi-stage build for production
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY simple-package.json package.json

# Install all dependencies (including dev deps for TypeScript)
RUN npm ci

# Copy source code
COPY src/mcp-packet-server.ts src/
COPY tsconfig.json ./

# Build TypeScript
RUN npx tsc --outDir dist src/mcp-packet-server.ts

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy package files and install only production dependencies
COPY simple-package.json package.json
RUN npm ci --only=production && npm cache clean --force

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder /app/dist ./dist

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Run the compiled JavaScript
CMD ["node", "dist/mcp-packet-server.js"]