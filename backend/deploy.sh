#!/bin/bash
set -e

echo "Building Docker image..."
docker build -t sailmcp-backend:latest .

echo "Deploying to Cloud Run..."
gcloud run deploy sailmcp-backend \
  --image sailmcp-backend:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --timeout 300 \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10

echo "Deployment complete!"