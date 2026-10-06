# Prontidão para produção e integridade dos dados (Prompts 2 e 3 da análise de arquitetura). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** deixar o sistema pronto para subir a produção. **Parte A (Prompt 2, prontidão):** (1) **nenhuma mensagem sai para cliente de verdade fora da produção** — fora de `AMBIENTE=producao`, o envio só vai para os telefones da lista permitida; o resto é bloqueado, registrado e o fluxo segue; (2) **`/saude` diz a verdade** (banco, batimento, WhatsApp, fila de conversas atrasada) com 503 quando algo está errado, detalhes só com token, e um `/vivo` para o contêiner; (3) **o segredo do webhook nunca aparece no log** (teste) e o manual diz como trocá-lo; (4) **imagens Docker** mais seguras (usuário sem privilégio, verificação de vida), `docker-compose` de exemplo e `.env.producao.example`; (5) **migrações da produção** com prévia e aplicação com confirmação digitada, incluindo os dados iniciais; (6) **cópia de segurança extra semanal** (banco + arquivos, cifrada) e **restauração testada no ambiente local**; (7) **`docs/producao.md`**: checklist de subida e o que fazer quando algo cai. **Parte B (Prompt 3, integridade):** (8) **preço com conferência de versão** — duas pessoas mudando o mesmo preço: a segunda recebe "Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual." e nada é sobrescrito; o agente também confere; (9) **correção de pedido pelo assistente numa transação só** (pedido, nota interna, auditoria: tudo ou nada) e **prévia que não chegou não vale**; (10) **pergunta ao assistente pelo WhatsApp sem duplicar** quando a fila falha; (11) **prova da confirmação do cliente** em cada pedido de nota (`chamado_eventos` tipo `confirmacao_cliente`) que a limpeza de 1 ano não apaga; (12) **LGPD do treino**: a orientação nascida de uma conversa guarda o contato de origem, `anonimizar_contato` mascara o texto do cliente nas orientações, versões e simulações, e `apagar_orientacao` com auditoria.

**O que já existe e não muda (conferido no código em `fa76a76`):**
- `Dockerfile.trabalhador` e `Dockerfile.painel` (multi-stage, Node 22, pnpm, `output: 'standalone'`); publicação pelo GitHub (`.github/workflows/deploy.yml`: homologação automática depois do CI; produção só por `workflow_dispatch`, com os cenários antes e o ambiente `producao` com aprovação do dono, `supabase db push` e os webhooks do Easypanel); `docs/operacao.md` §2 (Supabase Pro, Easypanel, GitHub, Auth, Z-API, UptimeRobot a cada 5 min, primeiro administrador).
- O segredo do webhook é mascarado no log de requisições (`apps/trabalhador/src/servidor.ts:22-25`) e comparado em tempo constante.
- `/saude` já devolve 503 sem batimento recente da `fila` e do `whatsapp` (`servidor.ts:58-63`), mas expõe os horários a qualquer um e não olha o banco nem a fila.
- A correção de pedido pelo assistente já confere a prévia por chave e recusa se o pedido mudou (`assistente/ferramentas.ts:250-399`); o que falta é gravar tudo junto e invalidar a prévia que não chegou.
- `precos` guarda histórico (uma linha por mudança; `precos_um_vigente` garante uma vigente).
- `anonimizar_contato` (última versão em `20261013000100_painel_v2_acesso_contato.sql:129`) limpa mensagens, decisões, conversas do assistente, sugestões, resumos e textos dos eventos das demandas dessas conversas.

**Arquitetura:**
- **Banco (3 migrações novas, só acréscimos e `create or replace` com a mesma assinatura):**
  - `20261101000200_prontidao_saude.sql`: `filas_atrasadas(p_minutos)` (só `service_role`; lê `pgboss.job` se existir). pgTAP `81_prontidao_saude.test.sql`.
  - `20261101000300_integridade_preco_pedido.sql`: `definir_preco_conferido` e `definir_preco_agente_conferido` (funções **novas**; as antigas ficam); `aplicar_correcao_pedido` (transação única); `assistente_mensagens.mensagem_origem_id` (único). pgTAP `82_integridade_preco_pedido.test.sql`.
  - `20261101000400_evidencia_lgpd.sql`: `chamado_eventos.dados jsonb` + tipo `confirmacao_cliente`; `configuracoes.retencao_evidencias_anos` + `salvar_guarda_evidencias`; `orientacoes_agente.contato_origem_id`; `ensinar_agente_da_conversa`; `apagar_orientacao`; `anonimizar_contato` (mesma assinatura, corpo novo). pgTAP `83_evidencia_lgpd.test.sql`.
  - `tipos.gen.ts` regerado.
- **Repositório (`@escritorio/db`):** `filasAtrasadas`, `definirPrecoConferidoPeloAgente`, `aplicarCorrecaoPedido`, `registrarPerguntaWhatsapp`, `abrirChamadoComProva`, `retencaoEvidenciasAnos`; `resumosEnviados` passa a devolver também `mensagemId` (campo **opcional** no tipo; chamadas antigas continuam valendo).
- **Trabalhador:** `src/canal/trava.ts` (novo: o canal com a lista permitida); `config.ts` (`AMBIENTE`, `TELEFONES_PERMITIDOS`, `SAUDE_TOKEN`); `servidor.ts` (`/saude` completo e `/vivo`); `principal.ts`; `agente/ferramentas.ts` (só `alterar_preco`, `resumir_pedido_nota` e `abrir_pedido_nota`); `assistente/ferramentas.ts` (só a gravação de `alterar_pedido_venda`), `assistente/processar.ts` (prévia que não chegou); `processar-conversa.ts` (só o registro da pergunta do WhatsApp); `retencao.ts` (evidências).
- **Painel:** `clientes/[id]/secao-precos.tsx` e `clientes/cadastros-acoes.ts` (preço conferido); `lib/linha-do-tempo.ts` (o evento novo); `treinar-agente/acoes.ts` e `atendimento/[id]/ensinar-agente.tsx` (origem da orientação, apagar); `treinar-agente/editor-orientacao.tsx` (botão Apagar); `configuracoes/secoes/guarda-evidencias.tsx` (novo) em Integrações.
- **Implantação:** `Dockerfile.trabalhador`, `Dockerfile.painel` (usuário `node`, `HEALTHCHECK`), `deploy/docker-compose.exemplo.yml`, `.env.producao.example` (novos), `scripts/producao/{migracoes,backup,restaurar,cifra}.ts` (novos) e `scripts/producao/*.test.ts`; `package.json` da raiz (scripts `db:producao:previa`, `db:producao:aplicar`, `backup:semanal`, `backup:restaurar`).
- **Manuais:** `docs/producao.md` (novo), `docs/operacao.md` (só os trechos que mudam).

**Tecnologias:** TypeScript, Node 22, Fastify, pg-boss 10, Supabase (Postgres 17, RLS, Storage), Next.js 15, Vitest, pgTAP, Playwright, Docker (imagem `postgres:17` só para `pg_dump`/`pg_restore` nos scripts de cópia). **Nenhuma dependência nova em produção.** A cifra da cópia usa `node:crypto` (AES-256-GCM).

**Spec:** `docs/superpowers/specs/painel-v2/analise-arquitetura.md`:
- **§3, linhas 2, 3, 4, 7 e 9** da tabela de diagnóstico;
- **§6, "Prompt 2 — Prontidão para produção"** e **"Prompt 3 — Integridade dos dados"** inteiros;
- **§7, "Prompt 2"** e **"Prompt 3"** (como o dono valida).
- Dependências: o **plano de confiabilidade** (`2026-10-20-correcoes-confiabilidade-agente.md`, Task 6: o `batimento`) — este plano parte da ponta dele; spec 7B (custos), 7D.2 (LGPD dos contatos), 4.6 (tom).

**Onde trabalhar:** worktree nova `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/producao-prontidao`, branch `producao-prontidao`, criada **a partir da ponta da branch `producao-confiabilidade`** (o plano anterior, já revisado): `git worktree add .claude/worktrees/producao-prontidao -b producao-prontidao producao-confiabilidade`. Se o plano de confiabilidade ainda não estiver pronto, **pare** e avise: este plano mexe em `principal.ts`, `config.ts` e `processar-conversa.ts` depois dele. **Antes da Task 1, anote o SHA de partida:** `git rev-parse --short HEAD` → **BASE**. Todos os comandos rodam a partir da raiz da worktree.

## Escopo: Prompts 2 e 3 inteiros, 16 tasks

**Parte A — prontidão (Prompt 2):**
1. trava de envio fora da produção (Task 1);
2. banco da saúde (Task 2) e `/saude` + `/vivo` (Task 3);
3. segredo do webhook fora do log (Task 4);
4. imagens Docker, compose e variáveis (Task 5);
5. migrações da produção com prévia e confirmação (Task 6);
6. cópia semanal e restauração testada (Task 7);
7. `docs/producao.md` (Task 8).

**Parte B — integridade (Prompt 3):**
8. banco: preço conferido, correção atômica, pergunta sem duplicar (Task 9);
9. painel: preço com aviso de conflito (Task 10);
10. agente: preço conferido (Task 11);
11. assistente: correção atômica, prévia que não chegou, pergunta sem duplicar (Task 12);
12. banco: evidência da confirmação e LGPD do treino (Task 13);
13. trabalhador: evidência no pedido de nota e a guarda (Task 14);
14. painel: linha do tempo, Ensinar com origem, Apagar orientação, guarda das evidências (Task 15);
15. manuais (Task 16).

**Fora do escopo** (Prompts 2 e 3, "FORA DO ESCOPO"): contratar serviços, criar contas, mudar de provedor de WhatsApp, visual do painel além das mensagens citadas, agentes por setor. **Nenhum `supabase db push` contra a homologação ou a produção, nem `--dry-run`** (Regras de ambiente): os scripts da Task 6 são **escritos e testados com o banco local**, e quem roda contra a produção é o dono, depois.

## Decisões tomadas (sem o dono)

Conferi no código o que a análise supõe. **"A confirmar com o dono"** = decisão de produto: o plano segue a proposta, e o dono pode trocar antes da task indicada.

| # | Decisão (o que o plano faz) | Alternativa | Por que não | Tasks |
|---|---|---|---|---|
| D1 | **A trava fica no canal, não em `envio.ts`:** `canalComTrava(canal, regra)` embrulha `enviarTexto` e `enviarArquivo` do `CanalWhatsApp` no `principal.ts`. Assim valem **todos** os caminhos que mandam mensagem (agente, sistema, documento, painel, alertas ao dono, assistente pelo WhatsApp, pendências das tarefas), inclusive os que chamam o canal direto (`assistente/processar.ts:42,51`). Envio bloqueado devolve um `idProvedor` `bloqueado-<uuid>` (a mensagem fica "enviada" no banco, o fluxo segue), escreve no log e grava em `decisoes_agente` a etapa `envio_bloqueado` com o telefone **mascarado** (só os 4 últimos dígitos) e o tipo. | Travar em `envio.ts` (análise). | O assistente e o alerta ao dono não passam por `envio.ts`; uma trava ali deixaria buracos. | 1 |
| D2 | **`AMBIENTE`** (`producao`, `homologacao` ou `local`) **obrigatório, sem padrão** (revisão P2-1: o trabalhador não sobe sem ele, e o Easypanel mostra "Configuração inválida ou faltando: AMBIENTE") e **`TELEFONES_PERMITIDOS`** (lista separada por vírgula, normalizada como os telefones do banco). Fora da produção, a mensagem bloqueada aparece no Atendimento como **"Não enviada: ambiente de teste"** (o `id_provedor` começa com `bloqueado-`), e o `/saude` com token mostra o `ambiente`. A lista vale também para os **celulares da equipe que usam o Assistente pelo WhatsApp** e para o WhatsApp do dono (alertas) — revisão P2-17. **A confirmar com o dono:** (a) variável de ambiente, e não tabela em `configuracoes`; (b) o trabalhador de teste dele (porta 3001) **não sobe** com esta versão até ele pôr `AMBIENTE=homologacao` e `TELEFONES_PERMITIDOS` no `.env.homologacao` (este plano **nunca** mexe nesse arquivo); (c) a produção precisa de `AMBIENTE=producao`. | Padrão `homologacao` (versão anterior deste plano); padrão `producao`. | O primeiro deixava a produção muda sem aviso se a variável faltasse; o segundo mandaria mensagem a cliente real na homologação. | 1, 3, 8 |
| D3 | **`/saude` completo:** 200 só se (a) o banco responde, (b) o batimento (`sinais_vida.fila`) tem menos de **3 min**, (c) o WhatsApp está conectado (`sinais_vida.whatsapp` com menos de **3 min**: o batimento já pergunta à Z-API a cada minuto; o `/saude` não chama a Z-API a cada visita do monitor), (d) nenhum job de `processar-conversa` **nem de `enviar-mensagem`** (a resposta da equipe ao cliente, revisão P2-11) está esperando há mais de **5 min** (`filas_atrasadas`). Senão **503**. **Sem token:** só `{ "ok": true|false }`. **Com `SAUDE_TOKEN`** (cabeçalho `x-saude-token` ou `?token=`, comparação em tempo constante): também `{ "falhas": ["banco"|"batimento"|"whatsapp"|"fila"], "sinais": {…}, "fila_atrasada": n }`, sem segredo. **`/vivo`** devolve 200 enquanto o processo responde (para o `HEALTHCHECK` do contêiner: um WhatsApp desconectado não pode fazer o Easypanel reiniciar o trabalhador em laço). | `/saude` no `HEALTHCHECK`. | Reinício em laço quando o problema é o celular. | 2, 3, 5 |
| D4 | **Webhook:** o segredo continua na URL (é o que a Z-API permite configurar no campo "Ao receber"); o teste novo prova que ele não aparece no log nem com 401, nem com erro dentro da rota. **Cabeçalho de segurança da Z-API: não entra** — a Z-API não manda cabeçalho próprio configurável nos webhooks que conferimos no código (`canal/zapi.ts` só usa `Client-Token` para **chamar** a Z-API). **A confirmar com o dono:** se o painel da Z-API dele oferecer um "token do webhook", vira uma task pequena depois. O manual ensina a **trocar o segredo** (Easypanel + campo "Ao receber", nesta ordem, sem perder mensagens). | — | — | 4, 8 |
| D5 | **Docker:** as imagens já existem e funcionam no Easypanel; mudam só (a) `USER node` no estágio final, (b) `HEALTHCHECK` com `node -e "fetch('http://127.0.0.1:'+(process.env.PORTA??3001)+'/vivo')…"` no trabalhador e `/entrar` no painel, (c) `NODE_OPTIONS=--max-old-space-size` via variável opcional. Novo: `deploy/docker-compose.exemplo.yml` (os dois serviços, sem valores) e `.env.producao.example` (todas as variáveis comentadas, **sem valores reais**, com `AMBIENTE=producao`). **Chaves da Anthropic separadas por ambiente** (uma para homologação, outra para produção; o manual diz como criar no console com limite de gasto). | Reescrever as imagens. | Estão em uso; mexer pouco. | 5 |
| D6 | **`docker build` local só com memória:** os dois `docker build` rodam **um de cada vez**, só com **≥ 6 GB livres** (o `next build` passa de 3 GB) e com o Supabase local **desligado**; sem Docker instalado ou sem memória, o build fica como **pendência** com o motivo (a publicação de verdade é no Easypanel). | Rodar sempre. | A máquina tem pouca memória (o Claude Code já matou processos). | 5, Entrega |
| D7 | **Migrações da produção:** `pnpm db:producao:previa` (`supabase db push --db-url … --dry-run`) e `pnpm db:producao:aplicar` (pede para **digitar `APLICAR NA PRODUCAO`**; sem isso, sai sem fazer nada), lendo **só** `--env-file .env.producao` (fora do git). Os **dados iniciais** viram passos explícitos do mesmo script, cada um com a sua confirmação: `supabase/dados/setores-novos.sql` e `supabase/dados/orientacoes-skill-dono.sql` (os dois já existem e só criam o que falta). O script **recusa** URL local, URL que não é do Supabase e o **mesmo projeto** da homologação (compara o identificador do projeto, revisão P2-8; o `.env.homologacao` é lido só para isso, nunca alterado); exige uma **cópia feita agora** e a **mesma lista** da prévia aprovada (revisão P2-7); a senha nunca vai na linha de comando (revisão P2-9). **O fluxo oficial continua o do GitHub** (`deploy.yml`); o script é para a primeira subida e emergência. | Só o GitHub. | A primeira subida precisa dos dados iniciais em ordem, e o GitHub não roda os `supabase/dados/*.sql`. | 6 |
| D8 | **Cópia de segurança (refeita na revisão P2-3 e P2-10):** a principal é a do **Supabase Pro** (diária, 7 dias) e, **a confirmar com o dono** (custo extra), o **PITR**. A **extra semanal**: `pg_dump -Fc --data-only` em **dois arquivos** — `-n public` e `-t auth.users -t auth.identities` (no `pg_dump`, `--schema` e `--table` juntos fazem valer só o `--table`) — mais os arquivos dos compartimentos e um `manifesto.json` (contagem por tabela), tudo num `.tar` **cifrado** (AES-256-GCM, `BACKUP_CHAVE`). **Onde roda (a confirmar com o dono; proposta):** no **GitHub Actions** (`.github/workflows/backup.yml`, todo domingo 04:00 de Brasília), com `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `BACKUP_CHAVE` como segredos do ambiente `producao`, guardando o `.enc` como artefato por **60 dias**; falha = e-mail do GitHub ao dono; a chave **nunca** fica no computador. Alternativa: `pnpm backup:semanal` no computador dele. `pnpm backup:restaurar` decifra, **confere** a cópia (`pg_restore --list` contra o manifesto) **antes** de mexer no banco e só restaura num banco **sem dados de clientes** (`clientes` e `mensagens` vazias) — ou com `--substituir`; recusa a produção sem `--sou-o-dono-e-quero-a-producao`. **Testado no local** (Task 7). | `supabase db dump` sem cifra; um dump só. | A cópia tem dados pessoais (LGPD): fora do Supabase, só cifrada; um dump só copiava só os usuários. | 7, 8 |
| D9 | **Monitor externo:** o manual troca o UptimeRobot "a cada 5 min" por **Better Stack (grátis, a cada 3 min)** ou **UptimeRobot** (grátis, 5 min; 1 min só no pago), chamando `/saude` (sem token: só o `ok`), com aviso por **e-mail** e por **Telegram** (não depende da Z-API do sistema). **A confirmar com o dono:** qual serviço e se paga o intervalo de 1 min (a análise pede 1 min). | — | — | 8 |
| D10 | **Preço com conferência pela linha vigente, não por uma coluna `versao`:** cada mudança de preço já cria uma linha nova em `precos`; o **id da linha vigente** é a versão. Funções **novas** `definir_preco_conferido(p_grupo, p_produto, p_valor, p_vigente_esperado uuid)` (o painel) e `definir_preco_agente_conferido(…, p_contato, p_vigente_esperado)` (o trabalhador): se a vigente não for a esperada (`null` = "não havia preço"), falham com o código **`PR409`** e a mensagem "Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual."; a vigente é travada com `for update` (duas gravações ao mesmo tempo: a segunda espera e recebe o conflito). As funções antigas **ficam** (testes antigos e o painel de antes), sem mudança. A análise pede "coluna `versao` com 1 nos existentes": o id dá o mesmo resultado sem migrar dados. | Coluna `versao`. | Duplicaria o que o histórico já dá e exigiria preencher a coluna. | 9, 10, 11 |
| D11 | **O painel guarda o que foi digitado no conflito:** o formulário manda o id da vigente que a tela mostrou (`vigente`, campo escondido); no conflito, volta com `?erro=…&tentado=<rede>:<produto>:<valor>` e a célula mostra o valor tentado no campo (com o aviso no topo, como os outros erros de cadastro). | Componente cliente com estado. | A tela de preços é de servidor e usa `comAvisoDeErro` como os outros cadastros. | 10 |
| D12 | **Agente:** `alterar_preco` lê a vigente na hora e grava com ela como esperada; se o cliente confirmou "de R$ X para R$ Y" e a vigente mudou desde o último `consultar_preco` desta conversa (24 h), recusa: "O preço mudou agora há pouco (era X, agora é Z). Mostre o valor novo ao cliente e confirme de novo antes de alterar." Sem `consultar_preco` antes, só a trava do banco. A descrição da ferramenta **não muda** (retratos). | — | — | 11 |
| D13 | **Correção de pedido numa transação:** função **nova** `aplicar_correcao_pedido(p_chamado, p_antes, p_pedido, p_resumo, p_titulo, p_usuario, p_nota, p_detalhes)` (só `service_role`): trava a demanda, confere que `pedido_venda` ainda é `p_antes` (senão `PR409`), que não está concluída, grava pedido, resumo, título, nota interna e auditoria; erro em qualquer passo desfaz tudo. O assistente usa ela no lugar das 3 chamadas de hoje e responde o resultado real. | — | — | 9, 12 |
| D14 | **Prévia que não chegou não vale:** quando o envio da resposta do assistente pelo WhatsApp falha na **última** tentativa, o trabalhador grava, para cada prévia mostrada naquela resposta, uma decisão `assistente:alterar_pedido_venda` com `{ "gravado": null, "nao_entregue": true }`. Pela regra que já existe ("qualquer chamada depois da prévia a consome"), o "sim" seguinte recebe "Mostre o antes e o depois de novo e espere a confirmação." No **painel** (canal `site`), a resposta gravada **é** a entrega. | Coluna "entregue" nas decisões. | Reaproveita a regra de consumo que já tem testes. | 12 |
| D15 | **Pergunta sem duplicar:** `assistente_mensagens.mensagem_origem_id` (o id da linha de `mensagens` que trouxe a pergunta pelo WhatsApp), **único**; `registrarPerguntaWhatsapp` usa `on conflict do nothing`. A nova tentativa do job de conversa (agendamento que falhou) não cria outra pergunta. As perguntas do painel não têm origem (`null`, fora do único). | Chave na fila. | A fila já usa `singletonKey`; a duplicata nasce na gravação. | 9, 12 |
| D16 | **Prova da confirmação, na mesma transação da demanda (revisão P2-12):** o pedido de nota abre a demanda pela função nova **`abrir_chamado_com_prova(p_chamado jsonb, p_prova_texto text, p_prova_dados jsonb)`**, que insere a demanda e o evento `confirmacao_cliente` juntos (o gatilho do prazo vale como no insert de hoje); `texto` legível ("Cliente confirmou o pedido pelo WhatsApp em <data hora>") e `dados` = `{ resumo_enviado, resumo_em, mensagem_resumo_id, confirmacao, confirmacao_em, contato_id, contato_nome, telefone_final: "…1234", chave }`. Falhou → nada fica (nem demanda sem prova); a ferramenta cai e o plano de confiabilidade leva a conversa à equipe. Banco sem a migração: o caminho de hoje (`abrirChamado`), sem prova. | Gravar a prova depois de abrir. | Ficaria demanda de nota sem prova se a segunda gravação falhasse. | 13, 14 |
| D17 | **Guarda das evidências:** `configuracoes.retencao_evidencias_anos` (padrão **5**, de 1 a 20), editável **só pelo dono** (revisão P2-14) em Configurações › Integrações, "Prova da confirmação do pedido de nota"; antes de salvar, a tela mostra **quantas provas sairiam** com o prazo novo (`provas_que_sairiam(p_anos)`); a limpeza diária apaga só os eventos `confirmacao_cliente` mais velhos que isso. **A confirmar com o dono e com o contábil/jurídico:** o prazo (5 anos é o prazo comum de guarda fiscal). | Qualquer administrador. | Baixar o prazo apaga provas sem volta. | 13, 14, 15 |
| D18 | **LGPD × prova:** `anonimizar_contato` **mantém** o evento `confirmacao_cliente` (base legal: exercício regular de direito e obrigação legal), mas **tira** dele `contato_nome` e `telefone_final` e põe `"anonimizado": true`; o resto da limpeza continua como hoje. **A confirmar com o dono e com o jurídico.** | Apagar a prova junto. | Perde-se exatamente o que a prova serve para mostrar. | 13 |
| D19 | **LGPD do treino:** `orientacoes_agente.contato_origem_id` (nulo quando escrita do zero); o "Ensinar o agente" grava por uma função **nova** `ensinar_agente_da_conversa(p_conversa, …)` (orientação e origem na mesma transação). `anonimizar_contato`, nas orientações daquele contato: **mascara** as linhas citadas do cliente (`Cliente: “…”` → `Cliente: “[removido a pedido do titular]”`), **apaga as versões antigas** e grava **uma** versão nova já mascarada (revisão P2-16: texto em outro formato não sobra no histórico), **desliga** a orientação (alguém revisa antes de religar) e apaga as simulações cujo rascunho veio dela. **A confirmar com o dono:** mascarar e desligar (proposta) ou apagar a orientação inteira. `apagar_orientacao(p_id)` (administrador ou quem treina aquele agente) apaga a orientação e as versões, com auditoria (só título e tipo; nunca o texto). | — | — | 13, 15 |
| D20 | **Simulações:** só as ligadas a uma orientação do contato saem (pelo `rascunho->>'id'`); a mensagem digitada à mão num teste não tem como ser ligada a um contato, e a guarda de 30 dias que já existe cobre o resto. | — | — | 13 |
| D21 | **Números novos:** migrações `20261101000200`, `…300`, `…400`; pgTAP `81`, `82`, `83` (o `80` é do plano de confiabilidade; `20261101000500` e `84` ficam para o plano do CNPJ). | — | — | todas |
| D22 | **Mensagens que chegam com o trabalhador fora (revisão P2-2):** o webhook da Z-API é atendido pelo trabalhador; durante uma queda, um reinício ou um deploy, a Z-API pode não conseguir entregar. Este plano: (a) tira do manual o "Stop" no Easypanel como forma de pausar (usar **Pausar agente**, que continua recebendo); (b) avisa que deploy e reinício têm de ser fora do horário de pico; (c) manda conferir no painel da Z-API se ela **reenvia** webhook que falhou. **A confirmar com o dono / pendência:** uma recuperação automática na subida do trabalhador (buscar na Z-API as mensagens recebidas desde o último batimento), se a instância dele tiver a API de mensagens por conversa. | Recuperação já neste plano. | Depende de uma API da Z-API que não dá para conferir sem a instância do dono. | 8 |
| D23 | **De onde vêm os dados da produção e o número do escritório (revisão P2-5), a confirmar com o dono:** (a) produção **nova e vazia** (recadastrar ou importar clientes, contatos, preços, orientações e skills) **ou** cópia da homologação (que já tem dados reais) — se for cópia, o passo a passo usa o `backup:restaurar` num projeto novo; (b) **antes de conectar o número do escritório à Z-API da produção, desconectá-lo da instância da homologação** (dois sistemas no mesmo número respondem o mesmo cliente duas vezes). O checklist tem os dois. | — | — | 8 |

## Revisão crítica de 06/10 (sessão agentesdeia-ab) — decisões

Arquivo da revisão: `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\REVISAO-PLANOS-PRODUCAO.txt`. Cada achado do plano 2 e o que foi feito neste plano:

| Achado | Gravidade | Decisão | O que mudou |
|---|---|---|---|
| P2-1 sem `AMBIENTE` a produção fica muda sem ninguém saber | alta | **Aceito** | D2 refeita: `AMBIENTE` **obrigatório, sem padrão** (o trabalhador não sobe sem ele e o Easypanel mostra o erro); a mensagem bloqueada aparece no Atendimento como **"Não enviada: ambiente de teste"** (não "enviada"); o `/saude` com token mostra o `ambiente`. Tasks 1, 3. |
| P2-2 mensagens perdidas com o trabalhador fora (webhook) | alta | **Aceito em parte** | O manual tira o "Stop" do "pausar tudo" (usa só **Pausar agente**) e avisa que reinício/deploy pode perder as mensagens daquele intervalo; o checklist manda conferir no painel da Z-API se ela reenvia webhook que falhou. A **recuperação automática** (buscar na Z-API as mensagens recebidas durante a queda) fica como **decisão do dono e pendência** (D22): depende de a instância dele ter a API de histórico de mensagens, que este plano não tem como conferir. Task 8. |
| P2-3 `pg_dump` com `--schema` e `--table` juntos copia só os usuários; o restaurar apaga antes de conferir | alta | **Aceito** | D8 refeita: **dois** dumps (`-n public` e `-t auth.users -t auth.identities`, os dois `--data-only`); o restaurar confere a cópia (`pg_restore --list` contra o manifesto, tabela por tabela) **antes** de mexer no banco e só restaura em banco **sem dados de clientes** (`clientes` e `mensagens` vazias) ou com `--substituir`. Task 7. |
| P2-4 produção nova sem dono | alta | **Aceito** | Checklist: passo "marcar o dono" logo depois do primeiro administrador (SQL do achado) e conferir na tela Agentes. Task 8. |
| P2-5 de onde vêm os dados da produção; o número do escritório na homologação | alta | **Aceito como decisão do dono** | D23: (a) produção nova e vazia × cópia da homologação; (b) **antes de ligar a produção, tirar o número do escritório da Z-API da homologação** (senão dois sistemas respondem o mesmo cliente). Os dois entram no checklist. Task 8. |
| P2-6 ordem das migrações e versão | alta | **Aceito** | Seção "Integração e versão" abaixo (ordem de junção, um `--dry-run` único, tag, nunca aplicar `20261101…` sem a Parte I, renumerar se a Parte I passar do número). |
| P2-7 aplicar sem cópia e sem comparar com a prévia | média | **Aceito** | Task 6: passo 0 "cópia agora" com confirmação; a prévia grava a lista em `.producao-previa.txt` (fora do git) e o aplicar recusa se a lista de agora for diferente. |
| P2-8 recusa da homologação por texto exato da URL | média | **Aceito** | Task 6: compara o **identificador do projeto** (`ref`), tirado de `db.<ref>.supabase.co` ou do usuário `postgres.<ref>`. |
| P2-9 senha na linha de comando com `shell: true` | média | **Aceito** | Task 6: nada de URL com senha em argumento. Migrações por `supabase link --project-ref <ref>` + `supabase db push --linked` com `SUPABASE_DB_PASSWORD` e `SUPABASE_ACCESS_TOKEN` no ambiente do processo (como o `deploy.yml`); dados iniciais pelo `psql` da imagem `postgres:17` com `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` passados por `-e` sem valor (herdados do ambiente). |
| P2-10 cópia depende do computador do dono; chave junto das cópias | média | **Aceito como decisão do dono, com proposta** | D8: **proposta** — a cópia semanal roda no **GitHub Actions** (`.github/workflows/backup.yml`, domingo 04:00), com a `BACKUP_CHAVE` e a `DATABASE_URL` como segredos do ambiente `producao`, e o `.enc` guardado como artefato por 60 dias; falha avisa o dono por e-mail (GitHub). Alternativa: o computador dele. A chave **nunca** fica no `.env.producao` do computador das cópias. Tasks 7, 8. |
| P2-11 `/saude` não vê respostas do painel; painel sem monitor | média | **Aceito** | `filas_atrasadas` conta também `enviar-mensagem` (Task 2); segundo monitor em `https://<painel>/entrar` no checklist (Task 8). |
| P2-12 demanda de nota aberta e prova gravada separadas | média | **Aceito** | D16: função nova `abrir_chamado_com_prova` (demanda + evento na mesma transação); o trabalhador grava o pedido e a prova junto da abertura. Tasks 13, 14. |
| P2-13 teste do critério 5 só com comentários | média | **Aceito** | Task 14 traz o teste inteiro (a preparação de `test/agente/cadastros.test.ts`). |
| P2-14 qualquer administrador baixa o prazo das provas | média | **Aceito** | D17: **só o dono** muda; a tela mostra quantas provas sairiam antes de salvar (`provas_que_sairiam(p_anos)`). Tasks 13, 15. |
| P2-15 teste de repositório que passa com qualquer coisa | baixa | **Aceito** | Saiu (o pgTAP 81 cobre). Task 2. |
| P2-16 mascaramento depende do formato `Cliente: “…”` | baixa | **Aceito** | D19: além de mascarar, a anonimização **apaga as versões antigas** daquelas orientações (fica uma versão nova, já mascarada) e **desliga** a orientação (alguém revisa antes de religar). Task 13. |
| P2-17 celulares da equipe que usam o Assistente precisam estar na lista | baixa | **Aceito** | Checklist e manual. Task 8. |
| P2-18 anonimizar não alcança as cópias já feitas | baixa | **Aceito** | Manual e política: as cópias somem no prazo de guarda delas (8 semanas, a confirmar); dito ao titular. Task 8. |
| P1-3 (transversal) custo dos cenários | média | **Aceito** | Regras de ambiente: "Custo dos cenários" (cópia de `uso_ia` por gatilho). |

## Integração e versão (P2-6)

- **Ordem de junção:** Parte I completa (até a I5) → confiabilidade → **este plano** → CNPJ. Uma tag por versão (`v2026.11-<n>`) antes de qualquer `db push` na produção (diagnóstico 8 da análise).
- **Números:** as migrações deste plano (`20261101000200–400`) são maiores que todas as da Parte I (`2026101x–2026103x`). **Nunca aplicar `20261101…` num banco que ainda não tem todas as da Parte I:** o `supabase db push` seguinte recusaria as da Parte I ("anteriores à última aplicada") e só passaria com `--include-all`. Quem aplica (o dono) faz **um** `--dry-run` com a lista inteira (Parte I + confiabilidade + este + CNPJ) e confere a ordem.
- **Se a Parte I criar uma migração com número ≥ `20261101000100`** antes da execução, **renumere** as deste plano para depois da última (`git mv`, só o número; pgTAP a partir do maior `NN_` + 1) no começo da execução e anote na Entrega.

## Restrições globais

- **Só mexer em:** `supabase/migrations/20261101000{200,300,400}_*.sql` (**novos**), `supabase/tests/8{1,2,3}_*.test.sql` (**novos**), `packages/db/src/repos.ts` (métodos e tipos **novos**; em `resumosEnviados` só o campo opcional `mensagemId`), `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`), `packages/db/test/limpar.ts` (só o que as tabelas novas pedem), `packages/db/test/{integridade,evidencia}.test.ts` (**novos**), `.github/workflows/backup.yml` (**novo**, revisão P2-10), `apps/painel/src/components/patterns/message-bubble.tsx` e `apps/painel/src/app/(painel)/atendimento/[id]/conversa-aberta.tsx` (só a mensagem bloqueada, revisão P2-1), `apps/trabalhador/src/canal/trava.ts` (**novo**), `apps/trabalhador/src/{config,servidor,principal,processar-conversa,retencao}.ts` (só o que as tasks dizem), `apps/trabalhador/src/agente/ferramentas.ts` (só os `case` de `alterar_preco`, `resumir_pedido_nota` e `abrir_pedido_nota`, e a constante `AVISO_PRECO_MUDOU`), `apps/trabalhador/src/agente/prova.ts` (**novo**), `apps/trabalhador/src/assistente/{ferramentas,processar,executar}.ts` (só o que a Task 12 diz; em `executar.ts` só o campo novo `previasMostradas` no resultado), testes **novos** em `apps/trabalhador/test/producao/`, `apps/painel/src/app/(painel)/clientes/{cadastros-acoes.ts,[id]/secao-precos.tsx,[id]/page.tsx}`, `apps/painel/src/lib/{linha-do-tempo,precos-conflito}.ts` (+ testes **novos**), `apps/painel/src/app/(painel)/treinar-agente/{acoes.ts,editor-orientacao.tsx}`, `apps/painel/src/app/(painel)/atendimento/[id]/ensinar-agente.tsx`, `apps/painel/src/app/(painel)/configuracoes/{secoes/guarda-evidencias.tsx,secoes/integracoes.tsx,acoes.ts}`, e2e **novos** (`apps/painel/e2e/{preco-conflito,evidencia-lgpd}.spec.ts`), `Dockerfile.trabalhador`, `Dockerfile.painel`, `deploy/docker-compose.exemplo.yml`, `.env.producao.example`, `.gitignore` (só `.env.producao`, `.producao-previa.txt` e `backups/`), `.env.example` (só `AMBIENTE` e `TELEFONES_PERMITIDOS`, revisão P2-1), `apps/painel/e2e/envio-bloqueado.spec.ts` (**novo**), `scripts/producao/*`, `package.json` da raiz (só os 4 scripts), `docs/producao.md` (**novo**), `docs/operacao.md`. **Nada em `apps/trabalhador/src/agente/prompt.ts`, nos retratos, em `envio.ts`, em `canal/zapi.ts`.**
- **Testes de partes anteriores não mudam:** nenhum pgTAP de `01` a `80`; nenhum `*.test.ts` existente; nenhum e2e existente. Se um quebrar por causa deste plano, **pare** e avise. Em especial: `cadastros.spec.ts` (preço, histórico), `servidor.test.ts` (`/saude`, linha 69: confere só o código, 503 sem sinais e 200 com `fila` e `whatsapp`; continua valendo com a fila atrasada = 0), `assistente/*.test.ts`, `retencao.test.ts`.
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` continua 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio. Nada entra no Realtime. Nunca use `usuario_liberado`; use `eh_usuario_ativo`, `eh_admin`, `tem_permissao`, `eh_dono`, `pode_ver_chamado`, `pode_treinar_agente`.
- **O pedido do Thiago não muda:** `git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__ apps/trabalhador/src/agente/prompt.ts` sai **vazio**; nenhuma `description` de ferramenta muda.
- **Nenhum valor real** de chave, senha, telefone ou URL de projeto em arquivo versionado. `.env.producao` e `backups/` entram no `.gitignore`.
- **Números novos:** antes de criar uma migração ou um pgTAP, `ls supabase/migrations | sort | tail -3` e `ls supabase/tests | sort | tail -3`; número igual ou maior já existente (de outra branch juntada) → **pare** e avise.

### Regras de ambiente (máquina com pouca memória)

- **Um Supabase local por vez, na máquina inteira.** O arquivo de vez é `C:\Users\Thiago\Desktop\PROJETO\AGENTESDEIA\.vez-supabase.txt` (fora do git, na raiz do repositório principal):
  1. **Antes de ligar**, leia o arquivo. Se existir com uma linha de **outra** worktree ou sessão, **não ligue**: espere, confira de novo; se continuar ocupado, pare e avise. Confira também `supabase status`.
  2. Livre: `echo "producao-prontidao producao-prontidao $(date '+%Y-%m-%d %H:%M')" > /c/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.vez-supabase.txt` e só então `supabase start`.
  3. **Ao terminar** (ou ao parar por qualquer motivo): `supabase stop`, devolva `config.toml` e `.env`, e apague o arquivo **só se** a linha for desta worktree (`grep -q '^producao-prontidao ' … && rm …`).
  4. Nunca ligue nem desligue o Supabase de outra worktree, nunca apague a linha de outra.
- **Portas temporárias (o Windows reserva 54287 a 54586 depois de reiniciar):**
  1. Antes de ligar: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`.
  2. Em `supabase/config.toml`: `54321`→`56321` (api), `54322`→`56322` (db), `shadow_port 54320`→`56320`, `54329`→`56329` (pooler), `54323`→`56323` (studio), `54324`→`56324` (inbucket), `54327`→`56327` (analytics).
  3. No `.env`: `127.0.0.1:54321`→`127.0.0.1:56321` (`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322`→`127.0.0.1:56322` (`DATABASE_URL`). **Acrescente** `AMBIENTE=local` e `TELEFONES_PERMITIDOS=` (vazio) **só no `.env` local** (`AMBIENTE` passa a ser obrigatório na Task 1): os testes que precisam da trava montam a regra deles.
  4. **Antes de rodar uma suíte inteira, `supabase db reset`.**
  5. Ao terminar e antes de qualquer commit: devolva as cópias; `git status` não pode mostrar `supabase/config.toml` alterado.
- **`pnpm` está em `~/bin`:** `export PATH="$HOME/bin:$PATH"` no começo de cada sessão do Git Bash.
- **Para filtrar e2e:** `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts --workers=1`.
- **POUCA MEMÓRIA:**
  - e2e sempre em **lotes de até 2 arquivos**, `--workers=1`. **Nunca a suíte e2e inteira de uma vez.**
  - **Antes de cada lote** (e antes de cada `docker build`, de cada rodada de cenários e do teste de cópia), a memória livre: `[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1)` no PowerShell. **Abaixo de 4 GB, não rode** (6 GB para `docker build`, D6). Espere, feche o que for seu, confira de novo; continuou baixo → pare e avise.
  - **Se o Claude Code matar um processo** ("Target crashed", "worker process exited unexpectedly", processo morto): **pare**, anote onde parou, devolva `config.toml`/`.env`, libere a vez e avise.
  - Um agente de cada vez. Nunca ao mesmo tempo: o painel de teste do dono, o `next dev` deste plano, os cenários, os e2e, `docker build`.
- **Portas 3001 a 3010 são do dono.** E2e na 3100; capturas na **3107**.
- **Tudo só contra o banco local.** **Nunca rode nada contra a homologação nem contra a produção; nunca altere `.env.homologacao`** (a Task 6 só **lê o endereço** dele para recusar, e só dentro do script). Nenhum `supabase db push` com `--db-url` de nuvem, nem `--dry-run`. Os scripts da Task 6 e 7 são testados **só** com o banco local.
- **Cenários com Claude real** (Entrega): só os comandos indicados, um de cada vez, com o custo anotado. **Teto: US$ 15** neste plano.
- **Custo dos cenários (revisão P1-3):** cada cenário chama `limparBanco`, que **trunca `uso_ia`**: somar `uso_ia` no fim mede só o último. Antes de **cada** rodada (depois do `supabase db reset`), no banco **local**, pelo `psql` do contêiner (`docker exec -i supabase_db_<projeto> psql -U postgres`):

```sql
create schema if not exists rascunho_custo;
create table if not exists rascunho_custo.uso (custo_usd numeric, funcionalidade text, criado_em timestamptz default now());
create or replace function rascunho_custo.copiar() returns trigger language plpgsql security definer set search_path = '' as $$
begin insert into rascunho_custo.uso (custo_usd, funcionalidade) values (new.custo_usd, new.funcionalidade); return new; end $$;
drop trigger if exists copiar_custo on public.uso_ia;
create trigger copiar_custo after insert on public.uso_ia for each row execute function rascunho_custo.copiar();
grant usage on schema rascunho_custo to service_role, authenticated;
grant insert on rascunho_custo.uso to service_role, authenticated;
```

  Depois da rodada: `select round(sum(custo_usd), 4) from rascunho_custo.uso;` (anote) e `truncate rascunho_custo.uso;`. Ao terminar: `drop trigger copiar_custo on public.uso_ia; drop schema rascunho_custo cascade;` (o `supabase db reset` também apaga).
- **Nenhum trabalhador é ligado nem desligado.** O da porta **3001 é o teste do dono.**
- **Antes de mudar texto ou `data-testid` usado em teste,** `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "Preços por rede", "Histórico de preço", "Salvar preço de …", "Preço de … para …", "R$ 10,00 · vigente", "alterado pelo agente IA", "Ensinar o agente", "Mostre o antes e o depois de novo e espere a confirmação.", "O pedido mudou desde a prévia (ou os preços da tabela).".
- **Nada de cor, tamanho ou espaçamento solto no JSX**; só tokens e a escala do Tailwind; ícones `size={12|14|16|20}`.
- **Tom (spec 4.6):** frases curtas e afirmativas; sem "Tem certeza?", "por favor", "com sucesso". Vermelho nunca sozinho.
- **Termos na tela:** "Prova da confirmação", "Apagar orientação", "Recarregue para ver o valor atual"; nunca "versão", "conflito", "PR409", "job", "token" (no painel).
- **Comentários no código:** português, uma linha, o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado.

## Foco da revisão

1. **Mensagem que escapa da trava:** o alerta ao dono (`alertas.ts`), o assistente pelo WhatsApp (`assistente/processar.ts`, chama o canal direto), o documento (`enviarDocumentoDoSistema`), a resposta do painel (`enviarMensagemDoPainel`), o pedido de pendência das tarefas → todos bloqueados fora da lista; o telefone com e sem o 9, com e sem o 55, na lista → reconhecido. Task 1.
2. **Monitor que mente:** banco fora (a consulta lança), batimento velho, WhatsApp desconectado, fila parada há 6 min, tabela `pgboss.job` ainda inexistente (trabalhador novo) → código e `falhas` certos; sem token, nada além do `ok`; token errado = sem detalhes (não 401, para o monitor sem token seguir funcionando). Tasks 2 e 3.
3. **Dois preços ao mesmo tempo:** duas abas com o mesmo valor de partida; agente e painel ao mesmo tempo; primeiro preço (sem vigente) gravado por duas pessoas → a segunda sempre recebe o aviso e o histórico tem uma linha só nova. Tasks 9, 10, 11.
4. **Correção pela metade:** a nota interna falha (usuário inexistente), a auditoria falha, a demanda foi concluída entre a prévia e o "sim", o pedido mudou → nada gravado, o assistente diz a verdade. Tasks 9 e 12.
5. **Prova apagada sem querer:** limpeza de 1 ano das mensagens, anonimização do contato, prazo da guarda menor que a idade do evento, demanda de outro tipo → a prova de um pedido de nota só sai pela guarda das evidências; anonimizar tira nome e telefone e deixa o resto. Tasks 13 e 14.
6. **Cópia que não volta:** cópia feita, banco zerado, restauração → as mesmas contagens nas tabelas principais e os mesmos arquivos nos compartimentos; chave errada → recusa sem escrever nada; URL da produção sem a confirmação → recusa. Task 7.
7. **Script que aplica sem querer:** `db:producao:aplicar` sem digitar a frase, com a URL local, com a URL da homologação → sai sem rodar nada. Task 6.

---

## Mapa de arquivos

`tr/…` = `apps/trabalhador/src/`; `pn/…` = `apps/painel/src/app/(painel)/`.

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `tr/canal/trava.ts` (novo), `tr/config.ts`, `tr/principal.ts`, `apps/trabalhador/test/producao/trava.test.ts` (novo) | trava de envio | 1 |
| `supabase/migrations/20261101000200_prontidao_saude.sql`, `supabase/tests/81_prontidao_saude.test.sql`, `packages/db/src/repos.ts`, `tipos.gen.ts` | filas atrasadas | 2 |
| `tr/servidor.ts`, `tr/config.ts`, `apps/trabalhador/test/producao/saude.test.ts` (novo) | `/saude`, `/vivo` | 3 |
| `tr/servidor.ts` (só a opção do log), `apps/trabalhador/test/producao/log-segredo.test.ts` (novo) | segredo fora do log | 4 |
| `Dockerfile.trabalhador`, `Dockerfile.painel`, `deploy/docker-compose.exemplo.yml`, `.env.producao.example`, `.gitignore` | imagens e variáveis | 5 |
| `scripts/producao/migracoes.ts`, `scripts/producao/migracoes.test.ts` (novos), `package.json` | migrações da produção | 6 |
| `scripts/producao/{cifra,backup,restaurar}.ts`, `scripts/producao/cifra.test.ts`, `scripts/producao/backup-local.test.ts` (novos), `package.json` | cópia e restauração | 7 |
| `docs/producao.md` (novo), `docs/operacao.md` (§2.6) | checklist e o que fazer | 8 |
| `supabase/migrations/20261101000300_integridade_preco_pedido.sql`, `supabase/tests/82_integridade_preco_pedido.test.sql`, `packages/db/src/repos.ts`, `packages/db/test/integridade.test.ts`, `tipos.gen.ts` | preço, correção, pergunta | 9 |
| `pn/clientes/cadastros-acoes.ts`, `pn/clientes/[id]/secao-precos.tsx`, `pn/clientes/[id]/page.tsx`, `apps/painel/src/lib/precos-conflito.ts` + `.test.ts` (novos), `apps/painel/e2e/preco-conflito.spec.ts` (novo) | preço no painel | 10 |
| `tr/agente/ferramentas.ts` (`alterar_preco`), `apps/trabalhador/test/producao/preco-agente.test.ts` (novo) | preço do agente | 11 |
| `tr/assistente/ferramentas.ts`, `tr/assistente/processar.ts`, `tr/processar-conversa.ts`, `apps/trabalhador/test/producao/assistente-integridade.test.ts` (novo) | assistente | 12 |
| `supabase/migrations/20261101000400_evidencia_lgpd.sql`, `supabase/tests/83_evidencia_lgpd.test.sql`, `packages/db/src/repos.ts`, `packages/db/test/evidencia.test.ts`, `packages/db/test/limpar.ts`, `tipos.gen.ts` | evidência e LGPD | 13 |
| `tr/agente/ferramentas.ts` (`resumir_pedido_nota`, `abrir_pedido_nota`), `tr/retencao.ts`, `apps/trabalhador/test/producao/evidencia.test.ts` (novo) | prova no pedido de nota | 14 |
| `apps/painel/src/lib/linha-do-tempo.ts` + `linha-do-tempo-evidencia.test.ts` (novo), `pn/treinar-agente/acoes.ts`, `pn/treinar-agente/editor-orientacao.tsx`, `pn/atendimento/[id]/ensinar-agente.tsx`, `pn/configuracoes/secoes/guarda-evidencias.tsx` (novo), `pn/configuracoes/secoes/integracoes.tsx`, `pn/configuracoes/acoes.ts`, `apps/painel/e2e/evidencia-lgpd.spec.ts` (novo) | painel | 15 |
| `docs/producao.md`, `docs/operacao.md` | manuais | 16 |

---

### Task 1: Trabalhador. Trava de envio fora da produção (D1, D2)

**Files:**
- Create: `apps/trabalhador/src/canal/trava.ts`, `apps/trabalhador/test/producao/trava.test.ts`
- Modify: `apps/trabalhador/src/config.ts`, `apps/trabalhador/src/principal.ts`

**Interfaces:**
- Consumes: `CanalWhatsApp` (`canal/tipos.ts`: `enviarTexto(telefone, texto)`, `enviarArquivo(telefone, { url, nome })`, ambos devolvem `{ idProvedor: string }`), `normalizarTelefone`, `variantesTelefone` (`@escritorio/core`), `repos.registrarDecisao`.
- Produces:
  - `Config.AMBIENTE: 'producao' | 'homologacao' | 'local'` (**obrigatório**, revisão P2-1); `Config.TELEFONES_PERMITIDOS: string[]` (normalizados).
  - `export type RegraEnvio = { ambiente: 'producao' | 'homologacao' | 'local'; permitidos: string[] }`
  - `export function envioPermitido(regra: RegraEnvio, telefone: string): boolean`
  - `export function canalComTrava(canal: CanalWhatsApp, regra: RegraEnvio, registrar: (b: { telefoneFinal: string; tipo: 'texto' | 'arquivo' }) => Promise<void>): CanalWhatsApp`

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/producao/trava.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CanalFalso } from '../../src/canal/falso';
import { canalComTrava, envioPermitido, type RegraEnvio } from '../../src/canal/trava';
import { lerConfig } from '../../src/config';

const HOMOLOG: RegraEnvio = { ambiente: 'homologacao', permitidos: ['5531988887777'] };

describe('envioPermitido (D2)', () => {
  it('produção: tudo passa', () => {
    expect(envioPermitido({ ambiente: 'producao', permitidos: [] }, '5531911112222')).toBe(true);
  });
  it('fora da produção: só a lista, com ou sem o 9 e o 55', () => {
    expect(envioPermitido(HOMOLOG, '5531988887777')).toBe(true);
    expect(envioPermitido(HOMOLOG, '553188887777')).toBe(true);
    expect(envioPermitido(HOMOLOG, '31988887777')).toBe(true);
    expect(envioPermitido(HOMOLOG, '5531911112222')).toBe(false);
    expect(envioPermitido({ ambiente: 'local', permitidos: [] }, '5531988887777')).toBe(false);
  });
});

describe('canalComTrava (D1, Foco 1)', () => {
  it('bloqueia texto e arquivo fora da lista, registra mascarado e devolve um id de bloqueio', async () => {
    const real = new CanalFalso();
    const bloqueios: { telefoneFinal: string; tipo: string }[] = [];
    const canal = canalComTrava(real, HOMOLOG, async (b) => { bloqueios.push(b); });
    const t = await canal.enviarTexto('5531911112222', 'oi');
    const a = await canal.enviarArquivo('5531911112222', { url: 'data:application/pdf;base64,AA==', nome: 'x.pdf' });
    expect(t.idProvedor).toMatch(/^bloqueado-/);
    expect(a.idProvedor).toMatch(/^bloqueado-/);
    expect(real.enviados).toHaveLength(0);
    expect(bloqueios).toEqual([{ telefoneFinal: '…2222', tipo: 'texto' }, { telefoneFinal: '…2222', tipo: 'arquivo' }]);
  });
  it('deixa passar quem está na lista e o resto do canal (status, webhook) fica igual', async () => {
    const real = new CanalFalso();
    const canal = canalComTrava(real, HOMOLOG, async () => {});
    await canal.enviarTexto('5531988887777', 'oi');
    expect(real.enviados).toHaveLength(1);
    expect(await canal.status()).toEqual(await real.status());
  });
  it('falha ao registrar o bloqueio não derruba o fluxo', async () => {
    const canal = canalComTrava(new CanalFalso(), HOMOLOG, async () => { throw new Error('banco'); });
    await expect(canal.enviarTexto('5531911112222', 'oi')).resolves.toMatchObject({ idProvedor: expect.stringMatching(/^bloqueado-/) });
  });
});

describe('config (D2)', () => {
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !['AMBIENTE', 'TELEFONES_PERMITIDOS'].includes(k)));
  it('sem AMBIENTE o trabalhador não sobe (revisão P2-1); a lista vem normalizada', () => {
    expect(() => lerConfig({ ...base })).toThrow(/AMBIENTE/);
    const c = lerConfig({ ...base, AMBIENTE: 'homologacao', TELEFONES_PERMITIDOS: ' 31 98888-7777 , 5531977776666 ' });
    expect(c.AMBIENTE).toBe('homologacao');
    expect(c.TELEFONES_PERMITIDOS).toEqual(['5531988887777', '5531977776666']);
  });
  it('AMBIENTE desconhecido é recusado', () => {
    expect(() => lerConfig({ ...base, AMBIENTE: 'prod' })).toThrow(/AMBIENTE/);
  });
});
```

(Confira em `test/config.test.ts` como o ambiente mínimo é montado; se `lerConfig(process.env)` não tiver as obrigatórias no ambiente dos testes, use o objeto que aquele arquivo usa. Confira também o formato de `normalizarTelefone` do core para `'31 98888-7777'`: se ele não aceitar número sem `55`, o teste da lista usa `'5531 98888-7777'`.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/producao/trava.test.ts`
Expected: FAIL (`canal/trava.ts` não existe).

- [ ] **Step 3: Implemente** — `apps/trabalhador/src/canal/trava.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { normalizarTelefone, variantesTelefone } from '@escritorio/core';
import type { CanalWhatsApp } from './tipos';

/** Plano de prontidão (D2): fora da produção, só a lista recebe mensagem. */
export type RegraEnvio = { ambiente: 'producao' | 'homologacao' | 'local'; permitidos: string[] };

export function envioPermitido(regra: RegraEnvio, telefone: string): boolean {
  if (regra.ambiente === 'producao') return true;
  const n = normalizarTelefone(telefone);
  if (!n) return false;
  const lista = new Set(regra.permitidos.flatMap((p) => variantesTelefone(p)));
  return variantesTelefone(n).some((v) => lista.has(v));
}

/**
 * D1: a trava fica no canal para valer em todo caminho que manda mensagem (inclusive os que chamam o canal direto).
 * Bloqueado: devolve um id de mentira (a mensagem fica "enviada"), registra e segue — nada de erro para o fluxo.
 */
export function canalComTrava(
  canal: CanalWhatsApp, regra: RegraEnvio, registrar: (b: { telefoneFinal: string; tipo: 'texto' | 'arquivo' }) => Promise<void>,
): CanalWhatsApp {
  const bloquear = async (telefone: string, tipo: 'texto' | 'arquivo') => {
    const telefoneFinal = `…${telefone.replace(/\D/g, '').slice(-4)}`;
    console.warn(`[trava] envio bloqueado fora da produção (${tipo}) para ${telefoneFinal}`);
    await registrar({ telefoneFinal, tipo }).catch((e) => console.error('[trava] bloqueio não registrado', e));
    return { idProvedor: `bloqueado-${randomUUID()}` };
  };
  // Os quatro membros de CanalWhatsApp (canal/tipos.ts): os dois envios com a trava, o resto repassado.
  return {
    interpretarWebhook: (corpo) => canal.interpretarWebhook(corpo),
    status: () => canal.status(),
    enviarTexto: (telefone, texto) => (envioPermitido(regra, telefone) ? canal.enviarTexto(telefone, texto) : bloquear(telefone, 'texto')),
    enviarArquivo: (telefone, a) => (envioPermitido(regra, telefone) ? canal.enviarArquivo(telefone, a) : bloquear(telefone, 'arquivo')),
  };
}
```

(`normalizarTelefone` e `variantesTelefone` estão em `packages/core/src/telefone.ts:1,9`.)

`apps/trabalhador/src/config.ts`, antes de `PORTA`:

```ts
  // Plano de prontidão (D2, revisão P2-1): obrigatório — sem ele a produção ficaria muda sem ninguém saber.
  AMBIENTE: z.enum(['producao', 'homologacao', 'local']),
  // Telefones que recebem mensagem fora da produção, separados por vírgula.
  TELEFONES_PERMITIDOS: z.string().optional().transform((v) => (v ?? '').split(',').map((t) => normalizarTelefone(t.trim())).filter((t): t is string => Boolean(t))),
  // Plano de prontidão (D3): com ele, /saude mostra os detalhes.
  SAUDE_TOKEN: z.string().optional().transform((v) => v?.trim() || undefined),
```

(importe `normalizarTelefone` de `@escritorio/core`).

`apps/trabalhador/src/principal.ts`: troque `const canal = criarCanalZapi({…});` por:

```ts
  // Plano de prontidão (D1, D2): fora da produção, só os telefones da lista recebem mensagem.
  const canal = canalComTrava(criarCanalZapi({ instancia: cfg.ZAPI_INSTANCIA, token: cfg.ZAPI_TOKEN, clientToken: cfg.ZAPI_CLIENT_TOKEN }),
    { ambiente: cfg.AMBIENTE, permitidos: cfg.TELEFONES_PERMITIDOS },
    (b) => repos.registrarDecisao({ conversaId: null, clienteId: null, etapa: 'envio_bloqueado', entrada: b, saida: { ambiente: cfg.AMBIENTE } }));
  if (cfg.AMBIENTE !== 'producao') console.warn(`[trava] ${cfg.AMBIENTE}: só ${cfg.TELEFONES_PERMITIDOS.length} telefone(s) da lista recebem mensagem.`);
```

**Atenção (`AMBIENTE` obrigatório):** os testes antigos que chamam `lerConfig` (ex.: `test/config.test.ts`) leem o `.env` local; o `.env` local desta execução já tem `AMBIENTE=local` (Regras de ambiente, item 3 das portas). Se um teste antigo montar o ambiente à mão **sem** `AMBIENTE` e esperar sucesso, **pare** e avise (é a mudança da D2). O `.env.example` ganha `AMBIENTE=local` e `TELEFONES_PERMITIDOS=` com o comentário da D2.

**O painel mostra a mensagem bloqueada (revisão P2-1):** em `apps/painel/src/components/patterns/message-bubble.tsx`, a prop nova `bloqueada?: boolean` mostra, no lugar de "Falhou ao enviar", uma etiqueta `bg-warning-soft text-warning` com o ícone `ShieldOff` (`size={16}`) e o texto **"Não enviada: ambiente de teste"**; em `apps/painel/src/app/(painel)/atendimento/[id]/conversa-aberta.tsx:175`, ao lado de `falhou`, `bloqueada: (m.id_provedor ?? '').startsWith('bloqueado-')` (a consulta já lê `*`). Teste novo `apps/painel/src/components/patterns/message-bubble-bloqueada.test.tsx` **ou**, se o painel não testa componentes com vitest, um caso a mais no e2e da Task 10 (`preco-conflito.spec.ts` não; crie `apps/painel/e2e/envio-bloqueado.spec.ts`: uma mensagem de saída com `id_provedor = 'bloqueado-x'` e `status_envio = 'enviada'` → o Atendimento mostra "Não enviada: ambiente de teste"). Confira antes com `grep -rn "Falhou ao enviar" apps/painel/e2e`.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/painel typecheck`
Expected: PASS; os testes antigos usam o `CanalFalso` direto (sem a trava) e não mudam.

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/canal/trava.ts apps/trabalhador/src/config.ts apps/trabalhador/src/principal.ts apps/trabalhador/test/producao/trava.test.ts .env.example apps/painel/src/components/patterns/message-bubble.tsx "apps/painel/src/app/(painel)/atendimento/[id]/conversa-aberta.tsx" apps/painel/e2e/envio-bloqueado.spec.ts
git commit -m "feat(trabalhador): fora da produção, só os telefones da lista recebem mensagem (prontidão, D1, D2)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banco. Fila de conversas atrasada (D3)

**Files:**
- Create: `supabase/migrations/20261101000200_prontidao_saude.sql`, `supabase/tests/81_prontidao_saude.test.sql` (o teste de repositório que só conferia `>= 0` saiu — revisão P2-15; o pgTAP cobre)
- Modify: `packages/db/src/repos.ts`, `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Produces: SQL `public.filas_atrasadas(p_minutos int) returns int` (só `service_role`; 0 sem `pgboss.job`; conta `processar-conversa` **e** `enviar-mensagem` — a resposta da equipe ao cliente pelo painel, revisão P2-11); `repos.filasAtrasadas(minutos: number): Promise<number>` (banco sem a migração: `0`).

- [ ] **Step 1: Escreva o teste que falha** — `supabase/tests/81_prontidao_saude.test.sql`:

```sql
-- Plano de prontidão, Task 2 (D3; revisão P2-11): jobs de conversa e de resposta do painel esperando há mais de N minutos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function('public', 'filas_atrasadas', array['integer'], 'filas_atrasadas(int)');
-- Sem a tabela do pg-boss (banco novo, trabalhador nunca ligou): zero, sem erro.
select is(public.filas_atrasadas(5), 0, 'sem pgboss.job: 0');

create schema if not exists pgboss;
create table if not exists pgboss.job (id uuid default gen_random_uuid(), name text, state text, created_on timestamptz, start_after timestamptz);
insert into pgboss.job (name, state, created_on, start_after) values
  ('processar-conversa', 'created', now() - interval '10 minutes', now() - interval '10 minutes'),
  ('processar-conversa', 'retry', now() - interval '8 minutes', now() - interval '7 minutes'),
  ('processar-conversa', 'created', now() - interval '1 minute', now() - interval '1 minute'),
  ('processar-conversa', 'active', now() - interval '10 minutes', now() - interval '10 minutes'),
  ('enviar-mensagem', 'created', now() - interval '9 minutes', now() - interval '9 minutes'),
  ('assistente', 'created', now() - interval '10 minutes', now() - interval '10 minutes');
select is(public.filas_atrasadas(5), 3, 'conversas e respostas do painel, esperando (created/retry) há mais de 5 min; assistente fora');

set local role authenticated;
select throws_ok($$ select public.filas_atrasadas(5) $$, '42501', null, 'pessoa não chama');
reset role;
select ok(not has_function_privilege('anon', 'public.filas_atrasadas(int)', 'execute'), 'anon não chama');

select * from finish();
rollback;
```

(O `create table if not exists pgboss.job` só cria se o banco de teste não tiver o pg-boss; o `rollback` desfaz. Se o banco local **já** tiver `pgboss.job` de verdade com colunas a mais e obrigatórias, troque o `insert` para listar as colunas que existirem — `\d pgboss.job` — sem mudar o que o teste confere.)

- [ ] **Step 2: Rode e veja falhar** (Supabase local com a vez reservada)

Run: `supabase test db` → `81` FAIL.

- [ ] **Step 3: Implemente** — `supabase/migrations/20261101000200_prontidao_saude.sql`:

```sql
-- supabase/migrations/20261101000200_prontidao_saude.sql
-- Plano de prontidão (D3; revisão P2-11): o /saude responde 503 quando há conversa ou resposta do painel esperando há mais de N minutos.
-- O pg-boss cria o esquema "pgboss" ao ligar o trabalhador: sem ele, 0 (banco novo).
create function public.filas_atrasadas(p_minutos int) returns int
language plpgsql stable security definer set search_path = '' as $$
declare v int;
begin
  if to_regclass('pgboss.job') is null then return 0; end if;
  execute $q$ select count(*)::int from pgboss.job
              where name in ('processar-conversa', 'enviar-mensagem') and state in ('created', 'retry')
                and start_after < now() - make_interval(mins => $1) $q$ into v using p_minutos;
  return v;
end $$;
revoke execute on function public.filas_atrasadas(int) from public, anon, authenticated;
grant execute on function public.filas_atrasadas(int) to service_role;
```

Em `packages/db/src/repos.ts`, no fim do objeto:

```ts
    /** Plano de prontidão (D3, P2-11): jobs de conversa e de resposta do painel esperando há mais de `minutos`. Banco sem a migração: 0. */
    async filasAtrasadas(minutos: number): Promise<number> {
      const r = await db.rpc('filas_atrasadas', { p_minutos: minutos });
      if (r.error && SEM_PARTE_I.has(r.error.code)) return 0;
      return Number(checar(r, 'filasAtrasadas'));
    },
```

`pnpm db:tipos`.

- [ ] **Step 4: Rode**

Run: `supabase db reset && supabase test db && pnpm --filter @escritorio/db typecheck`
Expected: tudo passa; `81` 5/5; `22` 100/100.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`)

```bash
git add supabase/migrations/20261101000200_prontidao_saude.sql supabase/tests/81_prontidao_saude.test.sql packages/db/src/repos.ts packages/db/src/tipos.gen.ts
git commit -m "feat(banco): conversas e respostas do painel esperando na fila há mais de N minutos, para o /saude (prontidão, D3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Trabalhador. `/saude` completo e `/vivo` (D3)

**Files:**
- Modify: `apps/trabalhador/src/servidor.ts`, `apps/trabalhador/src/principal.ts` (passa o token)
- Create: `apps/trabalhador/test/producao/saude.test.ts`

**Interfaces:**
- Consumes: `repos.sinaisVida()`, `repos.filasAtrasadas(5)` (Task 2), `Config.SAUDE_TOKEN` (Task 1).
- Produces: `DepsServidor.saudeToken?: string`; `export const LIMITES_SAUDE = { sinalMs: 180_000, filaMin: 5 }`; `export async function avaliarSaude(repos, agora: Date): Promise<{ ok: boolean; falhas: ('banco'|'batimento'|'whatsapp'|'fila')[]; sinais: Record<string, string>; fila_atrasada: number }>`; rotas `GET /saude` e `GET /vivo`.

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/producao/saude.test.ts` (sem banco: `repos` falso, só os dois métodos):

```ts
import { describe, expect, it } from 'vitest';
import { CanalFalso } from '../../src/canal/falso';
import { avaliarSaude, criarServidor } from '../../src/servidor';

const AGORA = new Date('2026-11-02T13:00:00Z');
const ha = (min: number) => new Date(AGORA.getTime() - min * 60_000);
const repos = (x: { sinais?: Record<string, Date>; fila?: number; bancoFora?: boolean }) => ({
  sinaisVida: async () => { if (x.bancoFora) throw new Error('banco fora'); return x.sinais ?? {}; },
  filasAtrasadas: async () => x.fila ?? 0,
}) as never;
const app = (r: ReturnType<typeof repos>, token?: string) =>
  criarServidor({ canal: new CanalFalso(), repos: r, fila: { enviar: async () => {} }, segredo: 'segredo-de-teste-123456', relogio: () => AGORA, saudeToken: token });

describe('avaliarSaude (D3, Foco 2)', () => {
  it('tudo em dia: ok', async () => {
    expect(await avaliarSaude(repos({ sinais: { fila: ha(1), whatsapp: ha(1) } }), AGORA)).toMatchObject({ ok: true, falhas: [] });
  });
  it('cada falha com o seu nome', async () => {
    expect((await avaliarSaude(repos({ sinais: { fila: ha(4), whatsapp: ha(1) } }), AGORA)).falhas).toEqual(['batimento']);
    expect((await avaliarSaude(repos({ sinais: { fila: ha(1) } }), AGORA)).falhas).toEqual(['whatsapp']);
    expect((await avaliarSaude(repos({ sinais: { fila: ha(1), whatsapp: ha(1) }, fila: 2 }), AGORA)).falhas).toEqual(['fila']);
    expect((await avaliarSaude(repos({ bancoFora: true }), AGORA)).falhas).toEqual(['banco']);
  });
});

describe('/saude e /vivo', () => {
  it('sem token: só o ok, 200 ou 503', async () => {
    const bom = await app(repos({ sinais: { fila: ha(1), whatsapp: ha(1) } })).inject({ url: '/saude' });
    expect(bom.statusCode).toBe(200);
    expect(bom.json()).toEqual({ ok: true });
    const ruim = await app(repos({ sinais: { fila: ha(1) } })).inject({ url: '/saude' });
    expect(ruim.statusCode).toBe(503);
    expect(ruim.json()).toEqual({ ok: false });
  });
  it('com o token certo (cabeçalho ou ?token=): os detalhes; token errado: sem detalhes, não 401', async () => {
    const a = app(repos({ sinais: { fila: ha(1) }, fila: 3 }), 'tok-123');
    const c = await a.inject({ url: '/saude', headers: { 'x-saude-token': 'tok-123' } });
    expect(c.json()).toMatchObject({ ok: false, falhas: ['whatsapp', 'fila'], fila_atrasada: 3 });
    expect(c.json()).toHaveProperty('ambiente');
    expect((await a.inject({ url: '/saude?token=tok-123' })).json()).toHaveProperty('falhas');
    const e = await a.inject({ url: '/saude', headers: { 'x-saude-token': 'errado' } });
    expect(e.statusCode).toBe(503);
    expect(e.json()).toEqual({ ok: false });
  });
  it('/vivo: 200 mesmo com o WhatsApp fora (o contêiner não reinicia por causa do celular)', async () => {
    const r = await app(repos({ bancoFora: true })).inject({ url: '/vivo' });
    expect(r.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/producao/saude.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implemente** — em `apps/trabalhador/src/servidor.ts`:
1. `DepsServidor` ganha `saudeToken?: string` e `ambiente?: string` (revisão P2-1).
2. Troque `const LIMITE_SINAL_MS = 3 * 60_000;` por `export const LIMITES_SAUDE = { sinalMs: 3 * 60_000, filaMin: 5 } as const;`.
3. Acrescente, fora de `criarServidor`:

```ts
type Falha = 'banco' | 'batimento' | 'whatsapp' | 'fila';
/** Plano de prontidão (D3): o que o monitor externo precisa saber. Sem segredo na resposta. */
export async function avaliarSaude(repos: Pick<Repos, 'sinaisVida' | 'filasAtrasadas'>, agora: Date) {
  let sinais: Record<string, Date>;
  try {
    sinais = await repos.sinaisVida();
  } catch {
    return { ok: false, falhas: ['banco'] as Falha[], sinais: {}, fila_atrasada: 0 };
  }
  const recente = (c: string) => Boolean(sinais[c] && agora.getTime() - sinais[c].getTime() < LIMITES_SAUDE.sinalMs);
  const fila = await repos.filasAtrasadas(LIMITES_SAUDE.filaMin).catch(() => 0);
  const falhas: Falha[] = [];
  if (!recente('fila')) falhas.push('batimento');
  if (!recente('whatsapp')) falhas.push('whatsapp');
  if (fila > 0) falhas.push('fila');
  return { ok: falhas.length === 0, falhas, sinais: Object.fromEntries(Object.entries(sinais).map(([k, v]) => [k, v.toISOString()])), fila_atrasada: fila };
}
```

4. Troque a rota `/saude` por:

```ts
  app.get<{ Querystring: { token?: string } }>('/saude', async (req, rep) => {
    const s = await avaliarSaude(d.repos, d.relogio());
    const dado = (req.headers['x-saude-token'] as string | undefined) ?? req.query.token ?? '';
    // Token errado = como sem token (o monitor sem token continua funcionando); nada de 401.
    const detalhes = Boolean(d.saudeToken) && segredoConfere(dado, d.saudeToken!);
    // Revisão P2-1: com o token, o ambiente aparece (produção sem AMBIENTE=producao não passa despercebida).
    return rep.code(s.ok ? 200 : 503).send(detalhes ? { ...s, ambiente: d.ambiente ?? null } : { ok: s.ok });
  });
  // D3: o HEALTHCHECK do contêiner; só diz que o processo responde (WhatsApp fora não reinicia o trabalhador).
  app.get('/vivo', async () => ({ ok: true }));
```

5. O mascaramento do log passa a cobrir `?token=`: no serializer, `url: req.url.replace(/\/webhook\/zapi\/[^/?]+/, '/webhook/zapi/***').replace(/([?&]token=)[^&]+/, '$1***')`.

Em `principal.ts`: `criarServidor({ …, saudeToken: cfg.SAUDE_TOKEN, ambiente: cfg.AMBIENTE })`.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS, inclusive `servidor.test.ts:69` (o teste antigo do `/saude`, só o código).

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/servidor.ts apps/trabalhador/src/principal.ts apps/trabalhador/test/producao/saude.test.ts
git commit -m "feat(trabalhador): /saude com banco, batimento, WhatsApp e fila, detalhes só com token, e /vivo para o contêiner (prontidão, D3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Trabalhador. O segredo do webhook nunca vai ao log (D4)

**Files:**
- Modify: `apps/trabalhador/src/servidor.ts` (só a opção de destino do log, para o teste)
- Create: `apps/trabalhador/test/producao/log-segredo.test.ts`

**Interfaces:**
- Produces: `DepsServidor.destinoLog?: { write(msg: string): void }` (só testes; padrão: a saída de sempre).

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/producao/log-segredo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CanalFalso } from '../../src/canal/falso';
import { criarServidor } from '../../src/servidor';

const SEGREDO = 'segredo-muito-secreto-987654321';

function servidor(extra: Partial<Parameters<typeof criarServidor>[0]> = {}) {
  const linhas: string[] = [];
  const app = criarServidor({
    canal: new CanalFalso(), fila: { enviar: async () => {} }, segredo: SEGREDO, relogio: () => new Date(),
    repos: { buscarContato: async () => { throw new Error(`falhou ao ler /webhook/zapi/${SEGREDO}`); } } as never,
    destinoLog: { write: (m: string) => { linhas.push(m); } }, saudeToken: 'tok-secreto-1', ...extra,
  });
  return { app, linhas };
}

describe('segredo fora do log (D4, Prompt 2 item 3)', () => {
  it('segredo certo, segredo errado, erro dentro da rota e ?token= do /saude', async () => {
    const { app, linhas } = servidor();
    const corpo = f.texto;   // import * as f from '../fixtures/zapi/sinteticos' (o mesmo de servidor.test.ts)
    await app.inject({ method: 'POST', url: `/webhook/zapi/${SEGREDO}`, payload: corpo });
    await app.inject({ method: 'POST', url: '/webhook/zapi/segredo-errado-000000', payload: corpo });
    await app.inject({ url: '/saude?token=tok-secreto-1' });
    await app.close();
    const tudo = linhas.join('\n');
    expect(tudo.length).toBeGreaterThan(0);
    expect(tudo).not.toContain(SEGREDO);
    expect(tudo).not.toContain('segredo-errado-000000');
    expect(tudo).not.toContain('tok-secreto-1');
  });
});
```

(Acrescente `import * as f from '../fixtures/zapi/sinteticos';` no topo; `f.texto` é o webhook sintético de texto, `messageId: 'MSG-TEXTO-1'`.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/producao/log-segredo.test.ts`
Expected: FAIL — `destinoLog` não existe (nada é capturado) **e**, provavelmente, a mensagem do erro da rota (`err.message`) leva o segredo para o log.

- [ ] **Step 3: Implemente** — em `criarServidor`:

```ts
  const app = Fastify({
    bodyLimit: 1_000_000,
    logger: {
      level: 'info',
      ...(d.destinoLog ? { stream: d.destinoLog } : {}),
      // O segredo do webhook (na URL) e o token do /saude nunca vão para o log — nem na mensagem de um erro.
      serializers: {
        req: (req) => ({ method: req.method, url: mascarar(req.url) }),
        err: (e: Error) => ({ type: e.name, message: mascarar(e.message) }),
      },
    },
  });
```

com, fora da função:

```ts
const mascarar = (t: string) => t.replace(/\/webhook\/zapi\/[^/?\s]+/g, '/webhook/zapi/***').replace(/([?&]token=)[^&\s]+/g, '$1***');
```

e `DepsServidor` ganha `destinoLog?: { write(msg: string): void }`. Se o Fastify registrar o erro da rota por outro caminho (ex.: `res` com a URL), acrescente o serializer `res` também mascarado e rode de novo.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/servidor.ts apps/trabalhador/test/producao/log-segredo.test.ts
git commit -m "fix(trabalhador): segredo do webhook e token do /saude mascarados também nas mensagens de erro do log (prontidão, D4)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Implantação. Imagens, compose de exemplo e variáveis (D5, D6)

**Files:**
- Modify: `Dockerfile.trabalhador`, `Dockerfile.painel`, `.gitignore`
- Create: `deploy/docker-compose.exemplo.yml`, `.env.producao.example`

- [ ] **Step 1: `Dockerfile.trabalhador`** — o estágio final passa a ser:

```dockerfile
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /saida/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/apps/trabalhador/dist ./dist
# Plano de prontidão (D5): sem root; /vivo só diz que o processo responde (WhatsApp fora não reinicia o contêiner).
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORTA||3001)+'/vivo').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/principal.js"]
```

- [ ] **Step 2: `Dockerfile.painel`** — o estágio final:

```dockerfile
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /repo/apps/painel/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/painel/.next/static ./apps/painel/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/entrar').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/painel/server.js"]
```

(Confira com `grep -rn "public" apps/painel/next.config.*` se há pasta `public` a copiar; se houver, acrescente `COPY --from=build --chown=node:node /repo/apps/painel/public ./apps/painel/public` como manda a documentação do `standalone`.)

- [ ] **Step 3: `.env.producao.example`** — copie a estrutura do `.env.example` (os mesmos comentários e nomes), **sem nenhum valor**, e acrescente no topo:

```bash
# Produção. Copie para .env.producao (fora do git) só na máquina que roda pnpm db:producao:* e pnpm backup:*;
# no Easypanel, cole as variáveis na aba Environment de cada app. NUNCA ponha valores reais neste arquivo de exemplo.

# Plano de prontidão (D2): obrigatório na produção. Sem ele, nada é enviado a cliente (vale "homologacao").
AMBIENTE=producao
# Fora da produção: telefones que podem receber mensagem, separados por vírgula (ex.: o seu e o número de teste).
TELEFONES_PERMITIDOS=
# Plano de prontidão (D3): com ele, /saude?token=... mostra o que falhou. Gere com: node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
SAUDE_TOKEN=
# Plano de confiabilidade (D10): conversas ao mesmo tempo, de 1 a 8 (padrão 4).
CONCORRENCIA_AGENTE=4
# Chave da Anthropic SÓ da produção (outra na homologação), com limite de gasto no console.
ANTHROPIC_API_KEY=
# Cópia de segurança (Task 7): 32 bytes em base64; guarde também fora do computador. Perder = cópias ilegíveis.
BACKUP_CHAVE=
BACKUP_PASTA=
```

- [ ] **Step 4: `deploy/docker-compose.exemplo.yml`**:

```yaml
# Exemplo para o Easypanel (ou qualquer Docker). Os valores vêm do .env.producao (fora do git) ou da aba Environment.
# Plano de prontidão (D5). Nada de valor real aqui.
services:
  trabalhador:
    build: { context: .., dockerfile: Dockerfile.trabalhador }
    env_file: ../.env.producao
    ports: ["3001:3001"]
    restart: unless-stopped
    mem_limit: 768m
  painel:
    build:
      context: ..
      dockerfile: Dockerfile.painel
      args:
        NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL}
        NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA: ${NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA}
    env_file: ../.env.producao
    ports: ["3000:3000"]
    restart: unless-stopped
    mem_limit: 768m
```

- [ ] **Step 5: `.gitignore`** — acrescente `.env.producao` e `backups/`. Confira com `git check-ignore -v .env.producao backups/x` que os dois são ignorados.

- [ ] **Step 6: Build local (D6)** — **só** com Docker instalado (`docker --version`), o Supabase local **desligado** e **≥ 6 GB livres**; um de cada vez:

```bash
docker build -f Dockerfile.trabalhador -t escritorio-trabalhador:teste .
docker run --rm -d --name trab-teste -e PORTA=3001 escritorio-trabalhador:teste || true   # sem variáveis ele sai: só confere que a imagem sobe e o usuário é node
docker run --rm escritorio-trabalhador:teste whoami    # esperado: node
docker build -f Dockerfile.painel --build-arg NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 --build-arg NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA=x -t escritorio-painel:teste .
docker run --rm escritorio-painel:teste whoami         # esperado: node
docker image rm escritorio-trabalhador:teste escritorio-painel:teste
```

Expected: os dois builds terminam; `whoami` = `node`. Sem Docker ou sem memória: **não rode**; anote como pendência (D6). Build que falhar por falta de memória (processo morto) → **pare** e avise.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile.trabalhador Dockerfile.painel deploy/docker-compose.exemplo.yml .env.producao.example .gitignore
git commit -m "build: imagens sem root com verificação de vida, compose de exemplo e .env.producao.example (prontidão, D5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Scripts. Migrações da produção com prévia e confirmação (D7; revisão P2-7, P2-8, P2-9)

**Files:**
- Create: `scripts/producao/migracoes.ts`, `scripts/producao/migracoes.test.ts`
- Modify: `package.json` da raiz, `.gitignore` (`.producao-previa.txt`), `.env.producao.example` (`SUPABASE_ACCESS_TOKEN`)

**Interfaces:**
- Produces:
  - `export const FRASE = 'APLICAR NA PRODUCAO';`
  - `export function refDoProjeto(url: string): string | null` — o identificador do projeto Supabase tirado de `db.<ref>.supabase.co` ou do usuário `postgres.<ref>` (pooler); `null` se não for do Supabase.
  - `export function conferirAlvo(urlProducao: string, urlHomologacao: string | null): string | null` (motivo da recusa, ou `null`) — compara pelo `ref` (revisão P2-8).
  - `export function partesDaUrl(url: string): { host: string; porta: string; usuario: string; senha: string; banco: string }`
  - `export function migracoesDaSaida(saida: string): string[]` — os nomes `AAAAMMDDHHMMSS_….sql` que a saída do `--dry-run` lista, em ordem.
  - `export function passos(modo: 'previa' | 'aplicar', ref: string): { nome: string; comando: string[] }[]` — **nenhum** comando leva URL nem senha (revisão P2-9).
  - `principal()`: lê `--env-file` (padrão `.env.producao`), monta o ambiente do processo filho (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) e roda cada passo com `spawnSync(…, { env })`.

- [ ] **Step 1: Escreva o teste que falha** — `scripts/producao/migracoes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FRASE, conferirAlvo, migracoesDaSaida, partesDaUrl, passos, refDoProjeto } from './migracoes';

const POOLER = 'postgresql://postgres.abcdefghijklmnop:s3nh@&%^@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
const DIRETA = 'postgresql://postgres:outra@db.abcdefghijklmnop.supabase.co:5432/postgres';
const PROD = 'postgresql://postgres.zyxwvutsrqponmlk:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';

describe('refDoProjeto e conferirAlvo (revisão P2-8, Foco 7)', () => {
  it('o mesmo projeto pelo pooler e pela conexão direta', () => {
    expect(refDoProjeto(POOLER)).toBe('abcdefghijklmnop');
    expect(refDoProjeto(DIRETA)).toBe('abcdefghijklmnop');
    expect(refDoProjeto('postgresql://u:x@127.0.0.1:54322/postgres')).toBeNull();
  });
  it('recusa vazio, local, fora do Supabase e o mesmo projeto da homologação por outro endereço', () => {
    expect(conferirAlvo('', null)).toMatch(/DATABASE_URL/);
    expect(conferirAlvo('postgresql://postgres:x@127.0.0.1:54322/postgres', null)).toMatch(/local/);
    expect(conferirAlvo('postgresql://u:x@meu-servidor:5432/p', null)).toMatch(/Supabase/);
    expect(conferirAlvo(DIRETA, POOLER)).toMatch(/homologação/);
    expect(conferirAlvo(PROD, POOLER)).toBeNull();
  });
});

describe('sem senha na linha de comando (revisão P2-9)', () => {
  it('partesDaUrl lê a senha com caracteres especiais', () => {
    expect(partesDaUrl(POOLER)).toEqual({ host: 'aws-0-sa-east-1.pooler.supabase.com', porta: '5432', usuario: 'postgres.abcdefghijklmnop', senha: 's3nh@&%^', banco: 'postgres' });
  });
  it('nenhum passo leva URL, senha, --db-url ou --password', () => {
    for (const modo of ['previa', 'aplicar'] as const) {
      for (const p of passos(modo, 'zyxwvutsrqponmlk')) expect(p.comando.join(' ')).not.toMatch(/postgresql:\/\/|s3nh|--db-url|--password/);
    }
  });
  it('prévia: ligar + dry-run; aplicar: ligar, migrações e os dados iniciais, nesta ordem', () => {
    expect(passos('previa', 'zyx').map((p) => p.nome)).toEqual(['ligar ao projeto', 'migrações (prévia)']);
    expect(passos('aplicar', 'zyx').map((p) => p.nome)).toEqual(['ligar ao projeto', 'migrações', 'setores novos', 'orientações iniciais do Thiago']);
    expect(passos('aplicar', 'zyx')[0]!.comando).toEqual(['supabase', 'link', '--project-ref', 'zyx']);
    expect(passos('aplicar', 'zyx')[2]!.comando.join(' ')).toContain('setores-novos.sql');
  });
  it('a frase é a combinada', () => { expect(FRASE).toBe('APLICAR NA PRODUCAO'); });
});

describe('a prévia aprovada (revisão P2-7)', () => {
  it('tira da saída do dry-run só os nomes das migrações, em ordem', () => {
    const saida = 'Would push these migrations:\n • 20261018000100_painel_v2_pedir.sql\n • 20261101000100_confiabilidade_agente.sql\nFinished supabase db push.';
    expect(migracoesDaSaida(saida)).toEqual(['20261018000100_painel_v2_pedir.sql', '20261101000100_confiabilidade_agente.sql']);
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm exec vitest run scripts/producao/migracoes.test.ts` (na raiz)
Expected: FAIL.

- [ ] **Step 3: Implemente** — `scripts/producao/migracoes.ts`:

```ts
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

// Plano de prontidão (D7; revisão P2-7, P2-8, P2-9): migrações e dados iniciais da produção, com prévia guardada,
// cópia antes de aplicar e confirmação digitada. Senha nunca na linha de comando. Nunca rode em teste.
export const FRASE = 'APLICAR NA PRODUCAO';
const PREVIA = '.producao-previa.txt';

export function refDoProjeto(url: string): string | null {
  return /@db\.([a-z0-9]{10,})\.supabase\.co/.exec(url)?.[1] ?? /\/\/postgres\.([a-z0-9]{10,})[:@]/.exec(url)?.[1] ?? null;
}

export function conferirAlvo(urlProducao: string, urlHomologacao: string | null): string | null {
  if (!urlProducao) return 'Falta DATABASE_URL no arquivo de variáveis da produção.';
  if (/127\.0\.0\.1|localhost/.test(urlProducao)) return 'A DATABASE_URL aponta para o banco local: isto é só para a produção.';
  const ref = refDoProjeto(urlProducao);
  if (!ref) return 'A DATABASE_URL não é de um projeto do Supabase.';
  if (urlHomologacao && refDoProjeto(urlHomologacao) === ref) return 'A DATABASE_URL é do mesmo projeto da homologação.';
  return null;
}

export function partesDaUrl(url: string) {
  // A senha pode ter @ & % ^: o último "@" antes do host separa usuário:senha do endereço.
  const m = /^postgres(?:ql)?:\/\/([^:]+):(.*)@([^@:/]+):(\d+)\/([^?]+)/.exec(url);
  if (!m) throw new Error('DATABASE_URL em formato inesperado.');
  return { host: m[3]!, porta: m[4]!, usuario: m[1]!, senha: m[2]!, banco: m[5]! };
}

export function migracoesDaSaida(saida: string): string[] {
  return [...saida.matchAll(/(\d{14}_[\w-]+\.sql)/g)].map((x) => x[1]!);
}

export function passos(modo: 'previa' | 'aplicar', ref: string): { nome: string; comando: string[] }[] {
  const ligar = { nome: 'ligar ao projeto', comando: ['supabase', 'link', '--project-ref', ref] };
  // psql da imagem do Postgres; as PG* vêm do ambiente do processo ("-e NOME" sem valor = herda), nunca na linha de comando.
  const psql = (arq: string) => ['docker', 'run', '--rm', '-e', 'PGHOST', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD', '-e', 'PGDATABASE',
    '-v', `${process.cwd()}/supabase/dados:/dados:ro`, 'postgres:17', 'psql', '-v', 'ON_ERROR_STOP=1', '-f', `/dados/${arq}`];
  if (modo === 'previa') return [ligar, { nome: 'migrações (prévia)', comando: ['supabase', 'db', 'push', '--linked', '--dry-run'] }];
  return [
    ligar,
    { nome: 'migrações', comando: ['supabase', 'db', 'push', '--linked'] },
    // Os dois só criam o que falta (conferem pelo nome).
    { nome: 'setores novos', comando: psql('setores-novos.sql') },
    { nome: 'orientações iniciais do Thiago', comando: psql('orientacoes-skill-dono.sql') },
  ];
}

function lerEnv(arquivo: string): Record<string, string> {
  if (!existsSync(arquivo)) return {};
  return Object.fromEntries(readFileSync(arquivo, 'utf8').split(/\r?\n/).flatMap((l) => {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l);
    return m ? [[m[1]!, m[2]!.replace(/^["']|["']$/g, '')]] : [];
  }));
}

function rodar(comando: string[], env: NodeJS.ProcessEnv, capturar = false) {
  // Windows: o supabase é um .cmd e precisa de shell; nada sensível vai nos argumentos (está no env).
  return spawnSync(comando[0]!, comando.slice(1), { env, shell: process.platform === 'win32' && comando[0] === 'supabase',
    stdio: capturar ? ['inherit', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' });
}

async function principal() {
  const modo = process.argv[2] === 'aplicar' ? 'aplicar' : 'previa';
  const arquivo = process.argv.find((a) => a.startsWith('--env-file='))?.split('=')[1] ?? '.env.producao';
  const vars = lerEnv(arquivo);
  const url = vars.DATABASE_URL ?? '';
  // Só o endereço da homologação é lido, para recusar o mesmo projeto; o arquivo nunca é alterado.
  const recusa = conferirAlvo(url, lerEnv('.env.homologacao').DATABASE_URL ?? null);
  if (recusa) { console.error(recusa); process.exit(1); }
  if (!vars.SUPABASE_ACCESS_TOKEN) { console.error('Falta SUPABASE_ACCESS_TOKEN no arquivo de variáveis da produção.'); process.exit(1); }
  const u = partesDaUrl(url);
  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: vars.SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD: u.senha,
    PGHOST: u.host, PGPORT: u.porta, PGUSER: u.usuario, PGPASSWORD: u.senha, PGDATABASE: u.banco };
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const sair = (msg: string) => { console.log(msg); rl.close(); process.exit(1); };
  if (modo === 'aplicar') {
    // Revisão P2-7: migração não tem volta — primeiro a cópia; depois, a lista tem de ser a da prévia aprovada.
    const copia = await rl.question('Fez uma cópia AGORA (Supabase › Database › Backups › "Backup now", ou a cópia semanal)? Digite SIM: ');
    if (copia.trim() !== 'SIM') sair('Sem cópia, nada é aplicado. Saindo.');
    if (!existsSync(PREVIA)) sair(`Rode antes pnpm db:producao:previa (ela grava ${PREVIA}).`);
  }
  for (const p of passos(modo, refDoProjeto(url)!)) {
    if (modo === 'aplicar' && p.nome === 'migrações') {
      const agora = rodar(['supabase', 'db', 'push', '--linked', '--dry-run'], env, true);
      const lista = migracoesDaSaida(agora.stdout ?? '');
      const aprovada = readFileSync(PREVIA, 'utf8').split('\n').filter(Boolean);
      if (lista.join('\n') !== aprovada.join('\n')) sair(`A lista de migrações mudou desde a prévia aprovada:\n${lista.join('\n')}\nRode a prévia de novo.`);
      console.log(`Migrações a aplicar (iguais à prévia):\n${lista.join('\n')}`);
    }
    if (modo === 'aplicar' && p.nome !== 'ligar ao projeto') {
      const r = await rl.question(`Passo "${p.nome}". Digite ${FRASE} para continuar (qualquer outra coisa sai): `);
      if (r.trim() !== FRASE) sair('Nada foi feito neste passo. Saindo.');
    }
    const previa = modo === 'previa' && p.nome === 'migrações (prévia)';
    const r = rodar(p.comando, env, previa);
    if (r.status !== 0) sair(`O passo "${p.nome}" falhou. Os passos seguintes não rodaram.`);
    if (previa) {
      process.stdout.write(r.stdout ?? '');
      const lista = migracoesDaSaida(r.stdout ?? '');
      writeFileSync(PREVIA, `${lista.join('\n')}\n`, 'utf8');
      console.log(`\n${lista.length} migração(ões) na prévia, guardadas em ${PREVIA}. Confira a ordem (as da Parte I antes das 20261101…).`);
    }
  }
  rl.close();
}

if (process.argv[1]?.endsWith('migracoes.ts')) void principal();
```

No `package.json` da raiz, em `scripts`:

```json
    "db:producao:previa": "tsx scripts/producao/migracoes.ts previa",
    "db:producao:aplicar": "tsx scripts/producao/migracoes.ts aplicar",
```

(Se `tsx` não estiver nas dependências da raiz, use `pnpm --filter @escritorio/trabalhador exec tsx ../../scripts/producao/migracoes.ts …`, como o `criar-admin` do painel; **não** acrescente dependência nova sem necessidade.) No `.gitignore`, `.producao-previa.txt`. O `.env.producao.example` (Task 5) ganha `SUPABASE_ACCESS_TOKEN=` com o comentário "token da conta do Supabase (Account › Access Tokens), só para os scripts de produção; nunca no Easypanel".

- [ ] **Step 4: Rode**

Run: `pnpm exec vitest run scripts/producao/migracoes.test.ts`
Expected: PASS. **Não** rode `db:producao:*` (não há `.env.producao`; e nunca contra a nuvem).

- [ ] **Step 5: Commit**

```bash
git add scripts/producao/migracoes.ts scripts/producao/migracoes.test.ts package.json .gitignore .env.producao.example
git commit -m "feat(scripts): migrações e dados iniciais da produção — prévia guardada, cópia antes, confirmação digitada e senha fora da linha de comando (prontidão, D7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Scripts. Cópia semanal cifrada e restauração testada no local (D8; revisão P2-3, P2-10)

**Files:**
- Create: `scripts/producao/cifra.ts`, `scripts/producao/cifra.test.ts`, `scripts/producao/backup.ts`, `scripts/producao/restaurar.ts`, `scripts/producao/conferir-copia.ts`, `scripts/producao/conferir-copia.test.ts`, `scripts/producao/backup-local.test.ts`, `.github/workflows/backup.yml`
- Modify: `package.json` da raiz

**Interfaces:**
- Produces:
  - `cifra.ts`: `export function cifrar(dados: Buffer, chaveB64: string): Buffer` (formato: `"ESCB1"` + iv 12 bytes + tag 16 bytes + dados) e `export function decifrar(arquivo: Buffer, chaveB64: string): Buffer` (lança `'Chave errada ou arquivo alterado.'`).
  - `conferir-copia.ts` (revisão P2-3): `export type Manifesto = { criado_em: string; tabelas: Record<string, number>; auth: Record<string, number>; arquivos: number }`; `export function tabelasDoList(saida: string): string[]` (as tabelas que aparecem como `TABLE DATA <esquema> <tabela>` na saída de `pg_restore --list`); `export function conferirCopia(m: Manifesto, publicList: string[], authList: string[]): string[]` (o que falta; vazio = a cópia está inteira: toda tabela do manifesto com linhas > 0 tem de estar no `--list`, e `auth.users` também).
  - `backup.ts`: `export async function fazerBackup(o: { databaseUrl: string; supabaseUrl: string; chaveServico: string; chave: string; pasta: string; agora: Date }): Promise<string>` (caminho do `.enc`). O `.tar` cifrado tem `public.dump`, `auth.dump`, `manifesto.json` e `arquivos/<compartimento>/<caminho>`.
  - `restaurar.ts`: `export async function restaurar(o: { arquivo: string; chave: string; databaseUrl: string; supabaseUrl: string; chaveServico: string; producao?: boolean; substituir?: boolean }): Promise<{ tabelas: Record<string, number>; arquivos: number }>`.
  - `pg_dump`/`pg_restore` pela imagem `postgres:17`, com `PG*` no ambiente (como a Task 6: nunca a senha na linha de comando); no Windows e no macOS, `host.docker.internal` no lugar de `127.0.0.1`; no Linux, `--network host`.

- [ ] **Step 1: Escreva os testes que falham**

`scripts/producao/cifra.test.ts`:

```ts
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { cifrar, decifrar } from './cifra';

const chave = randomBytes(32).toString('base64');

describe('cifra da cópia (D8, Foco 6)', () => {
  it('ida e volta', () => {
    expect(decifrar(cifrar(Buffer.from('dados pessoais de teste'), chave), chave).toString()).toBe('dados pessoais de teste');
  });
  it('chave errada ou arquivo mexido: recusa', () => {
    const c = cifrar(Buffer.from('x'), chave);
    expect(() => decifrar(c, randomBytes(32).toString('base64'))).toThrow('Chave errada ou arquivo alterado.');
    c[c.length - 1] ^= 1;
    expect(() => decifrar(c, chave)).toThrow('Chave errada ou arquivo alterado.');
  });
  it('chave com tamanho errado: recusa antes de cifrar', () => {
    expect(() => cifrar(Buffer.from('x'), Buffer.from('curta').toString('base64'))).toThrow(/32 bytes/);
  });
});
```

`scripts/producao/conferir-copia.test.ts` (revisão P2-3: a cópia que só tinha os usuários teria sido pega aqui, antes de apagar qualquer coisa):

```ts
import { describe, expect, it } from 'vitest';
import { conferirCopia, tabelasDoList, type Manifesto } from './conferir-copia';

const LIST_PUBLIC = `;
; Archive created at 2026-11-08 04:00:01
3501; 0 17001 TABLE DATA public clientes postgres
3502; 0 17002 TABLE DATA public mensagens postgres
3503; 0 17003 TABLE DATA public setores postgres`;
const LIST_AUTH = `3601; 0 16001 TABLE DATA auth users supabase_auth_admin
3602; 0 16002 TABLE DATA auth identities supabase_auth_admin`;
const M: Manifesto = { criado_em: '2026-11-08T07:00:01Z', tabelas: { clientes: 12, mensagens: 300, setores: 8, alertas: 0 }, auth: { users: 5, identities: 5 }, arquivos: 40 };

describe('conferir a cópia antes de restaurar (revisão P2-3)', () => {
  it('lê as tabelas do pg_restore --list', () => {
    expect(tabelasDoList(LIST_PUBLIC)).toEqual(['public.clientes', 'public.mensagens', 'public.setores']);
  });
  it('inteira: nada falta (tabela vazia no manifesto pode faltar no dump)', () => {
    expect(conferirCopia(M, tabelasDoList(LIST_PUBLIC), tabelasDoList(LIST_AUTH))).toEqual([]);
  });
  it('a cópia só com os usuários (o erro do --schema com --table): falta tudo do public', () => {
    expect(conferirCopia(M, [], tabelasDoList(LIST_AUTH))).toEqual(['public.clientes', 'public.mensagens', 'public.setores']);
  });
  it('sem os usuários do login: falta auth.users', () => {
    expect(conferirCopia(M, tabelasDoList(LIST_PUBLIC), [])).toEqual(['auth.users', 'auth.identities']);
  });
});
```

`scripts/producao/backup-local.test.ts` (só roda com o Supabase local e Docker; `describe.skipIf`):

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { criarClienteServico } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { fazerBackup } from './backup';
import { restaurar } from './restaurar';

const local = (process.env.DATABASE_URL ?? '').includes('127.0.0.1');
const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

describe.skipIf(!local || !process.env.TESTAR_BACKUP)('cópia e restauração no banco local (D8, Foco 6)', () => {
  it('copia, zera, restaura: as mesmas contagens e os mesmos arquivos; recusas antes de mexer no banco', async () => {
    await limparBanco();
    const { data: c } = await db.from('clientes').insert({ razao_social: 'Backup LTDA', cnpj: '11222333000181' }).select('id').single();
    await db.storage.from('documentos').upload(`clientes/${c!.id}/teste.pdf`, new Uint8Array([37, 80, 68, 70]), { contentType: 'application/pdf', upsert: true });
    const chave = randomBytes(32).toString('base64');
    const pasta = mkdtempSync(join(tmpdir(), 'backup-'));
    const o = { databaseUrl: process.env.DATABASE_URL!, supabaseUrl: process.env.SUPABASE_URL!, chaveServico: process.env.SUPABASE_SERVICE_ROLE_KEY! };
    const arquivo = await fazerBackup({ ...o, chave, pasta, agora: new Date() });
    // Banco com dados de clientes: recusa sem --substituir (nada é apagado).
    await expect(restaurar({ ...o, arquivo, chave })).rejects.toThrow(/já tem dados de clientes/);
    expect((await db.from('clientes').select('id')).data).toHaveLength(1);
    await limparBanco();
    await db.storage.from('documentos').remove([`clientes/${c!.id}/teste.pdf`]);
    const r = await restaurar({ ...o, arquivo, chave });
    expect(r.tabelas.clientes).toBe(1);
    expect(r.arquivos).toBeGreaterThanOrEqual(1);
    expect((await db.from('clientes').select('razao_social')).data).toEqual([{ razao_social: 'Backup LTDA' }]);
    expect((await db.storage.from('documentos').download(`clientes/${c!.id}/teste.pdf`)).data).not.toBeNull();
    await expect(restaurar({ ...o, arquivo, chave: randomBytes(32).toString('base64'), substituir: true })).rejects.toThrow('Chave errada');
    await expect(restaurar({ ...o, databaseUrl: 'postgresql://u:x@db.prodprodprodprod.supabase.co:5432/postgres', arquivo, chave })).rejects.toThrow(/produção/);
  }, 300_000);
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm exec vitest run scripts/producao/cifra.test.ts scripts/producao/conferir-copia.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implemente**

`scripts/producao/cifra.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Plano de prontidão (D8): a cópia tem dados pessoais; fora do Supabase, só cifrada (AES-256-GCM).
const MAGICO = Buffer.from('ESCB1');

function chaveDe(b64: string): Buffer {
  const k = Buffer.from(b64, 'base64');
  if (k.length !== 32) throw new Error('BACKUP_CHAVE precisa ter 32 bytes em base64.');
  return k;
}

export function cifrar(dados: Buffer, chaveB64: string): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', chaveDe(chaveB64), iv);
  const corpo = Buffer.concat([c.update(dados), c.final()]);
  return Buffer.concat([MAGICO, iv, c.getAuthTag(), corpo]);
}

export function decifrar(arquivo: Buffer, chaveB64: string): Buffer {
  const k = chaveDe(chaveB64);
  try {
    if (!arquivo.subarray(0, 5).equals(MAGICO)) throw new Error('formato');
    const d = createDecipheriv('aes-256-gcm', k, arquivo.subarray(5, 17));
    d.setAuthTag(arquivo.subarray(17, 33));
    return Buffer.concat([d.update(arquivo.subarray(33)), d.final()]);
  } catch {
    throw new Error('Chave errada ou arquivo alterado.');
  }
}
```

`scripts/producao/conferir-copia.ts`:

```ts
// Revisão P2-3: antes de mexer no banco, a cópia tem de ter tudo o que o manifesto diz que tinha linhas.
export type Manifesto = { criado_em: string; tabelas: Record<string, number>; auth: Record<string, number>; arquivos: number };

export function tabelasDoList(saida: string): string[] {
  return [...saida.matchAll(/TABLE DATA (\w+) (\w+)/g)].map((m) => `${m[1]}.${m[2]}`);
}

export function conferirCopia(m: Manifesto, publicList: string[], authList: string[]): string[] {
  const falta: string[] = [];
  for (const [t, n] of Object.entries(m.tabelas)) if (n > 0 && !publicList.includes(`public.${t}`)) falta.push(`public.${t}`);
  for (const [t, n] of Object.entries(m.auth)) if (n > 0 && !authList.includes(`auth.${t}`)) falta.push(`auth.${t}`);
  return falta;
}
```

`scripts/producao/backup.ts` (nesta ordem):
1. Arquivos: `const compartimentos = (await db.storage.listBuckets()).data!.map((b) => b.id)`; para cada um, liste recursivamente (`list(prefixo, { limit: 1000, offset })`, entrando nas "pastas" — itens com `id === null`) e baixe cada arquivo para `<tmp>/arquivos/<b>/<caminho>`.
2. **Dois** `pg_dump` (revisão P2-3: `--schema` e `--table` juntos fazem o `pg_dump` ignorar o `--schema`):

```ts
const { host, porta, usuario, senha, banco } = partesDaUrl(databaseUrl);   // de ./migracoes
const hostDocker = host === '127.0.0.1' && process.platform !== 'linux' ? 'host.docker.internal' : host;
const env = { ...process.env, PGHOST: hostDocker, PGPORT: porta, PGUSER: usuario, PGPASSWORD: senha, PGDATABASE: banco };
const docker = (args: string[]) => spawnSync('docker', ['run', '--rm', ...(process.platform === 'linux' ? ['--network', 'host'] : []),
  '-e', 'PGHOST', '-e', 'PGPORT', '-e', 'PGUSER', '-e', 'PGPASSWORD', '-e', 'PGDATABASE', '-v', `${tmp}:/saida`, 'postgres:17', ...args],
  { env, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
for (const [arq, alvo] of [['public.dump', ['-n', 'public']], ['auth.dump', ['-t', 'auth.users', '-t', 'auth.identities']]] as const) {
  if (docker(['pg_dump', '-Fc', '--data-only', ...alvo, '-f', `/saida/${arq}`]).status !== 0) throw new Error(`pg_dump falhou (${arq})`);
}
```

3. `manifesto.json`: `tabelas` = contagem de cada tabela base de `public` (`information_schema.tables`, `table_type = 'BASE TABLE'`), `auth` = `{ users, identities }`, `arquivos` = total baixado (consultas pela `DATABASE_URL` com `pg`).
4. **Confira a cópia antes de cifrar:** `pg_restore --list` dos dois dumps (pela mesma imagem) e `conferirCopia(manifesto, …)`; faltou algo → lance `'Cópia incompleta: <lista>'` (não grava `.enc` incompleto).
5. Junte `public.dump`, `auth.dump`, `manifesto.json` e `arquivos/` num `.tar` (`tar -cf`; existe no Windows 10 e no Linux), `cifrar`, grave `<pasta>/escritorio-<AAAA-MM-DD>.enc`, apague o temporário, devolva o caminho.
6. `principal()`: lê `--env-file` (padrão `.env.producao`) **ou** o ambiente do processo (no GitHub Actions); exige `BACKUP_CHAVE` e `BACKUP_PASTA`; chama `fazerBackup`; imprime caminho e tamanho. Com `--apagar-antigas`, apaga da pasta as cópias com mais de 8 semanas (D8, a confirmar).

`scripts/producao/restaurar.ts` (nesta ordem; **nada** é apagado antes do passo 5):
1. Recusa: URL que não é local sem `producao: true` → `'Restaurar fora do banco local é para a produção, e só com --sou-o-dono-e-quero-a-producao.'`.
2. `decifrar` (lança antes de escrever qualquer coisa), `tar -xf` num temporário, lê `manifesto.json`.
3. `pg_restore --list` dos dois dumps e `conferirCopia`; faltou algo → lança `'Cópia incompleta: …'`.
4. **Banco com dados de clientes** (`select count(*) from clientes` ou `mensagens` > 0) e sem `substituir` → lança `'O banco já tem dados de clientes. Restaure num projeto novo, ou use --substituir.'`.
5. Só agora: esvazia as tabelas de `public` que estão no manifesto com linhas (`truncate … cascade`) e `auth.users`/`auth.identities` (`delete`); `pg_restore --data-only --disable-triggers --single-transaction` de `auth.dump` e depois de `public.dump`.
6. Sobe os arquivos de `arquivos/<b>/…` com `upsert: true`.
7. Devolve as contagens do banco restaurado e o número de arquivos enviados.

`.github/workflows/backup.yml` (revisão P2-10; **proposta**, a confirmar com o dono — o arquivo entra no repositório, mas só roda depois que ele cadastrar os segredos no ambiente `producao`):

```yaml
name: Cópia semanal
on:
  schedule: [{ cron: '0 7 * * 0' }]   # domingo 04:00 de Brasília
  workflow_dispatch:
jobs:
  copia:
    runs-on: ubuntu-latest
    environment: producao
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm backup:semanal
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          BACKUP_CHAVE: ${{ secrets.BACKUP_CHAVE }}
          BACKUP_PASTA: ./copia
      # O .enc é cifrado; guardado 60 dias. Falha = e-mail do GitHub ao dono.
      - uses: actions/upload-artifact@v4
        with: { name: copia-semanal, path: ./copia/*.enc, retention-days: 60 }
```

(Confira em `.github/workflows/ci.yml` como o pnpm é instalado ali e use o mesmo. O GitHub **desliga agendamentos** de repositório sem atividade há 60 dias: está no manual da Task 8.)

No `package.json` da raiz: `"backup:semanal": "tsx scripts/producao/backup.ts"`, `"backup:restaurar": "tsx scripts/producao/restaurar.ts"` (mesma observação do `tsx` da Task 6).

- [ ] **Step 4: Rode** (Supabase local com a vez reservada; Docker; memória ≥ 4 GB)

```bash
pnpm exec vitest run scripts/producao/cifra.test.ts scripts/producao/conferir-copia.test.ts
TESTAR_BACKUP=1 pnpm exec vitest run scripts/producao/backup-local.test.ts
```

Expected: PASS nos três. O `--disable-triggers` precisa de superusuário: no local o usuário `postgres` é; **anote** no relatório que na nuvem do Supabase a restauração completa é pelo painel do Supabase (D8) e que este script serve para um projeto novo com a senha do `postgres`. **Não** rode o workflow (`workflow_dispatch`): ele só vale com os segredos da produção.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`; libere a vez)

```bash
git add scripts/producao/cifra.ts scripts/producao/cifra.test.ts scripts/producao/conferir-copia.ts scripts/producao/conferir-copia.test.ts scripts/producao/backup.ts scripts/producao/restaurar.ts scripts/producao/backup-local.test.ts .github/workflows/backup.yml package.json
git commit -m "feat(scripts): cópia semanal cifrada em dois dumps, conferida antes de restaurar, e o agendamento proposto no GitHub (prontidão, D8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Manual. `docs/producao.md` (Prompt 2, itens 7 e 8; D2, D4, D7, D8, D9, D22, D23; revisão P2-2, P2-4, P2-5, P2-10, P2-11, P2-17, P2-18)

**Files:**
- Create: `docs/producao.md`
- Modify: `docs/operacao.md` (§2.6 aponta para `producao.md`)

- [ ] **Step 1: `docs/producao.md`**, com estas seções (texto para o dono, frases curtas, sem jargão):
  1. **Antes de subir: as decisões (D23)** — (a) a produção começa **vazia** ou é uma **cópia da homologação** (se cópia: `pnpm backup:semanal` na homologação → `pnpm backup:restaurar --sou-o-dono-e-quero-a-producao` no projeto novo, **antes** de qualquer pessoa usar); (b) o **número do escritório**: hoje ligado à Z-API da homologação? **Desconecte-o da homologação antes de conectá-lo à produção** (dois sistemas no mesmo número respondem o mesmo cliente duas vezes); a homologação passa a usar um número de teste.
  2. **Checklist de subida** — cada item com `- [ ]`, nesta ordem: Supabase de produção no plano Pro, região São Paulo, backups diários ligados (Database › Backups) e PITR se o dono decidir pagar (D8); a **ordem das versões** (Parte I inteira, depois confiabilidade, prontidão e CNPJ — seção "Integração e versão" do plano) e a tag; instância da Z-API de produção (D23b); **recarga automática** da Anthropic ligada e **chave só da produção** com limite de gasto (D5); no Easypanel: as variáveis do `.env.producao.example`, **`AMBIENTE=producao`** (obrigatório: sem ele o trabalhador não sobe, D2), `SAUDE_TOKEN`, `CONCORRENCIA_AGENTE`; `pnpm db:producao:previa` e **conferir a lista** (as da Parte I antes das `20261101…`); cópia agora e `pnpm db:producao:aplicar` (migrações, setores novos, orientações iniciais, D7); **primeiro administrador** (`operacao.md` §2.7); **marcar o dono** (revisão P2-4) — no SQL Editor da produção:

     ```sql
     update public.usuarios set dono = false where dono;
     update public.usuarios set dono = true where email = '<e-mail do dono>';
     ```

     e conferir na tela **Agentes** que os botões do dono aparecem (sem isso ninguém mexe em agentes, skills, ferramentas, fontes e guardas); Configurações (setores, expediente, teto, telefone e e-mail de alertas, mensagens automáticas — inclusive "IA indisponível" e "Fora do horário"); os **dois** monitores externos (item 4); a cópia semanal (item 5); teste final com o número de teste antes de conectar o número do escritório.
  3. **Homologação sem mandar mensagem a cliente (D2, revisão P2-17)** — `AMBIENTE=homologacao` e `TELEFONES_PERMITIDOS` com: o seu número, os números de teste, **o celular de cada pessoa da equipe que usa o Assistente pelo WhatsApp** e o WhatsApp do dono (alertas); quem não estiver na lista não recebe nada, e no Atendimento a mensagem aparece como **"Não enviada: ambiente de teste"** (registro `envio_bloqueado`); **para o trabalhador de teste da porta 3001**, ponha `AMBIENTE` e a lista no arquivo de variáveis da homologação **antes** de trocar para esta versão (sem `AMBIENTE` ele não sobe).
  4. **Monitores externos (D9, revisão P2-11)** — Better Stack (grátis, 3 min) ou UptimeRobot (grátis, 5 min): **dois** monitores — `https://<trabalhador>/saude` (sem token) e `https://<painel>/entrar` — alerta quando o código não for 200, por e-mail **e** Telegram (passo a passo de ligar o Telegram no serviço escolhido); com o token, o dono abre `https://<trabalhador>/saude?token=…` no navegador para ver o que falhou e o `ambiente`; nunca cole o token em lugar público.
  5. **Cópia de segurança (D8, revisão P2-10, P2-18)** — o que o Supabase faz sozinho; a semanal: **proposta** no GitHub (Actions › "Cópia semanal"; os segredos `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_CHAVE` no ambiente `producao`; o arquivo fica 60 dias em "Artifacts"; falha = e-mail do GitHub; **o GitHub desliga agendamentos de repositório parado há 60 dias** — rode "Run workflow" à mão se o repositório ficar parado); alternativa no computador do dono (`pnpm backup:semanal --env-file=.env.producao` no Agendador de Tarefas). A `BACKUP_CHAVE` fica **só** no gerenciador de senhas e no segredo do GitHub — nunca no `.env.producao` do computador. **LGPD:** anonimizar um contato não alcança as cópias já feitas; elas somem no prazo de guarda das cópias (60 dias no GitHub; 8 semanas no computador, a confirmar) — diga isso ao titular e registre na política do escritório.
  6. **O que fazer quando:**
     - **o WhatsApp desconecta** (o alerta "O WhatsApp do escritório está desconectado…" e o monitor com `whatsapp`): ler o QR code de novo (texto de `operacao.md`), conferir em 1 minuto o `/saude`;
     - **os créditos acabam** (alerta "O saldo da IA (Anthropic) acabou…", plano de confiabilidade): recarregar, ligar a recarga automática; as conversas que foram para a equipe continuam com a equipe;
     - **o trabalhador cai** (monitor sem resposta): Easypanel › app trabalhador › Logs; Restart; se não voltar, "Redeploy" da última versão boa. **Mensagens que chegarem com ele fora podem se perder (D22):** depois de voltar, olhe o celular do escritório e responda pelo painel o que tiver chegado no intervalo; confira no painel da Z-API se ela reenvia webhook que falhou;
     - **é preciso restaurar** — primeiro o Supabase (Database › Backups › Restore, ou PITR para um horário); só se não der, `pnpm backup:restaurar` num **projeto novo** (passo a passo, `--sou-o-dono-e-quero-a-producao`; ele confere a cópia antes e recusa banco com dados de clientes), depois trocar as variáveis do Easypanel para o projeto novo;
     - **é preciso pausar tudo** — Início › **Pausar agente** (as mensagens continuam chegando e vão para a equipe). **Não use "Stop" no Easypanel para pausar** (revisão P2-2): com o trabalhador parado, as mensagens dos clientes não entram no sistema;
     - **publicar uma versão nova** — fora do horário de pico (um deploy reinicia o trabalhador; D22);
     - **o segredo do webhook vazou (D4)** — gerar um novo; trocar primeiro no Easypanel (`WEBHOOK_SEGREDO`) e reiniciar o trabalhador; logo em seguida trocar o endereço no campo "Ao receber" da Z-API; mensagens que chegarem no meio são recusadas (401).
- [ ] **Step 2: `docs/operacao.md` §2.6** — troque o texto do UptimeRobot por um parágrafo curto que manda para `docs/producao.md` › Monitores externos.
- [ ] **Step 3: Commit**

```bash
git add docs/producao.md docs/operacao.md
git commit -m "docs: produção — decisões de dados e número, checklist com o dono, homologação sem mensagem a cliente, dois monitores, cópias e o que fazer quando algo cai (prontidão)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Banco. Preço conferido, correção de pedido atômica e pergunta sem duplicar (D10, D13, D15)

**Files:**
- Create: `supabase/migrations/20261101000300_integridade_preco_pedido.sql`, `supabase/tests/82_integridade_preco_pedido.test.sql`, `packages/db/test/integridade.test.ts`
- Modify: `packages/db/src/repos.ts`, `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Produces (SQL):
  - `public.definir_preco_conferido(p_grupo uuid, p_produto uuid, p_valor numeric, p_vigente_esperado uuid) returns uuid` (`authenticated`; as mesmas conferências de `definir_preco` + a vigente esperada; erro `PR409`);
  - `public.definir_preco_agente_conferido(p_grupo uuid, p_produto uuid, p_valor numeric, p_contato uuid, p_vigente_esperado uuid) returns uuid` (só `service_role`);
  - `public.aplicar_correcao_pedido(p_chamado uuid, p_antes jsonb, p_pedido jsonb, p_resumo text, p_titulo text, p_usuario uuid, p_nota text, p_detalhes jsonb) returns void` (só `service_role`; erros: `PR409` pedido mudou, `P0001` 'Esta demanda já foi concluída; o pedido não pode mudar.');
  - coluna `public.assistente_mensagens.mensagem_origem_id uuid references public.mensagens (id) on delete set null` + índice único parcial.
- Produces (repos):
  - `export const CONFLITO_VERSAO = 'PR409';`
  - `export class ConflitoVersao extends Error {}`
  - `definirPrecoConferidoPeloAgente(grupoId, produtoId, valor, contatoId, vigenteEsperado: string | null): Promise<void>` (lança `ConflitoVersao`);
  - `precoVigenteId(grupoId, produtoId): Promise<string | null>`;
  - `aplicarCorrecaoPedido(p: { chamadoId: string; antes: PedidoVendaSalvo; pedido: PedidoVendaSalvo; resumo: string; titulo: string | null; usuarioId: string; nota: string; detalhes: object }): Promise<void>` (lança `ConflitoVersao` ou `Error`);
  - `registrarPerguntaWhatsapp(m: { usuarioId: string; conteudo: string; mensagemOrigemId: string }): Promise<boolean>` (`false` = já existia).

- [ ] **Step 1: Escreva o teste que falha** — `supabase/tests/82_integridade_preco_pedido.test.sql`:

```sql
-- Plano de prontidão, Task 9 (D10, D13, D15).
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values ('f9000000-0000-0000-0000-00000000000a', 'precos@int.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f9000000-0000-0000-0000-00000000000a', 'Int Preços', 'precos@int.local', 'admin', '{editar_precos}');
insert into public.clientes (id, razao_social, cnpj) values ('f9100000-0000-0000-0000-00000000000a', 'Int Indústria', '11222333000181');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values ('f9200000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-00000000000a', 'cliente', 'Rede A');
insert into public.produtos (id, cliente_id, codigo, descricao, unidade) values ('f9300000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-00000000000a', 'P1', 'Pão', 'UN');
insert into public.contatos (id, nome, telefone) values ('f9400000-0000-0000-0000-00000000000a', 'Int Contato', '5531980000071');
insert into public.contato_clientes (contato_id, cliente_id, pode_atualizar_preco) values ('f9400000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-00000000000a', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f9000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1–6: preço conferido no painel (D10)
select isnt(public.definir_preco_conferido('f9200000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-00000000000a', 10, null), null, 'primeiro preço: esperado null');
select throws_ok($$ select public.definir_preco_conferido('f9200000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-00000000000a', 11, null) $$,
  'PR409', 'Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.', 'segunda aba com "não havia preço": conflito');
select lives_ok(format($$ select public.definir_preco_conferido('f9200000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-00000000000a', 12, %L) $$,
  (select id from public.precos where vigente_ate is null)), 'com a vigente certa: grava');
select throws_ok(format($$ select public.definir_preco_conferido('f9200000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-00000000000a', 13, %L) $$,
  (select id from public.precos where valor = 10)), 'PR409', null, 'com a vigente antiga: conflito');
select is((select valor from public.precos where vigente_ate is null), 12.00::numeric(12,2), 'vale o 12; o 13 não sobrescreveu');
select is((select count(*)::int from public.precos), 2, 'histórico: 2 linhas');
reset role;

-- 7–9: o agente (D10, D12)
select throws_ok(format($$ select public.definir_preco_agente_conferido('f9200000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-00000000000a', 14, 'f9400000-0000-0000-0000-00000000000a', %L) $$,
  (select id from public.precos where valor = 10)), 'PR409', null, 'agente com a vigente antiga: conflito');
select lives_ok(format($$ select public.definir_preco_agente_conferido('f9200000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-00000000000a', 14, 'f9400000-0000-0000-0000-00000000000a', %L) $$,
  (select id from public.precos where vigente_ate is null)), 'agente com a vigente certa: grava');
set local role authenticated;
select throws_ok($$ select public.definir_preco_agente_conferido('f9200000-0000-0000-0000-00000000000a', 'f9300000-0000-0000-0000-00000000000a', 15, 'f9400000-0000-0000-0000-00000000000a', null) $$,
  '42501', null, 'pessoa não chama a função do agente');
reset role;

-- 10–15: correção atômica do pedido (D13)
insert into public.chamados (id, cliente_id, titulo, pedido_venda) values
  ('f9500000-0000-0000-0000-00000000000a', 'f9100000-0000-0000-0000-00000000000a', 'NF de venda', '{"itens":[{"sku":"P1","quantidade":1}]}');
select throws_ok($$ select public.aplicar_correcao_pedido('f9500000-0000-0000-0000-00000000000a', '{"itens":[]}', '{"itens":[{"sku":"P1","quantidade":2}]}',
  'novo resumo', null, 'f9000000-0000-0000-0000-00000000000a', 'nota', '{}') $$, 'PR409', null, 'pedido mudou desde a prévia: conflito');
select throws_ok($$ select public.aplicar_correcao_pedido('f9500000-0000-0000-0000-00000000000a', '{"itens":[{"sku":"P1","quantidade":1}]}', '{"itens":[{"sku":"P1","quantidade":2}]}',
  'novo resumo', null, 'f9000000-0000-0000-0000-0000000000ff', 'nota', '{}') $$, '23503', null, 'nota com usuário inexistente falha…');
select is((select pedido_venda from public.chamados where id = 'f9500000-0000-0000-0000-00000000000a'), '{"itens":[{"sku":"P1","quantidade":1}]}'::jsonb, '…e o pedido ficou como estava (tudo ou nada)');
select lives_ok($$ select public.aplicar_correcao_pedido('f9500000-0000-0000-0000-00000000000a', '{"itens":[{"sku":"P1","quantidade":1}]}', '{"itens":[{"sku":"P1","quantidade":2}]}',
  'novo resumo', 'NF de venda - Rede A', 'f9000000-0000-0000-0000-00000000000a', 'Pedido alterado pelo assistente a pedido de Int Preços.', '{"canal":"site"}') $$, 'grava');
select is((select count(*)::int from public.chamado_eventos where chamado_id = 'f9500000-0000-0000-0000-00000000000a' and tipo = 'nota_interna'), 1, 'nota interna gravada junto');
select is((select count(*)::int from public.auditoria_acessos where entidade = 'pedido_venda' and entidade_id = 'f9500000-0000-0000-0000-00000000000a'), 1, 'auditoria gravada junto');

-- 16–17: pergunta sem duplicar (D15)
insert into public.conversas (id, telefone) values ('f9600000-0000-0000-0000-00000000000a', '5531980000072');
insert into public.mensagens (id, conversa_id, direcao, autor, conteudo) values ('f9700000-0000-0000-0000-00000000000a', 'f9600000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'quanto vendi?');
insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo, mensagem_origem_id) values
  ('f9000000-0000-0000-0000-00000000000a', 'whatsapp', 'usuario', 'quanto vendi?', 'f9700000-0000-0000-0000-00000000000a');
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo, mensagem_origem_id) values
  ('f9000000-0000-0000-0000-00000000000a', 'whatsapp', 'usuario', 'quanto vendi?', 'f9700000-0000-0000-0000-00000000000a') $$, '23505', null, 'a mesma mensagem de origem não vira duas perguntas');
select lives_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo) values
  ('f9000000-0000-0000-0000-00000000000a', 'site', 'usuario', 'outra'), ('f9000000-0000-0000-0000-00000000000a', 'site', 'usuario', 'outra') $$, 'sem origem (painel): nada muda');

select * from finish();
rollback;
```

(Confira as colunas obrigatórias de `parceiros_grupos`, `produtos` e `chamados` na migração `20260928000500_cadastros_comerciais.sql` e nas seguintes; acrescente as que faltarem no `insert`, sem mudar o que cada teste confere. Se a coluna de permissão de preço do contato tiver mudado na Parte H2 — `contato_cliente_*` —, use a que `definir_preco_agente` confere hoje: `grep -n "pode_atualizar_preco" supabase/migrations/*.sql`.)

`packages/db/test/integridade.test.ts` (o repositório traduz o `PR409`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { ConflitoVersao, criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

beforeEach(async () => { await limparBanco(); });

describe('integridade (D10, D15)', () => {
  it('preço do agente com a vigente errada lança ConflitoVersao; com a certa, grava', async () => {
    const { data: cl } = await db.from('clientes').insert({ razao_social: 'Int', cnpj: '11222333000181' }).select('id').single();
    const { data: g } = await db.from('parceiros_grupos').insert({ cliente_id: cl!.id, tipo: 'cliente', nome: 'Rede' }).select('id').single();
    const { data: p } = await db.from('produtos').insert({ cliente_id: cl!.id, codigo: 'P1', descricao: 'Pão', unidade: 'UN' }).select('id').single();
    const { data: c } = await db.from('contatos').insert({ nome: 'C', telefone: '5531980000081' }).select('id').single();
    await db.from('contato_clientes').insert({ contato_id: c!.id, cliente_id: cl!.id, pode_atualizar_preco: true });
    await repos.definirPrecoConferidoPeloAgente(g!.id, p!.id, 10, c!.id, null);
    await expect(repos.definirPrecoConferidoPeloAgente(g!.id, p!.id, 11, c!.id, null)).rejects.toBeInstanceOf(ConflitoVersao);
    const vigente = await repos.precoVigenteId(g!.id, p!.id);
    await repos.definirPrecoConferidoPeloAgente(g!.id, p!.id, 11, c!.id, vigente);
    expect(await repos.precoVigenteId(g!.id, p!.id)).not.toBe(vigente);
  });

  it('pergunta pelo WhatsApp: a mesma origem grava uma vez', async () => {
    const u = (await db.from('usuarios').select('id').limit(1).maybeSingle()).data;
    if (!u) return;   // sem usuário semeado no banco de teste: o pgTAP 82 cobre
    const conv = await repos.obterOuCriarConversa('5531980000082', null);
    const { id } = await repos.inserirMensagemEntrada({ conversaId: conv.id, clienteId: null, idProvedor: 'W1', tipo: 'texto', conteudo: 'oi' });
    expect(await repos.registrarPerguntaWhatsapp({ usuarioId: u.id, conteudo: 'oi', mensagemOrigemId: id })).toBe(true);
    expect(await repos.registrarPerguntaWhatsapp({ usuarioId: u.id, conteudo: 'oi', mensagemOrigemId: id })).toBe(false);
  });
});
```

(Para o segundo caso, crie o usuário com o ajudante de `packages/db/test/usuario.ts` em vez do `if (!u) return` se ele existir para isso.)

- [ ] **Step 2: Rode e veja falhar** (Supabase local com a vez reservada)

Run: `supabase test db` (→ `82` FAIL) e `pnpm --filter @escritorio/db exec vitest run test/integridade.test.ts` (→ FAIL).

- [ ] **Step 3: Implemente** — `supabase/migrations/20261101000300_integridade_preco_pedido.sql`:

```sql
-- supabase/migrations/20261101000300_integridade_preco_pedido.sql
-- Plano de prontidão, Prompt 3 (D10, D13, D15). Só acréscimos: as funções antigas de preço ficam como estão.

-- D10: a linha vigente é a versão. p_vigente_esperado null = "não havia preço". Conflito: PR409.
create function public.definir_preco_conferido(p_grupo uuid, p_produto uuid, p_valor numeric, p_vigente_esperado uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_atual uuid;
begin
  if not tem_permissao('editar_precos') then raise exception 'sem permissão para editar preços'; end if;
  -- Trava a vigente: duas gravações ao mesmo tempo, a segunda espera e vê o conflito.
  select id into v_atual from precos where grupo_id = p_grupo and produto_id = p_produto and vigente_ate is null for update;
  if v_atual is distinct from p_vigente_esperado then
    raise exception 'Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.' using errcode = 'PR409';
  end if;
  begin
    return definir_preco(p_grupo, p_produto, p_valor);
  exception when unique_violation then
    -- Sem vigente, duas primeiras gravações ao mesmo tempo: a segunda bate no índice único.
    raise exception 'Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.' using errcode = 'PR409';
  end;
end $$;
revoke execute on function public.definir_preco_conferido(uuid, uuid, numeric, uuid) from public, anon;
grant execute on function public.definir_preco_conferido(uuid, uuid, numeric, uuid) to authenticated;

create function public.definir_preco_agente_conferido(p_grupo uuid, p_produto uuid, p_valor numeric, p_contato uuid, p_vigente_esperado uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_atual uuid;
begin
  select id into v_atual from precos where grupo_id = p_grupo and produto_id = p_produto and vigente_ate is null for update;
  if v_atual is distinct from p_vigente_esperado then
    raise exception 'Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.' using errcode = 'PR409';
  end if;
  begin
    return definir_preco_agente(p_grupo, p_produto, p_valor, p_contato);
  exception when unique_violation then
    raise exception 'Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.' using errcode = 'PR409';
  end;
end $$;
revoke execute on function public.definir_preco_agente_conferido(uuid, uuid, numeric, uuid, uuid) from public, anon, authenticated;
grant execute on function public.definir_preco_agente_conferido(uuid, uuid, numeric, uuid, uuid) to service_role;

-- D13: a correção do pedido pelo assistente, tudo ou nada.
create function public.aplicar_correcao_pedido(p_chamado uuid, p_antes jsonb, p_pedido jsonb, p_resumo text, p_titulo text,
  p_usuario uuid, p_nota text, p_detalhes jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare c record;
begin
  select id, cliente_id, status, pedido_venda into c from chamados where id = p_chamado for update;
  if not found then raise exception 'Demanda não encontrada.'; end if;
  if c.status = 'concluido' then raise exception 'Esta demanda já foi concluída; o pedido não pode mudar.'; end if;
  if c.pedido_venda is distinct from p_antes then
    raise exception 'O pedido mudou desde a prévia.' using errcode = 'PR409';
  end if;
  update chamados set pedido_venda = p_pedido, resumo = p_resumo, titulo = coalesce(p_titulo, titulo), atualizado_em = now() where id = p_chamado;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto) values (p_chamado, c.cliente_id, 'nota_interna', p_usuario, p_nota);
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (p_usuario, 'assistente', 'pedido_venda', p_chamado::text, coalesce(p_detalhes, '{}'::jsonb) || jsonb_build_object('antes', p_antes, 'depois', p_pedido));
end $$;
revoke execute on function public.aplicar_correcao_pedido(uuid, jsonb, jsonb, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_correcao_pedido(uuid, jsonb, jsonb, text, text, uuid, text, jsonb) to service_role;

-- D15: a pergunta que veio de uma mensagem do WhatsApp entra uma vez só.
alter table public.assistente_mensagens add column mensagem_origem_id uuid references public.mensagens (id) on delete set null;
create unique index assistente_mensagens_origem_unica on public.assistente_mensagens (mensagem_origem_id) where mensagem_origem_id is not null;
```

**Atenção ao gatilho de auditoria de `chamados`** (se houver): ele também grava; o pgTAP 15 conta só `entidade = 'pedido_venda'`. Se `auditoria_acessos.usuario_id` tiver FK para `usuarios`, o teste 11 (usuário inexistente) falha já ali — o importante é que **falhe** e que o pedido fique intacto (teste 12).

Em `packages/db/src/repos.ts`:

```ts
/** Plano de prontidão (D10, D13): o banco recusou porque o dado mudou desde que a pessoa (ou o agente) viu. */
export const CONFLITO_VERSAO = 'PR409';
export class ConflitoVersao extends Error {}
const conflito = (e: { code?: string; message: string }) => (e.code === CONFLITO_VERSAO ? new ConflitoVersao(e.message) : new Error(e.message));
```

e no objeto:

```ts
    async precoVigenteId(grupoId: string, produtoId: string): Promise<string | null> {
      const l = checar(await db.from('precos').select('id').eq('grupo_id', grupoId).eq('produto_id', produtoId).is('vigente_ate', null).maybeSingle(), 'precoVigenteId');
      return l?.id ?? null;
    },

    /** D10/D12: grava só se a vigente ainda é `vigenteEsperado` (null = não havia preço). */
    async definirPrecoConferidoPeloAgente(grupoId: string, produtoId: string, valor: number, contatoId: string, vigenteEsperado: string | null): Promise<void> {
      const r = await db.rpc('definir_preco_agente_conferido', { p_grupo: grupoId, p_produto: produtoId, p_valor: valor, p_contato: contatoId,
        p_vigente_esperado: vigenteEsperado as string });
      if (r.error) throw conflito(r.error);
    },

    /** D13: pedido, nota interna e auditoria numa transação só. */
    async aplicarCorrecaoPedido(p: { chamadoId: string; antes: PedidoVendaSalvo; pedido: PedidoVendaSalvo; resumo: string; titulo: string | null;
      usuarioId: string; nota: string; detalhes: object }): Promise<void> {
      const r = await db.rpc('aplicar_correcao_pedido', { p_chamado: p.chamadoId, p_antes: p.antes as never, p_pedido: p.pedido as never,
        p_resumo: p.resumo, p_titulo: p.titulo as string, p_usuario: p.usuarioId, p_nota: p.nota, p_detalhes: p.detalhes as never });
      if (r.error) throw conflito(r.error);
    },

    /** D15: a pergunta do WhatsApp pela mensagem de origem; false = já estava gravada (nova tentativa do job). */
    async registrarPerguntaWhatsapp(m: { usuarioId: string; conteudo: string; mensagemOrigemId: string }): Promise<boolean> {
      const r = await db.from('assistente_mensagens').upsert({ usuario_id: m.usuarioId, canal: 'whatsapp', conversa_id: null, papel: 'usuario',
        conteudo: m.conteudo, mensagem_origem_id: m.mensagemOrigemId }, { onConflict: 'mensagem_origem_id', ignoreDuplicates: true }).select('id');
      return checar(r, 'registrarPerguntaWhatsapp').length > 0;
    },
```

(O `upsert` com `onConflict` precisa de um índice único **não parcial** no PostgREST. Se o PostgREST recusar o índice parcial, troque o índice por `unique (mensagem_origem_id)` sem `where` — `null` não conflita com `null` no Postgres — e ajuste a migração antes do commit.)

Exporte `ConflitoVersao` e `CONFLITO_VERSAO` em `packages/db/src/index.ts` se ele não reexportar tudo de `repos.ts`. `pnpm db:tipos`.

- [ ] **Step 4: Rode**

Run: `supabase db reset && supabase test db && pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck`
Expected: tudo passa; `82` 17/17; os pgTAP de preço antigos sem mudança.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`)

```bash
git add supabase/migrations/20261101000300_integridade_preco_pedido.sql supabase/tests/82_integridade_preco_pedido.test.sql packages/db/src/repos.ts packages/db/src/index.ts packages/db/src/tipos.gen.ts packages/db/test/integridade.test.ts
git commit -m "feat(banco): preço conferido pela linha vigente, correção de pedido numa transação e pergunta do WhatsApp sem duplicar (integridade, D10, D13, D15)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Painel. Preço com aviso de conflito, sem perder o que foi digitado (D10, D11)

**Files:**
- Create: `apps/painel/src/lib/precos-conflito.ts`, `apps/painel/src/lib/precos-conflito.test.ts`, `apps/painel/e2e/preco-conflito.spec.ts`
- Modify: `apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts` (`definirPreco`), `apps/painel/src/app/(painel)/clientes/[id]/secao-precos.tsx`, `apps/painel/src/app/(painel)/clientes/[id]/page.tsx` (passa `tentado`)

**Interfaces:**
- Consumes: RPC `definir_preco_conferido` (Task 9).
- Produces:
  - `export const AVISO_CONFLITO_PRECO = 'Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.'`
  - `export function codificarTentado(grupo: string, produto: string, valor: string): string` → `"<grupo>:<produto>:<valor>"`
  - `export function lerTentado(bruto: string | undefined): { grupo: string; produto: string; valor: string } | null`

- [ ] **Step 1: Escreva o teste que falha** — `apps/painel/src/lib/precos-conflito.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { codificarTentado, lerTentado } from './precos-conflito';

const G = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';

describe('valor tentado no conflito (D11)', () => {
  it('ida e volta', () => {
    expect(lerTentado(codificarTentado(G, P, '12,50'))).toEqual({ grupo: G, produto: P, valor: '12,50' });
  });
  it('lixo na URL: null', () => {
    expect(lerTentado(undefined)).toBeNull();
    expect(lerTentado('x:y:1')).toBeNull();
    expect(lerTentado(`${G}:${P}:<script>`)).toBeNull();
    expect(lerTentado(`${G}:${P}:${'9'.repeat(30)}`)).toBeNull();
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/precos-conflito.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implemente**

`apps/painel/src/lib/precos-conflito.ts`:

```ts
/** Plano de prontidão (D11): o aviso do conflito e o valor que a pessoa tinha digitado, de volta na URL. */
export const AVISO_CONFLITO_PRECO = 'Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const codificarTentado = (grupo: string, produto: string, valor: string): string => `${grupo}:${produto}:${valor}`;

export function lerTentado(bruto: string | undefined): { grupo: string; produto: string; valor: string } | null {
  const [grupo, produto, valor] = (bruto ?? '').split(':');
  if (!grupo || !produto || valor === undefined || !UUID.test(grupo) || !UUID.test(produto)) return null;
  // Só o que um campo de preço aceita (dígitos, vírgula, ponto), e curto.
  return /^[\d.,]{1,15}$/.test(valor) ? { grupo, produto, valor } : null;
}
```

Em `cadastros-acoes.ts`, `definirPreco` passa a ser:

```ts
export async function definirPreco(clienteId: string, grupoId: string, produtoId: string, formData: FormData) {
  const digitado = String(formData.get('valor') ?? '').trim();
  // D11: no conflito, o valor digitado volta na URL e a célula o mostra de novo.
  const destino = `${aba(clienteId, 'precos')}&tentado=${encodeURIComponent(codificarTentado(grupoId, produtoId, digitado))}`;
  await comAvisoDeErro(destino, async () => {
    const u = await obterUsuario();
    if (!temNivel(u, 'precos', 'mudar')) throw new Error('Você não tem permissão para editar preços.');
    const { valor } = PrecoForm.parse(campos(formData));
    const vigente = String(formData.get('vigente') ?? '');
    const sb = await supabaseServidor();
    const { error } = await sb.rpc('definir_preco_conferido', { p_grupo: grupoId, p_produto: produtoId, p_valor: valor,
      p_vigente_esperado: (vigente || null) as string });
    if (error) throw new Error(error.code === 'PR409' ? AVISO_CONFLITO_PRECO : error.message);
  });
  revalidatePath(`/clientes/${clienteId}`);
}
```

**Atenção:** `comAvisoDeErro` só redireciona com `?erro=` quando falha; quando dá certo, **não** navega (o `tentado` não fica na URL). Confira que `aba(clienteId, 'precos')` devolve um endereço com `?` (ex.: `/clientes/<id>?aba=precos`); se não tiver, troque `&tentado=` por `?tentado=`.

Em `secao-precos.tsx`:
1. `SecaoPrecos` recebe `tentado?: string`; `const t = lerTentado(tentado);`.
2. A leitura das vigentes passa a trazer o id: `.select('id, grupo_id, produto_id, valor, origem')`.
3. No `<form>`, logo depois de abrir: `<input type="hidden" name="vigente" value={v?.id ?? ''} />`.
4. No `Input`, `defaultValue={t && t.grupo === r.id && t.produto === p.id ? t.valor : v ? valorCampo(Number(v.valor)) : ''}` e, quando for o tentado, `aria-describedby="aviso-preco"`.
5. O aviso vermelho de `?erro=` já aparece no topo da página (como os outros cadastros, `cadastros.spec.ts:108`); **não** crie outro.

Em `clientes/[id]/page.tsx`: leia `tentado` dos `searchParams` como lê `historico` e passe para `SecaoPrecos`.

`apps/painel/e2e/preco-conflito.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const SENHA = 'senha-forte-123';
const ANA = { email: 'ana-precos@e2e.local', nome: 'Ana Preços' };

test('duas abas no mesmo preço: a segunda recebe o aviso, mantém o que digitou e nada é sobrescrito (Prompt 3, critério 1)', async ({ browser }) => {
  await criarUsuarioTeste({ email: ANA.email, senha: SENHA, nome: ANA.nome, papel: 'admin' });
  const { data: cl } = await db.from('clientes').insert({ razao_social: 'Conflito LTDA', cnpj: '19131243000197' }).select('id').single();
  const { data: g } = await db.from('parceiros_grupos').insert({ cliente_id: cl!.id, tipo: 'cliente', nome: 'Rede Conflito' }).select('id').single();
  await db.from('produtos').insert({ cliente_id: cl!.id, codigo: 'PC1', descricao: 'Pão de conflito', unidade: 'UN' });
  const ctx = await browser.newContext();
  const [a, b] = [await ctx.newPage(), await ctx.newPage()];
  await entrar(a, ANA.email, SENHA);
  for (const p of [a, b]) await p.goto(`/clientes/${cl!.id}?aba=precos`);
  const campo = (p: typeof a) => p.getByLabel('Preço de Pão de conflito para Rede Conflito');
  await campo(a).fill('10,00');
  await a.getByLabel('Salvar preço de Pão de conflito para Rede Conflito').click();
  await expect(a.getByText('Histórico de preço')).toHaveCount(0);
  await campo(b).fill('11,00');
  await b.getByLabel('Salvar preço de Pão de conflito para Rede Conflito').click();
  await expect(b.getByText('Alguém mudou este preço agora há pouco. Recarregue para ver o valor atual.')).toBeVisible();
  await expect(campo(b)).toHaveValue('11,00');
  const { data: vig } = await db.from('precos').select('valor').eq('grupo_id', g!.id).is('vigente_ate', null);
  expect(vig).toEqual([{ valor: 10 }]);
  await ctx.close();
});
```

(Confira em `cadastros.spec.ts` como um CNPJ válido e os dados mínimos de rede e produto são criados e copie; o rótulo do campo e do botão são os de `secao-precos.tsx:88,95`.)

- [ ] **Step 4: Rode** (Supabase local; `supabase db reset`; memória ≥ 4 GB)

```bash
pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck
cd apps/painel
pnpm exec playwright test e2e/preco-conflito.spec.ts e2e/cadastros.spec.ts --workers=1
```

Expected: PASS; `cadastros.spec.ts` sem mudança.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`)

```bash
git add apps/painel/src/lib/precos-conflito.ts apps/painel/src/lib/precos-conflito.test.ts "apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts" "apps/painel/src/app/(painel)/clientes/[id]/secao-precos.tsx" "apps/painel/src/app/(painel)/clientes/[id]/page.tsx" apps/painel/e2e/preco-conflito.spec.ts
git commit -m "feat(painel): preço conferido — a segunda aba recebe o aviso e mantém o valor digitado (integridade, D10, D11)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Trabalhador. O agente também confere o preço (D12)

**Files:**
- Modify: `apps/trabalhador/src/agente/ferramentas.ts` (só o `case 'alterar_preco'`)
- Create: `apps/trabalhador/test/producao/preco-agente.test.ts`

**Interfaces:**
- Consumes: `repos.precoVigenteId`, `repos.definirPrecoConferidoPeloAgente`, `ConflitoVersao` (Task 9); as decisões `consultar_preco` desta conversa (`decisoes_agente`, `saida.preco`).
- Produces: `export const AVISO_PRECO_MUDOU = (antes: string, agora: string) => …` em `ferramentas.ts`.

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/producao/preco-agente.test.ts` (banco local; copie a preparação de `apps/trabalhador/test/agente/cadastros.test.ts`, que já chama `alterar_preco` com empresa, rede, produto e contato com "pode mudar preço"):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { db, repos } from '../apoio/cenario';
// + a preparação copiada do teste existente de alterar_preco: empresa, rede, produto, contato com "pode mudar preço", contexto e deps.

describe('alterar_preco conferido (D12, Foco 3)', () => {
  beforeEach(async () => { await limparBanco(); });

  it('consultou R$ 10, alguém mudou para R$ 12 no painel, o cliente confirmou "de 10 para 15": recusa e não grava', async () => {
    // 1) preço 10 gravado; 2) o agente chama consultar_preco (decisão com saida.preco "R$ 10,00");
    // 3) o painel muda para 12 (definir_preco direto no banco); 4) o agente chama alterar_preco com novo_valor 15 e confirmado_pelo_cliente true.
    // Esperado: resultado com erro contendo "O preço mudou agora há pouco (era R$ 10,00, agora é R$ 12,00)"; a vigente continua 12.
  });

  it('sem consultar antes e sem mudança: grava como hoje', async () => {
    // preço 10; alterar_preco 15 confirmado → ok com antes "R$ 10,00" e depois "R$ 15,00"; vigente 15.
  });

  it('corrida no banco (outra gravação entre a leitura e a escrita): ConflitoVersao vira a mesma recusa, sem exceção', async () => {
    // troque repos.precoVigenteId por um que devolve um id velho (spy): o banco lança PR409 → a ferramenta devolve falha com AVISO_PRECO_MUDOU.
  });
});
```

Escreva os três testes **por inteiro** a partir da preparação copiada (os comentários acima dizem exatamente o que montar e conferir; os valores e as frases são os da D12).

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/producao/preco-agente.test.ts`
Expected: FAIL (o primeiro e o terceiro: hoje grava por cima).

- [ ] **Step 3: Implemente** — no `case 'alterar_preco'`, troque o bloco do `try { await d.repos.definirPrecoPeloAgente(…) }` por:

```ts
      // D12 (integridade): o preço que o cliente viu tem de ser o vigente agora; senão confirma de novo.
      const consultado = await d.repos.ultimoPrecoConsultado(ctx.conversa.id, unidade.grupoId, produto.id, new Date(ctx.agora.getTime() - 24 * 3600_000));
      if (consultado !== null && atual !== null && consultado !== formatarReais(atual)) return falha(AVISO_PRECO_MUDOU(consultado, formatarReais(atual)));
      try {
        await d.repos.definirPrecoConferidoPeloAgente(unidade.grupoId, produto.id, entrada.novo_valor, ctx.contato!.id,
          await d.repos.precoVigenteId(unidade.grupoId, produto.id));
      } catch (erro) {
        if (erro instanceof ConflitoVersao) {
          const agora = (await d.repos.precosVigentes(e.clienteId, unidade.grupoId, [produto.id]))[produto.id] ?? null;
          return falha(AVISO_PRECO_MUDOU(atual === null ? 'sem preço' : formatarReais(atual), agora === null ? 'sem preço' : formatarReais(agora)));
        }
        const msg = erro instanceof Error ? erro.message : '';
        if (msg.includes('sem permissão')) return falha('Este contato não tem permissão para mudar preço (sem permissão). Não altere: abra uma demanda com abrir_chamado para a equipe decidir.');
        throw erro;
      }
```

com, perto de `AVISOS`:

```ts
/** D12 (integridade): o preço vigente mudou entre o que o cliente viu e a gravação. */
export const AVISO_PRECO_MUDOU = (antes: string, agora: string) =>
  `O preço mudou agora há pouco (era ${antes}, agora é ${agora}). Mostre o valor novo ao cliente e confirme de novo antes de alterar.`;
```

e o método novo em `repos.ts` (acrescente na Task 9 se preferir; aqui, no mesmo commit):

```ts
    /** D12: o preço que o último consultar_preco desta conversa mostrou para esta rede e produto (texto "R$ …"), ou null. */
    async ultimoPrecoConsultado(conversaId: string, grupoId: string, produtoId: string, desde: Date): Promise<string | null> {
      const l = checar(await db.from('decisoes_agente').select('saida').eq('conversa_id', conversaId).eq('etapa', 'consultar_preco')
        .eq('entrada->>produto_id', produtoId).gte('criado_em', desde.toISOString()).order('criado_em', { ascending: false }).limit(1), 'ultimoPrecoConsultado');
      const preco = (l[0]?.saida as { preco?: unknown } | undefined)?.preco;
      return typeof preco === 'string' ? preco : null;
    },
```

(`entrada` de `consultar_preco` tem `unidade_id` e `produto_id`; a rede vem da unidade. Se duas unidades da mesma rede forem usadas na mesma conversa, a comparação por produto basta: o preço é por rede e a última consulta é a que o cliente viu. Importe `ConflitoVersao` de `@escritorio/db`.)

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/db typecheck`
Expected: PASS, inclusive os testes antigos de preço e `retrato-thiago` (a `description` de `alterar_preco` não mudou).

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/agente/ferramentas.ts packages/db/src/repos.ts apps/trabalhador/test/producao/preco-agente.test.ts
git commit -m "feat(agente): alterar_preco confere o preço que o cliente viu e a vigente no banco (integridade, D12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Trabalhador. Assistente: correção atômica, prévia que não chegou e pergunta sem duplicar (D13, D14, D15)

**Files:**
- Modify: `apps/trabalhador/src/assistente/ferramentas.ts` (só a gravação em `alterar_pedido_venda`), `apps/trabalhador/src/assistente/processar.ts` (`responder`), `apps/trabalhador/src/processar-conversa.ts` (o laço que grava a pergunta do WhatsApp)
- Create: `apps/trabalhador/test/producao/assistente-integridade.test.ts`

**Interfaces:**
- Consumes: `repos.aplicarCorrecaoPedido`, `ConflitoVersao`, `repos.registrarPerguntaWhatsapp` (Task 9); `executarAssistente` devolve `r.previasMostradas`? — **confira**: se o resultado de `executarAssistente` não expõe as prévias mostradas, acrescente `previasMostradas: { numero: number }[]` ao objeto que ele devolve (a partir de `estado.previasMostradas`; é um campo **novo**, os testes antigos não leem).
- Produces: comportamento.

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/producao/assistente-integridade.test.ts`. Copie a preparação de `test/assistente/corrigir.test.ts` (pessoa com "Corrigir e gerar", demanda com pedido de venda, `IaRoteirizada`) e escreva:

```ts
describe('assistente — integridade (Prompt 3, critérios 2, 3 e 4)', () => {
  it('envio da prévia pelo WhatsApp falhou na última tentativa → o "sim" seguinte não grava e pede a prévia de novo', async () => {
    // 1) job 1 (WhatsApp, ultimaTentativa = true): a IA chama alterar_pedido_venda sem confirmado (prévia) e responder;
    //    o canal falha no enviarTexto (CanalFalso.falharEnvio = true).
    // 2) job 2: a pessoa manda "sim"; a IA chama alterar_pedido_venda { numero, confirmado: true }.
    // Esperado: o resultado da ferramenta tem "Mostre o antes e o depois de novo e espere a confirmação."; pedido_venda igual ao de antes.
  });

  it('a mesma mensagem do WhatsApp reprocessada (agendamento falhou) não vira segunda pergunta nem segunda resposta', async () => {
    // processarConversa com a FilaFalsa lançando no enviar (agendarAssistente) → rejeita; de novo com a fila boa → 'assistente'.
    // Esperado: assistente_mensagens com papel 'usuario' para aquela pessoa = 1 linha.
  });

  it('falha no meio da gravação (nota interna) → nada gravado e o assistente diz que não gravou', async () => {
    // repos com aplicarCorrecaoPedido lançando new Error('falhou') (spy sobre o repos real): o "sim" depois da prévia entregue.
    // Esperado: o resultado da ferramenta é erro "Não consegui gravar a correção. Nada foi alterado. Tente de novo."; pedido_venda igual.
  });

  it('pedido mudou entre a prévia e o "sim" (ConflitoVersao do banco) → a frase de sempre', async () => {
    // aplicarCorrecaoPedido lança new ConflitoVersao('O pedido mudou desde a prévia.')
    // Esperado: "O pedido mudou desde a prévia (ou os preços da tabela). Mostre o antes e o depois de novo e espere a confirmação."
  });
});
```

Escreva cada teste por inteiro (a preparação copiada já tem a forma da prévia e do "sim"; os comentários dizem o que montar e as frases exatas a conferir).

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/producao/assistente-integridade.test.ts`
Expected: FAIL nos quatro.

- [ ] **Step 3: Implemente**

(a) `assistente/ferramentas.ts`, no fim de `alterar_pedido_venda`, troque as três gravações (`atualizarPedidoVenda`, `registrarNotaInterna`, `registrarAuditoria`) por:

```ts
      // D13 (integridade): pedido, nota interna e auditoria numa transação só — ou grava tudo, ou nada.
      try {
        await d.repos.aplicarCorrecaoPedido({ chamadoId: c.id, antes: c.pedido_venda, pedido: novo, resumo, titulo: trocou ? titulo : null,
          usuarioId: u.id, nota: `Pedido alterado pelo assistente a pedido de ${u.nome}.\nAntes:\n${antes}\nDepois:\n${depois}`,
          detalhes: { canal: estado.ctx.canal } });
      } catch (e) {
        if (e instanceof ConflitoVersao) return falha(`O pedido mudou desde a prévia (ou os preços da tabela). ${DE_NOVO}`);
        if (e instanceof Error && e.message.includes('já foi concluída')) return falha('Esta demanda já foi concluída; o pedido não pode mudar.');
        console.error('[assistente] correção do pedido não gravada', c.numero, e);
        return falha('Não consegui gravar a correção. Nada foi alterado. Tente de novo.');
      }
```

(Importe `ConflitoVersao` de `@escritorio/db`. `atualizarPedidoVenda`, `registrarNotaInterna` e `registrarAuditoria` continuam existindo no repositório — outros usam.)

(b) `assistente/processar.ts`, em `responder`: o envio do texto pelo WhatsApp guarda se chegou:

```ts
      let entregue = true;
      try {
        await d.canal.enviarTexto(j.telefone, texto);
      } catch (e) {
        if (!ultimaTentativa) throw e;
        entregue = false;
        console.error('[assistente] falha ao enviar pelo WhatsApp', e);
      }
      // D14 (integridade): a prévia que não chegou não vale; o "sim" seguinte pede a prévia de novo (a regra de consumo já existe).
      if (!entregue) {
        for (const numero of previas) {
          await d.repos.registrarDecisao({ conversaId: null, clienteId: null, etapa: 'assistente:alterar_pedido_venda',
            entrada: { numero }, saida: { usuario: usuario.id, gravado: null, nao_entregue: true } })
            .catch((e2) => console.error('[assistente] prévia não entregue não registrada', numero, e2));
        }
      }
```

e `responder` recebe `previas: number[] = []` como quarto parâmetro; a chamada final passa `r.previasMostradas.map((p) => p.numero)`. Confira em `ultimaPreviaDoAssistente` (`repos.ts:788`) que os filtros (`saida->>usuario`, `entrada->>numero` como texto, sem `nao_consome`) acham esta linha: `entrada.numero` é número, e o filtro compara com `String(numero)` via `->>` (texto) — confere.

(c) `processar-conversa.ts`, no laço do assistente pelo WhatsApp: troque `await d.repos.registrarMensagemAssistente({ usuarioId: usuario.id, canal: 'whatsapp', conversaId: null, papel: 'usuario', conteudo: texto });` por:

```ts
      // D15 (integridade): a nova tentativa deste job (agendamento que falhou) não grava a mesma pergunta de novo.
      if (texto.trim()) await d.repos.registrarPerguntaWhatsapp({ usuarioId: usuario.id, conteudo: texto, mensagemOrigemId: m.id });
```

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS, inclusive `test/assistente/*.test.ts` sem mudança. Se algum teste antigo do assistente conferir as **três** gravações separadas (ex.: espiando `registrarAuditoria`), **pare** e avise.

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/assistente/ferramentas.ts apps/trabalhador/src/assistente/processar.ts apps/trabalhador/src/assistente/executar.ts apps/trabalhador/src/processar-conversa.ts apps/trabalhador/test/producao/assistente-integridade.test.ts
git commit -m "fix(assistente): correção de pedido numa transação, prévia que não chegou não vale e pergunta do WhatsApp sem duplicar (integridade, D13, D14, D15)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Tire `executar.ts` do `git add` se não precisou mudar.)

---

### Task 13: Banco. Prova da confirmação e LGPD do treino (D16–D20)

**Files:**
- Create: `supabase/migrations/20261101000400_evidencia_lgpd.sql`, `supabase/tests/83_evidencia_lgpd.test.sql`, `packages/db/test/evidencia.test.ts`
- Modify: `packages/db/src/repos.ts`, `packages/db/src/tipos.gen.ts`, `packages/db/test/limpar.ts`

**Interfaces:**
- Produces (SQL):
  - `chamado_eventos.dados jsonb`; o `check` de `tipo` ganha `'confirmacao_cliente'` (mesma lista de `20261007000100` + o novo);
  - `configuracoes.retencao_evidencias_anos int not null default 5 check (between 1 and 20)`; `salvar_guarda_evidencias(p_anos int)` (**só o dono**, revisão P2-14; auditoria); `provas_que_sairiam(p_anos int) returns int` (só o dono; quantas provas a limpeza apagaria com esse prazo);
  - `abrir_chamado_com_prova(p_chamado jsonb, p_prova_texto text, p_prova_dados jsonb) returns table (id uuid, numero bigint)` (só `service_role`; revisão P2-12: a demanda e o evento `confirmacao_cliente` na mesma transação);
  - `orientacoes_agente.contato_origem_id uuid references contatos on delete set null`;
  - `ensinar_agente_da_conversa(p_conversa uuid, p_titulo text, p_texto text, p_tipo text, p_cliente_id uuid, p_setor_id uuid, p_ativo boolean) returns uuid` (quem treina o Thiago; chama `salvar_orientacao` e grava a origem na mesma transação);
  - `apagar_orientacao(p_id uuid) returns void` (administrador ou `pode_treinar_agente(agente da orientação)`; auditoria com título e tipo);
  - `anonimizar_contato(p_contato uuid)` — `create or replace`, mesma assinatura, corpo da H2 + D18 + D19 + D20.
- Produces (repos): `abrirChamadoComProva(c: NovoChamado, prova: { texto: string; dados: Record<string, unknown> }): Promise<{ id: string; numero: number }>` (banco sem a migração: `abrirChamado(c)` e um aviso no log — a demanda abre como hoje, sem prova); `retencaoEvidenciasAnos(): Promise<number | null>` (null sem a migração); `resumosEnviados` devolve `mensagemId?: string` (quando a `saida` da decisão tiver `mensagem_id`).

- [ ] **Step 1: Escreva o teste que falha** — `supabase/tests/83_evidencia_lgpd.test.sql`:

```sql
-- Plano de prontidão, Task 13 (D16–D20).
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values ('fa000000-0000-0000-0000-00000000000a', 'admin@ev.local'), ('fa000000-0000-0000-0000-00000000000b', 'ana@ev.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fa000000-0000-0000-0000-00000000000a', 'Ev Admin', 'admin@ev.local', 'admin', '{}'),
  ('fa000000-0000-0000-0000-00000000000b', 'Ev Ana', 'ana@ev.local', 'atendente', '{}');
-- Revisão P2-14: só o dono muda a guarda das provas; o administrador deste teste é o dono.
update public.usuarios set dono = false where dono;
update public.usuarios set dono = true where id = 'fa000000-0000-0000-0000-00000000000a';
insert into public.clientes (id, razao_social, cnpj) values ('fa100000-0000-0000-0000-00000000000a', 'Ev Indústria', '11222333000181');
insert into public.contatos (id, nome, telefone) values ('fa200000-0000-0000-0000-00000000000a', 'João Cliente', '5531980000091');
insert into public.conversas (id, telefone, contato_id) values ('fa300000-0000-0000-0000-00000000000a', '5531980000091', 'fa200000-0000-0000-0000-00000000000a');
insert into public.chamados (id, cliente_id, conversa_id, titulo) values
  ('fa400000-0000-0000-0000-00000000000a', 'fa100000-0000-0000-0000-00000000000a', 'fa300000-0000-0000-0000-00000000000a', 'NF de venda');
insert into public.chamado_eventos (chamado_id, cliente_id, tipo, texto, dados) values
  ('fa400000-0000-0000-0000-00000000000a', 'fa100000-0000-0000-0000-00000000000a', 'confirmacao_cliente', 'Cliente confirmou o pedido pelo WhatsApp em 02/11/2026 10:00',
   '{"resumo_enviado":"2 caixas de pão","confirmacao":"confirmo","contato_id":"fa200000-0000-0000-0000-00000000000a","contato_nome":"João Cliente","telefone_final":"…0091","chave":"abc123"}'),
  ('fa400000-0000-0000-0000-00000000000a', 'fa100000-0000-0000-0000-00000000000a', 'nota_interna', 'João pediu urgência', null);
-- A prova tem 3 anos: entra na conta de provas_que_sairiam(1), não na de (5).
update public.chamado_eventos set criado_em = now() - interval '3 years' where tipo = 'confirmacao_cliente';

-- 1–4: estrutura
select has_column('public', 'chamado_eventos', 'dados', 'chamado_eventos.dados');
select has_column('public', 'configuracoes', 'retencao_evidencias_anos', 'configuracoes.retencao_evidencias_anos');
select is((select retencao_evidencias_anos from public.configuracoes where id = 1), 5, 'padrão 5 anos');
select has_column('public', 'orientacoes_agente', 'contato_origem_id', 'orientacoes_agente.contato_origem_id');

-- 5–8: Ensinar o agente grava a origem (D19)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select isnt(public.ensinar_agente_da_conversa('fa300000-0000-0000-0000-00000000000a', 'Pedido urgente',
  E'Situação: Cliente: “preciso da nota hoje, meu CPF é 123”\nO que fazer: avisar o Fiscal', 'situacao', null, null, false), null, 'cria pela conversa');
select is((select contato_origem_id from public.orientacoes_agente where titulo = 'Pedido urgente'), 'fa200000-0000-0000-0000-00000000000a'::uuid, 'origem = o contato da conversa');
select ok(exists (select 1 from public.orientacoes_agente_versoes v join public.orientacoes_agente o on o.id = v.orientacao_id where o.titulo = 'Pedido urgente'), 'versão criada');
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.ensinar_agente_da_conversa('fa300000-0000-0000-0000-00000000000a', 'x', 'O que fazer: x', 'regra', null, null, false) $$,
  'P0001', null, 'quem não treina não cria');

-- 9–12: guarda das evidências (D17, revisão P2-14: só o dono; a tela mostra quantas sairiam)
select throws_ok($$ select public.salvar_guarda_evidencias(3) $$, 'P0001', 'Só o dono muda a guarda das evidências.', 'atendente não muda');
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.provas_que_sairiam(1), 1, 'com 1 ano, a prova de 3 anos sairia');
select is(public.provas_que_sairiam(5), 0, 'com 5 anos, nenhuma');
select lives_ok($$ select public.salvar_guarda_evidencias(7) $$, 'o dono muda para 7');

-- 11–16: anonimizar mantém a prova sem nome e telefone; mascara o treino; apaga as simulações dele (D18, D19, D20)
insert into public.simulacoes_agente (usuario_id, mensagem, rascunho) values
  ('fa000000-0000-0000-0000-00000000000a', 'preciso da nota hoje', jsonb_build_object('id', (select id from public.orientacoes_agente where titulo = 'Pedido urgente')));
select lives_ok($$ select public.anonimizar_contato('fa200000-0000-0000-0000-00000000000a') $$, 'anonimiza');
select is((select dados->>'resumo_enviado' from public.chamado_eventos where tipo = 'confirmacao_cliente'), '2 caixas de pão', 'a prova fica (D18)');
select is((select (dados ? 'contato_nome') or (dados ? 'telefone_final') from public.chamado_eventos where tipo = 'confirmacao_cliente'), false, 'sem nome nem telefone');
select is((select texto from public.chamado_eventos where tipo = 'nota_interna' and chamado_id = 'fa400000-0000-0000-0000-00000000000a'), null, 'a nota interna é limpa como antes');
select is((select texto from public.orientacoes_agente where titulo = 'Pedido urgente'),
  E'Situação: Cliente: “[removido a pedido do titular]”\nO que fazer: avisar o Fiscal', 'orientação mascarada, o "O que fazer" fica');
select is((select count(*)::int from public.orientacoes_agente_versoes v join public.orientacoes_agente o on o.id = v.orientacao_id
  where o.titulo = 'Pedido urgente' and v.texto like '%CPF%'), 0, 'versões mascaradas também');
select is((select count(*)::int from public.simulacoes_agente where mensagem = 'preciso da nota hoje'), 0, 'simulação ligada à orientação apagada (D20)');
select is((select count(*)::int from public.orientacoes_agente_versoes v join public.orientacoes_agente o on o.id = v.orientacao_id
  where o.titulo = 'Pedido urgente'), 1, 'versões antigas apagadas; fica uma, já mascarada (revisão P2-16)');
select is((select ativo from public.orientacoes_agente where titulo = 'Pedido urgente'), false, 'a orientação fica desligada até alguém revisar');

-- 18–19: apagar_orientacao (D19)
select lives_ok($$ select public.apagar_orientacao((select id from public.orientacoes_agente where titulo = 'Pedido urgente')) $$, 'apaga');
select ok(exists (select 1 from public.auditoria_acessos where acao = 'apagar' and entidade = 'orientacoes_agente'
  and detalhes ->> 'titulo' = 'Pedido urgente' and not (detalhes ? 'texto')), 'auditoria com título, sem o texto');

-- 24–25: a demanda e a prova juntas (revisão P2-12)
select throws_ok($$ select * from public.abrir_chamado_com_prova('{"titulo":"NF de venda"}', 'x', '{}') $$, '42501', null, 'pessoa não chama');
reset role;
select is((select count(*)::int from public.chamado_eventos e join public.abrir_chamado_com_prova(
  jsonb_build_object('cliente_id', 'fa100000-0000-0000-0000-00000000000a', 'conversa_id', 'fa300000-0000-0000-0000-00000000000a', 'titulo', 'NF de venda - Rede', 'resumo', 'r', 'origem', 'agente'),
  'Cliente confirmou o pedido pelo WhatsApp em 02/11/2026 10:05', '{"confirmacao":"confirmo"}') n on n.id = e.chamado_id
  where e.tipo = 'confirmacao_cliente'), 1, 'demanda nova com a prova, na mesma chamada');

select * from finish();
rollback;
```

(São 25: confira a contagem depois de escrever; se mudar um teste, ajuste o `plan`. `anonimizar_contato` exige administrador — o `jwt` do admin está ativo nesse ponto.)

`packages/db/test/evidencia.test.ts`: `abrirChamadoComProva` abre a demanda e grava o evento `confirmacao_cliente` com `dados` (e o `prazo_em` do gatilho, como `abrirChamado`); `retencaoEvidenciasAnos()` devolve 5 depois de `limparBanco` (e `limparBanco` volta o valor a 5).

- [ ] **Step 2: Rode e veja falhar**

Run: `supabase test db` (→ `83` FAIL) e `pnpm --filter @escritorio/db exec vitest run test/evidencia.test.ts` (→ FAIL).

- [ ] **Step 3: Implemente** — `supabase/migrations/20261101000400_evidencia_lgpd.sql`:

```sql
-- supabase/migrations/20261101000400_evidencia_lgpd.sql
-- Plano de prontidão, Prompt 3 (D16–D20): a prova da confirmação do pedido de nota e a LGPD do treino.

-- D16: o evento da prova, com os dados num jsonb (o texto é só a frase da linha do tempo).
alter table public.chamado_eventos add column dados jsonb;
alter table public.chamado_eventos drop constraint chamado_eventos_tipo_check;
alter table public.chamado_eventos add constraint chamado_eventos_tipo_check check (tipo in (
  'criacao', 'assumido', 'transferencia', 'nota_interna', 'conclusao',
  'status_alterado', 'prioridade_alterada', 'prazo_alterado', 'responsavel_alterado', 'editado', 'reaberto',
  'prazo_recalculado', 'confirmacao_cliente'));

-- D17: por quanto tempo a prova fica (a limpeza diária apaga só as mais velhas que isso).
alter table public.configuracoes add column retencao_evidencias_anos int not null default 5 check (retencao_evidencias_anos between 1 and 20);

create function public.salvar_guarda_evidencias(p_anos int) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Revisão P2-14: baixar o prazo apaga provas sem volta — só o dono.
  if not eh_dono() then raise exception 'Só o dono muda a guarda das evidências.'; end if;
  if p_anos is null or p_anos < 1 or p_anos > 20 then raise exception 'Escolha de 1 a 20 anos.'; end if;
  update configuracoes set retencao_evidencias_anos = p_anos where id = 1;
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'editar', 'configuracoes', 'retencao_evidencias_anos', jsonb_build_object('anos', p_anos));
end $$;
revoke execute on function public.salvar_guarda_evidencias(int) from public, anon;
grant execute on function public.salvar_guarda_evidencias(int) to authenticated;

-- Revisão P2-14: a tela mostra quantas provas a limpeza apagaria com o prazo escolhido, antes de salvar.
create function public.provas_que_sairiam(p_anos int) returns int
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_dono() then raise exception 'Só o dono vê isto.'; end if;
  return (select count(*)::int from chamado_eventos where tipo = 'confirmacao_cliente' and criado_em < now() - make_interval(years => p_anos));
end $$;
revoke execute on function public.provas_que_sairiam(int) from public, anon;
grant execute on function public.provas_que_sairiam(int) to authenticated;

-- Revisão P2-12: a demanda de nota e a prova da confirmação na mesma transação (o gatilho do prazo vale como no insert de hoje).
create function public.abrir_chamado_com_prova(p_chamado jsonb, p_prova_texto text, p_prova_dados jsonb)
returns table (id uuid, numero bigint)
language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_numero bigint; v_cliente uuid := (p_chamado ->> 'cliente_id')::uuid;
begin
  insert into chamados (cliente_id, conversa_id, setor_id, responsavel_id, titulo, resumo, fora_do_contrato, origem, prioridade)
  values (v_cliente, (p_chamado ->> 'conversa_id')::uuid, (p_chamado ->> 'setor_id')::uuid, (p_chamado ->> 'responsavel_id')::uuid,
          p_chamado ->> 'titulo', coalesce(p_chamado ->> 'resumo', ''), coalesce((p_chamado ->> 'fora_do_contrato')::boolean, false),
          coalesce(p_chamado ->> 'origem', 'agente'), coalesce(p_chamado ->> 'prioridade', 'normal')::prioridade_demanda)
  returning chamados.id, chamados.numero into v_id, v_numero;
  insert into chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto, dados)
  values (v_id, v_cliente, 'confirmacao_cliente', null, p_prova_texto, p_prova_dados);
  return query select v_id, v_numero;
end $$;
revoke execute on function public.abrir_chamado_com_prova(jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.abrir_chamado_com_prova(jsonb, text, jsonb) to service_role;

-- D19: de qual contato veio a orientação ("Ensinar o agente").
alter table public.orientacoes_agente add column contato_origem_id uuid references public.contatos (id) on delete set null;
create index orientacoes_agente_origem_idx on public.orientacoes_agente (contato_origem_id) where contato_origem_id is not null;

create function public.ensinar_agente_da_conversa(p_conversa uuid, p_titulo text, p_texto text, p_tipo text,
  p_cliente_id uuid default null, p_setor_id uuid default null, p_ativo boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_contato uuid;
begin
  select contato_id into v_contato from conversas where id = p_conversa;
  -- salvar_orientacao confere a permissão (treinar o agente), grava a versão e a auditoria.
  v_id := salvar_orientacao(null, p_titulo, p_texto, p_tipo, p_cliente_id, p_setor_id, p_ativo);
  update orientacoes_agente set contato_origem_id = v_contato where id = v_id;
  return v_id;
end $$;
revoke execute on function public.ensinar_agente_da_conversa(uuid, text, text, text, uuid, uuid, boolean) from public, anon;
grant execute on function public.ensinar_agente_da_conversa(uuid, text, text, text, uuid, uuid, boolean) to authenticated;

create function public.apagar_orientacao(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select id, titulo, tipo, agente_id into o from orientacoes_agente where id = p_id;
  if not found then raise exception 'Orientação não encontrada.'; end if;
  if not (eh_admin() or pode_treinar_agente(o.agente_id)) then raise exception 'Você não tem permissão para apagar esta orientação.'; end if;
  delete from simulacoes_agente where rascunho ->> 'id' = p_id::text;
  delete from orientacoes_agente where id = p_id;   -- as versões saem junto (on delete cascade)
  insert into auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'apagar', 'orientacoes_agente', p_id::text, jsonb_build_object('titulo', o.titulo, 'tipo', o.tipo));
end $$;
revoke execute on function public.apagar_orientacao(uuid) from public, anon;
grant execute on function public.apagar_orientacao(uuid) to authenticated;
```

e, no fim do mesmo arquivo, **`create or replace function public.anonimizar_contato(p_contato uuid) returns text[]`** com **o corpo inteiro de `20261013000100_painel_v2_acesso_contato.sql:129-178`, copiado sem mudança**, com estas três alterações:
1. a linha `update chamado_eventos e set texto = null from chamados ch join conversas c … where …;` ganha `and e.tipo <> 'confirmacao_cliente'` no `where`;
2. logo depois dela:

```sql
  -- D18: a prova da confirmação fica (exercício regular de direito), sem nome e telefone do titular.
  update chamado_eventos e set dados = (e.dados - 'contato_nome' - 'telefone_final') || '{"anonimizado": true}'::jsonb
  from chamados ch join conversas c on c.id = ch.conversa_id
  where ch.id = e.chamado_id and e.tipo = 'confirmacao_cliente' and (c.contato_id = p_contato or c.telefone = v_tel);

  -- D19, D20: o treino que nasceu desta conversa: as linhas citadas do cliente saem; o "O que fazer" da equipe fica.
  delete from simulacoes_agente s using orientacoes_agente o where o.contato_origem_id = p_contato and s.rascunho ->> 'id' = o.id::text;
  -- Revisão P2-16: mascarar, desligar (alguém revisa) e trocar o histórico por uma versão só, já mascarada.
  update orientacoes_agente set texto = regexp_replace(texto, 'Cliente: “[^”]*”', 'Cliente: “[removido a pedido do titular]”', 'g'), ativo = false
   where contato_origem_id = p_contato;
  delete from orientacoes_agente_versoes v using orientacoes_agente o where o.id = v.orientacao_id and o.contato_origem_id = p_contato;
  insert into orientacoes_agente_versoes (orientacao_id, acao, titulo, texto, tipo, cliente_id, setor_id, ativo, usuario_id)
  select id, 'editar', titulo, texto, tipo, cliente_id, setor_id, false, auth.uid() from orientacoes_agente where contato_origem_id = p_contato;
```

3. o comentário do topo passa a dizer: `-- LGPD: corpo de 20261013000100 + a prova da confirmação (D18) e o treino (D19, D20) do plano de prontidão.`

**O gatilho de versões:** se `orientacoes_agente` tiver gatilho que grava versão a cada `update`, confira se o `update` acima gerou uma versão a mais e ajuste: o teste "versões antigas apagadas" espera **1** versão depois da anonimização. **Atenção:** a orientação pode ter `titulo` sugerido a partir da fala do cliente (`sugerirTitulo`); a regra acima mascara só o `texto`. Se o pgTAP mostrar o CPF no título, acrescente `titulo = 'Orientação de atendimento'` no mesmo `update` **só** para as que têm `contato_origem_id` e cujo título apareça dentro de uma citação removida — mais simples e seguro: **sempre** trocar o título dessas para `'Orientação de atendimento (titular anonimizado)'`. Decida pelo teste: acrescente um caso ao pgTAP com o título vindo da fala e confira.

**Também:** a política e o gatilho de `orientacoes_agente` (`orientacoes_do_agente_certo`, `20261014000100:425`) podem recusar o `update` direto feito por função; se recusar, use `perform set_config('app.agente_orientacao', …)` como `salvar_orientacao_agente` faz.

Em `packages/db/src/repos.ts`:

```ts
    /** D16 (revisão P2-12): a demanda de nota e a prova da confirmação juntas. Banco sem a migração: a demanda como hoje, sem prova. */
    async abrirChamadoComProva(c: NovoChamado, prova: { texto: string; dados: Record<string, unknown> }): Promise<{ id: string; numero: number }> {
      const r = await db.rpc('abrir_chamado_com_prova', {
        p_chamado: { cliente_id: c.clienteId, conversa_id: c.conversaId, setor_id: c.setorId, responsavel_id: c.responsavelId, titulo: c.titulo,
          resumo: c.resumo, fora_do_contrato: c.foraDoContrato, origem: c.origem, prioridade: c.prioridade ?? 'normal' } as never,
        p_prova_texto: prova.texto, p_prova_dados: prova.dados as never });
      if (r.error && SEM_PARTE_I.has(r.error.code)) {
        console.warn('[prova] banco sem a migração 20261101000400: demanda aberta sem a prova da confirmação');
        return this.abrirChamado(c);
      }
      const l = checar(r, 'abrirChamadoComProva')[0]!;
      return { id: l.id, numero: Number(l.numero) };
    },

    /** D17: anos de guarda das provas; null sem a migração (a limpeza não apaga nada). */
    async retencaoEvidenciasAnos(): Promise<number | null> {
      const r = await db.from('configuracoes').select('retencao_evidencias_anos').eq('id', 1).single();
      if (r.error && SEM_PARTE_I.has(r.error.code)) return null;
      return checar(r, 'retencaoEvidenciasAnos').retencao_evidencias_anos;
    },
```

e em `resumosEnviados`: `.select('entrada, saida, criado_em')` e o retorno `[{ entrada: l.entrada, conferencia: chave, mensagemId: typeof s?.mensagem_id === 'string' ? s.mensagem_id : undefined, criadoEm: l.criado_em }]` com o tipo `{ entrada: unknown; conferencia: string; mensagemId?: string; criadoEm?: string }[]` (campos **opcionais**: quem usa hoje continua igual).

Em `packages/db/test/limpar.ts`, no `update public.configuracoes …` do fim, **não** mude a linha existente; acrescente depois:

```ts
  // Plano de prontidão (D17): a guarda das provas volta ao padrão.
  await c.query(`do $$ begin
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'configuracoes' and column_name = 'retencao_evidencias_anos') then
      update public.configuracoes set retencao_evidencias_anos = 5;
    end if; end $$`);
```

`pnpm db:tipos`.

- [ ] **Step 4: Rode**

Run: `supabase db reset && supabase test db && pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck`
Expected: tudo passa; `83` 25/25; os pgTAP antigos de `anonimizar_contato` (procure com `grep -ln anonimizar_contato supabase/tests`) **sem mudança e passando**.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`)

```bash
git add supabase/migrations/20261101000400_evidencia_lgpd.sql supabase/tests/83_evidencia_lgpd.test.sql packages/db/src/repos.ts packages/db/src/tipos.gen.ts packages/db/test/limpar.ts packages/db/test/evidencia.test.ts
git commit -m "feat(banco): prova da confirmação do pedido de nota com guarda própria e LGPD do treino (origem, anonimizar, apagar) (integridade, D16–D20)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Trabalhador. A prova em cada pedido de nota e a guarda das provas (D16, D17; revisão P2-12, P2-13)

**Files:**
- Modify: `apps/trabalhador/src/agente/ferramentas.ts` (`resumir_pedido_nota`: devolve `mensagem_id`; `abrir_pedido_nota`: abre com a prova), `apps/trabalhador/src/retencao.ts`
- Create: `apps/trabalhador/src/agente/prova.ts`, `apps/trabalhador/test/producao/evidencia.test.ts`

**Interfaces:**
- Consumes: `repos.abrirChamadoComProva`, `repos.retencaoEvidenciasAnos`, `resumosEnviados` com `mensagemId`/`criadoEm` (Task 13); `acharResumoConferido` (devolve `achado.resumo`); `enviarDoSistema` (devolve o id da mensagem).
- Produces: `export function montarProva(p: { resumoTexto: string; resumoEm: string; mensagemResumoId: string | null; confirmacao: string; confirmacaoEm: string; contato: { id: string; nome: string } | null; telefone: string; chave: string }): { texto: string; dados: Record<string, unknown> }` em `apps/trabalhador/src/agente/prova.ts` (`pedido-nota.ts` não muda).

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/producao/evidencia.test.ts` (a preparação é a de `test/agente/cadastros.test.ts:10-28`, copiada; revisão P2-13: o teste inteiro, sem comentário no lugar do código):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { limparRetencao } from '../../src/retencao';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
let cad: CadastrosExemplo;
let estado: EstadoExecucao;
let telefone: string;
let conversaId: string;

const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => {
  const r = await executarFerramenta(d(), estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};
const base = () => ({
  tipo: 'venda', unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
  itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 20, unidade: 'PAC' }],
});

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Indústria X']);
  telefone = conversa.telefone;
  conversaId = conversa.id;
  cad = await criarCadastrosExemplo(empresas[0]!.id);
  const contato = await repos.buscarContato(conversa.telefone);
  estado = { ctx: await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H), respondeu: false };
});

describe('prova da confirmação (Prompt 3, critério 5; D16)', () => {
  it('toda demanda nova de pedido de nota tem o evento confirmacao_cliente com o resumo, a confirmação, o contato e a chave', async () => {
    const resumo = await usar('resumir_pedido_nota', base());
    expect(resumo._erro).toBe(false);
    const textoDoResumo = canal.enviados.at(-1)!.texto!;
    await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor: 'CONFIRMO-1', tipo: 'texto', conteudo: 'confirmo' });
    const aberta = await usar('abrir_pedido_nota', { ...base(), pedido_original: 'Tira NF pro Brasil Santa Efigênia: 20 PAC costela', cliente_confirmou_resumo: true });
    expect(aberta._erro).toBe(false);
    const { data: ch } = await db.from('chamados').select('id').eq('numero', aberta.numero).single();
    const { data: ev } = await db.from('chamado_eventos').select('texto, dados').eq('chamado_id', ch!.id).eq('tipo', 'confirmacao_cliente');
    expect(ev).toHaveLength(1);
    const dados = ev![0]!.dados as Record<string, unknown>;
    expect(ev![0]!.texto).toMatch(/^Cliente confirmou o pedido pelo WhatsApp em /);
    expect(dados.resumo_enviado).toBe(textoDoResumo);
    expect(dados.confirmacao).toBe('confirmo');
    expect(dados.chave).toBe(resumo.conferencia);
    expect(dados.contato_nome).toBeTruthy();
    expect(dados.telefone_final).toBe(`…${telefone.slice(-4)}`);
    expect(dados.mensagem_resumo_id).toBeTruthy();
  });

  it('a demanda e a prova saem juntas: falhou a gravação, não fica demanda sem prova (revisão P2-12)', async () => {
    await usar('resumir_pedido_nota', base());
    await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor: 'CONFIRMO-2', tipo: 'texto', conteudo: 'confirmo' });
    const original = repos.abrirChamadoComProva;
    repos.abrirChamadoComProva = async () => { throw new Error('abrirChamadoComProva: falhou'); };
    try {
      await expect(executarFerramenta(d(), estado, 'abrir_pedido_nota',
        { ...base(), pedido_original: 'x', cliente_confirmou_resumo: true })).rejects.toThrow('falhou');
    } finally {
      repos.abrirChamadoComProva = original;
    }
    expect((await db.from('chamados').select('id').like('titulo', 'NF de %')).data).toEqual([]);
  });

  it('a limpeza de 1 ano das mensagens não apaga a prova; a guarda das provas apaga só as mais velhas que o prazo (D17)', async () => {
    const { data: cl } = await db.from('clientes').select('id').limit(1).single();
    const { data: ch } = await db.from('chamados').insert({ cliente_id: cl!.id, titulo: 'NF de venda' }).select('id').single();
    const agora = new Date('2026-11-02T12:00:00Z');
    const ha = (anos: number) => new Date(agora.getTime() - anos * 365.25 * 24 * 3600_000).toISOString();
    await db.from('chamado_eventos').insert([
      { chamado_id: ch!.id, cliente_id: cl!.id, tipo: 'confirmacao_cliente', texto: 'dois anos', dados: {}, criado_em: ha(2) },
      { chamado_id: ch!.id, cliente_id: cl!.id, tipo: 'confirmacao_cliente', texto: 'seis anos', dados: {}, criado_em: ha(6) },
    ]);
    await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor: 'VELHA-1', tipo: 'texto', conteudo: 'velha' });
    await db.from('mensagens').update({ criado_em: ha(2) }).eq('id_provedor', 'VELHA-1');
    await limparRetencao(db, criarArmazenamento(db), agora);
    expect((await db.from('mensagens').select('id').eq('id_provedor', 'VELHA-1')).data).toEqual([]);
    const { data: provas } = await db.from('chamado_eventos').select('texto').eq('tipo', 'confirmacao_cliente');
    expect(provas!.map((p) => p.texto)).toEqual(['dois anos']);
  });
});
```

(`repos` é o objeto real de `test/apoio/cenario.ts`; trocar um método dele por um que lança, e devolver no `finally`, é o jeito que os testes da casa já usam para simular falha — confira um exemplo com `grep -rn "= async () => { throw" apps/trabalhador/test` e siga a mesma forma; se o objeto for congelado, use `vi.spyOn(repos, 'abrirChamadoComProva').mockRejectedValueOnce(…)`.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/producao/evidencia.test.ts`
Expected: FAIL (sem evento; `abrirChamadoComProva` não é usado; a limpeza não olha as provas).

- [ ] **Step 3: Implemente**

`apps/trabalhador/src/agente/prova.ts`:

```ts
/** Plano de prontidão (D16): a prova de que o cliente confirmou o pedido de nota. */
const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export function montarProva(p: {
  resumoTexto: string; resumoEm: string; mensagemResumoId: string | null; confirmacao: string; confirmacaoEm: string;
  contato: { id: string; nome: string } | null; telefone: string; chave: string;
}): { texto: string; dados: Record<string, unknown> } {
  return {
    texto: `Cliente confirmou o pedido pelo WhatsApp em ${DATA.format(new Date(p.confirmacaoEm))}`,
    dados: {
      resumo_enviado: p.resumoTexto, resumo_em: p.resumoEm, mensagem_resumo_id: p.mensagemResumoId,
      confirmacao: p.confirmacao, confirmacao_em: p.confirmacaoEm,
      contato_id: p.contato?.id ?? null, contato_nome: p.contato?.nome ?? null, telefone_final: `…${p.telefone.slice(-4)}`, chave: p.chave,
    },
  };
}
```

Em `ferramentas.ts`:
1. `resumir_pedido_nota`: `const mensagemId = await enviarDoSistema(d.envio, {…});` e `ok({ enviado: true, conferencia: …, mensagem_id: mensagemId, instrucao: … })` (a decisão grava a `saida` com o id; o modelo recebe um campo a mais, sem efeito).
2. `abrir_pedido_nota`: **antes** de abrir, monte a prova; **troque** `d.repos.abrirChamado({…})` por `d.repos.abrirChamadoComProva({…}, prova)` (os mesmos campos):

```ts
      // D16 (revisão P2-12): a prova da confirmação sai junto com a demanda — ou as duas, ou nenhuma.
      const msgs = await d.repos.historico(ctx.conversa.id, 30);
      const resumoMsg = achado.resumo.mensagemId ? msgs.find((m) => m.id === achado.resumo.mensagemId) ?? null : null;
      const depois = msgs.filter((m) => m.direcao === 'entrada' && (!resumoMsg || m.criado_em > resumoMsg.criado_em));
      const confirmacao = depois.map((m) => m.conteudo ?? m.transcricao ?? '').filter(Boolean).join('\n') || '(sem texto: confirmação por áudio ou imagem)';
      const prova = montarProva({
        resumoTexto: resumoMsg?.conteudo ?? '(resumo não encontrado nas últimas mensagens)', resumoEm: resumoMsg?.criado_em ?? achado.resumo.criadoEm ?? ctx.agora.toISOString(),
        mensagemResumoId: resumoMsg?.id ?? null, confirmacao, confirmacaoEm: depois.at(-1)?.criado_em ?? ctx.agora.toISOString(),
        contato: ctx.contato ? { id: ctx.contato.id, nome: ctx.contato.nome } : null, telefone: ctx.conversa.telefone, chave: achado.resumo.conferencia,
      });
      const { id: chamadoId, numero } = await d.repos.abrirChamadoComProva({
        clienteId: e.clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
        titulo, resumo, foraDoContrato: false, origem: 'agente', prioridade: entrada.prioridade,
      }, prova);
```

(Confira o nome do campo que `acharResumoConferido` devolve — `achado.resumo` tem a linha de `resumosEnviados`; se for outro nome, use-o. A falha **lança** de propósito, D16. A prioridade já chega tratada: `z.enum(PRIORIDADES).catch('normal')` em `ferramentas.ts:261`.)

Em `retencao.ts`, depois das sugestões:

```ts
  // Plano de prontidão (D17): a prova da confirmação do pedido de nota fica o prazo escolhido (padrão 5 anos); sem a migração, nada.
  const { data: cfg } = await db.from('configuracoes').select('retencao_evidencias_anos').eq('id', 1).maybeSingle();
  const anos = (cfg as { retencao_evidencias_anos?: number } | null)?.retencao_evidencias_anos;
  if (anos) {
    const limiteProvas = new Date(agora);
    limiteProvas.setFullYear(limiteProvas.getFullYear() - anos);
    const { error: e8 } = await db.from('chamado_eventos').delete().eq('tipo', 'confirmacao_cliente').lt('criado_em', limiteProvas.toISOString());
    if (e8) throw new Error(e8.message);
  }
```

(Não mude o objeto devolvido — `retencao.test.ts`.)

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS, inclusive `cadastros.test.ts` (as notas abrem como antes, agora com a prova), `pedido-nota.test.ts`, `retencao.test.ts` e `retrato-thiago` (descrições não mudaram).

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/agente/prova.ts apps/trabalhador/src/agente/ferramentas.ts apps/trabalhador/src/retencao.ts apps/trabalhador/test/producao/evidencia.test.ts
git commit -m "feat(agente): a demanda de nota abre junto com a prova da confirmação do cliente, com guarda própria (integridade, D16, D17)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Painel. A prova na linha do tempo, Ensinar com origem, Apagar orientação e a guarda das provas (D16, D17, D19)

**Files:**
- Modify: `apps/painel/src/lib/linha-do-tempo.ts`, `apps/painel/src/app/(painel)/treinar-agente/acoes.ts`, `apps/painel/src/app/(painel)/treinar-agente/editor-orientacao.tsx`, `apps/painel/src/app/(painel)/atendimento/[id]/ensinar-agente.tsx`, `apps/painel/src/app/(painel)/configuracoes/secoes/integracoes.tsx`, `apps/painel/src/app/(painel)/configuracoes/acoes.ts`
- Create: `apps/painel/src/lib/linha-do-tempo-evidencia.test.ts`, `apps/painel/src/app/(painel)/configuracoes/secoes/guarda-evidencias.tsx`, `apps/painel/e2e/evidencia-lgpd.spec.ts`

**Interfaces:**
- Consumes: as funções da Task 13.
- Produces: `fraseDoEvento` com `case 'confirmacao_cliente'`; `apagarOrientacao(id: string, voltar: string)` e `salvarGuardaEvidencias(formData)` (server actions); `ensinarAgente` lê `conversa_id`.

- [ ] **Step 1: Escreva o teste que falha** — `apps/painel/src/lib/linha-do-tempo-evidencia.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fraseDoEvento } from './linha-do-tempo';

describe('linha do tempo: a prova da confirmação (D16)', () => {
  it('ator Cliente, ação "confirmou o pedido", detalhe com o que confirmou', () => {
    const f = fraseDoEvento({ tipo: 'confirmacao_cliente', texto: 'Cliente confirmou o pedido pelo WhatsApp em 02/11/2026 10:00',
      dados: { confirmacao: 'confirmo', resumo_enviado: '2 caixas de pão' } } as never, 'agente');
    expect(f.ator).toBe('Cliente');
    expect(f.acao).toBe('confirmou o pedido (prova guardada)');
    expect(f.detalhe).toContain('confirmo');
  });
});
```

(Confira o tipo `EventoDemanda` e se ele já traz `dados`; se não, acrescente `dados?: Record<string, unknown> | null` ao tipo e ao `select` que monta a linha do tempo — `grep -rn "chamado_eventos" apps/painel/src/lib`.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/linha-do-tempo-evidencia.test.ts`
Expected: FAIL (cai no `default`).

- [ ] **Step 3: Implemente**

(a) `linha-do-tempo.ts`, antes do `default`:

```ts
    case 'confirmacao_cliente': {
      // D16 (integridade): a prova de que o cliente confirmou; o detalhe é o que ele escreveu.
      const d = (e.dados ?? {}) as { confirmacao?: string };
      return { ator: 'Cliente', acao: 'confirmou o pedido (prova guardada)', detalhe: d.confirmacao ? `“${d.confirmacao}” · ${e.texto ?? ''}`.trim() : e.texto };
    }
```

(b) `treinar-agente/acoes.ts`, em `ensinarAgente`: leia `conversa_id` do `formData`; se for um uuid, troque `gravarOrientacao(sb, null, d.data)` por:

```ts
    const conversa = formData.get('conversa_id');
    // D19 (LGPD): a orientação guarda de qual contato veio; anonimizar o contato mascara o texto dele aqui.
    const r = typeof conversa === 'string' && ehUuid(conversa)
      ? await sb.rpc('ensinar_agente_da_conversa', { p_conversa: conversa, p_titulo: d.data.titulo, p_texto: d.data.texto, p_tipo: d.data.tipo,
          p_cliente_id: d.data.clienteId ?? undefined, p_setor_id: d.data.setorId ?? undefined, p_ativo: d.data.ativo })
      : null;
    if (r?.error && r.error.code !== 'PGRST202') throw avisoDoBanco(r.error, 'falha ao salvar a orientação', FALHA_SALVAR);
    // Banco sem a migração (PGRST202): o caminho de antes.
    const id = r && !r.error ? (r.data as string) : await gravarOrientacao(sb, null, d.data);
```

e acrescente:

```ts
/** D19 (LGPD): apaga a orientação e as versões; o banco confere quem pode e grava a auditoria (sem o texto). */
export async function apagarOrientacao(id: string, voltar: string) {
  const destino = destinoDaTela(voltar);
  await comAvisoDeErro(destino, async () => {
    const sb = await exigirTreinar();
    if (!ehUuid(id)) throw new AvisoTreinar('Orientação não encontrada.');
    const { error } = await sb.rpc('apagar_orientacao', { p_id: id });
    if (error) throw avisoDoBanco(error, 'falha ao apagar a orientação', 'Não foi possível apagar a orientação.');
    revalidatePath('/treinar-agente'); revalidatePath('/agentes', 'layout');
    redirect(comOrientacao(destino, { orientacao: null }));
  });
}
```

(c) `atendimento/[id]/ensinar-agente.tsx`: o formulário ganha `<input type="hidden" name="conversa_id" value={conversaId} />` (o componente já recebe a conversa; use a prop que existir).

(d) `treinar-agente/editor-orientacao.tsx`: na orientação **existente** (não na nova), um botão **"Apagar orientação"** com o `ConfirmDialog` que a tela já usa (`@/components/patterns/confirm-dialog`): título "Apagar esta orientação?", descrição "A orientação e o histórico dela somem. Fica só o registro de quem apagou.", confirmar "Apagar orientação", variante `danger`, ação `apagarOrientacao.bind(null, id, voltar)`. Só aparece para quem pode treinar (a tela já sabe).

(e) `configuracoes/secoes/guarda-evidencias.tsx` (siga `guarda-tarefas.tsx` como modelo de cartão, formulário e "só o dono" — revisão P2-14): cartão "Prova da confirmação do pedido de nota", descrição "Quando o cliente confirma um pedido de nota pelo WhatsApp, o resumo e a confirmação ficam guardados na demanda, mesmo depois que as mensagens são apagadas (1 ano). Escolha por quanto tempo guardar a prova.", um `Select` de 1, 2, 3, 5 (sugerido), 7 e 10 anos e, ao trocar a escolha, a linha "Com este prazo, N provas guardadas seriam apagadas na limpeza desta noite." (lida de `provas_que_sairiam`, só quando N > 0, com ícone de alerta; revisão P2-14), botão "Salvar guarda". Quem não é o dono vê o seletor desligado com o selo "só o dono". `salvarGuardaEvidencias` em `configuracoes/acoes.ts` chama `salvar_guarda_evidencias`. Sem a coluna (`PGRST204`/`42703` ao ler), o cartão mostra "A guarda das provas aparece quando a atualização do banco for aplicada." Em `integracoes.tsx`, o cartão entra logo depois do da guarda dos arquivos das tarefas.

`apps/painel/e2e/evidencia-lgpd.spec.ts`:
1. **prova na demanda:** demanda com um evento `confirmacao_cliente` (insert direto, com `dados.confirmacao = 'confirmo'`) → a linha do tempo mostra "confirmou o pedido (prova guardada)" e "“confirmo”".
2. **Ensinar com origem:** a pessoa que treina abre uma conversa no Atendimento → "Ensinar o agente" → escreve o "O que fazer" → salvar → `orientacoes_agente.contato_origem_id` = o contato da conversa.
3. **Apagar orientação:** abre a orientação em Treinar o agente → "Apagar orientação" → confirma → some da lista; `auditoria_acessos` tem `apagar` com o título.
4. **guarda das provas (revisão P2-14):** o **dono** em Configurações › Integrações; com uma prova de 3 anos no banco, escolhe 1 ano → aparece "Com este prazo, 1 prova guardada seria apagada…"; escolhe 7 anos → salvar → `configuracoes.retencao_evidencias_anos = 7`; um **administrador que não é o dono** vê o seletor desligado com "só o dono".
5. axe sem violações na demanda e em Integrações.

- [ ] **Step 4: Rode** (Supabase local; `supabase db reset`; memória ≥ 4 GB)

```bash
pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck
cd apps/painel
pnpm exec playwright test e2e/evidencia-lgpd.spec.ts e2e/treinar-agente.spec.ts --workers=1
pnpm exec playwright test e2e/configuracoes-secoes.spec.ts e2e/demanda-detalhe.spec.ts --workers=1
```

(Use os nomes reais dos e2e de Treinar o agente, de Configurações e do detalhe da demanda: `ls apps/painel/e2e | grep -i "treinar\|ensinar\|demanda\|configuracoes"`; rode em lotes de 2 todos os que tocam essas telas.) Expected: PASS; os antigos sem mudança.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`)

```bash
git add apps/painel/src/lib/linha-do-tempo.ts apps/painel/src/lib/linha-do-tempo-evidencia.test.ts "apps/painel/src/app/(painel)/treinar-agente/acoes.ts" "apps/painel/src/app/(painel)/treinar-agente/editor-orientacao.tsx" "apps/painel/src/app/(painel)/atendimento/[id]/ensinar-agente.tsx" "apps/painel/src/app/(painel)/configuracoes/secoes/guarda-evidencias.tsx" "apps/painel/src/app/(painel)/configuracoes/secoes/integracoes.tsx" "apps/painel/src/app/(painel)/configuracoes/acoes.ts" apps/painel/e2e/evidencia-lgpd.spec.ts
git commit -m "feat(painel): prova da confirmação na linha do tempo, Ensinar com origem, Apagar orientação e a guarda das provas (integridade, D16, D17, D19)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Manuais

**Files:**
- Modify: `docs/producao.md`, `docs/operacao.md`

- [ ] **Step 1: `docs/operacao.md`** — seção nova "## 12. Dados que não podem ficar errados" com: preço (o aviso "Alguém mudou este preço…", recarregar, o agente confirma de novo com o cliente quando o preço muda no meio — D10–D12); correção de pedido pelo assistente (tudo ou nada; prévia que não chegou pelo WhatsApp precisa ser mostrada de novo — D13, D14); a **prova da confirmação** na linha do tempo da demanda (o que guarda, por quanto tempo, onde mudar o prazo, por que fica mesmo depois de anonimizar o contato — D16–D18); **LGPD do treino** (Ensinar o agente guarda a origem; anonimizar mascara as falas do cliente nas orientações; Apagar orientação — D19, D20).
- [ ] **Step 2: `docs/producao.md`** — no checklist, "Configurações › Integrações › Prova da confirmação: conferir o prazo com o contábil/jurídico (D17)".
- [ ] **Step 3: Commit**

```bash
git add docs/operacao.md docs/producao.md
git commit -m "docs: dados que não podem ficar errados — preço, correção de pedido, prova da confirmação e LGPD do treino (integridade)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx, **a vez reservada em `.vez-supabase.txt`**, e **`supabase db reset`** antes da suíte pgTAP, antes do primeiro lote de e2e e antes dos cenários:
   - **o que não podia mudar não mudou:** `git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__ apps/trabalhador/src/agente/prompt.ts apps/trabalhador/src/envio.ts apps/trabalhador/src/canal/zapi.ts` **vazio**; `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff BASE --stat -- supabase/tests` = só `81`, `82`, `83` (novos); `git diff BASE --stat -- supabase/migrations` = só `20261101000{200,300,400}` (novos); `git diff BASE --stat -- 'apps/**/*.test.ts' 'packages/**/*.test.ts' apps/painel/e2e` = só **novos**; `git grep -n "AMBIENTE=producao\|SAUDE_TOKEN=\|BACKUP_CHAVE=" -- ':!*.example' ':!docs'` não mostra valor real;
   - `supabase test db`: todos, com os números, inclusive `22` (100/100), `80`, `81` (5/5), `82` (17/17), `83` (25/25) e os de `anonimizar_contato`;
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`; `pnpm --filter @escritorio/trabalhador test` e `typecheck`; `pnpm --filter @escritorio/painel test` e `typecheck`; `pnpm exec vitest run scripts/producao` (na raiz) e `TESTAR_BACKUP=1 pnpm exec vitest run scripts/producao/backup-local.test.ts`;
   - **e2e em lotes de até 2 arquivos** (`--workers=1`; memória ≥ 4 GB antes de **cada** lote): primeiro os lotes das Tasks 10 e 15; depois todos os de `ls apps/painel/e2e/*.spec.ts`, em ordem alfabética (`supabase db reset` antes do primeiro e a cada 5 lotes). Processo morto → **pare**, devolva `config.toml`/`.env`, libere a vez e avise;
   - **cenários com Claude de verdade, uma rodada** (o pedido de nota, o preço e o assistente mudaram; `supabase db reset` antes; memória ≥ 4 GB; custo anotado): `pnpm --filter @escritorio/trabalhador cenarios`, `cenarios-assistente`, `cenarios-atendimento`. Falha nova em cenário de **preço**, **pedido de nota** ou **assistente** → rode de novo só ele; falhou de novo → pendência com a saída inteira. Teto: US$ 15;
   - **`docker build`** dos dois (Task 5, Step 6), se a memória deixar (D6); senão, pendência com o motivo;
   - mostre os números exatos de cada suíte, lote e rodada e o custo. Nada de "deve passar";
   - **volta sem as migrações:** num banco local sem `20261101000{200,300,400}_*.sql` (mova para o rascunho e `supabase db reset`), confira: trabalhador `test/producao/saude.test.ts` passa (fila = 0); o painel abre a tabela de preços e **salvar** cai no aviso do banco (a função conferida não existe) — **anote**: o painel novo **precisa** da migração `…300` aplicada junto (o dono aplica tudo junto, item 3); Ensinar o agente usa o caminho de antes (`PGRST202`); Configurações › Integrações mostra a faixa; depois devolva os arquivos e `supabase db reset`;
   - ao terminar, devolva `config.toml` e `.env`, confira `git status` e apague `.vez-supabase.txt` se a linha for desta worktree.
2. **Capturas** (1366 e 1920, claro e escuro, `next dev -p 3107`, banco local): a tabela de preços com o aviso de conflito e o valor digitado; a linha do tempo com a prova; o editor de orientação com "Apagar orientação"; Integrações com a guarda das provas. Em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\prontidao\`, nomes `pront-<tela>-<largura>-<tema>.png`.
3. **Homologação e produção: nada é rodado.** Deixe por escrito para o dono: as três migrações só acrescentam (uma função de leitura; duas funções de preço novas e uma de correção; uma coluna e um índice único parcial; uma coluna e um tipo de evento; uma coluna em `configuracoes`; uma coluna em `orientacoes_agente`; três funções; `anonimizar_contato` com o corpo trocado); a ordem é aplicar **junto** com as pendentes da Parte I e do plano de confiabilidade; o painel novo **depende** da `…300` (preço); o trabalhador novo funciona sem elas.
4. **Trabalhador: NÃO suba nenhum.** Entregue "pronto para trocar", com o aviso da D2: **antes de trocar o da porta 3001, o dono põe `TELEFONES_PERMITIDOS` (o número dele e os de teste) no arquivo de variáveis da homologação**; sem isso, nada sai. Roteiro curto do §7 da análise (Prompts 2 e 3): parar o trabalhador → o monitor avisa; mandar mensagem a um número fora da lista → bloqueado e registrado (`decisoes_agente` etapa `envio_bloqueado`); duas abas mudando o mesmo preço → a segunda recebe o aviso; responder "sim" a uma prévia que não chegou → não grava.
5. **Pendências para listar no fim:**
   - **as decisões a confirmar com o dono:** D23 (produção vazia ou cópia da homologação; tirar o número do escritório da Z-API da homologação antes de ligar a produção), D2 (variável de ambiente, `AMBIENTE` obrigatório; pôr `AMBIENTE` e a lista no `.env.homologacao` antes de trocar o trabalhador, senão ele não sobe), D22 (recuperação das mensagens que chegam com o trabalhador fora), D4 (token do webhook se a Z-API dele oferecer), D8 (PITR pago; a cópia semanal no GitHub Actions ou no computador dele, e por quanto tempo), D9 (qual monitor e se paga o intervalo de 1 min), D17 (prazo da prova: 5 anos, com o contábil/jurídico; só o dono muda), D18 (a prova fica depois de anonimizar, sem nome e telefone — com o jurídico), D19 (mascarar e desligar, ou apagar as orientações do titular);
   - **o que o dono precisa providenciar:** marcar o dono na produção depois do primeiro administrador; a conta do monitor (dois monitores: trabalhador e painel) e o Telegram; os segredos da cópia no ambiente `producao` do GitHub (se aceitar a proposta); a `BACKUP_CHAVE` guardada fora do computador; a chave da Anthropic só da produção com limite; a decisão do PITR; o "ok" para aplicar as migrações;
   - o que não foi testado aqui e por quê (o `docker build`, se ficou; a restauração na nuvem, que é pelo painel do Supabase);
   - **ordem das versões** (seção "Integração e versão"): Parte I inteira antes das `20261101…`, um `--dry-run` único, a tag;
   - **conflitos esperados com a Parte I:** `principal.ts`, `config.ts`, `servidor.ts`, `agente/ferramentas.ts` (`alterar_preco`, `resumir_pedido_nota`, `abrir_pedido_nota`), `assistente/*`, `retencao.ts`, `linha-do-tempo.ts`, `treinar-agente/acoes.ts`, `integracoes.tsx`;
   - o que fica para o Prompt 4 (estado ao vivo para todos, cache de prompt, toasts) e para o plano do CNPJ.
6. **Não juntar** a branch em nada. **Parar** ao fim e esperar o dono ver.
