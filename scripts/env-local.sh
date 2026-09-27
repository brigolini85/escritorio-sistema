#!/usr/bin/env bash
# Grava no .env os endereços e chaves do Supabase local. As outras linhas do .env
# (Z-API, Claude, transcrição etc.) são mantidas; se o .env não existir, é criado.
set -euo pipefail
eval "$(supabase status -o env)"
touch .env
definir() {
  local tmp
  tmp="$(mktemp)"
  CHAVE="$1" VALOR="$2" awk '
    BEGIN { c = ENVIRON["CHAVE"]; v = ENVIRON["VALOR"] }
    index($0, c "=") == 1 { print c "=" v; achou = 1; next }
    { print }
    END { if (!achou) print c "=" v }
  ' .env > "$tmp"
  mv "$tmp" .env
}
definir SUPABASE_URL "${API_URL}"
definir SUPABASE_SERVICE_ROLE_KEY "${SERVICE_ROLE_KEY}"
definir NEXT_PUBLIC_SUPABASE_URL "${API_URL}"
definir NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA "${ANON_KEY}"
definir DATABASE_URL "${DB_URL}"
grep -q '^WEBHOOK_SEGREDO=.' .env || definir WEBHOOK_SEGREDO segredo-local-com-16-caracteres
echo ".env gerado"
