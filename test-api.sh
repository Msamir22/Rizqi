#!/bin/bash

# Quick test script for Astik API endpoints
# Run this after setting up Supabase and starting the API server

API_URL="http://localhost:3001"
CRON_SECRET="your_cron_secret_here"  # Replace with your actual secret from .env.local

echo "🧪 Testing Astik API Endpoints..."
echo ""

# Test 1: Health check
echo "1️⃣  Testing health check (GET /)..."
curl -s $API_URL | jq '.'
echo ""
echo ""

# Test 2: Mock rates
echo "2️⃣  Testing mock rates (GET /api/mock/rates)..."
curl -s $API_URL/api/mock/rates | jq '.metals, .currencies'
echo ""
echo ""

# Test 3: Update rates from metals.dev
echo "3️⃣  Triggering rate update (POST /api/rates/update)..."
echo "⚠️  This will consume 1 API call from your metals.dev quota"
echo "Press Ctrl+C to cancel, or Enter to continue..."
read

curl -s -X POST $API_URL/api/rates/update \
  -H "x-cron-secret: $CRON_SECRET" | jq '.'
echo ""
echo ""

# Test 4: Get cached rates
echo "4️⃣  Testing cached rates (GET /api/rates)..."
sleep 1  # Wait a moment for the update to complete
curl -s $API_URL/api/rates | jq '.metals, .currencies'
echo ""
echo ""

echo "✅ All tests complete!"
echo ""
echo "💡 Tip: Check the API server logs for detailed output"
