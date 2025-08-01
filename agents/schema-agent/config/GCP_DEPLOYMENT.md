# Schema Agent - GCP Deployment Guide

This guide provides comprehensive instructions for deploying the GraphQL Schema QA Agent to Google Cloud Platform (GCP).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Deployment Options](#deployment-options)
4. [Configuration](#configuration)
5. [Monitoring & Maintenance](#monitoring--maintenance)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

1. **Google Cloud SDK (gcloud)**
   ```bash
   # Install gcloud CLI
   curl https://sdk.cloud.google.com | bash
   exec -l $SHELL
   gcloud init
   ```

2. **Docker**
   ```bash
   # Install Docker
   # macOS: Download from https://docs.docker.com/desktop/mac/
   # Linux: sudo apt-get install docker.io
   ```

3. **kubectl** (for GKE deployments)
   ```bash
   gcloud components install kubectl
   ```

### GCP Setup

1. **Create or select a GCP project**
   ```bash
   gcloud projects create your-project-id
   gcloud config set project your-project-id
   ```

2. **Enable billing** (required for most GCP services)
   - Visit [GCP Console](https://console.cloud.google.com/)
   - Navigate to Billing and enable billing for your project

3. **Enable required APIs**
   ```bash
   gcloud services enable \
       cloudbuild.googleapis.com \
       run.googleapis.com \
       container.googleapis.com \
       storage.googleapis.com
   ```

## Quick Start

The fastest way to deploy is using **Cloud Run** (serverless):

```bash
# 1. Clone and navigate to the project
cd schema-agent

# 2. Run the deployment script
./gcp/deploy-cloud-run.sh your-project-id us-central1

# 3. Your service will be available at the URL shown in the output
```

## Deployment Options

### Option 1: Cloud Run (Recommended)

**Best for:** Serverless deployment, automatic scaling, pay-per-use

```bash
# Deploy to Cloud Run
./gcp/deploy-cloud-run.sh [PROJECT_ID] [REGION]

# Example
./gcp/deploy-cloud-run.sh my-gcp-project us-central1
```

**Features:**
- [CHECK] Automatic scaling (0 to 1000 instances)
- [CHECK] Pay only for requests
- [CHECK] HTTPS termination included
- [CHECK] No infrastructure management
- [CHECK] Built-in logging and monitoring

**Limitations:**
- Request timeout: 60 minutes max
- Memory: 8GB max
- CPU: 4 vCPU max

### Option 2: Google Kubernetes Engine (GKE)

**Best for:** High availability, custom networking, advanced configuration

```bash
# Deploy to GKE
./gcp/deploy-gke.sh [PROJECT_ID] [CLUSTER_NAME] [ZONE]

# Example
./gcp/deploy-gke.sh my-gcp-project schema-cluster us-central1-a
```

**Features:**
- [CHECK] Full Kubernetes features
- [CHECK] Custom networking and security
- [CHECK] Persistent storage options
- [CHECK] Advanced monitoring
- [CHECK] Multi-zone deployment

**Considerations:**
- Requires cluster management
- Higher cost (always-on nodes)
- More complex setup

## Configuration

### Environment Variables

Configure your deployment using environment variables:

```bash
# Required
export GOOGLE_CLOUD_PROJECT="your-project-id"

# Optional
export STORAGE_BUCKET="your-bucket-name"  # For persistent storage
export ENABLE_AUTH="false"                # Enable API authentication
export ALLOWED_ORIGINS="*"                # CORS configuration
export MAX_QUESTION_LENGTH="1000"         # Question length limit
```

### Cloud Storage Setup

For persistent embeddings and data storage:

```bash
# Set up Cloud Storage
./gcp/setup-storage.sh your-project-id your-bucket-name

# This creates:
# - GCS bucket for data storage
# - Service account with appropriate permissions
# - Folder structure for embeddings and chunks
```

### Authentication (Optional)

To enable API authentication:

1. **Create API keys**
   ```bash
   # Generate a random API key
   openssl rand -hex 32
   ```

2. **Set environment variables**
   ```bash
   export API_KEY="your-generated-key"
   export ENABLE_AUTH="true"
   ```

3. **Update deployment**
   ```bash
   # For Cloud Run
   gcloud run services update schema-agent \
       --set-env-vars="API_KEY=your-key,ENABLE_AUTH=true"
   ```

## Monitoring & Maintenance

### Health Checks

Monitor your deployment:

```bash
# Check service health
curl https://your-service-url/health

# Expected response:
# {"status": "healthy", "timestamp": "...", "version": "..."}
```

### Logging

View application logs:

```bash
# Cloud Run logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=schema-agent" --limit=50 --format="table(timestamp,textPayload)"

# GKE logs
kubectl logs -f deployment/schema-agent
```

### Performance Monitoring

Enable Cloud Monitoring:

```bash
# For Cloud Run (automatic)
# Visit Cloud Console -> Cloud Run -> your-service -> Metrics

# For GKE
# Install monitoring agent
kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/k8s-stackdriver/master/resources/node-agent-ds.yaml
```

### Scaling Configuration

**Cloud Run:**
```bash
# Update scaling settings
gcloud run services update schema-agent \
    --min-instances=1 \
    --max-instances=100 \
    --concurrency=80
```

**GKE:**
```bash
# Update replica count
kubectl scale deployment schema-agent --replicas=3

# Enable horizontal pod autoscaling
kubectl autoscale deployment schema-agent --cpu-percent=70 --min=2 --max=10
```

## Troubleshooting

### Common Issues

1. **Container fails to start**
   ```bash
   # Check logs
   gcloud logging read "resource.type=cloud_run_revision" --limit=50
   
   # Common causes:
   # - Missing embeddings files
   # - Insufficient memory
   # - Port configuration issues
   ```

2. **Out of memory errors**
   ```bash
   # Increase memory limit (Cloud Run)
   gcloud run services update schema-agent \
       --memory=4Gi \
       --cpu=2
   ```

3. **Storage access issues**
   ```bash
   # Check service account permissions
   gcloud projects get-iam-policy your-project-id
   
   # Verify bucket exists
   gsutil ls gs://your-bucket-name
   ```

4. **Network connectivity issues**
   ```bash
   # Check firewall rules (GKE)
   gcloud compute firewall-rules list
   
   # Verify ingress configuration
   kubectl describe ingress schema-agent-ingress
   ```

### Performance Optimization

1. **Optimize embeddings loading**
   - Use Cloud Storage for persistent embeddings
   - Enable embeddings caching
   - Consider using larger memory instances

2. **Optimize query performance**
   - Adjust `top_k` parameter
   - Fine-tune similarity thresholds
   - Enable query caching

3. **Resource optimization**
   ```bash
   # Cloud Run optimization
   gcloud run services update schema-agent \
       --cpu=2 \
       --memory=4Gi \
       --concurrency=40
   ```

### Getting Help

1. **Check service status**
   ```bash
   gcloud run services describe schema-agent --region=us-central1
   ```

2. **View detailed logs**
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=schema-agent" --limit=100
   ```

3. **Test API endpoints**
   ```bash
   # Health check
   curl -X GET https://your-service-url/health
   
   # Chat endpoint
   curl -X POST https://your-service-url/chat \
        -H "Content-Type: application/json" \
        -d '{"question": "How do I create a user?", "top_k": 5}'
   ```

## Cost Optimization

### Cloud Run Cost Tips

- **Use minimum instances carefully**: Setting min-instances > 0 means always-on billing
- **Optimize request handling**: Higher concurrency = fewer instances needed
- **Monitor cold starts**: Consider min-instances=1 if cold starts are problematic

### GKE Cost Tips

- **Use preemptible nodes**: 60-90% cost savings for non-critical workloads
- **Enable cluster autoscaling**: Scale nodes based on demand
- **Right-size your nodes**: Use appropriate machine types

```bash
# Create cost-optimized GKE cluster
gcloud container clusters create schema-agent-cluster \
    --preemptible \
    --enable-autoscaling \
    --min-nodes=1 \
    --max-nodes=3 \
    --machine-type=e2-standard-2
```

## Security Best Practices

1. **Enable authentication**
2. **Use HTTPS only**
3. **Restrict CORS origins**
4. **Use service accounts with minimal permissions**
5. **Enable audit logging**
6. **Keep container images updated**

## Updates and Maintenance

### Updating the Application

```bash
# Build new image
docker build -t gcr.io/your-project-id/schema-agent:v2 .

# Push to registry  
docker push gcr.io/your-project-id/schema-agent:v2

# Update Cloud Run service
gcloud run services update schema-agent \
    --image=gcr.io/your-project-id/schema-agent:v2

# Update GKE deployment
kubectl set image deployment/schema-agent schema-agent=gcr.io/your-project-id/schema-agent:v2
```

### Backup and Recovery

```bash
# Backup embeddings and chunks
gsutil -m cp -r gs://your-bucket-name/embeddings ./backup/
gsutil -m cp -r gs://your-bucket-name/chunks ./backup/

# Restore from backup
gsutil -m cp -r ./backup/embeddings gs://your-bucket-name/
gsutil -m cp -r ./backup/chunks gs://your-bucket-name/
```

---

For additional support, check the [main README](README.md) or create an issue in the project repository.