#!/usr/bin/env bash
set -euo pipefail
: "${URL:?Set URL to your running base}"
curl -sfS "$URL/api/billing/prices" | grep -E '"pro"|bucket' >/dev/null
echo "billing prices endpoint OK"