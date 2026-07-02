#!/usr/bin/env bash
set -euo pipefail

# Imports CSV files from migrations/csv into Supabase Postgres using PG_CONN env var
# Usage: export PG_CONN="postgresql://user:pass@host:5432/postgres"; ./import_csv_to_supabase.sh

OUT_DIR=${1:-migrations/csv}
if [ -z "${PG_CONN:-}" ]; then
  echo "Please set PG_CONN environment variable to your Supabase Postgres connection string."
  exit 1
fi

import_table() {
  local table=$1
  echo "Importing $OUT_DIR/$table.csv -> $table"
  psql "$PG_CONN" -c "\copy $table FROM '$OUT_DIR/$table.csv' CSV HEADER;"
}

import_table users
import_table user_login_history
import_table campaigns
import_table activities
import_table referrals
import_table notifications
import_table contacts
import_table saved_campaigns
import_table proxies
import_table visitors

echo "Import complete. Run verification queries in psql or Supabase SQL editor."
