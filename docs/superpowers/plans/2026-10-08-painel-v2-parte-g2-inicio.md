# Painel v2, Parte G2 (Início). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** o **Início** escolhe a versão pelo papel. **Administrador → "Painel de situação"** (`00-inicio-opcao-a.png`): faixa de alertas só com problema; 5 números (Esperando pessoa, Demandas abertas, Vencem hoje, Vencidas, Sem responsável); cartão do agente com PAUSAR/RETOMAR e os números do dia (conversas, % resolvidas pelo agente, demandas que ele abriu); sinais de vida; gasto × teto com previsão e link para Gastos com IA; tabela "Demandas por setor" (abertas, vencem hoje, vencidas, sem responsável, urgentes, barra de situação, Triagem); listas "Esperando pessoa agora" (cronômetro) e "Vencidas"; avisos. **Qualquer outra pessoa → "Minha mesa"** (`00-inicio-opcao-b.png`): "Bom dia, <nome>" pelo horário de Brasília; 4 números de ação; "Minhas demandas por prazo" (Vencida · Vencem hoje · Próximos dias) com ABRIR e CONCLUIR; "Sem responsável nos meus setores" com ASSUMIR; conversas esperando com cronômetro e não lidas; atalhos; bloco compacto "Sistema" **sem pausar e sem gasto**; "Você concluiu N demandas hoje". **Quem atende nunca recebe custo** — nem na tela, nem no pacote que o servidor manda ao navegador.

**Arquitetura:**
- **Banco (uma migração nova; nenhuma antiga é editada):** `20261008000100_painel_v2_inicio.sql` com três funções **só de leitura**:
  - `estado_sistema_resumo()` (`security definer`, `stable`): `{agente_pausado, teto_atingido, whatsapp_conectado, trabalhador_ok, verificado_em}` — só booleanos e a hora; nenhum valor de custo; qualquer pessoa ativa dentro do horário (`eh_usuario_ativo()`), `null` para arquivada ou fora do horário;
  - `agente_numeros_hoje(p_agora)` (`security definer`, `stable`, só administrador): `{conversas, resolvidas_agente}` do dia de Brasília;
  - `demandas_por_setor(p_agora)` (`security invoker`, `stable`): uma linha por setor ativo (e por setor desativado que ainda tem aberta) mais a Triagem, com `abertas, no_prazo, vencem_hoje, vencidas, sem_responsavel, urgentes`, contadas **pela regra de leitura de quem chama** (RLS de `chamados`).
- **Painel:** `inicio/page.tsx` só escolhe a versão; `painel-situacao.tsx` e `minha-mesa.tsx` compõem seções que são componentes de servidor assíncronos, cada um lendo o que precisa por leitores com `cache()` do React (uma leitura por requisição, mesmo "agora" para todas as seções): `dados-inicio.ts` (comum), `dados-situacao.ts` (só o Painel de situação importa; é o único que lê gasto, `configuracoes` e `sinais_vida`) e `dados-mesa.ts`. Regras puras em `lib/inicio.ts` (sem o campo `parcial` de `GastoDoMes`, pendência da F) e `lib/minha-mesa.ts`. CONCLUIR e ASSUMIR **reutilizam** `concluirDemanda`/`assumirDemanda` de `demandas/acoes.ts` (as funções do banco conferem a permissão), que passam a revalidar também `/inicio`. Atualização: **polling** (`RecarregarPeriodico`, a cada minuto e ao voltar para a aba) + o `AtualizarAoVivo` de hoje (chamados, conversas e mensagens). Nada novo no Realtime.

**Tecnologias:** Next.js 15 (App Router, server components, server actions), React 19 (`cache`), Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (Postgres, RLS, pgTAP), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção **7C.1** (Início, as duas opções escolhidas pelo papel; banco: `estado_sistema_resumo()` "legível por qualquer autenticado (agente pausado, teto atingido, WhatsApp conectado, trabalhador ok — sem valores de custo)… Realtime") e **7C.6** (verificação: "Playwright por tela (… dois papéis no Início …)"; "pgTAP: `estado_sistema_resumo` sem custos e legível por atendente"; capturas 1366/1920, claro e escuro);
- **3.1** (termos; migração incremental com pgTAP; `--dry-run`; nada é juntado), **6.5** (prazo; "Com o cliente" pausa), **7** (Parte D: níveis de Demandas e Atendimento, horário de acesso), **7A** (Parte E: espera, cronômetro, não lidas, "esperando você"), **7B** (Parte F: gasto × teto, previsão, cotação), **4.6** (tom dos textos), **8** (vermelho nunca sozinho);
- `docs/superpowers/specs/painel-v2/analise-arquitetura.md`, item 12 (o estado do agente para quem atende, sem custo).
- Imagens: `imagens/00-inicio-opcao-a.png` (administrador) e `imagens/00-inicio-opcao-b.png` (quem atende). HTML de origem: `fragmentos/00-inicio-opcao-a.html` e `-opcao-b.html`. Dados nas imagens são de exemplo. Onde a imagem e o spec divergem, vale o spec.

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt G" — ordem Configurações → **Início** → Contatos → Assistente → Treinar o agente; **este plano cobre só o Início (G2)**. "Pontos que não podem falhar": **Início escolhe a versão pelo papel (admin = Painel de situação; demais = Minha mesa); atendente nunca vê custos.** Ao terminar a tela: suítes com resultado real, capturas comparadas com a imagem, e **parar**. Estilo e convenções: `docs/superpowers/plans/2026-10-07-painel-v2-parte-g1-configuracoes.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-g`, branch `painel-v2-parte-g`, a partir de `3ea7002` (G1 Configurações pronta). Todos os comandos rodam a partir da raiz da worktree. A pasta do spec já é a mais nova (`git diff etapa-1 -- docs/superpowers/specs/painel-v2` saiu vazio em 03/10); se deixar de sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso antes da Task 1.

## Decisões tomadas (sem o dono)

O dono está fora e autorizou decidir. Conferi no código o que o spec supõe: o Início de hoje (`inicio/page.tsx`) é uma página só, que esconde cartões para quem não é administrador porque `configuracoes`, `sinais_vida` e `gastos_resumo` só respondem ao administrador (mas **"Configurações: Sim" lê `configuracoes` inteira, inclusive `teto_ia_usd`**, pela política `leitura_configuracoes` da Parte D); o papel é só `admin | atendente`; `chamados`/`demandas_lista` e `caixa_entrada` já filtram pelo nível da pessoa (`pode_ver_chamado`, `pode_ver_conversa`, Parte D) e pelo horário; o teto que para o agente é `custo_ia_periodo(mês de Brasília) >= teto_ia_usd` (trabalhador, `processar-conversa.ts`); o trabalhador grava `sinais_vida` `fila` a cada minuto e `whatsapp` no mesmo batimento só com a Z-API conectada (o Início chama de parado depois de 5 min, `LIMITES_BATIMENTO`); a publicação `supabase_realtime` está congelada pelo teste 22 (`assistente_mensagens, chamados, conversas, mensagens, simulacoes_agente`); PAUSAR/RETOMAR é `alternarPausaGeral` com `exigirAdmin()` e o gatilho `configuracoes_so_admin`; ASSUMIR e CONCLUIR já existem (`assumir_demanda`, `concluir_chamado`, que conferem `pode_ver_chamado` e recusam demanda concluída ou já com outra pessoa). Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Custo da alternativa | Task |
|---|---|---|---|---|
| D1 | **A versão sai do papel:** `papel = 'admin'` → Painel de situação; qualquer outra pessoa → Minha mesa, **inclusive "Configurações: Sim"**. A Minha mesa nunca importa `dados-situacao.ts` (o único arquivo que lê gasto, `configuracoes` e `sinais_vida`). | Escolher pela permissão (ex.: "Configurações: Sim" ganha o Painel de situação). | O Painel de situação lê teto, gasto e cotação: a pessoa receberia custo, contra o ponto que "não pode falhar". | 3, 9 |
| D2 | **"Realtime" do spec = polling.** `estado_sistema_resumo` é função, não tabela; nada entra na publicação. A página recarrega os dados do servidor a cada minuto com a aba visível e ao voltar para a aba (`RecarregarPeriodico`, que já existe), além do `AtualizarAoVivo` de hoje (chamados, conversas, mensagens). Pausa, teto e sinais aparecem em até ~75 s. | Tabela `estado_agente` publicada no Realtime com gatilhos em `configuracoes` e `sinais_vida`. | Quebra o teste congelado 22 (lista do `supabase_realtime`), que não pode mudar; e o batimento grava a cada minuto, então o "ao vivo" seria quase o mesmo que o polling. | 1, 9 |
| D3 | **`estado_sistema_resumo()` devolve só quatro booleanos e `verificado_em`.** "WhatsApp conectado"/"trabalhador ok" = sinal nos últimos 5 min (o mesmo "parado" da faixa). Arquivada ou fora do horário recebe `null` (como `limites_espera`). | Devolver as horas dos sinais. | Mais detalhe para quem atende sem uso na tela. | 1 |
| D4 | **A barra do topo não muda nesta parte:** o indicador do agente continua só para quem lê `configuracoes`. A Minha mesa resolve o item 12 da análise pelo bloco Sistema. | Trocar a casca (`layout.tsx`, `useAoVivo`) para `estado_sistema_resumo` para todos. | Mexe em todas as telas e nos testes do menu; fica listado como pendência para o fim da Parte G. | — |
| D5 | **Os 5 números do administrador são a soma da tabela "Demandas por setor"** (`demandas_por_setor`): cartões e tabela sempre batem. "Vencem hoje" = ainda não vencidas com prazo hoje (Brasília), **sem** as que já venceram hoje (essas estão em Vencidas). O "Ver na lista" de Vencem hoje continua em `/demandas?prazo=hoje` (que mostra também as que venceram hoje, marcadas como vencidas). | Contar pelos filtros da tabela de Demandas, como hoje. | Cartão e tabela do setor diriam números diferentes para o mesmo dia. | 1, 5 |
| D6 | **"Esperando pessoa" (administrador) = conversas com espera em aberto** (`caixa_entrada.espera_desde`), de todos; na Minha mesa, **"esperando você"** (`esperando_voce`, a mesma conta do menu e do Atendimento). | `esperando_pessoa` (inclui assumida já respondida). | Contaria conversa assumida em que ninguém espera. | 5, 8 |
| D7 | **Números do agente** (função nova só do administrador): conversas = com mensagem do cliente hoje (Brasília, sem o WhatsApp do assistente); **resolvidas pelo agente** = sem resposta da equipe, sem "assumida" **e sem passagem para pessoa** no dia; "demandas que ele abriu" = criadas hoje com origem agente/sistema (o mesmo do filtro "Do agente"). | A regra de atendimento da Parte F (só resposta ou assumir). | Conversa que o agente passou e ninguém pegou contaria como resolvida. | 1, 4 |
| D8 | **"ativo desde 07:58" não existe no banco:** o cartão do agente diz "dentro do expediente" / "fora do expediente" (`estaNoExpediente` do core, com o feriado de hoje). | Gravar quando o agente foi ligado. | Coluna nova e mudança no trabalhador, fora desta parte. | 4 |
| D9 | **Vencidas: "mais atrasada: venceu 01/10"** (a data, pelo `descreverPrazo` da Parte C), não "1 dia útil". | Dias úteis de atraso. | Função nova só para esse texto. | 5 |
| D10 | **Faixa:** fila de tarefas **atrasada** (3 a 5 min sem batimento) ganha aviso âmbar, como na imagem ("Se passar de 5 min, vira alerta crítico"); parado continua vermelho. Cada aviso tem link ("Ver sinais de vida", "Ver Gastos com IA"). | Só o parado (como hoje). | Diferente da imagem; o atraso passaria sem aviso. | 2, 5 |
| D11 | **Grupos da Minha mesa:** Vencida · Vencem hoje · Próximos dias; "Com o cliente" (pausada) e sem prazo vão para Próximos dias, marcadas ("pausado", "sem prazo"). Os números "minhas vencidas" e "vencem hoje" são os dos grupos (disjuntos) e **levam ao grupo na própria página** (âncora). | Levar a `/demandas` com filtro. | A lista de lá mostra outras regras (todas as que a pessoa vê; vencidas de hoje em "vence hoje"): o número não bateria. | 7 |
| D12 | **ABRIR e CONCLUIR em toda linha** de Minhas demandas (o spec); a imagem mostra um botão por linha. CONCLUIR pede confirmação, como no painel lateral. | Seguir a imagem. | Para concluir seria preciso abrir a demanda. | 7 |
| D13 | **"Sem responsável nos meus setores"** = demandas abertas sem responsável cujo setor está entre os setores da pessoa, **e** que ela pode ver (RLS por cima). A Triagem não entra; "Só as minhas" vê a lista vazia (o RLS esconde). | Incluir a Triagem. | Quem é "Do meu setor" não vê a Triagem (RLS): a seção mentiria. | 8 |
| D14 | **Nenhuma ação nova:** CONCLUIR e ASSUMIR chamam `concluirDemanda`/`assumirDemanda` de `demandas/acoes.ts`, que ganham `revalidatePath('/inicio')`. | Ações próprias do Início. | Duplicaria a conferência de permissão. | 7 |
| D15 | **"Você concluiu N demandas hoje"** = demandas distintas com evento `conclusao` da pessoa desde 00:00 de Brasília. Sem o "todas no prazo" da imagem. | Com "no prazo". | Mais leitura para pouco ganho. | 7 |
| D16 | **"12 com o agente agora" vira "N com o agente hoje":** conversas que a pessoa vê, com o agente, sem espera, com mensagem hoje. | Todas as conversas com o agente. | Número sem sentido: a conversa é uma por telefone, para sempre. | 8 |
| D17 | **Atalhos pela permissão:** Nova demanda, Buscar empresa (`/clientes`), Respostas prontas (só com "Configurações: Sim"), Assistente (se usa), Pedidos de nota (`/demandas?tipo=venda`, com Pedidos de nota ≥ Ver), Contatos. | Os seis da imagem sempre. | Atalhos que levam a "sem acesso". | 8 |
| D18 | **Bloco Sistema (Minha mesa):** Agente (atendendo · pausado · pausado: limite de IA do mês — sem valores), WhatsApp (conectado · sem sinal · sem confirmação quando a fila parou), Mensagens só quando a fila parou ("paradas: avise o administrador"), "Avisos para você N · ver" (âncora para a lista de avisos, no fim da página só quando há aviso). Sem PAUSAR, sem gasto. A Minha mesa não tem faixa de alertas. | Faixa de alertas também na Minha mesa. | Repetiria o bloco Sistema no topo. | 2, 8 |
| D19 | **Prazo em texto = `descreverPrazo` da Parte C** ("hoje 17h", "amanhã", "03/10", "venceu 01/10", "pausado"), não "sex 03/10" da imagem. | Dia da semana. | Dois formatos de prazo no painel. | 7 |
| D20 | **Textos e marcação que mudam, e testes ajustados:** os números usam `data-numero`/`data-valor` (contrato dos e2e, em `e2e/apoio-inicio.ts`); "Esperando você" vira "conversas esperando você" (Minha mesa); o cartão do agente diz "Atendendo"/"Pausado"/"Parado pelo teto de IA"; "Gasto com IA no mês" vira "Gasto com IA × teto" e "Ver gastos" vira "Ver Gastos com IA". Os e2e de partes anteriores que liam esses textos (`inicio-vencimentos`, `atendimento-lista`, `gastos-ia`, `configuracoes`) passam ao contrato novo na task que muda o texto. **Nenhum pgTAP antigo muda.** | Manter os textos de hoje. | Diferente das imagens aprovadas. | 3, 4, 5 |
| D21 | **Homologação sem a migração:** o painel desta branch abre. Administrador: tabela por setor e os 5 números mostram "—" com "indisponível: falta a atualização do banco"; números do agente "—". Minha mesa: Sistema mostra "estado indisponível agora". O resto funciona. | Exigir a migração para abrir o Início. | O dono não veria a tela antes de aprovar as migrações (F e G1 também estão pendentes). | 4 a 8 |
| D22 | **Um esqueleto só** em `loading.tsx` (o carregamento não sabe o papel). | Esqueleto por papel. | Teria de ler a pessoa antes de mostrar o esqueleto. | 3 |
| D23 | **Saudação por Brasília:** 05h–11h "Bom dia", 12h–17h "Boa tarde", 18h–04h "Boa noite". Administrador: "Situação do escritório · quinta, 02/10" e "Bom dia, Thiago. Visão de administrador: todos os setores."; Minha mesa: "Bom dia, Ana" e "Quinta, 02/10 · seus setores: Pessoal e Fiscal". | Saudação fixa. | Diferente das imagens. | 2 |
| D24 | **Botões do topo:** administrador GESTÃO DAS DEMANDAS e ABRIR ATENDIMENTO; Minha mesa PERGUNTAR AO ASSISTENTE (só quem usa o assistente) e NOVA DEMANDA (`/demandas?nova=1`). | Os da imagem sempre. | Botão que leva a "sem acesso". | 5, 8 |
| D25 | **`GastoDoMes` perde `parcial`** (pendência da F): `{ total }`. A memória de 60 s do gasto continua. | Manter. | Campo morto. | 2 |

## Restrições globais

- **Só mexer em:**
  - banco: **criar** `supabase/migrations/20261008000100_painel_v2_inicio.sql` e o teste `supabase/tests/37_painel_v2_inicio.test.sql`;
  - `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão);
  - `apps/painel` (tela, lib, componentes, e2e) e `docs/design-system.md`, `docs/operacao.md`.
  - Nada no trabalhador, no prompt do agente, no Bling.
- **Nunca editar migração antiga** (`20261007000200` e anteriores). Toda mudança é migração nova, a partir de `20261008000100`.
- **Nunca editar teste pgTAP de parte anterior** (`01` a `36`). **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` não muda e continua 100/100** depois da migração desta parte. Ele está congelado em `8f5eb71` e também fixa a lista do `supabase_realtime`: **nenhuma tabela nova publicada** (D2). Se falhar, a migração mudou o que alguém vê ou faz: corrija a migração, nunca o teste. Na Entrega, `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio. O `25_painel_v2_horario.test.sql` procura `insert|update|delete` no corpo de toda função `security definer` que `authenticated` executa: **`estado_sistema_resumo` e `agente_numeros_hoje` não podem ter essas palavras no corpo** (nem em comentário dentro do corpo); `demandas_por_setor` é `security invoker`.
- **Funções novas:** `set search_path = ''`, nomes com `public.`, `revoke execute … from public, anon`, `grant execute … to authenticated`. **Nunca** use `usuario_liberado` (é só do `service_role`) em função chamada como `authenticated`; as travas são `public.eh_usuario_ativo()` (pessoa ativa dentro do horário) e `public.eh_admin()`.
- **Quem atende nunca recebe custo:** `minha-mesa.tsx`, `dados-mesa.ts` e tudo o que eles importam **não leem** `configuracoes`, `sinais_vida`, `uso_ia` nem `gastos_*`, e não importam `dados-situacao.ts` nem `gasto-do-mes.ts`. O estado do sistema vem só de `estado_sistema_resumo`. A Task 9 trava isso com teste.
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`).
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os testes do painel (e2e) deixam no banco quebram os pgTAP antigos. O reset reaplica todas as migrações, inclusive a nova.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts`.
- **E2e só contra o banco local:** `apps/painel/e2e/trava-local.ts` recusa outro banco. **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`** (só leitura, na Entrega, para o `--dry-run` e o painel do dono).
- **Esperar a hidratação nos e2e:** todo e2e novo abre o Início por `abrirInicio(page, 'situacao' | 'mesa')` (`e2e/apoio-inicio.ts`, Task 3), que espera o `data-hidratado` do "atualizado há…" (mesmo padrão do `abrirSecao` da G1: o `useEffect` marca quando o navegador assumiu). Clicar antes disso perde o clique.
- **Nenhum trabalhador é ligado nem desligado nesta parte** (G2 não muda o trabalhador). O da porta **3001 é o teste do dono: não desligue nem mate esse processo.**
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit (D20).
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[300px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind. Larguras de barra (percentuais calculados) vão em `style={{ width }}`, como nos cartões de Gastos com IA. `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`; os botões `primary/outline/danger/grafite` já são). Vermelho nunca sozinho (ícone + texto).
- **Termos (spec 3.1):** Demanda, Atendimento, Conversa, Empresa, Contato, Setor, Assumir, Concluir. "Pessoa" para usuário da equipe.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Custo vazando para quem atende** — por um cartão reaproveitado, por um leitor comum que lê `configuracoes`, ou pelo pacote RSC que o servidor manda (o navegador recebe as props dos componentes de cliente mesmo que a tela não mostre). Atendente comum **e** atendente com "Configurações: Sim" (que lê `configuracoes` pela RLS): nem o HTML nem o pacote `RSC: 1` de `/inicio` têm `US$`, `teto_ia_usd`, `total_usd`, `custo_usd` ou `cotacao`; o mesmo teste confirma que o administrador recebe `US$` (o filtro funciona). Task 9; pgTAP: nenhuma chave nem valor numérico em `estado_sistema_resumo`. Task 1.
2. **`estado_sistema_resumo` para quem não devia:** visitante (`anon`) recusado; arquivada e fora do horário recebem `null`; atendente sem permissão nenhuma lê. Task 1.
3. **Minha mesa mostrando o que a pessoa não vê:** demanda de setor alheio não entra em "Sem responsável"; "Só as minhas" vê a lista vazia; os números são iguais aos grupos. pgTAP de `demandas_por_setor` com "Do meu setor" e "Só as minhas". Tasks 1, 7 e 8.
4. **ASSUMIR/CONCLUIR sem a trava de hoje:** demanda assumida por outra pessoa entre o carregar e o clique → o aviso do banco ("A demanda já está com …") aparece e nada muda; CONCLUIR pede confirmação. Tasks 7 e 8.
5. **Papel errado na versão:** administrador sempre Painel de situação; atendente e "Configurações: Sim" sempre Minha mesa. Task 3.
6. **Tempo real "novo" por engano:** teste 22 inalterado (publicação congelada); o bloco Sistema muda sozinho em até ~75 s **sem recarregar a página** (marca no `window` sobrevive). Task 9.
7. **Cartões e tabela discordando:** a soma da coluna Abertas da tabela é o número "Demandas abertas"; Vencem hoje não conta as que já venceram hoje. Tasks 1 e 6.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261008000100_painel_v2_inicio.sql`, `supabase/tests/37_painel_v2_inicio.test.sql` (novos), `packages/db/src/tipos.gen.ts` | `estado_sistema_resumo`, `agente_numeros_hoje`, `demandas_por_setor`; tipos | 1 |
| `apps/painel/src/lib/inicio.ts` (+ `inicio.test.ts`), `apps/painel/src/lib/minha-mesa.ts` (+ `minha-mesa.test.ts`) (novo), `app/(painel)/inicio/page.tsx` (só o `parcial`) | regras puras: sem `parcial`, faixa, cabeçalho, setores, sistema, grupos, atalhos, textos | 2 |
| `inicio/{page.tsx,painel-situacao.tsx (novo, vem de page.tsx),minha-mesa.tsx (novo),dados-inicio.ts (novo),cabecalho-inicio.tsx (novo),atualizado-ha.tsx (novo),numero-inicio.tsx (novo),loading.tsx}`, `e2e/apoio-inicio.ts` (novo), `e2e/inicio-papel.spec.ts` (novo), `e2e/atendimento-lista.spec.ts` | versão pelo papel e peças comuns | 3 |
| `inicio/{dados-situacao.ts,cartao-agente.tsx,cartao-sinais.tsx,cartao-gasto.tsx}` (novos), `inicio/painel-situacao.tsx`, `e2e/inicio-situacao.spec.ts` (novo), `e2e/configuracoes.spec.ts`, `e2e/gastos-ia.spec.ts` | Situação: agente, sinais, gasto × teto | 4 |
| `inicio/{dados-situacao.ts,numeros-situacao.tsx (novo),faixa-alertas.tsx,painel-situacao.tsx}`, `e2e/inicio-situacao.spec.ts`, `e2e/inicio-vencimentos.spec.ts` | Situação: cabeçalho, faixa, 5 números | 5 |
| `inicio/{dados-inicio.ts,painel-situacao.tsx}`, `inicio/{tabela-setores.tsx,lista-esperando.tsx,lista-vencidas.tsx,lista-avisos.tsx}` (novos), `e2e/inicio-situacao.spec.ts` | Situação: por setor, esperando, vencidas, avisos | 6 |
| `inicio/{dados-mesa.ts,numeros-mesa.tsx,demandas-por-prazo.tsx,botoes-demanda-inicio.tsx (novos),minha-mesa.tsx}`, `demandas/{acoes.ts,acoes.test.ts}`, `e2e/inicio-mesa.spec.ts` (novo), `e2e/apoio-inicio.ts` | Minha mesa: números, minhas demandas, ABRIR, CONCLUIR | 7 |
| `inicio/{dados-mesa.ts,sem-responsavel-mesa.tsx,conversas-mesa.tsx,atalhos-mesa.tsx,bloco-sistema.tsx (novos),minha-mesa.tsx}`, `e2e/inicio-mesa.spec.ts` | Minha mesa: ASSUMIR, conversas, atalhos, Sistema, avisos | 8 |
| `e2e/inicio-travas.spec.ts` (novo) | sem custo para quem atende; polling | 9 |
| `e2e/acessibilidade.spec.ts`, `app/(painel)/_design/page.tsx`, `docs/design-system.md`, `docs/operacao.md` | acessibilidade e manuais | 10 |

Durante as Tasks 4 a 6 o Painel de situação ainda tem pedaços do Início de hoje: cada task troca o seu pedaço; a Task 6 termina com o arquivo final (listado inteiro). O mesmo para a Minha mesa nas Tasks 7 e 8 (arquivo final listado na 8). Todos os caminhos `inicio/…` abaixo são `apps/painel/src/app/(painel)/inicio/…`.

---

### Task 1: Banco. Estado do sistema, números do agente e demandas por setor

**Files:**
- Create: `supabase/migrations/20261008000100_painel_v2_inicio.sql`
- Create: `supabase/tests/37_painel_v2_inicio.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `configuracoes.{agente_pausado,teto_ia_usd}`, `custo_ia_periodo(timestamptz, timestamptz)` (`20260928000400`, só do dono das funções), `sinais_vida`, `eh_usuario_ativo()`, `eh_admin()` (Parte D), `mensagens.autor`, `conversa_eventos.tipo` (`assumida`, `passou_para_pessoa`, Parte E), `eh_telefone_do_assistente(text)`, `chamados.{setor_id,responsavel_id,prioridade,prazo_em,prazo_pausado_desde,status}`, `setores.{id,nome,ativo}`, RLS `leitura` de `chamados` (`pode_ver_chamado`).
- Produces:
  - `estado_sistema_resumo() returns jsonb` (**stable**, security definer): `{agente_pausado, teto_atingido, whatsapp_conectado, trabalhador_ok, verificado_em}` ou `null`;
  - `agente_numeros_hoje(p_agora timestamptz default now()) returns jsonb` (**stable**, security definer, só administrador): `{conversas, resolvidas_agente}`; recusa `'Só o administrador vê os números do agente.'`;
  - `demandas_por_setor(p_agora timestamptz default now()) returns table (setor_id uuid, setor text, abertas int, no_prazo int, vencem_hoje int, vencidas int, sem_responsavel int, urgentes int)` (**stable**, **security invoker**), setores por nome e a Triagem (`setor_id` nulo) por último.

- [ ] **Passo 0: guardar a regressão de antes**

Com o Supabase local nas portas 563xx (Restrições globais): `supabase db reset && supabase test db 2>&1 | grep -E "22_regressao|25_painel|Result" | tee "$SCRATCH/regressao-antes.txt"`.
Expected: `22_regressao_visibilidade.test.sql .. ok` (100/100), `25_painel_v2_horario.test.sql .. ok` e `Result: PASS`.

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/37_painel_v2_inicio.test.sql`:

```sql
-- Parte G2, Task 1 (spec 7C.1 e 7C.6): estado_sistema_resumo sem custos e legível por quem atende; números do agente só
-- para o administrador; demandas por setor contadas pela regra de leitura de cada pessoa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('e2000000-0000-0000-0000-00000000000a', 'admin@g2.local'), ('e2000000-0000-0000-0000-00000000000b', 'ana@g2.local'),
  ('e2000000-0000-0000-0000-00000000000c', 'arquivada@g2.local'), ('e2000000-0000-0000-0000-00000000000d', 'noite@g2.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e2000000-0000-0000-0000-00000000000a', 'Admin G2', 'admin@g2.local', 'admin'),
  ('e2000000-0000-0000-0000-00000000000b', 'Ana G2', 'ana@g2.local', 'atendente'),
  ('e2000000-0000-0000-0000-00000000000c', 'Arquivada G2', 'arquivada@g2.local', 'atendente'),
  ('e2000000-0000-0000-0000-00000000000d', 'Noite G2', 'noite@g2.local', 'atendente');
update public.usuarios set ativo = false where id = 'e2000000-0000-0000-0000-00000000000c';
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'e2000000-0000-0000-0000-00000000000d';

insert into public.setores (id, nome, ativo) values
  ('e2100000-0000-0000-0000-000000000001', 'G2 Fiscal', true), ('e2100000-0000-0000-0000-000000000002', 'G2 Pessoal', true),
  ('e2100000-0000-0000-0000-000000000003', 'G2 Desligado', false), ('e2100000-0000-0000-0000-000000000004', 'G2 Antigo', false);
insert into public.usuario_setores (usuario_id, setor_id) values ('e2000000-0000-0000-0000-00000000000b', 'e2100000-0000-0000-0000-000000000002');

-- Agente pausado, teto longe; WhatsApp com sinal há 20 s; fila sem sinal há 10 min.
update public.configuracoes set agente_pausado = true, teto_ia_usd = 500000 where id = 1;
delete from public.sinais_vida;
insert into public.sinais_vida (componente, visto_em) values ('whatsapp', now() - interval '20 seconds'), ('fila', now() - interval '10 minutes');

-- 1–8: estrutura e quem executa
select has_function('public', 'estado_sistema_resumo', 'estado existe');
select has_function('public', 'agente_numeros_hoje', 'números do agente existem');
select has_function('public', 'demandas_por_setor', 'demandas por setor existe');
select is((select provolatile::text from pg_proc where oid = 'public.estado_sistema_resumo()'::regprocedure), 's', 'estado é stable: não grava');
select ok(not (select prosecdef from pg_proc where oid = 'public.demandas_por_setor(timestamptz)'::regprocedure),
  'por setor roda com a regra de leitura de quem chama');
select ok(not has_function_privilege('anon', 'public.estado_sistema_resumo()', 'execute'), 'anon não lê o estado');
select ok(not has_function_privilege('anon', 'public.agente_numeros_hoje(timestamptz)', 'execute'), 'anon não lê os números');
select ok(not has_function_privilege('anon', 'public.demandas_por_setor(timestamptz)', 'execute'), 'anon não lê por setor');

-- 9–13: quem atende, sem permissão nenhuma, lê o estado; nenhuma chave e nenhum número de custo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.estado_sistema_resumo() $$, 'atendente lê o estado');
select is((select array_agg(k order by k) from jsonb_object_keys(public.estado_sistema_resumo()) k),
  array['agente_pausado', 'teto_atingido', 'trabalhador_ok', 'verificado_em', 'whatsapp_conectado'], 'só as cinco chaves');
select ok(not jsonb_path_exists(public.estado_sistema_resumo(), '$.* ? (@.type() == "number")'), 'nenhum número: nada de gasto, teto ou cotação');
select is(public.estado_sistema_resumo() - 'verificado_em',
  '{"agente_pausado":true,"teto_atingido":false,"whatsapp_conectado":true,"trabalhador_ok":false}'::jsonb,
  'pausado; teto longe; WhatsApp com sinal; fila parada');
reset role;
insert into public.uso_ia (modelo, tokens_entrada, tokens_saida, custo_usd, funcionalidade) values ('g2-teste', 1, 1, 600000, 'agente_clientes');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((public.estado_sistema_resumo() ->> 'teto_atingido')::boolean, true, 'gasto do mês passou do teto: só o sim, sem o valor');

-- 14–16: arquivada, fora do horário e visitante
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.estado_sistema_resumo(), null::jsonb, 'arquivada: nada');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.estado_sistema_resumo(), null::jsonb, 'fora do horário: nada');
reset role;
set local role anon;
select throws_ok($$ select public.estado_sistema_resumo() $$, '42501', null, 'visitante: recusado');
reset role;

-- Conversas de 12/03/2025 (data fixa, longe dos dados do seed): A só com o agente; B a equipe respondeu; C é da noite
-- de 11/03; D o agente passou para pessoa e ninguém pegou.
insert into public.conversas (id, telefone) values
  ('e2200000-0000-0000-0000-00000000000a', '5531970000001'), ('e2200000-0000-0000-0000-00000000000b', '5531970000002'),
  ('e2200000-0000-0000-0000-00000000000c', '5531970000003'), ('e2200000-0000-0000-0000-00000000000d', '5531970000004');
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em) values
  ('e2200000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'oi', '2025-03-12 09:00-03'),
  ('e2200000-0000-0000-0000-00000000000a', 'saida', 'agente', 'olá', '2025-03-12 09:01-03'),
  ('e2200000-0000-0000-0000-00000000000b', 'entrada', 'cliente', 'oi', '2025-03-12 10:00-03'),
  ('e2200000-0000-0000-0000-00000000000b', 'saida', 'atendente', 'pois não', '2025-03-12 10:05-03'),
  ('e2200000-0000-0000-0000-00000000000c', 'entrada', 'cliente', 'oi', '2025-03-11 23:30-03'),
  ('e2200000-0000-0000-0000-00000000000d', 'entrada', 'cliente', 'quero falar com alguém', '2025-03-12 11:00-03');
insert into public.conversa_eventos (conversa_id, tipo, criado_em) values ('e2200000-0000-0000-0000-00000000000d', 'passou_para_pessoa', '2025-03-12 11:01-03');

-- 17–19: números do agente
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.agente_numeros_hoje('2025-03-12 15:00-03') $$, 'P0001', 'Só o administrador vê os números do agente.', 'atendente: recusado');
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.agente_numeros_hoje('2025-03-12 15:00-03'), '{"conversas":3,"resolvidas_agente":1}'::jsonb,
  'A, B e D falaram hoje; só A resolvida pelo agente (B teve a equipe, D passou para pessoa)');
select is(public.agente_numeros_hoje('2025-03-12 01:00+00'), '{"conversas":1,"resolvidas_agente":1}'::jsonb,
  '01:00 UTC ainda é dia 11 em Brasília: só C');
reset role;

-- Demandas: as abertas da Triagem do seed saem da conta (a Triagem conta o banco inteiro).
update public.chamados set status = 'concluido', concluido_em = coalesce(concluido_em, now()) where setor_id is null and status <> 'concluido';
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, responsavel_id) values
  ('e2300000-0000-0000-0000-000000000001', 'e2100000-0000-0000-0000-000000000001', 'G2 vence hoje', 'urgente', '2025-03-12 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000002', 'e2100000-0000-0000-0000-000000000001', 'G2 vencida', 'normal', '2025-03-11 18:00-03', 'e2000000-0000-0000-0000-00000000000a'),
  ('e2300000-0000-0000-0000-000000000003', 'e2100000-0000-0000-0000-000000000001', 'G2 no prazo', 'normal', '2025-03-20 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000006', 'e2100000-0000-0000-0000-000000000001', 'G2 venceu de manhã', 'alta', '2025-03-12 09:00-03', null),
  ('e2300000-0000-0000-0000-000000000007', 'e2100000-0000-0000-0000-000000000002', 'G2 Pessoal vencida', 'normal', '2025-03-11 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000008', 'e2100000-0000-0000-0000-000000000004', 'G2 setor antigo', 'baixa', '2025-03-20 18:00-03', null),
  ('e2300000-0000-0000-0000-000000000009', null, 'G2 triagem', 'normal', '2025-03-20 18:00-03', null);
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, status, prazo_pausado_desde) values
  ('e2300000-0000-0000-0000-000000000004', 'e2100000-0000-0000-0000-000000000001', 'G2 com o cliente', 'normal', '2025-03-11 18:00-03',
   'aguardando_cliente', '2025-03-10 10:00-03');
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, status, concluido_em) values
  ('e2300000-0000-0000-0000-000000000005', 'e2100000-0000-0000-0000-000000000001', 'G2 concluída', 'urgente', '2025-03-11 18:00-03',
   'concluido', '2025-03-11 12:00-03');

-- 20–25: o administrador vê tudo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq(
  $$ select abertas, no_prazo, vencem_hoje, vencidas, sem_responsavel, urgentes from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Fiscal' $$,
  $$ values (5, 2, 1, 2, 4, 1) $$,
  'Fiscal: "Com o cliente" conta no prazo; a de 09:00 já venceu (não "vence hoje"); concluída fora');
select results_eq(
  $$ select abertas, no_prazo, vencem_hoje, vencidas, sem_responsavel, urgentes from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Pessoal' $$,
  $$ values (1, 0, 0, 1, 1, 0) $$, 'Pessoal: uma vencida sem responsável');
select is((select abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Antigo'), 1, 'setor desativado com aberta continua');
select is((select count(*)::int from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Desligado'), 0, 'setor desativado sem aberta sai');
select is((select t.setor from public.demandas_por_setor('2025-03-12 15:00-03') with ordinality t order by t.ordinality desc limit 1),
  'Triagem', 'Triagem por último');
select results_eq($$ select setor_id is null, abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'Triagem' $$,
  $$ values (true, 1) $$, 'Triagem: sem setor');

-- 26–29: Ana ("Do meu setor", só Pessoal) conta só o que vê
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select results_eq($$ select abertas, vencidas, sem_responsavel from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Fiscal' $$,
  $$ values (0, 0, 0) $$, 'Ana não conta o Fiscal');
select results_eq($$ select abertas, vencidas, sem_responsavel from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Pessoal' $$,
  $$ values (1, 1, 1) $$, 'Ana conta o Pessoal');
select is((select count(*)::int from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Antigo'), 0, 'setor desativado que ela não vê: fora');
select is((select abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'Triagem'), 0, 'Triagem: ela não vê');

-- 30: "Só as minhas": nem o setor dela conta
reset role;
update public.usuario_permissoes set nivel = 'minhas' where usuario_id = 'e2000000-0000-0000-0000-00000000000b' and modulo = 'demandas';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e2000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select results_eq($$ select abertas from public.demandas_por_setor('2025-03-12 15:00-03') where setor = 'G2 Pessoal' $$,
  $$ values (0) $$, '"Só as minhas": nada sem responsável no setor');
reset role;

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db --file supabase/tests/37_painel_v2_inicio.test.sql` (se a CLI não aceitar `--file`, `supabase test db` e olhe a linha do 37).
Expected: FAIL — `has_function` falso / `function public.estado_sistema_resumo() does not exist`.

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261008000100_painel_v2_inicio.sql`:

```sql
-- supabase/migrations/20261008000100_painel_v2_inicio.sql
-- Painel v2, Parte G2 (spec 7C.1): três leituras para o Início. Nenhuma grava e nenhuma entra no Realtime (o teste 22
-- congela a publicação; o Início relê por polling, D2).
--   estado_sistema_resumo: agente, teto, WhatsApp e trabalhador para qualquer pessoa ativa, só sim/não (D3);
--   agente_numeros_hoje: os números do dia do agente, só para o administrador (D7);
--   demandas_por_setor: as abertas por setor pela regra de leitura de quem chama (security invoker, D5).

create function public.estado_sistema_resumo() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_mes timestamp := date_trunc('month', now() at time zone 'America/Sao_Paulo');
  v_limite timestamptz := now() - interval '5 minutes';
begin
  -- Arquivada ou fora do horário: nada, como limites_espera (o painel mostra "indisponível").
  if not public.eh_usuario_ativo() then return null; end if;
  return (
    select jsonb_build_object(
      'agente_pausado', c.agente_pausado,
      -- A mesma conta do trabalhador (custo do mês de Brasília >= teto): só o sim ou não sai daqui.
      'teto_atingido', public.custo_ia_periodo(v_mes at time zone 'America/Sao_Paulo',
                                               (v_mes + interval '1 month') at time zone 'America/Sao_Paulo') >= c.teto_ia_usd,
      'whatsapp_conectado', coalesce((select s.visto_em > v_limite from public.sinais_vida s where s.componente = 'whatsapp'), false),
      'trabalhador_ok', coalesce((select s.visto_em > v_limite from public.sinais_vida s where s.componente = 'fila'), false),
      'verificado_em', now())
    from public.configuracoes c where c.id = 1);
end $$;
revoke execute on function public.estado_sistema_resumo() from public, anon;
grant execute on function public.estado_sistema_resumo() to authenticated;

create function public.agente_numeros_hoje(p_agora timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_de timestamptz := ((p_agora at time zone 'America/Sao_Paulo')::date)::timestamp at time zone 'America/Sao_Paulo';
  v_ate timestamptz := v_de + interval '1 day';
  r jsonb;
begin
  if not public.eh_admin() then raise exception 'Só o administrador vê os números do agente.'; end if;
  -- Conversas com mensagem do cliente no dia; resolvida pelo agente = ninguém da equipe respondeu nem assumiu e o
  -- agente não passou para pessoa no dia (D7).
  with hoje as (
    select distinct m.conversa_id
    from public.mensagens m join public.conversas c on c.id = m.conversa_id
    where m.autor = 'cliente' and m.criado_em >= v_de and m.criado_em < v_ate
      and not public.eh_telefone_do_assistente(c.telefone)
  ), com_pessoa as (
    select h.conversa_id,
           exists (select 1 from public.mensagens m where m.conversa_id = h.conversa_id and m.autor = 'atendente'
                     and m.criado_em >= v_de and m.criado_em < v_ate)
           or exists (select 1 from public.conversa_eventos e where e.conversa_id = h.conversa_id
                        and e.tipo in ('assumida', 'passou_para_pessoa') and e.criado_em >= v_de and e.criado_em < v_ate) as pessoa
    from hoje h
  )
  select jsonb_build_object('conversas', count(*), 'resolvidas_agente', count(*) filter (where not p.pessoa))
    into r from com_pessoa p;
  return r;
end $$;
revoke execute on function public.agente_numeros_hoje(timestamptz) from public, anon;
grant execute on function public.agente_numeros_hoje(timestamptz) to authenticated;

-- security invoker: cada pessoa conta só as demandas que a RLS de chamados libera para ela.
create function public.demandas_por_setor(p_agora timestamptz default now())
returns table (setor_id uuid, setor text, abertas int, no_prazo int, vencem_hoje int, vencidas int, sem_responsavel int, urgentes int)
language sql stable security invoker set search_path = '' as $$
  with abertas as (
    select c.setor_id as sid, true as conta, c.responsavel_id is null as sem_resp, c.prioridade = 'urgente' as urgente,
           coalesce(c.prazo_pausado_desde is null and c.prazo_em < p_agora, false) as vencida,
           coalesce(c.prazo_pausado_desde is null and c.prazo_em >= p_agora
                    and (c.prazo_em at time zone 'America/Sao_Paulo')::date = (p_agora at time zone 'America/Sao_Paulo')::date, false) as hoje
    from public.chamados c
    where c.status <> 'concluido'
  ), grupos as (
    select s.id as sid, s.nome, 0 as ordem from public.setores s
    where s.ativo or exists (select 1 from abertas a where a.sid = s.id)
    union all
    select null::uuid, 'Triagem', 1
  )
  select g.sid, g.nome,
         count(a.conta)::int,
         count(a.conta) filter (where not a.vencida and not a.hoje)::int,
         count(a.conta) filter (where a.hoje)::int,
         count(a.conta) filter (where a.vencida)::int,
         count(a.conta) filter (where a.sem_resp)::int,
         count(a.conta) filter (where a.urgente)::int
  from grupos g left join abertas a on a.sid is not distinct from g.sid
  group by g.sid, g.nome, g.ordem
  order by g.ordem, g.nome
$$;
revoke execute on function public.demandas_por_setor(timestamptz) from public, anon;
grant execute on function public.demandas_por_setor(timestamptz) to authenticated;
```

(Confira antes com `grep -n "custo_ia_periodo" supabase/migrations/*.sql` que a assinatura é `(timestamptz, timestamptz) returns numeric` e com `grep -n "'passou_para_pessoa'" supabase/migrations/20261005000200_painel_v2_espera.sql` que o tipo existe. O corpo das duas `security definer` não pode ter as palavras `insert`, `update` nem `delete` — teste 25.)

- [ ] **Passo 4: rodar, regerar os tipos e conferir**

Run: `supabase db reset && supabase test db && pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: `37_painel_v2_inicio` 30/30; `22_regressao_visibilidade` 100/100 (igual a `$SCRATCH/regressao-antes.txt`); `25_painel_v2_horario` passa; `Result: PASS`; `git diff --stat packages/db/src/tipos.gen.ts` mostra `estado_sistema_resumo`, `agente_numeros_hoje` e `demandas_por_setor`; os três typecheck verdes.

- [ ] **Passo 5: commit**

```bash
git add supabase/migrations/20261008000100_painel_v2_inicio.sql supabase/tests/37_painel_v2_inicio.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): estado do sistema sem custos para toda a equipe, números do agente e demandas por setor para o Início

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Painel. Regras puras do Início e da Minha mesa

**Files:**
- Modify: `apps/painel/src/lib/inicio.ts`, `apps/painel/src/lib/inicio.test.ts`
- Create: `apps/painel/src/lib/minha-mesa.ts`, `apps/painel/src/lib/minha-mesa.test.ts`
- Modify: `apps/painel/src/app/(painel)/inicio/page.tsx` (só tirar o `parcial`)

**Interfaces:**
- Consumes: `FUSO`, `formatarUSD`, `tempoRelativo` (`lib/formatos.ts`); `situacaoDoSinal` (`lib/sinal-vida.ts`); `minutosDeEspera`, `textoEspera` (`lib/atendimento.ts`); `descreverPrazo`, `horaCurta` (`lib/prazo.ts`); `ROTULO_STATUS`, `Prioridade`, `StatusFiltro` (`lib/demandas.ts`); `temNivel`, `usaAssistente` (`lib/permissoes.ts`); `hrefSecao` (`lib/configuracoes.ts`).
- Produces (`lib/inicio.ts`): `GastoDoMes = { total }` (sem `parcial`, D25); `AlertaFaixa.link`; fila atrasada na faixa (D10); `dataDoTitulo`, `saudacao`, `primeiroNome`, `juntarNomes`, `capitalizar`, `textoAtualizado`, `diaSP`, `diasDoMes`; `LinhaSetor`, `lerLinhasSetor`, `totaisDosSetores`, `separarSetores`, `textoSemAbertas`, `barraDoSetor`, `hrefDoSetor`; `detalheEsperando`, `detalheVencemHoje`, `detalheMaisAtrasada`; `EstadoSistema`, `lerEstadoSistema`, `LinhaSistema`, `linhasDoSistema`.
- Produces (`lib/minha-mesa.ts`): `DemandaMesa`, `lerDemandasMesa`, `agruparPorPrazo`, `detalheDaDemanda`, `Atalho`, `atalhosDaMesa`, `ROTULOS_MESA`, `textoConcluidasHoje`, `textoComAgenteHoje`, `subtituloMinhas`.

- [ ] **Passo 1: escrever os testes que falham**

Em `apps/painel/src/lib/inicio.test.ts`:
1. Nas três expectativas de `lerGastoIaDoMes`, troque `{ total: 41.2, parcial: false }` por `{ total: 41.2 }` e `{ total: 12.5, parcial: false }` por `{ total: 12.5 }`.
2. Troque a linha de import por:

```ts
import {
  alertasDaFaixa, barraDoSetor, capitalizar, dataDoTitulo, detalheEsperando, detalheMaisAtrasada, detalheVencemHoje, diasDoMes, diaSP,
  hrefDoSetor, juntarNomes, lerEstadoSistema, lerGastoIaDoMes, lerLinhasSetor, lerSinaisVida, linhasDoSistema, mesCorrenteSP, primeiroNome,
  saudacao, separarSetores, situacaoTeto, textoAtualizado, textoSemAbertas, totaisDosSetores,
} from './inicio';
```

3. Acrescente no fim:

```ts
describe('faixa: fila atrasada e links (D10)', () => {
  const agora = new Date('2026-09-30T12:00:00Z');
  const ha = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();
  it('fila atrasada (3 a 5 min): aviso âmbar com o tempo e o link para os sinais', () => {
    const [a] = alertasDaFaixa({ teto: null, sinais: { fila: ha(200), whatsapp: ha(30), ultimo: ha(30) }, agora });
    expect(a).toMatchObject({ id: 'fila', nivel: 'atencao', titulo: 'Fila de tarefas sem batimento há 3 min', link: { href: '#sinais-de-vida', rotulo: 'Ver sinais de vida' } });
    expect(a!.texto).toContain('Se passar de 5 min, vira alerta crítico.');
  });
  it('fila atrasada e WhatsApp parado: os dois', () => {
    expect(alertasDaFaixa({ teto: null, sinais: { fila: ha(200), whatsapp: ha(400), ultimo: ha(200) }, agora }).map((a) => a.id)).toEqual(['fila', 'whatsapp']);
  });
  it('teto leva a Gastos com IA', () => {
    expect(alertasDaFaixa({ teto: situacaoTeto(50, 50), sinais: null, agora })[0]!.link).toEqual({ href: '/gastos-ia', rotulo: 'Ver Gastos com IA' });
  });
});

describe('cabeçalho (D23)', () => {
  it('dia da semana e data de Brasília, sem "-feira"', () => {
    expect(dataDoTitulo(new Date('2026-10-01T15:00:00Z'))).toBe('quinta, 01/10');
    expect(dataDoTitulo(new Date('2026-10-02T02:00:00Z'))).toBe('quinta, 01/10'); // 23:00 de 01/10 em Brasília
    expect(dataDoTitulo(new Date('2026-10-03T12:00:00Z'))).toBe('sábado, 03/10');
    expect(capitalizar('quinta, 01/10')).toBe('Quinta, 01/10');
  });
  it('saudação pela hora de Brasília', () => {
    expect(saudacao(new Date('2026-10-01T08:00:00Z'))).toBe('Bom dia');    // 05:00
    expect(saudacao(new Date('2026-10-01T14:59:00Z'))).toBe('Bom dia');    // 11:59
    expect(saudacao(new Date('2026-10-01T15:00:00Z'))).toBe('Boa tarde');  // 12:00
    expect(saudacao(new Date('2026-10-01T21:30:00Z'))).toBe('Boa noite');  // 18:30
    expect(saudacao(new Date('2026-10-01T06:00:00Z'))).toBe('Boa noite');  // 03:00
  });
  it('primeiro nome, nomes juntos e "atualizado há"', () => {
    expect(primeiroNome('  Ana Souza Lima ')).toBe('Ana');
    expect(juntarNomes([])).toBe('');
    expect(juntarNomes(['Fiscal'])).toBe('Fiscal');
    expect(juntarNomes(['Pessoal', 'Fiscal'])).toBe('Pessoal e Fiscal');
    expect(juntarNomes(['Comercial', 'Direção', 'IRPF'])).toBe('Comercial, Direção e IRPF');
    expect(textoAtualizado(2)).toBe('agora');
    expect(textoAtualizado(12.7)).toBe('há 12 s');
    expect(textoAtualizado(185)).toBe('há 3 min');
  });
  it('dia e mês de Brasília', () => {
    expect(diaSP(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09-30');
    expect(diasDoMes(new Date('2026-10-15T12:00:00Z'))).toEqual({ primeiro: '01/10', ultimo: '31/10' });
    expect(diasDoMes(new Date('2027-02-10T12:00:00Z'))).toEqual({ primeiro: '01/02', ultimo: '28/02' });
  });
});

describe('demandas por setor (D5)', () => {
  const bruto = [
    { setor_id: 's1', setor: 'Fiscal', abertas: 9, no_prazo: 5, vencem_hoje: 3, vencidas: 1, sem_responsavel: 2, urgentes: 1 },
    { setor_id: 's2', setor: 'Comercial', abertas: 0, no_prazo: 0, vencem_hoje: 0, vencidas: 0, sem_responsavel: 0, urgentes: 0 },
    { setor_id: 's3', setor: 'Direção', abertas: '0', no_prazo: 0, vencem_hoje: 0, vencidas: 0, sem_responsavel: 0, urgentes: 0 },
    { setor_id: null, setor: 'Triagem', abertas: 2, no_prazo: 2, vencem_hoje: 0, vencidas: 0, sem_responsavel: 1, urgentes: 0 },
  ];
  it('lê, soma e separa os setores sem abertas', () => {
    const linhas = lerLinhasSetor(bruto);
    expect(linhas[0]).toEqual({ setorId: 's1', setor: 'Fiscal', abertas: 9, noPrazo: 5, vencemHoje: 3, vencidas: 1, semResponsavel: 2, urgentes: 1 });
    expect(totaisDosSetores(linhas)).toEqual({ abertas: 11, vencemHoje: 3, vencidas: 1, semResponsavel: 3, urgentes: 1 });
    const { visiveis, semAbertas } = separarSetores(linhas);
    expect(visiveis.map((l) => l.setor)).toEqual(['Fiscal', 'Triagem']);
    expect(semAbertas).toEqual(['Comercial', 'Direção']);
    expect(textoSemAbertas(semAbertas)).toBe('Comercial e Direção sem demandas abertas');
    expect(textoSemAbertas([])).toBeNull();
    expect(lerLinhasSetor(null)).toEqual([]);
  });
  it('barra proporcional ao maior setor, com o texto para o leitor de tela', () => {
    const [fiscal, , , triagem] = lerLinhasSetor(bruto);
    expect(barraDoSetor(fiscal!, 9)).toEqual({ noPrazo: 55.6, venceHoje: 33.3, vencida: 11.1, rotulo: '1 vencida, 3 vencem hoje, 5 no prazo' });
    expect(barraDoSetor(triagem!, 9)).toEqual({ noPrazo: 22.2, venceHoje: 0, vencida: 0, rotulo: '2 no prazo' });
    expect(hrefDoSetor('s1')).toBe('/demandas?setor=s1');
    expect(hrefDoSetor(null)).toBe('/demandas?setor=triagem');
  });
});

describe('detalhes dos números', () => {
  const agora = new Date('2026-10-01T15:00:00Z'); // 12:00 em Brasília
  it('esperando, vencem hoje e mais atrasada', () => {
    expect(detalheEsperando(new Date(agora.getTime() - 18 * 60_000).toISOString(), agora)).toBe('a mais antiga há 18 min');
    expect(detalheEsperando(new Date(agora.getTime() - 20_000).toISOString(), agora)).toBe('a mais antiga chegou agora');
    expect(detalheEsperando(null, agora)).toBe('ninguém esperando');
    expect(detalheVencemHoje([
      { prioridade: 'urgente', prazo_em: '2026-10-01T20:00:00Z' }, { prioridade: 'urgente', prazo_em: '2026-10-01T21:00:00Z' },
      { prioridade: 'normal', prazo_em: '2026-10-01T18:00:00Z' },
    ])).toBe('2 urgentes · até 18h');
    expect(detalheVencemHoje([{ prioridade: 'normal', prazo_em: '2026-10-01T18:30:00Z' }])).toBe('até 15h30');
    expect(detalheVencemHoje([])).toBeNull();
    expect(detalheMaisAtrasada('2026-09-29T21:00:00Z', agora)).toBe('mais atrasada: venceu 29/09');
    expect(detalheMaisAtrasada(null, agora)).toBeNull();
  });
});

describe('estado do sistema (D3, D18)', () => {
  const ok = { agente_pausado: false, teto_atingido: false, whatsapp_conectado: true, trabalhador_ok: true, verificado_em: '2026-10-01T15:00:00Z' };
  it('lê só booleanos; qualquer outra coisa é indisponível', () => {
    expect(lerEstadoSistema(ok)).toEqual({ agentePausado: false, tetoAtingido: false, whatsappConectado: true, trabalhadorOk: true });
    expect(lerEstadoSistema(null)).toBeNull();
    expect(lerEstadoSistema({ ...ok, teto_atingido: 'sim' })).toBeNull();
  });
  it('linhas do bloco Sistema, sem valores', () => {
    expect(linhasDoSistema(lerEstadoSistema(ok)!)).toEqual([
      { id: 'agente', rotulo: 'Agente', valor: 'atendendo', tom: 'ok' },
      { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'conectado', tom: 'ok' },
    ]);
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, agente_pausado: true })!)[0]).toMatchObject({ valor: 'pausado', tom: 'perigo' });
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, teto_atingido: true })!)[0]).toMatchObject({ valor: 'pausado: limite de IA do mês', tom: 'perigo' });
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, whatsapp_conectado: false })!)[1]).toMatchObject({ valor: 'sem sinal', tom: 'perigo' });
    expect(linhasDoSistema(lerEstadoSistema({ ...ok, trabalhador_ok: false, whatsapp_conectado: false })!)).toEqual([
      { id: 'agente', rotulo: 'Agente', valor: 'atendendo', tom: 'ok' },
      { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'sem confirmação', tom: 'atencao' },
      { id: 'fila', rotulo: 'Mensagens', valor: 'paradas: avise o administrador', tom: 'perigo' },
    ]);
  });
});
```

`apps/painel/src/lib/minha-mesa.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerNiveis } from '@escritorio/core';
import {
  agruparPorPrazo, atalhosDaMesa, detalheDaDemanda, lerDemandasMesa, ROTULOS_MESA, subtituloMinhas, textoComAgenteHoje, textoConcluidasHoje,
} from './minha-mesa';

const agora = new Date('2026-10-01T15:00:00Z'); // quinta, 12:00 em Brasília
const d = (numero: number, extra: Record<string, unknown>) => ({
  id: `id-${numero}`, numero, titulo: `D${numero}`, empresa: 'Mercado Central', setor: 'Fiscal', status: 'em_andamento',
  prioridade: 'normal', prazo_em: null, prazo_pausado_desde: null, vencida: false, ...extra,
});

describe('Minhas demandas por prazo (D11)', () => {
  it('lê as linhas da visão (números e booleanos do PostgREST)', () => {
    expect(lerDemandasMesa([{ ...d(1, {}), numero: '1031', vencida: null }])[0]).toMatchObject({ numero: 1031, vencida: false });
    expect(lerDemandasMesa(null)).toEqual([]);
  });
  it('Vencida · Vencem hoje · Próximos dias; pausada e sem prazo vão para Próximos dias', () => {
    const lista = lerDemandasMesa([
      d(1, { vencida: true, prazo_em: '2026-09-30T21:00:00Z' }),
      d(2, { prazo_em: '2026-10-01T20:00:00Z' }),                                                    // hoje 17h
      d(3, { prazo_em: '2026-10-01T13:00:00Z', vencida: true }),                                    // hoje 10h, já venceu
      d(4, { prazo_em: '2026-09-30T21:00:00Z', status: 'aguardando_cliente', prazo_pausado_desde: '2026-09-29T12:00:00Z' }),
      d(5, { prazo_em: '2026-10-05T21:00:00Z' }),
      d(6, {}),
    ]);
    const g = agruparPorPrazo(lista, agora);
    expect(g.vencidas.map((x) => x.numero)).toEqual([1, 3]);
    expect(g.hoje.map((x) => x.numero)).toEqual([2]);
    expect(g.proximos.map((x) => x.numero)).toEqual([4, 5, 6]);
  });
  it('linha: empresa, setor e status com nome da tela', () => {
    expect(detalheDaDemanda({ empresa: 'Rede Bom Preço', setor: 'Fiscal', status: 'em_andamento' })).toEqual(['Rede Bom Preço', 'Fiscal', 'resolvendo']);
    expect(detalheDaDemanda({ empresa: null, setor: null, status: 'aguardando_cliente' })).toEqual(['sem empresa', 'Triagem', 'com o cliente']);
    expect(detalheDaDemanda({ empresa: 'X', setor: 'Pessoal', status: 'aberto' })[2]).toBe('nova');
  });
});

describe('textos', () => {
  it('singular e plural', () => {
    expect(ROTULOS_MESA.esperando(1)).toBe('conversa esperando você');
    expect(ROTULOS_MESA.esperando(2)).toBe('conversas esperando você');
    expect(ROTULOS_MESA.vencidas(1)).toBe('minha demanda vencida');
    expect(ROTULOS_MESA.vencidas(0)).toBe('minhas demandas vencidas');
    expect(ROTULOS_MESA.hoje(1)).toBe('vence hoje');
    expect(ROTULOS_MESA.hoje(3)).toBe('vencem hoje');
    expect(ROTULOS_MESA.semResponsavel(3)).toBe('sem responsável nos meus setores');
    expect(textoConcluidasHoje(0)).toBe('Você ainda não concluiu demandas hoje.');
    expect(textoConcluidasHoje(1)).toBe('Você concluiu 1 demanda hoje.');
    expect(textoConcluidasHoje(4)).toBe('Você concluiu 4 demandas hoje.');
    expect(textoComAgenteHoje(0)).toBe('nenhuma com o agente hoje');
    expect(textoComAgenteHoje(12)).toBe('12 com o agente hoje');
    expect(subtituloMinhas(8)).toBe('8 comigo · ordenadas pelo que vence primeiro');
  });
});

describe('atalhos pela permissão (D17)', () => {
  const pessoa = (niveis: Record<string, string>) => ({ papel: 'atendente' as const, niveis: lerNiveis(niveis) });
  it('sem nada além do padrão: nada que leve a "sem acesso"', () => {
    const r = atalhosDaMesa(pessoa({ notas: 'sem_acesso', assistente: 'sem_acesso', configuracoes: 'nao' })).map((a) => a.rotulo);
    expect(r).toEqual(['Nova demanda', 'Buscar empresa', 'Contatos']);
  });
  it('com assistente, pedidos de nota e Configurações: os seis', () => {
    const r = atalhosDaMesa(pessoa({ notas: 'ver', assistente: 'site', configuracoes: 'sim' }));
    expect(r.map((a) => a.rotulo)).toEqual(['Nova demanda', 'Buscar empresa', 'Respostas prontas', 'Assistente', 'Pedidos de nota', 'Contatos']);
    expect(r.find((a) => a.rotulo === 'Respostas prontas')!.href).toBe('/configuracoes?secao=respostas');
    expect(r.find((a) => a.rotulo === 'Pedidos de nota')!.href).toBe('/demandas?tipo=venda');
  });
});
```

(Confira com `grep -n "export function lerNiveis" packages/core/src/permissoes.ts` que `lerNiveis` aceita um objeto parcial e completa com os padrões; se a assinatura for outra, monte `niveis` com `nivelPadrao` como em `apps/painel/src/lib/permissoes.test.ts`.)

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/inicio.test.ts src/lib/minha-mesa.test.ts`
Expected: FAIL (funções não exportadas; `parcial` ainda presente).

- [ ] **Passo 2: implementar `lib/inicio.ts`**

1. Troque o cabeçalho do arquivo (comentário e imports) por:

```ts
// Leituras e regras do Início (spec 7C.1): sinais de vida, gasto de IA do mês vs. teto, faixa de alertas, cabeçalho,
// demandas por setor e o estado do sistema. Gasto, sinais e configuracoes só o administrador lê (banco e RLS); quem
// atende lê só estado_sistema_resumo (sem custos, D3).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@escritorio/db';
import { minutosDeEspera, textoEspera } from './atendimento';
import { FUSO, formatarUSD, tempoRelativo } from './formatos';
import { descreverPrazo, horaCurta } from './prazo';
import { situacaoDoSinal, type LimitesSinal } from './sinal-vida';
```

2. Troque `GastoDoMes` e `lerGastoIaDoMes` por:

```ts
export type GastoDoMes = { total: number };

/** Gasto de IA do mês corrente (Brasília) pela gastos_resumo (só o administrador; os outros recebem null). */
export async function lerGastoIaDoMes(sb: Cliente, agora: Date): Promise<GastoDoMes | null> {
  const { inicio, fim } = mesCorrenteSP(agora);
  const { data, error } = await sb.rpc('gastos_resumo', { p_de: inicio, p_ate: fim });
  if (error || !data) return null;
  return { total: Number((data as { total_usd: number }).total_usd) || 0 };
}
```

3. Troque `AlertaFaixa` e `alertasDaFaixa` por:

```ts
export type AlertaFaixa = {
  id: 'teto' | 'fila' | 'whatsapp'; nivel: 'perigo' | 'atencao'; titulo: string; texto: string; link: { href: string; rotulo: string };
};

const LINK_GASTOS = { href: '/gastos-ia', rotulo: 'Ver Gastos com IA' };
const LINK_SINAIS = { href: '#sinais-de-vida', rotulo: 'Ver sinais de vida' };

/**
 * Faixa do topo do Início: só o que está errado agora. Fila parada (o trabalhador não bate) esconde o aviso do
 * WhatsApp, porque o sinal do WhatsApp também vem do batimento. Fila atrasada é âmbar (D10).
 */
export function alertasDaFaixa({ teto, sinais, agora }: { teto: SituacaoTeto | null; sinais: SinaisVida | null; agora: Date }): AlertaFaixa[] {
  const lista: AlertaFaixa[] = [];
  if (teto?.nivel === 'atingido') {
    lista.push({
      id: 'teto', nivel: 'perigo', titulo: 'Teto de gasto com IA atingido', link: LINK_GASTOS,
      texto: `O gasto do mês chegou a ${formatarUSD(teto.gasto)} de ${formatarUSD(teto.teto)}. O agente e o assistente não respondem: as mensagens dos clientes vão para a equipe até o mês virar ou o teto subir.`,
    });
  } else if (teto?.nivel === 'perto') {
    lista.push({
      id: 'teto', nivel: 'atencao', titulo: 'Gasto com IA perto do teto', link: LINK_GASTOS,
      texto: `${Math.floor(teto.fracao * 100)}% do teto do mês (${formatarUSD(teto.gasto)} de ${formatarUSD(teto.teto)}). Ao chegar a 100%, o agente e o assistente param de responder.`,
    });
  }
  if (sinais) {
    const fila = situacaoDoSinal(sinais.fila, agora, LIMITES_BATIMENTO);
    const whatsapp = situacaoDoSinal(sinais.whatsapp, agora, LIMITES_BATIMENTO);
    if (fila === 'parado' || fila === 'sem_sinal') {
      lista.push({
        id: 'fila', nivel: 'perigo', titulo: 'Fila de tarefas parada', link: LINK_SINAIS,
        texto: 'O trabalhador não dá sinal: mensagens novas não são processadas nem enviadas. Verifique se o trabalhador está rodando.',
      });
      return lista;
    }
    if (fila === 'atrasado') {
      lista.push({
        id: 'fila', nivel: 'atencao', titulo: `Fila de tarefas sem batimento ${tempoRelativo(sinais.fila!, agora)}`, link: LINK_SINAIS,
        texto: 'As mensagens chegam, mas o agente pode demorar a responder. Se passar de 5 min, vira alerta crítico.',
      });
    }
    if (whatsapp === 'parado' || whatsapp === 'sem_sinal') {
      // Não afirma "desconectado": o sinal também some se o batimento falhar antes de consultar a Z-API.
      const quando = sinais.whatsapp ? tempoRelativo(sinais.whatsapp, agora) : '';
      lista.push({
        id: 'whatsapp', nivel: 'perigo', titulo: quando ? `Sem sinal do WhatsApp ${quando}` : 'Sem sinal do WhatsApp', link: LINK_SINAIS,
        texto: 'A fila bate, mas a conexão com a Z-API não foi confirmada. Confira no painel da Z-API se o número está conectado (se não estiver, leia o QR code de novo com o celular do escritório) e, se estiver, os registros do trabalhador.',
      });
    }
  }
  return lista;
}
```

4. Acrescente no fim do arquivo:

```ts
// ---------- Cabeçalho (D23) ----------

const SEMANA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long' });
const DIA_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const HORA = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' });
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "quinta, 02/10" (Brasília). */
export function dataDoTitulo(agora: Date): string {
  return `${SEMANA.format(agora).replace('-feira', '')}, ${DIA_MES.format(agora)}`;
}

export const capitalizar = (t: string): string => (t ? t[0]!.toLocaleUpperCase('pt-BR') + t.slice(1) : t);

/** 05h–11h Bom dia, 12h–17h Boa tarde, 18h–04h Boa noite, pela hora de Brasília. */
export function saudacao(agora: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = Number(HORA.format(agora)) % 24;
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const primeiroNome = (nome: string): string => nome.trim().split(/\s+/)[0] ?? nome;

/** ["Pessoal", "Fiscal"] → "Pessoal e Fiscal"; três ou mais: "A, B e C". */
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/** O "atualizado …" do topo: "agora", "há 12 s", "há 3 min". */
export function textoAtualizado(segundos: number): string {
  if (segundos < 5) return 'agora';
  if (segundos < 60) return `há ${Math.floor(segundos)} s`;
  return `há ${Math.floor(segundos / 60)} min`;
}

/** "2026-10-01": o dia de Brasília (feriados, "hoje"). */
export const diaSP = (agora: Date): string => DIA.format(agora);

/** Primeiro e último dia do mês de Brasília, para as pontas da barra do teto ("01/10" … "31/10"). */
export function diasDoMes(agora: Date): { primeiro: string; ultimo: string } {
  const [ano, mes] = diaSP(agora).split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { primeiro: `01/${mm}`, ultimo: `${String(ultimo).padStart(2, '0')}/${mm}` };
}

// ---------- Demandas por setor (D5) ----------

export type LinhaSetor = {
  setorId: string | null; setor: string; abertas: number; noPrazo: number; vencemHoje: number; vencidas: number; semResponsavel: number; urgentes: number;
};

const numero = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** Linhas de demandas_por_setor (o PostgREST pode mandar número como texto). */
export function lerLinhasSetor(bruto: unknown): LinhaSetor[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.map((r: Record<string, unknown>) => ({
    setorId: typeof r.setor_id === 'string' ? r.setor_id : null, setor: String(r.setor ?? ''),
    abertas: numero(r.abertas), noPrazo: numero(r.no_prazo), vencemHoje: numero(r.vencem_hoje), vencidas: numero(r.vencidas),
    semResponsavel: numero(r.sem_responsavel), urgentes: numero(r.urgentes),
  }));
}

export type TotaisSetores = { abertas: number; vencemHoje: number; vencidas: number; semResponsavel: number; urgentes: number };

/** Os números do topo são a soma da tabela: cartões e tabela sempre batem (D5). */
export function totaisDosSetores(linhas: LinhaSetor[]): TotaisSetores {
  return linhas.reduce((t, l) => ({
    abertas: t.abertas + l.abertas, vencemHoje: t.vencemHoje + l.vencemHoje, vencidas: t.vencidas + l.vencidas,
    semResponsavel: t.semResponsavel + l.semResponsavel, urgentes: t.urgentes + l.urgentes,
  }), { abertas: 0, vencemHoje: 0, vencidas: 0, semResponsavel: 0, urgentes: 0 });
}

/** Linhas com abertas (a Triagem só com abertas) e os setores sem nenhuma, para a nota embaixo da tabela. */
export function separarSetores(linhas: LinhaSetor[]): { visiveis: LinhaSetor[]; semAbertas: string[] } {
  return {
    visiveis: linhas.filter((l) => l.abertas > 0),
    semAbertas: linhas.filter((l) => l.setorId !== null && l.abertas === 0).map((l) => l.setor),
  };
}

export const textoSemAbertas = (nomes: string[]): string | null => (nomes.length ? `${juntarNomes(nomes)} sem demandas abertas` : null);

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type BarraSetor = { noPrazo: number; venceHoje: number; vencida: number; rotulo: string };

/** Barra "situação": larguras em % do maior setor e a frase que o leitor de tela lê (a cor nunca fala sozinha). */
export function barraDoSetor(l: LinhaSetor, maior: number): BarraSetor {
  const pct = (v: number) => (maior > 0 ? Math.round((v / maior) * 1000) / 10 : 0);
  const partes = [
    l.vencidas > 0 && plural(l.vencidas, 'vencida', 'vencidas'),
    l.vencemHoje > 0 && `${l.vencemHoje} ${l.vencemHoje === 1 ? 'vence' : 'vencem'} hoje`,
    l.noPrazo > 0 && `${l.noPrazo} no prazo`,
  ].filter(Boolean);
  return { noPrazo: pct(l.noPrazo), venceHoje: pct(l.vencemHoje), vencida: pct(l.vencidas), rotulo: partes.join(', ') || 'nenhuma aberta' };
}

export const hrefDoSetor = (setorId: string | null): string => `/demandas?setor=${setorId ?? 'triagem'}`;

// ---------- Detalhes dos números ----------

/** "a mais antiga há 18 min" (a lista vem ordenada por quem espera há mais tempo). */
export function detalheEsperando(maisAntiga: string | null, agora: Date): string {
  if (!maisAntiga) return 'ninguém esperando';
  const min = minutosDeEspera(maisAntiga, agora.getTime());
  return min < 1 ? 'a mais antiga chegou agora' : `a mais antiga há ${textoEspera(min)}`;
}

/** "2 urgentes · até 18h": das que vencem hoje (ainda no prazo). */
export function detalheVencemHoje(lista: { prioridade: string | null; prazo_em: string | null }[]): string | null {
  if (lista.length === 0) return null;
  const urgentes = lista.filter((d) => d.prioridade === 'urgente').length;
  const ultimo = lista.reduce<Date | null>((m, d) => {
    if (!d.prazo_em) return m;
    const x = new Date(d.prazo_em);
    return !m || x > m ? x : m;
  }, null);
  const partes = [urgentes > 0 && plural(urgentes, 'urgente', 'urgentes'), ultimo && `até ${horaCurta(ultimo)}`].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

/** "mais atrasada: venceu 01/10" (D9). */
export function detalheMaisAtrasada(prazo: string | null, agora: Date): string | null {
  if (!prazo) return null;
  return `mais atrasada: ${descreverPrazo({ prazo, pausadoDesde: null, concluidaEm: null }, agora).texto}`;
}

// ---------- Estado do sistema para quem atende (D3, D18) ----------

export type EstadoSistema = { agentePausado: boolean; tetoAtingido: boolean; whatsappConectado: boolean; trabalhadorOk: boolean };

/** estado_sistema_resumo(): só booleanos; qualquer outra coisa (ou null: arquivada, fora do horário, sem migração) é indisponível. */
export function lerEstadoSistema(bruto: unknown): EstadoSistema | null {
  const o = bruto as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const chaves = ['agente_pausado', 'teto_atingido', 'whatsapp_conectado', 'trabalhador_ok'] as const;
  if (!chaves.every((k) => typeof o[k] === 'boolean')) return null;
  return {
    agentePausado: o.agente_pausado as boolean, tetoAtingido: o.teto_atingido as boolean,
    whatsappConectado: o.whatsapp_conectado as boolean, trabalhadorOk: o.trabalhador_ok as boolean,
  };
}

export type LinhaSistema = { id: 'agente' | 'whatsapp' | 'fila'; rotulo: string; valor: string; tom: 'ok' | 'atencao' | 'perigo' };

/** O bloco Sistema da Minha mesa: nunca valores, só o que a pessoa precisa saber para atender (D18). */
export function linhasDoSistema(e: EstadoSistema): LinhaSistema[] {
  const agente: LinhaSistema = e.agentePausado
    ? { id: 'agente', rotulo: 'Agente', valor: 'pausado', tom: 'perigo' }
    : e.tetoAtingido
      ? { id: 'agente', rotulo: 'Agente', valor: 'pausado: limite de IA do mês', tom: 'perigo' }
      : { id: 'agente', rotulo: 'Agente', valor: 'atendendo', tom: 'ok' };
  if (!e.trabalhadorOk) {
    // O sinal do WhatsApp vem do batimento: com a fila parada, não dá para afirmar nada sobre ele.
    return [agente, { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'sem confirmação', tom: 'atencao' },
      { id: 'fila', rotulo: 'Mensagens', valor: 'paradas: avise o administrador', tom: 'perigo' }];
  }
  return [agente, e.whatsappConectado
    ? { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'conectado', tom: 'ok' }
    : { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'sem sinal', tom: 'perigo' }];
}
```

(O teste `13:00Z` de `detalheVencemHoje` com uma só demanda às `18:30Z` espera "até 15h30": `horaCurta` escreve "15h30" para minutos ≠ 00.)

- [ ] **Passo 3: `lib/minha-mesa.ts`**

```ts
// Minha mesa (spec 7C.1, Opção B): regras sem React. Tudo o que chega aqui já passou pela regra de leitura da pessoa (RLS).
import type { Niveis } from '@escritorio/core';
import { hrefSecao } from './configuracoes';
import type { Prioridade, StatusFiltro } from './demandas';
import { FUSO } from './formatos';
import { temNivel, usaAssistente } from './permissoes';

export type DemandaMesa = {
  id: string; numero: number; titulo: string; empresa: string | null; setor: string | null; status: StatusFiltro;
  prioridade: Prioridade; prazo_em: string | null; prazo_pausado_desde: string | null; vencida: boolean;
};

/** Linhas de demandas_lista (as colunas de visão chegam como possivelmente nulas). */
export function lerDemandasMesa(bruto: unknown): DemandaMesa[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.map((r: Record<string, unknown>) => ({
    id: String(r.id), numero: Number(r.numero), titulo: String(r.titulo ?? ''),
    empresa: (r.empresa as string | null) ?? null, setor: (r.setor as string | null) ?? null,
    status: ((r.status as StatusFiltro | null) ?? 'aberto'), prioridade: ((r.prioridade as Prioridade | null) ?? 'normal'),
    prazo_em: (r.prazo_em as string | null) ?? null, prazo_pausado_desde: (r.prazo_pausado_desde as string | null) ?? null,
    vencida: r.vencida === true,
  }));
}

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** Vencida · Vencem hoje · Próximos dias (D11): "Com o cliente" (pausada) e sem prazo ficam em Próximos dias. */
export function agruparPorPrazo<T extends DemandaMesa>(lista: T[], agora: Date): { vencidas: T[]; hoje: T[]; proximos: T[] } {
  const hojeSP = DIA.format(agora);
  const venceHoje = (d: T) => !d.vencida && !d.prazo_pausado_desde && d.prazo_em !== null && DIA.format(new Date(d.prazo_em)) === hojeSP;
  return {
    vencidas: lista.filter((d) => d.vencida),
    hoje: lista.filter(venceHoje),
    proximos: lista.filter((d) => !d.vencida && !venceHoje(d)),
  };
}

const STATUS_MESA: Record<StatusFiltro, string> = { aberto: 'nova', em_andamento: 'resolvendo', aguardando_cliente: 'com o cliente', concluido: 'concluída' };

/** "Mercado Central · Pessoal · resolvendo" (imagem B), em partes: a empresa vai em vinho. */
export function detalheDaDemanda(d: Pick<DemandaMesa, 'empresa' | 'setor' | 'status'>): [string, string, string] {
  return [d.empresa ?? 'sem empresa', d.setor ?? 'Triagem', STATUS_MESA[d.status]];
}

export type Atalho = { rotulo: string; href: string; icone: 'nova' | 'empresa' | 'respostas' | 'assistente' | 'notas' | 'contatos' };

/** Atalhos que a pessoa pode usar (D17): nenhum leva a "sem acesso". */
export function atalhosDaMesa(u: { papel: 'admin' | 'atendente'; niveis: Niveis }): Atalho[] {
  const lista: Atalho[] = [
    { rotulo: 'Nova demanda', href: '/demandas?nova=1', icone: 'nova' },
    { rotulo: 'Buscar empresa', href: '/clientes', icone: 'empresa' },
  ];
  if (temNivel(u, 'configuracoes', 'sim')) lista.push({ rotulo: 'Respostas prontas', href: hrefSecao('respostas'), icone: 'respostas' });
  if (usaAssistente(u)) lista.push({ rotulo: 'Assistente', href: '/assistente', icone: 'assistente' });
  if (temNivel(u, 'notas', 'ver')) lista.push({ rotulo: 'Pedidos de nota', href: '/demandas?tipo=venda', icone: 'notas' });
  lista.push({ rotulo: 'Contatos', href: '/contatos', icone: 'contatos' });
  return lista;
}

export const ROTULOS_MESA = {
  esperando: (n: number) => (n === 1 ? 'conversa esperando você' : 'conversas esperando você'),
  vencidas: (n: number) => (n === 1 ? 'minha demanda vencida' : 'minhas demandas vencidas'),
  hoje: (n: number) => (n === 1 ? 'vence hoje' : 'vencem hoje'),
  semResponsavel: (_n: number) => 'sem responsável nos meus setores',
};

export function textoConcluidasHoje(n: number): string {
  if (n === 0) return 'Você ainda não concluiu demandas hoje.';
  return n === 1 ? 'Você concluiu 1 demanda hoje.' : `Você concluiu ${n} demandas hoje.`;
}

export const textoComAgenteHoje = (n: number): string => (n === 0 ? 'nenhuma com o agente hoje' : `${n} com o agente hoje`);

export const subtituloMinhas = (total: number): string => `${total} comigo · ordenadas pelo que vence primeiro`;
```

- [ ] **Passo 4: tirar o `parcial` da página de hoje**

Em `apps/painel/src/app/(painel)/inicio/page.tsx`: na chamada `<GastoIa … parcial={gasto?.parcial ?? false} />` tire `parcial={…}`; na função `GastoIa`, tire o parâmetro `parcial` (da desestruturação e do tipo) e o trecho `{parcial && ' · valor parcial (mês com uso demais para somar aqui; o real é maior)'}`. Em `inicio/gasto-do-mes.ts` nada muda (o tipo vem de `lib/inicio.ts`). Confira: `grep -rn "parcial" apps/painel/src/app/\(painel\)/inicio apps/painel/src/lib/inicio.ts` não acha nada.

- [ ] **Passo 5: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/inicio.test.ts src/lib/minha-mesa.test.ts && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo verde.

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/lib/inicio.ts apps/painel/src/lib/inicio.test.ts apps/painel/src/lib/minha-mesa.ts apps/painel/src/lib/minha-mesa.test.ts "apps/painel/src/app/(painel)/inicio/page.tsx"
git commit -m "feat(painel): regras do Início e da Minha mesa; gasto do mês sem o campo parcial

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Painel. O papel escolhe a versão; peças comuns

**Files:**
- Move: `inicio/page.tsx` → `inicio/painel-situacao.tsx` (com `git mv`), depois Create: `inicio/page.tsx` novo
- Create: `inicio/{minha-mesa.tsx,dados-inicio.ts,cabecalho-inicio.tsx,atualizado-ha.tsx,numero-inicio.tsx}`
- Modify: `inicio/loading.tsx`
- Create: `apps/painel/e2e/apoio-inicio.ts`, `apps/painel/e2e/inicio-papel.spec.ts`
- Modify: `apps/painel/e2e/atendimento-lista.spec.ts`

**Interfaces:**
- Consumes: `obterUsuario`, `UsuarioPainel` (`lib/sessao.ts`); `temNivel`; `contarConversasAguardando` (`lib/contadores.ts`); `useAgora`; `saudacao`, `primeiroNome`, `dataDoTitulo`, `capitalizar`, `textoAtualizado` (Task 2).
- Produces: `PainelSituacao({ u })`, `MinhaMesa({ u })`; `paginaInicio()` (cache: `{ sb, agora }`); `CabecalhoInicio`; `AtualizadoHa` (com `data-atualizado` e `data-hidratado`); `NumeroInicio` (`data-numero`, `data-valor`); no e2e: `abrirInicio(page, versao)`, `numeroInicio(page, chave)`, `cartaoNumero(page, chave)`.

- [ ] **Passo 1: escrever o e2e que falha**

`apps/painel/e2e/apoio-inicio.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/**
 * Abre o Início e espera o navegador assumir a página: o "atualizado há…" marca data-hidratado num useEffect (só roda
 * no navegador). Clicar antes disso perde o clique (mesmo cuidado do abrirSecao da G1).
 */
export async function abrirInicio(page: Page, versao: 'situacao' | 'mesa'): Promise<void> {
  await page.goto('/inicio');
  await expect(page.locator(`[data-inicio="${versao}"] [data-atualizado][data-hidratado]`)).toHaveCount(1, { timeout: 30_000 });
}

export const cartaoNumero = (page: Page, chave: string) => page.locator(`[data-numero="${chave}"]`);

/** O número grande de um cartão do Início (contrato: data-numero/data-valor, D20). */
export async function numeroInicio(page: Page, chave: string): Promise<number> {
  return Number((await cartaoNumero(page, chave).locator('[data-valor]').innerText()).trim());
}
```

`apps/painel/e2e/inicio-papel.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';

// Prompt G, ponto que não pode falhar: o papel escolhe a versão (D1).
test('administrador abre o Painel de situação; quem atende, a Minha mesa (também com "Configurações: Sim")', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-papel@e2e.local', senha: SENHA, nome: 'Thiago Papel', papel: 'admin' });
  await entrar(page, 'admin-papel@e2e.local', SENHA);
  await abrirInicio(page, 'situacao');
  await expect(page.locator('[data-inicio="mesa"]')).toHaveCount(0);

  await page.context().clearCookies();
  await criarUsuarioTeste({ email: 'ana-papel@e2e.local', senha: SENHA, nome: 'Ana Papel', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-papel@e2e.local', SENHA);
  await abrirInicio(page, 'mesa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Bom dia|Boa tarde|Boa noite), Ana$/);
  await expect(page.locator('[data-inicio="situacao"]')).toHaveCount(0);

  await page.context().clearCookies();
  const conf = await criarUsuarioTeste({ email: 'conf-papel@e2e.local', senha: SENHA, nome: 'Cláudia Papel', papel: 'atendente' });
  await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', conf).eq('modulo', 'configuracoes');
  await entrar(page, 'conf-papel@e2e.local', SENHA);
  await abrirInicio(page, 'mesa');
});
```

Em `apps/painel/e2e/atendimento-lista.spec.ts`, troque as duas linhas finais do primeiro teste:

```ts
  // O número do cartão do Início é o mesmo do título do Atendimento (P2).
  await page.goto('/inicio');
  await expect(page.getByText('Esperando você', { exact: true }).locator('xpath=following-sibling::p[1]')).toHaveText('2', { timeout: 30_000 });
```

por

```ts
  // O número do cartão da Minha mesa é o mesmo do título do Atendimento (P2); contrato data-numero (G2, D20).
  await abrirInicio(page, 'mesa');
  await expect.poll(() => numeroInicio(page, 'esperando-voce')).toBe(2);
```

e acrescente `import { abrirInicio, numeroInicio } from './apoio-inicio';` aos imports.

Run: `cd apps/painel && pnpm exec playwright test e2e/inicio-papel.spec.ts e2e/atendimento-lista.spec.ts`
Expected: FAIL (`[data-inicio="situacao"]` não existe).

- [ ] **Passo 2: peças comuns**

`inicio/dados-inicio.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Um cliente e um "agora" por requisição: as seções do Início leem em paralelo e todas contam do mesmo instante. */
export const paginaInicio = cache(async () => ({ sb: await supabaseServidor(), agora: new Date() }));
```

`inicio/atualizado-ha.tsx`:

```tsx
'use client';

import { RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAgora } from '@/components/patterns/relative-time';
import { textoAtualizado } from '@/lib/inicio';

/**
 * "atualizado há 12 s · recarrega a cada minuto" (imagens A e B). `em` é a hora em que o servidor montou a página; a
 * recarga periódica traz um `em` novo. `data-hidratado` marca que o navegador assumiu (e2e: abrirInicio).
 */
export function AtualizadoHa({ em }: { em: string }) {
  const agora = useAgora(5_000);
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);
  const segundos = Math.max(0, (agora - new Date(em).getTime()) / 1000);
  return (
    <p data-atualizado="" data-hidratado={hidratado ? '' : undefined} className="flex items-center gap-1 text-sm text-muted">
      <RefreshCw aria-hidden size={14} strokeWidth={1.75} />
      <span suppressHydrationWarning>atualizado {textoAtualizado(segundos)}</span>
      <span aria-hidden>·</span> recarrega a cada minuto
    </p>
  );
}
```

`inicio/cabecalho-inicio.tsx`:

```tsx
import type { ReactNode } from 'react';
import { AtualizadoHa } from './atualizado-ha';

/** Topo das duas versões: "atualizado há…", título (h1), linha de baixo e os botões da direita. */
export function CabecalhoInicio({ titulo, subtitulo, acoes, atualizadoEm }: {
  titulo: ReactNode; subtitulo: ReactNode; acoes?: ReactNode; atualizadoEm: string;
}) {
  return (
    <header className="flex flex-col gap-2">
      <div className="flex justify-end"><AtualizadoHa em={atualizadoEm} /></div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-foreground">{titulo}</h1>
          <p className="text-muted">{subtitulo}</p>
        </div>
        {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
      </div>
    </header>
  );
}
```

`inicio/numero-inicio.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export type TomNumero = 'neutro' | 'ok' | 'atencao' | 'perigo';
const COR: Record<TomNumero, string> = { neutro: 'text-foreground', ok: 'text-success', atencao: 'text-warning', perigo: 'text-danger' };
const FAIXA_TOPO: Record<TomNumero, string> = { neutro: 'border-t-border', ok: 'border-t-success', atencao: 'border-t-warning', perigo: 'border-t-danger' };
const FAIXA_LADO: Record<TomNumero, string> = { neutro: 'border-l-border', ok: 'border-l-success', atencao: 'border-l-warning', perigo: 'border-l-danger' };

/**
 * Um número do Início. Situação (imagem A): faixa colorida no topo, título, número grande, detalhe e link.
 * Mesa (imagem B): ícone à esquerda, número e o que ele conta embaixo; o cartão inteiro é o link.
 * `data-numero`/`data-valor` são o contrato dos e2e (D20). A cor nunca fala sozinha: título e detalhe dizem o que é.
 */
export function NumeroInicio({ chave, titulo, valor, tom = 'neutro', detalhe, link, icone: Icone, variante = 'situacao' }: {
  chave: string; titulo: string; valor: number | null; tom?: TomNumero; detalhe?: ReactNode;
  link?: { href: string; rotulo: string }; icone?: LucideIcon; variante?: 'situacao' | 'mesa';
}) {
  const texto = valor ?? '—';
  if (variante === 'mesa') {
    const corpo = (
      <>
        {Icone && (
          <span aria-hidden className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-muted', COR[tom])}>
            <Icone size={22} strokeWidth={1.75} />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span data-valor="" className={cn('tabular text-3xl font-extrabold', COR[tom])}>{texto}</span>
          <span data-titulo="" className="text-sm text-foreground">{titulo}</span>
        </span>
      </>
    );
    return (
      <Card data-numero={chave} className={cn('border-l-4 p-0', FAIXA_LADO[tom])}>
        {link
          ? <Link href={link.href} className="flex items-center gap-4 rounded-lg p-4 hover:bg-surface-muted">{corpo}<span className="sr-only">: {link.rotulo}</span></Link>
          : <div className="flex items-center gap-4 p-4">{corpo}</div>}
      </Card>
    );
  }
  return (
    <Card data-numero={chave} className={cn('gap-1 border-t-4 p-4', FAIXA_TOPO[tom])}>
      <p data-titulo="" className="text-sm font-bold uppercase tracking-wide text-foreground">{titulo}</p>
      <p data-valor="" className={cn('tabular text-4xl font-extrabold', COR[tom])}>{texto}</p>
      {detalhe && <p className="text-sm text-muted">{detalhe}</p>}
      {link && (
        <Link href={link.href} className="mt-auto pt-1 text-sm font-semibold text-brand underline-offset-4 hover:underline">
          {link.rotulo} <span aria-hidden>→</span>
        </Link>
      )}
    </Card>
  );
}
```

(Confira com `grep -n "success\|warning\|danger" apps/painel/src/styles/tokens.css | head` que `border-*-success`, `border-*-warning` e `border-*-danger` existem como cores do tema; `border-t-brand` já é usado em `gastos-ia/cartoes.tsx`.)

- [ ] **Passo 3: `painel-situacao.tsx` (o Início de hoje, sem mudar o conteúdo) e `page.tsx` novo**

Run: `git mv "apps/painel/src/app/(painel)/inicio/page.tsx" "apps/painel/src/app/(painel)/inicio/painel-situacao.tsx"`.

Em `painel-situacao.tsx`:
1. Troque `export default async function Inicio() {` e a linha `const u = await obterUsuario();` por:

```tsx
export async function PainelSituacao({ u }: { u: UsuarioPainel }) {
```

   e troque o import `import { obterUsuario } from '@/lib/sessao';` por `import type { UsuarioPainel } from '@/lib/sessao';`.
2. No `return`, troque `<div className="flex max-w-5xl flex-col gap-6">` por `<div data-inicio="situacao" className="flex max-w-7xl flex-col gap-6">` e, logo depois do `<PageHeader … />`, acrescente `<AtualizadoHa em={agora.toISOString()} />` (import de `./atualizado-ha`).
3. Atualize o comentário do componente: "Início do administrador (Painel de situação). As Tasks 4 a 6 trocam cada pedaço pelo da imagem A."

`inicio/page.tsx` (novo):

```tsx
import { obterUsuario } from '@/lib/sessao';
import { MinhaMesa } from './minha-mesa';
import { PainelSituacao } from './painel-situacao';

/**
 * Início (spec 7C.1): o papel escolhe a versão (D1). Administrador → Painel de situação (custos, sinais de vida, pausa do
 * agente); qualquer outra pessoa → Minha mesa, que nunca lê custo nem configuracoes (atendente nunca vê custos).
 */
export default async function Inicio() {
  const u = await obterUsuario();
  return u.papel === 'admin' ? <PainelSituacao u={u} /> : <MinhaMesa u={u} />;
}
```

- [ ] **Passo 4: `minha-mesa.tsx` (primeira versão)**

```tsx
import { MessageCircle } from 'lucide-react';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { contarConversasAguardando } from '@/lib/contadores';
import { capitalizar, dataDoTitulo, primeiroNome, saudacao } from '@/lib/inicio';
import { ROTULOS_MESA } from '@/lib/minha-mesa';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { CabecalhoInicio } from './cabecalho-inicio';
import { paginaInicio } from './dados-inicio';
import { NumeroInicio } from './numero-inicio';

/** Minha mesa (imagem B), para quem não é administrador. Nunca lê custo nem configuracoes. As Tasks 7 e 8 completam. */
export async function MinhaMesa({ u }: { u: UsuarioPainel }) {
  const { sb, agora } = await paginaInicio();
  const podeAtendimento = temNivel(u, 'atendimento', 'meus_setores');
  const esperando = podeAtendimento ? await contarConversasAguardando(sb) : null;
  return (
    <div data-inicio="mesa" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <CabecalhoInicio
        titulo={<>{saudacao(agora)}, <span className="text-brand">{primeiroNome(u.nome)}</span></>}
        subtitulo={capitalizar(dataDoTitulo(agora))}
        atualizadoEm={agora.toISOString()}
      />
      {podeAtendimento && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <NumeroInicio variante="mesa" chave="esperando-voce" icone={MessageCircle} valor={esperando}
            titulo={ROTULOS_MESA.esperando(esperando ?? 0)} tom={(esperando ?? 0) > 0 ? 'ok' : 'neutro'}
            link={{ href: '/atendimento', rotulo: 'abrir o Atendimento' }} />
        </div>
      )}
    </div>
  );
}
```

O h1 da Minha mesa tem um `<span>` dentro: o nome acessível continua "Bom dia, Ana".

- [ ] **Passo 5: `loading.tsx` (um esqueleto só, D22)**

```tsx
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto do Início: o carregamento não sabe o papel (D22), então serve às duas versões. */
export default function CarregandoInicio() {
  return (
    <div role="status" aria-label="Carregando o Início" className="flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="gap-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="gap-3 p-4 xl:col-span-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
        <Card className="gap-3 p-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Passo 6: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/inicio-papel.spec.ts e2e/atendimento-lista.spec.ts e2e/inicio-vencimentos.spec.ts e2e/configuracoes.spec.ts e2e/gastos-ia.spec.ts`
Expected: tudo verde (o Painel de situação ainda é o Início de hoje, então `inicio-vencimentos`, a pausa e o cartão do gasto continuam passando).

- [ ] **Passo 7: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Início escolhe a versão pelo papel (Painel de situação ou Minha mesa); peças comuns e apoio dos testes

O teste da lista do Atendimento lê o número da Minha mesa pelo contrato data-numero (o cartão 'Esperando você' saiu).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Painel de situação. Agente, sinais de vida e gasto × teto

**Files:**
- Create: `inicio/dados-situacao.ts`, `inicio/cartao-agente.tsx`, `inicio/cartao-sinais.tsx`, `inicio/cartao-gasto.tsx`
- Modify: `inicio/painel-situacao.tsx`
- Create: `apps/painel/e2e/inicio-situacao.spec.ts`
- Modify: `apps/painel/e2e/configuracoes.spec.ts`, `apps/painel/e2e/gastos-ia.spec.ts`

**Interfaces:**
- Consumes: `paginaInicio`; `gastoDoMes` (`inicio/gasto-do-mes.ts`); `lerSinaisVida`, `situacaoTeto`, `textoFracaoTeto`, `LIMITES_BATIMENTO`, `diaSP`, `diasDoMes` (`lib/inicio.ts`); `estaNoExpediente` (`@escritorio/core`); `emReais`, `previsaoFechamento`, `percentual` (`lib/gastos.ts`); `alternarPausaGeral` (`inicio/acoes.ts`); `rpc('agente_numeros_hoje')` (Task 1).
- Produces: `lerConfigSituacao()`, `lerSinaisSituacao()`, `lerGastoSituacao(usuarioId)`, `lerNumerosAgente()`, `lerDemandasDoDia()`, `lerFeriadosDeHoje()`, `lerAvisos()` (este em `dados-inicio.ts`); `CartaoAgente({ u })` (`data-testid="inicio-agente"`, `data-estado-agente`, `data-agente-numero`), `CartaoSinais()` (`id="sinais-de-vida"`), `CartaoGasto({ u })` (`data-testid="inicio-gasto"`).

- [ ] **Passo 1: e2e que falham (novos e ajustados)**

`apps/painel/e2e/inicio-situacao.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
const ADMIN = { email: 'thiago-situacao@e2e.local', nome: 'Thiago Situação' };
const PREFIXO_TEL = '553197003';

test.beforeEach(async () => {
  await criarUsuarioTeste({ email: ADMIN.email, senha: SENHA, nome: ADMIN.nome, papel: 'admin' });
});
test.afterAll(async () => {
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
});

test('cartão do agente: estado, expediente e números do dia (conversas, % resolvidas, demandas abertas por ele)', async ({ page }) => {
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  await entrar(page, ADMIN.email, SENHA);
  await abrirInicio(page, 'situacao');
  const cartao = page.getByTestId('inicio-agente');
  const conversas = async () => Number((await cartao.locator('[data-agente-numero="conversas"]').innerText()).trim());
  const antes = await conversas();

  // Duas conversas de hoje: uma só com o agente, outra a equipe respondeu.
  const agora = Date.now();
  for (const [sufixo, equipe] of [['0001', false], ['0002', true]] as const) {
    const { data: c } = await db.from('conversas').insert({ telefone: `${PREFIXO_TEL}${sufixo}` }).select('id').single();
    await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'oi', criado_em: new Date(agora - 60_000).toISOString(), processada_em: new Date().toISOString() });
    if (equipe) await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'saida', autor: 'atendente', conteudo: 'pois não', criado_em: new Date(agora - 30_000).toISOString() });
  }
  await abrirInicio(page, 'situacao');
  await expect.poll(conversas).toBe(antes + 2);
  await expect(cartao.locator('[data-agente-numero="resolvidas"]')).toHaveText(/^\d+%$/);
  await expect(cartao.locator('[data-agente-numero="demandas"]')).toHaveText(/^\d+$/);
  await expect(cartao.locator('[data-estado-agente]')).toHaveText(/Atendendo|Pausado|Parado pelo teto de IA/);
  await expect(cartao).toContainText(/dentro do expediente|fora do expediente|Todas as mensagens vão para a equipe|o gasto do mês chegou ao teto/);
});

test('sinais de vida: WhatsApp, fila, último batimento e avisos não vistos', async ({ page }) => {
  await db.from('alertas').delete().like('mensagem', 'E2E G2 sinais%');
  await db.from('alertas').insert({ nivel: 'aviso', mensagem: 'E2E G2 sinais: aviso de teste' });
  try {
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    const sinais = page.locator('#sinais-de-vida');
    await expect(sinais.getByRole('heading', { name: 'Sinais de vida' })).toBeVisible();
    await expect(sinais).toContainText('WhatsApp (Z-API)');
    await expect(sinais).toContainText('Fila de tarefas');
    await expect(sinais).toContainText('Último batimento');
    await expect(sinais.getByRole('link', { name: /Avisos não vistos/ })).toHaveAttribute('href', '#avisos');
  } finally {
    await db.from('alertas').delete().like('mensagem', 'E2E G2 sinais%');
  }
});
```

Em `apps/painel/e2e/configuracoes.spec.ts`, no teste "administrador pausa e retoma o agente pelo Início", troque as duas verificações de texto (D20):

```ts
  await expect(page.getByText('O agente está PAUSADO')).toBeVisible();
```
por
```ts
  await expect(page.getByTestId('inicio-agente').locator('[data-estado-agente]')).toHaveText('Pausado');
```
e
```ts
  await expect(page.getByText('O agente está atendendo normalmente.')).toBeVisible();
```
por
```ts
  await expect(page.getByTestId('inicio-agente').locator('[data-estado-agente]')).toHaveText(/Atendendo|Parado pelo teto de IA/);
```
e, logo depois de `entrar(…)`, acrescente `await abrirInicio(page, 'situacao');` (import de `./apoio-inicio`).

Em `apps/painel/e2e/gastos-ia.spec.ts`, troque os dois testes do Início por:

```ts
test('Início: o cartão do gasto × teto lê a gastos_resumo e leva a Gastos com IA', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await abrirInicio(page, 'situacao');
  const cartao = page.getByTestId('inicio-gasto');
  await expect(cartao).toContainText('2,31');                      // 0,4 + 0,2 + 0,01 + 0,3 + 0,5 + 0,9
  await expect(cartao).toContainText('Previsão até o fim do mês');
  await cartao.getByRole('link', { name: 'Ver Gastos com IA' }).click();
  await expect(page).toHaveURL(/\/gastos-ia$/);
});

test('Início: atendente não vê o cartão do gasto', async ({ page }) => {
  await entrar(page, dados.ana.email, dados.ana.senha);
  await abrirInicio(page, 'mesa');
  await expect(page.getByTestId('inicio-gasto')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ver Gastos com IA' })).toHaveCount(0);
  await expect(page.getByText('US$')).toHaveCount(0);
});
```

com `import { abrirInicio } from './apoio-inicio';` nos imports.

Run: `cd apps/painel && pnpm exec playwright test e2e/inicio-situacao.spec.ts e2e/configuracoes.spec.ts e2e/gastos-ia.spec.ts`
Expected: FAIL (`inicio-agente`, `#sinais-de-vida` e `inicio-gasto` não existem).

- [ ] **Passo 2: leitores**

Em `inicio/dados-inicio.ts`, acrescente:

```ts
/** Avisos ainda não vistos que a pessoa enxerga (RLS de alertas: administrador todos; a equipe os dela e do setor). */
export const lerAvisos = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('alertas').select('*', { count: 'exact' }).is('lido_em', null)
    .order('criado_em', { ascending: false }).limit(20);
  return error ? null : { alertas: data ?? [], total: count ?? 0 };
});
```

`inicio/dados-situacao.ts` (só o Painel de situação importa este arquivo, D1):

```ts
import 'server-only';
import { cache } from 'react';
import { inicioDoDiaSP } from '@/lib/demandas';
import { diaSP, lerSinaisVida } from '@/lib/inicio';
import { gastoDoMes } from './gasto-do-mes';
import { paginaInicio } from './dados-inicio';

// Leituras do Painel de situação. Gasto, configuracoes e sinais_vida só o administrador lê (banco e RLS); a Minha mesa
// nunca importa este arquivo (D1, Restrições globais). Cada leitor roda uma vez por requisição (cache).

export const lerConfigSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data } = await sb.from('configuracoes')
    .select('agente_pausado, teto_ia_usd, minutos_alerta_fila, cotacao_usd_brl, horario_inicio, horario_fim, dias_uteis')
    .eq('id', 1).maybeSingle();
  return data;
});

export const lerSinaisSituacao = cache(async () => lerSinaisVida((await paginaInicio()).sb));

export const lerGastoSituacao = cache(async (usuarioId: string) => {
  const { sb, agora } = await paginaInicio();
  return gastoDoMes(sb, usuarioId, agora);
});

/** agente_numeros_hoje (Task 1); null sem a migração (homologação antes do "ok", D21). */
export const lerNumerosAgente = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.rpc('agente_numeros_hoje');
  if (error || !data) return null;
  const o = data as { conversas?: unknown; resolvidas_agente?: unknown };
  return { conversas: Number(o.conversas) || 0, resolvidas: Number(o.resolvidas_agente) || 0 };
});

/** Demandas criadas hoje (Brasília) e quantas delas o agente abriu (origem agente/sistema, como o filtro "Do agente", D7). */
export const lerDemandasDoDia = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const desde = inicioDoDiaSP(agora).toISOString();
  const base = () => sb.from('chamados').select('id', { count: 'exact', head: true }).gte('criado_em', desde);
  const [todas, doAgente] = await Promise.all([base(), base().in('origem', ['agente', 'sistema'])]);
  if (todas.error || doAgente.error) return null;
  return { abertasHoje: todas.count ?? 0, doAgente: doAgente.count ?? 0 };
});

/** O feriado de hoje, se houver, para "dentro do expediente" (D8). */
export const lerFeriadosDeHoje = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const hoje = diaSP(agora);
  const { data } = await sb.from('feriados').select('data').eq('data', hoje);
  return (data ?? []).map((f) => String(f.data));
});
```

- [ ] **Passo 3: `cartao-agente.tsx`**

```tsx
import { estaNoExpediente } from '@escritorio/core';
import { CircleDot, Gauge, PauseCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { situacaoTeto } from '@/lib/inicio';
import type { UsuarioPainel } from '@/lib/sessao';
import { alternarPausaGeral } from './acoes';
import { paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerDemandasDoDia, lerFeriadosDeHoje, lerGastoSituacao, lerNumerosAgente } from './dados-situacao';

const ESTADO = {
  atendendo: { titulo: 'Atendendo', Icone: CircleDot, cor: 'text-success' },
  pausado: { titulo: 'Pausado', Icone: PauseCircle, cor: 'text-danger' },
  teto: { titulo: 'Parado pelo teto de IA', Icone: Gauge, cor: 'text-danger' },
} as const;

/** Cartão do agente (imagem A): estado, números do dia e PAUSAR/RETOMAR (só o administrador; a ação confere de novo). */
export async function CartaoAgente({ u }: { u: UsuarioPainel }) {
  const [cfg, gasto, numeros, doDia, feriados, { agora }] = await Promise.all([
    lerConfigSituacao(), lerGastoSituacao(u.id), lerNumerosAgente(), lerDemandasDoDia(), lerFeriadosDeHoje(), paginaInicio(),
  ]);
  if (!cfg) {
    return <Card data-testid="inicio-agente" className="p-4 text-sm text-muted">O estado do agente não pôde ser lido agora.</Card>;
  }
  const tetoAtingido = gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)).nivel === 'atingido' : false;
  const tipo = cfg.agente_pausado ? 'pausado' : tetoAtingido ? 'teto' : 'atendendo';
  const { titulo, Icone, cor } = ESTADO[tipo];
  const noExpediente = estaNoExpediente(agora, {
    inicio: String(cfg.horario_inicio).slice(0, 5), fim: String(cfg.horario_fim).slice(0, 5), diasUteis: cfg.dias_uteis, feriados,
  });
  const detalhe = tipo === 'pausado'
    ? 'Todas as mensagens vão para a equipe.'
    : tipo === 'teto'
      ? 'O gasto do mês chegou ao teto: as mensagens vão para a equipe até o mês virar ou o teto subir.'
      : noExpediente ? 'dentro do expediente' : 'fora do expediente';
  const pct = numeros && numeros.conversas > 0 ? `${Math.round((numeros.resolvidas / numeros.conversas) * 100)}%` : '—';

  return (
    <Card data-testid="inicio-agente" className="gap-4 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Agente</h2>
        <span className="text-sm text-subtle">robô do WhatsApp</span>
      </div>
      <div>
        <p data-estado-agente={tipo} className={cn('flex items-center gap-2 text-2xl font-extrabold', cor)}>
          <Icone aria-hidden size={20} strokeWidth={2} />{titulo}
        </p>
        <p className="text-sm text-muted">{detalhe}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3">
        {[
          ['conversas', numeros ? String(numeros.conversas) : '—', 'conversas hoje', 'text-foreground'],
          ['resolvidas', pct, 'resolvidas por ele', 'text-success'],
          ['demandas', doDia ? String(doDia.doAgente) : '—', 'demandas abertas', 'text-foreground'],
        ].map(([chave, valor, rotulo, corValor]) => (
          <div key={chave} className="flex flex-col-reverse">
            <dt className="text-xs text-muted">{rotulo}</dt>
            <dd data-agente-numero={chave} className={cn('tabular text-2xl font-extrabold', corValor)}>{valor}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{cfg.agente_pausado ? 'Retomar volta a responder os clientes.' : 'Pausar manda tudo para a equipe.'}</p>
        <ConfirmDialog
          key={String(cfg.agente_pausado)}
          acao={alternarPausaGeral.bind(null, !cfg.agente_pausado)}
          gatilho={<Button variant={cfg.agente_pausado ? 'primary' : 'outline'} size="sm">{cfg.agente_pausado ? 'Retomar agente' : 'Pausar agente'}</Button>}
          titulo={cfg.agente_pausado ? 'Retomar o agente?' : 'Pausar o agente?'}
          descricao={cfg.agente_pausado
            ? 'O agente volta a responder os clientes no WhatsApp.'
            : 'O agente para de responder todos os clientes. As mensagens novas vão para a equipe atender no painel.'}
          confirmar={cfg.agente_pausado ? 'Retomar agente' : 'Pausar agente'}
          enviando={cfg.agente_pausado ? 'Retomando…' : 'Pausando…'}
          variante={cfg.agente_pausado ? 'primary' : 'danger'}
        />
      </div>
    </Card>
  );
}
```

(`dl` com `flex-col-reverse`: o número aparece em cima e o rótulo embaixo, como na imagem, sem trocar a ordem `dt`/`dd` que o leitor de tela lê. Confira com `grep -n "PauseCircle\|CirclePause" apps/painel/src -r | head -2` qual nome o projeto já usa.)

- [ ] **Passo 4: `cartao-sinais.tsx`**

```tsx
import { Bell } from 'lucide-react';
import { HealthSignal } from '@/components/patterns/health-signal';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Card } from '@/components/ui/card';
import { LIMITES_BATIMENTO } from '@/lib/inicio';
import { lerAvisos } from './dados-inicio';
import { lerSinaisSituacao } from './dados-situacao';

/** Sinais de vida (imagem A). `id="sinais-de-vida"`: a faixa de alertas leva até aqui. */
export async function CartaoSinais() {
  const [sinais, avisos] = await Promise.all([lerSinaisSituacao(), lerAvisos()]);
  return (
    <Card id="sinais-de-vida" className="scroll-mt-4 gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Sinais de vida</h2>
        <span className="text-sm text-subtle">batimento a cada minuto</span>
      </div>
      {sinais ? (
        <>
          <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={sinais.whatsapp} limites={LIMITES_BATIMENTO} />
          <HealthSignal rotulo="Fila de tarefas" ultimoSinal={sinais.fila} limites={LIMITES_BATIMENTO} />
          <p className="flex justify-between gap-2 border-t border-border pt-2 text-sm text-foreground">
            Último batimento
            {sinais.ultimo ? <RelativeTime data={sinais.ultimo} focavel className="tabular font-semibold" /> : <span className="font-semibold text-danger">nenhum registrado</span>}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">Os sinais de vida não puderam ser lidos agora.</p>
      )}
      <a href="#avisos" className="flex items-center justify-between gap-2 border-t border-border pt-2 text-sm text-foreground hover:underline">
        <span className="flex items-center gap-1"><Bell aria-hidden size={14} strokeWidth={1.75} />Avisos não vistos</span>
        <span className="tabular font-bold">{avisos?.total ?? '—'}</span>
      </a>
    </Card>
  );
}
```

- [ ] **Passo 5: `cartao-gasto.tsx`**

```tsx
import { CircleDollarSign } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatarUSD } from '@/lib/formatos';
import { emReais, percentual, previsaoFechamento } from '@/lib/gastos';
import { diasDoMes, situacaoTeto } from '@/lib/inicio';
import type { UsuarioPainel } from '@/lib/sessao';
import { paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerGastoSituacao } from './dados-situacao';

/** Gasto com IA × teto (imagem A, spec 7B.3): só o administrador (D1). Marca de aviso em 80% e previsão de fechamento. */
export async function CartaoGasto({ u }: { u: UsuarioPainel }) {
  const [cfg, gasto, { agora }] = await Promise.all([lerConfigSituacao(), lerGastoSituacao(u.id), paginaInicio()]);
  if (!cfg || !gasto) {
    return <Card data-testid="inicio-gasto" className="p-4 text-sm text-muted">O gasto com IA não pôde ser lido agora.</Card>;
  }
  const teto = Number(cfg.teto_ia_usd);
  const nivel = situacaoTeto(gasto.total, teto).nivel;
  const pct = percentual(gasto.total, teto);
  const reais = emReais(gasto.total, cfg.cotacao_usd_brl ? Number(cfg.cotacao_usd_brl) : null);
  const { primeiro, ultimo } = diasDoMes(agora);
  return (
    <Card data-testid="inicio-gasto" className="gap-2 border-t-4 border-t-brand p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Gasto com IA × teto</h2>
        <span className="tabular text-sm text-subtle">teto {formatarUSD(teto)}</span>
      </div>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="tabular text-3xl font-extrabold text-foreground">{formatarUSD(gasto.total)}</span>
        <span className="tabular text-sm font-semibold text-muted">{[reais && `≈ ${reais}`, `${pct}%`].filter(Boolean).join(' · ')}</span>
      </p>
      <div
        role="progressbar" aria-label="Gasto do mês em relação ao teto" aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={Math.min(100, pct)} aria-valuetext={`${pct}% do teto`}
        className="relative mt-1 h-2 rounded-full bg-surface-muted"
      >
        <div className={cn('h-full rounded-full', nivel === 'atingido' ? 'bg-danger' : nivel === 'perto' ? 'bg-warning' : 'bg-brand')} style={{ width: `${Math.min(100, pct)}%` }} />
        {/* Marca do aviso de 80% (o alerta do teto dispara aí). */}
        <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded-sm bg-warning-decor" style={{ left: '80%' }} />
      </div>
      <p aria-hidden className="tabular flex justify-between text-xs text-subtle"><span>{primeiro}</span><span>aviso em 80%</span><span>{ultimo}</span></p>
      <p className="text-sm text-muted">Previsão até o fim do mês: <strong className="tabular font-bold text-foreground">{formatarUSD(previsaoFechamento(gasto.total, agora))}</strong></p>
      <Link href="/gastos-ia" className="mt-auto flex items-center gap-1 text-sm font-semibold text-brand underline-offset-4 hover:underline">
        <CircleDollarSign aria-hidden size={16} strokeWidth={1.75} />Ver Gastos com IA <span aria-hidden>→</span>
      </Link>
    </Card>
  );
}
```

- [ ] **Passo 6: `painel-situacao.tsx` usa os três cartões**

1. Troque o bloco inteiro `{(cfg || sinais) && ( <div className="grid gap-4 lg:grid-cols-2"> … </div> )}` (cartões Agente e Sinais de vida) por:

```tsx
      <div className="grid gap-4 lg:grid-cols-3">
        <CartaoAgente u={u} />
        <CartaoSinais />
        <CartaoGasto u={u} />
      </div>
```

2. Na seção "Números do dia", apague `{teto && <GastoIa … />}`; apague a função `GastoIa` no fim do arquivo.
3. Apague os imports que ficaram sem uso (`AgentStateIndicator`, `ConfirmDialog`, `estadoGeralDoAgente`, `HealthSignal`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `formatarUSD`, `LIMITES_BATIMENTO`, `alternarPausaGeral`, e a variável `estado`) — o typecheck e o lint apontam. `cfg`, `gasto`, `sinais` e `teto` continuam (a faixa usa).

- [ ] **Passo 7: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/inicio-situacao.spec.ts e2e/configuracoes.spec.ts e2e/gastos-ia.spec.ts e2e/inicio-vencimentos.spec.ts`
Expected: tudo verde.

- [ ] **Passo 8: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Painel de situação — cartão do agente com números do dia, sinais de vida e gasto × teto com previsão

Os testes da pausa e do gasto no Início passam a ler o estado e o cartão novos (textos da imagem A).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Painel de situação. Cabeçalho, faixa e os cinco números

**Files:**
- Modify: `inicio/dados-situacao.ts`, `inicio/faixa-alertas.tsx`, `inicio/painel-situacao.tsx`
- Create: `inicio/numeros-situacao.tsx`
- Modify: `apps/painel/e2e/inicio-situacao.spec.ts`, `apps/painel/e2e/inicio-vencimentos.spec.ts`

**Interfaces:**
- Consumes: `rpc('demandas_por_setor')` (Task 1); `lerLinhasSetor`, `totaisDosSetores`, `detalheEsperando`, `detalheVencemHoje`, `detalheMaisAtrasada`, `MINUTOS_SEM_RESPONSAVEL_PADRAO`, `AlertaFaixa.link` (Task 2); `NumeroInicio`, `CabecalhoInicio` (Task 3); `lerConfigSituacao` (Task 4).
- Produces: `lerSetoresSituacao()`, `lerEsperandoSituacao()`, `lerVencidasSituacao()`, `lerVencemHojeSituacao()`, `contarSemResponsavelAntigas(minutos)`; `NumerosSituacao()` com `data-numero` = `esperando-pessoa`, `demandas-abertas`, `vencem-hoje`, `vencidas`, `sem-responsavel`.

- [ ] **Passo 1: e2e que falham**

Em `apps/painel/e2e/inicio-situacao.spec.ts`, acrescente aos imports `import { demandaE2e, limparDemandasE2e } from './apoio-demandas';` e `import { cartaoNumero, numeroInicio } from './apoio-inicio';` (junto do `abrirInicio`), e os testes:

```ts
const P = 'E2E-G2S';
/** Fim do dia de hoje em Brasília (UTC-3) menos 1 minuto: ainda hoje e no futuro (mesmo cálculo do inicio-vencimentos). */
function fimDeHoje(): string {
  const UM_DIA = 24 * 3600_000;
  const inicio = Math.floor((Date.now() - 3 * 3600_000) / UM_DIA) * UM_DIA + 3 * 3600_000;
  return new Date(inicio + UM_DIA - 60_000).toISOString();
}

test('cabeçalho e os cinco números: contam as novas, com detalhes e links', async ({ page }) => {
  await limparDemandasE2e(P);
  try {
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Situação do escritório · \S+, \d{2}\/\d{2}$/);
    await expect(page.getByText(/^(Bom dia|Boa tarde|Boa noite), Thiago\. Visão de administrador: todos os setores\.$/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Gestão das demandas' })).toHaveAttribute('href', '/demandas');
    await expect(page.getByRole('link', { name: 'Abrir atendimento' })).toHaveAttribute('href', '/atendimento');
    const antes = {
      abertas: await numeroInicio(page, 'demandas-abertas'), hoje: await numeroInicio(page, 'vencem-hoje'),
      vencidas: await numeroInicio(page, 'vencidas'), sem: await numeroInicio(page, 'sem-responsavel'),
    };
    await demandaE2e({ titulo: `${P} hoje`, setor: 'Fiscal', status: 'em_andamento', prioridade: 'urgente', prazoEm: fimDeHoje() });
    await demandaE2e({ titulo: `${P} vencida`, setor: 'Fiscal', status: 'em_andamento', prazoEm: '2020-01-02T21:00:00Z' });
    await abrirInicio(page, 'situacao');
    await expect.poll(() => numeroInicio(page, 'demandas-abertas')).toBe(antes.abertas + 2);
    expect(await numeroInicio(page, 'vencem-hoje')).toBe(antes.hoje + 1);
    expect(await numeroInicio(page, 'vencidas')).toBe(antes.vencidas + 1);
    expect(await numeroInicio(page, 'sem-responsavel')).toBe(antes.sem + 2);
    await expect(cartaoNumero(page, 'vencem-hoje')).toContainText(/\d+ urgentes? · até \d+h/);
    await expect(cartaoNumero(page, 'vencidas')).toContainText('mais atrasada: venceu 02/01');
    await expect(cartaoNumero(page, 'demandas-abertas')).toContainText(/\d+ abertas hoje · \d+ do agente/);
    await expect(cartaoNumero(page, 'sem-responsavel')).toContainText(/\d+ há mais de \d+ min/);
    await expect(cartaoNumero(page, 'esperando-pessoa').getByRole('link', { name: 'Ver no Atendimento' })).toHaveAttribute('href', '/atendimento');
    await expect(cartaoNumero(page, 'demandas-abertas').getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/demandas');
    await expect(cartaoNumero(page, 'sem-responsavel').getByRole('link', { name: 'Ver na lista' })).toHaveAttribute('href', '/demandas?responsavel=sem');
  } finally {
    await limparDemandasE2e(P);
  }
});

test('faixa: fila atrasada vira aviso âmbar que leva aos sinais de vida (D10)', async ({ page }) => {
  const { data: antes } = await db.from('sinais_vida').select('componente, visto_em');
  try {
    await db.from('sinais_vida').upsert([
      { componente: 'fila', visto_em: new Date(Date.now() - 200_000).toISOString() },
      { componente: 'whatsapp', visto_em: new Date().toISOString() },
    ]);
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    // Outros avisos (ex.: teto perto) podem estar na faixa: o teste olha só o da fila.
    const fila = page.getByRole('region', { name: 'Alertas' }).getByRole('status').filter({ hasText: 'Fila de tarefas sem batimento' });
    await expect(fila).toContainText('Fila de tarefas sem batimento há 3 min');
    await expect(fila).toContainText('Se passar de 5 min, vira alerta crítico.');
    await fila.getByRole('link', { name: 'Ver sinais de vida' }).click();
    await expect(page).toHaveURL(/#sinais-de-vida$/);
  } finally {
    await db.from('sinais_vida').delete().neq('componente', '');
    if (antes?.length) await db.from('sinais_vida').insert(antes);
  }
});
```

Em `apps/painel/e2e/inicio-vencimentos.spec.ts` (Parte C), troque a função `numero` e o `cartao` local pelo contrato novo (D20):
1. Apague a função `numero(page, titulo)`; importe `import { abrirInicio, cartaoNumero, numeroInicio } from './apoio-inicio';`.
2. `await expect(page.getByText('Vencem hoje', { exact: true })).toBeVisible({ timeout: 30_000 });` → `await abrirInicio(page, 'situacao');`.
3. `numero(page, 'Vencem hoje')` → `numeroInicio(page, 'vencem-hoje')`; `numero(page, 'Vencidas')` → `numeroInicio(page, 'vencidas')`; os dois `await page.goto('/inicio');` → `await abrirInicio(page, 'situacao');`.
4. Apague a linha `const cartao = (titulo: string) => …`; `cartao('Vencem hoje')` → `cartaoNumero(page, 'vencem-hoje')`; `cartao('Vencidas')` → `cartaoNumero(page, 'vencidas')`.
O resto (links "Ver na lista", URLs e a tabela filtrada) continua igual.

Run: `cd apps/painel && pnpm exec playwright test e2e/inicio-situacao.spec.ts e2e/inicio-vencimentos.spec.ts`
Expected: FAIL (`data-numero` ainda não existe no Painel de situação; faixa sem link).

- [ ] **Passo 2: leitores**

Em `inicio/dados-situacao.ts`, acrescente (e `import { lerLinhasSetor } from '@/lib/inicio';` junto do import de `@/lib/inicio`; `import type { LinhaAtendimento } from '@/lib/atendimento';`):

```ts
const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** demandas_por_setor (Task 1): os cinco números são a soma das linhas (D5). null sem a migração (D21). */
export const lerSetoresSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.rpc('demandas_por_setor');
  return error ? null : lerLinhasSetor(data);
});

/** Conversas com espera em aberto (D6), quem espera há mais tempo primeiro: o número, o detalhe e a lista. */
export const lerEsperandoSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('caixa_entrada').select('*', { count: 'exact' })
    .not('espera_desde', 'is', null).order('espera_desde', { ascending: true }).limit(5);
  return error ? null : { linhas: (data ?? []) as unknown as LinhaAtendimento[], total: count ?? 0 };
});

/** As cinco vencidas mais antigas (a primeira dá o "mais atrasada", D9). */
export const lerVencidasSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.from('demandas_lista')
    .select('id, numero, titulo, empresa, setor, responsavel, prazo_em, prazo_pausado_desde')
    .is('vencida', true).order('prazo_em', { ascending: true }).limit(5);
  return error ? null : data ?? [];
});

/** Prioridade e prazo das que ainda vencem hoje, para "2 urgentes · até 18h". */
export const lerVencemHojeSituacao = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const fim = new Date(inicioDoDiaSP(agora).getTime() + UM_DIA_MS).toISOString();
  const { data, error } = await sb.from('demandas_lista').select('prioridade, prazo_em')
    .neq('status', 'concluido').is('prazo_pausado_desde', null).gte('prazo_em', agora.toISOString()).lt('prazo_em', fim).limit(500);
  return error ? null : data ?? [];
});

/** Sem responsável há mais que o prazo do alerta de fila (Configurações › Teto de IA e alertas). */
export const contarSemResponsavelAntigas = cache(async (minutos: number) => {
  const { sb, agora } = await paginaInicio();
  const limite = new Date(agora.getTime() - minutos * 60_000).toISOString();
  const { count, error } = await sb.from('chamados').select('id', { count: 'exact', head: true })
    .neq('status', 'concluido').is('responsavel_id', null).lt('criado_em', limite);
  return error ? null : count ?? 0;
});
```

- [ ] **Passo 3: `numeros-situacao.tsx`**

```tsx
import { MINUTOS_SEM_RESPONSAVEL_PADRAO, detalheEsperando, detalheMaisAtrasada, detalheVencemHoje, totaisDosSetores } from '@/lib/inicio';
import { paginaInicio } from './dados-inicio';
import {
  contarSemResponsavelAntigas, lerConfigSituacao, lerDemandasDoDia, lerEsperandoSituacao, lerSetoresSituacao, lerVencemHojeSituacao, lerVencidasSituacao,
} from './dados-situacao';
import { NumeroInicio } from './numero-inicio';

/** Os cinco números da imagem A. Demandas = soma da tabela por setor (D5); sem a migração, "—" (D21). */
export async function NumerosSituacao() {
  const [setores, esperando, vencidas, hoje, doDia, cfg, { agora }] = await Promise.all([
    lerSetoresSituacao(), lerEsperandoSituacao(), lerVencidasSituacao(), lerVencemHojeSituacao(), lerDemandasDoDia(), lerConfigSituacao(), paginaInicio(),
  ]);
  const minutos = cfg?.minutos_alerta_fila ?? MINUTOS_SEM_RESPONSAVEL_PADRAO;
  const antigas = await contarSemResponsavelAntigas(minutos);
  const t = setores ? totaisDosSetores(setores) : null;
  const indisponivel = 'indisponível: falta a atualização do banco';
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <NumeroInicio chave="esperando-pessoa" titulo="Esperando pessoa" valor={esperando?.total ?? null}
        tom={(esperando?.total ?? 0) > 0 ? 'atencao' : 'ok'}
        detalhe={esperando ? detalheEsperando(esperando.linhas[0]?.espera_desde ?? null, agora) : undefined}
        link={{ href: '/atendimento', rotulo: 'Ver no Atendimento' }} />
      <NumeroInicio chave="demandas-abertas" titulo="Demandas abertas" valor={t?.abertas ?? null}
        detalhe={!t ? indisponivel : doDia ? `${doDia.abertasHoje} abertas hoje · ${doDia.doAgente} do agente` : undefined}
        link={{ href: '/demandas', rotulo: 'Ver todas' }} />
      <NumeroInicio chave="vencem-hoje" titulo="Vencem hoje" valor={t?.vencemHoje ?? null} tom={(t?.vencemHoje ?? 0) > 0 ? 'atencao' : 'neutro'}
        detalhe={detalheVencemHoje(hoje ?? []) ?? undefined}
        link={{ href: '/demandas?prazo=hoje', rotulo: 'Ver na lista' }} />
      <NumeroInicio chave="vencidas" titulo="Vencidas" valor={t?.vencidas ?? null} tom={(t?.vencidas ?? 0) > 0 ? 'perigo' : 'neutro'}
        detalhe={detalheMaisAtrasada(vencidas?.[0]?.prazo_em ?? null, agora) ?? undefined}
        link={{ href: '/demandas?vencidas=1', rotulo: 'Ver na lista' }} />
      <NumeroInicio chave="sem-responsavel" titulo="Sem responsável" valor={t?.semResponsavel ?? null}
        tom={(antigas ?? 0) > 0 ? 'perigo' : 'neutro'}
        detalhe={antigas === null ? undefined : `${antigas} há mais de ${minutos} min`}
        link={{ href: '/demandas?responsavel=sem', rotulo: 'Ver na lista' }} />
    </div>
  );
}
```

(Vencidas com tom `perigo`: o título "Vencidas" e o detalhe dizem o que é; a cor nunca fala sozinha.)

- [ ] **Passo 4: faixa com link**

Em `inicio/faixa-alertas.tsx`, dentro de `ItemFaixa`, troque o `<div>` do texto por:

```tsx
      <div className="flex flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <p className="font-semibold" suppressHydrationWarning>{a.titulo}</p>
          <p>{a.texto}</p>
        </div>
        <a href={a.link.href} className="shrink-0 font-semibold underline-offset-4 hover:underline">{a.link.rotulo}</a>
      </div>
```

(`<a>` e não `Link`: `#sinais-de-vida` é âncora na própria página; `/gastos-ia` recarrega a página, o que é aceitável num aviso.)

- [ ] **Passo 5: `painel-situacao.tsx`: cabeçalho e números**

1. Troque `<PageHeader titulo="Início" … />` e o `<AtualizadoHa … />` da Task 3 por:

```tsx
      <CabecalhoInicio
        titulo={<>Situação do escritório · <span className="text-brand">{dataDoTitulo(agora)}</span></>}
        subtitulo={`${saudacao(agora)}, ${primeiroNome(u.nome)}. Visão de administrador: todos os setores.`}
        acoes={(
          <>
            <Button asChild variant="outline">
              <Link href="/demandas"><ClipboardList aria-hidden size={16} strokeWidth={1.75} />Gestão das demandas</Link>
            </Button>
            <Button asChild>
              <Link href="/atendimento"><MessageCircle aria-hidden size={16} strokeWidth={1.75} />Abrir atendimento</Link>
            </Button>
          </>
        )}
        atualizadoEm={agora.toISOString()}
      />
```

2. Troque a `<section aria-labelledby="numeros-do-dia" …>…</section>` inteira por `<NumerosSituacao />`, logo depois da `<FaixaAlertas … />` (a ordem fica: cabeçalho, faixa, números, os três cartões, avisos).
3. Apague o que ficou sem uso: as consultas `contarDemandas`, `abertasSemResponsavel`, `porSetor`, `linhasSetor`, `setores`, `aguardando`, `abertas`, a função `Numero`, `PageHeader`, `AtualizadoHa`, `filtrarConsulta`, `lerFiltrosDemandas`, `contarConversasAguardando`, `contarDemandasAbertas`, `temNivel`. Imports novos: `CabecalhoInicio`, `NumerosSituacao`, `Button`, `Link`, `ClipboardList`, `MessageCircle`, `dataDoTitulo`, `primeiroNome`, `saudacao`.

- [ ] **Passo 6: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/inicio-situacao.spec.ts e2e/inicio-vencimentos.spec.ts e2e/configuracoes.spec.ts e2e/gastos-ia.spec.ts`
Expected: tudo verde.

- [ ] **Passo 7: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Painel de situação — cabeçalho, faixa com fila atrasada e links, e os cinco números somados por setor

O teste de vencimentos do Início (Parte C) lê os números pelo contrato data-numero.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Painel de situação. Demandas por setor, Esperando pessoa agora, Vencidas e Avisos

**Files:**
- Modify: `inicio/dados-inicio.ts`, `inicio/painel-situacao.tsx` (versão final, listada inteira)
- Create: `inicio/tabela-setores.tsx`, `inicio/lista-esperando.tsx`, `inicio/lista-vencidas.tsx`, `inicio/lista-avisos.tsx`
- Modify: `apps/painel/e2e/inicio-situacao.spec.ts`

**Interfaces:**
- Consumes: `lerSetoresSituacao`, `lerEsperandoSituacao`, `lerVencidasSituacao`, `lerConfigSituacao` (Tasks 4–5); `separarSetores`, `barraDoSetor`, `textoSemAbertas`, `hrefDoSetor`, `totaisDosSetores`; `ItemConversa` (`atendimento/item-conversa.tsx`); `lerLimites` (`lib/atendimento.ts`); `PrazoTexto`; `marcarAlertaLido` (`inicio/acoes.ts`).
- Produces: `lerLimitesEspera()`, `lerNomesPessoas()` (em `dados-inicio.ts`, usados pelas duas versões); `TabelaSetores()` (tabela "Demandas por setor"); `ListaEsperando({ id, titulo, extra, dados, limites, estadoCtx, vazio, rodape })` (comum); `ListaVencidas()`; `ListaAvisos({ dados, extra })` (comum, `id="avisos"`).

- [ ] **Passo 1: e2e que falham**

Em `apps/painel/e2e/inicio-situacao.spec.ts`, acrescente:

```ts
test('Demandas por setor: linha do setor com barra em texto, link filtrado, Triagem e soma igual ao cartão', async ({ page }) => {
  const NOME = 'E2E G2 Setor';
  await db.from('chamados').delete().like('titulo', `${P} setor%`);
  await db.from('setores').delete().eq('nome', NOME);
  const { data: setor } = await db.from('setores').insert({ nome: NOME }).select('id').single();
  const { data: admin } = await db.from('usuarios').select('id').eq('email', ADMIN.email).single();
  try {
    await demandaE2e({ titulo: `${P} setor hoje`, setor: NOME, status: 'em_andamento', prioridade: 'urgente', prazoEm: fimDeHoje() });
    await demandaE2e({ titulo: `${P} setor vencida`, setor: NOME, status: 'em_andamento', prazoEm: '2020-01-02T21:00:00Z', responsavelId: admin!.id });
    await demandaE2e({ titulo: `${P} setor depois`, setor: NOME, prazoEm: new Date(Date.now() + 10 * 86_400_000).toISOString() });
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    const tabela = page.getByRole('table', { name: 'Demandas por setor' });
    const linha = tabela.getByRole('row', { name: new RegExp(NOME) });
    // Situação (barra) · Abertas · Vencem hoje · Vencidas · Sem responsável · Urgentes
    await expect(linha.getByRole('cell')).toHaveText(['', '3', '1', '1', '2', '1']);
    await expect(linha.getByRole('img')).toHaveAttribute('aria-label', '1 vencida, 1 vence hoje, 1 no prazo');
    await expect(linha.getByRole('link', { name: NOME })).toHaveAttribute('href', `/demandas?setor=${setor!.id}`);
    // Os cartões são a soma da tabela (D5).
    const abertas = await tabela.locator('tbody tr').evaluateAll((linhas) =>
      linhas.reduce((s, l) => s + Number((l as HTMLTableRowElement).cells[2]?.textContent ?? 0), 0));
    expect(abertas).toBe(await numeroInicio(page, 'demandas-abertas'));
  } finally {
    await db.from('chamados').delete().eq('setor_id', setor!.id);
    await db.from('setores').delete().eq('id', setor!.id);
  }
});

test('Esperando pessoa agora (cronômetro), Vencidas e um aviso que some com OK', async ({ page }) => {
  // Sobras de outros specs com espera entrariam antes na lista de 5 (mesmo cuidado do atendimento-lista).
  await db.from('conversas').delete().not('aguardando_pessoa_desde', 'is', null);
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  await db.from('alertas').delete().like('mensagem', 'E2E G2 aviso%');
  const { data: c } = await db.from('conversas').insert({
    telefone: `${PREFIXO_TEL}0009`, aguardando_pessoa_desde: new Date(Date.now() - 18 * 60_000).toISOString(), motivo_pessoa: 'pediu para falar com pessoa',
  }).select('id').single();
  await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'quero falar com alguém', processada_em: new Date().toISOString() });
  const vencida = await demandaE2e({ titulo: `${P} muito vencida`, setor: 'Fiscal', status: 'em_andamento', prazoEm: '2019-01-02T21:00:00Z' });
  await db.from('alertas').insert({ nivel: 'aviso', mensagem: 'E2E G2 aviso: contato novo sem empresa' });
  try {
    await entrar(page, ADMIN.email, SENHA);
    await abrirInicio(page, 'situacao');
    const esperando = page.getByRole('region', { name: 'Esperando pessoa agora' });
    const item = esperando.locator(`a[href="/atendimento/${c!.id}"]`);
    await expect(item.locator('[data-espera="vermelho"]')).toContainText('18 min');
    await expect(item).toContainText('pediu para falar com pessoa');

    const vencidas = page.getByRole('region', { name: /^Vencidas/ });
    const linhaVencida = vencidas.getByRole('link', { name: new RegExp(`#${vencida.numero}`) });
    await expect(linhaVencida).toHaveAttribute('href', `/demandas?demanda=${vencida.id}`);
    await expect(linhaVencida).toContainText('venceu 02/01');
    await expect(linhaVencida).toContainText('sem responsável');

    // Por id: o toaster também é uma região chamada "Avisos".
    const avisos = page.locator('#avisos');
    const aviso = avisos.getByRole('listitem').filter({ hasText: 'E2E G2 aviso: contato novo sem empresa' });
    await aviso.getByRole('button', { name: 'ok' }).click();
    await expect(aviso).toHaveCount(0);
  } finally {
    await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
    await db.from('alertas').delete().like('mensagem', 'E2E G2 aviso%');
    await limparDemandasE2e(P);
  }
});
```

Run: `cd apps/painel && pnpm exec playwright test e2e/inicio-situacao.spec.ts`
Expected: FAIL (tabela, listas e região de avisos novas não existem).

- [ ] **Passo 2: leitores comuns**

Em `inicio/dados-inicio.ts`, acrescente (`import { lerLimites } from '@/lib/atendimento';`):

```ts
/** Limites do cronômetro (limites_espera, Parte E; padrão quando não dá para ler). */
export const lerLimitesEspera = cache(async () => {
  const { sb } = await paginaInicio();
  return lerLimites((await sb.rpc('limites_espera')).data);
});

/** Nomes da equipe para "com Bruno" na linha de estado das conversas (como a lista do Atendimento lê). */
export const lerNomesPessoas = cache(async () => {
  const { sb } = await paginaInicio();
  const { data } = await sb.from('usuarios').select('id, nome');
  return new Map((data ?? []).map((p) => [p.id, p.nome]));
});
```

- [ ] **Passo 3: `tabela-setores.tsx`**

```tsx
import { CircleAlert, GitFork } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { barraDoSetor, hrefDoSetor, separarSetores, textoSemAbertas, type LinhaSetor } from '@/lib/inicio';
import { lerSetoresSituacao } from './dados-situacao';

const zero = 'text-subtle';
const celula = 'tabular px-2 py-3 text-right text-base';

/** "Demandas por setor" (imagem A): uma linha por setor com abertas e a Triagem; setores sem nenhuma vão para a nota. */
export async function TabelaSetores() {
  const linhas = await lerSetoresSituacao();
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="titulo-setores" className="text-sm font-bold uppercase tracking-wide text-brand">Demandas por setor</h2>
        <span className="text-sm text-subtle">clique no setor para abrir a lista filtrada</span>
      </div>
      {linhas === null ? (
        <p className="text-sm text-muted">Demandas por setor indisponíveis agora: falta a atualização do banco ou a leitura falhou.</p>
      ) : (
        <Corpo linhas={linhas} />
      )}
    </Card>
  );
}

function Corpo({ linhas }: { linhas: LinhaSetor[] }) {
  const { visiveis, semAbertas } = separarSetores(linhas);
  const maior = Math.max(0, ...visiveis.map((l) => l.abertas));
  const nota = textoSemAbertas(semAbertas);
  return (
    <>
      <div className="overflow-x-auto">
        <table aria-labelledby="titulo-setores" className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-bold uppercase tracking-wide text-muted">
              <th scope="col" className="px-2 py-2 text-left">Setor</th>
              <th scope="col" className="px-2 py-2 text-left">Situação</th>
              <th scope="col" className="px-2 py-2 text-right">Abertas</th>
              <th scope="col" className="px-2 py-2 text-right">Vencem hoje</th>
              <th scope="col" className="px-2 py-2 text-right">Vencidas</th>
              <th scope="col" className="px-2 py-2 text-right">Sem responsável</th>
              <th scope="col" className="px-2 py-2 text-right">Urgentes</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((l) => {
              const b = barraDoSetor(l, maior);
              const triagem = l.setorId === null;
              return (
                <tr key={l.setorId ?? 'triagem'} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-2 py-3 text-left font-bold">
                    <Link href={hrefDoSetor(l.setorId)} className={cn('inline-flex items-center gap-1 hover:underline', triagem ? 'text-brand' : 'text-foreground')}>
                      {triagem && <GitFork aria-hidden size={14} strokeWidth={1.75} />}{l.setor}
                    </Link>
                  </th>
                  <td className="w-1/4 px-2 py-3">
                    <div role="img" aria-label={b.rotulo} className="flex h-2.5 w-full overflow-hidden rounded-sm bg-surface-muted">
                      <span className="h-full bg-success" style={{ width: `${b.noPrazo}%` }} />
                      <span className="h-full bg-warning-decor" style={{ width: `${b.venceHoje}%` }} />
                      <span className="h-full bg-danger" style={{ width: `${b.vencida}%` }} />
                    </div>
                  </td>
                  <td className={cn(celula, 'font-bold text-foreground')}>{l.abertas}</td>
                  <td className={cn(celula, l.vencemHoje > 0 ? 'font-bold text-warning' : zero)}>{l.vencemHoje}</td>
                  <td className={cn(celula, l.vencidas > 0 ? 'font-bold text-danger' : zero)}>
                    <span className="inline-flex items-center justify-end gap-1">
                      {l.vencidas > 0 && <CircleAlert aria-hidden size={14} strokeWidth={2} />}{l.vencidas}
                    </span>
                  </td>
                  <td className={cn(celula, l.semResponsavel > 0 ? 'text-foreground' : zero)}>{l.semResponsavel}</td>
                  <td className={cn(celula, l.urgentes > 0 ? 'font-bold text-danger' : zero)}>{l.urgentes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visiveis.length === 0 && <p className="text-sm text-muted">Nenhuma demanda aberta.</p>}
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1"><span aria-hidden className="size-3 rounded-sm bg-success" />no prazo</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="size-3 rounded-sm bg-warning-decor" />vence hoje</span>
        <span className="inline-flex items-center gap-1"><span aria-hidden className="size-3 rounded-sm bg-danger" />vencida</span>
        {nota && <span className="text-subtle">{nota}</span>}
      </p>
    </>
  );
}
```

(Confira com `grep -rn "GitFork\|Split" apps/painel/src | head -2` o ícone que o projeto já usa para Triagem; sem nenhum, `Split`.)

- [ ] **Passo 4: `lista-esperando.tsx` (comum às duas versões)**

```tsx
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import type { LimitesEspera, LinhaAtendimento, linhaDeEstado } from '@/lib/atendimento';
import { ItemConversa } from '../atendimento/item-conversa';

/**
 * Conversas esperando (imagens A e B): o mesmo item da lista do Atendimento (cronômetro, não lidas, linha de estado),
 * quem espera há mais tempo primeiro. Situação: todas com espera (D6); Mesa: "esperando você".
 */
export function ListaEsperando({ id, titulo, extra, dados, limites, estadoCtx, vazio, rodape }: {
  id: string; titulo: string; extra?: ReactNode; dados: { linhas: LinhaAtendimento[]; total: number } | null;
  limites: LimitesEspera; estadoCtx: Parameters<typeof linhaDeEstado>[1]; vazio: string; rodape?: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <Card className="gap-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={id} className="text-sm font-bold uppercase tracking-wide text-brand">{titulo}</h2>
          {extra && <span className="text-sm text-subtle">{extra}</span>}
        </div>
        {dados === null ? (
          <p className="text-sm text-muted">As conversas não puderam ser lidas agora.</p>
        ) : dados.linhas.length === 0 ? (
          <p className="text-sm text-muted">{vazio}</p>
        ) : (
          <ul className="-mx-3 divide-y divide-border">
            {dados.linhas.map((l) => (
              <li key={l.id}><ItemConversa l={l} href={`/atendimento/${l.id}`} ativa={false} limites={limites} estadoCtx={estadoCtx} /></li>
            ))}
          </ul>
        )}
        {rodape}
      </Card>
    </section>
  );
}
```

(`linhaDeEstado` só como tipo: `import type` não traz o código. Se o lint reclamar de `import type` de função, use `import { type linhaDeEstado }`.)

- [ ] **Passo 5: `lista-vencidas.tsx`**

```tsx
import { CircleAlert } from 'lucide-react';
import Link from 'next/link';
import { PrazoTexto } from '@/components/patterns/prioridade-prazo';
import { Card } from '@/components/ui/card';
import { totaisDosSetores } from '@/lib/inicio';
import { paginaInicio } from './dados-inicio';
import { lerSetoresSituacao, lerVencidasSituacao } from './dados-situacao';

/** As cinco vencidas mais antigas (imagem A); o total é o do cartão (soma por setor). */
export async function ListaVencidas() {
  const [vencidas, setores, { agora }] = await Promise.all([lerVencidasSituacao(), lerSetoresSituacao(), paginaInicio()]);
  const total = setores ? totaisDosSetores(setores).vencidas : vencidas?.length ?? null;
  return (
    <section aria-labelledby="titulo-vencidas">
      <Card className="gap-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="titulo-vencidas" className="flex items-center gap-1 text-sm font-bold uppercase tracking-wide text-danger">
            <CircleAlert aria-hidden size={14} strokeWidth={2} />Vencidas
          </h2>
          <span className="tabular text-sm text-subtle">{total ?? '—'}</span>
        </div>
        {vencidas === null ? (
          <p className="text-sm text-muted">As vencidas não puderam ser lidas agora.</p>
        ) : vencidas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma demanda vencida.</p>
        ) : (
          <ul className="divide-y divide-border">
            {vencidas.map((d) => (
              <li key={d.id}>
                <Link href={`/demandas?demanda=${d.id}`} className="flex items-center gap-3 py-2 hover:bg-surface-muted">
                  <span className="tabular w-14 shrink-0 font-bold text-foreground">#{d.numero}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{d.titulo}</span>
                    <span className="block truncate text-sm text-muted">
                      {[d.empresa ?? 'sem empresa', d.setor ?? 'Triagem'].join(' · ')} · {d.responsavel ?? <em>sem responsável</em>}
                    </span>
                  </span>
                  <PrazoTexto prazo={d.prazo_em} pausadoDesde={d.prazo_pausado_desde} concluidaEm={null} agora={agora} className="shrink-0 text-sm" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
```

A região se chama "Vencidas" (o número ao lado fica fora do título; o e2e usa `/^Vencidas/`).

- [ ] **Passo 6: `lista-avisos.tsx` (comum)**

```tsx
import type { Database } from '@escritorio/db';
import { Bell } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { marcarAlertaLido } from './acoes';

type Alerta = Database['public']['Tables']['alertas']['Row'];

const NIVEL_AVISO: Record<string, { rotulo: string; variant: 'danger' | 'warning' | 'info' }> = {
  critico: { rotulo: 'Crítico', variant: 'danger' },
  operacional: { rotulo: 'Operacional', variant: 'warning' },
  aviso: { rotulo: 'Aviso', variant: 'info' },
};

/** Avisos ainda não vistos (os de hoje, com OK). `id="avisos"`: o cartão dos sinais e o bloco Sistema levam até aqui. */
export function ListaAvisos({ dados, extra }: { dados: { alertas: Alerta[]; total: number } | null; extra: string }) {
  const alertas = dados?.alertas ?? [];
  return (
    <section id="avisos" aria-labelledby="titulo-avisos" className="scroll-mt-4">
      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 pt-4">
          <h2 id="titulo-avisos" className="text-sm font-bold uppercase tracking-wide text-brand">Avisos</h2>
          <span className="text-sm text-subtle">{extra} · {dados ? `${dados.total} ${dados.total === 1 ? 'não visto' : 'não vistos'}` : 'indisponíveis'}</span>
        </div>
        {alertas.length === 0 ? (
          <EmptyState icone={Bell} titulo="Nenhum aviso." descricao="Os avisos do agente e do sistema aparecem aqui." className="py-6" />
        ) : (
          <ul className="divide-y divide-border">
            {alertas.map((a) => {
              const nivel = NIVEL_AVISO[a.nivel] ?? NIVEL_AVISO.aviso!;
              return (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                  <Badge variant={nivel.variant} className="mt-0.5">{nivel.rotulo}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-foreground', a.nivel === 'critico' && 'font-medium')}>{a.mensagem}</p>
                    <RelativeTime data={a.criado_em} className="text-xs text-muted" />
                  </div>
                  <form action={marcarAlertaLido.bind(null, a.id)}>
                    <Button type="submit" variant="outline" size="sm" title="Marcar como visto">ok</Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </section>
  );
}
```

- [ ] **Passo 7: `painel-situacao.tsx` final**

Substitua o arquivo inteiro por:

```tsx
import { ClipboardList, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { Button } from '@/components/ui/button';
import { dataDoTitulo, primeiroNome, saudacao, situacaoTeto } from '@/lib/inicio';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { CabecalhoInicio } from './cabecalho-inicio';
import { CartaoAgente } from './cartao-agente';
import { CartaoGasto } from './cartao-gasto';
import { CartaoSinais } from './cartao-sinais';
import { lerAvisos, lerLimitesEspera, lerNomesPessoas, paginaInicio } from './dados-inicio';
import { lerConfigSituacao, lerEsperandoSituacao, lerGastoSituacao, lerSinaisSituacao } from './dados-situacao';
import { FaixaAlertas } from './faixa-alertas';
import { ListaAvisos } from './lista-avisos';
import { ListaEsperando } from './lista-esperando';
import { ListaVencidas } from './lista-vencidas';
import { NumerosSituacao } from './numeros-situacao';
import { TabelaSetores } from './tabela-setores';

/**
 * Painel de situação (imagem A), só para o administrador (D1): faixa só com problema, cinco números, agente, sinais,
 * gasto × teto, demandas por setor, quem espera agora, vencidas e avisos. Recarrega pelo tempo real de sempre
 * (conversas, demandas) e a cada minuto (sinais, pausa e gasto, que não estão no Realtime, D2).
 */
export async function PainelSituacao({ u }: { u: UsuarioPainel }) {
  const [{ agora }, cfg, gasto, sinais, esperando, limites, nomes, avisos] = await Promise.all([
    paginaInicio(), lerConfigSituacao(), lerGastoSituacao(u.id), lerSinaisSituacao(), lerEsperandoSituacao(),
    lerLimitesEspera(), lerNomesPessoas(), lerAvisos(),
  ]);
  const teto = cfg && gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)) : null;
  return (
    <div data-inicio="situacao" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <CabecalhoInicio
        titulo={<>Situação do escritório · <span className="text-brand">{dataDoTitulo(agora)}</span></>}
        subtitulo={`${saudacao(agora)}, ${primeiroNome(u.nome)}. Visão de administrador: todos os setores.`}
        acoes={(
          <>
            <Button asChild variant="outline">
              <Link href="/demandas"><ClipboardList aria-hidden size={16} strokeWidth={1.75} />Gestão das demandas</Link>
            </Button>
            <Button asChild>
              <Link href="/atendimento"><MessageCircle aria-hidden size={16} strokeWidth={1.75} />Abrir atendimento</Link>
            </Button>
          </>
        )}
        atualizadoEm={agora.toISOString()}
      />
      <FaixaAlertas teto={teto} sinais={sinais} />
      <NumerosSituacao />
      <div className="grid gap-4 lg:grid-cols-3">
        <CartaoAgente u={u} />
        <CartaoSinais />
        <CartaoGasto u={u} />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2"><TabelaSetores /></div>
        <div className="flex flex-col gap-4">
          <ListaEsperando
            id="titulo-esperando" titulo="Esperando pessoa agora" extra="mais antigo primeiro" dados={esperando} limites={limites}
            estadoCtx={{ usuarioId: u.id, nomes, pausaGeral: cfg?.agente_pausado ?? null }} vazio="Ninguém esperando agora."
          />
          <ListaVencidas />
        </div>
      </div>
      <ListaAvisos dados={avisos} extra="do agente e do sistema" />
    </div>
  );
}
```

- [ ] **Passo 8: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/inicio-situacao.spec.ts e2e/inicio-vencimentos.spec.ts e2e/configuracoes.spec.ts e2e/gastos-ia.spec.ts e2e/inicio-papel.spec.ts`
Expected: tudo verde.

- [ ] **Passo 9: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Painel de situação — demandas por setor com barra e Triagem, quem espera agora, vencidas e avisos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Minha mesa. Números de ação, Minhas demandas por prazo, ABRIR e CONCLUIR

**Files:**
- Create: `inicio/dados-mesa.ts`, `inicio/numeros-mesa.tsx`, `inicio/demandas-por-prazo.tsx`, `inicio/botoes-demanda-inicio.tsx`
- Modify: `inicio/minha-mesa.tsx`
- Modify: `apps/painel/src/app/(painel)/demandas/acoes.ts`, `demandas/acoes.test.ts`
- Create: `apps/painel/e2e/inicio-mesa.spec.ts`
- Modify: `apps/painel/e2e/apoio-inicio.ts`

**Interfaces:**
- Consumes: `paginaInicio`; `lerDemandasMesa`, `agruparPorPrazo`, `detalheDaDemanda`, `ROTULOS_MESA`, `subtituloMinhas`, `textoConcluidasHoje` (Task 2); `contarConversasAguardando`; `concluirDemanda`, `assumirDemanda` (`demandas/acoes.ts`); `PrioridadeTexto`, `PrazoTexto`; `ConfirmDialog`; `toast`.
- Produces: `lerMinhasDemandas(usuarioId)`, `contarMinhas(usuarioId)`, `contarSemResponsavelMesa(chaveSetores)`, `contarConcluidasHoje(usuarioId)`; `NumerosMesa({ u, podeAtendimento })` (`data-numero` = `esperando-voce`, `minhas-vencidas`, `vencem-hoje`, `sem-responsavel`); `DemandasPorPrazo({ u })` (região "Minhas demandas por prazo", listas "Vencida"/"Vencem hoje"/"Próximos dias" com âncoras `#vencidas`, `#vencem-hoje`, `#proximos`); `BotaoConcluirInicio`, `BotaoAssumirInicio`; `acao()` de `demandas/acoes.ts` revalida `/demandas` **e** `/inicio` (D14).

- [ ] **Passo 1: testes que falham**

Em `apps/painel/src/app/(painel)/demandas/acoes.test.ts`, acrescente ao `describe('ações da demanda', …)`:

```ts
  it('assumir e concluir revalidam também o Início (G2, D14)', async () => {
    const { revalidatePath } = await import('next/cache');
    vi.mocked(revalidatePath).mockClear();
    const { assumirDemanda, concluirDemanda } = await import('./acoes');
    expect(await assumirDemanda(ID)).toEqual({ ok: true, mensagem: 'Demanda assumida.' });
    expect(await concluirDemanda(ID)).toEqual({ ok: true, mensagem: 'Demanda concluída.' });
    expect(vi.mocked(revalidatePath).mock.calls.map((c) => c[0])).toEqual(['/demandas', '/inicio', '/demandas', '/inicio']);
  });
```

Em `apps/painel/e2e/apoio-inicio.ts`, acrescente:

```ts
import { db } from './apoio';

/** Fim do dia de hoje em Brasília (UTC-3) menos 1 minuto: ainda hoje e no futuro. */
export function fimDeHoje(): string {
  const UM_DIA = 24 * 3600_000;
  const inicio = Math.floor((Date.now() - 3 * 3600_000) / UM_DIA) * UM_DIA + 3 * 3600_000;
  return new Date(inicio + UM_DIA - 60_000).toISOString();
}

/** Demanda "Com o cliente" (pausada) direto no banco: o apoio de demandas não grava prazo_pausado_desde. */
export async function demandaPausadaE2e(d: { titulo: string; setor: string; responsavelId: string; prazoEm: string }): Promise<{ id: string; numero: number }> {
  await db.from('chamados').delete().eq('titulo', d.titulo);
  const { data: s } = await db.from('setores').select('id').eq('nome', d.setor).single();
  const { data, error } = await db.from('chamados').insert({
    titulo: d.titulo, setor_id: s!.id, responsavel_id: d.responsavelId, status: 'aguardando_cliente', prazo_em: d.prazoEm,
    prazo_pausado_desde: new Date(Date.now() - 3600_000).toISOString(), origem: 'equipe',
  } as never).select('id, numero').single();
  if (error) throw error;
  return { id: data.id as string, numero: Number(data.numero) };
}
```

(Em `inicio-situacao.spec.ts`, troque a função `fimDeHoje` local pela importada de `./apoio-inicio`.)

`apps/painel/e2e/inicio-mesa.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';
import { abrirInicio, cartaoNumero, demandaPausadaE2e, fimDeHoje, numeroInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
const P = 'E2E-G2M';
const ANA = { email: 'ana-mesa@e2e.local', nome: 'Ana Mesa' };
let ana = '';

test.beforeEach(async () => {
  await limparDemandasE2e(P);
  ana = await criarUsuarioTeste({ email: ANA.email, senha: SENHA, nome: ANA.nome, papel: 'atendente', setores: ['Fiscal'] });
});
test.afterAll(() => limparDemandasE2e(P));

test('Minha mesa: saudação, setores, números iguais aos grupos e ABRIR no painel da demanda', async ({ page }) => {
  const vencida = await demandaE2e({ titulo: `${P} vencida`, setor: 'Fiscal', status: 'em_andamento', prioridade: 'alta', responsavelId: ana, prazoEm: '2020-01-02T21:00:00Z' });
  await demandaE2e({ titulo: `${P} hoje`, setor: 'Fiscal', status: 'em_andamento', prioridade: 'urgente', responsavelId: ana, prazoEm: fimDeHoje() });
  await demandaE2e({ titulo: `${P} depois`, setor: 'Fiscal', responsavelId: ana, prazoEm: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  await demandaPausadaE2e({ titulo: `${P} com o cliente`, setor: 'Fiscal', responsavelId: ana, prazoEm: '2020-01-02T21:00:00Z' });
  // De outra pessoa no mesmo setor: não é "minha".
  const bruno = await criarUsuarioTeste({ email: 'bruno-mesa@e2e.local', senha: SENHA, nome: 'Bruno Mesa', papel: 'atendente', setores: ['Fiscal'] });
  await demandaE2e({ titulo: `${P} de outra pessoa`, setor: 'Fiscal', status: 'em_andamento', prazoEm: fimDeHoje(), responsavelId: bruno });

  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Bom dia|Boa tarde|Boa noite), Ana$/);
  await expect(page.getByText(/· seus setores: Fiscal$/)).toBeVisible();
  expect(await numeroInicio(page, 'minhas-vencidas')).toBe(1);
  expect(await numeroInicio(page, 'vencem-hoje')).toBe(1);
  await expect(cartaoNumero(page, 'minhas-vencidas')).toContainText('minha demanda vencida');

  const minhas = page.getByRole('region', { name: 'Minhas demandas por prazo' });
  await expect(minhas).toContainText('4 comigo · ordenadas pelo que vence primeiro');
  await expect(minhas.getByRole('list', { name: /^Vencida/ })).toContainText(`${P} vencida`);
  await expect(minhas.getByRole('list', { name: /^Vencem hoje/ })).toContainText(`${P} hoje`);
  const proximos = minhas.getByRole('list', { name: /^Próximos dias/ });
  await expect(proximos).toContainText(`${P} depois`);
  await expect(proximos.getByRole('listitem').filter({ hasText: `${P} com o cliente` })).toContainText('pausado');
  await expect(minhas).not.toContainText(`${P} de outra pessoa`);

  // O número leva ao grupo na própria página (D11).
  await expect(cartaoNumero(page, 'minhas-vencidas').getByRole('link')).toHaveAttribute('href', '#vencidas');

  const abrir = minhas.getByRole('link', { name: `Abrir a demanda #${vencida.numero}` });
  await expect(abrir).toHaveAttribute('href', `/demandas?demanda=${vencida.id}`);
  await abrir.click();
  await expect(page.getByRole('dialog', { name: new RegExp(`Nº ${vencida.numero}`) })).toBeVisible({ timeout: 30_000 });
});

test('CONCLUIR pede confirmação, tira a demanda da mesa e conta em "Você concluiu"', async ({ page }) => {
  const d = await demandaE2e({ titulo: `${P} concluir`, setor: 'Fiscal', status: 'em_andamento', responsavelId: ana, prazoEm: fimDeHoje() });
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  const minhas = page.getByRole('region', { name: 'Minhas demandas por prazo' });
  await expect(minhas).toContainText('Você ainda não concluiu demandas hoje.');
  await minhas.getByRole('button', { name: `Concluir a demanda #${d.numero}` }).click();
  const janela = page.getByRole('dialog');
  await expect(janela).toContainText(`Concluir a demanda #${d.numero}?`);
  await janela.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Demanda concluída.')).toBeVisible();
  await expect(minhas).not.toContainText(`${P} concluir`);
  await expect(minhas).toContainText('Você concluiu 1 demanda hoje.');
  expect((await db.from('chamados').select('status').eq('id', d.id).single()).data?.status).toBe('concluido');
});
```

(O nome do painel lateral da demanda é "Nº <número> …" — é o que o `acessibilidade.spec.ts` procura com `/Nº [0-9]+/`.)

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/demandas/acoes.test.ts" && cd apps/painel && pnpm exec playwright test e2e/inicio-mesa.spec.ts`
Expected: FAIL (`revalidatePath('/inicio')` não chamado; região "Minhas demandas por prazo" não existe).

- [ ] **Passo 2: ações revalidam o Início**

Em `apps/painel/src/app/(painel)/demandas/acoes.ts`, na função `acao`, troque `revalidatePath('/demandas');` por:

```ts
  revalidatePath('/demandas');
  // ASSUMIR e CONCLUIR também saem da Minha mesa (G2, D14): o Início relê na hora.
  revalidatePath('/inicio');
```

(Confira com `grep -n "revalidatePath" "apps/painel/src/app/(painel)/demandas/acoes.test.ts"` que nenhum teste antigo espera só `/demandas` com `toHaveBeenCalledTimes(1)`; se algum esperar, ajuste a contagem e diga no commit.)

- [ ] **Passo 3: leitores da Minha mesa**

`inicio/dados-mesa.ts`:

```ts
import 'server-only';
import { cache } from 'react';
import type { LinhaAtendimento } from '@/lib/atendimento';
import { inicioDoDiaSP } from '@/lib/demandas';
import { lerEstadoSistema } from '@/lib/inicio';
import { lerDemandasMesa } from '@/lib/minha-mesa';
import { paginaInicio } from './dados-inicio';

// Leituras da Minha mesa. Nada aqui lê configuracoes, sinais_vida, uso_ia nem gastos (Restrições globais): o estado do
// sistema vem só de estado_sistema_resumo (sem custos). Tudo passa pela RLS da pessoa (D13).

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const COLUNAS = 'id, numero, titulo, empresa, setor, status, prioridade, prazo_em, prazo_pausado_desde, vencida';

/** Minhas demandas abertas (até 50): a que vence primeiro em cima; sem prazo por último. */
export const lerMinhasDemandas = cache(async (usuarioId: string) => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('demandas_lista').select(COLUNAS, { count: 'exact' })
    .eq('responsavel_id', usuarioId).neq('status', 'concluido')
    .order('prazo_em', { ascending: true, nullsFirst: false }).order('numero', { ascending: true }).limit(50);
  return error ? null : { lista: lerDemandasMesa(data), total: count ?? 0 };
});

/** "minhas vencidas" e "vencem hoje" exatos (a lista acima tem limite), com a mesma regra dos grupos (D11). */
export const contarMinhas = cache(async (usuarioId: string) => {
  const { sb, agora } = await paginaInicio();
  const fim = new Date(inicioDoDiaSP(agora).getTime() + UM_DIA_MS).toISOString();
  const base = () => sb.from('demandas_lista').select('id', { count: 'exact', head: true }).eq('responsavel_id', usuarioId).neq('status', 'concluido');
  const [vencidas, hoje] = await Promise.all([
    base().is('vencida', true),
    base().is('prazo_pausado_desde', null).gte('prazo_em', agora.toISOString()).lt('prazo_em', fim),
  ]);
  return { vencidas: vencidas.error ? null : vencidas.count ?? 0, hoje: hoje.error ? null : hoje.count ?? 0 };
});

/** Sem responsável nos setores da pessoa (D13). `chave` = ids dos setores separados por vírgula (cache por valor). */
export const lerSemResponsavelMesa = cache(async (chave: string) => {
  if (!chave) return { lista: [], total: 0 };
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('demandas_lista').select(COLUNAS, { count: 'exact' })
    .is('responsavel_id', null).neq('status', 'concluido').in('setor_id', chave.split(','))
    .order('prazo_em', { ascending: true, nullsFirst: false }).limit(10);
  return error ? null : { lista: lerDemandasMesa(data), total: count ?? 0 };
});

/** Demandas distintas que a pessoa concluiu desde 00:00 de Brasília (D15). */
export const contarConcluidasHoje = cache(async (usuarioId: string) => {
  const { sb, agora } = await paginaInicio();
  const { data, error } = await sb.from('chamado_eventos').select('chamado_id')
    .eq('tipo', 'conclusao').eq('usuario_id', usuarioId).gte('criado_em', inicioDoDiaSP(agora).toISOString());
  return error ? null : new Set((data ?? []).map((e) => e.chamado_id)).size;
});

/** Nomes dos setores da pessoa, para "seus setores: Pessoal e Fiscal". */
export const lerNomesDosMeusSetores = cache(async (chave: string) => {
  if (!chave) return [];
  const { sb } = await paginaInicio();
  const { data } = await sb.from('setores').select('nome').in('id', chave.split(',')).order('nome');
  return (data ?? []).map((s) => s.nome);
});

/** Conversas esperando você (a mesma conta do menu), quem espera há mais tempo primeiro. */
export const lerEsperandoVoce = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('caixa_entrada').select('*', { count: 'exact' })
    .eq('esperando_voce', true).order('espera_desde', { ascending: true }).limit(5);
  return error ? null : { linhas: (data ?? []) as unknown as LinhaAtendimento[], total: count ?? 0 };
});

/** "N com o agente hoje" (D16): com o agente, sem espera, com mensagem hoje. */
export const contarComAgenteHoje = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const { count, error } = await sb.from('caixa_entrada').select('id', { count: 'exact', head: true })
    .eq('estado', 'agente').eq('esperando_pessoa', false).gte('ultima_em', inicioDoDiaSP(agora).toISOString());
  return error ? null : count ?? 0;
});

/** estado_sistema_resumo (Task 1): só booleanos; null fora do horário ou sem a migração (D21). */
export const lerEstadoSistemaMesa = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.rpc('estado_sistema_resumo');
  return error ? null : lerEstadoSistema(data);
});
```

- [ ] **Passo 4: botões do Início (cliente)**

`inicio/botoes-demanda-inicio.tsx`:

```tsx
'use client';

import { CircleCheck, Hand } from 'lucide-react';
import { useTransition } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { assumirDemanda, concluirDemanda, type Resultado } from '../demandas/acoes';

const avisar = (r: Resultado) => (r.ok ? toast.success(r.mensagem) : toast.error(r.erro));

/** CONCLUIR da Minha mesa: a mesma ação e a mesma confirmação do painel lateral (D12, D14). */
export function BotaoConcluirInicio({ id, numero, titulo }: { id: string; numero: number; titulo: string }) {
  return (
    <ConfirmDialog
      gatilho={(
        <Button type="button" variant="outline" size="sm" aria-label={`Concluir a demanda #${numero}`}>
          <CircleCheck aria-hidden size={16} strokeWidth={1.75} />Concluir
        </Button>
      )}
      titulo={<>Concluir a demanda <strong>#{numero}</strong>?</>}
      descricao={`"${titulo}" sai das demandas abertas. Dá para reabrir depois.`}
      confirmar="Concluir"
      enviando="Concluindo…"
      variante="primary"
      tipo="concluir"
      acao={async () => { avisar(await concluirDemanda(id)); }}
    />
  );
}

/** ASSUMIR: a função do banco recusa demanda já com outra pessoa ("A demanda já está com …") e o aviso diz isso. */
export function BotaoAssumirInicio({ id, numero }: { id: string; numero: number }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button type="button" size="sm" disabled={pendente} aria-label={`Assumir a demanda #${numero}`}
      onClick={() => iniciar(async () => { avisar(await assumirDemanda(id)); })}>
      <Hand aria-hidden size={16} strokeWidth={1.75} />{pendente ? 'Assumindo…' : 'Assumir'}
    </Button>
  );
}
```

(O nome acessível "Concluir a demanda #N" contém o texto visível "Concluir": WCAG 2.5.3.)

- [ ] **Passo 5: `numeros-mesa.tsx`**

```tsx
import { CalendarClock, CircleAlert, MessageCircle, UserRoundSearch } from 'lucide-react';
import { ROTULOS_MESA } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';
import { contarConversasAguardando } from '@/lib/contadores';
import { paginaInicio } from './dados-inicio';
import { contarMinhas, lerSemResponsavelMesa } from './dados-mesa';
import { NumeroInicio } from './numero-inicio';

/** Os quatro números de ação (imagem B). Vencidas e hoje são os grupos da lista (D11) e levam até eles. */
export async function NumerosMesa({ u, podeAtendimento }: { u: UsuarioPainel; podeAtendimento: boolean }) {
  const { sb } = await paginaInicio();
  const [esperando, minhas, sem] = await Promise.all([
    podeAtendimento ? contarConversasAguardando(sb) : Promise.resolve(null), contarMinhas(u.id), lerSemResponsavelMesa(u.setores.join(',')),
  ]);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {podeAtendimento && (
        <NumeroInicio variante="mesa" chave="esperando-voce" icone={MessageCircle} valor={esperando}
          titulo={ROTULOS_MESA.esperando(esperando ?? 0)} tom={(esperando ?? 0) > 0 ? 'ok' : 'neutro'}
          link={{ href: '/atendimento', rotulo: 'abrir o Atendimento' }} />
      )}
      <NumeroInicio variante="mesa" chave="minhas-vencidas" icone={CircleAlert} valor={minhas.vencidas}
        titulo={ROTULOS_MESA.vencidas(minhas.vencidas ?? 0)} tom={(minhas.vencidas ?? 0) > 0 ? 'perigo' : 'neutro'}
        link={{ href: '#vencidas', rotulo: 'ver na lista' }} />
      <NumeroInicio variante="mesa" chave="vencem-hoje" icone={CalendarClock} valor={minhas.hoje}
        titulo={ROTULOS_MESA.hoje(minhas.hoje ?? 0)} tom={(minhas.hoje ?? 0) > 0 ? 'atencao' : 'neutro'}
        link={{ href: '#vencem-hoje', rotulo: 'ver na lista' }} />
      <NumeroInicio variante="mesa" chave="sem-responsavel" icone={UserRoundSearch} valor={sem?.total ?? null}
        titulo={ROTULOS_MESA.semResponsavel(sem?.total ?? 0)} link={{ href: '#sem-responsavel', rotulo: 'ver na lista' }} />
    </div>
  );
}
```

- [ ] **Passo 6: `demandas-por-prazo.tsx`**

```tsx
import { CalendarDays, CircleAlert, CircleCheck, Clock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { agruparPorPrazo, detalheDaDemanda, subtituloMinhas, textoConcluidasHoje, type DemandaMesa } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';
import { BotaoConcluirInicio } from './botoes-demanda-inicio';
import { paginaInicio } from './dados-inicio';
import { contarConcluidasHoje, contarMinhas, lerMinhasDemandas } from './dados-mesa';

/** "Minhas demandas por prazo" (imagem B): Vencida · Vencem hoje · Próximos dias, cada linha com ABRIR e CONCLUIR (D12). */
export async function DemandasPorPrazo({ u }: { u: UsuarioPainel }) {
  const [minhas, contagem, concluidas, { agora }] = await Promise.all([
    lerMinhasDemandas(u.id), contarMinhas(u.id), contarConcluidasHoje(u.id), paginaInicio(),
  ]);
  const g = minhas ? agruparPorPrazo(minhas.lista, agora) : null;
  return (
    <section aria-labelledby="titulo-minhas">
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-minhas" className="text-sm font-bold uppercase tracking-wide text-brand">Minhas demandas por prazo</h2>
          {minhas && <span className="text-sm text-subtle">{subtituloMinhas(minhas.total)}</span>}
        </div>
        {!g ? (
          <p className="text-sm text-muted">As suas demandas não puderam ser lidas agora.</p>
        ) : minhas!.total === 0 ? (
          <p className="text-sm text-muted">Nenhuma demanda com você agora.</p>
        ) : (
          <>
            <Grupo id="vencidas" titulo="Vencida" total={contagem.vencidas ?? g.vencidas.length} icone={<CircleAlert aria-hidden size={14} strokeWidth={2} />} cor="text-danger" borda="border-l-danger" lista={g.vencidas} agora={agora} />
            <Grupo id="vencem-hoje" titulo="Vencem hoje" total={contagem.hoje ?? g.hoje.length} icone={<Clock aria-hidden size={14} strokeWidth={2} />} cor="text-warning" borda="border-l-warning" lista={g.hoje} agora={agora} />
            <Grupo id="proximos" titulo="Próximos dias" total={g.proximos.length} icone={<CalendarDays aria-hidden size={14} strokeWidth={2} />} cor="text-foreground" borda="border-l-transparent" lista={g.proximos} agora={agora} />
            {minhas!.total > minhas!.lista.length && <p className="text-sm text-muted">Mostrando {minhas!.lista.length} de {minhas!.total}.</p>}
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
          <p className="flex items-center gap-1 text-muted">
            <CircleCheck aria-hidden size={14} strokeWidth={1.75} className="text-success" />
            {concluidas === null ? 'Não foi possível contar as concluídas de hoje.' : textoConcluidasHoje(concluidas)}
          </p>
          <Link href="/demandas?responsavel=eu" className="font-semibold text-brand underline-offset-4 hover:underline">
            Ver todas as minhas na Gestão das demandas <span aria-hidden>→</span>
          </Link>
        </div>
      </Card>
    </section>
  );
}

function Grupo({ id, titulo, total, icone, cor, borda, lista, agora }: {
  id: string; titulo: string; total: number; icone: ReactNode; cor: string; borda: string; lista: DemandaMesa[]; agora: Date;
}) {
  if (lista.length === 0) return null;
  return (
    <div id={id} className="scroll-mt-4">
      <h3 id={`${id}-titulo`} className={cn('flex items-center gap-1 border-b border-current pb-1 text-xs font-bold uppercase tracking-wide', cor)}>
        {icone}{titulo} <span className="tabular text-muted">{total}</span>
      </h3>
      <ul aria-labelledby={`${id}-titulo`} className="divide-y divide-border">
        {lista.map((d) => <LinhaMinha key={d.id} d={d} borda={borda} agora={agora} />)}
      </ul>
    </div>
  );
}

function LinhaMinha({ d, borda, agora }: { d: DemandaMesa; borda: string; agora: Date }) {
  const [empresa, setor, status] = detalheDaDemanda(d);
  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 py-3 pl-3', borda)}>
      <span className="tabular w-16 shrink-0 font-bold text-foreground">#{d.numero}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{d.titulo}</p>
        <p className="truncate text-sm text-muted"><span className="font-semibold text-brand">{empresa}</span> · {setor} · {status}</p>
      </div>
      <PrioridadeTexto prioridade={d.prioridade} caixaAlta className="w-20" />
      <PrazoTexto prazo={d.prazo_em} pausadoDesde={d.prazo_pausado_desde} concluidaEm={null} agora={agora} className="w-28 text-sm" />
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/demandas?demanda=${d.id}`} aria-label={`Abrir a demanda #${d.numero}`}>Abrir</Link>
        </Button>
        <BotaoConcluirInicio id={d.id} numero={d.numero} titulo={d.titulo} />
      </div>
    </li>
  );
}
```

(O nome da lista é o do `h3`: "Vencida 1", "Vencem hoje 1", "Próximos dias 2" — o e2e usa `/^Vencida/`.)

- [ ] **Passo 7: `minha-mesa.tsx` usa as peças**

No `return` de `minha-mesa.tsx`, troque o bloco `{podeAtendimento && ( <div className="grid …"> <NumeroInicio … /> </div> )}` por:

```tsx
      <NumerosMesa u={u} podeAtendimento={podeAtendimento} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <DemandasPorPrazo u={u} />
        </div>
      </div>
```

e o subtítulo do cabeçalho por `subtitulo={<>{capitalizar(dataDoTitulo(agora))} · {setores.length ? <>seus setores: <strong className="text-foreground">{juntarNomes(setores)}</strong></> : 'sem setor marcado'}</>}`, com `const setores = await lerNomesDosMeusSetores(u.setores.join(','));` logo depois do `paginaInicio()`. Apague a leitura `contarConversasAguardando` e os imports sem uso (`MessageCircle`, `NumeroInicio`, `ROTULOS_MESA`, `contarConversasAguardando`); acrescente `NumerosMesa`, `DemandasPorPrazo`, `lerNomesDosMeusSetores`, `juntarNomes`.

- [ ] **Passo 8: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/inicio-mesa.spec.ts e2e/inicio-papel.spec.ts e2e/atendimento-lista.spec.ts e2e/demandas-painel.spec.ts`
Expected: tudo verde (`demandas-painel` continua: as ações só ganharam uma revalidação).

- [ ] **Passo 9: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Minha mesa — números de ação e minhas demandas por prazo com ABRIR e CONCLUIR

As ações de assumir e concluir passam a revalidar também o Início.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Minha mesa. Sem responsável (ASSUMIR), conversas esperando, atalhos, Sistema e avisos

**Files:**
- Create: `inicio/sem-responsavel-mesa.tsx`, `inicio/atalhos-mesa.tsx`, `inicio/bloco-sistema.tsx`
- Modify: `inicio/minha-mesa.tsx` (versão final, listada inteira)
- Modify: `apps/painel/e2e/inicio-mesa.spec.ts`

**Interfaces:**
- Consumes: `lerSemResponsavelMesa`, `lerEsperandoVoce`, `contarComAgenteHoje`, `lerEstadoSistemaMesa`, `lerNomesDosMeusSetores` (Task 7); `lerAvisos`, `lerLimitesEspera`, `lerNomesPessoas` (dados-inicio); `ListaEsperando`, `ListaAvisos` (Task 6); `BotaoAssumirInicio` (Task 7); `atalhosDaMesa`, `linhasDoSistema`, `textoComAgenteHoje` (Task 2).
- Produces: `SemResponsavelMesa({ u })` (região "Sem responsável nos meus setores", `id="sem-responsavel"`); `AtalhosMesa({ u })` (navegação "Atalhos"); `BlocoSistema()` (`data-testid="inicio-sistema"`, linhas com `data-sistema="agente|whatsapp|fila"`).

- [ ] **Passo 1: e2e que falham**

Em `apps/painel/e2e/inicio-mesa.spec.ts`, acrescente:

```ts
const PREFIXO_TEL = '553197004';

test('Sem responsável nos meus setores: só do setor dela, ASSUMIR leva para as minhas', async ({ page }) => {
  const fiscal = await demandaE2e({ titulo: `${P} sem resp Fiscal`, setor: 'Fiscal', prazoEm: fimDeHoje() });
  await demandaE2e({ titulo: `${P} sem resp Pessoal`, setor: 'Pessoal', prazoEm: fimDeHoje() });
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  const sem = page.getByRole('region', { name: 'Sem responsável nos meus setores' });
  await expect(sem).toContainText(`${P} sem resp Fiscal`);
  await expect(sem).not.toContainText(`${P} sem resp Pessoal`);
  await sem.getByRole('button', { name: `Assumir a demanda #${fiscal.numero}` }).click();
  await expect(page.getByText('Demanda assumida.')).toBeVisible();
  await expect(sem).not.toContainText(`${P} sem resp Fiscal`);
  await expect(page.getByRole('region', { name: 'Minhas demandas por prazo' })).toContainText(`${P} sem resp Fiscal`);
});

test('ASSUMIR de uma demanda que outra pessoa pegou antes: o aviso do banco e nada muda', async ({ page }) => {
  const d = await demandaE2e({ titulo: `${P} disputada`, setor: 'Fiscal', prazoEm: fimDeHoje() });
  const bruno = await criarUsuarioTeste({ email: 'bruno-mesa@e2e.local', senha: SENHA, nome: 'Bruno Mesa', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  await db.from('chamados').update({ responsavel_id: bruno }).eq('id', d.id);
  await page.getByRole('button', { name: `Assumir a demanda #${d.numero}` }).click();
  await expect(page.getByText('A demanda já está com Bruno Mesa.')).toBeVisible();
  expect((await db.from('chamados').select('responsavel_id').eq('id', d.id).single()).data?.responsavel_id).toBe(bruno);
});

test('"Só as minhas": a seção sem responsável fica vazia (a regra de leitura vale)', async ({ page }) => {
  await demandaE2e({ titulo: `${P} sem resp oculta`, setor: 'Fiscal', prazoEm: fimDeHoje() });
  await db.from('usuario_permissoes').update({ nivel: 'minhas' }).eq('usuario_id', ana).eq('modulo', 'demandas');
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  const sem = page.getByRole('region', { name: 'Sem responsável nos meus setores' });
  await expect(sem).toContainText('Nenhuma demanda sem responsável nos seus setores.');
  expect(await numeroInicio(page, 'sem-responsavel')).toBe(0);
});

test('conversas esperando você (cronômetro e não lidas), atalhos e o bloco Sistema sem pausar nem gasto', async ({ page }) => {
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: c } = await db.from('conversas').insert({
    telefone: `${PREFIXO_TEL}0001`, aguardando_pessoa_desde: new Date(Date.now() - 7 * 60_000).toISOString(), motivo_pessoa: 'pediu para falar com pessoa',
  }).select('id').single();
  await db.from('chamados').insert({ conversa_id: c!.id, setor_id: setor!.id, titulo: `${P} da conversa` });
  for (const [i, texto] of ['um', 'dois', 'três'].entries()) {
    await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: texto,
      criado_em: new Date(Date.now() - (3 - i) * 1000).toISOString(), processada_em: new Date().toISOString() });
  }
  try {
    await entrar(page, ANA.email, SENHA);
    await abrirInicio(page, 'mesa');
    const conversas = page.getByRole('region', { name: 'Conversas esperando você' });
    const item = conversas.locator(`a[href="/atendimento/${c!.id}"]`);
    await expect(item.locator('[data-espera="ambar"]')).toContainText('7 min');
    await expect(item.getByLabel('3 mensagens não lidas')).toBeVisible();
    await expect(conversas).toContainText(/com o agente hoje/);
    await expect(conversas.getByRole('link', { name: 'Abrir atendimento' })).toHaveAttribute('href', '/atendimento');

    const atalhos = page.getByRole('navigation', { name: 'Atalhos' });
    await expect(atalhos.getByRole('link', { name: 'Nova demanda' })).toHaveAttribute('href', '/demandas?nova=1');
    await expect(atalhos.getByRole('link', { name: 'Contatos' })).toHaveAttribute('href', '/contatos');
    await expect(atalhos.getByRole('link', { name: 'Respostas prontas' })).toHaveCount(0);

    const sistema = page.getByTestId('inicio-sistema');
    await expect(sistema.locator('[data-sistema="agente"]')).toContainText('atendendo');
    await expect(sistema.locator('[data-sistema="whatsapp"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pausar agente|Retomar agente/ })).toHaveCount(0);
    await expect(page.getByText('US$')).toHaveCount(0);
  } finally {
    await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  }
});
```

Run: `cd apps/painel && pnpm exec playwright test e2e/inicio-mesa.spec.ts`
Expected: FAIL (as regiões novas não existem).

- [ ] **Passo 2: `sem-responsavel-mesa.tsx`**

```tsx
import { PrazoTexto } from '@/components/patterns/prioridade-prazo';
import { Card } from '@/components/ui/card';
import { detalheDaDemanda } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';
import { BotaoAssumirInicio } from './botoes-demanda-inicio';
import { paginaInicio } from './dados-inicio';
import { lerSemResponsavelMesa } from './dados-mesa';

/** "Sem responsável nos meus setores" (imagem B, D13): quem assumir vira responsável; a função do banco confere. */
export async function SemResponsavelMesa({ u }: { u: UsuarioPainel }) {
  const [dados, { agora }] = await Promise.all([lerSemResponsavelMesa(u.setores.join(',')), paginaInicio()]);
  return (
    <section id="sem-responsavel" aria-labelledby="titulo-sem-responsavel" className="scroll-mt-4">
      <Card className="gap-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-sem-responsavel" className="text-sm font-bold uppercase tracking-wide text-brand">Sem responsável nos meus setores</h2>
          <span className="text-sm text-subtle">quem assumir vira responsável</span>
        </div>
        {u.setores.length === 0 ? (
          <p className="text-sm text-muted">Você não tem setor marcado. O administrador marca os setores em Usuários e permissões.</p>
        ) : dados === null ? (
          <p className="text-sm text-muted">As demandas sem responsável não puderam ser lidas agora.</p>
        ) : dados.lista.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma demanda sem responsável nos seus setores.</p>
        ) : (
          <ul className="divide-y divide-border">
            {dados.lista.map((d) => {
              const [empresa, setor] = detalheDaDemanda(d);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="tabular w-16 shrink-0 font-bold text-foreground">#{d.numero}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{d.titulo}</p>
                    <p className="truncate text-sm text-muted">
                      <span className="font-semibold text-brand">{empresa}</span> · {setor} ·{' '}
                      <PrazoTexto prazo={d.prazo_em} pausadoDesde={d.prazo_pausado_desde} concluidaEm={null} agora={agora} />
                    </p>
                  </div>
                  <BotaoAssumirInicio id={d.id} numero={d.numero} />
                </li>
              );
            })}
          </ul>
        )}
        {dados && dados.total > dados.lista.length && (
          <p className="text-sm text-muted">Mostrando {dados.lista.length} de {dados.total}. As outras estão na Gestão das demandas.</p>
        )}
      </Card>
    </section>
  );
}
```

- [ ] **Passo 3: `atalhos-mesa.tsx`**

```tsx
import { Contact, FileText, MessageSquareText, Plus, Search, Sparkles, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { atalhosDaMesa, type Atalho } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';

const ICONE: Record<Atalho['icone'], LucideIcon> = {
  nova: Plus, empresa: Search, respostas: MessageSquareText, assistente: Sparkles, notas: FileText, contatos: Contact,
};

/** Atalhos (imagem B), só os que a pessoa pode usar (D17). */
export function AtalhosMesa({ u }: { u: UsuarioPainel }) {
  return (
    <Card className="gap-3 p-4">
      <h2 id="titulo-atalhos" className="text-sm font-bold uppercase tracking-wide text-brand">Atalhos</h2>
      <nav aria-labelledby="titulo-atalhos">
        <ul className="grid grid-cols-2 gap-2">
          {atalhosDaMesa(u).map((a) => {
            const Icone = ICONE[a.icone];
            return (
              <li key={a.href}>
                <Link href={a.href} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted">
                  <Icone aria-hidden size={16} strokeWidth={1.75} className="text-brand" />{a.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </Card>
  );
}
```

- [ ] **Passo 4: `bloco-sistema.tsx`**

```tsx
import { Bell, Bot, CircleAlert, CircleDot, MessageCircle, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { linhasDoSistema, type LinhaSistema } from '@/lib/inicio';
import { lerAvisos } from './dados-inicio';
import { lerEstadoSistemaMesa } from './dados-mesa';

const ICONE_LINHA = { agente: Bot, whatsapp: MessageCircle, fila: TriangleAlert } as const;
const TOM: Record<LinhaSistema['tom'], { cor: string; Icone: typeof CircleDot }> = {
  ok: { cor: 'text-success', Icone: CircleDot },
  atencao: { cor: 'text-warning', Icone: TriangleAlert },
  perigo: { cor: 'text-danger', Icone: CircleAlert },
};

/**
 * Sistema (imagem B, D18): agente, WhatsApp e, se parou, as mensagens — de estado_sistema_resumo, sem nenhum valor de
 * custo e sem PAUSAR. Muda sozinho pela recarga periódica (D2).
 */
export async function BlocoSistema() {
  const [estado, avisos] = await Promise.all([lerEstadoSistemaMesa(), lerAvisos()]);
  const total = avisos?.total ?? 0;
  return (
    <Card data-testid="inicio-sistema" className="gap-2 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Sistema</h2>
      {estado ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {linhasDoSistema(estado).map((l) => {
            const IconeLinha = ICONE_LINHA[l.id];
            const { cor, Icone } = TOM[l.tom];
            return (
              <li key={l.id} data-sistema={l.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-foreground"><IconeLinha aria-hidden size={14} strokeWidth={1.75} />{l.rotulo}</span>
                <span className={cn('flex items-center gap-1 font-semibold', cor)}><Icone aria-hidden size={12} strokeWidth={2} />{l.valor}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Estado indisponível agora.</p>
      )}
      <p className="flex items-center justify-between gap-2 border-t border-border pt-2 text-sm">
        <span className="flex items-center gap-1 text-foreground"><Bell aria-hidden size={14} strokeWidth={1.75} />Avisos para você</span>
        {total > 0
          ? <a href="#avisos" className="font-semibold text-brand underline-offset-4 hover:underline">{total} · ver</a>
          : <span className="tabular text-muted">0</span>}
      </p>
    </Card>
  );
}
```

- [ ] **Passo 5: `minha-mesa.tsx` final**

Substitua o arquivo inteiro por:

```tsx
import { MessageCircle, Plus, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { Button } from '@/components/ui/button';
import { capitalizar, dataDoTitulo, juntarNomes, primeiroNome, saudacao } from '@/lib/inicio';
import { textoComAgenteHoje } from '@/lib/minha-mesa';
import { temNivel, usaAssistente } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { AtalhosMesa } from './atalhos-mesa';
import { BlocoSistema } from './bloco-sistema';
import { CabecalhoInicio } from './cabecalho-inicio';
import { lerAvisos, lerLimitesEspera, lerNomesPessoas, paginaInicio } from './dados-inicio';
import { contarComAgenteHoje, lerEsperandoVoce, lerEstadoSistemaMesa, lerNomesDosMeusSetores } from './dados-mesa';
import { DemandasPorPrazo } from './demandas-por-prazo';
import { ListaAvisos } from './lista-avisos';
import { ListaEsperando } from './lista-esperando';
import { NumerosMesa } from './numeros-mesa';
import { SemResponsavelMesa } from './sem-responsavel-mesa';

/**
 * Minha mesa (imagem B), para quem não é administrador (D1). Nunca lê custo nem configuracoes: só o que a RLS da pessoa
 * libera e estado_sistema_resumo (sem valores). Recarrega pelo tempo real de sempre e a cada minuto (D2).
 */
export async function MinhaMesa({ u }: { u: UsuarioPainel }) {
  const podeAtendimento = temNivel(u, 'atendimento', 'meus_setores');
  const [{ agora }, setores, avisos, esperando, comAgente, limites, nomes, estado] = await Promise.all([
    paginaInicio(), lerNomesDosMeusSetores(u.setores.join(',')), lerAvisos(),
    podeAtendimento ? lerEsperandoVoce() : Promise.resolve(null),
    podeAtendimento ? contarComAgenteHoje() : Promise.resolve(null),
    lerLimitesEspera(), lerNomesPessoas(), lerEstadoSistemaMesa(),
  ]);
  return (
    <div data-inicio="mesa" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <CabecalhoInicio
        titulo={<>{saudacao(agora)}, <span className="text-brand">{primeiroNome(u.nome)}</span></>}
        subtitulo={(
          <>
            {capitalizar(dataDoTitulo(agora))} ·{' '}
            {setores.length ? <>seus setores: <strong className="text-foreground">{juntarNomes(setores)}</strong></> : 'sem setor marcado'}
          </>
        )}
        acoes={(
          <>
            {usaAssistente(u) && (
              <Button asChild variant="outline">
                <Link href="/assistente"><Sparkles aria-hidden size={16} strokeWidth={1.75} />Perguntar ao assistente</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/demandas?nova=1"><Plus aria-hidden size={16} strokeWidth={1.75} />Nova demanda</Link>
            </Button>
          </>
        )}
        atualizadoEm={agora.toISOString()}
      />
      <NumerosMesa u={u} podeAtendimento={podeAtendimento} />
      <div className="grid items-start gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-4 xl:col-span-2">
          <DemandasPorPrazo u={u} />
          <SemResponsavelMesa u={u} />
        </div>
        <div className="flex flex-col gap-4">
          {podeAtendimento && (
            <ListaEsperando
              id="titulo-conversas-mesa" titulo="Conversas esperando você" extra={setores.length ? juntarNomes(setores) : undefined}
              dados={esperando} limites={limites} estadoCtx={{ usuarioId: u.id, nomes, pausaGeral: estado?.agentePausado ?? null }}
              vazio="Ninguém esperando você agora."
              rodape={(
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <span className="text-muted">{comAgente === null ? '' : textoComAgenteHoje(comAgente)}</span>
                  <Button asChild variant="grafite" size="sm">
                    <Link href="/atendimento"><MessageCircle aria-hidden size={16} strokeWidth={1.75} />Abrir atendimento</Link>
                  </Button>
                </div>
              )}
            />
          )}
          <AtalhosMesa u={u} />
          <BlocoSistema />
        </div>
      </div>
      {(avisos?.total ?? 0) > 0 && <ListaAvisos dados={avisos} extra="para você" />}
    </div>
  );
}
```

- [ ] **Passo 6: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/inicio-mesa.spec.ts e2e/inicio-papel.spec.ts e2e/atendimento-lista.spec.ts e2e/gastos-ia.spec.ts`
Expected: tudo verde.

- [ ] **Passo 7: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Minha mesa — sem responsável com ASSUMIR, conversas esperando, atalhos pela permissão e bloco Sistema sem custo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Travas. Quem atende nunca recebe custo; atualização por polling

**Files:**
- Create: `apps/painel/e2e/inicio-travas.spec.ts`

**Interfaces:**
- Consumes: as duas versões prontas (Tasks 3 a 8); `RecarregarPeriodico` (`RECARGA_PERIODICA_MS = 60_000`, tique de 15 s).
- Produces: testes de guarda. **São testes que devem passar já**; se algum falhar, a correção é no código (nunca afrouxar o teste): custo vazando → achar o import de `dados-situacao.ts`/`gasto-do-mes.ts` ou a leitura de `configuracoes` no caminho da Minha mesa e tirar; polling → conferir que `minha-mesa.tsx` monta `<RecarregarPeriodico />`.

- [ ] **Passo 1: escrever as guardas**

`apps/painel/e2e/inicio-travas.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
// Nomes de campo e textos que só existem quando há custo na página ou no pacote do servidor (props de componentes de cliente).
const CUSTO = /US\$|teto_ia_usd|total_usd|custo_usd|cotacao_usd_brl|gastos_resumo|Gasto com IA/;

test('quem atende nunca recebe custo: nem na página, nem no pacote RSC (também com "Configurações: Sim")', async ({ page }) => {
  // Controle: o administrador recebe US$ (o filtro acha custo quando há).
  await criarUsuarioTeste({ email: 'admin-travas@e2e.local', senha: SENHA, nome: 'Thiago Travas', papel: 'admin' });
  await entrar(page, 'admin-travas@e2e.local', SENHA);
  await abrirInicio(page, 'situacao');
  expect(await page.content()).toMatch(/US\$/);

  for (const comConfiguracoes of [false, true]) {
    await page.context().clearCookies();
    const email = `mesa-travas-${comConfiguracoes ? 'conf' : 'comum'}@e2e.local`;
    const id = await criarUsuarioTeste({ email, senha: SENHA, nome: 'Ana Travas', papel: 'atendente', setores: ['Fiscal'] });
    if (comConfiguracoes) await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', id).eq('modulo', 'configuracoes');
    await entrar(page, email, SENHA);
    await abrirInicio(page, 'mesa');
    expect(await page.content(), `HTML da Minha mesa (${email})`).not.toMatch(CUSTO);
    const rsc = await page.request.get('/inicio', { headers: { RSC: '1' } });
    expect(rsc.status()).toBe(200);
    expect(await rsc.text(), `pacote RSC da Minha mesa (${email})`).not.toMatch(CUSTO);
  }
});

test('o bloco Sistema muda sozinho em até ~75 s, sem recarregar a página (polling, sem tempo real novo)', async ({ page }) => {
  test.setTimeout(150_000);
  await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  try {
    await criarUsuarioTeste({ email: 'mesa-polling@e2e.local', senha: SENHA, nome: 'Ana Polling', papel: 'atendente', setores: ['Fiscal'] });
    await entrar(page, 'mesa-polling@e2e.local', SENHA);
    await abrirInicio(page, 'mesa');
    const agente = page.getByTestId('inicio-sistema').locator('[data-sistema="agente"]');
    await expect(agente).toContainText(/atendendo|limite de IA do mês/);
    await page.evaluate(() => { (window as unknown as { __marcaG2?: number }).__marcaG2 = 1; });
    await db.from('configuracoes').update({ agente_pausado: true }).eq('id', 1);
    await expect(agente).toHaveText(/pausado$/, { timeout: 90_000 });
    // router.refresh troca os dados do servidor; recarga de verdade apagaria a marca.
    expect(await page.evaluate(() => (window as unknown as { __marcaG2?: number }).__marcaG2)).toBe(1);
  } finally {
    await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  }
});
```

(Com `agente_pausado` e teto atingido ao mesmo tempo, o texto é "pausado" — a pausa vem primeiro em `linhasDoSistema`. `toHaveText(/pausado$/)` aceita a linha "Agente … pausado".)

- [ ] **Passo 2: rodar**

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/inicio-travas.spec.ts`
Expected: os dois passam. Depois, confira o congelamento do Realtime: `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio e `supabase test db 2>&1 | grep 22_regressao` → ok.

- [ ] **Passo 3: commit**

```bash
git add apps/painel/e2e/inicio-travas.spec.ts
git commit -m "test(painel): guardas do Início — quem atende nunca recebe custo (página e pacote RSC) e o Sistema atualiza por polling

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Acessibilidade, catálogo e manuais

**Files:**
- Modify: `apps/painel/e2e/acessibilidade.spec.ts`
- Modify: `apps/painel/src/app/(painel)/_design/page.tsx` (se tiver seção de padrões)
- Modify: `docs/design-system.md`, `docs/operacao.md`

- [ ] **Passo 1: acessibilidade nos dois temas**

Em `e2e/acessibilidade.spec.ts`:
1. No teste "telas do painel", antes de `erros.push(...(await auditar(page, rota, tema)))`, acrescente `if (rota === '/inicio') await abrirInicio(page, 'situacao');` (import de `./apoio-inicio`) — o administrador audita o Painel de situação já hidratado.
2. Acrescente, dentro do `test.describe` de cada tema, um teste novo:

```ts
    test(`Minha mesa sem violações graves (${tema})`, async ({ page }) => {
      await semear();
      const EMAIL_MESA = 'a11y-mesa@teste.com';
      const ana = await criarUsuarioTeste({ email: EMAIL_MESA, senha: SENHA, nome: 'Ana Acessível', papel: 'atendente', setores: ['Fiscal'] });
      // A demanda semeada (Fiscal) fica com ela: Minhas demandas com ABRIR/CONCLUIR, e a conversa semeada espera por ela.
      await db.from('chamados').update({ responsavel_id: ana }).eq('titulo', TITULO);
      try {
        await entrar(page, EMAIL_MESA, SENHA);
        await abrirInicio(page, 'mesa');
        const erros = await auditar(page, '/inicio (Minha mesa)', tema);
        await page.getByRole('button', { name: /^Concluir a demanda #/ }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        erros.push(...(await auditar(page, '/inicio (Minha mesa, concluir)', tema)));
        await page.keyboard.press('Escape');
        expect(erros, erros.join('\n')).toEqual([]);
      } finally {
        await db.auth.admin.deleteUser(ana);
        await db.from('usuarios').delete().eq('email', EMAIL_MESA);
      }
    });
```

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/acessibilidade.spec.ts`
Expected: sem violação séria ou crítica nos temas claro e escuro. Se o axe acusar contraste em `text-subtle` sobre o cartão ou nos números `text-warning`, troque pelo par já aprovado (`grep -n "warning" apps/painel/src/components/patterns/status-badge.tsx`).

À mão, com o teclado: Tab passa pelos botões do topo, pelos cartões dos números (Minha mesa: o cartão inteiro é um link), pelas linhas (ABRIR, CONCLUIR, ASSUMIR), pelos atalhos e pelo "ver" dos avisos; Enter em CONCLUIR abre a janela com foco no botão de confirmar; Esc fecha. Na tabela por setor, o leitor de tela lê o cabeçalho da coluna e o setor da linha, e a barra como "1 vencida, 3 vencem hoje, 5 no prazo".

- [ ] **Passo 2: catálogo**

Se `/_design` mostra padrões, acrescente "Início (Parte G2)": dois `NumeroInicio` com dados fixos (um `variante="situacao"` com detalhe e link, um `variante="mesa"` com ícone), sem leitura de banco. Sem seção de padrões, não acrescente nada.

- [ ] **Passo 3: `docs/design-system.md`**

Em "Vocabulário oficial da interface":

```markdown
- **Início:** "Situação do escritório" (administrador) e a saudação "Bom dia, <nome>" (quem atende); "Esperando pessoa", "Demandas abertas", "Vencem hoje", "Vencidas", "Sem responsável"; "conversas esperando você", "minhas demandas vencidas", "sem responsável nos meus setores"; "Minhas demandas por prazo" com os grupos "Vencida", "Vencem hoje", "Próximos dias"; "Você concluiu N demandas hoje"; "N com o agente hoje"; "atualizado há N s · recarrega a cada minuto"; no bloco Sistema: "atendendo", "pausado", "pausado: limite de IA do mês", "conectado", "sem sinal".
```

Em "Regras de estilo":

```markdown
**Números do Início** (`NumeroInicio`): a variante `situacao` tem faixa colorida no topo, título em caixa alta (CSS), número grande, detalhe e link; a variante `mesa` tem ícone à esquerda e o cartão inteiro é o link. `data-numero`/`data-valor` são o contrato dos testes. A cor nunca fala sozinha: o título e o detalhe dizem o que o número é. **Custo só no Painel de situação:** `dados-situacao.ts` é o único arquivo do Início que lê gasto, `configuracoes` e `sinais_vida`; a Minha mesa nunca o importa (o teste `inicio-travas.spec.ts` confere a página e o pacote RSC).
```

- [ ] **Passo 4: `docs/operacao.md`**

1. Em "### Pausar o agente", troque "Em **Início**, clique em **Pausar agente**." por "Em **Início** (o seu Painel de situação), no cartão **Agente**, clique em **Pausar agente**." O resto do parágrafo fica.
2. Novo, logo antes de "### Quando chegar o e-mail "WhatsApp desconectado"":

```markdown
### O Início: Painel de situação (você) e Minha mesa (a equipe)

O Início muda conforme quem entra:
- **Você (administrador)** vê a **Situação do escritório**: uma faixa no topo só quando algo está errado (teto de IA, fila de tarefas atrasada ou parada, WhatsApp sem sinal), cinco números (Esperando pessoa, Demandas abertas, Vencem hoje, Vencidas, Sem responsável), o cartão do **Agente** com **Pausar/Retomar** e os números do dia (conversas, quanto o agente resolveu sozinho, demandas que ele abriu), os **sinais de vida**, o **gasto com IA × teto** com a previsão do mês, a tabela **Demandas por setor** (clique no setor para abrir a lista filtrada), quem está **esperando pessoa agora** e as **vencidas**. Os números de cima são a soma da tabela.
- **A equipe** vê a **Minha mesa**: as conversas esperando por ela, as demandas dela por prazo (vencida, vence hoje, próximos dias) com **Abrir** e **Concluir**, as demandas sem responsável dos setores dela com **Assumir**, atalhos e um bloco **Sistema** que diz se o agente está atendendo ou pausado e se o WhatsApp está conectado. **A equipe nunca vê valores de gasto**: no máximo "pausado: limite de IA do mês".

A página se atualiza sozinha: conversas e demandas na hora; pausa do agente, sinais de vida e gasto em até um minuto.
```

- [ ] **Passo 5: commit**

```bash
git add docs/design-system.md docs/operacao.md apps/painel/src apps/painel/e2e
git commit -m "docs: Início por papel no catálogo e no manual; acessibilidade da Minha mesa e do Painel de situação nos dois temas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes de cada suíte inteira:
   - **regressão congelada:** a linha do `22_regressao_visibilidade.test.sql` de agora (100/100) ao lado da guardada na Task 1 (`$SCRATCH/regressao-antes.txt`), e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` **vazio**; `git diff 3ea7002 --stat -- supabase/tests` mostra só `37_` (nenhum teste de parte anterior mudou) e `git diff 3ea7002 --stat -- supabase/migrations` só `20261008000100`;
   - `supabase test db`: todos os arquivos, com os números de cada um, inclusive `37` 30/30 e o `25` (nenhuma função de gravação sem trava);
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`; `pnpm --filter @escritorio/trabalhador test` e `typecheck` (os tipos regerados não podem quebrar o trabalhador);
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com `inicio-*.spec.ts`, `atendimento-lista`, `gastos-ia`, `configuracoes` e `acessibilidade.spec.ts` nos dois temas;
   - mostre os números exatos de cada suíte (passaram, falharam, pulados). Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-inicio-opcao-a.png` (administrador) e `00-inicio-opcao-b.png` (quem atende):**
   - larguras **1366 e 1920**, tema **claro e escuro**, nas **duas versões**, com o painel local e dados parecidos com os das imagens: setores Fiscal (9 abertas), Pessoal (6), Contábil (4), Financeiro (3), Legalização (2), IRPF (1), Triagem (2), Comercial e Direção sem abertas; 6 vencem hoje (2 urgentes), 2 vencidas, 4 sem responsável (1 há mais de 30 min); 3 esperando pessoa (Carla Mendes 18 min, Jorge Santos 7 min, Rita Lima 2 min com Bruno); 3 avisos (operacional, crítico, aviso); gasto US$ 41,20 de teto US$ 100 com cotação 5,53; fila sem batimento há 3 min; Ana com Pessoal e Fiscal, 8 demandas (1 vencida, 3 vencem hoje, 4 próximos dias, uma "Com o cliente"), 3 sem responsável nos setores dela, 2 conversas esperando com 3 e 1 não lidas, 4 concluídas hoje;
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**), gravando os dados pela chave de serviço **do banco local**;
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-g2\` com nomes `g2-<tela>-<largura>-<tema>.png`: `situacao` (página inteira, a imagem A), `situacao-pausado` (agente pausado, botão Retomar), `mesa` (página inteira, a imagem B), `mesa-concluir` (janela de CONCLUIR aberta), `mesa-configuracoes-sim` (pessoa com "Configurações: Sim": continua Minha mesa, com o atalho Respostas prontas);
   - liste o que ficou diferente das imagens. Já se sabe: "ativo desde 07:58" virou "dentro/fora do expediente" (D8); "mais atrasada" com a data (D9); ABRIR e CONCLUIR em toda linha (D12); "12 com o agente agora" virou "N com o agente hoje" (D16); prazo "03/10"/"amanhã" e não "sex 03/10" (D19); sem "todas no prazo" (D15); "Opção A/B" do canto das imagens eram legendas da maquete; a trilha "Início" do topo é a da casca.
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Ela deve listar as da Parte F (`20261006000100_painel_v2_gastos_colunas.sql` a `20261006000300_painel_v2_gastos_funcoes.sql`) e as da G1 (`20261007000100_painel_v2_prazos_regra.sql`, `20261007000200_painel_v2_cargos.sql`), **que ainda não foram aplicadas e esperam o "ok" do dono**, e a desta parte (`20261008000100_painel_v2_inicio.sql`). Qualquer `push` sem `--dry-run` levaria as seis juntas;
   - **não aplique.** Deixe para o dono, por escrito, o que muda e o comando:
     - **ninguém passa a ver mais nem menos** (teste 22); as três funções só leem; `estado_sistema_resumo` responde a toda a equipe só com sim/não (nenhum valor de gasto); os números do agente só ao administrador; as demandas por setor pela regra de leitura de cada pessoa;
     - o painel antigo e o trabalhador da 3001 continuam funcionando (G2 não muda tabela nem o trabalhador);
     - para aplicar F, G1 e G2 juntas, depois do "ok" dele: `supabase db push --db-url "$DATABASE_URL"` (a ordem é automática). Se quiser só a F antes, o push aplica todas as pendentes: a alternativa é aplicar a F a partir da worktree da Parte F (que não tem as da G).
4. **Subir o painel para o dono ver:**
   - **painel** desta worktree numa **porta livre** (comece pela **3011**: `netstat -ano | findstr :3011`; se ocupada, a próxima livre). Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal: variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p <porta>` rodando nesta worktree;
   - **trabalhador: NÃO suba nenhum** (G2 não muda o trabalhador). O da porta **3001 é o teste do dono**; não o desligue nem o mate;
   - avise: **antes de aplicar as migrações**, no Painel de situação os cinco números e a tabela por setor mostram "—"/"indisponível" e os números do agente "—"; na Minha mesa o bloco Sistema diz "Estado indisponível agora"; o resto funciona (D21). As da F e da G1 também estão pendentes (Gastos com IA e Configurações › Prazos ficam com os avisos delas). Depois de aplicar, tudo funciona;
   - passe o endereço e um roteiro curto:
     1. entre como você: a Situação do escritório; confira que os números de cima batem com a soma da tabela por setor; clique num setor (lista filtrada);
     2. no cartão Agente, pause e retome (a janela pergunta);
     3. entre com uma pessoa da equipe (ex.: Ana): a Minha mesa com "Bom dia, Ana"; conclua uma demanda (a janela pergunta; some da lista e conta em "Você concluiu…"); assuma uma sem responsável (passa para as dela);
     4. com a Ana aberta, pause o agente com você em outra janela: em até um minuto o bloco Sistema da Ana diz "pausado", sem recarregar;
     5. confira que a Ana não vê nenhum valor de gasto em lugar nenhum do Início, e que uma pessoa com "Configurações: Sim" também cai na Minha mesa.
5. **Pendências para listar no fim:**
   - as decisões D1 a D25 que o dono ainda não confirmou (destaque D1, D2, D5, D7 e D13, que mudam o que cada um vê ou conta);
   - o que ficou diferente das imagens (item 2);
   - aplicar na homologação as migrações da F, da G1 e da G2 (item 3), depois do "ok";
   - D4: a barra do topo mostrar o estado do agente para toda a equipe (por `estado_sistema_resumo`), se o dono quiser;
   - Parte G, próximas sub-etapas: Contatos (G3), Assistente (G4), Treinar o agente (G5).
6. **Não juntar** a branch em nada. **Parar** ao fim da G2 e esperar o dono ver antes de começar Contatos.
