#!/bin/sh
set -e

echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U postgres; do
  sleep 1
done

echo "Running database migrations..."
npm run db:migrate --workspace=@repo/database

echo "Seeding database..."
npm run db:seed --workspace=@repo/database

echo "Database initialized successfully!"

