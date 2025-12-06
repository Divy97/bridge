#!/bin/bash

# Script to configure CORS for Firebase Storage
# Usage: ./setup-cors.sh YOUR_STORAGE_BUCKET_NAME

if [ -z "$1" ]; then
  echo "Error: Storage bucket name is required"
  echo "Usage: ./setup-cors.sh YOUR_STORAGE_BUCKET_NAME"
  echo ""
  echo "To find your bucket name:"
  echo "1. Go to Firebase Console → Storage → Settings"
  echo "2. Look for 'Bucket name' or check your .env file for NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
  exit 1
fi

BUCKET_NAME=$1

echo "Configuring CORS for Firebase Storage bucket: $BUCKET_NAME"
echo ""

# Check if gsutil is installed
if ! command -v gsutil &> /dev/null; then
  echo "Error: gsutil is not installed"
  echo ""
  echo "Install Google Cloud SDK:"
  echo "  macOS: brew install google-cloud-sdk"
  echo "  Linux: https://cloud.google.com/sdk/docs/install"
  echo "  Windows: https://cloud.google.com/sdk/docs/install"
  echo ""
  echo "After installation, run: gcloud auth login"
  exit 1
fi

# Apply CORS configuration
echo "Applying CORS configuration..."
gsutil cors set cors.json gs://$BUCKET_NAME

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ CORS configuration applied successfully!"
  echo ""
  echo "Your Firebase Storage is now configured to accept uploads from:"
  echo "  - http://localhost:3000 (development)"
  echo "  - https://*.vercel.app (production)"
  echo "  - https://*.web.app (Firebase hosting)"
else
  echo ""
  echo "❌ Failed to apply CORS configuration"
  echo "Make sure you're authenticated: gcloud auth login"
  exit 1
fi
