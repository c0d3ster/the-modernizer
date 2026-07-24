#!/usr/bin/env bash
# compare-generators.sh
#
# Runs all generation methods against a saved schema fixture and
# outputs each result to a separate directory under .generated/.
#
# Usage:
#   ./scripts/compare-generators.sh [path/to/schema.json]
#
# Default schema: packages/extractor/fixtures/edgehill-wayback-2026.json
#
# Prerequisites:
#   - pnpm install has been run
#   - Lovable account in your browser (for --lovable)

set -e

SCHEMA="${1:-packages/extractor/fixtures/edgehill-wayback-2026.json}"

if [ ! -f "$SCHEMA" ]; then
  echo "Schema not found: $SCHEMA"
  echo ""
  echo "Generate it first with:"
  echo "  pnpm modernize \"https://web.archive.org/web/20260411201239/https://edgehillrecovery.org/\" \\"
  echo "    --schema-only --max-pages 20 --output packages/extractor/fixtures"
  echo "  mv packages/extractor/fixtures/schema.json $SCHEMA"
  exit 1
fi

echo "=== Generator comparison ==="
echo "Schema: $SCHEMA"
echo ""

# -- Local template generator --------------------------------------------------
echo "[1/2] Local template generator..."
pnpm modernize --from-schema "$SCHEMA" --local --output .generated/edgehill-local
echo ""

# -- Lovable (opens browser) ---------------------------------------------------
echo "[2/2] Lovable (opening browser)..."
pnpm modernize --from-schema "$SCHEMA" --lovable
echo ""

echo "=== Done ==="
echo ""
echo "Local output:  .generated/edgehill-local"
echo "Lovable:       check your browser"
echo ""
echo "To preview local output:"
echo "  cd .generated/edgehill-local && npm install && npm run dev"
