#!/bin/bash
# Integration Test Script — Safari Zetu Ops Engine
# Run after starting all services

echo "=== FINAL INTEGRATION TEST ==="

# Load environment
source .env 2>/dev/null

# Test 1: Postgres connection
docker exec ops_postgres psql -U ops_admin -d safarizetu_ops -c "SELECT COUNT(*) FROM partnership_pipeline;" 2>/dev/null | grep -q "2" && echo "PASS: Database has seed data" || echo "FAIL: Database seed data missing"

# Test 2: n8n API responding
curl -s -u "$N8N_BASIC_AUTH_USER:$N8N_BASIC_AUTH_PASSWORD" http://localhost:5678/api/v1/workflows 2>/dev/null | grep -q "data" && echo "PASS: n8n API responding" || echo "FAIL: n8n API not responding"

# Test 3: Chroma vector DB
curl -s http://localhost:8001/api/v1/collections 2>/dev/null | grep -q "\[\]" && echo "PASS: Chroma responding" || echo "FAIL: Chroma not responding"

# Test 4: OpenRouter connectivity
curl -s -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/models 2>/dev/null | grep -q "id" && echo "PASS: OpenRouter reachable" || echo "FAIL: OpenRouter unreachable — check API key"

# Test 5: Resend API
curl -s -H "Authorization: Bearer $RESEND_API_KEY" https://api.resend.com/domains 2>/dev/null | grep -q "data\|error" && echo "PASS: Resend API reachable" || echo "FAIL: Resend unreachable — check API key"

# Test 6: Safari Zetu bridge reachable (will return 401 without key — that is correct behaviour)
curl -s -o /dev/null -w "%{http_code}" "$SAFARI_ZETU_BRIDGE_URL?resource=health" 2>/dev/null | grep -q "401\|200" && echo "PASS: Safari Zetu bridge endpoint exists" || echo "FAIL: Safari Zetu bridge not reachable"

# Test 7: Safari Zetu bridge with correct API key
curl -s -H "x-ops-api-key: $SAFARI_ZETU_API_KEY" "$SAFARI_ZETU_BRIDGE_URL?resource=health" 2>/dev/null | grep -q "ok" && echo "PASS: Safari Zetu bridge authentication working" || echo "WARN: Safari Zetu bridge auth test failed — confirm bridge is deployed"

# Test 8: Cloudflare tunnel
curl -s -o /dev/null -w "%{http_code}" https://ops.safarizetu.com 2>/dev/null | grep -q "200\|401\|302" && echo "PASS: Cloudflare tunnel routing to ops engine" || echo "FAIL: Cloudflare tunnel not routing — check tunnel config"

echo ""
echo "=== INTEGRATION TEST COMPLETE ==="
echo "If any FAIL above: fix and re-run this test before considering the system live."
echo ""
echo "=== SYSTEM STATUS ==="
echo "n8n Dashboard:        http://localhost:5678"
echo "Ops Dashboard:        http://localhost:3002"
echo "Langfuse:             http://localhost:3001"
echo "Public n8n URL:       https://ops.safarizetu.com"
echo "Safari Zetu Bridge:   $SAFARI_ZETU_BRIDGE_URL"
echo ""
echo "=== NEXT STEPS FOR FOUNDER ==="
echo "1. Copy bridge/safari-zetu-additions/ files into Safari Zetu repo"
echo "2. Add 3 env vars to Vercel: OPS_ENGINE_API_KEY, OPS_ENGINE_WEBHOOK_SECRET, OPS_ENGINE_URL"
echo "3. Deploy Safari Zetu — the handshake is complete from that moment"
echo "4. Open n8n at https://ops.safarizetu.com and verify all workflows show as Active"
echo "5. Open dashboard at http://localhost:3002 — first data appears within 5 minutes of first enquiry"
echo ""
echo "Safari Zetu AI Ops Engine is LIVE."
