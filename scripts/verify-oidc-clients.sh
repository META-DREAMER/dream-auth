#!/bin/bash
# Verify OIDC Client DB Seeding
# Usage: ./scripts/verify-oidc-clients.sh [DATABASE_URL]
#
# This script verifies that OIDC clients are properly seeded in the database.
# It checks the oauthApplication table for expected clients.

set -e

DATABASE_URL="${1:-$DATABASE_URL}"

if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL not provided"
  echo ""
  echo "Usage: ./scripts/verify-oidc-clients.sh [DATABASE_URL]"
  echo "   or: DATABASE_URL=postgresql://... ./scripts/verify-oidc-clients.sh"
  exit 1
fi

echo "🔍 Verifying OIDC clients in database..."
echo ""

# Query the oauthApplication table
CLIENTS=$(psql "$DATABASE_URL" -t -A -c "
  SELECT json_agg(json_build_object(
    'clientId', \"clientId\",
    'name', \"name\",
    'type', \"type\",
    'disabled', \"disabled\",
    'redirectUrls', \"redirectUrls\",
    'createdAt', \"createdAt\",
    'updatedAt', \"updatedAt\"
  )) FROM \"oauthApplication\"
" 2>/dev/null)

if [ $? -ne 0 ]; then
  echo "❌ Error: Failed to query database"
  echo "   Make sure the database is accessible and migrations have been run."
  exit 1
fi

if [ -z "$CLIENTS" ] || [ "$CLIENTS" == "null" ]; then
  echo "⚠️  No OIDC clients found in database"
  echo ""
  echo "This could mean:"
  echo "  1. No clients are configured in OIDC_CLIENTS or OIDC_CLIENTS_FILE"
  echo "  2. The auth server hasn't received any requests yet (seeding happens on first request)"
  echo "  3. ENABLE_OIDC_PROVIDER is not set to true"
  exit 0
fi

# Parse and display clients
CLIENT_COUNT=$(echo "$CLIENTS" | jq 'length')
echo "✅ Found $CLIENT_COUNT OIDC client(s) in database:"
echo ""

echo "$CLIENTS" | jq -r '.[] | "   - \(.clientId) (\(.name)) - type: \(.type), disabled: \(.disabled)"'

echo ""
echo "📋 Detailed view:"
echo "$CLIENTS" | jq '.'

echo ""
echo "🎉 OIDC client verification complete!"
echo ""
echo "Note: Client secrets are stored in the database but not displayed here for security."
