#!/bin/bash
set -e

# ========================================
# Configuration
# ========================================
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}
DEPLOY_ENV=${DEPLOY_ENV:-production}

echo "=== TomManager Deployment (${DEPLOY_ENV}) ==="
echo "Using compose file: ${COMPOSE_FILE}"

# ========================================
# Validate required environment variables
# ========================================
required_vars=(
    "PORTAINER_URL"
    "PORTAINER_API"
    "STACK_ID"
    "ENDPOINT_ID"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
    "POSTGRES_DB"
    "SESSION_SECRET"
    "REGISTRY_URL"
    "IMAGE_NAME"
    "CORS_ORIGIN"
    "DISCORD_CLIENT_ID"
    "DISCORD_CLIENT_SECRET"
    "DISCORD_GUILD_ID"
    "DISCORD_REDIRECT_URI"
    "DISCORD_BOT_TOKEN"
)

echo "Validating environment variables..."
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "ERROR: Required variable $var is not set"
        exit 1
    fi
done
echo "All required variables are set."

# ========================================
# Export variables for envsubst
# ========================================
export PORTAINER_URL
export PORTAINER_API
export STACK_ID
export ENDPOINT_ID
export POSTGRES_USER
export POSTGRES_PASSWORD
export POSTGRES_DB
export SESSION_SECRET
export REGISTRY_URL
export IMAGE_NAME
export TAG=${TAG:-latest}
export CORS_ORIGIN
export DISCORD_CLIENT_ID
export DISCORD_CLIENT_SECRET
export DISCORD_GUILD_ID
export DISCORD_REDIRECT_URI
export DISCORD_BOT_TOKEN
export DISCORD_ADMIN_ROLE_ID=${DISCORD_ADMIN_ROLE_ID:-}

# ========================================
# Process docker-compose file
# ========================================
echo "Processing ${COMPOSE_FILE}..."

if [ ! -f "${COMPOSE_FILE}" ]; then
    echo "ERROR: ${COMPOSE_FILE} not found"
    exit 1
fi

# Substitute environment variables
envsubst < "${COMPOSE_FILE}" > stack_substituted.yml

# ========================================
# Build Portainer API payload
# ========================================
echo "Building Portainer API payload..."

STACK_CONTENT=$(cat stack_substituted.yml | jq -Rs .)

PAYLOAD=$(jq -n \
    --argjson prune true \
    --argjson pullImage true \
    --arg stackFileContent "$(cat stack_substituted.yml)" \
    '{
        prune: $prune,
        pullImage: $pullImage,
        stackFileContent: $stackFileContent
    }')

# ========================================
# Deploy to Portainer
# ========================================
echo "Deploying to Portainer..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X PUT \
    "${PORTAINER_URL}/api/stacks/${STACK_ID}?endpointId=${ENDPOINT_ID}" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: ${PORTAINER_API}" \
    -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    echo "Deployment successful! (HTTP $HTTP_CODE)"
else
    echo "ERROR: Deployment failed (HTTP $HTTP_CODE)"
    echo "Response: $BODY"
    exit 1
fi

# ========================================
# Cleanup
# ========================================
echo "Cleaning up temporary files..."
rm -f stack_substituted.yml

echo "=== Deployment Complete ==="
