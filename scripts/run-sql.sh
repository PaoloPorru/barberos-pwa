#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Imposta DATABASE_URL (URI Postgres da Supabase → Settings → Database)."
  echo "Esempio: postgresql://postgres.[ref]:PASSWORD@db.[ref].supabase.co:5432/postgres"
  exit 1
fi
SQL="${1:?Uso: DATABASE_URL=... $0 file.sql}"
if [[ ! -f "$SQL" ]]; then
  echo "File non trovato: $SQL"
  exit 1
fi
command -v psql >/dev/null 2>&1 || { echo "Installa psql (PostgreSQL client)."; exit 1; }
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "OK: $SQL"
