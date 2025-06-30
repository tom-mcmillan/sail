# CI/CD Pipeline Documentation

## Overview

Sail MCP uses a dual deployment strategy:
- **Frontend**: Automatically deployed to Vercel on git push
- **Backend**: Deployed to Google Cloud Run via Cloud Build or manual script

## Deployment Architecture

```
GitHub Repository
    ├── Frontend (automatic)
    │   └── Vercel (on push to main)
    │
    └── Backend (two options)
        ├── Option 1: Cloud Build (automatic)
        │   └── Triggered on push to backend/
        │
        └── Option 2: Manual Script
            └── ./scripts/deploy-backend.sh
```

## Frontend Deployment (Automatic)

Frontend deploys automatically to Vercel when you push to main branch:
- No configuration needed
- Instant preview deployments for PRs
- Production URL: https://www.sailmcp.com

## Backend Deployment Options

### Option 1: Cloud Build (Recommended)

1. **One-time setup**:
   ```bash
   ./scripts/setup-cicd.sh
   ```
   This will guide you through connecting GitHub to Cloud Build.

2. **How it works**:
   - Push changes to `backend/` directory
   - Cloud Build automatically builds and deploys
   - Monitor at: https://console.cloud.google.com/cloud-build/builds

### Option 2: Manual Deployment

For emergency deployments or if Cloud Build isn't configured:

```bash
./scripts/deploy-backend.sh
```

This script:
- Builds Docker image locally
- Pushes to Google Container Registry
- Deploys to Cloud Run
- Shows deployment URL

## Environment Variables

### Backend Environment Variables

Managed through Cloud Run:
- `NODE_ENV=production`
- `BASE_URL=https://mcp.sailmcp.com`
- `FRONTEND_URL` (needs periodic updates)
- `DATABASE_URL` (from Secret Manager)
- `JWT_SECRET` (from Secret Manager)

To update environment variables:
```bash
gcloud run services update sail-backend \
  --region=us-central1 \
  --update-env-vars="KEY=value"
```

### Frontend Environment Variables

Set in Vercel dashboard:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_BASE_URL`

## Deployment Checklist

Before deploying:
1. ✅ Test locally with `npm run dev`
2. ✅ Run linting: `npm run lint`
3. ✅ Check TypeScript: `npm run type-check`
4. ✅ Commit all changes
5. ✅ Push to main branch

## Monitoring

- **Frontend Logs**: Vercel dashboard
- **Backend Logs**: 
  ```bash
  gcloud run services logs read sail-backend --region=us-central1
  ```
- **Build History**: https://console.cloud.google.com/cloud-build/builds

## Rollback Procedures

### Frontend Rollback
1. Go to Vercel dashboard
2. Select previous deployment
3. Click "Promote to Production"

### Backend Rollback
```bash
# List recent revisions
gcloud run revisions list --service=sail-backend --region=us-central1

# Route traffic to previous revision
gcloud run services update-traffic sail-backend \
  --region=us-central1 \
  --to-revisions=sail-backend-00031-xyz=100
```

## Troubleshooting

### Build Failures
1. Check Cloud Build logs
2. Verify Dockerfile syntax
3. Ensure all dependencies are listed

### Deployment Issues
1. Check service logs
2. Verify environment variables
3. Confirm secrets are accessible

### Domain Issues
1. Verify domain mapping in Cloud Run
2. Check SSL certificate status
3. Test with direct Cloud Run URL first

## Security Notes

- Never commit secrets to git
- Use Secret Manager for sensitive data
- Rotate secrets regularly
- Monitor access logs

## Cost Optimization

- Cloud Run scales to zero when not in use
- Set max instances to prevent runaway costs
- Monitor usage in GCP Console

---

Last Updated: June 30, 2025