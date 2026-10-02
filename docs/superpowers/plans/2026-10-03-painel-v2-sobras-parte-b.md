# Painel v2, sobras da Parte B (começo da Parte C). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task é uma sobra, com commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** fechar as 6 sobras da Parte B (spec, seção 3.0) antes da Parte C:
1. ícone de editar nas linhas de Contatos e Usuários;
2. "(inativo)" some de Demandas;
3. restaurar unidade de rede arquivada pergunta e restaura as duas;
4. telefone de pessoa arquivada diz isso e oferece o caminho;
5. contato arquivado cadastrado de novo: o painel pergunta quais empresas de antes voltam;
6. erro ao salvar em Usuários aparece no campo, sem fechar o painel.

**Arquitetura:**
- **Banco:** duas migrações novas e pequenas, porque a `20261002000100` já está na homologação e **não pode ser editada**:
  - `20261003000100`: troca `cadastrar_contato` por uma versão com a lista de empresas que voltam (`p_manter`), a recusa do contato apagado pela LGPD e a auditoria; cria `contato_arquivado_do_telefone`, só de leitura, para a tela perguntar;
  - `20261003000200`: cria `restaurar_unidade`, que pergunta pela rede arquivada e restaura as duas numa transação só.
- **Painel:**
  - a pergunta do contato é um componente cliente (`FormCadastroContato`) que envolve os três formulários que cadastram contato. Ele consulta o banco antes de enviar, abre a janela e manda as escolhas no mesmo formulário (`manter`);
  - os formulários de Usuários passam a receber o resultado da ação (`EstadoUsuario`) em vez de voltar por `?erro=`. O erro fica no campo, o painel continua aberto e nada do que foi digitado se perde;
  - o restaurar da unidade usa o mesmo `BotaoRestaurar`, que abre a janela quando o banco diz que a rede está arquivada.

**Tecnologias:** Next.js 15 (App Router, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, sonner, Supabase (Postgres, RLS, pgTAP), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção 3.0, "Sobras da Parte B", itens 1 a 6, com a decisão do dono no item 5;
- seção 3.1 (decisões gerais), seção 4.5 (janelas e avisos), seção 4.6 (tom dos textos) e seção 5 (Parte B).

Imagens: `docs/superpowers/specs/painel-v2/imagens/01-menu-e-clientes-arquivar.png` (coluna Ações com lápis e arquivar) e `02-excluir-de-vez.png`. Plano anterior, para o estilo e as convenções: `docs/superpowers/plans/2026-10-02-painel-v2-parte-b.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-c`, branch `painel-v2-parte-c`, criada de `painel-v2-parte-b` (HEAD `fd06688`). Todos os comandos rodam a partir da raiz da worktree.

## Perguntas para o dono

O spec não decide estes pontos, ou o código não bate com ele. O plano segue a **recomendação** de cada um; se a resposta for outra, ajuste a task indicada antes de executá-la.

| # | Pergunta | Recomendação (o que o plano faz) | Task |
|---|---|---|---|
| P1 | **Contatos não têm formulário de edição hoje.** O painel lateral do contato só mostra empresas, chave do agente e Excluir…. O que o lápis abre? | O lápis abre o painel lateral do contato, como clicar na linha, e o painel ganha **só o campo Nome** editável. Telefone, "vincular empresa" e as marcações por empresa ficam para a Parte G (7C.2, "EDITAR"), que redesenha esse painel. | 6 |
| P2 | **Restaurar unidade de rede arquivada:** se a pessoa responder "não" à pergunta, o que acontece? | **Nada muda.** A unidade continua arquivada. Restaurar só a unidade a deixaria ativa e invisível, que é justamente o defeito desta sobra. A janela tem só "Cancelar" e "Restaurar as duas". | 3 |
| P3 | **Telefone de pessoa arquivada:** o caso mais comum é o chip da empresa passar de quem saiu para quem entrou. O spec oferece "restaurar a pessoa ou usar outro telefone". Quer também "passar o número da pessoa arquivada para esta"? | Seguir o spec agora: mensagem, botão "Restaurar <nome>" e "ou use outro telefone". Passar o número é um passo pequeno a mais, que **não** está neste plano. | 5 |
| P4 | **"(inativa)" também aparece para empresa arquivada** em Treinar o agente: no escolher empresa, no "Ensinar o agente" da conversa e no selo da lista. O spec só fala de Demandas. | Trocar por "arquivada" junto, porque o estado é o mesmo e a palavra deve ser a mesma. Só texto. Fica no passo 6 da Task 7, que só roda se o dono disser "sim". | 7 |
| P5 | **O convite ("Convidar pessoa") usa o mesmo formulário de Usuários** e tem o mesmo defeito: a janela fecha e o erro vai para o topo. | Corrigir junto. A mudança é no formulário comum, e o convite fica mais simples (some a espera pela lista para saber se deu certo). | 4 |

## Restrições globais

- **Só mexer em:**
  - banco: **criar** `supabase/migrations/20261003000100_painel_v2_contato_volta.sql`, `supabase/migrations/20261003000200_painel_v2_restaurar_unidade.sql`, `supabase/tests/16_painel_v2_contato_volta.test.sql` e `supabase/tests/17_painel_v2_restaurar_unidade.test.sql`. No `supabase/tests/15_painel_v2_arquivar.test.sql`, só as 3 linhas de `cadastrar_contato` indicadas na Task 1;
  - `packages/db/src/tipos.gen.ts` (regerado, nunca à mão);
  - `apps/painel`.
  - Nada no trabalhador, em regra do agente, prompt ou Bling.
- **Nunca editar `supabase/migrations/20261002000100_painel_v2_arquivar.sql`.** Ela já está aplicada na homologação. Toda mudança de banco é migração nova.
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
  5. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Nunca rode teste contra a homologação, e não altere `.env.homologacao`.** Ele só é lido na Entrega, para o `--dry-run` e o painel de teste do dono. A migração só vai para a homologação depois de mostrar o `--dry-run` e receber o "ok" do dono.
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit.
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]` ou `w-[300px]`. Use os tokens e utilitários da Parte A (`text-danger`, `border-danger`, `bg-danger-soft`, `text-warning`, `text-champagne-text`, `variantesBotao` etc.). `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS dos botões. Vermelho nunca aparece sozinho: erro tem texto, e aviso tem ícone.
- **Termos:** Contato, Empresa, Demanda, Arquivados, Restaurar. Arquivado nunca é "inativo" na tela.
- **Reaproveite o que existe:** `ConfirmDialog` (modo controlado, modo `formulario=`), `ExcluirCadastro`, `BotaoRestaurar`, `FormField` (com `erro`), `FormularioAlteravel`, `BotaoSalvar`, `IndicadorAlteracoes`, `PainelLateralUrl`, `toast`, `variantesBotao`.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Decisões tomadas neste plano (o dono confirma ao aprovar)

1. **Ordem:** primeiro o banco e a tela da sobra 5, que é a maior. Depois a sobra 3, também com banco. Em seguida a 6 e a 4, que mexem no mesmo formulário (a 4 depende da 6), a 1 (o lápis de Contatos usa o `BotaoSalvar` com `enviando`, da 6) e por último a 2.
2. **A pergunta da sobra 5 só aparece quando há o que perguntar.** O telefone precisa ser de um contato arquivado com vínculo antigo com **outra empresa ativa**. Sem isso, o cadastro segue direto, como hoje.
3. **Empresa de antes que hoje está arquivada** não aparece na pergunta e não volta, nem que alguém mande o id à mão. Arquivado sai das seleções do painel (spec 5.1).
4. **A empresa da ação** (a da ficha, ou a escolhida na conversa) não aparece na lista, porque sempre entra. Entra com as marcações escolhidas agora, mesmo que fosse vínculo antigo com outras marcações. A janela avisa: "<Empresa> entra com as marcações escolhidas agora."
5. **O banco confere tudo de novo.** Se, entre a pergunta e o clique, o contato voltou por outro caminho, a lista é ignorada e o contato fica como está. Id de empresa sem vínculo antigo também é ignorado.
6. **Sem JavaScript, ou pelo painel antigo da Parte B** (porta 3004, que chama a função sem `p_manter`), nenhuma empresa antiga volta. É o comportamento de hoje, e a migração não quebra o painel que já está na homologação.
7. **Auditoria da volta:** ação `reativar_contato`, entidade `contatos`, `detalhes = {"empresa_nova", "mantidos": [ids], "removidos": [ids]}`. Só ids, sem nome nem telefone. O "Apagar dados (LGPD)" já apaga as linhas de auditoria desse contato.
8. **Contato apagado pela LGPD** (sobra parada na revisão da Parte B): `cadastrar_contato` recusa com "Os dados deste contato foram apagados (LGPD). Ele não volta.", a mesma frase do `restaurar_cadastro`. A consulta devolve `anonimizado`, e a tela mostra esse aviso sem enviar nada.
9. **Retorno de `cadastrar_contato`** ganha `vinculos_mantidos`. Por isso duas asserções do `15_painel_v2_arquivar.test.sql` passam a ignorar essa chave, e a de privilégio passa a usar a assinatura nova (Task 1, passo 3). O resto do arquivo 15 não muda.
10. **Restaurar unidade no banco** (`restaurar_unidade`) e não em duas chamadas da tela: a rede e a unidade voltam juntas ou nenhuma volta, e a rede fica travada entre a leitura e a escrita. A função reaproveita `restaurar_cadastro`, então a auditoria e as permissões são as de sempre.
11. **Erros em Usuários (sobra 6):**
    - erros de validação ficam no campo (Nome, E-mail, Telefone, Papel);
    - erros sem campo (banco, convite recusado) ficam num aviso dentro do formulário, no painel;
    - salvar confirma com aviso rápido: "Salvo: <nome>." ou "Convite enviado para <e-mail>.";
    - o `?erro=` some da tela de Usuários.
12. **Envio "à mão" nos formulários que precisam manter o que foi digitado** (Usuários e o Nome do contato): `onSubmit` com `preventDefault` e a server action chamada numa transição. O React 19 limpa o formulário quando a action vai pelo `<form action>`; assim, não limpa.

## Foco da revisão

Situações que o spec implica e que os testes antigos não cobrem. Cada uma tem teste na task dona:

1. **O contato muda entre a pergunta e o "Trazer de volta":** outra pessoa o cadastrou, ou uma empresa marcada foi arquivada. O banco decide na hora: contato já ativo fica como está, empresa arquivada não volta, id forjado é ignorado. Testado no pgTAP da Task 1 (asserções 11, 12 e 18).
2. **A empresa da ação também era vínculo antigo:** não aparece na pergunta e entra com as marcações novas. Testado no pgTAP da Task 1 (14 e 20), no vitest `contato-arquivado.test.ts` e no Playwright da Task 2.
3. **O painel antigo (Parte B, na homologação) chamando a função nova sem `p_manter`:** funciona como antes e não volta empresa nenhuma. Testado no pgTAP da Task 1 (13 e 19).
4. **Em Usuários, errar, corrigir e salvar:** o aviso do campo some, o painel continua aberto e "Alterações não salvas" some. Testado no Playwright da Task 4.
5. **A rede é restaurada por outra pessoa entre a pergunta e o "Restaurar as duas":** a unidade volta sem erro e a rede não é restaurada duas vezes. Testado no pgTAP da Task 3 (asserção 6, `p_com_rede = true` com a rede já ativa).

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261003000100_painel_v2_contato_volta.sql` (novo) | `cadastrar_contato` com `p_manter`, recusa LGPD e auditoria; `contato_arquivado_do_telefone` | 1 |
| `supabase/tests/16_painel_v2_contato_volta.test.sql` (novo) | pgTAP da sobra 5 | 1 |
| `supabase/tests/15_painel_v2_arquivar.test.sql` | 3 linhas: assinatura e retorno novos de `cadastrar_contato` | 1 |
| `packages/db/src/tipos.gen.ts` | tipos regerados | 1, 3 |
| `apps/painel/src/lib/contato-arquivado.ts` (+ teste, novos) | tipos e leitura da consulta, marcações em texto | 2 |
| `apps/painel/src/lib/contato-arquivado-acoes.ts` (+ teste, novos) | server action `consultarContatoArquivado` | 2 |
| `apps/painel/src/lib/cadastro-contato.ts` (+ teste) | `p_manter`, `lerManter`, avisos novos | 2 |
| `apps/painel/src/lib/avisos.ts` | 2 avisos novos | 2 |
| `apps/painel/src/components/patterns/confirm-dialog.tsx` | `children` também no modo `formulario=` | 2 |
| `apps/painel/src/components/patterns/form-cadastro-contato.tsx` (novo) | formulário que pergunta antes de cadastrar | 2 |
| `apps/painel/src/app/(painel)/contatos/page.tsx`, `contatos/acoes.ts`, `clientes/[id]/secao-contatos.tsx`, `clientes/acoes.ts`, `atendimento/[id]/contato-da-conversa.tsx`, `atendimento/acoes.ts` | os três caminhos usam a pergunta e mandam `manter` | 2 |
| `apps/painel/e2e/arquivar-contatos.spec.ts` | fluxos da pergunta | 2, 6 |
| `supabase/migrations/20261003000200_painel_v2_restaurar_unidade.sql` (novo), `supabase/tests/17_painel_v2_restaurar_unidade.test.sql` (novo) | `restaurar_unidade` | 3 |
| `apps/painel/src/lib/arquivo.ts` (+ teste), `lib/arquivo-acoes.ts` (+ teste), `components/patterns/excluir-cadastro.tsx` | restaurar unidade com a pergunta da rede | 3 |
| `apps/painel/e2e/arquivar-cadastros.spec.ts` | fluxo da unidade | 3 |
| `apps/painel/src/components/patterns/formulario-alteravel.tsx` | `BotaoSalvar` com `enviando` | 4 |
| `apps/painel/src/app/(painel)/usuarios/esquemas.ts` (+ teste), `usuarios/acoes.ts` (+ teste), `usuarios/formulario-usuario.tsx`, `usuarios/convite-usuario.tsx`, `usuarios/page.tsx` | erros no campo | 4, 5, 6 |
| `apps/painel/e2e/usuarios-erros.spec.ts` (novo), `e2e/revisao-final.spec.ts`, `e2e/configuracoes.spec.ts` | fluxos de erro de Usuários | 4, 5 |
| `apps/painel/src/app/(painel)/contatos/editar-nome-contato.tsx` (novo), `contatos/detalhe-contato.tsx`, `contatos/acoes.test.ts` (novo) | lápis e Nome do contato | 6 |
| `apps/painel/e2e/arquivar-usuarios.spec.ts` | lápis em Usuários; "(arquivado)" em Demandas | 6, 7 |
| `apps/painel/src/lib/demandas.ts` (+ teste), `app/(painel)/demandas/page.tsx` | filtro Responsável sem "(inativo)" | 7 |

---

### Task 1: Banco da sobra 5 (o contato arquivado volta com as empresas escolhidas)

**Arquivos:**
- Criar: `supabase/migrations/20261003000100_painel_v2_contato_volta.sql`
- Criar: `supabase/tests/16_painel_v2_contato_volta.test.sql`
- Modificar: `supabase/tests/15_painel_v2_arquivar.test.sql` (3 linhas)
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consome: `public.tem_permissao(text)`, a tabela `public.auditoria_acessos` e a linha `acao = 'anonimizar'` que `anonimizar_contato` grava.
- Produz:
  - `public.cadastrar_contato(p_nome text, p_telefone text, p_cliente uuid default null, p_agente_pausado boolean default null, p_manter uuid[] default '{}') returns jsonb`. Devolve `{"id": uuid, "reativado": bool, "vinculos_removidos": int, "vinculos_mantidos": int}`. A versão de 4 argumentos deixa de existir.
  - `public.contato_arquivado_do_telefone(p_telefone text) returns jsonb`. Devolve:
    - `null` quando o telefone é livre ou o contato está ativo;
    - `{"id", "anonimizado": true, "vinculos": []}` para contato apagado pela LGPD;
    - `{"id", "nome", "anonimizado": false, "vinculos": [{"cliente_id", "razao_social", "nome_fantasia", "pode_pedir_nota", "pode_atualizar_preco"}]}` nos outros casos. Os vínculos são só de empresas ativas, em ordem de nome.
  - Mensagens (P0001), copiadas literalmente pela tela:
    - `'Você não tem permissão para cadastrar contatos.'`
    - `'Os dados deste contato foram apagados (LGPD). Ele não volta.'`
  - Auditoria: `acao = 'reativar_contato'`, `entidade = 'contatos'`, `entidade_id = id`, `detalhes = {"empresa_nova": uuid|null, "mantidos": [uuid], "removidos": [uuid]}`.

- [ ] **Passo 1: preparar o ambiente local**

```bash
export PATH="$HOME/bin:$PATH"
supabase status || true
```

Se não houver Supabase local ligado, siga as **Restrições globais** (cópias, portas 563xx no `config.toml` e no `.env`) e depois:

```bash
supabase start
supabase migration up
```

Esperado: `supabase status` mostra `API URL: http://127.0.0.1:56321` e `DB URL: postgresql://postgres:postgres@127.0.0.1:56322/postgres`.

- [ ] **Passo 2: escrever o pgTAP (falha)**

Crie `supabase/tests/16_painel_v2_contato_volta.test.sql`:

```sql
-- supabase/tests/16_painel_v2_contato_volta.test.sql
-- Sobra 5 da Parte B (decisão do dono, 02/10): contato arquivado cadastrado de novo volta com as empresas escolhidas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Bia (editar_clientes) e Ana (sem permissão).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000016a1', 'bia16@pgtap.local'),
  ('00000000-0000-0000-0000-0000000016a2', 'ana16@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-0000000016a1', 'Bia', 'bia16@pgtap.local', 'atendente', '{editar_clientes}'),
  ('00000000-0000-0000-0000-0000000016a2', 'Ana', 'ana16@pgtap.local', 'atendente', '{}');

-- W: empresa da ação. X e Y: empresas de antes, ativas. Z: empresa de antes, arquivada.
insert into public.clientes (id, razao_social, cnpj, ativo) values
  ('16000000-0000-0000-0000-000000000001', 'Indústria W', '16160000000101', true),
  ('16000000-0000-0000-0000-000000000002', 'Indústria X', '16160000000202', true),
  ('16000000-0000-0000-0000-000000000003', 'Indústria Y', '16160000000303', true),
  ('16000000-0000-0000-0000-000000000004', 'Indústria Z', '16160000000404', false);
insert into public.contatos (id, nome, telefone, ativo) values
  ('16200000-0000-0000-0000-000000000001', 'Zé Antigo', '5531999991601', false),
  ('16200000-0000-0000-0000-000000000002', 'Lu Antiga', '5531999991602', false),
  ('16200000-0000-0000-0000-000000000003', 'Lia Antiga', '5531999991603', false),
  ('16200000-0000-0000-0000-000000000004', 'Contato Ativo', '5531999991604', true),
  ('16200000-0000-0000-0000-000000000005', 'Contato removido', '5500123451605', false);
insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota, pode_atualizar_preco) values
  ('16200000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', true, false),
  ('16200000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000003', false, true),
  ('16200000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000004', true, false),
  ('16200000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001', true, false),
  ('16200000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000002', false, true),
  ('16200000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000003', false, false),
  ('16200000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000002', false, false);
-- O contato 5 foi apagado pela LGPD (é o registro que anonimizar_contato deixa).
insert into public.auditoria_acessos (acao, entidade, entidade_id) values ('anonimizar', 'contatos', '16200000-0000-0000-0000-000000000005');

-- 1 a 3. Fechadas ao visitante; a versão antiga (4 argumentos) não existe mais.
select ok(not has_function_privilege('anon', 'public.cadastrar_contato(text, text, uuid, boolean, uuid[])', 'execute'), 'visitante não cadastra contato');
select ok(not has_function_privilege('anon', 'public.contato_arquivado_do_telefone(text)', 'execute'), 'visitante não consulta contato arquivado');
select hasnt_function('public', 'cadastrar_contato', array['text', 'text', 'uuid', 'boolean'], 'a assinatura antiga saiu (sem chamada ambígua)');

set local role authenticated;
-- 4 e 5. Sem editar_clientes não consulta nem cadastra.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a2","role":"authenticated"}', true);
select throws_ok($$ select public.contato_arquivado_do_telefone('5531999991601') $$,
  'P0001', 'Você não tem permissão para cadastrar contatos.', 'sem permissão não consulta');
select throws_ok($$ select public.cadastrar_contato('Zé', '5531999991601') $$,
  'P0001', 'Você não tem permissão para cadastrar contatos.', 'sem permissão não cadastra');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000016a1","role":"authenticated"}', true);
-- 6 a 10. A consulta que a tela usa para perguntar.
select is(
  (select jsonb_agg(v - 'razao_social' - 'nome_fantasia' order by v ->> 'cliente_id')
     from jsonb_array_elements(public.contato_arquivado_do_telefone('5531999991601') -> 'vinculos') v),
  '[{"cliente_id":"16000000-0000-0000-0000-000000000002","pode_pedir_nota":true,"pode_atualizar_preco":false},
    {"cliente_id":"16000000-0000-0000-0000-000000000003","pode_pedir_nota":false,"pode_atualizar_preco":true}]'::jsonb,
  'consulta: empresas de antes, só as ativas, com as marcações antigas');
select is(public.contato_arquivado_do_telefone('5531999991601') ->> 'nome', 'Zé Antigo', 'consulta: nome de antes');
select ok(public.contato_arquivado_do_telefone('5531999991604') is null, 'contato ativo: nada a perguntar');
select ok(public.contato_arquivado_do_telefone('5531999991699') is null, 'telefone livre: nada a perguntar');
select is(public.contato_arquivado_do_telefone('5500123451605') - 'id', '{"anonimizado":true,"vinculos":[]}'::jsonb,
  'contato apagado (LGPD): a consulta diz isso e não mostra nome nem empresas');

-- 11 a 15. O cadastro.
-- Zé: volta na W; marcou Y, Z (arquivada) e um id sem vínculo. Só Y volta; X e Z saem.
select is(public.cadastrar_contato('Zé Voltou', '5531999991601', '16000000-0000-0000-0000-000000000001', null,
    array['16000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-0000000000ff']::uuid[]) - 'id',
  '{"reativado":true,"vinculos_removidos":2,"vinculos_mantidos":1}'::jsonb,
  'volta só a empresa escolhida que já era vínculo e está ativa');
-- Contato ativo: a lista é ignorada (alguém o cadastrou entre a pergunta e o clique).
select is(public.cadastrar_contato('Contato Ativo', '5531999991604', '16000000-0000-0000-0000-000000000001', null,
    array['16000000-0000-0000-0000-000000000003']::uuid[]) - 'id',
  '{"reativado":false,"vinculos_removidos":0,"vinculos_mantidos":0}'::jsonb, 'contato ativo: nada muda');
-- Lia: chamada por nome sem p_manter, como o painel da Parte B (homologação) chama.
select is(public.cadastrar_contato(p_nome => 'Lia Voltou', p_telefone => '5531999991603', p_cliente => null::uuid, p_agente_pausado => null::boolean) - 'id',
  '{"reativado":true,"vinculos_removidos":1,"vinculos_mantidos":0}'::jsonb, 'sem a lista: nenhuma empresa antiga volta (como antes)');
-- Lu: a empresa da ação (W) também era vínculo antigo; marcou W e X. X volta; W é recriada pela tela com as marcações novas.
select is(public.cadastrar_contato('Lu Voltou', '5531999991602', '16000000-0000-0000-0000-000000000001', null,
    array['16000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002']::uuid[]) - 'id',
  '{"reativado":true,"vinculos_removidos":0,"vinculos_mantidos":1}'::jsonb, 'a empresa da ação não conta como mantida nem removida');
select throws_ok($$ select public.cadastrar_contato('Volta', '5500123451605') $$,
  'P0001', 'Os dados deste contato foram apagados (LGPD). Ele não volta.', 'contato apagado (LGPD) não volta pelo cadastro');
reset role;

-- 16 a 21. O que ficou gravado.
select is((select jsonb_build_object('ativo', ativo, 'nome', nome, 'vinculos',
    (select jsonb_agg(jsonb_build_object('cliente_id', cliente_id, 'nota', pode_pedir_nota, 'preco', pode_atualizar_preco))
       from public.contato_clientes where contato_id = c.id))
  from public.contatos c where id = '16200000-0000-0000-0000-000000000001'),
  '{"ativo":true,"nome":"Zé Voltou","vinculos":[{"cliente_id":"16000000-0000-0000-0000-000000000003","nota":false,"preco":true}]}'::jsonb,
  'Zé: ativo, nome novo e só Y, com as marcações antigas');
select is((select jsonb_build_object('usuario', usuario_id, 'empresa_nova', detalhes -> 'empresa_nova', 'mantidos', detalhes -> 'mantidos',
    'removidos', (select jsonb_agg(r order by r) from jsonb_array_elements_text(detalhes -> 'removidos') r))
  from public.auditoria_acessos where acao = 'reativar_contato' and entidade_id = '16200000-0000-0000-0000-000000000001'),
  jsonb_build_object('usuario', '00000000-0000-0000-0000-0000000016a1', 'empresa_nova', '16000000-0000-0000-0000-000000000001',
    'mantidos', '["16000000-0000-0000-0000-000000000003"]'::jsonb,
    'removidos', '["16000000-0000-0000-0000-000000000002","16000000-0000-0000-0000-000000000004"]'::jsonb),
  'auditoria registra quem trouxe de volta, o que ficou e o que saiu');
select is((select count(*)::int from public.contato_clientes where contato_id = '16200000-0000-0000-0000-000000000004'), 1,
  'contato ativo continua com o vínculo que tinha');
select ok((select ativo and not exists (select 1 from public.contato_clientes where contato_id = c.id)
  from public.contatos c where id = '16200000-0000-0000-0000-000000000003'), 'Lia volta sem empresas');
select is((select jsonb_agg(jsonb_build_object('cliente_id', cliente_id, 'preco', pode_atualizar_preco))
  from public.contato_clientes where contato_id = '16200000-0000-0000-0000-000000000002'),
  '[{"cliente_id":"16000000-0000-0000-0000-000000000002","preco":true}]'::jsonb,
  'Lu: só X fica (a W é recriada pela tela)');
select ok((select not ativo from public.contatos where id = '16200000-0000-0000-0000-000000000005'), 'o contato apagado continua fora');

select * from finish();
rollback;
```

- [ ] **Passo 3: ajustar as 3 linhas de `cadastrar_contato` no arquivo 15**

Em `supabase/tests/15_painel_v2_arquivar.test.sql`:
- troque `'public.cadastrar_contato(text, text, uuid, boolean)'` por `'public.cadastrar_contato(text, text, uuid, boolean, uuid[])'`;
- nas duas asserções `select is(public.cadastrar_contato(...) - 'id',`, troque `- 'id',` por `- array['id', 'vinculos_mantidos'],`. As duas linhas começam com `select is(public.cadastrar_contato('Zé Voltou'` e `select is(public.cadastrar_contato('Contato Usado'`.

O resto do arquivo não muda. O total continua `plan(60)`.

- [ ] **Passo 4: rodar e ver falhar**

Run: `supabase test db`
Esperado: `16_painel_v2_contato_volta.test.sql` FALHA, com `function public.contato_arquivado_do_telefone(text) does not exist` (ou com as asserções 1 a 3). O arquivo 15 falha na asserção 50: a assinatura nova ainda não existe.

- [ ] **Passo 5: escrever a migração**

Crie `supabase/migrations/20261003000100_painel_v2_contato_volta.sql`:

```sql
-- supabase/migrations/20261003000100_painel_v2_contato_volta.sql
-- Sobra 5 da Parte B (decisão do dono, 02/10): contato arquivado cadastrado de novo volta com as empresas de antes
-- que a pessoa escolher na hora (nenhuma por padrão); a empresa da ação sempre entra (a tela grava depois).
-- A 20261002000100 já está na homologação: aqui só se troca a função e se cria a consulta da pergunta.

-- A assinatura antiga sai: com as duas, a chamada por nome sem p_manter ficaria ambígua.
drop function public.cadastrar_contato(text, text, uuid, boolean);

create function public.cadastrar_contato(p_nome text, p_telefone text, p_cliente uuid default null,
  p_agente_pausado boolean default null, p_manter uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_ativo boolean; v_mantidos uuid[]; v_removidos uuid[];
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para cadastrar contatos.'; end if;
  loop
    -- Trava a linha: outro cadastro do mesmo telefone espera, e só um deles reativa e decide os vínculos.
    select id, ativo into v_id, v_ativo from public.contatos where telefone = p_telefone for update;
    exit when found;
    insert into public.contatos (nome, telefone, agente_pausado) values (p_nome, p_telefone, coalesce(p_agente_pausado, false))
      on conflict (telefone) do nothing returning id into v_id;
    if v_id is not null then
      return jsonb_build_object('id', v_id, 'reativado', false, 'vinculos_removidos', 0, 'vinculos_mantidos', 0);
    end if;
  end loop;
  -- Contato apagado pela LGPD não volta: o telefone dele é fictício, mas pode ser digitado.
  if not v_ativo and exists (select 1 from public.auditoria_acessos
      where acao = 'anonimizar' and entidade = 'contatos' and entidade_id = v_id::text) then
    raise exception 'Os dados deste contato foram apagados (LGPD). Ele não volta.';
  end if;
  update public.contatos set nome = p_nome, ativo = true, agente_pausado = coalesce(p_agente_pausado, agente_pausado)
    where id = v_id;
  -- Contato que já estava ativo segue como estava (a lista da pergunta é ignorada).
  if v_ativo then
    return jsonb_build_object('id', v_id, 'reativado', false, 'vinculos_removidos', 0, 'vinculos_mantidos', 0);
  end if;
  -- Ficam só os escolhidos que já eram vínculo e são de empresa ativa; a empresa da ação é recriada pela tela.
  select coalesce(array_agg(cc.cliente_id), '{}') into v_mantidos
    from public.contato_clientes cc join public.clientes c on c.id = cc.cliente_id
    where cc.contato_id = v_id and c.ativo and cc.cliente_id = any (coalesce(p_manter, '{}'))
      and cc.cliente_id is distinct from p_cliente;
  with apagados as (
    delete from public.contato_clientes where contato_id = v_id and not (cliente_id = any (v_mantidos)) returning cliente_id)
  select coalesce(array_agg(cliente_id) filter (where cliente_id is distinct from p_cliente), '{}') into v_removidos from apagados;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'reativar_contato', 'contatos', v_id::text,
    jsonb_build_object('empresa_nova', p_cliente, 'mantidos', to_jsonb(v_mantidos), 'removidos', to_jsonb(v_removidos)));
  return jsonb_build_object('id', v_id, 'reativado', true,
    'vinculos_removidos', cardinality(v_removidos), 'vinculos_mantidos', cardinality(v_mantidos));
end $$;

-- Antes de cadastrar: o telefone é de um contato arquivado? A tela pergunta quais empresas de antes voltam.
create function public.contato_arquivado_do_telefone(p_telefone text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_id uuid; v_nome text; v_ativo boolean;
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para cadastrar contatos.'; end if;
  select id, nome, ativo into v_id, v_nome, v_ativo from public.contatos where telefone = p_telefone;
  if not found or v_ativo then return null; end if;
  if exists (select 1 from public.auditoria_acessos where acao = 'anonimizar' and entidade = 'contatos' and entidade_id = v_id::text) then
    return jsonb_build_object('id', v_id, 'anonimizado', true, 'vinculos', '[]'::jsonb);
  end if;
  return jsonb_build_object('id', v_id, 'nome', v_nome, 'anonimizado', false, 'vinculos', coalesce((
    select jsonb_agg(jsonb_build_object('cliente_id', c.id, 'razao_social', c.razao_social, 'nome_fantasia', c.nome_fantasia,
        'pode_pedir_nota', cc.pode_pedir_nota, 'pode_atualizar_preco', cc.pode_atualizar_preco)
      order by coalesce(c.nome_fantasia, c.razao_social))
    from public.contato_clientes cc join public.clientes c on c.id = cc.cliente_id
    where cc.contato_id = v_id and c.ativo), '[]'::jsonb));
end $$;

revoke all on function public.cadastrar_contato(text, text, uuid, boolean, uuid[]),
  public.contato_arquivado_do_telefone(text) from public, anon, authenticated;
grant execute on function public.cadastrar_contato(text, text, uuid, boolean, uuid[]),
  public.contato_arquivado_do_telefone(text) to authenticated;
```

- [ ] **Passo 6: aplicar e ver passar**

```bash
supabase migration up
supabase test db
```

Esperado: `16_painel_v2_contato_volta.test.sql .. ok` (21/21), `15_painel_v2_arquivar.test.sql .. ok` (60/60) e todos os outros arquivos `ok`.

- [ ] **Passo 7: regerar os tipos e conferir o painel**

```bash
pnpm db:tipos
git diff --stat packages/db/src/tipos.gen.ts
pnpm --filter @escritorio/painel typecheck
```

Esperado:
- o diff dos tipos mostra só `cadastrar_contato` (com `"p_manter"?: string[]`) e a função nova `contato_arquivado_do_telefone` (`Args: { "p_telefone": string }; Returns: Json`);
- o typecheck passa, porque a chamada de hoje continua válida.

- [ ] **Passo 8: commit**

Antes, devolva `supabase/config.toml` e `.env` às portas originais (Restrições globais) e confira com `git status` que `supabase/config.toml` não aparece como alterado.

```bash
git add supabase/migrations/20261003000100_painel_v2_contato_volta.sql supabase/tests/16_painel_v2_contato_volta.test.sql \
  supabase/tests/15_painel_v2_arquivar.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(banco): contato arquivado volta com as empresas escolhidas (sobra 5 da Parte B)

- Migração nova (a 20261002000100 já está na homologação): cadastrar_contato
  recebe p_manter; ficam só os vínculos escolhidos que já existiam e são de
  empresa ativa; o resto sai na mesma transação, com a linha travada.
- Contato apagado pela LGPD não volta pelo cadastro (pendência da revisão).
- Auditoria reativar_contato com a empresa nova, mantidos e removidos (só ids).
- contato_arquivado_do_telefone: só leitura, para a tela perguntar.
- Teste 15: assinatura nova e a chave vinculos_mantidos ignorada nas duas
  asserções do retorno.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Painel da sobra 5 (a pergunta nos três caminhos que cadastram contato)

**Arquivos:**
- Criar: `apps/painel/src/lib/contato-arquivado.ts`, `apps/painel/src/lib/contato-arquivado.test.ts`
- Criar: `apps/painel/src/lib/contato-arquivado-acoes.ts`, `apps/painel/src/lib/contato-arquivado-acoes.test.ts`
- Criar: `apps/painel/src/components/patterns/form-cadastro-contato.tsx`
- Modificar: `apps/painel/src/lib/cadastro-contato.ts`, `apps/painel/src/lib/cadastro-contato.test.ts`, `apps/painel/src/lib/avisos.ts`
- Modificar: `apps/painel/src/components/patterns/confirm-dialog.tsx`
- Modificar: `apps/painel/src/app/(painel)/contatos/page.tsx`, `contatos/acoes.ts`
- Modificar: `apps/painel/src/app/(painel)/clientes/[id]/secao-contatos.tsx`, `clientes/acoes.ts`
- Modificar: `apps/painel/src/app/(painel)/atendimento/[id]/contato-da-conversa.tsx`, `atendimento/acoes.ts`
- Teste: `apps/painel/e2e/arquivar-contatos.spec.ts`

**Interfaces:**
- Consome (Task 1): `rpc('cadastrar_contato', { p_nome, p_telefone, p_cliente?, p_agente_pausado?, p_manter? })` e `rpc('contato_arquivado_do_telefone', { p_telefone })`.
- Produz:
  - `lib/contato-arquivado.ts` (puro):
    - `type VinculoAntigo = { clienteId: string; empresa: string; podePedirNota: boolean; podeMudarPreco: boolean }`;
    - `type ConsultaContatoArquivado = { situacao: 'livre' } | { situacao: 'anonimizado' } | { situacao: 'arquivado'; nome: string; vinculos: VinculoAntigo[]; empresaNova: string | null } | { situacao: 'erro'; erro: string }`;
    - `TEXTO_LGPD`, `lerContatoArquivado(v: unknown, clienteAtual: string | null)` e `marcacoesDoVinculo(v: VinculoAntigo): string`.
  - `lib/contato-arquivado-acoes.ts` (server action): `consultarContatoArquivado(dados: { telefone?: string; conversaId?: string; clienteId?: string | null }): Promise<ConsultaContatoArquivado>`.
  - `lib/cadastro-contato.ts`:
    - `lerManter(formData: FormData): string[]`;
    - `cadastrarContatoPeloTelefone(sb, { nome, telefone, clienteId?, agentePausado?, manter? })`;
    - `avisoDoCadastro(r, comEmpresa)` passa a devolver também `'contato-voltou-com-empresas'` e `'contato-voltou-com-empresas-outras-sairam'`.
  - `FormCadastroContato({ action, clienteId?, conversaId?, className?, children })`: o formulário que pergunta. O campo enviado é `manter`, um por empresa marcada.
  - `ConfirmDialog` aceita `children` também com `formulario="id"`.

- [ ] **Passo 1: testes das regras puras (falham)**

Crie `apps/painel/src/lib/contato-arquivado.test.ts`:

```ts
// apps/painel/src/lib/contato-arquivado.test.ts
import { describe, expect, it } from 'vitest';
import { lerContatoArquivado, marcacoesDoVinculo, TEXTO_LGPD } from './contato-arquivado';

// Sobra 5 da Parte B: a tela pergunta quais empresas de antes voltam; a da ação sempre entra e não aparece.
const W = '16000000-0000-4000-8000-000000000001';
const X = '16000000-0000-4000-8000-000000000002';
const bruto = {
  id: 'c1', nome: 'Zé Antigo', anonimizado: false,
  vinculos: [
    { cliente_id: W, razao_social: 'Indústria W Ltda', nome_fantasia: null, pode_pedir_nota: true, pode_atualizar_preco: false },
    { cliente_id: X, razao_social: 'Indústria X Ltda', nome_fantasia: 'Indústria X', pode_pedir_nota: false, pode_atualizar_preco: true },
  ],
};

describe('lerContatoArquivado', () => {
  it('telefone livre ou contato ativo: nada a perguntar', () => {
    expect(lerContatoArquivado(null, null)).toEqual({ situacao: 'livre' });
  });
  it('contato apagado (LGPD)', () => {
    expect(lerContatoArquivado({ id: 'c1', anonimizado: true, vinculos: [] }, null)).toEqual({ situacao: 'anonimizado' });
    expect(TEXTO_LGPD).toBe('Os dados deste contato foram apagados (LGPD). Ele não volta.');
  });
  it('arquivado: empresas de antes com o nome que a equipe conhece e as marcações', () => {
    expect(lerContatoArquivado(bruto, null)).toEqual({
      situacao: 'arquivado', nome: 'Zé Antigo', empresaNova: null,
      vinculos: [
        { clienteId: W, empresa: 'Indústria W Ltda', podePedirNota: true, podeMudarPreco: false },
        { clienteId: X, empresa: 'Indústria X', podePedirNota: false, podeMudarPreco: true },
      ],
    });
  });
  it('a empresa da ação não aparece na pergunta (sempre entra)', () => {
    const r = lerContatoArquivado(bruto, W);
    expect(r.situacao === 'arquivado' && r.vinculos.map((v) => v.clienteId)).toEqual([X]);
  });
  it('resposta estranha do banco vira erro', () => {
    expect(() => lerContatoArquivado({ vinculos: 'x' }, null)).toThrow('Resposta inválida do banco.');
  });
});

describe('marcacoesDoVinculo', () => {
  it('diz o que a pessoa podia naquela empresa', () => {
    expect(marcacoesDoVinculo({ clienteId: W, empresa: 'W', podePedirNota: true, podeMudarPreco: true }))
      .toBe('pode pedir nota · pode mudar preço e cadastrar produto');
    expect(marcacoesDoVinculo({ clienteId: W, empresa: 'W', podePedirNota: false, podeMudarPreco: false }))
      .toBe('Só conversa (não pede nota nem muda preço)');
  });
});
```

Em `apps/painel/src/lib/cadastro-contato.test.ts`:
- troque o `describe('aviso do cadastro de contato'` por:

```ts
describe('aviso do cadastro de contato', () => {
  it('contato que já estava ativo (ou novo) não gera aviso', () => {
    expect(avisoDoCadastro({ reativado: false, vinculos_removidos: 0, vinculos_mantidos: 0 }, true)).toBeNull();
  });
  it('arquivado que volta: o aviso diz o que aconteceu com os vínculos', () => {
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 0, vinculos_mantidos: 0 }, false)).toBe('contato-voltou');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 2, vinculos_mantidos: 0 }, true)).toBe('contato-voltou-vinculos-sairam');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 1, vinculos_mantidos: 0 }, false)).toBe('contato-voltou-sem-empresas');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 0, vinculos_mantidos: 1 }, true)).toBe('contato-voltou-com-empresas');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 1, vinculos_mantidos: 1 }, false)).toBe('contato-voltou-com-empresas-outras-sairam');
  });
  it('textos curtos e afirmativos; código desconhecido não vira texto', () => {
    expect(textoDoAviso('contato-voltou-vinculos-sairam')).toBe('Contato arquivado voltou. Os vínculos antigos com outras empresas saíram.');
    expect(textoDoAviso('contato-voltou-sem-empresas')).toBe('Contato arquivado voltou, sem empresas. Os vínculos antigos saíram.');
    expect(textoDoAviso('contato-voltou')).toBe('Contato arquivado voltou.');
    expect(textoDoAviso('contato-voltou-com-empresas')).toBe('Contato arquivado voltou com as empresas escolhidas.');
    expect(textoDoAviso('contato-voltou-com-empresas-outras-sairam')).toBe('Contato arquivado voltou com as empresas escolhidas. As outras saíram.');
    expect(textoDoAviso('Ligue para 0800')).toBeNull();
  });
  it('o aviso vai na URL e sai dela sem mexer nos outros parâmetros', () => {
    expect(comAvisoNaUrl('/contatos', 'contato-voltou')).toBe('/contatos?aviso=contato-voltou');
    expect(comAvisoNaUrl(`/clientes/${ID}?aba=contatos`, 'contato-voltou')).toBe(`/clientes/${ID}?aba=contatos&aviso=contato-voltou`);
    expect(enderecoSemAviso(`/clientes/${ID}`, 'aba=contatos&aviso=contato-voltou')).toBe(`/clientes/${ID}?aba=contatos`);
    expect(enderecoSemAviso('/contatos', 'aviso=contato-voltou')).toBe('/contatos');
  });
});
```

- troque o `describe('cadastrarContatoPeloTelefone'` por:

```ts
describe('cadastrarContatoPeloTelefone', () => {
  it('chama a função do banco com a empresa da ação e as empresas de antes escolhidas', async () => {
    const sb = sbFalso({ id: ID, reativado: true, vinculos_removidos: 1, vinculos_mantidos: 1 });
    expect(await cadastrarContatoPeloTelefone(sb as never, { nome: 'Zé', telefone: '5531999991702', clienteId: EMPRESA, manter: [OUTRA] }))
      .toEqual({ id: ID, aviso: 'contato-voltou-com-empresas-outras-sairam' });
    expect(sb.rpc).toHaveBeenCalledWith('cadastrar_contato', {
      p_nome: 'Zé', p_telefone: '5531999991702', p_cliente: EMPRESA, p_agente_pausado: undefined, p_manter: [OUTRA],
    });
  });
  it('sem empresa, sem escolhas e com o agente desligado', async () => {
    const sb = sbFalso({ id: ID, reativado: false, vinculos_removidos: 0, vinculos_mantidos: 0 });
    expect(await cadastrarContatoPeloTelefone(sb as never, { nome: 'Zé', telefone: '5531999991702', agentePausado: true }))
      .toEqual({ id: ID, aviso: null });
    expect(sb.rpc).toHaveBeenCalledWith('cadastrar_contato', {
      p_nome: 'Zé', p_telefone: '5531999991702', p_cliente: undefined, p_agente_pausado: true, p_manter: undefined,
    });
  });
  it('erro do banco aparece para a pessoa', async () => {
    await expect(cadastrarContatoPeloTelefone(sbFalso(null, { message: 'Os dados deste contato foram apagados (LGPD). Ele não volta.' }) as never,
      { nome: 'Zé', telefone: '5531999991702' })).rejects.toThrow('Os dados deste contato foram apagados (LGPD). Ele não volta.');
  });
});

describe('lerManter', () => {
  it('só ids válidos, sem repetir', () => {
    const f = new FormData();
    f.append('manter', OUTRA);
    f.append('manter', OUTRA);
    f.append('manter', 'drop table');
    expect(lerManter(f)).toEqual([OUTRA]);
    expect(lerManter(new FormData())).toEqual([]);
  });
});
```

Ainda nesse arquivo, ao lado de `const EMPRESA = ...`, acrescente `const OUTRA = '44444444-4444-4444-8444-444444444444';` e mude o import para `import { avisoDoCadastro, cadastrarContatoPeloTelefone, lerManter } from './cadastro-contato';`.

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/contato-arquivado.test.ts src/lib/cadastro-contato.test.ts`
Esperado: FALHA. `contato-arquivado` não existe, e `lerManter` e os avisos novos não existem.

- [ ] **Passo 3: regras puras, avisos e o ajudante do cadastro**

Crie `apps/painel/src/lib/contato-arquivado.ts`:

```ts
// apps/painel/src/lib/contato-arquivado.ts
/** Contato arquivado cadastrado de novo: a tela pergunta quais empresas de antes voltam (sobra 5 da Parte B). */
export type VinculoAntigo = { clienteId: string; empresa: string; podePedirNota: boolean; podeMudarPreco: boolean };
export type ConsultaContatoArquivado =
  | { situacao: 'livre' }
  | { situacao: 'anonimizado' }
  | { situacao: 'arquivado'; nome: string; vinculos: VinculoAntigo[]; empresaNova: string | null }
  | { situacao: 'erro'; erro: string };

/** A mesma frase do banco (restaurar_cadastro e cadastrar_contato). */
export const TEXTO_LGPD = 'Os dados deste contato foram apagados (LGPD). Ele não volta.';

type VinculoBruto = { cliente_id?: unknown; razao_social?: unknown; nome_fantasia?: unknown; pode_pedir_nota?: unknown; pode_atualizar_preco?: unknown };

/** Lê a resposta de contato_arquivado_do_telefone. A empresa da ação (`clienteAtual`) sempre entra: não aparece na pergunta. */
export function lerContatoArquivado(v: unknown, clienteAtual: string | null): Exclude<ConsultaContatoArquivado, { situacao: 'erro' }> {
  if (v === null || v === undefined) return { situacao: 'livre' };
  const o = v as { nome?: unknown; anonimizado?: unknown; vinculos?: unknown };
  if (o.anonimizado === true) return { situacao: 'anonimizado' };
  if (typeof o.nome !== 'string' || !Array.isArray(o.vinculos)) throw new Error('Resposta inválida do banco.');
  const vinculos = (o.vinculos as VinculoBruto[]).flatMap((b): VinculoAntigo[] => {
    if (typeof b.cliente_id !== 'string' || typeof b.razao_social !== 'string' || b.cliente_id === clienteAtual) return [];
    const empresa = typeof b.nome_fantasia === 'string' && b.nome_fantasia ? b.nome_fantasia : b.razao_social;
    return [{ clienteId: b.cliente_id, empresa, podePedirNota: b.pode_pedir_nota === true, podeMudarPreco: b.pode_atualizar_preco === true }];
  });
  return { situacao: 'arquivado', nome: o.nome, vinculos, empresaNova: null };
}

/** Linha de baixo de cada empresa na pergunta: o que a pessoa podia ali. */
export function marcacoesDoVinculo(v: VinculoAntigo): string {
  const m = [v.podePedirNota && 'pode pedir nota', v.podeMudarPreco && 'pode mudar preço e cadastrar produto'].filter(Boolean);
  return m.length ? m.join(' · ') : 'Só conversa (não pede nota nem muda preço)';
}
```

Em `apps/painel/src/lib/avisos.ts`, acrescente ao objeto `AVISOS`, depois de `'contato-voltou-sem-empresas'`:

```ts
  'contato-voltou-com-empresas': 'Contato arquivado voltou com as empresas escolhidas.',
  'contato-voltou-com-empresas-outras-sairam': 'Contato arquivado voltou com as empresas escolhidas. As outras saíram.',
```

Substitua o conteúdo de `apps/painel/src/lib/cadastro-contato.ts` por:

```ts
import 'server-only';
import type { CodigoAviso } from './avisos';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
type Resultado = { id: string; reativado: boolean; vinculos_removidos: number; vinculos_mantidos?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aviso para a tela: só quando um contato arquivado voltou (o ativo e o novo seguem calados, como antes). */
export function avisoDoCadastro(r: Omit<Resultado, 'id'>, comEmpresa: boolean): CodigoAviso | null {
  if (!r.reativado) return null;
  if ((r.vinculos_mantidos ?? 0) > 0) return r.vinculos_removidos > 0 ? 'contato-voltou-com-empresas-outras-sairam' : 'contato-voltou-com-empresas';
  if (r.vinculos_removidos === 0) return 'contato-voltou';
  return comEmpresa ? 'contato-voltou-vinculos-sairam' : 'contato-voltou-sem-empresas';
}

/** Empresas de antes marcadas na pergunta (campo "manter"); o banco confere de novo quais podem voltar. */
export function lerManter(formData: FormData): string[] {
  return [...new Set(formData.getAll('manter').map(String).filter((v) => UUID.test(v)))];
}

/**
 * Cadastra o contato pelo telefone (aba Contatos, ficha da empresa e conversa usam este mesmo caminho).
 * Telefone de contato arquivado traz o contato de volta só com as empresas de antes escolhidas (`manter`); o banco
 * faz isso numa transação só, com a linha travada. O vínculo com `clienteId` é criado depois pela ação, com as
 * permissões escolhidas agora.
 */
export async function cadastrarContatoPeloTelefone(sb: Sb, dados: {
  nome: string; telefone: string; clienteId?: string | null; agentePausado?: boolean; manter?: string[];
}): Promise<{ id: string; aviso: CodigoAviso | null }> {
  const { data, error } = await sb.rpc('cadastrar_contato', {
    p_nome: dados.nome, p_telefone: dados.telefone, p_cliente: dados.clienteId ?? undefined, p_agente_pausado: dados.agentePausado,
    p_manter: dados.manter?.length ? dados.manter : undefined,
  });
  if (error) throw new Error(error.message);
  const r = data as Resultado;
  return { id: r.id, aviso: avisoDoCadastro(r, Boolean(dados.clienteId)) };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/contato-arquivado.test.ts src/lib/cadastro-contato.test.ts`
Esperado: PASS (6 testes em `contato-arquivado`, 8 em `cadastro-contato`).

- [ ] **Passo 5: teste da server action da consulta (falha)**

Crie `apps/painel/src/lib/contato-arquivado-acoes.test.ts`:

```ts
// apps/painel/src/lib/contato-arquivado-acoes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A consulta da pergunta com a sessão e o Supabase falsos (sem banco). O banco confere de novo (pgTAP 16).
const falso = vi.hoisted(() => ({
  pode: true,
  rpc: vi.fn(),
  conversa: { telefone: '5531999991702' } as { telefone: string } | null,
  cliente: { razao_social: 'Indústria X Ltda', nome_fantasia: 'Indústria X' } as { razao_social: string; nome_fantasia: string | null } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1' }), temPermissao: () => falso.pode }));
const umaLinha = (dados: () => unknown) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: dados(), error: null }) }) }) });
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: falso.rpc,
    from: (t: string) => umaLinha(() => (t === 'conversas' ? falso.conversa : falso.cliente)),
  }),
}));

import { consultarContatoArquivado } from './contato-arquivado-acoes';

const X = '16000000-0000-4000-8000-000000000002';
const Y = '16000000-0000-4000-8000-000000000003';
const CONVERSA = '17000000-0000-4000-8000-000000000001';
const arquivado = { id: 'c1', nome: 'Zé Antigo', anonimizado: false,
  vinculos: [{ cliente_id: Y, razao_social: 'Indústria Y', nome_fantasia: null, pode_pedir_nota: true, pode_atualizar_preco: false }] };

beforeEach(() => {
  falso.pode = true;
  falso.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  falso.conversa = { telefone: '5531999991702' };
});

describe('consultarContatoArquivado', () => {
  it('normaliza o telefone digitado e pergunta ao banco', async () => {
    expect(await consultarContatoArquivado({ telefone: '(31) 99999-1702' })).toEqual({ situacao: 'livre' });
    expect(falso.rpc).toHaveBeenCalledWith('contato_arquivado_do_telefone', { p_telefone: '5531999991702' });
  });
  it('pela conversa, o telefone vem da conversa', async () => {
    falso.conversa = { telefone: '5531999991799' };
    await consultarContatoArquivado({ conversaId: CONVERSA });
    expect(falso.rpc).toHaveBeenCalledWith('contato_arquivado_do_telefone', { p_telefone: '5531999991799' });
  });
  it('arquivado com empresas de antes: devolve a lista e o nome da empresa da ação', async () => {
    falso.rpc.mockResolvedValue({ data: arquivado, error: null });
    expect(await consultarContatoArquivado({ telefone: '(31) 99999-1702', clienteId: X })).toEqual({
      situacao: 'arquivado', nome: 'Zé Antigo', empresaNova: 'Indústria X',
      vinculos: [{ clienteId: Y, empresa: 'Indústria Y', podePedirNota: true, podeMudarPreco: false }],
    });
  });
  it('apagado pela LGPD e erro do banco', async () => {
    falso.rpc.mockResolvedValue({ data: { id: 'c1', anonimizado: true, vinculos: [] }, error: null });
    expect(await consultarContatoArquivado({ telefone: '5500123451799' })).toEqual({ situacao: 'anonimizado' });
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'falhou' } });
    expect(await consultarContatoArquivado({ telefone: '5531999991702' })).toEqual({ situacao: 'erro', erro: 'falhou' });
  });
  it('telefone inválido, conversa estranha ou sem permissão: segue o caminho de sempre sem consultar', async () => {
    expect(await consultarContatoArquivado({ telefone: '123' })).toEqual({ situacao: 'livre' });
    expect(await consultarContatoArquivado({ conversaId: 'x' })).toEqual({ situacao: 'livre' });
    falso.pode = false;
    expect(await consultarContatoArquivado({ telefone: '5531999991702' })).toEqual({ situacao: 'livre' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/contato-arquivado-acoes.test.ts`
Esperado: FALHA (o módulo não existe).

- [ ] **Passo 6: escrever a server action**

Crie `apps/painel/src/lib/contato-arquivado-acoes.ts`:

```ts
// apps/painel/src/lib/contato-arquivado-acoes.ts
'use server';
import { normalizarTelefone } from '@escritorio/core';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerContatoArquivado, type ConsultaContatoArquivado } from './contato-arquivado';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Antes de cadastrar: o telefone é de um contato arquivado? Devolve as empresas de antes (sem a da ação) para a tela
 * perguntar quais voltam. Só lê; quem grava é cadastrar_contato, que confere tudo de novo.
 */
export async function consultarContatoArquivado(dados: {
  telefone?: string; conversaId?: string; clienteId?: string | null;
}): Promise<ConsultaContatoArquivado> {
  const u = await obterUsuario();
  // Sem permissão a tela segue o caminho de sempre, e o cadastro recusa com a mensagem de hoje.
  if (!temPermissao(u, 'editar_clientes')) return { situacao: 'livre' };
  const sb = await supabaseServidor();
  let telefone: string | null;
  if (dados.conversaId !== undefined) {
    if (!UUID.test(dados.conversaId)) return { situacao: 'livre' };
    const { data } = await sb.from('conversas').select('telefone').eq('id', dados.conversaId).maybeSingle();
    telefone = data?.telefone ?? null;
  } else {
    telefone = normalizarTelefone(dados.telefone ?? '');
  }
  if (!telefone) return { situacao: 'livre' };
  const clienteAtual = dados.clienteId && UUID.test(dados.clienteId) ? dados.clienteId : null;
  const { data, error } = await sb.rpc('contato_arquivado_do_telefone', { p_telefone: telefone });
  if (error) return { situacao: 'erro', erro: error.message };
  let r: ReturnType<typeof lerContatoArquivado>;
  try {
    r = lerContatoArquivado(data, clienteAtual);
  } catch (e) {
    return { situacao: 'erro', erro: (e as Error).message };
  }
  if (r.situacao !== 'arquivado' || r.vinculos.length === 0 || !clienteAtual) return r;
  const { data: c } = await sb.from('clientes').select('razao_social, nome_fantasia').eq('id', clienteAtual).maybeSingle();
  return { ...r, empresaNova: c ? c.nome_fantasia ?? c.razao_social : null };
}
```

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/contato-arquivado-acoes.test.ts`
Esperado: PASS (5 testes).

- [ ] **Passo 7: `ConfirmDialog` com conteúdo no modo `formulario=`**

Em `apps/painel/src/components/patterns/confirm-dialog.tsx`:
- na assinatura, troque `{ formulario: string; acao?: never; children?: never }` por `{ formulario: string; acao?: never; children?: ReactNode }`;
- no ramo do formulário externo (`<div className="grid gap-4">`), coloque `{props.children}` como primeira linha, antes de `{campoDigitar}`:

```tsx
          <div className="grid gap-4">
            {props.children}
            {campoDigitar}
```

- no comentário do componente, acrescente esta linha à lista:

```ts
 *   Com `children` (ex.: caixas de seleção com form="id"), os campos da janela vão junto com o formulário de fora.
```

- [ ] **Passo 8: o formulário que pergunta**

Crie `apps/painel/src/components/patterns/form-cadastro-contato.tsx`:

```tsx
'use client';

import { unstable_rethrow } from 'next/navigation';
import { useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { toast } from '@/components/ui/toaster';
import { marcacoesDoVinculo, TEXTO_LGPD, type ConsultaContatoArquivado } from '@/lib/contato-arquivado';
import { consultarContatoArquivado } from '@/lib/contato-arquivado-acoes';
import { ConfirmDialog } from './confirm-dialog';

type Pergunta = Extract<ConsultaContatoArquivado, { situacao: 'arquivado' }>;
const FALHA = 'Não consegui conferir o telefone agora. Tente de novo.';

/**
 * Formulário que cadastra contato (aba Contatos, ficha da empresa e conversa). Antes de enviar, confere se o telefone
 * é de um contato arquivado com empresas de antes; se for, pergunta quais voltam (nenhuma marcada) e manda as
 * marcadas no campo "manter" do mesmo formulário. Sem nada a perguntar, envia como sempre.
 */
export function FormCadastroContato({ action, clienteId, conversaId, className, children }: {
  action: (dados: FormData) => void | Promise<void>;
  /** Empresa da ficha (sempre entra). Na conversa, vem do campo cliente_id do formulário. */
  clienteId?: string;
  /** Na conversa, o telefone é o da conversa. */
  conversaId?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [aberto, setAberto] = useState(false);
  const seguir = useRef(false);
  const [, iniciar] = useTransition();

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio que já passou pela conferência (ou o "Trazer de volta" da janela): segue para a ação.
    if (seguir.current || aberto) {
      seguir.current = false;
      return;
    }
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    iniciar(async () => {
      try {
        const r = await consultarContatoArquivado({
          telefone: conversaId ? undefined : String(dados.get('telefone') ?? ''),
          conversaId,
          clienteId: clienteId ?? (String(dados.get('cliente_id') ?? '') || null),
        });
        if (r.situacao === 'anonimizado') { toast.error(TEXTO_LGPD); return; }
        if (r.situacao === 'erro') { toast.error(r.erro); return; }
        if (r.situacao === 'arquivado' && r.vinculos.length > 0) {
          setPergunta(r);
          setAberto(true);
          return;
        }
        seguir.current = true;
        form.requestSubmit();
      } catch (err) {
        unstable_rethrow(err);
        console.error('[contatos] falha ao conferir o telefone', err);
        toast.error(FALHA);
      }
    });
  };

  return (
    <>
      <form id={id} action={action} onSubmit={aoEnviar} className={className}>{children}</form>
      {pergunta && (
        <ConfirmDialog
          aberto={aberto}
          aoMudarAberto={setAberto}
          formulario={id}
          tipo="neutro"
          variante="primary"
          titulo={<>Trazer <strong className="font-extrabold">{pergunta.nome}</strong> de volta?</>}
          descricao={pergunta.empresaNova
            ? `Estava arquivado. ${pergunta.empresaNova} entra com as marcações escolhidas agora. Marque as empresas de antes que voltam.`
            : 'Estava arquivado. Marque as empresas de antes que voltam.'}
          confirmar="Trazer de volta"
        >
          <fieldset className="flex flex-col gap-2 text-left">
            <legend className="sr-only">Empresas de antes</legend>
            {pergunta.vinculos.map((v) => (
              <label key={v.clienteId} className="flex items-start gap-2 rounded-md border border-border p-3 text-base text-foreground">
                {/* form=: a caixa fica na janela, mas é campo do formulário de cadastro. */}
                <input type="checkbox" name="manter" value={v.clienteId} form={id} className="mt-1 size-4 shrink-0 accent-brand" />
                <span>
                  <span className="font-medium">{v.empresa}</span>
                  <span className="block text-sm text-muted">{marcacoesDoVinculo(v)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </ConfirmDialog>
      )}
    </>
  );
}
```

- [ ] **Passo 9: os três caminhos usam a pergunta e mandam `manter`**

1. Em `apps/painel/src/app/(painel)/contatos/acoes.ts`:
   - troque `import { cadastrarContatoPeloTelefone } from '@/lib/cadastro-contato';` por `import { cadastrarContatoPeloTelefone, lerManter } from '@/lib/cadastro-contato';`;
   - troque a chamada e o comentário acima dela por:

```ts
  // Telefone de contato arquivado traz o contato de volta só com as empresas de antes escolhidas na pergunta.
  const { aviso } = await cadastrarContatoPeloTelefone(sb, { nome, telefone, agentePausado: formData.get('agente_atende') !== 'on', manter: lerManter(formData) });
```

2. Em `apps/painel/src/app/(painel)/clientes/acoes.ts`:
   - troque o import da mesma forma;
   - em `adicionarContatoSemAviso`, troque a chamada e o comentário por:

```ts
  // Telefone de contato arquivado traz o contato de volta com esta empresa e as de antes escolhidas na pergunta.
  const { id: contatoId, aviso } = await cadastrarContatoPeloTelefone(sb, { nome: c.nome, telefone: c.telefone, clienteId, manter: lerManter(formData) });
```

3. Em `apps/painel/src/app/(painel)/atendimento/acoes.ts`:
   - troque o import da mesma forma;
   - em `cadastrarContatoDaConversa`, troque a chamada e o comentário por:

```ts
  // Telefone de contato arquivado traz o contato de volta com a empresa escolhida aqui e as de antes marcadas na pergunta.
  const { id: contatoId, aviso } = await cadastrarContatoPeloTelefone(sb, {
    nome, telefone: conversa.telefone, clienteId, agentePausado: formData.get('agente_atende') !== 'on', manter: lerManter(formData),
  });
```

4. Em `apps/painel/src/app/(painel)/contatos/page.tsx`:
   - acrescente `import { FormCadastroContato } from '@/components/patterns/form-cadastro-contato';`;
   - troque `<form action={cadastrarContato}>` por `<FormCadastroContato action={cadastrarContato}>` e o `</form>` correspondente por `</FormCadastroContato>`.

5. Em `apps/painel/src/app/(painel)/clientes/[id]/secao-contatos.tsx`:
   - acrescente o mesmo import;
   - troque `<form action={adicionarContato.bind(null, id)}>` por `<FormCadastroContato action={adicionarContato.bind(null, id)} clienteId={id}>` e o `</form>` correspondente (o do card "Adicionar contato", logo depois do botão "Adicionar contato") por `</FormCadastroContato>`.

6. Em `apps/painel/src/app/(painel)/atendimento/[id]/contato-da-conversa.tsx`:
   - acrescente o mesmo import;
   - troque `<form action={cadastrarContatoDaConversa.bind(null, conversaId)} className="flex flex-col gap-2">` por `<FormCadastroContato action={cadastrarContatoDaConversa.bind(null, conversaId)} conversaId={conversaId} className="flex flex-col gap-2">` e o `</form>` correspondente por `</FormCadastroContato>`.

Depois:

```bash
grep -rn "Contato arquivado voltou\|Cadastrar contato\|Adicionar contato" apps/painel/e2e apps/painel/src
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel test
```

Esperado: o typecheck passa, e o vitest passa por inteiro. O grep mostra só os textos que os testes já conhecem; nenhum texto antigo mudou.

- [ ] **Passo 10: Playwright dos fluxos (falha nos testes novos, depois passa)**

Em `apps/painel/e2e/arquivar-contatos.spec.ts`:

1. No topo, acrescente `import AxeBuilder from '@axe-core/playwright';` e, ao lado das outras constantes, `const TEL_LGPD = '5500123451799';`. No `beforeEach`, troque `[TEL_MARIA, TEL_ZE]` por `[TEL_MARIA, TEL_ZE, TEL_LGPD]` nas duas linhas de `delete().in('telefone', ...)`.
2. Acrescente, depois de `vinculos()`:

```ts
const porEmpresa = <T extends { cliente_id: string }>(l: T[]) => [...l].sort((a, b) => a.cliente_id.localeCompare(b.cliente_id));
async function semViolacoesGraves(page: Page) {
  const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
}
```

3. Nos três testes que já existem com contato arquivado, a pergunta passa a aparecer. Em cada um, logo depois do clique que cadastra, acrescente a passagem pela janela (nenhuma marcada):
   - "cadastrar de novo o telefone de um contato arquivado traz ele de volta, sem os vínculos antigos", depois de `getByRole('button', { name: 'Cadastrar contato' }).click();`:

```ts
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  await expect(janela.getByRole('checkbox', { name: /Indústria Y \(contato e2e\)/ })).not.toBeChecked();
  await janela.getByRole('button', { name: 'Trazer de volta' }).click();
```

   - "pela ficha da empresa, o arquivado volta só com o vínculo novo e as permissões escolhidas agora", depois de `getByRole('button', { name: 'Adicionar contato' }).click();`:

```ts
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  // A empresa da ficha (X) sempre entra e não aparece na lista; só a Y é perguntada.
  await expect(janela.getByRole('checkbox')).toHaveCount(1);
  await janela.getByRole('button', { name: 'Trazer de volta' }).click();
```

   - "pela conversa, o arquivado volta só com a empresa escolhida", depois do clique em 'Cadastrar contato': o mesmo bloco do primeiro teste.

   Os outros `expect` desses testes (textos dos avisos e vínculos) continuam iguais.

4. Acrescente os testes novos no fim do arquivo:

```ts
test('pela ficha, a pessoa escolhe quais empresas de antes voltam, com as marcações antigas', async ({ page }) => {
  const { x, y } = await empresas();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false }).select().single();
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: true });
  await comoAdmin(page);
  await page.goto(`/clientes/${x}?aba=contatos`);
  await page.getByLabel('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByLabel('Telefone').fill('(31) 99999-1702');
  await page.getByLabel('Pode pedir nota', { exact: true }).check();
  await page.getByRole('button', { name: 'Adicionar contato' }).click();
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  await expect(janela).toContainText('Indústria X (contato e2e) entra com as marcações escolhidas agora.');
  await expect(janela).toContainText('pode pedir nota · pode mudar preço e cadastrar produto');
  const caixaY = janela.getByRole('checkbox', { name: /Indústria Y \(contato e2e\)/ });
  await expect(caixaY).not.toBeChecked();
  await semViolacoesGraves(page);
  await caixaY.check();
  await janela.getByRole('button', { name: 'Trazer de volta' }).click();
  await expect(page.getByText('Contato arquivado voltou com as empresas escolhidas.')).toBeVisible();
  expect(porEmpresa(await vinculos(ze!.id))).toEqual(porEmpresa([
    { cliente_id: x, pode_pedir_nota: true, pode_atualizar_preco: false },
    { cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: true },
  ]));
  const { data: aud } = await db.from('auditoria_acessos').select('detalhes').eq('acao', 'reativar_contato').eq('entidade_id', ze!.id);
  expect(aud).toEqual([{ detalhes: { empresa_nova: x, mantidos: [y], removidos: [] } }]);
});

test('cancelar a pergunta não cadastra nada', async ({ page }) => {
  const { y } = await empresas();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false }).select().single();
  await db.from('contato_clientes').insert({ contato_id: ze!.id, cliente_id: y, pode_pedir_nota: true });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-1702');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  const janela = page.getByRole('dialog', { name: 'Trazer Zé Antigo de volta?' });
  await janela.getByRole('button', { name: 'Cancelar' }).click();
  await expect(janela).toHaveCount(0);
  expect((await db.from('contatos').select('nome, ativo').eq('id', ze!.id).single()).data).toEqual({ nome: 'Zé Antigo', ativo: false });
  expect(await vinculos(ze!.id)).toEqual([{ cliente_id: y, pode_pedir_nota: true, pode_atualizar_preco: false }]);
});

test('arquivado sem empresas de antes volta sem pergunta', async ({ page }) => {
  await db.from('contatos').insert({ nome: 'Zé Antigo', telefone: TEL_ZE, ativo: false });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Voltou');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-1702');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  await expect(page.getByText('Contato arquivado voltou.', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('telefone de contato apagado pela LGPD: avisa e não cadastra', async ({ page }) => {
  const { data: apagado } = await db.from('contatos').insert({ nome: 'Contato removido', telefone: TEL_LGPD, ativo: false }).select().single();
  await db.from('auditoria_acessos').insert({ acao: 'anonimizar', entidade: 'contatos', entidade_id: apagado!.id });
  await comoAdmin(page);
  await page.goto('/contatos');
  await page.getByPlaceholder('Nome', { exact: true }).fill('Tentativa');
  await page.getByPlaceholder('Telefone (com DDD)').fill(TEL_LGPD);
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  await expect(page.getByText('Os dados deste contato foram apagados (LGPD). Ele não volta.')).toBeVisible();
  expect((await db.from('contatos').select('nome, ativo').eq('id', apagado!.id).single()).data).toEqual({ nome: 'Contato removido', ativo: false });
  await db.from('auditoria_acessos').delete().eq('acao', 'anonimizar').eq('entidade_id', apagado!.id);
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-contatos.spec.ts e2e/contatos.spec.ts e2e/contato-conversa.spec.ts`
Esperado: PASS em todos. Se algum teste antigo de `contatos.spec.ts` ou `contato-conversa.spec.ts` cair numa pergunta, é porque semeou contato arquivado com vínculo: ajuste-o com o bloco do item 3 e diga isso no commit.

- [ ] **Passo 11: commit**

```bash
git add apps/painel/src/lib/contato-arquivado.ts apps/painel/src/lib/contato-arquivado.test.ts \
  apps/painel/src/lib/contato-arquivado-acoes.ts apps/painel/src/lib/contato-arquivado-acoes.test.ts \
  apps/painel/src/lib/cadastro-contato.ts apps/painel/src/lib/cadastro-contato.test.ts apps/painel/src/lib/avisos.ts \
  apps/painel/src/components/patterns/confirm-dialog.tsx apps/painel/src/components/patterns/form-cadastro-contato.tsx \
  "apps/painel/src/app/(painel)/contatos/page.tsx" "apps/painel/src/app/(painel)/contatos/acoes.ts" \
  "apps/painel/src/app/(painel)/clientes/[id]/secao-contatos.tsx" "apps/painel/src/app/(painel)/clientes/acoes.ts" \
  "apps/painel/src/app/(painel)/atendimento/[id]/contato-da-conversa.tsx" "apps/painel/src/app/(painel)/atendimento/acoes.ts" \
  apps/painel/e2e/arquivar-contatos.spec.ts
git commit -m "$(cat <<'EOF'
feat(contatos): contato arquivado cadastrado de novo pergunta quais empresas voltam (sobra 5)

Decisão do dono (02/10): nos três caminhos (aba Contatos, ficha da empresa e
conversa), o painel confere o telefone antes de enviar. Se for de um contato
arquivado com empresas de antes, mostra cada uma com as marcações antigas,
nenhuma marcada, e manda as escolhidas no campo "manter". A empresa da ação
sempre entra com as marcações de agora.

- Contato apagado pela LGPD: a tela avisa e não envia.
- Avisos novos: "Contato arquivado voltou com as empresas escolhidas." (e
  "As outras saíram.").
- ConfirmDialog aceita conteúdo também no modo formulario=.
- e2e: os três testes antigos de arquivado passam pela janela (nenhuma
  marcada), porque a pergunta é o comportamento novo.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Sobra 3. Restaurar unidade de rede arquivada pergunta e restaura as duas

**Arquivos:**
- Criar: `supabase/migrations/20261003000200_painel_v2_restaurar_unidade.sql`, `supabase/tests/17_painel_v2_restaurar_unidade.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`
- Modificar: `apps/painel/src/lib/arquivo.ts`, `apps/painel/src/lib/arquivo.test.ts`, `apps/painel/src/lib/arquivo-acoes.ts`, `apps/painel/src/lib/arquivo-acoes.test.ts`
- Modificar: `apps/painel/src/components/patterns/excluir-cadastro.tsx` (`BotaoRestaurar`)
- Teste: `apps/painel/e2e/arquivar-cadastros.spec.ts`

**Interfaces:**
- Consome: `public.exigir_arquivar(text)` e `public.restaurar_cadastro(text, uuid)` (Parte B).
- Produz:
  - `public.restaurar_unidade(p_id uuid, p_com_rede boolean default false) returns jsonb`, com três respostas:
    - `{"restaurada": false, "rede_arquivada": {"id", "nome", "tipo": "cliente"|"fornecedor"}}`: nada mudou;
    - `{"restaurada": true, "rede_restaurada": false}`;
    - `{"restaurada": true, "rede_restaurada": true}`.
  - `lib/arquivo.ts`:
    - `type RedeArquivada = { id: string; nome: string; tipo: 'cliente' | 'fornecedor' }`;
    - `lerRestauroUnidade(v: unknown): { restaurada: true; redeRestaurada: boolean } | { restaurada: false; rede: RedeArquivada }`;
    - `textosRestaurarComRede(rede: RedeArquivada, unidade: string): { artigo: string; descricao: string; confirmar: string }`.
  - `lib/arquivo-acoes.ts`: `restaurarCadastro(tipo, id, opcoes?: { comRede?: boolean }): Promise<ResultadoRestaurar>`, com `type ResultadoRestaurar = ResultadoArquivo | { ok: false; redeArquivada: RedeArquivada }`.

- [ ] **Passo 1: pgTAP (falha)**

Crie `supabase/tests/17_painel_v2_restaurar_unidade.test.sql`:

```sql
-- supabase/tests/17_painel_v2_restaurar_unidade.test.sql
-- Sobra 3 da Parte B: restaurar unidade de rede arquivada pergunta antes e, com o sim, restaura as duas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000017a1', 'bia17@pgtap.local'),
  ('00000000-0000-0000-0000-0000000017a2', 'ana17@pgtap.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('00000000-0000-0000-0000-0000000017a1', 'Bia', 'bia17@pgtap.local', 'atendente', '{editar_clientes}'),
  ('00000000-0000-0000-0000-0000000017a2', 'Ana', 'ana17@pgtap.local', 'atendente', '{}');
insert into public.clientes (id, razao_social, cnpj) values ('17000000-0000-0000-0000-000000000001', 'Indústria R', '17170000001701');
insert into public.parceiros_grupos (id, cliente_id, tipo, nome, ativo) values
  ('17400000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'cliente', 'Rede Arquivada', false),
  ('17400000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000001', 'cliente', 'Rede Ativa', true),
  ('17400000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000001', 'fornecedor', 'Fornecedor Arquivado', false);
insert into public.parceiros_unidades (id, cliente_id, grupo_id, nome_unidade, ativo) values
  ('17500000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '17400000-0000-0000-0000-000000000001', 'Unidade U', false),
  ('17500000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000001', '17400000-0000-0000-0000-000000000002', 'Unidade V', false),
  ('17500000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000001', '17400000-0000-0000-0000-000000000003', 'Unidade G', false);

select ok(not has_function_privilege('anon', 'public.restaurar_unidade(uuid, boolean)', 'execute'), 'visitante não restaura');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a2","role":"authenticated"}', true);
select throws_ok($$ select public.restaurar_unidade('17500000-0000-0000-0000-000000000001') $$,
  'P0001', 'Sem permissão para arquivar cadastros.', 'sem editar_clientes não restaura');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000017a1","role":"authenticated"}', true);
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000001'),
  '{"restaurada":false,"rede_arquivada":{"id":"17400000-0000-0000-0000-000000000001","nome":"Rede Arquivada","tipo":"cliente"}}'::jsonb,
  'rede arquivada: pergunta antes e não muda nada');
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000003') #>> '{rede_arquivada,tipo}', 'fornecedor',
  'diz se o grupo é rede ou fornecedor');
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000001', true), '{"restaurada":true,"rede_restaurada":true}'::jsonb,
  'com o sim, restaura a rede e a unidade');
-- A rede já está ativa (outra pessoa restaurou entre a pergunta e o clique): só a unidade volta, sem erro.
select is(public.restaurar_unidade('17500000-0000-0000-0000-000000000002', true), '{"restaurada":true,"rede_restaurada":false}'::jsonb,
  'rede ativa: só a unidade volta');
select throws_ok($$ select public.restaurar_unidade('17500000-0000-0000-0000-0000000000ff') $$,
  'P0001', 'Cadastro não encontrado.', 'unidade inexistente');
reset role;

select ok((select bool_and(ativo) from public.parceiros_unidades where id in ('17500000-0000-0000-0000-000000000001', '17500000-0000-0000-0000-000000000002'))
  and (select ativo from public.parceiros_grupos where id = '17400000-0000-0000-0000-000000000001')
  and not (select ativo from public.parceiros_unidades where id = '17500000-0000-0000-0000-000000000003')
  and not (select ativo from public.parceiros_grupos where id = '17400000-0000-0000-0000-000000000003'),
  'voltou só o que foi confirmado; a pergunta não mexeu no fornecedor');
select is((select count(*)::int from public.auditoria_acessos where acao = 'restaurar' and usuario_id = '00000000-0000-0000-0000-0000000017a1'
    and entidade_id in ('17400000-0000-0000-0000-000000000001', '17500000-0000-0000-0000-000000000001')), 2,
  'auditoria registra as duas restaurações, por quem fez');

select * from finish();
rollback;
```

Run (Supabase local ligado nas portas 563xx, conforme as Restrições globais): `supabase test db`
Esperado: `17_painel_v2_restaurar_unidade.test.sql` FALHA (a função não existe).

- [ ] **Passo 2: a migração**

Crie `supabase/migrations/20261003000200_painel_v2_restaurar_unidade.sql`:

```sql
-- supabase/migrations/20261003000200_painel_v2_restaurar_unidade.sql
-- Sobra 3 da Parte B: restaurar uma unidade cuja rede está arquivada a deixava ativa e invisível. Agora a função
-- pergunta antes (não muda nada) e, com o sim (p_com_rede), restaura a rede e a unidade numa transação só.
create function public.restaurar_unidade(p_id uuid, p_com_rede boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_grupo uuid; v_ativa boolean; v_nome text; v_tipo text;
begin
  perform public.exigir_arquivar('unidade');
  select grupo_id into v_grupo from public.parceiros_unidades where id = p_id;
  if not found then raise exception 'Cadastro não encontrado.'; end if;
  -- Trava a rede: ninguém a arquiva nem restaura entre a leitura e a restauração.
  select ativo, nome, tipo::text into v_ativa, v_nome, v_tipo from public.parceiros_grupos where id = v_grupo for update;
  if not v_ativa and not coalesce(p_com_rede, false) then
    return jsonb_build_object('restaurada', false,
      'rede_arquivada', jsonb_build_object('id', v_grupo, 'nome', v_nome, 'tipo', v_tipo));
  end if;
  if not v_ativa then perform public.restaurar_cadastro('rede', v_grupo); end if;
  perform public.restaurar_cadastro('unidade', p_id);
  return jsonb_build_object('restaurada', true, 'rede_restaurada', not v_ativa);
end $$;

revoke all on function public.restaurar_unidade(uuid, boolean) from public, anon, authenticated;
grant execute on function public.restaurar_unidade(uuid, boolean) to authenticated;
```

```bash
supabase migration up
supabase test db
pnpm db:tipos
git diff --stat packages/db/src/tipos.gen.ts
```

Esperado:
- `17_painel_v2_restaurar_unidade.test.sql .. ok` (9/9) e todos os outros arquivos `ok`;
- o diff dos tipos só acrescenta `restaurar_unidade` (`Args: { "p_com_rede"?: boolean, "p_id": string }; Returns: Json`).

- [ ] **Passo 3: vitest das regras e da ação (falha)**

Em `apps/painel/src/lib/arquivo.test.ts`, acrescente ao import `lerRestauroUnidade, textosRestaurarComRede` e, no fim:

```ts
describe('restaurar unidade de rede arquivada (sobra 3)', () => {
  const rede = { id: 'r1', nome: 'Rede Arquivo', tipo: 'cliente' as const };
  it('lê a resposta do banco', () => {
    expect(lerRestauroUnidade({ restaurada: true, rede_restaurada: true })).toEqual({ restaurada: true, redeRestaurada: true });
    expect(lerRestauroUnidade({ restaurada: false, rede_arquivada: rede })).toEqual({ restaurada: false, rede });
    expect(() => lerRestauroUnidade({ restaurada: false })).toThrow('Resposta inválida do banco.');
  });
  it('textos da pergunta, para rede e para fornecedor', () => {
    expect(textosRestaurarComRede(rede, 'Unidade Usada')).toEqual({
      artigo: 'a rede', confirmar: 'Restaurar as duas',
      descricao: 'A rede Rede Arquivo está arquivada. Sem ela, Unidade Usada volta mas não aparece na ficha.',
    });
    expect(textosRestaurarComRede({ ...rede, nome: 'Frigorífico', tipo: 'fornecedor' }, 'Filial 2')).toEqual({
      artigo: 'o fornecedor', confirmar: 'Restaurar os dois',
      descricao: 'O fornecedor Frigorífico está arquivado. Sem ele, Filial 2 volta mas não aparece na ficha.',
    });
  });
});
```

Em `apps/painel/src/lib/arquivo-acoes.test.ts`, acrescente no fim:

```ts
describe('restaurar unidade', () => {
  it('rede arquivada: devolve a pergunta e não atualiza as telas', async () => {
    falso.rpc.mockResolvedValueOnce({ data: { restaurada: false, rede_arquivada: { id: 'r1', nome: 'Rede A', tipo: 'cliente' } }, error: null });
    expect(await restaurarCadastro('unidade', ID)).toEqual({ ok: false, redeArquivada: { id: 'r1', nome: 'Rede A', tipo: 'cliente' } });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_unidade', { p_id: ID, p_com_rede: false });
    expect(falso.revalidatePath).not.toHaveBeenCalled();
  });
  it('com o sim, restaura as duas e atualiza a ficha', async () => {
    falso.rpc.mockResolvedValueOnce({ data: { restaurada: true, rede_restaurada: true }, error: null });
    expect(await restaurarCadastro('unidade', ID, { comRede: true })).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_unidade', { p_id: ID, p_com_rede: true });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/clientes', 'layout');
  });
  it('os outros tipos restauram como antes', async () => {
    expect(await restaurarCadastro('rede', ID, { comRede: true })).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_cadastro', { p_tipo: 'rede', p_id: ID });
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/arquivo.test.ts src/lib/arquivo-acoes.test.ts`
Esperado: FALHA (as funções novas não existem, e `restaurarCadastro` ainda não chama `restaurar_unidade`).

- [ ] **Passo 4: regras, ação e botão**

Em `apps/painel/src/lib/arquivo.ts`, acrescente no fim:

```ts
/** Rede (ou fornecedor) arquivada de uma unidade que a pessoa quer restaurar (sobra 3 da Parte B). */
export type RedeArquivada = { id: string; nome: string; tipo: 'cliente' | 'fornecedor' };
export type RestauroUnidade = { restaurada: true; redeRestaurada: boolean } | { restaurada: false; rede: RedeArquivada };

export function lerRestauroUnidade(v: unknown): RestauroUnidade {
  const o = v as { restaurada?: unknown; rede_restaurada?: unknown; rede_arquivada?: { id?: unknown; nome?: unknown; tipo?: unknown } } | null;
  if (o?.restaurada === true) return { restaurada: true, redeRestaurada: o.rede_restaurada === true };
  const r = o?.rede_arquivada;
  if (o?.restaurada === false && r && typeof r.id === 'string' && typeof r.nome === 'string' && (r.tipo === 'cliente' || r.tipo === 'fornecedor')) {
    return { restaurada: false, rede: { id: r.id, nome: r.nome, tipo: r.tipo } };
  }
  throw new Error('Resposta inválida do banco.');
}

/** Pergunta "Restaurar a rede X também?": sem a rede, a unidade voltaria e ficaria invisível na ficha. */
export function textosRestaurarComRede(rede: RedeArquivada, unidade: string): { artigo: string; descricao: string; confirmar: string } {
  const rede_ = rede.tipo === 'cliente';
  return {
    artigo: rede_ ? 'a rede' : 'o fornecedor',
    descricao: `${rede_ ? 'A rede' : 'O fornecedor'} ${rede.nome} está ${rede_ ? 'arquivada' : 'arquivado'}. Sem ${rede_ ? 'ela' : 'ele'}, ${unidade} volta mas não aparece na ficha.`,
    confirmar: rede_ ? 'Restaurar as duas' : 'Restaurar os dois',
  };
}
```

Em `apps/painel/src/lib/arquivo-acoes.ts`:
- troque o import de `./arquivo` por `import { ehTipoCadastro, lerRestauroUnidade, lerUso, ROTAS_DO_TIPO, type RedeArquivada, type TipoCadastro, type UsoDoCadastro } from './arquivo';`;
- depois de `export type ResultadoArquivo = ...`, acrescente:

```ts
/** Restaurar unidade de rede arquivada devolve a pergunta em vez de restaurar (a tela confirma e chama com comRede). */
export type ResultadoRestaurar = ResultadoArquivo | { ok: false; redeArquivada: RedeArquivada };
```

- substitua a função `restaurarCadastro` inteira por:

```ts
export async function restaurarCadastro(tipo: TipoCadastro, id: string, opcoes: { comRede?: boolean } = {}): Promise<ResultadoRestaurar> {
  const c = await conferir(tipo, id);
  if ('erro' in c) return { ok: false, erro: c.erro };
  const motivo = motivoSemPermissao(c.u, c.tipo);
  if (motivo) return { ok: false, erro: motivo };
  if (c.tipo === 'unidade') {
    const sb = await supabaseServidor();
    const { data, error } = await sb.rpc('restaurar_unidade', { p_id: c.id, p_com_rede: opcoes.comRede === true });
    if (error) return { ok: false, erro: error.message };
    let r: ReturnType<typeof lerRestauroUnidade>;
    try {
      r = lerRestauroUnidade(data);
    } catch (e) {
      return { ok: false, erro: (e as Error).message };
    }
    if (!r.restaurada) return { ok: false, redeArquivada: r.rede };
    revalidar(c.tipo);
    return { ok: true };
  }
  const erro = await chamar('restaurar_cadastro', c.tipo, c.id);
  if (erro) return { ok: false, erro };
  revalidar(c.tipo);
  return { ok: true };
}
```

Antes de mudar o botão, confira quem mais chama a ação: `grep -rn "restaurarCadastro" apps/painel/src`. Esperado: só `excluir-cadastro.tsx` e os testes.

Em `apps/painel/src/components/patterns/excluir-cadastro.tsx`:
- troque o import de `@/lib/arquivo` por `import { AJUDA_EXCLUIR, textosDaJanela, textosRestaurarComRede, type RedeArquivada, type TextosJanela, type TipoCadastro } from '@/lib/arquivo';`;
- substitua a função `BotaoRestaurar` inteira por:

```tsx
/**
 * Restaurar não é destrutivo: volta na hora, sem janela. A exceção é a unidade de rede arquivada: o banco devolve a
 * pergunta, porque sem a rede a unidade voltaria invisível (sobra 3 da Parte B).
 */
export function BotaoRestaurar({ tipo, id, nome }: { tipo: TipoCadastro; id: string; nome: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [rede, setRede] = useState<RedeArquivada | null>(null);
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);

  const restaurar = () => !enviando && iniciar(async () => {
    try {
      const r = await restaurarCadastro(tipo, id);
      if (!r.ok) {
        if ('redeArquivada' in r) { setRede(r.redeArquivada); setAberto(true); } else toast.error(r.erro);
        return;
      }
      toast.success(`Restaurado: ${nome}.`);
      router.refresh();
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao restaurar', e);
      toast.error(FALHA);
    }
  });

  const restaurarComRede = async () => {
    if (!rede) return;
    try {
      const r = await restaurarCadastro(tipo, id, { comRede: true });
      if (!r.ok) { toast.error('redeArquivada' in r ? FALHA : r.erro); return; }
      toast.success(`Restaurados: ${rede.nome} e ${nome}.`);
      router.refresh();
    } catch (e) {
      unstable_rethrow(e);
      console.error('[arquivo] falha ao restaurar com a rede', e);
      toast.error(FALHA);
    }
  };

  const textos = rede ? textosRestaurarComRede(rede, nome) : null;
  return (
    <>
      {/* Sem "disabled": desabilitar tira o foco, e a janela precisa devolvê-lo ao botão quando fechar. */}
      <Button ref={botaoRef} type="button" variant="outline" size="sm" onClick={restaurar} aria-busy={enviando} aria-label={`Restaurar ${nome}`}>
        <ArchiveRestore aria-hidden size={16} strokeWidth={1.75} />
        {enviando ? 'Restaurando…' : 'Restaurar'}
      </Button>
      {rede && textos && (
        <ConfirmDialog
          aberto={aberto}
          aoMudarAberto={setAberto}
          focoAoFechar={botaoRef}
          tipo="neutro"
          variante="primary"
          titulo={<>Restaurar {textos.artigo} <strong className="font-extrabold">{rede.nome}</strong> também?</>}
          descricao={textos.descricao}
          confirmar={textos.confirmar}
          enviando="Restaurando…"
          acao={restaurarComRede}
        />
      )}
    </>
  );
}
```

```bash
pnpm --filter @escritorio/painel exec vitest run src/lib/arquivo.test.ts src/lib/arquivo-acoes.test.ts
pnpm --filter @escritorio/painel typecheck
```

Esperado: PASS, e o typecheck passa.

- [ ] **Passo 5: Playwright (falha antes do passo 4, passa depois)**

Em `apps/painel/e2e/arquivar-cadastros.spec.ts`, acrescente `import AxeBuilder from '@axe-core/playwright';` e, no fim:

```ts
async function abrirArquivados(page: Page) {
  for (const resumo of await page.locator('summary').filter({ hasText: /^Arquivados \(\d+\)$/ }).all()) await resumo.click();
}

test('restaurar unidade de rede arquivada pergunta; cancelar não muda nada; o sim restaura as duas', async ({ page }) => {
  const s = await semear();
  await db.from('parceiros_unidades').update({ ativo: false }).eq('id', s.usada);
  await db.from('parceiros_grupos').update({ ativo: false }).eq('id', s.rede);
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=clientes`);
  await abrirArquivados(page);
  const unidades = page.getByRole('table', { name: 'Unidades arquivadas' });
  await unidades.getByRole('button', { name: 'Restaurar Unidade Usada' }).click();
  const janela = page.getByRole('dialog', { name: 'Restaurar a rede Rede Arquivo também?' });
  await expect(janela).toContainText('A rede Rede Arquivo está arquivada. Sem ela, Unidade Usada volta mas não aparece na ficha.');
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await janela.getByRole('button', { name: 'Cancelar' }).click();
  expect((await db.from('parceiros_unidades').select('ativo').eq('id', s.usada).single()).data!.ativo).toBe(false);
  expect((await db.from('parceiros_grupos').select('ativo').eq('id', s.rede).single()).data!.ativo).toBe(false);

  await unidades.getByRole('button', { name: 'Restaurar Unidade Usada' }).click();
  await janela.getByRole('button', { name: 'Restaurar as duas' }).click();
  await expect(page.getByText('Restaurados: Rede Arquivo e Unidade Usada.')).toBeVisible();
  await expect(page.getByLabel('Nome de Rede Arquivo')).toBeVisible();
  await expect(page.locator('summary').filter({ hasText: 'Unidade Usada' })).toHaveCount(1);
});

test('unidade de rede ativa volta sem pergunta', async ({ page }) => {
  const s = await semear();
  await db.from('parceiros_unidades').update({ ativo: false }).eq('id', s.usada);
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=clientes`);
  await abrirArquivados(page);
  await page.getByRole('table', { name: 'Unidades arquivadas' }).getByRole('button', { name: 'Restaurar Unidade Usada' }).click();
  await expect(page.getByText('Restaurado: Unidade Usada.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await db.from('parceiros_unidades').select('ativo').eq('id', s.usada).single()).data!.ativo).toBe(true);
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-cadastros.spec.ts e2e/arquivar-clientes.spec.ts e2e/arquivar-contatos.spec.ts`
Esperado: PASS em todos. O restaurar de cliente e de contato continua igual.

- [ ] **Passo 6: commit**

Devolva `config.toml` e `.env` às portas originais antes do commit.

```bash
git add supabase/migrations/20261003000200_painel_v2_restaurar_unidade.sql supabase/tests/17_painel_v2_restaurar_unidade.test.sql \
  packages/db/src/tipos.gen.ts apps/painel/src/lib/arquivo.ts apps/painel/src/lib/arquivo.test.ts \
  apps/painel/src/lib/arquivo-acoes.ts apps/painel/src/lib/arquivo-acoes.test.ts \
  apps/painel/src/components/patterns/excluir-cadastro.tsx apps/painel/e2e/arquivar-cadastros.spec.ts
git commit -m "$(cat <<'EOF'
feat(cadastros): restaurar unidade de rede arquivada pergunta pela rede (sobra 3)

Restaurar uma unidade cuja rede está arquivada a deixava ativa e invisível.
Agora a janela pergunta "Restaurar a rede X também?". Com o sim, rede e
unidade voltam juntas; cancelar não muda nada.

- Migração nova: restaurar_unidade, numa transação só, com a rede travada;
  reaproveita restaurar_cadastro (permissão e auditoria de sempre).
- Rede já restaurada por outra pessoa entre a pergunta e o clique: só a
  unidade volta, sem erro.
- Fornecedor usa "o fornecedor" e "Restaurar os dois".

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Sobra 6. Erro ao salvar em Usuários aparece no campo, sem fechar o painel

**Arquivos:**
- Modificar: `apps/painel/src/components/patterns/formulario-alteravel.tsx` (`BotaoSalvar` com `enviando`)
- Modificar: `apps/painel/src/app/(painel)/usuarios/esquemas.ts`, `usuarios/esquemas.test.ts`
- Modificar: `apps/painel/src/app/(painel)/usuarios/acoes.ts`, `usuarios/acoes.test.ts`
- Modificar: `apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx`, `usuarios/convite-usuario.tsx`, `usuarios/page.tsx`
- Criar: `apps/painel/e2e/usuarios-erros.spec.ts`
- Modificar: `apps/painel/e2e/revisao-final.spec.ts` (teste "Usuários: telefone inválido avisa…"), `apps/painel/e2e/configuracoes.spec.ts` (teste do convite)

**Interfaces:**
- Produz:
  - em `usuarios/esquemas.ts`:
    - `type CampoUsuario = 'nome' | 'email' | 'telefone' | 'papel' | 'geral'`;
    - `type ErrosUsuario = Partial<Record<CampoUsuario, string>>`;
    - `type EstadoUsuario = { ok: true } | { ok: false; erros: ErrosUsuario; telefoneDeArquivado?: { id: string; nome: string } }` (`telefoneDeArquivado` é preenchido na Task 5);
    - `errosDoFormulario(issues: { path: PropertyKey[]; message: string }[]): ErrosUsuario`.
  - em `usuarios/acoes.ts`: `salvarUsuario(id: string, formData: FormData): Promise<EstadoUsuario>`, `convidarUsuario(formData: FormData): Promise<EstadoUsuario>` e o ajudante interno `conflitoDeTelefone(telefone, idAtual): Promise<EstadoUsuario | null>`.
  - `FormularioUsuario({ acao: (dados: FormData) => Promise<EstadoUsuario>, usuario?, setores, enviar, aviso?, aoSalvar?: () => void, className? })`. O `aoTerminar` sai.
  - `ConviteUsuario({ acao, setores })`. A prop `emails` sai.
  - `BotaoSalvar` ganha `enviando?: boolean` (a Task 6 usa).

- [ ] **Passo 1: vitest (falha)**

Em `apps/painel/src/app/(painel)/usuarios/esquemas.test.ts`, acrescente ao import `errosDoFormulario` e, no fim:

```ts
describe('errosDoFormulario', () => {
  it('cada mensagem vai para o seu campo; o que não é campo vai para geral', () => {
    expect(errosDoFormulario([
      { path: ['telefone'], message: 'Telefone inválido' },
      { path: ['nome'], message: 'Informe o nome' },
      { path: ['permissoes', 0], message: 'Permissão desconhecida' },
    ])).toEqual({ telefone: 'Telefone inválido', nome: 'Informe o nome', geral: 'Permissão desconhecida' });
  });
  it('não repete a mesma mensagem no mesmo campo', () => {
    expect(errosDoFormulario([{ path: ['email'], message: 'E-mail inválido' }, { path: ['email'], message: 'E-mail inválido' }]))
      .toEqual({ email: 'E-mail inválido' });
  });
});
```

Substitua `apps/painel/src/app/(painel)/usuarios/acoes.test.ts` por:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Salvar a pessoa devolve o resultado para a tela (o erro fica no campo, sobra 6 da Parte B), sem ?erro= na URL.
const falso = vi.hoisted(() => ({
  atualizacoes: [] as Record<string, unknown>[],
  donos: [] as { id: string; nome: string; ativo: boolean }[],
  erroBanco: null as { message: string } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/erro-formulario', () => ({ mensagemDeErro: (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível salvar.') }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ from: () => ({ select: () => ({ in: async () => ({ data: falso.donos }) }) }) }) }));
const fim = { eq: async () => ({ error: falso.erroBanco }) };
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

const BIA = '11111111-1111-4111-8111-111111111111';
function formulario(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ nome: 'Bia Souza', email: 'bia@escritorio.com', papel: 'atendente', ...campos })) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

beforeEach(() => {
  falso.atualizacoes = [];
  falso.donos = [];
  falso.erroBanco = null;
});

describe('salvarUsuario', () => {
  it('salva sem gravar ativo e devolve ok', async () => {
    expect(await salvarUsuario(BIA, formulario({}))).toEqual({ ok: true });
    expect(falso.atualizacoes).toHaveLength(1);
    expect(falso.atualizacoes[0]).not.toHaveProperty('ativo');
    expect(falso.atualizacoes[0]).toMatchObject({ nome: 'Bia Souza', papel: 'atendente' });
  });
  it('telefone inválido: erro no campo e nada gravado', async () => {
    expect(await salvarUsuario(BIA, formulario({ telefone: '12345' }))).toEqual({ ok: false, erros: { telefone: 'Telefone inválido' } });
    expect(falso.atualizacoes).toEqual([]);
  });
  it('nome curto e WhatsApp sem telefone: erro em cada campo', async () => {
    expect(await salvarUsuario(BIA, formulario({ nome: 'B' }))).toEqual({ ok: false, erros: { nome: 'Informe o nome' } });
    expect(await salvarUsuario(BIA, formulario({ permissao: 'assistente_whatsapp' })))
      .toEqual({ ok: false, erros: { telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' } });
  });
  it('telefone de outra pessoa: erro no campo telefone', async () => {
    falso.donos = [{ id: 'outra', nome: 'Zé', ativo: true }];
    expect(await salvarUsuario(BIA, formulario({ telefone: '(31) 99999-1801' })))
      .toEqual({ ok: false, erros: { telefone: 'Este telefone já é de Zé.' } });
    expect(falso.atualizacoes).toEqual([]);
  });
  it('o próprio telefone não conflita', async () => {
    falso.donos = [{ id: BIA, nome: 'Bia Souza', ativo: true }];
    expect(await salvarUsuario(BIA, formulario({ telefone: '(31) 99999-1801' }))).toEqual({ ok: true });
  });
  it('erro do banco vai para o aviso geral do formulário', async () => {
    falso.erroBanco = { message: 'falhou no banco' };
    expect(await salvarUsuario(BIA, formulario({}))).toEqual({ ok: false, erros: { geral: 'falhou no banco' } });
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/usuarios"`
Esperado: FALHA (`errosDoFormulario` não existe e `salvarUsuario` ainda não devolve resultado).

- [ ] **Passo 2: regras e ações**

Em `apps/painel/src/app/(painel)/usuarios/esquemas.ts`, acrescente no fim:

```ts
/** Resultado de salvar ou convidar: o erro volta para a tela, no campo (sobra 6 da Parte B), sem ?erro= na URL. */
export type CampoUsuario = 'nome' | 'email' | 'telefone' | 'papel' | 'geral';
export type ErrosUsuario = Partial<Record<CampoUsuario, string>>;
export type EstadoUsuario =
  | { ok: true }
  | { ok: false; erros: ErrosUsuario; telefoneDeArquivado?: { id: string; nome: string } };

const CAMPOS = new Set<string>(['nome', 'email', 'telefone', 'papel']);

/** Mensagens da validação agrupadas por campo; o que não é campo do formulário vai para "geral". */
export function errosDoFormulario(issues: { path: PropertyKey[]; message: string }[]): ErrosUsuario {
  const erros: ErrosUsuario = {};
  for (const i of issues) {
    const campo = (CAMPOS.has(String(i.path[0])) ? String(i.path[0]) : 'geral') as CampoUsuario;
    const atual = erros[campo];
    if (!atual) erros[campo] = i.message;
    else if (!atual.split('; ').includes(i.message)) erros[campo] = `${atual}; ${i.message}`;
  }
  return erros;
}
```

Substitua `apps/painel/src/app/(painel)/usuarios/acoes.ts` por:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { variantesTelefone } from '@escritorio/core';
import { mensagemDeErro } from '@/lib/erro-formulario';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { errosDoFormulario, UsuarioForm, type EstadoUsuario } from './esquemas';

function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

/** Um telefone é de uma pessoa só: senão o WhatsApp não sabe de quem é a mensagem. */
async function conflitoDeTelefone(telefone: string | null, idAtual: string | null): Promise<EstadoUsuario | null> {
  if (!telefone) return null;
  const { data } = await supabaseServico().from('usuarios').select('id, nome').in('telefone', variantesTelefone(telefone));
  const outro = (data ?? []).find((u) => u.id !== idAtual);
  return outro ? { ok: false, erros: { telefone: `Este telefone já é de ${outro.nome}.` } } : null;
}

export async function convidarUsuario(formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const lido = UsuarioForm.safeParse(formData);
  if (!lido.success) return { ok: false, erros: errosDoFormulario(lido.error.issues) };
  const d = lido.data;
  const conflito = await conflitoDeTelefone(d.telefone, null);
  if (conflito) return conflito;
  try {
    const servico = supabaseServico();
    const { data, error } = await servico.auth.admin.inviteUserByEmail(d.email, { redirectTo: `${process.env.PAINEL_URL}/auth/confirm` });
    if (error) throw new Error(`Não foi possível convidar: ${error.message}`);
    checar(await servico.from('usuarios').insert({ id: data.user.id, nome: d.nome, email: d.email, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes }));
    if (d.setores.length) checar(await servico.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: data.user.id, setor_id }))));
  } catch (e) {
    return { ok: false, erros: { geral: mensagemDeErro(e) } };
  }
  revalidatePath('/usuarios');
  return { ok: true };
}

export async function salvarUsuario(id: string, formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const lido = UsuarioForm.safeParse(formData);
  if (!lido.success) return { ok: false, erros: errosDoFormulario(lido.error.issues) };
  const d = lido.data;
  const conflito = await conflitoDeTelefone(d.telefone, id);
  if (conflito) return conflito;
  try {
    // Sessão do administrador (o RLS escrita_admin permite): a auditoria registra quem mudou, em vez de ficar sem usuário.
    const sb = await supabaseServidor();
    checar(await sb.from('usuarios').update({ nome: d.nome, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes }).eq('id', id));
    checar(await sb.from('usuario_setores').delete().eq('usuario_id', id));
    if (d.setores.length) checar(await sb.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: id, setor_id }))));
  } catch (e) {
    return { ok: false, erros: { geral: mensagemDeErro(e) } };
  }
  revalidatePath('/usuarios');
  return { ok: true };
}
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/usuarios"`
Esperado: PASS.

- [ ] **Passo 3: `BotaoSalvar` com `enviando`**

Em `apps/painel/src/components/patterns/formulario-alteravel.tsx`, troque a assinatura e a linha do `pending` de `BotaoSalvar`:

```tsx
export function BotaoSalvar({ children, destacar = false, enviando = false, className, ...props }: Omit<ButtonProps, 'type' | 'variant'> & {
  destacar?: boolean;
  /** Formulário enviado à mão (onSubmit + transição): o useFormStatus não sabe que está salvando. */
  enviando?: boolean;
}) {
  const ancora = useRef<HTMLButtonElement>(null);
  const alterado = useAlterado(ancora);
  const pending = useFormStatus().pending || enviando;
```

O resto da função não muda (ela já usa `pending`).

- [ ] **Passo 4: o formulário e o convite**

Em `apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx`:
- imports:

```tsx
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes, inicialRadix } from '@/components/patterns/formulario-alteravel';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { classeSelect } from '../clientes/estilos';
import { PERMISSOES, type EstadoUsuario } from './esquemas';

type Acao = (dados: FormData) => Promise<EstadoUsuario>;
const FALHA = 'Não consegui salvar agora. Tente de novo.';
```

- antes de `export function FormularioUsuario`, acrescente (é o mesmo aviso que estava em `page.tsx`):

```tsx
/** Erro sem campo (banco, convite recusado): dentro do formulário, no painel, não no topo da página. */
function AvisoErro({ erro }: { erro: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>{erro}</span>
    </p>
  );
}
```

- na lista de props, troque `aoTerminar` por:

```tsx
  /** Depois de salvar (a janela do convite fecha). */
  aoSalvar?: () => void;
```

e o tipo dele por `aoSalvar?: () => void;`. Ajuste a desestruturação (`aoSalvar` no lugar de `aoTerminar`).

- logo depois de `const semTelefone = whatsapp && !telefone.trim();`, acrescente:

```tsx
  const [estado, setEstado] = useState<EstadoUsuario | null>(null);
  const [enviando, iniciar] = useTransition();
  const erros = estado && !estado.ok ? estado.erros : {};

  const enviarFormulario = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela (sem action no <form>): o React não limpa os campos, então o erro aparece no campo
    // com o painel aberto e tudo o que foi digitado (sobra 6 da Parte B).
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        setEstado(r);
        if (!r.ok) return;
        toast.success(editando
          ? `Salvo: ${String(dados.get('nome') ?? '').trim()}.`
          : `Convite enviado para ${String(dados.get('email') ?? '').trim().toLowerCase()}.`);
        aoSalvar?.();
      } catch (err) {
        unstable_rethrow(err);
        console.error('[usuarios] falha ao salvar', err);
        setEstado({ ok: false, erros: { geral: FALHA } });
      }
    });
  };
```

- troque `<FormularioAlteravel action={acao} className=...>` por `<FormularioAlteravel onSubmit={enviarFormulario} className=...>`;
- logo depois de `{aviso}`, acrescente `{erros.geral && <AvisoErro erro={erros.geral} />}`;
- passe o erro de cada campo: `<FormField id={`${id}-nome`} rotulo="Nome" erro={erros.nome}>`, `<FormField id={`${id}-email`} ... erro={erros.email}>`, `<FormField id={`${id}-telefone`} rotulo="Telefone" erro={erros.telefone}>` e `<FormField id={`${id}-papel`} rotulo="Papel" erro={erros.papel}>`;
- no rodapé, troque `<BotaoSalvar>{enviar}</BotaoSalvar>` e a linha do `aoTerminar` por `<BotaoSalvar enviando={enviando}>{enviar}</BotaoSalvar>`;
- apague a função `AoTerminar` e o import de `useFormStatus`;
- no comentário do componente, troque a frase sobre o servidor por: "Os erros voltam da ação e aparecem no campo (ou no aviso do formulário), sem fechar o painel nem perder o que foi digitado."

Substitua `apps/painel/src/app/(painel)/usuarios/convite-usuario.tsx` por:

```tsx
'use client';

import { UserPlus } from 'lucide-react';
import { useRef, useState } from 'react';
import { useDescarteProtegido } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { EstadoUsuario } from './esquemas';
import { FormularioUsuario, type SetorOpcao } from './formulario-usuario';

type Acao = (dados: FormData) => Promise<EstadoUsuario>;

/**
 * "Convidar pessoa": janela com o formulário de sempre (action convidarUsuario, botão "Enviar convite").
 * Erro fica no campo, com a janela aberta; deu certo, fecha e avisa "Convite enviado para …".
 * Fechar com alterações pede confirmação.
 */
export function ConviteUsuario({ acao, setores }: { acao: Acao; setores: SetorOpcao[] }) {
  const [aberto, setAberto] = useState(false);
  const conteudo = useRef<HTMLDivElement>(null);
  const { tentarFechar, janela } = useDescarteProtegido();

  return (
    <Dialog
      open={aberto}
      onOpenChange={(v) => {
        if (v) setAberto(true);
        else tentarFechar(conteudo.current, () => setAberto(false));
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <UserPlus aria-hidden size={16} strokeWidth={1.75} />
          Convidar pessoa
        </Button>
      </DialogTrigger>
      <DialogContent ref={conteudo} className="flex max-h-dvh flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border p-4 pr-12">
          <DialogTitle>Convidar pessoa</DialogTitle>
          <DialogDescription>Ela recebe um e-mail para definir a senha.</DialogDescription>
        </DialogHeader>
        <FormularioUsuario acao={acao} setores={setores} enviar="Enviar convite" aoSalvar={() => setAberto(false)} />
        {janela}
      </DialogContent>
    </Dialog>
  );
}
```

Em `apps/painel/src/app/(painel)/usuarios/page.tsx`:
- apague a função `AvisoErro`, a linha `const erro = valorParam(params, 'erro');` e a linha `{erro && <div className="mb-4"><AvisoErro erro={erro} /></div>}`;
- tire `CircleAlert` do import de `lucide-react`;
- troque `<ConviteUsuario acao={convidarUsuario} setores={opcoesSetor} emails={linhas.map((l) => l.email.toLowerCase())} />` por `<ConviteUsuario acao={convidarUsuario} setores={opcoesSetor} />`;
- no `FormularioUsuario` do painel, troque o `aviso={...}` inteiro por `aviso={aberto.contatoDoTelefone && <AvisoContato contato={aberto.contatoDoTelefone} />}`;
- troque o comentário da página "Os erros das duas ações voltam em ?erro=." por "Os erros das duas ações aparecem no próprio formulário.";
- `hrefUsuario` não muda.

```bash
grep -rn "Convite enviado\|erro=\|aoTerminar\|AvisoErro" "apps/painel/src/app/(painel)/usuarios" apps/painel/e2e
pnpm --filter @escritorio/painel typecheck
pnpm --filter @escritorio/painel test
```

Esperado:
- o grep não mostra mais `aoTerminar` nem `erro=` em `usuarios/`;
- nos testes e2e, aparecem os dois que o passo 5 ajusta;
- o typecheck e o vitest passam.

- [ ] **Passo 5: Playwright (o novo falha antes do passo 4; os ajustados descrevem o comportamento novo)**

Crie `apps/painel/e2e/usuarios-erros.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Sobras 6 e 4 da Parte B: erro ao salvar em Usuários fica no campo, com o painel aberto e o que foi digitado.
const SENHA = 'senha-forte-123';
const TEL = '5531999991801';
const CAMPO_TEL = 'Telefone com DDD (para o assistente pelo WhatsApp)';

async function cenario() {
  await criarUsuarioTeste({ email: 'admin-erros@e2e.local', senha: SENHA, nome: 'Admin Erros', papel: 'admin' });
  await db.from('usuarios').update({ telefone: null }).eq('telefone', TEL);
  const ze = await criarUsuarioTeste({ email: 'ze-erros@e2e.local', senha: SENHA, nome: 'Zé Erros', papel: 'atendente' });
  await db.from('usuarios').update({ telefone: TEL }).eq('id', ze);
  const bia = await criarUsuarioTeste({ email: 'bia-erros@e2e.local', senha: SENHA, nome: 'Bia Erros', papel: 'atendente' });
  return { ze, bia };
}

test('telefone de outra pessoa: o erro aparece no campo, o painel fica aberto e nada se perde', async ({ page }) => {
  const { bia } = await cenario();
  await entrar(page, 'admin-erros@e2e.local', SENHA);
  await page.goto(`/usuarios?usuario=${bia}`);
  const painel = page.getByRole('dialog');
  await painel.getByPlaceholder('Nome').fill('Bia Erros Souza');
  const tel = painel.getByPlaceholder(CAMPO_TEL);
  await tel.fill('(31) 99999-1801');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(painel.getByText('Este telefone já é de Zé Erros.')).toBeVisible();
  await expect(tel).toHaveAttribute('aria-invalid', 'true');
  await expect(tel).toHaveValue('(31) 99999-1801');
  await expect(painel.getByPlaceholder('Nome')).toHaveValue('Bia Erros Souza');
  await expect(painel.getByText('Alterações não salvas')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`usuario=${bia}`));
  await expect(page).not.toHaveURL(/erro=/);
  expect((await db.from('usuarios').select('nome').eq('id', bia).single()).data!.nome).toBe('Bia Erros');
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await tel.fill('');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(page.getByText('Salvo: Bia Erros Souza.')).toBeVisible();
  await expect(painel.getByText('Este telefone já é de Zé Erros.')).toHaveCount(0);
  await expect(painel.getByText('Alterações não salvas')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('nome').eq('id', bia).single()).data!.nome).toBe('Bia Erros Souza');
});
```

Em `apps/painel/e2e/revisao-final.spec.ts`, no teste "Usuários: telefone inválido avisa; salvar mantém setor inativo…", troque o trecho entre `fill('12345')` e o segundo clique em "Salvar usuário" por:

```ts
  await form.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)').fill('12345');
  await form.getByRole('button', { name: 'Salvar usuário' }).click();
  // Sobra 6 da Parte B: o erro fica no campo, o painel continua aberto e o que foi digitado não se perde.
  await expect(form.getByText('Telefone inválido')).toBeVisible();
  await expect(form.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)')).toHaveValue('12345');
  await expect(page).not.toHaveURL(/erro=/);

  await form.getByPlaceholder('Nome').fill('Bia Revisão Souza');
  await form.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)').fill('');
  await form.getByRole('button', { name: 'Salvar usuário' }).click();
```

O resto do teste continua igual. Ele já confere que "Telefone inválido" some e que a URL não tem `erro=`. Também sai a linha `await page.getByText('Bia Revisão · Atendente').click();` do meio, porque o painel não fecha mais.

Em `apps/painel/e2e/configuracoes.spec.ts`, no teste do convite, troque o trecho do primeiro "Enviar convite" até o segundo por:

```ts
  await preencher();
  await page.getByRole('button', { name: 'Enviar convite' }).click();
  // Sobra 6 da Parte B: a janela fica aberta, com o erro no campo telefone e o que foi digitado.
  const janela = page.getByRole('dialog', { name: 'Convidar pessoa' });
  await expect(janela.getByText('Informe o telefone para usar o assistente pelo WhatsApp')).toBeVisible();
  await expect(janela.getByPlaceholder('E-mail')).toHaveValue('nova@teste.com');
  await janela.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)').fill('(31) 95555-0001');
  await janela.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(page.getByText('Convite enviado para nova@teste.com.')).toBeVisible();
  await expect(janela).toHaveCount(0);
```

O `expect` seguinte ("Nova Pessoa · Atendente · assistente no WhatsApp") e o resto continuam. Atualize o comentário de `preencher` para "O convite fica numa janela; ela fecha quando o envio dá certo."

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/usuarios-erros.spec.ts e2e/revisao-final.spec.ts e2e/configuracoes.spec.ts e2e/arquivar-usuarios.spec.ts e2e/treinar-agente.spec.ts`
Esperado: PASS em todos.

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/components/patterns/formulario-alteravel.tsx \
  "apps/painel/src/app/(painel)/usuarios/esquemas.ts" "apps/painel/src/app/(painel)/usuarios/esquemas.test.ts" \
  "apps/painel/src/app/(painel)/usuarios/acoes.ts" "apps/painel/src/app/(painel)/usuarios/acoes.test.ts" \
  "apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx" "apps/painel/src/app/(painel)/usuarios/convite-usuario.tsx" \
  "apps/painel/src/app/(painel)/usuarios/page.tsx" apps/painel/e2e/usuarios-erros.spec.ts \
  apps/painel/e2e/revisao-final.spec.ts apps/painel/e2e/configuracoes.spec.ts
git commit -m "$(cat <<'EOF'
fix(usuarios): erro ao salvar aparece no campo, sem fechar o painel (sobra 6)

Antes, telefone repetido ou inválido fechava o painel lateral e o aviso ia
para o topo (?erro=). Agora as ações devolvem o resultado e o formulário
mostra o erro no próprio campo, com o painel aberto e tudo o que foi
digitado. Erro sem campo (banco, convite recusado) aparece dentro do
formulário. Salvar confirma com "Salvo: <nome>.".

- O convite usa o mesmo formulário: a janela fica aberta com o erro, e sai
  a espera pela lista para saber se deu certo.
- BotaoSalvar aceita "enviando" para formulários enviados à mão.
- e2e: revisao-final e configuracoes descrevem o comportamento novo (painel
  e janela continuam abertos).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Sobra 4. Telefone de pessoa arquivada diz isso e oferece o caminho

**Arquivos:**
- Modificar: `apps/painel/src/app/(painel)/usuarios/acoes.ts`, `usuarios/acoes.test.ts`
- Modificar: `apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx`
- Modificar: `apps/painel/src/components/patterns/excluir-cadastro.tsx` (`BotaoRestaurar` com `aoRestaurar`)
- Teste: `apps/painel/e2e/usuarios-erros.spec.ts`

**Interfaces:**
- Consome (Task 4): `EstadoUsuario.telefoneDeArquivado`, `conflitoDeTelefone` e o estado do `FormularioUsuario`. Consome também (Task 3) o `BotaoRestaurar` atual.
- Produz:
  - o texto `Este telefone é de <nome>, que está nos arquivados. Restaure <nome> ou use outro telefone.`;
  - `BotaoRestaurar({ tipo, id, nome, aoRestaurar?: () => void })`.

- [ ] **Passo 1: vitest (falha)**

Em `apps/painel/src/app/(painel)/usuarios/acoes.test.ts`, acrescente dentro do `describe('salvarUsuario'`:

```ts
  it('telefone de pessoa arquivada: diz isso e oferece restaurar', async () => {
    falso.donos = [{ id: 'ze', nome: 'Zé', ativo: false }];
    expect(await salvarUsuario(BIA, formulario({ telefone: '(31) 99999-1801' }))).toEqual({
      ok: false,
      erros: { telefone: 'Este telefone é de Zé, que está nos arquivados. Restaure Zé ou use outro telefone.' },
      telefoneDeArquivado: { id: 'ze', nome: 'Zé' },
    });
    expect(falso.atualizacoes).toEqual([]);
  });
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/usuarios/acoes.test.ts"`
Esperado: FALHA (a mensagem ainda é "Este telefone já é de Zé.").

- [ ] **Passo 2: a ação diz que a pessoa está arquivada**

Em `apps/painel/src/app/(painel)/usuarios/acoes.ts`, substitua `conflitoDeTelefone` por:

```ts
/**
 * Um telefone é de uma pessoa só: senão o WhatsApp não sabe de quem é a mensagem. Se o dono está nos arquivados,
 * a tela diz isso e oferece restaurar (sobra 4 da Parte B), em vez de um "já é de…" sem saída.
 */
async function conflitoDeTelefone(telefone: string | null, idAtual: string | null): Promise<EstadoUsuario | null> {
  if (!telefone) return null;
  const { data } = await supabaseServico().from('usuarios').select('id, nome, ativo').in('telefone', variantesTelefone(telefone));
  const outro = (data ?? []).find((u) => u.id !== idAtual);
  if (!outro) return null;
  if (outro.ativo) return { ok: false, erros: { telefone: `Este telefone já é de ${outro.nome}.` } };
  return {
    ok: false,
    erros: { telefone: `Este telefone é de ${outro.nome}, que está nos arquivados. Restaure ${outro.nome} ou use outro telefone.` },
    telefoneDeArquivado: { id: outro.id, nome: outro.nome },
  };
}
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/usuarios/acoes.test.ts"`
Esperado: PASS (8 testes).

- [ ] **Passo 3: o botão Restaurar ao lado do erro**

Em `apps/painel/src/components/patterns/excluir-cadastro.tsx`, no `BotaoRestaurar`:
- assinatura: `export function BotaoRestaurar({ tipo, id, nome, aoRestaurar }: { tipo: TipoCadastro; id: string; nome: string; /** Depois de restaurar (ex.: limpar o erro do formulário que ofereceu o caminho). */ aoRestaurar?: () => void })`;
- nos dois pontos de sucesso, depois de `toast.success(...)`, acrescente `aoRestaurar?.();`.

Em `apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx`:
- acrescente `import { BotaoRestaurar } from '@/components/patterns/excluir-cadastro';`;
- logo depois do `</FormField>` do telefone, acrescente:

```tsx
          {estado && !estado.ok && estado.telefoneDeArquivado && (
            <div className="flex items-center gap-2 sm:col-span-2">
              <BotaoRestaurar
                tipo="usuario"
                id={estado.telefoneDeArquivado.id}
                nome={estado.telefoneDeArquivado.nome}
                // Restaurada a pessoa, o aviso de "nos arquivados" não vale mais.
                aoRestaurar={() => setEstado(null)}
              />
            </div>
          )}
```

- [ ] **Passo 4: Playwright (falha antes dos passos 2 e 3)**

Em `apps/painel/e2e/usuarios-erros.spec.ts`, acrescente:

```ts
test('telefone de pessoa arquivada: diz que está nos arquivados e oferece restaurar ou outro telefone', async ({ page }) => {
  const { ze, bia } = await cenario();
  await db.from('usuarios').update({ ativo: false }).eq('id', ze);
  await entrar(page, 'admin-erros@e2e.local', SENHA);
  await page.goto(`/usuarios?usuario=${bia}`);
  const painel = page.getByRole('dialog');
  const tel = painel.getByPlaceholder(CAMPO_TEL);
  await tel.fill('(31) 99999-1801');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(painel.getByText('Este telefone é de Zé Erros, que está nos arquivados. Restaure Zé Erros ou use outro telefone.')).toBeVisible();

  await painel.getByRole('button', { name: 'Restaurar Zé Erros' }).click();
  await expect(page.getByText('Restaurado: Zé Erros.')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('ativo').eq('id', ze).single()).data!.ativo).toBe(true);
  await expect(painel.getByText(/que está nos arquivados/)).toHaveCount(0);
  await expect(tel).toHaveValue('(31) 99999-1801');

  // Restaurada, o telefone continua sendo dela: salvar avisa "já é de", e outro telefone resolve.
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(painel.getByText('Este telefone já é de Zé Erros.')).toBeVisible();
  await tel.fill('(31) 99999-1802');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(page.getByText('Salvo: Bia Erros.')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('telefone').eq('id', bia).single()).data!.telefone).toBe('5531999991802');
});
```

No `cenario()`, troque `await db.from('usuarios').update({ telefone: null }).eq('telefone', TEL);` por `await db.from('usuarios').update({ telefone: null }).in('telefone', [TEL, '5531999991802']);`, para cada execução começar limpa.

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/usuarios-erros.spec.ts e2e/arquivar-usuarios.spec.ts`
Esperado: PASS.

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/usuarios/acoes.ts" "apps/painel/src/app/(painel)/usuarios/acoes.test.ts" \
  "apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx" apps/painel/src/components/patterns/excluir-cadastro.tsx \
  apps/painel/e2e/usuarios-erros.spec.ts
git commit -m "$(cat <<'EOF'
fix(usuarios): telefone de pessoa arquivada diz isso e oferece restaurar (sobra 4)

"Este telefone já é de …" não dizia que a dona estava arquivada, e a pessoa
ficava sem saída. Agora: "Este telefone é de <nome>, que está nos
arquivados. Restaure <nome> ou use outro telefone.", com o botão Restaurar
ao lado do campo, sem fechar o painel. Vale para salvar e para convidar.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Sobra 1. Lápis de editar nas linhas de Contatos e Usuários

**Arquivos:**
- Modificar: `apps/painel/src/app/(painel)/usuarios/page.tsx` (coluna Ações)
- Modificar: `apps/painel/src/app/(painel)/contatos/page.tsx` (coluna Ações)
- Criar: `apps/painel/src/app/(painel)/contatos/editar-nome-contato.tsx`
- Modificar: `apps/painel/src/app/(painel)/contatos/detalhe-contato.tsx`, `contatos/acoes.ts`
- Criar: `apps/painel/src/app/(painel)/contatos/acoes.test.ts`
- Teste: `apps/painel/e2e/arquivar-usuarios.spec.ts`, `apps/painel/e2e/arquivar-contatos.spec.ts`

**Interfaces:**
- Consome (Task 4): `BotaoSalvar` com `enviando`.
- Produz:
  - `renomearContato(id: string, formData: FormData): Promise<ResultadoNome>`, com `type ResultadoNome = { ok: true } | { ok: false; erro: string }`, em `contatos/acoes.ts`;
  - `EditarNomeContato({ nome, acao: (dados: FormData) => Promise<ResultadoNome> })`;
  - nomes acessíveis "Editar <nome>" (lápis) e "Salvar nome".

- [ ] **Passo 1: vitest da ação (falha)**

Crie `apps/painel/src/app/(painel)/contatos/acoes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sobra 1 da Parte B (decisão P1): o lápis do contato abre o painel, onde o Nome é editável.
const falso = vi.hoisted(() => ({ pode: true, atualizacoes: [] as Record<string, unknown>[], linhas: [{ id: 'c1' }] as { id: string }[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1' }), temPermissao: () => falso.pode }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: () => ({
      update: (dados: Record<string, unknown>) => {
        falso.atualizacoes.push(dados);
        return { eq: () => ({ eq: () => ({ select: async () => ({ data: falso.linhas, error: null }) }) }) };
      },
    }),
  }),
}));

import { renomearContato } from './acoes';

const ID = '22222222-2222-4222-8222-222222222222';
const comNome = (nome: string) => { const f = new FormData(); f.append('nome', nome); return f; };

beforeEach(() => {
  falso.pode = true;
  falso.atualizacoes = [];
  falso.linhas = [{ id: ID }];
});

describe('renomearContato', () => {
  it('grava o nome sem espaços nas pontas', async () => {
    expect(await renomearContato(ID, comNome('  Maria Souza '))).toEqual({ ok: true });
    expect(falso.atualizacoes).toEqual([{ nome: 'Maria Souza' }]);
  });
  it('nome curto, sem permissão ou contato que saiu (arquivado): erro, nada gravado', async () => {
    expect(await renomearContato(ID, comNome('M'))).toEqual({ ok: false, erro: 'Informe o nome do contato.' });
    falso.linhas = [];
    expect(await renomearContato(ID, comNome('Maria'))).toEqual({ ok: false, erro: 'Contato não encontrado.' });
    falso.pode = false;
    expect(await renomearContato(ID, comNome('Maria'))).toEqual({ ok: false, erro: 'Você não tem permissão para editar contatos.' });
    expect(falso.atualizacoes).toEqual([{ nome: 'Maria' }]);
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/contatos/acoes.test.ts"`
Esperado: FALHA (`renomearContato` não existe).

- [ ] **Passo 2: a ação e o campo Nome no painel do contato**

Em `apps/painel/src/app/(painel)/contatos/acoes.ts`, acrescente no fim:

```ts
export type ResultadoNome = { ok: true } | { ok: false; erro: string };

/** Nome do contato, pelo painel lateral (lápis da lista). Arquivado não se edita: volta pelo Restaurar. */
export async function renomearContato(id: string, formData: FormData): Promise<ResultadoNome> {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) return { ok: false, erro: 'Você não tem permissão para editar contatos.' };
  const nome = String(formData.get('nome') ?? '').trim();
  if (nome.length < 2) return { ok: false, erro: 'Informe o nome do contato.' };
  const sb = await supabaseServidor();
  const { data, error } = await sb.from('contatos').update({ nome }).eq('id', id).eq('ativo', true).select('id');
  if (error) return { ok: false, erro: error.message };
  if (!data?.length) return { ok: false, erro: 'Contato não encontrado.' };
  revalidatePath('/contatos');
  revalidatePath('/clientes', 'layout');
  return { ok: true };
}
```

Crie `apps/painel/src/app/(painel)/contatos/editar-nome-contato.tsx`:

```tsx
'use client';

import { unstable_rethrow } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import type { ResultadoNome } from './acoes';

/** Nome do contato no painel lateral. Erro aparece no campo, sem perder o que foi digitado. */
export function EditarNomeContato({ nome, acao }: { nome: string; acao: (dados: FormData) => Promise<ResultadoNome> }) {
  const id = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela: o React não limpa o campo se a gravação falhar.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        if (!r.ok) { setErro(r.erro); return; }
        setErro(null);
        toast.success(`Salvo: ${String(dados.get('nome') ?? '').trim()}.`);
      } catch (err) {
        unstable_rethrow(err);
        console.error('[contatos] falha ao salvar o nome', err);
        setErro('Não consegui salvar agora. Tente de novo.');
      }
    });
  };
  return (
    <FormularioAlteravel onSubmit={enviar} className="flex flex-col gap-3">
      <FormField id={`${id}-nome`} rotulo="Nome" erro={erro}>
        <Input name="nome" defaultValue={nome} required minLength={2} autoComplete="off" />
      </FormField>
      <div className="flex items-center justify-end gap-3">
        <IndicadorAlteracoes />
        <BotaoSalvar enviando={enviando} destacar size="sm">Salvar nome</BotaoSalvar>
      </div>
    </FormularioAlteravel>
  );
}
```

Em `apps/painel/src/app/(painel)/contatos/detalhe-contato.tsx`:
- acrescente `import { renomearContato } from './acoes';` e `import { EditarNomeContato } from './editar-nome-contato';`;
- logo depois do bloco `{!c.ativo && !anonimizado && (...)}`, acrescente:

```tsx
        {pode && c.ativo && (
          <Secao titulo="Dados">
            {/* key: depois de salvar, o campo recomeça com o nome novo. */}
            <EditarNomeContato key={c.nome} nome={c.nome} acao={renomearContato.bind(null, c.id)} />
          </Secao>
        )}
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/contatos/acoes.test.ts"`
Esperado: PASS (2 testes).

- [ ] **Passo 3: o lápis nas duas listas**

Em `apps/painel/src/app/(painel)/contatos/page.tsx`:
- no import de `lucide-react`, acrescente `Pencil`;
- troque a linha `acoesLinha={pode ? (c) => <ExcluirCadastro tipo="contato" id={c.id} nome={c.nome} /> : undefined}` por:

```tsx
        acoesLinha={pode ? (c) => (
          // Lápis e arquivar, como em Clientes (imagem 01): o lápis abre o painel do contato.
          <span className="flex items-center justify-end gap-1">
            <Link href={hrefContato(c.id)} scroll={false} aria-label={`Editar ${c.nome}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            <ExcluirCadastro tipo="contato" id={c.id} nome={c.nome} />
          </span>
        ) : undefined}
```

Em `apps/painel/src/app/(painel)/usuarios/page.tsx`:
- acrescente `import Link from 'next/link';`, `import { variantesBotao } from '@/components/ui/button';` e `Pencil` no import de `lucide-react`;
- troque o `acoesLinha` e o comentário acima dele por:

```tsx
        // Lápis abre o painel da pessoa; ninguém arquiva nem exclui o próprio acesso.
        acoesLinha={(u) => (
          <span className="flex items-center justify-end gap-1">
            <Link href={hrefUsuario(u.id)} scroll={false} aria-label={`Editar ${u.nome}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            {u.id !== eu.id && <ExcluirCadastro tipo="usuario" id={u.id} nome={u.nome} />}
          </span>
        )}
```

```bash
grep -rn "Editar " apps/painel/e2e | head
pnpm --filter @escritorio/painel typecheck
```

Esperado: o grep não mostra nenhum teste que procure outro botão "Editar <nome>" nessas telas, e o typecheck passa.

- [ ] **Passo 4: Playwright**

Em `apps/painel/e2e/arquivar-usuarios.spec.ts`, acrescente:

```ts
test('lápis de editar em cada linha; na própria linha tem lápis e não tem arquivar', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia Arquivo', papel: 'atendente' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios');
  await expect(linha(page, 'Admin Arquivo').getByRole('link', { name: 'Editar Admin Arquivo' })).toBeVisible();
  await expect(linha(page, 'Admin Arquivo').getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await linha(page, 'Bia Arquivo').getByRole('link', { name: 'Editar Bia Arquivo' }).click();
  await expect(page).toHaveURL(new RegExp(`usuario=${bia}`));
  await expect(page.getByRole('dialog').getByPlaceholder('Nome')).toHaveValue('Bia Arquivo');
});
```

Em `apps/painel/e2e/arquivar-contatos.spec.ts`, acrescente:

```ts
test('lápis abre o contato e o nome muda ali; sem permissão não há lápis', async ({ page }) => {
  await db.from('contatos').insert({ nome: 'Maria Arquivo', telefone: TEL_MARIA });
  await comoAdmin(page);
  await page.goto('/contatos');
  await linha(page, 'Maria Arquivo').getByRole('link', { name: 'Editar Maria Arquivo' }).click();
  const painel = page.getByRole('dialog');
  await painel.getByLabel('Nome', { exact: true }).fill('Maria Souza');
  await painel.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText('Salvo: Maria Souza.')).toBeVisible();
  await expect.poll(async () => (await db.from('contatos').select('nome').eq('telefone', TEL_MARIA).single()).data!.nome).toBe('Maria Souza');

  await page.context().clearCookies();
  await criarUsuarioTeste({ email: 'ana-contatos@teste.com', senha: SENHA, nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana-contatos@teste.com', SENHA);
  await page.goto('/contatos');
  await expect(linha(page, 'Maria Souza')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /^Editar / })).toHaveCount(0);
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-usuarios.spec.ts e2e/arquivar-contatos.spec.ts e2e/contatos.spec.ts`
Esperado: PASS.

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/contatos/page.tsx" "apps/painel/src/app/(painel)/contatos/acoes.ts" \
  "apps/painel/src/app/(painel)/contatos/acoes.test.ts" "apps/painel/src/app/(painel)/contatos/editar-nome-contato.tsx" \
  "apps/painel/src/app/(painel)/contatos/detalhe-contato.tsx" "apps/painel/src/app/(painel)/usuarios/page.tsx" \
  apps/painel/e2e/arquivar-usuarios.spec.ts apps/painel/e2e/arquivar-contatos.spec.ts
git commit -m "$(cat <<'EOF'
feat(cadastros): lápis de editar nas linhas de Contatos e Usuários (sobra 1)

Spec 5.1: coluna Ações com editar e arquivar em cada linha, como em
Clientes (imagem 01).

- Usuários: o lápis abre o painel da pessoa; a própria linha tem lápis e
  não tem arquivar.
- Contatos (decisão P1): o lápis abre o painel do contato, que ganha o
  campo Nome editável. Telefone, empresas e marcações por empresa ficam
  para a Parte G.
- Sem permissão de editar, não há lápis.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Sobra 2. "(inativo)" some de Demandas

**Arquivos:**
- Modificar: `apps/painel/src/lib/demandas.ts`, `apps/painel/src/lib/demandas.test.ts`
- Modificar: `apps/painel/src/app/(painel)/demandas/page.tsx:229-234`
- Teste: `apps/painel/e2e/arquivar-usuarios.spec.ts`
- Só com o "sim" do dono na P4: `apps/painel/src/components/patterns/escolher-empresa.tsx`, `apps/painel/src/app/(painel)/atendimento/[id]/ensinar-agente.tsx`, `apps/painel/src/app/(painel)/treinar-agente/page.tsx`

**Interfaces:**
- Produz: `opcoesResponsavel(pessoas: { id: string; nome: string; ativo: boolean }[], euId: string, filtro: string | null): { valor: string; rotulo: string }[]`.

- [ ] **Passo 1: vitest (falha)**

Em `apps/painel/src/lib/demandas.test.ts`, acrescente `opcoesResponsavel` ao import e, no fim:

```ts
describe('opcoesResponsavel', () => {
  const pessoas = [
    { id: 'eu', nome: 'Ana', ativo: true },
    { id: 'bia', nome: 'Bia', ativo: true },
    { id: 'ze', nome: 'Zé', ativo: false },
  ];
  it('arquivado sai da seleção (spec 5.1); eu viro "Comigo" à parte', () => {
    expect(opcoesResponsavel(pessoas, 'eu', null)).toEqual([{ valor: 'bia', rotulo: 'Bia' }]);
  });
  it('arquivado que já está no filtro da URL aparece como "(arquivado)", nunca "(inativo)"', () => {
    expect(opcoesResponsavel(pessoas, 'eu', 'ze')).toEqual([{ valor: 'bia', rotulo: 'Bia' }, { valor: 'ze', rotulo: 'Zé (arquivado)' }]);
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/demandas.test.ts`
Esperado: FALHA (`opcoesResponsavel` não existe).

- [ ] **Passo 2: a regra e a tela**

Em `apps/painel/src/lib/demandas.ts`, acrescente no fim:

```ts
/**
 * Pessoas do filtro Responsável. Arquivada sai da seleção (spec 5.1), exceto a que já está no filtro da URL
 * (senão o Select pareceria "Qualquer um"); essa aparece como "(arquivado)", o nome do estado no painel.
 */
export function opcoesResponsavel(pessoas: { id: string; nome: string; ativo: boolean }[], euId: string, filtro: string | null) {
  return pessoas.filter((p) => p.id !== euId && (p.ativo || p.id === filtro))
    .map((p) => ({ valor: p.id, rotulo: p.ativo ? p.nome : `${p.nome} (arquivado)` }));
}
```

Em `apps/painel/src/app/(painel)/demandas/page.tsx`:
- acrescente `opcoesResponsavel` ao import de `@/lib/demandas`;
- troque as três linhas do spread (o comentário "Inativos só aparecem…" e o `...(pessoas ?? []).filter(...).map(...)`) por:

```tsx
            ...opcoesResponsavel(pessoas ?? [], u.id, f.responsavel),
```

```bash
grep -rn "(inativo)" apps/painel/src apps/painel/e2e
pnpm --filter @escritorio/painel exec vitest run src/lib/demandas.test.ts
```

Esperado:
- o grep mostra só os setores inativos (`configuracoes/page.tsx`, `treinar-agente/formulario-orientacao.tsx`, `usuarios/formulario-usuario.tsx` e `e2e/revisao-final.spec.ts`). Setor não é cadastro arquivável, então ficam como estão;
- o vitest passa.

- [ ] **Passo 3: Playwright**

Em `apps/painel/e2e/arquivar-usuarios.spec.ts`, acrescente:

```ts
test('Demandas: pessoa arquivada só aparece no filtro quando já está nele, como "(arquivado)"', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const ze = await criarUsuarioTeste({ email: 'ze@teste.com', senha: SENHA, nome: 'Zé Arquivo', papel: 'atendente' });
  await db.from('chamados').insert({ responsavel_id: ze, titulo: 'Guia do DAS (usuario e2e)' });
  await db.from('usuarios').update({ ativo: false }).eq('id', ze);
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?responsavel=${ze}`);
  await expect(page.getByLabel('Responsável')).toContainText('Zé Arquivo (arquivado)');
  await expect(page.getByText(/\(inativo\)/)).toHaveCount(0);
  await page.goto('/demandas');
  await page.getByLabel('Responsável').click();
  await expect(page.getByRole('option', { name: /Zé Arquivo/ })).toHaveCount(0);
});
```

Run: `pnpm --filter @escritorio/painel exec playwright test e2e/arquivar-usuarios.spec.ts e2e/demandas.spec.ts`
Esperado: PASS.

- [ ] **Passo 4: commit**

```bash
git add apps/painel/src/lib/demandas.ts apps/painel/src/lib/demandas.test.ts "apps/painel/src/app/(painel)/demandas/page.tsx" \
  apps/painel/e2e/arquivar-usuarios.spec.ts
git commit -m "$(cat <<'EOF'
fix(demandas): pessoa arquivada aparece como "(arquivado)", não "(inativo)" (sobra 2)

O filtro Responsável já tirava as pessoas arquivadas da seleção (spec 5.1);
só a que já estava no filtro da URL aparecia, como "(inativo)". Agora o
rótulo é "(arquivado)", o nome do estado no painel. A regra foi para
lib/demandas.ts, com teste.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Passo 5: (só se o dono responder "sim" à P4) "inativa" da empresa arquivada em Treinar o agente**

```bash
grep -rn "(inativa)\|inativa'\|>inativa<\|está inativa" apps/painel/src apps/painel/e2e
```

Troque **só o texto da tela**:
- `apps/painel/src/components/patterns/escolher-empresa.tsx`: as duas ocorrências de `' (inativa)'` por `' (arquivada)'`;
- `apps/painel/src/app/(painel)/atendimento/[id]/ensinar-agente.tsx`:
  - `' (inativa)'` por `' (arquivada)'`;
  - "A empresa desta conversa está inativa: a orientação só pode valer para todos." por "A empresa desta conversa está arquivada: a orientação só pode valer para todos.";
- `apps/painel/src/app/(painel)/treinar-agente/page.tsx`: `<Badge variant="outline">inativa</Badge>` por `<Badge variant="outline">arquivada</Badge>`.

Nomes de variável (`inativa`, `ativa`) e o selo "setor inativo" não mudam. Ajuste qualquer teste que o grep mostrar procurando esses textos.

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel exec playwright test e2e/treinar-agente.spec.ts e2e/ensinar-agente.spec.ts`
Esperado: PASS.

```bash
git add apps/painel/src/components/patterns/escolher-empresa.tsx "apps/painel/src/app/(painel)/atendimento/[id]/ensinar-agente.tsx" \
  "apps/painel/src/app/(painel)/treinar-agente/page.tsx"
git commit -m "$(cat <<'EOF'
fix(treinar-agente): empresa arquivada aparece como "arquivada", não "inativa"

Mesmo estado, mesma palavra que o resto do painel (resposta do dono à P4
do plano das sobras da Parte B). Só texto.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e as duas migrações aplicadas (`supabase migration up`):
   - `supabase test db`: todos os arquivos, inclusive o 15 com 60/60, o 16 com 21/21 e o 17 com 9/9;
   - `pnpm --filter @escritorio/db test`;
   - `pnpm --filter @escritorio/trabalhador test` e `pnpm --filter @escritorio/trabalhador typecheck`. O trabalhador não muda, mas a função `cadastrar_contato` mudou de assinatura: confirme que nada nele a chama (`grep -rn "cadastrar_contato" apps/trabalhador packages`);
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com o `acessibilidade.spec.ts` nos dois temas.
   - Mostre ao dono os números exatos de cada suíte (passaram, falharam, pulados). Nada de "deve passar".
   - Ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com as imagens `01-menu-e-clientes-arquivar.png` e `02-excluir-de-vez.png`:**
   - larguras 1366 e 1920, tema claro e escuro, com o painel local;
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**);
   - telas:
     - Contatos: a lista com a coluna Ações (lápis e arquivar) e o painel do contato com o campo Nome;
     - Usuários: a lista com o lápis e o painel com o erro "Este telefone é de …, que está nos arquivados…" e o botão Restaurar;
     - ficha do cliente, aba Contatos: a janela "Trazer … de volta?" com as empresas de antes;
     - ficha do cliente, aba Clientes: a janela "Restaurar a rede … também?";
     - Demandas com `?responsavel=<pessoa arquivada>`, mostrando "(arquivado)".
   - Liste o que ficou diferente das imagens. Exemplo: o cabeçalho "AÇÕES" da tabela continua só para leitor de tela, como em Clientes desde a Parte B.
3. **Homologação:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Deve listar só `20261003000100_painel_v2_contato_volta.sql` e `20261003000200_painel_v2_restaurar_unidade.sql`;
   - explique ao dono que o painel da Parte B (porta 3004) continua funcionando depois da migração: ele chama `cadastrar_contato` sem `p_manter`, e nenhuma empresa antiga volta, como hoje;
   - **espere o "ok" dele.** Só então rode o mesmo comando sem `--dry-run`.
4. **Subir para o dono testar:**
   - painel desta worktree numa porta livre, apontando para a homologação. Sugestão: **3005** (a 3002 e a 3003 são da Parte A, a 3004 da Parte B). Antes, confirme que a porta está livre com `netstat -ano | findstr :3005`;
   - use o mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal (`C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/ligar-teste.ps1`): variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p 3005` rodando nesta worktree;
   - passe o endereço `http://localhost:3005` e um roteiro curto: um teste para cada sobra, de 1 a 6.
5. **Pendências para listar no fim:**
   - as respostas do dono às perguntas P1 a P5 que ainda faltam;
   - as decisões 1 a 12 deste plano que ele ainda não confirmou;
   - o que ficou diferente das imagens;
   - a pendência de operação da seção 3.0: trocar o trabalhador da porta 3001 pelo da Parte B antes de testar o agente com arquivados.
6. **Não juntar** a branch em nada. Parar e esperar o "ok" do dono para começar a Parte C.
