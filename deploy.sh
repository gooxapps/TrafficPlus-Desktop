#!/bin/bash

# TrafficPlus Vercel Deployment Script
# This script automates the deployment process to Vercel

set -e

echo "🚀 Starting TrafficPlus deployment to Vercel..."

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit - TrafficPlus project"
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already exists"
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📥 Installing Vercel CLI..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

# Login to Vercel (if not already logged in)
echo "🔐 Checking Vercel authentication..."
vercel whoami &> /dev/null || {
    echo "Please login to Vercel:"
    vercel login
}

# Deploy to Vercel
echo "🌐 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo "📝 Don't forget to add these environment variables in Vercel dashboard:"
echo "   - VITE_SUPABASE_URL"
echo "   - VITE_SUPABASE_ANON_KEY"
