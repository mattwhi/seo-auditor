
#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/seo-auditor"
IMAGE_TAG="${1:?Usage: deploy-ghcr.sh sha-<40-character-commit>}"

# Only accept full Git commit SHA image tags.
if [[ ! "$IMAGE_TAG" =~ ^sha-[0-9a-f]{40}$ ]]; then
  echo "ERROR: Invalid image tag: $IMAGE_TAG"
  exit 1
fi

cd "$APP_DIR"
export IMAGE_TAG
export SEO_AUDITOR_IMAGE="ghcr.io/mattwhi/seo-auditor:$IMAGE_TAG"

COMPOSE=(
  docker compose
  --env-file .env.production
  -f docker-compose.yml
  -f compose.vm.yml
  -f compose.deploy.yml
  -f compose.google.yml
  -f compose.wordpress.yml
  -f compose.remediation.yml
  -f compose.remediation-web.yml
  -f compose.production.yml
)

echo "========================================"
echo "SEO Auditor production deployment"
echo "Image: ghcr.io/mattwhi/seo-auditor:$IMAGE_TAG"
echo "========================================"

# Pull the exact image built by GitHub Actions.
echo "Pulling Docker images..."
"${COMPOSE[@]}" pull migrate api worker web

# Recreate application containers using the pulled image.
# Database and Redis volumes remain intact.
echo "Starting application containers..."
"${COMPOSE[@]}" up -d --no-build --remove-orphans

# Verify API and web availability.
echo "Waiting for health checks..."

for attempt in $(seq 1 30); do
  API_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 5 http://127.0.0.1:4012/health || true)

  WEB_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 5 http://10.10.20.171:3012/ || true)

  if [[ "$API_STATUS" == "200" ]] &&
     [[ "$WEB_STATUS" == "200" || "$WEB_STATUS" == "307" ]]; then

    echo "Deployment successful: $IMAGE_TAG"
    "${COMPOSE[@]}" ps
    exit 0
  fi

  echo "Waiting for services ($attempt/30): API=$API_STATUS WEB=$WEB_STATUS"
  sleep 2
done

echo "ERROR: Deployment health checks failed."
"${COMPOSE[@]}" ps
"${COMPOSE[@]}" logs --tail=80 api worker web
exit 1
