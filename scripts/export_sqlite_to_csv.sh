#!/usr/bin/env bash
set -euo pipefail

# Exports tables from the local SQLite DB to CSV files in migrations/csv
DB_PATH=${1:-data/traffic-plus.db}
OUT_DIR=${2:-migrations/csv}
mkdir -p "$OUT_DIR"

check_table() {
  local table=$1
  sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';" | grep -q .
}

export_table() {
  local table=$1
  local cols=$2
  if ! check_table "$table"; then
    echo "Skipping $table: not present in SQLite database"
    return
  fi
  echo "Exporting $table -> $OUT_DIR/$table.csv"
  sqlite3 "$DB_PATH" <<SQL
.mode csv
.headers on
.output $OUT_DIR/$table.csv
SELECT $cols FROM $table;
.output
.quit
SQL
}

export_table users "id,name,email,phone,role,credits,avatar,bio,created_at,store_raw_ips"
export_table user_login_history "id,user_id,last_login_at,last_login_ip,last_device,last_location,last_user_agent,last_country,last_region,last_city,created_at"
export_table campaigns "id,owner_id,title,url,category,status,credits_allocated,credits_used,daily_limit,target_countries,target_devices,visits_received,mode,search_engine,search_keywords,search_platform,search_target_name,search_page,search_sort,created_at"
export_table visitors "id,campaign_id,ip,ip_hash,country,region,city,latitude,longitude,user_agent,browser,os,device_type,referrer,session_id,created_at"
export_table activities "id,user_id,type,amount,description,campaign_id,created_at"
export_table referrals "id,referrer_id,referred_email,referred_phone,status,earnings,joined_at"
export_table notifications "id,user_id,type,title,message,read,created_at"
export_table contacts "id,user_id,name,email,phone,notes,created_at"
export_table saved_campaigns "id,user_id,name,title,url,category,credits_allocated,daily_limit,target_countries,mode,search_engine,search_keywords,search_platform,search_target_name,search_page,search_sort,created_at"
export_table proxies "id,user_id,type,host,port,username,password,country,timezone,language,created_at"

echo "Export complete. CSVs are in $OUT_DIR"
