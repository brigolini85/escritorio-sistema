# Painel v2, Parte A: identidade visual "Grafite, vinho e champanhe". Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development, que foi o modo pedido pelo dono. Cada task tem um implementador e um revisor; no fim, uma revisão do branch inteiro. Os passos usam `- [ ]`.

**Objetivo:** o painel deixa de ter a "cara padrão de IA" e ganha a identidade do escritório:
- cores grafite, vinho e champanhe;
- fonte Plus Jakarta Sans;
- letra que cresce em tela grande;
- menu no padrão de navegação do Acessórias, com assinatura própria;
- login "Faixa vinho";
- janelas de confirmação novas.

Nenhuma regra de negócio muda.

**Arquitetura:**
- A mudança mora quase toda em `apps/painel`:
  - `tokens.css`: cores, raios e larguras;
  - `globals.css`: escala em `rem` que acompanha a largura da tela;
  - `components/layout`: casca, menu e trilha;
  - `components/patterns`: confirmação e status;
  - `app/entrar`: login.
- No banco entra uma migração mínima com duas coisas:
  - o aviso do login, lido por uma função pública que devolve só esse texto;
  - o tamanho de letra escolhido por cada pessoa, gravado por uma função que só altera a própria linha.
- O tamanho de letra também fica num cookie (como o tema), para a página já nascer no tamanho certo.

**Tecnologias:** Next.js 15 (App Router), React 19, Tailwind 4 (`@theme`), shadcn/ui sobre Radix, lucide-react, `next/font/google`, Supabase (Postgres, RLS, pgTAP), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`, seção 4 (Parte A). As imagens ficam em `docs/superpowers/specs/painel-v2/imagens/`: `00-login.png`, `00-login-tela-grande.png`, `01-menu-e-clientes-arquivar.png` e `02-excluir-de-vez.png`. Leia também `docs/design-system.md`.

**Onde trabalhar:** worktree `.claude/worktrees/painel-v2-parte-a`, branch `painel-v2-parte-a`, criada a partir de `treinar-agente`. A pasta do spec já foi trazida da `etapa-1` (`git checkout etapa-1 -- docs/superpowers/specs/painel-v2`). Todos os comandos rodam a partir da raiz da worktree.

## Restrições globais

- Só mexer em `apps/painel`, na migração `supabase/migrations/20261001000100_painel_v2_identidade.sql` (com o teste pgTAP dela), em `packages/db/src/tipos.gen.ts` (regerado), em `supabase/templates/recuperar-senha.html` + `supabase/config.toml` (Task 9) e em `docs/design-system.md`.
- Nenhuma regra de negócio, rota, `data-testid` ou texto usado em teste muda sem antes rodar `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit.
- Nada de cor, tamanho ou espaçamento solto no JSX: nada de `#hex`, `bg-white`, `text-[13px]`, `w-[300px]`. Tudo sai dos tokens (`tokens.css`) e da escala (`globals.css`). O contraste AA é conferido por `src/styles/tokens.test.ts`.
- Caixa alta só por CSS (`uppercase`), nunca escrita no texto. O nome acessível continua "Cancelar", "Entrar", "E-mail" etc., e os testes que procuram esses nomes continuam valendo.
- Inspiração no Acessórias, sem cópia: siga a tabela da seção 4.3 do spec. Não use logo, ícone, cor exata nem texto do Acessórias.
- Vinho (marca) e vermelho de perigo nunca aparecem só como cor: sempre há ícone ou texto junto.
- O tom dos textos segue a seção 4.6: frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Os termos oficiais continuam os mesmos.
- O banco local (Docker) é só para testes. Nunca rode teste contra `.env.homologacao`. Mudança na homologação só depois de mostrar o `--dry-run` e receber o "ok" do dono.
- Os comentários no código seguem o estilo da casa: português, uma linha dizendo o porquê.

## Decisões que o dono precisa confirmar (ao aprovar o plano)

1. **Duas cores do spec não passam no AA como texto.** O plano usa versões mais escuras só onde a cor vira texto, e o valor do spec continua nos enfeites:
   - `--warning`: o spec traz `#C07A1E`, que dá 3,47:1 sobre o branco. O texto e os selos de "atenção" passam a usar `#A06318` (4,89:1). O `#C07A1E` fica em `--warning-decor`, para faixas e pontos.
   - Texto champanhe: o spec traz `#A8865A`, que dá 3,37:1. Subtítulos e "prazo sugerido" passam a usar `#8A6A3E` (4,99:1). O `#C8A97E` continua nos fios, no aro do logo e nas faixas do login, que são enfeites e não precisam de AA.
2. **Nome do escritório no login e no menu.** Até o dono enviar o logo, entram o monograma "EC" e o nome "Escritório Contábil", numa constante (`src/lib/escritorio.ts`), fácil de trocar.
3. **"Esqueci a senha"** abre `/esqueci-senha`, que manda o e-mail de recuperação do Supabase. O link do e-mail leva para `/auth/confirm`, uma rota que já existe e já trata `type=recovery`, e depois para `/definir-senha`.
   - No banco local, o modelo de e-mail entra pelo `config.toml`.
   - Na homologação, o dono, ou eu com autorização dele, precisa colar o mesmo modelo no painel do Supabase (Authentication → Email Templates → Reset Password). Sem isso, o link do e-mail usa o formato padrão e cai em `/entrar?erro=link`.
4. **Submenu de Configurações.** O spec diz "abre ao lado (desktop) ou expande (recolhido)". O plano lê assim:
   - menu fixo do desktop, aberto ou recolhido: o submenu abre ao lado;
   - gaveta das telas menores: o submenu expande logo abaixo do item.
   - O item "Usuários" sai do primeiro nível e vira "Usuários e permissões" dentro de Configurações.

## Foco da revisão

Situações que o spec implica e que nenhum teste da tela antiga cobria. Cada uma ganhou teste na task dona dela:

1. **Tela grande.** A 1920px a letra base é 16px e a 2560px continua 16px. Ícones, larguras do menu e da lista de conversas e alturas de linha crescem junto; nada fica com o tamanho antigo em px. Testado na Task 3 (vitest de guarda) e na Task 10 (Playwright mede o `font-size` e a largura do menu em 1366 e 1920).
2. **Login com aviso vazio, longo ou com HTML.** Vazio ou só espaços não mostra o bloco. Com 200 caracteres cabe sem quebrar o layout. Texto com `<b>` aparece como texto, sem virar HTML. Na Task 9, pgTAP para vazio e 201 caracteres e Playwright para o HTML escapado.
3. **Visitante sem login lendo dados.** A função `aviso_login()` devolve só o texto, e quem não entrou continua sem ler `configuracoes`. Testado no pgTAP da Task 1.
4. **Pessoa tentando mudar o tamanho de letra de outra.** `definir_tamanho_letra` só altera a linha de `auth.uid()`. Usuário inativo não altera, e valor desconhecido é recusado. Testado no pgTAP da Task 1.
5. **Cookie de tamanho de letra com valor estranho** (`letra=xyz`, apagado ou de outra pessoa no mesmo computador). Vira "normal" e o login regrava o cookie a partir do perfil. Testado no vitest da Task 4 e no Playwright da Task 10.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261001000100_painel_v2_identidade.sql` | `configuracoes.aviso_login`, `aviso_login()`, `usuarios.tamanho_letra`, `definir_tamanho_letra()` | 1 |
| `supabase/tests/14_painel_v2_identidade.test.sql` | pgTAP da migração | 1 |
| `packages/db/src/tipos.gen.ts` | tipos regerados | 1 |
| `apps/painel/src/styles/tokens.css` | cores novas (claro e escuro), menu grafite, champanhe, cores dos módulos, grafite, raios, larguras em rem | 2, 3 |
| `apps/painel/src/styles/tokens.test.ts` | AA dos pares novos | 2 |
| `apps/painel/src/app/globals.css` | escala em rem, letra que acompanha a tela, classes de tamanho de letra, ícones em rem, ponte dos tokens novos | 2, 3 |
| `apps/painel/src/styles/escala.test.ts` (novo) | guarda: escala e ícones em rem, nenhum `-[Npx]` no JSX | 3 |
| `apps/painel/src/app/layout.tsx` | Plus Jakarta Sans e classe do tamanho de letra no `<html>` | 4 |
| `apps/painel/src/components/layout/tamanho-letra.ts` (+ teste) | valores, classe e cookie do tamanho de letra | 4 |
| `apps/painel/src/components/layout/acoes-perfil.ts` (novo) | server action `definirTamanhoLetra` | 4 |
| `apps/painel/src/components/ui/button.tsx`, `label.tsx`, `table.tsx`, `card.tsx` | caixa alta, cantos de 5px, sem sombra decorativa, variantes `grafite` e `success` | 5 |
| `apps/painel/src/components/patterns/status-badge.tsx` | status de demanda em texto colorido com ponto | 5 |
| `apps/painel/src/components/layout/page-header.tsx` | título 300 + número 800 vinho, rótulo de seção | 5 |
| `apps/painel/src/lib/menu.ts` (+ teste) | Configurações com submenu, "Usuários e permissões" dentro dele | 6 |
| `apps/painel/src/components/layout/trilha.ts` (+ teste) | trilha ícone › Seção › Tela a partir da rota | 6 |
| `apps/painel/src/components/layout/sidebar.tsx` | menu grafite: logo, atalhos, itens, ativo, submenu, Recolher | 7 |
| `apps/painel/src/components/layout/atalhos-menu.tsx` (novo) | os 4 atalhos quadrados | 7 |
| `apps/painel/src/components/layout/topbar.tsx`, `menu-usuario.tsx`, `app-shell.tsx`, `app/(painel)/layout.tsx` | trilha à esquerda, busca/agente/pessoa à direita, tamanho da letra no menu, estado do WhatsApp | 7 |
| `apps/painel/src/components/patterns/confirmacao.ts` (+ teste), `confirm-dialog.tsx` | janela de confirmação nova | 8 |
| `apps/painel/src/lib/escritorio.ts` | nome e monograma do escritório | 7 |
| `apps/painel/src/app/entrar/page.tsx`, `acoes.ts`, `aviso-login.ts` (+ teste) | login "Faixa vinho", aviso e cookie de letra no login | 9 |
| `apps/painel/src/app/esqueci-senha/page.tsx`, `acoes.ts` | pedir nova senha | 9 |
| `apps/painel/src/middleware.ts` | `/esqueci-senha` vira rota pública | 9 |
| `apps/painel/src/app/(painel)/configuracoes/page.tsx`, `acoes.ts`, `esquemas.ts` (+ teste) | campo "Aviso na tela de entrada" | 9 |
| `apps/painel/src/app/(painel)/%5Fdesign/*` | catálogo atualizado | 10 |
| `apps/painel/e2e/identidade.spec.ts` (novo), `capturas.spec.ts` (novo), `login.spec.ts`, `configuracoes.spec.ts`, `acessibilidade.spec.ts` | testes de tela | 9, 10 |
| `docs/design-system.md` | regras novas | 10 |

---

### Task 1: Banco (aviso do login e tamanho de letra)

**Arquivos:**
- Criar: `supabase/migrations/20261001000100_painel_v2_identidade.sql`
- Criar: `supabase/tests/14_painel_v2_identidade.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Produz:
  - `public.aviso_login() returns text`: texto aparado, ou `null` se vazio. Executável por `anon` e `authenticated`.
  - `public.definir_tamanho_letra(p_tamanho text) returns void`: só para `authenticated`.
  - Coluna `usuarios.tamanho_letra text not null default 'normal'`, com os valores `normal | grande | maior`.
  - Coluna `configuracoes.aviso_login text not null default ''`, com no máximo 200 caracteres.

- [ ] **Passo 1: escrever o teste pgTAP (falha)**

```sql
-- supabase/tests/14_painel_v2_identidade.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'ana14@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'bia14@pgtap.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'inativa14@pgtap.local');
insert into public.usuarios (id, nome, email, papel, ativo) values
  ('00000000-0000-0000-0000-0000000000d1', 'Ana', 'ana14@pgtap.local', 'atendente', true),
  ('00000000-0000-0000-0000-0000000000d2', 'Bia', 'bia14@pgtap.local', 'atendente', true),
  ('00000000-0000-0000-0000-0000000000d3', 'Inativa', 'inativa14@pgtap.local', 'atendente', false);

-- Aviso do login: vazio não aparece; o visitante lê só o texto, nunca a tabela.
update public.configuracoes set aviso_login = '   ' where id = 1;
set local role anon;
select is(public.aviso_login(), null, 'aviso só com espaços devolve null');
reset role;
update public.configuracoes set aviso_login = '  DCTFWeb vence dia 15.  ' where id = 1;
set local role anon;
select is(public.aviso_login(), 'DCTFWeb vence dia 15.', 'visitante lê o aviso aparado');
select throws_ok($$ select teto_ia_usd from public.configuracoes $$, '42501', null, 'visitante não lê configuracoes');
reset role;
select throws_ok($$ update public.configuracoes set aviso_login = repeat('x', 201) where id = 1 $$, '23514', null,
  'aviso com 201 caracteres é recusado');
select lives_ok($$ update public.configuracoes set aviso_login = repeat('x', 200) where id = 1 $$, 'aviso com 200 caracteres vale');

-- Tamanho da letra: cada um muda só o seu.
select is((select tamanho_letra from public.usuarios where id = '00000000-0000-0000-0000-0000000000d1'), 'normal', 'padrão é normal');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select lives_ok($$ select public.definir_tamanho_letra('grande') $$, 'pessoa muda o próprio tamanho');
select throws_ok($$ select public.definir_tamanho_letra('enorme') $$, 'P0001', 'Tamanho de letra inválido.', 'valor desconhecido é recusado');
select throws_ok($$ update public.usuarios set tamanho_letra = 'maior' where id = '00000000-0000-0000-0000-0000000000d2' $$, '42501', null,
  'atendente não grava direto em usuarios');
reset role;
select is((select tamanho_letra from public.usuarios where id = '00000000-0000-0000-0000-0000000000d1'), 'grande', 'gravou na própria linha');
select is((select tamanho_letra from public.usuarios where id = '00000000-0000-0000-0000-0000000000d2'), 'normal', 'a outra pessoa não mudou');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}', true);
select throws_ok($$ select public.definir_tamanho_letra('maior') $$, 'P0001', 'Acesso desativado.', 'usuário inativo não grava');
reset role;

select * from finish();
rollback;
```

Observação: se o teste "atendente não grava direto" devolver 0 linhas em vez de `42501`, a RLS está filtrando o `update`, sem dar erro. Nesse caso, troque a asserção por `select is((select tamanho_letra ... d2), 'normal', ...)` depois de um `update` executado com `lives_ok`. O importante é que a linha da outra pessoa não mude.

- [ ] **Passo 2: rodar e ver falhar**

Rode `supabase test db` com o Supabase local ligado (`supabase start`). Esperado: FALHA, porque a coluna `aviso_login` e as funções não existem.

- [ ] **Passo 3: escrever a migração**

```sql
-- supabase/migrations/20261001000100_painel_v2_identidade.sql
-- Painel v2, Parte A: recado da tela de entrada e tamanho de letra de cada pessoa.

-- Recado curto do administrador na tela de entrada (até 200 caracteres; vazio = não mostra).
alter table public.configuracoes
  add column aviso_login text not null default '' check (char_length(aviso_login) <= 200);

-- A tela de entrada é pública: devolve só o recado, nunca o resto de configuracoes.
create function public.aviso_login() returns text
language sql stable security definer set search_path = ''
as $$ select nullif(btrim(aviso_login), '') from public.configuracoes where id = 1 $$;
revoke all on function public.aviso_login() from public, anon, authenticated;
grant execute on function public.aviso_login() to anon, authenticated;

-- Tamanho da letra escolhido no menu da pessoa (Normal / Grande +1px / Maior +2px).
alter table public.usuarios
  add column tamanho_letra text not null default 'normal' check (tamanho_letra in ('normal', 'grande', 'maior'));

-- Só o administrador grava em usuarios (RLS); esta função deixa cada um mudar só o próprio tamanho.
create function public.definir_tamanho_letra(p_tamanho text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_tamanho is null or p_tamanho not in ('normal', 'grande', 'maior') then
    raise exception 'Tamanho de letra inválido.';
  end if;
  if not exists (select 1 from public.usuarios where id = auth.uid() and ativo) then
    raise exception 'Acesso desativado.';
  end if;
  update public.usuarios set tamanho_letra = p_tamanho where id = auth.uid();
end
$$;
revoke all on function public.definir_tamanho_letra(text) from public, anon, authenticated;
grant execute on function public.definir_tamanho_letra(text) to authenticated;
```

- [ ] **Passo 4: aplicar no banco local e rodar os testes**

Rode `supabase migration up` e depois `supabase test db`. Esperado: todos os arquivos passam, inclusive o 14 com 12/12.

- [ ] **Passo 5: regerar os tipos**

Rode `pnpm db:tipos` e depois `git diff --stat packages/db/src/tipos.gen.ts`. Esperado: o diff traz `aviso_login`, `tamanho_letra`, `aviso_login` em Functions e `definir_tamanho_letra`.

- [ ] **Passo 6: commit**

```bash
git add supabase/migrations/20261001000100_painel_v2_identidade.sql supabase/tests/14_painel_v2_identidade.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): aviso da tela de entrada e tamanho de letra por pessoa (painel v2, parte A)"
```

---

### Task 2: Cores "Grafite, vinho e champanhe"

**Arquivos:**
- Modificar: `apps/painel/src/styles/tokens.css`
- Modificar: `apps/painel/src/styles/tokens.test.ts`
- Modificar: `apps/painel/src/app/globals.css` (somente o bloco `@theme inline`)

**Interfaces:**
- Produz tokens (utilitários entre parênteses):
  - `--brand-base: hsl(348 55% 31%)`
  - `--sidebar-bg` (`bg-sidebar`), `--sidebar-bg-raised` (`bg-sidebar-raised`), `--sidebar-text` (`text-sidebar`), `--sidebar-border` (`border-sidebar`)
  - `--accent-champagne` (`bg-champagne`, `border-champagne`), `--accent-champagne-text` (`text-champagne`)
  - `--graphite` e `--graphite-foreground` (`bg-grafite`, `text-grafite-foreground`)
  - `--warning-decor` (`bg-warning-decor`)
  - `--modulo-inicio`, `--modulo-atendimento`, `--modulo-demandas`, `--modulo-clientes`, `--modulo-contatos`, `--modulo-assistente`, `--modulo-treinar`, `--modulo-configuracoes` (`text-modulo-*`, `border-modulo-*`)

- [ ] **Passo 1: estender o teste (falha)**

Em `tokens.test.ts`, acrescente ao fim de `OBRIGATORIOS`:

```ts
  '--sidebar-bg', '--sidebar-bg-raised', '--sidebar-text', '--sidebar-border', '--accent-champagne', '--accent-champagne-text',
  '--graphite', '--graphite-foreground', '--warning-decor',
  ...['inicio', 'atendimento', 'demandas', 'clientes', 'contatos', 'assistente', 'treinar', 'configuracoes'].map((m) => `--modulo-${m}`),
```

Acrescente também ao fim de `PARES`:

```ts
  // Menu grafite (spec 4.3): texto do menu, item ativo branco sobre vinho, ícones coloridos (3:1, não são texto).
  ['--sidebar-text', '--sidebar-bg', 4.5],
  ['--sidebar-text', '--sidebar-bg-raised', 4.5],
  ['--brand-foreground', '--brand', 4.5],
  ...['inicio', 'atendimento', 'demandas', 'clientes', 'contatos', 'assistente', 'treinar', 'configuracoes']
    .map((m): [string, string, number] => [`--modulo-${m}`, '--sidebar-bg', 3]),
  ['--accent-champagne', '--sidebar-bg', 3],
  // Champanhe como texto (subtítulos, "prazo sugerido") e botão grafite.
  ['--accent-champagne-text', '--surface', 4.5],
  ['--accent-champagne-text', '--background', 4.5],
  ['--graphite-foreground', '--graphite', 4.5],
  ['--graphite', '--surface', 3],
```

Acrescente este teste ao `describe`:

```ts
  it('perigo é distinto do vinho da marca (matiz a pelo menos 20 graus)', () => {
    const matiz = (t: Map<string, string>, n: string) => paraOklch(cor(t, n))[2];
    const dif = Math.abs(matiz(claro, '--danger') - matiz(claro, '--brand'));
    expect(Math.min(dif, 360 - dif)).toBeGreaterThanOrEqual(20);
  });
```

O teste "toda cor do tema claro tem valor no tema escuro" exige que cada token novo também apareça nos dois blocos escuros, e isso já está coberto.

- [ ] **Passo 2: rodar e ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/styles/tokens.test.ts`. Esperado: FALHA, com tokens ausentes.

- [ ] **Passo 3: trocar os valores em `tokens.css`**

No bloco `:root`, cada linha mantém o comentário de uma linha dizendo onde é usada, como exige o teste.
- Marca: `--brand-base: hsl(348 55% 31%);`, que é o vinho `#7A2335`. As reservas `--brand` e `--brand-soft` de navegador antigo viram `hsl(348 55% 31%)` e `hsl(348 40% 96%)`.
- Superfícies quentes:
  - `--background: hsl(20 10% 94%)` (`#F1EFEE`)
  - `--surface: hsl(0 0% 100%)`
  - `--surface-muted: hsl(20 9% 92%)`
  - `--border: hsl(20 8% 86%)`
  - `--border-input: hsl(345 4% 52%)`
  - `--overlay: hsl(345 10% 8% / 0.5)`
- Texto:
  - `--text: hsl(345 6% 14%)`
  - `--text-muted: hsl(345 5% 32%)`
  - `--text-subtle: hsl(345 4% 42%)`
- Semânticas:
  - `--danger: hsl(11 71% 41%)` (`#B23A1E`), `--danger-soft: hsl(11 70% 95%)`
  - `--warning: hsl(33 74% 36%)` (`#A06318`, decisão 1), `--warning-soft: hsl(36 80% 92%)`
  - `--warning-decor: hsl(34 73% 44%)` (`#C07A1E`, faixas e pontos, nunca texto)
  - `--success: hsl(168 70% 19%)` (`#0F5446`), `--success-soft: hsl(165 45% 93%)`
  - `--info` continua como está.
- Novos:
  - `--sidebar-bg: hsl(345 6% 14%)` (`#262223`, menu lateral)
  - `--sidebar-bg-raised: hsl(345 4% 18%)` (`#2F2B2C`, submenu e atalhos)
  - `--sidebar-text: hsl(348 9% 89%)` (`#E6E1E2`)
  - `--sidebar-border: hsl(348 5% 22%)` (`#3A3536`)
  - `--accent-champagne: hsl(35 40% 64%)` (`#C8A97E`, fio do ativo, aro do logo e faixas do login; enfeite)
  - `--accent-champagne-text: hsl(35 38% 39%)` (`#8A6A3E`, decisão 1)
  - `--graphite: hsl(345 6% 14%)` (botão "Entrar", FILTRAR, excluir de vez)
  - `--graphite-foreground: hsl(0 0% 100%)`
- Cores dos módulos (ícones do menu, sempre sobre o grafite):
  - `--modulo-inicio: hsl(40 60% 60%)`
  - `--modulo-atendimento: hsl(152 41% 55%)`
  - `--modulo-demandas: hsl(79 51% 57%)`
  - `--modulo-clientes: hsl(210 46% 61%)`
  - `--modulo-contatos: hsl(268 38% 67%)`
  - `--modulo-assistente: hsl(40 60% 60%)`
  - `--modulo-treinar: hsl(25 71% 58%)`
  - `--modulo-configuracoes: hsl(185 43% 52%)`

Nos **dois** blocos escuros (devem continuar idênticos):
- Neutros com matiz 345 e saturação até 6%, mantendo as luminosidades atuais:
  - `--background: hsl(345 6% 7%)`
  - `--surface: hsl(345 5% 11%)`
  - `--surface-muted: hsl(345 4% 16%)`
  - `--border: hsl(345 4% 22%)`
  - `--border-input: hsl(345 3% 44%)`
  - `--text: hsl(345 8% 93%)`
  - `--text-muted: hsl(345 5% 70%)`
  - `--text-subtle: hsl(345 4% 62%)`
  - `--overlay: hsl(345 15% 3% / 0.7)`
- `--danger: hsl(11 85% 66%)`, `--danger-foreground: hsl(11 60% 10%)`, `--danger-soft: hsl(11 45% 16%)`
- `--warning-decor: hsl(34 73% 50%)`
- `--success` continua como está.
- O menu continua grafite. `--sidebar-*` e `--modulo-*` repetem os valores do claro.
- `--accent-champagne: hsl(35 40% 64%)`, `--accent-champagne-text: hsl(35 45% 70%)`
- `--graphite: hsl(345 4% 85%)` e `--graphite-foreground: hsl(345 6% 12%)`. No escuro, o botão grafite inverte para continuar visível.

Atualize o comentário do topo: a marca padrão agora é o vinho.

- [ ] **Passo 4: ponte no Tailwind**

No `@theme inline` de `globals.css`, acrescente:

```css
  /* Menu lateral grafite, champanhe, grafite de botão e cores dos módulos (spec 4.1) */
  --color-sidebar: var(--sidebar-bg);
  --color-sidebar-raised: var(--sidebar-bg-raised);
  --color-sidebar-foreground: var(--sidebar-text);
  --color-sidebar-border: var(--sidebar-border);
  --color-champagne: var(--accent-champagne);
  --color-champagne-text: var(--accent-champagne-text);
  --color-grafite: var(--graphite);
  --color-grafite-foreground: var(--graphite-foreground);
  --color-warning-decor: var(--warning-decor);
  --color-modulo-inicio: var(--modulo-inicio);
  --color-modulo-atendimento: var(--modulo-atendimento);
  --color-modulo-demandas: var(--modulo-demandas);
  --color-modulo-clientes: var(--modulo-clientes);
  --color-modulo-contatos: var(--modulo-contatos);
  --color-modulo-assistente: var(--modulo-assistente);
  --color-modulo-treinar: var(--modulo-treinar);
  --color-modulo-configuracoes: var(--modulo-configuracoes);
```

Isso gera, por exemplo: `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `bg-champagne`, `text-champagne-text`, `bg-grafite`, `text-modulo-clientes`, `border-modulo-inicio`.

- [ ] **Passo 5: rodar até passar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/styles/tokens.test.ts`. Esperado: tudo passa, inclusive as 10 "outras marcas". Se algum par ficar abaixo do mínimo, escureça (claro) ou clareie (escuro) só a luminosidade daquele token, de 2 em 2 pontos, e anote a razão no comentário. Não mexa no matiz.

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/styles/tokens.css apps/painel/src/styles/tokens.test.ts apps/painel/src/app/globals.css
git commit -m "feat(painel): cores grafite, vinho e champanhe com contraste AA conferido"
```

---

### Task 3: Escala em rem que acompanha a tela

**Arquivos:**
- Modificar: `apps/painel/src/app/globals.css`
- Modificar: `apps/painel/src/styles/tokens.css` (larguras e raios)
- Criar: `apps/painel/src/styles/escala.test.ts`
- Modificar: os arquivos `.tsx` que o teste de guarda apontar com `-[Npx]`. Hoje são 0, então o teste só evita regressão.

**Ideia:**
- A raiz (`html`) passa a ter a letra base: 14px até 1599px, 15px de 1600px e 16px de 1920px em diante. Cada pessoa ainda pode somar +1 ou +2px.
- Todo o resto é convertido para `rem` com base 14:
  - texto: `--text-*` e `--text-*--line-height`;
  - espaçamento do Tailwind: `--spacing`, de onde saem `p-*`, `gap-*`, `h-*`, `size-*`;
  - larguras do layout;
  - ícones.
- Assim, a 1366px tudo fica **igual ao de hoje em px**, e a 1920px cresce 16/14.
- As media queries do Tailwind (`lg` = 64rem) continuam medindo pelos 16px do navegador, porque o `rem` dentro de media query não segue o `html`. Os pontos de quebra não mudam.

**Interfaces:**
- Produz:
  - variável CSS `--letra-extra` (0px, 1px ou 2px), mudada pelas classes `letra-grande` e `letra-maior` no `<html>`;
  - utilitários de texto `text-3xl` (32px na base 14, títulos de tela) e `text-display` (64px, título do login);
  - raio `rounded-pill` (18px);
  - ponto de quebra `login:` (56.25rem = 900px).

- [ ] **Passo 1: teste de guarda (falha)**

```ts
// apps/painel/src/styles/escala.test.ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A letra acompanha a tela (spec 4.2): tudo em rem a partir do <html>; px solto não cresce em tela grande.
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const SRC = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('escala que acompanha a tela', () => {
  it('a letra base mora no html: 14px, 15px a partir de 1600px e 16px a partir de 1920px, mais o extra da pessoa', () => {
    expect(globais).toMatch(/--letra-base:\s*14px/);
    expect(globais).toMatch(/@media \(min-width: 1600px\)[\s\S]*?--letra-base:\s*15px/);
    expect(globais).toMatch(/@media \(min-width: 1920px\)[\s\S]*?--letra-base:\s*16px/);
    expect(globais).toMatch(/font-size:\s*calc\(var\(--letra-base\) \+ var\(--letra-extra\)\)/);
    expect(globais).toMatch(/\.letra-grande\s*\{[^}]*--letra-extra:\s*1px/);
    expect(globais).toMatch(/\.letra-maior\s*\{[^}]*--letra-extra:\s*2px/);
  });

  it('escala de texto e espaçamento em rem (nenhum px)', () => {
    const escala = globais.slice(globais.indexOf('--text-*: initial'), globais.indexOf('}', globais.indexOf('--text-*: initial')));
    expect(escala).not.toMatch(/\d+px/);
    expect(globais).toMatch(/--spacing:\s*calc\(4rem \/ 14\)/);
  });

  it('larguras de layout dos tokens em rem', () => {
    for (const n of ['--sidebar-width', '--sidebar-width-collapsed', '--conversation-list-width', '--conversation-panel-width', '--reading-width']) {
      expect(new RegExp(`${n}:\\s*calc\\(\\d+rem / 14\\)`).test(tokens), n).toBe(true);
    }
  });

  it('todo tamanho de ícone usado no código tem regra em rem no globals.css', () => {
    const usados = new Set(arquivos(SRC).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/size=\{(\d+)\}/g)].map((m) => m[1]!)));
    const faltando = [...usados].filter((n) => !new RegExp(`svg\\.lucide\\[width="${n}"\\]`).test(globais));
    expect(faltando).toEqual([]);
  });

  it('nenhum valor arbitrário em px nas classes do JSX', () => {
    const achados = arquivos(SRC).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/-\[\d+(\.\d+)?px\]/g)].map((m) => `${f}: ${m[0]}`));
    expect(achados).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/styles/escala.test.ts`. Esperado: FALHA nos quatro primeiros.

- [ ] **Passo 3: implementar em `globals.css`**

Troque o bloco `@theme` da escala por este (os valores são px/14 em rem):

```css
/* Escala tipográfica fechada, em rem para crescer com a tela (base 14px: xs 12 / sm 13 / base 14 / lg 16 / xl 20 / 2xl 24 / 3xl 32 / display 64). */
@theme {
  --text-*: initial;
  --text-xs: calc(12rem / 14);
  --text-xs--line-height: calc(16rem / 14);
  --text-sm: calc(13rem / 14);
  --text-sm--line-height: calc(18rem / 14);
  --text-base: 1rem;
  --text-base--line-height: calc(20rem / 14);
  --text-lg: calc(16rem / 14);
  --text-lg--line-height: calc(24rem / 14);
  --text-xl: calc(20rem / 14);
  --text-xl--line-height: calc(28rem / 14);
  --text-2xl: calc(24rem / 14);
  --text-2xl--line-height: calc(32rem / 14);
  --text-3xl: calc(32rem / 14);
  --text-3xl--line-height: calc(40rem / 14);
  --text-display: calc(64rem / 14);
  --text-display--line-height: 1.05;
  /* Grade de 4px do Tailwind medida na base 14px: p-1 = 4px a 1366, cresce junto em tela grande. */
  --spacing: calc(4rem / 14);
  /* Tela de entrada: duas colunas a partir de 900px (spec 4.4). */
  --breakpoint-login: 56.25rem;
  --radius-pill: 18px;
}
```

No `@layer base`, troque o comentário e a regra do `html`:

```css
  /* A letra base mora na raiz e cresce com a tela (spec 4.2); tudo o mais é rem e cresce junto. */
  html {
    --letra-base: 14px;
    --letra-extra: 0px;
    font-size: calc(var(--letra-base) + var(--letra-extra));
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
  /* Preferência da pessoa no menu (Tamanho da letra): Grande +1px, Maior +2px. */
  html.letra-grande { --letra-extra: 1px; }
  html.letra-maior { --letra-extra: 2px; }

  /* Ícones do lucide nascem com width/height em px; aqui viram rem para crescer com a letra. */
  svg.lucide[width="8"] { width: calc(8rem / 14); height: calc(8rem / 14); }
  svg.lucide[width="14"] { width: 1rem; height: 1rem; }
  svg.lucide[width="16"] { width: calc(16rem / 14); height: calc(16rem / 14); }
  svg.lucide[width="18"] { width: calc(18rem / 14); height: calc(18rem / 14); }
  svg.lucide[width="20"] { width: calc(20rem / 14); height: calc(20rem / 14); }
  svg.lucide[width="24"] { width: calc(24rem / 14); height: calc(24rem / 14); }
  svg.lucide[width="40"] { width: calc(40rem / 14); height: calc(40rem / 14); }
```

Fora do `@layer`, no fim do arquivo, acrescente os degraus:

```css
@media (min-width: 1600px) {
  html { --letra-base: 15px; }
}
@media (min-width: 1920px) {
  html { --letra-base: 16px; }
}
```

Os tamanhos 18, 24 e 40 serão usados pelas Tasks 7 e 8. Ícones sem `size` usam 24px por padrão; o teste exige só os que aparecem com `size={N}`. Troque `--altura-cabecalho-estimada: 3.5rem` por `4rem` e `4.75rem` por `calc(76rem / 14)`.

- [ ] **Passo 4: larguras e raios em `tokens.css`**

```css
  --radius-sm: 4px; /* selos, caixas de seleção, itens de menu */
  --radius-md: 5px; /* botões, campos, abas e barras de ferramentas (spec 4.2) */
  --radius-lg: 8px; /* cards, tabelas, painéis e janelas */
  --sidebar-width: calc(260rem / 14); /* menu lateral aberto (utilitário w-sidebar) */
  --sidebar-width-collapsed: calc(72rem / 14); /* menu recolhido, só ícones e atalhos empilhados (w-sidebar-recolhida) */
  --conversation-list-width: calc(320rem / 14); /* lista de conversas do Atendimento */
  --conversation-panel-width: calc(360rem / 14); /* painel direito da conversa */
  --reading-width: calc(760rem / 14); /* largura de leitura do Assistente */
```

O menu passa de 240px para 260px e o recolhido de 64px para 72px, para caber os 4 atalhos quadrados e o logo da imagem 01.

- [ ] **Passo 5: rodar os testes e conferir a tela**

Rode `pnpm --filter @escritorio/painel test`. Esperado: todos passam, inclusive `escala.test.ts`.

Depois rode `pnpm --filter @escritorio/painel dev -p 3103` contra o banco local, abra `/inicio` a 1366px e compare com a mesma tela na worktree `treinar-agente`: o tamanho dos textos e do espaçamento tem que ser o mesmo. Se a guarda de `-[Npx]` achar algo, converta para um token ou para a escala na mesma task.

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/app/globals.css apps/painel/src/styles/tokens.css apps/painel/src/styles/escala.test.ts
git commit -m "feat(painel): letra e espaçamento em rem que crescem com a tela (14/15/16px)"
```

---

### Task 4: Plus Jakarta Sans e tamanho de letra por pessoa

**Arquivos:**
- Criar: `apps/painel/src/components/layout/tamanho-letra.ts`
- Criar: `apps/painel/src/components/layout/tamanho-letra.test.ts`
- Criar: `apps/painel/src/components/layout/acoes-perfil.ts`
- Modificar: `apps/painel/src/app/layout.tsx`
- Modificar: `apps/painel/src/styles/tokens.css` (`--font-sans`)
- Modificar: `apps/painel/src/components/layout/menu-usuario.tsx`
- Modificar: `apps/painel/src/lib/sessao.ts` (lê `tamanho_letra`)

**Interfaces:**
- Consome: `public.definir_tamanho_letra(p_tamanho text)`, da Task 1.
- Produz:

```ts
export const COOKIE_LETRA = 'tamanho_letra';
export type TamanhoLetra = 'normal' | 'grande' | 'maior';
export const OPCOES_LETRA: { valor: TamanhoLetra; rotulo: string }[];
export function tamanhoDoValor(v: string | null | undefined): TamanhoLetra;
export function classeDoTamanho(t: TamanhoLetra): string | undefined; // 'letra-grande' | 'letra-maior' | undefined
export function cookieDoTamanho(t: TamanhoLetra): string;
// acoes-perfil.ts ('use server')
export async function definirTamanhoLetra(t: TamanhoLetra): Promise<{ ok: true } | { ok: false; erro: string }>;
// sessao.ts: UsuarioPainel ganha tamanhoLetra: TamanhoLetra
```

- [ ] **Passo 1: teste (falha)**

```ts
// apps/painel/src/components/layout/tamanho-letra.test.ts
import { describe, expect, it } from 'vitest';
import { classeDoTamanho, cookieDoTamanho, OPCOES_LETRA, tamanhoDoValor } from './tamanho-letra';

describe('tamanho da letra', () => {
  it('valor desconhecido, vazio ou de outro formato vira normal', () => {
    for (const v of [undefined, null, '', 'xyz', 'GRANDE', ' grande']) expect(tamanhoDoValor(v)).toBe('normal');
    expect(tamanhoDoValor('grande')).toBe('grande');
    expect(tamanhoDoValor('maior')).toBe('maior');
  });
  it('classe no <html>: normal não põe classe', () => {
    expect(classeDoTamanho('normal')).toBeUndefined();
    expect(classeDoTamanho('grande')).toBe('letra-grande');
    expect(classeDoTamanho('maior')).toBe('letra-maior');
  });
  it('cookie de um ano, no site todo', () => {
    expect(cookieDoTamanho('maior')).toBe('tamanho_letra=maior; Path=/; Max-Age=31536000; SameSite=Lax');
  });
  it('opções na ordem do menu', () => {
    expect(OPCOES_LETRA.map((o) => o.rotulo)).toEqual(['Normal', 'Grande', 'Maior']);
  });
});
```

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/components/layout/tamanho-letra.test.ts`. Esperado: FALHA, porque o módulo não existe.

- [ ] **Passo 3: implementar**

```ts
// apps/painel/src/components/layout/tamanho-letra.ts
// Tamanho da letra da pessoa (spec 4.2). Fica no perfil (usuarios.tamanho_letra) e num cookie, para o <html>
// já nascer com a classe certa no servidor, como o tema.

export const COOKIE_LETRA = 'tamanho_letra';

export type TamanhoLetra = 'normal' | 'grande' | 'maior';

export const OPCOES_LETRA: { valor: TamanhoLetra; rotulo: string }[] = [
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'grande', rotulo: 'Grande' },
  { valor: 'maior', rotulo: 'Maior' },
];

export function tamanhoDoValor(v: string | null | undefined): TamanhoLetra {
  return v === 'grande' || v === 'maior' ? v : 'normal';
}

export function classeDoTamanho(t: TamanhoLetra): string | undefined {
  return t === 'normal' ? undefined : `letra-${t}`;
}

export function cookieDoTamanho(t: TamanhoLetra): string {
  return `${COOKIE_LETRA}=${t}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
```

```ts
// apps/painel/src/components/layout/acoes-perfil.ts
'use server';
import { cookies } from 'next/headers';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { COOKIE_LETRA, tamanhoDoValor, type TamanhoLetra } from './tamanho-letra';

/** Grava o tamanho no perfil (função do banco, só a própria linha) e no cookie lido pelo layout raiz. */
export async function definirTamanhoLetra(t: TamanhoLetra): Promise<{ ok: true } | { ok: false; erro: string }> {
  const tamanho = tamanhoDoValor(t);
  const { error } = await (await supabaseServidor()).rpc('definir_tamanho_letra', { p_tamanho: tamanho });
  if (error) return { ok: false, erro: 'Não deu para guardar o tamanho da letra.' };
  (await cookies()).set(COOKIE_LETRA, tamanho, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  return { ok: true };
}
```

Em `app/layout.tsx`:
- troque `Inter` por `Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['300', '400', '500', '700', '800'], variable: '--font-jakarta', display: 'swap' })`;
- leia o cookie `COOKIE_LETRA` e use `className={cn(jakarta.variable, classeDoTamanho(tamanhoDoValor(cookie)))}` no `<html>`.

Em `tokens.css`, troque o comentário e o valor: `--font-sans: var(--font-jakarta), ui-sans-serif, system-ui, "Segoe UI", sans-serif; /* toda a interface (Plus Jakarta Sans, next/font em app/layout.tsx) */`.

Em `sessao.ts`, o `select` passa a ler `tamanho_letra` e o retorno ganha `tamanhoLetra: tamanhoDoValor(u.tamanho_letra)`.

Em `menu-usuario.tsx`, logo depois do grupo "Tema", acrescente o rótulo `Tamanho da letra` e um `DropdownMenuRadioGroup` com `OPCOES_LETRA`. O valor inicial vem da prop nova `tamanhoLetra`. Ao escolher, o código:
1. troca a classe no `document.documentElement` na hora (remove `letra-grande`/`letra-maior` e põe `classeDoTamanho(novo)`);
2. chama `definirTamanhoLetra(novo)`;
3. em caso de erro, desfaz a classe e mostra `toast.error(r.erro)`, via `sonner`, já usado no projeto.

A prop `tamanhoLetra` vai do `(painel)/layout.tsx` para a `AppShell`, depois para a `Topbar` e por fim para o `MenuUsuario`.

- [ ] **Passo 4: rodar**

Rode `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/app/layout.tsx apps/painel/src/styles/tokens.css apps/painel/src/components/layout apps/painel/src/lib/sessao.ts "apps/painel/src/app/(painel)/layout.tsx"
git commit -m "feat(painel): Plus Jakarta Sans e tamanho da letra por pessoa (Normal, Grande, Maior)"
```

---

### Task 5: Forma dos primitivos (botões, rótulos, tabelas, status e título de tela)

**Arquivos:**
- Modificar: `apps/painel/src/components/ui/button.tsx`, `label.tsx`, `table.tsx`, `card.tsx`
- Modificar: `apps/painel/src/components/patterns/status-badge.tsx`
- Modificar: `apps/painel/src/components/layout/page-header.tsx`
- Criar: `apps/painel/src/components/patterns/status-badge.test.ts`
- Modificar: as telas que já têm o total à mão, para passar `contagem` ao `PageHeader`

**Interfaces:**
- Produz:
  - `Button` com as variantes `grafite` e `success`, além das que já existem;
  - `PageHeader` com as props novas `contagem?: number` e `secao?: string`;
  - `STATUS_DEMANDA[status].cor`, uma classe de texto: `text-info`, `text-brand`, `text-warning` ou `text-success`.

- [ ] **Passo 1: teste (falha)**

```ts
// apps/painel/src/components/patterns/status-badge.test.ts
import { describe, expect, it } from 'vitest';
import { STATUS_DEMANDA } from './status-badge';

describe('status de demanda em texto com ponto (spec 4.2)', () => {
  it('cada status tem rótulo e cor de texto, nunca só cor', () => {
    expect(Object.fromEntries(Object.entries(STATUS_DEMANDA).map(([k, v]) => [k, [v.rotulo, v.cor]]))).toEqual({
      aberto: ['Aberta', 'text-info'],
      em_andamento: ['Em andamento', 'text-brand'],
      aguardando_cliente: ['Aguardando cliente', 'text-warning'],
      concluido: ['Concluída', 'text-success'],
    });
  });
});
```

Os rótulos "Aberta", "Em andamento" etc. **não mudam** nesta parte; a troca para "Nova" e "Resolvendo" é da Parte C.

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/components/patterns/status-badge.test.ts`. Esperado: FALHA, porque `cor` é `undefined`.

- [ ] **Passo 3: implementar**

`status-badge.tsx`:
- `Aparencia` ganha `cor: string` nas três tabelas. Use a mesma cor da `variant` atual: `info` → `text-info`, `brand` → `text-brand`, `warning` → `text-warning`, `success` → `text-success`, `agent-active` → `text-agent-active`, `human-owned` → `text-human-owned`, `neutral` → `text-muted`.
- Para `tipo === 'demanda'`, o componente renderiza:

```tsx
<span className={cn('inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide', a.cor, props.className)}>
  <span aria-hidden className="size-2 rounded-full bg-current" />
  {a.rotulo}
</span>
```

- Conversa e orientação continuam como selo (`Badge`).

`button.tsx`:
- No texto base do `cva`, troque `font-medium` por `font-bold` e acrescente `tracking-wide`. O raio continua `rounded-md`, que agora vale 5px.
- Variantes:
  - `primary`: `uppercase bg-brand text-brand-foreground hover:bg-brand/90`, sem `shadow-sm`;
  - `secondary`: `uppercase ...`;
  - `outline`: `uppercase border border-input bg-surface text-foreground hover:bg-surface-muted`, sem sombra;
  - `danger`: `uppercase ...`, sem sombra;
  - nova `grafite`: `uppercase bg-grafite text-grafite-foreground hover:bg-grafite/90`;
  - nova `success`: `uppercase bg-success text-success-foreground hover:bg-success/90`;
  - `ghost` e `link` ficam sem caixa alta.

`label.tsx`: rótulo de campo em caixa alta, vinho e negrito, com `text-xs font-bold uppercase tracking-wider text-brand`. Antes de trocar, rode `grep -rn "<Label" apps/painel/src | wc -l` e confira no `/_design` que nenhum rótulo dentro de linha de tabela ou de caixa de seleção ficou estranho. Para esses casos, há um `className="normal-case font-medium text-foreground tracking-normal"` explícito onde o Label marca uma caixa de seleção. Rode `grep -rn "Label htmlFor" apps/painel/src | grep -i "checkbox\|switch"` para achar.

`table.tsx`:
- `TableHead`: `text-xs font-bold uppercase tracking-wide text-muted`.
- O contêiner da tabela: `rounded-lg border`, sem sombra.

`card.tsx`: sem `shadow-sm`, só `border`.

`page-header.tsx`:
- Título: `<h1 className="text-3xl font-light text-foreground">{titulo}{contagem !== undefined && <> <strong className="tabular font-extrabold text-brand">{contagem}</strong></>}</h1>`.
- `secao`: quando vier, aparece acima do título como `<p className="text-xs font-bold uppercase tracking-widest text-brand">{secao}</p>`.
- As migalhas continuam como estão (servem às telas de detalhe). A trilha principal passa para a barra do topo na Task 7.

`contagem` nas telas: rode `grep -rn "PageHeader" "apps/painel/src/app/(painel)"` e passe `contagem` só onde a página **já calcula** o total de linhas, sem consulta nova. Hoje são as listas de Clientes, Contatos, Demandas, Usuários e Treinar o agente; confira cada uma. Onde não houver total, fica sem número.

- [ ] **Passo 4: rodar e conferir textos de teste**

Rode `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`. Esperado: tudo passa. Depois, rode `grep -rn "toHaveText\|getByText" apps/painel/e2e | grep -i "aberta\|em andamento\|aguardando cliente\|concluída"` e confira que os textos continuam no DOM. A caixa alta é só CSS, então não muda nada.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/components apps/painel/src/app
git commit -m "feat(painel): botões em caixa alta, rótulos vinho, tabelas sem sombra, status com ponto e títulos 300/800"
```

---

### Task 6: Menu com submenu de Configurações e trilha da rota

**Arquivos:**
- Modificar: `apps/painel/src/lib/menu.ts`
- Modificar: `apps/painel/src/lib/menu.test.ts`
- Criar: `apps/painel/src/components/layout/trilha.ts`
- Criar: `apps/painel/src/components/layout/trilha.test.ts`

**Interfaces:**
- Produz:

```ts
// lib/menu.ts
export type ItemMenu = { rotulo: string; href: string; filhos?: ItemMenu[] };
export function itensDoMenu(u: { papel: 'admin' | 'atendente'; permissoes: string[] }): ItemMenu[];
// components/layout/trilha.ts
export type PassoTrilha = { rotulo: string; href?: string };
export function trilhaDaRota(pathname: string): PassoTrilha[];
```

`sidebar.tsx` passa a importar `ItemMenu` de `@/lib/menu` em vez de declará-lo; isso acontece na Task 7.

- [ ] **Passo 1: testes (falham)**

Em `menu.test.ts`, troque o último `it` por:

```ts
  it('administrador vê Treinar o agente e Configurações; Usuários e permissões fica dentro de Configurações', () => {
    const itens = itensDoMenu({ papel: 'admin', permissoes: [] });
    expect(itens.map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente', 'Configurações']);
    expect(itens.at(-1)!.filhos!.map((f) => [f.rotulo, f.href])).toEqual([
      ['Usuários e permissões', '/usuarios'],
      ['Setores', '/configuracoes#setores'],
      ['Expediente e IA', '/configuracoes#expediente'],
      ['Mensagens', '/configuracoes#mensagens'],
      ['Respostas prontas', '/configuracoes#respostas'],
      ['Feriados', '/configuracoes#feriados'],
    ]);
    expect(itensDoMenu({ papel: 'admin', permissoes: ['assistente_site'] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente', 'Treinar o agente', 'Configurações']);
  });
```

```ts
// apps/painel/src/components/layout/trilha.test.ts
import { describe, expect, it } from 'vitest';
import { trilhaDaRota } from './trilha';

describe('trilha da barra do topo (ícone › Seção › Tela)', () => {
  it.each([
    ['/inicio', [{ rotulo: 'Início' }]],
    ['/atendimento/abc', [{ rotulo: 'Atendimento', href: '/atendimento' }, { rotulo: 'Conversa' }]],
    ['/atendimento', [{ rotulo: 'Atendimento' }]],
    ['/demandas', [{ rotulo: 'Demandas' }]],
    ['/clientes', [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes' }]],
    ['/clientes/123', [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Empresa' }]],
    ['/contatos', [{ rotulo: 'Cadastros' }, { rotulo: 'Contatos' }]],
    ['/assistente', [{ rotulo: 'Assistente' }]],
    ['/treinar-agente', [{ rotulo: 'Treinar o agente' }]],
    ['/configuracoes', [{ rotulo: 'Configurações' }]],
    ['/usuarios', [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões' }]],
    ['/_design', [{ rotulo: 'Catálogo do design' }]],
  ])('%s', (rota, esperado) => {
    expect(trilhaDaRota(rota)).toEqual(esperado);
  });
  it('rota desconhecida devolve trilha vazia (só o ícone de Início)', () => {
    expect(trilhaDaRota('/qualquer')).toEqual([]);
  });
});
```

Antes de fixar os rótulos de detalhe ("Conversa" e "Empresa"), confira as rotas reais com `ls "apps/painel/src/app/(painel)/clientes" "apps/painel/src/app/(painel)/atendimento" "apps/painel/src/app/(painel)/contatos"`. Se existir `/contatos/[id]`, acrescente o caso `['/contatos/9', [Cadastros, Contatos→/contatos, { rotulo: 'Contato' }]]`.

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/lib/menu.test.ts src/components/layout/trilha.test.ts`. Esperado: FALHA.

- [ ] **Passo 3: implementar**

`menu.ts`: o administrador recebe `{ rotulo: 'Configurações', href: '/configuracoes', filhos: SUBMENU_CONFIGURACOES }`, sem o item Usuários no primeiro nível. `SUBMENU_CONFIGURACOES` é uma constante com os 6 filhos na ordem do teste. O comentário do topo explica que "Prazos" entra na Parte C.

`trilha.ts`: uma tabela `SECOES: { prefixo: string; trilha: PassoTrilha[]; detalhe?: string }[]`, percorrida do prefixo mais longo para o mais curto. Numa rota com subcaminho (por exemplo, `/clientes/123`), o último passo da seção ganha `href` e entra o rótulo de detalhe. Grupo "Cadastros": Clientes e Contatos. Para `/usuarios`, a trilha é Configurações → Usuários e permissões. Sem `href` no último passo.

- [ ] **Passo 4: rodar**

Rode `pnpm --filter @escritorio/painel test`. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/lib/menu.ts apps/painel/src/lib/menu.test.ts apps/painel/src/components/layout/trilha.ts apps/painel/src/components/layout/trilha.test.ts
git commit -m "feat(painel): Configurações com submenu (Usuários e permissões dentro) e trilha pela rota"
```

---

### Task 7: Casca nova (menu grafite, atalhos, submenu, Recolher e barra do topo)

**Arquivos:**
- Criar: `apps/painel/src/lib/escritorio.ts`
- Criar: `apps/painel/src/components/layout/atalhos-menu.tsx`
- Reescrever: `apps/painel/src/components/layout/sidebar.tsx`
- Modificar: `apps/painel/src/components/layout/topbar.tsx`, `app-shell.tsx`, `menu-usuario.tsx`
- Modificar: `apps/painel/src/app/(painel)/layout.tsx`
- Modificar: `apps/painel/e2e/configuracoes.spec.ts` (linha 49)

**Interfaces:**
- Consome:
  - `ItemMenu` e `itensDoMenu` (Task 6);
  - `trilhaDaRota` (Task 6);
  - `TamanhoLetra` (Task 4);
  - `lerSinaisVida(sb): Promise<SinaisVida | null>` e `situacaoDoSinal(ultimo)`, que já existem em `src/lib/inicio.ts` e `src/lib/sinal-vida.ts`.
- Produz:

```ts
// lib/escritorio.ts
export const NOME_ESCRITORIO = 'Escritório Contábil'; // troque quando o dono enviar o nome/logo
export const MONOGRAMA = 'EC';
// AppShell ganha: whatsapp: SituacaoSinal | null; tamanhoLetra: TamanhoLetra
```

**Como cada peça fica (siga a imagem `01-menu-e-clientes-arquivar.png`):**

| Peça | Classes e comportamento |
|---|---|
| `<aside>` (app-shell) | `bg-sidebar text-sidebar-foreground border-r border-sidebar-border`. Larguras `w-sidebar` e `w-sidebar-recolhida`, como hoje. |
| Topo | Monograma centralizado: `size-20 rounded-full bg-brand text-brand-foreground ring-4 ring-champagne font-extrabold text-2xl`, com `aria-hidden`. O nome `NOME_ESCRITORIO` fica em `sr-only` e vira `title` do monograma. Recolhido: `size-10`, `text-base`, `ring-2`. |
| Atalhos (`atalhos-menu.tsx`) | 4 quadrados `size-9 rounded-md border-2 bg-sidebar-raised inline-flex items-center justify-center`, cada um com a borda na cor do módulo. **Início**: `Link` para `/inicio`, `border-modulo-inicio`, `aria-label="Início"`, ícone `House`. **Meu perfil**: abre o mesmo menu da pessoa (o `MenuUsuario` aceita um `gatilho` personalizado), `border-modulo-clientes`, `aria-label="Meu perfil"`, ícone `UserRound`. **WhatsApp**: para o administrador, um `Link` para `/configuracoes#integracoes`, com `aria-label` `WhatsApp: ${ROTULO_SITUACAO[situacao]}` e um ponto `size-2 rounded-full` no canto (`bg-success` para ok, `bg-warning-decor` para atrasado, `bg-danger` para parado ou sem sinal). Para quem não é administrador, um `span` sem ponto, `aria-label="WhatsApp"` e `title="O estado do WhatsApp só o administrador vê"`. Ícone `MessageCircle` e `border-modulo-atendimento`. **Sair**: `<form action={sair}><button type="submit" aria-label="Sair" ...>`, com `border-danger` e ícone `Power`. Aberto: os 4 numa fileira centralizada com `gap-2`. Recolhido: os 4 empilhados. |
| Itens | `ul` sem `gap`. Cada `li` tem `border-b border-sidebar-border`. Link: `flex h-12 items-center gap-3 px-5 text-lg`. Ícone `size={18}`, `strokeWidth={1.75}`, `className={cn('shrink-0', COR_MODULO[href])}`, com `COR_MODULO` mapeando cada href para `text-modulo-*`. O contador fica à direita: `tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-xs font-bold text-danger-foreground`. Atendimento (fila esperando) usa `bg-danger`; Demandas usa `bg-sidebar-raised text-sidebar-foreground`. Os mesmos `aria-describedby` de hoje. |
| Ativo | `aria-current="page"`, `relative bg-brand text-brand-foreground font-medium` e o fio `before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-champagne`. **Atenção:** `w-[3px]` é valor arbitrário e a guarda da Task 3 barra. Use `before:w-0.75`, que dá 3px pela grade, e o ícone fica `text-brand-foreground`. Hover dos não ativos: `hover:bg-sidebar-raised`. O ativo do pai Configurações vale para `/configuracoes` e para `/usuarios`. |
| Submenu (só Configurações) | Desktop: o item é um `DropdownMenu` (Radix) com `side="right" align="start"`. O gatilho mostra o rótulo e um `ChevronRight`, com `aria-label="Configurações: abrir submenu"`. Dentro: `DropdownMenuContent` com `bg-sidebar-raised text-sidebar-foreground border-sidebar-border`, um `DropdownMenuItem asChild` com `Link` para cada filho e, como primeiro item, "Todas as configurações" levando a `/configuracoes`. Gaveta (`onNavegar` presente): o item vira um botão com `aria-expanded`, que mostra os filhos logo abaixo, recuados (`pl-12`), com o mesmo estilo. |
| Rodapé | Botão "Recolher" com `PanelLeftClose` (aberto) ou `PanelLeftOpen` (recolhido) e texto em `sr-only` quando recolhido: `flex h-11 w-full items-center gap-2 border-t border-sidebar-border px-5 text-sm text-sidebar-foreground/80 hover:text-sidebar-foreground`. Mantenha `aria-label` em "Recolher menu"/"Expandir menu" e `aria-expanded`, como hoje (o estado continua no cookie `menu_recolhido`). |
| Recolhido | Só ícones centralizados, com o `Tooltip` atual, e o ponto do contador como hoje, trocando `ring-surface` por `ring-sidebar`. |
| Topbar | À esquerda, o botão da gaveta (lg:hidden) e a trilha: `nav aria-label="Trilha"`, com `Link` para `/inicio` contendo `House` (`aria-label="Início"`), depois `ChevronRight` (`size={14}`) e cada passo de `trilhaDaRota(pathname)`. Os passos do meio são `text-muted` (link quando têm `href`); o último é `font-bold text-foreground` com `aria-current="page"`. À direita, `BuscaGlobal` (largura `w-72` a partir de `md`), `AgentStateIndicator` e `MenuUsuario`. Fundo `bg-surface` e `border-b`. |

**Passos:**

- [ ] **Passo 1: ajustar o teste de tela que procura "Usuários"**

Em `apps/painel/e2e/configuracoes.spec.ts:49`, troque `await page.getByRole('link', { name: 'Usuários' }).click();` por:

```ts
  await page.getByRole('button', { name: 'Configurações: abrir submenu' }).click();
  await page.getByRole('menuitem', { name: 'Usuários e permissões' }).click();
```

Rode `grep -rn "name: 'Usuários'\|'/usuarios'" apps/painel/e2e` e trate outras ocorrências do mesmo jeito.

- [ ] **Passo 2: implementar `escritorio.ts`, `atalhos-menu.tsx` e `sidebar.tsx`, conforme a tabela**

Ícones por href: Início `LayoutGrid`, Atendimento `MessageCircle`, Demandas `ClipboardCheck`, Clientes `Building2`, Contatos `Contact`, Assistente `Sparkles`, Treinar o agente `GraduationCap`, Configurações `Settings`. São ícones do lucide, não os do Acessórias.

- [ ] **Passo 3: Topbar, AppShell e layout**

Em `(painel)/layout.tsx`:
- some `lerSinaisVida(sb)` ao `Promise.all` e passe `whatsapp={sinais ? situacaoDoSinal(sinais.whatsapp) : null}`;
- passe também `tamanhoLetra={u.tamanhoLetra}`.

`AppShell`:
- repassa `whatsapp` para as duas `Sidebar` (a fixa e a da gaveta);
- repassa `tamanhoLetra` para a `Topbar`.

`MenuUsuario`:
- extraia o conteúdo do `DropdownMenuContent` para `ConteudoMenuUsuario`, usado pelo menu da barra do topo e pelo atalho "Meu perfil" (dois `DropdownMenu` com o mesmo conteúdo);
- o atalho usa `side="right"`.

- [ ] **Passo 4: rodar tudo o que já existe**

Rode `pnpm --filter @escritorio/painel test`, `pnpm --filter @escritorio/painel typecheck` e depois `pnpm --filter @escritorio/painel e2e` (com o Supabase local ligado; o Playwright sobe o painel na porta 3100). Esperado: todos os testes passam, inclusive `acessibilidade.spec.ts` nos dois temas, sem violação séria ou crítica.

Se o axe apontar contraste no menu, o problema está no token, não na classe: volte à Task 2, ajuste o valor e acrescente o par em `PARES`.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src apps/painel/e2e/configuracoes.spec.ts
git commit -m "feat(painel): menu grafite com atalhos, faixa vinho no ativo, submenu de Configurações e trilha no topo"
```

---

### Task 8: Janelas de confirmação

**Arquivos:**
- Modificar: `apps/painel/src/components/patterns/confirmacao.ts`
- Modificar: `apps/painel/src/components/patterns/confirmacao.test.ts`
- Modificar: `apps/painel/src/components/patterns/confirm-dialog.tsx`
- Modificar: os usos de `ConfirmDialog`, só para passar `tipo` onde o sentido é claro. Rode `grep -rn "<ConfirmDialog" apps/painel/src` para achar.

**Interfaces:**
- Produz:

```ts
export type TipoConfirmacao = 'arquivar' | 'excluir' | 'concluir' | 'perigo' | 'neutro';
export const APARENCIA_CONFIRMACAO: Record<TipoConfirmacao, { anel: string; icone: string; botao: 'primary' | 'grafite' | 'success' | 'danger' }>;
export function tipoPadrao(variante: 'primary' | 'danger' | undefined): TipoConfirmacao; // danger → 'perigo', resto → 'neutro'
// ConfirmDialog ganha a prop opcional tipo?: TipoConfirmacao
```

- [ ] **Passo 1: teste (falha)**

Acrescente a `confirmacao.test.ts`:

```ts
import { APARENCIA_CONFIRMACAO, tipoPadrao } from './confirmacao';

describe('aparência da confirmação (spec 4.5)', () => {
  it('arquivar champanhe com botão vinho, excluir grafite, concluir verde', () => {
    expect(APARENCIA_CONFIRMACAO.arquivar).toEqual({ anel: 'border-champagne', icone: 'text-champagne-text', botao: 'primary' });
    expect(APARENCIA_CONFIRMACAO.excluir).toEqual({ anel: 'border-grafite', icone: 'text-foreground', botao: 'grafite' });
    expect(APARENCIA_CONFIRMACAO.concluir).toEqual({ anel: 'border-success', icone: 'text-success', botao: 'success' });
    expect(APARENCIA_CONFIRMACAO.perigo).toEqual({ anel: 'border-danger', icone: 'text-danger', botao: 'danger' });
    expect(APARENCIA_CONFIRMACAO.neutro).toEqual({ anel: 'border-brand', icone: 'text-brand', botao: 'primary' });
  });
  it('sem tipo, a variante antiga decide', () => {
    expect(tipoPadrao('danger')).toBe('perigo');
    expect(tipoPadrao('primary')).toBe('neutro');
    expect(tipoPadrao(undefined)).toBe('perigo'); // o padrão de hoje do ConfirmDialog é danger
  });
});
```

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/components/patterns/confirmacao.test.ts`. Esperado: FALHA.

- [ ] **Passo 3: implementar**

Em `confirmacao.ts`, as duas exportações acima, com o comentário de uma linha dizendo a regra.

Em `confirm-dialog.tsx`:
- `tipo = props.tipo ?? tipoPadrao(variante)` e `ap = APARENCIA_CONFIRMACAO[tipo]`;
- ícone por tipo: `Archive` (arquivar), `Trash2` (excluir), `CircleCheck` (concluir), `TriangleAlert` (perigo), `CircleHelp` (neutro);
- o `DialogContent` fica centralizado e com texto centralizado: `className="max-w-md text-center"`.

O cabeçalho fica assim:

```tsx
<div aria-hidden className={cn('mx-auto flex size-20 items-center justify-center rounded-full border-4', ap.anel)}>
  <Icone size={40} strokeWidth={1.5} className={ap.icone} />
</div>
<DialogTitle className="text-2xl font-light">{titulo}</DialogTitle>
```

O título continua `ReactNode`. Quem chama passa, por exemplo, `<>Arquivar <strong className="font-extrabold">{nome}</strong>?</>`.

A descrição fica em `text-base text-muted`.

O campo de digitar vem antes dos botões:
- `Label` "Digite o nome para confirmar", com `className="normal-case font-normal tracking-normal text-muted"`;
- `Input` com `aria-describedby` apontando para um `sr-only` com o nome esperado ("Nome esperado: X"), para quem usa leitor de tela saber o que digitar.

Os botões ficam centralizados (`DialogFooter className="justify-center"`):
- "Cancelar": `variant="outline"` com `className="rounded-pill px-6"`;
- ação: `variant={ap.botao}` com `className="rounded-pill px-6"`.

Os nomes acessíveis continuam iguais ("Cancelar" e o `confirmar` que chega por prop).

Nos usos existentes, passe `tipo="concluir"` em concluir demanda. Pausar agente fica no padrão. "Apagar dados (LGPD)" usa `tipo="excluir"`; confira com `grep -rn "Apagar dados" apps/painel/src`.

- [ ] **Passo 4: rodar**

Rode `pnpm --filter @escritorio/painel test`, `pnpm --filter @escritorio/painel typecheck` e depois `pnpm --filter @escritorio/painel exec playwright test e2e/contatos.spec.ts e2e/demandas.spec.ts`. Esses dois cobrem LGPD e concluir. Esperado: tudo passa.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/components/patterns "apps/painel/src/app/(painel)"
git commit -m "feat(painel): janelas de confirmação com ícone circular por tipo e botões pílula"
```

---

### Task 9: Login "Faixa vinho", aviso do login, Esqueci a senha e campo em Configurações

**Arquivos:**
- Reescrever: `apps/painel/src/app/entrar/page.tsx`
- Criar: `apps/painel/src/app/entrar/aviso-login.ts`
- Criar: `apps/painel/src/app/entrar/aviso-login.test.ts`
- Modificar: `apps/painel/src/app/entrar/acoes.ts` (cookie de letra no login)
- Criar: `apps/painel/src/app/esqueci-senha/page.tsx`
- Criar: `apps/painel/src/app/esqueci-senha/acoes.ts`
- Modificar: `apps/painel/src/middleware.ts` (`/esqueci-senha` pública)
- Modificar: `apps/painel/src/app/(painel)/configuracoes/esquemas.ts` e `esquemas.test.ts`, `acoes.ts`, `page.tsx`
- Criar: `supabase/templates/recuperar-senha.html`
- Modificar: `supabase/config.toml`
- Modificar: `apps/painel/e2e/login.spec.ts`

**Interfaces:**
- Consome:
  - `public.aviso_login()` (Task 1);
  - `cookieDoTamanho`/`COOKIE_LETRA`/`tamanhoDoValor` (Task 4);
  - `NOME_ESCRITORIO` e `MONOGRAMA` (Task 7);
  - variante `grafite` (Task 5);
  - o ponto de quebra `login:` (Task 3).
- Produz:

```ts
// entrar/aviso-login.ts
export function avisoParaMostrar(texto: string | null | undefined): string | null; // aparado; vazio → null; nunca mais de 200
// configuracoes/esquemas.ts
export const esquemaAvisoLogin: z.ZodType<{ aviso_login: string }>; // trim, máx. 200
// configuracoes/acoes.ts
export async function salvarAvisoLogin(formData: FormData): Promise<void>;
```

- [ ] **Passo 1: testes (falham)**

```ts
// apps/painel/src/app/entrar/aviso-login.test.ts
import { describe, expect, it } from 'vitest';
import { avisoParaMostrar } from './aviso-login';

describe('aviso da tela de entrada', () => {
  it('vazio, nulo ou só espaços não mostra', () => {
    for (const v of [null, undefined, '', '   \n ']) expect(avisoParaMostrar(v)).toBeNull();
  });
  it('apara e corta em 200 caracteres', () => {
    expect(avisoParaMostrar('  DCTFWeb vence dia 15.  ')).toBe('DCTFWeb vence dia 15.');
    expect(avisoParaMostrar('x'.repeat(250))).toHaveLength(200);
  });
});
```

Em `esquemas.test.ts`, acrescente:

```ts
describe('esquemaAvisoLogin', () => {
  it('apara, aceita vazio e até 200 caracteres', () => {
    expect(esquemaAvisoLogin.parse({ aviso_login: '  Oi  ' })).toEqual({ aviso_login: 'Oi' });
    expect(esquemaAvisoLogin.parse({ aviso_login: '' })).toEqual({ aviso_login: '' });
    expect(esquemaAvisoLogin.safeParse({ aviso_login: 'x'.repeat(201) }).success).toBe(false);
  });
});
```

Em `login.spec.ts`, acrescente:

```ts
test('aviso do administrador aparece na tela de entrada; vazio não aparece; HTML vira texto', async ({ page }) => {
  await db.from('configuracoes').update({ aviso_login: 'DCTFWeb vence dia 15. <b>Fiscal</b>' }).eq('id', 1);
  await page.goto('/entrar');
  await expect(page.getByText('DCTFWeb vence dia 15. <b>Fiscal</b>')).toBeVisible();
  await db.from('configuracoes').update({ aviso_login: '' }).eq('id', 1);
  await page.goto('/entrar');
  await expect(page.getByTestId('aviso-login')).toHaveCount(0);
});

test('Esqueci a senha leva à tela de pedir nova senha', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Esqueci a senha' }).click();
  await expect(page).toHaveURL(/\/esqueci-senha/);
  await page.getByLabel('E-mail').fill('ninguem@teste.com');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText('Se o e-mail estiver cadastrado, o link chega em instantes.')).toBeVisible();
});
```

Importe `db` de `./apoio` no topo do arquivo.

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/app/entrar "src/app/(painel)/configuracoes/esquemas.test.ts"`. Esperado: FALHA.

- [ ] **Passo 3: implementar**

`aviso-login.ts`: `const t = (texto ?? '').trim(); return t ? t.slice(0, 200) : null;`, com um comentário de uma linha.

`entrar/page.tsx`, seguindo `00-login.png`:
- `main className="relative min-h-dvh bg-surface"`.
- Faixas: a partir de `login:`, duas `div aria-hidden` fixas à esquerda: `fixed inset-y-0 left-0 w-7 bg-brand` (28px) e `fixed inset-y-0 left-7 w-2.5 bg-champagne` (10px). Abaixo de 900px, uma barra no topo: `h-2 bg-brand` e `h-1 bg-champagne`.
- Grade: `login:grid login:grid-cols-2 login:items-center login:gap-16 min-h-dvh px-6 py-12 login:pl-40 login:pr-24`.
- Coluna esquerda:
  - monograma `size-11 rounded-lg bg-brand text-brand-foreground font-extrabold` mais `NOME_ESCRITORIO` (`font-bold`);
  - `<p className="mt-12 text-sm font-bold uppercase tracking-widest text-brand">Acesso da equipe</p>`;
  - `<h1 className="mt-4 text-display font-light">Painel da <strong className="block font-extrabold">equipe</strong></h1>`;
  - o recado, quando houver: `<p data-testid="aviso-login" className="mt-10 max-w-md border-l-4 border-champagne pl-5 text-lg text-muted">{aviso}</p>`. O texto entra como filho, então o React escapa o HTML.
- Coluna direita (`max-w-md w-full login:justify-self-end`):
  - o erro (`role="alert"`) como hoje;
  - o formulário com os campos sublinhados: `Input` com `className="rounded-none border-0 border-b-2 border-grafite bg-transparent px-0 shadow-none focus-visible:border-brand focus-visible:outline-none"`. Sem anel de foco, a borda vinho de 2px é o foco visível. Confira que o axe não reclama;
  - os `Label` "E-mail" e "Senha" com `className="text-xs tracking-widest text-muted"` (caixa alta e negrito herdados);
  - a linha final: `Link href="/esqueci-senha" className="text-sm text-muted underline"` "Esqueci a senha" e `Button variant="grafite" className="h-12 rounded-md px-10 normal-case text-base"` "Entrar".
- O aviso vem do servidor: `const { data } = await sb.rpc('aviso_login'); const aviso = avisoParaMostrar(data);`. Em erro, `aviso = null` e a página nunca quebra por causa do recado.
- Mantenha os `id`, `name`, `autoComplete` e os textos de `ERROS`. Acrescente `link: 'O link expirou ou já foi usado. Peça outro em "Esqueci a senha".'`.

`entrar/acoes.ts`: depois do login dar certo, leia `usuarios.tamanho_letra` da pessoa e grave o cookie `COOKIE_LETRA` com `tamanhoDoValor(...)`, para o tamanho seguir a pessoa mesmo noutro computador.

`esqueci-senha/page.tsx`:
- mesmo esqueleto visual do login, com as faixas e só a coluna da direita;
- título "Esqueci a senha", campo E-mail e botão `grafite` "Enviar link";
- com `?enviado=1`, mostra "Se o e-mail estiver cadastrado, o link chega em instantes." e um link "Voltar para a entrada".

`esqueci-senha/acoes.ts`:

```ts
'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Manda o e-mail de recuperação; a resposta é a mesma exista ou não a conta (não revela quem é cadastrado). */
export async function pedirNovaSenha(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const origem = (await headers()).get('origin') ?? '';
  if (email) await (await supabaseServidor()).auth.resetPasswordForEmail(email, { redirectTo: `${origem}/auth/confirm` });
  redirect('/esqueci-senha?enviado=1');
}
```

`middleware.ts`: `PUBLICAS` ganha `'/esqueci-senha'`.

`supabase/templates/recuperar-senha.html`:

```html
<h2>Nova senha do painel do escritório</h2>
<p>Clique no link abaixo para definir uma nova senha:</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Definir nova senha</a></p>
<p>Se não foi você quem pediu, ignore este e-mail.</p>
```

`config.toml`: acrescente, ao lado do convite:

```toml
[auth.email.template.recovery]
subject = "Nova senha do painel do escritório"
content_path = "./supabase/templates/recuperar-senha.html"
```

Configurações:
- `esquemaAvisoLogin = z.object({ aviso_login: z.string().trim().max(200, 'Até 200 caracteres.') })`;
- `salvarAvisoLogin`: `exigirAdmin`, `esquemaAvisoLogin.safeParse`. Em erro, use o mesmo `redirect` com `?erro=` que as outras ações do arquivo usam (siga o padrão de `checar` e `recarregar` que já está ali). Grave `configuracoes.aviso_login`;
- na seção `#mensagens` de `page.tsx`, abaixo do formulário das mensagens automáticas, entra um segundo `FormularioAlteravel action={salvarAvisoLogin}` com `FormField id="aviso_login" rotulo="Aviso na tela de entrada" ajuda="Até 200 caracteres. Vazio não mostra nada. Nunca coloque dados de clientes."`, `Textarea name="aviso_login" maxLength={200} rows={2}` e `RodapeSalvar rotulo="Salvar aviso"`;
- a página já lê `configuracoes`, então acrescente `aviso_login` ao `select`.

- [ ] **Passo 4: rodar**

Rode:
- `pnpm --filter @escritorio/painel test`
- `pnpm --filter @escritorio/painel typecheck`
- `supabase stop && supabase start`, para ler o template novo, e depois `supabase migration up`
- `pnpm --filter @escritorio/painel exec playwright test e2e/login.spec.ts e2e/configuracoes.spec.ts e2e/acessibilidade.spec.ts`

Esperado: tudo passa. A auditoria de acessibilidade já visita `/entrar` e `/entrar?erro=credenciais` nos dois temas. Acrescente `/esqueci-senha` ao mesmo trecho (por volta da linha 96).

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src apps/painel/e2e supabase/templates/recuperar-senha.html supabase/config.toml
git commit -m "feat(painel): login Faixa vinho com aviso do administrador e Esqueci a senha"
```

---

### Task 10: Catálogo, guia, testes de tela grande e capturas

**Arquivos:**
- Modificar: `apps/painel/src/app/(painel)/%5Fdesign/page.tsx`, `padroes.tsx`, `demos-padroes.tsx`
- Modificar: `docs/design-system.md`
- Criar: `apps/painel/e2e/identidade.spec.ts`
- Criar: `apps/painel/e2e/capturas.spec.ts`

**Interfaces:** consome tudo o que veio antes.

- [ ] **Passo 1: testes de tela (falham)**

```ts
// apps/painel/e2e/identidade.spec.ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';

const tamanho = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

test.describe('letra que acompanha a tela (spec 4.2)', () => {
  test.beforeEach(async () => {
    await criarUsuarioTeste({ email: 'letra@teste.com', senha: 'senha-forte-123', nome: 'Letra Teste', papel: 'atendente' });
  });

  test('14px em 1366, 16px em 1920 e 2560; o menu cresce junto', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await entrar(page, 'letra@teste.com', 'senha-forte-123');
    expect(await tamanho(page)).toBe('14px');
    const menu1366 = (await page.locator('aside').boundingBox())!.width;
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect(await tamanho(page)).toBe('16px');
    const menu1920 = (await page.locator('aside').boundingBox())!.width;
    expect(menu1920 / menu1366).toBeCloseTo(16 / 14, 1);
    await page.setViewportSize({ width: 2560, height: 1440 });
    expect(await tamanho(page)).toBe('16px');
  });

  test('Tamanho da letra Grande soma 1px, fica depois de recarregar e volta no próximo login', async ({ page, context }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await entrar(page, 'letra@teste.com', 'senha-forte-123');
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    await page.getByRole('menuitemradio', { name: 'Grande' }).click();
    expect(await tamanho(page)).toBe('15px');
    await page.reload();
    expect(await tamanho(page)).toBe('15px');
    await context.clearCookies();
    await entrar(page, 'letra@teste.com', 'senha-forte-123');
    expect(await tamanho(page)).toBe('15px');
  });

  test('cookie de letra estranho vira normal', async ({ page, context }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await context.addCookies([{ name: 'tamanho_letra', value: 'xyz', url: 'http://localhost:3100' }]);
    await page.goto('/entrar');
    expect(await tamanho(page)).toBe('14px');
  });
});

test('item ativo do menu: faixa vinho e nome acessível igual ao de antes', async ({ page }) => {
  await criarUsuarioTeste({ email: 'menu@teste.com', senha: 'senha-forte-123', nome: 'Menu Teste', papel: 'admin' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await entrar(page, 'menu@teste.com', 'senha-forte-123');
  await page.goto('/clientes');
  await expect(page.getByRole('link', { name: 'Clientes', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Trilha' })).toContainText('Cadastros');
  await expect(page.getByRole('link', { name: 'Início' }).first()).toBeVisible();
});
```

No terceiro teste, o cookie usa a porta `E2E_PORTA` (padrão 3100). Use `process.env.E2E_PORTA ?? '3100'` para montar a URL.

```ts
// apps/painel/e2e/capturas.spec.ts
import { test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';

// Capturas para o dono aprovar (spec 4.7). Só roda com CAPTURAS=1; saem em test-results/capturas/.
test.skip(!process.env.CAPTURAS, 'capturas só sob demanda (CAPTURAS=1)');

const TELAS = [['login', '/entrar'], ['inicio', '/inicio'], ['atendimento', '/atendimento'], ['demandas', '/demandas'], ['clientes', '/clientes'], ['configuracoes', '/configuracoes']] as const;

for (const largura of [1366, 1920, 2560]) {
  for (const tema of ['claro', 'escuro'] as const) {
    test(`capturas ${largura} ${tema}`, async ({ page, context }) => {
      await criarUsuarioTeste({ email: 'capturas@teste.com', senha: 'senha-forte-123', nome: 'Ana Souza', papel: 'admin' });
      await page.setViewportSize({ width: largura, height: Math.round(largura * 0.5625) });
      await context.addCookies([{ name: 'tema', value: tema, url: `http://localhost:${process.env.E2E_PORTA ?? '3100'}` }]);
      await page.goto('/entrar');
      await page.screenshot({ path: `test-results/capturas/${largura}-${tema}-login.png` });
      await entrar(page, 'capturas@teste.com', 'senha-forte-123');
      for (const [nome, rota] of TELAS.slice(1)) {
        await page.goto(rota);
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: `test-results/capturas/${largura}-${tema}-${nome}.png` });
      }
    });
  }
}
```

- [ ] **Passo 2: rodar `identidade.spec.ts`**

Rode `pnpm --filter @escritorio/painel exec playwright test e2e/identidade.spec.ts`. Esperado: passa, porque as Tasks 3, 4, 6 e 7 já entregaram o comportamento. Se falhar, conserte na task dona do comportamento e anote no ledger.

- [ ] **Passo 3: `/_design` e guia**

No `/_design`:
- "Cores" mostra os grupos novos: menu, champanhe, grafite e módulos;
- "Tipografia" mostra a escala com `text-3xl` e `text-display` e o título "Clientes **124**";
- uma seção nova "Menu" mostra um recorte da `Sidebar` estática (itens fixos, um ativo e o submenu aberto);
- "Confirmações" mostra os 5 tipos do `ConfirmDialog`;
- "Status de demanda" mostra os 4 status com ponto.

No `docs/design-system.md`, atualize:
- "Trocar a cor da marca": vinho padrão;
- "Raio e fonte": Plus Jakarta Sans, `--font-jakarta`, raios 4/5/8 e pílula 18;
- a escala: 12, 13, 14, 16, 20, 24, 32 e 64 na base 14, em rem;
- uma seção nova "Letra que acompanha a tela" (14/15/16px, `letra-grande`/`letra-maior`, por que tudo é rem e o teste de guarda);
- "Regras de estilo": caixa alta só por CSS, rótulos vinho, status com ponto, sem sombra decorativa, ícones 16 nas linhas e 18 no menu;
- "Quando usar": atalhos do menu, trilha e `escritorio.ts`.

- [ ] **Passo 4: suíte inteira do painel e do banco**

Rode:
- `pnpm --filter @escritorio/painel test`
- `pnpm --filter @escritorio/painel typecheck`
- `pnpm --filter @escritorio/painel e2e`
- `supabase test db`

Esperado: tudo passa, com o resultado real copiado no ledger.

- [ ] **Passo 5: commit**

```bash
git add apps/painel docs/design-system.md
git commit -m "docs(painel): catálogo e guia da identidade nova; testes de tela grande e capturas"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real das suítes:** painel com test, typecheck e e2e com axe nos dois temas; banco com `supabase test db`. Mostre ao dono os números exatos.
2. **Capturas:** rode `CAPTURAS=1 pnpm --filter @escritorio/painel exec playwright test e2e/capturas.spec.ts` contra o banco local, com dados de exemplo. Compare login, menu e confirmação com `imagens/00-login.png`, `00-login-tela-grande.png`, `01-...` e `02-...`, e liste as diferenças.
3. **Homologação:**
   - rode `supabase db push --db-url "$DATABASE_URL" --dry-run` com o `.env.homologacao` e **mostre ao dono**;
   - só com o "ok" dele, aplique;
   - lembre o dono do modelo de e-mail de recuperação no painel do Supabase (decisão 3).
4. **Subir para o dono ver:** painel desta worktree na porta 3003, apontando para a homologação. Use o mesmo jeito do `ligar-teste.ps1`, com as variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p 3003` rodando nesta worktree. Passe o endereço `http://localhost:3003`.
5. **Pendências** para listar no fim:
   - logo do escritório e texto do aviso (dono);
   - modelo de e-mail na homologação;
   - telas que ainda não usam `contagem`;
   - o que ficou diferente das imagens.
6. **Não juntar** a branch em nada. Parar e esperar "próxima parte".
