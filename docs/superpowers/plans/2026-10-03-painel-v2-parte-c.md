# Painel v2, Parte C (Gestão das demandas). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** transformar a tela Demandas numa "Gestão das demandas" completa: tabela com duas informações por coluna, filtros rápidos com contador, busca, quadro com arrastar, painel lateral com todas as ações, nova demanda, prioridade e prazo em dias úteis (com pausa em "Com o cliente"), linha do tempo completa, CSV do Bling respeitando os filtros. No trabalhador, o agente passa a dar a prioridade ao abrir a demanda, e o alerta periódico avisa a demanda vencida, sempre dizendo "Demanda #N".

**Arquitetura:**
- **Banco:** três migrações novas, em ordem. A `20261003000200` já está na homologação e nenhuma migração antiga é editada.
  - `20261003000300_painel_v2_prazo.sql`: prioridade, prazo, pausa, contato na empresa, quem abriu, prazos por prioridade em `configuracoes`, funções de dias úteis (`calcular_prazo` e companhia) e os gatilhos (prazo ao abrir, eventos iniciais, pausa e retomada, última atualização). Os gatilhos fazem o prazo valer para **todo** caminho que abre ou muda uma demanda, inclusive o trabalhador e o painel antigo da homologação.
  - `20261003000400_painel_v2_acoes_demanda.sql`: as funções das ações (`assumir_demanda`, `definir_responsavel`, `definir_prioridade_prazo`, `alterar_status_chamado` com evento, `reabrir_demanda`, `editar_demanda`, `criar_demanda`, `definir_visao_demandas`), a visão `demandas_lista` (uma linha por demanda com os nomes já resolvidos e `vencida`) e os índices da busca (`pg_trgm`).
  - `20261003000500_painel_v2_alerta_vencimento.sql`: `alertas.usuario_id`, para o alerta de vencimento ir só para o responsável.
- **Trabalhador:** `abrir_chamado` e `abrir_pedido_nota` ganham `prioridade` (regra 14 no prompt); `tarefas.ts` ganha `alertaVencimento` e o aviso da fila passa a dizer "Demanda #N".
- **Painel:**
  - regras puras com teste: `lib/demandas.ts` (filtros da URL), `lib/demandas-consulta.ts` (os mesmos filtros na tabela, no quadro, nos contadores e no CSV), `lib/prazo.ts` (texto do prazo e campo de data) e `lib/linha-do-tempo.ts` (frase de cada evento);
  - a página `/demandas` lê a visão `demandas_lista` e mostra a tabela ou o quadro conforme a preferência da pessoa (`usuarios.visao_demandas`);
  - as ações moram em `app/(painel)/demandas/acoes.ts` (server actions que devolvem `Resultado` para o aviso rápido) e nos componentes cliente do painel lateral, do quadro e da nova demanda.

**Tecnologias:** Next.js 15 (App Router, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, sonner, Supabase (Postgres, RLS, pgTAP, pg_trgm), Vitest, Playwright e @axe-core/playwright, Anthropic SDK (cenários com Claude real).

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção 6 inteira (Parte C), que é o escopo;
- seção 3.0 (o que a Parte B mudou: pessoa arquivada não recebe demanda nova, "Ativo" virou "arquivado"), seção 3.1 (decisões gerais), seção 4.2 (status com ponto, caixa alta por CSS), 4.5 (janelas e avisos rápidos) e 4.6 (tom);
- seção 8 (riscos: grep antes de trocar rótulos, alternativa por teclado no quadro, vermelho nunca sozinho).

Imagens: `docs/superpowers/specs/painel-v2/imagens/03-demandas-tabela.png` (tabela), `04-demandas-quadro-e-nova.png` (quadro e nova demanda) e `05-demanda-painel-lateral.png` (painel lateral). Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "Prompt C". Planos anteriores, para o estilo: `docs/superpowers/plans/2026-10-02-painel-v2-parte-b.md` e `docs/superpowers/plans/2026-10-03-painel-v2-sobras-parte-b.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-c`, branch `painel-v2-parte-c` (HEAD `a98d050`, com as 6 sobras da Parte B já feitas). A Parte C continua nesta mesma branch, como diz o Prompt C. Todos os comandos rodam a partir da raiz da worktree.

## Perguntas para o dono

O spec não decide estes pontos, ou o código não bate com ele. O plano segue a **recomendação** de cada um; se a resposta for outra, ajuste a task indicada antes de executá-la.

| # | Pergunta | Recomendação (o que o plano faz) | Task |
|---|---|---|---|
| P1 | **"Última atualização":** o spec pede a coluna nova `ultima_atualizacao_em`, mas `chamados` já tem `atualizado_em`, que as funções de hoje já atualizam. | **Usar `atualizado_em`** e pôr nele os gatilhos do spec (em `chamados` e em `chamado_eventos`). Duas colunas com o mesmo papel iam divergir. A visão chama a coluna de `atualizado_em`; a tela mostra "Últ. atualização". | 1 |
| P2 | **ASSUMIR no painel da demanda:** só a demanda passa a ser da pessoa, ou a conversa do WhatsApp também sai do agente (como o Assumir do Atendimento)? | **Só a demanda** (responsável = eu, Nova vira Resolvendo, evento "assumiu"). O agente continua na conversa; para falar com o cliente, "Abrir conversa" leva ao Atendimento, onde o Assumir de sempre tira a conversa do agente. Demanda aberta pela equipe nem tem conversa. | 2, 9 |
| P3 | **Demandas que já existem** (homologação e, depois, produção): ganham prazo? | **Não.** Ficam com prioridade Normal e **sem prazo** (não aparecem como vencidas nem disparam alerta). Quem quiser põe o prazo no painel. Calcular agora a partir da data de abertura faria quase todas aparecerem vencidas e soltaria um alerta para cada uma. | 1 |
| P4 | **Mudar a prioridade de uma demanda aberta** muda o prazo? | **Sim: o prazo é recalculado a partir de agora** com a regra da prioridade nova (ex.: passou a Urgente às 10h, vence hoje às 18h), com evento "Sistema: prazo …". A pessoa pode mudar o prazo depois. Escolher o prazo à mão nunca mexe na prioridade. | 2, 9 |
| P5 | **Prioridade que o agente dá nos 5 casos do spec.** O spec fixa "sensível e cobrança repetida = alta; nota = normal salvo pedido do cliente". Falta "dúvida simples" e "urgência declarada". | Nota = **normal**; cobrança = **alta**; sensível = **alta**; dúvida simples = **normal** (baixa só quando o cliente diz que não tem pressa); urgência declarada = **urgente**, assim como os casos que hoje já viram título "URGENTE:" (nota emitida errada, golpe, funcionário sem registro, segunda cobrança). O prefixo "URGENTE:" no título **continua** (o cenário antigo e a equipe contam com ele). | 3, 5 |
| P6 | **Alerta de vencimento:** como "avisar o responsável"? Hoje os alertas são por setor, na lista do Início. | Coluna nova `alertas.usuario_id`: com responsável, o alerta é **só dele** (e do administrador); sem responsável, vai para o **setor**. Fica no Início, como os outros avisos (nível "aviso": sem e-mail e sem WhatsApp). Um alerta por prazo: mudar o prazo libera um alerta novo. Responsável arquivado: o alerta vai para o setor. | 4 |
| P7 | **Cartões "Vencem hoje" e "Vencidas" no Início:** estão no spec 6.5 (Parte C), mas não na lista do Prompt C. | **Fazer agora**, pequenos: dois números em "Números do dia", com link para `/demandas?prazo=hoje` e `/demandas?vencidas=1`. A Parte G redesenha o Início e os reaproveita. | 12 |
| P8 | **Rótulos novos dos status** (Nova, Resolvendo, Com o cliente, Concluída) também no Atendimento? O selo de status é o mesmo componente. | **Sim**, para a mesma demanda não ter dois nomes. No Atendimento muda só o texto: o selo e o botão "Aguardando cliente", que vira "Com o cliente". | 6, 12 |
| P9 | **Cenários com Claude real:** a regra 14 entra no prompt de todas as conversas. Rodar também os 45 cenários antigos? | **Sim, uma vez na Entrega** (custo estimado de US$ 10 a 15), além dos 5 de prioridade na Task 5 (US$ 1 a 2). O prompt mudou, e só os cenários mostram se outra regra piorou. | 5, Entrega |
| P10 | **Nova demanda:** Empresa e Setor são obrigatórios? Dá para abrir na Triagem? | **Os dois obrigatórios**, e quem não é administrador só escolhe os próprios setores (senão abriria uma demanda que não consegue ver). Triagem fica para o agente e para quem nem sabe a empresa. | 2, 11 |
| P11 | **Prazo de demanda aberta fora do expediente** (urgente às 20h, ou num sábado). | Conta como **chegada no próximo dia útil**: urgente às 20h de quinta vence sexta às 18h; alta num sábado (com feriado na segunda) vence na quarta às 18h. | 1 |

## Restrições globais

- **Só mexer em:**
  - banco: **criar** `supabase/migrations/20261003000300_painel_v2_prazo.sql`, `supabase/migrations/20261003000400_painel_v2_acoes_demanda.sql`, `supabase/migrations/20261003000500_painel_v2_alerta_vencimento.sql`, `supabase/tests/18_painel_v2_prazo.test.sql`, `supabase/tests/19_painel_v2_acoes_demanda.test.sql` e `supabase/tests/20_painel_v2_alerta_vencimento.test.sql`;
  - `packages/db/src/repos.ts`, `packages/db/test/repos.test.ts` e `packages/db/src/tipos.gen.ts` (regerado, nunca à mão);
  - trabalhador, só o que o Prompt C pede: `src/agente/ferramentas.ts`, `src/agente/prompt.ts`, `src/tarefas.ts`, `src/alertas.ts`, `src/principal.ts`, `src/cenarios/cenarios.ts`, `src/cenarios/rodar.ts` e os testes deles;
  - `apps/painel`.
  - Nada no assistente, no Bling (`packages/core/src/bling.ts`), nas regras do agente além da regra 14, nem nas migrações antigas.
- **Nunca editar migração antiga** (`20261003000200` e anteriores). Toda mudança de banco é migração nova, datada depois de `20261003000200`.
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque:
     - `port = 54321` (api) por `56321`;
     - `port = 54322` (db) por `56322`;
     - `shadow_port = 54320` por `56320`;
     - `port = 54329` (pooler) por `56329`;
     - `port = 54323` (studio) por `56323`;
     - `port = 54324` (inbucket) por `56324`;
     - `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321`, em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`, e `127.0.0.1:54322` por `127.0.0.1:56322`, em `DATABASE_URL`.
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e não o desligue.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os testes do painel (e2e) e do trabalhador deixam no banco quebram os pgTAP antigos (contagens e números de demanda). O reset reaplica todas as migrações, inclusive as novas.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Nunca rode teste contra a homologação, e não altere `.env.homologacao`.** Ele só é lido na Entrega, para o `--dry-run`, o painel e o trabalhador de teste do dono. A migração só vai para a homologação depois de mostrar o `--dry-run` e receber o "ok" do dono.
- **Cenários com Claude real** custam dinheiro (chave `ANTHROPIC_API_KEY` do `.env`) e rodam no banco local (o `limparBanco` recusa outro). Nas tasks, rode **só os de prioridade** (`pnpm --filter @escritorio/trabalhador cenarios prioridade`). A rodada completa fica para a Entrega, com o "sim" do dono à P9.
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit.
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]` ou `w-[300px]`. Use os tokens e utilitários da Parte A (`text-danger`, `border-l-danger`, `bg-danger-soft`, `text-warning`, `text-success`, `text-champagne-text`, `variantesBotao` etc.). `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`). Vermelho nunca aparece sozinho: urgente e vencida sempre com texto.
- **Termos (spec 3.1):** Demanda (nunca "chamado" na tela), Nova, Resolvendo, Com o cliente, Concluída, Assumir, Nota interna, Transferir, Concluir, Reabrir, CSV Bling. O nome "chamado" continua só no banco e no código.
- **Reaproveite o que existe:** `DataTable`, `PainelLateralUrl`, `ConfirmDialog` (modo controlado), `EscolherEmpresa`, `FormField`, `StatusBadge`, `RelativeTime`, `BlingExportButton`, `ExportarSelecionadas`, `toast` (`@/components/ui/toaster`), `variantesBotao`, `classeSelect` (`clientes/estilos.ts`), `hrefComParams`, `lerOrdem`, `paginar`, `interpretarBusca`, `mensagemDoBanco`.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Decisões tomadas neste plano (o dono confirma ao aprovar)

1. **Ordem:** banco (Tasks 1 e 2) → trabalhador (3 a 5) → regras puras do painel (6) → tabela (7) → CSV e imprimir (8) → painel lateral (9) → quadro (10) → nova demanda (11) → Configurações › Prazos, Início e Atendimento (12) → acessibilidade e catálogo (13). Cada task deixa tudo funcionando e testado.
2. **O prazo é do banco.** Um gatilho calcula `prazo_em` em toda demanda nova sem prazo (agente, sistema ou painel). O trabalhador e o painel nunca calculam prazo.
3. **Os eventos iniciais também são do banco.** Ao abrir, o gatilho grava "abriu", "prioridade …" e "prazo …" (o prazo sugerido sai como "Sistema", como na imagem 05). `repos.abrirChamado` deixa de gravar o evento de criação. Para o trabalhador antigo da homologação (que ainda grava), o banco ignora uma segunda "criação" da mesma demanda.
4. **Pausa e retomada por gatilho**, não só em `alterar_status_chamado`: entrar em "Com o cliente" por qualquer caminho (Atendimento, quadro, transferir, assumir a conversa) pausa; sair retoma. Na retomada o prazo anda o **tempo útil** que ficou parado (horas dentro do expediente, sem fim de semana e feriado), com evento "Sistema: prazo …". Concluir uma demanda pausada não mexe no prazo.
5. **Prazo mudado durante a pausa:** a pausa passa a contar a partir da mudança (senão o tempo antes da mudança seria somado ao prazo novo).
6. **`criado_por` sem chave estrangeira** para `usuarios`: uma segunda ligação `chamados → usuarios` tornaria ambíguo o `usuarios(nome)` que o painel e o trabalhador já usam em várias consultas. Quem abriu também fica no evento "abriu", que conta no "uso do cadastro" da pessoa.
7. **Contato na empresa:** a demanda do agente herda o contato da conversa (gatilho). Na nova demanda e no "editar", só contatos ativos ligados à empresa da demanda.
8. **"Do agente" = WhatsApp** (origem `agente` ou `sistema`); **"Da equipe"** = origem `equipe` (nova demanda pelo painel).
9. **Vencida** = não concluída, não pausada e com `prazo_em` antes de agora (coluna `vencida` da visão). Demanda pausada mostra "pausado" no lugar do prazo.
10. **Status na URL:** `?status=aberto,em_andamento` (vírgula). Sem o parâmetro, valem Novas + Resolvendo + Com o cliente, que é o filtro padrão da imagem 03. Tirar o último status selecionado volta ao padrão. O `?status=concluido` antigo continua valendo.
11. **Contadores:** Novas, Resolvendo, Com o cliente e Vencidas mostram quantas demandas apareceriam com aquele botão, mantendo os outros filtros (como na imagem 03). Concluídas, Do agente e Da equipe não têm número (Concluídas cresce sem fim).
12. **Ordenação** por um seletor "Ordenar" com quatro opções (Última atualização ↓ padrão, Prazo ↑, Prioridade ↓, Número ↓). O cabeçalho da tabela tem duas linhas por coluna e não serve para ordenar duas coisas na mesma coluna.
13. **Busca:** número exato (`123` ou `#123`) ou texto contido no título, na descrição ou no nome da empresa (o "contém" cobre o "prefixo" do spec 6.6). Usa o `interpretarBusca` da busca global, que já limpa o texto para o filtro.
14. **CSV Bling:** a rota recebe os mesmos parâmetros da tela e aplica o mesmo `aplicarFiltrosDemandas`. O aviso "os outros filtros não entram na exportação" some.
15. **Quadro:** os botões de status somem no quadro (as colunas já são os status); os outros filtros e a busca valem. Até 50 cartões por coluna, com "e mais N na tabela". Cartão concluído não arrasta: Reabrir fica no painel lateral. Teclado: com o cartão em foco, **Shift + → / Shift + ←** move para a coluna vizinha; soltar ou mover para Concluída abre a confirmação.
16. **Tabela ou Quadro** fica no perfil da pessoa (`usuarios.visao_demandas`, como o tamanho da letra da Parte A): vale em qualquer computador.
17. **Painel lateral:** cada campo grava ao mudar (sem botão Salvar), com aviso rápido; erro volta o campo ao valor de antes e mostra o aviso. Título e descrição têm Salvar próprio.
18. **Responsável:** a lista mostra só as pessoas ativas do setor da demanda (Triagem: todas as ativas). O banco aceita também administrador, para o caso de quem cuida da Triagem.
19. **Reabrir** volta a demanda para Nova, limpa `concluido_em` e recalcula o prazo a partir de agora com a prioridade dela (uma demanda reaberta com o prazo antigo nasceria vencida).
20. **Prazo no passado é recusado** ("O prazo precisa ser depois de agora."). Prazo manual é data e hora de Brasília (`datetime-local`, sem horário de verão).
21. **Mensagens das funções antigas** ("sem acesso a este chamado") passam pelo `mensagemDoBanco` e viram "Você não tem acesso a esta demanda." na tela.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Duas pessoas clicam ASSUMIR na mesma demanda ao mesmo tempo:** a segunda recebe "A demanda já está com Ana." e nada muda. `assumir_demanda` trava a linha (`for update`). Testado no pgTAP da Task 2 (asserção 4).
2. **Demanda pausada em "Com o cliente" com o prazo já passado:** não aparece em Vencidas, não dispara alerta e mostra "pausado". Ao sair da pausa, o prazo anda e pode voltar a vencer. Testado no pgTAP da Task 2 (asserções 23 e 24), no teste do trabalhador da Task 4 e no vitest de `lib/prazo.ts` (Task 6).
3. **Sem nenhum dia útil nas Configurações** (alguém desmarcou todos): abrir demanda continua funcionando (o agente não pode parar por isso). O prazo fica vazio. Testado no pgTAP da Task 1 (asserção 8).
4. **Editar só o título de uma demanda cujo contato foi arquivado depois:** salva, porque o contato não mudou. Só um contato **trocado** precisa ser ativo e da empresa. Testado no pgTAP da Task 2 (asserções 21 e 22).
5. **O CSV Bling com busca, vencidas e responsável na URL:** o arquivo leva exatamente as demandas de venda que a tabela mostra (todas as páginas). Testado no vitest de `aplicarFiltrosDemandas` (Task 6) e no Playwright da Task 8.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261003000300_painel_v2_prazo.sql` (novo) | prioridade, prazo, pausa, contato, criado_por, prazos em `configuracoes`, funções de dias úteis, gatilhos | 1 |
| `supabase/tests/18_painel_v2_prazo.test.sql` (novo) | prazo com feriado e fim de semana, pausa, eventos iniciais, última atualização | 1 |
| `packages/db/src/repos.ts`, `packages/db/test/repos.test.ts` | `abrirChamado` com prioridade e sem o evento de criação | 1 |
| `apps/trabalhador/test/agente/executar.test.ts` | eventos da triagem complementada | 1, 3 |
| `supabase/migrations/20261003000400_painel_v2_acoes_demanda.sql` (novo) | ações da demanda, `demandas_lista`, busca, `visao_demandas` | 2 |
| `supabase/tests/19_painel_v2_acoes_demanda.test.sql` (novo) | evento de cada ação, setores, reabrir, nova demanda, vencida | 2 |
| `packages/db/src/tipos.gen.ts` | tipos regerados | 1, 2, 4 |
| `apps/trabalhador/src/agente/ferramentas.ts`, `src/agente/prompt.ts` (+ testes) | parâmetro `prioridade` e regra 14 | 3 |
| `supabase/migrations/20261003000500_painel_v2_alerta_vencimento.sql` (novo), `supabase/tests/20_painel_v2_alerta_vencimento.test.sql` (novo) | `alertas.usuario_id` e leitura do alerta pelo responsável | 4 |
| `packages/db/src/repos.ts` | `demandasVencidasParaAlertar`, `marcarAlertadoVencimento`, `registrarAlerta` com `usuarioId` | 4 |
| `apps/trabalhador/src/tarefas.ts`, `src/alertas.ts`, `src/principal.ts`, `test/tarefas.test.ts` | alerta de vencimento e "Demanda #N" | 4 |
| `apps/trabalhador/src/cenarios/cenarios.ts`, `src/cenarios/rodar.ts` | 5 cenários de prioridade e filtro por nome | 5 |
| `apps/painel/src/lib/demandas.ts` (+ teste) | filtros da URL, rótulos, etiquetas, ordem, iniciais | 6 |
| `apps/painel/src/lib/demandas-consulta.ts` (+ teste, novos) | `aplicarFiltrosDemandas` | 6 |
| `apps/painel/src/lib/prazo.ts` (+ teste, novos) | texto do prazo e campo de data e hora | 6 |
| `apps/painel/src/lib/linha-do-tempo.ts` (+ teste, novos) | frase de cada evento | 6 |
| `apps/painel/src/components/patterns/status-badge.tsx` (+ teste), `linha-do-tempo-demanda.tsx`, `prioridade-prazo.tsx` (novo) | rótulos novos, linha do tempo nova, prioridade e prazo com texto e cor | 6 |
| `apps/painel/src/lib/mensagem-banco.ts` (+ teste) | "chamado" vira "demanda" nas mensagens antigas | 6 |
| `apps/painel/src/app/(painel)/demandas/page.tsx`, `barra-demandas.tsx` (novo), `filtros-demandas.tsx` (novo), `colunas-demandas.tsx` (novo), `loading.tsx` | tabela, busca, filtros, contadores, ordenação | 7 |
| `apps/painel/src/components/patterns/data-table.tsx` | faixa colorida da linha | 7 |
| `apps/painel/src/components/layout/trilha.ts` (+ teste) | "Gestão das demandas" | 7 |
| `apps/painel/e2e/apoio-demandas.ts` (novo), `e2e/demandas.spec.ts`, `e2e/arquivar-usuarios.spec.ts`, `e2e/acessibilidade.spec.ts` | tabela e filtros | 7 |
| `apps/painel/src/lib/bling.ts`, `src/app/api/csv-bling/route.ts`, `demandas/rodape-demandas.tsx` (novo), `demandas/botao-imprimir.tsx` (novo), `components/layout/app-shell.tsx` | CSV com todos os filtros, imprimir | 8 |
| `apps/painel/e2e/demandas-csv.spec.ts` (novo), `e2e/revisao-final.spec.ts` | CSV respeitando filtros | 8 |
| `apps/painel/src/app/(painel)/demandas/acoes.ts` (+ teste, novos), `acoes-demanda.tsx` (novo), `detalhe-demanda.tsx`, `colunas-demandas.tsx` | painel lateral e Assumir na linha | 9 |
| `apps/painel/e2e/demandas-painel.spec.ts` (novo) | todas as ações do painel lateral | 9 |
| `apps/painel/src/app/(painel)/demandas/quadro-demandas.tsx` (novo), `alternar-visao.tsx` (novo), `page.tsx` | quadro, arrastar, teclado, preferência | 10 |
| `apps/painel/e2e/demandas-quadro.spec.ts` (novo) | arrastar, concluir com confirmação, teclado | 10 |
| `apps/painel/src/lib/nova-demanda.ts` (+ teste, novos), `apps/painel/src/app/(painel)/demandas/nova-demanda.tsx` (novo), `page.tsx`, `acoes.ts` | nova demanda com prazo sugerido | 11 |
| `apps/painel/e2e/demandas-nova.spec.ts` (novo) | nova demanda | 11 |
| `apps/painel/src/app/(painel)/configuracoes/page.tsx`, `acoes.ts`, `esquemas.ts` (+ teste) | Configurações › Prazos | 12 |
| `docs/design-system.md`, `docs/operacao.md` | patterns novos; manual do dono (prioridade, prazo, CSV) | 13 |
| `apps/painel/src/app/(painel)/inicio/page.tsx` | Vencem hoje, Vencidas | 12 |
| `apps/painel/src/app/(painel)/atendimento/[id]/acoes-conversa.tsx` | "Com o cliente" | 12 |
| `apps/painel/e2e/configuracoes.spec.ts` | prazos editáveis | 12 |
| `apps/painel/e2e/acessibilidade.spec.ts`, `src/app/(painel)/%5Fdesign/*` | axe nas telas novas, catálogo | 13 |

### Task 1: Banco. Prioridade, prazo em dias úteis e pausa em "Com o cliente"

**Arquivos:**
- Criar: `supabase/migrations/20261003000300_painel_v2_prazo.sql`
- Criar: `supabase/tests/18_painel_v2_prazo.test.sql`
- Modificar: `packages/db/src/repos.ts` (`NovoChamado`, `abrirChamado`), `packages/db/test/repos.test.ts`
- Modificar: `apps/trabalhador/test/agente/executar.test.ts:139` (lista de eventos da triagem)
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consome: `public.configuracoes` (`horario_inicio`, `horario_fim`, `dias_uteis` com 0 = domingo), `public.feriados`, `public.conversas.contato_id`.
- Produz:
  - tipo `public.prioridade_demanda` = `'baixa' | 'normal' | 'alta' | 'urgente'` (nessa ordem: ordenar `desc` põe urgente primeiro);
  - em `chamados`: `prioridade` (padrão `normal`), `prazo_em`, `prazo_pausado_desde`, `contato_id` (FK `contatos`), `criado_por` (uuid sem FK), `alertado_vencimento_em`;
  - em `configuracoes`: `prazo_urgente_dias` (0), `prazo_alta_dias` (1), `prazo_normal_dias` (2), `prazo_baixa_dias` (5), inteiros de 0 a 30;
  - `chamado_eventos.tipo` aceita também `status_alterado`, `prioridade_alterada`, `prazo_alterado`, `responsavel_alterado`, `editado`, `reaberto`; `chamado_eventos.criado_em` passa a ter padrão `clock_timestamp()`;
  - textos dos eventos: `prioridade_alterada` → o valor (`'alta'`); `prazo_alterado` → o prazo em ISO UTC (`'2026-10-13T21:00:00Z'`, de `texto_prazo`); `usuario_id` nulo = "Sistema" (ou "Agente" na criação pelo agente);
  - `public.calcular_prazo(p_prioridade prioridade_demanda, p_inicio timestamptz default now()) returns timestamptz` (executável pelo painel);
  - internas: `eh_dia_util(date)`, `proximo_dia_util(date)`, `tempo_util_entre(timestamptz, timestamptz) returns interval`, `somar_tempo_util(timestamptz, interval) returns timestamptz`, `texto_prazo(timestamptz) returns text`;
  - `NovoChamado.prioridade?: Prioridade` e `export type Prioridade = Database['public']['Enums']['prioridade_demanda']` em `@escritorio/db`.

- [ ] **Passo 1: preparar o ambiente local**

```bash
export PATH="$HOME/bin:$PATH"
supabase status || true
```

Se não houver Supabase local ligado, siga as **Restrições globais** (cópias, portas 563xx no `config.toml` e no `.env`) e depois:

```bash
supabase start
supabase db reset
```

Esperado: `supabase status` mostra `API URL: http://127.0.0.1:56321` e `DB URL: postgresql://postgres:postgres@127.0.0.1:56322/postgres`.

- [ ] **Passo 2: escrever o pgTAP (falha)**

Crie `supabase/tests/18_painel_v2_prazo.test.sql`:

```sql
-- supabase/tests/18_painel_v2_prazo.test.sql
-- Parte C (spec 6.5 e 6.6): prazo em dias úteis, pausa em "Com o cliente", eventos iniciais e última atualização.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Expediente de 8h às 18h, de segunda a sexta, prazos padrão; 12/10/2026 (segunda) é feriado.
update public.configuracoes set horario_inicio = '08:00', horario_fim = '18:00', dias_uteis = '{1,2,3,4,5}',
  prazo_urgente_dias = 0, prazo_alta_dias = 1, prazo_normal_dias = 2, prazo_baixa_dias = 5 where id = 1;
insert into public.feriados (data, descricao) values ('2026-10-12', 'Nossa Senhora Aparecida') on conflict (data) do nothing;

-- 1-6: calcular_prazo (08/10/2026 é quinta).
select is(public.calcular_prazo('urgente', '2026-10-08 10:00-03'), '2026-10-08 18:00-03'::timestamptz, 'urgente: mesmo dia, no fim do expediente');
select is(public.calcular_prazo('urgente', '2026-10-08 19:00-03'), '2026-10-09 18:00-03'::timestamptz, 'urgente depois do expediente: fim do próximo dia útil');
select is(public.calcular_prazo('alta', '2026-10-09 10:00-03'), '2026-10-13 18:00-03'::timestamptz, 'alta na sexta: pula o fim de semana e o feriado');
select is(public.calcular_prazo('normal', '2026-10-08 10:00-03'), '2026-10-13 18:00-03'::timestamptz, 'normal: 2 dias úteis, sem contar o feriado');
select is(public.calcular_prazo('baixa', '2026-10-05 08:30-03'), '2026-10-13 18:00-03'::timestamptz, 'baixa: 5 dias úteis');
select is(public.calcular_prazo('alta', '2026-10-10 09:00-03'), '2026-10-14 18:00-03'::timestamptz, 'aberta no sábado: conta a partir do próximo dia útil');

-- 7: os prazos vêm de Configurações › Prazos.
update public.configuracoes set prazo_normal_dias = 3 where id = 1;
select is(public.calcular_prazo('normal', '2026-10-08 10:00-03'), '2026-10-14 18:00-03'::timestamptz, 'normal com 3 dias configurados');
update public.configuracoes set prazo_normal_dias = 2 where id = 1;

-- 8: sem nenhum dia útil, não há prazo (e abrir demanda continua funcionando).
update public.configuracoes set dias_uteis = '{}' where id = 1;
select is(public.calcular_prazo('normal', '2026-10-08 10:00-03'), null::timestamptz, 'sem dias úteis: prazo vazio, sem erro');
update public.configuracoes set dias_uteis = '{1,2,3,4,5}' where id = 1;

-- 9-12: tempo útil entre dois instantes e soma de tempo útil.
select is(public.tempo_util_entre('2026-10-09 17:00-03', '2026-10-13 09:30-03'), interval '2 hours 30 minutes',
  'sexta 17h até terça 9h30: 1h na sexta + 1h30 na terça (fim de semana e feriado não contam)');
select is(public.tempo_util_entre('2026-10-13 10:00-03', '2026-10-13 09:00-03'), interval '0', 'fim antes do início: zero');
select is(public.somar_tempo_util('2026-10-09 18:00-03', interval '2 hours 30 minutes'), '2026-10-13 10:30-03'::timestamptz,
  'somar a partir do fim do expediente continua no próximo dia útil');
select is(public.somar_tempo_util('2026-10-13 10:00-03', interval '3 hours'), '2026-10-13 13:00-03'::timestamptz, 'soma no mesmo dia');

-- Demanda do agente: empresa, contato e conversa.
insert into public.clientes (id, razao_social, cnpj) values ('18000000-0000-0000-0000-000000000001', 'Indústria 18', '18181818000118');
insert into public.contatos (id, nome, telefone) values ('18100000-0000-0000-0000-000000000001', 'Carla', '5531999991801');
insert into public.conversas (id, telefone, contato_id) values ('18200000-0000-0000-0000-000000000001', '5531999991801', '18100000-0000-0000-0000-000000000001');
insert into public.chamados (id, cliente_id, conversa_id, setor_id, titulo, resumo, prioridade, criado_em)
  select '18300000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', '18200000-0000-0000-0000-000000000001',
         id, 'Guia DAS', 'Pediu a guia de setembro', 'alta', '2026-10-08 10:00-03'
  from public.setores where nome = 'Fiscal';

-- 13-17: ao abrir, o banco calcula o prazo, pega o contato da conversa e grava os eventos iniciais.
select is((select prazo_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), '2026-10-09 18:00-03'::timestamptz,
  'prazo calculado pela prioridade e pela hora de abertura');
select is((select contato_id from public.chamados where id = '18300000-0000-0000-0000-000000000001'), '18100000-0000-0000-0000-000000000001'::uuid,
  'contato na empresa vem da conversa');
select results_eq(
  $$ select tipo from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' order by criado_em $$,
  $$ values ('criacao'), ('prioridade_alterada'), ('prazo_alterado') $$,
  'abrir grava: abriu, prioridade, prazo (nessa ordem)');
select results_eq(
  $$ select usuario_id, texto from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' and tipo = 'prazo_alterado' $$,
  $$ values (null::uuid, '2026-10-09T21:00:00Z') $$,
  'prazo sugerido aparece como Sistema, com o prazo em ISO');
insert into public.chamado_eventos (chamado_id, tipo, texto) values ('18300000-0000-0000-0000-000000000001', 'criacao', 'Pediu a guia de setembro');
select is((select count(*) from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' and tipo = 'criacao'), 1::bigint,
  'a criação gravada de novo pelo trabalhador antigo é ignorada');

-- 18-23: "Com o cliente" pausa; ao sair, o prazo anda o tempo útil parado.
update public.chamados set status = 'aguardando_cliente' where id = '18300000-0000-0000-0000-000000000001';
select is((select prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000001'), now(), 'entrar em Com o cliente pausa o prazo');
update public.chamados set prazo_pausado_desde = now() - interval '30 days', alertado_vencimento_em = now()
  where id = '18300000-0000-0000-0000-000000000001';
create temp table antes as select prazo_em, prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000001';
update public.chamados set status = 'em_andamento' where id = '18300000-0000-0000-0000-000000000001';
select is((select prazo_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'),
  (select public.somar_tempo_util(a.prazo_em, public.tempo_util_entre(a.prazo_pausado_desde, now())) from antes a),
  'ao sair da pausa, o prazo anda o tempo útil que ficou parado');
select ok((select c.prazo_em > a.prazo_em from public.chamados c, antes a where c.id = '18300000-0000-0000-0000-000000000001'), 'o prazo foi empurrado');
select is((select prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000001'), null::timestamptz, 'a pausa acabou');
select is((select count(*) from public.chamado_eventos where chamado_id = '18300000-0000-0000-0000-000000000001' and tipo = 'prazo_alterado' and usuario_id is null),
  2::bigint, 'o prazo empurrado vira evento do Sistema');
select is((select alertado_vencimento_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), null::timestamptz,
  'prazo novo libera um alerta de vencimento novo');

-- 24-25: concluir uma demanda pausada não mexe no prazo.
insert into public.chamados (id, setor_id, titulo, status, criado_em)
  select '18300000-0000-0000-0000-000000000002', id, 'Balancete', 'aguardando_cliente', '2026-10-08 10:00-03' from public.setores where nome = 'Contábil';
update public.chamados set status = 'concluido', concluido_em = now() where id = '18300000-0000-0000-0000-000000000002';
select is((select prazo_em from public.chamados where id = '18300000-0000-0000-0000-000000000002'), '2026-10-13 18:00-03'::timestamptz,
  'concluir pausada: o prazo fica como estava');
select is((select prazo_pausado_desde from public.chamados where id = '18300000-0000-0000-0000-000000000002'), null::timestamptz, 'concluir pausada: a pausa acaba');

-- 26-28: última atualização (atualizado_em) só muda com o que a equipe vê.
update public.chamados set atualizado_em = '2026-01-01 00:00-03' where id = '18300000-0000-0000-0000-000000000001';
update public.chamados set alertado_fila_em = now() where id = '18300000-0000-0000-0000-000000000001';
select is((select atualizado_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), '2026-01-01 00:00-03'::timestamptz,
  'marca interna do alerta da fila não conta como atualização');
update public.chamados set titulo = 'Guia DAS de setembro' where id = '18300000-0000-0000-0000-000000000001';
select is((select atualizado_em from public.chamados where id = '18300000-0000-0000-0000-000000000001'), now(), 'mudar o título atualiza');
update public.chamados set atualizado_em = '2026-01-01 00:00-03' where id = '18300000-0000-0000-0000-000000000001';
insert into public.chamado_eventos (chamado_id, tipo, texto) values ('18300000-0000-0000-0000-000000000001', 'nota_interna', 'Cliente ligou');
select ok((select atualizado_em > '2026-01-02'::timestamptz from public.chamados where id = '18300000-0000-0000-0000-000000000001'),
  'evento novo (nota interna) atualiza');

select * from finish();
rollback;
```

Run: `supabase test db`
Esperado: FALHA no arquivo 18 (`function public.calcular_prazo(...) does not exist`). Os outros arquivos continuam `ok`.

- [ ] **Passo 3: escrever a migração**

Crie `supabase/migrations/20261003000300_painel_v2_prazo.sql`:

```sql
-- supabase/migrations/20261003000300_painel_v2_prazo.sql
-- Painel v2, Parte C (spec 6.5 e 6.6): prioridade, prazo em dias úteis, pausa em "Com o cliente",
-- contato na empresa, quem abriu e a última atualização das demandas.

create type public.prioridade_demanda as enum ('baixa', 'normal', 'alta', 'urgente');

-- criado_por sem chave estrangeira de propósito: uma segunda ligação chamados → usuarios deixaria ambíguo o
-- usuarios(nome) que o painel e o trabalhador já usam. Quem abriu também fica no evento 'criacao'.
alter table public.chamados
  add column prioridade public.prioridade_demanda not null default 'normal',
  add column prazo_em timestamptz,
  add column prazo_pausado_desde timestamptz,
  add column contato_id uuid references public.contatos (id) on delete set null,
  add column criado_por uuid,
  add column alertado_vencimento_em timestamptz;

-- Dias úteis de cada prioridade (spec 6.5), editáveis em Configurações › Prazos. 0 = no mesmo dia.
alter table public.configuracoes
  add column prazo_urgente_dias int not null default 0 check (prazo_urgente_dias between 0 and 30),
  add column prazo_alta_dias int not null default 1 check (prazo_alta_dias between 0 and 30),
  add column prazo_normal_dias int not null default 2 check (prazo_normal_dias between 0 and 30),
  add column prazo_baixa_dias int not null default 5 check (prazo_baixa_dias between 0 and 30);

alter table public.chamado_eventos drop constraint chamado_eventos_tipo_check;
alter table public.chamado_eventos add constraint chamado_eventos_tipo_check check (tipo in (
  'criacao', 'assumido', 'transferencia', 'nota_interna', 'conclusao',
  'status_alterado', 'prioridade_alterada', 'prazo_alterado', 'responsavel_alterado', 'editado', 'reaberto'));
-- Vários eventos na mesma transação (abrir grava três) ficam em ordem na linha do tempo.
alter table public.chamado_eventos alter column criado_em set default clock_timestamp();

-- ---------- Dias úteis (expediente, dias da semana e feriados de configuracoes) ----------

create function public.eh_dia_util(p_dia date) returns boolean
language sql stable security definer set search_path = '' as $$
  select extract(dow from p_dia)::int = any (c.dias_uteis)
     and not exists (select 1 from public.feriados f where f.data = p_dia)
  from public.configuracoes c where c.id = 1
$$;

-- Primeiro dia útil depois de p_dia; null se não houver nenhum em um ano (todos os dias desmarcados).
create function public.proximo_dia_util(p_dia date) returns date
language plpgsql stable security definer set search_path = '' as $$
declare v date := p_dia;
begin
  for i in 1..366 loop
    v := v + 1;
    if public.eh_dia_util(v) then return v; end if;
  end loop;
  return null;
end $$;

-- Prazo sugerido: fim do expediente do N-ésimo dia útil (N da prioridade). Chegou fora do expediente: conta do próximo dia útil.
create function public.calcular_prazo(p_prioridade public.prioridade_demanda, p_inicio timestamptz default now())
returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_local timestamp := p_inicio at time zone 'America/Sao_Paulo';
  v_dia date := (p_inicio at time zone 'America/Sao_Paulo')::date;
  v_dias int;
begin
  select * into c from public.configuracoes where id = 1;
  v_dias := case p_prioridade
    when 'urgente' then c.prazo_urgente_dias when 'alta' then c.prazo_alta_dias
    when 'normal' then c.prazo_normal_dias else c.prazo_baixa_dias end;
  if not public.eh_dia_util(v_dia) or v_local::time >= c.horario_fim then
    v_dia := public.proximo_dia_util(v_dia);
  end if;
  for i in 1..v_dias loop
    exit when v_dia is null;
    v_dia := public.proximo_dia_util(v_dia);
  end loop;
  if v_dia is null then return null; end if;
  return (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo';
end $$;

-- Tempo dentro do expediente entre dois instantes (fim de semana, feriado e fora do horário não contam).
create function public.tempo_util_entre(p_de timestamptz, p_ate timestamptz) returns interval
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_dia date;
  v_ini timestamptz;
  v_fim timestamptz;
  v_total interval := interval '0';
begin
  if p_de is null or p_ate is null or p_ate <= p_de then return interval '0'; end if;
  select * into c from public.configuracoes where id = 1;
  v_dia := (p_de at time zone 'America/Sao_Paulo')::date;
  while v_dia <= (p_ate at time zone 'America/Sao_Paulo')::date loop
    if public.eh_dia_util(v_dia) then
      v_ini := greatest(p_de, (v_dia + c.horario_inicio) at time zone 'America/Sao_Paulo');
      v_fim := least(p_ate, (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo');
      if v_fim > v_ini then v_total := v_total + (v_fim - v_ini); end if;
    end if;
    v_dia := v_dia + 1;
  end loop;
  return v_total;
end $$;

-- Anda p_tempo de expediente a partir de p_de (a retomada da pausa empurra o prazo assim). null sem dias úteis.
create function public.somar_tempo_util(p_de timestamptz, p_tempo interval) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_dia date;
  v_ini timestamptz;
  v_fim timestamptz;
  v_resta interval := p_tempo;
begin
  if p_de is null then return null; end if;
  if p_tempo is null or p_tempo <= interval '0' then return p_de; end if;
  select * into c from public.configuracoes where id = 1;
  v_dia := (p_de at time zone 'America/Sao_Paulo')::date;
  for i in 1..3660 loop
    if public.eh_dia_util(v_dia) then
      v_ini := greatest(p_de, (v_dia + c.horario_inicio) at time zone 'America/Sao_Paulo');
      v_fim := (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo';
      if v_fim > v_ini then
        if v_ini + v_resta <= v_fim then return v_ini + v_resta; end if;
        v_resta := v_resta - (v_fim - v_ini);
      end if;
    end if;
    v_dia := v_dia + 1;
  end loop;
  return null;
end $$;

-- Prazo como texto do evento (ISO em UTC): o painel formata no horário de Brasília.
create function public.texto_prazo(p timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;

-- ---------- Gatilhos: valem para todo caminho (agente, painel novo e painel antigo da homologação) ----------

create function public.chamados_antes_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.prazo_em is null then new.prazo_em := public.calcular_prazo(new.prioridade, new.criado_em); end if;
  if new.contato_id is null and new.conversa_id is not null then
    select c.contato_id into new.contato_id from public.conversas c where c.id = new.conversa_id;
  end if;
  if new.status = 'aguardando_cliente' then new.prazo_pausado_desde := coalesce(new.prazo_pausado_desde, new.criado_em); end if;
  return new;
end $$;
create trigger chamados_antes_inserir before insert on public.chamados
  for each row execute function public.chamados_antes_inserir();

-- Eventos iniciais (imagem 05): abriu, prioridade e prazo. Prazo igual ao sugerido aparece como "Sistema".
create function public.chamados_depois_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (new.id, new.cliente_id, 'criacao', new.criado_por, nullif(new.resumo, ''));
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (new.id, new.cliente_id, 'prioridade_alterada', new.criado_por, new.prioridade::text);
  if new.prazo_em is not null then
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (new.id, new.cliente_id, 'prazo_alterado',
              case when new.prazo_em is distinct from public.calcular_prazo(new.prioridade, new.criado_em) then new.criado_por end,
              public.texto_prazo(new.prazo_em));
  end if;
  return null;
end $$;
create trigger chamados_depois_inserir after insert on public.chamados
  for each row execute function public.chamados_depois_inserir();

create function public.chamados_antes_alterar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_pausa interval;
begin
  if new.status = 'aguardando_cliente' and old.status <> 'aguardando_cliente' then
    -- Entrou em "Com o cliente": o prazo para de correr.
    new.prazo_pausado_desde := now();
  elsif old.status = 'aguardando_cliente' and new.status <> 'aguardando_cliente' then
    -- Saiu: o prazo anda o tempo útil parado (concluir não mexe; prazo trocado na mesma mudança também não).
    if new.status <> 'concluido' and old.prazo_pausado_desde is not null and new.prazo_em is not null
       and new.prazo_em is not distinct from old.prazo_em then
      v_pausa := public.tempo_util_entre(old.prazo_pausado_desde, now());
      if v_pausa > interval '0' then
        new.prazo_em := public.somar_tempo_util(old.prazo_em, v_pausa);
        insert into public.chamado_eventos (chamado_id, cliente_id, tipo, texto)
          values (new.id, new.cliente_id, 'prazo_alterado', public.texto_prazo(new.prazo_em));
      end if;
    end if;
    new.prazo_pausado_desde := null;
  elsif new.status = 'aguardando_cliente' and new.prazo_em is distinct from old.prazo_em then
    -- Prazo trocado durante a pausa: a pausa conta a partir de agora.
    new.prazo_pausado_desde := now();
  end if;
  if new.prazo_em is distinct from old.prazo_em then new.alertado_vencimento_em := null; end if;
  -- Última atualização: só o que a equipe vê (marcas internas, como alertado_fila_em, não contam).
  if (new.status, new.prioridade, new.prazo_em, new.responsavel_id, new.setor_id, new.titulo, new.resumo, new.contato_id, new.pedido_venda)
     is distinct from
     (old.status, old.prioridade, old.prazo_em, old.responsavel_id, old.setor_id, old.titulo, old.resumo, old.contato_id, old.pedido_venda) then
    new.atualizado_em := now();
  end if;
  return new;
end $$;
create trigger chamados_antes_alterar before update on public.chamados
  for each row execute function public.chamados_antes_alterar();

-- Trabalhador antigo (homologação) ainda grava a criação depois do gatilho: a segunda é ignorada.
create function public.chamado_eventos_antes_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.tipo = 'criacao' and exists (
    select 1 from public.chamado_eventos e where e.chamado_id = new.chamado_id and e.tipo = 'criacao'
  ) then
    return null;
  end if;
  return new;
end $$;
create trigger chamado_eventos_antes_inserir before insert on public.chamado_eventos
  for each row execute function public.chamado_eventos_antes_inserir();

-- Evento novo (nota interna, por exemplo) também é atualização. Eventos gravados por outro gatilho já vêm com ela.
create function public.chamado_eventos_depois_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then return null; end if;
  update public.chamados set atualizado_em = greatest(atualizado_em, new.criado_em) where id = new.chamado_id;
  return null;
end $$;
create trigger chamado_eventos_depois_inserir after insert on public.chamado_eventos
  for each row execute function public.chamado_eventos_depois_inserir();

revoke all on function public.eh_dia_util(date), public.proximo_dia_util(date),
  public.tempo_util_entre(timestamptz, timestamptz), public.somar_tempo_util(timestamptz, interval),
  public.texto_prazo(timestamptz), public.calcular_prazo(public.prioridade_demanda, timestamptz),
  public.chamados_antes_inserir(), public.chamados_depois_inserir(), public.chamados_antes_alterar(),
  public.chamado_eventos_antes_inserir(), public.chamado_eventos_depois_inserir()
  from public, anon, authenticated;
-- A nova demanda mostra o prazo sugerido antes de abrir.
grant execute on function public.calcular_prazo(public.prioridade_demanda, timestamptz) to authenticated;
```

As demandas que já existem ficam com prioridade Normal e sem prazo (P3): a migração não calcula prazo para elas.

- [ ] **Passo 4: aplicar e ver passar**

```bash
supabase migration up
supabase test db
```

Esperado: `18_painel_v2_prazo.test.sql .. ok` (28/28) e todos os outros arquivos `ok`. Se o 03 ou o 15 falharem por contagem de eventos, é o gatilho de criação: confira a asserção e ajuste **só a contagem** dentro do arquivo antigo, dizendo no commit por quê.

- [ ] **Passo 5: `abrirChamado` com prioridade e sem o evento de criação (teste falha)**

Em `packages/db/test/repos.test.ts`, troque o `describe('abrirChamado', ...)` por:

```ts
describe('abrirChamado', () => {
  it('numera em sequência; o banco grava prioridade, prazo e os eventos iniciais', async () => {
    const { cliente } = await criarEmpresaComContato('5531999990001');
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
    const novo = { clienteId: cliente.id, conversaId: conversa.id, setorId: fiscal!.id, responsavelId: null,
      titulo: 'Guia DAS', resumo: 'Cliente pediu a guia de setembro', foraDoContrato: false, origem: 'agente' };
    const a = await repos.abrirChamado({ ...novo, prioridade: 'alta' });
    const b = await repos.abrirChamado({ ...novo, titulo: 'Holerite' });
    expect(b.numero).toBe(a.numero + 1);
    const { data: linhas } = await db.from('chamados').select('id, prioridade, prazo_em').in('id', [a.id, b.id]).order('numero');
    expect(linhas!.map((l) => l.prioridade)).toEqual(['alta', 'normal']);
    expect(linhas!.every((l) => l.prazo_em !== null)).toBe(true);
    const { data: eventos } = await db.from('chamado_eventos').select('tipo').eq('chamado_id', a.id).order('criado_em');
    expect(eventos!.map((e) => e.tipo)).toEqual(['criacao', 'prioridade_alterada', 'prazo_alterado']);
  });
});
```

Run: `pnpm --filter @escritorio/db test -- repos`
Esperado: FALHA (`['normal', 'normal']` em vez de `['alta', 'normal']`: o `abrirChamado` de hoje não manda a prioridade).

- [ ] **Passo 6: implementar em `packages/db/src/repos.ts`**

Logo depois de `type TipoMensagem = ...`:

```ts
export type Prioridade = Database['public']['Enums']['prioridade_demanda'];
```

Troque o tipo `NovoChamado`:

```ts
export type NovoChamado = {
  clienteId: string | null; conversaId: string | null; setorId: string | null; responsavelId: string | null;
  titulo: string; resumo: string; foraDoContrato: boolean; origem: string;
  /** Sem ela, o banco usa 'normal'. O prazo é sempre calculado pelo banco. */
  prioridade?: Prioridade;
};
```

Troque `abrirChamado`:

```ts
    /** O banco calcula o prazo e grava os eventos iniciais (abriu, prioridade, prazo): gatilhos da Parte C. */
    async abrirChamado(c: NovoChamado): Promise<{ id: string; numero: number }> {
      const novo = checar(await db.from('chamados').insert({
        cliente_id: c.clienteId, conversa_id: c.conversaId, setor_id: c.setorId, responsavel_id: c.responsavelId,
        titulo: c.titulo, resumo: c.resumo, fora_do_contrato: c.foraDoContrato, origem: c.origem, prioridade: c.prioridade ?? 'normal',
      }).select('id, numero').single(), 'abrirChamado');
      return { id: novo.id, numero: Number(novo.numero) };
    },
```

Regere os tipos antes do typecheck:

```bash
pnpm db:tipos
git diff --stat packages/db/src/tipos.gen.ts
```

Esperado no diff dos tipos: as colunas novas de `chamados` e `configuracoes`, o enum `prioridade_demanda` e as funções `calcular_prazo`, `eh_dia_util`, `proximo_dia_util`, `tempo_util_entre`, `somar_tempo_util`, `texto_prazo`.

- [ ] **Passo 7: o teste da triagem complementada**

Em `apps/trabalhador/test/agente/executar.test.ts`, no teste "segunda triagem na mesma conversa complementa a primeira", troque a última expectativa por:

```ts
    expect(eventos!.map((e) => e.tipo)).toEqual(['criacao', 'prioridade_alterada', 'prazo_alterado', 'nota_interna']);
```

- [ ] **Passo 8: ver passar**

```bash
pnpm --filter @escritorio/db test
pnpm --filter @escritorio/db typecheck
pnpm --filter @escritorio/trabalhador test
pnpm --filter @escritorio/trabalhador typecheck
pnpm --filter @escritorio/painel typecheck
```

Esperado: tudo passa. Se algum teste do trabalhador contar eventos de demanda, a contagem nova inclui os 3 eventos iniciais: ajuste só a contagem e diga no commit.

- [ ] **Passo 9: commit**

Devolva `supabase/config.toml` e `.env` às portas originais antes (Restrições globais, item 6) e confira com `git status`.

```bash
git add supabase/migrations/20261003000300_painel_v2_prazo.sql supabase/tests/18_painel_v2_prazo.test.sql \
  packages/db/src/repos.ts packages/db/src/tipos.gen.ts packages/db/test/repos.test.ts apps/trabalhador/test/agente/executar.test.ts
git commit -m "$(cat <<'EOF'
feat(demandas): prioridade e prazo em dias úteis, com pausa em "Com o cliente" (banco)

Migração nova 20261003000300: prioridade (baixa a urgente), prazo calculado
pelo banco em dias úteis (expediente, dias da semana e feriados), prazos por
prioridade em configuracoes, pausa e retomada em "Com o cliente" por gatilho,
contato na empresa vindo da conversa e atualizado_em só com o que a equipe vê.
Abrir grava os eventos "abriu", "prioridade" e "prazo"; por isso o
abrirChamado deixa de gravar a criação, e a criação repetida do trabalhador
antigo é ignorada. Os testes que contavam eventos passam a contar os três.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Banco. As ações da demanda, a lista com nomes e a busca

**Arquivos:**
- Criar: `supabase/migrations/20261003000400_painel_v2_acoes_demanda.sql`
- Criar: `supabase/tests/19_painel_v2_acoes_demanda.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consome: tudo da Task 1 (`calcular_prazo`, `texto_prazo`, gatilhos), `public.pode_ver_chamado(uuid)`, `public.meus_setores()`, `public.eh_admin()`, `public.eh_usuario_ativo()`, e as funções que continuam como estão: `nota_interna(uuid, text)`, `transferir_chamado(uuid, uuid, uuid)`, `concluir_chamado(uuid)`.
- Produz (todas SECURITY DEFINER, executáveis só por `authenticated`; mensagens P0001 copiadas literalmente pelo painel):
  - `assumir_demanda(p_chamado uuid) returns void`: responsável = eu; Nova vira Resolvendo; evento `assumido`. Recusa `'A demanda já está com <nome>.'`;
  - `definir_responsavel(p_chamado uuid, p_responsavel uuid) returns void`: `null` tira o responsável; evento `responsavel_alterado` com o nome (ou `null`). Recusa `'Escolha uma pessoa ativa do setor da demanda.'`;
  - `alterar_status_chamado(p_chamado uuid, p_status status_chamado) returns void` (mesma assinatura de antes): grava o evento `status_alterado` (texto = status). Recusa `'use concluir_chamado'` para `concluido`;
  - `definir_prioridade_prazo(p_chamado uuid, p_prioridade prioridade_demanda default null, p_prazo timestamptz default null) returns jsonb` → `{"prioridade": text, "prazo_em": timestamptz | null}`. Prioridade nova sem prazo recalcula o prazo a partir de agora (P4). Recusa `'O prazo precisa ser depois de agora.'`;
  - `reabrir_demanda(p_chamado uuid) returns void`: Nova, `concluido_em` nulo, prazo recalculado; eventos `reaberto` e `prazo_alterado`. Recusa `'A demanda já está aberta.'`;
  - `editar_demanda(p_chamado uuid, p_titulo text, p_descricao text, p_contato uuid default null) returns void`: evento `editado` com o que mudou (`'título, descrição, contato'`). Recusa `'O título precisa ter de 3 a 120 caracteres.'`, `'A descrição pode ter até 4000 caracteres.'`, `'Escolha um contato desta empresa.'`;
  - `criar_demanda(p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text, p_prioridade prioridade_demanda default 'normal', p_prazo timestamptz default null, p_responsavel uuid default null, p_contato uuid default null) returns jsonb` → `{"id": uuid, "numero": int}`; origem `equipe`, `criado_por` = eu. Recusa também `'Escolha uma empresa ativa.'`, `'Escolha o setor.'`, `'Escolha um dos seus setores.'`;
  - `definir_visao_demandas(p_visao text) returns void` e a coluna `usuarios.visao_demandas` (`'tabela' | 'quadro'`, padrão `'tabela'`). Recusa `'Visão inválida.'`;
  - em todas as ações: `'Você não tem acesso a esta demanda.'` e, numa demanda concluída, `'Esta demanda está concluída. Reabra antes de mudar.'`;
  - visão `public.demandas_lista` (security_invoker: o RLS de `chamados` vale), colunas: `id, numero, titulo, resumo, status, prioridade, prazo_em, prazo_pausado_desde, criado_em, atualizado_em, concluido_em, origem, conversa_id, cliente_id, setor_id, responsavel_id, contato_id, criado_por, fora_do_contrato, pedido_venda, tem_pedido (bool), empresa (text), setor (text), responsavel (text), contato (text), criado_por_nome (text), vencida (bool)`.

- [ ] **Passo 1: escrever o pgTAP (falha)**

Crie `supabase/tests/19_painel_v2_acoes_demanda.test.sql`:

```sql
-- supabase/tests/19_painel_v2_acoes_demanda.test.sql
-- Parte C (spec 6.3, 6.4, 6.6 e 6.7): cada ação gera seu evento, quem é de outro setor não age, reabrir limpa concluido_em.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000019a1', 'ana19@pgtap.local'),
  ('00000000-0000-0000-0000-0000000019a2', 'bia19@pgtap.local'),
  ('00000000-0000-0000-0000-0000000019a3', 'caio19@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-0000000019a1', 'Ana', 'ana19@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000019a2', 'Bia', 'bia19@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000019a3', 'Caio', 'caio19@pgtap.local', 'atendente');
insert into public.usuario_setores (usuario_id, setor_id)
  select u, s.id from (values ('00000000-0000-0000-0000-0000000019a1'::uuid), ('00000000-0000-0000-0000-0000000019a2'::uuid)) v(u),
    public.setores s where s.nome = 'Fiscal';
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-0000000019a3', id from public.setores where nome = 'Pessoal';

insert into public.clientes (id, razao_social, nome_fantasia, cnpj) values
  ('19000000-0000-0000-0000-000000000001', 'Indústria 19 Ltda', 'Indústria 19', '19191919000119');
insert into public.contatos (id, nome, telefone) values
  ('19100000-0000-0000-0000-000000000001', 'Carla', '5531999991901'),
  ('19100000-0000-0000-0000-000000000002', 'Duda', '5531999991902'),
  ('19100000-0000-0000-0000-000000000003', 'Estranho', '5531999991903');
insert into public.contato_clientes (contato_id, cliente_id) values
  ('19100000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001'),
  ('19100000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001');

-- F1: a demanda das ações. F2: contato que será arquivado. F3: vencida. F4: vencida, mas pausada.
insert into public.chamados (id, cliente_id, setor_id, titulo, resumo, contato_id, status, prazo_em)
  select x.id, '19000000-0000-0000-0000-000000000001', s.id, x.titulo, 'Descrição', x.contato, x.status::public.status_chamado, x.prazo
  from public.setores s, (values
    ('19300000-0000-0000-0000-000000000001'::uuid, 'Guia DAS', null::uuid, 'aberto', null::timestamptz),
    ('19300000-0000-0000-0000-000000000002'::uuid, 'Certidão', '19100000-0000-0000-0000-000000000002'::uuid, 'aberto', null),
    ('19300000-0000-0000-0000-000000000003'::uuid, 'Guia ICMS', null, 'em_andamento', now() - interval '1 day'),
    ('19300000-0000-0000-0000-000000000004'::uuid, 'Guia ISS', null, 'aguardando_cliente', now() - interval '1 day')
  ) x(id, titulo, contato, status, prazo)
  where s.nome = 'Fiscal';
update public.contatos set ativo = false where id = '19100000-0000-0000-0000-000000000002';

set local role authenticated;

-- 1-2: Caio (Pessoal) não age nas demandas do Fiscal nem abre demanda lá.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a3","role":"authenticated"}', true);
select throws_ok($$ select public.assumir_demanda('19300000-0000-0000-0000-000000000001') $$,
  'P0001', 'Você não tem acesso a esta demanda.', 'outro setor não assume');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'Guia DAS', '') $$,
  'P0001', 'Escolha um dos seus setores.', 'outro setor não abre demanda no Fiscal');

-- 3-4: Ana assume; Bia chega depois e recebe o aviso.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
select public.assumir_demanda('19300000-0000-0000-0000-000000000001');
select results_eq($$ select responsavel_id, status::text from public.chamados where id = '19300000-0000-0000-0000-000000000001' $$,
  $$ values ('00000000-0000-0000-0000-0000000019a1'::uuid, 'em_andamento') $$, 'assumir: responsável = Ana e Nova vira Resolvendo');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a2","role":"authenticated"}', true);
select throws_ok($$ select public.assumir_demanda('19300000-0000-0000-0000-000000000001') $$,
  'P0001', 'A demanda já está com Ana.', 'quem chega depois não toma a demanda');

-- 5-13: responsável, status, prioridade, prazo, nota, edição (Ana).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
select throws_ok($$ select public.definir_responsavel('19300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000019a3') $$,
  'P0001', 'Escolha uma pessoa ativa do setor da demanda.', 'responsável de outro setor é recusado');
select lives_ok($$ select public.definir_responsavel('19300000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000019a2') $$, 'Bia vira responsável');
select lives_ok($$ select public.alterar_status_chamado('19300000-0000-0000-0000-000000000001', 'aguardando_cliente') $$, 'Com o cliente');
select is((select public.definir_prioridade_prazo('19300000-0000-0000-0000-000000000001', 'urgente') ->> 'prioridade'), 'urgente', 'prioridade urgente');
select is((select prazo_em from public.chamados where id = '19300000-0000-0000-0000-000000000001'), public.calcular_prazo('urgente', now()),
  'prioridade nova sem prazo: prazo recalculado a partir de agora');
select throws_ok($$ select public.definir_prioridade_prazo('19300000-0000-0000-0000-000000000001', null, now() - interval '1 hour') $$,
  'P0001', 'O prazo precisa ser depois de agora.', 'prazo no passado é recusado');
select lives_ok($$ select public.definir_prioridade_prazo('19300000-0000-0000-0000-000000000001', null, '2030-01-15 12:00-03') $$, 'prazo escolhido à mão');
select lives_ok($$ select public.nota_interna('19300000-0000-0000-0000-000000000001', 'Cliente ligou') $$, 'nota interna');
select lives_ok($$ select public.editar_demanda('19300000-0000-0000-0000-000000000001', 'Guia DAS de outubro', 'Descrição nova',
  '19100000-0000-0000-0000-000000000001') $$, 'editar título, descrição e contato');

-- 14-18: transferir, concluir, recusa em concluída, reabrir.
select lives_ok($$ select public.transferir_chamado('19300000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  '00000000-0000-0000-0000-0000000019a1') $$, 'transferir');
select lives_ok($$ select public.concluir_chamado('19300000-0000-0000-0000-000000000001') $$, 'concluir');
select throws_ok($$ select public.alterar_status_chamado('19300000-0000-0000-0000-000000000001', 'em_andamento') $$,
  'P0001', 'Esta demanda está concluída. Reabra antes de mudar.', 'concluída não muda de status: reabrir antes');
select lives_ok($$ select public.reabrir_demanda('19300000-0000-0000-0000-000000000001') $$, 'reabrir');
select results_eq($$ select status::text, concluido_em, prazo_em from public.chamados where id = '19300000-0000-0000-0000-000000000001' $$,
  $$ values ('aberto', null::timestamptz, public.calcular_prazo('urgente', now())) $$, 'reabrir: Nova, sem concluido_em, prazo novo');

-- 19-20: cada ação gerou o seu evento.
select results_eq(
  $$ select tipo, count(*)::int from public.chamado_eventos where chamado_id = '19300000-0000-0000-0000-000000000001' group by tipo order by tipo $$,
  $$ values ('assumido', 1), ('conclusao', 1), ('criacao', 1), ('editado', 1), ('nota_interna', 1), ('prazo_alterado', 4),
            ('prioridade_alterada', 2), ('reaberto', 1), ('responsavel_alterado', 1), ('status_alterado', 1), ('transferencia', 1) $$,
  'um evento para cada ação (prazo: sugerido, recalculado, à mão e ao reabrir)');
select results_eq(
  $$ select tipo, texto from public.chamado_eventos where chamado_id = '19300000-0000-0000-0000-000000000001'
       and tipo in ('editado', 'responsavel_alterado', 'status_alterado') order by tipo $$,
  $$ values ('editado', 'título, descrição, contato'), ('responsavel_alterado', 'Bia'), ('status_alterado', 'aguardando_cliente') $$,
  'textos dos eventos');

-- 21-22: contato arquivado depois: editar só o título salva; trocar por contato de fora é recusado.
select lives_ok($$ select public.editar_demanda('19300000-0000-0000-0000-000000000002', 'Certidão negativa', 'Descrição',
  '19100000-0000-0000-0000-000000000002') $$, 'contato arquivado que não mudou não impede a edição');
select throws_ok($$ select public.editar_demanda('19300000-0000-0000-0000-000000000002', 'Certidão negativa', 'Descrição',
  '19100000-0000-0000-0000-000000000003') $$, 'P0001', 'Escolha um contato desta empresa.', 'contato de fora da empresa é recusado');

-- 23-26: a lista (visão demandas_lista): vencida, pausada, nomes, RLS.
select is((select vencida from public.demandas_lista where id = '19300000-0000-0000-0000-000000000003'), true, 'prazo passado: vencida');
select is((select vencida from public.demandas_lista where id = '19300000-0000-0000-0000-000000000004'), false, 'pausada em Com o cliente: não vence');
select results_eq($$ select empresa, setor, responsavel, contato from public.demandas_lista where id = '19300000-0000-0000-0000-000000000001' $$,
  $$ values ('Indústria 19', 'Fiscal', 'Ana', 'Carla') $$, 'nomes resolvidos na lista');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a3","role":"authenticated"}', true);
select is((select count(*) from public.demandas_lista where setor = 'Fiscal'), 0::bigint, 'Caio não vê o Fiscal na lista');

-- 27-32: nova demanda pela equipe (Ana).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000019a1","role":"authenticated"}', true);
create temp table nova as select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Férias da Joana', 'Cálculo de férias a partir de 20/10', 'alta', null, '00000000-0000-0000-0000-0000000019a2',
  '19100000-0000-0000-0000-000000000001') as r;
select results_eq($$ select origem, criado_por, prioridade::text, responsavel_id, contato_id, prazo_em = public.calcular_prazo('alta', criado_em)
                     from public.chamados where id = (select (r ->> 'id')::uuid from nova) $$,
  $$ values ('equipe', '00000000-0000-0000-0000-0000000019a1'::uuid, 'alta', '00000000-0000-0000-0000-0000000019a2'::uuid,
            '19100000-0000-0000-0000-000000000001'::uuid, true) $$, 'nova demanda: origem equipe, quem abriu, prioridade, prazo sugerido');
select results_eq($$ select tipo, usuario_id from public.chamado_eventos where chamado_id = (select (r ->> 'id')::uuid from nova)
                     and tipo in ('criacao', 'prazo_alterado') order by criado_em $$,
  $$ values ('criacao', '00000000-0000-0000-0000-0000000019a1'::uuid), ('prazo_alterado', null::uuid) $$,
  'abriu por Ana; prazo sugerido pelo Sistema');
create temp table nova2 as select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Holerite', '', 'normal', '2030-01-15 12:00-03') as r;
select is((select usuario_id from public.chamado_eventos where chamado_id = (select (r ->> 'id')::uuid from nova2) and tipo = 'prazo_alterado'),
  '00000000-0000-0000-0000-0000000019a1'::uuid, 'prazo escolhido por quem abriu fica com o nome dela');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Holerite', '', 'normal', null, '00000000-0000-0000-0000-0000000019a3') $$,
  'P0001', 'Escolha uma pessoa ativa do setor da demanda.', 'responsável de outro setor é recusado na nova demanda');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'), 'ab', '') $$,
  'P0001', 'O título precisa ter de 3 a 120 caracteres.', 'título curto é recusado');
select throws_ok($$ select public.criar_demanda('19000000-0000-0000-0000-000000000001', (select id from public.setores where nome = 'Fiscal'),
  'Holerite', '', 'normal', null, null, '19100000-0000-0000-0000-000000000003') $$,
  'P0001', 'Escolha um contato desta empresa.', 'contato de outra empresa é recusado');

-- 33-35: preferência Tabela/Quadro.
select lives_ok($$ select public.definir_visao_demandas('quadro') $$, 'escolhe o quadro');
select is((select visao_demandas from public.usuarios where id = '00000000-0000-0000-0000-0000000019a1'), 'quadro', 'preferência gravada');
select throws_ok($$ select public.definir_visao_demandas('lista') $$, 'P0001', 'Visão inválida.', 'valor estranho é recusado');

-- 36-37: anônimo não chama as ações; o painel chama calcular_prazo.
reset role;
select ok(not has_function_privilege('anon', 'public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid)', 'execute'),
  'anônimo não abre demanda');
select ok(has_function_privilege('authenticated', 'public.calcular_prazo(public.prioridade_demanda, timestamptz)', 'execute'),
  'o painel calcula o prazo sugerido');

select * from finish();
rollback;
```

Run: `supabase test db`
Esperado: FALHA no arquivo 19 (`function public.assumir_demanda(uuid) does not exist`).

- [ ] **Passo 2: escrever a migração**

Crie `supabase/migrations/20261003000400_painel_v2_acoes_demanda.sql`:

```sql
-- supabase/migrations/20261003000400_painel_v2_acoes_demanda.sql
-- Painel v2, Parte C (spec 6.3, 6.4 e 6.6): as ações da demanda sem sair da tela, a lista com nomes e "vencida",
-- a busca e a preferência Tabela/Quadro de cada pessoa.

-- ---------- Preferência Tabela/Quadro (como o tamanho da letra da Parte A) ----------

alter table public.usuarios
  add column visao_demandas text not null default 'tabela' check (visao_demandas in ('tabela', 'quadro'));

create function public.definir_visao_demandas(p_visao text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_visao is null or p_visao not in ('tabela', 'quadro') then raise exception 'Visão inválida.'; end if;
  if not public.eh_usuario_ativo() then raise exception 'Acesso desativado.'; end if;
  update public.usuarios set visao_demandas = p_visao where id = auth.uid();
end $$;

-- ---------- Apoio (só para as funções abaixo) ----------

-- Confere o acesso (setores da pessoa, responsável ou administrador) e trava a demanda até o fim da ação.
create function public.demanda_para_agir(p_chamado uuid, p_aberta boolean default true) returns public.chamados
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype;
begin
  if not public.pode_ver_chamado(p_chamado) then raise exception 'Você não tem acesso a esta demanda.'; end if;
  select * into v from public.chamados where id = p_chamado for update;
  if v.id is null then raise exception 'Você não tem acesso a esta demanda.'; end if;
  if p_aberta and v.status = 'concluido' then raise exception 'Esta demanda está concluída. Reabra antes de mudar.'; end if;
  return v;
end $$;

-- Pessoa ativa do setor (na Triagem, qualquer pessoa ativa) ou administrador.
create function public.pode_ser_responsavel(p_usuario uuid, p_setor uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios u where u.id = p_usuario and u.ativo
      and (u.papel = 'admin' or p_setor is null
           or exists (select 1 from public.usuario_setores us where us.usuario_id = u.id and us.setor_id = p_setor))
  )
$$;

-- Contato ativo ligado à empresa.
create function public.contato_da_empresa(p_contato uuid, p_cliente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contato_clientes cc join public.contatos ct on ct.id = cc.contato_id
    where cc.contato_id = p_contato and cc.cliente_id = p_cliente and ct.ativo
  )
$$;

-- ---------- Ações ----------

-- Assumir só a demanda (P2): a conversa continua com o agente até alguém assumi-la no Atendimento.
create function public.assumir_demanda(p_chamado uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_nome text;
begin
  v := public.demanda_para_agir(p_chamado);
  if v.responsavel_id = auth.uid() then return; end if;
  if v.responsavel_id is not null then
    select nome into v_nome from public.usuarios where id = v.responsavel_id;
    raise exception 'A demanda já está com %.', v_nome;
  end if;
  update public.chamados
    set responsavel_id = auth.uid(),
        status = case when status = 'aberto' then 'em_andamento'::public.status_chamado else status end
    where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id) values (p_chamado, v.cliente_id, 'assumido', auth.uid());
end $$;

create function public.definir_responsavel(p_chamado uuid, p_responsavel uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_nome text;
begin
  v := public.demanda_para_agir(p_chamado);
  if v.responsavel_id is not distinct from p_responsavel then return; end if;
  if p_responsavel is not null and not public.pode_ser_responsavel(p_responsavel, v.setor_id) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  update public.chamados set responsavel_id = p_responsavel where id = p_chamado;
  select nome into v_nome from public.usuarios where id = p_responsavel;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (p_chamado, v.cliente_id, 'responsavel_alterado', auth.uid(), v_nome);
end $$;

-- Mesma assinatura de antes (o Atendimento usa); agora com evento e sem mexer em demanda concluída. A pausa é do gatilho.
create or replace function public.alterar_status_chamado(p_chamado uuid, p_status public.status_chamado) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype;
begin
  if p_status = 'concluido' then raise exception 'use concluir_chamado'; end if;
  v := public.demanda_para_agir(p_chamado);
  if v.status = p_status then return; end if;
  update public.chamados set status = p_status where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (p_chamado, v.cliente_id, 'status_alterado', auth.uid(), p_status::text);
end $$;

-- Prioridade nova sem prazo escolhido: o prazo é recalculado a partir de agora (P4). Prazo à mão nunca muda a prioridade.
create function public.definir_prioridade_prazo(
  p_chamado uuid, p_prioridade public.prioridade_demanda default null, p_prazo timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_prazo timestamptz;
begin
  v := public.demanda_para_agir(p_chamado);
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  if p_prioridade is not null and p_prioridade <> v.prioridade then
    v_prazo := coalesce(p_prazo, public.calcular_prazo(p_prioridade, now()));
    update public.chamados set prioridade = p_prioridade, prazo_em = v_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prioridade_alterada', auth.uid(), p_prioridade::text);
    if v_prazo is distinct from v.prazo_em then
      insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
        values (p_chamado, v.cliente_id, 'prazo_alterado', case when p_prazo is not null then auth.uid() end, public.texto_prazo(v_prazo));
    end if;
  elsif p_prazo is not null and p_prazo is distinct from v.prazo_em then
    update public.chamados set prazo_em = p_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prazo_alterado', auth.uid(), public.texto_prazo(p_prazo));
  end if;
  return (select jsonb_build_object('prioridade', c.prioridade, 'prazo_em', c.prazo_em) from public.chamados c where c.id = p_chamado);
end $$;

-- Reabrir: volta para Nova e ganha prazo novo (com o antigo, nasceria vencida).
create function public.reabrir_demanda(p_chamado uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_prazo timestamptz;
begin
  v := public.demanda_para_agir(p_chamado, false);
  if v.status <> 'concluido' then raise exception 'A demanda já está aberta.'; end if;
  v_prazo := public.calcular_prazo(v.prioridade, now());
  update public.chamados set status = 'aberto', concluido_em = null, prazo_em = v_prazo, prazo_pausado_desde = null where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id) values (p_chamado, v.cliente_id, 'reaberto', auth.uid());
  if v_prazo is not null then
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, texto)
      values (p_chamado, v.cliente_id, 'prazo_alterado', public.texto_prazo(v_prazo));
  end if;
end $$;

-- Título, descrição (resumo) e contato na empresa. Contato só é conferido quando muda (pode ter sido arquivado depois).
create function public.editar_demanda(p_chamado uuid, p_titulo text, p_descricao text, p_contato uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.chamados%rowtype;
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_mudou text[] := '{}';
begin
  v := public.demanda_para_agir(p_chamado, false);
  if char_length(v_titulo) not between 3 and 120 then raise exception 'O título precisa ter de 3 a 120 caracteres.'; end if;
  if char_length(v_descricao) > 4000 then raise exception 'A descrição pode ter até 4000 caracteres.'; end if;
  if p_contato is not null and p_contato is distinct from v.contato_id
     and (v.cliente_id is null or not public.contato_da_empresa(p_contato, v.cliente_id)) then
    raise exception 'Escolha um contato desta empresa.';
  end if;
  if v_titulo <> v.titulo then v_mudou := array_append(v_mudou, 'título'); end if;
  if v_descricao <> v.resumo then v_mudou := array_append(v_mudou, 'descrição'); end if;
  if p_contato is distinct from v.contato_id then v_mudou := array_append(v_mudou, 'contato'); end if;
  if cardinality(v_mudou) = 0 then return; end if;
  update public.chamados set titulo = v_titulo, resumo = v_descricao, contato_id = p_contato where id = p_chamado;
  insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
    values (p_chamado, v.cliente_id, 'editado', auth.uid(), array_to_string(v_mudou, ', '));
end $$;

-- Nova demanda pela equipe (ligação, e-mail, balcão). Empresa e setor obrigatórios (P10); prazo vazio = sugerido pelo banco.
create function public.criar_demanda(
  p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text,
  p_prioridade public.prioridade_demanda default 'normal', p_prazo timestamptz default null,
  p_responsavel uuid default null, p_contato uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_id uuid;
  v_numero bigint;
begin
  if not public.eh_usuario_ativo() then raise exception 'Acesso desativado.'; end if;
  if char_length(v_titulo) not between 3 and 120 then raise exception 'O título precisa ter de 3 a 120 caracteres.'; end if;
  if char_length(v_descricao) > 4000 then raise exception 'A descrição pode ter até 4000 caracteres.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ativo) then raise exception 'Escolha uma empresa ativa.'; end if;
  if not exists (select 1 from public.setores where id = p_setor and ativo) then raise exception 'Escolha o setor.'; end if;
  if not public.eh_admin() and p_setor not in (select public.meus_setores()) then raise exception 'Escolha um dos seus setores.'; end if;
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  if p_responsavel is not null and not public.pode_ser_responsavel(p_responsavel, p_setor) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  if p_contato is not null and not public.contato_da_empresa(p_contato, p_cliente) then raise exception 'Escolha um contato desta empresa.'; end if;
  insert into public.chamados (cliente_id, setor_id, responsavel_id, contato_id, titulo, resumo, prioridade, prazo_em, origem, criado_por)
    values (p_cliente, p_setor, p_responsavel, p_contato, v_titulo, v_descricao, coalesce(p_prioridade, 'normal'), p_prazo, 'equipe', auth.uid())
    returning id, numero into v_id, v_numero;
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

-- ---------- Lista da tela (tabela, quadro, contadores e CSV leem daqui) ----------

-- security_invoker: o RLS de chamados vale para quem consulta (atendente só vê os seus setores).
create view public.demandas_lista with (security_invoker = true) as
select
  c.id, c.numero, c.titulo, c.resumo, c.status, c.prioridade, c.prazo_em, c.prazo_pausado_desde,
  c.criado_em, c.atualizado_em, c.concluido_em, c.origem, c.conversa_id, c.cliente_id, c.setor_id,
  c.responsavel_id, c.contato_id, c.criado_por, c.fora_do_contrato, c.pedido_venda,
  c.pedido_venda is not null as tem_pedido,
  coalesce(cl.nome_fantasia, cl.razao_social) as empresa,
  s.nome as setor,
  r.nome as responsavel,
  ct.nome as contato,
  cp.nome as criado_por_nome,
  (c.status <> 'concluido' and c.prazo_pausado_desde is null and c.prazo_em < now()) as vencida
from public.chamados c
left join public.clientes cl on cl.id = c.cliente_id
left join public.setores s on s.id = c.setor_id
left join public.usuarios r on r.id = c.responsavel_id
left join public.contatos ct on ct.id = c.contato_id
left join public.usuarios cp on cp.id = c.criado_por;
grant select on public.demandas_lista to authenticated;

-- Busca por texto no título e na descrição (spec 6.6); ordenação por atualização e prazo.
create extension if not exists pg_trgm with schema extensions;
create index chamados_titulo_trgm_idx on public.chamados using gin (titulo extensions.gin_trgm_ops);
create index chamados_resumo_trgm_idx on public.chamados using gin (resumo extensions.gin_trgm_ops);
create index chamados_atualizado_idx on public.chamados (atualizado_em desc);
create index chamados_prazo_idx on public.chamados (prazo_em) where status <> 'concluido';

-- ---------- Permissões ----------

revoke all on function public.demanda_para_agir(uuid, boolean), public.pode_ser_responsavel(uuid, uuid),
  public.contato_da_empresa(uuid, uuid) from public, anon, authenticated;
revoke all on function public.definir_visao_demandas(text), public.assumir_demanda(uuid), public.definir_responsavel(uuid, uuid),
  public.alterar_status_chamado(uuid, public.status_chamado),
  public.definir_prioridade_prazo(uuid, public.prioridade_demanda, timestamptz), public.reabrir_demanda(uuid),
  public.editar_demanda(uuid, text, text, uuid),
  public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid)
  from public, anon;
grant execute on function public.definir_visao_demandas(text), public.assumir_demanda(uuid), public.definir_responsavel(uuid, uuid),
  public.alterar_status_chamado(uuid, public.status_chamado),
  public.definir_prioridade_prazo(uuid, public.prioridade_demanda, timestamptz), public.reabrir_demanda(uuid),
  public.editar_demanda(uuid, text, text, uuid),
  public.criar_demanda(uuid, uuid, text, text, public.prioridade_demanda, timestamptz, uuid, uuid)
  to authenticated;
```

- [ ] **Passo 3: aplicar e ver passar**

```bash
supabase migration up
supabase test db
```

Esperado: `19_painel_v2_acoes_demanda.test.sql .. ok` (37/37), o 18 com 28/28 e todos os outros `ok` (inclusive o `04_caixa_entrada`, que chama `alterar_status_chamado` como Ana, do Fiscal).

- [ ] **Passo 4: regerar os tipos e conferir**

```bash
pnpm db:tipos
git diff --stat packages/db/src/tipos.gen.ts
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/trabalhador typecheck
```

Esperado: o diff mostra `visao_demandas` em `usuarios`, a visão `demandas_lista` em `Views` e as funções novas; os dois typechecks passam.

- [ ] **Passo 5: commit**

Devolva `config.toml` e `.env` às portas originais antes e confira com `git status`.

```bash
git add supabase/migrations/20261003000400_painel_v2_acoes_demanda.sql supabase/tests/19_painel_v2_acoes_demanda.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(demandas): ações da demanda, lista com nomes e busca (banco)

Migração nova 20261003000400: assumir, responsável, status com evento,
prioridade e prazo, reabrir, editar e nova demanda, todas conferindo o acesso
pelos setores e travando a demanda durante a ação. A visão demandas_lista
traz os nomes, "tem pedido" e "vencida" (pausada não vence) com o RLS de quem
consulta; índices pg_trgm para a busca. Preferência Tabela/Quadro no perfil.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Trabalhador. O agente dá a prioridade ao abrir a demanda

**Arquivos:**
- Modificar: `apps/trabalhador/src/agente/ferramentas.ts` (esquemas de `abrir_chamado` e `abrir_pedido_nota`, `Entradas`, as duas chamadas de `abrirChamado`)
- Modificar: `apps/trabalhador/src/agente/prompt.ts` (regra 14, antes de `SETORES:`)
- Teste: `apps/trabalhador/test/agente/executar.test.ts`, `test/agente/cadastros.test.ts`, `test/agente/prompt.test.ts`

**Interfaces:**
- Consome: `NovoChamado.prioridade?: Prioridade` (Task 1).
- Produz: o parâmetro `prioridade` (`'baixa' | 'normal' | 'alta' | 'urgente'`, obrigatório no esquema que vai ao modelo, `'normal'` quando falta na validação) em `abrir_chamado` e `abrir_pedido_nota`. O resultado das ferramentas **não** traz o prazo (regra 10: o agente não promete prazo).

- [ ] **Passo 1: testes (falham)**

Em `apps/trabalhador/test/agente/executar.test.ts`, dentro do `describe('executarAgente', ...)`, acrescente:

```ts
  it('abrir_chamado grava a prioridade do agente; o prazo é do banco e não volta para o modelo (Parte C)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: await setorId('Fiscal'), titulo: 'URGENTE: nota errada', resumo: 'A nota de ontem saiu errada',
        fora_do_contrato: false, prioridade: 'urgente' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já passei para a equipe.' } }),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    const { data } = await db.from('chamados').select('prioridade, prazo_em').single();
    expect(data!.prioridade).toBe('urgente');
    expect(data!.prazo_em).not.toBeNull();
    const resultado = JSON.stringify(ia.recebidos[1]!.messages);
    expect(resultado).not.toContain('prazo');
  });

  it('sem prioridade na entrada, a demanda abre como normal', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_chamado', entrada: { setor_id: await setorId('Fiscal'), titulo: 'Guia DAS', resumo: 'x', fora_do_contrato: false } }),
      fim(),
    ]);
    await executarAgente(deps(ia), await contexto(conversa.id), conteudo);
    expect((await db.from('chamados').select('prioridade').single()).data!.prioridade).toBe('normal');
  });
```

Em `apps/trabalhador/test/agente/cadastros.test.ts`, dentro do `describe('pedido de nota: resumo para o cliente e demanda no Fiscal', ...)`, acrescente:

```ts
  it('a nota leva a prioridade que o agente mandou (regra 14); sem ela, normal', async () => {
    await usar('resumir_pedido_nota', base());
    expect((await abrir({ prioridade: 'urgente' }))._erro).toBe(false);
    await usar('resumir_pedido_nota', base({ observacoes: 'segunda nota' }));
    expect((await abrir({ observacoes: 'segunda nota' }))._erro).toBe(false);
    const { data } = await db.from('chamados').select('prioridade, prazo_em').order('numero');
    expect(data!.map((c) => c.prioridade)).toEqual(['urgente', 'normal']);
    expect(data!.every((c) => c.prazo_em !== null)).toBe(true);
  });
```

Em `apps/trabalhador/test/agente/prompt.test.ts`, no mesmo `describe` que testa as regras 10 a 13 (onde `s` já é o prompt montado), acrescente:

```ts
  it('regra 14: prioridade da demanda nos casos do spec (Parte C)', () => {
    const r14 = s.slice(s.indexOf('\n14. '), s.indexOf('\nSETORES:'));
    expect(r14).toContain('campo prioridade de abrir_chamado e abrir_pedido_nota');
    expect(r14).toContain('- urgente: o cliente diz que é urgente ou para hoje');
    expect(r14).toContain('- alta: assunto sensível (regra 11) e cobrança do cliente sobre assunto em aberto (regra 13).');
    expect(r14).toContain('- normal: todo o resto, inclusive pedido de nota (regra 3a) e dúvida técnica simples');
    expect(r14).toContain('- baixa: só quando o cliente diz que não tem pressa.');
    expect(r14).toContain('nunca informe esse prazo ao cliente');
  });
```

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/executar.test.ts test/agente/cadastros.test.ts test/agente/prompt.test.ts`
Esperado: FALHA (prioridade `normal` onde se esperava `urgente`; regra 14 não existe).

- [ ] **Passo 2: o parâmetro nas ferramentas**

Em `apps/trabalhador/src/agente/ferramentas.ts`, logo depois de `const OBRIGATORIOS_PEDIDO = [...]`:

```ts
const PRIORIDADES = ['baixa', 'normal', 'alta', 'urgente'] as const;
/** Prioridade da demanda (regra 14 do prompt). O prazo é calculado pelo banco e não volta para o modelo. */
const CAMPO_PRIORIDADE = {
  type: 'string', enum: [...PRIORIDADES],
  description: 'Regra 14: normal na maioria dos casos; alta em assunto sensível e cobrança; urgente quando o cliente diz que é urgente ou há prejuízo imediato; baixa só quando o cliente diz que não tem pressa.',
};
```

No esquema de `abrir_chamado`, acrescente `prioridade: CAMPO_PRIORIDADE` às propriedades e `'prioridade'` à lista de obrigatórios:

```ts
    input_schema: objeto({
      setor_id: { type: 'string' },
      titulo: { type: 'string', description: 'Título curto, por exemplo "Guia DAS de setembro".' },
      resumo: { type: 'string', description: 'O que o cliente pediu, com todos os detalhes informados.' },
      fora_do_contrato: { type: 'boolean' },
      prioridade: CAMPO_PRIORIDADE,
    }, ['setor_id', 'titulo', 'resumo', 'fora_do_contrato', 'prioridade']),
```

No esquema de `abrir_pedido_nota`:

```ts
    input_schema: objeto({
      ...CAMPOS_PEDIDO,
      pedido_original: { type: 'string', description: 'Texto do pedido do cliente, copiado sem alterar.' },
      cliente_confirmou_resumo: { type: 'boolean', description: 'true só depois de o cliente confirmar o resumo e dizer que não tem mais nota para pedir agora.' },
      prioridade: CAMPO_PRIORIDADE,
    }, [...OBRIGATORIOS_PEDIDO, 'pedido_original', 'cliente_confirmou_resumo', 'prioridade']),
```

Em `Entradas`:

```ts
  abrir_chamado: z.object({
    setor_id: z.string(), titulo: z.string().min(3).max(120), resumo: z.string().min(1).max(4000), fora_do_contrato: z.boolean(),
    prioridade: z.enum(PRIORIDADES).default('normal'),
  }),
```

```ts
  abrir_pedido_nota: PedidoNota.extend({
    pedido_original: z.string().min(1).max(4000), cliente_confirmou_resumo: z.boolean(), prioridade: z.enum(PRIORIDADES).default('normal'),
  }),
```

No `case 'abrir_chamado'`, na chamada de `d.repos.abrirChamado`, acrescente `prioridade: entrada.prioridade`:

```ts
        ({ numero } = await d.repos.abrirChamado({
          clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
          titulo: entrada.titulo, resumo: entrada.resumo, foraDoContrato: entrada.fora_do_contrato, origem: 'agente',
          prioridade: entrada.prioridade,
        }));
```

No `case 'abrir_pedido_nota'` (a prioridade vem da entrada, não do resumo conferido):

```ts
      const { id: chamadoId, numero } = await d.repos.abrirChamado({
        clienteId: e.clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
        titulo, resumo, foraDoContrato: false, origem: 'agente', prioridade: entrada.prioridade,
      });
```

A triagem já aberta que recebe informação nova (`complementarChamado`) não muda de prioridade: quem cuida da Triagem decide.

- [ ] **Passo 3: a regra 14 no prompt**

Em `apps/trabalhador/src/agente/prompt.ts`, depois do último item da regra 13 (a linha que termina em `"Já cobrei a equipe e marquei como prioridade."`) e antes da linha em branco de `SETORES:`, acrescente:

```
14. Prioridade da demanda (campo prioridade de abrir_chamado e abrir_pedido_nota): escolha sem comentar com o cliente.
   - urgente: o cliente diz que é urgente ou para hoje, ou há prejuízo imediato (nota já emitida errada a corrigir ou cancelar, possível golpe, funcionário que já começou sem registro, fiscalização no local, segunda cobrança); são os casos de título "URGENTE:".
   - alta: assunto sensível (regra 11) e cobrança do cliente sobre assunto em aberto (regra 13).
   - normal: todo o resto, inclusive pedido de nota (regra 3a) e dúvida técnica simples, salvo se o cliente pedir urgência.
   - baixa: só quando o cliente diz que não tem pressa.
   O sistema calcula o prazo da equipe pela prioridade: nunca informe esse prazo ao cliente (regra 10).
```

- [ ] **Passo 4: ver passar**

```bash
pnpm --filter @escritorio/trabalhador test
pnpm --filter @escritorio/trabalhador typecheck
```

Esperado: tudo passa (o `simular.ts` usa os mesmos esquemas; sem prioridade, vale `normal`).

- [ ] **Passo 5: commit**

```bash
git add apps/trabalhador/src/agente/ferramentas.ts apps/trabalhador/src/agente/prompt.ts \
  apps/trabalhador/test/agente/executar.test.ts apps/trabalhador/test/agente/cadastros.test.ts apps/trabalhador/test/agente/prompt.test.ts
git commit -m "$(cat <<'EOF'
feat(agente): prioridade ao abrir demanda e pedido de nota (regra 14)

abrir_chamado e abrir_pedido_nota ganham o parâmetro prioridade (spec 6.5):
sensível e cobrança = alta; nota e dúvida simples = normal; urgência
declarada e os casos de "URGENTE:" = urgente; baixa só sem pressa. O prazo é
calculado pelo banco e não volta para o modelo (regra 10).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Trabalhador. Alerta de vencimento e "Demanda #N"

**Arquivos:**
- Criar: `supabase/migrations/20261003000500_painel_v2_alerta_vencimento.sql`
- Criar: `supabase/tests/20_painel_v2_alerta_vencimento.test.sql`
- Modificar: `packages/db/src/repos.ts` (`registrarAlerta`, `demandasVencidasParaAlertar`, `marcarAlertadoVencimento`)
- Modificar: `apps/trabalhador/src/alertas.ts`, `src/tarefas.ts`, `src/principal.ts:65`
- Teste: `apps/trabalhador/test/tarefas.test.ts`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consome: `chamados.prazo_em`, `prazo_pausado_desde`, `alertado_vencimento_em` (Task 1; o gatilho limpa `alertado_vencimento_em` quando o prazo muda).
- Produz:
  - `alertas.usuario_id` (FK `usuarios`, `on delete cascade`): alerta só daquela pessoa (e do administrador);
  - `repos.registrarAlerta(a: { nivel; mensagem; setorId?: string | null; usuarioId?: string | null })`;
  - `repos.demandasVencidasParaAlertar(agora: Date): Promise<{ id: string; numero: number; titulo: string; setorId: string | null; responsavelId: string | null }[]>` (`responsavelId` nulo quando o responsável está arquivado);
  - `repos.marcarAlertadoVencimento(ids: string[]): Promise<void>`;
  - `Alertas.alertar(a: { nivel; mensagem; setorId?: string | null; usuarioId?: string | null })`;
  - `alertaVencimento(d: DepsTarefas): Promise<number>` em `tarefas.ts`, rodando junto do alerta da fila (a cada 5 minutos);
  - textos: `Demanda #N "Título" está sem responsável há mais de X minutos.` e `Demanda #N "Título" venceu o prazo.`

- [ ] **Passo 1: pgTAP (falha)**

Crie `supabase/tests/20_painel_v2_alerta_vencimento.test.sql`:

```sql
-- supabase/tests/20_painel_v2_alerta_vencimento.test.sql
-- Parte C (spec 6.5): o alerta de vencimento vai para o responsável; sem responsável, para o setor.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000020a1', 'ana20@pgtap.local'),
  ('00000000-0000-0000-0000-0000000020a2', 'bia20@pgtap.local'),
  ('00000000-0000-0000-0000-0000000020a3', 'dora20@pgtap.local');
insert into public.usuarios (id, nome, email, papel) values
  ('00000000-0000-0000-0000-0000000020a1', 'Ana', 'ana20@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000020a2', 'Bia', 'bia20@pgtap.local', 'atendente'),
  ('00000000-0000-0000-0000-0000000020a3', 'Dora', 'dora20@pgtap.local', 'admin');
insert into public.usuario_setores (usuario_id, setor_id)
  select u, s.id from (values ('00000000-0000-0000-0000-0000000020a1'::uuid), ('00000000-0000-0000-0000-0000000020a2'::uuid)) v(u),
    public.setores s where s.nome = 'Fiscal';
insert into public.alertas (id, nivel, mensagem, setor_id, usuario_id) values
  ('20000000-0000-0000-0000-000000000001', 'aviso', 'Demanda #1 "Guia DAS" venceu o prazo.', null, '00000000-0000-0000-0000-0000000020a1');
insert into public.alertas (id, nivel, mensagem, setor_id)
  select '20000000-0000-0000-0000-000000000002', 'aviso', 'Demanda #2 "Certidão" venceu o prazo.', id from public.setores where nome = 'Fiscal';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
select is((select count(*) from public.alertas where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')),
  2::bigint, 'Ana vê o alerta dela e o do setor');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a2","role":"authenticated"}', true);
select results_eq($$ select id from public.alertas where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002') $$,
  $$ values ('20000000-0000-0000-0000-000000000002'::uuid) $$, 'Bia, do mesmo setor, não vê o alerta que é só da Ana');
select public.marcar_alerta_lido('20000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a3","role":"authenticated"}', true);
select is((select count(*) from public.alertas where id in ('20000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002')),
  2::bigint, 'o administrador vê os dois');
select is((select lido_em from public.alertas where id = '20000000-0000-0000-0000-000000000001'), null::timestamptz, 'Bia não marca como lido o alerta da Ana');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000020a1","role":"authenticated"}', true);
select public.marcar_alerta_lido('20000000-0000-0000-0000-000000000001');
select isnt((select lido_em from public.alertas where id = '20000000-0000-0000-0000-000000000001'), null::timestamptz, 'Ana marca o dela como lido');

select * from finish();
rollback;
```

Run: `supabase test db`
Esperado: FALHA no arquivo 20 (`column "usuario_id" of relation "alertas" does not exist`).

- [ ] **Passo 2: a migração**

Crie `supabase/migrations/20261003000500_painel_v2_alerta_vencimento.sql`:

```sql
-- supabase/migrations/20261003000500_painel_v2_alerta_vencimento.sql
-- Painel v2, Parte C (spec 6.5): o alerta de demanda vencida avisa o responsável; sem responsável, o setor.

alter table public.alertas add column usuario_id uuid references public.usuarios (id) on delete cascade;

-- Alerta com pessoa é só dela (e do administrador); sem pessoa, continua do setor.
drop policy leitura on public.alertas;
create policy leitura on public.alertas for select to authenticated using (
  public.eh_admin()
  or (public.eh_usuario_ativo() and usuario_id = auth.uid())
  or (usuario_id is null and setor_id is not null and setor_id in (select public.meus_setores()))
);

create or replace function public.marcar_alerta_lido(p_alerta uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.alertas set lido_em = now()
  where id = p_alerta and (
    public.eh_admin()
    or (public.eh_usuario_ativo() and usuario_id = auth.uid())
    or (usuario_id is null and setor_id is not null and setor_id in (select public.meus_setores()))
  );
end $$;
```

```bash
supabase migration up
supabase test db
pnpm db:tipos
```

Esperado: `20_painel_v2_alerta_vencimento.test.sql .. ok` (5/5) e todos os outros `ok`; o diff dos tipos mostra só `usuario_id` em `alertas`.

- [ ] **Passo 3: testes do trabalhador (falham)**

Em `apps/trabalhador/test/tarefas.test.ts`:
- acrescente `alertaVencimento` ao import de `../src/tarefas`;
- no teste do `alertaFila`, troque `expect(alertados[0]!.mensagem).toContain('Guia DAS');` por:

```ts
    expect(alertados[0]!.mensagem).toMatch(/^Demanda #\d+ "Guia DAS" está sem responsável há mais de 5 minutos\.$/);
```

- acrescente, depois do `describe('alertaFila', ...)`:

```ts
describe('alertaVencimento', () => {
  const ontem = () => new Date(Date.now() - 24 * 3600_000).toISOString();
  async function demanda(titulo: string, extra: object = {}) {
    const fiscal = await setorId('Fiscal');
    const { data } = await db.from('chamados').insert({ setor_id: fiscal, titulo, prazo_em: ontem(), ...extra }).select('id, numero').single();
    return { id: data!.id, numero: Number(data!.numero), fiscal };
  }

  it('avisa o responsável, ou o setor sem responsável, uma vez por prazo; pausada e concluída não vencem', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana@teste-vencimento.local', nome: 'Ana', papel: 'atendente', setores: ['Fiscal'] });
    const comAna = await demanda('Guia DAS', { responsavel_id: ana });
    const semNinguem = await demanda('Certidão');
    await demanda('Pausada', { status: 'aguardando_cliente' });
    await demanda('Concluída', { status: 'concluido' });
    await db.from('chamados').insert({ setor_id: comAna.fiscal, titulo: 'No prazo' });
    expect(await alertaVencimento(deps())).toBe(2);
    expect(alertados).toEqual(expect.arrayContaining([
      { nivel: 'aviso', usuarioId: ana, setorId: null, mensagem: `Demanda #${comAna.numero} "Guia DAS" venceu o prazo.` },
      { nivel: 'aviso', usuarioId: null, setorId: comAna.fiscal, mensagem: `Demanda #${semNinguem.numero} "Certidão" venceu o prazo.` },
    ]));
    expect(await alertaVencimento(deps())).toBe(0);
  });

  it('prazo novo libera um aviso novo', async () => {
    const d = await demanda('Guia DAS');
    expect(await alertaVencimento(deps())).toBe(1);
    await db.from('chamados').update({ prazo_em: new Date(Date.now() - 3600_000).toISOString() }).eq('id', d.id);
    expect(await alertaVencimento(deps())).toBe(1);
  });

  it('responsável arquivado: o aviso vai para o setor', async () => {
    const ze = await criarUsuarioTeste({ email: 'ze@teste-vencimento.local', nome: 'Zé', papel: 'atendente', setores: ['Fiscal'] });
    const d = await demanda('Guia DAS', { responsavel_id: ze });
    await db.from('usuarios').update({ ativo: false }).eq('id', ze);
    await alertaVencimento(deps());
    expect(alertados).toEqual([{ nivel: 'aviso', usuarioId: null, setorId: d.fiscal, mensagem: `Demanda #${d.numero} "Guia DAS" venceu o prazo.` }]);
  });
});
```

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/tarefas.test.ts`
Esperado: FALHA (`alertaVencimento` não existe; a mensagem da fila ainda diz "Chamado #").

- [ ] **Passo 4: implementar**

Em `packages/db/src/repos.ts`, troque `registrarAlerta`:

```ts
    async registrarAlerta(a: { nivel: 'critico' | 'operacional' | 'aviso'; mensagem: string; setorId?: string | null; usuarioId?: string | null }): Promise<void> {
      checar(await db.from('alertas').insert({ nivel: a.nivel, mensagem: a.mensagem, setor_id: a.setorId ?? null, usuario_id: a.usuarioId ?? null }), 'registrarAlerta');
    },
```

e acrescente, logo depois de `marcarAlertadoFila`:

```ts
    /** Demandas que passaram do prazo e ainda não foram avisadas. Pausadas em "Com o cliente" não vencem (spec 6.5). */
    async demandasVencidasParaAlertar(agora: Date): Promise<{ id: string; numero: number; titulo: string; setorId: string | null; responsavelId: string | null }[]> {
      const linhas = checar(await db.from('chamados').select('id, numero, titulo, setor_id, responsavel_id, usuarios(ativo)')
        .neq('status', 'concluido').is('prazo_pausado_desde', null).is('alertado_vencimento_em', null)
        .lt('prazo_em', agora.toISOString()), 'demandasVencidasParaAlertar');
      // Responsável arquivado não entra mais no painel: o aviso vai para o setor.
      return linhas.map((c) => ({
        id: c.id, numero: Number(c.numero), titulo: c.titulo, setorId: c.setor_id,
        responsavelId: c.responsavel_id && c.usuarios?.ativo ? c.responsavel_id : null,
      }));
    },

    async marcarAlertadoVencimento(ids: string[]): Promise<void> {
      if (ids.length === 0) return;
      checar(await db.from('chamados').update({ alertado_vencimento_em: new Date().toISOString() }).in('id', ids), 'marcarAlertadoVencimento');
    },
```

Em `apps/trabalhador/src/alertas.ts`, troque a assinatura da interface:

```ts
export interface Alertas {
  /** usuarioId: só aquela pessoa (e o administrador) vê no Início; sem ela, o setor. */
  alertar(a: { nivel: NivelAlerta; mensagem: string; setorId?: string | null; usuarioId?: string | null }): Promise<void>;
}
```

Em `apps/trabalhador/src/tarefas.ts`, troque a mensagem do `alertaFila`:

```ts
      mensagem: `Demanda #${c.numero} "${c.titulo}" está sem responsável há mais de ${cfg.minutosAlertaFila} minutos.`,
```

e acrescente depois de `alertaFila`:

```ts
/** Demanda vencida: avisa o responsável (sem responsável, o setor), uma vez por prazo (spec 6.5). */
export async function alertaVencimento(d: DepsTarefas): Promise<number> {
  const vencidas = await d.repos.demandasVencidasParaAlertar(d.relogio());
  for (const c of vencidas) {
    await d.alertas.alertar({
      nivel: 'aviso',
      usuarioId: c.responsavelId,
      setorId: c.responsavelId ? null : c.setorId,
      mensagem: `Demanda #${c.numero} "${c.titulo}" venceu o prazo.`,
    });
  }
  await d.repos.marcarAlertadoVencimento(vencidas.map((c) => c.id));
  return vencidas.length;
}
```

Em `apps/trabalhador/src/principal.ts`:
- acrescente `alertaVencimento` ao import de `./tarefas`;
- troque a linha do `boss.work(FILAS.alertaFila, ...)` por:

```ts
  // A cada 5 minutos: demanda sem responsável e demanda vencida.
  await boss.work(FILAS.alertaFila, async () => { await alertaFila(depsTarefas); await alertaVencimento(depsTarefas); });
```

Confira que nenhum outro texto de aviso do trabalhador diz "Chamado":

```bash
grep -rn "Chamado #\|chamado #" apps/trabalhador/src
```

Esperado: nenhuma linha.

- [ ] **Passo 5: ver passar**

```bash
pnpm --filter @escritorio/db test
pnpm --filter @escritorio/trabalhador test
pnpm --filter @escritorio/trabalhador typecheck
pnpm --filter @escritorio/painel typecheck
```

Esperado: tudo passa.

- [ ] **Passo 6: commit**

Devolva `config.toml` e `.env` às portas originais antes e confira com `git status`.

```bash
git add supabase/migrations/20261003000500_painel_v2_alerta_vencimento.sql supabase/tests/20_painel_v2_alerta_vencimento.test.sql \
  packages/db/src/repos.ts packages/db/src/tipos.gen.ts apps/trabalhador/src/alertas.ts apps/trabalhador/src/tarefas.ts \
  apps/trabalhador/src/principal.ts apps/trabalhador/test/tarefas.test.ts
git commit -m "$(cat <<'EOF'
feat(trabalhador): alerta de demanda vencida e avisos com "Demanda #N"

Migração nova 20261003000500: alertas.usuario_id, para o aviso ir só ao
responsável (sem responsável, ou com ele arquivado, vai para o setor). O
alerta periódico avisa uma vez por prazo; pausada em "Com o cliente" não
vence. O aviso de fila diz "Demanda #N" (pendência 9 do redesign).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Cenários com Claude real para a prioridade

**Arquivos:**
- Modificar: `apps/trabalhador/src/cenarios/cenarios.ts` (`espera.prioridade` e 5 cenários)
- Modificar: `apps/trabalhador/src/cenarios/rodar.ts` (conferir a prioridade; filtro pelo nome)

**Interfaces:**
- Consome: a regra 14 e o parâmetro `prioridade` (Task 3).
- Produz: `Cenario['espera'].prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente'` (alguma demanda aberta pelo agente na conversa tem essa prioridade, com prazo); `pnpm --filter @escritorio/trabalhador cenarios <trecho do nome>` roda só os cenários cujo nome contém o trecho.

- [ ] **Passo 1: a conferência e o filtro**

Em `apps/trabalhador/src/cenarios/cenarios.ts`, dentro de `espera`, acrescente:

```ts
    /** Alguma demanda aberta pelo agente tem esta prioridade (e o prazo que o banco calcula). */
    prioridade?: 'baixa' | 'normal' | 'alta' | 'urgente';
```

Em `apps/trabalhador/src/cenarios/rodar.ts`:
- na consulta das demandas do fim de `rodar`, acrescente `prioridade, prazo_em`:

```ts
  const { data: chamados } = await db.from('chamados').select('setor_id, fora_do_contrato, titulo, resumo, setores(nome), origem, prioridade, prazo_em')
    .eq('conversa_id', conversa.id).eq('origem', 'agente');
```

- logo depois da conferência de `foraDoContrato`, acrescente:

```ts
  if (e.prioridade && !chamados?.some((x) => x.prioridade === e.prioridade && x.prazo_em)) {
    falhas.push(`esperava uma demanda com prioridade ${e.prioridade} e prazo; obteve ${JSON.stringify(chamados?.map((x) => x.prioridade))}`);
  }
```

- em `principal`, troque o laço para rodar só os cenários do filtro:

```ts
  // `pnpm cenarios prioridade` roda só os cenários cujo nome contém "prioridade" (cada um custa chamadas ao Claude).
  const filtro = process.argv[2]?.trim();
  const lista = filtro ? CENARIOS.filter((c) => c.nome.includes(filtro)) : CENARIOS;
  let falhou = 0;
  for (const c of lista) {
    const falhas = await rodar(c).catch((e: Error) => [`erro: ${e.message}`]);
    if (falhas.length) falhou++;
    console.log(`${falhas.length ? '❌' : '✅'} ${c.nome}${falhas.length ? `\n   - ${falhas.join('\n   - ')}` : ''}`);
  }
  console.log(`\n${lista.length - falhou}/${lista.length} cenários passaram`);
  process.exit(falhou ? 1 : 0);
```

- [ ] **Passo 2: os 5 cenários do spec (6.7)**

No fim da lista `CENARIOS` (antes do `];`), acrescente:

```ts
  // Prioridade dada pelo agente (Parte C, spec 6.5 e 6.7): os 5 casos do spec, com a regra 14.
  { nome: 'prioridade: pedido de nota é normal', empresas: ['Indústria X'], cadastros: true,
    mensagens: ['Tira NF pro Brasil Santa Efigênia: 10 PAC costela'], mensagens2: ['Isso, pode passar, é só essa'],
    espera: { chamadoSetor: 'Fiscal', notasPorRodada: [0, 1], prioridade: 'normal' } },
  { nome: 'prioridade: cobrança do cliente é alta', empresas: ['Indústria X'], chamadoExistente: { setor: 'Fiscal', titulo: 'Guia DAS setembro' },
    mensagens: ['Até agora nada da guia do DAS que eu pedi semana passada. Vocês esqueceram de mim?'],
    espera: { chamadoSetor: 'Fiscal', tituloContem: ['Cobrança'], prioridade: 'alta' } },
  { nome: 'prioridade: assunto sensível é alta', empresas: ['Indústria X'], orientacoesDaSkill: true,
    setoresExtras: [{ nome: 'Direção', descricao: 'Reclamação séria, possível erro do escritório, troca de contador, fiscalização, assunto sensível' }],
    mensagens: ['Preciso de uma declaração de faturamento um pouco maior que o real pro banco liberar meu financiamento'],
    mensagens2: ['É pro Banco do Brasil, preciso até o fim do mês, coloca uns 50 mil por mês'],
    espera: { chamadoSetor: 'Direção', resumoContem: ['ASSUNTO SENSÍVEL'], prioridade: 'alta' } },
  { nome: 'prioridade: dúvida simples é normal', empresas: ['Indústria X'],
    mensagens: ['Posso dar férias para um funcionário em dezembro?'],
    espera: { chamadoSetor: 'Pessoal', prioridade: 'normal' } },
  { nome: 'prioridade: urgência declarada é urgente', empresas: ['Indústria X'],
    mensagens: ['Preciso URGENTE da guia do FGTS de setembro, vence hoje e o banco fecha às 16h!'],
    espera: { chamadoSetor: 'qualquer', prioridade: 'urgente' } },
```

```bash
pnpm --filter @escritorio/trabalhador typecheck
```

Esperado: passa.

- [ ] **Passo 3: rodar só os 5 (Claude real, banco local)**

Com o Supabase local ligado (portas 563xx) e as três migrações aplicadas:

```bash
pnpm --filter @escritorio/trabalhador cenarios prioridade
```

Esperado: `5/5 cenários passaram`. Custo estimado: US$ 1 a 2 (cerca de 40 chamadas ao modelo de conversa).

Se um cenário falhar **por causa da prioridade**, ajuste só o texto da regra 14 (Task 3, passo 3) e o teste da regra 14, e rode de novo. Se falhar por outro motivo (setor, título), anote a saída inteira para o dono: não mude outra regra do agente nesta parte. Guarde a saída (passou/falhou de cada cenário) para a Entrega.

- [ ] **Passo 4: commit**

Devolva `config.toml` e `.env` às portas originais antes e confira com `git status`.

```bash
git add apps/trabalhador/src/cenarios/cenarios.ts apps/trabalhador/src/cenarios/rodar.ts
git commit -m "$(cat <<'EOF'
test(cenarios): prioridade do agente nos 5 casos do spec, com Claude real

Nota e dúvida simples = normal, cobrança e sensível = alta, urgência
declarada = urgente (spec 6.7). "pnpm cenarios <trecho>" roda só os cenários
cujo nome contém o trecho, para não pagar a rodada inteira a cada ajuste.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Painel. Regras puras (filtros, consulta, prazo, linha do tempo) e rótulos novos

**Arquivos:**
- Modificar: `apps/painel/src/lib/demandas.ts`, `apps/painel/src/lib/demandas.test.ts`
- Criar: `apps/painel/src/lib/demandas-consulta.ts`, `apps/painel/src/lib/demandas-consulta.test.ts`
- Criar: `apps/painel/src/lib/prazo.ts`, `apps/painel/src/lib/prazo.test.ts`
- Criar: `apps/painel/src/lib/linha-do-tempo.ts`, `apps/painel/src/lib/linha-do-tempo.test.ts`
- Criar: `apps/painel/src/components/patterns/prioridade-prazo.tsx`
- Modificar: `apps/painel/src/components/patterns/status-badge.tsx` (+ `status-badge.test.ts`), `components/patterns/linha-do-tempo-demanda.tsx`
- Modificar: `apps/painel/src/lib/mensagem-banco.ts` (+ teste)

**Interfaces:**
- Consome: `valorParam`, `ParamsBusca`, `Ordem` (`lib/tabela-url`), `interpretarBusca` (`lib/busca`), `FUSO` (`lib/formatos`).
- Produz (`lib/demandas.ts`):
  - tipos `StatusFiltro`, `Prioridade`, `OrigemFiltro`, `TipoFiltro`, `PeriodoFiltro`, `Visao` e `FiltrosDemandas = { setor: string; status: StatusFiltro[]; origem: OrigemFiltro | null; vencidas: boolean; prazoHoje: boolean; responsavel: string | null; prioridade: Prioridade | null; tipo: TipoFiltro | null; periodo: PeriodoFiltro | null; q: string | null; demanda: string | null; nova: boolean }`;
  - `OPCOES_STATUS` (rótulos no plural dos botões: Novas, Resolvendo, Com o cliente, Concluídas), `ROTULO_STATUS` (singular: Nova, Resolvendo, Com o cliente, Concluída), `STATUS_PADRAO`, `OPCOES_ORIGEM`, `OPCOES_PRIORIDADE`, `ROTULO_PRIORIDADE`, `OPCOES_TIPO`, `OPCOES_PERIODO`, `ORDENS`, `ORDEM_PADRAO`, `COLUNA_DA_ORDEM`;
  - `lerFiltrosDemandas(params: ParamsBusca, eu?: string): FiltrosDemandas`, `statusAoAlternar(atual: StatusFiltro[], s: StatusFiltro): string | null`, `ehStatusPadrao(s: StatusFiltro[]): boolean`, `temFiltro(f: FiltrosDemandas): boolean`, `etiquetasFiltros(f, nomes: { setores: { id: string; nome: string }[]; pessoas: { id: string; nome: string; ativo: boolean }[] }): { param: string; rotulo: string }[]`, `iniciais(nome: string): string`; continuam `ehUuid`, `inicioDoDiaSP`, `inicioDoPeriodo`, `opcoesResponsavel`.
- Produz (`lib/demandas-consulta.ts`): `type ConsultaFiltravel<Q>`, `aplicarFiltrosDemandas<Q extends ConsultaFiltravel<Q>>(q: Q, f: FiltrosDemandas, euId: string, agora: Date, opcoes?: { semStatus?: boolean }): Q` e `filtrarConsulta<T>(q: T, f: FiltrosDemandas, euId: string, agora: Date, opcoes?: { semStatus?: boolean }): T`, o mesmo para o construtor tipado do supabase-js (consultas em `demandas_lista`).
- Produz (`lib/prazo.ts`): `type TomPrazo = 'vencido' | 'hoje' | 'pausado' | 'normal' | 'sem' | 'no-prazo'`, `descreverPrazo(p: { prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null }, agora: Date): { texto: string; tom: TomPrazo }`, `horaCurta(d: Date): string`, `prazoAbsoluto(iso: string): string`, `paraCampoDataHora(iso: string | null): string`, `doCampoDataHora(valor: string): string | null`.
- Produz (`lib/linha-do-tempo.ts`): `type EventoDemanda = { tipo: string; texto: string | null; criado_em: string; usuario: string | null }`, `fraseDoEvento(e: EventoDemanda, origem: string): { ator: string; acao: string; detalhe: string | null }`.
- Produz (componentes): `PrioridadeTexto({ prioridade, caixaAlta?, className? })`, `PrazoTexto({ prazo, pausadoDesde, concluidaEm, agora, className? })`; `LinhaDoTempoDemanda({ numero, eventos, origem?, className? })` (continua exportando `EventoDemanda`); `STATUS_DEMANDA` com os rótulos novos.

- [ ] **Passo 1: testes (falham)**

Troque o conteúdo de `apps/painel/src/lib/demandas.test.ts` por:

```ts
import { describe, expect, it } from 'vitest';
import {
  STATUS_PADRAO, etiquetasFiltros, iniciais, inicioDoDiaSP, inicioDoPeriodo, lerFiltrosDemandas, opcoesResponsavel, statusAoAlternar, temFiltro,
} from './demandas';

const ID = '3f2b8c1e-5d4a-4e7b-9c1f-2a3b4c5d6e7f';

describe('lerFiltrosDemandas', () => {
  it('sem parâmetros: todos os setores, as três abertas, nenhum outro filtro', () => {
    expect(lerFiltrosDemandas({})).toEqual({
      setor: 'todos', status: STATUS_PADRAO, origem: null, vencidas: false, prazoHoje: false, responsavel: null,
      prioridade: null, tipo: null, periodo: null, q: null, demanda: null, nova: false,
    });
  });
  it('setor mantém a semântica antiga (todos | triagem | id)', () => {
    expect(lerFiltrosDemandas({ setor: 'triagem' }).setor).toBe('triagem');
    expect(lerFiltrosDemandas({ setor: ID }).setor).toBe(ID);
    expect(lerFiltrosDemandas({ setor: "x' or 1=1" }).setor).toBe('todos');
  });
  it('status em lista, na ordem dos botões; lixo ou vazio volta ao padrão; ?status=concluido antigo continua valendo', () => {
    expect(lerFiltrosDemandas({ status: 'aguardando_cliente,aberto' }).status).toEqual(['aberto', 'aguardando_cliente']);
    expect(lerFiltrosDemandas({ status: 'concluido' }).status).toEqual(['concluido']);
    expect(lerFiltrosDemandas({ status: 'fechado' }).status).toEqual(STATUS_PADRAO);
    expect(lerFiltrosDemandas({ status: '' }).status).toEqual(STATUS_PADRAO);
  });
  it('lê os outros filtros e ignora valores estranhos', () => {
    const f = lerFiltrosDemandas({ origem: 'equipe', vencidas: '1', prazo: 'hoje', responsavel: 'sem', prioridade: 'urgente', tipo: 'venda',
      periodo: '7d', q: '  guia  ', demanda: ID, nova: '1' });
    expect(f).toMatchObject({ origem: 'equipe', vencidas: true, prazoHoje: true, responsavel: 'sem', prioridade: 'urgente', tipo: 'venda',
      periodo: '7d', q: 'guia', demanda: ID, nova: true });
    expect(lerFiltrosDemandas({ origem: 'x', vencidas: 'sim', prazo: 'ontem', responsavel: 'fulano', prioridade: 'maxima', q: '   ' }))
      .toMatchObject({ origem: null, vencidas: false, prazoHoje: false, responsavel: null, prioridade: null, q: null });
    expect(lerFiltrosDemandas({ responsavel: ID }, ID).responsavel).toBe('eu');
    expect(lerFiltrosDemandas({ q: 'x'.repeat(200) }).q).toHaveLength(80);
  });
});

describe('botões de status', () => {
  it('alternar um status monta a lista; voltar ao padrão ou esvaziar tira o parâmetro', () => {
    expect(statusAoAlternar(STATUS_PADRAO, 'concluido')).toBe('aberto,em_andamento,aguardando_cliente,concluido');
    expect(statusAoAlternar(STATUS_PADRAO, 'aberto')).toBe('em_andamento,aguardando_cliente');
    expect(statusAoAlternar(['em_andamento', 'aguardando_cliente'], 'aberto')).toBeNull();
    expect(statusAoAlternar(['concluido'], 'concluido')).toBeNull();
  });
  it('temFiltro: só o padrão não conta', () => {
    expect(temFiltro(lerFiltrosDemandas({}))).toBe(false);
    expect(temFiltro(lerFiltrosDemandas({ status: 'concluido' }))).toBe(true);
    expect(temFiltro(lerFiltrosDemandas({ q: 'guia' }))).toBe(true);
  });
});

describe('etiquetasFiltros (imagem 03: "Setor: Fiscal ×")', () => {
  it('uma etiqueta por filtro avançado, com o nome legível', () => {
    const f = lerFiltrosDemandas({ setor: ID, responsavel: 'eu', prioridade: 'alta', tipo: 'venda', periodo: '30d', prazo: 'hoje' });
    expect(etiquetasFiltros(f, { setores: [{ id: ID, nome: 'Fiscal' }], pessoas: [] })).toEqual([
      { param: 'setor', rotulo: 'Setor: Fiscal' },
      { param: 'responsavel', rotulo: 'Responsável: eu' },
      { param: 'prioridade', rotulo: 'Prioridade: Alta' },
      { param: 'tipo', rotulo: 'Tipo: Pedido de nota (venda)' },
      { param: 'periodo', rotulo: 'Aberta: Últimos 30 dias' },
      { param: 'prazo', rotulo: 'Prazo: vence hoje' },
    ]);
  });
  it('pessoa arquivada aparece como "(arquivado)"; sem responsável, "ninguém"', () => {
    const pessoas = [{ id: ID, nome: 'Zé', ativo: false }];
    expect(etiquetasFiltros(lerFiltrosDemandas({ responsavel: ID }), { setores: [], pessoas })).toEqual([{ param: 'responsavel', rotulo: 'Responsável: Zé (arquivado)' }]);
    expect(etiquetasFiltros(lerFiltrosDemandas({ responsavel: 'sem' }), { setores: [], pessoas })).toEqual([{ param: 'responsavel', rotulo: 'Responsável: ninguém' }]);
  });
});

describe('iniciais (avatar do quadro)', () => {
  it('primeira e última palavra; uma palavra só, duas letras', () => {
    expect(iniciais('Ana Paula Nunes')).toBe('AN');
    expect(iniciais('Ana')).toBe('AN');
    expect(iniciais('  ')).toBe('?');
  });
});

describe('período', () => {
  // 30/09/2026 01:30 em Brasília = 04:30 UTC
  const agora = new Date('2026-09-30T04:30:00Z');
  it('hoje começa à meia-noite de Brasília', () => {
    expect(inicioDoDiaSP(agora).toISOString()).toBe('2026-09-30T03:00:00.000Z');
    expect(inicioDoPeriodo('hoje', agora)).toBe('2026-09-30T03:00:00.000Z');
    expect(inicioDoDiaSP(new Date('2026-09-30T02:30:00Z')).toISOString()).toBe('2026-09-29T03:00:00.000Z');
  });
  it('7 e 30 dias contam para trás a partir de agora; sem período, null', () => {
    expect(inicioDoPeriodo('7d', agora)).toBe('2026-09-23T04:30:00.000Z');
    expect(inicioDoPeriodo('30d', agora)).toBe('2026-08-31T04:30:00.000Z');
    expect(inicioDoPeriodo(null, agora)).toBeNull();
  });
});

describe('opcoesResponsavel', () => {
  const pessoas = [{ id: 'eu', nome: 'Ana', ativo: true }, { id: 'bia', nome: 'Bia', ativo: true }, { id: 'ze', nome: 'Zé', ativo: false }];
  it('arquivado sai da seleção (spec 5.1); eu viro "Comigo" à parte', () => {
    expect(opcoesResponsavel(pessoas, 'eu', null)).toEqual([{ valor: 'bia', rotulo: 'Bia' }]);
  });
  it('arquivado que já está no filtro da URL aparece como "(arquivado)", nunca "(inativo)"', () => {
    expect(opcoesResponsavel(pessoas, 'eu', 'ze')).toEqual([{ valor: 'bia', rotulo: 'Bia' }, { valor: 'ze', rotulo: 'Zé (arquivado)' }]);
  });
});
```

Crie `apps/painel/src/lib/demandas-consulta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { aplicarFiltrosDemandas, type ConsultaFiltravel } from './demandas-consulta';
import { lerFiltrosDemandas } from './demandas';

/** Grava as chamadas, como o construtor do PostgREST receberia. */
class Gravador implements ConsultaFiltravel<Gravador> {
  chamadas: string[] = [];
  private g(t: string) { this.chamadas.push(t); return this; }
  is(c: string, v: boolean | null) { return this.g(`is ${c} ${v}`); }
  eq(c: string, v: string) { return this.g(`eq ${c} ${v}`); }
  in(c: string, v: readonly string[]) { return this.g(`in ${c} ${v.join('|')}`); }
  gte(c: string, v: string) { return this.g(`gte ${c} ${v}`); }
  lt(c: string, v: string) { return this.g(`lt ${c} ${v}`); }
  or(f: string) { return this.g(`or ${f}`); }
}
const ID = '3f2b8c1e-5d4a-4e7b-9c1f-2a3b4c5d6e7f';
const EU = '11111111-1111-4111-8111-111111111111';
// 08/10/2026 10:00 em Brasília
const AGORA = new Date('2026-10-08T13:00:00Z');
const chamadas = (params: Record<string, string>, opcoes?: { semStatus?: boolean }) =>
  aplicarFiltrosDemandas(new Gravador(), lerFiltrosDemandas(params, EU), EU, AGORA, opcoes).chamadas;

describe('aplicarFiltrosDemandas', () => {
  it('padrão: só as três abertas', () => {
    expect(chamadas({})).toEqual(['in status aberto|em_andamento|aguardando_cliente']);
  });
  it('o quadro não filtra status (as colunas já são os status)', () => {
    expect(chamadas({ status: 'concluido' }, { semStatus: true })).toEqual([]);
  });
  it('todos os filtros juntos, como a tabela e o CSV usam', () => {
    expect(chamadas({ setor: ID, status: 'concluido', origem: 'agente', vencidas: '1', prazo: 'hoje', responsavel: 'eu', prioridade: 'alta',
      tipo: 'venda', periodo: 'hoje' })).toEqual([
      `eq setor_id ${ID}`,
      'in status concluido',
      'in origem agente|sistema',
      'is vencida true',
      'gte prazo_em 2026-10-08T03:00:00.000Z',
      'lt prazo_em 2026-10-09T03:00:00.000Z',
      `eq responsavel_id ${EU}`,
      'eq prioridade alta',
      'is tem_pedido true',
      'gte criado_em 2026-10-08T03:00:00.000Z',
    ]);
  });
  it('triagem, da equipe, sem responsável, outras', () => {
    expect(chamadas({ setor: 'triagem', origem: 'equipe', responsavel: 'sem', tipo: 'outras' })).toEqual([
      'is setor_id null', 'in status aberto|em_andamento|aguardando_cliente', 'eq origem equipe', 'is responsavel_id null', 'is tem_pedido false',
    ]);
  });
  it('busca: número exato ou texto no título, na descrição e na empresa; vírgula e parênteses não quebram o filtro', () => {
    expect(chamadas({ q: '#1042' }).at(-1)).toBe('or numero.eq.1042,titulo.ilike.%1042%,resumo.ilike.%1042%,empresa.ilike.%1042%');
    expect(chamadas({ q: 'bom preço, (centro)' }).at(-1)).toBe('or titulo.ilike.%bom preço centro%,resumo.ilike.%bom preço centro%,empresa.ilike.%bom preço centro%');
    expect(chamadas({ q: 'a' })).toEqual(['in status aberto|em_andamento|aguardando_cliente']);
  });
});
```

Crie `apps/painel/src/lib/prazo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { descreverPrazo, doCampoDataHora, horaCurta, paraCampoDataHora, prazoAbsoluto } from './prazo';

// Quinta, 08/10/2026, 10:00 em Brasília.
const AGORA = new Date('2026-10-08T13:00:00Z');
const aberta = (prazo: string | null, pausadoDesde: string | null = null) => descreverPrazo({ prazo, pausadoDesde, concluidaEm: null }, AGORA);

describe('descreverPrazo (imagens 03 e 04)', () => {
  it('hoje com hora, amanhã, depois a data', () => {
    expect(aberta('2026-10-08T21:00:00Z')).toEqual({ texto: 'hoje 18h', tom: 'hoje' });
    expect(aberta('2026-10-09T21:00:00Z')).toEqual({ texto: 'amanhã', tom: 'normal' });
    expect(aberta('2026-10-13T21:00:00Z')).toEqual({ texto: '13/10', tom: 'normal' });
  });
  it('vencida: hora se foi hoje, data se foi antes', () => {
    expect(aberta('2026-10-08T12:30:00Z')).toEqual({ texto: 'venceu 9h30', tom: 'vencido' });
    expect(aberta('2026-10-07T21:00:00Z')).toEqual({ texto: 'venceu 07/10', tom: 'vencido' });
  });
  it('pausada em "Com o cliente" não vence; sem prazo diz isso', () => {
    expect(aberta('2026-10-07T21:00:00Z', '2026-10-06T13:00:00Z')).toEqual({ texto: 'pausado', tom: 'pausado' });
    expect(aberta(null)).toEqual({ texto: 'sem prazo', tom: 'sem' });
  });
  it('concluída: no prazo ou fora do prazo', () => {
    expect(descreverPrazo({ prazo: '2026-10-08T21:00:00Z', pausadoDesde: null, concluidaEm: '2026-10-08T20:00:00Z' }, AGORA)).toEqual({ texto: 'no prazo', tom: 'no-prazo' });
    expect(descreverPrazo({ prazo: '2026-10-08T21:00:00Z', pausadoDesde: null, concluidaEm: '2026-10-09T13:00:00Z' }, AGORA)).toEqual({ texto: 'fora do prazo', tom: 'vencido' });
  });
});

describe('formatos do prazo', () => {
  it('hora curta e prazo absoluto no horário de Brasília', () => {
    expect(horaCurta(new Date('2026-10-08T20:00:00Z'))).toBe('17h');
    expect(horaCurta(new Date('2026-10-08T20:30:00Z'))).toBe('17h30');
    expect(prazoAbsoluto('2026-10-13T21:00:00Z')).toBe('13/10 18h');
  });
  it('campo datetime-local de ida e volta (Brasília, sem horário de verão)', () => {
    expect(paraCampoDataHora('2026-10-13T21:00:00Z')).toBe('2026-10-13T18:00');
    expect(paraCampoDataHora(null)).toBe('');
    expect(doCampoDataHora('2026-10-13T18:00')).toBe('2026-10-13T21:00:00.000Z');
    expect(doCampoDataHora('13/10/2026')).toBeNull();
    expect(doCampoDataHora('')).toBeNull();
  });
});
```

Crie `apps/painel/src/lib/linha-do-tempo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fraseDoEvento } from './linha-do-tempo';

const ev = (tipo: string, texto: string | null = null, usuario: string | null = null) => ({ tipo, texto, usuario, criado_em: '2026-10-01T18:02:00Z' });

describe('fraseDoEvento (imagem 05)', () => {
  it('abertura e prioridade do agente; prazo sugerido pelo Sistema', () => {
    expect(fraseDoEvento(ev('criacao', 'Pediu a guia'), 'agente')).toEqual({ ator: 'Agente', acao: 'abriu', detalhe: null });
    expect(fraseDoEvento(ev('prioridade_alterada', 'urgente'), 'agente')).toEqual({ ator: 'Agente', acao: 'prioridade Urgente', detalhe: null });
    expect(fraseDoEvento(ev('prazo_alterado', '2026-10-01T20:00:00Z'), 'agente')).toEqual({ ator: 'Sistema', acao: 'prazo 01/10 17h', detalhe: null });
  });
  it('ações de pessoas levam o nome; nota interna mostra o texto', () => {
    expect(fraseDoEvento(ev('criacao', null, 'Ana'), 'equipe')).toEqual({ ator: 'Ana', acao: 'abriu', detalhe: null });
    expect(fraseDoEvento(ev('assumido', null, 'Ana'), 'agente').acao).toBe('assumiu');
    expect(fraseDoEvento(ev('status_alterado', 'aguardando_cliente', 'Ana'), 'agente').acao).toBe('status Com o cliente');
    expect(fraseDoEvento(ev('responsavel_alterado', 'Bia', 'Ana'), 'agente').acao).toBe('responsável Bia');
    expect(fraseDoEvento(ev('responsavel_alterado', null, 'Ana'), 'agente').acao).toBe('tirou o responsável');
    expect(fraseDoEvento(ev('transferencia', 'Pessoal', 'Ana'), 'agente').acao).toBe('transferiu para Pessoal');
    expect(fraseDoEvento(ev('editado', 'título, descrição', 'Ana'), 'agente').acao).toBe('editou título, descrição');
    expect(fraseDoEvento(ev('conclusao', null, 'Ana'), 'agente').acao).toBe('concluiu');
    expect(fraseDoEvento(ev('reaberto', null, 'Ana'), 'agente').acao).toBe('reabriu');
    expect(fraseDoEvento(ev('nota_interna', 'Cliente ligou', 'Ana'), 'agente')).toEqual({ ator: 'Ana', acao: 'nota interna', detalhe: 'Cliente ligou' });
    expect(fraseDoEvento(ev('nota_interna', 'Mandou o extrato'), 'agente').ator).toBe('Agente');
  });
});
```

Em `apps/painel/src/components/patterns/status-badge.test.ts`, troque o objeto esperado por:

```ts
      aberto: ['Nova', 'text-info'],
      em_andamento: ['Resolvendo', 'text-brand'],
      aguardando_cliente: ['Com o cliente', 'text-warning'],
      concluido: ['Concluída', 'text-success'],
```

Em `apps/painel/src/lib/mensagem-banco.test.ts`, acrescente:

```ts
  it('mensagens antigas que dizem "chamado" falam "demanda" no painel', () => {
    expect(mensagemDoBanco('sem acesso a este chamado')).toBe('Você não tem acesso a esta demanda.');
  });
```

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib src/components/patterns/status-badge.test.ts`
Esperado: FALHA (funções e arquivos novos não existem; rótulos antigos).

- [ ] **Passo 2: `lib/demandas.ts`**

Antes, confira quem usa os nomes que somem:

```bash
grep -rn "temFiltroAlemDoSetor\|OPCOES_STATUS\|StatusFiltro" apps/painel/src
```

Esperado: só `demandas/page.tsx` (reescrita na Task 7) e o próprio `lib/demandas*`. Troque o conteúdo de `apps/painel/src/lib/demandas.ts` por:

```ts
/**
 * Filtros da tela Gestão das demandas (só leitura da URL). Valem iguais para a tabela, o quadro, os contadores e o CSV do Bling
 * (lib/demandas-consulta.ts os aplica na consulta):
 * - setor: todos | triagem | id do setor (o parâmetro de sempre);
 * - status: lista separada por vírgula (aberto, em_andamento, aguardando_cliente, concluido); sem ele, as três abertas;
 * - origem: agente (WhatsApp) | equipe; vencidas: 1; prazo: hoje (vencem hoje);
 * - responsavel: eu | sem | id; prioridade; tipo: venda | outras; periodo: hoje | 7d | 30d (pela abertura);
 * - q: busca (nº, empresa, título ou descrição); demanda: id aberto no painel lateral; nova: 1 abre a nova demanda.
 */
import { valorParam, type Ordem, type ParamsBusca } from './tabela-url';

export type StatusFiltro = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'concluido';
export type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type OrigemFiltro = 'agente' | 'equipe';
export type TipoFiltro = 'venda' | 'outras';
export type PeriodoFiltro = 'hoje' | '7d' | '30d';
export type Visao = 'tabela' | 'quadro';

export type FiltrosDemandas = {
  setor: string;
  status: StatusFiltro[];
  origem: OrigemFiltro | null;
  vencidas: boolean;
  prazoHoje: boolean;
  /** 'eu', 'sem' ou o id de uma pessoa. */
  responsavel: string | null;
  prioridade: Prioridade | null;
  tipo: TipoFiltro | null;
  periodo: PeriodoFiltro | null;
  q: string | null;
  demanda: string | null;
  nova: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: string | null | undefined): v is string => !!v && UUID.test(v);

/** Botões de status (plural, imagem 03). O status na demanda usa ROTULO_STATUS (singular). */
export const OPCOES_STATUS: { valor: StatusFiltro; rotulo: string }[] = [
  { valor: 'aberto', rotulo: 'Novas' },
  { valor: 'em_andamento', rotulo: 'Resolvendo' },
  { valor: 'aguardando_cliente', rotulo: 'Com o cliente' },
  { valor: 'concluido', rotulo: 'Concluídas' },
];
export const ROTULO_STATUS: Record<StatusFiltro, string> = { aberto: 'Nova', em_andamento: 'Resolvendo', aguardando_cliente: 'Com o cliente', concluido: 'Concluída' };
/** Sem ?status=: Novas, Resolvendo e Com o cliente (imagem 03). */
export const STATUS_PADRAO: StatusFiltro[] = ['aberto', 'em_andamento', 'aguardando_cliente'];
export const OPCOES_ORIGEM: { valor: OrigemFiltro; rotulo: string }[] = [
  { valor: 'agente', rotulo: 'Do agente' },
  { valor: 'equipe', rotulo: 'Da equipe' },
];
export const OPCOES_PRIORIDADE: { valor: Prioridade; rotulo: string }[] = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' },
];
export const ROTULO_PRIORIDADE = Object.fromEntries(OPCOES_PRIORIDADE.map((o) => [o.valor, o.rotulo])) as Record<Prioridade, string>;
export const OPCOES_TIPO: { valor: TipoFiltro; rotulo: string }[] = [
  { valor: 'venda', rotulo: 'Pedido de nota (venda)' },
  { valor: 'outras', rotulo: 'Outras' },
];
export const OPCOES_PERIODO: { valor: PeriodoFiltro; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
];

/** Ordenação (decisão 12): o seletor "Ordenar" mostra estas, cada uma com a direção que faz sentido primeiro. */
export const ORDENS: { coluna: string; rotulo: string; direcao: 'asc' | 'desc' }[] = [
  { coluna: 'atualizacao', rotulo: 'Última atualização', direcao: 'desc' },
  { coluna: 'prazo', rotulo: 'Prazo', direcao: 'asc' },
  { coluna: 'prioridade', rotulo: 'Prioridade', direcao: 'desc' },
  { coluna: 'numero', rotulo: 'Número', direcao: 'desc' },
];
export const ORDEM_PADRAO: Ordem = { coluna: 'atualizacao', direcao: 'desc' };
export const COLUNA_DA_ORDEM: Record<string, string> = { atualizacao: 'atualizado_em', prazo: 'prazo_em', prioridade: 'prioridade', numero: 'numero' };

const MAXIMO_BUSCA = 80;

function daLista<T extends string>(v: string | undefined, opcoes: { valor: T }[]): T | null {
  return opcoes.find((o) => o.valor === v)?.valor ?? null;
}

/** Valores estranhos na URL viram "sem filtro" (nunca vão para a consulta). O próprio id em ?responsavel= vira "eu". */
export function lerFiltrosDemandas(params: ParamsBusca, eu?: string): FiltrosDemandas {
  const setor = valorParam(params, 'setor');
  const bruto = valorParam(params, 'responsavel');
  const responsavel = eu && bruto === eu ? 'eu' : bruto;
  const demanda = valorParam(params, 'demanda');
  const pedidos = (valorParam(params, 'status') ?? '').split(',').map((s) => s.trim());
  const status = OPCOES_STATUS.map((o) => o.valor).filter((v) => pedidos.includes(v));
  const q = (valorParam(params, 'q') ?? '').trim().slice(0, MAXIMO_BUSCA);
  return {
    setor: setor === 'triagem' || ehUuid(setor) ? setor : 'todos',
    status: status.length ? status : [...STATUS_PADRAO],
    origem: daLista(valorParam(params, 'origem'), OPCOES_ORIGEM),
    vencidas: valorParam(params, 'vencidas') === '1',
    prazoHoje: valorParam(params, 'prazo') === 'hoje',
    responsavel: responsavel === 'eu' || responsavel === 'sem' || ehUuid(responsavel) ? responsavel : null,
    prioridade: daLista(valorParam(params, 'prioridade'), OPCOES_PRIORIDADE),
    tipo: daLista(valorParam(params, 'tipo'), OPCOES_TIPO),
    periodo: daLista(valorParam(params, 'periodo'), OPCOES_PERIODO),
    q: q || null,
    demanda: ehUuid(demanda) ? demanda : null,
    nova: valorParam(params, 'nova') === '1',
  };
}

export function ehStatusPadrao(s: StatusFiltro[]): boolean {
  return s.length === STATUS_PADRAO.length && STATUS_PADRAO.every((x) => s.includes(x));
}

/** ?status= depois de clicar num botão de status. null tira o parâmetro (volta ao padrão, também quando fica vazio). */
export function statusAoAlternar(atual: StatusFiltro[], s: StatusFiltro): string | null {
  const novo = atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s];
  const ordenado = OPCOES_STATUS.map((o) => o.valor).filter((v) => novo.includes(v));
  if (ordenado.length === 0 || ehStatusPadrao(ordenado)) return null;
  return ordenado.join(',');
}

/** Algum filtro além do padrão? (O estado vazio oferece "Limpar filtros".) */
export function temFiltro(f: FiltrosDemandas): boolean {
  return f.setor !== 'todos' || !ehStatusPadrao(f.status)
    || Boolean(f.origem || f.vencidas || f.prazoHoje || f.responsavel || f.prioridade || f.tipo || f.periodo || f.q);
}

/** Etiquetas removíveis dos filtros avançados (imagem 03: "Setor: Fiscal ×"). `param` é o que o × tira da URL. */
export function etiquetasFiltros(
  f: FiltrosDemandas,
  nomes: { setores: { id: string; nome: string }[]; pessoas: { id: string; nome: string; ativo: boolean }[] },
): { param: string; rotulo: string }[] {
  const e: { param: string; rotulo: string }[] = [];
  if (f.setor !== 'todos') {
    e.push({ param: 'setor', rotulo: `Setor: ${f.setor === 'triagem' ? 'Triagem' : nomes.setores.find((s) => s.id === f.setor)?.nome ?? 'escolhido'}` });
  }
  if (f.responsavel) {
    const p = nomes.pessoas.find((x) => x.id === f.responsavel);
    const nome = f.responsavel === 'eu' ? 'eu' : f.responsavel === 'sem' ? 'ninguém' : p ? (p.ativo ? p.nome : `${p.nome} (arquivado)`) : 'escolhido';
    e.push({ param: 'responsavel', rotulo: `Responsável: ${nome}` });
  }
  if (f.prioridade) e.push({ param: 'prioridade', rotulo: `Prioridade: ${ROTULO_PRIORIDADE[f.prioridade]}` });
  if (f.tipo) e.push({ param: 'tipo', rotulo: `Tipo: ${OPCOES_TIPO.find((o) => o.valor === f.tipo)!.rotulo}` });
  if (f.periodo) e.push({ param: 'periodo', rotulo: `Aberta: ${OPCOES_PERIODO.find((o) => o.valor === f.periodo)!.rotulo}` });
  if (f.prazoHoje) e.push({ param: 'prazo', rotulo: 'Prazo: vence hoje' });
  return e;
}

/** Iniciais do avatar do cartão (imagem 04: "AN"). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toLocaleUpperCase('pt-BR');
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toLocaleUpperCase('pt-BR');
}

/** Início do dia (00:00) no horário de Brasília, como o trabalhador calcula (Brasil sem horário de verão). */
export function inicioDoDiaSP(agora: Date): Date {
  const data = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  return new Date(`${data}T00:00:00-03:00`);
}

/** Desde quando vale o período: hoje = desde 00:00 de Brasília; 7d/30d = as últimas 7×24 h / 30×24 h. */
export function inicioDoPeriodo(periodo: PeriodoFiltro | null, agora: Date): string | null {
  if (!periodo) return null;
  if (periodo === 'hoje') return inicioDoDiaSP(agora).toISOString();
  const dias = periodo === '7d' ? 7 : 30;
  return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Pessoas do filtro Responsável. Arquivada sai da seleção (spec 5.1), exceto a que já está no filtro da URL
 * (senão o Select pareceria "Qualquer um"); essa aparece como "(arquivado)", o nome do estado no painel.
 */
export function opcoesResponsavel(pessoas: { id: string; nome: string; ativo: boolean }[], euId: string, filtro: string | null) {
  return pessoas.filter((p) => p.id !== euId && (p.ativo || p.id === filtro))
    .map((p) => ({ valor: p.id, rotulo: p.ativo ? p.nome : `${p.nome} (arquivado)` }));
}
```

- [ ] **Passo 3: `lib/demandas-consulta.ts`**

```ts
// Os filtros da URL aplicados numa consulta à visão demandas_lista. Um lugar só para a tabela, os contadores,
// o quadro e o CSV do Bling: o arquivo leva exatamente o que a tela mostra (pendência 10 do redesign).
import { interpretarBusca } from './busca';
import { inicioDoDiaSP, inicioDoPeriodo, type FiltrosDemandas } from './demandas';

/** O que os filtros usam do construtor de consultas do PostgREST. */
export type ConsultaFiltravel<Q> = {
  is(coluna: string, valor: boolean | null): Q;
  eq(coluna: string, valor: string): Q;
  in(coluna: string, valores: readonly string[]): Q;
  gte(coluna: string, valor: string): Q;
  lt(coluna: string, valor: string): Q;
  or(filtros: string): Q;
};

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** `semStatus`: o quadro mostra todos os status em colunas, então os botões de status não entram. */
export function aplicarFiltrosDemandas<Q extends ConsultaFiltravel<Q>>(
  q: Q, f: FiltrosDemandas, euId: string, agora: Date, opcoes: { semStatus?: boolean } = {},
): Q {
  let r = q;
  if (f.setor === 'triagem') r = r.is('setor_id', null);
  else if (f.setor !== 'todos') r = r.eq('setor_id', f.setor);
  if (!opcoes.semStatus) r = r.in('status', f.status);
  if (f.origem === 'equipe') r = r.eq('origem', 'equipe');
  else if (f.origem === 'agente') r = r.in('origem', ['agente', 'sistema']);
  if (f.vencidas) r = r.is('vencida', true);
  if (f.prazoHoje) {
    const inicio = inicioDoDiaSP(agora);
    r = r.gte('prazo_em', inicio.toISOString()).lt('prazo_em', new Date(inicio.getTime() + UM_DIA_MS).toISOString());
  }
  if (f.responsavel === 'sem') r = r.is('responsavel_id', null);
  else if (f.responsavel) r = r.eq('responsavel_id', f.responsavel === 'eu' ? euId : f.responsavel);
  if (f.prioridade) r = r.eq('prioridade', f.prioridade);
  if (f.tipo) r = r.is('tem_pedido', f.tipo === 'venda');
  const desde = inicioDoPeriodo(f.periodo, agora);
  if (desde) r = r.gte('criado_em', desde);
  const busca = interpretarBusca(f.q);
  if (busca) {
    const texto = ['titulo', 'resumo', 'empresa'].map((c) => `${c}.ilike.%${busca.termo}%`);
    r = r.or((busca.numero !== null ? [`numero.eq.${busca.numero}`, ...texto] : texto).join(','));
  }
  return r;
}

/** Construtor qualquer do PostgREST com estes métodos (as assinaturas genéricas do supabase-js não casam com o tipo estrutural). */
export interface ConsultaQualquer extends ConsultaFiltravel<ConsultaQualquer> {}

/** O mesmo que aplicarFiltrosDemandas, para `sb.from('demandas_lista').select(...)`: devolve o construtor com o tipo dele. */
export function filtrarConsulta<T>(q: T, f: FiltrosDemandas, euId: string, agora: Date, opcoes: { semStatus?: boolean } = {}): T {
  return aplicarFiltrosDemandas(q as unknown as ConsultaQualquer, f, euId, agora, opcoes) as unknown as T;
}
```

- [ ] **Passo 4: `lib/prazo.ts` e `lib/linha-do-tempo.ts`**

Crie `apps/painel/src/lib/prazo.ts`:

```ts
// Prazo das demandas como a equipe lê (imagens 03, 04 e 05), sempre no horário de Brasília.
import { FUSO } from './formatos';

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const DIA_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const diaSP = (d: Date) => DIA.format(d);

export type TomPrazo = 'vencido' | 'hoje' | 'pausado' | 'normal' | 'sem' | 'no-prazo';

/** "17h" ou "17h30". */
export function horaCurta(d: Date): string {
  const [h, m] = HORA.format(d).split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** "13/10 18h": o prazo nos eventos da linha do tempo (fixo, não muda com o dia em que se lê). */
export function prazoAbsoluto(iso: string): string {
  const d = new Date(iso);
  return `${DIA_MES.format(d)} ${horaCurta(d)}`;
}

/** Prazo na tabela e no quadro: hoje 18h, amanhã, 13/10, venceu…, pausado, no prazo. */
export function descreverPrazo(p: { prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null }, agora: Date): { texto: string; tom: TomPrazo } {
  if (p.concluidaEm) {
    if (!p.prazo) return { texto: 'concluída', tom: 'normal' };
    return new Date(p.concluidaEm) <= new Date(p.prazo) ? { texto: 'no prazo', tom: 'no-prazo' } : { texto: 'fora do prazo', tom: 'vencido' };
  }
  if (p.pausadoDesde) return { texto: 'pausado', tom: 'pausado' };
  if (!p.prazo) return { texto: 'sem prazo', tom: 'sem' };
  const prazo = new Date(p.prazo);
  const mesmoDia = diaSP(prazo) === diaSP(agora);
  if (prazo < agora) return { texto: mesmoDia ? `venceu ${horaCurta(prazo)}` : `venceu ${DIA_MES.format(prazo)}`, tom: 'vencido' };
  if (mesmoDia) return { texto: `hoje ${horaCurta(prazo)}`, tom: 'hoje' };
  if (diaSP(prazo) === diaSP(new Date(agora.getTime() + UM_DIA_MS))) return { texto: 'amanhã', tom: 'normal' };
  return { texto: DIA_MES.format(prazo), tom: 'normal' };
}

/** Valor do <input type="datetime-local"> no horário de Brasília. */
export function paraCampoDataHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${diaSP(d)}T${HORA.format(d)}`;
}

/** ISO a partir do campo (Brasília, sem horário de verão desde 2019). null se não for data e hora. */
export function doCampoDataHora(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
```

Crie `apps/painel/src/lib/linha-do-tempo.ts`:

```ts
// Frase de cada evento da demanda (imagem 05: "Agente abriu", "Sistema prazo 01/10 17h").
import { ROTULO_PRIORIDADE, ROTULO_STATUS, type Prioridade, type StatusFiltro } from './demandas';
import { prazoAbsoluto } from './prazo';

/** Evento de chamado_eventos, com o nome de quem fez (usuarios.nome). */
export type EventoDemanda = { tipo: string; texto: string | null; criado_em: string; usuario: string | null };

/** Sem pessoa: a abertura e a prioridade são do agente (ou do sistema); o resto é do Sistema; nota sem pessoa é do agente. */
export function fraseDoEvento(e: EventoDemanda, origem: string): { ator: string; acao: string; detalhe: string | null } {
  const robo = origem === 'equipe' ? 'Equipe' : origem === 'sistema' ? 'Sistema' : 'Agente';
  const ator = (semPessoa: string) => e.usuario ?? semPessoa;
  const so = (semPessoa: string, acao: string) => ({ ator: ator(semPessoa), acao, detalhe: null });
  switch (e.tipo) {
    case 'criacao': return so(robo, 'abriu');
    case 'prioridade_alterada': return so(robo, `prioridade ${ROTULO_PRIORIDADE[e.texto as Prioridade] ?? e.texto ?? ''}`.trim());
    case 'prazo_alterado': return so('Sistema', e.texto ? `prazo ${prazoAbsoluto(e.texto)}` : 'tirou o prazo');
    case 'assumido': return so('Sistema', 'assumiu');
    case 'status_alterado': return so('Sistema', `status ${ROTULO_STATUS[e.texto as StatusFiltro] ?? e.texto ?? ''}`.trim());
    case 'responsavel_alterado': return so('Sistema', e.texto ? `responsável ${e.texto}` : 'tirou o responsável');
    case 'transferencia': return so('Sistema', `transferiu para ${e.texto ?? 'Triagem'}`);
    case 'editado': return so('Sistema', `editou ${e.texto ?? ''}`.trim());
    case 'conclusao': return so('Sistema', 'concluiu');
    case 'reaberto': return so('Sistema', 'reabriu');
    case 'nota_interna': return { ator: ator('Agente'), acao: 'nota interna', detalhe: e.texto };
    default: return { ator: ator('Sistema'), acao: e.tipo, detalhe: e.texto };
  }
}
```

- [ ] **Passo 5: componentes**

Em `apps/painel/src/components/patterns/status-badge.tsx`, troque o `STATUS_DEMANDA` por (spec 6.6: só o rótulo muda):

```ts
export const STATUS_DEMANDA: Record<StatusDemanda, Aparencia> = {
  aberto: { rotulo: 'Nova', Icone: CircleDot, variant: 'info', cor: 'text-info' },
  em_andamento: { rotulo: 'Resolvendo', Icone: CircleDashed, variant: 'brand', cor: 'text-brand' },
  aguardando_cliente: { rotulo: 'Com o cliente', Icone: Clock, variant: 'warning', cor: 'text-warning' },
  concluido: { rotulo: 'Concluída', Icone: CircleCheck, variant: 'success', cor: 'text-success' },
};
```

Antes, rode `grep -rn "'Aberta'\|\"Aberta\"\|Em andamento\|Aguardando cliente" apps/painel/e2e apps/painel/src`. Ajuste qualquer e2e que procure os rótulos antigos de status (o botão "Aguardando cliente" do Atendimento muda na Task 12; o `/_design` muda na Task 13).

Troque `apps/painel/src/components/patterns/linha-do-tempo-demanda.tsx` por:

```tsx
import { cn } from '@/lib/cn';
import { formatarDataHora } from '@/lib/formatos';
import { fraseDoEvento, type EventoDemanda } from '@/lib/linha-do-tempo';

export type { EventoDemanda };

/** Linha do tempo de uma demanda (painel lateral de Demandas e painel da conversa): quem fez, o que fez e quando. */
export function LinhaDoTempoDemanda({ numero, eventos, origem = 'agente', className }: {
  numero: number; eventos: EventoDemanda[]; origem?: string; className?: string;
}) {
  if (eventos.length === 0) return null;
  return (
    <ol aria-label={`Linha do tempo da demanda #${numero}`} className={cn('ml-1 flex flex-col gap-2 border-l-2 border-border pl-3', className)}>
      {eventos.map((e, i) => {
        const f = fraseDoEvento(e, origem);
        return (
          <li key={i} className="text-sm">
            <p className="text-muted">
              <span className="font-semibold text-foreground">{f.ator}</span> {f.acao} · <time dateTime={e.criado_em} className="tabular">{formatarDataHora(e.criado_em)}</time>
            </p>
            {f.detalhe && <p className="whitespace-pre-wrap text-foreground">{f.detalhe}</p>}
          </li>
        );
      })}
    </ol>
  );
}
```

O evento "abriu" deixa de repetir a descrição (ela aparece na seção Descrição do painel). Confira se algum e2e do Atendimento procurava o resumo pela linha do tempo: `grep -rn "Demanda aberta" apps/painel/e2e apps/painel/src`. Se houver, troque a busca para o texto novo ("abriu") e diga no commit.

Crie `apps/painel/src/components/patterns/prioridade-prazo.tsx`:

```tsx
import { cn } from '@/lib/cn';
import { ROTULO_PRIORIDADE, type Prioridade } from '@/lib/demandas';
import { descreverPrazo, type TomPrazo } from '@/lib/prazo';

const COR_PRIORIDADE: Record<Prioridade, string> = {
  urgente: 'font-bold text-danger',
  alta: 'font-bold text-warning',
  normal: 'text-foreground',
  baixa: 'text-muted',
};

/** Prioridade sempre escrita (spec 8: vermelho nunca sozinho). `caixaAlta`: o cartão do quadro (imagem 04). */
export function PrioridadeTexto({ prioridade, caixaAlta = false, className }: { prioridade: Prioridade; caixaAlta?: boolean; className?: string }) {
  return (
    <span className={cn(COR_PRIORIDADE[prioridade], caixaAlta && 'text-xs font-bold uppercase tracking-wide', className)}>
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

const COR_PRAZO: Record<TomPrazo, string> = {
  vencido: 'font-bold text-danger',
  hoje: 'font-bold text-warning',
  pausado: 'text-muted',
  normal: 'text-foreground',
  sem: 'text-subtle',
  'no-prazo': 'font-semibold text-success',
};

/** Prazo em texto (hoje 18h, amanhã, 13/10, venceu…, pausado). `agora` vem do servidor, para a página e o texto baterem. */
export function PrazoTexto({ prazo, pausadoDesde, concluidaEm, agora, className }: {
  prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null; agora: Date; className?: string;
}) {
  const d = descreverPrazo({ prazo, pausadoDesde, concluidaEm }, agora);
  return <span className={cn('tabular', COR_PRAZO[d.tom], className)}>{d.tom === 'no-prazo' ? `✓ ${d.texto}` : d.texto}</span>;
}
```

Em `apps/painel/src/lib/mensagem-banco.ts`, acrescente ao `TROCAS`:

```ts
  // Funções antigas do banco (Atendimento) ainda dizem "chamado"; na tela é "demanda" (spec 3.1).
  'sem acesso a este chamado': 'Você não tem acesso a esta demanda.',
```

- [ ] **Passo 6: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
```

Esperado: os vitest passam. O typecheck **pode falhar só** em `app/(painel)/demandas/page.tsx` (usa `temFiltroAlemDoSetor` e o `status` antigo), que a Task 7 reescreve. Para este commit compilar, troque nessa página, provisoriamente:
- o import `temFiltroAlemDoSetor` por `temFiltro`, e `temFiltroAlemDoSetor(f)` por `temFiltro(f)`;
- `r = f.status ? r.eq('status', f.status) : r.neq('status', 'concluido');` por `r = r.in('status', f.status);` (acrescente `in(coluna: string, valores: readonly string[]): Q;` ao tipo `Filtravel`);
- `f.status === 'concluido'` por `f.status.includes('concluido')`;
- o filtro `{ param: 'status', ... }` do `FilterBar` sai (os botões de status chegam na Task 7).

Rode de novo `pnpm --filter @escritorio/painel typecheck`. Esperado: passa.

- [ ] **Passo 7: commit**

```bash
git add apps/painel/src/lib/demandas.ts apps/painel/src/lib/demandas.test.ts apps/painel/src/lib/demandas-consulta.ts apps/painel/src/lib/demandas-consulta.test.ts \
  apps/painel/src/lib/prazo.ts apps/painel/src/lib/prazo.test.ts apps/painel/src/lib/linha-do-tempo.ts apps/painel/src/lib/linha-do-tempo.test.ts \
  apps/painel/src/lib/mensagem-banco.ts apps/painel/src/lib/mensagem-banco.test.ts \
  apps/painel/src/components/patterns/status-badge.tsx apps/painel/src/components/patterns/status-badge.test.ts \
  apps/painel/src/components/patterns/linha-do-tempo-demanda.tsx apps/painel/src/components/patterns/prioridade-prazo.tsx \
  "apps/painel/src/app/(painel)/demandas/page.tsx"
git commit -m "$(cat <<'EOF'
feat(demandas): regras da gestão das demandas (filtros, prazo, linha do tempo)

Filtros da URL com status em lista, origem, vencidas, prazo de hoje,
prioridade e busca; um aplicarFiltrosDemandas só para a tabela, o quadro,
os contadores e o CSV. Texto do prazo (hoje 18h, amanhã, pausado, venceu) e
frase de cada evento ("Agente abriu", "Sistema prazo 13/10 18h"). Status
com os nomes novos: Nova, Resolvendo, Com o cliente, Concluída.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Painel. A tabela "Gestão das demandas" (busca, filtros rápidos com contador, filtros avançados, ordenação)

**Arquivos:**
- Modificar (reescrever): `apps/painel/src/app/(painel)/demandas/page.tsx`
- Criar: `apps/painel/src/app/(painel)/demandas/colunas-demandas.tsx`, `barra-demandas.tsx`, `filtros-demandas.tsx`
- Modificar: `apps/painel/src/app/(painel)/demandas/loading.tsx`
- Modificar: `apps/painel/src/components/patterns/data-table.tsx` (prop `faixa`)
- Modificar: `apps/painel/src/components/layout/trilha.ts` (+ `trilha.test.ts`)
- Criar: `apps/painel/e2e/apoio-demandas.ts`
- Modificar: `apps/painel/e2e/demandas.spec.ts`, `e2e/arquivar-usuarios.spec.ts`, `e2e/acessibilidade.spec.ts`

**Interfaces:**
- Consome: `lerFiltrosDemandas`, `statusAoAlternar`, `etiquetasFiltros`, `temFiltro`, `opcoesResponsavel`, `ORDENS`, `ORDEM_PADRAO`, `COLUNA_DA_ORDEM`, `OPCOES_*` (`lib/demandas`); `filtrarConsulta` (`lib/demandas-consulta`); `PrioridadeTexto`, `PrazoTexto` (`prioridade-prazo.tsx`); a visão `demandas_lista` (Task 2).
- Produz:
  - `type LinhaDemanda` e `paraLinhaDemanda(d: LinhaLista, pendencias: string[]): LinhaDemanda`, `colunasDemandas(agora: Date, acoes?: (d: LinhaDemanda) => ReactNode): ColunaTabela<LinhaDemanda>[]` e `COLUNAS_LISTA` (o `select` da visão) em `colunas-demandas.tsx`;
  - `BarraDemandas({ params, f, contagens, setores, pessoas, euId, mostrarStatus, extra? })` em `barra-demandas.tsx` (o `extra` recebe o botão "+ Nova demanda" na Task 11);
  - `BuscaDemandas({ inicial })` e `FiltrarDemandas({ manter, setores, responsaveis, valores })` em `filtros-demandas.tsx`;
  - `DataTable` com `faixa?: (linha: T) => boolean` (faixa vermelha à esquerda);
  - e2e: `apoio-demandas.ts` com `setorId(nome)`, `empresaE2e(razao, cnpj)`, `demandaE2e(d)` e `limparDemandasE2e(prefixo)`.

- [ ] **Passo 1: Playwright (falha)**

Crie `apps/painel/e2e/apoio-demandas.ts`:

```ts
import { db } from './apoio';

export async function setorId(nome: string): Promise<string> {
  const { data } = await db.from('setores').select('id').eq('nome', nome).single();
  return data!.id as string;
}

export async function empresaE2e(razao: string, cnpj: string): Promise<string> {
  await db.from('chamados').delete().in('cliente_id', (await db.from('clientes').select('id').eq('cnpj', cnpj)).data?.map((c) => c.id) ?? []);
  await db.from('clientes').delete().eq('cnpj', cnpj);
  const { data, error } = await db.from('clientes').insert({ razao_social: razao, cnpj }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

/** Demanda de teste, direto no banco (o gatilho calcula o prazo quando prazoEm não vem). */
export async function demandaE2e(d: {
  titulo: string; setor: string; resumo?: string; clienteId?: string; status?: string; prioridade?: string; prazoEm?: string;
  responsavelId?: string; origem?: string; conversaId?: string; pedidoVenda?: unknown; contatoId?: string;
}): Promise<{ id: string; numero: number }> {
  await db.from('chamados').delete().eq('titulo', d.titulo);
  const { data, error } = await db.from('chamados').insert({
    titulo: d.titulo, resumo: d.resumo ?? '', setor_id: await setorId(d.setor), cliente_id: d.clienteId ?? null,
    status: d.status ?? 'aberto', prioridade: d.prioridade ?? 'normal', prazo_em: d.prazoEm ?? null, responsavel_id: d.responsavelId ?? null,
    origem: d.origem ?? 'agente', conversa_id: d.conversaId ?? null, pedido_venda: d.pedidoVenda ?? null, contato_id: d.contatoId ?? null,
  } as never).select('id, numero').single();
  if (error) throw error;
  return { id: data.id as string, numero: Number(data.numero) };
}

export async function limparDemandasE2e(prefixo: string): Promise<void> {
  await db.from('chamados').delete().like('titulo', `${prefixo}%`);
}
```

Troque o conteúdo de `apps/painel/e2e/demandas.spec.ts` por:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, empresaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C7';
const horaAtras = () => new Date(Date.now() - 3600_000).toISOString();

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

test('tabela: duas informações por coluna, botões com contador, vencidas e concluídas', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  const cliente = await empresaE2e('Rede Bom Preço E2E', '90000000000107');
  const urgente = await demandaE2e({ titulo: `${P} Nota de venda`, setor: 'Fiscal', clienteId: cliente, prioridade: 'urgente' });
  await demandaE2e({ titulo: `${P} Admissão`, setor: 'Pessoal', status: 'em_andamento', prioridade: 'alta', origem: 'equipe' });
  await demandaE2e({ titulo: `${P} DAS em atraso`, setor: 'Fiscal', status: 'aguardando_cliente' });
  await demandaE2e({ titulo: `${P} Vencida`, setor: 'Fiscal', status: 'em_andamento', prazoEm: horaAtras() });
  await demandaE2e({ titulo: `${P} Concluída`, setor: 'Fiscal', status: 'concluido' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}`);

  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible();
  const rapidos = page.getByRole('navigation', { name: 'Filtros rápidos' });
  await expect(rapidos.getByRole('link', { name: 'Novas 1' })).toBeVisible();
  await expect(rapidos.getByRole('link', { name: 'Resolvendo 2' })).toBeVisible();
  await expect(rapidos.getByRole('link', { name: 'Com o cliente 1' })).toBeVisible();
  await expect(rapidos.getByRole('link', { name: 'Vencidas 1' })).toBeVisible();

  const linha = page.getByRole('row', { name: new RegExp(`${P} Nota de venda`) });
  for (const t of [`[${urgente.numero}]`, 'Rede Bom Preço E2E', 'Nova', 'Urgente', 'ninguém', 'WhatsApp', 'FISCAL']) await expect(linha).toContainText(t, { ignoreCase: true });
  await expect(page.getByRole('row', { name: new RegExp(`${P} Admissão`) })).toContainText('Equipe');
  await expect(page.getByRole('row', { name: new RegExp(`${P} Vencida`) })).toContainText('venceu');
  await expect(page.getByRole('row', { name: new RegExp(`${P} Concluída`) })).toHaveCount(0);

  await rapidos.getByRole('link', { name: /Vencidas/ }).click();
  await expect(page).toHaveURL(/vencidas=1/);
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(1);
  await rapidos.getByRole('link', { name: /Vencidas/ }).click();

  await rapidos.getByRole('link', { name: 'Concluídas' }).click();
  await expect(page).toHaveURL(/status=aberto%2Cem_andamento%2Caguardando_cliente%2Cconcluido|status=aberto,em_andamento,aguardando_cliente,concluido/);
  await expect(page.getByRole('row', { name: new RegExp(`${P} Concluída`) })).toBeVisible();

  await rapidos.getByRole('link', { name: 'Da equipe' }).click();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(1);
});

test('busca por número e por empresa; filtros avançados viram etiquetas removíveis; ordenar por prazo', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  const cliente = await empresaE2e('Padaria Sol E2E', '90000000000280');
  const a = await demandaE2e({ titulo: `${P} Férias`, setor: 'Pessoal', clienteId: cliente });
  await demandaE2e({ titulo: `${P} Guia ICMS`, setor: 'Fiscal', prazoEm: horaAtras(), status: 'em_andamento' });
  await entrar(page, 'admin@teste.com', SENHA);

  await page.goto('/demandas');
  await page.getByRole('searchbox', { name: 'Buscar demandas' }).fill(String(a.numero));
  await expect(page).toHaveURL(new RegExp(`q=${a.numero}`));
  await expect(page.getByRole('row', { name: new RegExp(`${P} Férias`) })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar demandas' }).fill('Padaria Sol E2E');
  await expect(page.getByRole('row', { name: new RegExp(`${P} Férias`) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${P} Guia ICMS`) })).toHaveCount(0);

  await page.goto(`/demandas?q=${P}`);
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByLabel('Setor').selectOption({ label: 'Pessoal' });
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('link', { name: 'Tirar filtro Setor: Pessoal' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(1);
  await page.getByRole('link', { name: 'Tirar filtro Setor: Pessoal' }).click();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(2);

  await page.getByRole('navigation', { name: 'Ordenar' }).getByRole('link', { name: /Prazo/ }).click();
  await expect(page).toHaveURL(/ordem=prazo&direcao=asc/);
  await expect(page.getByRole('row').nth(1)).toContainText(`${P} Guia ICMS`);
});

test('atendente do Pessoal não vê demanda do Fiscal', async ({ page }) => {
  await demandaE2e({ titulo: `${P} Nota sigilosa`, setor: 'Fiscal', resumo: 'Nota sigilosa do Fiscal' });
  await criarUsuarioTeste({ email: 'caio@teste.com', senha: SENHA, nome: 'Caio', papel: 'atendente', setores: ['Pessoal'] });
  await entrar(page, 'caio@teste.com', SENHA);
  await page.goto('/demandas');
  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible();
  await expect(page.getByText(`${P} Nota sigilosa`)).toHaveCount(0);
  await db.from('chamados').delete().eq('titulo', `${P} Nota sigilosa`);
});
```

Em `apps/painel/e2e/arquivar-usuarios.spec.ts`, no teste "Demandas: pessoa arquivada só aparece no filtro quando já está nele…", troque da linha `await page.goto(\`/demandas?responsavel=${ze}\`);` até o fim do teste por:

```ts
  await page.goto(`/demandas?responsavel=${ze}`);
  await expect(page.getByRole('link', { name: 'Tirar filtro Responsável: Zé Arquivo (arquivado)' })).toBeVisible();
  await expect(page.getByText(/\(inativo\)/)).toHaveCount(0);
  await page.goto('/demandas');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByLabel('Responsável').locator('option', { hasText: 'Zé Arquivo' })).toHaveCount(0);
```

Em `apps/painel/e2e/acessibilidade.spec.ts`, troque `page.getByRole('heading', { name: 'Demandas' })` por `page.getByRole('heading', { name: /Gestão das demandas/ })`.

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/demandas.spec.ts`
Esperado: FALHA (não há "Filtros rápidos" nem o título novo).

- [ ] **Passo 2: a faixa da linha no `DataTable`**

Em `apps/painel/src/components/patterns/data-table.tsx`:
- no tipo `Props<T>`, depois de `linhaAtiva`, acrescente:

```ts
  /** Faixa vermelha à esquerda da linha (Demandas: urgente ou vencida). O motivo também está escrito na linha. */
  faixa?: (linha: T) => boolean;
```

- acrescente `faixa` à desestruturação de `DataTable`;
- dentro do `linhas.map`, logo depois de `const id = ids[i]!;`:

```ts
                const comFaixa = faixa?.(l) ? 'border-l-4 border-l-danger' : undefined;
```

- troque a célula da caixa de seleção e a das colunas por:

```tsx
                    {selecionavel && <TableCell className={cn('w-10', comFaixa)}><CaixaSelecaoLinha id={id} rotulo={rotuloSelecao?.(l) ?? 'Selecionar linha'} /></TableCell>}
                    {colunas.map((c, j) => (
                      <TableCell key={c.id} className={cn(!c.quebrar && 'whitespace-nowrap', c.alinhar === 'direita' && 'text-right', c.className, j === 0 && !selecionavel && comFaixa)}>{c.celula(l)}</TableCell>
                    ))}
```

- [ ] **Passo 3: as colunas (`colunas-demandas.tsx`)**

```tsx
import type { Database } from '@escritorio/db';
import type { ReactNode } from 'react';
import type { ColunaTabela } from '@/components/patterns/data-table';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import { RelativeTime } from '@/components/patterns/relative-time';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { ROTULO_STATUS, type Prioridade } from '@/lib/demandas';
import { formatarDataHora } from '@/lib/formatos';

/** O que a tabela e o quadro leem da visão demandas_lista. */
export const COLUNAS_LISTA = 'id, numero, titulo, status, prioridade, prazo_em, prazo_pausado_desde, concluido_em, criado_em, atualizado_em, origem, '
  + 'criado_por_nome, responsavel_id, responsavel, contato, empresa, setor, conversa_id, fora_do_contrato, tem_pedido, pedido_venda, vencida';

export type LinhaLista = Pick<Database['public']['Views']['demandas_lista']['Row'],
  'id' | 'numero' | 'titulo' | 'status' | 'prioridade' | 'prazo_em' | 'prazo_pausado_desde' | 'concluido_em' | 'criado_em' | 'atualizado_em'
  | 'origem' | 'criado_por_nome' | 'responsavel_id' | 'responsavel' | 'contato' | 'empresa' | 'setor' | 'conversa_id' | 'fora_do_contrato'
  | 'tem_pedido' | 'pedido_venda' | 'vencida'>;

export type LinhaDemanda = {
  id: string; numero: number; titulo: string; status: StatusDemanda; prioridade: Prioridade;
  prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null; criadoEm: string; atualizadoEm: string;
  origem: string; criadoPorNome: string | null; responsavelId: string | null; responsavel: string | null; contato: string | null;
  empresa: string | null; setor: string | null; conversaId: string | null; foraDoContrato: boolean; temPedido: boolean;
  /** Pendências do CSV do Bling (só com a permissão). */
  pendencias: string[];
  vencida: boolean;
};

/** A visão devolve tudo como "pode ser nulo"; a linha da tela tem os tipos de verdade. */
export function paraLinhaDemanda(d: LinhaLista, pendencias: string[]): LinhaDemanda {
  return {
    id: d.id!, numero: Number(d.numero), titulo: d.titulo ?? '', status: d.status as StatusDemanda, prioridade: (d.prioridade ?? 'normal') as Prioridade,
    prazo: d.prazo_em, pausadoDesde: d.prazo_pausado_desde, concluidaEm: d.concluido_em, criadoEm: d.criado_em!, atualizadoEm: d.atualizado_em!,
    origem: d.origem ?? 'agente', criadoPorNome: d.criado_por_nome, responsavelId: d.responsavel_id, responsavel: d.responsavel,
    contato: d.contato, empresa: d.empresa, setor: d.setor, conversaId: d.conversa_id, foraDoContrato: Boolean(d.fora_do_contrato),
    temPedido: Boolean(d.tem_pedido), pendencias, vencida: Boolean(d.vencida),
  };
}

/** "Por": quem abriu (pessoa) ou o robô. */
export function abertaPor(d: Pick<LinhaDemanda, 'criadoPorNome' | 'origem'>): string {
  return d.criadoPorNome ?? (d.origem === 'equipe' ? 'Equipe' : d.origem === 'sistema' ? 'Sistema' : 'Agente');
}

function Cabecalho({ l1, l2 }: { l1: string; l2: string }) {
  return <span className="flex flex-col leading-tight"><span>{l1}</span><span className="font-normal normal-case text-muted">{l2}</span></span>;
}

const segunda = 'block truncate text-sm text-muted';

/** Duas informações por coluna (spec 6.1, imagem 03). `acoes` é a segunda linha da coluna Setor (Assumir, Task 9). */
export function colunasDemandas(agora: Date, acoes?: (d: LinhaDemanda) => ReactNode): ColunaTabela<LinhaDemanda>[] {
  return [
    {
      id: 'assunto', titulo: <Cabecalho l1="Assunto [Nº]" l2="Empresa" />, className: 'w-full min-w-56 max-w-0',
      celula: (d) => (
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-semibold text-foreground">{d.titulo}</span>
            <span className="tabular text-muted">[{d.numero}]</span>
            {d.temPedido && (d.pendencias.length > 0
              ? <Badge variant="warning" title={d.pendencias.join(' · ')}>Pedido de nota incompleto</Badge>
              : <Badge variant="brand">Pedido de nota</Badge>)}
            {d.foraDoContrato && <Badge variant="warning">Fora do contrato</Badge>}
          </span>
          {d.empresa ? <span className="truncate font-semibold text-brand">{d.empresa}</span> : <span className={segunda}>Empresa não identificada</span>}
        </div>
      ),
    },
    {
      id: 'situacao', titulo: <Cabecalho l1="Status · Prioridade · Prazo" l2="Abertura · Por" />,
      celula: (d) => (
        <div className="flex flex-col">
          <span>
            {ROTULO_STATUS[d.status]} · <PrioridadeTexto prioridade={d.prioridade} /> · <PrazoTexto prazo={d.prazo} pausadoDesde={d.pausadoDesde} concluidaEm={d.concluidaEm} agora={agora} />
          </span>
          <span className={segunda}><time dateTime={d.criadoEm} className="tabular">{formatarDataHora(d.criadoEm)}</time> · {abertaPor(d)}</span>
        </div>
      ),
    },
    {
      id: 'pessoas', titulo: <Cabecalho l1="Responsável interno" l2="Contato na empresa" />,
      celula: (d) => (
        <div className="flex flex-col">
          {d.responsavel ? <span>{d.responsavel}</span> : <span className="italic text-subtle">ninguém</span>}
          <span className={segunda}>{d.contato ?? '—'}</span>
        </div>
      ),
    },
    {
      id: 'atualizacao', titulo: <Cabecalho l1="Últ. atualização" l2="Origem" />,
      celula: (d) => (
        <div className="flex flex-col">
          <RelativeTime data={d.atualizadoEm} />
          <span className={segunda}>{d.origem === 'equipe' ? 'Equipe' : 'WhatsApp'}</span>
        </div>
      ),
    },
    {
      id: 'setor', titulo: <Cabecalho l1="Setor" l2="Ações" />,
      celula: (d) => (
        <div className="flex flex-col items-start">
          <span className="text-sm uppercase tracking-wide">{d.setor ?? 'Triagem'}</span>
          {acoes?.(d)}
        </div>
      ),
    },
  ];
}
```

Se o `Pick` da visão reclamar de alguma coluna, regere os tipos (`pnpm db:tipos`, Task 2) antes: a visão precisa estar em `Views`.

- [ ] **Passo 4: busca e "Filtrar" (`filtros-demandas.tsx`, cliente)**

```tsx
'use client';

import { Filter, Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { classeSelect } from '../clientes/estilos';

const ESPERA_MS = 300;

/** Busca sempre visível (spec 6.1): nº, empresa, título ou descrição. Fica na URL (?q=) e volta à página 1. */
export function BuscaDemandas({ inicial }: { inicial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [texto, setTexto] = useState(inicial);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => setTexto(inicial), [inicial]);

  const aplicar = (valor: string) => {
    clearTimeout(espera.current);
    const p = new URLSearchParams(sp.toString());
    if (valor.trim()) p.set('q', valor.trim()); else p.delete('q');
    p.delete('pagina');
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md">
      <Search aria-hidden size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <Input
        type="search"
        aria-label="Buscar demandas"
        placeholder="Nº, empresa ou assunto"
        value={texto}
        className="pl-9"
        onChange={(e) => {
          setTexto(e.target.value);
          clearTimeout(espera.current);
          const valor = e.target.value;
          espera.current = setTimeout(() => aplicar(valor), ESPERA_MS);
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') aplicar(texto); }}
      />
    </div>
  );
}

type Opcao = { valor: string; rotulo: string };

/**
 * "Filtrar" (botão grafite, imagem 03): Setor, Responsável, Prioridade, Tipo e Período numa janelinha.
 * Aplicar troca só esses parâmetros na URL; busca, status, origem, vencidas e ordem continuam (`manter`).
 */
export function FiltrarDemandas({ manter, setores, responsaveis, valores }: {
  manter: [string, string][];
  setores: Opcao[];
  responsaveis: Opcao[];
  valores: { setor: string; responsavel: string; prioridade: string; tipo: string; periodo: string };
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const id = useId();

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const p = new URLSearchParams(manter);
    for (const [k, v] of new FormData(e.currentTarget)) if (typeof v === 'string' && v) p.set(k, v);
    setAberto(false);
    router.push(`/demandas?${p.toString()}`, { scroll: false });
  };

  const campo = (nome: keyof typeof valores, rotulo: string, opcoes: Opcao[]) => (
    <div className="grid gap-1">
      <label htmlFor={`${id}-${nome}`} className="text-xs font-bold uppercase tracking-wide text-brand">{rotulo}</label>
      <select id={`${id}-${nome}`} name={nome} defaultValue={valores[nome]} className={classeSelect}>
        {opcoes.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
      </select>
    </div>
  );

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button variant="grafite"><Filter aria-hidden size={16} strokeWidth={1.75} />Filtrar</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form onSubmit={enviar} className="grid gap-3">
          {campo('setor', 'Setor', [{ valor: '', rotulo: 'Todos' }, ...setores, { valor: 'triagem', rotulo: 'Triagem' }])}
          {campo('responsavel', 'Responsável', [{ valor: '', rotulo: 'Qualquer um' }, { valor: 'eu', rotulo: 'Comigo' }, { valor: 'sem', rotulo: 'Sem responsável' }, ...responsaveis])}
          {campo('prioridade', 'Prioridade', [{ valor: '', rotulo: 'Todas' }, { valor: 'urgente', rotulo: 'Urgente' }, { valor: 'alta', rotulo: 'Alta' }, { valor: 'normal', rotulo: 'Normal' }, { valor: 'baixa', rotulo: 'Baixa' }])}
          {campo('tipo', 'Tipo', [{ valor: '', rotulo: 'Todos' }, { valor: 'venda', rotulo: 'Pedido de nota (venda)' }, { valor: 'outras', rotulo: 'Outras' }])}
          {campo('periodo', 'Aberta', [{ valor: '', rotulo: 'Qualquer data' }, { valor: 'hoje', rotulo: 'Hoje' }, { valor: '7d', rotulo: 'Últimos 7 dias' }, { valor: '30d', rotulo: 'Últimos 30 dias' }])}
          <Button type="submit" size="sm">Aplicar</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Passo 5: a barra (`barra-demandas.tsx`, servidor)**

```tsx
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import {
  OPCOES_ORIGEM, OPCOES_STATUS, ORDENS, etiquetasFiltros, opcoesResponsavel, statusAoAlternar, type FiltrosDemandas, type StatusFiltro,
} from '@/lib/demandas';
import { hrefComParams, type Ordem, type ParamsBusca } from '@/lib/tabela-url';
import { BuscaDemandas, FiltrarDemandas } from './filtros-demandas';

const chip = 'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-base transition-colors duration-150 ease-out';
const ligado = 'border-grafite bg-grafite text-grafite-foreground';
const desligado = 'border-input bg-surface text-foreground hover:bg-surface-muted';
/** Parâmetros que o "Filtrar" troca; os outros ficam como estão. */
const AVANCADOS = ['setor', 'responsavel', 'prioridade', 'tipo', 'periodo', 'prazo'];

export type ContagensDemandas = Partial<Record<StatusFiltro | 'vencidas', number | null>>;

/**
 * Busca, filtros rápidos com contador e filtros avançados (spec 6.1, imagem 03). Tudo é link ou formulário na URL:
 * a página lê os mesmos parâmetros e o CSV do Bling também.
 */
export function BarraDemandas({ params, f, contagens, setores, pessoas, euId, mostrarStatus = true, ordem, extra }: {
  params: ParamsBusca;
  f: FiltrosDemandas;
  contagens: ContagensDemandas;
  setores: { id: string; nome: string }[];
  pessoas: { id: string; nome: string; ativo: boolean }[];
  euId: string;
  /** No quadro as colunas já são os status (decisão 15). */
  mostrarStatus?: boolean;
  /** Na tabela, o seletor de ordem. */
  ordem?: Ordem;
  extra?: ReactNode;
}) {
  const href = (mudancas: Record<string, string | null>) => `/demandas${hrefComParams(params, { ...mudancas, demanda: null })}`;
  const numero = (n: number | null | undefined) => (n === null || n === undefined ? null : <strong className="tabular">{n}</strong>);
  const etiquetas = etiquetasFiltros(f, { setores, pessoas });
  const manter = Object.entries(params)
    .filter(([k]) => !AVANCADOS.includes(k) && k !== 'pagina' && k !== 'demanda')
    .flatMap(([k, v]) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((x) => [k, x] as [string, string])));

  return (
    <div className="mb-3 flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <BuscaDemandas inicial={f.q ?? ''} />
        <nav aria-label="Filtros rápidos" className="flex flex-wrap items-center gap-2">
          {mostrarStatus && OPCOES_STATUS.map((o) => {
            const ativo = f.status.includes(o.valor);
            return (
              <Link key={o.valor} href={href({ status: statusAoAlternar(f.status, o.valor) })} scroll={false}
                aria-current={ativo ? 'true' : undefined} className={cn(chip, ativo ? ligado : desligado)}>
                {o.rotulo}{o.valor !== 'concluido' && numero(contagens[o.valor])}
              </Link>
            );
          })}
          {mostrarStatus && <span aria-hidden className="mx-1 h-6 border-l border-border" />}
          {OPCOES_ORIGEM.map((o) => {
            const ativo = f.origem === o.valor;
            return (
              <Link key={o.valor} href={href({ origem: ativo ? null : o.valor })} scroll={false}
                aria-current={ativo ? 'true' : undefined} className={cn(chip, ativo ? ligado : desligado)}>
                {o.rotulo}
              </Link>
            );
          })}
          <Link href={href({ vencidas: f.vencidas ? null : '1' })} scroll={false} aria-current={f.vencidas ? 'true' : undefined}
            className={cn(chip, f.vencidas ? 'border-danger bg-danger text-danger-foreground' : 'border-danger/40 bg-surface text-danger hover:bg-danger-soft')}>
            Vencidas{numero(contagens.vencidas)}
          </Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-md border border-input bg-surface px-2 py-1">
          {etiquetas.length === 0 && <span className="px-1 text-muted">Sem filtros avançados</span>}
          {etiquetas.map((e) => (
            <Link key={e.param} href={href({ [e.param]: null })} scroll={false} aria-label={`Tirar filtro ${e.rotulo}`}
              className="inline-flex items-center gap-1 rounded-sm bg-brand-soft px-2 py-0.5 text-sm font-semibold text-brand hover:bg-brand-soft/70">
              {e.rotulo}<X aria-hidden size={14} strokeWidth={2} />
            </Link>
          ))}
        </div>
        <FiltrarDemandas
          manter={manter}
          setores={setores.map((s) => ({ valor: s.id, rotulo: s.nome }))}
          responsaveis={opcoesResponsavel(pessoas, euId, f.responsavel)}
          valores={{ setor: f.setor === 'todos' ? '' : f.setor, responsavel: f.responsavel ?? '', prioridade: f.prioridade ?? '', tipo: f.tipo ?? '', periodo: f.periodo ?? '' }}
        />
        {extra}
      </div>

      {ordem && (
        <nav aria-label="Ordenar" className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>Ordenar por:</span>
          {ORDENS.map((o) => {
            const atual = ordem.coluna === o.coluna;
            const direcao = atual ? (ordem.direcao === 'asc' ? 'desc' : 'asc') : o.direcao;
            const Seta = (atual ? ordem.direcao : o.direcao) === 'asc' ? ArrowUp : ArrowDown;
            return (
              <Link key={o.coluna} href={href({ ordem: o.coluna, direcao })} scroll={false} aria-current={atual ? 'true' : undefined}
                className={cn('inline-flex items-center gap-1 hover:text-foreground', atual && 'font-bold text-foreground')}>
                {o.rotulo}{atual && <Seta aria-hidden size={14} strokeWidth={2} />}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
```

O `rounded-md`, `border-danger/40` e `hover:bg-brand-soft/70` usam só tokens; confira com `pnpm --filter @escritorio/painel exec vitest run src/styles` que a escala continua passando.

- [ ] **Passo 6: a página (`page.tsx`)**

Troque o conteúdo de `apps/painel/src/app/(painel)/demandas/page.tsx` por:

```tsx
import type { CompradorCadastrado, PedidoVendaSalvo } from '@escritorio/core';
import { FilterX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BarraSelecao, DataTable } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { variantesBotao } from '@/components/ui/button';
import { COLUNA_DA_ORDEM, ORDEM_PADRAO, ORDENS, lerFiltrosDemandas, temFiltro, type FiltrosDemandas } from '@/lib/demandas';
import { filtrarConsulta } from '@/lib/demandas-consulta';
import { pendenciasCsvBling } from '@/lib/resumo-pedido';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { faixaDaConsulta, hrefComParams, lerOrdem, lerPagina, paginar, PARAM_PAGINA, valorParam, type Paginacao, type ParamsBusca } from '@/lib/tabela-url';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { BarraDemandas } from './barra-demandas';
import { COLUNAS_LISTA, colunasDemandas, paraLinhaDemanda, type LinhaDemanda } from './colunas-demandas';
import { DetalheDemanda, type DemandaAberta } from './detalhe-demanda';
import { ExportarSelecionadas } from './exportar-selecionadas';
import { EsqueletoDemanda, PainelDemanda } from './painel-demanda';

const POR_PAGINA = 50;
const COLUNAS_COMPRADOR = 'id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/**
 * Gestão das demandas (spec 6): tabela com duas informações por coluna, busca, filtros rápidos com contador e filtros
 * avançados, todos na URL (lib/demandas). O RLS limita cada pessoa aos setores dela. ?demanda=<id> abre o painel lateral.
 */
export default async function Demandas({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const params = await searchParams;
  const u = await obterUsuario();
  // CSV do Bling só para quem pode "Corrigir pedidos de nota e gerar CSV do Bling" (o administrador sempre pode).
  const podeCsv = temPermissao(u, 'emitir_notas');
  // O próprio id em ?responsavel= vira "eu" também na URL, para a etiqueta dizer "Responsável: eu".
  if (valorParam(params, 'responsavel') === u.id) redirect(`/demandas${hrefComParams(params, { responsavel: 'eu', [PARAM_PAGINA]: valorParam(params, PARAM_PAGINA) })}`);
  const f = lerFiltrosDemandas(params, u.id);
  const ordem = lerOrdem(params, ORDENS.map((o) => o.coluna), ORDEM_PADRAO)!;
  const agora = new Date();
  const sb = await supabaseServidor();

  const contar = (mudanca: Partial<FiltrosDemandas> = {}) =>
    filtrarConsulta(sb.from('demandas_lista').select('id', { count: 'exact', head: true }), { ...f, ...mudanca }, u.id, agora);

  const [{ data: setores }, { data: pessoas }, total, novas, resolvendo, comCliente, vencidas] = await Promise.all([
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome, ativo').order('nome'),
    contar(),
    contar({ status: ['aberto'] }),
    contar({ status: ['em_andamento'] }),
    contar({ status: ['aguardando_cliente'] }),
    contar({ vencidas: true }),
  ]);

  const totalN = total.count ?? 0;
  let paginacao = paginar(totalN, lerPagina(params), POR_PAGINA);
  const pagina_ = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    return filtrarConsulta(sb.from('demandas_lista').select(COLUNAS_LISTA), f, u.id, agora)
      .order(COLUNA_DA_ORDEM[ordem.coluna]!, { ascending: ordem.direcao === 'asc', nullsFirst: false })
      .order('numero', { ascending: false })
      .range(de, ate);
  };
  let resultado = total.error ? { data: null, error: total.error } : await pagina_(paginacao);
  // A lista encolheu entre a contagem e a página (tempo real): volta para a primeira página em vez de mostrar erro.
  if (resultado.error?.code === 'PGRST103') {
    paginacao = paginar(totalN, 1, POR_PAGINA);
    resultado = await pagina_(paginacao);
  }

  const linhas = await comPendencias(sb, resultado.data ?? [], podeCsv);
  const pagina = paginacao.pagina > 1 ? paginacao.pagina : null;
  const hrefDemanda = (id: string | null) => `/demandas${hrefComParams(params, { demanda: id, [PARAM_PAGINA]: pagina })}`;
  const filtrosAtivos = temFiltro(f);

  return (
    <section>
      <AtualizarAoVivo />
      <PageHeader titulo="Gestão das demandas" contagem={totalN} />
      <BarraDemandas
        params={params}
        f={f}
        contagens={{ aberto: novas.count, em_andamento: resolvendo.count, aguardando_cliente: comCliente.count, vencidas: vencidas.count }}
        setores={setores ?? []}
        pessoas={pessoas ?? []}
        euId={u.id}
        ordem={ordem}
      />
      <DataTable
        rotulo="Demandas"
        linhas={linhas}
        colunas={colunasDemandas(agora)}
        chave={(d) => d.id}
        params={params}
        paginacao={paginacao}
        selecionavel={podeCsv}
        rotuloSelecao={(d) => `Selecionar demanda #${d.numero}`}
        acoesEmMassa={<BarraSelecao><ExportarSelecionadas pedidos={Object.fromEntries(linhas.filter((d) => d.temPedido).map((d) => [d.id, d.pendencias]))} /></BarraSelecao>}
        hrefLinha={(d) => hrefDemanda(d.id)}
        linhaAtiva={f.demanda}
        faixa={(d) => d.prioridade === 'urgente' || d.vencida}
        erro={resultado.error ? 'Não consegui carregar as demandas agora.' : undefined}
        vazio={(
          <EmptyState
            icone={FilterX}
            titulo="Nenhuma demanda neste filtro."
            descricao={filtrosAtivos ? 'Tire um filtro ou limpe todos.' : 'Quando o agente ou a equipe abrir uma demanda, ela aparece aqui.'}
            acao={filtrosAtivos ? <Link href="/demandas" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link> : undefined}
          />
        )}
      />

      {/* Sempre montado: abre na hora com esqueleto ao clicar na linha; o detalhe chega à parte (Suspense). */}
      <PainelDemanda demandaId={f.demanda} hrefFechar={hrefDemanda(null)}>
        {f.demanda && (
          <Suspense key={f.demanda} fallback={<EsqueletoDemanda />}>
            <DetalheCarregado sb={sb} id={f.demanda} podeCsv={podeCsv} />
          </Suspense>
        )}
      </PainelDemanda>
    </section>
  );
}

/** Pendências do CSV de cada pedido desta página (mesma conta da rota, com o comprador cadastrado). */
async function comPendencias(sb: Sb, dados: Parameters<typeof paraLinhaDemanda>[0][], podeCsv: boolean): Promise<LinhaDemanda[]> {
  const unidades = podeCsv
    ? [...new Set(dados.flatMap((d) => { const id = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id; return id ? [id] : []; }))]
    : [];
  const { data: compradores, error } = unidades.length
    ? await sb.from('parceiros_unidades').select(COLUNAS_COMPRADOR).in('id', unidades)
    : { data: [], error: null };
  if (error) console.error('[demandas] falha ao ler os compradores dos pedidos', error);
  const porUnidade = new Map((compradores ?? []).map((c) => [c.id, c as CompradorCadastrado]));
  return dados.map((d) => {
    const unidade = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id;
    // Sem o cadastro do comprador não dá para conferir o pedido: nada de "incompleto" falso (a rota confere de novo).
    const pendencias = !podeCsv || !d.pedido_venda || (unidade && error) ? [] : pendenciasCsvBling(Number(d.numero), d.pedido_venda, unidade ? porUnidade.get(unidade) ?? null : null);
    return paraLinhaDemanda(d, pendencias);
  });
}

async function DetalheCarregado({ sb, id, podeCsv }: { sb: Sb; id: string; podeCsv: boolean }) {
  const aberta = await lerDemanda(sb, id);
  return <DetalheDemanda demanda={aberta?.demanda ?? null} comprador={aberta?.comprador ?? null} podeCsv={podeCsv} />;
}

/** Demanda do painel lateral, com a linha do tempo e o cadastro do comprador (como no CSV do Bling). RLS vale. */
async function lerDemanda(sb: Sb, id: string): Promise<{ demanda: DemandaAberta; comprador: CompradorCadastrado | null } | null> {
  const { data: d } = await sb.from('chamados')
    .select('id, numero, titulo, resumo, status, criado_em, conversa_id, fora_do_contrato, pedido_venda, setores(nome), usuarios(nome), clientes(id, razao_social, nome_fantasia, cnpj), chamado_eventos(tipo, texto, criado_em, usuarios(nome))')
    .eq('id', id).order('criado_em', { referencedTable: 'chamado_eventos' }).maybeSingle();
  if (!d) return null;
  const unidade = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id ?? null;
  const { data: comprador } = unidade
    ? await sb.from('parceiros_unidades').select(COLUNAS_COMPRADOR).eq('id', unidade).maybeSingle()
    : { data: null };
  return {
    demanda: {
      id: d.id, numero: d.numero, titulo: d.titulo, resumo: d.resumo, status: d.status, criado_em: d.criado_em,
      conversa_id: d.conversa_id, fora_do_contrato: d.fora_do_contrato, pedido_venda: d.pedido_venda,
      setor: d.setores?.nome ?? null, responsavel: d.usuarios?.nome ?? null,
      empresa: d.clientes ? { id: d.clientes.id, nome: d.clientes.nome_fantasia ?? d.clientes.razao_social, cnpj: d.clientes.cnpj } : null,
      eventos: d.chamado_eventos.map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null })),
    },
    comprador: (comprador as CompradorCadastrado | null) ?? null,
  };
}
```

O CSV do Bling some do topo da página nesta task e volta no rodapé, já respeitando os filtros, na Task 8 (as duas tasks vão juntas para o dono). O `DetalheDemanda` e `lerDemanda` continuam como estavam até a Task 9.

Troque em `apps/painel/src/app/(painel)/demandas/loading.tsx` a lista de colunas do esqueleto por `['Assunto [Nº]', 'Status · Prioridade · Prazo', 'Responsável interno', 'Últ. atualização', 'Setor']`.

Em `apps/painel/src/components/layout/trilha.ts`, troque a linha de `/demandas` por:

```ts
  { prefixo: '/demandas', trilha: [{ rotulo: 'Gestão das demandas' }] },
```

e, em `trilha.test.ts`, a expectativa de `/demandas` por `[{ rotulo: 'Gestão das demandas' }]` (o item do menu continua "Demandas").

- [ ] **Passo 7: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel exec playwright test e2e/demandas.spec.ts e2e/arquivar-usuarios.spec.ts e2e/acessibilidade.spec.ts
```

Esperado: tudo passa. Se o `acessibilidade.spec.ts` apontar contraste nos botões de filtro, troque só a classe do botão por outra com token (ex.: `text-danger` sobre `bg-surface` já passa AA; `border-danger/40` é só borda).

- [ ] **Passo 8: commit**

```bash
git add "apps/painel/src/app/(painel)/demandas" apps/painel/src/components/patterns/data-table.tsx \
  apps/painel/src/components/layout/trilha.ts apps/painel/src/components/layout/trilha.test.ts \
  apps/painel/e2e/apoio-demandas.ts apps/painel/e2e/demandas.spec.ts apps/painel/e2e/arquivar-usuarios.spec.ts apps/painel/e2e/acessibilidade.spec.ts
git commit -m "$(cat <<'EOF'
feat(demandas): tabela "Gestão das demandas" com busca e filtros com contador

Duas informações por coluna (imagem 03), faixa vermelha em urgente ou
vencida, busca por número, empresa ou texto, botões Novas, Resolvendo, Com o
cliente, Concluídas, Do agente, Da equipe e Vencidas com contador, filtros
avançados como etiquetas removíveis e ordenação por atualização, prazo,
prioridade ou número. Tudo lê a visão demandas_lista. Os e2e que procuravam
o título "Demandas" e o filtro Responsável antigo foram ajustados.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Painel. CSV Bling respeitando todos os filtros, e Imprimir

**Arquivos:**
- Modificar: `apps/painel/src/lib/bling.ts` (`FiltroBling`, `carregarPedidosBling`)
- Modificar: `apps/painel/src/app/api/csv-bling/route.ts`
- Criar: `apps/painel/src/app/(painel)/demandas/rodape-demandas.tsx`, `botao-imprimir.tsx`
- Modificar: `apps/painel/src/app/(painel)/demandas/page.tsx`, `apps/painel/src/components/layout/app-shell.tsx` (só `print:hidden`)
- Criar: `apps/painel/e2e/demandas-csv.spec.ts`
- Modificar: `apps/painel/e2e/revisao-final.spec.ts` (nome do link)

**Interfaces:**
- Consome: `lerFiltrosDemandas`, `filtrarConsulta` (Task 6), `PEDIDOS_POR_ARQUIVO_BLING` (`@escritorio/core`), `BlingExportButton`.
- Produz:
  - `FiltroBling = { id: string } | { ids: string[] } | { filtros: FiltrosDemandas; euId: string; agora: Date }` (o antigo `{ setor }` some; `?setor=` continua funcionando porque é um dos filtros da URL);
  - a rota `/api/csv-bling` aceita os mesmos parâmetros da tela (`q`, `status`, `origem`, `vencidas`, `prazo`, `setor`, `responsavel`, `prioridade`, `tipo`, `periodo`) e `parte`;
  - `RodapeDemandas({ params, partesBling, pedidosVenda })` e `BotaoImprimir()`.

- [ ] **Passo 1: Playwright (falha)**

Crie `apps/painel/e2e/demandas-csv.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C8';
const horaAtras = () => new Date(Date.now() - 3600_000).toISOString();
const pedido = (destinatario: string) => ({
  unidade_id: null, texto_destinatario: destinatario, data: '01/10/2026', data_prevista: null, forma_pagamento: null, valor_frete: null,
  tipo_frete: null, transportadora: null, observacoes: null, entrega: null,
  itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }],
});

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

test('CSV Bling leva só as demandas de venda do filtro da tela (busca, vencidas, responsável)', async ({ page }) => {
  const eu = await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await demandaE2e({ titulo: `${P} venda vencida minha`, setor: 'Fiscal', status: 'em_andamento', prazoEm: horaAtras(), responsavelId: eu, pedidoVenda: pedido('Mercado Alfa E2E') });
  await demandaE2e({ titulo: `${P} venda no prazo`, setor: 'Fiscal', responsavelId: eu, pedidoVenda: pedido('Mercado Beta E2E') });
  await demandaE2e({ titulo: `${P} venda vencida de ninguém`, setor: 'Fiscal', status: 'em_andamento', prazoEm: horaAtras(), pedidoVenda: pedido('Mercado Gama E2E') });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}&vencidas=1&responsavel=eu`);

  const link = page.getByRole('link', { name: 'CSV Bling' });
  const href = (await link.getAttribute('href'))!;
  for (const p of ['vencidas=1', 'responsavel=eu', `q=${P}`]) expect(href).toContain(p);
  const r = await page.request.get(href);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toContain('text/csv');
  const csv = await r.text();
  expect(csv).toContain('Mercado Alfa E2E');
  expect(csv).not.toContain('Mercado Beta E2E');
  expect(csv).not.toContain('Mercado Gama E2E');
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible();
});

test('sem pedido de venda no filtro, o CSV não aparece', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await demandaE2e({ titulo: `${P} venda`, setor: 'Fiscal', pedidoVenda: pedido('Mercado Delta E2E') });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}&tipo=outras`);
  await expect(page.getByRole('link', { name: /CSV Bling/ })).toHaveCount(0);
});
```

Em `apps/painel/e2e/revisao-final.spec.ts`, no teste "com a permissão, a atendente vê o botão e baixa o CSV (F)", troque `page.getByRole('link', { name: 'Exportar CSV Bling' })` por `page.getByRole('link', { name: 'CSV Bling' })`.

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/demandas-csv.spec.ts e2e/revisao-final.spec.ts`
Esperado: FALHA (não há link "CSV Bling" nem "Imprimir").

- [ ] **Passo 2: a rota e o `carregarPedidosBling`**

Em `apps/painel/src/lib/bling.ts`:
- acrescente os imports:

```ts
import type { FiltrosDemandas } from './demandas';
import { filtrarConsulta } from './demandas-consulta';
```

- troque o tipo `FiltroBling`:

```ts
/** Qual conjunto de demandas vira arquivo: uma (botão da demanda), várias (assistente, seleção) ou as do filtro da tela Demandas. */
export type FiltroBling = { id: string } | { ids: string[] } | { filtros: FiltrosDemandas; euId: string; agora: Date };
```

- troque o bloco `else { let consulta = base(); ... linhas = dados(await consulta); }` por:

```ts
  } else if ('id' in filtro) {
    linhas = dados(await base().eq('id', filtro.id));
  } else {
    // Os mesmos filtros da tela (pendência 10 do redesign): o arquivo leva exatamente as demandas de venda que a tabela mostra.
    linhas = dados(await filtrarConsulta(sb.from('demandas_lista').select('numero, pedido_venda').is('tem_pedido', true), filtro.filtros, filtro.euId, filtro.agora)
      .order('numero')) as { numero: number | string; pedido_venda: unknown }[];
  }
```

Em `apps/painel/src/app/api/csv-bling/route.ts`:
- acrescente o import `import { lerFiltrosDemandas } from '@/lib/demandas';`;
- troque a linha `let filtro: FiltroBling = id ? { id } : ids ? { ids } : { setor: q.get('setor') ?? 'todos' };` por:

```ts
  // Exportação da tela: os mesmos parâmetros da URL de /demandas (busca, status, vencidas, responsável…).
  const params = Object.fromEntries([...new Set(q.keys())].map((k) => {
    const v = q.getAll(k);
    return [k, v.length > 1 ? v : v[0]!];
  }));
  let filtro: FiltroBling = id ? { id } : ids ? { ids } : { filtros: lerFiltrosDemandas(params, u.id), euId: u.id, agora: new Date() };
```

- na auditoria, troque `` `exportacao:${q.get('setor') ?? 'todos'}` `` por `` `exportacao:${q.toString()}` ``;
- no comentário da função, troque "?setor=<filtro da tela Demandas>&parte=N exporta as demandas abertas" por "os filtros da tela Demandas (?q=, ?status=, ?vencidas=…)&parte=N exportam as demandas de venda desse filtro".

- [ ] **Passo 3: rodapé com Imprimir e CSV Bling**

Crie `apps/painel/src/app/(painel)/demandas/botao-imprimir.tsx`:

```tsx
'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Imprime a lista como está na tela (o menu, a barra do topo e os filtros somem na impressão). */
export function BotaoImprimir() {
  return (
    <Button type="button" variant="link" onClick={() => window.print()}>
      <Printer aria-hidden size={16} strokeWidth={1.75} />
      Imprimir
    </Button>
  );
}
```

Crie `apps/painel/src/app/(painel)/demandas/rodape-demandas.tsx`:

```tsx
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';
import { BotaoImprimir } from './botao-imprimir';

/** Rodapé da tabela (imagem 03): Imprimir e CSV Bling com todos os filtros da tela (500 pedidos por arquivo). */
export function RodapeDemandas({ params, partesBling, pedidosVenda }: { params: ParamsBusca; partesBling: number; pedidosVenda: number }) {
  // O arquivo segue os filtros; painel aberto, página, ordem e nova demanda não importam para ele.
  const href = (parte: number) =>
    `/api/csv-bling${hrefComParams(params, { demanda: null, pagina: null, nova: null, ordem: null, direcao: null, parte: partesBling > 1 ? parte : null })}`;
  return (
    <div className="mt-2 flex flex-wrap items-center justify-end gap-4 print:hidden">
      <BotaoImprimir />
      {partesBling > 0 && (
        <span className="flex flex-wrap items-center gap-3">
          {Array.from({ length: partesBling }, (_, i) => (
            <BlingExportButton key={i} href={href(i + 1)} variante="link" rotulo={partesBling > 1 ? `CSV Bling (parte ${i + 1})` : 'CSV Bling'} />
          ))}
          <span className="text-sm text-muted">{pedidosVenda === 1 ? '1 pedido de nota neste filtro' : `${pedidosVenda} pedidos de nota neste filtro`}</span>
        </span>
      )}
    </div>
  );
}
```

Em `apps/painel/src/app/(painel)/demandas/page.tsx`:
- acrescente os imports `import { PEDIDOS_POR_ARQUIVO_BLING } from '@escritorio/core';` (junto do import de tipos do core) e `import { RodapeDemandas } from './rodape-demandas';`;
- acrescente ao fim do `Promise.all` o oitavo item e o nome `pedidos` na desestruturação:

```ts
    // Pedidos de venda do mesmo filtro (para o CSV Bling); com "Tipo: Outras" não há nenhum.
    podeCsv && f.tipo !== 'outras' ? contar({ tipo: 'venda' }) : Promise.resolve({ count: 0, error: null }),
```

- depois do `Promise.all`:

```ts
  const pedidosVenda = pedidos.count ?? 0;
  const partesBling = Math.ceil(pedidosVenda / PEDIDOS_POR_ARQUIVO_BLING);
```

- logo depois do `</DataTable>` (antes do `PainelDemanda`):

```tsx
      <RodapeDemandas params={params} partesBling={partesBling} pedidosVenda={pedidosVenda} />
```

Em `apps/painel/src/components/layout/app-shell.tsx`, acrescente `print:hidden` ao `className` do `<aside` do menu lateral (linha ~81) e ao elemento que envolve a `<Topbar` (linha ~105). Nada mais muda na casca.

- [ ] **Passo 4: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel exec playwright test e2e/demandas-csv.spec.ts e2e/revisao-final.spec.ts e2e/demandas.spec.ts
```

Esperado: tudo passa (o `revisao-final` continua recebendo 403 em `/api/csv-bling?setor=todos` sem a permissão).

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/lib/bling.ts apps/painel/src/app/api/csv-bling/route.ts "apps/painel/src/app/(painel)/demandas" \
  apps/painel/src/components/layout/app-shell.tsx apps/painel/e2e/demandas-csv.spec.ts apps/painel/e2e/revisao-final.spec.ts
git commit -m "$(cat <<'EOF'
feat(demandas): CSV Bling com todos os filtros da tela e botão Imprimir

A rota do CSV recebe os mesmos parâmetros da tela e aplica o mesmo
aplicarFiltrosDemandas: o arquivo leva exatamente as demandas de venda do
filtro (pendência 10 do redesign). Rodapé com Imprimir e CSV Bling (imagem
03); na impressão o menu, a barra do topo e os filtros somem. O e2e antigo
procurava "Exportar CSV Bling"; o link agora é "CSV Bling".

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Painel. O painel lateral com todas as ações (e Assumir na linha)

**Arquivos:**
- Criar: `apps/painel/src/app/(painel)/demandas/acoes.ts`, `acoes.test.ts`
- Criar: `apps/painel/src/app/(painel)/demandas/acoes-demanda.tsx` (cliente)
- Modificar (reescrever): `apps/painel/src/app/(painel)/demandas/detalhe-demanda.tsx`
- Modificar: `apps/painel/src/app/(painel)/demandas/page.tsx` (`lerDemanda` pela visão; pessoas com setores; Assumir na linha)
- Criar: `apps/painel/e2e/demandas-painel.spec.ts`

**Interfaces:**
- Consome: as funções do banco da Task 2 (`assumir_demanda`, `definir_responsavel`, `alterar_status_chamado`, `definir_prioridade_prazo`, `reabrir_demanda`, `editar_demanda`) e as de sempre (`nota_interna`, `transferir_chamado`, `concluir_chamado`); `mensagemDoBanco`; `doCampoDataHora`, `paraCampoDataHora`, `PrazoTexto`, `PrioridadeTexto`, `LinhaDoTempoDemanda` (Task 6); `ConfirmDialog` (modo `acao`); `toast`.
- Produz (`acoes.ts`, server actions; todas devolvem `Resultado = { ok: true; mensagem: string } | { ok: false; erro: string }`):
  - `assumirDemanda(id)`, `definirResponsavel(id, responsavel: string | null)`, `alterarStatusDemanda(id, status: 'aberto' | 'em_andamento' | 'aguardando_cliente')`, `definirPrioridade(id, prioridade: Prioridade)`, `definirPrazo(id, campo: string)` (valor do `datetime-local`), `notaInternaDemanda(id, texto)`, `transferirDemanda(id, setor, responsavel: string | null)`, `concluirDemanda(id)`, `reabrirDemanda(id)`, `editarDemanda(id, { titulo, descricao, contato })`.
- Produz (`acoes-demanda.tsx`): `avisar(r: Resultado): boolean`, `BotaoAssumir({ id, cheio? })`, `CamposDemanda({ d, pessoas })`, `BotoesDemanda({ d, setores, pessoas })`, `EditarTitulo({ d })`, `EditarDescricao({ d, contatos })`; `type PessoaSetor = { id: string; nome: string; setores: string[] }`.
- Produz (`detalhe-demanda.tsx`): `type DemandaAberta` novo (abaixo) e `DetalheDemanda({ demanda, comprador, podeCsv, pessoas, setores, contatos, agora })`.

- [ ] **Passo 1: vitest das server actions (falha)**

Crie `apps/painel/src/app/(painel)/demandas/acoes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// As ações do painel lateral só repassam ao banco; aqui: validação antes do banco e mensagem do banco na língua da tela.
const falso = vi.hoisted(() => ({ chamadas: [] as { nome: string; args: unknown }[], erro: null as string | null }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1' }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: unknown) => {
      falso.chamadas.push({ nome, args });
      return { data: null, error: falso.erro ? { message: falso.erro } : null };
    },
  }),
}));

import { alterarStatusDemanda, definirPrazo, definirPrioridade, notaInternaDemanda, transferirDemanda } from './acoes';

const ID = '22222222-2222-4222-8222-222222222222';
beforeEach(() => { falso.chamadas = []; falso.erro = null; });

describe('ações da demanda', () => {
  it('status e prioridade: aviso com o nome da tela', async () => {
    expect(await alterarStatusDemanda(ID, 'aguardando_cliente')).toEqual({ ok: true, mensagem: 'Status: Com o cliente.' });
    expect(await definirPrioridade(ID, 'urgente')).toEqual({ ok: true, mensagem: 'Prioridade Urgente. Prazo recalculado.' });
    expect(falso.chamadas).toEqual([
      { nome: 'alterar_status_chamado', args: { p_chamado: ID, p_status: 'aguardando_cliente' } },
      { nome: 'definir_prioridade_prazo', args: { p_chamado: ID, p_prioridade: 'urgente' } },
    ]);
  });
  it('prazo do campo vira ISO em Brasília; campo vazio não chega ao banco', async () => {
    expect(await definirPrazo(ID, '2026-10-13T18:00')).toEqual({ ok: true, mensagem: 'Prazo alterado.' });
    expect(falso.chamadas[0]).toEqual({ nome: 'definir_prioridade_prazo', args: { p_chamado: ID, p_prazo: '2026-10-13T21:00:00.000Z' } });
    expect(await definirPrazo(ID, '')).toEqual({ ok: false, erro: 'Escolha a data e a hora do prazo.' });
    expect(falso.chamadas).toHaveLength(1);
  });
  it('nota vazia e transferir sem setor param antes do banco', async () => {
    expect(await notaInternaDemanda(ID, '   ')).toEqual({ ok: false, erro: 'Escreva a nota.' });
    expect(await transferirDemanda(ID, '', null)).toEqual({ ok: false, erro: 'Escolha o setor.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('erro do banco volta na língua da tela', async () => {
    falso.erro = 'sem acesso a este chamado';
    expect(await notaInternaDemanda(ID, 'Cliente ligou')).toEqual({ ok: false, erro: 'Você não tem acesso a esta demanda.' });
    falso.erro = 'A demanda já está com Ana.';
    expect(await alterarStatusDemanda(ID, 'em_andamento')).toEqual({ ok: false, erro: 'A demanda já está com Ana.' });
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/demandas/acoes.test.ts"`
Esperado: FALHA (`./acoes` não existe).

- [ ] **Passo 2: Playwright do painel lateral (falha)**

Crie `apps/painel/e2e/demandas-painel.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, empresaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C9';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

// O nome da janela é "Nº <número> · <setor>" (o título editável fica fora dele, para o nome não mudar ao editar).
let numero = 0;
const painel = (page: Page) => page.getByRole('dialog', { name: new RegExp(`Nº ${numero}`) });
const linhaDoTempo = (page: Page) => painel(page).getByRole('list', { name: /Linha do tempo/ });

test('painel lateral: assumir, responsável, status, prioridade, prazo, nota, edição, transferir, concluir e reabrir', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-c9@e2e.local', senha: SENHA, nome: 'Ana C9', papel: 'atendente', setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'bia-c9@e2e.local', senha: SENHA, nome: 'Bia C9', papel: 'atendente', setores: ['Fiscal'] });
  const cliente = await empresaE2e('Rede Bom Preço C9', '90000000000360');
  const { data: carla } = await db.from('contatos').upsert({ nome: 'Carla C9', telefone: '5531999990901' }, { onConflict: 'telefone' }).select('id').single();
  await db.from('contato_clientes').upsert({ contato_id: carla!.id, cliente_id: cliente });
  const d = await demandaE2e({ titulo: `${P} Nota de venda`, setor: 'Fiscal', clienteId: cliente, resumo: 'Pediu a nota' });
  numero = d.numero;
  await entrar(page, 'ana-c9@e2e.local', SENHA);
  await page.goto(`/demandas?demanda=${d.id}`);

  await expect(painel(page)).toContainText(`${P} Nota de venda`);
  await expect(painel(page)).toContainText('aberta pelo agente');
  await painel(page).getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('Demanda assumida.')).toBeVisible();
  await expect(painel(page).getByLabel('Responsável')).toHaveValue(ana);
  await expect(painel(page).getByLabel('Status')).toHaveValue('em_andamento');

  await painel(page).getByLabel('Responsável').selectOption({ label: 'Bia C9' });
  await expect(page.getByText('Responsável alterado.')).toBeVisible();
  await painel(page).getByLabel('Status').selectOption('aguardando_cliente');
  await expect(page.getByText('Status: Com o cliente.')).toBeVisible();
  await expect(painel(page)).toContainText('pausado');
  await painel(page).getByLabel('Prioridade').selectOption('urgente');
  await expect(page.getByText('Prioridade Urgente. Prazo recalculado.')).toBeVisible();
  await painel(page).getByLabel('Prazo').fill('2030-01-15T12:00');
  await painel(page).getByLabel('Prazo').blur();
  await expect(page.getByText('Prazo alterado.')).toBeVisible();

  await painel(page).getByRole('button', { name: 'Nota' }).click();
  await page.getByRole('dialog', { name: /Nota interna/ }).getByLabel('Nota interna').fill('Cliente ligou às 15h');
  await page.getByRole('dialog', { name: /Nota interna/ }).getByRole('button', { name: 'Salvar nota' }).click();
  await expect(page.getByText('Nota interna registrada.')).toBeVisible();

  await painel(page).getByRole('button', { name: 'Editar título' }).click();
  await painel(page).getByLabel('Título').fill(`${P} Nota de venda corrigida`);
  await painel(page).getByRole('button', { name: 'Salvar título' }).click();
  await expect(page.getByText('Demanda alterada.')).toBeVisible();
  await painel(page).getByLabel('Contato na empresa').selectOption({ label: 'Carla C9' });
  await painel(page).getByLabel('Descrição').fill('Pediu a nota de 10 PAC');
  await painel(page).getByRole('button', { name: 'Salvar descrição' }).click();
  await expect(page.getByText('Demanda alterada.').last()).toBeVisible();

  await painel(page).getByRole('button', { name: 'Transferir' }).click();
  const transferir = page.getByRole('dialog', { name: /Transferir a demanda/ });
  await transferir.getByLabel('Setor').selectOption({ label: 'Fiscal' });
  await transferir.getByLabel('Responsável').selectOption({ label: 'Ana C9' });
  await transferir.getByRole('button', { name: 'Transferir' }).click();
  await expect(page.getByText('Demanda transferida.')).toBeVisible();

  await painel(page).getByRole('button', { name: 'Concluir' }).click();
  await page.getByRole('dialog', { name: /Concluir a demanda/ }).getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Demanda concluída.')).toBeVisible();
  await painel(page).getByRole('button', { name: 'Reabrir' }).click();
  await expect(page.getByText('Demanda reaberta.')).toBeVisible();
  await expect(painel(page).getByLabel('Status')).toHaveValue('aberto');

  for (const t of ['Agente abriu', 'Ana C9 assumiu', 'responsável Bia C9', 'status Com o cliente', 'prioridade Urgente', 'prazo 15/01 12h',
    'nota interna', 'editou título', 'editou descrição, contato', 'transferiu para Fiscal', 'concluiu', 'reabriu']) {
    await expect(linhaDoTempo(page)).toContainText(t);
  }
});

test('Assumir na linha da tabela, e a segunda pessoa recebe o aviso', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-c9@e2e.local', senha: SENHA, nome: 'Ana C9', papel: 'atendente', setores: ['Fiscal'] });
  const bia = await criarUsuarioTeste({ email: 'bia-c9@e2e.local', senha: SENHA, nome: 'Bia C9', papel: 'atendente', setores: ['Fiscal'] });
  const d = await demandaE2e({ titulo: `${P} Guia DAS`, setor: 'Fiscal' });
  await entrar(page, 'ana-c9@e2e.local', SENHA);
  await page.goto(`/demandas?q=${P}`);
  // Outra pessoa assume antes (aba aberta há tempo): o clique recebe o aviso e nada muda.
  await db.from('chamados').update({ responsavel_id: bia }).eq('id', d.id);
  await page.getByRole('row', { name: new RegExp(`${P} Guia DAS`) }).getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('A demanda já está com Bia C9.')).toBeVisible();
  await db.from('chamados').update({ responsavel_id: null }).eq('id', d.id);
  await page.reload();
  await page.getByRole('row', { name: new RegExp(`${P} Guia DAS`) }).getByRole('button', { name: 'Assumir' }).click();
  await expect(page.getByText('Demanda assumida.')).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${P} Guia DAS`) })).toContainText('Ana C9');
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/demandas-painel.spec.ts`
Esperado: FALHA (o painel não tem ações).

- [ ] **Passo 3: as server actions (`acoes.ts`)**

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { ROTULO_PRIORIDADE, ROTULO_STATUS, type Prioridade } from '@/lib/demandas';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { doCampoDataHora } from '@/lib/prazo';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Resultado das ações do painel lateral, do quadro e da linha: vira aviso rápido (toast) na tela. */
export type Resultado = { ok: true; mensagem: string } | { ok: false; erro: string };
type StatusAberto = 'aberto' | 'em_andamento' | 'aguardando_cliente';

/** Chama a função do banco (que confere acesso e grava o evento) e devolve a mensagem dele na língua da tela. */
async function acao(nome: string, args: Record<string, unknown>, mensagem: string): Promise<Resultado> {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { error } = await sb.rpc(nome as never, args as never);
  if (error) return { ok: false, erro: mensagemDoBanco(error.message) };
  revalidatePath('/demandas');
  return { ok: true, mensagem };
}

export async function assumirDemanda(id: string): Promise<Resultado> {
  return acao('assumir_demanda', { p_chamado: id }, 'Demanda assumida.');
}

export async function definirResponsavel(id: string, responsavel: string | null): Promise<Resultado> {
  return acao('definir_responsavel', { p_chamado: id, p_responsavel: responsavel }, responsavel ? 'Responsável alterado.' : 'Demanda sem responsável.');
}

export async function alterarStatusDemanda(id: string, status: StatusAberto): Promise<Resultado> {
  return acao('alterar_status_chamado', { p_chamado: id, p_status: status }, `Status: ${ROTULO_STATUS[status]}.`);
}

/** Prioridade nova recalcula o prazo a partir de agora (P4). */
export async function definirPrioridade(id: string, prioridade: Prioridade): Promise<Resultado> {
  return acao('definir_prioridade_prazo', { p_chamado: id, p_prioridade: prioridade }, `Prioridade ${ROTULO_PRIORIDADE[prioridade]}. Prazo recalculado.`);
}

/** `campo`: valor do <input type="datetime-local">, no horário de Brasília. */
export async function definirPrazo(id: string, campo: string): Promise<Resultado> {
  const iso = doCampoDataHora(campo);
  if (!iso) return { ok: false, erro: 'Escolha a data e a hora do prazo.' };
  return acao('definir_prioridade_prazo', { p_chamado: id, p_prazo: iso }, 'Prazo alterado.');
}

export async function notaInternaDemanda(id: string, texto: string): Promise<Resultado> {
  const t = texto.trim();
  if (!t) return { ok: false, erro: 'Escreva a nota.' };
  return acao('nota_interna', { p_chamado: id, p_texto: t }, 'Nota interna registrada.');
}

export async function transferirDemanda(id: string, setor: string, responsavel: string | null): Promise<Resultado> {
  if (!setor) return { ok: false, erro: 'Escolha o setor.' };
  return acao('transferir_chamado', { p_chamado: id, p_setor: setor, p_responsavel: responsavel }, 'Demanda transferida.');
}

export async function concluirDemanda(id: string): Promise<Resultado> {
  return acao('concluir_chamado', { p_chamado: id }, 'Demanda concluída.');
}

export async function reabrirDemanda(id: string): Promise<Resultado> {
  return acao('reabrir_demanda', { p_chamado: id }, 'Demanda reaberta.');
}

export async function editarDemanda(id: string, dados: { titulo: string; descricao: string; contato: string | null }): Promise<Resultado> {
  return acao('editar_demanda', { p_chamado: id, p_titulo: dados.titulo, p_descricao: dados.descricao, p_contato: dados.contato }, 'Demanda alterada.');
}
```

- [ ] **Passo 4: os controles (`acoes-demanda.tsx`, cliente)**

```tsx
'use client';

import { ArrowRightLeft, CircleCheck, NotebookPen, Pencil, RotateCcw, UserRoundCheck } from 'lucide-react';
import { useEffect, useId, useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { OPCOES_PRIORIDADE, ROTULO_STATUS, type Prioridade } from '@/lib/demandas';
import { paraCampoDataHora } from '@/lib/prazo';
import { classeSelect } from '../clientes/estilos';
import {
  alterarStatusDemanda, assumirDemanda, concluirDemanda, definirPrazo, definirPrioridade, definirResponsavel, editarDemanda,
  notaInternaDemanda, reabrirDemanda, transferirDemanda, type Resultado,
} from './acoes';

export type PessoaSetor = { id: string; nome: string; setores: string[] };
type DemandaControles = {
  id: string; numero: number; titulo: string; descricao: string; status: StatusDemanda; prioridade: Prioridade; prazo: string | null;
  setorId: string | null; responsavelId: string | null; contatoId: string | null;
};

const rotulo = 'text-xs font-bold uppercase tracking-wide text-brand';

/** Aviso rápido do resultado (spec 4.5). Devolve se deu certo. */
export function avisar(r: Resultado): boolean {
  if (r.ok) toast.success(r.mensagem); else toast.error(r.erro);
  return r.ok;
}

/** Pessoas ativas do setor da demanda (Triagem: todas), decisão 18. */
const doSetor = (pessoas: PessoaSetor[], setorId: string | null) => pessoas.filter((p) => !setorId || p.setores.includes(setorId));

/** ASSUMIR: no painel ocupa a largura toda (imagem 05); na linha da tabela é um link de texto (imagem 03). */
export function BotaoAssumir({ id, cheio = false }: { id: string; cheio?: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variant={cheio ? 'primary' : 'link'}
      className={cn(cheio && 'w-full', !cheio && 'h-auto font-bold')}
      disabled={pendente}
      onClick={() => iniciar(async () => { avisar(await assumirDemanda(id)); })}
    >
      {cheio && <UserRoundCheck aria-hidden size={16} strokeWidth={1.75} />}
      {pendente ? 'Assumindo…' : 'Assumir'}
    </Button>
  );
}

/** Responsável, Status, Prioridade e Prazo: gravam ao mudar; erro volta o campo ao valor de antes (decisão 17). */
export function CamposDemanda({ d, pessoas }: { d: DemandaControles; pessoas: PessoaSetor[] }) {
  const id = useId();
  const [pendente, iniciar] = useTransition();
  const [valores, setValores] = useState({ responsavel: d.responsavelId ?? '', status: d.status, prioridade: d.prioridade, prazo: paraCampoDataHora(d.prazo) });
  // A página volta do servidor com os valores novos (revalidatePath): o campo acompanha.
  useEffect(() => {
    setValores({ responsavel: d.responsavelId ?? '', status: d.status, prioridade: d.prioridade, prazo: paraCampoDataHora(d.prazo) });
  }, [d.responsavelId, d.status, d.prioridade, d.prazo]);
  const concluida = d.status === 'concluido';
  const opcoesPessoas = doSetor(pessoas, d.setorId);

  const gravar = (campo: keyof typeof valores, valor: string, chamar: () => Promise<Resultado>) => {
    const antes = valores[campo];
    setValores((v) => ({ ...v, [campo]: valor }));
    iniciar(async () => { if (!avisar(await chamar())) setValores((v) => ({ ...v, [campo]: antes })); });
  };

  return (
    <div className="grid grid-cols-2 gap-3" aria-busy={pendente}>
      <div className="grid gap-1">
        <label htmlFor={`${id}-resp`} className={rotulo}>Responsável</label>
        <select id={`${id}-resp`} className={classeSelect} value={valores.responsavel} disabled={concluida}
          onChange={(e) => gravar('responsavel', e.target.value, () => definirResponsavel(d.id, e.target.value || null))}>
          <option value="">Ninguém</option>
          {opcoesPessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-status`} className={rotulo}>Status</label>
        <select id={`${id}-status`} className={classeSelect} value={valores.status} disabled={concluida}
          onChange={(e) => gravar('status', e.target.value, () => alterarStatusDemanda(d.id, e.target.value as 'aberto' | 'em_andamento' | 'aguardando_cliente'))}>
          {(['aberto', 'em_andamento', 'aguardando_cliente'] as const).map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
          {concluida && <option value="concluido">{ROTULO_STATUS.concluido}</option>}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-prio`} className={rotulo}>Prioridade</label>
        <select id={`${id}-prio`} className={cn(classeSelect, valores.prioridade === 'urgente' && 'font-bold text-danger', valores.prioridade === 'alta' && 'font-bold text-warning')}
          value={valores.prioridade} disabled={concluida}
          onChange={(e) => gravar('prioridade', e.target.value, () => definirPrioridade(d.id, e.target.value as Prioridade))}>
          {OPCOES_PRIORIDADE.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-prazo`} className={rotulo}>Prazo</label>
        <Input id={`${id}-prazo`} type="datetime-local" className="tabular" value={valores.prazo} disabled={concluida}
          onChange={(e) => setValores((v) => ({ ...v, prazo: e.target.value }))}
          onBlur={(e) => { if (e.target.value && e.target.value !== paraCampoDataHora(d.prazo)) gravar('prazo', e.target.value, () => definirPrazo(d.id, e.target.value)); }} />
      </div>
    </div>
  );
}

/** Nota, Transferir e Concluir (Reabrir quando concluída), imagem 05. */
export function BotoesDemanda({ d, setores, pessoas }: { d: DemandaControles; setores: { id: string; nome: string }[]; pessoas: PessoaSetor[] }) {
  const [pendente, iniciar] = useTransition();
  if (d.status === 'concluido') {
    return (
      <Button type="button" variant="outline" disabled={pendente} onClick={() => iniciar(async () => { avisar(await reabrirDemanda(d.id)); })}>
        <RotateCcw aria-hidden size={16} strokeWidth={1.75} />{pendente ? 'Reabrindo…' : 'Reabrir'}
      </Button>
    );
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <NotaInterna d={d} />
      <Transferir d={d} setores={setores} pessoas={pessoas} />
      <ConfirmDialog
        gatilho={<Button type="button" variant="outline" className="text-success"><CircleCheck aria-hidden size={16} strokeWidth={1.75} />Concluir</Button>}
        titulo={<>Concluir a demanda <strong>#{d.numero}</strong>?</>}
        descricao={`"${d.titulo}" sai das demandas abertas. Dá para reabrir depois.`}
        confirmar="Concluir"
        enviando="Concluindo…"
        variante="primary"
        tipo="concluir"
        acao={async () => { avisar(await concluirDemanda(d.id)); }}
      />
    </div>
  );
}

function NotaInterna({ d }: { d: DemandaControles }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [pendente, iniciar] = useTransition();
  const id = useId();
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button type="button" variant="outline"><NotebookPen aria-hidden size={16} strokeWidth={1.75} />Nota</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nota interna na demanda #{d.numero}</DialogTitle>
          <DialogDescription>Só a equipe vê. O cliente não recebe.</DialogDescription>
        </DialogHeader>
        <label htmlFor={id} className="sr-only">Nota interna</label>
        <Textarea id={id} rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} />
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" disabled={pendente} onClick={() => iniciar(async () => {
            if (avisar(await notaInternaDemanda(d.id, texto))) { setTexto(''); setAberto(false); }
          })}>{pendente ? 'Salvando…' : 'Salvar nota'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Transferir({ d, setores, pessoas }: { d: DemandaControles; setores: { id: string; nome: string }[]; pessoas: PessoaSetor[] }) {
  const [aberto, setAberto] = useState(false);
  const [setor, setSetor] = useState(d.setorId ?? '');
  const [responsavel, setResponsavel] = useState('');
  const [pendente, iniciar] = useTransition();
  const id = useId();
  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild><Button type="button" variant="outline"><ArrowRightLeft aria-hidden size={16} strokeWidth={1.75} />Transferir</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir a demanda #{d.numero}</DialogTitle>
          <DialogDescription>{d.titulo}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <label htmlFor={`${id}-setor`} className={rotulo}>Setor</label>
            <select id={`${id}-setor`} className={classeSelect} value={setor} onChange={(e) => { setSetor(e.target.value); setResponsavel(''); }}>
              <option value="" disabled>Escolha o setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-resp`} className={rotulo}>Responsável</label>
            <select id={`${id}-resp`} className={classeSelect} value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Fila do setor</option>
              {doSetor(pessoas, setor || null).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" disabled={pendente} onClick={() => iniciar(async () => {
            if (avisar(await transferirDemanda(d.id, setor, responsavel || null))) setAberto(false);
          })}>{pendente ? 'Transferindo…' : 'Transferir'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Título com lápis (imagem 05): abre o campo no lugar; Salvar grava pelo editar_demanda. */
export function EditarTitulo({ d }: { d: DemandaControles }) {
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(d.titulo);
  const [pendente, iniciar] = useTransition();
  const id = useId();
  useEffect(() => setTitulo(d.titulo), [d.titulo]);
  if (!editando) {
    return (
      <div className="flex items-start gap-2">
        <p className="text-2xl font-extrabold text-foreground">{d.titulo}</p>
        <Button type="button" variant="ghost" size="icon" className="size-8 text-muted" aria-label="Editar título" onClick={() => setEditando(true)}>
          <Pencil aria-hidden size={16} strokeWidth={1.75} />
        </Button>
      </div>
    );
  }
  return (
    <form className="flex items-end gap-2" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => { if (avisar(await editarDemanda(d.id, { titulo, descricao: d.descricao, contato: d.contatoId }))) setEditando(false); });
    }}>
      <div className="grid flex-1 gap-1">
        <label htmlFor={id} className={rotulo}>Título</label>
        <Input id={id} value={titulo} maxLength={120} onChange={(e) => setTitulo(e.target.value)} autoFocus />
      </div>
      <Button type="submit" size="sm" disabled={pendente}>{pendente ? 'Salvando…' : 'Salvar título'}</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => { setTitulo(d.titulo); setEditando(false); }}>Cancelar</Button>
    </form>
  );
}

/** Descrição e contato na empresa, com Salvar próprio (decisão 17). */
export function EditarDescricao({ d, contatos }: { d: DemandaControles; contatos: { id: string; nome: string }[] }) {
  const [descricao, setDescricao] = useState(d.descricao);
  const [contato, setContato] = useState(d.contatoId ?? '');
  const [pendente, iniciar] = useTransition();
  const id = useId();
  useEffect(() => { setDescricao(d.descricao); setContato(d.contatoId ?? ''); }, [d.descricao, d.contatoId]);
  const mudou = descricao !== d.descricao || contato !== (d.contatoId ?? '');
  // O contato atual pode ter sido arquivado depois: continua na lista para não sumir da tela (Foco da revisão, item 4).
  const atualForaDaLista = d.contatoId && !contatos.some((c) => c.id === d.contatoId);
  return (
    <form className="grid gap-3" onSubmit={(e) => {
      e.preventDefault();
      iniciar(async () => { avisar(await editarDemanda(d.id, { titulo: d.titulo, descricao, contato: contato || null })); });
    }}>
      <div className="grid gap-1">
        <label htmlFor={`${id}-contato`} className={rotulo}>Contato na empresa</label>
        <select id={`${id}-contato`} className={classeSelect} value={contato} onChange={(e) => setContato(e.target.value)}>
          <option value="">Nenhum</option>
          {atualForaDaLista && <option value={d.contatoId!}>Contato arquivado</option>}
          {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-desc`} className={rotulo}>Descrição</label>
        <Textarea id={`${id}-desc`} rows={4} maxLength={4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline" disabled={!mudou || pendente}>{pendente ? 'Salvando…' : 'Salvar descrição'}</Button>
      </div>
    </form>
  );
}
```

- [ ] **Passo 5: o painel (`detalhe-demanda.tsx`)**

Troque o conteúdo por:

```tsx
import type { CompradorCadastrado } from '@escritorio/core';
import { MessageSquare, SearchX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { LinhaDoTempoDemanda, type EventoDemanda } from '@/components/patterns/linha-do-tempo-demanda';
import { OrderSummary } from '@/components/patterns/order-summary';
import { RelativeTime } from '@/components/patterns/relative-time';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Prioridade } from '@/lib/demandas';
import { pendenciasCsvBling } from '@/lib/resumo-pedido';
import { BotaoAssumir, BotoesDemanda, CamposDemanda, EditarDescricao, EditarTitulo, type PessoaSetor } from './acoes-demanda';
import { abertaPor } from './colunas-demandas';

export type DemandaAberta = {
  id: string; numero: number; titulo: string; descricao: string; status: StatusDemanda; prioridade: Prioridade;
  prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null; criadoEm: string; origem: string; criadoPorNome: string | null;
  conversaId: string | null; foraDoContrato: boolean; pedidoVenda: unknown;
  setorId: string | null; setor: string | null; responsavelId: string | null; contatoId: string | null;
  empresa: { id: string; nome: string; cnpj: string } | null;
  eventos: EventoDemanda[];
};

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <h3 className="text-xs font-bold uppercase tracking-wide text-brand">{titulo}</h3>
      {children}
    </section>
  );
}

/** Painel lateral da demanda (spec 6.3, imagem 05): tudo se resolve aqui, sem sair da tela. */
export function DetalheDemanda({ demanda: d, comprador, podeCsv, pessoas, setores, contatos }: {
  demanda: DemandaAberta | null; comprador: CompradorCadastrado | null; podeCsv: boolean;
  pessoas: PessoaSetor[]; setores: { id: string; nome: string }[]; contatos: { id: string; nome: string }[];
}) {
  if (!d) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Demanda não encontrada</SheetTitle>
          <SheetDescription className="sr-only">A demanda do endereço não existe ou é de outro setor.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <EmptyState icone={SearchX} titulo="Não encontrei esta demanda." descricao="Ela pode ter sido apagada ou ser de um setor que você não atende." />
        </SheetBody>
      </>
    );
  }
  const controles = {
    id: d.id, numero: d.numero, titulo: d.titulo, descricao: d.descricao, status: d.status, prioridade: d.prioridade, prazo: d.prazo,
    setorId: d.setorId, responsavelId: d.responsavelId, contatoId: d.contatoId,
  };
  const quem = abertaPor(d);
  const problemas = pendenciasCsvBling(d.numero, d.pedidoVenda, comprador);
  return (
    <>
      <SheetHeader className="gap-1">
        {/* O nome da janela é o número e o setor (imagem 05): editar o título não muda o nome que o leitor de tela anuncia. */}
        <SheetTitle className="text-sm font-normal uppercase tracking-wide text-muted"><span className="tabular">Nº {d.numero}</span> · {d.setor ?? 'Triagem'}</SheetTitle>
        <EditarTitulo d={controles} />
        <SheetDescription className="text-base">
          {d.empresa ? <Link href={`/clientes/${d.empresa.id}`} className="text-brand underline-offset-4 hover:underline">{d.empresa.nome}</Link> : 'Empresa não identificada'}
          {' · '}aberta {quem === 'Agente' ? 'pelo agente' : `por ${quem}`} <RelativeTime data={d.criadoEm} />
          {d.pedidoVenda ? <Badge variant="brand" className="ml-2">Pedido de nota</Badge> : null}
          {d.foraDoContrato && <Badge variant="warning" className="ml-2">Fora do contrato</Badge>}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <section className="flex flex-col gap-3 border-b border-border py-4">
          {!d.responsavelId && d.status !== 'concluido' && <BotaoAssumir id={d.id} cheio />}
          <CamposDemanda d={controles} pessoas={pessoas} />
          <BotoesDemanda d={controles} setores={setores} pessoas={pessoas} />
        </section>
        <Secao titulo="Descrição">
          <EditarDescricao d={controles} contatos={contatos} />
          {d.empresa?.cnpj && <DocumentText tipo="cnpj" valor={d.empresa.cnpj} className="text-xs text-muted" />}
        </Secao>
        {d.pedidoVenda ? (
          <Secao titulo="Pedido de nota">
            <OrderSummary pedido={d.pedidoVenda} comprador={comprador} />
            {podeCsv && <BlingExportButton href={`/api/csv-bling?id=${d.id}`} problemas={problemas} />}
          </Secao>
        ) : null}
        <Secao titulo="Linha do tempo">
          {d.eventos.length > 0
            ? <LinhaDoTempoDemanda numero={d.numero} eventos={d.eventos} origem={d.origem} />
            : <p className="text-sm text-muted">Nenhum evento registrado.</p>}
        </Secao>
      </SheetBody>
      {d.conversaId && (
        <SheetFooter>
          <Link href={`/atendimento/${d.conversaId}`} className={variantesBotao({ variant: 'link' })}>
            <MessageSquare aria-hidden size={16} strokeWidth={1.75} />
            Abrir conversa
          </Link>
        </SheetFooter>
      )}
    </>
  );
}
```

- [ ] **Passo 6: a página lê pela visão e passa pessoas, setores e contatos**

Em `apps/painel/src/app/(painel)/demandas/page.tsx`:
- troque a consulta de pessoas do `Promise.all` por uma que traga os setores (a mesma serve para o filtro e para os controles):

```ts
    sb.from('usuarios').select('id, nome, ativo, usuario_setores(setor_id)').order('nome'),
```

- logo depois do `Promise.all`:

```ts
  // Arquivada não recebe demanda nova (Parte B): só ativas nos controles.
  const pessoasSetor = (pessoas ?? []).filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, setores: p.usuario_setores.map((s) => s.setor_id) }));
```

- acrescente o import `import { BotaoAssumir } from './acoes-demanda';` e troque `colunas={colunasDemandas(agora)}` por:

```tsx
        colunas={colunasDemandas(agora, (d) => (!d.responsavelId && d.status !== 'concluido' ? <BotaoAssumir id={d.id} /> : null))}
```

- troque o `<DetalheCarregado ... />` por `<DetalheCarregado sb={sb} id={f.demanda} podeCsv={podeCsv} pessoas={pessoasSetor} setores={setores ?? []} />`;
- troque `DetalheCarregado` e `lerDemanda` por:

```tsx
async function DetalheCarregado({ sb, id, podeCsv, pessoas, setores }: {
  sb: Sb; id: string; podeCsv: boolean; pessoas: PessoaSetor[]; setores: { id: string; nome: string }[];
}) {
  const aberta = await lerDemanda(sb, id);
  return (
    <DetalheDemanda demanda={aberta?.demanda ?? null} comprador={aberta?.comprador ?? null} podeCsv={podeCsv}
      pessoas={pessoas} setores={setores} contatos={aberta?.contatos ?? []} />
  );
}

/** Demanda do painel lateral (visão demandas_lista), com a linha do tempo, os contatos da empresa e o comprador. RLS vale. */
async function lerDemanda(sb: Sb, id: string): Promise<{ demanda: DemandaAberta; comprador: CompradorCadastrado | null; contatos: { id: string; nome: string }[] } | null> {
  const { data: d } = await sb.from('demandas_lista').select('*').eq('id', id).maybeSingle();
  if (!d) return null;
  const unidade = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id ?? null;
  const [{ data: eventos }, { data: cliente }, { data: vinculos }, { data: comprador }] = await Promise.all([
    sb.from('chamado_eventos').select('tipo, texto, criado_em, usuarios(nome)').eq('chamado_id', id).order('criado_em'),
    d.cliente_id ? sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('id', d.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    d.cliente_id
      ? sb.from('contato_clientes').select('contatos!inner(id, nome, ativo)').eq('cliente_id', d.cliente_id).eq('contatos.ativo', true)
      : Promise.resolve({ data: [] as { contatos: { id: string; nome: string; ativo: boolean } }[] }),
    unidade ? sb.from('parceiros_unidades').select(COLUNAS_COMPRADOR).eq('id', unidade).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    demanda: {
      id: d.id!, numero: Number(d.numero), titulo: d.titulo ?? '', descricao: d.resumo ?? '', status: d.status as StatusDemanda,
      prioridade: (d.prioridade ?? 'normal') as Prioridade, prazo: d.prazo_em, pausadoDesde: d.prazo_pausado_desde, concluidaEm: d.concluido_em,
      criadoEm: d.criado_em!, origem: d.origem ?? 'agente', criadoPorNome: d.criado_por_nome, conversaId: d.conversa_id,
      foraDoContrato: Boolean(d.fora_do_contrato), pedidoVenda: d.pedido_venda, setorId: d.setor_id, setor: d.setor,
      responsavelId: d.responsavel_id, contatoId: d.contato_id,
      empresa: cliente ? { id: cliente.id, nome: cliente.nome_fantasia ?? cliente.razao_social, cnpj: cliente.cnpj } : null,
      eventos: (eventos ?? []).map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null })),
    },
    comprador: (comprador as CompradorCadastrado | null) ?? null,
    contatos: (vinculos ?? []).map((v) => ({ id: v.contatos.id, nome: v.contatos.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}
```

- ajuste os imports da página: `type PessoaSetor` de `./acoes-demanda`, `type StatusDemanda` de `@/components/patterns/status-badge`, `type Prioridade` de `@/lib/demandas`; `BarraDemandas` continua recebendo `pessoas` (com `id, nome, ativo`).

- [ ] **Passo 7: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel exec playwright test e2e/demandas-painel.spec.ts e2e/demandas.spec.ts e2e/atendimento.spec.ts
```

Esperado: tudo passa. O `atendimento.spec.ts` entra porque a linha do tempo da conversa mudou de formato (Task 6) e `alterar_status_chamado` agora grava evento.

- [ ] **Passo 8: commit**

```bash
git add "apps/painel/src/app/(painel)/demandas" apps/painel/e2e/demandas-painel.spec.ts
git commit -m "$(cat <<'EOF'
feat(demandas): painel lateral com todas as ações e Assumir na linha

Assumir, Responsável, Status, Prioridade e Prazo gravam ao mudar, com aviso
rápido; Nota interna, Transferir, Concluir (com confirmação) e Reabrir;
título e descrição editáveis, contato na empresa; linha do tempo completa
(imagem 05). A demanda vem da visão demandas_lista. Assumir também na linha
da tabela; quem chega depois recebe "A demanda já está com …".

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Painel. O Quadro (arrastar, teclado, confirmação ao concluir) e a escolha Tabela/Quadro

**Arquivos:**
- Criar: `apps/painel/src/app/(painel)/demandas/quadro-demandas.tsx` (cliente), `alternar-visao.tsx` (cliente)
- Modificar: `apps/painel/src/app/(painel)/demandas/acoes.ts` (`definirVisaoDemandas`), `page.tsx`
- Criar: `apps/painel/e2e/demandas-quadro.spec.ts`

**Interfaces:**
- Consome: `alterarStatusDemanda`, `concluirDemanda`, `avisar` (Task 9), `paraLinhaDemanda`, `COLUNAS_LISTA`, `LinhaDemanda` (Task 7), `PrazoTexto`, `PrioridadeTexto`, `iniciais` (Task 6), `definir_visao_demandas` e `usuarios.visao_demandas` (Task 2).
- Produz:
  - `definirVisaoDemandas(visao: Visao): Promise<Resultado>` em `acoes.ts`;
  - `type ColunaQuadro = { status: StatusDemanda; titulo: string; total: number; cartoes: LinhaDemanda[] }` e `QuadroDemandas({ colunas, hrefs, agora })` (`hrefs`: id → endereço do painel lateral; `agora`: ISO do servidor);
  - `AlternarVisao({ atual: Visao })` (botões TABELA / QUADRO com `aria-pressed`).

- [ ] **Passo 1: Playwright (falha)**

Crie `apps/painel/e2e/demandas-quadro.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C10';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

test('quadro: arrastar muda o status, Concluída pede confirmação, teclado move, a escolha fica guardada', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await demandaE2e({ titulo: `${P} Nota de venda`, setor: 'Fiscal', prioridade: 'urgente' });
  await demandaE2e({ titulo: `${P} Admissão`, setor: 'Pessoal', status: 'em_andamento', prioridade: 'alta' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}`);
  await page.getByRole('button', { name: 'Quadro' }).click();
  await expect(page.getByRole('button', { name: 'Quadro' })).toHaveAttribute('aria-pressed', 'true');

  const coluna = (nome: RegExp) => page.getByRole('region', { name: nome });
  const cartao = (titulo: string) => page.getByRole('link', { name: new RegExp(titulo) });
  await expect(coluna(/^Nova/)).toContainText(`${P} Nota de venda`);
  await expect(coluna(/^Nova/)).toContainText('Urgente', { ignoreCase: true });
  await expect(page.getByRole('navigation', { name: 'Filtros rápidos' }).getByRole('link', { name: /^Novas/ })).toHaveCount(0);

  await cartao(`${P} Nota de venda`).dragTo(coluna(/^Resolvendo/));
  await expect(page.getByText('Status: Resolvendo.')).toBeVisible();
  await expect(coluna(/^Resolvendo/)).toContainText(`${P} Nota de venda`);

  await cartao(`${P} Admissão`).dragTo(coluna(/^Concluída/));
  const janela = page.getByRole('dialog', { name: /Concluir a demanda/ });
  await expect(janela).toBeVisible();
  await janela.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Demanda concluída.')).toBeVisible();
  await expect(coluna(/^Concluída/)).toContainText(`${P} Admissão`);

  await cartao(`${P} Nota de venda`).focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByText('Status: Com o cliente.')).toBeVisible();
  await expect(coluna(/^Com o cliente/)).toContainText(`${P} Nota de venda`);
  await expect(coluna(/^Com o cliente/)).toContainText('pausado');

  await page.goto('/demandas');
  await expect(page.getByRole('button', { name: 'Quadro' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Tabela' }).click();
  await expect(page.getByRole('button', { name: 'Tabela' })).toHaveAttribute('aria-pressed', 'true');
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/demandas-quadro.spec.ts`
Esperado: FALHA (não há botão "Quadro").

- [ ] **Passo 2: a ação da preferência**

Em `apps/painel/src/app/(painel)/demandas/acoes.ts`, troque o import de `@/lib/demandas` por `import { ROTULO_PRIORIDADE, ROTULO_STATUS, type Prioridade, type Visao } from '@/lib/demandas';` e acrescente:

```ts
/** Tabela ou Quadro fica no perfil da pessoa (decisão 16). */
export async function definirVisaoDemandas(visao: Visao): Promise<Resultado> {
  return acao('definir_visao_demandas', { p_visao: visao }, visao === 'quadro' ? 'Quadro.' : 'Tabela.');
}
```

- [ ] **Passo 3: `alternar-visao.tsx`**

```tsx
'use client';

import { Columns3, List } from 'lucide-react';
import { useTransition } from 'react';
import { cn } from '@/lib/cn';
import type { Visao } from '@/lib/demandas';
import { definirVisaoDemandas } from './acoes';
import { avisar } from './acoes-demanda';

/** TABELA / QUADRO (imagem 03, canto direito). A escolha fica no perfil: vale em qualquer computador. */
export function AlternarVisao({ atual }: { atual: Visao }) {
  const [pendente, iniciar] = useTransition();
  const escolher = (v: Visao) => {
    if (v === atual) return;
    iniciar(async () => {
      const r = await definirVisaoDemandas(v);
      if (!r.ok) avisar(r);
    });
  };
  return (
    <div role="group" aria-label="Visão das demandas" className="inline-flex overflow-hidden rounded-md border border-input print:hidden">
      {(['tabela', 'quadro'] as const).map((v) => {
        const Icone = v === 'tabela' ? List : Columns3;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={atual === v}
            disabled={pendente}
            onClick={() => escolher(v)}
            className={cn(
              'inline-flex h-9 items-center gap-2 px-3 text-sm font-bold uppercase tracking-wide transition-colors duration-150 ease-out',
              atual === v ? 'bg-grafite text-grafite-foreground' : 'bg-surface text-foreground hover:bg-surface-muted',
            )}
          >
            <Icone aria-hidden size={16} strokeWidth={1.75} />
            {v === 'tabela' ? 'Tabela' : 'Quadro'}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Passo 4: `quadro-demandas.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { useState, useTransition, type KeyboardEvent } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { cn } from '@/lib/cn';
import { iniciais } from '@/lib/demandas';
import { alterarStatusDemanda, concluirDemanda } from './acoes';
import { avisar } from './acoes-demanda';
import type { LinhaDemanda } from './colunas-demandas';

export type ColunaQuadro = { status: StatusDemanda; titulo: string; total: number; cartoes: LinhaDemanda[] };
const ORDEM: StatusDemanda[] = ['aberto', 'em_andamento', 'aguardando_cliente', 'concluido'];

/**
 * Quadro (spec 6.2, imagem 04): arrastar o cartão muda o status; soltar em Concluída pede confirmação.
 * Sem mouse: com o cartão em foco, Shift + → / Shift + ← move para a coluna vizinha (spec 8). Cartão concluído não se move:
 * reabrir é no painel lateral. Clique (ou Enter) no cartão abre o painel lateral.
 */
export function QuadroDemandas({ colunas, hrefs, agora }: { colunas: ColunaQuadro[]; hrefs: Record<string, string>; agora: string }) {
  const [arrastando, setArrastando] = useState<LinhaDemanda | null>(null);
  const [sobre, setSobre] = useState<StatusDemanda | null>(null);
  const [concluir, setConcluir] = useState<LinhaDemanda | null>(null);
  const [anuncio, setAnuncio] = useState('');
  const [, iniciar] = useTransition();
  const data = new Date(agora);
  const nomeDa = (s: StatusDemanda) => colunas.find((c) => c.status === s)?.titulo ?? s;

  const mover = (d: LinhaDemanda, para: StatusDemanda) => {
    if (d.status === para || d.status === 'concluido') return;
    if (para === 'concluido') { setConcluir(d); return; }
    iniciar(async () => {
      if (avisar(await alterarStatusDemanda(d.id, para))) setAnuncio(`Demanda #${d.numero} foi para ${nomeDa(para)}.`);
    });
  };

  const teclado = (e: KeyboardEvent, d: LinhaDemanda) => {
    if (!e.shiftKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    e.preventDefault();
    const i = ORDEM.indexOf(d.status) + (e.key === 'ArrowRight' ? 1 : -1);
    if (i >= 0 && i < ORDEM.length) mover(d, ORDEM[i]!);
  };

  return (
    <>
      <p id="dica-quadro" className="sr-only">Para mover sem o mouse: com o cartão em foco, Shift e seta para a direita ou para a esquerda.</p>
      <p aria-live="polite" className="sr-only">{anuncio}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {colunas.map((c) => (
          <section
            key={c.status}
            aria-labelledby={`coluna-${c.status}`}
            onDragOver={(e) => { if (arrastando && arrastando.status !== c.status) { e.preventDefault(); setSobre(c.status); } }}
            onDragLeave={() => setSobre((s) => (s === c.status ? null : s))}
            onDrop={(e) => { e.preventDefault(); setSobre(null); if (arrastando) mover(arrastando, c.status); setArrastando(null); }}
            className={cn('flex min-h-40 flex-col gap-2 rounded-lg bg-surface-muted p-3', sobre === c.status && 'ring-2 ring-brand')}
          >
            <h2 id={`coluna-${c.status}`} className="flex items-center justify-between text-sm font-bold uppercase tracking-wide text-foreground">
              <span>{c.titulo}</span>
              <span className="tabular">{c.total}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {c.cartoes.map((d) => (
                <li key={d.id}>
                  <Link
                    href={hrefs[d.id]!}
                    scroll={false}
                    draggable={d.status !== 'concluido'}
                    onDragStart={(e) => { setArrastando(d); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', d.id); }}
                    onDragEnd={() => { setArrastando(null); setSobre(null); }}
                    onKeyDown={(e) => teclado(e, d)}
                    aria-describedby={d.status !== 'concluido' ? 'dica-quadro' : undefined}
                    className={cn(
                      'flex flex-col gap-1 rounded-md border border-border bg-surface p-3 text-sm hover:border-brand',
                      (d.prioridade === 'urgente' || d.vencida) && 'border-l-4 border-l-danger',
                      d.prioridade === 'alta' && !d.vencida && 'border-l-4 border-l-warning',
                      d.status === 'concluido' && 'bg-surface-muted',
                    )}
                  >
                    <span className="flex items-center justify-between gap-2 text-muted">
                      <span className="tabular uppercase">{d.numero} · {d.setor ?? 'Triagem'}</span>
                      <PrazoTexto prazo={d.prazo} pausadoDesde={d.pausadoDesde} concluidaEm={d.concluidaEm} agora={data} />
                    </span>
                    <span className="font-bold text-foreground">{d.titulo}</span>
                    <span className="text-muted">{d.empresa ?? 'Empresa não identificada'}</span>
                    <span className="flex items-center justify-between">
                      <PrioridadeTexto prioridade={d.prioridade} caixaAlta />
                      {d.responsavel ? (
                        <span title={d.responsavel} className="flex size-7 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">
                          <span aria-hidden>{iniciais(d.responsavel)}</span>
                          <span className="sr-only">Responsável: {d.responsavel}</span>
                        </span>
                      ) : (
                        <span title="Sem responsável" className="size-7 rounded-full border-2 border-dashed border-subtle">
                          <span className="sr-only">Sem responsável</span>
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {c.total > c.cartoes.length && <p className="text-sm text-muted">e mais {c.total - c.cartoes.length} na tabela</p>}
          </section>
        ))}
      </div>
      <ConfirmDialog
        aberto={concluir !== null}
        aoMudarAberto={(v) => { if (!v) setConcluir(null); }}
        titulo={concluir ? <>Concluir a demanda <strong>#{concluir.numero}</strong>?</> : 'Concluir a demanda?'}
        descricao={concluir ? `"${concluir.titulo}" sai das demandas abertas. Dá para reabrir depois.` : undefined}
        confirmar="Concluir"
        enviando="Concluindo…"
        variante="primary"
        tipo="concluir"
        acao={async () => {
          const d = concluir;
          if (!d) return;
          if (avisar(await concluirDemanda(d.id))) setAnuncio(`Demanda #${d.numero} concluída.`);
          setConcluir(null);
        }}
      />
    </>
  );
}
```

- [ ] **Passo 5: a página escolhe Tabela ou Quadro**

Em `apps/painel/src/app/(painel)/demandas/page.tsx`:
- acrescente os imports `import { AlternarVisao } from './alternar-visao';`, `import { QuadroDemandas, type ColunaQuadro } from './quadro-demandas';`, `type Visao` de `@/lib/demandas` e `type StatusDemanda` de `@/components/patterns/status-badge`;
- acrescente ao `Promise.all` (primeiro item, para a desestruturação ficar `[{ data: perfil }, { data: setores }, ...]`):

```ts
    sb.from('usuarios').select('visao_demandas').eq('id', u.id).maybeSingle(),
```

- depois do `Promise.all`:

```ts
  const visao: Visao = perfil?.visao_demandas === 'quadro' ? 'quadro' : 'tabela';
  const quadro = visao === 'quadro' ? await lerQuadro(sb, f, u.id, agora) : null;
```

- a consulta da página da tabela só roda na tabela: troque `let resultado = total.error ? ... : await pagina_(paginacao);` por:

```ts
  let resultado = quadro || total.error
    ? { data: [] as Parameters<typeof paraLinhaDemanda>[0][], error: quadro ? null : total.error }
    : await pagina_(paginacao);
```

- no JSX, `PageHeader` ganha `acoes={<AlternarVisao atual={visao} />}`; `BarraDemandas` ganha `mostrarStatus={!quadro}` e `ordem={quadro ? undefined : ordem}`; e o `<DataTable … />` e o `<RodapeDemandas … />` que já estão na página passam, sem nenhuma mudança neles, para o lugar marcado abaixo:

```tsx
      {quadro ? (
        <QuadroDemandas
          colunas={quadro}
          hrefs={Object.fromEntries(quadro.flatMap((c) => c.cartoes).map((d) => [d.id, hrefDemanda(d.id)]))}
          agora={agora.toISOString()}
        />
      ) : (
        <>
          {/* aqui: o <DataTable … /> e o <RodapeDemandas … /> de antes, iguais */}
        </>
      )}
```

- acrescente, depois de `comPendencias`:

```tsx
const POR_COLUNA = 50;
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/** As 4 colunas do quadro (spec 6.2): os mesmos filtros e busca da tabela, menos os status; Concluída só dos últimos 7 dias. */
async function lerQuadro(sb: Sb, f: FiltrosDemandas, euId: string, agora: Date): Promise<ColunaQuadro[]> {
  const desde = new Date(agora.getTime() - SETE_DIAS_MS).toISOString();
  const coluna = async (status: StatusDemanda, titulo: string): Promise<ColunaQuadro> => {
    const base = filtrarConsulta(sb.from('demandas_lista').select(COLUNAS_LISTA, { count: 'exact' }).eq('status', status), f, euId, agora, { semStatus: true });
    const { data, count } = status === 'concluido'
      ? await base.gte('concluido_em', desde).order('concluido_em', { ascending: false }).limit(POR_COLUNA)
      : await base.order('prazo_em', { ascending: true, nullsFirst: false }).order('numero', { ascending: false }).limit(POR_COLUNA);
    return { status, titulo, total: count ?? 0, cartoes: (data ?? []).map((d) => paraLinhaDemanda(d, [])) };
  };
  return Promise.all([
    coluna('aberto', 'Nova'), coluna('em_andamento', 'Resolvendo'), coluna('aguardando_cliente', 'Com o cliente'), coluna('concluido', 'Concluída · 7 dias'),
  ]);
}
```

- [ ] **Passo 6: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel exec playwright test e2e/demandas-quadro.spec.ts e2e/demandas.spec.ts
```

Esperado: tudo passa.

- [ ] **Passo 7: commit**

```bash
git add "apps/painel/src/app/(painel)/demandas" apps/painel/e2e/demandas-quadro.spec.ts
git commit -m "$(cat <<'EOF'
feat(demandas): quadro com arrastar, teclado e confirmação ao concluir

Colunas Nova, Resolvendo, Com o cliente e Concluída (7 dias), com os mesmos
filtros e busca da tabela (imagem 04). Arrastar muda o status; soltar em
Concluída abre a confirmação; Shift + seta move o cartão sem mouse, com
anúncio para leitor de tela. Tabela ou Quadro fica no perfil da pessoa.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Painel. Nova demanda com prazo sugerido

**Arquivos:**
- Criar: `apps/painel/src/lib/nova-demanda.ts`, `apps/painel/src/lib/nova-demanda.test.ts`
- Modificar: `apps/painel/src/app/(painel)/demandas/acoes.ts` (`criarDemanda`, `contatosDaEmpresa`)
- Criar: `apps/painel/src/app/(painel)/demandas/nova-demanda.tsx` (cliente)
- Modificar: `apps/painel/src/app/(painel)/demandas/page.tsx` (botão "+ Nova demanda" e o painel `?nova=1`)
- Criar: `apps/painel/e2e/demandas-nova.spec.ts`

**Interfaces:**
- Consome: `criar_demanda` e `calcular_prazo` (Tasks 1 e 2), `EscolherEmpresa` (com `aoMudar`), `PainelLateralUrl`, `paraCampoDataHora`, `doCampoDataHora`, `OPCOES_PRIORIDADE`, `PessoaSetor`, `avisar`.
- Produz:
  - `lib/nova-demanda.ts`: `type CampoNova = 'cliente' | 'setor' | 'titulo' | 'descricao' | 'prazo' | 'responsavel' | 'contato'`, `validarNovaDemanda(d: { cliente: string; setor: string; titulo: string; descricao: string }): { ok: true } | { ok: false; erro: string; campo: CampoNova }`, `campoDoErro(mensagem: string): CampoNova | undefined`;
  - `acoes.ts`: `type NovaDemandaDados = { cliente: string; setor: string; titulo: string; descricao: string; prioridade: Prioridade; prazo: string; responsavel: string; contato: string }` (`prazo` vazio = sugerido pelo banco), `criarDemanda(d): Promise<{ ok: true; mensagem: string; id: string } | { ok: false; erro: string; campo?: CampoNova }>`, `contatosDaEmpresa(clienteId: string): Promise<{ id: string; nome: string }[]>`;
  - `NovaDemanda({ empresas, setores, pessoas, sugeridos })` (`sugeridos: Record<Prioridade, string | null>`, ISO).

- [ ] **Passo 1: testes (falham)**

Crie `apps/painel/src/lib/nova-demanda.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { campoDoErro, validarNovaDemanda } from './nova-demanda';

const base = { cliente: 'c1', setor: 's1', titulo: 'Férias da Joana', descricao: '' };

describe('validarNovaDemanda', () => {
  it('empresa, setor e título de 3 a 120 caracteres', () => {
    expect(validarNovaDemanda(base)).toEqual({ ok: true });
    expect(validarNovaDemanda({ ...base, cliente: '' })).toEqual({ ok: false, erro: 'Escolha a empresa.', campo: 'cliente' });
    expect(validarNovaDemanda({ ...base, setor: '' })).toEqual({ ok: false, erro: 'Escolha o setor.', campo: 'setor' });
    expect(validarNovaDemanda({ ...base, titulo: ' ab ' })).toEqual({ ok: false, erro: 'O título precisa ter de 3 a 120 caracteres.', campo: 'titulo' });
    expect(validarNovaDemanda({ ...base, descricao: 'x'.repeat(4001) })).toEqual({ ok: false, erro: 'A descrição pode ter até 4000 caracteres.', campo: 'descricao' });
  });
});

describe('campoDoErro', () => {
  it('a mensagem do banco aponta o campo certo', () => {
    expect(campoDoErro('Escolha uma pessoa ativa do setor da demanda.')).toBe('responsavel');
    expect(campoDoErro('Escolha um contato desta empresa.')).toBe('contato');
    expect(campoDoErro('Escolha uma empresa ativa.')).toBe('cliente');
    expect(campoDoErro('Escolha um dos seus setores.')).toBe('setor');
    expect(campoDoErro('O prazo precisa ser depois de agora.')).toBe('prazo');
    expect(campoDoErro('Acesso desativado.')).toBeUndefined();
  });
});
```

Crie `apps/painel/e2e/demandas-nova.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { empresaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C11';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

async function abrirNova(page: Page) {
  await criarUsuarioTeste({ email: 'ana-c11@e2e.local', senha: SENHA, nome: 'Ana C11', papel: 'atendente', setores: ['Pessoal'] });
  await criarUsuarioTeste({ email: 'bia-c11@e2e.local', senha: SENHA, nome: 'Bia C11', papel: 'atendente', setores: ['Fiscal'] });
  await empresaE2e('Padaria Sol C11', '90000000000441');
  await entrar(page, 'ana-c11@e2e.local', SENHA);
  await page.goto('/demandas');
  await page.getByRole('link', { name: 'Nova demanda' }).click();
  const janela = page.getByRole('dialog', { name: 'Nova demanda' });
  await janela.getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Padaria Sol C11');
  await page.getByRole('option', { name: /Padaria Sol C11/ }).click();
  await janela.getByLabel('Setor').selectOption({ label: 'Pessoal' });
  await janela.getByLabel('Título').fill(`${P} Férias da Joana`);
  await janela.getByLabel('Descrição').fill('Cliente ligou pedindo cálculo de férias a partir de 20/10');
  return janela;
}

test('nova demanda: prazo sugerido acompanha a prioridade, responsável só do setor, abre no painel', async ({ page }) => {
  const janela = await abrirNova(page);
  await expect(janela.getByLabel('Responsável').locator('option', { hasText: 'Bia C11' })).toHaveCount(0);
  await janela.getByLabel('Responsável').selectOption({ label: 'Ana C11' });
  const prazo = janela.getByLabel('Prazo');
  const normal = await prazo.inputValue();
  await expect(janela.getByText('sugerido')).toBeVisible();
  await janela.locator('label', { hasText: 'Urgente' }).click();
  await expect(prazo).not.toHaveValue(normal);
  await janela.locator('label', { hasText: 'Alta' }).click();
  await janela.getByRole('button', { name: 'Abrir demanda' }).click();

  await expect(page.getByText(/Demanda #\d+ aberta\./)).toBeVisible();
  await expect(page).toHaveURL(/demanda=/);
  const { data } = await db.from('chamados').select('prioridade, prazo_em, origem, criado_em').eq('titulo', `${P} Férias da Joana`).single();
  expect(data).toMatchObject({ prioridade: 'alta', origem: 'equipe' });
  const { data: sugerido } = await db.rpc('calcular_prazo', { p_prioridade: 'alta', p_inicio: data!.criado_em });
  expect(new Date(data!.prazo_em!).getTime()).toBe(new Date(sugerido as string).getTime());
  await expect(page.getByRole('dialog', { name: /Nº/ })).toContainText(`${P} Férias da Joana`);
  await expect(page.getByRole('dialog', { name: /Nº/ })).toContainText('Ana C11 abriu');
});

test('nova demanda: prazo à mão tira o "sugerido"; erro mostra no campo sem perder o que foi digitado', async ({ page }) => {
  const janela = await abrirNova(page);
  await janela.getByLabel('Título').fill('ab');
  await janela.getByRole('button', { name: 'Abrir demanda' }).click();
  await expect(janela.getByText('O título precisa ter de 3 a 120 caracteres.')).toBeVisible();
  await expect(janela.getByLabel('Descrição')).toHaveValue('Cliente ligou pedindo cálculo de férias a partir de 20/10');
  await janela.getByLabel('Título').fill(`${P} Férias da Joana`);
  await janela.getByLabel('Prazo').fill('2030-01-15T12:00');
  await expect(janela.getByText('sugerido')).toHaveCount(0);
  await janela.getByRole('button', { name: 'Abrir demanda' }).click();
  await expect(page.getByText(/Demanda #\d+ aberta\./)).toBeVisible();
  const { data } = await db.from('chamados').select('prazo_em').eq('titulo', `${P} Férias da Joana`).single();
  expect(new Date(data!.prazo_em!).toISOString()).toBe('2030-01-15T15:00:00.000Z');
});
```

Run:
```bash
pnpm --filter @escritorio/painel exec vitest run src/lib/nova-demanda.test.ts
pnpm --filter @escritorio/painel exec playwright test e2e/demandas-nova.spec.ts
```
Esperado: FALHA nos dois (arquivos e botão não existem).

- [ ] **Passo 2: `lib/nova-demanda.ts`**

```ts
// Nova demanda (spec 6.4): conferência antes de ir ao banco e o campo de cada erro do banco, para o aviso ficar no lugar certo.

export type CampoNova = 'cliente' | 'setor' | 'titulo' | 'descricao' | 'prazo' | 'responsavel' | 'contato';

export function validarNovaDemanda(d: { cliente: string; setor: string; titulo: string; descricao: string }):
  { ok: true } | { ok: false; erro: string; campo: CampoNova } {
  if (!d.cliente) return { ok: false, erro: 'Escolha a empresa.', campo: 'cliente' };
  if (!d.setor) return { ok: false, erro: 'Escolha o setor.', campo: 'setor' };
  const titulo = d.titulo.trim();
  if (titulo.length < 3 || titulo.length > 120) return { ok: false, erro: 'O título precisa ter de 3 a 120 caracteres.', campo: 'titulo' };
  if (d.descricao.trim().length > 4000) return { ok: false, erro: 'A descrição pode ter até 4000 caracteres.', campo: 'descricao' };
  return { ok: true };
}

// Ordem importa: "pessoa ativa do setor" fala de setor, mas é do Responsável.
const PISTAS: [string, CampoNova][] = [
  ['pessoa ativa', 'responsavel'], ['contato', 'contato'], ['empresa', 'cliente'], ['título', 'titulo'],
  ['descrição', 'descricao'], ['prazo', 'prazo'], ['setor', 'setor'],
];

export function campoDoErro(mensagem: string): CampoNova | undefined {
  const m = mensagem.toLocaleLowerCase('pt-BR');
  return PISTAS.find(([pista]) => m.includes(pista))?.[1];
}
```

- [ ] **Passo 3: as ações**

Em `apps/painel/src/app/(painel)/demandas/acoes.ts`, acrescente o import `import { campoDoErro, validarNovaDemanda, type CampoNova } from '@/lib/nova-demanda';` e, no fim:

```ts
export type NovaDemandaDados = {
  cliente: string; setor: string; titulo: string; descricao: string; prioridade: Prioridade;
  /** Valor do datetime-local; vazio = o prazo sugerido pelo banco. */
  prazo: string; responsavel: string; contato: string;
};

/** Nova demanda pela equipe (origem equipe). Erro volta com o campo, para aparecer nele sem perder o que foi digitado. */
export async function criarDemanda(d: NovaDemandaDados): Promise<{ ok: true; mensagem: string; id: string } | { ok: false; erro: string; campo?: CampoNova }> {
  const v = validarNovaDemanda(d);
  if (!v.ok) return v;
  const prazo = d.prazo ? doCampoDataHora(d.prazo) : null;
  if (d.prazo && !prazo) return { ok: false, erro: 'Escolha a data e a hora do prazo.', campo: 'prazo' };
  await obterUsuario();
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('criar_demanda' as never, {
    p_cliente: d.cliente, p_setor: d.setor, p_titulo: d.titulo, p_descricao: d.descricao, p_prioridade: d.prioridade,
    p_prazo: prazo, p_responsavel: d.responsavel || null, p_contato: d.contato || null,
  } as never);
  if (error) {
    const erro = mensagemDoBanco(error.message);
    return { ok: false, erro, campo: campoDoErro(erro) };
  }
  const nova = data as unknown as { id: string; numero: number };
  revalidatePath('/demandas');
  return { ok: true, mensagem: `Demanda #${nova.numero} aberta.`, id: nova.id };
}

/** Contatos ativos da empresa escolhida na nova demanda (RLS: qualquer pessoa ativa lê contatos). */
export async function contatosDaEmpresa(clienteId: string): Promise<{ id: string; nome: string }[]> {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { data } = await sb.from('contato_clientes').select('contatos!inner(id, nome, ativo)').eq('cliente_id', clienteId).eq('contatos.ativo', true);
  return (data ?? []).map((v) => ({ id: v.contatos.id, nome: v.contatos.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
```

- [ ] **Passo 4: o painel da nova demanda (`nova-demanda.tsx`)**

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { OPCOES_PRIORIDADE, type Prioridade } from '@/lib/demandas';
import type { CampoNova } from '@/lib/nova-demanda';
import { paraCampoDataHora } from '@/lib/prazo';
import { classeSelect } from '../clientes/estilos';
import { contatosDaEmpresa, criarDemanda } from './acoes';
import { avisar, type PessoaSetor } from './acoes-demanda';

const rotulo = 'text-xs font-bold uppercase tracking-wide text-brand';

/**
 * Nova demanda (spec 6.4, imagem 04): ligação, e-mail ou balcão. Prioridade Normal por padrão; o prazo vem preenchido com o
 * sugerido e muda junto com a prioridade até a pessoa mexer nele. Responsável só do setor escolhido. Origem = equipe.
 */
export function NovaDemanda({ empresas, setores, pessoas, sugeridos }: {
  empresas: EmpresaOpcao[]; setores: { id: string; nome: string }[]; pessoas: PessoaSetor[]; sugeridos: Record<Prioridade, string | null>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const id = useId();
  const [pendente, iniciar] = useTransition();
  const [cliente, setCliente] = useState('');
  const [setor, setSetor] = useState(setores.length === 1 ? setores[0]!.id : '');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('normal');
  const [prazo, setPrazo] = useState(paraCampoDataHora(sugeridos.normal));
  const [prazoTocado, setPrazoTocado] = useState(false);
  const [responsavel, setResponsavel] = useState('');
  const [contato, setContato] = useState('');
  const [contatos, setContatos] = useState<{ id: string; nome: string }[]>([]);
  const [erro, setErro] = useState<{ campo?: CampoNova; texto: string } | null>(null);
  const erroDe = (c: CampoNova) => (erro?.campo === c ? erro.texto : null);

  const escolherPrioridade = (p: Prioridade) => {
    setPrioridade(p);
    if (!prazoTocado) setPrazo(paraCampoDataHora(sugeridos[p]));
  };

  const escolherEmpresa = (novo: string) => {
    setCliente(novo);
    setContato('');
    setContatos([]);
    if (novo) void contatosDaEmpresa(novo).then(setContatos);
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    iniciar(async () => {
      const r = await criarDemanda({ cliente, setor, titulo, descricao, prioridade, prazo: prazoTocado ? prazo : '', responsavel, contato });
      if (!r.ok) {
        setErro({ campo: r.campo, texto: r.erro });
        if (!r.campo) avisar(r);
        return;
      }
      avisar(r);
      const p = new URLSearchParams(sp.toString());
      p.delete('nova');
      p.set('demanda', r.id);
      router.replace(`/demandas?${p.toString()}`, { scroll: false });
    });
  };

  const aviso = (c: CampoNova) => erroDe(c) && <p id={`${id}-${c}-erro`} className="text-sm text-danger">{erroDe(c)}</p>;

  return (
    <form onSubmit={enviar} className="flex h-full flex-col" noValidate>
      <SheetHeader>
        <SheetTitle>Nova demanda</SheetTitle>
        <SheetDescription>Para pedidos que chegaram por ligação, e-mail ou no balcão.</SheetDescription>
      </SheetHeader>
      <SheetBody className="grid content-start gap-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor={`${id}-empresa`} className={rotulo}>Empresa</label>
            <EscolherEmpresa id={`${id}-empresa`} name="cliente" empresas={empresas} aoMudar={escolherEmpresa}
              aria-invalid={Boolean(erroDe('cliente'))} aria-describedby={erroDe('cliente') ? `${id}-cliente-erro` : undefined} />
            {aviso('cliente')}
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-setor`} className={rotulo}>Setor</label>
            <select id={`${id}-setor`} className={classeSelect} value={setor} aria-invalid={Boolean(erroDe('setor'))}
              onChange={(e) => { setSetor(e.target.value); setResponsavel(''); }}>
              <option value="" disabled>Escolha o setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            {aviso('setor')}
          </div>
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-titulo`} className={rotulo}>Título</label>
          <Input id={`${id}-titulo`} value={titulo} maxLength={120} aria-invalid={Boolean(erroDe('titulo'))}
            aria-describedby={erroDe('titulo') ? `${id}-titulo-erro` : undefined} onChange={(e) => setTitulo(e.target.value)} />
          {aviso('titulo')}
        </div>
        <div className="grid gap-1">
          <label htmlFor={`${id}-desc`} className={rotulo}>Descrição</label>
          <Textarea id={`${id}-desc`} rows={3} maxLength={4000} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          {aviso('descricao')}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid gap-1">
            <legend className={cn(rotulo, 'mb-1')}>Prioridade</legend>
            <div className="grid grid-cols-4 overflow-hidden rounded-md border border-input">
              {OPCOES_PRIORIDADE.map((o) => (
                <label key={o.valor} className={cn('cursor-pointer px-2 py-2 text-center text-sm has-checked:bg-grafite has-checked:text-grafite-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring',
                  'border-l border-input first:border-l-0')}>
                  <input type="radio" name="prioridade" value={o.valor} checked={prioridade === o.valor} onChange={() => escolherPrioridade(o.valor)} className="sr-only" />
                  {o.rotulo}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-1">
            <label htmlFor={`${id}-prazo`} className={cn(rotulo, 'flex items-center gap-2')}>
              Prazo {!prazoTocado && <span className="normal-case tracking-normal text-champagne-text">sugerido</span>}
            </label>
            <Input id={`${id}-prazo`} type="datetime-local" className="tabular" value={prazo} aria-invalid={Boolean(erroDe('prazo'))}
              onChange={(e) => { setPrazo(e.target.value); setPrazoTocado(true); }} />
            {aviso('prazo')}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1">
            <label htmlFor={`${id}-resp`} className={rotulo}>Responsável</label>
            <select id={`${id}-resp`} className={classeSelect} value={responsavel} disabled={!setor} onChange={(e) => setResponsavel(e.target.value)}>
              <option value="">Ninguém (fila do setor)</option>
              {pessoas.filter((p) => p.setores.includes(setor)).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {aviso('responsavel')}
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${id}-contato`} className={rotulo}>Contato na empresa</label>
            <select id={`${id}-contato`} className={classeSelect} value={contato} disabled={!cliente} onChange={(e) => setContato(e.target.value)}>
              <option value="">Nenhum</option>
              {contatos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            {aviso('contato')}
          </div>
        </div>
      </SheetBody>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
        <Button type="submit" disabled={pendente}>{pendente ? 'Abrindo…' : 'Abrir demanda'}</Button>
      </SheetFooter>
    </form>
  );
}
```

O "Cancelar" volta à URL anterior (sem `?nova=1`); Esc e o X do painel fazem o mesmo pelo `PainelLateralUrl`.

- [ ] **Passo 5: a página**

Em `apps/painel/src/app/(painel)/demandas/page.tsx`:
- acrescente os imports `import { Plus } from 'lucide-react';`, `import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';`, `import { NovaDemanda } from './nova-demanda';` e `OPCOES_PRIORIDADE`, `type Prioridade` de `@/lib/demandas`;
- depois do `Promise.all`:

```ts
  // Nova demanda: quem não é administrador abre só nos próprios setores (P10).
  const setoresNova = u.papel === 'admin' ? setores ?? [] : (setores ?? []).filter((s) => u.setores.includes(s.id));
  const podeNova = setoresNova.length > 0;
  const nova = f.nova && podeNova ? await lerNova(sb) : null;
```

- `BarraDemandas` ganha:

```tsx
        extra={podeNova ? (
          <Link href={`/demandas${hrefComParams(params, { nova: '1', demanda: null })}`} scroll={false} className={variantesBotao({ variant: 'primary' })}>
            <Plus aria-hidden size={16} strokeWidth={2} />Nova demanda
          </Link>
        ) : undefined}
```

- depois do `PainelDemanda`, acrescente:

```tsx
      <PainelLateralUrl param="nova" id={nova ? '1' : null} hrefFechar={`/demandas${hrefComParams(params, { nova: null })}`} esqueleto={<EsqueletoDemanda />} protegerAlteracoes>
        {nova && <NovaDemanda empresas={nova.empresas} setores={setoresNova} pessoas={pessoasSetor} sugeridos={nova.sugeridos} />}
      </PainelLateralUrl>
```

- acrescente, no fim do arquivo:

```tsx
/** Empresas ativas (arquivada sai das seleções, spec 5.1) e o prazo sugerido de cada prioridade, calculado agora pelo banco. */
async function lerNova(sb: Sb): Promise<{ empresas: EmpresaOpcao[]; sugeridos: Record<Prioridade, string | null> }> {
  const [{ data: clientes }, ...prazos] = await Promise.all([
    sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('ativo', true).order('razao_social'),
    ...OPCOES_PRIORIDADE.map((o) => sb.rpc('calcular_prazo', { p_prioridade: o.valor })),
  ]);
  return {
    empresas: (clientes ?? []).map((c) => ({ id: c.id, nome: c.nome_fantasia ?? c.razao_social, detalhe: c.cnpj })),
    sugeridos: Object.fromEntries(OPCOES_PRIORIDADE.map((o, i) => [o.valor, (prazos[i]?.data as string | null) ?? null])) as Record<Prioridade, string | null>,
  };
}
```

(com `import type { EmpresaOpcao } from '@/components/patterns/escolher-empresa';`). Se o `PainelLateralUrl` não aceitar o `protegerAlteracoes` sem um `FormularioAlteravel` dentro, tire a prop: a nova demanda não usa o indicador de alterações.

- [ ] **Passo 6: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel exec playwright test e2e/demandas-nova.spec.ts e2e/demandas.spec.ts
```

Esperado: tudo passa.

- [ ] **Passo 7: commit**

```bash
git add apps/painel/src/lib/nova-demanda.ts apps/painel/src/lib/nova-demanda.test.ts "apps/painel/src/app/(painel)/demandas" apps/painel/e2e/demandas-nova.spec.ts
git commit -m "$(cat <<'EOF'
feat(demandas): nova demanda com prazo sugerido pelo banco

Painel lateral (imagem 04): empresa com busca, setor (só os seus, para quem
não é administrador), título, descrição, prioridade (Normal por padrão),
prazo preenchido com o sugerido e marcado "sugerido" até a pessoa mudar,
responsável só do setor e contato na empresa. Origem equipe. Erro aparece no
campo sem perder o que foi digitado; ao abrir, mostra a demanda nova.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Configurações › Prazos, "Vencem hoje" e "Vencidas" no Início, "Com o cliente" no Atendimento

**Arquivos:**
- Modificar: `apps/painel/src/app/(painel)/configuracoes/esquemas.ts` (+ `esquemas.test.ts`), `configuracoes/acoes.ts`, `configuracoes/page.tsx`
- Modificar: `apps/painel/src/app/(painel)/inicio/page.tsx`
- Modificar: `apps/painel/src/app/(painel)/atendimento/[id]/acoes-conversa.tsx`
- Teste: `apps/painel/e2e/configuracoes.spec.ts`

**Interfaces:**
- Consome: `configuracoes.prazo_*_dias` (Task 1), `filtrarConsulta` e `lerFiltrosDemandas` (Task 6).
- Produz: `PrazosForm` (zod) e `salvarPrazos(formData)`; seção `#prazos` em Configurações; dois números no Início ("Vencem hoje" → `/demandas?prazo=hoje`, "Vencidas" → `/demandas?vencidas=1`).

- [ ] **Passo 1: testes (falham)**

Em `apps/painel/src/app/(painel)/configuracoes/esquemas.test.ts`, acrescente `PrazosForm` ao import e:

```ts
describe('PrazosForm (Configurações › Prazos)', () => {
  it('dias úteis inteiros de 0 a 30 para cada prioridade', () => {
    expect(PrazosForm.parse({ prazo_urgente_dias: '0', prazo_alta_dias: '1', prazo_normal_dias: '2', prazo_baixa_dias: '5' }))
      .toEqual({ prazo_urgente_dias: 0, prazo_alta_dias: 1, prazo_normal_dias: 2, prazo_baixa_dias: 5 });
    for (const ruim of ['-1', '31', '1.5', '']) {
      expect(PrazosForm.safeParse({ prazo_urgente_dias: '0', prazo_alta_dias: ruim, prazo_normal_dias: '2', prazo_baixa_dias: '5' }).success).toBe(false);
    }
  });
});
```

Em `apps/painel/e2e/configuracoes.spec.ts`, acrescente:

```ts
test('administrador muda o prazo de uma prioridade em Configurações › Prazos', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto('/configuracoes#prazos');
  const secao = page.getByRole('region', { name: 'Prazos por prioridade' });
  await secao.getByLabel('Normal (dias úteis)').fill('3');
  await secao.getByRole('button', { name: 'Salvar prazos' }).click();
  await expect.poll(async () => (await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
});
```

(Acrescente `db` ao import de `./apoio` se ainda não estiver.)

Run:
```bash
pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/configuracoes/esquemas.test.ts"
pnpm --filter @escritorio/painel exec playwright test e2e/configuracoes.spec.ts
```
Esperado: FALHA (`PrazosForm` e a seção não existem).

- [ ] **Passo 2: Configurações › Prazos**

Em `configuracoes/esquemas.ts`:

```ts
const dias = z.coerce.number().int().min(0).max(30);
/** Dias úteis até o prazo de cada prioridade (spec 6.5). 0 = no mesmo dia, até o fim do expediente. */
export const PrazosForm = z.object({
  prazo_urgente_dias: z.string().min(1).pipe(dias),
  prazo_alta_dias: z.string().min(1).pipe(dias),
  prazo_normal_dias: z.string().min(1).pipe(dias),
  prazo_baixa_dias: z.string().min(1).pipe(dias),
});
```

Em `configuracoes/acoes.ts`, acrescente `PrazosForm` ao import de `./esquemas` e:

```ts
export async function salvarPrazos(formData: FormData) {
  await exigirAdmin();
  const dados = PrazosForm.safeParse(Object.fromEntries(['prazo_urgente_dias', 'prazo_alta_dias', 'prazo_normal_dias', 'prazo_baixa_dias']
    .map((k) => [k, String(formData.get(k) ?? '')])));
  if (!dados.success) redirect('/configuracoes?erro=prazos#prazos');
  checar(await (await supabaseServidor()).from('configuracoes').update(dados.data).eq('id', 1));
  recarregar();
}
```

Em `configuracoes/page.tsx`:
- acrescente `salvarPrazos` ao import de `./acoes`;
- em `SECOES`, logo depois de `{ id: 'expediente', rotulo: 'Expediente' }`, acrescente `{ id: 'prazos', rotulo: 'Prazos' },`;
- depois do `</FormularioAlteravel>` de Expediente e Teto de IA, acrescente:

```tsx
          <FormularioAlteravel action={salvarPrazos}>
            <Secao id="prazos" titulo="Prazos por prioridade" descricao="Dias úteis até o prazo de cada demanda nova, contando o expediente e os feriados. 0 = no mesmo dia, até o fim do expediente.">
              <CardContent className="grid gap-4 sm:grid-cols-4">
                {([
                  ['prazo_urgente_dias', 'Urgente'], ['prazo_alta_dias', 'Alta'], ['prazo_normal_dias', 'Normal'], ['prazo_baixa_dias', 'Baixa'],
                ] as const).map(([campo, nome]) => (
                  <FormField key={campo} id={campo} rotulo={`${nome} (dias úteis)`} erro={erro === 'prazos' ? 'De 0 a 30.' : undefined}>
                    <Input name={campo} type="number" step="1" min="0" max="30" required defaultValue={cfg?.[campo]} className="tabular" />
                  </FormField>
                ))}
              </CardContent>
              <RodapeSalvar rotulo="Salvar prazos" />
            </Secao>
          </FormularioAlteravel>
```

- [ ] **Passo 3: Início**

Em `apps/painel/src/app/(painel)/inicio/page.tsx`:
- acrescente os imports `import { lerFiltrosDemandas } from '@/lib/demandas';` e `import { filtrarConsulta } from '@/lib/demandas-consulta';`;
- no segundo `Promise.all` (o de `semResp`), acrescente dois itens no começo, com os mesmos filtros dos links (o número bate com a lista que abre):

```ts
  const contarDemandas = (params: Record<string, string>) =>
    filtrarConsulta(sb.from('demandas_lista').select('id', { count: 'exact', head: true }), lerFiltrosDemandas(params, u.id), u.id, agora);
  const [vencemHoje, vencidas, semResp, semRespAntigas, ...contagens] = await Promise.all([
    contarDemandas({ prazo: 'hoje' }),
    contarDemandas({ vencidas: '1' }),
    abertasSemResponsavel(),
    // (o resto como está)
```

- em "Números do dia", depois do `Numero` "Sem responsável":

```tsx
          <Numero
            titulo="Vencem hoje"
            valor={vencemHoje.error ? null : vencemHoje.count ?? 0}
            destaque={(vencemHoje.count ?? 0) > 0 ? 'atencao' : undefined}
            rodape={<Link href="/demandas?prazo=hoje" className="text-brand underline-offset-4 hover:underline">Ver na lista</Link>}
          />
          <Numero
            titulo="Vencidas"
            valor={vencidas.error ? null : vencidas.count ?? 0}
            destaque={(vencidas.count ?? 0) > 0 ? 'perigo' : undefined}
            rodape={<Link href="/demandas?vencidas=1" className="text-brand underline-offset-4 hover:underline">Ver na lista</Link>}
          />
```

- [ ] **Passo 4: Atendimento**

Em `apps/painel/src/app/(painel)/atendimento/[id]/acoes-conversa.tsx`, troque `title="Aguardando cliente"` por `title="Com o cliente"`, o texto `Aguardando cliente` do `<span>` por `Com o cliente`, e os dois comentários que citam "Aguardando cliente" pelo nome novo. Antes, `grep -rn "Aguardando cliente" apps/painel/e2e apps/painel/src` e ajuste o que aparecer.

- [ ] **Passo 5: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel exec playwright test e2e/configuracoes.spec.ts e2e/atendimento.spec.ts e2e/menu.spec.ts
```

Esperado: tudo passa.

- [ ] **Passo 6: commit**

```bash
git add "apps/painel/src/app/(painel)/configuracoes" "apps/painel/src/app/(painel)/inicio/page.tsx" \
  "apps/painel/src/app/(painel)/atendimento/[id]/acoes-conversa.tsx" apps/painel/e2e/configuracoes.spec.ts
git commit -m "$(cat <<'EOF'
feat(painel): Configurações › Prazos, vencimentos no Início e "Com o cliente"

Prazos por prioridade editáveis pelo administrador (0 a 30 dias úteis, spec
6.5). O Início mostra "Vencem hoje" e "Vencidas", com os mesmos filtros da
lista que o link abre. No Atendimento, o botão de status passa a se chamar
"Com o cliente", o mesmo nome da tela Demandas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Acessibilidade das telas novas, catálogo e manual

**Arquivos:**
- Modificar: `apps/painel/e2e/acessibilidade.spec.ts`
- Modificar: `apps/painel/src/app/(painel)/%5Fdesign/demos-padroes.tsx` (rótulos de status; exemplo de prioridade e prazo)
- Modificar: `docs/design-system.md` (lista de patterns), `docs/operacao.md` (seção 8 e um parágrafo sobre prazos)

**Interfaces:**
- Consome: tudo das Tasks 6 a 12.
- Produz: axe nos dois temas em `/demandas?nova=1` e no quadro; catálogo com `PrioridadeTexto` e `PrazoTexto`.

- [ ] **Passo 1: axe nas telas novas (pode falhar)**

Em `apps/painel/e2e/acessibilidade.spec.ts`, na lista `rotas` do teste "telas do painel sem violações graves", depois de `` `/demandas?demanda=${ids.demanda}` ``, acrescente `'/demandas?nova=1'`. Depois do laço das rotas (antes do `expect(erros…)`), acrescente o quadro:

```ts
      // Quadro (preferência da pessoa): liga, audita e volta para a tabela, para os outros testes.
      await db.from('usuarios').update({ visao_demandas: 'quadro' }).eq('email', EMAIL);
      await page.goto('/demandas');
      await expect(page.getByRole('button', { name: 'Quadro' })).toHaveAttribute('aria-pressed', 'true');
      erros.push(...(await auditar(page, '/demandas (quadro)', tema)));
      await db.from('usuarios').update({ visao_demandas: 'tabela' }).eq('email', EMAIL);
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/acessibilidade.spec.ts`
Esperado: passa, ou aponta violações graves nas telas novas. Corrija cada uma no componente dono (rótulo faltando, contraste com token errado, `aria-*` inválido) e rode de novo até passar. Não silencie regra do axe.

- [ ] **Passo 2: catálogo**

Em `apps/painel/src/app/(painel)/%5Fdesign/demos-padroes.tsx`, troque as opções do filtro de status de exemplo por `[{ valor: 'aberto', rotulo: 'Nova' }, { valor: 'em_andamento', rotulo: 'Resolvendo' }, { valor: 'aguardando_cliente', rotulo: 'Com o cliente' }]` e acrescente, na seção de status de demanda, um exemplo de prioridade e prazo:

```tsx
        <div className="flex flex-wrap items-center gap-4 text-sm">
          {(['urgente', 'alta', 'normal', 'baixa'] as const).map((p) => <PrioridadeTexto key={p} prioridade={p} />)}
          <PrazoTexto prazo={new Date(Date.now() + 2 * 3600_000).toISOString()} pausadoDesde={null} concluidaEm={null} agora={new Date()} />
          <PrazoTexto prazo={new Date(Date.now() - 3600_000).toISOString()} pausadoDesde={null} concluidaEm={null} agora={new Date()} />
          <PrazoTexto prazo={null} pausadoDesde={new Date().toISOString()} concluidaEm={null} agora={new Date()} />
        </div>
```

(com `import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';`). Em `apps/painel/src/app/(painel)/%5Fdesign/page.tsx`, troque o status `'Aberta'` do exemplo por `'Nova'`.

- [ ] **Passo 3: documentação que já existe**

Em `docs/design-system.md`, na lista de `patterns/` ("DataTable com filtros na URL, StatusBadge…"), acrescente "PrioridadeTexto e PrazoTexto (prioridade e prazo das demandas, sempre escritos)".

Em `docs/operacao.md`, seção 8, troque a frase do "Exportar CSV Bling" por:

```markdown
- **Vários pedidos:** na tela **Demandas**, o link **"CSV Bling"** (no rodapé da tabela) gera um arquivo com as demandas de nota de venda **do filtro que está na tela**: busca, status, vencidas, setor, responsável, prioridade, tipo e período. Acima de 500 pedidos, aparecem "parte 1", "parte 2" etc., sem dividir um pedido entre arquivos.
```

e, no fim da seção 3 ("Dia a dia"), acrescente:

```markdown
### Prioridade e prazo das demandas

- O agente dá a prioridade ao abrir a demanda: **urgente** quando o cliente diz que é urgente (ou nota errada, golpe, funcionário sem registro), **alta** em assunto sensível e cobrança, **normal** no resto, **baixa** só quando o cliente diz que não tem pressa.
- O prazo é calculado em **dias úteis** (expediente e feriados das Configurações): urgente no mesmo dia, alta 1, normal 2, baixa 5. Mude em **Configurações › Prazos**.
- Em **"Com o cliente"** o prazo para de correr; quando a demanda volta, o prazo anda o tempo que ficou parado.
- Demanda vencida avisa o responsável (sem responsável, o setor) na lista de avisos do Início.
```

- [ ] **Passo 4: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel exec playwright test e2e/acessibilidade.spec.ts
```

Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/e2e/acessibilidade.spec.ts "apps/painel/src/app/(painel)/%5Fdesign" docs/design-system.md docs/operacao.md
git commit -m "$(cat <<'EOF'
test(demandas): axe na nova demanda e no quadro; catálogo e manual

A auditoria de acessibilidade passa a cobrir a nova demanda e o quadro, nos
dois temas. O catálogo mostra prioridade e prazo; o manual do dono explica
prioridade, prazo em dias úteis, pausa em "Com o cliente" e o CSV Bling que
segue o filtro da tela.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes (aplica as três migrações novas e limpa os dados que os e2e deixam):
   - `supabase test db`: todos os arquivos, inclusive o 18 com 28/28, o 19 com 37/37 e o 20 com 5/5;
   - `pnpm --filter @escritorio/core test`;
   - `pnpm --filter @escritorio/db test` e `pnpm --filter @escritorio/db typecheck`;
   - `pnpm --filter @escritorio/trabalhador test` e `pnpm --filter @escritorio/trabalhador typecheck`;
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com o `acessibilidade.spec.ts` nos dois temas. Rode `supabase db reset` de novo **antes** desta suíte se o `supabase test db` ou o trabalhador rodaram logo antes no mesmo banco;
   - **cenários com Claude real** (banco local):
     - `pnpm --filter @escritorio/trabalhador cenarios prioridade`: os 5 de prioridade (US$ 1 a 2);
     - se o dono respondeu "sim" à P9: `pnpm --filter @escritorio/trabalhador cenarios` (os 50; US$ 10 a 15). Falha em cenário antigo vira item da lista de pendências, com a saída inteira; não mude outra regra do agente nesta parte.
   - Mostre ao dono os números exatos de cada suíte (passaram, falharam, pulados) e a linha `N/N cenários passaram`. Nada de "deve passar".
   - Ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com as imagens `03-demandas-tabela.png`, `04-demandas-quadro-e-nova.png` e `05-demanda-painel-lateral.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local e dados de exemplo parecidos com os das imagens (uma demanda urgente sem responsável, uma alta com responsável, uma em "Com o cliente", uma vencida, uma concluída nos últimos 7 dias);
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**);
   - telas: a tabela com os filtros padrão; a tabela com uma etiqueta de filtro avançado e a janela "Filtrar" aberta; o quadro; o quadro com a confirmação de concluir; o painel lateral de uma demanda do agente; a nova demanda; Configurações › Prazos; os dois números novos do Início;
   - liste o que ficou diferente das imagens. Já se sabe, por exemplo: a ordenação fica num seletor "Ordenar por" (decisão 12), e o "…" de ações da linha só existe como "Assumir" (as outras ações estão no painel lateral).
3. **Homologação:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Deve listar só `20261003000300_painel_v2_prazo.sql`, `20261003000400_painel_v2_acoes_demanda.sql` e `20261003000500_painel_v2_alerta_vencimento.sql` (e as duas das sobras, `20261003000100` e `20261003000200`, se ainda não tiverem sido aplicadas);
   - explique ao dono o que muda para quem já está rodando na homologação:
     - os painéis antigos (Parte A na 3002 e 3003, Parte B na 3004, sobras na 3005) continuam funcionando: as colunas novas têm valor padrão, `usuarios(nome)` continua sem ambiguidade (`criado_por` não tem chave estrangeira) e `alterar_status_chamado` mantém a assinatura;
     - o trabalhador antigo (porta 3001) continua abrindo demandas: o banco dá prioridade Normal, calcula o prazo e ignora a "criação" repetida que ele grava;
     - as demandas que já existem ficam sem prazo (P3) e não disparam alerta;
     - no painel antigo, "Aguardando cliente" passa a pausar o prazo (é o banco que faz);
   - **espere o "ok" dele.** Só então rode o mesmo comando sem `--dry-run`.
4. **Subir para o dono testar (painel e trabalhador desta branch, apontando para a homologação):**
   - **painel** desta worktree numa porta livre. Sugestão: **3006** (3002 e 3003 são da Parte A, 3004 da Parte B, 3005 das sobras). Antes, `netstat -ano | findstr :3006`. Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal (`C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/ligar-teste.ps1`): variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p 3006` rodando nesta worktree;
   - **trabalhador:** o da porta **3001 é o teste do dono** (versão da Parte A) e recebe o webhook da Z-API pelo túnel. **Não desligue nem mate esse processo.** Dois trabalhadores no mesmo banco dividem a fila (pg-boss): uma mensagem do WhatsApp pode cair no antigo, sem a prioridade. Pergunte ao dono antes:
     - (a) **recomendado:** ele mesmo fecha a janela do trabalhador da 3001; então suba o desta worktree **na 3001** (o túnel já aponta para ela): em `apps/trabalhador`, `pnpm exec tsx watch "--env-file=<worktree>/.env" "--env-file=C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.env.homologacao" src/principal.ts`, como a opção `trabalhador` do `ligar-teste.ps1`, mas nesta worktree;
     - (b) se ele preferir manter o da 3001: suba o desta worktree em outra porta (`PORTA=3011`, conferida com `netstat`) e avise que, enquanto os dois estiverem ligados, o teste da prioridade pelo WhatsApp não é confiável;
   - passe os endereços e um roteiro curto:
     1. abrir `/demandas`: botões com contador, busca por número e por empresa, "Filtrar" e etiquetas;
     2. abrir uma demanda: Assumir, mudar prioridade (o prazo muda), pôr em "Com o cliente" (vira "pausado"), nota, transferir, concluir, reabrir; conferir a linha do tempo;
     3. Quadro: arrastar entre colunas, soltar em Concluída (pede confirmação), Shift + seta com o teclado;
     4. "+ Nova demanda": prazo sugerido muda com a prioridade;
     5. CSV Bling com um filtro ligado (só as demandas do filtro);
     6. pelo WhatsApp de teste: um pedido de nota (normal), um "é urgente, vence hoje" (urgente) e uma cobrança (alta);
     7. Configurações › Prazos; números "Vencem hoje" e "Vencidas" no Início.
5. **Pendências para listar no fim:**
   - as respostas do dono às perguntas P1 a P11 que ainda faltam;
   - as decisões 1 a 21 deste plano que ele ainda não confirmou;
   - o que ficou diferente das imagens;
   - o resultado dos cenários antigos (se rodaram) e qualquer falha deles;
   - para a Parte D: mudar o **prazo** passa a exigir "Alterar prazos de demandas" (spec 6.5); hoje quem age na demanda muda prioridade e prazo;
   - para a Parte G: o Início ganhou só os dois números; o redesenho por papel continua lá.
6. **Não juntar** a branch em nada. **Parar** ao fim da Parte C e esperar "próxima parte".
