#!/bin/bash
# scripts/seed.sh — Seed the database

set -euo pipefail

echo "🌱 SentinelAI — Seeding Database"

# Run seed files in order
for seed_file in supabase/seed/*.sql; do
    echo "Running: $seed_file"
    supabase db execute --file "$seed_file"
done

echo "✅ Database seeded successfully!"