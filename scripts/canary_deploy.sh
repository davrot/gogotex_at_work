#!/usr/bin/env bash
set -euo pipefail

# canary_deploy.sh - Helper to perform a canary deploy using helm + kubectl
# Usage: ./scripts/canary_deploy.sh <registry> <tag> [--staging | --prod]

REGISTRY=${1:-}
TAG=${2:-}
ENV=staging

if [[ "$REGISTRY" == "" || "$TAG" == "" ]]; then
  echo "Usage: $0 <registry> <tag> [--staging | --prod]"
  exit 2
fi

if [[ "${3:-}" == "--prod" ]]; then
  ENV=production
fi

echo "Deploying web and git-bridge images: ${REGISTRY}/web:${TAG}, ${REGISTRY}/git-bridge:${TAG} to ${ENV}"

# Build images locally
docker build -t ${REGISTRY}/web:${TAG} -f services/web/Dockerfile .
docker build -t ${REGISTRY}/git-bridge:${TAG} -f services/git-bridge/Dockerfile .

echo "Pushing images (ensure you are logged in to registry)"
docker push ${REGISTRY}/web:${TAG}
docker push ${REGISTRY}/git-bridge:${TAG}

if [[ "$ENV" == "staging" ]]; then
  echo "Deploying to staging using Helm"
  helm upgrade --install web ./charts/web --namespace staging --create-namespace \
    --set image.repository=${REGISTRY}/web --set image.tag=${TAG}

  helm upgrade --install git-bridge ./charts/git-bridge --namespace staging --create-namespace \
    --set image.repository=${REGISTRY}/git-bridge --set image.tag=${TAG}

  echo "Waiting for web to be ready"
  kubectl -n staging rollout status deployment/web --timeout=120s
  echo "Run integration tests against staging now (manual or via CI)."
  exit 0
fi

# Production canary flow (manual steps, operator guided)
echo "Creating a single-replica canary deployment in production"
cat <<EOF | kubectl -n production apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-canary
  labels:
    app: web
    canary: "true"
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
      canary: "true"
  template:
    metadata:
      labels:
        app: web
        canary: "true"
    spec:
      containers:
        - name: web
          image: ${REGISTRY}/web:${TAG}
          ports:
            - containerPort: 3000
EOF

kubectl -n production rollout status deployment/web-canary --timeout=120s

echo "Run smoke tests against the canary:"
CANARY_POD=$(kubectl -n production get pods -l app=web,canary=true -o jsonpath='{.items[0].metadata.name}')
kubectl -n production exec "$CANARY_POD" -- curl -fsS http://localhost:3000/internal/health/oauth-introspect

echo "If canary healthy, use your platform's traffic-split to ramp to desired percentage, monitor for 30-60m, then promote."

echo "Rollback: kubectl -n production delete deployment web-canary && helm upgrade --install web ./charts/web --set image.tag=<previous> --namespace production"
