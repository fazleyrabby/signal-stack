#!/bin/bash
set -e

# Configuration
DB_CONTAINER_NAME="signalstack-db-test"
DB_PORT=5434
DB_USER="signal"
DB_PASS="signal"
DB_NAME="signalstack"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"

# Cleanup function
cleanup() {
  echo "Cleaning up: Stopping and removing test database container..."
  docker stop $DB_CONTAINER_NAME > /dev/null 2>&1 || true
  docker rm $DB_CONTAINER_NAME > /dev/null 2>&1 || true
}

# Trap cleanup on exit (even on failure)
trap cleanup EXIT

echo "Starting ephemeral PostgreSQL test database..."
docker run --name $DB_CONTAINER_NAME \
  -e POSTGRES_USER=$DB_USER \
  -e POSTGRES_PASSWORD=$DB_PASS \
  -e POSTGRES_DB=$DB_NAME \
  -p $DB_PORT:5432 \
  --tmpfs /var/lib/postgresql/data \
  -d postgres:16-alpine

echo "Waiting for database to be ready..."
# Wait up to 30 seconds
for i in {1..30}; do
  if docker exec $DB_CONTAINER_NAME pg_isready -U $DB_USER -d $DB_NAME > /dev/null 2>&1; then
    echo "Database is ready!"
    break
  fi
  echo "Waiting for database... ($i/30)"
  sleep 1
  if [ $i -eq 30 ]; then
    echo "Database failed to start in time."
    exit 1
  fi
done

echo "Running database schema push..."
cd backend
export DATABASE_URL=$DATABASE_URL
npx drizzle-kit push

echo "Executing E2E tests..."
npm run test:e2e

echo "Tests completed successfully!"
