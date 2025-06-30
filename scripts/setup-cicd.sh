#!/bin/bash

echo "Setting up CI/CD for Sail MCP Backend"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ID="sail-mcp-production"
REGION="us-central1"

echo -e "${YELLOW}Step 1: Connect GitHub to Cloud Build${NC}"
echo "Please visit: https://console.cloud.google.com/cloud-build/triggers/connect?project=${PROJECT_ID}"
echo "1. Click 'Connect Repository'"
echo "2. Select 'GitHub (Cloud Build GitHub App)'"
echo "3. Authenticate with GitHub"
echo "4. Select 'tom-mcmillan/sail' repository"
echo "5. Click 'Connect'"
echo ""
read -p "Press enter when you've completed the GitHub connection..."

echo -e "${YELLOW}Step 2: Create Cloud Build Trigger${NC}"
gcloud builds triggers create github \
  --repo-name="sail" \
  --repo-owner="tom-mcmillan" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml" \
  --name="deploy-backend-on-push" \
  --description="Deploy backend to Cloud Run when pushing to main" \
  --region="${REGION}"

echo -e "${YELLOW}Step 3: Grant Cloud Build permissions${NC}"
# Get the Cloud Build service account
BUILD_SA="$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')@cloudbuild.gserviceaccount.com"

echo "Granting Cloud Run Admin role..."
gcloud projects add-iam-policy-binding ${PROJECT_ID} \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/run.admin"

echo "Granting Service Account User role..."
gcloud iam service-accounts add-iam-policy-binding \
  sail-backend-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --member="serviceAccount:${BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"

echo -e "${GREEN}✅ CI/CD Setup Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Commit and push the cloudbuild.yaml file"
echo "2. Any push to main branch affecting backend/ will trigger deployment"
echo "3. Monitor builds at: https://console.cloud.google.com/cloud-build/builds?project=${PROJECT_ID}"