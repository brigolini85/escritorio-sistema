# Confiabilidade do agente de clientes (Prompt 1 da análise de arquitetura). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** nenhuma mensagem de cliente fica **sem resposta E sem pessoa responsável**, mesmo quando a IA falha. (1) Primeiro, **diagnóstico**: rodar os cenários com Claude de verdade 3 vezes, registrar cada falha e classificar a causa em `docs/relatorios/falhas-agente.md`; cada causa que for do código ganha um teste que a reproduz e a correção. (2) **Modo seguro** quando a IA não responde: erro passageiro tenta de novo (como hoje); erro definitivo (saldo da Anthropic acabou, chave recusada, tentativas esgotadas, exceção no código) manda ao cliente **uma** mensagem curta e fixa **no máximo uma vez a cada 4 horas por conversa**, deixa a conversa com a equipe (triagem sem responsável, "esperando pessoa") e **avisa** a equipe; nunca texto técnico ao cliente. (3) **Registro de cada falha** numa tabela nova `falhas_agente` (só o administrador lê) e o número **"falhas do agente hoje"** no Início. (4) **Fila que não trava:** prazo explícito no job de conversa, número de conversas em paralelo configurável e o batimento devolvendo à fila a conversa cuja mensagem ficou parada.

**O que já existe e não muda (conferido no código em `fa76a76`):**
- **Webhook idempotente:** `mensagens.id_provedor text unique` (`20260927000200_atendimento.sql:37`) + `inserirMensagemEntrada` com `upsert … ignoreDuplicates` (`packages/db/src/repos.ts:267-279`); o servidor só agenda quando `!duplicada` (`apps/trabalhador/src/servidor.ts:54`); teste `servidor.test.ts:39` ("o mesmo webhook entregue duas vezes grava e agenda uma vez só"). Este plano só **acrescenta** o teste da reentrega **depois** de a mensagem já ter sido processada (D9).
- **Nova tentativa em erro passageiro:** `erroTemporarioIa` (`agente/cliente-ia.ts:16-20`: conexão, 429, ≥ 500 — inclui 529) relança o job se a IA falhou **antes** de qualquer ação e não é a última tentativa (`processar-conversa.ts:222`). O SDK já tenta 2 vezes por chamada respeitando `retry-after` (`maxRetries: 2`, `timeout: 60_000`) e a fila tenta 3 vezes com espera crescente (`fila.ts:43`).
- **Passagem para pessoa na falha:** `encaminharParaHumano` (triagem sem setor e sem responsável) + mensagem `mensagens.ia_indisponivel` + `marcarPassagem(MOTIVOS_PASSAGEM.falha)` (`processar-conversa.ts:220-231`).
- **Paralelismo:** 4 consumidores de `processar-conversa` com política `stately` (1 por conversa) (`principal.ts:59-64`).
- **O segredo do webhook não vai ao log** (`servidor.ts:22-25`; é do Prompt 2, fica como está).

**O que falta (e este plano faz):** classificar a falha; saldo e chave sem repetir chamadas (e sem pagar o tempo de espera em cada conversa nova); limite de 1 mensagem a cada 4 h (hoje só olha as 5 últimas mensagens); alerta à equipe (hoje nenhum); registro das falhas e o número no Início; prazo do job; conversa com mensagem parada quando o job some ou falha por erro de banco; o diagnóstico dos cenários.

**Arquitetura:**
- **Banco (1 migração nova, só acréscimos):** `20261101000100_confiabilidade_agente.sql`: tabela `falhas_agente` (RLS: só o administrador lê; o trabalhador grava com a chave de serviço, como `decisoes_agente`); coluna `conversas.modo_seguro_em`; funções `reservar_modo_seguro(p_conversa, p_horas)` (só `service_role`; reserva atômica "1 a cada N horas"), `falhas_agente_hoje(p_agora)` (só administrador) e `conversas_com_mensagem_parada(p_de_min, p_ate_min)` (só `service_role`). pgTAP `80_confiabilidade_agente.test.sql`. `tipos.gen.ts` regerado.
- **Repositório (`@escritorio/db`):** `registrarFalhaAgente`, `reservarModoSeguro`, `falhaDefinitivaRecente`, `conversasComMensagemParada`; `limparBanco` limpa `falhas_agente`.
- **Trabalhador:** `agente/cliente-ia.ts` ganha `tipoFalha` e `resumoDoErro` (sem tocar em `erroTemporarioIa`); arquivo novo `src/modo-seguro.ts` (`entrarEmModoSeguro`); `processar-conversa.ts` usa o modo seguro no `catch` e no teto, e o **disjuntor** de saldo/chave; `fila.ts` (prazo do job), `config.ts` (`CONCORRENCIA_AGENTE`), `principal.ts`, `tarefas.ts` (`batimento` devolve à fila a conversa parada; acima de 30 min, modo seguro); `cenarios/diagnostico.ts` e `cenarios/relatorio-falhas.ts` (novos) e o registro opcional em `cenarios/rodar.ts`.
- **Painel:** `lib/falhas-agente.ts` (leitura e texto), `inicio/dados-situacao.ts` (`lerFalhasAgente`), `inicio/cartao-agente.tsx` (a linha "N falhas do agente hoje"), `configuracoes/secoes/mensagens.tsx` (a ajuda do campo "IA indisponível").
- **Relatório:** `docs/relatorios/falhas-agente.md` (novo).

**Tecnologias:** TypeScript, Node 22, Fastify, pg-boss 10, `@anthropic-ai/sdk` 0.110, Supabase (Postgres 17, RLS), Next.js 15, Vitest, pgTAP, Playwright. **Nenhuma dependência nova.**

**Spec:** `docs/superpowers/specs/painel-v2/analise-arquitetura.md`:
- **§3, linhas 1, 5 e 10** da tabela de diagnóstico (falha 1 em 25, webhook repetido, concorrência);
- **§6, "Prompt 1 — Confiabilidade do agente de clientes"** inteiro (O QUE FAZER 1–7, REGRAS, CRITÉRIOS DE ACEITE, FORA DO ESCOPO);
- **§7, "Prompt 1"** (como o dono valida depois).
- Dependências: spec 7A.2 (motivos da passagem, `packages/core/src/passagem.ts`), 7B.2 (`uso_ia`), 7C.1 (Início), 4.6 (tom dos textos).

**Onde trabalhar:** worktree nova `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/producao-confiabilidade`, branch `producao-confiabilidade`, criada **a partir da ponta da branch `planos-producao`** (que é `fa76a76` + estes planos): `git worktree add .claude/worktrees/producao-confiabilidade -b producao-confiabilidade planos-producao`. **Antes da Task 1, anote o SHA de partida:** `git rev-parse --short HEAD` → chamado de **BASE** abaixo. Todos os comandos rodam a partir da raiz da worktree. **A base é decisão do dono (a confirmar, D15):** a Parte I segue em outra branch; se o dono preferir esperar a I5 e partir dela, troque `planos-producao` pela ponta da branch da Parte I e confira os números das migrações (Restrições globais).

## Escopo: Prompt 1 inteiro, 9 tasks

1. classificar a falha da IA (Task 1);
2. diagnóstico dos cenários e o relatório (Task 2, **antes** de qualquer correção de comportamento; as correções de código que o relatório apontar entram na Task 8);
3. banco e repositório (Tasks 3 e 4);
4. modo seguro, disjuntor e alertas (Task 5);
5. fila, paralelismo, mensagem parada e o teste do webhook (Task 6);
6. "falhas do agente hoje" no Início e a ajuda do campo (Task 7);
7. as correções que o diagnóstico apontar (Task 8);
8. manual (Task 9).

**Fora do escopo** (Prompt 1, "FORA DO ESCOPO"): agentes por setor, montagem da produção (Plano `2026-10-21-prontidao-producao.md`), mudanças visuais do painel além da linha do Início e da ajuda do campo. **Não mexe em `prompt.ts` nem nas regras fixas do agente** (Prompt 1, REGRAS).

## Decisões tomadas (sem o dono)

Conferi no código o que a análise supõe. A análise foi escrita a partir de um retrato de 01/10; várias coisas que ela pede já existem (lista acima). Onde a análise e o código não batem, o plano segue a decisão abaixo. **"A confirmar com o dono"** = decisão de produto: o plano segue a proposta, e o dono pode trocar antes da task indicada.

| # | Decisão (o que o plano faz) | Alternativa | Por que não | Tasks |
|---|---|---|---|---|
| D1 | **A mensagem do modo seguro é a que já existe: `configuracoes.mensagens.ia_indisponivel`** (Configurações › Mensagens automáticas › "IA indisponível"; hoje "Recebemos sua mensagem, já vamos te atender."). A ajuda do campo passa a dizer quando ela vai. Vazio = não manda nada (como o aviso de privacidade). **Fora do expediente** (revisão P1-5), o modo seguro manda a mensagem de **"Fora do horário"** (`mensagens.fora_do_horario`, com `{inicio}` e `{fim}` trocados pelo expediente), para não prometer atendimento que ninguém vai dar de madrugada. **A confirmar com o dono:** manter o texto atual ou trocar para o da análise ("Recebi sua mensagem. Já vou verificar e te retorno."), e se fora do expediente vale a de "Fora do horário" (proposta: sim). | Chave nova `mensagem_modo_seguro` (análise, Prompt 1, 3b). | Seriam dois textos para a mesma situação ("a IA não respondeu"); o dono já edita este. | 5, 7 |
| D2 | **No máximo 1 mensagem do modo seguro a cada 4 horas por conversa**, pela reserva atômica `reservar_modo_seguro` (coluna `conversas.modo_seguro_em`); vale para **falha** e **teto** (os dois são "a IA não está respondendo"). A escalada que o próprio agente decide (recusa, terminou sem responder, limite de passos) continua como hoje (a conferência das 5 últimas mensagens em `encaminharParaHumano`). **A confirmar com o dono:** o prazo de 4 h. | Contar só as últimas 5 mensagens (hoje). | Num dia de saldo esgotado, o cliente que manda 6 mensagens recebe o aviso mais de uma vez. | 3, 5 |
| D3 | **Tentativas:** ficam as que existem — 2 do SDK por chamada (respeitam `retry-after`) e 3 da fila com espera crescente a partir de 20 s. A análise pede "3 tentativas, 2 s/8 s/30 s": o efeito já existe (SDK em segundos, fila em dezenas de segundos). **Muda só o prazo do job:** `expireInSeconds: 900` explícito em `processar-conversa` (hoje vale o padrão do pg-boss, que pode mudar numa atualização). | Escrever um laço próprio de novas tentativas. | Duplicaria o que o SDK faz e somaria esperas. | 6 |
| D4 | **Tipos de falha** (`tipoFalha` em `agente/cliente-ia.ts`): `passageiro` (conexão, tempo esgotado, 429, ≥ 500, 529), `saldo` (mensagem da API com "credit balance" ou "billing"), `chave` (401, 403), `pedido_invalido` (outros 400: `tool_use` sem resultado, JSON inválido), `envio` (erro da Z-API), `codigo` (qualquer outra exceção: erro dentro de ferramenta, banco). `erroTemporarioIa` **não muda** (testes antigos usam). | Ler só `status`. | O saldo esgotado chega como 400, igual a um pedido inválido; só a mensagem separa. | 1 |
| D5 | **Disjuntor de saldo e chave:** depois de uma falha `saldo` ou `chave` registrada há menos de **10 minutos**, a conversa nova vai **direto** ao modo seguro **sem chamar a IA** (não espera 3 tentativas a cada mensagem, não gera 50 falhas iguais). Passados 10 min, a próxima mensagem tenta a IA de novo (o dono pode ter recarregado). O Assistente e as tarefas de trabalho, ao falhar por `saldo`/`chave`, registram a falha e disparam o mesmo alerta (revisão P1-4b), para o dono saber mesmo sem cliente escrevendo. **A confirmar com o dono:** os 10 min (revisão P1-4a; a sonda automática foi recusada, ver a seção da revisão). | Tentar a IA em toda mensagem. | Cada mensagem esperaria e falharia de novo; o alerta e o registro virariam ruído. | 4, 5 |
| D6 | **Alertas:** `saldo` e `chave` → nível **`operacional`** (e-mail de alertas + WhatsApp do dono, `alertas.ts`), texto fixo, **no máximo 1 a cada 30 min** (`alertaRecente`, como o WhatsApp desconectado); demais falhas definitivas → nível **`aviso`** (Início) para o **setor conhecido** da conversa (o agente que conduz, ou a demanda aberta mais recente da conversa com setor), sem setor = administrador; 1 por conversa a cada 4 h (vai junto da reserva da D2). **A confirmar com o dono:** quem recebe e por qual canal (a análise diz "admin e atendentes do setor"). | Alerta crítico (só e-mail). | O dono quer saber na hora que o saldo acabou; o WhatsApp do dono sai pela Z-API, que segue funcionando quando a Anthropic cai. | 5 |
| D7 | **Tabela `falhas_agente`** (e não `decisoes_agente`): tipo, etapa (`ia`, `ferramenta`, `envio`, `outro`), tentativa, última tentativa, erro resumido (até 300 caracteres, **sem texto do cliente**: só nome da classe, status e a primeira linha da mensagem do erro), modelo, conversa, empresa, agente, e o que o sistema fez (`tentar_de_novo`, `modo_seguro`, `modo_seguro_sem_mensagem`). **Só o administrador lê** (RLS); ninguém grava pela API (o trabalhador grava com a chave de serviço). **Guarda de 1 ano**, junto da retenção das conversas (`retencao.ts`). **A confirmar com o dono:** o prazo de guarda. | `decisoes_agente`. | `decisoes_agente` conta como "o agente já agiu" (`contarDecisoesDesde`) e decide a nova tentativa; misturar quebraria essa regra. | 3, 4, 5 |
| D8 | **"Falhas do agente hoje" no Início**, só no **Painel de situação** (o administrador): uma linha sob os três números do cartão do agente, "N falhas do agente hoje" (só as que **não** se resolveram: `ultima = true`, revisão P1-7) e, quando houver, "· M por saldo ou chave da IA" e "· instabilidade: K" (as novas tentativas), com o ícone de alerta (vermelho nunca sozinho; só a instabilidade não deixa vermelho). Zero = "Nenhuma falha do agente hoje". Sem a migração, a linha não aparece. **A confirmar com o dono:** se atendentes também devem ver (a análise põe o estado ao vivo para todos no Prompt 4). | Um quarto número no `dl` de 3 colunas. | Mudaria a grade que os e2e do Início conferem. | 7 |
| D9 | **Webhook:** já é idempotente (acima). Só **acrescenta** o teste da reentrega **depois** de processada (o caso real: a Z-API reenvia minutos depois). Nenhum código muda. | Índice novo. | Já existe `unique`. | 6 |
| D10 | **Paralelismo:** já são 4 conversas ao mesmo tempo (1 por conversa). Vira a variável de ambiente **`CONCORRENCIA_AGENTE`** (padrão **4**, aceita 1 a 8) em `config.ts`, e não uma coluna em `configuracoes` (a análise sugere `configuracoes.concorrencia_agente`): o número de consumidores só muda ao ligar o trabalhador, e a máquina tem pouca memória. | Coluna em `configuracoes`. | Mudar no painel sem reiniciar não teria efeito e enganaria o dono. | 6 |
| D11 | **Mensagem parada (refeita na revisão P1-2/P1-8):** o `batimento` (a cada minuto) olha as conversas com o agente que têm mensagem de cliente **não processada há mais de 3 min e menos de 24 h**. (1) Se o lote já teve ação do agente (D16), só marca como processadas. (2) Senão, se o lote foi devolvido à fila **menos de 2 vezes** e a última devolução foi há mais de 3 min, devolve de novo e marca (`mensagens.reenfileirada += 1`, `reenfileirada_em`). (3) Com **2 devoluções** e a última há mais de 5 min, faz o **modo seguro** (D1, D2) com o tipo `codigo` e marca as mensagens como processadas. Depois de uma queda longa, a primeira coisa é tentar de novo, não o modo seguro. Conversa com a equipe (`estado = 'humano'`) fica de fora; mensagem com mais de 24 h, também (sobra antiga). | Só alertar; ou modo seguro pela idade. | Alerta sem triagem deixa a conversa sem dono; idade sozinha manda ao modo seguro o que a IA atenderia. | 3, 4, 6 |
| D16 | **Lote já atendido (revisão P1-1):** antes de chamar a IA, `processarConversa` grava em `decisoes_agente` a etapa **`lote`** com `{ mensagens: [ids] }` e o turno da vez; e, **antes disso**, confere se algum `lote` anterior com **exatamente** estas mensagens teve ação do agente no mesmo turno (qualquer decisão do turno fora `lote` e `orientacoes_cortadas`). Se teve (o trabalhador caiu depois de agir e antes de `marcarProcessadas`), só marca como processadas e devolve o desfecho novo `ja-atendido`, sem chamar a IA nem mandar nada. `contarDecisoesDesde` passa a ignorar `lote` (a regra da nova tentativa continua igual). O batimento (D11) usa a mesma conferência. | Conferir só pela idade. | Repetiria resposta, demanda e pedido de nota. | 3, 4, 5, 6 |
| D12 | **Exceção dentro de ferramenta ou erro de envio** depois de o agente já ter agido: **não** tenta de novo (relançar repetiria ferramentas, regra de hoje); vai ao modo seguro com o tipo `codigo` ou `envio`. Se a própria mensagem do modo seguro falhar (Z-API fora), a triagem e o alerta acontecem do mesmo jeito e a falha fica com `modo_seguro_sem_mensagem`. | — | — | 5 |
| D13 | **Diagnóstico antes de corrigir:** 3 rodadas completas de `pnpm --filter @escritorio/trabalhador cenarios` com o registro ligado (`CENARIOS_DIAGNOSTICO=<arquivo .jsonl>`); o relatório separa **falha técnica** (exceção, erro da API, erro de envio) de **falha de comportamento** (o modelo fez diferente do esperado). **Só falha técnica e defeito de código são corrigidos aqui (Task 8).** Falha de comportamento cuja correção exigiria mudar `prompt.ts` ou as regras fixas vira **pendência para o dono** (Prompt 1, REGRAS: não mudar o prompt); a correção sugerida pode ser uma **orientação** em Treinar o agente, que o dono aprova. **A confirmar com o dono:** se aceita mudar o prompt para as falhas de comportamento. | Corrigir o prompt direto. | A análise proíbe; e o prompt tem retratos (`test/agente/__retratos__`) que travam o pedido do Thiago. | 2, 8 |
| D14 | **Custo dos cenários com Claude de verdade:** diagnóstico 3 rodadas (≈ US$ 8–12) + Entrega 3 rodadas (≈ US$ 8–12) + as reexecuções da Task 8. **Teto: US$ 30** neste plano; passou, parar e listar como pendência. | — | — | 2, 8, Entrega |
| D15 | **Base da branch** (a confirmar com o dono): `planos-producao` (= `fa76a76`, com I3b). As migrações deste plano começam em `20261101000100` para ficar **depois** das que a Parte I ainda vai criar (I4, I5 usam `202610180…` a `202610310…`). Se a Parte I criar uma migração com número maior que `20261101000100` antes deste plano ser juntado, **pare** e avise. | Partir da Parte I depois da I5. | O dono ainda não juntou a Parte I; esperar atrasaria a produção. | todas |

## Revisão crítica de 06/10 (sessão agentesdeia-ab) — decisões

Arquivo da revisão: `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\REVISAO-PLANOS-PRODUCAO.txt`. Cada achado do plano 1 e o que foi feito neste plano:

| Achado | Gravidade | Decisão | O que mudou |
|---|---|---|---|
| P1-1 resposta e ferramentas em dobro quando o trabalhador cai entre agir e marcar como processada | alta | **Aceito** | D16 (nova): no começo de cada vez o trabalhador grava a decisão `lote` com os ids das mensagens e o turno; antes de chamar a IA, e no batimento, confere se aquele lote já teve ação do agente (decisão com o mesmo turno, fora `lote`/`orientacoes_cortadas`): se teve, só marca como processadas, sem responder. `contarDecisoesDesde` passa a ignorar `lote` (senão a nova tentativa em erro passageiro nunca mais aconteceria). Tasks 3, 4, 5, 6 (teste "respondeu e caiu antes de marcar"). |
| P1-2 depois de uma queda longa, tudo vai direto ao modo seguro | média | **Aceito** | D11 refeita: a idade não manda ao modo seguro; o batimento devolve a conversa à fila até **2 vezes** (marcando `mensagens.reenfileirada` e `reenfileirada_em`); só depois de 2 devoluções sem sucesso (5 min depois da última) vai ao modo seguro. Depois de uma queda, a primeira coisa é tentar de novo. Tasks 3, 4, 6. |
| P1-3 custo dos cenários medido só no último cenário (`limparBanco` trunca `uso_ia`) | média | **Aceito** | Regras de ambiente: "Custo dos cenários" — cópia de `uso_ia` por gatilho num esquema de rascunho, somada no fim de cada rodada; o `.jsonl` da Task 2 continua por cenário. |
| P1-4 (a) 10 min sem tentar depois da recarga; (b) saldo acabando à noite sem cliente escrevendo não avisa | média | **Aceito em parte** | (b) aceito: o Assistente e as tarefas de trabalho, ao falhar por `saldo`/`chave`, também registram a falha e disparam o mesmo alerta (Task 5). (a) **recusado** a sonda a cada minuto: seria uma chamada paga fora de qualquer conversa, sem lugar em `uso_ia`, para ganhar no máximo 10 min; os 10 min viram decisão do dono (D5). |
| P1-5 "já vamos te atender" de madrugada | média | **Aceito como decisão do dono** | D1 ganha a pergunta: fora do expediente, usar a mensagem de "fora do horário" (que já existe) no lugar da de "IA indisponível". Proposta: **sim** (Task 5 implementa: fora do expediente, `mensagens.fora_do_horario` com `{inicio}`/`{fim}` trocados, como o agente já faz). |
| P1-6 erro de rede da Z-API vira `codigo`; corpo da resposta da Z-API no `erro` | baixa | **Aceito em parte** | O resumo do erro da Z-API para no status (`Z-API 500`), sem o corpo (Task 1). **Recusado** classificar pelo caminho: exigiria embrulhar todos os envios; a rede da Z-API fica como `codigo` e isso está dito no manual. |
| P1-7 o número do Início conta as tentativas que deram certo | baixa | **Aceito** | `falhas_agente_hoje` devolve `total` (só `ultima = true`), `instabilidade` (`tentar_de_novo`) e `conta`; o texto vira "2 falhas do agente hoje · 1 por saldo ou chave da IA · instabilidade: 7". Tasks 3, 7. |
| P1-8 reenfileirar a cada minuto por 30 min | baixa | **Aceito** | Junto com P1-2: no máximo 2 devoluções por lote. |
| P1-9 sem teste do aviso ao setor | baixa | **Aceito** | Teste novo na Task 5 (demanda aberta no Fiscal → aviso com o `setorId` do Fiscal). |

Os achados transversais do plano 2 que valem aqui: **P2-6** (ordem das migrações) → seção "Integração e versão" abaixo.

## Integração e versão (P2-6)

- **Ordem de junção:** Parte I completa (até a I5) → este plano (confiabilidade) → prontidão → CNPJ. Uma tag por versão (`v2026.11-<n>`) antes de qualquer `db push` na produção (diagnóstico 8 da análise).
- **Números:** as migrações deste plano (`20261101…`) são maiores que todas as da Parte I (`2026101x–2026103x`). **Nunca aplicar `20261101…` num banco que ainda não tem todas as da Parte I:** o `supabase db push` seguinte recusaria as da Parte I ("anteriores à última aplicada") e só passaria com `--include-all`. A Entrega deste plano não aplica nada; quem aplica (o dono) faz **um** `--dry-run` com a lista inteira (Parte I + estes) e confere a ordem.
- **Se a Parte I criar uma migração com número ≥ `20261101000100`** antes de este plano ser executado, **renumere** as deste plano para depois da última da Parte I no começo da execução (`git mv`, mesmo nome, só o número; o pgTAP idem a partir do maior `NN_` + 1) e anote na Entrega.

## Restrições globais

- **Só mexer em:** `supabase/migrations/20261101000100_confiabilidade_agente.sql` (**novo**), `supabase/tests/80_confiabilidade_agente.test.sql` (**novo**), `packages/db/src/repos.ts` (métodos e tipos **novos**; nenhum método existente muda de assinatura), `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão), `packages/db/test/limpar.ts` (só a limpeza da tabela nova), `packages/db/test/confiabilidade.test.ts` (**novo**), `apps/trabalhador/src/agente/cliente-ia.ts` (só acréscimos), `apps/trabalhador/src/modo-seguro.ts` (**novo**), `apps/trabalhador/src/processar-conversa.ts` (só o que a Task 5 diz), `apps/trabalhador/src/agente/atender.ts` (só o `turno` repassado, revisão P1-1), `apps/trabalhador/src/assistente/processar.ts` e `apps/trabalhador/src/tarefa/processar.ts` (só o registro de saldo/chave, revisão P1-4b), `apps/trabalhador/src/{fila,config,principal,tarefas,retencao}.ts` (só o que as Tasks 5 e 6 dizem), `apps/trabalhador/src/cenarios/{rodar,diagnostico,relatorio-falhas}.ts`, `apps/trabalhador/package.json` (só o script `cenarios-relatorio`), testes **novos** em `apps/trabalhador/test/confiabilidade/`, `apps/painel/src/lib/falhas-agente.ts` e `.test.ts` (**novos**), `apps/painel/src/app/(painel)/inicio/{dados-situacao.ts,cartao-agente.tsx}`, `apps/painel/src/app/(painel)/configuracoes/secoes/mensagens.tsx` (só a ajuda do campo), `apps/painel/e2e/inicio-falhas-agente.spec.ts` (**novo**), `docs/relatorios/falhas-agente.md` (**novo**), `docs/operacao.md`. A Task 8 pode mexer em outros arquivos **do trabalhador** que o relatório apontar, **nunca** em `apps/trabalhador/src/agente/prompt.ts`, `apps/trabalhador/src/agente/orientacoes-skill-dono.ts` nem nos retratos.
- **Testes de partes anteriores não mudam:** nenhum pgTAP de `01` a `54`; nenhum `*.test.ts` existente; nenhum e2e existente. Se um teste antigo quebrar por causa deste plano, **pare** e avise: é mudança de comportamento. Em especial `processar-conversa.test.ts:285` ("falha temporária da IA é relançada, exceto na última tentativa") e `:296` continuam passando sem mudança.
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` continua 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio. Nada entra no Realtime (a tabela nova fica fora do `supabase_realtime`). Nunca use `usuario_liberado` em código novo; use `eh_usuario_ativo`, `eh_admin`, `tem_permissao`, `eh_dono`.
- **O pedido do Thiago não muda:** `git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__ apps/trabalhador/src/agente/prompt.ts` sai **vazio** e `retrato-thiago.test.ts` passa. Se um retrato precisar mudar, **pare**.
- **Números novos:** migrações a partir de `20261101000100`; pgTAP a partir de `80_`. Antes de criar, `ls supabase/migrations | sort | tail -3` e `ls supabase/tests | sort | tail -3`: se já houver número igual ou maior (de outra branch juntada), **pare** e avise.

### Regras de ambiente (máquina com pouca memória)

- **Um Supabase local por vez, na máquina inteira.** O arquivo de vez é `C:\Users\Thiago\Desktop\PROJETO\AGENTESDEIA\.vez-supabase.txt` (fora do git, na raiz do repositório principal, não da worktree):
  1. **Antes de ligar** o Supabase local, leia o arquivo. Se ele existir e tiver uma linha de **outra** worktree, **não ligue**: espere, confira de novo depois; se continuar ocupado, pare e avise ("o Supabase local está com a worktree X desde <hora>"). Confira também com `supabase status` (de dentro da worktree) se há um Supabase rodando.
  2. Livre: escreva **uma linha** com a worktree, a branch e a hora: `echo "producao-confiabilidade producao-confiabilidade $(date '+%Y-%m-%d %H:%M')" > /c/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.vez-supabase.txt`, e só então `supabase start`.
  3. **Ao terminar** (fim da task que precisou do banco, ou ao parar por qualquer motivo): `supabase stop`, devolva `config.toml` e `.env` (abaixo) e **apague o arquivo** só se a linha for desta worktree: `grep -q '^producao-confiabilidade ' …/.vez-supabase.txt && rm …/.vez-supabase.txt`.
  4. Nunca ligue nem desligue o Supabase de outra worktree, e nunca apague a linha de outra worktree.
- **Portas temporárias (o Windows reserva 54287 a 54586 depois de reiniciar):**
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"` (`$SCRATCH` = pasta de rascunho da sessão; o `.env` não está no git).
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`).
  4. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os e2e e os cenários deixam no banco quebram os pgTAP antigos.
  5. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts --workers=1`.
- **POUCA MEMÓRIA (vale para todas as tasks e para a Entrega):**
  - e2e sempre em **lotes de até 2 arquivos**, `--workers=1`. **Nunca rode a suíte e2e inteira de uma vez.**
  - **Antes de cada lote** (e antes de cada rodada de cenários), confira a memória livre: no PowerShell, `[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1)` (GB). **Abaixo de 4 GB, não rode:** espere, feche o que for seu (nunca o que é do dono) e confira de novo; se continuar abaixo, pare e avise.
  - **Se o Claude Code matar um processo** (ou aparecer "Target crashed" / "worker process exited unexpectedly"), **pare** na hora, anote o lote, devolva `config.toml` e `.env`, libere a vez do Supabase e avise. Não tente de novo no mesmo turno.
  - Um agente de cada vez (nada de subagentes em paralelo). Nunca rode ao mesmo tempo o painel de teste do dono, o `next dev` deste plano, os cenários e os e2e.
- **Portas 3001 a 3010 são do dono:** nenhum servidor deste plano usa essas portas; os e2e usam a 3100 (padrão do `playwright.config.ts`), as capturas a **3107**.
- **E2e, testes e cenários só contra o banco local:** `apps/painel/e2e/trava-local.ts` e `limparBanco` recusam outro banco. **Nunca rode nada contra a homologação, nunca use nem altere `.env.homologacao`.** Nenhum `supabase db push` neste plano, nem `--dry-run`.
- **Cenários com Claude real gastam dinheiro:** rode só os comandos indicados (Tasks 2 e 8, e a Entrega), um de cada vez. Teto D14.
- **Custo dos cenários (revisão P1-3):** cada cenário chama `limparBanco`, que **trunca `uso_ia`**: a soma no fim da rodada mede só o último. Antes de **cada** rodada (depois do `supabase db reset`), crie a cópia por gatilho, num esquema de rascunho que o `truncate` não alcança:

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

  Rode pelo `psql` do contêiner do Supabase local (`docker exec -i supabase_db_<projeto> psql -U postgres`), **só no banco local**. Depois da rodada: `select round(sum(custo_usd), 4) from rascunho_custo.uso;` (anote) e `truncate rascunho_custo.uso;`. Ao terminar o trabalho: `drop trigger copiar_custo on public.uso_ia; drop schema rascunho_custo cascade;` — o próximo `supabase db reset` também apaga tudo. O total do `.jsonl` (Task 2) tem de bater com este.
- **Nenhum trabalhador é ligado nem desligado neste plano.** O da porta **3001 é o teste do dono: não desligue nem mate esse processo.**
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "Agente", "Atendendo", "Pausado", "Parado pelo teto de IA", `data-agente-numero="conversas|resolvidas|demandas"`, "IA indisponível", "Recebemos sua mensagem, já vamos te atender.".
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[220px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind. `escala.test.ts` e `tokens.test.ts` continuam passando. Ícones só com `size={12|14|16|20}`.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Vermelho nunca sozinho (ícone + palavra). **Nunca texto técnico ao cliente** (nada de "erro", "API", "falha", "crédito" na mensagem do WhatsApp).
- **Termos:** na tela, "falhas do agente", "saldo ou chave da IA"; nunca "job", "fila", "retry", "billing", "exception".
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que a análise implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Saldo acabou no meio do dia:** 30 conversas chegam com o saldo zerado → cada cliente recebe **uma** mensagem curta (não 3, não texto técnico), cada conversa vai para "esperando pessoa", o dono recebe **um** alerta (não 30), só a primeira conversa chama a IA (disjuntor). Tasks 5 e 6.
2. **Cliente insistente durante a falha:** o mesmo cliente manda 5 mensagens em 1 hora com a IA fora → 1 mensagem do modo seguro; 4 h depois, se ainda estiver fora, outra. Tasks 3 e 5.
3. **Duas vezes ao mesmo tempo:** dois consumidores chegam ao modo seguro da mesma conversa ao mesmo tempo (job repetido) → uma mensagem só (reserva atômica no banco). Task 3 (pgTAP) e Task 5.
4. **Falha depois de agir:** o agente abriu a demanda e a Z-API falhou no `responder` → não repete a ferramenta, vai ao modo seguro com `envio`; se o modo seguro também não sai (Z-API fora), a triagem e o alerta acontecem e a falha registra `modo_seguro_sem_mensagem`. Task 5.
5. **Mensagem parada:** job perdido (o trabalhador reiniciou no meio), ou que falhou de vez por erro de banco → em até 3 min volta à fila; passou de 30 min → modo seguro; conversa já com a equipe não é tocada. Tasks 4 e 6.
6. **Webhook reentregue depois de respondido:** a Z-API manda de novo a mesma mensagem 10 minutos depois → nada gravado, nada agendado, nada enviado. Task 6.
8. **Trabalhador cai depois de responder (revisão P1-1):** a vez abriu a demanda e respondeu, e o processo morreu antes de marcar as mensagens → nem a nova tentativa da fila nem o batimento respondem de novo ou repetem ferramentas. Tasks 4, 5, 6.
9. **Volta depois de 1 hora fora (revisão P1-2):** as mensagens paradas voltam à fila primeiro; só vão à equipe depois de 2 tentativas sem sucesso. Task 6.
7. **Texto do cliente vazando para o registro:** a exceção traz o conteúdo da mensagem (ex.: erro 400 que ecoa o pedido) → `falhas_agente.erro` guarda só classe, status e a primeira linha, cortada em 300. Task 1.

---

## Mapa de arquivos

`tr/…` = `apps/trabalhador/src/`; `in/…` = `apps/painel/src/app/(painel)/inicio/`.

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `tr/agente/cliente-ia.ts`, `apps/trabalhador/test/confiabilidade/tipo-falha.test.ts` (novo) | tipo da falha e erro resumido | 1 |
| `tr/cenarios/diagnostico.ts`, `tr/cenarios/relatorio-falhas.ts` (novos), `tr/cenarios/rodar.ts` (o registro opcional), `apps/trabalhador/package.json` (script), `apps/trabalhador/test/confiabilidade/diagnostico.test.ts` (novo), `docs/relatorios/falhas-agente.md` (novo) | diagnóstico dos cenários | 2 |
| `supabase/migrations/20261101000100_confiabilidade_agente.sql`, `supabase/tests/80_confiabilidade_agente.test.sql` (novos), `packages/db/src/tipos.gen.ts` | tabela, coluna e funções | 3 |
| `packages/db/src/repos.ts`, `packages/db/test/limpar.ts`, `packages/db/test/confiabilidade.test.ts` (novo) | repositório | 4 |
| `tr/modo-seguro.ts` (novo), `tr/processar-conversa.ts`, `tr/retencao.ts`, `apps/trabalhador/test/confiabilidade/modo-seguro.test.ts` (novo) | modo seguro, disjuntor, alertas | 5 |
| `tr/fila.ts`, `tr/config.ts`, `tr/principal.ts`, `tr/tarefas.ts`, `apps/trabalhador/test/confiabilidade/fila-parada.test.ts`, `apps/trabalhador/test/confiabilidade/webhook-reentregue.test.ts` (novos) | prazo do job, paralelismo, mensagem parada, webhook | 6 |
| `apps/painel/src/lib/falhas-agente.ts`, `.test.ts` (novos), `in/dados-situacao.ts`, `in/cartao-agente.tsx`, `apps/painel/src/app/(painel)/configuracoes/secoes/mensagens.tsx`, `apps/painel/e2e/inicio-falhas-agente.spec.ts` (novo) | Início e a ajuda do campo | 7 |
| o que o relatório apontar (só `tr/**`, fora `prompt.ts`), testes novos em `apps/trabalhador/test/confiabilidade/` | correções do diagnóstico | 8 |
| `docs/operacao.md` | manual | 9 |

---

### Task 1: Trabalhador. O tipo da falha e o erro resumido (D4, D7)

**Files:**
- Modify: `apps/trabalhador/src/agente/cliente-ia.ts` (só acréscimos no fim)
- Create: `apps/trabalhador/test/confiabilidade/tipo-falha.test.ts`

**Interfaces:**
- Consumes: `Anthropic` (SDK 0.110), `erroTemporarioIa` (existente, não muda).
- Produces:
  - `export type TipoFalha = 'passageiro' | 'saldo' | 'chave' | 'pedido_invalido' | 'envio' | 'codigo';`
  - `export const FALHAS_DEFINITIVAS_DA_CONTA: readonly TipoFalha[] = ['saldo', 'chave'];`
  - `export function tipoFalha(e: unknown): TipoFalha`
  - `export function resumoDoErro(e: unknown): string` (≤ 300 caracteres, uma linha)

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/confiabilidade/tipo-falha.test.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { erroTemporarioIa, resumoDoErro, tipoFalha } from '../../src/agente/cliente-ia';

/** Erro como a API devolve (a fábrica do SDK escolhe a classe pelo status). */
const daApi = (status: number, mensagem: string) =>
  Anthropic.APIError.generate(status, { type: 'error', error: { type: 'x', message: mensagem } }, mensagem, new Headers());

describe('tipoFalha (D4)', () => {
  it('passageiro: sem rede, tempo esgotado, 429, 500, 529', () => {
    expect(tipoFalha(new Anthropic.APIConnectionError({ message: 'sem rede' }))).toBe('passageiro');
    expect(tipoFalha(new Anthropic.APIConnectionTimeoutError())).toBe('passageiro');
    expect(tipoFalha(daApi(429, 'rate limit'))).toBe('passageiro');
    expect(tipoFalha(daApi(500, 'internal'))).toBe('passageiro');
    expect(tipoFalha(daApi(529, 'Overloaded'))).toBe('passageiro');
  });
  it('saldo: a API diz que o crédito acabou (chega como 400)', () => {
    expect(tipoFalha(daApi(400, 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'))).toBe('saldo');
    expect(tipoFalha(daApi(402, 'billing'))).toBe('saldo');
  });
  it('chave: 401 e 403', () => {
    expect(tipoFalha(daApi(401, 'invalid x-api-key'))).toBe('chave');
    expect(tipoFalha(daApi(403, 'permission'))).toBe('chave');
  });
  it('pedido inválido: outro 400', () => {
    expect(tipoFalha(daApi(400, 'messages.3: tool_use ids were found without tool_result blocks'))).toBe('pedido_invalido');
  });
  it('envio: erro da Z-API', () => {
    expect(tipoFalha(new Error('Z-API 500: {"error":"x"}'))).toBe('envio');
    expect(tipoFalha(new Error('Z-API não devolveu id da mensagem'))).toBe('envio');
  });
  it('código: qualquer outra exceção', () => {
    expect(tipoFalha(new Error('registrarDecisao: duplicate key'))).toBe('codigo');
    expect(tipoFalha('texto solto')).toBe('codigo');
  });
  it('erroTemporarioIa não muda (testes antigos dependem dele)', () => {
    expect(erroTemporarioIa(daApi(529, 'Overloaded'))).toBe(true);
    expect(erroTemporarioIa(daApi(400, 'Your credit balance is too low'))).toBe(false);
  });
});

describe('resumoDoErro (D7, Foco 7)', () => {
  it('classe, status e só a primeira linha, até 300 caracteres', () => {
    const r = resumoDoErro(daApi(400, `pedido inválido\nconteúdo do cliente: meu CPF é 123.456.789-00 ${'x'.repeat(500)}`));
    expect(r.startsWith('BadRequestError 400: ')).toBe(true);
    expect(r).not.toContain('CPF');
    expect(r).not.toContain('\n');
    expect(r.length).toBeLessThanOrEqual(300);
  });
  it('erro comum e valor que não é erro', () => {
    expect(resumoDoErro(new Error('registrarDecisao: falhou'))).toBe('Error: registrarDecisao: falhou');
    expect(resumoDoErro(42)).toBe('42');
  });
  it('Z-API: só o status, nunca o corpo da resposta (pode ter o telefone do cliente; revisão P1-6)', () => {
    expect(resumoDoErro(new Error('Z-API 500: {"phone":"5531988887777","error":"x"}'))).toBe('Error: Z-API 500');
    expect(resumoDoErro(new Error('Z-API não devolveu id da mensagem'))).toBe('Error: Z-API não devolveu id da mensagem');
  });
});
```

(Se `Anthropic.APIError.generate` tiver outra assinatura na versão instalada, confira em `node_modules/@anthropic-ai/sdk/core/error.d.ts` e ajuste **só** a função `daApi` do teste; o resto fica.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/confiabilidade/tipo-falha.test.ts`
Expected: FAIL (`tipoFalha` e `resumoDoErro` não existem).

- [ ] **Step 3: Implemente** — no fim de `apps/trabalhador/src/agente/cliente-ia.ts`:

```ts
/** Plano de confiabilidade (D4): o que aconteceu, para decidir entre tentar de novo e o modo seguro, e para o registro. */
export type TipoFalha = 'passageiro' | 'saldo' | 'chave' | 'pedido_invalido' | 'envio' | 'codigo';
/** Falhas da conta da Anthropic: não adianta tentar de novo nem chamar a IA nas próximas conversas (disjuntor, D5). */
export const FALHAS_DEFINITIVAS_DA_CONTA: readonly TipoFalha[] = ['saldo', 'chave'];

export function tipoFalha(e: unknown): TipoFalha {
  // O saldo esgotado chega como 400 (igual a pedido inválido): só a mensagem separa.
  if (e instanceof Anthropic.APIError && (e.status === 402 || /credit balance|billing/i.test(e.message))) return 'saldo';
  if (erroTemporarioIa(e)) return 'passageiro';
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return 'chave';
  if (e instanceof Anthropic.BadRequestError) return 'pedido_invalido';
  if (e instanceof Error && e.message.startsWith('Z-API')) return 'envio';
  return 'codigo';
}

/** Até 300 caracteres e uma linha: o erro pode ecoar o pedido, e o pedido tem texto do cliente (D7). */
export function resumoDoErro(e: unknown): string {
  if (!(e instanceof Error)) return String(e).split('\n')[0]!.slice(0, 300);
  const status = e instanceof Anthropic.APIError && e.status ? ` ${e.status}` : '';
  // Z-API: só "Z-API <status>"; o corpo da resposta pode trazer o telefone do cliente (revisão P1-6).
  const linha = (e.message ?? '').split('\n')[0]!.trim().replace(/^(Z-API \d{3}):.*$/, '$1');
  return `${e.constructor.name}${status}: ${linha}`.slice(0, 300);
}
```

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/confiabilidade/tipo-falha.test.ts && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS. Se `resumoDoErro(daApi(400, …))` não começar com `BadRequestError 400:` porque o SDK já põe o status na mensagem (`"400 {...}"`), **mantenha o teste** e tire o status repetido do começo de `linha` (`linha.replace(/^\d{3}\s+/, '')`).

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/agente/cliente-ia.ts apps/trabalhador/test/confiabilidade/tipo-falha.test.ts
git commit -m "feat(agente): classificar a falha da IA e resumir o erro sem texto do cliente (confiabilidade, D4, D7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Diagnóstico. Registro dos cenários, 3 rodadas e o relatório (D13)

**Files:**
- Create: `apps/trabalhador/src/cenarios/diagnostico.ts`, `apps/trabalhador/src/cenarios/relatorio-falhas.ts`, `apps/trabalhador/test/confiabilidade/diagnostico.test.ts`, `docs/relatorios/falhas-agente.md`
- Modify: `apps/trabalhador/src/cenarios/rodar.ts` (só `rodar` e `principal`, para ligar o registro), `apps/trabalhador/package.json` (script `cenarios-relatorio`)

**Interfaces:**
- Consumes: `tipoFalha`, `resumoDoErro` (Task 1), `ClienteIa`, `CENARIOS`, `processarConversa` (devolve `DesfechoProcessamento`).
- Produces:
  - `export type RegistroCenario = { rodada: number; nome: string; ok: boolean; falhas: string[]; desfechos: string[]; errosIa: { tipo: TipoFalha; resumo: string }[]; paradas: string[]; custoUsd: number }`
  - `export function iaQueAnota(ia: ClienteIa, anotar: { errosIa: RegistroCenario['errosIa']; paradas: string[] }): ClienteIa`
  - `export type CausaFalha = 'api_passageira' | 'api_saldo' | 'api_chave' | 'pedido_invalido' | 'excecao_codigo' | 'envio' | 'limite_rodadas' | 'terminou_sem_responder' | 'recusa_ou_corte' | 'comportamento'`
  - `export function classificarRegistro(r: RegistroCenario): CausaFalha[]`
  - `export function montarRelatorio(registros: RegistroCenario[]): string` (Markdown)

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/confiabilidade/diagnostico.test.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { classificarRegistro, iaQueAnota, montarRelatorio, type RegistroCenario } from '../../src/cenarios/diagnostico';
import { IaRoteirizada, fim, recusa } from '../apoio/ia-roteirizada';

const base = (x: Partial<RegistroCenario>): RegistroCenario =>
  ({ rodada: 1, nome: 'c', ok: false, falhas: [], desfechos: ['agente'], errosIa: [], paradas: [], custoUsd: 0, ...x });

describe('iaQueAnota', () => {
  it('anota o tipo do erro e o stop_reason, e devolve a resposta ou o erro de sempre', async () => {
    const anot = { errosIa: [] as RegistroCenario['errosIa'], paradas: [] as string[] };
    const ia = iaQueAnota(new IaRoteirizada([fim(), recusa(), new Anthropic.APIConnectionError({ message: 'sem rede' })]), anot);
    await ia.criar({} as never);
    await ia.criar({} as never);
    await expect(ia.criar({} as never)).rejects.toThrow('sem rede');
    expect(anot.paradas).toEqual(['end_turn', 'refusal']);
    expect(anot.errosIa).toEqual([{ tipo: 'passageiro', resumo: 'APIConnectionError: sem rede' }]);
  });
});

describe('classificarRegistro', () => {
  it('passou: nenhuma causa', () => {
    expect(classificarRegistro(base({ ok: true }))).toEqual([]);
  });
  it('erro da API vem antes do comportamento', () => {
    expect(classificarRegistro(base({ falhas: ['esperava chamado no setor Fiscal'], errosIa: [{ tipo: 'saldo', resumo: 'x' }] }))).toEqual(['api_saldo']);
  });
  it('escaladas do motor pelo texto da falha e pelo stop_reason', () => {
    expect(classificarRegistro(base({ falhas: ['x'], desfechos: ['escalado'], paradas: ['refusal'] }))).toContain('recusa_ou_corte');
    expect(classificarRegistro(base({ falhas: ['erro: registrarDecisao: falhou'] }))).toEqual(['excecao_codigo']);
  });
  it('sem erro técnico: comportamento', () => {
    expect(classificarRegistro(base({ falhas: ['resposta deveria conter "nota"'] }))).toEqual(['comportamento']);
  });
});

describe('montarRelatorio', () => {
  it('conta por rodada e por causa, e lista cada falha com a rodada', () => {
    const md = montarRelatorio([
      base({ rodada: 1, nome: 'a', ok: true }),
      base({ rodada: 1, nome: 'b', falhas: ['resposta deveria conter "x"'] }),
      base({ rodada: 2, nome: 'b', ok: true }),
    ]);
    expect(md).toContain('| 1 | 2 | 1 | 1 |');
    expect(md).toContain('| comportamento | 1 |');
    expect(md).toContain('### b');
    expect(md).toContain('rodada 1: resposta deveria conter "x"');
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/confiabilidade/diagnostico.test.ts`
Expected: FAIL (`cenarios/diagnostico.ts` não existe).

- [ ] **Step 3: Implemente `apps/trabalhador/src/cenarios/diagnostico.ts`:**

```ts
import { appendFileSync } from 'node:fs';
import type { ClienteIa } from '../agente/cliente-ia';
import { resumoDoErro, tipoFalha, type TipoFalha } from '../agente/cliente-ia';

/** Uma vez de um cenário com o registro ligado (CENARIOS_DIAGNOSTICO): uma linha do .jsonl. */
export type RegistroCenario = {
  rodada: number; nome: string; ok: boolean; falhas: string[]; desfechos: string[];
  errosIa: { tipo: TipoFalha; resumo: string }[]; paradas: string[]; custoUsd: number;
};
export type CausaFalha = 'api_passageira' | 'api_saldo' | 'api_chave' | 'pedido_invalido' | 'excecao_codigo' | 'envio'
  | 'limite_rodadas' | 'terminou_sem_responder' | 'recusa_ou_corte' | 'comportamento';

/** O mesmo cliente da IA, anotando os erros (pelo tipo) e o stop_reason de cada resposta. */
export function iaQueAnota(ia: ClienteIa, anotar: { errosIa: RegistroCenario['errosIa']; paradas: string[] }): ClienteIa {
  return {
    async criar(p, opcoes) {
      try {
        const r = await ia.criar(p, opcoes);
        anotar.paradas.push(String(r.stop_reason));
        return r;
      } catch (e) {
        anotar.errosIa.push({ tipo: tipoFalha(e), resumo: resumoDoErro(e) });
        throw e;
      }
    },
  };
}

const DO_TIPO: Record<TipoFalha, CausaFalha> = {
  passageiro: 'api_passageira', saldo: 'api_saldo', chave: 'api_chave', pedido_invalido: 'pedido_invalido', envio: 'envio', codigo: 'excecao_codigo',
};

/** Técnica primeiro (erro da API, exceção, escalada do motor); sem nada técnico, é comportamento do modelo. */
export function classificarRegistro(r: RegistroCenario): CausaFalha[] {
  if (r.ok) return [];
  const causas = new Set<CausaFalha>(r.errosIa.map((e) => DO_TIPO[e.tipo]));
  if (r.falhas.some((f) => f.startsWith('erro: '))) causas.add(r.falhas.some((f) => /Z-API/.test(f)) ? 'envio' : 'excecao_codigo');
  if (r.desfechos.includes('escalado')) {
    if (r.paradas.some((p) => p === 'refusal' || p === 'max_tokens')) causas.add('recusa_ou_corte');
    else if (r.paradas.length >= 6) causas.add('limite_rodadas');
    else if (r.errosIa.length === 0) causas.add('terminou_sem_responder');
  }
  return causas.size ? [...causas] : ['comportamento'];
}

export function montarRelatorio(registros: RegistroCenario[]): string {
  const rodadas = [...new Set(registros.map((r) => r.rodada))].sort((a, b) => a - b);
  const linhasRodada = rodadas.map((n) => {
    const da = registros.filter((r) => r.rodada === n);
    const ok = da.filter((r) => r.ok).length;
    return `| ${n} | ${da.length} | ${ok} | ${da.length - ok} |`;
  });
  const contagem = new Map<CausaFalha, number>();
  for (const r of registros) for (const c of classificarRegistro(r)) contagem.set(c, (contagem.get(c) ?? 0) + 1);
  const porNome = new Map<string, RegistroCenario[]>();
  for (const r of registros.filter((x) => !x.ok)) porNome.set(r.nome, [...(porNome.get(r.nome) ?? []), r]);
  const custo = registros.reduce((s, r) => s + r.custoUsd, 0);
  return [
    '# Falhas do agente nos cenários (diagnóstico)', '',
    `Gerado por \`pnpm --filter @escritorio/trabalhador cenarios-relatorio\`. Custo das rodadas: US$ ${custo.toFixed(2)}.`, '',
    '## Por rodada', '', '| Rodada | Cenários | Passaram | Falharam |', '|---|---|---|---|', ...linhasRodada, '',
    '## Por causa', '', '| Causa | Vezes |', '|---|---|', ...[...contagem].sort((a, b) => b[1] - a[1]).map(([c, n]) => `| ${c} | ${n} |`), '',
    '## Cada falha', '',
    ...[...porNome].flatMap(([nome, rs]) => [
      `### ${nome}`, '',
      ...rs.flatMap((r) => [
        ...r.falhas.map((f) => `- rodada ${r.rodada}: ${f}`),
        ...r.errosIa.map((e) => `- rodada ${r.rodada}: erro da IA (${e.tipo}) ${e.resumo}`),
        `- rodada ${r.rodada}: causa ${classificarRegistro(r).join(', ')}; desfechos ${r.desfechos.join(', ')}; paradas ${r.paradas.join(', ')}`,
      ]),
      '',
    ]),
  ].join('\n');
}

/** Acrescenta uma linha ao .jsonl do diagnóstico (só quando CENARIOS_DIAGNOSTICO está definida). */
export function anotarNoArquivo(arquivo: string | undefined, r: RegistroCenario): void {
  if (arquivo) appendFileSync(arquivo, `${JSON.stringify(r)}\n`, 'utf8');
}
```

`apps/trabalhador/src/cenarios/relatorio-falhas.ts`:

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { montarRelatorio, type RegistroCenario } from './diagnostico';

// `pnpm cenarios-relatorio <arquivo.jsonl> <saida.md>`: junta as rodadas do diagnóstico num relatório.
const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('Uso: cenarios-relatorio <arquivo.jsonl> <saida.md>');
  process.exit(1);
}
const registros = readFileSync(entrada, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as RegistroCenario);
writeFileSync(saida, montarRelatorio(registros), 'utf8');
console.log(`${registros.length} registro(s) → ${saida}`);
```

Em `apps/trabalhador/package.json`, ao lado de `cenarios-tarefas`:

```json
    "cenarios-relatorio": "tsx src/cenarios/relatorio-falhas.ts",
```

Em `apps/trabalhador/src/cenarios/rodar.ts`:
1. Importe `anotarNoArquivo, iaQueAnota, type RegistroCenario` de `./diagnostico`.
2. `rodar(c: Cenario)` passa a receber `anot: Pick<RegistroCenario, 'errosIa' | 'paradas' | 'desfechos'>` e:
   - troca `ia: criarClienteIa(process.env.ANTHROPIC_API_KEY!)` por `ia: iaQueAnota(criarClienteIa(process.env.ANTHROPIC_API_KEY!), anot)`;
   - troca `await processarConversa(deps, conversa.id, true);` por `anot.desfechos.push(await processarConversa(deps, conversa.id, true));`.
3. Em `principal`, troque o laço por:

```ts
  // Diagnóstico (plano de confiabilidade, D13): CENARIOS_DIAGNOSTICO=<arquivo.jsonl> e CENARIOS_RODADA=<n> anotam cada cenário.
  const arquivo = process.env.CENARIOS_DIAGNOSTICO?.trim() || undefined;
  const rodada = Number(process.env.CENARIOS_RODADA ?? '1') || 1;
  let falhou = 0;
  for (const c of lista) {
    const anot = { errosIa: [] as RegistroCenario['errosIa'], paradas: [] as string[], desfechos: [] as string[] };
    const falhas = await rodar(c, anot).catch((e: Error) => [`erro: ${e.message}`]);
    const { data: usos } = await db.from('uso_ia').select('custo_usd');
    anotarNoArquivo(arquivo, { rodada, nome: c.nome, ok: falhas.length === 0, falhas, ...anot,
      custoUsd: (usos ?? []).reduce((s, u) => s + Number(u.custo_usd), 0) });
    if (falhas.length) falhou++;
    console.log(`${falhas.length ? '❌' : '✅'} ${c.nome}${falhas.length ? `\n   - ${falhas.join('\n   - ')}` : ''}`);
  }
```

(O custo lido logo depois de cada cenário é o daquele cenário: `preparar` chama `limparBanco`, que esvazia `uso_ia`, no começo do seguinte.)

- [ ] **Step 4: Rode os testes**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/confiabilidade && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS.

- [ ] **Step 5: As 3 rodadas com Claude de verdade** (Supabase local nas portas 563xx com a vez reservada — Regras de ambiente; `supabase db reset` antes de cada rodada; memória ≥ 4 GB antes de cada uma; nada mais rodando):

```bash
export PATH="$HOME/bin:$PATH"
J="$SCRATCH/diagnostico.jsonl"; rm -f "$J"
for n in 1 2 3; do
  supabase db reset
  CENARIOS_DIAGNOSTICO="$J" CENARIOS_RODADA=$n pnpm --filter @escritorio/trabalhador cenarios | tee "$SCRATCH/cenarios-rodada-$n.txt"
done
pnpm --filter @escritorio/trabalhador cenarios-relatorio "$J" "$PWD/docs/relatorios/falhas-agente.md"
```

(Confira a memória **antes de cada** `for`; se cair abaixo de 4 GB, pare o laço e rode a rodada seguinte depois. `pnpm cenarios` sai com código 1 quando algum cenário falha: isso é esperado aqui, não pare por isso.) Anote o custo total do relatório; ≈ US$ 8–12.

- [ ] **Step 6: Complete o relatório à mão** — abra `docs/relatorios/falhas-agente.md` e acrescente, no fim, a seção **"## Causas e o que fazer"** com **uma linha por causa encontrada**, no formato:

```markdown
| Causa | Cenários (rodadas) | É defeito do código? | O que fazer | Task |
|---|---|---|---|---|
| excecao_codigo: `registrarDecisao: ...` | pedido de nota (2) | sim | teste que reproduz + correção | 8 |
| comportamento: não chamou o agente do Fiscal | fiscal: ... (1, 3) | não | orientação sugerida ao dono: "..." | pendência |
```

Regra (D13): **defeito do código** = exceção, erro da API causado pelo nosso pedido (`pedido_invalido`), erro de envio que o código poderia evitar, escalada por limite de passos com ferramenta respondendo erro repetido. **Comportamento** = o modelo escolheu diferente; vira pendência com uma orientação sugerida (sem mudar `prompt.ts`). Falha **passageira** da API (529, 429) não é defeito: anote quantas vezes aconteceu; o modo seguro (Task 5) é a resposta.

- [ ] **Step 7: Devolva `config.toml` e `.env`, libere a vez do Supabase; commit**

```bash
git add apps/trabalhador/src/cenarios/diagnostico.ts apps/trabalhador/src/cenarios/relatorio-falhas.ts apps/trabalhador/src/cenarios/rodar.ts apps/trabalhador/package.json apps/trabalhador/test/confiabilidade/diagnostico.test.ts docs/relatorios/falhas-agente.md
git commit -m "test(cenarios): diagnóstico das falhas do agente em 3 rodadas, com relatório por causa (confiabilidade, D13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Banco. `falhas_agente`, a reserva do modo seguro e a mensagem parada (D2, D7, D8, D11)

**Files:**
- Create: `supabase/migrations/20261101000100_confiabilidade_agente.sql`, `supabase/tests/80_confiabilidade_agente.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `eh_admin()`, `conversas`, `mensagens`, `clientes`, `agentes`.
- Produces (SQL):
  - tabela `public.falhas_agente (id uuid pk, conversa_id uuid → conversas on delete set null, cliente_id uuid → clientes on delete set null, agente_id uuid → agentes on delete set null, tipo text check in ('passageiro','saldo','chave','pedido_invalido','envio','codigo'), etapa text check in ('ia','ferramenta','envio','outro'), tentativa int ≥ 0, ultima boolean, erro text check length ≤ 300, modelo text, acao text check in ('tentar_de_novo','modo_seguro','modo_seguro_sem_mensagem'), criado_em timestamptz)`; RLS: `select` só `eh_admin()`; sem `insert/update/delete` para `authenticated`;
  - coluna `public.conversas.modo_seguro_em timestamptz`;
  - `public.reservar_modo_seguro(p_conversa uuid, p_horas int default 4) returns boolean` (só `service_role`);
  - `public.falhas_agente_hoje(p_agora timestamptz default now()) returns jsonb` → `{"total": n, "conta": m, "instabilidade": k}` (`total` = `ultima = true`; `conta` = saldo + chave entre elas; `instabilidade` = `tentar_de_novo`), só administrador (revisão P1-7);
  - colunas `public.mensagens.reenfileirada int not null default 0` e `public.mensagens.reenfileirada_em timestamptz` (revisão P1-2/P1-8);
  - `public.conversas_com_mensagem_parada(p_de_min int, p_ate_min int) returns table (conversa_id uuid, desde timestamptz, reenvios int, ultimo_reenvio timestamptz)` (só `service_role`; `reenvios` = o maior `reenfileirada` das mensagens paradas);
  - `public.marcar_reenfileirada(p_conversa uuid) returns void` (só `service_role`; soma 1 e grava a hora nas mensagens não processadas daquela conversa).

- [ ] **Step 1: Escreva o teste que falha** — `supabase/tests/80_confiabilidade_agente.test.sql`:

```sql
-- Plano de confiabilidade do agente, Task 3 (D2, D7, D8, D11).
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email) values
  ('f8000000-0000-0000-0000-00000000000a', 'admin@conf.local'), ('f8000000-0000-0000-0000-00000000000b', 'ana@conf.local');
insert into public.usuarios (id, nome, email, papel) values
  ('f8000000-0000-0000-0000-00000000000a', 'Conf Admin', 'admin@conf.local', 'admin'),
  ('f8000000-0000-0000-0000-00000000000b', 'Conf Ana', 'ana@conf.local', 'atendente');
insert into public.conversas (id, telefone) values
  ('f8100000-0000-0000-0000-00000000000a', '5531980000001'), ('f8100000-0000-0000-0000-00000000000b', '5531980000002'),
  ('f8100000-0000-0000-0000-00000000000c', '5531980000003');
update public.conversas set estado = 'humano' where id = 'f8100000-0000-0000-0000-00000000000c';
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em) values
  ('f8100000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'parada há 10 min', now() - interval '10 minutes'),
  ('f8100000-0000-0000-0000-00000000000b', 'entrada', 'cliente', 'parada há 1 min', now() - interval '1 minute'),
  ('f8100000-0000-0000-0000-00000000000c', 'entrada', 'cliente', 'com a equipe', now() - interval '10 minutes');
insert into public.falhas_agente (conversa_id, tipo, etapa, tentativa, ultima, erro, acao, criado_em) values
  ('f8100000-0000-0000-0000-00000000000a', 'saldo', 'ia', 0, true, 'BadRequestError 400: credit balance', 'modo_seguro', now()),
  ('f8100000-0000-0000-0000-00000000000a', 'passageiro', 'ia', 0, false, 'InternalServerError 529: Overloaded', 'tentar_de_novo', now()),
  ('f8100000-0000-0000-0000-00000000000a', 'codigo', 'outro', 2, true, 'Error: x', 'modo_seguro', now() - interval '2 days');

-- 1–5: estrutura
select has_table('public', 'falhas_agente', 'tabela falhas_agente');
select has_column('public', 'conversas', 'modo_seguro_em', 'conversas.modo_seguro_em');
select throws_ok($$ insert into public.falhas_agente (tipo, etapa, tentativa, ultima, erro, acao) values ('outro', 'ia', 0, true, 'x', 'modo_seguro') $$,
  '23514', null, 'tipo fora da lista é recusado');
select throws_ok($$ insert into public.falhas_agente (tipo, etapa, tentativa, ultima, erro, acao) values ('saldo', 'ia', 0, true, repeat('x', 301), 'modo_seguro') $$,
  '23514', null, 'erro com mais de 300 caracteres é recusado');
select ok(not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'falhas_agente'), 'fora do Realtime');

-- 6–9: reservar_modo_seguro (D2): uma vez a cada N horas, atômica
select is(public.reservar_modo_seguro('f8100000-0000-0000-0000-00000000000a', 4), true, 'primeira reserva: sim');
select is(public.reservar_modo_seguro('f8100000-0000-0000-0000-00000000000a', 4), false, 'segunda dentro de 4 h: não');
update public.conversas set modo_seguro_em = now() - interval '5 hours' where id = 'f8100000-0000-0000-0000-00000000000a';
select is(public.reservar_modo_seguro('f8100000-0000-0000-0000-00000000000a', 4), true, 'passadas 4 h: sim de novo');
select is(public.reservar_modo_seguro('f8100000-0000-0000-0000-0000000000ff', 4), false, 'conversa que não existe: não');

-- 10–12: conversas_com_mensagem_parada (D11): só entre os limites, só com o agente
select results_eq($$ select conversa_id from public.conversas_com_mensagem_parada(3, 30) $$,
  $$ values ('f8100000-0000-0000-0000-00000000000a'::uuid) $$, 'parada há 10 min entra; há 1 min e com a equipe não');
select is((select count(*)::int from public.conversas_com_mensagem_parada(30, 600)), 0, 'nenhuma acima de 30 min');
-- revisão P1-2/P1-8: a devolução à fila é contada por mensagem
select lives_ok($$ select public.marcar_reenfileirada('f8100000-0000-0000-0000-00000000000a') $$, 'marca a devolução');
select is((select reenvios from public.conversas_com_mensagem_parada(3, 30)), 1, 'reenvios = 1');
select isnt((select ultimo_reenvio from public.conversas_com_mensagem_parada(3, 30)), null, 'com a hora da devolução');
update public.mensagens set processada_em = now() where conversa_id = 'f8100000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.conversas_com_mensagem_parada(3, 30)), 0, 'processada sai da lista');

-- 13–16: RLS e quem chama o quê
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.falhas_agente), 0, 'atendente não lê falhas_agente');
select throws_ok($$ select public.falhas_agente_hoje() $$, 'P0001', 'Só o administrador vê as falhas do agente.', 'atendente não chama falhas_agente_hoje');
select throws_ok($$ select public.reservar_modo_seguro('f8100000-0000-0000-0000-00000000000a', 4) $$, '42501', null, 'pessoa não reserva modo seguro');
select throws_ok($$ insert into public.falhas_agente (tipo, etapa, tentativa, ultima, erro, acao) values ('saldo', 'ia', 0, true, 'x', 'modo_seguro') $$,
  '42501', null, 'pessoa não grava falha');

-- 17–20: o administrador lê; falhas_agente_hoje conta só o dia de Brasília e separa saldo/chave
select set_config('request.jwt.claims', '{"sub":"f8000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.falhas_agente), 3, 'administrador lê as 3');
select is((public.falhas_agente_hoje() ->> 'total')::int, 1, 'hoje: 1 que não se resolveu (a de 2 dias atrás e a nova tentativa ficam de fora; P1-7)');
select is((public.falhas_agente_hoje() ->> 'conta')::int, 1, 'hoje por saldo ou chave: 1');
select throws_ok($$ select public.conversas_com_mensagem_parada(3, 30) $$, '42501', null, 'administrador também não chama a função do trabalhador');
select is((public.falhas_agente_hoje() ->> 'instabilidade')::int, 1, 'instabilidade: as novas tentativas de hoje (P1-7)');

select * from finish();
rollback;
```

- [ ] **Step 2: Rode e veja falhar** (Supabase local com a vez reservada; portas 563xx)

Run: `supabase test db`
Expected: `80_confiabilidade_agente.test.sql` FAIL (tabela e funções não existem); os outros passam.

- [ ] **Step 3: Implemente** — `supabase/migrations/20261101000100_confiabilidade_agente.sql`:

```sql
-- supabase/migrations/20261101000100_confiabilidade_agente.sql
-- Plano de confiabilidade do agente (Prompt 1 da análise de arquitetura). Só acréscimos:
--   falhas_agente: cada falha do agente de clientes (só o administrador lê; o trabalhador grava com a chave de serviço, D7);
--   conversas.modo_seguro_em + reservar_modo_seguro: a mensagem do modo seguro sai no máximo 1 vez a cada N horas (D2);
--   falhas_agente_hoje: o número do Início (D8); conversas_com_mensagem_parada: o batimento (D11).

create table public.falhas_agente (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid references public.conversas (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  agente_id uuid references public.agentes (id) on delete set null,
  tipo text not null check (tipo in ('passageiro', 'saldo', 'chave', 'pedido_invalido', 'envio', 'codigo')),
  etapa text not null check (etapa in ('ia', 'ferramenta', 'envio', 'outro')),
  tentativa int not null default 0 check (tentativa >= 0),
  ultima boolean not null,
  -- Nunca texto do cliente: classe, status e a primeira linha do erro (resumoDoErro no trabalhador).
  erro text not null check (char_length(erro) <= 300),
  modelo text,
  acao text not null check (acao in ('tentar_de_novo', 'modo_seguro', 'modo_seguro_sem_mensagem')),
  criado_em timestamptz not null default now()
);
create index falhas_agente_criado_idx on public.falhas_agente (criado_em desc);
create index falhas_agente_conta_idx on public.falhas_agente (criado_em desc) where tipo in ('saldo', 'chave');
alter table public.falhas_agente enable row level security;
create policy leitura on public.falhas_agente for select to authenticated using (public.eh_admin());
revoke insert, update, delete on public.falhas_agente from authenticated, anon;

alter table public.conversas add column modo_seguro_em timestamptz;

-- Reserva atômica (dois consumidores ao mesmo tempo: só um manda a mensagem).
create function public.reservar_modo_seguro(p_conversa uuid, p_horas int default 4) returns boolean
language sql volatile security definer set search_path = '' as $$
  with r as (
    update public.conversas set modo_seguro_em = now()
     where id = p_conversa and (modo_seguro_em is null or modo_seguro_em < now() - make_interval(hours => p_horas))
    returning 1)
  select exists (select 1 from r)
$$;
revoke execute on function public.reservar_modo_seguro(uuid, int) from public, anon, authenticated;
grant execute on function public.reservar_modo_seguro(uuid, int) to service_role;

create function public.falhas_agente_hoje(p_agora timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_de timestamptz := ((p_agora at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
begin
  if not public.eh_admin() then raise exception 'Só o administrador vê as falhas do agente.'; end if;
  -- Revisão P1-7: "total" é o que não se resolveu; a nova tentativa vai à parte ("instabilidade"), sem alarme falso.
  return (select jsonb_build_object(
            'total', count(*) filter (where f.ultima),
            'conta', count(*) filter (where f.ultima and f.tipo in ('saldo', 'chave')),
            'instabilidade', count(*) filter (where f.acao = 'tentar_de_novo'))
            from public.falhas_agente f where f.criado_em >= v_de and f.criado_em < v_de + interval '1 day');
end $$;
revoke execute on function public.falhas_agente_hoje(timestamptz) from public, anon;
grant execute on function public.falhas_agente_hoje(timestamptz) to authenticated;

-- Revisão P1-2/P1-8: quantas vezes o batimento já devolveu esta mensagem à fila, e quando.
alter table public.mensagens add column reenfileirada int not null default 0, add column reenfileirada_em timestamptz;

create function public.marcar_reenfileirada(p_conversa uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.mensagens set reenfileirada = reenfileirada + 1, reenfileirada_em = now()
   where conversa_id = p_conversa and direcao = 'entrada' and processada_em is null
$$;
revoke execute on function public.marcar_reenfileirada(uuid) from public, anon, authenticated;
grant execute on function public.marcar_reenfileirada(uuid) to service_role;

-- Conversa com o agente com mensagem de cliente não processada entre p_de_min e p_ate_min minutos (a mais antiga decide).
create function public.conversas_com_mensagem_parada(p_de_min int, p_ate_min int)
returns table (conversa_id uuid, desde timestamptz, reenvios int, ultimo_reenvio timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.conversa_id, min(m.criado_em), max(m.reenfileirada), max(m.reenfileirada_em)
    from public.mensagens m join public.conversas c on c.id = m.conversa_id
   where m.direcao = 'entrada' and m.processada_em is null and c.estado = 'agente'
   group by m.conversa_id
  having min(m.criado_em) <= now() - make_interval(mins => p_de_min) and min(m.criado_em) > now() - make_interval(mins => p_ate_min)
$$;
revoke execute on function public.conversas_com_mensagem_parada(int, int) from public, anon, authenticated;
grant execute on function public.conversas_com_mensagem_parada(int, int) to service_role;
```

Regere os tipos: `pnpm db:tipos` (Supabase local ligado; com as portas temporárias o comando usa `--local`, que lê o `config.toml`).

- [ ] **Step 4: Rode**

Run: `supabase db reset && supabase test db`
Expected: todos os arquivos passam, `80` com 23/23, `22` com 100/100. Se `throws_ok(..., '42501', …)` do teste 15 vier com outro código (o PostgREST não entra aqui; é SQL direto), confira com `\df+` que o `revoke` valeu e **corrija a migração**, não o teste.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env` antes)

```bash
git add supabase/migrations/20261101000100_confiabilidade_agente.sql supabase/tests/80_confiabilidade_agente.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): falhas do agente, reserva do modo seguro e mensagem parada (confiabilidade, D2, D7, D8, D11)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Repositório. Registrar falha, reservar o modo seguro, disjuntor e mensagem parada

**Files:**
- Modify: `packages/db/src/repos.ts` (tipos e métodos novos, no fim do objeto e dos tipos), `packages/db/test/limpar.ts`
- Create: `packages/db/test/confiabilidade.test.ts`

**Interfaces:**
- Consumes: a migração da Task 3; `checar`, `SEM_PARTE_I` (já existem em `repos.ts`).
- Produces:
  - `export type NovaFalhaAgente = { conversaId: string | null; clienteId: string | null; agenteId: string | null; tipo: 'passageiro' | 'saldo' | 'chave' | 'pedido_invalido' | 'envio' | 'codigo'; etapa: 'ia' | 'ferramenta' | 'envio' | 'outro'; tentativa: number; ultima: boolean; erro: string; modelo: string | null; acao: 'tentar_de_novo' | 'modo_seguro' | 'modo_seguro_sem_mensagem' }`
  - `registrarFalhaAgente(f: NovaFalhaAgente): Promise<void>` — banco sem a migração: não lança (só `console.error`).
  - `reservarModoSeguro(conversaId: string, horas: number): Promise<boolean>` — banco sem a migração: `true` (comportamento de hoje: manda).
  - `falhaDefinitivaRecente(minutos: number): Promise<'saldo' | 'chave' | null>` — banco sem a migração: `null`.
  - `conversasComMensagemParada(deMin: number, ateMin: number): Promise<{ conversaId: string; desde: string; reenvios: number; ultimoReenvio: string | null }[]>` — banco sem a migração: `[]`.
  - `marcarReenfileirada(conversaId: string): Promise<void>` — banco sem a migração: não faz nada.
  - `loteJaAtendido(conversaId: string, mensagemIds: string[]): Promise<boolean>` (revisão P1-1, D16) — `true` se existe decisão `lote` com exatamente estes ids **e** outra decisão do mesmo `turno` que não seja `lote` nem `orientacoes_cortadas`.
  - **Muda (exceção pedida pela revisão P1-1):** `contarDecisoesDesde` passa a ignorar também a etapa `lote` (mesma assinatura; os testes antigos de nova tentativa continuam passando porque hoje não existe `lote`).

- [ ] **Step 1: Escreva o teste que falha** — `packages/db/test/confiabilidade.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const falha = (x: Partial<Parameters<typeof repos.registrarFalhaAgente>[0]> = {}) => repos.registrarFalhaAgente({
  conversaId: null, clienteId: null, agenteId: null, tipo: 'saldo', etapa: 'ia', tentativa: 0, ultima: true,
  erro: 'BadRequestError 400: credit balance', modelo: 'claude-sonnet-5', acao: 'modo_seguro', ...x,
});

beforeEach(async () => { await limparBanco(); });

describe('falhas do agente (confiabilidade)', () => {
  it('registra e o disjuntor acha saldo ou chave recentes, não as outras', async () => {
    expect(await repos.falhaDefinitivaRecente(10)).toBeNull();
    await falha({ tipo: 'passageiro', acao: 'tentar_de_novo', ultima: false });
    expect(await repos.falhaDefinitivaRecente(10)).toBeNull();
    await falha({ tipo: 'chave' });
    expect(await repos.falhaDefinitivaRecente(10)).toBe('chave');
    await db.from('falhas_agente').update({ criado_em: new Date(Date.now() - 11 * 60_000).toISOString() }).eq('tipo', 'chave');
    expect(await repos.falhaDefinitivaRecente(10)).toBeNull();
  });

  it('reserva o modo seguro uma vez a cada 4 h', async () => {
    const c = await repos.obterOuCriarConversa('5531980000011', null);
    expect(await repos.reservarModoSeguro(c.id, 4)).toBe(true);
    expect(await repos.reservarModoSeguro(c.id, 4)).toBe(false);
  });

  it('acha a conversa com mensagem parada entre os limites e conta as devoluções', async () => {
    const c = await repos.obterOuCriarConversa('5531980000012', null);
    await repos.inserirMensagemEntrada({ conversaId: c.id, clienteId: null, idProvedor: 'P1', tipo: 'texto', conteudo: 'oi' });
    await db.from('mensagens').update({ criado_em: new Date(Date.now() - 5 * 60_000).toISOString() }).eq('id_provedor', 'P1');
    expect((await repos.conversasComMensagemParada(3, 30)).map((x) => x.conversaId)).toEqual([c.id]);
    expect(await repos.conversasComMensagemParada(30, 600)).toEqual([]);
    await repos.marcarReenfileirada(c.id);
    expect((await repos.conversasComMensagemParada(3, 30))[0]).toMatchObject({ reenvios: 1, ultimoReenvio: expect.any(String) });
  });

  it('lote já atendido (D16): só com lote + ação no mesmo turno; contarDecisoesDesde ignora o lote', async () => {
    const c = await repos.obterOuCriarConversa('5531980000013', null);
    const { id } = await repos.inserirMensagemEntrada({ conversaId: c.id, clienteId: null, idProvedor: 'L1', tipo: 'texto', conteudo: 'oi' });
    const desde = new Date(Date.now() - 60_000).toISOString();
    await repos.registrarDecisao({ conversaId: c.id, clienteId: null, etapa: 'lote', entrada: { mensagens: [id] }, saida: null, turno: 'T1' });
    expect(await repos.loteJaAtendido(c.id, [id])).toBe(false);
    expect(await repos.contarDecisoesDesde(c.id, desde)).toBe(0);
    await repos.registrarDecisao({ conversaId: c.id, clienteId: null, etapa: 'responder', entrada: { texto: 'Olá' }, saida: { enviado: true }, turno: 'T1' });
    expect(await repos.loteJaAtendido(c.id, [id])).toBe(true);
    expect(await repos.loteJaAtendido(c.id, [id, '00000000-0000-0000-0000-000000000000'])).toBe(false);
  });

  it('erro maior que 300 é cortado antes de gravar (a trava do banco não derruba o registro)', async () => {
    await falha({ erro: 'x'.repeat(400) });
    const { data } = await db.from('falhas_agente').select('erro');
    expect(data![0]!.erro.length).toBe(300);
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/db exec vitest run test/confiabilidade.test.ts`
Expected: FAIL (métodos não existem).

- [ ] **Step 3: Implemente** — em `packages/db/src/repos.ts`, perto dos outros tipos exportados:

```ts
/** Plano de confiabilidade (D7): uma falha do agente de clientes. `erro` sem texto do cliente (resumoDoErro). */
export type NovaFalhaAgente = {
  conversaId: string | null; clienteId: string | null; agenteId: string | null;
  tipo: 'passageiro' | 'saldo' | 'chave' | 'pedido_invalido' | 'envio' | 'codigo';
  etapa: 'ia' | 'ferramenta' | 'envio' | 'outro'; tentativa: number; ultima: boolean; erro: string; modelo: string | null;
  acao: 'tentar_de_novo' | 'modo_seguro' | 'modo_seguro_sem_mensagem';
};
```

e no fim do objeto devolvido por `criarRepos`:

```ts
    /** Plano de confiabilidade (D7). Banco sem a migração: só o log (o atendimento não pode parar por causa do registro). */
    async registrarFalhaAgente(f: NovaFalhaAgente): Promise<void> {
      const r = await db.from('falhas_agente').insert({
        conversa_id: f.conversaId, cliente_id: f.clienteId, agente_id: f.agenteId, tipo: f.tipo, etapa: f.etapa,
        tentativa: f.tentativa, ultima: f.ultima, erro: f.erro.slice(0, 300), modelo: f.modelo, acao: f.acao,
      });
      if (r.error) console.error('[falhas] não registrada', SEM_PARTE_I.has(r.error.code) ? '(banco sem a migração)' : r.error.message);
    },

    /** D2: true = esta vez manda a mensagem do modo seguro. Banco sem a migração: manda (como antes). */
    async reservarModoSeguro(conversaId: string, horas: number): Promise<boolean> {
      const r = await db.rpc('reservar_modo_seguro', { p_conversa: conversaId, p_horas: horas });
      if (r.error && SEM_PARTE_I.has(r.error.code)) return true;
      return Boolean(checar(r, 'reservarModoSeguro'));
    },

    /** D5: saldo ou chave da IA falharam nos últimos `minutos`? (o disjuntor não chama a IA). */
    async falhaDefinitivaRecente(minutos: number): Promise<'saldo' | 'chave' | null> {
      const desde = new Date(Date.now() - minutos * 60_000).toISOString();
      const r = await db.from('falhas_agente').select('tipo').in('tipo', ['saldo', 'chave']).gte('criado_em', desde)
        .order('criado_em', { ascending: false }).limit(1);
      if (r.error && SEM_PARTE_I.has(r.error.code)) return null;
      const linhas = checar(r, 'falhaDefinitivaRecente');
      return (linhas[0]?.tipo as 'saldo' | 'chave' | undefined) ?? null;
    },

    /** D11: conversas com o agente e mensagem de cliente parada entre `deMin` e `ateMin` minutos, com as devoluções à fila. */
    async conversasComMensagemParada(deMin: number, ateMin: number): Promise<{ conversaId: string; desde: string; reenvios: number; ultimoReenvio: string | null }[]> {
      const r = await db.rpc('conversas_com_mensagem_parada', { p_de_min: deMin, p_ate_min: ateMin });
      if (r.error && SEM_PARTE_I.has(r.error.code)) return [];
      return checar(r, 'conversasComMensagemParada').map((x) => ({ conversaId: x.conversa_id, desde: x.desde, reenvios: x.reenvios, ultimoReenvio: x.ultimo_reenvio }));
    },

    /** D11 (revisão P1-2/P1-8): o batimento devolveu as mensagens paradas desta conversa à fila mais uma vez. */
    async marcarReenfileirada(conversaId: string): Promise<void> {
      const r = await db.rpc('marcar_reenfileirada', { p_conversa: conversaId });
      if (r.error && !SEM_PARTE_I.has(r.error.code)) throw new Error(`marcarReenfileirada: ${r.error.message}`);
    },

    /** D16 (revisão P1-1): este lote de mensagens já teve ação do agente (o trabalhador caiu antes de marcar como processadas)? */
    async loteJaAtendido(conversaId: string, mensagemIds: string[]): Promise<boolean> {
      const lotes = checar(await db.from('decisoes_agente').select('entrada, turno').eq('conversa_id', conversaId).eq('etapa', 'lote')
        .order('criado_em', { ascending: false }).limit(20), 'loteJaAtendido');
      const alvo = [...mensagemIds].sort().join(',');
      const turnos = lotes.filter((l) => l.turno && [...((l.entrada as { mensagens?: string[] } | null)?.mensagens ?? [])].sort().join(',') === alvo).map((l) => l.turno!);
      if (turnos.length === 0) return false;
      const acoes = await db.from('decisoes_agente').select('id', { count: 'exact', head: true }).eq('conversa_id', conversaId)
        .in('turno', turnos).not('etapa', 'in', '(lote,orientacoes_cortadas)');
      if (acoes.error) throw new Error(`loteJaAtendido: ${acoes.error.message}`);
      return (acoes.count ?? 0) > 0;
    },
```

Em `contarDecisoesDesde` (`repos.ts:511-516`), troque `.neq('etapa', 'orientacoes_cortadas')` por `.not('etapa', 'in', '(orientacoes_cortadas,lote)')` e o comentário por `/** Ações do agente na conversa desde `desdeIso` (decide a nova tentativa). O aviso de orientações cortadas e o registro do lote (D16) não são ação. */`.

(`SEM_PARTE_I` tem os códigos de "tabela/função não existe": `42P01`, `42883`, `PGRST202`, `PGRST205`…; serve para qualquer migração que ainda não chegou. Se `checar` tiver outra forma de devolver o `data` de RPC que retorna tabela, siga a que `tarefasParadas` usa no mesmo arquivo.)

Em `packages/db/test/limpar.ts`, depois do bloco da Parte I3b:

```ts
  // Plano de confiabilidade: as falhas do agente somem e a reserva do modo seguro volta a vazia.
  await c.query(`do $$ begin
    if to_regclass('public.falhas_agente') is not null then truncate public.falhas_agente; end if;
    end $$`);
```

(`conversas` já é truncada; `modo_seguro_em` vai junto.)

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck`
Expected: PASS (os testes antigos do pacote sem mudança).

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env` antes)

```bash
git add packages/db/src/repos.ts packages/db/test/limpar.ts packages/db/test/confiabilidade.test.ts
git commit -m "feat(db): registrar falha do agente, reservar o modo seguro, disjuntor e mensagem parada (confiabilidade)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Trabalhador. Modo seguro, disjuntor e alertas (D1, D2, D5, D6, D12)

**Files:**
- Create: `apps/trabalhador/src/modo-seguro.ts`, `apps/trabalhador/test/confiabilidade/modo-seguro.test.ts`
- Modify: `apps/trabalhador/src/processar-conversa.ts` (o `catch`, o ramo do teto e o disjuntor antes de chamar o agente), `apps/trabalhador/src/retencao.ts` (guarda de 1 ano de `falhas_agente`)

**Interfaces:**
- Consumes: `tipoFalha`, `resumoDoErro`, `FALHAS_DEFINITIVAS_DA_CONTA`, `type TipoFalha` (Task 1); `repos.registrarFalhaAgente`, `repos.reservarModoSeguro`, `repos.falhaDefinitivaRecente` (Task 4); `enviarDoSistema`, `Alertas`, `MOTIVOS_PASSAGEM`.
- Produces:
  - `export const HORAS_MODO_SEGURO = 4;` `export const MINUTOS_DISJUNTOR = 10;`
  - `export const MSG_ALERTA_CONTA: Record<'saldo' | 'chave', string>`
  - `export type DepsModoSeguro = { repos: Repos; envio: DepsEnvio; alertas: Alertas; relogio: () => Date }`
  - `export async function entrarEmModoSeguro(d: DepsModoSeguro, p: { conversa: Conversa; tipo: TipoFalha; motivoTriagem: string; motivoPassagem: string; mensagem: string | null; setorId: string | null }): Promise<'enviada' | 'ja_enviada' | 'sem_mensagem' | 'falhou_envio'>`
  - `export function etapaDaFalha(tipo: TipoFalha): 'ia' | 'ferramenta' | 'envio' | 'outro'`

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/confiabilidade/modo-seguro.test.ts` (banco local, como `processar-conversa.test.ts`):

```ts
import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { MSG_ALERTA_CONTA } from '../../src/modo-seguro';
import { processarConversa, type DepsProcessamento } from '../../src/processar-conversa';
import { contatoComEmpresas, db, repos } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
const AVISO = 'Recebemos sua mensagem, já vamos te atender.';
const daApi = (status: number, mensagem: string) =>
  Anthropic.APIError.generate(status, { type: 'error', error: { type: 'x', message: mensagem } }, mensagem, new Headers());
const SALDO = () => daApi(400, 'Your credit balance is too low to access the Anthropic API.');
const SOBRECARGA = () => daApi(529, 'Overloaded');

let canal: CanalFalso;
let alertas: { nivel: string; mensagem: string; setorId?: string | null }[];
function deps(ia: { criar: (...a: never[]) => Promise<unknown> }): DepsProcessamento {
  return {
    repos, ia: ia as never, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db),
    transcritor: { modelo: 'x', provedor: 'groq', transcrever: vi.fn() },
    alertas: { alertar: async (a) => { alertas.push(a); } },
    relogio: () => SEGUNDA_10H,
  };
}
async function receber(conversaId: string, id: string, texto = 'oi') {
  await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor: id, tipo: 'texto', conteudo: texto });
}
const falhas = async () => (await db.from('falhas_agente').select('tipo, acao, ultima, erro').order('criado_em')).data!;
const triagens = async (conversaId: string) => (await db.from('chamados').select('id, setor_id, responsavel_id').eq('conversa_id', conversaId)).data!;

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  alertas = [];
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
});

describe('modo seguro (critérios de aceite do Prompt 1)', () => {
  it('529 em todas as tentativas: UMA mensagem, sem responsável, esperando pessoa, alerta e falhas registradas', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1');
    await expect(processarConversa(deps(new IaRoteirizada([SOBRECARGA()])), conversa.id, false)).rejects.toThrow();
    await expect(processarConversa(deps(new IaRoteirizada([SOBRECARGA()])), conversa.id, false)).rejects.toThrow();
    expect(await processarConversa(deps(new IaRoteirizada([SOBRECARGA()])), conversa.id, true)).toBe('escalado');
    expect(canal.enviados.map((e) => e.texto)).toEqual([AVISO]);
    const t = await triagens(conversa.id);
    expect(t).toHaveLength(1);
    expect(t[0]!.responsavel_id).toBeNull();
    expect((await repos.obterConversa(conversa.id)).aguardando_pessoa_desde).not.toBeNull();
    expect(alertas.filter((a) => a.nivel === 'aviso')).toHaveLength(1);
    expect((await falhas()).map((f) => `${f.tipo}:${f.acao}`)).toEqual(['passageiro:tentar_de_novo', 'passageiro:tentar_de_novo', 'passageiro:modo_seguro']);
  });

  it('saldo esgotado: não relança, mesma saída, e o dono recebe o alerta operacional uma vez', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1');
    expect(await processarConversa(deps(new IaRoteirizada([SALDO()])), conversa.id, false)).toBe('escalado');
    expect(canal.enviados.map((e) => e.texto)).toEqual([AVISO]);
    expect(alertas.filter((a) => a.mensagem === MSG_ALERTA_CONTA.saldo && a.nivel === 'operacional')).toHaveLength(1);
    expect((await falhas()).map((f) => f.tipo)).toEqual(['saldo']);
  });

  it('disjuntor (D5): com saldo esgotado há pouco, a conversa seguinte não chama a IA; um alerta só', async () => {
    const a = await contatoComEmpresas(['Indústria X'], '5531970000001');
    const b = await contatoComEmpresas([], '5531970000002');   // sem empresa: o CNPJ de teste da primeira se repetiria
    for (const c of [a.conversa, b.conversa]) await repos.atualizarConversa(c.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(a.conversa.id, 'A1');
    await processarConversa(deps(new IaRoteirizada([SALDO()])), a.conversa.id, false);
    await receber(b.conversa.id, 'B1');
    const ia = new IaRoteirizada([]);
    expect(await processarConversa(deps(ia), b.conversa.id, false)).toBe('escalado');
    expect(ia.recebidos).toHaveLength(0);
    expect(canal.enviados.filter((e) => e.texto === AVISO)).toHaveLength(2);
    expect(alertas.filter((x) => x.mensagem === MSG_ALERTA_CONTA.saldo)).toHaveLength(1);
  });

  it('cliente insistente (D2): 3 mensagens com a IA fora em 1 hora = 1 mensagem do modo seguro', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    for (const id of ['M1', 'M2', 'M3']) {
      await receber(conversa.id, id, `oi ${id}`);
      await processarConversa(deps(new IaRoteirizada([SOBRECARGA()])), conversa.id, true);
    }
    expect(canal.enviados.filter((e) => e.texto === AVISO)).toHaveLength(1);
    expect(await triagens(conversa.id)).toHaveLength(1);
  });

  it('nunca texto técnico ao cliente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1');
    await processarConversa(deps(new IaRoteirizada([daApi(400, 'messages.1: tool_use without tool_result')])), conversa.id, true);
    for (const e of canal.enviados) expect(e.texto ?? '').not.toMatch(/erro|api|falha|tool|crédito|credit/i);
  });

  it('falha depois de agir (D12): não relança; Z-API fora também para o aviso → triagem, alerta e "sem mensagem"', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1');
    canal.falharEnvio = true;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('escalado');
    expect(await triagens(conversa.id)).toHaveLength(1);
    expect(alertas).toHaveLength(1);
    // O CanalFalso lança "falha simulada" (tipo codigo); com a Z-API de verdade o tipo é envio (Task 1).
    expect((await falhas()).map((f) => `${f.tipo}:${f.acao}`)).toEqual(['codigo:modo_seguro_sem_mensagem']);
  });

  it('mensagem do modo seguro vazia em Configurações: não manda nada, mas triagem e alerta acontecem', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    const { data: cfg } = await db.from('configuracoes').select('mensagens').eq('id', 1).single();
    await db.from('configuracoes').update({ mensagens: { ...(cfg!.mensagens as object), ia_indisponivel: '' } }).eq('id', 1);
    await receber(conversa.id, 'M1');
    await processarConversa(deps(new IaRoteirizada([SALDO()])), conversa.id, false);
    expect(canal.enviados).toHaveLength(0);
    expect(await triagens(conversa.id)).toHaveLength(1);
  });
});
```

Ajudantes conferidos em `fa76a76`: `contatoComEmpresas(nomes, telefone = '5531999990001', acesso)` (`test/apoio/cenario.ts:44`; o CNPJ vem da posição na lista, por isso o segundo contato do teste do disjuntor vem sem empresa) e `CanalFalso.falharEnvio` (`src/canal/falso.ts:10`, lança `'falha simulada'`). `CanalFalso` **não muda**.

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/confiabilidade/modo-seguro.test.ts`
Expected: FAIL (`modo-seguro.ts` não existe; nenhum alerta; mais de uma mensagem no teste do cliente insistente).

- [ ] **Step 3: Implemente `apps/trabalhador/src/modo-seguro.ts`:**

```ts
import type { Conversa, Repos } from '@escritorio/db';
import type { TipoFalha } from './agente/cliente-ia';
import type { Alertas } from './alertas';
import { enviarDoSistema, type DepsEnvio } from './envio';

/** Plano de confiabilidade (D2): a mensagem do modo seguro sai no máximo uma vez neste prazo, por conversa. */
export const HORAS_MODO_SEGURO = 4;
/** D5: depois de saldo ou chave recusados, por este tempo as conversas novas não chamam a IA. */
export const MINUTOS_DISJUNTOR = 10;
/** D6: textos fixos (a conferência de "alerta recente" compara o texto). */
export const MSG_ALERTA_CONTA = {
  saldo: 'O saldo da IA (Anthropic) acabou: o agente parou de responder e as conversas foram para a equipe. Recarregue os créditos no console da Anthropic.',
  chave: 'A chave da IA (Anthropic) foi recusada: o agente parou de responder e as conversas foram para a equipe. Confira a ANTHROPIC_API_KEY do trabalhador.',
} as const;
const MINUTOS_ALERTA_CONTA = 30;

export type DepsModoSeguro = { repos: Repos; envio: DepsEnvio; alertas: Alertas; relogio: () => Date };

export function etapaDaFalha(tipo: TipoFalha): 'ia' | 'ferramenta' | 'envio' | 'outro' {
  if (tipo === 'envio') return 'envio';
  if (tipo === 'codigo') return 'outro';
  return 'ia';
}

/**
 * A IA não respondeu de vez: a conversa vai para a equipe (triagem sem responsável + "esperando pessoa"), o cliente recebe a
 * mensagem fixa no máximo uma vez a cada 4 h, e a equipe é avisada. Cada passo no seu try: um que falha não pula os outros.
 */
export async function entrarEmModoSeguro(
  d: DepsModoSeguro,
  p: {
    conversa: Conversa; tipo: TipoFalha; motivoTriagem: string; motivoPassagem: string; mensagem: string | null; setorId: string | null;
    /** Teto do mês: já tem o alerta de 80% e o cartão "Parado pelo teto"; aqui não avisa de novo. */
    semAlerta?: boolean;
  },
): Promise<'enviada' | 'ja_enviada' | 'sem_mensagem' | 'falhou_envio'> {
  const { conversa } = p;
  try {
    const abertos = await d.repos.chamadosAbertosDaConversa(conversa.id);
    if (!abertos.some((c) => c.setor_id === null)) {
      await d.repos.abrirChamado({
        clienteId: conversa.cliente_em_foco, conversaId: conversa.id, setorId: null, responsavelId: null,
        titulo: p.motivoTriagem, resumo: 'Atendimento encaminhado automaticamente para a equipe.', foraDoContrato: false, origem: 'sistema',
      });
    }
  } catch (e) { console.error('[modo seguro] triagem não aberta', conversa.id, e); }
  await d.repos.marcarAguardandoPessoa(conversa.id, p.motivoPassagem).catch((e) => console.error('[modo seguro] passagem não marcada', conversa.id, e));

  let saida: 'enviada' | 'ja_enviada' | 'sem_mensagem' | 'falhou_envio' = 'sem_mensagem';
  const texto = (p.mensagem ?? '').trim();
  // A reserva é também o "1 alerta por conversa a cada 4 h" (D6): sem reserva, a equipe já foi avisada desta conversa.
  const reservou = await d.repos.reservarModoSeguro(conversa.id, HORAS_MODO_SEGURO).catch(() => true);
  if (!reservou) saida = 'ja_enviada';
  else if (texto) {
    saida = await enviarDoSistema(d.envio, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: conversa.cliente_em_foco, autor: 'sistema', texto })
      .then(() => 'enviada' as const)
      .catch((e) => { console.error('[modo seguro] mensagem não enviada', conversa.id, e); return 'falhou_envio' as const; });
  }

  if (p.tipo === 'saldo' || p.tipo === 'chave') {
    const msg = MSG_ALERTA_CONTA[p.tipo];
    if (!(await d.repos.alertaRecente(msg, MINUTOS_ALERTA_CONTA).catch(() => false))) {
      await d.alertas.alertar({ nivel: 'operacional', mensagem: msg }).catch((e) => console.error('[modo seguro] alerta não gravado', e));
    }
  } else if (reservou && !p.semAlerta) {
    await d.alertas.alertar({
      nivel: 'aviso', setorId: p.setorId,
      mensagem: `O agente não conseguiu responder um cliente (${conversa.telefone.slice(-4).padStart(8, '•')}). A conversa está esperando uma pessoa no Atendimento.`,
    }).catch((e) => console.error('[modo seguro] alerta não gravado', e));
  }
  return saida;
}
```

Em `apps/trabalhador/src/processar-conversa.ts`:

1. Importe `FALHAS_DEFINITIVAS_DA_CONTA, resumoDoErro, tipoFalha` de `./agente/cliente-ia` (junto de `erroTemporarioIa`) e `MINUTOS_DISJUNTOR, entrarEmModoSeguro, etapaDaFalha` de `./modo-seguro`; `modeloDoPerfil, perfilDoContexto` de `./agente/perfil`.
2. Uma função local para o setor conhecido (D6):

```ts
/** D6: o setor que recebe o aviso — o do agente que conduz a conversa, senão a demanda aberta mais recente com setor. */
async function setorConhecido(d: DepsProcessamento, ctx: { conducao?: { setorId: string } | null }, conversaId: string): Promise<string | null> {
  if (ctx.conducao?.setorId) return ctx.conducao.setorId;
  const abertos = await d.repos.chamadosAbertosDaConversa(conversaId).catch(() => []);
  return [...abertos].filter((c) => c.setor_id).sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0]?.setor_id ?? null;
}
```

3. **Teto** (o ramo `if ((await d.repos.custoIaDoMes(mes)) >= config.tetoIaUsd)`): troque `await encaminharParaHumano(d, conversa, 'Limite mensal de gasto com IA atingido', config.mensagens.ia_indisponivel ?? null); await marcarPassagem(d, conversa.id, MOTIVOS_PASSAGEM.teto);` por:

```ts
    // D2: o teto também é "a IA não está respondendo": a mensagem sai no máximo uma vez a cada 4 h por conversa.
    await entrarEmModoSeguro(d, { conversa, tipo: 'codigo', motivoTriagem: 'Limite mensal de gasto com IA atingido',
      motivoPassagem: MOTIVOS_PASSAGEM.teto, mensagem: config.mensagens.ia_indisponivel ?? null, setorId: null, semAlerta: true });
```

   (`semAlerta` já está nos parâmetros de `entrarEmModoSeguro`, acima.) Não registra falha (teto não é falha). Confira que `processar-conversa.test.ts` "teto de gasto com IA atingido…" continua passando sem mudança.

4. **Disjuntor (D5)**, logo **depois** do bloco do teto e **antes** de `const historico = …`:

```ts
  // D5: saldo ou chave recusados há pouco — não chama a IA (não espera nem gera falha repetida); vai direto ao modo seguro.
  const disjuntor = await d.repos.falhaDefinitivaRecente(MINUTOS_DISJUNTOR);
  if (disjuntor) {
    await avisarRespostaAosPedidos(d.repos, conversa.id, ctx.contato?.id, ctx.pedidosAoContato);
    await entrarEmModoSeguro(d, { conversa, tipo: disjuntor, motivoTriagem: 'Falha no agente de IA', motivoPassagem: MOTIVOS_PASSAGEM.falha,
      mensagem: config.mensagens.ia_indisponivel ?? null, setorId: await setorConhecido(d, ctx, conversa.id) });
    await d.repos.marcarProcessadas(ids);
    return 'escalado';
  }
```

5. **O `catch`** de `atenderComAgentes` passa a ser:

```ts
  } catch (e) {
    const tipo = tipoFalha(e);
    const perfil = perfilDoContexto(ctx);
    const base = { conversaId: conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null, agenteId: ctx.conducao?.id ?? perfil.id ?? null,
      tipo, etapa: etapaDaFalha(tipo), tentativa: tentativa ?? 0, erro: resumoDoErro(e), modelo: modeloDoPerfil(perfil, config) };
    // Só relança (nova tentativa) se a IA falhou antes de qualquer ação; depois disso, relançar repetiria ferramentas.
    // Saldo e chave nunca relançam (D4): tentar de novo não resolve.
    if (!agenteAgiu && erroTemporarioIa(e) && !FALHAS_DEFINITIVAS_DA_CONTA.includes(tipo) && !ultimaTentativa
      && (await d.repos.contarDecisoesDesde(conversaId, novas[0]!.criado_em)) === 0) {
      await d.repos.registrarFalhaAgente({ ...base, ultima: false, acao: 'tentar_de_novo' });
      throw e;
    }
    console.error('[agente] falha', e);
    if (await assumidaPorHumano(d, conversaId)) {
      desfecho = 'humano';
    } else {
      const r = await entrarEmModoSeguro(d, { conversa, tipo, motivoTriagem: 'Falha no agente de IA', motivoPassagem: MOTIVOS_PASSAGEM.falha,
        mensagem: config.mensagens.ia_indisponivel ?? null, setorId: await setorConhecido(d, ctx, conversa.id) });
      await d.repos.registrarFalhaAgente({ ...base, ultima: true, acao: r === 'falhou_envio' ? 'modo_seguro_sem_mensagem' : 'modo_seguro' });
      desfecho = 'escalado';
    }
  }
```

6. `processarConversa` ganha o parâmetro opcional `tentativa?: number` (depois de `ultimaTentativa`), só para o registro; `principal.ts` (Task 6) passa `job!.retryCount`. Chamadas antigas continuam valendo (padrão 0).
7. `encaminharParaHumano` **continua** para o ramo `r.status === 'escalar'` e o ramo "pausado" (sem mudança).

**Tipo de `perfilDoContexto(ctx).id`:** `PerfilAgente.id` é `string | null`; está certo passar `null`.

Em `apps/trabalhador/src/retencao.ts`, depois de `assistente_mensagens`:

```ts
  // Plano de confiabilidade (D7): as falhas do agente ficam 1 ano, como as decisões. Banco sem a migração: segue.
  const { data: falhas, error: e7 } = await db.from('falhas_agente').delete().lt('criado_em', corte).select('id');
  if (e7 && !['42P01', 'PGRST205'].includes(e7.code)) throw new Error(e7.message);
```

e **não** mude o objeto devolvido (o `retencao.test.ts` fixa as chaves: confira; se ele usar `toEqual` com o objeto inteiro, **não** acrescente `falhas` ao retorno).

- [ ] **Step 3b: O que a revisão crítica acrescentou (P1-1, P1-4b, P1-5, P1-9)** — primeiro os testes, no fim de `test/confiabilidade/modo-seguro.test.ts`:

```ts
describe('revisão crítica', () => {
  it('P1-1 (D16): respondeu e caiu antes de marcar como processada → a nova vez não responde de novo nem repete ferramentas', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1');
    const [m] = await repos.mensagensNaoProcessadas(conversa.id);
    // O que a vez que caiu deixou: o lote e a resposta no mesmo turno, sem marcar a mensagem.
    await repos.registrarDecisao({ conversaId: conversa.id, clienteId: null, etapa: 'lote', entrada: { mensagens: [m!.id] }, saida: null, turno: 'T-caiu' });
    await repos.registrarDecisao({ conversaId: conversa.id, clienteId: null, etapa: 'responder', entrada: { texto: 'Olá!' }, saida: { enviado: true }, turno: 'T-caiu' });
    const ia = new IaRoteirizada([]);
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('ja-atendido');
    expect(ia.recebidos).toHaveLength(0);
    expect(canal.enviados).toHaveLength(0);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
  });

  it('P1-1 (D16): a vez normal grava o lote com o mesmo turno das ferramentas', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1');
    await processarConversa(deps(new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()])), conversa.id, false);
    const { data } = await db.from('decisoes_agente').select('etapa, turno').eq('conversa_id', conversa.id);
    const lote = data!.find((x) => x.etapa === 'lote')!;
    expect(data!.find((x) => x.etapa === 'responder')!.turno).toBe(lote.turno);
  });

  it('P1-9: com demanda aberta no Fiscal, o aviso vai para o Fiscal', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    const fiscal = (await db.from('setores').select('id').eq('nome', 'Fiscal').single()).data!.id;
    await db.from('chamados').insert({ cliente_id: empresas[0]!.id, conversa_id: conversa.id, setor_id: fiscal, titulo: 'NF de venda' });
    await receber(conversa.id, 'M1');
    await processarConversa(deps(new IaRoteirizada([SOBRECARGA()])), conversa.id, true);
    expect(alertas.filter((a) => a.nivel === 'aviso').map((a) => a.setorId)).toEqual([fiscal]);
  });

  it('P1-5: fora do expediente, o modo seguro manda a mensagem de fora do horário', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1');
    const domingo = { ...deps(new IaRoteirizada([SALDO()])), relogio: () => new Date('2026-09-27T13:00:00Z') };
    await processarConversa(domingo, conversa.id, false);
    expect(canal.enviados.map((e) => e.texto)).toHaveLength(1);
    expect(canal.enviados[0]!.texto).not.toBe(AVISO);
    expect(canal.enviados[0]!.texto).toContain('Nossa equipe atende');
  });
});
```

(`AVISO`, `SALDO`, `SOBRECARGA`, `receber`, `deps` e `alertas` são os do começo do arquivo. O texto padrão de "fora do horário" está em `20260927000100_base.sql:107` — "Nossa equipe atende de segunda a sexta…".)

Depois a implementação:
1. **D16 em `processarConversa`** — logo depois do bloco do teto e do disjuntor, e antes de `const historico = …`:

```ts
  // D16 (revisão P1-1): o trabalhador caiu depois de agir e antes de marcar como processadas — não responde de novo.
  if (await d.repos.loteJaAtendido(conversa.id, ids)) {
    await d.repos.marcarProcessadas(ids);
    return 'ja-atendido';
  }
  const turno = randomUUID();
  await d.repos.registrarDecisao({ conversaId: conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null, etapa: 'lote', entrada: { mensagens: ids }, saida: null, turno });
```

   e a chamada passa o turno: `atenderComAgentes(d, ctx, montarConteudoUsuario(…), turno)`. `DesfechoProcessamento` ganha `'ja-atendido'`; `import { randomUUID } from 'node:crypto'`.
2. **`agente/atender.ts`** (acrescente ao "Só mexer em"): `atenderComAgentes(d, ctx, conteudo, turno?: string)` repassa `{ turno }` nas três chamadas de `executarAgente` (`executarAgente(d, ctx, conteudo, undefined, { turno })` no lugar de `executarAgente(d, ctx, conteudo)`, e `turno` junto do `papel` na do especialista). Sem `turno`, tudo como hoje (`executarAgente` sorteia).
3. **P1-5 em `entrarEmModoSeguro`**: a chamada em `processarConversa` (as três: teto, disjuntor, `catch`) passa `mensagem: ctx.noExpediente ? config.mensagens.ia_indisponivel ?? null : avisoForaDoHorario(ctx)` (importe `avisoForaDoHorario` de `./agente/ferramentas`: `ferramentas.ts:400`, já troca `{inicio}`/`{fim}`).
4. **P1-4b — o Assistente e as tarefas também registram saldo e chave:** em `assistente/processar.ts`, no `catch` de `executarAssistente` (linha 78), antes de `if (!ultimaTentativa) throw e;`:

```ts
    // Confiabilidade (revisão P1-4b): saldo ou chave da IA também vistos pelo Assistente; o batimento avisa o dono.
    const tipo = tipoFalha(e);
    if (tipo === 'saldo' || tipo === 'chave') {
      await d.repos.registrarFalhaAgente({ conversaId: null, clienteId: null, agenteId: null, tipo, etapa: 'ia', tentativa: 0, ultima: true,
        erro: resumoDoErro(e), modelo: null, acao: 'modo_seguro_sem_mensagem' });
    }
```

   e o mesmo bloco em `tarefa/processar.ts`, no `catch` da linha 43, antes de `if (erroTemporarioIa(e) && !ultimaTentativa)`. O **alerta** sai pelo batimento (Task 6, item 4), que tem `alertas`; assim nenhuma dependência nova entra no Assistente nem nas tarefas. Acrescente `apps/trabalhador/src/{agente/atender,assistente/processar,tarefa/processar}.ts` ao "Só mexer em" das Restrições globais.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS, inclusive `processar-conversa.test.ts` inteiro **sem mudança** (o teste da linha 285 continua: 2ª chamada com `ultimaTentativa = true` manda o aviso uma vez; o da linha 173, teto, continua). Se algum teste antigo esperar o aviso de IA indisponível **duas vezes** na mesma conversa em menos de 4 h, **pare** e avise (é a mudança da D2).

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/modo-seguro.ts apps/trabalhador/src/processar-conversa.ts apps/trabalhador/src/retencao.ts apps/trabalhador/src/agente/atender.ts apps/trabalhador/src/assistente/processar.ts apps/trabalhador/src/tarefa/processar.ts apps/trabalhador/test/confiabilidade/modo-seguro.test.ts
git commit -m "feat(agente): modo seguro quando a IA falha — uma mensagem a cada 4 h, conversa com a equipe, alerta e disjuntor de saldo (confiabilidade, D1, D2, D5, D6, D12)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```


---

### Task 6: Trabalhador. Prazo do job, paralelismo, mensagem parada e o webhook reentregue (D3, D9, D10, D11)

**Files:**
- Modify: `apps/trabalhador/src/fila.ts`, `apps/trabalhador/src/config.ts`, `apps/trabalhador/src/principal.ts`, `apps/trabalhador/src/tarefas.ts`
- Create: `apps/trabalhador/test/confiabilidade/fila-parada.test.ts`, `apps/trabalhador/test/confiabilidade/webhook-reentregue.test.ts`

**Interfaces:**
- Consumes: `repos.conversasComMensagemParada` (Task 4), `entrarEmModoSeguro` (Task 5), `agendarProcessamento`, `criarServidor`.
- Produces:
  - `Config.CONCORRENCIA_AGENTE: number` (1–8, padrão 4);
  - `export const MINUTOS_PARADA = { devolver: 3, modoSeguro: 30 } as const;` em `tarefas.ts`;
  - `export async function conversasParadas(d: DepsTarefas): Promise<{ devolvidas: number; modoSeguro: number; jaAtendidas: number }>` e `export async function alertarContaDaIa(d: Pick<DepsTarefas, 'repos' | 'alertas'>): Promise<void>` em `tarefas.ts`, chamadas pelo `batimento` (revisão P1-1, P1-2, P1-4b, P1-8).

- [ ] **Step 1: Escreva os testes que falham**

`apps/trabalhador/test/confiabilidade/webhook-reentregue.test.ts` (o caso da D9; siga o `beforeEach` e o jeito de montar o app de `test/servidor.test.ts`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../../src/canal/falso';
import { FILAS } from '../../src/fila';
import { criarServidor } from '../../src/servidor';
import { db, repos } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';

const SEGREDO = 'segredo-de-teste-123456';
let fila: FilaFalsa;

beforeEach(async () => { await limparBanco(); fila = new FilaFalsa(); });

describe('webhook reentregue depois de processado (D9, Foco 6)', () => {
  it('a mesma mensagem 10 minutos depois: nada gravado, nada agendado', async () => {
    const canal = new CanalFalso();
    const app = criarServidor({ canal, repos, fila, segredo: SEGREDO, relogio: () => new Date() });
    const corpo = f.texto;   // webhook sintético de texto (messageId 'MSG-TEXTO-1'), o mesmo de servidor.test.ts
    const primeira = await app.inject({ method: 'POST', url: `/webhook/zapi/${SEGREDO}`, payload: corpo });
    expect(primeira.statusCode).toBe(200);
    await db.from('mensagens').update({ processada_em: new Date().toISOString() }).eq('id_provedor', 'MSG-TEXTO-1');
    const antes = fila.enviados.filter((j) => j.nome === FILAS.processarConversa).length;
    const segunda = await app.inject({ method: 'POST', url: `/webhook/zapi/${SEGREDO}`, payload: corpo });
    expect(segunda.statusCode).toBe(200);
    expect((await db.from('mensagens').select('id').eq('id_provedor', 'MSG-TEXTO-1')).data).toHaveLength(1);
    expect(fila.enviados.filter((j) => j.nome === FILAS.processarConversa)).toHaveLength(antes);
  });
});
```

(Acrescente `import * as f from '../fixtures/zapi/sinteticos';` no topo, como `servidor.test.ts:8`. `FilaFalsa.enviados` é `{ nome, dados, opcoes }[]` — `test/apoio/fila-falsa.ts:4`.)

`apps/trabalhador/test/confiabilidade/fila-parada.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../../src/canal/falso';
import { lerConfig } from '../../src/config';
import { LimitadorEnvio } from '../../src/envio';
import { FILAS } from '../../src/fila';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { MSG_ALERTA_CONTA } from '../../src/modo-seguro';
import { alertarContaDaIa, conversasParadas, type DepsTarefas } from '../../src/tarefas';
import { db, repos } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';

const AVISO = 'Recebemos sua mensagem, já vamos te atender.';
let fila: FilaFalsa;
let canal: CanalFalso;
// Segunda 10h: dentro do expediente (a mensagem do modo seguro é a de "IA indisponível", revisão P1-5).
const deps = (): DepsTarefas => ({
  repos, canal, fila, relogio: () => new Date('2026-09-28T13:00:00Z'), email: { enviar: async () => {} },
  alertas: { alertar: async () => {} }, envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
});
async function parada(telefone: string, minutos: number, estado: 'agente' | 'humano' = 'agente') {
  const c = await repos.obterOuCriarConversa(telefone, null);
  await repos.atualizarConversa(c.id, { estado });
  await repos.inserirMensagemEntrada({ conversaId: c.id, clienteId: null, idProvedor: `P-${telefone}`, tipo: 'texto', conteudo: 'oi' });
  await db.from('mensagens').update({ criado_em: new Date(Date.now() - minutos * 60_000).toISOString() }).eq('id_provedor', `P-${telefone}`);
  return c;
}

beforeEach(async () => { await limparBanco(); fila = new FilaFalsa(); canal = new CanalFalso(); });

/** Marca as mensagens paradas como já devolvidas `n` vezes, a última há `min` minutos. */
async function devolvida(conversaId: string, n: number, min: number) {
  await db.from('mensagens').update({ reenfileirada: n, reenfileirada_em: new Date(Date.now() - min * 60_000).toISOString() }).eq('conversa_id', conversaId);
}
const devolvidasAgora = () => fila.enviados.filter((j) => j.nome === FILAS.processarConversa).map((j) => (j.dados as { conversaId: string }).conversaId);

describe('mensagem parada (D11 refeita, revisão P1-1, P1-2, P1-8)', () => {
  it('nova ou depois de uma queda: volta à fila (não vai ao modo seguro pela idade) e conta a devolução', async () => {
    const nova = await parada('5531988880011', 5);
    const depoisDaQueda = await parada('5531988880012', 45);
    expect(await conversasParadas(deps())).toEqual({ devolvidas: 2, modoSeguro: 0, jaAtendidas: 0 });
    expect(devolvidasAgora().sort()).toEqual([nova.id, depoisDaQueda.id].sort());
    expect(canal.enviados).toHaveLength(0);
    expect((await db.from('mensagens').select('reenfileirada').eq('conversa_id', nova.id)).data).toEqual([{ reenfileirada: 1 }]);
  });
  it('devolvida há pouco: espera; 2 devoluções e 5 min sem sucesso: modo seguro e processada', async () => {
    const espera = await parada('5531988880013', 20);
    await devolvida(espera.id, 1, 1);
    const esgotada = await parada('5531988880014', 20);
    await devolvida(esgotada.id, 2, 10);
    expect(await conversasParadas(deps())).toEqual({ devolvidas: 0, modoSeguro: 1, jaAtendidas: 0 });
    expect(canal.enviados.filter((e) => e.telefone === esgotada.telefone).map((e) => e.texto)).toEqual([AVISO]);
    expect(await repos.mensagensNaoProcessadas(esgotada.id)).toHaveLength(0);
    expect(await repos.mensagensNaoProcessadas(espera.id)).toHaveLength(1);
  });
  it('já atendida (o trabalhador caiu depois de responder): só marca como processada, sem fila e sem mensagem', async () => {
    const c = await parada('5531988880015', 10);
    const [m] = await repos.mensagensNaoProcessadas(c.id);
    await repos.registrarDecisao({ conversaId: c.id, clienteId: null, etapa: 'lote', entrada: { mensagens: [m!.id] }, saida: null, turno: 'T9' });
    await repos.registrarDecisao({ conversaId: c.id, clienteId: null, etapa: 'responder', entrada: {}, saida: {}, turno: 'T9' });
    expect(await conversasParadas(deps())).toEqual({ devolvidas: 0, modoSeguro: 0, jaAtendidas: 1 });
    expect(devolvidasAgora()).toEqual([]);
    expect(canal.enviados).toHaveLength(0);
    expect(await repos.mensagensNaoProcessadas(c.id)).toHaveLength(0);
  });
  it('com a equipe: nada', async () => {
    const equipe = await parada('5531988880016', 45, 'humano');
    expect(await conversasParadas(deps())).toEqual({ devolvidas: 0, modoSeguro: 0, jaAtendidas: 0 });
    expect(await repos.mensagensNaoProcessadas(equipe.id)).toHaveLength(1);
  });
});

describe('alerta de saldo visto fora das conversas (revisão P1-4b)', () => {
  it('o batimento avisa o dono uma vez quando o Assistente ou uma tarefa registrou saldo acabado', async () => {
    const recebidos: { nivel: string; mensagem: string }[] = [];
    const d = { ...deps(), alertas: { alertar: async (a: { nivel: string; mensagem: string }) => { recebidos.push(a); } } };
    await repos.registrarFalhaAgente({ conversaId: null, clienteId: null, agenteId: null, tipo: 'saldo', etapa: 'ia', tentativa: 0, ultima: true,
      erro: 'BadRequestError 400: credit balance', modelo: null, acao: 'modo_seguro_sem_mensagem' });
    await alertarContaDaIa(d);
    await repos.registrarAlerta({ nivel: 'operacional', mensagem: MSG_ALERTA_CONTA.saldo });   // o que alertas.alertar gravaria
    await alertarContaDaIa(d);
    expect(recebidos.filter((a) => a.mensagem === MSG_ALERTA_CONTA.saldo)).toHaveLength(1);
  });
});

describe('CONCORRENCIA_AGENTE (D10)', () => {
  const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'CONCORRENCIA_AGENTE'));
  it('padrão 4; aceita 1 a 8; recusa 0 e 9', () => {
    expect(lerConfig(base).CONCORRENCIA_AGENTE).toBe(4);
    expect(lerConfig({ ...base, CONCORRENCIA_AGENTE: '2' }).CONCORRENCIA_AGENTE).toBe(2);
    expect(() => lerConfig({ ...base, CONCORRENCIA_AGENTE: '0' })).toThrow(/CONCORRENCIA_AGENTE/);
    expect(() => lerConfig({ ...base, CONCORRENCIA_AGENTE: '9' })).toThrow(/CONCORRENCIA_AGENTE/);
  });
});
```

(`lerConfig` precisa de todas as variáveis obrigatórias; nos testes do trabalhador o `.env` local já está carregado — confira como `test/config.test.ts` monta o ambiente e use o mesmo.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/confiabilidade/fila-parada.test.ts test/confiabilidade/webhook-reentregue.test.ts`
Expected: `webhook-reentregue` **PASSA já** (é o comportamento de hoje, D9: o teste só trava); `fila-parada` FAIL (`conversasParadas` e `CONCORRENCIA_AGENTE` não existem).

- [ ] **Step 3: Implemente**

`apps/trabalhador/src/config.ts`, antes de `PORTA`:

```ts
  // Plano de confiabilidade (D10): conversas atendidas ao mesmo tempo (1 por conversa). Muda só ao reiniciar o trabalhador.
  CONCORRENCIA_AGENTE: z.coerce.number().int().min(1).max(8).default(4),
```

`apps/trabalhador/src/fila.ts`, a linha da fila `processarConversa`:

```ts
  // D3 (confiabilidade): prazo explícito; a vez do agente leva no máximo 6 rodadas de até 60 s, com as novas tentativas do SDK.
  await boss.createQueue(FILAS.processarConversa, { name: FILAS.processarConversa, policy: 'stately', retryLimit: 3, retryDelay: 20, retryBackoff: true, expireInSeconds: 900 });
```

`apps/trabalhador/src/principal.ts`: troque `for (let i = 0; i < 4; i++) {` (o laço de `processarConversa`) por `for (let i = 0; i < cfg.CONCORRENCIA_AGENTE; i++) {` e a chamada por `await processarConversa(deps, job!.data.conversaId, job!.retryCount >= job!.retryLimit, job!.retryCount);`. Atualize o comentário: `// CONCORRENCIA_AGENTE consumidores (padrão 4): conversas diferentes andam em paralelo; "stately" garante uma execução por conversa.`

`apps/trabalhador/src/tarefas.ts`:

```ts
import { MOTIVOS_PASSAGEM, estaNoExpediente, formatarMensagem } from '@escritorio/core';
import { MINUTOS_DISJUNTOR, MSG_ALERTA_CONTA, entrarEmModoSeguro } from './modo-seguro';
// (junto dos imports existentes; agendarProcessamento vem de './fila'. estaNoExpediente: core/expediente.ts:16; formatarMensagem: core/texto.ts:1.)

/** D11 (refeita na revisão P1-2/P1-8): parada há 3 min volta à fila até 2 vezes; depois de 2 sem sucesso, modo seguro. */
export const PARADA = { minutos: 3, esperaEntreDevolucoes: 3, maxDevolucoes: 2, esperaDepoisDaUltima: 5, janelaHoras: 24 } as const;
const minutosDesde = (iso: string | null, agora: number) => (iso ? (agora - new Date(iso).getTime()) / 60_000 : Infinity);

export async function conversasParadas(d: DepsTarefas): Promise<{ devolvidas: number; modoSeguro: number; jaAtendidas: number }> {
  const r = { devolvidas: 0, modoSeguro: 0, jaAtendidas: 0 };
  const paradas = await d.repos.conversasComMensagemParada(PARADA.minutos, PARADA.janelaHoras * 60);
  if (paradas.length === 0) return r;
  const agora = Date.now();
  const cfg = await d.repos.obterConfiguracoes();
  for (const p of paradas) {
    const ids = (await d.repos.mensagensNaoProcessadas(p.conversaId)).map((m) => m.id);
    // D16 (revisão P1-1): o agente já agiu neste lote e o trabalhador caiu antes de marcar — não responde de novo.
    if (await d.repos.loteJaAtendido(p.conversaId, ids)) {
      await d.repos.marcarProcessadas(ids);
      r.jaAtendidas++;
      continue;
    }
    if (p.reenvios < PARADA.maxDevolucoes) {
      // Depois de uma queda longa também cai aqui: primeiro tenta de novo, nunca o modo seguro pela idade (P1-2).
      if (minutosDesde(p.ultimoReenvio, agora) < PARADA.esperaEntreDevolucoes) continue;
      await agendarProcessamento(d.fila, p.conversaId);
      await d.repos.marcarReenfileirada(p.conversaId);
      r.devolvidas++;
      continue;
    }
    if (minutosDesde(p.ultimoReenvio, agora) < PARADA.esperaDepoisDaUltima) continue;
    const conversa = await d.repos.obterConversa(p.conversaId);
    // Revisão P1-5: fora do expediente, a mensagem de "fora do horário".
    const mensagem = estaNoExpediente(d.relogio(), cfg.expediente)
      ? cfg.mensagens.ia_indisponivel ?? null : formatarMensagem(cfg.mensagens.fora_do_horario ?? '', cfg.expediente as never);
    await entrarEmModoSeguro(d, { conversa, tipo: 'codigo', motivoTriagem: 'Mensagem de cliente sem resposta',
      motivoPassagem: MOTIVOS_PASSAGEM.falha, mensagem, setorId: null });
    await d.repos.registrarFalhaAgente({ conversaId: conversa.id, clienteId: conversa.cliente_em_foco, agenteId: null, tipo: 'codigo',
      etapa: 'outro', tentativa: p.reenvios, ultima: true, erro: 'Mensagem parada: 2 novas tentativas sem resposta', modelo: null, acao: 'modo_seguro' });
    await d.repos.marcarProcessadas(ids);
    r.modoSeguro++;
  }
  return r;
}

/** Revisão P1-4b: saldo ou chave registrados pelo Assistente ou por uma tarefa também avisam o dono (no máximo 1 a cada 30 min). */
export async function alertarContaDaIa(d: Pick<DepsTarefas, 'repos' | 'alertas'>): Promise<void> {
  const tipo = await d.repos.falhaDefinitivaRecente(MINUTOS_DISJUNTOR);
  if (!tipo || (await d.repos.alertaRecente(MSG_ALERTA_CONTA[tipo], 30))) return;
  await d.alertas.alertar({ nivel: 'operacional', mensagem: MSG_ALERTA_CONTA[tipo] });
}
```

No `batimento`, depois da linha das pendências (`pedidosAoClienteParados`) e **antes** de conferir o WhatsApp:

```ts
  // Plano de confiabilidade (D11, D16): nenhuma mensagem de cliente fica parada sem pessoa. Falha aqui não para o batimento.
  await conversasParadas(d).catch((e) => console.error('[batimento] conversas paradas', e));
  // Revisão P1-4b: saldo ou chave vistos fora das conversas (Assistente, tarefas) também avisam o dono.
  await alertarContaDaIa(d).catch((e) => console.error('[batimento] alerta da conta da IA', e));
```

(`DepsTarefas` já tem `repos`, `envio`, `alertas`, `relogio`, `fila`: serve de `DepsModoSeguro`.)

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS; `tarefas.test.ts` (batimento) **sem mudança**. Se `tarefas.test.ts` contar exatamente os jobs enviados pelo batimento e uma conversa de outro teste ficar parada no banco, **pare** e avise (não mude o teste antigo).

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/fila.ts apps/trabalhador/src/config.ts apps/trabalhador/src/principal.ts apps/trabalhador/src/tarefas.ts apps/trabalhador/test/confiabilidade/fila-parada.test.ts apps/trabalhador/test/confiabilidade/webhook-reentregue.test.ts
git commit -m "feat(trabalhador): prazo do job de conversa, CONCORRENCIA_AGENTE e mensagem parada volta à fila ou vai à equipe; teste do webhook reentregue (confiabilidade, D3, D9, D10, D11)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Painel. "Falhas do agente hoje" no Início e a ajuda do campo "IA indisponível" (D1, D8)

**Files:**
- Create: `apps/painel/src/lib/falhas-agente.ts`, `apps/painel/src/lib/falhas-agente.test.ts`, `apps/painel/e2e/inicio-falhas-agente.spec.ts`
- Modify: `apps/painel/src/app/(painel)/inicio/dados-situacao.ts`, `apps/painel/src/app/(painel)/inicio/cartao-agente.tsx`, `apps/painel/src/app/(painel)/configuracoes/secoes/mensagens.tsx`

**Interfaces:**
- Consumes: RPC `falhas_agente_hoje(p_agora)` (Task 3).
- Produces:
  - `export type FalhasHoje = { total: number; conta: number }`
  - `export function lerFalhasHoje(bruto: unknown): FalhasHoje | null`
  - `export function textoFalhasHoje(f: FalhasHoje): string`
  - `lerFalhasAgente` (cache por requisição) em `dados-situacao.ts`.

- [ ] **Step 1: Escreva o teste que falha** — `apps/painel/src/lib/falhas-agente.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerFalhasHoje, textoFalhasHoje } from './falhas-agente';

describe('falhas do agente hoje (D8)', () => {
  it('lê o jsonb da função e recusa o que não é', () => {
    expect(lerFalhasHoje({ total: 3, conta: 1, instabilidade: 4 })).toEqual({ total: 3, conta: 1, instabilidade: 4 });
    expect(lerFalhasHoje({ total: '2', conta: '0' })).toEqual({ total: 2, conta: 0, instabilidade: 0 });
    expect(lerFalhasHoje(null)).toBeNull();
    expect(lerFalhasHoje({ total: 'x' })).toBeNull();
  });
  it('texto: zero, uma, várias, as de saldo ou chave e a instabilidade à parte (revisão P1-7)', () => {
    expect(textoFalhasHoje({ total: 0, conta: 0, instabilidade: 0 })).toBe('Nenhuma falha do agente hoje');
    expect(textoFalhasHoje({ total: 0, conta: 0, instabilidade: 7 })).toBe('Nenhuma falha do agente hoje · instabilidade: 7');
    expect(textoFalhasHoje({ total: 1, conta: 0, instabilidade: 0 })).toBe('1 falha do agente hoje');
    expect(textoFalhasHoje({ total: 5, conta: 2, instabilidade: 3 })).toBe('5 falhas do agente hoje · 2 por saldo ou chave da IA · instabilidade: 3');
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/falhas-agente.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implemente**

`apps/painel/src/lib/falhas-agente.ts`:

```ts
/** Plano de confiabilidade (D8): o número do Início, lido de falhas_agente_hoje (só o administrador). */
/** total = as que não se resolveram; instabilidade = novas tentativas (revisão P1-7: não acendem vermelho). */
export type FalhasHoje = { total: number; conta: number; instabilidade: number };

export function lerFalhasHoje(bruto: unknown): FalhasHoje | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const o = bruto as { total?: unknown; conta?: unknown; instabilidade?: unknown };
  const total = Number(o.total);
  const conta = Number(o.conta ?? 0);
  const instabilidade = Number(o.instabilidade ?? 0);
  return [total, conta, instabilidade].every(Number.isFinite) ? { total, conta, instabilidade } : null;
}

export function textoFalhasHoje(f: FalhasHoje): string {
  const base = f.total === 0 ? 'Nenhuma falha do agente hoje' : `${f.total} ${f.total === 1 ? 'falha' : 'falhas'} do agente hoje`;
  const conta = f.conta > 0 ? ` · ${f.conta} por saldo ou chave da IA` : '';
  const instavel = f.instabilidade > 0 ? ` · instabilidade: ${f.instabilidade}` : '';
  return `${base}${conta}${instavel}`;
}
```

Em `inicio/dados-situacao.ts`, depois de `lerNumerosAgente`:

```ts
/** falhas_agente_hoje (plano de confiabilidade, D8); null sem a migração: a linha some. */
export const lerFalhasAgente = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const { data, error } = await sb.rpc('falhas_agente_hoje' as never, { p_agora: agora.toISOString() } as never);
  return error ? null : lerFalhasHoje(data);
});
```

(Com `tipos.gen.ts` regerado na Task 3, tire os `as never` se o tipo da RPC já existir. Importe `lerFalhasHoje` de `@/lib/falhas-agente`.)

Em `inicio/cartao-agente.tsx`:
1. Acrescente `lerFalhasAgente` ao `Promise.all` (`const [cfg, gasto, numeros, doDia, feriados, falhas, { agora }] = …`) e importe `TriangleAlert` de `lucide-react` e `textoFalhasHoje` de `@/lib/falhas-agente`.
2. Logo **depois** do `</dl>`:

```tsx
      {falhas && (
        <p data-agente-falhas={falhas.total} className={cn('flex items-center gap-1 text-sm', falhas.total > 0 ? 'text-danger' : 'text-muted')}>
          {falhas.total > 0 && <TriangleAlert aria-hidden size={14} strokeWidth={1.75} />}
          {textoFalhasHoje(falhas)}
        </p>
      )}
```

(Vermelho com ícone e palavra; zero em cinza, sem ícone.)

Em `configuracoes/secoes/mensagens.tsx`, a linha de `ia_indisponivel`:

```ts
  { chave: 'ia_indisponivel', rotulo: 'IA indisponível', ajuda: 'Vai quando a IA falha, o saldo acaba ou o teto do mês chega: no máximo uma vez a cada 4 horas por conversa. Vazio não manda nada.' },
```

(O `grep -rn "IA indisponível" apps/painel/e2e` antes: o rótulo fica igual.)

`apps/painel/e2e/inicio-falhas-agente.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
const ADMIN = { email: 'thiago-falhas@e2e.local', nome: 'Thiago Falhas' };

test.beforeEach(async () => {
  await criarUsuarioTeste({ email: ADMIN.email, senha: SENHA, nome: ADMIN.nome, papel: 'admin' });
  await db.from('falhas_agente').delete().neq('id', '00000000-0000-0000-0000-000000000000');
});

test('cartão do agente: nenhuma falha, depois 2 com 1 de saldo e 1 de instabilidade (D8, revisão P1-7)', async ({ page }) => {
  await entrar(page, ADMIN.email, SENHA);
  await abrirInicio(page, 'situacao');
  const linha = page.getByTestId('inicio-agente').locator('[data-agente-falhas]');
  await expect(linha).toHaveText('Nenhuma falha do agente hoje');
  await db.from('falhas_agente').insert([
    { tipo: 'saldo', etapa: 'ia', tentativa: 0, ultima: true, erro: 'BadRequestError 400: credit balance', acao: 'modo_seguro' },
    { tipo: 'passageiro', etapa: 'ia', tentativa: 0, ultima: false, erro: 'InternalServerError 529: Overloaded', acao: 'tentar_de_novo' },
    { tipo: 'envio', etapa: 'envio', tentativa: 0, ultima: true, erro: 'Error: Z-API 500', acao: 'modo_seguro_sem_mensagem' },
  ]);
  await page.reload();
  await expect(linha).toHaveText('2 falhas do agente hoje · 1 por saldo ou chave da IA · instabilidade: 1');   // P1-7: a nova tentativa vai à parte
  expect((await new AxeBuilder({ page }).include('[data-testid="inicio-agente"]').analyze()).violations).toEqual([]);
});

test('Configurações › Mensagens automáticas: a ajuda do campo IA indisponível (D1)', async ({ page }) => {
  await entrar(page, ADMIN.email, SENHA);
  await page.goto('/configuracoes#mensagens');
  await expect(page.getByText('no máximo uma vez a cada 4 horas por conversa')).toBeVisible();
});
```

(Confira em `e2e/apoio.ts` o nome do cliente de serviço exportado (`db`) e em `e2e/apoio-configuracoes.ts` como abrir a seção Mensagens; se houver `abrirSecao(page, 'mensagens')`, use-o.)

- [ ] **Step 4: Rode** (Supabase local com a vez reservada; `supabase db reset`; memória ≥ 4 GB)

```bash
pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck
cd apps/painel
pnpm exec playwright test e2e/inicio-falhas-agente.spec.ts e2e/inicio-situacao.spec.ts --workers=1
pnpm exec playwright test e2e/configuracoes.spec.ts e2e/configuracoes-secoes.spec.ts --workers=1
```

Expected: tudo passa; `inicio-situacao.spec.ts` e `configuracoes*.spec.ts` sem mudança.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`; libere a vez)

```bash
git add apps/painel/src/lib/falhas-agente.ts apps/painel/src/lib/falhas-agente.test.ts "apps/painel/src/app/(painel)/inicio/dados-situacao.ts" "apps/painel/src/app/(painel)/inicio/cartao-agente.tsx" "apps/painel/src/app/(painel)/configuracoes/secoes/mensagens.tsx" apps/painel/e2e/inicio-falhas-agente.spec.ts
git commit -m "feat(painel): falhas do agente hoje no Início e a ajuda da mensagem de IA indisponível (confiabilidade, D1, D8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: As correções que o diagnóstico apontou (D13)

**Files:** os que o relatório da Task 2 apontar, **só** em `apps/trabalhador/src/**` (nunca `agente/prompt.ts`, `agente/orientacoes-skill-dono.ts`, os retratos), e um teste novo por causa em `apps/trabalhador/test/confiabilidade/diagnostico-<causa>.test.ts`; `docs/relatorios/falhas-agente.md` (a coluna "Feito").

**Interfaces:**
- Consumes: `docs/relatorios/falhas-agente.md` (Task 2, seção "Causas e o que fazer"), `IaRoteirizada`/`IaValidadora` (`test/apoio/ia-roteirizada.ts`), o modo seguro (Task 5).
- Produces: uma correção por causa "defeito do código", cada uma com o teste que a reproduz.

- [ ] **Step 1: Para cada linha "sim" da tabela "Causas e o que fazer", nesta ordem: `excecao_codigo`, `pedido_invalido`, `envio`, `limite_rodadas`.** Repita os Steps 2–5 **uma causa por vez**. Se não houver nenhuma linha "sim", pule para o Step 6.

- [ ] **Step 2: Escreva o teste que reproduz** — `apps/trabalhador/test/confiabilidade/diagnostico-<causa>.test.ts`, com `IaRoteirizada` (ou `IaValidadora`, que recusa como a API de verdade: turno vazio, texto vazio, `tool_use` sem `tool_result`) devolvendo **exatamente** a sequência de respostas anotada no relatório (os `stop_reason` e as ferramentas da linha "rodada N: … paradas …"), e esperando o comportamento certo. Modelo:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { executarAgente } from '../../src/agente/executar';
import { IaValidadora, usarFerramentas, fim } from '../apoio/ia-roteirizada';
// ... (o contexto como em test/agente/executar.test.ts: montarContexto/criar deps com CanalFalso)

describe('diagnóstico: <causa> (rodadas <n>, cenário "<nome>")', () => {
  beforeEach(async () => { await limparBanco(); });
  it('<o que o cenário mostrou> → <o que deve acontecer>', async () => {
    const ia = new IaValidadora([ /* a sequência anotada no relatório */ ]);
    // ... chame executarAgente/processarConversa como o cenário chamou
    // expect(...) no comportamento certo (sem exceção, sem 400, sem passo a mais)
  });
});
```

O teste tem de **falhar** do jeito que o cenário falhou (mesma exceção ou mesmo 400).

- [ ] **Step 3: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/confiabilidade/diagnostico-<causa>.test.ts`
Expected: FAIL com a mesma mensagem do relatório.

- [ ] **Step 4: Corrija o código** (a menor mudança que faz o teste passar; comentário de uma linha com "diagnóstico de confiabilidade: <causa>"). **Pare e avise** se a correção exigir mudar `prompt.ts`, as regras fixas, um retrato, um teste antigo ou o comportamento que um cenário antigo confere.

- [ ] **Step 5: Rode tudo e faça commit**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS. Marque a linha como "Feito: <commit>" no relatório.

```bash
git add apps/trabalhador/src/<arquivos> apps/trabalhador/test/confiabilidade/diagnostico-<causa>.test.ts docs/relatorios/falhas-agente.md
git commit -m "fix(agente): <causa> que derrubava a vez do agente nos cenários (confiabilidade, D13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Rode de novo só os cenários que falharam por causa de código** (Supabase local; `supabase db reset`; memória ≥ 4 GB): `pnpm --filter @escritorio/trabalhador cenarios "<trecho do nome>"`, um por vez. Anote o custo. Esperado: passam. Falhou de novo pela **mesma** causa → volte ao Step 2 (o teste não reproduziu direito). Falhou por **comportamento** → vira pendência.

- [ ] **Step 7: Pendências de comportamento** — na seção "Causas e o que fazer", cada linha "não" ganha a **orientação sugerida** (título, texto e tipo `regra`/`situacao`, no formato de Treinar o agente) para o dono aprovar. Não crie a orientação no banco de ninguém. Commit do relatório:

```bash
git add docs/relatorios/falhas-agente.md
git commit -m "docs(relatorios): falhas de comportamento do agente com a orientação sugerida ao dono (confiabilidade, D13)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Manual

**Files:**
- Modify: `docs/operacao.md`

- [ ] **Step 1: Seção nova "## 11. Quando a IA falha (modo seguro)"** no fim de `docs/operacao.md`, com:
  - **o que o cliente vê:** a mensagem "IA indisponível" (Configurações › Mensagens automáticas), no máximo uma vez a cada 4 horas por conversa; vazio = nada (D1, D2);
  - **o que a equipe vê:** a conversa em "Esperando pessoa" no Atendimento, uma demanda de triagem sem responsável "Falha no agente de IA", o aviso no Início; no cartão do agente (Painel de situação), "N falhas do agente hoje" (D6, D8);
  - **saldo acabou ou chave recusada:** o dono recebe e-mail e WhatsApp ("O saldo da IA (Anthropic) acabou…"), no máximo um a cada 30 min; por 10 minutos depois de cada falha o agente nem tenta (disjuntor); **o que fazer:** recarregar os créditos no console da Anthropic (ligar a recarga automática), ou conferir a `ANTHROPIC_API_KEY` do trabalhador; depois, as conversas em "Esperando pessoa" continuam com a equipe (o agente não retoma sozinho conversa que já foi para pessoa) (D5, D6);
  - **instabilidade (529, 429):** o agente tenta de novo sozinho (2 vezes na hora e mais 3 em segundos); só vai ao modo seguro se todas falharem (D3);
  - **mensagem parada:** o sistema devolve a conversa à fila até 2 vezes (de 3 em 3 minutos, também depois de uma queda do trabalhador); se não der, a conversa vai para a equipe; se o agente já tinha respondido antes da queda, ele não responde de novo (D11, D16);
  - **fora do expediente**, a mensagem do modo seguro é a de "Fora do horário" (D1);
  - **o número "falhas do agente hoje"** conta só o que não se resolveu; as novas tentativas aparecem como "instabilidade" (D8);
  - um erro de rede ao falar com a Z-API aparece como `codigo` (não `envio`) em `falhas_agente` (revisão P1-6, limitação aceita);
  - **`CONCORRENCIA_AGENTE`** (padrão 4, de 1 a 8; mais = mais memória) no ambiente do trabalhador (D10);
  - **onde ver os detalhes:** a tabela `falhas_agente` (Supabase › Table Editor; só o administrador), guardada por 1 ano; o relatório do diagnóstico em `docs/relatorios/falhas-agente.md`;
  - **como o dono valida** (análise §7, Prompt 1): na homologação **só depois** do `db push` aprovado e com a lista de telefones permitidos do Plano de prontidão: trocar a `ANTHROPIC_API_KEY` do trabalhador de teste por uma chave inválida, mandar mensagem de um número de teste → uma mensagem "IA indisponível", a conversa em "Esperando pessoa", o alerta; voltar a chave.
- [ ] **Step 2: Commit**

```bash
git add docs/operacao.md
git commit -m "docs: quando a IA falha — modo seguro, saldo da Anthropic, falhas do agente hoje (confiabilidade)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx, **a vez reservada em `.vez-supabase.txt`**, e **`supabase db reset`** antes da suíte pgTAP, antes do primeiro lote de e2e e antes de cada rodada de cenários:
   - **o que não podia mudar não mudou:** `git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__ apps/trabalhador/src/agente/prompt.ts apps/trabalhador/src/agente/orientacoes-skill-dono.ts` **vazio**; `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff BASE --stat -- supabase/tests` mostra só `80` (novo); `git diff BASE --stat -- supabase/migrations` mostra só `20261101000100_confiabilidade_agente.sql` (novo); `git diff BASE --stat -- 'apps/**/*.test.ts' 'packages/**/*.test.ts' apps/painel/e2e` mostra só arquivos **novos**;
   - `supabase test db`: todos os arquivos com os números de cada um, inclusive `22` (100/100) e `80` (20/20);
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`;
   - `pnpm --filter @escritorio/trabalhador test` e `typecheck` (inclusive `retrato-thiago`, `processar-conversa`, `servidor`, `tarefas`, `retencao` e os novos de `test/confiabilidade/`);
   - `pnpm --filter @escritorio/painel test` e `typecheck`;
   - **e2e em lotes de até 2 arquivos** (`--workers=1`; memória ≥ 4 GB conferida antes de **cada** lote; nada mais rodando além do Supabase local): primeiro os lotes da Task 7; depois os demais arquivos de `ls apps/painel/e2e/*.spec.ts`, em lotes de até 2, na ordem alfabética (`supabase db reset` antes do primeiro e a cada 5 lotes). Se o Claude Code matar um processo, **pare**, devolva `config.toml`/`.env`, libere a vez e avise com o lote em que parou. Some os números de todos os lotes;
   - **cenários com Claude de verdade, 3 rodadas completas** (critério do Prompt 1: "0 falhas em 3 rodadas, ou falhas restantes documentadas com causa e plano"; `supabase db reset` antes de cada uma; memória ≥ 4 GB; anote o custo de cada uma): `CENARIOS_DIAGNOSTICO="$SCRATCH/entrega.jsonl" CENARIOS_RODADA=<n> pnpm --filter @escritorio/trabalhador cenarios` para n = 1, 2, 3; depois `pnpm --filter @escritorio/trabalhador cenarios-relatorio "$SCRATCH/entrega.jsonl" "$SCRATCH/entrega.md"` e **compare com o relatório da Task 2** (quantas falhas antes e depois, por causa). Uma vez cada: `cenarios-atendimento`, `cenarios-assistente`, `cenarios-tarefas`. Teto D14 (US$ 30 somando as Tasks 2 e 8);
   - mostre os números exatos de cada suíte, de cada lote e de cada rodada (passaram, falharam, pulados) e o custo de cada rodada. Nada de "deve passar";
   - **volta sem a migração:** num banco local sem `20261101000100_*.sql` (mova o arquivo para a pasta de rascunho e `supabase db reset`; anote o método), confira que `pnpm --filter @escritorio/trabalhador exec vitest run test/processar-conversa.test.ts` passa (o trabalhador sem a tabela: registro só no log, reserva = manda, disjuntor desligado, mensagem parada não é lida) e que o Início abre sem a linha de falhas; depois devolva o arquivo e `supabase db reset`;
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, confira com `git status` e **apague `.vez-supabase.txt`** se a linha for desta worktree.
2. **Capturas** (larguras 1366 e 1920, tema claro e escuro, painel local `next dev -p 3107`, **nunca** a homologação): o cartão do agente com "Nenhuma falha do agente hoje" e com "2 falhas do agente hoje · 1 por saldo ou chave da IA · instabilidade: 1"; Configurações › Mensagens automáticas com a ajuda nova. Salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\confiabilidade\` com nomes `conf-<tela>-<largura>-<tema>.png`.
3. **Homologação: nada.** Este plano não roda `supabase db push` nem `--dry-run` (Regras de ambiente). Deixe por escrito para o dono: a migração só acrescenta (uma tabela, uma coluna em `conversas`, três funções); o trabalhador novo funciona **sem** ela (D: volta sem a migração); a ordem certa é aplicar junto com as migrações pendentes da Parte I quando o dono der o "ok".
4. **Trabalhador: NÃO suba nenhum**; o da 3001 é o teste do dono. Entregue "pronto para trocar", com o roteiro de validação do §7 da análise (Task 9) e a variável nova `CONCORRENCIA_AGENTE` (opcional).
5. **Pendências para listar no fim:**
   - **as decisões a confirmar com o dono:** D1 (texto da mensagem; manter "IA indisponível" ou trocar; fora do expediente usar "Fora do horário" — revisão P1-5), D5 (os 10 min do disjuntor — revisão P1-4), D2 (prazo de 4 h), D6 (quem recebe os alertas e por qual canal), D7 (guarda de 1 ano das falhas), D8 (só o administrador vê o número), D13 (mudar o prompt para falhas de comportamento ou só orientações), D15 (base da branch);
   - o relatório `docs/relatorios/falhas-agente.md`: falhas antes e depois, as de comportamento com a orientação sugerida, as passageiras da API (quantas);
   - o custo total dos cenários deste plano;
   - **conflitos esperados com a Parte I** (I4, I5 em outra branch): `processar-conversa.ts`, `principal.ts`, `tarefas.ts`, `fila.ts`, `cartao-agente.tsx` — liste os trechos mudados aqui para quem juntar;
   - o que fica para o Plano de prontidão (`2026-10-21-prontidao-producao.md`): `/saude` completo, monitor externo, lista de telefones permitidos fora da produção, backup.
6. **Não juntar** a branch em nada. **Parar** ao fim e esperar o dono ver.
