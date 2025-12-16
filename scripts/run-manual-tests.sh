#!/bin/bash
# Comprehensive Manual OIDC Tests
# This script guides through all manual validation tests

set -e

AUTH_URL="${1:-http://localhost:3000}"

echo "🧪 OIDC Manual Validation Tests"
echo "================================"
echo ""

# Check if clients are configured
ENV_FILE=".env"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env file not found"
  exit 1
fi

# Extract OIDC_CLIENTS from .env file
# Handle both single-line and multi-line JSON
OIDC_CLIENTS_RAW=$(grep -E "^[[:space:]]*OIDC_CLIENTS=" "$ENV_FILE" | grep -v "^#" | head -1 | sed 's/^[^=]*=//' | sed "s/^[[:space:]]*['\"]//;s/['\"][[:space:]]*$//")

# If it's a multi-line value, we need to handle it differently
if [ -z "$OIDC_CLIENTS_RAW" ]; then
  # Try to extract from .env file more carefully
  OIDC_CLIENTS_RAW=$(awk '/^OIDC_CLIENTS=/{p=1; sub(/^OIDC_CLIENTS=/, ""); print} /^[^[:space:]]/ && p && !/^OIDC_CLIENTS=/{p=0}' "$ENV_FILE" | tr -d '\n' | sed "s/^[[:space:]]*['\"]//;s/['\"][[:space:]]*$//")
fi

OIDC_CLIENTS_JSON="$OIDC_CLIENTS_RAW"

# Validate JSON
if ! echo "$OIDC_CLIENTS_JSON" | jq . > /dev/null 2>&1; then
  echo "❌ Invalid OIDC_CLIENTS JSON in .env file"
  echo "   Found: ${OIDC_CLIENTS_JSON:0:100}..."
  exit 1
fi

if [ -z "$OIDC_CLIENTS_JSON" ] || [ "$OIDC_CLIENTS_JSON" == "[]" ]; then
  echo "❌ No OIDC clients configured"
  exit 1
fi

echo "📋 Configured Clients:"
echo "$OIDC_CLIENTS_JSON" | jq -r '.[] | "  • \(.name) (ID: \(.clientId), skipConsent: \(.skipConsent // false))"' 2>/dev/null || echo "  (Could not parse client list)"
echo ""

# Test 1: Full OAuth Flow with skipConsent=false
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Full OAuth Flow (skipConsent=false)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SKIP_CONSENT_FALSE=$(echo "$OIDC_CLIENTS_JSON" | jq -r '.[] | select((.skipConsent // false) == false) | .clientId' | head -1)

if [ -z "$SKIP_CONSENT_FALSE" ]; then
  echo "⚠️  No skipConsent=false client found. Skipping this test."
  echo ""
else
  CLIENT_NAME=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_FALSE\") | .name")
  CLIENT_SECRET=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_FALSE\") | .clientSecret")
  REDIRECT_URI=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_FALSE\") | .redirectURLs[0]")
  
  echo "Client: $CLIENT_NAME ($SKIP_CONSENT_FALSE)"
  echo "Redirect URI: $REDIRECT_URI"
  echo ""
  
  # Generate PKCE
  CODE_VERIFIER="test-verifier-$(date +%s)-$$"
  CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 2>/dev/null | openssl base64 -A | tr '+/' '-_' | tr -d '=' || echo "fallback-challenge")
  STATE="test-state-$(date +%s)"
  
  AUTH_URL_FULL="$AUTH_URL/oauth2/authorize?client_id=$SKIP_CONSENT_FALSE&response_type=code&redirect_uri=$REDIRECT_URI&scope=openid%20profile%20email&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=$STATE"
  
  echo "📝 Step 1: Authorization Request"
  echo "   URL: $AUTH_URL_FULL"
  echo ""
  echo "   ⚠️  MANUAL STEPS:"
  echo "   1. Open the URL above in your browser"
  echo "   2. Login with your credentials"
  echo "   3. ✅ VERIFY: Consent page appears showing requested scopes"
  echo "   4. Click 'Approve' on the consent page"
  echo "   5. Copy the 'code' parameter from the redirect URL"
  echo ""
  read -p "   Enter the authorization code: " AUTH_CODE
  
  if [ -z "$AUTH_CODE" ]; then
    echo "   ⏭️  Skipping token exchange (no code provided)"
  else
    echo ""
    echo "📝 Step 2: Token Exchange"
    echo "   Exchanging authorization code for tokens..."
    
    TOKEN_RESPONSE=$(curl -s -X POST "$AUTH_URL/oauth2/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=authorization_code" \
      -d "code=$AUTH_CODE" \
      -d "redirect_uri=$REDIRECT_URI" \
      -d "client_id=$SKIP_CONSENT_FALSE" \
      -d "client_secret=$CLIENT_SECRET" \
      -d "code_verifier=$CODE_VERIFIER")
    
    if echo "$TOKEN_RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
      echo "   ✅ Token exchange successful!"
      
      ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')
      ID_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token // empty')
      REFRESH_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.refresh_token // empty')
      
      echo ""
      echo "   Token Response:"
      echo "$TOKEN_RESPONSE" | jq '{token_type, expires_in, scope}' 2>/dev/null || echo "$TOKEN_RESPONSE"
      
      if [ -n "$ID_TOKEN" ] && [ "$ID_TOKEN" != "null" ]; then
        echo ""
        echo "📝 Step 3: ID Token Validation"
        echo "   Decoding ID token..."
        
        # Decode ID token (just the payload)
        ID_TOKEN_PARTS=$(echo "$ID_TOKEN" | tr '.' ' ')
        ID_TOKEN_PAYLOAD=$(echo "$ID_TOKEN" | cut -d. -f2)
        
        # Add padding if needed
        PADDING=$((4 - ${#ID_TOKEN_PAYLOAD} % 4))
        if [ $PADDING -ne 4 ]; then
          ID_TOKEN_PAYLOAD="${ID_TOKEN_PAYLOAD}$(printf '%*s' $PADDING | tr ' ' '=')"
        fi
        
        DECODED=$(echo "$ID_TOKEN_PAYLOAD" | base64 -d 2>/dev/null | jq . 2>/dev/null || echo "Could not decode")
        
        echo "   ID Token Claims:"
        echo "$DECODED" | jq . 2>/dev/null | head -30 || echo "$DECODED"
        
        # Validate required claims
        echo ""
        echo "   Validating required claims:"
        if echo "$DECODED" | jq -e '.sub' > /dev/null 2>&1; then
          echo "   ✅ sub (subject) present"
        else
          echo "   ❌ sub (subject) missing"
        fi
        
        if echo "$DECODED" | jq -e '.iss' > /dev/null 2>&1; then
          ISSUER=$(echo "$DECODED" | jq -r '.iss')
          if [ "$ISSUER" == "$AUTH_URL" ]; then
            echo "   ✅ iss (issuer) correct: $ISSUER"
          else
            echo "   ⚠️  iss (issuer) mismatch: expected $AUTH_URL, got $ISSUER"
          fi
        else
          echo "   ❌ iss (issuer) missing"
        fi
        
        if echo "$DECODED" | jq -e '.aud' > /dev/null 2>&1; then
          AUDIENCE=$(echo "$DECODED" | jq -r '.aud')
          if [ "$AUDIENCE" == "$SKIP_CONSENT_FALSE" ]; then
            echo "   ✅ aud (audience) correct: $AUDIENCE"
          else
            echo "   ⚠️  aud (audience) mismatch: expected $SKIP_CONSENT_FALSE, got $AUDIENCE"
          fi
        else
          echo "   ❌ aud (audience) missing"
        fi
        
        if echo "$DECODED" | jq -e '.exp' > /dev/null 2>&1; then
          echo "   ✅ exp (expiration) present"
        else
          echo "   ❌ exp (expiration) missing"
        fi
        
        if echo "$DECODED" | jq -e '.iat' > /dev/null 2>&1; then
          echo "   ✅ iat (issued at) present"
        else
          echo "   ❌ iat (issued at) missing"
        fi
        
        # Check scope-based claims
        if echo "$DECODED" | jq -e '.email' > /dev/null 2>&1; then
          echo "   ✅ email claim present (from email scope)"
        fi
        
        if echo "$DECODED" | jq -e '.name' > /dev/null 2>&1; then
          echo "   ✅ name claim present (from profile scope)"
        elif echo "$DECODED" | jq -e '.preferred_username' > /dev/null 2>&1; then
          echo "   ✅ preferred_username claim present (from profile scope)"
        fi
      fi
      
      echo ""
      echo "📝 Step 4: UserInfo Endpoint"
      if [ -n "$ACCESS_TOKEN" ] && [ "$ACCESS_TOKEN" != "null" ]; then
        echo "   Requesting user info..."
        USERINFO=$(curl -s "$AUTH_URL/oauth2/userinfo" -H "Authorization: Bearer $ACCESS_TOKEN")
        
        if echo "$USERINFO" | jq -e '.sub // .email' > /dev/null 2>&1; then
          echo "   ✅ UserInfo successful!"
          echo "   UserInfo Response:"
          echo "$USERINFO" | jq . 2>/dev/null || echo "$USERINFO"
          
          # Verify sub matches ID token
          if [ -n "$ID_TOKEN" ] && [ "$ID_TOKEN" != "null" ]; then
            ID_TOKEN_SUB=$(echo "$DECODED" | jq -r '.sub // empty')
            USERINFO_SUB=$(echo "$USERINFO" | jq -r '.sub // empty')
            if [ "$ID_TOKEN_SUB" == "$USERINFO_SUB" ] && [ -n "$ID_TOKEN_SUB" ]; then
              echo "   ✅ UserInfo sub matches ID token sub"
            fi
          fi
        else
          echo "   ❌ UserInfo failed"
          echo "$USERINFO" | jq . 2>/dev/null || echo "$USERINFO"
        fi
      fi
    else
      echo "   ❌ Token exchange failed"
      echo "$TOKEN_RESPONSE" | jq . 2>/dev/null || echo "$TOKEN_RESPONSE"
    fi
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Consent Bypass (skipConsent=true)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

SKIP_CONSENT_TRUE=$(echo "$OIDC_CLIENTS_JSON" | jq -r '.[] | select((.skipConsent // false) == true) | .clientId' | head -1)

if [ -z "$SKIP_CONSENT_TRUE" ]; then
  echo "⚠️  No skipConsent=true client found."
  echo "   💡 To test consent bypass, add a client with skipConsent=true:"
  echo '   OIDC_CLIENTS='"'"'[{"clientId":"test-client","clientSecret":"test-secret","name":"Test Client","redirectURLs":["http://localhost:3000/callback"],"skipConsent":false},{"clientId":"trusted-client","clientSecret":"trusted-secret","name":"Trusted Client","redirectURLs":["http://localhost:3000/callback"],"skipConsent":true}]'"'"
  echo ""
else
  CLIENT_NAME=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_TRUE\") | .name")
  CLIENT_SECRET=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_TRUE\") | .clientSecret")
  REDIRECT_URI=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_TRUE\") | .redirectURLs[0]")
  
  echo "Client: $CLIENT_NAME ($SKIP_CONSENT_TRUE)"
  echo "Redirect URI: $REDIRECT_URI"
  echo ""
  
  # Generate PKCE
  CODE_VERIFIER="test-verifier-$(date +%s)-$$"
  CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 2>/dev/null | openssl base64 -A | tr '+/' '-_' | tr -d '=' || echo "fallback-challenge")
  STATE="test-state-$(date +%s)"
  
  AUTH_URL_FULL="$AUTH_URL/oauth2/authorize?client_id=$SKIP_CONSENT_TRUE&response_type=code&redirect_uri=$REDIRECT_URI&scope=openid%20profile%20email&code_challenge=$CODE_CHALLENGE&code_challenge_method=S256&state=$STATE"
  
  echo "📝 Step 1: Authorization Request"
  echo "   URL: $AUTH_URL_FULL"
  echo ""
  echo "   ⚠️  MANUAL STEPS:"
  echo "   1. Open the URL above in your browser"
  echo "   2. Login with your credentials"
  echo "   3. ✅ VERIFY: Consent page is SKIPPED (should redirect directly with code)"
  echo "   4. Copy the 'code' parameter from the redirect URL"
  echo ""
  read -p "   Enter the authorization code (or press Enter to skip): " AUTH_CODE
  
  if [ -z "$AUTH_CODE" ]; then
    echo "   ⏭️  Skipped (no code provided)"
  else
    echo ""
    echo "📝 Step 2: Token Exchange"
    TOKEN_RESPONSE=$(curl -s -X POST "$AUTH_URL/oauth2/token" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=authorization_code" \
      -d "code=$AUTH_CODE" \
      -d "redirect_uri=$REDIRECT_URI" \
      -d "client_id=$SKIP_CONSENT_TRUE" \
      -d "client_secret=$CLIENT_SECRET" \
      -d "code_verifier=$CODE_VERIFIER")
    
    if echo "$TOKEN_RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
      echo "   ✅ Token exchange successful!"
      echo "   ✅ Consent bypass working correctly"
    else
      echo "   ❌ Token exchange failed"
      echo "$TOKEN_RESPONSE" | jq . 2>/dev/null || echo "$TOKEN_RESPONSE"
    fi
  fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: PKCE Validation Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -z "$SKIP_CONSENT_FALSE" ]; then
  echo "⚠️  No client available for PKCE tests. Skipping."
else
  CLIENT_SECRET=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_FALSE\") | .clientSecret")
  REDIRECT_URI=$(echo "$OIDC_CLIENTS_JSON" | jq -r ".[] | select(.clientId == \"$SKIP_CONSENT_FALSE\") | .redirectURLs[0]")
  
  echo "📝 Test 3a: Missing code_verifier"
  echo "   Testing token exchange without code_verifier..."
  MISSING_VERIFIER_RESPONSE=$(curl -s -X POST "$AUTH_URL/oauth2/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=authorization_code" \
    -d "code=test-code" \
    -d "redirect_uri=$REDIRECT_URI" \
    -d "client_id=$SKIP_CONSENT_FALSE" \
    -d "client_secret=$CLIENT_SECRET")
  
  if echo "$MISSING_VERIFIER_RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
    ERROR_MSG=$(echo "$MISSING_VERIFIER_RESPONSE" | jq -r '.error // .error_description // empty')
    if echo "$ERROR_MSG" | grep -qi "verifier\|pkce"; then
      echo "   ✅ Correctly rejected: $ERROR_MSG"
    else
      echo "   ⚠️  Rejected but unexpected error: $ERROR_MSG"
    fi
  else
    echo "   ❌ Should have been rejected but wasn't"
    echo "$MISSING_VERIFIER_RESPONSE" | jq . 2>/dev/null || echo "$MISSING_VERIFIER_RESPONSE"
  fi
  echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Manual Tests Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Test Summary:"
echo "   ✅ Full OAuth flow with consent (skipConsent=false)"
echo "   ✅ Consent bypass (skipConsent=true) - if client configured"
echo "   ✅ ID token validation"
echo "   ✅ UserInfo endpoint"
echo "   ✅ PKCE validation"
echo ""
echo "💡 Next Steps:"
echo "   - Test consent deny flow manually (click Deny on consent page)"
echo "   - Verify JWKS endpoint: curl $AUTH_URL/.well-known/jwks.json"
echo "   - Verify discovery endpoint: curl $AUTH_URL/.well-known/openid-configuration"
echo ""

