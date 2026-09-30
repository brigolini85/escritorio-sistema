# Redesign do painel — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar a camada visual e de experiência de `apps/painel` com um design system baseado em tokens, sem mudar regras de negócio.

**Architecture:** Tokens CSS semânticos em `src/styles/tokens.css` expostos ao Tailwind v4 via `@theme inline`; primitivos shadcn/ui em `src/components/ui`, composições de domínio em `src/components/patterns`, casca em `src/components/layout`. Cada tela passa a compor esses blocos. Dados novos só por consultas de leitura com o cliente Supabase do usuário (RLS).

**Tech Stack:** Next.js 15 App Router (RSC + server actions existentes), React 19, Tailwind CSS v4, shadcn/ui (Radix), lucide-react, cva, tailwind-merge, next/font (Inter), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-30-redesign-painel-design.md` (seção 0 = decisões D1–D11; seções 1–10 = pedido do dono).

## Global Constraints

- Só `apps/painel` muda (mais `docs/design-system.md` na última fase e este plano/spec). Nada em `packages/*`, `apps/trabalhador`, `supabase/`.
- Não mudar rotas, nomes de parâmetros de URL, `name` de campos de formulário, server actions (`acoes.ts`, `*-acoes.ts`), esquemas (`esquemas.ts`), `lib/*.ts` de regra (caixa, bling, menu, fila, erro-formulario, sessao) exceto para ADICIONAR funções de leitura novas (D1) com testes.
- Consultas novas: só leitura, cliente do usuário (`supabaseServidor()`), nunca o cliente de serviço.
- Nada de cor/tamanho/espaçamento arbitrário no JSX (`#…`, `text-[13px]`, `mt-[7px]`, `bg-slate-*`, `text-red-*` etc.). Cores só por tokens semânticos (`bg-surface`, `text-muted`, `bg-brand`…). Larguras de layout fixas pedidas pela spec (240/64/320/360/760px) viram tokens ou utilitários nomeados em `tokens.css`.
- Escala tipográfica fechada: xs 12 / sm 13 / base 14 / lg 16 / xl 20 / 2xl 24; corpo 14px.
- Vocabulário da UI: "Demanda" (nunca "ticket"/"chamado" visível), "Atendimento", "Conversa", "Empresa", "Contato", "Setor", "Pedido de nota", "CSV do Bling", "Assumir", "Devolver ao agente", "Nota interna", "Concluir". Nenhum emoji.
- Acessibilidade WCAG 2.1 AA: contraste ≥ 4.5:1, foco visível, teclado, `prefers-reduced-motion`. Transições ≤ 150ms ease-out.
- Ícones lucide: 16px em linhas, 20px na navegação, `strokeWidth={1.75}`.
- Testes: typecheck do painel limpo; `pnpm --filter @escritorio/painel test` passando; Playwright 37/37 (porta 3100, Supabase local). Preservar `data-testid`, `aria-label`, textos de botão, `placeholder`, `label` e roles usados em `apps/painel/e2e`. Antes de mudar texto visível, `grep` em `apps/painel/e2e`. Mudança de seletor em teste só conforme D4, listada no relatório.
- Formulários continuam sendo `<form action={serverAction}>` com os mesmos campos; componentes client só onde há interação (tema, sidebar recolhível, Sheet, Dialog, busca, toasts).
- Horário sempre `America/Sao_Paulo`.

## Review Focus

1. Um teste E2E que passa a achar o elemento errado (texto duplicado visível após manter texto legado + novo) — `getByText` estrito quebra com 2 matches.
2. Tema escuro com contraste insuficiente em estados (badges, nota interna, alertas) — conferir tokens dark.
3. Página sem permissão mostrando ação que falha (PermissionGate) — atendente sem `emitir_notas` não pode ver CSV; não-admin não vê Usuários/Configurações.
4. Tempo real (AtualizarAoVivo) continuando a funcionar dentro da nova casca, sem pular a rolagem.
5. Formulários server action dentro de Dialog/Sheet enviando os mesmos campos (inclusive hidden) e o redirecionamento de erro `?erro=` ainda aparecendo.

---

### Task 1: Fundação (fase 1)

**Files:**
- Create: `apps/painel/src/styles/tokens.css`, `apps/painel/src/lib/cn.ts`, `apps/painel/components.json`, `apps/painel/src/components/ui/*` (Button, Input, Textarea, Label, Select, Checkbox, Switch, Dialog, Sheet, Tabs, Table, Badge, Tooltip, DropdownMenu, Toaster (sonner), Skeleton, Separator, Card, Popover, Command, ScrollArea, Avatar), `apps/painel/src/components/tema/*` (provedor/alternador de tema), `apps/painel/src/app/(painel)/%5Fdesign/page.tsx`
- Modify: `apps/painel/src/app/globals.css`, `apps/painel/src/app/layout.tsx`, `apps/painel/package.json`
- Test: `apps/painel/src/lib/cn.test.ts`, tema (função pura que decide o tema a partir do cookie) com teste vitest

- [ ] Tokens conforme spec 5.2 com TODOS os nomes pedidos (`--brand`, `--brand-foreground`, `--background`, `--surface`, `--surface-muted`, `--border`, `--ring`, `--text`, `--text-muted`, `--text-subtle`, `--success`, `--warning`, `--danger`, `--info` (+ `-foreground`/`-soft` para fundos suaves), `--agent-active`, `--agent-paused`, `--human-owned`, `--assistant`, `--internal-note`, `--radius-sm/md/lg`, `--shadow-sm/md`, `--font-sans`, `--font-mono`), cada um com comentário de uma linha dizendo onde é usado; bloco dark em `[data-theme="dark"]` e em `@media (prefers-color-scheme: dark)` para `:root:not([data-theme="light"])`. Contraste AA verificado (anotar razões principais no comentário).
- [ ] `globals.css`: `@import "tailwindcss"`, importa tokens, `@theme inline` mapeando tokens para utilitários (`bg-brand`, `text-muted`, `border-border`, `rounded-md`…), escala tipográfica fechada (sobrescrever `--text-*` do Tailwind), corpo 14px, `font-feature-settings: "tnum"` via utilitário `tabular` (ou `tabular-nums`), foco visível global (`:focus-visible` com `--ring`), `prefers-reduced-motion` zera transições/animações.
- [ ] Inter via `next/font/google` ligada a `--font-sans`; `layout.tsx` raiz lê cookie de tema e põe `data-theme` no `<html>` (ausente = segue sistema); `suppressHydrationWarning` só se necessário.
- [ ] `cn()` com clsx + tailwind-merge (configurado para reconhecer a escala tipográfica customizada) e teste.
- [ ] Primitivos shadcn copiados e ajustados aos tokens (sem cores Tailwind cruas). Button com variantes `primary | secondary | outline | ghost | danger | link` e tamanhos `sm | md | icon`.
- [ ] `/_design` (pasta `%5Fdesign`, D6): catálogo vivo com todos os tokens (amostras de cor, tipografia, raios, sombras) e todos os primitivos em seus estados; alternador de tema na página. `notFound()` em produção.
- [ ] Nenhuma tela existente precisa mudar nesta fase além de herdar fonte/cores base; os 37 E2E continuam passando.
- [ ] Verificar: typecheck, vitest, Playwright; commit.

### Task 2: AppShell (fase 2)

**Files:** `apps/painel/src/components/layout/{app-shell,sidebar,topbar,page-header,faixa-ambiente,busca-global,menu-usuario}.tsx`, `apps/painel/src/lib/contadores.ts` (+ teste), `apps/painel/src/lib/busca.ts` (+ teste), `apps/painel/src/app/(painel)/layout.tsx`, rota de leitura para a busca se preciso (`src/app/api/busca/route.ts`, só GET, cliente do usuário).

- [ ] Sidebar 240px recolhível para 64px (só ícones com tooltip), estado em cookie; ordem: Início, Atendimento, Demandas, Clientes, Contatos, Assistente — separador — Usuários, Configurações. Itens continuam vindo de `itensDoMenu(u)` (não mudar a regra; pode adicionar ícone/grupo por fora, mapeando por `href`). Item ativo destacado (`aria-current="page"`). Links mantêm o nome acessível exato ("Assistente", "Usuários"…).
- [ ] Contadores ao lado de Atendimento (conversas com `estado = 'humano'` sem atendente, ou a definição de "aguardando humano" já usada em `caixa_entrada`/`lib/caixa.ts`) e Demandas (abertas nos setores da pessoa via RLS), atualizados em tempo real (reaproveitar o padrão de `AtualizarAoVivo` / `router.refresh`).
- [ ] Topbar: busca global Ctrl/⌘+K (cmdk) por empresa, contato e demanda (leitura, RLS); AgentStateIndicator compacto do estado geral (lê `configuracoes.agente_pausado` — se RLS não deixar atendente ler, mostrar só para quem pode, sem erro); faixa de ambiente (D10); menu do usuário com nome, papel, alternar tema, Sair (mesma server action `sair`, botão com texto "Sair").
- [ ] Toaster global montado (sonner). Tablet: sidebar vira gaveta (Sheet) abaixo de `lg`.
- [ ] Verificar e commit.

### Task 3: Padrões de domínio (fase 3)

**Files:** `apps/painel/src/components/patterns/*` — PageHeader (pode morar em layout/ e ser reexportado), DataTable, FilterBar, StatusBadge, AgentStateIndicator, HealthSignal, EmptyState, ConfirmDialog, PermissionGate, FormField, MoneyText, DocumentText, RelativeTime, MessageBubble, DiffPreview, OrderSummary, BlingExportButton. Formatadores puros em `apps/painel/src/lib/formatos.ts` com testes vitest (BRL, CNPJ/CPF/CEP, tempo relativo em pt-BR com Brasília).

- [ ] Cada padrão conforme a tabela 5.4 da spec, com exemplo em `/_design`.
- [ ] DataTable: server-friendly (recebe linhas e colunas), ordenação e filtros refletidos na URL (searchParams), seleção múltipla client-side, paginação, estados vazio/carregando(Skeleton)/erro, ações por linha. Linhas 40–44px.
- [ ] ConfirmDialog envolve um `<form action>` existente sem mudar campos (o botão de confirmação é o submit). Suporta "digite o nome para confirmar".
- [ ] MessageBubble: cliente, agente, atendente/equipe, sistema, nota interna, arquivo, áudio transcrito (ícone lucide Mic, sem emoji), falha de envio.
- [ ] DiffPreview recebe o texto antes/depois que o assistente já produz (formato "Antes:/Depois:" com linhas "• …") e realça adicionados/removidos/alterados; se não conseguir interpretar, mostra o texto puro.
- [ ] OrderSummary a partir de `chamados.pedido_venda` (ver `@escritorio/core` `PedidoVendaSalvo` e `montarResumoParaCliente` só como referência de campos; não alterar core). Itens sem valor destacados "a conferir pelo Fiscal".
- [ ] BlingExportButton: link para `/api/csv-bling?...` existente, estado de carregamento; nome acessível contém "CSV Bling".
- [ ] Verificar e commit.

### Task 4: Atendimento (fase 4)

**Files:** `apps/painel/src/app/(painel)/atendimento/**` (páginas e componentes; `acoes.ts` intocado), `lib/caixa.ts` só com adições.

- [ ] Três colunas: lista (320px) com filtros rápidos (Aguardando humano · Comigo · Com o agente · Concluídas — mapear para os filtros existentes de `FILTROS` sem mudar a regra; filtro novo só se for derivável por leitura), busca, itens com contato, empresa, prévia, RelativeTime, AgentStateIndicator compacto; aguardando humano no topo e destacadas. A lista aparece também em `/atendimento/[id]`.
- [ ] Centro: cabeçalho com contato, empresa (componente `ContatoDaConversa` existente preservado), estado do agente, ações Assumir (primária) / Devolver ao agente / Transferir / Concluir (Concluir com ConfirmDialog). Histórico com MessageBubble e separadores de data; "Novas mensagens ↓" se o usuário rolou para cima. Compositor com alternância Responder ao cliente / Nota interna (nota com `--internal-note` e "o cliente não vê"); respostas prontas com `/` se houver dado (tabela de respostas prontas já existe em Configurações; leitura).
- [ ] Direita (360px, recolhível): abas Assistente (ConversaAssistente) e Detalhes (empresa, demandas abertas com eventos, OrderSummary, Baixar CSV Bling). "Por que o agente fez isso?" continua disponível (recolhido, formatado de forma legível).
- [ ] Verificar e commit.

### Task 5: Demandas e Início (fase 5)

- [ ] Demandas: PageHeader com "Exportar CSV Bling" (mantém partes e contagem), FilterBar (setor, status, responsável, tipo, período — novos filtros só por leitura), DataTable com número, empresa, assunto, setor, responsável, aberta há, status. Linha abre Sheet com detalhes, linha do tempo de eventos, OrderSummary, Baixar CSV Bling, Abrir conversa. Seleção múltipla + exportar selecionadas (`/api/csv-bling?ids=` existente).
- [ ] Início: faixa de alertas (só se houver), card Agente (Pausar/Retomar admin com ConfirmDialog), sinais de vida (`sinais_vida`), números do dia, gasto de IA do mês vs. teto (barra), avisos (alertas com "ok"). Trocar "chamados abertos" por "demandas abertas".
- [ ] Verificar e commit.

### Task 6: Clientes e Contatos (fase 6)

- [ ] Clientes: DataTable → ficha com abas (Dados · Contatos · Clientes e fornecedores · Produtos · Preços por rede · Documentos) usando Tabs visuais sobre as rotas/params existentes. Modo leitura por padrão, Editar via PermissionGate. Preços com histórico e origem painel/agente. Documentos com "liberado para IA".
- [ ] Contatos: DataTable com empresas vinculadas, marcações como badges, switch do agente por contato (mesma action), "Apagar dados (LGPD)" em zona de perigo com ConfirmDialog que exige digitar o nome.
- [ ] Verificar e commit.

### Task 7: Assistente (fase 7)

- [ ] Chat em largura de leitura (~760px), histórico de conversas à esquerda (leitura), respostas com DiffPreview/OrderSummary/tabelas/BlingExportButton quando reconhecíveis, estado "Pensando…" (texto preservado), sugestões no vazio (textos atuais preservados). `data-testid="mensagens-assistente"` e placeholder "Pergunte ao assistente" preservados. Mesmo visual na aba do Atendimento (modo compacto).
- [ ] Verificar e commit.

### Task 8: Usuários e Configurações (fase 8)

- [ ] Usuários: DataTable + Sheet de edição (papel, setores multi-select, telefone, cinco permissões como Switch com descrição), aviso quando WhatsApp ligado sem telefone (texto de validação atual preservado). Convite num Dialog/Sheet.
- [ ] Configurações: navegação lateral interna por seções, cada seção card com Salvar próprio e indicação de alterações não salvas.
- [ ] Verificar e commit.

### Task 9: Polimento (fase 9)

- [ ] Auditoria axe (adicionar `@axe-core/playwright` como devDependency e um spec E2E que roda axe nas telas principais em claro e escuro, sem violações sérias/críticas), contraste, teclado (atalhos ⌘K, J/K, A, N, Esc, `?` listando atalhos), tema escuro em todas as telas, remoção de estilos órfãos, grep final por cores cruas/valores arbitrários.
- [ ] `docs/design-system.md`: trocar a cor da marca, criar componente novo, ui/ vs patterns/, vocabulário oficial.
- [ ] Lista de pendências/decisões para o dono.
- [ ] Verificar e commit.
