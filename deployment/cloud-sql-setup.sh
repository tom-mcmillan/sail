#!/bin/bash

# Cloud SQL setup script for production
# Run this once to set up your production database

set -e

PROJECT_ID=${1:-"your-project-id"}
REGION=${2:-"us-central1"}
DB_INSTANCE_NAME="sail-postgres-prod"
DB_NAME="sail"
DB_USER="sail_user"

echo "🚀 Setting up Cloud SQL for Sail MCP..."

# Enable required APIs
echo "📦 Enabling required APIs..."
gcloud services enable sqladmin.googleapis.com --project=$PROJECT_ID
gcloud services enable run.googleapis.com --project=$PROJECT_ID
gcloud services enable secretmanager.googleapis.com --project=$PROJECT_ID

# Create Cloud SQL instance
echo "🗄️ Creating Cloud SQL instance..."
gcloud sql instances create $DB_INSTANCE_NAME \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=10GB \
  --storage-auto-increase \
  --backup-start-time=03:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04 \
  --project=$PROJECT_ID

# Generate secure password
DB_PASSWORD=$(openssl rand -base64 32)

# Create database user
echo "👤 Creating database user..."
gcloud sql users create $DB_USER \
  --instance=$DB_INSTANCE_NAME \
  --password=$DB_PASSWORD \
  --project=$PROJECT_ID

# Create database
echo "📊 Creating database..."
gcloud sql databases create $DB_NAME \
  --instance=$DB_INSTANCE_NAME \
  --project=$PROJECT_ID

# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID --format="value(connectionName)")

# Create database URL
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$CONNECTION_NAME/$DB_NAME"

# Store secrets in Secret Manager
echo "🔐 Storing secrets..."
echo -n "$DATABASE_URL" | gcloud secrets create database-credentials --data-file=- --project=$PROJECT_ID
echo -n "redis://redis-memorystore-ip:6379" | gcloud secrets create redis-credentials --data-file=- --project=$PROJECT_ID
JWT_SECRET=$(openssl rand -base64 64)
echo -n "$JWT_SECRET" | gcloud secrets create app-secrets --data-file=- --project=$PROJECT_ID

# Create service account for Cloud Run
echo "🔑 Creating service account..."
gcloud iam service-accounts create sail-backend-sa \
  --display-name="Sail Backend Service Account" \
  --project=$PROJECT_ID

# Grant permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sail-backend-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:sail-backend-sa@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

echo "✅ Cloud SQL setup complete!"
echo ""
echo "📋 Configuration Summary:"
echo "  Instance: $DB_INSTANCE_NAME"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Connection: $CONNECTION_NAME"
echo ""
echo "🔗 Next steps:"
echo "  1. Set up Redis Memorystore"
echo "  2. Configure GitHub Actions secrets"
echo "  3. Deploy with: gcloud run deploy"
echo ""
echo "🔐 GitHub Secrets to add:"
echo "  GCP_PROJECT_ID: $PROJECT_ID"
echo "  GCP_SA_KEY: [Service Account JSON key]"