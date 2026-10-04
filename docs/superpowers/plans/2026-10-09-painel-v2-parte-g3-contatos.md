# Painel v2, Parte G3 (Contatos). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** a tela **Contatos** vira a Opção A "Tabela + painel lateral" (`00-contatos-opcao-a.png`). **Tabela:** contato + telefone, empresas, marcações como etiquetas ("Pede nota · 1 de 2" quando vale só em parte das empresas), último contato + estado da conversa, chave do agente e ações (abrir conversa, arquivar), **ordenada pelo último contato**. **Barra:** busca por nome, telefone **ou empresa**; filtros rápidos com contagem (Todos, Agente desligado, Sem empresa, Pode pedir nota, Muda preço); seletor de empresa; período do último contato; ARQUIVADOS (n); NOVO CONTATO. **Painel lateral:** ABRIR CONVERSA, EDITAR, chave do agente, empresas com as marcações **editáveis por empresa**, **vincular empresa**, bloco WhatsApp (último contato, conversa agora, % resolvida pelo agente), demandas abertas do contato, "Excluir…" (Parte B) e, separado com borda tracejada, "Apagar dados (LGPD) · só admin" (mesma ação de hoje). **Mesmas permissões de hoje em toda ação.** Lista grande: página, filtros e contagens **no servidor**, pela regra de leitura de cada pessoa.

**Arquitetura:**
- **Banco (uma migração nova; nenhuma antiga é editada):** `20261009000100_painel_v2_contatos.sql`:
  - visão `contatos_lista` (`security_invoker = true`): uma linha por contato com as **empresas ativas** em `jsonb` (`empresas`), `empresa_ids uuid[]`, `n_empresas`, `empresas_busca` (razão social + nome fantasia), `pode_pedir_nota_alguma`, `muda_preco_alguma` e, pela `caixa_entrada` (Parte E, já com a regra de leitura e a espera do Atendimento), `conversa_id`, `ultimo_contato_em`, `estado_conversa`, `atendente_id`, `atendente_nome`, `espera_desde`. Só `select` para `authenticated`; nada para `anon`;
  - `contato_whatsapp_resumo(p_contato uuid) returns jsonb` (`security invoker`, `stable`): `{atendimentos, resolvidas_agente}` — atendimento = dia de Brasília com mensagem do cliente (Parte F); resolvido = sem resposta da equipe, sem "assumida" e sem passagem para pessoa no dia (regra do Início, G2 D7).
- **Painel:** regras puras em `lib/contatos.ts` (filtros da URL, filtros na consulta, selos, textos). Leitores em `contatos/dados-contatos.ts`: a lista conta e pagina em `contatos_lista` (cinco contagens `head` + uma página, como em Demandas) e, **sem a visão** (homologação antes do "ok"), cai para a leitura de hoje em `contatos` (D14). A página (`page.tsx`) compõe `BarraContatos`, a `DataTable` (`colunas-contatos.tsx`, `acoes-linha.tsx`) e o painel (`detalhe-contato.tsx`), que lê só tabelas e visões que já estão no banco de todos (`contatos`, `contato_clientes`, `caixa_entrada`, `demandas_lista`) mais o resumo novo, que é opcional. Ações novas em `contatos/acoes.ts`: `marcarEmpresaDoContato` e `vincularEmpresaAoContato` (mesma permissão de hoje: Clientes e contatos ≥ "Ver e editar"; o banco recusa de novo pela RLS `editar_clientes`). Nada novo no Realtime.

**Tecnologias:** Next.js 15 (App Router, server components, server actions), React 19 (`useOptimistic`), Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (Postgres, RLS, pgTAP), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção **7C.2** (Contatos, Opção A: colunas, busca "por nome, telefone **ou empresa**", filtros rápidos com contagem, seletor de empresa e período, ARQUIVADOS (n), painel lateral; "Novo no banco: nada além da Parte B; marcações por empresa já existem em `contato_clientes` (passam a ser editáveis também pelo contato, mesma permissão de hoje)"; último item: a **Parte H** acrescenta depois a coluna **Perfil** e o bloco de acesso — **fora desta parte**) e **7C.6** (Playwright por tela; capturas 1366/1920, claro e escuro);
- **3.0** (o que a Parte B fez: arquivado volta com as empresas escolhidas; LGPD não volta), **3.1** (termos; migração incremental com pgTAP; `--dry-run`; nada é juntado), **5** (Parte B: Excluir…, arquivar, restaurar, ARQUIVADOS (n), "Apagar dados (LGPD) de contato continua separado e inalterado"; 5.2 permissões), **7** (Parte D: níveis "Clientes e contatos" e "Atendimento"), **7A** (Parte E: espera e estado da conversa), **7B** (Parte F: "atendimento" = telefone × dia), **4.6** (tom dos textos), **8** (vermelho nunca sozinho; grep antes de trocar rótulos).
- Imagem: `imagens/00-contatos-opcao-a.png` (**a implementar**); `00-contatos-opcao-b.png` só como referência, **não implementar**. HTML de origem: `fragmentos/00-contatos-opcao-a.html`. Dados nas imagens são de exemplo. Onde a imagem e o spec divergem, vale o spec. As duas janelas do rodapé da imagem ("Arquivar Carla Mendes?" e "Apagar os dados de Carla Mendes?") **já existem** (Parte B) e não mudam.

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt G" (linhas 184–201) — ordem Configurações → Início → **Contatos** → Assistente → Treinar o agente; **este plano cobre só Contatos (G3)**. Ao terminar a tela: suítes com resultado real, capturas comparadas com a imagem, e **parar**. Estilo e convenções: `docs/superpowers/plans/2026-10-08-painel-v2-parte-g2-inicio.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-g`, branch `painel-v2-parte-g`, a partir de `b49aa57` (G2 Início pronta, com as sobras) ou do commit mais novo da branch. Todos os comandos rodam a partir da raiz da worktree. Antes da Task 1, confira `git diff etapa-1 -- docs/superpowers/specs/painel-v2`: se não sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso.

## Decisões tomadas (sem o dono)

O dono está fora e autorizou decidir. Conferi no código o que o spec supõe: a tela de hoje (`contatos/page.tsx`) lê `contatos` com `contato_clientes(…clientes(…))`, ordena **pelo nome**, busca só nome e telefone, filtra o agente por um `Select` e pagina no servidor (50 por página); o painel (`?contato=<id>`, `PainelLateralUrl`) mostra nome editável, chave do agente, empresas com selos (**marcações não editáveis em lugar nenhum**: a ficha da empresa só as grava ao adicionar ou vincular, por `upsert`), "Excluir…" e a zona de perigo LGPD (`anonimizarContato`, `exigirAdmin`). Permissões: `contatos` e `contato_clientes` são lidas por qualquer pessoa ativa (`eh_usuario_ativo`), inseridas e alteradas com `editar_clientes` (= Clientes e contatos ≥ "Ver e editar", Parte D) e excluídas só pelo administrador; a chave do agente é `alternarAgenteContato` (≥ "Ver e editar"); arquivar/restaurar exigem "Editar e arquivar" (`exigir_arquivar`); o gatilho `auditoria` já registra toda mudança em `contato_clientes`. A conversa é **uma por telefone** (`conversas.telefone` único; `contato_id` às vezes vazio); `conversas`, `mensagens` e `conversa_eventos` passam por `pode_ver_conversa` (Parte D: "Todas as conversas" ou "Conversas dos meus setores" = assumida por mim ou com demanda nos meus setores); `chamados.contato_id` é preenchido pelo gatilho da Parte C a partir da conversa e `demandas_lista` já filtra por `pode_ver_chamado`. Não há como **começar** conversa pelo painel. A publicação `supabase_realtime` está congelada pelo teste 22. Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Custo da alternativa | Task |
|---|---|---|---|---|
| D1 | **Uma migração nova, só de leitura**, apesar de "Novo no banco: nada além da Parte B": a visão `contatos_lista` e a função `contato_whatsapp_resumo`. Ordenar pelo último contato, buscar pela empresa e contar os filtros rápidos **no servidor** não cabem no PostgREST sem uma visão (o último contato é de outra tabela; o `or` não atravessa tabelas ligadas). Nenhuma tabela, coluna ou permissão muda. | Ler todos os contatos e ordenar/contar no navegador. | Não escala (o spec pede lista grande no servidor) e mandaria ao navegador dados de todos os contatos. | 1 |
| D2 | **Último contato, estado e % resolvida seguem a regra de leitura de cada pessoa** (`security_invoker`): quem não vê a conversa (Parte D) vê "—" e "nenhuma conversa visível"; quem vê todas lê "sem conversa". Os contatos em si continuam visíveis para toda a equipe, como hoje. O filtro "Sem conversa" e as contagens também seguem essa regra. | `security definer` mostrando a hora do último contato para todos. | Revelaria a atividade de conversas que a pessoa não pode abrir (Parte D). | 1, 2, 4 |
| D3 | **"N atendimentos" no lugar de "47 conversas"** da imagem: a conversa é uma por telefone, para sempre (sempre "1 conversa"). Atendimento = dia de Brasília com mensagem do cliente (o mesmo da Parte F). **% resolvida pelo agente** = atendimentos sem resposta da equipe, sem "assumida" e sem passagem para pessoa no dia (a regra dos números do agente no Início, G2 D7). | Contar mensagens ou "conversas" como na imagem. | Número sem sentido ("1 conversa") ou diferente do Início e de Gastos com IA. | 1, 7 |
| D4 | **Filtros rápidos exclusivos** (um por vez, como "Todos" da imagem; `?filtro=`). A contagem de cada um aplica a busca, a empresa e o período escolhidos; "Todos" é o total com esses três. O número do título é o da lista mostrada. | Combinar filtros rápidos. | Contagens ambíguas (cada botão mudaria o número dos outros). | 2, 4 |
| D5 | **Empresa arquivada não aparece** na tabela, nos selos, nas contagens ("Sem empresa", "Pode pedir nota", "Muda preço"), no seletor, na busca nem no painel (spec 5.1: arquivado sai das listas; o agente já ignora). O vínculo continua no banco e volta com a empresa. | Mostrar a empresa arquivada marcada. | A lista de hoje já mostrava (lia `clientes` sem filtro); "1 de 2" contaria empresa que o agente nem vê. | 1, 2, 6 |
| D6 | **Ações da linha = abrir conversa e arquivar** (spec 7C.2 e imagem). O lápis da linha (sobra 1 da Parte B) sai: o clique na linha abre o painel e o **EDITAR** do painel (`?editar=1`) mostra o campo Nome. Telefone continua sem edição (é a identidade da conversa). O e2e da Parte B que clicava no lápis passa a clicar na linha e em Editar. | Manter o lápis como terceiro ícone. | Diferente da imagem aprovada; duas portas para o mesmo painel. | 4, 6 |
| D7 | **NOVO CONTATO continua levando ao cartão "Cadastrar contato"** no fim da página (mesmo formulário, a mesma pergunta do contato arquivado da Parte B e os mesmos textos). | Abrir o cadastro no painel lateral. | Janela da pergunta dentro do painel (camadas aninhadas) e cinco e2e da Parte B reescritos, sem pedido do spec. | 4 |
| D8 | **ABRIR CONVERSA** só com conversa que a pessoa vê **e** Atendimento ≥ "Conversas dos meus setores"; senão o botão aparece desligado com o motivo no tooltip ("Nenhuma conversa com este contato que você possa abrir…" ou "Atendimento: Sem acesso…"). Não há como começar conversa pelo painel. | Esconder o botão. | Linha sem o ícone parece erro; a imagem mostra o ícone em toda linha. | 4, 6 |
| D9 | **Marcações por empresa gravam ao clicar** (otimistas, voltam com aviso se falhar), sem botão Salvar, como a chave do agente. Mesma permissão de hoje (≥ "Ver e editar"; RLS `editar_clientes`); auditoria pelo gatilho que já existe. Contato arquivado: só leitura (volta pelo Restaurar). | Formulário com SALVAR. | Mais um passo para uma caixa só; a imagem não mostra botão. | 5, 6 |
| D10 | **Vincular empresa** oferece só empresas **ativas ainda não ligadas**, com as duas marcações; grava por `insert` (recusa repetido com "Este contato já está ligado a esta empresa."), não por `upsert`. **Desvincular** continua na ficha da empresa (o banco só deixa o administrador apagar vínculo). | `upsert` como na ficha. | Vincular de novo apagaria em silêncio as marcações que já existiam. | 5, 6 |
| D11 | **Selos da linha como na imagem:** "Pede nota", "Muda preço e cadastra produto", "Só conversa" (tem empresa, nenhuma marcação) e "—" (sem empresa); " · 1 de 2" quando parcial (o `title` diz em quais). Filtros: "Pode pedir nota", "Muda preço". No painel, as caixas mantêm os nomes de hoje ("Pode pedir nota", "Pode mudar preço e cadastrar produto"). | Os selos de hoje ("Pode pedir nota · 1 de 2"). | Diferente da imagem. | 2, 4 |
| D12 | **Chave do agente na linha diz "atende"/"desligado"** embaixo da chave (imagem); no painel continua "agente atende"/"agente desligado". O e2e `contatos.spec.ts` (Parte A/B) que procurava "agente desligado" na linha passa a procurar "desligado". | Manter o texto longo. | Coluna larga demais em 1366. | 4 |
| D13 | **Período do último contato:** Hoje · Últimos 7 dias · Últimos 30 dias · Há mais de 30 dias · Sem conversa (o mesmo "hoje/7d/30d" de Demandas, mais os dois que fazem sentido aqui). | Só os três de Demandas. | Não acharia quem sumiu nem quem nunca escreveu. | 2, 4 |
| D14 | **Homologação sem a migração (regra D21 da G2):** o painel desta branch abre. Sem a visão, a lista volta ao comportamento de hoje (pelo nome, busca por nome ou telefone), sem filtros rápidos, empresa e período, com o aviso "falta a atualização do banco desta versão"; último contato e estado vêm da `caixa_entrada` (Parte E, já aplicada) **só para a página mostrada**. O painel lateral funciona inteiro (lê só o que já existe); só a % resolvida fica "—". Nenhuma leitura essencial mistura a visão ou a função novas com os dados essenciais. | Exigir a migração para abrir Contatos. | O dono não veria a tela antes de aprovar as migrações (F, G1 e G2 também estão pendentes). | 3, 4, 7 |
| D15 | **Estado da conversa** (segunda linha do último contato e "Conversa agora"): "esperando pessoa" (âmbar, com "· 18 min" no painel, a mesma espera da `caixa_entrada`) · "com você" · "com <primeiro nome>" · "com a equipe" · "com o agente" · "sem conversa" / "nenhuma conversa visível". A imagem dizia "pelo agente" e "com Ana" para a última resposta; aqui o texto é o **estado de agora**, como no Atendimento. | Quem respondeu por último. | Precisaria de mais uma leitura por linha e diria pouco sobre o agora. | 2, 4, 7 |
| D16 | **Demandas abertas do contato** = `demandas_lista` com `contato_id` do contato e não concluídas, pela regra de leitura de cada pessoa; até 10, por prazo, com "e mais N"; cada uma abre `/demandas?demanda=<id>`. | Todas as demandas das empresas do contato. | Misturaria pedidos de outras pessoas da mesma empresa. | 3, 7 |
| D17 | **Sem atualização ao vivo nesta tela:** ela muda ao agir (revalidação) e ao abrir de novo; o Atendimento continua sendo a tela ao vivo. Nada entra no Realtime (teste 22). | `AtualizarAoVivo` (recarrega a cada mensagem). | Recarregaria a lista inteira a cada mensagem de qualquer cliente. | — |
| D18 | **Parte H fica de fora, com lugar marcado:** a coluna Perfil e o bloco de acesso **não** entram. O painel é feito de seções separadas (`SecaoPainel`) e tem o ponto "Parte H: bloco de acesso" entre Empresas e WhatsApp; a visão pode ganhar `perfil` no fim (com `create or replace view`, sem mudar as colunas de antes) e a tabela, a coluna nova. | Antecipar o Perfil. | Contra o spec (7C.2, último item) e sem os dados da H. | 1, 6 |
| D19 | **Ordem padrão:** último contato, mais recente primeiro, sem conversa no fim (e por nome entre eles). Os cabeçalhos Contato e Último contato ordenam; "Ordem: último contato" na barra alterna para "Ordem: nome". | Só a ordem fixa. | Quem procura por nome perderia a ordem alfabética de hoje. | 3, 4 |
| D20 | **Busca:** nome, telefone (pelos dígitos digitados) ou razão social/nome fantasia de empresa **ativa** ligada ao contato. A busca global (`/contatos?q=<telefone>`) continua funcionando. | Buscar também empresa arquivada. | Contradiz D5. | 1, 2 |

## Restrições globais

- **Só mexer em:**
  - banco: **criar** `supabase/migrations/20261009000100_painel_v2_contatos.sql` e o teste `supabase/tests/38_painel_v2_contatos.test.sql`;
  - `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão);
  - `apps/painel` (tela, lib, componentes, e2e) e `docs/design-system.md`, `docs/operacao.md`.
  - Nada no trabalhador, no prompt do agente, no Bling. **Nada da Parte H** (perfil, setores permitidos, acessos).
- **Nunca editar migração antiga** (`20261008000100` e anteriores). Toda mudança é migração nova, a partir de `20261009000100`.
- **Nunca editar teste pgTAP de parte anterior** (`01` a `37`). **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` não muda e continua 100/100** depois da migração desta parte. Ele está congelado em `8f5eb71` e também fixa a lista do `supabase_realtime`: **nenhuma tabela nova publicada** (D17). Se falhar, a migração mudou o que alguém vê ou faz: corrija a migração, nunca o teste. Na Entrega, `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio. O `25_painel_v2_horario.test.sql` procura `insert|update|delete` no corpo de toda função `security definer` que `authenticated` executa: **esta parte não cria função `security definer`** (a visão e a função são `security invoker`).
- **Visão e função novas:** `set search_path = ''` na função, nomes com `public.`; na visão, `revoke all … from public, anon, authenticated` e depois `grant select … to authenticated` (o padrão do Supabase daria `insert/update/delete` a `anon` e `authenticated`); na função, `revoke execute … from public, anon` e `grant execute … to authenticated`. **Nunca** use `usuario_liberado` (é só do `service_role`).
- **Mesmas permissões de hoje:** ver Contatos = qualquer pessoa ativa; chave do agente, Editar, marcações e vincular = Clientes e contatos ≥ "Ver e editar" (no painel **e** no servidor **e** na RLS); Excluir…/Arquivar = "Editar e arquivar"; Apagar dados (LGPD) = administrador (`exigirAdmin`, ação **inalterada**); abrir conversa = Atendimento ≥ "Conversas dos meus setores" e conversa visível. Nenhuma ação nova é `security definer`.
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
- **Esperar a hidratação nos e2e:** todo e2e novo abre Contatos por `abrirContatos(page, consulta)` (`e2e/apoio-contatos.ts`, Task 4), que espera o `data-contatos-hidratado` (um `useEffect` marca quando o navegador assumiu, como o `abrirInicio` da G2). Digitar ou clicar antes disso perde a ação. Com o painel lateral aberto, a tabela atrás fica `aria-hidden`: localize linhas por `page.locator('tbody tr')`, não por `getByRole('row')`.
- **Nenhum trabalhador é ligado nem desligado nesta parte** (G3 não muda o trabalhador). O da porta **3001 é o teste do dono: não desligue nem mate esse processo.**
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit (D6, D12). **Os textos da Parte B ficam:** "Arquivar ou excluir <nome>", "Excluir…", "Apagar dados (LGPD)", as janelas "Arquivar <nome>?", "Excluir de vez <nome>?", "Apagar os dados de <nome>?", "Trazer <nome> de volta?", o cartão "Cadastrar contato" com os campos "Nome" e "Telefone (com DDD)", "sem empresa", "Salvar nome", "Salvo: <nome>.".
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[300px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind. `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`; os botões `primary/outline/danger/grafite` já são). Vermelho nunca sozinho (ícone + texto).
- **Termos (spec 3.1):** Contato, Empresa, Conversa, Atendimento, Demanda, Setor. "Pessoa" para usuário da equipe.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Conversa vazando pela lista:** a visão nova mostrar hora, estado ou espera de uma conversa que a pessoa não pode abrir (Parte D). pgTAP com Ana ("Conversas dos meus setores"): a conversa fora dos setores dela não aparece na visão nem no resumo; a de dentro aparece. E2e: a mesma linha muda quando a demanda entra no setor dela. Tasks 1 e 4.
2. **Contagens que não batem com a lista:** cada filtro rápido mostra o número de linhas que aparecem ao clicar nele, com a busca, a empresa e o período aplicados, e respeitando a regra de leitura (o "Sem conversa" da Ana conta a Carla). Tasks 3 e 4.
3. **Permissão afrouxada:** "Só ver" não liga/desliga o agente, não marca, não vincula, não edita, não vê Excluir… nem LGPD — na tela **e** na ação **e** na RLS (pgTAP: `update`/`insert` em `contato_clientes` com "Só ver" não grava). Tasks 1, 5 e 7.
4. **Empresa arquivada contando:** a marcação que só existe na empresa arquivada não vira selo nem entra em "Muda preço"; a arquivada não aparece no painel nem para vincular. Tasks 1, 4 e 6.
5. **Homologação sem a migração:** a lista abre pelo nome, sem quebrar, com o aviso; o painel funciona e só a % fica "—"; nada disso vai para o log como erro. Task 3.
6. **LGPD mudando sem querer:** a ação, a janela e o texto são os de hoje; só a moldura (tracejada) e o título ("Apagar dados (LGPD) · só admin") mudam. Task 7 (e os e2e da Parte B continuam passando).
7. **Vincular apagando marcações:** vincular de novo uma empresa já ligada é recusado (não sobrescreve). Task 5.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261009000100_painel_v2_contatos.sql`, `supabase/tests/38_painel_v2_contatos.test.sql` (novos), `packages/db/src/tipos.gen.ts` | visão `contatos_lista`, `contato_whatsapp_resumo`; tipos | 1 |
| `apps/painel/src/lib/contatos.ts` (+ `contatos.test.ts`) (novos) | filtros da URL e da consulta, selos, textos do último contato, da conversa e do resumo | 2 |
| `contatos/dados-contatos.ts` (+ `dados-contatos.test.ts`) (novos) | leitores da lista (com a volta sem a visão, D14), das empresas, do contato, do WhatsApp e das demandas | 3 |
| `contatos/{page.tsx,loading.tsx,marcacoes.tsx,detalhe-contato.tsx}`, `contatos/{barra-contatos.tsx,colunas-contatos.tsx,acoes-linha.tsx,hidratado.tsx}` (novos), `components/patterns/switch-agente-contato.tsx`, `e2e/apoio-contatos.ts`, `e2e/contatos-lista.spec.ts` (novos), `e2e/contatos.spec.ts`, `e2e/arquivar-contatos.spec.ts` | tabela, barra, ações da linha | 4 |
| `contatos/acoes.ts`, `contatos/acoes-empresas.test.ts` (novo) | marcar por empresa, vincular empresa | 5 |
| `contatos/{detalhe-contato.tsx,page.tsx}`, `contatos/{secao-painel.tsx,marcacoes-empresa.tsx,vincular-empresa.tsx}` (novos), `e2e/contatos-painel.spec.ts` (novo), `e2e/arquivar-contatos.spec.ts` | painel: cabeçalho, ABRIR CONVERSA, EDITAR, agente, empresas, marcações, vincular | 6 |
| `contatos/detalhe-contato.tsx`, `contatos/{bloco-whatsapp.tsx,demandas-do-contato.tsx}` (novos), `e2e/contatos-painel.spec.ts` | painel: WhatsApp, demandas abertas, Excluir…, LGPD tracejada; "Só ver" | 7 |
| `e2e/acessibilidade.spec.ts`, `app/(painel)/_design/page.tsx` (se tiver seção de padrões), `docs/design-system.md`, `docs/operacao.md` | acessibilidade e manuais | 8 |

Todos os caminhos `contatos/…` abaixo são `apps/painel/src/app/(painel)/contatos/…`.

---

### Task 1: Banco. Visão `contatos_lista` e resumo do WhatsApp do contato

**Files:**
- Create: `supabase/migrations/20261009000100_painel_v2_contatos.sql`
- Create: `supabase/tests/38_painel_v2_contatos.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `contatos.{id,nome,telefone,agente_pausado,ativo,criado_em}`, `contato_clientes.{contato_id,cliente_id,pode_pedir_nota,pode_atualizar_preco}`, `clientes.{id,razao_social,nome_fantasia,ativo}`, visão `caixa_entrada` (Parte E: `id, telefone, ultima_em, estado, atendente_id, espera_desde`; `security_invoker`), `usuarios.nome`, `mensagens.autor`, `conversa_eventos.tipo` (`assumida`, `passou_para_pessoa`), RLS de `conversas`/`mensagens`/`conversa_eventos` (`pode_ver_conversa`) e de `contato_clientes` (`editar_clientes`).
- Produces:
  - visão `contatos_lista` (`security_invoker = true`): `id, nome, telefone, agente_pausado, ativo, criado_em, empresas jsonb ([{id, nome, pode_pedir_nota, pode_atualizar_preco}], só ativas, por nome), empresa_ids uuid[], n_empresas int, empresas_busca text, pode_pedir_nota_alguma bool, muda_preco_alguma bool, conversa_id uuid, ultimo_contato_em timestamptz, estado_conversa estado_conversa, atendente_id uuid, atendente_nome text, espera_desde timestamptz`;
  - `contato_whatsapp_resumo(p_contato uuid) returns jsonb` (**stable**, **security invoker**): `{atendimentos, resolvidas_agente}`.

- [ ] **Passo 0: guardar a regressão de antes**

Com o Supabase local nas portas 563xx (Restrições globais): `supabase db reset && supabase test db 2>&1 | grep -E "22_regressao|25_painel|Result" | tee "$SCRATCH/regressao-antes.txt"`.
Expected: `22_regressao_visibilidade.test.sql .. ok` (100/100), `25_painel_v2_horario.test.sql .. ok` e `Result: PASS`.

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/38_painel_v2_contatos.test.sql`:

```sql
-- Parte G3, Task 1 (spec 7C.2 e 7C.6): visão contatos_lista e resumo do WhatsApp do contato, os dois com a regra de leitura
-- de quem consulta (security invoker, D2); marcações e vínculos por empresa com a mesma permissão de hoje.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email) values
  ('e3000000-0000-0000-0000-00000000000a', 'admin@g3.local'), ('e3000000-0000-0000-0000-00000000000b', 'ana@g3.local'),
  ('e3000000-0000-0000-0000-00000000000c', 'arquivada@g3.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e3000000-0000-0000-0000-00000000000a', 'Admin G3', 'admin@g3.local', 'admin'),
  ('e3000000-0000-0000-0000-00000000000b', 'Ana G3', 'ana@g3.local', 'atendente'),
  ('e3000000-0000-0000-0000-00000000000c', 'Arquivada G3', 'arquivada@g3.local', 'atendente');
update public.usuarios set ativo = false where id = 'e3000000-0000-0000-0000-00000000000c';
insert into public.setores (id, nome, ativo) values ('e3100000-0000-0000-0000-000000000001', 'G3 Fiscal', true);
insert into public.usuario_setores (usuario_id, setor_id) values ('e3000000-0000-0000-0000-00000000000b', 'e3100000-0000-0000-0000-000000000001');

-- Empresas: Alfa e Beta ativas; Zeta arquivada.
insert into public.clientes (id, razao_social, nome_fantasia, cnpj, ativo) values
  ('e3200000-0000-0000-0000-00000000000a', 'G3 Alfa', null, '33000000000101', true),
  ('e3200000-0000-0000-0000-00000000000b', 'G3 Beta Ltda', 'Beta Fantasia', '33000000000202', true),
  ('e3200000-0000-0000-0000-00000000000c', 'G3 Zeta', null, '33000000000303', false);
-- Carla: Alfa (pede nota), Beta (nada) e Zeta (muda preço, mas a empresa está arquivada). Rui: sem empresa, agente desligado.
-- Paula: Beta; a conversa dela está ligada só pelo telefone.
insert into public.contatos (id, nome, telefone, agente_pausado) values
  ('e3300000-0000-0000-0000-000000000001', 'G3 Carla', '5531980000001', false),
  ('e3300000-0000-0000-0000-000000000002', 'G3 Rui', '5531980000002', true),
  ('e3300000-0000-0000-0000-000000000003', 'G3 Paula', '5531980000003', false);
insert into public.contato_clientes (contato_id, cliente_id, pode_pedir_nota, pode_atualizar_preco) values
  ('e3300000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-00000000000a', true, false),
  ('e3300000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-00000000000b', false, false),
  ('e3300000-0000-0000-0000-000000000001', 'e3200000-0000-0000-0000-00000000000c', false, true),
  ('e3300000-0000-0000-0000-000000000003', 'e3200000-0000-0000-0000-00000000000b', false, false);

-- Conversa da Carla (K): dia 10 a equipe respondeu; dia 11 só o agente; dia 12 o agente passou para pessoa (esperando).
-- Conversa da Paula (P), só pelo telefone: dia 12, só a mensagem do cliente.
insert into public.conversas (id, telefone, contato_id, aguardando_pessoa_desde) values
  ('e3400000-0000-0000-0000-00000000000a', '5531980000001', 'e3300000-0000-0000-0000-000000000001', '2025-03-12 08:01-03');
insert into public.conversas (id, telefone) values ('e3400000-0000-0000-0000-00000000000b', '5531980000003');
insert into public.mensagens (conversa_id, direcao, autor, conteudo, criado_em) values
  ('e3400000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'oi', '2025-03-10 09:00-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'saida', 'atendente', 'pois não', '2025-03-10 09:10-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'oi', '2025-03-11 10:00-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'saida', 'agente', 'olá', '2025-03-11 10:01-03'),
  ('e3400000-0000-0000-0000-00000000000a', 'entrada', 'cliente', 'quero falar com alguém', '2025-03-12 08:00-03'),
  ('e3400000-0000-0000-0000-00000000000b', 'entrada', 'cliente', 'oi', '2025-03-12 11:00-03');
insert into public.conversa_eventos (conversa_id, tipo, criado_em) values ('e3400000-0000-0000-0000-00000000000a', 'passou_para_pessoa', '2025-03-12 08:01-03');
-- A conversa da Paula tem demanda no setor da Ana: ela vê essa conversa (Parte D), não a da Carla.
insert into public.chamados (setor_id, conversa_id, titulo) values
  ('e3100000-0000-0000-0000-000000000001', 'e3400000-0000-0000-0000-00000000000b', 'G3 nota da Paula');

-- 1–7: estrutura e quem consulta
select has_view('public', 'contatos_lista', 'visão existe');
select ok((select coalesce('security_invoker=true' = any (c.reloptions), false) from pg_class c where c.oid = 'public.contatos_lista'::regclass),
  'visão com a regra de leitura de quem consulta');
select ok(not has_table_privilege('anon', 'public.contatos_lista', 'select'), 'anon não lê a visão');
select ok(not has_table_privilege('authenticated', 'public.contatos_lista', 'update'), 'a visão é só leitura');
select has_function('public', 'contato_whatsapp_resumo', 'resumo existe');
select ok(not (select prosecdef from pg_proc where oid = 'public.contato_whatsapp_resumo(uuid)'::regprocedure),
  'resumo roda com a regra de leitura de quem chama');
select ok(not has_function_privilege('anon', 'public.contato_whatsapp_resumo(uuid)', 'execute'), 'anon não lê o resumo');

-- 8–17: o administrador vê tudo
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select results_eq(
  $$ select n_empresas, pode_pedir_nota_alguma, muda_preco_alguma from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000001' $$,
  $$ values (2, true, false) $$, 'Carla: duas empresas ativas; a marcação da arquivada não conta (D5)');
select is((select array(select e ->> 'nome' from jsonb_array_elements(l.empresas) e) from public.contatos_lista l
           where l.id = 'e3300000-0000-0000-0000-000000000001'),
  array['Beta Fantasia', 'G3 Alfa'], 'empresas pelo nome que a equipe conhece, em ordem');
select is((select empresa_ids @> array['e3200000-0000-0000-0000-00000000000c']::uuid[] from public.contatos_lista
           where id = 'e3300000-0000-0000-0000-000000000001'), false, 'empresa arquivada fora dos filtros');
select is((select count(*)::int from public.contatos_lista where nome like 'G3 %' and empresas_busca ilike '%G3 Beta Ltda%'), 2,
  'busca pela razão social de quem tem nome fantasia (Carla e Paula)');
select results_eq(
  $$ select n_empresas, conversa_id is null, ultimo_contato_em is null, agente_pausado from public.contatos_lista
     where id = 'e3300000-0000-0000-0000-000000000002' $$,
  $$ values (0, true, true, true) $$, 'Rui: sem empresa, sem conversa, agente desligado');
select results_eq(
  $$ select conversa_id, ultimo_contato_em from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000003' $$,
  $$ values ('e3400000-0000-0000-0000-00000000000b'::uuid, '2025-03-12 11:00-03'::timestamptz) $$,
  'Paula: a conversa ligada só pelo telefone também conta');
select results_eq(
  $$ select conversa_id, estado_conversa::text, espera_desde from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000001' $$,
  $$ values ('e3400000-0000-0000-0000-00000000000a'::uuid, 'agente', '2025-03-12 08:01-03'::timestamptz) $$,
  'Carla: a mesma espera da caixa de entrada');
select is(array(select nome from public.contatos_lista where nome like 'G3 %' order by ultimo_contato_em desc nulls last),
  array['G3 Paula', 'G3 Carla', 'G3 Rui'], 'ordem pelo último contato; sem conversa no fim');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000001'), '{"atendimentos":3,"resolvidas_agente":1}'::jsonb,
  'Carla: 3 dias; só o dia 11 o agente resolveu sozinho (D3)');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000002'), '{"atendimentos":0,"resolvidas_agente":0}'::jsonb,
  'Rui: nada');

-- 18–22: Ana ("Conversas dos meus setores") vê os contatos, mas só a conversa com demanda no setor dela
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.contatos_lista where nome like 'G3 %'), 3, 'Ana vê os três contatos (como hoje)');
select results_eq(
  $$ select conversa_id is null, ultimo_contato_em is null, espera_desde is null from public.contatos_lista
     where id = 'e3300000-0000-0000-0000-000000000001' $$,
  $$ values (true, true, true) $$, 'Ana: nada da conversa da Carla (fora dos setores dela)');
select is((select conversa_id from public.contatos_lista where id = 'e3300000-0000-0000-0000-000000000003'),
  'e3400000-0000-0000-0000-00000000000b'::uuid, 'Ana: a conversa da Paula aparece');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000001'), '{"atendimentos":0,"resolvidas_agente":0}'::jsonb,
  'Ana: o resumo da Carla não revela nada');
select is(public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000003'), '{"atendimentos":1,"resolvidas_agente":1}'::jsonb,
  'Ana: o resumo da Paula');

-- 23–26: marcações e vínculos com a permissão de hoje (Clientes e contatos ≥ "Ver e editar" = editar_clientes)
select throws_ok(
  $$ insert into public.contato_clientes (contato_id, cliente_id) values ('e3300000-0000-0000-0000-000000000002', 'e3200000-0000-0000-0000-00000000000a') $$,
  '42501', null, '"Só ver": não vincula empresa');
update public.contato_clientes set pode_atualizar_preco = true
 where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a';
reset role;
select is((select pode_atualizar_preco from public.contato_clientes
           where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a'),
  false, '"Só ver": a marcação não muda');
update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'e3000000-0000-0000-0000-00000000000b' and modulo = 'clientes';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
update public.contato_clientes set pode_atualizar_preco = true
 where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a';
reset role;
select is((select pode_atualizar_preco from public.contato_clientes
           where contato_id = 'e3300000-0000-0000-0000-000000000001' and cliente_id = 'e3200000-0000-0000-0000-00000000000a'),
  true, '"Ver e editar": a marcação muda');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.contato_clientes (contato_id, cliente_id) values ('e3300000-0000-0000-0000-000000000002', 'e3200000-0000-0000-0000-00000000000a') $$,
  '"Ver e editar": vincula empresa');

-- 27: arquivada não vê nada
select set_config('request.jwt.claims', '{"sub":"e3000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.contatos_lista where nome like 'G3 %'), 0, 'arquivada: nada');
reset role;

-- 28–29: visitante recusado
set local role anon;
select throws_ok($$ select * from public.contatos_lista $$, '42501', null, 'visitante: lista recusada');
select throws_ok($$ select public.contato_whatsapp_resumo('e3300000-0000-0000-0000-000000000001') $$, '42501', null, 'visitante: resumo recusado');
reset role;

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db --file supabase/tests/38_painel_v2_contatos.test.sql` (se a CLI não aceitar `--file`, `supabase test db` e olhe a linha do 38).
Expected: FAIL — `has_view` falso / `relation "public.contatos_lista" does not exist`.

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261009000100_painel_v2_contatos.sql`:

```sql
-- supabase/migrations/20261009000100_painel_v2_contatos.sql
-- Painel v2, Parte G3 (spec 7C.2): a lista de Contatos ordenada pelo último contato, com busca pela empresa e contagens no
-- servidor (D1), e o resumo do WhatsApp de um contato. As duas leem com a regra de quem consulta (security invoker): quem
-- não vê a conversa (Parte D) não recebe a hora nem o estado dela (D2). Nada grava e nada entra no Realtime (teste 22).

create view public.contatos_lista with (security_invoker = true) as
select ct.id, ct.nome, ct.telefone, ct.agente_pausado, ct.ativo, ct.criado_em,
       -- Só empresas ativas (D5): a arquivada sai das listas, das contagens e dos filtros, como no agente.
       coalesce(emp.empresas, '[]'::jsonb) as empresas,
       coalesce(emp.empresa_ids, '{}'::uuid[]) as empresa_ids,
       coalesce(emp.total, 0) as n_empresas,
       coalesce(emp.busca, '') as empresas_busca,
       coalesce(emp.alguma_nota, false) as pode_pedir_nota_alguma,
       coalesce(emp.algum_preco, false) as muda_preco_alguma,
       -- A conversa é uma por telefone; a caixa_entrada já passou pela regra de leitura e tem a espera do Atendimento (D15).
       ce.id as conversa_id,
       ce.ultima_em as ultimo_contato_em,
       ce.estado as estado_conversa,
       ce.atendente_id,
       u.nome as atendente_nome,
       ce.espera_desde
from public.contatos ct
left join lateral (
  select jsonb_agg(jsonb_build_object('id', cl.id, 'nome', coalesce(nullif(cl.nome_fantasia, ''), cl.razao_social),
                                      'pode_pedir_nota', cc.pode_pedir_nota, 'pode_atualizar_preco', cc.pode_atualizar_preco)
                   order by coalesce(nullif(cl.nome_fantasia, ''), cl.razao_social)) as empresas,
         array_agg(cl.id) as empresa_ids,
         count(*)::int as total,
         string_agg(cl.razao_social || ' ' || coalesce(cl.nome_fantasia, ''), ' ') as busca,
         bool_or(cc.pode_pedir_nota) as alguma_nota,
         bool_or(cc.pode_atualizar_preco) as algum_preco
  from public.contato_clientes cc
  join public.clientes cl on cl.id = cc.cliente_id and cl.ativo
  where cc.contato_id = ct.id
) emp on true
left join public.caixa_entrada ce on ce.telefone = ct.telefone
left join public.usuarios u on u.id = ce.atendente_id;

-- Só leitura e só para a equipe (o padrão do Supabase daria escrita a anon e authenticated).
revoke all on public.contatos_lista from public, anon, authenticated;
grant select on public.contatos_lista to authenticated;

-- Atendimentos (dia de Brasília com mensagem do cliente, como na Parte F) e quantos o agente resolveu sozinho: ninguém da
-- equipe respondeu, assumiu ou recebeu a passagem no dia (a regra do Início, G2 D7). Invoker: só conversas que quem chama vê.
create function public.contato_whatsapp_resumo(p_contato uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with cv as (
    select c.id from public.conversas c
    where c.contato_id = p_contato
       or c.telefone = (select ct.telefone from public.contatos ct where ct.id = p_contato)
  ), dias as (
    select m.conversa_id, (m.criado_em at time zone 'America/Sao_Paulo')::date as dia
    from public.mensagens m
    where m.conversa_id in (select id from cv) and m.autor = 'cliente'
    group by 1, 2
  ), com_pessoa as (
    select d.conversa_id, d.dia,
           exists (select 1 from public.mensagens m
                    where m.conversa_id = d.conversa_id and m.autor = 'atendente'
                      and m.criado_em >= d.dia::timestamp at time zone 'America/Sao_Paulo'
                      and m.criado_em < (d.dia + 1)::timestamp at time zone 'America/Sao_Paulo')
           or exists (select 1 from public.conversa_eventos e
                       where e.conversa_id = d.conversa_id and e.tipo in ('assumida', 'passou_para_pessoa')
                         and e.criado_em >= d.dia::timestamp at time zone 'America/Sao_Paulo'
                         and e.criado_em < (d.dia + 1)::timestamp at time zone 'America/Sao_Paulo') as pessoa
    from dias d
  )
  select jsonb_build_object('atendimentos', count(*), 'resolvidas_agente', count(*) filter (where not p.pessoa))
  from com_pessoa p
$$;
revoke execute on function public.contato_whatsapp_resumo(uuid) from public, anon;
grant execute on function public.contato_whatsapp_resumo(uuid) to authenticated;
```

(Confira antes com `grep -n "create or replace view public.caixa_entrada" supabase/migrations/*.sql` que a última versão da `caixa_entrada` é a de `20261005000200_painel_v2_espera.sql` e tem `telefone`, `ultima_em`, `estado`, `atendente_id` e `espera_desde`; e com `grep -n "'passou_para_pessoa'" supabase/migrations/20261005000200_painel_v2_espera.sql` que o tipo de evento existe.)

- [ ] **Passo 4: rodar, regerar os tipos e conferir**

Run: `supabase db reset && supabase test db && pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: `38_painel_v2_contatos` 29/29; `22_regressao_visibilidade` 100/100 (igual a `$SCRATCH/regressao-antes.txt`); `25_painel_v2_horario` passa; `Result: PASS`; `git diff --stat packages/db/src/tipos.gen.ts` mostra `contatos_lista` e `contato_whatsapp_resumo`; os três typecheck verdes.

- [ ] **Passo 5: commit**

```bash
git add supabase/migrations/20261009000100_painel_v2_contatos.sql supabase/tests/38_painel_v2_contatos.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): visão contatos_lista e resumo do WhatsApp por contato, com a regra de leitura de quem consulta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Painel. Regras puras de Contatos

**Files:**
- Create: `apps/painel/src/lib/contatos.ts`, `apps/painel/src/lib/contatos.test.ts`

**Interfaces:**
- Consumes: `termoSeguroPostgrest` (`lib/busca.ts`); `inicioDoPeriodo` (`lib/demandas.ts`); `minutosDeEspera`, `textoEspera` (`lib/atendimento.ts`); `FUSO` (`lib/formatos.ts`); `valorParam`, `Ordem`, `ParamsBusca` (`lib/tabela-url.ts`).
- Produces: `FILTROS_RAPIDOS`, `FiltroRapido`, `PERIODOS_CONTATO`, `PeriodoContato`, `ORDENS_CONTATOS`, `ORDEM_PADRAO_CONTATOS`, `FiltrosContatos`, `lerFiltrosContatos`, `temFiltroContatos`, `ConsultaContatos`, `filtroBusca`, `aplicarFiltrosContatos`; `Vinculo`, `nomeEmpresa`, `lerEmpresasDaVisao`, `Selo`, `selosDoContato`; `textoUltimoContato`, `textoCadastro`; `ConversaDoContato`, `TomConversa`, `estadoDaConversa`, `textoConversaAgora`; `LinhaContato`; `ResumoWhatsapp`, `lerResumoWhatsapp`, `textoResolvidas`, `textoAtendimentos`; `hrefConversa`.

- [ ] **Passo 1: escrever os testes que falham**

`apps/painel/src/lib/contatos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  aplicarFiltrosContatos, estadoDaConversa, lerEmpresasDaVisao, lerFiltrosContatos, lerResumoWhatsapp, selosDoContato,
  textoAtendimentos, textoCadastro, textoConversaAgora, textoResolvidas, textoUltimoContato, type ConversaDoContato, type Vinculo,
} from './contatos';

const AGORA = new Date('2026-10-09T15:00:00-03:00');
const E = '22222222-2222-4222-8222-222222222222';

// Grava os métodos chamados, na ordem, como o construtor do PostgREST os receberia.
function gravador() {
  const ops: [string, unknown[]][] = [];
  const q: Record<string, (...a: unknown[]) => unknown> = {};
  for (const m of ['eq', 'is', 'contains', 'gte', 'lt', 'or']) q[m] = (...a: unknown[]) => { ops.push([m, a]); return q; };
  return { q: q as never, ops };
}

describe('lerFiltrosContatos', () => {
  it('busca segura, filtro rápido, empresa (só uuid) e período; o resto vira nulo', () => {
    expect(lerFiltrosContatos({ q: ' Mercado, (Central) ', filtro: 'nota', empresa: E, periodo: '7d' }))
      .toEqual({ q: 'Mercado Central', rapido: 'nota', empresa: E, periodo: '7d' });
    expect(lerFiltrosContatos({ q: '  ', filtro: 'todos', empresa: 'x', periodo: 'ontem' }))
      .toEqual({ q: null, rapido: null, empresa: null, periodo: null });
  });
});

describe('aplicarFiltrosContatos', () => {
  it('só ativos; busca por nome, telefone ou empresa; filtro rápido; empresa; "há mais de 30 dias"', () => {
    const { q, ops } = gravador();
    aplicarFiltrosContatos(q, { q: 'Mercado', rapido: 'sem_empresa', empresa: E, periodo: 'antigo' }, AGORA);
    expect(ops).toEqual([
      ['eq', ['ativo', true]],
      ['or', ['nome.ilike.%Mercado%,telefone.ilike.%Mercado%,empresas_busca.ilike.%Mercado%']],
      ['eq', ['n_empresas', 0]],
      ['contains', ['empresa_ids', [E]]],
      ['lt', ['ultimo_contato_em', '2026-09-09T18:00:00.000Z']],
    ]);
  });
  it('telefone pelos dígitos; "sem conversa" e "hoje" pelo último contato; o filtro rápido pode ser trocado (contagens, D4)', () => {
    const a = gravador();
    aplicarFiltrosContatos(a.q, { q: '11 97777', rapido: 'nota', empresa: null, periodo: 'nunca' }, AGORA, null);
    expect(a.ops).toEqual([
      ['eq', ['ativo', true]],
      ['or', ['nome.ilike.%11 97777%,telefone.ilike.%1197777%,empresas_busca.ilike.%11 97777%']],
      ['is', ['ultimo_contato_em', null]],
    ]);
    const b = gravador();
    aplicarFiltrosContatos(b.q, { q: null, rapido: null, empresa: null, periodo: 'hoje' }, AGORA, 'desligado');
    expect(b.ops).toEqual([['eq', ['ativo', true]], ['eq', ['agente_pausado', true]], ['gte', ['ultimo_contato_em', '2026-10-09T03:00:00.000Z']]]);
  });
});

const v = (empresa: string, nota: boolean, preco: boolean): Vinculo => ({ empresaId: empresa, empresa, podePedirNota: nota, podeMudarPreco: preco });

describe('selosDoContato (D11)', () => {
  it('"1 de 2" quando vale só em parte das empresas; "Só conversa" sem marcação; nada sem empresa', () => {
    expect(selosDoContato([])).toEqual([]);
    expect(selosDoContato([v('Rede', true, false), v('Mercado', false, false)]))
      .toEqual([{ rotulo: 'Pede nota · 1 de 2', tom: 'nota', titulo: 'Em: Rede' }]);
    expect(selosDoContato([v('Rede', true, true)])).toEqual([
      { rotulo: 'Pede nota', tom: 'nota', titulo: 'Em: Rede' },
      { rotulo: 'Muda preço e cadastra produto', tom: 'preco', titulo: 'Em: Rede' },
    ]);
    expect(selosDoContato([v('Auto Peças', false, false)]))
      .toEqual([{ rotulo: 'Só conversa', tom: 'conversa', titulo: 'Não pede nota nem muda preço' }]);
  });
});

describe('lerEmpresasDaVisao', () => {
  it('converte o jsonb da visão e descarta o que vier estranho', () => {
    expect(lerEmpresasDaVisao([{ id: 'e1', nome: 'Rede', pode_pedir_nota: true, pode_atualizar_preco: false }, { id: 3 }, null]))
      .toEqual([{ empresaId: 'e1', empresa: 'Rede', podePedirNota: true, podeMudarPreco: false }]);
    expect(lerEmpresasDaVisao('x')).toEqual([]);
  });
});

describe('textos de data', () => {
  it('último contato: hoje, ontem, dia do ano, outro ano, nada', () => {
    expect(textoUltimoContato('2026-10-09T14:48:00-03:00', AGORA)).toBe('hoje 14:48');
    expect(textoUltimoContato('2026-10-09T01:30:00Z', AGORA)).toBe('ontem 22:30');
    expect(textoUltimoContato('2026-09-29T15:20:00-03:00', AGORA)).toBe('29/09 15:20');
    expect(textoUltimoContato('2025-12-30T10:00:00-03:00', AGORA)).toBe('30/12/2025');
    expect(textoUltimoContato(null, AGORA)).toBe('—');
  });
  it('cadastro: com o ano só quando não é o corrente', () => {
    expect(textoCadastro('2026-03-14T10:00:00-03:00', AGORA)).toBe('cadastro em 14/03');
    expect(textoCadastro('2025-03-14T10:00:00-03:00', AGORA)).toBe('cadastro em 14/03/2025');
  });
});

describe('estadoDaConversa e textoConversaAgora (D2, D15)', () => {
  const base: ConversaDoContato = { conversaId: 'k1', estado: 'agente', atendenteId: null, atendenteNome: null, esperaDesde: null };
  const ctx = { euId: 'eu', veTodas: true };
  it('sem conversa, esperando, com pessoa, com o agente', () => {
    expect(estadoDaConversa({ ...base, conversaId: null }, ctx)).toEqual({ texto: 'sem conversa', tom: 'sem' });
    expect(estadoDaConversa({ ...base, conversaId: null }, { euId: 'eu', veTodas: false })).toEqual({ texto: 'nenhuma conversa visível', tom: 'sem' });
    expect(estadoDaConversa({ ...base, esperaDesde: '2026-10-09T14:42:00-03:00' }, ctx)).toEqual({ texto: 'esperando pessoa', tom: 'espera' });
    expect(estadoDaConversa({ ...base, estado: 'humano', atendenteId: 'eu', atendenteNome: 'Thiago' }, ctx).texto).toBe('com você');
    expect(estadoDaConversa({ ...base, estado: 'humano', atendenteId: 'u2', atendenteNome: 'Ana Souza' }, ctx).texto).toBe('com Ana');
    expect(estadoDaConversa({ ...base, estado: 'humano' }, ctx).texto).toBe('com a equipe');
    expect(estadoDaConversa(base, ctx)).toEqual({ texto: 'com o agente', tom: 'agente' });
  });
  it('conversa agora: a espera leva os minutos', () => {
    expect(textoConversaAgora({ ...base, esperaDesde: '2026-10-09T14:42:00-03:00' }, ctx, AGORA)).toBe('esperando pessoa · 18 min');
    expect(textoConversaAgora(base, ctx, AGORA)).toBe('com o agente');
  });
});

describe('resumo do WhatsApp (D3)', () => {
  it('lê, calcula a porcentagem e descarta o estranho', () => {
    expect(lerResumoWhatsapp({ atendimentos: 47, resolvidas_agente: 33 })).toEqual({ atendimentos: 47, resolvidas: 33 });
    expect(textoResolvidas({ atendimentos: 47, resolvidas: 33 })).toBe('70%');
    expect(textoResolvidas({ atendimentos: 0, resolvidas: 0 })).toBe('—');
    expect(textoResolvidas(null)).toBe('—');
    expect(lerResumoWhatsapp({ atendimentos: 2, resolvidas_agente: 3 })).toBeNull();
    expect(lerResumoWhatsapp(null)).toBeNull();
    expect(textoAtendimentos({ atendimentos: 1, resolvidas: 0 })).toBe('1 atendimento');
    expect(textoAtendimentos({ atendimentos: 47, resolvidas: 33 })).toBe('47 atendimentos');
    expect(textoAtendimentos(null)).toBeNull();
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/contatos.test.ts`
Expected: FAIL — `Cannot find module './contatos'`.

- [ ] **Passo 2: implementar `lib/contatos.ts`**

```ts
// Contatos (spec 7C.2): filtros da URL e da consulta à visão contatos_lista, selos da linha e textos do último contato, da
// conversa e do resumo do WhatsApp. Sem React e sem banco: testável.
import { minutosDeEspera, textoEspera } from './atendimento';
import { termoSeguroPostgrest } from './busca';
import { inicioDoPeriodo } from './demandas';
import { FUSO } from './formatos';
import { valorParam, type Ordem, type ParamsBusca } from './tabela-url';

export const FILTROS_RAPIDOS = [
  { valor: 'desligado', rotulo: 'Agente desligado' },
  { valor: 'sem_empresa', rotulo: 'Sem empresa' },
  { valor: 'nota', rotulo: 'Pode pedir nota' },
  { valor: 'preco', rotulo: 'Muda preço' },
] as const;
export type FiltroRapido = (typeof FILTROS_RAPIDOS)[number]['valor'];

export const PERIODOS_CONTATO = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: 'antigo', rotulo: 'Há mais de 30 dias' },
  { valor: 'nunca', rotulo: 'Sem conversa' },
] as const;
export type PeriodoContato = (typeof PERIODOS_CONTATO)[number]['valor'];

export const ORDENS_CONTATOS = ['nome', 'ultimo'] as const;
/** Mais recente primeiro; sem conversa no fim (D19). */
export const ORDEM_PADRAO_CONTATOS: Ordem = { coluna: 'ultimo', direcao: 'desc' };

export type FiltrosContatos = { q: string | null; rapido: FiltroRapido | null; empresa: string | null; periodo: PeriodoContato | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const daLista = <T extends string>(v: string | undefined, lista: readonly { valor: T }[]): T | null => lista.find((o) => o.valor === v)?.valor ?? null;

/** ?q= (busca), ?filtro= (um filtro rápido, D4), ?empresa= (id) e ?periodo= (D13). */
export function lerFiltrosContatos(params: ParamsBusca): FiltrosContatos {
  const empresa = valorParam(params, 'empresa');
  return {
    q: termoSeguroPostgrest(valorParam(params, 'q')) || null,
    rapido: daLista(valorParam(params, 'filtro'), FILTROS_RAPIDOS),
    empresa: empresa && UUID.test(empresa) ? empresa : null,
    periodo: daLista(valorParam(params, 'periodo'), PERIODOS_CONTATO),
  };
}

export const temFiltroContatos = (f: FiltrosContatos): boolean => Boolean(f.q || f.rapido || f.empresa || f.periodo);

/** O que os filtros usam do construtor de consultas do PostgREST. */
export type ConsultaContatos<Q> = {
  eq(coluna: string, valor: boolean | number | string): Q;
  is(coluna: string, valor: null): Q;
  contains(coluna: string, valor: string[]): Q;
  gte(coluna: string, valor: string): Q;
  lt(coluna: string, valor: string): Q;
  or(filtros: string): Q;
};

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

/** Nome, telefone (pelos dígitos digitados) ou empresa ativa — razão social e nome fantasia (D20). */
export function filtroBusca(q: string): string {
  const digitos = q.replace(/\D/g, '');
  return [`nome.ilike.%${q}%`, `telefone.ilike.%${digitos || q}%`, `empresas_busca.ilike.%${q}%`].join(',');
}

/**
 * Filtros da URL numa consulta a contatos_lista. `rapido` à parte: cada contagem dos filtros rápidos aplica a busca, a empresa
 * e o período, e o seu próprio filtro rápido (D4).
 */
export function aplicarFiltrosContatos<Q extends ConsultaContatos<Q>>(q: Q, f: FiltrosContatos, agora: Date, rapido: FiltroRapido | null = f.rapido): Q {
  // Arquivado sai da lista (spec 5.1).
  let r = q.eq('ativo', true);
  if (f.q) r = r.or(filtroBusca(f.q));
  if (rapido === 'desligado') r = r.eq('agente_pausado', true);
  else if (rapido === 'sem_empresa') r = r.eq('n_empresas', 0);
  else if (rapido === 'nota') r = r.eq('pode_pedir_nota_alguma', true);
  else if (rapido === 'preco') r = r.eq('muda_preco_alguma', true);
  if (f.empresa) r = r.contains('empresa_ids', [f.empresa]);
  const periodo = f.periodo;
  if (periodo === 'nunca') r = r.is('ultimo_contato_em', null);
  else if (periodo === 'antigo') r = r.lt('ultimo_contato_em', new Date(agora.getTime() - TRINTA_DIAS_MS).toISOString());
  else if (periodo) r = r.gte('ultimo_contato_em', inicioDoPeriodo(periodo, agora)!);
  return r;
}

export type Vinculo = { empresaId: string; empresa: string; podePedirNota: boolean; podeMudarPreco: boolean };

/** Nome da empresa como a equipe conhece (fantasia, senão razão social). */
export const nomeEmpresa = (c: { razao_social: string; nome_fantasia: string | null }): string => c.nome_fantasia || c.razao_social;

/** `empresas` (jsonb) da visão: [{id, nome, pode_pedir_nota, pode_atualizar_preco}]; o que vier estranho fica de fora. */
export function lerEmpresasDaVisao(v: unknown): Vinculo[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((e) => {
    const o = e as { id?: unknown; nome?: unknown; pode_pedir_nota?: unknown; pode_atualizar_preco?: unknown } | null;
    return o && typeof o.id === 'string' && typeof o.nome === 'string'
      ? [{ empresaId: o.id, empresa: o.nome, podePedirNota: o.pode_pedir_nota === true, podeMudarPreco: o.pode_atualizar_preco === true }]
      : [];
  });
}

export type Selo = { rotulo: string; tom: 'nota' | 'preco' | 'conversa'; titulo: string };

/** Selos da linha (imagem A, D11): " · 1 de 2" quando vale só em parte das empresas; "Só conversa" sem marcação; nada sem empresa. */
export function selosDoContato(vinculos: Vinculo[]): Selo[] {
  if (vinculos.length === 0) return [];
  const selo = (rotulo: string, tom: Selo['tom'], com: Vinculo[]): Selo[] => {
    if (com.length === 0) return [];
    const parcial = com.length < vinculos.length ? ` · ${com.length} de ${vinculos.length}` : '';
    return [{ rotulo: `${rotulo}${parcial}`, tom, titulo: `Em: ${com.map((x) => x.empresa).join(', ')}` }];
  };
  const selos = [
    ...selo('Pede nota', 'nota', vinculos.filter((x) => x.podePedirNota)),
    ...selo('Muda preço e cadastra produto', 'preco', vinculos.filter((x) => x.podeMudarPreco)),
  ];
  return selos.length > 0 ? selos : [{ rotulo: 'Só conversa', tom: 'conversa', titulo: 'Não pede nota nem muda preço' }];
}

const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const anoDe = (d: Date) => dia.format(d).split('/')[2];

/** "hoje 14:48", "ontem 16:40", "29/09 15:20" (mesmo ano), "30/12/2025" (outro ano) ou "—" (sem conversa visível). */
export function textoUltimoContato(iso: string | null, agora: Date): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const h = hora.format(d);
  if (dia.format(d) === dia.format(agora)) return `hoje ${h}`;
  if (dia.format(d) === dia.format(new Date(agora.getTime() - 86_400_000))) return `ontem ${h}`;
  const [dd, mm, aaaa] = dia.format(d).split('/');
  return aaaa === anoDe(agora) ? `${dd}/${mm} ${h}` : `${dd}/${mm}/${aaaa}`;
}

/** "cadastro em 14/03" (o ano só quando não é o corrente). */
export function textoCadastro(iso: string, agora: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const [dd, mm, aaaa] = dia.format(d).split('/');
  return `cadastro em ${dd}/${mm}${aaaa === anoDe(agora) ? '' : `/${aaaa}`}`;
}

export type ConversaDoContato = {
  conversaId: string | null; estado: 'agente' | 'humano' | null; atendenteId: string | null; atendenteNome: string | null; esperaDesde: string | null;
};
export type TomConversa = 'espera' | 'pessoa' | 'agente' | 'sem';

/** Uma linha da tabela: o contato, as empresas ativas e a conversa que a pessoa vê. */
export type LinhaContato = ConversaDoContato & {
  id: string; nome: string; telefone: string; agentePausado: boolean; vinculos: Vinculo[]; ultimoEm: string | null;
};

/**
 * Estado de agora da conversa (D15). Sem conversa: quem vê todas as conversas lê "sem conversa"; os outros, "nenhuma conversa
 * visível" — a regra de leitura pode esconder uma que existe (D2).
 */
export function estadoDaConversa(c: ConversaDoContato, ctx: { euId: string; veTodas: boolean }): { texto: string; tom: TomConversa } {
  if (!c.conversaId) return { texto: ctx.veTodas ? 'sem conversa' : 'nenhuma conversa visível', tom: 'sem' };
  if (c.esperaDesde) return { texto: 'esperando pessoa', tom: 'espera' };
  if (c.estado === 'humano') {
    const quem = c.atendenteId === ctx.euId ? 'você' : (c.atendenteNome?.trim().split(/\s+/)[0] || 'a equipe');
    return { texto: `com ${quem}`, tom: 'pessoa' };
  }
  return { texto: 'com o agente', tom: 'agente' };
}

/** "esperando pessoa · 18 min" (bloco WhatsApp do painel); os outros estados sem tempo. */
export function textoConversaAgora(c: ConversaDoContato, ctx: { euId: string; veTodas: boolean }, agora: Date): string {
  const e = estadoDaConversa(c, ctx);
  return e.tom === 'espera' && c.esperaDesde ? `${e.texto} · ${textoEspera(minutosDeEspera(c.esperaDesde, agora.getTime()))}` : e.texto;
}

export type ResumoWhatsapp = { atendimentos: number; resolvidas: number };

/** contato_whatsapp_resumo(); qualquer coisa estranha vira null (o painel mostra "—"). */
export function lerResumoWhatsapp(v: unknown): ResumoWhatsapp | null {
  const o = v as { atendimentos?: unknown; resolvidas_agente?: unknown } | null;
  if (!o || typeof o.atendimentos !== 'number' || typeof o.resolvidas_agente !== 'number') return null;
  if (o.atendimentos < 0 || o.resolvidas_agente < 0 || o.resolvidas_agente > o.atendimentos) return null;
  return { atendimentos: o.atendimentos, resolvidas: o.resolvidas_agente };
}

export const textoResolvidas = (r: ResumoWhatsapp | null): string =>
  (r && r.atendimentos > 0 ? `${Math.round((100 * r.resolvidas) / r.atendimentos)}%` : '—');

export function textoAtendimentos(r: ResumoWhatsapp | null): string | null {
  if (!r) return null;
  return r.atendimentos === 1 ? '1 atendimento' : `${r.atendimentos} atendimentos`;
}

export const hrefConversa = (id: string): string => `/atendimento/${id}`;
```

- [ ] **Passo 3: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/contatos.test.ts && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo verde.

- [ ] **Passo 4: commit**

```bash
git add apps/painel/src/lib/contatos.ts apps/painel/src/lib/contatos.test.ts
git commit -m "feat(painel): regras de Contatos — filtros da URL e da consulta, selos por empresa e textos do último contato e da conversa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Painel. Leitores de Contatos (com a volta sem a visão, D14)

**Files:**
- Create: `contatos/dados-contatos.ts`, `contatos/dados-contatos.test.ts`

**Interfaces:**
- Consumes: Task 2 (`aplicarFiltrosContatos`, `lerEmpresasDaVisao`, `lerResumoWhatsapp`, `nomeEmpresa`, tipos); `paginar`, `faixaDaConsulta` (`lib/tabela-url.ts`); `Prioridade` (`lib/demandas.ts`); visão `contatos_lista` e função `contato_whatsapp_resumo` (Task 1); `contatos`, `caixa_entrada`, `usuarios`, `clientes`, `demandas_lista` (já no banco).
- Produces: `POR_PAGINA`; `Contagens`; `ListaContatos`; `semVisao(e)`; `lerListaContatos(sb, f, ordem, pagina, agora)`; `lerEmpresasAtivas(sb)`; `ContatoAberto`, `lerContato(sb, id)`; `WhatsappDoContato`, `lerWhatsappDoContato(sb, { id, telefone })`; `DemandaDoContato`, `lerDemandasDoContato(sb, contatoId)`.

- [ ] **Passo 1: escrever os testes que falham**

`contatos/dados-contatos.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// Banco falso: cada consulta grava os métodos chamados; o cenário de cada teste decide a resposta olhando a consulta.
type Op = [string, unknown[]];
type Consulta = { tabela: string; ops: Op[] };
const SEM_FUNCAO = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
const cenario = {
  responder: (_c: Consulta): unknown => ({ data: null, error: { code: 'XX000', message: 'sem cenário' } }),
  rpc: {} as Record<string, unknown>,
  consultas: [] as Consulta[],
};

function clienteFalso() {
  return {
    rpc: (nome: string) => Promise.resolve(nome in cenario.rpc ? cenario.rpc[nome] : SEM_FUNCAO),
    from: (tabela: string) => {
      const c: Consulta = { tabela, ops: [] };
      cenario.consultas.push(c);
      const cadeia: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'is', 'in', 'or', 'contains', 'gte', 'lt', 'order', 'range', 'limit']) {
        cadeia[m] = (...a: unknown[]) => { c.ops.push([m, a]); return cadeia; };
      }
      cadeia.maybeSingle = () => Promise.resolve(cenario.responder(c));
      cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(cenario.responder(c)).then(ok, erro);
      return cadeia;
    },
  };
}

const { lerListaContatos, lerWhatsappDoContato } = await import('./dados-contatos');
const sb = () => clienteFalso() as never;
const tem = (c: Consulta, m: string, ...a: unknown[]) => c.ops.some(([n, args]) => n === m && JSON.stringify(args) === JSON.stringify(a));
const ehContagem = (c: Consulta) => c.ops.some(([n, a]) => n === 'select' && (a[1] as { head?: boolean } | undefined)?.head === true);
const AGORA = new Date('2026-10-09T15:00:00-03:00');
const SEM_FILTRO = { q: null, rapido: null, empresa: null, periodo: null };
const ORDEM = { coluna: 'ultimo', direcao: 'desc' } as const;
const logs = () => vi.mocked(console.error).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  cenario.consultas = [];
  cenario.rpc = {};
  vi.spyOn(console, 'error').mockReset().mockImplementation(() => {});
});

describe('lerListaContatos', () => {
  it('cinco contagens, cada uma com o seu filtro rápido e a mesma busca; o total segue o filtro escolhido (D4)', async () => {
    cenario.responder = (c) => {
      if (c.tabela !== 'contatos_lista') return { data: null, error: { code: 'XX000', message: 'inesperado' } };
      if (!ehContagem(c)) return { data: [], error: null };
      const n = tem(c, 'eq', 'agente_pausado', true) ? 9 : tem(c, 'eq', 'n_empresas', 0) ? 4
        : tem(c, 'eq', 'pode_pedir_nota_alguma', true) ? 58 : tem(c, 'eq', 'muda_preco_alguma', true) ? 17 : 214;
      return { data: null, count: n, error: null };
    };
    const r = await lerListaContatos(sb(), { ...SEM_FILTRO, q: 'Mercado', rapido: 'nota' }, ORDEM, 1, AGORA);
    expect(r.contagens).toEqual({ todos: 214, desligado: 9, sem_empresa: 4, nota: 58, preco: 17 });
    expect(r.paginacao.total).toBe(58);
    expect(r.completa).toBe(true);
    const lista = cenario.consultas.filter((c) => c.tabela === 'contatos_lista');
    expect(lista).toHaveLength(6);
    for (const c of lista) {
      expect(tem(c, 'eq', 'ativo', true)).toBe(true);
      expect(c.ops.some(([n]) => n === 'or')).toBe(true);
    }
    const pagina = lista.find((c) => !ehContagem(c))!;
    expect(tem(pagina, 'eq', 'pode_pedir_nota_alguma', true)).toBe(true);
    expect(tem(pagina, 'order', 'ultimo_contato_em', { ascending: false, nullsFirst: false })).toBe(true);
    expect(tem(pagina, 'range', 0, 49)).toBe(true);
    expect(logs()).toEqual([]);
  });

  it('sem a visão (homologação antes do "ok", D14): pelo nome em contatos, sem contagens, conversa pela caixa_entrada, nada no log', async () => {
    cenario.responder = (c) => {
      if (c.tabela === 'contatos_lista') return { data: null, count: null, error: { code: 'PGRST205', message: 'Could not find the table' } };
      if (c.tabela === 'contatos') {
        return ehContagem(c) ? { data: null, count: 1, error: null } : {
          data: [{ id: 'c1', nome: 'Carla', telefone: '5511977772211', agente_pausado: false, contato_clientes: [
            { pode_pedir_nota: true, pode_atualizar_preco: false, clientes: { id: 'e1', razao_social: 'Rede Bom Preço Ltda', nome_fantasia: null, ativo: true } },
            { pode_pedir_nota: false, pode_atualizar_preco: true, clientes: { id: 'e2', razao_social: 'Zeta', nome_fantasia: null, ativo: false } },
          ] }],
          error: null,
        };
      }
      if (c.tabela === 'caixa_entrada') {
        return { data: [{ id: 'k1', telefone: '5511977772211', ultima_em: '2026-10-09T14:48:00-03:00', estado: 'agente', atendente_id: null, espera_desde: '2026-10-09T14:30:00-03:00' }], error: null };
      }
      return { data: null, error: { code: 'XX000', message: 'inesperado' } };
    };
    const r = await lerListaContatos(sb(), { ...SEM_FILTRO, q: 'Carla' }, ORDEM, 1, AGORA);
    expect(r).toMatchObject({ completa: false, contagens: null, erro: false });
    expect(r.linhas).toEqual([expect.objectContaining({
      id: 'c1', conversaId: 'k1', ultimoEm: '2026-10-09T14:48:00-03:00', esperaDesde: '2026-10-09T14:30:00-03:00',
      vinculos: [{ empresaId: 'e1', empresa: 'Rede Bom Preço Ltda', podePedirNota: true, podeMudarPreco: false }],
    })]);
    const pagina = cenario.consultas.find((c) => c.tabela === 'contatos' && !ehContagem(c))!;
    expect(tem(pagina, 'order', 'nome')).toBe(true);
    expect(logs()).toEqual([]);
  });

  it('falha que não é falta da visão: erro na tela e no log', async () => {
    cenario.responder = () => ({ data: null, count: null, error: { code: 'XX000', message: 'caiu' } });
    const r = await lerListaContatos(sb(), SEM_FILTRO, ORDEM, 1, AGORA);
    expect(r).toMatchObject({ erro: true, contagens: null, linhas: [] });
    expect(logs()).toContain('[contatos] falha ao contar a lista');
  });
});

describe('lerWhatsappDoContato', () => {
  it('sem a função do resumo (PGRST202): sem %, sem log; sem conversa visível: tudo vazio', async () => {
    cenario.responder = (c) => (c.tabela === 'caixa_entrada' ? { data: null, error: null } : { data: null, error: { code: 'XX000', message: '?' } });
    const w = await lerWhatsappDoContato(sb(), { id: 'c1', telefone: '5511977772211' });
    expect(w).toEqual({ conversaId: null, estado: null, atendenteId: null, atendenteNome: null, esperaDesde: null, ultimaEm: null, resumo: null });
    expect(logs()).toEqual([]);
  });
  it('resumo e o nome de quem atende', async () => {
    cenario.rpc = { contato_whatsapp_resumo: { data: { atendimentos: 47, resolvidas_agente: 33 }, error: null } };
    cenario.responder = (c) => (c.tabela === 'caixa_entrada'
      ? { data: { id: 'k1', ultima_em: '2026-10-09T14:48:00-03:00', estado: 'humano', atendente_id: 'u2', espera_desde: null }, error: null }
      : c.tabela === 'usuarios' ? { data: { nome: 'Ana Souza' }, error: null } : { data: null, error: { code: 'XX000', message: '?' } });
    const w = await lerWhatsappDoContato(sb(), { id: 'c1', telefone: '5511977772211' });
    expect(w).toMatchObject({ conversaId: 'k1', estado: 'humano', atendenteNome: 'Ana Souza', resumo: { atendimentos: 47, resolvidas: 33 } });
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/contatos/dados-contatos.test.ts"`
Expected: FAIL — `Cannot find module './dados-contatos'`.

- [ ] **Passo 2: implementar `contatos/dados-contatos.ts`**

```ts
import 'server-only';
import {
  aplicarFiltrosContatos, lerEmpresasDaVisao, lerResumoWhatsapp, nomeEmpresa,
  type ConsultaContatos, type ConversaDoContato, type FiltroRapido, type FiltrosContatos, type LinhaContato, type ResumoWhatsapp, type Vinculo,
} from '@/lib/contatos';
import type { Prioridade } from '@/lib/demandas';
import type { supabaseServidor } from '@/lib/supabase/servidor';
import { faixaDaConsulta, paginar, type Ordem, type Paginacao } from '@/lib/tabela-url';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

export const POR_PAGINA = 50;
const COLUNAS = 'id, nome, telefone, agente_pausado, empresas, conversa_id, ultimo_contato_em, estado_conversa, atendente_id, atendente_nome, espera_desde';

export type Contagens = Record<'todos' | FiltroRapido, number>;
/** `completa` falso: banco sem a visão da G3 (D14) — lista pelo nome, sem filtros rápidos, empresa e período. */
export type ListaContatos = { linhas: LinhaContato[]; paginacao: Paginacao; contagens: Contagens | null; completa: boolean; erro: boolean };

/** A visão da G3 ainda não existe no banco: o PostgREST novo diz PGRST205; o antigo, 42P01. */
export const semVisao = (e: { code?: string } | null | undefined): boolean => e?.code === 'PGRST205' || e?.code === '42P01';

interface Consulta extends ConsultaContatos<Consulta> {}
const filtrar = <T,>(q: T, f: FiltrosContatos, agora: Date, rapido: FiltroRapido | null): T =>
  aplicarFiltrosContatos(q as unknown as Consulta, f, agora, rapido) as unknown as T;

type LinhaVisao = {
  id: string; nome: string; telefone: string; agente_pausado: boolean; empresas: unknown; conversa_id: string | null;
  ultimo_contato_em: string | null; estado_conversa: 'agente' | 'humano' | null; atendente_id: string | null; atendente_nome: string | null;
  espera_desde: string | null;
};

const paraLinha = (r: LinhaVisao): LinhaContato => ({
  id: r.id, nome: r.nome, telefone: r.telefone, agentePausado: r.agente_pausado, vinculos: lerEmpresasDaVisao(r.empresas),
  conversaId: r.conversa_id, ultimoEm: r.ultimo_contato_em, estado: r.estado_conversa, atendenteId: r.atendente_id,
  atendenteNome: r.atendente_nome, esperaDesde: r.espera_desde,
});

const SEM_LISTA = (erro: boolean): ListaContatos => ({ linhas: [], paginacao: paginar(0, 1, POR_PAGINA), contagens: null, completa: true, erro });

/**
 * A lista (spec 7C.2): cinco contagens (Todos e os quatro filtros rápidos, D4) e a página pedida, tudo em contatos_lista,
 * pela regra de leitura de quem consulta. Sem a visão no banco, a leitura de antes (D14).
 */
export async function lerListaContatos(sb: Sb, f: FiltrosContatos, ordem: Ordem, paginaPedida: number, agora: Date): Promise<ListaContatos> {
  const contar = (rapido: FiltroRapido | null) => filtrar(sb.from('contatos_lista').select('id', { count: 'exact', head: true }), f, agora, rapido);
  const [todos, desligado, semEmpresa, nota, preco] = await Promise.all([contar(null), contar('desligado'), contar('sem_empresa'), contar('nota'), contar('preco')]);
  if (semVisao(todos.error)) return lerListaSemVisao(sb, f, paginaPedida);
  const falha = [todos, desligado, semEmpresa, nota, preco].find((r) => r.error)?.error;
  if (falha) {
    console.error('[contatos] falha ao contar a lista', falha);
    return SEM_LISTA(true);
  }
  const contagens: Contagens = {
    todos: todos.count ?? 0, desligado: desligado.count ?? 0, sem_empresa: semEmpresa.count ?? 0, nota: nota.count ?? 0, preco: preco.count ?? 0,
  };
  const total = f.rapido ? contagens[f.rapido] : contagens.todos;
  const ler = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    const base = filtrar(sb.from('contatos_lista').select(COLUNAS), f, agora, f.rapido);
    const ordenada = ordem.coluna === 'nome'
      ? base.order('nome', { ascending: ordem.direcao === 'asc' })
      : base.order('ultimo_contato_em', { ascending: ordem.direcao === 'asc', nullsFirst: false });
    return ordenada.order('nome').order('id').range(de, ate);
  };
  let paginacao = paginar(total, paginaPedida, POR_PAGINA);
  let r = await ler(paginacao);
  // A lista encolheu entre a contagem e a página: volta para a primeira em vez de mostrar erro.
  if (r.error?.code === 'PGRST103') {
    paginacao = paginar(total, 1, POR_PAGINA);
    r = await ler(paginacao);
  }
  if (r.error) console.error('[contatos] falha ao ler a lista', r.error);
  return { linhas: ((r.data ?? []) as unknown as LinhaVisao[]).map(paraLinha), paginacao, contagens, completa: true, erro: Boolean(r.error) };
}

type Basica = { eq(coluna: string, valor: boolean): Basica; or(filtros: string): Basica };

/** A leitura de antes da G3 (D14): contatos pelo nome; último contato e estado da caixa_entrada (Parte E) só para a página. */
async function lerListaSemVisao(sb: Sb, f: FiltrosContatos, paginaPedida: number): Promise<ListaContatos> {
  const basico = <T,>(q: T): T => {
    let r = (q as unknown as Basica).eq('ativo', true);
    if (f.q) r = r.or(`nome.ilike.%${f.q}%,telefone.ilike.%${f.q.replace(/\D/g, '') || f.q}%`);
    if (f.rapido === 'desligado') r = r.eq('agente_pausado', true);
    return r as unknown as T;
  };
  const contados = await basico(sb.from('contatos').select('id', { count: 'exact', head: true }));
  if (contados.error) {
    console.error('[contatos] falha ao contar a lista', contados.error);
    return { ...SEM_LISTA(true), completa: false };
  }
  const total = contados.count ?? 0;
  const ler = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    return basico(sb.from('contatos')
      .select('id, nome, telefone, agente_pausado, contato_clientes(pode_pedir_nota, pode_atualizar_preco, clientes(id, razao_social, nome_fantasia, ativo))'))
      .order('nome').order('id').range(de, ate);
  };
  let paginacao = paginar(total, paginaPedida, POR_PAGINA);
  let r = await ler(paginacao);
  if (r.error?.code === 'PGRST103') {
    paginacao = paginar(total, 1, POR_PAGINA);
    r = await ler(paginacao);
  }
  if (r.error) {
    console.error('[contatos] falha ao ler a lista', r.error);
    return { linhas: [], paginacao, contagens: null, completa: false, erro: true };
  }
  const contatos = r.data ?? [];
  const telefones = contatos.map((c) => c.telefone);
  const caixa = telefones.length
    ? await sb.from('caixa_entrada').select('id, telefone, ultima_em, estado, atendente_id, espera_desde').in('telefone', telefones)
    : { data: [], error: null };
  if (caixa.error) console.error('[contatos] falha ao ler as conversas da página', caixa.error);
  const porTelefone = new Map((caixa.data ?? []).map((l) => [l.telefone, l]));
  const linhas: LinhaContato[] = contatos.map((c) => {
    const l = porTelefone.get(c.telefone);
    return {
      id: c.id, nome: c.nome, telefone: c.telefone, agentePausado: c.agente_pausado,
      vinculos: c.contato_clientes.flatMap((v) => (v.clientes?.ativo
        ? [{ empresaId: v.clientes.id, empresa: nomeEmpresa(v.clientes), podePedirNota: v.pode_pedir_nota, podeMudarPreco: v.pode_atualizar_preco }]
        : [])),
      conversaId: l?.id ?? null, ultimoEm: l?.ultima_em ?? null, estado: l?.estado ?? null, atendenteId: l?.atendente_id ?? null,
      atendenteNome: null, esperaDesde: l?.espera_desde ?? null,
    };
  });
  return { linhas, paginacao, contagens: null, completa: false, erro: false };
}

/** Empresas ativas para o seletor da barra e o "vincular empresa" (D5, D10). `detalhe` é o CNPJ (a busca do EscolherEmpresa). */
export async function lerEmpresasAtivas(sb: Sb): Promise<{ id: string; nome: string; detalhe: string }[]> {
  const { data, error } = await sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('ativo', true).order('razao_social');
  if (error) console.error('[contatos] falha ao ler as empresas', error);
  return (data ?? []).map((c) => ({ id: c.id, nome: nomeEmpresa(c), detalhe: c.cnpj }));
}

export type ContatoAberto = {
  id: string; nome: string; telefone: string; agentePausado: boolean; ativo: boolean; criadoEm: string;
  arquivadoEm: string | null; arquivadoPor: string | null; vinculos: Vinculo[];
};

/** O contato do painel, só com tabelas que já existem no banco de todos (D14). Empresas arquivadas ficam de fora (D5). */
export async function lerContato(sb: Sb, id: string): Promise<ContatoAberto | null> {
  const { data: c, error } = await sb.from('contatos')
    .select('id, nome, telefone, agente_pausado, ativo, criado_em, arquivado_em, arquivado_por, contato_clientes(pode_pedir_nota, pode_atualizar_preco, clientes(id, razao_social, nome_fantasia, ativo))')
    .eq('id', id).maybeSingle();
  if (error) console.error('[contatos] falha ao ler o contato', error);
  if (!c) return null;
  const vinculos = c.contato_clientes
    .flatMap((v) => (v.clientes?.ativo
      ? [{ empresaId: v.clientes.id, empresa: nomeEmpresa(v.clientes), podePedirNota: v.pode_pedir_nota, podeMudarPreco: v.pode_atualizar_preco }]
      : []))
    .sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'));
  return {
    id: c.id, nome: c.nome, telefone: c.telefone, agentePausado: c.agente_pausado, ativo: c.ativo, criadoEm: c.criado_em,
    arquivadoEm: c.arquivado_em, arquivadoPor: c.arquivado_por, vinculos,
  };
}

export type WhatsappDoContato = ConversaDoContato & { ultimaEm: string | null; resumo: ResumoWhatsapp | null };

/** Bloco WhatsApp do painel: a conversa pela caixa_entrada (regra de leitura) e o resumo novo, que pode faltar (D14). */
export async function lerWhatsappDoContato(sb: Sb, c: { id: string; telefone: string }): Promise<WhatsappDoContato> {
  const [caixa, resumo] = await Promise.all([
    sb.from('caixa_entrada').select('id, ultima_em, estado, atendente_id, espera_desde').eq('telefone', c.telefone).maybeSingle(),
    sb.rpc('contato_whatsapp_resumo', { p_contato: c.id }),
  ]);
  if (caixa.error) console.error('[contatos] falha ao ler a conversa do contato', caixa.error);
  // PGRST202: banco sem a migração da G3 (D14) — esperado, não vai para o log.
  if (resumo.error && resumo.error.code !== 'PGRST202') console.error('[contatos] falha ao ler o resumo do WhatsApp', resumo.error);
  const atendenteId = caixa.data?.atendente_id ?? null;
  const atendenteNome = atendenteId
    ? (await sb.from('usuarios').select('nome').eq('id', atendenteId).maybeSingle()).data?.nome ?? null
    : null;
  return {
    conversaId: caixa.data?.id ?? null, estado: caixa.data?.estado ?? null, atendenteId, atendenteNome,
    esperaDesde: caixa.data?.espera_desde ?? null, ultimaEm: caixa.data?.ultima_em ?? null,
    resumo: resumo.error ? null : lerResumoWhatsapp(resumo.data),
  };
}

export type DemandaDoContato = { id: string; numero: number; titulo: string; prioridade: Prioridade; prazo: string | null; pausadoDesde: string | null };

/** Demandas abertas do contato (D16): demandas_lista (regra de leitura), até 10, pelo prazo. null = falha de leitura. */
export async function lerDemandasDoContato(sb: Sb, contatoId: string): Promise<{ linhas: DemandaDoContato[]; total: number } | null> {
  const { data, count, error } = await sb.from('demandas_lista')
    .select('id, numero, titulo, prioridade, prazo_em, prazo_pausado_desde', { count: 'exact' })
    .eq('contato_id', contatoId).neq('status', 'concluido')
    .order('prazo_em', { ascending: true, nullsFirst: false }).order('numero').limit(10);
  if (error) {
    console.error('[contatos] falha ao ler as demandas do contato', error);
    return null;
  }
  const linhas = (data ?? []).flatMap((d) => (d.id && d.numero !== null && d.titulo !== null && d.prioridade
    ? [{ id: d.id, numero: d.numero, titulo: d.titulo, prioridade: d.prioridade, prazo: d.prazo_em, pausadoDesde: d.prazo_pausado_desde }]
    : []));
  return { linhas, total: count ?? linhas.length };
}
```

(Se o typecheck reclamar de `sb.rpc('contato_whatsapp_resumo', …)`, confira que a Task 1 regerou `tipos.gen.ts`. Se reclamar do `.order().order().range()` depois de `filtrar`, o tipo do construtor se perdeu no genérico: mantenha `filtrar<T>` devolvendo `T`, como `filtrarConsulta` de `lib/demandas-consulta.ts`.)

- [ ] **Passo 3: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/contatos/dados-contatos.test.ts" && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo verde.

- [ ] **Passo 4: commit**

```bash
git add "apps/painel/src/app/(painel)/contatos/dados-contatos.ts" "apps/painel/src/app/(painel)/contatos/dados-contatos.test.ts"
git commit -m "feat(painel): leitores de Contatos — contagens e página no servidor, e a leitura de antes quando o banco ainda não tem a visão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lista. Barra com busca, filtros rápidos, empresa e período; tabela pelo último contato; ações da linha

**Files:**
- Modify: `contatos/page.tsx` (reescrito), `contatos/loading.tsx`, `contatos/marcacoes.tsx` (reescrito), `contatos/detalhe-contato.tsx` (só os imports dos selos)
- Create: `contatos/barra-contatos.tsx`, `contatos/colunas-contatos.tsx`, `contatos/acoes-linha.tsx`, `contatos/hidratado.tsx`
- Modify: `apps/painel/src/components/patterns/switch-agente-contato.tsx` (texto curto)
- Create: `apps/painel/e2e/apoio-contatos.ts`, `apps/painel/e2e/contatos-lista.spec.ts`
- Modify: `apps/painel/e2e/contatos.spec.ts`, `apps/painel/e2e/arquivar-contatos.spec.ts`

**Interfaces:**
- Consumes: Tasks 2 e 3; `FilterBar`, `DataTable`, `ColunaTabela`, `ExcluirCadastro`, `PermissionGate`, `LinkArquivados`, `TelaArquivados`, `PainelLateralUrl`, `FormCadastroContato`, `BotaoCadastrarContato`; `iniciais` (`lib/atendimento.ts`); `mascararTelefone` (`lib/formatos.ts`); `alternarAgenteContato` (`atendimento/acoes.ts`).
- Produces: `BarraContatos`, `colunasContatos`, `BotaoAbrirConversa`, `AcoesLinhaContato`, `motivoSemConversa`, `Hidratado`, `SelosContato`; `SwitchAgenteContato` com `estadoCurto`; no e2e: `abrirContatos`, `contagemFiltro`, `linhaContato`, `PREFIXO`, `limparG3`, `semearContatos`, `conversaCom`, `minAtras`.

- [ ] **Passo 1: escrever os e2e que falham (novos e ajustados)**

`apps/painel/e2e/apoio-contatos.ts`:

```ts
import { expect, type Page } from '@playwright/test';
import { db } from './apoio';

export const PREFIXO = 'G3E2E';
export const minAtras = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

/**
 * Abre Contatos e espera o navegador assumir a página (data-contatos-hidratado, marcado num useEffect). Digitar ou clicar
 * antes disso perde a ação (mesmo cuidado do abrirInicio da G2).
 */
export async function abrirContatos(page: Page, consulta = ''): Promise<void> {
  await page.goto(`/contatos${consulta}`);
  await expect(page.locator('[data-contatos-hidratado]')).toHaveCount(1, { timeout: 30_000 });
}

/** Número de um filtro rápido (contrato data-filtro/data-contagem). */
export async function contagemFiltro(page: Page, filtro: string): Promise<number> {
  return Number((await page.locator(`[data-filtro="${filtro}"] [data-contagem]`).innerText()).trim());
}

/** Linha da tabela pelo texto. Por CSS: com o painel aberto, a tabela fica aria-hidden e getByRole não a acha. */
export const linhaContato = (page: Page, texto: string) => page.locator('tbody tr').filter({ hasText: texto });

/** Apaga o que os testes da G3 criaram (demandas, conversas, contatos e empresas com o prefixo). */
export async function limparG3(): Promise<void> {
  await db.from('chamados').delete().like('titulo', `${PREFIXO}%`);
  const { data: cs } = await db.from('contatos').select('telefone').like('nome', `${PREFIXO}%`);
  const telefones = (cs ?? []).map((c) => c.telefone);
  if (telefones.length) await db.from('conversas').delete().in('telefone', telefones);
  await db.from('contatos').delete().like('nome', `${PREFIXO}%`);
  await db.from('clientes').delete().like('razao_social', `${PREFIXO}%`);
}

/** Conversa com mensagens em horários dados (a mais nova é o "último contato"). */
export async function conversaCom(
  telefone: string, contatoId: string | null, mensagens: { autor: 'cliente' | 'agente' | 'atendente'; em: string }[], extra: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await db.from('conversas').insert({ telefone, contato_id: contatoId, ...extra }).select('id').single();
  if (error) throw error;
  for (const m of mensagens) {
    const entrada = m.autor === 'cliente';
    await db.from('mensagens').insert({
      conversa_id: data.id, direcao: entrada ? 'entrada' : 'saida', autor: m.autor, tipo: 'texto', conteudo: 'oi',
      criado_em: m.em, processada_em: entrada ? m.em : null,
    });
  }
  return data.id;
}

/**
 * Rede e Mercado (ativas), Zeta (arquivada) e Padaria (ativa, sem ninguém). Carla: Rede (pede nota), Mercado (nada) e Zeta (muda
 * preço, arquivada), esperando pessoa há 9 min; Roberto: Rede (pede nota e muda preço), com o agente; Sandra: sem empresa,
 * agente desligado, sem conversa.
 */
export async function semearContatos() {
  const empresa = async (razao: string, cnpj: string, ativo = true) =>
    (await db.from('clientes').insert({ razao_social: `${PREFIXO} ${razao}`, cnpj, ativo }).select('id').single()).data!.id;
  const rede = await empresa('Rede Bom Preço Ltda', '31000000000101');
  const mercado = await empresa('Mercado Central', '31000000000202');
  const zeta = await empresa('Zeta Arquivada', '31000000000303', false);
  const padaria = await empresa('Padaria Sol', '31000000000404');
  const contato = async (nome: string, telefone: string, agente_pausado = false) =>
    (await db.from('contatos').insert({ nome: `${PREFIXO} ${nome}`, telefone, agente_pausado }).select('id').single()).data!.id;
  const carla = await contato('Carla Mendes', '5531980020001');
  const roberto = await contato('Roberto Nunes', '5531980020002');
  const sandra = await contato('Sandra Costa', '5531980020003', true);
  await db.from('contato_clientes').insert([
    { contato_id: carla, cliente_id: rede, pode_pedir_nota: true },
    { contato_id: carla, cliente_id: mercado },
    { contato_id: carla, cliente_id: zeta, pode_atualizar_preco: true },
    { contato_id: roberto, cliente_id: rede, pode_pedir_nota: true, pode_atualizar_preco: true },
  ]);
  const conversaCarla = await conversaCom('5531980020001', carla, [{ autor: 'cliente', em: minAtras(10) }], { aguardando_pessoa_desde: minAtras(9) });
  await db.from('conversa_eventos').insert({ conversa_id: conversaCarla, tipo: 'passou_para_pessoa', criado_em: minAtras(9) });
  await conversaCom('5531980020002', roberto, [{ autor: 'cliente', em: minAtras(121) }, { autor: 'agente', em: minAtras(120) }]);
  return { rede, mercado, zeta, padaria, carla, roberto, sandra, conversaCarla };
}
```

`apps/painel/e2e/contatos-lista.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirContatos, contagemFiltro, limparG3, linhaContato, PREFIXO, semearContatos } from './apoio-contatos';

const SENHA = 'senha-forte-123';
test.beforeEach(limparG3);
test.afterAll(limparG3);

async function comoAdmin(page: import('@playwright/test').Page) {
  await criarUsuarioTeste({ email: 'admin-g3@e2e.local', senha: SENHA, nome: 'Thiago G3', papel: 'admin' });
  await entrar(page, 'admin-g3@e2e.local', SENHA);
}

test('tabela: ordem pelo último contato, empresas ativas, selos "1 de 2", estado da conversa e a chave do agente', async ({ page }) => {
  const s = await semearContatos();
  await comoAdmin(page);
  await abrirContatos(page, `?q=${PREFIXO}`);
  const linhas = page.locator('tbody tr');
  await expect(linhas).toHaveCount(3);
  await expect(linhas.nth(0)).toContainText('Carla Mendes');
  await expect(linhas.nth(1)).toContainText('Roberto Nunes');
  await expect(linhas.nth(2)).toContainText('Sandra Costa'); // sem conversa: no fim (D19)

  const carla = linhaContato(page, 'Carla Mendes');
  await expect(carla).toContainText(`${PREFIXO} Rede Bom Preço Ltda`);
  await expect(carla).toContainText(`${PREFIXO} Mercado Central`);
  await expect(carla).not.toContainText('Zeta'); // empresa arquivada não aparece (D5)
  await expect(carla).toContainText('Pede nota · 1 de 2');
  await expect(carla).not.toContainText('Muda preço'); // a marcação era só na arquivada
  await expect(carla).toContainText(/(hoje|ontem) \d{2}:\d{2}/);
  await expect(carla).toContainText('esperando pessoa');
  await expect(carla.getByRole('link', { name: `Abrir a conversa com ${PREFIXO} Carla Mendes` })).toHaveAttribute('href', `/atendimento/${s.conversaCarla}`);

  const roberto = linhaContato(page, 'Roberto Nunes');
  await expect(roberto).toContainText('Pede nota');
  await expect(roberto).toContainText('Muda preço e cadastra produto');
  await expect(roberto).toContainText('com o agente');

  const sandra = linhaContato(page, 'Sandra Costa');
  await expect(sandra).toContainText('sem empresa');
  await expect(sandra).toContainText('sem conversa');
  await expect(sandra).toContainText('desligado');
  await expect(sandra.getByRole('button', { name: `Abrir a conversa com ${PREFIXO} Sandra Costa` })).toBeDisabled();
  await sandra.getByRole('switch', { name: /Ligar o agente/ }).click();
  await expect.poll(async () => (await db.from('contatos').select('agente_pausado').eq('id', s.sandra).single()).data!.agente_pausado).toBe(false);
});

test('busca pela empresa, filtros rápidos com contagem, seletor de empresa e período do último contato', async ({ page }) => {
  await semearContatos();
  await comoAdmin(page);
  await abrirContatos(page, `?q=${PREFIXO}`);
  expect({
    todos: await contagemFiltro(page, 'todos'), desligado: await contagemFiltro(page, 'desligado'),
    sem_empresa: await contagemFiltro(page, 'sem_empresa'), nota: await contagemFiltro(page, 'nota'), preco: await contagemFiltro(page, 'preco'),
  }).toEqual({ todos: 3, desligado: 1, sem_empresa: 1, nota: 2, preco: 1 });
  await page.locator('[data-filtro="nota"]').click();
  await expect(page).toHaveURL(/filtro=nota/);
  await expect(page.locator('[data-filtro="nota"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(linhaContato(page, 'Sandra Costa')).toHaveCount(0);

  // Busca pela empresa: a Carla não tem "Mercado" no nome (D20).
  await abrirContatos(page);
  await page.getByRole('searchbox', { name: 'Buscar por nome, telefone ou empresa' }).fill(`${PREFIXO} Mercado`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Carla Mendes');

  // Seletor de empresa e período.
  await abrirContatos(page, `?q=${PREFIXO}`);
  await page.getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('option', { name: `${PREFIXO} Rede Bom Preço Ltda` }).click();
  await expect(page).toHaveURL(/empresa=/);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await abrirContatos(page, `?q=${PREFIXO}&periodo=nunca`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Sandra Costa');
  expect(await contagemFiltro(page, 'todos')).toBe(1);
});

test('"Conversas dos meus setores" vê o contato, mas não a conversa de fora deles (contagens também)', async ({ page }) => {
  const s = await semearContatos();
  await criarUsuarioTeste({ email: 'ana-g3@e2e.local', senha: SENHA, nome: 'Ana G3', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-g3@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}`);
  const carla = linhaContato(page, 'Carla Mendes');
  await expect(carla).toContainText('nenhuma conversa visível');
  await expect(carla).not.toContainText('esperando pessoa');
  await expect(carla.getByRole('button', { name: `Abrir a conversa com ${PREFIXO} Carla Mendes` })).toBeDisabled();
  await abrirContatos(page, `?q=${PREFIXO}&periodo=nunca`);
  expect(await contagemFiltro(page, 'todos')).toBe(2); // Carla e Sandra: para a Ana, a Carla não tem conversa (D2)

  // Uma demanda do Fiscal na conversa da Carla: a Ana passa a ver a conversa (Parte D).
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  await db.from('chamados').insert({ conversa_id: s.conversaCarla, setor_id: fiscal!.id, titulo: `${PREFIXO} boleto` });
  await abrirContatos(page, `?q=${PREFIXO}`);
  await expect(linhaContato(page, 'Carla Mendes')).toContainText('esperando pessoa');
  await expect(linhaContato(page, 'Carla Mendes').getByRole('link', { name: `Abrir a conversa com ${PREFIXO} Carla Mendes` })).toBeVisible();
});

test('lista grande: 50 por página, contagem pelo servidor e a página seguinte', async ({ page }) => {
  await db.from('contatos').insert(Array.from({ length: 55 }, (_, i) => ({
    nome: `${PREFIXO} Pag ${String(i + 1).padStart(2, '0')}`, telefone: `55319800300${String(i + 1).padStart(2, '0')}`,
  })));
  await comoAdmin(page);
  await abrirContatos(page, `?q=${PREFIXO}%20Pag&ordem=nome&direcao=asc`);
  expect(await contagemFiltro(page, 'todos')).toBe(55);
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('Mostrando 1–50 de 55')).toBeVisible();
  await page.getByRole('link', { name: 'Próxima' }).click();
  await expect(page.getByText('Mostrando 51–55 de 55')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText(`${PREFIXO} Pag 51`);
});
```

Ajustes nos e2e da Parte B (grep feito: `grep -rn "agente desligado\|Editar Maria Arquivo" apps/painel/e2e`):
- `e2e/contatos.spec.ts`, linha `await expect(linha).toContainText('agente desligado');` → `await expect(linha).toContainText('desligado');` (D12: a linha diz "atende"/"desligado").
- `e2e/arquivar-contatos.spec.ts`, teste "lápis abre o contato…": o nome passa a ser **"a linha abre o contato e o nome muda ali; sem permissão não há edição"** e a linha `await linha(page, 'Maria Arquivo').getByRole('link', { name: 'Editar Maria Arquivo' }).click();` vira `await page.locator('tbody tr').filter({ hasText: 'Maria Arquivo' }).click();` (D6: o lápis saiu; até a Task 6 o painel ainda mostra o campo Nome direto). O resto do teste fica.

Run: `cd apps/painel && pnpm exec playwright test e2e/contatos-lista.spec.ts`
Expected: FAIL (`[data-contatos-hidratado]` não existe).

- [ ] **Passo 2: chave do agente com texto curto**

Em `apps/painel/src/components/patterns/switch-agente-contato.tsx`, troque a função `SwitchAgenteContato` por:

```tsx
/**
 * Liga/desliga o agente só para um contato (mesma server action de antes).
 * Nome acessível: a ação ("Ligar o agente para Maria" / "Desligar o agente para Maria"); o estado vai no aria-checked.
 * `mostrarEstado`: texto ao lado ("agente atende" / "agente desligado"), que muda junto com a chave; `estadoCurto`: só
 * "atende" / "desligado" (coluna Agente da lista de Contatos, G3 D12).
 * Sem permissão (`pode` falso): a chave aparece desabilitada, com o motivo no tooltip.
 */
export function SwitchAgenteContato({ mostrarEstado = false, estadoCurto = false, className, ...props }: Props & { mostrarEstado?: boolean; estadoCurto?: boolean; className?: string }) {
  const estado = useAgenteContato(props);
  const texto = estadoCurto ? (estado.atende ? 'atende' : 'desligado') : (estado.atende ? 'agente atende' : 'agente desligado');
  return (
    <span className={cn('inline-flex items-center gap-2', className)} data-sem-clique-linha>
      <ChaveAgenteContato nome={props.nome} pode={props.pode} {...estado} />
      {mostrarEstado && (
        <span className={cn('text-sm', estadoCurto && 'font-semibold', estado.atende ? 'text-agent-active' : 'text-agent-paused')}>{texto}</span>
      )}
    </span>
  );
}
```

- [ ] **Passo 3: selos, marca de hidratação e ações da linha**

`contatos/marcacoes.tsx` (reescrito):

```tsx
import { Badge } from '@/components/ui/badge';
import { selosDoContato, type Vinculo } from '@/lib/contatos';

const VARIANTE = { nota: 'success', preco: 'brand', conversa: 'neutral' } as const;

/** Marcações do contato como selos (imagem A, D11): " · 1 de 2" quando vale só em parte das empresas; o title diz em quais. */
export function SelosContato({ vinculos }: { vinculos: Vinculo[] }) {
  const selos = selosDoContato(vinculos);
  if (selos.length === 0) return <span className="text-subtle">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {selos.map((s) => <Badge key={s.tom} variant={VARIANTE[s.tom]} title={s.titulo}>{s.rotulo}</Badge>)}
    </span>
  );
}
```

Em `contatos/detalhe-contato.tsx` (temporário, até a Task 6 reescrever o painel): troque `import { MarcacoesContato, nomeEmpresa, type Vinculo } from './marcacoes';` por `import { nomeEmpresa, type Vinculo } from '@/lib/contatos';` e `import { SelosContato } from './marcacoes';`, e `<MarcacoesContato vinculos={[v]} vazio={<span className="text-sm text-muted">Só conversa (não pede nota nem muda preço)</span>} />` por `<SelosContato vinculos={[v]} />`.

`contatos/hidratado.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

/** Marca que o navegador assumiu a página (os e2e esperam por ela antes de digitar ou clicar). */
export function Hidratado() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return <span hidden data-contatos-hidratado={pronto ? '' : undefined} />;
}
```

`contatos/acoes-linha.tsx`:

```tsx
'use client';

import { MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { PermissionGate } from '@/components/patterns/permission-gate';
import { Button, variantesBotao } from '@/components/ui/button';
import { hrefConversa } from '@/lib/contatos';

/** Por que o "Abrir conversa" está desligado (D8). */
export function motivoSemConversa(podeConversa: boolean): string {
  return podeConversa
    ? 'Nenhuma conversa com este contato que você possa abrir. A conversa começa quando ele escreve no WhatsApp.'
    : 'Atendimento: Sem acesso. Peça ao administrador na aba Usuários.';
}

/** Abrir conversa: ícone na linha; botão com texto no painel (`grande`). Sem conversa visível ou sem Atendimento: desligado. */
export function BotaoAbrirConversa({ conversaId, nome, podeConversa, grande = false }: {
  conversaId: string | null; nome: string; podeConversa: boolean; grande?: boolean;
}) {
  const rotulo = `Abrir a conversa com ${nome}`;
  const icone = <MessageCircle aria-hidden size={16} strokeWidth={1.75} />;
  const conteudo = grande ? <>{icone}Abrir conversa</> : icone;
  if (conversaId && podeConversa) {
    return (
      <Link href={hrefConversa(conversaId)} aria-label={grande ? undefined : rotulo} title={rotulo}
        className={variantesBotao(grande ? { variant: 'primary', size: 'sm' } : { variant: 'outline', size: 'icon' })}>
        {conteudo}
      </Link>
    );
  }
  return (
    <PermissionGate permitido={false} modo="desabilitar" motivo={motivoSemConversa(podeConversa)}>
      <Button type="button" variant={grande ? 'primary' : 'outline'} size={grande ? 'sm' : 'icon'} aria-label={grande ? undefined : rotulo}>{conteudo}</Button>
    </PermissionGate>
  );
}

/** Ações da linha (spec 7C.2, D6): abrir conversa e arquivar (só com "Editar e arquivar"; o banco confere de novo). */
export function AcoesLinhaContato({ id, nome, conversaId, podeConversa, podeArquivar }: {
  id: string; nome: string; conversaId: string | null; podeConversa: boolean; podeArquivar: boolean;
}) {
  return (
    <span className="flex items-center justify-end gap-1">
      <BotaoAbrirConversa conversaId={conversaId} nome={nome} podeConversa={podeConversa} />
      {podeArquivar && <ExcluirCadastro tipo="contato" id={id} nome={nome} />}
    </span>
  );
}
```

- [ ] **Passo 4: colunas e barra**

`contatos/colunas-contatos.tsx`:

```tsx
import Link from 'next/link';
import type { ColunaTabela } from '@/components/patterns/data-table';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { iniciais } from '@/lib/atendimento';
import { cn } from '@/lib/cn';
import { estadoDaConversa, textoUltimoContato, type LinhaContato, type TomConversa } from '@/lib/contatos';
import { mascararTelefone } from '@/lib/formatos';
import { alternarAgenteContato } from '../atendimento/acoes';
import { SelosContato } from './marcacoes';

const TOM: Record<TomConversa, string> = { espera: 'font-semibold text-warning', pessoa: 'text-human-owned', agente: 'text-muted', sem: 'text-subtle' };
const MAX_EMPRESAS = 3;

/** Colunas da imagem A: contato + telefone, empresas, marcações, último contato + estado, agente. */
export function colunasContatos({ euId, veTodas, pode, agora }: { euId: string; veTodas: boolean; pode: boolean; agora: Date }): ColunaTabela<LinhaContato>[] {
  return [
    {
      id: 'nome', titulo: 'Contato', ordenavel: true, className: 'max-w-60',
      celula: (c) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{iniciais(c.nome)}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-foreground">{c.nome}</span>
            <span className="tabular text-sm text-muted">{mascararTelefone(c.telefone)}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'empresas', titulo: 'Empresas', className: 'w-full min-w-48 max-w-0', quebrar: true,
      celula: (c) => (c.vinculos.length === 0 ? <span className="italic text-subtle">sem empresa</span> : (
        <span className="flex min-w-0 flex-col">
          {c.vinculos.slice(0, MAX_EMPRESAS).map((v) => (
            <Link key={v.empresaId} href={`/clientes/${v.empresaId}?aba=contatos`} className="truncate font-semibold text-brand hover:underline">{v.empresa}</Link>
          ))}
          {c.vinculos.length > MAX_EMPRESAS && <span className="text-sm text-muted">+{c.vinculos.length - MAX_EMPRESAS}</span>}
        </span>
      )),
    },
    { id: 'marcacoes', titulo: 'Marcações', quebrar: true, celula: (c) => <SelosContato vinculos={c.vinculos} /> },
    {
      id: 'ultimo', titulo: 'Último contato', ordenavel: true,
      celula: (c) => {
        const e = estadoDaConversa(c, { euId, veTodas });
        return (
          <span className="flex flex-col">
            <span className="tabular text-foreground">{textoUltimoContato(c.ultimoEm, agora)}</span>
            <span className={cn('text-sm', TOM[e.tom])}>{e.texto}</span>
          </span>
        );
      },
    },
    {
      id: 'agente', titulo: 'Agente',
      celula: (c) => (
        <SwitchAgenteContato acao={alternarAgenteContato.bind(null, c.id, null, c.agentePausado)} desligado={c.agentePausado} nome={c.nome}
          pode={pode} mostrarEstado estadoCurto className="flex-col items-start gap-1" />
      ),
    },
  ];
}
```

`contatos/barra-contatos.tsx`:

```tsx
import { ArrowDownUp } from 'lucide-react';
import Link from 'next/link';
import { FilterBar } from '@/components/patterns/filter-bar';
import { cn } from '@/lib/cn';
import { FILTROS_RAPIDOS, PERIODOS_CONTATO, type FiltrosContatos } from '@/lib/contatos';
import { hrefComParams, type Ordem, type ParamsBusca } from '@/lib/tabela-url';
import type { Contagens } from './dados-contatos';

const chip = 'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-base transition-colors duration-150 ease-out';
const ligado = 'border-grafite bg-grafite text-grafite-foreground';
const desligado = 'border-input bg-surface text-foreground hover:bg-surface-muted';

/**
 * Busca (nome, telefone ou empresa), empresa e período na FilterBar; filtros rápidos com contagem (exclusivos, D4) e a ordem.
 * Sem a visão no banco (D14): só a busca, com o aviso.
 */
export function BarraContatos({ params, f, contagens, empresas, ordem, completa }: {
  params: ParamsBusca; f: FiltrosContatos; contagens: Contagens | null; empresas: { id: string; nome: string }[]; ordem: Ordem; completa: boolean;
}) {
  const href = (m: Record<string, string | null>) => `/contatos${hrefComParams(params, { ...m, contato: null, editar: null })}`;
  const porNome = ordem.coluna === 'nome';
  const opcoes = [{ valor: null, rotulo: 'Todos' }, ...FILTROS_RAPIDOS];
  return (
    <div className="mb-3 flex flex-col gap-3">
      <FilterBar
        busca={{ placeholder: 'Nome, telefone ou empresa', rotulo: 'Buscar por nome, telefone ou empresa' }}
        filtros={completa ? [
          { param: 'empresa', rotulo: 'Empresa', todos: 'todas', opcoes: empresas.map((e) => ({ valor: e.id, rotulo: e.nome })) },
          { param: 'periodo', rotulo: 'Último contato', todos: 'qualquer data', opcoes: PERIODOS_CONTATO.map((p) => ({ valor: p.valor, rotulo: p.rotulo })) },
        ] : []}
      />
      {!completa && (
        <p role="status" className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted">
          Lista pelo nome, sem filtros rápidos, empresa e período: falta a atualização do banco desta versão. A busca por nome ou telefone funciona.
        </p>
      )}
      {contagens && (
        <div className="flex flex-wrap items-center gap-2">
          <nav aria-label="Filtros rápidos" className="flex flex-wrap items-center gap-2">
            {opcoes.map((o) => {
              const ativo = f.rapido === o.valor;
              return (
                <Link key={o.valor ?? 'todos'} href={href({ filtro: o.valor })} scroll={false} aria-current={ativo ? 'true' : undefined}
                  data-filtro={o.valor ?? 'todos'} className={cn(chip, ativo ? ligado : desligado)}>
                  {o.rotulo}<strong data-contagem className="tabular">{contagens[o.valor ?? 'todos']}</strong>
                </Link>
              );
            })}
          </nav>
          <Link href={href(porNome ? { ordem: null, direcao: null } : { ordem: 'nome', direcao: 'asc' })} scroll={false}
            className="ml-auto inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ArrowDownUp aria-hidden size={14} strokeWidth={1.75} />
            Ordem: {porNome ? 'nome' : 'último contato'}
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Passo 5: `page.tsx` e `loading.tsx`**

`contatos/page.tsx` (reescrito):

```tsx
import { FilterX, UserPlus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { BotaoCadastrarContato, FormCadastroContato } from '@/components/patterns/form-cadastro-contato';
import { LinkArquivados, TelaArquivados } from '@/components/patterns/lista-arquivados';
import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';
import { variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { contarArquivados } from '@/lib/arquivados';
import { lerFiltrosContatos, ORDEM_PADRAO_CONTATOS, ORDENS_CONTATOS, temFiltroContatos } from '@/lib/contatos';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams, lerOrdem, lerPagina, PARAM_PAGINA, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { cadastrarContato } from './acoes';
import { AcoesLinhaContato } from './acoes-linha';
import { BarraContatos } from './barra-contatos';
import { colunasContatos } from './colunas-contatos';
import { lerEmpresasAtivas, lerListaContatos } from './dados-contatos';
import { DetalheContato, EsqueletoContato } from './detalhe-contato';
import { Hidratado } from './hidratado';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Contatos (spec 7C.2, imagem A): tabela pelo último contato, busca por nome, telefone ou empresa, filtros rápidos com contagem,
 * empresa e período — na URL e no servidor (visão contatos_lista, pela regra de leitura de cada pessoa).
 * ?contato=<id> abre o painel lateral; ?ver=arquivados, os arquivados.
 */
export default async function Contatos({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const params = await searchParams;
  const u = await obterUsuario();
  const pode = temNivel(u, 'clientes', 'editar');
  // Arquivar e restaurar exigem "Editar e arquivar" (Parte D); o banco (exigir_arquivar) recusa de novo.
  const podeArquivar = temNivel(u, 'clientes', 'arquivar');
  // Abrir conversa: a tela do Atendimento não abre com "Sem acesso"; a conversa ainda passa pela regra de leitura (D8).
  const podeConversa = temNivel(u, 'atendimento', 'meus_setores');
  const veTodas = temNivel(u, 'atendimento', 'todas');
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="contato" titulo="Contatos arquivados" voltar={{ rotulo: 'Contatos', href: '/contatos' }} pode={podeArquivar} />;
  }
  const f = lerFiltrosContatos(params);
  const ordem = lerOrdem(params, ORDENS_CONTATOS, ORDEM_PADRAO_CONTATOS)!;
  const aberto = valorParam(params, 'contato');
  const contatoAberto = aberto && UUID.test(aberto) ? aberto : null;
  const agora = new Date();
  const sb = await supabaseServidor();
  const [lista, arquivados, empresas] = await Promise.all([
    lerListaContatos(sb, f, ordem, lerPagina(params), agora),
    contarArquivados(sb, 'contato'),
    lerEmpresasAtivas(sb),
  ]);

  // Abrir e fechar o painel mantém a página da tabela.
  const pagina = lista.paginacao.pagina > 1 ? lista.paginacao.pagina : null;
  const hrefContato = (id: string | null) => `/contatos${hrefComParams(params, { contato: id, editar: null, [PARAM_PAGINA]: pagina })}`;
  const filtrando = temFiltroContatos(f);

  return (
    <section>
      <Hidratado />
      <PageHeader
        titulo="Contatos"
        contagem={lista.paginacao.total}
        descricao="Quem fala pelas empresas no WhatsApp."
        acoes={(
          <>
            <LinkArquivados href="/contatos?ver=arquivados" total={arquivados} />
            {pode && (
              // D7: o cadastro continua no cartão do fim da página (a pergunta do contato arquivado da Parte B vem junto).
              <a href="#novo-contato" className={variantesBotao({ size: 'sm' })}>
                <UserPlus aria-hidden size={16} strokeWidth={1.75} />
                Novo contato
              </a>
            )}
          </>
        )}
      />
      <BarraContatos params={params} f={f} contagens={lista.contagens} empresas={empresas} ordem={ordem} completa={lista.completa} />
      <DataTable
        rotulo="Contatos"
        linhas={lista.linhas}
        colunas={colunasContatos({ euId: u.id, veTodas, pode, agora })}
        chave={(c) => c.id}
        params={params}
        ordem={ordem}
        paginacao={lista.paginacao}
        acoesLinha={(c) => <AcoesLinhaContato id={c.id} nome={c.nome} conversaId={c.conversaId} podeConversa={podeConversa} podeArquivar={podeArquivar} />}
        hrefLinha={(c) => hrefContato(c.id)}
        linhaAtiva={contatoAberto}
        erro={lista.erro ? 'Não consegui carregar os contatos agora.' : undefined}
        vazio={filtrando ? (
          <EmptyState
            icone={FilterX}
            titulo="Nenhum contato encontrado."
            descricao="Confira o nome, o telefone ou a empresa, ou limpe os filtros."
            acao={<Link href="/contatos" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>}
          />
        ) : (
          <EmptyState icone={UsersRound} titulo="Nenhum contato cadastrado." descricao="Os contatos aparecem aqui quando alguém os cadastra pela conversa, pela ficha da empresa ou abaixo." />
        )}
      />

      {pode && (
        <Card id="novo-contato" className="mt-6 scroll-mt-20">
          <CardHeader>
            <CardTitle>Cadastrar contato</CardTitle>
            <CardDescription>Com ou sem empresa. Para ligar a uma empresa, abra o contato na lista e use &quot;Vincular empresa&quot;.</CardDescription>
          </CardHeader>
          <FormCadastroContato action={cadastrarContato}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Input name="nome" required placeholder="Nome" aria-label="Nome do contato" autoComplete="off" className="sm:w-56" />
              <Input name="telefone" required placeholder="Telefone (com DDD)" aria-label="Telefone (com DDD)" inputMode="tel" autoComplete="off" className="sm:w-56" />
              <label className="flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" name="agente_atende" defaultChecked className="size-4 shrink-0 accent-brand" />
                O agente atende
              </label>
              <BotaoCadastrarContato size="sm" className="sm:ml-auto">Cadastrar contato</BotaoCadastrarContato>
            </CardContent>
          </FormCadastroContato>
        </Card>
      )}

      {/* Sempre montado: abre na hora com esqueleto ao clicar na linha; o detalhe chega à parte (Suspense). */}
      <PainelLateralUrl param="contato" id={contatoAberto} hrefFechar={hrefContato(null)} esqueleto={<EsqueletoContato />} className="sm:max-w-lg">
        {contatoAberto && (
          <Suspense key={contatoAberto} fallback={<EsqueletoContato />}>
            <DetalheContato id={contatoAberto} pode={pode} podeArquivar={podeArquivar} admin={u.papel === 'admin'} />
          </Suspense>
        )}
      </PainelLateralUrl>
    </section>
  );
}
```

(Até a Task 6, `DetalheContato` mantém a assinatura de hoje. Antes de trocar a descrição do cartão, `grep -rn "Vincular contato já cadastrado" apps/painel/e2e` — os e2e procuram esse texto **na ficha da empresa**, que não muda.)

`contatos/loading.tsx`: troque as colunas do esqueleto por `colunas={['Contato', 'Empresas', 'Marcações', 'Último contato', 'Agente']}` e o bloco de esqueletos da barra por:

```tsx
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
```

- [ ] **Passo 6: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/contatos-lista.spec.ts e2e/contatos.spec.ts e2e/arquivar-contatos.spec.ts e2e/contato-conversa.spec.ts e2e/acessibilidade.spec.ts`
Expected: tudo verde (a acessibilidade já audita `/contatos`, `/contatos?ver=arquivados` e `/contatos?contato=<id>`).

- [ ] **Passo 7: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Contatos em tabela pelo último contato — busca por empresa, filtros rápidos com contagem, empresa, período e ações da linha

A linha diz atende/desligado embaixo da chave (contatos.spec ajustado) e o lápis saiu: a linha abre o painel
(arquivar-contatos ajustado).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Ações. Marcações por empresa e vincular empresa pelo contato

**Files:**
- Modify: `contatos/acoes.ts`
- Create: `contatos/acoes-empresas.test.ts`

**Interfaces:**
- Consumes: `obterUsuario`, `temNivel`, `supabaseServidor`; RLS `alterar`/`inserir` de `contato_clientes` (`editar_clientes`).
- Produces: `ResultadoAcao`; `CampoMarcacao = 'pode_pedir_nota' | 'pode_atualizar_preco'`; `marcarEmpresaDoContato(contatoId, clienteId, campo, valor): Promise<ResultadoAcao>`; `vincularEmpresaAoContato(contatoId, formData): Promise<ResultadoAcao>`.

- [ ] **Passo 1: escrever os testes que falham**

`contatos/acoes-empresas.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Parte G3 (spec 7C.2, D9, D10): marcações por empresa e vincular empresa pelo painel do contato, com a permissão de hoje.
const falso = vi.hoisted(() => ({
  nivel: 'editar' as 'ver' | 'editar',
  contatoAtivo: true as boolean | null,
  empresaAtiva: true as boolean | null,
  atualizadas: [{ cliente_id: 'e' }] as { cliente_id: string }[],
  erroInsert: null as { code: string; message: string } | null,
  gravado: [] as [string, string, unknown][],
  revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { clientes: falso.nivel } }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: (tabela: string) => {
      const ativo = tabela === 'contatos' ? falso.contatoAtivo : falso.empresaAtiva;
      const cadeia = {
        select: () => cadeia,
        eq: () => cadeia,
        maybeSingle: async () => ({ data: ativo === null ? null : { ativo }, error: null }),
        update: (dados: unknown) => {
          falso.gravado.push(['update', tabela, dados]);
          return { eq: () => ({ eq: () => ({ select: async () => ({ data: falso.atualizadas, error: null }) }) }) };
        },
        insert: async (dados: unknown) => {
          falso.gravado.push(['insert', tabela, dados]);
          return { error: falso.erroInsert };
        },
      };
      return cadeia;
    },
  }),
}));

const { marcarEmpresaDoContato, vincularEmpresaAoContato } = await import('./acoes');

const C = '11111111-1111-4111-8111-111111111111';
const E = '22222222-2222-4222-8222-222222222222';
const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
};
const SEM_PERMISSAO = { ok: false, erro: 'Você não tem permissão para editar contatos.' };

beforeEach(() => {
  Object.assign(falso, { nivel: 'editar', contatoAtivo: true, empresaAtiva: true, atualizadas: [{ cliente_id: E }], erroInsert: null, gravado: [], revalidados: [] });
});

describe('marcarEmpresaDoContato', () => {
  it('grava só a marcação pedida e revalida Contatos e a ficha da empresa', async () => {
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', true)).toEqual({ ok: true });
    expect(falso.gravado).toEqual([['update', 'contato_clientes', { pode_pedir_nota: true }]]);
    expect(falso.revalidados).toEqual(expect.arrayContaining(['/contatos', `/clientes/${E}`]));
  });
  it('"Só ver": recusa sem gravar (a mesma permissão de hoje)', async () => {
    falso.nivel = 'ver';
    expect(await marcarEmpresaDoContato(C, E, 'pode_atualizar_preco', true)).toEqual(SEM_PERMISSAO);
    expect(falso.gravado).toEqual([]);
  });
  it('campo ou valor estranho vindo do navegador: recusa', async () => {
    expect(await marcarEmpresaDoContato(C, E, 'ativo' as never, true)).toEqual({ ok: false, erro: 'Marcação inválida.' });
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', 'sim' as never)).toEqual({ ok: false, erro: 'Marcação inválida.' });
    expect(falso.gravado).toEqual([]);
  });
  it('contato arquivado: recusa; vínculo que sumiu: avisa', async () => {
    falso.contatoAtivo = false;
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', true)).toEqual({ ok: false, erro: 'Contato arquivado: restaure antes de mudar as marcações.' });
    expect(falso.gravado).toEqual([]);
    falso.contatoAtivo = true;
    falso.atualizadas = [];
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', true)).toEqual({ ok: false, erro: 'Este contato não está mais ligado a esta empresa.' });
  });
});

describe('vincularEmpresaAoContato', () => {
  it('liga a empresa com as marcações escolhidas', async () => {
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E, pode_atualizar_preco: 'on' }))).toEqual({ ok: true });
    expect(falso.gravado).toEqual([['insert', 'contato_clientes', { contato_id: C, cliente_id: E, pode_pedir_nota: false, pode_atualizar_preco: true }]]);
    expect(falso.revalidados).toEqual(expect.arrayContaining(['/contatos', `/clientes/${E}`]));
  });
  it('sem empresa, empresa arquivada, contato arquivado ou já ligada: mensagem clara (nunca sobrescreve, D10)', async () => {
    expect(await vincularEmpresaAoContato(C, form({}))).toEqual({ ok: false, erro: 'Escolha a empresa.' });
    falso.empresaAtiva = false;
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual({ ok: false, erro: 'Empresa arquivada ou inexistente: escolha outra.' });
    falso.empresaAtiva = true;
    falso.contatoAtivo = false;
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual({ ok: false, erro: 'Contato arquivado: restaure antes de vincular empresas.' });
    expect(falso.gravado).toEqual([]);
    falso.contatoAtivo = true;
    falso.erroInsert = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual({ ok: false, erro: 'Este contato já está ligado a esta empresa.' });
  });
  it('"Só ver": recusa', async () => {
    falso.nivel = 'ver';
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual(SEM_PERMISSAO);
    expect(falso.gravado).toEqual([]);
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/contatos/acoes-empresas.test.ts"`
Expected: FAIL — `marcarEmpresaDoContato is not a function`.

- [ ] **Passo 2: implementar as ações**

Acrescente ao fim de `contatos/acoes.ts` (o arquivo é `'use server'`: só funções assíncronas exportadas; tipos podem ser exportados):

```ts
export type ResultadoAcao = { ok: true } | { ok: false; erro: string };
export type CampoMarcacao = 'pode_pedir_nota' | 'pode_atualizar_preco';

const CAMPOS_MARCACAO: readonly string[] = ['pode_pedir_nota', 'pode_atualizar_preco'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEM_PERMISSAO_CONTATO = 'Você não tem permissão para editar contatos.';

async function contatoEstaAtivo(sb: Awaited<ReturnType<typeof supabaseServidor>>, id: string): Promise<boolean> {
  const { data } = await sb.from('contatos').select('ativo').eq('id', id).maybeSingle();
  return data?.ativo === true;
}

/**
 * Uma marcação de uma empresa do contato, pelo painel (spec 7C.2, D9). Mesma permissão de hoje: Clientes e contatos ≥
 * "Ver e editar"; a RLS (editar_clientes) recusa de novo e o gatilho de auditoria registra.
 */
export async function marcarEmpresaDoContato(contatoId: string, clienteId: string, campo: CampoMarcacao, valor: boolean): Promise<ResultadoAcao> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: SEM_PERMISSAO_CONTATO };
  // O campo e o valor vêm do navegador: só as duas marcações, só sim ou não.
  if (!CAMPOS_MARCACAO.includes(campo) || typeof valor !== 'boolean') return { ok: false, erro: 'Marcação inválida.' };
  const sb = await supabaseServidor();
  if (!(await contatoEstaAtivo(sb, contatoId))) return { ok: false, erro: 'Contato arquivado: restaure antes de mudar as marcações.' };
  const dados = campo === 'pode_pedir_nota' ? { pode_pedir_nota: valor } : { pode_atualizar_preco: valor };
  const { data, error } = await sb.from('contato_clientes').update(dados).eq('contato_id', contatoId).eq('cliente_id', clienteId).select('cliente_id');
  if (error) return { ok: false, erro: error.message };
  if (!data?.length) return { ok: false, erro: 'Este contato não está mais ligado a esta empresa.' };
  revalidatePath('/contatos');
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

/** Liga o contato a uma empresa ativa, com as marcações escolhidas (D10). Insert, não upsert: repetido não apaga marcações. */
export async function vincularEmpresaAoContato(contatoId: string, formData: FormData): Promise<ResultadoAcao> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: SEM_PERMISSAO_CONTATO };
  const clienteId = String(formData.get('cliente_id') ?? '');
  if (!UUID.test(clienteId)) return { ok: false, erro: 'Escolha a empresa.' };
  const sb = await supabaseServidor();
  if (!(await contatoEstaAtivo(sb, contatoId))) return { ok: false, erro: 'Contato arquivado: restaure antes de vincular empresas.' };
  const { data: empresa } = await sb.from('clientes').select('ativo').eq('id', clienteId).maybeSingle();
  if (!empresa?.ativo) return { ok: false, erro: 'Empresa arquivada ou inexistente: escolha outra.' };
  const { error } = await sb.from('contato_clientes').insert({
    contato_id: contatoId, cliente_id: clienteId,
    pode_pedir_nota: formData.get('pode_pedir_nota') === 'on', pode_atualizar_preco: formData.get('pode_atualizar_preco') === 'on',
  });
  if (error) return { ok: false, erro: error.code === '23505' ? 'Este contato já está ligado a esta empresa.' : error.message };
  revalidatePath('/contatos');
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}
```

(Se o Next reclamar de `const` não exportada num arquivo `'use server'`, não reclama: só exportações precisam ser funções assíncronas. O `acoes.test.ts` de antes continua passando — ele só chama `renomearContato`.)

- [ ] **Passo 3: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/contatos/acoes-empresas.test.ts" "src/app/(painel)/contatos/acoes.test.ts" && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo verde.

- [ ] **Passo 4: commit**

```bash
git add "apps/painel/src/app/(painel)/contatos/acoes.ts" "apps/painel/src/app/(painel)/contatos/acoes-empresas.test.ts"
git commit -m "feat(painel): marcações por empresa e vincular empresa pelo contato, com a mesma permissão de hoje

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Painel lateral. Cabeçalho, ABRIR CONVERSA, EDITAR, agente, empresas com marcações e vincular empresa

**Files:**
- Modify: `contatos/detalhe-contato.tsx` (reescrito), `contatos/page.tsx` (chamada do painel)
- Create: `contatos/secao-painel.tsx`, `contatos/marcacoes-empresa.tsx`, `contatos/vincular-empresa.tsx`
- Create: `apps/painel/e2e/contatos-painel.spec.ts`
- Modify: `apps/painel/e2e/arquivar-contatos.spec.ts` (o teste da edição do nome passa por Editar)

**Interfaces:**
- Consumes: Tasks 2, 3 e 5; `BotaoAbrirConversa` (Task 4); `EditarNomeContato`, `renomearContato`; `SwitchAgenteContato`, `alternarAgenteContato`; `ExcluirCadastro`; `AvisoArquivado`; `ApagarDadosContato`, `anonimizarContato`; `EscolherEmpresa`, `FormField`, `Checkbox`, `toast`.
- Produces: `DetalheContato({ id, u, editar, hrefEditar })`; `SecaoPainel({ titulo, extra, children })`; `MarcacoesEmpresa`; `SecaoEmpresas` (com o "vincular empresa"); `EsqueletoContato` (igual).

- [ ] **Passo 1: escrever o e2e que falha**

`apps/painel/e2e/contatos-painel.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirContatos, limparG3, linhaContato, PREFIXO, semearContatos } from './apoio-contatos';

const SENHA = 'senha-forte-123';
test.beforeEach(limparG3);
test.afterAll(limparG3);

const vinculo = async (contato: string, empresa: string) =>
  (await db.from('contato_clientes').select('pode_pedir_nota, pode_atualizar_preco').eq('contato_id', contato).eq('cliente_id', empresa).maybeSingle()).data;

test('painel: Abrir conversa, marcações por empresa, vincular empresa, Editar e a chave do agente', async ({ page }) => {
  const s = await semearContatos();
  await criarUsuarioTeste({ email: 'admin-g3p@e2e.local', senha: SENHA, nome: 'Thiago G3', papel: 'admin' });
  await entrar(page, 'admin-g3p@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}`);
  await linhaContato(page, 'Carla Mendes').click();
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await expect(painel.getByRole('link', { name: 'Abrir conversa' })).toHaveAttribute('href', `/atendimento/${s.conversaCarla}`);
  await expect(painel).not.toContainText('Zeta'); // empresa arquivada fora do painel (D5)

  // Marcações por empresa: cada caixa grava ao clicar (D9).
  await painel.getByRole('group', { name: `${PREFIXO} Mercado Central` }).getByRole('checkbox', { name: 'Pode pedir nota' }).click();
  await expect.poll(async () => (await vinculo(s.carla, s.mercado))?.pode_pedir_nota).toBe(true);
  await painel.getByRole('group', { name: `${PREFIXO} Rede Bom Preço Ltda` }).getByRole('checkbox', { name: 'Pode pedir nota' }).click();
  await expect.poll(async () => (await vinculo(s.carla, s.rede))?.pode_pedir_nota).toBe(false);

  // Vincular empresa: só as ativas ainda não ligadas (D10).
  await painel.getByRole('button', { name: 'Vincular empresa' }).click();
  const form = painel.getByRole('form', { name: 'Vincular empresa' });
  await form.getByRole('combobox', { name: 'Empresa', exact: true }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill(PREFIXO);
  await expect(page.getByRole('option', { name: new RegExp(`${PREFIXO} (Zeta|Mercado|Rede)`) })).toHaveCount(0);
  await page.getByRole('option', { name: new RegExp(`${PREFIXO} Padaria Sol`) }).click();
  await form.getByRole('checkbox', { name: 'Pode mudar preço e cadastrar produto' }).check();
  await form.getByRole('button', { name: 'Vincular', exact: true }).click();
  await expect(page.getByText('Empresa vinculada.')).toBeVisible();
  await expect(painel.getByRole('group', { name: `${PREFIXO} Padaria Sol` }).getByRole('checkbox', { name: 'Pode mudar preço e cadastrar produto' })).toBeChecked();
  expect(await vinculo(s.carla, s.padaria)).toEqual({ pode_pedir_nota: false, pode_atualizar_preco: true });

  // Editar abre o nome (D6).
  await painel.getByRole('link', { name: `Editar ${PREFIXO} Carla Mendes` }).click();
  const painelEditar = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await painelEditar.getByLabel('Nome', { exact: true }).fill(`${PREFIXO} Carla Souza`);
  await painelEditar.getByRole('button', { name: 'Salvar nome' }).click();
  await expect(page.getByText(`Salvo: ${PREFIXO} Carla Souza.`)).toBeVisible();

  // Chave do agente no painel.
  const painelNovo = page.getByRole('dialog', { name: `${PREFIXO} Carla Souza` });
  await painelNovo.getByRole('switch', { name: `Desligar o agente para ${PREFIXO} Carla Souza` }).click();
  await expect.poll(async () => (await db.from('contatos').select('agente_pausado').eq('id', s.carla).single()).data!.agente_pausado).toBe(true);
});
```

Em `e2e/arquivar-contatos.spec.ts`, no teste "a linha abre o contato e o nome muda ali…" (Task 4), depois de clicar na linha e antes de `painel.getByLabel('Nome', …)`, acrescente `await painel.getByRole('link', { name: 'Editar Maria Arquivo' }).click();` (D6: o campo Nome aparece pelo Editar do painel). No fim do mesmo teste, depois de `await expect(page.getByRole('link', { name: /^Editar / })).toHaveCount(0);`, acrescente:

```ts
  await page.locator('tbody tr').filter({ hasText: 'Maria Souza' }).click();
  await expect(page.getByRole('dialog', { name: 'Maria Souza' }).getByRole('link', { name: /^Editar / })).toHaveCount(0);
```

Run: `cd apps/painel && pnpm exec playwright test e2e/contatos-painel.spec.ts`
Expected: FAIL (o link "Abrir conversa" não existe no painel).

- [ ] **Passo 2: peças do painel**

`contatos/secao-painel.tsx`:

```tsx
import type { ReactNode } from 'react';

/** Uma seção do painel do contato (região com nome, para leitor de tela e testes). A Parte H acrescenta a sua (D18). */
export function SecaoPainel({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  // Componente de servidor: id fixo a partir do título (cada título aparece uma vez no painel).
  const id = `secao-${titulo.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 id={id} className="text-xs font-bold uppercase tracking-wide text-brand">{titulo}</h3>
        {extra && <span className="text-sm text-muted">{extra}</span>}
      </div>
      {children}
    </section>
  );
}
```

`contatos/marcacoes-empresa.tsx`:

```tsx
'use client';

import { unstable_rethrow } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toaster';
import type { CampoMarcacao, ResultadoAcao } from './acoes';

const CAMPOS: { campo: CampoMarcacao; rotulo: string }[] = [
  { campo: 'pode_pedir_nota', rotulo: 'Pode pedir nota' },
  { campo: 'pode_atualizar_preco', rotulo: 'Pode mudar preço e cadastrar produto' },
];

/**
 * As duas marcações de uma empresa do contato (D9). Cada caixa grava ao clicar, otimista: muda na hora e volta, com aviso, se
 * a ação recusar. Enquanto grava, não aceita outro clique.
 */
export function MarcacoesEmpresa({ empresa, nota, preco, pode, acao }: {
  empresa: string; nota: boolean; preco: boolean; pode: boolean;
  /** marcarEmpresaDoContato com contato e empresa presos por .bind no servidor. */
  acao: (campo: CampoMarcacao, valor: boolean) => Promise<ResultadoAcao>;
}) {
  const [valores, setValores] = useOptimistic<Record<CampoMarcacao, boolean>>({ pode_pedir_nota: nota, pode_atualizar_preco: preco });
  const [pendente, iniciar] = useTransition();
  const mudar = (campo: CampoMarcacao, valor: boolean) => {
    if (pendente) return;
    iniciar(async () => {
      setValores((v) => ({ ...v, [campo]: valor }));
      try {
        const r = await acao(campo, valor);
        if (!r.ok) toast.error(r.erro);
      } catch (e) {
        unstable_rethrow(e);
        console.error('[contatos] falha ao gravar a marcação', e);
        toast.error(`Não consegui gravar a marcação em ${empresa}. Tente de novo.`);
      }
    });
  };
  return (
    <div role="group" aria-label={empresa} aria-busy={pendente || undefined} className="flex flex-col gap-1">
      {CAMPOS.map((c) => (
        <label key={c.campo} className="flex items-center gap-2 text-base text-foreground">
          <Checkbox checked={valores[c.campo]} disabled={!pode || pendente} onCheckedChange={(v) => mudar(c.campo, v === true)} />
          {c.rotulo}
        </label>
      ))}
    </div>
  );
}
```

`contatos/vincular-empresa.tsx`:

```tsx
'use client';

import { Link2 } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import type { ResultadoAcao } from './acoes';

/**
 * Seção "Empresas (n)" do painel: o "vincular empresa" no título (imagem A) abre o formulário embaixo da lista (D10).
 * A lista (com as marcações) chega pronta do servidor como `children`.
 */
export function SecaoEmpresas({ titulo, podeVincular, empresas, acao, children }: {
  titulo: string; podeVincular: boolean; empresas: EmpresaOpcao[];
  /** vincularEmpresaAoContato com o contato preso por .bind no servidor. */
  acao: (dados: FormData) => Promise<ResultadoAcao>;
  children: ReactNode;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const fechar = () => { setAberto(false); setErro(null); };
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela: erro aparece no campo, sem fechar o painel.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        if (!r.ok) { setErro(r.erro); return; }
        fechar();
        toast.success('Empresa vinculada.');
      } catch (err) {
        unstable_rethrow(err);
        console.error('[contatos] falha ao vincular a empresa', err);
        setErro('Não consegui vincular agora. Tente de novo.');
      }
    });
  };
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-2 border-b border-border py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-titulo`} className="text-xs font-bold uppercase tracking-wide text-brand">{titulo}</h3>
        {podeVincular && !aberto && (
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setAberto(true)}>
            <Link2 aria-hidden size={14} strokeWidth={1.75} />
            Vincular empresa
          </Button>
        )}
      </div>
      {children}
      {aberto && (
        <form aria-label="Vincular empresa" onSubmit={enviar} className="flex flex-col gap-3 rounded-md border border-border p-3">
          {empresas.length === 0 ? (
            <p className="text-sm text-muted">Todas as empresas ativas já estão ligadas a este contato.</p>
          ) : (
            <>
              <FormField id={`${id}-empresa`} rotulo="Empresa" erro={erro}>
                <EscolherEmpresa name="cliente_id" empresas={empresas} />
              </FormField>
              <label className="flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" name="pode_pedir_nota" className="size-4 shrink-0 accent-brand" />Pode pedir nota
              </label>
              <label className="flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" name="pode_atualizar_preco" className="size-4 shrink-0 accent-brand" />Pode mudar preço e cadastrar produto
              </label>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={fechar}>Cancelar</Button>
            {empresas.length > 0 && <Button type="submit" size="sm" disabled={enviando} aria-busy={enviando || undefined}>Vincular</Button>}
          </div>
        </form>
      )}
    </section>
  );
}
```

- [ ] **Passo 3: `detalhe-contato.tsx` (reescrito)**

```tsx
import { Building2, ExternalLink, Pencil, SearchX, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ApagarDadosContato } from '@/components/patterns/apagar-dados-contato';
import { EmptyState } from '@/components/patterns/empty-state';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { AvisoArquivado } from '@/components/patterns/lista-arquivados';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { variantesBotao } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { NOME_ANONIMIZADO } from '@/lib/arquivo';
import { nomeDaPessoa } from '@/lib/arquivados';
import { iniciais } from '@/lib/atendimento';
import { textoCadastro } from '@/lib/contatos';
import { mascararTelefone } from '@/lib/formatos';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato } from '../atendimento/acoes';
import { anonimizarContato } from '../clientes/acoes';
import { marcarEmpresaDoContato, renomearContato, vincularEmpresaAoContato } from './acoes';
import { BotaoAbrirConversa } from './acoes-linha';
import { lerContato, lerEmpresasAtivas, lerWhatsappDoContato } from './dados-contatos';
import { EditarNomeContato } from './editar-nome-contato';
import { MarcacoesEmpresa } from './marcacoes-empresa';
import { SecaoPainel } from './secao-painel';
import { SecaoEmpresas } from './vincular-empresa';

/**
 * Painel lateral do contato (?contato=<id>, imagem A): ABRIR CONVERSA e EDITAR no topo, agente, empresas com as marcações
 * por empresa e o vincular, Excluir… (Parte B) e Apagar dados (LGPD, só admin, inalterado). Lê só o que já está no banco de
 * todos (D14). As permissões são as de hoje e as ações conferem de novo no servidor.
 */
export async function DetalheContato({ id, u, editar, hrefEditar }: { id: string; u: UsuarioPainel; editar: boolean; hrefEditar: string }) {
  const pode = temNivel(u, 'clientes', 'editar');
  const podeArquivar = temNivel(u, 'clientes', 'arquivar');
  const podeConversa = temNivel(u, 'atendimento', 'meus_setores');
  const admin = u.papel === 'admin';
  const sb = await supabaseServidor();
  const c = await lerContato(sb, id);

  if (!c) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Contato não encontrado</SheetTitle>
          <SheetDescription className="sr-only">O contato do endereço não existe mais.</SheetDescription>
        </SheetHeader>
        <SheetBody><EmptyState icone={SearchX} titulo="Não encontrei este contato." descricao="Ele pode ter sido apagado." /></SheetBody>
      </>
    );
  }

  const editavel = pode && c.ativo;
  const [whats, arquivadoPor, empresas] = await Promise.all([
    lerWhatsappDoContato(sb, c),
    c.ativo ? Promise.resolve(null) : nomeDaPessoa(sb, c.arquivadoPor),
    editavel ? lerEmpresasAtivas(sb) : Promise.resolve([]),
  ]);
  const ligadas = new Set(c.vinculos.map((v) => v.empresaId));
  const anonimizado = c.nome === NOME_ANONIMIZADO && !c.ativo;
  const agora = new Date();

  return (
    <>
      <SheetHeader className="gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-bold text-brand">{iniciais(c.nome)}</span>
          <div className="flex min-w-0 flex-col">
            <SheetTitle className="truncate">{c.nome}</SheetTitle>
            <SheetDescription className="tabular">{mascararTelefone(c.telefone)} · {textoCadastro(c.criadoEm, agora)}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotaoAbrirConversa conversaId={whats.conversaId} nome={c.nome} podeConversa={podeConversa} grande />
          {editavel && (
            <Link href={hrefEditar} scroll={false} aria-label={`Editar ${c.nome}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
              Editar
            </Link>
          )}
        </div>
      </SheetHeader>
      <SheetBody>
        {!c.ativo && !anonimizado && (
          <div className="py-4"><AvisoArquivado tipo="contato" id={c.id} nome={c.nome} arquivadoEm={c.arquivadoEm} arquivadoPor={arquivadoPor} pode={podeArquivar} /></div>
        )}
        {editavel && editar && (
          <SecaoPainel titulo="Dados">
            {/* key: depois de salvar, o campo recomeça com o nome novo. */}
            <EditarNomeContato key={c.nome} nome={c.nome} acao={renomearContato.bind(null, c.id)} />
          </SecaoPainel>
        )}
        <SecaoPainel titulo="Agente">
          <SwitchAgenteContato acao={alternarAgenteContato.bind(null, c.id, null, c.agentePausado)} desligado={c.agentePausado} nome={c.nome} pode={pode} mostrarEstado />
          <p className="text-sm text-muted">Desligado, nada é respondido automaticamente para este contato: a conversa vai para a equipe.</p>
        </SecaoPainel>

        <SecaoEmpresas
          titulo={`Empresas (${c.vinculos.length})`}
          podeVincular={editavel}
          empresas={empresas.filter((e) => !ligadas.has(e.id))}
          acao={vincularEmpresaAoContato.bind(null, c.id)}
        >
          {c.vinculos.length === 0 ? (
            <p className="text-sm text-muted">Sem empresa.{editavel ? ' Use "Vincular empresa".' : ''}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {c.vinculos.map((v) => (
                <li key={v.empresaId} className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-brand">
                      <Building2 aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">{v.empresa}</span>
                    </span>
                    <Link href={`/clientes/${v.empresaId}?aba=contatos`} aria-label={`Abrir a ficha de ${v.empresa}`} className="text-muted hover:text-foreground">
                      <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
                    </Link>
                  </div>
                  <MarcacoesEmpresa empresa={v.empresa} nota={v.podePedirNota} preco={v.podeMudarPreco} pode={editavel}
                    acao={marcarEmpresaDoContato.bind(null, c.id, v.empresaId)} />
                </li>
              ))}
            </ul>
          )}
          {!pode && c.vinculos.length > 0 && <p className="text-sm text-muted">Só quem pode editar clientes muda as marcações.</p>}
        </SecaoEmpresas>

        {/* Parte H: o bloco de acesso por empresa (perfil, setores, documentos, prévia do agente) entra aqui, D18. */}

        {podeArquivar && c.ativo && (
          <div className="py-4"><ExcluirCadastro tipo="contato" id={c.id} nome={c.nome} variante="area" voltarPara="/contatos" /></div>
        )}
        {admin && !anonimizado && (
          <section aria-labelledby="zona-perigo" className="my-4 flex flex-col gap-2 rounded-md border border-danger p-4">
            <h3 id="zona-perigo" className="flex items-center gap-2 text-base font-semibold text-danger">
              <ShieldAlert aria-hidden size={16} strokeWidth={1.75} />
              Zona de perigo
            </h3>
            <p className="text-sm text-foreground">
              Apagar os dados a pedido do titular (LGPD): nome, telefone, mensagens, áudios e arquivos deste contato somem de vez, em todas as empresas. Não dá para desfazer.
            </p>
            <ApagarDadosContato variante="destaque" nome={c.nome} acao={anonimizarContato.bind(null, c.vinculos[0]?.empresaId ?? '', c.id)} />
          </section>
        )}
        {admin && anonimizado && <p className="my-4 text-sm text-muted">Os dados deste contato já foram apagados a pedido do titular.</p>}
      </SheetBody>
    </>
  );
}

export function EsqueletoContato() {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Carregando o contato</SheetTitle>
        <SheetDescription className="sr-only">Os detalhes aparecem em instantes.</SheetDescription>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-32" />
      </SheetHeader>
      <SheetBody role="status" aria-label="Carregando o contato" className="flex flex-col gap-4 py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </SheetBody>
    </>
  );
}
```

(A zona de perigo continua **igual** nesta task; a Task 7 só troca a moldura e o título. `anonimizarContato` recebe a primeira empresa **ativa** para revalidar a ficha — antes podia ser uma arquivada; a ação apaga o contato em todas as empresas do mesmo jeito.)

- [ ] **Passo 4: a página passa o usuário e o Editar ao painel**

Em `contatos/page.tsx`, troque

```tsx
            <DetalheContato id={contatoAberto} pode={pode} podeArquivar={podeArquivar} admin={u.papel === 'admin'} />
```

por

```tsx
            <DetalheContato
              id={contatoAberto}
              u={u}
              editar={valorParam(params, 'editar') === '1'}
              hrefEditar={`/contatos${hrefComParams(params, { contato: contatoAberto, editar: '1', [PARAM_PAGINA]: pagina })}`}
            />
```

- [ ] **Passo 5: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/contatos-painel.spec.ts e2e/contatos-lista.spec.ts e2e/arquivar-contatos.spec.ts e2e/contatos.spec.ts e2e/clientes.spec.ts e2e/contato-conversa.spec.ts`
Expected: tudo verde.

- [ ] **Passo 6: commit**

```bash
git add apps/painel
git commit -m "feat(painel): painel do contato — Abrir conversa, Editar, marcações editáveis por empresa e vincular empresa

O nome passa a ser editado pelo Editar do painel (arquivar-contatos ajustado).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Painel lateral. WhatsApp, demandas abertas, Excluir… e Apagar dados (LGPD) tracejado; "Só ver"

**Files:**
- Create: `contatos/bloco-whatsapp.tsx`, `contatos/demandas-do-contato.tsx`
- Modify: `contatos/detalhe-contato.tsx`
- Modify: `apps/painel/e2e/apoio-contatos.ts` (`semearHistorico`), `apps/painel/e2e/contatos-painel.spec.ts`

**Interfaces:**
- Consumes: `WhatsappDoContato`, `lerDemandasDoContato` (Task 3); `estadoDaConversa`, `textoConversaAgora`, `textoUltimoContato`, `textoResolvidas`, `textoAtendimentos` (Task 2); `descreverPrazo` (`lib/prazo.ts`); `ROTULO_PRIORIDADE` (`lib/demandas.ts`); `SecaoPainel` (Task 6).
- Produces: `BlocoWhatsapp({ w, euId, veTodas, agora })`; `DemandasDoContato({ contatoId, agora })`; no e2e: `semearHistorico(s)`.

- [ ] **Passo 1: e2e que falham**

Acrescente a `e2e/apoio-contatos.ts`:

```ts
/**
 * Histórico da Carla para o bloco WhatsApp e as demandas: há 2 dias a equipe respondeu; ontem só o agente; hoje passou para
 * pessoa (semearContatos) → 3 atendimentos, 1 resolvido pelo agente (33%). Demandas: uma urgente e uma normal abertas no
 * Fiscal e uma concluída (não aparece).
 */
export async function semearHistorico(s: Awaited<ReturnType<typeof semearContatos>>) {
  await db.from('mensagens').insert([
    { conversa_id: s.conversaCarla, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'oi', criado_em: minAtras(48 * 60), processada_em: minAtras(48 * 60) },
    { conversa_id: s.conversaCarla, direcao: 'saida', autor: 'atendente', tipo: 'texto', conteudo: 'pois não', criado_em: minAtras(48 * 60 - 5) },
    { conversa_id: s.conversaCarla, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'oi', criado_em: minAtras(24 * 60), processada_em: minAtras(24 * 60) },
    { conversa_id: s.conversaCarla, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'olá', criado_em: minAtras(24 * 60 - 1) },
  ]);
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const demanda = async (titulo: string, prioridade: 'urgente' | 'normal', concluida = false) => (await db.from('chamados').insert({
    conversa_id: s.conversaCarla, setor_id: fiscal!.id, titulo: `${PREFIXO} ${titulo}`, prioridade,
    ...(concluida ? { status: 'concluido', concluido_em: new Date().toISOString() } : {}),
  }).select('id, numero').single()).data!;
  const urgente = await demanda('Nota de venda', 'urgente');
  await demanda('Alteração de sócio', 'normal');
  await demanda('Antiga', 'normal', true);
  return { urgente };
}
```

Acrescente a `e2e/contatos-painel.spec.ts` (e `semearHistorico` ao import de `./apoio-contatos`):

```ts
test('painel: WhatsApp (último contato, conversa agora, % resolvida) e demandas abertas; LGPD separado com borda tracejada', async ({ page }) => {
  const s = await semearContatos();
  const h = await semearHistorico(s);
  await criarUsuarioTeste({ email: 'admin-g3p@e2e.local', senha: SENHA, nome: 'Thiago G3', papel: 'admin' });
  await entrar(page, 'admin-g3p@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}&contato=${s.carla}`);
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });

  const whats = painel.getByRole('region', { name: 'WhatsApp' });
  await expect(whats).toContainText('3 atendimentos');
  await expect(whats).toContainText(/Último contato\s*(hoje|ontem) \d{2}:\d{2}/);
  await expect(whats).toContainText(/esperando pessoa · \d+ min/);
  await expect(whats).toContainText('33%');

  const demandas = painel.getByRole('region', { name: 'Demandas abertas' });
  await expect(demandas).toContainText(`#${h.urgente.numero} ${PREFIXO} Nota de venda`);
  await expect(demandas).toContainText('Urgente');
  await expect(demandas).toContainText(`${PREFIXO} Alteração de sócio`);
  await expect(demandas).not.toContainText('Antiga');
  await expect(demandas.getByRole('link', { name: new RegExp(`${PREFIXO} Nota de venda`) })).toHaveAttribute('href', `/demandas?demanda=${h.urgente.id}`);

  await expect(painel.getByRole('button', { name: 'Excluir…' })).toBeVisible();
  const lgpd = painel.getByRole('region', { name: 'Apagar dados (LGPD) · só admin' });
  await expect(lgpd).toHaveCSS('border-top-style', 'dashed');
  await expect(lgpd.getByRole('button', { name: 'Apagar dados (LGPD)' })).toBeVisible();
});

test('"Só ver" (o padrão de quem atende): vê o painel, mas não muda nada; sem Excluir… e sem LGPD', async ({ page }) => {
  const s = await semearContatos();
  await semearHistorico(s); // as demandas no Fiscal deixam a Ana ver a conversa (Parte D)
  await criarUsuarioTeste({ email: 'ana-g3p@e2e.local', senha: SENHA, nome: 'Ana G3', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-g3p@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}&contato=${s.carla}`);
  const painel = page.getByRole('dialog', { name: `${PREFIXO} Carla Mendes` });
  await expect(painel.getByRole('region', { name: 'WhatsApp' })).toContainText('esperando pessoa');
  await expect(painel.getByRole('region', { name: 'Demandas abertas' })).toContainText(`${PREFIXO} Nota de venda`);
  await expect(painel.getByRole('link', { name: /^Editar / })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Vincular empresa' })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Excluir…' })).toHaveCount(0);
  await expect(painel.getByRole('button', { name: 'Apagar dados (LGPD)' })).toHaveCount(0);
  await expect(painel.getByRole('switch', { name: /o agente para/ })).toBeDisabled();
  for (const caixa of await painel.getByRole('group', { name: `${PREFIXO} Rede Bom Preço Ltda` }).getByRole('checkbox').all()) {
    await expect(caixa).toBeDisabled();
  }
  await expect(painel).toContainText('Só quem pode editar clientes muda as marcações.');
});
```

Run: `cd apps/painel && pnpm exec playwright test e2e/contatos-painel.spec.ts`
Expected: FAIL (região "WhatsApp" não existe).

- [ ] **Passo 2: `bloco-whatsapp.tsx` e `demandas-do-contato.tsx`**

`contatos/bloco-whatsapp.tsx`:

```tsx
import { cn } from '@/lib/cn';
import { estadoDaConversa, textoAtendimentos, textoConversaAgora, textoResolvidas, textoUltimoContato } from '@/lib/contatos';
import type { WhatsappDoContato } from './dados-contatos';
import { SecaoPainel } from './secao-painel';

/** Bloco WhatsApp (imagem A): último contato, conversa agora e a % resolvida pelo agente, com "N atendimentos" no título (D3). */
export function BlocoWhatsapp({ w, euId, veTodas, agora }: { w: WhatsappDoContato; euId: string; veTodas: boolean; agora: Date }) {
  const ctx = { euId, veTodas };
  const espera = estadoDaConversa(w, ctx).tom === 'espera';
  const linhas = [
    { rotulo: 'Último contato', valor: textoUltimoContato(w.ultimaEm, agora), classe: 'tabular font-semibold text-foreground' },
    { rotulo: 'Conversa agora', valor: textoConversaAgora(w, ctx, agora), classe: espera ? 'font-semibold text-warning' : 'text-foreground' },
    { rotulo: 'Resolvidas pelo agente', valor: textoResolvidas(w.resumo), classe: 'tabular text-foreground' },
  ];
  return (
    <SecaoPainel titulo="WhatsApp" extra={textoAtendimentos(w.resumo)}>
      <dl className="flex flex-col gap-1">
        {linhas.map((l) => (
          <div key={l.rotulo} className="flex items-baseline justify-between gap-3 text-base">
            <dt className="text-muted">{l.rotulo}</dt>
            <dd className={cn('text-right', l.classe)}>{l.valor}</dd>
          </div>
        ))}
      </dl>
    </SecaoPainel>
  );
}
```

`contatos/demandas-do-contato.tsx`:

```tsx
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { ROTULO_PRIORIDADE } from '@/lib/demandas';
import { descreverPrazo } from '@/lib/prazo';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerDemandasDoContato } from './dados-contatos';
import { SecaoPainel } from './secao-painel';

/** Demandas abertas do contato (D16), pela regra de leitura de quem abre o painel. Urgente e vencida em vermelho com texto. */
export async function DemandasDoContato({ contatoId, agora }: { contatoId: string; agora: Date }) {
  const sb = await supabaseServidor();
  const r = await lerDemandasDoContato(sb, contatoId);
  return (
    <SecaoPainel titulo="Demandas abertas" extra={r ? String(r.total) : null}>
      {!r ? (
        <p className="text-sm text-muted">Não consegui ler as demandas agora.</p>
      ) : r.linhas.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma demanda aberta que você veja.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {r.linhas.map((d) => {
            const p = descreverPrazo({ prazo: d.prazo, pausadoDesde: d.pausadoDesde, concluidaEm: null }, agora);
            const alerta = d.prioridade === 'urgente' || p.tom === 'vencido';
            return (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/demandas?demanda=${d.id}`} className="min-w-0 truncate text-foreground hover:underline">
                  <strong className="tabular">#{d.numero}</strong> {d.titulo}
                </Link>
                <span className={cn('shrink-0 text-xs font-bold uppercase tracking-wide', alerta ? 'text-danger' : 'text-muted')}>
                  {ROTULO_PRIORIDADE[d.prioridade]} · {p.texto}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {r && r.total > r.linhas.length && <p className="text-sm text-muted">e mais {r.total - r.linhas.length}.</p>}
    </SecaoPainel>
  );
}

export function EsqueletoDemandasDoContato() {
  return (
    <div role="status" aria-label="Carregando as demandas do contato" className="flex flex-col gap-2 py-4">
      <Skeleton className="h-4 w-36" />
      <Skeleton className="h-8 w-full" />
    </div>
  );
}
```

(Confira com `grep -n "export function descreverPrazo" -A16 apps/painel/src/lib/prazo.ts` que o tom de vencida é `'vencido'` e que o texto já diz "venceu …": o vermelho nunca fica sozinho.)

- [ ] **Passo 3: o painel usa os blocos; Excluir… e LGPD tracejada**

Em `contatos/detalhe-contato.tsx`:
1. Imports: acrescente `import { Suspense } from 'react';`, `import { BlocoWhatsapp } from './bloco-whatsapp';` e `import { DemandasDoContato, EsqueletoDemandasDoContato } from './demandas-do-contato';`; e calcule `const veTodas = temNivel(u, 'atendimento', 'todas');` junto das outras permissões.
2. Troque a linha do comentário `{/* Parte H: … */}` por:

```tsx
        {/* Parte H: o bloco de acesso por empresa (perfil, setores, documentos, prévia do agente) entra aqui, D18. */}
        <BlocoWhatsapp w={whats} euId={u.id} veTodas={veTodas} agora={agora} />
        <Suspense fallback={<EsqueletoDemandasDoContato />}>
          <DemandasDoContato contatoId={c.id} agora={agora} />
        </Suspense>
```

3. Troque a seção `zona-perigo` inteira por (a ação, o botão e o texto **não mudam**; só a moldura tracejada e o título, imagem A):

```tsx
          <section aria-labelledby="apagar-dados" className="my-4 flex flex-col gap-2 rounded-md border border-dashed border-danger p-4">
            <h3 id="apagar-dados" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-danger">
              <ShieldAlert aria-hidden size={16} strokeWidth={1.75} />
              Apagar dados (LGPD) · só admin
            </h3>
            <p className="text-sm text-foreground">
              Apagar os dados a pedido do titular (LGPD): nome, telefone, mensagens, áudios e arquivos deste contato somem de vez, em todas as empresas. Não dá para desfazer.
            </p>
            <ApagarDadosContato variante="destaque" nome={c.nome} acao={anonimizarContato.bind(null, c.vinculos[0]?.empresaId ?? '', c.id)} />
          </section>
```

Antes de trocar o título, `grep -rn "Zona de perigo" apps/painel/e2e apps/painel/src` — só o painel do contato usa (os e2e procuram o botão e a janela, que não mudam).

- [ ] **Passo 4: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/contatos-painel.spec.ts e2e/contatos-lista.spec.ts e2e/arquivar-contatos.spec.ts e2e/acessibilidade.spec.ts`
Expected: tudo verde.

- [ ] **Passo 5: commit**

```bash
git add apps/painel
git commit -m "feat(painel): painel do contato — bloco WhatsApp com a % resolvida pelo agente, demandas abertas e LGPD separado com borda tracejada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Acessibilidade, catálogo e manuais

**Files:**
- Modify: `apps/painel/e2e/acessibilidade.spec.ts`
- Modify: `apps/painel/src/app/(painel)/_design/page.tsx` (se tiver seção de padrões)
- Modify: `docs/design-system.md`, `docs/operacao.md`

- [ ] **Passo 1: acessibilidade nos dois temas**

Em `e2e/acessibilidade.spec.ts`:
1. Acrescente `import { abrirContatos } from './apoio-contatos';`.
2. Na lista `rotas` do teste "telas do painel", logo depois de `` `/contatos?contato=${ids.contato}`, `` acrescente `` `/contatos?contato=${ids.contato}&editar=1`, `` e `'/contatos?filtro=nota',`.
3. Acrescente, dentro do `test.describe` de cada tema, um teste novo:

```ts
    test(`Contatos: vincular empresa aberto sem violações graves (${tema})`, async ({ page }) => {
      const ids = await semear();
      await entrar(page, EMAIL, SENHA);
      await abrirContatos(page, `?contato=${ids.contato}`);
      const painel = page.getByRole('dialog', { name: 'Clara Acessível' });
      await painel.getByRole('button', { name: 'Vincular empresa' }).click();
      await expect(painel.getByRole('form', { name: 'Vincular empresa' })).toBeVisible();
      const erros = await auditar(page, '/contatos (vincular empresa)', tema);
      expect(erros, erros.join('\n')).toEqual([]);
    });
```

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/acessibilidade.spec.ts`
Expected: sem violação séria ou crítica nos temas claro e escuro. Se o axe acusar contraste em `text-warning` ("esperando pessoa") ou nos selos `success`/`brand`, troque pelo par já aprovado (`grep -n "warning" apps/painel/src/components/patterns/status-badge.tsx`).

À mão, com o teclado: Tab passa pela busca, pelos seletores Empresa e Último contato, pelos filtros rápidos (o ativo é anunciado como atual), pela ordem, pelos cabeçalhos ordenáveis e por cada linha (empresas, chave do agente, abrir conversa, arquivar); Enter na linha abre o painel; no painel, Tab chega a ABRIR CONVERSA, EDITAR, chave, caixas de cada empresa (o leitor de tela lê o nome da empresa do grupo), "Vincular empresa", WhatsApp, demandas, Excluir… e Apagar dados; Esc fecha o painel e devolve o foco à linha. O botão desligado de "Abrir conversa" mostra o motivo no tooltip também pelo teclado (`PermissionGate`).

- [ ] **Passo 2: catálogo**

Se `/_design` mostra padrões, acrescente "Contatos (Parte G3)": três `SelosContato` com dados fixos (um com "Pede nota · 1 de 2", um com as duas marcações, um "Só conversa") e um `SwitchAgenteContato` com `estadoCurto` desabilitado, sem leitura de banco. Sem seção de padrões, não acrescente nada.

- [ ] **Passo 3: `docs/design-system.md`**

Em "Vocabulário oficial da interface":

```markdown
- **Contatos:** "Nome, telefone ou empresa" (busca); filtros "Todos", "Agente desligado", "Sem empresa", "Pode pedir nota", "Muda preço"; "Empresa: todas", "Último contato: qualquer data" (Hoje, Últimos 7 dias, Últimos 30 dias, Há mais de 30 dias, Sem conversa); "Ordem: último contato"; selos "Pede nota", "Muda preço e cadastra produto", "Só conversa", " · 1 de 2"; chave "atende"/"desligado"; estado "esperando pessoa", "com você", "com <nome>", "com o agente", "sem conversa", "nenhuma conversa visível"; no painel "Abrir conversa", "Editar", "Vincular empresa", "WhatsApp" ("N atendimentos", "Último contato", "Conversa agora", "Resolvidas pelo agente"), "Demandas abertas", "Apagar dados (LGPD) · só admin".
```

Em "Regras de estilo":

```markdown
**Contatos** (G3): a lista conta e pagina no servidor pela visão `contatos_lista` (regra de leitura de quem consulta); os filtros rápidos são exclusivos e levam `data-filtro`/`data-contagem` (contrato dos testes). Empresa arquivada não aparece em lugar nenhum da tela. As marcações do painel gravam ao clicar (otimistas), como a chave do agente. O painel é feito de seções (`SecaoPainel`, região com nome); a Parte H acrescenta o bloco de acesso entre Empresas e WhatsApp. "Apagar dados (LGPD)" fica separado, com borda tracejada vermelha e título "· só admin".
```

- [ ] **Passo 4: `docs/operacao.md`**

1. Em "### Pausar o agente", troque a frase "A aba **Contatos** do menu mostra todos os contatos, com as empresas de cada um e se o agente atende; para ligar um contato já cadastrado a uma empresa, abra a empresa em Clientes → aba Contatos → "Vincular contato já cadastrado"." por "A tela **Contatos** do menu mostra todos os contatos (veja "Contatos: lista e painel" abaixo); para ligar um contato a uma empresa, abra o contato e use **Vincular empresa**, ou abra a empresa em Clientes → aba Contatos → "Vincular contato já cadastrado"."
2. Novo, logo antes de "### Quando chegar o e-mail "WhatsApp desconectado"":

```markdown
### Contatos: lista e painel

A tela **Contatos** mostra quem fala pelas empresas no WhatsApp, **do contato mais recente para o mais antigo**. Cada linha diz as empresas (só as ativas), o que a pessoa pode pedir (**Pede nota**, **Muda preço e cadastra produto**; "1 de 2" quando vale só numa das empresas; **Só conversa** quando não pede nada), quando falou por último e como está a conversa agora (esperando pessoa, com alguém da equipe, com o agente), e a chave do agente.
- **Buscar:** por nome, telefone **ou empresa**. Os botões **Agente desligado**, **Sem empresa**, **Pode pedir nota** e **Muda preço** mostram quantos há e filtram com um clique; dá para escolher uma empresa e o período do último contato (inclusive "Sem conversa").
- **Abrir um contato:** clique na linha. No painel: **Abrir conversa**, **Editar** (o nome), a chave do agente, as empresas com as marcações (marque ou desmarque: grava na hora), **Vincular empresa**, o bloco **WhatsApp** (último contato, conversa agora e quanto o agente resolveu sozinho — "atendimento" é cada dia em que o contato escreveu) e as **demandas abertas** dele. Embaixo, **Excluir…** (arquiva quem tem histórico) e, separado, **Apagar dados (LGPD)**, só para você.
- **Quem vê o quê:** toda a equipe vê os contatos; a hora e o estado da conversa só aparecem para quem pode ver aquela conversa (por isso alguém da equipe pode ler "nenhuma conversa visível"). Mudar marcações, vincular empresa, editar e a chave do agente pedem "Clientes e contatos: Ver e editar"; arquivar pede "Editar e arquivar".
- **Tirar uma empresa do contato** continua na ficha da empresa (Clientes → empresa → aba Contatos → Remover).
```

- [ ] **Passo 5: commit**

```bash
git add docs/design-system.md docs/operacao.md apps/painel/src apps/painel/e2e
git commit -m "docs: Contatos no catálogo e no manual; acessibilidade da lista, do painel e do vincular empresa nos dois temas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes de cada suíte inteira:
   - **regressão congelada:** a linha do `22_regressao_visibilidade.test.sql` de agora (100/100) ao lado da guardada na Task 1 (`$SCRATCH/regressao-antes.txt`), e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` **vazio**; `git diff b49aa57 --stat -- supabase/tests` mostra só `38_` (nenhum teste de parte anterior mudou) e `git diff b49aa57 --stat -- supabase/migrations` só `20261009000100`;
   - `supabase test db`: todos os arquivos, com os números de cada um, inclusive `38` 29/29 e o `25`;
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`; `pnpm --filter @escritorio/trabalhador test` e `typecheck` (os tipos regerados não podem quebrar o trabalhador);
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com `contatos-lista`, `contatos-painel`, `contatos`, `arquivar-contatos`, `clientes`, `contato-conversa` e `acessibilidade.spec.ts` nos dois temas;
   - mostre os números exatos de cada suíte (passaram, falharam, pulados). Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-contatos-opcao-a.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local e dados parecidos com os da imagem: 214 contatos (9 com agente desligado, 4 sem empresa, 58 que pedem nota, 17 que mudam preço), 6 arquivados; na primeira página Carla Mendes (Rede Bom Preço Ltda e Mercado Central, pede nota só na Rede, esperando pessoa há 18 min, 47 dias de atendimento com 71% resolvidos pelo agente, demandas #1042 Nota de venda urgente hoje e #1017 Alteração de sócio normal 03/10), Roberto Nunes, Jorge Santos, Rita Lima (com Bruno), Paulo Andrade, Marcos Alves (agente desligado), Luiza Faria, Fernanda Rocha (duas empresas) e Sandra Costa (sem empresa, sem conversa);
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**), gravando os dados pela chave de serviço **do banco local**;
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-g3\` com nomes `g3-<tela>-<largura>-<tema>.png`: `contatos` (lista com o painel da Carla aberto, a imagem A), `contatos-filtro` (filtro "Pode pedir nota" ativo e empresa escolhida), `contatos-vincular` (formulário de vincular empresa aberto), `contatos-arquivar` (janela "Arquivar Carla Mendes?"), `contatos-lgpd` (janela "Apagar os dados de Carla Mendes?"), `contatos-so-ver` (a mesma Carla vista por uma pessoa com "Só ver");
   - liste o que ficou diferente da imagem. Já se sabe: "47 conversas" virou "N atendimentos" (D3); a segunda linha do último contato é o estado de agora ("com o agente", não "pelo agente", D15); o lápis da linha saiu e EDITAR mostra o nome no painel (D6); NOVO CONTATO leva ao cartão do fim da página (D7); "Opção A — Tabela + painel lateral" do canto da imagem era legenda da maquete; a trilha "Cadastros › Contatos" é a da casca.
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Ela deve listar as da Parte F (`20261006000100_painel_v2_gastos_colunas.sql` a `20261006000300_painel_v2_gastos_funcoes.sql`), as da G1 (`20261007000100_painel_v2_prazos_regra.sql`, `20261007000200_painel_v2_cargos.sql`), a da G2 (`20261008000100_painel_v2_inicio.sql`), **que ainda não foram aplicadas e esperam o "ok" do dono**, e a desta parte (`20261009000100_painel_v2_contatos.sql`). Qualquer `push` sem `--dry-run` levaria as sete juntas;
   - **não aplique.** Deixe para o dono, por escrito, o que muda e o comando:
     - **ninguém passa a ver mais nem menos** (teste 22): a visão e a função só leem, com a regra de leitura de quem consulta; nenhuma tabela, coluna ou permissão muda;
     - o painel antigo e o trabalhador da 3001 continuam funcionando (G3 não muda tabela nem o trabalhador);
     - para aplicar F, G1, G2 e G3 juntas, depois do "ok" dele: `supabase db push --db-url "$DATABASE_URL"` (a ordem é automática). Para aplicar só parte delas, o caminho é aplicar a partir da worktree da parte certa (o push leva todas as pendentes da pasta).
4. **Subir o painel para o dono ver:**
   - **painel** desta worktree numa **porta livre** (comece pela **3012**: `netstat -ano | findstr :3012`; se ocupada, a próxima livre). Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal: variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p <porta>` rodando nesta worktree;
   - **trabalhador: NÃO suba nenhum** (G3 não muda o trabalhador). O da porta **3001 é o teste do dono**; não o desligue nem o mate;
   - avise: **antes de aplicar as migrações**, Contatos abre pelo nome, com a busca por nome ou telefone e o aviso "falta a atualização do banco desta versão" (sem filtros rápidos, empresa e período), e no painel a "% resolvida" fica "—"; o resto do painel funciona (D14). As da F, G1 e G2 também estão pendentes (Gastos com IA, Configurações › Prazos e o Início ficam com os avisos delas). Depois de aplicar, tudo funciona;
   - passe o endereço e um roteiro curto:
     1. abra Contatos: os mais recentes no topo; busque pelo nome de uma empresa; clique em "Pode pedir nota" e confira que o número do botão é o número de linhas;
     2. clique numa linha: no painel, marque e desmarque "Pode pedir nota" numa empresa (a linha muda o selo); vincule outra empresa; use Editar para trocar o nome;
     3. confira o bloco WhatsApp e as demandas abertas; clique em Abrir conversa;
     4. entre com uma pessoa da equipe com "Só ver" (ex.: Ana): ela vê o painel, mas as caixas e a chave ficam desligadas, e não há Excluir… nem Apagar dados;
     5. em Excluir…, confira que a janela é a de sempre (Parte B), e que "Apagar dados (LGPD)" continua separado.
5. **Pendências para listar no fim:**
   - as decisões D1 a D20 que o dono ainda não confirmou (destaque D1, D2, D3, D5 e D6, que mudam o que cada um vê ou conta);
   - o que ficou diferente da imagem (item 2);
   - aplicar na homologação as migrações da F, da G1, da G2 e da G3 (item 3), depois do "ok";
   - Parte H: coluna Perfil e bloco de acesso no painel (D18);
   - Parte G, próximas sub-etapas: Assistente (G4), Treinar o agente (G5).
6. **Não juntar** a branch em nada. **Parar** ao fim da G3 e esperar o dono ver antes de começar o Assistente.
