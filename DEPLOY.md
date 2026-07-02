# Deploy TrafficPlus to Vercel

## Quick Deploy (One Command)

Run this command in your terminal:

```bash
chmod +x deploy.sh && ./deploy.sh
```

## What the Script Does

1. ✅ Initializes git repository (if not already done)
2. ✅ Installs Vercel CLI (if not already installed)
3. ✅ Logs you into Vercel (if not already logged in)
4. ✅ Deploys your project to Vercel production

## Manual Deployment Steps

If you prefer manual deployment:

### 1. Initialize Git
```bash
git init
git add .
git commit -m "Initial commit"
```

### 2. Install Vercel CLI
```bash
npm install -g vercel
```

### 3. Login to Vercel
```bash
vercel login
```

### 4. Deploy
```bash
vercel --prod
```

## Important: Environment Variables

After deployment, add these in your Vercel dashboard:

1. Go to your project settings on Vercel
2. Navigate to Environment Variables
3. Add:
   - `VITE_SUPABASE_URL` = `https://upusidbyuaxjpcoaupus.backend.onspace.ai`
   - `VITE_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODExMjUyMTcsImV4cCI6MjA5NjQ4NTIxNywiaXNzIjoib25zcGFjZSIsInJlZiI6InVwdXNpZGJ5dWF4anBjb2F1cHVzIiwicm9sZSI6ImFub24ifQ.aOoz4WcxAm16HMkDNxj42omBLhnX-9_l_DLD7VI6B8s`

## Security Warning

⚠️ **Before production deployment**, remove the demo role switching from `src/pages/Settings.tsx` (lines 91-97) to prevent users from switching to admin role.
