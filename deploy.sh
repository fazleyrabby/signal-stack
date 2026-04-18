#!/bin/bash
set -e

echo "🔄 Pulling latest changes..."
git pull origin main

echo "🧹 Pruning unused Docker data..."
docker system prune -f

echo "🏗️  Building containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "✅ Deploy complete."
docker ps --format "table {{.Names}}\t{{.Status}}"
