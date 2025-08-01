#!/bin/bash

# GCP Cloud Storage Setup for Schema Agent
# Usage: ./setup-storage.sh [PROJECT_ID] [BUCKET_NAME]

set -e

# Configuration
PROJECT_ID=${1:-"your-gcp-project-id"}
BUCKET_NAME=${2:-"${PROJECT_ID}-schema-agent-data"}
REGION="us-central1"

echo -e "\033[0;36m[FOLDER]\033[0m Setting up Cloud Storage for Schema Agent"
echo "Project: ${PROJECT_ID}"
echo "Bucket: ${BUCKET_NAME}"
echo "Region: ${REGION}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "\033[0;31m[ERROR]\033[0m Error: gcloud CLI is not installed"
    exit 1
fi

# Set project
echo -e "\033[0;34m[CLIPBOARD]\033[0m Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable Cloud Storage API
echo -e "\033[0;33m[TOOLS]\033[0m Enabling Cloud Storage API..."
gcloud services enable storage.googleapis.com

# Create bucket if it doesn't exist
if ! gsutil ls gs://${BUCKET_NAME} &> /dev/null; then
    echo -e "\033[0;36m[BUCKET]\033[0m Creating Cloud Storage bucket..."
    gsutil mb -p ${PROJECT_ID} -c STANDARD -l ${REGION} gs://${BUCKET_NAME}
    
    # Set bucket permissions (optional - make bucket publicly readable)
    # gsutil iam ch allUsers:objectViewer gs://${BUCKET_NAME}
else
    echo -e "\033[0;32m[CHECK]\033[0m Bucket already exists"
fi

# Create folder structure
echo -e "\033[0;36m[FOLDER]\033[0m Creating folder structure..."
echo "Setting up embeddings folder..." | gsutil cp - gs://${BUCKET_NAME}/embeddings/.keep
echo "Setting up chunks folder..." | gsutil cp - gs://${BUCKET_NAME}/chunks/.keep
echo "Setting up logs folder..." | gsutil cp - gs://${BUCKET_NAME}/logs/.keep

# Upload existing embeddings if they exist
if [ -d "embeddings" ] && [ "$(ls -A embeddings)" ]; then
    echo -e "\033[0;35m[OUTBOX]\033[0m Uploading existing embeddings..."
    gsutil -m cp -r embeddings/* gs://${BUCKET_NAME}/embeddings/
fi

# Upload existing chunks if they exist
if [ -d "chunks" ] && [ "$(ls -A chunks)" ]; then
    echo -e "\033[0;35m[OUTBOX]\033[0m Uploading existing chunks..."
    gsutil -m cp -r chunks/* gs://${BUCKET_NAME}/chunks/
fi

# Create service account for the application (optional)
SERVICE_ACCOUNT_NAME="schema-agent-sa"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe ${SERVICE_ACCOUNT_EMAIL} &> /dev/null; then
    echo -e "\033[0;33m[USER]\033[0m Creating service account..."
    gcloud iam service-accounts create ${SERVICE_ACCOUNT_NAME} \
        --display-name="Schema Agent Service Account" \
        --description="Service account for Schema Agent application"
    
    # Grant necessary permissions
    echo -e "\033[0;33m[KEY]\033[0m Granting permissions..."
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/storage.objectAdmin"
        
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
        --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
        --role="roles/logging.logWriter"
else
    echo -e "\033[0;32m[CHECK]\033[0m Service account already exists"
fi

echo ""
echo -e "\033[0;32m[CHECK]\033[0m Storage setup completed successfully!"
echo ""
echo -e "\033[0;36m[CLIPBOARD]\033[0m Configuration details:"
echo "Bucket Name: ${BUCKET_NAME}"
echo "Bucket URL: gs://${BUCKET_NAME}"
echo "Service Account: ${SERVICE_ACCOUNT_EMAIL}"
echo ""
echo -e "\033[0;33m[WRENCH]\033[0m Environment variables for your application:"
echo "export STORAGE_BUCKET=${BUCKET_NAME}"
echo "export GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
echo ""
echo -e "\033[0;36m[MEMO]\033[0m To use with Cloud Run, add these environment variables:"
echo "STORAGE_BUCKET=${BUCKET_NAME}"
echo "GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
echo ""
echo -e "\033[0;34m[REFRESH]\033[0m To sync local files with cloud storage:"
echo "gsutil -m rsync -r -d embeddings gs://${BUCKET_NAME}/embeddings"
echo "gsutil -m rsync -r -d chunks gs://${BUCKET_NAME}/chunks"