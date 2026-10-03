# Painel v2, Parte F (Gastos com IA). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** todo gasto com IA passa a ser gravado com **funcionalidade, pessoa, empresa e provedor** (agente, assistente pelo site e pelo WhatsApp, Sugerir resposta, Testar o agente e a transcrição de áudio, que hoje nem é gravada), os registros antigos ganham uma classificação, o teto soma tudo, e o administrador ganha a tela **`/gastos-ia`** (cartões, por funcionalidade, por dia com o dia mais caro, quem mais gasta na equipe, gastos por cliente com os atendimentos de cada um, exportar CSV), como a imagem `00-gastos-ia.png`.

**Arquitetura:**
- **Banco (três migrações novas, em ordem; nenhuma antiga é editada):**
  - `20261006000100_painel_v2_gastos_colunas.sql`: `uso_ia` ganha `cliente_id`, `setor_id`, `provedor`, `segundos_audio`; índices por data, funcionalidade, pessoa, empresa e conversa; `uso_ia_classificacao(conversa, quando)` (a regra única de classificar um registro sem funcionalidade) e o gatilho `completar` que a aplica a quem grava sem funcionalidade (o trabalhador antigo da porta 3001); `configuracoes.cotacao_usd_brl` e `custo_minuto_transcricao_usd`, só do administrador.
  - `20261006000200_painel_v2_gastos_antigos.sql`: classifica os registros antigos com a mesma regra (com conversa → `agente_clientes`, sem conversa → `nao_identificado`), preenche a empresa dos registros com conversa e trava `funcionalidade not null`.
  - `20261006000300_painel_v2_gastos_funcoes.sql`: funções de leitura só do administrador (`gastos_resumo`, `gastos_por_funcionalidade`, `gastos_por_dia`, `gastos_dia_mais_caro`, `gastos_por_pessoa`, `gastos_por_cliente`, `gastos_atendimentos_do_cliente`, `gastos_chamadas`) sobre uma base interna `gastos_atendimentos_base` ("atendimento" = conversa + dia de Brasília).
- **Core:** `FuncionalidadeGravavel` (a lista sem `nao_identificado`), `ProvedorIa`, `usoDaResposta` (tokens da resposta da Anthropic, hoje repetido em 3 lugares) e `custoTranscricaoUsd`.
- **db:** `registrarUsoIa` passa a **exigir** funcionalidade, pessoa, conversa e empresa (o TypeScript não compila sem elas) e recusa `nao_identificado` em tempo de execução; `Configuracoes.custoMinutoTranscricaoUsd`; tipos regerados.
- **Trabalhador:** cada caminho grava a funcionalidade certa: agente (`agente_clientes`, empresa em foco), Testar o agente (`testar_agente`, quem pediu), assistente (`assistente_site` / `assistente_whatsapp`, a pessoa), Sugerir resposta (`sugerir_resposta`, a pessoa, a conversa e a empresa) e transcrição (`transcricao_audio`, `groq`, segundos e custo por minuto). `cache_control` também no assistente e na sugestão. Um teste de varredura falha se aparecer um lugar novo que chama a IA sem estar na lista testada.
- **Painel:** item **Gastos com IA** (ícone de moeda) só no menu do administrador; tela `/gastos-ia` com filtros de período, quatro cartões, por funcionalidade, por dia (barras acessíveis, hoje em vinho, alerta do dia mais caro), ranking da equipe com barra empilhada e detalhe da pessoa em painel lateral, gastos por cliente com os atendimentos (link "abrir" leva à conversa naquele dia), exportar CSV; Configurações › Teto de IA ganha cotação e custo por minuto da transcrição; o cartão de gasto do Início usa `gastos_resumo` e leva à tela.

**Tecnologias:** Next.js 15 (App Router, server components, route handler), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (Postgres, RLS, pgTAP), pg-boss, Anthropic SDK, Vitest, Playwright e @axe-core/playwright. Sem biblioteca de gráficos: barras em HTML com tokens (como o medidor do Início).

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção **7B inteira** (Parte F), que é o escopo, e a imagem `docs/superpowers/specs/painel-v2/imagens/00-gastos-ia.png` (fonte `fragmentos/00-gastos-ia.html`; números de exemplo);
- seção 3 (a F vem depois da E porque mede o "Sugerir resposta"), **3.1** ("Toda IA nova grava custo com funcionalidade e pessoa"; migração incremental, pgTAP, `--dry-run`, nada é juntado), 4 (identidade: tokens, caixa alta pelo CSS, vermelho nunca sozinho);
- seção **7** (Parte D): na tabela de módulos, "Gastos com IA (Parte F) — **Só administrador (não é permissão configurável)**"; o horário de acesso vale em toda leitura (o administrador nunca é bloqueado);
- seção 7E.8 (Parte I): mais tarde a funcionalidade vira `agente_<slug>` / `tarefa_<slug>` e a tela ganha "por agente" — por isso a coluna continua **texto com regra**, não enum (P12);
- seção 9: cotação US$→R$ e custo por minuto da transcrição são pendências do dono, preenchidas pela tela.

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt F" — **"Pontos que não podem falhar"**: nenhuma chamada à IA fica sem funcionalidade (teste por caminho; gasto novo `nao_identificado` depois da migração é bug); "Atendimento" = mensagens de um telefone num mesmo dia; só o administrador vê a tela e as funções; **antes de migrar os registros antigos, mostrar quantos ficam como `agente_clientes` e quantos como `nao_identificado`** (Entrega, item 3). Estilo e convenções: `docs/superpowers/plans/2026-10-05-painel-v2-parte-e.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`. Gráficos: skill **dataviz** (paleta validada pelo `validate_palette.js`; a paleta abaixo já passou).

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-f`, branch `painel-v2-parte-f`, criada de `painel-v2-parte-e` em `4ac76ac` (Partes A a E prontas). Todos os comandos rodam a partir da raiz da worktree. A pasta do spec já é a mais nova (`git diff etapa-1 -- docs/superpowers/specs/painel-v2` saiu vazio em 03/10); se deixar de sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso antes da Task 1.

## Perguntas para o dono

O spec não decide estes pontos, ou o código não bate com ele. O dono autorizou seguir sem esperar: **o plano segue a recomendação** de cada um (na dúvida, a mais conservadora). Se a resposta for outra, ajuste a task indicada antes de executá-la.

| # | Pergunta | Recomendação (o que o plano faz) | Task |
|---|---|---|---|
| P1 | **Registros antigos sem conversa** (assistente e Testar o agente gravavam igual, sem pessoa): dá para adivinhar pelo horário das simulações e das perguntas ao assistente. | **Não adivinhar.** Com conversa → `agente_clientes` (é como o agente grava hoje: `agente/executar.ts` é o único caminho antigo que grava `conversa_id`; a sugestão da Parte E já grava a própria funcionalidade); sem conversa → `nao_identificado`. A tela mostra "Não identificado" como linha própria. As contagens saem na Entrega, antes do `--dry-run`. | 1, 2 |
| P2 | **Empresa dos registros antigos do agente.** | A empresa da **última mensagem da conversa com empresa, até o horário do registro** (`mensagens.cliente_id`). Sem essa mensagem, fica sem empresa (aparece em "Sem empresa identificada"). Nunca a empresa em foco de hoje (pode ter mudado). | 1, 2 |
| P3 | **Trabalhador antigo (3001) ligado depois da migração:** ele grava sem funcionalidade. | O gatilho `completar` aplica a mesma regra do P1/P2 (o agente continua funcionando e o gasto entra no teto). Assistente e Testar o agente do trabalhador antigo ficam `nao_identificado` até o dono trocar o trabalhador; a tela mostra o aviso "N chamadas sem funcionalidade: o trabalhador está desatualizado?". Com o trabalhador novo, o código nunca grava `nao_identificado` (o repositório recusa). | 1, 4, 8 |
| P4 | **Cartão "Total do mês × teto" com outro período** (Hoje, 7 dias, Mês passado, Período). | O teto é mensal: o cartão mostra **o total do período**; a barra do teto, a marca de 80% e a **previsão de fechamento** só aparecem em "Este mês". Nos outros períodos, uma linha "Este mês: US$ X de US$ teto (Y%)". | 7, 8 |
| P5 | **O que conta em "Gastos por cliente".** | O que tem **empresa**: agente, transcrição e Sugerir resposta (todos ligados à conversa do cliente). Assistente e Testar o agente **nunca** contam para a empresa (são uso da equipe e aparecem por pessoa). Gasto com conversa sem empresa aparece como "Sem empresa identificada". | 3, 5 |
| P6 | **Assistente aberto numa conversa** (aba ASSISTENTE do Atendimento). | Continua **sem conversa e sem empresa** no `uso_ia`, como hoje (há teste disso); conta para a pessoa. Assim "custo por atendimento" mede só o atendimento ao cliente. | 5 |
| P7 | **Testar o agente com empresa escolhida.** | Grava `testar_agente` com **quem pediu**, sem empresa e sem conversa (é treino, não gasto do cliente). | 5 |
| P8 | **`setor_id`:** o spec cria a coluna, mas nenhum caminho de hoje tem setor certo. | Coluna criada, **vazia** nesta parte; a Parte I (agentes por setor) preenche. | 1 |
| P9 | **Custo da transcrição.** A Groq cobra por segundo de áudio (com mínimo de 10 s por pedido). | `segundos_audio` = a duração que a Groq devolve (`response_format=verbose_json`); custo = segundos ÷ 60 × "custo por minuto" de Configurações, **sem** o mínimo de 10 s (regra do fornecedor, pode mudar). Sem custo configurado, grava 0 e a tela diz "custo por minuto não configurado". Transcrição que falha não grava nada (o fornecedor não cobra). | 6, 10 |
| P10 | **"Custo por conversa" (imagem) × "Custo por atendimento" (spec).** | **Atendimento** em toda a tela (cartão "Custo por atendimento · média de N atendimentos", coluna "Atendimentos", "Por atendimento"). O spec decide: "'Conversa' nesta tela = atendimento". | 8, 9 |
| P11 | **"abrir" um atendimento.** | Leva a `/atendimento/<conversa>?data=AAAA-MM-DD`: a conversa abre rolada até o separador daquele dia, que fica realçado. Conversa apagada (LGPD) → "conversa apagada", sem link. | 9 |
| P12 | **Enum ou texto?** O spec diz "enum". | **Texto com regra** (`check`), como a Parte E fez: a Parte I precisa de `agente_<slug>` e `tarefa_<slug>`, e enum no Postgres não aceita isso sem migração a cada agente. A lista é a do spec; o código só aceita a lista. | 1 |
| P13 | **Exportar.** | CSV **linha a linha** do período escolhido (todas as chamadas, até 100.000), separado por `;`, com BOM (abre no Excel em português): data/hora, funcionalidade, pessoa, empresa, modelo, provedor, tokens (entrada, saída, cache leitura, cache escrita), segundos de áudio, custo US$ e, com cotação, custo R$. Sem telefone nem texto de conversa. | 10 |
| P14 | **Cotação US$→R$.** | Campo manual em Configurações › Teto de IA (só o administrador; nada busca na internet). Vazio → a tela mostra só US$. O topo da tela diz "cotação usada: R$ X (Configurações)". | 1, 10 |
| P15 | **Início.** | O cartão "Gasto com IA no mês" passa a ler `gastos_resumo` (uma chamada, sem "valor parcial") e ganha o link **Ver gastos** para `/gastos-ia`. Nada mais muda no Início (a Parte G o redesenha). | 10 |
| P16 | **"%" no ranking da equipe.** | Percentual do **total gasto por pessoas** no período (as ações do agente ficam fora do ranking, como o spec diz). Mostra as 10 que mais gastam; clicar abre o detalhe linha a linha (painel lateral, últimas 200 chamadas, com o link de exportar só dela). | 9 |
| P17 | **Alerta do dia mais caro.** | Aparece quando o período tem **2 dias ou mais com gasto**. Texto: "26/09 foi o dia mais caro (US$ 3,90): Testar o agente usado 31 vezes por Thiago." Para o agente (sem pessoa): "…: Agente de clientes, 120 chamadas." Ícone de alerta + texto (nunca só cor). | 3, 8 |
| P18 | **Período livre.** | Datas de Brasília, "de" e "até" inclusive, no máximo **366 dias** (o banco recusa mais). Data inválida volta para "Este mês" com aviso. | 3, 7 |
| P19 | **Cache de prompt.** Agente e Testar o agente já marcam o bloco fixo (`agente/prompt.ts`); assistente e sugestão não. | Marcar `cache_control` no bloco de sistema do **assistente** e da **sugestão** (o cache cobre ferramentas + sistema). Não muda texto de prompt. Cenários com Claude real na Entrega: `cenarios-assistente` e `cenarios-atendimento` (baratos); os ~50 do agente **não** precisam (o prompt do agente não muda), mas ficam listados como opção do dono. | 5, Entrega |
| P20 | **Transcrição com o teto atingido.** | **Continua transcrevendo** (a equipe precisa do texto para atender) e o custo entra no teto. Só o agente para, como hoje. | 6 |

## Restrições globais

- **Só mexer em:**
  - banco: **criar** `supabase/migrations/20261006000100_painel_v2_gastos_colunas.sql`, `20261006000200_painel_v2_gastos_antigos.sql`, `20261006000300_painel_v2_gastos_funcoes.sql` e os testes `supabase/tests/32_painel_v2_gastos_colunas.test.sql`, `33_painel_v2_gastos_antigos.test.sql`, `34_painel_v2_gastos_funcoes.test.sql`;
  - `packages/core/src/custo.ts`, `packages/core/test/custo.test.ts`;
  - `packages/db/src/repos.ts`, `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão), `packages/db/test/{repos,atendimento}.test.ts`;
  - trabalhador: `src/agente/{executar,simular}.ts`, `src/assistente/executar.ts`, `src/sugestao/{processar,ferramentas}.ts`, `src/midia/transcritor.ts`, `src/processar-conversa.ts`, `src/principal.ts`, `src/cenarios/{rodar,atendimento,assistente}.ts` (só o transcritor falso e a assinatura nova), e testes em `test/`;
  - `apps/painel`.
  - Nada no prompt do agente nem do assistente (só o `cache_control` no bloco que já existe), nada no Bling, nada nas migrações antigas.
- **Nunca editar migração antiga** (`20261005000400` e anteriores). Toda mudança é migração nova, datada depois de `20261005000400`.
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` não muda e continua 100/100** depois de cada migração desta parte. Ele também fixa a lista do `supabase_realtime`: **nenhuma tabela nova publicada** (a tela de gastos não usa tempo real; recarrega ao trocar o filtro). Se falhar, a migração mudou o que alguém vê ou faz: corrija a migração, nunca o teste. Na Entrega, `git diff 4ac76ac -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio.
- **Só o administrador:** toda função nova chamada pelo painel começa por `perform public.gastos_checar(p_de, p_ate)` (que usa `public.eh_admin()`: administrador **ativo**). **Nunca** use `usuario_liberado` (é só do `service_role`) em função chamada como `authenticated`. Funções novas: `security definer`, `set search_path = ''`, nomes com `public.`, `revoke execute … from public, anon` e `grant execute … to authenticated` só nas chamadas pelo painel; as internas (`gastos_checar`, `gastos_atendimentos_base`, `uso_ia_classificacao`, `uso_ia_completar`) ficam **sem grant** para `authenticated`. Nenhuma função nova grava (o `25_painel_v2_horario.test.sql` procura `insert|update|delete` no corpo: nem em comentário dentro do corpo).
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`).
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os testes do painel (e2e) e do trabalhador deixam no banco quebram os pgTAP antigos. O reset reaplica todas as migrações, inclusive as novas.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts` (o `pnpm --filter … e2e -- <filtro>` não repassa o filtro de forma confiável).
- **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`.** Ele só é lido na Entrega (só leitura), para a **contagem só de leitura**, o `--dry-run` e o painel do dono. Os e2e já recusam outro banco: `apps/painel/e2e/trava-local.ts`; o `globalSetup` `apps/painel/e2e/aquecer.ts` compila as rotas antes dos specs (rota nova `/gastos-ia` entra na lista `ROTAS`).
- **Nunca suba um segundo trabalhador apontando para a homologação.** Dois trabalhadores no mesmo banco dividem a fila. O trabalhador da **porta 3001 é o teste do dono: não desligue nem mate esse processo.** O trabalhador desta branch é entregue **"pronto para trocar"** (Entrega, item 4).
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit.
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[300px]` ou `grid-cols-[...]`. Cores dos gráficos só pelos tokens novos `--gasto-*` (Task 7). A única exceção já usada no projeto: `style={{ width|height: \`${pct}%\` }}` para o tamanho de uma barra de dado. `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando.
- **Tipografia desta tela (spec 7B.3):** títulos `font-extrabold` (800), números grandes `font-extrabold` (não 300), rótulos e tabelas `text-sm`/`text-base` (13–15 px pela escala da Parte A), números com `tabular`.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`). Vermelho nunca sozinho.
- **Termos (spec 3.1):** Atendimento, Conversa, Empresa, Contato, Setor. Na tela, "pessoa" para usuário da equipe; "chamadas à IA" para registros de `uso_ia`.
- **Dinheiro:** `formatarUSD`/`formatarBRL` de `lib/formatos.ts`; valores de uma chamada (menos de 1 centavo) com `formatarUsdFino` (Task 7).
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Decisões tomadas neste plano (o dono confirma ao aprovar)

1. **Ordem:** colunas e classificação (Task 1) → registros antigos (2) → funções de leitura (3) → core e db (4) → trabalhador: os caminhos da Anthropic (5) → trabalhador: transcrição (6) → painel: regras puras, tokens, menu (7) → painel: tela, cartões, funcionalidade, dia (8) → painel: equipe, clientes, atendimentos (9) → painel: exportar, Configurações, Início (10) → acessibilidade, capturas, manuais (11).
2. **Uma regra só para "sem funcionalidade"** (`uso_ia_classificacao`): a migração dos antigos e o gatilho de compatibilidade usam a mesma função, e o pgTAP testa a função. Assim o número mostrado ao dono na Entrega é exatamente o que a migração faz.
3. **Duas travas contra gasto sem funcionalidade:** (a) **TypeScript**: `registrarUsoIa` exige `funcionalidade: FuncionalidadeGravavel`, `usuarioId`, `conversaId` e `clienteId` (sem `?`); (b) **execução**: o repositório recusa funcionalidade vazia, fora da lista ou `nao_identificado`. Mais um **teste de varredura** (`test/gastos/varredura.test.ts`) que conta, em `src/`, as chamadas `ia.criar(`, `registrarUsoIa(` e `transcritor.transcrever(` e falha se aparecer uma fora da lista testada.
4. **Atendimento = (conversa, dia de Brasília)** sobre os registros de `uso_ia` com conversa. Resultado: **passou para pessoa** se naquele dia houve mensagem com `autor = 'atendente'` ou `conversa_eventos.tipo = 'assumida'`; senão **resolvido pelo agente**. Nota interna não conta (é evento da demanda, não resposta). Mensagens do atendimento = mensagens da conversa naquele dia, menos as de `autor = 'sistema'`.
5. **Custo por atendimento** = soma dos registros com conversa ÷ número de atendimentos do período.
6. **Previsão de fechamento** (só "Este mês") = gasto do mês ÷ dias corridos até hoje (contando hoje) × dias do mês, em Brasília.
7. **Economia do cache** (cartão do total) = Σ tokens de leitura de cache × (preço de entrada − preço de leitura de cache) − Σ tokens de escrita de cache × (preço de escrita − preço de entrada), pelos preços de `configuracoes.precos_modelos`. Negativa ou zero → "sem economia de cache ainda".
8. **Gráficos acessíveis:** "Por funcionalidade" é uma tabela (nome com ícone, barra decorativa, custo, %, chamadas): a cor só acompanha o nome. "Por dia" é uma série só (sem legenda): barras com `title` e rótulo para leitor de tela por barra, primeira/meio/última data no eixo, hoje em vinho **e** escrito "hoje", e uma **tabela equivalente** recolhida ("Ver em tabela"). O ranking usa barra empilhada com **legenda sempre visível**, 2 px de espaço entre segmentos e o detalhe em texto para leitor de tela ("Assistente site US$ 2,10, Sugerir resposta US$ 1,20…").
9. **Paleta categórica validada** (`validate_palette.js` da skill dataviz, superfície `#ffffff` no claro e `#1d1a1b` no escuro): ordem fixa do empilhado **assistente site → sugerir resposta → testar o agente → assistente WhatsApp** passa em todas as verificações no claro e no escuro (o dourado claro tem contraste 2,97:1, compensado pela legenda e pela tabela). Agente e transcrição só aparecem na lista com nome, nunca empilhados. A cor segue a funcionalidade, nunca a posição.
10. **Leituras pelo servidor do Next com o cliente da própria pessoa** (`supabaseServidor()`): o banco recusa quem não é administrador, e a página ainda chama `exigirAdmin()` antes (quem não é administrador vai para `/inicio`).

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Um caminho novo de IA entra sem funcionalidade** (alguém chama `ia.criar` num arquivo novo, ou grava `uso_ia` direto): a varredura da Task 5 falha até o caminho entrar na lista e ganhar teste; o repositório recusa `nao_identificado` (Task 4).
2. **Mesmo telefone em dois dias, e virada do dia em Brasília** (mensagem às 23:50 e às 00:10 de Brasília, que são o mesmo dia em UTC): dois atendimentos. Testado no pgTAP da Task 3.
3. **Atendente, administrador arquivado ou alguém fora do horário chama as funções direto pela API**: todas recusam com "Só o administrador vê os gastos com IA."; `anon` nem executa. Testado no pgTAP da Task 3 e no e2e da Task 9.
4. **Trabalhador antigo grava depois da migração** (sem funcionalidade): o registro entra classificado (nunca nulo, nunca quebra o agente) e conta no teto. Testado no pgTAP das Tasks 1 e 2.
5. **Período vazio ou absurdo** (sem nenhum gasto; "de" depois de "até"; mais de 366 dias; data inválida na URL): a tela mostra zeros e o estado vazio, sem dividir por zero (custo por atendimento "—"), e o banco recusa período inválido. Testado na Task 3 (pgTAP) e na Task 7 (regras puras) e no e2e da Task 8.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261006000100_painel_v2_gastos_colunas.sql`, `supabase/tests/32_painel_v2_gastos_colunas.test.sql` (novos) | colunas, índices, classificação, gatilho, configurações | 1 |
| `supabase/migrations/20261006000200_painel_v2_gastos_antigos.sql`, `supabase/tests/33_painel_v2_gastos_antigos.test.sql` (novos) | registros antigos, `not null` | 2 |
| `supabase/migrations/20261006000300_painel_v2_gastos_funcoes.sql`, `supabase/tests/34_painel_v2_gastos_funcoes.test.sql` (novos) | funções de leitura do administrador | 3 |
| `packages/core/src/custo.ts`, `packages/core/test/custo.test.ts` | tipos e contas do custo | 4 |
| `packages/db/src/repos.ts`, `tipos.gen.ts`, `test/repos.test.ts`, `test/atendimento.test.ts` | `registrarUsoIa` exigente, configuração da transcrição | 4 |
| `apps/trabalhador/src/agente/{executar,simular}.ts`, `assistente/executar.ts`, `sugestao/{processar,ferramentas}.ts`, `test/gastos/{caminhos,varredura}.test.ts` (novos), testes existentes que chamam `registrarUsoIa` | funcionalidade + pessoa + empresa por caminho; cache | 5 |
| `apps/trabalhador/src/midia/transcritor.ts`, `processar-conversa.ts`, `principal.ts`, `cenarios/{rodar,atendimento}.ts`, `test/midia/transcritor.test.ts`, `test/processar-conversa.test.ts` | transcrição gravada; teto soma tudo | 6 |
| `apps/painel/src/lib/gastos.ts` (+ `gastos.test.ts`), `styles/tokens.css`, `styles/tokens.test.ts`, `app/globals.css`, `lib/menu.ts` (+ teste), `components/layout/{sidebar,trilha}.ts(x)` (+ teste) | regras puras, cores, menu, trilha | 7 |
| `app/(painel)/gastos-ia/{page,loading}.tsx`, `filtros-periodo.tsx`, `cartoes.tsx`, `por-funcionalidade.tsx`, `por-dia.tsx` (novos), `e2e/gastos-ia.spec.ts` (novo), `e2e/aquecer.ts`, `e2e/apoio-gastos.ts` (novo) | tela, filtros, cartões, por funcionalidade, por dia | 8 |
| `app/(painel)/gastos-ia/{ranking-equipe,detalhe-pessoa,gastos-por-cliente}.tsx` (novos), `components/patterns/historico-rolante.tsx`, `app/(painel)/atendimento/[id]/{page,conversa-aberta,itens-historico}.tsx`, `e2e/gastos-ia.spec.ts` | equipe, pessoa, clientes, atendimentos, "abrir" | 9 |
| `app/(painel)/gastos-ia/exportar/route.ts` (novo), `lib/gastos-csv.ts` (+ teste), `configuracoes/{page,esquemas,acoes}.tsx/.ts` (+ teste), `lib/inicio.ts` (+ teste), `inicio/{page,gasto-do-mes}.ts(x)`, `e2e/gastos-ia.spec.ts`, `e2e/configuracoes.spec.ts` | CSV, cotação, custo por minuto, Início | 10 |
| `e2e/acessibilidade.spec.ts`, `app/(painel)/_design/page.tsx`, `docs/design-system.md`, `docs/operacao.md` | acessibilidade e manuais | 11 |

---

### Task 1: Banco. Colunas, índices, classificação e configurações

**Files:**
- Create: `supabase/migrations/20261006000100_painel_v2_gastos_colunas.sql`
- Create: `supabase/tests/32_painel_v2_gastos_colunas.test.sql`

**Interfaces:**
- Consumes: `uso_ia` (com `funcionalidade` e `usuario_id` da `20261005000400`), `mensagens.cliente_id`, `configuracoes`, `configuracoes_so_admin()` (`20261004000500`).
- Produces: colunas `uso_ia.cliente_id uuid`, `setor_id uuid`, `provedor text not null default 'anthropic'` (`'anthropic' | 'groq'`), `segundos_audio numeric(10,2)`; `public.uso_ia_classificacao(p_conversa uuid, p_quando timestamptz) returns table (funcionalidade text, cliente_id uuid)` (interna); gatilho `completar` em `uso_ia`; `configuracoes.cotacao_usd_brl numeric(8,4)`, `configuracoes.custo_minuto_transcricao_usd numeric(10,6)` (só o administrador muda).

- [ ] **Passo 0: guardar a regressão de antes**

Com o Supabase local nas portas 563xx (Restrições globais): `supabase db reset && supabase test db 2>&1 | grep -E "22_regressao|Result" | tee "$SCRATCH/regressao-antes.txt"`.
Expected: a linha do `22_regressao_visibilidade.test.sql` com `ok` (100/100) e `Result: PASS`.

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/32_painel_v2_gastos_colunas.test.sql`:

```sql
-- Parte F, Task 1 (spec 7B.2): colunas novas de uso_ia, a regra de classificação de quem grava sem funcionalidade
-- (registros antigos e trabalhador antigo) e as configurações só do administrador.
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('fa000000-0000-0000-0000-00000000000a', 'admin@gastos1.local'),
  ('fa000000-0000-0000-0000-00000000000b', 'ana@gastos1.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fa000000-0000-0000-0000-00000000000a', 'Admin G', 'admin@gastos1.local', 'admin', '{}'),
  ('fa000000-0000-0000-0000-00000000000b', 'Ana G', 'ana@gastos1.local', 'atendente', '{}');
insert into public.usuario_permissoes (usuario_id, modulo, nivel)
  values ('fa000000-0000-0000-0000-00000000000b', 'configuracoes', 'sim')
  on conflict (usuario_id, modulo) do update set nivel = excluded.nivel;
insert into public.clientes (id, razao_social, cnpj) values
  ('fb000000-0000-0000-0000-000000000001', 'Rede Bom Preço Ltda', '11111111000101'),
  ('fb000000-0000-0000-0000-000000000002', 'Mercado Central', '22222222000102');
insert into public.conversas (id, telefone, cliente_em_foco) values
  ('fc000000-0000-0000-0000-000000000001', '5531944440001', 'fb000000-0000-0000-0000-000000000002');
-- A empresa de 10h é a Rede; às 12h a conversa passou a falar da Central.
insert into public.mensagens (conversa_id, cliente_id, direcao, autor, conteudo, criado_em) values
  ('fc000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000001', 'entrada', 'cliente', 'oi', '2026-09-20 10:00-03'),
  ('fc000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000002', 'entrada', 'cliente', 'e a outra', '2026-09-20 12:00-03');

-- 1–5: colunas
select has_column('public', 'uso_ia', 'cliente_id', 'empresa');
select has_column('public', 'uso_ia', 'setor_id', 'setor (Parte I)');
select col_default_is('public', 'uso_ia', 'provedor', $$'anthropic'::text$$, 'provedor padrão: anthropic');
select throws_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade, provedor)
  values ('m', 0, 0, 0, 'transcricao_audio', 'openai') $$, '23514', null, 'provedor fora da lista: recusa');
select throws_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade, segundos_audio)
  values ('m', 0, 0, 0, 'transcricao_audio', -1) $$, '23514', null, 'segundos negativos: recusa');

-- 6–9: a regra única de classificação
select results_eq($$ select funcionalidade, cliente_id from public.uso_ia_classificacao(null, now()) $$,
  $$ values ('nao_identificado'::text, null::uuid) $$, 'sem conversa: nao_identificado, sem empresa');
select results_eq($$ select funcionalidade, cliente_id from public.uso_ia_classificacao('fc000000-0000-0000-0000-000000000001', '2026-09-20 11:00-03') $$,
  $$ values ('agente_clientes'::text, 'fb000000-0000-0000-0000-000000000001'::uuid) $$, 'com conversa: agente, empresa da última mensagem até ali');
select results_eq($$ select cliente_id from public.uso_ia_classificacao('fc000000-0000-0000-0000-000000000001', '2026-09-20 13:00-03') $$,
  $$ values ('fb000000-0000-0000-0000-000000000002'::uuid) $$, 'depois da troca: a empresa nova');
select results_eq($$ select cliente_id from public.uso_ia_classificacao('fc000000-0000-0000-0000-000000000001', '2026-09-20 09:00-03') $$,
  $$ values (null::uuid) $$, 'antes de qualquer mensagem com empresa: sem empresa (nunca a em foco de hoje)');

-- 10–13: o gatilho aplica a regra a quem grava sem funcionalidade (trabalhador antigo)
insert into public.uso_ia (conversa_id, modelo, tokens_entrada, tokens_saida, custo_usd, criado_em)
  values ('fc000000-0000-0000-0000-000000000001', 'claude-sonnet-5', 10, 5, 0.01, '2026-09-20 11:00-03');
insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd) values ('claude-sonnet-5', 10, 5, 0.02);
select results_eq($$ select funcionalidade, cliente_id::text from public.uso_ia where custo_usd = 0.01 $$,
  $$ values ('agente_clientes'::text, 'fb000000-0000-0000-0000-000000000001') $$, 'trabalhador antigo com conversa: agente + empresa');
select results_eq($$ select funcionalidade from public.uso_ia where custo_usd = 0.02 $$,
  $$ values ('nao_identificado'::text) $$, 'trabalhador antigo sem conversa: nao_identificado');
insert into public.uso_ia (conversa_id, cliente_id, modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade, usuario_id)
  values ('fc000000-0000-0000-0000-000000000001', 'fb000000-0000-0000-0000-000000000002', 'm', 1, 1, 0.03, 'sugerir_resposta', 'fa000000-0000-0000-0000-00000000000b');
select results_eq($$ select funcionalidade, cliente_id::text from public.uso_ia where custo_usd = 0.03 $$,
  $$ values ('sugerir_resposta'::text, 'fb000000-0000-0000-0000-000000000002') $$, 'quem grava completo: o gatilho não mexe');
select is(public.custo_ia_periodo('2000-01-01', '2100-01-01'), 0.06::numeric, 'teto soma tudo, inclusive o classificado');

-- 14–15: funções internas fechadas
select ok(not has_function_privilege('authenticated', 'public.uso_ia_classificacao(uuid, timestamptz)', 'execute'), 'classificação: só interna');
select ok(not has_function_privilege('authenticated', 'public.uso_ia_completar()', 'execute'), 'gatilho: só interno');

-- 16–20: configurações novas, só do administrador
select has_column('public', 'configuracoes', 'cotacao_usd_brl', 'cotação');
select has_column('public', 'configuracoes', 'custo_minuto_transcricao_usd', 'custo por minuto da transcrição');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ update public.configuracoes set cotacao_usd_brl = 5.5 where id = 1 $$, 'P0001',
  'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'Configurações: Sim não muda a cotação');
select throws_ok($$ update public.configuracoes set custo_minuto_transcricao_usd = 0.001 where id = 1 $$, 'P0001',
  'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'nem o custo por minuto');
select set_config('request.jwt.claims', '{"sub":"fa000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set cotacao_usd_brl = 5.55, custo_minuto_transcricao_usd = 0.000667 where id = 1 $$,
  'administrador muda os dois');

select * from finish();
rollback;
```

(Confira com `grep -n "usuario_permissoes" supabase/tests/27_painel_v2_configuracoes_permissao.test.sql` como o 27 dá "Configurações: Sim" a uma pessoa e use o mesmo jeito se a chave única for outra.)

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db --file supabase/tests/32_painel_v2_gastos_colunas.test.sql` (se a CLI não aceitar `--file`, `supabase test db` e olhe a linha do 32).
Expected: FAIL — `column "cliente_id" … does not exist`.

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261006000100_painel_v2_gastos_colunas.sql`:

```sql
-- supabase/migrations/20261006000100_painel_v2_gastos_colunas.sql
-- Painel v2, Parte F (spec 7B.2): uso_ia registra empresa, setor, provedor e segundos de áudio. Quem grava sem
-- funcionalidade (registros antigos, trabalhador antigo) passa por uma regra só, uso_ia_classificacao (P1–P3).

alter table public.uso_ia
  add column cliente_id uuid references public.clientes (id) on delete set null,
  add column setor_id uuid references public.setores (id) on delete set null,
  add column provedor text not null default 'anthropic' check (provedor in ('anthropic', 'groq')),
  add column segundos_audio numeric(10, 2) check (segundos_audio >= 0);

-- Filtros da tela (spec 7B.2) e as chaves estrangeiras (apagar empresa/conversa/pessoa não varre a tabela).
drop index public.uso_ia_usuario_idx;
create index uso_ia_criado_idx on public.uso_ia (criado_em);
create index uso_ia_funcionalidade_idx on public.uso_ia (funcionalidade, criado_em);
create index uso_ia_usuario_idx on public.uso_ia (usuario_id, criado_em);
create index uso_ia_cliente_idx on public.uso_ia (cliente_id, criado_em);
create index uso_ia_conversa_idx on public.uso_ia (conversa_id, criado_em);
create index uso_ia_setor_idx on public.uso_ia (setor_id);

-- Com conversa: era o agente (único caminho antigo que gravava conversa). Empresa: a da última mensagem com empresa
-- até aquele momento, nunca a em foco de hoje (P2).
create function public.uso_ia_classificacao(p_conversa uuid, p_quando timestamptz)
returns table (funcionalidade text, cliente_id uuid)
language sql stable security definer set search_path = '' as $$
  select case when p_conversa is null then 'nao_identificado' else 'agente_clientes' end,
         (select m.cliente_id from public.mensagens m
           where p_conversa is not null and m.conversa_id = p_conversa and m.cliente_id is not null and m.criado_em <= p_quando
           order by m.criado_em desc limit 1)
$$;
revoke execute on function public.uso_ia_classificacao(uuid, timestamptz) from public, anon, authenticated;

-- O trabalhador novo sempre manda a funcionalidade; o antigo (porta 3001 até a troca) não: sem isto o agente pararia.
create function public.uso_ia_completar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c record;
begin
  if new.funcionalidade is null then
    select * into c from public.uso_ia_classificacao(new.conversa_id, new.criado_em);
    new.funcionalidade := c.funcionalidade;
    new.cliente_id := coalesce(new.cliente_id, c.cliente_id);
  end if;
  return new;
end $$;
revoke execute on function public.uso_ia_completar() from public, anon, authenticated;
create trigger completar before insert on public.uso_ia for each row execute function public.uso_ia_completar();

-- Cotação para mostrar R$ e preço por minuto da transcrição (spec 7B.2, seção 9): o administrador preenche.
alter table public.configuracoes
  add column cotacao_usd_brl numeric(8, 4) check (cotacao_usd_brl > 0),
  add column custo_minuto_transcricao_usd numeric(10, 6) check (custo_minuto_transcricao_usd >= 0);

create or replace function public.configuracoes_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.eh_admin() then return new; end if;
  if (new.teto_ia_usd, new.alerta_ia_80_mes, new.minutos_alerta_fila, new.modelo_conversa, new.modelo_rapido, new.precos_modelos,
      new.telefone_dono, new.email_alertas, new.agente_pausado, new.cotacao_usd_brl, new.custo_minuto_transcricao_usd)
     is distinct from
     (old.teto_ia_usd, old.alerta_ia_80_mes, old.minutos_alerta_fila, old.modelo_conversa, old.modelo_rapido, old.precos_modelos,
      old.telefone_dono, old.email_alertas, old.agente_pausado, old.cotacao_usd_brl, old.custo_minuto_transcricao_usd) then
    raise exception 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.';
  end if;
  return new;
end $$;
```

(Antes de trocar `configuracoes_so_admin`, confira com `grep -rn "configuracoes_so_admin" supabase/migrations` que a última versão é a da `20261004000500`; se outra migração a trocou depois, parta da mais nova.)

- [ ] **Passo 4: rodar e ver passar; regressão**

Run: `supabase db reset && supabase test db`
Expected: `32_painel_v2_gastos_colunas` 20/20; `22_regressao_visibilidade` 100/100 (igual a `$SCRATCH/regressao-antes.txt`); `25_painel_v2_horario` e `27b` passam; `Result: PASS`.

- [ ] **Passo 5: commit**

```bash
git add supabase/migrations/20261006000100_painel_v2_gastos_colunas.sql supabase/tests/32_painel_v2_gastos_colunas.test.sql
git commit -m "feat(banco): uso_ia com empresa, setor, provedor e segundos; classificação de quem grava sem funcionalidade

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banco. Registros antigos

**Files:**
- Create: `supabase/migrations/20261006000200_painel_v2_gastos_antigos.sql`
- Create: `supabase/tests/33_painel_v2_gastos_antigos.test.sql`

**Interfaces:**
- Consumes: `public.uso_ia_classificacao` (Task 1).
- Produces: `uso_ia.funcionalidade not null`; registros antigos classificados; empresa preenchida nos registros de agente e sugestão que tinham conversa e não tinham empresa.

- [ ] **Passo 1: escrever o teste que falha**

A migração roda antes do pgTAP, então o teste confere o **resultado** (nenhum nulo, coluna travada) e que a regra continua valendo para o que entra depois:

```sql
-- Parte F, Task 2 (Prompt F): registros antigos classificados pela mesma regra; nenhum nulo; a coluna fica travada.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select col_not_null('public', 'uso_ia', 'funcionalidade', 'funcionalidade obrigatória');
select is((select count(*) from public.uso_ia where funcionalidade is null), 0::bigint, 'nenhum registro sem funcionalidade');
-- Mesmo com o gatilho desligado, o banco recusa nulo (a trava é da coluna).
alter table public.uso_ia disable trigger completar;
select throws_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd) values ('m', 0, 0, 0) $$,
  '23502', null, 'nulo recusado pela coluna');
alter table public.uso_ia enable trigger completar;
select lives_ok($$ insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd) values ('m', 0, 0, 0) $$,
  'com o gatilho, o trabalhador antigo continua gravando');
select is((select funcionalidade from public.uso_ia order by criado_em desc limit 1), 'nao_identificado', 'e entra classificado');

select * from finish();
rollback;
```

Run: `supabase db reset && supabase test db` → Expected: FAIL no 33 (`col_not_null`).

- [ ] **Passo 2: escrever a migração**

`supabase/migrations/20261006000200_painel_v2_gastos_antigos.sql`:

```sql
-- supabase/migrations/20261006000200_painel_v2_gastos_antigos.sql
-- Painel v2, Parte F (Prompt F): registros antigos ganham funcionalidade pela regra única (com conversa → agente_clientes,
-- sem → nao_identificado) e a empresa da época. As contagens foram mostradas ao dono antes (Entrega, item 3).
-- (Subconsulta, não lateral: o Postgres não deixa o lateral olhar a tabela do update.)

update public.uso_ia u
set funcionalidade = (select c.funcionalidade from public.uso_ia_classificacao(u.conversa_id, u.criado_em) c),
    cliente_id = coalesce(u.cliente_id, (select c.cliente_id from public.uso_ia_classificacao(u.conversa_id, u.criado_em) c))
where u.funcionalidade is null;

-- Sugestões da Parte E já tinham funcionalidade, mas não empresa.
update public.uso_ia u
set cliente_id = (select c.cliente_id from public.uso_ia_classificacao(u.conversa_id, u.criado_em) c)
where u.cliente_id is null and u.conversa_id is not null and u.funcionalidade = 'sugerir_resposta';

alter table public.uso_ia alter column funcionalidade set not null;
```

- [ ] **Passo 3: rodar e ver passar**

Run: `supabase db reset && supabase test db`
Expected: `33` 5/5; `31_painel_v2_sugestao` continua passando (ele insere com funcionalidade); `22` 100/100; `Result: PASS`.

- [ ] **Passo 4: preparar a consulta só de leitura da Entrega**

Grave em `$SCRATCH/contagem-uso-ia.sql` (fora do repositório; é a mesma regra da migração, sem mudar nada):

```sql
begin transaction read only;
select fica_como, count(*) as registros, round(sum(custo_usd), 4) as custo_usd,
       count(*) filter (where empresa_preenchida) as com_empresa
from (
  select case when u.funcionalidade is not null then 'já tem: ' || u.funcionalidade
              when u.conversa_id is not null then 'agente_clientes'
              else 'nao_identificado' end as fica_como,
         u.custo_usd,
         (u.cliente_id is not null or exists (
            select 1 from public.mensagens m where u.conversa_id is not null and m.conversa_id = u.conversa_id
              and m.cliente_id is not null and m.criado_em <= u.criado_em)) as empresa_preenchida
  from public.uso_ia u
) x
group by fica_como order by fica_como;
rollback;
```

Teste a consulta no banco **local** (depois do reset, com alguns registros inseridos à mão, ou vazia): `psql "postgresql://postgres:postgres@127.0.0.1:56322/postgres" -f "$SCRATCH/contagem-uso-ia.sql"`. Sem `psql` na máquina, use o `pg` que já vem com o trabalhador (o `pg-boss` depende dele):

```bash
cd apps/trabalhador && node -e "
const { createRequire } = require('node:module'); const r = createRequire(require.resolve('pg-boss'));
const { Client } = r('pg'); const sql = require('node:fs').readFileSync(process.argv[1], 'utf8');
const c = new Client({ connectionString: process.env.URL_LEITURA }); c.connect().then(() => c.query(sql))
  .then((res) => { for (const x of [].concat(res)) if (x.rows?.length) console.table(x.rows); }).finally(() => c.end());
" "$SCRATCH/contagem-uso-ia.sql"
```

(com `URL_LEITURA` = a URL local). Na Entrega, a mesma consulta roda contra a homologação.

- [ ] **Passo 5: commit**

```bash
git add supabase/migrations/20261006000200_painel_v2_gastos_antigos.sql supabase/tests/33_painel_v2_gastos_antigos.test.sql
git commit -m "feat(banco): registros antigos de uso_ia classificados e funcionalidade obrigatória

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Banco. Funções de leitura do administrador

**Files:**
- Create: `supabase/migrations/20261006000300_painel_v2_gastos_funcoes.sql`
- Create: `supabase/tests/34_painel_v2_gastos_funcoes.test.sql`

**Interfaces:**
- Consumes: `public.eh_admin()`, `uso_ia` (Tasks 1–2), `mensagens`, `conversa_eventos`, `conversas`, `contatos`, `clientes`, `usuarios`, `configuracoes.precos_modelos`.
- Produces (todas `security definer`, `search_path = ''`, `grant execute … to authenticated`, recusam quem não é administrador com `'Só o administrador vê os gastos com IA.'` e período inválido com `'Período inválido.'`; datas `p_de` inclusive, `p_ate` exclusive):
  - `gastos_resumo(p_de timestamptz, p_ate timestamptz) returns jsonb` com `total_usd, chamadas, atendimentos, custo_atendimentos_usd, segundos_audio, custo_audio_usd, economia_cache_usd, nao_identificado`;
  - `gastos_por_funcionalidade(p_de, p_ate) returns table (funcionalidade text, custo_usd numeric, chamadas bigint)`;
  - `gastos_por_dia(p_de, p_ate) returns table (dia date, custo_usd numeric, chamadas bigint)` (todos os dias, inclusive sem gasto);
  - `gastos_dia_mais_caro(p_de, p_ate) returns table (dia date, custo_dia numeric, dias_com_gasto bigint, funcionalidade text, usuario_id uuid, pessoa text, custo numeric, chamadas bigint)`;
  - `gastos_por_pessoa(p_de, p_ate) returns table (usuario_id uuid, nome text, funcionalidade text, custo_usd numeric, chamadas bigint)`;
  - `gastos_por_cliente(p_de, p_ate, p_busca text default null) returns table (cliente_id uuid, nome text, atendimentos bigint, custo_usd numeric, resolvidos bigint)` (`cliente_id` nulo = "Sem empresa identificada");
  - `gastos_atendimentos_do_cliente(p_cliente uuid, p_de, p_ate) returns table (conversa_id uuid, dia date, inicio timestamptz, contato text, mensagens bigint, resultado text, custo_usd numeric)` (`resultado` = `'passou_para_pessoa' | 'resolvido_pelo_agente'`);
  - `gastos_chamadas(p_de, p_ate, p_usuario uuid default null, p_cliente uuid default null, p_funcionalidade text default null, p_limite int default 200) returns table (id uuid, criado_em timestamptz, funcionalidade text, usuario_id uuid, pessoa text, cliente_id uuid, empresa text, conversa_id uuid, modelo text, provedor text, tokens_entrada int, tokens_saida int, tokens_cache_leitura int, tokens_cache_escrita int, segundos_audio numeric, custo_usd numeric)` (mais novas primeiro; limite entre 1 e 100.000).

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/34_painel_v2_gastos_funcoes.test.sql`:

```sql
-- Parte F, Task 3 (spec 7B.2, 7B.4): funções de leitura só do administrador; atendimento = conversa + dia de Brasília;
-- "passou para pessoa" quando houve assumir ou resposta humana naquele dia.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email) values
  ('fd000000-0000-0000-0000-00000000000a', 'admin@gastos3.local'),
  ('fd000000-0000-0000-0000-00000000000b', 'ana@gastos3.local'),
  ('fd000000-0000-0000-0000-00000000000c', 'velho@gastos3.local');
insert into public.usuarios (id, nome, email, papel, permissoes, ativo) values
  ('fd000000-0000-0000-0000-00000000000a', 'Thiago', 'admin@gastos3.local', 'admin', '{}', true),
  ('fd000000-0000-0000-0000-00000000000b', 'Ana', 'ana@gastos3.local', 'atendente', '{assistente_site}', true),
  ('fd000000-0000-0000-0000-00000000000c', 'Admin arquivado', 'velho@gastos3.local', 'admin', '{}', false);
insert into public.clientes (id, razao_social, nome_fantasia, cnpj) values
  ('fe000000-0000-0000-0000-000000000001', 'Rede Bom Preço Ltda', null, '33333333000101'),
  ('fe000000-0000-0000-0000-000000000002', 'Mercado Central Ltda', 'Mercado Central', '44444444000102');
insert into public.contatos (id, nome, telefone) values ('ff000000-0000-0000-0000-000000000001', 'Carla Mendes', '5531955550001');
insert into public.conversas (id, telefone, contato_id) values
  ('f0000000-0000-0000-0000-000000000001', '5531955550001', 'ff000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', '5531955550002', null);
-- Carla: dia 20 (agente sozinho), dia 21 23:50 e 22 00:10 de Brasília (dois dias; no 22 Ana responde), dia 23 (Ana assume).
insert into public.mensagens (conversa_id, cliente_id, direcao, autor, atendente_id, conteudo, criado_em) values
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'oi', '2026-09-20 10:00-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'saida', 'agente', null, 'olá', '2026-09-20 10:01-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'saida', 'sistema', null, 'aviso', '2026-09-20 10:01-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'nota', '2026-09-21 23:50-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'e aí', '2026-09-22 00:10-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'saida', 'atendente', 'fd000000-0000-0000-0000-00000000000b', 'vi', '2026-09-22 09:00-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'entrada', 'cliente', null, 'de novo', '2026-09-23 10:00-03');
insert into public.conversa_eventos (conversa_id, tipo, usuario_id, criado_em)
  values ('f0000000-0000-0000-0000-000000000001', 'assumida', 'fd000000-0000-0000-0000-00000000000b', '2026-09-23 10:05-03');
insert into public.uso_ia (conversa_id, cliente_id, usuario_id, funcionalidade, modelo, tokens_entrada, tokens_saida, tokens_cache_leitura, custo_usd, segundos_audio, provedor, criado_em) values
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 1000000, 0.10, null, 'anthropic', '2026-09-20 10:00-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 0, 0.20, null, 'anthropic', '2026-09-21 23:50-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'transcricao_audio', 'whisper', 0, 0, 0, 0.01, 90, 'groq', '2026-09-22 00:10-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-00000000000b', 'sugerir_resposta', 'claude-sonnet-5', 100, 10, 0, 0.30, null, 'anthropic', '2026-09-22 08:59-03'),
  ('f0000000-0000-0000-0000-000000000001', 'fe000000-0000-0000-0000-000000000001', null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 0, 0.40, null, 'anthropic', '2026-09-23 10:00-03'),
  ('f0000000-0000-0000-0000-000000000002', null, null, 'agente_clientes', 'claude-sonnet-5', 100, 10, 0, 0.05, null, 'anthropic', '2026-09-23 11:00-03'),
  (null, null, 'fd000000-0000-0000-0000-00000000000b', 'assistente_site', 'claude-sonnet-5', 100, 10, 0, 0.50, null, 'anthropic', '2026-09-23 12:00-03'),
  (null, null, 'fd000000-0000-0000-0000-00000000000a', 'testar_agente', 'claude-sonnet-5', 100, 10, 0, 0.90, null, 'anthropic', '2026-09-23 13:00-03'),
  (null, null, null, 'nao_identificado', 'claude-sonnet-5', 1, 1, 0, 0.04, null, 'anthropic', '2026-09-24 09:00-03');

-- Período: 20/09 00:00 a 25/09 00:00 de Brasília (5 dias).
create temp table p as select '2026-09-20 00:00-03'::timestamptz as de, '2026-09-25 00:00-03'::timestamptz as ate;
grant select on p to authenticated;

set local role authenticated;
-- 1–9: atendente recusada em todas; arquivado também
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.gastos_resumo(de, ate) from p $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: resumo');
select throws_ok($$ select * from public.gastos_por_funcionalidade((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: funcionalidade');
select throws_ok($$ select * from public.gastos_por_dia((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: dia');
select throws_ok($$ select * from public.gastos_dia_mais_caro((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: dia mais caro');
select throws_ok($$ select * from public.gastos_por_pessoa((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: pessoa');
select throws_ok($$ select * from public.gastos_por_cliente((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: cliente');
select throws_ok($$ select * from public.gastos_atendimentos_do_cliente('fe000000-0000-0000-0000-000000000001', (select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: atendimentos');
select throws_ok($$ select * from public.gastos_chamadas((select de from p), (select ate from p)) $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'atendente: chamadas');
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.gastos_resumo(de, ate) from p $$, 'P0001', 'Só o administrador vê os gastos com IA.', 'administrador arquivado: recusado');

-- 10: anon nem executa
select ok(not has_function_privilege('anon', 'public.gastos_resumo(timestamptz, timestamptz)', 'execute'), 'anon sem execução');

-- 11–31: administrador
select set_config('request.jwt.claims', '{"sub":"fd000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.gastos_resumo('2026-09-25', '2026-09-20') $$, 'P0001', 'Período inválido.', 'de depois de até: recusa');
select throws_ok($$ select public.gastos_resumo('2025-01-01', '2026-09-20') $$, 'P0001', 'Período inválido.', 'mais de 366 dias: recusa');
select is((select (public.gastos_resumo(de, ate) ->> 'total_usd')::numeric from p), 2.50, 'total do período');
select is((select (public.gastos_resumo(de, ate) ->> 'chamadas')::int from p), 9, 'chamadas');
-- Carla: 20, 21, 22, 23 = 4; conversa 2: 23 = 1 → 5 (21 23:50 e 22 00:10 são dias diferentes em Brasília).
select is((select (public.gastos_resumo(de, ate) ->> 'atendimentos')::int from p), 5, 'mesmo telefone em dois dias = dois atendimentos');
select is((select (public.gastos_resumo(de, ate) ->> 'custo_atendimentos_usd')::numeric from p), 1.06, 'custo dos atendimentos (só com conversa)');
select is((select (public.gastos_resumo(de, ate) ->> 'segundos_audio')::numeric from p), 90::numeric, 'segundos de áudio');
-- 1.000.000 tokens de leitura de cache × (2 − 0,2) US$/milhão = US$ 1,80 de economia.
select is((select (public.gastos_resumo(de, ate) ->> 'economia_cache_usd')::numeric from p), 1.80, 'economia do cache pelos preços');
select is((select (public.gastos_resumo(de, ate) ->> 'nao_identificado')::int from p), 1, 'chamadas não identificadas contadas');
select results_eq($$ select funcionalidade, custo_usd from public.gastos_por_funcionalidade((select de from p), (select ate from p)) order by custo_usd desc limit 2 $$,
  $$ values ('testar_agente'::text, 0.90::numeric), ('agente_clientes'::text, 0.75::numeric) $$, 'por funcionalidade, mais caro primeiro');
select is((select count(*) from public.gastos_por_dia((select de from p), (select ate from p))), 5::bigint, 'todos os dias do período');
select is((select custo_usd from public.gastos_por_dia((select de from p), (select ate from p)) where dia = '2026-09-21'), 0.20, 'dia 21 (23:50 de Brasília) fica no 21');
select results_eq($$ select dia, funcionalidade, pessoa, chamadas from public.gastos_dia_mais_caro((select de from p), (select ate from p)) $$,
  $$ values ('2026-09-23'::date, 'testar_agente'::text, 'Thiago'::text, 1::bigint) $$, 'dia mais caro e o que mais pesou nele');
select is((select dias_com_gasto from public.gastos_dia_mais_caro((select de from p), (select ate from p))), 5::bigint, 'dias com gasto (o alerta só aparece com 2 ou mais)');
select is((select count(*) from public.gastos_por_pessoa((select de from p), (select ate from p)) where usuario_id is null), 0::bigint, 'ranking só com ações de pessoas');
select is((select sum(custo_usd) from public.gastos_por_pessoa((select de from p), (select ate from p)) where nome = 'Ana'), 0.80, 'Ana: sugestão + assistente');
select results_eq($$ select nome, atendimentos, custo_usd, resolvidos from public.gastos_por_cliente((select de from p), (select ate from p)) $$,
  $$ values ('Rede Bom Preço Ltda'::text, 4::bigint, 1.01::numeric, 2::bigint), ('Sem empresa identificada'::text, 1::bigint, 0.05::numeric, 1::bigint) $$,
  'por cliente: atendimentos, custo e resolvidos pelo agente');
select is((select count(*) from public.gastos_por_cliente((select de from p), (select ate from p), 'central')), 0::bigint, 'busca sem gasto: vazio');
select results_eq($$ select dia, contato, mensagens, resultado from public.gastos_atendimentos_do_cliente('fe000000-0000-0000-0000-000000000001', (select de from p), (select ate from p)) order by dia $$,
  $$ values ('2026-09-20'::date, 'Carla Mendes'::text, 2::bigint, 'resolvido_pelo_agente'::text),
            ('2026-09-21'::date, 'Carla Mendes'::text, 1::bigint, 'resolvido_pelo_agente'::text),
            ('2026-09-22'::date, 'Carla Mendes'::text, 2::bigint, 'passou_para_pessoa'::text),
            ('2026-09-23'::date, 'Carla Mendes'::text, 1::bigint, 'passou_para_pessoa'::text) $$,
  'atendimentos: mensagens sem as do sistema; resposta humana ou assumir = passou para pessoa');
select is((select count(*) from public.gastos_chamadas((select de from p), (select ate from p), p_usuario => 'fd000000-0000-0000-0000-00000000000b')), 2::bigint, 'chamadas de uma pessoa');
select is((select count(*) from public.gastos_chamadas((select de from p), (select ate from p), p_limite => 3)), 3::bigint, 'limite');

select * from finish();
rollback;
```

Contas do teste (para conferir): total = 0,10+0,20+0,01+0,30+0,40+0,05+0,50+0,90+0,04 = **2,50**; com conversa = 0,10+0,20+0,01+0,30+0,40+0,05 = **1,06**; Rede = 1,06 − 0,05 = **1,01**; resolvidos da Rede = dias 20 e 21 = **2**; agente = 0,10+0,20+0,40+0,05 = **0,75**; dia 23 = 0,40+0,05+0,50+0,90 = 1,85 (o mais caro).

Run: `supabase test db` → Expected: FAIL no 34 (`function public.gastos_resumo … does not exist`).

- [ ] **Passo 2: escrever a migração**

`supabase/migrations/20261006000300_painel_v2_gastos_funcoes.sql`:

```sql
-- supabase/migrations/20261006000300_painel_v2_gastos_funcoes.sql
-- Painel v2, Parte F (spec 7B.2): leituras da tela Gastos com IA, só do administrador (spec 7: não é permissão
-- configurável). "Atendimento" = mensagens de um telefone num mesmo dia de Brasília (conversas é uma por telefone).

create function public.gastos_checar(p_de timestamptz, p_ate timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador vê os gastos com IA.'; end if;
  if p_de is null or p_ate is null or p_ate <= p_de or p_ate - p_de > interval '367 days' then
    raise exception 'Período inválido.';
  end if;
end $$;
revoke execute on function public.gastos_checar(timestamptz, timestamptz) from public, anon, authenticated;

-- Base interna: um atendimento por (conversa, dia, empresa). Passou para pessoa: resposta humana ou assumir no dia.
create function public.gastos_atendimentos_base(p_de timestamptz, p_ate timestamptz)
returns table (conversa_id uuid, dia date, cliente_id uuid, custo_usd numeric, chamadas bigint, passou_para_pessoa boolean)
language sql stable security definer set search_path = '' as $$
  with a as (
    select u.conversa_id, (u.criado_em at time zone 'America/Sao_Paulo')::date as dia, u.cliente_id,
           sum(u.custo_usd) as custo_usd, count(*) as chamadas
    from public.uso_ia u
    where u.conversa_id is not null and u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2, 3
  )
  select a.conversa_id, a.dia, a.cliente_id, a.custo_usd, a.chamadas,
         exists (select 1 from public.mensagens m
                  where m.conversa_id = a.conversa_id and m.autor = 'atendente'
                    and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo'))
         or exists (select 1 from public.conversa_eventos e
                  where e.conversa_id = a.conversa_id and e.tipo = 'assumida'
                    and e.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and e.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo'))
  from a
$$;
revoke execute on function public.gastos_atendimentos_base(timestamptz, timestamptz) from public, anon, authenticated;

create function public.gastos_resumo(p_de timestamptz, p_ate timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  perform public.gastos_checar(p_de, p_ate);
  with precos as (
    select k.key as modelo, (k.value ->> 'entrada')::numeric as entrada,
           (k.value ->> 'cacheLeitura')::numeric as cache_leitura, (k.value ->> 'cacheEscrita')::numeric as cache_escrita
    from public.configuracoes c, jsonb_each(c.precos_modelos) k where c.id = 1
  )
  select jsonb_build_object(
    'total_usd', coalesce(sum(u.custo_usd), 0),
    'chamadas', count(*),
    'atendimentos', count(distinct (u.conversa_id, (u.criado_em at time zone 'America/Sao_Paulo')::date)) filter (where u.conversa_id is not null),
    'custo_atendimentos_usd', coalesce(sum(u.custo_usd) filter (where u.conversa_id is not null), 0),
    'segundos_audio', coalesce(sum(u.segundos_audio) filter (where u.funcionalidade = 'transcricao_audio'), 0),
    'custo_audio_usd', coalesce(sum(u.custo_usd) filter (where u.funcionalidade = 'transcricao_audio'), 0),
    'economia_cache_usd', coalesce(sum((u.tokens_cache_leitura * (p.entrada - p.cache_leitura)
                                        - u.tokens_cache_escrita * (p.cache_escrita - p.entrada)) / 1000000.0), 0),
    'nao_identificado', count(*) filter (where u.funcionalidade = 'nao_identificado'))
  into r
  from public.uso_ia u left join precos p on p.modelo = u.modelo
  where u.criado_em >= p_de and u.criado_em < p_ate;
  return r;
end $$;

create function public.gastos_por_funcionalidade(p_de timestamptz, p_ate timestamptz)
returns table (funcionalidade text, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select u.funcionalidade, sum(u.custo_usd), count(*)
    from public.uso_ia u where u.criado_em >= p_de and u.criado_em < p_ate
    group by 1 order by 2 desc, 1;
end $$;

create function public.gastos_por_dia(p_de timestamptz, p_ate timestamptz)
returns table (dia date, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    with u as (
      select (x.criado_em at time zone 'America/Sao_Paulo')::date as dia, x.custo_usd
      from public.uso_ia x where x.criado_em >= p_de and x.criado_em < p_ate
    )
    select d::date, coalesce(sum(u.custo_usd), 0), count(u.custo_usd)
    from generate_series((p_de at time zone 'America/Sao_Paulo')::date,
                         ((p_ate - interval '1 microsecond') at time zone 'America/Sao_Paulo')::date, interval '1 day') d
    left join u on u.dia = d::date
    group by 1 order by 1;
end $$;

create function public.gastos_dia_mais_caro(p_de timestamptz, p_ate timestamptz)
returns table (dia date, custo_dia numeric, dias_com_gasto bigint, funcionalidade text, usuario_id uuid, pessoa text, custo numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    with u as (
      select (x.criado_em at time zone 'America/Sao_Paulo')::date as dia, x.funcionalidade, x.usuario_id, x.custo_usd
      from public.uso_ia x where x.criado_em >= p_de and x.criado_em < p_ate
    ),
    dias as (select u.dia, sum(u.custo_usd) as total from u group by 1),
    topo as (select d.dia, d.total from dias d order by d.total desc, d.dia desc limit 1)
    select t.dia, t.total, (select count(*) from dias), u.funcionalidade, u.usuario_id, us.nome, sum(u.custo_usd), count(*)
    from topo t join u on u.dia = t.dia left join public.usuarios us on us.id = u.usuario_id
    group by t.dia, t.total, u.funcionalidade, u.usuario_id, us.nome
    order by 7 desc limit 1;
end $$;

create function public.gastos_por_pessoa(p_de timestamptz, p_ate timestamptz)
returns table (usuario_id uuid, nome text, funcionalidade text, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select u.usuario_id, us.nome, u.funcionalidade, sum(u.custo_usd), count(*)
    from public.uso_ia u join public.usuarios us on us.id = u.usuario_id
    where u.usuario_id is not null and u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2, 3;
end $$;

create function public.gastos_por_cliente(p_de timestamptz, p_ate timestamptz, p_busca text default null)
returns table (cliente_id uuid, nome text, atendimentos bigint, custo_usd numeric, resolvidos bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select a.cliente_id, coalesce(c.nome_fantasia, c.razao_social, 'Sem empresa identificada'),
           count(*), sum(a.custo_usd), count(*) filter (where not a.passou_para_pessoa)
    from public.gastos_atendimentos_base(p_de, p_ate) a left join public.clientes c on c.id = a.cliente_id
    where coalesce(trim(p_busca), '') = ''
       or strpos(lower(coalesce(c.nome_fantasia, '') || ' ' || coalesce(c.razao_social, '')), lower(trim(p_busca))) > 0
    group by 1, 2 order by 4 desc, 2 limit 200;
end $$;

create function public.gastos_atendimentos_do_cliente(p_cliente uuid, p_de timestamptz, p_ate timestamptz)
returns table (conversa_id uuid, dia date, inicio timestamptz, contato text, mensagens bigint, resultado text, custo_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select a.conversa_id, a.dia,
           (select min(m.criado_em) from public.mensagens m where m.conversa_id = a.conversa_id
              and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo') and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo')),
           coalesce(ct.nome, 'Contato não cadastrado'),
           (select count(*) from public.mensagens m where m.conversa_id = a.conversa_id and m.autor <> 'sistema'
              and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo') and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo')),
           case when a.passou_para_pessoa then 'passou_para_pessoa' else 'resolvido_pelo_agente' end,
           a.custo_usd
    from public.gastos_atendimentos_base(p_de, p_ate) a
    left join public.conversas cv on cv.id = a.conversa_id
    left join public.contatos ct on ct.id = cv.contato_id
    where a.cliente_id is not distinct from p_cliente
    order by a.dia desc, 3 desc limit 500;
end $$;

create function public.gastos_chamadas(p_de timestamptz, p_ate timestamptz, p_usuario uuid default null, p_cliente uuid default null,
                                       p_funcionalidade text default null, p_limite int default 200)
returns table (id uuid, criado_em timestamptz, funcionalidade text, usuario_id uuid, pessoa text, cliente_id uuid, empresa text,
               conversa_id uuid, modelo text, provedor text, tokens_entrada int, tokens_saida int, tokens_cache_leitura int,
               tokens_cache_escrita int, segundos_audio numeric, custo_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select u.id, u.criado_em, u.funcionalidade, u.usuario_id, us.nome, u.cliente_id, coalesce(c.nome_fantasia, c.razao_social),
           u.conversa_id, u.modelo, u.provedor, u.tokens_entrada, u.tokens_saida, u.tokens_cache_leitura, u.tokens_cache_escrita,
           u.segundos_audio, u.custo_usd
    from public.uso_ia u
    left join public.usuarios us on us.id = u.usuario_id
    left join public.clientes c on c.id = u.cliente_id
    where u.criado_em >= p_de and u.criado_em < p_ate
      and (p_usuario is null or u.usuario_id = p_usuario)
      and (p_cliente is null or u.cliente_id = p_cliente)
      and (p_funcionalidade is null or u.funcionalidade = p_funcionalidade)
    order by u.criado_em desc, u.id
    limit least(greatest(coalesce(p_limite, 200), 1), 100000);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.gastos_resumo(timestamptz, timestamptz)', 'public.gastos_por_funcionalidade(timestamptz, timestamptz)',
    'public.gastos_por_dia(timestamptz, timestamptz)', 'public.gastos_dia_mais_caro(timestamptz, timestamptz)',
    'public.gastos_por_pessoa(timestamptz, timestamptz)', 'public.gastos_por_cliente(timestamptz, timestamptz, text)',
    'public.gastos_atendimentos_do_cliente(uuid, timestamptz, timestamptz)',
    'public.gastos_chamadas(timestamptz, timestamptz, uuid, uuid, text, int)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
```

Observação: `gastos_por_pessoa` usa `join` (pessoa apagada some do ranking; o gasto continua no total). `gastos_checar` é `stable` e não grava: o `25` não a acusa.

- [ ] **Passo 3: rodar e ver passar; regressão**

Run: `supabase db reset && supabase test db`
Expected: `34` 31/31; `22` 100/100; `25` passa (nenhuma função de gravação sem trava); `Result: PASS`.

Se o `results_eq` do `gastos_por_cliente` falhar por tipo (`numeric(12,6)` × `numeric`), troque o valor esperado por `1.010000::numeric` ou compare com `round(custo_usd, 2)` no select do teste — **nunca** mude a função para fazer o teste passar.

- [ ] **Passo 4: commit**

```bash
git add supabase/migrations/20261006000300_painel_v2_gastos_funcoes.sql supabase/tests/34_painel_v2_gastos_funcoes.test.sql
git commit -m "feat(banco): leituras de gastos com IA só do administrador, com atendimento por telefone e dia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Core e db. `registrarUsoIa` exigente

**Files:**
- Modify: `packages/core/src/custo.ts`, `packages/core/test/custo.test.ts`
- Modify: `packages/db/src/repos.ts` (tipo `Configuracoes`, `obterConfiguracoes`, `registrarUsoIa`)
- Modify: `packages/db/src/tipos.gen.ts` (regerado)
- Modify: `packages/db/test/repos.test.ts`, `packages/db/test/atendimento.test.ts`

**Interfaces:**
- Consumes: colunas das Tasks 1–2.
- Produces:
  - core: `type FuncionalidadeGravavel = Exclude<FuncionalidadeIa, 'nao_identificado'>`; `PROVEDORES_IA = ['anthropic', 'groq'] as const`, `type ProvedorIa`; `usoDaResposta(u: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): UsoTokens`; `custoTranscricaoUsd(segundos: number | null, custoMinutoUsd: number | null): number`.
  - db: `type NovoUsoIa = { funcionalidade: FuncionalidadeGravavel; usuarioId: string | null; conversaId: string | null; clienteId: string | null; modelo: string; provedor?: ProvedorIa; tokensEntrada: number; tokensSaida: number; tokensCacheLeitura: number; tokensCacheEscrita: number; segundosAudio?: number | null; custoUsd: number }`; `repos.registrarUsoIa(u: NovoUsoIa): Promise<void>` (lança `Error('registrarUsoIa: funcionalidade obrigatória (recebido …)')`); `Configuracoes.custoMinutoTranscricaoUsd: number | null`.

- [ ] **Passo 1: testes que falham (core)**

Acrescente em `packages/core/test/custo.test.ts`:

```ts
import { custoTranscricaoUsd, usoDaResposta, FUNCIONALIDADES_IA, PROVEDORES_IA } from '../src/custo';

describe('usoDaResposta', () => {
  it('tokens da Anthropic, com cache ausente valendo 0', () => {
    expect(usoDaResposta({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: null }))
      .toEqual({ entrada: 10, saida: 5, cacheLeitura: 100, cacheEscrita: 0 });
  });
});

describe('custoTranscricaoUsd', () => {
  it('segundos ÷ 60 × preço por minuto', () => expect(custoTranscricaoUsd(90, 0.002)).toBeCloseTo(0.003, 6));
  it('sem preço configurado ou sem duração: 0', () => {
    expect(custoTranscricaoUsd(90, null)).toBe(0);
    expect(custoTranscricaoUsd(null, 0.002)).toBe(0);
    expect(custoTranscricaoUsd(-5, 0.002)).toBe(0);
  });
});

it('provedores e funcionalidades: a lista do banco', () => {
  expect(PROVEDORES_IA).toEqual(['anthropic', 'groq']);
  expect(FUNCIONALIDADES_IA).toContain('nao_identificado');
});
```

Run: `pnpm --filter @escritorio/core test` → Expected: FAIL (`usoDaResposta` não exportada).

- [ ] **Passo 2: implementar no core**

Em `packages/core/src/custo.ts`, depois de `FuncionalidadeIa`:

```ts
/** O que o código pode gravar: 'nao_identificado' é só dos registros antigos (gasto novo assim é bug, Prompt F). */
export type FuncionalidadeGravavel = Exclude<FuncionalidadeIa, 'nao_identificado'>;

/** uso_ia.provedor (regra do banco 20261006000100). */
export const PROVEDORES_IA = ['anthropic', 'groq'] as const;
export type ProvedorIa = (typeof PROVEDORES_IA)[number];

/** Tokens de uma resposta da Anthropic (input_tokens já não inclui os de cache). */
export function usoDaResposta(u: {
  input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
}): UsoTokens {
  return { entrada: u.input_tokens, saida: u.output_tokens, cacheLeitura: u.cache_read_input_tokens ?? 0, cacheEscrita: u.cache_creation_input_tokens ?? 0 };
}

/** Transcrição: US$ por minuto de Configurações (P9). Sem preço ou sem duração, 0 (a tela avisa). */
export function custoTranscricaoUsd(segundos: number | null, custoMinutoUsd: number | null): number {
  if (!segundos || !custoMinutoUsd || segundos <= 0 || custoMinutoUsd <= 0) return 0;
  return Math.round((segundos / 60) * custoMinutoUsd * 1_000_000) / 1_000_000;
}
```

Confira que `packages/core/src/index.ts` reexporta `./custo` inteiro (`grep -n "custo" packages/core/src/index.ts`); se exporta nomes um a um, acrescente os novos.

Run: `pnpm --filter @escritorio/core test` → PASS.

- [ ] **Passo 3: regerar os tipos do banco**

Run: `supabase db reset && pnpm db:tipos` (dentro da raiz, com o banco nas portas 563xx; o comando usa `--local`).
Expected: `git diff --stat packages/db/src/tipos.gen.ts` mostra `cliente_id`, `setor_id`, `provedor`, `segundos_audio`, `cotacao_usd_brl`, `custo_minuto_transcricao_usd` e as funções `gastos_*`.

- [ ] **Passo 4: testes que falham (db)**

Em `packages/db/test/atendimento.test.ts`, troque o teste do `registrarUsoIa` da Parte E (linhas ~40–46) por:

```ts
  it('registrarUsoIa grava funcionalidade, pessoa, conversa, empresa, provedor e segundos', async () => {
    await repos.registrarUsoIa({ funcionalidade: 'transcricao_audio', usuarioId: null, conversaId: null, clienteId: null, modelo: 'whisper-large-v3-turbo',
      provedor: 'groq', tokensEntrada: 0, tokensSaida: 0, tokensCacheLeitura: 0, tokensCacheEscrita: 0, segundosAudio: 42.5, custoUsd: 0.0005 });
    const l = (await db.from('uso_ia').select('funcionalidade, provedor, segundos_audio, usuario_id, cliente_id').single()).data!;
    expect(l).toEqual({ funcionalidade: 'transcricao_audio', provedor: 'groq', segundos_audio: 42.5, usuario_id: null, cliente_id: null });
  });

  it('registrarUsoIa recusa gravar sem funcionalidade ou como nao_identificado (gasto novo assim é bug)', async () => {
    const base = { usuarioId: null, conversaId: null, clienteId: null, modelo: 'm', tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01 };
    // @ts-expect-error funcionalidade é obrigatória
    await expect(repos.registrarUsoIa(base)).rejects.toThrow('registrarUsoIa: funcionalidade obrigatória');
    // @ts-expect-error nao_identificado não é gravável
    await expect(repos.registrarUsoIa({ ...base, funcionalidade: 'nao_identificado' })).rejects.toThrow('registrarUsoIa: funcionalidade obrigatória');
    expect((await db.from('uso_ia').select('id')).data).toEqual([]);
  });

  it('obterConfiguracoes traz o custo por minuto da transcrição', async () => {
    await db.from('configuracoes').update({ custo_minuto_transcricao_usd: 0.000667 }).eq('id', 1);
    expect((await repos.obterConfiguracoes()).custoMinutoTranscricaoUsd).toBeCloseTo(0.000667, 6);
    await db.from('configuracoes').update({ custo_minuto_transcricao_usd: null }).eq('id', 1);
    expect((await repos.obterConfiguracoes()).custoMinutoTranscricaoUsd).toBeNull();
  });
```

Em `packages/db/test/repos.test.ts`, nas chamadas de `registrarUsoIa` (linhas ~71 e ~100), acrescente `funcionalidade: 'agente_clientes', usuarioId: null, clienteId: null`. No `insert` direto em massa (linha ~101), acrescente `funcionalidade: 'agente_clientes'` em cada linha.

Run: `pnpm --filter @escritorio/db test` → Expected: FAIL.

- [ ] **Passo 5: implementar no db**

Em `packages/db/src/repos.ts`:
- no import de `@escritorio/core`, troque `type FuncionalidadeIa` por `FUNCIONALIDADES_IA, type FuncionalidadeGravavel, type ProvedorIa`;
- no tipo `Configuracoes`, acrescente `custoMinutoTranscricaoUsd: number | null;` e em `obterConfiguracoes`: `custoMinutoTranscricaoUsd: c.custo_minuto_transcricao_usd === null ? null : Number(c.custo_minuto_transcricao_usd),`;
- perto de `NovoChamado`, o tipo novo:

```ts
/** Uma chamada à IA (spec 7B.2). Tudo obrigatório: caminho novo que esquecer a funcionalidade não compila (Prompt F). */
export type NovoUsoIa = {
  funcionalidade: FuncionalidadeGravavel; usuarioId: string | null; conversaId: string | null; clienteId: string | null;
  modelo: string; provedor?: ProvedorIa; tokensEntrada: number; tokensSaida: number; tokensCacheLeitura: number; tokensCacheEscrita: number;
  segundosAudio?: number | null; custoUsd: number;
};
```

- e `registrarUsoIa`:

```ts
    async registrarUsoIa(u: NovoUsoIa): Promise<void> {
      // Segunda trava (a primeira é o tipo): nada novo entra como nao_identificado nem sem funcionalidade.
      const f = u.funcionalidade as string | undefined;
      if (!f || f === 'nao_identificado' || !(FUNCIONALIDADES_IA as readonly string[]).includes(f)) {
        throw new Error(`registrarUsoIa: funcionalidade obrigatória (recebido ${String(f)})`);
      }
      checar(await db.from('uso_ia').insert({
        funcionalidade: u.funcionalidade, usuario_id: u.usuarioId, conversa_id: u.conversaId, cliente_id: u.clienteId,
        modelo: u.modelo, provedor: u.provedor ?? 'anthropic', tokens_entrada: u.tokensEntrada, tokens_saida: u.tokensSaida,
        tokens_cache_leitura: u.tokensCacheLeitura, tokens_cache_escrita: u.tokensCacheEscrita,
        segundos_audio: u.segundosAudio ?? null, custo_usd: u.custoUsd,
      }), 'registrarUsoIa');
    },
```

Exporte `NovoUsoIa` em `packages/db/src/index.ts` se lá os tipos são listados um a um (`grep -n "NovoChamado" packages/db/src/index.ts`).

Run: `pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck` → Expected: PASS.
Run: `pnpm --filter @escritorio/trabalhador typecheck` → Expected: **FAIL** nos 4 lugares que chamam `registrarUsoIa` sem funcionalidade (`agente/executar.ts`, `assistente/executar.ts`, `sugestao/processar.ts`, e nos testes). É o que a Task 5 resolve; **não** commite o trabalhador quebrado: o commit desta task leva só core e db.

- [ ] **Passo 6: commit**

```bash
git add packages/core packages/db
git commit -m "feat(core,db): registrarUsoIa exige funcionalidade, pessoa, conversa e empresa; custo da transcrição

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Trabalhador. Cada caminho da Anthropic grava funcionalidade, pessoa e empresa

**Files:**
- Modify: `apps/trabalhador/src/agente/executar.ts` (`registrarUso`)
- Modify: `apps/trabalhador/src/agente/simular.ts` (`reposDaSimulacao` e a chamada em `simular`)
- Modify: `apps/trabalhador/src/assistente/executar.ts`
- Modify: `apps/trabalhador/src/sugestao/{processar,ferramentas}.ts`
- Create: `apps/trabalhador/test/gastos/caminhos.test.ts`, `apps/trabalhador/test/gastos/varredura.test.ts`
- Modify: testes que chamam `registrarUsoIa` (`test/processar-conversa.test.ts` ~34, `test/agente/simular.test.ts` ~383)

**Interfaces:**
- Consumes: `NovoUsoIa`, `usoDaResposta` (Task 4).
- Produces: `reposDaSimulacao(repos: Repos, conversa: Conversa, usuario: UsuarioAssistente | null, usuarioId: string): Repos` (quarto parâmetro novo: quem pediu o teste); `reposDaSugestao` mantém a assinatura e passa a respeitar o `clienteId` que vier na chamada.

- [ ] **Passo 1: o teste por caminho, que falha**

`apps/trabalhador/test/gastos/caminhos.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import { processarSimulacao } from '../../src/agente/simular';
import { processarAssistente } from '../../src/assistente/processar';
import { processarSugestao } from '../../src/sugestao/processar';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

// Prompt F: cada caminho que chama a IA grava a funcionalidade certa, a pessoa certa e a empresa certa.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
const usos = async () =>
  (await db.from('uso_ia').select('funcionalidade, usuario_id, conversa_id, cliente_id, provedor').order('criado_em')).data!;
const envio = () => ({ repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) });

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
});
// Cada teste confere a funcionalidade exata de TODAS as linhas: nenhuma "nao_identificado" (registro novo assim é bug).

describe('uso_ia por caminho', () => {
  it('agente de clientes: agente_clientes, sem pessoa, com a conversa e a empresa em foco', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    const c = await repos.obterConversa(conversa.id);
    const ctx = await carregarContexto(repos, c, await repos.buscarContato(c.telefone), await repos.obterConfiguracoes(), SEGUNDA_10H);
    await executarAgente({ repos, ia, envio: envio() }, ctx, [{ type: 'text', text: 'oi' }]);
    const l = await usos();
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((u) => u.funcionalidade === 'agente_clientes' && u.usuario_id === null && u.conversa_id === conversa.id
      && u.cliente_id === empresas[0]!.id && u.provedor === 'anthropic')).toBe(true);
  });

  it('assistente pelo site: assistente_site, com a pessoa, sem conversa e sem empresa (mesmo aberto numa conversa)', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana@gastos.local', permissoes: ['assistente_site'] });
    const { conversa } = await contatoComEmpresas(['Empresa Y'], '5531999990002');
    await repos.registrarMensagemAssistente({ usuarioId: ana, canal: 'site', conversaId: conversa.id, papel: 'usuario', conteudo: 'oi' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'ok' } }), fim()]);
    await processarAssistente({ repos, ia, canal }, { usuarioId: ana, canal: 'site', conversaId: conversa.id, telefone: null }, true);
    expect(await usos()).toEqual([expect.objectContaining({ funcionalidade: 'assistente_site', usuario_id: ana, conversa_id: null, cliente_id: null })]);
  });

  it('assistente pelo WhatsApp: assistente_whatsapp, com a pessoa', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana2@gastos.local', permissoes: ['assistente_site', 'assistente_whatsapp'], telefone: '5531988887777' });
    await repos.registrarMensagemAssistente({ usuarioId: ana, canal: 'whatsapp', conversaId: null, papel: 'usuario', conteudo: 'oi' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'ok' } }), fim()]);
    await processarAssistente({ repos, ia, canal }, { usuarioId: ana, canal: 'whatsapp', conversaId: null, telefone: '5531988887777' }, true);
    expect(await usos()).toEqual([expect.objectContaining({ funcionalidade: 'assistente_whatsapp', usuario_id: ana })]);
  });

  it('Sugerir resposta: sugerir_resposta, com a pessoa, a conversa e a empresa da conversa', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana3@gastos.local', permissoes: ['assistente_site'], setores: ['Fiscal'] });
    const { conversa, empresas } = await contatoComEmpresas(['Empresa Z'], '5531999990003');
    await db.from('conversas').update({ cliente_em_foco: empresas[0]!.id }).eq('id', conversa.id);
    await repos.abrirChamado({ clienteId: empresas[0]!.id, conversaId: conversa.id, setorId: (await repos.setorPorNome('Fiscal'))!.id, responsavelId: null,
      titulo: 'Guia', resumo: 'x', foraDoContrato: false, origem: 'agente' });
    const id = (await db.from('sugestoes_resposta').insert({ usuario_id: ana, conversa_id: conversa.id }).select('id').single()).data!.id;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'entregar_rascunho', entrada: { texto: 'Bom dia!' } })]);
    await processarSugestao({ repos, ia, canal }, id);
    expect(await usos()).toEqual([expect.objectContaining({ funcionalidade: 'sugerir_resposta', usuario_id: ana, conversa_id: conversa.id, cliente_id: empresas[0]!.id })]);
  });

  it('Testar o agente: testar_agente, com quem pediu, sem conversa e sem empresa (mesmo com empresa escolhida)', async () => {
    const thiago = await criarUsuarioTeste({ email: 'treino@gastos.local', permissoes: ['treinar_agente'] });
    const { empresas } = await contatoComEmpresas(['Empresa T'], '5531999990004');
    const id = (await db.from('simulacoes_agente').insert({ usuario_id: thiago, mensagem: 'oi', cliente_id: empresas[0]!.id, criado_em: new Date().toISOString() })
      .select('id').single()).data!.id;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    await processarSimulacao({ repos, ia, envio: envio(), relogio: () => SEGUNDA_10H }, id, true);
    const l = await usos();
    expect(l.length).toBeGreaterThan(0);
    expect(l.every((u) => u.funcionalidade === 'testar_agente' && u.usuario_id === thiago && u.conversa_id === null && u.cliente_id === null)).toBe(true);
  });
});
```

Antes de rodar, confira nomes e assinaturas com o código de hoje e ajuste **o teste** (não o código) onde divergir: `grep -n "export async function contatoComEmpresas" -A12 test/apoio/cenario.ts` (o retorno tem `empresas`?), `grep -n "export async function criarUsuarioTeste" -A10 test/apoio/usuario.ts` (aceita `telefone`, `setores`?), `grep -n "export async function processarSugestao" src/sugestao/processar.ts`, e o nome exato da ferramenta de entrega (`grep -n "ENTREGAR_RASCUNHO" -A3 src/sugestao/ferramentas.ts`). Os testes das Partes D e E (`test/assistente/whatsapp.test.ts`, `test/sugestao/processar.test.ts`) mostram como montar cada caminho.

Run: `cd apps/trabalhador && pnpm exec vitest run test/gastos/caminhos.test.ts`
Expected: FAIL (o typecheck do vitest pode passar; os `expect` falham em funcionalidade `agente_clientes` para tudo, ou o repositório lança "funcionalidade obrigatória").

- [ ] **Passo 2: a varredura, que falha**

`apps/trabalhador/test/gastos/varredura.test.ts`:

```ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// Prompt F: todo lugar que chama a IA (ou grava uso_ia) está nesta lista e tem teste em caminhos.test.ts / processar-conversa.test.ts.
// Caminho novo = este teste falha até alguém o pôr aqui E escrever o teste da funcionalidade dele.
const SRC = join(__dirname, '../../src');
const ESPERADO = {
  chamaIa: { 'agente/executar.ts': 1, 'agente/simular.ts': 1, 'assistente/executar.ts': 1, 'sugestao/processar.ts': 1 },
  gravaUso: { 'agente/executar.ts': 1, 'agente/simular.ts': 1, 'assistente/executar.ts': 1, 'sugestao/processar.ts': 1, 'sugestao/ferramentas.ts': 1, 'processar-conversa.ts': 1 },
  transcreve: { 'processar-conversa.ts': 1 },
  sdk: { 'agente/cliente-ia.ts': 1 }, // o único lugar que fala com a Anthropic direto
};

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'cenarios' ? [] : arquivos(p); // cenários só rodam à mão, com o mesmo código
    return p.endsWith('.ts') ? [p] : [];
  });
}
function contar(re: RegExp): Record<string, number> {
  const r: Record<string, number> = {};
  for (const p of arquivos(SRC)) {
    const n = (readFileSync(p, 'utf8').match(re) ?? []).length;
    if (n) r[relative(SRC, p).replaceAll('\\', '/')] = n;
  }
  return r;
}

describe('varredura dos caminhos de IA', () => {
  it('chamadas à Anthropic', () => expect(contar(/\bia\.criar\(/g)).toEqual(ESPERADO.chamaIa));
  it('gravações em uso_ia', () => expect(contar(/\.registrarUsoIa\(/g)).toEqual(ESPERADO.gravaUso));
  it('transcrições', () => expect(contar(/transcritor\.transcrever\(/g)).toEqual(ESPERADO.transcreve));
  it('SDK da Anthropic', () => expect(contar(/messages\.(create|stream)\(/g)).toEqual(ESPERADO.sdk));
});
```

Run: `pnpm exec vitest run test/gastos/varredura.test.ts`
Expected: FAIL em "gravações" (`processar-conversa.ts` ainda não grava; a Task 6 o acrescenta) — os outros dois devem passar já. Se "chamadas" ou "gravações" acusarem um arquivo que este plano não conhece, **pare**: é um caminho de IA não mapeado; inclua-o nesta task com o teste dele antes de seguir.

A contagem `\.registrarUsoIa\(` pega só chamadas de método (`repos.registrarUsoIa(…)`), não a chave `registrarUsoIa:` nem o tipo `Repos['registrarUsoIa']` dos *proxies* da simulação e da sugestão. Confira em cada arquivo com `grep -rn "registrarUsoIa(" src` que o número bate depois das mudanças abaixo; ajuste a lista **só** com o motivo no commit.

- [ ] **Passo 3: agente (`agente/executar.ts`)**

```ts
import { calcularCustoUsd, usoDaResposta } from '@escritorio/core';
// …
async function registrarUso(d: DepsAgente, ctx: ContextoAgente, r: Anthropic.Message): Promise<void> {
  const preco = ctx.config.precosModelos[ctx.config.modeloConversa] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const uso = usoDaResposta(r.usage);
  // A simulação troca o repositório e grava como testar_agente (agente/simular.ts).
  await d.repos.registrarUsoIa({
    funcionalidade: 'agente_clientes', usuarioId: null, conversaId: ctx.conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null,
    modelo: ctx.config.modeloConversa, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
    tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco),
  });
}
```

(`ctx.empresaEmFoco` é o nome usado em `registrarCortes` no mesmo arquivo.)

- [ ] **Passo 4: Testar o agente (`agente/simular.ts`)**

Na assinatura e no `Object.assign` de `reposDaSimulacao`:

```ts
export function reposDaSimulacao(repos: Repos, conversa: Conversa, usuario: UsuarioAssistente | null, usuarioId: string): Repos {
  // …
  Object.assign(liberados, {
    // Treino, não gasto do cliente (P7): quem pediu o teste, sem conversa e sem empresa.
    registrarUsoIa: (u: Parameters<Repos['registrarUsoIa']>[0]) =>
      repos.registrarUsoIa({ ...u, funcionalidade: 'testar_agente', usuarioId, conversaId: null, clienteId: null }),
```

e na chamada (linha ~362): `const repos = reposDaSimulacao(d.repos, conversa, await d.repos.obterUsuarioAssistente(sim.usuario_id), sim.usuario_id);`. Em `test/agente/simular.test.ts`, onde o teste chama `reposDaSimulacao(...)` direto (linha ~380), passe o quarto argumento (`usuarioId`) e mude a expectativa da linha ~386 para `[{ conversa_id: null }]` continuar valendo e acrescente `funcionalidade: 'testar_agente'` no `select`/`toEqual`. A chamada `r.registrarUsoIa({ conversaId: 'x', … })` desse teste passa a precisar de `funcionalidade: 'agente_clientes', usuarioId: null, clienteId: 'x'` (o *proxy* sobrescreve e o teste confere que sai `testar_agente`, sem conversa, sem empresa).

- [ ] **Passo 5: assistente (`assistente/executar.ts`)**

```ts
import { calcularCustoUsd, usoDaResposta } from '@escritorio/core';
// …
  // Cache do bloco fixo (ferramentas + sistema), como no agente (spec 7B.2, P19).
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: montarSistemaAssistente(ctx), cache_control: { type: 'ephemeral' } }];
  // …
    const uso = usoDaResposta(r.usage);
    // Uso da equipe (P6): a pessoa e o canal; nunca a conversa nem a empresa, mesmo aberto numa conversa.
    await d.repos.registrarUsoIa({
      funcionalidade: ctx.canal === 'whatsapp' ? 'assistente_whatsapp' : 'assistente_site', usuarioId: ctx.usuario.id,
      conversaId: null, clienteId: null, modelo: ctx.config.modeloConversa, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
      tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco),
    });
```

Atenção: `montarSistemaAssistente` inclui a conversa aberta e a hora? Rode `grep -n "agora\|conversa" src/assistente/prompt.ts | head`. Se o texto do sistema muda a cada pergunta (hora, mensagens da conversa), o cache não acerta e **só custa a escrita** (25% a mais no primeiro uso). Nesse caso, **não** marque o bloco inteiro: separe em dois blocos — o fixo (regras + orientação, com `cache_control`) e o variável (data/hora, conversa, sem `cache_control`) — sem mudar nenhuma palavra do texto. Faça o mesmo julgamento no passo 6. Registre a decisão no commit.

- [ ] **Passo 6: Sugerir resposta (`sugestao/processar.ts` e `ferramentas.ts`)**

Em `processar.ts`:

```ts
    const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: montarSistemaSugestao(ctx), cache_control: { type: 'ephemeral' } }];
    // …
      const uso = usoDaResposta(r.usage);
      await repos.registrarUsoIa({
        funcionalidade: 'sugerir_resposta', usuarioId: s.usuario_id, conversaId: s.conversa_id, clienteId: ctx.conversa.empresa?.id ?? null,
        modelo: config.modeloConversa, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
        tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco),
      });
```

Em `ferramentas.ts`, o *proxy* continua forçando funcionalidade, pessoa e conversa (a trava da Parte E), e passa a manter a empresa que vier:

```ts
  liberados.registrarUsoIa = (u: Parameters<Repos['registrarUsoIa']>[0]) =>
    repos.registrarUsoIa({ ...u, conversaId: s.conversa_id, funcionalidade: FUNCIONALIDADE, usuarioId: s.usuario_id });
```

(Já é assim: confira que nada no *proxy* zera `clienteId`.)

- [ ] **Passo 7: testes antigos que chamam `registrarUsoIa`**

`grep -rn "registrarUsoIa(" apps/trabalhador/test packages/db/test` e acrescente `funcionalidade: 'agente_clientes', usuarioId: null, clienteId: null` (ou a funcionalidade do caminho do teste) em cada chamada. Em `test/processar-conversa.test.ts`, `registrarUsoNoMesDoRelogio` grava com `funcionalidade: 'testar_agente', usuarioId: null, conversaId: null, clienteId: null` (só precisa contar no teto). Os testes que esperam `uso_ia.conversa_id === null` no assistente continuam valendo.

Acrescente em `test/assistente/nucleo.test.ts` (no `describe` do assistente) e em `test/sugestao/processar.test.ts`:

```ts
  it('o bloco de sistema vai com cache_control (spec 7B.2)', async () => {
    // (montagem igual ao teste "uso e decisões do assistente ficam sem conversa"; para a sugestão, igual ao teste do rascunho)
    const sistema = ia.recebidos[0]!.system as { cache_control?: unknown }[];
    expect(sistema.some((b) => JSON.stringify(b.cache_control) === '{"type":"ephemeral"}')).toBe(true);
  });
```

- [ ] **Passo 8: rodar tudo do trabalhador**

Run: `supabase db reset && pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/trabalhador test`
Expected: typecheck sem erro; `test/gastos/caminhos.test.ts` 5/5; `varredura` com **só** "gravações" falhando (falta `processar-conversa.ts`, Task 6). Para o commit desta task ficar verde, deixe `'processar-conversa.ts': 1` fora de `gravaUso` agora e acrescente-o na Task 6 junto com o código.

- [ ] **Passo 9: commit**

```bash
git add apps/trabalhador packages/db/test
git commit -m "feat(trabalhador): agente, assistente, sugestão e Testar o agente gravam funcionalidade, pessoa e empresa; cache no assistente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Trabalhador. Transcrição gravada e o teto soma tudo

**Files:**
- Modify: `apps/trabalhador/src/midia/transcritor.ts`, `src/processar-conversa.ts`, `src/principal.ts`, `src/cenarios/{rodar,atendimento}.ts`
- Modify: `apps/trabalhador/test/midia/transcritor.test.ts`, `test/processar-conversa.test.ts`, `test/gastos/varredura.test.ts`
- Modify: qualquer outro teste com `transcritor: {` (`grep -rn "transcritor: {" apps/trabalhador`)

**Interfaces:**
- Consumes: `custoTranscricaoUsd`, `Configuracoes.custoMinutoTranscricaoUsd`, `NovoUsoIa` (Task 4).
- Produces: `type Transcricao = { texto: string; segundos: number | null }`; `interface Transcritor { readonly modelo: string; readonly provedor: ProvedorIa; transcrever(audio: Uint8Array, mime: string, nomeArquivo: string): Promise<Transcricao> }`; `criarTranscritor(cfg: { baseUrl; apiKey; modelo; vocabulario?; provedor?: ProvedorIa }, buscar?)`.

- [ ] **Passo 1: testes que falham (transcritor)**

Em `test/midia/transcritor.test.ts`, troque as expectativas de texto e acrescente:

```ts
  it('pede verbose_json e devolve o texto e a duração em segundos', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: ' Preciso do DAS. ', duration: 12.48 })));
    const t = criarTranscritor({ baseUrl: 'https://api.exemplo/v1', apiKey: 'K', modelo: 'whisper' }, buscar);
    expect(await t.transcrever(new Uint8Array([1, 2]), 'audio/ogg', 'a.ogg')).toEqual({ texto: 'Preciso do DAS.', segundos: 12.48 });
    expect((buscar.mock.calls[0]![1].body as FormData).get('response_format')).toBe('verbose_json');
    expect(t.modelo).toBe('whisper');
    expect(t.provedor).toBe('groq');
  });
  it('sem duração na resposta: segundos nulos (custo 0, a tela avisa)', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'ok' })));
    const t = criarTranscritor({ baseUrl: 'https://x', apiKey: 'K', modelo: 'm' }, buscar);
    expect(await t.transcrever(new Uint8Array([1]), 'audio/ogg', 'a.ogg')).toEqual({ texto: 'ok', segundos: null });
  });
```

No primeiro teste existente, troque `.toBe('Preciso do DAS.')` por `.toEqual({ texto: 'Preciso do DAS.', segundos: null })`.

- [ ] **Passo 2: implementar o transcritor**

```ts
import type { ProvedorIa } from '@escritorio/core';

export type Transcricao = { texto: string; segundos: number | null };
export interface Transcritor {
  readonly modelo: string;
  readonly provedor: ProvedorIa;
  transcrever(audio: Uint8Array, mime: string, nomeArquivo: string): Promise<Transcricao>;
}
// …
export function criarTranscritor(
  cfg: { baseUrl: string; apiKey: string; modelo: string; vocabulario?: string; provedor?: ProvedorIa },
  buscar: typeof fetch = fetch,
): Transcritor {
  return {
    modelo: cfg.modelo,
    // O fornecedor configurado hoje é a Groq (spec 7B.1); outro compatível entra com provedor próprio na regra do banco.
    provedor: cfg.provedor ?? 'groq',
    async transcrever(audio, mime, nomeArquivo) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(audio)], { type: mime }), nomeArquivo);
      form.append('model', cfg.modelo);
      form.append('language', 'pt');
      form.append('prompt', cfg.vocabulario || VOCABULARIO_PADRAO);
      // verbose_json traz a duração: é por ela que o fornecedor cobra (spec 7B.2).
      form.append('response_format', 'verbose_json');
      const r = await buscar(`${cfg.baseUrl}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form });
      if (!r.ok) throw new Error(`transcrição falhou: ${r.status}`);
      const j = (await r.json()) as { text: string; duration?: unknown };
      const segundos = typeof j.duration === 'number' && Number.isFinite(j.duration) && j.duration >= 0 ? j.duration : null;
      return { texto: j.text.trim(), segundos };
    },
  };
}
```

- [ ] **Passo 3: testes que falham (processar-conversa)**

Em `test/processar-conversa.test.ts`, mude o transcritor falso de `deps`:

```ts
    transcritor: { modelo: 'whisper-large-v3-turbo', provedor: 'groq', transcrever: vi.fn().mockResolvedValue({ texto: 'preciso do holerite', segundos: 30 }) },
```

e acrescente, perto do teste "áudio é transcrito…" (linha ~182):

```ts
  it('transcrição grava uso: transcricao_audio, groq, segundos, conversa, empresa e o custo por minuto de Configurações', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    await db.from('conversas').update({ cliente_em_foco: empresas[0]!.id }).eq('id', conversa.id);
    await db.from('configuracoes').update({ custo_minuto_transcricao_usd: 0.002 }).eq('id', 1);
    await receber(conversa.id, 'M1', '', 'audio');
    await processarConversa(deps(respondeOi()), conversa.id);
    const t = (await db.from('uso_ia').select('funcionalidade, provedor, segundos_audio, custo_usd, conversa_id, cliente_id, usuario_id, modelo')
      .eq('funcionalidade', 'transcricao_audio').single()).data!;
    expect(t).toEqual({ funcionalidade: 'transcricao_audio', provedor: 'groq', segundos_audio: 30, custo_usd: 0.001,
      conversa_id: conversa.id, cliente_id: empresas[0]!.id, usuario_id: null, modelo: 'whisper-large-v3-turbo' });
  });

  it('transcrição que falha não grava uso (o fornecedor não cobra) e o agente recebe o aviso', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'M1', '', 'audio');
    await processarConversa(deps(respondeOi(), {
      transcritor: { modelo: 'w', provedor: 'groq', transcrever: vi.fn().mockRejectedValue(new Error('transcrição falhou: 429')) },
    }), conversa.id);
    expect((await db.from('uso_ia').select('id').eq('funcionalidade', 'transcricao_audio')).data).toEqual([]);
    expect((await db.from('mensagens').select('transcricao').eq('id_provedor', 'M1').single()).data!.transcricao).toBe('[áudio não pôde ser transcrito]');
  });

  it('o teto soma tudo: só transcrição já no teto faz o agente parar (spec 7B.2)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('configuracoes').update({ teto_ia_usd: 1 }).eq('id', 1);
    await repos.registrarUsoIa({ funcionalidade: 'transcricao_audio', usuarioId: null, conversaId: conversa.id, clienteId: null, modelo: 'w', provedor: 'groq',
      tokensEntrada: 0, tokensSaida: 0, tokensCacheLeitura: 0, tokensCacheEscrita: 0, segundosAudio: 60, custoUsd: 1 });
    await db.from('uso_ia').update({ criado_em: SEGUNDA_10H.toISOString() }).eq('funcionalidade', 'transcricao_audio');
    await receber(conversa.id, 'M2', 'oi');
    const ia = respondeOi();
    await processarConversa(deps(ia), conversa.id);
    expect(ia.recebidos).toHaveLength(0);
  });
```

(Confira o nome da função exportada e da assinatura com `grep -n "export async function processarConversa" src/processar-conversa.ts`, e como o teste de teto existente monta o caso — linha ~159 do código; reaproveite o mesmo jeito.)

Run: `pnpm exec vitest run test/processar-conversa.test.ts` → Expected: FAIL.

- [ ] **Passo 4: implementar em `processar-conversa.ts`**

```ts
import { custoTranscricaoUsd } from '@escritorio/core';
import type { Transcricao, Transcritor } from './midia/transcritor';

const AVISO_AUDIO_FALHOU = '[áudio não pôde ser transcrito]';

/** Transcreve e grava o custo (spec 7B.2). Falha do fornecedor não é cobrada: só o aviso. Falha ao gravar o custo não perde o áudio. */
async function transcrever(d: DepsProcessamento, conversa: Conversa, bytes: Uint8Array, mime: string, nome: string): Promise<string> {
  let r: Transcricao;
  try {
    r = await d.transcritor.transcrever(bytes, mime, nome);
  } catch {
    return AVISO_AUDIO_FALHOU;
  }
  try {
    const config = await d.repos.obterConfiguracoes();
    await d.repos.registrarUsoIa({
      funcionalidade: 'transcricao_audio', usuarioId: null, conversaId: conversa.id, clienteId: conversa.cliente_em_foco,
      modelo: d.transcritor.modelo, provedor: d.transcritor.provedor, tokensEntrada: 0, tokensSaida: 0, tokensCacheLeitura: 0, tokensCacheEscrita: 0,
      segundosAudio: r.segundos, custoUsd: custoTranscricaoUsd(r.segundos, config.custoMinutoTranscricaoUsd),
    });
  } catch (e) {
    console.error('[mídia] falha ao gravar o custo da transcrição', conversa.id, e);
  }
  return r.texto;
}
```

e em `prepararMidias`, troque o bloco do áudio:

```ts
      if (m.tipo === 'audio') {
        patch.transcricao = await transcrever(d, conversa, salvo.bytes, salvo.mime.split(';')[0]!, nome);
        m.transcricao = patch.transcricao;
      } else {
```

Em `principal.ts`, nada muda além do tipo (o `criarTranscritor` já recebe o modelo). Em `src/cenarios/rodar.ts` e `src/cenarios/atendimento.ts`, troque o falso por `transcritor: { modelo: 'falso', provedor: 'groq', transcrever: async () => ({ texto: '', segundos: null }) }`. Faça o mesmo em todo teste listado por `grep -rn "transcrever:" apps/trabalhador/test`.

Em `test/gastos/varredura.test.ts`, acrescente `'processar-conversa.ts': 1` em `gravaUso`.

- [ ] **Passo 5: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/trabalhador test`
Expected: tudo verde, inclusive `varredura` 3/3 e os três testes novos.

- [ ] **Passo 6: commit**

```bash
git add apps/trabalhador
git commit -m "feat(trabalhador): transcrição de áudio grava segundos e custo por minuto; teto soma tudo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Painel. Regras puras, cores, menu e trilha

**Files:**
- Create: `apps/painel/src/lib/gastos.ts`, `apps/painel/src/lib/gastos.test.ts`
- Modify: `apps/painel/src/styles/tokens.css`, `apps/painel/src/styles/tokens.test.ts`, `apps/painel/src/app/globals.css`
- Modify: `apps/painel/src/lib/menu.ts`, `apps/painel/src/lib/menu.test.ts`
- Modify: `apps/painel/src/components/layout/sidebar.tsx`, `apps/painel/src/components/layout/trilha.ts`, `trilha.test.ts`

**Interfaces:**
- Consumes: `FuncionalidadeIa` (core), `formatarUSD`/`formatarBRL`/`FUSO` (`lib/formatos.ts`).
- Produces (em `lib/gastos.ts`):
  - `type FiltroPeriodo = 'hoje' | '7d' | 'mes' | 'mes-passado' | 'periodo'`;
  - `type Periodo = { filtro: FiltroPeriodo; de: string; ate: string; deDia: string; ateDia: string; rotulo: string; dias: number; aviso: string | null }` (`de`/`ate` em ISO com `-03:00`, `ate` exclusivo; `deDia`/`ateDia` = `AAAA-MM-DD` inclusive);
  - `lerPeriodo(params: { p?: string; de?: string; ate?: string }, agora: Date): Periodo`;
  - `previsaoFechamento(gastoMes: number, agora: Date): number`;
  - `INFO_FUNCIONALIDADE: Record<FuncionalidadeIa, { rotulo: string; icone: 'robo' | 'brilho' | 'whatsapp' | 'varinha' | 'chapeu' | 'microfone' | 'setor' | 'interrogacao'; cor: string /* classe bg-gasto-* */ }>`;
  - `ORDEM_EMPILHADO: FuncionalidadeIa[]` = `['assistente_site', 'sugerir_resposta', 'testar_agente', 'assistente_whatsapp']`;
  - `type LinhaPessoa = { usuario_id: string; nome: string; funcionalidade: string; custo_usd: number; chamadas: number }`;
  - `montarRanking(linhas: LinhaPessoa[], max = 10): { usuarioId: string; nome: string; custo: number; chamadas: number; pct: number; partes: { funcionalidade: FuncionalidadeIa; custo: number; pct: number }[] }[]`;
  - `textoDiaMaisCaro(d: { dia: string; custo_dia: number; dias_com_gasto: number; funcionalidade: string; pessoa: string | null; chamadas: number } | null): string | null`;
  - `percentual(parte: number, total: number): number` (inteiro, 0 com total 0);
  - `formatarUsdFino(v: number): string` (4 casas abaixo de 1 centavo);
  - `emReais(usd: number, cotacao: number | null): string | null`;
  - `iniciais(nome: string): string`.

- [ ] **Passo 1: testes que falham**

`apps/painel/src/lib/gastos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  INFO_FUNCIONALIDADE, ORDEM_EMPILHADO, emReais, formatarUsdFino, iniciais, lerPeriodo, montarRanking, percentual, previsaoFechamento, textoDiaMaisCaro,
} from './gastos';
import { FUNCIONALIDADES_IA } from '@escritorio/core';

const AGORA = new Date('2026-10-15T15:00:00Z'); // 15/10 12:00 de Brasília

describe('lerPeriodo', () => {
  it('padrão: este mês, de 1º até o fim do mês (Brasília)', () => {
    expect(lerPeriodo({}, AGORA)).toMatchObject({ filtro: 'mes', de: '2026-10-01T00:00:00-03:00', ate: '2026-11-01T00:00:00-03:00', rotulo: 'outubro', aviso: null });
  });
  it('hoje, 7 dias e mês passado', () => {
    expect(lerPeriodo({ p: 'hoje' }, AGORA)).toMatchObject({ de: '2026-10-15T00:00:00-03:00', ate: '2026-10-16T00:00:00-03:00', dias: 1 });
    expect(lerPeriodo({ p: '7d' }, AGORA)).toMatchObject({ de: '2026-10-09T00:00:00-03:00', ate: '2026-10-16T00:00:00-03:00', dias: 7 });
    expect(lerPeriodo({ p: 'mes-passado' }, AGORA)).toMatchObject({ de: '2026-09-01T00:00:00-03:00', ate: '2026-10-01T00:00:00-03:00', rotulo: 'setembro' });
  });
  it('janeiro: mês passado é dezembro do ano anterior', () => {
    expect(lerPeriodo({ p: 'mes-passado' }, new Date('2027-01-10T15:00:00Z'))).toMatchObject({ de: '2026-12-01T00:00:00-03:00', ate: '2027-01-01T00:00:00-03:00' });
  });
  it('período: datas inclusive; "até" vira o dia seguinte exclusivo', () => {
    expect(lerPeriodo({ p: 'periodo', de: '2026-09-20', ate: '2026-09-24' }, AGORA))
      .toMatchObject({ de: '2026-09-20T00:00:00-03:00', ate: '2026-09-25T00:00:00-03:00', dias: 5, rotulo: '20/09 a 24/09' });
  });
  it('período inválido, invertido ou maior que 366 dias: volta para este mês com aviso', () => {
    for (const p of [{ de: 'x', ate: '2026-09-24' }, { de: '2026-09-24', ate: '2026-09-20' }, { de: '2025-01-01', ate: '2026-09-20' }]) {
      expect(lerPeriodo({ p: 'periodo', ...p }, AGORA)).toMatchObject({ filtro: 'mes', aviso: 'Período inválido: mostrando este mês.' });
    }
  });
});

describe('previsaoFechamento', () => {
  it('gasto ÷ dias corridos (contando hoje) × dias do mês', () => {
    expect(previsaoFechamento(15, AGORA)).toBeCloseTo(31, 6); // 15 em 15 dias de outubro (31 dias)
  });
  it('dia 1º conta como um dia', () => expect(previsaoFechamento(2, new Date('2026-10-01T15:00:00Z'))).toBeCloseTo(62, 6));
});

describe('cores e nomes', () => {
  it('toda funcionalidade tem nome, ícone e cor; o empilhado tem ordem fixa', () => {
    for (const f of FUNCIONALIDADES_IA) expect(INFO_FUNCIONALIDADE[f].rotulo.length).toBeGreaterThan(0);
    expect(ORDEM_EMPILHADO).toEqual(['assistente_site', 'sugerir_resposta', 'testar_agente', 'assistente_whatsapp']);
    expect(INFO_FUNCIONALIDADE.agente_clientes.rotulo).toBe('Agente de clientes');
    expect(INFO_FUNCIONALIDADE.nao_identificado.rotulo).toBe('Não identificado');
  });
});

describe('montarRanking', () => {
  const l = (usuario_id: string, nome: string, funcionalidade: string, custo_usd: number, chamadas = 1) => ({ usuario_id, nome, funcionalidade, custo_usd, chamadas });
  it('soma por pessoa, % do total das pessoas, partes na ordem fixa (não por tamanho)', () => {
    const r = montarRanking([l('a', 'Ana', 'sugerir_resposta', 1, 3), l('t', 'Thiago', 'testar_agente', 3, 2), l('a', 'Ana', 'assistente_site', 1, 1)]);
    expect(r.map((x) => [x.nome, x.custo, x.chamadas, x.pct])).toEqual([['Thiago', 3, 2, 60], ['Ana', 2, 4, 40]]);
    expect(r[1]!.partes.map((p) => p.funcionalidade)).toEqual(['assistente_site', 'sugerir_resposta']);
    expect(r[1]!.partes.map((p) => p.pct)).toEqual([50, 50]);
  });
  it('no máximo 10; vazio fica vazio', () => {
    expect(montarRanking(Array.from({ length: 12 }, (_, i) => l(`u${i}`, `P${i}`, 'assistente_site', i + 1)))).toHaveLength(10);
    expect(montarRanking([])).toEqual([]);
  });
});

describe('textoDiaMaisCaro', () => {
  it('com pessoa', () => {
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 3.9, dias_com_gasto: 10, funcionalidade: 'testar_agente', pessoa: 'Thiago', chamadas: 31 }))
      .toBe('26/09 foi o dia mais caro (US$ 3,90): Testar o agente usado 31 vezes por Thiago.');
  });
  it('sem pessoa (agente)', () => {
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 3.9, dias_com_gasto: 2, funcionalidade: 'agente_clientes', pessoa: null, chamadas: 120 }))
      .toBe('26/09 foi o dia mais caro (US$ 3,90): Agente de clientes, 120 chamadas.');
  });
  it('um dia só ou nada: sem alerta', () => {
    expect(textoDiaMaisCaro({ dia: '2026-09-26', custo_dia: 1, dias_com_gasto: 1, funcionalidade: 'agente_clientes', pessoa: null, chamadas: 1 })).toBeNull();
    expect(textoDiaMaisCaro(null)).toBeNull();
  });
});

describe('formatos', () => {
  it('percentual inteiro, sem dividir por zero', () => {
    expect(percentual(1, 3)).toBe(33);
    expect(percentual(1, 0)).toBe(0);
  });
  const espaco = (s: string | null) => s?.replace(/ /g, ' ') ?? null; // formatos.ts usa espaço que não quebra
  it('US$ fino abaixo de 1 centavo', () => {
    expect(espaco(formatarUsdFino(0.0042))).toBe('US$ 0,0042');
    expect(espaco(formatarUsdFino(0.42))).toBe('US$ 0,42');
  });
  it('R$ só com cotação', () => {
    expect(espaco(emReais(41.2, 5.55))).toBe('R$ 228,66');
    expect(emReais(41.2, null)).toBeNull();
  });
  it('iniciais', () => {
    expect(iniciais('Thiago Brigolini')).toBe('TB');
    expect(iniciais('Ana')).toBe('AN');
  });
});
```

Run: `pnpm --filter @escritorio/painel test -- src/lib/gastos.test.ts` → Expected: FAIL (módulo não existe).

- [ ] **Passo 2: implementar `lib/gastos.ts`**

```ts
// Regras puras da tela Gastos com IA (spec 7B.3): período, previsão, nomes e cores, ranking, alerta do dia mais caro.
import type { FuncionalidadeIa } from '@escritorio/core';
import { FUSO, NBSP, formatarBRL, formatarUSD } from './formatos';

export type FiltroPeriodo = 'hoje' | '7d' | 'mes' | 'mes-passado' | 'periodo';
export type Periodo = { filtro: FiltroPeriodo; de: string; ate: string; deDia: string; ateDia: string; rotulo: string; dias: number; aviso: string | null };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

/** Dia de hoje em Brasília, como AAAA-MM-DD. */
function hojeSP(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
/** Soma dias a um AAAA-MM-DD (conta em UTC ao meio-dia: sem horário de verão no caminho). */
function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const inicio = (dia: string) => `${dia}T00:00:00-03:00`;
const diasEntre = (de: string, ateExclusivo: string) => Math.round((Date.parse(`${ateExclusivo}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
function valido(dia: string | undefined): dia is string {
  return !!dia && DIA.test(dia) && !Number.isNaN(Date.parse(`${dia}T12:00:00Z`)) && new Date(`${dia}T12:00:00Z`).toISOString().slice(0, 10) === dia;
}

function montar(filtro: FiltroPeriodo, de: string, ateExclusivo: string, rotulo: string, aviso: string | null = null): Periodo {
  return { filtro, de: inicio(de), ate: inicio(ateExclusivo), deDia: de, ateDia: somarDias(ateExclusivo, -1), rotulo, dias: diasEntre(de, ateExclusivo), aviso };
}
function mes(ano: number, m: number, filtro: FiltroPeriodo, aviso: string | null = null): Periodo {
  const de = `${ano}-${String(m).padStart(2, '0')}-01`;
  const prox = m === 12 ? `${ano + 1}-01-01` : `${ano}-${String(m + 1).padStart(2, '0')}-01`;
  return montar(filtro, de, prox, MESES[m - 1]!, aviso);
}

/** Período da URL (?p=hoje|7d|mes|mes-passado|periodo&de=&ate=). Padrão: este mês. "de" e "até" inclusive (P18). */
export function lerPeriodo(params: { p?: string; de?: string; ate?: string }, agora: Date): Periodo {
  const hoje = hojeSP(agora);
  const [ano, m] = hoje.split('-').map(Number) as [number, number];
  switch (params.p) {
    case 'hoje': return montar('hoje', hoje, somarDias(hoje, 1), 'hoje');
    case '7d': return montar('7d', somarDias(hoje, -6), somarDias(hoje, 1), 'últimos 7 dias');
    case 'mes-passado': return m === 1 ? mes(ano - 1, 12, 'mes-passado') : mes(ano, m - 1, 'mes-passado');
    case 'periodo': {
      const { de, ate } = params;
      if (valido(de) && valido(ate) && de <= ate && diasEntre(de, somarDias(ate, 1)) <= MAX_DIAS) {
        return montar('periodo', de, somarDias(ate, 1), `${ddmm(de)} a ${ddmm(ate)}`);
      }
      return mes(ano, m, 'mes', 'Período inválido: mostrando este mês.');
    }
    default: return mes(ano, m, 'mes');
  }
}

/** Previsão de fechamento do mês (spec 7B.3): gasto ÷ dias corridos (contando hoje) × dias do mês, em Brasília. */
export function previsaoFechamento(gastoMes: number, agora: Date): number {
  const hoje = hojeSP(agora);
  const [ano, m, d] = hoje.split('-').map(Number) as [number, number, number];
  const diasNoMes = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return (gastoMes / d) * diasNoMes;
}

type Icone = 'robo' | 'brilho' | 'whatsapp' | 'varinha' | 'chapeu' | 'microfone' | 'setor' | 'interrogacao';
/** Nome, ícone e cor (token --gasto-*) de cada funcionalidade. A cor segue a funcionalidade, nunca a posição. */
export const INFO_FUNCIONALIDADE: Record<FuncionalidadeIa, { rotulo: string; icone: Icone; cor: string }> = {
  agente_clientes: { rotulo: 'Agente de clientes', icone: 'robo', cor: 'bg-gasto-agente' },
  assistente_site: { rotulo: 'Assistente (site)', icone: 'brilho', cor: 'bg-gasto-assistente-site' },
  assistente_whatsapp: { rotulo: 'Assistente (WhatsApp)', icone: 'whatsapp', cor: 'bg-gasto-assistente-whatsapp' },
  sugerir_resposta: { rotulo: 'Sugerir resposta', icone: 'varinha', cor: 'bg-gasto-sugerir' },
  testar_agente: { rotulo: 'Testar o agente', icone: 'chapeu', cor: 'bg-gasto-testar' },
  transcricao_audio: { rotulo: 'Transcrição de áudio', icone: 'microfone', cor: 'bg-gasto-transcricao' },
  especialista_setor: { rotulo: 'Especialista por setor', icone: 'setor', cor: 'bg-gasto-especialista' },
  nao_identificado: { rotulo: 'Não identificado', icone: 'interrogacao', cor: 'bg-gasto-nao-identificado' },
};
/** Ordem fixa da barra empilhada do ranking (validada pela skill dataviz: vizinhos distinguíveis, inclusive com daltonismo). */
export const ORDEM_EMPILHADO: FuncionalidadeIa[] = ['assistente_site', 'sugerir_resposta', 'testar_agente', 'assistente_whatsapp'];

export const percentual = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 100) : 0);

export type LinhaPessoa = { usuario_id: string; nome: string; funcionalidade: string; custo_usd: number; chamadas: number };
export function montarRanking(linhas: LinhaPessoa[], max = 10) {
  const pessoas = new Map<string, { usuarioId: string; nome: string; custo: number; chamadas: number; por: Map<string, number> }>();
  for (const l of linhas) {
    const p = pessoas.get(l.usuario_id) ?? { usuarioId: l.usuario_id, nome: l.nome, custo: 0, chamadas: 0, por: new Map() };
    p.custo += Number(l.custo_usd);
    p.chamadas += Number(l.chamadas);
    p.por.set(l.funcionalidade, (p.por.get(l.funcionalidade) ?? 0) + Number(l.custo_usd));
    pessoas.set(l.usuario_id, p);
  }
  const total = [...pessoas.values()].reduce((s, p) => s + p.custo, 0);
  const ordem = (f: string) => { const i = ORDEM_EMPILHADO.indexOf(f as FuncionalidadeIa); return i < 0 ? 99 : i; };
  return [...pessoas.values()].sort((a, b) => b.custo - a.custo || a.nome.localeCompare(b.nome)).slice(0, max).map((p) => ({
    usuarioId: p.usuarioId, nome: p.nome, custo: p.custo, chamadas: p.chamadas, pct: percentual(p.custo, total),
    partes: [...p.por.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]))
      .map(([f, c]) => ({ funcionalidade: f as FuncionalidadeIa, custo: c, pct: percentual(c, p.custo) })),
  }));
}

/** Alerta do dia mais caro (spec 7B.3, P17): só com 2 dias ou mais com gasto. */
export function textoDiaMaisCaro(d: { dia: string; custo_dia: number; dias_com_gasto: number; funcionalidade: string; pessoa: string | null; chamadas: number } | null): string | null {
  if (!d || Number(d.dias_com_gasto) < 2) return null;
  const rotulo = INFO_FUNCIONALIDADE[d.funcionalidade as FuncionalidadeIa]?.rotulo ?? d.funcionalidade;
  const inicioTexto = `${ddmm(d.dia)} foi o dia mais caro (${formatarUSD(Number(d.custo_dia)).replace(NBSP, ' ')})`;
  return d.pessoa
    ? `${inicioTexto}: ${rotulo} usado ${d.chamadas} vezes por ${d.pessoa}.`
    : `${inicioTexto}: ${rotulo}, ${d.chamadas} chamadas.`;
}

/** Custo de uma chamada: 4 casas abaixo de 1 centavo (senão tudo vira "US$ 0,00"). */
export function formatarUsdFino(v: number): string {
  if (v === 0 || Math.abs(v) >= 0.01) return formatarUSD(v);
  return `US$${NBSP}${v.toFixed(4).replace('.', ',')}`;
}
export const emReais = (usd: number, cotacao: number | null) => (cotacao && cotacao > 0 ? formatarBRL(usd * cotacao) : null);

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return `${partes[0]![0]}${partes.at(-1)![0]}`.toUpperCase();
  return (partes[0] ?? '?').slice(0, 2).toUpperCase();
}
```

Run: `pnpm --filter @escritorio/painel test -- src/lib/gastos.test.ts` → PASS.

- [ ] **Passo 3: tokens de cor dos gráficos**

Em `apps/painel/src/styles/tokens.css`, no bloco `:root` (claro), depois de `--modulo-configuracoes`:

```css
  --modulo-gastos: hsl(45 70% 58%); /* ícone de Gastos com IA no menu (moeda) */
  /* Gastos com IA: uma cor por funcionalidade (paleta validada pela skill dataviz em #ffffff; a cor segue a funcionalidade) */
  --gasto-agente: #2a8a60; /* Agente de clientes */
  --gasto-assistente-site: #c08d28; /* Assistente (site); contraste 2,97:1, por isso legenda e tabela sempre presentes */
  --gasto-sugerir: #a3324d; /* Sugerir resposta (vinho) */
  --gasto-testar: #d06a2c; /* Testar o agente */
  --gasto-assistente-whatsapp: #8565b8; /* Assistente (WhatsApp) */
  --gasto-transcricao: #4a78bd; /* Transcrição de áudio */
  --gasto-especialista: #1f7f8c; /* Especialista por setor (Parte I; validar quando aparecer junto das outras) */
  --gasto-nao-identificado: hsl(345 4% 60%); /* registros antigos sem funcionalidade: cinza de propósito ("outros") */
  --gasto-dia: hsl(348 30% 82%); /* barras dos dias no gráfico "Por dia" */
  --gasto-hoje: hsl(348 55% 31%); /* barra de hoje no "Por dia" (vinho) */
```

Nos **dois** blocos escuros (`:root[data-theme="dark"]` e o de `@media (prefers-color-scheme: dark)` com `:root:not([data-theme="light"])`), com os mesmos nomes (validados em `#1d1a1b`):

```css
  --modulo-gastos: hsl(45 70% 58%);
  --gasto-agente: #2f9a68;
  --gasto-assistente-site: #b5892a;
  --gasto-sugerir: #c2508f;
  --gasto-testar: #c86e33;
  --gasto-assistente-whatsapp: #9c7fd0;
  --gasto-transcricao: #5f8fd6;
  --gasto-especialista: #2fa3b3;
  --gasto-nao-identificado: hsl(345 3% 50%);
  --gasto-dia: hsl(348 20% 32%);
  --gasto-hoje: hsl(348 70% 72%);
```

O `tokens.test.ts` exige comentário em cada token do bloco claro (confira a regra com `grep -n "comentário" src/styles/tokens.test.ts`) e blocos escuros idênticos entre si. Se o teste proibir `#hex` em `tokens.css`, converta os valores acima para `hsl()` com a mesma cor (o validador da dataviz aceita só hex: os hex acima são os validados; a conversão não muda a cor). Acrescente `'--gasto-agente', '--gasto-sugerir', '--gasto-hoje', '--modulo-gastos'` em `OBRIGATORIOS`.

Para conferir de novo a paleta (opcional, se mudar algum valor): carregue a skill **dataviz** e rode, a partir da pasta dela, `node scripts/validate_palette.js "#c08d28,#a3324d,#d06a2c,#8565b8" --mode light --surface "#ffffff"` e `node scripts/validate_palette.js "#b5892a,#c2508f,#c86e33,#9c7fd0" --mode dark --surface "#1d1a1b"`. Resultado esperado (já conferido em 03/10): claro — tudo PASS, contraste WARN só no dourado (compensado por legenda + tabela); escuro — tudo PASS.

Em `apps/painel/src/app/globals.css`, junto de `--color-modulo-inicio`, acrescente as utilidades: `--color-modulo-gastos: var(--modulo-gastos);` e uma linha `--color-gasto-<nome>: var(--gasto-<nome>);` para cada token acima (gera `bg-gasto-agente` etc.).

- [ ] **Passo 4: menu, ícone e trilha**

`lib/menu.test.ts` — acrescente:

```ts
  it('Gastos com IA: só o administrador, antes de Configurações (spec 7)', () => {
    expect(rotulos('admin', n())).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente', 'Gastos com IA', 'Configurações']);
    expect(rotulos('atendente', n({ configuracoes: 'sim', treinar: 'sim', assistente: 'site_whatsapp' }))).not.toContain('Gastos com IA');
  });
```

e atualize a expectativa da linha 29 (admin) com `'Gastos com IA'` antes de `'Configurações'`. Em `lib/menu.ts`: `if (admin) itens.push({ rotulo: 'Gastos com IA', href: '/gastos-ia' });` logo antes da linha do `Configurações` do administrador.

`components/layout/sidebar.tsx`: importe `CircleDollarSign` de `lucide-react`; `ICONES['/gastos-ia'] = CircleDollarSign`; `COR_MODULO['/gastos-ia'] = 'text-modulo-gastos'`.

`components/layout/trilha.ts`: `{ prefixo: '/gastos-ia', trilha: [{ rotulo: 'Administração' }, { rotulo: 'Gastos com IA' }] },` e em `trilha.test.ts`: `expect(trilhaDaRota('/gastos-ia')).toEqual([{ rotulo: 'Administração' }, { rotulo: 'Gastos com IA' }]);`.

Antes, rode `grep -rn "'Treinar o agente', 'Configurações'\|Configurações'\]" apps/painel/e2e apps/painel/src` e `grep -rn "atalho\|ATALHOS" apps/painel/src/components/layout/atalhos-menu.tsx | head`: se algum e2e ou o mapa de atalhos lista os itens do menu do administrador, inclua "Gastos com IA" (sem atalho de tecla novo).

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck` → PASS (inclusive `tokens.test.ts` e `escala.test.ts`).

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src
git commit -m "feat(painel): regras de gastos com IA, cores validadas dos gráficos e item do administrador no menu

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Painel. Tela `/gastos-ia`: filtros, cartões, por funcionalidade e por dia

**Files:**
- Create: `apps/painel/src/app/(painel)/gastos-ia/page.tsx`, `loading.tsx`, `filtros-periodo.tsx`, `cartoes.tsx`, `por-funcionalidade.tsx`, `por-dia.tsx`, `icone-funcionalidade.tsx`
- Create: `apps/painel/e2e/apoio-gastos.ts`, `apps/painel/e2e/gastos-ia.spec.ts`
- Modify: `apps/painel/e2e/aquecer.ts` (`'/gastos-ia'` em `ROTAS`)

**Interfaces:**
- Consumes: `lerPeriodo`, `previsaoFechamento`, `INFO_FUNCIONALIDADE`, `textoDiaMaisCaro`, `percentual`, `emReais` (Task 7); RPCs `gastos_resumo`, `gastos_por_funcionalidade`, `gastos_por_dia`, `gastos_dia_mais_caro` (Task 3); `exigirAdmin` (`lib/sessao.ts`); `supabaseServidor`; `PageHeader`, `Card`, `EmptyState`.
- Produces: rota `/gastos-ia?p=…&de=…&ate=…`; `data-testid`: `gastos-total`, `gastos-chamadas`, `gastos-por-atendimento`, `gastos-audios`, `gastos-funcionalidade-<funcionalidade>`, `gastos-dia-<AAAA-MM-DD>`, `gastos-alerta-dia`, `gastos-aviso-nao-identificado`; em `e2e/apoio-gastos.ts`: `semearGastos(): Promise<{ admin: { email, senha }, ana: { email, senha, id }, rede: string, conversa: string }>` e `limparGastos()`.

- [ ] **Passo 1: dados de teste do e2e**

`apps/painel/e2e/apoio-gastos.ts` começa apagando **todo** `uso_ia` do banco local (outros specs podem ter gravado no mesmo mês; o `trava-local.ts` garante que é o banco local) e grava pela chave de serviço **local** (`db` de `./apoio`), com datas relativas a hoje (Brasília) para cair em "Este mês" e em "Hoje": um administrador "Thiago Gastos", uma atendente "Ana Gastos" (assistente pelo site), a empresa "Rede Bom Preço Gastos", a contato "Carla Mendes" e a conversa dela; mensagens de cliente hoje e ontem e uma resposta de atendente hoje; registros `uso_ia`: agente hoje (0,40) e ontem (0,20, se ontem ainda for este mês; senão no dia 1º), transcrição hoje (0,01, 90 s, groq), sugestão da Ana hoje (0,30), assistente site da Ana hoje (0,50), Testar o agente do Thiago hoje (0,90). Siga o padrão de `e2e/apoio-demandas.ts` (`grep -n "export async function" apps/painel/e2e/apoio-demandas.ts`) e apague tudo em `limparGastos` (inclusive `uso_ia` pelo `modelo = 'e2e-gastos'`).

- [ ] **Passo 2: e2e que falha**

`apps/painel/e2e/gastos-ia.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { entrar } from './apoio';
import { limparGastos, semearGastos } from './apoio-gastos';

let dados: Awaited<ReturnType<typeof semearGastos>>;
test.beforeAll(async () => { dados = await semearGastos(); });
test.afterAll(async () => { await limparGastos(); });

test('administrador vê o mês: cartões, por funcionalidade e por dia', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.getByRole('link', { name: 'Gastos com IA' }).click();
  await expect(page).toHaveURL(/\/gastos-ia$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gastos com IA');
  await expect(page.getByRole('link', { name: 'Este mês' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('gastos-chamadas')).toContainText('6');
  await expect(page.getByTestId('gastos-audios')).toContainText('2');           // 90 s ≈ 2 min
  await expect(page.getByTestId('gastos-funcionalidade-testar_agente')).toContainText('Testar o agente');
  await expect(page.getByTestId('gastos-funcionalidade-especialista_setor')).toHaveCount(0); // só quando existir
  await expect(page.getByRole('table', { name: 'Gasto por dia' })).toBeAttached();          // alternativa em texto
});

test('Hoje e período inválido', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia?p=hoje');
  await expect(page.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('gastos-total')).not.toContainText('Previsão'); // previsão só em "Este mês" (P4)
  await page.goto('/gastos-ia?p=periodo&de=2026-09-24&ate=2026-09-20');
  await expect(page.getByText('Período inválido: mostrando este mês.')).toBeVisible();
});

test('período sem gasto: zeros e estado vazio, sem "NaN"', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia?p=periodo&de=2020-01-01&ate=2020-01-31');
  await expect(page.getByTestId('gastos-por-atendimento')).toContainText('—');
  await expect(page.getByText('Nenhum gasto com IA neste período.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('atendente não vê o item nem a tela', async ({ page }) => {
  await entrar(page, dados.ana.email, dados.ana.senha);
  await expect(page.getByRole('link', { name: 'Gastos com IA' })).toHaveCount(0);
  await page.goto('/gastos-ia');
  await expect(page).toHaveURL(/\/inicio/);
});
```

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/gastos-ia.spec.ts` → Expected: FAIL (404).

- [ ] **Passo 3: a página**

`app/(painel)/gastos-ia/page.tsx` (server component):

```tsx
import { CircleDollarSign } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerPeriodo } from '@/lib/gastos';
import { formatarBRL } from '@/lib/formatos';
import { FiltrosPeriodo } from './filtros-periodo';
import { Cartoes } from './cartoes';
import { PorFuncionalidade } from './por-funcionalidade';
import { PorDia } from './por-dia';

/** Gastos com IA (spec 7B.3): só o administrador (spec 7; o banco recusa os outros). */
export default async function GastosIa({ searchParams }: { searchParams: Promise<{ p?: string; de?: string; ate?: string }> }) {
  await exigirAdmin();
  const agora = new Date();
  const periodo = lerPeriodo(await searchParams, agora);
  const mes = lerPeriodo({}, agora);
  const sb = await supabaseServidor();
  const intervalo = { p_de: periodo.de, p_ate: periodo.ate };
  const [resumo, resumoMes, porFuncionalidade, porDia, diaMaisCaro, { data: cfg }] = await Promise.all([
    sb.rpc('gastos_resumo', intervalo),
    periodo.filtro === 'mes' ? Promise.resolve(null) : sb.rpc('gastos_resumo', { p_de: mes.de, p_ate: mes.ate }),
    sb.rpc('gastos_por_funcionalidade', intervalo),
    sb.rpc('gastos_por_dia', intervalo),
    sb.rpc('gastos_dia_mais_caro', intervalo),
    sb.from('configuracoes').select('teto_ia_usd, cotacao_usd_brl, custo_minuto_transcricao_usd').eq('id', 1).single(),
  ]);
  for (const r of [resumo, porFuncionalidade, porDia, diaMaisCaro]) if (r.error) throw new Error(r.error.message);
  const cotacao = cfg?.cotacao_usd_brl ? Number(cfg.cotacao_usd_brl) : null;

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        titulo={<span className="font-extrabold">Gastos com IA · <span className="text-brand">{periodo.rotulo}</span></span>}
        descricao={
          <span className="inline-flex items-center gap-1 text-sm text-subtle">
            <CircleDollarSign aria-hidden size={14} /> Só administrador ·{' '}
            {cotacao
              ? <>cotação usada: {formatarBRL(cotacao)} (<a className="text-brand underline-offset-4 hover:underline" href="/configuracoes#teto-ia">Configurações</a>)</>
              : <>sem cotação: valores em US$ (<a className="text-brand underline-offset-4 hover:underline" href="/configuracoes#teto-ia">preencher</a>)</>}
          </span>
        }
        acoes={<FiltrosPeriodo periodo={periodo} />}
      />
      {periodo.aviso && <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm">{periodo.aviso}</p>}
      <Cartoes
        periodo={periodo} resumo={resumo.data!} resumoMes={resumoMes?.data ?? resumo.data!} teto={Number(cfg?.teto_ia_usd ?? 0)}
        cotacao={cotacao} custoMinutoConfigurado={cfg?.custo_minuto_transcricao_usd != null} agora={agora}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <PorFuncionalidade linhas={porFuncionalidade.data ?? []} />
        <PorDia dias={porDia.data ?? []} hoje={lerPeriodo({ p: 'hoje' }, agora).deDia} diaMaisCaro={diaMaisCaro.data?.[0] ?? null} />
      </div>
      {/* Task 9: RankingEquipe, GastosPorCliente e o DetalhePessoa entram aqui. */}
    </section>
  );
}
```

Confira os nomes das props de `PageHeader` (`titulo`, `descricao`, `acoes`) em `components/layout/page-header.tsx` antes; se `acoes` não existir, ponha os filtros logo abaixo do cabeçalho.

O `titulo` usa `font-extrabold`; o `PageHeader` já tem o nível `h1` (confira em `components/layout/page-header.tsx`). Erro de RPC lança: o `error.tsx` do grupo `(painel)` mostra a falha (sem tela quebrada pela metade).

`loading.tsx`: esqueleto com quatro cartões e duas caixas (`Skeleton` de `components/ui/skeleton`).

- [ ] **Passo 4: filtros**

`filtros-periodo.tsx` (server, sem estado): cinco links `?p=hoje`, `?p=7d`, `?p=mes` (rótulo "Este mês"), `?p=mes-passado`, e **Período** abre um `<details>` com um `<form method="get">` (`<input type="hidden" name="p" value="periodo">`, dois `<input type="date" name="de|ate">` com `<Label>`, botão **Ver**); o link do filtro atual tem `aria-current="page"` e o visual escuro (`bg-graphite text-graphite-foreground`); **Exportar** (Task 10) fica ao lado como link. Em telas estreitas, a fileira quebra linha (`flex-wrap`), sem rolagem horizontal.

- [ ] **Passo 5: cartões**

`cartoes.tsx` recebe `{ periodo, resumo, resumoMes, teto, cotacao, custoMinutoConfigurado, agora }` e desenha quatro `Card` com faixa colorida no topo (`border-t-4` com `border-brand`, `border-info`, `border-success`, `border-warning-decor`), título em `uppercase text-sm font-bold text-brand`, número `text-3xl font-extrabold tabular`:
1. `data-testid="gastos-total"` — "Total do mês × teto" em "Este mês" (senão "Total do período"): valor US$, "≈ R$ X" e "· N%" quando houver cotação; em "Este mês", barra `role="progressbar"` (como `GastoIa` do Início) com a **marca de 80%** (um traço `bg-warning-decor` posicionado com `style={{ left: '80%' }}`, `aria-hidden`) e "Previsão até o fim do mês: US$ Y" (`previsaoFechamento`); fora dele, "Este mês: US$ X de US$ teto (Y%)". Embaixo, "Economia com cache: US$ Z" (ou "sem economia de cache ainda").
2. `gastos-chamadas` — chamadas à IA e "N por dia em média" (chamadas ÷ `periodo.dias`, ou ÷ dias corridos em "Este mês").
3. `gastos-por-atendimento` — custo dos atendimentos ÷ atendimentos (sem atendimento: "—"), "média de N atendimentos".
4. `gastos-audios` — minutos (`Math.round(segundos / 60)`, "min") e o custo; sem custo por minuto configurado: "custo por minuto não configurado" com link para Configurações.

Sempre que `resumo.nao_identificado > 0`, um aviso `data-testid="gastos-aviso-nao-identificado"` (ícone `AlertTriangle` + texto): "N chamadas sem funcionalidade neste período. Registros antigos, ou o trabalhador está desatualizado." (P3).

- [ ] **Passo 6: por funcionalidade**

`por-funcionalidade.tsx`: `Card` com título "Por funcionalidade" e, à direita, "custo · % · chamadas" (`text-subtle`). Uma `<table>` com `<caption className="sr-only">Gasto por funcionalidade</caption>` e linhas na ordem que o banco devolve (mais caro primeiro), cada uma `data-testid={\`gastos-funcionalidade-${f}\`}`: ícone (`icone-funcionalidade.tsx`, mapa `robo→Bot`, `brilho→Sparkles`, `whatsapp→MessageCircle`, `varinha→WandSparkles`, `chapeu→GraduationCap`, `microfone→Mic`, `setor→Building2`, `interrogacao→HelpCircle`, todos `aria-hidden` e com a cor `text-*` do token), nome (`font-semibold`), barra decorativa (`aria-hidden`, largura = % do maior, `INFO_FUNCIONALIDADE[f].cor`, 4 px de cantos), custo (`font-extrabold` na primeira linha), % e chamadas (`tabular`). "Especialista por setor" só aparece se vier do banco. Sem linhas: `EmptyState` "Nenhum gasto com IA neste período.".

- [ ] **Passo 7: por dia**

`por-dia.tsx` (server): `Card` "Por dia" com "hoje em vinho" à direita. Série única, sem legenda:
- barras em `flex items-end gap-0.5 h-40` (o 2 px de espaço da dataviz), uma por dia, altura `style={{ height: \`${pct}%\` }}` relativa ao maior dia (dia sem gasto: altura 0 com um traço de 1 px `bg-border`), cor `bg-gasto-dia` e **hoje** `bg-gasto-hoje`; cada barra `data-testid={\`gastos-dia-${dia}\`}`, `title="26/09: US$ 3,90 · 31 chamadas"` (passar o mouse) e, como o gráfico inteiro é `aria-hidden`, a leitura vai pela tabela abaixo;
- eixo: primeira data, a do meio e "hoje" (ou a última), `text-xs text-subtle`;
- `<details>` "Ver em tabela" com `<table aria-label="Gasto por dia">` (dia, custo, chamadas) — o e2e e o leitor de tela usam esta tabela. Mantenha a tabela no DOM mesmo recolhida (o `<details>` faz isso);
- embaixo, o alerta do dia mais caro (`textoDiaMaisCaro`), `data-testid="gastos-alerta-dia"`, em `bg-warning-soft text-foreground` com ícone `AlertTriangle` `text-warning` (nunca só cor), `role="note"`.

Com mais de 62 dias no período, as barras ficam finas: use `gap-px` e esconda o `title` das que tiverem menos de 4 px? **Não** — mantenha simples: até 366 barras de largura flexível; o detalhe fica na tabela.

- [ ] **Passo 8: aquecer e rodar**

Acrescente `'/gastos-ia'` em `ROTAS` de `e2e/aquecer.ts`.

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/gastos-ia.spec.ts && pnpm --filter @escritorio/painel typecheck`
Expected: 4/4; typecheck sem erro.

- [ ] **Passo 9: commit**

```bash
git add apps/painel
git commit -m "feat(painel): tela Gastos com IA com período, cartões, por funcionalidade e por dia acessível

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Painel. Equipe, pessoa, clientes e atendimentos

**Files:**
- Create: `apps/painel/src/app/(painel)/gastos-ia/ranking-equipe.tsx`, `detalhe-pessoa.tsx`, `gastos-por-cliente.tsx`
- Modify: `apps/painel/src/app/(painel)/gastos-ia/page.tsx`
- Modify: `apps/painel/src/components/patterns/historico-rolante.tsx`, `apps/painel/src/app/(painel)/atendimento/[id]/{page,conversa-aberta,itens-historico}.tsx` (o separador de dia ganha âncora; `?data=`)
- Modify: `apps/painel/e2e/gastos-ia.spec.ts`

**Interfaces:**
- Consumes: `montarRanking`, `ORDEM_EMPILHADO`, `INFO_FUNCIONALIDADE`, `iniciais`, `formatarUsdFino`, `percentual` (Task 7); RPCs `gastos_por_pessoa`, `gastos_chamadas`, `gastos_por_cliente`, `gastos_atendimentos_do_cliente` (Task 3); `PainelLateralUrl` (`components/patterns/painel-lateral-url.tsx`); `linhaDoTempo` (`lib/historico.ts`).
- Produces: parâmetros de URL `?pessoa=<uuid>` (painel lateral da pessoa) e `?empresa=<uuid|sem>` (empresa aberta) e `?busca=` (busca de empresa), que preservam `p/de/ate`; `HistoricoRolante` aceita `inicial?: string` (id do elemento a rolar ao abrir); separador de dia com `id="dia-AAAA-MM-DD"`; `/atendimento/[id]?data=AAAA-MM-DD`.

- [ ] **Passo 1: e2e que falha**

Acrescente em `e2e/gastos-ia.spec.ts`:

```ts
test('ranking da equipe: só pessoas; clicar abre o detalhe linha a linha', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia');
  const ranking = page.getByRole('region', { name: 'Quem mais gasta na equipe' });
  await expect(ranking.getByRole('row')).toHaveCount(3);                 // cabeçalho + Thiago + Ana
  await expect(ranking.getByRole('row').nth(1)).toContainText('Thiago Gastos');
  await expect(ranking.getByText('Agente de clientes')).toHaveCount(0);   // agente fica fora do ranking
  await expect(ranking.getByText('Sugerir resposta')).toBeVisible();      // legenda sempre visível
  await ranking.getByRole('link', { name: /Ana Gastos/ }).click();
  await expect(page).toHaveURL(/pessoa=/);
  const painel = page.getByRole('dialog', { name: /Ana Gastos/ });
  await expect(painel.getByRole('row')).toHaveCount(3);                  // cabeçalho + sugestão + assistente
  await expect(painel).toContainText('Sugerir resposta');
});

test('gastos por cliente: abrir a empresa mostra os atendimentos e "abrir" leva à conversa naquele dia', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia');
  const clientes = page.getByRole('region', { name: 'Gastos por cliente' });
  await clientes.getByRole('searchbox', { name: 'Buscar empresa' }).fill('bom preço');
  await clientes.getByRole('searchbox', { name: 'Buscar empresa' }).press('Enter');
  await expect(page).toHaveURL(/busca=bom/);
  const linha = clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ });
  await expect(linha).toHaveAttribute('aria-expanded', 'false');
  await linha.click();
  await expect(page).toHaveURL(/empresa=/);
  await expect(clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ })).toHaveAttribute('aria-expanded', 'true');
  const atendimentos = clientes.getByRole('table', { name: /Atendimentos de Rede Bom Preço Gastos/ });
  await expect(atendimentos).toContainText('Carla Mendes');
  await expect(atendimentos).toContainText('passou para pessoa');        // hoje houve resposta de atendente
  await atendimentos.getByRole('link', { name: /abrir/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/atendimento/${dados.conversa}\\?data=\\d{4}-\\d{2}-\\d{2}`));
  await expect(page.locator('[data-dia-alvo="true"]')).toBeInViewport();
});
```

(A recusa das funções a quem não é administrador, chamadas direto pela API, é coberta pelo pgTAP da Task 3; a da rota de exportar, pelo e2e da Task 10.)

Run → Expected: FAIL.

- [ ] **Passo 2: ranking da equipe**

`ranking-equipe.tsx` (server): `<section aria-labelledby>` com o título "Quem mais gasta na equipe" (vira o nome da `region`) e "ações feitas por pessoas" à direita. Tabela: `#`, Pessoa (avatar com `iniciais`, `bg-brand-soft text-brand`, `aria-hidden`; o nome é um `Link` para `?pessoa=<id>` mantendo `p/de/ate`), **Onde gastou** (barra empilhada: `flex gap-0.5 h-3`, um `div` por parte em `ORDEM_EMPILHADO`, largura `style={{ width: \`${parte.pct}%\` }}`, cor do token, `title="Sugerir resposta: US$ 1,20"`; o conjunto `role="img"` com `aria-label="Assistente (site) US$ 2,10, Sugerir resposta US$ 1,20"`), Chamadas, Custo (`font-extrabold` na primeira), `%`. Embaixo, a **legenda** fixa (quadradinho de cor + nome) das quatro funcionalidades de `ORDEM_EMPILHADO`, sempre visível. Sem pessoas: `EmptyState` "Nenhuma ação de pessoas com IA neste período.".

- [ ] **Passo 3: detalhe da pessoa**

`detalhe-pessoa.tsx`: com `?pessoa=<uuid>` válido, a página chama `gastos_chamadas` com `p_usuario` e `p_limite: 200` e mostra num `PainelLateralUrl` (`param="pessoa"`, `hrefFechar` sem o parâmetro) uma tabela: data/hora (`formatarDataHora`), funcionalidade (nome), empresa (ou "—"), modelo, custo (`formatarUsdFino`). Título do painel = nome da pessoa (vira o nome do `dialog`); rodapé "Mostrando as 200 chamadas mais recentes do período" quando vierem 200, e o link **Exportar só desta pessoa** (`/gastos-ia/exportar?…&pessoa=<id>`, Task 10). UUID inválido: ignora o parâmetro.

- [ ] **Passo 4: gastos por cliente**

`gastos-por-cliente.tsx` (server): `<section aria-labelledby>` "Gastos por cliente"; à direita, um `<form method="get">` com `<input type="search" name="busca" aria-label="Buscar empresa">` (e os `p/de/ate` em `hidden`) e "ordenado por custo". Tabela: `#`, Empresa, Atendimentos, Custo, Por atendimento, Resolvidos pelo agente (`percentual(resolvidos, atendimentos)` + "%"). Cada empresa é um **link com papel de botão** (`<Link role="button" aria-expanded aria-controls>`) para `?empresa=<id>` (ou `?empresa=sem` para "Sem empresa identificada"); a aberta tem a borda esquerda vinho e ícone `ChevronUp`, as outras `ChevronDown`. Com a empresa aberta, a página chama `gastos_atendimentos_do_cliente` (`p_cliente` nulo para `sem`) e mostra, logo abaixo da linha, a tabela `aria-label="Atendimentos de <empresa>"`: Data (`formatarDataHora(inicio)` ou o dia), Contato, Mensagens, Resultado (selo: "passou para pessoa" `bg-warning-soft` com ícone `UserRound`; "resolvido pelo agente" `bg-success-soft` com ícone `Bot` — nunca só cor), Custo, e **abrir** (`Link` para `/atendimento/<conversa>?data=<dia>`, ícone `ExternalLink` `aria-hidden`; conversa nula → "conversa apagada"). Sem empresas: `EmptyState`.

Monte tudo na `page.tsx`, depois da grade da Task 8: `<RankingEquipe/>`, `<GastosPorCliente/>`, e o `<DetalhePessoa/>` quando houver `?pessoa=`.

- [ ] **Passo 5: "abrir" posiciona a conversa no dia**

`lib/historico.ts`: `linhaDoTempo` já cria o item `{ tipo: 'dia', chave: \`dia-${dia}\` }` com `dia` em `dd/mm/aaaa`. Acrescente ao item de dia o campo `iso: string` (AAAA-MM-DD de Brasília) e um teste em `lib/historico.test.ts`:

```ts
  it('o separador de dia traz a data ISO (âncora do "abrir" de Gastos com IA)', () => {
    const l = linhaDoTempo([{ id: 'a', criado_em: '2026-09-22T03:10:00Z' }], new Date('2026-10-01T12:00:00Z'));
    expect(l[0]).toMatchObject({ tipo: 'dia', iso: '2026-09-22' });
  });
```

(03:10 UTC = 00:10 de Brasília do dia 22.)

No componente que desenha o separador (`grep -n "tipo === 'dia'" apps/painel/src/app/\(painel\)/atendimento/\[id\]/*.tsx`), dê `id={\`dia-${item.iso}\`}` e, quando `item.iso === dataAlvo`, `data-dia-alvo="true"` com destaque (`bg-brand-soft text-brand font-semibold`, rótulo "Atendimento deste dia"). `page.tsx` do Atendimento lê `data` de `searchParams` (só `AAAA-MM-DD` válido) e passa até o histórico como `dataAlvo`.

`HistoricoRolante`: prop nova `inicial?: string` (seletor de id). Ao montar, se `inicial` existir e o elemento estiver no DOM, `scrollIntoView({ block: 'start' })` **em vez** de rolar para o fim; o resto do comportamento (novas mensagens, "Novas mensagens ↓") não muda. Teste de unidade, se `lib/rolagem-lista.ts` decidir a rolagem: acrescente o caso "com alvo inicial, não desce ao fim na abertura" em `rolagem-lista.test.ts`; se a decisão for só no componente, o e2e do passo 1 cobre.

Antes, `grep -rn "HistoricoRolante" apps/painel/src` e confira que a conversa do Assistente (outro uso) continua igual (sem `inicial`).

- [ ] **Passo 6: rodar**

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/gastos-ia.spec.ts e2e/atendimento-conversa.spec.ts e2e/assistente.spec.ts && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo verde.

- [ ] **Passo 7: commit**

```bash
git add apps/painel
git commit -m "feat(painel): ranking da equipe, detalhe da pessoa, gastos por cliente e atendimentos com link para o dia da conversa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Painel. Exportar CSV, cotação e custo por minuto, cartão do Início

**Files:**
- Create: `apps/painel/src/app/(painel)/gastos-ia/exportar/route.ts`, `apps/painel/src/lib/gastos-csv.ts`, `apps/painel/src/lib/gastos-csv.test.ts`
- Modify: `apps/painel/src/app/(painel)/configuracoes/{page.tsx,esquemas.ts,esquemas.test.ts}`
- Modify: `apps/painel/src/lib/inicio.ts`, `apps/painel/src/lib/inicio.test.ts`, `apps/painel/src/app/(painel)/inicio/{page.tsx,gasto-do-mes.ts}`
- Modify: `apps/painel/e2e/gastos-ia.spec.ts`, `apps/painel/e2e/configuracoes.spec.ts`

**Interfaces:**
- Consumes: `gastos_chamadas`, `gastos_resumo` (Task 3); `lerPeriodo`, `INFO_FUNCIONALIDADE` (Task 7); `TetoAlertasForm`, `salvarTetoAlertas`.
- Produces: `GET /gastos-ia/exportar?p=…&de=…&ate=…[&pessoa=<uuid>]` → `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="gastos-ia-<deDia>-a-<ateDia>.csv"`, 403 para quem não é administrador; `linhasCsvGastos(linhas: LinhaChamada[], cotacao: number | null): string`; `lerGastoIaDoMes(sb, agora): Promise<GastoDoMes | null>` agora pela RPC (mesma assinatura; `parcial` sempre `false`).

- [ ] **Passo 1: CSV — teste que falha**

`lib/gastos-csv.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { linhasCsvGastos } from './gastos-csv';

const linha = {
  id: '1', criado_em: '2026-09-26T13:05:00Z', funcionalidade: 'testar_agente', usuario_id: 'u', pessoa: 'Thiago', cliente_id: null, empresa: null,
  conversa_id: null, modelo: 'claude-sonnet-5', provedor: 'anthropic', tokens_entrada: 1200, tokens_saida: 300, tokens_cache_leitura: 5000,
  tokens_cache_escrita: 0, segundos_audio: null, custo_usd: 0.0123,
};

describe('linhasCsvGastos', () => {
  it('BOM, ponto e vírgula, cabeçalho em português, data de Brasília, vírgula decimal', () => {
    const csv = linhasCsvGastos([linha], 5.5);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const [cab, l1] = csv.slice(1).trimEnd().split('\r\n');
    expect(cab).toBe('Data e hora;Funcionalidade;Pessoa;Empresa;Modelo;Provedor;Tokens de entrada;Tokens de saída;Tokens lidos do cache;Tokens gravados no cache;Segundos de áudio;Custo (US$);Custo (R$)');
    expect(l1).toBe('26/09/2026 10:05;Testar o agente;Thiago;;claude-sonnet-5;anthropic;1200;300;5000;0;;0,012300;0,07');
  });
  it('sem cotação: sem a coluna R$; texto com ; ou aspas vai entre aspas', () => {
    const csv = linhasCsvGastos([{ ...linha, empresa: 'Rede "Bom"; Preço' }], null);
    expect(csv).not.toContain('Custo (R$)');
    expect(csv).toContain('"Rede ""Bom""; Preço"');
  });
  it('fórmula no começo do texto vira texto (=, +, -, @)', () => {
    expect(linhasCsvGastos([{ ...linha, pessoa: '=HYPERLINK("x")' }], null)).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
```

- [ ] **Passo 2: implementar `lib/gastos-csv.ts` e a rota**

```ts
// Exportação de Gastos com IA (spec 7B.3, P13): linha a linha, ; e BOM para o Excel em português. Sem telefone nem conversa.
import type { FuncionalidadeIa } from '@escritorio/core';
import { formatarDataHora } from './formatos';
import { INFO_FUNCIONALIDADE } from './gastos';

export type LinhaChamada = {
  id: string; criado_em: string; funcionalidade: string; usuario_id: string | null; pessoa: string | null; cliente_id: string | null; empresa: string | null;
  conversa_id: string | null; modelo: string; provedor: string; tokens_entrada: number; tokens_saida: number; tokens_cache_leitura: number;
  tokens_cache_escrita: number; segundos_audio: number | null; custo_usd: number;
};

function campo(v: string | number | null): string {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`; // a planilha não executa fórmula vinda do banco
  return /[;"\r\n]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}
const decimal = (v: number, casas: number) => v.toFixed(casas).replace('.', ',');

export function linhasCsvGastos(linhas: LinhaChamada[], cotacao: number | null): string {
  const cab = ['Data e hora', 'Funcionalidade', 'Pessoa', 'Empresa', 'Modelo', 'Provedor', 'Tokens de entrada', 'Tokens de saída',
    'Tokens lidos do cache', 'Tokens gravados no cache', 'Segundos de áudio', 'Custo (US$)', ...(cotacao ? ['Custo (R$)'] : [])];
  const corpo = linhas.map((l) => [
    campo(formatarDataHora(l.criado_em)), campo(INFO_FUNCIONALIDADE[l.funcionalidade as FuncionalidadeIa]?.rotulo ?? l.funcionalidade),
    campo(l.pessoa), campo(l.empresa), campo(l.modelo), campo(l.provedor), campo(l.tokens_entrada), campo(l.tokens_saida),
    campo(l.tokens_cache_leitura), campo(l.tokens_cache_escrita), l.segundos_audio === null ? '' : decimal(Number(l.segundos_audio), 2),
    decimal(Number(l.custo_usd), 6), ...(cotacao ? [decimal(Number(l.custo_usd) * cotacao, 2)] : []),
  ].join(';'));
  return `\uFEFF${[cab.join(';'), ...corpo].join('\r\n')}\r\n`;
}
```

(Confira o formato de `formatarDataHora`: o teste espera `26/09/2026 10:05`; se a função devolver outro separador, ajuste o **teste** para o formato da casa.)

`app/(painel)/gastos-ia/exportar/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { lerPeriodo } from '@/lib/gastos';
import { linhasCsvGastos, type LinhaChamada } from '@/lib/gastos-csv';
import { supabaseServidor } from '@/lib/supabase/servidor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** CSV linha a linha do período (P13). O banco decide quem pode (só o administrador); aqui só traduzimos a recusa. */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const periodo = lerPeriodo({ p: q.get('p') ?? undefined, de: q.get('de') ?? undefined, ate: q.get('ate') ?? undefined }, new Date());
  const pessoa = q.get('pessoa');
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('gastos_chamadas', {
    p_de: periodo.de, p_ate: periodo.ate, p_usuario: pessoa && UUID.test(pessoa) ? pessoa : undefined, p_limite: 100000,
  });
  if (error) return new NextResponse(error.message.includes('Só o administrador') ? 'Só o administrador exporta os gastos com IA.' : 'Não consegui exportar.', { status: error.message.includes('Só o administrador') ? 403 : 500 });
  const { data: cfg } = await sb.from('configuracoes').select('cotacao_usd_brl').eq('id', 1).single();
  const csv = linhasCsvGastos((data ?? []) as LinhaChamada[], cfg?.cotacao_usd_brl ? Number(cfg.cotacao_usd_brl) : null);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gastos-ia-${periodo.deDia}-a-${periodo.ateDia}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

Confira se o `middleware` do painel deixa rotas do grupo `(painel)` sem sessão passarem (sem sessão, o RPC recusa e a rota devolve 403 — certo). Ligue o link **Exportar** de `filtros-periodo.tsx` a `/gastos-ia/exportar?<os mesmos p/de/ate>` (`download`, ícone `Download`).

No e2e, acrescente:

```ts
test('atendente: a exportação recusa (403)', async ({ page }) => {
  await entrar(page, dados.ana.email, dados.ana.senha);
  const resposta = await page.request.get('/gastos-ia/exportar?p=mes');
  expect(resposta.status()).toBe(403);
});

test('exportar CSV do período', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia');
  const baixando = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Exportar' }).click();
  const arquivo = await baixando;
  expect(arquivo.suggestedFilename()).toMatch(/^gastos-ia-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/);
  const texto = await (await import('node:fs/promises')).readFile(await arquivo.path(), 'utf8');
  expect(texto.split('\r\n')[0]).toContain('Data e hora;Funcionalidade;Pessoa');
  expect(texto).toContain('Sugerir resposta');
  expect(texto).not.toContain('5531');   // nenhum telefone sai no arquivo
});
```

- [ ] **Passo 3: Configurações › Teto de IA**

`esquemas.test.ts`: casos novos — `cotacao_usd_brl` vazio vira `null`, `"5,55"` e `"5.55"` viram `5.55`, `0` e negativo recusados com "A cotação precisa ser maior que zero."; `custo_minuto_transcricao_usd` vazio vira `null`, `"0,000667"` vira `0.000667`, negativo recusado.

`esquemas.ts`, em `TetoAlertasForm`: no `preprocess`, `cotacao_usd_brl: f.get('cotacao_usd_brl') || null, custo_minuto_transcricao_usd: f.get('custo_minuto_transcricao_usd') || null`; no objeto:

```ts
const decimalOpcional = (msg: string, minimoExclusivo: boolean) => z.preprocess(
  (v) => (v === null || v === '' ? null : Number(String(v).replace(',', '.'))),
  z.number({ invalid_type_error: msg }).refine((n) => Number.isFinite(n) && (minimoExclusivo ? n > 0 : n >= 0), msg).nullable(),
);
// …
  cotacao_usd_brl: decimalOpcional('A cotação precisa ser maior que zero.', true),
  custo_minuto_transcricao_usd: decimalOpcional('O custo por minuto não pode ser negativo.', false),
```

`page.tsx` de Configurações, na seção `teto-ia` (só administrador), dois campos novos depois do teto:
- `FormField id="cotacao_usd_brl" rotulo="Cotação do dólar (R$ por US$ 1)" ajuda="Só para mostrar os gastos em reais. Vazio: tudo em US$."` com `<Input name="cotacao_usd_brl" inputMode="decimal" defaultValue={cfg?.cotacao_usd_brl ?? ''} className="tabular sm:w-40" />`;
- `FormField id="custo_minuto_transcricao_usd" rotulo="Custo por minuto da transcrição de áudio (US$)" ajuda="Veja no painel do fornecedor (Groq). Vazio: a transcrição fica sem custo em Gastos com IA."`.
Acrescente na `ajuda` do teto um link "Ver gastos com IA" (`/gastos-ia`).

`e2e/configuracoes.spec.ts`: no teste do administrador que salva o teto (`grep -n "teto_ia_usd" apps/painel/e2e/configuracoes.spec.ts`), preencha a cotação `5,55`, salve, recarregue e confira o valor; confira também que quem tem "Configurações: Sim" **não** vê os dois campos (a seção inteira já é só do administrador).

- [ ] **Passo 4: Início**

`lib/inicio.test.ts`: troque os testes de `lerGastoIaDoMes` (paginação) por:

```ts
describe('lerGastoIaDoMes', () => {
  it('lê o total do mês pela gastos_resumo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { total_usd: 41.2 }, error: null });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date('2026-10-15T15:00:00Z'))).toEqual({ total: 41.2, parcial: false });
    expect(rpc).toHaveBeenCalledWith('gastos_resumo', { p_de: '2026-10-01T00:00:00-03:00', p_ate: '2026-11-01T00:00:00-03:00' });
  });
  it('quem não é administrador: null', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Só o administrador vê os gastos com IA.' } });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date())).toBeNull();
  });
});
```

`lib/inicio.ts`: `lerGastoIaDoMes` vira

```ts
/** Gasto de IA do mês corrente (Brasília) pela gastos_resumo (só o administrador; os outros recebem null). */
export async function lerGastoIaDoMes(sb: Cliente, agora: Date): Promise<GastoDoMes | null> {
  const { inicio, fim } = mesCorrenteSP(agora);
  const { data, error } = await sb.rpc('gastos_resumo', { p_de: inicio, p_ate: fim });
  if (error || !data) return null;
  return { total: Number((data as { total_usd: number }).total_usd) || 0, parcial: false };
}
```

e apague `POR_PAGINA`, `EM_PARALELO` e `LINHAS_MAX_GASTO` se mais ninguém os usar (`grep -rn "LINHAS_MAX_GASTO\|EM_PARALELO" apps/painel/src`). Mantenha o tipo `GastoDoMes` (o campo `parcial` some depois, na Parte G, para não mexer em mais telas agora). `gasto-do-mes.ts` não muda (a memória curta continua útil). No `GastoIa` de `inicio/page.tsx`, acrescente no rodapé o link `<Link href="/gastos-ia" className="text-brand underline-offset-4 hover:underline">Ver gastos</Link>`.

- [ ] **Passo 5: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/gastos-ia.spec.ts e2e/configuracoes.spec.ts e2e/inicio-vencimentos.spec.ts`
Expected: tudo verde.

- [ ] **Passo 6: commit**

```bash
git add apps/painel
git commit -m "feat(painel): exportar CSV dos gastos, cotação e custo por minuto em Configurações, Início pela gastos_resumo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Acessibilidade, catálogo e manuais

**Files:**
- Modify: `apps/painel/e2e/acessibilidade.spec.ts`
- Modify: `apps/painel/src/app/(painel)/_design/page.tsx` (se tiver seção de padrões)
- Modify: `docs/design-system.md`, `docs/operacao.md`

**Interfaces:**
- Consumes: as telas das Tasks 8 a 10.
- Produces: acessibilidade conferida nos dois temas; manuais atualizados.

- [ ] **Passo 1: acessibilidade nos dois temas**

Em `e2e/acessibilidade.spec.ts`, no laço que audita as telas do administrador (`grep -n "auditar(page" apps/painel/e2e/acessibilidade.spec.ts | head`), acrescente `/gastos-ia` com dados (use `semearGastos` da Task 8) e mais duas auditorias: com `?pessoa=<id da Ana>` (painel lateral aberto) e com `?empresa=<id da Rede>` (atendimentos abertos).

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/acessibilidade.spec.ts`
Expected: sem violação séria ou crítica nos temas claro e escuro. Se o axe acusar contraste em texto sobre `bg-warning-soft` (alerta do dia) ou nos selos de resultado, use os pares de texto já aprovados do `StatusBadge` (`grep -n "warning\|success" apps/painel/src/components/patterns/status-badge.tsx`). As barras são `aria-hidden` (a informação está nas tabelas); a barra empilhada tem `role="img"` com `aria-label`.

Confira à mão, com o teclado: Tab passa pelos filtros, pelo "Ver em tabela", pelas pessoas do ranking e pelas empresas; Enter abre e fecha a empresa; Esc fecha o painel da pessoa e devolve o foco.

- [ ] **Passo 2: catálogo**

Se `/_design` mostra padrões, acrescente "Gastos com IA (Parte F)": as oito cores `--gasto-*` com o nome da funcionalidade ao lado (amostra `style={{ background: \`var(${token})\` }}`, como as outras do catálogo) e uma barra empilhada de exemplo com a legenda. Sem seção de padrões, não acrescente nada.

- [ ] **Passo 3: `docs/design-system.md`**

Em "Vocabulário oficial da interface":

```markdown
- **Gastos com IA:** "Gastos com IA", "Total do mês × teto", "Previsão até o fim do mês", "Chamadas à IA", "Custo por atendimento", "Áudios transcritos", "Por funcionalidade", "Por dia", "Quem mais gasta na equipe", "Onde gastou", "Gastos por cliente", "Atendimentos", "Resolvidos pelo agente", "passou para pessoa", "resolvido pelo agente", "Não identificado", "Exportar". **Atendimento** nesta tela = as mensagens de um telefone num mesmo dia.
```

Em "Regras de estilo", um parágrafo:

```markdown
**Gráficos** (Gastos com IA): uma cor por funcionalidade, nos tokens `--gasto-*` (paleta conferida pelo validador da skill dataviz no claro e no escuro); a cor segue a funcionalidade, nunca a posição. Barra de dado só com `style={{ width|height: '<n>%' }}`; o gráfico é `aria-hidden` e sempre há uma tabela equivalente ("Ver em tabela") ou uma legenda visível com o texto. Texto nunca na cor da série. Números grandes em `font-extrabold`.
```

- [ ] **Passo 4: `docs/operacao.md`**

Em "## 3. Dia a dia", depois de "### Prioridade e prazo das demandas", acrescente:

```markdown
### Gastos com IA (só o administrador)

Menu **Gastos com IA** (moeda). Mostra tudo o que gasta com IA: o agente com os clientes, o assistente (site e WhatsApp), Sugerir resposta, Testar o agente e a transcrição de áudio.

- **Período:** Hoje, 7 dias, Este mês (padrão), Mês passado ou Período (até 366 dias). **Exportar** baixa o CSV linha a linha do período (abre no Excel).
- **Total do mês × teto:** a barra tem a marca de 80% (quando chega o aviso) e a previsão de fechamento (gasto até hoje ÷ dias corridos × dias do mês). Embaixo, quanto o cache de prompt economizou.
- **Custo por atendimento:** atendimento é a conversa de um telefone num mesmo dia.
- **Quem mais gasta na equipe:** só o que as pessoas pediram (assistente, sugestão, testes). Clique no nome para ver cada chamada.
- **Gastos por cliente:** clique na empresa para ver os atendimentos (resolvido pelo agente ou passou para pessoa) e **abrir** a conversa naquele dia.
- **Em reais:** preencha a cotação em Configurações › Teto de IA (manual; nada busca na internet). Lá também fica o **custo por minuto da transcrição** (veja no painel da Groq); sem ele, os áudios aparecem sem custo.
- **"Não identificado":** gastos de antes desta versão sem como saber de onde vieram, ou gravados por um trabalhador desatualizado. Se aparecer número novo depois da troca do trabalhador, avise: é erro.
- O **teto mensal** soma tudo, inclusive a transcrição. Ao chegar no teto, o agente para; a transcrição continua (a equipe precisa do texto).
```

- [ ] **Passo 5: commit**

```bash
git add docs/design-system.md docs/operacao.md apps/painel/src apps/painel/e2e
git commit -m "docs: Gastos com IA no catálogo e no manual; acessibilidade da tela nos dois temas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes:
   - **regressão congelada:** a linha do `22_regressao_visibilidade.test.sql` de agora (100/100) ao lado da guardada na Task 1 (`$SCRATCH/regressao-antes.txt`), e `git diff 4ac76ac -- supabase/tests/22_regressao_visibilidade.test.sql` **vazio**;
   - `supabase test db`: todos os arquivos, com os números de cada um, inclusive `32` 20/20, `33` 5/5, `34` 31/31 e o `25` (nenhuma função de gravação sem trava);
   - `pnpm --filter @escritorio/core test`;
   - `pnpm --filter @escritorio/db test` e `pnpm --filter @escritorio/db typecheck`;
   - `pnpm --filter @escritorio/trabalhador test` e `pnpm --filter @escritorio/trabalhador typecheck` (com `supabase db reset` antes, se o `supabase test db` rodou no mesmo banco), mostrando `test/gastos/caminhos.test.ts` e `varredura.test.ts`;
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com `acessibilidade.spec.ts` nos dois temas (`supabase db reset` antes);
   - **cenários com Claude real (P19):** `pnpm --filter @escritorio/trabalhador cenarios-assistente` e `pnpm --filter @escritorio/trabalhador cenarios-atendimento` (o `cache_control` entrou no assistente e na sugestão); depois, uma consulta no banco **local** mostrando que os registros desses cenários saíram com `assistente_site`/`assistente_whatsapp`/`sugerir_resposta`/`agente_clientes` e **nenhum** `nao_identificado`, e quantos tokens vieram do cache (`tokens_cache_leitura > 0` na segunda pergunta). Os ~50 do agente **não** rodam (o prompt do agente não mudou); ficam como opção do dono (~US$ 10–15);
   - mostre os números exatos de cada suíte (passaram, falharam, pulados). Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-gastos-ia.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local e dados parecidos com os da imagem (outubro; teto US$ 100 e cotação 5,55; agente ~67%, assistente site, WhatsApp, sugerir, testar, transcrição de 212 min; um dia bem mais caro com "Testar o agente usado 31 vezes por Thiago"; Thiago, Ana e Bruno no ranking; Rede Bom Preço Ltda aberta com três atendimentos de Carla Mendes e Roberto, um "passou para pessoa"; Mercado Central, Padaria Sol ME, MEI Lima);
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**), gravando os dados pela chave de serviço **do banco local**;
   - telas: `/gastos-ia` com a Rede aberta (`?empresa=`); o painel da pessoa (`?pessoa=` do Thiago); "Ver em tabela" aberto no Por dia; Configurações › Teto de IA com os campos novos; o Início com "Ver gastos";
   - liste o que ficou diferente da imagem. Já se sabe: "Custo por atendimento" e "Atendimentos" no lugar de "conversa(s)" (P10); a linha "Não identificado" quando houver; "Exportar" e "Período" como na imagem, com o formulário de datas; a imagem não mostra o painel da pessoa nem a economia do cache.
3. **Homologação — primeiro a contagem, depois o `--dry-run`:**
   - **contagem só de leitura (Prompt F: antes de migrar os antigos):** com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode a consulta da Task 2 (`$SCRATCH/contagem-uso-ia.sql`, que abre com `begin transaction read only` e termina com `rollback`) contra o `DATABASE_URL` da homologação, por `psql` ou pelo `node -e` da Task 2 com `URL_LEITURA="$DATABASE_URL"`. **Mostre a tabela ao dono**: quantos registros ficam `agente_clientes`, quantos `nao_identificado`, quantos já têm funcionalidade (`já tem: sugerir_resposta`), o custo de cada grupo e quantos ganham empresa;
   - depois, `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Deve listar `20261006000100_painel_v2_gastos_colunas.sql` a `20261006000300_painel_v2_gastos_funcoes.sql` (e as das Partes C a E que ainda não estiverem lá);
   - explique o que muda para quem já está rodando na homologação:
     - **ninguém passa a ver mais nem menos** (teste 22); `uso_ia` continua só do administrador;
     - **com o trabalhador antigo (3001) ainda ligado:** o agente continua gravando normalmente (o gatilho completa a funcionalidade e a empresa); o assistente e o Testar o agente dele entram como **"Não identificado"** e a tela mostra o aviso; a transcrição de áudio **não** aparece (o antigo não a grava). Tudo isso se resolve ao trocar o trabalhador (item 4);
     - o painel antigo (outras portas) continua funcionando: o Início dele soma `uso_ia` pela leitura antiga, que não muda;
   - **espere o "ok" dele.** Só então rode o mesmo comando sem `--dry-run`. Sem o "ok", pare aqui: o painel desta branch precisa das funções novas.
4. **Subir para o dono testar:**
   - **painel** desta worktree na porta **3009** (antes, `netstat -ano | findstr :3009`; se ocupada, a próxima livre). Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal: variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p 3009` rodando nesta worktree;
   - **trabalhador: NÃO suba nenhum.** O da porta **3001 é o teste do dono** (recebe o webhook da Z-API pelo túnel); não o desligue nem o mate, e não suba um segundo apontando para a homologação. Entregue o desta branch **"pronto para trocar"**, com estas instruções para o dono:
     1. feche você mesmo a janela do trabalhador da 3001 (Ctrl+C; ele termina o que está fazendo);
     2. abra um terminal em `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-f/apps/trabalhador` e rode `pnpm exec tsx watch "--env-file=C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-f/.env" "--env-file=C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.env.homologacao" src/principal.ts` (sobe na 3001, para onde o túnel já aponta);
     3. para voltar ao anterior, feche esta janela e abra o trabalhador antigo como antes;
   - passe o endereço do painel e um roteiro curto:
     1. Configurações › Teto de IA: preencha a cotação e o custo por minuto da transcrição;
     2. `/gastos-ia`: troque os períodos; confira o total, a previsão, as chamadas, o custo por atendimento e os áudios;
     3. com o trabalhador novo, mande pelo WhatsApp de teste um texto e um áudio; peça algo ao assistente pelo site e pelo WhatsApp; use Sugerir resposta e Testar o agente; recarregue a tela: cada coisa na sua linha, com o seu nome no ranking, e **nenhum "Não identificado" novo**;
     4. clique no seu nome no ranking (detalhe linha a linha) e numa empresa (atendimentos); "abrir" leva à conversa naquele dia;
     5. Exportar: abra o CSV no Excel;
     6. entre com uma pessoa que não é administradora: o item não aparece e `/gastos-ia` volta para o Início.
5. **Pendências para listar no fim:**
   - as respostas do dono às perguntas P1 a P20 que ainda faltam, e as decisões 1 a 10 que ele ainda não confirmou;
   - o que ficou diferente da imagem 00;
   - a contagem dos registros antigos (item 3) e a decisão de migrar;
   - opcional: os ~50 cenários do agente (o prompt não mudou nesta parte);
   - Parte G: tirar o campo `parcial` de `GastoDoMes` no redesenho do Início;
   - Parte I: preencher `setor_id`, funcionalidades `agente_<slug>`/`tarefa_<slug>` (a regra do banco muda) e o agrupamento "por agente" na tela; validar a cor `--gasto-especialista` junto das outras.
6. **Não juntar** a branch em nada. **Parar** ao fim da Parte F e esperar "próxima parte".
