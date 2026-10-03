# Painel v2, Parte G1 (Configurações). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** a tela **Configurações** vira a Opção A "Menu por seção" (`00-configuracoes-opcao-a.png`) com os resumos da Opção B: menu fixo à esquerda em quatro grupos (Escritório · Agente e atendimento · Cadastros · Sistema), cada item com contagem e resumo do valor de hoje em letra pequena e "● não salvo"; **uma seção por vez** (`/configuracoes?secao=prazos`); cada cartão com **seu Salvar e seu DESCARTAR**, campo alterado âmbar com "antes: X" e "N alterações não salvas"; **janela ao sair** com alteração (SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI), inclusive navegando dentro do painel; todas as seções do spec (Expediente, Feriados, Prazos, Teto de IA e alertas, Modelos de IA, Cotação e custo da transcrição, Limites de espera, Mensagens com o aviso do login, Respostas prontas **com edição**, Setores, Serviços, **Cargos**, link para Usuários e permissões); e **Prazos** com exemplo de vencimento, demandas abertas por prioridade e a **janela de impacto** antes de salvar (padrão "SÓ PARA AS NOVAS", aviso vermelho ao diminuir, "APLICAR TAMBÉM ÀS N ABERTAS" com evento em cada demanda).

**Arquitetura:**
- **Banco (duas migrações novas; nenhuma antiga é editada):**
  - `20261007000100_painel_v2_prazos_regra.sql`: tipo de evento `prazo_recalculado`; `dia_util_anterior`, `deslocar_dias_uteis`, `calcular_prazo_dias`, `prazo_segue_regra` (internas); `simular_mudanca_prazo(prioridade, dias)` (**stable**, só lê), `aplicar_prazo_abertas(prioridade, dias)` (grava a regra e recalcula na mesma transação, um evento por demanda), `prazos_resumo(inicio)` (abertas por prioridade e exemplos de vencimento); o gatilho `chamados_antes_alterar` deixa de reiniciar a pausa quando o recálculo é da regra.
  - `20261007000200_painel_v2_cargos.sql`: `configuracoes.cargos text[]` (a lista do campo Cargo da ficha da pessoa) com `cargos_validos`.
- **Painel:** `lib/configuracoes.ts` (seções, grupos, resumos, textos do impacto, exemplo de vencimento); `FormularioAlteravel` ganha marcação âmbar opcional, `Antes`, `BotaoDescartar`, contagem, aviso de mudança, "salvar para sair" e uma **guarda de saída opcional** (as outras telas continuam com o `confirm` de hoje); `FormularioConfig` (cartão que salva sem recarregar, mantém o digitado no erro); uma pasta `configuracoes/secoes/` com um componente por seção; `MenuSecoes`, `GuardaSaida`, trilha do topo com a seção; ações do servidor devolvem `Resultado` (sem `?erro=` na URL).

**Tecnologias:** Next.js 15 (App Router, server components, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (Postgres, RLS, pgTAP), Zod, Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção **7C.4** (Configurações) e **7C.6** (verificação: "aviso de não salvo e janela de impacto em Prazos"; "`simular_mudanca_prazo` não grava; `aplicar_prazo_abertas` gera evento por demanda e respeita 'Com o cliente' (pausado)"; capturas 1366/1920 claro e escuro);
- **3.1** (termos, migração incremental com pgTAP, `--dry-run`, nada é juntado), **6.5** (prazo em dias úteis com expediente e feriados; "Com o cliente" pausa o prazo; a pausa empurra o prazo ao sair), **7** (Parte D: "Configurações: Sem acesso · Sim"; "Alterar prazos de demandas"), **4.6** (tom dos textos), **8** (vermelho nunca sozinho), **9** (pendências do dono: aviso do login, cotação, cargos, prazos, limites de espera).
- Imagens: `imagens/00-configuracoes-opcao-a.png` (o layout) e `imagens/00-configuracoes-opcao-b.png` (só a ideia dos resumos). HTML de origem: `fragmentos/00-configuracoes-opcao-a.html` e `-opcao-b.html`. Dados nas imagens são de exemplo. Onde a imagem e o spec divergem, vale o spec.

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt G" — ordem Configurações → Início → Contatos → Assistente → Treinar o agente; **este plano cobre só Configurações (G1)**. "Pontos que não podem falhar": **Prazos: SALVAR mostra o impacto antes; padrão "só para as novas"; recalcular gera evento em cada demanda.** Ao terminar a tela: suítes com resultado real, capturas comparadas com a imagem, e **parar**. Estilo e convenções: `docs/superpowers/plans/2026-10-06-painel-v2-parte-f.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-g`, branch `painel-v2-parte-g`, criada de `painel-v2-parte-f` em `abb48ed` (Partes A a F prontas). Todos os comandos rodam a partir da raiz da worktree. A pasta do spec já é a mais nova (`git diff etapa-1 -- docs/superpowers/specs/painel-v2` saiu vazio em 03/10); se deixar de sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso antes da Task 1.

## Decisões tomadas (sem o dono)

O dono está fora e autorizou decidir. Conferi no código o que o spec supõe (o prazo é `calcular_prazo(prioridade, início)` com `configuracoes.prazo_*_dias`, expediente `horario_inicio/fim`, `dias_uteis` e `feriados`; "Com o cliente" pausa por `chamados.prazo_pausado_desde` e o gatilho `chamados_antes_alterar` empurra o prazo pelo tempo útil parado ao sair; mudar o prazo durante a pausa **reinicia** a pausa; quem pode editar Prazos hoje = `exigirConfiguracoes()` no painel e a política `alteracao_configuracoes` = `tem_permissao('configuracoes','sim')` no banco; as colunas de prazo não estão em `configuracoes_so_admin`). Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Custo da alternativa | Task |
|---|---|---|---|---|
| D1 | **Recalcular = deslocar pela diferença.** Cada demanda aberta que segue a regra anda a mesma diferença de dias úteis da mudança (Normal 2→3: +1 dia útil), mantendo a hora e o tempo que a pausa já somou. | Recalcular do zero a partir da abertura com a regra nova. | O banco não guarda de quando a regra conta (abertura, troca de prioridade ou reabertura) nem quanto a pausa já somou: precisaria de duas colunas novas em `chamados` e de mudar `criar_demanda`, `definir_prioridade_prazo`, `reabrir_demanda` e o gatilho da pausa (Parte C), com risco nas demandas de hoje. Diferença prática só quando alguém salvou "só para as novas" e depois aplica outra mudança. | 1 |
| D2 | **`aplicar_prazo_abertas(prioridade, dias)`** grava a regra **e** recalcula as abertas na **mesma transação** (o spec escreve `aplicar_prazo_abertas(prioridade)`). | Salvar a regra antes e chamar `aplicar_prazo_abertas(prioridade)` depois. | Duas transações (regra salva e recálculo falhando no meio) e o banco precisaria guardar o valor anterior para saber a diferença. | 1, 6 |
| D3 | **Prazo escolhido à mão nunca é recalculado.** "À mão" = existe evento `prazo_alterado` com pessoa depois do último evento que recomeça a regra (`criacao`, `reaberto`, `prioridade_alterada`, `prazo_recalculado`). A janela diz quantas ficam como estão. | Recalcular todas. | Desfaz decisões que a equipe tomou demanda a demanda. | 1, 6 |
| D4 | **"Com o cliente" (pausadas):** são recalculadas também e **continuam pausadas desde a mesma hora** (ao sair, o prazo ainda anda o tempo parado). O recálculo liga a marca de transação `escritorio.prazo_por_regra`, que o gatilho respeita. | Pular as pausadas. | Ficariam na regra antiga para sempre, sem aviso. | 1 |
| D5 | **Evento novo `prazo_recalculado`** (com a pessoa e o prazo novo); a linha do tempo mostra "Sistema · prazo 13/10 18h · recalculado por mudança de regra (Thiago)". | Reusar `prazo_alterado` com a pessoa. | Seria lido como prazo escolhido à mão (D3) e a linha do tempo diria "Thiago prazo 13/10". | 1, 6 |
| D6 | **Quando abre a janela de impacto:** ao salvar, se alguma prioridade **mudada** tem demanda aberta. Uma janela só para todas as prioridades mudadas, uma escolha para todas. "APLICAR TAMBÉM ÀS N ABERTAS" só aparece se N > 0 (N = as que mudariam). Sem demanda aberta, salva direto. | Uma janela por prioridade. | Mais cliques sem ganho; o caso comum é mudar uma. | 6 |
| D7 | **Permissão das funções novas** = quem edita Prazos hoje: `tem_permissao('configuracoes','sim')` (administrador ou "Configurações: Sim", dentro do horário). As contagens são do **escritório inteiro** (a regra vale para todas as demandas), só números. | Contar só as demandas que a pessoa vê. | A janela mentiria sobre o efeito da mudança. | 1 |
| D8 | **Menu (11 seções em 4 grupos):** Escritório = Expediente, Prazos, Feriados · Agente e atendimento = Mensagens (com o aviso do login), Respostas prontas, Limites de espera, **Teto e modelos de IA** (só admin; três cartões: Teto de IA e alertas, Modelos de IA, Cotação e custo da transcrição) · Cadastros = Setores, Serviços, Cargos · Sistema = Integrações (só admin) e o link Usuários e permissões (só admin). A imagem junta "Expediente e IA". | Seguir a imagem ("Expediente e IA" numa seção só). | Misturaria numa seção cartões que "Configurações: Sim" edita com cartões só do administrador. | 3, 10 |
| D9 | **"Demanda sem responsável: avisar após"** (`minutos_alerta_fila`) continua em **Teto de IA e alertas** (coluna só do administrador), não em Limites de espera (como na B). | Mover para Limites de espera. | "Configurações: Sim" veria um campo que o banco recusa. | 7 |
| D10 | **Cargos:** coluna nova `configuracoes.cargos text[]` (padrão Auxiliar, Analista, Coordenador, Sócio), editada como lista "um por linha", com "Configurações: Sim" (como Setores). É só a lista de sugestões da ficha; não muda o cargo de quem já tem. | Tabela `cargos` com chave em `usuarios`. | Migrar o texto livre de hoje e mudar `salvar_usuario` (Parte D). | 2, 9 |
| D11 | **Modelos de IA:** escolhe só entre os modelos que têm preço em `precos_modelos` (a tabela de preços aparece só para leitura). | Texto livre. | Modelo sem preço deixa o gasto zerado em Gastos com IA. | 7 |
| D12 | **Endereço por seção:** `?secao=<id>`; sem `secao`, Expediente; seção desconhecida ou só do administrador pedida por quem não é → **redireciona** para Expediente (a URL sempre diz o que está na tela). Âncoras antigas (`#teto-ia`, `#atendimento`, `#integracoes`…) viram a seção certa no navegador. | Aceitar `?secao=ia` e mostrar outra coisa. | URL e trilha diriam uma seção e a tela outra. | 3, 10 |
| D13 | **Rascunho só na seção aberta:** trocar de seção pergunta antes; por isso "● não salvo" aparece só no item da seção aberta. | Guardar rascunhos por seção (sessionStorage). | Estado escondido que a pessoa esquece; risco de salvar valor velho. | 10, 11 |
| D14 | **Janela ao sair:** pega todo clique em link do painel (menu da seção, menu lateral, trilha, atalhos). Fechar ou recarregar a aba continua com a pergunta do navegador (o navegador não deixa janela própria). O botão Voltar do navegador **não** é interceptado (o roteador do Next não tem gancho estável). As outras telas continuam com o `confirm` de hoje (a guarda é opcional). | Interceptar o Voltar. | Gambiarra no histórico, frágil a cada versão do Next. | 4, 11 |
| D15 | **SALVAR E SAIR em Prazos** passa pela janela de impacto (a escolha dela vale) e só sai se salvar. | Salvar "só para as novas" sem perguntar. | Pularia o ponto que "não pode falhar" do Prompt G. | 6, 11 |
| D16 | **Urgente usa o mesmo campo de número** (0 = mesmo dia, fim do expediente) das outras prioridades; a imagem mostra uma lista. | Lista só para Urgente. | Dois controles diferentes para o mesmo dado. | 5 |
| D17 | **Exemplo de vencimento:** "aberta hoje às 10:00" (Brasília), como na imagem, mesmo no fim de semana (o exemplo mostra que conta do próximo dia útil). | Próximo dia útil às 10:00. | O exemplo esconderia a regra do fim de semana. | 5 |
| D18 | **"Quem pode mudar o prazo":** os nomes só para o administrador (lê `usuarios`); "Configurações: Sim" vê só a explicação. | Função nova que lista nomes para todos. | Expõe a equipe a quem não administra pessoas. | 5 |
| D19 | **Respostas prontas:** edita pergunta, resposta e **ativa** (a coluna `ativo` já existe e o agente só lê as ativas). | Só pergunta e resposta. | Para tirar uma do ar seria preciso apagar. | 8 |
| D20 | **Integrações** (não está na lista do spec, mas existe hoje) continua, em Sistema, só do administrador, recarregando a cada minuto só nessa seção. | Tirar. | O dono perderia o sinal de vida que usa hoje. | 9 |
| D21 | **Salvar sem recarregar a página:** cada cartão envia pela ação do servidor, que devolve `{ ok, mensagem | erro }`; o erro aparece no cartão e no aviso, e **o que foi digitado fica**. Some o `?erro=` da URL. | Manter `<form action>` com recarga. | O React 19 limpa o formulário depois da action; o erro apagaria o digitado. | 4 a 9 |
| D22 | **Trilha do topo** mostra a seção ("Configurações › Prazos"), lendo `?secao` com `useSearchParams` dentro de `Suspense`. | Trilha só "Configurações". | Diferente da imagem. | 10 |
| D23 | **Sem tempo real** (o teste congelado fixa a lista do `supabase_realtime`): contagens e exemplos são lidos ao abrir a seção. | Publicar tabela nova. | Quebra o teste 22. | — |
| D24 | **Títulos de cartão de hoje continuam** ("Prazos por prioridade", "Teto de IA e alertas", "Expediente"): os testes e a acessibilidade acham por eles. A imagem escreve "Prazo sugerido por prioridade". | Trocar pelos da imagem. | Mexer em testes de outras partes sem ganho. | 5, 7 |
| D25 | **Homologação sem as migrações:** o painel desta branch funciona; a seção Prazos mostra "exemplo e contagem indisponíveis: falta a atualização do banco" e a janela de impacto avisa o erro; Cargos usa a lista padrão. | Exigir a migração para abrir Configurações. | O dono não veria a tela antes de aprovar as migrações (as da F também estão pendentes). | 5, 6, 9 |

## Restrições globais

- **Só mexer em:**
  - banco: **criar** `supabase/migrations/20261007000100_painel_v2_prazos_regra.sql`, `20261007000200_painel_v2_cargos.sql` e os testes `supabase/tests/35_painel_v2_prazos_regra.test.sql`, `36_painel_v2_cargos.test.sql`;
  - `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão);
  - `apps/painel` (tela, lib, componentes, e2e) e `docs/design-system.md`, `docs/operacao.md`.
  - Nada no trabalhador, no prompt do agente, no Bling.
- **Nunca editar migração antiga** (`20261006000300` e anteriores). Toda mudança é migração nova, a partir de `20261007000100`.
- **Nunca editar teste pgTAP de parte anterior** (`01` a `34`). **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` não muda e continua 100/100** depois de cada migração desta parte. Ele está congelado em `8f5eb71` e também fixa a lista do `supabase_realtime`: **nenhuma tabela nova publicada** (D23). Se falhar, a migração mudou o que alguém vê ou faz: corrija a migração, nunca o teste. Na Entrega, `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio. O `25_painel_v2_horario.test.sql` procura `insert|update|delete` no corpo de toda função `security definer` que `authenticated` executa e exige uma trava no corpo (`tem_permissao`, `eh_admin`, `exigir_acesso`…): `aplicar_prazo_abertas` tem `tem_permissao` no corpo; `simular_mudanca_prazo` e `prazos_resumo` **não podem ter** essas palavras no corpo (nem em comentário dentro do corpo).
- **Funções novas:** `security definer`, `set search_path = ''`, nomes com `public.`, `revoke execute … from public, anon` (e de `authenticated` nas internas), `grant execute … to authenticated` só nas chamadas pelo painel. **Nunca** use `usuario_liberado` (é só do `service_role`) em função chamada como `authenticated`; a trava é `public.tem_permissao('configuracoes', 'sim')` (administrador ativo ou "Configurações: Sim", dentro do horário).
- **Permissão por seção = a de hoje,** no servidor (ações) e no banco (RLS/gatilho): Expediente, Prazos, Feriados, Mensagens, aviso do login, Respostas prontas, Limites de espera, Setores, Serviços e Cargos com `exigirConfiguracoes()`; Teto de IA e alertas, Modelos de IA, Cotação e custo da transcrição com `exigirAdmin()` (o gatilho `configuracoes_so_admin` recusa de novo); Integrações e Usuários só para o administrador.
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`).
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os testes do painel (e2e) deixam no banco quebram os pgTAP antigos. O reset reaplica todas as migrações, inclusive as novas.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts`.
- **E2e só contra o banco local:** `apps/painel/e2e/trava-local.ts` recusa outro banco. **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`** (só leitura, na Entrega, para o `--dry-run` e o painel do dono).
- **Nenhum trabalhador é ligado nem desligado nesta parte** (G1 não muda o trabalhador). O da porta **3001 é o teste do dono: não desligue nem mate esse processo.**
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit.
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[300px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind. A marcação âmbar dos campos alterados é CSS em `app/globals.css` com `var(--warning-*)` (Task 4). `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (os botões `primary/outline/danger` já são `uppercase`). Vermelho nunca sozinho (ícone + texto).
- **Termos (spec 3.1):** Demanda, Atendimento, Conversa, Empresa, Contato, Setor. "Pessoa" para usuário da equipe.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **`simular_mudanca_prazo` grava algo** (por descuido, num ajuste futuro): ela é `stable` (o Postgres recusa `insert/update/delete` dentro de função não volátil) e o pgTAP compara eventos, prazos e configuração antes e depois. Task 1.
2. **Recálculo atropela decisão da equipe ou a pausa:** prazo escolhido à mão fica; "Com o cliente" continua pausada desde a mesma hora e, ao sair, ainda anda o tempo parado; outra prioridade e demanda concluída não mudam; cada recalculada ganha **um** evento com a pessoa; sem a marca de recálculo, mudar o prazo na pausa continua reiniciando a pausa (regra da Parte C). Task 1 (pgTAP) e Task 6 (e2e com a linha do tempo).
3. **Quem não pode, pela API:** atendente sem "Configurações", pessoa com "Configurações: Sim" fora do horário e `anon` chamam `simular_mudanca_prazo`, `aplicar_prazo_abertas` e `prazos_resumo` direto: recusado. "Configurações: Sim" chamando a ação do servidor `salvarModelos`/`salvarCotacao`/`salvarTetoAlertas`: `exigirAdmin()` e o gatilho recusam. Task 1 (pgTAP) e Task 7 (e2e).
4. **Janela de saída:** CONTINUAR AQUI mantém o digitado; DESCARTAR volta ao salvo e navega; SALVAR E SAIR com campo inválido **não sai**; em Prazos passa pela janela de impacto; clique no menu lateral do painel também pergunta; link para a própria seção não pergunta. Task 11.
5. **Erro ao salvar não apaga o digitado** (React 19 limpa `<form action>`): os cartões enviam por `onSubmit`; o erro aparece no cartão. Task 4 (componente), Task 5 (e2e: validação do navegador mantém o digitado) e Task 9 (e2e: cargo repetido recusado pelo servidor, erro no cartão, lista digitada continua).
6. **Links antigos** (`/configuracoes#teto-ia`, `#integracoes` do atalho do WhatsApp, `#atendimento`) e seção proibida pela URL caem na seção certa. Task 10.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261007000100_painel_v2_prazos_regra.sql`, `supabase/tests/35_painel_v2_prazos_regra.test.sql` (novos) | evento novo, calendário, simular, aplicar, resumo, gatilho da pausa | 1 |
| `supabase/migrations/20261007000200_painel_v2_cargos.sql`, `supabase/tests/36_painel_v2_cargos.test.sql` (novos), `packages/db/src/tipos.gen.ts` | lista de cargos; tipos | 2 |
| `apps/painel/src/lib/configuracoes.ts` (+ `configuracoes.test.ts`) (novos) | seções, grupos, resumos, textos de prazo e impacto | 3 |
| `apps/painel/src/components/patterns/formulario-alteravel.tsx` (+ `formulario-alteravel.test.ts` novo), `apps/painel/src/app/globals.css`, `app/(painel)/configuracoes/{formulario-config.tsx,cartao.tsx,tipos.ts}` (novos) (+ `formulario-config.test.ts`) | âmbar, antes, descartar, contagem, guarda de saída; cartão que salva sozinho | 4 |
| `configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx,horario-expediente.tsx}`, `configuracoes/secoes/{expediente,feriados,prazos,prazos-tabela}.tsx` (novos), `e2e/configuracoes-escritorio.spec.ts` (novo), `e2e/apoio-configuracoes.ts` (novo) | Escritório | 5 |
| `configuracoes/{acoes.ts,secoes/prazos.tsx}`, `configuracoes/secoes/{formulario-prazos,janela-impacto}.tsx` (novos), `lib/{linha-do-tempo,pedido-nota}.ts` (+ testes), `e2e/configuracoes-prazos.spec.ts` (novo), `e2e/configuracoes.spec.ts` | janela de impacto, aplicar, linha do tempo | 6 |
| `configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx}`, `configuracoes/secoes/{mensagens,espera,ia}.tsx` (novos), `configuracoes/formulario-espera.tsx` (apagar), `e2e/configuracoes-agente.spec.ts` (novo), `e2e/configuracoes.spec.ts` | Agente e atendimento | 7 |
| `configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx}`, `configuracoes/secoes/respostas.tsx` (novo), `e2e/configuracoes.spec.ts` | Respostas prontas com edição | 8 |
| `configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx}`, `configuracoes/secoes/{setores,servicos,cargos,integracoes}.tsx` (novos), `lib/usuarios.ts` (+ teste), `usuarios/{novo/page.tsx,[id]/page.tsx}`, `e2e/configuracoes-cadastros.spec.ts` (novo) | Cadastros e Sistema | 9 |
| `configuracoes/{page.tsx,loading.tsx}`, `configuracoes/menu-secoes.tsx` (novo), `configuracoes/navegacao-secoes.tsx` (apagar), `components/layout/{trilha.ts,trilha.test.ts,topbar.tsx,atalhos-menu.tsx}`, `lib/{menu.ts,menu.test.ts}`, `gastos-ia/{page.tsx,cartoes.tsx}`, `e2e/{configuracoes-secoes.spec.ts (novo),configuracoes.spec.ts,atendimento-lista.spec.ts,menu.spec.ts,niveis-telas.spec.ts}` | uma seção por vez, menu, trilha, links | 10 |
| `configuracoes/guarda-saida.tsx` (novo), `configuracoes/page.tsx`, `e2e/configuracoes-saida.spec.ts` (novo) | janela ao sair | 11 |
| `e2e/acessibilidade.spec.ts`, `app/(painel)/_design/page.tsx`, `docs/design-system.md`, `docs/operacao.md` | acessibilidade e manuais | 12 |

Durante as Tasks 5 a 9 a página ainda é a lista longa de hoje: cada task troca o bloco da sua seção pelo componente novo. A Task 10 passa para uma seção por vez. Os e2e novos já abrem `/configuracoes?secao=<id>` (a página longa ignora o parâmetro; depois da Task 10 ele escolhe a seção), então não mudam na Task 10.

---

### Task 1: Banco. Prazo por regra: simular, aplicar e resumo

**Files:**
- Create: `supabase/migrations/20261007000100_painel_v2_prazos_regra.sql`
- Create: `supabase/tests/35_painel_v2_prazos_regra.test.sql`

**Interfaces:**
- Consumes: `prioridade_demanda`, `chamados.{prioridade,prazo_em,prazo_pausado_desde,status}`, `chamado_eventos`, `configuracoes.prazo_*_dias`, `eh_dia_util`, `proximo_dia_util`, `calcular_prazo`, `tempo_util_entre`, `somar_tempo_util`, `texto_prazo` (Parte C, `20261003000300`), `chamados_antes_alterar` (última versão em `20261003000400`), `tem_permissao(text, text)` (Parte D).
- Produces:
  - `chamado_eventos.tipo` aceita `'prazo_recalculado'`;
  - internas (sem grant): `dia_util_anterior(date) returns date`, `deslocar_dias_uteis(timestamptz, int) returns timestamptz`, `calcular_prazo_dias(int, timestamptz) returns timestamptz`, `prazo_segue_regra(uuid) returns boolean`;
  - `simular_mudanca_prazo(p_prioridade prioridade_demanda, p_dias int) returns jsonb` **stable**: `{prioridade, dias_atuais, dias_novos, abertas, pela_regra, a_mao, sem_prazo, ganham, perdem, pausadas, passam_a_vencidas, ja_vencidas}`;
  - `aplicar_prazo_abertas(p_prioridade prioridade_demanda, p_dias int) returns int` (quantas mudaram);
  - `prazos_resumo(p_inicio timestamptz default now()) returns jsonb` **stable**: `{abertas: {urgente, alta, normal, baixa}, exemplos: [timestamptz × 31]}` (`exemplos[n]` = vencimento com n dias úteis a partir de `p_inicio`);
  - recusas: `'Só quem tem acesso às Configurações muda os prazos.'` e `'O prazo precisa ser de 0 a 30 dias úteis.'`.

- [ ] **Passo 0: guardar a regressão de antes**

Com o Supabase local nas portas 563xx (Restrições globais): `supabase db reset && supabase test db 2>&1 | grep -E "22_regressao|25_painel|Result" | tee "$SCRATCH/regressao-antes.txt"`.
Expected: `22_regressao_visibilidade.test.sql .. ok` (100/100), `25_painel_v2_horario.test.sql .. ok` e `Result: PASS`.

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/35_painel_v2_prazos_regra.test.sql`:

```sql
-- Parte G1, Task 1 (spec 7C.4 e 7C.6): simular_mudanca_prazo só lê; aplicar_prazo_abertas grava a regra e recalcula as
-- abertas que seguem a regra (prazo escolhido à mão fica), com um evento por demanda, sem perder a pausa de "Com o cliente".
begin;
create extension if not exists pgtap with schema extensions;
select plan(46);

-- Calendário fixo: seg–sex 08–18, prazos 0/1/2/5, feriado na segunda 12/10/2026 (09/10 é sexta; 10/03/2027, quarta).
update public.configuracoes set dias_uteis = '{1,2,3,4,5}', horario_inicio = '08:00', horario_fim = '18:00',
  prazo_urgente_dias = 0, prazo_alta_dias = 1, prazo_normal_dias = 2, prazo_baixa_dias = 5 where id = 1;
insert into public.feriados (data, descricao) values ('2026-10-12', 'Nossa Senhora Aparecida (G1)')
  on conflict (data) do update set descricao = excluded.descricao;
-- As contagens são do escritório inteiro: só as demandas deste teste ficam abertas.
update public.chamados set status = 'concluido', concluido_em = coalesce(concluido_em, now()) where status <> 'concluido';

insert into auth.users (id, email) values
  ('e1000000-0000-0000-0000-00000000000a', 'admin@g1.local'), ('e1000000-0000-0000-0000-00000000000b', 'conf@g1.local'),
  ('e1000000-0000-0000-0000-00000000000c', 'sem@g1.local'), ('e1000000-0000-0000-0000-00000000000d', 'noite@g1.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e1000000-0000-0000-0000-00000000000a', 'Admin G1', 'admin@g1.local', 'admin'),
  ('e1000000-0000-0000-0000-00000000000b', 'Conf G1', 'conf@g1.local', 'atendente'),
  ('e1000000-0000-0000-0000-00000000000c', 'Sem G1', 'sem@g1.local', 'atendente'),
  ('e1000000-0000-0000-0000-00000000000d', 'Noite G1', 'noite@g1.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim'
where modulo = 'configuracoes' and usuario_id in ('e1000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000d');
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'e1000000-0000-0000-0000-00000000000d';
insert into public.setores (id, nome) values ('e1100000-0000-0000-0000-000000000001', 'Setor G1');

-- A: segue a regra · B: prazo escolhido à mão · C: Normal pausada "Com o cliente" · G: vence daqui a 1 hora
-- E: outra prioridade · H: Baixa pausada (regra antiga do gatilho).
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em) values
  ('e1200000-0000-0000-0000-000000000001', 'e1100000-0000-0000-0000-000000000001', 'G1 A', 'normal', '2027-03-10 18:00-03'),
  ('e1200000-0000-0000-0000-000000000002', 'e1100000-0000-0000-0000-000000000001', 'G1 B', 'normal', '2027-03-10 18:00-03'),
  ('e1200000-0000-0000-0000-000000000004', 'e1100000-0000-0000-0000-000000000001', 'G1 G', 'normal', now() + interval '1 hour'),
  ('e1200000-0000-0000-0000-000000000005', 'e1100000-0000-0000-0000-000000000001', 'G1 E', 'alta', '2027-03-10 18:00-03');
insert into public.chamados (id, setor_id, titulo, prioridade, prazo_em, status, prazo_pausado_desde) values
  ('e1200000-0000-0000-0000-000000000003', 'e1100000-0000-0000-0000-000000000001', 'G1 C', 'normal', '2027-03-10 18:00-03',
   'aguardando_cliente', now() - interval '3 days'),
  ('e1200000-0000-0000-0000-000000000006', 'e1100000-0000-0000-0000-000000000001', 'G1 H', 'baixa', '2027-03-10 18:00-03',
   'aguardando_cliente', now() - interval '3 days');
-- Uma pessoa escolheu o prazo de B na demanda (depois da abertura).
insert into public.chamado_eventos (chamado_id, tipo, usuario_id, texto)
  values ('e1200000-0000-0000-0000-000000000002', 'prazo_alterado', 'e1000000-0000-0000-0000-00000000000a',
          public.texto_prazo('2027-03-10 18:00-03'));
create temp table g1_antes as select id, prazo_em from public.chamados where titulo like 'G1 %';

-- 1–9: estrutura e quem executa
select has_function('public', 'simular_mudanca_prazo', 'simular existe');
select has_function('public', 'aplicar_prazo_abertas', 'aplicar existe');
select has_function('public', 'prazos_resumo', 'resumo existe');
select is((select provolatile::text from pg_proc where oid = 'public.simular_mudanca_prazo(public.prioridade_demanda, integer)'::regprocedure),
  's', 'simular é stable: o Postgres recusa gravação dentro dela');
select is((select provolatile::text from pg_proc where oid = 'public.prazos_resumo(timestamptz)'::regprocedure), 's', 'resumo é stable');
select ok(not has_function_privilege('anon', 'public.simular_mudanca_prazo(public.prioridade_demanda, integer)', 'execute'), 'anon não simula');
select ok(not has_function_privilege('anon', 'public.aplicar_prazo_abertas(public.prioridade_demanda, integer)', 'execute'), 'anon não aplica');
select ok(not has_function_privilege('authenticated', 'public.deslocar_dias_uteis(timestamptz, integer)', 'execute'), 'deslocar: interna');
select ok(not has_function_privilege('authenticated', 'public.prazo_segue_regra(uuid)', 'execute'), 'segue_regra: interna');

-- 10–15: calendário
select is(public.deslocar_dias_uteis('2026-10-09 18:00-03', 1), '2026-10-13 18:00-03'::timestamptz, 'sexta + 1 dia útil = terça (pula fim de semana e feriado)');
select is(public.deslocar_dias_uteis('2026-10-13 18:00-03', -1), '2026-10-09 18:00-03'::timestamptz, 'terça − 1 dia útil = sexta');
select is(public.deslocar_dias_uteis('2026-10-13 15:30-03', 0), '2026-10-13 15:30-03'::timestamptz, 'zero não mexe');
select is(public.deslocar_dias_uteis('2026-10-09 18:00-03', 2), '2026-10-14 18:00-03'::timestamptz, 'sexta + 2 = quarta');
select is(public.calcular_prazo_dias(2, '2026-10-09 10:00-03'), public.calcular_prazo('normal', '2026-10-09 10:00-03'), 'mesma conta do calcular_prazo');
select is(public.calcular_prazo_dias(0, '2026-10-09 19:00-03'), public.calcular_prazo('urgente', '2026-10-09 19:00-03'), 'depois do expediente: próximo dia útil');

-- 16–18: prazo à mão e o tipo novo de evento
select ok(public.prazo_segue_regra('e1200000-0000-0000-0000-000000000001'), 'A segue a regra');
select ok(not public.prazo_segue_regra('e1200000-0000-0000-0000-000000000002'), 'B tem prazo escolhido à mão');
select lives_ok($$ insert into public.chamado_eventos (chamado_id, tipo, texto)
  values ('e1200000-0000-0000-0000-000000000005', 'prazo_recalculado', public.texto_prazo(now())) $$, 'tipo prazo_recalculado aceito');

create temp table g1_snap as
  select (select count(*) from public.chamado_eventos) as eventos, (select prazo_normal_dias from public.configuracoes where id = 1) as normal;

-- 19–22: quem não pode
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.simular_mudanca_prazo('normal', 3) $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'sem Configurações: não simula');
select throws_ok($$ select public.aplicar_prazo_abertas('normal', 3) $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'sem Configurações: não aplica');
select throws_ok($$ select public.prazos_resumo() $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'sem Configurações: não lê o resumo');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select public.simular_mudanca_prazo('normal', 3) $$, 'P0001', 'Só quem tem acesso às Configurações muda os prazos.', 'fora do horário: não simula');

-- 23–30: simular e resumo (Configurações: Sim; administrador)
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.simular_mudanca_prazo('normal', 3) - 'prioridade',
  '{"dias_atuais":2,"dias_novos":3,"abertas":4,"pela_regra":3,"a_mao":1,"sem_prazo":0,"ganham":3,"perdem":0,"pausadas":1,"passam_a_vencidas":0,"ja_vencidas":0}'::jsonb,
  'Normal 2→3: A, C e G ganham 1 dia útil; B fica; C continua pausada');
select is((select array[(s ->> 'perdem')::int, (s ->> 'passam_a_vencidas')::int] from (select public.simular_mudanca_prazo('normal', 0) s) x),
  array[3, 1], 'Normal 2→0: três perdem 2 dias úteis; G passaria a vencida (C pausada não conta)');
select is((select (s ->> 'ganham')::int + (s ->> 'perdem')::int from (select public.simular_mudanca_prazo('normal', 2) s) x), 0, 'mesmo valor: ninguém muda');
select throws_ok($$ select public.simular_mudanca_prazo('normal', 31) $$, 'P0001', 'O prazo precisa ser de 0 a 30 dias úteis.', 'fora de 0 a 30: recusa');
select is(public.prazos_resumo('2026-10-09 10:00-03') -> 'abertas' ->> 'normal', '4', 'abertas por prioridade');
select is(jsonb_array_length(public.prazos_resumo('2026-10-09 10:00-03') -> 'exemplos'), 31, 'exemplos de 0 a 30 dias úteis');
select is((public.prazos_resumo('2026-10-09 10:00-03') -> 'exemplos' ->> 2)::timestamptz, '2026-10-14 18:00-03'::timestamptz,
  'aberta sexta 10:00 com 2 dias úteis: quarta 18:00 (pula o feriado)');
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.simular_mudanca_prazo('alta', 2) $$, 'administrador simula');

-- 31: simular e resumo não gravaram nada
reset role;
select ok(
  (select count(*) from public.chamado_eventos) = (select eventos from g1_snap)
  and (select prazo_normal_dias from public.configuracoes where id = 1) = (select normal from g1_snap)
  and not exists (select 1 from g1_antes a join public.chamados c using (id) where c.prazo_em is distinct from a.prazo_em),
  'simular e resumo: eventos, prazos e configuração iguais');

-- 32–40: aplicar Normal 2→3 (Configurações: Sim)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.aplicar_prazo_abertas('normal', 3), 3, 'recalcula as três que seguem a regra');
reset role;
select is((select prazo_normal_dias from public.configuracoes where id = 1), 3, 'a regra nova ficou gravada');
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000001'), '2027-03-11 18:00-03'::timestamptz, 'A: quarta → quinta');
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000002'), '2027-03-10 18:00-03'::timestamptz, 'B (à mão) não muda');
select results_eq(
  $$ select right(chamado_id::text, 1), usuario_id::text from public.chamado_eventos
     where tipo = 'prazo_recalculado' and chamado_id::text like 'e1200000-%' and chamado_id <> 'e1200000-0000-0000-0000-000000000005' order by 1 $$,
  $$ values ('1', 'e1000000-0000-0000-0000-00000000000b'), ('3', 'e1000000-0000-0000-0000-00000000000b'), ('4', 'e1000000-0000-0000-0000-00000000000b') $$,
  'um evento por demanda recalculada, com a pessoa; a de prazo à mão não ganha evento');
select is((select texto from public.chamado_eventos where tipo = 'prazo_recalculado' and chamado_id = 'e1200000-0000-0000-0000-000000000001'),
  public.texto_prazo('2027-03-11 18:00-03'), 'o evento leva o prazo novo');
select is((select prazo_pausado_desde from public.chamados where id = 'e1200000-0000-0000-0000-000000000003'), now() - interval '3 days',
  'C continua pausada desde a mesma hora');
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000005'), '2027-03-10 18:00-03'::timestamptz, 'outra prioridade não muda');
select is(coalesce(current_setting('escritorio.prazo_por_regra', true), ''), '', 'a marca do recálculo é desligada no fim');

-- 41–42: ao sair de "Com o cliente", C anda o tempo parado desde a pausa original; sem a marca, a regra antiga vale
update public.chamados set status = 'em_andamento' where id = 'e1200000-0000-0000-0000-000000000003';
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000003'),
  public.somar_tempo_util('2027-03-11 18:00-03', public.tempo_util_entre(now() - interval '3 days', now())),
  'C: prazo recalculado + o tempo útil que ficou com o cliente');
update public.chamados set prazo_em = prazo_em + interval '1 day' where id = 'e1200000-0000-0000-0000-000000000006';
select is((select prazo_pausado_desde from public.chamados where id = 'e1200000-0000-0000-0000-000000000006'), now(),
  'prazo trocado na pausa sem ser recálculo: a pausa recomeça (Parte C)');

-- 43–46: voltar 3→2 desfaz; repetir não muda nada; prioridade nova recomeça a regra
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(public.aplicar_prazo_abertas('normal', 2), 3, 'recalculadas continuam seguindo a regra');
select is(public.aplicar_prazo_abertas('normal', 2), 0, 'mesmo valor: nada muda, nenhum evento');
reset role;
select is((select prazo_em from public.chamados where id = 'e1200000-0000-0000-0000-000000000001'), '2027-03-10 18:00-03'::timestamptz, 'A voltou para quarta');
insert into public.chamado_eventos (chamado_id, tipo, usuario_id, texto)
  values ('e1200000-0000-0000-0000-000000000002', 'prioridade_alterada', 'e1000000-0000-0000-0000-00000000000a', 'normal');
select ok(public.prazo_segue_regra('e1200000-0000-0000-0000-000000000002'), 'depois de mudar a prioridade, B volta a seguir a regra');

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db --file supabase/tests/35_painel_v2_prazos_regra.test.sql` (se a CLI não aceitar `--file`, `supabase test db` e olhe a linha do 35).
Expected: FAIL — `function public.deslocar_dias_uteis(...) does not exist` / `has_function` falso.

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261007000100_painel_v2_prazos_regra.sql`:

```sql
-- supabase/migrations/20261007000100_painel_v2_prazos_regra.sql
-- Painel v2, Parte G1 (spec 7C.4): mudar o prazo de uma prioridade mostra o impacto antes (simular_mudanca_prazo, só leitura)
-- e pode valer também para as abertas (aplicar_prazo_abertas: grava a regra e recalcula na mesma transação, um evento por
-- demanda). Recalcular = andar a diferença de dias úteis (D1). Prazo escolhido à mão fica (D3); "Com o cliente" segue
-- pausada desde a mesma hora (D4).

-- Evento novo na linha do tempo: "prazo recalculado por mudança de regra (<pessoa>)" (D5).
alter table public.chamado_eventos drop constraint chamado_eventos_tipo_check;
alter table public.chamado_eventos add constraint chamado_eventos_tipo_check check (tipo in (
  'criacao', 'assumido', 'transferencia', 'nota_interna', 'conclusao',
  'status_alterado', 'prioridade_alterada', 'prazo_alterado', 'responsavel_alterado', 'editado', 'reaberto',
  'prazo_recalculado'));

-- ---------- Calendário (internas) ----------

-- Dia útil anterior a p_dia; null se não houver nenhum em um ano (todos os dias desmarcados).
create function public.dia_util_anterior(p_dia date) returns date
language plpgsql stable security definer set search_path = '' as $$
declare v date := p_dia;
begin
  for i in 1..366 loop
    v := v - 1;
    if public.eh_dia_util(v) then return v; end if;
  end loop;
  return null;
end $$;

-- Anda p_dias dias úteis (para trás se negativo), com a mesma hora de Brasília. Num prazo da regra antiga (fim do
-- expediente do N-ésimo dia útil, mais o tempo que a pausa já somou) dá o da regra nova com a mesma pausa somada.
create function public.deslocar_dias_uteis(p_prazo timestamptz, p_dias int) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hora time := (p_prazo at time zone 'America/Sao_Paulo')::time;
  v_dia date := (p_prazo at time zone 'America/Sao_Paulo')::date;
begin
  if p_prazo is null or p_dias is null or p_dias = 0 then return p_prazo; end if;
  for i in 1..abs(p_dias) loop
    v_dia := case when p_dias > 0 then public.proximo_dia_util(v_dia) else public.dia_util_anterior(v_dia) end;
    if v_dia is null then return null; end if;
  end loop;
  return (v_dia + v_hora) at time zone 'America/Sao_Paulo';
end $$;

-- A conta do calcular_prazo com o número de dias dado (exemplos da tela; o pgTAP confere que bate com calcular_prazo).
create function public.calcular_prazo_dias(p_dias int, p_inicio timestamptz) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  c public.configuracoes%rowtype;
  v_local timestamp := p_inicio at time zone 'America/Sao_Paulo';
  v_dia date := (p_inicio at time zone 'America/Sao_Paulo')::date;
begin
  select * into c from public.configuracoes where id = 1;
  if not public.eh_dia_util(v_dia) or v_local::time >= c.horario_fim then
    v_dia := public.proximo_dia_util(v_dia);
  end if;
  for i in 1..coalesce(p_dias, 0) loop
    exit when v_dia is null;
    v_dia := public.proximo_dia_util(v_dia);
  end loop;
  if v_dia is null then return null; end if;
  return (v_dia + c.horario_fim) at time zone 'America/Sao_Paulo';
end $$;

-- O prazo é da regra se nenhuma pessoa o escolheu depois do último evento que recomeça a regra (abertura, reabertura,
-- troca de prioridade ou recálculo). O empurrão da pausa (prazo_alterado sem pessoa) não conta (D3).
create function public.prazo_segue_regra(p_chamado uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.chamado_eventos m
    where m.chamado_id = p_chamado and m.tipo = 'prazo_alterado' and m.usuario_id is not null
      and m.criado_em > coalesce((
        select max(r.criado_em) from public.chamado_eventos r
        where r.chamado_id = p_chamado and r.tipo in ('criacao', 'reaberto', 'prioridade_alterada', 'prazo_recalculado')
      ), '-infinity'::timestamptz))
$$;

revoke execute on function public.dia_util_anterior(date), public.deslocar_dias_uteis(timestamptz, int),
  public.calcular_prazo_dias(int, timestamptz), public.prazo_segue_regra(uuid) from public, anon, authenticated;

-- ---------- Para a tela de Prazos ----------

-- Impacto de mudar a regra de uma prioridade, sem gravar (stable: o Postgres recusaria qualquer gravação aqui).
create function public.simular_mudanca_prazo(p_prioridade public.prioridade_demanda, p_dias int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_atual int;
  v jsonb;
begin
  if not public.tem_permissao('configuracoes', 'sim') then
    raise exception 'Só quem tem acesso às Configurações muda os prazos.';
  end if;
  if p_prioridade is null or p_dias is null or p_dias not between 0 and 30 then
    raise exception 'O prazo precisa ser de 0 a 30 dias úteis.';
  end if;
  select case p_prioridade when 'urgente' then c.prazo_urgente_dias when 'alta' then c.prazo_alta_dias
              when 'normal' then c.prazo_normal_dias else c.prazo_baixa_dias end
    into v_atual from public.configuracoes c where c.id = 1;
  select jsonb_build_object(
    'prioridade', p_prioridade, 'dias_atuais', v_atual, 'dias_novos', p_dias,
    'abertas', count(*),
    'pela_regra', count(*) filter (where x.prazo_em is not null and x.regra),
    'a_mao', count(*) filter (where x.prazo_em is not null and not x.regra),
    'sem_prazo', count(*) filter (where x.prazo_em is null),
    'ganham', count(*) filter (where x.regra and x.novo > x.prazo_em),
    'perdem', count(*) filter (where x.regra and x.novo < x.prazo_em),
    'pausadas', count(*) filter (where x.regra and x.pausada and x.novo is distinct from x.prazo_em),
    'passam_a_vencidas', count(*) filter (where x.regra and not x.pausada and x.prazo_em >= now() and x.novo < now()),
    'ja_vencidas', count(*) filter (where not x.pausada and x.prazo_em < now()))
  into v
  from (
    select c.prazo_em, c.prazo_pausado_desde is not null as pausada, public.prazo_segue_regra(c.id) as regra,
           public.deslocar_dias_uteis(c.prazo_em, p_dias - v_atual) as novo
    from public.chamados c
    where c.prioridade = p_prioridade and c.status <> 'concluido'
  ) x;
  return v;
end $$;

-- Grava a regra nova e anda a diferença nas abertas que seguem a regra, com um evento em cada (D1–D5).
create function public.aplicar_prazo_abertas(p_prioridade public.prioridade_demanda, p_dias int) returns int
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_atual int;
  v_dif int;
  v_novo timestamptz;
  v_n int := 0;
  r record;
begin
  if not public.tem_permissao('configuracoes', 'sim') then
    raise exception 'Só quem tem acesso às Configurações muda os prazos.';
  end if;
  if p_prioridade is null or p_dias is null or p_dias not between 0 and 30 then
    raise exception 'O prazo precisa ser de 0 a 30 dias úteis.';
  end if;
  select case p_prioridade when 'urgente' then c.prazo_urgente_dias when 'alta' then c.prazo_alta_dias
              when 'normal' then c.prazo_normal_dias else c.prazo_baixa_dias end
    into v_atual from public.configuracoes c where c.id = 1 for update;
  v_dif := p_dias - v_atual;
  if v_dif = 0 then return 0; end if;
  update public.configuracoes set
    prazo_urgente_dias = case when p_prioridade = 'urgente' then p_dias else prazo_urgente_dias end,
    prazo_alta_dias = case when p_prioridade = 'alta' then p_dias else prazo_alta_dias end,
    prazo_normal_dias = case when p_prioridade = 'normal' then p_dias else prazo_normal_dias end,
    prazo_baixa_dias = case when p_prioridade = 'baixa' then p_dias else prazo_baixa_dias end
  where id = 1;
  -- A pausa de "Com o cliente" continua contando desde a mesma hora (o gatilho lê esta marca).
  perform set_config('escritorio.prazo_por_regra', 'sim', true);
  for r in
    select c.id, c.cliente_id, c.prazo_em from public.chamados c
    where c.prioridade = p_prioridade and c.status <> 'concluido' and c.prazo_em is not null and public.prazo_segue_regra(c.id)
    order by c.numero
    for update
  loop
    v_novo := public.deslocar_dias_uteis(r.prazo_em, v_dif);
    continue when v_novo is null or v_novo = r.prazo_em;
    update public.chamados set prazo_em = v_novo where id = r.id;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (r.id, r.cliente_id, 'prazo_recalculado', auth.uid(), public.texto_prazo(v_novo));
    v_n := v_n + 1;
  end loop;
  perform set_config('escritorio.prazo_por_regra', '', true);
  return v_n;
end $$;

-- Abertas por prioridade (escritório inteiro, D7) e o vencimento com 0 a 30 dias úteis a partir de p_inicio.
create function public.prazos_resumo(p_inicio timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tem_permissao('configuracoes', 'sim') then
    raise exception 'Só quem tem acesso às Configurações muda os prazos.';
  end if;
  return jsonb_build_object(
    'abertas', (select jsonb_object_agg(p::text, (select count(*) from public.chamados c where c.prioridade = p and c.status <> 'concluido'))
                from unnest(enum_range(null::public.prioridade_demanda)) p),
    'exemplos', (select jsonb_agg(public.calcular_prazo_dias(d, coalesce(p_inicio, now())) order by d) from generate_series(0, 30) d));
end $$;

revoke execute on function public.simular_mudanca_prazo(public.prioridade_demanda, int),
  public.aplicar_prazo_abertas(public.prioridade_demanda, int), public.prazos_resumo(timestamptz) from public, anon;
grant execute on function public.simular_mudanca_prazo(public.prioridade_demanda, int),
  public.aplicar_prazo_abertas(public.prioridade_demanda, int), public.prazos_resumo(timestamptz) to authenticated;

-- ---------- Gatilho da pausa: igual ao de 20261003000400, menos o recálculo da regra (D4) ----------

create or replace function public.chamados_antes_alterar() returns trigger
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
  elsif new.status = 'aguardando_cliente' and new.prazo_em is distinct from old.prazo_em
        and coalesce(current_setting('escritorio.prazo_por_regra', true), '') <> 'sim' then
    -- Prazo trocado durante a pausa por uma pessoa: a pausa conta a partir de agora. No recálculo da regra, não.
    new.prazo_pausado_desde := now();
  end if;
  if new.prazo_em is distinct from old.prazo_em then new.alertado_vencimento_em := null; end if;
  -- Última atualização: só o que a equipe vê (marcas internas, como alertado_fila_em, não contam).
  if (new.status, new.prioridade, new.prazo_em, new.responsavel_id, new.setor_id, new.titulo, new.resumo, new.contato_id, new.pedido_venda, new.cliente_id, new.fora_do_contrato)
     is distinct from
     (old.status, old.prioridade, old.prazo_em, old.responsavel_id, old.setor_id, old.titulo, old.resumo, old.contato_id, old.pedido_venda, old.cliente_id, old.fora_do_contrato) then
    new.atualizado_em := now();
  end if;
  return new;
end $$;
```

(Antes de trocar `chamados_antes_alterar`, confira com `grep -ln "function public.chamados_antes_alterar" supabase/migrations/*.sql` que a última versão é a da `20261003000400`; se outra migração a trocou depois, parta da mais nova e mude só o `elsif` da pausa. Confira também com `grep -rln "chamado_eventos_tipo_check" supabase/migrations` que só a `20261003000300` mexeu na lista de tipos; se outra acrescentou tipos, mantenha-os.)

- [ ] **Passo 4: rodar e ver passar; regressão**

Run: `supabase db reset && supabase test db`
Expected: `35_painel_v2_prazos_regra` 46/46; `18_painel_v2_prazo`, `19_painel_v2_acoes_demanda` e `20_painel_v2_alerta_vencimento` continuam passando (o gatilho só mudou com a marca); `22_regressao_visibilidade` 100/100 (igual a `$SCRATCH/regressao-antes.txt`); `25_painel_v2_horario` passa (a `aplicar_prazo_abertas` tem `tem_permissao` no corpo; as stable não têm as palavras de gravação); `Result: PASS`.

- [ ] **Passo 5: commit**

```bash
git add supabase/migrations/20261007000100_painel_v2_prazos_regra.sql supabase/tests/35_painel_v2_prazos_regra.test.sql
git commit -m "feat(banco): simular e aplicar mudança de prazo por prioridade, com evento por demanda e pausa preservada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Banco. Lista de cargos; tipos

**Files:**
- Create: `supabase/migrations/20261007000200_painel_v2_cargos.sql`
- Create: `supabase/tests/36_painel_v2_cargos.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `configuracoes` e suas políticas (`alteracao_configuracoes` = "Configurações: Sim").
- Produces: `configuracoes.cargos text[] not null default '{Auxiliar,Analista,Coordenador,Sócio}'`; `public.cargos_validos(text[]) returns boolean` (immutable; até 30, cada um de 1 a 60 letras sem espaço nas pontas, sem repetir ignorando maiúsculas); tipos novos em `tipos.gen.ts` (`cargos`, `simular_mudanca_prazo`, `aplicar_prazo_abertas`, `prazos_resumo`).

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/36_painel_v2_cargos.test.sql`:

```sql
-- Parte G1, Task 2 (spec 7C.4 e seção 9): a lista de cargos da ficha da pessoa, editável em Configurações (D10).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('e1300000-0000-0000-0000-00000000000b', 'conf@cargos.local'), ('e1300000-0000-0000-0000-00000000000c', 'sem@cargos.local');
insert into public.usuarios (id, nome, email, papel) values
  ('e1300000-0000-0000-0000-00000000000b', 'Conf Cargos', 'conf@cargos.local', 'atendente'),
  ('e1300000-0000-0000-0000-00000000000c', 'Sem Cargos', 'sem@cargos.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim' where modulo = 'configuracoes' and usuario_id = 'e1300000-0000-0000-0000-00000000000b';

select has_column('public', 'configuracoes', 'cargos', 'coluna cargos');
select is((select cargos from public.configuracoes where id = 1), array['Auxiliar', 'Analista', 'Coordenador', 'Sócio'], 'começa com os quatro de sempre');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e1300000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set cargos = array['Auxiliar', 'Estagiário'] where id = 1 $$, 'Configurações: Sim muda a lista');
select throws_ok($$ update public.configuracoes set cargos = array['Auxiliar', ''] where id = 1 $$, '23514', null, 'cargo vazio: recusa');
select throws_ok($$ update public.configuracoes set cargos = array['Analista', 'analista'] where id = 1 $$, '23514', null, 'repetido: recusa');
select throws_ok($$ update public.configuracoes set cargos = (select array_agg('Cargo ' || g) from generate_series(1, 31) g) where id = 1 $$,
  '23514', null, 'mais de 30: recusa');
select throws_ok($$ update public.configuracoes set cargos = array[repeat('a', 61)] where id = 1 $$, '23514', null, 'mais de 60 letras: recusa');
select throws_ok($$ update public.configuracoes set cargos = array[' Sócio'] where id = 1 $$, '23514', null, 'espaço na ponta: recusa');

select set_config('request.jwt.claims', '{"sub":"e1300000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set cargos = array['Outro'] where id = 1 $$, 'sem Configurações: a alteração não acha a linha');
reset role;
select is((select cargos from public.configuracoes where id = 1), array['Auxiliar', 'Estagiário'], 'sem Configurações: nada mudou');

select * from finish();
rollback;
```

Run: `supabase test db --file supabase/tests/36_painel_v2_cargos.test.sql` → Expected: FAIL (`has_column` falso).

- [ ] **Passo 2: escrever a migração**

`supabase/migrations/20261007000200_painel_v2_cargos.sql`:

```sql
-- supabase/migrations/20261007000200_painel_v2_cargos.sql
-- Painel v2, Parte G1 (spec 7C.4 e seção 9): a lista de cargos que a ficha da pessoa sugere passa a ser editável em
-- Configurações › Cargos ("Configurações: Sim", como Setores). Só sugestão: o cargo de quem já tem não muda (D10).

create function public.cargos_validos(p text[]) returns boolean
language sql immutable set search_path = '' as $$
  select p is not null and cardinality(p) <= 30
     and not exists (select 1 from unnest(p) c where c is null or c <> btrim(c) or char_length(c) not between 1 and 60)
     and (select count(distinct lower(c)) from unnest(p) c) = cardinality(p)
$$;

alter table public.configuracoes
  add column cargos text[] not null default '{Auxiliar,Analista,Coordenador,Sócio}' check (public.cargos_validos(cargos));
```

(Como `horario_valido` da Parte D, `cargos_validos` fica executável por todos: a regra do `check` roda com quem altera.)

- [ ] **Passo 3: rodar, regerar os tipos e conferir**

Run: `supabase db reset && supabase test db && pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: `36_painel_v2_cargos` 10/10; `35` 46/46; `22` 100/100; `Result: PASS`; `git diff --stat packages/db/src/tipos.gen.ts` mostra `cargos`, `simular_mudanca_prazo`, `aplicar_prazo_abertas` e `prazos_resumo`; os três typecheck verdes.

- [ ] **Passo 4: commit**

```bash
git add supabase/migrations/20261007000200_painel_v2_cargos.sql supabase/tests/36_painel_v2_cargos.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): lista de cargos em configuracoes; tipos com as funções de prazo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Painel. Regras puras de Configurações

**Files:**
- Create: `apps/painel/src/lib/configuracoes.ts`
- Create: `apps/painel/src/lib/configuracoes.test.ts`

**Interfaces:**
- Consumes: `FUSO` (`lib/formatos.ts`), `ROTULO_PRIORIDADE`, `Prioridade` (`lib/demandas.ts`).
- Produces: `IdSecao`, `GrupoSecao`, `SecaoConfig`, `GRUPOS_CONFIG`, `SECOES_CONFIG`, `secoesDe(admin)`, `secaoDaUrl(valor, admin)`, `secaoDoHash(hash)`, `rotuloDaSecao(id)`, `hrefSecao(id)`, `Resultado`, `textoDiasUteis`, `horaResumo`, `textoDias`, `vencimentoCurto`, `diaCurto`, `hojeSP`, `inicioExemplo`, `nomeModelo`, `DadosResumo`, `ResumoSecao`, `resumosDasSecoes`, `PRIORIDADES`, `COLUNA_PRAZO`, `ColunaPrazo`, `ImpactoPrazo`, `ResumoPrazos`, `textoImpacto`.

- [ ] **Passo 1: escrever o teste que falha**

`apps/painel/src/lib/configuracoes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  diaCurto, horaResumo, hrefSecao, inicioExemplo, nomeModelo, resumosDasSecoes, rotuloDaSecao, secaoDaUrl, secaoDoHash, secoesDe,
  textoDias, textoDiasUteis, textoImpacto, vencimentoCurto, type ImpactoPrazo,
} from './configuracoes';

describe('seções (spec 7C.4, D8, D12)', () => {
  it('quatro grupos; quem não é administrador não vê Teto e modelos de IA nem Integrações', () => {
    expect(secoesDe(true).map((s) => s.id)).toEqual(['expediente', 'prazos', 'feriados', 'mensagens', 'respostas', 'espera', 'ia', 'setores', 'servicos', 'cargos', 'integracoes']);
    expect(secoesDe(false).map((s) => s.id)).not.toContain('ia');
    expect(secoesDe(false).map((s) => s.id)).not.toContain('integracoes');
  });
  it('?secao=: vazia, desconhecida ou proibida → Expediente; âncoras antigas valem', () => {
    expect(secaoDaUrl(undefined, true).id).toBe('expediente');
    expect(secaoDaUrl('xyz', true).id).toBe('expediente');
    expect(secaoDaUrl('ia', false).id).toBe('expediente');
    expect(secaoDaUrl('ia', true).id).toBe('ia');
    expect(secaoDaUrl('teto-ia', true).id).toBe('ia');
    expect(secaoDaUrl(['prazos', 'x'], false).id).toBe('prazos');
  });
  it('hash de link antigo', () => {
    expect(secaoDoHash('#teto-ia')).toBe('ia');
    expect(secaoDoHash('#atendimento')).toBe('espera');
    expect(secaoDoHash('#aviso-login')).toBe('mensagens');
    expect(secaoDoHash('#integracoes')).toBe('integracoes');
    expect(secaoDoHash('#nada')).toBeNull();
    expect(secaoDoHash('')).toBeNull();
  });
  it('rótulo e endereço', () => {
    expect(rotuloDaSecao('prazos')).toBe('Prazos');
    expect(rotuloDaSecao('teto-ia')).toBe('Teto e modelos de IA');
    expect(rotuloDaSecao('zzz')).toBeNull();
    expect(hrefSecao('feriados')).toBe('/configuracoes?secao=feriados');
  });
});

describe('textos', () => {
  it('dias úteis em faixas', () => {
    expect(textoDiasUteis([1, 2, 3, 4, 5])).toBe('seg–sex');
    expect(textoDiasUteis([5, 4, 3, 2, 1, 6])).toBe('seg–sáb');
    expect(textoDiasUteis([1, 3, 5])).toBe('seg, qua, sex');
    expect(textoDiasUteis([1, 2])).toBe('seg, ter');
    expect(textoDiasUteis([])).toBe('nenhum dia');
  });
  it('hora curta e dias', () => {
    expect(horaResumo('08:00:00')).toBe('08');
    expect(horaResumo('18:30')).toBe('18:30');
    expect(textoDias(0)).toBe('mesmo dia (fim do expediente)');
    expect(textoDias(1)).toBe('1 dia útil');
    expect(textoDias(5)).toBe('5 dias úteis');
  });
  it('vencimento e exemplo no horário de Brasília', () => {
    expect(vencimentoCurto('2026-10-02T21:00:00Z')).toBe('sex 02/10 às 18:00');
    expect(diaCurto('2026-10-06T21:00:00Z')).toBe('ter 06/10');
    expect(inicioExemplo(new Date('2026-10-03T02:30:00Z'))).toBe('2026-10-02T13:00:00.000Z');
  });
  it('nome do modelo', () => {
    expect(nomeModelo('claude-sonnet-5')).toBe('Claude Sonnet 5');
    expect(nomeModelo('claude-haiku-4-5')).toBe('Claude Haiku 4.5');
    expect(nomeModelo('outro')).toBe('outro');
  });
});

describe('resumosDasSecoes (menu, imagem A + resumos da B)', () => {
  const base = {
    cfg: {
      horario_inicio: '08:00:00', horario_fim: '18:00:00', dias_uteis: [1, 2, 3, 4, 5], prazo_urgente_dias: 0, prazo_alta_dias: 1,
      prazo_normal_dias: 2, prazo_baixa_dias: 5, espera_verde_min: 5, espera_ambar_min: 15, aviso_login: 'Fechamento até 05/10.',
      teto_ia_usd: 100, cargos: ['Auxiliar', 'Analista'],
    },
    feriados: [{ data: '2026-09-07', descricao: 'Independência' }, { data: '2026-10-12', descricao: 'N. Sra. Aparecida' }],
    respostas: [{ ativo: true }, { ativo: false }, { ativo: true }],
    setores: [{ ativo: true }, { ativo: true }, { ativo: false }],
    servicos: [{ setor_id: 's1' }, { setor_id: null }],
    fracaoTeto: 0.41, integracoesOk: true, hoje: '2026-10-02',
  };
  it('cada seção com contagem e resumo', () => {
    const r = resumosDasSecoes(base);
    expect(r.expediente).toEqual({ resumo: 'seg–sex 08–18' });
    expect(r.prazos.resumo).toBe('urgente mesmo dia · alta 1 · normal 2 · baixa 5');
    expect(r.feriados).toEqual({ contagem: 2, resumo: 'próximo: 12/10' });
    expect(r.mensagens).toEqual({ contagem: 4, resumo: 'aviso do login ligado' });
    expect(r.respostas).toEqual({ contagem: 3, resumo: '2 ativas' });
    expect(r.espera.resumo).toBe('verde até 5 · âmbar até 15 min');
    expect(r.ia).toEqual({ resumo: 'teto US$ 100 · 41%', atencao: false });
    expect(r.setores).toEqual({ contagem: 2, resumo: '2 ativos · 1 inativo' });
    expect(r.servicos).toEqual({ contagem: 2, resumo: '1 sem setor', atencao: true });
    expect(r.cargos).toEqual({ contagem: 2, resumo: 'Auxiliar, Analista' });
    expect(r.integracoes).toEqual({ resumo: 'ok', atencao: false });
  });
  it('sem feriado à frente, aviso vazio, teto perto, quem não é administrador', () => {
    const r = resumosDasSecoes({ ...base, cfg: { ...base.cfg, aviso_login: ' ' }, hoje: '2026-12-01', fracaoTeto: null, integracoesOk: null });
    expect(r.feriados.resumo).toBe('nenhum à frente');
    expect(r.mensagens.resumo).toBe('aviso do login desligado');
    expect(r.ia).toEqual({ resumo: 'teto US$ 100', atencao: false });
    expect(r.integracoes.resumo).toBe('');
    expect(resumosDasSecoes({ ...base, fracaoTeto: 0.85 }).ia.atencao).toBe(true);
  });
});

describe('textoImpacto (janela de Prazos, D6)', () => {
  const i: ImpactoPrazo = {
    prioridade: 'normal', dias_atuais: 2, dias_novos: 3, abertas: 14, pela_regra: 11, a_mao: 3, sem_prazo: 0,
    ganham: 9, perdem: 0, pausadas: 2, passam_a_vencidas: 0, ja_vencidas: 1,
  };
  it('aumentar: quantas ganham, à mão e pausadas; nenhuma fica vencida', () => {
    expect(textoImpacto(i)).toEqual({
      titulo: 'Normal: de 2 dias úteis para 3 dias úteis',
      linhas: ['14 demandas Normais abertas', '9 ganham 1 dia útil', '3 com prazo escolhido à mão ficam como estão',
        '2 com o cliente continuam pausadas', 'Nenhuma fica vencida.'],
      alerta: null, recalcula: 9,
    });
  });
  it('diminuir com vencidas: aviso (vermelho na tela)', () => {
    const t = textoImpacto({ ...i, prioridade: 'urgente', dias_atuais: 2, dias_novos: 0, abertas: 1, a_mao: 0, pausadas: 0, ganham: 0, perdem: 1, passam_a_vencidas: 1 });
    expect(t.titulo).toBe('Urgente: de 2 dias úteis para mesmo dia (fim do expediente)');
    expect(t.linhas).toEqual(['1 demanda Urgente aberta', '1 perde 2 dias úteis']);
    expect(t.alerta).toBe('1 passaria a vencida na hora.');
    expect(t.recalcula).toBe(1);
  });
});
```

Run: `pnpm --filter @escritorio/painel test -- src/lib/configuracoes.test.ts` → Expected: FAIL (módulo não existe).

- [ ] **Passo 2: implementar `lib/configuracoes.ts`**

```ts
// Configurações (spec 7C.4): seções em grupos, o resumo de cada uma no menu, o exemplo de vencimento e o texto da janela de
// impacto de Prazos. Tudo puro; a página e os componentes só desenham.
import { ROTULO_PRIORIDADE, type Prioridade } from './demandas';
import { FUSO } from './formatos';

export type IdSecao = 'expediente' | 'prazos' | 'feriados' | 'mensagens' | 'respostas' | 'espera' | 'ia' | 'setores' | 'servicos' | 'cargos' | 'integracoes';
export type GrupoSecao = 'Escritório' | 'Agente e atendimento' | 'Cadastros' | 'Sistema';
export type SecaoConfig = { id: IdSecao; rotulo: string; grupo: GrupoSecao; soAdmin: boolean };

export const GRUPOS_CONFIG: GrupoSecao[] = ['Escritório', 'Agente e atendimento', 'Cadastros', 'Sistema'];

// D8: o que é só do administrador fica em seção própria (teto, modelos e cotação; integrações).
export const SECOES_CONFIG: SecaoConfig[] = [
  { id: 'expediente', rotulo: 'Expediente', grupo: 'Escritório', soAdmin: false },
  { id: 'prazos', rotulo: 'Prazos', grupo: 'Escritório', soAdmin: false },
  { id: 'feriados', rotulo: 'Feriados', grupo: 'Escritório', soAdmin: false },
  { id: 'mensagens', rotulo: 'Mensagens', grupo: 'Agente e atendimento', soAdmin: false },
  { id: 'respostas', rotulo: 'Respostas prontas', grupo: 'Agente e atendimento', soAdmin: false },
  { id: 'espera', rotulo: 'Limites de espera', grupo: 'Agente e atendimento', soAdmin: false },
  { id: 'ia', rotulo: 'Teto e modelos de IA', grupo: 'Agente e atendimento', soAdmin: true },
  { id: 'setores', rotulo: 'Setores', grupo: 'Cadastros', soAdmin: false },
  { id: 'servicos', rotulo: 'Serviços', grupo: 'Cadastros', soAdmin: false },
  { id: 'cargos', rotulo: 'Cargos', grupo: 'Cadastros', soAdmin: false },
  { id: 'integracoes', rotulo: 'Integrações', grupo: 'Sistema', soAdmin: true },
];

/** Âncoras da página longa de antes (#teto-ia, #atendimento…) → seção de hoje. */
const ANCORAS_ANTIGAS: Record<string, IdSecao> = { 'teto-ia': 'ia', atendimento: 'espera', 'aviso-login': 'mensagens' };
const idCerto = (v: string): string => ANCORAS_ANTIGAS[v] ?? v;

export const secoesDe = (admin: boolean): SecaoConfig[] => SECOES_CONFIG.filter((s) => admin || !s.soAdmin);

/** ?secao= da URL: vazia, desconhecida ou só do administrador para quem não é → Expediente (D12). */
export function secaoDaUrl(valor: string | string[] | undefined, admin: boolean): SecaoConfig {
  const v = Array.isArray(valor) ? valor[0] : valor;
  const id = v ? idCerto(v) : undefined;
  return secoesDe(admin).find((s) => s.id === id) ?? SECOES_CONFIG[0]!;
}

/** "#teto-ia" (link antigo) → "ia"; null quando não é seção. */
export function secaoDoHash(hash: string): IdSecao | null {
  const v = decodeURIComponent(hash.replace(/^#/, ''));
  if (!v) return null;
  const id = idCerto(v);
  return SECOES_CONFIG.some((s) => s.id === id) ? (id as IdSecao) : null;
}

export const rotuloDaSecao = (v: string): string | null => SECOES_CONFIG.find((s) => s.id === idCerto(v))?.rotulo ?? null;
export const hrefSecao = (id: IdSecao): string => `/configuracoes?secao=${id}`;

/** Resposta das ações de Configurações: o cartão avisa sem recarregar a página (D21). */
export type Resultado = { ok: true; mensagem: string } | { ok: false; erro: string };

// ---------- Textos ----------

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** [1,2,3,4,5] → "seg–sex"; [1,3,5] → "seg, qua, sex". Três dias seguidos ou mais viram faixa. */
export function textoDiasUteis(dias: number[]): string {
  const d = [...new Set(dias)].filter((n) => n >= 0 && n <= 6).sort((a, b) => a - b);
  if (d.length === 0) return 'nenhum dia';
  const partes: string[] = [];
  for (let i = 0; i < d.length;) {
    let j = i;
    while (j + 1 < d.length && d[j + 1] === d[j]! + 1) j++;
    partes.push(j - i >= 2 ? `${DIAS_CURTOS[d[i]!]}–${DIAS_CURTOS[d[j]!]}` : d.slice(i, j + 1).map((n) => DIAS_CURTOS[n]).join(', '));
    i = j + 1;
  }
  return partes.join(', ');
}

/** "08:00" ou "08:00:00" → "08"; "18:30" → "18:30". */
export function horaResumo(h: string): string {
  const [hh = '00', mm = '00'] = h.split(':');
  return mm === '00' ? hh : `${hh}:${mm}`;
}

/** 0 → "mesmo dia (fim do expediente)"; 1 → "1 dia útil"; n → "n dias úteis". */
export const textoDias = (n: number): string => (n === 0 ? 'mesmo dia (fim do expediente)' : pl(n, 'dia útil', 'dias úteis'));

const DIA_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const SEMANA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short' });
const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DIA_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const semana = (d: Date) => SEMANA.format(d).replace('.', '');

/** "ter 06/10" (Brasília). */
export const diaCurto = (iso: string): string => { const d = new Date(iso); return `${semana(d)} ${DIA_MES.format(d)}`; };
/** "sex 02/10 às 18:00" (Brasília). */
export const vencimentoCurto = (iso: string): string => { const d = new Date(iso); return `${diaCurto(iso)} às ${HORA.format(d)}`; };
/** Hoje em Brasília, AAAA-MM-DD. */
export const hojeSP = (agora: Date): string => DIA_ISO.format(agora);
/** O exemplo da imagem: "aberta hoje às 10:00" de Brasília, mesmo no fim de semana (D17). */
export const inicioExemplo = (agora: Date): string => new Date(`${hojeSP(agora)}T10:00:00-03:00`).toISOString();

/** "claude-haiku-4-5" → "Claude Haiku 4.5" (só para mostrar; o valor gravado é o id). */
export function nomeModelo(id: string): string {
  if (!id.startsWith('claude-')) return id;
  return id.replace(/-(\d+)-(\d+)$/, ' $1.$2').split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// ---------- Resumos do menu ----------

export type DadosResumo = {
  cfg: {
    horario_inicio: string; horario_fim: string; dias_uteis: number[];
    prazo_urgente_dias: number; prazo_alta_dias: number; prazo_normal_dias: number; prazo_baixa_dias: number;
    espera_verde_min: number; espera_ambar_min: number; aviso_login: string; teto_ia_usd: number; cargos: string[];
  };
  feriados: { data: string }[];
  respostas: { ativo: boolean }[];
  setores: { ativo: boolean }[];
  servicos: { setor_id: string | null }[];
  /** Gasto do mês ÷ teto; null para quem não é administrador. */
  fracaoTeto: number | null;
  /** Sinal de vida do WhatsApp e da fila; null para quem não é administrador. */
  integracoesOk: boolean | null;
  /** AAAA-MM-DD de Brasília. */
  hoje: string;
};
export type ResumoSecao = { contagem?: number; resumo: string; atencao?: boolean };

const curto = (n: number) => (n === 0 ? 'mesmo dia' : String(n));
const usd = (v: number) => `US$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)}`;

export function resumosDasSecoes(d: DadosResumo): Record<IdSecao, ResumoSecao> {
  const c = d.cfg;
  const proximo = d.feriados.map((f) => f.data).filter((x) => x >= d.hoje).sort()[0];
  const ativos = d.setores.filter((s) => s.ativo).length;
  const inativos = d.setores.length - ativos;
  const semSetor = d.servicos.filter((s) => !s.setor_id).length;
  const teto = `teto ${usd(Number(c.teto_ia_usd))}`;
  return {
    expediente: { resumo: `${textoDiasUteis(c.dias_uteis)} ${horaResumo(c.horario_inicio)}–${horaResumo(c.horario_fim)}` },
    prazos: { resumo: `urgente ${curto(c.prazo_urgente_dias)} · alta ${curto(c.prazo_alta_dias)} · normal ${curto(c.prazo_normal_dias)} · baixa ${curto(c.prazo_baixa_dias)}` },
    feriados: { contagem: d.feriados.length, resumo: proximo ? `próximo: ${proximo.slice(8, 10)}/${proximo.slice(5, 7)}` : 'nenhum à frente' },
    mensagens: { contagem: 4, resumo: c.aviso_login.trim() ? 'aviso do login ligado' : 'aviso do login desligado' },
    respostas: { contagem: d.respostas.length, resumo: pl(d.respostas.filter((r) => r.ativo).length, 'ativa', 'ativas') },
    espera: { resumo: `verde até ${c.espera_verde_min} · âmbar até ${c.espera_ambar_min} min` },
    ia: { resumo: d.fracaoTeto === null ? teto : `${teto} · ${Math.round(d.fracaoTeto * 100)}%`, atencao: (d.fracaoTeto ?? 0) >= 0.8 },
    setores: { contagem: ativos, resumo: inativos ? `${pl(ativos, 'ativo', 'ativos')} · ${pl(inativos, 'inativo', 'inativos')}` : pl(ativos, 'ativo', 'ativos') },
    servicos: semSetor
      ? { contagem: d.servicos.length, resumo: `${semSetor} sem setor`, atencao: true }
      : { contagem: d.servicos.length, resumo: 'todos com setor' },
    cargos: { contagem: c.cargos.length, resumo: c.cargos.join(', ') || 'nenhum' },
    integracoes: { resumo: d.integracoesOk === null ? '' : d.integracoesOk ? 'ok' : 'sem sinal', atencao: d.integracoesOk === false },
  };
}

// ---------- Prazos ----------

export const PRIORIDADES: Prioridade[] = ['urgente', 'alta', 'normal', 'baixa'];
export const COLUNA_PRAZO = {
  urgente: 'prazo_urgente_dias', alta: 'prazo_alta_dias', normal: 'prazo_normal_dias', baixa: 'prazo_baixa_dias',
} as const satisfies Record<Prioridade, string>;
export type ColunaPrazo = (typeof COLUNA_PRAZO)[Prioridade];

/** O que simular_mudanca_prazo devolve (Task 1). */
export type ImpactoPrazo = {
  prioridade: Prioridade; dias_atuais: number; dias_novos: number; abertas: number; pela_regra: number; a_mao: number;
  sem_prazo: number; ganham: number; perdem: number; pausadas: number; passam_a_vencidas: number; ja_vencidas: number;
};
/** O que prazos_resumo devolve (Task 1); exemplos[n] = vencimento com n dias úteis (null sem dia útil configurado). */
export type ResumoPrazos = { abertas: Record<Prioridade, number>; exemplos: (string | null)[] };

const PLURAL_PRIORIDADE: Record<Prioridade, string> = { urgente: 'Urgentes', alta: 'Altas', normal: 'Normais', baixa: 'Baixas' };
const verbo = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Texto de uma prioridade na janela de impacto (spec 7C.4: "14 demandas Normais abertas; 9 ganham prazo; nenhuma fica vencida"). */
export function textoImpacto(i: ImpactoPrazo): { titulo: string; linhas: string[]; alerta: string | null; recalcula: number } {
  const nome = ROTULO_PRIORIDADE[i.prioridade];
  const dif = Math.abs(i.dias_novos - i.dias_atuais);
  const dias = pl(dif, 'dia útil', 'dias úteis');
  const linhas = [i.abertas === 1 ? `1 demanda ${nome} aberta` : `${i.abertas} demandas ${PLURAL_PRIORIDADE[i.prioridade]} abertas`];
  if (i.ganham) linhas.push(`${verbo(i.ganham, 'ganha', 'ganham')} ${dias}`);
  if (i.perdem) linhas.push(`${verbo(i.perdem, 'perde', 'perdem')} ${dias}`);
  if (i.a_mao) linhas.push(`${i.a_mao} com prazo escolhido à mão ${i.a_mao === 1 ? 'fica como está' : 'ficam como estão'}`);
  if (i.sem_prazo) linhas.push(`${i.sem_prazo} sem prazo ${i.sem_prazo === 1 ? 'continua' : 'continuam'} sem prazo`);
  if (i.pausadas) linhas.push(`${i.pausadas} com o cliente ${i.pausadas === 1 ? 'continua pausada' : 'continuam pausadas'}`);
  const alerta = i.dias_novos < i.dias_atuais && i.passam_a_vencidas > 0
    ? `${i.passam_a_vencidas} ${i.passam_a_vencidas === 1 ? 'passaria a vencida' : 'passariam a vencidas'} na hora.`
    : null;
  if (!alerta) linhas.push('Nenhuma fica vencida.');
  return { titulo: `${nome}: de ${textoDias(i.dias_atuais)} para ${textoDias(i.dias_novos)}`, linhas, alerta, recalcula: i.ganham + i.perdem };
}
```

(Se `Intl` desta máquina escrever o dia da semana diferente de "sex." — o teste `vencimentoCurto` mostra —, ajuste só a função `semana`, nunca o teste.)

- [ ] **Passo 3: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel test -- src/lib/configuracoes.test.ts && pnpm --filter @escritorio/painel typecheck`
Expected: PASS; typecheck verde.

- [ ] **Passo 4: commit**

```bash
git add apps/painel/src/lib/configuracoes.ts apps/painel/src/lib/configuracoes.test.ts
git commit -m "feat(painel): regras de Configurações (seções, resumos, exemplo de vencimento, texto do impacto)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Painel. Formulário: âmbar, "antes", Descartar, contagem e guarda de saída; cartão que salva sozinho

**Files:**
- Modify: `apps/painel/src/components/patterns/formulario-alteravel.tsx`
- Create: `apps/painel/src/components/patterns/formulario-alteravel.test.ts`
- Modify: `apps/painel/src/app/globals.css`
- Create: `apps/painel/src/app/(painel)/configuracoes/formulario-config.tsx`, `cartao.tsx`, `tipos.ts`, `formulario-config.test.ts`

**Interfaces:**
- Consumes: `Resultado` (Task 3), `Button`, `Dialog*`, `toast`, `CardFooter`, `Card*`.
- Produces (em `formulario-alteravel.tsx`, tudo opcional; quem não usa não muda):
  - `FormularioAlteravel` aceita `marcarAlterados?: boolean` (campo alterado ganha `data-alterado`) e `salvarParaSair?: (form) => Promise<boolean>`;
  - `contarAlteracoes(form, escopo?) → number`, `restaurarCampos(form, escopo?)`, `totalDeAlteracoes() → number`, `salvarAlteradosParaSair() → Promise<boolean>`, `descartarAlterados()`, `definirGuardaSaida(fn | null)`;
  - hooks `useAlgumAlterado() → boolean`, `useCampoDoFormulario(nome, inicial) → string`;
  - componentes `Antes({ campo, texto })`, `BotaoDescartar`, `IndicadorAlteracoes({ contar })` ("1 alteração não salva" / "N alterações não salvas" / "Sem alterações").
- Produces (em `configuracoes/`): `FormularioConfig({ acao, rotulo, antesDeEnviar?, limparAoSalvar?, className, children })`, `RodapeConfig({ salvar, aviso? })`, `AcoesLinhaConfig({ salvar?, rotulo?, descartar? })`, `SalvarConfig`, `Cartao({ id, titulo, descricao?, className?, children })`, `type Config`.

- [ ] **Passo 1: escrever os testes que falham**

`apps/painel/src/components/patterns/formulario-alteravel.test.ts`:

```ts
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

// Sem DOM: confere o primeiro desenho (nada alterado). O comportamento com digitação é coberto pelos e2e de Configurações.
(globalThis as { React?: unknown }).React = React;

describe('peças de Configurações no FormularioAlteravel', () => {
  it('Descartar começa desabilitado; contagem diz "Sem alterações"; antes não aparece', async () => {
    const { Antes, BotaoDescartar, FormularioAlteravel, IndicadorAlteracoes } = await import('./formulario-alteravel');
    const html = renderToStaticMarkup(React.createElement(FormularioAlteravel, { marcarAlterados: true },
      React.createElement(IndicadorAlteracoes, { contar: true }),
      React.createElement(Antes, { campo: 'x', texto: '18:00' }),
      React.createElement(BotaoDescartar, null)));
    expect(html).toContain('Sem alterações');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Descartar<\/button>/);
    expect(html).not.toContain('antes:');
    // marcarAlterados e salvarParaSair não vão para o HTML do formulário.
    expect(html).not.toContain('marcarAlterados');
    expect(html).not.toContain('marcaralterados');
  });
  it('sem contar: o indicador de sempre (Parte D), escondido', async () => {
    const { FormularioAlteravel, IndicadorAlteracoes } = await import('./formulario-alteravel');
    const html = renderToStaticMarkup(React.createElement(FormularioAlteravel, null, React.createElement(IndicadorAlteracoes, null)));
    expect(html).toContain('sr-only');
    expect(html).not.toContain('Sem alterações');
  });
});
```

`apps/painel/src/app/(painel)/configuracoes/formulario-config.test.ts`:

```ts
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

(globalThis as { React?: unknown }).React = React;

describe('FormularioConfig', () => {
  it('formulário com nome, rodapé com contagem, Descartar e o Salvar do cartão', async () => {
    const { FormularioConfig, RodapeConfig } = await import('./formulario-config');
    const html = renderToStaticMarkup(React.createElement(FormularioConfig, { acao: async () => ({ ok: true as const, mensagem: 'ok' }), rotulo: 'Expediente' },
      React.createElement(RodapeConfig, { salvar: 'Salvar expediente', aviso: 'Usado no cálculo dos prazos.' })));
    expect(html).toContain('aria-label="Expediente"');
    expect(html).toContain('Sem alterações');
    expect(html).toContain('Descartar');
    expect(html).toContain('Salvar expediente');
    expect(html).toContain('Usado no cálculo dos prazos.');
    expect(html).not.toContain('role="alert"');
  });
});
```

Run: `pnpm --filter @escritorio/painel test -- formulario` → Expected: FAIL (`Antes`, `BotaoDescartar`, `formulario-config` não existem).

- [ ] **Passo 2: `formulario-alteravel.tsx`**

Mantenha tudo o que existe (comportamento de hoje para quem não usa nada novo) e faça estas mudanças:

1. Imports: `Pencil` do lucide; `useContext` já existe.
2. Contexto ganha `conferir`:

```tsx
type Contexto = { form: RefObject<HTMLFormElement | null>; versao: number; conferir: () => void };
```

3. Troque o `Set` de montados por um `Map` com o "salvar para sair", acrescente o aviso de mudança, a contagem, o restaurar e a guarda (logo depois de `formularioAlterado`):

```tsx
/** Algum formulário montado mudou de estado: o menu de Configurações mostra "não salvo". */
const EVENTO_ALTERADOS = 'formularios-alterados';
const avisarMudanca = () => window.dispatchEvent(new Event(EVENTO_ALTERADOS));

type Montado = { salvarParaSair: () => Promise<boolean> };
/** Formulários alteráveis montados na página: um único par de ouvintes cuida de todos (uma pergunta só). */
const montados = new Map<HTMLFormElement, Montado>();
const algumAlterado = () => [...montados.keys()].some((f) => f.isConnected && formularioAlterado(f));

/** Quantos campos (pelo nome) mudaram: as caixas "dia" do expediente contam como uma alteração. */
export function contarAlteracoes(form: HTMLFormElement, escopo?: Element | null): number {
  const nomes = new Set<string>();
  [...form.elements].forEach((el, i) => {
    if ((!escopo || escopo.contains(el)) && campoAlterado(el)) nomes.add((el as HTMLInputElement).name || el.id || `#${i}`);
  });
  return nomes.size;
}

/** Volta os campos nativos (do escopo, se dado) ao valor que veio do servidor e avisa o formulário. Switch do Radix não volta. */
export function restaurarCampos(form: HTMLFormElement, escopo?: Element | null) {
  for (const el of form.elements) {
    if (escopo && !escopo.contains(el)) continue;
    if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = el.defaultChecked;
      else if (!['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(el.type)) el.value = el.defaultValue;
      el.setCustomValidity('');
    } else if (el instanceof HTMLTextAreaElement) {
      el.value = el.defaultValue;
    } else if (el instanceof HTMLSelectElement) {
      for (const o of el.options) o.selected = o.defaultSelected;
      if (!el.multiple && ![...el.options].some((o) => o.defaultSelected) && el.options.length > 0) el.selectedIndex = 0;
    }
  }
  form.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Janela própria para sair com alteração (Configurações, D14). Sem ela, vale o confirm do navegador de sempre. */
type GuardaSaida = (destino: string) => void;
let guarda: GuardaSaida | null = null;
export function definirGuardaSaida(g: GuardaSaida | null) {
  guarda = g;
}

/** Soma das alterações de todos os formulários montados (texto da janela de saída). */
export const totalDeAlteracoes = () => [...montados.keys()].filter((f) => f.isConnected).reduce((n, f) => n + contarAlteracoes(f), 0);

/** "Salvar e sair": salva, um por vez, cada formulário alterado; para no primeiro que não salvar. */
export async function salvarAlteradosParaSair(): Promise<boolean> {
  for (const [f, m] of montados) {
    if (!f.isConnected || !formularioAlterado(f)) continue;
    if (!(await m.salvarParaSair())) return false;
  }
  return true;
}

/** "Descartar" da janela de saída: tudo volta ao valor salvo. */
export function descartarAlterados() {
  for (const f of montados.keys()) if (f.isConnected && formularioAlterado(f)) restaurarCampos(f);
  avisarMudanca();
}

/** O menu acompanha se há alteração pendente na página. */
export function useAlgumAlterado(): boolean {
  const [alterado, setAlterado] = useState(false);
  useEffect(() => {
    const ver = () => setAlterado(algumAlterado());
    ver();
    window.addEventListener(EVENTO_ALTERADOS, ver);
    return () => window.removeEventListener(EVENTO_ALTERADOS, ver);
  }, []);
  return alterado;
}

/** Ação do servidor chamada direto (sem o <form>): falha se lançar ou devolver { ok: false }. */
async function salvarPelaAction(f: HTMLFormElement, action: (d: FormData) => unknown): Promise<boolean> {
  if (!f.reportValidity()) return false;
  try {
    const r = await action(new FormData(f));
    return !(r && typeof r === 'object' && 'ok' in r && (r as { ok: unknown }).ok === false);
  } catch {
    return false;
  }
}
```

4. Em `aoClicarLink`, depois de `if (!algumAlterado()) return;`:

```tsx
  if (guarda) {
    e.preventDefault();
    e.stopPropagation();
    guarda(`${destino.pathname}${destino.search}${destino.hash}`);
    return;
  }
```

5. `registrar` passa a receber o `Montado` e avisa ao sair:

```tsx
function registrar(f: HTMLFormElement, m: Montado): () => void {
  if (montados.size === 0) {
    window.addEventListener('beforeunload', aoDescarregar);
    document.addEventListener('click', aoClicarLink, true);
  }
  montados.set(f, m);
  return () => {
    montados.delete(f);
    if (montados.size === 0) {
      window.removeEventListener('beforeunload', aoDescarregar);
      document.removeEventListener('click', aoClicarLink, true);
    }
    avisarMudanca();
  };
}
```

6. `FormularioAlteravel`:

```tsx
export function FormularioAlteravel({
  className, children, onInput, onChange, onClick, onReset, marcarAlterados = false, salvarParaSair, ...props
}: ComponentProps<'form'> & {
  /** Campo alterado ganha data-alterado (âmbar pelo CSS global; Configurações). */
  marcarAlterados?: boolean;
  /** Como salvar este formulário pela janela "Salvar e sair". Sem ele, chama a action, se for função. */
  salvarParaSair?: (form: HTMLFormElement) => Promise<boolean>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [versao, setVersao] = useState(0);
  const conferir = useCallback(() => setVersao((v) => v + 1), []);
  const salvar = useRef<(f: HTMLFormElement) => Promise<boolean>>(async () => false);
  const action = props.action;
  useLayoutEffect(() => {
    salvar.current = salvarParaSair ?? (typeof action === 'function' ? (f) => salvarPelaAction(f, action) : async () => false);
  });

  // Os valores padrão mudam quando a página volta do servidor (render novo): confere de novo.
  useLayoutEffect(() => {
    conferir();
  }, [children, conferir]);

  useEffect(() => {
    const f = form.current;
    if (!f) return;
    return registrar(f, { salvarParaSair: () => salvar.current(f) });
  }, []);

  // Marca os campos alterados (âmbar) e avisa quem acompanha (menu "não salvo").
  useEffect(() => {
    const f = form.current;
    if (!f) return;
    if (marcarAlterados) for (const el of f.elements) el.toggleAttribute('data-alterado', campoAlterado(el));
    avisarMudanca();
  }, [versao, marcarAlterados]);

  return (
    <ContextoFormulario.Provider value={{ form, versao, conferir }}>
      <form
        ref={form}
        className={className}
        onInput={(e) => { conferir(); onInput?.(e); }}
        onChange={(e) => { conferir(); onChange?.(e); }}
        // Switch/Checkbox do Radix mudam o aria-checked no clique.
        onClick={(e) => { setTimeout(conferir, 0); onClick?.(e); }}
        // O React 19 limpa o formulário depois da ação; confere no quadro seguinte, já com os valores novos.
        onReset={(e) => { setTimeout(conferir, 0); onReset?.(e); }}
        {...props}
      >
        {children}
      </form>
    </ContextoFormulario.Provider>
  );
}
```

7. `useAlterado` vira `useContagem` (mesmo corpo, com `contarAlteracoes` no lugar de `formularioAlterado`) e `BotaoSalvar` usa `useContagem(ancora) > 0`:

```tsx
/** Quantos campos do formulário (ou só do escopo onde `ancora` está) têm alteração não salva. */
function useContagem(ancora: RefObject<Element | null>): number {
  const ctx = useContext(ContextoFormulario);
  const [n, setN] = useState(0);
  const versao = ctx?.versao;
  const form = ctx?.form;
  useEffect(() => {
    const f = form?.current;
    const escopo = ancora.current?.closest(`[${ESCOPO_ALTERACOES}]`) ?? null;
    setN(f ? contarAlteracoes(f, escopo && f.contains(escopo) ? escopo : null) : 0);
  }, [versao, form, ancora]);
  return n;
}
```

8. `IndicadorAlteracoes` ganha `contar`:

```tsx
/**
 * "Alterações não salvas" (ponto amarelo + texto) quando algum campo mudou. Dentro de um elemento com
 * `data-escopo-alteracoes`, só os campos desse elemento contam. `compacto`: só "Não salvo" (linhas de uma lista).
 * `contar` (Configurações): "1 alteração não salva" / "N alterações não salvas" num selo, e "Sem alterações" quando nada mudou.
 */
export function IndicadorAlteracoes({ compacto = false, contar = false, className }: { compacto?: boolean; contar?: boolean; className?: string }) {
  const ancora = useRef<HTMLSpanElement>(null);
  const n = useContagem(ancora);
  const alterado = n > 0;
  if (contar) {
    return (
      <span ref={ancora} role="status" className={cn('inline-flex items-center gap-1.5 text-sm', alterado ? 'rounded-md bg-warning-soft px-3 py-1.5 font-semibold text-warning' : 'text-muted', className)}>
        {alterado && <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />}
        {alterado ? (n === 1 ? '1 alteração não salva' : `${n} alterações não salvas`) : 'Sem alterações'}
      </span>
    );
  }
  return (
    <span ref={ancora} role="status" className={cn('inline-flex items-center gap-1.5 text-sm text-warning', compacto && 'text-xs', !alterado && 'sr-only', className)}>
      {alterado && (
        <>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
          {compacto ? 'Não salvo' : 'Alterações não salvas'}
        </>
      )}
    </span>
  );
}
```

9. Novos, no fim do arquivo:

```tsx
/** "antes: X" embaixo de um campo alterado (Configurações, spec 7C.4). `texto`: o valor salvo, já escrito como a pessoa lê. */
export function Antes({ campo, texto, className }: { campo: string; texto: string; className?: string }) {
  const ctx = useContext(ContextoFormulario);
  const [mostrar, setMostrar] = useState(false);
  const versao = ctx?.versao;
  const form = ctx?.form;
  useEffect(() => {
    const f = form?.current;
    setMostrar(Boolean(f && [...f.elements].some((el) => (el as HTMLInputElement).name === campo && campoAlterado(el))));
  }, [versao, form, campo]);
  if (!mostrar) return null;
  return (
    <p className={cn('mt-1 flex items-center gap-1 text-xs font-bold text-warning', className)}>
      <Pencil aria-hidden size={12} strokeWidth={2} />
      antes: {texto}
    </p>
  );
}

/** Volta os campos do cartão (ou do escopo) ao valor salvo. Desabilitado quando nada mudou. */
export function BotaoDescartar({ children = 'Descartar', className, ...props }: Omit<ButtonProps, 'type' | 'onClick' | 'variant'>) {
  const ancora = useRef<HTMLButtonElement>(null);
  const n = useContagem(ancora);
  const ctx = useContext(ContextoFormulario);
  return (
    <Button
      ref={ancora}
      type="button"
      variant="outline"
      disabled={n === 0}
      className={className}
      {...props}
      onClick={() => {
        const f = ctx?.form.current;
        if (!f) return;
        const escopo = ancora.current?.closest(`[${ESCOPO_ALTERACOES}]`) ?? null;
        restaurarCampos(f, escopo && f.contains(escopo) ? escopo : null);
        ctx?.conferir();
      }}
    >
      {children}
    </Button>
  );
}

/** Valor atual de um campo do formulário, acompanhando digitação e Descartar (ex.: exemplo de vencimento em Prazos). */
export function useCampoDoFormulario(nome: string, inicial: string): string {
  const ctx = useContext(ContextoFormulario);
  const [valor, setValor] = useState(inicial);
  const versao = ctx?.versao;
  const form = ctx?.form;
  useEffect(() => {
    const el = form?.current?.elements.namedItem(nome);
    if (el && 'value' in el) setValor(String((el as HTMLInputElement).value));
  }, [versao, form, nome]);
  return valor;
}
```

(`useAlterado` some; confira com `grep -n "useAlterado" apps/painel/src -r` que só este arquivo usava.)

- [ ] **Passo 3: âmbar no CSS global**

Em `apps/painel/src/app/globals.css`, no fim:

```css
/* Configurações (spec 7C.4): campo alterado e ainda não salvo fica âmbar; o "antes: X" vem junto, em texto (nunca só cor). */
:is(input, textarea, select)[data-alterado]:not([type='checkbox'], [type='radio']) {
  border-color: var(--warning-decor);
  background-color: var(--warning-soft);
}
label:has(> input[type='checkbox'][data-alterado]) {
  border-color: var(--warning-decor);
  box-shadow: 0 0 0 1px var(--warning-decor);
}
```

- [ ] **Passo 4: `configuracoes/tipos.ts`, `cartao.tsx` e `formulario-config.tsx`**

`tipos.ts`:

```ts
import type { Database } from '@escritorio/db';

/** A linha única de configuracoes (id = 1). */
export type Config = Database['public']['Tables']['configuracoes']['Row'];
```

`cartao.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/cn';

/** Cartão de Configurações: região com nome (leitor de tela e testes acham pelo título), descrição e conteúdo. */
export function Cartao({ id, titulo, descricao, className, children }: { id: string; titulo: string; descricao?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card id={id} role="region" aria-labelledby={`${id}-titulo`} className={cn('ancora-abaixo-cabecalho', className)}>
      <CardHeader>
        <CardTitle id={`${id}-titulo`}>{titulo}</CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      {children}
    </Card>
  );
}
```

`formulario-config.tsx`:

```tsx
'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { BotaoDescartar, BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import type { ButtonProps } from '@/components/ui/button';
import { CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import type { Resultado } from '@/lib/configuracoes';

type Estado = { enviando: boolean; erro: string | null };
const ContextoConfig = createContext<Estado>({ enviando: false, erro: null });

/**
 * Formulário de um cartão de Configurações (spec 7C.4, D21): envia pela ação do servidor sem recarregar a página, avisa o
 * resultado, mantém o que foi digitado se der erro (onSubmit, não <form action>, que o React 19 limpa) e sabe "salvar para
 * sair" (janela de saída). Campo alterado fica âmbar.
 */
export function FormularioConfig({ acao, rotulo, antesDeEnviar, limparAoSalvar = false, className, children }: {
  acao: (dados: FormData) => Promise<Resultado>;
  /** Nome do formulário para o leitor de tela (ex.: "Expediente", "Setor Fiscal"). */
  rotulo: string;
  /** Prazos: mostra o impacto e decide (false cancela; pode acrescentar campos, como aplicar=sim). */
  antesDeEnviar?: (dados: FormData) => Promise<boolean>;
  /** Formulário de criar (novo setor, nova resposta): volta vazio depois de salvar. */
  limparAoSalvar?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>({ enviando: false, erro: null });
  const emAndamento = useRef(false);
  const enviar = useCallback(async (form: HTMLFormElement): Promise<boolean> => {
    if (emAndamento.current || !form.reportValidity()) return false;
    emAndamento.current = true;
    setEstado({ enviando: true, erro: null });
    try {
      const dados = new FormData(form);
      if (antesDeEnviar && !(await antesDeEnviar(dados))) {
        setEstado({ enviando: false, erro: null });
        return false;
      }
      const r = await acao(dados);
      setEstado({ enviando: false, erro: r.ok ? null : r.erro });
      if (!r.ok) {
        toast.error(r.erro);
        return false;
      }
      toast.success(r.mensagem);
      if (limparAoSalvar) {
        form.reset();
        form.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    } catch {
      const erro = 'Não consegui salvar. Tente de novo.';
      setEstado({ enviando: false, erro });
      toast.error(erro);
      return false;
    } finally {
      emAndamento.current = false;
    }
  }, [acao, antesDeEnviar, limparAoSalvar]);

  return (
    <ContextoConfig.Provider value={estado}>
      <FormularioAlteravel
        marcarAlterados
        aria-label={rotulo}
        className={className}
        onSubmit={(e) => { e.preventDefault(); void enviar(e.currentTarget); }}
        salvarParaSair={enviar}
      >
        {children}
      </FormularioAlteravel>
    </ContextoConfig.Provider>
  );
}

/** Erro do último envio deste cartão (o aviso some ao salvar). */
function ErroConfig() {
  const { erro } = useContext(ContextoConfig);
  return erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null;
}

/** Botão de salvar do cartão, girando enquanto envia. */
export function SalvarConfig({ children, ...props }: Omit<ButtonProps, 'type' | 'variant'> & { destacar?: boolean }) {
  const { enviando } = useContext(ContextoConfig);
  return <BotaoSalvar size="sm" enviando={enviando} {...props}>{children}</BotaoSalvar>;
}

/** Rodapé do cartão (imagem A): aviso à esquerda, "N alterações não salvas", DESCARTAR e o Salvar do cartão. */
export function RodapeConfig({ salvar = 'Salvar', aviso }: { salvar?: string; aviso?: ReactNode }) {
  return (
    <CardFooter className="flex-wrap items-center justify-end gap-3 border-t border-border">
      {aviso && <p className="mr-auto text-sm text-muted">{aviso}</p>}
      <ErroConfig />
      <IndicadorAlteracoes contar />
      <BotaoDescartar size="sm" />
      <SalvarConfig>{salvar}</SalvarConfig>
    </CardFooter>
  );
}

/** Linha de lista (setor, serviço, resposta pronta): "Não salvo", erro e os dois botões, compactos. */
export function AcoesLinhaConfig({ salvar = 'Salvar', rotulo, descartar }: { salvar?: string; rotulo?: string; descartar?: string }) {
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <ErroConfig />
      <IndicadorAlteracoes compacto />
      <BotaoDescartar size="sm" aria-label={descartar} />
      <SalvarConfig destacar aria-label={rotulo}>{salvar}</SalvarConfig>
    </div>
  );
}
```

- [ ] **Passo 5: rodar**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/usuarios-erros.spec.ts e2e/usuarios-ficha.spec.ts e2e/treinar-agente.spec.ts e2e/testar-agente.spec.ts`
Expected: os testes novos passam; `botao-salvar.test.ts` continua passando; os e2e que usam "Alterações não salvas" e o `confirm` ao sair continuam verdes (nada mudou para eles).

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/components/patterns/formulario-alteravel.tsx apps/painel/src/components/patterns/formulario-alteravel.test.ts apps/painel/src/app/globals.css "apps/painel/src/app/(painel)/configuracoes/formulario-config.tsx" "apps/painel/src/app/(painel)/configuracoes/formulario-config.test.ts" "apps/painel/src/app/(painel)/configuracoes/cartao.tsx" "apps/painel/src/app/(painel)/configuracoes/tipos.ts"
git commit -m "feat(painel): formulário com campo âmbar, antes, descartar, contagem e guarda de saída opcional; cartão de Configurações que salva sozinho

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Painel. Escritório: Expediente, Feriados e Prazos (tabela, exemplo, abertas)

**Files:**
- Modify: `apps/painel/src/app/(painel)/configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx,horario-expediente.tsx}`
- Create: `apps/painel/src/app/(painel)/configuracoes/secoes/{expediente,feriados,prazos,prazos-tabela}.tsx`
- Create: `apps/painel/e2e/apoio-configuracoes.ts`, `apps/painel/e2e/configuracoes-escritorio.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 3 e 4; `prazos_resumo`; `PrioridadeTexto` (`components/patterns/prioridade-prazo.tsx`); `ConfirmDialog`, `EmptyState`.
- Produces: ações `salvarExpediente(fd) → Resultado`, `adicionarFeriado(fd) → Resultado`, `salvarPrazos(fd) → Resultado` (nesta task só "para as novas"); esquema `FeriadoForm`; componentes `SecaoExpediente({ cfg })`, `SecaoFeriados({ feriados, hoje })`, `SecaoPrazos({ cfg, feriados, hoje, admin, agora })`, `TabelaPrazos`; e2e `abrirSecao(page, id)`.

- [ ] **Passo 1: esquemas — teste que falha**

Em `esquemas.test.ts`, acrescente:

```ts
describe('FeriadoForm (Parte G1)', () => {
  it('data e descrição aparada', () => {
    expect(FeriadoForm.parse({ data: '2026-12-24', descricao: '  Véspera ' })).toEqual({ data: '2026-12-24', descricao: 'Véspera' });
  });
  it('sem data ou sem nome: recusa com a frase da tela', () => {
    expect(FeriadoForm.safeParse({ data: '', descricao: 'X' }).error?.issues[0]?.message).toBe('Escolha a data do feriado.');
    expect(FeriadoForm.safeParse({ data: '2026-12-24', descricao: ' ' }).error?.issues[0]?.message).toBe('Escreva o nome do feriado.');
  });
});
describe('ExpedienteForm (Parte G1): mensagens em português', () => {
  it('horário vazio', () => {
    const f = new FormData();
    f.set('horario_inicio', ''); f.set('horario_fim', '18:00');
    expect(ExpedienteForm.safeParse(f).error?.issues[0]?.message).toBe('Informe o horário (hh:mm).');
  });
});
```

(e acrescente `FeriadoForm` ao import do topo.) Run: `pnpm --filter @escritorio/painel test -- esquemas` → FAIL.

- [ ] **Passo 2: esquemas e ações**

`esquemas.ts`: nas duas `regex` do `ExpedienteForm`, a mensagem `'Informe o horário (hh:mm).'`; e:

```ts
/** Feriado novo (Configurações: Sim). */
export const FeriadoForm = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Escolha a data do feriado.'),
  descricao: z.string().trim().min(1, 'Escreva o nome do feriado.').max(80, 'Até 80 letras.'),
});
```

`acoes.ts`: no topo, depois dos imports (acrescente `import type { z } from 'zod';`, `import { COLUNA_PRAZO, PRIORIDADES, type Resultado } from '@/lib/configuracoes';` e `FeriadoForm` ao import de `./esquemas`):

```ts
// Respostas dos cartões (D21): nada de redirect com ?erro=; o cartão mostra o erro e mantém o que foi digitado.
const ok = (mensagem: string): Resultado => ({ ok: true, mensagem });
const falha = (erro: string): Resultado => ({ ok: false, erro });
const doBanco = (e: { message: string }): Resultado => falha(mensagemDoBanco(e.message));
const primeiroErro = (e: z.ZodError): Resultado => falha(e.issues[0]?.message ?? 'Confira os campos.');
const lerPrazos = (f: FormData) => Object.fromEntries(PRIORIDADES.map((p) => [COLUNA_PRAZO[p], String(f.get(COLUNA_PRAZO[p]) ?? '')]));
```

Troque `salvarExpediente`, `adicionarFeriado` e `salvarPrazos`:

```ts
export async function salvarExpediente(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = ExpedienteForm.safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Expediente salvo.');
}

export async function adicionarFeriado(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = FeriadoForm.safeParse({ data: String(formData.get('data') ?? ''), descricao: String(formData.get('descricao') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('feriados').upsert(v.data);
  if (error) return doBanco(error);
  recarregar();
  return ok('Feriado adicionado.');
}

/** Prazos por prioridade, só para as demandas novas (a janela de impacto entra na Task 6). */
export async function salvarPrazos(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = PrazosForm.safeParse(lerPrazos(formData));
  if (!v.success) return falha('Cada prazo vai de 0 a 30 dias úteis.');
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Prazos salvos. Valem para as demandas novas.');
}
```

(`import { redirect }` continua enquanto `salvarAvisoLogin` o usar; sai na Task 7.)

- [ ] **Passo 3: `horario-expediente.tsx` aceita o "antes"**

Acrescente às props `antesInicio?: ReactNode; antesFim?: ReactNode` (import `type ReactNode`) e, embaixo de cada `<Input>` (dentro da mesma `div flex-col`), `{antesInicio}` e `{antesFim}`.

- [ ] **Passo 4: `secoes/expediente.tsx`**

```tsx
import { Antes } from '@/components/patterns/formulario-alteravel';
import { CardContent } from '@/components/ui/card';
import { horaResumo, textoDiasUteis } from '@/lib/configuracoes';
import { classeCaixa } from '../../clientes/estilos';
import { salvarExpediente } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import { HorarioExpediente } from '../horario-expediente';
import type { Config } from '../tipos';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_EXTENSO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/** Expediente (Configurações: Sim). Separado do teto de IA desde a Parte D (pendência 17). */
export function SecaoExpediente({ cfg }: { cfg: Pick<Config, 'horario_inicio' | 'horario_fim' | 'dias_uteis'> }) {
  const inicio = cfg.horario_inicio.slice(0, 5);
  const fim = cfg.horario_fim.slice(0, 5);
  return (
    <FormularioConfig acao={salvarExpediente} rotulo="Expediente">
      <Cartao id="expediente" titulo="Expediente" descricao="Horário e dias em que o escritório atende. Os feriados cadastrados contam como fora do expediente.">
        <CardContent className="flex flex-col gap-4">
          <HorarioExpediente
            inicio={inicio}
            fim={fim}
            antesInicio={<Antes campo="horario_inicio" texto={inicio} />}
            antesFim={<Antes campo="horario_fim" texto={fim} />}
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Dias úteis</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d, i) => (
                <label
                  key={d}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-base text-foreground has-checked:border-brand has-checked:bg-brand-soft"
                >
                  <input type="checkbox" name="dia" value={i} defaultChecked={cfg.dias_uteis.includes(i)} aria-label={DIAS_EXTENSO[i]} className={classeCaixa} />
                  <span aria-hidden>{d}</span>
                </label>
              ))}
            </div>
            <Antes campo="dia" texto={textoDiasUteis(cfg.dias_uteis)} />
          </fieldset>
        </CardContent>
        <RodapeConfig salvar="Salvar expediente" aviso={'Usado pelo agente ("fora do horário") e no cálculo dos prazos das demandas.'} />
      </Cartao>
    </FormularioConfig>
  );
}
```

- [ ] **Passo 5: `secoes/feriados.tsx`**

```tsx
import { CalendarOff, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { diaCurto } from '@/lib/configuracoes';
import { formatarData } from '@/lib/formatos';
import { adicionarFeriado, removerFeriado } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, SalvarConfig } from '../formulario-config';

/** Feriados (Configurações: Sim): o prazo das demandas pula estes dias. `feriados` vem ordenado por data. */
export function SecaoFeriados({ feriados, hoje }: { feriados: { data: string; descricao: string }[]; hoje: string }) {
  const proximo = feriados.find((f) => f.data >= hoje);
  return (
    <Cartao
      id="feriados"
      titulo="Feriados"
      descricao={(
        <>
          Dias sem expediente: o prazo das demandas pula estes dias.{' '}
          {proximo
            ? <>Próximo: <strong className="font-semibold text-foreground">{diaCurto(`${proximo.data}T12:00:00-03:00`)}, {proximo.descricao}</strong>.</>
            : 'Nenhum feriado à frente.'}
        </>
      )}
    >
      <CardContent>
        {feriados.length === 0 ? (
          <EmptyState icone={CalendarOff} titulo="Nenhum feriado cadastrado." className="py-6" />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
            {feriados.map((f) => {
              const data = formatarData(`${f.data}T12:00:00-03:00`);
              const passou = f.data < hoje;
              return (
                <li key={f.data} className="flex items-center gap-3 px-3 py-2">
                  <span className={cn('tabular w-24 shrink-0', passou ? 'text-subtle' : 'text-muted')}>{data}</span>
                  <span className={cn('min-w-0 flex-1 truncate', passou ? 'text-subtle' : 'text-foreground')}>{f.descricao}{passou && <span className="sr-only"> (já passou)</span>}</span>
                  <ConfirmDialog
                    gatilho={(
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover o feriado ${data}`} className="size-8 text-muted hover:text-danger">
                        <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                      </Button>
                    )}
                    titulo="Remover feriado?"
                    descricao={`${data} · ${f.descricao} volta a ser dia normal de expediente.`}
                    confirmar="Remover"
                    enviando="Removendo…"
                    acao={removerFeriado.bind(null, f.data)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={adicionarFeriado} rotulo="Novo feriado" limparAoSalvar className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <Input type="date" name="data" aria-label="Data do feriado" required className="tabular sm:w-44" />
          <Input name="descricao" placeholder="Descrição" aria-label="Descrição do feriado" required maxLength={80} className="sm:flex-1" />
          <SalvarConfig>Adicionar</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
```

- [ ] **Passo 6: `secoes/prazos-tabela.tsx` (cliente)**

```tsx
'use client';

import { Antes, useCampoDoFormulario } from '@/components/patterns/formulario-alteravel';
import { PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import { Input } from '@/components/ui/input';
import { COLUNA_PRAZO, diaCurto, textoDias, vencimentoCurto } from '@/lib/configuracoes';
import { ROTULO_PRIORIDADE, type Prioridade } from '@/lib/demandas';

export type LinhaPrazoDados = { prioridade: Prioridade; dias: number; abertas: number | null };

/** Uma prioridade: campo de dias (0 = mesmo dia, D16), exemplo de vencimento ao vivo e quantas abertas a usam. */
function LinhaPrazo({ l, exemplos }: { l: LinhaPrazoDados; exemplos: (string | null)[] }) {
  const col = COLUNA_PRAZO[l.prioridade];
  const valor = useCampoDoFormulario(col, String(l.dias));
  const n = /^\d{1,2}$/.test(valor) && Number(valor) <= 30 ? Number(valor) : null;
  const vence = n === null ? null : exemplos[n] ?? null;
  const era = n !== null && n !== l.dias ? exemplos[l.dias] ?? null : null;
  const nome = ROTULO_PRIORIDADE[l.prioridade];
  return (
    <tr className="border-t border-border align-top">
      <th scope="row" className="py-3 pr-4 text-left font-normal">
        <PrioridadeTexto prioridade={l.prioridade} caixaAlta />
      </th>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <Input
            name={col}
            type="number"
            inputMode="numeric"
            step="1"
            min="0"
            max="30"
            required
            defaultValue={l.dias}
            aria-label={`${nome} (dias úteis)`}
            aria-describedby={`${col}-vence`}
            className="tabular w-20"
          />
          <span className="whitespace-nowrap text-base text-muted">{n === null ? '' : n === 0 ? 'mesmo dia' : n === 1 ? 'dia útil' : 'dias úteis'}</span>
        </div>
        <Antes campo={col} texto={textoDias(l.dias)} />
      </td>
      <td id={`${col}-vence`} className="py-3 pr-4 text-base">
        {vence ? (
          <>
            vence <strong className="font-semibold text-foreground">{vencimentoCurto(vence)}</strong>
            {era && <span className="text-muted"> (era {diaCurto(era)})</span>}
          </>
        ) : (
          <span className="text-muted">{exemplos.length ? 'sem dia útil configurado' : '—'}</span>
        )}
      </td>
      <td className="tabular py-3 text-base text-muted">{l.abertas === null ? '—' : l.abertas === 1 ? '1 aberta' : `${l.abertas} abertas`}</td>
    </tr>
  );
}

/** Tabela da imagem A: Prioridade · Prazo · Exemplo · Usada em. */
export function TabelaPrazos({ linhas, exemplos, inicio }: { linhas: LinhaPrazoDados[]; exemplos: (string | null)[]; inicio: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-xl text-left">
        <thead>
          <tr className="text-xs font-extrabold uppercase tracking-wide text-muted">
            <th scope="col" className="pb-2 pr-4">Prioridade</th>
            <th scope="col" className="pb-2 pr-4">Prazo</th>
            <th scope="col" className="pb-2 pr-4">Exemplo: aberta hoje, {vencimentoCurto(inicio)}</th>
            <th scope="col" className="pb-2">Usada em</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => <LinhaPrazo key={l.prioridade} l={l} exemplos={exemplos} />)}
        </tbody>
      </table>
    </div>
  );
}
```

(`min-w-xl` é da escala do Tailwind 4; se o `escala.test.ts` reclamar, use `min-w-lg`.)

- [ ] **Passo 7: `secoes/prazos.tsx` (servidor)**

```tsx
import { CalendarOff, Clock, ExternalLink, Pause, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CardContent } from '@/components/ui/card';
import { COLUNA_PRAZO, hrefSecao, inicioExemplo, PRIORIDADES, textoDiasUteis, diaCurto, type ResumoPrazos } from '@/lib/configuracoes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarPrazos } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';
import { TabelaPrazos } from './prazos-tabela';

const LINK = 'font-semibold text-brand underline-offset-4 hover:underline';

/** Prazos por prioridade (spec 6.5 e 7C.4): tabela com exemplo e abertas, como o prazo é contado e quem pode mudá-lo. */
export async function SecaoPrazos({ cfg, feriados, hoje, admin, agora }: {
  cfg: Config; feriados: { data: string; descricao: string }[]; hoje: string; admin: boolean; agora: Date;
}) {
  const sb = await supabaseServidor();
  const inicio = inicioExemplo(agora);
  const [{ data, error }, pessoas] = await Promise.all([
    sb.rpc('prazos_resumo', { p_inicio: inicio }),
    admin
      ? sb.from('usuarios').select('nome, papel, usuario_permissoes(modulo, nivel)').eq('ativo', true).order('nome')
      : Promise.resolve({ data: null }),
  ]);
  // Homologação sem a migração (D25): a tabela continua editável, sem exemplo nem contagem.
  const resumo = error ? null : (data as unknown as ResumoPrazos);
  const linhas = PRIORIDADES.map((p) => ({ prioridade: p, dias: cfg[COLUNA_PRAZO[p]], abertas: resumo ? resumo.abertas[p] ?? 0 : null }));
  const total = resumo ? PRIORIDADES.reduce((n, p) => n + (resumo.abertas[p] ?? 0), 0) : null;
  const podem = (pessoas.data ?? [])
    .filter((u) => u.papel === 'admin' || u.usuario_permissoes.some((x) => x.modulo === 'prazos' && x.nivel === 'sim'))
    .map((u) => u.nome);
  const proximo = feriados.find((f) => f.data >= hoje);

  return (
    <>
      <FormularioConfig acao={salvarPrazos} rotulo="Prazos por prioridade">
        <Cartao id="prazos" titulo="Prazos por prioridade" descricao="Quando a demanda é aberta (pelo agente ou pela equipe), o prazo é calculado em dias úteis a partir destes valores. Quem atende pode mudar o prazo de cada demanda depois.">
          <CardContent className="flex flex-col gap-3">
            {!resumo && (
              <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                Exemplo de vencimento e contagem indisponíveis: falta a atualização do banco desta versão.
              </p>
            )}
            <TabelaPrazos linhas={linhas} exemplos={resumo?.exemplos ?? []} inicio={inicio} />
          </CardContent>
          <RodapeConfig
            salvar="Salvar prazos"
            aviso={total === null ? 'Vale para as demandas novas.' : `Vale para as novas. As ${total} abertas mantêm o prazo, a menos que você escolha aplicar.`}
          />
        </Cartao>
      </FormularioConfig>

      <div className="grid gap-5 xl:grid-cols-5">
        <Cartao id="prazo-como" titulo="Como o prazo é contado" className="xl:col-span-3">
          <CardContent>
            <ul className="flex flex-col divide-y divide-border text-base">
              <li className="flex gap-3 py-3">
                <Clock aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>Conta só o <strong className="font-semibold">expediente</strong>: {textoDiasUteis(cfg.dias_uteis)}, {cfg.horario_inicio.slice(0, 5)} às {cfg.horario_fim.slice(0, 5)}. <Link href={hrefSecao('expediente')} className={LINK}>Expediente</Link></p>
              </li>
              <li className="flex gap-3 py-3">
                <CalendarOff aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>Pula os <strong className="font-semibold">feriados cadastrados</strong>. {proximo ? `Próximo: ${diaCurto(`${proximo.data}T12:00:00-03:00`)}, ${proximo.descricao}.` : 'Nenhum à frente.'} <Link href={hrefSecao('feriados')} className={LINK}>Feriados</Link></p>
              </li>
              <li className="flex gap-3 py-3">
                <Pause aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>Status <strong className="font-semibold">Com o cliente</strong> pausa o prazo; ao sair dele, o prazo anda o tempo pausado.</p>
              </li>
              <li className="flex gap-3 py-3">
                <Sparkles aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>O <strong className="font-semibold">agente escolhe a prioridade</strong> ao abrir: assunto sensível ou cobrança repetida = alta; pedido de nota = normal.</p>
              </li>
            </ul>
          </CardContent>
        </Cartao>
        <Cartao id="prazo-quem" titulo="Quem pode mudar o prazo" className="xl:col-span-2">
          <CardContent className="flex flex-col gap-3 text-base">
            <p>Na demanda, só quem tem a permissão <strong className="font-semibold">Alterar prazos de demandas</strong> escolhe a data. A prioridade continua livre para quem atende o setor.</p>
            {admin && (
              <>
                <p className="rounded-md border border-dashed border-border p-3 text-sm">
                  <strong className="font-semibold text-success">{podem.length === 1 ? '1 pessoa' : `${podem.length} pessoas`}</strong> com a permissão: {podem.join(', ') || 'ninguém'}.
                </p>
                <Link href="/usuarios" className={`inline-flex items-center gap-1 ${LINK}`}>Abrir Usuários e permissões <ExternalLink aria-hidden size={14} strokeWidth={1.75} /></Link>
              </>
            )}
          </CardContent>
        </Cartao>
      </div>
    </>
  );
}
```

- [ ] **Passo 8: `page.tsx` usa os três componentes**

Na página (ainda longa):
- logo depois do `Promise.all`, `if (!cfg) throw new Error('Não consegui ler as configurações.');` e `const hoje = hojeSP(agora);` (import de `@/lib/configuracoes`);
- troque o bloco `<FormularioAlteravel action={salvarExpediente}>…</FormularioAlteravel>` por `<SecaoExpediente cfg={cfg} />`;
- troque o bloco `<FormularioAlteravel action={salvarPrazos}>…</FormularioAlteravel>` por `<SecaoPrazos cfg={cfg} feriados={feriados ?? []} hoje={hoje} admin={admin} agora={agora} />`;
- troque o bloco `<Secao id="feriados" …>…</Secao>` por `<SecaoFeriados feriados={feriados ?? []} hoje={hoje} />`;
- `searchParams` não traz mais `erro` para Prazos: tire `erro === 'prazos'` (o `erro === 'aviso_login'` fica até a Task 7);
- tire os imports e constantes que ficarem sem uso (`DIAS`, `DIAS_EXTENSO`, `CalendarOff`, `HorarioExpediente`, `adicionarFeriado`, `removerFeriado`, `salvarExpediente`, `salvarPrazos`…). O `Secao` local e o `RodapeSalvar` continuam enquanto outros blocos os usarem.

- [ ] **Passo 9: e2e**

`apps/painel/e2e/apoio-configuracoes.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/** Abre uma seção de Configurações pelo endereço (a página longa ignora ?secao; depois da Task 10 ele escolhe a seção). */
export async function abrirSecao(page: Page, id: string): Promise<void> {
  await page.goto(`/configuracoes?secao=${id}`);
}

/** Salvar prazos: com demanda aberta da prioridade, a janela de impacto abre; escolhe "Só para as novas". */
export async function salvarPrazosSoNovas(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salvar prazos' }).click();
  const novas = page.getByRole('button', { name: 'Só para as novas' });
  const salvo = page.getByText('Prazos salvos. Valem para as demandas novas.');
  await expect(novas.or(salvo)).toBeVisible({ timeout: 30_000 });
  if (await novas.isVisible()) await novas.click();
  await expect(salvo).toBeVisible();
}

/** "2 dias úteis", "1 dia útil", "mesmo dia (fim do expediente)" (igual a textoDias). */
export const textoDias = (n: number) => (n === 0 ? 'mesmo dia (fim do expediente)' : n === 1 ? '1 dia útil' : `${n} dias úteis`);
```

`apps/painel/e2e/configuracoes-escritorio.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirSecao, textoDias } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';

test.beforeEach(async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-g1@e2e.local', senha: SENHA, nome: 'Admin G1', papel: 'admin' });
  await entrar(page, 'admin-g1@e2e.local', SENHA);
});

test('Expediente: campo alterado fica âmbar com "antes", Descartar volta e Salvar grava', async ({ page }) => {
  const antes = (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data!.horario_fim.slice(0, 5);
  const novo = antes === '19:15' ? '18:45' : '19:15';
  await abrirSecao(page, 'expediente');
  const cartao = page.getByRole('region', { name: 'Expediente' });
  const fim = cartao.getByLabel('às', { exact: true });
  await fim.fill(novo, { timeout: 30_000 });
  await expect(fim).toHaveAttribute('data-alterado', '');
  await expect(cartao.getByText(`antes: ${antes}`)).toBeVisible();
  await expect(cartao.getByText('1 alteração não salva')).toBeVisible();
  await cartao.getByRole('button', { name: 'Descartar' }).click();
  await expect(fim).toHaveValue(antes);
  await expect(cartao.getByText('Sem alterações')).toBeVisible();
  try {
    await fim.fill(novo);
    await cartao.getByRole('button', { name: 'Salvar expediente' }).click();
    await expect(page.getByText('Expediente salvo.')).toBeVisible();
    await expect.poll(async () => (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data?.horario_fim.slice(0, 5)).toBe(novo);
    await expect(cartao.getByText('Sem alterações')).toBeVisible();
  } finally {
    await db.from('configuracoes').update({ horario_fim: `${antes}:00` }).eq('id', 1);
  }
});

test('Expediente: fim antes do início — o navegador segura e o que foi digitado fica', async ({ page }) => {
  await abrirSecao(page, 'expediente');
  const cartao = page.getByRole('region', { name: 'Expediente' });
  const inicio = cartao.getByLabel('Das', { exact: true });
  await inicio.fill('19:00', { timeout: 30_000 });
  await cartao.getByLabel('às', { exact: true }).fill('18:00');
  await cartao.getByRole('button', { name: 'Salvar expediente' }).click();
  // O navegador segura (mesma regra do servidor) e o digitado continua.
  await expect(inicio).toHaveValue('19:00');
  await expect(cartao.getByText(/alteraç(ão|ões) não salva/)).toBeVisible();
});

test('Prazos: exemplo de vencimento, abertas por prioridade, "antes" e "era"', async ({ page }) => {
  await abrirSecao(page, 'prazos');
  const cartao = page.getByRole('region', { name: 'Prazos por prioridade' });
  await expect(cartao.getByRole('row')).toHaveCount(5, { timeout: 30_000 });
  await expect(cartao.getByText(/^vence /)).toHaveCount(4);
  await expect(cartao.getByText(/\d+ abertas?$/)).toHaveCount(4);
  const normal = cartao.getByLabel('Normal (dias úteis)');
  const valor = Number(await normal.inputValue());
  await normal.fill(String(valor + 1));
  await expect(cartao.getByText(`antes: ${textoDias(valor)}`)).toBeVisible();
  await expect(cartao.getByText(/\(era (seg|ter|qua|qui|sex|sáb|dom) \d{2}\/\d{2}\)/)).toBeVisible();
  await cartao.getByRole('button', { name: 'Descartar' }).click();
  await expect(normal).toHaveValue(String(valor));
  await expect(page.getByRole('region', { name: 'Como o prazo é contado' })).toContainText('Com o cliente');
  await expect(page.getByRole('region', { name: 'Quem pode mudar o prazo' })).toContainText('com a permissão');
});

test('Feriados: adiciona (o formulário volta vazio) e remove', async ({ page }) => {
  await db.from('feriados').delete().eq('data', '2099-12-24');
  await abrirSecao(page, 'feriados');
  const cartao = page.getByRole('region', { name: 'Feriados' });
  await cartao.getByLabel('Data do feriado').fill('2099-12-24', { timeout: 30_000 });
  await cartao.getByLabel('Descrição do feriado').fill('Véspera e2e G1');
  await cartao.getByRole('button', { name: 'Adicionar' }).click();
  await expect(page.getByText('Feriado adicionado.')).toBeVisible();
  await expect(cartao.getByText('Véspera e2e G1')).toBeVisible();
  await expect(cartao.getByLabel('Descrição do feriado')).toHaveValue('');
  await cartao.getByRole('button', { name: 'Remover o feriado 24/12/2099' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();
  await expect(cartao.getByText('Véspera e2e G1')).toHaveCount(0);
});
```

(O label do início do expediente é "Das": `grep -n "Das" "apps/painel/src/app/(painel)/configuracoes/horario-expediente.tsx"`.)

- [ ] **Passo 10: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/configuracoes-escritorio.spec.ts e2e/configuracoes.spec.ts e2e/niveis-telas.spec.ts`
Expected: tudo verde. O teste antigo "administrador muda o prazo de uma prioridade" continua passando (sem janela ainda).

- [ ] **Passo 11: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Configurações › Escritório — expediente, feriados e prazos com exemplo de vencimento e abertas por prioridade

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Painel. Prazos: janela de impacto e aplicar às abertas

**Files:**
- Modify: `apps/painel/src/app/(painel)/configuracoes/acoes.ts`, `secoes/prazos.tsx`
- Create: `apps/painel/src/app/(painel)/configuracoes/secoes/formulario-prazos.tsx`, `secoes/janela-impacto.tsx`
- Modify: `apps/painel/src/lib/linha-do-tempo.ts`, `linha-do-tempo.test.ts`, `pedido-nota.ts`, `pedido-nota.test.ts`
- Create: `apps/painel/e2e/configuracoes-prazos.spec.ts`
- Modify: `apps/painel/e2e/configuracoes.spec.ts`

**Interfaces:**
- Consumes: `simular_mudanca_prazo`, `aplicar_prazo_abertas` (Task 1); `textoImpacto`, `ImpactoPrazo` (Task 3); `FormularioConfig.antesDeEnviar` (Task 4).
- Produces: `simularPrazos(fd) → { ok: true; impactos: ImpactoPrazo[] } | { ok: false; erro: string }`; `salvarPrazos(fd)` com `aplicar=sim` → aplica; `FormularioPrazos`, `JanelaImpacto`, `type Escolha = 'novas' | 'aplicar' | 'cancelar'`; frase do evento `prazo_recalculado`.

- [ ] **Passo 1: linha do tempo — teste que falha**

`linha-do-tempo.test.ts`, num `it` novo:

```ts
  it('prazo recalculado por mudança de regra, com a pessoa (Parte G1)', () => {
    expect(fraseDoEvento(ev('prazo_recalculado', '2026-10-13T21:00:00Z', 'Thiago'), 'agente'))
      .toEqual({ ator: 'Sistema', acao: 'prazo 13/10 18h · recalculado por mudança de regra (Thiago)', detalhe: null });
  });
```

`pedido-nota.test.ts`, no teste de `ocultarEventosDoPedido`, um caso: `{ tipo: 'prazo_recalculado', texto: '2026-10-13T21:00:00Z', … }` continua com o texto.

Run: `pnpm --filter @escritorio/painel test -- linha-do-tempo pedido-nota` → FAIL.

- [ ] **Passo 2: linha do tempo e pedido de nota**

`linha-do-tempo.ts`, depois de `case 'prazo_alterado'`:

```ts
    case 'prazo_recalculado':
      return { ator: 'Sistema', acao: `prazo ${prazoAbsoluto(e.texto ?? '')} · recalculado por mudança de regra (${e.usuario ?? 'Sistema'})`, detalhe: null };
```

`pedido-nota.ts`: `'prazo_recalculado'` em `SEM_TEXTO_LIVRE` (o texto é só o prazo). Confira com `grep -rn "'reaberto'" apps packages --include=*.ts | grep -v test | grep -v tipos.gen` se há outra lista de tipos de evento; acrescente lá também.

- [ ] **Passo 3: ações**

Em `acoes.ts` (acrescente `ROTULO_PRIORIDADE` de `@/lib/demandas` e `type ImpactoPrazo` de `@/lib/configuracoes`):

```ts
/** Impacto de cada prioridade mudada nas demandas abertas, sem gravar (simular_mudanca_prazo é stable). */
export async function simularPrazos(formData: FormData): Promise<{ ok: true; impactos: ImpactoPrazo[] } | { ok: false; erro: string }> {
  await exigirConfiguracoes();
  const v = PrazosForm.safeParse(lerPrazos(formData));
  if (!v.success) return { ok: false, erro: 'Cada prazo vai de 0 a 30 dias úteis.' };
  const sb = await supabaseServidor();
  const { data: cfg, error } = await sb.from('configuracoes')
    .select('prazo_urgente_dias, prazo_alta_dias, prazo_normal_dias, prazo_baixa_dias').eq('id', 1).single();
  if (error || !cfg) return { ok: false, erro: error ? mensagemDoBanco(error.message) : 'Não consegui ler os prazos.' };
  const impactos: ImpactoPrazo[] = [];
  for (const p of PRIORIDADES) {
    const col = COLUNA_PRAZO[p];
    if (v.data[col] === cfg[col]) continue;
    const r = await sb.rpc('simular_mudanca_prazo', { p_prioridade: p, p_dias: v.data[col] });
    if (r.error) return { ok: false, erro: `Não consegui calcular o impacto: ${mensagemDoBanco(r.error.message)}` };
    impactos.push(r.data as unknown as ImpactoPrazo);
  }
  return { ok: true, impactos };
}

/** Prazos por prioridade. Com aplicar=sim, cada prioridade mudada grava a regra e recalcula as abertas na mesma transação (D2). */
export async function salvarPrazos(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = PrazosForm.safeParse(lerPrazos(formData));
  if (!v.success) return falha('Cada prazo vai de 0 a 30 dias úteis.');
  const sb = await supabaseServidor();
  if (formData.get('aplicar') !== 'sim') {
    const { error } = await sb.from('configuracoes').update(v.data).eq('id', 1);
    if (error) return doBanco(error);
    recarregar();
    return ok('Prazos salvos. Valem para as demandas novas.');
  }
  const { data: cfg, error } = await sb.from('configuracoes')
    .select('prazo_urgente_dias, prazo_alta_dias, prazo_normal_dias, prazo_baixa_dias').eq('id', 1).single();
  if (error || !cfg) return error ? doBanco(error) : falha('Não consegui ler os prazos.');
  let mudaram = 0;
  const feitas: string[] = [];
  for (const p of PRIORIDADES) {
    const col = COLUNA_PRAZO[p];
    if (v.data[col] === cfg[col]) continue;
    const r = await sb.rpc('aplicar_prazo_abertas', { p_prioridade: p, p_dias: v.data[col] });
    if (r.error) {
      recarregar();
      return falha(`${feitas.length ? `Já aplicado: ${feitas.join(', ')}. ` : ''}${ROTULO_PRIORIDADE[p]}: ${mensagemDoBanco(r.error.message)}`);
    }
    mudaram += Number(r.data ?? 0);
    feitas.push(ROTULO_PRIORIDADE[p]);
  }
  recarregar();
  revalidatePath('/demandas');
  return ok(`Prazos salvos e aplicados: ${mudaram === 1 ? '1 demanda aberta mudou de prazo' : `${mudaram} demandas abertas mudaram de prazo`}.`);
}
```

- [ ] **Passo 4: `secoes/janela-impacto.tsx`**

```tsx
'use client';

import { TriangleAlert } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { textoImpacto, type ImpactoPrazo } from '@/lib/configuracoes';

export type Escolha = 'novas' | 'aplicar' | 'cancelar';

/**
 * Impacto de mudar o prazo (spec 7C.4, decisão do dono de 02/10): "SÓ PARA AS NOVAS" é o padrão (foco inicial);
 * "APLICAR TAMBÉM ÀS N ABERTAS" só quando alguma mudaria (D6). Ao diminuir, aviso vermelho com ícone e texto.
 */
export function JanelaImpacto({ impactos, escolher }: { impactos: ImpactoPrazo[] | null; escolher: (e: Escolha) => void }) {
  const novas = useRef<HTMLButtonElement>(null);
  const textos = (impactos ?? []).map(textoImpacto);
  const recalcula = textos.reduce((n, t) => n + t.recalcula, 0);
  return (
    <Dialog open={impactos !== null} onOpenChange={(aberto) => { if (!aberto) escolher('cancelar'); }}>
      <DialogContent className="max-w-lg" onOpenAutoFocus={(e) => { e.preventDefault(); novas.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>Mudar o prazo das demandas abertas também?</DialogTitle>
          <DialogDescription>A regra nova sempre vale para as demandas novas. Escolha se as abertas mudam junto.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {textos.map((t) => (
            <section key={t.titulo} aria-label={t.titulo} className="rounded-md border border-border p-3">
              <h3 className="font-semibold text-foreground">{t.titulo}</h3>
              <ul className="mt-1 list-disc pl-5 text-base text-muted">
                {t.linhas.map((l) => <li key={l}>{l}</li>)}
              </ul>
              {t.alerta && (
                <p role="alert" className="mt-2 flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-semibold text-danger">
                  <TriangleAlert aria-hidden size={16} strokeWidth={2} />
                  {t.alerta}
                </p>
              )}
            </section>
          ))}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button ref={novas} type="button" onClick={() => escolher('novas')}>Só para as novas</Button>
          {recalcula > 0 && (
            <Button type="button" variant="outline" onClick={() => escolher('aplicar')}>
              {recalcula === 1 ? 'Aplicar também à 1 aberta' : `Aplicar também às ${recalcula} abertas`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Passo 5: `secoes/formulario-prazos.tsx`**

```tsx
'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { toast } from '@/components/ui/toaster';
import type { ImpactoPrazo } from '@/lib/configuracoes';
import { salvarPrazos, simularPrazos } from '../acoes';
import { FormularioConfig } from '../formulario-config';
import { JanelaImpacto, type Escolha } from './janela-impacto';

/**
 * Prazos (spec 7C.4): antes de salvar, simula; com demanda aberta de uma prioridade mudada, abre a janela e espera a
 * escolha. Vale também no "Salvar e sair" da janela de saída (D15): o salvarParaSair do FormularioConfig passa por aqui.
 */
export function FormularioPrazos({ children }: { children: ReactNode }) {
  const [impactos, setImpactos] = useState<ImpactoPrazo[] | null>(null);
  const resposta = useRef<((e: Escolha) => void) | null>(null);
  const antesDeEnviar = useCallback(async (dados: FormData): Promise<boolean> => {
    const s = await simularPrazos(dados);
    if (!s.ok) {
      toast.error(s.erro);
      return false;
    }
    if (!s.impactos.some((i) => i.abertas > 0)) return true;
    setImpactos(s.impactos);
    const escolha = await new Promise<Escolha>((res) => { resposta.current = res; });
    setImpactos(null);
    if (escolha === 'cancelar') return false;
    if (escolha === 'aplicar') dados.set('aplicar', 'sim');
    return true;
  }, []);
  return (
    <>
      <FormularioConfig acao={salvarPrazos} rotulo="Prazos por prioridade" antesDeEnviar={antesDeEnviar}>
        {children}
      </FormularioConfig>
      <JanelaImpacto
        impactos={impactos}
        escolher={(e) => {
          const r = resposta.current;
          resposta.current = null;
          r?.(e);
        }}
      />
    </>
  );
}
```

Em `secoes/prazos.tsx`, troque `<FormularioConfig acao={salvarPrazos} rotulo="Prazos por prioridade">…</FormularioConfig>` por `<FormularioPrazos>…</FormularioPrazos>` (import de `./formulario-prazos`; tire o import de `salvarPrazos` e de `FormularioConfig` se sobrarem sem uso).

- [ ] **Passo 6: e2e**

`apps/painel/e2e/configuracoes-prazos.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';
import { abrirSecao } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';
const PREFIXO = 'G1 impacto';
const mesmoInstante = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

test.afterEach(async () => {
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
  await limparDemandasE2e(PREFIXO);
});

test('Prazos: janela de impacto, padrão "Só para as novas" e aplicar às abertas com evento na linha do tempo', async ({ page }) => {
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
  const longe = new Date(Date.now() + 40 * 86_400_000).toISOString();
  const a = await demandaE2e({ titulo: `${PREFIXO} A`, setor: 'Fiscal', prioridade: 'normal', prazoEm: longe });
  await demandaE2e({ titulo: `${PREFIXO} perto`, setor: 'Fiscal', prioridade: 'normal', prazoEm: new Date(Date.now() + 3_600_000).toISOString() });
  const { count } = await db.from('chamados').select('id', { count: 'exact', head: true }).eq('prioridade', 'normal').neq('status', 'concluido');
  await criarUsuarioTeste({ email: 'admin-impacto@e2e.local', senha: SENHA, nome: 'Admin Impacto', papel: 'admin' });
  await entrar(page, 'admin-impacto@e2e.local', SENHA);

  // 2 → 3, Enter: o foco está em "Só para as novas".
  await abrirSecao(page, 'prazos');
  const cartao = page.getByRole('region', { name: 'Prazos por prioridade' });
  await cartao.getByLabel('Normal (dias úteis)').fill('3', { timeout: 30_000 });
  await cartao.getByRole('button', { name: 'Salvar prazos' }).click();
  const janela = page.getByRole('dialog', { name: 'Mudar o prazo das demandas abertas também?' });
  await expect(janela.getByText(`${count} demandas Normais abertas`)).toBeVisible({ timeout: 30_000 });
  await expect(janela.getByText('Nenhuma fica vencida.')).toBeVisible();
  await expect(janela.getByRole('button', { name: 'Só para as novas' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Prazos salvos. Valem para as demandas novas.')).toBeVisible();
  expect((await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);
  expect(mesmoInstante((await db.from('chamados').select('prazo_em').eq('id', a.id).single()).data!.prazo_em!, longe)).toBe(true);
  expect((await db.from('chamado_eventos').select('id').eq('chamado_id', a.id).eq('tipo', 'prazo_recalculado')).data).toHaveLength(0);

  // Esc fecha sem salvar e mantém o digitado.
  await cartao.getByLabel('Normal (dias úteis)').fill('1');
  await cartao.getByRole('button', { name: 'Salvar prazos' }).click();
  await expect(janela).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(janela).toHaveCount(0);
  await expect(cartao.getByLabel('Normal (dias úteis)')).toHaveValue('1');
  expect((await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);

  // 3 → 1 e aplicar: aviso vermelho (a "perto" venceria), A perde 2 dias úteis e ganha o evento.
  await cartao.getByRole('button', { name: 'Salvar prazos' }).click();
  await expect(janela.getByRole('alert')).toContainText(/passaria(m)? a vencida/);
  await janela.getByRole('button', { name: /^Aplicar também à/ }).click();
  await expect(page.getByText(/^Prazos salvos e aplicados/)).toBeVisible();
  const depois = (await db.from('chamados').select('prazo_em').eq('id', a.id).single()).data!.prazo_em!;
  expect(new Date(depois).getTime()).toBeLessThan(new Date(longe).getTime());
  const { data: eventos } = await db.from('chamado_eventos').select('texto').eq('chamado_id', a.id).eq('tipo', 'prazo_recalculado');
  expect(eventos).toHaveLength(1);
  expect(mesmoInstante(eventos![0]!.texto!, depois)).toBe(true);

  await page.goto(`/demandas?demanda=${a.id}`);
  await expect(page.getByText(/recalculado por mudança de regra \(Admin Impacto\)/)).toBeVisible({ timeout: 30_000 });
});
```

Em `e2e/configuracoes.spec.ts`, no teste "administrador muda o prazo de uma prioridade em Configurações › Prazos": troque `page.goto('/configuracoes#prazos')` por `abrirSecao(page, 'prazos')` e o clique em "Salvar prazos" por `await salvarPrazosSoNovas(page)` (imports de `./apoio-configuracoes`). Motivo no commit: com demanda Normal aberta no banco de teste, a janela de impacto abre (spec 7C.4).

- [ ] **Passo 7: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/configuracoes-prazos.spec.ts e2e/configuracoes.spec.ts e2e/configuracoes-escritorio.spec.ts e2e/demandas-painel.spec.ts`
Expected: tudo verde.

- [ ] **Passo 8: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Prazos mostram o impacto antes de salvar; aplicar às abertas grava evento por demanda

O teste antigo de Prazos passa pela janela quando há demanda Normal aberta no banco de teste.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Painel. Agente e atendimento: Mensagens, Limites de espera, Teto e modelos de IA

**Files:**
- Modify: `apps/painel/src/app/(painel)/configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx}`
- Create: `apps/painel/src/app/(painel)/configuracoes/secoes/{mensagens,espera,ia}.tsx`
- Delete: `apps/painel/src/app/(painel)/configuracoes/formulario-espera.tsx`
- Create: `apps/painel/e2e/configuracoes-agente.spec.ts`
- Modify: `apps/painel/e2e/configuracoes.spec.ts`

**Interfaces:**
- Consumes: `salvarLimitesEspera` (Parte E, já devolve `{ ok, mensagem | erro }`), `situacaoTeto`, `nomeModelo`, `CampoEmail`.
- Produces: `salvarMensagens`, `salvarAvisoLogin`, `salvarTetoAlertas`, `salvarCotacao`, `salvarModelos` → `Resultado`; esquemas `TetoAlertasForm` (só teto, minutos, e-mail, telefone), `CotacaoForm`, `modelosForm(chaves)`; componentes `SecaoMensagens({ cfg })`, `SecaoEspera({ cfg })`, `SecaoIa({ cfg, teto, parcial })`.

- [ ] **Passo 1: esquemas — testes que falham**

Em `esquemas.test.ts`:
- no teste "teto e alertas", o esperado vira `{ teto_ia_usd: 80, minutos_alerta_fila: 30, email_alertas: 'dono@escritorio.com', telefone_dono: '5531977770000' }` (sem cotação);
- o `describe('TetoAlertasForm: cotação do dólar…')` passa a usar `CotacaoForm` (o `form()` dele só põe os dois campos novos; os casos e mensagens continuam iguais);
- novo:

```ts
describe('modelosForm (Parte G1, D11)', () => {
  const Modelos = modelosForm(['claude-sonnet-5', 'claude-haiku-4-5']);
  it('aceita só modelos com preço', () => {
    const f = new FormData();
    f.set('modelo_conversa', 'claude-sonnet-5'); f.set('modelo_rapido', 'claude-haiku-4-5');
    expect(Modelos.parse(f)).toEqual({ modelo_conversa: 'claude-sonnet-5', modelo_rapido: 'claude-haiku-4-5' });
    f.set('modelo_rapido', 'gpt-x');
    expect(Modelos.safeParse(f).error?.issues[0]?.message).toBe('Escolha um modelo da lista de preços.');
  });
});
```

Run: `pnpm --filter @escritorio/painel test -- esquemas` → FAIL.

- [ ] **Passo 2: esquemas e ações**

`esquemas.ts`: `TetoAlertasForm` fica só com os quatro campos do cartão Teto de IA e alertas:

```ts
/** Teto de IA e alertas: só o administrador (P12 da Parte D; o banco também segura essas colunas). */
export const TetoAlertasForm = z.preprocess((v) => {
  const f = v as FormData;
  return {
    teto_ia_usd: f.get('teto_ia_usd'), minutos_alerta_fila: f.get('minutos_alerta_fila'),
    email_alertas: f.get('email_alertas') || null, telefone_dono: f.get('telefone_dono') || null,
  };
}, z.object({
  teto_ia_usd: z.coerce.number().positive('O teto precisa ser maior que zero.'),
  minutos_alerta_fila: z.coerce.number().int().min(5, 'No mínimo 5 minutos.'),
  email_alertas: z.string().email('Confira o e-mail.').nullable(),
  telefone_dono: telefoneOpcional,
}));
```

Novos:

```ts
/** Cotação para mostrar R$ e custo por minuto da transcrição (só o administrador; spec 7B e seção 9). */
export const CotacaoForm = z.preprocess((v) => {
  const f = v as FormData;
  return { cotacao_usd_brl: f.get('cotacao_usd_brl') || null, custo_minuto_transcricao_usd: f.get('custo_minuto_transcricao_usd') || null };
}, z.object({
  cotacao_usd_brl: decimalOpcional('A cotação precisa ser maior que zero.', true),
  custo_minuto_transcricao_usd: decimalOpcional('O custo por minuto não pode ser negativo.', false),
}));

/** Modelos de IA: só os que têm preço em precos_modelos (D11), senão o gasto fica zerado. */
export const modelosForm = (chaves: string[]) => z.preprocess((v) => {
  const f = v as FormData;
  return { modelo_conversa: f.get('modelo_conversa'), modelo_rapido: f.get('modelo_rapido') };
}, z.object({
  modelo_conversa: z.string().refine((m) => chaves.includes(m), 'Escolha um modelo da lista de preços.'),
  modelo_rapido: z.string().refine((m) => chaves.includes(m), 'Escolha um modelo da lista de preços.'),
}));
```

`acoes.ts` (tire `redirect` e acrescente `CotacaoForm`, `modelosForm` aos imports):

```ts
/** Teto de IA e alertas: só o administrador (P12 da Parte D); o gatilho configuracoes_so_admin recusa de novo no banco. */
export async function salvarTetoAlertas(formData: FormData): Promise<Resultado> {
  await exigirAdmin();
  const v = TetoAlertasForm.safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Teto e alertas salvos.');
}

export async function salvarCotacao(formData: FormData): Promise<Resultado> {
  await exigirAdmin();
  const v = CotacaoForm.safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Cotação e custo da transcrição salvos.');
}

export async function salvarModelos(formData: FormData): Promise<Resultado> {
  await exigirAdmin();
  const sb = await supabaseServidor();
  const { data: cfg } = await sb.from('configuracoes').select('precos_modelos').eq('id', 1).single();
  const v = modelosForm(Object.keys((cfg?.precos_modelos ?? {}) as Record<string, unknown>)).safeParse(formData);
  if (!v.success) return primeiroErro(v.error);
  const { error } = await sb.from('configuracoes').update(v.data).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Modelos salvos.');
}

export async function salvarMensagens(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  // Com o agente pausado nada é enviado ao cliente (decisão do dono, 2026-09-28): não há mensagem de pausa.
  const chaves = ['aviso_lgpd', 'fora_do_horario', 'ia_indisponivel'];
  const mensagens = Object.fromEntries(chaves.map((k) => [k, String(formData.get(k) ?? '').trim()]));
  const { error } = await (await supabaseServidor()).from('configuracoes').update({ mensagens }).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Mensagens salvas.');
}

export async function salvarAvisoLogin(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = esquemaAvisoLogin.safeParse({ aviso_login: String(formData.get('aviso_login') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update({ aviso_login: v.data.aviso_login }).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  return ok('Aviso do login salvo.');
}
```

`salvarLimitesEspera`: troque o tipo de retorno por `Promise<Resultado>` (o corpo já devolve `{ ok, mensagem }` / `{ ok: false, erro }`).

- [ ] **Passo 3: `secoes/mensagens.tsx`**

```tsx
import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { salvarAvisoLogin, salvarMensagens } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

const MENSAGENS = [
  { chave: 'aviso_lgpd', rotulo: 'Aviso de privacidade (primeiro contato)' },
  { chave: 'fora_do_horario', rotulo: 'Fora do horário', ajuda: '{inicio} e {fim} viram os horários do expediente.' },
  { chave: 'ia_indisponivel', rotulo: 'IA indisponível' },
];
const resumir = (t: string) => (t.length > 70 ? `${t.slice(0, 70).trimEnd()}…` : t || '(vazio)');

/** Mensagens automáticas ao cliente e o aviso da tela de entrada (spec 7C.4 e 4.4). Configurações: Sim. */
export function SecaoMensagens({ cfg }: { cfg: Config }) {
  const mensagens = (cfg.mensagens ?? {}) as Record<string, string>;
  return (
    <>
      <FormularioConfig acao={salvarMensagens} rotulo="Mensagens automáticas">
        <Cartao id="mensagens" titulo="Mensagens automáticas" descricao="O que o agente manda sozinho ao cliente nestas situações.">
          <CardContent className="flex flex-col gap-4">
            {MENSAGENS.map((m) => (
              <div key={m.chave}>
                <FormField id={`mensagem-${m.chave}`} rotulo={m.rotulo} ajuda={m.ajuda}>
                  <Textarea name={m.chave} defaultValue={mensagens[m.chave] ?? ''} rows={2} className="min-h-16" />
                </FormField>
                <Antes campo={m.chave} texto={resumir(mensagens[m.chave] ?? '')} />
              </div>
            ))}
          </CardContent>
          <RodapeConfig salvar="Salvar mensagens" />
        </Cartao>
      </FormularioConfig>
      <FormularioConfig acao={salvarAvisoLogin} rotulo="Aviso na tela de entrada">
        <Cartao id="aviso-login" titulo="Aviso na tela de entrada" descricao="Um recado curto que a equipe lê antes de entrar no painel. Vazio não mostra nada.">
          <CardContent>
            <FormField id="aviso_login" rotulo="Aviso na tela de entrada" ajuda="Até 200 caracteres. Nunca coloque dados de clientes.">
              <Textarea name="aviso_login" maxLength={200} rows={2} defaultValue={cfg.aviso_login ?? ''} />
            </FormField>
            <Antes campo="aviso_login" texto={resumir(cfg.aviso_login ?? '')} />
          </CardContent>
          <RodapeConfig salvar="Salvar aviso" />
        </Cartao>
      </FormularioConfig>
    </>
  );
}
```

- [ ] **Passo 4: `secoes/espera.tsx`**

```tsx
import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { salvarLimitesEspera } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

/** Cores do cronômetro de espera do Atendimento (spec 7A.1, P18 da Parte E). Configurações: Sim. */
export function SecaoEspera({ cfg }: { cfg: Config }) {
  return (
    <FormularioConfig acao={salvarLimitesEspera} rotulo="Limites de espera">
      <Cartao id="espera" titulo="Limites de espera" descricao="Cores do cronômetro de espera na lista do Atendimento. Depois do âmbar, vermelho, sempre com os minutos escritos.">
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormField id="espera_verde_min" rotulo="Verde até (minutos)">
              <Input name="espera_verde_min" type="number" step="1" min="1" max="240" required defaultValue={cfg.espera_verde_min} className="tabular" />
            </FormField>
            <Antes campo="espera_verde_min" texto={`${cfg.espera_verde_min} min`} />
          </div>
          <div>
            <FormField id="espera_ambar_min" rotulo="Âmbar até (minutos)" ajuda="Depois disso, vermelho.">
              <Input name="espera_ambar_min" type="number" step="1" min="2" max="480" required defaultValue={cfg.espera_ambar_min} className="tabular" />
            </FormField>
            <Antes campo="espera_ambar_min" texto={`${cfg.espera_ambar_min} min`} />
          </div>
        </CardContent>
        <RodapeConfig salvar="Salvar limites" />
      </Cartao>
    </FormularioConfig>
  );
}
```

- [ ] **Passo 5: `secoes/ia.tsx`**

```tsx
import Link from 'next/link';
import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { nomeModelo } from '@/lib/configuracoes';
import { formatarUSD } from '@/lib/formatos';
import type { situacaoTeto } from '@/lib/inicio';
import { classeSelect } from '../../clientes/estilos';
import { salvarCotacao, salvarModelos, salvarTetoAlertas } from '../acoes';
import { CampoEmail } from '../campos-validados';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

type Preco = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };
const LINK = 'text-brand underline underline-offset-4';
/** Decimal do banco na grafia daqui (5,55); vazio quando não configurado. O esquema aceita vírgula ou ponto. */
const decimalBr = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Number(v)).replace('.', ','));
const preco = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

/** Só o administrador (D8): teto e alertas, modelos e cotação, cada um com seu Salvar (pendência 17). */
export function SecaoIa({ cfg, teto, parcial }: { cfg: Config; teto: ReturnType<typeof situacaoTeto> | null; parcial: boolean }) {
  const precos = (cfg.precos_modelos ?? {}) as Record<string, Preco>;
  const modelos = Object.keys(precos);
  const opcoes = (atual: string) => [...new Set([...modelos, atual])].map((m) => (
    <option key={m} value={m}>{nomeModelo(m)}{precos[m] ? '' : ' (sem preço)'}</option>
  ));
  return (
    <>
      <FormularioConfig acao={salvarTetoAlertas} rotulo="Teto de IA e alertas">
        <Cartao id="teto-ia" titulo="Teto de IA e alertas" descricao="Ao chegar no teto do mês, o agente para de responder e as conversas vão para a equipe.">
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <FormField
                id="teto_ia_usd"
                rotulo="Teto mensal de gasto com IA (US$)"
                ajuda={<>{teto && `Gasto neste mês: ${formatarUSD(teto.gasto)} (${Math.round(teto.fracao * 100)}% do teto)${parcial ? ', valor parcial' : ''}. `}<Link href="/gastos-ia" className={LINK}>Ver gastos com IA</Link></>}
              >
                <Input name="teto_ia_usd" type="number" step="1" min="1" required defaultValue={Number(cfg.teto_ia_usd)} className="tabular sm:w-40" />
              </FormField>
              <Antes campo="teto_ia_usd" texto={formatarUSD(Number(cfg.teto_ia_usd))} />
            </div>
            <div>
              <FormField id="minutos_alerta_fila" rotulo="Demanda sem responsável: avisar após (minutos)">
                <Input name="minutos_alerta_fila" type="number" step="1" min="5" required defaultValue={cfg.minutos_alerta_fila} className="tabular sm:w-40" />
              </FormField>
              <Antes campo="minutos_alerta_fila" texto={`${cfg.minutos_alerta_fila} min`} />
            </div>
            <div>
              <FormField id="email_alertas" rotulo="E-mail para alertas">
                <CampoEmail name="email_alertas" defaultValue={cfg.email_alertas ?? ''} />
              </FormField>
              <Antes campo="email_alertas" texto={cfg.email_alertas || '(vazio)'} />
            </div>
            <div>
              <FormField id="telefone_dono" rotulo="Seu WhatsApp (recebe avisos e o resumo diário)">
                <Input name="telefone_dono" inputMode="tel" defaultValue={cfg.telefone_dono ?? ''} />
              </FormField>
              <Antes campo="telefone_dono" texto={cfg.telefone_dono || '(vazio)'} />
            </div>
          </CardContent>
          <RodapeConfig salvar="Salvar teto e alertas" />
        </Cartao>
      </FormularioConfig>

      <div className="grid gap-5 xl:grid-cols-2">
        <FormularioConfig acao={salvarModelos} rotulo="Modelos de IA">
          <Cartao id="modelos-ia" titulo="Modelos de IA" descricao="Qual modelo o agente usa em cada tipo de trabalho. Preço por milhão de tokens, em US$.">
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FormField id="modelo_conversa" rotulo="Conversas com clientes" ajuda="Respostas e decisões do agente, do assistente e da sugestão.">
                    <select name="modelo_conversa" defaultValue={cfg.modelo_conversa} className={classeSelect}>{opcoes(cfg.modelo_conversa)}</select>
                  </FormField>
                  <Antes campo="modelo_conversa" texto={nomeModelo(cfg.modelo_conversa)} />
                </div>
                <div>
                  <FormField id="modelo_rapido" rotulo="Tarefas rápidas" ajuda="Classificar e resumir.">
                    <select name="modelo_rapido" defaultValue={cfg.modelo_rapido} className={classeSelect}>{opcoes(cfg.modelo_rapido)}</select>
                  </FormField>
                  <Antes campo="modelo_rapido" texto={nomeModelo(cfg.modelo_rapido)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Preço por milhão de tokens, em US$</caption>
                  <thead>
                    <tr className="text-xs font-extrabold uppercase tracking-wide text-muted">
                      <th scope="col" className="pb-2 text-left">Modelo</th>
                      <th scope="col" className="pb-2 text-right">Entrada</th>
                      <th scope="col" className="pb-2 text-right">Saída</th>
                      <th scope="col" className="pb-2 text-right">Cache leitura</th>
                      <th scope="col" className="pb-2 text-right">Cache escrita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelos.map((m) => (
                      <tr key={m} className="border-t border-border">
                        <th scope="row" className="py-2 text-left font-semibold">{nomeModelo(m)}</th>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.entrada)}</td>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.saida)}</td>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.cacheLeitura)}</td>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.cacheEscrita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <RodapeConfig salvar="Salvar modelos" />
          </Cartao>
        </FormularioConfig>

        <FormularioConfig acao={salvarCotacao} rotulo="Cotação e custo da transcrição">
          <Cartao id="cotacao" titulo="Cotação e custo da transcrição" descricao="Valores digitados por você. Nada é buscado na internet.">
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormField id="cotacao_usd_brl" rotulo="Cotação do dólar (R$ por US$ 1)" ajuda="Só para mostrar os gastos em reais. Vazio: tudo em US$.">
                  <Input name="cotacao_usd_brl" inputMode="decimal" defaultValue={decimalBr(cfg.cotacao_usd_brl)} className="tabular sm:w-40" />
                </FormField>
                <Antes campo="cotacao_usd_brl" texto={decimalBr(cfg.cotacao_usd_brl) || '(vazio)'} />
              </div>
              <div>
                <FormField id="custo_minuto_transcricao_usd" rotulo="Custo por minuto da transcrição de áudio (US$)" ajuda="Veja no painel do fornecedor (Groq). Vazio: a transcrição fica sem custo em Gastos com IA.">
                  <Input name="custo_minuto_transcricao_usd" inputMode="decimal" defaultValue={decimalBr(cfg.custo_minuto_transcricao_usd)} className="tabular sm:w-40" />
                </FormField>
                <Antes campo="custo_minuto_transcricao_usd" texto={decimalBr(cfg.custo_minuto_transcricao_usd) || '(vazio)'} />
              </div>
            </CardContent>
            <RodapeConfig salvar="Salvar valores" />
          </Cartao>
        </FormularioConfig>
      </div>
    </>
  );
}
```

- [ ] **Passo 6: `page.tsx`**

- troque o bloco `{admin && (<FormularioAlteravel action={salvarTetoAlertas}>…</FormularioAlteravel>)}` por `{admin && <SecaoIa cfg={cfg} teto={teto} parcial={gasto?.parcial ?? false} />}`;
- troque `<FormularioEspera>…</FormularioEspera>` por `<SecaoEspera cfg={cfg} />` e apague `formulario-espera.tsx` (`git rm`);
- troque os blocos `<FormularioAlteravel action={salvarMensagens}>…` e `<FormularioAlteravel action={salvarAvisoLogin}>…` por `<SecaoMensagens cfg={cfg} />`;
- tire `erro` de `searchParams`, `MENSAGENS`, `decimalBr` e os imports sem uso.
- Na lista `SECOES` da navegação de hoje, `{ id: 'atendimento', rotulo: 'Atendimento' }` vira `{ id: 'espera', rotulo: 'Limites de espera' }` (o cartão mudou de id); a navegação some na Task 10.

- [ ] **Passo 7: e2e**

`e2e/configuracoes.spec.ts`, no teste "administrador salva a cotação do dólar e o custo por minuto em Configurações › Teto de IA": troque `page.goto('/configuracoes#teto-ia')` por `abrirSecao(page, 'ia')`; o link "Ver gastos com IA" continua no cartão `Teto de IA e alertas`; os dois campos e o botão passam a ser do cartão `page.getByRole('region', { name: 'Cotação e custo da transcrição' })`, com o botão `'Salvar valores'`. Motivo no commit: o spec separa Teto, Modelos e Cotação em cartões com Salvar próprio.

`e2e/atendimento-lista.spec.ts`, teste "limites de espera em Configurações mudam a cor": `page.goto('/configuracoes#atendimento')` → `page.goto('/configuracoes?secao=espera')` (rótulos, botão "Salvar limites" e o aviso "Limites de espera salvos." não mudam).

`apps/painel/e2e/configuracoes-agente.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirSecao } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';

test('Modelos de IA: escolhe entre os modelos com preço, "antes" e grava', async ({ page }) => {
  const { data } = await db.from('configuracoes').select('modelo_rapido, precos_modelos').eq('id', 1).single();
  const outro = Object.keys(data!.precos_modelos as Record<string, unknown>).find((m) => m !== data!.modelo_rapido)!;
  await criarUsuarioTeste({ email: 'admin-modelos@e2e.local', senha: SENHA, nome: 'Admin Modelos', papel: 'admin' });
  try {
    await entrar(page, 'admin-modelos@e2e.local', SENHA);
    await abrirSecao(page, 'ia');
    const cartao = page.getByRole('region', { name: 'Modelos de IA' });
    await cartao.getByLabel('Tarefas rápidas').selectOption(outro, { timeout: 30_000 });
    await expect(cartao.getByText(/^antes: Claude /)).toBeVisible();
    await cartao.getByRole('button', { name: 'Salvar modelos' }).click();
    await expect(page.getByText('Modelos salvos.')).toBeVisible();
    await expect.poll(async () => (await db.from('configuracoes').select('modelo_rapido').eq('id', 1).single()).data?.modelo_rapido).toBe(outro);
  } finally {
    await db.from('configuracoes').update({ modelo_rapido: data!.modelo_rapido }).eq('id', 1);
  }
});

test('Mensagens: aviso do login com "antes" e Salvar próprio', async ({ page }) => {
  const antes = (await db.from('configuracoes').select('aviso_login').eq('id', 1).single()).data!.aviso_login;
  await criarUsuarioTeste({ email: 'admin-msg@e2e.local', senha: SENHA, nome: 'Admin Msg', papel: 'admin' });
  try {
    await entrar(page, 'admin-msg@e2e.local', SENHA);
    await abrirSecao(page, 'mensagens');
    const cartao = page.getByRole('region', { name: 'Aviso na tela de entrada' });
    await cartao.getByRole('textbox').fill('Recado e2e G1', { timeout: 30_000 });
    await expect(cartao.getByText(/^antes: /)).toBeVisible();
    await cartao.getByRole('button', { name: 'Salvar aviso' }).click();
    await expect(page.getByText('Aviso do login salvo.')).toBeVisible();
    await expect.poll(async () => (await db.from('configuracoes').select('aviso_login').eq('id', 1).single()).data?.aviso_login).toBe('Recado e2e G1');
  } finally {
    await db.from('configuracoes').update({ aviso_login: antes }).eq('id', 1);
  }
});

test('Configurações "Sim": não vê Teto, Modelos nem Cotação', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-ia@e2e.local', senha: SENHA, nome: 'Ana IA', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', ana).eq('modulo', 'configuracoes');
  await entrar(page, 'ana-ia@e2e.local', SENHA);
  await abrirSecao(page, 'ia');
  await expect(page.getByRole('region', { name: 'Expediente' })).toBeVisible({ timeout: 30_000 });
  for (const nome of ['Teto de IA e alertas', 'Modelos de IA', 'Cotação e custo da transcrição']) {
    await expect(page.getByRole('region', { name: nome })).toHaveCount(0);
  }
});
```

- [ ] **Passo 8: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/configuracoes-agente.spec.ts e2e/configuracoes.spec.ts e2e/atendimento-lista.spec.ts e2e/niveis-telas.spec.ts e2e/login.spec.ts e2e/identidade.spec.ts`
Expected: tudo verde.

- [ ] **Passo 9: commit**

```bash
git add -A apps/painel
git commit -m "feat(painel): Configurações › Agente e atendimento — mensagens, limites de espera, teto, modelos e cotação em cartões separados

O teste da cotação passa a achar o cartão Cotação e custo da transcrição (spec 7C.4: cada cartão com seu Salvar).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Painel. Respostas prontas com edição

**Files:**
- Modify: `apps/painel/src/app/(painel)/configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx}`
- Create: `apps/painel/src/app/(painel)/configuracoes/secoes/respostas.tsx`
- Modify: `apps/painel/e2e/configuracoes.spec.ts`

**Interfaces:**
- Consumes: política `escrita_configuracoes` de `respostas_prontas` (Parte D; inclui `update`).
- Produces: `RespostaForm`; `salvarResposta(id: string | null, fd) → Resultado` (cria ou edita pergunta, resposta e ativa); `SecaoRespostas({ respostas })`.

- [ ] **Passo 1: esquema — teste que falha**

```ts
describe('RespostaForm (Parte G1, D19)', () => {
  it('apara; ativa pela caixa', () => {
    expect(RespostaForm.parse({ pergunta: ' Horário? ', resposta: ' 8h às 18h ', ativo: true })).toEqual({ pergunta: 'Horário?', resposta: '8h às 18h', ativo: true });
  });
  it('pergunta curta ou resposta vazia: recusa', () => {
    expect(RespostaForm.safeParse({ pergunta: 'Oi', resposta: 'x', ativo: true }).error?.issues[0]?.message).toBe('A pergunta precisa de pelo menos 3 letras.');
    expect(RespostaForm.safeParse({ pergunta: 'Horário?', resposta: ' ', ativo: true }).error?.issues[0]?.message).toBe('Escreva a resposta.');
  });
});
```

Run → FAIL.

- [ ] **Passo 2: esquema e ação**

```ts
/** Resposta pronta (Configurações: Sim): o agente só usa as ativas. */
export const RespostaForm = z.object({
  pergunta: z.string().trim().min(3, 'A pergunta precisa de pelo menos 3 letras.').max(300, 'Até 300 letras.'),
  resposta: z.string().trim().min(1, 'Escreva a resposta.').max(2000, 'Até 2.000 letras.'),
  ativo: z.boolean(),
});
```

```ts
/** Cria (id null) ou edita uma resposta pronta. Nova nasce ativa. */
export async function salvarResposta(id: string | null, formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = RespostaForm.safeParse({
    pergunta: String(formData.get('pergunta') ?? ''), resposta: String(formData.get('resposta') ?? ''),
    ativo: id ? formData.get('ativo') !== null : true,
  });
  if (!v.success) return primeiroErro(v.error);
  const sb = await supabaseServidor();
  const { error } = id ? await sb.from('respostas_prontas').update(v.data).eq('id', id) : await sb.from('respostas_prontas').insert(v.data);
  if (error) return doBanco(error);
  recarregar();
  return ok(id ? 'Resposta pronta salva.' : 'Resposta pronta adicionada.');
}
```

(`removerResposta` não muda.)

- [ ] **Passo 3: `secoes/respostas.tsx`**

```tsx
import { MessageSquareText, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { EmptyState } from '@/components/patterns/empty-state';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { classeCaixa } from '../../clientes/estilos';
import { removerResposta, salvarResposta } from '../acoes';
import { Cartao } from '../cartao';
import { AcoesLinhaConfig, FormularioConfig, SalvarConfig } from '../formulario-config';

type Resposta = { id: string; pergunta: string; resposta: string; ativo: boolean };

/** Respostas prontas, agora editáveis (spec 7C.4). Remover fica fora do formulário (um form não vai dentro de outro). */
export function SecaoRespostas({ respostas }: { respostas: Resposta[] }) {
  return (
    <Cartao id="respostas" titulo="Respostas prontas" descricao="O agente só responde sozinho o que estiver aqui e ativo (além de saudações e andamento de demandas).">
      <CardContent>
        {respostas.length === 0 ? (
          <EmptyState icone={MessageSquareText} titulo="Nenhuma resposta pronta." descricao="Adicione abaixo as perguntas que o agente pode responder sozinho." className="py-6" />
        ) : (
          <ul className="flex flex-col gap-3">
            {respostas.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-md border border-border p-3">
                <FormularioConfig acao={salvarResposta.bind(null, r.id)} rotulo={`Resposta pronta: ${r.pergunta}`} className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input name="pergunta" defaultValue={r.pergunta} aria-label={`Pergunta: ${r.pergunta}`} required minLength={3} maxLength={300} className="font-medium" />
                  <Textarea name="resposta" defaultValue={r.resposta} aria-label={`Resposta para: ${r.pergunta}`} required maxLength={2000} rows={2} className="min-h-16" />
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-base text-foreground">
                      <input type="checkbox" name="ativo" defaultChecked={r.ativo} className={classeCaixa} /> ativa
                    </label>
                    <AcoesLinhaConfig rotulo={`Salvar a resposta pronta: ${r.pergunta}`} descartar={`Descartar alterações da resposta: ${r.pergunta}`} />
                  </div>
                </FormularioConfig>
                <ConfirmDialog
                  gatilho={(
                    <Button type="button" variant="ghost" size="icon" aria-label={`Remover a resposta pronta: ${r.pergunta}`} className="size-8 shrink-0 text-muted hover:text-danger">
                      <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                    </Button>
                  )}
                  titulo="Remover resposta pronta?"
                  descricao={<>O agente deixa de responder sozinho a <strong className="font-medium text-foreground">{r.pergunta}</strong>.</>}
                  confirmar="Remover"
                  enviando="Removendo…"
                  acao={removerResposta.bind(null, r.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={salvarResposta.bind(null, null)} rotulo="Nova resposta pronta" limparAoSalvar className="flex w-full flex-col gap-2">
          <Input name="pergunta" placeholder="Pergunta (ex.: Qual o horário de atendimento?)" aria-label="Pergunta" required minLength={3} maxLength={300} />
          <Textarea name="resposta" placeholder="Resposta" aria-label="Resposta" required maxLength={2000} rows={2} className="min-h-16" />
          <SalvarConfig className="w-fit">Adicionar resposta</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
```

Na página, troque o bloco `<Secao id="respostas" …>…</Secao>` por `<SecaoRespostas respostas={respostas ?? []} />` e tire os imports sem uso (`MessageSquareText`, `Trash2`, `removerResposta`, `salvarResposta`, `EmptyState`…).

- [ ] **Passo 4: e2e**

Em `e2e/configuracoes.spec.ts`, troque o teste "administrador cria resposta pronta" por:

```ts
test('administrador cria, edita, desliga e remove resposta pronta', async ({ page }) => {
  await db.from('respostas_prontas').delete().in('pergunta', ['Qual o horário?', 'Qual o horário de vocês?']);
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await abrirSecao(page, 'respostas');
  await page.getByPlaceholder('Pergunta (ex.: Qual o horário de atendimento?)').fill('Qual o horário?', { timeout: 30_000 });
  await page.getByPlaceholder('Resposta', { exact: true }).fill('De segunda a sexta, das 8h às 18h.');
  await page.getByRole('button', { name: 'Adicionar resposta' }).click();
  await expect(page.getByText('Resposta pronta adicionada.')).toBeVisible();
  const linha = page.getByRole('form', { name: 'Resposta pronta: Qual o horário?' });
  await expect(linha.getByRole('textbox', { name: 'Resposta para: Qual o horário?' })).toHaveValue('De segunda a sexta, das 8h às 18h.');
  await expect(page.getByPlaceholder('Resposta', { exact: true })).toHaveValue('');
  // Editar: pergunta nova e desligada.
  await linha.getByRole('textbox', { name: 'Pergunta: Qual o horário?' }).fill('Qual o horário de vocês?');
  await linha.getByRole('checkbox', { name: 'ativa' }).uncheck();
  await linha.getByRole('button', { name: 'Salvar a resposta pronta: Qual o horário?' }).click();
  await expect(page.getByText('Resposta pronta salva.')).toBeVisible();
  await expect.poll(async () => (await db.from('respostas_prontas').select('pergunta, ativo').eq('pergunta', 'Qual o horário de vocês?').maybeSingle()).data)
    .toEqual({ pergunta: 'Qual o horário de vocês?', ativo: false });
  await page.getByRole('button', { name: 'Remover a resposta pronta: Qual o horário de vocês?' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remover' }).click();
  await expect(page.getByRole('form', { name: 'Resposta pronta: Qual o horário de vocês?' })).toHaveCount(0);
});
```

(import de `abrirSecao`.) Motivo no commit: a resposta agora fica num campo editável, não em texto solto.

- [ ] **Passo 5: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/configuracoes.spec.ts`
Expected: tudo verde.

- [ ] **Passo 6: commit**

```bash
git add apps/painel
git commit -m "feat(painel): respostas prontas editáveis (pergunta, resposta e ativa)

O teste de criar resposta pronta lê o campo editável no lugar do texto.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Painel. Cadastros e Sistema: Setores, Serviços, Cargos e Integrações

**Files:**
- Modify: `apps/painel/src/app/(painel)/configuracoes/{acoes.ts,esquemas.ts,esquemas.test.ts,page.tsx}`
- Create: `apps/painel/src/app/(painel)/configuracoes/secoes/{setores,servicos,cargos,integracoes}.tsx`
- Modify: `apps/painel/src/lib/usuarios.ts`, `usuarios.test.ts`, `apps/painel/src/app/(painel)/usuarios/novo/page.tsx`, `usuarios/[id]/page.tsx`
- Create: `apps/painel/e2e/configuracoes-cadastros.spec.ts`

**Interfaces:**
- Consumes: `configuracoes.cargos` (Task 2), `CampoNomeUnico`, `HealthSignal`, `RecarregarPeriodico`, `LIMITES_BATIMENTO`.
- Produces: `SetorForm`, `ServicoForm`, `CargosForm`; `salvarSetor`, `salvarServico`, `salvarCargos` → `Resultado`; `SecaoSetores`, `SecaoServicos`, `SecaoCargos({ cfg, admin })`, `SecaoIntegracoes({ sinal })`; `sugestoesDeCargo(usados, lista = CARGOS_SUGERIDOS)`.

- [ ] **Passo 1: testes que falham**

`esquemas.test.ts`:

```ts
describe('CargosForm (Parte G1, D10)', () => {
  it('um por linha; aparado; sem vazias', () => {
    expect(CargosForm.parse({ cargos: ' Auxiliar \r\nAnalista\n\nSócio ' })).toEqual(['Auxiliar', 'Analista', 'Sócio']);
  });
  it('repetido (ignora maiúsculas), longo demais, mais de 30: recusa', () => {
    expect(CargosForm.safeParse({ cargos: 'Analista\nanalista' }).error?.issues[0]?.message).toBe('Há cargo repetido na lista.');
    expect(CargosForm.safeParse({ cargos: 'a'.repeat(61) }).error?.issues[0]?.message).toBe('Cada cargo tem até 60 letras.');
    expect(CargosForm.safeParse({ cargos: Array.from({ length: 31 }, (_, i) => `C${i}`).join('\n') }).error?.issues[0]?.message).toBe('Até 30 cargos.');
  });
});
describe('SetorForm e ServicoForm', () => {
  it('nome obrigatório', () => {
    expect(SetorForm.safeParse({ nome: ' ', descricao_assuntos: '' }).error?.issues[0]?.message).toBe('Dê um nome ao setor.');
    expect(ServicoForm.safeParse({ nome: '', setor_id: null }).error?.issues[0]?.message).toBe('Dê um nome ao serviço.');
  });
});
```

`lib/usuarios.test.ts`:

```ts
  it('cargos: a lista de Configurações no lugar das quatro de sempre (Parte G1)', () => {
    expect(sugestoesDeCargo(['Contadora', null], ['Auxiliar', 'Estagiário'])).toEqual(['Auxiliar', 'Estagiário', 'Contadora']);
  });
```

Run → FAIL.

- [ ] **Passo 2: esquemas, ações e `sugestoesDeCargo`**

`esquemas.ts`:

```ts
export const SetorForm = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao setor.').max(60, 'Até 60 letras.'),
  descricao_assuntos: z.string().trim().max(500, 'Até 500 letras.'),
});
export const ServicoForm = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao serviço.').max(80, 'Até 80 letras.'),
  setor_id: z.string().uuid().nullable(),
});
/** Cargos, um por linha (D10). A mesma regra do banco (cargos_validos). */
export const CargosForm = z.object({ cargos: z.string() })
  .transform(({ cargos }) => cargos.replace(/\r\n/g, '\n').split('\n').map((c) => c.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(60, 'Cada cargo tem até 60 letras.')).max(30, 'Até 30 cargos.')
    .refine((l) => new Set(l.map((c) => c.toLocaleLowerCase('pt-BR'))).size === l.length, 'Há cargo repetido na lista.'));
```

`acoes.ts`:

```ts
export async function salvarSetor(id: string | null, formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = SetorForm.safeParse({ nome: String(formData.get('nome') ?? ''), descricao_assuntos: String(formData.get('descricao_assuntos') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const dados = { ...v.data, ativo: formData.get('ativo') !== null || !id };
  const sb = await supabaseServidor();
  const { error } = id ? await sb.from('setores').update(dados).eq('id', id) : await sb.from('setores').insert(dados);
  if (error) return doBanco(error);
  recarregar();
  return ok(id ? 'Setor salvo.' : 'Setor criado.');
}

export async function salvarServico(id: string | null, formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = ServicoForm.safeParse({ nome: String(formData.get('nome') ?? ''), setor_id: String(formData.get('setor_id') || '') || null });
  if (!v.success) return primeiroErro(v.error);
  const dados = { ...v.data, ativo: formData.get('ativo') !== null || !id };
  const sb = await supabaseServidor();
  const { error } = id ? await sb.from('servicos').update(dados).eq('id', id) : await sb.from('servicos').insert(dados);
  if (error) return doBanco(error);
  recarregar();
  return ok(id ? 'Serviço salvo.' : 'Serviço criado.');
}

/** Lista de cargos da ficha da pessoa (D10): Configurações: Sim; o banco confere de novo (cargos_validos). */
export async function salvarCargos(formData: FormData): Promise<Resultado> {
  await exigirConfiguracoes();
  const v = CargosForm.safeParse({ cargos: String(formData.get('cargos') ?? '') });
  if (!v.success) return primeiroErro(v.error);
  const { error } = await (await supabaseServidor()).from('configuracoes').update({ cargos: v.data }).eq('id', 1);
  if (error) return doBanco(error);
  recarregar();
  revalidatePath('/usuarios');
  return ok('Cargos salvos.');
}
```

`lib/usuarios.ts`:

```ts
/** Cargo é informativo (spec 7.1): a lista de Configurações › Cargos (D10) mais os cargos já usados. */
export function sugestoesDeCargo(usados: (string | null)[], lista: string[] = CARGOS_SUGERIDOS): string[] {
  const outros = usados.map((c) => c?.trim() ?? '').filter((c) => c !== '');
  return [...new Set([...lista, ...outros])];
}
```

Em `usuarios/novo/page.tsx` e `usuarios/[id]/page.tsx`, acrescente ao `Promise.all` `sb.from('configuracoes').select('cargos').eq('id', 1).maybeSingle()` e passe `sugestoesDeCargo(usados, cfgCargos?.cargos ?? undefined)` (homologação sem a migração: a leitura falha e vale a lista padrão, D25).

- [ ] **Passo 3: `secoes/setores.tsx`**

```tsx
import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { classeCaixa } from '../../clientes/estilos';
import { salvarSetor } from '../acoes';
import { CampoNomeUnico } from '../campos-validados';
import { Cartao } from '../cartao';
import { AcoesLinhaConfig, FormularioConfig, SalvarConfig } from '../formulario-config';

type Setor = { id: string; nome: string; descricao_assuntos: string; ativo: boolean };

/** Setores (Configurações: Sim): cadastra, altera e desativa; excluir de vez continua só do administrador (Parte B). */
export function SecaoSetores({ setores }: { setores: Setor[] }) {
  const nomes = setores.map((s) => s.nome);
  return (
    <Cartao id="setores" titulo="Setores" descricao="O agente usa a descrição dos assuntos para decidir para qual setor mandar cada demanda.">
      <CardContent className="flex flex-col gap-2">
        {setores.map((s) => (
          <FormularioConfig key={s.id} acao={salvarSetor.bind(null, s.id)} rotulo={`Setor ${s.nome}`} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
            <CampoNomeUnico outros={nomes.filter((n) => n !== s.nome)} mensagem="Já existe um setor com este nome." name="nome" defaultValue={s.nome} aria-label={`Nome do setor ${s.nome}`} required maxLength={60} className="sm:w-40" />
            <Input name="descricao_assuntos" defaultValue={s.descricao_assuntos} aria-label={`Assuntos do setor ${s.nome}`} placeholder="Assuntos deste setor" maxLength={500} className="sm:flex-1" />
            <label className="flex items-center gap-2 text-base text-foreground">
              <input type="checkbox" name="ativo" defaultChecked={s.ativo} className={classeCaixa} /> ativo
            </label>
            <AcoesLinhaConfig rotulo={`Salvar setor ${s.nome}`} descartar={`Descartar alterações do setor ${s.nome}`} />
          </FormularioConfig>
        ))}
        {setores.length === 0 && <p className="text-sm text-muted">Nenhum setor ainda. Crie o primeiro abaixo.</p>}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={salvarSetor.bind(null, null)} rotulo="Novo setor" limparAoSalvar className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <CampoNomeUnico outros={nomes} mensagem="Já existe um setor com este nome." name="nome" placeholder="Novo setor" aria-label="Nome do novo setor" required maxLength={60} className="sm:w-40" />
          <Input name="descricao_assuntos" placeholder="Assuntos deste setor" aria-label="Assuntos do novo setor" maxLength={500} className="sm:flex-1" />
          <SalvarConfig>Criar setor</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
```

- [ ] **Passo 4: `secoes/servicos.tsx`**

```tsx
import { CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { classeCaixa, classeSelect } from '../../clientes/estilos';
import { salvarServico } from '../acoes';
import { CampoNomeUnico } from '../campos-validados';
import { Cartao } from '../cartao';
import { AcoesLinhaConfig, FormularioConfig, SalvarConfig } from '../formulario-config';

type Servico = { id: string; nome: string; setor_id: string | null; ativo: boolean };

/** Serviços do contrato de cada empresa e o setor que cuida de cada um (Configurações: Sim). */
export function SecaoServicos({ servicos, setores }: { servicos: Servico[]; setores: { id: string; nome: string; ativo: boolean }[] }) {
  const nomes = servicos.map((s) => s.nome);
  const semSetor = servicos.filter((s) => !s.setor_id).length;
  const opcoes = setores.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.ativo ? '' : ' (inativo)'}</option>);
  return (
    <Cartao
      id="servicos"
      titulo="Serviços do escritório"
      descricao={<>Os serviços do contrato de cada empresa e o setor que cuida de cada um.{semSetor > 0 && <strong className="font-semibold text-warning"> {semSetor === 1 ? '1 serviço está sem setor.' : `${semSetor} serviços estão sem setor.`}</strong>}</>}
    >
      <CardContent className="flex flex-col gap-2">
        {servicos.map((s) => (
          <FormularioConfig key={s.id} acao={salvarServico.bind(null, s.id)} rotulo={`Serviço ${s.nome}`} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
            <CampoNomeUnico outros={nomes.filter((n) => n !== s.nome)} mensagem="Já existe um serviço com este nome." name="nome" defaultValue={s.nome} aria-label={`Nome do serviço ${s.nome}`} required maxLength={80} className="sm:flex-1" />
            <select name="setor_id" defaultValue={s.setor_id ?? ''} aria-label={`Setor do serviço ${s.nome}`} className={cn(classeSelect, 'sm:w-48')}>
              <option value="">Sem setor</option>
              {opcoes}
            </select>
            <label className="flex items-center gap-2 text-base text-foreground">
              <input type="checkbox" name="ativo" defaultChecked={s.ativo} className={classeCaixa} /> ativo
            </label>
            <AcoesLinhaConfig rotulo={`Salvar serviço ${s.nome}`} descartar={`Descartar alterações do serviço ${s.nome}`} />
          </FormularioConfig>
        ))}
        {servicos.length === 0 && <p className="text-sm text-muted">Nenhum serviço ainda. Crie o primeiro abaixo.</p>}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={salvarServico.bind(null, null)} rotulo="Novo serviço" limparAoSalvar className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <CampoNomeUnico outros={nomes} mensagem="Já existe um serviço com este nome." name="nome" placeholder="Novo serviço (ex.: Folha de pagamento)" aria-label="Nome do novo serviço" required maxLength={80} className="sm:flex-1" />
          <select name="setor_id" aria-label="Setor do novo serviço" className={cn(classeSelect, 'sm:w-48')}>
            <option value="">Sem setor</option>
            {opcoes}
          </select>
          <SalvarConfig>Criar serviço</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
```

- [ ] **Passo 5: `secoes/cargos.tsx` e `secoes/integracoes.tsx`**

```tsx
// secoes/cargos.tsx
import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { CARGOS_SUGERIDOS } from '@/lib/usuarios';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarCargos } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

/** Quantas pessoas ativas usam cada cargo (só o administrador lê a equipe). */
async function cargosEmUso(): Promise<[string, number][]> {
  const { data } = await (await supabaseServidor()).from('usuarios').select('cargo').eq('ativo', true).not('cargo', 'is', null);
  const conta = new Map<string, number>();
  for (const u of data ?? []) if (u.cargo) conta.set(u.cargo, (conta.get(u.cargo) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

/** Lista de cargos da ficha da pessoa (spec 7.1 e seção 9, D10). Configurações: Sim. */
export async function SecaoCargos({ cfg, admin }: { cfg: Config; admin: boolean }) {
  const cargos = cfg.cargos ?? CARGOS_SUGERIDOS;
  const emUso = admin ? await cargosEmUso() : [];
  return (
    <FormularioConfig acao={salvarCargos} rotulo="Cargos">
      <Cartao id="cargos" titulo="Cargos" descricao="A lista que o campo Cargo da ficha da pessoa sugere. É só informativo: mudar aqui não muda o cargo de quem já tem.">
        <CardContent className="flex flex-col gap-3">
          <div>
            <FormField id="cargos" rotulo="Cargos (um por linha)" ajuda="Até 30 cargos, cada um com até 60 letras.">
              <Textarea name="cargos" rows={Math.min(12, Math.max(4, cargos.length + 1))} defaultValue={cargos.join('\n')} />
            </FormField>
            <Antes campo="cargos" texto={cargos.join(', ') || 'nenhum'} />
          </div>
          {emUso.length > 0 && <p className="text-sm text-muted">Em uso na equipe: {emUso.map(([c, n]) => `${c} (${n})`).join(', ')}.</p>}
        </CardContent>
        <RodapeConfig salvar="Salvar cargos" />
      </Cartao>
    </FormularioConfig>
  );
}
```

```tsx
// secoes/integracoes.tsx
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { HealthSignal } from '@/components/patterns/health-signal';
import { CardContent } from '@/components/ui/card';
import { LIMITES_BATIMENTO } from '@/lib/inicio';
import { Cartao } from '../cartao';

/** Último sinal de cada serviço (só o administrador, D20). Recarrega a cada minuto com a aba visível. */
export function SecaoIntegracoes({ sinal }: { sinal: (componente: string) => string | null }) {
  return (
    <>
      <RecarregarPeriodico />
      <Cartao id="integracoes" titulo="Integrações" descricao="Último sinal de cada serviço. Sem sinal há mais de 5 minutos, algo parou.">
        <CardContent className="flex flex-col gap-2">
          <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={sinal('whatsapp')} limites={LIMITES_BATIMENTO} />
          {!sinal('whatsapp') && <p className="text-sm text-muted">Sem sinal do WhatsApp: verifique a Z-API.</p>}
          <HealthSignal rotulo="Trabalhador e fila de tarefas" ultimoSinal={sinal('fila')} limites={LIMITES_BATIMENTO} />
        </CardContent>
      </Cartao>
    </>
  );
}
```

Na página: troque os blocos de Setores, Serviços e Integrações pelos componentes (`<SecaoSetores setores={setores ?? []} />`, `<SecaoServicos servicos={servicos ?? []} setores={setores ?? []} />`, `{admin && <SecaoIntegracoes sinal={sinal} />}`), acrescente `<SecaoCargos cfg={cfg} admin={admin} />` depois de Serviços e `{ id: 'cargos', rotulo: 'Cargos' }` na lista `SECOES` de hoje; tire o `RecarregarPeriodico` do topo e os imports sem uso. O `Secao` e o `RodapeSalvar` locais ficam sem uso: apague.

- [ ] **Passo 6: e2e**

`apps/painel/e2e/configuracoes-cadastros.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirSecao } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';

test('Cargos: lista nova aparece na ficha da pessoa', async ({ page }) => {
  const antes = (await db.from('configuracoes').select('cargos').eq('id', 1).single()).data!.cargos;
  await criarUsuarioTeste({ email: 'admin-cargos@e2e.local', senha: SENHA, nome: 'Admin Cargos', papel: 'admin' });
  try {
    await entrar(page, 'admin-cargos@e2e.local', SENHA);
    await abrirSecao(page, 'cargos');
    const cartao = page.getByRole('region', { name: 'Cargos' });
    await cartao.getByLabel('Cargos (um por linha)').fill('Auxiliar\nAnalista\nEstagiário e2e', { timeout: 30_000 });
    await cartao.getByRole('button', { name: 'Salvar cargos' }).click();
    await expect(page.getByText('Cargos salvos.')).toBeVisible();
    await page.goto('/usuarios/novo');
    await expect(page.locator('datalist option[value="Estagiário e2e"]')).toHaveCount(1, { timeout: 30_000 });
    // Repetido: o erro aparece e o digitado fica.
    await abrirSecao(page, 'cargos');
    await cartao.getByLabel('Cargos (um por linha)').fill('Analista\nanalista', { timeout: 30_000 });
    await cartao.getByRole('button', { name: 'Salvar cargos' }).click();
    await expect(cartao.getByRole('alert')).toHaveText('Há cargo repetido na lista.');
    await expect(cartao.getByLabel('Cargos (um por linha)')).toHaveValue('Analista\nanalista');
  } finally {
    await db.from('configuracoes').update({ cargos: antes }).eq('id', 1);
  }
});

test('Setores: renomear com Descartar e Salvar da linha', async ({ page }) => {
  await db.from('setores').delete().in('nome', ['Setor e2e G1', 'Setor e2e G1 novo']);
  await db.from('setores').insert({ nome: 'Setor e2e G1' });
  await criarUsuarioTeste({ email: 'admin-setor@e2e.local', senha: SENHA, nome: 'Admin Setor', papel: 'admin' });
  try {
    await entrar(page, 'admin-setor@e2e.local', SENHA);
    await abrirSecao(page, 'setores');
    const linha = page.getByRole('form', { name: 'Setor Setor e2e G1' });
    const nome = linha.getByLabel('Nome do setor Setor e2e G1');
    await nome.fill('Setor e2e G1 novo', { timeout: 30_000 });
    await expect(linha.getByText('Não salvo')).toBeVisible();
    await linha.getByRole('button', { name: 'Descartar alterações do setor Setor e2e G1' }).click();
    await expect(nome).toHaveValue('Setor e2e G1');
    await nome.fill('Setor e2e G1 novo');
    await linha.getByRole('button', { name: 'Salvar setor Setor e2e G1' }).click();
    await expect(page.getByText('Setor salvo.')).toBeVisible();
    await expect.poll(async () => (await db.from('setores').select('id').eq('nome', 'Setor e2e G1 novo')).data?.length).toBe(1);
  } finally {
    await db.from('setores').delete().in('nome', ['Setor e2e G1', 'Setor e2e G1 novo']);
  }
});
```

- [ ] **Passo 7: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/configuracoes-cadastros.spec.ts e2e/configuracoes.spec.ts e2e/usuarios-ficha.spec.ts e2e/niveis-telas.spec.ts e2e/arquivar-cadastros.spec.ts`
Expected: tudo verde.

- [ ] **Passo 8: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Configurações › Cadastros e Sistema — setores e serviços com descartar, cargos editáveis, integrações

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Painel. Uma seção por vez: menu em grupos com resumos, trilha e links

**Files:**
- Modify: `apps/painel/src/app/(painel)/configuracoes/page.tsx`, `loading.tsx`
- Create: `apps/painel/src/app/(painel)/configuracoes/menu-secoes.tsx`
- Delete: `apps/painel/src/app/(painel)/configuracoes/navegacao-secoes.tsx`
- Modify: `apps/painel/src/components/layout/{trilha.ts,trilha.test.ts,topbar.tsx,atalhos-menu.tsx}`, `apps/painel/src/lib/{menu.ts,menu.test.ts}`, `apps/painel/src/app/(painel)/gastos-ia/{page.tsx,cartoes.tsx}`, `apps/painel/src/app/(painel)/_design/menu-exemplo.tsx`
- Create: `apps/painel/e2e/configuracoes-secoes.spec.ts`
- Modify: `apps/painel/e2e/{menu.spec.ts,niveis-telas.spec.ts,configuracoes.spec.ts}`

**Interfaces:**
- Consumes: as seções das Tasks 5 a 9; `resumosDasSecoes`, `secaoDaUrl`, `secaoDoHash`, `rotuloDaSecao`, `hrefSecao`; `useAlgumAlterado`.
- Produces: `/configuracoes?secao=<id>` (redireciona quando a seção pedida não vale, D12); `MenuSecoes({ itens, atual, linkUsuarios })`; `trilhaDaRota(pathname, secao?)`.

- [ ] **Passo 1: trilha e menu — testes que falham**

`trilha.test.ts`:

```ts
  it('Configurações mostra a seção (Parte G1, D22)', () => {
    expect(trilhaDaRota('/configuracoes', 'prazos')).toEqual([{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Prazos' }]);
    expect(trilhaDaRota('/configuracoes', null)).toEqual([{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Expediente' }]);
    expect(trilhaDaRota('/configuracoes', 'teto-ia')).toEqual([{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Teto e modelos de IA' }]);
  });
```

e troque o caso `['/configuracoes', [{ rotulo: 'Configurações' }]]` da tabela pelo novo formato (sem `secao`, a trilha leva "Expediente").

`menu.test.ts`: no teste "Configurações para quem tem Sim", acrescente `expect(conf.filhos!.find((f) => f.rotulo === 'Setores')?.href).toBe('/configuracoes?secao=setores');` e `expect(conf.filhos!.map((f) => f.rotulo)).not.toContain('Teto e modelos de IA');`; num teste do administrador, `expect(adminConf.filhos!.map((f) => f.rotulo)).toContain('Teto e modelos de IA')`.

Run: `pnpm --filter @escritorio/painel test -- trilha menu` → FAIL.

- [ ] **Passo 2: trilha, topo, menu e links**

`trilha.ts`:

```ts
import { rotuloDaSecao } from '@/lib/configuracoes';
// …
export function trilhaDaRota(pathname: string, secao?: string | null): PassoTrilha[] {
  // Configurações: uma seção por vez (?secao=, Parte G1); sem secao, a página abre no Expediente.
  if (pathname === '/configuracoes') {
    return [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: rotuloDaSecao(secao ?? 'expediente') ?? 'Expediente' }];
  }
  // … o resto não muda
}
```

`topbar.tsx`: separe o desenho dos passos num `TrilhaPassos({ passos })` (o JSX de hoje) e:

```tsx
/** A seção de Configurações vem da busca (?secao=); useSearchParams pede Suspense. */
function TrilhaComSecao() {
  return <TrilhaPassos passos={trilhaDaRota(usePathname(), useSearchParams().get('secao'))} />;
}
function Trilha() {
  const pathname = usePathname();
  return (
    <Suspense fallback={<TrilhaPassos passos={trilhaDaRota(pathname)} />}>
      <TrilhaComSecao />
    </Suspense>
  );
}
```

(imports `Suspense` de `react` e `useSearchParams` de `next/navigation`.)

`lib/menu.ts`:

```ts
import { hrefSecao } from './configuracoes';

const SUBMENU_CONFIGURACOES: ItemMenu[] = [
  { rotulo: 'Usuários e permissões', href: '/usuarios' },
  { rotulo: 'Expediente', href: hrefSecao('expediente') },
  { rotulo: 'Prazos', href: hrefSecao('prazos') },
  { rotulo: 'Mensagens', href: hrefSecao('mensagens') },
  { rotulo: 'Respostas prontas', href: hrefSecao('respostas') },
  { rotulo: 'Setores', href: hrefSecao('setores') },
  { rotulo: 'Teto e modelos de IA', href: hrefSecao('ia') },
];
// "Configurações: Sim" sem ser administrador (P12): sem Usuários e permissões e sem a seção de IA.
const SUBMENU_SEM_USUARIOS = SUBMENU_CONFIGURACOES.filter((i) => i.href !== '/usuarios' && i.href !== hrefSecao('ia'));
```

`atalhos-menu.tsx`: `href="/configuracoes#integracoes"` → `href="/configuracoes?secao=integracoes"`. `e2e/menu.spec.ts`: o `toHaveAttribute('href', …)` acompanha. `gastos-ia/page.tsx` e `gastos-ia/cartoes.tsx`: `/configuracoes#teto-ia` → `/configuracoes?secao=ia`. `_design/menu-exemplo.tsx`: `/configuracoes#setores` → `/configuracoes?secao=setores`. Confira com `grep -rn "configuracoes#" apps/painel/src apps/painel/e2e` que não sobrou nenhum.

- [ ] **Passo 3: `menu-secoes.tsx`**

```tsx
'use client';

import {
  BriefcaseBusiness, CalendarOff, Clock, Cpu, ExternalLink, Hourglass, IdCard, MessageSquareText, MessagesSquare, Network, Plug, Timer, Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAlgumAlterado } from '@/components/patterns/formulario-alteravel';
import { cn } from '@/lib/cn';
import { GRUPOS_CONFIG, hrefSecao, secaoDoHash, type GrupoSecao, type IdSecao } from '@/lib/configuracoes';

export type ItemMenuConfig = { id: IdSecao; rotulo: string; grupo: GrupoSecao; contagem?: number; resumo: string; atencao?: boolean };

const ICONE: Record<IdSecao, LucideIcon> = {
  expediente: Clock, prazos: Hourglass, feriados: CalendarOff, mensagens: MessageSquareText, respostas: MessagesSquare,
  espera: Timer, ia: Cpu, setores: Network, servicos: BriefcaseBusiness, cargos: IdCard, integracoes: Plug,
};
const ITEM = 'flex items-start gap-3 border-l-2 px-4 py-2 text-base text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted';

/**
 * Menu de Configurações (spec 7C.4, imagem 00-configuracoes-opcao-a): grupos, contagem, resumo do valor de hoje em letra
 * pequena (ideia da B) e "não salvo" na seção aberta quando há alteração pendente (D13). Uma seção por vez (?secao=).
 */
export function MenuSecoes({ itens, atual, linkUsuarios }: { itens: ItemMenuConfig[]; atual: IdSecao; linkUsuarios: boolean }) {
  const naoSalvo = useAlgumAlterado();
  const router = useRouter();
  // Link de antes com âncora (/configuracoes#teto-ia, atalho do WhatsApp antigo): abre a seção certa (D12).
  useEffect(() => {
    const id = secaoDoHash(window.location.hash);
    if (id && id !== atual && !new URLSearchParams(window.location.search).has('secao')) router.replace(hrefSecao(id));
  }, [atual, router]);
  return (
    <nav aria-label="Seções das configurações" className="rounded-lg border border-border bg-surface py-1 lg:sticky lg:abaixo-cabecalho lg:w-64 lg:shrink-0">
      {GRUPOS_CONFIG.map((grupo) => {
        const doGrupo = itens.filter((i) => i.grupo === grupo);
        const comUsuarios = grupo === 'Sistema' && linkUsuarios;
        if (doGrupo.length === 0 && !comUsuarios) return null;
        return (
          <div key={grupo} className="border-b border-border py-2 last:border-b-0">
            <h2 className="px-4 pb-1 pt-2 text-xs font-extrabold uppercase tracking-wider text-brand">{grupo}</h2>
            <ul>
              {doGrupo.map((i) => {
                const Icone = ICONE[i.id];
                const aqui = i.id === atual;
                return (
                  <li key={i.id}>
                    <Link
                      href={hrefSecao(i.id)}
                      aria-current={aqui ? 'page' : undefined}
                      className={cn(ITEM, aqui ? 'border-brand bg-brand-soft font-bold text-brand hover:bg-brand-soft' : 'border-transparent')}
                    >
                      <Icone aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block">{i.rotulo}</span>
                        {i.resumo && (
                          <span title={i.resumo} className={cn('hidden truncate text-xs font-normal lg:block', i.atencao ? 'text-warning' : 'text-muted')}>{i.resumo}</span>
                        )}
                      </span>
                      {aqui && naoSalvo ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-warning">
                          <span aria-hidden className="size-2 rounded-full bg-warning" />
                          não salvo
                        </span>
                      ) : i.contagem !== undefined ? (
                        <span className="tabular shrink-0 text-sm font-normal text-muted">{i.contagem}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
              {comUsuarios && (
                <li>
                  <Link href="/usuarios" className={cn(ITEM, 'border-transparent')}>
                    <Users aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <span className="flex-1">Usuários e permissões</span>
                    <ExternalLink aria-hidden size={14} strokeWidth={1.75} className="mt-1 shrink-0 text-muted" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
```

(Se algum ícone não existir nesta versão do lucide, o typecheck acusa: troque por um próximo, ex. `Briefcase`, `IdCard` → `Contact`.)

- [ ] **Passo 4: `page.tsx` (uma seção por vez)**

Substitua o arquivo inteiro:

```tsx
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { hojeSP, hrefSecao, resumosDasSecoes, secaoDaUrl, secoesDe, type IdSecao } from '@/lib/configuracoes';
import { LIMITES_BATIMENTO, situacaoTeto } from '@/lib/inicio';
import { exigirConfiguracoes } from '@/lib/sessao';
import { situacaoDoSinal } from '@/lib/sinal-vida';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { gastoDoMes } from '../inicio/gasto-do-mes';
import { MenuSecoes } from './menu-secoes';
import { SecaoCargos } from './secoes/cargos';
import { SecaoEspera } from './secoes/espera';
import { SecaoExpediente } from './secoes/expediente';
import { SecaoFeriados } from './secoes/feriados';
import { SecaoIa } from './secoes/ia';
import { SecaoIntegracoes } from './secoes/integracoes';
import { SecaoMensagens } from './secoes/mensagens';
import { SecaoPrazos } from './secoes/prazos';
import { SecaoRespostas } from './secoes/respostas';
import { SecaoServicos } from './secoes/servicos';
import { SecaoSetores } from './secoes/setores';

/** Configurações (spec 7C.4): menu por seção à esquerda e uma seção por vez (?secao=). */
export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ secao?: string | string[] }> }) {
  const { secao: pedida } = await searchParams;
  const u = await exigirConfiguracoes();
  // "Configurações: Sim" (P12 da Parte D): teto e modelos de IA, integrações e usuários continuam só do administrador.
  const admin = u.papel === 'admin';
  const secao = secaoDaUrl(pedida, admin);
  // A URL sempre diz o que está na tela (D12): seção pedida que não vale para a pessoa vira Expediente.
  if (pedida !== undefined && (Array.isArray(pedida) ? pedida[0] : pedida) !== secao.id) redirect(hrefSecao(secao.id));
  const sb = await supabaseServidor();
  const agora = new Date();
  const [{ data: cfg }, { data: setores }, { data: servicos }, { data: respostas }, { data: feriados }, { data: sinais }, gasto] = await Promise.all([
    sb.from('configuracoes').select('*').eq('id', 1).single(),
    sb.from('setores').select('*').order('nome'),
    sb.from('servicos').select('*').order('nome'),
    sb.from('respostas_prontas').select('*').order('pergunta'),
    sb.from('feriados').select('*').order('data'),
    admin ? sb.from('sinais_vida').select('*') : Promise.resolve({ data: null }),
    admin ? gastoDoMes(sb, u.id, agora) : Promise.resolve(null),
  ]);
  if (!cfg) throw new Error('Não consegui ler as configurações.');
  const hoje = hojeSP(agora);
  const teto = gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)) : null;
  const sinal = (c: string) => sinais?.find((s) => s.componente === c)?.visto_em ?? null;
  const resumos = resumosDasSecoes({
    cfg: { ...cfg, teto_ia_usd: Number(cfg.teto_ia_usd), cargos: cfg.cargos ?? [] },
    feriados: feriados ?? [], respostas: respostas ?? [], setores: setores ?? [], servicos: servicos ?? [],
    fracaoTeto: teto?.fracao ?? null,
    integracoesOk: admin ? ['whatsapp', 'fila'].every((c) => situacaoDoSinal(sinal(c), agora, LIMITES_BATIMENTO) === 'ok') : null,
    hoje,
  });
  const itens = secoesDe(admin).map((s) => ({ ...s, ...resumos[s.id] }));
  const conteudo: Record<IdSecao, () => ReactNode> = {
    expediente: () => <SecaoExpediente cfg={cfg} />,
    prazos: () => <SecaoPrazos cfg={cfg} feriados={feriados ?? []} hoje={hoje} admin={admin} agora={agora} />,
    feriados: () => <SecaoFeriados feriados={feriados ?? []} hoje={hoje} />,
    mensagens: () => <SecaoMensagens cfg={cfg} />,
    respostas: () => <SecaoRespostas respostas={respostas ?? []} />,
    espera: () => <SecaoEspera cfg={cfg} />,
    ia: () => <SecaoIa cfg={cfg} teto={teto} parcial={gasto?.parcial ?? false} />,
    setores: () => <SecaoSetores setores={setores ?? []} />,
    servicos: () => <SecaoServicos servicos={servicos ?? []} setores={setores ?? []} />,
    cargos: () => <SecaoCargos cfg={cfg} admin={admin} />,
    integracoes: () => <SecaoIntegracoes sinal={sinal} />,
  };

  return (
    <section>
      <PageHeader
        titulo={<>Configurações · <span className="font-extrabold text-brand">{secao.rotulo}</span></>}
        descricao="Uma seção por vez. Cada cartão salva sozinho; sair com alteração não salva pede confirmação."
      />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <MenuSecoes itens={itens} atual={secao.id} linkUsuarios={admin} />
        <div className="flex min-w-0 flex-1 flex-col gap-5">{conteudo[secao.id]()}</div>
      </div>
    </section>
  );
}
```

`git rm "apps/painel/src/app/(painel)/configuracoes/navegacao-secoes.tsx"`.

`loading.tsx`:

```tsx
import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';

/** Configurações: menu por seção e o cartão da seção aberta. */
export default function CarregandoConfiguracoes() {
  return (
    <section>
      <PageHeader titulo="Configurações" />
      <div role="status" aria-label="Carregando as configurações" className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 lg:w-64 lg:shrink-0">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Passo 5: e2e**

`e2e/niveis-telas.spec.ts` e `e2e/configuracoes.spec.ts`: o título da página passa a ser "Configurações · Expediente", então `getByRole('heading', { name: 'Expediente' })` acharia dois: troque por `{ name: 'Expediente', exact: true }` (motivo no commit). O teste "Configurações Sim: quem não é administrador salva o Expediente" continua com `getByRole('region', { name: 'Expediente' })` e o botão `Salvar` (casa com "Salvar expediente").

`apps/painel/e2e/configuracoes-secoes.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const SENHA = 'senha-forte-123';

test('menu em grupos com resumos, uma seção por vez e endereço por seção', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-secoes@e2e.local', senha: SENHA, nome: 'Admin Seções', papel: 'admin' });
  await entrar(page, 'admin-secoes@e2e.local', SENHA);
  await page.goto('/configuracoes');
  const menu = page.getByRole('navigation', { name: 'Seções das configurações' });
  for (const g of ['Escritório', 'Agente e atendimento', 'Cadastros', 'Sistema']) {
    await expect(menu.getByRole('heading', { name: g })).toBeVisible({ timeout: 30_000 });
  }
  await expect(menu.getByRole('link', { name: /^Expediente/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Configurações · Expediente');
  await expect(page.getByRole('region', { name: 'Feriados' })).toHaveCount(0);
  const { data } = await db.from('configuracoes').select('prazo_alta_dias').eq('id', 1).single();
  await expect(menu.getByRole('link', { name: /^Prazos/ })).toContainText(`alta ${data!.prazo_alta_dias === 0 ? 'mesmo dia' : data!.prazo_alta_dias}`);
  await expect(menu.getByRole('link', { name: /Usuários e permissões/ })).toHaveAttribute('href', '/usuarios');
  await menu.getByRole('link', { name: /^Feriados/ }).click();
  await expect(page).toHaveURL(/\/configuracoes\?secao=feriados$/);
  await expect(page.getByRole('region', { name: 'Feriados' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Expediente' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Trilha' }).first()).toContainText('Feriados');
});

test('link antigo com âncora abre a seção certa', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-secoes@e2e.local', senha: SENHA, nome: 'Admin Seções', papel: 'admin' });
  await entrar(page, 'admin-secoes@e2e.local', SENHA);
  await page.goto('/configuracoes#teto-ia');
  await expect(page).toHaveURL(/secao=ia/, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Teto de IA e alertas' })).toBeVisible();
});

test('Configurações "Sim": sem as seções do administrador; pedi-las pela URL abre o Expediente', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-secoes@e2e.local', senha: SENHA, nome: 'Ana Seções', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', ana).eq('modulo', 'configuracoes');
  await entrar(page, 'ana-secoes@e2e.local', SENHA);
  await page.goto('/configuracoes?secao=ia');
  await expect(page).toHaveURL(/secao=expediente/, { timeout: 30_000 });
  const menu = page.getByRole('navigation', { name: 'Seções das configurações' });
  await expect(menu.getByRole('link', { name: /^Cargos/ })).toBeVisible();
  for (const nome of [/Teto e modelos de IA/, /Integrações/, /Usuários e permissões/]) await expect(menu.getByRole('link', { name: nome })).toHaveCount(0);
  await expect(menu.getByRole('heading', { name: 'Sistema' })).toHaveCount(0);
});
```

- [ ] **Passo 6: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/configuracoes-secoes.spec.ts e2e/configuracoes.spec.ts e2e/configuracoes-escritorio.spec.ts e2e/configuracoes-prazos.spec.ts e2e/configuracoes-agente.spec.ts e2e/configuracoes-cadastros.spec.ts e2e/niveis-telas.spec.ts e2e/menu.spec.ts e2e/atendimento-lista.spec.ts e2e/gastos-ia.spec.ts e2e/capturas.spec.ts`
Expected: tudo verde.

- [ ] **Passo 7: commit**

```bash
git add -A apps/painel
git commit -m "feat(painel): Configurações com uma seção por vez, menu em grupos com resumos e trilha da seção

niveis-telas e configuracoes procuram o título Expediente com exact (o título da página passou a ser Configurações · Expediente);
o atalho do WhatsApp aponta para ?secao=integracoes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Painel. Janela ao sair com alteração (SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI)

**Files:**
- Create: `apps/painel/src/app/(painel)/configuracoes/guarda-saida.tsx`
- Modify: `apps/painel/src/app/(painel)/configuracoes/page.tsx`
- Create: `apps/painel/e2e/configuracoes-saida.spec.ts`

**Interfaces:**
- Consumes: `definirGuardaSaida`, `totalDeAlteracoes`, `salvarAlteradosParaSair`, `descartarAlterados` (Task 4); `FormularioPrazos` (Task 6) via `salvarParaSair`.
- Produces: `GuardaSaida({ secao })`.

- [ ] **Passo 1: escrever o e2e que falha**

`apps/painel/e2e/configuracoes-saida.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const lerFim = async () => (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data!.horario_fim.slice(0, 5);

test.beforeEach(async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-saida@e2e.local', senha: SENHA, nome: 'Admin Saída', papel: 'admin' });
  await entrar(page, 'admin-saida@e2e.local', SENHA);
});

test('sair com alteração: CONTINUAR AQUI, DESCARTAR (também pelo menu do painel) e SALVAR E SAIR', async ({ page }) => {
  const antes = await lerFim();
  const novo = antes === '19:15' ? '18:45' : '19:15';
  try {
    await page.goto('/configuracoes?secao=expediente');
    const menu = page.getByRole('navigation', { name: 'Seções das configurações' });
    const fim = page.getByLabel('às', { exact: true });
    await fim.fill(novo, { timeout: 30_000 });
    await expect(menu.getByRole('link', { name: /^Expediente/ })).toContainText('não salvo');

    // Link para a própria seção não pergunta.
    await menu.getByRole('link', { name: /^Expediente/ }).click();
    const janela = page.getByRole('dialog', { name: 'Há alterações não salvas' });
    await expect(janela).toHaveCount(0);

    await menu.getByRole('link', { name: /^Feriados/ }).click();
    await expect(janela).toContainText('Expediente tem 1 alteração não salva.');
    await expect(janela.getByRole('button', { name: 'Continuar aqui' })).toBeFocused();
    await janela.getByRole('button', { name: 'Continuar aqui' }).click();
    await expect(page).toHaveURL(/secao=expediente/);
    await expect(fim).toHaveValue(novo);

    // Menu lateral do painel (outra tela): também pergunta. DESCARTAR volta ao salvo e segue.
    await page.locator('a[href="/demandas"]').first().click();
    await expect(janela).toBeVisible();
    await janela.getByRole('button', { name: 'Descartar' }).click();
    await expect(page).toHaveURL(/\/demandas/);
    expect(await lerFim()).toBe(antes);

    // SALVAR E SAIR grava e segue.
    await page.goto('/configuracoes?secao=expediente');
    await page.getByLabel('às', { exact: true }).fill(novo, { timeout: 30_000 });
    await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('link', { name: /^Feriados/ }).click();
    await janela.getByRole('button', { name: 'Salvar e sair' }).click();
    await expect(page).toHaveURL(/secao=feriados/);
    expect(await lerFim()).toBe(novo);
  } finally {
    await db.from('configuracoes').update({ horario_fim: `${antes}:00` }).eq('id', 1);
  }
});

test('SALVAR E SAIR com campo inválido fica na seção', async ({ page }) => {
  await page.goto('/configuracoes?secao=expediente');
  await page.getByLabel('Das', { exact: true }).fill('19:00', { timeout: 30_000 });
  await page.getByLabel('às', { exact: true }).fill('18:00');
  await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('link', { name: /^Feriados/ }).click();
  await page.getByRole('dialog', { name: 'Há alterações não salvas' }).getByRole('button', { name: 'Salvar e sair' }).click();
  await expect(page).toHaveURL(/secao=expediente/);
  await expect(page.getByLabel('Das', { exact: true })).toHaveValue('19:00');
});

test('SALVAR E SAIR em Prazos passa pela janela de impacto (D15)', async ({ page }) => {
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
  await demandaE2e({ titulo: 'G1 saída aberta', setor: 'Fiscal', prioridade: 'normal', prazoEm: new Date(Date.now() + 40 * 86_400_000).toISOString() });
  try {
    await page.goto('/configuracoes?secao=prazos');
    await page.getByLabel('Normal (dias úteis)').fill('3', { timeout: 30_000 });
    await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('link', { name: /^Feriados/ }).click();
    await page.getByRole('dialog', { name: 'Há alterações não salvas' }).getByRole('button', { name: 'Salvar e sair' }).click();
    const impacto = page.getByRole('dialog', { name: 'Mudar o prazo das demandas abertas também?' });
    await expect(impacto).toBeVisible({ timeout: 30_000 });
    await impacto.getByRole('button', { name: 'Só para as novas' }).click();
    await expect(page).toHaveURL(/secao=feriados/);
    expect((await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);
  } finally {
    await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
    await limparDemandasE2e('G1 saída');
  }
});
```

Run: `cd apps/painel && pnpm exec playwright test e2e/configuracoes-saida.spec.ts` → Expected: FAIL (aparece o `confirm` do navegador, que o Playwright fecha sozinho; a janela não existe).

- [ ] **Passo 2: `guarda-saida.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { definirGuardaSaida, descartarAlterados, salvarAlteradosParaSair, totalDeAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Sair de Configurações com alteração (spec 7C.4, imagem A): SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI. Vale para todo
 * link do painel (D14); fechar ou recarregar a aba continua com a pergunta do navegador. Foco inicial em CONTINUAR AQUI.
 */
export function GuardaSaida({ secao }: { secao: string }) {
  const router = useRouter();
  const [destino, setDestino] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const continuar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    definirGuardaSaida((d) => {
      setTotal(totalDeAlteracoes());
      setDestino(d);
    });
    return () => definirGuardaSaida(null);
  }, []);

  return (
    <Dialog open={destino !== null} onOpenChange={(aberto) => { if (!aberto) setDestino(null); }}>
      <DialogContent mostrarFechar={false} className="max-w-md" onOpenAutoFocus={(e) => { e.preventDefault(); continuar.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>Há alterações não salvas</DialogTitle>
          <DialogDescription>{secao} tem {total === 1 ? '1 alteração não salva' : `${total} alterações não salvas`}.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-wrap gap-2">
          <Button ref={continuar} type="button" variant="ghost" onClick={() => setDestino(null)}>Continuar aqui</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const d = destino;
              setDestino(null);
              descartarAlterados();
              if (d) router.push(d);
            }}
          >
            Descartar
          </Button>
          <Button
            type="button"
            onClick={async () => {
              const d = destino;
              // Fecha antes: o Salvar de Prazos pode abrir a janela de impacto (D15).
              setDestino(null);
              if ((await salvarAlteradosParaSair()) && d) router.push(d);
            }}
          >
            Salvar e sair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Em `page.tsx`, logo no começo do `<section>`: `<GuardaSaida secao={secao.rotulo} />` (import de `./guarda-saida`).

- [ ] **Passo 3: rodar**

Run: `supabase db reset && pnpm --filter @escritorio/painel typecheck && cd apps/painel && pnpm exec playwright test e2e/configuracoes-saida.spec.ts e2e/configuracoes-secoes.spec.ts e2e/usuarios-erros.spec.ts e2e/treinar-agente.spec.ts`
Expected: tudo verde (as outras telas continuam com o `confirm` de hoje).

- [ ] **Passo 4: commit**

```bash
git add apps/painel
git commit -m "feat(painel): janela ao sair de Configurações com alteração (salvar e sair, descartar, continuar aqui)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Acessibilidade, catálogo e manuais

**Files:**
- Modify: `apps/painel/e2e/acessibilidade.spec.ts`
- Modify: `apps/painel/src/app/(painel)/_design/page.tsx` (se tiver seção de padrões)
- Modify: `docs/design-system.md`, `docs/operacao.md`

- [ ] **Passo 1: acessibilidade nos dois temas**

Em `e2e/acessibilidade.spec.ts`, na lista `rotas` do administrador, troque `'/configuracoes'` pelas onze: `...['expediente', 'prazos', 'feriados', 'mensagens', 'respostas', 'espera', 'ia', 'setores', 'servicos', 'cargos', 'integracoes'].map((s) => \`/configuracoes?secao=${s}\`)`. Depois do laço, mais duas auditorias: em `?secao=prazos`, mude "Normal (dias úteis)" e clique "Salvar prazos" (com uma demanda Normal aberta de teste, `demandaE2e`) e audite com a **janela de impacto** aberta; em `?secao=expediente`, mude o fim e clique em "Feriados" no menu e audite com a **janela de saída** aberta (feche com "Continuar aqui" e "Descartar" no fim).

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/acessibilidade.spec.ts`
Expected: sem violação séria ou crítica nos temas claro e escuro. Se o axe acusar contraste no "antes:" ou no selo "N alterações não salvas" (`text-warning` sobre `bg-warning-soft`), use o par já aprovado do `StatusBadge` de atenção (`grep -n "warning" apps/painel/src/components/patterns/status-badge.tsx`).

À mão, com o teclado: Tab passa pelo menu (grupos e itens), entra no cartão, chega em DESCARTAR e SALVAR; Enter num item do menu com alteração abre a janela com foco em CONTINUAR AQUI; Esc fecha; na janela de impacto o foco começa em SÓ PARA AS NOVAS.

- [ ] **Passo 2: catálogo**

Se `/_design` mostra padrões, acrescente "Configurações (Parte G1)": um `FormularioConfig` de exemplo com um campo, o `Antes` e o `RodapeConfig` (a ação de exemplo devolve `{ ok: true, mensagem: 'Exemplo salvo.' }` sem gravar nada). Sem seção de padrões, não acrescente nada.

- [ ] **Passo 3: `docs/design-system.md`**

Em "Vocabulário oficial da interface":

```markdown
- **Configurações:** grupos "Escritório", "Agente e atendimento", "Cadastros", "Sistema"; "não salvo", "antes: X", "N alterações não salvas", "Sem alterações", "Descartar", "Salvar e sair", "Continuar aqui", "Só para as novas", "Aplicar também às N abertas", "prazo recalculado por mudança de regra (<pessoa>)".
```

Em "Regras de estilo":

```markdown
**Cartão de Configurações** (`FormularioConfig` + `RodapeConfig`): cada cartão salva sozinho, sem recarregar a página; o erro aparece no cartão e o que foi digitado fica. Campo alterado fica âmbar (`data-alterado`, CSS em `globals.css`) e ganha "antes: X" em texto (a cor nunca está sozinha); o rodapé diz "N alterações não salvas" e tem DESCARTAR. Sair com alteração abre a janela SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI (`GuardaSaida`; só em Configurações — as outras telas usam a pergunta do navegador).
```

- [ ] **Passo 4: `docs/operacao.md`**

1. Em "### Pessoas, permissões e horário de acesso", troque o parágrafo de "**Configurações: Sim**" por:

```markdown
**Configurações: Sim** não é o mesmo que ser administrador. A pessoa abre Configurações e mexe em Expediente, Prazos, Feriados, Mensagens (inclusive o aviso da tela de login), Respostas prontas, Limites de espera, Setores, Serviços e Cargos. Setores e serviços ela cadastra, altera e desativa, mas não exclui de vez: isso continua com você. Ficam só com o administrador: Teto e modelos de IA (teto, alertas, modelos, cotação e custo da transcrição), Integrações, Usuários e permissões e a pausa do agente.
```

2. Em "### Prioridade e prazo das demandas", troque "Mude em **Configurações › Prazos**." por:

```markdown
Mude em **Configurações › Prazos**: a tabela mostra, para cada prioridade, quando vence uma demanda aberta hoje às 10:00 e quantas demandas abertas a usam. Ao salvar, se houver demandas abertas daquela prioridade, o sistema mostra o impacto ("14 demandas Normais abertas; 9 ganham 1 dia útil; nenhuma fica vencida" — ao diminuir, em vermelho, quantas passariam a vencidas) e pergunta:
- **Só para as novas** (padrão): as abertas mantêm o prazo.
- **Aplicar também às abertas**: cada demanda aberta daquela prioridade anda a mesma diferença de dias úteis e ganha na linha do tempo "prazo recalculado por mudança de regra (seu nome)". Prazo que alguém escolheu à mão na demanda não muda. Demanda "Com o cliente" continua pausada e, ao sair, ainda anda o tempo parado.
```

3. Novo, depois de "### Gastos com IA (só o administrador)":

```markdown
### Configurações: uma seção por vez

O menu de Configurações fica à esquerda, em grupos, com um resumo do que está valendo em cada seção ("seg–sex 08–18", "teto US$ 100 · 41%"). Cada cartão tem o próprio **Salvar** e **Descartar**; o campo que você mudou fica âmbar com "antes: …". Se tentar sair com alguma alteração, o painel pergunta: **Salvar e sair**, **Descartar** ou **Continuar aqui**. Cada seção tem endereço próprio (ex.: `/configuracoes?secao=prazos`), bom para mandar a alguém.

**Cargos:** a lista que o campo Cargo da ficha da pessoa sugere, um por linha. Mudar a lista não muda o cargo de quem já tem.
```

- [ ] **Passo 5: commit**

```bash
git add docs/design-system.md docs/operacao.md apps/painel/src apps/painel/e2e
git commit -m "docs: Configurações por seção no catálogo e no manual; acessibilidade das seções e janelas nos dois temas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes de cada suíte inteira:
   - **regressão congelada:** a linha do `22_regressao_visibilidade.test.sql` de agora (100/100) ao lado da guardada na Task 1 (`$SCRATCH/regressao-antes.txt`), e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` **vazio**; `git diff abb48ed --stat -- supabase/tests` mostra só `35_` e `36_` (nenhum teste de parte anterior mudou) e `git diff abb48ed --stat -- supabase/migrations` só `20261007000100` e `20261007000200`;
   - `supabase test db`: todos os arquivos, com os números de cada um, inclusive `35` 46/46, `36` 10/10, o `25` (nenhuma função de gravação sem trava) e os da Parte C (`18` a `21`, o gatilho da pausa mudou);
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`; `pnpm --filter @escritorio/trabalhador test` e `typecheck` (os tipos regerados não podem quebrar o trabalhador);
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com `configuracoes-*.spec.ts` e `acessibilidade.spec.ts` nos dois temas;
   - mostre os números exatos de cada suíte (passaram, falharam, pulados). Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-configuracoes-opcao-a.png`** (e os resumos com a `-opcao-b`):
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local e dados parecidos com os da imagem (expediente seg–sex 08–18; prazos 0/1/2/5 com Normal mudado para 3 sem salvar; 6 Urgentes, 11 Altas, 17 Normais e 3 Baixas abertas; 9 feriados com o próximo em 12/10; 23 respostas prontas; 8 setores; 14 serviços; 4 cargos; Thiago, Cláudia, Ana e Bruno com "Alterar prazos");
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**), gravando os dados pela chave de serviço **do banco local**;
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-g1\` com nomes `g1-<tela>-<largura>-<tema>.png`: `prazos-alterado` (Normal 3, "antes", "era", "1 alteração não salva", "não salvo" no menu — a imagem A), `prazos-impacto` (janela aberta, com o aviso vermelho ao diminuir), `saida` (janela SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI), `expediente`, `ia` (três cartões), `respostas`, `cargos`, `menu-configuracoes-sim` (pessoa com "Configurações: Sim");
   - liste o que ficou diferente da imagem. Já se sabe: "Expediente e IA" virou Expediente + "Teto e modelos de IA" (D8); Urgente com campo de número (D16); título do cartão "Prazos por prioridade" (D24); a faixa "Exemplo do aviso" da imagem é a janela de saída de verdade; "Só administrador" e "Opção A" do topo da imagem não existem (eram legendas da maquete).
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Ela deve listar as da Parte F (`20261006000100_painel_v2_gastos_colunas.sql` a `20261006000300_painel_v2_gastos_funcoes.sql`), **que ainda não foram aplicadas e esperam o "ok" do dono**, e as desta parte (`20261007000100_painel_v2_prazos_regra.sql` e `20261007000200_painel_v2_cargos.sql`). Qualquer `push` sem `--dry-run` levaria as cinco juntas;
   - **não aplique.** Deixe para o dono, por escrito, o que muda e o comando:
     - **ninguém passa a ver mais nem menos** (teste 22); as funções novas só respondem a quem tem "Configurações: Sim" ou é administrador;
     - o gatilho da pausa só muda quando o recálculo é da regra; o resto da Parte C fica igual (testes 18 a 21);
     - o painel antigo e o trabalhador da 3001 continuam funcionando (G1 não muda o trabalhador; a coluna `cargos` e o tipo de evento novo não atrapalham ninguém);
     - para aplicar F e G1 juntas, depois do "ok" dele: `supabase db push --db-url "$DATABASE_URL"` (a ordem é automática). Se quiser só a F antes, o push aplica todas as pendentes: a alternativa é aplicar a F a partir da worktree da Parte F (que não tem as da G1).
4. **Subir o painel para o dono ver:**
   - **painel** desta worktree numa **porta livre** (comece pela **3010**: `netstat -ano | findstr :3010`; se ocupada, a próxima livre). Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal: variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p <porta>` rodando nesta worktree;
   - **trabalhador: NÃO suba nenhum** (G1 não muda o trabalhador). O da porta **3001 é o teste do dono**; não o desligue nem o mate;
   - avise: **antes de aplicar as migrações**, a seção Prazos mostra "Exemplo de vencimento e contagem indisponíveis" e salvar Prazos dá erro na simulação; Cargos mostra a lista padrão e não salva; o resto funciona (D25). Depois de aplicar, tudo funciona;
   - passe o endereço e um roteiro curto:
     1. abra Configurações: o menu em grupos com os resumos; clique nas seções (o endereço muda);
     2. Expediente: mude o fim do expediente, veja o âmbar e o "antes", use DESCARTAR; mude de novo e clique em outra seção: a janela pergunta (teste os três botões);
     3. Prazos (depois das migrações): mude Normal para 3, veja o exemplo mudar e "era …"; Salvar → a janela de impacto; escolha "Só para as novas"; volte para 2 e escolha "Aplicar também às abertas"; abra uma demanda Normal e veja "prazo recalculado por mudança de regra (seu nome)";
     4. Respostas prontas: edite uma e desligue outra; Cargos: acrescente um e veja na ficha de uma pessoa nova;
     5. entre com uma pessoa com "Configurações: Sim": sem Teto e modelos de IA, Integrações e Usuários.
5. **Pendências para listar no fim:**
   - as decisões D1 a D25 que o dono ainda não confirmou (destaque D1, D2, D3 e D4, que mexem em demandas abertas);
   - o que ficou diferente da imagem 00 (item 2);
   - aplicar na homologação as migrações da F e da G1 (item 3), depois do "ok";
   - Parte G, próximas sub-etapas: Início (G2), Contatos (G3), Assistente (G4), Treinar o agente (G5); no Início, tirar o campo `parcial` de `GastoDoMes` (pendência da F).
6. **Não juntar** a branch em nada. **Parar** ao fim da G1 e esperar o dono ver antes de começar o Início.
