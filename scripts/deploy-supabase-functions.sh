#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v supabase >/dev/null 2>&1 || {
  echo "Installa la Supabase CLI: https://supabase.com/docs/guides/cli"
  echo "  brew install supabase/tap/supabase"
  exit 1
}
supabase functions deploy notify
supabase functions deploy reminder
echo ""
echo "Deploy completato. Prossimi passi: supabase/README.md (webhook + cron + secrets)."
