# Treinar o agente — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela no painel para o dono e a equipe marcada alimentarem o agente de clientes com orientações, com teste simulado, histórico e botão "Ensinar o agente" nas conversas.

**Architecture:** Tabelas novas no Supabase com RLS e funções de gravação auditadas; o trabalhador injeta as orientações ativas no prompt do agente (bloco abaixo das regras fixas) e roda simulações numa fila nova com ferramentas simuladas; o painel (design system do redesign) ganha a tela, o diálogo de teste e o botão no Atendimento.

**Tech Stack:** Supabase (Postgres, RLS, pgTAP, Realtime), Fastify + pg-boss + Anthropic SDK, Next.js 15 + shadcn/ui + Tailwind 4, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-treinar-agente-design.md`

## Global Constraints

- Branch `treinar-agente` (worktree `.claude/worktrees/treinar-agente`). Nada de push.
- Regras fixas do agente (prompt.ts) continuam no código e vencem as orientações; o bloco de orientações diz isso literalmente.
- Permissão nova: `treinar_agente`, rótulo "Treinar o agente". Admin sempre pode.
- Limites: título ≤ 120, texto ≤ 2000, mensagem de teste ≤ 2000 caracteres; total de orientações ativas no prompt ≤ 12.000 caracteres.
- Tipos: `jeito` = "Jeito de atender", `regra` = "Regra do escritório", `situacao` = "Situação específica".
- Painel segue `docs/design-system.md` (tokens, ui/, patterns/, vocabulário, sem cores cruas, AA, claro/escuro). Não quebrar os e2e existentes.
- Simulação nunca grava dados de negócio nem envia mensagem.
- Mudanças no banco só por migração nova; tipos regenerados (`pnpm db:tipos` com Supabase local).
- Testes do trabalhador/banco usam o Supabase LOCAL e apagam os dados locais (ok: o dono está na nuvem). Nunca tocar portas 3000/3001/3002 nem matar node em massa.
- Commits em português com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Orientação maliciosa ou mal escrita ("ignore as regras", "mande dados da empresa X") não derruba regras fixas nem vaza dados entre empresas.
2. Orientação de uma empresa aparecendo na conversa de outra empresa.
3. Simulação gravando algo (demanda, preço, mensagem) ou enviando WhatsApp.
4. Usuário sem permissão lendo/gravando orientações pela API (RLS), não só pela tela.
5. Prompt ficando grande demais (custo) e cache do prompt quebrado a cada mensagem.

---

### Task 1: Banco — tabelas, RLS, funções, versões, simulações

**Files:** Create `supabase/migrations/20260930000100_orientacoes_agente.sql`, `supabase/tests/12_orientacoes_agente.test.sql` (pgTAP, siga o estilo dos testes existentes); Modify `packages/db/src/tipos.gen.ts` (regenerado), `packages/db/src/repos.ts` (novos métodos do trabalhador: `orientacoesAtivas()`, `simulacaoPorId(id)`, `concluirSimulacao(id, dados)`), `apps/trabalhador/src/retencao.ts` (apagar simulações > 30 dias).

- [ ] Tabelas, checks, índices, RLS e funções conforme spec §3 (`salvar_orientacao(p_id uuid|null, titulo, texto, tipo, cliente_id, setor_id, ativo) returns uuid`, `alternar_orientacao(p_id, ativo)`, `restaurar_orientacao(p_versao_id)`), cada uma grava versão + `registrar_auditoria`; revoke de anon/public, grant a authenticated.
- [ ] `simulacoes_agente` com RLS (própria pessoa + permissão) e publicação realtime.
- [ ] pgTAP cobrindo: sem permissão não lê/grava; marcado e admin sim; versão gravada; validações; restaurar.
- [ ] Repos com testes (packages/db test).
- [ ] Rodar `supabase test db`, `pnpm --filter @escritorio/db test`, typecheck geral.

### Task 2: Trabalhador — orientações no prompt do agente

**Files:** Modify `apps/trabalhador/src/agente/contexto.ts`, `prompt.ts`, `executar.ts`; tests em `apps/trabalhador/test/agente/`.

- [ ] Contexto carrega orientações que valem (gerais, setor, empresa em foco) — função pura de filtro/ordenação/corte com testes (limite 12.000, prioridade empresa > setor > geral, mais recentes primeiro; registra `orientacoes_cortadas`).
- [ ] Prompt: bloco com a frase de precedência (spec §4), agrupado; orientações da empresa num segundo bloco de sistema; cache preservado (bloco 1 idêntico entre empresas — teste).
- [ ] Texto das orientações é da equipe (confiável), mas nunca pode alterar a regra 9 nem as regras fixas: teste que o bloco vem depois das regras e com a frase.
- [ ] Cenários com Claude real em `src/cenarios/` (3, conforme spec §6) — rodar se houver créditos; relatar.

### Task 3: Trabalhador — simulação

**Files:** Modify `apps/trabalhador/src/fila.ts` (fila `simular_agente`), `principal.ts` (worker), Create `apps/trabalhador/src/agente/simular.ts`; tests.

- [ ] Executor de ferramentas simulado (spec §4): leituras reais, gravações/envios fictícios registrados; contexto de conversa fictícia; orientações ativas + rascunho; grava resultado/erro na simulação; custo em `uso_ia`; respeita teto de IA (erro amigável).
- [ ] Testes: nada gravado nas tabelas de negócio, canal falso sem envios, respostas registradas, rascunho considerado, erro vira status `erro`.

### Task 4: Painel — tela "Treinar o agente" e permissão

**Files:** Create `apps/painel/src/app/(painel)/treinar-agente/**` (page, acoes.ts, esquemas.ts + testes, componentes); Modify `lib/menu.ts` (+ teste), usuários (PERMISSOES + descrição), sidebar ícone; e2e `apps/painel/e2e/treinar-agente.spec.ts`; `/_design` se surgir padrão novo.

- [ ] Tela conforme spec §5 (tabela, filtros, medidor, painel lateral com formulário, histórico/restaurar, exemplos no vazio), ações chamando as funções do banco com o cliente do usuário, erros por `?erro=`/aviso.
- [ ] Permissão "Treinar o agente" em Usuários; menu só com permissão; rota bloqueada sem permissão (mensagem de quem pode liberar).
- [ ] e2e + axe da tela (claro/escuro).

### Task 5: Painel — "Testar o agente"

**Files:** `apps/painel/src/app/(painel)/treinar-agente/testar-*.tsx`, `acoes.ts` (criar simulação + enfileirar via `lib/fila.ts`), e2e.

- [ ] Dialog de teste (mensagem, empresa opcional, rascunho do formulário), estado "Pensando…", resultado por tempo real (mensagens + ações recolhidas), erro humano, uma pendente por pessoa.
- [ ] e2e: cria simulação e mostra resultado gravado direto no banco (sem IA).

### Task 6: Painel — "Ensinar o agente" no Atendimento

**Files:** `apps/painel/src/app/(painel)/atendimento/[id]/*` (botão + dialog), reutilizando a ação de salvar orientação; e2e.

- [ ] Botão no cabeçalho só com permissão; Dialog pré-preenchido (spec §5); salvar cria desligada por padrão; toast com link.
- [ ] e2e existentes do Atendimento intactos; e2e novo.

### Task 7: Documentação e verificação final

- [ ] `docs/operacao.md`: seção "Treinar o agente" (como usar, exemplos bons, limites, regras fixas que vencem).
- [ ] Rodar tudo: typecheck, vitest (painel, trabalhador, core, db), pgTAP, e2e do painel.

### Task 8: Skill de atendimento do dono (adicionada em 2026-09-30)

Origem: o dono enviou a skill `docs/referencia/skill-atendimento-dono.md` (46 mil caracteres) e decidiu: o agente se chama **Thiago**; **emoji nunca** (regra fixa continua); as orientações da skill podem ficar, **inclusive as explicações gerais** da seção 4.3 ("Explicações gerais que você pode dar"); setores IRPF, Comercial e Direção foram criados na nuvem (Legalização = Societário da skill).

**Files:** `apps/trabalhador/src/agente/prompt.ts` (regras fixas), Create `supabase/dados/orientacoes-skill-dono.sql` (inserção idempotente das orientações, desligadas, para rodar na nuvem depois do merge, com aprovação), testes.

- [ ] Regras fixas: (a) o agente se apresenta como "Thiago, do atendimento do escritório" quando fizer sentido (primeiro contato), nunca diz ser pessoa e, se perguntarem diretamente, diz que é o assistente virtual do escritório; (b) a regra 2 passa a permitir SÓ as explicações gerais listadas na skill (DAS, DAS do MEI, pró-labore × lucro, registro do funcionário, férias, rescisão, limite do MEI, certificado digital), sem números do caso e só quando o cliente perguntar; continua proibido parecer do caso concreto; (c) emoji continua proibido.
- [ ] Condensar o resto da skill em ~12 orientações (tipo, título, texto ≤ 2000) cabendo juntas em ≤ 12.000 caracteres pela regra de medição de `orientacoesDaConversa`: postura e escuta; perguntar bem; responder como gente (frases proibidas); ritmo; perfis de cliente; assuntos sensíveis (regra 7 da skill, ASSUNTO SENSÍVEL → Direção); sigilo/senha/golpe/terceiros; setores e casos de fronteira (com os nomes reais: Contábil, Financeiro, Fiscal, IRPF, Legalização, Pessoal, Comercial, Direção); checklist do que coletar; prioridade e resumo interno (formato ENCAMINHAMENTO dentro do resumo da demanda; título com URGENTE: quando urgente); situações delicadas; fechamento com o cliente. Nada que contrarie as regras fixas (resumo + confirmação do pedido de nota, sem emoji, ferramentas).
- [ ] Dados do escritório (bloco 4.0): ler `pedidos-do-dono/skill-atendimento/dados-do-escritorio.txt` (copiado para o brief pelo controller); campos vazios = "vou confirmar com a equipe".
- [ ] Teste que as orientações do seed cabem no limite e que nenhuma contém emoji; cenário com Claude real "assunto sensível vai para a Direção sem julgar" (não rodar sem o controller).
