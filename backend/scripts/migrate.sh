#!/bin/bash
# scripts/migrate.sh — Run all Supabase migrations

set -euo pipefail

echo "🚀 SentinelAI — Running Database Migrations"

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install: npm install -g supabase"
    exit 1
fi

# Link to project
supabase link --project-ref "$SUPABASE_PROJECT_REF"

# Run migrations
echo "📦 Pushing migrations..."
supabase db push

# Verify
echo "✅ Running post-migration verification..."
supabase db diff --linked

echo ""
echo "✅ Migrations completed successfully!"
echo "📊 Database is ready for SentinelAI"