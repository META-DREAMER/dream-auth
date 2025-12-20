# Manual OIDC Test Instructions

## Quick Start

Run the interactive test script:

```bash
./scripts/run-manual-tests.sh http://localhost:3000
```

Or follow the steps below manually.

## Test 1: Full OAuth Flow (skipConsent=false)

### Step 1: Authorization Request

**Test Client:** test-client (skipConsent: false)

Generate PKCE challenge:

```bash
CODE_VERIFIER="test-verifier-$(date +%s)"
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | openssl base64 -A | tr '+/' '-_' | tr -d '=')
```

**Authorization URL:**

```
http://localhost:3000/oauth2/authorize?client_id=test-client&response_type=code&redirect_uri=http://localhost:3000/callback&scope=openid%20profile%20email&code_challenge=<CODE_CHALLENGE>&code_challenge_method=S256&state=test-state
```

**Manual Steps:**

1. Open the authorization URL in your browser
2. ✅ **VERIFY:** You are redirected to the login page
3. Login with your credentials
4. ✅ **VERIFY:** After login, the **consent page appears** showing:
   - Client name: "Test Client"
   - Requested scopes: OpenID, Profile, Email
   - Approve/Deny buttons
5. Click "Approve"
6. ✅ **VERIFY:** You are redirected to `http://localhost:3000/callback?code=<authorization_code>&state=test-state`
7. Copy the `code` parameter from the URL

### Step 2: Token Exchange

```bash
curl -X POST http://localhost:3000/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=<AUTHORIZATION_CODE>" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=test-client" \
  -d "client_secret=test-secret" \
  -d "code_verifier=<CODE_VERIFIER>"
```

**Expected Response:**

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "id_token": "...",
  "scope": "openid profile email"
}
```

✅ **VERIFY:**

- `access_token` is present
- `id_token` is present
- `token_type` is "Bearer"

### Step 3: ID Token Validation

Decode the ID token (it's a JWT with 3 parts separated by dots):

```bash
# Extract the payload (middle part)
ID_TOKEN="<id_token_from_step_2>"
ID_TOKEN_PAYLOAD=$(echo "$ID_TOKEN" | cut -d. -f2)

# Add padding if needed and decode
echo "$ID_TOKEN_PAYLOAD" | base64 -d | jq .
```

✅ **VERIFY Required Claims:**

- `sub` (subject) - user identifier
- `iss` (issuer) - should be `http://localhost:3000`
- `aud` (audience) - should be `test-client`
- `exp` (expiration) - timestamp
- `iat` (issued at) - timestamp

✅ **VERIFY Scope-based Claims:**

- `email` - present (from `email` scope)
- `name` or `preferred_username` - present (from `profile` scope)

### Step 4: UserInfo Endpoint

```bash
curl http://localhost:3000/oauth2/userinfo \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

**Expected Response:**

```json
{
  "sub": "...",
  "email": "...",
  "name": "..."
}
```

✅ **VERIFY:**

- Returns user information
- `sub` matches the ID token's `sub`
- Email and profile information present

## Test 2: Consent Bypass (skipConsent=true)

To test consent bypass, add a client with `skipConsent=true`:

```bash
# Add to .env
OIDC_CLIENTS='[
  {"clientId":"test-client","clientSecret":"test-secret","name":"Test Client","type":"web","redirectURLs":["http://localhost:3000/callback"],"skipConsent":false},
  {"clientId":"trusted-client","clientSecret":"trusted-secret","name":"Trusted Client","type":"web","redirectURLs":["http://localhost:3000/callback"],"skipConsent":true}
]'
```

Then restart the server and test with `trusted-client`:

**Authorization URL:**

```
http://localhost:3000/oauth2/authorize?client_id=trusted-client&response_type=code&redirect_uri=http://localhost:3000/callback&scope=openid%20profile%20email&code_challenge=<CODE_CHALLENGE>&code_challenge_method=S256&state=test-state
```

**Manual Steps:**

1. Open the authorization URL
2. Login with your credentials
3. ✅ **VERIFY:** Consent page is **SKIPPED** - you are redirected directly with the authorization code
4. Complete token exchange as in Test 1, Step 2

## Test 3: Consent Deny Flow

Using the `test-client` (skipConsent=false):

1. Go through authorization and login
2. On the consent page, click **"Deny"**
3. ✅ **VERIFY:** You are redirected to the callback URL with an `error` parameter:
   ```
   http://localhost:3000/callback?error=access_denied&error_description=...
   ```

## Test 4: PKCE Validation

### Test 4a: Missing code_verifier

```bash
curl -X POST http://localhost:3000/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=test-code" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=test-client" \
  -d "client_secret=test-secret"
```

✅ **VERIFY:** Returns error: `"code verifier is missing"`

### Test 4b: Invalid code_verifier

Use a valid authorization code but with wrong `code_verifier`:

```bash
curl -X POST http://localhost:3000/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=<VALID_CODE>" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=test-client" \
  -d "client_secret=test-secret" \
  -d "code_verifier=wrong-verifier"
```

✅ **VERIFY:** Returns error: `"invalid code"` or `"invalid code_verifier"`

## Validation Checklist

### Discovery Endpoint ✅

- [x] Returns 200
- [x] Correct issuer
- [x] All endpoints correct

### JWKS Endpoint ✅

- [x] Returns 200
- [x] Valid keys array
- [x] Cache-Control header present

### Authorization Code Flow

- [ ] Redirects to login when unauthenticated ✅
- [ ] Consent page appears for skipConsent=false ⚠️ (manual test)
- [ ] Consent page bypassed for skipConsent=true ⚠️ (manual test)
- [ ] Authorization code returned in redirect ⚠️ (manual test)
- [ ] Token exchange successful ⚠️ (manual test)
- [ ] UserInfo returns claims ⚠️ (manual test)

### PKCE Validation ✅

- [x] Missing code_verifier rejected
- [x] Invalid code_verifier rejected
- [x] Valid PKCE flow works ⚠️ (manual test)

### Consent Flow

- [ ] skipConsent=false shows consent ⚠️ (manual test)
- [ ] skipConsent=true bypasses consent ⚠️ (manual test)
- [ ] Deny button returns error ⚠️ (manual test)
- [ ] Approve button returns code ⚠️ (manual test)

### ID Token

- [ ] Contains required claims (sub, iss, aud, exp, iat) ⚠️ (manual test)
- [ ] Signature can be verified using JWKS ⚠️ (manual test)
- [ ] Contains scope-based claims ⚠️ (manual test)

### OIDC Client DB Seeding

- [ ] Clients logged on startup (IDs only, no secrets) ⚠️ (check logs)
- [ ] Clients seeded to oauthApplication table ⚠️ (check database)
- [ ] Token exchange succeeds (no FK constraint violation) ⚠️ (manual test)
- [ ] Seeding is idempotent on restart ⚠️ (restart and verify)
- [ ] Public clients work without clientSecret ⚠️ (manual test)

## Test 5: OIDC Client DB Seeding Verification

This test verifies that configured OIDC clients are automatically seeded into the database on startup, fixing the FK constraint issue with `trustedClients` (see [Better Auth issue #6649](https://github.com/better-auth/better-auth/issues/6649)).

### Step 1: Configure a Test Client

Add a client to your environment:

```bash
# Add to .env
OIDC_CLIENTS='[
  {"clientId":"db-seed-test","clientSecret":"db-seed-secret","name":"DB Seed Test","type":"web","redirectURLs":["http://localhost:3000/callback"],"skipConsent":false}
]'
```

### Step 2: Start/Restart the Server

```bash
pnpm run dev
```

✅ **VERIFY:** Console shows:

```
[OIDC] Loaded 1 client(s): db-seed-test
[OIDC] Seeding 1 client(s) to database: db-seed-test
[OIDC] Successfully seeded 1 client(s) to database
```

### Step 3: Verify Database Record

Connect to your PostgreSQL database and verify the client exists:

```sql
SELECT "clientId", "name", "type", "disabled"
FROM "oauthApplication"
WHERE "clientId" = 'db-seed-test';
```

✅ **VERIFY:**

- Row exists with correct `clientId`, `name`, `type`
- `clientSecret` is stored (not logged to console)

### Step 4: Test Token Exchange (FK Integrity)

Complete a full OAuth flow with the seeded client:

1. Generate PKCE challenge and open authorization URL
2. Login and approve consent
3. Exchange code for tokens

```bash
curl -X POST http://localhost:3000/oauth2/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=<AUTHORIZATION_CODE>" \
  -d "redirect_uri=http://localhost:3000/callback" \
  -d "client_id=db-seed-test" \
  -d "client_secret=db-seed-secret" \
  -d "code_verifier=<CODE_VERIFIER>"
```

✅ **VERIFY:**

- Token exchange succeeds (no FK constraint violation)
- `access_token` and `id_token` returned

### Step 5: Verify Idempotency

Restart the server multiple times and verify:

- Seeding completes without errors
- No duplicate entries in database
- Existing clients are updated (upsert behavior)

### Client Configuration Schema

The OIDC client configuration now supports these fields:

| Field          | Required | Description                                                                 |
| -------------- | -------- | --------------------------------------------------------------------------- |
| `clientId`     | Yes      | Unique client identifier                                                    |
| `clientSecret` | No\*     | Secret for confidential clients (\*required unless type="public")           |
| `name`         | Yes      | Display name for consent screen                                             |
| `type`         | No       | Client type: "web", "native", "user-agent-based", "public" (default: "web") |
| `redirectURLs` | Yes      | Array of allowed redirect URIs                                              |
| `skipConsent`  | No       | Skip consent for trusted clients (default: false)                           |
| `disabled`     | No       | Disable the client (default: false)                                         |
| `icon`         | No       | Icon URL for consent screen                                                 |
| `metadata`     | No       | Additional metadata as JSON object                                          |
| `userId`       | No       | Optional owner user ID                                                      |

### Public Client Example (PKCE only, no secret)

```json
{
  "clientId": "mobile-app",
  "name": "Mobile App",
  "type": "public",
  "redirectURLs": ["myapp://callback"],
  "skipConsent": true
}
```

## Notes

- All automated tests pass ✅
- Manual tests require browser interaction and valid user credentials
- PKCE is enforced at token exchange level (valid implementation)
- EdDSA keys are used instead of RSA (valid for OIDC)
- OIDC clients are automatically seeded to DB on first auth request
- Client seeding is idempotent and safe for concurrent startup (multiple pods)







