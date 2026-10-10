#!/usr/bin/env bash
# Auditoria 6.8: depois da migração, espera o trabalhador NOVO (construído depois de INICIO) responder 200 no /saude.
# Revisão final (M2): 503 com falhas só de ia, envios_com_falha e conversas_atrasadas também passa (com aviso).
# O /saude só mostra a data do build com o token (auditoria 3.4/D3), por isso as duas variáveis.
# Variáveis: SAUDE_URL (endereço completo do /saude) e SAUDE_TOKEN, opcionais: sem elas, só avisa. INICIO (ISO, UTC),
# ESPERA_SAUDE_MINUTOS (padrão 30) e ESPERA_SAUDE_INTERVALO (segundos, padrão 20). Nunca imprime o token nem a URL.
set -uo pipefail

if [ -z "${SAUDE_URL:-}" ] || [ -z "${SAUDE_TOKEN:-}" ]; then
  echo "::notice::Sem TRABALHADOR_SAUDE_URL e SAUDE_TOKEN no ambiente do GitHub: a publicação não confere o trabalhador novo. Abra o /saude do trabalhador e confira."
  exit 0
fi
if [ -z "${INICIO:-}" ]; then
  echo "::error::INICIO ausente: o passo que marca o início da migração não rodou."
  exit 1
fi

limite=$(( $(date +%s) + ${ESPERA_SAUDE_MINUTOS:-30} * 60 ))
intervalo=${ESPERA_SAUDE_INTERVALO:-20}
corpo=$(mktemp)
trap 'rm -f "$corpo"' EXIT
ultimo="nenhuma resposta"
while :; do
  : > "$corpo"
  codigo=$(curl -s -o "$corpo" -w '%{http_code}' --max-time 15 -H "x-saude-token: $SAUDE_TOKEN" "$SAUDE_URL")
  [ -n "$codigo" ] || codigo=000
  ultimo=$(CODIGO="$codigo" node -e '
    const fs = require("fs");
    let j = {};
    try { j = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); } catch {}
    const build = typeof j.build_em === "string" ? Date.parse(j.build_em) : NaN;
    const novo = Number.isFinite(build) && build >= Date.parse(process.env.INICIO);
    // Revisão final (M2): 503 só com falhas do dia a dia (IA fora, envios com falha, conversas atrasadas) não é culpa da
    // publicação: o trabalhador novo está no ar. ambiente, instancias, parado (e o resto) continuam esperando.
    const toleradas = ["ia", "envios_com_falha", "conversas_atrasadas"];
    const soToleradas = Array.isArray(j.falhas) && j.falhas.length > 0 && j.falhas.every((f) => toleradas.includes(f));
    if (novo && (process.env.CODIGO === "200" || (process.env.CODIGO === "503" && soToleradas))) {
      console.log(process.env.CODIGO === "200" ? "ok" : `ok-com-falhas:${j.falhas.join(", ")}`);
      process.exit(0);
    }
    const partes = [process.env.CODIGO === "000" ? "sem resposta" : `HTTP ${process.env.CODIGO}`];
    if (Array.isArray(j.falhas) && j.falhas.length) partes.push(`falhas: ${j.falhas.join(", ")}`);
    partes.push(Number.isFinite(build) ? `build de ${j.build_em}${novo ? "" : " (anterior à migração: ainda é o trabalhador antigo)"}`
      : "sem a data do build (trabalhador antigo ou SAUDE_TOKEN diferente do Easypanel)");
    console.log(partes.join("; "));
  ' "$corpo")
  if [ "$ultimo" = "ok" ]; then
    echo "Trabalhador novo no ar: /saude 200."
    exit 0
  fi
  case "$ultimo" in
    ok-com-falhas:*)
      echo "::warning::Trabalhador novo no ar, com /saude 503 por falhas que não são da publicação (${ultimo#ok-com-falhas:}). Confira no painel."
      exit 0 ;;
  esac
  echo "Aguardando o trabalhador novo: $ultimo"
  if [ "$(date +%s)" -ge "$limite" ]; then
    echo "::error::O trabalhador novo não respondeu 200 no /saude em ${ESPERA_SAUDE_MINUTOS:-30} min. Último estado: $ultimo. A migração já foi aplicada: publique o Trabalhador no Easypanel (Deploy, depois Stop e Start) e confira o /saude."
    exit 1
  fi
  sleep "$intervalo"
done
