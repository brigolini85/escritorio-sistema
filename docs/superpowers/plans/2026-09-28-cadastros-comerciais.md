# Cadastros comerciais por empresa — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada empresa atendida ganha, na ficha do painel, cadastros de clientes (redes e unidades com palavras-chave), fornecedores, produtos, preços por rede e documentos; o agente usa esses cadastros, por busca feita em código, para montar demandas de nota prontas para emitir e enviar documentos liberados.

**Architecture:** Tabelas novas no Supabase com `cliente_id`, chaves compostas e RLS; preço só por função `definir_preco`. Busca pura em `@escritorio/core` (normalização + pontuação por palavra igual). Repositórios em `@escritorio/db` filtram sempre pela empresa em foco. Ferramentas novas do agente (`buscar_parceiros`, `buscar_produtos`, `abrir_pedido_nota`, `listar_documentos`, `enviar_documento`) no trabalhador; resumo da demanda montado por função pura. Painel: ficha do cliente em abas.

**Tech Stack:** Supabase (Postgres 17, RLS, Storage, pgTAP), TypeScript 5, Vitest 3, Next.js 15 (App Router, Server Actions), Playwright, zod 3, @anthropic-ai/sdk.

**Spec:** `docs/superpowers/specs/2026-09-28-cadastros-comerciais-design.md` (e o spec base `docs/superpowers/specs/2026-09-27-etapas-1-2-atendimento-notas-design.md`).

## Global Constraints

- Todo texto visto por clientes e pela equipe em **português do Brasil**.
- RLS habilitado em **toda** tabela nova e política explícita no bucket `documentos`.
- A IA **não** fornece preço: preço vem da tabela vigente, preenchido pelo código. O agente **não informa preços** ao cliente pelo WhatsApp.
- Toda consulta do agente aos cadastros filtra pelo `cliente_id` da **empresa em foco**; id de outra empresa é recusado.
- Busca: palavra conta só se for **igual** (após minúsculas, sem acento, sem pontuação); máximo 5 candidatos; empate devolve todos os empatados.
- Preço por **rede** (grupo do tipo `cliente`); um único preço vigente por rede e produto; histórico preservado.
- Documento só é enviado pela IA se `ia_pode_enviar = true` e for da empresa em foco.
- Palavras-chave e apelidos no painel: digitados separados por vírgula.
- Nunca rodar os testes do trabalhador/db (que chamam `limparBanco`) enquanto o dono estiver testando no banco local; parar o trabalhador local (porta 3001) antes de rodá-los.
- Todo commit termina com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comandos: `pnpm` e `supabase` ficam em `$HOME/bin` (`export PATH="$HOME/bin:$PATH"`).

## Review Focus

1. **Mesma palavra-chave em duas unidades** (ex.: "centro" cadastrado em duas redes): a busca devolve as duas e o agente pergunta. → teste de empate na Task 2 e na Task 4.
2. **Unidade ou rede desativada** continua no banco mas não pode ser escolhida pela busca. → teste na Task 3.
3. **Preço alterado duas vezes seguidas**: fica um único vigente e o anterior vai para o histórico. → pgTAP na Task 1.
4. **Agente manda unidade de fornecedor num pedido de venda** (ou unidade de outra empresa): recusado com erro. → teste na Task 5.
5. **Pedido de documento de outra empresa pelo id**: recusado. → teste na Task 6.

---

### Task 1: Banco — tabelas, RLS, preço com histórico, auditoria e bucket de documentos

**Files:**
- Create: `supabase/migrations/20260928000400_cadastros_comerciais.sql`
- Create: `supabase/tests/06_cadastros_comerciais.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regenerado)

**Interfaces:**
- Produces (tabelas): `parceiros_grupos`, `parceiros_unidades`, `produtos`, `precos`, `documentos_empresa`; enum `tipo_parceiro` (`cliente` | `fornecedor`); bucket `documentos` (caminho `clientes/{cliente_id}/{arquivo}`).
- Produces (função): `definir_preco(p_grupo uuid, p_produto uuid, p_valor numeric) returns uuid`.

- [ ] **Step 1: Teste pgTAP que falha**

`supabase/tests/06_cadastros_comerciais.test.sql`:
```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000b', 'ana@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000d', 'bia@pgtap.local'),
  ('00000000-0000-0000-0000-00000000000f', 'paulo@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-00000000000b', 'Ana', 'ana@pgtap.local', 'atendente', '{}'),
  ('00000000-0000-0000-0000-00000000000d', 'Bia', 'bia@pgtap.local', 'atendente', '{editar_clientes}'),
  ('00000000-0000-0000-0000-00000000000f', 'Paulo', 'paulo@pgtap.local', 'atendente', '{editar_precos}');
insert into public.clientes (id, razao_social, cnpj) values
  ('10000000-0000-0000-0000-000000000001', 'Indústria X', '11222333000181'),
  ('10000000-0000-0000-0000-000000000002', 'Indústria Y', '99888777000166');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'cliente', 'Supermercado Brasil'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'fornecedor', 'Frigorífico Boi Bom');
insert into public.produtos (id, cliente_id, codigo, descricao, unidade) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '12', 'Costela com Requeijão', 'PAC');

set local role authenticated;

-- atendente sem permissão: lê, não cria
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*) from public.parceiros_grupos)::int, 2, 'atendente lê os cadastros');
select throws_ok(
  $$ insert into public.parceiros_grupos (cliente_id, tipo, nome) values ('10000000-0000-0000-0000-000000000001', 'cliente', 'Rede Nova') $$,
  '42501', null, 'sem editar_clientes não cria rede');

-- editar_clientes: cria rede; não mexe em preço
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.parceiros_grupos (cliente_id, tipo, nome) values ('10000000-0000-0000-0000-000000000001', 'cliente', 'Rede Nova') $$,
  'editar_clientes cria rede');
select throws_ok(
  $$ select public.definir_preco('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 9.5) $$,
  'P0001', 'sem permissão para editar preços', 'sem editar_precos não define preço');
select throws_ok(
  $$ insert into public.parceiros_unidades (cliente_id, grupo_id, nome_unidade) values ('10000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'Filial') $$,
  '23503', null, 'unidade não aceita rede de outra empresa');

-- editar_precos: define, redefine, histórico; fornecedor não tem preço
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select lives_ok($$ select public.definir_preco('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 9.5) $$, 'define preço');
select lives_ok($$ select public.definir_preco('50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 10) $$, 'redefine preço');
select is((select valor from public.precos where vigente_ate is null), 10.00::numeric(12,2), 'um único preço vigente, o mais novo');
select is((select count(*) from public.precos)::int, 2, 'o anterior fica no histórico');
select throws_ok(
  $$ select public.definir_preco('50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 5) $$,
  'P0001', 'preço só vale para clientes da empresa', 'fornecedor não tem tabela de preço');

-- auditoria só é visível ao administrador: conferir fora do papel authenticated
reset role;
select ok((select count(*) from public.auditoria_acessos where entidade = 'parceiros_grupos' and acao = 'insert') >= 1,
  'criação de rede fica na auditoria');

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `supabase test db`
Expected: FAIL em `06_cadastros_comerciais.test.sql` — `relation "public.parceiros_grupos" does not exist`.

- [ ] **Step 3: Migração**

`supabase/migrations/20260928000400_cadastros_comerciais.sql`:
```sql
-- Cadastros comerciais por empresa atendida: redes/unidades (clientes e fornecedores), produtos,
-- preços por rede com histórico e documentos. Spec: 2026-09-28-cadastros-comerciais-design.md.

create type public.tipo_parceiro as enum ('cliente', 'fornecedor');

create table public.parceiros_grupos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  tipo public.tipo_parceiro not null,
  nome text not null check (length(trim(nome)) > 0),
  palavras_chave text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (cliente_id, tipo, nome),
  unique (id, cliente_id)
);

create table public.parceiros_unidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  grupo_id uuid not null,
  nome_unidade text not null check (length(trim(nome_unidade)) > 0),
  razao_social text,
  cnpj text check (cnpj ~ '^\d{14}$'),
  inscricao_estadual text,
  endereco text,
  bairro text,
  cidade text,
  uf char(2),
  palavras_chave text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  foreign key (grupo_id, cliente_id) references public.parceiros_grupos (id, cliente_id) on delete cascade,
  unique (cliente_id, cnpj)
);
create index parceiros_unidades_grupo_idx on public.parceiros_unidades (grupo_id);

create table public.produtos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  codigo text not null check (length(trim(codigo)) > 0),
  descricao text not null check (length(trim(descricao)) > 0),
  unidade text not null default 'UN',
  apelidos text[] not null default '{}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (cliente_id, codigo),
  unique (id, cliente_id)
);

create table public.precos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  grupo_id uuid not null,
  produto_id uuid not null,
  valor numeric(12, 2) not null check (valor > 0),
  vigente_desde timestamptz not null default now(),
  vigente_ate timestamptz,
  alterado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now(),
  foreign key (grupo_id, cliente_id) references public.parceiros_grupos (id, cliente_id) on delete cascade,
  foreign key (produto_id, cliente_id) references public.produtos (id, cliente_id) on delete cascade
);
create unique index precos_um_vigente on public.precos (grupo_id, produto_id) where vigente_ate is null;

create table public.documentos_empresa (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  arquivo_path text not null,
  arquivo_nome text not null,
  arquivo_mime text not null default 'application/pdf',
  ia_pode_enviar boolean not null default false,
  enviado_por uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- RLS: leitura por usuário ativo; criar/editar com editar_clientes; excluir só admin.
alter table public.parceiros_grupos enable row level security;
alter table public.parceiros_unidades enable row level security;
alter table public.produtos enable row level security;
alter table public.precos enable row level security;
alter table public.documentos_empresa enable row level security;

do $$
declare t text;
begin
  foreach t in array array['parceiros_grupos', 'parceiros_unidades', 'produtos', 'documentos_empresa'] loop
    execute format('create policy leitura on public.%I for select to authenticated using (eh_usuario_ativo())', t);
    execute format('create policy inserir on public.%I for insert to authenticated with check (tem_permissao(''editar_clientes''))', t);
    execute format('create policy alterar on public.%I for update to authenticated using (tem_permissao(''editar_clientes'')) with check (tem_permissao(''editar_clientes''))', t);
    execute format('create policy excluir on public.%I for delete to authenticated using (eh_admin())', t);
  end loop;
end $$;

-- Preço: navegador só lê; grava pela função definir_preco.
create policy leitura on public.precos for select to authenticated using (eh_usuario_ativo());
revoke insert, update, delete on public.precos from authenticated, anon;

create function public.definir_preco(p_grupo uuid, p_produto uuid, p_valor numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_cliente uuid; v_tipo tipo_parceiro; v_id uuid;
begin
  if not tem_permissao('editar_precos') then raise exception 'sem permissão para editar preços'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'valor inválido'; end if;
  select cliente_id, tipo into v_cliente, v_tipo from parceiros_grupos where id = p_grupo;
  if v_cliente is null then raise exception 'rede não encontrada'; end if;
  if v_tipo <> 'cliente' then raise exception 'preço só vale para clientes da empresa'; end if;
  if not exists (select 1 from produtos where id = p_produto and cliente_id = v_cliente) then
    raise exception 'produto não pertence à empresa';
  end if;
  update precos set vigente_ate = now() where grupo_id = p_grupo and produto_id = p_produto and vigente_ate is null;
  insert into precos (cliente_id, grupo_id, produto_id, valor, alterado_por)
  values (v_cliente, p_grupo, p_produto, round(p_valor, 2), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- Auditoria (mesmo gatilho dos outros cadastros).
do $$
declare t text;
begin
  foreach t in array array['parceiros_grupos', 'parceiros_unidades', 'produtos', 'precos', 'documentos_empresa'] loop
    execute format('create trigger auditoria after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()', t);
  end loop;
end $$;

-- Storage: documentos da empresa em clientes/{cliente_id}/{arquivo}.
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false);
create policy documentos_leitura on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and eh_usuario_ativo());
create policy documentos_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = 'clientes' and tem_permissao('editar_clientes'));
create policy documentos_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and eh_admin());
```

- [ ] **Step 4: Rodar e ver passar; regenerar tipos**

Run: `supabase db reset && supabase test db && pnpm db:tipos && grep -c "parceiros_unidades" packages/db/src/tipos.gen.ts`
Expected: `Result: PASS` (6 arquivos) e contagem maior que 0. (`limparBanco` não precisa mudar: `truncate public.clientes ... cascade` já apaga as tabelas novas, que referenciam `clientes`.)

- [ ] **Step 5: Commit**

```bash
git add supabase packages/db/src/tipos.gen.ts
git commit -m "feat(db): cadastros comerciais por empresa com RLS, preço com histórico e bucket de documentos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Busca por palavras em `@escritorio/core`

**Files:**
- Create: `packages/core/src/busca.ts`, `packages/core/test/busca.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `palavrasDeBusca(texto: string): string[]`; `melhoresCandidatos<T>(texto: string, candidatos: { item: T; termos: string[] }[], limite?: number): T[]` (padrão 5).

- [ ] **Step 1: Teste que falha**

`packages/core/test/busca.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { melhoresCandidatos, palavrasDeBusca } from '../src/busca';

const unidades = [
  { item: 'brasil-efigenia', termos: ['Supermercado Brasil', 'Santa Efigênia', 'Santa Efigênia', 'Belo Horizonte'] },
  { item: 'brasil-matilde', termos: ['Supermercado Brasil', 'Santa Matilde', 'Santa Matilde', 'Belo Horizonte'] },
  { item: 'hortsul-gutierrez', termos: ['Hortsul', 'Gutierrez', 'Gutierrez', 'Belo Horizonte'] },
  { item: 'hortsul-itabira', termos: ['Hortsul', 'Itabira', 'Centro', 'Itabira'] },
];

describe('palavrasDeBusca', () => {
  it('minúsculas, sem acento, sem pontuação e sem palavras de pedido', () => {
    expect(palavrasDeBusca('Tira NF pro Brasil, Santa Efigênia!')).toEqual(['brasil', 'santa', 'efigenia']);
  });
});

describe('melhoresCandidatos', () => {
  it('rede + bairro acha só a unidade certa', () => {
    expect(melhoresCandidatos('Brasil Santa Efigenia', unidades)).toEqual(['brasil-efigenia']);
  });
  it('só o nome da rede devolve todas as unidades dela (empate)', () => {
    expect(melhoresCandidatos('Hortsul', unidades)).toEqual(['hortsul-gutierrez', 'hortsul-itabira']);
  });
  it('palavra parecida não conta: brasa não é brasil', () => {
    expect(melhoresCandidatos('brasa', unidades)).toEqual([]);
  });
  it('palavra comum a duas redes devolve as duas', () => {
    const comCentro = [...unidades, { item: 'brasil-centro', termos: ['Supermercado Brasil', 'Centro'] }];
    expect(melhoresCandidatos('centro', comCentro)).toEqual(['hortsul-itabira', 'brasil-centro']);
  });
  it('respeita o limite', () => {
    expect(melhoresCandidatos('belo horizonte', unidades, 2)).toHaveLength(2);
  });
  it('texto vazio ou só com palavras de pedido não acha nada', () => {
    expect(melhoresCandidatos('uma nota para', unidades)).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @escritorio/core test`
Expected: FAIL — `Cannot find module '../src/busca'`.

- [ ] **Step 3: Implementar**

`packages/core/src/busca.ts`:
```ts
/** Palavras que aparecem nos pedidos mas não identificam ninguém. */
const IGNORADAS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'pro', 'pra', 'para', 'por',
  'nf', 'nota', 'notas', 'fiscal', 'tira', 'tirar', 'emite', 'emitir', 'favor', 'unidade', 'loja', 'filial', 'me', 'manda',
]);

function normalizar(texto: string): string[] {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Palavras do texto que servem para buscar (sem acento, sem pontuação, sem palavras de pedido, sem repetição). */
export function palavrasDeBusca(texto: string): string[] {
  return [...new Set(normalizar(texto).filter((p) => !IGNORADAS.has(p)))];
}

/**
 * Pontua cada candidato pelo número de palavras do texto iguais a alguma palavra dos seus termos
 * e devolve os de maior pontuação (empate = todos), na ordem original, até o limite.
 */
export function melhoresCandidatos<T>(texto: string, candidatos: { item: T; termos: string[] }[], limite = 5): T[] {
  const busca = palavrasDeBusca(texto);
  if (busca.length === 0) return [];
  const pontuados = candidatos.map((c) => {
    const palavras = new Set(c.termos.flatMap(normalizar));
    return { item: c.item, pontos: busca.filter((p) => palavras.has(p)).length };
  });
  const maximo = Math.max(0, ...pontuados.map((p) => p.pontos));
  if (maximo === 0) return [];
  return pontuados.filter((p) => p.pontos === maximo).slice(0, limite).map((p) => p.item);
}
```

Em `packages/core/src/index.ts`, acrescentar `export * from './busca';`.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @escritorio/core test && pnpm --filter @escritorio/core typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): busca por palavras iguais (sem acento) para identificar parceiros e produtos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Repositórios dos cadastros em `@escritorio/db`

**Files:**
- Modify: `packages/db/src/repos.ts`
- Test: `packages/db/test/cadastros.test.ts`

**Interfaces:**
- Consumes: tabelas da Task 1.
- Produces (tipos exportados): 
```ts
export type TipoParceiro = 'cliente' | 'fornecedor';
export type UnidadeParceiro = { id: string; grupoId: string; tipo: TipoParceiro; rede: string; unidade: string;
  razaoSocial: string | null; cnpj: string | null; ie: string | null; bairro: string | null; cidade: string | null; uf: string | null;
  palavrasChave: string[] };   // palavras da rede + da unidade
export type ProdutoEmpresa = { id: string; codigo: string; descricao: string; unidade: string; apelidos: string[] };
export type DocumentoEmpresa = { id: string; nome: string; arquivoPath: string; arquivoNome: string; arquivoMime: string; iaPodeEnviar: boolean };
```
- Produces (métodos de `Repos`): `unidadesDaEmpresa(clienteId, tipo) → UnidadeParceiro[]` (só unidades e redes ativas) · `produtosDaEmpresa(clienteId) → ProdutoEmpresa[]` (só ativos) · `precosVigentes(clienteId, grupoId, produtoIds) → Record<string, number>` · `documentosDaEmpresa(clienteId) → DocumentoEmpresa[]` · `setorPorNome(nome) → string | null` (id de setor ativo).

- [ ] **Step 1: Teste que falha**

`packages/db/test/cadastros.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

async function empresa(nome: string, cnpj: string) {
  const { data } = await db.from('clientes').insert({ razao_social: nome, cnpj }).select().single();
  return data!.id;
}

beforeEach(limparBanco);

describe('cadastros da empresa', () => {
  it('unidades: só da empresa pedida, do tipo pedido e ativas (rede e unidade)', async () => {
    const x = await empresa('Indústria X', '11222333000181');
    const y = await empresa('Indústria Y', '99888777000166');
    const { data: brasil } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'cliente', nome: 'Supermercado Brasil', palavras_chave: ['brasil'] }).select().single();
    const { data: velha } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'cliente', nome: 'Rede Antiga', ativo: false }).select().single();
    const { data: boi } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'fornecedor', nome: 'Frigorífico Boi Bom' }).select().single();
    const { data: outra } = await db.from('parceiros_grupos').insert({ cliente_id: y, tipo: 'cliente', nome: 'Supermercado Brasil' }).select().single();
    await db.from('parceiros_unidades').insert([
      { cliente_id: x, grupo_id: brasil!.id, nome_unidade: 'Santa Efigênia', bairro: 'Santa Efigênia', cnpj: '11111111000191', palavras_chave: ['efigenia'] },
      { cliente_id: x, grupo_id: brasil!.id, nome_unidade: 'Fechada', ativo: false },
      { cliente_id: x, grupo_id: velha!.id, nome_unidade: 'Da rede antiga' },
      { cliente_id: x, grupo_id: boi!.id, nome_unidade: 'Matriz' },
      { cliente_id: y, grupo_id: outra!.id, nome_unidade: 'De outra empresa' },
    ]);
    const unidades = await repos.unidadesDaEmpresa(x, 'cliente');
    expect(unidades.map((u) => u.unidade)).toEqual(['Santa Efigênia']);
    expect(unidades[0]).toMatchObject({ rede: 'Supermercado Brasil', tipo: 'cliente', cnpj: '11111111000191', palavrasChave: ['brasil', 'efigenia'] });
    expect((await repos.unidadesDaEmpresa(x, 'fornecedor')).map((u) => u.unidade)).toEqual(['Matriz']);
  });

  it('produtos ativos e preços vigentes da rede', async () => {
    const x = await empresa('Indústria X', '11222333000181');
    const { data: rede } = await db.from('parceiros_grupos').insert({ cliente_id: x, tipo: 'cliente', nome: 'Supermercado Brasil' }).select().single();
    const { data: costela } = await db.from('produtos').insert({ cliente_id: x, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC', apelidos: ['costela'] }).select().single();
    const { data: frango } = await db.from('produtos').insert({ cliente_id: x, codigo: '14', descricao: 'Frango com Requeijão', unidade: 'PAC' }).select().single();
    await db.from('produtos').insert({ cliente_id: x, codigo: '99', descricao: 'Fora de linha', ativo: false });
    await db.from('precos').insert([
      { cliente_id: x, grupo_id: rede!.id, produto_id: costela!.id, valor: 8, vigente_ate: new Date().toISOString() },
      { cliente_id: x, grupo_id: rede!.id, produto_id: costela!.id, valor: 9.5 },
    ]);
    expect((await repos.produtosDaEmpresa(x)).map((p) => p.codigo).sort()).toEqual(['12', '14']);
    expect(await repos.precosVigentes(x, rede!.id, [costela!.id, frango!.id])).toEqual({ [costela!.id]: 9.5 });
  });

  it('documentos da empresa e setor por nome', async () => {
    const x = await empresa('Indústria X', '11222333000181');
    await db.from('documentos_empresa').insert({ cliente_id: x, nome: 'Contrato social', arquivo_path: `clientes/${x}/contrato.pdf`, arquivo_nome: 'contrato.pdf', ia_pode_enviar: true });
    expect(await repos.documentosDaEmpresa(x)).toEqual([expect.objectContaining({ nome: 'Contrato social', iaPodeEnviar: true, arquivoNome: 'contrato.pdf' })]);
    expect(await repos.setorPorNome('Fiscal')).toMatch(/^[0-9a-f-]{36}$/);
    expect(await repos.setorPorNome('Inexistente')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Parar antes o trabalhador local, se estiver rodando (porta 3001). Run: `pnpm --filter @escritorio/db test -- cadastros`
Expected: FAIL — `repos.unidadesDaEmpresa is not a function`.

- [ ] **Step 3: Implementar**

Em `packages/db/src/repos.ts`, acrescentar os tipos exportados logo após `export type NovoChamado = ...`:
```ts
export type TipoParceiro = 'cliente' | 'fornecedor';
export type UnidadeParceiro = {
  id: string; grupoId: string; tipo: TipoParceiro; rede: string; unidade: string;
  razaoSocial: string | null; cnpj: string | null; ie: string | null; bairro: string | null; cidade: string | null; uf: string | null;
  palavrasChave: string[];
};
export type ProdutoEmpresa = { id: string; codigo: string; descricao: string; unidade: string; apelidos: string[] };
export type DocumentoEmpresa = { id: string; nome: string; arquivoPath: string; arquivoNome: string; arquivoMime: string; iaPodeEnviar: boolean };
```

E, dentro do objeto devolvido por `criarRepos`, antes de `async resumoDoDia`:
```ts
    async unidadesDaEmpresa(clienteId: string, tipo: TipoParceiro): Promise<UnidadeParceiro[]> {
      const linhas = checar(await db.from('parceiros_unidades')
        .select('id, nome_unidade, razao_social, cnpj, inscricao_estadual, bairro, cidade, uf, palavras_chave, parceiros_grupos!inner(id, nome, tipo, palavras_chave, ativo)')
        .eq('cliente_id', clienteId).eq('ativo', true)
        .eq('parceiros_grupos.tipo', tipo).eq('parceiros_grupos.ativo', true)
        .order('nome_unidade'), 'unidadesDaEmpresa');
      return linhas.map((l) => ({
        id: l.id, grupoId: l.parceiros_grupos.id, tipo: l.parceiros_grupos.tipo, rede: l.parceiros_grupos.nome, unidade: l.nome_unidade,
        razaoSocial: l.razao_social, cnpj: l.cnpj, ie: l.inscricao_estadual, bairro: l.bairro, cidade: l.cidade, uf: l.uf,
        palavrasChave: [...l.parceiros_grupos.palavras_chave, ...l.palavras_chave],
      }));
    },

    async produtosDaEmpresa(clienteId: string): Promise<ProdutoEmpresa[]> {
      const linhas = checar(await db.from('produtos').select('id, codigo, descricao, unidade, apelidos')
        .eq('cliente_id', clienteId).eq('ativo', true).order('descricao'), 'produtosDaEmpresa');
      return linhas.map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade, apelidos: p.apelidos }));
    },

    async precosVigentes(clienteId: string, grupoId: string, produtoIds: string[]): Promise<Record<string, number>> {
      if (produtoIds.length === 0) return {};
      const linhas = checar(await db.from('precos').select('produto_id, valor').eq('cliente_id', clienteId)
        .eq('grupo_id', grupoId).in('produto_id', produtoIds).is('vigente_ate', null), 'precosVigentes');
      return Object.fromEntries(linhas.map((l) => [l.produto_id, Number(l.valor)]));
    },

    async documentosDaEmpresa(clienteId: string): Promise<DocumentoEmpresa[]> {
      const linhas = checar(await db.from('documentos_empresa').select('id, nome, arquivo_path, arquivo_nome, arquivo_mime, ia_pode_enviar')
        .eq('cliente_id', clienteId).order('nome'), 'documentosDaEmpresa');
      return linhas.map((d) => ({ id: d.id, nome: d.nome, arquivoPath: d.arquivo_path, arquivoNome: d.arquivo_nome, arquivoMime: d.arquivo_mime, iaPodeEnviar: d.ia_pode_enviar }));
    },

    async setorPorNome(nome: string): Promise<string | null> {
      const s = checar(await db.from('setores').select('id').eq('nome', nome).eq('ativo', true).maybeSingle(), 'setorPorNome');
      return s?.id ?? null;
    },
```

Se o typecheck acusar `parceiros_grupos` como array no `select` aninhado, ajustar ao formato de `tipos.gen.ts` (fonte da verdade), sem mudar o comportamento.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck`
Expected: PASS (11 testes: 8 existentes + 3 novos).

- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "feat(db): repositórios de unidades, produtos, preços vigentes e documentos por empresa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Ferramentas de busca do agente (`buscar_parceiros`, `buscar_produtos`)

**Files:**
- Create: `apps/trabalhador/src/agente/cadastros.ts`
- Modify: `apps/trabalhador/src/agente/ferramentas.ts`
- Modify: `apps/trabalhador/test/apoio/cenario.ts` (acrescenta `criarCadastrosExemplo`)
- Test: `apps/trabalhador/test/agente/cadastros.test.ts`

**Interfaces:**
- Consumes: `melhoresCandidatos` (Task 2); `unidadesDaEmpresa`, `produtosDaEmpresa` (Task 3); `executarFerramenta`, `EstadoExecucao`, `DepsAgente` (ferramentas.ts).
- Produces:
```ts
// cadastros.ts
export type CandidatoParceiro = { id: string; rede: string; unidade: string; bairro: string | null; cidade: string | null };
export type CandidatoProduto = { id: string; codigo: string; descricao: string; unidade: string };
export function buscarParceiros(repos: Repos, clienteId: string, texto: string, tipo: TipoParceiro): Promise<CandidatoParceiro[]>;
export function buscarProdutos(repos: Repos, clienteId: string, textos: string[]): Promise<{ texto: string; candidatos: CandidatoProduto[] }[]>;
// test/apoio/cenario.ts
export type CadastrosExemplo = { brasilEfigenia: string; brasilMatilde: string; hortsul: string[]; boiBom: string; costela: string; frango: string; alho: string;
  contrato: string; balanco: string };
export function criarCadastrosExemplo(clienteId: string): Promise<CadastrosExemplo>;
```
- Ferramentas novas no agente: `buscar_parceiros { texto, tipo: 'cliente'|'fornecedor' }` → `{ candidatos: CandidatoParceiro[] }`; `buscar_produtos { textos: string[] }` → `{ resultados: [...] }`. Ambas exigem empresa em foco.

- [ ] **Step 1: Ajudante de cenário e teste que falha**

Acrescentar ao fim de `apps/trabalhador/test/apoio/cenario.ts`:
```ts
export type CadastrosExemplo = {
  brasilEfigenia: string; brasilMatilde: string; hortsul: string[]; boiBom: string;
  costela: string; frango: string; alho: string; contrato: string; balanco: string;
};

/** Cadastros inventados no estilo das conversas reais (indústria de alimentos). */
export async function criarCadastrosExemplo(clienteId: string): Promise<CadastrosExemplo> {
  const grupo = async (tipo: 'cliente' | 'fornecedor', nome: string, palavras_chave: string[] = []) =>
    (await db.from('parceiros_grupos').insert({ cliente_id: clienteId, tipo, nome, palavras_chave }).select().single()).data!.id;
  const unidade = async (grupo_id: string, nome_unidade: string, extra: object = {}) =>
    (await db.from('parceiros_unidades').insert({ cliente_id: clienteId, grupo_id, nome_unidade, ...extra }).select().single()).data!.id;
  const produto = async (codigo: string, descricao: string, apelidos: string[]) =>
    (await db.from('produtos').insert({ cliente_id: clienteId, codigo, descricao, unidade: 'PAC', apelidos }).select().single()).data!.id;

  const brasil = await grupo('cliente', 'Supermercado Brasil', ['brasil']);
  const brasilEfigenia = await unidade(brasil, 'Santa Efigênia', { razao_social: 'Supermercado Brasil Ltda', cnpj: '11111111000191', inscricao_estadual: '0012345670011', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG' });
  const brasilMatilde = await unidade(brasil, 'Santa Matilde', { razao_social: 'Supermercado Brasil Ltda', cnpj: '11111111000272', bairro: 'Santa Matilde', cidade: 'Belo Horizonte', uf: 'MG' });
  const hortsulGrupo = await grupo('cliente', 'Hortsul');
  const hortsul = [
    await unidade(hortsulGrupo, 'Gutierrez', { bairro: 'Gutierrez', cidade: 'Belo Horizonte', uf: 'MG' }),
    await unidade(hortsulGrupo, 'Jardim Canadá', { bairro: 'Jardim Canadá', cidade: 'Nova Lima', uf: 'MG' }),
    await unidade(hortsulGrupo, 'Itabira', { bairro: 'Centro', cidade: 'Itabira', uf: 'MG' }),
  ];
  const boi = await grupo('fornecedor', 'Frigorífico Boi Bom', ['boi bom']);
  const boiBom = await unidade(boi, 'Matriz', { razao_social: 'Frigorífico Boi Bom Ltda', cnpj: '22222222000191', cidade: 'Contagem', uf: 'MG' });
  const costela = await produto('12', 'Costela com Requeijão', ['costela']);
  const frango = await produto('14', 'Frango com Requeijão', ['frango']);
  const alho = await produto('20', 'Alho Poró', ['alho', 'alho poro']);
  await db.from('precos').insert([
    { cliente_id: clienteId, grupo_id: brasil, produto_id: costela, valor: 9.5 },
    { cliente_id: clienteId, grupo_id: brasil, produto_id: frango, valor: 9 },
  ]);
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);   // "%PDF-1.4"
  const doc = async (nome: string, arquivo: string, ia_pode_enviar: boolean) => {
    const arquivo_path = `clientes/${clienteId}/${arquivo}`;
    await db.storage.from('documentos').upload(arquivo_path, pdf, { contentType: 'application/pdf', upsert: true });
    return (await db.from('documentos_empresa').insert({ cliente_id: clienteId, nome, arquivo_path, arquivo_nome: arquivo, ia_pode_enviar }).select().single()).data!.id;
  };
  const contrato = await doc('Contrato social', 'contrato-social.pdf', true);
  const balanco = await doc('Balanço 2025', 'balanco-2025.pdf', false);
  return { brasilEfigenia, brasilMatilde, hortsul, boiBom, costela, frango, alho, contrato, balanco };
}
```

`apps/trabalhador/test/agente/cadastros.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, type CadastrosExemplo } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
let cad: CadastrosExemplo;
let estado: EstadoExecucao;

const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => {
  const r = await executarFerramenta(d(), estado, nome, entrada);
  return { ...JSON.parse(r.resultado), _erro: r.erro };
};

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Indústria X']);
  cad = await criarCadastrosExemplo(empresas[0]!.id);
  const contato = await repos.buscarContato(conversa.telefone);
  estado = { ctx: await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H), respondeu: false };
});

describe('buscar_parceiros', () => {
  it('rede + bairro devolve só a unidade certa', async () => {
    const r = await usar('buscar_parceiros', { texto: 'Brasil Santa Efigênia', tipo: 'cliente' });
    expect(r.candidatos).toEqual([{ id: cad.brasilEfigenia, rede: 'Supermercado Brasil', unidade: 'Santa Efigênia', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte' }]);
  });
  it('só a rede devolve todas as unidades dela', async () => {
    const r = await usar('buscar_parceiros', { texto: 'Hortsul', tipo: 'cliente' });
    expect(r.candidatos.map((c: { id: string }) => c.id).sort()).toEqual([...cad.hortsul].sort());
  });
  it('fornecedor só aparece na busca de fornecedores', async () => {
    expect((await usar('buscar_parceiros', { texto: 'Boi Bom', tipo: 'cliente' })).candidatos).toEqual([]);
    expect((await usar('buscar_parceiros', { texto: 'Boi Bom', tipo: 'fornecedor' })).candidatos[0].id).toBe(cad.boiBom);
  });
  it('não enxerga cadastros de outra empresa', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: g } = await db.from('parceiros_grupos').insert({ cliente_id: y!.id, tipo: 'cliente', nome: 'Mercado Sigiloso' }).select().single();
    await db.from('parceiros_unidades').insert({ cliente_id: y!.id, grupo_id: g!.id, nome_unidade: 'Centro' });
    expect((await usar('buscar_parceiros', { texto: 'Mercado Sigiloso', tipo: 'cliente' })).candidatos).toEqual([]);
  });
  it('sem empresa em foco é recusado', async () => {
    estado.ctx.empresaEmFoco = null;
    expect((await usar('buscar_parceiros', { texto: 'Brasil', tipo: 'cliente' }))._erro).toBe(true);
  });
});

describe('buscar_produtos', () => {
  it('acha por apelido e por código; o que não existe volta vazio', async () => {
    const r = await usar('buscar_produtos', { textos: ['costela', '14', 'lasanha'] });
    expect(r.resultados).toEqual([
      { texto: 'costela', candidatos: [{ id: cad.costela, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC' }] },
      { texto: '14', candidatos: [{ id: cad.frango, codigo: '14', descricao: 'Frango com Requeijão', unidade: 'PAC' }] },
      { texto: 'lasanha', candidatos: [] },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Parar o trabalhador local, se estiver rodando. Run: `pnpm --filter @escritorio/trabalhador test -- cadastros`
Expected: FAIL — `Ferramenta desconhecida: buscar_parceiros` (resultado com erro; `r.candidatos` indefinido).

- [ ] **Step 3: Implementar a busca**

`apps/trabalhador/src/agente/cadastros.ts`:
```ts
import { melhoresCandidatos } from '@escritorio/core';
import type { Repos, TipoParceiro } from '@escritorio/db';

export type CandidatoParceiro = { id: string; rede: string; unidade: string; bairro: string | null; cidade: string | null };
export type CandidatoProduto = { id: string; codigo: string; descricao: string; unidade: string };

/** Busca feita pelo código, só nos cadastros da empresa informada. */
export async function buscarParceiros(repos: Repos, clienteId: string, texto: string, tipo: TipoParceiro): Promise<CandidatoParceiro[]> {
  const unidades = await repos.unidadesDaEmpresa(clienteId, tipo);
  const achadas = melhoresCandidatos(texto, unidades.map((u) => ({
    item: u,
    termos: [u.rede, u.unidade, u.bairro ?? '', u.cidade ?? '', u.razaoSocial ?? '', ...u.palavrasChave],
  })));
  return achadas.map((u) => ({ id: u.id, rede: u.rede, unidade: u.unidade, bairro: u.bairro, cidade: u.cidade }));
}

export async function buscarProdutos(repos: Repos, clienteId: string, textos: string[]): Promise<{ texto: string; candidatos: CandidatoProduto[] }[]> {
  const produtos = await repos.produtosDaEmpresa(clienteId);
  const candidatos = produtos.map((p) => ({ item: p, termos: [p.descricao, p.codigo, ...p.apelidos] }));
  return textos.map((texto) => ({
    texto,
    candidatos: melhoresCandidatos(texto, candidatos).map((p) => ({ id: p.id, codigo: p.codigo, descricao: p.descricao, unidade: p.unidade })),
  }));
}
```

- [ ] **Step 4: Registrar as ferramentas**

Em `apps/trabalhador/src/agente/ferramentas.ts`:

1. Importar: `import { buscarParceiros, buscarProdutos } from './cadastros';`
2. Acrescentar ao array `FERRAMENTAS` (antes de `responder`):
```ts
  {
    name: 'buscar_parceiros',
    description: 'Procura, nos cadastros da empresa em foco, as unidades de clientes (tipo "cliente", para nota de venda) ou de fornecedores (tipo "fornecedor", para nota de devolução) que combinam com o texto do cliente. Devolve até 5 candidatos.',
    input_schema: objeto({
      texto: { type: 'string', description: 'Como o cliente se referiu ao destinatário, por exemplo "Brasil Santa Efigênia".' },
      tipo: { type: 'string', enum: ['cliente', 'fornecedor'] },
    }, ['texto', 'tipo']),
  },
  {
    name: 'buscar_produtos',
    description: 'Procura, nos produtos cadastrados da empresa em foco, cada item citado pelo cliente (nome, apelido ou código). Devolve até 5 candidatos por item.',
    input_schema: objeto({ textos: { type: 'array', items: { type: 'string' } } }, ['textos']),
  },
```
3. Acrescentar a `Entradas`:
```ts
  buscar_parceiros: z.object({ texto: z.string().min(1).max(200), tipo: z.enum(['cliente', 'fornecedor']) }),
  buscar_produtos: z.object({ textos: z.array(z.string().min(1).max(200)).min(1).max(30) }),
```
4. Acrescentar a função de apoio abaixo de `empresaDefinida`:
```ts
/** Ferramentas de cadastro só funcionam com a empresa em foco definida (e nunca para número desconhecido). */
function exigirEmpresa(estado: EstadoExecucao): { clienteId: string } | Resultado {
  const bloqueio = empresaDefinida(estado);
  if (bloqueio) return bloqueio;
  const empresa = estado.ctx.empresaEmFoco;
  if (!empresa) return falha('Nenhuma empresa definida para este contato. Número desconhecido: use abrir_chamado com "triagem".');
  return { clienteId: empresa.id };
}
```
5. Acrescentar os casos no `switch` de `executarValidada`:
```ts
    case 'buscar_parceiros': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      return ok({ candidatos: await buscarParceiros(d.repos, e.clienteId, entrada.texto, entrada.tipo) });
    }

    case 'buscar_produtos': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      return ok({ resultados: await buscarProdutos(d.repos, e.clienteId, entrada.textos) });
    }
```
(`Resultado` tem a chave `erro`; `{ clienteId }` não tem — é isso que o `'erro' in e` distingue.)

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS (todos os testes, incluindo os 6 novos).

- [ ] **Step 6: Commit**

```bash
git add apps/trabalhador
git commit -m "feat(agente): buscar_parceiros e buscar_produtos nos cadastros da empresa em foco

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Demanda de nota pronta para emitir (`abrir_pedido_nota`)

**Files:**
- Create: `apps/trabalhador/src/agente/pedido-nota.ts`, `apps/trabalhador/test/agente/pedido-nota.test.ts`
- Modify: `apps/trabalhador/src/agente/ferramentas.ts`
- Modify: `apps/trabalhador/test/agente/cadastros.test.ts` (casos da ferramenta)

**Interfaces:**
- Consumes: `UnidadeParceiro`, `ProdutoEmpresa`, `unidadesDaEmpresa`, `produtosDaEmpresa`, `precosVigentes`, `setorPorNome` (Task 3); `exigirEmpresa` (Task 4).
- Produces:
```ts
// pedido-nota.ts
export type ItemPedido = { produto: ProdutoEmpresa | null; texto: string; quantidade: number; unidade: string; preco: number | null };
export function formatarReais(valor: number): string;            // 1234.5 → "R$ 1.234,50"
export function montarPedidoNota(p: { tipo: 'venda' | 'devolucao'; destino: UnidadeParceiro | null; textoDestinatario: string;
  itens: ItemPedido[]; pedidoOriginal: string; semPermissao: boolean }): { titulo: string; resumo: string };
```
- Ferramenta: `abrir_pedido_nota { tipo, unidade_id: string|null, texto_destinatario, itens: [{ produto_id: string|null, texto, quantidade, unidade }], pedido_original }` → `{ numero, setor: 'Fiscal', itens_sem_cadastro, sem_preco, fora_do_horario, aviso_para_o_cliente }`.

- [ ] **Step 1: Teste da montagem que falha**

`apps/trabalhador/test/agente/pedido-nota.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';
import { formatarReais, montarPedidoNota } from '../../src/agente/pedido-nota';

const efigenia: UnidadeParceiro = { id: 'u1', grupoId: 'g1', tipo: 'cliente', rede: 'Supermercado Brasil', unidade: 'Santa Efigênia',
  razaoSocial: 'Supermercado Brasil Ltda', cnpj: '11111111000191', ie: '0012345670011', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG', palavrasChave: [] };
const costela: ProdutoEmpresa = { id: 'p1', codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC', apelidos: [] };
const frango: ProdutoEmpresa = { id: 'p2', codigo: '14', descricao: 'Frango com Requeijão', unidade: 'PAC', apelidos: [] };
const original = 'Tira NF pro Brasil Santa Efigênia: 20 PAC costela, 15 frango e 3 lasanha';

describe('formatarReais', () => {
  it('formata em reais com milhar', () => {
    expect(formatarReais(9.5)).toBe('R$ 9,50');
    expect(formatarReais(1234.5)).toBe('R$ 1.234,50');
  });
});

describe('montarPedidoNota', () => {
  it('venda com destino, preços da tabela, item sem preço e item não cadastrado', () => {
    const r = montarPedidoNota({
      tipo: 'venda', destino: efigenia, textoDestinatario: 'Brasil Santa Efigênia', pedidoOriginal: original, semPermissao: false,
      itens: [
        { produto: costela, texto: 'costela', quantidade: 20, unidade: 'PAC', preco: 9.5 },
        { produto: frango, texto: 'frango', quantidade: 15, unidade: 'PAC', preco: null },
        { produto: null, texto: 'lasanha', quantidade: 3, unidade: 'PAC', preco: null },
      ],
    });
    expect(r.titulo).toBe('NF de venda – Supermercado Brasil / Santa Efigênia');
    expect(r.resumo).toBe([
      'Destinatário: Supermercado Brasil / Santa Efigênia – Supermercado Brasil Ltda – CNPJ 11.111.111/0001-91 – IE 0012345670011',
      '20 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 190,00',
      '15 PAC Frango com Requeijão (cód. 14) – sem preço cadastrado',
      '3 PAC lasanha – PRODUTO NÃO CADASTRADO',
      'Total (itens com preço): R$ 190,00',
      '',
      `Pedido original: "${original}"`,
    ].join('\n'));
  });

  it('destinatário não cadastrado, quantidade decimal e contato sem permissão', () => {
    const r = montarPedidoNota({
      tipo: 'venda', destino: null, textoDestinatario: 'Mercado Novo', pedidoOriginal: 'nota pro Mercado Novo 2,5 kg costela', semPermissao: true,
      itens: [{ produto: null, texto: 'costela', quantidade: 2.5, unidade: 'kg', preco: null }],
    });
    expect(r.titulo).toBe('NF de venda – destinatário não cadastrado');
    expect(r.resumo).toContain('Destinatário: NÃO CADASTRADO – "Mercado Novo"');
    expect(r.resumo).toContain('2,5 kg costela – PRODUTO NÃO CADASTRADO');
    expect(r.resumo).not.toContain('Total');
    expect(r.resumo).toContain('Observação: contato sem permissão para pedir nota.');
  });

  it('devolução não leva preço', () => {
    const boi: UnidadeParceiro = { ...efigenia, id: 'u9', tipo: 'fornecedor', rede: 'Frigorífico Boi Bom', unidade: 'Matriz', razaoSocial: null, cnpj: null, ie: null };
    const r = montarPedidoNota({
      tipo: 'devolucao', destino: boi, textoDestinatario: 'Boi Bom', pedidoOriginal: 'devolução 3 costela', semPermissao: false,
      itens: [{ produto: costela, texto: 'costela', quantidade: 3, unidade: 'PAC', preco: 9.5 }],
    });
    expect(r.titulo).toBe('NF de devolução – Frigorífico Boi Bom / Matriz');
    expect(r.resumo.split('\n').slice(0, 2)).toEqual(['Fornecedor: Frigorífico Boi Bom / Matriz', '3 PAC Costela com Requeijão (cód. 12)']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm --filter @escritorio/trabalhador test -- pedido-nota`
Expected: FAIL — `Cannot find module '../../src/agente/pedido-nota'`.

- [ ] **Step 3: Implementar a montagem**

`apps/trabalhador/src/agente/pedido-nota.ts`:
```ts
import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';

export type ItemPedido = { produto: ProdutoEmpresa | null; texto: string; quantidade: number; unidade: string; preco: number | null };

export function formatarReais(valor: number): string {
  const [inteiro, centavos] = valor.toFixed(2).split('.') as [string, string];
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

const numero = (q: number) => String(q).replace('.', ',');
const cnpjFormatado = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

/** Título e resumo da demanda de nota. Preço só aparece em venda e só vem da tabela (campo `preco`). */
export function montarPedidoNota(p: {
  tipo: 'venda' | 'devolucao'; destino: UnidadeParceiro | null; textoDestinatario: string;
  itens: ItemPedido[]; pedidoOriginal: string; semPermissao: boolean;
}): { titulo: string; resumo: string } {
  const venda = p.tipo === 'venda';
  const rotulo = venda ? 'Destinatário' : 'Fornecedor';
  const titulo = p.destino
    ? `NF de ${venda ? 'venda' : 'devolução'} – ${p.destino.rede} / ${p.destino.unidade}`
    : `NF de ${venda ? 'venda' : 'devolução'} – ${venda ? 'destinatário' : 'fornecedor'} não cadastrado`;

  const linhas: string[] = [];
  if (p.destino) {
    const partes = [`${p.destino.rede} / ${p.destino.unidade}`];
    if (p.destino.razaoSocial) partes.push(p.destino.razaoSocial);
    if (p.destino.cnpj) partes.push(`CNPJ ${cnpjFormatado(p.destino.cnpj)}`);
    if (p.destino.ie) partes.push(`IE ${p.destino.ie}`);
    linhas.push(`${rotulo}: ${partes.join(' – ')}`);
  } else {
    linhas.push(`${rotulo}: NÃO CADASTRADO – "${p.textoDestinatario}"`);
  }

  let total = 0;
  let algumPreco = false;
  for (const i of p.itens) {
    if (!i.produto) {
      linhas.push(`${numero(i.quantidade)} ${i.unidade} ${i.texto} – PRODUTO NÃO CADASTRADO`);
      continue;
    }
    const base = `${numero(i.quantidade)} ${i.produto.unidade} ${i.produto.descricao} (cód. ${i.produto.codigo})`;
    if (!venda) linhas.push(base);
    else if (i.preco === null) linhas.push(`${base} – sem preço cadastrado`);
    else {
      const subtotal = Math.round(i.quantidade * i.preco * 100) / 100;
      total += subtotal;
      algumPreco = true;
      linhas.push(`${base} × ${formatarReais(i.preco)} = ${formatarReais(subtotal)}`);
    }
  }
  if (venda && algumPreco) linhas.push(`Total (itens com preço): ${formatarReais(total)}`);
  if (p.semPermissao) linhas.push('Observação: contato sem permissão para pedir nota.');
  linhas.push('', `Pedido original: "${p.pedidoOriginal}"`);
  return { titulo, resumo: linhas.join('\n') };
}
```

Run: `pnpm --filter @escritorio/trabalhador test -- pedido-nota` → PASS.

- [ ] **Step 4: Testes da ferramenta que falham**

Acrescentar ao fim de `apps/trabalhador/test/agente/cadastros.test.ts`:
```ts
describe('abrir_pedido_nota', () => {
  const pedido = (extra: object = {}) => ({
    tipo: 'venda', unidade_id: cad.brasilEfigenia, texto_destinatario: 'Brasil Santa Efigênia',
    itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 20, unidade: 'PAC' }, { produto_id: null, texto: 'lasanha', quantidade: 3, unidade: 'PAC' }],
    pedido_original: 'Tira NF pro Brasil Santa Efigênia: 20 PAC costela e 3 lasanha', ...extra,
  });

  it('abre a demanda no Fiscal com CNPJ, preço da tabela e item não cadastrado', async () => {
    const r = await usar('abrir_pedido_nota', pedido());
    expect(r).toMatchObject({ setor: 'Fiscal', itens_sem_cadastro: 1, _erro: false });
    const { data } = await db.from('chamados').select('titulo, resumo, setores(nome), cliente_id').single();
    expect(data!.setores?.nome).toBe('Fiscal');
    expect(data!.titulo).toBe('NF de venda – Supermercado Brasil / Santa Efigênia');
    expect(data!.resumo).toContain('CNPJ 11.111.111/0001-91');
    expect(data!.resumo).toContain('20 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 190,00');
    expect(data!.resumo).toContain('3 PAC lasanha – PRODUTO NÃO CADASTRADO');
    expect(data!.resumo).toContain('Observação: contato sem permissão para pedir nota.');
  });

  it('recusa unidade de fornecedor num pedido de venda', async () => {
    expect((await usar('abrir_pedido_nota', pedido({ unidade_id: cad.boiBom })))._erro).toBe(true);
    expect((await db.from('chamados').select('id')).data).toHaveLength(0);
  });

  it('recusa produto de outra empresa', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: alheio } = await db.from('produtos').insert({ cliente_id: y!.id, codigo: '1', descricao: 'Alheio' }).select().single();
    const r = await usar('abrir_pedido_nota', pedido({ itens: [{ produto_id: alheio!.id, texto: 'alheio', quantidade: 1, unidade: 'UN' }] }));
    expect(r._erro).toBe(true);
  });

  it('devolução para fornecedor, sem preço', async () => {
    const r = await usar('abrir_pedido_nota', pedido({ tipo: 'devolucao', unidade_id: cad.boiBom, texto_destinatario: 'Boi Bom',
      itens: [{ produto_id: cad.costela, texto: 'costela', quantidade: 3, unidade: 'PAC' }], pedido_original: 'devolução de 3 costela pro Boi Bom' }));
    expect(r._erro).toBe(false);
    const { data } = await db.from('chamados').select('titulo, resumo').single();
    expect(data!.titulo).toBe('NF de devolução – Frigorífico Boi Bom / Matriz');
    expect(data!.resumo).not.toContain('R$');
  });
});
```

Run: `pnpm --filter @escritorio/trabalhador test -- cadastros`
Expected: FAIL — `Ferramenta desconhecida: abrir_pedido_nota`.

- [ ] **Step 5: Implementar a ferramenta**

Em `apps/trabalhador/src/agente/ferramentas.ts`:

1. Importar: `import { montarPedidoNota, type ItemPedido } from './pedido-nota';`
2. Extrair o aviso de fora do horário para uma função (usada por `abrir_chamado` e pela nova ferramenta), acima de `executarValidada`:
```ts
function avisoForaDoHorario(ctx: ContextoAgente): string | null {
  return ctx.noExpediente ? null : formatarMensagem(ctx.config.mensagens.fora_do_horario ?? '', ctx.config.expediente as never);
}
```
e em `abrir_chamado` trocar `const aviso = ctx.noExpediente ? null : formatarMensagem(...)` por `const aviso = avisoForaDoHorario(ctx);`.
3. Acrescentar ao array `FERRAMENTAS` (antes de `responder`):
```ts
  {
    name: 'abrir_pedido_nota',
    description: 'Abre a demanda de nota fiscal no Fiscal, já organizada: destinatário (ou fornecedor, na devolução) e itens identificados nos cadastros, com o preço da tabela preenchido pelo sistema. Use depois de buscar_parceiros e buscar_produtos. unidade_id/produto_id vazios (null) = não cadastrado.',
    input_schema: objeto({
      tipo: { type: 'string', enum: ['venda', 'devolucao'] },
      unidade_id: { type: ['string', 'null'] },
      texto_destinatario: { type: 'string', description: 'Como o cliente se referiu ao destinatário.' },
      itens: {
        type: 'array',
        items: objeto({
          produto_id: { type: ['string', 'null'] },
          texto: { type: 'string', description: 'Como o cliente escreveu o item.' },
          quantidade: { type: 'number' },
          unidade: { type: 'string', description: 'PAC, kg, UN… como o cliente informou.' },
        }, ['produto_id', 'texto', 'quantidade', 'unidade']),
      },
      pedido_original: { type: 'string', description: 'Texto do pedido do cliente, copiado sem alterar.' },
    }, ['tipo', 'unidade_id', 'texto_destinatario', 'itens', 'pedido_original']),
  },
```
4. Acrescentar a `Entradas`:
```ts
  abrir_pedido_nota: z.object({
    tipo: z.enum(['venda', 'devolucao']),
    unidade_id: z.string().nullable(),
    texto_destinatario: z.string().min(1).max(300),
    itens: z.array(z.object({
      produto_id: z.string().nullable(), texto: z.string().min(1).max(200), quantidade: z.number().positive(), unidade: z.string().max(20),
    })).min(1).max(50),
    pedido_original: z.string().min(1).max(4000),
  }),
```
5. Acrescentar o caso no `switch`:
```ts
    case 'abrir_pedido_nota': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const tipoParceiro = entrada.tipo === 'venda' ? 'cliente' : 'fornecedor';
      const unidades = await d.repos.unidadesDaEmpresa(e.clienteId, tipoParceiro);
      const destino = entrada.unidade_id ? unidades.find((u) => u.id === entrada.unidade_id) ?? null : null;
      if (entrada.unidade_id && !destino) {
        return falha(`unidade_id não é ${tipoParceiro === 'cliente' ? 'um cliente' : 'um fornecedor'} desta empresa. Use buscar_parceiros com o tipo certo.`);
      }
      const produtos = await d.repos.produtosDaEmpresa(e.clienteId);
      const itensEntrada = entrada.itens as { produto_id: string | null; texto: string; quantidade: number; unidade: string }[];
      if (itensEntrada.some((i) => i.produto_id && !produtos.some((p) => p.id === i.produto_id))) {
        return falha('produto_id não pertence a esta empresa. Use buscar_produtos.');
      }
      const precos = entrada.tipo === 'venda' && destino
        ? await d.repos.precosVigentes(e.clienteId, destino.grupoId, itensEntrada.flatMap((i) => (i.produto_id ? [i.produto_id] : [])))
        : {};
      const itens: ItemPedido[] = itensEntrada.map((i) => ({
        produto: produtos.find((p) => p.id === i.produto_id) ?? null, texto: i.texto, quantidade: i.quantidade, unidade: i.unidade,
        preco: i.produto_id ? precos[i.produto_id] ?? null : null,
      }));
      const { titulo, resumo } = montarPedidoNota({
        tipo: entrada.tipo, destino, textoDestinatario: entrada.texto_destinatario, itens,
        pedidoOriginal: entrada.pedido_original, semPermissao: !ctx.empresaEmFoco!.podePedirNota,
      });
      const setorId = await d.repos.setorPorNome('Fiscal');
      const responsavelId = escolherResponsavel(setorId, await d.repos.responsaveisDoCliente(e.clienteId));
      const { numero } = await d.repos.abrirChamado({
        clienteId: e.clienteId, conversaId: ctx.conversa.id, setorId, responsavelId,
        titulo, resumo, foraDoContrato: false, origem: 'agente',
      });
      await d.repos.atualizarConversa(ctx.conversa.id, { tentativas_nao_entendido: 0 });
      const aviso = avisoForaDoHorario(ctx);
      return ok({
        numero, setor: setorId ? 'Fiscal' : 'Triagem', itens_sem_cadastro: itens.filter((i) => !i.produto).length,
        sem_preco: entrada.tipo === 'venda' ? itens.filter((i) => i.produto && i.preco === null).length : 0,
        fora_do_horario: !ctx.noExpediente, aviso_para_o_cliente: aviso,
      });
    }
```

- [ ] **Step 6: Rodar e ver passar**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/trabalhador
git commit -m "feat(agente): abrir_pedido_nota monta a demanda com destinatário, códigos e preço da tabela

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Documentos pelo WhatsApp (`listar_documentos`, `enviar_documento`)

**Files:**
- Modify: `apps/trabalhador/src/midia/armazenamento.ts` (`urlAssinada` aceita bucket)
- Modify: `apps/trabalhador/src/envio.ts` (acrescenta `enviarDocumentoDoSistema`)
- Modify: `apps/trabalhador/src/agente/ferramentas.ts`
- Modify: `apps/trabalhador/test/agente/cadastros.test.ts`

**Interfaces:**
- Consumes: `documentosDaEmpresa`, `DocumentoEmpresa` (Task 3); `exigirEmpresa` (Task 4); `criarSaidaPendente`, `marcarEnviada`, `marcarFalha` (repos existentes).
- Produces: `ArmazenamentoMidia.urlAssinada(path: string, segundos: number, bucket?: string): Promise<string>` (padrão `'anexos'`); `enviarDocumentoDoSistema(d: DepsEnvio, p: { conversaId: string; telefone: string; clienteId: string; documento: DocumentoEmpresa }): Promise<string>`; ferramentas `listar_documentos {}` → `{ documentos: [{ id, nome, ia_pode_enviar }] }` e `enviar_documento { documento_id }` → `{ enviado: true, documento }`.

- [ ] **Step 1: Testes que falham**

Acrescentar ao fim de `apps/trabalhador/test/agente/cadastros.test.ts`:
```ts
describe('documentos', () => {
  it('lista os documentos da empresa com a marcação de envio', async () => {
    const r = await usar('listar_documentos', {});
    expect(r.documentos).toEqual([
      { id: cad.balanco, nome: 'Balanço 2025', ia_pode_enviar: false },
      { id: cad.contrato, nome: 'Contrato social', ia_pode_enviar: true },
    ]);
  });
  it('envia o documento liberado e registra a mensagem', async () => {
    const r = await usar('enviar_documento', { documento_id: cad.contrato });
    expect(r._erro).toBe(false);
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', arquivo: 'contrato-social.pdf' }]);
    const { data } = await db.from('mensagens').select('conteudo, status_envio, autor').single();
    expect(data).toEqual({ conteudo: '📎 Contrato social', status_envio: 'enviada', autor: 'agente' });
    expect(estado.respondeu).toBe(true);
  });
  it('recusa documento não liberado', async () => {
    expect((await usar('enviar_documento', { documento_id: cad.balanco }))._erro).toBe(true);
    expect(canal.enviados).toHaveLength(0);
  });
  it('recusa documento de outra empresa', async () => {
    const { data: y } = await db.from('clientes').insert({ razao_social: 'Indústria Y', cnpj: '99888777000166' }).select().single();
    const { data: doc } = await db.from('documentos_empresa').insert({ cliente_id: y!.id, nome: 'Contrato alheio', arquivo_path: `clientes/${y!.id}/x.pdf`, arquivo_nome: 'x.pdf', ia_pode_enviar: true }).select().single();
    expect((await usar('enviar_documento', { documento_id: doc!.id }))._erro).toBe(true);
    expect(canal.enviados).toHaveLength(0);
  });
});
```

Run: `pnpm --filter @escritorio/trabalhador test -- cadastros`
Expected: FAIL — `Ferramenta desconhecida: listar_documentos`.

- [ ] **Step 2: `urlAssinada` com bucket**

Em `apps/trabalhador/src/midia/armazenamento.ts`, na interface trocar `urlAssinada(path: string, segundos: number): Promise<string>;` por `urlAssinada(path: string, segundos: number, bucket?: string): Promise<string>;` e na implementação:
```ts
    async urlAssinada(path, segundos, bucket = BUCKET) {
      const { data, error } = await db.storage.from(bucket).createSignedUrl(path, segundos);
      if (error || !data) throw new Error(`url assinada falhou: ${error?.message}`);
      return data.signedUrl;
    },
```

- [ ] **Step 3: Envio de documento**

Em `apps/trabalhador/src/envio.ts`, importar `import type { DocumentoEmpresa, Repos } from '@escritorio/db';` (substituindo a importação de `Repos`) e acrescentar depois de `enviarDoSistema`:
```ts
/** Documento da empresa (bucket "documentos"): registra antes, como em enviarDoSistema, e envia pela URL assinada. */
export async function enviarDocumentoDoSistema(
  d: DepsEnvio,
  p: { conversaId: string; telefone: string; clienteId: string; documento: DocumentoEmpresa },
): Promise<string> {
  const id = await d.repos.criarSaidaPendente({ conversaId: p.conversaId, clienteId: p.clienteId, autor: 'agente', conteudo: `📎 ${p.documento.nome}` });
  try {
    const url = await d.midia.urlAssinada(p.documento.arquivoPath, 600, 'documentos');
    const { idProvedor } = await d.canal.enviarArquivo(p.telefone, { url, nome: p.documento.arquivoNome });
    await d.repos.marcarEnviada(id, idProvedor);
    return id;
  } catch (e) {
    await d.repos.marcarFalha(id);
    throw e;
  }
}
```

- [ ] **Step 4: Ferramentas**

Em `apps/trabalhador/src/agente/ferramentas.ts`:

1. Importar `enviarDocumentoDoSistema` junto de `enviarDoSistema`: `import { enviarDocumentoDoSistema, enviarDoSistema, type DepsEnvio } from '../envio';`
2. Acrescentar ao array `FERRAMENTAS` (antes de `responder`):
```ts
  {
    name: 'listar_documentos',
    description: 'Lista os documentos cadastrados da empresa em foco (contrato social etc.) e se cada um pode ser enviado pela IA.',
    input_schema: objeto({}, []),
  },
  {
    name: 'enviar_documento',
    description: 'Envia pelo WhatsApp um documento da empresa em foco que esteja liberado para envio pela IA.',
    input_schema: objeto({ documento_id: { type: 'string' } }, ['documento_id']),
  },
```
3. Acrescentar a `Entradas`:
```ts
  listar_documentos: z.object({}),
  enviar_documento: z.object({ documento_id: z.string() }),
```
4. Acrescentar os casos no `switch`:
```ts
    case 'listar_documentos': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const docs = await d.repos.documentosDaEmpresa(e.clienteId);
      return ok({ documentos: docs.map((x) => ({ id: x.id, nome: x.nome, ia_pode_enviar: x.iaPodeEnviar })) });
    }

    case 'enviar_documento': {
      const e = exigirEmpresa(estado);
      if ('erro' in e) return e;
      const doc = (await d.repos.documentosDaEmpresa(e.clienteId)).find((x) => x.id === entrada.documento_id);
      if (!doc) return falha('Documento não encontrado nesta empresa. Use listar_documentos.');
      if (!doc.iaPodeEnviar) return falha('Este documento não está liberado para envio automático. Abra uma demanda com abrir_chamado para a equipe enviar.');
      const atual = await d.repos.obterConversa(ctx.conversa.id);
      if (atual.estado === 'humano') return falha('Um atendente assumiu esta conversa. Não envie nada.');
      await enviarDocumentoDoSistema(d.envio, { conversaId: ctx.conversa.id, telefone: ctx.conversa.telefone, clienteId: e.clienteId, documento: doc });
      estado.respondeu = true;
      return ok({ enviado: true, documento: doc.nome });
    }
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/trabalhador
git commit -m "feat(agente): listar e enviar documentos liberados da empresa pelo WhatsApp

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Regras do agente e cenários com o Claude real

**Files:**
- Modify: `apps/trabalhador/src/agente/prompt.ts`
- Modify: `apps/trabalhador/src/cenarios/cenarios.ts`, `apps/trabalhador/src/cenarios/rodar.ts`

**Interfaces:**
- Consumes: ferramentas das Tasks 4–6; `criarCadastrosExemplo` (Task 4).
- Produces: campos novos em `Cenario`: `cadastros?: boolean`, `espera.documentoEnviado?: string`, `espera.semDocumento?: boolean`, `espera.semTexto?: string[]`; `chamadoSetor` aceita `'qualquer'`.

- [ ] **Step 1: Cenários que falham**

Em `apps/trabalhador/src/cenarios/cenarios.ts`:

1. No tipo `Cenario`, acrescentar `cadastros?: boolean;   // cria os cadastros de exemplo (redes, fornecedor, produtos, preços, documentos)` e, dentro de `espera`:
```ts
    documentoEnviado?: string;              // nome do arquivo que deve ter sido enviado
    semDocumento?: boolean;                 // nenhum arquivo enviado
    semTexto?: string[];                    // textos que as respostas não podem conter
```
e trocar `chamadoSetor?: string | 'triagem' | 'nenhum';` por `chamadoSetor?: string | 'triagem' | 'nenhum' | 'qualquer';`.

2. Acrescentar ao fim do array `CENARIOS`:
```ts
  // Cadastros comerciais (dados inventados; ver criarCadastrosExemplo).
  { nome: 'nota para a filial certa pelo bairro, com preço da tabela', empresas: ['Indústria X'], cadastros: true,
    mensagens: ['Tira NF pro Brasil Santa Efigênia: 20 PAC costela e 15 PAC frango'],
    espera: { chamadoSetor: 'Fiscal', resumoContem: ['Santa Efigênia', 'CNPJ 11.111.111/0001-91', 'Costela com Requeijão (cód. 12)', 'R$ 190,00'], semTexto: ['R$'] } },
  { nome: 'rede com várias unidades: pergunta qual', empresas: ['Indústria X'], cadastros: true,
    mensagens: ['Tira uma NF pro Hortsul, 10 PAC costela'],
    espera: { chamadoSetor: 'nenhum', respostaContem: ['Gutierrez'] } },
  { nome: 'produto não cadastrado vai marcado', empresas: ['Indústria X'], cadastros: true,
    mensagens: ['Tira NF pro Brasil Santa Matilde: 5 PAC lasanha'],
    espera: { chamadoSetor: 'Fiscal', resumoContem: ['NÃO CADASTRADO', 'lasanha'] } },
  { nome: 'nota de devolução para fornecedor', empresas: ['Indústria X'], cadastros: true,
    mensagens: ['Preciso de uma nota de devolução pro Frigorífico Boi Bom, 3 PAC costela que veio estragada'],
    espera: { chamadoSetor: 'Fiscal', tituloContem: ['devolução'], resumoContem: ['Boi Bom'] } },
  { nome: 'contrato social liberado é enviado', empresas: ['Indústria X'], cadastros: true,
    mensagens: ['Me manda o contrato social da empresa, por favor?'],
    espera: { chamadoSetor: 'nenhum', documentoEnviado: 'contrato-social.pdf' } },
  { nome: 'documento não liberado vira demanda', empresas: ['Indústria X'], cadastros: true,
    mensagens: ['Me manda o balanço de 2025?'],
    espera: { chamadoSetor: 'qualquer', semDocumento: true } },
```

Em `apps/trabalhador/src/cenarios/rodar.ts`:

1. Importar `criarCadastrosExemplo` junto de `contatoComEmpresas`: `import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../../test/apoio/cenario';`
2. Em `preparar`, logo depois de `const { empresas, conversa } = await contatoComEmpresas(c.empresas);`, acrescentar `if (c.cadastros) await criarCadastrosExemplo(empresas[0]!.id);`
3. Depois de `if (e.chamadoSetor === 'triagem' && ...)`, acrescentar:
```ts
  if (e.chamadoSetor === 'qualquer' && !chamados?.length) falhas.push('esperava alguma demanda aberta');
```
e trocar a condição do setor específico por `if (e.chamadoSetor && !['nenhum', 'triagem', 'qualquer'].includes(e.chamadoSetor) && ...`.
4. Depois das checagens de `respostaContem`, acrescentar:
```ts
  const arquivos = canal.enviados.flatMap((x) => (x.arquivo ? [x.arquivo] : []));
  if (e.documentoEnviado && !arquivos.includes(e.documentoEnviado)) falhas.push(`esperava enviar ${e.documentoEnviado}; enviou ${JSON.stringify(arquivos)}`);
  if (e.semDocumento && arquivos.length) falhas.push(`não deveria enviar documento; enviou ${JSON.stringify(arquivos)}`);
  for (const t of e.semTexto ?? []) if (respostas.includes(t)) falhas.push(`resposta não deveria conter "${t}"`);
```

Run (trabalhador local parado): `pnpm --filter @escritorio/trabalhador cenarios`
Expected: FAIL nos cenários novos (o prompt ainda manda NF por `abrir_chamado`, sem CNPJ nem preço).

- [ ] **Step 2: Regras no prompt**

Em `apps/trabalhador/src/agente/prompt.ts`, substituir a regra `3a.` inteira por:
```
3a. Pedido de nota fiscal (o pedido mais comum), de venda ou de devolução:
   - Use buscar_parceiros com o texto do destinatário (tipo "cliente" para venda; "fornecedor" para devolução). Um candidato: use-o. Vários: pergunte ao cliente qual, citando as unidades pelo nome, e só siga depois da resposta. Nenhum: siga com unidade_id null.
   - Use buscar_produtos com os itens como o cliente escreveu. Um candidato: use-o. Vários: pergunte qual. Nenhum: siga com produto_id null.
   - Se o cliente ainda não disse os produtos e quantidades, pergunte ("Quais produtos e quantidades?") antes de buscar.
   - Abra com abrir_pedido_nota (uma chamada por nota pedida), passando o texto original do pedido sem alterar. O sistema preenche CNPJ, códigos e preços.
   - Nunca informe preços ao cliente. Confirme de forma curta ("Pode deixar, já passo pro Fiscal").
   - Pedido de correção ou cancelamento de nota já emitida é urgente: use abrir_chamado no setor Fiscal com o título começando por "URGENTE:".
   - Se buscar_parceiros, buscar_produtos ou abrir_pedido_nota derem erro que não seja de empresa não definida, abra com abrir_chamado no Fiscal copiando o pedido original.
3b. Pedido de documento da empresa (contrato social, cartão CNPJ etc.): use listar_documentos. Se o documento existir e ia_pode_enviar for verdadeiro, envie com enviar_documento e confirme curto. Caso contrário, abra uma demanda com abrir_chamado para a equipe enviar.
```

- [ ] **Step 3: Rodar os cenários e ajustar só o prompt até passar**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador cenarios`
Expected: testes PASS e `25/25 cenários passaram`. Se algum cenário falhar, ajustar **apenas** o texto das regras 3a/3b (ou as descrições das ferramentas); não afrouxar expectativas. Rodar duas vezes seguidas para confirmar estabilidade.

- [ ] **Step 4: Commit**

```bash
git add apps/trabalhador
git commit -m "feat(agente): regras de nota e documento usando os cadastros; 6 cenários novos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Painel — ficha em abas, clientes da empresa e fornecedores

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/[id]/abas.tsx`, `secao-dados.tsx`, `secao-contatos.tsx`, `secao-parceiros.tsx`
- Modify: `apps/painel/src/app/(painel)/clientes/[id]/page.tsx`
- Create: `apps/painel/src/app/(painel)/clientes/cadastros-esquemas.ts`, `cadastros-esquemas.test.ts`, `cadastros-acoes.ts`
- Modify: `apps/painel/e2e/clientes.spec.ts` (clicar na aba Contatos)
- Test: `apps/painel/e2e/cadastros.spec.ts`

**Interfaces:**
- Consumes: tabelas da Task 1; `obterUsuario`, `temPermissao`; `supabaseServidor`; `adicionarContato`, `removerContato`, `anonimizarContato`, `salvarCliente`, `salvarServicos`, `salvarResponsaveis` (acoes.ts existente).
- Produces: `listaDeTexto(v: unknown): string[]` (separa por vírgula); esquemas `GrupoForm`, `UnidadeForm`, `ProdutoForm`, `PrecoForm`; ações `salvarGrupo(clienteId, tipo, grupoId | null, formData)`, `salvarUnidade(clienteId, grupoId, unidadeId | null, formData)`; `AbasCliente({ id, atual })`; abas `dados | contatos | clientes | fornecedores | produtos | precos | documentos` via `?aba=`.

- [ ] **Step 1: Teste dos esquemas que falha**

`apps/painel/src/app/(painel)/clientes/cadastros-esquemas.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { GrupoForm, PrecoForm, ProdutoForm, UnidadeForm, listaDeTexto } from './cadastros-esquemas';

describe('listaDeTexto', () => {
  it('separa por vírgula, tira espaços e vazios', () => {
    expect(listaDeTexto(' brasil, loja sete ,, ')).toEqual(['brasil', 'loja sete']);
    expect(listaDeTexto(null)).toEqual([]);
  });
});

describe('esquemas', () => {
  it('rede com palavras-chave', () => {
    expect(GrupoForm.parse({ nome: ' Supermercado Brasil ', palavras_chave: 'brasil, sb', ativo: 'on' }))
      .toEqual({ nome: 'Supermercado Brasil', palavras_chave: ['brasil', 'sb'], ativo: true });
  });
  it('unidade: CNPJ opcional, mas válido se informado; UF em maiúsculas', () => {
    expect(UnidadeForm.parse({ nome_unidade: 'Santa Efigênia', cnpj: '11.222.333/0001-81', uf: 'mg', palavras_chave: 'efigenia' }))
      .toMatchObject({ nome_unidade: 'Santa Efigênia', cnpj: '11222333000181', uf: 'MG', palavras_chave: ['efigenia'], ativo: false });
    expect(UnidadeForm.parse({ nome_unidade: 'Matriz', cnpj: '' }).cnpj).toBeNull();
    expect(UnidadeForm.safeParse({ nome_unidade: 'X', cnpj: '11222333000182' }).success).toBe(false);
  });
  it('produto e preço', () => {
    expect(ProdutoForm.parse({ codigo: '12', descricao: 'Costela com Requeijão', unidade: 'pac', apelidos: 'costela' }))
      .toMatchObject({ codigo: '12', unidade: 'PAC', apelidos: ['costela'] });
    expect(PrecoForm.parse({ valor: '9,50' }).valor).toBe(9.5);
    expect(PrecoForm.safeParse({ valor: '0' }).success).toBe(false);
  });
});
```

Run: `pnpm --filter @escritorio/painel test`
Expected: FAIL — `Cannot find module './cadastros-esquemas'`.

- [ ] **Step 2: Esquemas**

`apps/painel/src/app/(painel)/clientes/cadastros-esquemas.ts`:
```ts
import { z } from 'zod';
import { somenteDigitos, validarCnpj } from '@escritorio/core';

/** Palavras-chave e apelidos são digitados separados por vírgula. */
export function listaDeTexto(v: unknown): string[] {
  return String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

const lista = z.preprocess(listaDeTexto, z.array(z.string()));
const caixa = z.preprocess((v) => v === 'on' || v === true, z.boolean());
const opcional = z.preprocess((v) => (v === '' || v === null || v === undefined ? null : String(v).trim()), z.string().nullable());

export const GrupoForm = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  palavras_chave: lista,
  ativo: caixa,
});

export const UnidadeForm = z.object({
  nome_unidade: z.string().trim().min(1, 'Informe o nome da unidade'),
  razao_social: opcional,
  cnpj: z.preprocess((v) => (v ? somenteDigitos(String(v)) : null),
    z.string().nullable().refine((c) => c === null || validarCnpj(c), 'CNPJ inválido')),
  inscricao_estadual: opcional,
  endereco: opcional,
  bairro: opcional,
  cidade: opcional,
  uf: z.preprocess((v) => (v ? String(v).trim().toUpperCase() : null), z.string().length(2).nullable()),
  palavras_chave: lista,
  ativo: caixa,
});

export const ProdutoForm = z.object({
  codigo: z.string().trim().min(1, 'Informe o código'),
  descricao: z.string().trim().min(2, 'Informe a descrição'),
  unidade: z.preprocess((v) => String(v ?? 'UN').trim().toUpperCase() || 'UN', z.string().max(10)),
  apelidos: lista,
  ativo: caixa,
});

export const PrecoForm = z.object({
  valor: z.preprocess((v) => Number(String(v ?? '').replace(/\./g, '').replace(',', '.')), z.number().positive('Informe um valor maior que zero')),
});
```

Run: `pnpm --filter @escritorio/painel test` → PASS.

- [ ] **Step 3: Ações de redes e unidades**

`apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts`:
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { GrupoForm, UnidadeForm } from './cadastros-esquemas';

async function exigirEdicao() {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) throw new Error('Você não tem permissão para editar cadastros.');
  return { u, sb: await supabaseServidor() };
}
const campos = (f: FormData) => Object.fromEntries(f.entries());
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message.includes('duplicate') ? 'Já existe um cadastro igual (nome, CNPJ ou código repetido).' : r.error.message);
}

export async function salvarGrupo(clienteId: string, tipo: 'cliente' | 'fornecedor', grupoId: string | null, formData: FormData) {
  const { sb } = await exigirEdicao();
  const dados = GrupoForm.parse({ ativo: grupoId ? undefined : 'on', ...campos(formData) });
  checar(grupoId
    ? await sb.from('parceiros_grupos').update(dados).eq('id', grupoId).eq('cliente_id', clienteId)
    : await sb.from('parceiros_grupos').insert({ ...dados, cliente_id: clienteId, tipo }));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function salvarUnidade(clienteId: string, grupoId: string, unidadeId: string | null, formData: FormData) {
  const { sb } = await exigirEdicao();
  const dados = UnidadeForm.parse({ ativo: unidadeId ? undefined : 'on', ...campos(formData) });
  checar(unidadeId
    ? await sb.from('parceiros_unidades').update(dados).eq('id', unidadeId).eq('cliente_id', clienteId)
    : await sb.from('parceiros_unidades').insert({ ...dados, cliente_id: clienteId, grupo_id: grupoId }));
  revalidatePath(`/clientes/${clienteId}`);
}
```
(Criar já nasce ativo; ao editar, o checkbox "Ativo" do formulário decide.)

- [ ] **Step 4: Abas e seções**

`apps/painel/src/app/(painel)/clientes/[id]/abas.tsx`:
```tsx
import Link from 'next/link';

export const ABAS = [
  { valor: 'dados', rotulo: 'Dados' },
  { valor: 'contatos', rotulo: 'Contatos' },
  { valor: 'clientes', rotulo: 'Clientes da empresa' },
  { valor: 'fornecedores', rotulo: 'Fornecedores' },
  { valor: 'produtos', rotulo: 'Produtos' },
  { valor: 'precos', rotulo: 'Preços' },
  { valor: 'documentos', rotulo: 'Documentos' },
] as const;
export type Aba = (typeof ABAS)[number]['valor'];

export function AbasCliente({ id, atual }: { id: string; atual: Aba }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {ABAS.map((a) => (
        <Link key={a.valor} href={`/clientes/${id}?aba=${a.valor}`}
          className={`rounded-t px-3 py-2 text-sm ${a.valor === atual ? 'border border-b-white bg-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
```

`apps/painel/src/app/(painel)/clientes/[id]/secao-dados.tsx` — recebe `{ id, u, pode, c }` e contém, **sem mudar o JSX**, os três blocos atuais da página: o formulário "Dados", o formulário "Serviços do contrato" e o formulário "Responsável por setor", com as consultas que eles usam:
```tsx
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { Database } from '@escritorio/db';
import { salvarCliente, salvarResponsaveis, salvarServicos } from '../acoes';

type Cliente = Database['public']['Tables']['clientes']['Row'];

export async function SecaoDados({ id, u, pode, c }: { id: string; u: UsuarioPainel; pode: boolean; c: Cliente }) {
  const sb = await supabaseServidor();
  const [{ data: servicos }, { data: contratados }, { data: setores }, { data: usuarios }, { data: resp }] = await Promise.all([
    sb.from('servicos').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('cliente_servicos').select('servico_id').eq('cliente_id', id),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', id),
  ]);
  const marcados = new Set((contratados ?? []).map((s) => s.servico_id));
  const campo = 'mt-1 w-full rounded border p-2 disabled:bg-slate-50';
  return (
    <div className="space-y-6">
      {/* formulário Dados: copiar exatamente o <form action={salvarCliente.bind(null, id)}> ... </form> atual da página */}
      {/* formulário Serviços: copiar exatamente o <form action={salvarServicos.bind(null, id)}> ... </form> atual */}
      {/* formulário Responsáveis: copiar exatamente o <form action={salvarResponsaveis.bind(null, id)}> ... </form> atual */}
    </div>
  );
}
```
Os três comentários acima indicam **onde colar** os blocos JSX existentes de `page.tsx` (linhas do `<form action={salvarCliente...}>` até o `</form>` de "Responsável por setor", exceto a `<section>` de contatos). Após colar, não pode restar nenhum comentário `{/* ... */}` no arquivo.

`apps/painel/src/app/(painel)/clientes/[id]/secao-contatos.tsx` — recebe `{ id, u, pode }`, faz a consulta de `contato_clientes` que hoje está na página e contém, sem mudar o JSX, a `<section>` "Contatos autorizados no WhatsApp" atual:
```tsx
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { adicionarContato, anonimizarContato, removerContato } from '../acoes';

export async function SecaoContatos({ id, u, pode }: { id: string; u: UsuarioPainel; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: vinculos } = await sb.from('contato_clientes')
    .select('pode_pedir_nota, pode_atualizar_preco, contatos(id, nome, telefone)').eq('cliente_id', id);
  return (
    <>
      {/* colar exatamente a <section className="rounded-lg border bg-white p-4"> de contatos atual da página */}
    </>
  );
}
```
(Mesma regra: colar o bloco existente e remover o comentário.)

`apps/painel/src/app/(painel)/clientes/[id]/secao-parceiros.tsx`:
```tsx
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarGrupo, salvarUnidade } from '../cadastros-acoes';

const input = 'rounded border p-2 text-sm disabled:bg-slate-50';

export async function SecaoParceiros({ id, tipo, pode }: { id: string; tipo: 'cliente' | 'fornecedor'; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: grupos } = await sb.from('parceiros_grupos')
    .select('id, nome, palavras_chave, ativo, parceiros_unidades(id, nome_unidade, razao_social, cnpj, inscricao_estadual, endereco, bairro, cidade, uf, palavras_chave, ativo)')
    .eq('cliente_id', id).eq('tipo', tipo).order('nome');
  const nomeGrupo = tipo === 'cliente' ? 'rede/cliente' : 'fornecedor';

  const camposUnidade = (un?: NonNullable<typeof grupos>[number]['parceiros_unidades'][number]) => (
    <fieldset disabled={!pode} className="grid grid-cols-3 gap-2">
      <input name="nome_unidade" defaultValue={un?.nome_unidade} placeholder="Nome da unidade (ex.: Santa Efigênia)" required className={input} />
      <input name="razao_social" defaultValue={un?.razao_social ?? ''} placeholder="Razão social" className={input} />
      <input name="cnpj" defaultValue={un?.cnpj ?? ''} placeholder="CNPJ" className={input} />
      <input name="inscricao_estadual" defaultValue={un?.inscricao_estadual ?? ''} placeholder="Inscrição estadual" className={input} />
      <input name="endereco" defaultValue={un?.endereco ?? ''} placeholder="Endereço" className={input} />
      <input name="bairro" defaultValue={un?.bairro ?? ''} placeholder="Bairro" className={input} />
      <input name="cidade" defaultValue={un?.cidade ?? ''} placeholder="Cidade" className={input} />
      <input name="uf" defaultValue={un?.uf ?? ''} placeholder="UF" maxLength={2} className={input} />
      <input name="palavras_chave" defaultValue={un?.palavras_chave.join(', ')} placeholder="Palavras-chave, separadas por vírgula" className={input} />
    </fieldset>
  );

  return (
    <div className="space-y-4">
      {(grupos ?? []).length === 0 && <p className="text-sm text-slate-500">Nenhum {nomeGrupo} cadastrado.</p>}
      {(grupos ?? []).map((g) => (
        <section key={g.id} className={`space-y-3 rounded-lg border bg-white p-4 ${g.ativo ? '' : 'opacity-60'}`}>
          <form action={salvarGrupo.bind(null, id, tipo, g.id)} className="flex flex-wrap items-center gap-2">
            <fieldset disabled={!pode} className="contents">
              <input name="nome" defaultValue={g.nome} required className={`${input} font-semibold`} aria-label={`Nome de ${g.nome}`} />
              <input name="palavras_chave" defaultValue={g.palavras_chave.join(', ')} placeholder="Palavras-chave da rede" className={`${input} flex-1`} />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="ativo" defaultChecked={g.ativo} /> Ativo</label>
              {pode && <button className="rounded border px-3 py-1 text-sm">Salvar</button>}
            </fieldset>
          </form>
          <ul className="space-y-2">
            {g.parceiros_unidades.map((un) => (
              <li key={un.id}>
                <details className="rounded border p-2 text-sm">
                  <summary className="cursor-pointer">
                    {un.nome_unidade}{un.bairro ? ` · ${un.bairro}` : ''}{un.cidade ? ` · ${un.cidade}` : ''}{un.cnpj ? ` · CNPJ ${un.cnpj}` : ''}{un.ativo ? '' : ' · inativa'}
                  </summary>
                  <form action={salvarUnidade.bind(null, id, g.id, un.id)} className="mt-2 space-y-2">
                    {camposUnidade(un)}
                    <label className="flex items-center gap-1"><input type="checkbox" name="ativo" defaultChecked={un.ativo} disabled={!pode} /> Ativa</label>
                    {pode && <button className="rounded bg-slate-900 px-3 py-1 text-white">Salvar unidade</button>}
                  </form>
                </details>
              </li>
            ))}
          </ul>
          {pode && (
            <form action={salvarUnidade.bind(null, id, g.id, null)} className="space-y-2 border-t pt-3 text-sm">
              <p className="font-medium">Nova unidade de {g.nome}</p>
              {camposUnidade()}
              <button className="rounded border px-3 py-1">Adicionar unidade</button>
            </form>
          )}
        </section>
      ))}
      {pode && (
        <form action={salvarGrupo.bind(null, id, tipo, null)} className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-4 text-sm">
          <input name="nome" required placeholder={tipo === 'cliente' ? 'Nova rede/cliente (ex.: Supermercado Brasil)' : 'Novo fornecedor'} className={`${input} flex-1`} />
          <input name="palavras_chave" placeholder="Palavras-chave, separadas por vírgula" className={`${input} flex-1`} />
          <button className="rounded bg-slate-900 px-3 py-2 text-white">{tipo === 'cliente' ? 'Criar rede' : 'Criar fornecedor'}</button>
        </form>
      )}
    </div>
  );
}
```

Substituir `apps/painel/src/app/(painel)/clientes/[id]/page.tsx` por:
```tsx
import { notFound } from 'next/navigation';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ABAS, AbasCliente, type Aba } from './abas';
import { SecaoContatos } from './secao-contatos';
import { SecaoDados } from './secao-dados';
import { SecaoParceiros } from './secao-parceiros';

export default async function FichaCliente({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const pedida = (await searchParams).aba;
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? (pedida as Aba) : 'dados';
  const u = await obterUsuario();
  const pode = temPermissao(u, 'editar_clientes');
  const sb = await supabaseServidor();
  const { data: c } = await sb.from('clientes').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">{c.nome_fantasia ?? c.razao_social}</h1>
      <AbasCliente id={id} atual={aba} />
      {aba === 'dados' && <SecaoDados id={id} u={u} pode={pode} c={c} />}
      {aba === 'contatos' && <SecaoContatos id={id} u={u} pode={pode} />}
      {aba === 'clientes' && <SecaoParceiros id={id} tipo="cliente" pode={pode} />}
      {aba === 'fornecedores' && <SecaoParceiros id={id} tipo="fornecedor" pode={pode} />}
    </div>
  );
}
```
(As abas `produtos`, `precos` e `documentos` ganham conteúdo nas Tasks 9 e 10; até lá mostram só a navegação.)

- [ ] **Step 5: Ajustar o e2e existente e escrever o novo**

Em `apps/painel/e2e/clientes.spec.ts`, no primeiro teste, logo antes de `await page.getByLabel('Nome', { exact: true }).fill('João');`, acrescentar:
```ts
  await page.getByRole('link', { name: 'Contatos', exact: true }).click();
```

`apps/painel/e2e/cadastros.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const CNPJ_EMPRESA = '11444777000161';

async function empresaDeTeste() {
  await db.from('clientes').delete().eq('cnpj', CNPJ_EMPRESA);
  const { data } = await db.from('clientes').insert({ razao_social: 'Indústria Cadastros Teste', cnpj: CNPJ_EMPRESA }).select().single();
  return data!.id as string;
}

test('administrador cadastra rede, unidade com CNPJ e fornecedor', async ({ page }) => {
  const id = await empresaDeTeste();
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}`);
  await page.getByRole('link', { name: 'Clientes da empresa' }).click();
  await page.getByPlaceholder('Nova rede/cliente (ex.: Supermercado Brasil)').fill('Supermercado Brasil');
  await page.getByPlaceholder('Palavras-chave, separadas por vírgula').last().fill('brasil');
  await page.getByRole('button', { name: 'Criar rede' }).click();
  await expect(page.getByLabel('Nome de Supermercado Brasil')).toBeVisible();

  await page.getByPlaceholder('Nome da unidade (ex.: Santa Efigênia)').fill('Santa Efigênia');
  await page.getByPlaceholder('CNPJ').fill('11.222.333/0001-81');
  await page.getByPlaceholder('Bairro').fill('Santa Efigênia');
  await page.getByRole('button', { name: 'Adicionar unidade' }).click();
  await expect(page.getByText('Santa Efigênia · Santa Efigênia · CNPJ 11222333000181')).toBeVisible();

  await page.getByRole('link', { name: 'Fornecedores' }).click();
  await page.getByPlaceholder('Novo fornecedor').fill('Frigorífico Boi Bom');
  await page.getByRole('button', { name: 'Criar fornecedor' }).click();
  await expect(page.getByLabel('Nome de Frigorífico Boi Bom')).toBeVisible();
});

test('atendente sem permissão vê os cadastros mas não edita', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Hortsul' });
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: 'senha-forte-123', nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=clientes`);
  await expect(page.getByLabel('Nome de Hortsul')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Criar rede' })).toHaveCount(0);
});
```

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel e2e`
Expected: PASS (e2e: os 11 existentes + 2 novos).

- [ ] **Step 6: Commit**

```bash
git add apps/painel
git commit -m "feat(painel): ficha do cliente em abas; clientes da empresa e fornecedores com unidades e palavras-chave

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Painel — produtos, preços por rede e histórico

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/[id]/secao-produtos.tsx`, `secao-precos.tsx`
- Modify: `apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts` (acrescenta `salvarProduto`, `definirPreco`)
- Modify: `apps/painel/src/app/(painel)/clientes/[id]/page.tsx`
- Modify: `apps/painel/e2e/cadastros.spec.ts`

**Interfaces:**
- Consumes: `ProdutoForm`, `PrecoForm` (Task 8); função `definir_preco` (Task 1).
- Produces: `salvarProduto(clienteId, produtoId | null, formData)`; `definirPreco(clienteId, grupoId, produtoId, formData)`; página aceita `?aba=precos&historico=<grupoId>:<produtoId>`.

- [ ] **Step 1: e2e que falha**

Acrescentar a `apps/painel/e2e/cadastros.spec.ts`:
```ts
test('cadastra produto, define preço para a rede e vê o histórico', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.goto(`/clientes/${id}?aba=produtos`);
  await page.getByPlaceholder('Código').last().fill('12');
  await page.getByPlaceholder('Descrição').last().fill('Costela com Requeijão');
  await page.getByPlaceholder('Unidade (PAC, KG…)').last().fill('PAC');
  await page.getByPlaceholder('Apelidos, separados por vírgula').last().fill('costela');
  await page.getByRole('button', { name: 'Adicionar produto' }).click();
  await expect(page.getByLabel('Descrição de 12')).toHaveValue('Costela com Requeijão');

  await page.getByRole('link', { name: 'Preços' }).click();
  const campo = page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil');
  await campo.fill('9,50');
  await campo.press('Enter');
  await expect(campo).toHaveValue('9,50');
  await campo.fill('10,00');
  await campo.press('Enter');
  await expect(campo).toHaveValue('10,00');

  await page.getByRole('link', { name: 'histórico' }).first().click();
  await expect(page.getByText('R$ 9,50')).toBeVisible();
  await expect(page.getByText('R$ 10,00 · vigente')).toBeVisible();
});

test('quem não tem Editar preços não vê o campo de preço editável', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' });
  await db.from('produtos').insert({ cliente_id: id, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC' });
  await criarUsuarioTeste({ email: 'bia@teste.com', senha: 'senha-forte-123', nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=precos`);
  await expect(page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil')).toBeDisabled();
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/cadastros.spec.ts`
Expected: FAIL nos 2 testes novos (abas vazias).

- [ ] **Step 2: Ações**

Acrescentar a `apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts` (e incluir `PrecoForm, ProdutoForm` na importação de `./cadastros-esquemas`):
```ts
export async function salvarProduto(clienteId: string, produtoId: string | null, formData: FormData) {
  const { sb } = await exigirEdicao();
  const dados = ProdutoForm.parse({ ativo: produtoId ? undefined : 'on', ...campos(formData) });
  checar(produtoId
    ? await sb.from('produtos').update(dados).eq('id', produtoId).eq('cliente_id', clienteId)
    : await sb.from('produtos').insert({ ...dados, cliente_id: clienteId }));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function definirPreco(clienteId: string, grupoId: string, produtoId: string, formData: FormData) {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_precos')) throw new Error('Você não tem permissão para editar preços.');
  const { valor } = PrecoForm.parse(campos(formData));
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('definir_preco', { p_grupo: grupoId, p_produto: produtoId, p_valor: valor });
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${clienteId}`);
}
```

- [ ] **Step 3: Seções**

`apps/painel/src/app/(painel)/clientes/[id]/secao-produtos.tsx`:
```tsx
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarProduto } from '../cadastros-acoes';

const input = 'rounded border p-2 text-sm disabled:bg-slate-50';

export async function SecaoProdutos({ id, pode }: { id: string; pode: boolean }) {
  const sb = await supabaseServidor();
  const { data: produtos } = await sb.from('produtos').select('*').eq('cliente_id', id).order('descricao');
  return (
    <div className="space-y-2 rounded-lg border bg-white p-4">
      {(produtos ?? []).length === 0 && <p className="text-sm text-slate-500">Nenhum produto cadastrado.</p>}
      {(produtos ?? []).map((p) => (
        <form key={p.id} action={salvarProduto.bind(null, id, p.id)} className={`grid grid-cols-[6rem_1fr_6rem_1fr_auto_auto] items-center gap-2 ${p.ativo ? '' : 'opacity-60'}`}>
          <fieldset disabled={!pode} className="contents">
            <input name="codigo" defaultValue={p.codigo} className={input} aria-label={`Código de ${p.codigo}`} />
            <input name="descricao" defaultValue={p.descricao} className={input} aria-label={`Descrição de ${p.codigo}`} />
            <input name="unidade" defaultValue={p.unidade} className={input} aria-label={`Unidade de ${p.codigo}`} />
            <input name="apelidos" defaultValue={p.apelidos.join(', ')} className={input} aria-label={`Apelidos de ${p.codigo}`} />
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="ativo" defaultChecked={p.ativo} /> Ativo</label>
            {pode ? <button className="rounded border px-3 py-1 text-sm">Salvar</button> : <span />}
          </fieldset>
        </form>
      ))}
      {pode && (
        <form action={salvarProduto.bind(null, id, null)} className="grid grid-cols-[6rem_1fr_6rem_1fr_auto] gap-2 border-t pt-3">
          <input name="codigo" placeholder="Código" required className={input} />
          <input name="descricao" placeholder="Descrição" required className={input} />
          <input name="unidade" placeholder="Unidade (PAC, KG…)" className={input} />
          <input name="apelidos" placeholder="Apelidos, separados por vírgula" className={input} />
          <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white">Adicionar produto</button>
        </form>
      )}
    </div>
  );
}
```

`apps/painel/src/app/(painel)/clientes/[id]/secao-precos.tsx`:
```tsx
import Link from 'next/link';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { definirPreco } from '../cadastros-acoes';

const reais = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const valorCampo = (v: number) => v.toFixed(2).replace('.', ',');
const data = (iso: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));

export async function SecaoPrecos({ id, podeEditar, historico }: { id: string; podeEditar: boolean; historico?: string }) {
  const sb = await supabaseServidor();
  const [{ data: redes }, { data: produtos }, { data: vigentes }] = await Promise.all([
    sb.from('parceiros_grupos').select('id, nome').eq('cliente_id', id).eq('tipo', 'cliente').eq('ativo', true).order('nome'),
    sb.from('produtos').select('id, codigo, descricao, unidade').eq('cliente_id', id).eq('ativo', true).order('descricao'),
    sb.from('precos').select('grupo_id, produto_id, valor').eq('cliente_id', id).is('vigente_ate', null),
  ]);
  const preco = (g: string, p: string) => vigentes?.find((x) => x.grupo_id === g && x.produto_id === p)?.valor;
  const [hGrupo, hProduto] = (historico ?? '').split(':');
  const { data: linhasHistorico } = hGrupo && hProduto
    ? await sb.from('precos').select('valor, vigente_desde, vigente_ate, usuarios(nome)').eq('grupo_id', hGrupo).eq('produto_id', hProduto).order('vigente_desde', { ascending: false })
    : { data: null };

  if (!(redes ?? []).length || !(produtos ?? []).length) {
    return <p className="rounded-lg border bg-white p-4 text-sm text-slate-500">Cadastre ao menos uma rede em "Clientes da empresa" e um produto em "Produtos" para montar a tabela de preços.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-slate-50"><th className="p-2 text-left">Produto</th>{redes!.map((r) => <th key={r.id} className="p-2 text-left">{r.nome}</th>)}</tr></thead>
          <tbody>
            {produtos!.map((p) => (
              <tr key={p.id} className="border-b">
                <td className="p-2">{p.descricao} <span className="text-slate-500">({p.codigo} · {p.unidade})</span></td>
                {redes!.map((r) => {
                  const v = preco(r.id, p.id);
                  return (
                    <td key={r.id} className="p-2">
                      <form action={definirPreco.bind(null, id, r.id, p.id)} className="flex items-center gap-1">
                        R$ <input name="valor" defaultValue={v !== undefined ? valorCampo(Number(v)) : ''} disabled={!podeEditar}
                          aria-label={`Preço de ${p.descricao} para ${r.nome}`} className="w-24 rounded border p-1 disabled:bg-slate-50" />
                        <Link href={`/clientes/${id}?aba=precos&historico=${r.id}:${p.id}`} className="text-xs text-blue-700 underline">histórico</Link>
                      </form>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {linhasHistorico && (
        <section className="rounded-lg border bg-white p-4 text-sm">
          <h2 className="mb-2 font-semibold">Histórico de preço</h2>
          {linhasHistorico.length === 0 && <p className="text-slate-500">Sem preços registrados.</p>}
          <ul className="space-y-1">
            {linhasHistorico.map((h, i) => (
              <li key={i}>{reais(Number(h.valor))}{h.vigente_ate ? '' : ' · vigente'} · desde {data(h.vigente_desde)}{h.vigente_ate ? ` até ${data(h.vigente_ate)}` : ''}{h.usuarios?.nome ? ` · por ${h.usuarios.nome}` : ''}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```
(Enter no campo envia o formulário da célula; quem não tem `editar_precos` vê o campo desabilitado.)

- [ ] **Step 4: Ligar as abas na página**

Em `apps/painel/src/app/(painel)/clientes/[id]/page.tsx`:
- trocar a assinatura de `searchParams` para `Promise<{ aba?: string; historico?: string }>` e ler `const { aba: pedida, historico } = await searchParams;` (removendo a linha `const pedida = ...` antiga);
- importar `SecaoProdutos` e `SecaoPrecos`;
- acrescentar depois da linha de fornecedores:
```tsx
      {aba === 'produtos' && <SecaoProdutos id={id} pode={pode} />}
      {aba === 'precos' && <SecaoPrecos id={id} podeEditar={temPermissao(u, 'editar_precos')} historico={historico} />}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel exec playwright test e2e/cadastros.spec.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add apps/painel
git commit -m "feat(painel): produtos e tabela de preços por rede com histórico

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Painel — documentos da empresa

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/[id]/secao-documentos.tsx`
- Create: `apps/painel/src/app/api/documentos/route.ts`
- Modify: `apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts` (acrescenta `enviarDocumento`, `alternarIaDocumento`, `excluirDocumento`)
- Modify: `apps/painel/src/app/(painel)/clientes/[id]/page.tsx`
- Modify: `apps/painel/e2e/cadastros.spec.ts`

**Interfaces:**
- Consumes: tabela `documentos_empresa` e bucket `documentos` (Task 1); `registrarAuditoria` (`@/lib/auditoria`); `exigirAdmin`.
- Produces: `enviarDocumento(clienteId, formData)`; `alternarIaDocumento(clienteId, documentoId, liberar: boolean)`; `excluirDocumento(clienteId, documentoId)`; rota `GET /api/documentos?id=<documentoId>` (redireciona para URL assinada; registra auditoria `download`).

- [ ] **Step 1: e2e que falha**

Acrescentar a `apps/painel/e2e/cadastros.spec.ts`:
```ts
test('envia documento, libera para a IA e baixa', async ({ page }) => {
  const id = await empresaDeTeste();
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=documentos`);
  await page.getByPlaceholder('Nome do documento (ex.: Contrato social)').fill('Contrato social');
  await page.locator('input[name="arquivo"]').setInputFiles({ name: 'contrato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') });
  await page.getByRole('button', { name: 'Enviar documento' }).click();
  await expect(page.getByText('Contrato social · contrato.pdf')).toBeVisible();
  await expect(page.getByText('só a equipe envia')).toBeVisible();

  await page.getByRole('button', { name: 'Liberar para a IA' }).click();
  await expect(page.getByText('a IA pode enviar sozinha')).toBeVisible();
  const { data } = await db.from('documentos_empresa').select('ia_pode_enviar').eq('cliente_id', id).single();
  expect(data!.ia_pode_enviar).toBe(true);

  const [download] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Baixar' }).click()]);
  await expect(download).toHaveURL(/\/storage\/v1\/object\/sign\/documentos\//);
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/cadastros.spec.ts`
Expected: FAIL no teste novo.

- [ ] **Step 2: Ações**

Acrescentar a `apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts` (e `import { exigirAdmin } from '@/lib/sessao';` junto das importações de sessão):
```ts
export async function enviarDocumento(clienteId: string, formData: FormData) {
  const { u, sb } = await exigirEdicao();
  const nome = String(formData.get('nome') ?? '').trim();
  const arquivo = formData.get('arquivo');
  if (!nome || !(arquivo instanceof File) || arquivo.size === 0) throw new Error('Informe o nome e escolha o arquivo.');
  const arquivoNome = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
  const path = `clientes/${clienteId}/${Date.now()}-${arquivoNome}`;
  const mime = arquivo.type || 'application/pdf';
  const up = await sb.storage.from('documentos').upload(path, arquivo, { contentType: mime });
  if (up.error) throw new Error(`Falha ao enviar o arquivo: ${up.error.message}`);
  checar(await sb.from('documentos_empresa').insert({ cliente_id: clienteId, nome, arquivo_path: path, arquivo_nome: arquivoNome, arquivo_mime: mime, enviado_por: u.id }));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function alternarIaDocumento(clienteId: string, documentoId: string, liberar: boolean) {
  const { sb } = await exigirEdicao();
  checar(await sb.from('documentos_empresa').update({ ia_pode_enviar: liberar }).eq('id', documentoId).eq('cliente_id', clienteId));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function excluirDocumento(clienteId: string, documentoId: string) {
  await exigirAdmin();
  const sb = await supabaseServidor();
  const { data: doc } = await sb.from('documentos_empresa').select('arquivo_path').eq('id', documentoId).eq('cliente_id', clienteId).single();
  checar(await sb.from('documentos_empresa').delete().eq('id', documentoId));
  if (doc) await sb.storage.from('documentos').remove([doc.arquivo_path]);
  revalidatePath(`/clientes/${clienteId}`);
}
```

- [ ] **Step 3: Seção, rota de download e página**

`apps/painel/src/app/(painel)/clientes/[id]/secao-documentos.tsx`:
```tsx
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarIaDocumento, enviarDocumento, excluirDocumento } from '../cadastros-acoes';

export async function SecaoDocumentos({ id, pode, admin }: { id: string; pode: boolean; admin: boolean }) {
  const sb = await supabaseServidor();
  const { data: docs } = await sb.from('documentos_empresa').select('id, nome, arquivo_nome, ia_pode_enviar').eq('cliente_id', id).order('nome');
  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 text-sm">
      <p className="text-slate-500">Documentos marcados como "a IA pode enviar sozinha" são enviados na hora quando um contato autorizado desta empresa pedir. Os outros viram demanda para a equipe.</p>
      {(docs ?? []).length === 0 && <p className="text-slate-500">Nenhum documento cadastrado.</p>}
      <ul className="divide-y">
        {(docs ?? []).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>{d.nome} · {d.arquivo_nome} · <span className={d.ia_pode_enviar ? 'text-emerald-700' : 'text-slate-500'}>{d.ia_pode_enviar ? 'a IA pode enviar sozinha' : 'só a equipe envia'}</span></span>
            <div className="flex items-center gap-3">
              <a href={`/api/documentos?id=${d.id}`} target="_blank" className="text-blue-700 underline">Baixar</a>
              {pode && (
                <form action={alternarIaDocumento.bind(null, id, d.id, !d.ia_pode_enviar)}>
                  <button className="rounded border px-2 py-1">{d.ia_pode_enviar ? 'Bloquear para a IA' : 'Liberar para a IA'}</button>
                </form>
              )}
              {admin && <form action={excluirDocumento.bind(null, id, d.id)}><button className="text-red-700 underline">Excluir</button></form>}
            </div>
          </li>
        ))}
      </ul>
      {pode && (
        <form action={enviarDocumento.bind(null, id)} className="flex flex-wrap items-center gap-2 border-t pt-3">
          <input name="nome" required placeholder="Nome do documento (ex.: Contrato social)" className="flex-1 rounded border p-2" />
          <input name="arquivo" type="file" required accept="application/pdf,image/*" className="text-xs" />
          <button className="rounded bg-slate-900 px-3 py-2 text-white">Enviar documento</button>
        </form>
      )}
    </div>
  );
}
```

`apps/painel/src/app/api/documentos/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { registrarAuditoria } from '@/lib/auditoria';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Baixa um documento da empresa: o RLS decide o acesso; todo download fica na auditoria. */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const sb = await supabaseServidor();
  const { data: doc } = await sb.from('documentos_empresa').select('arquivo_path').eq('id', id).maybeSingle();
  if (!doc) return new NextResponse('Documento não encontrado ou sem acesso.', { status: 404 });
  const { data, error } = await sb.storage.from('documentos').createSignedUrl(doc.arquivo_path, 60);
  if (error || !data) return new NextResponse('Documento não encontrado ou sem acesso.', { status: 404 });
  await registrarAuditoria(u.id, 'download', 'documento', id);
  return NextResponse.redirect(data.signedUrl);
}
```

Em `apps/painel/src/app/(painel)/clientes/[id]/page.tsx`, importar `SecaoDocumentos` e acrescentar:
```tsx
      {aba === 'documentos' && <SecaoDocumentos id={id} pode={pode} admin={u.papel === 'admin'} />}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel e2e`
Expected: PASS (e2e completo).

- [ ] **Step 5: Commit**

```bash
git add apps/painel
git commit -m "feat(painel): documentos da empresa com envio pela IA liberável e download auditado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Verificação final

Com o trabalhador local parado: `supabase db reset && supabase test db && pnpm typecheck && pnpm -r test && pnpm --filter @escritorio/painel e2e && pnpm --filter @escritorio/trabalhador cenarios`. Tudo PASS. Depois, reiniciar o ambiente de teste do dono (login local e trabalhador), como nas sessões anteriores.
