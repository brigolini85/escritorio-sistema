#!/usr/bin/env bash
# Auditoria 6.8: publica os contêineres depois da migração (deploy.yml). Os dois pedidos são independentes: se o do
# trabalhador falhar, o do painel ainda sai, e o erro diz qual publicar à mão. Sem os webhooks, só avisa: o dono publica
# no Easypanel (Deploy, depois Stop e Start) e o passo seguinte espera o trabalhador novo no /saude.
# Variáveis (opcionais): WEBHOOK_TRABALHADOR, WEBHOOK_PAINEL. Nunca imprime as URLs.
set -uo pipefail

if [ -z "${WEBHOOK_TRABALHADOR:-}" ] && [ -z "${WEBHOOK_PAINEL:-}" ]; then
  echo "::notice::Sem os webhooks do Easypanel: publique agora no Easypanel o Trabalhador e o Painel (Deploy, depois Stop e Start). O próximo passo espera o trabalhador novo."
  exit 0
fi

falhou=0
publicar() {
  local nome="$1" url="$2"
  if [ -z "$url" ]; then
    echo "::warning::Sem o webhook do $nome: publique-o à mão no Easypanel (Deploy, depois Stop e Start)."
    return
  fi
  if curl -fs -o /dev/null -X POST --max-time 60 "$url"; then
    echo "$nome: publicação pedida ao Easypanel."
  else
    echo "::error::O Easypanel não aceitou a publicação do $nome. Publique-o à mão (Deploy, depois Stop e Start)."
    falhou=1
  fi
}
publicar Trabalhador "${WEBHOOK_TRABALHADOR:-}"
publicar Painel "${WEBHOOK_PAINEL:-}"
exit "$falhou"
