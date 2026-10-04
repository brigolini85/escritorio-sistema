# Painel v2, Parte G4 (Assistente). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** a tela **Assistente** vira a Opção B "Conversa + resultado" (`00-assistente-opcao-b.png`). **Menu recolhido.** À esquerda, a **conversa enxuta** (~470px) com o histórico em **botões no topo** (Geral + conversas ligadas a atendimentos, "+n"). **Respostas curtas na tela:** prévia de pedido, tabela e arquivo saem do balão e viram um cartão **VER AO LADO**; o conteúdo abre no **painel de resultado** à direita, com **abas** (ex.: Pedido #536 · Pedidos em aberto (4) · Arquivos (1)). **Painel do pedido:** destinatário, pagamento, entrega, **pedido veio de** (contato e canal), tabela **"O que mudou"** (adicionado verde, removido vermelho riscado, alterado com o valor antigo), total antes/depois, cartão do **arquivo do Bling** com BAIXAR, **histórico do pedido** e **Abrir demanda**; depois do "sim", selo **"Gravado às HH:MM por <pessoa>"**. Embaixo da prévia, **SIM, GRAVAR** / **MUDAR OUTRA COISA**, que **só escrevem a resposta pela pessoa**. **As regras do assistente não mudam** (prévia com chave; grava exatamente a prévia mostrada; nada no trabalhador, no prompt, nas ferramentas nem no banco).

**Arquitetura:**
- **Banco: nada.** Nenhuma migração, nenhum teste pgTAP novo, `tipos.gen.ts` não muda. Tudo o que a tela mostra já está gravado e já é legível pela pessoa (conferido abaixo, D1, D3, D4, D5).
- **Trabalhador: nada.** `apps/trabalhador` e `packages/` não mudam (o custo da Parte F, `registrarUsoIa` em `assistente/executar.ts`, fica como está). O da porta 3001 continua o do dono.
- **Painel:** regras puras em `lib/resultados-assistente.ts` (corta cada resposta em texto curto + cartões, monta as abas, escolhe a aberta, diz quando os botões aparecem) e `lib/pedido-assistente.ts` (painel do pedido a partir da prévia, origem, selo e histórico). Leitores em `assistente/dados-assistente.ts` (mensagens, histórico de conversas, demanda do pedido com os eventos). A página (`assistente/page.tsx`) compõe o cabeçalho com `HistoricoEmBotoes`, a conversa (`chat-assistente.tsx`, `cartao-resultado.tsx`) e o painel (`painel-resultado.tsx`, `painel-pedido.tsx`, `painel-tabela.tsx`, `painel-arquivos.tsx`, `historico-pedido.tsx`), com `resposta-previa.tsx` (os dois botões). A seleção da aba fica na URL (`?resultado=`). A casca passa a recolher o menu também em `/assistente` (`menu-tela.ts`). A caixa Assistente **dentro do Atendimento** (`conversa-assistente.tsx`, Parte E) não muda.

**Tecnologias:** Next.js 15 (App Router, server components, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (RLS), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção **7C.3** (Assistente, Opção B: menu recolhido; chat ~470px com histórico em botões; respostas curtas com VER AO LADO; abas; painel do pedido; selo; SIM, GRAVAR / MUDAR OUTRA COISA "só escrevem a resposta pela pessoa (a regra de gravar continua a mesma — grava exatamente a prévia mostrada)"; "Regras do assistente **não mudam**. Antes de mostrar 'origem do pedido' e o histórico, confirmar no código que esses dados estão gravados; se não estiverem, ficam fora desta parte") e **7C.6** (Playwright com VER AO LADO; capturas 1366/1920, claro e escuro);
- **3.1** (termos: Demanda, Pedido de nota, CSV do Bling; "toda IA nova grava custo": aqui **não há IA nova**; migração incremental com pgTAP e `--dry-run`: aqui **não há migração**; nada é juntado), **4.3** (casca e menu recolhido), **4.6** (tom), **7** (Parte D: níveis "Pedidos de nota" e "Assistente"; P11 "Sem acesso"), **7A** (Parte E: menu recolhido no Atendimento, regra "aberto nesta tela"), **7B** (Parte F: custo do assistente por pessoa, intacto), **8** (vermelho nunca sozinho; grep antes de trocar rótulos).
- Imagem: `imagens/00-assistente-opcao-b.png` (**a implementar**); `00-assistente-opcao-a.png` só como referência, **não implementar**. HTML de origem: `fragmentos/00-assistente-opcao-b.html`. Dados nas imagens são de exemplo. Onde a imagem e o spec divergem, vale o spec. A etiqueta "Opção B — Conversa + resultado" do canto da imagem é legenda da maquete.

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt G" (linhas 184–201) — ordem Configurações → Início → Contatos → **Assistente** → Treinar o agente; **este plano cobre só o Assistente (G4)**. Ponto que não pode falhar: "**Assistente e Treinar o agente: as regras de gravação e simulação continuam exatamente as de hoje (prévia com chave; simulação nunca envia nem grava).**" Ao terminar: suítes com resultado real, capturas comparadas com a imagem, e **parar**. Estilo e convenções: `docs/superpowers/plans/2026-10-09-painel-v2-parte-g3-contatos.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-g`, branch `painel-v2-parte-g`, a partir de `5c13c32` (G3 Contatos pronta, com as sobras) ou do commit mais novo da branch. Todos os comandos rodam a partir da raiz da worktree. Antes da Task 1, confira `git diff etapa-1 -- docs/superpowers/specs/painel-v2`: se não sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso.

## Decisões tomadas (sem o dono)

O dono está fora e autorizou decidir. Conferi no código o que o spec supõe:

- **Como o assistente responde hoje.** O painel grava a pergunta em `assistente_mensagens` (`perguntarAoAssistente`, `assistente/acoes.ts`: `papel = 'usuario'`, `canal = 'site'`, `conversa_id` da caixa ou nulo) e enfileira o trabalho. O trabalhador (`apps/trabalhador/src/assistente/processar.ts`) responde com **um texto** (`conteudo`) e, se gerou o CSV, um `arquivo` jsonb `{tipo:'csv_bling', chamados:[ids], nome, partes}`. A tela lê só as mensagens da própria pessoa (RLS `usuario_id = auth.uid()`) e recarrega pelo Realtime (`AtualizarAoVivo assistenteDe`). A prévia é texto: `descreverPedido` (`assistente/pedido.ts`) e o fechamento do `executar.ts` garantem que toda resposta com prévia traz "Prévia do pedido #N:\nAntes:\n…\nDepois:\n…" (o "depois" é exatamente o que o "sim" grava). O painel já interpreta esse texto (`lib/previa-pedido.ts`: `interpretarPrevias`, `compararPrevia`) e o mostra no `DiffPreview`.
- **Como o "sim" grava.** `alterar_pedido_venda` com `confirmado = true` só grava a **última prévia daquele pedido mostrada à pessoa antes da pergunta mais nova**, conferindo a chave (`conferencia`, sha1 do pedido de antes + novo) e o contexto (`decisoes_agente`, etapa `assistente:alterar_pedido_venda`). Ao gravar: `atualizarPedidoVenda`, **nota interna na demanda** (`chamado_eventos`, `tipo = 'nota_interna'`, `usuario_id` = a pessoa, texto "Pedido alterado pelo assistente a pedido de <nome>.\nAntes:\n…\nDepois:\n…") e auditoria (`auditoria_acessos`). O CSV (`gerar_csv_bling`) recusa enquanto houver prévia não gravada no mesmo trabalho.
- **O que está gravado e é legível pela pessoa.** `demandas_lista` (Parte C, `security_invoker`, já aplicada na homologação) tem `numero, setor, empresa, status, origem ('agente'|'equipe'), contato, criado_em, criado_por_nome, tem_pedido`. `chamado_eventos` tem `criacao` (gatilho da Parte C, com `criado_por`), `nota_interna` com `usuario_id` e a hora, e os demais eventos; RLS pela demanda e, no painel, `ocultarEventosDoPedido` para "Pedidos de nota: Sem acesso" (P11). **Não** são legíveis pela pessoa: `decisoes_agente` do assistente (`conversa_id` nulo → `pode_ver_conversa`) e `auditoria_acessos`.
- **Permissões.** Tela: `usaAssistente(u)` (nível Assistente ≥ Site). Links do CSV: `temNivel(u, 'notas', 'corrigir')` na tela e de novo na rota `/api/csv-bling`. Demandas e eventos: RLS.
- **Testes que dependem da tela de hoje** (não podem ser editados): `e2e/assistente.spec.ts` (placeholder "Pergunte ao assistente", botão "Enviar", "Pensando…", links "Baixar CSV Bling (parte 1|2)" com `href=/api/csv-bling?assistente=<id>&parte=N`, a caixa no Atendimento), `e2e/revisao-final.spec.ts` (sem "Corrigir e gerar" nenhum link `/CSV Bling/`; `getByTestId('mensagens-assistente')` rola até o fim), `e2e/acessibilidade.spec.ts` (audita `/assistente`), `src/components/layout/menu-tela.test.ts`.

Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Custo da alternativa | Task |
|---|---|---|---|---|
| D1 | **Nenhuma migração e nenhuma mudança no trabalhador.** A tela monta tudo do que já está gravado: o texto e o `arquivo` de `assistente_mensagens`, `demandas_lista` e `chamado_eventos`. | O trabalhador gravar a prévia estruturada (jsonb) na mensagem. | Migração nova pendente na homologação, trabalhador "pronto para trocar", cenários com Claude de verdade e mudança no que grava o "sim". | todas |
| D2 | **O painel do pedido mostra a prévia exatamente como veio na resposta** (o mesmo texto que a pessoa aprova com "sim"), nunca o pedido atual do banco. Os dados da demanda (setor, empresa, origem, histórico) vêm do banco; os do pedido (destinatário, pagamento, entrega, itens, total), da prévia. | Ler `chamados.pedido_venda` agora. | Poderia mostrar algo diferente do que o "sim" grava (regra 7C.3). | 2, 6 |
| D3 | **"Pedido veio de" entra:** está gravado (`origem`, `contato_id`, `criado_em`, `criado_por` em `demandas_lista`). `agente` → "<contato>" e "WhatsApp · dd/mm" ("Contato sem cadastro" sem contato); `equipe` → "<quem abriu>" e "Painel · dd/mm". | Deixar de fora. | Contra a imagem, sem motivo (o dado existe). | 2, 6 |
| D4 | **Histórico do pedido entra, só com o que está gravado e a pessoa pode ler:** os eventos da demanda (`chamado_eventos`, RLS + P11) e os momentos da própria conversa (prévia mostrada; CSV do Bling gerado com este pedido). A abertura vira "Agente abriu o pedido pelo WhatsApp de <contato>" (ou "<pessoa> abriu a demanda no painel"); a nota da gravação vira "<pessoa> gravou a correção pelo assistente"; outras notas mostram a primeira linha. O "Ana respondeu 'sim'" da imagem é a própria gravação (nota interna); a pergunta "sim" não é ligada ao pedido. Não usa `decisoes_agente` nem `auditoria_acessos`. | Uma função nova que leia decisões e auditoria. | Migração e expor registros que hoje só o administrador ou a conversa leem. | 2, 6 |
| D5 | **Selo "Gravado às HH:MM por <pessoa>"** = existe nota interna "Pedido alterado pelo assistente a pedido de …" **da própria pessoa**, **depois da hora da prévia** mostrada no painel. Sem ela, sem selo (a tela nunca afirma "nada gravado"). | Ler o "Feito:" do texto do modelo. | Depende de como o modelo escreve. | 2, 6 |
| D6 | **SIM, GRAVAR envia exatamente "sim"** pela mesma ação do campo (`perguntarAoAssistente`, com a mesma trava de envio duplo); **MUDAR OUTRA COISA só põe "Antes de gravar, mude também: " no campo** e põe o foco nele, sem enviar. Nada mais muda: quem grava continua sendo o trabalhador, pela regra de hoje. | MUDAR OUTRA COISA enviar uma frase pronta. | Mensagem incompleta ao modelo. | 7 |
| D7 | **Os botões só aparecem** quando a prévia está na **última mensagem** da conversa (nenhuma pergunta depois, nem pendente), é a **única prévia** dessa mensagem, tem **número** e ainda **não tem selo**. | Botões embaixo de toda prévia. | Um "sim" numa prévia antiga faria o trabalhador gravar a **última** prévia daquele pedido, não a que está em cima do botão. Com duas prévias, "sim" é ambíguo. | 1, 7 |
| D8 | **"Respostas curtas" pela tela, não pelo prompt:** prévias, tabelas e arquivo saem do balão e viram cartões VER AO LADO; o texto em volta fica. O prompt já pede "direto e curto" e não muda. | Mudar o prompt para encurtar. | Muda o que o modelo vê: cenários com Claude de verdade, trabalhador para trocar. | 1, 5 |
| D9 | **Abas:** uma por pedido (a prévia **mais nova** de cada número), uma por tabela (título = a linha "…:" ou "# …" logo antes dela, senão "Tabela das HH:MM"; com a contagem de linhas) e **Arquivos (n)** no fim. Até **5** abas de pedido/tabela, as mais recentes; a escolhida sempre aparece. **Aberta por padrão:** o pedido ou a tabela mais recente (o arquivo aparece dentro do pedido; a aba Arquivos só abre sozinha se não houver outra). A escolha fica na URL (`?resultado=`). | Guardar a aba no navegador. | Perderia a aba a cada recarga do Realtime. | 1, 5 |
| D10 | **Toda tabela vai ao lado**, mesmo pequena. | Limite de linhas. | Regra difícil de explicar; respostas parecidas com caras diferentes. | 1 |
| D11 | **"Juntar com os abertos" fica de fora** (não está no spec; seria outro pedido ao assistente). O cartão do arquivo diz "N pedidos · gerado HH:MM" (os **itens** da imagem pediriam ler `pedido_venda`). | Botão que escreve "gere o CSV com todos os pedidos abertos" no campo. | Ação nova sem pedido do dono. | 6 |
| D12 | **Links do CSV:** na conversa ficam os nomes de hoje ("Baixar CSV Bling", "Baixar CSV Bling (parte N)"); no painel, "Baixar CSV Bling" (uma parte) ou "Baixar CSV Bling · parte i de n". Tudo só com "Pedidos de nota: Corrigir e gerar" (como hoje); sem ela não há cartão de arquivo nem aba Arquivos. | Os mesmos nomes nos dois lugares. | O e2e de hoje (`assistente.spec.ts`, "(parte 1)") acharia dois links e falharia. | 1, 5, 6 |
| D13 | **Menu recolhido no Assistente com a regra do Atendimento:** abrir o menu vale só até sair da tela; ir do Atendimento para o Assistente (ou o contrário) também esquece. | Seguir a preferência guardada. | Contra o spec (7C.3). | 4 |
| D14 | **Histórico em botões:** Geral + as **2** conversas mais recentes (a aberta sempre visível) + "+n" com as demais (até 30, como hoje), cada uma com o nome do contato e a empresa no `title`. A trilha da casca continua "Assistente"; o título diz "Assistente · Geral" ou "Assistente · <contato>". | Manter a coluna de histórico. | Contra a imagem; a conversa não caberia em ~470px. | 5 |
| D15 | **Sugestões sempre visíveis acima do campo** (imagem), com os **textos de hoje** (Geral e conversa) e o mesmo comportamento: põem o texto no campo, não enviam. | Os textos da imagem. | "Demandas aguardando o cliente" é menos claro; sem ganho. | 5 |
| D16 | **A caixa Assistente dentro do Atendimento não muda** (Parte E, `ConversaAssistente compacta`): continua com a prévia no balão. | Cartões também lá. | Não há painel ao lado em 360px; o "ver ao lado" levaria para outra tela. | — |
| D17 | **Demanda que a pessoa não vê** (ou leitura que falhou): o painel mostra a prévia (é da conversa dela) com o aviso, sem setor, empresa, origem, histórico, arquivo e Abrir demanda. "Pedidos de nota: Sem acesso": eventos com `ocultarEventosDoPedido` (P11), a regra de Demandas. | Esconder a prévia. | A pessoa perderia o que ela mesma recebeu. | 3, 6 |
| D18 | **Homologação com migrações pendentes (regra D21 da G2):** nada pendente desta parte. A tela lê só objetos das Partes C–E, já aplicados (`demandas_lista`, `chamado_eventos`, `assistente_mensagens`, `conversas`). Com F, G1, G2 e G3 pendentes, o Assistente abre inteiro. Nenhuma leitura mistura objeto novo com dado essencial. | — | — | 3 |
| D19 | **Prévia sem número no cabeçalho** (o modelo escreveu de outro jeito): aba "Prévia de pedido", sem dados da demanda e sem botões. | Procurar o número no texto inteiro. | Poderia pegar o número de outra demanda citada. | 1 |
| D20 | **Cenários com Claude de verdade (`cenarios-assistente`) não rodam nesta parte:** nada do que o modelo vê muda (prompt, ferramentas, histórico, ordem das mensagens); o "sim" do botão é o mesmo texto que a pessoa digitaria. Na Entrega, `git diff 5c13c32 --stat -- apps/trabalhador packages supabase` sai **vazio** (prova). | Rodar mesmo assim. | Gasto de API sem nada novo para medir. | Entrega |
| D21 | **Erro ao enviar com uma conversa aberta** continua como hoje: `perguntarAoAssistente` devolve o aviso em `/atendimento/<id>?erro=` (a ação não muda; a tela recebe a resposta pelo Realtime). Fica como pendência. | Mudar o destino da ação. | Mexe numa ação usada pela caixa do Atendimento. | — |

## Restrições globais

- **Só mexer em:** `apps/painel` (tela, lib, componentes, casca, e2e) e `docs/design-system.md`, `docs/operacao.md`. **Nada em `supabase/`, `packages/`, `apps/trabalhador`** (D1, D20). Nenhum prompt, ferramenta, fila ou regra de gravação do assistente muda.
- **Nunca editar teste de parte anterior:** nenhum pgTAP (`supabase/tests/**`), nenhum `*.test.ts` existente (inclusive `menu-tela.test.ts`, `escala.test.ts`) e nenhum e2e existente além de **acrescentar** testes novos em `e2e/acessibilidade.spec.ts` (Task 8). `e2e/assistente.spec.ts` e `e2e/revisao-final.spec.ts` **continuam passando sem edição** (D12).
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` continua 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio (ele também fixa a lista do `supabase_realtime`: nada é publicado). Nunca use `usuario_liberado` (é só do `service_role`).
- **Mesmas permissões de hoje:** abrir a tela = nível Assistente ≥ Site (`usaAssistente`); links e cartões do CSV = "Pedidos de nota: Corrigir e gerar" (`temNivel(u, 'notas', 'corrigir')`, e a rota confere de novo); demanda e eventos pela RLS; "Sem acesso" a pedidos esconde os textos dos eventos (P11). Nenhuma ação nova no servidor: os botões usam `perguntarAoAssistente` **sem mudança**.
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`).
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os e2e deixam no banco quebram os pgTAP antigos.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts`.
- **E2e só contra o banco local:** `apps/painel/e2e/trava-local.ts` recusa outro banco. **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`** (só leitura, na Entrega, para o `--dry-run` e o painel do dono).
- **Esperar a hidratação nos e2e:** todo e2e novo abre a tela por `abrirAssistente(page, consulta)` (`e2e/apoio-assistente.ts`, Task 5), que espera o `data-assistente-hidratado` (um `useEffect` marca quando o navegador assumiu, como o `abrirContatos` da G3). Clicar antes disso perde a ação. Localize o painel por `page.getByRole('region', { name: 'Resultado' })` e a conversa por `page.getByTestId('mensagens-assistente')`: o mesmo link do CSV existe nos dois lugares (D12).
- **Nenhum trabalhador é ligado nem desligado nesta parte** (G4 não muda o trabalhador). O da porta **3001 é o teste do dono: não desligue nem mate esse processo.** Os e2e não precisam de trabalhador (as respostas do assistente são semeadas pela chave de serviço do banco local).
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "Pergunte ao assistente" (placeholder), "Pergunta ao assistente" (rótulo), "Enviar", "Enter envia · Shift+Enter quebra a linha", "Pensando…", `data-testid="mensagens-assistente"`, `data-compositor-assistente`, "Sugestões de perguntas", "Conversa não encontrada", "Voltar para a Geral", "Abrir no Atendimento", "Baixar CSV Bling", "Baixar CSV Bling (parte N)".
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[470px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind (a largura da conversa vira token, Task 4). `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando. Todo `size={N}` de ícone usado tem regra em `globals.css` (`escala.test.ts`): use só 14, 16 e 20.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`; os botões `primary/outline/grafite` já são). Vermelho nunca sozinho (ícone + texto; removido = riscado + "Removido" para leitor de tela).
- **Termos (spec 3.1):** Demanda, Pedido de nota, CSV do Bling, Conversa, Atendimento, Empresa, Contato. "Pessoa" para usuário da equipe.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Botão gravando por conta própria:** SIM, GRAVAR grava só a pergunta "sim" da pessoa; `chamados.pedido_venda`, `chamado_eventos` e `decisoes_agente` ficam iguais. MUDAR OUTRA COISA não grava nada. Task 7 (e2e).
2. **"Sim" na prévia errada:** os botões não aparecem em prévia que não é a última mensagem, em mensagem com duas prévias, em prévia sem número nem em prévia já gravada (D7). Tasks 1 (unidade) e 7 (e2e).
3. **Painel mostrando outra coisa que o "sim" grava:** o "O que mudou" e o total saem do texto da prévia, não do banco (D2). Teste: a prévia diz 15 PAC e o banco 10 PAC; o painel mostra 15 PAC com "antes: 10 PAC". Tasks 2 e 6.
4. **Selo falso:** nota de outra pessoa, nota antes da prévia ou nota com outro texto não viram selo (D5). Tasks 2 (unidade) e 6 (e2e).
5. **Vazamento:** demanda fora dos setores da pessoa não mostra setor, empresa, origem, histórico nem Abrir demanda; sem "Corrigir e gerar" não há link `/CSV Bling/` em lugar nenhum da tela nem aba Arquivos; "Sem acesso" a pedidos esconde os textos das notas no histórico. Tasks 3, 5 e 6.
6. **Regras do assistente intactas:** `git diff 5c13c32 --stat -- apps/trabalhador packages supabase` vazio na Entrega; `e2e/assistente.spec.ts` e `e2e/revisao-final.spec.ts` passam sem edição; a caixa do Atendimento não muda. Entrega.
7. **Menu recolhido:** abre recolhido no Assistente; abrir vale só nesta tela. Task 4.

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `apps/painel/src/lib/resultados-assistente.ts` (+ `.test.ts`) (novos), `apps/painel/src/lib/texto-assistente.ts` (exporta as duas expressões da tabela) | resposta → texto curto + cartões; abas; aba aberta; quando os botões aparecem; `?resultado=` | 1 |
| `apps/painel/src/lib/pedido-assistente.ts` (+ `.test.ts`) (novos) | painel do pedido a partir da prévia; origem; selo; histórico | 2 |
| `assistente/dados-assistente.ts` (+ `.test.ts`) (novos) | leitores: mensagens, histórico de conversas, demanda do pedido com eventos (D17, D18) | 3 |
| `src/components/layout/menu-tela.ts`, `app-shell.tsx`, `menu-tela-assistente.test.ts` (novo); `src/styles/tokens.css`, `src/app/globals.css`, `src/styles/largura-assistente.test.ts` (novo) | menu recolhido no Assistente; largura da conversa | 4 |
| `assistente/page.tsx` (reescrito), `assistente/{conversa-com-resultado.tsx,chat-assistente.tsx,cartao-resultado.tsx,historico-em-botoes.tsx,hidratado.tsx,painel-resultado.tsx,painel-tabela.tsx,painel-arquivos.tsx,links-csv.tsx}` (novos), `assistente/compositor-assistente.tsx`, `src/components/patterns/texto-formatado.tsx`, `e2e/apoio-assistente.ts`, `e2e/assistente-lado.spec.ts` (novos) | conversa enxuta, histórico em botões, VER AO LADO, abas, tabela e arquivos | 5 |
| `assistente/{painel-pedido.tsx,historico-pedido.tsx}` (novos), `assistente/painel-resultado.tsx`, `e2e/assistente-pedido.spec.ts` (novo) | painel do pedido, selo, arquivo do pedido, histórico, Abrir demanda | 6 |
| `assistente/resposta-previa.tsx` (novo), `assistente/painel-pedido.tsx`, `e2e/assistente-responder.spec.ts` (novo) | SIM, GRAVAR / MUDAR OUTRA COISA | 7 |
| `e2e/acessibilidade.spec.ts` (só acréscimos), `app/(painel)/_design/page.tsx` (se tiver seção de padrões), `docs/design-system.md`, `docs/operacao.md` | acessibilidade e manuais | 8 |

Todos os caminhos `assistente/…` abaixo são `apps/painel/src/app/(painel)/assistente/…`. `conversa-assistente.tsx` e `acoes.ts` **não mudam**.

---

### Task 1: Regras puras. Resposta em texto curto + cartões, abas e botões

**Files:**
- Create: `apps/painel/src/lib/resultados-assistente.ts`, `apps/painel/src/lib/resultados-assistente.test.ts`
- Modify: `apps/painel/src/lib/texto-assistente.ts` (só `export` em `LINHA_TABELA` e `SEPARADOR_TABELA`)

**Interfaces:**
- Consumes: `interpretarPrevias`, `compararPrevia`, `PreviaInterpretada` (`lib/previa-pedido.ts`); `blocosDoTexto`, `LINHA_TABELA`, `SEPARADOR_TABELA` (`lib/texto-assistente.ts`); `formatarHora` (`lib/formatos.ts`).
- Produces: tipos `MensagemTela`, `ArquivoBling`, `Cartao`, `Pedaco`, `ResultadoPedido`, `ResultadoTabela`, `ResultadoArquivos`, `ArquivoGerado`, `Resultado`, `LeituraConversa`; funções `numeroDoCabecalho`, `lerArquivo`, `contarMudancas`, `lerConversa`, `lerChaveResultado`, `escolherResultado`, `abasVisiveis`, `podeResponderPrevia`, `hrefResultado`, `arquivoDoPedido`; constante `MAX_ABAS = 5`.

- [ ] **Passo 1: escrever o teste que falha**

`apps/painel/src/lib/resultados-assistente.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  abasVisiveis, arquivoDoPedido, escolherResultado, hrefResultado, lerArquivo, lerChaveResultado, lerConversa, numeroDoCabecalho,
  podeResponderPrevia, type MensagemTela, type ResultadoPedido,
} from './resultados-assistente';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const msg = (n: number, papel: 'usuario' | 'assistente', conteudo: string, extra: Partial<MensagemTela> = {}): MensagemTela => ({
  id: ID(n), papel, conteudo, arquivo: null, processada_em: '2026-10-10T18:00:00Z',
  criado_em: `2026-10-10T18:${String(n).padStart(2, '0')}:00Z`, ...extra,
});
const corpo = (q: number, sub: string, total: string) => [
  'Destinatário: Rede Bom Preço / Unidade Centro',
  `• ${q} PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = ${sub}`,
  '• 6 UN Bolo de fubá 400g (cód. 31) × R$ 14,00 = R$ 84,00',
  `Total: ${total}`,
  'Pagamento: Boleto 28 dias · Entrega: 03/10',
].join('\n');
const PREVIA = (numero: number, rodape = 'Responda sim para gravar.') =>
  `Prévia do pedido #${numero}:\nAntes:\n${corpo(10, 'R$ 185,00', 'R$ 269,00')}\nDepois:\n${corpo(15, 'R$ 277,50', 'R$ 361,50')}\n\n${rodape}`;
const TABELA = 'São **4 pedidos** em aberto.\n\nPedidos em aberto:\n| Nº | Total |\n|---|---|\n| #1 | R$ 1,00 |\n| #2 | R$ 2,00 |\n| #3 | R$ 3,00 |\n| #4 | R$ 4,00 |\n\nQuer o CSV?';
const CSV = (chamados: string[], partes = 1) => ({ tipo: 'csv_bling', chamados, nome: 'bling-pedidos.csv', partes });

describe('numeroDoCabecalho', () => {
  it('o último "#N" do cabeçalho da prévia; sem número, null (D19)', () => {
    expect(numeroDoCabecalho('Prévia do pedido #536:')).toBe(536);
    expect(numeroDoCabecalho('Corrigi o #12. Prévia do #536:')).toBe(536);
    expect(numeroDoCabecalho('Prévia do pedido:')).toBeNull();
  });
});

describe('lerArquivo', () => {
  it('só o CSV do Bling com nome e demandas; partes no mínimo 1', () => {
    expect(lerArquivo(CSV(['a'], 2))).toEqual({ nome: 'bling-pedidos.csv', partes: 2, chamados: ['a'] });
    expect(lerArquivo({ tipo: 'csv_bling', chamados: ['a'], nome: 'x.csv' })).toEqual({ nome: 'x.csv', partes: 1, chamados: ['a'] });
    expect(lerArquivo({ tipo: 'outro', chamados: [], nome: 'x' })).toBeNull();
    expect(lerArquivo(null)).toBeNull();
  });
});

describe('lerConversa: resposta curta + cartões (D8)', () => {
  it('a tabela sai do balão: texto antes, cartão, texto depois; o título vem da linha "…:" (D9)', () => {
    const l = lerConversa([msg(1, 'usuario', 'quais?'), msg(2, 'assistente', TABELA)], true);
    expect(l.respostas.get(ID(2))).toEqual([
      { tipo: 'texto', texto: 'São **4 pedidos** em aberto.\n\nPedidos em aberto:' },
      { tipo: 'cartao', cartao: { tipo: 'tabela', chave: `tabela-${ID(2)}-0`, rotulo: 'Tabela · 4 linhas' } },
      { tipo: 'texto', texto: 'Quer o CSV?' },
    ]);
    expect(l.resultados).toEqual([expect.objectContaining({
      tipo: 'tabela', chave: `tabela-${ID(2)}-0`, titulo: 'Pedidos em aberto', rotulo: 'Pedidos em aberto (4)', mensagemId: ID(2),
      tabela: { cabecalho: ['Nº', 'Total'], linhas: [['#1', 'R$ 1,00'], ['#2', 'R$ 2,00'], ['#3', 'R$ 3,00'], ['#4', 'R$ 4,00']] },
    })]);
  });

  it('tabela sem título antes: "Tabela das HH:MM" (Brasília)', () => {
    const l = lerConversa([msg(2, 'assistente', '| a | b |\n|---|---|\n| 1 | 2 |')], true);
    expect(l.resultados[0]).toMatchObject({ titulo: 'Tabela das 15:02', rotulo: 'Tabela das 15:02 (1)' });
    expect(l.respostas.get(ID(2))).toEqual([{ tipo: 'cartao', cartao: { tipo: 'tabela', chave: `tabela-${ID(2)}-0`, rotulo: 'Tabela · 1 linha' } }]);
  });

  it('a prévia sai do balão: cabeçalho, cartão "Prévia #N · 1 alteração" (o total não conta) e rodapé', () => {
    const l = lerConversa([msg(3, 'assistente', PREVIA(536))], true);
    expect(l.respostas.get(ID(3))).toEqual([
      { tipo: 'texto', texto: 'Prévia do pedido #536:' },
      { tipo: 'cartao', cartao: { tipo: 'pedido', chave: 'pedido-536', rotulo: 'Prévia #536 · 1 alteração' } },
      { tipo: 'texto', texto: 'Responda sim para gravar.' },
    ]);
    expect(l.resultados[0]).toMatchObject({ tipo: 'pedido', chave: 'pedido-536', numero: 536, rotulo: 'Pedido #536', mensagemId: ID(3), previasNaMensagem: 1 });
  });

  it('o mesmo pedido em duas respostas: uma aba só, com a prévia mais nova (D9)', () => {
    const l = lerConversa([msg(3, 'assistente', PREVIA(536)), msg(5, 'assistente', PREVIA(536, 'Outra?'))], true);
    expect(l.resultados).toHaveLength(1);
    expect(l.resultados[0]).toMatchObject({ chave: 'pedido-536', mensagemId: ID(5) });
  });

  it('prévia sem número: chave pela mensagem, aba "Prévia de pedido" (D19)', () => {
    const l = lerConversa([msg(3, 'assistente', PREVIA(536).replace('#536', ''))], true);
    expect(l.resultados[0]).toMatchObject({ chave: `previa-${ID(3)}-0`, numero: null, rotulo: 'Prévia de pedido' });
  });

  it('duas prévias na mesma resposta: dois cartões e previasNaMensagem = 2', () => {
    const l = lerConversa([msg(3, 'assistente', `${PREVIA(536, '')}\n\n${PREVIA(537)}`)], true);
    expect(l.resultados.map((r) => r.chave).sort()).toEqual(['pedido-536', 'pedido-537']);
    expect((l.resultados[0] as ResultadoPedido).previasNaMensagem).toBe(2);
  });

  it('arquivo: cartão no fim da resposta e aba "Arquivos" por último; sem "Corrigir e gerar", nada (D12)', () => {
    const msgs = [msg(2, 'assistente', TABELA), msg(4, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })];
    const com = lerConversa(msgs, true);
    expect(com.respostas.get(ID(4))?.at(-1)).toEqual({ tipo: 'cartao', cartao: {
      tipo: 'arquivo', chave: 'arquivos', rotulo: 'bling-pedidos.csv', mensagemId: ID(4), arquivo: { nome: 'bling-pedidos.csv', partes: 1, chamados: ['d1'] },
    } });
    expect(com.resultados.map((r) => r.chave)).toEqual([`tabela-${ID(2)}-0`, 'arquivos']);
    const sem = lerConversa(msgs, false);
    expect(sem.respostas.get(ID(4))).toEqual([{ tipo: 'texto', texto: 'Feito.' }]);
    expect(sem.resultados.map((r) => r.chave)).toEqual([`tabela-${ID(2)}-0`]);
  });

  it('aba aberta por padrão: o pedido ou a tabela mais recente; só Arquivos quando não há outra (D9)', () => {
    expect(lerConversa([msg(2, 'assistente', TABELA), msg(3, 'assistente', PREVIA(536)), msg(4, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })], true).padrao)
      .toBe('pedido-536');
    expect(lerConversa([msg(4, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })], true).padrao).toBe('arquivos');
    expect(lerConversa([msg(4, 'assistente', 'Oi.')], true).padrao).toBeNull();
  });

  it('pergunta da pessoa não vira resposta', () => {
    expect(lerConversa([msg(1, 'usuario', TABELA)], true).respostas.size).toBe(0);
  });
});

describe('?resultado= e escolha da aba', () => {
  it('só chaves conhecidas', () => {
    expect(lerChaveResultado('pedido-536')).toBe('pedido-536');
    expect(lerChaveResultado(`tabela-${ID(2)}-0`)).toBe(`tabela-${ID(2)}-0`);
    expect(lerChaveResultado(['arquivos', 'x'])).toBe('arquivos');
    expect(lerChaveResultado('pedido-abc')).toBeNull();
    expect(lerChaveResultado(undefined)).toBeNull();
  });

  it('chave que não existe nesta conversa: volta para a padrão', () => {
    const l = lerConversa([msg(2, 'assistente', TABELA), msg(3, 'assistente', PREVIA(536))], true);
    expect(escolherResultado(l, `tabela-${ID(2)}-0`)?.chave).toBe(`tabela-${ID(2)}-0`);
    expect(escolherResultado(l, 'pedido-999')?.chave).toBe('pedido-536');
    expect(escolherResultado(lerConversa([], true), null)).toBeNull();
  });

  it('href mantém a conversa aberta', () => {
    expect(hrefResultado(null, 'pedido-536')).toBe('/assistente?resultado=pedido-536');
    expect(hrefResultado(ID(9), 'arquivos')).toBe(`/assistente?conversa=${ID(9)}&resultado=arquivos`);
  });

  it('até 5 abas de pedido/tabela, as mais recentes; a escolhida sempre aparece; Arquivos no fim (D9)', () => {
    const tabelas = Array.from({ length: 7 }, (_, i) => msg(i + 1, 'assistente', `| a |\n|---|\n| ${i} |`));
    const l = lerConversa([...tabelas, msg(9, 'assistente', 'Feito.', { arquivo: CSV(['d1']) })], true);
    expect(abasVisiveis(l, `tabela-${ID(7)}-0`).map((r) => r.chave)).toEqual([
      `tabela-${ID(7)}-0`, `tabela-${ID(6)}-0`, `tabela-${ID(5)}-0`, `tabela-${ID(4)}-0`, `tabela-${ID(3)}-0`, 'arquivos',
    ]);
    expect(abasVisiveis(l, `tabela-${ID(1)}-0`).map((r) => r.chave)).toEqual([
      `tabela-${ID(7)}-0`, `tabela-${ID(6)}-0`, `tabela-${ID(5)}-0`, `tabela-${ID(4)}-0`, `tabela-${ID(3)}-0`, `tabela-${ID(1)}-0`, 'arquivos',
    ]);
  });

  it('arquivo mais recente que leva a demanda', () => {
    const l = lerConversa([msg(2, 'assistente', 'a', { arquivo: CSV(['d1']) }), msg(4, 'assistente', 'b', { arquivo: CSV(['d1', 'd2']) })], true);
    expect(arquivoDoPedido(l, 'd1')?.mensagemId).toBe(ID(4));
    expect(arquivoDoPedido(l, 'd9')).toBeNull();
  });
});

describe('podeResponderPrevia (D7)', () => {
  const pedido = (l: ReturnType<typeof lerConversa>) => l.resultados.find((r): r is ResultadoPedido => r.tipo === 'pedido')!;
  it('prévia única, com número, na última mensagem: sim', () => {
    const m = [msg(1, 'usuario', 'corrige'), msg(2, 'assistente', PREVIA(536))];
    expect(podeResponderPrevia(m, pedido(lerConversa(m, true)))).toBe(true);
  });
  it('com pergunta depois (respondida ou pendente): não', () => {
    const m = [msg(2, 'assistente', PREVIA(536)), msg(3, 'usuario', 'sim', { processada_em: null })];
    expect(podeResponderPrevia(m, pedido(lerConversa(m, true)))).toBe(false);
  });
  it('prévia de uma resposta antiga: não', () => {
    const m = [msg(2, 'assistente', PREVIA(536)), msg(3, 'usuario', 'e o 537?'), msg(4, 'assistente', 'Não achei.')];
    expect(podeResponderPrevia(m, pedido(lerConversa(m, true)))).toBe(false);
  });
  it('duas prévias na mesma resposta ou sem número: não', () => {
    const duas = [msg(2, 'assistente', `${PREVIA(536, '')}\n\n${PREVIA(537)}`)];
    expect(podeResponderPrevia(duas, pedido(lerConversa(duas, true)))).toBe(false);
    const sem = [msg(2, 'assistente', PREVIA(536).replace('#536', ''))];
    expect(podeResponderPrevia(sem, pedido(lerConversa(sem, true)))).toBe(false);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `export PATH="$HOME/bin:$PATH" && pnpm --filter @escritorio/painel exec vitest run src/lib/resultados-assistente.test.ts`
Expected: FAIL (`Cannot find module './resultados-assistente'`).

- [ ] **Passo 3: exportar as expressões da tabela**

Em `apps/painel/src/lib/texto-assistente.ts`, troque `const LINHA_TABELA =` por `export const LINHA_TABELA =` e `const SEPARADOR_TABELA =` por `export const SEPARADOR_TABELA =` (a tela usa a mesma regra para achar a tabela; nada mais muda).

- [ ] **Passo 4: implementar `lib/resultados-assistente.ts`**

```ts
/**
 * Tela do Assistente (Parte G4, spec 7C.3): cada resposta vira texto curto + cartões VER AO LADO, e o conteúdo grande
 * (prévia de pedido, tabela, arquivo do Bling) vira um resultado no painel da direita, com abas. Só lê o que já está na
 * mensagem (texto e `arquivo`); nada aqui muda o que o assistente grava.
 */
import { formatarHora } from './formatos';
import { compararPrevia, interpretarPrevias, type PreviaInterpretada } from './previa-pedido';
import { blocosDoTexto, LINHA_TABELA, SEPARADOR_TABELA } from './texto-assistente';

/** Mensagem da conversa com o assistente como a tela lê (assistente_mensagens; o RLS só entrega as da própria pessoa). */
export type MensagemTela = { id: string; papel: 'usuario' | 'assistente'; conteudo: string; arquivo: unknown; processada_em: string | null; criado_em: string };

export type ArquivoBling = { nome: string; partes: number; chamados: string[] };
export type TabelaResposta = { cabecalho: string[]; linhas: string[][] };

export type Cartao =
  | { tipo: 'pedido'; chave: string; rotulo: string }
  | { tipo: 'tabela'; chave: string; rotulo: string }
  | { tipo: 'arquivo'; chave: 'arquivos'; rotulo: string; mensagemId: string; arquivo: ArquivoBling };

/** Pedaço da resposta mostrada no balão, na ordem do texto. */
export type Pedaco = { tipo: 'texto'; texto: string } | { tipo: 'cartao'; cartao: Cartao };

export type ResultadoPedido = {
  tipo: 'pedido'; chave: string; numero: number | null; previa: PreviaInterpretada; mensagemId: string; em: string; rotulo: string;
  /** Quantas prévias a mesma resposta trouxe: com mais de uma, "sim" é ambíguo (D7). */
  previasNaMensagem: number;
};
export type ResultadoTabela = { tipo: 'tabela'; chave: string; titulo: string; tabela: TabelaResposta; mensagemId: string; em: string; rotulo: string };
export type ArquivoGerado = { mensagemId: string; em: string; arquivo: ArquivoBling };
export type ResultadoArquivos = { tipo: 'arquivos'; chave: 'arquivos'; arquivos: ArquivoGerado[]; em: string; rotulo: string };
export type Resultado = ResultadoPedido | ResultadoTabela | ResultadoArquivos;

export type LeituraConversa = {
  /** Pedaços de cada resposta do assistente, por id da mensagem. */
  respostas: Map<string, Pedaco[]>;
  /** Pedidos e tabelas do mais novo para o mais antigo; Arquivos (se houver) no fim. */
  resultados: Resultado[];
  padrao: string | null;
};

export const MAX_ABAS = 5;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHAVE = new RegExp(`^(?:pedido-\\d{1,9}|(?:previa|tabela)-${UUID}-\\d{1,3}|arquivos)$`, 'i');

/** "Prévia do pedido #536:" → 536. O último "#N" do cabeçalho; sem número, null (D19). */
export function numeroDoCabecalho(cabecalho: string): number | null {
  const achados = [...cabecalho.matchAll(/#\s?(\d{1,9})\b/g)];
  return achados.length ? Number(achados.at(-1)![1]) : null;
}

/** `arquivo` da mensagem: só o CSV do Bling (o formato que o trabalhador grava). */
export function lerArquivo(arquivo: unknown): ArquivoBling | null {
  const a = arquivo as { tipo?: unknown; nome?: unknown; partes?: unknown; chamados?: unknown } | null;
  if (!a || a.tipo !== 'csv_bling' || typeof a.nome !== 'string' || !Array.isArray(a.chamados)) return null;
  const partes = typeof a.partes === 'number' && a.partes > 1 ? Math.floor(a.partes) : 1;
  return { nome: a.nome, partes, chamados: a.chamados.filter((c): c is string => typeof c === 'string') };
}

/** Linhas que mudaram na prévia, sem contar o total (ele muda junto com qualquer item). */
export function contarMudancas(p: PreviaInterpretada): number {
  return compararPrevia(p).filter((l) => l.mudanca !== 'igual' && !(l.tipo === 'campo' && /^total$/i.test(l.rotulo))).length;
}

const rotuloPrevia = (numero: number | null, n: number) =>
  `Prévia${numero !== null ? ` #${numero}` : ''} · ${n === 0 ? 'nenhuma mudança' : n === 1 ? '1 alteração' : `${n} alterações`}`;

/** Título da tabela: a linha logo antes dela, se for "# título" ou terminar em ":" (até 60 letras). */
function tituloDaTabela(antes: string[]): string | null {
  const linha = [...antes].reverse().find((l) => l.trim())?.trim() ?? '';
  const titulo = linha.replace(/\*\*/g, '');
  const ehTitulo = /^#{1,6}\s+/.test(titulo) || titulo.endsWith(':');
  const limpo = titulo.replace(/^#{1,6}\s+/, '').replace(/:\s*$/, '').trim();
  return ehTitulo && limpo && limpo.length <= 60 ? limpo : null;
}

/** Texto com tabelas: o texto em volta fica no balão; cada tabela vira cartão e resultado. */
function separarTabelas(texto: string, mensagemId: string, em: string, inicio: number) {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
  const pedacos: Pedaco[] = [];
  const tabelas: ResultadoTabela[] = [];
  let buffer: string[] = [];
  let n = inicio;
  const soltar = () => {
    const t = buffer.join('\n').trim();
    if (t) pedacos.push({ tipo: 'texto', texto: t });
    buffer = [];
  };
  for (let i = 0; i < linhas.length; i++) {
    if (LINHA_TABELA.test(linhas[i]!) && SEPARADOR_TABELA.test(linhas[i + 1] ?? '')) {
      let fim = i + 2;
      while (fim < linhas.length && LINHA_TABELA.test(linhas[fim]!)) fim++;
      const bloco = blocosDoTexto(linhas.slice(i, fim).join('\n'))[0];
      if (bloco?.tipo === 'tabela') {
        const titulo = tituloDaTabela(buffer) ?? `Tabela das ${formatarHora(em)}`;
        soltar();
        const chave = `tabela-${mensagemId}-${n++}`;
        const qtd = bloco.linhas.length;
        tabelas.push({ tipo: 'tabela', chave, titulo, tabela: { cabecalho: bloco.cabecalho, linhas: bloco.linhas }, mensagemId, em, rotulo: `${titulo} (${qtd})` });
        pedacos.push({ tipo: 'cartao', cartao: { tipo: 'tabela', chave, rotulo: `Tabela · ${qtd} ${qtd === 1 ? 'linha' : 'linhas'}` } });
        i = fim - 1;
        continue;
      }
    }
    buffer.push(linhas[i]!);
  }
  soltar();
  return { pedacos, tabelas, proximo: n };
}

function lerResposta(m: MensagemTela, podeCsv: boolean) {
  const pedacos: Pedaco[] = [];
  const pedidos: ResultadoPedido[] = [];
  const tabelas: ResultadoTabela[] = [];
  let n = 0;
  const texto = (t: string) => {
    if (!t.trim()) return;
    const r = separarTabelas(t, m.id, m.criado_em, n);
    n = r.proximo;
    pedacos.push(...r.pedacos);
    tabelas.push(...r.tabelas);
  };
  const previas = interpretarPrevias(m.conteudo);
  if (!previas) texto(m.conteudo);
  else {
    previas.forEach((p, i) => {
      texto(p.cabecalho);
      const numero = numeroDoCabecalho(p.cabecalho);
      const chave = numero !== null ? `pedido-${numero}` : `previa-${m.id}-${i}`;
      pedidos.push({ tipo: 'pedido', chave, numero, previa: p, mensagemId: m.id, em: m.criado_em,
        rotulo: numero !== null ? `Pedido #${numero}` : 'Prévia de pedido', previasNaMensagem: previas.length });
      pedacos.push({ tipo: 'cartao', cartao: { tipo: 'pedido', chave, rotulo: rotuloPrevia(numero, contarMudancas(p)) } });
      texto(p.rodape);
    });
  }
  // O CSV só aparece para quem pode gerá-lo (como hoje, D12).
  const arquivo = podeCsv ? lerArquivo(m.arquivo) : null;
  if (arquivo) pedacos.push({ tipo: 'cartao', cartao: { tipo: 'arquivo', chave: 'arquivos', rotulo: arquivo.nome, mensagemId: m.id, arquivo } });
  return { pedacos, pedidos, tabelas, arquivo: arquivo ? { mensagemId: m.id, em: m.criado_em, arquivo } : null };
}

const tempo = (iso: string) => new Date(iso).getTime();

/** Lê a conversa inteira (em ordem) e monta as respostas curtas, os resultados e a aba padrão (D9). */
export function lerConversa(mensagens: MensagemTela[], podeCsv: boolean): LeituraConversa {
  const respostas = new Map<string, Pedaco[]>();
  const pedidos = new Map<string, ResultadoPedido>();
  const tabelas: ResultadoTabela[] = [];
  const arquivos: ArquivoGerado[] = [];
  for (const m of mensagens) {
    if (m.papel !== 'assistente') continue;
    const r = lerResposta(m, podeCsv);
    respostas.set(m.id, r.pedacos);
    // O mesmo pedido de novo: fica a prévia mais nova.
    for (const p of r.pedidos) pedidos.set(p.chave, p);
    tabelas.push(...r.tabelas);
    if (r.arquivo) arquivos.push(r.arquivo);
  }
  const porData: Resultado[] = [...pedidos.values(), ...tabelas].sort((a, b) => tempo(b.em) - tempo(a.em));
  const resultados: Resultado[] = arquivos.length
    ? [...porData, { tipo: 'arquivos', chave: 'arquivos', arquivos: [...arquivos].reverse(), em: arquivos.at(-1)!.em, rotulo: 'Arquivos' }]
    : porData;
  return { respostas, resultados, padrao: porData[0]?.chave ?? (arquivos.length ? 'arquivos' : null) };
}

/** `?resultado=` da tela: só uma chave no formato conhecido. */
export function lerChaveResultado(valor: string | string[] | undefined): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && CHAVE.test(v) ? v : null;
}

/** A aba pedida, se existe nesta conversa; senão a padrão. */
export function escolherResultado(l: LeituraConversa, chave: string | null): Resultado | null {
  return l.resultados.find((r) => r.chave === chave) ?? l.resultados.find((r) => r.chave === l.padrao) ?? null;
}

/** Até MAX_ABAS pedidos/tabelas (os mais recentes), mais a escolhida se ficou de fora, e Arquivos no fim. */
export function abasVisiveis(l: LeituraConversa, selecionada: string | null): Resultado[] {
  const outras = l.resultados.filter((r) => r.tipo !== 'arquivos');
  const abas = outras.slice(0, MAX_ABAS);
  const escolhida = outras.find((r) => r.chave === selecionada);
  if (escolhida && !abas.includes(escolhida)) abas.push(escolhida);
  const arquivos = l.resultados.find((r) => r.tipo === 'arquivos');
  return arquivos ? [...abas, arquivos] : abas;
}

/**
 * SIM, GRAVAR / MUDAR OUTRA COISA só embaixo da prévia que o "sim" vai gravar (D7): a da última mensagem da conversa,
 * única nessa resposta e com número. (Pergunta depois dela, respondida ou não, tira os botões.)
 */
export function podeResponderPrevia(mensagens: MensagemTela[], r: ResultadoPedido): boolean {
  const ultima = mensagens.at(-1);
  return r.numero !== null && r.previasNaMensagem === 1 && ultima?.id === r.mensagemId && ultima.papel === 'assistente';
}

export function hrefResultado(conversaId: string | null, chave: string): string {
  const p = new URLSearchParams(conversaId ? { conversa: conversaId, resultado: chave } : { resultado: chave });
  return `/assistente?${p.toString()}`;
}

/** O arquivo do Bling mais recente desta conversa que leva a demanda. */
export function arquivoDoPedido(l: LeituraConversa, chamadoId: string): ArquivoGerado | null {
  const r = l.resultados.find((x): x is ResultadoArquivos => x.tipo === 'arquivos');
  return r?.arquivos.find((a) => a.arquivo.chamados.includes(chamadoId)) ?? null;
}
```

- [ ] **Passo 5: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/resultados-assistente.test.ts src/lib/texto-assistente.test.ts src/lib/previa-pedido.test.ts`
Expected: PASS (os testes de `texto-assistente` e `previa-pedido`, se existirem, continuam verdes; se algum não existir, o vitest só avisa "No test files found" para ele).

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/lib/resultados-assistente.ts apps/painel/src/lib/resultados-assistente.test.ts apps/painel/src/lib/texto-assistente.ts
git commit -m "feat(painel): regras da tela do Assistente — resposta curta com cartões, abas de resultado e quando os botões da prévia aparecem

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras puras. Painel do pedido, origem, selo e histórico

**Files:**
- Create: `apps/painel/src/lib/pedido-assistente.ts`, `apps/painel/src/lib/pedido-assistente.test.ts`

**Interfaces:**
- Consumes: `compararPrevia`, `interpretarPrevias`, `LinhaComparada`, `PreviaInterpretada` (`lib/previa-pedido.ts`); `fraseDoEvento` (`lib/linha-do-tempo.ts`); `formatarData`, `formatarHora` (`lib/formatos.ts`); `numeroDoCabecalho`, `lerArquivo`, `MensagemTela` (Task 1).
- Produces: `Campo`, `ItemComparado`, `CampoComparado`, `PedidoNoPainel`, `montarPedidoNoPainel(p)`; `DemandaDoPedido`, `origemDoPedido(d)`; `EventoPedido`, `PREFIXO_GRAVADO`, `seloGravado(eventos, usuarioId, mostradaEm)`; `Marco`, `historicoDoPedido({…})`, `quandoNoHistorico(iso, agora)`.

- [ ] **Passo 1: escrever o teste que falha**

`apps/painel/src/lib/pedido-assistente.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { interpretarPrevia } from './previa-pedido';
import {
  historicoDoPedido, montarPedidoNoPainel, origemDoPedido, PREFIXO_GRAVADO, quandoNoHistorico, seloGravado,
  type DemandaDoPedido, type EventoPedido,
} from './pedido-assistente';
import type { MensagemTela } from './resultados-assistente';

const lado = (linhas: string[]) => linhas.join('\n');
const BASE = [
  'Destinatário: Rede Bom Preço / Unidade Centro',
  '• 10 PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = R$ 185,00',
  '• 6 UN Bolo de fubá 400g (cód. 31) × R$ 14,00 = R$ 84,00',
  'Total: R$ 269,00',
  'Pagamento: Boleto 28 dias · Entrega: 03/10',
];
const previa = (antes: string[], depois: string[]) => interpretarPrevia(`Prévia do pedido #536:\nAntes:\n${lado(antes)}\nDepois:\n${lado(depois)}`)!;

describe('montarPedidoNoPainel (D2: tudo da prévia)', () => {
  it('destinatário em rede e unidade; pagamento, entrega e endereço do cadastro; itens comparados; total antes/depois', () => {
    const depois = [...BASE];
    depois[1] = '• 15 PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = R$ 277,50';
    depois[3] = 'Total: R$ 361,50';
    const p = montarPedidoNoPainel(previa(BASE, depois));
    expect(p.destinatario).toEqual({ rede: 'Rede Bom Preço', unidade: 'Unidade Centro', anterior: null });
    expect(p.pagamento).toEqual({ valor: 'Boleto 28 dias', anterior: null, mudou: false });
    expect(p.entrega).toEqual({ valor: '03/10', anterior: null, mudou: false });
    expect(p.enderecoEntrega).toEqual({ valor: null, anterior: null, mudou: false });
    expect(p.total).toEqual({ valor: 'R$ 361,50', anterior: 'R$ 269,00', mudou: true });
    expect(p.itens.map((i) => i.mudanca)).toEqual(['alterado', 'igual']);
    expect(p.itens[0]!.anterior?.quantidade).toBe('10');
    expect(p.itens[0]!.item).toMatchObject({ quantidade: '15', unidade: 'PAC', codigo: '12', subtotal: 'R$ 277,50' });
    expect(p.outros).toEqual([]);
  });

  it('endereço de entrega novo, destinatário trocado, item removido e observação nova', () => {
    const depois = ['Destinatário: Mercado Central / Loja 2', 'Entrega em: Rua A, 10 - Centro', BASE[1]!, 'Total: R$ 185,00',
      'Pagamento: Pix · Entrega: 03/10', 'Observações: entregar cedo'];
    const p = montarPedidoNoPainel(previa(BASE, depois));
    expect(p.destinatario).toEqual({ rede: 'Mercado Central', unidade: 'Loja 2', anterior: 'Rede Bom Preço / Unidade Centro' });
    expect(p.enderecoEntrega).toEqual({ valor: 'Rua A, 10 - Centro', anterior: null, mudou: true });
    expect(p.pagamento).toEqual({ valor: 'Pix', anterior: 'Boleto 28 dias', mudou: true });
    expect(p.itens.map((i) => [i.item.produto, i.mudanca])).toEqual([['Pão de queijo congelado 1kg', 'igual'], ['Bolo de fubá 400g', 'removido']]);
    expect(p.outros).toEqual([expect.objectContaining({ rotulo: 'Observações', valor: 'entregar cedo', mudanca: 'adicionado' })]);
  });
});

const DEMANDA: DemandaDoPedido = {
  id: 'd1', numero: 536, titulo: 'NF de venda', setor: 'Fiscal', empresa: 'Padaria Sol ME', status: 'aberto', origem: 'agente',
  contato: 'Carla Mendes', criadoEm: '2026-10-01T13:00:00Z', criadoPorNome: null,
};

describe('origemDoPedido (D3)', () => {
  it('agente: contato e WhatsApp; sem contato, "Contato sem cadastro"; equipe: quem abriu e Painel', () => {
    expect(origemDoPedido(DEMANDA)).toEqual({ quem: 'Carla Mendes', como: 'WhatsApp · 01/10' });
    expect(origemDoPedido({ ...DEMANDA, contato: null })).toEqual({ quem: 'Contato sem cadastro', como: 'WhatsApp · 01/10' });
    expect(origemDoPedido({ ...DEMANDA, origem: 'equipe', criadoPorNome: 'Bruno' })).toEqual({ quem: 'Bruno', como: 'Painel · 01/10' });
  });
});

const ANA = 'u-ana';
const nota = (em: string, usuarioId: string | null, texto: string, usuario = 'Ana Lima'): EventoPedido =>
  ({ tipo: 'nota_interna', texto, criado_em: em, usuario_id: usuarioId, usuario });
const GRAVOU = `${PREFIXO_GRAVADO}Ana Lima.\nAntes:\n…\nDepois:\n…`;

describe('seloGravado (D5)', () => {
  const PREVIA_EM = '2026-10-10T18:40:00Z';
  it('nota da gravação da própria pessoa depois da prévia: selo com a hora e o nome', () => {
    expect(seloGravado([nota('2026-10-10T18:41:00Z', ANA, GRAVOU)], ANA, PREVIA_EM)).toEqual({ em: '2026-10-10T18:41:00Z', por: 'Ana Lima' });
  });
  it('nota de outra pessoa, antes da prévia ou com outro texto: sem selo', () => {
    expect(seloGravado([nota('2026-10-10T18:41:00Z', 'u-bruno', GRAVOU, 'Bruno')], ANA, PREVIA_EM)).toBeNull();
    expect(seloGravado([nota('2026-10-10T18:39:00Z', ANA, GRAVOU)], ANA, PREVIA_EM)).toBeNull();
    expect(seloGravado([nota('2026-10-10T18:41:00Z', ANA, 'Cliente ligou.')], ANA, PREVIA_EM)).toBeNull();
  });
});

describe('historicoDoPedido (D4)', () => {
  const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const m = (n: number, conteudo: string, arquivo: unknown = null): MensagemTela =>
    ({ id: ID(n), papel: 'assistente', conteudo, arquivo, processada_em: 'x', criado_em: `2026-10-10T18:${String(n).padStart(2, '0')}:00Z` });
  const PREVIA_TXT = `Prévia do pedido #536:\nAntes:\n${lado(BASE)}\nDepois:\n${lado(BASE)}`;
  const eventos: EventoPedido[] = [
    { tipo: 'criacao', texto: 'resumo do cliente', criado_em: '2026-10-01T13:00:00Z', usuario_id: null, usuario: null },
    nota('2026-10-10T18:41:00Z', ANA, GRAVOU),
    { tipo: 'status_alterado', texto: 'em_andamento', criado_em: '2026-10-10T18:42:00Z', usuario_id: 'u-bruno', usuario: 'Bruno' },
    nota('2026-10-10T18:43:00Z', 'u-bruno', 'Cliente confirmou por telefone.\nsegunda linha', 'Bruno'),
  ];

  it('eventos da demanda e momentos da conversa, em ordem; CSV só com a demanda e com "Corrigir e gerar"', () => {
    const marcos = historicoDoPedido({ demanda: DEMANDA, eventos, pessoa: 'Ana', podeCsv: true, mensagens: [
      m(40, PREVIA_TXT), m(44, 'Feito.', { tipo: 'csv_bling', chamados: ['d1'], nome: 'x.csv', partes: 1 }),
      m(45, 'Outro.', { tipo: 'csv_bling', chamados: ['d9'], nome: 'y.csv', partes: 1 }),
    ] });
    expect(marcos.map((x) => [x.tipo, x.texto])).toEqual([
      ['abertura', 'Agente abriu o pedido pelo WhatsApp de Carla Mendes'],
      ['previa', 'Prévia mostrada a Ana'],
      ['gravado', 'Ana Lima gravou a correção pelo assistente'],
      ['evento', 'Bruno status Em andamento'],
      ['evento', 'Bruno nota interna: Cliente confirmou por telefone.'],
      ['arquivo', 'CSV do Bling gerado'],
    ]);
    expect(historicoDoPedido({ demanda: DEMANDA, eventos: [], pessoa: 'Ana', podeCsv: false,
      mensagens: [m(44, 'Feito.', { tipo: 'csv_bling', chamados: ['d1'], nome: 'x.csv', partes: 1 })] })).toEqual([]);
  });

  it('demanda aberta pela equipe', () => {
    const [abertura] = historicoDoPedido({ demanda: { ...DEMANDA, origem: 'equipe', criadoPorNome: 'Bruno' }, pessoa: 'Ana', podeCsv: true, mensagens: [],
      eventos: [{ tipo: 'criacao', texto: null, criado_em: '2026-10-01T13:00:00Z', usuario_id: 'u-bruno', usuario: 'Bruno' }] });
    expect(abertura).toMatchObject({ tipo: 'abertura', texto: 'Bruno abriu a demanda no painel' });
  });
});

describe('quandoNoHistorico', () => {
  it('hoje: hora; outro dia: dd/mm (Brasília)', () => {
    const agora = new Date('2026-10-10T18:50:00Z');
    expect(quandoNoHistorico('2026-10-10T18:41:00Z', agora)).toBe('15:41');
    expect(quandoNoHistorico('2026-10-01T13:00:00Z', agora)).toBe('01/10');
  });
});
```

O "Bruno status Em andamento" depende de `ROTULO_STATUS.em_andamento` em `lib/demandas.ts`: confira com `grep -n "em_andamento" apps/painel/src/lib/demandas.ts` e use o rótulo que estiver lá no teste.

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/pedido-assistente.test.ts`
Expected: FAIL (`Cannot find module './pedido-assistente'`).

- [ ] **Passo 3: implementar `lib/pedido-assistente.ts`**

```ts
/**
 * Painel do pedido na tela do Assistente (Parte G4, spec 7C.3). Os dados do pedido vêm da prévia mostrada na conversa,
 * nunca do banco (D2: o "sim" grava exatamente essa prévia). Os da demanda (origem, histórico, selo) vêm do que já está
 * gravado e a pessoa pode ler: demandas_lista e chamado_eventos (D3, D4, D5).
 */
import { formatarData, formatarHora } from './formatos';
import { fraseDoEvento } from './linha-do-tempo';
import { compararPrevia, interpretarPrevias, type LinhaComparada, type PreviaInterpretada } from './previa-pedido';
import { lerArquivo, numeroDoCabecalho, type MensagemTela } from './resultados-assistente';

export type Campo = { valor: string | null; anterior: string | null; mudou: boolean };
export type ItemComparado = Extract<LinhaComparada, { tipo: 'item' }>;
export type CampoComparado = Extract<LinhaComparada, { tipo: 'campo' }>;
export type PedidoNoPainel = {
  destinatario: { rede: string | null; unidade: string | null; anterior: string | null };
  pagamento: Campo; entrega: Campo; enderecoEntrega: Campo; total: Campo;
  /** Frete, tipo de frete, transportadora, observações (o que descreverPedido escreve além dos principais). */
  outros: CampoComparado[];
  itens: ItemComparado[];
};

// Rótulos que descreverPedido (trabalhador) escreve e que têm lugar próprio no painel.
const PRINCIPAIS = ['Destinatário', 'Pagamento', 'Entrega', 'Entrega em', 'Total'];
const mesmo = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0;

function campo(linhas: LinhaComparada[], rotulo: string): Campo {
  const l = linhas.find((x): x is CampoComparado => x.tipo === 'campo' && mesmo(x.rotulo, rotulo));
  if (!l) return { valor: null, anterior: null, mudou: false };
  if (l.mudanca === 'removido') return { valor: null, anterior: l.valor, mudou: true };
  return { valor: l.valor, anterior: l.anterior, mudou: l.mudanca !== 'igual' };
}

export function montarPedidoNoPainel(p: PreviaInterpretada): PedidoNoPainel {
  const linhas = compararPrevia(p);
  const dest = campo(linhas, 'Destinatário');
  // "Rede / Unidade" (descreverPedido); sem a barra, tudo é a rede.
  const [rede = null, ...resto] = (dest.valor ?? '').split(' / ').map((s) => s.trim()).filter(Boolean);
  return {
    destinatario: { rede, unidade: resto.join(' / ') || null, anterior: dest.mudou ? dest.anterior : null },
    pagamento: campo(linhas, 'Pagamento'),
    entrega: campo(linhas, 'Entrega'),
    enderecoEntrega: campo(linhas, 'Entrega em'),
    total: campo(linhas, 'Total'),
    outros: linhas.filter((l): l is CampoComparado => l.tipo === 'campo' && !PRINCIPAIS.some((r) => mesmo(r, l.rotulo))),
    itens: linhas.filter((l): l is ItemComparado => l.tipo === 'item'),
  };
}

/** Demanda do pedido como a tela lê (demandas_lista, pela regra de leitura de quem consulta). */
export type DemandaDoPedido = {
  id: string; numero: number; titulo: string; setor: string | null; empresa: string | null; status: string;
  origem: string; contato: string | null; criadoEm: string; criadoPorNome: string | null;
};

const diaMes = (iso: string) => formatarData(iso).slice(0, 5);

/** "Pedido veio de" (D3): o agente pelo WhatsApp de um contato, ou alguém da equipe pelo painel. */
export function origemDoPedido(d: DemandaDoPedido): { quem: string; como: string } {
  if (d.origem === 'agente') return { quem: d.contato ?? 'Contato sem cadastro', como: `WhatsApp · ${diaMes(d.criadoEm)}` };
  return { quem: d.criadoPorNome ?? 'Equipe', como: `Painel · ${diaMes(d.criadoEm)}` };
}

/** Evento da demanda (chamado_eventos), com quem fez. */
export type EventoPedido = { tipo: string; texto: string | null; criado_em: string; usuario_id: string | null; usuario: string | null };

/** Começo da nota interna que o trabalhador grava ao gravar a correção (assistente/ferramentas.ts, registrarNotaInterna). */
export const PREFIXO_GRAVADO = 'Pedido alterado pelo assistente a pedido de ';

const tempo = (iso: string) => new Date(iso).getTime();
const gravacao = (e: EventoPedido) => e.tipo === 'nota_interna' && (e.texto ?? '').startsWith(PREFIXO_GRAVADO);

/** Selo "Gravado às HH:MM por <pessoa>" (D5): a gravação da própria pessoa, depois da prévia mostrada. */
export function seloGravado(eventos: EventoPedido[], usuarioId: string, mostradaEm: string): { em: string; por: string } | null {
  const e = [...eventos].reverse().find((x) => gravacao(x) && x.usuario_id === usuarioId && tempo(x.criado_em) >= tempo(mostradaEm));
  return e ? { em: e.criado_em, por: e.usuario ?? 'você' } : null;
}

export type Marco = { em: string; tipo: 'abertura' | 'previa' | 'gravado' | 'arquivo' | 'evento'; texto: string };

const primeiraLinha = (t: string) => {
  const l = t.split('\n')[0]!.trim();
  return l.length > 80 ? `${l.slice(0, 79)}…` : l;
};

/** Histórico do pedido (D4): eventos da demanda + prévias e arquivos desta conversa, do mais antigo ao mais novo. */
export function historicoDoPedido(p: { demanda: DemandaDoPedido; eventos: EventoPedido[]; mensagens: MensagemTela[]; pessoa: string; podeCsv: boolean }): Marco[] {
  const marcos: Marco[] = [];
  for (const e of p.eventos) {
    if (e.tipo === 'criacao') {
      marcos.push({ em: e.criado_em, tipo: 'abertura', texto: p.demanda.origem === 'agente'
        ? `Agente abriu o pedido pelo WhatsApp${p.demanda.contato ? ` de ${p.demanda.contato}` : ''}`
        : `${e.usuario ?? p.demanda.criadoPorNome ?? 'Equipe'} abriu a demanda no painel` });
      continue;
    }
    if (gravacao(e)) {
      marcos.push({ em: e.criado_em, tipo: 'gravado', texto: `${e.usuario ?? 'Alguém da equipe'} gravou a correção pelo assistente` });
      continue;
    }
    const f = fraseDoEvento({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuario }, p.demanda.origem);
    marcos.push({ em: e.criado_em, tipo: 'evento', texto: `${f.ator} ${f.acao}${f.detalhe ? `: ${primeiraLinha(f.detalhe)}` : ''}` });
  }
  for (const m of p.mensagens) {
    if (m.papel !== 'assistente') continue;
    if ((interpretarPrevias(m.conteudo) ?? []).some((x) => numeroDoCabecalho(x.cabecalho) === p.demanda.numero)) {
      marcos.push({ em: m.criado_em, tipo: 'previa', texto: `Prévia mostrada a ${p.pessoa}` });
    }
    const arquivo = p.podeCsv ? lerArquivo(m.arquivo) : null;
    if (arquivo?.chamados.includes(p.demanda.id)) marcos.push({ em: m.criado_em, tipo: 'arquivo', texto: 'CSV do Bling gerado' });
  }
  return marcos.sort((a, b) => tempo(a.em) - tempo(b.em));
}

/** Hora (hoje) ou dd/mm (outro dia), no horário de Brasília. */
export function quandoNoHistorico(iso: string, agora: Date): string {
  return formatarData(iso) === formatarData(agora) ? formatarHora(iso) : diaMes(iso);
}
```

- [ ] **Passo 4: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/pedido-assistente.test.ts`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/lib/pedido-assistente.ts apps/painel/src/lib/pedido-assistente.test.ts
git commit -m "feat(painel): painel do pedido do Assistente a partir da prévia mostrada, com origem, selo de gravado e histórico do que está gravado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Leitores da tela (D17, D18)

**Files:**
- Create: `assistente/dados-assistente.ts`, `assistente/dados-assistente.test.ts`

**Interfaces:**
- Consumes: `agruparConversasAssistente`, `LIMITE_CONVERSAS_HISTORICO`, `LIMITE_MENSAGENS_HISTORICO` (`lib/conversas-assistente.ts`); `mascararTelefone`; `ehPedidoDeNota`, `ocultarEventosDoPedido` (`lib/pedido-nota.ts`); tipos das Tasks 1 e 2.
- Produces: `LIMITE_MENSAGENS_TELA = 60`; `lerMensagensAssistente(sb, usuarioId, conversaId): Promise<MensagemTela[]>`; `ConversaDoHistorico = { id, nome, empresa, ultimaEm, mensagens }`; `lerHistoricoAssistente(sb, usuarioId, conversaId): Promise<{ ultimaGeral: string | null; conversas: ConversaDoHistorico[]; aberta: ConversaDoHistorico | null }>`; `LeituraDemanda = { estado: 'ok'; demanda: DemandaDoPedido; eventos: EventoPedido[] } | { estado: 'fora' } | { estado: 'falha' }`; `lerDemandaDoPedido(sb, numero, verPedidos): Promise<LeituraDemanda>`.

- [ ] **Passo 1: escrever o teste que falha**

`assistente/dados-assistente.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVISO_SEM_ACESSO_PEDIDO } from '@/lib/pedido-nota';
import { PREFIXO_GRAVADO } from '@/lib/pedido-assistente';

vi.mock('server-only', () => ({}));

// Banco falso: cada consulta grava os métodos chamados; o cenário de cada teste decide a resposta olhando a consulta.
type Op = [string, unknown[]];
type Consulta = { tabela: string; ops: Op[] };
const cenario = { responder: (_c: Consulta): unknown => ({ data: null, error: { code: 'XX000', message: 'sem cenário' } }), consultas: [] as Consulta[] };

function clienteFalso() {
  return {
    from: (tabela: string) => {
      const c: Consulta = { tabela, ops: [] };
      cenario.consultas.push(c);
      const cadeia: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'not', 'in', 'order', 'limit']) {
        cadeia[m] = (...a: unknown[]) => { c.ops.push([m, a]); return cadeia; };
      }
      cadeia.maybeSingle = () => Promise.resolve(cenario.responder(c));
      cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(cenario.responder(c)).then(ok, erro);
      return cadeia;
    },
  };
}

const { lerDemandaDoPedido, lerHistoricoAssistente, lerMensagensAssistente } = await import('./dados-assistente');
const sb = () => clienteFalso() as never;
const tem = (c: Consulta, m: string, ...a: unknown[]) => c.ops.some(([n, args]) => n === m && JSON.stringify(args) === JSON.stringify(a));

beforeEach(() => {
  cenario.consultas = [];
  vi.spyOn(console, 'error').mockReset().mockImplementation(() => {});
});

describe('lerMensagensAssistente', () => {
  it('Geral: sem conversa, só do site, as 60 mais novas, devolvidas da mais antiga para a mais nova', async () => {
    cenario.responder = () => ({ data: [{ id: 'b', criado_em: '2' }, { id: 'a', criado_em: '1' }], error: null });
    const r = await lerMensagensAssistente(sb(), 'u1', null);
    expect(r.map((m) => m.id)).toEqual(['a', 'b']);
    const [c] = cenario.consultas;
    expect(tem(c!, 'eq', 'usuario_id', 'u1') && tem(c!, 'eq', 'canal', 'site') && tem(c!, 'is', 'conversa_id', null)).toBe(true);
    expect(tem(c!, 'order', 'criado_em', { ascending: false }) && tem(c!, 'limit', 60)).toBe(true);
  });
  it('com conversa: filtra por ela', async () => {
    cenario.responder = () => ({ data: [], error: null });
    await lerMensagensAssistente(sb(), 'u1', 'c1');
    expect(tem(cenario.consultas[0]!, 'eq', 'conversa_id', 'c1')).toBe(true);
  });
});

describe('lerHistoricoAssistente', () => {
  it('só as conversas que a pessoa ainda vê (RLS de conversas); a aberta vem junto', async () => {
    cenario.responder = (c) => {
      if (c.tabela === 'assistente_mensagens' && tem(c, 'is', 'conversa_id', null)) return { data: { criado_em: '2026-10-10T18:00:00Z' }, error: null };
      if (c.tabela === 'assistente_mensagens') return { data: [
        { conversa_id: 'c1', criado_em: '3' }, { conversa_id: 'c2', criado_em: '2' }, { conversa_id: 'c1', criado_em: '1' },
      ], error: null };
      if (c.tabela === 'conversas') return { data: [{ id: 'c1', telefone: '5531999990001', contatos: { nome: 'Carla' }, clientes: { razao_social: 'Padaria', nome_fantasia: null } }], error: null };
      return { data: null, error: null };
    };
    const r = await lerHistoricoAssistente(sb(), 'u1', 'c1');
    expect(r.ultimaGeral).toBe('2026-10-10T18:00:00Z');
    expect(r.conversas).toEqual([{ id: 'c1', nome: 'Carla', empresa: 'Padaria', ultimaEm: '3', mensagens: 2 }]);
    expect(r.aberta?.id).toBe('c1');
  });
});

const LINHA = {
  id: 'd1', numero: 536, titulo: 'NF de venda', setor: 'Fiscal', empresa: 'Padaria Sol ME', status: 'aberto', origem: 'agente',
  contato: 'Carla', criado_em: '2026-10-01T13:00:00Z', criado_por_nome: null, tem_pedido: true,
};
const EVENTOS = [
  { tipo: 'criacao', texto: 'resumo', criado_em: '2026-10-01T13:00:00Z', usuario_id: null, usuarios: null },
  { tipo: 'nota_interna', texto: `${PREFIXO_GRAVADO}Ana.\nAntes:\n10\nDepois:\n15`, criado_em: '2026-10-10T18:41:00Z', usuario_id: 'u1', usuarios: { nome: 'Ana' } },
];

describe('lerDemandaDoPedido (D17)', () => {
  it('pelo número, em demandas_lista (regra de leitura de quem consulta), com os eventos em ordem', async () => {
    cenario.responder = (c) => (c.tabela === 'demandas_lista' ? { data: LINHA, error: null } : { data: EVENTOS, error: null });
    const r = await lerDemandaDoPedido(sb(), 536, true);
    expect(r.estado).toBe('ok');
    if (r.estado !== 'ok') return;
    expect(r.demanda).toEqual({ id: 'd1', numero: 536, titulo: 'NF de venda', setor: 'Fiscal', empresa: 'Padaria Sol ME', status: 'aberto',
      origem: 'agente', contato: 'Carla', criadoEm: '2026-10-01T13:00:00Z', criadoPorNome: null });
    expect(r.eventos[1]).toEqual({ tipo: 'nota_interna', texto: EVENTOS[1]!.texto, criado_em: '2026-10-10T18:41:00Z', usuario_id: 'u1', usuario: 'Ana' });
    expect(tem(cenario.consultas[0]!, 'eq', 'numero', 536)).toBe(true);
    expect(tem(cenario.consultas[1]!, 'eq', 'chamado_id', 'd1') && tem(cenario.consultas[1]!, 'order', 'criado_em')).toBe(true);
    // O pedido em si nunca é lido do banco (D2).
    expect(JSON.stringify(cenario.consultas[0]!.ops)).not.toContain('pedido_venda');
  });

  it('"Pedidos de nota: Sem acesso": textos livres dos eventos escondidos (P11)', async () => {
    cenario.responder = (c) => (c.tabela === 'demandas_lista' ? { data: LINHA, error: null } : { data: EVENTOS, error: null });
    const r = await lerDemandaDoPedido(sb(), 536, false);
    expect(r.estado === 'ok' && r.eventos.map((e) => e.texto)).toEqual(['resumo', AVISO_SEM_ACESSO_PEDIDO]);
  });

  it('fora das que a pessoa vê: "fora"; erro na leitura: "falha", com log', async () => {
    cenario.responder = () => ({ data: null, error: null });
    expect(await lerDemandaDoPedido(sb(), 536, true)).toEqual({ estado: 'fora' });
    cenario.responder = () => ({ data: null, error: { code: '57014', message: 'timeout' } });
    expect(await lerDemandaDoPedido(sb(), 536, true)).toEqual({ estado: 'falha' });
    expect(vi.mocked(console.error)).toHaveBeenCalled();
  });

  it('eventos que falham não derrubam a demanda: lista vazia, com log', async () => {
    cenario.responder = (c) => (c.tabela === 'demandas_lista' ? { data: LINHA, error: null } : { data: null, error: { code: 'XX000', message: 'x' } });
    const r = await lerDemandaDoPedido(sb(), 536, true);
    expect(r.estado === 'ok' && r.eventos).toEqual([]);
    expect(vi.mocked(console.error)).toHaveBeenCalled();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/assistente/dados-assistente.test.ts"`
Expected: FAIL (`Cannot find module './dados-assistente'`).

- [ ] **Passo 3: implementar `assistente/dados-assistente.ts`**

```ts
import 'server-only';
import { agruparConversasAssistente, LIMITE_CONVERSAS_HISTORICO, LIMITE_MENSAGENS_HISTORICO } from '@/lib/conversas-assistente';
import { mascararTelefone } from '@/lib/formatos';
import type { DemandaDoPedido, EventoPedido } from '@/lib/pedido-assistente';
import { ehPedidoDeNota, ocultarEventosDoPedido } from '@/lib/pedido-nota';
import type { MensagemTela } from '@/lib/resultados-assistente';
import type { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * Leituras da tela do Assistente (Parte G4). Só tabelas e visões que já estão no banco de todos (Partes C–E):
 * assistente_mensagens, conversas, demandas_lista e chamado_eventos (D18). Tudo com o RLS de quem consulta.
 */
type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

export const LIMITE_MENSAGENS_TELA = 60;

export async function lerMensagensAssistente(sb: Sb, usuarioId: string, conversaId: string | null): Promise<MensagemTela[]> {
  let q = sb.from('assistente_mensagens').select('id, papel, conteudo, arquivo, processada_em, criado_em').eq('usuario_id', usuarioId).eq('canal', 'site');
  q = conversaId ? q.eq('conversa_id', conversaId) : q.is('conversa_id', null);
  const { data, error } = await q.order('criado_em', { ascending: false }).limit(LIMITE_MENSAGENS_TELA);
  if (error) console.error('[assistente] mensagens', error);
  return ((data ?? []) as MensagemTela[]).reverse();
}

export type ConversaDoHistorico = { id: string; nome: string; empresa: string | null; ultimaEm: string | null; mensagens: number };

/** Histórico em botões (D14): a "Geral" e as conversas feitas dentro de atendimentos que a pessoa ainda vê. */
export async function lerHistoricoAssistente(sb: Sb, usuarioId: string, conversaId: string | null) {
  const [{ data: ultimaGeral }, { data: doHistorico }] = await Promise.all([
    sb.from('assistente_mensagens').select('criado_em').eq('usuario_id', usuarioId).eq('canal', 'site').is('conversa_id', null)
      .order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    sb.from('assistente_mensagens').select('conversa_id, criado_em').eq('usuario_id', usuarioId).eq('canal', 'site').not('conversa_id', 'is', null)
      .order('criado_em', { ascending: false }).limit(LIMITE_MENSAGENS_HISTORICO),
  ]);
  // Lê o dobro das conversas mostradas: as que o RLS esconde saem antes do limite.
  const lidas = agruparConversasAssistente(doHistorico ?? [], LIMITE_CONVERSAS_HISTORICO * 2);
  const ids = [...new Set([...lidas.map((g) => g.conversaId), ...(conversaId ? [conversaId] : [])])];
  const { data: conversas } = ids.length
    ? await sb.from('conversas').select('id, telefone, contatos(nome), clientes:cliente_em_foco(razao_social, nome_fantasia)').in('id', ids)
    : { data: [] };
  const visiveis = new Map((conversas ?? []).map((c) => [c.id, {
    nome: c.contatos?.nome ?? mascararTelefone(c.telefone),
    empresa: c.clientes ? c.clientes.nome_fantasia ?? c.clientes.razao_social : null,
  }]));
  const lista: ConversaDoHistorico[] = lidas.flatMap((g) => {
    const v = visiveis.get(g.conversaId);
    return v ? [{ id: g.conversaId, nome: v.nome, empresa: v.empresa, ultimaEm: g.ultimaEm, mensagens: g.mensagens }] : [];
  }).slice(0, LIMITE_CONVERSAS_HISTORICO);
  const v = conversaId ? visiveis.get(conversaId) : undefined;
  const aberta: ConversaDoHistorico | null = conversaId && v
    ? lista.find((c) => c.id === conversaId) ?? { id: conversaId, nome: v.nome, empresa: v.empresa, ultimaEm: null, mensagens: 0 }
    : null;
  return { ultimaGeral: (ultimaGeral?.criado_em as string | undefined) ?? null, conversas: lista, aberta };
}

export type LeituraDemanda = { estado: 'ok'; demanda: DemandaDoPedido; eventos: EventoPedido[] } | { estado: 'fora' } | { estado: 'falha' };

/**
 * Demanda do pedido pelo número (D17): demandas_lista com a regra de leitura de quem consulta. Nunca lê o pedido em si
 * (D2). Sem acesso a pedidos de nota, os textos livres dos eventos saem antes de chegar à tela (P11).
 */
export async function lerDemandaDoPedido(sb: Sb, numero: number, verPedidos: boolean): Promise<LeituraDemanda> {
  const { data: d, error } = await sb.from('demandas_lista')
    .select('id, numero, titulo, setor, empresa, status, origem, contato, criado_em, criado_por_nome, tem_pedido').eq('numero', numero).maybeSingle();
  if (error) {
    console.error('[assistente] demanda do pedido', error);
    return { estado: 'falha' };
  }
  if (!d?.id) return { estado: 'fora' };
  const { data: ev, error: erroEventos } = await sb.from('chamado_eventos')
    .select('tipo, texto, criado_em, usuario_id, usuarios(nome)').eq('chamado_id', d.id).order('criado_em');
  if (erroEventos) console.error('[assistente] eventos do pedido', erroEventos);
  const eventos: EventoPedido[] = (ev ?? []).map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario_id: e.usuario_id, usuario: e.usuarios?.nome ?? null }));
  const semPedido = !verPedidos && ehPedidoDeNota({ titulo: d.titulo, pedido_venda: d.tem_pedido ? true : null });
  return {
    estado: 'ok',
    demanda: {
      id: d.id, numero: Number(d.numero), titulo: d.titulo ?? '', setor: d.setor, empresa: d.empresa, status: String(d.status ?? ''),
      origem: d.origem ?? 'agente', contato: d.contato, criadoEm: d.criado_em ?? '', criadoPorNome: d.criado_por_nome,
    },
    eventos: semPedido ? ocultarEventosDoPedido(eventos) : eventos,
  };
}
```

- [ ] **Passo 4: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/assistente/dados-assistente.test.ts" && pnpm --filter @escritorio/painel typecheck`
Expected: PASS e typecheck sem erro. Se o typecheck reclamar de `null` nas colunas da visão (as visões geram tipos com tudo opcional), ajuste com `?? null` / `String(...)`, **sem** `as any`.

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/assistente/dados-assistente.ts" "apps/painel/src/app/(painel)/assistente/dados-assistente.test.ts"
git commit -m "feat(painel): leitores do Assistente — mensagens, histórico de conversas e demanda do pedido com os eventos, pela regra de leitura de quem consulta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Casca. Menu recolhido no Assistente e largura da conversa

**Files:**
- Modify: `apps/painel/src/components/layout/menu-tela.ts`, `apps/painel/src/components/layout/app-shell.tsx`
- Create: `apps/painel/src/components/layout/menu-tela-assistente.test.ts`
- Modify: `apps/painel/src/styles/tokens.css`, `apps/painel/src/app/globals.css`
- Create: `apps/painel/src/styles/largura-assistente.test.ts`

**Interfaces:**
- Produces: `telaComMenuRecolhido('/assistente') === true`; `telaRecolhida(caminho): 'atendimento' | 'assistente' | null`; token `--assistant-chat-width` e utilitário `w-chat-assistente`.

- [ ] **Passo 1: escrever os testes que falham**

`apps/painel/src/components/layout/menu-tela-assistente.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { menuRecolhidoVisivel, telaComMenuRecolhido, telaRecolhida } from './menu-tela';

describe('menu recolhido também no Assistente (spec 7C.3, D13)', () => {
  it('Assistente, com ou sem consulta na URL (o caminho não leva a consulta)', () => {
    expect(telaComMenuRecolhido('/assistente')).toBe(true);
    expect(telaComMenuRecolhido('/assistentes')).toBe(false);
    expect(menuRecolhidoVisivel('/assistente', false, false)).toBe(true);
    expect(menuRecolhidoVisivel('/assistente', false, true)).toBe(false);
  });
  it('telaRecolhida separa Atendimento e Assistente: trocar de uma para a outra esquece o "aberto aqui"', () => {
    expect(telaRecolhida('/atendimento')).toBe('atendimento');
    expect(telaRecolhida('/atendimento/abc')).toBe('atendimento');
    expect(telaRecolhida('/assistente')).toBe('assistente');
    expect(telaRecolhida('/demandas')).toBeNull();
  });
});
```

`apps/painel/src/styles/largura-assistente.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('largura da conversa do Assistente (spec 7C.3, ~470px)', () => {
  it('token em rem (acompanha a letra) e utilitário w-chat-assistente', () => {
    expect(tokens).toMatch(/--assistant-chat-width:\s*calc\(470rem \/ 14\)/);
    expect(globais).toMatch(/--spacing-chat-assistente:\s*var\(--assistant-chat-width\)/);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/components/layout/menu-tela-assistente.test.ts src/styles/largura-assistente.test.ts`
Expected: FAIL (`telaRecolhida` não existe; token ausente).

- [ ] **Passo 3: `menu-tela.ts`**

Arquivo inteiro:

```ts
// Telas de três colunas abrem com o menu recolhido (spec 4.3; Assistente, 7C.3). Abrir o menu ali vale só até sair da tela (P17).
export function telaComMenuRecolhido(caminho: string): boolean {
  return caminho === '/atendimento' || caminho.startsWith('/atendimento/') || caminho === '/assistente';
}

/** Qual tela de menu recolhido está aberta: trocar de uma para a outra também esquece o "aberto aqui" (D13). */
export function telaRecolhida(caminho: string): string | null {
  return telaComMenuRecolhido(caminho) ? caminho.split('/')[1] ?? null : null;
}

export function menuRecolhidoVisivel(caminho: string, preferido: boolean, abertoNaTela: boolean): boolean {
  return telaComMenuRecolhido(caminho) ? !abertoNaTela : preferido;
}
```

- [ ] **Passo 4: `app-shell.tsx`**

1. No import de `./menu-tela`, acrescente `telaRecolhida`.
2. Troque

```tsx
  // Sair do Atendimento esquece o "aberto aqui": ao voltar, abre recolhido de novo (P17).
  useEffect(() => { if (!telaComMenuRecolhido(caminho)) setAbertoNaTela(false); }, [caminho]);
```

por

```tsx
  // Sair da tela (Atendimento ou Assistente) esquece o "aberto aqui": ao voltar, abre recolhido de novo (P17, D13).
  const tela = telaRecolhida(caminho);
  useEffect(() => { setAbertoNaTela(false); }, [tela]);
```

3. No comentário de `alternar`, troque "No Atendimento, abrir ou recolher vale só nesta tela" por "Nas telas de menu recolhido, abrir ou recolher vale só nesta tela". Se `telaComMenuRecolhido` deixar de ser usado no arquivo, o lint avisa: ele continua usado em `alternar`.

- [ ] **Passo 5: token e utilitário**

Em `apps/painel/src/styles/tokens.css`, logo depois da linha `--reading-width: …`:

```css
  --assistant-chat-width: calc(470rem / 14); /* conversa da tela Assistente, à esquerda do resultado (utilitário w-chat-assistente) */
```

Em `apps/painel/src/app/globals.css`, logo depois de `--spacing-leitura: var(--reading-width);`:

```css
  --spacing-chat-assistente: var(--assistant-chat-width);
```

- [ ] **Passo 6: rodar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/components/layout src/styles`
Expected: PASS (inclusive `menu-tela.test.ts`, `escala.test.ts` e `tokens.test.ts`, sem edição).

- [ ] **Passo 7: commit**

```bash
git add apps/painel/src/components/layout/menu-tela.ts apps/painel/src/components/layout/app-shell.tsx apps/painel/src/components/layout/menu-tela-assistente.test.ts apps/painel/src/styles/tokens.css apps/painel/src/app/globals.css apps/painel/src/styles/largura-assistente.test.ts
git commit -m "feat(painel): menu recolhido também no Assistente, com a regra do Atendimento, e largura da conversa como token

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Conversa enxuta, histórico em botões, VER AO LADO, abas, tabela e arquivos

**Files:**
- Modify: `assistente/page.tsx` (reescrito), `assistente/compositor-assistente.tsx`, `apps/painel/src/components/patterns/texto-formatado.tsx`
- Create: `assistente/conversa-com-resultado.tsx`, `assistente/chat-assistente.tsx`, `assistente/cartao-resultado.tsx`, `assistente/historico-em-botoes.tsx`, `assistente/hidratado.tsx`, `assistente/painel-resultado.tsx`, `assistente/painel-tabela.tsx`, `assistente/painel-arquivos.tsx`, `assistente/links-csv.tsx`
- Create: `apps/painel/e2e/apoio-assistente.ts`, `apps/painel/e2e/assistente-lado.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 3 e 4; `AtualizarAoVivo`, `Realce`, `HistoricoRolante`, `MessageBubble`, `EmptyState`, `AvisoErro`, `BlingExportButton`, `Skeleton`, `DropdownMenu*`, `variantesBotao`, `linhaDoTempo`, `formatarHora`, `formatarDataHora`, `temNivel`, `usaAssistente`, `perguntarAoAssistente` (sem mudança).
- Produces: `ProvedorAssistente` (agora cobre as duas colunas), `Sugestoes({ itens, className })`, `preencherCampo(el, texto)`, `usarCampoPergunta()`; `TabelaDoTexto({ tabela })`; `ConversaComResultado`, `EsqueletoTela`, `COLUNA_CHAT`; `ChatAssistente`; `CartaoResultado`; `HistoricoEmBotoes`; `Hidratado`; `PainelResultado` (pedido provisório até a Task 6); `PainelTabela`; `PainelArquivos`; `LinksCsv`; no e2e: `abrirAssistente`, `SENHA`, `PREFIXO`, `limparG4`, `semearPedido`, `conversaComAssistente`, `textoPrevia`, `TEXTO_TABELA`, `CSV`, `criarAna`.

- [ ] **Passo 1: escrever os e2e que falham**

`apps/painel/e2e/apoio-assistente.ts`:

```ts
import { expect, type Page } from '@playwright/test';
import { criarUsuarioTeste, db } from './apoio';

export const SENHA = 'Senha-e2e-123';
export const EMAIL_ANA = 'ana-g4@e2e.local';
export const PREFIXO = 'G4E2E';

/** Abre o Assistente e espera o navegador assumir a página (data-assistente-hidratado). Clicar antes disso perde a ação. */
export async function abrirAssistente(page: Page, consulta = ''): Promise<void> {
  await page.goto(`/assistente${consulta}`);
  await expect(page.locator('[data-assistente-hidratado]')).toHaveCount(1, { timeout: 30_000 });
}

/** Ana, do Fiscal, com o assistente pelo site e (por padrão) "Pedidos de nota: Corrigir e gerar". */
export function criarAna(permissoes = ['assistente_site', 'emitir_notas']): Promise<string> {
  return criarUsuarioTeste({ email: EMAIL_ANA, senha: SENHA, nome: 'Ana G4', papel: 'atendente', setores: ['Fiscal'], permissoes });
}

const corpo = (q: number, sub: string, total: string) => [
  'Destinatário: Rede Bom Preço / Unidade Centro',
  `• ${q} PAC Pão de queijo congelado 1kg (cód. 12) × R$ 18,50 = ${sub}`,
  '• 6 UN Bolo de fubá 400g (cód. 31) × R$ 14,00 = R$ 84,00',
  '• 4 PAC Biscoito de polvilho 200g (cód. 44) × R$ 6,90 = R$ 27,60',
  `Total: ${total}`,
  'Pagamento: Boleto 28 dias · Entrega: 03/10',
].join('\n');

/** A prévia no formato que o trabalhador escreve (descreverPedido): 10 → 15 PAC de pão de queijo. */
export function textoPrevia(numero: number | string, rodape = 'Nada foi gravado. Responda sim para gravar; o CSV sai em seguida.'): string {
  return `Prévia do pedido #${numero}:\nAntes:\n${corpo(10, 'R$ 185,00', 'R$ 296,60')}\nDepois:\n${corpo(15, 'R$ 277,50', 'R$ 389,10')}\n\n${rodape}`;
}

export const TEXTO_TABELA = [
  'São **4 pedidos** em aberto nos seus setores.', '', 'Pedidos em aberto:',
  '| Nº | Empresa | Total |', '|---|---|---|',
  '| #1 | Padaria Sol ME | R$ 389,10 |', '| #2 | Mercado Central | R$ 812,00 |', '| #3 | Rede Bom Preço | R$ 640,30 |', '| #4 | Padaria Sol ME | R$ 277,00 |',
].join('\n');

export const CSV = (chamados: string[], partes = 1, nome = 'bling-pedidos-teste.csv') => ({ tipo: 'csv_bling', chamados, nome, partes });

/** Apaga o que os testes da G4 criaram (demandas, contatos, empresas e setores com o prefixo). */
export async function limparG4(): Promise<void> {
  await db.from('chamados').delete().like('titulo', `${PREFIXO}%`);
  await db.from('contatos').delete().like('nome', `${PREFIXO}%`);
  await db.from('clientes').delete().like('razao_social', `${PREFIXO}%`);
  await db.from('setores').delete().like('nome', `${PREFIXO}%`);
}

/** Demanda de venda da Padaria (10 PAC no banco), aberta pelo agente pelo WhatsApp da Carla. O gatilho grava a 'criacao'. */
export async function semearPedido(setorNome = 'Fiscal') {
  await limparG4();
  let setor = (await db.from('setores').select('id').eq('nome', setorNome).maybeSingle()).data?.id as string | undefined;
  if (!setor) setor = (await db.from('setores').insert({ nome: setorNome, ativo: true }).select('id').single()).data!.id as string;
  const cliente = (await db.from('clientes').insert({ razao_social: `${PREFIXO} Padaria Sol ME`, cnpj: '41000000000101' }).select('id').single()).data!.id as string;
  const contato = (await db.from('contatos').insert({ nome: `${PREFIXO} Carla Mendes`, telefone: '5531940000001' }).select('id').single()).data!.id as string;
  const pedido = {
    unidade_id: null, texto_destinatario: 'Rede Bom Preço / Unidade Centro', data: '01/10/2026', data_prevista: '03/10/2026', forma_pagamento: 'Boleto 28 dias',
    valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null, entrega: null,
    itens: [
      { produto: 'Pão de queijo congelado 1kg', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 18.5 },
      { produto: 'Bolo de fubá 400g', sku: '31', un: 'UN', quantidade: 6, valor_unitario: 14 },
      { produto: 'Biscoito de polvilho 200g', sku: '44', un: 'PAC', quantidade: 4, valor_unitario: 6.9 },
    ],
  };
  const { data, error } = await db.from('chamados').insert({
    setor_id: setor, cliente_id: cliente, contato_id: contato, titulo: `${PREFIXO} NF de venda Padaria`, resumo: 'Venda E2E', pedido_venda: pedido, origem: 'agente',
  }).select('id, numero').single();
  if (error) throw error;
  return { id: data.id as string, numero: Number(data.numero), cliente, contato, pedido };
}

type ItemConversa = { papel: 'usuario' | 'assistente'; conteudo: string; min: number; arquivo?: object; pendente?: boolean };

/** Mensagens com o assistente, "min" minutos atrás (a resposta é semeada; nenhum trabalhador roda nos e2e). */
export async function conversaComAssistente(usuarioId: string, itens: ItemConversa[], conversaId: string | null = null): Promise<string[]> {
  const agora = Date.now();
  const { data, error } = await db.from('assistente_mensagens').insert(itens.map((i) => {
    const em = new Date(agora - i.min * 60_000).toISOString();
    return { usuario_id: usuarioId, canal: 'site', conversa_id: conversaId, papel: i.papel, conteudo: i.conteudo, arquivo: i.arquivo ?? null,
      processada_em: i.pendente ? null : em, criado_em: em };
  })).select('id');
  if (error) throw error;
  return (data ?? []).map((d) => d.id as string);
}
```

`apps/painel/e2e/assistente-lado.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import {
  abrirAssistente, conversaComAssistente, criarAna, CSV, EMAIL_ANA, limparG4, semearPedido, SENHA, TEXTO_TABELA, textoPrevia,
} from './apoio-assistente';

test.afterAll(limparG4);

test('menu recolhido e histórico em botões: Geral, as 2 conversas mais recentes e "+n" (D13, D14)', async ({ page }) => {
  const dono = await criarUsuarioTeste({ email: 'dono-g4@e2e.local', senha: SENHA, nome: 'Dono G4', papel: 'admin', permissoes: ['assistente_site'] });
  const telefones = ['5531940000101', '5531940000102', '5531940000103'];
  await db.from('conversas').delete().in('telefone', telefones);
  const ids: string[] = [];
  for (const [i, telefone] of telefones.entries()) {
    const { data: c } = await db.from('conversas').insert({ telefone }).select('id').single();
    ids.push(c!.id);
    await conversaComAssistente(dono, [{ papel: 'usuario', conteudo: `pergunta ${i}`, min: 30 - i }], c!.id);
  }
  try {
    await entrar(page, 'dono-g4@e2e.local', SENHA);
    await abrirAssistente(page);
    await expect(page.locator('[data-recolhido]')).toHaveCount(1);
    const historico = page.getByRole('navigation', { name: 'Histórico do assistente' });
    await expect(historico.getByRole('link', { name: 'Geral' })).toHaveAttribute('aria-current', 'page');
    await expect(historico.getByRole('link')).toHaveCount(3);                       // Geral + as 2 mais recentes
    await historico.getByRole('button', { name: '+1 conversas' }).click();
    await page.getByRole('menuitem').click();                                        // a mais antiga, no "+n"
    await expect(page).toHaveURL(new RegExp(`conversa=${ids[0]}`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Assistente ·');
    await expect(page.getByRole('link', { name: 'Abrir no Atendimento' })).toBeVisible();
  } finally {
    await db.from('conversas').delete().in('telefone', telefones);
  }
});

test('tabela e prévia saem do balão e abrem ao lado, com abas (D8, D9)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: 'quais pedidos de nota estão em aberto?', min: 9 },
    { papel: 'assistente', conteudo: TEXTO_TABELA, min: 8 },
    { papel: 'usuario', conteudo: `o pedido ${p.numero} era 15 PAC, corrige e me manda o CSV`, min: 2 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },
  ]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);

  const conversa = page.getByTestId('mensagens-assistente');
  await expect(conversa.getByText(`Prévia #${p.numero} · 1 alteração`)).toBeVisible();
  await expect(conversa.getByText('Tabela · 4 linhas')).toBeVisible();
  await expect(conversa).not.toContainText('R$ 277,50');                          // a prévia não está no balão
  await expect(conversa).not.toContainText('Mercado Central');                    // nem a tabela

  const resultado = page.getByRole('region', { name: 'Resultado' });
  const abas = resultado.getByRole('navigation', { name: 'Resultados desta conversa' });
  await expect(abas.getByRole('link', { name: `Pedido #${p.numero}` })).toHaveAttribute('aria-current', 'page');
  await expect(abas.getByRole('link', { name: /Pedidos em aberto/ })).toBeVisible();
  await expect(resultado).toContainText('antes: 10 PAC');                           // o pedido aberto por padrão

  await conversa.getByRole('link', { name: 'Ver ao lado: Tabela · 4 linhas' }).click();
  await expect(page).toHaveURL(/resultado=tabela-/);
  await expect(resultado.getByRole('heading', { name: 'Pedidos em aberto' })).toBeVisible();
  await expect(resultado.getByRole('row')).toHaveCount(5);                          // cabeçalho + 4
  await expect(abas.getByRole('link', { name: /Pedidos em aberto/ })).toHaveAttribute('aria-current', 'page');
});

test('arquivo: cartão na conversa com os links de hoje e aba Arquivos (n) ao lado; sem "Corrigir e gerar", nada (D12)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  const [, id] = await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: 'gera o CSV', min: 3 },
    { papel: 'assistente', conteudo: 'Pronto, gerei o CSV.', min: 2, arquivo: CSV([p.id], 2) },
  ]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const conversa = page.getByTestId('mensagens-assistente');
  await expect(conversa.getByRole('link', { name: 'Baixar CSV Bling (parte 1)' })).toHaveAttribute('href', `/api/csv-bling?assistente=${id}&parte=1`);
  const resultado = page.getByRole('region', { name: 'Resultado' });
  await expect(resultado.getByRole('link', { name: 'Arquivos (1)' })).toHaveAttribute('aria-current', 'page');
  await expect(resultado.getByRole('link', { name: 'Baixar CSV Bling · parte 2 de 2' })).toHaveAttribute('href', `/api/csv-bling?assistente=${id}&parte=2`);

  await criarAna(['assistente_site']);
  const ana2 = (await db.from('usuarios').select('id').eq('email', EMAIL_ANA).single()).data!.id as string;
  await conversaComAssistente(ana2, [{ papel: 'assistente', conteudo: 'Pronto, gerei o CSV.', min: 2, arquivo: CSV([p.id]) }]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await expect(page.getByRole('link', { name: /CSV Bling/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Arquivos/ })).toHaveCount(0);
});

test('sem resultados: o lado diz onde aparecem; sugestões sempre acima do campo e só preenchem (D15)', async ({ page }) => {
  await criarAna();
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await expect(page.getByRole('region', { name: 'Resultado' }).getByText('Os resultados aparecem aqui')).toBeVisible();
  await page.getByRole('list', { name: 'Sugestões de perguntas' }).getByRole('button').first().click();
  await expect(page.getByPlaceholder('Pergunte ao assistente')).not.toHaveValue('');
  await expect(page.getByText('Pensando…')).toHaveCount(0);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run (com o Supabase local nas portas 563xx): `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/assistente-lado.spec.ts`
Expected: FAIL (`data-assistente-hidratado` não existe; sem região "Resultado").

- [ ] **Passo 3: compositor e texto formatado**

Em `assistente/compositor-assistente.tsx`:
1. Acrescente, logo depois de `ProvedorAssistente`:

```tsx
/** Campo da pergunta da tela (as sugestões e o "Mudar outra coisa" escrevem nele). */
export function usarCampoPergunta() {
  return useContext(Contexto);
}

/** Põe o texto no campo para a pessoa revisar: não envia. */
export function preencherCampo(el: HTMLTextAreaElement, texto: string) {
  el.value = texto;
  conferirTamanho(el);
  el.focus();
  el.setSelectionRange(texto.length, texto.length);
}
```

2. Troque a assinatura de `Sugestoes` por `export function Sugestoes({ itens, className }: { itens: string[]; className?: string })`, o `className` do `ul` por `className={cn('flex flex-wrap justify-center gap-2', className)}` e o corpo do `onClick` por:

```tsx
            onClick={() => {
              const el = campo?.current;
              if (el) preencherCampo(el, s);
            }}
```

(`conferirTamanho` é `function` declarada mais abaixo no arquivo: o hoisting cobre o uso.)

Em `apps/painel/src/components/patterns/texto-formatado.tsx`, extraia a tabela para um componente exportado (o mesmo JSX de hoje) e use-o dentro de `TextoFormatado`:

```tsx
/** Tabela do texto do assistente (cabeçalho, colunas numéricas à direita). Também usada no painel de resultado. */
export function TabelaDoTexto({ tabela }: { tabela: { cabecalho: string[]; linhas: string[][] } }) {
  const numerica = colunasNumericas(tabela);
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface">
      <Table className="text-sm">
        <TableHeader className="bg-surface-muted">
          <TableRow className="hover:bg-transparent">
            {tabela.cabecalho.map((c, n) => <TableHead key={n} className={cn('h-8', numerica[n] && 'text-right')}><Trechos texto={c} /></TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tabela.linhas.map((l, r) => (
            <TableRow key={r}>
              {l.map((c, n) => (
                <TableCell key={n} className={cn('h-8 py-1.5', numerica[n] && 'tabular whitespace-nowrap text-right')}><Trechos texto={c} /></TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

e, no `map` de `TextoFormatado`, o último `return` (o da tabela) vira `return <TabelaDoTexto key={i} tabela={b} />;`.

- [ ] **Passo 4: peças da conversa**

`assistente/hidratado.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';

/** Marca que o navegador assumiu a página (os e2e esperam por ela antes de clicar). */
export function Hidratado() {
  const [pronto, setPronto] = useState(false);
  useEffect(() => setPronto(true), []);
  return <span hidden data-assistente-hidratado={pronto ? '' : undefined} />;
}
```

`assistente/links-csv.tsx`:

```tsx
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import type { ArquivoBling } from '@/lib/resultados-assistente';

/**
 * Links do CSV do Bling de uma resposta (rota /api/csv-bling?assistente=&parte=, que confere a permissão de novo).
 * Na conversa, os nomes de hoje; no painel, "· parte i de n" (D12: o e2e de hoje procura "(parte N)" e não pode achar dois).
 */
export function LinksCsv({ mensagemId, arquivo, onde, variante = 'outline' }: {
  mensagemId: string; arquivo: ArquivoBling; onde: 'conversa' | 'painel'; variante?: 'primary' | 'outline' | 'link';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: arquivo.partes }, (_, i) => {
        const parte = i + 1;
        const rotulo = arquivo.partes === 1 ? 'Baixar CSV Bling'
          : onde === 'conversa' ? `Baixar CSV Bling (parte ${parte})` : `Baixar CSV Bling · parte ${parte} de ${arquivo.partes}`;
        return <BlingExportButton key={parte} href={`/api/csv-bling?assistente=${mensagemId}&parte=${parte}`} rotulo={rotulo} variante={variante} />;
      })}
    </div>
  );
}
```

`assistente/cartao-resultado.tsx`:

```tsx
import { ArrowRight, FileSpreadsheet, GitCompare, Table2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { Cartao } from '@/lib/resultados-assistente';
import { LinksCsv } from './links-csv';

const ESTILO: Record<Cartao['tipo'], { Icone: typeof Table2; faixa: string }> = {
  pedido: { Icone: GitCompare, faixa: 'border-l-warning-decor bg-warning-soft' },
  tabela: { Icone: Table2, faixa: 'border-l-info bg-info-soft' },
  arquivo: { Icone: FileSpreadsheet, faixa: 'border-l-success bg-success-soft' },
};

/** Cartão "VER AO LADO" no balão (D8): o conteúdo grande abre no painel de resultado. O arquivo traz também os links. */
export function CartaoResultado({ cartao, href, ativo }: { cartao: Cartao; href: string; ativo: boolean }) {
  const e = ESTILO[cartao.tipo];
  return (
    <div className={cn('flex flex-col gap-2 rounded-md border border-l-4 border-border px-2.5 py-2 text-sm', e.faixa)}>
      <div className="flex items-center gap-2.5">
        <e.Icone aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-foreground">{cartao.rotulo}</span>
        <Link
          href={href}
          scroll={false}
          aria-current={ativo ? 'true' : undefined}
          aria-label={`Ver ao lado: ${cartao.rotulo}`}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-brand underline-offset-4 hover:underline"
        >
          Ver ao lado
          <ArrowRight aria-hidden size={14} strokeWidth={2} />
        </Link>
      </div>
      {cartao.tipo === 'arquivo' && <LinksCsv mensagemId={cartao.mensagemId} arquivo={cartao.arquivo} onde="conversa" variante="link" />}
    </div>
  );
}
```

`assistente/chat-assistente.tsx`:

```tsx
import { Sparkles } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { HistoricoRolante } from '@/components/patterns/historico-rolante';
import { MessageBubble } from '@/components/patterns/message-bubble';
import { TextoFormatado } from '@/components/patterns/texto-formatado';
import { linhaDoTempo } from '@/lib/historico';
import { hrefResultado, type MensagemTela, type Pedaco } from '@/lib/resultados-assistente';
import { Realce } from '../atendimento/realce';
import { CartaoResultado } from './cartao-resultado';

const VAZIO = 'Pergunte sobre demandas, pedidos, vendas ou peça para corrigir um pedido e gerar o CSV do Bling.';

/**
 * Conversa enxuta da tela do Assistente (spec 7C.3): a resposta mostra só o texto em volta; prévia, tabela e arquivo
 * viram cartões VER AO LADO (D8). Mesma rolagem, realce e "Pensando…" de antes.
 */
export function ChatAssistente({ mensagens, respostas, conversaId, selecionada }: {
  mensagens: MensagemTela[]; respostas: Map<string, Pedaco[]>; conversaId: string | null; selecionada: string | null;
}) {
  const pensando = mensagens.some((m) => m.papel === 'usuario' && !m.processada_em);
  const linhas = linhaDoTempo(mensagens);
  return (
    <Realce chave={`assistente-${conversaId ?? 'geral'}`} lembrar={false} className="flex min-h-0 flex-1 flex-col">
      <HistoricoRolante
        como="ul"
        compositor="[data-compositor-assistente]"
        testId="mensagens-assistente"
        className="flex min-h-0 flex-1 flex-col"
        rotulo="Conversa com o assistente"
        ultima={`${mensagens.at(-1)?.id ?? ''}-${pensando}`}
        classNameLista="flex min-h-0 flex-1 flex-col gap-3 bg-background px-4 py-4 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {linhas.map((l) => {
          if (l.tipo === 'dia') {
            return (
              <li key={l.chave} className="flex items-center gap-3 text-xs font-medium text-subtle">
                <span aria-hidden className="h-px flex-1 bg-border" />
                {l.rotulo}
                <span aria-hidden className="h-px flex-1 bg-border" />
              </li>
            );
          }
          const m = l.item;
          if (m.papel === 'usuario') {
            return (
              <li key={l.chave} data-realce={m.criado_em} data-realce-proprio="" className="flex flex-col rounded-lg">
                <MessageBubble autor="pessoa" hora={m.criado_em} conteudo={m.conteudo} />
              </li>
            );
          }
          const pedacos = respostas.get(m.id) ?? [{ tipo: 'texto' as const, texto: m.conteudo }];
          return (
            <li key={l.chave} data-realce={m.criado_em} className="flex flex-col rounded-lg">
              <MessageBubble autor="assistente" hora={m.criado_em}>
                <div className="flex flex-col gap-2">
                  {pedacos.map((p, i) => (p.tipo === 'texto'
                    ? <TextoFormatado key={i} texto={p.texto} />
                    : <CartaoResultado key={i} cartao={p.cartao} href={hrefResultado(conversaId, p.cartao.chave)} ativo={p.cartao.chave === selecionada} />))}
                </div>
              </MessageBubble>
            </li>
          );
        })}
        {pensando && (
          <li role="status" className="mr-auto flex items-center gap-2 rounded-lg bg-assistant-soft px-3 py-2 text-sm font-medium text-assistant">
            <Sparkles aria-hidden size={16} strokeWidth={1.75} className="shrink-0 animate-pulse" />
            Pensando…
          </li>
        )}
        {mensagens.length === 0 && (
          <li className="my-auto">
            <EmptyState icone={Sparkles} titulo={conversaId ? 'Pergunte sobre esta conversa' : 'Como posso ajudar?'} descricao={VAZIO} />
          </li>
        )}
      </HistoricoRolante>
    </Realce>
  );
}
```

`assistente/historico-em-botoes.tsx`:

```tsx
'use client';

import { ChevronDown, History, MessageCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { formatarDataHora } from '@/lib/formatos';
import type { ConversaDoHistorico } from './dados-assistente';

const VISIVEIS = 2;

function Botao({ href, ativo, Icone, titulo, detalhe }: { href: string; ativo: boolean; Icone: typeof Sparkles; titulo: string; detalhe: string }) {
  return (
    <Link
      href={href}
      title={detalhe}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 max-w-48 items-center gap-1.5 rounded-md border px-2.5 text-sm font-bold transition-colors duration-150 ease-out',
        ativo ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-input bg-surface text-foreground hover:bg-surface-muted',
      )}
    >
      <Icone aria-hidden size={14} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{titulo}</span>
    </Link>
  );
}

/** Histórico em botões no topo da conversa (D14): Geral, as 2 conversas mais recentes (a aberta sempre aparece) e "+n". */
export function HistoricoEmBotoes({ conversaId, ultimaGeral, conversas }: { conversaId: string | null; ultimaGeral: string | null; conversas: ConversaDoHistorico[] }) {
  const visiveis = conversas.slice(0, VISIVEIS);
  const aberta = conversaId ? conversas.find((c) => c.id === conversaId) : undefined;
  if (aberta && !visiveis.includes(aberta)) visiveis.splice(VISIVEIS - 1, 1, aberta);
  const resto = conversas.filter((c) => !visiveis.includes(c));
  const detalhe = (c: ConversaDoHistorico) => `${c.empresa ?? 'Empresa não definida'} · ${c.mensagens === 1 ? '1 mensagem recente' : `${c.mensagens} mensagens recentes`}`;
  return (
    <nav aria-label="Histórico do assistente">
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          <Botao href="/assistente" ativo={!conversaId} Icone={Sparkles} titulo="Geral"
            detalhe={ultimaGeral ? `Suas perguntas pela tela Assistente · última em ${formatarDataHora(ultimaGeral)}` : 'Suas perguntas pela tela Assistente'} />
        </li>
        {visiveis.map((c) => (
          <li key={c.id}>
            <Botao href={`/assistente?conversa=${c.id}`} ativo={c.id === conversaId} Icone={MessageCircle} titulo={c.nome} detalhe={detalhe(c)} />
          </li>
        ))}
        {resto.length > 0 && (
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="normal-case">
                  <History aria-hidden size={14} strokeWidth={2} />
                  +{resto.length}<span className="sr-only"> conversas</span>
                  <ChevronDown aria-hidden size={14} strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                {resto.map((c) => (
                  <DropdownMenuItem key={c.id} asChild>
                    <Link href={`/assistente?conversa=${c.id}`} className="flex flex-col items-start gap-0.5">
                      <span className="font-medium text-foreground">{c.nome}</span>
                      <span className="text-xs text-muted">{detalhe(c)}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </ul>
    </nav>
  );
}
```

- [ ] **Passo 5: painel de resultado (tabela, arquivos; pedido provisório)**

`assistente/painel-tabela.tsx`:

```tsx
import { TabelaDoTexto } from '@/components/patterns/texto-formatado';
import { formatarHora } from '@/lib/formatos';
import type { ResultadoTabela } from '@/lib/resultados-assistente';

export function PainelTabela({ resultado }: { resultado: ResultadoTabela }) {
  return (
    <article aria-labelledby="titulo-tabela" className="rounded-lg border border-border bg-surface">
      <header className="border-b border-border px-5 py-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-brand">Tabela · resposta das {formatarHora(resultado.em)}</p>
        <h3 id="titulo-tabela" className="text-2xl font-light text-foreground">{resultado.titulo}</h3>
      </header>
      <div className="p-4"><TabelaDoTexto tabela={resultado.tabela} /></div>
    </article>
  );
}
```

`assistente/painel-arquivos.tsx`:

```tsx
import { FileSpreadsheet } from 'lucide-react';
import { formatarData, formatarHora } from '@/lib/formatos';
import type { ResultadoArquivos } from '@/lib/resultados-assistente';
import { LinksCsv } from './links-csv';

const quando = (iso: string) => (formatarData(iso) === formatarData(new Date()) ? formatarHora(iso) : `${formatarData(iso).slice(0, 5)} ${formatarHora(iso)}`);

/** Arquivos do Bling desta conversa, do mais novo para o mais antigo (só para quem tem "Corrigir e gerar"). */
export function PainelArquivos({ resultado }: { resultado: ResultadoArquivos }) {
  return (
    <article aria-labelledby="titulo-arquivos" className="rounded-lg border border-border bg-surface px-5 py-4">
      <h3 id="titulo-arquivos" className="mb-2 text-xs font-extrabold uppercase tracking-widest text-brand">Arquivos para o Bling</h3>
      <ul className="divide-y divide-border">
        {resultado.arquivos.map((a) => {
          const n = a.arquivo.chamados.length;
          return (
            <li key={a.mensagemId} className="flex flex-wrap items-center gap-3 py-3">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-success-soft text-success">
                <FileSpreadsheet size={20} strokeWidth={1.75} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold text-foreground">{a.arquivo.nome}</span>
                <span className="block text-sm text-muted">{n === 1 ? '1 pedido' : `${n} pedidos`} · gerado {quando(a.em)}</span>
              </span>
              <LinksCsv mensagemId={a.mensagemId} arquivo={a.arquivo} onde="painel" variante="primary" />
            </li>
          );
        })}
      </ul>
    </article>
  );
}
```

`assistente/painel-resultado.tsx`:

```tsx
import { FileSpreadsheet, PanelRight, Receipt, Table2 } from 'lucide-react';
import Link from 'next/link';
import { DiffPreview } from '@/components/patterns/diff-preview';
import { EmptyState } from '@/components/patterns/empty-state';
import { cn } from '@/lib/cn';
import type { LadoPrevia } from '@/lib/previa-pedido';
import { abasVisiveis, hrefResultado, type LeituraConversa, type Resultado } from '@/lib/resultados-assistente';
import { PainelArquivos } from './painel-arquivos';
import { PainelTabela } from './painel-tabela';

const ICONE = { pedido: Receipt, tabela: Table2, arquivos: FileSpreadsheet } as const;

// Provisório (Task 6 troca pelo painel do pedido): reescreve o lado da prévia para o DiffPreview de hoje.
const ladoComoTexto = (l: LadoPrevia) =>
  l.linhas.map((x) => (x.tipo === 'item' ? `• ${x.item.texto}` : x.tipo === 'campo' ? `${x.campo.rotulo}: ${x.campo.valor}` : x.texto)).join('\n');

function Abas({ abas, selecionada, conversaId }: { abas: Resultado[]; selecionada: string; conversaId: string | null }) {
  return (
    <nav aria-label="Resultados desta conversa" className="flex items-end gap-2 border-b border-border">
      <ul className="flex min-w-0 flex-1 flex-wrap">
        {abas.map((r) => {
          const Icone = ICONE[r.tipo];
          const ativa = r.chave === selecionada;
          const contagem = r.tipo === 'arquivos' ? r.arquivos.length : r.tipo === 'tabela' ? r.tabela.linhas.length : null;
          return (
            <li key={r.chave}>
              <Link
                href={hrefResultado(conversaId, r.chave)}
                scroll={false}
                aria-current={ativa ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide',
                  ativa ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-foreground',
                )}
              >
                <Icone aria-hidden size={16} strokeWidth={1.75} />
                {r.tipo === 'tabela' ? r.titulo : r.rotulo}
                {contagem !== null && (
                  <>
                    <span aria-hidden className="rounded-full bg-surface-muted px-1.5 text-xs text-foreground">{contagem}</span>
                    <span className="sr-only">({contagem})</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <span className="hidden pb-2.5 text-sm text-subtle xl:inline">resultados desta conversa</span>
    </nav>
  );
}

/** Painel de resultado à direita (spec 7C.3): abas com o que as respostas desta conversa trouxeram. */
export function PainelResultado({ leitura, selecionado, conversaId }: { leitura: LeituraConversa; selecionado: Resultado | null; conversaId: string | null }) {
  return (
    <section aria-label="Resultado" className="flex min-w-0 flex-1 flex-col gap-4 bg-background p-4 lg:overflow-y-auto lg:px-6">
      {!selecionado ? (
        <EmptyState
          icone={PanelRight}
          titulo="Os resultados aparecem aqui"
          descricao="Prévias de pedido, tabelas e arquivos desta conversa abrem deste lado quando você clica em VER AO LADO."
          className="my-auto"
        />
      ) : (
        <>
          <Abas abas={abasVisiveis(leitura, selecionado.chave)} selecionada={selecionado.chave} conversaId={conversaId} />
          {/* Provisório: a Task 6 troca este bloco pelo painel do pedido. */}
          {selecionado.tipo === 'pedido' && (
            <article aria-label={selecionado.rotulo} className="rounded-lg border border-border bg-surface p-4">
              <DiffPreview texto={`Antes:\n${ladoComoTexto(selecionado.previa.antes)}\nDepois:\n${ladoComoTexto(selecionado.previa.depois)}`} />
            </article>
          )}
          {selecionado.tipo === 'tabela' && <PainelTabela resultado={selecionado} />}
          {selecionado.tipo === 'arquivos' && <PainelArquivos resultado={selecionado} />}
        </>
      )}
    </section>
  );
}
```

(o `DiffPreview` escreve "(antes: 10 PAC)": o e2e da Task 5 procura `antes: 10 PAC`, que está contido.)

- [ ] **Passo 6: conversa + resultado e a página**

`assistente/conversa-com-resultado.tsx`:

```tsx
import type { ReactNode } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { Skeleton } from '@/components/ui/skeleton';
import { temNivel } from '@/lib/permissoes';
import { escolherResultado, lerConversa } from '@/lib/resultados-assistente';
import type { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { perguntarAoAssistente } from './acoes';
import { ChatAssistente } from './chat-assistente';
import { CompositorAssistente, Sugestoes } from './compositor-assistente';
import { lerMensagensAssistente } from './dados-assistente';
import { PainelResultado } from './painel-resultado';

type Usuario = Awaited<ReturnType<typeof obterUsuario>>;

export const COLUNA_CHAT = 'flex min-w-0 flex-col bg-surface max-lg:altura-trabalho lg:w-chat-assistente lg:shrink-0 lg:border-r lg:border-border';
const SUGESTOES_GERAL = ['Quais pedidos de nota estão em aberto?', 'Quanto vendemos neste mês?', 'Quais demandas estão aguardando o cliente?'];
const SUGESTOES_CONVERSA = ['Faça um resumo desta conversa', 'O que o cliente está pedindo?', 'Há pedido de nota nesta conversa?'];

/** As duas colunas da tela: a conversa enxuta e o painel de resultado, das mesmas mensagens (uma leitura só). */
export async function ConversaComResultado({ usuario, conversaId, chave, cabecalho, erro }: {
  usuario: Usuario; conversaId: string | null; chave: string | null; cabecalho: ReactNode; erro?: string;
}) {
  const sb = await supabaseServidor();
  // O CSV só para quem pode gerá-lo (emitir_notas; o administrador sempre pode), como antes.
  const podeCsv = temNivel(usuario, 'notas', 'corrigir');
  const mensagens = await lerMensagensAssistente(sb, usuario.id, conversaId);
  const leitura = lerConversa(mensagens, podeCsv);
  const selecionado = escolherResultado(leitura, chave);
  return (
    <>
      <section aria-labelledby="titulo-assistente" className={COLUNA_CHAT}>
        {cabecalho}
        <div className="px-4 empty:hidden"><AvisoErro erro={erro} limparDaUrl /></div>
        <ChatAssistente mensagens={mensagens} respostas={leitura.respostas} conversaId={conversaId} selecionada={selecionado?.chave ?? null} />
        <div className="flex flex-col gap-2 border-t border-border p-4">
          <Sugestoes itens={conversaId ? SUGESTOES_CONVERSA : SUGESTOES_GERAL} className="justify-start" />
          <CompositorAssistente acao={perguntarAoAssistente.bind(null, conversaId)} />
        </div>
      </section>
      <PainelResultado leitura={leitura} selecionado={selecionado} conversaId={conversaId} />
    </>
  );
}

export function EsqueletoTela({ cabecalho }: { cabecalho: ReactNode }) {
  return (
    <>
      <section aria-labelledby="titulo-assistente" className={COLUNA_CHAT}>
        {cabecalho}
        <div aria-hidden className="flex flex-1 flex-col gap-3 bg-background p-4">
          <Skeleton className="ml-auto h-10 w-1/2 rounded-lg" />
          <Skeleton className="h-20 w-3/4 rounded-lg" />
          <Skeleton className="ml-auto h-10 w-2/5 rounded-lg" />
          <Skeleton className="mt-auto h-24 w-full rounded-lg" />
        </div>
      </section>
      <div aria-hidden className="flex flex-1 flex-col gap-4 bg-background p-6">
        <Skeleton className="h-10 w-2/3 rounded-md" />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </>
  );
}
```

`assistente/page.tsx` (reescrito):

```tsx
import { ExternalLink, SearchX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { EmptyState } from '@/components/patterns/empty-state';
import { variantesBotao } from '@/components/ui/button';
import { lerConversaAssistente } from '@/lib/conversas-assistente';
import { usaAssistente } from '@/lib/permissoes';
import { lerChaveResultado } from '@/lib/resultados-assistente';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { ProvedorAssistente } from './compositor-assistente';
import { COLUNA_CHAT, ConversaComResultado, EsqueletoTela } from './conversa-com-resultado';
import { lerHistoricoAssistente } from './dados-assistente';
import { HistoricoEmBotoes } from './historico-em-botoes';
import { Hidratado } from './hidratado';

/**
 * Assistente, Opção B "Conversa + resultado" (spec 7C.3): conversa enxuta à esquerda, resultado com abas à direita.
 * As regras do assistente não mudam: a tela só lê as mensagens e a pergunta continua indo por perguntarAoAssistente.
 */
export default async function Assistente({ searchParams }: { searchParams: Promise<{ erro?: string; conversa?: string | string[]; resultado?: string | string[] }> }) {
  const u = await obterUsuario();
  if (!usaAssistente(u)) redirect('/inicio');
  const sp = await searchParams;
  const conversaId = lerConversaAssistente(sp.conversa);
  const chave = lerChaveResultado(sp.resultado);
  const sb = await supabaseServidor();
  const historico = await lerHistoricoAssistente(sb, u.id, conversaId);
  const aberta = historico.aberta;

  const cabecalho = (
    <header className="flex flex-col gap-3 border-b border-border px-4 pb-3 pt-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 id="titulo-assistente" className="min-w-0 truncate text-2xl font-light text-foreground">
          Assistente · <span className="font-extrabold text-brand">{aberta ? aberta.nome : 'Geral'}</span>
        </h1>
        {aberta && (
          <Link href={`/atendimento/${aberta.id}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
            <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
            Abrir no Atendimento
          </Link>
        )}
      </div>
      {aberta && (
        <p className="text-sm text-muted">{aberta.empresa ? `${aberta.empresa} · ` : ''}O assistente conhece este cliente e as demandas desta conversa.</p>
      )}
      <HistoricoEmBotoes conversaId={conversaId} ultimaGeral={historico.ultimaGeral} conversas={historico.conversas} />
    </header>
  );

  return (
    <ProvedorAssistente>
      <div className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
        <AtualizarAoVivo assistenteDe={u.id} />
        <Hidratado />
        {conversaId && !aberta ? (
          <section aria-labelledby="titulo-assistente" className={COLUNA_CHAT}>
            {cabecalho}
            <div className="px-4"><AvisoErro erro={sp.erro} limparDaUrl /></div>
            <EmptyState
              icone={SearchX}
              titulo="Conversa não encontrada"
              descricao="Ela pode ter sido apagada ou não estar mais nos seus setores."
              acao={<Link href="/assistente" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Voltar para a Geral</Link>}
              className="my-auto"
            />
          </section>
        ) : (
          <Suspense key={conversaId ?? 'geral'} fallback={<EsqueletoTela cabecalho={cabecalho} />}>
            <ConversaComResultado usuario={u} conversaId={conversaId} chave={chave} cabecalho={cabecalho} erro={sp.erro} />
          </Suspense>
        )}
      </div>
    </ProvedorAssistente>
  );
}
```

Antes de rodar, confira os textos que outros testes procuram: `grep -rn "Histórico do assistente\|titulo-historico\|Conversas\b" apps/painel/e2e apps/painel/src` — o `aside` "Conversas" sai; nenhum e2e deve depender dele (se algum depender, pare e avise: e2e de parte anterior não pode ser editado).

- [ ] **Passo 7: rodar**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && supabase db reset && cd apps/painel && pnpm exec playwright test e2e/assistente-lado.spec.ts e2e/assistente.spec.ts e2e/revisao-final.spec.ts e2e/acessibilidade.spec.ts`
Expected: tudo verde. `assistente.spec.ts` e `revisao-final.spec.ts` **sem edição** (os links "(parte N)" estão só na conversa; o painel usa "· parte i de n").

- [ ] **Passo 8: commit**

```bash
git add apps/painel
git commit -m "feat(painel): Assistente em conversa + resultado — histórico em botões, cartões VER AO LADO, abas, tabela e arquivos ao lado

O cabeçalho com o histórico em botões substitui a coluna Conversas; a caixa do Atendimento não muda.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Painel do pedido. Dados, "O que mudou", total, selo, arquivo, histórico e Abrir demanda

**Files:**
- Create: `assistente/painel-pedido.tsx`, `assistente/historico-pedido.tsx`, `apps/painel/e2e/assistente-pedido.spec.ts`
- Modify: `assistente/painel-resultado.tsx` (tira o bloco provisório), `assistente/conversa-com-resultado.tsx` (lê a demanda do pedido aberto)

**Interfaces:**
- Consumes: Tasks 1–3 e 5; `LinksCsv`; `variantesBotao`; `formatarHora`.
- Produces: `PainelPedido({ resultado, leituraDemanda, leitura, mensagens, usuario, podeCsv, rodape })` (o `rodape` é onde a Task 7 põe os botões); `HistoricoPedido({ marcos, agora })`; `PainelResultado` passa a receber `leituraDemanda`, `mensagens`, `usuario`, `podeCsv`, `rodapePedido`.

- [ ] **Passo 1: escrever o e2e que falha**

`apps/painel/e2e/assistente-pedido.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { db, entrar } from './apoio';
import { abrirAssistente, conversaComAssistente, criarAna, CSV, EMAIL_ANA, limparG4, PREFIXO, semearPedido, SENHA, textoPrevia } from './apoio-assistente';

test.afterAll(limparG4);

test('painel do pedido: dados da prévia (não do banco), origem, "O que mudou" e total antes/depois (D2, D3)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();                                    // no banco: 10 PAC
  await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: `o ${p.numero} era 15 PAC`, min: 2 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },  // a prévia: 15 PAC
  ]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const r = page.getByRole('region', { name: 'Resultado' });
  await expect(r.getByRole('heading', { name: `Pedido #${p.numero} · ${PREFIXO} Padaria Sol ME` })).toBeVisible();
  await expect(r.getByText('Nota de venda · Setor Fiscal')).toBeVisible();
  for (const t of ['Rede Bom Preço', 'Unidade Centro', 'Boleto 28 dias', '03/10', 'endereço do cadastro', `${PREFIXO} Carla Mendes`]) {
    await expect(r.getByText(t, { exact: true })).toBeVisible();
  }
  await expect(r.getByText(/^WhatsApp · \d{2}\/\d{2}$/)).toBeVisible();
  const linha = r.getByRole('row').filter({ hasText: 'Pão de queijo congelado 1kg' });
  await expect(linha).toContainText('Alterado');
  await expect(linha).toContainText('15 PAC');
  await expect(linha).toContainText('antes: 10 PAC');
  await expect(linha).toContainText('antes: R$ 185,00');
  await expect(r.getByRole('row').filter({ hasText: 'Total do pedido' })).toContainText(/R\$ 389,10\s*antes: R\$ 296,60/);
  await expect(r.getByRole('link', { name: 'Abrir demanda' })).toHaveAttribute('href', `/demandas?demanda=${p.id}`);
  await expect(r.getByText(/Gravado às/)).toHaveCount(0);
  await expect(r.getByRole('region', { name: 'Arquivo para o Bling' })).toContainText('Depois de gravar, peça ao assistente o CSV do Bling deste pedido.');
  await expect(r.getByRole('region', { name: 'Histórico do pedido' })).toContainText(`Agente abriu o pedido pelo WhatsApp de ${PREFIXO} Carla Mendes`);
  await expect(r.getByRole('region', { name: 'Histórico do pedido' })).toContainText('Prévia mostrada a Ana');
});

test('depois do "sim": selo "Gravado às HH:MM por <pessoa>", arquivo do pedido e histórico (D4, D5)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  const [, , , idArquivo] = await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: `o ${p.numero} era 15 PAC, corrige e manda o CSV`, min: 5 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 4 },
    { papel: 'usuario', conteudo: 'sim', min: 3 },
    { papel: 'assistente', conteudo: `Feito: pedido #${p.numero} gravado. CSV do Bling pronto.`, min: 1, arquivo: CSV([p.id], 1, `bling-pedidos-${p.numero}.csv`) },
  ]);
  // A nota que o trabalhador grava ao gravar a correção (assistente/ferramentas.ts).
  await db.from('chamado_eventos').insert({ chamado_id: p.id, cliente_id: p.cliente, tipo: 'nota_interna', usuario_id: ana,
    texto: 'Pedido alterado pelo assistente a pedido de Ana G4.\nAntes:\n…\nDepois:\n…', criado_em: new Date(Date.now() - 2 * 60_000).toISOString() });
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const r = page.getByRole('region', { name: 'Resultado' });
  await expect(r.getByRole('link', { name: `Pedido #${p.numero}` })).toHaveAttribute('aria-current', 'page');   // o pedido abre, não Arquivos (D9)
  await expect(r.getByText(/^Gravado às \d{2}:\d{2} por Ana G4$/)).toBeVisible();
  const arquivo = r.getByRole('region', { name: 'Arquivo para o Bling' });
  await expect(arquivo).toContainText(`bling-pedidos-${p.numero}.csv`);
  await expect(arquivo).toContainText('1 pedido · gerado');
  await expect(arquivo.getByRole('link', { name: 'Baixar CSV Bling' })).toHaveAttribute('href', `/api/csv-bling?assistente=${idArquivo}&parte=1`);
  const historico = r.getByRole('region', { name: 'Histórico do pedido' });
  await expect(historico).toContainText('Ana G4 gravou a correção pelo assistente');
  await expect(historico).toContainText('CSV do Bling gerado');
  await expect(historico).toContainText('4 eventos');
});

test('nota de outra pessoa não vira selo (D5)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 4 }]);
  await db.from('chamado_eventos').insert({ chamado_id: p.id, tipo: 'nota_interna', usuario_id: null,
    texto: 'Pedido alterado pelo assistente a pedido de Bruno.', criado_em: new Date(Date.now() - 60_000).toISOString() });
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await expect(page.getByRole('region', { name: 'Resultado' }).getByText(/Gravado às/)).toHaveCount(0);
});

test('demanda fora dos setores da pessoa: a prévia continua, sem dados da demanda (D17)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido(`${PREFIXO} Outro setor`);
  await conversaComAssistente(ana, [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 }]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const r = page.getByRole('region', { name: 'Resultado' });
  await expect(r).toContainText('Esta demanda não está entre as que você vê; a prévia continua aqui.');
  await expect(r).toContainText('antes: 10 PAC');
  await expect(r).not.toContainText(`${PREFIXO} Padaria Sol ME`);
  await expect(r).not.toContainText(`${PREFIXO} Carla Mendes`);
  await expect(r.getByRole('link', { name: 'Abrir demanda' })).toHaveCount(0);
  await expect(r.getByRole('region', { name: 'Histórico do pedido' })).toHaveCount(0);
});
```

O "4 eventos" conta: abertura (gatilho), prévia, gravação e CSV. Se o gatilho da Parte C gravar mais algum evento na criação (ex.: `prioridade_alterada` ou `prazo_alterado`), ajuste o número e diga por quê no commit.

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/assistente-pedido.spec.ts`
Expected: FAIL (sem cabeçalho "Pedido #N · …"; o bloco provisório não tem esses dados).

- [ ] **Passo 3: `historico-pedido.tsx`**

```tsx
import { cn } from '@/lib/cn';
import { quandoNoHistorico, type Marco } from '@/lib/pedido-assistente';

const COR: Record<Marco['tipo'], string> = {
  abertura: 'bg-agent-active', previa: 'bg-warning-decor', gravado: 'bg-brand', arquivo: 'bg-success', evento: 'bg-subtle',
};
const MAX = 12;

/** Histórico do pedido (D4): só o que está gravado e a pessoa pode ler. Cor é só enfeite; o texto diz o que houve. */
export function HistoricoPedido({ marcos, agora }: { marcos: Marco[]; agora: Date }) {
  const mostrados = marcos.slice(-MAX);
  return (
    <section aria-labelledby="titulo-historico-pedido" className="rounded-lg border border-border bg-surface px-5 py-4">
      <h4 className="mb-2.5 flex justify-between text-xs font-extrabold uppercase tracking-widest text-brand">
        <span id="titulo-historico-pedido">Histórico do pedido</span>
        <span className="font-semibold normal-case tracking-normal text-subtle">{marcos.length === 1 ? '1 evento' : `${marcos.length} eventos`}</span>
      </h4>
      {mostrados.length === 0 ? <p className="text-sm text-muted">Nenhum evento para mostrar.</p> : (
        <ol className="flex flex-col gap-1.5 text-sm">
          {mostrados.map((m, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <time dateTime={m.em} className="w-12 shrink-0 tabular text-subtle">{quandoNoHistorico(m.em, agora)}</time>
              <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', COR[m.tipo])} />
              <span className={cn('min-w-0', m.tipo === 'gravado' && 'font-bold')}>{m.texto}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

Confira que `bg-agent-active` existe (`grep -n "color-agent-active:" apps/painel/src/app/globals.css`); se não, use `bg-success` para a abertura.

- [ ] **Passo 4: `painel-pedido.tsx`**

```tsx
import { CircleCheck, ExternalLink, FileSpreadsheet, Minus, PenLine, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { variantesBotao } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatarHora } from '@/lib/formatos';
import { historicoDoPedido, montarPedidoNoPainel, origemDoPedido, seloGravado, type ItemComparado } from '@/lib/pedido-assistente';
import { arquivoDoPedido, type LeituraConversa, type MensagemTela, type ResultadoPedido } from '@/lib/resultados-assistente';
import type { LeituraDemanda } from './dados-assistente';
import { HistoricoPedido } from './historico-pedido';
import { LinksCsv } from './links-csv';

const LINHA: Record<ItemComparado['mudanca'], string> = { igual: '', alterado: 'bg-warning-soft', adicionado: 'bg-success-soft text-success', removido: 'bg-danger-soft text-danger' };
const MARCA = {
  alterado: { Icone: PenLine, cor: 'text-warning', rotulo: 'Alterado' },
  adicionado: { Icone: Plus, cor: 'text-success', rotulo: 'Adicionado' },
  removido: { Icone: Minus, cor: 'text-danger', rotulo: 'Removido' },
} as const;

function Antes({ valor }: { valor: string }) {
  return <span className="block text-xs font-normal text-muted">antes: <del className="text-danger">{valor}</del></span>;
}

function Dado({ rotulo, valor, detalhe, anterior }: { rotulo: string; valor: string; detalhe?: string | null; anterior?: string | null }) {
  return (
    <div className="border-b border-r border-border px-5 py-3">
      <dt className="text-xs font-extrabold uppercase tracking-wide text-muted">{rotulo}</dt>
      <dd className="font-bold text-foreground">{valor}</dd>
      {detalhe && <dd className="text-sm text-muted">{detalhe}</dd>}
      {anterior && <dd><Antes valor={anterior} /></dd>}
    </div>
  );
}

function LinhaItem({ l }: { l: ItemComparado }) {
  const { item: i, anterior: a, alteracoes: m } = l;
  const Texto = l.mudanca === 'removido' ? 'del' : 'span';
  const marca = l.mudanca === 'igual' ? null : MARCA[l.mudanca];
  const qtdMudou = !!m && (m.quantidade || m.unidade);
  return (
    <tr className={cn('border-b border-border last:border-0', LINHA[l.mudanca])}>
      <td className="w-8 py-2.5 pl-5">
        {marca && (<><marca.Icone aria-hidden size={14} strokeWidth={2} className={marca.cor} /><span className="sr-only">{marca.rotulo}</span></>)}
      </td>
      <td className="py-2.5 pr-3">{i.codigo ?? '—'}</td>
      <td className="py-2.5 pr-3"><Texto>{i.produto}</Texto>{m?.produto && a && <Antes valor={a.produto} />}</td>
      <td className="py-2.5 pr-3"><Texto className={qtdMudou ? 'font-bold' : undefined}>{i.quantidade} {i.unidade}</Texto>{qtdMudou && a && <Antes valor={`${a.quantidade} ${a.unidade}`} />}</td>
      <td className="py-2.5 pr-3 text-right">{i.semPreco ? 'sem preço' : <Texto>{i.preco}</Texto>}{m?.preco && a && <Antes valor={a.preco ?? 'sem preço'} />}</td>
      <td className="py-2.5 pr-5 text-right"><Texto className={m?.subtotal ? 'font-bold' : undefined}>{i.subtotal ?? '—'}</Texto>{m?.subtotal && a && <Antes valor={a.subtotal ?? '—'} />}</td>
    </tr>
  );
}

/**
 * Painel do pedido (spec 7C.3). O pedido vem da prévia mostrada (D2); a demanda, do banco, pela regra de leitura (D17).
 * `rodape`: onde ficam SIM, GRAVAR / MUDAR OUTRA COISA (Task 7), só quando a página decide que podem aparecer.
 */
export function PainelPedido({ resultado, leituraDemanda, leitura, mensagens, usuario, podeCsv, rodape }: {
  resultado: ResultadoPedido; leituraDemanda: LeituraDemanda | null; leitura: LeituraConversa; mensagens: MensagemTela[];
  usuario: { id: string; nome: string }; podeCsv: boolean; rodape?: (gravado: boolean) => ReactNode;
}) {
  const pedido = montarPedidoNoPainel(resultado.previa);
  const ok = leituraDemanda?.estado === 'ok' ? leituraDemanda : null;
  const d = ok?.demanda ?? null;
  const selo = ok ? seloGravado(ok.eventos, usuario.id, resultado.em) : null;
  const origem = d ? origemDoPedido(d) : null;
  const arquivo = d && podeCsv ? arquivoDoPedido(leitura, d.id) : null;
  const pessoa = usuario.nome.split(' ')[0] ?? usuario.nome;
  const marcos = ok && d ? historicoDoPedido({ demanda: d, eventos: ok.eventos, mensagens, pessoa, podeCsv }) : [];
  const { entrega, enderecoEntrega } = pedido;
  const antesEntrega = entrega.mudou ? entrega.anterior ?? 'sem data' : enderecoEntrega.mudou ? enderecoEntrega.anterior ?? 'endereço do cadastro' : null;

  return (
    <div className="flex flex-col gap-4">
      <article aria-labelledby="titulo-pedido" className="overflow-hidden rounded-lg border border-border bg-surface">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-widest text-brand">{d ? `Nota de venda · ${d.setor ? `Setor ${d.setor}` : 'Triagem'}` : 'Prévia de pedido'}</p>
            <h3 id="titulo-pedido" className="text-2xl font-light text-foreground">
              Pedido{resultado.numero !== null && <> <b className="font-extrabold text-brand">#{resultado.numero}</b></>}
              {d?.empresa && <> · <b className="font-extrabold">{d.empresa}</b></>}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selo && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1 text-sm font-bold text-success">
                <CircleCheck aria-hidden size={16} strokeWidth={2} />
                Gravado às {formatarHora(selo.em)} por {selo.por}
              </span>
            )}
            {d && (
              <Link href={`/demandas?demanda=${d.id}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
                <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
                Abrir demanda
              </Link>
            )}
          </div>
        </header>
        {!d && leituraDemanda && (
          <p className="border-b border-border px-5 py-2 text-sm text-muted">
            {leituraDemanda.estado === 'fora' ? 'Esta demanda não está entre as que você vê; a prévia continua aqui.' : 'Não consegui ler a demanda agora. A prévia continua aqui.'}
          </p>
        )}
        <dl className="grid grid-cols-2 xl:grid-cols-4">
          <Dado rotulo="Destinatário" valor={pedido.destinatario.rede ?? 'não informado'} detalhe={pedido.destinatario.unidade} anterior={pedido.destinatario.anterior} />
          <Dado rotulo="Pagamento" valor={pedido.pagamento.valor ?? 'não informado'} anterior={pedido.pagamento.mudou ? pedido.pagamento.anterior ?? 'não informado' : null} />
          <Dado rotulo="Entrega" valor={entrega.valor ?? 'sem data'} detalhe={enderecoEntrega.valor ?? 'endereço do cadastro'} anterior={antesEntrega} />
          {origem && <Dado rotulo="Pedido veio de" valor={origem.quem} detalhe={origem.como} />}
        </dl>
        {pedido.outros.length > 0 && (
          <dl className="grid grid-cols-2 border-b border-border xl:grid-cols-4">
            {pedido.outros.map((o) => (
              <Dado key={o.rotulo} rotulo={o.rotulo} valor={o.mudanca === 'removido' ? 'removido' : o.valor}
                anterior={o.mudanca === 'removido' ? o.valor : o.anterior} />
            ))}
          </dl>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-2 pt-4">
          <h4 className="text-xs font-extrabold uppercase tracking-widest text-brand">O que mudou</h4>
          <p className="flex flex-wrap gap-3.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><Plus aria-hidden size={14} strokeWidth={2} className="text-success" />adicionado</span>
            <span className="inline-flex items-center gap-1"><Minus aria-hidden size={14} strokeWidth={2} className="text-danger" /><s>removido</s></span>
            <span className="inline-flex items-center gap-1"><PenLine aria-hidden size={14} strokeWidth={2} className="text-warning" />alterado</span>
          </p>
        </div>
        <table className="w-full text-sm tabular">
          <caption className="sr-only">Itens do pedido, com o que mudou na prévia</caption>
          <thead className="border-y border-border bg-background text-xs font-extrabold uppercase tracking-wide text-muted">
            <tr>
              <th scope="col" className="w-8 py-2 pl-5"><span className="sr-only">Mudança</span></th>
              <th scope="col" className="py-2 pr-3 text-left">Cód.</th>
              <th scope="col" className="py-2 pr-3 text-left">Produto</th>
              <th scope="col" className="py-2 pr-3 text-left">Qtd</th>
              <th scope="col" className="py-2 pr-3 text-right">Preço</th>
              <th scope="col" className="py-2 pr-5 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>{pedido.itens.map((l, i) => <LinhaItem key={i} l={l} />)}</tbody>
          <tfoot>
            <tr className={cn('border-t border-border', pedido.total.mudou && 'bg-warning-soft')}>
              <td colSpan={5} className="py-3 pr-3 text-right text-muted">Total do pedido</td>
              <td className="py-3 pr-5 text-right">
                <b className="text-xl text-foreground">{pedido.total.valor ?? '—'}</b>
                {pedido.total.mudou && pedido.total.anterior && <Antes valor={pedido.total.anterior} />}
              </td>
            </tr>
          </tfoot>
        </table>
        {rodape?.(Boolean(selo))}
      </article>
      {d && (
        <div className="grid gap-4 xl:grid-cols-2">
          {podeCsv && (
            <section aria-labelledby="titulo-arquivo-pedido" className="rounded-lg border border-border bg-surface px-5 py-4">
              <h4 className="mb-2.5 flex justify-between text-xs font-extrabold uppercase tracking-widest text-brand">
                <span id="titulo-arquivo-pedido">Arquivo para o Bling</span>
                <span className="font-semibold normal-case tracking-normal text-subtle">{arquivo ? 'pronto' : 'ainda não gerado'}</span>
              </h4>
              {arquivo ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-success-soft text-success">
                      <FileSpreadsheet size={20} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-extrabold text-foreground">{arquivo.arquivo.nome}</span>
                      <span className="block text-sm text-muted">
                        {arquivo.arquivo.chamados.length === 1 ? '1 pedido' : `${arquivo.arquivo.chamados.length} pedidos`} · gerado {formatarHora(arquivo.em)}
                      </span>
                    </span>
                  </div>
                  <LinksCsv mensagemId={arquivo.mensagemId} arquivo={arquivo.arquivo} onde="painel" variante="primary" />
                </div>
              ) : <p className="text-sm text-muted">Depois de gravar, peça ao assistente o CSV do Bling deste pedido.</p>}
            </section>
          )}
          <HistoricoPedido marcos={marcos} agora={new Date()} />
        </div>
      )}
    </div>
  );
}
```

As duas `section` apontam o `aria-labelledby` para o `span` do título (não para o `h4` inteiro): assim a região se chama só "Arquivo para o Bling" e "Histórico do pedido", sem o "pronto" ou o "N eventos" que o e2e procura dentro dela.

- [ ] **Passo 5: o painel de resultado usa o painel do pedido**

Em `assistente/painel-resultado.tsx`:
1. Tire o import de `DiffPreview`, o de `LadoPrevia`, a função `ladoComoTexto` e o bloco provisório do pedido.
2. Acrescente `import type { ReactNode } from 'react';`, `import type { LeituraDemanda } from './dados-assistente';`, `import type { MensagemTela } from '@/lib/resultados-assistente';` (junto do import que já existe) e `import { PainelPedido } from './painel-pedido';`.
3. Troque a assinatura e o bloco do pedido:

```tsx
export function PainelResultado({ leitura, selecionado, conversaId, leituraDemanda, mensagens, usuario, podeCsv, rodapePedido }: {
  leitura: LeituraConversa; selecionado: Resultado | null; conversaId: string | null; leituraDemanda: LeituraDemanda | null;
  mensagens: MensagemTela[]; usuario: { id: string; nome: string }; podeCsv: boolean; rodapePedido?: (gravado: boolean) => ReactNode;
}) {
```

```tsx
          {selecionado.tipo === 'pedido' && (
            <PainelPedido resultado={selecionado} leituraDemanda={leituraDemanda} leitura={leitura} mensagens={mensagens}
              usuario={usuario} podeCsv={podeCsv} rodape={rodapePedido} />
          )}
```

Em `assistente/conversa-com-resultado.tsx`:
1. Acrescente `lerDemandaDoPedido` ao import de `./dados-assistente`.
2. Depois de `const selecionado = …`:

```tsx
  const verPedidos = temNivel(usuario, 'notas', 'ver');
  // Só a demanda do pedido aberto (uma leitura): setor, empresa, origem, eventos (D17).
  const leituraDemanda = selecionado?.tipo === 'pedido' && selecionado.numero !== null
    ? await lerDemandaDoPedido(sb, selecionado.numero, verPedidos) : null;
```

3. Troque o `<PainelResultado … />` por:

```tsx
      <PainelResultado leitura={leitura} selecionado={selecionado} conversaId={conversaId} leituraDemanda={leituraDemanda}
        mensagens={mensagens} usuario={usuario} podeCsv={podeCsv} />
```

- [ ] **Passo 6: rodar**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck && supabase db reset && cd apps/painel && pnpm exec playwright test e2e/assistente-pedido.spec.ts e2e/assistente-lado.spec.ts e2e/assistente.spec.ts e2e/revisao-final.spec.ts`
Expected: tudo verde.

- [ ] **Passo 7: commit**

```bash
git add apps/painel
git commit -m "feat(painel): painel do pedido no Assistente — destinatário, pagamento, entrega, pedido veio de, o que mudou, total antes/depois, selo de gravado, arquivo do Bling, histórico e Abrir demanda

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: SIM, GRAVAR / MUDAR OUTRA COISA (só escrevem a resposta pela pessoa)

**Files:**
- Create: `assistente/resposta-previa.tsx`, `apps/painel/e2e/assistente-responder.spec.ts`
- Modify: `assistente/conversa-com-resultado.tsx` (passa o rodapé quando os botões podem aparecer)

**Interfaces:**
- Consumes: `usarCampoPergunta`, `preencherCampo` (Task 5); `podeResponderPrevia` (Task 1); `perguntarAoAssistente` (**sem mudança**); o `rodape` do `PainelPedido` (Task 6).
- Produces: `RespostaDaPrevia({ acao })`, `RESPOSTA_SIM = 'sim'`, `TEXTO_MUDAR = 'Antes de gravar, mude também: '`.

- [ ] **Passo 1: escrever o e2e que falha**

`apps/painel/e2e/assistente-responder.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { db, entrar } from './apoio';
import { abrirAssistente, conversaComAssistente, criarAna, EMAIL_ANA, limparG4, semearPedido, SENHA, textoPrevia } from './apoio-assistente';

test.afterAll(limparG4);

async function retrato(chamadoId: string) {
  const [{ data: c }, { count: eventos }, { count: decisoes }] = await Promise.all([
    db.from('chamados').select('pedido_venda, resumo, titulo').eq('id', chamadoId).single(),
    db.from('chamado_eventos').select('id', { count: 'exact', head: true }).eq('chamado_id', chamadoId),
    db.from('decisoes_agente').select('id', { count: 'exact', head: true }).like('etapa', 'assistente:%'),
  ]);
  return { c, eventos, decisoes };
}

test('SIM, GRAVAR só grava a pergunta "sim" da pessoa: o pedido, os eventos e as decisões ficam iguais (D6)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [
    { papel: 'usuario', conteudo: `o ${p.numero} era 15 PAC`, min: 2 },
    { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },
  ]);
  const antes = await retrato(p.id);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  const botoes = page.getByRole('group', { name: /Gravar esta prévia\?/ });
  await botoes.getByRole('button', { name: 'Sim, gravar' }).click();
  await expect(page.getByText('Pensando…')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sim, gravar' })).toHaveCount(0);   // a última mensagem agora é da pessoa (D7)
  const { data: perguntas } = await db.from('assistente_mensagens').select('conteudo, papel, canal, conversa_id, processada_em')
    .eq('usuario_id', ana).eq('papel', 'usuario').order('criado_em');
  expect(perguntas?.at(-1)).toEqual({ conteudo: 'sim', papel: 'usuario', canal: 'site', conversa_id: null, processada_em: null });
  expect(perguntas).toHaveLength(2);                                                   // um clique, uma pergunta
  expect(await retrato(p.id)).toEqual(antes);
});

test('MUDAR OUTRA COISA põe o texto no campo e não envia nada', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  await conversaComAssistente(ana, [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 }]);
  await entrar(page, EMAIL_ANA, SENHA);
  await abrirAssistente(page);
  await page.getByRole('button', { name: 'Mudar outra coisa' }).click();
  const campo = page.getByPlaceholder('Pergunte ao assistente');
  await expect(campo).toHaveValue('Antes de gravar, mude também: ');
  await expect(campo).toBeFocused();
  const { count } = await db.from('assistente_mensagens').select('id', { count: 'exact', head: true }).eq('usuario_id', ana).eq('papel', 'usuario');
  expect(count).toBe(0);
});

test('sem botões: prévia já respondida, duas prévias na mesma resposta, prévia sem número, prévia já gravada (D7)', async ({ page }) => {
  const ana = await criarAna();
  const p = await semearPedido();
  const casos: { nome: string; itens: Parameters<typeof conversaComAssistente>[1]; nota?: boolean }[] = [
    { nome: 'respondida', itens: [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 3 }, { papel: 'usuario', conteudo: 'espera', min: 2, pendente: true }] },
    { nome: 'duas', itens: [{ papel: 'assistente', conteudo: `${textoPrevia(p.numero, '')}\n\n${textoPrevia(999999)}`, min: 1 }] },
    { nome: 'sem número', itens: [{ papel: 'assistente', conteudo: textoPrevia('').replace('#:', ':'), min: 1 }] },
    { nome: 'gravada', itens: [{ papel: 'assistente', conteudo: textoPrevia(p.numero), min: 3 }], nota: true },
  ];
  await entrar(page, EMAIL_ANA, SENHA);
  for (const caso of casos) {
    await db.from('assistente_mensagens').delete().eq('usuario_id', ana);
    await db.from('chamado_eventos').delete().eq('chamado_id', p.id).eq('tipo', 'nota_interna');
    await conversaComAssistente(ana, caso.itens);
    if (caso.nota) {
      await db.from('chamado_eventos').insert({ chamado_id: p.id, tipo: 'nota_interna', usuario_id: ana,
        texto: 'Pedido alterado pelo assistente a pedido de Ana G4.', criado_em: new Date(Date.now() - 60_000).toISOString() });
    }
    await abrirAssistente(page);
    await expect(page.getByRole('region', { name: 'Resultado' })).toContainText('antes: 10 PAC');
    await expect(page.getByRole('button', { name: 'Sim, gravar' }), caso.nome).toHaveCount(0);
  }
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/assistente-responder.spec.ts`
Expected: os dois primeiros FAIL (sem os botões); o terceiro passa (ainda não há botões em lugar nenhum) e continua valendo depois.

- [ ] **Passo 3: `resposta-previa.tsx`**

```tsx
'use client';

import { Check, LoaderCircle, PenLine } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { preencherCampo, usarCampoPergunta } from './compositor-assistente';

/** O que SIM, GRAVAR escreve pela pessoa: o mesmo "sim" que ela digitaria (D6). */
export const RESPOSTA_SIM = 'sim';
/** O que MUDAR OUTRA COISA põe no campo (não envia). */
export const TEXTO_MUDAR = 'Antes de gravar, mude também: ';

/**
 * Botões embaixo da prévia (spec 7C.3). Só escrevem a resposta pela pessoa: o "sim" vai pela mesma ação do campo
 * (perguntarAoAssistente) e o trabalhador grava, como sempre, exatamente a prévia mostrada antes do "sim".
 */
export function RespostaDaPrevia({ acao }: { acao: (dados: FormData) => void | Promise<void> }) {
  const campo = usarCampoPergunta();
  const enviando = useRef(false);
  return (
    <div role="group" aria-labelledby="titulo-resposta-previa" className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
      <p id="titulo-resposta-previa" className="w-full text-sm text-muted">Gravar esta prévia? Os botões só escrevem a resposta por você na conversa.</p>
      <form
        action={acao}
        onSubmit={(e) => {
          // Um clique, uma pergunta: outro envio antes de a ação terminar é barrado (como no campo).
          if (enviando.current) e.preventDefault();
          else enviando.current = true;
        }}
      >
        <input type="hidden" name="pergunta" value={RESPOSTA_SIM} />
        <BotaoSim enviando={enviando} />
      </form>
      <Button type="button" variant="outline" size="sm" onClick={() => { const el = campo?.current; if (el) preencherCampo(el, TEXTO_MUDAR); }}>
        <PenLine aria-hidden size={16} strokeWidth={1.75} />
        Mudar outra coisa
      </Button>
    </div>
  );
}

function BotaoSim({ enviando }: { enviando: RefObject<boolean> }) {
  const { pending } = useFormStatus();
  useEffect(() => { if (!pending) enviando.current = false; }, [pending, enviando]);
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Check aria-hidden size={16} strokeWidth={1.75} />}
      Sim, gravar
    </Button>
  );
}
```

O `group` tem o nome do parágrafo ("Gravar esta prévia? Os botões só escrevem…"); o e2e procura `/Gravar esta prévia\?/`.

- [ ] **Passo 4: a página decide quando os botões aparecem**

Em `assistente/conversa-com-resultado.tsx`:
1. Acrescente `podeResponderPrevia` ao import de `@/lib/resultados-assistente` e `import { RespostaDaPrevia } from './resposta-previa';`.
2. Antes do `return`:

```tsx
  const acao = perguntarAoAssistente.bind(null, conversaId);
  // D7: só na prévia que o "sim" vai gravar (última mensagem, única, com número) e ainda sem selo (o PainelPedido sabe do selo).
  const responder = selecionado?.tipo === 'pedido' && podeResponderPrevia(mensagens, selecionado);
  const rodapePedido = responder ? (gravado: boolean) => (gravado ? null : <RespostaDaPrevia acao={acao} />) : undefined;
```

3. Use `acao` no `CompositorAssistente` (`acao={acao}`) e passe `rodapePedido={rodapePedido}` ao `PainelResultado`.

A função `rodapePedido` vai de um componente de servidor para outro (`PainelResultado` e `PainelPedido` são de servidor): pode. Ela devolve o `RespostaDaPrevia` (cliente) com a ação de servidor ligada, o que o React aceita como prop.

- [ ] **Passo 5: rodar**

Run: `pnpm --filter @escritorio/painel typecheck && supabase db reset && cd apps/painel && pnpm exec playwright test e2e/assistente-responder.spec.ts e2e/assistente-pedido.spec.ts e2e/assistente-lado.spec.ts e2e/assistente.spec.ts e2e/revisao-final.spec.ts`
Expected: tudo verde.

- [ ] **Passo 6: commit**

```bash
git add apps/painel
git commit -m "feat(painel): SIM, GRAVAR e MUDAR OUTRA COISA embaixo da prévia — só escrevem a resposta pela pessoa e só na prévia que o sim grava

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Acessibilidade, catálogo e manuais

**Files:**
- Modify: `apps/painel/e2e/acessibilidade.spec.ts` (só acréscimos)
- Modify: `apps/painel/src/app/(painel)/_design/page.tsx` (se tiver seção de padrões)
- Modify: `docs/design-system.md`, `docs/operacao.md`

- [ ] **Passo 1: acessibilidade nos dois temas**

Em `e2e/acessibilidade.spec.ts`:
1. Acrescente `import { abrirAssistente, conversaComAssistente, criarAna, CSV, EMAIL_ANA, limparG4, SENHA as SENHA_G4, semearPedido, TEXTO_TABELA, textoPrevia } from './apoio-assistente';`.
2. Acrescente, dentro do `test.describe` de cada tema, um teste novo:

```ts
    test(`Assistente: pedido, tabela e arquivos ao lado sem violações graves (${tema})`, async ({ page }) => {
      const ana = await criarAna();
      const p = await semearPedido();
      const ids = await conversaComAssistente(ana, [
        { papel: 'usuario', conteudo: 'quais pedidos estão em aberto?', min: 9 },
        { papel: 'assistente', conteudo: TEXTO_TABELA, min: 8 },
        { papel: 'assistente', conteudo: 'Pronto.', min: 5, arquivo: CSV([p.id], 2) },
        { papel: 'assistente', conteudo: textoPrevia(p.numero), min: 1 },
      ]);
      try {
        await entrar(page, EMAIL_ANA, SENHA_G4);
        for (const consulta of ['', `?resultado=tabela-${ids[1]}-0`, '?resultado=arquivos']) {
          await abrirAssistente(page, consulta);
          erros.push(...(await auditar(page, `/assistente${consulta}`, tema)));
        }
      } finally {
        await limparG4();
      }
      expect(erros, erros.join('\n')).toEqual([]);
    });
```

(declare `const erros: string[] = [];` no começo do teste; use os nomes de `auditar` e `entrar` que o arquivo já importa.)

Run: `supabase db reset && cd apps/painel && pnpm exec playwright test e2e/acessibilidade.spec.ts`
Expected: sem violação séria ou crítica nos temas claro e escuro. Se o axe acusar contraste em `text-warning` sobre `bg-warning-soft`, `text-success` sobre `bg-success-soft` ou `text-danger` sobre `bg-danger-soft`, use o par já aprovado do `DiffPreview` (`grep -n "soft" apps/painel/src/components/patterns/diff-preview.tsx`). Se acusar "nome acessível não contém o texto visível" no "+n", confira o `sr-only " conversas"`.

À mão, com o teclado: Tab passa pelos botões do histórico (o ativo é anunciado como atual), pelo "+n" (Enter abre o menu; setas escolhem; Esc fecha), pela conversa (cada "Ver ao lado" diz o que abre), pelas sugestões, pelo campo e por Enviar; no painel, pelas abas (a aberta é anunciada como atual), por Abrir demanda, pelos links do CSV, por **Sim, gravar** e **Mudar outra coisa** (este leva o foco ao campo). O leitor de tela lê "Alterado", "Adicionado" ou "Removido" no começo de cada linha que mudou e "antes: …" ao lado do valor novo.

- [ ] **Passo 2: catálogo**

Se `/_design` mostra padrões, acrescente "Assistente (Parte G4)": um `CartaoResultado` de cada tipo com dados fixos (`href="#"`), sem leitura de banco. Sem seção de padrões, não acrescente nada.

- [ ] **Passo 3: `docs/design-system.md`**

Em "Vocabulário oficial da interface", logo depois do item do Atendimento:

```markdown
- **Assistente:** "Assistente · Geral" / "Assistente · <contato>"; histórico "Geral", "+n conversas"; cartões "Prévia #N · 1 alteração", "Tabela · N linhas", nome do arquivo, "Ver ao lado"; abas "Pedido #N", "<título da tabela> (n)", "Arquivos (n)", "resultados desta conversa"; painel do pedido "Nota de venda · Setor <setor>", "Destinatário", "Pagamento", "Entrega" ("endereço do cadastro"), "Pedido veio de" ("WhatsApp · dd/mm", "Painel · dd/mm"), "O que mudou" (adicionado, removido, alterado, "antes: …"), "Total do pedido", "Gravado às HH:MM por <pessoa>", "Abrir demanda", "Arquivo para o Bling" ("pronto", "ainda não gerado"), "Histórico do pedido"; botões "Sim, gravar" e "Mudar outra coisa"; vazio "Os resultados aparecem aqui".
```

Em "Regras de estilo":

```markdown
**Assistente** (G4): a resposta grande não fica no balão: prévia, tabela e arquivo viram cartões **Ver ao lado** e abrem no painel de resultado, com a aba na URL (`?resultado=`). O painel do pedido mostra a **prévia como veio** (o que o "sim" grava), nunca o pedido atual do banco; a demanda (setor, empresa, origem, histórico) vem do banco pela regra de leitura. "Sim, gravar" e "Mudar outra coisa" só escrevem a resposta pela pessoa e só aparecem na prévia da última mensagem, única e ainda sem selo. Os links do CSV seguem "Pedidos de nota: Corrigir e gerar"; na conversa mantêm "Baixar CSV Bling (parte N)" e no painel "· parte i de n". A conversa tem a largura `w-chat-assistente` (token `--assistant-chat-width`) e o menu abre recolhido, como no Atendimento.
```

- [ ] **Passo 4: `docs/operacao.md`**

Na seção "## 9. Assistente interno (dono e equipe)":
1. Troque o item "**No painel:** menu **Assistente** (perguntas gerais) ou a caixa **Assistente** dentro de cada atendimento (já sabe do cliente e das demandas daquela conversa)." por:

```markdown
- **No painel:** menu **Assistente** (perguntas gerais) ou a caixa **Assistente** dentro de cada atendimento (já sabe do cliente e das demandas daquela conversa). Na tela Assistente, a conversa fica à esquerda e os botões do topo trocam entre a **Geral** e as conversas feitas dentro de atendimentos (**+n** mostra as mais antigas). Respostas com prévia de pedido, tabela ou arquivo trazem um cartão **Ver ao lado**: o conteúdo abre à direita, em abas (um pedido por aba, cada tabela e **Arquivos**).
- **Painel do pedido:** mostra a prévia como o assistente a mostrou (é ela que o "sim" grava): destinatário, pagamento, entrega, de onde o pedido veio (contato e WhatsApp, ou quem abriu no painel), **O que mudou** (verde adicionado, vermelho riscado removido, "antes:" no que mudou) e o total antes e depois. Embaixo, **Sim, gravar** manda "sim" por você e **Mudar outra coisa** põe o começo da frase no campo para você completar; eles só aparecem na prévia mais recente, quando ela é a única da resposta. Depois de gravado, aparece "Gravado às HH:MM por <você>", o arquivo do Bling (se você pediu) e o histórico do pedido; **Abrir demanda** leva à demanda.
```

2. No item "**Correção de pedido:** …", acrescente no fim: "Os botões da tela não mudam essa regra: só escrevem a resposta."

- [ ] **Passo 5: commit**

```bash
git add docs/design-system.md docs/operacao.md apps/painel/src apps/painel/e2e
git commit -m "docs: Assistente em conversa + resultado no catálogo e no manual; acessibilidade do pedido, da tabela e dos arquivos ao lado nos dois temas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes de cada suíte inteira:
   - **nada fora do painel mudou:** `git diff 5c13c32 --stat -- supabase packages apps/trabalhador` sai **vazio** (sem migração, sem tipos, sem trabalhador: D1, D20); `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff 5c13c32 --stat -- 'apps/painel/**/*.test.ts' apps/painel/e2e` só mostra arquivos **novos** e o acréscimo em `e2e/acessibilidade.spec.ts`;
   - `supabase test db`: todos os arquivos, com os números de cada um, inclusive o `22` (100/100) e o `25`;
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`; `pnpm --filter @escritorio/trabalhador test` e `typecheck` (inalterados, mas rodados para provar);
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com `assistente-lado`, `assistente-pedido`, `assistente-responder`, `assistente` (sem edição), `revisao-final` (sem edição), `atendimento-direita` e `atendimento-compositor` (caixa do Atendimento intacta) e `acessibilidade.spec.ts` nos dois temas;
   - **cenários com Claude de verdade (`pnpm --filter @escritorio/trabalhador cenarios-assistente`): não rodar** — nada do que o modelo vê mudou (D20; prova: o `git diff` acima). Se, por qualquer motivo, algo em `apps/trabalhador` tiver mudado, **pare**: isso está fora desta parte;
   - mostre os números exatos de cada suíte (passaram, falharam, pulados). Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-assistente-opcao-b.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local e dados parecidos com os da imagem: Ana (Fiscal, "Corrigir e gerar"), a Geral com a pergunta "quais pedidos de nota estão em aberto?", a resposta com a tabela de 4 pedidos, o pedido da Padaria Sol ME (Pão de queijo 10 → 15 PAC, Bolo de fubá 6 UN, Biscoito de polvilho 4 PAC; total R$ 296,60 → R$ 389,10; Rede Bom Preço / Unidade Centro; Boleto 28 dias; entrega 03/10), aberto pelo agente pelo WhatsApp da Carla Mendes em 01/10, e duas conversas de atendimento (Carla Mendes, Jorge Santos) mais três antigas no "+3". Para o número **#536**, no banco **local**: `alter table public.chamados alter column numero restart with 536;` antes de semear (nunca na homologação);
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**), gravando os dados pela chave de serviço **do banco local** (como o `e2e/apoio-assistente.ts`);
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-g4\` com nomes `g4-<tela>-<largura>-<tema>.png`: `assistente` (prévia aberta ao lado, com **Sim, gravar** e **Mudar outra coisa**), `assistente-gravado` (depois do "sim": selo, arquivo e histórico, como na imagem), `assistente-tabela` (aba "Pedidos em aberto (4)"), `assistente-arquivos` (aba Arquivos), `assistente-historico` (menu "+3" aberto), `assistente-conversa` (`?conversa=` de um atendimento, com "Abrir no Atendimento");
   - liste o que ficou diferente da imagem. Já se sabe: "Juntar com os abertos" não existe e o arquivo diz "1 pedido · gerado HH:MM" sem os itens (D11); "Ana respondeu 'sim'" do histórico aparece como "Ana … gravou a correção pelo assistente" (D4); o cartão da tabela diz "Tabela · 4 linhas" (o modelo não diz "pedidos de nota" de forma que a tela possa ler; D9); as sugestões são as de hoje (D15); o balão da pessoa diz "Você" (como hoje); a etiqueta "Opção B — Conversa + resultado" era legenda da maquete; a trilha continua "Assistente" (D14); a largura da conversa acompanha a letra (470px em 1366, maior em 1920).
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Ela deve listar só as que já estavam pendentes: Parte F (`20261006000100_painel_v2_gastos_colunas.sql` a `20261006000300_painel_v2_gastos_funcoes.sql`), G1 (`20261007000100_painel_v2_prazos_regra.sql`, `20261007000200_painel_v2_cargos.sql`), G2 (`20261008000100_painel_v2_inicio.sql`) e G3 (`20261009000100_painel_v2_contatos.sql`). **A G4 não acrescenta nenhuma** (D1): se aparecer outra, pare e avise;
   - **não aplique.** Deixe para o dono, por escrito: a G4 não muda o banco nem o trabalhador; o Assistente novo funciona com ou sem as migrações pendentes (D18); para aplicar F, G1, G2 e G3 juntas, depois do "ok" dele: `supabase db push --db-url "$DATABASE_URL"`.
4. **Subir o painel para o dono ver:**
   - **painel** desta worktree numa **porta livre** (comece pela **3013**: `netstat -ano | findstr :3013`; se ocupada, a próxima livre). Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal: variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p <porta>` rodando nesta worktree;
   - **trabalhador: NÃO suba nenhum e não há nada "pronto para trocar"** (G4 não muda o trabalhador). O da porta **3001 é o teste do dono**; não o desligue nem o mate. Ele responde as perguntas feitas no painel novo exatamente como antes;
   - avise: o Assistente novo abre inteiro mesmo com as migrações da F, G1, G2 e G3 pendentes (só Gastos com IA, Configurações › Prazos, o Início e os filtros de Contatos ficam com os avisos delas);
   - passe o endereço e um roteiro curto:
     1. abra Assistente: o menu vem recolhido; os botões do topo trocam entre a Geral e as conversas de atendimento (+n mostra as mais antigas);
     2. pergunte "quais pedidos de nota estão em aberto?": a resposta curta traz o cartão **Ver ao lado** e a tabela abre à direita;
     3. peça a correção de um pedido de teste: a prévia abre ao lado com o que mudou e o total antes e depois; clique **Mudar outra coisa** (o campo ganha o começo da frase) e depois **Sim, gravar**; confira o selo "Gravado às HH:MM por você", o histórico e **Abrir demanda**;
     4. peça o CSV: o arquivo aparece no pedido e na aba Arquivos, com **Baixar CSV Bling**;
     5. entre com uma pessoa sem "Corrigir e gerar": nenhum link do CSV e nenhuma aba Arquivos.
5. **Pendências para listar no fim:**
   - as decisões D1 a D21 que o dono ainda não confirmou (destaque D2, D4, D5, D6 e D7, que dizem o que o painel mostra do pedido e quando os botões aparecem);
   - o que ficou diferente da imagem (item 2);
   - D21: erro ao enviar com uma conversa aberta continua levando o aviso para o Atendimento (comportamento de antes);
   - aplicar na homologação as migrações da F, G1, G2 e G3 (item 3), depois do "ok";
   - Parte G, próxima sub-etapa: Treinar o agente (G5).
6. **Não juntar** a branch em nada. **Parar** ao fim da G4 e esperar o dono ver antes de começar o Treinar o agente.
