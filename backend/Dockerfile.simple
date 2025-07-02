FROM node:18

WORKDIR /app

# Copy package files for the simple server
COPY simple-package.json package.json

# Install dependencies
RUN npm install

# Copy source code
COPY src/mcp-packet-server.ts src/

# Install tsx globally for direct TypeScript execution
RUN npm install -g tsx

EXPOSE 3000

CMD ["tsx", "src/mcp-packet-server.ts"]