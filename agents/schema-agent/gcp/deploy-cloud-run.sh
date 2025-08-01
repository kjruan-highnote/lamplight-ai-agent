#!/bin/bash

# GCP Cloud Run Deployment Script for Schema Agent
# Usage: ./deploy-cloud-run.sh [PROJECT_ID] [REGION]

set -e

# Configuration
PROJECT_ID=${1:-"your-gcp-project-id"}
REGION=${2:-"us-central1"}
SERVICE_NAME="schema-agent"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "\033[0;32m[ROCKET]\033[0m Deploying Schema Agent to Cloud Run"
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Service: ${SERVICE_NAME}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "\033[0;31m[ERROR]\033[0m Error: gcloud CLI is not installed"
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "\033[0;31m[ERROR]\033[0m Error: Docker is not installed"
    echo "Please install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Set project
echo -e "\033[0;34m[CLIPBOARD]\033[0m Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo -e "\033[0;33m[TOOLS]\033[0m Enabling required GCP APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    containerregistry.googleapis.com

# Build and push image
echo -e "\033[0;35m[CONSTRUCTION]\033[0m Building Docker image..."
docker build -t ${IMAGE_NAME}:latest .

echo -e "\033[0;35m[OUTBOX]\033[0m Pushing image to Container Registry..."
docker push ${IMAGE_NAME}:latest

# Deploy to Cloud Run
echo -e "\033[0;32m[ROCKET]\033[0m Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
    --image=${IMAGE_NAME}:latest \
    --platform=managed \
    --region=${REGION} \
    --allow-unauthenticated \
    --memory=2Gi \
    --cpu=1 \
    --timeout=300s \
    --max-instances=10 \
    --min-instances=0 \
    --concurrency=80 \
    --port=8000 \
    --set-env-vars="HOST=0.0.0.0,PORT=8000,ENABLE_AUTH=false,ALLOWED_ORIGINS=*"

# Get service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform=managed \
    --region=${REGION} \
    --format="value(status.url)")

echo ""
echo -e "\033[0;32m[CHECK]\033[0m Deployment completed successfully!"
echo ""
echo -e "\033[0;34m[GLOBE]\033[0m Service URL: ${SERVICE_URL}"
echo -e "\033[0;32m[HOSPITAL]\033[0m Health check: ${SERVICE_URL}/health"
echo -e "\033[0;36m[SPEECH]\033[0m Chat API: ${SERVICE_URL}/chat (POST)"
echo ""
echo -e "\033[0;36m[MEMO]\033[0m Example usage:"
echo "curl -X POST \"${SERVICE_URL}/chat\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"question\": \"How do I create a user?\", \"top_k\": 5}'"
echo ""
echo -e "\033[0;33m[WRENCH]\033[0m To update the service, run this script again with the same parameters."