# CNPJ alfanumérico (empresas abertas a partir de jul/2026). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** aceitar o **CNPJ alfanumérico** da Receita Federal (IN RFB nº 2.229/2024: a partir de julho de 2026, as 12 primeiras posições — raiz e ordem do estabelecimento — podem ter letras maiúsculas `A–Z` e números; as 2 últimas continuam sendo dígitos verificadores numéricos) **no banco, no painel e no agente**, **sem quebrar os CNPJs numéricos já cadastrados**. Um cliente aberto em agosto de 2026 com CNPJ `12.ABC.345/01DE-35` precisa poder ser cadastrado na ficha, como unidade (rede) de uma empresa, achado pela busca, mostrado com máscara, levado ao pedido de nota e ao CSV do Bling, e lido pelo agente — e os CNPJs numéricos de antes continuam iguais em tudo.

**A regra (conferida com o exemplo oficial):** cada caractere vale o seu código ASCII menos 48 (`0–9` → 0–9; `A` → 17, `B` → 18 … `Z` → 42); o cálculo dos dois dígitos verificadores é o de sempre (pesos 5,4,3,2,9,8,7,6,5,4,3,2 e depois 6,5,4,3,2,9,8,7,6,5,4,3,2; resto da divisão por 11; resto < 2 → 0, senão 11 − resto). Para `12ABC34501DE`: soma 459, resto 8 → **3**; com o 3, soma 424, resto 6 → **5** → `12.ABC.345/01DE-35`. Para números, o valor de cada dígito é ele mesmo: **o cálculo antigo é um caso particular do novo** (é isso que garante que nada do que já está cadastrado muda).

**O que já existe (conferido no código em `fa76a76`):**
- `apps/painel/src/lib/formatos.ts:36-57`: `mascararCNPJ` e `tipoDocumento` **já aceitam** o alfanumérico (`12ABC34501DE35` → `12.ABC.345/01DE-35`). A exibição no painel (`DocumentText`, lista de clientes, busca, arquivados, resumo do pedido) já está pronta.
- **Tudo o mais só aceita dígitos:**
  - banco: `clientes.cnpj check (cnpj ~ '^\d{14}$')` (`20260927000100_base.sql:41`) e `parceiros_unidades.cnpj check (cnpj ~ '^\d{14}$')` (`20260928000500_cadastros_comerciais.sql:24`);
  - core: `validarCnpj` usa `somenteDigitos` e `Number(d)` (`packages/core/src/documentos.ts:5-17`); `pre-analise-nota.ts:18` formata só dígitos;
  - painel: `ClienteForm` (`clientes/esquemas.ts:10`), `UnidadeForm` (`clientes/cadastros-esquemas.ts:20-21`), `lerFicha` (`clientes/ficha/ficha.ts:124-125`), `buscarCnpj` (`clientes/ficha/acoes.ts:77-79`), `digitos('cnpj')` e a busca ao sair do campo (`clientes/ficha/ficha-cliente.tsx:73-76, 97, 137-138`), os campos com `inputMode="numeric"` (`ficha/blocos-empresa.tsx:21`, `novo/form-antigo.tsx:33`, `[id]/secao-parceiros.tsx:35`), a unidade mostrada sem máscara (`secao-parceiros.tsx:87`), `consultarCnpj` (`lib/consultas-publicas.ts:50`), as buscas por CNPJ (`api/busca/route.ts:18`, `clientes/(lista)/page.tsx:43`);
  - repositório: `buscarEmpresas` busca CNPJ pelos dígitos (`packages/db/src/repos.ts:807-819`);
  - trabalhador: `cnpjFormatado` só formata dígitos (`agente/pedido-nota.ts:26`), usado no resumo ao cliente, no pedido de nota e em `consultar_cadastro` (agente e assistente); `tarefa/ferramentas.ts:221` devolve o CNPJ sem máscara.

**Arquitetura:**
- **Core (`@escritorio/core`, `documentos.ts`):** `normalizarCnpj` (tira pontuação, maiúsculas; `null` se não tiver a forma de um CNPJ), `validarCnpj` (o cálculo novo, que também vale para os numéricos), `formatarCnpj` (a máscara, a mesma do painel), `termoCnpjDaBusca` (o pedaço de CNPJ que alguém digitou numa busca). `somenteDigitos` continua (CEP, telefone, CPF).
- **Banco (1 migração nova):** `20261101000500_cnpj_alfanumerico.sql` troca os dois `check` para `^[0-9A-Z]{12}[0-9]{2}$` (todo CNPJ numérico já cadastrado passa) e cria `cnpj_valido(text)` (imutável, o mesmo cálculo, só para conferência e relatório; **não** vira trava — D3). pgTAP `84_cnpj_alfanumerico.test.sql`. `tipos.gen.ts` regerado (sem mudança de tipo: continua `string`).
- **Repositório:** `buscarEmpresas` com `termoCnpjDaBusca`.
- **Painel:** os formulários e a ficha usam `normalizarCnpj`; os campos aceitam letras (`inputMode="text"`, maiúsculas, até 18 caracteres); a unidade mostra a máscara; a busca automática da ficha manda o CNPJ alfanumérico à BrasilAPI e, se ela não achar, pede o preenchimento à mão (D5); as buscas por CNPJ usam `termoCnpjDaBusca`.
- **Trabalhador:** `cnpjFormatado` passa a usar `formatarCnpj` do core; `tarefa/ferramentas.ts` devolve com máscara; um cenário novo com Claude de verdade ("cliente pergunta o CNPJ da empresa", alfanumérico).
- **Bling:** o CSV leva o CNPJ **sem máscara**, como hoje (14 caracteres, agora podendo ter letras) — D6.

**Tecnologias:** TypeScript, Supabase (Postgres 17), Next.js 15, Vitest, pgTAP, Playwright. **Nenhuma dependência nova.**

**Spec:** não há spec escrita para este plano; o pedido é do dono (prompt de planejamento de 06/10): "aceitar o CNPJ alfanumérico (empresas abertas a partir de jul/2026, regra da Receita) no banco, no painel e no agente, sem quebrar os CNPJs numéricos já cadastrados". Referências: Instrução Normativa RFB nº 2.229/2024 e o exemplo `12.ABC.345/01DE-35` da Receita; spec 7D.1 (ficha do cliente, busca pública), 7D.2, 4.6 (tom). Comentário que já anuncia a regra: `apps/painel/src/lib/formatos.ts:43`.

**Onde trabalhar:** worktree nova `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/producao-cnpj`, branch `producao-cnpj`, criada **a partir da ponta da branch `producao-prontidao`** (o plano anterior): `git worktree add .claude/worktrees/producao-cnpj -b producao-cnpj producao-prontidao`. **A confirmar com o dono (D8):** este plano não depende dos dois anteriores (só dos números das migrações); se o dono quiser o CNPJ antes, ele pode partir de `planos-producao` — aí a migração continua `20261101000500` (fica depois das que ainda não existem, sem problema) e o pgTAP `84`. **Antes da Task 1, anote o SHA de partida** → **BASE**.

## Auto-revisão contra o código (06/10, antes da execução)

Varri `apps`, `packages`, `supabase` e `scripts` atrás de tudo que valida, formata, compara ou busca CNPJ (`grep -rni cnpj`, `\d{14}`, `length === 14`, `somenteDigitos`, inserts em `clientes`/`parceiros_unidades`). Resultado:
- **Banco:** só os dois `check` (`base.sql:41`, `cadastros_comerciais.sql:24`) e o `unique` (`clientes.cnpj`; `parceiros_unidades (cliente_id, cnpj)`). Nenhuma função, visão ou RPC compara ou formata CNPJ; `salvar_ficha_cliente` grava o que o painel manda (o painel normaliza). **Coberto pela Task 2.**
- **Quem grava CNPJ:** `clientes/acoes.ts:35,40` (`ClienteForm`), `cadastros-acoes.ts:40,41` (`UnidadeForm`), `salvar_ficha_cliente` (`lerFicha`). Nenhum caminho do trabalhador grava CNPJ. **Coberto pela Task 4.**
- **Campo que tinha ficado de fora:** `clientes/[id]/secao-dados-antiga.tsx:76` (CNPJ com `inputMode="numeric"`). **Acrescentado à Task 4 (item 8).**
- **Limpeza da pontuação:** a primeira versão tirava só `.`, `/`, `-`, travessões e espaços; agora tira tudo que não é `0–9A–Za–z`, igual a `cnpjLimpo` do painel (`formatos.ts:37`), para o painel e o core darem o mesmo resultado. **Mudança de comportamento só para entrada estranha:** o `validarCnpj` de hoje aceitava `"CNPJ 11.222.333/0001-81"` (as letras sumiam com `\D`); o novo recusa (sobram 18 caracteres). Nenhum teste nem tela manda isso (os testes antigos usam o número com ou sem máscara).
- **Buscas:** `buscarEmpresas` (assistente: `buscar_empresas` e `listar_demandas`) → Task 3; busca global e lista de clientes → Task 5. **Limitação que fica (fora do escopo):** o seletor `EscolherEmpresa` filtra pelo `detalhe` sem máscara (`nova-demanda-dados.ts:26`, `contatos/dados-contatos.ts:151`); digitar "12.ABC" ali não acha `12ABC34501DE35` — é o mesmo que já acontece hoje com "11.222" e um numérico. Listado na Entrega.
- **O que o agente vê:** `consultar_cadastro` do agente e do assistente usam `cnpjFormatado` → Task 6; `tarefa/ferramentas.ts:221` → Task 6; `pre-analise-nota.ts:18` → Task 6. O prompt só cita "CNPJ" como palavra; não muda.
- **Dados de teste e e2e:** os CNPJs fixos (`11222333000181`, `11222333000262`, `12345678000190`, `41000000000101`, `21448390000107`, e os `11222333000100 + i` de `test/apoio/cenario.ts:47`) são todos numéricos de 14 dígitos: passam no `check` novo; vários têm dígito errado, por isso o banco **não** confere o dígito (D3).
- **Cálculo:** conferido com `node` em 06/10: `12ABC34501DE35` válido; `11222333000181` e `19131243000197` válidos; `21448390000107` e `11222333000100` inválidos (dados de teste antigos).
- **Numéricos existentes:** a forma `^[0-9A-Z]{12}[0-9]{2}$` contém `^\d{14}$`; nenhum `update` em dados; a máscara numérica sai igual (`formatarCnpj` = `mascararCNPJ`).

## Escopo: 8 tasks

1. core: normalizar, validar, formatar e buscar (Task 1, **primeira**: tudo depende dela);
2. banco (Task 2) e repositório (Task 3);
3. painel: formulários, ficha e busca automática (Task 4); buscas e a unidade (Task 5);
4. trabalhador: o que o agente e o resumo mostram (Task 6), com um cenário com Claude de verdade (Task 7);
5. e2e e manual (Task 8).

**Fora do escopo:** CPF (continua só números); importação em massa de clientes (não existe hoje); mudar o layout do Bling; mudar `prompt.ts` (o agente lê o CNPJ como texto, com letras ou não, e o prompt não fala em "números do CNPJ").

## Decisões tomadas (sem o dono)

**"A confirmar com o dono"** = decisão de produto: o plano segue a proposta, e o dono pode trocar antes da task indicada.

| # | Decisão (o que o plano faz) | Alternativa | Por que não | Tasks |
|---|---|---|---|---|
| D1 | **Guardar sempre normalizado:** 14 caracteres, letras **maiúsculas**, sem pontuação (`12ABC34501DE35`), como os numéricos já são guardados (`11222333000181`). Quem digita minúscula, ponto, barra, hífen ou espaço tem tudo limpo na hora de salvar. | Guardar com máscara. | Quebraria a busca e o `unique` (o mesmo CNPJ com e sem máscara). | 1, 2, 4 |
| D2 | **Um cálculo só** (código ASCII − 48) para os dois tipos; `validarCnpj` continua com o mesmo nome e a mesma assinatura e dá o **mesmo resultado** para todo número (o teste antigo `packages/core/test/documentos.test.ts` não muda e passa). Recusa: tamanho errado, letra nas duas últimas posições, letra fora de `A–Z` (Ç, acento), os 14 iguais (`00000000000000`, `AAAAAAAAAAAA00`…). | — | — | 1 |
| D3 | **O banco confere só a forma** (`^[0-9A-Z]{12}[0-9]{2}$`), **não o dígito verificador**: o painel e o agente já conferem antes de gravar, e os dados de teste antigos (`contatoComEmpresas` gera `11222333000100 + i`, com dígito errado) quebrariam centenas de testes se o banco conferisse. `cnpj_valido(text)` existe para conferência (Entrega: o relatório de quantos CNPJs cadastrados têm dígito errado). **A confirmar com o dono:** passar a conferir o dígito também no banco depois (exige limpar os dados de teste). | `check (cnpj_valido(cnpj))`. | Ver ao lado. | 2 |
| D4 | **Campo de CNPJ aceita letras:** `inputMode="text"`, `autoCapitalize="characters"`, `maxLength={18}` (com a máscara), `spellCheck={false}`; o placeholder continua `00.000.000/0000-00` e o campo ganha a **ajuda** "Desde julho de 2026 o CNPJ pode ter letras (ex.: 12.ABC.345/01DE-35)." No celular, o teclado deixa de ser só numérico. **A confirmar com o dono:** o texto da ajuda. | Manter teclado numérico. | Ninguém conseguiria digitar a letra no celular. | 4 |
| D5 | **Busca automática pelo CNPJ (BrasilAPI):** o CNPJ alfanumérico vai à BrasilAPI do mesmo jeito (`/api/cnpj/v1/<14 caracteres>`); se ela responder 400/404 (ainda não conhece o formato, ou a empresa não existe), a ficha mostra a mensagem de hoje para "não encontrado" (preencher à mão). **Não foi possível confirmar** se a BrasilAPI já atende o formato novo (pesquisa de 06/10/2026 sem resposta clara); **a confirmar com o dono:** se ela não atender, trocar de serviço (`CONSULTA_CNPJ_URL` já permite) é decisão dele. A busca ao **sair do campo** passa a valer para os dois tipos (14 caracteres válidos). | Desligar a busca para o alfanumérico. | Quando a BrasilAPI passar a atender, funciona sem mudar nada. | 4 |
| D6 | **Bling:** o CSV continua com o CNPJ **sem máscara** na coluna "CPF/CNPJ Comprador", agora podendo ter letras (`12ABC34501DE35`). **A confirmar com o dono:** testar a importação de **um** CSV com CNPJ alfanumérico no Bling antes do primeiro cliente real com esse CNPJ (o Bling é obrigado a aceitar pela mesma regra; o plano não tem como testar o Bling). | Mandar com máscara. | Mudaria o arquivo de todos os pedidos numéricos, que o Bling já aceita. | 6 |
| D7 | **Busca por CNPJ:** o termo vira "o pedaço de CNPJ" (`termoCnpjDaBusca`: só `0–9A–Z`, maiúsculas, com pelo menos 3 caracteres e **pelo menos 1 dígito**). "12.ABC" acha `12ABC34501DE35`; "abc" sozinho não procura no CNPJ (procuraria em toda empresa com "ABC" no nome — já procura pelo nome). A função de dígitos (`digitos`) e `interpretarBusca` **não mudam** (o `busca.test.ts` usa `toEqual` no resultado). | Mudar `interpretarBusca`. | Teste antigo. | 1, 3, 5 |
| D8 | **Base da branch** (a confirmar com o dono): depois dos dois planos de produção; a migração `20261101000500` e o pgTAP `84` já ficam reservados para este plano. | — | — | todas |
| D9 | **Cenário com Claude de verdade:** um só, `cadastro: CNPJ alfanumérico da empresa em foco` — o contato pede o CNPJ da empresa dele, que é alfanumérico; o Thiago responde com `12.ABC.345/01DE-35` (com as letras certas) e sem abrir demanda. Custo ≈ US$ 0,05–0,15 por rodada; 3 rodadas seguidas para dizer que passou. **Teto: US$ 5** neste plano. | — | — | 7 |

## Restrições globais

- **Só mexer em:** `packages/core/src/{documentos,pre-analise-nota,index}.ts`, `packages/core/test/{cnpj-alfanumerico,pre-analise-nota-cnpj}.test.ts` (**novos**), `supabase/migrations/20261101000500_cnpj_alfanumerico.sql` e `supabase/tests/84_cnpj_alfanumerico.test.sql` (**novos**), `packages/db/src/repos.ts` (só `buscarEmpresas`), `packages/db/src/tipos.gen.ts` (regerado), `packages/db/test/cnpj.test.ts` (**novo**), `apps/painel/src/app/(painel)/clientes/{esquemas.ts,cadastros-esquemas.ts,acoes.ts,(lista)/page.tsx,ficha/ficha.ts,ficha/acoes.ts,ficha/ficha-cliente.tsx,ficha/blocos-empresa.tsx,novo/form-antigo.tsx,[id]/secao-parceiros.tsx,[id]/secao-dados-antiga.tsx}`, `apps/painel/src/app/api/busca/route.ts`, `apps/painel/src/lib/{busca,consultas-publicas}.ts`, testes **novos** do painel (`apps/painel/src/lib/cnpj-alfanumerico.test.ts`, `apps/painel/src/app/(painel)/clientes/ficha/ficha-cnpj.test.ts`), `apps/painel/e2e/cnpj-alfanumerico.spec.ts` (**novo**), `apps/trabalhador/src/agente/pedido-nota.ts` (só `cnpjFormatado`), `apps/trabalhador/src/tarefa/ferramentas.ts` (só a linha do `cnpj` em `consultar_cadastro`), `apps/trabalhador/test/agente/cnpj-alfanumerico.test.ts` (**novo**), `apps/trabalhador/src/cenarios/cenarios.ts` e `rodar.ts` (só o cenário novo e o campo opcional `cnpjEmpresa`), `docs/operacao.md`. **Nada em `prompt.ts`, nos retratos, em `packages/core/src/bling.ts`.**
- **Testes de partes anteriores não mudam:** nenhum pgTAP de `01` a `83`; nenhum `*.test.ts` existente (em especial `packages/core/test/documentos.test.ts`, `pre-analise-nota.test.ts`, `bling.test.ts`, `apps/painel/src/lib/busca.test.ts`, `formatos.test.ts`, os testes da ficha); nenhum e2e existente. Teste antigo quebrou → **pare** e avise.
- **Os CNPJs numéricos não mudam:** nenhum `update` em `clientes.cnpj` ou `parceiros_unidades.cnpj` na migração; a Entrega prova que um banco com os dados de antes passa pelo `check` novo.
- **O teste congelado `22_regressao_visibilidade.test.sql` 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio.
- **O pedido do Thiago não muda:** `git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__ apps/trabalhador/src/agente/prompt.ts` vazio.
- **Números novos:** migração `20261101000500`, pgTAP `84`. Antes de criar, `ls supabase/migrations | sort | tail -3` e `ls supabase/tests | sort | tail -3`; número igual ou maior de outra branch → **pare** e avise.

### Regras de ambiente (máquina com pouca memória)

- **Um Supabase local por vez, na máquina inteira**, pelo arquivo `C:\Users\Thiago\Desktop\PROJETO\AGENTESDEIA\.vez-supabase.txt`: (1) antes de ligar, leia; linha de **outra** worktree ou sessão → **não ligue**, espere, confira de novo, continuou → pare e avise; confira também `supabase status`; (2) livre → `echo "producao-cnpj producao-cnpj $(date '+%Y-%m-%d %H:%M')" > /c/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.vez-supabase.txt` e só então `supabase start`; (3) ao terminar ou parar: `supabase stop`, devolva `config.toml` e `.env`, apague o arquivo **só se** a linha for desta worktree; (4) nunca mexa no Supabase nem na linha de outra worktree.
- **Portas temporárias:** antes de ligar, `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`; em `config.toml`, `54321→56321`, `54322→56322`, `shadow_port 54320→56320`, `54329→56329`, `54323→56323`, `54324→56324`, `54327→56327`; no `.env`, `127.0.0.1:54321→127.0.0.1:56321` (`SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322→127.0.0.1:56322` (`DATABASE_URL`); **`supabase db reset` antes de cada suíte inteira**; ao terminar e antes de qualquer commit, devolva as cópias (`git status` sem `supabase/config.toml`).
- **`pnpm` em `~/bin`:** `export PATH="$HOME/bin:$PATH"`.
- **POUCA MEMÓRIA:** e2e em **lotes de até 2 arquivos**, `--workers=1`, **nunca** a suíte inteira; **antes de cada lote e de cada rodada de cenário**, `[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1)` no PowerShell — **abaixo de 4 GB não rode** (espere, feche o que for seu, confira; continuou → pare e avise); **processo morto** ("Target crashed", "worker process exited unexpectedly") → **pare**, devolva `config.toml`/`.env`, libere a vez e avise; um agente de cada vez; nunca ao mesmo tempo painel do dono, `next dev`, cenários e e2e.
- **Portas 3001 a 3010 são do dono.** E2e na 3100; capturas na **3107**.
- **Tudo só contra o banco local.** **Nunca rode nada contra a homologação; nunca use nem altere `.env.homologacao`.** Nenhum `supabase db push`, nem `--dry-run`. Nenhuma chamada à BrasilAPI de verdade nos testes (o `fetch` falso de `consultas-publicas.test.ts`; nos e2e, `CONSULTA_CNPJ_URL` aponta para o servidor falso que os e2e da ficha já usam — confira em `apps/painel/e2e` e use o mesmo).
- **Nenhum trabalhador é ligado nem desligado.** O da 3001 é do dono.
- **Antes de mudar texto ou `data-testid` usado em teste,** `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "CNPJ inválido", "CNPJ inválido: confira os números ou deixe em branco" (o teste de cadastros confere — **não** troque por "confira os caracteres"), "Buscar dados públicos da empresa", "Buscar por nome ou CNPJ", "CNPJ da unidade".
- **Nada de cor, tamanho ou espaçamento solto no JSX**; tokens e escala do Tailwind.
- **Tom (spec 4.6)**; termos: "CNPJ com letras" na ajuda; nunca "alfanumérico" na tela (palavra técnica).
- **Comentários no código:** português, uma linha, o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado.

## Foco da revisão

1. **CNPJ numérico antigo:** todo CNPJ válido de antes continua válido, com a mesma máscara, a mesma busca, o mesmo CSV, o mesmo texto do agente; os de dígito errado que já estão no banco continuam salvando (o banco não confere o dígito) — mas a ficha recusa **editar** a empresa sem corrigir o CNPJ, como hoje. Tasks 1, 2, 4.
2. **Digitação real:** minúscula (`12.abc.345/01de-35`), com espaços, colado de um PDF com `–` (travessão) ou `/` a mais, `O` (letra) no lugar de `0` (zero) → o certo é aceito normalizado; o `O` no lugar do zero dá dígito errado e é recusado com "CNPJ inválido" (não é corrigido sozinho). Task 1.
3. **Letra onde não pode:** letra nas duas últimas posições, `Ç`, acento, 13 ou 15 caracteres, os 14 iguais → recusado no painel e no banco (forma). Tasks 1, 2.
4. **O mesmo CNPJ duas vezes:** um cliente com `12abc34501de35` e outro com `12.ABC.345/01DE-35` → o segundo cai no "Já existe um cadastro igual" (o `unique` vale porque os dois são guardados iguais). Tasks 2, 4.
5. **Busca:** "12.ABC", "12abc", "ABC345", "01DE-35" acham; "abc" sozinho não procura no CNPJ; a busca numérica de antes ("11.222.333") continua achando. Tasks 1, 3, 5.
6. **O agente:** `consultar_cadastro` e o resumo do pedido de nota mostram `12.ABC.345/01DE-35`; o Thiago não "corrige" letra para número. Tasks 6, 7.

---

## Mapa de arquivos

`cl/…` = `apps/painel/src/app/(painel)/clientes/`.

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `packages/core/src/documentos.ts`, `packages/core/src/index.ts`, `packages/core/test/cnpj-alfanumerico.test.ts` (novo) | normalizar, validar, formatar, buscar | 1 |
| `supabase/migrations/20261101000500_cnpj_alfanumerico.sql`, `supabase/tests/84_cnpj_alfanumerico.test.sql` (novos), `tipos.gen.ts` | os dois `check` e `cnpj_valido` | 2 |
| `packages/db/src/repos.ts` (`buscarEmpresas`), `packages/db/test/cnpj.test.ts` (novo) | busca do assistente e do agente | 3 |
| `cl/esquemas.ts`, `cl/cadastros-esquemas.ts`, `cl/acoes.ts`, `cl/ficha/{ficha.ts,acoes.ts,ficha-cliente.tsx,blocos-empresa.tsx}`, `cl/novo/form-antigo.tsx`, `apps/painel/src/lib/consultas-publicas.ts`, `cl/ficha/ficha-cnpj.test.ts` (novo) | formulários, ficha, busca automática | 4 |
| `apps/painel/src/lib/busca.ts`, `apps/painel/src/app/api/busca/route.ts`, `cl/(lista)/page.tsx`, `cl/[id]/secao-parceiros.tsx`, `apps/painel/src/lib/cnpj-alfanumerico.test.ts` (novo) | buscas e a unidade | 5 |
| `apps/trabalhador/src/agente/pedido-nota.ts` (`cnpjFormatado`), `packages/core/src/pre-analise-nota.ts`, `apps/trabalhador/src/tarefa/ferramentas.ts`, `apps/trabalhador/test/agente/cnpj-alfanumerico.test.ts` (novo) | o que o agente, o resumo e a pré-análise mostram | 6 |
| `apps/trabalhador/src/cenarios/cenarios.ts`, `apps/trabalhador/src/cenarios/rodar.ts` | cenário com Claude de verdade | 7 |
| `apps/painel/e2e/cnpj-alfanumerico.spec.ts` (novo), `docs/operacao.md` | e2e e manual | 8 |

---

### Task 1: Core. Normalizar, validar, formatar e buscar o CNPJ com letras (D1, D2, D7)

**Files:**
- Modify: `packages/core/src/documentos.ts`, `packages/core/src/index.ts` (se ele não reexportar `documentos.ts` inteiro)
- Create: `packages/core/test/cnpj-alfanumerico.test.ts`

**Interfaces:**
- Produces:
  - `export function normalizarCnpj(entrada: string | null | undefined): string | null` — `null` se, depois de tirar `.`, `/`, `-`, `–`, espaços e passar para maiúsculas, não sobrar `^[0-9A-Z]{12}[0-9]{2}$`;
  - `export function validarCnpj(entrada: string): boolean` — mesma assinatura de hoje;
  - `export function formatarCnpj(entrada: string): string` — `"12.ABC.345/01DE-35"`; fora do padrão, devolve como veio (`trim`);
  - `export function termoCnpjDaBusca(termo: string): string | null` — só `0–9A–Z` em maiúsculas; `null` se tiver menos de 3 caracteres ou nenhum dígito.

- [ ] **Step 1: Escreva o teste que falha** — `packages/core/test/cnpj-alfanumerico.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatarCnpj, normalizarCnpj, termoCnpjDaBusca, validarCnpj } from '../src/documentos';

describe('normalizarCnpj (D1, Foco 2)', () => {
  it('maiúsculas, sem pontuação; números e letras', () => {
    expect(normalizarCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
    expect(normalizarCnpj(' 12 ABC 345 / 01DE – 35 ')).toBe('12ABC34501DE35');
    expect(normalizarCnpj('11.222.333/0001-81')).toBe('11222333000181');
  });
  it('forma errada: null', () => {
    expect(normalizarCnpj('12ABC34501DE3')).toBeNull();
    expect(normalizarCnpj('12ABC34501DE355')).toBeNull();
    expect(normalizarCnpj('12ABC34501DEA5')).toBeNull();     // letra no dígito verificador
    expect(normalizarCnpj('12ÇBC34501DE35')).toBeNull();
    expect(normalizarCnpj('')).toBeNull();
    expect(normalizarCnpj(null)).toBeNull();
  });
});

describe('validarCnpj (D2, Foco 1 e 3)', () => {
  it('o exemplo da Receita', () => {
    expect(validarCnpj('12.ABC.345/01DE-35')).toBe(true);
    expect(validarCnpj('12abc34501de35')).toBe(true);
    expect(validarCnpj('12ABC34501DE36')).toBe(false);
    expect(validarCnpj('12ABC34501DE53')).toBe(false);
  });
  it('os numéricos de antes dão o mesmo resultado', () => {
    for (const ok of ['11.222.333/0001-81', '11222333000181', '19131243000197']) expect(validarCnpj(ok)).toBe(true);
    for (const ruim of ['11222333000182', '11111111111111', '00000000000000', '11222333000100']) expect(validarCnpj(ruim)).toBe(false);
  });
  it('"O" (letra) no lugar do zero não é corrigido: dígito errado', () => {
    expect(validarCnpj('11.222.333/OOO1-81')).toBe(false);
  });
  it('14 iguais e forma errada', () => {
    expect(validarCnpj('AAAAAAAAAAAA00')).toBe(false);
    expect(validarCnpj('12ABC34501DE3')).toBe(false);
  });
});

describe('formatarCnpj', () => {
  it('máscara dos dois tipos; fora do padrão volta como veio', () => {
    expect(formatarCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatarCnpj(' 123 ')).toBe('123');
  });
});

describe('termoCnpjDaBusca (D7, Foco 5)', () => {
  it('pedaços de CNPJ', () => {
    expect(termoCnpjDaBusca('12.abc')).toBe('12ABC');
    expect(termoCnpjDaBusca('01DE-35')).toBe('01DE35');
    expect(termoCnpjDaBusca('11.222.333')).toBe('11222333');
  });
  it('sem dígito ou curto demais: não procura no CNPJ', () => {
    expect(termoCnpjDaBusca('abc')).toBeNull();
    expect(termoCnpjDaBusca('padaria')).toBeNull();
    expect(termoCnpjDaBusca('1a')).toBeNull();
  });
});
```

(Os três numéricos "ok" foram conferidos com o cálculo; `21448390000107`, usado como dado nos testes da I3b, tem dígito errado — por isso o banco não confere o dígito, D3.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/core exec vitest run test/cnpj-alfanumerico.test.ts`
Expected: FAIL (funções novas não existem; `validarCnpj('12.ABC.345/01DE-35')` é `false` hoje).

- [ ] **Step 3: Implemente** — `packages/core/src/documentos.ts` (depois de `somenteDigitos`; `validarCnpj` trocado):

```ts
/** CNPJ guardado: 14 caracteres, 12 letras maiúsculas ou números + 2 dígitos (IN RFB 2.229/2024, desde jul/2026). */
const FORMA_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;

/** Tira tudo que não é letra ou número (como `cnpjLimpo` do painel) e passa para maiúsculas; null se não tiver a forma de um CNPJ. */
export function normalizarCnpj(entrada: string | null | undefined): string | null {
  // Ç e acentos também saem; o que sobrar com 13 caracteres não tem a forma e é recusado.
  const c = (entrada ?? '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return FORMA_CNPJ.test(c) ? c : null;
}

/** Valor de cada posição: código ASCII − 48 ("0"–"9" = 0–9, "A" = 17 … "Z" = 42). Para números é o cálculo de sempre. */
const valor = (ch: string) => ch.charCodeAt(0) - 48;

export function validarCnpj(entrada: string): boolean {
  const c = normalizarCnpj(entrada);
  // Os 12 primeiros iguais (00000000000000, 11111111111111, AAAAAAAAAAAA00…) são recusados, como antes os 14 iguais.
  if (!c || /^(.)\1{11}/.test(c)) return false;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((s, ch, i) => s + valor(ch) * pesos[i]!, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = digito(c.slice(0, 12));
  const d2 = digito(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}
```

(Para os numéricos o resultado é o de antes: com os 12 primeiros iguais, só os 14 iguais podiam passar no cálculo, e eles já eram recusados.)

```ts
/** "12ABC34501DE35" → "12.ABC.345/01DE-35"; fora do padrão volta como veio. Igual a mascararCNPJ do painel. */
export function formatarCnpj(entrada: string): string {
  const c = normalizarCnpj(entrada);
  if (!c) return entrada.trim();
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

/** D7: o pedaço de CNPJ de uma busca ("12.abc" → "12ABC"); null sem dígito ou com menos de 3 (fica só a busca pelo nome). */
export function termoCnpjDaBusca(termo: string): string | null {
  const t = termo.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  return t.length >= 3 && /\d/.test(t) ? t : null;
}
```

Confira que `packages/core/src/index.ts` exporta os nomes novos (se ele faz `export * from './documentos'`, nada a fazer).

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/core test && pnpm --filter @escritorio/core typecheck`
Expected: PASS, inclusive `documentos.test.ts` **sem mudança**.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/documentos.ts packages/core/src/index.ts packages/core/test/cnpj-alfanumerico.test.ts
git commit -m "feat(core): CNPJ com letras — normalizar, validar (mesmo cálculo para os numéricos), formatar e buscar (cnpj, D1, D2, D7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banco. Os dois `check` aceitam letras; `cnpj_valido` para conferência (D1, D3)

**Files:**
- Create: `supabase/migrations/20261101000500_cnpj_alfanumerico.sql`, `supabase/tests/84_cnpj_alfanumerico.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado; confira que não muda nada além da função nova)

**Interfaces:**
- Produces: `clientes.cnpj` e `parceiros_unidades.cnpj` com `check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$')`; `public.cnpj_valido(p text) returns boolean` (`immutable`, `security invoker`; executável por `authenticated` e `service_role`).

- [ ] **Step 1: Escreva o teste que falha** — `supabase/tests/84_cnpj_alfanumerico.test.sql`:

```sql
-- Plano do CNPJ alfanumérico, Task 2 (D1, D3; Foco 1, 3, 4).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- 1–4: clientes
select lives_ok($$ insert into public.clientes (razao_social, cnpj) values ('Numérica', '11222333000181') $$, 'numérico continua');
select lives_ok($$ insert into public.clientes (razao_social, cnpj) values ('Com letras', '12ABC34501DE35') $$, 'com letras entra');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('Minúscula', '12abc34501de36') $$, '23514', null, 'minúscula: recusada (o painel normaliza antes)');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('Mesma', '12ABC34501DE35') $$, '23505', null, 'o mesmo CNPJ com letras duas vezes: unique');
-- 5–7: forma errada
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('DV letra', '12ABC34501DEA5') $$, '23514', null, 'letra no dígito verificador');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('Pontuada', '12.ABC.345/01DE-35') $$, '23514', null, 'com máscara: recusada');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('Curta', '12ABC34501DE3') $$, '23514', null, '13 caracteres');
-- 8–9: parceiros_unidades (vazio continua permitido)
insert into public.parceiros_grupos (id, cliente_id, tipo, nome) values
  ('fb000000-0000-0000-0000-00000000000a', (select id from public.clientes where cnpj = '12ABC34501DE35'), 'cliente', 'Rede Letras');
select lives_ok($$ insert into public.parceiros_unidades (grupo_id, cliente_id, nome_unidade, cnpj) values
  ('fb000000-0000-0000-0000-00000000000a', (select id from public.clientes where cnpj = '12ABC34501DE35'), 'Loja 1', '12ABC34501DE35') $$, 'unidade com letras');
select throws_ok($$ insert into public.parceiros_unidades (grupo_id, cliente_id, nome_unidade, cnpj) values
  ('fb000000-0000-0000-0000-00000000000a', (select id from public.clientes where cnpj = '12ABC34501DE35'), 'Loja 2', '12abc34501de35') $$, '23514', null, 'unidade minúscula: recusada');
-- 10–13: cnpj_valido (D3: conferência, não trava)
select is(public.cnpj_valido('12ABC34501DE35'), true, 'exemplo da Receita');
select is(public.cnpj_valido('11222333000181'), true, 'numérico válido');
select is(public.cnpj_valido('11222333000100'), false, 'numérico com dígito errado (dado de teste antigo)');
select lives_ok($$ insert into public.clientes (razao_social, cnpj) values ('DV errado antigo', '11222333000100') $$, 'o banco não confere o dígito (D3)');

select * from finish();
rollback;
```

(Confira as colunas obrigatórias de `parceiros_grupos` e `parceiros_unidades` em `20260928000500_cadastros_comerciais.sql`; acrescente as que faltarem sem mudar o que cada teste confere.)

- [ ] **Step 2: Rode e veja falhar** (Supabase local com a vez reservada)

Run: `supabase test db` → `84` FAIL (o `check` antigo recusa letras; `cnpj_valido` não existe).

- [ ] **Step 3: Implemente** — `supabase/migrations/20261101000500_cnpj_alfanumerico.sql`:

```sql
-- supabase/migrations/20261101000500_cnpj_alfanumerico.sql
-- CNPJ com letras (IN RFB 2.229/2024, desde jul/2026): 12 letras maiúsculas ou números + 2 dígitos.
-- Todo CNPJ numérico já cadastrado tem essa forma: nenhum dado muda. O banco confere a forma; o dígito, o painel e o agente (D3).

-- Os checks antigos foram criados sem nome (na coluna): acha pelo texto e troca.
do $$
declare r record;
begin
  for r in
    select c.conrelid::regclass as tabela, c.conname
      from pg_constraint c
     where c.contype = 'c' and c.conrelid in ('public.clientes'::regclass, 'public.parceiros_unidades'::regclass)
       and pg_get_constraintdef(c.oid) like '%cnpj ~%'
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
end $$;
alter table public.clientes add constraint clientes_cnpj_forma check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$');
alter table public.parceiros_unidades add constraint parceiros_unidades_cnpj_forma check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$');

-- Conferência do dígito (o mesmo cálculo do core: código ASCII − 48). Para relatório, não para trava.
create function public.cnpj_valido(p text) returns boolean
language plpgsql immutable set search_path = '' as $$
declare s int; r int; d1 int; d2 int; i int;
  p1 int[] := array[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  p2 int[] := array[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
begin
  if p is null or p !~ '^[0-9A-Z]{12}[0-9]{2}$' or substr(p, 1, 12) ~ '^(.)\1{11}$' then return false; end if;
  s := 0;
  for i in 1..12 loop s := s + (ascii(substr(p, i, 1)) - 48) * p1[i]; end loop;
  r := s % 11; d1 := case when r < 2 then 0 else 11 - r end;
  s := 0;
  for i in 1..12 loop s := s + (ascii(substr(p, i, 1)) - 48) * p2[i]; end loop;
  s := s + d1 * p2[13];
  r := s % 11; d2 := case when r < 2 then 0 else 11 - r end;
  return substr(p, 13, 2) = d1::text || d2::text;
end $$;
grant execute on function public.cnpj_valido(text) to authenticated, service_role;
```

**Antes de commitar**, confira que o `do` achou e apagou **exatamente dois** `check`: `select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid in ('public.clientes'::regclass, 'public.parceiros_unidades'::regclass) and contype = 'c';` no banco local depois do `db reset` — devem aparecer só `clientes_cnpj_forma` e `parceiros_unidades_cnpj_forma` com `cnpj` (e os outros `check` dessas tabelas que não falam de `cnpj`, intactos).

`pnpm db:tipos`.

- [ ] **Step 4: Rode**

Run: `supabase db reset && supabase test db`
Expected: tudo passa; `84` 13/13; `22` 100/100.

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`)

```bash
git add supabase/migrations/20261101000500_cnpj_alfanumerico.sql supabase/tests/84_cnpj_alfanumerico.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): CNPJ com letras em clientes e unidades, sem mudar os numéricos; cnpj_valido para conferência (cnpj, D1, D3)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Repositório. A busca de empresas acha o CNPJ com letras (D7)

**Files:**
- Modify: `packages/db/src/repos.ts` (`buscarEmpresas`, linhas ~807-819)
- Create: `packages/db/test/cnpj.test.ts`

**Interfaces:**
- Consumes: `termoCnpjDaBusca` (Task 1).
- Produces: `buscarEmpresas(texto)` com o mesmo retorno de hoje.

- [ ] **Step 1: Escreva o teste que falha** — `packages/db/test/cnpj.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

beforeEach(async () => {
  await limparBanco();
  await db.from('clientes').insert([
    { razao_social: 'Letras Comércio LTDA', cnpj: '12ABC34501DE35' },
    { razao_social: 'Números Indústria LTDA', cnpj: '11222333000181' },
  ]);
});

describe('buscarEmpresas com CNPJ (D7, Foco 5)', () => {
  it('pedaços do CNPJ com letras, com ou sem máscara, em minúscula', async () => {
    for (const t of ['12.abc', '12ABC345', '01DE-35']) expect((await repos.buscarEmpresas(t)).map((e) => e.cnpj)).toEqual(['12ABC34501DE35']);
  });
  it('o numérico de antes continua', async () => {
    expect((await repos.buscarEmpresas('11.222.333')).map((e) => e.cnpj)).toEqual(['11222333000181']);
  });
  it('só letras procura pelo nome, não no CNPJ', async () => {
    expect((await repos.buscarEmpresas('abc')).map((e) => e.cnpj)).toEqual([]);
    expect((await repos.buscarEmpresas('letras')).map((e) => e.cnpj)).toEqual(['12ABC34501DE35']);
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/db exec vitest run test/cnpj.test.ts`
Expected: FAIL ("12.abc" vira "12" pelos dígitos e não acha o resto; "01DE-35" vira "0135").

- [ ] **Step 3: Implemente** — em `buscarEmpresas`, troque a montagem dos filtros:

```ts
      const limpo = texto.replace(/[,()*%"\\]/g, ' ').trim();
      if (!limpo) return [];
      // Plano do CNPJ (D7): o pedaço de CNPJ com letras e números, em maiúsculas (como o banco guarda).
      const doc = termoCnpjDaBusca(limpo);
      const filtros = [`razao_social.ilike.%${limpo}%`, `nome_fantasia.ilike.%${limpo}%`, ...(doc ? [`cnpj.like.%${doc}%`] : [])];
```

(a variável `digitos` sai se não for usada em mais nada da função; importe `termoCnpjDaBusca` de `@escritorio/core`, junto dos outros nomes da linha 1. O ramo "sem acento" logo abaixo continua igual.)

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/trabalhador exec vitest run test/assistente`
Expected: PASS (os testes do assistente que buscam empresa por CNPJ numérico sem mudança).

- [ ] **Step 5: Commit** (devolva `config.toml` e `.env`)

```bash
git add packages/db/src/repos.ts packages/db/test/cnpj.test.ts
git commit -m "feat(db): busca de empresas acha o CNPJ com letras (cnpj, D7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Painel. Formulários, ficha do cliente e a busca automática (D1, D4, D5)

**Files:**
- Modify: `apps/painel/src/app/(painel)/clientes/esquemas.ts`, `.../clientes/cadastros-esquemas.ts`, `.../clientes/acoes.ts` (só se `dados.cnpj` vier de outro lugar que não `ClienteForm`), `.../clientes/ficha/ficha.ts`, `.../clientes/ficha/acoes.ts`, `.../clientes/ficha/ficha-cliente.tsx`, `.../clientes/ficha/blocos-empresa.tsx`, `.../clientes/novo/form-antigo.tsx`, `.../clientes/[id]/secao-dados-antiga.tsx`, `apps/painel/src/lib/consultas-publicas.ts`
- Create: `apps/painel/src/app/(painel)/clientes/ficha/ficha-cnpj.test.ts`

**Interfaces:**
- Consumes: `normalizarCnpj`, `validarCnpj` (Task 1).
- Produces: `export const AJUDA_CNPJ = 'Desde julho de 2026 o CNPJ pode ter letras (ex.: 12.ABC.345/01DE-35).'` em `ficha/blocos-empresa.tsx` (ou num arquivo de textos da ficha, se existir).

- [ ] **Step 1: Escreva o teste que falha** — `apps/painel/src/app/(painel)/clientes/ficha/ficha-cnpj.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { consultarCnpj } from '@/lib/consultas-publicas';
import { ClienteForm } from '../esquemas';
import { UnidadeForm } from '../cadastros-esquemas';
import { lerFicha } from './ficha';

const ficha = (cnpj: string) => { const f = new FormData(); f.set('razao_social', 'Letras Comércio LTDA'); f.set('cnpj', cnpj); return f; };

describe('CNPJ com letras nos formulários (D1, Foco 1, 2, 4)', () => {
  it('ficha: normaliza e aceita; o numérico continua; inválido recusa com o texto de sempre', () => {
    const ok = lerFicha(ficha('12.abc.345/01de-35'), { admin: true });
    expect(ok.erros?.cnpj).toBeUndefined();
    expect((ok as { dados: { cnpj: string } }).dados.cnpj).toBe('12ABC34501DE35');
    expect((lerFicha(ficha('11.222.333/0001-81'), { admin: true }) as { dados: { cnpj: string } }).dados.cnpj).toBe('11222333000181');
    expect(lerFicha(ficha('12ABC34501DE36'), { admin: true }).erros?.cnpj).toBe('CNPJ inválido');
  });
  it('cadastro antigo e unidade', () => {
    expect(ClienteForm.parse({ razao_social: 'Letras', cnpj: '12.ABC.345/01DE-35' }).cnpj).toBe('12ABC34501DE35');
    expect(UnidadeForm.parse({ nome_unidade: 'Loja 1', cnpj: '12abc34501de35', palavras_chave: '' }).cnpj).toBe('12ABC34501DE35');
    expect(() => UnidadeForm.parse({ nome_unidade: 'Loja 1', cnpj: '12ABC34501DE36', palavras_chave: '' })).toThrow('CNPJ inválido: confira os números ou deixe em branco');
  });
  it('busca automática manda o CNPJ com letras e "não encontrado" quando a BrasilAPI não conhece (D5)', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('{}', { status: 400 }));
    expect(await consultarCnpj('12.ABC.345/01DE-35', buscar as never)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(String(buscar.mock.calls[0]![0])).toMatch(/\/12ABC34501DE35$/);
  });
});
```

(Confira a forma real do que `lerFicha` devolve — `LeituraFicha` em `ficha.ts` — e a lista de campos obrigatórios de `UnidadeForm`/`ClienteForm`; ajuste **só** o acesso ao resultado e os campos mínimos, sem mudar o que cada caso confere.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/clientes/ficha/ficha-cnpj.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implemente**
1. `clientes/esquemas.ts`: `cnpj: z.string().transform((c) => normalizarCnpj(c) ?? c.trim()).refine(validarCnpj, 'CNPJ inválido'),` (importe `normalizarCnpj`; `somenteDigitos` continua importado se `ContatoForm` ou outro campo usar).
2. `clientes/cadastros-esquemas.ts`, `UnidadeForm.cnpj`: `z.preprocess((v) => (v ? normalizarCnpj(String(v)) ?? String(v).trim() : null), z.string().nullable().refine((c) => c === null || validarCnpj(c), 'CNPJ inválido: confira os números ou deixe em branco'))`.
3. `clientes/ficha/ficha.ts`, em `lerFicha`: `const cnpj = normalizarCnpj(t('cnpj')) ?? t('cnpj');` (o resto igual: `validarCnpj(cnpj)` decide o erro, e o `p_dados.cnpj` leva o normalizado).
4. `clientes/ficha/acoes.ts`, `buscarCnpj`: `const numero = normalizarCnpj(cnpj); if (!numero || !validarCnpj(numero)) return { ok: false, motivo: 'invalido' };`.
5. `lib/consultas-publicas.ts`, `consultarCnpj`: `const numero = normalizarCnpj(cnpj); if (!numero) return { ok: false, motivo: 'nao_encontrado' };` (importe de `@escritorio/core`).
6. `clientes/ficha/ficha-cliente.tsx`: um ajudante `const cnpjDoCampo = () => { const el = form()?.elements.namedItem('cnpj'); return el instanceof HTMLInputElement ? normalizarCnpj(el.value) ?? '' : ''; };` e troque `digitos('cnpj')` por `cnpjDoCampo()` nas linhas 97 e 137 (`n.length === 14` continua valendo: o normalizado tem 14).
7. `clientes/ficha/blocos-empresa.tsx`, o `CampoComLupa` do CNPJ: `inputMode="text" autoCapitalize="characters" spellCheck={false} maxLength={18}` (o resto igual) e o `FormField` ganha `ajuda={AJUDA_CNPJ}`. A máscara inicial `mascararCNPJ(c.cnpj)` já entende letras.
8. `clientes/novo/form-antigo.tsx:33` e `clientes/[id]/secao-dados-antiga.tsx:76`: o `Input name="cnpj"` com os mesmos atributos do item 7 (os dois salvam por `salvarCliente` → `ClienteForm`, que já normaliza pelo item 1); no `secao-dados-antiga.tsx`, `defaultValue={mascararCNPJ(c.cnpj)}`.
9. `clientes/acoes.ts:44`: confira que `dados.cnpj` vem de `ClienteForm` (já normalizado); se vier de outro lugar, normalize antes da consulta do arquivado.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: PASS, inclusive os testes antigos da ficha (`ficha.test.ts`, `acoes.test.ts`), de `consultas-publicas.test.ts` e de `cadastros`.

- [ ] **Step 5: Commit**

```bash
git add "apps/painel/src/app/(painel)/clientes/esquemas.ts" "apps/painel/src/app/(painel)/clientes/cadastros-esquemas.ts" "apps/painel/src/app/(painel)/clientes/acoes.ts" "apps/painel/src/app/(painel)/clientes/ficha/ficha.ts" "apps/painel/src/app/(painel)/clientes/ficha/acoes.ts" "apps/painel/src/app/(painel)/clientes/ficha/ficha-cliente.tsx" "apps/painel/src/app/(painel)/clientes/ficha/blocos-empresa.tsx" "apps/painel/src/app/(painel)/clientes/novo/form-antigo.tsx" "apps/painel/src/app/(painel)/clientes/[id]/secao-dados-antiga.tsx" apps/painel/src/lib/consultas-publicas.ts "apps/painel/src/app/(painel)/clientes/ficha/ficha-cnpj.test.ts"
git commit -m "feat(painel): ficha, cadastro e unidade aceitam CNPJ com letras; busca automática manda o CNPJ inteiro (cnpj, D1, D4, D5)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Tire do `git add` o `clientes/acoes.ts` se ele não mudou.)

---

### Task 5: Painel. Buscas por CNPJ e a unidade com máscara (D7)

**Files:**
- Modify: `apps/painel/src/lib/busca.ts` (só um acréscimo), `apps/painel/src/app/api/busca/route.ts`, `apps/painel/src/app/(painel)/clientes/(lista)/page.tsx`, `apps/painel/src/app/(painel)/clientes/[id]/secao-parceiros.tsx`
- Create: `apps/painel/src/lib/cnpj-alfanumerico.test.ts`

**Interfaces:**
- Consumes: `termoCnpjDaBusca`, `formatarCnpj` (Task 1); `mascararCNPJ` (painel, já pronto).
- Produces: `export function filtroCnpj(termo: string): string | null` em `lib/busca.ts` → `"cnpj.ilike.%<doc>%"` ou `null`.

- [ ] **Step 1: Escreva o teste que falha** — `apps/painel/src/lib/cnpj-alfanumerico.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { filtroCnpj, interpretarBusca, itemEmpresa } from './busca';

describe('busca por CNPJ com letras (D7, Foco 5)', () => {
  it('o filtro do CNPJ', () => {
    expect(filtroCnpj('12.abc')).toBe('cnpj.ilike.%12ABC%');
    expect(filtroCnpj('11.222.333')).toBe('cnpj.ilike.%11222333%');
    expect(filtroCnpj('padaria')).toBeNull();
  });
  it('interpretarBusca não muda (teste antigo usa toEqual)', () => {
    expect(interpretarBusca('ab')).toEqual({ termo: 'ab', digitos: '', numero: null });
  });
  it('o item da empresa mostra a máscara com letras', () => {
    expect(itemEmpresa({ id: 'x', razao_social: 'Letras', nome_fantasia: null, cnpj: '12ABC34501DE35' }).detalhe).toBe('CNPJ 12.ABC.345/01DE-35');
  });
});
```

(Confira a assinatura de `itemEmpresa` em `busca.ts:60-70` e ajuste o objeto do terceiro caso ao tipo `EmpresaLinha`.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/cnpj-alfanumerico.test.ts`
Expected: FAIL (`filtroCnpj` não existe).

- [ ] **Step 3: Implemente**
1. `lib/busca.ts`, depois de `interpretarBusca`:

```ts
/** Plano do CNPJ (D7): o filtro `or` do CNPJ com letras e números; null sem um pedaço de CNPJ (fica só o nome). */
export function filtroCnpj(termo: string): string | null {
  const doc = termoCnpjDaBusca(termo);
  return doc ? `cnpj.ilike.%${doc}%` : null;
}
```

2. `api/busca/route.ts:18`: `.or([`razao_social.ilike.%${termo}%`, `nome_fantasia.ilike.%${termo}%`, filtroCnpj(termo)].filter(Boolean).join(','))` (a busca de contatos, na linha 21, continua com `digitos`).
3. `clientes/(lista)/page.tsx:43`: `if (q) r = r.or([`razao_social.ilike.%${q}%`, `nome_fantasia.ilike.%${q}%`, filtroCnpj(q)].filter(Boolean).join(','));` — **atenção:** hoje, sem dígitos, o CNPJ era procurado com o texto inteiro (`|| q`); com `filtroCnpj`, "abc" não procura no CNPJ. Confira o e2e da lista de clientes (`grep -rn "Buscar por nome ou CNPJ" apps/painel/e2e`): se algum procura CNPJ só com letras, **pare** e avise.
4. `clientes/[id]/secao-parceiros.tsx:87`: `` {un.cnpj ? ` · CNPJ ${mascararCNPJ(un.cnpj)}` : ''} `` (importe de `@/lib/formatos`); o `Input` da linha 35: `defaultValue={un?.cnpj ? mascararCNPJ(un.cnpj) : ''}`, `inputMode="text" autoCapitalize="characters" spellCheck={false} maxLength={18}`.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: PASS, inclusive `busca.test.ts` sem mudança.

- [ ] **Step 5: Commit**

```bash
git add apps/painel/src/lib/busca.ts apps/painel/src/app/api/busca/route.ts "apps/painel/src/app/(painel)/clientes/(lista)/page.tsx" "apps/painel/src/app/(painel)/clientes/[id]/secao-parceiros.tsx" apps/painel/src/lib/cnpj-alfanumerico.test.ts
git commit -m "feat(painel): busca global e lista de clientes acham CNPJ com letras; unidade com máscara (cnpj, D7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Trabalhador e core. O que o agente, o resumo e a pré-análise mostram (D6)

**Files:**
- Modify: `apps/trabalhador/src/agente/pedido-nota.ts` (só `cnpjFormatado`), `packages/core/src/pre-analise-nota.ts` (só a função `cnpj` da linha 18), `apps/trabalhador/src/tarefa/ferramentas.ts` (só a linha do `cnpj` em `consultar_cadastro`)
- Create: `apps/trabalhador/test/agente/cnpj-alfanumerico.test.ts`

**Interfaces:**
- Consumes: `formatarCnpj` (Task 1).
- Produces: `cnpjFormatado(c)` = `formatarCnpj(c)` (mesmo nome e assinatura).

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/agente/cnpj-alfanumerico.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cnpjFormatado } from '../../src/agente/pedido-nota';

describe('CNPJ com letras no que o agente mostra (Foco 6)', () => {
  it('cnpjFormatado: com letras e o numérico de antes', () => {
    expect(cnpjFormatado('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
    expect(cnpjFormatado('11222333000181')).toBe('11.222.333/0001-81');
  });
});
```

e um arquivo **novo** `packages/core/test/pre-analise-nota-cnpj.test.ts` com um caso: copie de `packages/core/test/pre-analise-nota.test.ts` a montagem de um pedido com comprador cadastrado (a mesma função e os mesmos dados), troque o `cnpj` do comprador por `12ABC34501DE35` e espere a linha `Destinatário: <nome> · CNPJ 12.ABC.345/01DE-35.` (hoje a função tira as letras com `\D` e a máscara não casa).

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/cnpj-alfanumerico.test.ts`
Expected: FAIL (`cnpjFormatado('12ABC34501DE35')` devolve o texto sem máscara; a pré-análise tira as letras com `\D`).

- [ ] **Step 3: Implemente**
1. `agente/pedido-nota.ts:26`: `export const cnpjFormatado = (c: string) => formatarCnpj(c);` com `import { formatarCnpj } from '@escritorio/core';` (junte ao `import` do core que o arquivo já tem).
2. `packages/core/src/pre-analise-nota.ts:18`: `const cnpj = (c: string) => formatarCnpj(c);` (importe de `./documentos`).
3. `tarefa/ferramentas.ts:221`: `cnpj: formatarCnpj(x.cnpj),`.
4. **Bling (D6): nada muda** — `packages/core/src/bling.ts` leva `u?.cnpj` como está (sem máscara); confira com `bling.test.ts` que continua passando.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/core test && pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS, inclusive `retrato-thiago` (as `description` não mudaram), `pedido-nota.test.ts` e `pre-analise-nota.test.ts` (os numéricos dão a mesma máscara).

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/agente/pedido-nota.ts packages/core/src/pre-analise-nota.ts apps/trabalhador/src/tarefa/ferramentas.ts apps/trabalhador/test/agente/cnpj-alfanumerico.test.ts packages/core/test/pre-analise-nota-cnpj.test.ts
git commit -m "feat(agente): resumo do pedido, consultar_cadastro e pré-análise mostram o CNPJ com letras (cnpj, D6)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(O caso da pré-análise vai num arquivo **novo** `packages/core/test/pre-analise-nota-cnpj.test.ts`, para não mexer no teste antigo.)

---

### Task 7: Cenário com Claude de verdade: "CNPJ com letras da empresa em foco" (D9)

**Files:**
- Modify: `apps/trabalhador/src/cenarios/cenarios.ts` (o cenário novo e o campo opcional `cnpjEmpresa` no tipo `Cenario`), `apps/trabalhador/src/cenarios/rodar.ts` (em `preparar`, aplica `cnpjEmpresa`)

**Interfaces:**
- Consumes: o executor de cenários de hoje (`preparar`, `rodar`, `espera.respostaContem`, `espera.chamadoSetor`, `espera.ferramentas`).
- Produces: o cenário `cadastro: CNPJ alfanumérico da empresa em foco`.

- [ ] **Step 1: O campo** — no tipo `Cenario` de `cenarios.ts`, `cnpjEmpresa?: string` ("CNPJ da primeira empresa, guardado como o banco guarda"). Em `rodar.ts`, `preparar`, logo depois de `contatoComEmpresas`: `if (c.cnpjEmpresa) await db.from('clientes').update({ cnpj: c.cnpjEmpresa }).eq('id', empresas[0]!.id);`.

- [ ] **Step 2: O cenário** — no fim de `CENARIOS`:

```ts
  {
    // Plano do CNPJ (D9): empresa aberta depois de jul/2026, com letras no CNPJ; o Thiago informa sem trocar letra por número.
    nome: 'cadastro: CNPJ alfanumérico da empresa em foco',
    empresas: ['Letras Comércio LTDA'],
    cnpjEmpresa: '12ABC34501DE35',
    mensagens: ['Oi! Me passa o CNPJ da nossa empresa, por favor? Preciso pra um cadastro no fornecedor.'],
    espera: { ferramentas: ['consultar_cadastro'], respostaContem: ['12.ABC.345/01DE-35'], chamadoSetor: 'nenhum' },
  },
```

(Confira os nomes reais dos campos em `Cenario`/`espera` — `respostaContem`, `ferramentas`, `chamadoSetor` existem em `rodar.ts:160-185` — e se a empresa precisa de `empresaEmFoco: 0` para o Thiago não perguntar qual empresa; copie a forma de um cenário de `consultar_cadastro` existente: `grep -n "consultar_cadastro" apps/trabalhador/src/cenarios/cenarios.ts`.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/trabalhador test`
Expected: limpo.

- [ ] **Step 4: Rode o cenário 3 vezes seguidas com Claude de verdade** (Supabase local com a vez reservada; `supabase db reset` antes de cada; memória ≥ 4 GB):

Run: `pnpm --filter @escritorio/trabalhador cenarios "CNPJ alfanumérico"` (3 vezes)
Expected: 1/1 nas três. Anote o custo de cada uma (`select round(sum(custo_usd), 4) from uso_ia`). Falhou por **trocar letra por número** ou **sem máscara** → olhe o resultado de `consultar_cadastro` na decisão: se a ferramenta devolveu certo e o modelo escreveu errado, é comportamento (pendência, sem mexer no prompt); se a ferramenta devolveu errado, é defeito (volte à Task 6). Teto D9.

- [ ] **Step 5: Devolva `config.toml` e `.env`, libere a vez; commit**

```bash
git add apps/trabalhador/src/cenarios/cenarios.ts apps/trabalhador/src/cenarios/rodar.ts
git commit -m "test(cenarios): o Thiago informa o CNPJ com letras da empresa em foco, com Claude de verdade (cnpj, D9)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: E2e e manual

**Files:**
- Create: `apps/painel/e2e/cnpj-alfanumerico.spec.ts`
- Modify: `docs/operacao.md`

- [ ] **Step 1: `apps/painel/e2e/cnpj-alfanumerico.spec.ts`** — com os ajudantes dos e2e da ficha (`grep -ln "ficha-cnpj\|Buscar dados públicos" apps/painel/e2e` mostra quais; use o mesmo servidor falso de busca pública que eles usam, nunca a BrasilAPI de verdade):
  1. **ficha nova com letras:** quem edita clientes abre "Novo cliente", digita `12.abc.345/01de-35` no CNPJ (o campo aceita letras), razão social "Letras Comércio LTDA", salva → `clientes.cnpj = '12ABC34501DE35'`; a ficha mostra `12.ABC.345/01DE-35`; a ajuda "Desde julho de 2026 o CNPJ pode ter letras" aparece;
  2. **dígito errado:** `12.ABC.345/01DE-36` → "CNPJ inválido" no campo, nada salvo;
  3. **o mesmo CNPJ de novo:** outra empresa com `12ABC34501DE35` → o aviso de cadastro repetido de hoje;
  4. **numérico de antes:** uma empresa com `11.222.333/0001-81` continua salvando e aparecendo igual;
  5. **busca global:** `12.ABC` → a empresa nova na lista, com `CNPJ 12.ABC.345/01DE-35`; `11.222.333` → a numérica;
  6. **unidade:** em "Clientes e fornecedores" da empresa, uma unidade com CNPJ `12abc34501de35` → salva e mostra `CNPJ 12.ABC.345/01DE-35`;
  7. axe sem violações na ficha.
- [ ] **Step 2: Rode em lotes de até 2** (Supabase local com a vez reservada; `supabase db reset`; memória ≥ 4 GB antes de cada lote; `--workers=1`):

```bash
cd apps/painel
pnpm exec playwright test e2e/cnpj-alfanumerico.spec.ts e2e/cadastros.spec.ts --workers=1
pnpm exec playwright test e2e/ficha-dados.spec.ts e2e/busca-global.spec.ts --workers=1
```

(Troque os nomes do segundo lote pelos e2e reais da ficha e da busca: `ls apps/painel/e2e | grep -i "ficha\|busca\|clientes"`; rode **todos** os que aparecerem, de 2 em 2.) Expected: PASS; os antigos sem mudança.

- [ ] **Step 3: `docs/operacao.md`** — um parágrafo em §3 (Dia a dia), "CNPJ com letras": desde julho de 2026 a Receita dá CNPJ com letras às empresas novas (ex.: 12.ABC.345/01DE-35); pode digitar com ou sem pontos, em maiúsculas ou minúsculas; o sistema guarda e mostra do jeito certo; a busca automática pelo CNPJ pode não achar empresas com letras enquanto o serviço público não atender (preencha à mão — D5); **antes do primeiro pedido de nota de um cliente com CNPJ com letras, importe um CSV de teste no Bling** (D6).
- [ ] **Step 4: Devolva `config.toml` e `.env`, libere a vez; commit**

```bash
git add apps/painel/e2e/cnpj-alfanumerico.spec.ts docs/operacao.md
git commit -m "test(e2e): CNPJ com letras na ficha, na unidade e na busca, e o numérico de antes; manual (cnpj)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx, **a vez reservada em `.vez-supabase.txt`**, `supabase db reset` antes da suíte pgTAP, antes do primeiro lote de e2e e antes de cada rodada de cenários:
   - **o que não podia mudar não mudou:** `git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__ apps/trabalhador/src/agente/prompt.ts packages/core/src/bling.ts` vazio; `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff BASE --stat -- supabase/tests supabase/migrations` = só `84` e `20261101000500` (novos); `git diff BASE --stat -- 'apps/**/*.test.ts' 'packages/**/*.test.ts' apps/painel/e2e` = só **novos**;
   - **os numéricos de antes passam pelo `check` novo:** num banco local com a migração aplicada, `select count(*) from clientes where cnpj !~ '^[0-9A-Z]{12}[0-9]{2}$'` = 0 e o mesmo para `parceiros_unidades` (com os dados que os testes e e2e deixam); e o **relatório da D3**: `select count(*) filter (where not cnpj_valido(cnpj)) from clientes` (no local, só dados de teste) — e o comando para o dono rodar **ele mesmo** no SQL Editor da homologação/produção, só leitura, para saber quantos CNPJs cadastrados têm dígito errado;
   - `supabase test db` (todos, com os números; `84` 13/13; `22` 100/100); `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`; `pnpm --filter @escritorio/trabalhador test` e `typecheck`; `pnpm --filter @escritorio/painel test` e `typecheck`;
   - **e2e em lotes de até 2** (`--workers=1`, memória ≥ 4 GB antes de cada lote): os da Task 8 e depois todos de `ls apps/painel/e2e/*.spec.ts`, em ordem alfabética (`supabase db reset` antes do primeiro e a cada 5 lotes). Processo morto → **pare**, devolva `config.toml`/`.env`, libere a vez e avise;
   - **cenários com Claude de verdade:** o novo, 3 vezes (Task 7), e uma rodada de `pnpm --filter @escritorio/trabalhador cenarios "cadastro"` e `cenarios "nota"` (os que usam `consultar_cadastro` e o resumo do pedido, para conferir que o numérico não mudou). Custo anotado; teto D9 (US$ 5);
   - números exatos de cada suíte, lote e rodada, e o custo. Nada de "deve passar";
   - ao terminar, devolva `config.toml` e `.env`, `git status`, apague `.vez-supabase.txt` se a linha for desta worktree.
2. **Capturas** (1366 e 1920, claro e escuro, `next dev -p 3107`, banco local): a ficha com `12.ABC.345/01DE-35` e a ajuda; o erro "CNPJ inválido"; a busca global achando pelo pedaço; a unidade com máscara. Em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\cnpj\`, nomes `cnpj-<tela>-<largura>-<tema>.png`.
3. **Homologação: nada é rodado.** Deixe por escrito: a migração só troca dois `check` por outros **mais largos** (todo CNPJ de antes passa) e cria uma função de leitura; nenhum dado muda; o painel novo, **sem** a migração, recusa salvar um CNPJ com letras com o erro do banco (o numérico segue normal) — aplicar junto das outras quando o dono der o "ok".
4. **Trabalhador: NÃO suba nenhum.** Pronto para trocar junto do plano anterior.
5. **Pendências para listar no fim:**
   - **as decisões a confirmar com o dono:** D3 (conferir o dígito também no banco, depois de limpar os dados de teste), D4 (o texto da ajuda), D5 (a BrasilAPI pode não atender o CNPJ com letras: trocar de serviço?), D6 (testar um CSV com CNPJ com letras no Bling), D8 (base da branch);
   - o relatório da D3 (quantos CNPJs com dígito errado no local; o comando para o dono);
   - a limitação do seletor `EscolherEmpresa` (busca pelo CNPJ sem máscara; já era assim com os numéricos);
   - o custo dos cenários.
6. **Não juntar** a branch em nada. **Parar** ao fim e esperar o dono ver.
