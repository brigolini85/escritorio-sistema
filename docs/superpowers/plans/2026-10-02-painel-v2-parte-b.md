# Painel v2, Parte B: cadastros com arquivar, excluir de vez e restaurar. Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development, o modo pedido pelo dono no Prompt B. Cada task tem um implementador e um revisor; no fim, uma revisão do branch inteiro. Os passos usam `- [ ]`.

**Objetivo:** um único "Excluir…" nos cadastros (clientes, contatos, produtos, redes, unidades e usuários):
- arquiva o que tem histórico e avisa as demandas abertas, sem bloquear;
- apaga de vez só o que nunca foi usado (só o administrador, digitando o nome);
- o arquivado sai das listas, buscas e seleções do painel e some para o agente e o assistente;
- o botão "ARQUIVADOS (n)" mostra quem arquivou e quando, com **Restaurar**;
- usuário arquivado não entra; excluir usuário de vez também o tira do login (Auth).

**Arquitetura:**
- **Banco** (uma migração):
  - colunas `arquivado_em` e `arquivado_por` nas 6 tabelas;
  - um gatilho que mantém essas colunas certas sempre que `ativo` muda, venha a mudança de onde vier;
  - funções `uso_do_cadastro`, `arquivar_cadastro`, `restaurar_cadastro` e `excluir_cadastro_definitivo`, SECURITY DEFINER. A exclusão recusa no banco se houver qualquer uso.
- **Painel:**
  - regras puras e textos em `lib/arquivo.ts`;
  - server actions em `lib/arquivo-acoes.ts`, que chamam as funções com a sessão da pessoa (a auditoria registra quem fez);
  - leitura dos arquivados em `lib/arquivados.ts`;
  - componente cliente `ExcluirCadastro`: consulta o uso ao clicar e abre o `ConfirmDialog` da Parte A no modo certo.
- **Trabalhador:** já filtra `ativo = true`. Só um furo no assistente é fechado: ele chegava a uma empresa arquivada pelo `cliente_id`. Testes no pacote `db` e no trabalhador provam que o agente e o assistente deixam de ver o arquivado.

**Tecnologias:** Next.js 15 (App Router, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, sonner, Supabase (Postgres, RLS, pgTAP, Auth admin), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`, seção 5 (Parte B). Leia também as seções 4.5, 4.6 e 8. Imagens: `docs/superpowers/specs/painel-v2/imagens/01-menu-e-clientes-arquivar.png` e `02-excluir-de-vez.png`. O pedido do dono está no bloco "Prompt B" de `docs/superpowers/specs/painel-v2/prompts-para-colar.md`.

**Onde trabalhar:** worktree `.claude/worktrees/painel-v2-parte-b`, branch `painel-v2-parte-b`, criada a partir de `painel-v2-parte-a`. Todos os comandos rodam a partir da raiz da worktree.

## Restrições globais

- Só mexer em:
  - banco: `supabase/migrations/20261002000100_painel_v2_arquivar.sql` e `supabase/tests/15_painel_v2_arquivar.test.sql`;
  - `packages/db/src/tipos.gen.ts` (regerado) e `packages/db/test/arquivados.test.ts`;
  - `apps/painel`;
  - no trabalhador, só `apps/trabalhador/src/assistente/ferramentas.ts`, com o teste dele (Task 2).
  - Nada de regra do agente, prompt ou Bling.
- Nenhum texto ou `data-testid` usado em teste muda sem antes rodar `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit.
- Nada de cor, tamanho ou espaçamento solto no JSX: nada de `#hex`, `bg-white`, `text-[13px]`, `w-[300px]`. Use os tokens e utilitários da Parte A (`bg-brand`, `text-champagne-text`, `border-champagne`, `bg-grafite`, `text-danger` etc.). O teste de guarda `src/styles/escala.test.ts` e o `tokens.test.ts` precisam continuar passando.
- Tom dos textos (spec 4.6): frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Exemplo do spec: "3 demandas, 14 preços e 47 conversas ficam guardados. Sai das listas e do agente."
- Caixa alta só por CSS (os botões da Parte A já fazem). Os nomes acessíveis são "Sim, arquivar", "Excluir de vez", "Cancelar", "Restaurar <nome>" e "Excluir…".
- Vermelho de perigo nunca aparece sozinho: o aviso de demanda aberta tem ícone e texto.
- **"Apagar dados (LGPD)" do contato continua separado e igual**: mesmo componente (`ApagarDadosContato`), mesmo texto, mesma função `anonimizar_contato` (a migração não a altera).
- Reaproveite o que a Parte A deixou: `ConfirmDialog` (com `tipo`, `digitarParaConfirmar` e título `ReactNode`), `Button` (variantes `grafite` e `outline`), `PageHeader` com `contagem`, `DataTable` com `acoesLinha`, `variantesBotao`.
- O banco local (Docker, `supabase start`) é só para testes. Nunca rode teste contra `.env.homologacao`. A migração só vai para a homologação depois de mostrar o `--dry-run` e receber o "ok" do dono.
- Comentários no código seguem o estilo da casa: português, uma linha dizendo o porquê.

## Decisões tomadas neste plano (o dono confirma ao aprovar)

1. **As caixas "Ativo" que já existem saem.** Elas ficam em produtos, redes, unidades e no formulário de usuário, e há também o filtro "Situação: Ativas/Inativas" da lista de Clientes. O arquivar ocupa o lugar delas. Os formulários deixam de mandar `ativo`; sem isso, salvar sem a caixa arquivaria por engano. Quem já estava inativo antes desta parte aparece em "Arquivados" com "Arquivado antes do registro de datas".
2. **Gatilho em vez de só as funções.** Qualquer mudança de `ativo` preenche ou limpa `arquivado_em` e `arquivado_por`, inclusive a do "Apagar dados (LGPD)", sem mexer na função dele.
3. **Contato anonimizado (LGPD)** não aparece em "Arquivados" e `restaurar_cadastro` o recusa ("Os dados deste contato foram apagados (LGPD). Ele não volta."). Como `ativo = false`, ele também sai da lista de Contatos (antes aparecia com o selo "Inativo").
4. **Contagens a mais que as do spec**, para nada ser apagado em cascata sem aviso:
   - cliente: `redes` e `orientacoes` (regras do Treinar o agente daquela empresa);
   - usuário: `assistente` (perguntas ao assistente), `orientacoes` e `responsabilidades` (empresas de que é responsável).
5. **Unidade não tem preço próprio**: os preços são por rede. A unidade conta só as ocorrências em `pedido_venda`. A rede conta preços, unidades e pedidos, como diz o spec.
6. **Cadastrar de novo um telefone de contato arquivado traz o contato de volta.** O `upsert` passa a gravar `ativo: true`, nos três lugares que cadastram contato. Cadastrar um CNPJ de cliente arquivado mostra "Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados."
7. **Ninguém arquiva nem exclui o próprio acesso.** O banco recusa, e o botão não aparece na própria linha.
8. **Excluir usuário de vez:** primeiro a função do banco confere que a pessoa nunca atendeu e apaga a linha. Só depois a chave de serviço remove a pessoa do Auth. Se o Auth falhar, a tela avisa "Saiu do painel, mas o login não foi removido: …". A pessoa já não entra, porque sem linha em `usuarios` o login a recusa.
9. **`tem_permissao`, `meus_setores` e `eh_admin` já exigem `ativo`** desde a migração base. Nada muda nelas; o pgTAP prova que usuário inativo não tem permissões nem setores.
10. **O login fecha a sessão de quem está arquivado.** Hoje `obterUsuario` já manda para `/entrar?erro=inativo`. A ação `entrar` passa também a encerrar a sessão recém-criada.

## Foco da revisão

Situações que o spec implica e que os testes das telas antigas não cobriam. Cada uma tem teste na task dona dela:

1. **Cadastro ganha histórico com a janela "Excluir de vez" aberta** (outra pessoa ou o agente usa o cadastro antes do clique final). O banco recusa, a tela mostra "Este cadastro tem histórico e não pode ser excluído de vez. Arquive." e nada é apagado. Testado no pgTAP da Task 1, no vitest da Task 3 e no Playwright da Task 4.
2. **Salvar produto, rede, unidade ou usuário depois que a caixa "Ativo" saiu.** O cadastro continua ativo, porque o formulário não manda mais `ativo`. Testado no vitest das Tasks 6 e 7 e no Playwright da Task 6.
3. **Cadastrar de novo o telefone de um contato arquivado** (pela aba Contatos, pela ficha ou pela conversa). O contato volta ativo e aparece na lista. Testado no Playwright da Task 5.
4. **CNPJ de cliente arquivado no "Novo cliente".** O aviso aponta para os arquivados, em vez do genérico "Já existe cliente com este CNPJ." Testado no Playwright da Task 4.
5. **Administrador tentando arquivar ou excluir a si mesmo.** O botão não aparece na própria linha e o banco recusa. Testado no pgTAP da Task 1 e no Playwright da Task 7.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261002000100_painel_v2_arquivar.sql` | colunas, gatilho, `uso_do_cadastro`, `arquivar_cadastro`, `restaurar_cadastro`, `excluir_cadastro_definitivo` | 1 |
| `supabase/tests/15_painel_v2_arquivar.test.sql` | pgTAP: permissões, recusa com histórico, restaurar, inativo sem permissões | 1 |
| `packages/db/src/tipos.gen.ts` | tipos regerados | 1 |
| `packages/db/test/arquivados.test.ts` (novo) | o agente e o assistente deixam de ver o arquivado e voltam a ver ao restaurar | 2 |
| `apps/trabalhador/src/assistente/ferramentas.ts` (+ `test/assistente/consultas.test.ts`) | empresa arquivada some do assistente | 2 |
| `apps/painel/src/lib/arquivo.ts` (+ teste) | tipos, leitura do uso, modo (arquivar/excluir), textos, rotas | 3 |
| `apps/painel/src/lib/arquivo-acoes.ts` (+ teste) | server actions `consultarUso`, `arquivarCadastro`, `restaurarCadastro`, `excluirCadastroDeVez` | 3 |
| `apps/painel/src/lib/arquivados.ts` | `lerArquivados`, `contarArquivados` | 3 |
| `apps/painel/src/components/patterns/confirm-dialog.tsx` | modo controlado (`aberto`/`aoMudarAberto`, `gatilho` opcional) | 4 |
| `apps/painel/src/components/patterns/excluir-cadastro.tsx` (novo) | `ExcluirCadastro`, `BotaoRestaurar` | 4 |
| `apps/painel/src/components/patterns/lista-arquivados.tsx` (novo) | `ListaArquivados`, `LinkArquivados`, `TelaArquivados`, `AvisoArquivado`, `ArquivadosRecolhidos` (Task 6) | 4, 6 |
| `apps/painel/src/app/(painel)/clientes/(lista)/page.tsx`, `clientes/[id]/page.tsx`, `clientes/acoes.ts` | lista sem arquivados, coluna Ações, Arquivados, área Excluir…, aviso de arquivado, CNPJ arquivado | 4 |
| `apps/painel/src/app/api/busca/route.ts` | busca global sem arquivados | 4 |
| `apps/painel/e2e/arquivar-clientes.spec.ts` (novo) | fluxos de clientes | 4 |
| `apps/painel/src/app/(painel)/contatos/page.tsx`, `detalhe-contato.tsx`, `acoes.ts`, `clientes/[id]/secao-contatos.tsx`, `clientes/acoes.ts`, `atendimento/acoes.ts` | contatos | 5 |
| `apps/painel/e2e/arquivar-contatos.spec.ts` (novo) | fluxos de contatos | 5 |
| `apps/painel/src/app/(painel)/clientes/cadastros-esquemas.ts` (+ teste), `cadastros-acoes.ts`, `[id]/secao-produtos.tsx`, `[id]/secao-parceiros.tsx` | produtos, redes e unidades | 6 |
| `apps/painel/e2e/arquivar-cadastros.spec.ts` (novo) | fluxos da ficha | 6 |
| `apps/painel/src/app/(painel)/usuarios/page.tsx`, `formulario-usuario.tsx`, `acoes.ts` (+ `acoes.test.ts` novo), `app/entrar/acoes.ts` | usuários e login bloqueado | 7 |
| `apps/painel/e2e/arquivar-usuarios.spec.ts` (novo) | fluxos de usuários | 7 |
| `apps/painel/e2e/acessibilidade.spec.ts` | axe nas telas de arquivados e na janela | 8 |

### Onde cada "ponto que não pode falhar" (Prompt B) é provado

| Ponto | Teste |
|---|---|
| Um único "Excluir…": arquiva o que tem histórico; apaga de vez só o nunca usado, só admin, digitando o nome | Task 3 `arquivo.test.ts` (`modoDaExclusao`); Task 4 e2e "excluir de vez digitando o nome" e "editor arquiva o nunca usado"; Task 6 e Task 7 e2e |
| `excluir_cadastro_definitivo` recusa no banco com qualquer contagem > 0 | Task 1 pgTAP (asserções 28 a 32); Task 3 vitest; Task 4 e2e "ganha histórico com a janela aberta" |
| Arquivar = `ativo = false` + `arquivado_em/por`; o agente deixa de ver | Task 1 pgTAP (22, 24); Task 2 `packages/db/test/arquivados.test.ts` e o teste do assistente |
| Arquivar cliente com demanda aberta avisa, não bloqueia | Task 1 pgTAP (20, 27, 43); Task 3 `avisoAbertas`; Task 4 e2e |
| Usuário arquivado não entra; excluir de vez só se nunca atendeu e remove do Auth | Task 1 pgTAP (32, 42, 48, 49); Task 3 vitest (ordem banco → Auth); Task 7 e2e |
| "Apagar dados (LGPD)" separado e igual | Task 1 pgTAP (44, 45); Task 5 e2e "Excluir… e LGPD separados"; `e2e/contatos.spec.ts` existente rodado na Task 5 |

---

### Task 1: Banco (colunas, gatilho e funções de arquivo)

**Arquivos:**
- Criar: `supabase/migrations/20261002000100_painel_v2_arquivar.sql`
- Criar: `supabase/tests/15_painel_v2_arquivar.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consome: `public.eh_admin()`, `public.tem_permissao(text)`, `public.eh_usuario_ativo()`, `public.meus_setores()` (migração base, já exigem `ativo`), `public.anonimizar_contato(uuid)` e o gatilho `registrar_auditoria` (já existem).
- Produz:
  - Colunas `arquivado_em timestamptz` e `arquivado_por uuid references public.usuarios (id) on delete set null` em `clientes`, `contatos`, `produtos`, `parceiros_grupos`, `parceiros_unidades` e `usuarios`. As FKs ficam com o nome padrão (`<tabela>_arquivado_por_fkey`).
  - O tipo de cadastro em texto, sempre um destes: `'cliente' | 'contato' | 'produto' | 'rede' | 'unidade' | 'usuario'`.
  - `public.uso_do_cadastro(p_tipo text, p_id uuid) returns jsonb`, no formato `{"contagens": {<chave>: <inteiro>}, "abertas": [<numero da demanda>, …]}`. As chaves de cada tipo:
    - cliente: `demandas, conversas, mensagens, precos, produtos, redes, unidades, documentos, contatos, orientacoes`;
    - contato: `conversas, demandas, precos_alterados`;
    - produto: `precos, pedidos`;
    - rede: `precos, unidades, pedidos`;
    - unidade: `pedidos`;
    - usuário: `conversas, mensagens, demandas, eventos, precos, assistente, orientacoes, responsabilidades`.
    - `abertas` traz as demandas não concluídas do cliente, do contato (pelas conversas dele) ou do usuário (como responsável). Nos outros tipos vem vazio.
  - `public.arquivar_cadastro(p_tipo text, p_id uuid) returns void`
  - `public.restaurar_cadastro(p_tipo text, p_id uuid) returns void`
  - `public.excluir_cadastro_definitivo(p_tipo text, p_id uuid) returns void`
  - Mensagens de erro (`raise exception`, código P0001), copiadas literalmente pela tela:
    - `'Tipo de cadastro inválido.'`
    - `'Sem permissão para arquivar cadastros.'`
    - `'Só o administrador arquiva pessoas.'`
    - `'Só o administrador exclui de vez.'`
    - `'Você não pode arquivar o próprio acesso.'`
    - `'Você não pode excluir o próprio acesso.'`
    - `'Cadastro não encontrado.'`
    - `'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.'`
    - `'Os dados deste contato foram apagados (LGPD). Ele não volta.'`
  - Auditoria explícita em `auditoria_acessos`, com `acao` em `'arquivar' | 'restaurar' | 'excluir_definitivo'`, `entidade` igual ao nome da tabela e `entidade_id` igual ao id. Em `excluir_definitivo`, `detalhes` traz `{"antes": <linha>}`.

- [ ] **Passo 1: escrever o teste pgTAP (falha)**

```sql
-- supabase/tests/15_painel_v2_arquivar.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(49);

-- Pessoas: admin, Bia (editar_clientes), Ana (sem permissão), Inativa (tinha editar_clientes), Zeca (responsável por demanda aberta), Novo (nunca usou).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000015a1', 'admin15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a2', 'bia15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a3', 'ana15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a4', 'inativa15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a5', 'zeca15@pgtap.local'),
  ('00000000-0000-0000-0000-0000000015a6', 'novo15@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes, ativo) values
  ('00000000-0000-0000-0000-0000000015a1', 'Admin', 'admin15@pgtap.local', 'admin', '{}', true),
  ('00000000-0000-0000-0000-0000000015a2', 'Bia', 'bia15@pgtap.local', 'atendente', '{editar_clientes}', true),
  ('00000000-0000-0000-0000-0000000015a3', 'Ana', 'ana15@pgtap.local', 'atendente', '{}', true),
  ('00000000-0000-0000-0000-0000000015a4', 'Inativa', 'inativa15@pgtap.local', 'atendente', '{editar_clientes}', false),
  ('00000000-0000-0000-0000-0000000015a5', 'Zeca', 'zeca15@pgtap.local', 'atendente', '{}', true),
  ('00000000-0000-0000-0000-0000000015a6', 'Novo', 'novo15@pgtap.local', 'atendente', '{}', true);
insert into public.usuario_setores (usuario_id, setor_id)
  select '00000000-0000-0000-0000-0000000015a4', id from public.setores where nome = 'Fiscal';

-- Cliente X com histórico; cliente Y nunca usado.
insert into public.clientes (id, razao_social, cnpj) values
  ('15000000-0000-0000-0000-000000000001', 'Indústria X', '15150000000101'),
  ('15000000-0000-0000-0000-000000000002', 'Indústria Y', '15150000000202');
insert into public.contatos (id, nome, telefone) values
  ('15200000-0000-0000-0000-000000000001', 'Contato Usado', '5531999991501'),
  ('15200000-0000-0000-0000-000000000002', 'Contato Novo', '5531999991502'),
  ('15200000-0000-0000-0000-000000000003', 'Contato LGPD', '5531999991503');
insert into public.contato_clientes (contato_id, cliente_id) values
  ('15200000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001');
insert into public.conversas (id, telefone, contato_id, cliente_em_foco) values
  ('15100000-0000-0000-0000-000000000001', '5531999991501', '15200000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001');
insert into public.produtos (id, cliente_id, codigo, descricao) values
  ('15300000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '12', 'Costela com preço'),
  ('15300000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', '77', 'Frango só no pedido'),
  ('15300000-0000-0000-0000-000000000003', '15000000-0000-0000-0000-000000000001', '99', 'Nunca usado');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('15400000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', 'cliente', 'Supermercado Brasil'),
  ('15400000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'cliente', 'Rede Vazia');
insert into public.parceiros_unidades (id, cliente_id, grupo_id, nome_unidade) values
  ('15500000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '15400000-0000-0000-0000-000000000001', 'Santa Efigênia'),
  ('15500000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', '15400000-0000-0000-0000-000000000001', 'Santa Matilde');
insert into public.precos (cliente_id, grupo_id, produto_id, valor) values
  ('15000000-0000-0000-0000-000000000001', '15400000-0000-0000-0000-000000000001', '15300000-0000-0000-0000-000000000001', 9.5);
-- Demanda aberta (pela conversa do contato, responsável Zeca) e pedido de venda concluído que usa a unidade e o produto 77.
insert into public.chamados (id, cliente_id, conversa_id, responsavel_id, titulo) values
  ('15600000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001', '15100000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000015a5', 'Aberta');
insert into public.chamados (id, cliente_id, titulo, status, pedido_venda) values
  ('15600000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000001', 'Venda', 'concluido',
   jsonb_build_object('unidade_id', '15500000-0000-0000-0000-000000000001', 'itens', jsonb_build_array(jsonb_build_object('sku', '77'))));

-- 1. Colunas nas 6 tabelas.
select is((select count(*) from information_schema.columns where table_schema = 'public'
  and column_name in ('arquivado_em', 'arquivado_por')
  and table_name in ('clientes', 'contatos', 'produtos', 'parceiros_grupos', 'parceiros_unidades', 'usuarios'))::int, 12,
  'as 6 tabelas têm arquivado_em e arquivado_por');
-- 2 a 7. Fechadas ao público; o ajudante interno nem para quem entrou.
select ok(not has_function_privilege('anon', 'public.uso_do_cadastro(text, uuid)', 'execute'), 'visitante não consulta o uso');
select ok(not has_function_privilege('anon', 'public.arquivar_cadastro(text, uuid)', 'execute'), 'visitante não arquiva');
select ok(not has_function_privilege('anon', 'public.restaurar_cadastro(text, uuid)', 'execute'), 'visitante não restaura');
select ok(not has_function_privilege('anon', 'public.excluir_cadastro_definitivo(text, uuid)', 'execute'), 'visitante não exclui');
select ok(has_function_privilege('authenticated', 'public.excluir_cadastro_definitivo(text, uuid)', 'execute'), 'quem entrou chama a função (ela confere o papel)');
select ok(not has_function_privilege('authenticated', 'public.tabela_do_cadastro(text)', 'execute'), 'ajudante interno fechado');

set local role authenticated;

-- 8 a 10. Usuário inativo não tem permissões nem setores (spec 5.3) e não arquiva.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a4","role":"authenticated"}', true);
select is(public.tem_permissao('editar_clientes'), false, 'inativo não tem permissões');
select is((select count(*) from public.meus_setores())::int, 0, 'inativo não tem setores');
select throws_ok($$ select public.arquivar_cadastro('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'inativo não arquiva');

-- 11 e 12. Atendente sem Editar clientes.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a3","role":"authenticated"}', true);
select throws_ok($$ select public.arquivar_cadastro('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'sem editar_clientes não arquiva');
select throws_ok($$ select public.uso_do_cadastro('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'sem editar_clientes não consulta o uso');

-- 13 a 21. Bia (editar_clientes).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a2","role":"authenticated"}', true);
select is(public.uso_do_cadastro('cliente', '15000000-0000-0000-0000-000000000001') -> 'contagens',
  '{"demandas":2,"conversas":1,"mensagens":0,"precos":1,"produtos":3,"redes":2,"unidades":2,"documentos":0,"contatos":1,"orientacoes":0}'::jsonb,
  'uso do cliente conta tudo o que está ligado');
select is(public.uso_do_cadastro('contato', '15200000-0000-0000-0000-000000000001') -> 'contagens',
  '{"conversas":1,"demandas":1,"precos_alterados":0}'::jsonb, 'uso do contato: conversas e demandas delas');
select is(public.uso_do_cadastro('produto', '15300000-0000-0000-0000-000000000002') -> 'contagens',
  '{"precos":0,"pedidos":1}'::jsonb, 'produto que só aparece num pedido de venda conta o pedido');
select is(public.uso_do_cadastro('rede', '15400000-0000-0000-0000-000000000001') -> 'contagens',
  '{"precos":1,"unidades":2,"pedidos":1}'::jsonb, 'rede: preços, unidades e pedidos das unidades');
select is(public.uso_do_cadastro('unidade', '15500000-0000-0000-0000-000000000001') -> 'contagens',
  '{"pedidos":1}'::jsonb, 'unidade: pedidos que a usam');
select throws_ok($$ select public.arquivar_cadastro('usuario', '00000000-0000-0000-0000-0000000015a6') $$,
  'P0001', 'Só o administrador arquiva pessoas.', 'editor não arquiva pessoas');
select throws_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Só o administrador exclui de vez.', 'editor não exclui de vez');
select lives_ok($$ select public.arquivar_cadastro('cliente', '15000000-0000-0000-0000-000000000001') $$,
  'arquivar cliente com demanda aberta: avisa na tela, não bloqueia');
select lives_ok($$ update public.produtos set ativo = false where id = '15300000-0000-0000-0000-000000000003' $$,
  'desativar pelo ativo (caminho antigo) continua valendo');

reset role;
-- 22 a 24.
select ok((select not ativo and arquivado_em is not null and arquivado_por = '00000000-0000-0000-0000-0000000015a2'
  from public.clientes where id = '15000000-0000-0000-0000-000000000001'), 'arquivado: ativo = false, quando e quem');
select ok(exists (select 1 from public.auditoria_acessos where acao = 'arquivar' and entidade = 'clientes'
  and entidade_id = '15000000-0000-0000-0000-000000000001'), 'auditoria registra a ação de arquivar');
select ok((select arquivado_em is not null and arquivado_por = '00000000-0000-0000-0000-0000000015a2'
  from public.produtos where id = '15300000-0000-0000-0000-000000000003'), 'o gatilho grava quando e quem em qualquer mudança de ativo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a2","role":"authenticated"}', true);
-- 25.
select lives_ok($$ select public.restaurar_cadastro('cliente', '15000000-0000-0000-0000-000000000001') $$, 'editor restaura');
reset role;
-- 26.
select ok((select ativo and arquivado_em is null and arquivado_por is null
  from public.clientes where id = '15000000-0000-0000-0000-000000000001'), 'restaurado: ativo e sem marcas de arquivo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a1","role":"authenticated"}', true);
-- 27. As demandas abertas vêm com o número (o admin lê chamados).
select is(public.uso_do_cadastro('cliente', '15000000-0000-0000-0000-000000000001') -> 'abertas',
  (select jsonb_build_array(numero) from public.chamados where id = '15600000-0000-0000-0000-000000000001'),
  'uso traz os números das demandas abertas');
-- 28 a 32. Com qualquer contagem > 0, o banco recusa, mesmo que a tela deixe passar.
select throws_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'cliente com histórico não é excluído');
select throws_ok($$ select public.excluir_cadastro_definitivo('produto', '15300000-0000-0000-0000-000000000002') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'produto num pedido não é excluído');
select throws_ok($$ select public.excluir_cadastro_definitivo('unidade', '15500000-0000-0000-0000-000000000001') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'unidade num pedido não é excluída');
select throws_ok($$ select public.excluir_cadastro_definitivo('contato', '15200000-0000-0000-0000-000000000001') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'contato com conversa não é excluído');
select throws_ok($$ select public.excluir_cadastro_definitivo('usuario', '00000000-0000-0000-0000-0000000015a5') $$,
  'P0001', 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.', 'pessoa que atendeu não é excluída');
-- 33 a 36.
select throws_ok($$ select public.arquivar_cadastro('usuario', '00000000-0000-0000-0000-0000000015a1') $$,
  'P0001', 'Você não pode arquivar o próprio acesso.', 'ninguém arquiva a si mesmo');
select throws_ok($$ select public.excluir_cadastro_definitivo('usuario', '00000000-0000-0000-0000-0000000015a1') $$,
  'P0001', 'Você não pode excluir o próprio acesso.', 'ninguém exclui a si mesmo');
select throws_ok($$ select public.excluir_cadastro_definitivo('banana', '15000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Tipo de cadastro inválido.', 'tipo desconhecido é recusado');
select throws_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'Cadastro não encontrado.', 'id inexistente é recusado');
-- 37 a 42. Nunca usados: o admin exclui de vez.
select lives_ok($$ select public.excluir_cadastro_definitivo('cliente', '15000000-0000-0000-0000-000000000002') $$, 'exclui cliente nunca usado');
select lives_ok($$ select public.excluir_cadastro_definitivo('produto', '15300000-0000-0000-0000-000000000003') $$, 'exclui produto nunca usado');
select lives_ok($$ select public.excluir_cadastro_definitivo('unidade', '15500000-0000-0000-0000-000000000002') $$, 'exclui unidade nunca usada');
select lives_ok($$ select public.excluir_cadastro_definitivo('rede', '15400000-0000-0000-0000-000000000002') $$, 'exclui rede vazia');
select lives_ok($$ select public.excluir_cadastro_definitivo('contato', '15200000-0000-0000-0000-000000000002') $$, 'exclui contato nunca usado');
select lives_ok($$ select public.excluir_cadastro_definitivo('usuario', '00000000-0000-0000-0000-0000000015a6') $$, 'exclui pessoa que nunca atendeu');
-- 43 a 45.
select lives_ok($$ select public.arquivar_cadastro('usuario', '00000000-0000-0000-0000-0000000015a5') $$,
  'admin arquiva pessoa com demanda aberta (avisa, não bloqueia)');
select lives_ok($$ select public.anonimizar_contato('15200000-0000-0000-0000-000000000003') $$, 'Apagar dados (LGPD) continua funcionando');
select throws_ok($$ select public.restaurar_cadastro('contato', '15200000-0000-0000-0000-000000000003') $$,
  'P0001', 'Os dados deste contato foram apagados (LGPD). Ele não volta.', 'contato anonimizado não volta');

reset role;
-- 46 e 47.
select is((select (select count(*) from public.clientes where id = '15000000-0000-0000-0000-000000000002')
  + (select count(*) from public.produtos where id = '15300000-0000-0000-0000-000000000003')
  + (select count(*) from public.parceiros_unidades where id = '15500000-0000-0000-0000-000000000002')
  + (select count(*) from public.parceiros_grupos where id = '15400000-0000-0000-0000-000000000002')
  + (select count(*) from public.contatos where id = '15200000-0000-0000-0000-000000000002')
  + (select count(*) from public.usuarios where id = '00000000-0000-0000-0000-0000000015a6'))::int, 0,
  'os seis excluídos de vez sumiram');
select ok(exists (select 1 from public.auditoria_acessos where acao = 'excluir_definitivo' and entidade = 'clientes'
  and entidade_id = '15000000-0000-0000-0000-000000000002' and detalhes -> 'antes' ->> 'razao_social' = 'Indústria Y'),
  'auditoria guarda o que foi excluído');

-- 48 e 49. Pessoa arquivada não entra: sem permissões e sem leitura.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000015a5","role":"authenticated"}', true);
select is(public.eh_usuario_ativo() or public.tem_permissao('editar_clientes'), false, 'arquivado não é usuário ativo');
select is((select count(*) from public.clientes)::int, 0, 'arquivado não lê cadastros');
reset role;

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Rode `supabase start` (se ainda não estiver ligado) e depois `supabase test db`. Esperado: FALHA em `15_painel_v2_arquivar.test.sql`, porque as colunas e as funções não existem. Os arquivos 01 a 14 passam.

- [ ] **Passo 3: escrever a migração**

```sql
-- supabase/migrations/20261002000100_painel_v2_arquivar.sql
-- Painel v2, Parte B: arquivar, restaurar e excluir de vez os cadastros.
-- Arquivar reaproveita "ativo" (o trabalhador já filtra ativo = true) e guarda quem e quando.

do $$
declare t text;
begin
  foreach t in array array['clientes', 'contatos', 'produtos', 'parceiros_grupos', 'parceiros_unidades', 'usuarios'] loop
    execute format('alter table public.%I add column arquivado_em timestamptz, '
      'add column arquivado_por uuid references public.usuarios (id) on delete set null', t);
  end loop;
end $$;

-- Qualquer mudança de ativo (função, formulário antigo, LGPD) mantém quem e quando certos; restaurar limpa.
create function public.marcar_arquivamento() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.ativo is distinct from old.ativo then
    if new.ativo then
      new.arquivado_em := null;
      new.arquivado_por := null;
    else
      new.arquivado_em := coalesce(new.arquivado_em, now());
      new.arquivado_por := coalesce(new.arquivado_por, auth.uid());
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes', 'contatos', 'produtos', 'parceiros_grupos', 'parceiros_unidades', 'usuarios'] loop
    execute format('create trigger arquivamento before update of ativo on public.%I for each row execute function public.marcar_arquivamento()', t);
  end loop;
end $$;

-- Tipo de cadastro → tabela (null = tipo desconhecido). Ajudante interno das funções abaixo.
create function public.tabela_do_cadastro(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo
    when 'cliente' then 'clientes' when 'contato' then 'contatos' when 'produto' then 'produtos'
    when 'rede' then 'parceiros_grupos' when 'unidade' then 'parceiros_unidades' when 'usuario' then 'usuarios'
  end
$$;

-- Quem pode arquivar/restaurar (spec 5.2): pessoas só o admin; o resto, editar_clientes (ou admin). Devolve a tabela.
create function public.exigir_arquivar(p_tipo text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo);
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if p_tipo = 'usuario' and not public.eh_admin() then raise exception 'Só o administrador arquiva pessoas.'; end if;
  if not public.tem_permissao('editar_clientes') then raise exception 'Sem permissão para arquivar cadastros.'; end if;
  return v_tabela;
end $$;

-- O que está ligado ao cadastro: decide entre arquivar (tem histórico) e excluir de vez (nunca usado).
create function public.uso_do_cadastro(p_tipo text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tabela text := public.exigir_arquivar(p_tipo);
  v_existe boolean;
  v_contagens jsonb;
  v_abertas jsonb := '[]';
begin
  execute format('select exists (select 1 from public.%I where id = $1)', v_tabela) into v_existe using p_id;
  if not v_existe then raise exception 'Cadastro não encontrado.'; end if;

  if p_tipo = 'cliente' then
    v_contagens := jsonb_build_object(
      'demandas', (select count(*) from public.chamados where cliente_id = p_id),
      'conversas', (select count(*) from public.conversas c where c.cliente_em_foco = p_id
        or exists (select 1 from public.mensagens m where m.conversa_id = c.id and m.cliente_id = p_id)),
      'mensagens', (select count(*) from public.mensagens where cliente_id = p_id),
      'precos', (select count(*) from public.precos where cliente_id = p_id),
      'produtos', (select count(*) from public.produtos where cliente_id = p_id),
      'redes', (select count(*) from public.parceiros_grupos where cliente_id = p_id),
      'unidades', (select count(*) from public.parceiros_unidades where cliente_id = p_id),
      'documentos', (select count(*) from public.documentos_empresa where cliente_id = p_id),
      'contatos', (select count(*) from public.contato_clientes where cliente_id = p_id),
      'orientacoes', (select count(*) from public.orientacoes_agente where cliente_id = p_id));
    select coalesce(jsonb_agg(numero order by numero), '[]') into v_abertas
      from public.chamados where cliente_id = p_id and status <> 'concluido';
  elsif p_tipo = 'contato' then
    v_contagens := jsonb_build_object(
      'conversas', (select count(*) from public.conversas where contato_id = p_id),
      'demandas', (select count(*) from public.chamados ch join public.conversas c on c.id = ch.conversa_id where c.contato_id = p_id),
      'precos_alterados', (select count(*) from public.precos where alterado_por_contato = p_id));
    select coalesce(jsonb_agg(ch.numero order by ch.numero), '[]') into v_abertas
      from public.chamados ch join public.conversas c on c.id = ch.conversa_id
      where c.contato_id = p_id and ch.status <> 'concluido';
  elsif p_tipo = 'produto' then
    -- O pedido de venda guarda o código (sku), não o id: conta pelo código dentro da empresa (ou sem empresa).
    v_contagens := jsonb_build_object(
      'precos', (select count(*) from public.precos where produto_id = p_id),
      'pedidos', (select count(*) from public.chamados ch, public.produtos p
        where p.id = p_id and ch.pedido_venda is not null
          and (ch.cliente_id = p.cliente_id or ch.cliente_id is null)
          and ch.pedido_venda -> 'itens' @> jsonb_build_array(jsonb_build_object('sku', p.codigo))));
  elsif p_tipo = 'rede' then
    v_contagens := jsonb_build_object(
      'precos', (select count(*) from public.precos where grupo_id = p_id),
      'unidades', (select count(*) from public.parceiros_unidades where grupo_id = p_id),
      'pedidos', (select count(*) from public.chamados
        where pedido_venda ->> 'unidade_id' in (select id::text from public.parceiros_unidades where grupo_id = p_id)));
  elsif p_tipo = 'unidade' then
    v_contagens := jsonb_build_object(
      'pedidos', (select count(*) from public.chamados where pedido_venda ->> 'unidade_id' = p_id::text));
  else
    v_contagens := jsonb_build_object(
      'conversas', (select count(*) from public.conversas where atendente_id = p_id),
      'mensagens', (select count(*) from public.mensagens where atendente_id = p_id),
      'demandas', (select count(*) from public.chamados where responsavel_id = p_id),
      'eventos', (select count(*) from public.chamado_eventos where usuario_id = p_id),
      'precos', (select count(*) from public.precos where alterado_por = p_id),
      'assistente', (select count(*) from public.assistente_mensagens where usuario_id = p_id),
      'orientacoes', (select count(*) from public.orientacoes_agente where criado_por = p_id or atualizado_por = p_id),
      'responsabilidades', (select count(*) from public.cliente_responsaveis where usuario_id = p_id));
    select coalesce(jsonb_agg(numero order by numero), '[]') into v_abertas
      from public.chamados where responsavel_id = p_id and status <> 'concluido';
  end if;
  return jsonb_build_object('contagens', v_contagens, 'abertas', v_abertas);
end $$;

-- Arquivar: sai das listas e do agente; o histórico fica. Demanda aberta só gera aviso na tela.
create function public.arquivar_cadastro(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.exigir_arquivar(p_tipo); v_uso jsonb;
begin
  if p_tipo = 'usuario' and p_id = auth.uid() then raise exception 'Você não pode arquivar o próprio acesso.'; end if;
  v_uso := public.uso_do_cadastro(p_tipo, p_id);
  execute format('update public.%I set ativo = false, arquivado_em = now(), arquivado_por = $2 where id = $1 and ativo', v_tabela)
    using p_id, auth.uid();
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'arquivar', v_tabela, p_id::text, v_uso);
end $$;

-- Restaurar: volta como estava (o gatilho limpa quem e quando). Contato anonimizado pela LGPD não volta.
create function public.restaurar_cadastro(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.exigir_arquivar(p_tipo); v_n int;
begin
  if p_tipo = 'contato' and exists (select 1 from public.auditoria_acessos
      where acao = 'anonimizar' and entidade = 'contatos' and entidade_id = p_id::text) then
    raise exception 'Os dados deste contato foram apagados (LGPD). Ele não volta.';
  end if;
  execute format('update public.%I set ativo = true where id = $1', v_tabela) using p_id;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Cadastro não encontrado.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id)
  values (auth.uid(), 'restaurar', v_tabela, p_id::text);
end $$;

-- Excluir de vez: só admin e só o que nunca foi usado; recusa aqui mesmo que a tela tenha deixado passar.
create function public.excluir_cadastro_definitivo(p_tipo text, p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo); v_uso jsonb; v_linha jsonb;
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if not public.eh_admin() then raise exception 'Só o administrador exclui de vez.'; end if;
  if p_tipo = 'usuario' and p_id = auth.uid() then raise exception 'Você não pode excluir o próprio acesso.'; end if;
  -- Trava a linha: quem tentar ligar algo a ela agora espera, e a contagem abaixo não fica velha.
  execute format('select to_jsonb(t) from public.%I t where id = $1 for update', v_tabela) into v_linha using p_id;
  v_uso := public.uso_do_cadastro(p_tipo, p_id);
  if exists (select 1 from jsonb_each_text(v_uso -> 'contagens') where value::bigint > 0) then
    raise exception 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.';
  end if;
  execute format('delete from public.%I where id = $1', v_tabela) using p_id;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'excluir_definitivo', v_tabela, p_id::text, jsonb_build_object('antes', v_linha));
end $$;

revoke all on function public.uso_do_cadastro(text, uuid), public.arquivar_cadastro(text, uuid),
  public.restaurar_cadastro(text, uuid), public.excluir_cadastro_definitivo(text, uuid) from public, anon, authenticated;
grant execute on function public.uso_do_cadastro(text, uuid), public.arquivar_cadastro(text, uuid),
  public.restaurar_cadastro(text, uuid), public.excluir_cadastro_definitivo(text, uuid) to authenticated;
revoke all on function public.tabela_do_cadastro(text), public.exigir_arquivar(text), public.marcar_arquivamento()
  from public, anon, authenticated;
```

Observações para quem implementa:
- `exigir_arquivar` roda dentro das funções SECURITY DEFINER com o papel do dono. Por isso funciona mesmo sem `execute` para `authenticated`. O `auth.uid()` continua sendo o de quem chamou.
- O `update … where id = $1 and ativo` de `arquivar_cadastro` não faz nada se o cadastro já estava arquivado. Assim a primeira data de arquivo fica guardada.

- [ ] **Passo 4: aplicar no banco local e rodar os testes**

Rode `supabase migration up` e depois `supabase test db`. Esperado: todos os arquivos passam, inclusive o 15 com 49/49.

Se alguma asserção de contagem não bater, confira primeiro o que o teste semeou, antes de mexer na função. Por exemplo: o cliente X tem 3 produtos, 2 redes, 2 unidades e 2 demandas.

- [ ] **Passo 5: regerar os tipos**

Rode `pnpm db:tipos` e depois `git diff --stat packages/db/src/tipos.gen.ts`. Esperado: o diff traz `arquivado_em` e `arquivado_por` nas 6 tabelas, as relações `*_arquivado_por_fkey` e as quatro funções em `Functions`.

- [ ] **Passo 6: commit**

```bash
git add supabase/migrations/20261002000100_painel_v2_arquivar.sql supabase/tests/15_painel_v2_arquivar.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): arquivar, restaurar e excluir de vez os cadastros (painel v2, parte B)"
```

---

### Task 2: O agente e o assistente deixam de ver o arquivado

**Arquivos:**
- Criar: `packages/db/test/arquivados.test.ts`
- Modificar: `apps/trabalhador/src/assistente/ferramentas.ts`: `empresaExiste` (linha ~143) e o `case 'consultar_preco'` (linha ~209)
- Modificar: `apps/trabalhador/test/assistente/consultas.test.ts`

**Interfaces:**
- Consome: as colunas da Task 1 e o gatilho `arquivamento`. Também os repositórios existentes `buscarContato`, `buscarEmpresas`, `produtosDaEmpresa`, `unidadesDaEmpresa`, `usuarioDoAssistente` e `obterUsuarioAssistente` (`packages/db/src/repos.ts`, que já filtram `ativo`).
- Produz: `empresaExiste(d, clienteId)` passa a devolver `false` para empresa arquivada, e `consultar_preco` passa a conferir a empresa. A mensagem continua `'Empresa não encontrada. Use buscar_empresas.'`.

Contexto: o agente e o assistente usam o cliente de serviço (passa por cima da RLS). Por isso quem prova que o arquivado some são os testes do pacote `db` e do trabalhador, que rodam contra o banco local, e não o pgTAP.

Na leitura do código, todos os caminhos do agente já filtram `ativo`:
- `buscarContato` filtra contato e empresa;
- `buscarEmpresas`, `produtosDaEmpresa` e `unidadesDaEmpresa` filtram unidade e rede;
- `usuarioDoAssistente` filtra a pessoa, e o `processar` do assistente recusa quem tem `ativo = false`.

O furo está no assistente: `dadosDaEmpresa` não olha `ativo`, então `empresaExiste` deixava passar uma empresa arquivada pelo `cliente_id`, e `consultar_preco` nem conferia.

- [ ] **Passo 1: teste do pacote db (prova; os três primeiros já devem passar)**

```ts
// packages/db/test/arquivados.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';
import { criarUsuario } from './usuario';

// Parte B do painel v2: arquivar = ativo false; o agente e o assistente deixam de ver, e voltam a ver ao restaurar.
const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const TEL = '5531999991601';
type Tabela = 'clientes' | 'contatos' | 'produtos' | 'parceiros_grupos' | 'parceiros_unidades' | 'usuarios';

async function marcar(tabela: Tabela, id: string, ativo: boolean) {
  const { error } = await db.from(tabela).update({ ativo }).eq('id', id);
  expect(error).toBeNull();
}

beforeEach(limparBanco);

describe('arquivado some do agente e do assistente', () => {
  it('cliente e contato arquivados não são reconhecidos; restaurar devolve', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '16160000000101' }).select().single();
    const { data: c } = await db.from('contatos').insert({ nome: 'Maria', telefone: TEL }).select().single();
    await db.from('contato_clientes').insert({ contato_id: c!.id, cliente_id: x!.id });
    expect((await repos.buscarContato(TEL))?.empresas.map((e) => e.nome)).toEqual(['Padaria Sol ME']);
    expect((await repos.buscarEmpresas('Padaria')).map((e) => e.id)).toEqual([x!.id]);

    await marcar('clientes', x!.id, false);
    expect((await repos.buscarContato(TEL))?.empresas).toEqual([]);
    expect(await repos.buscarEmpresas('Padaria')).toEqual([]);
    await marcar('contatos', c!.id, false);
    expect(await repos.buscarContato(TEL)).toBeNull();

    await marcar('clientes', x!.id, true);
    await marcar('contatos', c!.id, true);
    expect((await repos.buscarContato(TEL))?.empresas.map((e) => e.nome)).toEqual(['Padaria Sol ME']);
  });

  it('produto, unidade e rede arquivados saem do que o agente consulta', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Indústria X', cnpj: '16160000000202' }).select().single();
    const { data: rede } = await db.from('parceiros_grupos').insert({ cliente_id: x!.id, tipo: 'cliente', nome: 'Supermercado Brasil' }).select().single();
    // Uma por vez: num insert em lote, a coluna ausente vira null (e palavras_chave é not null).
    const { data: efigenia } = await db.from('parceiros_unidades').insert({ cliente_id: x!.id, grupo_id: rede!.id, nome_unidade: 'Santa Efigênia' }).select().single();
    const { data: matilde } = await db.from('parceiros_unidades').insert({ cliente_id: x!.id, grupo_id: rede!.id, nome_unidade: 'Santa Matilde' }).select().single();
    await db.from('produtos').insert({ cliente_id: x!.id, codigo: '12', descricao: 'Costela' });
    const { data: frango } = await db.from('produtos').insert({ cliente_id: x!.id, codigo: '14', descricao: 'Frango' }).select().single();

    await marcar('produtos', frango!.id, false);
    expect((await repos.produtosDaEmpresa(x!.id)).map((p) => p.codigo)).toEqual(['12']);
    // Um pedido antigo que já usa o produto ainda consegue descrevê-lo.
    expect((await repos.produtosDaEmpresa(x!.id, { incluirInativos: true })).map((p) => p.codigo).sort()).toEqual(['12', '14']);

    await marcar('parceiros_unidades', matilde!.id, false);
    expect((await repos.unidadesDaEmpresa(x!.id, 'cliente')).map((u) => u.id)).toEqual([efigenia!.id]);
    await marcar('parceiros_grupos', rede!.id, false);
    expect(await repos.unidadesDaEmpresa(x!.id, 'cliente')).toEqual([]);
    await marcar('parceiros_grupos', rede!.id, true);
    expect((await repos.unidadesDaEmpresa(x!.id, 'cliente')).map((u) => u.id)).toEqual([efigenia!.id]);
  });

  it('pessoa arquivada perde o assistente pelo WhatsApp', async () => {
    const id = await criarUsuario(db, 'bia@arquivados.local', { telefone: '5531999991602', permissoes: ['assistente_whatsapp'] });
    expect((await repos.usuarioDoAssistente('5531999991602'))?.id).toBe(id);
    await marcar('usuarios', id, false);
    expect(await repos.usuarioDoAssistente('5531999991602')).toBeNull();
    expect((await repos.obterUsuarioAssistente(id))?.ativo).toBe(false);
  });

  it('o gatilho grava quando arquivou (sem pessoa, pelo serviço) e restaurar limpa', async () => {
    const { data: x } = await db.from('clientes').insert({ razao_social: 'Indústria Z', cnpj: '16160000000303' }).select().single();
    await marcar('clientes', x!.id, false);
    const arq = (await db.from('clientes').select('arquivado_em, arquivado_por').eq('id', x!.id).single()).data!;
    expect(arq.arquivado_em).not.toBeNull();
    expect(arq.arquivado_por).toBeNull();
    await marcar('clientes', x!.id, true);
    expect((await db.from('clientes').select('arquivado_em, arquivado_por').eq('id', x!.id).single()).data)
      .toEqual({ arquivado_em: null, arquivado_por: null });
  });
});
```

- [ ] **Passo 2: rodar**

Rode `pnpm --filter @escritorio/db exec vitest run test/arquivados.test.ts`. Esperado: PASSA (4/4).
- Os três primeiros provam os filtros que já existem.
- O quarto prova o gatilho da Task 1.
- Se algum dos três primeiros falhar, há um filtro faltando em `repos.ts`. Corrija ali, com `.eq('ativo', true)`, antes de seguir.

- [ ] **Passo 3: teste do assistente (falha)**

No `describe` de `apps/trabalhador/test/assistente/consultas.test.ts`, logo depois de `'busca empresa, parceiros, produtos e preço'`, acrescente:

```ts
  it('empresa arquivada some do assistente, mesmo chamada pelo id (painel v2, parte B)', async () => {
    const e = await estadoDe(await criarUsuarioTeste({ email: 'dono@teste-consultas.local' }));
    await db.from('clientes').update({ ativo: false }).eq('id', empresaId);
    expect((await usar(e, 'buscar_empresas', { texto: 'industria x' })).empresas).toEqual([]);
    const chamadas: [string, object][] = [
      ['buscar_parceiros', { cliente_id: empresaId, texto: 'Brasil', tipo: 'cliente' }],
      ['buscar_produtos', { cliente_id: empresaId, textos: ['costela'] }],
      ['consultar_preco', { cliente_id: empresaId, unidade_id: cad.brasilEfigenia, produto_id: cad.costela }],
      ['dados_cadastro', { cliente_id: empresaId }],
    ];
    for (const [nome, entrada] of chamadas) {
      const r = await usar(e, nome, entrada);
      expect(r._erro, nome).toBe(true);
      expect(r.erro, nome).toBe('Empresa não encontrada. Use buscar_empresas.');
    }
  });
```

Rode `pnpm --filter @escritorio/trabalhador exec vitest run test/assistente/consultas.test.ts`. Esperado: FALHA. `buscar_parceiros` devolve candidatos e `consultar_preco` devolve o preço.

- [ ] **Passo 4: corrigir o assistente**

Em `apps/trabalhador/src/assistente/ferramentas.ts`:

```ts
// Empresa arquivada (ativo = false) some para o assistente, como já some para o agente.
async function empresaExiste(d: DepsAssistente, clienteId: string): Promise<boolean> {
  try { return (await d.repos.dadosDaEmpresa(clienteId)).ativo; } catch { return false; }
}
```

No `case 'consultar_preco': {`, como primeira linha:

```ts
      if (!(await empresaExiste(d, entrada.cliente_id))) return falha('Empresa não encontrada. Use buscar_empresas.');
```

- [ ] **Passo 5: rodar**

Rode `pnpm --filter @escritorio/trabalhador exec vitest run test/assistente` e depois `pnpm --filter @escritorio/trabalhador typecheck`. Esperado: tudo passa.

- [ ] **Passo 6: commit**

```bash
git add packages/db/test/arquivados.test.ts apps/trabalhador/src/assistente/ferramentas.ts apps/trabalhador/test/assistente/consultas.test.ts
git commit -m "fix(assistente): empresa arquivada some também pelo id; testes provam que o agente não vê arquivados"
```

---

### Task 3: Regras, textos e server actions do arquivo

**Arquivos:**
- Criar: `apps/painel/src/lib/arquivo.ts` e `apps/painel/src/lib/arquivo.test.ts`
- Criar: `apps/painel/src/lib/arquivo-acoes.ts` e `apps/painel/src/lib/arquivo-acoes.test.ts`
- Criar: `apps/painel/src/lib/arquivados.ts`
- Modificar: `apps/painel/src/app/(painel)/contatos/detalhe-contato.tsx`. Troque a constante local `NOME_ANONIMIZADO` pelo import de `@/lib/arquivo`. Antes, `grep -rn "NOME_ANONIMIZADO" apps/painel/src`.

**Interfaces:**
- Consome: as funções da Task 1 (`sb.rpc('uso_do_cadastro' | 'arquivar_cadastro' | 'restaurar_cadastro' | 'excluir_cadastro_definitivo', { p_tipo, p_id })`), além de `obterUsuario`, `temPermissao`, `UsuarioPainel` (`@/lib/sessao`), `supabaseServidor`, `supabaseServico`, `formatarData`, `mascararCNPJ` e `mascararTelefone` (`@/lib/formatos`).
- Produz:

```ts
// lib/arquivo.ts (puro, pode ir para o cliente)
export const TIPOS_CADASTRO: readonly ['cliente', 'contato', 'produto', 'rede', 'unidade', 'usuario'];
export type TipoCadastro = (typeof TIPOS_CADASTRO)[number];
export type UsoDoCadastro = { contagens: Record<string, number>; abertas: number[] };
export type ModoExclusao = 'arquivar' | 'excluir';
export type TextosJanela = { modo: ModoExclusao; verbo: string; descricao: string; aviso: string | null; confirmar: string; enviando: string };
export const NOME_ANONIMIZADO = 'Contato removido';
export const AJUDA_EXCLUIR: string;
export const ROTAS_DO_TIPO: Record<TipoCadastro, string[]>;
export function ehTipoCadastro(v: unknown): v is TipoCadastro;
export function lerUso(v: unknown): UsoDoCadastro;               // lança 'Resposta inválida do banco.'
export function temHistorico(u: UsoDoCadastro): boolean;
export function modoDaExclusao(u: UsoDoCadastro, admin: boolean): ModoExclusao;
export function fraseDoUso(tipo: TipoCadastro, u: UsoDoCadastro): string;
export function avisoAbertas(abertas: number[]): string | null;
export function textosDaJanela(tipo: TipoCadastro, u: UsoDoCadastro, admin: boolean): TextosJanela;
export function descreverArquivamento(arquivadoEm: string | null, arquivadoPor: string | null): string;

// lib/arquivo-acoes.ts ('use server')
export type ResultadoArquivo = { ok: true } | { ok: false; erro: string };
export async function consultarUso(tipo: TipoCadastro, id: string): Promise<{ ok: true; uso: UsoDoCadastro; admin: boolean } | { ok: false; erro: string }>;
export async function arquivarCadastro(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo>;
export async function restaurarCadastro(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo>;
export async function excluirCadastroDeVez(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo>;

// lib/arquivados.ts ('server-only')
export type LinhaArquivada = { id: string; nome: string; detalhe: string | null; arquivadoEm: string | null; arquivadoPor: string | null };
export type FiltroArquivados = { clienteId?: string; tipoParceiro?: 'cliente' | 'fornecedor' };
export async function lerArquivados(sb: Sb, tipo: TipoCadastro, filtro?: FiltroArquivados): Promise<{ linhas: LinhaArquivada[]; erro: boolean }>;
export async function contarArquivados(sb: Sb, tipo: 'cliente' | 'contato' | 'usuario'): Promise<number>;
export async function nomeDaPessoa(sb: Sb, id: string | null): Promise<string | null>;
```

- [ ] **Passo 1: teste das regras e textos (falha)**

```ts
// apps/painel/src/lib/arquivo.test.ts
import { describe, expect, it } from 'vitest';
import { avisoAbertas, descreverArquivamento, ehTipoCadastro, fraseDoUso, lerUso, modoDaExclusao, temHistorico, textosDaJanela } from './arquivo';

const uso = (contagens: Record<string, number>, abertas: number[] = []) => ({ contagens, abertas });

describe('uso do cadastro', () => {
  it('lê o jsonb do banco e recusa formato estranho', () => {
    expect(lerUso({ contagens: { demandas: 3, precos: 0 }, abertas: [1038] })).toEqual(uso({ demandas: 3, precos: 0 }, [1038]));
    expect(() => lerUso(null)).toThrow('Resposta inválida do banco.');
    expect(() => lerUso({ contagens: { demandas: '3' }, abertas: [] })).toThrow('Resposta inválida do banco.');
    expect(() => lerUso({ contagens: {}, abertas: 'x' })).toThrow('Resposta inválida do banco.');
  });
  it('qualquer contagem acima de zero é histórico', () => {
    expect(temHistorico(uso({ demandas: 0, precos: 0 }))).toBe(false);
    expect(temHistorico(uso({ demandas: 0, pedidos: 1 }))).toBe(true);
  });
  it('apaga de vez só o que nunca foi usado, e só para o administrador', () => {
    expect(modoDaExclusao(uso({ demandas: 0 }), true)).toBe('excluir');
    expect(modoDaExclusao(uso({ demandas: 0 }), false)).toBe('arquivar');
    expect(modoDaExclusao(uso({ demandas: 1 }), true)).toBe('arquivar');
  });
  it('tipos de cadastro', () => {
    expect(ehTipoCadastro('rede')).toBe(true);
    expect(ehTipoCadastro('banana')).toBe(false);
  });
});

describe('textos da janela (spec 4.6 e 5.1)', () => {
  it('a frase do exemplo do spec', () => {
    expect(fraseDoUso('cliente', uso({ demandas: 3, conversas: 47, precos: 14, mensagens: 0 })))
      .toBe('3 demandas, 14 preços e 47 conversas ficam guardados. Sai das listas e do agente.');
  });
  it('singular, plural e feminino', () => {
    expect(fraseDoUso('contato', uso({ conversas: 1, demandas: 0 }))).toBe('1 conversa fica guardada. Sai das listas e do agente.');
    expect(fraseDoUso('produto', uso({ precos: 1, pedidos: 0 }))).toBe('1 preço fica guardado. Sai das listas e do agente.');
    expect(fraseDoUso('cliente', uso({ demandas: 2, conversas: 5 }))).toBe('2 demandas e 5 conversas ficam guardadas. Sai das listas e do agente.');
  });
  it('pessoa: sai das listas e não entra mais', () => {
    expect(fraseDoUso('usuario', uso({ demandas: 4 }))).toBe('4 demandas ficam guardadas. Sai das listas e não entra mais no painel.');
  });
  it('arquivar o que nunca foi usado (quem não é administrador)', () => {
    expect(fraseDoUso('produto', uso({ precos: 0, pedidos: 0 }))).toBe('Nunca foi usado. Sai das listas e do agente.');
  });
  it('contagem nova que a tela não conhece ainda aparece', () => {
    expect(fraseDoUso('cliente', uso({ boletos_enviados: 2 }))).toBe('2 boletos enviados ficam guardados. Sai das listas e do agente.');
  });
  it('demandas abertas: avisa com os números, sem bloquear', () => {
    expect(avisoAbertas([])).toBeNull();
    expect(avisoAbertas([1038])).toBe('1 demanda ainda aberta (#1038)');
    expect(avisoAbertas([1038, 1040])).toBe('2 demandas ainda abertas (#1038, #1040)');
    expect(avisoAbertas([1, 2, 3, 4, 5])).toBe('5 demandas ainda abertas (#1, #2, #3 e mais 2)');
  });
  it('janela de arquivar e de excluir de vez (imagens 01 e 02)', () => {
    expect(textosDaJanela('cliente', uso({ demandas: 3 }, [1038]), true)).toEqual({
      modo: 'arquivar', verbo: 'Arquivar', descricao: '3 demandas ficam guardadas. Sai das listas e do agente.',
      aviso: '1 demanda ainda aberta (#1038)', confirmar: 'Sim, arquivar', enviando: 'Arquivando…',
    });
    expect(textosDaJanela('cliente', uso({ demandas: 0 }), true)).toEqual({
      modo: 'excluir', verbo: 'Excluir de vez',
      descricao: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
      aviso: null, confirmar: 'Excluir de vez', enviando: 'Excluindo…',
    });
    expect(textosDaJanela('usuario', uso({ demandas: 0 }), true).descricao)
      .toBe('Nunca atendeu: nenhuma conversa, demanda ou preço. O acesso ao login também é removido. Não dá para desfazer.');
  });
  it('nenhum texto com "Tem certeza", "por favor" ou "com sucesso"', () => {
    const todos = JSON.stringify([
      textosDaJanela('cliente', uso({ demandas: 1 }, [1]), false), textosDaJanela('usuario', uso({}), true),
      descreverArquivamento(null, null), descreverArquivamento('2026-10-02T15:00:00Z', 'Ana'),
    ]);
    expect(todos).not.toMatch(/tem certeza|por favor|com sucesso/i);
  });
  it('quem e quando arquivou', () => {
    expect(descreverArquivamento('2026-10-02T15:00:00Z', 'Ana')).toBe('Arquivado em 02/10/2026 por Ana.');
    expect(descreverArquivamento('2026-10-02T15:00:00Z', null)).toBe('Arquivado em 02/10/2026.');
    expect(descreverArquivamento(null, null)).toBe('Arquivado antes do registro de datas.');
  });
});
```

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/lib/arquivo.test.ts`. Esperado: FALHA, porque o módulo não existe.

- [ ] **Passo 3: implementar `lib/arquivo.ts`**

```ts
// apps/painel/src/lib/arquivo.ts
import { formatarData } from './formatos';

/** Cadastros que têm "Excluir…": arquivar, restaurar e excluir de vez (spec painel v2, seção 5). */
export const TIPOS_CADASTRO = ['cliente', 'contato', 'produto', 'rede', 'unidade', 'usuario'] as const;
export type TipoCadastro = (typeof TIPOS_CADASTRO)[number];
export type UsoDoCadastro = { contagens: Record<string, number>; abertas: number[] };
export type ModoExclusao = 'arquivar' | 'excluir';
export type TextosJanela = { modo: ModoExclusao; verbo: string; descricao: string; aviso: string | null; confirmar: string; enviando: string };

/** Nome que anonimizar_contato (LGPD) grava: esse contato não aparece nos arquivados nem volta. */
export const NOME_ANONIMIZADO = 'Contato removido';

/** Texto da área "Excluir…" no fim das fichas. */
export const AJUDA_EXCLUIR = 'Com histórico, vai para os arquivados e pode voltar. Nunca usado, o administrador exclui de vez.';

/** Telas que mostram cada tipo (revalidadas depois de arquivar, restaurar ou excluir). */
export const ROTAS_DO_TIPO: Record<TipoCadastro, string[]> = {
  cliente: ['/clientes'], contato: ['/contatos', '/clientes'], produto: ['/clientes'], rede: ['/clientes'], unidade: ['/clientes'], usuario: ['/usuarios'],
};

export const ehTipoCadastro = (v: unknown): v is TipoCadastro =>
  typeof v === 'string' && (TIPOS_CADASTRO as readonly string[]).includes(v);

// Ordem das contagens na frase (o jsonb do banco não guarda ordem) e como cada uma se escreve.
const ROTULOS: [chave: string, singular: string, plural: string, genero: 'f' | 'm'][] = [
  ['demandas', 'demanda', 'demandas', 'f'],
  ['precos', 'preço', 'preços', 'm'],
  ['conversas', 'conversa', 'conversas', 'f'],
  ['mensagens', 'mensagem', 'mensagens', 'f'],
  ['produtos', 'produto', 'produtos', 'm'],
  ['redes', 'rede', 'redes', 'f'],
  ['unidades', 'unidade', 'unidades', 'f'],
  ['documentos', 'documento', 'documentos', 'm'],
  ['contatos', 'contato', 'contatos', 'm'],
  ['pedidos', 'pedido de nota', 'pedidos de nota', 'm'],
  ['precos_alterados', 'preço alterado', 'preços alterados', 'm'],
  ['eventos', 'registro em demandas', 'registros em demandas', 'm'],
  ['assistente', 'pergunta ao assistente', 'perguntas ao assistente', 'f'],
  ['orientacoes', 'orientação do agente', 'orientações do agente', 'f'],
  ['responsabilidades', 'empresa sob responsabilidade', 'empresas sob responsabilidade', 'f'],
];

const SAIDA: Record<TipoCadastro, string> = {
  cliente: 'Sai das listas e do agente.', contato: 'Sai das listas e do agente.', produto: 'Sai das listas e do agente.',
  rede: 'Sai das listas e do agente.', unidade: 'Sai das listas e do agente.', usuario: 'Sai das listas e não entra mais no painel.',
};

const NUNCA_USADO: Record<TipoCadastro, string> = {
  cliente: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  contato: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  produto: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  rede: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  unidade: 'Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.',
  usuario: 'Nunca atendeu: nenhuma conversa, demanda ou preço. O acesso ao login também é removido. Não dá para desfazer.',
};

export function lerUso(v: unknown): UsoDoCadastro {
  const o = v as { contagens?: unknown; abertas?: unknown } | null;
  const contagens = o?.contagens;
  const valido = !!o && typeof contagens === 'object' && contagens !== null && !Array.isArray(contagens)
    && Object.values(contagens).every((n) => Number.isInteger(n) && (n as number) >= 0)
    && Array.isArray(o.abertas) && o.abertas.every((n) => Number.isInteger(n));
  if (!valido) throw new Error('Resposta inválida do banco.');
  return { contagens: contagens as Record<string, number>, abertas: o!.abertas as number[] };
}

export const temHistorico = (u: UsoDoCadastro) => Object.values(u.contagens).some((n) => n > 0);

// O banco recusa de novo; aqui só escolhe a janela.
export const modoDaExclusao = (u: UsoDoCadastro, admin: boolean): ModoExclusao => (admin && !temHistorico(u) ? 'excluir' : 'arquivar');

const juntar = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`);

export function fraseDoUso(tipo: TipoCadastro, u: UsoDoCadastro): string {
  const conhecidas = new Set(ROTULOS.map(([k]) => k));
  // Contagem que o banco ganhou e a tela ainda não conhece: aparece pelo nome da chave.
  const extras = Object.keys(u.contagens).filter((k) => !conhecidas.has(k))
    .map((k): [string, string, string, 'f' | 'm'] => [k, k.replace(/_/g, ' '), k.replace(/_/g, ' '), 'm']);
  const usados = [...ROTULOS, ...extras].filter(([k]) => (u.contagens[k] ?? 0) > 0);
  if (usados.length === 0) return `Nunca foi usado. ${SAIDA[tipo]}`;
  const itens = usados.map(([k, s, p]) => `${u.contagens[k]} ${u.contagens[k] === 1 ? s : p}`);
  const um = usados.length === 1 && u.contagens[usados[0]![0]] === 1;
  const feminino = usados.every(([, , , g]) => g === 'f');
  const verbo = um ? `fica guardad${feminino ? 'a' : 'o'}` : `ficam guardad${feminino ? 'as' : 'os'}`;
  return `${juntar(itens)} ${verbo}. ${SAIDA[tipo]}`;
}

export function avisoAbertas(abertas: number[]): string | null {
  if (abertas.length === 0) return null;
  const mostrar = abertas.slice(0, 3).map((n) => `#${n}`);
  const resto = abertas.length - mostrar.length;
  const lista = resto > 0 ? `${mostrar.join(', ')} e mais ${resto}` : mostrar.join(', ');
  return abertas.length === 1 ? `1 demanda ainda aberta (${lista})` : `${abertas.length} demandas ainda abertas (${lista})`;
}

export function textosDaJanela(tipo: TipoCadastro, u: UsoDoCadastro, admin: boolean): TextosJanela {
  if (modoDaExclusao(u, admin) === 'excluir') {
    return { modo: 'excluir', verbo: 'Excluir de vez', descricao: NUNCA_USADO[tipo], aviso: null, confirmar: 'Excluir de vez', enviando: 'Excluindo…' };
  }
  return { modo: 'arquivar', verbo: 'Arquivar', descricao: fraseDoUso(tipo, u), aviso: avisoAbertas(u.abertas), confirmar: 'Sim, arquivar', enviando: 'Arquivando…' };
}

export function descreverArquivamento(arquivadoEm: string | null, arquivadoPor: string | null): string {
  if (!arquivadoEm) return 'Arquivado antes do registro de datas.';
  return `Arquivado em ${formatarData(arquivadoEm)}${arquivadoPor ? ` por ${arquivadoPor}` : ''}.`;
}
```

- [ ] **Passo 4: rodar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/lib/arquivo.test.ts`. Esperado: PASSA.

- [ ] **Passo 5: teste das server actions (falha)**

```ts
// apps/painel/src/lib/arquivo-acoes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server actions do arquivo com a sessão, o Supabase e o Auth falsos (sem banco). O banco confere de novo (pgTAP).
const falso = vi.hoisted(() => ({
  usuario: { id: 'u1', nome: 'Bia', papel: 'atendente' as 'admin' | 'atendente', permissoes: ['editar_clientes'], setores: [] as string[], tamanhoLetra: 'normal' },
  rpc: vi.fn(),
  deleteUser: vi.fn(),
  revalidatePath: vi.fn(),
  ordem: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: falso.revalidatePath }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ rpc: falso.rpc }) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ auth: { admin: { deleteUser: falso.deleteUser } } }) }));
vi.mock('@/lib/sessao', () => ({
  obterUsuario: async () => falso.usuario,
  temPermissao: (u: { papel: string; permissoes: string[] }, p: string) => u.papel === 'admin' || u.permissoes.includes(p),
}));

import { arquivarCadastro, consultarUso, excluirCadastroDeVez, restaurarCadastro } from './arquivo-acoes';

const ID = '11111111-1111-4111-8111-111111111111';
const admin = () => { falso.usuario = { ...falso.usuario, papel: 'admin', permissoes: [] }; };

beforeEach(() => {
  falso.usuario = { id: 'u1', nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'], setores: [], tamanhoLetra: 'normal' };
  falso.ordem = [];
  falso.rpc.mockReset().mockImplementation(async (nome: string) => { falso.ordem.push(nome); return { data: null, error: null }; });
  falso.deleteUser.mockReset().mockImplementation(async () => { falso.ordem.push('deleteUser'); return { error: null }; });
  falso.revalidatePath.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('arquivo: permissões antes do banco', () => {
  it('quem tem Editar clientes arquiva e restaura pelo banco e as telas atualizam', async () => {
    expect(await arquivarCadastro('cliente', ID)).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('arquivar_cadastro', { p_tipo: 'cliente', p_id: ID });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/clientes', 'layout');
    expect(await restaurarCadastro('contato', ID)).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_cadastro', { p_tipo: 'contato', p_id: ID });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/contatos', 'layout');
  });

  it('sem Editar clientes não chama o banco', async () => {
    falso.usuario = { ...falso.usuario, permissoes: [] };
    const recusa = { ok: false, erro: 'Sem permissão para arquivar cadastros.' };
    expect(await arquivarCadastro('cliente', ID)).toEqual(recusa);
    expect(await restaurarCadastro('produto', ID)).toEqual(recusa);
    expect(await consultarUso('rede', ID)).toEqual(recusa);
    expect(falso.rpc).not.toHaveBeenCalled();
  });

  it('só o administrador arquiva pessoas e exclui de vez', async () => {
    expect(await arquivarCadastro('usuario', ID)).toEqual({ ok: false, erro: 'Só o administrador arquiva pessoas.' });
    expect(await excluirCadastroDeVez('cliente', ID)).toEqual({ ok: false, erro: 'Só o administrador exclui de vez.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });

  it('tipo ou id estranho não chega ao banco', async () => {
    expect(await arquivarCadastro('banana' as never, ID)).toEqual({ ok: false, erro: 'Cadastro inválido.' });
    expect(await arquivarCadastro('cliente', 'x')).toEqual({ ok: false, erro: 'Cadastro inválido.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });
});

describe('arquivo: banco e Auth', () => {
  it('consultarUso devolve o uso lido e se a pessoa é administradora', async () => {
    falso.rpc.mockResolvedValueOnce({ data: { contagens: { demandas: 1 }, abertas: [7] }, error: null });
    expect(await consultarUso('cliente', ID)).toEqual({ ok: true, uso: { contagens: { demandas: 1 }, abertas: [7] }, admin: false });
    expect(falso.rpc).toHaveBeenCalledWith('uso_do_cadastro', { p_tipo: 'cliente', p_id: ID });
  });

  it('recusa do banco aparece na tela (o cadastro ganhou histórico depois da janela abrir) e o login não é tocado', async () => {
    admin();
    falso.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.' } });
    expect(await excluirCadastroDeVez('usuario', ID)).toEqual({ ok: false, erro: 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.' });
    expect(falso.deleteUser).not.toHaveBeenCalled();
  });

  it('excluir pessoa: primeiro o banco confere e apaga, depois sai do login', async () => {
    admin();
    expect(await excluirCadastroDeVez('usuario', ID)).toEqual({ ok: true });
    expect(falso.ordem).toEqual(['excluir_cadastro_definitivo', 'deleteUser']);
    expect(falso.deleteUser).toHaveBeenCalledWith(ID);
    expect(falso.revalidatePath).toHaveBeenCalledWith('/usuarios', 'layout');
  });

  it('excluir outro cadastro não mexe no login', async () => {
    admin();
    expect(await excluirCadastroDeVez('produto', ID)).toEqual({ ok: true });
    expect(falso.deleteUser).not.toHaveBeenCalled();
  });

  it('login que não sai vira aviso', async () => {
    admin();
    falso.deleteUser.mockResolvedValueOnce({ error: { message: 'User not found' } });
    expect(await excluirCadastroDeVez('usuario', ID)).toEqual({ ok: false, erro: 'Saiu do painel, mas o login não foi removido: User not found' });
  });
});
```

- [ ] **Passo 6: ver falhar**

Rode `pnpm --filter @escritorio/painel exec vitest run src/lib/arquivo-acoes.test.ts`. Esperado: FALHA, porque o módulo não existe.

- [ ] **Passo 7: implementar `lib/arquivo-acoes.ts`**

```ts
// apps/painel/src/lib/arquivo-acoes.ts
'use server';
import { revalidatePath } from 'next/cache';
import { obterUsuario, temPermissao, type UsuarioPainel } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ehTipoCadastro, lerUso, ROTAS_DO_TIPO, type TipoCadastro, type UsoDoCadastro } from './arquivo';

export type ResultadoArquivo = { ok: true } | { ok: false; erro: string };
type Conferido = { u: UsuarioPainel; tipo: TipoCadastro; id: string } | { erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Mesma regra do banco (exigir_arquivar): a tela recusa antes, o banco recusa de novo. */
function motivoSemPermissao(u: UsuarioPainel, tipo: TipoCadastro): string | null {
  if (tipo === 'usuario') return u.papel === 'admin' ? null : 'Só o administrador arquiva pessoas.';
  return temPermissao(u, 'editar_clientes') ? null : 'Sem permissão para arquivar cadastros.';
}

async function conferir(tipo: unknown, id: unknown): Promise<Conferido> {
  if (!ehTipoCadastro(tipo) || typeof id !== 'string' || !UUID.test(id)) return { erro: 'Cadastro inválido.' };
  return { u: await obterUsuario(), tipo, id };
}

function revalidar(tipo: TipoCadastro) {
  for (const rota of ROTAS_DO_TIPO[tipo]) revalidatePath(rota, 'layout');
}

/** Chama a função do banco com a sessão da pessoa: a auditoria registra quem fez. */
async function chamar(nome: 'arquivar_cadastro' | 'restaurar_cadastro' | 'excluir_cadastro_definitivo', tipo: TipoCadastro, id: string) {
  const sb = await supabaseServidor();
  const { error } = await sb.rpc(nome, { p_tipo: tipo, p_id: id });
  return error ? error.message : null;
}

export async function consultarUso(tipo: TipoCadastro, id: string): Promise<{ ok: true; uso: UsoDoCadastro; admin: boolean } | { ok: false; erro: string }> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  const motivo = motivoSemPermissao(c.u, c.tipo);
  if (motivo) return { ok: false, erro: motivo };
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('uso_do_cadastro', { p_tipo: c.tipo, p_id: c.id });
  if (error) return { ok: false, erro: error.message };
  try {
    return { ok: true, uso: lerUso(data), admin: c.u.papel === 'admin' };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

export async function arquivarCadastro(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  const motivo = motivoSemPermissao(c.u, c.tipo);
  if (motivo) return { ok: false, erro: motivo };
  const erro = await chamar('arquivar_cadastro', c.tipo, c.id);
  if (erro) return { ok: false, erro };
  revalidar(c.tipo);
  return { ok: true };
}

export async function restaurarCadastro(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  const motivo = motivoSemPermissao(c.u, c.tipo);
  if (motivo) return { ok: false, erro: motivo };
  const erro = await chamar('restaurar_cadastro', c.tipo, c.id);
  if (erro) return { ok: false, erro };
  revalidar(c.tipo);
  return { ok: true };
}

export async function excluirCadastroDeVez(tipo: TipoCadastro, id: string): Promise<ResultadoArquivo> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  if (c.u.papel !== 'admin') return { ok: false, erro: 'Só o administrador exclui de vez.' };
  const erro = await chamar('excluir_cadastro_definitivo', c.tipo, c.id);
  if (erro) return { ok: false, erro };
  if (c.tipo === 'usuario') {
    // O banco já conferiu que a pessoa nunca atendeu e a tirou do painel; só a chave de serviço remove do login.
    const { error } = await supabaseServico().auth.admin.deleteUser(c.id);
    if (error) {
      console.error('[arquivo] pessoa excluída do painel, mas não do login', error.message);
      revalidar(c.tipo);
      return { ok: false, erro: `Saiu do painel, mas o login não foi removido: ${error.message}` };
    }
  }
  revalidar(c.tipo);
  return { ok: true };
}
```

Por que não `redirect` aqui: o componente cliente navega depois do `{ ok: true }` (`router.push`). Assim a resposta nunca se perde num redirecionamento, e não existe destino vindo do navegador.

- [ ] **Passo 8: implementar `lib/arquivados.ts` (sem teste próprio; coberto pelos e2e das Tasks 4 a 7)**

```ts
// apps/painel/src/lib/arquivados.ts
import 'server-only';
import { NOME_ANONIMIZADO, type TipoCadastro } from './arquivo';
import { mascararCNPJ, mascararTelefone } from './formatos';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
export type LinhaArquivada = { id: string; nome: string; detalhe: string | null; arquivadoEm: string | null; arquivadoPor: string | null };
export type FiltroArquivados = { clienteId?: string; tipoParceiro?: 'cliente' | 'fornecedor' };
type Bruta = { id: string; nome: string; detalhe: string | null; arquivado_em: string | null; arquivado_por: string | null };
type Lida = { brutas: Bruta[]; erro: boolean };

const RECENTES = { ascending: false, nullsFirst: false } as const;
const lida = <T,>(r: { data: T[] | null; error: unknown }, mapa: (l: T) => Bruta): Lida => ({ brutas: (r.data ?? []).map(mapa), erro: Boolean(r.error) });

async function lerBrutas(sb: Sb, tipo: TipoCadastro, f: FiltroArquivados): Promise<Lida> {
  switch (tipo) {
    case 'cliente':
      return lida(await sb.from('clientes').select('id, razao_social, cnpj, arquivado_em, arquivado_por').eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.razao_social, detalhe: `CNPJ ${mascararCNPJ(l.cnpj)}`, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'contato':
      // Contato anonimizado (LGPD) não é "arquivado": não aparece nem volta.
      return lida(await sb.from('contatos').select('id, nome, telefone, arquivado_em, arquivado_por').eq('ativo', false).neq('nome', NOME_ANONIMIZADO).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome, detalhe: mascararTelefone(l.telefone), arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'usuario':
      return lida(await sb.from('usuarios').select('id, nome, email, arquivado_em, arquivado_por').eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome, detalhe: l.email, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'produto':
      return lida(await sb.from('produtos').select('id, codigo, descricao, arquivado_em, arquivado_por').eq('cliente_id', f.clienteId!).eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.descricao, detalhe: `Código ${l.codigo}`, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'rede':
      return lida(await sb.from('parceiros_grupos').select('id, nome, arquivado_em, arquivado_por').eq('cliente_id', f.clienteId!).eq('tipo', f.tipoParceiro!).eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome, detalhe: null, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
    case 'unidade':
      return lida(await sb.from('parceiros_unidades').select('id, nome_unidade, arquivado_em, arquivado_por, parceiros_grupos!inner(nome, tipo)')
        .eq('cliente_id', f.clienteId!).eq('parceiros_grupos.tipo', f.tipoParceiro!).eq('ativo', false).order('arquivado_em', RECENTES),
        (l) => ({ id: l.id, nome: l.nome_unidade, detalhe: `Unidade de ${l.parceiros_grupos.nome}`, arquivado_em: l.arquivado_em, arquivado_por: l.arquivado_por }));
  }
}

/** Arquivados de um tipo, mais recentes primeiro, com o nome de quem arquivou. */
export async function lerArquivados(sb: Sb, tipo: TipoCadastro, filtro: FiltroArquivados = {}): Promise<{ linhas: LinhaArquivada[]; erro: boolean }> {
  const { brutas, erro } = await lerBrutas(sb, tipo, filtro);
  if (erro) console.error('[arquivados] falha ao ler', tipo);
  const ids = [...new Set(brutas.flatMap((l) => (l.arquivado_por ? [l.arquivado_por] : [])))];
  const { data: pessoas } = ids.length ? await sb.from('usuarios').select('id, nome').in('id', ids) : { data: [] as { id: string; nome: string }[] };
  const nomes = new Map((pessoas ?? []).map((p) => [p.id, p.nome]));
  return {
    erro,
    linhas: brutas.map((l) => ({
      id: l.id, nome: l.nome, detalhe: l.detalhe, arquivadoEm: l.arquivado_em,
      arquivadoPor: l.arquivado_por ? nomes.get(l.arquivado_por) ?? 'pessoa removida' : null,
    })),
  };
}

/** Número do botão "Arquivados (n)" das telas de lista. */
export async function contarArquivados(sb: Sb, tipo: 'cliente' | 'contato' | 'usuario'): Promise<number> {
  const conta = { count: 'exact', head: true } as const;
  const r = tipo === 'cliente' ? await sb.from('clientes').select('id', conta).eq('ativo', false)
    : tipo === 'contato' ? await sb.from('contatos').select('id', conta).eq('ativo', false).neq('nome', NOME_ANONIMIZADO)
    : await sb.from('usuarios').select('id', conta).eq('ativo', false);
  return r.count ?? 0;
}

/** Nome de quem arquivou (aviso nas fichas). */
export async function nomeDaPessoa(sb: Sb, id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await sb.from('usuarios').select('nome').eq('id', id).maybeSingle();
  return data?.nome ?? 'pessoa removida';
}
```

Se o TypeScript reclamar do tipo da relação `parceiros_grupos` (objeto × lista), use o mesmo formato de `secao-parceiros.tsx`. Lá ela vem como objeto por causa da FK composta, e `repos.ts` usa `l.parceiros_grupos.nome`.

- [ ] **Passo 9: rodar**

Rode `pnpm --filter @escritorio/painel test` e depois `pnpm --filter @escritorio/painel typecheck`. Esperado: tudo passa, inclusive `escala.test.ts`.

- [ ] **Passo 10: commit**

```bash
git add apps/painel/src/lib/arquivo.ts apps/painel/src/lib/arquivo.test.ts apps/painel/src/lib/arquivo-acoes.ts apps/painel/src/lib/arquivo-acoes.test.ts apps/painel/src/lib/arquivados.ts "apps/painel/src/app/(painel)/contatos/detalhe-contato.tsx"
git commit -m "feat(painel): regras, textos e ações de arquivar, restaurar e excluir de vez"
```

---

### Task 4: O "Excluir…" e a tela de Clientes

**Arquivos:**
- Modificar: `apps/painel/src/components/patterns/confirm-dialog.tsx` (modo controlado)
- Criar: `apps/painel/src/components/patterns/excluir-cadastro.tsx`
- Criar: `apps/painel/src/components/patterns/lista-arquivados.tsx`
- Modificar: `apps/painel/src/app/(painel)/clientes/(lista)/page.tsx`
- Modificar: `apps/painel/src/app/(painel)/clientes/[id]/page.tsx`
- Modificar: `apps/painel/src/app/(painel)/clientes/acoes.ts` (`salvarClienteSemAviso`, CNPJ arquivado)
- Modificar: `apps/painel/src/app/api/busca/route.ts`
- Criar: `apps/painel/e2e/arquivar-clientes.spec.ts`

**Interfaces:**
- Consome: tudo o que a Task 3 produz.
- Produz:

```ts
// confirm-dialog.tsx: props novas (as antigas continuam iguais)
gatilho?: ReactElement;                 // agora opcional: sem ele, quem chama abre a janela
aberto?: boolean;                       // com ele, a janela é controlada
aoMudarAberto?: (aberto: boolean) => void;

// excluir-cadastro.tsx ('use client')
export function ExcluirCadastro(props: { tipo: TipoCadastro; id: string; nome: string; variante?: 'icone' | 'area'; voltarPara?: string }): JSX.Element;
//   icone: botão quadrado com nome acessível `Arquivar ou excluir ${nome}`; area: seção com AJUDA_EXCLUIR e botão "Excluir…".
export function BotaoRestaurar(props: { tipo: TipoCadastro; id: string; nome: string }): JSX.Element;
//   nome acessível `Restaurar ${nome}`.

// lista-arquivados.tsx (server)
export function ListaArquivados(props: { rotulo: string; tipo: TipoCadastro; linhas: LinhaArquivada[]; pode: boolean; vazio: string; erro?: boolean }): JSX.Element;
export function LinkArquivados(props: { href: string; total: number }): JSX.Element;       // nome acessível "Arquivados (n)"
export async function TelaArquivados(props: { tipo: 'cliente' | 'contato' | 'usuario'; titulo: string; voltar: { rotulo: string; href: string }; pode: boolean }): Promise<JSX.Element>;
export function AvisoArquivado(props: { tipo: TipoCadastro; id: string; nome: string; arquivadoEm: string | null; arquivadoPor: string | null; pode: boolean }): JSX.Element;
```

- [ ] **Passo 1: escrever o e2e (falha)**

```ts
// apps/painel/e2e/arquivar-clientes.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: arquivar, excluir de vez e restaurar clientes (spec, seção 5; imagens 01 e 02).
const CNPJ_SOL = '17170000000132';
const CNPJ_DUP = '17170000000213';
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('chamados').delete().like('titulo', '%(arquivar e2e)%');
  await db.from('clientes').delete().in('cnpj', [CNPJ_SOL, CNPJ_DUP]);
});

async function semearPadaria() {
  const { data: c } = await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: CNPJ_SOL }).select().single();
  const { data: s } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: d } = await db.from('chamados').insert({ cliente_id: c!.id, setor_id: s!.id, titulo: 'Nota de março (arquivar e2e)' }).select('id, numero').single();
  return { id: c!.id, numero: Number(d!.numero) };
}
async function semearNuncaUsado() {
  const { data } = await db.from('clientes').insert({ razao_social: 'Teste Cadastro Duplicado', cnpj: CNPJ_DUP }).select().single();
  return data!.id as string;
}
async function comoAdmin(page: Page) {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
}
const linha = (page: Page, texto: string) => page.getByRole('row').filter({ hasText: texto });

test('arquivar cliente com demanda aberta avisa, some da lista e da busca, e volta ao restaurar', async ({ page }) => {
  const sol = await semearPadaria();
  await comoAdmin(page);
  await page.goto('/clientes');
  await linha(page, 'Padaria Sol ME').getByRole('button', { name: 'Arquivar ou excluir Padaria Sol ME' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Padaria Sol ME?' });
  await expect(janela).toContainText('1 demanda fica guardada. Sai das listas e do agente.');
  await expect(janela).toContainText(`1 demanda ainda aberta (#${sol.numero})`);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();

  await expect(linha(page, 'Padaria Sol ME')).toHaveCount(0);
  await expect.poll(async () => (await db.from('clientes').select('ativo').eq('id', sol.id).single()).data!.ativo).toBe(false);
  // Avisa, não bloqueia nem conclui: a demanda continua aberta.
  expect((await db.from('chamados').select('status').eq('numero', sol.numero).single()).data!.status).toBe('aberto');
  const busca = await page.request.get('/api/busca?q=Padaria%20Sol');
  expect((await busca.json()).empresas).toEqual([]);

  await page.getByRole('link', { name: /^Arquivados \(\d+\)$/ }).click();
  const arquivada = linha(page, 'Padaria Sol ME');
  await expect(arquivada).toContainText('Admin');
  await arquivada.getByRole('button', { name: 'Restaurar Padaria Sol ME' }).click();
  await expect(arquivada).toHaveCount(0);
  await expect.poll(async () => (await db.from('clientes').select('ativo, arquivado_em, arquivado_por').eq('id', sol.id).single()).data)
    .toEqual({ ativo: true, arquivado_em: null, arquivado_por: null });
  await page.goto('/clientes');
  await expect(linha(page, 'Padaria Sol ME')).toHaveCount(1);
});

test('administrador exclui de vez o cliente nunca usado, digitando o nome', async ({ page }) => {
  const id = await semearNuncaUsado();
  await comoAdmin(page);
  await page.goto(`/clientes/${id}`);
  await page.getByRole('button', { name: 'Excluir…' }).click();
  const janela = page.getByRole('dialog', { name: 'Excluir de vez Teste Cadastro Duplicado?' });
  await expect(janela).toContainText('Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.');
  const botao = janela.getByRole('button', { name: 'Excluir de vez' });
  await expect(botao).toBeDisabled();
  await janela.getByLabel('Digite o nome para confirmar').fill('Teste Cadastro');
  await expect(botao).toBeDisabled();
  await janela.getByLabel('Digite o nome para confirmar').fill('teste cadastro duplicado');
  await botao.click();
  await page.waitForURL('**/clientes');
  await expect.poll(async () => (await db.from('clientes').select('id').eq('id', id)).data).toEqual([]);
});

test('se o cliente ganha histórico com a janela aberta, o banco recusa e nada é apagado', async ({ page }) => {
  const id = await semearNuncaUsado();
  await comoAdmin(page);
  await page.goto(`/clientes/${id}`);
  await page.getByRole('button', { name: 'Excluir…' }).click();
  const janela = page.getByRole('dialog', { name: 'Excluir de vez Teste Cadastro Duplicado?' });
  await janela.getByLabel('Digite o nome para confirmar').fill('Teste Cadastro Duplicado');
  await db.from('chamados').insert({ cliente_id: id, titulo: 'Chegou agora (arquivar e2e)' });
  await janela.getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(page.getByText('Este cadastro tem histórico e não pode ser excluído de vez. Arquive.')).toBeVisible();
  expect((await db.from('clientes').select('id').eq('id', id)).data).toHaveLength(1);
});

test('atendente sem Editar clientes não vê o comando', async ({ page }) => {
  const id = await semearNuncaUsado();
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: SENHA, nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', SENHA);
  await page.goto('/clientes');
  await expect(linha(page, 'Teste Cadastro Duplicado')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await page.goto(`/clientes/${id}`);
  await expect(page.getByRole('button', { name: 'Excluir…' })).toHaveCount(0);
});

test('quem edita clientes, mas não é administrador, arquiva o cliente nunca usado (não exclui de vez)', async ({ page }) => {
  const id = await semearNuncaUsado();
  await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia@teste.com', SENHA);
  await page.goto('/clientes');
  await linha(page, 'Teste Cadastro Duplicado').getByRole('button', { name: 'Arquivar ou excluir Teste Cadastro Duplicado' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Teste Cadastro Duplicado?' });
  await expect(janela).toContainText('Nunca foi usado. Sai das listas e do agente.');
  await expect(janela.getByRole('textbox')).toHaveCount(0);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect.poll(async () => (await db.from('clientes').select('ativo').eq('id', id).single()).data!.ativo).toBe(false);
});

test('cadastrar o CNPJ de um cliente arquivado aponta para os arquivados', async ({ page }) => {
  await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: CNPJ_SOL, ativo: false });
  await comoAdmin(page);
  await page.goto('/clientes/novo');
  await page.getByLabel('Razão social').fill('Padaria Sol Nova');
  await page.getByLabel('CNPJ').fill('17.170.000/0001-32');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.')).toBeVisible();
});
```

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-clientes.spec.ts`. Esperado: FALHA, porque o botão "Arquivar ou excluir …" não existe.

- [ ] **Passo 3: `ConfirmDialog` controlado**

Em `confirm-dialog.tsx`:
- em `Base`, troque `gatilho: ReactElement;` por `gatilho?: ReactElement;` e acrescente `aberto?: boolean; aoMudarAberto?: (aberto: boolean) => void;`, com a linha de doc "Janela controlada por quem chama (ex.: abre depois de consultar o banco)".
- No corpo:

```tsx
  const [abertoInterno, setAbertoInterno] = useState(false);
  const controlado = props.aberto !== undefined;
  const aberto = controlado ? Boolean(props.aberto) : abertoInterno;
  const mudarAberto = (v: boolean) => {
    if (controlado) props.aoMudarAberto?.(v);
    else setAbertoInterno(v);
    if (!v) setDigitado('');
  };
```

- Troque os `setAberto(false)` do `useEffect` do formulário externo por `mudarAberto(false)`. Para não recriar o efeito a cada render, guarde `mudarAberto` num `useRef` atualizado a cada render.
- Troque `<DialogTrigger asChild>{gatilho}</DialogTrigger>` por `{gatilho && <DialogTrigger asChild>{gatilho}</DialogTrigger>}`. Sem gatilho, o Radix devolve o foco ao elemento que estava focado antes de abrir: o botão que a pessoa clicou.

- [ ] **Passo 4: `excluir-cadastro.tsx`**

```tsx
// apps/painel/src/components/patterns/excluir-cadastro.tsx
'use client';

import { Archive, ArchiveRestore, TriangleAlert } from 'lucide-react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { AJUDA_EXCLUIR, textosDaJanela, type TextosJanela, type TipoCadastro } from '@/lib/arquivo';
import { arquivarCadastro, consultarUso, excluirCadastroDeVez, restaurarCadastro } from '@/lib/arquivo-acoes';
import { ConfirmDialog } from './confirm-dialog';

const FALHA = 'Não consegui concluir agora. Tente de novo.';

/**
 * O único "Excluir…" dos cadastros (spec 5.1): consulta o uso no banco ao clicar e abre a janela certa.
 * Com histórico, ou para quem não é administrador, arquiva. Nunca usado e administrador, exclui de vez digitando o nome.
 */
export function ExcluirCadastro({ tipo, id, nome, variante = 'icone', voltarPara }: {
  tipo: TipoCadastro; id: string; nome: string; variante?: 'icone' | 'area'; voltarPara?: string;
}) {
  const router = useRouter();
  const [janela, setJanela] = useState<TextosJanela | null>(null);
  const [aberto, setAberto] = useState(false);
  const [consultando, iniciar] = useTransition();

  // Sem "disabled" no botão: desabilitar tira o foco, e a janela precisa devolvê-lo ao botão quando fechar.
  const abrir = () => !consultando && iniciar(async () => {
    try {
      const r = await consultarUso(tipo, id);
      if (!r.ok) { toast.error(r.erro); return; }
      setJanela(textosDaJanela(tipo, r.uso, r.admin));
      setAberto(true);
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao consultar o uso', e);
      toast.error(FALHA);
    }
  });

  const confirmar = async () => {
    if (!janela) return;
    try {
      const r = janela.modo === 'excluir' ? await excluirCadastroDeVez(tipo, id) : await arquivarCadastro(tipo, id);
      if (!r.ok) { toast.error(r.erro); return; }
      toast.success(janela.modo === 'excluir' ? `Excluído de vez: ${nome}.` : `Arquivado: ${nome}.`);
      if (voltarPara) router.push(voltarPara);
      else router.refresh();
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao arquivar ou excluir', e);
      toast.error(FALHA);
    }
  };

  const botao = variante === 'icone' ? (
    <Button type="button" variant="outline" size="icon" onClick={abrir} aria-busy={consultando} aria-label={`Arquivar ou excluir ${nome}`}>
      <Archive aria-hidden size={16} strokeWidth={1.75} />
    </Button>
  ) : (
    <Button type="button" variant="outline" size="sm" onClick={abrir} aria-busy={consultando}>Excluir…</Button>
  );

  return (
    <>
      {variante === 'area' ? (
        <section aria-label="Excluir…" className="flex flex-col items-start gap-2 rounded-md border border-border p-4">
          <p className="text-sm text-muted">{AJUDA_EXCLUIR}</p>
          {botao}
        </section>
      ) : botao}
      {janela && (
        <ConfirmDialog
          aberto={aberto}
          aoMudarAberto={setAberto}
          tipo={janela.modo}
          titulo={<>{janela.verbo} <strong className="font-extrabold">{nome}</strong>?</>}
          descricao={(
            <>
              {janela.descricao}
              {janela.aviso && (
                <span className="mt-2 flex items-center justify-center gap-1.5 font-semibold text-danger">
                  <TriangleAlert aria-hidden size={16} strokeWidth={1.75} />
                  {janela.aviso}
                </span>
              )}
            </>
          )}
          confirmar={janela.confirmar}
          enviando={janela.enviando}
          digitarParaConfirmar={janela.modo === 'excluir' ? nome : undefined}
          acao={confirmar}
        />
      )}
    </>
  );
}

/** Restaurar não é destrutivo: volta na hora, sem janela. */
export function BotaoRestaurar({ tipo, id, nome }: { tipo: TipoCadastro; id: string; nome: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const restaurar = () => iniciar(async () => {
    try {
      const r = await restaurarCadastro(tipo, id);
      if (!r.ok) { toast.error(r.erro); return; }
      toast.success(`Restaurado: ${nome}.`);
      router.refresh();
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao restaurar', e);
      toast.error(FALHA);
    }
  });
  return (
    <Button type="button" variant="outline" size="sm" onClick={restaurar} disabled={enviando} aria-label={`Restaurar ${nome}`}>
      <ArchiveRestore aria-hidden size={16} strokeWidth={1.75} />
      {enviando ? 'Restaurando…' : 'Restaurar'}
    </Button>
  );
}
```

- [ ] **Passo 5: `lista-arquivados.tsx`**

```tsx
// apps/painel/src/components/patterns/lista-arquivados.tsx
import { Archive } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { variantesBotao } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descreverArquivamento, type TipoCadastro } from '@/lib/arquivo';
import { lerArquivados, type LinhaArquivada } from '@/lib/arquivados';
import { formatarData } from '@/lib/formatos';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { BotaoRestaurar } from './excluir-cadastro';

/** Tabela de arquivados: nome, quando e quem arquivou, e Restaurar (só com permissão). */
export function ListaArquivados({ rotulo, tipo, linhas, pode, vazio, erro }: {
  rotulo: string; tipo: TipoCadastro; linhas: LinhaArquivada[]; pode: boolean; vazio: string; erro?: boolean;
}) {
  if (erro) return <p role="alert" className="text-danger">Não consegui carregar os arquivados agora.</p>;
  if (linhas.length === 0) return <p className="py-6 text-center text-muted">{vazio}</p>;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table aria-label={rotulo}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nome</TableHead>
            <TableHead>Arquivado em</TableHead>
            <TableHead>Por</TableHead>
            {pode && <TableHead><span className="sr-only">Ações</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                <span className="font-medium text-foreground">{l.nome}</span>
                {l.detalhe && <span className="text-muted"> · {l.detalhe}</span>}
              </TableCell>
              <TableCell className="tabular text-muted">{l.arquivadoEm ? formatarData(l.arquivadoEm) : 'sem registro'}</TableCell>
              <TableCell className="text-muted">{l.arquivadoPor ?? '—'}</TableCell>
              {pode && <TableCell className="text-right"><BotaoRestaurar tipo={tipo} id={l.id} nome={l.nome} /></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Botão "ARQUIVADOS (n)" do topo das listas (imagem 01). */
export function LinkArquivados({ href, total }: { href: string; total: number }) {
  return (
    <Link href={href} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
      <Archive aria-hidden size={16} strokeWidth={1.75} />
      Arquivados ({total})
    </Link>
  );
}

/** Página "?ver=arquivados" das listas de clientes, contatos e usuários. */
export async function TelaArquivados({ tipo, titulo, voltar, pode }: {
  tipo: 'cliente' | 'contato' | 'usuario'; titulo: string; voltar: { rotulo: string; href: string }; pode: boolean;
}) {
  const sb = await supabaseServidor();
  const { linhas, erro } = await lerArquivados(sb, tipo);
  return (
    <section>
      <PageHeader
        titulo={titulo}
        contagem={linhas.length}
        migalhas={[{ rotulo: voltar.rotulo, href: voltar.href }, { rotulo: 'Arquivados' }]}
        descricao="Saíram das listas e do agente. Restaurar traz de volta como estavam."
      />
      <ListaArquivados rotulo={titulo} tipo={tipo} linhas={linhas} pode={pode} erro={erro} vazio="Nada arquivado." />
    </section>
  );
}

/** Faixa no topo da ficha de um cadastro arquivado, com Restaurar. */
export function AvisoArquivado({ tipo, id, nome, arquivadoEm, arquivadoPor, pode }: {
  tipo: TipoCadastro; id: string; nome: string; arquivadoEm: string | null; arquivadoPor: string | null; pode: boolean;
}) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-champagne bg-surface p-3 text-sm">
      <Archive aria-hidden size={16} strokeWidth={1.75} className="text-champagne-text" />
      <span className="flex-1">{descreverArquivamento(arquivadoEm, arquivadoPor)} Não aparece nas listas nem para o agente.</span>
      {pode && <BotaoRestaurar tipo={tipo} id={id} nome={nome} />}
    </div>
  );
}
```

- [ ] **Passo 6: lista de Clientes**

Em `clientes/(lista)/page.tsx`:
- Antes, rode `grep -rn "situacao\|Inativas\|'Ativa'" apps/painel/e2e`. Esperado: nada de Clientes.
- Logo depois de `const pode = …`:

```tsx
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="cliente" titulo="Clientes arquivados" voltar={{ rotulo: 'Clientes', href: '/clientes' }} pode={pode} />;
  }
```

- Remova `OPCOES_SITUACAO`, a leitura de `situacao` e o filtro "Situação" do `FilterBar`. Em `filtrar`, troque as duas linhas de situação por `r = r.eq('ativo', true);`, com o comentário "Arquivado sai da lista (spec 5.1)". `filtrando` passa a ser `Boolean(q)`.
- Coluna `situacao`: mostra só `Agente pausado`, ou `<span className="text-subtle">—</span>`, e o título continua "Situação". O selo Ativa/Inativa sai.
- Leia `const arquivados = await contarArquivados(sb, 'cliente');` junto com a contagem.
- `acoes` do `PageHeader`: `<LinkArquivados href="/clientes?ver=arquivados" total={arquivados} />` sempre e, com `pode`, o "Novo cliente" de antes.
- No `DataTable`, só com `pode`:

```tsx
        acoesLinha={pode ? (c) => (
          <span className="flex items-center justify-end gap-1">
            <Link href={`/clientes/${c.id}`} aria-label={`Editar ${c.razao_social}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            <ExcluirCadastro tipo="cliente" id={c.id} nome={c.razao_social} />
          </span>
        ) : undefined}
```

- [ ] **Passo 7: ficha do cliente**

Em `clientes/[id]/page.tsx`:
- O `select('*')` já traz `arquivado_em` e `arquivado_por`. Calcule `const arquivadoPor = c.ativo ? null : await nomeDaPessoa(sb, c.arquivado_por);`.
- Troque `{!c.ativo && <Badge variant="neutral">Inativa</Badge>}` por nada. Logo depois do `PageHeader`, ponha `{!c.ativo && <AvisoArquivado tipo="cliente" id={c.id} nome={c.razao_social} arquivadoEm={c.arquivado_em} arquivadoPor={arquivadoPor} pode={pode} />}`.
- No fim do `div`, depois das seções:

```tsx
      {aba === 'dados' && pode && c.ativo && <ExcluirCadastro tipo="cliente" id={c.id} nome={c.razao_social} variante="area" voltarPara="/clientes" />}
```

- [ ] **Passo 8: CNPJ arquivado e busca global**

Em `clientes/acoes.ts`, `salvarClienteSemAviso`, troque a linha do `insert`:

```ts
  const { data, error } = await sb.from('clientes').insert(dados).select('id').single();
  if (error) {
    if (!error.message.includes('duplicate')) throw new Error(error.message);
    // CNPJ é único também entre os arquivados: aponta o caminho em vez de um "já existe" sem saída.
    const { data: arquivado } = await sb.from('clientes').select('id').eq('cnpj', dados.cnpj).eq('ativo', false).maybeSingle();
    throw new Error(arquivado ? 'Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.' : 'Já existe cliente com este CNPJ.');
  }
```

Em `app/api/busca/route.ts`, acrescente `.eq('ativo', true)` às consultas de `clientes` e de `contatos`, com o comentário "Arquivado sai das buscas (spec 5.1)".

- [ ] **Passo 9: rodar**

Rode:
1. `pnpm --filter @escritorio/painel test`
2. `pnpm --filter @escritorio/painel typecheck`
3. `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-clientes.spec.ts e2e/clientes.spec.ts e2e/contatos.spec.ts e2e/demandas.spec.ts`

Os dois últimos specs usam o `ConfirmDialog` sem controle (LGPD e concluir). Esperado: tudo passa.

- [ ] **Passo 10: commit**

```bash
git add apps/painel/src/components/patterns "apps/painel/src/app/(painel)/clientes" apps/painel/src/app/api/busca/route.ts apps/painel/e2e/arquivar-clientes.spec.ts
git commit -m "feat(painel): Excluir… de clientes com arquivar, excluir de vez e Arquivados"
```

---

### Task 5: Contatos

**Arquivos:**
- Modificar: `apps/painel/src/app/(painel)/contatos/page.tsx`
- Modificar: `apps/painel/src/app/(painel)/contatos/detalhe-contato.tsx`
- Modificar: `apps/painel/src/app/(painel)/contatos/acoes.ts` (`cadastrarContato`)
- Modificar: `apps/painel/src/app/(painel)/clientes/acoes.ts` (`adicionarContatoSemAviso`)
- Modificar: `apps/painel/src/app/(painel)/atendimento/acoes.ts` (`cadastrarContatoDaConversa`)
- Modificar: `apps/painel/src/app/(painel)/clientes/[id]/secao-contatos.tsx`
- Criar: `apps/painel/e2e/arquivar-contatos.spec.ts`

**Interfaces:**
- Consome: `ExcluirCadastro`, `BotaoRestaurar`, `LinkArquivados`, `TelaArquivados` e `AvisoArquivado` (Task 4); `contarArquivados`, `nomeDaPessoa` e `NOME_ANONIMIZADO` (Task 3).
- Produz: nada novo para outras tasks.

- [ ] **Passo 1: escrever o e2e (falha)**

```ts
// apps/painel/e2e/arquivar-contatos.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: arquivar e restaurar contatos; "Apagar dados (LGPD)" continua separado e igual.
const TEL_MARIA = '5531999991701';
const TEL_ZE = '5531999991702';
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('chamados').delete().like('titulo', '%(contato e2e)%');
  await db.from('conversas').delete().in('telefone', [TEL_MARIA, TEL_ZE]);
  await db.from('contatos').delete().in('telefone', [TEL_MARIA, TEL_ZE]);
});

async function comoAdmin(page: Page) {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
}
const linha = (page: Page, texto: string) => page.getByRole('row').filter({ hasText: texto });

test('arquivar contato com conversa avisa a demanda aberta, sai da lista e volta ao restaurar', async ({ page }) => {
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA }).select().single();
  const { data: conversa } = await db.from('conversas').insert({ telefone: TEL_MARIA, contato_id: maria!.id }).select().single();
  const { data: s } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: d } = await db.from('chamados').insert({ conversa_id: conversa!.id, setor_id: s!.id, titulo: 'Boleto (contato e2e)' }).select('numero').single();
  await comoAdmin(page);
  await page.goto('/contatos');
  await linha(page, 'Maria Arquivo').getByRole('button', { name: 'Arquivar ou excluir Maria Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Maria Arquivo?' });
  await expect(janela).toContainText('1 demanda e 1 conversa ficam guardadas. Sai das listas e do agente.');
  await expect(janela).toContainText(`1 demanda ainda aberta (#${d!.numero})`);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(linha(page, 'Maria Arquivo')).toHaveCount(0);

  await page.getByRole('link', { name: /^Arquivados \(\d+\)$/ }).click();
  const arquivada = linha(page, 'Maria Arquivo');
  await expect(arquivada).toContainText('Admin');
  await arquivada.getByRole('button', { name: 'Restaurar Maria Arquivo' }).click();
  await expect(arquivada).toHaveCount(0);
  await expect.poll(async () => (await db.from('contatos').select('ativo').eq('id', maria!.id).single()).data!.ativo).toBe(true);
});

test('cadastrar de novo o telefone de um contato arquivado traz ele de volta', async ({ page }) => {
  await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-1702');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  await expect(linha(page, 'Zé Voltou')).toHaveCount(1);
  await expect.poll(async () => (await db.from('contatos').select('nome, ativo, arquivado_em').eq('telefone', TEL_ZE).single()).data)
    .toEqual({ nome: 'Zé Voltou', ativo: true, arquivado_em: null });
});

test('na ficha do contato, Excluir… e Apagar dados (LGPD) ficam separados', async ({ page }) => {
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA }).select().single();
  await comoAdmin(page);
  await page.goto(`/contatos?contato=${maria!.id}`);
  const painel = page.getByRole('dialog', { name: 'Maria Arquivo' });
  await painel.getByRole('button', { name: 'Excluir…' }).click();
  const excluir = page.getByRole('dialog', { name: 'Excluir de vez Maria Arquivo?' });
  await expect(excluir).toBeVisible();
  await excluir.getByRole('button', { name: 'Cancelar' }).click();
  await painel.getByRole('button', { name: 'Apagar dados (LGPD)' }).click();
  const lgpd = page.getByRole('dialog', { name: 'Apagar os dados de Maria Arquivo?' });
  await expect(lgpd).toContainText('A pedido do titular (LGPD): nome, telefone, mensagens, áudios e arquivos deste contato são apagados de vez, em todas as empresas.');
  await lgpd.getByRole('button', { name: 'Cancelar' }).click();
});

test('atendente sem Editar clientes não vê o comando nos contatos', async ({ page }) => {
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA }).select().single();
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: SENHA, nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', SENHA);
  await page.goto('/contatos');
  await expect(linha(page, 'Maria Arquivo')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await page.goto(`/contatos?contato=${maria!.id}`);
  await expect(page.getByRole('button', { name: 'Excluir…' })).toHaveCount(0);
});
```

Se o painel lateral não tiver o nome acessível "Maria Arquivo" (confira em `PainelLateralUrl`), troque `page.getByRole('dialog', { name: 'Maria Arquivo' })` pelo locator que `e2e/contatos.spec.ts` já usa para o painel do contato.

- [ ] **Passo 2: ver falhar**

Rode `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-contatos.spec.ts`. Esperado: FALHA.

- [ ] **Passo 3: lista de Contatos**

Em `contatos/page.tsx`:
- Logo depois de `const pode = …`:

```tsx
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="contato" titulo="Contatos arquivados" voltar={{ rotulo: 'Contatos', href: '/contatos' }} pode={pode} />;
  }
```

- Em `filtrar`, primeira linha: `let r = consulta.eq('ativo', true);`, com o comentário "Arquivado sai da lista (spec 5.1)".
- Na coluna `nome`, tire `{!c.ativo && <Badge variant="neutral">Inativo</Badge>}`. Remova o import de `Badge` se ficar sem uso.
- Some `const arquivados = await contarArquivados(sb, 'contato');`. Em `acoes` do `PageHeader`, ponha `<LinkArquivados href="/contatos?ver=arquivados" total={arquivados} />` antes do "Novo contato".
- No `DataTable`: `acoesLinha={pode ? (c) => <ExcluirCadastro tipo="contato" id={c.id} nome={c.nome} /> : undefined}`.

- [ ] **Passo 4: painel lateral do contato**

Em `detalhe-contato.tsx`:
- acrescente `arquivado_em, arquivado_por` ao `select`;
- calcule `const arquivadoPor = c.ativo ? null : await nomeDaPessoa(sb, c.arquivado_por);`;
- troque `{!c.ativo && <Badge variant="neutral">Inativo</Badge>}` por nada.
- No começo do `SheetBody`:

```tsx
        {!c.ativo && !anonimizado && (
          <div className="py-4"><AvisoArquivado tipo="contato" id={c.id} nome={c.nome} arquivadoEm={c.arquivado_em} arquivadoPor={arquivadoPor} pode={pode} /></div>
        )}
```

- Antes da zona de perigo da LGPD, que fica igual e separada:

```tsx
        {pode && c.ativo && (
          <div className="py-4"><ExcluirCadastro tipo="contato" id={c.id} nome={c.nome} variante="area" voltarPara="/contatos" /></div>
        )}
```

- [ ] **Passo 5: cadastrar de novo traz de volta; ficha só com ativos**

Nos três `upsert` de `contatos` (`contatos/acoes.ts`, `clientes/acoes.ts` em `adicionarContatoSemAviso` e `atendimento/acoes.ts` em `cadastrarContatoDaConversa`), acrescente `ativo: true` ao objeto, com o comentário "Cadastrar de novo um telefone arquivado traz o contato de volta (o gatilho limpa o arquivo)".

Em `clientes/[id]/secao-contatos.tsx`, troque o `select` dos vínculos por:

```ts
    .select('pode_pedir_nota, pode_atualizar_preco, contatos!inner(id, nome, telefone, agente_pausado, ativo)').eq('cliente_id', id).eq('contatos.ativo', true);
```

- [ ] **Passo 6: rodar**

Rode:
1. `pnpm --filter @escritorio/painel typecheck`
2. `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-contatos.spec.ts e2e/contatos.spec.ts e2e/contato-conversa.spec.ts e2e/clientes.spec.ts`

Esperado: tudo passa. O `contatos.spec.ts` existente é a prova de que a LGPD continua igual.

- [ ] **Passo 7: commit**

```bash
git add "apps/painel/src/app/(painel)/contatos" "apps/painel/src/app/(painel)/clientes" "apps/painel/src/app/(painel)/atendimento/acoes.ts" apps/painel/e2e/arquivar-contatos.spec.ts
git commit -m "feat(painel): arquivar e restaurar contatos; cadastrar de novo um telefone arquivado traz o contato de volta"
```

---

### Task 6: Produtos, redes e unidades na ficha do cliente

**Arquivos:**
- Modificar: `apps/painel/src/app/(painel)/clientes/cadastros-esquemas.ts` e `cadastros-esquemas.test.ts`
- Modificar: `apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts`
- Modificar: `apps/painel/src/app/(painel)/clientes/[id]/secao-produtos.tsx`
- Modificar: `apps/painel/src/app/(painel)/clientes/[id]/secao-parceiros.tsx`
- Modificar: `apps/painel/src/components/patterns/lista-arquivados.tsx` (acrescentar `ArquivadosRecolhidos`)
- Criar: `apps/painel/e2e/arquivar-cadastros.spec.ts`

**Interfaces:**
- Consome: `ExcluirCadastro` e `ListaArquivados` (Task 4); `lerArquivados(sb, 'produto' | 'rede' | 'unidade', { clienteId, tipoParceiro })` (Task 3).
- Produz:

```tsx
export function ArquivadosRecolhidos(props: { rotulo: string; tipo: TipoCadastro; linhas: LinhaArquivada[]; pode: boolean }): JSX.Element | null;
// <details> com <summary> "Arquivados (n)"; não aparece com n = 0.
```

- `GrupoForm`, `UnidadeForm` e `ProdutoForm` deixam de ter `ativo`.

- [ ] **Passo 1: testes dos esquemas (falha)**

Em `cadastros-esquemas.test.ts`, troque o esperado de `'rede com palavras-chave'` por `.toEqual({ nome: 'Supermercado Brasil', palavras_chave: ['brasil', 'sb'] })`. No `toMatchObject` da unidade, tire `ativo: false`. Depois acrescente:

```ts
  it('os formulários não decidem mais o arquivo: sem a caixa Ativo, salvar não arquiva (painel v2, parte B)', () => {
    expect(GrupoForm.parse({ nome: 'Rede', palavras_chave: '' })).not.toHaveProperty('ativo');
    expect(UnidadeForm.parse({ nome_unidade: 'Matriz' })).not.toHaveProperty('ativo');
    expect(ProdutoForm.parse({ codigo: '12', descricao: 'Costela' })).not.toHaveProperty('ativo');
    expect(ProdutoForm.parse({ codigo: '12', descricao: 'Costela', ativo: 'on' })).not.toHaveProperty('ativo');
  });
```

Rode `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/clientes/cadastros-esquemas.test.ts"`. Esperado: FALHA (`ativo: false` presente).

- [ ] **Passo 2: esquemas e ações**

- Em `cadastros-esquemas.ts`, tire `ativo: caixa,` dos três esquemas. Tire também a constante `caixa`, se ficar sem uso.
- Em `cadastros-acoes.ts`:
  - troque `GrupoForm.parse({ ativo: grupoId ? undefined : 'on', ...campos(formData) })` por `GrupoForm.parse(campos(formData))`, e faça o mesmo em `UnidadeForm` e `ProdutoForm`. Cadastro novo nasce ativo pelo `default true` do banco.
  - em `checar`, a mensagem de repetido passa a ser `'Já existe um cadastro igual (nome, CNPJ ou código repetido). Confira também os arquivados.'`. Antes, rode `grep -rn "cadastro igual" apps/painel/e2e`; esperado: nada.

Rode o vitest do passo 1. Esperado: PASSA.

- [ ] **Passo 3: escrever o e2e (falha)**

```ts
// apps/painel/e2e/arquivar-cadastros.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: produtos, redes e unidades da ficha com Excluir…, Arquivados e Restaurar.
const CNPJ = '18180000000186';
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('clientes').delete().eq('cnpj', CNPJ);
});

async function semear() {
  const { data: c } = await db.from('clientes').insert({ razao_social: 'Indústria Arquivo', cnpj: CNPJ }).select().single();
  const { data: rede } = await db.from('parceiros_grupos').insert({ cliente_id: c!.id, tipo: 'cliente', nome: 'Rede Arquivo' }).select().single();
  const { data: usada } = await db.from('parceiros_unidades').insert({ cliente_id: c!.id, grupo_id: rede!.id, nome_unidade: 'Unidade Usada' }).select().single();
  const { data: sobra } = await db.from('parceiros_unidades').insert({ cliente_id: c!.id, grupo_id: rede!.id, nome_unidade: 'Unidade Sobra' }).select().single();
  const { data: costela } = await db.from('produtos').insert({ cliente_id: c!.id, codigo: '12', descricao: 'Costela Arquivo', unidade: 'PAC' }).select().single();
  await db.from('precos').insert({ cliente_id: c!.id, grupo_id: rede!.id, produto_id: costela!.id, valor: 9.5 });
  return { cliente: c!.id as string, rede: rede!.id as string, usada: usada!.id as string, sobra: sobra!.id as string, costela: costela!.id as string };
}
async function comoAdmin(page: Page) {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
}

test('arquivar produto com preço: sai da aba Produtos, aparece em Arquivados e volta', async ({ page }) => {
  const s = await semear();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=produtos`);
  await page.getByRole('button', { name: 'Arquivar ou excluir Costela Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Costela Arquivo?' });
  await expect(janela).toContainText('1 preço fica guardado. Sai das listas e do agente.');
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(page.getByLabel('Descrição de 12')).toHaveCount(0);

  await page.getByText('Arquivados (1)').click();
  const arquivado = page.getByRole('row').filter({ hasText: 'Costela Arquivo' });
  await expect(arquivado).toContainText('Código 12');
  await arquivado.getByRole('button', { name: 'Restaurar Costela Arquivo' }).click();
  await expect(page.getByLabel('Descrição de 12')).toHaveValue('Costela Arquivo');
});

test('excluir de vez unidade nunca usada e arquivar rede com unidades', async ({ page }) => {
  const s = await semear();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=clientes`);
  await page.locator('summary').filter({ hasText: 'Unidade Sobra' }).click();
  await page.getByRole('button', { name: 'Arquivar ou excluir Unidade Sobra' }).click();
  const excluir = page.getByRole('dialog', { name: 'Excluir de vez Unidade Sobra?' });
  await excluir.getByLabel('Digite o nome para confirmar').fill('Unidade Sobra');
  await excluir.getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(page.locator('summary').filter({ hasText: 'Unidade Sobra' })).toHaveCount(0);
  await expect.poll(async () => (await db.from('parceiros_unidades').select('id').eq('id', s.sobra)).data).toEqual([]);

  await page.getByRole('button', { name: 'Arquivar ou excluir Rede Arquivo' }).click();
  const arquivar = page.getByRole('dialog', { name: 'Arquivar Rede Arquivo?' });
  await expect(arquivar).toContainText('1 preço e 1 unidade ficam guardados. Sai das listas e do agente.');
  await arquivar.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(page.getByLabel('Nome de Rede Arquivo')).toHaveCount(0);
  await expect.poll(async () => (await db.from('parceiros_grupos').select('ativo').eq('id', s.rede).single()).data!.ativo).toBe(false);
  // Arquivar a rede não mexe nas unidades: restaurar a rede devolve tudo como estava.
  expect((await db.from('parceiros_unidades').select('ativo').eq('id', s.usada).single()).data!.ativo).toBe(true);
});

test('salvar produto e rede sem a caixa Ativo mantém o cadastro ativo', async ({ page }) => {
  const s = await semear();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=produtos`);
  await expect(page.getByRole('checkbox', { name: 'Ativo' })).toHaveCount(0);
  await page.getByLabel('Descrição de 12').fill('Costela Nova');
  await page.getByLabel('Descrição de 12').press('Enter');
  await expect.poll(async () => (await db.from('produtos').select('descricao, ativo').eq('id', s.costela).single()).data)
    .toEqual({ descricao: 'Costela Nova', ativo: true });
  await page.goto(`/clientes/${s.cliente}?aba=clientes`);
  await page.getByLabel('Nome de Rede Arquivo').fill('Rede Arquivo Nova');
  await page.getByLabel('Nome de Rede Arquivo').press('Enter');
  await expect.poll(async () => (await db.from('parceiros_grupos').select('nome, ativo').eq('id', s.rede).single()).data)
    .toEqual({ nome: 'Rede Arquivo Nova', ativo: true });
});
```

Rode `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-cadastros.spec.ts`. Esperado: FALHA.

- [ ] **Passo 4: `ArquivadosRecolhidos`**

Em `lista-arquivados.tsx`:

```tsx
/** "Arquivados (n)" dentro de uma aba da ficha: recolhido, abre a lista com Restaurar. */
export function ArquivadosRecolhidos({ rotulo, tipo, linhas, pode }: { rotulo: string; tipo: TipoCadastro; linhas: LinhaArquivada[]; pode: boolean }) {
  if (linhas.length === 0) return null;
  return (
    <details className="group">
      <summary className={cn(variantesBotao({ variant: 'outline', size: 'sm' }), 'w-fit list-none [&::-webkit-details-marker]:hidden')}>
        <Archive aria-hidden size={16} strokeWidth={1.75} />
        Arquivados ({linhas.length})
      </summary>
      <div className="mt-2"><ListaArquivados rotulo={rotulo} tipo={tipo} linhas={linhas} pode={pode} vazio="Nada arquivado." /></div>
    </details>
  );
}
```

Importe `cn` de `@/lib/cn`. A classe `[&::-webkit-details-marker]:hidden` já é usada em `secao-parceiros.tsx`, e o teste de guarda aceita.

- [ ] **Passo 5: aba Produtos**

Em `secao-produtos.tsx`:
- consulta: `.eq('cliente_id', id).eq('ativo', true).order('descricao')`;
- leia junto `const { linhas: arquivados } = await lerArquivados(sb, 'produto', { clienteId: id });`.
- Tabela de leitura (sem `pode`): tire a coluna "Situação" (cabeçalho e célula).
- Formulário de cada linha:
  - tire o `<label …><input type="checkbox" name="ativo" …/> Ativo</label>`;
  - o espaço `col.situacao` passa a ter `<ExcluirCadastro tipo="produto" id={p.id} nome={p.descricao} />`;
  - o cabeçalho "Situação" vira `<span className={col.situacao}><span className="sr-only">Excluir…</span></span>`;
  - tire também o `opacity-70`, que era dos inativos.
- No fim do `Card`, nas duas versões: `<div className="px-4 pb-4"><ArquivadosRecolhidos rotulo="Produtos arquivados" tipo="produto" linhas={arquivados} pode={pode} /></div>`.

O `ExcluirCadastro` fica dentro do `<form>` da linha. O botão dele é `type="button"` e a janela abre num portal, então nada é enviado junto com o formulário.

- [ ] **Passo 6: abas Clientes e Fornecedores (redes e unidades)**

Em `secao-parceiros.tsx`:
- consulta: `.eq('cliente_id', id).eq('tipo', tipo).eq('ativo', true).eq('parceiros_unidades.ativo', true).order('nome')`, com o comentário "Arquivados saem da lista; a unidade arquivada sai da rede";
- leia junto `lerArquivados(sb, 'rede', { clienteId: id, tipoParceiro: tipo })` e `lerArquivados(sb, 'unidade', { clienteId: id, tipoParceiro: tipo })`.
- Cabeçalho da rede: tire a caixa "Ativo" e o selo "Inativo". Depois do botão "Salvar", e fora do `fieldset`, ponha `{pode && <ExcluirCadastro tipo="rede" id={g.id} nome={g.nome} />}`. Tire o `opacity-70` do `Card`.
- Unidade:
  - tire `{un.ativo ? '' : ' · inativa'}` do resumo;
  - no rodapé do formulário, troque o `<label>` "Ativa" por `{pode && <ExcluirCadastro tipo="unidade" id={un.id} nome={un.nome_unidade} />}`;
  - mantenha o `justify-between`.
- No fim, depois do card "Nova rede":

```tsx
      <ArquivadosRecolhidos rotulo={tipo === 'cliente' ? 'Redes arquivadas' : 'Fornecedores arquivados'} tipo="rede" linhas={redesArquivadas} pode={pode} />
      <ArquivadosRecolhidos rotulo="Unidades arquivadas" tipo="unidade" linhas={unidadesArquivadas} pode={pode} />
```

- [ ] **Passo 7: rodar**

Rode:
1. `pnpm --filter @escritorio/painel test`
2. `pnpm --filter @escritorio/painel typecheck`
3. `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-cadastros.spec.ts e2e/cadastros.spec.ts e2e/revisao.spec.ts e2e/revisao-final.spec.ts`

Esperado: tudo passa. Se um spec antigo marcava a caixa "Ativo", ele não existe hoje (o grep deu vazio). Se aparecer, ajuste e explique no commit.

- [ ] **Passo 8: commit**

```bash
git add "apps/painel/src/app/(painel)/clientes" apps/painel/src/components/patterns/lista-arquivados.tsx apps/painel/e2e/arquivar-cadastros.spec.ts
git commit -m "feat(painel): Excluir… e Arquivados em produtos, redes e unidades; caixas Ativo saem dos formulários"
```

---

### Task 7: Usuários e login bloqueado

**Arquivos:**
- Modificar: `apps/painel/src/app/(painel)/usuarios/page.tsx`
- Modificar: `apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx` (sai a chave "Ativo", linhas ~156-164)
- Modificar: `apps/painel/src/app/(painel)/usuarios/acoes.ts` (`salvarUsuario` não grava `ativo`)
- Criar: `apps/painel/src/app/(painel)/usuarios/acoes.test.ts`
- Modificar: `apps/painel/src/app/entrar/acoes.ts`
- Criar: `apps/painel/e2e/arquivar-usuarios.spec.ts`

**Interfaces:**
- Consome: `ExcluirCadastro`, `LinkArquivados`, `TelaArquivados` e `AvisoArquivado` (Task 4); `contarArquivados` e `nomeDaPessoa` (Task 3); `excluirCadastroDeVez` já remove do Auth (Task 3).
- Produz: `entrar(formData)` fecha a sessão e manda para `/entrar?erro=inativo` quando a pessoa não está ativa, ou não tem linha em `usuarios`.

- [ ] **Passo 1: teste de `salvarUsuario` (falha)**

```ts
// apps/painel/src/app/(painel)/usuarios/acoes.test.ts
import { describe, expect, it, vi } from 'vitest';

// Salvar a pessoa não decide mais o arquivo: a chave Ativo saiu (arquivar é pelo Excluir…, painel v2 parte B).
const falso = vi.hoisted(() => ({ atualizacoes: [] as Record<string, unknown>[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/erro-formulario', () => ({ comAvisoDeErro: async (_destino: string, acao: () => Promise<void>) => acao() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }) }) }));
const fim = { eq: async () => ({ error: null }) };
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: () => ({
      update: (dados: Record<string, unknown>) => { falso.atualizacoes.push(dados); return fim; },
      delete: () => fim,
      insert: async () => ({ error: null }),
    }),
  }),
}));

import { salvarUsuario } from './acoes';

describe('salvarUsuario', () => {
  it('não grava ativo, mesmo sem a chave no formulário', async () => {
    const f = new FormData();
    f.append('nome', 'Bia Souza');
    f.append('email', 'bia@escritorio.com');
    f.append('papel', 'atendente');
    await salvarUsuario('11111111-1111-4111-8111-111111111111', f);
    expect(falso.atualizacoes).toHaveLength(1);
    expect(falso.atualizacoes[0]).not.toHaveProperty('ativo');
    expect(falso.atualizacoes[0]).toMatchObject({ nome: 'Bia Souza', papel: 'atendente' });
  });
});
```

Rode `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/usuarios/acoes.test.ts"`. Esperado: FALHA (`ativo: false` no update).

- [ ] **Passo 2: formulário e ação**

- Em `usuarios/acoes.ts`, `salvarUsuario`: tire `ativo: formData.get('ativo') === 'on'` do `update`.
- Em `formulario-usuario.tsx`: tire o bloco `{editando && ( … Ativo … Switch name="ativo" … )}` e o trecho ", ao editar, ativo" do comentário. O `Switch` continua importado, porque as permissões usam.
- Antes, rode `grep -rn "'Ativo'\|name: 'Ativo'\|Desligado, a pessoa" apps/painel/e2e`. Esperado: nada.

Rode o vitest do passo 1. Esperado: PASSA.

- [ ] **Passo 3: escrever o e2e (falha)**

```ts
// apps/painel/e2e/arquivar-usuarios.spec.ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: pessoa arquivada não entra; excluir de vez só quem nunca atendeu, e sai também do login.
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('chamados').delete().like('titulo', '%(usuario e2e)%');
});

async function tentarEntrar(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const linha = (page: Page, texto: string) => page.getByRole('row').filter({ hasText: texto });

test('arquivar pessoa com demanda aberta: avisa, some da lista, não entra mais e volta ao restaurar', async ({ page }) => {
  const admin = await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia Arquivo', papel: 'atendente' });
  const { data: d } = await db.from('chamados').insert({ responsavel_id: bia, titulo: 'Folha de março (usuario e2e)' }).select('numero').single();
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios');
  // Ninguém arquiva o próprio acesso: a linha do administrador não tem o comando.
  await expect(linha(page, 'Admin Arquivo').getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await linha(page, 'Bia Arquivo').getByRole('button', { name: 'Arquivar ou excluir Bia Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Bia Arquivo?' });
  await expect(janela).toContainText('1 demanda fica guardada. Sai das listas e não entra mais no painel.');
  await expect(janela).toContainText(`1 demanda ainda aberta (#${d!.numero})`);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(linha(page, 'Bia Arquivo')).toHaveCount(0);
  await expect.poll(async () => (await db.from('usuarios').select('ativo, arquivado_por').eq('id', bia).single()).data)
    .toEqual({ ativo: false, arquivado_por: admin });

  await tentarEntrar(page, 'bia@teste.com');
  await page.waitForURL('**/entrar?erro=inativo');
  await expect(page.getByText('Seu acesso está desativado. Fale com o administrador.')).toBeVisible();
  await page.goto('/inicio');
  await page.waitForURL('**/entrar**');

  await page.context().clearCookies();
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios?ver=arquivados');
  await linha(page, 'Bia Arquivo').getByRole('button', { name: 'Restaurar Bia Arquivo' }).click();
  await expect(linha(page, 'Bia Arquivo')).toHaveCount(0);
  await page.context().clearCookies();
  await entrar(page, 'bia@teste.com', SENHA);
});

test('excluir de vez a pessoa que nunca atendeu tira também o login', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const novo = await criarUsuarioTeste({ email: 'novo@teste.com', senha: SENHA, nome: 'Novo Arquivo', papel: 'atendente' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios');
  await linha(page, 'Novo Arquivo').getByRole('button', { name: 'Arquivar ou excluir Novo Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Excluir de vez Novo Arquivo?' });
  await expect(janela).toContainText('Nunca atendeu: nenhuma conversa, demanda ou preço. O acesso ao login também é removido. Não dá para desfazer.');
  await janela.getByLabel('Digite o nome para confirmar').fill('Novo Arquivo');
  await janela.getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(linha(page, 'Novo Arquivo')).toHaveCount(0);
  await expect.poll(async () => (await db.from('usuarios').select('id').eq('id', novo)).data).toEqual([]);
  const { data } = await db.auth.admin.getUserById(novo);
  expect(data.user).toBeNull();
});

test('salvar a pessoa sem a chave Ativo não a desativa', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia Arquivo', papel: 'atendente' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/usuarios?usuario=${bia}`);
  await expect(page.getByRole('switch', { name: 'Ativo' })).toHaveCount(0);
  await page.getByPlaceholder('Nome').fill('Bia Arquivo Souza');
  await page.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect.poll(async () => (await db.from('usuarios').select('nome, ativo').eq('id', bia).single()).data)
    .toEqual({ nome: 'Bia Arquivo Souza', ativo: true });
});
```

Rode `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-usuarios.spec.ts`. Esperado: FALHA.

- [ ] **Passo 4: tela de Usuários**

Em `usuarios/page.tsx`:
- Depois de `await exigirAdmin()`, guarde o retorno: `const eu = await exigirAdmin();`.

```tsx
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="usuario" titulo="Usuários arquivados" voltar={{ rotulo: 'Usuários e permissões', href: '/usuarios' }} pode />;
  }
```

- `linhas` continua com todas as pessoas, porque o convite precisa de todos os e-mails para recusar repetido. Acrescente `arquivadoEm: u.arquivado_em, arquivadoPor: u.arquivado_por` ao `Linha` e crie:
  - `const ativos = linhas.filter((l) => l.ativo);`;
  - `const arquivados = linhas.length - ativos.length;`.
- `DataTable` usa `linhas={ativos}`, e `PageHeader` usa `contagem={ativos.length}`.
- Em `acoes`: `<><LinkArquivados href="/usuarios?ver=arquivados" total={arquivados} /><ConviteUsuario … /></>`.
- `acoesLinha={(u) => (u.id === eu.id ? null : <ExcluirCadastro tipo="usuario" id={u.id} nome={u.nome} />)}`, com o comentário "Ninguém arquiva nem exclui o próprio acesso".
- Painel lateral (`aberto`):
  - se `!aberto.ativo`, mostre o `SheetHeader` e, no lugar do formulário, `<SheetBody className="py-4"><AvisoArquivado tipo="usuario" id={aberto.id} nome={aberto.nome} arquivadoEm={aberto.arquivadoEm} arquivadoPor={linhas.find((l) => l.id === aberto.arquivadoPor)?.nome ?? null} pode /></SheetBody>`;
  - se ativo e `aberto.id !== eu.id`, depois do `FormularioUsuario`, `<div className="px-4 pb-4"><ExcluirCadastro tipo="usuario" id={aberto.id} nome={aberto.nome} variante="area" voltarPara="/usuarios" /></div>`.
- Tire `{!aberto.ativo && <Badge variant="outline">Desativado</Badge>}`, porque o aviso substitui.

- [ ] **Passo 5: login fecha a sessão de quem está arquivado**

Em `app/entrar/acoes.ts`:

```ts
  // Pessoa arquivada (ou sem cadastro no painel) não entra: a RLS nem deixa ler a própria linha, então perfil vem vazio.
  const { data: perfil } = await sb.from('usuarios').select('tamanho_letra, ativo').eq('id', data.user.id).maybeSingle();
  if (!perfil?.ativo) {
    await sb.auth.signOut();
    redirect('/entrar?erro=inativo');
  }
  // O tamanho da letra segue a pessoa, mesmo noutro computador.
  (await cookies()).set(COOKIE_LETRA, tamanhoDoValor(perfil.tamanho_letra), OPCOES_COOKIE_LETRA);
  redirect('/inicio');
```

- [ ] **Passo 6: rodar**

Rode:
1. `pnpm --filter @escritorio/painel test`
2. `pnpm --filter @escritorio/painel typecheck`
3. `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-usuarios.spec.ts e2e/login.spec.ts e2e/revisao-final.spec.ts e2e/menu.spec.ts`

Esperado: tudo passa.

- [ ] **Passo 7: commit**

```bash
git add "apps/painel/src/app/(painel)/usuarios" apps/painel/src/app/entrar/acoes.ts apps/painel/e2e/arquivar-usuarios.spec.ts
git commit -m "feat(painel): arquivar e excluir pessoas (excluir tira do login); arquivado não entra"
```

---

### Task 8: Acessibilidade das telas e da janela novas

**Arquivos:**
- Modificar: `apps/painel/e2e/acessibilidade.spec.ts`

**Interfaces:**
- Consome: as rotas `?ver=arquivados` (Tasks 4, 5 e 7) e o botão "Excluir…" da ficha (Task 4).
- Produz: nada.

- [ ] **Passo 1: acrescentar as rotas e a janela (falha se houver violação)**

Na lista `rotas` do teste ``telas do painel sem violações graves``, depois de `'/clientes'`, acrescente `'/clientes?ver=arquivados'`. Depois de `'/contatos'`, acrescente `'/contatos?ver=arquivados'`. Depois de `'/usuarios'`, acrescente `'/usuarios?ver=arquivados'`.

No teste ``janelas e menus abertos sem violações graves``, antes do `expect` final:

```ts
      // Janela do Excluir… (Parte B): a empresa semeada tem conversa e demanda, então abre no modo arquivar com o aviso.
      await page.goto(`/clientes/${ids.cliente}`);
      await page.getByRole('button', { name: 'Excluir…' }).click();
      await expect(page.getByRole('dialog', { name: /^Arquivar / })).toBeVisible();
      erros.push(...(await auditar(page, 'janela Excluir…', tema)));
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: 'Excluir…' })).toBeFocused();
```

O último `expect` prova que, sem `DialogTrigger`, o foco volta ao botão.

- [ ] **Passo 2: rodar**

Rode `pnpm --filter @escritorio/painel exec playwright test e2e/acessibilidade.spec.ts`. Esperado: passa nos dois temas. Se o axe acusar contraste no aviso vermelho ou no anel champanhe, a correção é no token (o `tokens.test.ts` da Parte A dita os pares). Nunca use cor solta.

- [ ] **Passo 3: commit**

```bash
git add apps/painel/e2e/acessibilidade.spec.ts
git commit -m "test(painel): axe nas telas de arquivados e na janela do Excluir…"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes**, com o Supabase local ligado e a migração aplicada (`supabase migration up`):
   - `supabase test db` (todos os arquivos, inclusive o 15 com 49/49);
   - `pnpm --filter @escritorio/db test`;
   - `pnpm --filter @escritorio/trabalhador test` e `pnpm --filter @escritorio/trabalhador typecheck`;
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e` (todos os specs, com axe nos dois temas).
   - Mostre ao dono os números exatos (passaram/falharam/pulados) de cada uma. Nada de "deve passar".
2. **Homologação:**
   - com as variáveis do `.env.homologacao` carregadas, rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Deve listar só `20261002000100_painel_v2_arquivar.sql`, além da migração da Parte A, se ela ainda não tiver sido aplicada;
   - **espere o "ok" dele**. Só então rode o mesmo comando sem `--dry-run`.
3. **Subir para o dono testar:** painel desta worktree na **porta 3004** (a 3003 está com a Parte A), apontando para a homologação. Use o mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal (`C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/ligar-teste.ps1`): variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p 3004` rodando nesta worktree. Antes, confirme que a porta está livre (`netstat -ano | findstr :3004`). Passe o endereço `http://localhost:3004`.
4. **Pendências** para listar no fim:
   - as decisões 1 a 10 deste plano que o dono ainda não confirmou;
   - o que ficou diferente das imagens 01 e 02;
   - o telefone de pessoa arquivada continua contando como "interno" para o agente (`ehTelefoneInterno` não olha `ativo`), sem mudança nesta parte.
5. **Não juntar** a branch em nada. Parar e esperar "próxima parte".
