# Database migration — SQLite → Supabase (Postgres)

This document explains how to migrate the app's local SQLite database into a Supabase (Postgres) project, import data, and set up basic security and admin APIs.

Keep keys secret. Do NOT embed a `service_role` key in client/Electron code.

---

## Prerequisites
- Supabase project created (Dashboard).
- Supabase CLI installed and logged in (`supabase login`).
- `psql` installed (for bulk imports) or use Supabase SQL editor.
- Local SQLite DB file (the app uses `data/traffic-plus.db` by default).

## Quick overview of steps
1. Create migration SQL (schema) in `migrations/001_init.sql`.
2. Run `supabase db push` or run SQL in Supabase to create tables.
3. Export each SQLite table to CSV locally.
4. Import CSVs into Supabase Postgres using `psql \copy`.
5. Add indexes and verify data.
6. Enable Row-Level Security (RLS) and create policies.
7. Create Edge Functions (or a small server) for admin operations that require the service role key.

## 1) Install & link Supabase CLI
Homebrew (macOS):
```bash
brew tap supabase/cli
brew install supabase/tap/supabase
```
or npm:
```bash
npm install -g supabase
```

Login and link your project:
```bash
supabase login            # open browser and authenticate
supabase link --project-ref <PROJECT_REF>
```

## 2) Create migration SQL
Create a file `migrations/001_init.sql` with your table definitions. Example (save this file locally):

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'user',
  credits INTEGER DEFAULT 250,
  avatar TEXT,
  bio TEXT,
  store_raw_ips BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  last_device TEXT,
  last_location TEXT,
  last_user_agent TEXT,
  last_country TEXT,
  last_region TEXT,
  last_city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_login_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  last_device TEXT,
  last_location TEXT,
  last_user_agent TEXT,
  last_country TEXT,
  last_region TEXT,
  last_city TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add other tables (campaigns, visitors, activities, proxies, site_settings) using similar patterns.
```

Apply the migration with the CLI:
```bash
supabase db push --file migrations/001_init.sql
```

If you prefer the dashboard: open Supabase SQL editor and paste the SQL and run it.

## 3) Export SQLite tables to CSV
Adjust path to your SQLite file. Example for `users`:
```bash
sqlite3 data/traffic-plus.db <<'SQL'
.mode csv
.headers on
.output users.csv
SELECT id,name,email,phone,role,credits,avatar,bio,store_raw_ips,last_login_at,last_login_ip,last_device,last_location,last_user_agent,last_country,last_region,last_city,created_at FROM users;
.output
.quit
SQL
```
Repeat for `user_login_history`, `campaigns`, `visitors`, etc. Use matching column lists to the Postgres schema.

## 4) Import CSVs into Supabase Postgres
Get the DB connection string from Supabase Dashboard → Settings → Database → Connection string. Use `psql` and `\copy` for fast import:

```bash
export PG_CONN="postgresql://postgres:<PASSWORD>@db.<region>.supabase.co:5432/postgres"
psql "$PG_CONN" -c "\copy users(id,name,email,phone,role,credits,avatar,bio,store_raw_ips,last_login_at,last_login_ip,last_device,last_location,last_user_agent,last_country,last_region,last_city,created_at) FROM 'users.csv' CSV HEADER;"
```

Notes:
- Ensure timestamps in CSV are ISO8601 (UTC) or adjust format during import.
- For boolean `store_raw_ips`, map `0/1` or `false/true` accordingly.

## 5) Verify & add indexes
Run basic checks:
```sql
SELECT count(*) FROM users;
SELECT count(*) FROM user_login_history;
```
Add indexes where helpful:
```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_visitors_created_at ON visitors(created_at);
```

## 6) Security — RLS and policies
Enable RLS and create minimal policies:

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT their own row
CREATE POLICY "select_own_user" ON users
  FOR SELECT USING (auth.uid() = id);

-- Admins (Edge function/service role) can SELECT all
CREATE POLICY "admin_select" ON users
  FOR SELECT USING (auth.role() = 'admin');

-- Repeat policies for other tables (campaigns, visitors); be conservative.
```

Important: `auth.uid()` and `auth.role()` are helpers available in Supabase RLS contexts.

## 7) Admin APIs / Edge Functions
- Create Edge Functions for admin-only operations (list/upsert/delete/history) and set the `SERVICE_ROLE` key only in the function environment.
- Example filenames: `functions/admin-users/list/index.ts` and `functions/admin-users/upsert/index.ts`.
- Deploy with:
```bash
supabase functions deploy admin-users-list --project-ref <PROJECT_REF>
```

Edge functions allow you to keep the `service_role` key out of the client and run privileged queries safely.

## 8) Post-migration checklist
- Run app integration tests against the new DB.
- Validate admin flows use Edge Functions (not anon key).
- Rotate the `service_role` key after migration if it was exposed.

## 9) If you want I can generate for you
- `migrations/001_init.sql` (full schema from `electron/db.js`) — I can produce the file now.
- A set of `sqlite3` export scripts for all tables.
- `psql \copy` commands per CSV (automatically generated).
- Example Edge Function templates for admin list/upsert/delete/history.

---
If you want me to generate any of the files above, tell me which (schema SQL, export scripts, import commands, or Edge Function templates) and I will add them into the repo.
