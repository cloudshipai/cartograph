#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== Building Cartograph Plugin ==="
npm run build

echo ""
echo "=== Starting Docker Compose ==="
cd test
docker compose up -d --build

echo ""
echo "=== Waiting for services to be healthy ==="
for i in {1..30}; do
  if curl -s http://localhost:4098/health > /dev/null 2>&1; then
    echo "OpenCode is ready!"
    break
  fi
  echo "Waiting for OpenCode... ($i/30)"
  sleep 2
done

echo ""
echo "=== Running Smoke Tests ==="
bun run smoke-test.ts

echo ""
echo "=== Running UI Tests ==="
bun run ui-test.ts

CLEANUP=${CLEANUP:-true}
if [ "$CLEANUP" = "true" ]; then
  echo ""
  echo "=== Cleaning up ==="
  docker compose down -v
fi

echo ""
echo "=== All tests passed! ==="
