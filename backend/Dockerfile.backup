FROM node:18

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including dev dependencies for TypeScript
RUN npm install

# Copy source code
COPY . .

# Build TypeScript
RUN npx tsc

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs

# Create storage directory
RUN mkdir -p /app/storage && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 3000

CMD ["node", "dist/server.js"]