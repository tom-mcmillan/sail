#!/bin/bash
set -e

echo "🚀 Deploying Simple Knowledge Packet Server..."

# Build and deploy using Cloud Build with simple Dockerfile
gcloud builds submit \
  --config=simple-cloudbuild.yaml \
  --substitutions=_SERVICE_NAME="sail-packet-simple" \
  .

echo "✅ Deployment complete!"
echo "🔗 Test URL: https://sail-packet-simple-u5cx7jclbq-uc.a.run.app/sail-architecture-demo/info"
echo "🔑 Access key: sail-pk-demo123"
echo "📡 MCP URL: https://sail-packet-simple-u5cx7jclbq-uc.a.run.app/sail-architecture-demo/mcp"