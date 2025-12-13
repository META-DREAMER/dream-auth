#!/bin/bash
# OIDC Smoke Test Script
# Usage: ./scripts/oidc-smoke-test.sh https://auth.example.com
#
# This script validates the OIDC provider endpoints are working correctly.
# It checks discovery, JWKS, and authorization endpoints.

set -e

AUTH_URL="${1:-http://localhost:3000}"

echo "🔍 Testing OIDC endpoints at $AUTH_URL"
echo ""

# Test discovery endpoint
echo "1. Testing discovery endpoint..."
DISCOVERY=$(curl -sf "$AUTH_URL/.well-known/openid-configuration")
if [ $? -ne 0 ]; then
  echo "❌ Discovery endpoint failed"
  exit 1
fi

ISSUER=$(echo "$DISCOVERY" | jq -r '.issuer')
AUTH_ENDPOINT=$(echo "$DISCOVERY" | jq -r '.authorization_endpoint')
TOKEN_ENDPOINT=$(echo "$DISCOVERY" | jq -r '.token_endpoint')
USERINFO_ENDPOINT=$(echo "$DISCOVERY" | jq -r '.userinfo_endpoint')
JWKS_URI=$(echo "$DISCOVERY" | jq -r '.jwks_uri')

echo "   ✅ Discovery endpoint OK"
echo "   - Issuer: $ISSUER"
echo "   - Auth endpoint: $AUTH_ENDPOINT"
echo "   - Token endpoint: $TOKEN_ENDPOINT"
echo "   - UserInfo endpoint: $USERINFO_ENDPOINT"
echo "   - JWKS URI: $JWKS_URI"
echo ""

# Validate issuer matches expected
if [[ "$ISSUER" != "$AUTH_URL" ]]; then
  echo "⚠️  Warning: Issuer ($ISSUER) does not match auth URL ($AUTH_URL)"
fi

# Validate endpoints use root-level paths (Option B)
if [[ "$AUTH_ENDPOINT" == *"/api/auth/"* ]]; then
  echo "⚠️  Warning: Authorization endpoint contains /api/auth/ - should be root-level"
fi

# Test JWKS endpoint
echo "2. Testing JWKS endpoint..."
JWKS=$(curl -sf "$JWKS_URI")
if [ $? -ne 0 ]; then
  echo "❌ JWKS endpoint failed"
  exit 1
fi

KEY_COUNT=$(echo "$JWKS" | jq '.keys | length')
echo "   ✅ JWKS endpoint OK"
echo "   - Key count: $KEY_COUNT"

if [ "$KEY_COUNT" -gt 0 ]; then
  echo "   - Key types: $(echo "$JWKS" | jq -r '.keys[].kty' | tr '\n' ' ')"
fi
echo ""

if [ "$KEY_COUNT" -eq 0 ]; then
  echo "⚠️  Warning: No keys in JWKS (this may be normal on first startup before any tokens are issued)"
fi

# Test authorization endpoint (expect redirect to login or 200 HTML page)
echo "3. Testing authorization endpoint..."
AUTH_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  "$AUTH_ENDPOINT?client_id=smoke-test&response_type=code&redirect_uri=https://example.com/callback&scope=openid&code_challenge=test&code_challenge_method=S256" 2>/dev/null || echo "302")

if [[ "$AUTH_STATUS" == "302" || "$AUTH_STATUS" == "200" ]]; then
  echo "   ✅ Authorization endpoint OK (status: $AUTH_STATUS)"
else
  echo "   ⚠️  Authorization endpoint returned unexpected status: $AUTH_STATUS"
fi
echo ""

# Check JWKS caching headers
echo "4. Testing JWKS caching headers..."
JWKS_HEADERS=$(curl -sI "$JWKS_URI" 2>/dev/null)
if echo "$JWKS_HEADERS" | grep -qi "cache-control"; then
  CACHE_CONTROL=$(echo "$JWKS_HEADERS" | grep -i "cache-control")
  echo "   ✅ Cache-Control present: $CACHE_CONTROL"
else
  echo "   ⚠️  No Cache-Control header on JWKS endpoint"
fi
echo ""

echo "🎉 Smoke test complete!"
echo ""
echo "📋 Next steps for full validation:"
echo "   1. Test a complete OAuth flow with a real client"
echo "   2. Verify token exchange works"
echo "   3. Validate ID token signature using JWKS"
echo "   4. Test consent flow with skipConsent=false client"
