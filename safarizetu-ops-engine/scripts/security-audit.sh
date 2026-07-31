#!/bin/bash
# Security Audit Script — Safari Zetu Ops Engine
# Run this before deploying to production

echo "=== SECURITY AUDIT ==="

# 1. .env not committed
grep -q ".env" .gitignore && echo "PASS: .env in .gitignore" || echo "FAIL: .env NOT in gitignore — CRITICAL"

# 2. No hardcoded secrets in source files
HARDCODED=$(grep -rn "sk-\|re_\|Bearer [a-zA-Z0-9]" src/ dashboard/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".env" | grep -v "process.env" | wc -l)
[ "$HARDCODED" -eq 0 ] && echo "PASS: No hardcoded secrets" || echo "FAIL: Hardcoded secrets found — CRITICAL"

# 3. HMAC verification present in webhook receiver
grep -q "verifyWebhookSignature\|timingSafeEqual" src/webhook/receiver.ts && echo "PASS: Webhook signature verification present" || echo "FAIL: Webhook verification missing"

# 4. API key verification present in bridge route
grep -q "verifyApiKey\|timingSafeEqual" bridge/safari-zetu-additions/app/api/ops-bridge/route.ts && echo "PASS: API key verification present" || echo "FAIL: API key verification missing"

# 5. Rate limiting present
grep -q "checkRateLimit\|rateLimit" bridge/safari-zetu-additions/app/api/ops-bridge/route.ts && echo "PASS: Rate limiting present" || echo "FAIL: Rate limiting missing"

# 6. Error handling in agent calls
grep -q "try {" src/services/ai-agent.service.ts && echo "PASS: Error handling in agent service" || echo "FAIL: Error handling missing"

# 7. All external calls have timeouts
grep -q "AbortSignal.timeout\|timeout" src/services/ai-agent.service.ts && echo "PASS: Request timeouts present" || echo "FAIL: Timeouts missing"

# 8. Check for .env in .gitignore (double check)
[ ! -f .env ] || git check-ignore .env > /dev/null 2>&1 && echo "PASS: .env excluded from git" || echo "FAIL: .env may be tracked by git"

# 9. Check directory permissions
PERMS=$(stat -c %a .env 2>/dev/null || echo "644")
[ "$PERMS" = "600" ] && echo "PASS: .env has restrictive permissions" || echo "WARN: .env permissions are $PERMS (recommend 600)"

echo "=== SECURITY AUDIT COMPLETE ==="
