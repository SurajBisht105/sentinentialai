#!/bin/bash
# scripts/reset_dev.sh — Reset dev database

set -euo pipefail

echo "⚠️  Resetting development database..."
read -p "Are you sure? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

supabase db reset

echo "✅ Database reset complete. Running seeds..."
bash scripts/seed.sh