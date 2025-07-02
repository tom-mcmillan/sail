#!/bin/bash
# DEPRECATED: Do not use this script
# Use 'gcloud run deploy sail-backend --source .' instead
# Or push to GitHub to trigger automatic deployment

echo "ERROR: This deployment script is deprecated!"
echo ""
echo "To deploy, use ONE of these methods:"
echo "1. Push to GitHub (automatic deployment via Cloud Build)"
echo "2. Manual: gcloud run deploy sail-backend --source . --region us-central1"
echo ""
echo "We only use 'sail-backend' service now (not sailmcp-backend)"
exit 1