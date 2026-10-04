# Painel v2, Parte G5 (Treinar o agente). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** a tela **Treinar o agente** vira a Opção B "Editor com simulador" (`00-treinar-agente-opcao-b.png`), em **três colunas** com o menu recolhido. À esquerda, a **lista enxuta**: "Treinar N" + NOVA, **medidor compacto** dos 12.000 caracteres, busca, filtros Todas · Ligadas N · Desligadas N, **faixa de cor por tipo** com legenda escrita, chave liga/desliga em cada linha e a marca **"do Atendimento"** nas orientações ensinadas pelo Atendimento. No meio, o **editor**: título (até 120), tipo, vale para, texto (até 2.000), **SALVAR DESLIGADA** / **SALVAR E LIGAR**, DESCARTAR e o **histórico em tabela compacta** com Restaurar. À direita, o **simulador de WhatsApp sempre visível**: escolhe a empresa, escreve como cliente, vê a resposta e **"O que o agente faria"**, sempre com o **rascunho do editor sem salvar**; o quadro **"Sem o rascunho"** compara, sob pedido, com uma **segunda simulação sem o rascunho** (conta em Gastos com IA como `testar_agente`). **As regras de gravação e de simulação continuam exatamente as de hoje:** a simulação nunca envia nem grava; regras fixas, limites (4 min por teste, 1 teste por pessoa) e a permissão `treinar_agente` não mudam.

**Arquitetura:**
- **Banco: nada.** Nenhuma migração, nenhum pgTAP novo, `tipos.gen.ts` não muda. O rascunho já vai no teste (`criar_simulacao(p_mensagem, p_cliente_id, p_rascunho)`, migrações `20260930000100` e `20260930000200`), e o "sem o rascunho" é a mesma chamada com `p_rascunho` nulo (D1, D2).
- **Trabalhador: nada.** `apps/trabalhador` e `packages/` não mudam. `apps/trabalhador/src/agente/simular.ts` já põe o rascunho no lugar da orientação salva (`orientacoesDoTeste`), finge as ferramentas que gravam/enviam (`simularGravacao`) e grava o custo como `testar_agente` com a pessoa (`reposDaSimulacao`). O da porta 3001 (código da Parte A) já tem tudo isso (`simular.ts` desde `47aea8b`).
- **Painel:** regras puras em `treinar-agente/tela.ts` (etiqueta "do Atendimento", campos a preencher, contagens, medidor compacto, histórico, rótulo do simulador, quando comparar, empresa do teste, rascunho lido do formulário). Componentes novos: `lista-orientacoes.tsx`, `medidor-compacto.tsx`, `editor-orientacao.tsx`, `cabecalho-editor.tsx`, `historico-tabela.tsx`, `simulador.tsx`, `use-simulacao.ts` (o hook de hoje, movido), `rascunho-ao-vivo.ts`, `hidratado.tsx`. `page.tsx` e `loading.tsx` reescritos. Saem: `formulario-orientacao.tsx`, `historico-orientacao.tsx`, `abas-orientacao.tsx`, `medidor.tsx`, `testar-agente.tsx` (Dialog). As ações (`acoes.ts`: `salvarOrientacao`, `alternarOrientacao`, `restaurarVersao`, `testarAgente`, `ensinarAgente`) **não mudam** (só sai `empresasParaTeste`, que fica sem uso). A casca recolhe o menu também em `/treinar-agente` (`menu-tela.ts`); as larguras das colunas viram tokens.

**Tecnologias:** Next.js 15 (App Router, server components, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (RLS, Realtime já publicado em `simulacoes_agente`), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção **7C.5** (Opção B: três colunas; lista enxuta com medidor compacto, faixa por tipo, chave e etiqueta "ensinada no Atendimento"; simulador sempre visível usando o **rascunho** sem salvar, com "O que o agente faria" — as que gravam/enviam fingidas, mesma regra de hoje; quadro "Sem o rascunho" — "custa uma segunda simulação; conta em Gastos com IA como `testar_agente`"; editor com título, texto até 2.000, tipo, vale para, histórico em tabela compacta com restaurar, SALVAR DESLIGADA e SALVAR E LIGAR; "Regras fixas, limites (4 min por teste, 1 teste por pessoa) e permissão `treinar_agente` não mudam") e **7C.6** (Playwright "simulador com e sem rascunho"; capturas 1366/1920, claro e escuro);
- **3.1** (termos; "toda IA nova grava custo com funcionalidade e pessoa": a segunda simulação já grava `testar_agente` + pessoa; migração com pgTAP e `--dry-run`: aqui **não há migração**; nada é juntado), **4.3** (casca, menu recolhido), **4.6** (tom), **7B** (Parte F: `testar_agente`), **8** (vermelho nunca sozinho; grep antes de trocar rótulos).
- Imagem: `imagens/00-treinar-agente-opcao-b.png` (**a implementar**); `00-treinar-agente-opcao-a.png` só como referência, **não implementar**. HTML de origem: `fragmentos/00-treinar-agente-opcao-b.html`. Dados nas imagens são de exemplo; onde imagem e spec divergem, vale o spec. A etiqueta "Opção B — Editor com simulador" do canto e o selo "NOVO" do quadro "Sem o rascunho" são legendas da maquete.

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt G" (linhas 184–201) — ordem Configurações → Início → Contatos → Assistente → **Treinar o agente**; **este plano cobre só o Treinar o agente (G5)**, a última tela da Parte G. Ponto que não pode falhar: "**Assistente e Treinar o agente: as regras de gravação e simulação continuam exatamente as de hoje (prévia com chave; simulação nunca envia nem grava).**" Ao terminar: suítes com resultado real, capturas comparadas com a imagem, e **parar**. Estilo e convenções: `docs/superpowers/plans/2026-10-10-painel-v2-parte-g4-assistente.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-g`, branch `painel-v2-parte-g`, a partir de `5beeb10` (G4 Assistente pronta, com acabamentos) ou do commit mais novo da branch. **Antes da Task 1, anote o SHA de partida:** `git rev-parse --short HEAD` → chamado de **BASE** abaixo. Todos os comandos rodam a partir da raiz da worktree. Confira `git diff etapa-1 -- docs/superpowers/specs/painel-v2`: se não sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso.

## Decisões tomadas (sem o dono)

O dono está fora e autorizou decidir. Conferi no código o que o spec supõe:

- **O rascunho já vai no teste sem salvar.** `testarAgente` (`treinar-agente/acoes.ts`) chama `criar_simulacao(p_mensagem, p_cliente_id, p_rascunho)`; a função confere o rascunho com as regras de `salvar_orientacao`, guarda-o limpo em `simulacoes_agente.rascunho` (`{id, titulo, texto, tipo, cliente_id, setor_id}`) e **nunca** toca em `orientacoes_agente`. O trabalhador (`simular.ts`, `orientacoesDoTeste`) põe o rascunho no lugar da salva (pelo `id`) como se estivesse ligado. Com `p_rascunho` nulo, o teste usa só as orientações **ligadas e salvas** (é o "Testar o agente" do cabeçalho de hoje).
- **A simulação não grava nem envia.** `reposDaSimulacao` só libera leituras (qualquer outro método lança `BloqueadoNaSimulacao`); canal e mídia bloqueados; as ferramentas que gravam/enviam viram ações escritas em `respostas.acoes` (`simularGravacao`). **Leituras (buscar produtos, consultar preço) rodam de verdade e não viram ação.** O custo vai para `uso_ia` como `testar_agente`, com a pessoa, sem conversa e sem empresa (Parte F).
- **Limites de hoje.** Uma simulação pendente por pessoa (`criar_simulacao`: trava por pessoa; pendente há mais de 5 min conta como abandonada); 4 min por teste no trabalhador (`PRAZO_SIMULACAO_MS`); o painel espera 5 min (`PRAZO_ESPERA_MS`) e acompanha por Realtime (`simulacoes_agente` já está na publicação; nada novo publicado) com consulta de reserva a cada 3 s. O trabalhador simula **uma mensagem, sem histórico** (`montarConteudoUsuario(ctx, [], [mensagem], [])`).
- **"Ensinada no Atendimento" não está gravada.** `orientacoes_agente` não tem origem nem conversa; `ensinarAgente` grava pelo mesmo `salvar_orientacao`. O que distingue é o texto que `comporTexto` (`ensinar.ts`) monta: `"Situação: …\nO que fazer: …"` ou `"O que fazer: …"`. A primeira versão (`orientacoes_agente_versoes`, `acao = 'criar'`) guarda o texto da criação; `criado_por` diz quem criou. O nome do contato da conversa **não** está gravado em lugar nenhum.
- **Permissões.** Tela e ações: `temNivel(u, 'treinar', 'sim')` (admin ou "Treinar o agente = Sim"); o banco confere de novo (`tem_permissao('treinar_agente')`) em todas as funções e na RLS de leitura. Nada muda.
- **Testes que dependem da tela de hoje.** `e2e/treinar-agente.spec.ts`, `e2e/testar-agente.spec.ts`, uma linha de `e2e/ensinar-agente.spec.ts` (`getByRole('dialog')` depois de "Abrir na tela Treinar o agente") e dois trechos de `e2e/acessibilidade.spec.ts` usam o painel lateral (Sheet), as abas "Orientação/Histórico", o botão "Salvar orientação", a chave "Ligada" do formulário, a tabela de linhas e o Dialog "Testar o agente". O spec troca justamente essas peças (D19). Os testes de unidade (`acoes.test.ts`, `esquemas.test.ts`, `simulacao.test.ts`, `ensinar.test.ts`, `lib/orientacoes.test.ts`, `menu-tela*.test.ts`, `trilha.test.ts`, `menu.test.ts`) **não mudam e continuam passando**.

Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Custo da alternativa | Task |
|---|---|---|---|---|
| D1 | **Nenhuma migração e nenhuma mudança no trabalhador.** O simulador manda o rascunho do editor por `testarAgente` (como o "Testar esta orientação" de hoje) e o "Sem o rascunho" é outra chamada com `rascunho: null`. | Um pedido de teste "em par" no banco. | Migração nova pendente na homologação, função nova, trabalhador "pronto para trocar" e cenários com Claude de verdade. | todas |
| D2 | **"Sem o rascunho" = como o agente responde hoje**, com as orientações ligadas e salvas (a versão salva desta orientação entra se estiver ligada). O quadro diz isso com essas palavras. | Tirar a orientação inteira do segundo teste. | Chave nova no rascunho: migração (`criar_simulacao` só aceita as chaves de hoje) e mudança no trabalhador. | 1, 5 |
| D3 | **A comparação é sob pedido:** depois que o teste com rascunho fica pronto, o quadro mostra **COMPARAR SEM O RASCUNHO** ("é mais um teste… conta em Gastos com IA"). Roda em seguida, com a mesma mensagem e empresa, respeitando "1 teste por pessoa". | Rodar sempre as duas, em sequência. | Dobra o gasto e o tempo de todo teste. | 5 |
| D4 | **O quadro "Sem o rascunho" só aparece quando o teste usou algo diferente do que o agente já lê:** orientação nova, desligada ou com conteúdo diferente do salvo. Teste retomado ("você já tem um teste em andamento") não oferece comparação. | Sempre. | Gasto à toa: as duas respostas viriam da mesma entrada. | 1, 5 |
| D5 | **Um teste por vez, uma mensagem por teste:** o simulador mostra só o último teste (mensagem do cliente, resposta, ações). Testar de novo troca o quadro. | Conversa de várias mensagens. | O trabalhador simula sem histórico: mudança no trabalhador e no que o modelo vê. | 5 |
| D6 | **"O que o agente faria" mostra o que o trabalhador registra hoje** (as ações que gravariam ou enviariam, todas fingidas), **aberto** (sem recolher), com ícone por ferramenta e a frase "O que grava ou envia foi só simulado." Leituras ("Buscaria produtos…" da imagem) ficam de fora. | Registrar também as leituras. | Mudança no trabalhador (`criarExecutorSimulado`). | 5 |
| D7 | **"Seguiu a orientação…" da imagem vira um fato:** "Teste com o rascunho "<título>" (ligado, sem salvar)." + os avisos que o trabalhador já grava (orientação fora da empresa, setor desligado, cortadas pelo limite). A tela nunca afirma que o agente seguiu. | Perguntar ao modelo se seguiu. | Muda o que o modelo vê e gasta mais. | 5 |
| D8 | **"Ensinada no Atendimento" pelo texto de criação:** a versão `criar` (ou o texto atual, se não houver versão) começa com `"O que fazer: "` ou tem `"Situação: …\nO que fazer: "` — o formato único do `comporTexto`. Na lista: "do Atendimento"; no editor: "SITUAÇÃO ESPECÍFICA · ENSINADA NO ATENDIMENTO" e "Criada por <pessoa> no Atendimento". **Sem o nome do contato** ("a partir da conversa com Carla Mendes" não está gravado). | Migração `20261011000100` com `origem` + `conversa_id` e uma função `ensinar_orientacao`. | Migração pendente na homologação, pgTAP, tipos, leitura com plano B enquanto não aplicada; o nome do contato ainda dependeria da leitura da conversa pela pessoa. | 1, 6 |
| D9 | **Rascunho incompleto não vira teste:** TESTAR com o editor aberto lê o formulário; se faltar título, texto, empresa ou setor, aparece "Complete o rascunho para testar: <motivo>" no simulador e o foco vai para o campo. | Testar sem o rascunho, em silêncio. | A pessoa acharia que testou a orientação. | 1, 5 |
| D10 | **Sem orientação aberta, o simulador testa as orientações ligadas** (rascunho nulo; selo "orientações ligadas, sem rascunho"). Substitui o botão "Testar o agente" do cabeçalho. A coluna do meio convida a escolher uma orientação (ou mostra os três exemplos quando não há nenhuma). | Abrir sempre a primeira da lista. | Esconderia o teste "só com as ligadas". | 6 |
| D11 | **A empresa do teste acompanha a do rascunho** (vale para = Empresa) até a pessoa escolher outra no simulador; "Testar sem empresa" volta para número desconhecido. O editor avisa cada mudança (`treinar:rascunho`) e o simulador relê o formulário. | Empresa só escolhida no simulador. | Teste de orientação de empresa sem a empresa: o rascunho não entraria (aviso do trabalhador). | 5 |
| D12 | **SALVAR DESLIGADA / SALVAR E LIGAR** são o mesmo `salvarOrientacao` (sem mudança): o botão leva `ativo=off|on` no envio. A chave do alto do editor é a mesma da lista (grava na hora por `alternarOrientacao`); "Nova" não tem chave. A chave do formulário de hoje sai. Ligar pelo alto **não apaga o rascunho** (a chave do formulário deixa de usar `ativo`). **Enter no título não envia** (o botão padrão seria SALVAR DESLIGADA). | Manter "Salvar orientação" + chave no formulário. | Contra o spec e a imagem. | 4, 6 |
| D13 | **DESCARTAR** recomeça o formulário com o que está salvo (remonta o formulário), sem gravar; só fica ativo com alteração. | `restaurarCampos`. | A busca de empresa guarda a escolha no estado do React e ficaria diferente do campo. | 4 |
| D14 | **Trocar de orientação (ou sair) com rascunho não salvo:** a pergunta do navegador, como nas outras telas (`FormularioAlteravel`; a janela própria é só de Configurações, `docs/design-system.md`). | Janela própria. | Mais um componente; regra diferente das outras telas. | 6 |
| D15 | **Histórico em tabela compacta embaixo do editor**, sempre visível: quando ("hoje 15:10" / "29/09 15:10"), o resumo de hoje (`resumoVersao`: "Criou (desligada)", "Editou: texto", "Ligou"…) + "por <pessoa>", selo "atual" na mais nova, "Ver esta versão" e **RESTAURAR** só onde o conteúdo difere do atual (regra de hoje); a confirmação é a de hoje ("restaurar não liga nem desliga"). `?aba=historico` continua aceito (sem efeito: o histórico está sempre à vista). | Aba Histórico. | Contra a imagem. | 1, 4 |
| D16 | **Lista:** filtros Todas · Ligadas N · Desligadas N (`?ativo=`, contagem sobre todas) + busca (título, texto, empresa, setor; `?q=`). `?tipo=` e `?vale=` continuam valendo na URL, sem botão. Ordem: atualizada mais recente primeiro. **Faixa por tipo com as cores da imagem em tokens existentes:** Jeito `bg-warning`, Regra `bg-brand`, Situação `bg-info`, com legenda escrita (a cor nunca fala sozinha; o tipo também vai no nome do link para leitor de tela). | Filtros de tipo e "vale para" como hoje. | Mais controles numa coluna de ~330px, fora da imagem. | 1, 3 |
| D17 | **"N campos a preencher"** (âmbar) no lugar do "vale para" quando o texto tem "(a preencher)" (as orientações da skill do dono, `operacao.md` §10). | Não mostrar. | O dono não veria o que falta preencher (está na imagem). | 1, 3 |
| D18 | **Menu recolhido no Treinar o agente** (imagem; três colunas não cabem em 1366 com o menu aberto), com a regra do Atendimento e do Assistente (abrir vale só nesta tela). Larguras como tokens: lista `calc(330rem / 14)`, simulador `calc(410rem / 14)`. | Menu aberto. | Editor com menos de 450px em 1366. | 2 |
| D19 | **Os e2e da tela antiga são adaptados à tela nova, cenário por cenário:** mesmas conferências no banco (linha por linha), mudam só localizadores e os passos que o spec trocou (painel lateral → coluna "Editor da orientação"; abas → histórico à vista; "Salvar orientação" → "Salvar desligada"/"Salvar e ligar"; Dialog "Testar o agente" → região "Simulador"; linha da tabela → item da lista; espera da hidratação). Precedente: G3 D6 (e2e da Parte B adaptado ao novo painel). Prova na Entrega: o `git diff BASE` desses arquivos não tem linha de conferência no banco alterada. | Manter a tela antiga ao lado da nova. | Duas telas para a mesma coisa, contra o spec. | 7 |
| D20 | **Nomes acessíveis completos com rótulos curtos na tela:** "Jeito"/"Regra"/"Situação" e "Todos"/"Empresa"/"Setor" visíveis, com o resto em `sr-only` ("Jeito de atender", "Uma empresa", "Todos os clientes"…); "Nova" = "Nova orientação"; o título da página é "Treinar o agente" (visível "Treinar" + contagem). Respeita "rótulo visível dentro do nome". | Textos longos na tela. | Não cabem nos botões segmentados da imagem. | 3, 4 |
| D21 | **Homologação com migrações pendentes:** nada pendente desta parte; a tela lê só tabelas de 30/09 (`orientacoes_agente`, `orientacoes_agente_versoes`, `simulacoes_agente`) e cadastros. Com F, G1, G2 e G3 pendentes, o Treinar abre inteiro. "Conta em Gastos com IA como `testar_agente`" vale com a Parte F aplicada e o trabalhador ≥ F; o da porta 3001 (Parte A) grava o custo do teste em `uso_ia` sem funcionalidade (continua somando no teto). | — | — | Entrega |
| D22 | **Cenários com Claude de verdade não rodam nesta parte:** nada do que o modelo vê muda (mesmo `criar_simulacao`, mesmo formato de rascunho, mesmo trabalhador; o "sem o rascunho" é o pedido do "Testar o agente" de hoje). Prova: `git diff BASE --stat -- apps/trabalhador packages supabase` **vazio**. | Rodar mesmo assim. | Gasto de API sem nada novo para medir. | Entrega |
| D23 | **Trilha continua "Treinar o agente"** (`trilha.test.ts` não pode mudar); o "Agente ›" da imagem e o "● Agente ativo" do topo ficam como a casca já mostra. **Regras fixas** num cartão fixo embaixo do editor, com o texto da imagem. | Mudar a trilha. | Editar teste de parte anterior. | 6 |
| D24 | **Empresas lidas no servidor** (ativas, todas as páginas) para o editor e o simulador; `empresasParaTeste` sai de `acoes.ts` (só o Dialog usava). O simulador é remontado ao trocar de orientação (`key`): um teste pendente é retomado pelo aviso de hoje. | Ler ao abrir, como o Dialog. | Uma chamada a mais a cada orientação aberta. | 6 |

## Restrições globais

- **Só mexer em:** `apps/painel` (tela, componentes, casca, tokens, e2e) e `docs/design-system.md`, `docs/operacao.md`. **Nada em `supabase/`, `packages/`, `apps/trabalhador`** (D1, D22). Nenhuma ação do servidor muda de comportamento (`acoes.ts` só perde `empresasParaTeste`).
- **Testes de unidade de partes anteriores não mudam:** nenhum pgTAP (`supabase/tests/**`), nenhum `*.test.ts` existente (inclusive `acoes.test.ts`, `simulacao.test.ts`, `esquemas.test.ts`, `ensinar.test.ts`, `menu-tela.test.ts`, `menu-tela-assistente.test.ts`, `trilha.test.ts`, `escala.test.ts`, `tokens.test.ts`, `formulario-alteravel.test.ts`). **E2e da tela antiga:** só as adaptações da Task 7 (D19), com as conferências no banco intactas; nenhum outro e2e existente muda.
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` continua 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio (ele também fixa a lista do `supabase_realtime`: nada é publicado; `simulacoes_agente` já está lá desde 30/09). Nunca use `usuario_liberado` (é só do `service_role`).
- **Mesmas permissões de hoje:** tela e ações = `temNivel(u, 'treinar', 'sim')`; o banco confere de novo. A tela sem permissão (`SemPermissao`) não muda.
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`).
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os e2e deixam no banco quebram os pgTAP antigos.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts`.
- **A máquina tem pouca memória:** e2e sempre em **lotes** (os da Task 6/7 sozinhos; a suíte inteira em lotes de até 6 arquivos, Entrega). Nunca rode o painel de teste do dono, o `next dev` desta parte e a suíte e2e ao mesmo tempo.
- **E2e só contra o banco local:** `apps/painel/e2e/trava-local.ts` recusa outro banco. **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`** (só leitura, na Entrega, para o `--dry-run` e o painel do dono).
- **Esperar a hidratação nos e2e:** todo e2e novo ou adaptado abre a tela por `abrirTreinar(page, consulta)` ou chama `esperarTreinar(page)` depois de uma navegação (`e2e/apoio-treinar.ts`, Task 6), que espera o `data-treinar-hidratado`. Clicar antes disso perde a ação. Localize as colunas por `editor(page)`, `simulador(page)` e `lista(page)` (regiões "Editor da orientação", "Simulador", "Orientações").
- **Nenhum trabalhador é ligado nem desligado nesta parte.** O da porta **3001 é o teste do dono: não desligue nem mate esse processo.** Os e2e não precisam de trabalhador (o resultado da simulação é gravado direto no banco local pela chave de serviço, como hoje).
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "Treinar o agente" (menu e título acessível), "Nova orientação" (nome do link), "Título", "O que o agente deve fazer", "Jeito de atender", "Regra do escritório", "Situação específica", "Todos os clientes", "Uma empresa", "Um setor", "Empresa", "Escolha a empresa.", "Nenhuma orientação ainda.", "Usar este exemplo", "Nenhuma orientação neste filtro.", "Você não tem acesso a esta tela.", "Restaurar esta versão", "Restaurar esta versão?", "Mensagem do cliente", "Pensando…", "Você já tem um teste em andamento…", "Testar sem empresa", "Tentar de novo", "Ligar/Desligar a orientação <título>", "arquivada", "Ensinar o agente", "Abrir na tela Treinar o agente".
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[330px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind (as larguras viram tokens, Task 2). Barra do medidor só com `style={{ width: '<n>%' }}` (como hoje). `escala.test.ts` e `tokens.test.ts` continuam passando. Ícones só com `size={14|16|20}`.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`; os botões `primary/outline` já são). Vermelho nunca sozinho.
- **Termos (spec 3.1):** Demanda, Conversa, Atendimento, Empresa, Contato, Setor, Pedido de nota. "Pessoa" para usuário da equipe.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Simulação gravando por conta própria:** testar com rascunho e comparar sem o rascunho **não mudam** `orientacoes_agente` nem `orientacoes_agente_versoes`; o rascunho continua no formulário. Task 6 (e2e).
2. **"Sem o rascunho" errado:** a segunda simulação tem `rascunho = null`, a **mesma mensagem e a mesma empresa** da primeira; só sai por pedido; enquanto roda, TESTAR fica desligado (1 teste por pessoa). O quadro não aparece quando o rascunho é igual ao que já vale nem sem rascunho (D4). Tasks 1 (unidade) e 6 (e2e).
3. **Salvar com o estado errado:** SALVAR DESLIGADA grava desligada, SALVAR E LIGAR grava ligada; Enter no título não salva; a chave do alto grava na hora e **não apaga o rascunho**; DESCARTAR não grava. Task 6.
4. **Rascunho incompleto testado em silêncio:** sem título, nenhum teste é criado; aviso e foco no Título (D9). Tasks 1 e 7.
5. **Perder o rascunho:** clicar outra orientação com rascunho pergunta antes; cancelar fica. Task 6.
6. **Etiqueta enganosa:** "do Atendimento" só no formato do `comporTexto` (D8); "N campos a preencher" só com "(a preencher)". Tasks 1 e 6.
7. **Regras intactas:** `git diff BASE --stat -- apps/trabalhador packages supabase` vazio; nos e2e adaptados, nenhuma conferência no banco mudou (D19). Entrega.
8. **Menu recolhido:** abre recolhido no Treinar; abrir vale só nesta tela. Task 2.

---

## Mapa de arquivos

Todos os caminhos `treinar-agente/…` são `apps/painel/src/app/(painel)/treinar-agente/…`.

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `treinar-agente/tela.ts` (+ `tela.test.ts`) (novos) | regras puras: ensinada, a preencher, contagens, medidor compacto, quando, histórico, rótulo do simulador, comparar, empresa do teste, rascunho do formulário | 1 |
| `src/components/layout/menu-tela.ts`, `menu-tela-treinar.test.ts` (novo); `src/styles/tokens.css`, `src/app/globals.css`, `src/styles/largura-treinar.test.ts` (novo) | menu recolhido no Treinar; larguras da lista e do simulador | 2 |
| `treinar-agente/chave-orientacao.tsx`, `medidor-compacto.tsx` (novo), `lista-orientacoes.tsx` (novo) | coluna da lista | 3 |
| `src/components/patterns/formulario-alteravel.tsx` (só `useAlteracoes`), `treinar-agente/rascunho-ao-vivo.ts`, `editor-orientacao.tsx`, `cabecalho-editor.tsx`, `historico-tabela.tsx` (novos) | editor, cabeçalho, histórico, regras fixas | 4 |
| `treinar-agente/use-simulacao.ts`, `simulador.tsx` (novos) | simulador sempre visível, comparação | 5 |
| `treinar-agente/page.tsx`, `loading.tsx` (reescritos), `hidratado.tsx` (novo), `acoes.ts` (sai `empresasParaTeste`); saem `formulario-orientacao.tsx`, `historico-orientacao.tsx`, `abas-orientacao.tsx`, `medidor.tsx`, `testar-agente.tsx`; `e2e/apoio-treinar.ts`, `e2e/treinar-simulador.spec.ts` (novos) | tela de três colunas e e2e novos | 6 |
| `e2e/treinar-agente.spec.ts`, `e2e/testar-agente.spec.ts`, `e2e/ensinar-agente.spec.ts`, `e2e/acessibilidade.spec.ts` | adaptação dos e2e da tela antiga (D19) | 7 |
| `docs/design-system.md`, `docs/operacao.md` | manuais | 8 |

---

### Task 1: Regras puras da tela

**Files:**
- Create: `apps/painel/src/app/(painel)/treinar-agente/tela.ts`, `apps/painel/src/app/(painel)/treinar-agente/tela.test.ts`

**Interfaces:**
- Consumes: `OrientacaoForm`, `ehUuid` (`./esquemas`); `rascunhoDoFormulario`, `RascunhoTeste` (`./simulacao`); `mesmoConteudo`, `resumoVersao`, `Versao` (`./versoes`); `LIMITE_ORIENTACOES`, `Medidor`, `TipoOrientacao` (`lib/orientacoes`); `formatarData`, `formatarHora` (`lib/formatos`).
- Produces: `FAIXA_TIPO`, `ROTULO_CURTO_TIPO`, `ehEnsinada`, `camposAPreencher`, `contarSituacao`, `textoMedidor`, `quandoHistorico`, `LinhaHistorico`, `linhasHistorico`, `textoCriacao`, `rotuloSimulador`, `ConteudoSalvo`, `podeCompararSemRascunho`, `EscolhaEmpresa`, `empresaDoTeste`, `empresaDoFormulario`, `CampoRascunho`, `LeituraRascunho`, `lerRascunho`.

- [ ] **Passo 1: escrever o teste que falha**

`apps/painel/src/app/(painel)/treinar-agente/tela.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  camposAPreencher, contarSituacao, ehEnsinada, empresaDoFormulario, empresaDoTeste, lerRascunho, linhasHistorico,
  podeCompararSemRascunho, quandoHistorico, rotuloSimulador, textoCriacao, textoMedidor,
} from './tela';
import type { Versao } from './versoes';

const ID = '4f1c2b7e-8a9d-4e3f-9b1a-2c3d4e5f6a7b';
const EMPRESA = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe('ehEnsinada (D8)', () => {
  it('o formato do "Ensinar o agente", com e sem situação (CRLF conta como uma quebra)', () => {
    expect(ehEnsinada('Situação: Cliente: “quero nota”\nO que fazer: Confirme com a equipe.')).toBe(true);
    expect(ehEnsinada('Situação: linha 1\nlinha 2\r\nO que fazer: x')).toBe(true);
    expect(ehEnsinada('O que fazer: Mande pelo WhatsApp.')).toBe(true);
  });
  it('texto escrito na tela não é', () => {
    expect(ehEnsinada('Comece sempre pelo nome do cliente.')).toBe(false);
    expect(ehEnsinada('Situação: sem o que fazer')).toBe(false);
    expect(ehEnsinada('Quando pedirem, O que fazer: x')).toBe(false);
  });
});

describe('camposAPreencher (D17) e contarSituacao (D16)', () => {
  it('conta "(a preencher)" sem diferenciar maiúsculas', () => {
    expect(camposAPreencher('Endereço: (a preencher)\nPix: (A preencher)')).toBe(2);
    expect(camposAPreencher('Tudo preenchido.')).toBe(0);
  });
  it('todas, ligadas e desligadas', () => {
    expect(contarSituacao([{ ativo: true }, { ativo: false }, { ativo: false }])).toEqual({ todas: 3, ligadas: 1, desligadas: 2 });
    expect(contarSituacao([])).toEqual({ todas: 0, ligadas: 0, desligadas: 0 });
  });
});

describe('textoMedidor', () => {
  it('zerado, sem aviso', () => {
    expect(textoMedidor({ total: 0, nivel: 'ok' }, null)).toEqual({ valor: '0 / 12.000', percentual: '0%', descricao: '0 de 12.000 caracteres', aviso: null });
  });
  it('perto do limite, com a empresa que pesa', () => {
    expect(textoMedidor({ total: 9940, nivel: 'aviso' }, 'Rede Bom Preço')).toEqual({
      valor: '9.940 / 12.000', percentual: '83%', descricao: '9.940 de 12.000 caracteres', aviso: 'Perto do limite (conta com Rede Bom Preço)',
    });
  });
  it('passou do limite: o percentual passa de 100 no texto', () => {
    expect(textoMedidor({ total: 12500, nivel: 'excesso' }, null)).toMatchObject({
      percentual: '104%', aviso: 'Passou do limite: as orientações para todos mais antigas ficam de fora.',
    });
  });
});

describe('histórico (D15)', () => {
  const agora = new Date('2026-10-11T20:00:00Z');
  it('"hoje HH:MM" ou "dd/mm HH:MM", no horário de Brasília', () => {
    expect(quandoHistorico('2026-10-11T18:10:00Z', agora)).toBe('hoje 15:10');
    expect(quandoHistorico('2026-09-29T17:52:00Z', agora)).toBe('29/09 14:52');
  });

  const v = (id: string, acao: Versao['acao'], texto: string, ativo: boolean, criadoEm: string, usuario: string | null = 'Ana'): Versao => ({
    id, acao, titulo: 'Prazo', texto, tipo: 'regra', clienteId: null, setorId: null, ativo, usuario, criadoEm,
  });
  const versoes = [
    v('3', 'ligar', 'B', true, '2026-10-11T18:10:00Z'),
    v('2', 'editar', 'B', false, '2026-10-11T17:58:00Z'),
    v('1', 'criar', 'A', false, '2026-09-29T17:52:00Z', null),
  ];
  const atual = { titulo: 'Prazo', texto: 'B', tipo: 'regra' as const, clienteId: null, setorId: null };

  it('resumo de hoje + "por", "atual" na mais nova, restaurar só onde o conteúdo difere; a criação ensinada diz "no Atendimento"', () => {
    expect(linhasHistorico(versoes, atual, true, agora)).toEqual([
      { id: '3', quando: 'hoje 15:10', resumo: 'Ligou', por: 'por Ana', atual: true, podeRestaurar: false },
      { id: '2', quando: 'hoje 14:58', resumo: 'Editou: texto', por: 'por Ana', atual: false, podeRestaurar: false },
      { id: '1', quando: '29/09 14:52', resumo: 'Criou (desligada) no Atendimento', por: 'por pessoa removida', atual: false, podeRestaurar: true },
    ]);
    expect(linhasHistorico(versoes, atual, false, agora)[2]!.resumo).toBe('Criou (desligada)');
  });

  it('textoCriacao', () => {
    expect(textoCriacao('Ana', true)).toBe('Criada por Ana no Atendimento');
    expect(textoCriacao('Ana', false)).toBe('Criada por Ana');
    expect(textoCriacao(null, true)).toBe('Criada no Atendimento');
  });
});

describe('simulador', () => {
  it('rótulo do que entra no teste (D10)', () => {
    expect(rotuloSimulador({ aberta: null, alterado: false })).toBe('orientações ligadas, sem rascunho');
    expect(rotuloSimulador({ aberta: 'nova', alterado: false })).toBe('usando o rascunho, ligado');
    expect(rotuloSimulador({ aberta: 'salva', alterado: true })).toBe('usando o rascunho, ligado');
    expect(rotuloSimulador({ aberta: 'salva', alterado: false })).toBe('usando esta orientação, ligada');
  });

  const rascunho = { id: ID, titulo: 'Prazo', texto: 'Até as 15h.', tipo: 'regra' as const, cliente_id: null, setor_id: null };
  const salva = { titulo: 'Prazo', texto: 'Até as 15h.', tipo: 'regra' as const, clienteId: null, setorId: null, ativo: true };

  it('"Sem o rascunho" só quando o teste usou algo diferente do que o agente já lê (D4)', () => {
    expect(podeCompararSemRascunho(null, salva)).toBe(false);
    expect(podeCompararSemRascunho(rascunho, null)).toBe(true);
    expect(podeCompararSemRascunho(rascunho, { ...salva, ativo: false })).toBe(true);
    expect(podeCompararSemRascunho(rascunho, salva)).toBe(false);
    expect(podeCompararSemRascunho({ ...rascunho, texto: 'Até as 16h.' }, salva)).toBe(true);
    expect(podeCompararSemRascunho({ ...rascunho, cliente_id: EMPRESA }, salva)).toBe(true);
  });

  it('empresa do teste: a do rascunho (se ativa) até a pessoa escolher (D11)', () => {
    const ativas = new Set([EMPRESA]);
    expect(empresaDoTeste({ manual: false }, EMPRESA, ativas)).toBe(EMPRESA);
    expect(empresaDoTeste({ manual: false }, ID, ativas)).toBeNull();
    expect(empresaDoTeste({ manual: false }, null, ativas)).toBeNull();
    expect(empresaDoTeste({ manual: true, id: null }, EMPRESA, ativas)).toBeNull();
    expect(empresaDoTeste({ manual: true, id: EMPRESA }, null, ativas)).toBe(EMPRESA);
  });

  it('empresaDoFormulario: só com "Uma empresa" e um id', () => {
    expect(empresaDoFormulario(form({ vale: 'empresa', cliente_id: EMPRESA }))).toBe(EMPRESA);
    expect(empresaDoFormulario(form({ vale: 'todos', cliente_id: EMPRESA }))).toBeNull();
    expect(empresaDoFormulario(form({ vale: 'empresa', cliente_id: '' }))).toBeNull();
  });

  it('lerRascunho: o formulário como está vira o rascunho do teste (D9)', () => {
    expect(lerRascunho(form({ titulo: ' Prazo ', texto: 'Até as 15h.\r\nDepois, amanhã.', tipo: 'regra', vale: 'empresa', cliente_id: EMPRESA, setor_id: '' }), ID)).toEqual({
      ok: true, clienteId: EMPRESA,
      rascunho: { id: ID, titulo: 'Prazo', texto: 'Até as 15h.\nDepois, amanhã.', tipo: 'regra', cliente_id: EMPRESA, setor_id: null },
    });
    expect(lerRascunho(form({ titulo: '', texto: 'x', tipo: 'regra', vale: 'todos' }), null))
      .toEqual({ ok: false, erro: 'Informe o título da orientação.', campo: 'titulo' });
    expect(lerRascunho(form({ titulo: 'Prazo', texto: ' ', tipo: 'regra', vale: 'todos' }), null))
      .toEqual({ ok: false, erro: 'Escreva o texto da orientação.', campo: 'texto' });
    expect(lerRascunho(form({ titulo: 'Prazo', texto: 'x', tipo: 'regra', vale: 'empresa', cliente_id: '' }), null))
      .toEqual({ ok: false, erro: 'Escolha a empresa.', campo: 'empresa' });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/treinar-agente/tela.test.ts"`
Expected: FAIL (`./tela` não existe).

- [ ] **Passo 3: implementar**

`apps/painel/src/app/(painel)/treinar-agente/tela.ts`:

```ts
import { formatarData, formatarHora } from '../../../lib/formatos';
import { LIMITE_ORIENTACOES, type Medidor, type TipoOrientacao } from '../../../lib/orientacoes';
import { ehUuid, OrientacaoForm } from './esquemas';
import { rascunhoDoFormulario, type RascunhoTeste } from './simulacao';
import { mesmoConteudo, resumoVersao, type Versao } from './versoes';

/** Treinar o agente, Opção B "Editor com simulador" (spec 7C.5): regras puras da tela de três colunas. */

const numero = (n: number) => n.toLocaleString('pt-BR');

/** Faixa de cor de cada tipo na lista (cores da imagem em tokens existentes; a legenda escreve o nome). D16 */
export const FAIXA_TIPO: Record<TipoOrientacao, string> = { jeito: 'bg-warning', regra: 'bg-brand', situacao: 'bg-info' };
export const ROTULO_CURTO_TIPO: Record<TipoOrientacao, string> = { jeito: 'Jeito', regra: 'Regra', situacao: 'Situação' };

/** Criada pelo "Ensinar o agente": o texto nasce "Situação: …\nO que fazer: …" ou "O que fazer: …" (comporTexto). D8 */
export function ehEnsinada(textoDaCriacao: string): boolean {
  const t = textoDaCriacao.replace(/\r\n?/g, '\n');
  return t.startsWith('O que fazer: ') || /^Situação: [\s\S]*\nO que fazer: /.test(t);
}

/** Quantos "(a preencher)" o texto ainda tem (orientações da skill do dono). D17 */
export function camposAPreencher(texto: string): number {
  return texto.match(/\(a preencher\)/gi)?.length ?? 0;
}

export function contarSituacao(linhas: readonly { ativo: boolean }[]) {
  const ligadas = linhas.filter((l) => l.ativo).length;
  return { todas: linhas.length, ligadas, desligadas: linhas.length - ligadas };
}

/** Medidor compacto: "9.940 / 12.000", "83%", a frase para leitor de tela e o aviso de uma linha (a partir de 80%). */
export function textoMedidor(m: Pick<Medidor, 'total' | 'nivel'>, empresa: string | null, limite = LIMITE_ORIENTACOES) {
  const conta = empresa ? ` (conta com ${empresa})` : '';
  return {
    valor: `${numero(m.total)} / ${numero(limite)}`,
    percentual: `${Math.round((m.total / limite) * 100)}%`,
    descricao: `${numero(m.total)} de ${numero(limite)} caracteres`,
    aviso: m.nivel === 'excesso'
      ? `Passou do limite${conta}: as orientações para todos mais antigas ficam de fora.`
      : m.nivel === 'aviso' ? `Perto do limite${conta}` : null,
  };
}

/** "hoje 15:10" ou "29/09 15:10" (Brasília): coluna de quando, no histórico. */
export function quandoHistorico(iso: string, agora: Date = new Date()): string {
  const dia = formatarData(iso);
  if (!dia) return '';
  return dia === formatarData(agora) ? `hoje ${formatarHora(iso)}` : `${dia.slice(0, 5)} ${formatarHora(iso)}`;
}

export type LinhaHistorico = { id: string; quando: string; resumo: string; por: string; atual: boolean; podeRestaurar: boolean };
type Conteudo = Pick<Versao, 'titulo' | 'texto' | 'tipo' | 'clienteId' | 'setorId'>;

/** Linhas do histórico (a mais nova primeiro). Restaurar só onde o conteúdo difere do atual, como hoje. D15 */
export function linhasHistorico(versoes: readonly Versao[], atual: Conteudo, ensinada: boolean, agora: Date = new Date()): LinhaHistorico[] {
  return versoes.map((v, i) => ({
    id: v.id,
    quando: quandoHistorico(v.criadoEm, agora),
    resumo: `${resumoVersao(versoes, i)}${ensinada && v.acao === 'criar' ? ' no Atendimento' : ''}`,
    por: `por ${v.usuario ?? 'pessoa removida'}`,
    atual: i === 0,
    podeRestaurar: !mesmoConteudo(v, atual),
  }));
}

/** Linha embaixo do título: "Criada por Ana no Atendimento", "Criada por Ana" ou "Criada no Atendimento". D8 */
export function textoCriacao(criadoPor: string | null, ensinada: boolean): string {
  return `Criada${criadoPor ? ` por ${criadoPor}` : ''}${ensinada ? ' no Atendimento' : ''}`;
}

/** Selo do simulador: o que entra no teste. D10 */
export function rotuloSimulador(e: { aberta: 'nova' | 'salva' | null; alterado: boolean }): string {
  if (e.aberta === null) return 'orientações ligadas, sem rascunho';
  if (e.aberta === 'nova' || e.alterado) return 'usando o rascunho, ligado';
  return 'usando esta orientação, ligada';
}

export type ConteudoSalvo = Conteudo & { ativo: boolean };

/** "Sem o rascunho" só quando o teste usou algo diferente do que o agente já lê (nova, desligada ou alterada). D4 */
export function podeCompararSemRascunho(rascunho: RascunhoTeste | null, salva: ConteudoSalvo | null): boolean {
  if (!rascunho) return false;
  if (!salva || !salva.ativo) return true;
  return !mesmoConteudo(
    { titulo: rascunho.titulo, texto: rascunho.texto, tipo: rascunho.tipo, clienteId: rascunho.cliente_id, setorId: rascunho.setor_id },
    salva,
  );
}

export type EscolhaEmpresa = { manual: false } | { manual: true; id: string | null };

/** Empresa do teste: a do rascunho (se ativa) até a pessoa escolher no simulador. D11 */
export function empresaDoTeste(escolha: EscolhaEmpresa, doRascunho: string | null, ativas: ReadonlySet<string>): string | null {
  const id = escolha.manual ? escolha.id : doRascunho;
  return id && ativas.has(id) ? id : null;
}

/** A empresa do "vale para" do formulário, mesmo com outros campos incompletos. */
export function empresaDoFormulario(dados: FormData): string | null {
  const id = dados.get('cliente_id');
  return dados.get('vale') === 'empresa' && typeof id === 'string' && ehUuid(id) ? id : null;
}

export type CampoRascunho = 'titulo' | 'texto' | 'empresa' | 'setor';
export type LeituraRascunho =
  | { ok: true; rascunho: RascunhoTeste; clienteId: string | null }
  | { ok: false; erro: string; campo: CampoRascunho | null };

const CAMPO_DO_ERRO: [RegExp, CampoRascunho][] = [[/título/i, 'titulo'], [/texto/i, 'texto'], [/empresa/i, 'empresa'], [/setor/i, 'setor']];

/** O formulário do meio, como está, vira o rascunho do teste (sem salvar). Incompleto: o motivo e o campo. D9 */
export function lerRascunho(dados: FormData, id: string | null): LeituraRascunho {
  const d = OrientacaoForm.safeParse(dados);
  if (!d.success) {
    const erro = d.error.issues[0]?.message ?? 'Confira os campos da orientação.';
    return { ok: false, erro, campo: CAMPO_DO_ERRO.find(([r]) => r.test(erro))?.[1] ?? null };
  }
  return { ok: true, rascunho: rascunhoDoFormulario(d.data, id), clienteId: d.data.clienteId };
}
```

- [ ] **Passo 4: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/treinar-agente"`
Expected: PASS (inclusive `acoes.test.ts`, `esquemas.test.ts`, `simulacao.test.ts`, `ensinar.test.ts`, sem edição).

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/treinar-agente/tela.ts" "apps/painel/src/app/(painel)/treinar-agente/tela.test.ts"
git commit -m "feat(painel): regras do Treinar o agente em três colunas — ensinada no Atendimento, a preencher, medidor compacto, histórico, simulador e comparação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Casca. Menu recolhido no Treinar o agente e larguras das colunas

**Files:**
- Modify: `apps/painel/src/components/layout/menu-tela.ts`, `apps/painel/src/styles/tokens.css`, `apps/painel/src/app/globals.css`
- Create: `apps/painel/src/components/layout/menu-tela-treinar.test.ts`, `apps/painel/src/styles/largura-treinar.test.ts`

**Interfaces:**
- Produces: `telaComMenuRecolhido('/treinar-agente') === true`; `telaRecolhida('/treinar-agente') === 'treinar-agente'` (o `app-shell.tsx` da G4 já esquece o "aberto aqui" ao trocar de tela: não muda); utilitários `w-lista-treinar` e `w-simulador-treinar`.

- [ ] **Passo 1: escrever os testes que falham**

`apps/painel/src/components/layout/menu-tela-treinar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { menuRecolhidoVisivel, telaComMenuRecolhido, telaRecolhida } from './menu-tela';

describe('menu recolhido também no Treinar o agente (spec 7C.5, D18)', () => {
  it('Treinar o agente recolhe (a consulta da URL não entra no caminho)', () => {
    expect(telaComMenuRecolhido('/treinar-agente')).toBe(true);
    expect(telaComMenuRecolhido('/treinar-agentes')).toBe(false);
    expect(menuRecolhidoVisivel('/treinar-agente', false, false)).toBe(true);
    expect(menuRecolhidoVisivel('/treinar-agente', false, true)).toBe(false);
  });
  it('telaRecolhida separa o Treinar das outras telas recolhidas', () => {
    expect(telaRecolhida('/treinar-agente')).toBe('treinar-agente');
    expect(telaRecolhida('/assistente')).toBe('assistente');
    expect(telaRecolhida('/configuracoes')).toBeNull();
  });
});
```

`apps/painel/src/styles/largura-treinar.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('larguras do Treinar o agente (spec 7C.5, imagem B)', () => {
  it('tokens em rem (acompanham a letra) e utilitários w-lista-treinar e w-simulador-treinar', () => {
    expect(tokens).toMatch(/--training-list-width:\s*calc\(330rem \/ 14\)/);
    expect(tokens).toMatch(/--training-simulator-width:\s*calc\(410rem \/ 14\)/);
    expect(globais).toMatch(/--spacing-lista-treinar:\s*var\(--training-list-width\)/);
    expect(globais).toMatch(/--spacing-simulador-treinar:\s*var\(--training-simulator-width\)/);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/components/layout/menu-tela-treinar.test.ts src/styles/largura-treinar.test.ts`
Expected: FAIL.

- [ ] **Passo 3: `menu-tela.ts`**

Troque a primeira função (e o comentário de cima) por:

```ts
// Telas de três colunas abrem com o menu recolhido (spec 4.3; Assistente, 7C.3; Treinar o agente, 7C.5). Abrir o menu ali vale só até sair da tela (P17).
export function telaComMenuRecolhido(caminho: string): boolean {
  return caminho === '/atendimento' || caminho.startsWith('/atendimento/') || caminho === '/assistente' || caminho === '/treinar-agente';
}
```

`telaRecolhida` e `menuRecolhidoVisivel` ficam como estão.

- [ ] **Passo 4: tokens e utilitários**

Em `apps/painel/src/styles/tokens.css`, logo depois da linha `--assistant-chat-width: …`:

```css
  --training-list-width: calc(330rem / 14); /* lista de orientações do Treinar o agente (utilitário w-lista-treinar) */
  --training-simulator-width: calc(410rem / 14); /* simulador do Treinar o agente (utilitário w-simulador-treinar) */
```

Em `apps/painel/src/app/globals.css`, logo depois de `--spacing-chat-assistente: var(--assistant-chat-width);`:

```css
  --spacing-lista-treinar: var(--training-list-width);
  --spacing-simulador-treinar: var(--training-simulator-width);
```

- [ ] **Passo 5: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/components/layout src/styles`
Expected: PASS (inclusive `menu-tela.test.ts`, `menu-tela-assistente.test.ts`, `trilha.test.ts`, `escala.test.ts` e `tokens.test.ts`, sem edição).

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/components/layout/menu-tela.ts apps/painel/src/components/layout/menu-tela-treinar.test.ts apps/painel/src/styles/tokens.css apps/painel/src/app/globals.css apps/painel/src/styles/largura-treinar.test.ts
git commit -m "feat(painel): menu recolhido também no Treinar o agente e larguras da lista e do simulador como tokens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Coluna da lista (medidor compacto, filtros, faixa por tipo, chave, "do Atendimento")

**Files:**
- Modify: `apps/painel/src/app/(painel)/treinar-agente/chave-orientacao.tsx`
- Create: `apps/painel/src/app/(painel)/treinar-agente/medidor-compacto.tsx`, `apps/painel/src/app/(painel)/treinar-agente/lista-orientacoes.tsx`

**Interfaces:**
- Consumes: `textoMedidor`, `camposAPreencher`, `FAIXA_TIPO`, `ROTULO_CURTO_TIPO` (Task 1); `ChaveOrientacao`.
- Produces: `ChaveOrientacao` com `mostrarTexto?: boolean` (padrão `true`); `MedidorCompacto({ medidor, empresa })`; `ItemLista`; `ListaOrientacoes(props)` — região "Orientações", `h1` com nome "Treinar o agente N", link "Nova orientação", progressbar "Espaço usado pelas orientações ligadas" (`aria-valuetext` "N de 12.000 caracteres"), filtros com `data-filtro` (`todas|ligadas|desligadas`) e `data-contagem`, lista "Orientações do agente" com um `listitem` por orientação (`data-orientacao`).

- [ ] **Passo 1: `chave-orientacao.tsx`**

1. Troque a assinatura por:

```tsx
export function ChaveOrientacao({ id, titulo, ligada, mostrarTexto = true }: { id: string; titulo: string; ligada: boolean; mostrarTexto?: boolean }) {
```

2. Troque a linha do texto ao lado da chave por:

```tsx
      {mostrarTexto && <span className={cn('text-sm', estado ? 'text-agent-active' : 'text-muted')}>{estado ? 'Ligada' : 'Desligada'}</span>}
```

3. No comentário do componente, troque "na própria linha da tabela" por "na linha da lista e no alto do editor".

- [ ] **Passo 2: `medidor-compacto.tsx`**

```tsx
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Medidor } from '@/lib/orientacoes';
import { textoMedidor } from './tela';

/**
 * Medidor compacto do alto da lista (spec 7C.5): a conversa mais pesada (gerais + setor + a empresa com mais texto)
 * contra o limite de 12.000 caracteres. Aviso de uma linha a partir de 80%; no limite, o que fica de fora.
 */
export function MedidorCompacto({ medidor, empresa }: { medidor: Medidor; empresa: string | null }) {
  const t = textoMedidor(medidor, empresa);
  const cor = medidor.nivel === 'excesso' ? 'bg-danger' : medidor.nivel === 'aviso' ? 'bg-warning' : 'bg-brand';
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-xs font-bold uppercase tracking-wide text-brand">Espaço usado</span>
        <span className="tabular text-foreground"><span className="font-bold">{t.valor}</span> · {t.percentual}</span>
      </p>
      <div
        role="progressbar"
        aria-label="Espaço usado pelas orientações ligadas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={medidor.percentual}
        aria-valuetext={t.descricao}
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
      >
        <div className={cn('h-full rounded-full', cor)} style={{ width: `${medidor.percentual}%` }} />
      </div>
      {t.aviso && (
        <p className={cn('flex items-start gap-1.5 text-sm', medidor.nivel === 'excesso' ? 'text-danger' : 'text-warning')}>
          {medidor.nivel === 'excesso'
            ? <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            : <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />}
          {t.aviso}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Passo 3: `lista-orientacoes.tsx`**

```tsx
import { Building2, FilterX, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { EmptyState } from '@/components/patterns/empty-state';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { ROTULO_TIPO, TIPOS, type Medidor, type TipoOrientacao } from '@/lib/orientacoes';
import { ChaveOrientacao } from './chave-orientacao';
import { MedidorCompacto } from './medidor-compacto';
import { camposAPreencher, FAIXA_TIPO, ROTULO_CURTO_TIPO } from './tela';

export type ItemLista = {
  id: string;
  titulo: string;
  texto: string;
  tipo: TipoOrientacao;
  ativo: boolean;
  ensinada: boolean;
  clienteId: string | null;
  setorId: string | null;
  empresa: { nome: string; ativa: boolean } | null;
  setor: { nome: string; ativo: boolean } | null;
};

type Filtro = 'ligadas' | 'desligadas' | null;

/** O que fica embaixo do título: o que falta preencher (D17), a empresa, o setor ou "Todos os clientes". */
function Detalhe({ l }: { l: ItemLista }) {
  const faltam = camposAPreencher(l.texto);
  if (faltam > 0) return <span className="truncate font-semibold text-warning">{faltam === 1 ? '1 campo a preencher' : `${faltam} campos a preencher`}</span>;
  if (l.clienteId) {
    return (
      <span className="flex min-w-0 items-center gap-1">
        <Building2 aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
        <span className="truncate">{l.empresa?.nome ?? 'Empresa removida'}</span>
        {l.empresa && !l.empresa.ativa && <Badge variant="outline">arquivada</Badge>}
      </span>
    );
  }
  if (l.setorId) return <span className="truncate">Setor {l.setor?.nome ?? 'removido'}{l.setor && !l.setor.ativo ? ' (inativo)' : ''}</span>;
  return <span className="truncate">Todos os clientes</span>;
}

/**
 * Coluna da lista (spec 7C.5, imagem B): "Treinar N" + NOVA, medidor compacto, busca, Todas · Ligadas · Desligadas,
 * legenda das cores e uma linha por orientação (faixa do tipo, título, detalhe, "do Atendimento" e a chave).
 * A chave fica fora do link (dois controles não se aninham).
 */
export function ListaOrientacoes({
  linhas, total, contagem, filtro, busca, aberta, orientacaoNaUrl, medidor, empresaMaisPesada, erro, aviso, hrefOrientacao, hrefFiltro, hrefNova,
}: {
  linhas: ItemLista[];
  total: number;
  contagem: { todas: number; ligadas: number; desligadas: number };
  filtro: Filtro;
  busca: string;
  aberta: string | null;
  /** O valor de ?orientacao= (inclusive "nova"), mantido pela busca. */
  orientacaoNaUrl: string | null;
  medidor: Medidor;
  empresaMaisPesada: string | null;
  erro: string | null;
  aviso: string | null;
  hrefOrientacao: (id: string) => string;
  hrefFiltro: (filtro: Filtro) => string;
  hrefNova: string;
}) {
  const filtros: { valor: Filtro; rotulo: string; n: number | null; chave: string }[] = [
    { valor: null, rotulo: 'Todas', n: null, chave: 'todas' },
    { valor: 'ligadas', rotulo: 'Ligadas', n: contagem.ligadas, chave: 'ligadas' },
    { valor: 'desligadas', rotulo: 'Desligadas', n: contagem.desligadas, chave: 'desligadas' },
  ];
  return (
    <section aria-label="Orientações" className="flex min-h-0 flex-col border-border bg-surface max-lg:border-b lg:w-lista-treinar lg:shrink-0 lg:border-r">
      <div className="flex flex-col gap-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold text-foreground">
            Treinar<span className="sr-only"> o agente</span> <span className="tabular font-light text-brand">{total}</span>
          </h1>
          <Link href={hrefNova} scroll={false} aria-label="Nova orientação" className={variantesBotao({ size: 'sm' })}>
            <Plus aria-hidden size={16} strokeWidth={1.75} />
            Nova
          </Link>
        </div>
        <MedidorCompacto medidor={medidor} empresa={empresaMaisPesada} />
        {aviso && <p className="text-sm text-warning">{aviso}</p>}
        <form role="search" action="/treinar-agente" className="relative">
          {orientacaoNaUrl && <input type="hidden" name="orientacao" value={orientacaoNaUrl} />}
          {filtro && <input type="hidden" name="ativo" value={filtro} />}
          <Search aria-hidden size={16} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <Input type="search" name="q" defaultValue={busca} aria-label="Buscar orientação" placeholder="Buscar orientação" className="pl-9" />
        </form>
        <nav aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
          {filtros.map((x) => (
            <Link
              key={x.chave}
              href={hrefFiltro(x.valor)}
              scroll={false}
              aria-current={filtro === x.valor ? 'page' : undefined}
              data-filtro={x.chave}
              data-contagem={x.n ?? contagem.todas}
              className={cn(
                'rounded-md border px-3 py-1 text-sm font-semibold transition-colors duration-150 ease-out',
                filtro === x.valor ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-muted',
              )}
            >
              {x.rotulo}{x.n !== null && <> <span className="tabular">{x.n}</span></>}
            </Link>
          ))}
        </nav>
        <p className="flex flex-wrap gap-3 text-xs text-muted">
          {TIPOS.map((t) => (
            <span key={t} className="flex items-center gap-1">
              <span aria-hidden className={cn('size-2 rounded-full', FAIXA_TIPO[t])} />
              {ROTULO_CURTO_TIPO[t]}
            </span>
          ))}
        </p>
      </div>
      {erro ? (
        <p role="alert" className="p-4 text-sm text-danger">{erro}</p>
      ) : total === 0 ? (
        <p className="p-4 text-sm text-muted">A lista está vazia: comece por um exemplo ao lado.</p>
      ) : linhas.length === 0 ? (
        <EmptyState
          icone={FilterX}
          titulo="Nenhuma orientação neste filtro."
          descricao="Tente outro filtro ou limpe a busca."
          acao={<Link href="/treinar-agente" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>}
        />
      ) : (
        <ul aria-label="Orientações do agente" className="min-h-0 flex-1 overflow-y-auto">
          {linhas.map((l) => (
            <li
              key={l.id}
              data-orientacao={l.id}
              className={cn('relative flex items-center gap-3 border-b border-border py-3 pr-3 pl-5', aberta === l.id && 'bg-brand-soft')}
            >
              <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', FAIXA_TIPO[l.tipo])} />
              <Link href={hrefOrientacao(l.id)} scroll={false} aria-current={aberta === l.id ? 'true' : undefined} className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-sm">
                <span className="truncate font-semibold text-foreground">{l.titulo}</span>
                <span className="flex min-w-0 items-center gap-1 text-sm text-muted">
                  <Detalhe l={l} />
                  {l.ensinada && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="shrink-0 font-semibold text-info">do Atendimento</span>
                    </>
                  )}
                </span>
                <span className="sr-only">{ROTULO_TIPO[l.tipo]}</span>
              </Link>
              <ChaveOrientacao id={l.id} titulo={l.titulo} ligada={l.ativo} mostrarTexto={false} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Passo 4: conferir os tipos**

Run: `pnpm --filter @escritorio/painel typecheck`
Expected: sem erros (a página ainda usa a tela antiga; os componentes novos só ficam prontos).

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/treinar-agente/chave-orientacao.tsx" "apps/painel/src/app/(painel)/treinar-agente/medidor-compacto.tsx" "apps/painel/src/app/(painel)/treinar-agente/lista-orientacoes.tsx"
git commit -m "feat(painel): lista enxuta do Treinar o agente — medidor compacto, Todas/Ligadas/Desligadas, faixa por tipo, chave e do Atendimento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Editor (SALVAR DESLIGADA / SALVAR E LIGAR, DESCARTAR, cabeçalho, histórico em tabela, regras fixas)

**Files:**
- Modify: `apps/painel/src/components/patterns/formulario-alteravel.tsx` (só acrescenta `useAlteracoes`)
- Create: `apps/painel/src/app/(painel)/treinar-agente/rascunho-ao-vivo.ts`, `editor-orientacao.tsx`, `cabecalho-editor.tsx`, `historico-tabela.tsx`

**Interfaces:**
- Consumes: `FormularioAlteravel`, `useAlteracoes` (novo), `EscolherEmpresa`, `FormField`, `ROTULO_CURTO_TIPO`, `textoCriacao`, `LinhaHistorico` (Task 1), `ChaveOrientacao`, `ConfirmDialog`, `DESCRICAO_TIPO` (`opcoes.ts`), `classeSelect` (`../clientes/estilos`).
- Produces: `ID_FORM_ORIENTACAO = 'form-orientacao'`, `EVENTO_RASCUNHO = 'treinar:rascunho'`, `avisarRascunho()`; `EditorOrientacao({ acao, orientacao?, empresas, setores, aviso?, avisoEmpresas? })` e os tipos `SetorOpcao`, `DadosFormulario` (sem `ativo`); `CabecalhoEditor`, `RegrasFixas`; `HistoricoTabela({ linhas, versoes, ligada, valePara, restaurar, aviso? })`. Nomes acessíveis: campos "Título", "O que o agente deve fazer", rádios "Jeito de atender"/"Regra do escritório"/"Situação específica", "Todos os clientes"/"Uma empresa"/"Um setor", busca "Empresa", select "Setor"; botões "Descartar", "Salvar desligada", "Salvar e ligar"; aviso "Rascunho não salvo — o simulador já usa este texto"; título do histórico "Histórico · N versões"; botão "Restaurar esta versão".

- [ ] **Passo 1: `useAlteracoes` em `formulario-alteravel.tsx`**

Logo depois da função `useContagem`, acrescente:

```tsx
/** Quantos campos do formulário em volta (inteiro, sem escopo) têm alteração não salva: para quem mostra o próprio aviso ou desliga um botão. */
export function useAlteracoes(): number {
  const ancora = useRef<Element | null>(null);
  return useContagem(ancora);
}
```

Nada mais muda no arquivo (`formulario-alteravel.test.ts` continua passando sem edição).

- [ ] **Passo 2: `rascunho-ao-vivo.ts`**

```ts
/** Editor e simulador do Treinar o agente (D11): o formulário tem este id e avisa por este evento a cada mudança. */
export const ID_FORM_ORIENTACAO = 'form-orientacao';
export const EVENTO_RASCUNHO = 'treinar:rascunho';

/** O simulador relê o formulário (empresa do teste e selo "usando o rascunho"). */
export function avisarRascunho(): void {
  window.dispatchEvent(new Event(EVENTO_RASCUNHO));
}
```

- [ ] **Passo 3: `editor-orientacao.tsx`**

```tsx
'use client';

import { LoaderCircle, Power, Save } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { FormularioAlteravel, useAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import { LIMITE_TEXTO, LIMITE_TITULO, ROTULO_TIPO, TIPOS, type TipoOrientacao } from '@/lib/orientacoes';
import { classeSelect } from '../clientes/estilos';
import type { ValePara } from './esquemas';
import { DESCRICAO_TIPO } from './opcoes';
import { avisarRascunho, ID_FORM_ORIENTACAO } from './rascunho-ao-vivo';
import { ROTULO_CURTO_TIPO } from './tela';

type Acao = (dados: FormData) => void | Promise<void>;
export type SetorOpcao = { id: string; nome: string; ativo: boolean };
export type DadosFormulario = { titulo: string; texto: string; tipo: TipoOrientacao; clienteId: string | null; setorId: string | null };

type PropsEditor = {
  acao: Acao;
  orientacao?: DadosFormulario;
  empresas: EmpresaOpcao[];
  setores: SetorOpcao[];
  aviso?: ReactNode;
  /** A lista de empresas veio incompleta (aviso discreto no campo). */
  avisoEmpresas?: string | null;
};

const ROTULO = 'text-sm font-semibold uppercase tracking-wide text-brand';
// Botões segmentados (imagem B): o rádio fica escondido e o rótulo inteiro é o alvo do clique.
const SEGMENTO = 'flex flex-1 cursor-pointer items-center justify-center border-l border-input px-3 py-2 text-sm font-semibold text-foreground first:border-l-0 has-checked:bg-brand has-checked:text-brand-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring';
// Rótulo curto na tela, nome completo para leitor de tela (D20).
const VALE: { valor: ValePara; antes: string; visivel: string; depois: string }[] = [
  { valor: 'todos', antes: '', visivel: 'Todos', depois: ' os clientes' },
  { valor: 'empresa', antes: 'Uma ', visivel: 'Empresa', depois: '' },
  { valor: 'setor', antes: 'Um ', visivel: 'Setor', depois: '' },
];

/** "Rascunho não salvo — o simulador já usa este texto" quando algum campo mudou. */
function AvisoRascunho() {
  const n = useAlteracoes();
  return (
    <p role="status" className="flex items-center gap-1.5 text-warning">
      {n > 0 && (
        <>
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
          Rascunho não salvo — o simulador já usa este texto
        </>
      )}
    </p>
  );
}

function BotaoDescartar({ aoDescartar }: { aoDescartar: () => void }) {
  const n = useAlteracoes();
  const { pending } = useFormStatus();
  return <Button type="button" variant="outline" disabled={n === 0 || pending} onClick={aoDescartar}>Descartar</Button>;
}

/** Os dois envios: o botão leva ativo=off|on (D12). Enquanto grava, os dois ficam desligados e o escolhido gira. */
function BotoesSalvar() {
  const { pending, data } = useFormStatus();
  const ligando = pending && data?.get('ativo') === 'on';
  const desligando = pending && !ligando;
  return (
    <>
      <Button type="submit" name="ativo" value="off" variant="outline" disabled={pending} aria-busy={desligando || undefined}>
        {desligando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Save aria-hidden size={16} strokeWidth={1.75} />}
        Salvar desligada
      </Button>
      <Button type="submit" name="ativo" value="on" disabled={pending} aria-busy={ligando || undefined}>
        {ligando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Power aria-hidden size={16} strokeWidth={1.75} />}
        Salvar e ligar
      </Button>
    </>
  );
}

function FormularioEditor({ acao, orientacao, empresas, setores, aviso, avisoEmpresas, aoDescartar }: PropsEditor & { aoDescartar: () => void }) {
  const id = useId();
  const valeInicial: ValePara = orientacao?.clienteId ? 'empresa' : orientacao?.setorId ? 'setor' : 'todos';
  const [vale, setVale] = useState<ValePara>(valeInicial);
  const [titulo, setTitulo] = useState(orientacao?.titulo.length ?? 0);
  const [caracteres, setCaracteres] = useState(orientacao?.texto.length ?? 0);
  // Setor inativo só aparece quando já é o da orientação (o banco recusa escolher um setor inativo).
  const opcoesSetor = setores.filter((s) => s.ativo || s.id === orientacao?.setorId);
  const [erroEmpresa, setErroEmpresa] = useState<string | null>(null);
  const [setorEscolhido, setSetorEscolhido] = useState(orientacao?.setorId ?? '');
  const campoSetor = useRef<HTMLSelectElement>(null);

  // Como a empresa: fora de "Um setor", o select volta ao valor inicial (não conta como alteração); a escolha volta depois.
  useEffect(() => {
    const el = campoSetor.current;
    const alvo = vale === 'setor' ? setorEscolhido : orientacao?.setorId ?? '';
    if (!el || el.value === alvo) return;
    el.value = alvo;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [vale, setorEscolhido, orientacao?.setorId]);

  // Montou (abriu, descartou ou voltou do servidor): o simulador relê o rascunho.
  useEffect(() => { avisarRascunho(); }, []);

  // Campos não controlados: o estado local só acompanha o "vale para" e os contadores.
  const sincronizar = (f: HTMLFormElement) => {
    const marcado = f.querySelector<HTMLInputElement>('input[name="vale"]:checked');
    if (marcado) setVale(marcado.value as ValePara);
    const t = f.elements.namedItem('titulo');
    if (t instanceof HTMLInputElement) setTitulo(t.value.length);
    const x = f.elements.namedItem('texto');
    if (x instanceof HTMLTextAreaElement) setCaracteres(x.value.length);
    avisarRascunho();
  };

  // Antes de enviar: "Uma empresa" sem empresa escolhida não sai (o erro do servidor limparia o que foi digitado).
  const faltaEmpresa = (form: HTMLFormElement) => {
    const empresa = form.elements.namedItem('cliente_id');
    if (vale === 'empresa' && empresa instanceof HTMLInputElement && !empresa.value) {
      setErroEmpresa('Escolha a empresa.');
      document.getElementById(`${id}-empresa`)?.focus();
      return true;
    }
    return false;
  };
  const conferir = (e: FormEvent<HTMLFormElement>) => {
    if (faltaEmpresa(e.currentTarget)) e.preventDefault();
  };
  // Enter no título não envia: o botão padrão seria SALVAR DESLIGADA e desligaria uma orientação ligada (D12).
  const semEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  return (
    <FormularioAlteravel
      id={ID_FORM_ORIENTACAO}
      action={acao}
      onSubmit={conferir}
      onInput={(e) => sincronizar(e.currentTarget)}
      onChange={(e) => sincronizar(e.currentTarget)}
      onReset={(e) => {
        const f = e.currentTarget;
        setTimeout(() => sincronizar(f), 0);
      }}
      className="flex flex-col gap-5 rounded-lg border border-border bg-surface p-5"
    >
      {aviso}
      <FormField id={`${id}-titulo`} rotulo="Título" ajuda={<span className="tabular">{titulo} / {LIMITE_TITULO}</span>} obrigatorio>
        <Input name="titulo" defaultValue={orientacao?.titulo} maxLength={LIMITE_TITULO} placeholder="Ex.: Cumprimento" autoComplete="off" onKeyDown={semEnter} />
      </FormField>

      <div className="grid gap-5 xl:grid-cols-2">
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(ROTULO, 'mb-2')}>Tipo</legend>
          <div className="flex overflow-hidden rounded-md border border-input bg-surface">
            {TIPOS.map((t) => (
              <label key={t} className={SEGMENTO} title={DESCRICAO_TIPO[t]}>
                <input type="radio" name="tipo" value={t} defaultChecked={(orientacao?.tipo ?? 'jeito') === t} required className="sr-only" />
                {ROTULO_CURTO_TIPO[t]}
                <span className="sr-only">{ROTULO_TIPO[t].slice(ROTULO_CURTO_TIPO[t].length)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className={cn(ROTULO, 'mb-2')}>Vale para</legend>
          <div className="flex overflow-hidden rounded-md border border-input bg-surface">
            {VALE.map((v) => (
              <label key={v.valor} className={SEGMENTO}>
                <input type="radio" name="vale" value={v.valor} defaultChecked={valeInicial === v.valor} className="sr-only" />
                {v.antes && <span className="sr-only">{v.antes}</span>}
                {v.visivel}
                {v.depois && <span className="sr-only">{v.depois}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Empresa e setor ficam montados mesmo escondidos: trocar e voltar não perde a escolha. */}
      <div data-campo="empresa" className={cn(vale !== 'empresa' && 'hidden')}>
        <FormField
          id={`${id}-empresa`}
          rotulo={<span className="sr-only">Empresa</span>}
          ajuda={<>O agente segue esta orientação só nas conversas com esta empresa.{avisoEmpresas && <span className="block text-warning">{avisoEmpresas}</span>}</>}
          erro={erroEmpresa}
        >
          <EscolherEmpresa name="cliente_id" empresas={empresas} inicial={orientacao?.clienteId ?? null} ativo={vale === 'empresa'} aoMudar={() => setErroEmpresa(null)} />
        </FormField>
      </div>
      <div data-campo="setor" className={cn(vale !== 'setor' && 'hidden')}>
        <FormField id={`${id}-setor`} rotulo={<span className="sr-only">Setor</span>} ajuda="O agente segue esta orientação quando o assunto for deste setor.">
          <select
            ref={campoSetor}
            name="setor_id"
            defaultValue={orientacao?.setorId ?? ''}
            required={vale === 'setor'}
            onChange={(e) => setSetorEscolhido(e.target.value)}
            className={classeSelect}
          >
            <option value="">Escolha o setor</option>
            {opcoesSetor.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.ativo ? '' : ' (inativo)'}</option>)}
          </select>
        </FormField>
      </div>

      <FormField
        id={`${id}-texto`}
        rotulo="O que o agente deve fazer"
        ajuda="Escreva como falaria para um atendente novo. As regras fixas do agente continuam valendo."
        obrigatorio
      >
        <Textarea
          name="texto"
          defaultValue={orientacao?.texto}
          maxLength={LIMITE_TEXTO}
          rows={8}
          placeholder="Ex.: Comece sempre pelo nome do cliente e responda em no máximo duas frases."
        />
      </FormField>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <AvisoRascunho />
        <span className={cn('tabular', caracteres > LIMITE_TEXTO * 0.9 ? 'text-warning' : 'text-muted')}>
          {caracteres.toLocaleString('pt-BR')} / {LIMITE_TEXTO.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        <BotaoDescartar aoDescartar={aoDescartar} />
        <BotoesSalvar />
      </div>
    </FormularioAlteravel>
  );
}

/**
 * Editor da orientação (coluna do meio, spec 7C.5): título, tipo, vale para, texto, DESCARTAR, SALVAR DESLIGADA e
 * SALVAR E LIGAR. O formulário tem o id ID_FORM_ORIENTACAO: o simulador lê dele o rascunho na hora do teste.
 * DESCARTAR recomeça o formulário com o que está salvo (a chave nova remonta campos e contadores, D13).
 */
export function EditorOrientacao(props: PropsEditor) {
  const [versao, setVersao] = useState(0);
  return <FormularioEditor key={versao} {...props} aoDescartar={() => setVersao((v) => v + 1)} />;
}
```

- [ ] **Passo 4: `cabecalho-editor.tsx`**

```tsx
import { LockKeyhole } from 'lucide-react';
import { RelativeTime } from '@/components/patterns/relative-time';
import { ROTULO_TIPO, type TipoOrientacao } from '@/lib/orientacoes';
import { ChaveOrientacao } from './chave-orientacao';
import { textoCriacao } from './tela';

/**
 * Alto do editor (imagem B): tipo (· ensinada no Atendimento), título, a chave que grava na hora (a mesma da lista, D12),
 * para quem vale e quem criou.
 */
export function CabecalhoEditor({ id, titulo, tipo, ativo, ensinada, valePara, criadaPor, criadaEm }: {
  id: string;
  titulo: string;
  tipo: TipoOrientacao;
  ativo: boolean;
  ensinada: boolean;
  valePara: string;
  criadaPor: string | null;
  criadaEm: string;
}) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-info">{ROTULO_TIPO[tipo]}{ensinada ? ' · ensinada no Atendimento' : ''}</p>
          <h2 className="break-words text-2xl font-extrabold text-foreground">{titulo}</h2>
        </div>
        <ChaveOrientacao id={id} titulo={titulo} ligada={ativo} />
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <span>{valePara}</span>
        <span aria-hidden>·</span>
        <span>{textoCriacao(criadaPor, ensinada)}</span>
        <span aria-hidden>·</span>
        <RelativeTime data={criadaEm} />
      </p>
    </header>
  );
}

/** Lembrete fixo embaixo do editor (imagem B): nenhuma orientação muda as regras fixas do agente. */
export function RegrasFixas() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
      <LockKeyhole aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand" />
      <span>
        <span className="font-bold uppercase text-brand">Regras fixas sempre vencem:</span>{' '}
        sem emoji · resumo conferido antes da nota · não inventar · assunto sensível para a Direção · sigilo.
      </span>
    </p>
  );
}
```

- [ ] **Passo 5: `historico-tabela.tsx`**

```tsx
import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatarDataHora } from '@/lib/formatos';
import { ROTULO_TIPO } from '@/lib/orientacoes';
import type { LinhaHistorico } from './tela';
import type { Versao } from './versoes';

type Acao = (dados: FormData) => void | Promise<void>;

/**
 * Histórico em tabela compacta embaixo do editor (spec 7C.5, D15): quando, o que aconteceu e quem, "atual" na mais nova,
 * "Ver esta versão" e RESTAURAR onde o conteúdo difere do atual. Restaurar não liga nem desliga (restaurar_orientacao).
 * Em "Ver esta versão", o "vale para" vem como "Vale para: <nome>" (sem repetir "Empresa <nome>" do alto do editor).
 */
export function HistoricoTabela({ linhas, versoes, ligada, valePara, restaurar, aviso }: {
  linhas: LinhaHistorico[];
  versoes: Versao[];
  ligada: boolean;
  /** "Padaria Sol", "setor Fiscal" ou "todos os clientes" de um retrato. */
  valePara: (v: Pick<Versao, 'clienteId' | 'setorId'>) => string;
  restaurar: (versaoId: string) => Acao;
  aviso?: ReactNode;
}) {
  const n = linhas.length;
  return (
    <section id="historico" aria-labelledby="titulo-historico" className="rounded-lg border border-border bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <h3 id="titulo-historico" className="text-sm font-bold uppercase tracking-wide text-brand">Histórico · {n === 1 ? '1 versão' : `${n} versões`}</h3>
        <p className="text-sm text-muted">restaurar não liga nem desliga</p>
      </div>
      {aviso && <div className="px-4 pt-3">{aviso}</div>}
      {n === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Sem histórico ainda. Cada criação, edição, ligar, desligar e restauração aparece aqui.</p>
      ) : (
        <table aria-label="Versões da orientação" className="w-full text-sm">
          <thead className="sr-only">
            <tr><th scope="col">Quando</th><th scope="col">O que aconteceu</th><th scope="col">Restaurar</th></tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => {
              const v = versoes[i]!;
              return (
                <tr key={l.id} className="border-b border-border align-top last:border-b-0">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular text-muted">{l.quando}</td>
                  <td className="px-2 py-2.5">
                    <span className="font-semibold text-foreground">{l.resumo}</span>{' '}
                    <span className="text-muted">{l.por}</span>
                    {l.atual && <Badge variant="brand" className="ml-2">atual</Badge>}
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted">Ver esta versão</summary>
                      <div className="mt-1 flex flex-col gap-1 rounded-md bg-surface-muted p-2">
                        <p className="text-muted">{ROTULO_TIPO[v.tipo]} · Vale para: {valePara(v)} · {v.ativo ? 'ligada' : 'desligada'}</p>
                        <p className="font-medium text-foreground">{v.titulo}</p>
                        <p className="whitespace-pre-wrap break-words text-foreground">{v.texto}</p>
                      </div>
                    </details>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {l.podeRestaurar && (
                      <ConfirmDialog
                        gatilho={(
                          <Button variant="link" size="sm" aria-label="Restaurar esta versão" className="font-bold uppercase">
                            <RotateCcw aria-hidden size={14} strokeWidth={1.75} />
                            Restaurar
                          </Button>
                        )}
                        titulo="Restaurar esta versão?"
                        descricao={(
                          <>
                            O título, o tipo, o texto e para quem vale voltam a ser os da versão de {formatarDataHora(v.criadoEm)}.
                            A orientação continua {ligada ? 'ligada' : 'desligada'}: restaurar não liga nem desliga nada.
                            A versão de agora continua no histórico.
                          </>
                        )}
                        confirmar="Restaurar"
                        enviando="Restaurando…"
                        variante="primary"
                        acao={restaurar(v.id)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
```

- [ ] **Passo 6: conferir os tipos e os testes de unidade**

Run: `pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel exec vitest run src/components/patterns "src/app/(painel)/treinar-agente"`
Expected: sem erros; PASS.

- [ ] **Passo 7: commit**

```bash
git add apps/painel/src/components/patterns/formulario-alteravel.tsx "apps/painel/src/app/(painel)/treinar-agente/rascunho-ao-vivo.ts" "apps/painel/src/app/(painel)/treinar-agente/editor-orientacao.tsx" "apps/painel/src/app/(painel)/treinar-agente/cabecalho-editor.tsx" "apps/painel/src/app/(painel)/treinar-agente/historico-tabela.tsx"
git commit -m "feat(painel): editor do Treinar o agente — Salvar desligada / Salvar e ligar, Descartar, cabeçalho com a chave, histórico em tabela e regras fixas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Simulador sempre visível, com "O que o agente faria" e "Sem o rascunho"

**Files:**
- Create: `apps/painel/src/app/(painel)/treinar-agente/use-simulacao.ts`, `apps/painel/src/app/(painel)/treinar-agente/simulador.tsx`

**Interfaces:**
- Consumes: `testarAgente` (`acoes.ts`, sem mudança); `resultadoDaLinha`, `LIMITE_MENSAGEM_TESTE`, `MENSAGEM_FALHA_TESTE`, `MENSAGEM_SEM_RESPOSTA`, `PedidoTeste`, `RespostasSimulacao` (`simulacao.ts`); `lerRascunho`, `empresaDoFormulario`, `empresaDoTeste`, `podeCompararSemRascunho`, `rotuloSimulador`, `ConteudoSalvo`, `EscolhaEmpresa`, `CampoRascunho` (Task 1); `ID_FORM_ORIENTACAO`, `EVENTO_RASCUNHO` (Task 4); `formularioAlterado`.
- Produces: `useSimulacao(id)` (o hook de `testar-agente.tsx`, igual); `Simulador({ aberta, idOrientacao, salva, empresas, avisoEmpresas })` — região "Simulador" com título "Simulador", selo do que entra no teste, busca "Como cliente de", "Testar sem empresa", "Nada é enviado ao cliente nem gravado em demanda.", campo "Mensagem do cliente", botão "Testar", região "Resultado do teste", título "O que o agente faria", região "Sem o rascunho" com "Comparar sem o rascunho".

- [ ] **Passo 1: `use-simulacao.ts`**

Copie **sem mudar nada** o contador `montagens` e a função `useSimulacao` de `treinar-agente/testar-agente.tsx` (das linhas `/** Contador das montagens de useSimulacao …` até o fim de `useSimulacao`) para o arquivo novo, com este cabeçalho:

```ts
import { useEffect, useState } from 'react';
import { autenticarTempoReal, supabaseNavegador } from '@/lib/supabase/navegador';
import { INTERVALO_CONSULTA_MS, PRAZO_ESPERA_MS, prazoDoTeste, type LinhaSimulacao } from './simulacao';
```

e troque `function useSimulacao(` por `export function useSimulacao(`. (O `testar-agente.tsx` sai na Task 6.)

- [ ] **Passo 2: `simulador.tsx`**

```tsx
'use client';

import {
  Building2, CircleDot, CircleHelp, ClipboardList, FilePlus2, FileText, Info, LoaderCircle, MessageCircle, PackagePlus, Paperclip,
  Pencil, RotateCcw, Send, ShieldCheck, Tag, UserRound, type LucideIcon,
} from 'lucide-react';
import { useEffect, useId, useMemo, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { formularioAlterado } from '@/components/patterns/formulario-alteravel';
import { MessageBubble } from '@/components/patterns/message-bubble';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatarHora } from '@/lib/formatos';
import { testarAgente, type RespostaTeste } from './acoes';
import { EVENTO_RASCUNHO, ID_FORM_ORIENTACAO } from './rascunho-ao-vivo';
import {
  LIMITE_MENSAGEM_TESTE, MENSAGEM_FALHA_TESTE, MENSAGEM_SEM_RESPOSTA, resultadoDaLinha, type PedidoTeste, type RespostasSimulacao,
} from './simulacao';
import {
  empresaDoFormulario, empresaDoTeste, lerRascunho, podeCompararSemRascunho, rotuloSimulador,
  type CampoRascunho, type ConteudoSalvo, type EscolhaEmpresa,
} from './tela';
import { useSimulacao } from './use-simulacao';

type Fase = 'pensando' | 'pronta' | 'erro' | 'atrasou';

/** Ícone de cada ação que o trabalhador registra (simularGravacao e o encaminhamento). D6 */
const ICONE: Record<string, LucideIcon> = {
  abrir_chamado: FilePlus2,
  abrir_pedido_nota: FileText,
  resumir_pedido_nota: ClipboardList,
  enviar_documento: Paperclip,
  alterar_preco: Tag,
  cadastrar_produto: PackagePlus,
  selecionar_empresa: Building2,
  passar_para_pessoa: UserRound,
  encaminhar: UserRound,
  sinalizar_nao_entendido: CircleHelp,
};

async function pedirTeste(p: PedidoTeste): Promise<RespostaTeste> {
  try {
    return await testarAgente(p);
  } catch (e) {
    console.error('[treinar-agente] falha ao enviar o teste', e);
    return { erro: MENSAGEM_FALHA_TESTE };
  }
}

/** Fase de um teste pela linha do banco; "não respondeu a tempo" pelo relógio de quem espera. */
function useFase(id: string, aoMudarFase: (f: Fase) => void) {
  const { linha, atrasou } = useSimulacao(id);
  const resultado = linha ? resultadoDaLinha(linha) : { fase: 'pensando' as const };
  const fase: Fase = resultado.fase === 'pensando' && atrasou ? 'atrasou' : resultado.fase;
  useEffect(() => aoMudarFase(fase), [fase, aoMudarFase]);
  return { linha, resultado, fase };
}

/** Rascunho incompleto: o foco vai para o campo que falta (D9). */
function focarCampo(f: HTMLFormElement, campo: CampoRascunho | null) {
  if (!campo) return;
  const alvo = campo === 'titulo' || campo === 'texto'
    ? f.querySelector<HTMLElement>(`[name="${campo}"]`)
    : f.querySelector<HTMLElement>(`[data-campo="${campo}"] button, [data-campo="${campo}"] select`);
  alvo?.focus();
}

function OQueFaria({ respostas }: { respostas: RespostasSimulacao }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-agent-active bg-surface p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-agent-active">O que o agente faria</h3>
      {respostas.acoes.length === 0 ? (
        <p className="text-sm text-muted">O agente não usaria nenhuma ferramenta (não abriria demanda nem pedido de nota).</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {respostas.acoes.map((a, i) => {
            const Icone = ICONE[a.ferramenta] ?? CircleDot;
            return (
              <li key={i} className="flex items-start gap-2">
                <Icone aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-agent-active" />
                {a.resumo}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted">O que grava ou envia foi só simulado.</p>
    </div>
  );
}

/** Resultado do teste: a mensagem do cliente, "Pensando…" e depois o que o agente mandaria e faria. */
function ResultadoTeste({ id, aviso, rascunho, aoMudarFase, tentarDeNovo, rodape }: {
  id: string;
  aviso: string | null;
  rascunho: PedidoTeste['rascunho'];
  aoMudarFase: (f: Fase) => void;
  tentarDeNovo: () => void;
  rodape: ReactNode;
}) {
  const { linha, resultado, fase } = useFase(id, aoMudarFase);
  return (
    <section aria-label="Resultado do teste" className="flex flex-col gap-3">
      {aviso && (
        <p className="flex items-start gap-2 rounded-md bg-info-soft p-3 text-sm text-info">
          <Info aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {aviso}
        </p>
      )}
      {linha && <p className="self-center rounded-full border border-border bg-surface px-3 py-0.5 text-xs text-muted">Teste · {formatarHora(linha.criado_em)}</p>}
      {linha && <MessageBubble autor="cliente" nome="Cliente (teste)" hora={linha.criado_em} conteudo={linha.mensagem} />}
      {rascunho && (
        <p className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
          <Pencil aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          Teste com o rascunho “{rascunho.titulo}” (ligado, sem salvar).
        </p>
      )}
      {fase === 'pensando' && (
        <p role="status" className="ml-auto flex items-center gap-2 rounded-lg bg-agent-active-soft px-3 py-2 text-sm text-agent-active">
          <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
          Pensando…
        </p>
      )}
      {resultado.fase === 'pronta' && linha && (
        <>
          <p role="status" className="sr-only">O agente respondeu.</p>
          {resultado.respostas.mensagens.length > 0
            ? resultado.respostas.mensagens.map((m, i) => <MessageBubble key={i} autor="agente" nome="Agente responderia" hora={linha.criado_em} conteudo={m} />)
            : <p className="text-sm text-muted">O agente não mandaria nenhuma mensagem para o cliente.</p>}
          <OQueFaria respostas={resultado.respostas} />
          {resultado.respostas.observacoes.length > 0 && (
            <ul aria-label="Observações do teste" className="flex flex-col gap-2">
              {resultado.respostas.observacoes.map((o, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning">
                  <Info aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  {o}
                </li>
              ))}
            </ul>
          )}
          {rodape}
        </>
      )}
      {(fase === 'erro' || fase === 'atrasou') && (
        <div className="flex flex-col items-start gap-2">
          <AvisoErro erro={resultado.fase === 'erro' ? resultado.erro : MENSAGEM_SEM_RESPOSTA} />
          <Button type="button" variant="outline" size="sm" onClick={tentarDeNovo}>
            <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
            Tentar de novo
          </Button>
        </div>
      )}
    </section>
  );
}

/** A segunda simulação (sem rascunho): o texto que o cliente receberia e as ações, em poucas linhas. */
function ResultadoComparacao({ id, aoMudarFase, comparar }: { id: string; aoMudarFase: (f: Fase) => void; comparar: () => void }) {
  const { resultado, fase } = useFase(id, aoMudarFase);
  if (fase === 'pensando') {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-agent-active">
        <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" />
        Pensando…
      </p>
    );
  }
  if (resultado.fase === 'pronta') {
    const { mensagens, acoes } = resultado.respostas;
    return (
      <div className="flex flex-col gap-1.5 text-sm text-foreground">
        {mensagens.length > 0
          ? mensagens.map((m, i) => <p key={i} className="whitespace-pre-wrap break-words">{m}</p>)
          : <p className="text-muted">Não mandaria nenhuma mensagem.</p>}
        <p className="text-muted">{acoes.length > 0 ? `Faria: ${acoes.map((a) => a.resumo).join('; ')}.` : 'Nenhuma ação.'}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <AvisoErro erro={resultado.fase === 'erro' ? resultado.erro : MENSAGEM_SEM_RESPOSTA} />
      <Button type="button" variant="outline" size="sm" onClick={comparar}>
        <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
        Comparar de novo
      </Button>
    </div>
  );
}

/** Quadro "Sem o rascunho" (spec 7C.5, D2–D4): uma segunda simulação, sob pedido, com a mesma mensagem e empresa. */
function SemORascunho({ comparacao, ocupado, erro, comparar, aoMudarFase }: {
  comparacao: { id: string; vez: number } | null;
  ocupado: boolean;
  erro: string | null;
  comparar: () => void;
  aoMudarFase: (f: Fase) => void;
}) {
  return (
    <section aria-label="Sem o rascunho" className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-muted">Sem o rascunho</h3>
      {comparacao ? (
        <ResultadoComparacao key={`${comparacao.id}-${comparacao.vez}`} id={comparacao.id} aoMudarFase={aoMudarFase} comparar={comparar} />
      ) : (
        <>
          <p className="text-sm text-muted">
            Veja o que o agente responde hoje, com as orientações ligadas e salvas. É mais um teste, com a mesma mensagem e empresa, e conta em Gastos com IA.
          </p>
          <Button type="button" variant="outline" size="sm" className="self-start" disabled={ocupado} onClick={comparar}>Comparar sem o rascunho</Button>
        </>
      )}
      {erro && <AvisoErro erro={erro} />}
    </section>
  );
}

/**
 * Simulador de WhatsApp sempre visível (spec 7C.5): empresa, mensagem do cliente, a resposta e "O que o agente faria".
 * Com uma orientação aberta, o teste leva o formulário do meio como está (rascunho, sem salvar); sem orientação, só as
 * ligadas (D10). Nada é enviado nem gravado além do próprio teste (criar_simulacao + trabalhador, regras de hoje).
 */
export function Simulador({ aberta, idOrientacao, salva, empresas, avisoEmpresas }: {
  aberta: 'nova' | 'salva' | null;
  idOrientacao: string | null;
  salva: ConteudoSalvo | null;
  /** Só empresas ativas. */
  empresas: EmpresaOpcao[];
  avisoEmpresas: string | null;
}) {
  const id = useId();
  const ativas = useMemo(() => new Set(empresas.map((e) => e.id)), [empresas]);
  const [doRascunho, setDoRascunho] = useState<{ alterado: boolean; clienteId: string | null }>({ alterado: false, clienteId: salva?.clienteId ?? null });
  const [escolha, setEscolha] = useState<EscolhaEmpresa>({ manual: false });
  const [versaoEmpresa, setVersaoEmpresa] = useState(0);
  const empresa = empresaDoTeste(escolha, aberta ? doRascunho.clienteId : null, ativas);

  // O editor avisa a cada mudança (EVENTO_RASCUNHO): o selo e a empresa do teste acompanham o formulário (D11).
  useEffect(() => {
    if (aberta === null) return;
    const ler = () => {
      const f = document.getElementById(ID_FORM_ORIENTACAO);
      if (!(f instanceof HTMLFormElement)) return;
      setDoRascunho({ alterado: formularioAlterado(f), clienteId: empresaDoFormulario(new FormData(f)) });
    };
    ler();
    window.addEventListener(EVENTO_RASCUNHO, ler);
    return () => window.removeEventListener(EVENTO_RASCUNHO, ler);
  }, [aberta]);

  const [mensagem, setMensagem] = useState('');
  const [teste, setTeste] = useState<{ id: string; aviso: string | null; vez: number; pedido: PedidoTeste } | null>(null);
  const [fase, setFase] = useState<Fase | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroRascunho, setErroRascunho] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<PedidoTeste | null>(null);
  const [comparacao, setComparacao] = useState<{ id: string; vez: number } | null>(null);
  const [faseComparacao, setFaseComparacao] = useState<Fase | null>(null);
  const [erroComparacao, setErroComparacao] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  // Um teste por pessoa (criar_simulacao): enquanto um roda, nada mais sai.
  const ocupado = enviando || fase === 'pensando' || faseComparacao === 'pensando';

  const enviar = (pedido: PedidoTeste) => {
    setUltimo(pedido);
    setErro(null);
    setComparacao(null);
    setFaseComparacao(null);
    setErroComparacao(null);
    iniciar(async () => {
      const r = await pedirTeste(pedido);
      if ('erro' in r) {
        setErro(r.erro);
        setTeste(null);
        setFase(null);
      } else {
        setFase('pensando');
        setTeste((t) => ({ id: r.id, aviso: r.aviso, vez: (t?.vez ?? 0) + 1, pedido }));
      }
    });
  };

  // "Sem o rascunho": a mesma mensagem e empresa, sem rascunho. Um teste pendente de outra aba não é adotado aqui.
  const comparar = () => {
    if (!teste || ocupado) return;
    setErroComparacao(null);
    iniciar(async () => {
      const r = await pedirTeste({ ...teste.pedido, rascunho: null });
      if ('erro' in r) setErroComparacao(r.erro);
      else if (r.aviso) setErroComparacao(r.aviso);
      else {
        setFaseComparacao('pensando');
        setComparacao((c) => ({ id: r.id, vez: (c?.vez ?? 0) + 1 }));
      }
    });
  };

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (ocupado) return;
    setErroRascunho(null);
    let rascunho: PedidoTeste['rascunho'] = null;
    if (aberta !== null) {
      const f = document.getElementById(ID_FORM_ORIENTACAO);
      if (!(f instanceof HTMLFormElement)) {
        setErroRascunho('O formulário da orientação não carregou. Recarregue a página.');
        return;
      }
      const r = lerRascunho(new FormData(f), idOrientacao);
      if (!r.ok) {
        setErroRascunho(`Complete o rascunho para testar: ${r.erro}`);
        focarCampo(f, r.campo);
        return;
      }
      rascunho = r.rascunho;
    }
    enviar({ mensagem, clienteId: empresa, rascunho });
  };

  const podeComparar = Boolean(teste && !teste.aviso && podeCompararSemRascunho(teste.pedido.rascunho, salva));

  return (
    <section aria-label="Simulador" className="flex min-h-0 flex-col bg-background max-lg:border-t max-lg:border-border lg:w-simulador-treinar lg:shrink-0 lg:border-l lg:border-border">
      <div className="flex flex-col gap-2 border-b border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-brand">
            <MessageCircle aria-hidden size={16} strokeWidth={1.75} />
            Simulador
          </h2>
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
            <Pencil aria-hidden size={14} strokeWidth={1.75} />
            {rotuloSimulador({ aberta, alterado: doRascunho.alterado })}
          </span>
        </div>
        <FormField id={`${id}-empresa`} rotulo="Como cliente de" ajuda={avisoEmpresas ? <span className="text-warning">{avisoEmpresas}</span> : undefined}>
          <EscolherEmpresa
            // Acompanhando o rascunho, a busca recomeça quando a empresa dele muda; escolhida à mão, fica.
            key={escolha.manual ? `m-${versaoEmpresa}` : `r-${empresa ?? ''}`}
            name="empresa_teste"
            empresas={empresas}
            inicial={empresa}
            placeholder="Sem empresa (número desconhecido)"
            aoMudar={(v) => setEscolha({ manual: true, id: v || null })}
          />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
            Nada é enviado ao cliente nem gravado em demanda.
          </p>
          {empresa && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEscolha({ manual: true, id: null }); setVersaoEmpresa((v) => v + 1); }}>
              Testar sem empresa
            </Button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {!teste && !erro && (
          <p className="m-auto max-w-xs text-center text-sm text-muted">
            Escreva uma mensagem como o cliente escreveria e toque em Testar. A resposta aparece aqui, sem enviar nada.
          </p>
        )}
        {erro && (
          <div className="flex flex-col items-start gap-2">
            <AvisoErro erro={erro} />
            {ultimo && (
              <Button type="button" variant="outline" size="sm" disabled={enviando} onClick={() => enviar(ultimo)}>
                <RotateCcw aria-hidden size={16} strokeWidth={1.75} />
                Tentar de novo
              </Button>
            )}
          </div>
        )}
        {teste && (
          <ResultadoTeste
            key={`${teste.id}-${teste.vez}`}
            id={teste.id}
            aviso={teste.aviso}
            rascunho={teste.pedido.rascunho}
            aoMudarFase={setFase}
            tentarDeNovo={() => ultimo && enviar(ultimo)}
            rodape={podeComparar
              ? <SemORascunho comparacao={comparacao} ocupado={ocupado} erro={erroComparacao} comparar={comparar} aoMudarFase={setFaseComparacao} />
              : null}
          />
        )}
      </div>

      <form onSubmit={aoEnviar} className="flex flex-col gap-2 border-t border-border bg-surface p-4">
        {erroRascunho && <p role="alert" className="text-sm text-danger">{erroRascunho}</p>}
        <label htmlFor={`${id}-mensagem`} className="sr-only">Mensagem do cliente</label>
        <div className="relative">
          <Textarea
            id={`${id}-mensagem`}
            name="mensagem"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            maxLength={LIMITE_MENSAGEM_TESTE}
            rows={2}
            required
            placeholder="Escreva como o cliente escreveria…"
            className="pr-20"
          />
          <span aria-hidden className="pointer-events-none absolute top-2 right-3 tabular text-xs text-muted">
            {mensagem.length.toLocaleString('pt-BR')} / {LIMITE_MENSAGEM_TESTE.toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted">Um teste por vez · conta em Gastos com IA</p>
          <Button type="submit" disabled={ocupado} aria-busy={enviando || undefined}>
            {enviando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Send aria-hidden size={16} strokeWidth={1.75} />}
            Testar
          </Button>
        </div>
      </form>
    </section>
  );
}
```

- [ ] **Passo 3: conferir os tipos**

Run: `pnpm --filter @escritorio/painel typecheck`
Expected: sem erros. Se `border-agent-active` não gerar cor (token `--color-agent-active` existe em `globals.css`), confira no navegador na Task 6.

- [ ] **Passo 4: commit**

```bash
git add "apps/painel/src/app/(painel)/treinar-agente/use-simulacao.ts" "apps/painel/src/app/(painel)/treinar-agente/simulador.tsx"
git commit -m "feat(painel): simulador sempre visível no Treinar o agente — rascunho sem salvar, O que o agente faria e Sem o rascunho sob pedido

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Página de três colunas e e2e novos

**Files:**
- Modify (reescrever): `apps/painel/src/app/(painel)/treinar-agente/page.tsx`, `apps/painel/src/app/(painel)/treinar-agente/loading.tsx`
- Modify: `apps/painel/src/app/(painel)/treinar-agente/acoes.ts` (sai `empresasParaTeste`)
- Create: `apps/painel/src/app/(painel)/treinar-agente/hidratado.tsx`, `apps/painel/e2e/apoio-treinar.ts`, `apps/painel/e2e/treinar-simulador.spec.ts`
- Delete: `treinar-agente/formulario-orientacao.tsx`, `historico-orientacao.tsx`, `abas-orientacao.tsx`, `medidor.tsx`, `testar-agente.tsx`

**Interfaces:**
- Consumes: tudo das Tasks 1–5; `salvarOrientacao`, `restaurarVersao` (sem mudança).
- Produces: `/treinar-agente` em três colunas; `abrirTreinar`, `esperarTreinar`, `editor`, `simulador`, `lista` (`e2e/apoio-treinar.ts`).

- [ ] **Passo 1: escrever o e2e que falha**

`apps/painel/e2e/apoio-treinar.ts`:

```ts
import { expect, type Page } from '@playwright/test';

/** Espera o navegador assumir a tela (data-treinar-hidratado). Clicar antes disso perde a ação. */
export async function esperarTreinar(page: Page): Promise<void> {
  await expect(page.locator('[data-treinar-hidratado]')).toHaveCount(1, { timeout: 30_000 });
}

/** Abre Treinar o agente (com ?orientacao=… etc.) e espera a hidratação. */
export async function abrirTreinar(page: Page, consulta = ''): Promise<void> {
  await page.goto(`/treinar-agente${consulta}`);
  await esperarTreinar(page);
}

export const lista = (page: Page) => page.getByRole('region', { name: 'Orientações', exact: true });
export const editor = (page: Page) => page.getByRole('region', { name: 'Editor da orientação', exact: true });
export const simulador = (page: Page) => page.getByRole('region', { name: 'Simulador', exact: true });
```

`apps/painel/e2e/treinar-simulador.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { tamanhoOrientacao } from '../src/lib/orientacoes';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirTreinar, editor, lista, simulador } from './apoio-treinar';

// Treinar o agente, Opção B (spec 7C.5): simulador com e sem rascunho, salvar desligada/ligada, lista.
// Sem trabalhador nos e2e: o resultado da simulação é gravado direto no banco local (service role), como o trabalhador gravaria.

const senha = 'Senha-e2e-123';
const EMAIL = 'ana-g5@e2e.local';
const CNPJ = '45321789000372';
const P = 'G5E2E';

async function limpar() {
  // Só o banco local dos testes; os specs do Treinar apagam todas as orientações antes de cada teste.
  await db.from('orientacoes_agente').delete().not('id', 'is', null);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
}

test.beforeEach(limpar);
test.afterAll(async () => {
  await limpar();
  // Apagar o login apaga a pessoa e as simulações dela (cascata).
  const { data } = await db.auth.admin.listUsers();
  for (const u of data.users.filter((x) => x.email === EMAIL)) await db.auth.admin.deleteUser(u.id);
});

const criarAna = () => criarUsuarioTeste({ email: EMAIL, senha, nome: 'Ana G5', papel: 'admin' });

async function simulacoes(usuarioId: string) {
  const { data } = await db.from('simulacoes_agente').select('id, mensagem, cliente_id, rascunho, status').eq('usuario_id', usuarioId).order('criado_em');
  return data ?? [];
}
async function pronta(id: string, respostas: { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[]; observacoes: string[] }) {
  await db.from('simulacoes_agente').update({ status: 'pronta', respostas }).eq('id', id);
}
async function versoes(id: string) {
  const { data } = await db.from('orientacoes_agente_versoes').select('acao').eq('orientacao_id', id).order('criado_em');
  return (data ?? []).map((v) => v.acao);
}

test('o simulador usa o rascunho sem salvar e "Sem o rascunho" faz uma segunda simulação, sem rascunho', async ({ page }) => {
  const usuario = await criarAna();
  const { data: cliente } = await db.from('clientes').insert({ razao_social: `${P} Rede Bom Preço Ltda`, nome_fantasia: `${P} Rede Bom Preço`, cnpj: CNPJ }).select('id').single();
  const TITULO = `${P} Nota com unidade fora do cadastro`;
  const { data: o } = await db.from('orientacoes_agente')
    .insert({ titulo: TITULO, texto: 'Pergunte o CNPJ da unidade.', tipo: 'situacao', cliente_id: cliente!.id, ativo: false }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);

  // Rascunho sem salvar: o simulador já usa, com a empresa do rascunho.
  const novo = 'Quando pedirem nota para uma unidade fora do cadastro, não pergunte o CNPJ: diga que vai conferir com a equipe e abra a demanda no Fiscal.';
  await editor(page).getByLabel('O que o agente deve fazer').fill(novo);
  await expect(editor(page).getByText('Rascunho não salvo')).toBeVisible();
  await expect(simulador(page).getByText('usando o rascunho, ligado')).toBeVisible();
  await expect(simulador(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Rede Bom Preço/);

  await simulador(page).getByLabel('Mensagem do cliente').fill('Bom dia! Preciso de uma nota pra Unidade Centro.');
  await simulador(page).getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(simulador(page).getByRole('status').filter({ hasText: 'Pensando…' })).toBeVisible();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  const [primeira] = await simulacoes(usuario);
  expect(primeira).toMatchObject({
    mensagem: 'Bom dia! Preciso de uma nota pra Unidade Centro.', cliente_id: cliente!.id, status: 'pendente',
    rascunho: { id: o!.id, titulo: TITULO, texto: novo, tipo: 'situacao', cliente_id: cliente!.id, setor_id: null },
  });
  await expect(simulador(page).getByText('Teste com o rascunho')).toContainText(TITULO);
  // Nada salvo.
  expect((await db.from('orientacoes_agente').select('texto, ativo').eq('id', o!.id).single()).data).toEqual({ texto: 'Pergunte o CNPJ da unidade.', ativo: false });

  await pronta(primeira!.id, {
    mensagens: ['Bom dia! Anotei a Unidade Centro. Vou conferir com a equipe antes de emitir.'],
    acoes: [{ ferramenta: 'abrir_chamado', resumo: 'Abriria uma demanda no Fiscal: Nota para unidade fora do cadastro' }],
    observacoes: [],
  });
  await expect(simulador(page).getByText('Vou conferir com a equipe antes de emitir.')).toBeVisible({ timeout: 10_000 });
  await expect(simulador(page).getByRole('heading', { name: 'O que o agente faria' })).toBeVisible();
  await expect(simulador(page).getByText('Abriria uma demanda no Fiscal: Nota para unidade fora do cadastro')).toBeVisible();

  // Sem o rascunho: segunda simulação, mesma mensagem e empresa, rascunho nulo; enquanto roda, Testar fica desligado.
  const sem = simulador(page).getByRole('region', { name: 'Sem o rascunho' });
  await expect(sem.getByText('conta em Gastos com IA')).toBeVisible();
  await sem.getByRole('button', { name: 'Comparar sem o rascunho' }).click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(2);
  const segunda = (await simulacoes(usuario))[1]!;
  expect(segunda).toMatchObject({ mensagem: primeira!.mensagem, cliente_id: cliente!.id, rascunho: null, status: 'pendente' });
  await expect(sem.getByText('Pensando…')).toBeVisible();
  await expect(simulador(page).getByRole('button', { name: 'Testar', exact: true })).toBeDisabled();
  await pronta(segunda.id, { mensagens: ['Bom dia! Qual o CNPJ da Unidade Centro?'], acoes: [], observacoes: [] });
  await expect(sem.getByText('Bom dia! Qual o CNPJ da Unidade Centro?')).toBeVisible({ timeout: 10_000 });
  await expect(sem.getByText('Nenhuma ação.')).toBeVisible();

  // As duas respostas na tela; o rascunho continua no formulário; nada gravado na orientação.
  await expect(simulador(page).getByText('Vou conferir com a equipe antes de emitir.')).toBeVisible();
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue(novo);
  expect((await db.from('orientacoes_agente').select('texto, ativo').eq('id', o!.id).single()).data).toEqual({ texto: 'Pergunte o CNPJ da unidade.', ativo: false });
  expect(await versoes(o!.id)).toEqual([]);
});

test('orientação ligada sem mudança não oferece comparação; sem orientação aberta, testa só as ligadas', async ({ page }) => {
  const usuario = await criarAna();
  const TITULO = `${P} Cumprimento`;
  const { data: o } = await db.from('orientacoes_agente').insert({ titulo: TITULO, texto: 'Comece pelo nome do cliente.', tipo: 'jeito', ativo: true }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);
  await expect(simulador(page).getByText('usando esta orientação, ligada')).toBeVisible();
  await simulador(page).getByLabel('Mensagem do cliente').fill('Oi, bom dia');
  await simulador(page).getByRole('button', { name: 'Testar', exact: true }).click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  const [s] = await simulacoes(usuario);
  expect(s!.rascunho).toEqual({ id: o!.id, titulo: TITULO, texto: 'Comece pelo nome do cliente.', tipo: 'jeito', cliente_id: null, setor_id: null });
  await pronta(s!.id, { mensagens: ['Bom dia! Em que posso ajudar?'], acoes: [], observacoes: [] });
  await expect(simulador(page).getByText('Bom dia! Em que posso ajudar?')).toBeVisible({ timeout: 10_000 });
  await expect(simulador(page).getByRole('region', { name: 'Sem o rascunho' })).toHaveCount(0);

  await abrirTreinar(page);
  await expect(simulador(page).getByText('orientações ligadas, sem rascunho')).toBeVisible();
  await expect(editor(page).getByText('Escolha uma orientação na lista.')).toBeVisible();
  await simulador(page).getByLabel('Mensagem do cliente').fill('Oi de novo');
  await simulador(page).getByRole('button', { name: 'Testar', exact: true }).click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(2);
  expect((await simulacoes(usuario))[1]).toMatchObject({ mensagem: 'Oi de novo', cliente_id: null, rascunho: null, status: 'pendente' });
});

test('Salvar desligada, Salvar e ligar, Enter no título, chave do alto sem perder o rascunho e Descartar', async ({ page }) => {
  await criarAna();
  const TITULO = `${P} Prazo da folha`;
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, '?orientacao=nova');
  await expect(editor(page).getByRole('heading', { name: 'Nova orientação' })).toBeVisible();
  await editor(page).getByLabel('Título').fill(TITULO);
  await editor(page).getByRole('radio', { name: /Regra do escritório/ }).check();
  await editor(page).getByLabel('O que o agente deve fazer').fill('A folha fecha no dia 20.');
  await editor(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(editor(page).getByRole('heading', { name: TITULO })).toBeVisible();
  const criada = (await db.from('orientacoes_agente').select('id, ativo, texto, tipo').eq('titulo', TITULO).single()).data!;
  expect(criada).toMatchObject({ ativo: false, texto: 'A folha fecha no dia 20.', tipo: 'regra' });

  // Enter no título não envia (o botão padrão seria Salvar desligada).
  await editor(page).getByLabel('Título').press('Enter');
  await page.waitForLoadState('networkidle');
  expect(await versoes(criada.id)).toEqual(['criar']);

  // Salvar e ligar grava o texto novo e liga.
  const texto = 'A folha fecha no dia 20; depois disso, só no mês seguinte.';
  await editor(page).getByLabel('O que o agente deve fazer').fill(texto);
  await editor(page).getByRole('button', { name: 'Salvar e ligar' }).click();
  await expect.poll(async () => (await db.from('orientacoes_agente').select('ativo').eq('id', criada.id).single()).data?.ativo).toBe(true);
  await expect(editor(page).getByRole('switch', { name: `Desligar a orientação ${TITULO}` })).toHaveAttribute('aria-checked', 'true');
  expect(await versoes(criada.id)).toEqual(['criar', 'editar']);

  // A chave do alto grava na hora e não apaga o rascunho.
  await editor(page).getByLabel('O que o agente deve fazer').fill('Rascunho que não pode sumir.');
  await editor(page).getByRole('switch', { name: `Desligar a orientação ${TITULO}` }).click();
  await expect.poll(async () => (await db.from('orientacoes_agente').select('ativo').eq('id', criada.id).single()).data?.ativo).toBe(false);
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue('Rascunho que não pode sumir.');

  // Descartar volta ao salvo, sem gravar.
  await editor(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue(texto);
  await expect(editor(page).getByText('Rascunho não salvo')).toHaveCount(0);
  await expect(editor(page).getByRole('button', { name: 'Descartar' })).toBeDisabled();
  expect(await versoes(criada.id)).toEqual(['criar', 'editar', 'desligar']);
});

test('lista: contagens, do Atendimento, campos a preencher, medidor, filtro e trocar de orientação com rascunho pergunta', async ({ page }) => {
  const usuario = await criarAna();
  const TITULO_ENS = `${P} Nota fora do cadastro`;
  const textoEns = 'Situação: Cliente: “nota pra Unidade Centro”\nO que fazer: Confirme com a equipe.';
  const { data: ens } = await db.from('orientacoes_agente')
    .insert({ titulo: TITULO_ENS, texto: textoEns, tipo: 'situacao', ativo: false, criado_por: usuario }).select('id').single();
  await db.from('orientacoes_agente_versoes').insert({ orientacao_id: ens!.id, acao: 'criar', titulo: TITULO_ENS, texto: textoEns, tipo: 'situacao', ativo: false, usuario_id: usuario });
  const TITULO_DADOS = `${P} Dados do escritório`;
  const textoDados = 'Endereço: (a preencher)\nPix: (a preencher)';
  const { data: dados } = await db.from('orientacoes_agente').insert({ titulo: TITULO_DADOS, texto: textoDados, tipo: 'regra', ativo: true }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page);

  await expect(lista(page).locator('[data-filtro="ligadas"]')).toHaveAttribute('data-contagem', '1');
  await expect(lista(page).locator('[data-filtro="desligadas"]')).toHaveAttribute('data-contagem', '1');
  await expect(lista(page).getByRole('listitem').filter({ hasText: TITULO_ENS }).getByText('do Atendimento')).toBeVisible();
  await expect(lista(page).getByRole('listitem').filter({ hasText: TITULO_DADOS }).getByText('2 campos a preencher')).toBeVisible();
  // Só a ligada conta no medidor.
  const n = tamanhoOrientacao({ tipo: 'regra', titulo: TITULO_DADOS, texto: textoDados });
  await expect(lista(page).getByRole('progressbar', { name: 'Espaço usado pelas orientações ligadas' })).toHaveAttribute('aria-valuetext', `${n} de 12.000 caracteres`);

  // A ensinada: marca no alto e "no Atendimento" na criação.
  await lista(page).getByRole('link', { name: new RegExp(TITULO_ENS) }).click();
  await expect(editor(page).getByText('Situação específica · ensinada no Atendimento')).toBeVisible();
  await expect(editor(page).getByText('Criada por Ana G5 no Atendimento')).toBeVisible();
  await expect(editor(page).getByText('Criou (desligada) no Atendimento')).toBeVisible();

  // Rascunho não salvo: trocar de orientação pergunta; cancelar fica, aceitar troca.
  await editor(page).getByLabel('O que o agente deve fazer').fill('Mudança sem salvar.');
  let pergunta = '';
  page.once('dialog', async (d) => { pergunta = d.message(); await d.dismiss(); });
  await lista(page).getByRole('link', { name: new RegExp(TITULO_DADOS) }).click();
  await expect.poll(() => pergunta).toContain('alterações não salvas');
  await expect(page).toHaveURL(new RegExp(`orientacao=${ens!.id}`));
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue('Mudança sem salvar.');
  page.once('dialog', (d) => d.accept());
  await lista(page).getByRole('link', { name: new RegExp(TITULO_DADOS) }).click();
  await expect(page).toHaveURL(new RegExp(`orientacao=${dados!.id}`));
  expect((await db.from('orientacoes_agente').select('texto').eq('id', ens!.id).single()).data?.texto).toBe(textoEns);

  // Filtro Desligadas.
  await lista(page).locator('[data-filtro="desligadas"]').click();
  await expect(lista(page).getByRole('listitem')).toHaveCount(1);
  await expect(lista(page).getByRole('listitem')).toContainText(TITULO_ENS);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Com o Supabase local nas portas 563xx (Restrições globais):
Run: `cd apps/painel && pnpm exec playwright test e2e/treinar-simulador.spec.ts`
Expected: FAIL (a tela ainda é a antiga: não há região "Simulador").

- [ ] **Passo 3: `hidratado.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

/** Marca que o navegador assumiu a página (os e2e esperam por ela antes de clicar). */
export function Hidratado() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return <span hidden data-treinar-hidratado={pronto ? '' : undefined} />;
}
```

- [ ] **Passo 4: `page.tsx` (arquivo inteiro)**

```tsx
import { GraduationCap, LockKeyhole, SearchX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { EmptyState } from '@/components/patterns/empty-state';
import type { EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { StatusBadge } from '@/components/patterns/status-badge';
import { variantesBotao } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { medirOrientacoes, type TipoOrientacao } from '@/lib/orientacoes';
import { lerEmPaginas } from '@/lib/paginas';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { restaurarVersao, salvarOrientacao } from './acoes';
import { CabecalhoEditor, RegrasFixas } from './cabecalho-editor';
import { EditorOrientacao, type SetorOpcao } from './editor-orientacao';
import { AVISO_EMPRESAS_INCOMPLETAS, ehUuid, lerFiltrosOrientacoes, MODELOS, modeloPorId, nomeEmpresa, normalizarBusca, opcaoEmpresa } from './esquemas';
import { Hidratado } from './hidratado';
import { HistoricoTabela } from './historico-tabela';
import { ListaOrientacoes, type ItemLista } from './lista-orientacoes';
import { Simulador } from './simulador';
import { contarSituacao, ehEnsinada, linhasHistorico } from './tela';
import type { AcaoVersao, Versao } from './versoes';

type Linha = ItemLista & { criadaEm: string; criadaPor: string | null };

/** Sem a marcação "Treinar o agente" (e sem ser administrador): diz quem pode liberar. */
function SemPermissao() {
  return (
    <section>
      <PageHeader titulo="Treinar o agente" />
      <Card>
        <EmptyState
          icone={LockKeyhole}
          titulo="Você não tem acesso a esta tela."
          descricao={'Quem libera é o administrador: na tela Usuários, ele escolhe "Sim" em "Treinar o agente" no seu cadastro.'}
          acao={<Link href="/inicio" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Voltar para o Início</Link>}
        />
      </Card>
    </section>
  );
}

/**
 * Treinar o agente, Opção B "Editor com simulador" (spec 7C.5): lista enxuta, editor no meio e simulador sempre visível.
 * Admin ou quem tem Treinar o agente. ?orientacao=<id>|nova abre no editor; ?modelo= preenche a nova; ?ativo= e ?q=
 * filtram (?tipo= e ?vale= continuam valendo); ?aba=historico é aceito (o histórico está sempre à vista).
 * Gravações pelas funções do banco (salvar/alternar/restaurar_orientacao); testes por criar_simulacao — regras de hoje.
 */
export default async function TreinarAgente({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const u = await obterUsuario();
  if (!temNivel(u, 'treinar', 'sim')) return <SemPermissao />;
  const params = await searchParams;
  const erro = valorParam(params, 'erro');
  const f = lerFiltrosOrientacoes(params);
  const pedido = valorParam(params, 'orientacao');
  const aberta = pedido === 'nova' ? 'nova' : ehUuid(pedido) ? pedido : null;
  const sb = await supabaseServidor();

  const colunasVersao = 'id, acao, titulo, texto, tipo, cliente_id, setor_id, ativo, criado_em, usuarios(nome)';
  const [lista, criacoes, { data: setores }, leituraEmpresas, leituraVersoes] = await Promise.all([
    // Todas, de 1000 em 1000 (o PostgREST corta em 1000 sem avisar).
    lerEmPaginas((de, ate) => sb.from('orientacoes_agente')
      .select('id, titulo, texto, tipo, cliente_id, setor_id, ativo, atualizado_em, criado_em, clientes(razao_social, nome_fantasia, ativo), setores(nome, ativo), criador:usuarios!orientacoes_agente_criado_por_fkey(nome)')
      .order('atualizado_em', { ascending: false }).order('id').range(de, ate)),
    // Texto da criação: diz se veio do "Ensinar o agente" (D8). Falhou: vale o texto atual.
    lerEmPaginas((de, ate) => sb.from('orientacoes_agente_versoes').select('orientacao_id, texto').eq('acao', 'criar')
      .order('criado_em').order('id').range(de, ate)),
    sb.from('setores').select('id, nome, ativo').order('nome'),
    // Empresas ativas para o editor e o simulador (D24); a inativa da orientação aberta vem à parte.
    lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').eq('ativo', true)
      .order('razao_social').order('id').range(de, ate)),
    // Histórico inteiro (a mais nova primeiro; id desempata versões do mesmo instante).
    aberta && aberta !== 'nova'
      ? lerEmPaginas((de, ate) => sb.from('orientacoes_agente_versoes').select(colunasVersao)
        .eq('orientacao_id', aberta).order('criado_em', { ascending: false }).order('id', { ascending: false }).range(de, ate))
      : Promise.resolve({ data: [], error: null, parcial: false }),
  ]);
  const { data: orientacoes, error: erroLista } = lista;
  const clientes = leituraEmpresas.data;
  const versoes = leituraVersoes.data;
  if (erroLista) console.error('[treinar-agente] falha ao ler as orientações', erroLista);
  if (lista.parcial) console.error('[treinar-agente] lista de orientações incompleta (limite de páginas)');
  if (criacoes.error || criacoes.parcial) console.error('[treinar-agente] textos de criação incompletos', criacoes.error ?? 'limite de páginas');
  if (leituraEmpresas.error || leituraEmpresas.parcial) console.error('[treinar-agente] lista de empresas incompleta', leituraEmpresas.error ?? 'limite de páginas');
  if (leituraVersoes.error || leituraVersoes.parcial) console.error('[treinar-agente] histórico incompleto', leituraVersoes.error ?? 'limite de páginas');
  const avisoLista = lista.parcial ? 'A lista mostra só parte das orientações (são muitas); use a busca.' : null;
  const avisoEmpresas = leituraEmpresas.error || leituraEmpresas.parcial ? AVISO_EMPRESAS_INCOMPLETAS : null;
  const avisoHistorico = leituraVersoes.error || leituraVersoes.parcial ? 'Não consegui carregar o histórico inteiro: as versões mais antigas podem faltar.' : null;

  const textoDaCriacao = new Map(criacoes.data.map((c) => [c.orientacao_id, c.texto]));
  const todas: Linha[] = (orientacoes ?? []).map((o) => ({
    id: o.id, titulo: o.titulo, texto: o.texto, tipo: o.tipo as TipoOrientacao, clienteId: o.cliente_id, setorId: o.setor_id, ativo: o.ativo,
    ensinada: ehEnsinada(textoDaCriacao.get(o.id) ?? o.texto),
    empresa: o.clientes ? { nome: nomeEmpresa(o.clientes), ativa: o.clientes.ativo } : null,
    setor: o.setores ? { nome: o.setores.nome, ativo: o.setores.ativo } : null,
    criadaEm: o.criado_em, criadaPor: o.criador?.nome ?? null,
  }));

  const opcoesSetor: SetorOpcao[] = setores ?? [];
  // Empresa inativa não conversa: as orientações dela não pesam em conversa nenhuma.
  const medidor = medirOrientacoes(todas.filter((l) => !l.clienteId || l.empresa?.ativa), opcoesSetor.filter((s) => s.ativo).map((s) => s.id));
  const empresaMaisPesada = medidor.empresa ? todas.find((l) => l.clienteId === medidor.empresa!.id)?.empresa?.nome ?? null : null;

  const busca = normalizarBusca(f.q);
  const filtradas = todas.filter((l) => (!f.tipo || l.tipo === f.tipo)
    && (!f.vale || (f.vale === 'empresa' ? l.clienteId !== null : f.vale === 'setor' ? l.setorId !== null : !l.clienteId && !l.setorId))
    && (!f.ativo || l.ativo === (f.ativo === 'ligadas'))
    && (!busca || normalizarBusca(`${l.titulo} ${l.texto} ${l.empresa?.nome ?? ''} ${l.setor?.nome ?? ''}`).includes(busca)));
  const filtrando = Boolean(f.tipo || f.vale || f.ativo || f.q);

  const href = (mudancas: Record<string, string | null>) => `/treinar-agente${hrefComParams(params, { erro: null, ...mudancas })}`;
  const hrefPainel = (id: string | null, extra: Record<string, string | null> = {}) => href({ orientacao: id, modelo: null, aba: null, ...extra });

  const atual = aberta && aberta !== 'nova' ? todas.find((l) => l.id === aberta) ?? null : null;
  // Empresas citadas fora da lista de ativas (a da orientação aberta e as dos retratos do histórico): só o nome.
  const ativas = new Set(clientes.map((c) => c.id));
  const faltando = [...new Set([atual?.clienteId, ...versoes.map((v) => v.cliente_id)])].filter((id): id is string => Boolean(id) && !ativas.has(id!));
  const { data: outras } = faltando.length
    ? await sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').in('id', faltando)
    : { data: [] };
  const todasEmpresas = [...clientes, ...(outras ?? [])];
  const empresas: EmpresaOpcao[] = [...clientes, ...(outras ?? []).filter((c) => c.id === atual?.clienteId)].map(opcaoEmpresa);
  const nomes = {
    empresa: new Map(todasEmpresas.map((c) => [c.id, nomeEmpresa(c)])),
    setor: new Map(opcoesSetor.map((s) => [s.id, s.nome])),
  };
  const valeParaTexto = (v: Pick<Versao, 'clienteId' | 'setorId'>) => (v.clienteId
    ? `Empresa ${nomes.empresa.get(v.clienteId) ?? 'removida'}`
    : v.setorId ? `Setor ${nomes.setor.get(v.setorId) ?? 'removido'}` : 'Todos os clientes');
  // No histórico, sem repetir "Empresa <nome>" do alto do editor.
  const valeParaCurto = (v: Pick<Versao, 'clienteId' | 'setorId'>) => (v.clienteId
    ? nomes.empresa.get(v.clienteId) ?? 'empresa removida'
    : v.setorId ? `setor ${nomes.setor.get(v.setorId) ?? 'removido'}` : 'todos os clientes');
  const listaVersoes: Versao[] = versoes.map((v) => ({
    id: v.id, acao: v.acao as AcaoVersao, titulo: v.titulo, texto: v.texto, tipo: v.tipo as TipoOrientacao, clienteId: v.cliente_id,
    setorId: v.setor_id, ativo: v.ativo, usuario: v.usuarios?.nome ?? null, criadoEm: v.criado_em,
  }));
  const modelo = modeloPorId(valorParam(params, 'modelo'));
  const aviso = erro ? <AvisoErro erro={erro} /> : undefined;

  let conteudoEditor: ReactNode;
  if (aberta === 'nova') {
    conteudoEditor = (
      <>
        <header className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-info">Desligada até você ligar</p>
          <h2 className="text-2xl font-extrabold text-foreground">Nova orientação</h2>
          <p className="text-sm text-muted">
            {modelo ? `Exemplo "${modelo.titulo}" preenchido: ajuste ao jeito do escritório.` : 'Escreva, teste no simulador ao lado e salve desligada ou já ligada.'}
          </p>
        </header>
        <EditorOrientacao
          key={`nova-${modelo?.id ?? ''}-${erro ?? ''}`}
          acao={salvarOrientacao.bind(null, null, href({ orientacao: 'nova', aba: null }))}
          orientacao={modelo ? { titulo: modelo.titulo, texto: modelo.texto, tipo: modelo.tipo, clienteId: null, setorId: null } : undefined}
          empresas={empresas}
          avisoEmpresas={avisoEmpresas}
          setores={opcoesSetor}
          aviso={aviso}
        />
        <RegrasFixas />
      </>
    );
  } else if (aberta && atual) {
    conteudoEditor = (
      <>
        <CabecalhoEditor
          id={atual.id} titulo={atual.titulo} tipo={atual.tipo} ativo={atual.ativo} ensinada={atual.ensinada}
          valePara={valeParaTexto(atual)} criadaPor={atual.criadaPor} criadaEm={atual.criadaEm}
        />
        <EditorOrientacao
          // Voltou do servidor com outro conteúdo (salvou ou restaurou) ou com erro: recomeça. Sem `ativo`: ligar pelo alto não apaga o rascunho (D12).
          key={JSON.stringify([atual.titulo, atual.texto, atual.tipo, atual.clienteId, atual.setorId, erro])}
          acao={salvarOrientacao.bind(null, atual.id, hrefPainel(atual.id))}
          orientacao={atual}
          empresas={empresas}
          avisoEmpresas={avisoEmpresas}
          setores={opcoesSetor}
          aviso={aviso}
        />
        <HistoricoTabela
          linhas={linhasHistorico(listaVersoes, atual, atual.ensinada)}
          versoes={listaVersoes}
          ligada={atual.ativo}
          valePara={valeParaCurto}
          restaurar={(versaoId) => restaurarVersao.bind(null, versaoId, hrefPainel(atual.id, { aba: 'historico' }))}
          aviso={avisoHistorico ? <p className="text-sm text-warning">{avisoHistorico}</p> : undefined}
        />
        <RegrasFixas />
      </>
    );
  } else if (aberta) {
    conteudoEditor = <EmptyState icone={SearchX} titulo="Não encontrei esta orientação." descricao="Ela pode ter sido apagada junto com a empresa ou o setor." />;
  } else if (todas.length === 0 && !filtrando && !erroLista) {
    conteudoEditor = (
      <div className="flex flex-col items-center gap-4 px-4 py-8">
        <EmptyState
          icone={GraduationCap}
          className="py-0"
          titulo="Nenhuma orientação ainda."
          descricao="Escreva como o agente deve atender, as regras do escritório e o que fazer em situações específicas. Comece por um exemplo:"
        />
        <ul className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
          {MODELOS.map((m) => (
            <li key={m.id}>
              <Link
                href={href({ orientacao: 'nova', modelo: m.id, aba: null })}
                scroll={false}
                className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-left whitespace-normal transition-colors duration-150 ease-out hover:border-brand hover:bg-surface-muted"
              >
                <StatusBadge tipo="orientacao" status={m.tipo} className="self-start" />
                <span className="font-medium text-foreground">{m.titulo}</span>
                <span className="text-sm text-muted">{m.texto}</span>
                <span className="mt-auto text-sm font-medium text-brand">Usar este exemplo</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  } else {
    conteudoEditor = (
      <EmptyState
        icone={GraduationCap}
        titulo="Escolha uma orientação na lista."
        descricao="Ou crie uma nova. Enquanto isso, o simulador ao lado testa o agente com as orientações ligadas."
        acao={<Link href={hrefPainel('nova')} scroll={false} className={variantesBotao({ variant: 'outline', size: 'sm' })}>Criar orientação</Link>}
      />
    );
  }

  return (
    <div className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
      <Hidratado />
      <ListaOrientacoes
        linhas={filtradas}
        total={todas.length}
        contagem={contarSituacao(todas)}
        filtro={f.ativo}
        busca={f.q}
        aberta={atual?.id ?? null}
        orientacaoNaUrl={aberta}
        medidor={medidor}
        empresaMaisPesada={empresaMaisPesada}
        erro={erroLista ? 'Não consegui carregar as orientações agora.' : null}
        aviso={avisoLista}
        hrefOrientacao={(id) => hrefPainel(id)}
        hrefFiltro={(v) => href({ ativo: v })}
        hrefNova={hrefPainel('nova')}
      />
      <section aria-label="Editor da orientação" className="flex min-w-0 flex-1 flex-col gap-4 bg-background p-6 lg:overflow-y-auto">
        {erro && !aberta && <AvisoErro erro={erro} />}
        {conteudoEditor}
      </section>
      <Simulador
        key={aberta ?? 'nenhuma'}
        aberta={aberta === 'nova' ? 'nova' : atual ? 'salva' : null}
        idOrientacao={atual?.id ?? null}
        salva={atual ? { titulo: atual.titulo, texto: atual.texto, tipo: atual.tipo, clienteId: atual.clienteId, setorId: atual.setorId, ativo: atual.ativo } : null}
        empresas={clientes.map(opcaoEmpresa)}
        avisoEmpresas={avisoEmpresas}
      />
    </div>
  );
}
```

Se o `typecheck` reclamar do apelido `criador:usuarios!orientacoes_agente_criado_por_fkey(nome)`, confira o nome da chave em `packages/db/src/tipos.gen.ts` (`orientacoes_agente` → `Relationships`) e use o que estiver lá (a de `atualizado_por` era `orientacoes_agente_atualizado_por_fkey`).

- [ ] **Passo 5: `loading.tsx` (arquivo inteiro)**

```tsx
import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Treinar o agente: esqueleto das três colunas. */
export default function CarregandoTreinarAgente() {
  return (
    <div role="status" aria-label="Carregando Treinar o agente" className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
      <div className="flex flex-col gap-3 border-border bg-surface p-4 max-lg:border-b lg:w-lista-treinar lg:shrink-0 lg:border-r">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full" />
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="flex flex-col gap-3 border-border bg-surface p-4 max-lg:border-t lg:w-simulador-treinar lg:shrink-0 lg:border-l">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
```

- [ ] **Passo 6: tirar o que ficou sem uso**

1. Confira que ninguém mais importa os arquivos que saem:
   `grep -rn "formulario-orientacao\|historico-orientacao\|abas-orientacao\|from './medidor'\|testar-agente'\|empresasParaTeste\|EmpresasTeste" apps/painel/src`
   Só podem aparecer `acoes.ts` (definição de `empresasParaTeste`/`EmpresasTeste`) e os próprios arquivos.
2. Apague: `git rm "apps/painel/src/app/(painel)/treinar-agente/formulario-orientacao.tsx" "apps/painel/src/app/(painel)/treinar-agente/historico-orientacao.tsx" "apps/painel/src/app/(painel)/treinar-agente/abas-orientacao.tsx" "apps/painel/src/app/(painel)/treinar-agente/medidor.tsx" "apps/painel/src/app/(painel)/treinar-agente/testar-agente.tsx"`
3. Em `acoes.ts`, apague o bloco `export type EmpresasTeste = …` e a função `empresasParaTeste` inteira (com o comentário dela). Depois, tire dos imports o que ficar sem uso (`EmpresaOpcao`, `lerEmPaginas`, `AVISO_EMPRESAS_INCOMPLETAS`, `opcaoEmpresa`, se o `typecheck` acusar). Nada mais muda no arquivo.

- [ ] **Passo 7: rodar**

Run: `pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel test`
Expected: sem erros; PASS (todos os testes de unidade, sem edição).

Run (Supabase local 563xx): `cd apps/painel && pnpm exec playwright test e2e/treinar-simulador.spec.ts`
Expected: 4 passed.

Os e2e da tela antiga (`treinar-agente`, `testar-agente`, a linha de `ensinar-agente` e os trechos de `acessibilidade`) ficam vermelhos até a Task 7; **não rode a suíte inteira antes dela**.

- [ ] **Passo 8: conferir no navegador (claro e escuro, 1366)**

Suba `pnpm --filter @escritorio/painel exec next dev -p <porta livre>` contra o banco **local** e confira: menu recolhido; três colunas sem rolagem horizontal; faixa por tipo e legenda; segmentados com foco visível; borda tracejada do "O que o agente faria"; no celular (390px) as colunas empilham. Desligue esse `next dev` ao terminar (memória).

- [ ] **Passo 9: commit**

```bash
git add -A "apps/painel/src/app/(painel)/treinar-agente" apps/painel/e2e/apoio-treinar.ts apps/painel/e2e/treinar-simulador.spec.ts
git commit -m "feat(painel): Treinar o agente em três colunas — lista, editor e simulador sempre visível; sai o painel lateral e o Dialog de teste

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: E2e da tela antiga adaptados (D19)

**Files:**
- Modify: `apps/painel/e2e/treinar-agente.spec.ts`, `apps/painel/e2e/testar-agente.spec.ts`, `apps/painel/e2e/ensinar-agente.spec.ts`, `apps/painel/e2e/acessibilidade.spec.ts`

**Regra desta task:** mesmo cenário, mesmas conferências no banco. Só mudam localizadores, as esperas da hidratação e os passos que o spec trocou. **Nenhuma linha com `db.`, `toMatchObject`, `toEqual` ou `toHaveLength` sobre o banco muda** (prova no Passo 6).

- [ ] **Passo 1: `treinar-agente.spec.ts` (trocas exatas)**

1. Imports: acrescente `import { editor, esperarTreinar } from './apoio-treinar';`.
2. `const painel = (page: Page) => page.getByRole('dialog');` → `const painel = (page: Page) => editor(page);`
3. Depois de **cada** `await page.getByRole('link', { name: 'Treinar o agente' }).click();` (testes 1 e 3) e de **cada** `await page.goto('/treinar-agente…');` (testes 1, 2 e 4), acrescente na linha seguinte `await esperarTreinar(page);`.
4. `await expect(page.getByText('0 de 12.000 caracteres')).toBeVisible();` →
   `await expect(page.getByRole('progressbar', { name: 'Espaço usado pelas orientações ligadas' })).toHaveAttribute('aria-valuetext', '0 de 12.000 caracteres');`
5. Teste 1: as duas `painel(page).getByRole('button', { name: 'Salvar orientação' }).click();` → `painel(page).getByRole('button', { name: 'Salvar desligada' }).click();`
6. Teste 1: `await expect(painel(page).getByText('Alterações não salvas')).toBeVisible();` → `… getByText('Rascunho não salvo') …`
7. Teste 1: troque

```ts
  await page.keyboard.press('Escape');
  await expect(painel(page)).toHaveCount(0);
  const linha = page.getByRole('row', { name: /Cumprimento/ });
```

por

```ts
  await page.goto('/treinar-agente');
  await esperarTreinar(page);
  const linha = page.getByRole('listitem').filter({ hasText: 'Cumprimento' });
```

8. Teste 1: `await expect(linha.getByText('Ligada')).toBeVisible();` →
   `await expect(linha.getByRole('switch', { name: 'Desligar a orientação Cumprimento' })).toHaveAttribute('aria-checked', 'true');`
9. Teste 1: `await expect(page.getByText(/^[1-9]\d* de 12\.000 caracteres$/)).toBeVisible();` →
   `await expect(page.getByRole('progressbar', { name: 'Espaço usado pelas orientações ligadas' })).toHaveAttribute('aria-valuetext', /^[1-9]\d* de 12\.000 caracteres$/);`
10. Teste 1: troque

```ts
  await page.getByRole('row', { name: /Cumprimento/ }).getByText('Chame o cliente pelo nome e seja breve.').click();
  await painel(page).getByRole('tab', { name: 'Histórico (3)' }).click();
```

por

```ts
  await page.getByRole('link', { name: /Cumprimento/ }).click();
  await expect(painel(page).getByRole('heading', { name: 'Histórico · 3 versões' })).toBeVisible();
```

11. Teste 1: `await expect(painel(page).getByRole('tab', { name: 'Histórico (4)' })).toHaveAttribute('aria-selected', 'true');` →
    `await expect(painel(page).getByRole('heading', { name: 'Histórico · 4 versões' })).toBeVisible();`
12. Teste 2: `const linha = page.getByRole('row', { name: /Boleto/ });` → `const linha = page.getByRole('listitem').filter({ hasText: 'Boleto' });`
13. Teste 3: troque

```ts
  await painel(page).getByRole('switch', { name: 'Ligada' }).click();
  await painel(page).getByRole('button', { name: 'Salvar orientação' }).click();
```

por

```ts
  await painel(page).getByRole('button', { name: 'Salvar e ligar' }).click();
```

14. Teste 4: as duas `'Salvar orientação'` → `'Salvar desligada'`; as duas `'Alterações não salvas'` → `'Rascunho não salvo'`.
15. Comentário do topo: acrescente " (desde a G5, em três colunas: lista, editor e simulador)" ao fim da primeira linha.

- [ ] **Passo 2: `testar-agente.spec.ts` (arquivo inteiro)**

As funções `limpar`, `simulacoes`, os `beforeEach/afterAll` e todas as conferências no banco ficam **iguais**; mudam a janela (região "Simulador"), os nomes dos botões e os passos do Dialog.

```ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirTreinar, editor, esperarTreinar } from './apoio-treinar';

// "Testar o agente" (spec 2026-09-30 §4 e §5), desde a G5 no simulador sempre visível da tela (spec 7C.5). Nos e2e não roda
// trabalhador: o teste fica pendente ("Pensando…") e o resultado é gravado direto no banco (service role), como o
// trabalhador gravaria; o simulador mostra pelo tempo real.

const senha = 'Senha-e2e-123';
const EMAIL_MARCADA = 'testa-agente@e2e.local';
const EMAIL_ADMIN = 'admin-testa-agente@e2e.local';
const CNPJ = '45321789000291';
const EMPRESA = 'Mercearia Teste Ltda';

async function limpar() {
  await db.from('orientacoes_agente').delete().eq('titulo', 'Prazo do teste');
  await db.from('clientes').delete().eq('cnpj', CNPJ);
}

test.beforeEach(limpar);
test.afterAll(async () => {
  await limpar();
  // Apagar o login apaga a pessoa em usuarios e as simulações dela (cascata).
  const { data: lista } = await db.auth.admin.listUsers();
  for (const u of lista.users.filter((x) => [EMAIL_MARCADA, EMAIL_ADMIN].includes(x.email ?? ''))) await db.auth.admin.deleteUser(u.id);
});

async function simulacoes(usuarioId: string) {
  const { data } = await db.from('simulacoes_agente').select('id, mensagem, cliente_id, rascunho, status').eq('usuario_id', usuarioId).order('criado_em');
  return data ?? [];
}

const janela = (page: Page) => page.getByRole('region', { name: 'Simulador', exact: true });
const testar = (page: Page) => janela(page).getByRole('button', { name: 'Testar', exact: true });

test('atendente marcada testa o agente: Pensando…, teste pendente retomado, resultado e erro pelo tempo real', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_MARCADA, senha, nome: 'Carla Testa', papel: 'atendente', setores: ['Fiscal'], permissoes: ['treinar_agente'] });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Mercearia Teste', cnpj: CNPJ }).select('id').single();
  await entrar(page, EMAIL_MARCADA, senha);
  await abrirTreinar(page);

  await expect(janela(page).getByRole('heading', { name: 'Simulador' })).toBeVisible();
  await expect(janela(page).getByText('Nada é enviado ao cliente nem gravado em demanda.')).toBeVisible();
  await expect(janela(page).getByText('orientações ligadas, sem rascunho')).toBeVisible();

  // Mensagem vazia não sai (campo obrigatório).
  await testar(page).click();
  expect(await simulacoes(usuario)).toHaveLength(0);

  await janela(page).getByLabel('Mensagem do cliente').fill('Bom dia, preciso da guia do DAS.');
  await janela(page).getByRole('combobox', { name: 'Como cliente de' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Mercearia');
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();
  await testar(page).click();
  await expect(janela(page).getByRole('status').filter({ hasText: 'Pensando…' })).toBeVisible();
  await expect(testar(page)).toBeDisabled();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  const [sim] = await simulacoes(usuario);
  expect(sim).toMatchObject({ mensagem: 'Bom dia, preciso da guia do DAS.', cliente_id: cliente!.id, rascunho: null, status: 'pendente' });

  // Recarregar e testar de novo com o primeiro ainda pendente: o simulador retoma o pendente em vez de criar outro.
  await page.reload();
  await esperarTreinar(page);
  await janela(page).getByLabel('Mensagem do cliente').fill('Outra mensagem');
  await expect(janela(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Sem empresa/);
  await janela(page).getByRole('combobox', { name: 'Como cliente de' }).click();
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();
  await testar(page).click();
  await expect(janela(page).getByText('Você já tem um teste em andamento')).toBeVisible();
  await expect(janela(page).getByText('Bom dia, preciso da guia do DAS.')).toBeVisible();
  expect(await simulacoes(usuario)).toHaveLength(1);

  // O trabalhador grava o resultado: aparece sem recarregar.
  await db.from('simulacoes_agente').update({
    status: 'pronta',
    respostas: {
      mensagens: ['Bom dia! Vou pedir a guia ao Fiscal.', 'Assim que estiver pronta, mando aqui.'],
      acoes: [{ ferramenta: 'abrir_chamado', resumo: 'Abriria uma demanda no Fiscal: Guia do DAS' }],
      observacoes: ['1 orientação ficou de fora por passar do limite de caracteres.'],
    },
  }).eq('id', sim!.id);
  await expect(janela(page).getByText('Bom dia! Vou pedir a guia ao Fiscal.')).toBeVisible({ timeout: 10_000 });
  await expect(janela(page).getByText('Assim que estiver pronta, mando aqui.')).toBeVisible();
  await expect(janela(page).getByText('Pensando…')).toHaveCount(0);
  await expect(janela(page).getByText('1 orientação ficou de fora')).toBeVisible();
  // As ações aparecem abertas, em "O que o agente faria"; sem rascunho, não há comparação.
  await expect(janela(page).getByRole('heading', { name: 'O que o agente faria' })).toBeVisible();
  await expect(janela(page).getByText('Abriria uma demanda no Fiscal: Guia do DAS')).toBeVisible();
  await expect(janela(page).getByRole('region', { name: 'Sem o rascunho' })).toHaveCount(0);

  // Outro teste, agora sem empresa; o trabalhador grava erro: aviso humano e "Tentar de novo".
  await janela(page).getByRole('button', { name: 'Testar sem empresa' }).click();
  await expect(janela(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Sem empresa/);
  await testar(page).click();
  await expect(janela(page).getByText('Pensando…')).toBeVisible();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(2);
  const segunda = (await simulacoes(usuario))[1]!;
  expect(segunda).toMatchObject({ mensagem: 'Outra mensagem', cliente_id: null, status: 'pendente' });
  await db.from('simulacoes_agente').update({ status: 'erro', erro: 'O limite mensal de gasto com IA foi atingido. O teste não pode ser feito agora; fale com o administrador.' }).eq('id', segunda.id);
  await expect(janela(page).getByRole('alert')).toContainText('O limite mensal de gasto com IA foi atingido.', { timeout: 10_000 });
  await janela(page).getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(janela(page).getByText('Pensando…')).toBeVisible();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(3);
  expect((await simulacoes(usuario))[2]).toMatchObject({ mensagem: 'Outra mensagem', cliente_id: null, status: 'pendente' });
  // Nada mais foi gravado: a tela continua sem orientações.
  const { count } = await db.from('orientacoes_agente').select('id', { count: 'exact', head: true }).eq('titulo', 'Prazo do teste');
  expect(count).toBe(0);
});

test('o simulador manda o que está no formulário, sem salvar', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Testa', papel: 'admin' });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Mercearia Teste', cnpj: CNPJ }).select('id').single();
  const { data: salva } = await db.from('orientacoes_agente')
    .insert({ titulo: 'Prazo do teste', texto: 'Documentos saem no mesmo dia.', tipo: 'regra', ativo: true }).select('id').single();
  await entrar(page, EMAIL_ADMIN, senha);
  await abrirTreinar(page, `?orientacao=${salva!.id}`);
  const painel = editor(page);

  // Edita sem salvar: texto novo e vale só para a empresa.
  await painel.getByLabel('O que o agente deve fazer').fill('Documentos pedidos até as 15h saem no mesmo dia.');
  await painel.getByRole('radio', { name: 'Uma empresa' }).check();
  await painel.getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Mercearia');
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();

  await expect(janela(page).getByText('usando o rascunho, ligado')).toBeVisible();
  // A empresa da orientação já vem escolhida para o teste.
  await expect(janela(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Mercearia Teste/);
  await janela(page).getByLabel('Mensagem do cliente').fill('Pedi o contrato social às 14h, sai hoje?');
  await testar(page).click();
  await expect(janela(page).getByText('Pensando…')).toBeVisible();
  await expect(janela(page).getByText('Teste com o rascunho')).toContainText('Prazo do teste');
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  expect((await simulacoes(usuario))[0]).toMatchObject({
    mensagem: 'Pedi o contrato social às 14h, sai hoje?',
    cliente_id: cliente!.id,
    rascunho: { id: salva!.id, titulo: 'Prazo do teste', texto: 'Documentos pedidos até as 15h saem no mesmo dia.', tipo: 'regra', cliente_id: cliente!.id, setor_id: null },
  });

  // Nada salvo: a orientação continua como estava e o formulário ainda tem as alterações.
  const { data: depois } = await db.from('orientacoes_agente').select('texto, cliente_id').eq('id', salva!.id).single();
  expect(depois).toEqual({ texto: 'Documentos saem no mesmo dia.', cliente_id: null });
  await expect(painel.getByText('Rascunho não salvo')).toBeVisible();
  await expect(painel.getByLabel('O que o agente deve fazer')).toHaveValue('Documentos pedidos até as 15h saem no mesmo dia.');
});

test('rascunho com o título vazio não vira teste', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Testa', papel: 'admin' });
  await entrar(page, EMAIL_ADMIN, senha);
  await abrirTreinar(page, '?orientacao=nova');
  const painel = editor(page);
  await painel.getByLabel('O que o agente deve fazer').fill('Seja breve.');
  await janela(page).getByLabel('Mensagem do cliente').fill('Oi');
  await testar(page).click();
  await expect(janela(page).getByRole('alert')).toHaveText('Complete o rascunho para testar: Informe o título da orientação.');
  await expect(painel.getByLabel('Título')).toBeFocused();
  expect(await simulacoes(usuario)).toHaveLength(0);
});
```

- [ ] **Passo 3: `ensinar-agente.spec.ts`**

1. Imports: acrescente `import { editor } from './apoio-treinar';`.
2. `await expect(page.getByRole('dialog').getByRole('heading', { name: TITULO_SUGERIDO })).toBeVisible();` →
   `await expect(editor(page).getByRole('heading', { name: TITULO_SUGERIDO })).toBeVisible();`

Nada mais muda.

- [ ] **Passo 4: `acessibilidade.spec.ts`**

1. Imports: acrescente `import { abrirTreinar, esperarTreinar } from './apoio-treinar';`.
2. No trecho "Treinar o agente: busca de empresa aberta no formulário e confirmação de restaurar uma versão", troque

```ts
      await page.goto(`/treinar-agente?orientacao=${ids.orientacao}`);
      await page.getByRole('dialog').getByRole('combobox', { name: 'Empresa' }).click();
```

por

```ts
      await page.goto(`/treinar-agente?orientacao=${ids.orientacao}`);
      await esperarTreinar(page);
      await page.getByRole('region', { name: 'Editor da orientação' }).getByRole('combobox', { name: 'Empresa' }).click();
```

e, logo depois de `await page.goto(\`/treinar-agente?orientacao=${ids.orientacao}&aba=historico\`);`, acrescente `await esperarTreinar(page);`.
3. Troque o teste `Testar o agente aberto (vazio, pensando, resultado e erro) sem violações graves (${tema})` inteiro por:

```ts
    test(`Testar o agente aberto (vazio, pensando, resultado e erro) sem violações graves (${tema})`, async ({ page }) => {
      const ids = await semear();
      await entrar(page, EMAIL, SENHA);
      const erros: string[] = [];
      await abrirTreinar(page);
      const janela = page.getByRole('region', { name: 'Simulador', exact: true });
      const testar = janela.getByRole('button', { name: 'Testar', exact: true });
      await expect(janela.getByLabel('Mensagem do cliente')).toBeVisible();
      erros.push(...(await auditar(page, 'Simulador (vazio)', tema)));
      await janela.getByLabel('Mensagem do cliente').fill('Bom dia, preciso do comprovante.');
      await testar.click();
      await expect(janela.getByText('Pensando…')).toBeVisible();
      erros.push(...(await auditar(page, 'Simulador (pensando)', tema)));
      // Sem trabalhador nos e2e: o resultado vai direto no banco, como o trabalhador gravaria.
      await expect.poll(async () => (await db.from('simulacoes_agente').select('id').eq('usuario_id', ids.usuario)).data?.length).toBe(1);
      await db.from('simulacoes_agente').update({
        status: 'pronta',
        respostas: { mensagens: ['Bom dia! Já peço ao Fiscal.'], acoes: [{ ferramenta: 'abrir_chamado', resumo: 'Abriria uma demanda no Fiscal: Comprovante' }], observacoes: ['Aviso do teste.'] },
      }).eq('usuario_id', ids.usuario);
      await expect(janela.getByText('Bom dia! Já peço ao Fiscal.')).toBeVisible({ timeout: 10_000 });
      erros.push(...(await auditar(page, 'Simulador (resultado)', tema)));
      await testar.click();
      await expect.poll(async () => (await db.from('simulacoes_agente').select('id').eq('usuario_id', ids.usuario)).data?.length).toBe(2);
      await db.from('simulacoes_agente').update({ status: 'erro', erro: 'Não consegui fazer o teste agora. Tente de novo em alguns minutos.' }).eq('usuario_id', ids.usuario).eq('status', 'pendente');
      await expect(janela.getByRole('alert')).toBeVisible({ timeout: 10_000 });
      erros.push(...(await auditar(page, 'Simulador (erro)', tema)));

      // Com rascunho e "Sem o rascunho": a orientação semeada com o texto mudado, sem salvar.
      await abrirTreinar(page, `?orientacao=${ids.orientacao}`);
      await page.getByRole('region', { name: 'Editor da orientação' }).getByLabel('O que o agente deve fazer').fill('Responda com uma frase só.');
      await janela.getByLabel('Mensagem do cliente').fill('Bom dia, preciso do comprovante.');
      await testar.click();
      await expect.poll(async () => (await db.from('simulacoes_agente').select('id').eq('usuario_id', ids.usuario)).data?.length).toBe(3);
      await db.from('simulacoes_agente').update({
        status: 'pronta', respostas: { mensagens: ['Bom dia! Segue o comprovante.'], acoes: [], observacoes: [] },
      }).eq('usuario_id', ids.usuario).eq('status', 'pendente');
      await janela.getByRole('button', { name: 'Comparar sem o rascunho' }).click();
      await expect.poll(async () => (await db.from('simulacoes_agente').select('id').eq('usuario_id', ids.usuario)).data?.length).toBe(4);
      await db.from('simulacoes_agente').update({
        status: 'pronta', respostas: { mensagens: ['Bom dia! Vou ver com o Fiscal.'], acoes: [], observacoes: [] },
      }).eq('usuario_id', ids.usuario).eq('status', 'pendente');
      await expect(janela.getByRole('region', { name: 'Sem o rascunho' }).getByText('Bom dia! Vou ver com o Fiscal.')).toBeVisible({ timeout: 10_000 });
      erros.push(...(await auditar(page, 'Simulador (com rascunho e sem o rascunho)', tema)));
      expect(erros, erros.join('\n')).toEqual([]);
    });
```

As rotas `/treinar-agente…` da lista de rotas e o teste "Treinar o agente sem orientações (exemplos)" ficam **iguais**.

- [ ] **Passo 5: rodar (um lote só com estes)**

Supabase local 563xx, `supabase db reset` antes:
Run: `cd apps/painel && pnpm exec playwright test e2e/treinar-simulador.spec.ts e2e/treinar-agente.spec.ts e2e/testar-agente.spec.ts e2e/ensinar-agente.spec.ts`
Expected: todos passam (4 + 4 + 3 + os de `ensinar-agente`).

Run: `cd apps/painel && pnpm exec playwright test e2e/acessibilidade.spec.ts`
Expected: todos passam, nos dois temas.

- [ ] **Passo 6: provar que nenhuma conferência no banco mudou (D19)**

Run: `git diff BASE -- apps/painel/e2e/treinar-agente.spec.ts apps/painel/e2e/testar-agente.spec.ts apps/painel/e2e/ensinar-agente.spec.ts | grep -E '^[-+][^-+].*(db\.from|toMatchObject|toEqual|toHaveLength|expect\(count\))'`
Expected: **nenhuma linha**. (Se aparecer alguma, a adaptação mexeu numa conferência: desfaça.) Em `acessibilidade.spec.ts`, as linhas novas com `db.from` são só as do trecho "Com rascunho e Sem o rascunho" (acréscimos).

- [ ] **Passo 7: commit**

```bash
git add apps/painel/e2e/treinar-agente.spec.ts apps/painel/e2e/testar-agente.spec.ts apps/painel/e2e/ensinar-agente.spec.ts apps/painel/e2e/acessibilidade.spec.ts
git commit -m "test(painel): e2e do Treinar o agente e do Testar o agente na tela de três colunas — mesmas conferências no banco, simulador com e sem rascunho na acessibilidade

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Manuais

**Files:**
- Modify: `docs/design-system.md`, `docs/operacao.md`

Nenhum padrão novo vai para `patterns/` (os componentes são da tela), então o catálogo `/_design` não muda.

- [ ] **Passo 1: `docs/design-system.md`**

Logo depois do parágrafo que começa com `**Assistente** (G4):`, acrescente:

```markdown
**Treinar o agente** (G5): três colunas com o menu recolhido, como no Atendimento e no Assistente (larguras `w-lista-treinar` e `w-simulador-treinar`, tokens `--training-list-width` e `--training-simulator-width`). A lista tem o medidor compacto, os filtros Todas/Ligadas/Desligadas (`data-filtro`/`data-contagem`, contrato dos testes), a faixa de cor por tipo (Jeito `bg-warning`, Regra `bg-brand`, Situação `bg-info`) sempre com a legenda escrita e o tipo no nome do link, e a chave em cada linha. O editor é um `FormularioAlteravel` com id `form-orientacao`: SALVAR DESLIGADA e SALVAR E LIGAR são o mesmo envio, com `ativo` pelo botão; DESCARTAR remonta o formulário. Rótulos curtos nos botões segmentados levam o resto do nome em `sr-only` ("Jeito" → "Jeito de atender"). O simulador lê o formulário na hora do teste (o rascunho vai sem salvar) e acompanha as mudanças pelo evento `treinar:rascunho`; "Sem o rascunho" é um segundo teste, sob pedido, sem rascunho. Nada no simulador grava além do próprio teste.
```

- [ ] **Passo 2: `docs/operacao.md`, seção 10 (trocas exatas)**

1. Em "### Ligar e desligar", troque o parágrafo inteiro por:

```markdown
Toda orientação nova começa **desligada**. No editor, **Salvar desligada** guarda sem o agente ler; **Salvar e ligar** guarda e já liga. A chave de cada linha da lista (e a do alto do editor) liga e desliga na hora, sem mexer no texto que você está escrevendo. Desligada, ela fica guardada, mas o agente não lê. É o jeito seguro de preparar uma orientação, testar no simulador e só depois ligar.
```

2. Em "### Medidor e limite", troque `No alto da tela, o medidor mostra` por `No alto da lista, o medidor (**Espaço usado**) mostra`.
3. Em "### Histórico e restaurar", troque `Abra uma orientação e clique na aba **Histórico**.` por `Abra uma orientação: o **Histórico** fica embaixo do editor, numa tabela.` e troque `**Restaurar esta versão** volta` por `**Restaurar** volta`.
4. Em "### Testar antes de ligar", troque os dois itens da lista (os que começam com `- **Testar o agente**` e `- **Testar esta orientação**`) por:

```markdown
- **Simulador** (coluna da direita, sempre visível): escolha a empresa em "Como cliente de" (ou teste sem empresa), escreva como o cliente escreveria e toque em **Testar**. Aparecem a resposta que o agente mandaria e, em "O que o agente faria", as ações (por exemplo "Abriria uma demanda no Fiscal: guia do DAS") — tudo só simulado.
- Com uma orientação aberta, o teste usa o que está **escrito no editor agora**, ligado, mesmo sem salvar (o selo diz "usando o rascunho, ligado"). Se a orientação vale para uma empresa, o simulador já vem com ela. Faltando título, texto ou empresa, o teste não sai e o campo que falta fica em destaque.
- Sem orientação aberta, o teste usa só as orientações **ligadas**.
- **Sem o rascunho**: depois do resultado, **Comparar sem o rascunho** roda mais um teste com a mesma mensagem e empresa, sem o que você escreveu, e mostra lado a lado como o agente responde hoje. É mais um teste e conta em Gastos com IA ("Testar o agente").
```

5. Em "### Ensinar o agente pelas conversas", no item `- A orientação criada assim começa **desligada**. …`, acrescente ao fim: ` Na lista ela aparece com a marca **do Atendimento**.`
6. Em "### As orientações da sua skill de atendimento", troque `- Teste com "Testar o agente" e ligue uma por uma.` por `- Teste no simulador e ligue uma por uma. Enquanto uma orientação tiver "(a preencher)", a lista mostra quantos campos faltam.`

- [ ] **Passo 3: commit**

```bash
git add docs/design-system.md docs/operacao.md
git commit -m "docs: Treinar o agente em três colunas — editor com Salvar desligada/ligar, simulador com rascunho e Sem o rascunho, histórico em tabela

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes da suíte pgTAP e antes do primeiro lote de e2e:
   - **nada fora do painel mudou:** `git diff BASE --stat -- supabase packages apps/trabalhador` sai **vazio** (sem migração, sem tipos, sem trabalhador: D1, D22); `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff BASE --stat -- 'apps/painel/**/*.test.ts'` só mostra arquivos **novos** (`tela.test.ts`, `menu-tela-treinar.test.ts`, `largura-treinar.test.ts`); o Passo 6 da Task 7 continua sem nenhuma linha;
   - `supabase test db`: todos os arquivos, com os números de cada um, inclusive o `22` (100/100) e o `25`;
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`; `pnpm --filter @escritorio/trabalhador test` e `typecheck` (inalterados, mas rodados para provar; os testes de `simular.ts` provam que o teste grava `testar_agente` com a pessoa);
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - **e2e em lotes** (pouca memória; nada mais rodando além do Supabase local): lote 1 `e2e/treinar-simulador.spec.ts e2e/treinar-agente.spec.ts e2e/testar-agente.spec.ts e2e/ensinar-agente.spec.ts`; lote 2 `e2e/acessibilidade.spec.ts`; depois os demais arquivos de `ls apps/painel/e2e/*.spec.ts`, em lotes de até 6, na ordem alfabética. Some os números de todos os lotes;
   - **cenários com Claude de verdade (`cenarios`, `cenarios-atendimento`, `cenarios-assistente`): não rodar** — nada do que o modelo vê mudou (D22; prova: o `git diff` acima). Se, por qualquer motivo, algo em `apps/trabalhador` tiver mudado, **pare**: isso está fora desta parte;
   - mostre os números exatos de cada suíte e de cada lote (passaram, falharam, pulados). Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-treinar-agente-opcao-b.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local e dados parecidos com os da imagem: Ana (admin), no banco **local** os setores e as 10 orientações da skill (`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/dados/setores-novos.sql` e `-f supabase/dados/orientacoes-skill-dono.sql`, com o `DATABASE_URL` do `.env` **local**, nunca da homologação), ligadas as seis da imagem; mais "Prazo da folha da Padaria" (Padaria Sol ME, ligada), "Guia do DAS atrasada" (setor Fiscal, ligada), "Holerite pedido por funcionário" (setor Pessoal) e "Nota com unidade fora do cadastro" (Rede Bom Preço Ltda, CNPJ 12.345.678/0001-90, desligada, criada por Ana no formato do Ensinar, com duas edições, texto da imagem); duas simulações semeadas pela chave de serviço do banco local com os textos da imagem (com o rascunho: resposta + abriria demanda no Fiscal; sem o rascunho: "Pediria o CNPJ…");
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**);
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-g5\` com nomes `g5-<tela>-<largura>-<tema>.png`: `treinar` ("Nota com unidade fora do cadastro" aberta, rascunho não salvo, resultado e "Sem o rascunho" preenchidos, como na imagem), `treinar-nova` (`?orientacao=nova&modelo=cumprimento`), `treinar-sem-orientacao` (nenhuma aberta; simulador "orientações ligadas, sem rascunho"), `treinar-historico` (rolado até o histórico, com a janela "Restaurar esta versão?" aberta), `treinar-vazio` (sem orientações: os três exemplos);
   - liste o que ficou diferente da imagem. Já se sabe: sem "Buscaria produtos…" em "O que o agente faria" (D6); "Seguiu a orientação…" virou "Teste com o rascunho … (ligado, sem salvar)" (D7); "Criada por Ana no Atendimento", sem "a partir da conversa com Carla Mendes" (D8); "Sem o rascunho" só depois de "Comparar sem o rascunho" (D3); simulador com um teste por vez (D5); a trilha continua "Treinar o agente" (D23); as etiquetas "Opção B — Editor com simulador" e "NOVO" eram legendas da maquete; as larguras acompanham a letra (330/410 em 1366, maiores em 1920).
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Ela deve listar só as que já estavam pendentes: Parte F (`20261006000100_painel_v2_gastos_colunas.sql` a `20261006000300_painel_v2_gastos_funcoes.sql`), G1 (`20261007000100_painel_v2_prazos_regra.sql`, `20261007000200_painel_v2_cargos.sql`), G2 (`20261008000100_painel_v2_inicio.sql`) e G3 (`20261009000100_painel_v2_contatos.sql`). **A G5 não acrescenta nenhuma** (D1): se aparecer outra, pare e avise;
   - **não aplique.** Deixe para o dono, por escrito: a G5 não muda o banco nem o trabalhador; o Treinar o agente novo funciona com ou sem as migrações pendentes (D21); para aplicar F, G1, G2 e G3 juntas, depois do "ok" dele: `supabase db push --db-url "$DATABASE_URL"`.
4. **Subir o painel para o dono ver:**
   - **painel** desta worktree numa **porta livre** (comece pela **3014**: `netstat -ano | findstr :3014`; se ocupada, a próxima livre). Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal: variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p <porta>` rodando nesta worktree. Antes, confira que nenhum e2e nem outro `next dev` desta parte está rodando (memória);
   - **trabalhador: NÃO suba nenhum e não há nada "pronto para trocar"** (G5 não muda o trabalhador). O da porta **3001 é o teste do dono**; não o desligue nem o mate. Ele já tem a simulação com rascunho (`simular.ts` da Parte A), então o simulador e o "Comparar sem o rascunho" funcionam com ele; o custo dos testes vai para `uso_ia` sem a funcionalidade até a Parte F estar aplicada e o trabalhador ser trocado (continua somando no teto, D21);
   - avise: o Treinar o agente novo abre inteiro mesmo com as migrações da F, G1, G2 e G3 pendentes;
   - passe o endereço e um roteiro curto:
     1. abra Treinar o agente: o menu vem recolhido; a lista mostra o espaço usado, Ligadas/Desligadas e as cores por tipo; as orientações vindas do Atendimento têm "do Atendimento"; as da skill mostram quantos campos faltam preencher;
     2. abra uma orientação, mude o texto **sem salvar** e teste no simulador como cliente de uma empresa: a resposta e "O que o agente faria" aparecem; nada é enviado nem gravado;
     3. toque **Comparar sem o rascunho**: o segundo teste mostra como o agente responde hoje;
     4. **Descartar** volta o texto salvo; **Salvar desligada** e **Salvar e ligar** gravam; a chave do alto liga e desliga na hora;
     5. no histórico, **Restaurar** uma versão antiga (não liga nem desliga);
     6. sem orientação aberta, o simulador testa só as ligadas.
5. **Pendências para listar no fim:**
   - as decisões D1 a D24 que o dono ainda não confirmou (destaque D2, D3, D8, D12 e D19, que dizem o que "Sem o rascunho" compara, quando ele roda, como a etiqueta "do Atendimento" é decidida, como salvar funciona e por que os e2e da tela antiga foram adaptados);
   - o que ficou diferente da imagem (item 2);
   - se o dono quiser o nome do contato em "Criada por … a partir da conversa com …" ou as leituras em "O que o agente faria": migração `20261011000100` (D8) e/ou mudança no trabalhador com cenários de verdade (D6) — fora desta parte;
   - aplicar na homologação as migrações da F, G1, G2 e G3 (item 3), depois do "ok";
   - Parte G concluída (G1–G5); próximas: Parte H e Parte I.
6. **Não juntar** a branch em nada. **Parar** ao fim da G5 e esperar o dono ver.
