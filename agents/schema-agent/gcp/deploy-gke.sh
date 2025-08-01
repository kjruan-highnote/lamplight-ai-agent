#!/bin/bash

# GCP GKE Deployment Script for Schema Agent
# Usage: ./deploy-gke.sh [PROJECT_ID] [CLUSTER_NAME] [ZONE]

set -e

# Configuration
PROJECT_ID=${1:-"your-gcp-project-id"}
CLUSTER_NAME=${2:-"schema-agent-cluster"}
ZONE=${3:-"us-central1-a"}
SERVICE_NAME="schema-agent"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "\033[0;32m[ROCKET]\033[0m Deploying Schema Agent to GKE"
echo "Project: ${PROJECT_ID}"
echo "Cluster: ${CLUSTER_NAME}"
echo "Zone: ${ZONE}"

# Check dependencies
if ! command -v gcloud &> /dev/null; then
    echo -e "\033[0;31m[ERROR]\033[0m Error: gcloud CLI is not installed"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo -e "\033[0;31m[ERROR]\033[0m Error: kubectl is not installed"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo -e "\033[0;31m[ERROR]\033[0m Error: Docker is not installed"
    exit 1
fi

# Set project
echo -e "\033[0;34m[CLIPBOARD]\033[0m Setting GCP project..."
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo -e "\033[0;33m[TOOLS]\033[0m Enabling required GCP APIs..."
gcloud services enable \
    container.googleapis.com \
    cloudbuild.googleapis.com \
    containerregistry.googleapis.com

# Create GKE cluster if it doesn't exist
if ! gcloud container clusters describe ${CLUSTER_NAME} --zone=${ZONE} &> /dev/null; then
    echo -e "\033[0;36m[BUILDING]\033[0m Creating GKE cluster..."
    gcloud container clusters create ${CLUSTER_NAME} \
        --zone=${ZONE} \
        --machine-type=e2-standard-2 \
        --num-nodes=2 \
        --enable-autoscaling \
        --min-nodes=1 \
        --max-nodes=5 \
        --enable-autorepair \
        --enable-autoupgrade \
        --disk-size=20GB \
        --disk-type=pd-standard
else
    echo -e "\033[0;32m[CHECK]\033[0m GKE cluster already exists"
fi

# Get cluster credentials
echo -e "\033[0;33m[KEY]\033[0m Getting cluster credentials..."
gcloud container clusters get-credentials ${CLUSTER_NAME} --zone=${ZONE}

# Build and push image
echo -e "\033[0;35m[CONSTRUCTION]\033[0m Building Docker image..."
docker build -t ${IMAGE_NAME}:latest .

echo -e "\033[0;35m[OUTBOX]\033[0m Pushing image to Container Registry..."
docker push ${IMAGE_NAME}:latest

# Update deployment YAML with correct image
echo -e "\033[0;36m[MEMO]\033[0m Updating Kubernetes manifests..."
sed -i.bak "s/YOUR_PROJECT_ID/${PROJECT_ID}/g" gcp/kubernetes/deployment.yaml
sed -i.bak "s/YOUR_PROJECT_ID/${PROJECT_ID}/g" gcp/kubernetes/ingress.yaml

# Deploy to GKE
echo -e "\033[0;32m[ROCKET]\033[0m Deploying to GKE..."
kubectl apply -f gcp/kubernetes/deployment.yaml
kubectl apply -f gcp/kubernetes/service.yaml

# Wait for deployment to be ready
echo -e "\033[0;33m[HOURGLASS]\033[0m Waiting for deployment to be ready..."
kubectl rollout status deployment/schema-agent --timeout=300s

# Get service information
echo -e "\033[0;34m[CLIPBOARD]\033[0m Getting service information..."
kubectl get services schema-agent-service

# Get external IP
echo -e "\033[0;33m[HOURGLASS]\033[0m Waiting for external IP..."
EXTERNAL_IP=""
while [ -z $EXTERNAL_IP ]; do
    echo "Waiting for external IP..."
    EXTERNAL_IP=$(kubectl get svc schema-agent-service --template="{{range .status.loadBalancer.ingress}}{{.ip}}{{end}}")
    [ -z "$EXTERNAL_IP" ] && sleep 10
done

echo ""
echo -e "\033[0;32m[CHECK]\033[0m Deployment completed successfully!"
echo ""
echo -e "\033[0;34m[GLOBE]\033[0m External IP: ${EXTERNAL_IP}"
echo -e "\033[0;32m[HOSPITAL]\033[0m Health check: http://${EXTERNAL_IP}/health"
echo -e "\033[0;36m[SPEECH]\033[0m Chat API: http://${EXTERNAL_IP}/chat (POST)"
echo ""
echo -e "\033[0;36m[MEMO]\033[0m Example usage:"
echo "curl -X POST \"http://${EXTERNAL_IP}/chat\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"question\": \"How do I create a user?\", \"top_k\": 5}'"
echo ""
echo -e "\033[0;33m[WRENCH]\033[0m To update the deployment:"
echo "kubectl set image deployment/schema-agent schema-agent=${IMAGE_NAME}:latest"
echo ""
echo -e "\033[0;31m[WASTEBASKET]\033[0m To delete the deployment:"
echo "kubectl delete -f gcp/kubernetes/"