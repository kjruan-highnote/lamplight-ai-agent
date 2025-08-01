#!/bin/bash

# Deploy Cloud Scheduler for automated schema updates
# Usage: ./deploy-cloud-scheduler.sh [PROJECT_ID] [SCHEDULE] [TIMEZONE]
#
# Environment Variables:
#   GCP_PROJECT_ID       - GCP project ID (default: your-gcp-project-id)
#   CRON_SCHEDULE        - Cron schedule (default: 0 */6 * * *)
#   SCHEDULE_TIMEZONE    - Timezone (default: UTC)
#   CLOUD_FUNCTION_NAME  - Function name (default: schema-updater)
#   SCHEDULER_JOB_NAME   - Job name (default: schema-update-job)
#   PUBSUB_TOPIC_NAME    - Pub/Sub topic (default: schema-updates)
#   STORAGE_BUCKET       - Storage bucket (default: ${PROJECT_ID}-schema-agent-data)
#   GRAPHQL_ENDPOINT     - GraphQL endpoint URL
#   GRAPHQL_TOKEN        - GraphQL authentication token

set -e

# Configuration - can be set via environment variables
PROJECT_ID=${1:-"${GCP_PROJECT_ID:-your-gcp-project-id}"}
SCHEDULE=${2:-"${CRON_SCHEDULE:-0 */6 * * *}"}  # Every 6 hours
TIMEZONE=${3:-"${SCHEDULE_TIMEZONE:-UTC}"}
FUNCTION_NAME="${CLOUD_FUNCTION_NAME:-schema-updater}"
JOB_NAME="${SCHEDULER_JOB_NAME:-schema-update-job}"

echo -e "\033[0;34m[CLOCK]\033[0m Setting up Cloud Scheduler for Schema Updates"
echo "Project: ${PROJECT_ID}"
echo "Schedule: ${SCHEDULE} (${TIMEZONE})"
echo "Function: ${FUNCTION_NAME}"

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "\033[0;31m[ERROR]\033[0m Error: gcloud CLI is not installed"
    exit 1
fi

# Set project
gcloud config set project ${PROJECT_ID}

# Enable required APIs
echo -e "\033[0;33m[TOOLS]\033[0m Enabling required APIs..."
gcloud services enable \
    cloudfunctions.googleapis.com \
    cloudscheduler.googleapis.com \
    pubsub.googleapis.com

# Create Pub/Sub topic if it doesn't exist
TOPIC_NAME="${PUBSUB_TOPIC_NAME:-schema-updates}"
if ! gcloud pubsub topics describe ${TOPIC_NAME} &> /dev/null; then
    echo -e "\033[0;36m[MEGAPHONE]\033[0m Creating Pub/Sub topic..."
    gcloud pubsub topics create ${TOPIC_NAME}
fi

# Deploy Cloud Function
echo -e "\033[0;94m[CLOUD]\033[0m Deploying Cloud Function..."
gcloud functions deploy ${FUNCTION_NAME} \
    --source=gcp/cloud-functions/schema-updater \
    --entry-point=pubsub_trigger \
    --runtime=python39 \
    --trigger-topic=${TOPIC_NAME} \
    --memory=2GB \
    --timeout=540s \
    --set-env-vars="GRAPHQL_ENDPOINT=${GRAPHQL_ENDPOINT},GRAPHQL_TOKEN=${GRAPHQL_TOKEN},SOURCE_BUCKET=${STORAGE_BUCKET:-${PROJECT_ID}-schema-agent-data}"

# Create Cloud Scheduler job
echo -e "\033[0;35m[ALARM]\033[0m Creating Cloud Scheduler job..."
gcloud scheduler jobs create pubsub ${JOB_NAME} \
    --schedule="${SCHEDULE}" \
    --topic=${TOPIC_NAME} \
    --message-body='{"force_update": false}' \
    --time-zone=${TIMEZONE} \
    --description="Automated schema update job"

echo ""
echo -e "\033[0;32m[CHECK]\033[0m Cloud Scheduler setup completed!"
echo ""
echo -e "\033[0;36m[CLIPBOARD]\033[0m Configuration:"
echo "  • Schedule: ${SCHEDULE} (${TIMEZONE})"
echo "  • Topic: projects/${PROJECT_ID}/topics/${TOPIC_NAME}"
echo "  • Function: ${FUNCTION_NAME}"
echo "  • Job: ${JOB_NAME}"
echo ""
echo -e "\033[0;33m[WRENCH]\033[0m Management commands:"
echo "  • Pause job: gcloud scheduler jobs pause ${JOB_NAME}"
echo "  • Resume job: gcloud scheduler jobs resume ${JOB_NAME}"
echo "  • Run now: gcloud scheduler jobs run ${JOB_NAME}"
echo "  • View logs: gcloud functions logs read ${FUNCTION_NAME}"
echo ""
echo -e "\033[0;34m[GLOBE]\033[0m Manual trigger URL:"
FUNCTION_URL=$(gcloud functions describe ${FUNCTION_NAME} --format="value(httpsTrigger.url)" 2>/dev/null || echo "HTTP trigger not configured")
if [[ "$FUNCTION_URL" != "HTTP trigger not configured" ]]; then
    echo "  • ${FUNCTION_URL}"
fi