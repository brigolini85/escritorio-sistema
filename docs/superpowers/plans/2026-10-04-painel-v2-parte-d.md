# Painel v2, Parte D (Usuários e permissões por nível + horário de acesso). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** trocar as 6 marcações de permissão por **níveis por módulo** (Atendimento, Demandas, Clientes e contatos, Preços, Pedidos de nota e CSV Bling, Assistente, Treinar o agente, Alterar prazos, Configurações), com **horário de acesso** por dia (painel, gravações, leituras, Realtime e assistente pelo WhatsApp; administrador nunca bloqueado), e o cadastro da pessoa em **página inteira** (`/usuarios/novo`, `/usuarios/[id]`) em 3 colunas, como a imagem 06. **Ninguém passa a ver nem a fazer mais ou menos do que hoje sem o administrador mexer**, e isso é provado por testes de regressão escritos antes de qualquer mudança.

**Arquitetura:**
- **Banco (seis migrações novas, em ordem; nenhuma antiga é editada):**
  - `20261004000100_painel_v2_niveis.sql`: catálogo `permissao_niveis`, tabela `usuario_permissoes` (fonte da verdade), conversão das marcações atuais, `tem_permissao(modulo, nivel)` e o adaptador `tem_permissao(text)` das chamadas antigas, `tem_nivel` (sem passe livre do administrador, para o assistente), as versões "com a pessoa" (`eh_admin_de`, `usuario_liberado`, `nivel_de`, `niveis_do_usuario`) e as colunas `cargo`, `observacoes`, `ultimo_acesso_em`. A coluna antiga `usuarios.permissoes` **continua**, como cópia mantida por gatilhos nos dois sentidos (os painéis e o trabalhador antigos da homologação e os testes que gravam o array seguem funcionando).
  - `20261004000200_painel_v2_visibilidade.sql`: `pode_ver_chamado_de` / `pode_ver_conversa_de` pelo nível (as de sempre viram atalhos com `auth.uid()`), arquivar exige "Editar e arquivar", assistente pelo nível, "Só as minhas" na Nova demanda, prazo escolhido à mão exige "Alterar prazos".
  - `20261004000300_painel_v2_horario.sql`: `horario_acesso`, `horario_permite(pessoa, quando)`, `pode_acessar_agora()`, `situacao_acesso()` (login e middleware), horário dentro de `usuario_liberado` (logo, de todas as regras de leitura e gravação), auditoria sem o "último acesso", e um teste que acusa qualquer função de gravação sem trava.
  - `20261004000400_painel_v2_salvar_usuario.sql`: `salvar_usuario(id, dados)` numa transação só, com auditoria de quem mudou.
  - `20261004000500_painel_v2_configuracoes.sql`: "Configurações: Sim" abre Configurações (menos teto de IA, alertas e pausa do agente, que o banco segura para o administrador).
- **Core:** `packages/core/src/permissoes.ts` com os módulos, níveis, padrão e `nivelAtinge`, usados pelo painel e pelo trabalhador; um teste do pacote db confere que bate com o banco.
- **Trabalhador:** o assistente lê os níveis (Demandas, Atendimento, Pedidos de nota, Assistente) e o horário (`horario_permite`); fora do horário responde "Fora do seu horário de acesso…" sem chamar a IA.
- **Painel:** `UsuarioPainel.niveis` no lugar de `permissoes`, `temNivel` e `usaAssistente` no lugar de `temPermissao`; horário no `middleware`, no login e na página `/fora-do-horario`; ficha da pessoa em página inteira; lista com Nome/Cargo, Setores, Nível de Demandas, Último acesso, Situação; as telas respeitam os níveis.

**Tecnologias:** Next.js 15 (App Router, server actions, middleware), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, sonner, Supabase (Postgres, RLS, Realtime, pgTAP), Vitest, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção 7 inteira (Parte D), que é o escopo, e a imagem `docs/superpowers/specs/painel-v2/imagens/06-usuario-cadastro.png`;
- seção 3.0 (Parte B: pessoa arquivada não entra e o telefone dela vira contato desconhecido; a chave "Ativo" saiu), 3.1 (decisões gerais), 4 (identidade), 5.2 (arquivar/restaurar passa a ser "Clientes e contatos: Editar e arquivar");
- seção 8 (riscos: grep antes de trocar rótulos; vermelho nunca sozinho).

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "Prompt D" (segurança primeiro: testes de regressão antes, rodados antes e depois). Estilo e padrões: `docs/superpowers/plans/2026-10-03-painel-v2-parte-c.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-d`, branch `painel-v2-parte-d`, criada de `painel-v2-parte-c` em `9734c2f` (Parte C e as sobras prontas). Todos os comandos rodam a partir da raiz da worktree.

## Perguntas para o dono

O spec não decide estes pontos, ou o código não bate com ele. O dono autorizou seguir sem esperar: **o plano segue a recomendação** de cada um (na dúvida, a mais conservadora para a segurança). Se a resposta for outra, ajuste a task indicada antes de executá-la.

| # | Pergunta | Recomendação (o que o plano faz) | Task |
|---|---|---|---|
| P1 | **"Preços e produtos":** hoje produto se cadastra com `editar_clientes` e preço com `editar_precos`. Juntar os dois num módulo faria quem tem só uma das marcações ganhar ou perder algo. | **Produtos continuam em "Clientes e contatos: Ver e editar"** nesta parte. O módulo aparece como **"Preços"** com os níveis "Só ver · Mudar preços" e a ajuda "Produtos seguem em Clientes e contatos". Assim a conversão não muda nada para ninguém. Juntar fica para quando o dono pedir. | 2, 11 |
| P2 | **Assistente só pelo WhatsApp** (sem o site) existe hoje; a tabela de níveis não tem "só WhatsApp". | Vira **"Site e WhatsApp"**. O assistente vê exatamente o mesmo pelos dois canais (nenhum dado novo); a migração lista essas pessoas no aviso (`NOTICE`) para o dono conferir no `--dry-run`. | 2 |
| P3 | **Administrador e o Assistente:** hoje o administrador só usa o assistente com a marcação (o formulário diz "as do assistente valem para todos"). | **"Administrador = Sim" esconde todos os módulos, menos Assistente** (é canal e depende do telefone). Nada muda para o administrador. | 2, 11 |
| P4 | **Horário de quem já existe.** O spec dá o padrão "seg–sex 08–18, sáb/dom bloqueados", mas aplicá-lo agora mudaria o acesso de todos sem o administrador mexer. | Quem já existe fica **sem restrição** (`horario_acesso` vazio) até o administrador definir. **Pessoa nova** começa com o padrão do spec. Pessoa criada fora do painel novo (painel antigo, testes) também fica sem restrição. | 4, 11 |
| P5 | **Fora do horário:** o spec recusa as gravações. E a leitura? | **Recusa as duas.** O horário entra em `usuario_liberado`, que está dentro de todas as regras (RLS, Realtime, funções). Uma aba esquecida aberta à noite deixa de receber as mensagens dos clientes; um token antigo não lê pela API. Administrador nunca é bloqueado. | 4 |
| P6 | **Feriado** (cadastrado em Configurações) bloqueia o acesso? | **Não.** O feriado segue a regra do dia da semana (o spec tem só três linhas: seg a sex, sábado, domingo). | 4 |
| P7 | **"08:00 às 18:00" vale até quando?** | Até **18:00 inclusive** (o minuto 18:00 ainda entra; 18:01 não). Horário que cruza a meia-noite não existe. | 4, 9 |
| P8 | **Último acesso:** o spec diz "atualizado no login", mas a sessão dura dias e o número ficaria velho. | Atualiza **no login e ao usar o painel**, no máximo a cada 10 minutos, **sem** entrar na auditoria. | 4, 9 |
| P9 | **"Só as minhas" e a Nova demanda:** quem só vê as próprias demandas criaria uma que some da tela dele. | Quem tem "Só as minhas" **fica responsável** pela demanda que cria (escolher outra pessoa é recusado com a explicação). | 3 |
| P10 | **"Alterar prazos de demandas":** o que exige, e o que recebe quem já existe e quem é novo? | Exige para **escolher o prazo à mão** (painel lateral e Nova demanda). Mudar a prioridade continua recalculando o prazo para todos (spec 6.5, P4 da Parte C). Todos recebem **"Sim"** (hoje todos mudam); o administrador tira de quem quiser. | 2, 3, 13 |
| P11 | **Pedidos de nota "Sem acesso" × "Ver":** o pedido mora dentro da demanda, que a pessoa continua vendo pelo nível de Demandas. | **"Ver"** = como hoje. **"Sem acesso"** esconde o bloco "Pedido de nota" e o CSV no painel e as ferramentas de pedido e vendas no assistente. É proteção de tela e de assistente, não do banco; a ajuda do campo diz isso. Quem já existe recebe "Ver" (sem `emitir_notas`) ou "Corrigir e gerar" (com). | 8, 13 |
| P12 | **"Configurações: Sim"** para quem não é administrador. | Abre Configurações **menos** "Teto de IA e alertas", "Integrações" e "Usuários e permissões", que continuam só do administrador (senão alguém se faria administrador, mudaria o gasto ou pausaria o agente). O banco garante com um gatilho nas colunas do administrador. Quem já existe recebe "Sem acesso" (hoje só o administrador entra). | 6, 13 |
| P13 | **Cargo, "lista editável":** precisa de tela própria? | **Não.** Campo com sugestões (Auxiliar, Analista, Coordenador, Sócio e os cargos já usados); digitar outro vale. | 11 |
| P14 | **"Acessos de portais" (Parte H) e "Gastos com IA" (Parte F)** estão na tabela 7.1. | "Acessos de portais" entra **na Parte H**, junto com o que protege (ainda não existe). "Gastos com IA" é só do administrador (nada a configurar); nesta parte não há tela. | — |
| P15 | **Coluna antiga `usuarios.permissoes`:** apagar? | **Fica**, como cópia mantida pelo banco, até nenhum painel ou trabalhador antigo ler. Sai numa parte futura, com migração própria. | 2 |
| P16 | **Administrador tirando o próprio "Administrador":** hoje o formulário deixa. | O banco **recusa** ("Você não pode tirar o seu próprio acesso de administrador."); o campo fica travado na própria ficha. Evita o escritório ficar sem administrador. | 5, 11 |
| P17 | **Assistente pelo WhatsApp fora do horário.** | Responde **"Fora do seu horário de acesso. O assistente volta a responder quando o seu horário começar."**, sem chamar a IA (sem custo). A mensagem não vai para o agente de clientes. | 8 |
| P18 | **Cenários com Claude real.** O assistente muda só em regras sem IA (filtros e horário) e numa linha do prompt ("pode corrigir…" vem do nível). | Rodar **só os 3 cenários do assistente** (US$ menos de 1) na Entrega. Os 50 do agente não mudam (o agente de clientes não é tocado). | Entrega |

## Restrições globais

- **Só mexer em:**
  - banco: **criar** `supabase/migrations/20261004000100_painel_v2_niveis.sql`, `20261004000200_painel_v2_visibilidade.sql`, `20261004000300_painel_v2_horario.sql`, `20261004000400_painel_v2_salvar_usuario.sql`, `20261004000500_painel_v2_configuracoes.sql` e os testes `supabase/tests/22_regressao_visibilidade.test.sql` a `27_painel_v2_configuracoes_permissao.test.sql`;
  - `packages/core/src/permissoes.ts` (+ teste e `index.ts`);
  - `packages/db/src/repos.ts`, `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão) e `packages/db/test/niveis.test.ts` (novo);
  - trabalhador, só o assistente: `src/assistente/visibilidade.ts`, `contexto.ts`, `ferramentas.ts`, `processar.ts`, `prompt.ts` e testes em `test/assistente/`;
  - `apps/painel`.
  - Nada no agente de clientes, no Bling, no prompt do agente nem nas migrações antigas.
- **Nunca editar migração antiga** (`20261003000600` e anteriores). Toda mudança é migração nova, datada depois de `20261003000600`.
- **`supabase/tests/22_regressao_visibilidade.test.sql` não muda depois do commit da Task 1.** Se ele falhar depois de uma migração desta parte, a migração mudou o que alguém vê: corrija a migração. Na Entrega, `git diff <commit da Task 1> -- supabase/tests/22_regressao_visibilidade.test.sql` tem de sair vazio.
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
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os testes do painel (e2e) e do trabalhador deixam no banco quebram os pgTAP antigos. O reset reaplica todas as migrações, inclusive as novas.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`.** Ele só é lido na Entrega (só leitura), para o `--dry-run` e para subir o painel do dono. Os e2e já recusam outro banco: `apps/painel/e2e/trava-local.ts` (`clienteServicoLocal` só aceita `SUPABASE_URL`/`DATABASE_URL` em `127.0.0.1`/`localhost`), e o `globalSetup` `apps/painel/e2e/aquecer.ts` compila as rotas antes dos specs. Rota nova entra na lista `ROTAS` do `aquecer.ts`.
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. Se um teste depender do texto, ajuste o teste na mesma task e diga por quê no commit.
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[300px]` ou `grid-cols-[...]`. Use os tokens e utilitários da Parte A (`text-danger`, `bg-danger-soft`, `text-success`, `text-warning`, `border-brand`, `bg-brand-soft`, `text-muted`, `variantesBotao`, `classeSelect` etc.). `src/styles/escala.test.ts` e `tokens.test.ts` continuam passando.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS. Vermelho nunca sozinho: "Bloqueado" sempre com texto.
- **Termos (spec 3.1):** Demanda, Atendimento, Conversa, Empresa, Contato, Setor, Pedido de nota, CSV do Bling, Assumir. Na tela, "pessoa" para usuário da equipe ("Nova pessoa").
- **Reaproveite o que existe:** `FormField`, `FormularioAlteravel`, `BotaoSalvar`, `IndicadorAlteracoes`, `PageHeader` (com `migalhas`), `DataTable`, `ExcluirCadastro`, `AvisoArquivado`, `TelaArquivados`, `LinkArquivados`, `BotaoRestaurar`, `EmptyState`, `Badge`, `toast` (`@/components/ui/toaster`), `classeSelect` (`clientes/estilos.ts`), `mensagemDoBanco`, `mensagemDeErro`, `variantesTelefone`/`normalizarTelefone` (`@escritorio/core`).
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Decisões tomadas neste plano (o dono confirma ao aprovar)

1. **Ordem:** regressão (Task 1) → níveis e conversão (2) → visibilidade pelo nível (3) → horário (4) → salvar pessoa (5) → Configurações (6) → core e repos (7) → assistente (8) → sessão, menu, middleware e login (9) → ações da ficha (10) → ficha em página inteira (11) → lista e e2e antigos (12) → telas pelos níveis (13) → acessibilidade, capturas e manuais (14). Cada task deixa tudo funcionando e testado.
2. **Códigos dos níveis** (o banco e o código usam estes; a tela mostra os rótulos):

   | Módulo (código) | Níveis, do menor ao maior | Padrão (= hoje sem marcação) |
   |---|---|---|
   | Atendimento (`atendimento`) | `sem_acesso` Sem acesso · `meus_setores` Conversas dos meus setores · `todas` Todas as conversas | `meus_setores` |
   | Demandas (`demandas`) | `minhas` Só as minhas · `meu_setor` Do meu setor · `todas` Todas | `meu_setor` |
   | Clientes e contatos (`clientes`) | `ver` Só ver · `editar` Ver e editar · `arquivar` Editar e arquivar | `ver` (`editar_clientes` → `arquivar`) |
   | Preços (`precos`) | `ver` Só ver · `mudar` Mudar preços | `ver` (`editar_precos` → `mudar`) |
   | Pedidos de nota e CSV Bling (`notas`) | `sem_acesso` Sem acesso · `ver` Ver · `corrigir` Corrigir e gerar | `ver` (`emitir_notas` → `corrigir`) |
   | Assistente (`assistente`) | `sem_acesso` Sem acesso · `site` Site · `site_whatsapp` Site e WhatsApp | `sem_acesso` (`assistente_site` → `site`; `assistente_whatsapp` → `site_whatsapp`) |
   | Treinar o agente (`treinar`) | `nao` Sem acesso · `sim` Sim | `nao` (`treinar_agente` → `sim`) |
   | Alterar prazos de demandas (`prazos`) | `nao` Não · `sim` Sim | `sim` |
   | Configurações (`configuracoes`) | `nao` Sem acesso · `sim` Sim | `nao` |

3. **Uma regra, duas portas.** As regras do banco ganham uma versão "com a pessoa" (`pode_ver_chamado_de(pessoa, demanda)` etc.), que o trabalhador pode usar com a chave de serviço; as de sempre (`pode_ver_chamado(demanda)`) viram atalhos com `auth.uid()`. Os nomes antigos continuam nas políticas, então Realtime e RLS não mudam de forma.
4. **"Do meu setor" e "Conversas dos meus setores" são a regra de hoje, palavra por palavra** (inclusive: responsável sempre vê a demanda; quem assumiu a conversa sempre a vê).
5. **O horário mora em `usuario_liberado(pessoa)`**, que todas as regras chamam. Nenhuma função precisa lembrar do horário, e um teste (Task 4) acusa função de gravação nova sem trava.
6. **Horário vazio = sem restrição.** Valor: `{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}`; `null` num dia = bloqueado; fuso de Brasília; minuto final incluído (P7).
7. **`situacao_acesso()`** devolve `liberado`, `fora_do_horario`, `inativo` ou `sem_cadastro`, e atualiza o último acesso (no máximo a cada 10 min). O login e o `middleware` usam a mesma função.
8. **Salvar a pessoa é uma função só no banco** (`salvar_usuario`), numa transação: dados, setores e níveis juntos. Módulo que não veio (escondido para o administrador) **não é apagado**.
9. **Página inteira:** o painel lateral e a janela "Convidar pessoa" saem. "Nova pessoa" leva a `/usuarios/novo`; salvar envia o convite e abre `/usuarios/<id>`. O link antigo `/usuarios?usuario=<id>` redireciona.
10. **Campos escondidos não perdem o que foi escolhido:** marcar "Administrador = Sim" esconde (classe `hidden`) e desliga (`<fieldset disabled>`) as permissões e o horário; voltar para "Não" mostra os valores de antes.
11. **`temPermissao` sai do painel.** No lugar: `temNivel(u, modulo, minimo)` (administrador passa) e `usaAssistente(u, canal)` (sem passe livre, como hoje).
12. **Lista de usuários:** colunas Nome/Cargo, Setores, Nível de Demandas, Último acesso, Situação ("Ativo", ou "Fora do horário agora" com relógio e texto). Arquivados continuam em "Arquivados (n)".
13. **Setores na ficha** ficam como etiquetas marcáveis dentro de uma caixa (como o formulário de hoje), e não numa lista suspensa: os valores entram no formulário mesmo fechados, e o "Alterações não salvas" continua funcionando. É a única diferença visual planejada em relação à imagem 06.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **A aba fica aberta quando o horário termina:** a gravação seguinte é recusada, a leitura volta vazia, o Realtime para, e a próxima navegação leva a "Fora do seu horário de acesso". Testado no pgTAP da Task 4 (asserções 20 a 28) e no e2e da Task 9.
2. **Painel antigo da homologação salva uma pessoa depois que o painel novo deu "Ver e editar" (sem arquivar):** o array antigo ainda tem `editar_clientes`, e isso **não** pode virar "Editar e arquivar". Testado no pgTAP da Task 2 (asserções 10 a 12).
3. **Administrador marca "Administrador = Sim" e salva; depois desmarca:** os níveis escondidos voltam como estavam (nada foi apagado). Testado no pgTAP da Task 5 (asserções 7 a 9) e no e2e da Task 11.
4. **Função de gravação nova (desta parte ou futura) esquecendo a trava:** o teste da Task 4 (asserção 34) lista toda função `security definer` executável pela equipe que grava sem chamar uma das travas.
5. **Assistente pelo WhatsApp de quem tem "Só as minhas" ou "Atendimento: Sem acesso":** não lista demanda do setor nem lê a conversa. Testado no teste de equivalência da Task 8 (regra do trabalhador = regra do banco, pessoa a pessoa).

---

## Mapa de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/tests/22_regressao_visibilidade.test.sql` (novo, congelado) | o que cada pessoa vê e faz hoje | 1 |
| `supabase/migrations/20261004000100_painel_v2_niveis.sql` (novo) | catálogo, `usuario_permissoes`, conversão, adaptador, cópia antiga | 2 |
| `supabase/tests/23_painel_v2_niveis.test.sql` (novo) | conversão, cópia nos dois sentidos, `tem_permissao`, auditoria | 2 |
| `supabase/migrations/20261004000200_painel_v2_visibilidade.sql` (novo) | regras pelo nível | 3 |
| `supabase/tests/24_painel_v2_visibilidade_niveis.test.sql` (novo) | cada nível de Demandas e Atendimento, arquivar, assistente, prazos | 3 |
| `supabase/migrations/20261004000300_painel_v2_horario.sql` (novo) | horário, `situacao_acesso`, auditoria, trava | 4 |
| `supabase/tests/25_painel_v2_horario.test.sql` (novo) | horário, fora do horário, admin, teste das travas | 4 |
| `supabase/migrations/20261004000400_painel_v2_salvar_usuario.sql`, `supabase/tests/26_painel_v2_salvar_usuario.test.sql` (novos) | `salvar_usuario` | 5 |
| `supabase/migrations/20261004000500_painel_v2_configuracoes.sql`, `supabase/tests/27_painel_v2_configuracoes_permissao.test.sql` (novos) | Configurações por nível | 6 |
| `packages/core/src/permissoes.ts`, `packages/core/test/permissoes.test.ts` (novos), `packages/core/src/index.ts` | módulos e níveis | 7 |
| `packages/db/src/repos.ts`, `packages/db/test/niveis.test.ts` (novo), `packages/db/src/tipos.gen.ts` | usuário do assistente pelos níveis, `horarioPermite` | 2 a 7 |
| `apps/trabalhador/src/assistente/{visibilidade,contexto,ferramentas,processar,prompt}.ts`, `test/assistente/niveis.test.ts` (novo), `test/assistente/processar.test.ts` | assistente pelos níveis e horário | 8 |
| `apps/painel/src/lib/sessao.ts`, `lib/menu.ts` (+ teste), `lib/horario-acesso.ts` (+ teste) e `lib/situacao-acesso.ts` (novos), `lib/permissoes.ts` (+ teste, novos), `lib/usuarios.ts` (+ teste, novos), `lib/caixa.ts` | sessão pelos níveis, menu, horário, rótulos | 9 |
| `apps/painel/src/middleware.ts`, `app/entrar/acoes.ts`, `app/entrar/page.tsx`, `app/fora-do-horario/page.tsx` (novo) | horário no painel | 9 |
| os arquivos que chamam `temPermissao` / `u.permissoes` (lista na Task 9) | troca por `temNivel` / `usaAssistente` | 9 |
| `apps/painel/e2e/horario-acesso.spec.ts` (novo), `e2e/apoio.ts` | e2e do horário | 9 |
| `apps/painel/src/app/(painel)/usuarios/esquemas.ts` (+ teste), `acoes.ts` (+ teste) | ler o formulário, salvar, convidar, reenviar convite | 10 |
| `apps/painel/src/app/(painel)/usuarios/ficha-usuario.tsx`, `reenviar-convite.tsx`, `aviso-contato.tsx`, `novo/page.tsx`, `[id]/page.tsx`, `[id]/loading.tsx` (novos) | ficha em página inteira | 11 |
| `apps/painel/src/app/(painel)/usuarios/page.tsx`; apagar `formulario-usuario.tsx` e `convite-usuario.tsx` | lista nova | 12 |
| `apps/painel/e2e/usuarios-ficha.spec.ts` (novo), `usuarios-erros.spec.ts`, `configuracoes.spec.ts`, `revisao-final.spec.ts`, `treinar-agente.spec.ts`, `arquivar-usuarios.spec.ts`, `acessibilidade.spec.ts`, `aquecer.ts` | e2e da ficha e dos antigos | 11, 12 |
| `apps/painel/src/components/layout/trilha.ts` (+ teste) | trilha das páginas novas | 11 |
| Atendimento, Demandas (painel lateral, Nova demanda, CSV), Configurações, Clientes/Contatos (arquivar) | telas pelos níveis | 13 |
| `docs/design-system.md`, `docs/operacao.md`, `app/(painel)/_design` | catálogo e manual | 14 |

---
### Task 1: Banco. Testes de regressão que congelam o que cada pessoa vê hoje

Este teste é de **caracterização**: ele passa com o código de hoje (é a fotografia do "antes") e tem de continuar passando, sem nenhuma linha mudada, depois de cada migração desta parte. Não há passo "ver falhar".

**Files:**
- Create: `supabase/tests/22_regressao_visibilidade.test.sql`

**Interfaces:**
- Consumes: as funções e políticas de hoje (`pode_ver_chamado`, `pode_ver_conversa`, `tem_permissao(text)`, `meus_setores`, `exigir_arquivar`, `nota_interna`, `eh_telefone_do_assistente`, as visões `demandas_lista` e `caixa_entrada`, a publicação `supabase_realtime`).
- Produces: o arquivo congelado. Nenhuma task seguinte o edita.

Pessoas do teste (fixas): **Admin**; **Ana** (Fiscal, sem marcação, responsável por uma demanda do Contábil); **Caio** (Pessoal, `editar_clientes`, assumiu uma conversa sem demanda); **Duda** (sem setor, `assistente_site`, `assistente_whatsapp`, `treinar_agente`, telefone, responsável por uma demanda do Pessoal); **Eva** (Fiscal e Pessoal, `editar_precos`, `emitir_notas`); **Ex** (Fiscal, `editar_clientes`, arquivado). Cinco demandas (R1 Fiscal aberta, R2 Pessoal da Duda, R3 Triagem, R4 Contábil da Ana, R5 Fiscal concluída), cinco conversas e dois alertas.

- [ ] **Passo 1: ligar o Supabase local nas portas 563xx** (Restrições globais, itens 1 a 4) e `supabase db reset`.

- [ ] **Passo 2: escrever o teste**

Crie `supabase/tests/22_regressao_visibilidade.test.sql`:

```sql
-- Parte D, Task 1: o que cada pessoa vê e pode fazer HOJE, antes dos níveis (spec 7.3, "risco principal").
-- Este arquivo não muda depois do commit da Task 1. Se falhar depois de uma migração da Parte D, a migração mudou o
-- que alguém vê sem o administrador mexer: corrija a migração, nunca este teste.
begin;
create extension if not exists pgtap with schema extensions;
select plan(71);

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'admin@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000b', 'ana@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000c', 'caio@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000d', 'duda@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000e', 'eva@regressao.local'),
  ('d0000000-0000-0000-0000-00000000000f', 'ex@regressao.local');
insert into public.usuarios (id, nome, email, papel, permissoes, telefone) values
  ('d0000000-0000-0000-0000-00000000000a', 'Admin R', 'admin@regressao.local', 'admin', '{}', null),
  ('d0000000-0000-0000-0000-00000000000b', 'Ana R', 'ana@regressao.local', 'atendente', '{}', null),
  ('d0000000-0000-0000-0000-00000000000c', 'Caio R', 'caio@regressao.local', 'atendente', '{editar_clientes}', null),
  ('d0000000-0000-0000-0000-00000000000d', 'Duda R', 'duda@regressao.local', 'atendente',
   '{assistente_site,assistente_whatsapp,treinar_agente}', '5531988880099'),
  ('d0000000-0000-0000-0000-00000000000e', 'Eva R', 'eva@regressao.local', 'atendente', '{editar_precos,emitir_notas}', null),
  ('d0000000-0000-0000-0000-00000000000f', 'Ex R', 'ex@regressao.local', 'atendente', '{editar_clientes}', null);
update public.usuarios set ativo = false where id = 'd0000000-0000-0000-0000-00000000000f';
insert into public.usuario_setores (usuario_id, setor_id)
select v.u, s.id
from (values ('d0000000-0000-0000-0000-00000000000b'::uuid, 'Fiscal'), ('d0000000-0000-0000-0000-00000000000c'::uuid, 'Pessoal'),
             ('d0000000-0000-0000-0000-00000000000e'::uuid, 'Fiscal'), ('d0000000-0000-0000-0000-00000000000e'::uuid, 'Pessoal'),
             ('d0000000-0000-0000-0000-00000000000f'::uuid, 'Fiscal')) v(u, nome)
join public.setores s on s.nome = v.nome;

insert into public.clientes (id, razao_social, cnpj) values ('d1000000-0000-0000-0000-000000000001', 'Regressão Ltda', '11222333000181');
insert into public.conversas (id, telefone, estado, atendente_id) values
  ('d2000000-0000-0000-0000-000000000001', '5531977770001', 'agente', null),
  ('d2000000-0000-0000-0000-000000000002', '5531977770002', 'agente', null),
  ('d2000000-0000-0000-0000-000000000003', '5531977770003', 'humano', 'd0000000-0000-0000-0000-00000000000c'),
  ('d2000000-0000-0000-0000-000000000004', '5531977770004', 'agente', null),
  ('d2000000-0000-0000-0000-000000000005', '5531977770005', 'agente', null);
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo)
select id, 'entrada', 'cliente', 'texto', 'oi ' || telefone from public.conversas where telefone like '553197777000_';
insert into public.chamados (id, cliente_id, conversa_id, setor_id, responsavel_id, titulo, status, concluido_em) values
  ('d3000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000001',
   (select id from public.setores where nome = 'Fiscal'), null, 'R1 Fiscal aberta', 'aberto', null),
  ('d3000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002',
   (select id from public.setores where nome = 'Pessoal'), 'd0000000-0000-0000-0000-00000000000d', 'R2 Pessoal da Duda', 'em_andamento', null),
  ('d3000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000005',
   null, null, 'R3 Triagem', 'aberto', null),
  ('d3000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000001', null,
   (select id from public.setores where nome = 'Contábil'), 'd0000000-0000-0000-0000-00000000000b', 'R4 Contábil da Ana', 'aberto', null),
  ('d3000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000001', null,
   (select id from public.setores where nome = 'Fiscal'), null, 'R5 Fiscal concluída', 'concluido', now());
insert into public.alertas (nivel, setor_id, usuario_id, mensagem) values
  ('aviso', (select id from public.setores where nome = 'Fiscal'), null, 'R alerta do Fiscal'),
  ('aviso', (select id from public.setores where nome = 'Contábil'), 'd0000000-0000-0000-0000-00000000000b', 'R alerta da Ana');

set local role authenticated;

-- ===== Leituras (9 por pessoa) =====

-- Administrador
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'R_ %' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R3 Triagem', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'admin: demandas');
select is(array(select titulo from public.demandas_lista where titulo like 'R_ %' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R3 Triagem', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'admin: lista das demandas');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['1', '2', '3', '4', '5'], 'admin: linha do tempo das demandas');
select is(array(select telefone from public.conversas where telefone like '553197777000_' order by telefone),
  array['5531977770001', '5531977770002', '5531977770003', '5531977770004', '5531977770005'], 'admin: conversas');
select is(array(select conteudo from public.mensagens where conteudo like 'oi 553197777000_' order by conteudo),
  array['oi 5531977770001', 'oi 5531977770002', 'oi 5531977770003', 'oi 5531977770004', 'oi 5531977770005'], 'admin: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone like '553197777000_' order by telefone),
  array['5531977770001', '5531977770002', '5531977770003', '5531977770004', '5531977770005'], 'admin: Atendimento');
select is(array(select mensagem from public.alertas where mensagem like 'R alerta%' order by mensagem),
  array['R alerta da Ana', 'R alerta do Fiscal'], 'admin: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente'], 'admin: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), '{}'::text[], 'admin: setores');

-- Ana (Fiscal)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'R_ %' order by titulo),
  array['R1 Fiscal aberta', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'Ana: demandas do Fiscal e a dela');
select is(array(select titulo from public.demandas_lista where titulo like 'R_ %' order by titulo),
  array['R1 Fiscal aberta', 'R4 Contábil da Ana', 'R5 Fiscal concluída'], 'Ana: lista das demandas');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['1', '4', '5'], 'Ana: linha do tempo');
select is(array(select telefone from public.conversas where telefone like '553197777000_' order by telefone),
  array['5531977770001'], 'Ana: conversas');
select is(array(select conteudo from public.mensagens where conteudo like 'oi 553197777000_' order by conteudo),
  array['oi 5531977770001'], 'Ana: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone like '553197777000_' order by telefone),
  array['5531977770001'], 'Ana: Atendimento');
select is(array(select mensagem from public.alertas where mensagem like 'R alerta%' order by mensagem),
  array['R alerta da Ana', 'R alerta do Fiscal'], 'Ana: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  '{}'::text[], 'Ana: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), array['Fiscal'], 'Ana: setores');

-- Caio (Pessoal, assumiu a conversa 3)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'R_ %' order by titulo), array['R2 Pessoal da Duda'], 'Caio: demandas');
select is(array(select titulo from public.demandas_lista where titulo like 'R_ %' order by titulo), array['R2 Pessoal da Duda'], 'Caio: lista');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['2'], 'Caio: linha do tempo');
select is(array(select telefone from public.conversas where telefone like '553197777000_' order by telefone),
  array['5531977770002', '5531977770003'], 'Caio: conversas do Pessoal e a que assumiu');
select is(array(select conteudo from public.mensagens where conteudo like 'oi 553197777000_' order by conteudo),
  array['oi 5531977770002', 'oi 5531977770003'], 'Caio: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone like '553197777000_' order by telefone),
  array['5531977770002', '5531977770003'], 'Caio: Atendimento');
select is(array(select mensagem from public.alertas where mensagem like 'R alerta%' order by mensagem), '{}'::text[], 'Caio: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['editar_clientes'], 'Caio: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), array['Pessoal'], 'Caio: setores');

-- Duda (sem setor, responsável pela R2)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'R_ %' order by titulo), array['R2 Pessoal da Duda'], 'Duda: só a dela');
select is(array(select titulo from public.demandas_lista where titulo like 'R_ %' order by titulo), array['R2 Pessoal da Duda'], 'Duda: lista');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['2'], 'Duda: linha do tempo');
select is(array(select telefone from public.conversas where telefone like '553197777000_' order by telefone),
  array['5531977770002'], 'Duda: conversa da demanda dela');
select is(array(select conteudo from public.mensagens where conteudo like 'oi 553197777000_' order by conteudo),
  array['oi 5531977770002'], 'Duda: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone like '553197777000_' order by telefone),
  array['5531977770002'], 'Duda: Atendimento');
select is(array(select mensagem from public.alertas where mensagem like 'R alerta%' order by mensagem), '{}'::text[], 'Duda: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['assistente_site', 'assistente_whatsapp', 'treinar_agente'], 'Duda: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), '{}'::text[], 'Duda: setores');

-- Eva (Fiscal e Pessoal)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'R_ %' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R5 Fiscal concluída'], 'Eva: demandas dos dois setores');
select is(array(select titulo from public.demandas_lista where titulo like 'R_ %' order by titulo),
  array['R1 Fiscal aberta', 'R2 Pessoal da Duda', 'R5 Fiscal concluída'], 'Eva: lista');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  array['1', '2', '5'], 'Eva: linha do tempo');
select is(array(select telefone from public.conversas where telefone like '553197777000_' order by telefone),
  array['5531977770001', '5531977770002'], 'Eva: conversas');
select is(array(select conteudo from public.mensagens where conteudo like 'oi 553197777000_' order by conteudo),
  array['oi 5531977770001', 'oi 5531977770002'], 'Eva: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone like '553197777000_' order by telefone),
  array['5531977770001', '5531977770002'], 'Eva: Atendimento');
select is(array(select mensagem from public.alertas where mensagem like 'R alerta%' order by mensagem), array['R alerta do Fiscal'], 'Eva: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  array['editar_precos', 'emitir_notas'], 'Eva: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), array['Fiscal', 'Pessoal'], 'Eva: setores');

-- Ex (arquivado)
select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'R_ %' order by titulo), '{}'::text[], 'Ex: nada');
select is(array(select titulo from public.demandas_lista where titulo like 'R_ %' order by titulo), '{}'::text[], 'Ex: lista vazia');
select is(array(select distinct right(chamado_id::text, 1) from public.chamado_eventos where chamado_id::text like 'd3000000-%' order by 1),
  '{}'::text[], 'Ex: linha do tempo vazia');
select is(array(select telefone from public.conversas where telefone like '553197777000_' order by telefone), '{}'::text[], 'Ex: conversas');
select is(array(select conteudo from public.mensagens where conteudo like 'oi 553197777000_' order by conteudo), '{}'::text[], 'Ex: mensagens');
select is(array(select telefone from public.caixa_entrada where telefone like '553197777000_' order by telefone), '{}'::text[], 'Ex: Atendimento');
select is(array(select mensagem from public.alertas where mensagem like 'R alerta%' order by mensagem), '{}'::text[], 'Ex: alertas');
select is(array(select p from unnest(array['editar_clientes', 'editar_precos', 'emitir_notas', 'assistente_site', 'assistente_whatsapp', 'treinar_agente']) p where public.tem_permissao(p)),
  '{}'::text[], 'Ex: permissões');
select is(array(select s.nome from public.setores s where s.id in (select public.meus_setores()) order by s.nome), '{}'::text[], 'Ex: setores');

-- ===== Gravações =====

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.nota_interna('d3000000-0000-0000-0000-000000000001', 'nota R') $$, 'Ana: nota interna no Fiscal');
select throws_ok($$ select public.nota_interna('d3000000-0000-0000-0000-000000000002', 'nota R') $$,
  'P0001', 'sem acesso a este chamado', 'Ana: sem nota no Pessoal');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('R Nova', '99888777000166') $$, '42501', null, 'Ana: não cria cliente');
select throws_ok($$ select public.exigir_arquivar('cliente') $$, 'P0001', 'Sem permissão para arquivar cadastros.', 'Ana: não arquiva');
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                    values ('d0000000-0000-0000-0000-00000000000b', 'site', 'usuario', 'pergunta R') $$, '42501', null, 'Ana: sem assistente');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ insert into public.clientes (razao_social, cnpj) values ('R Outra', '55444333000122') $$, 'Caio: cria cliente');
select lives_ok($$ select public.exigir_arquivar('cliente') $$, 'Caio: arquiva');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.exigir_arquivar('cliente') $$, 'P0001', 'Sem permissão para arquivar cadastros.', 'Eva: não arquiva');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                   values ('d0000000-0000-0000-0000-00000000000d', 'site', 'usuario', 'pergunta R') $$, 'Duda: pergunta ao assistente');
select ok(public.eh_telefone_do_assistente('5531988880099'), 'telefone da Duda é do assistente');
select ok(not public.eh_telefone_do_assistente('5531977770001'), 'telefone de cliente não é do assistente');

select set_config('request.jwt.claims', '{"sub":"d0000000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select throws_ok($$ select public.nota_interna('d3000000-0000-0000-0000-000000000001', 'nota R') $$,
  'P0001', 'sem acesso a este chamado', 'Ex: arquivado não grava');

-- ===== Realtime: as mesmas tabelas, filtradas pelas mesmas regras de leitura =====
select is(array(select tablename::text from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' order by 1),
  array['assistente_mensagens', 'chamados', 'conversas', 'mensagens', 'simulacoes_agente'], 'Realtime: tabelas publicadas');
select matches((select qual from pg_policies where schemaname = 'public' and tablename = 'chamados' and policyname = 'leitura'),
  'pode_ver_chamado\(id\)', 'Realtime: demandas pela regra de leitura');
select matches((select qual from pg_policies where schemaname = 'public' and tablename = 'conversas' and policyname = 'leitura'),
  'pode_ver_conversa\(id\)', 'Realtime: conversas pela regra de leitura');
select matches((select qual from pg_policies where schemaname = 'public' and tablename = 'mensagens' and policyname = 'leitura'),
  'pode_ver_conversa\(conversa_id\)', 'Realtime: mensagens pela regra de leitura');
select ok(has_table_privilege('authenticated', 'public.chamados', 'select') and has_table_privilege('authenticated', 'public.conversas', 'select')
  and has_table_privilege('authenticated', 'public.mensagens', 'select'), 'Realtime: a equipe lê pelas políticas');

select * from finish();
rollback;
```

O Realtime (`postgres_changes`) entrega cada mudança só a quem a política `leitura` deixa ler, avaliada com o token de quem assina. Por isso o teste congela três coisas: as tabelas publicadas, a política de cada uma e o que cada pessoa lê por ela. O servidor do Realtime em si não roda dentro do pgTAP; a Entrega confere ao vivo (roteiro, item 6).

- [ ] **Passo 3: rodar e guardar o resultado do "antes"**

```bash
supabase test db 2>&1 | tee "$SCRATCH/regressao-antes.txt"
```

Expected: o arquivo `22_regressao_visibilidade.test.sql` com **71/71**, e todos os outros arquivos como estavam. Se alguma asserção falhar **agora**, o erro é do teste (o fixture não reproduz algum detalhe do banco de hoje, por exemplo um gatilho da Parte C que não grava evento para demanda criada já concluída). Corrija o **valor esperado** para o que o banco de hoje devolve, explique no commit qual foi e por quê, e rode de novo. Depois do commit, o arquivo não muda mais.

- [ ] **Passo 4: commit**

```bash
git add supabase/tests/22_regressao_visibilidade.test.sql
git commit -m "test(banco): regressão congela o que cada pessoa vê e faz antes dos níveis

Demandas, lista, linha do tempo, conversas, mensagens, Atendimento, alertas,
permissões, setores, gravações principais e Realtime, para seis pessoas
(administrador, setores, responsável, sem setor, assistente, arquivado).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git rev-parse HEAD > "$SCRATCH/commit-regressao.txt"
```

---

### Task 2: Banco. Níveis por módulo, conversão das permissões de hoje e adaptador

**Files:**
- Create: `supabase/migrations/20261004000100_painel_v2_niveis.sql`
- Create: `supabase/tests/23_painel_v2_niveis.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consumes: `usuarios.permissoes`, `registrar_auditoria()` (gatilho da auditoria).
- Produces (usadas nas tasks seguintes):
  - tabela `public.permissao_niveis(modulo text, nivel text, ordem smallint)`; tabela `public.usuario_permissoes(usuario_id uuid, modulo text, nivel text)` com PK `(usuario_id, modulo)`;
  - `public.nivel_padrao(p_modulo text) returns text`; `public.niveis_com_padrao(p_parcial jsonb) returns jsonb`;
  - `public.niveis_do_usuario(p_usuario uuid) returns jsonb` (os 9 módulos; executável pela equipe e pelo serviço);
  - `public.nivel_de(p_usuario uuid, p_modulo text) returns text` (só serviço e funções do banco);
  - `public.eh_admin_de(p_usuario uuid) returns boolean`, `public.usuario_liberado(p_usuario uuid) returns boolean`, `public.tem_nivel_de(p_usuario uuid, p_modulo text, p_minimo text) returns boolean` (só serviço e funções);
  - `public.tem_nivel(p_modulo text, p_minimo text) returns boolean` (sem passe livre do administrador);
  - `public.tem_permissao(p_modulo text, p_minimo text) returns boolean` (administrador passa);
  - `public.tem_permissao(p text) returns boolean` (adaptador das 6 marcações antigas);
  - colunas `usuarios.cargo`, `usuarios.observacoes`, `usuarios.ultimo_acesso_em`.

- [ ] **Passo 1: o teste**

Crie `supabase/tests/23_painel_v2_niveis.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email) values
  ('d1100000-0000-0000-0000-00000000000a', 'admin@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000b', 'bia@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000c', 'caio@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000d', 'wal@niveis.local'),
  ('d1100000-0000-0000-0000-00000000000e', 'zeca@niveis.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('d1100000-0000-0000-0000-00000000000a', 'Admin N', 'admin@niveis.local', 'admin', '{}'),
  ('d1100000-0000-0000-0000-00000000000b', 'Bia N', 'bia@niveis.local', 'atendente', '{}'),
  ('d1100000-0000-0000-0000-00000000000c', 'Caio N', 'caio@niveis.local', 'atendente',
   '{editar_clientes,editar_precos,emitir_notas,assistente_site,treinar_agente}'),
  ('d1100000-0000-0000-0000-00000000000d', 'Wal N', 'wal@niveis.local', 'atendente', '{assistente_whatsapp}'),
  ('d1100000-0000-0000-0000-00000000000e', 'Zeca N', 'zeca@niveis.local', 'atendente', '{qualquer_coisa}');

select is((select count(*)::int from public.permissao_niveis), 23, 'catálogo: 23 níveis em 9 módulos');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000b'),
  '{"atendimento":"meus_setores","demandas":"meu_setor","clientes":"ver","precos":"ver","notas":"ver","assistente":"sem_acesso","treinar":"nao","prazos":"sim","configuracoes":"nao"}'::jsonb,
  'sem marcação: os níveis que reproduzem o de hoje');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') - array['atendimento', 'demandas', 'prazos', 'configuracoes'],
  '{"clientes":"arquivar","precos":"mudar","notas":"corrigir","assistente":"site","treinar":"sim"}'::jsonb,
  'cada marcação antiga vira o nível equivalente (editar_clientes = Editar e arquivar)');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000d') ->> 'assistente', 'site_whatsapp', 'só WhatsApp vira Site e WhatsApp (P2)');
select is((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000d'),
  '{assistente_site,assistente_whatsapp}'::text[], 'a cópia antiga acompanha o nível');
select is((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000e'), '{}'::text[], 'marcação desconhecida some da cópia');
select is((select count(*)::int from public.usuario_permissoes where usuario_id = 'd1100000-0000-0000-0000-00000000000b'), 9,
  'pessoa nova ganha os 9 módulos');
select is(public.niveis_da_permissao_legada('{emitir_notas}', '{}'::jsonb),
  '{"clientes":"ver","precos":"ver","notas":"corrigir","assistente":"sem_acesso","treinar":"nao"}'::jsonb,
  'a conversão que a migração usou nas pessoas que já existiam');

-- Painel novo baixa Clientes para "Ver e editar": a cópia antiga continua com editar_clientes.
update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'd1100000-0000-0000-0000-00000000000c' and modulo = 'clientes';
select ok('editar_clientes' = any ((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000c')),
  '"Ver e editar" aparece como editar_clientes na cópia');
-- Painel antigo da homologação salva a pessoa mudando outra coisa (tira treinar): não promove para arquivar (foco da revisão 2).
update public.usuarios set permissoes = '{editar_clientes,editar_precos,emitir_notas,assistente_site}' where id = 'd1100000-0000-0000-0000-00000000000c';
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') ->> 'clientes', 'editar', 'painel antigo não promove "Ver e editar"');
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') ->> 'treinar', 'nao', 'painel antigo tira "Treinar o agente"');
update public.usuarios set permissoes = '{}' where id = 'd1100000-0000-0000-0000-00000000000c';
select is(public.niveis_do_usuario('d1100000-0000-0000-0000-00000000000c') ->> 'clientes', 'ver', 'painel antigo tira editar_clientes');
-- Nível novo aparece na cópia (o trabalhador antigo da homologação lê o array).
update public.usuario_permissoes set nivel = 'site_whatsapp' where usuario_id = 'd1100000-0000-0000-0000-00000000000c' and modulo = 'assistente';
select is((select permissoes from public.usuarios where id = 'd1100000-0000-0000-0000-00000000000c'),
  '{assistente_site,assistente_whatsapp}'::text[], 'nível novo aparece na cópia antiga');

update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'd1100000-0000-0000-0000-00000000000b' and modulo = 'clientes';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d1100000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(public.tem_permissao('clientes', 'editar'), 'Bia: Ver e editar');
select ok(not public.tem_permissao('clientes', 'arquivar'), 'Bia: não arquiva');
select ok(public.tem_permissao('editar_clientes'), 'adaptador: editar_clientes = "Ver e editar" ou mais');
select throws_ok($$ select public.tem_permissao('clientes', 'tudo') $$, 'P0001', 'Nível desconhecido: clientes/tudo.',
  'nível digitado errado não passa calado');
select throws_ok($$ insert into public.usuario_permissoes (usuario_id, modulo, nivel) values ('d1100000-0000-0000-0000-00000000000e', 'demandas', 'todas') $$,
  '42501', null, 'atendente não muda nível');

select set_config('request.jwt.claims', '{"sub":"d1100000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ update public.usuario_permissoes set nivel = 'todas' where usuario_id = 'd1100000-0000-0000-0000-00000000000b' and modulo = 'demandas' $$,
  'administrador muda o nível');
select ok(not public.tem_nivel('assistente', 'site'), 'tem_nivel: administrador sem a marcação do assistente não usa o assistente (como hoje)');
select ok(public.tem_permissao('assistente', 'site'), 'tem_permissao: administrador passa');
reset role;
select is((select count(*)::int from public.auditoria_acessos
           where entidade = 'usuario_permissoes' and usuario_id = 'd1100000-0000-0000-0000-00000000000a'), 1, 'auditoria guarda quem mudou o nível');
select has_column('public', 'usuarios', 'cargo', 'cargo');
select has_column('public', 'usuarios', 'observacoes', 'observações');
select has_column('public', 'usuarios', 'ultimo_acesso_em', 'último acesso');

select * from finish();
rollback;
```

- [ ] **Passo 2: ver falhar**

Run: `supabase test db`
Expected: `23_painel_v2_niveis.test.sql` falha já na primeira asserção (`relation "public.permissao_niveis" does not exist`). O 22 continua 71/71.

- [ ] **Passo 3: a migração**

Crie `supabase/migrations/20261004000100_painel_v2_niveis.sql`:

```sql
-- supabase/migrations/20261004000100_painel_v2_niveis.sql
-- Painel v2, Parte D (spec 7.1 e 7.2): permissões por módulo com nível, no lugar das 6 marcações antigas.
-- Ninguém ganha nem perde acesso aqui: cada marcação vira o nível equivalente, e o que não era marcação (Atendimento,
-- Demandas, Prazos, Configurações) fica no nível que reproduz o comportamento de hoje.
-- usuarios.permissoes continua como cópia mantida pelo banco, nos dois sentidos: os painéis e o trabalhador antigos
-- da homologação (e os testes que gravam o array) seguem funcionando até a coluna sair numa parte futura.

-- ---------- Catálogo ----------

create table public.permissao_niveis (
  modulo text not null,
  nivel text not null,
  ordem smallint not null,
  primary key (modulo, nivel),
  unique (modulo, ordem)
);
insert into public.permissao_niveis (modulo, nivel, ordem) values
  ('atendimento', 'sem_acesso', 0), ('atendimento', 'meus_setores', 1), ('atendimento', 'todas', 2),
  ('demandas', 'minhas', 0), ('demandas', 'meu_setor', 1), ('demandas', 'todas', 2),
  ('clientes', 'ver', 0), ('clientes', 'editar', 1), ('clientes', 'arquivar', 2),
  ('precos', 'ver', 0), ('precos', 'mudar', 1),
  ('notas', 'sem_acesso', 0), ('notas', 'ver', 1), ('notas', 'corrigir', 2),
  ('assistente', 'sem_acesso', 0), ('assistente', 'site', 1), ('assistente', 'site_whatsapp', 2),
  ('treinar', 'nao', 0), ('treinar', 'sim', 1),
  ('prazos', 'nao', 0), ('prazos', 'sim', 1),
  ('configuracoes', 'nao', 0), ('configuracoes', 'sim', 1);
alter table public.permissao_niveis enable row level security;
create policy leitura on public.permissao_niveis for select to authenticated using (true);
revoke insert, update, delete on public.permissao_niveis from authenticated, anon;

-- Nível que reproduz o comportamento de hoje para quem não tem marcação nenhuma.
create function public.nivel_padrao(p_modulo text) returns text
language sql immutable set search_path = '' as $$
  select case p_modulo
    when 'atendimento' then 'meus_setores' when 'demandas' then 'meu_setor' when 'clientes' then 'ver'
    when 'precos' then 'ver' when 'notas' then 'ver' when 'assistente' then 'sem_acesso'
    when 'treinar' then 'nao' when 'prazos' then 'sim' when 'configuracoes' then 'nao'
  end
$$;

-- Os 9 módulos, com o padrão onde o parcial não diz nada.
create function public.niveis_com_padrao(p_parcial jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_object_agg(m, coalesce(p_parcial ->> m, public.nivel_padrao(m)))
  from unnest(array['atendimento', 'demandas', 'clientes', 'precos', 'notas', 'assistente', 'treinar', 'prazos', 'configuracoes']) m
$$;

-- ---------- Níveis de cada pessoa (fonte da verdade) ----------

create table public.usuario_permissoes (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  modulo text not null,
  nivel text not null,
  primary key (usuario_id, modulo),
  foreign key (modulo, nivel) references public.permissao_niveis (modulo, nivel)
);
alter table public.usuario_permissoes enable row level security;
create policy leitura on public.usuario_permissoes for select to authenticated using (public.eh_usuario_ativo());
create policy escrita_admin on public.usuario_permissoes for all to authenticated using (public.eh_admin()) with check (public.eh_admin());
create trigger auditoria after insert or update or delete on public.usuario_permissoes
  for each row execute function public.registrar_auditoria();

create function public.niveis_do_usuario(p_usuario uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.niveis_com_padrao(coalesce(
    (select jsonb_object_agg(modulo, nivel) from public.usuario_permissoes where usuario_id = p_usuario), '{}'::jsonb))
$$;
revoke execute on function public.niveis_do_usuario(uuid) from public, anon;
grant execute on function public.niveis_do_usuario(uuid) to authenticated, service_role;

create function public.nivel_de(p_usuario uuid, p_modulo text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select nivel from public.usuario_permissoes where usuario_id = p_usuario and modulo = p_modulo),
                  public.nivel_padrao(p_modulo))
$$;
revoke execute on function public.nivel_de(uuid, text) from public, anon, authenticated;
grant execute on function public.nivel_de(uuid, text) to service_role;

-- ---------- Conversão das marcações antigas ----------

-- Níveis que as marcações antigas dão. p_atual: os níveis de agora (o painel antigo não promove nem rebaixa o que
-- ele não sabe mostrar: "Ver e editar" continua "Ver e editar"; "Sem acesso" a pedidos continua "Sem acesso").
create function public.niveis_da_permissao_legada(p text[], p_atual jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'clientes', case when 'editar_clientes' = any (p)
                     then case when p_atual ->> 'clientes' in ('editar', 'arquivar') then p_atual ->> 'clientes' else 'arquivar' end
                     else 'ver' end,
    'precos', case when 'editar_precos' = any (p) then 'mudar' else 'ver' end,
    'notas', case when 'emitir_notas' = any (p) then 'corrigir'
                  when p_atual ->> 'notas' = 'sem_acesso' then 'sem_acesso' else 'ver' end,
    'assistente', case when 'assistente_whatsapp' = any (p) then 'site_whatsapp'
                       when 'assistente_site' = any (p) then 'site' else 'sem_acesso' end,
    'treinar', case when 'treinar_agente' = any (p) then 'sim' else 'nao' end)
$$;

-- A cópia antiga que os níveis dão (sempre na mesma ordem).
create function public.permissoes_dos_niveis(n jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select array_remove(array[
    case when n ->> 'clientes' in ('editar', 'arquivar') then 'editar_clientes' end,
    case when n ->> 'precos' = 'mudar' then 'editar_precos' end,
    case when n ->> 'notas' = 'corrigir' then 'emitir_notas' end,
    case when n ->> 'assistente' in ('site', 'site_whatsapp') then 'assistente_site' end,
    case when n ->> 'assistente' = 'site_whatsapp' then 'assistente_whatsapp' end,
    case when n ->> 'treinar' = 'sim' then 'treinar_agente' end
  ], null)
$$;

-- Quem já existe: os 9 módulos pelo que tem hoje.
insert into public.usuario_permissoes (usuario_id, modulo, nivel)
select u.id, n.key, n.value
from public.usuarios u,
     lateral jsonb_each_text(public.niveis_com_padrao(public.niveis_da_permissao_legada(u.permissoes, '{}'::jsonb))) n;

-- P2: quem tinha o assistente só pelo WhatsApp passa a ter também o site. Aparece no --dry-run para o dono conferir.
do $$
declare r record;
begin
  for r in select nome from public.usuarios
           where 'assistente_whatsapp' = any (permissoes) and not ('assistente_site' = any (permissoes)) loop
    raise notice 'Parte D: % tinha o assistente só pelo WhatsApp e agora tem "Site e WhatsApp".', r.nome;
  end loop;
end $$;

update public.usuarios u set permissoes = public.permissoes_dos_niveis(public.niveis_do_usuario(u.id))
where u.permissoes is distinct from public.permissoes_dos_niveis(public.niveis_do_usuario(u.id));

-- ---------- Cópia nos dois sentidos ----------

-- Pessoa nova por qualquer caminho (painel novo, painel antigo, testes): a cópia já sai normalizada...
create function public.usuarios_permissoes_antes_inserir() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.permissoes := public.permissoes_dos_niveis(public.niveis_com_padrao(public.niveis_da_permissao_legada(new.permissoes, '{}'::jsonb)));
  return new;
end $$;
create trigger permissoes_antes_inserir before insert on public.usuarios
  for each row execute function public.usuarios_permissoes_antes_inserir();

-- ... e os 9 módulos são criados.
create function public.usuarios_niveis_depois_inserir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuario_permissoes (usuario_id, modulo, nivel)
  select new.id, n.key, n.value
  from jsonb_each_text(public.niveis_com_padrao(public.niveis_da_permissao_legada(new.permissoes, '{}'::jsonb))) n
  on conflict (usuario_id, modulo) do nothing;
  return null;
end $$;
create trigger niveis_depois_inserir after insert on public.usuarios
  for each row execute function public.usuarios_niveis_depois_inserir();

-- Painel antigo (ou teste) grava o array: os níveis acompanham, sem promover "Ver e editar" a "Editar e arquivar".
create function public.usuarios_permissoes_antes_alterar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v jsonb;
begin
  -- Cópia escrita pelo próprio banco (gatilho de usuario_permissoes): não volta.
  if pg_trigger_depth() > 1 then return new; end if;
  v := public.niveis_da_permissao_legada(new.permissoes, public.niveis_do_usuario(new.id));
  insert into public.usuario_permissoes as up (usuario_id, modulo, nivel)
  select new.id, n.key, n.value from jsonb_each_text(v) n
  on conflict (usuario_id, modulo) do update set nivel = excluded.nivel where up.nivel is distinct from excluded.nivel;
  new.permissoes := public.permissoes_dos_niveis(public.niveis_do_usuario(new.id) || v);
  return new;
end $$;
create trigger permissoes_antes_alterar before update of permissoes on public.usuarios
  for each row when (new.permissoes is distinct from old.permissoes)
  execute function public.usuarios_permissoes_antes_alterar();

-- Nível mudado (painel novo, salvar_usuario): a cópia antiga acompanha.
create function public.usuario_permissoes_espelhar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_id uuid := coalesce(new.usuario_id, old.usuario_id);
begin
  -- Linhas criadas pelos gatilhos de usuarios já saem com a cópia certa.
  if pg_trigger_depth() > 1 then return null; end if;
  update public.usuarios set permissoes = public.permissoes_dos_niveis(public.niveis_do_usuario(v_id))
  where id = v_id and permissoes is distinct from public.permissoes_dos_niveis(public.niveis_do_usuario(v_id));
  return null;
end $$;
create trigger espelhar_permissoes after insert or update or delete on public.usuario_permissoes
  for each row execute function public.usuario_permissoes_espelhar();

-- ---------- Regras com a pessoa (o trabalhador usa com a chave de serviço) ----------

create function public.eh_admin_de(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = p_usuario and ativo and papel = 'admin')
$$;

-- Pessoa que pode usar o sistema agora. A migração do horário troca o corpo; todas as regras passam por aqui.
create function public.usuario_liberado(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios where id = p_usuario and ativo)
$$;

create function public.tem_nivel_de(p_usuario uuid, p_modulo text, p_minimo text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare v_minimo smallint;
begin
  select ordem into v_minimo from public.permissao_niveis where modulo = p_modulo and nivel = p_minimo;
  if v_minimo is null then raise exception 'Nível desconhecido: %/%.', p_modulo, p_minimo; end if;
  return public.usuario_liberado(p_usuario) and coalesce((
    select n.ordem >= v_minimo from public.permissao_niveis n
    where n.modulo = p_modulo and n.nivel = public.nivel_de(p_usuario, p_modulo)), false);
end $$;

revoke execute on function public.eh_admin_de(uuid), public.usuario_liberado(uuid), public.tem_nivel_de(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.eh_admin_de(uuid), public.usuario_liberado(uuid), public.tem_nivel_de(uuid, text, text) to service_role;

-- As de sempre, agora pelas versões com a pessoa (mesmo resultado; o teste 22 confere).
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = '' as $$ select public.eh_admin_de(auth.uid()) $$;

create or replace function public.eh_usuario_ativo() returns boolean
language sql stable security definer set search_path = '' as $$ select public.usuario_liberado(auth.uid()) $$;

create or replace function public.meus_setores() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select us.setor_id from public.usuario_setores us
  where us.usuario_id = auth.uid() and public.usuario_liberado(auth.uid())
$$;

-- Sem passe livre do administrador: o assistente é canal e precisa da marcação (como hoje, P3).
create function public.tem_nivel(p_modulo text, p_minimo text) returns boolean
language sql stable security definer set search_path = '' as $$ select public.tem_nivel_de(auth.uid(), p_modulo, p_minimo) $$;

create function public.tem_permissao(p_modulo text, p_minimo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin() or public.tem_nivel(p_modulo, p_minimo)
$$;

-- Adaptador das chamadas antigas (políticas e funções de antes da Parte D).
create or replace function public.tem_permissao(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p
    when 'editar_clientes' then public.tem_permissao('clientes', 'editar')
    when 'editar_precos' then public.tem_permissao('precos', 'mudar')
    when 'emitir_notas' then public.tem_permissao('notas', 'corrigir')
    when 'treinar_agente' then public.tem_permissao('treinar', 'sim')
    when 'assistente_site' then public.tem_permissao('assistente', 'site')
    when 'assistente_whatsapp' then public.tem_permissao('assistente', 'site_whatsapp')
    else public.eh_admin()
  end
$$;

-- ---------- Ficha da pessoa (spec 7.2) ----------

alter table public.usuarios
  add column cargo text check (cargo is null or char_length(cargo) between 1 and 60),
  add column observacoes text check (observacoes is null or char_length(observacoes) <= 1000),
  add column ultimo_acesso_em timestamptz;
```

- [ ] **Passo 4: ver passar, inclusive a regressão**

```bash
supabase db reset
supabase test db
```

Expected: `22_regressao_visibilidade` **71/71** (nada mudou para ninguém), `23_painel_v2_niveis` **25/25**, todos os outros como antes. Se o 22 falhar, a conversão ou o adaptador mudou o que alguém vê: corrija a migração.

- [ ] **Passo 5: tipos e suítes que gravam o array antigo**

```bash
pnpm db:tipos
git diff --stat packages/db/src/tipos.gen.ts
pnpm --filter @escritorio/db test
pnpm --filter @escritorio/trabalhador test
```

Expected no diff dos tipos: as tabelas `permissao_niveis` e `usuario_permissoes`, as colunas `cargo`, `observacoes`, `ultimo_acesso_em` e as funções novas. As suítes do db e do trabalhador passam sem mudança (os ajudantes gravam `permissoes` e os gatilhos convertem).

- [ ] **Passo 6: commit**

```bash
git add supabase/migrations/20261004000100_painel_v2_niveis.sql supabase/tests/23_painel_v2_niveis.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): permissões por módulo com nível e conversão das marcações de hoje

usuario_permissoes passa a ser a fonte da verdade; editar_clientes vira
Editar e arquivar, editar_precos vira Mudar, e o que não era marcação fica no
nível de hoje. A coluna permissoes continua como cópia mantida pelo banco nos
dois sentidos (painéis e trabalhador antigos da homologação). tem_permissao
ganha a versão por nível e um adaptador para as chamadas antigas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Banco. Visibilidade e regras pelo nível

**Files:**
- Create: `supabase/migrations/20261004000200_painel_v2_visibilidade.sql`
- Create: `supabase/tests/24_painel_v2_visibilidade_niveis.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consumes (Task 2): `nivel_de`, `eh_admin_de`, `usuario_liberado`, `tem_permissao(modulo, nivel)`, `tem_nivel`.
- Produces:
  - `public.pode_ver_chamado_de(p_usuario uuid, p_chamado uuid) returns boolean` e `public.pode_ver_conversa_de(p_usuario uuid, p_conversa uuid) returns boolean` (só serviço e funções; a Task 8 compara o trabalhador com elas);
  - `pode_ver_chamado(uuid)` e `pode_ver_conversa(uuid)` com a mesma assinatura de antes;
  - mensagens novas do banco: `'Você não tem permissão para alterar prazos.'` e `'Com "Só as minhas", a demanda que você cria fica com você.'`.

- [ ] **Passo 1: o teste**

Crie `supabase/tests/24_painel_v2_visibilidade_niveis.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- Todas do Fiscal, menos o admin e Cléo: Mia (Demandas: Só as minhas), Seto (padrão), Tod (Demandas: Todas),
-- Sem (Atendimento: Sem acesso), Tc (Atendimento: Todas), Nep (Prazos: Não), Cléo (Clientes: Ver e editar),
-- Ás (Assistente: Site), Wá (Assistente: Site e WhatsApp).
insert into auth.users (id, email) values
  ('d2400000-0000-0000-0000-00000000000a', 'a@visibilidade.local'), ('d2400000-0000-0000-0000-00000000000b', 'b@visibilidade.local'),
  ('d2400000-0000-0000-0000-00000000000c', 'c@visibilidade.local'), ('d2400000-0000-0000-0000-00000000000d', 'd@visibilidade.local'),
  ('d2400000-0000-0000-0000-00000000000e', 'e@visibilidade.local'), ('d2400000-0000-0000-0000-00000000000f', 'f@visibilidade.local'),
  ('d2400000-0000-0000-0000-000000000010', 'nep@visibilidade.local'), ('d2400000-0000-0000-0000-000000000011', 'cleo@visibilidade.local'),
  ('d2400000-0000-0000-0000-000000000012', 'as@visibilidade.local'), ('d2400000-0000-0000-0000-000000000013', 'wa@visibilidade.local');
insert into public.usuarios (id, nome, email, papel, telefone) values
  ('d2400000-0000-0000-0000-00000000000a', 'Admin V', 'a@visibilidade.local', 'admin', null),
  ('d2400000-0000-0000-0000-00000000000b', 'Mia V', 'b@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000c', 'Seto V', 'c@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000d', 'Tod V', 'd@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000e', 'Sem V', 'e@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-00000000000f', 'Tc V', 'f@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-000000000010', 'Nep V', 'nep@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-000000000011', 'Cléo V', 'cleo@visibilidade.local', 'atendente', null),
  ('d2400000-0000-0000-0000-000000000012', 'Ás V', 'as@visibilidade.local', 'atendente', '5531966660001'),
  ('d2400000-0000-0000-0000-000000000013', 'Wá V', 'wa@visibilidade.local', 'atendente', '5531966660002');
insert into public.usuario_setores (usuario_id, setor_id)
select u.id, s.id from public.usuarios u, public.setores s
where s.nome = 'Fiscal' and u.email like '%@visibilidade.local' and u.papel = 'atendente' and u.email <> 'cleo@visibilidade.local';
update public.usuario_permissoes up set nivel = v.nivel
from (values ('b@visibilidade.local', 'demandas', 'minhas'), ('d@visibilidade.local', 'demandas', 'todas'),
             ('e@visibilidade.local', 'atendimento', 'sem_acesso'), ('f@visibilidade.local', 'atendimento', 'todas'),
             ('nep@visibilidade.local', 'prazos', 'nao'), ('cleo@visibilidade.local', 'clientes', 'editar'),
             ('as@visibilidade.local', 'assistente', 'site'), ('wa@visibilidade.local', 'assistente', 'site_whatsapp')) v(email, modulo, nivel),
     public.usuarios u
where u.email = v.email and up.usuario_id = u.id and up.modulo = v.modulo;

insert into public.clientes (id, razao_social, cnpj) values ('d2410000-0000-0000-0000-000000000001', 'Visibilidade Ltda', '11222333000181');
insert into public.conversas (id, telefone) values
  ('d2420000-0000-0000-0000-000000000001', '5531955550001'), ('d2420000-0000-0000-0000-000000000002', '5531955550002'),
  ('d2420000-0000-0000-0000-000000000003', '5531955550003'), ('d2420000-0000-0000-0000-000000000004', '5531955550004'),
  ('d2420000-0000-0000-0000-000000000005', '5531955550005');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo)
select id, 'entrada', 'cliente', 'texto', 'V ' || telefone from public.conversas where telefone like '553195555000_';
insert into public.chamados (id, cliente_id, conversa_id, setor_id, responsavel_id, titulo) values
  ('d2430000-0000-0000-0000-000000000001', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000001',
   (select id from public.setores where nome = 'Fiscal'), null, 'V F1 Fiscal'),
  ('d2430000-0000-0000-0000-000000000002', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000002',
   (select id from public.setores where nome = 'Fiscal'), 'd2400000-0000-0000-0000-00000000000b', 'V F2 Fiscal da Mia'),
  ('d2430000-0000-0000-0000-000000000003', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000003',
   (select id from public.setores where nome = 'Pessoal'), null, 'V P1 Pessoal'),
  ('d2430000-0000-0000-0000-000000000004', 'd2410000-0000-0000-0000-000000000001', 'd2420000-0000-0000-0000-000000000004',
   null, null, 'V T1 Triagem');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo), array['V F2 Fiscal da Mia'], 'Só as minhas: só a dela');
select is(array(select titulo from public.demandas_lista where titulo like 'V %' order by titulo), array['V F2 Fiscal da Mia'], 'Só as minhas: lista igual');
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone),
  array['5531955550001', '5531955550002'], 'o Atendimento não depende do nível de Demandas');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo),
  array['V F1 Fiscal', 'V F2 Fiscal da Mia'], 'Do meu setor: o de hoje');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo),
  array['V F1 Fiscal', 'V F2 Fiscal da Mia', 'V P1 Pessoal', 'V T1 Triagem'], 'Todas: inclusive outro setor e Triagem');
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone),
  array['5531955550001', '5531955550002'], 'Demandas Todas não abre as conversas dos outros setores');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone), '{}'::text[], 'Atendimento Sem acesso: nenhuma conversa');
select is(array(select conteudo from public.mensagens where conteudo like 'V 553195555000_' order by conteudo), '{}'::text[], 'Sem acesso: nenhuma mensagem (nem pelo Realtime)');
select is(array(select titulo from public.chamados where titulo like 'V %' order by titulo),
  array['V F1 Fiscal', 'V F2 Fiscal da Mia'], 'Sem acesso ao Atendimento continua vendo as demandas do setor');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000f","role":"authenticated"}', true);
select is(array(select telefone from public.conversas where telefone like '553195555000_' order by telefone),
  array['5531955550001', '5531955550002', '5531955550003', '5531955550004', '5531955550005'], 'Todas as conversas: inclusive sem demanda');
select is((select count(*)::int from public.mensagens where conteudo like 'V 553195555000_'), 5, 'Todas as conversas: todas as mensagens (Realtime também)');
select throws_ok($$ select public.pode_ver_chamado_de('d2400000-0000-0000-0000-00000000000b', 'd2430000-0000-0000-0000-000000000001') $$,
  '42501', null, 'a equipe não consulta a visibilidade de outra pessoa');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-000000000011","role":"authenticated"}', true);
select throws_ok($$ select public.exigir_arquivar('cliente') $$, 'P0001', 'Sem permissão para arquivar cadastros.', 'Ver e editar não arquiva');
select lives_ok($$ insert into public.clientes (razao_social, cnpj) values ('V Nova', '99888777000166') $$, 'Ver e editar cadastra');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-000000000012","role":"authenticated"}', true);
select lives_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                   values ('d2400000-0000-0000-0000-000000000012', 'site', 'usuario', 'V pergunta') $$, 'Assistente Site pergunta pelo painel');
select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo)
                    values ('d2400000-0000-0000-0000-00000000000a', 'site', 'usuario', 'V pergunta') $$, '42501', null,
  'administrador sem a marcação do assistente não pergunta (como hoje)');
select ok(public.eh_telefone_do_assistente('5531966660002'), 'Site e WhatsApp: o telefone é do assistente');
select ok(not public.eh_telefone_do_assistente('5531966660001'), 'só Site: o telefone não é do assistente');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.criar_demanda(p_cliente => 'd2410000-0000-0000-0000-000000000001',
                    p_setor => (select id from public.setores where nome = 'Fiscal'), p_titulo => 'V Nova da Mia', p_descricao => '') $$,
  'Só as minhas: cria a demanda');
select is((select responsavel_id from public.chamados where titulo = 'V Nova da Mia'), 'd2400000-0000-0000-0000-00000000000b'::uuid,
  'Só as minhas: quem cria fica responsável (P9)');
select throws_ok($$ select public.criar_demanda(p_cliente => 'd2410000-0000-0000-0000-000000000001',
                     p_setor => (select id from public.setores where nome = 'Fiscal'), p_titulo => 'V Nova para o Seto', p_descricao => '',
                     p_responsavel => 'd2400000-0000-0000-0000-00000000000c') $$,
  'P0001', 'Com "Só as minhas", a demanda que você cria fica com você.', 'Só as minhas: não cria para outra pessoa');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-000000000010","role":"authenticated"}', true);
select throws_ok($$ select public.definir_prioridade_prazo('d2430000-0000-0000-0000-000000000001', null, now() + interval '3 days') $$,
  'P0001', 'Você não tem permissão para alterar prazos.', 'Prazos Não: não escolhe o prazo');
select lives_ok($$ select public.definir_prioridade_prazo('d2430000-0000-0000-0000-000000000001', 'alta') $$,
  'Prazos Não: muda a prioridade (o prazo é recalculado)');
select throws_ok($$ select public.criar_demanda(p_cliente => 'd2410000-0000-0000-0000-000000000001',
                     p_setor => (select id from public.setores where nome = 'Fiscal'), p_titulo => 'V Nova do Nep', p_descricao => '',
                     p_prazo => now() + interval '3 days') $$,
  'P0001', 'Você não tem permissão para alterar prazos.', 'Prazos Não: Nova demanda sem prazo escolhido à mão');

select set_config('request.jwt.claims', '{"sub":"d2400000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select lives_ok($$ select public.definir_prioridade_prazo('d2430000-0000-0000-0000-000000000002', null, now() + interval '3 days') $$,
  'Prazos Sim (padrão): escolhe o prazo');

select * from finish();
rollback;
```

- [ ] **Passo 2: ver falhar**

Run: `supabase test db`
Expected: `24_...` falha em "Só as minhas: só a dela" (hoje Mia vê as duas do Fiscal) e no `pode_ver_chamado_de` inexistente. O 22 continua 71/71.

- [ ] **Passo 3: a migração**

Crie `supabase/migrations/20261004000200_painel_v2_visibilidade.sql`:

```sql
-- supabase/migrations/20261004000200_painel_v2_visibilidade.sql
-- Painel v2, Parte D (spec 7.2): o que cada pessoa vê e faz sai do nível. "Do meu setor" e "Conversas dos meus
-- setores" são a regra de antes, palavra por palavra: quem não teve o nível mudado vê exatamente o mesmo (teste 22).

-- ---------- Demandas ----------

create function public.pode_ver_chamado_de(p_usuario uuid, p_chamado uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin_de(p_usuario) or exists (
    select 1 from public.chamados c
    where c.id = p_chamado and public.usuario_liberado(p_usuario)
      and (c.responsavel_id = p_usuario
           or case public.nivel_de(p_usuario, 'demandas')
                when 'todas' then true
                when 'meu_setor' then c.setor_id in (select us.setor_id from public.usuario_setores us where us.usuario_id = p_usuario)
                else false
              end)
  )
$$;

-- ---------- Conversas (Atendimento) ----------

create function public.pode_ver_conversa_de(p_usuario uuid, p_conversa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin_de(p_usuario) or (public.usuario_liberado(p_usuario) and (
    case public.nivel_de(p_usuario, 'atendimento')
      when 'todas' then exists (select 1 from public.conversas where id = p_conversa)
      when 'meus_setores' then
        exists (select 1 from public.conversas where id = p_conversa and atendente_id = p_usuario)
        or exists (
          select 1 from public.chamados c
          where c.conversa_id = p_conversa
            and (c.responsavel_id = p_usuario
                 or c.setor_id in (select us.setor_id from public.usuario_setores us where us.usuario_id = p_usuario)))
      else false
    end))
$$;

revoke execute on function public.pode_ver_chamado_de(uuid, uuid), public.pode_ver_conversa_de(uuid, uuid) from public, anon, authenticated;
grant execute on function public.pode_ver_chamado_de(uuid, uuid), public.pode_ver_conversa_de(uuid, uuid) to service_role;

-- As de sempre (políticas, Realtime, funções antigas): mesma assinatura, agora pelo nível.
create or replace function public.pode_ver_chamado(p_chamado uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.pode_ver_chamado_de(auth.uid(), p_chamado) $$;

create or replace function public.pode_ver_conversa(p_conversa uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.pode_ver_conversa_de(auth.uid(), p_conversa) $$;

-- ---------- Arquivar e restaurar (spec 5.2): "Clientes e contatos: Editar e arquivar" ----------

create or replace function public.exigir_arquivar(p_tipo text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_tabela text := public.tabela_do_cadastro(p_tipo);
begin
  if v_tabela is null then raise exception 'Tipo de cadastro inválido.'; end if;
  if p_tipo = 'usuario' and not public.eh_admin() then raise exception 'Só o administrador arquiva pessoas.'; end if;
  if not public.tem_permissao('clientes', 'arquivar') then raise exception 'Sem permissão para arquivar cadastros.'; end if;
  return v_tabela;
end $$;

-- ---------- Assistente: pelo nível, sem passe livre do administrador (como hoje) ----------

drop policy pergunta on public.assistente_mensagens;
create policy pergunta on public.assistente_mensagens for insert to authenticated
  with check (usuario_id = auth.uid() and papel = 'usuario' and canal = 'site' and processada_em is null
    and public.tem_nivel('assistente', 'site')
    and (conversa_id is null or exists (select 1 from public.conversas c where c.id = conversa_id)));

-- Telefone da equipe com "Site e WhatsApp" (com ou sem o 9). Sem horário aqui: fora do horário a mensagem continua
-- indo para o assistente (que responde "fora do horário"), nunca para o agente de clientes.
create or replace function public.eh_telefone_do_assistente(p text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios u
    where u.ativo and public.nivel_de(u.id, 'assistente') = 'site_whatsapp' and u.telefone is not null
      and (u.telefone = p
        or (length(p) = 12 and p ~ '^\d{4}[6-9]' and u.telefone = left(p, 4) || '9' || substr(p, 5))
        or (length(p) = 13 and substr(p, 5, 1) = '9' and u.telefone = left(p, 4) || substr(p, 6)))
  )
$$;

-- ---------- Nova demanda: "Só as minhas" (P9) e prazo à mão (P10) ----------

create or replace function public.criar_demanda(
  p_cliente uuid, p_setor uuid, p_titulo text, p_descricao text,
  p_prioridade public.prioridade_demanda default 'normal', p_prazo timestamptz default null,
  p_responsavel uuid default null, p_contato uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_titulo text := btrim(coalesce(p_titulo, ''));
  v_descricao text := btrim(coalesce(p_descricao, ''));
  v_responsavel uuid := p_responsavel;
  v_id uuid;
  v_numero bigint;
begin
  if not public.eh_usuario_ativo() then raise exception 'Acesso desativado.'; end if;
  if char_length(v_titulo) not between 3 and 120 then raise exception 'O título precisa ter de 3 a 120 caracteres.'; end if;
  if char_length(v_descricao) > 4000 then raise exception 'A descrição pode ter até 4000 caracteres.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ativo) then raise exception 'Escolha uma empresa ativa.'; end if;
  if not exists (select 1 from public.setores where id = p_setor and ativo) then raise exception 'Escolha o setor.'; end if;
  if not public.eh_admin() and p_setor not in (select public.meus_setores()) then raise exception 'Escolha um dos seus setores.'; end if;
  if p_prazo is not null and not public.tem_permissao('prazos', 'sim') then raise exception 'Você não tem permissão para alterar prazos.'; end if;
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  -- Quem só vê as próprias demandas fica responsável pela que cria; senão ela sumiria da tela dele.
  if not public.eh_admin() and public.nivel_de(auth.uid(), 'demandas') = 'minhas' then
    if v_responsavel is not null and v_responsavel <> auth.uid() then
      raise exception 'Com "Só as minhas", a demanda que você cria fica com você.';
    end if;
    v_responsavel := auth.uid();
  end if;
  if v_responsavel is not null and not public.pode_ser_responsavel(v_responsavel, p_setor) then
    raise exception 'Escolha uma pessoa ativa do setor da demanda.';
  end if;
  if p_contato is not null and not public.contato_da_empresa(p_contato, p_cliente) then raise exception 'Escolha um contato desta empresa.'; end if;
  insert into public.chamados (cliente_id, setor_id, responsavel_id, contato_id, titulo, resumo, prioridade, prazo_em, origem, criado_por)
    values (p_cliente, p_setor, v_responsavel, p_contato, v_titulo, v_descricao, coalesce(p_prioridade, 'normal'), p_prazo, 'equipe', auth.uid())
    returning id, numero into v_id, v_numero;
  return jsonb_build_object('id', v_id, 'numero', v_numero);
end $$;

-- Prazo escolhido à mão exige "Alterar prazos"; mudar a prioridade continua recalculando o prazo para todos.
create or replace function public.definir_prioridade_prazo(
  p_chamado uuid, p_prioridade public.prioridade_demanda default null, p_prazo timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.chamados%rowtype; v_prazo timestamptz;
begin
  v := public.demanda_para_agir(p_chamado);
  if p_prazo is not null and not public.tem_permissao('prazos', 'sim') then raise exception 'Você não tem permissão para alterar prazos.'; end if;
  if p_prazo is not null and p_prazo <= now() then raise exception 'O prazo precisa ser depois de agora.'; end if;
  if p_prioridade is not null and p_prioridade <> v.prioridade then
    v_prazo := coalesce(p_prazo, public.calcular_prazo(p_prioridade, now()), v.prazo_em);
    update public.chamados set prioridade = p_prioridade, prazo_em = v_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prioridade_alterada', auth.uid(), p_prioridade::text);
    if v_prazo is distinct from v.prazo_em then
      insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
        values (p_chamado, v.cliente_id, 'prazo_alterado', case when p_prazo is not null then auth.uid() end, public.texto_prazo(v_prazo));
    end if;
  elsif p_prazo is not null and p_prazo is distinct from v.prazo_em then
    update public.chamados set prazo_em = p_prazo where id = p_chamado;
    insert into public.chamado_eventos (chamado_id, cliente_id, tipo, usuario_id, texto)
      values (p_chamado, v.cliente_id, 'prazo_alterado', auth.uid(), public.texto_prazo(p_prazo));
  end if;
  return (select jsonb_build_object('prioridade', c.prioridade, 'prazo_em', c.prazo_em) from public.chamados c where c.id = p_chamado);
end $$;
```

Antes de salvar, compare os corpos de `criar_demanda` e `definir_prioridade_prazo` com os mais novos do repositório (`grep -ln "function public.criar_demanda\|function public.definir_prioridade_prazo" supabase/migrations/*.sql`, o último arquivo de cada um): o de cima tem de ser **aquele corpo mais só as linhas novas** (prazo à mão e "Só as minhas"). Se a Parte C ou as sobras mudaram algum detalhe depois de `20261003000500`, parta do corpo mais novo.

- [ ] **Passo 4: ver passar, inclusive a regressão**

```bash
supabase db reset
supabase test db
```

Expected: `22` **71/71**, `23` 25/25, `24` **24/24**; `19_painel_v2_acoes_demanda` e `20_...` continuam passando (as pessoas deles têm os níveis padrão, que reproduzem o de antes).

- [ ] **Passo 5: tipos e commit**

```bash
pnpm db:tipos
pnpm --filter @escritorio/db test
git add supabase/migrations/20261004000200_painel_v2_visibilidade.sql supabase/tests/24_painel_v2_visibilidade_niveis.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): demandas, conversas, arquivar, assistente e prazo pelo nível

pode_ver_chamado e pode_ver_conversa ganham a versão com a pessoa (para o
trabalhador) e respeitam Só as minhas, Do meu setor, Todas e o Atendimento;
Do meu setor é a regra de antes. Arquivar exige Editar e arquivar; prazo à
mão exige Alterar prazos; quem só vê as suas fica responsável pela demanda
que cria.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Banco. Horário de acesso (leitura e gravação recusadas fora do horário)

**Files:**
- Create: `supabase/migrations/20261004000300_painel_v2_horario.sql`
- Create: `supabase/tests/25_painel_v2_horario.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consumes (Task 2): `usuario_liberado` (o corpo muda aqui), `eh_admin`, `eh_usuario_ativo`.
- Produces:
  - coluna `usuarios.horario_acesso jsonb` (vazio = sem restrição) e `public.horario_valido(h jsonb) returns boolean`;
  - `public.horario_permite(p_usuario uuid, p_quando timestamptz default now()) returns boolean` (só serviço e funções; a Task 7 chama pelo repos);
  - `public.pode_acessar_agora() returns boolean` (equipe);
  - `public.exigir_acesso() returns void` (levanta `'Acesso desativado.'` ou `'Fora do seu horário de acesso.'`);
  - `public.situacao_acesso() returns jsonb`: `{"situacao":"liberado"}`, `{"situacao":"fora_do_horario","horario":{...}}`, `{"situacao":"inativo"}` ou `{"situacao":"sem_cadastro"}`; atualiza `ultimo_acesso_em` (no máximo a cada 10 min) quando liberado.

- [ ] **Passo 1: o teste**

Crie `supabase/tests/25_painel_v2_horario.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

-- 05/10/2026 é segunda; 03/10 é sábado; 04/10 é domingo.
insert into auth.users (id, email) values
  ('d2500000-0000-0000-0000-00000000000a', 'admin@horario.local'), ('d2500000-0000-0000-0000-00000000000b', 'bia@horario.local'),
  ('d2500000-0000-0000-0000-00000000000c', 'ex@horario.local'), ('d2500000-0000-0000-0000-00000000000d', 'semcadastro@horario.local'),
  ('d2500000-0000-0000-0000-00000000000e', 'eli@horario.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d2500000-0000-0000-0000-00000000000a', 'Admin H', 'admin@horario.local', 'admin'),
  ('d2500000-0000-0000-0000-00000000000b', 'Bia H', 'bia@horario.local', 'atendente'),
  ('d2500000-0000-0000-0000-00000000000c', 'Ex H', 'ex@horario.local', 'atendente'),
  ('d2500000-0000-0000-0000-00000000000e', 'Eli H', 'eli@horario.local', 'atendente');
update public.usuarios set ativo = false where id = 'd2500000-0000-0000-0000-00000000000c';
update public.usuarios set horario_acesso = '{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'
where id in ('d2500000-0000-0000-0000-00000000000b', 'd2500000-0000-0000-0000-00000000000c');
update public.usuario_permissoes set nivel = 'editar' where usuario_id = 'd2500000-0000-0000-0000-00000000000b' and modulo = 'clientes';
insert into public.usuario_setores (usuario_id, setor_id) select 'd2500000-0000-0000-0000-00000000000b', id from public.setores where nome = 'Fiscal';
insert into public.chamados (id, setor_id, titulo) select 'd2530000-0000-0000-0000-000000000001', id, 'H F1' from public.setores where nome = 'Fiscal';

-- Formato (1 a 7)
select ok(public.horario_valido(null), 'vazio = sem restrição');
select ok(public.horario_valido('{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'), 'o padrão do spec');
select ok(not public.horario_valido('{"semana":{"de":"08:00","ate":"18:00"},"sabado":null}'), 'falta o domingo');
select ok(not public.horario_valido('{"semana":{"de":"18:00","ate":"08:00"},"sabado":null,"domingo":null}'), 'fim antes do início');
select ok(not public.horario_valido('{"semana":{"de":"8h","ate":"18:00"},"sabado":null,"domingo":null}'), 'hora fora do formato');
select ok(not public.horario_valido('{"semana":null,"sabado":null,"domingo":null,"feriado":null}'), 'dia desconhecido');
select throws_ok($$ update public.usuarios set horario_acesso = '{"semana":1}' where id = 'd2500000-0000-0000-0000-00000000000b' $$,
  '23514', null, 'o banco recusa horário inválido');

-- Regra (8 a 19)
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 12:00-03'), 'segunda 12:00 entra');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 07:59-03'), 'segunda 07:59 ainda não');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 08:00-03'), 'segunda 08:00 entra');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 18:00-03'), 'segunda 18:00: o minuto final entra (P7)');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 18:01-03'), 'segunda 18:01 não entra');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-03 10:00-03'), 'sábado bloqueado');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-04 10:00-03'), 'domingo bloqueado');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-05 20:30+00'), '20:30 UTC = 17:30 em Brasília');
update public.usuarios set horario_acesso = '{"semana":{"de":"08:00","ate":"18:00"},"sabado":{"de":"08:00","ate":"12:00"},"domingo":null}'
where id = 'd2500000-0000-0000-0000-00000000000b';
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000b', '2026-10-03 11:00-03'), 'sábado liberado das 08 às 12');
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}'
where id in ('d2500000-0000-0000-0000-00000000000a', 'd2500000-0000-0000-0000-00000000000b');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000a', '2026-10-04 03:00-03'), 'administrador nunca é bloqueado');
select ok(public.horario_permite('d2500000-0000-0000-0000-00000000000e', '2026-10-04 03:00-03'), 'sem horário = sem restrição (quem já existia, P4)');
select ok(not public.horario_permite('d2500000-0000-0000-0000-00000000000c', '2026-10-05 12:00-03'), 'arquivado nunca');

-- Bia com todos os dias bloqueados: fora do horário agora, seja quando for que o teste rode (20 a 26)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select ok(not public.eh_usuario_ativo(), 'fora do horário: não está liberada');
select is((select count(*)::int from public.chamados where titulo like 'H %'), 0, 'fora do horário: não lê as demandas (nem pelo Realtime)');
select throws_ok($$ select public.nota_interna('d2530000-0000-0000-0000-000000000001', 'nota H') $$,
  'P0001', 'sem acesso a este chamado', 'fora do horário: não grava na demanda');
select throws_ok($$ insert into public.clientes (razao_social, cnpj) values ('H Nova', '99888777000166') $$, '42501', null,
  'fora do horário: não cadastra, mesmo com "Ver e editar"');
select throws_ok($$ select public.definir_tamanho_letra('grande') $$, 'P0001', 'Fora do seu horário de acesso.', 'fora do horário: nem preferência');
select is(public.situacao_acesso() ->> 'situacao', 'fora_do_horario', 'situação: fora do horário');
select ok(not public.pode_acessar_agora(), 'pode_acessar_agora: não');

-- Administrador com o mesmo horário bloqueado (27 a 30)
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select count(*)::int from public.chamados where titulo like 'H %'), 1, 'administrador lê a qualquer hora');
select is(public.situacao_acesso() ->> 'situacao', 'liberado', 'administrador: liberado');
select isnt((select ultimo_acesso_em from public.usuarios where id = 'd2500000-0000-0000-0000-00000000000a'), null, 'último acesso gravado');
select is((select count(*)::int from public.auditoria_acessos
           where entidade = 'usuarios' and entidade_id = 'd2500000-0000-0000-0000-00000000000a'
             and detalhes -> 'depois' ->> 'ultimo_acesso_em' is not null), 0, 'último acesso não entra na auditoria (P8)');

-- Arquivado e sem cadastro (31 e 32)
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.situacao_acesso() ->> 'situacao', 'inativo', 'arquivado: inativo');
select set_config('request.jwt.claims', '{"sub":"d2500000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.situacao_acesso() ->> 'situacao', 'sem_cadastro', 'sem cadastro no painel');

-- 33: a equipe não consulta o horário de outra pessoa
select throws_ok($$ select public.horario_permite('d2500000-0000-0000-0000-00000000000b', now()) $$, '42501', null,
  'horario_permite é só do banco e do trabalhador');

-- 34: toda função de gravação que a equipe pode chamar passa por uma trava (pessoa ativa e no horário). Foco da revisão 4.
reset role;
select is(array(
  select p.proname::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'execute')
    and p.prosrc ~* '\m(insert|update|delete)\M'
    and p.prosrc !~ '(eh_usuario_ativo|eh_admin|pode_ver_chamado|pode_ver_conversa|tem_permissao|tem_nivel|meus_setores|pode_acessar_agora|demanda_para_agir|exigir_arquivar|exigir_acesso|usuario_liberado|horario_permite)'
  order by 1), '{}'::text[], 'nenhuma função de gravação da equipe sem trava');

select * from finish();
rollback;
```

- [ ] **Passo 2: ver falhar**

Run: `supabase test db`
Expected: `25_...` falha na primeira asserção (`function public.horario_valido(unknown) does not exist`).

- [ ] **Passo 3: a migração**

Crie `supabase/migrations/20261004000300_painel_v2_horario.sql`:

```sql
-- supabase/migrations/20261004000300_painel_v2_horario.sql
-- Painel v2, Parte D (spec 7.1 e 7.2): horário de acesso por dia. Fora do horário a pessoa não lê nem grava nada
-- (P5), inclusive pelo Realtime; o administrador nunca é bloqueado. Vazio = sem restrição (quem já existia, P4).
-- Formato: {"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}; null num dia = bloqueado.

create function public.horario_valido(h jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when h is null then true
    when jsonb_typeof(h) <> 'object' then false
    else (select count(*) from jsonb_object_keys(h)) = 3
      and h ? 'semana' and h ? 'sabado' and h ? 'domingo'
      and (select bool_and(
             jsonb_typeof(h -> d) = 'null'
             or (jsonb_typeof(h -> d) = 'object'
                 and coalesce(h -> d ->> 'de', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 and coalesce(h -> d ->> 'ate', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 and (h -> d ->> 'de') < (h -> d ->> 'ate')))
           from unnest(array['semana', 'sabado', 'domingo']) d)
  end
$$;

alter table public.usuarios add column horario_acesso jsonb check (public.horario_valido(horario_acesso));

-- Pessoa ativa e dentro do horário em p_quando (fuso de Brasília; feriado segue o dia da semana, P6; o minuto final
-- entra, P7). Administrador sempre.
create function public.horario_permite(p_usuario uuid, p_quando timestamptz default now()) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select u.papel = 'admin' or u.horario_acesso is null or coalesce(
      to_char(l.t, 'HH24:MI') between (u.horario_acesso -> l.dia ->> 'de') and (u.horario_acesso -> l.dia ->> 'ate'), false)
    from public.usuarios u,
         lateral (select p_quando at time zone 'America/Sao_Paulo' as t) agora,
         lateral (select agora.t as t,
                         case extract(isodow from agora.t) when 6 then 'sabado' when 7 then 'domingo' else 'semana' end as dia) l
    where u.id = p_usuario and u.ativo
  ), false)
$$;
revoke execute on function public.horario_permite(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.horario_permite(uuid, timestamptz) to service_role;

-- Todas as regras (RLS, Realtime, funções) passam por aqui: o horário vale em todo lugar de uma vez.
create or replace function public.usuario_liberado(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$ select public.horario_permite(p_usuario, now()) $$;

create function public.pode_acessar_agora() returns boolean
language sql stable security definer set search_path = '' as $$ select public.horario_permite(auth.uid(), now()) $$;
revoke execute on function public.pode_acessar_agora() from public, anon;
grant execute on function public.pode_acessar_agora() to authenticated;

-- Para funções que gravam só na linha da própria pessoa: a mensagem diz o porquê.
create function public.exigir_acesso() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.eh_admin() then return; end if;
  if not exists (select 1 from public.usuarios where id = auth.uid() and ativo) then raise exception 'Acesso desativado.'; end if;
  if not public.pode_acessar_agora() then raise exception 'Fora do seu horário de acesso.'; end if;
end $$;
revoke execute on function public.exigir_acesso() from public, anon;
grant execute on function public.exigir_acesso() to authenticated;

-- Login e middleware do painel (spec 7.2): a mesma resposta nos dois. Liberado = marca o último acesso, no máximo a
-- cada 10 minutos (P8).
create function public.situacao_acesso() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare u public.usuarios%rowtype;
begin
  select * into u from public.usuarios where id = auth.uid();
  if u.id is null then return jsonb_build_object('situacao', 'sem_cadastro'); end if;
  if not u.ativo then return jsonb_build_object('situacao', 'inativo'); end if;
  if not public.horario_permite(u.id, now()) then
    return jsonb_build_object('situacao', 'fora_do_horario', 'horario', u.horario_acesso);
  end if;
  update public.usuarios set ultimo_acesso_em = now()
  where id = u.id and (ultimo_acesso_em is null or ultimo_acesso_em < now() - interval '10 minutes');
  return jsonb_build_object('situacao', 'liberado');
end $$;
revoke execute on function public.situacao_acesso() from public, anon;
grant execute on function public.situacao_acesso() to authenticated;

-- O último acesso muda a cada uso: não entra na auditoria (o resto da linha continua registrado).
drop trigger auditoria on public.usuarios;
create trigger auditoria after insert or delete on public.usuarios
  for each row execute function public.registrar_auditoria();
create trigger auditoria_alteracao after update on public.usuarios
  for each row when ((to_jsonb(old) - 'ultimo_acesso_em') is distinct from (to_jsonb(new) - 'ultimo_acesso_em'))
  execute function public.registrar_auditoria();

-- Preferência da própria pessoa: grava só dentro do horário, como o resto.
create or replace function public.definir_tamanho_letra(p_tamanho text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_tamanho is null or p_tamanho not in ('normal', 'grande', 'maior') then
    raise exception 'Tamanho de letra inválido.';
  end if;
  perform public.exigir_acesso();
  update public.usuarios set tamanho_letra = p_tamanho where id = auth.uid();
end $$;
```

Confira antes que o corpo antigo de `definir_tamanho_letra` (em `20261001000100_painel_v2_identidade.sql`) é o mesmo de cima, trocando só a checagem de `ativo` por `perform public.exigir_acesso()`.

- [ ] **Passo 4: rodar e tratar o que o teste das travas acusar**

```bash
supabase db reset
supabase test db
```

Expected: `22` 71/71, `23` 25/25, `24` 24/24, `25` 34/34. Se a asserção 34 listar funções, trate **cada nome** assim, nesta mesma migração (nunca editando a antiga):
- veja quem a chama: `grep -rn "rpc('<nome>'" apps/painel/src apps/trabalhador/src packages/db/src`;
- **só o trabalhador** (chave de serviço) chama: acrescente `revoke execute on function public.<nome>(<tipos>) from public, anon, authenticated; grant execute on function public.<nome>(<tipos>) to service_role;` (era um buraco: a equipe podia chamá-la direto);
- **o painel** chama: recrie a função com `create or replace`, a partir do corpo mais novo do repositório, com `perform public.exigir_acesso();` como primeira linha.

Rode de novo até a asserção 34 passar. Liste no commit as funções tratadas.

- [ ] **Passo 5: tipos, suítes e commit**

```bash
pnpm db:tipos
pnpm --filter @escritorio/db test
pnpm --filter @escritorio/trabalhador test
git add supabase/migrations/20261004000300_painel_v2_horario.sql supabase/tests/25_painel_v2_horario.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): horário de acesso recusa leitura e gravação fora do horário

horario_permite (Brasília, minuto final incluído, admin sempre) entra em
usuario_liberado, logo em todas as regras de leitura, gravação e Realtime.
situacao_acesso responde ao login e ao middleware e marca o último acesso,
que não entra na auditoria. Um teste acusa função de gravação sem trava.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Banco. Salvar a pessoa numa transação só

**Files:**
- Create: `supabase/migrations/20261004000400_painel_v2_salvar_usuario.sql`
- Create: `supabase/tests/26_painel_v2_salvar_usuario.test.sql`
- Regerar: `packages/db/src/tipos.gen.ts`

**Interfaces:**
- Consumes: `eh_admin`, `horario_valido`, `permissao_niveis`, `nivel_de`.
- Produces: `public.salvar_usuario(p_id uuid, p_dados jsonb) returns void`. `p_dados`:

  ```json
  { "nome": "Ana Paula Souza", "email": "ana@escritorio.com.br", "papel": "atendente", "cargo": "Analista",
    "telefone": "5511988881234", "setores": ["<uuid>"], "niveis": { "demandas": "meu_setor" },
    "horario_acesso": { "semana": { "de": "08:00", "ate": "18:00" }, "sabado": null, "domingo": null },
    "observacoes": "Férias de 10 a 24/11" }
  ```

  `email` só vale ao criar. Módulo ausente em `niveis` não muda. Chave `horario_acesso` ausente não muda; presente com `null` = sem restrição. Mensagens (a Task 10 as põe no campo certo): `'Só o administrador muda pessoas.'`, `'Informe o nome.'`, `'Escolha se é administrador.'`, `'Você não pode tirar o seu próprio acesso de administrador.'`, `'Horário de acesso inválido.'`, `'Setor não encontrado.'`, `'Nível inválido em <modulo>.'`, `'Informe o e-mail.'`, `'Esta pessoa está arquivada. Restaure antes de mudar.'`, `'Informe o telefone para usar o assistente pelo WhatsApp.'`.

- [ ] **Passo 1: o teste**

Crie `supabase/tests/26_painel_v2_salvar_usuario.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('d2600000-0000-0000-0000-00000000000a', 'admin@salvar.local'), ('d2600000-0000-0000-0000-00000000000b', 'bia@salvar.local'),
  ('d2600000-0000-0000-0000-00000000000c', 'arq@salvar.local'), ('d2600000-0000-0000-0000-00000000000d', 'nova@salvar.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d2600000-0000-0000-0000-00000000000a', 'Admin S', 'admin@salvar.local', 'admin'),
  ('d2600000-0000-0000-0000-00000000000b', 'Bia S', 'bia@salvar.local', 'atendente'),
  ('d2600000-0000-0000-0000-00000000000c', 'Arq S', 'arq@salvar.local', 'atendente');
update public.usuarios set ativo = false where id = 'd2600000-0000-0000-0000-00000000000c';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2600000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b', '{"nome":"Bia","papel":"admin"}') $$,
  'P0001', 'Só o administrador muda pessoas.', 'atendente não se faz administrador');

select set_config('request.jwt.claims', '{"sub":"d2600000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000d', jsonb_build_object(
    'nome', 'Nova S', 'email', ' Nova@Salvar.local ', 'papel', 'atendente', 'cargo', 'Analista', 'telefone', null,
    'setores', jsonb_build_array((select id from public.setores where nome = 'Fiscal')),
    'niveis', '{"demandas":"todas","clientes":"editar"}'::jsonb,
    'horario_acesso', '{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}'::jsonb,
    'observacoes', 'Férias em novembro')) $$, 'cria a pessoa com tudo de uma vez');
select is((select email || '|' || cargo || '|' || observacoes from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000d'),
  'nova@salvar.local|Analista|Férias em novembro', 'dados gravados (e-mail aparado e minúsculo)');
select is((public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'demandas') || '/'
          || (public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'clientes') || '/'
          || (public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'prazos'),
  'todas/editar/sim', 'níveis escolhidos e o padrão nos outros');
select is(array(select s.nome from public.usuario_setores us join public.setores s on s.id = us.setor_id
                where us.usuario_id = 'd2600000-0000-0000-0000-00000000000d'), array['Fiscal'], 'setores gravados');
select is((select permissoes from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000d'), '{editar_clientes}'::text[],
  'a cópia antiga acompanha');

-- Marcar como administrador: só o Assistente vem; o resto fica como estava (foco da revisão 3).
select lives_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000d', jsonb_build_object(
    'nome', 'Nova S', 'papel', 'admin', 'setores', jsonb_build_array((select id from public.setores where nome = 'Fiscal')),
    'niveis', '{"assistente":"site"}'::jsonb)) $$, 'vira administrador');
select is(public.niveis_do_usuario('d2600000-0000-0000-0000-00000000000d') ->> 'demandas', 'todas', 'os níveis escondidos não se perdem');
select isnt((select horario_acesso from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000d'), null,
  'sem a chave horario_acesso, o horário fica como estava');

select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000a', '{"nome":"Admin S","papel":"atendente"}') $$,
  'P0001', 'Você não pode tirar o seu próprio acesso de administrador.', 'ninguém tira o próprio administrador (P16)');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b', '{"nome":"Bia S","papel":"atendente","niveis":{"demandas":"tudo"}}') $$,
  'P0001', 'Nível inválido em demandas.', 'nível inválido');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b',
    '{"nome":"Bia S","papel":"atendente","horario_acesso":{"semana":{"de":"18:00","ate":"08:00"},"sabado":null,"domingo":null}}') $$,
  'P0001', 'Horário de acesso inválido.', 'horário inválido');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000b',
    '{"nome":"Mudou","papel":"atendente","telefone":null,"niveis":{"assistente":"site_whatsapp"}}') $$,
  'P0001', 'Informe o telefone para usar o assistente pelo WhatsApp.', 'WhatsApp sem telefone');
select is((select nome from public.usuarios where id = 'd2600000-0000-0000-0000-00000000000b'), 'Bia S', 'erro desfaz tudo (uma transação só)');
select throws_ok($$ select public.salvar_usuario('d2600000-0000-0000-0000-00000000000c', '{"nome":"Arq S","papel":"atendente"}') $$,
  'P0001', 'Esta pessoa está arquivada. Restaure antes de mudar.', 'arquivada não muda');
select ok((select count(*) from public.auditoria_acessos
           where usuario_id = 'd2600000-0000-0000-0000-00000000000a' and entidade in ('usuarios', 'usuario_permissoes', 'usuario_setores')
             and entidade_id = 'd2600000-0000-0000-0000-00000000000d') > 0, 'auditoria guarda o administrador que salvou');

select * from finish();
rollback;
```

- [ ] **Passo 2: ver falhar**

Run: `supabase test db`
Expected: `26_...` falha (`function public.salvar_usuario(...) does not exist`).

- [ ] **Passo 3: a migração**

Crie `supabase/migrations/20261004000400_painel_v2_salvar_usuario.sql`:

```sql
-- supabase/migrations/20261004000400_painel_v2_salvar_usuario.sql
-- Painel v2, Parte D (spec 7.1): a ficha da pessoa grava dados, setores e níveis numa transação só (um erro no meio
-- não deixa a pessoa pela metade). Módulo que não veio (escondido para o administrador) fica como estava.

create function public.salvar_usuario(p_id uuid, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := btrim(coalesce(p_dados ->> 'nome', ''));
  v_papel text := p_dados ->> 'papel';
  v_cargo text := nullif(btrim(coalesce(p_dados ->> 'cargo', '')), '');
  v_obs text := nullif(btrim(coalesce(p_dados ->> 'observacoes', '')), '');
  v_tel text := nullif(btrim(coalesce(p_dados ->> 'telefone', '')), '');
  v_horario jsonb := nullif(p_dados -> 'horario_acesso', 'null'::jsonb);
  v_setores uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p_dados -> 'setores', '[]'::jsonb)) x), '{}');
  v_atual public.usuarios%rowtype;
  n record;
begin
  if not public.eh_admin() then raise exception 'Só o administrador muda pessoas.'; end if;
  if char_length(v_nome) < 2 then raise exception 'Informe o nome.'; end if;
  if v_papel is null or v_papel not in ('admin', 'atendente') then raise exception 'Escolha se é administrador.'; end if;
  if p_id = auth.uid() and v_papel <> 'admin' then raise exception 'Você não pode tirar o seu próprio acesso de administrador.'; end if;
  if not public.horario_valido(v_horario) then raise exception 'Horário de acesso inválido.'; end if;
  if exists (select 1 from unnest(v_setores) s where not exists (select 1 from public.setores where id = s)) then
    raise exception 'Setor não encontrado.';
  end if;
  for n in select key, value from jsonb_each_text(coalesce(p_dados -> 'niveis', '{}'::jsonb)) loop
    if not exists (select 1 from public.permissao_niveis where modulo = n.key and nivel = n.value) then
      raise exception 'Nível inválido em %.', n.key;
    end if;
  end loop;

  select * into v_atual from public.usuarios where id = p_id;
  if v_atual.id is null then
    if coalesce(btrim(p_dados ->> 'email'), '') = '' then raise exception 'Informe o e-mail.'; end if;
    insert into public.usuarios (id, nome, email, papel, telefone, cargo, observacoes, horario_acesso)
    values (p_id, v_nome, lower(btrim(p_dados ->> 'email')), v_papel::public.papel_usuario, v_tel, v_cargo, v_obs, v_horario);
  else
    if not v_atual.ativo then raise exception 'Esta pessoa está arquivada. Restaure antes de mudar.'; end if;
    update public.usuarios
    set nome = v_nome, papel = v_papel::public.papel_usuario, telefone = v_tel, cargo = v_cargo, observacoes = v_obs,
        horario_acesso = case when p_dados ? 'horario_acesso' then v_horario else horario_acesso end
    where id = p_id;
  end if;

  delete from public.usuario_setores where usuario_id = p_id and not (setor_id = any (v_setores));
  insert into public.usuario_setores (usuario_id, setor_id)
  select p_id, s from unnest(v_setores) s
  where not exists (select 1 from public.usuario_setores where usuario_id = p_id and setor_id = s);

  insert into public.usuario_permissoes as up (usuario_id, modulo, nivel)
  select p_id, key, value from jsonb_each_text(coalesce(p_dados -> 'niveis', '{}'::jsonb))
  on conflict (usuario_id, modulo) do update set nivel = excluded.nivel where up.nivel is distinct from excluded.nivel;

  if public.nivel_de(p_id, 'assistente') = 'site_whatsapp' and v_tel is null then
    raise exception 'Informe o telefone para usar o assistente pelo WhatsApp.';
  end if;
end $$;
revoke execute on function public.salvar_usuario(uuid, jsonb) from public, anon;
grant execute on function public.salvar_usuario(uuid, jsonb) to authenticated;
```

- [ ] **Passo 4: ver passar**

```bash
supabase db reset
supabase test db
```

Expected: `22` 71/71, `23` 25/25, `24` 24/24, `25` 34/34 (a nova função grava, e passa na trava porque chama `eh_admin`), `26` **16/16**.

- [ ] **Passo 5: tipos e commit**

```bash
pnpm db:tipos
git add supabase/migrations/20261004000400_painel_v2_salvar_usuario.sql supabase/tests/26_painel_v2_salvar_usuario.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): salvar_usuario grava dados, setores e níveis numa transação

Só o administrador; ninguém tira o próprio administrador; módulo escondido
não se perde; WhatsApp exige telefone; pessoa arquivada não muda; a
auditoria registra quem salvou.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Banco. Configurações por permissão

**Files:**
- Create: `supabase/migrations/20261004000500_painel_v2_configuracoes.sql`
- Create: `supabase/tests/27_painel_v2_configuracoes_permissao.test.sql`

**Interfaces:**
- Consumes: `tem_permissao('configuracoes', 'sim')`, `eh_admin`.
- Produces: leitura e alteração de `configuracoes` e escrita em `setores`, `servicos`, `feriados`, `respostas_prontas` para quem tem "Configurações: Sim"; mensagem `'Só o administrador muda o teto de IA, os alertas e a pausa do agente.'` ao mexer em `teto_ia_usd`, `alerta_ia_80_mes`, `minutos_alerta_fila`, `modelo_conversa`, `modelo_rapido`, `precos_modelos`, `telefone_dono`, `email_alertas` ou `agente_pausado` sem ser administrador.

- [ ] **Passo 1: o teste**

Crie `supabase/tests/27_painel_v2_configuracoes_permissao.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('d2700000-0000-0000-0000-00000000000a', 'admin@config.local'), ('d2700000-0000-0000-0000-00000000000b', 'conf@config.local'),
  ('d2700000-0000-0000-0000-00000000000c', 'sem@config.local'), ('d2700000-0000-0000-0000-00000000000d', 'noite@config.local');
insert into public.usuarios (id, nome, email, papel) values
  ('d2700000-0000-0000-0000-00000000000a', 'Admin C', 'admin@config.local', 'admin'),
  ('d2700000-0000-0000-0000-00000000000b', 'Conf C', 'conf@config.local', 'atendente'),
  ('d2700000-0000-0000-0000-00000000000c', 'Sem C', 'sem@config.local', 'atendente'),
  ('d2700000-0000-0000-0000-00000000000d', 'Noite C', 'noite@config.local', 'atendente');
update public.usuario_permissoes set nivel = 'sim'
where modulo = 'configuracoes' and usuario_id in ('d2700000-0000-0000-0000-00000000000b', 'd2700000-0000-0000-0000-00000000000d');
update public.usuarios set horario_acesso = '{"semana":null,"sabado":null,"domingo":null}' where id = 'd2700000-0000-0000-0000-00000000000d';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.configuracoes), 1, 'Configurações Sim: lê');
select lives_ok($$ update public.configuracoes set aviso_login = 'Recado C' where id = 1 $$, 'Configurações Sim: muda o aviso do login');
select throws_ok($$ update public.configuracoes set teto_ia_usd = 999 where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'não muda o teto (P12)');
select throws_ok($$ update public.configuracoes set agente_pausado = true where id = 1 $$,
  'P0001', 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.', 'não pausa o agente');
select lives_ok($$ insert into public.feriados (data, descricao) values ('2026-12-24', 'Véspera C') $$, 'cadastra feriado');
select lives_ok($$ insert into public.setores (nome) values ('Setor C') $$, 'cadastra setor');

select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.configuracoes), 0, 'Sem acesso: não lê (como hoje)');
select throws_ok($$ insert into public.feriados (data, descricao) values ('2026-12-31', 'Fim C') $$, '42501', null, 'Sem acesso: não cadastra feriado');

select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set teto_ia_usd = 999 where id = 1 $$, 'administrador muda o teto');

select set_config('request.jwt.claims', '{"sub":"d2700000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ update public.configuracoes set aviso_login = 'Fora do horário C' where id = 1 $$, 'fora do horário a alteração não acha a linha');
reset role;
select is((select aviso_login from public.configuracoes where id = 1), 'Recado C', 'fora do horário nada mudou');

select * from finish();
rollback;
```

- [ ] **Passo 2: ver falhar**

Run: `supabase test db`
Expected: `27_...` falha em "Configurações Sim: lê" (0 linhas).

- [ ] **Passo 3: a migração**

Crie `supabase/migrations/20261004000500_painel_v2_configuracoes.sql`:

```sql
-- supabase/migrations/20261004000500_painel_v2_configuracoes.sql
-- Painel v2, Parte D (spec 7.1, P12): "Configurações: Sim" abre Configurações para quem não é administrador. Teto de
-- IA, alertas e pausa do agente continuam só do administrador; Usuários e permissões também (a RLS de usuarios e
-- salvar_usuario já exigem administrador).

create policy leitura_configuracoes on public.configuracoes for select to authenticated
  using (public.tem_permissao('configuracoes', 'sim'));
create policy alteracao_configuracoes on public.configuracoes for update to authenticated
  using (public.tem_permissao('configuracoes', 'sim')) with check (public.tem_permissao('configuracoes', 'sim'));

do $$
declare t text;
begin
  foreach t in array array['setores', 'servicos', 'feriados', 'respostas_prontas'] loop
    execute format('create policy escrita_configuracoes on public.%I for all to authenticated '
                   'using (public.tem_permissao(''configuracoes'', ''sim'')) with check (public.tem_permissao(''configuracoes'', ''sim''))', t);
  end loop;
end $$;

-- Colunas que mexem em gasto, em quem recebe os alertas e na pausa do agente: só o administrador (e o trabalhador).
create function public.configuracoes_so_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.eh_admin() then return new; end if;
  if (new.teto_ia_usd, new.alerta_ia_80_mes, new.minutos_alerta_fila, new.modelo_conversa, new.modelo_rapido, new.precos_modelos,
      new.telefone_dono, new.email_alertas, new.agente_pausado)
     is distinct from
     (old.teto_ia_usd, old.alerta_ia_80_mes, old.minutos_alerta_fila, old.modelo_conversa, old.modelo_rapido, old.precos_modelos,
      old.telefone_dono, old.email_alertas, old.agente_pausado) then
    raise exception 'Só o administrador muda o teto de IA, os alertas e a pausa do agente.';
  end if;
  return new;
end $$;
create trigger so_admin before update on public.configuracoes
  for each row execute function public.configuracoes_so_admin();
```

- [ ] **Passo 4: ver passar e commit**

```bash
supabase db reset
supabase test db
git add supabase/migrations/20261004000500_painel_v2_configuracoes.sql supabase/tests/27_painel_v2_configuracoes_permissao.test.sql
git commit -m "feat(banco): Configurações por permissão, com teto, alertas e pausa só do admin

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `22` 71/71, `23` a `26` como antes, `27` **11/11**.

---

### Task 7: Core e db. Os níveis no código e o usuário do assistente pelos níveis

**Files:**
- Create: `packages/core/src/permissoes.ts`, `packages/core/test/permissoes.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/db/src/repos.ts` (tipo `UsuarioAssistente`, `usuarioDoAssistente`, `obterUsuarioAssistente`, novo `horarioPermite`)
- Create: `packages/db/test/niveis.test.ts`

**Interfaces:**
- Consumes (banco): `permissao_niveis`, `usuario_permissoes`, `nivel_padrao`, `horario_permite`.
- Produces (painel e trabalhador usam estes nomes):

  ```ts
  // @escritorio/core
  export const NIVEIS: { atendimento: readonly ['sem_acesso', 'meus_setores', 'todas']; demandas: readonly ['minhas', 'meu_setor', 'todas'];
    clientes: readonly ['ver', 'editar', 'arquivar']; precos: readonly ['ver', 'mudar']; notas: readonly ['sem_acesso', 'ver', 'corrigir'];
    assistente: readonly ['sem_acesso', 'site', 'site_whatsapp']; treinar: readonly ['nao', 'sim']; prazos: readonly ['nao', 'sim'];
    configuracoes: readonly ['nao', 'sim'] };
  export type Modulo = keyof typeof NIVEIS;
  export type NivelDe<M extends Modulo> = (typeof NIVEIS)[M][number];
  export type Niveis = { [M in Modulo]: NivelDe<M> };
  export const MODULOS: Modulo[];
  export const NIVEIS_PADRAO: Niveis;
  export function nivelAtinge<M extends Modulo>(modulo: M, nivel: NivelDe<M>, minimo: NivelDe<M>): boolean;
  export function lerNiveis(bruto: Record<string, unknown> | null | undefined): Niveis;

  // @escritorio/db
  export type UsuarioAssistente = { id: string; nome: string; papel: 'admin' | 'atendente'; niveis: Niveis; setores: string[]; telefone: string | null; ativo: boolean };
  repos.horarioPermite(usuarioId: string, quando: Date): Promise<boolean>;
  ```

  `UsuarioAssistente.permissoes` **sai** (o trabalhador passa a ler `niveis`, Task 8).

- [ ] **Passo 1: os testes**

Crie `packages/core/test/permissoes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { lerNiveis, MODULOS, NIVEIS, NIVEIS_PADRAO, nivelAtinge } from '../src/permissoes';

describe('permissões por nível (Parte D)', () => {
  it('nove módulos, cada um com o padrão entre os seus níveis', () => {
    expect(MODULOS).toEqual(['atendimento', 'demandas', 'clientes', 'precos', 'notas', 'assistente', 'treinar', 'prazos', 'configuracoes']);
    for (const m of MODULOS) expect(NIVEIS[m]).toContain(NIVEIS_PADRAO[m]);
  });

  it('quem tem um nível tem os de antes dele', () => {
    expect(nivelAtinge('demandas', 'todas', 'meu_setor')).toBe(true);
    expect(nivelAtinge('demandas', 'minhas', 'meu_setor')).toBe(false);
    expect(nivelAtinge('clientes', 'arquivar', 'editar')).toBe(true);
    expect(nivelAtinge('assistente', 'site', 'site_whatsapp')).toBe(false);
    expect(nivelAtinge('notas', 'ver', 'ver')).toBe(true);
  });

  it('lerNiveis completa com o padrão e ignora módulo ou nível desconhecido', () => {
    expect(lerNiveis({ demandas: 'todas', clientes: 'tudo', outro: 'x' })).toEqual({ ...NIVEIS_PADRAO, demandas: 'todas' });
    expect(lerNiveis(null)).toEqual(NIVEIS_PADRAO);
  });
});
```

Crie `packages/db/test/niveis.test.ts`:

```ts
import { MODULOS, NIVEIS, NIVEIS_PADRAO } from '@escritorio/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';
import { criarUsuario } from './usuario';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

beforeEach(async () => { await limparBanco(); });

describe('níveis (Parte D)', () => {
  it('o catálogo do banco é o mesmo do código, na mesma ordem, com o mesmo padrão', async () => {
    const { data, error } = await db.from('permissao_niveis').select('modulo, nivel, ordem').order('modulo').order('ordem');
    expect(error).toBeNull();
    const doBanco = Object.fromEntries(MODULOS.map((m) => [m, data!.filter((l) => l.modulo === m).map((l) => l.nivel)]));
    expect(doBanco).toEqual(NIVEIS);
    for (const m of MODULOS) expect((await db.rpc('nivel_padrao', { p_modulo: m })).data).toBe(NIVEIS_PADRAO[m]);
  });

  it('o usuário do assistente pelo WhatsApp vem com os níveis', async () => {
    const id = await criarUsuario(db, 'wa@niveis.local', { papel: 'atendente', telefone: '5531944440001', permissoes: ['assistente_whatsapp'] });
    await db.from('usuario_permissoes').update({ nivel: 'minhas' }).eq('usuario_id', id).eq('modulo', 'demandas');
    const u = await repos.usuarioDoAssistente('5531944440001');
    expect(u?.id).toBe(id);
    expect(u?.niveis).toEqual({ ...NIVEIS_PADRAO, assistente: 'site_whatsapp', demandas: 'minhas' });
    await db.from('usuario_permissoes').update({ nivel: 'site' }).eq('usuario_id', id).eq('modulo', 'assistente');
    expect(await repos.usuarioDoAssistente('5531944440001')).toBeNull();
  });

  it('horário: sem restrição entra; tudo bloqueado não entra; administrador sempre', async () => {
    const ana = await criarUsuario(db, 'ana@niveis.local', { papel: 'atendente' });
    const dono = await criarUsuario(db, 'dono@niveis.local', { papel: 'admin' });
    expect(await repos.horarioPermite(ana, new Date())).toBe(true);
    const bloqueado = { semana: null, sabado: null, domingo: null };
    await db.from('usuarios').update({ horario_acesso: bloqueado }).in('id', [ana, dono]);
    expect(await repos.horarioPermite(ana, new Date())).toBe(false);
    expect(await repos.horarioPermite(dono, new Date())).toBe(true);
  });
});
```

- [ ] **Passo 2: ver falhar**

```bash
pnpm --filter @escritorio/core test -- permissoes
pnpm --filter @escritorio/db test -- niveis
```

Expected: core falha (`Cannot find module '../src/permissoes'`); db falha (`MODULOS` indefinido e `repos.horarioPermite is not a function`).

- [ ] **Passo 3: o core**

Crie `packages/core/src/permissoes.ts`:

```ts
/**
 * Permissões por módulo com nível (spec 7.1, Parte D). A ordem de cada lista é a do banco (permissao_niveis.ordem):
 * quem tem um nível tem também os de antes dele. packages/db/test/niveis.test.ts confere que bate com o banco.
 */
export const NIVEIS = {
  atendimento: ['sem_acesso', 'meus_setores', 'todas'],
  demandas: ['minhas', 'meu_setor', 'todas'],
  clientes: ['ver', 'editar', 'arquivar'],
  precos: ['ver', 'mudar'],
  notas: ['sem_acesso', 'ver', 'corrigir'],
  assistente: ['sem_acesso', 'site', 'site_whatsapp'],
  treinar: ['nao', 'sim'],
  prazos: ['nao', 'sim'],
  configuracoes: ['nao', 'sim'],
} as const;

export type Modulo = keyof typeof NIVEIS;
export type NivelDe<M extends Modulo> = (typeof NIVEIS)[M][number];
export type Niveis = { [M in Modulo]: NivelDe<M> };

export const MODULOS = Object.keys(NIVEIS) as Modulo[];

/** O nível que reproduz o comportamento de antes da Parte D para quem não tinha marcação (igual a nivel_padrao do banco). */
export const NIVEIS_PADRAO: Niveis = {
  atendimento: 'meus_setores', demandas: 'meu_setor', clientes: 'ver', precos: 'ver', notas: 'ver',
  assistente: 'sem_acesso', treinar: 'nao', prazos: 'sim', configuracoes: 'nao',
};

export function nivelAtinge<M extends Modulo>(modulo: M, nivel: NivelDe<M>, minimo: NivelDe<M>): boolean {
  const ordem: readonly string[] = NIVEIS[modulo];
  return ordem.indexOf(nivel) >= ordem.indexOf(minimo);
}

/** Níveis lidos do banco ({modulo: nivel}): o que faltar ou vier desconhecido fica no padrão. */
export function lerNiveis(bruto: Record<string, unknown> | null | undefined): Niveis {
  const n: Record<string, string> = { ...NIVEIS_PADRAO };
  for (const m of MODULOS) {
    const v = bruto?.[m];
    if (typeof v === 'string' && (NIVEIS[m] as readonly string[]).includes(v)) n[m] = v;
  }
  return n as Niveis;
}
```

Em `packages/core/src/index.ts`, acrescente no fim:

```ts
export * from './permissoes';
```

- [ ] **Passo 4: o repos**

Em `packages/db/src/repos.ts`:

1. No topo, junte `lerNiveis` e o tipo `Niveis` ao import de `@escritorio/core` (o arquivo já importa `variantesTelefone` de lá):

   ```ts
   import { lerNiveis, variantesTelefone, type Niveis } from '@escritorio/core';
   ```

   (mantenha os outros nomes que o import já traz).

2. Troque o tipo da linha 44:

   ```ts
   export type UsuarioAssistente = { id: string; nome: string; papel: 'admin' | 'atendente'; niveis: Niveis; setores: string[]; telefone: string | null; ativo: boolean };
   ```

3. Logo abaixo do tipo, acrescente:

   ```ts
   const COLUNAS_ASSISTENTE = 'id, nome, papel, telefone, ativo, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)';
   type LinhaAssistente = {
     id: string; nome: string; papel: 'admin' | 'atendente'; telefone: string | null; ativo: boolean;
     usuario_setores: { setor_id: string }[]; usuario_permissoes: { modulo: string; nivel: string }[];
   };
   /** Linha de usuarios com setores e níveis (Parte D): o que o assistente precisa saber da pessoa. */
   function paraUsuarioAssistente(u: LinhaAssistente): UsuarioAssistente {
     return {
       id: u.id, nome: u.nome, papel: u.papel, telefone: u.telefone, ativo: u.ativo,
       setores: u.usuario_setores.map((s) => s.setor_id),
       niveis: lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel]))),
     };
   }
   ```

4. Troque `usuarioDoAssistente` e `obterUsuarioAssistente` e acrescente `horarioPermite`:

   ```ts
       /** Telefone de alguém da equipe com "Site e WhatsApp" (o mesmo critério de eh_telefone_do_assistente). */
       async usuarioDoAssistente(telefone: string): Promise<UsuarioAssistente | null> {
         const linhas = checar(await db.from('usuarios').select(COLUNAS_ASSISTENTE)
           .in('telefone', variantesTelefone(telefone)).eq('ativo', true), 'usuarioDoAssistente');
         return (linhas as LinhaAssistente[]).map(paraUsuarioAssistente).find((u) => u.niveis.assistente === 'site_whatsapp') ?? null;
       },

       async obterUsuarioAssistente(id: string): Promise<UsuarioAssistente | null> {
         const u = checar(await db.from('usuarios').select(COLUNAS_ASSISTENTE).eq('id', id).maybeSingle(), 'obterUsuarioAssistente');
         return u ? paraUsuarioAssistente(u as LinhaAssistente) : null;
       },

       /** Horário de acesso (Parte D): quem decide é o banco, com o mesmo critério do painel. */
       async horarioPermite(usuarioId: string, quando: Date): Promise<boolean> {
         const r = await db.rpc('horario_permite', { p_usuario: usuarioId, p_quando: quando.toISOString() });
         if (r.error) throw new Error(r.error.message);
         return r.data === true;
       },
   ```

- [ ] **Passo 5: ver passar**

```bash
pnpm --filter @escritorio/core test
pnpm --filter @escritorio/db test
pnpm --filter @escritorio/db typecheck
```

Expected: tudo verde. O `typecheck` do trabalhador **vai falhar** (ele ainda lê `usuario.permissoes`); a Task 8 resolve. Não faça commit parcial do trabalhador aqui.

- [ ] **Passo 6: commit**

```bash
git add packages/core/src/permissoes.ts packages/core/src/index.ts packages/core/test/permissoes.test.ts packages/db/src/repos.ts packages/db/test/niveis.test.ts
git commit -m "feat(core,db): módulos e níveis no código, conferidos com o banco

O usuário do assistente traz os níveis no lugar das marcações; o repos
pergunta o horário ao banco (horario_permite).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Trabalhador. O assistente respeita os níveis e o horário

**Files:**
- Modify: `apps/trabalhador/src/assistente/visibilidade.ts`, `contexto.ts`, `ferramentas.ts`, `processar.ts`, `prompt.ts`
- Create: `apps/trabalhador/test/assistente/niveis.test.ts`
- Modify: `apps/trabalhador/test/assistente/processar.test.ts`

**Interfaces:**
- Consumes (Task 7): `UsuarioAssistente.niveis`, `repos.horarioPermite`, `nivelAtinge`, `NIVEIS_PADRAO`; (Task 3) `pode_ver_chamado_de`, `pode_ver_conversa_de` pelo `db.rpc`.
- Produces:
  - `podeVerChamado(u, c)`, `podeVerConversaPelo(u, conversa, demandas)`, `podeVerPedidos(u)`, `podeCorrigirPedidos(u)`, `usaAssistentePor(u, canal)` em `visibilidade.ts`;
  - `processarAssistente(...)` passa a devolver também `'fora-do-horario'`; `MENSAGEM_FORA_DO_HORARIO` exportada de `processar.ts`.

- [ ] **Passo 1: os testes**

Crie `apps/trabalhador/test/assistente/niveis.test.ts`:

```ts
import { NIVEIS_PADRAO, type Niveis } from '@escritorio/core';
import type { UsuarioAssistente } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { beforeEach, describe, expect, it } from 'vitest';
import { podeCorrigirPedidos, podeVerChamado, podeVerConversaPelo, podeVerPedidos, usaAssistentePor } from '../../src/assistente/visibilidade';
import { db, repos } from '../apoio/cenario';
import { criarUsuarioTeste } from '../apoio/usuario';

const pessoa = (n: Partial<Niveis>, papel: 'admin' | 'atendente' = 'atendente'): UsuarioAssistente =>
  ({ id: 'u1', nome: 'Ana', papel, telefone: null, ativo: true, setores: ['s1'], niveis: { ...NIVEIS_PADRAO, ...n } });

describe('assistente pelos níveis (Parte D)', () => {
  it('pedidos de nota: Ver lê, Corrigir e gerar corrige; Sem acesso não lê (P11)', () => {
    expect(podeVerPedidos(pessoa({ notas: 'ver' }))).toBe(true);
    expect(podeCorrigirPedidos(pessoa({ notas: 'ver' }))).toBe(false);
    expect(podeVerPedidos(pessoa({ notas: 'sem_acesso' }))).toBe(false);
    expect(podeCorrigirPedidos(pessoa({ notas: 'corrigir' }))).toBe(true);
    expect(podeCorrigirPedidos(pessoa({ notas: 'sem_acesso' }, 'admin'))).toBe(true);
  });

  it('canal do assistente: sem passe livre do administrador (P3)', () => {
    expect(usaAssistentePor(pessoa({ assistente: 'site' }), 'site')).toBe(true);
    expect(usaAssistentePor(pessoa({ assistente: 'site' }), 'whatsapp')).toBe(false);
    expect(usaAssistentePor(pessoa({ assistente: 'site_whatsapp' }), 'whatsapp')).toBe(true);
    expect(usaAssistentePor(pessoa({}, 'admin'), 'site')).toBe(false);
  });
});

describe('a regra do trabalhador é a do banco, pessoa a pessoa (foco da revisão 5)', () => {
  beforeEach(async () => { await limparBanco(); });

  it('demandas e conversas, em cada nível', async () => {
    const setor = async (nome: string) => (await db.from('setores').select('id').eq('nome', nome).single()).data!.id as string;
    const [fiscal, pessoal] = [await setor('Fiscal'), await setor('Pessoal')];
    const criar = (email: string, papel: 'admin' | 'atendente', setores: string[]) =>
      criarUsuarioTeste({ email: `${email}@niveis-assistente.local`, papel, setores, permissoes: [] });
    const p = {
      admin: await criar('admin', 'admin', []),
      minhas: await criar('minhas', 'atendente', ['Fiscal']),
      setor: await criar('setor', 'atendente', ['Fiscal']),
      todas: await criar('todas', 'atendente', ['Fiscal']),
      semAtendimento: await criar('sem', 'atendente', ['Fiscal']),
      todasConversas: await criar('tc', 'atendente', ['Pessoal']),
      arquivada: await criar('arq', 'atendente', ['Fiscal']),
    };
    const nivel = (id: string, modulo: string, n: string) =>
      db.from('usuario_permissoes').update({ nivel: n }).eq('usuario_id', id).eq('modulo', modulo);
    await nivel(p.minhas, 'demandas', 'minhas');
    await nivel(p.todas, 'demandas', 'todas');
    await nivel(p.semAtendimento, 'atendimento', 'sem_acesso');
    await nivel(p.todasConversas, 'atendimento', 'todas');
    await db.from('usuarios').update({ ativo: false }).eq('id', p.arquivada);

    const conversas = (await db.from('conversas').insert([
      { telefone: '5531933330001' }, { telefone: '5531933330002' }, { telefone: '5531933330003', estado: 'humano', atendente_id: p.setor },
    ]).select('id')).data!.map((c) => c.id);
    const demandas = (await db.from('chamados').insert([
      { titulo: 'N1 Fiscal', setor_id: fiscal, conversa_id: conversas[0] },
      { titulo: 'N2 Fiscal da Minhas', setor_id: fiscal, responsavel_id: p.minhas, conversa_id: conversas[1] },
      { titulo: 'N3 Pessoal', setor_id: pessoal },
      { titulo: 'N4 Triagem', setor_id: null },
    ]).select('id, setor_id, responsavel_id')).data!;

    for (const id of Object.values(p)) {
      const u = (await repos.obterUsuarioAssistente(id))!;
      for (const c of demandas) {
        const banco = (await db.rpc('pode_ver_chamado_de', { p_usuario: id, p_chamado: c.id })).data;
        expect(podeVerChamado(u, c), `${u.id} × demanda ${c.id}`).toBe(banco);
      }
      for (const conversaId of conversas) {
        const [conversa, daConversa] = await Promise.all([repos.obterConversa(conversaId), repos.chamadosDaConversaParaVisibilidade(conversaId)]);
        const banco = (await db.rpc('pode_ver_conversa_de', { p_usuario: id, p_conversa: conversaId })).data;
        expect(podeVerConversaPelo(u, conversa, daConversa), `${u.id} × conversa ${conversaId}`).toBe(banco);
      }
    }
  });
});
```

Em `apps/trabalhador/test/assistente/processar.test.ts`, troque o import da linha 3 por

```ts
import { MENSAGEM_FORA_DO_HORARIO, MENSAGEM_TETO, processarAssistente } from '../../src/assistente/processar';
```

e acrescente dentro do `describe`:

```ts
  it('fora do horário: avisa pelo WhatsApp e não chama a IA (P17)', async () => {
    const ana = await criarUsuarioTeste({ email: 'ana@teste-horario.local', papel: 'atendente', permissoes: ['assistente_whatsapp'], telefone: '5531922220001' });
    await db.from('usuarios').update({ horario_acesso: { semana: null, sabado: null, domingo: null } }).eq('id', ana);
    await repos.registrarMensagemAssistente({ usuarioId: ana, canal: 'whatsapp', conversaId: null, papel: 'usuario', conteudo: 'quais notas?' });
    const ia = new IaRoteirizada([]);
    expect(await processarAssistente({ repos, ia, canal }, { usuarioId: ana, canal: 'whatsapp', conversaId: null, telefone: '5531922220001' }, true))
      .toBe('fora-do-horario');
    expect(ia.recebidos).toEqual([]);
    expect(canal.enviados).toEqual([{ telefone: '5531922220001', texto: MENSAGEM_FORA_DO_HORARIO }]);
    expect(await repos.perguntasPendentes(ana, 'whatsapp', null)).toEqual([]);
  });

  it('administrador com horário bloqueado é respondido normalmente', async () => {
    await db.from('usuarios').update({ horario_acesso: { semana: null, sabado: null, domingo: null } }).eq('id', dono);
    await perguntar('oi');
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()]);
    expect(await processarAssistente({ repos, ia, canal }, { usuarioId: dono, canal: 'site', conversaId: null, telefone: null }, true)).toBe('respondido');
  });
```

(`dono` do `beforeEach` desse arquivo é administrador, porque `criarUsuarioTeste` usa `papel: 'admin'` por padrão.)

- [ ] **Passo 2: ver falhar**

```bash
pnpm --filter @escritorio/trabalhador test -- assistente
```

Expected: falha de tipo e de execução (`usuario.permissoes` indefinido, `podeVerConversaPelo` e `MENSAGEM_FORA_DO_HORARIO` inexistentes).

- [ ] **Passo 3: visibilidade**

Substitua todo o `apps/trabalhador/src/assistente/visibilidade.ts`:

```ts
import { nivelAtinge } from '@escritorio/core';
import type { UsuarioAssistente } from '@escritorio/db';

type DemandaVisivel = { setor_id: string | null; responsavel_id: string | null };

/** Igual a pode_ver_chamado_de do banco (Parte D): admin vê tudo; responsável vê a sua; o resto pelo nível de Demandas. */
export function podeVerChamado(u: UsuarioAssistente, c: DemandaVisivel): boolean {
  if (!u.ativo) return false;
  if (u.papel === 'admin' || c.responsavel_id === u.id) return true;
  if (u.niveis.demandas === 'todas') return true;
  return u.niveis.demandas === 'meu_setor' && c.setor_id !== null && u.setores.includes(c.setor_id);
}

/** Igual a pode_ver_conversa_de: pelo nível de Atendimento (quem assumiu; demandas da conversa no setor ou com a pessoa). */
export function podeVerConversaPelo(u: UsuarioAssistente, conversa: { atendente_id: string | null }, demandas: DemandaVisivel[]): boolean {
  if (!u.ativo) return false;
  if (u.papel === 'admin' || u.niveis.atendimento === 'todas') return true;
  if (u.niveis.atendimento === 'sem_acesso') return false;
  return conversa.atendente_id === u.id
    || demandas.some((c) => c.responsavel_id === u.id || (c.setor_id !== null && u.setores.includes(c.setor_id)));
}

/** Pedidos de nota (P11): "Ver" lê pedidos e vendas. */
export function podeVerPedidos(u: UsuarioAssistente): boolean {
  return u.papel === 'admin' || nivelAtinge('notas', u.niveis.notas, 'ver');
}

/** "Corrigir e gerar": corrige pedido e gera o CSV do Bling. */
export function podeCorrigirPedidos(u: UsuarioAssistente): boolean {
  return u.papel === 'admin' || u.niveis.notas === 'corrigir';
}

/** Canal do assistente: sem passe livre do administrador, como antes (P3). */
export function usaAssistentePor(u: UsuarioAssistente, canal: 'site' | 'whatsapp'): boolean {
  return u.ativo && nivelAtinge('assistente', u.niveis.assistente, canal === 'site' ? 'site' : 'site_whatsapp');
}
```

- [ ] **Passo 4: contexto, ferramentas e prompt**

Em `apps/trabalhador/src/assistente/contexto.ts`, troque o import da linha 2 por `import { podeVerChamado, podeVerConversaPelo } from './visibilidade';` e a função `podeVerConversa` (linhas 18 a 24) por:

```ts
/** Igual a pode_ver_conversa_de do banco (o trabalhador usa a chave de serviço, então a regra é repetida aqui). */
async function podeVerConversa(repos: Repos, u: UsuarioAssistente, conversaId: string): Promise<boolean> {
  const [c, demandas] = await Promise.all([repos.obterConversa(conversaId), repos.chamadosDaConversaParaVisibilidade(conversaId)]);
  return podeVerConversaPelo(u, c, demandas);
}
```

Em `apps/trabalhador/src/assistente/ferramentas.ts`:

1. Import da linha 15:

   ```ts
   import { podeCorrigirPedidos, podeVerChamado, podeVerPedidos } from './visibilidade';
   ```

2. Logo abaixo dos imports, a mensagem:

   ```ts
   const SEM_PEDIDOS = 'Você não tem acesso aos pedidos de nota. Peça ao administrador na tela Usuários.';
   ```

3. Troque a linha 152 (`const visivelPara = ...`) e o comentário acima dela:

   ```ts
     // Pelo nível de Demandas (Parte D): Todas = sem filtro; Só as minhas = onde é responsável; Do meu setor = o de antes.
     const visivelPara = u.papel === 'admin' || u.niveis.demandas === 'todas' ? null
       : { usuarioId: u.id, setorIds: u.niveis.demandas === 'meu_setor' ? u.setores : [] };
     const verPedidos = podeVerPedidos(u);
   ```

4. Em `listar_demandas`, as duas linhas do pedido passam a depender de `verPedidos`:

   ```ts
           responsavel: c.responsavel, total_pedido: verPedidos && c.pedido_venda ? formatarReais(totalDoPedido(c.pedido_venda)) : null,
           ...(verPedidos && c.pedido_venda ? { itens_sem_preco: itensSemPreco(c.pedido_venda) } : {}),
   ```

5. Em `ver_demanda`, troque `if (c.pedido_venda) {` por `if (c.pedido_venda && verPedidos) {`.

6. Em `resumo_vendas`, primeira linha do `case`: `if (!verPedidos) return falha(SEM_PEDIDOS);`.

7. Nas mensagens de `alterar_pedido_venda` e `gerar_csv_bling`, troque o texto da marcação antiga: `'Você não tem permissão para corrigir pedidos de nota. Peça ao administrador o nível "Corrigir e gerar" em Pedidos de nota, na tela Usuários.'` e `'Você não tem permissão para gerar o CSV do Bling. Peça ao administrador o nível "Corrigir e gerar" em Pedidos de nota, na tela Usuários.'`. Antes, `grep -rn "Corrigir pedidos de nota e gerar CSV do Bling\|gerar o CSV do Bling. Peça" apps/trabalhador` e ajuste os testes que comparam esse texto.

Em `apps/trabalhador/src/assistente/prompt.ts`, importe `import { podeCorrigirPedidos, podeVerPedidos } from './visibilidade';` e troque o bloco `const pode = [...]` (linhas 12 a 15):

```ts
  const pode = [
    podeVerPedidos(u) ? 'consultar demandas, pedidos, vendas, preços e cadastros' : 'consultar demandas, preços e cadastros',
    podeCorrigirPedidos(u) ? 'corrigir pedidos de nota e gerar o CSV do Bling' : null,
  ].filter(Boolean).join('; ');
```

(Para quem já existe o texto do prompt sai igual ao de antes: "Ver" é o padrão.)

- [ ] **Passo 5: processar (canal e horário)**

Em `apps/trabalhador/src/assistente/processar.ts`:

1. Imports: `import { usaAssistentePor } from './visibilidade';`.
2. Depois de `MENSAGEM_FALHA`:

   ```ts
   export const MENSAGEM_FORA_DO_HORARIO = 'Fora do seu horário de acesso. O assistente volta a responder quando o seu horário começar.';
   ```

3. Tipo de retorno: `Promise<'sem-perguntas' | 'sem-permissao' | 'fora-do-horario' | 'teto' | 'respondido'>`.
4. Troque as linhas 27 e 28 (`const permissao = ...` e o `if`) por:

   ```ts
     if (!usuario || !usaAssistentePor(usuario, j.canal)) {
   ```

5. Logo depois da definição de `const responder = async (...) => { ... };` e antes de `const agora = new Date();`, acrescente:

   ```ts
     // Horário de acesso (spec 7.2, P17): avisa e não chama a IA. O banco decide (admin nunca é bloqueado).
     if (!(await d.repos.horarioPermite(usuario.id, new Date()))) {
       await responder(MENSAGEM_FORA_DO_HORARIO);
       return 'fora-do-horario';
     }
   ```

Confira quem usa o retorno: `grep -rn "processarAssistente(" apps/trabalhador/src`. `principal.ts` (linha 49) e `cenarios/assistente.ts` (linha 53) só guardam o valor; nenhum `switch` exaustivo quebra.

- [ ] **Passo 6: ver passar**

```bash
pnpm --filter @escritorio/trabalhador test
pnpm --filter @escritorio/trabalhador typecheck
```

Expected: tudo verde, inclusive `niveis.test.ts` (regra do trabalhador = regra do banco para as 7 pessoas × 4 demandas × 3 conversas) e os testes antigos do assistente (as pessoas deles vêm do array antigo, convertido pelos gatilhos).

- [ ] **Passo 7: commit**

```bash
git add apps/trabalhador/src/assistente apps/trabalhador/test/assistente
git commit -m "feat(trabalhador): assistente pelos níveis e pelo horário de acesso

Demandas e conversas pela mesma regra do banco (teste de equivalência pessoa
a pessoa), pedidos de nota por Ver e Corrigir e gerar, canal sem passe livre
do administrador. Fora do horário responde o aviso sem chamar a IA.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Painel. Sessão pelos níveis, menu, horário no middleware e no login

**Files:**
- Create: `apps/painel/src/lib/permissoes.ts`, `apps/painel/src/lib/permissoes.test.ts`
- Create: `apps/painel/src/lib/horario-acesso.ts`, `apps/painel/src/lib/horario-acesso.test.ts`, `apps/painel/src/lib/situacao-acesso.ts` (sem imports: o `middleware` roda no Edge e não deve puxar o `@escritorio/core` inteiro)
- Modify: `apps/painel/src/lib/sessao.ts`, `apps/painel/src/lib/menu.ts`, `apps/painel/src/lib/menu.test.ts`, `apps/painel/src/lib/caixa.ts`
- Modify: `apps/painel/src/middleware.ts`, `apps/painel/src/app/entrar/acoes.ts`, `apps/painel/src/app/entrar/page.tsx`
- Create: `apps/painel/src/app/fora-do-horario/page.tsx`
- Modify (trocar `temPermissao` / `u.permissoes`): os arquivos da lista do Passo 6 e os testes que simulam a sessão
- Create: `apps/painel/e2e/horario-acesso.spec.ts`

**Interfaces:**
- Consumes: `NIVEIS`, `NIVEIS_PADRAO`, `lerNiveis`, `nivelAtinge`, `FUSO_HORARIO` (`@escritorio/core`); rpc `situacao_acesso`.
- Produces:
  - `UsuarioPainel = { id; nome; papel; niveis: Niveis; setores: string[]; tamanhoLetra }` (sem `permissoes`);
  - `@/lib/permissoes`: `temNivel(u, modulo, minimo)`, `usaAssistente(u, canal?)`, `ROTULO_MODULO`, `ROTULO_NIVEL`, `AJUDA_MODULO`, `rotuloNivel(m, n)`;
  - `@/lib/horario-acesso`: `type Faixa`, `type HorarioAcesso`, `type DiaHorario`, `DIAS_HORARIO`, `HORARIO_PADRAO`, `descreverHorario(h)`, `lerHorarioAcesso(f: FormData)`, `lerHorarioDoBanco(bruto)`, `horarioPermiteEm(h, quando)`; `@/lib/situacao-acesso`: `type SituacaoAcesso`, `situacaoDe(bruto)` (reexportados por `@/lib/horario-acesso`);
  - `@/lib/sessao`: `obterUsuario()`, `exigirAdmin()`, `exigirConfiguracoes()` (`temPermissao` sai);
  - rota `/fora-do-horario`; erro `?erro=fora_do_horario` no login.

- [ ] **Passo 1: os testes das regras puras**

Crie `apps/painel/src/lib/horario-acesso.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { descreverHorario, HORARIO_PADRAO, horarioPermiteEm, lerHorarioAcesso, lerHorarioDoBanco, situacaoDe } from './horario-acesso';

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
};

describe('horário de acesso (Parte D)', () => {
  it('descreve o horário como a pessoa lê', () => {
    expect(descreverHorario(null)).toBe('sem restrição de horário');
    expect(descreverHorario(HORARIO_PADRAO)).toBe('seg a sex 08:00 às 18:00 · sábado bloqueado · domingo bloqueado');
  });

  it('lê o formulário: sem restrição, dias permitidos e bloqueados', () => {
    expect(lerHorarioAcesso(form({ horario_restrito: 'nao' }))).toEqual({ ok: true, valor: null });
    expect(lerHorarioAcesso(form({
      horario_restrito: 'sim', horario_semana: 'permitido', horario_semana_de: '08:00', horario_semana_ate: '18:00',
      horario_sabado: 'permitido', horario_sabado_de: '08:00', horario_sabado_ate: '12:00', horario_domingo: 'bloqueado',
    }))).toEqual({ ok: true, valor: { semana: { de: '08:00', ate: '18:00' }, sabado: { de: '08:00', ate: '12:00' }, domingo: null } });
  });

  it('recusa fim antes do início e hora vazia, dizendo o dia', () => {
    expect(lerHorarioAcesso(form({ horario_restrito: 'sim', horario_semana: 'permitido', horario_semana_de: '18:00', horario_semana_ate: '08:00',
      horario_sabado: 'bloqueado', horario_domingo: 'bloqueado' }))).toEqual({ ok: false, erro: 'Seg a sex: o fim precisa ser depois do início.' });
    expect(lerHorarioAcesso(form({ horario_restrito: 'sim', horario_semana: 'bloqueado', horario_sabado: 'permitido', horario_sabado_de: '',
      horario_sabado_ate: '12:00', horario_domingo: 'bloqueado' }))).toEqual({ ok: false, erro: 'Sábado: informe o início e o fim.' });
  });

  it('mesma regra do banco, no fuso de Brasília (só para mostrar; quem decide é o banco)', () => {
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-05T12:00:00-03:00'))).toBe(true);
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-05T18:00:00-03:00'))).toBe(true);
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-05T18:01:00-03:00'))).toBe(false);
    expect(horarioPermiteEm(HORARIO_PADRAO, new Date('2026-10-03T10:00:00-03:00'))).toBe(false);
    expect(horarioPermiteEm(null, new Date('2026-10-04T03:00:00-03:00'))).toBe(true);
  });

  it('lê o horário e a situação que vêm do banco', () => {
    expect(lerHorarioDoBanco(HORARIO_PADRAO)).toEqual(HORARIO_PADRAO);
    expect(lerHorarioDoBanco(null)).toBeNull();
    expect(situacaoDe({ situacao: 'fora_do_horario', horario: HORARIO_PADRAO })).toBe('fora_do_horario');
    expect(situacaoDe({ situacao: 'qualquer' })).toBe('inativo');
    expect(situacaoDe(null)).toBe('inativo');
  });
});
```

Crie `apps/painel/src/lib/permissoes.test.ts`:

```ts
import { MODULOS, NIVEIS, NIVEIS_PADRAO } from '@escritorio/core';
import { describe, expect, it } from 'vitest';
import { AJUDA_MODULO, ROTULO_MODULO, ROTULO_NIVEL, temNivel, usaAssistente } from './permissoes';

describe('permissões no painel (Parte D)', () => {
  it('todo módulo e todo nível têm rótulo e ajuda', () => {
    for (const m of MODULOS) {
      expect(ROTULO_MODULO[m]).toBeTruthy();
      expect(AJUDA_MODULO[m]).toBeTruthy();
      for (const n of NIVEIS[m]) expect((ROTULO_NIVEL[m] as Record<string, string>)[n]).toBeTruthy();
    }
  });

  it('administrador passa em tudo, menos no assistente (é por marcação)', () => {
    const admin = { papel: 'admin' as const, niveis: NIVEIS_PADRAO };
    expect(temNivel(admin, 'clientes', 'arquivar')).toBe(true);
    expect(usaAssistente(admin)).toBe(false);
    const ana = { papel: 'atendente' as const, niveis: { ...NIVEIS_PADRAO, clientes: 'editar' as const, assistente: 'site' as const } };
    expect(temNivel(ana, 'clientes', 'editar')).toBe(true);
    expect(temNivel(ana, 'clientes', 'arquivar')).toBe(false);
    expect(usaAssistente(ana)).toBe(true);
    expect(usaAssistente(ana, 'whatsapp')).toBe(false);
  });
});
```

Substitua `apps/painel/src/lib/menu.test.ts`:

```ts
import { NIVEIS_PADRAO, type Niveis } from '@escritorio/core';
import { describe, expect, it } from 'vitest';
import { itensDoMenu } from './menu';

const n = (x: Partial<Niveis> = {}): Niveis => ({ ...NIVEIS_PADRAO, ...x });
const rotulos = (papel: 'admin' | 'atendente', niveis: Niveis) => itensDoMenu({ papel, niveis }).map((i) => i.rotulo);

describe('menu pelos níveis (Parte D)', () => {
  it('atendente com os níveis de sempre: o menu de antes', () => {
    expect(rotulos('atendente', n())).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos']);
  });
  it('assistente e treinar aparecem pelo nível', () => {
    expect(rotulos('atendente', n({ assistente: 'site' }))).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente']);
    expect(rotulos('atendente', n({ treinar: 'sim', assistente: 'site_whatsapp' })))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente', 'Treinar o agente']);
  });
  it('Atendimento some com "Sem acesso"', () => {
    expect(rotulos('atendente', n({ atendimento: 'sem_acesso' }))).toEqual(['Início', 'Demandas', 'Clientes', 'Contatos']);
  });
  it('Configurações para quem tem "Sim", sem Usuários e permissões', () => {
    const conf = itensDoMenu({ papel: 'atendente', niveis: n({ configuracoes: 'sim' }) }).find((i) => i.rotulo === 'Configurações')!;
    expect(conf.filhos!.map((f) => f.rotulo)).not.toContain('Usuários e permissões');
  });
  it('administrador: Treinar e Configurações completas; Assistente só com a marcação', () => {
    const itens = itensDoMenu({ papel: 'admin', niveis: n() });
    expect(itens.map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente', 'Configurações']);
    expect(itens.at(-1)!.filhos!.map((f) => f.rotulo)).toContain('Usuários e permissões');
    expect(rotulos('admin', n({ assistente: 'site' }))).toContain('Assistente');
  });
});
```

- [ ] **Passo 2: ver falhar**

Run: `pnpm --filter @escritorio/painel test -- horario-acesso permissoes menu`
Expected: FAIL (módulos `./horario-acesso` e `./permissoes` inexistentes; `itensDoMenu` lê `permissoes`).

- [ ] **Passo 3: as regras puras**

Crie `apps/painel/src/lib/permissoes.ts`:

```ts
import { nivelAtinge, type Modulo, type Niveis, type NivelDe } from '@escritorio/core';

export const ROTULO_MODULO: Record<Modulo, string> = {
  atendimento: 'Atendimento', demandas: 'Demandas', clientes: 'Clientes e contatos', precos: 'Preços',
  notas: 'Pedidos de nota e CSV Bling', assistente: 'Assistente', treinar: 'Treinar o agente',
  prazos: 'Alterar prazos de demandas', configuracoes: 'Configurações',
};

export const ROTULO_NIVEL: { [M in Modulo]: Record<NivelDe<M>, string> } = {
  atendimento: { sem_acesso: 'Sem acesso', meus_setores: 'Conversas dos meus setores', todas: 'Todas as conversas' },
  demandas: { minhas: 'Só as minhas', meu_setor: 'Do meu setor', todas: 'Todas' },
  clientes: { ver: 'Só ver', editar: 'Ver e editar', arquivar: 'Editar e arquivar' },
  precos: { ver: 'Só ver', mudar: 'Mudar preços' },
  notas: { sem_acesso: 'Sem acesso', ver: 'Ver', corrigir: 'Corrigir e gerar' },
  assistente: { sem_acesso: 'Sem acesso', site: 'Site', site_whatsapp: 'Site e WhatsApp' },
  treinar: { nao: 'Sem acesso', sim: 'Sim' },
  prazos: { nao: 'Não', sim: 'Sim' },
  configuracoes: { nao: 'Sem acesso', sim: 'Sim' },
};

/** Linha embaixo de cada campo da ficha: os níveis, do menor ao maior, e o que precisa saber (imagem 06). */
export const AJUDA_MODULO: Record<Modulo, string> = {
  atendimento: 'Sem acesso · Conversas dos meus setores · Todas as conversas',
  demandas: 'Só as minhas · Do meu setor · Todas',
  clientes: 'Só ver · Ver e editar · Editar e arquivar. Produtos entram em "Ver e editar".',
  precos: 'Só ver · Mudar preços. Produtos seguem em Clientes e contatos.',
  notas: 'Sem acesso · Ver · Corrigir e gerar. "Sem acesso" esconde o pedido na tela e no assistente.',
  assistente: 'Sem acesso · Site · Site e WhatsApp (exige telefone).',
  treinar: 'Escreve e liga as orientações que o agente segue.',
  prazos: 'Escolher o prazo à mão. Mudar a prioridade recalcula o prazo para todos.',
  configuracoes: 'Expediente, mensagens, prazos, setores, respostas e feriados. Teto de IA e usuários ficam com o administrador.',
};

export function rotuloNivel<M extends Modulo>(m: M, n: NivelDe<M>): string {
  return ROTULO_NIVEL[m][n];
}

/** O administrador passa em tudo; os demais, pelo nível do módulo. */
export function temNivel<M extends Modulo>(u: { papel: 'admin' | 'atendente'; niveis: Niveis }, modulo: M, minimo: NivelDe<M>): boolean {
  return u.papel === 'admin' || nivelAtinge(modulo, u.niveis[modulo], minimo);
}

/** Assistente é canal: precisa do nível até para o administrador, como antes (P3). */
export function usaAssistente(u: { niveis: Niveis }, canal: 'site' | 'whatsapp' = 'site'): boolean {
  return nivelAtinge('assistente', u.niveis.assistente, canal === 'site' ? 'site' : 'site_whatsapp');
}
```

Crie `apps/painel/src/lib/horario-acesso.ts`:

```ts
import { FUSO_HORARIO } from '@escritorio/core';

export type Faixa = { de: string; ate: string };
export type DiaHorario = 'semana' | 'sabado' | 'domingo';
/** null = sem restrição; null num dia = bloqueado (o mesmo formato de usuarios.horario_acesso). */
export type HorarioAcesso = Record<DiaHorario, Faixa | null>;
export { situacaoDe, type SituacaoAcesso } from './situacao-acesso';

export const DIAS_HORARIO: { chave: DiaHorario; rotulo: string }[] = [
  { chave: 'semana', rotulo: 'Seg a sex' }, { chave: 'sabado', rotulo: 'Sábado' }, { chave: 'domingo', rotulo: 'Domingo' },
];
/** Padrão de pessoa nova (spec 7.1). Quem já existia fica sem restrição até o administrador definir (P4). */
export const HORARIO_PADRAO: HorarioAcesso = { semana: { de: '08:00', ate: '18:00' }, sabado: null, domingo: null };
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function descreverHorario(h: HorarioAcesso | null): string {
  if (!h) return 'sem restrição de horário';
  return DIAS_HORARIO.map(({ chave, rotulo }) => {
    const f = h[chave];
    return f ? `${rotulo.toLowerCase()} ${f.de} às ${f.ate}` : `${rotulo.toLowerCase()} bloqueado`;
  }).join(' · ');
}

/** Campos horario_restrito, horario_<dia> (permitido|bloqueado), horario_<dia>_de e horario_<dia>_ate. */
export function lerHorarioAcesso(f: FormData): { ok: true; valor: HorarioAcesso | null } | { ok: false; erro: string } {
  if (f.get('horario_restrito') !== 'sim') return { ok: true, valor: null };
  const valor: HorarioAcesso = { semana: null, sabado: null, domingo: null };
  for (const { chave, rotulo } of DIAS_HORARIO) {
    if (f.get(`horario_${chave}`) !== 'permitido') continue;
    const de = String(f.get(`horario_${chave}_de`) ?? '');
    const ate = String(f.get(`horario_${chave}_ate`) ?? '');
    if (!HORA.test(de) || !HORA.test(ate)) return { ok: false, erro: `${rotulo}: informe o início e o fim.` };
    if (de >= ate) return { ok: false, erro: `${rotulo}: o fim precisa ser depois do início.` };
    valor[chave] = { de, ate };
  }
  return { ok: true, valor };
}

/** O banco já validou o formato (check horario_valido); aqui só dá o tipo. */
export function lerHorarioDoBanco(bruto: unknown): HorarioAcesso | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const h = bruto as Partial<HorarioAcesso>;
  return { semana: h.semana ?? null, sabado: h.sabado ?? null, domingo: h.domingo ?? null };
}

const partesBrasilia = new Intl.DateTimeFormat('en-US', { timeZone: FUSO_HORARIO, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Para mostrar ("Fora do horário agora" na lista). Quem decide de verdade é o banco (horario_permite). */
export function horarioPermiteEm(h: HorarioAcesso | null, quando: Date): boolean {
  if (!h) return true;
  const partes = partesBrasilia.formatToParts(quando);
  const pegar = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const dia = pegar('weekday');
  const faixa = dia === 'Sat' ? h.sabado : dia === 'Sun' ? h.domingo : h.semana;
  const hora = `${pegar('hour')}:${pegar('minute')}`;
  return faixa !== null && hora >= faixa.de && hora <= faixa.ate;
}
```

Crie `apps/painel/src/lib/situacao-acesso.ts` (sem imports, porque o `middleware` usa):

```ts
export type SituacaoAcesso = 'liberado' | 'fora_do_horario' | 'inativo' | 'sem_cadastro';

/** Resposta de situacao_acesso(); qualquer coisa estranha conta como sem acesso. */
export function situacaoDe(bruto: unknown): SituacaoAcesso {
  const s = (bruto as { situacao?: unknown } | null)?.situacao;
  return s === 'liberado' || s === 'fora_do_horario' || s === 'sem_cadastro' ? s : 'inativo';
}
```

Substitua `apps/painel/src/lib/menu.ts`:

```ts
import { nivelAtinge, type Niveis } from '@escritorio/core';

export type ItemMenu = { rotulo: string; href: string; filhos?: ItemMenu[] };

const SUBMENU_CONFIGURACOES: ItemMenu[] = [
  { rotulo: 'Usuários e permissões', href: '/usuarios' },
  { rotulo: 'Setores', href: '/configuracoes#setores' },
  { rotulo: 'Expediente e IA', href: '/configuracoes#expediente' },
  { rotulo: 'Mensagens', href: '/configuracoes#mensagens' },
  { rotulo: 'Respostas prontas', href: '/configuracoes#respostas' },
  { rotulo: 'Feriados', href: '/configuracoes#feriados' },
];
// "Configurações: Sim" sem ser administrador (P12): Usuários e permissões fica de fora.
const SUBMENU_SEM_USUARIOS = SUBMENU_CONFIGURACOES.filter((i) => i.href !== '/usuarios');

/** Itens do menu lateral pelos níveis da pessoa (Parte D). O administrador vê tudo, menos o Assistente sem a marcação. */
export function itensDoMenu(u: { papel: 'admin' | 'atendente'; niveis: Niveis }): ItemMenu[] {
  const admin = u.papel === 'admin';
  const itens: ItemMenu[] = [{ rotulo: 'Início', href: '/inicio' }];
  if (admin || u.niveis.atendimento !== 'sem_acesso') itens.push({ rotulo: 'Atendimento', href: '/atendimento' });
  itens.push({ rotulo: 'Demandas', href: '/demandas' }, { rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Contatos', href: '/contatos' });
  if (nivelAtinge('assistente', u.niveis.assistente, 'site')) itens.push({ rotulo: 'Assistente', href: '/assistente' });
  if (admin || u.niveis.treinar === 'sim') itens.push({ rotulo: 'Treinar o agente', href: '/treinar-agente' });
  if (admin) itens.push({ rotulo: 'Configurações', href: '/configuracoes', filhos: SUBMENU_CONFIGURACOES });
  else if (u.niveis.configuracoes === 'sim') itens.push({ rotulo: 'Configurações', href: '/configuracoes', filhos: SUBMENU_SEM_USUARIOS });
  return itens;
}
```

- [ ] **Passo 4: a sessão**

Substitua `apps/painel/src/lib/sessao.ts`:

```ts
import 'server-only';
import { lerNiveis, type Niveis } from '@escritorio/core';
import { redirect } from 'next/navigation';
import { tamanhoDoValor, type TamanhoLetra } from '@/components/layout/tamanho-letra';
import { situacaoDe } from './horario-acesso';
import { temNivel } from './permissoes';
import { supabaseServidor } from './supabase/servidor';

export type UsuarioPainel = { id: string; nome: string; papel: 'admin' | 'atendente'; niveis: Niveis; setores: string[]; tamanhoLetra: TamanhoLetra };

export async function obterUsuario(): Promise<UsuarioPainel> {
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar');
  const { data: u } = await sb.from('usuarios')
    .select('id, nome, papel, ativo, tamanho_letra, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)')
    .eq('id', auth.user.id).maybeSingle();
  if (!u || !u.ativo) {
    // Fora do horário a RLS também esconde a própria linha: a situação diz qual dos dois casos é.
    const { data: s } = await sb.rpc('situacao_acesso');
    redirect(situacaoDe(s) === 'fora_do_horario' ? '/fora-do-horario' : '/entrar?erro=inativo');
  }
  return {
    id: u.id, nome: u.nome, papel: u.papel,
    niveis: lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel]))),
    setores: u.usuario_setores.map((s) => s.setor_id), tamanhoLetra: tamanhoDoValor(u.tamanho_letra),
  };
}

export async function exigirAdmin(): Promise<UsuarioPainel> {
  const u = await obterUsuario();
  if (u.papel !== 'admin') redirect('/inicio');
  return u;
}

/** Configurações (P12): administrador ou "Configurações: Sim". */
export async function exigirConfiguracoes(): Promise<UsuarioPainel> {
  const u = await obterUsuario();
  if (!temNivel(u, 'configuracoes', 'sim')) redirect('/inicio');
  return u;
}
```

Em `apps/painel/src/lib/caixa.ts`, troque `filtroPadrao`:

```ts
/** Administrador, "Todas as conversas" e quem não tem setor veem tudo de início; os demais começam pelo próprio setor. */
export function filtroPadrao(u: { papel: 'admin' | 'atendente'; setores: string[]; niveis?: { atendimento: string } }): FiltroCaixa {
  return u.papel === 'admin' || u.niveis?.atendimento === 'todas' || u.setores.length === 0 ? 'todas' : 'setor';
}
```

- [ ] **Passo 5: horário no middleware, no login e a página "Fora do horário"**

Substitua `apps/painel/src/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { situacaoDe } from '@/lib/situacao-acesso';

const PUBLICAS = ['/entrar', '/auth/confirm', '/definir-senha', '/esqueci-senha'];

export async function middleware(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) req.cookies.set(name, value);
        resposta = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
      },
    },
  });
  // Redirecionar levando os cookies que o getUser possa ter renovado.
  const redirecionar = (caminho: string) => {
    const r = NextResponse.redirect(new URL(caminho, req.url));
    for (const c of resposta.cookies.getAll()) r.cookies.set(c);
    return r;
  };
  const { data } = await sb.auth.getUser();
  const caminho = req.nextUrl.pathname;
  const publica = PUBLICAS.some((p) => caminho.startsWith(p));
  if (!data.user && !publica) return NextResponse.redirect(new URL('/entrar', req.url));
  if (data.user && !publica) {
    // Horário de acesso (spec 7.2): o banco já recusa; aqui a pessoa vê o porquê. Erro na consulta não tranca ninguém.
    const { data: s, error } = await sb.rpc('situacao_acesso');
    if (error) console.error('[middleware] situação de acesso', error.message);
    const situacao = error ? null : situacaoDe(s);
    const naPagina = caminho.startsWith('/fora-do-horario');
    if (situacao === 'fora_do_horario' && !naPagina) return redirecionar('/fora-do-horario');
    if (situacao === 'liberado' && naPagina) return redirecionar('/inicio');
  }
  return resposta;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
```

Substitua a função `entrar` em `apps/painel/src/app/entrar/acoes.ts` (a `sair` continua igual) e acrescente o import `import { situacaoDe } from '@/lib/horario-acesso';`:

```ts
export async function entrar(formData: FormData) {
  const sb = await supabaseServidor();
  const { data, error } = await sb.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('senha') ?? ''),
  });
  if (error) redirect('/entrar?erro=credenciais');
  // Arquivada, sem cadastro ou fora do horário não entra; a mesma função do middleware decide (e marca o último acesso).
  const { data: s } = await sb.rpc('situacao_acesso');
  const situacao = situacaoDe(s);
  if (situacao !== 'liberado') {
    await sb.auth.signOut();
    redirect(situacao === 'fora_do_horario' ? '/entrar?erro=fora_do_horario' : '/entrar?erro=inativo');
  }
  // O tamanho da letra segue a pessoa, mesmo noutro computador.
  const { data: perfil } = await sb.from('usuarios').select('tamanho_letra').eq('id', data.user.id).maybeSingle();
  (await cookies()).set(COOKIE_LETRA, tamanhoDoValor(perfil?.tamanho_letra), OPCOES_COOKIE_LETRA);
  redirect('/inicio');
}
```

Em `apps/painel/src/app/entrar/page.tsx`, no objeto de mensagens (linhas 11 a 14), acrescente:

```ts
  fora_do_horario: 'Fora do seu horário de acesso. Fale com o administrador se precisar entrar agora.',
```

Crie `apps/painel/src/app/fora-do-horario/page.tsx`:

```tsx
import { Clock } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { descreverHorario, lerHorarioDoBanco, situacaoDe } from '@/lib/horario-acesso';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { sair } from '../entrar/acoes';

export const metadata = { title: 'Fora do horário' };

/** Spec 7.2: fora do horário a sessão mostra o porquê e o horário da pessoa. Liberado de novo, volta ao painel. */
export default async function ForaDoHorario() {
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar');
  const { data: s } = await sb.rpc('situacao_acesso');
  const situacao = situacaoDe(s);
  if (situacao === 'liberado') redirect('/inicio');
  if (situacao !== 'fora_do_horario') redirect('/entrar?erro=inativo');
  const horario = lerHorarioDoBanco((s as { horario?: unknown }).horario ?? null);
  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4">
      <section aria-labelledby="fora-titulo" className="flex max-w-md flex-col gap-4 rounded-lg border border-border bg-surface p-6">
        <Clock aria-hidden size={24} strokeWidth={1.75} className="text-brand" />
        <h1 id="fora-titulo" className="text-xl font-semibold text-foreground">Fora do seu horário de acesso</h1>
        <p className="text-muted">Seu horário: {descreverHorario(horario)}.</p>
        <p className="text-muted">O painel abre de novo quando o seu horário começar. Precisa entrar agora? Fale com o administrador.</p>
        <form action={sair}>
          <Button type="submit" variant="outline">Sair</Button>
        </form>
      </section>
    </main>
  );
}
```

- [ ] **Passo 6: trocar `temPermissao` e `u.permissoes` em todo o painel**

Antes de mexer, rode `grep -rn "temPermissao\|\.permissoes" apps/painel/src` e confira que a lista é esta (as linhas de `usuarios/` são das pessoas da tabela, não de quem está logado, e mudam nas Tasks 11 e 12):

| Arquivo | Antes | Depois |
|---|---|---|
| `app/(painel)/assistente/acoes.ts:15` | `!u.permissoes.includes('assistente_site')` | `!usaAssistente(u)` |
| `app/(painel)/assistente/page.tsx:68` | `!u.permissoes.includes('assistente_site')` | `!usaAssistente(u)` |
| `app/(painel)/assistente/page.tsx:133` | `temPermissao(u, 'emitir_notas')` | `temNivel(u, 'notas', 'corrigir')` |
| `app/(painel)/atendimento/acoes.ts:76` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/atendimento/[id]/conversa-aberta.tsx:82` | `u.permissoes.includes('assistente_site')` | `usaAssistente(u)` |
| `app/(painel)/atendimento/[id]/conversa-aberta.tsx:83` | `temPermissao(u, 'emitir_notas')` | `temNivel(u, 'notas', 'corrigir')` |
| `app/(painel)/atendimento/[id]/conversa-aberta.tsx:84` | `temPermissao(u, 'treinar_agente')` | `temNivel(u, 'treinar', 'sim')` |
| `app/(painel)/atendimento/[id]/conversa-aberta.tsx:152` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/atendimento/[id]/page.tsx:36` | `u.permissoes.includes('assistente_site') ? u.id : undefined` | `usaAssistente(u) ? u.id : undefined` |
| `app/(painel)/clientes/(lista)/page.tsx:30` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/clientes/acoes.ts:14` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/clientes/cadastros-acoes.ts:10` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/clientes/cadastros-acoes.ts:58` | `temPermissao(u, 'editar_precos')` | `temNivel(u, 'precos', 'mudar')` |
| `app/(painel)/clientes/novo/page.tsx:15` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/clientes/[id]/page.tsx:30` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/clientes/[id]/page.tsx:60` | `temPermissao(u, 'editar_precos')` | `temNivel(u, 'precos', 'mudar')` |
| `app/(painel)/contatos/acoes.ts:13` e `:30` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/contatos/page.tsx:40` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |
| `app/(painel)/demandas/page.tsx:45` | `temPermissao(u, 'emitir_notas')` | `temNivel(u, 'notas', 'corrigir')` |
| `app/(painel)/treinar-agente/acoes.ts:40` | `temPermissao(u, 'treinar_agente')` | `temNivel(u, 'treinar', 'sim')` |
| `app/(painel)/treinar-agente/page.tsx:110` | `temPermissao(u, 'treinar_agente')` | `temNivel(u, 'treinar', 'sim')` |
| `app/api/csv-bling/route.ts:30` | `temPermissao(u, 'emitir_notas')` | `temNivel(u, 'notas', 'corrigir')` |
| `lib/arquivo-acoes.ts:19` | `temPermissao(u, 'editar_clientes') ? null : 'Sem permissão para arquivar cadastros.'` | `temNivel(u, 'clientes', 'arquivar') ? null : 'Sem permissão para arquivar cadastros.'` |
| `lib/contato-arquivado-acoes.ts:19` | `temPermissao(u, 'editar_clientes')` | `temNivel(u, 'clientes', 'editar')` |

Em cada arquivo, tire `temPermissao` do import de `@/lib/sessao` e importe `temNivel` (e `usaAssistente`, onde usado) de `@/lib/permissoes`. O comentário de `treinar-agente/page.tsx:104` ("quem tem treinar_agente") vira "quem tem Treinar o agente".

Testes que simulam a sessão (o `u` agora tem `niveis`):
- `app/(painel)/contatos/acoes.test.ts:8`:

  ```ts
  vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { clientes: falso.pode ? 'editar' : 'ver' } }) }));
  ```

- `lib/contato-arquivado-acoes.test.ts:12`: a mesma troca.
- `app/(painel)/treinar-agente/acoes.test.ts`: tire `temPermissao` do mock (linha 20); nos objetos `falso.usuario`, `permissoes: ['treinar_agente']` vira `niveis: { treinar: 'sim' }` e `permissoes: []` vira `niveis: { treinar: 'nao' }` (linhas 5, 37, 59, 65, 121, 156); o tipo `permissoes` da linha 5 vira `niveis: { treinar: 'sim' | 'nao' }`.
- `lib/arquivo-acoes.test.ts`: tire `temPermissao` do mock (linha 18); `permissoes: ['editar_clientes']` vira `niveis: { clientes: 'arquivar' }` e `permissoes: []` vira `niveis: { clientes: 'ver' }` (linhas 6, 24, 27, 46).

Depois: `grep -rn "temPermissao" apps/painel/src` sem resultado, e `grep -rn "\.permissoes" apps/painel/src` só em `app/(painel)/usuarios/`.

- [ ] **Passo 7: o e2e do horário**

Crie `apps/painel/e2e/horario-acesso.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte D (spec 7.2): horário de acesso no login, na aba aberta e para o administrador.
const SENHA = 'senha-forte-123';
const BLOQUEADO = { semana: null, sabado: null, domingo: null };

test('fora do horário o login recusa e diz por quê', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-horario@e2e.local', senha: SENHA, nome: 'Ana Horário', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO }).eq('id', ana);
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('ana-horario@e2e.local');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/entrar?erro=fora_do_horario');
  await expect(page.getByText('Fora do seu horário de acesso. Fale com o administrador se precisar entrar agora.')).toBeVisible();
});

test('aba aberta quando o horário acaba: a próxima tela explica, e volta quando libera', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-horario@e2e.local', senha: SENHA, nome: 'Ana Horário', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-horario@e2e.local', SENHA);
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO }).eq('id', ana);
  await page.goto('/demandas');
  await page.waitForURL('**/fora-do-horario');
  await expect(page.getByRole('heading', { name: 'Fora do seu horário de acesso' })).toBeVisible();
  await expect(page.getByText('Seu horário: seg a sex bloqueado · sábado bloqueado · domingo bloqueado.')).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await db.from('usuarios').update({ horario_acesso: null }).eq('id', ana);
  await page.goto('/fora-do-horario');
  await page.waitForURL('**/inicio');
});

test('administrador entra a qualquer hora e o último acesso é marcado', async ({ page }) => {
  const admin = await criarUsuarioTeste({ email: 'admin-horario@e2e.local', senha: SENHA, nome: 'Admin Horário', papel: 'admin' });
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO, ultimo_acesso_em: null }).eq('id', admin);
  await entrar(page, 'admin-horario@e2e.local', SENHA);
  await expect(page).toHaveURL(/\/inicio/);
  await expect.poll(async () => (await db.from('usuarios').select('ultimo_acesso_em').eq('id', admin).single()).data!.ultimo_acesso_em).not.toBeNull();
});
```

- [ ] **Passo 8: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
supabase db reset
pnpm --filter @escritorio/painel e2e -- horario-acesso login menu treinar-agente assistente
```

Expected: vitest e typecheck verdes; os 3 testes novos de horário e os specs antigos de login, menu, treinar e assistente passam (as pessoas desses testes vêm do array antigo, convertido pelos gatilhos).

- [ ] **Passo 9: commit**

```bash
git add apps/painel/src apps/painel/e2e/horario-acesso.spec.ts
git commit -m "feat(painel): sessão e menu pelos níveis, horário no middleware e no login

temPermissao sai: temNivel (admin passa) e usaAssistente (por marcação, como
antes). Fora do horário o login recusa e a aba aberta vai para Fora do seu
horário de acesso; liberado de novo, volta ao painel.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Painel. Ler a ficha, salvar, convidar e reenviar convite

**Files:**
- Modify (reescrever): `apps/painel/src/app/(painel)/usuarios/esquemas.ts`, `esquemas.test.ts`, `acoes.ts`, `acoes.test.ts`

**Interfaces:**
- Consumes: `MODULOS`, `NIVEIS`, `normalizarTelefone`, `variantesTelefone` (`@escritorio/core`); `lerHorarioAcesso`, `HorarioAcesso` (Task 9); `mensagemDoBanco`; rpc `salvar_usuario` (Task 5).
- Produces (a Task 11 usa):

  ```ts
  export type CampoUsuario = 'nome' | 'email' | 'cargo' | 'telefone' | 'papel' | 'setores' | 'niveis' | 'horario' | 'observacoes' | 'geral';
  export type ErrosUsuario = Partial<Record<CampoUsuario, string>>;
  export type EstadoUsuario = { ok: true; id: string } | { ok: false; erros: ErrosUsuario; telefoneDeArquivado?: { id: string; nome: string } };
  export type DadosFicha = { nome: string; email: string; cargo: string | null; papel: 'admin' | 'atendente'; telefone: string | null;
    setores: string[]; niveis: Partial<Niveis>; observacoes: string | null; horario: HorarioAcesso | null | undefined };
  export function lerFicha(f: FormData): { ok: true; dados: DadosFicha } | { ok: false; erros: ErrosUsuario };
  export function paraBanco(d: DadosFicha): Record<string, unknown>;
  export function errosDoBanco(mensagem: string): ErrosUsuario;
  // acoes.ts ('use server')
  export async function convidarUsuario(formData: FormData): Promise<EstadoUsuario>;
  export async function salvarUsuario(id: string, formData: FormData): Promise<EstadoUsuario>;
  export type ResultadoConvite = { ok: true; mensagem: string } | { ok: false; erro: string };
  export async function reenviarConvite(id: string): Promise<ResultadoConvite>;
  ```

  Nomes dos campos do formulário (a Task 11 usa os mesmos): `nome`, `email`, `cargo`, `papel` (`admin`|`atendente`), `telefone`, `setor` (vários), `nivel_<modulo>`, `horario_restrito` (`sim`|`nao`), `horario_<dia>` (`permitido`|`bloqueado`), `horario_<dia>_de`, `horario_<dia>_ate`, `observacoes`.

- [ ] **Passo 1: os testes**

Substitua `apps/painel/src/app/(painel)/usuarios/esquemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { errosDoBanco, lerFicha, paraBanco } from './esquemas';

const SETOR = '11111111-1111-4111-8111-111111111111';
function form(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
const BASE = { nome: 'Ana Paula Souza', email: 'Ana@Escritorio.com.br ', cargo: 'Analista', papel: 'atendente', telefone: '(11) 98888-1234',
  setor: [SETOR], observacoes: 'Férias de 10 a 24/11', horario_restrito: 'sim', horario_semana: 'permitido', horario_semana_de: '08:00',
  horario_semana_ate: '18:00', horario_sabado: 'bloqueado', horario_domingo: 'bloqueado' };

describe('lerFicha (Parte D)', () => {
  it('lê a ficha inteira, com níveis e horário', () => {
    const r = lerFicha(form({ ...BASE, nivel_demandas: 'meu_setor', nivel_clientes: 'editar', nivel_assistente: 'site_whatsapp' }));
    expect(r).toEqual({ ok: true, dados: {
      nome: 'Ana Paula Souza', email: 'ana@escritorio.com.br', cargo: 'Analista', papel: 'atendente', telefone: '5511988881234',
      setores: [SETOR], observacoes: 'Férias de 10 a 24/11', niveis: { demandas: 'meu_setor', clientes: 'editar', assistente: 'site_whatsapp' },
      horario: { semana: { de: '08:00', ate: '18:00' }, sabado: null, domingo: null },
    } });
  });

  it('administrador: níveis escondidos e horário ficam de fora (não são apagados)', () => {
    const r = lerFicha(form({ nome: 'Dono', email: 'dono@escritorio.com.br', papel: 'admin', nivel_assistente: 'site' }));
    expect(r.ok && r.dados.niveis).toEqual({ assistente: 'site' });
    expect(r.ok && r.dados.horario).toBeUndefined();
    expect(r.ok && paraBanco(r.dados)).not.toHaveProperty('horario_acesso');
  });

  it('sem restrição de horário vai como null', () => {
    const r = lerFicha(form({ ...BASE, horario_restrito: 'nao' }));
    expect(r.ok && paraBanco(r.dados).horario_acesso).toBeNull();
  });

  it('erros por campo, todos de uma vez, sem perder nada', () => {
    expect(lerFicha(form({ ...BASE, nome: 'A', telefone: '123', horario_semana_de: '18:00', horario_semana_ate: '08:00' }))).toEqual({
      ok: false, erros: { nome: 'Informe o nome', telefone: 'Telefone inválido', horario: 'Seg a sex: o fim precisa ser depois do início.' },
    });
    expect(lerFicha(form({ ...BASE, telefone: '', nivel_assistente: 'site_whatsapp' })))
      .toEqual({ ok: false, erros: { telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' } });
    expect(lerFicha(form({ ...BASE, nivel_demandas: 'tudo' }))).toEqual({ ok: false, erros: { niveis: 'Nível desconhecido.' } });
  });

  it('mensagem do banco vai para o campo certo', () => {
    expect(errosDoBanco('Você não pode tirar o seu próprio acesso de administrador.')).toEqual({ papel: 'Você não pode tirar o seu próprio acesso de administrador.' });
    expect(errosDoBanco('Informe o telefone para usar o assistente pelo WhatsApp.')).toEqual({ telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' });
    expect(errosDoBanco('A user with this email address has already been registered')).toEqual({ email: 'Já existe uma pessoa com este e-mail.' });
    expect(errosDoBanco('Horário de acesso inválido.')).toEqual({ horario: 'Horário de acesso inválido.' });
  });
});
```

Substitua `apps/painel/src/app/(painel)/usuarios/acoes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A ficha devolve o resultado para a tela (erro no campo, nada se perde) e grava tudo numa função do banco.
const falso = vi.hoisted(() => ({
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  erroRpc: null as { message: string } | null,
  donos: [] as { id: string; nome: string; ativo: boolean }[],
  apagados: [] as string[],
  convites: [] as string[],
  links: [] as string[],
  jaEntrou: false,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => { falso.rpcs.push({ nome, args }); return { error: falso.erroRpc }; },
  }),
}));
vi.mock('@/lib/supabase/servico', () => ({
  supabaseServico: () => ({
    from: () => ({ select: () => ({ in: async () => ({ data: falso.donos }) }) }),
    auth: {
      admin: {
        inviteUserByEmail: async (email: string) => { falso.convites.push(email); return { data: { user: { id: 'nova' } }, error: null }; },
        deleteUser: async (id: string) => { falso.apagados.push(id); return { error: null }; },
        getUserById: async () => ({ data: { user: { email: 'bia@escritorio.com', last_sign_in_at: falso.jaEntrou ? '2026-10-01T10:00:00Z' : null } }, error: null }),
      },
      resetPasswordForEmail: async (email: string) => { falso.links.push(email); return { error: null }; },
    },
  }),
}));

import { convidarUsuario, reenviarConvite, salvarUsuario } from './acoes';

const BIA = '11111111-1111-4111-8111-111111111111';
function form(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ nome: 'Bia Souza', email: 'bia@escritorio.com', papel: 'atendente', horario_restrito: 'nao', ...campos })) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

beforeEach(() => {
  Object.assign(falso, { rpcs: [], erroRpc: null, donos: [], apagados: [], convites: [], links: [], jaEntrou: false });
});

describe('salvarUsuario', () => {
  it('grava pela função do banco e devolve o id', async () => {
    expect(await salvarUsuario(BIA, form({ nivel_demandas: 'minhas' }))).toEqual({ ok: true, id: BIA });
    expect(falso.rpcs).toEqual([{ nome: 'salvar_usuario', args: { p_id: BIA, p_dados: expect.objectContaining({
      nome: 'Bia Souza', papel: 'atendente', niveis: { demandas: 'minhas' }, horario_acesso: null }) } }]);
  });
  it('telefone inválido: erro no campo e nada gravado', async () => {
    expect(await salvarUsuario(BIA, form({ telefone: '12345' }))).toEqual({ ok: false, erros: { telefone: 'Telefone inválido' } });
    expect(falso.rpcs).toEqual([]);
  });
  it('telefone de outra pessoa ou de arquivada: como na Parte B', async () => {
    falso.donos = [{ id: 'outra', nome: 'Zé', ativo: true }];
    expect(await salvarUsuario(BIA, form({ telefone: '(31) 99999-1801' }))).toEqual({ ok: false, erros: { telefone: 'Este telefone já é de Zé.' } });
    falso.donos = [{ id: 'ze', nome: 'Zé', ativo: false }];
    expect(await salvarUsuario(BIA, form({ telefone: '(31) 99999-1801' }))).toEqual({
      ok: false, erros: { telefone: 'Este telefone é de Zé, que está nos arquivados. Restaure Zé ou use outro telefone.' },
      telefoneDeArquivado: { id: 'ze', nome: 'Zé' },
    });
  });
  it('recusa do banco vai para o campo', async () => {
    falso.erroRpc = { message: 'Você não pode tirar o seu próprio acesso de administrador.' };
    expect(await salvarUsuario(BIA, form({}))).toEqual({ ok: false, erros: { papel: 'Você não pode tirar o seu próprio acesso de administrador.' } });
  });
});

describe('convidarUsuario', () => {
  it('convida e grava a ficha', async () => {
    expect(await convidarUsuario(form({}))).toEqual({ ok: true, id: 'nova' });
    expect(falso.convites).toEqual(['bia@escritorio.com']);
    expect(falso.rpcs[0]!.args.p_id).toBe('nova');
  });
  it('ficha recusada: apaga o login do convite (senão o e-mail ficaria preso)', async () => {
    falso.erroRpc = { message: 'Setor não encontrado.' };
    expect(await convidarUsuario(form({}))).toEqual({ ok: false, erros: { geral: 'Setor não encontrado.' } });
    expect(falso.apagados).toEqual(['nova']);
  });
});

describe('reenviarConvite', () => {
  it('quem nunca entrou recebe o convite de novo', async () => {
    expect(await reenviarConvite(BIA)).toEqual({ ok: true, mensagem: 'Convite reenviado para bia@escritorio.com.' });
    expect(falso.convites).toEqual(['bia@escritorio.com']);
  });
  it('quem já entrou recebe o link para criar a senha', async () => {
    falso.jaEntrou = true;
    expect(await reenviarConvite(BIA)).toEqual({ ok: true, mensagem: 'Enviamos para bia@escritorio.com um link para criar a senha.' });
    expect(falso.links).toEqual(['bia@escritorio.com']);
  });
});
```

- [ ] **Passo 2: ver falhar**

Run: `pnpm --filter @escritorio/painel test -- usuarios`
Expected: FAIL (`lerFicha`, `paraBanco`, `errosDoBanco` e `reenviarConvite` não existem).

- [ ] **Passo 3: esquemas**

Substitua `apps/painel/src/app/(painel)/usuarios/esquemas.ts`:

```ts
import { MODULOS, NIVEIS, normalizarTelefone, type Modulo, type Niveis } from '@escritorio/core';
import { z } from 'zod';
import { lerHorarioAcesso, type HorarioAcesso } from '@/lib/horario-acesso';
import { mensagemDoBanco } from '@/lib/mensagem-banco';

/** Erro de cada campo da ficha. Erro ao salvar mantém tudo o que foi digitado (spec 7.1). */
export type CampoUsuario = 'nome' | 'email' | 'cargo' | 'telefone' | 'papel' | 'setores' | 'niveis' | 'horario' | 'observacoes' | 'geral';
export type ErrosUsuario = Partial<Record<CampoUsuario, string>>;
export type EstadoUsuario =
  | { ok: true; id: string }
  | { ok: false; erros: ErrosUsuario; telefoneDeArquivado?: { id: string; nome: string } };

export type DadosFicha = {
  nome: string; email: string; cargo: string | null; papel: 'admin' | 'atendente'; telefone: string | null;
  setores: string[]; niveis: Partial<Niveis>; observacoes: string | null;
  /** undefined = não mexe (administrador: o bloco fica escondido); null = sem restrição. */
  horario: HorarioAcesso | null | undefined;
};

/** Vazio = sem telefone; preenchido tem de ser um telefone com DDD (senão o WhatsApp do assistente não reconheceria a pessoa). */
const telefoneOpcional = z.preprocess((v) => (v && String(v).trim() ? String(v) : null), z.string().nullable())
  .transform((v, ctx) => {
    if (v === null) return null;
    const t = normalizarTelefone(v);
    if (!t) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Telefone inválido' });
    return t;
  });

const Base = z.object({
  nome: z.string().trim().min(2, 'Informe o nome'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  cargo: z.string().trim().max(60, 'Até 60 caracteres').transform((v) => v || null),
  papel: z.enum(['admin', 'atendente'], { message: 'Escolha se é administrador' }),
  telefone: telefoneOpcional,
  setores: z.array(z.string().uuid('Setor desconhecido')),
  observacoes: z.string().trim().max(1000, 'Até 1000 caracteres').transform((v) => v || null),
});

const CAMPOS = new Set<string>(['nome', 'email', 'cargo', 'telefone', 'papel', 'setores', 'observacoes']);

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

/** Lê a ficha. Níveis que não vieram (escondidos para o administrador) ficam de fora: o banco não os apaga. */
export function lerFicha(f: FormData): { ok: true; dados: DadosFicha } | { ok: false; erros: ErrosUsuario } {
  const base = Base.safeParse({
    nome: f.get('nome') ?? '', email: f.get('email') ?? '', cargo: f.get('cargo') ?? '', papel: f.get('papel'),
    telefone: f.get('telefone') || null, setores: f.getAll('setor'), observacoes: f.get('observacoes') ?? '',
  });
  const erros: ErrosUsuario = base.success ? {} : errosDoFormulario(base.error.issues);
  const niveis: Partial<Record<Modulo, string>> = {};
  for (const m of MODULOS) {
    const v = f.get(`nivel_${m}`);
    if (v === null) continue;
    if ((NIVEIS[m] as readonly string[]).includes(String(v))) niveis[m] = String(v);
    else erros.niveis = 'Nível desconhecido.';
  }
  let horario: HorarioAcesso | null | undefined;
  if (f.get('papel') !== 'admin') {
    const h = lerHorarioAcesso(f);
    if (h.ok) horario = h.valor;
    else erros.horario = h.erro;
  }
  if (niveis.assistente === 'site_whatsapp' && base.success && base.data.telefone === null) {
    erros.telefone = 'Informe o telefone para usar o assistente pelo WhatsApp';
  }
  if (!base.success || Object.keys(erros).length > 0) return { ok: false, erros };
  return { ok: true, dados: { ...base.data, niveis: niveis as Partial<Niveis>, horario } };
}

/** O que salvar_usuario recebe (sem horario_acesso quando o bloco estava escondido). */
export function paraBanco(d: DadosFicha): Record<string, unknown> {
  return {
    nome: d.nome, email: d.email, papel: d.papel, cargo: d.cargo, telefone: d.telefone, setores: d.setores,
    niveis: d.niveis, observacoes: d.observacoes,
    ...(d.horario === undefined ? {} : { horario_acesso: d.horario }),
  };
}

/** Recusa do banco (ou do convite) no campo certo; o resto vai para o aviso geral da ficha. */
export function errosDoBanco(mensagem: string): ErrosUsuario {
  if (mensagem.includes('telefone para usar o assistente')) return { telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' };
  if (mensagem.includes('próprio acesso de administrador')) return { papel: 'Você não pode tirar o seu próprio acesso de administrador.' };
  if (mensagem.includes('Horário de acesso inválido')) return { horario: 'Horário de acesso inválido.' };
  if (mensagem.includes('already been registered') || mensagem.includes('usuarios_email_key')) return { email: 'Já existe uma pessoa com este e-mail.' };
  if (mensagem.includes('Informe o nome')) return { nome: 'Informe o nome' };
  return { geral: mensagemDoBanco(mensagem) };
}
```

- [ ] **Passo 4: ações**

Substitua `apps/painel/src/app/(painel)/usuarios/acoes.ts`:

```ts
'use server';
import { variantesTelefone } from '@escritorio/core';
import { revalidatePath } from 'next/cache';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { errosDoBanco, lerFicha, paraBanco, type EstadoUsuario } from './esquemas';

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

/** Nova pessoa: convite por e-mail e a ficha gravada pela sessão do administrador (a auditoria registra quem cadastrou). */
export async function convidarUsuario(formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const lido = lerFicha(formData);
  if (!lido.ok) return { ok: false, erros: lido.erros };
  const conflito = await conflitoDeTelefone(lido.dados.telefone, null);
  if (conflito) return conflito;
  const servico = supabaseServico();
  const { data, error } = await servico.auth.admin.inviteUserByEmail(lido.dados.email, { redirectTo: `${process.env.PAINEL_URL}/auth/confirm` });
  if (error) return { ok: false, erros: errosDoBanco(error.message) };
  const { error: erroFicha } = await (await supabaseServidor()).rpc('salvar_usuario', { p_id: data.user.id, p_dados: paraBanco(lido.dados) as never });
  if (erroFicha) {
    // Sem a ficha, o login do convite não serve e prenderia o e-mail num convite novo.
    await servico.auth.admin.deleteUser(data.user.id);
    return { ok: false, erros: errosDoBanco(erroFicha.message) };
  }
  revalidatePath('/usuarios');
  return { ok: true, id: data.user.id };
}

export async function salvarUsuario(id: string, formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const lido = lerFicha(formData);
  if (!lido.ok) return { ok: false, erros: lido.erros };
  const conflito = await conflitoDeTelefone(lido.dados.telefone, id);
  if (conflito) return conflito;
  // Sessão do administrador: a auditoria registra quem mudou.
  const { error } = await (await supabaseServidor()).rpc('salvar_usuario', { p_id: id, p_dados: paraBanco(lido.dados) as never });
  if (error) return { ok: false, erros: errosDoBanco(error.message) };
  revalidatePath('/usuarios');
  revalidatePath(`/usuarios/${id}`);
  return { ok: true, id };
}

export type ResultadoConvite = { ok: true; mensagem: string } | { ok: false; erro: string };

/** "reenviar convite": quem nunca entrou recebe o convite de novo; quem já entrou, um link para criar a senha. */
export async function reenviarConvite(id: string): Promise<ResultadoConvite> {
  await exigirAdmin();
  const servico = supabaseServico();
  const { data, error } = await servico.auth.admin.getUserById(id);
  const email = data?.user?.email;
  if (error || !email) return { ok: false, erro: 'Não encontrei o acesso desta pessoa.' };
  const destino = `${process.env.PAINEL_URL}/auth/confirm`;
  if (!data.user.last_sign_in_at) {
    const convite = await servico.auth.admin.inviteUserByEmail(email, { redirectTo: destino });
    if (!convite.error) return { ok: true, mensagem: `Convite reenviado para ${email}.` };
  }
  const { error: erroLink } = await servico.auth.resetPasswordForEmail(email, { redirectTo: destino });
  if (erroLink) return { ok: false, erro: 'Não consegui enviar o e-mail agora. Tente de novo em alguns minutos.' };
  return { ok: true, mensagem: `Enviamos para ${email} um link para criar a senha.` };
}
```

- [ ] **Passo 5: ver passar**

```bash
pnpm --filter @escritorio/painel test -- usuarios
pnpm --filter @escritorio/painel typecheck
```

Expected: os testes de `esquemas` e `acoes` passam. O `typecheck` acusa `formulario-usuario.tsx`, `convite-usuario.tsx` e `page.tsx` de `usuarios/` (usam `PERMISSOES` e o `EstadoUsuario` antigo): é esperado, as Tasks 11 e 12 os trocam. **Não faça commit desta task sozinha:** junte-a ao commit da Task 11 (o painel não compila no meio), e diga isso na mensagem.

---

### Task 11: Painel. Ficha da pessoa em página inteira

**Files:**
- Create: `apps/painel/src/app/(painel)/usuarios/ficha-usuario.tsx`, `reenviar-convite.tsx`, `aviso-contato.tsx`
- Create: `apps/painel/src/app/(painel)/usuarios/novo/page.tsx`, `[id]/page.tsx`, `[id]/loading.tsx`
- Create: `apps/painel/src/lib/usuarios.ts`, `apps/painel/src/lib/usuarios.test.ts`
- Modify: `apps/painel/src/components/layout/trilha.ts`, `trilha.test.ts`
- Create: `apps/painel/e2e/usuarios-ficha.spec.ts`
- Modify: `apps/painel/e2e/aquecer.ts` (rota `/usuarios/novo`)

**Interfaces:**
- Consumes: Task 10 (`EstadoUsuario`, `convidarUsuario`, `salvarUsuario`, `reenviarConvite`, nomes dos campos); Task 9 (`ROTULO_MODULO`, `AJUDA_MODULO`, `rotuloNivel`, `DIAS_HORARIO`, `HORARIO_PADRAO`, `lerHorarioDoBanco`); `NIVEIS`, `NIVEIS_PADRAO`, `lerNiveis`; `FormField`, `FormularioAlteravel`, `IndicadorAlteracoes`, `BotaoSalvar`, `inicialRadix`, `BotaoRestaurar`, `ExcluirCadastro`, `AvisoArquivado`, `PageHeader`.
- Produces: `FichaUsuario` (props abaixo), `textoUltimoAcesso(iso, agora)`, `dataCadastro(iso)`, `sugestoesDeCargo(usados)`, `CARGOS_SUGERIDOS`; rotas `/usuarios/novo` e `/usuarios/[id]`.

- [ ] **Passo 1: os testes das regras puras e da trilha**

Crie `apps/painel/src/lib/usuarios.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dataCadastro, sugestoesDeCargo, textoUltimoAcesso } from './usuarios';

const agora = new Date('2026-10-05T15:00:00-03:00');

describe('ficha da pessoa (Parte D)', () => {
  it('último acesso: hoje, ontem, data, nunca', () => {
    expect(textoUltimoAcesso('2026-10-05T08:12:00-03:00', agora)).toBe('hoje 08:12');
    expect(textoUltimoAcesso('2026-10-04T17:40:00-03:00', agora)).toBe('ontem 17:40');
    expect(textoUltimoAcesso('2026-08-12T09:05:00-03:00', agora)).toBe('12/08/2026 09:05');
    expect(textoUltimoAcesso(null, agora)).toBe('nunca entrou');
  });
  it('data de cadastro no fuso de Brasília', () => {
    expect(dataCadastro('2026-08-13T01:00:00Z')).toBe('12/08/2026');
  });
  it('cargos: os quatro de sempre e os já usados, sem repetir', () => {
    expect(sugestoesDeCargo(['Analista', 'Contadora', null, ' ', 'Contadora']))
      .toEqual(['Auxiliar', 'Analista', 'Coordenador', 'Sócio', 'Contadora']);
  });
});
```

Em `apps/painel/src/components/layout/trilha.test.ts`, acrescente:

```ts
  it('ficha da pessoa: Configurações › Usuários e permissões › Pessoa (o nome vem no título da página)', () => {
    expect(trilhaDaRota('/usuarios/novo')).toEqual([
      { rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Nova pessoa' },
    ]);
    expect(trilhaDaRota('/usuarios/11111111-1111-4111-8111-111111111111')).toEqual([
      { rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Pessoa' },
    ]);
  });
```

(Confira o nome da função e o `import` no topo do arquivo de teste; o arquivo de produção exporta `trilhaDaRota`.)

- [ ] **Passo 2: ver falhar**

Run: `pnpm --filter @escritorio/painel test -- lib/usuarios trilha`
Expected: FAIL (módulo `./usuarios` inexistente; trilha sem "Nova pessoa" e "Pessoa").

- [ ] **Passo 3: regras puras e trilha**

Crie `apps/painel/src/lib/usuarios.ts`:

```ts
import { FUSO_HORARIO } from '@escritorio/core';

const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit', year: 'numeric' });

/** "hoje 08:12", "ontem 17:40", "12/08/2026 09:05" ou "nunca entrou" (topo da ficha e coluna da lista). */
export function textoUltimoAcesso(iso: string | null, agora: Date): string {
  if (!iso) return 'nunca entrou';
  const d = new Date(iso);
  if (dia.format(d) === dia.format(agora)) return `hoje ${hora.format(d)}`;
  if (dia.format(d) === dia.format(new Date(agora.getTime() - 86_400_000))) return `ontem ${hora.format(d)}`;
  return `${dia.format(d)} ${hora.format(d)}`;
}

export function dataCadastro(iso: string): string {
  return dia.format(new Date(iso));
}

/** Cargo é informativo (spec 7.1); a lista "editável" são estas sugestões mais os cargos já usados (P13). */
export const CARGOS_SUGERIDOS = ['Auxiliar', 'Analista', 'Coordenador', 'Sócio'];

export function sugestoesDeCargo(usados: (string | null)[]): string[] {
  const outros = usados.map((c) => c?.trim() ?? '').filter((c) => c !== '');
  return [...new Set([...CARGOS_SUGERIDOS, ...outros])];
}
```

Em `apps/painel/src/components/layout/trilha.ts`, troque a linha de `/usuarios` por estas duas:

```ts
  { prefixo: '/usuarios', trilha: [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões' }], detalhe: 'Pessoa' },
  // Rota fixa mais longa que /usuarios/[id]: sem esta linha, /usuarios/novo viraria "Pessoa".
  { prefixo: '/usuarios/novo', trilha: [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Nova pessoa' }] },
```

- [ ] **Passo 4: a ficha**

Crie `apps/painel/src/app/(painel)/usuarios/aviso-contato.tsx`:

```tsx
import { TriangleAlert } from 'lucide-react';

/** O número também é de um contato (cliente): com o assistente pelo WhatsApp, as mensagens dele vão para o assistente. */
export function AvisoContato({ contato }: { contato: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning">
      <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>Este número também é do contato {contato}. Com o assistente pelo WhatsApp ligado, as mensagens dele vão para o assistente, não para o agente de clientes.</span>
    </p>
  );
}
```

Crie `apps/painel/src/app/(painel)/usuarios/reenviar-convite.tsx`:

```tsx
'use client';

import { useTransition } from 'react';
import { toast } from '@/components/ui/toaster';
import { reenviarConvite } from './acoes';

/** "reenviar convite" do rodapé da ficha: manda o e-mail de novo e avisa. */
export function ReenviarConvite({ id }: { id: string }) {
  const [enviando, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={enviando}
      onClick={() => iniciar(async () => {
        const r = await reenviarConvite(id);
        if (r.ok) toast.success(r.mensagem);
        else toast.error(r.erro);
      })}
      className="text-foreground underline underline-offset-4 hover:text-brand disabled:opacity-60"
    >
      reenviar convite
    </button>
  );
}
```

Crie `apps/painel/src/app/(painel)/usuarios/ficha-usuario.tsx`:

```tsx
'use client';

import { NIVEIS, NIVEIS_PADRAO, type Modulo, type Niveis } from '@escritorio/core';
import { CircleAlert, Save, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { BotaoRestaurar } from '@/components/patterns/excluir-cadastro';
import { FormField } from '@/components/patterns/form-field';
import { BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes, inicialRadix } from '@/components/patterns/formulario-alteravel';
import { variantesBotao } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toaster';
import { cn } from '@/lib/cn';
import { DIAS_HORARIO, HORARIO_PADRAO, type DiaHorario, type HorarioAcesso } from '@/lib/horario-acesso';
import { AJUDA_MODULO, ROTULO_MODULO, rotuloNivel } from '@/lib/permissoes';
import { classeSelect } from '../clientes/estilos';
import type { EstadoUsuario } from './esquemas';

type Acao = (dados: FormData) => Promise<EstadoUsuario>;
export type SetorOpcao = { id: string; nome: string; ativo: boolean };
export type FichaDados = {
  id: string; nome: string; email: string; telefone: string | null; cargo: string | null; papel: 'admin' | 'atendente';
  setores: string[]; niveis: Niveis; horario: HorarioAcesso | null; observacoes: string | null;
};

const FALHA = 'Não consegui salvar agora. Tente de novo.';
// Ordem da imagem 06 (três por linha).
const MODULOS_DA_TELA: Modulo[] = ['atendimento', 'demandas', 'clientes', 'precos', 'notas', 'assistente', 'treinar', 'prazos', 'configuracoes'];
const titulo = 'border-b border-border pb-2 text-base font-semibold text-foreground';

function AvisoErro({ erro }: { erro: string }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
      <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>{erro}</span>
    </p>
  );
}

/**
 * Ficha da pessoa em página inteira (spec 7.1, imagem 06): 3 colunas, permissões por módulo, horário e situação.
 * "Administrador = Sim" esconde e desliga (fieldset disabled) permissões e horário: nada é enviado nem apagado, e
 * voltar para "Não" mostra o que estava escolhido. Erro ao salvar fica no campo, com tudo o que foi digitado.
 */
export function FichaUsuario({ usuario, eu, setores, cargos, acao, aviso, situacao, rodape }: {
  usuario: FichaDados | null;
  /** id de quem está logado: na própria ficha o "Administrador?" fica travado (P16). */
  eu: string;
  setores: SetorOpcao[];
  cargos: string[];
  acao: Acao;
  aviso?: ReactNode;
  situacao: ReactNode;
  rodape: ReactNode;
}) {
  const id = useId();
  const router = useRouter();
  const editando = usuario !== null;
  const propria = usuario?.id === eu;
  const niveis = usuario?.niveis ?? NIVEIS_PADRAO;
  const horarioInicial = usuario ? usuario.horario : HORARIO_PADRAO;
  const faixas = horarioInicial ?? HORARIO_PADRAO;
  const [papel, setPapel] = useState<'admin' | 'atendente'>(usuario?.papel ?? 'atendente');
  const [restrito, setRestrito] = useState(horarioInicial !== null);
  const [dias, setDias] = useState<Record<DiaHorario, boolean>>({
    semana: faixas.semana !== null, sabado: faixas.sabado !== null, domingo: faixas.domingo !== null,
  });
  const [estado, setEstado] = useState<EstadoUsuario | null>(null);
  const [enviando, iniciar] = useTransition();
  const erros = estado && !estado.ok ? estado.erros : {};
  const admin = papel === 'admin';

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela: o React não limpa os campos, então o erro aparece no campo com tudo o que foi digitado.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        setEstado(r);
        if (!r.ok) return;
        if (editando) {
          toast.success(`Salvo: ${String(dados.get('nome') ?? '').trim()}.`);
          router.refresh();
        } else {
          toast.success(`Convite enviado para ${String(dados.get('email') ?? '').trim().toLowerCase()}.`);
          router.push(`/usuarios/${r.id}`);
        }
      } catch (err) {
        unstable_rethrow(err);
        console.error('[usuarios] falha ao salvar', err);
        setEstado({ ok: false, erros: { geral: FALHA } });
      }
    });
  };

  return (
    <FormularioAlteravel onSubmit={enviar} aria-label={editando ? `Cadastro de ${usuario.nome}` : 'Nova pessoa'} className="rounded-lg border border-border bg-surface">
      <div className="flex flex-col gap-8 p-6">
        {aviso}
        {erros.geral && <AvisoErro erro={erros.geral} />}

        <div className="grid gap-4 md:grid-cols-3">
          <FormField id={`${id}-nome`} rotulo="Nome" erro={erros.nome}>
            <Input name="nome" defaultValue={usuario?.nome} required autoComplete="off" />
          </FormField>
          <FormField id={`${id}-email`} rotulo="E-mail de acesso" ajuda={editando ? 'O e-mail de acesso não muda aqui.' : undefined} erro={erros.email}>
            <Input name="email" type={editando ? 'text' : 'email'} defaultValue={usuario?.email} required readOnly={editando} autoComplete="off"
              className={cn(editando && 'bg-surface-muted text-muted')} />
          </FormField>
          <FormField id={`${id}-cargo`} rotulo="Cargo" ajuda="Informativo. Escolha ou digite outro." erro={erros.cargo}>
            <Input name="cargo" list={`${id}-cargos`} defaultValue={usuario?.cargo ?? ''} maxLength={60} autoComplete="off" />
          </FormField>
          <datalist id={`${id}-cargos`}>{cargos.map((c) => <option key={c} value={c} />)}</datalist>

          <fieldset className="flex flex-col gap-1.5" aria-describedby={erros.setores ? `${id}-setores-erro` : undefined}>
            <legend className="mb-1.5 text-sm font-medium text-foreground">Setores</legend>
            {setores.length === 0 ? (
              <p className="text-sm text-muted">Nenhum setor cadastrado. Crie em Configurações.</p>
            ) : (
              <div className="flex min-h-9 flex-wrap gap-2 rounded-md border border-input bg-surface p-1.5">
                {setores.map((s) => (
                  <Label key={s.id} htmlFor={`${id}-setor-${s.id}`}
                    className={cn(ROTULO_DE_OPCAO, 'h-7 cursor-pointer rounded-md border border-input px-2.5 text-base has-data-[state=checked]:border-brand has-data-[state=checked]:bg-brand-soft',
                      !s.ativo && 'text-muted')}>
                    <Checkbox id={`${id}-setor-${s.id}`} name="setor" value={s.id} defaultChecked={usuario?.setores.includes(s.id)} {...inicialRadix(usuario?.setores.includes(s.id))} />
                    {s.nome}{s.ativo ? '' : ' (inativo)'}
                  </Label>
                ))}
              </div>
            )}
            {erros.setores && <p id={`${id}-setores-erro`} className="text-sm text-danger">{erros.setores}</p>}
          </fieldset>
          <FormField id={`${id}-telefone`} rotulo="Telefone (WhatsApp)" ajuda="Com DDD. Necessário para o assistente pelo WhatsApp." erro={erros.telefone}>
            <Input name="telefone" defaultValue={usuario?.telefone ?? ''} inputMode="tel" autoComplete="off" />
          </FormField>
          <FormField id={`${id}-papel`} rotulo="Administrador?"
            ajuda={propria ? 'Você não pode tirar o seu próprio acesso de administrador.' : 'Sim = acesso total, esconde as permissões.'} erro={erros.papel}>
            <select name="papel" defaultValue={usuario?.papel ?? 'atendente'} disabled={propria}
              onChange={(e) => setPapel(e.target.value as 'admin' | 'atendente')} className={classeSelect}>
              <option value="atendente">Não</option>
              <option value="admin">Sim</option>
            </select>
          </FormField>
          {/* Campo travado não vai no formulário: o valor segue escondido. */}
          {propria && <input type="hidden" name="papel" value="admin" />}
          {estado && !estado.ok && estado.telefoneDeArquivado && (
            <div className="md:col-span-3">
              <BotaoRestaurar tipo="usuario" id={estado.telefoneDeArquivado.id} nome={estado.telefoneDeArquivado.nome} aoRestaurar={() => setEstado(null)} />
            </div>
          )}
        </div>

        <section aria-labelledby={`${id}-permissoes`} className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-border pb-2">
            <h2 id={`${id}-permissoes`} className="text-base font-semibold text-foreground">Permissões</h2>
            <span className="text-sm text-muted">{admin ? 'administrador: acesso total' : 'cada módulo tem níveis'}</span>
          </div>
          {erros.niveis && <p role="alert" className="text-sm text-danger">{erros.niveis}</p>}
          <div className="grid gap-4 md:grid-cols-3">
            {MODULOS_DA_TELA.map((m) => {
              const campo = (
                <FormField id={`${id}-nivel-${m}`} rotulo={ROTULO_MODULO[m]} ajuda={AJUDA_MODULO[m]}>
                  <select name={`nivel_${m}`} defaultValue={niveis[m]} className={classeSelect}>
                    {NIVEIS[m].map((n) => <option key={n} value={n}>{rotuloNivel(m, n as never)}</option>)}
                  </select>
                </FormField>
              );
              // Assistente é canal (P3): continua para o administrador.
              if (m === 'assistente') return <div key={m}>{campo}</div>;
              return <fieldset key={m} disabled={admin} className={admin ? 'hidden' : 'contents'}>{campo}</fieldset>;
            })}
          </div>
          {admin && <p className="text-sm text-muted">O administrador pode tudo no painel. O assistente continua por nível, como antes.</p>}
        </section>

        <div className="grid gap-8 md:grid-cols-5">
          <section aria-labelledby={`${id}-horario`} className="flex flex-col gap-4 md:col-span-3">
            <h2 id={`${id}-horario`} className={titulo}>Horário de acesso ao painel</h2>
            {admin && <p className="text-sm text-muted">O administrador entra a qualquer hora.</p>}
            <fieldset disabled={admin} className={cn('flex flex-col gap-4', admin && 'hidden')}>
              <FormField id={`${id}-restrito`} rotulo="Restringir o horário?" erro={erros.horario}>
                <select name="horario_restrito" defaultValue={restrito ? 'sim' : 'nao'} onChange={(e) => setRestrito(e.target.value === 'sim')} className={cn(classeSelect, 'sm:w-72')}>
                  <option value="nao">Não, entra a qualquer hora</option>
                  <option value="sim">Sim, só nos horários abaixo</option>
                </select>
              </FormField>
              <fieldset disabled={!restrito} className={cn('flex flex-col gap-3', !restrito && 'hidden')}>
                <legend className="sr-only">Dias e horários</legend>
                {DIAS_HORARIO.map(({ chave, rotulo }) => {
                  const faixa = faixas[chave] ?? { de: '08:00', ate: chave === 'sabado' ? '12:00' : '18:00' };
                  return (
                    <div key={chave} className="flex flex-wrap items-center gap-3">
                      <span id={`${id}-dia-${chave}`} className="w-24 font-medium text-foreground">{rotulo}</span>
                      <select name={`horario_${chave}`} aria-labelledby={`${id}-dia-${chave}`} defaultValue={dias[chave] ? 'permitido' : 'bloqueado'}
                        onChange={(e) => setDias((d) => ({ ...d, [chave]: e.target.value === 'permitido' }))}
                        className={cn(classeSelect, 'w-40', dias[chave] ? 'text-success' : 'text-danger')}>
                        <option value="permitido">● Permitido</option>
                        <option value="bloqueado">● Bloqueado</option>
                      </select>
                      <fieldset disabled={!dias[chave]} className={cn('flex items-center gap-2', !dias[chave] && 'hidden')}>
                        <legend className="sr-only">{rotulo}: horário</legend>
                        <Input type="time" name={`horario_${chave}_de`} defaultValue={faixa.de} aria-label={`${rotulo}: das`} className="tabular w-32" />
                        <span className="text-muted">às</span>
                        <Input type="time" name={`horario_${chave}_ate`} defaultValue={faixa.ate} aria-label={`${rotulo}: até`} className="tabular w-32" />
                      </fieldset>
                    </div>
                  );
                })}
              </fieldset>
            </fieldset>
          </section>

          <section aria-labelledby={`${id}-situacao`} className="flex flex-col gap-4 md:col-span-2">
            <h2 id={`${id}-situacao`} className={titulo}>Situação</h2>
            {situacao}
            <FormField id={`${id}-obs`} rotulo="Observações" erro={erros.observacoes}>
              <Textarea name="observacoes" defaultValue={usuario?.observacoes ?? ''} rows={2} maxLength={1000} placeholder="Ex.: férias de 10 a 24/11" />
            </FormField>
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-brand px-6 py-4">
        <div className="text-sm text-muted">{rodape}</div>
        <div className="flex items-center gap-3">
          <IndicadorAlteracoes />
          <Link href="/usuarios" className={variantesBotao({ variant: 'outline' })}>
            <Undo2 aria-hidden size={16} strokeWidth={1.75} />
            Voltar
          </Link>
          <BotaoSalvar enviando={enviando}>
            <Save aria-hidden size={16} strokeWidth={1.75} />
            Salvar
          </BotaoSalvar>
        </div>
      </div>
    </FormularioAlteravel>
  );
}
```

Antes de seguir, confira três coisas no código existente e ajuste a ficha se preciso (sem mudar o comportamento descrito):
- `FormField` liga o `id` ao primeiro filho (rótulo `for`, `aria-describedby` da ajuda e do erro, `aria-invalid`): veja `components/patterns/form-field.tsx`;
- `@/components/ui/textarea` exporta `Textarea` (está na pasta `components/ui`);
- `BotaoSalvar` aceita ícone como filho (veja `formulario-alteravel.tsx`, linha 242).

O `contents` dos `fieldset` dos módulos mantém a grade de 3 colunas. Esconder é sempre pela classe `hidden` (não pelo atributo `hidden`, que perde para `flex` e `contents`); o `disabled` tira os campos do envio. A cor do "Permitido/Bloqueado" vem sempre com o texto (spec 8: vermelho nunca sozinho).

- [ ] **Passo 5: as páginas**

Crie `apps/painel/src/app/(painel)/usuarios/novo/page.tsx`:

```tsx
import { PageHeader } from '@/components/layout/page-header';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { sugestoesDeCargo } from '@/lib/usuarios';
import { convidarUsuario } from '../acoes';
import { FichaUsuario } from '../ficha-usuario';

/** Nova pessoa (spec 7.1): salvar envia o convite por e-mail e abre a ficha dela. */
export default async function NovaPessoa() {
  const eu = await exigirAdmin();
  const sb = await supabaseServidor();
  const [{ data: setores }, { data: cargos }] = await Promise.all([
    sb.from('setores').select('id, nome, ativo').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('cargo').not('cargo', 'is', null),
  ]);
  return (
    <section>
      <PageHeader titulo="Nova pessoa" migalhas={[{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Nova pessoa' }]} />
      <FichaUsuario
        usuario={null}
        eu={eu.id}
        setores={setores ?? []}
        cargos={sugestoesDeCargo((cargos ?? []).map((c) => c.cargo))}
        acao={convidarUsuario}
        situacao={<p className="text-muted">Ativa ao salvar.</p>}
        rodape="Senha: a pessoa recebe um convite por e-mail para criar a senha."
      />
    </section>
  );
}
```

Crie `apps/painel/src/app/(painel)/usuarios/[id]/page.tsx`:

```tsx
import { lerNiveis, variantesTelefone } from '@escritorio/core';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { AvisoArquivado } from '@/components/patterns/lista-arquivados';
import { lerHorarioDoBanco } from '@/lib/horario-acesso';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { dataCadastro, sugestoesDeCargo, textoUltimoAcesso } from '@/lib/usuarios';
import { salvarUsuario } from '../acoes';
import { AvisoContato } from '../aviso-contato';
import { FichaUsuario, type FichaDados } from '../ficha-usuario';
import { ReenviarConvite } from '../reenviar-convite';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ficha da pessoa em página inteira (spec 7.1, imagem 06). Arquivada: só o aviso com Restaurar. */
export default async function PaginaPessoa({ params }: { params: Promise<{ id: string }> }) {
  const eu = await exigirAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sb = await supabaseServidor();
  const [{ data: u }, { data: setores }, { data: cargos }, { data: contatos }] = await Promise.all([
    sb.from('usuarios').select('*, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)').eq('id', id).maybeSingle(),
    // Todos os setores, inclusive os inativos: senão salvar a pessoa apagaria a ligação dela com um setor desativado.
    sb.from('setores').select('id, nome, ativo').order('nome'),
    sb.from('usuarios').select('cargo').not('cargo', 'is', null),
    sb.from('contatos').select('nome, telefone'),
  ]);
  if (!u) notFound();
  const migalhas = [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: u.nome }];
  const topo = <p className="text-sm text-muted">Último acesso: {textoUltimoAcesso(u.ultimo_acesso_em, new Date())} · Cadastro: {dataCadastro(u.criado_em)}</p>;

  if (!u.ativo) {
    const arquivadoPor = u.arquivado_por ? (await sb.from('usuarios').select('nome').eq('id', u.arquivado_por).maybeSingle()).data?.nome ?? null : null;
    return (
      <section>
        <PageHeader titulo={u.nome} migalhas={migalhas} acoes={topo} />
        <AvisoArquivado tipo="usuario" id={u.id} nome={u.nome} arquivadoEm={u.arquivado_em} arquivadoPor={arquivadoPor} pode />
      </section>
    );
  }

  const niveis = lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel])));
  const dados: FichaDados = {
    id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, cargo: u.cargo, papel: u.papel,
    setores: u.usuario_setores.map((s) => s.setor_id), niveis, horario: lerHorarioDoBanco(u.horario_acesso), observacoes: u.observacoes,
  };
  const contato = niveis.assistente === 'site_whatsapp' && u.telefone
    ? (contatos ?? []).find((c) => variantesTelefone(u.telefone!).includes(c.telefone))?.nome ?? null
    : null;

  return (
    <section>
      <PageHeader titulo={u.nome} migalhas={migalhas} acoes={topo} />
      <FichaUsuario
        // Voltou do servidor com dados novos (salvou): a ficha recomeça com eles.
        key={JSON.stringify(dados)}
        usuario={dados}
        eu={eu.id}
        setores={setores ?? []}
        cargos={sugestoesDeCargo((cargos ?? []).map((c) => c.cargo))}
        acao={salvarUsuario.bind(null, u.id)}
        aviso={contato && <AvisoContato contato={contato} />}
        situacao={(
          <p className="flex items-center gap-2 text-success">
            <span aria-hidden className="size-2 rounded-full bg-current" />
            Ativo
          </p>
        )}
        rodape={<>Senha: convite enviado por e-mail · <ReenviarConvite id={u.id} /></>}
      />
      {u.id !== eu.id && <div className="mt-6"><ExcluirCadastro tipo="usuario" id={u.id} nome={u.nome} variante="area" voltarPara="/usuarios" /></div>}
    </section>
  );
}
```

Crie `apps/painel/src/app/(painel)/usuarios/[id]/loading.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

export default function Carregando() {
  return (
    <section role="status" aria-label="Carregando a pessoa" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    </section>
  );
}
```

Em `apps/painel/e2e/aquecer.ts`, acrescente `'/usuarios/novo'` à lista `ROTAS`, depois de `'/usuarios'`.

- [ ] **Passo 6: o e2e da ficha**

Crie `apps/painel/e2e/usuarios-ficha.spec.ts`:

```ts
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte D (spec 7.1, imagem 06): ficha em página inteira, níveis, administrador esconde permissões, erro sem perder nada.
const SENHA = 'senha-forte-123';

async function apagarLogin(email: string) {
  const { data } = await db.auth.admin.listUsers();
  for (const u of data.users.filter((x) => x.email === email)) await db.auth.admin.deleteUser(u.id);
}

test('nova pessoa: página inteira, níveis e horário gravados, convite enviado', async ({ page }) => {
  await apagarLogin('nova-ficha@e2e.local');
  await criarUsuarioTeste({ email: 'admin-ficha@e2e.local', senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  await entrar(page, 'admin-ficha@e2e.local', SENHA);
  await page.goto('/usuarios');
  await page.getByRole('link', { name: 'Nova pessoa' }).click();
  await page.waitForURL('**/usuarios/novo');
  const ficha = page.getByRole('form', { name: 'Nova pessoa' });
  await ficha.getByLabel('Nome', { exact: true }).fill('Nova Ficha');
  await ficha.getByLabel('E-mail de acesso').fill('nova-ficha@e2e.local');
  await ficha.getByLabel('Cargo').fill('Analista');
  await ficha.getByLabel('Fiscal').check();
  await ficha.getByLabel('Demandas', { exact: true }).selectOption('minhas');
  await ficha.getByLabel('Clientes e contatos').selectOption('editar');

  // Administrador = Sim esconde as permissões (menos o Assistente) e o horário; voltar mostra o que estava escolhido.
  await ficha.getByLabel('Administrador?').selectOption('admin');
  await expect(ficha.getByLabel('Demandas', { exact: true })).toBeHidden();
  await expect(ficha.getByLabel('Assistente')).toBeVisible();
  await expect(ficha.getByText('O administrador entra a qualquer hora.')).toBeVisible();
  await ficha.getByLabel('Administrador?').selectOption('atendente');
  await expect(ficha.getByLabel('Demandas', { exact: true })).toHaveValue('minhas');
  // Pessoa nova começa com o horário padrão: seg a sex 08 às 18, sábado e domingo bloqueados.
  await expect(ficha.getByLabel('Restringir o horário?')).toHaveValue('sim');
  await expect(ficha.getByLabel('Seg a sex: das')).toHaveValue('08:00');

  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Convite enviado para nova-ficha@e2e.local.')).toBeVisible();
  await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Nova Ficha' })).toBeVisible();
  const { data } = await db.from('usuarios').select('id, cargo, horario_acesso, usuario_permissoes(modulo, nivel)').eq('email', 'nova-ficha@e2e.local').single();
  expect(data!.cargo).toBe('Analista');
  expect(data!.horario_acesso).toEqual({ semana: { de: '08:00', ate: '18:00' }, sabado: null, domingo: null });
  const niveis = Object.fromEntries(data!.usuario_permissoes.map((p) => [p.modulo, p.nivel]));
  expect(niveis).toMatchObject({ demandas: 'minhas', clientes: 'editar', prazos: 'sim' });
  await apagarLogin('nova-ficha@e2e.local');
});

test('erro ao salvar mantém tudo o que foi digitado', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-ficha@e2e.local', senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia-ficha@e2e.local', senha: SENHA, nome: 'Bia Ficha', papel: 'atendente' });
  await entrar(page, 'admin-ficha@e2e.local', SENHA);
  await page.goto(`/usuarios/${bia}`);
  const ficha = page.getByRole('form', { name: 'Cadastro de Bia Ficha' });
  await ficha.getByLabel('Cargo').fill('Coordenadora');
  await ficha.getByLabel('Observações').fill('Férias de 10 a 24/11');
  await ficha.getByLabel('Assistente').selectOption('site_whatsapp');
  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await expect(ficha.getByText('Informe o telefone para usar o assistente pelo WhatsApp')).toBeVisible();
  await expect(ficha.getByLabel('Telefone (WhatsApp)')).toHaveAttribute('aria-invalid', 'true');
  await expect(ficha.getByLabel('Cargo')).toHaveValue('Coordenadora');
  await expect(ficha.getByLabel('Observações')).toHaveValue('Férias de 10 a 24/11');
  await expect(ficha.getByText('Alterações não salvas')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/usuarios/${bia}$`));
  expect((await db.from('usuarios').select('cargo').eq('id', bia).single()).data!.cargo).toBeNull();
  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await ficha.getByLabel('Telefone (WhatsApp)').fill('(31) 98877-0101');
  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Salvo: Bia Ficha.')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('cargo, telefone').eq('id', bia).single()).data)
    .toEqual({ cargo: 'Coordenadora', telefone: '5531988770101' });
});

test('na própria ficha o "Administrador?" fica travado; o link antigo ?usuario= abre a página', async ({ page }) => {
  const admin = await criarUsuarioTeste({ email: 'admin-ficha@e2e.local', senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  await entrar(page, 'admin-ficha@e2e.local', SENHA);
  await page.goto(`/usuarios?usuario=${admin}`);
  await page.waitForURL(new RegExp(`/usuarios/${admin}$`));
  await expect(page.getByLabel('Administrador?')).toBeDisabled();
  await expect(page.getByText('Você não pode tirar o seu próprio acesso de administrador.')).toBeVisible();
});
```

(O redirecionamento de `?usuario=` chega na Task 12; rode este último teste depois dela. O telefone `5531988770101` não pode ser de outra pessoa do banco local: o `supabase db reset` antes da suíte garante.)

- [ ] **Passo 7: ver passar (unitários) e seguir para a Task 12**

```bash
pnpm --filter @escritorio/painel test -- lib/usuarios trilha usuarios
```

Expected: verdes. O `typecheck` e o e2e só fecham depois da Task 12 (a lista ainda importa o formulário antigo). Siga direto para a Task 12; o commit é conjunto (Tasks 10, 11 e 12).

---

### Task 12: Painel. Lista de usuários nova e os e2e antigos

**Files:**
- Modify (reescrever): `apps/painel/src/app/(painel)/usuarios/page.tsx`
- Delete: `apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx`, `apps/painel/src/app/(painel)/usuarios/convite-usuario.tsx`
- Modify: `apps/painel/e2e/usuarios-erros.spec.ts`, `configuracoes.spec.ts`, `revisao-final.spec.ts`, `treinar-agente.spec.ts`, `arquivar-usuarios.spec.ts`, `acessibilidade.spec.ts`

**Interfaces:**
- Consumes: Tasks 9 a 11 (`horarioPermiteEm`, `lerHorarioDoBanco`, `ROTULO_NIVEL`, `textoUltimoAcesso`, `lerNiveis`).
- Produces: `/usuarios` com as colunas do spec 7.1; `?usuario=<id>` redireciona para `/usuarios/<id>`; botão "Nova pessoa".

- [ ] **Passo 1: a lista**

Substitua `apps/painel/src/app/(painel)/usuarios/page.tsx`:

```tsx
import { lerNiveis } from '@escritorio/core';
import { Clock, Pencil, UserPlus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { LinkArquivados, TelaArquivados } from '@/components/patterns/lista-arquivados';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { horarioPermiteEm, lerHorarioDoBanco } from '@/lib/horario-acesso';
import { ROTULO_NIVEL } from '@/lib/permissoes';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerOrdem, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { textoUltimoAcesso } from '@/lib/usuarios';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Linha = {
  id: string; nome: string; cargo: string | null; papel: 'admin' | 'atendente'; setores: string[];
  nivelDemandas: string; ultimoAcesso: string | null; foraAgora: boolean;
};

/** Pessoas do escritório (só o administrador): tabela; a ficha abre em página inteira (spec 7.1). */
export default async function Usuarios({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const eu = await exigirAdmin();
  const params = await searchParams;
  // Link antigo do painel lateral (Parte B), guardado em favoritos: abre a página da pessoa.
  const antigo = valorParam(params, 'usuario');
  if (antigo && UUID.test(antigo)) redirect(`/usuarios/${antigo}`);
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="usuario" titulo="Usuários arquivados" voltar={{ rotulo: 'Usuários e permissões', href: '/usuarios' }} pode />;
  }
  const ordem = lerOrdem(params, ['nome'], { coluna: 'nome', direcao: 'asc' })!;
  const sb = await supabaseServidor();
  const [{ data: usuarios, error: erroLista }, { data: setores }] = await Promise.all([
    sb.from('usuarios')
      .select('id, nome, cargo, papel, ativo, ultimo_acesso_em, horario_acesso, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)')
      .order('nome', { ascending: ordem.direcao === 'asc' }),
    sb.from('setores').select('id, nome, ativo').order('nome'),
  ]);
  if (erroLista) console.error('[usuarios] falha ao ler a lista', erroLista);
  const agora = new Date();
  const nomeSetor = new Map((setores ?? []).map((s) => [s.id, s]));
  const todas = usuarios ?? [];
  const ativos: Linha[] = todas.filter((u) => u.ativo).map((u) => {
    const niveis = lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel])));
    return {
      id: u.id, nome: u.nome, cargo: u.cargo, papel: u.papel, setores: u.usuario_setores.map((s) => s.setor_id),
      nivelDemandas: u.papel === 'admin' ? 'Todas (administrador)' : ROTULO_NIVEL.demandas[niveis.demandas],
      ultimoAcesso: u.ultimo_acesso_em,
      foraAgora: u.papel !== 'admin' && !horarioPermiteEm(lerHorarioDoBanco(u.horario_acesso), agora),
    };
  });
  const arquivados = todas.length - ativos.length;

  const colunas: ColunaTabela<Linha>[] = [
    {
      id: 'nome', titulo: 'Nome / Cargo', ordenavel: true, className: 'min-w-56',
      celula: (u) => (
        <span className="flex flex-col">
          <span className="truncate font-medium text-foreground">{u.nome}</span>
          <span className="truncate text-sm text-muted">{[u.cargo, u.papel === 'admin' ? 'Administrador' : null].filter(Boolean).join(' · ') || 'Sem cargo'}</span>
        </span>
      ),
    },
    {
      id: 'setores', titulo: 'Setores',
      celula: (u) => {
        if (u.setores.length === 0) return <span className="text-subtle">nenhum</span>;
        const mostrar = u.setores.slice(0, 2);
        return (
          <span className="flex items-center gap-1" title={u.setores.map((s) => nomeSetor.get(s)?.nome ?? '').join(', ')}>
            {mostrar.map((s) => {
              const setor = nomeSetor.get(s);
              return <Badge key={s} variant={setor?.ativo === false ? 'outline' : 'neutral'}>{setor?.nome ?? 'setor removido'}</Badge>;
            })}
            {u.setores.length > mostrar.length && <span className="text-xs text-muted">+{u.setores.length - mostrar.length}</span>}
          </span>
        );
      },
    },
    { id: 'demandas', titulo: 'Nível de Demandas', celula: (u) => <span className="text-foreground">{u.nivelDemandas}</span> },
    { id: 'acesso', titulo: 'Último acesso', celula: (u) => <span className="tabular text-muted">{textoUltimoAcesso(u.ultimoAcesso, agora)}</span> },
    {
      id: 'situacao', titulo: 'Situação',
      celula: (u) => u.foraAgora ? (
        <span className="flex items-center gap-1.5 text-warning">
          <Clock aria-hidden size={16} strokeWidth={1.75} />
          Fora do horário agora
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-success">
          <span aria-hidden className="size-2 rounded-full bg-current" />
          Ativo
        </span>
      ),
    },
  ];

  return (
    <section>
      <PageHeader
        titulo="Usuários e permissões"
        contagem={ativos.length}
        descricao="Cada pessoa tem um nível por módulo e um horário de acesso. O administrador pode tudo e entra a qualquer hora."
        acoes={(
          <>
            <LinkArquivados href="/usuarios?ver=arquivados" total={arquivados} />
            <Link href="/usuarios/novo" className={variantesBotao({ size: 'sm' })}>
              <UserPlus aria-hidden size={16} strokeWidth={1.75} />
              Nova pessoa
            </Link>
          </>
        )}
      />
      <DataTable
        rotulo="Usuários"
        linhas={ativos}
        colunas={colunas}
        chave={(u) => u.id}
        params={params}
        ordem={ordem}
        hrefLinha={(u) => `/usuarios/${u.id}`}
        // Lápis abre a ficha; ninguém arquiva nem exclui o próprio acesso.
        acoesLinha={(u) => (
          <span className="flex items-center justify-end gap-1">
            <Link href={`/usuarios/${u.id}`} aria-label={`Editar ${u.nome}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            {u.id !== eu.id && <ExcluirCadastro tipo="usuario" id={u.id} nome={u.nome} />}
          </span>
        )}
        erro={erroLista ? 'Não consegui carregar as pessoas agora.' : undefined}
        vazio={<EmptyState icone={UsersRound} titulo="Nenhuma pessoa cadastrada." descricao="Cadastre a equipe pelo botão Nova pessoa." />}
      />
    </section>
  );
}
```

Apague os dois arquivos antigos:

```bash
git rm "apps/painel/src/app/(painel)/usuarios/formulario-usuario.tsx" "apps/painel/src/app/(painel)/usuarios/convite-usuario.tsx"
```

Confira com `grep -rn "formulario-usuario\|convite-usuario\|ConviteUsuario\|FormularioUsuario" apps/painel/src` que nada mais os usa (o catálogo `/_design` incluído; se usar, troque pela `FichaUsuario` com dados de exemplo).

- [ ] **Passo 2: os e2e antigos**

Rode antes `grep -rn "Salvar usuário\|Convidar pessoa\|Enviar convite\|usuario=\|· Atendente\|Telefone com DDD" apps/painel/e2e` e ajuste cada ocorrência como abaixo (o motivo é o mesmo em todas: a ficha saiu do painel lateral para a página inteira, spec 7.1).

`apps/painel/e2e/usuarios-erros.spec.ts`: troque o corpo dos dois testes para a página da pessoa:
- `await page.goto(\`/usuarios?usuario=${bia}\`)` vira `await page.goto(\`/usuarios/${bia}\`)`;
- `const painel = page.getByRole('dialog')` vira `const painel = page.getByRole('form', { name: 'Cadastro de Bia Erros' })`;
- `painel.getByPlaceholder('Nome')` vira `painel.getByLabel('Nome')`; `painel.getByPlaceholder(CAMPO_TEL)` vira `painel.getByLabel('Telefone (WhatsApp)')` (apague a constante `CAMPO_TEL`);
- `{ name: 'Salvar usuário' }` vira `{ name: 'Salvar' }`;
- `await expect(page).toHaveURL(new RegExp(\`usuario=${bia}\`))` vira `await expect(page).toHaveURL(new RegExp(\`/usuarios/${bia}$\`))`;
- o axe passa a olhar `include('main')` no lugar de `include('[role="dialog"]')`;
- `await expect(page.getByRole('dialog')).toBeVisible()` vira `await expect(painel).toBeVisible()`.

`apps/painel/e2e/configuracoes.spec.ts`, teste "administrador convida pessoa na aba Usuários e vê aviso ao faltar telefone": substitua o corpo depois do clique em "Usuários e permissões" por:

```ts
  await page.getByRole('link', { name: 'Nova pessoa' }).click();
  const ficha = page.getByRole('form', { name: 'Nova pessoa' });
  await ficha.getByLabel('Nome', { exact: true }).fill('Nova Pessoa');
  await ficha.getByLabel('E-mail de acesso').fill('nova@teste.com');
  await ficha.getByLabel('Assistente').selectOption('site_whatsapp');
  await ficha.getByRole('button', { name: 'Salvar' }).click();
  // Erro no campo, com tudo o que foi digitado (spec 7.1).
  await expect(ficha.getByText('Informe o telefone para usar o assistente pelo WhatsApp')).toBeVisible();
  await expect(ficha.getByLabel('E-mail de acesso')).toHaveValue('nova@teste.com');
  await ficha.getByLabel('Telefone (WhatsApp)').fill('(31) 95555-0001');
  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Convite enviado para nova@teste.com.')).toBeVisible();
  await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/);
  const { data } = await db.from('usuarios').select('permissoes, telefone').eq('email', 'nova@teste.com').single();
  // "Site e WhatsApp" aparece na cópia antiga como as duas marcações.
  expect(data).toEqual({ permissoes: ['assistente_site', 'assistente_whatsapp'], telefone: '5531955550001' });
  const { data: depois } = await db.auth.admin.listUsers();
  await db.auth.admin.deleteUser(depois.users.find((u) => u.email === 'nova@teste.com')!.id);
```

`apps/painel/e2e/revisao-final.spec.ts`, teste "Usuários: telefone inválido avisa…":
- `await page.getByText('Bia Revisão · Atendente').click()` vira `await page.getByRole('row').filter({ hasText: 'Bia Revisão' }).getByRole('link', { name: 'Editar Bia Revisão' }).click()`;
- `const form = page.getByRole('dialog').locator('form')` vira `const form = page.getByRole('form', { name: 'Cadastro de Bia Revisão' })`;
- `form.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)')` vira `form.getByLabel('Telefone (WhatsApp)')`; `form.getByPlaceholder('Nome')` vira `form.getByLabel('Nome')`;
- `{ name: 'Salvar usuário' }` vira `{ name: 'Salvar' }`;
- `await expect(page.getByText('Bia Revisão Souza · Atendente')).toBeVisible()` vira `await expect(page.getByRole('heading', { name: 'Bia Revisão Souza' })).toBeVisible()`.

`apps/painel/e2e/treinar-agente.spec.ts` (linhas 142 a 147):

```ts
  await page.goto(`/usuarios/${semId}`);
  const form = page.getByRole('form', { name: 'Cadastro de Bia Sem Treino' });
  await expect(form.getByText('Escreve e liga as orientações que o agente segue.')).toBeVisible();
  await form.getByLabel('Treinar o agente').selectOption('sim');
  await form.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await db.from('usuarios').select('permissoes').eq('id', semId).single()).data?.permissoes).toEqual(['treinar_agente']);
```

e o texto de `SemPermissao` em `treinar-agente/page.tsx` que o teste confere ("na tela Usuários, ele marca \"Treinar o agente\" no seu cadastro.") vira "na tela Usuários, ele escolhe \"Sim\" em \"Treinar o agente\" no seu cadastro." (troque nos dois lugares, tela e teste). Se a função `painel(page)` desse arquivo ficar sem uso, apague-a.

`apps/painel/e2e/arquivar-usuarios.spec.ts`:
- teste "salvar a pessoa sem a chave Ativo não a desativa": `page.goto(\`/usuarios?usuario=${bia}\`)` vira `page.goto(\`/usuarios/${bia}\`)`; `page.getByPlaceholder('Nome')` vira `page.getByLabel('Nome')`; `'Salvar usuário'` vira `'Salvar'`;
- teste "lápis de editar…": `await expect(page).toHaveURL(new RegExp(\`usuario=${bia}\`))` vira `await expect(page).toHaveURL(new RegExp(\`/usuarios/${bia}$\`))` e `page.getByRole('dialog').getByPlaceholder('Nome')` vira `page.getByLabel('Nome')`.

`apps/painel/e2e/acessibilidade.spec.ts` (lista de rotas, linhas 130 a 132): troque `` `/usuarios?usuario=${ids.usuario}` `` por `` `/usuarios/${ids.usuario}` `` e acrescente `'/usuarios/novo'`.

- [ ] **Passo 3: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
supabase db reset
pnpm --filter @escritorio/painel e2e -- usuarios configuracoes revisao-final treinar-agente arquivar-usuarios horario-acesso
```

Expected: vitest e typecheck verdes; `usuarios-ficha` (3), `usuarios-erros` (2) e os specs ajustados passam.

- [ ] **Passo 4: commit (Tasks 10, 11 e 12 juntas)**

```bash
git add "apps/painel/src/app/(painel)/usuarios" apps/painel/src/lib/usuarios.ts apps/painel/src/lib/usuarios.test.ts \
  apps/painel/src/components/layout/trilha.ts apps/painel/src/components/layout/trilha.test.ts \
  "apps/painel/src/app/(painel)/treinar-agente/page.tsx" apps/painel/e2e
git commit -m "feat(painel): ficha da pessoa em página inteira, com níveis, horário e convite

/usuarios/novo e /usuarios/[id] em 3 colunas (imagem 06): cargo, setores,
telefone, administrador (esconde as permissões, menos o Assistente), níveis
por módulo, horário por dia, situação, observações, último acesso e
reenviar convite. Tudo grava por salvar_usuario; erro fica no campo sem
perder o digitado. A lista ganha Nome/Cargo, Nível de Demandas, Último acesso
e Situação; o link antigo ?usuario= abre a ficha. Junta as Tasks 10 a 12
(o painel não compila no meio da troca). Os e2e antigos de Usuários mudam
porque o painel lateral saiu.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Painel. As telas obedecem aos níveis

**Files:**
- Modify: `apps/painel/src/app/(painel)/atendimento/page.tsx`, `atendimento/[id]/page.tsx`
- Modify: `apps/painel/src/app/(painel)/demandas/page.tsx`, `detalhe-demanda.tsx`, `acoes-demanda.tsx`, `nova-demanda.tsx`, `acoes.ts`, `acoes.test.ts`
- Modify: `apps/painel/src/app/(painel)/configuracoes/page.tsx`, `acoes.ts`, `esquemas.ts`, `esquemas.test.ts`
- Modify: `apps/painel/src/app/(painel)/clientes/(lista)/page.tsx`, `clientes/[id]/page.tsx`, `clientes/[id]/secao-parceiros.tsx`, `clientes/[id]/secao-produtos.tsx`, `contatos/page.tsx`, `contatos/detalhe-contato.tsx`
- Create: `apps/painel/e2e/niveis-telas.spec.ts`

**Interfaces:**
- Consumes: `temNivel` (Task 9), `exigirConfiguracoes` (Task 9), regras do banco das Tasks 3 e 6.
- Produces: `salvarExpediente(formData)` e `salvarTetoAlertas(formData)` no lugar de `salvarGerais`; `ExpedienteForm` e `TetoAlertasForm` no lugar de `GeraisForm`; props novas `verPedidos` e `podePrazo` (Demandas) e `podeArquivar` (Clientes, Contatos).

- [ ] **Passo 1: os testes**

Em `apps/painel/src/app/(painel)/demandas/acoes.test.ts`, troque a linha 11 por

```ts
const sessao = vi.hoisted(() => ({ prazos: 'sim' as 'sim' | 'nao' }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { prazos: sessao.prazos } }) }));
```

e acrescente (dentro do `describe` das ações, com `sessao.prazos = 'sim'` no `beforeEach` existente):

```ts
  it('sem "Alterar prazos" o prazo à mão é recusado antes do banco (P10)', async () => {
    sessao.prazos = 'nao';
    expect(await definirPrazo(ID, '2026-10-13T18:00')).toEqual({ ok: false, erro: 'Você não tem permissão para alterar prazos.' });
    expect(falso.chamadas).toEqual([]);
  });
```

(Use os nomes `ID`, `falso.chamadas` e o import de `definirPrazo` que o arquivo já tem.)

Substitua o `describe('GeraisForm', …)` de `apps/painel/src/app/(painel)/configuracoes/esquemas.test.ts` e o import da linha 2:

```ts
import { esquemaAvisoLogin, ExpedienteForm, PrazosForm, TetoAlertasForm } from './esquemas';

describe('ExpedienteForm e TetoAlertasForm (separados na Parte D: teto e alertas são só do administrador)', () => {
  it('expediente: horários e dias úteis', () => {
    const f = new FormData();
    f.set('horario_inicio', '08:00'); f.set('horario_fim', '18:00'); f.append('dia', '1'); f.append('dia', '5');
    expect(ExpedienteForm.parse(f)).toEqual({ horario_inicio: '08:00', horario_fim: '18:00', dias_uteis: [1, 5] });
  });
  it('fim antes do início é recusado', () => {
    const f = new FormData();
    f.set('horario_inicio', '18:00'); f.set('horario_fim', '08:00');
    expect(ExpedienteForm.safeParse(f).success).toBe(false);
  });
  it('teto e alertas', () => {
    const f = new FormData();
    f.set('teto_ia_usd', '80'); f.set('minutos_alerta_fila', '30'); f.set('email_alertas', 'dono@escritorio.com'); f.set('telefone_dono', '(31) 97777-0000');
    expect(TetoAlertasForm.parse(f)).toEqual({ teto_ia_usd: 80, minutos_alerta_fila: 30, email_alertas: 'dono@escritorio.com', telefone_dono: '5531977770000' });
  });
});
```

Crie `apps/painel/e2e/niveis-telas.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte D: as telas obedecem aos níveis (o banco já recusa; a tela não oferece o que a pessoa não pode).
const SENHA = 'senha-forte-123';
const nivel = (id: string, modulo: string, n: string) => db.from('usuario_permissoes').update({ nivel: n }).eq('usuario_id', id).eq('modulo', modulo);

test('Atendimento "Sem acesso": some do menu e a tela não abre', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  await nivel(ana, 'atendimento', 'sem_acesso');
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await expect(page.getByRole('link', { name: 'Atendimento' })).toHaveCount(0);
  await page.goto('/atendimento');
  await expect(page).toHaveURL(/\/inicio/);
});

test('Clientes "Ver e editar": edita, mas não arquiva', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  await nivel(ana, 'clientes', 'editar');
  await db.from('clientes').delete().eq('cnpj', '11222333000181');
  await db.from('clientes').insert({ razao_social: 'Níveis Ltda', cnpj: '11222333000181' });
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto('/clientes');
  const linha = page.getByRole('row').filter({ hasText: 'Níveis Ltda' });
  await expect(linha.getByRole('link', { name: 'Editar Níveis Ltda' })).toBeVisible();
  await expect(linha.getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
});

test('Configurações "Sim": abre sem teto de IA e sem Usuários; "Sem acesso" volta ao Início', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto('/configuracoes');
  await expect(page).toHaveURL(/\/inicio/);
  await nivel(ana, 'configuracoes', 'sim');
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Expediente' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Teto de IA e alertas' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Integrações' })).toHaveCount(0);
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/inicio/);
});

test('sem "Alterar prazos": o prazo da demanda fica travado; com "Sim" muda', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: d } = await db.from('chamados').insert({ titulo: 'Prazo travado (e2e)', setor_id: fiscal!.id }).select('id').single();
  await nivel(ana, 'prazos', 'nao');
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto(`/demandas?demanda=${d!.id}`);
  const painel = page.getByRole('dialog', { name: /Nº [0-9]+/ });
  await expect(painel.getByLabel('Prazo', { exact: true })).toBeDisabled({ timeout: 30_000 });
  await expect(painel.getByText('Só quem pode alterar prazos escolhe a data. Mudar a prioridade recalcula o prazo.')).toBeVisible();
});
```

- [ ] **Passo 2: ver falhar**

```bash
pnpm --filter @escritorio/painel test -- demandas/acoes configuracoes/esquemas
supabase db reset
pnpm --filter @escritorio/painel e2e -- niveis-telas
```

Expected: o vitest falha (`ExpedienteForm` não existe; `definirPrazo` chama o banco sem conferir o nível); o e2e falha nos 4 testes (Atendimento aparece, o botão de arquivar aparece, `/configuracoes` manda para o Início, o prazo não está travado).

- [ ] **Passo 3: Atendimento**

Em `apps/painel/src/app/(painel)/atendimento/page.tsx` e em `atendimento/[id]/page.tsx`, logo depois de `const u = await obterUsuario();`:

```ts
  // "Atendimento: Sem acesso" (Parte D): o banco já não mostra conversa nenhuma; a tela nem abre.
  if (!temNivel(u, 'atendimento', 'meus_setores')) redirect('/inicio');
```

com `import { redirect } from 'next/navigation';` e `import { temNivel } from '@/lib/permissoes';`.

- [ ] **Passo 4: Demandas (pedido de nota e prazo)**

Em `apps/painel/src/app/(painel)/demandas/page.tsx`, ao lado de `const podeCsv = temNivel(u, 'notas', 'corrigir');` (linha 45):

```ts
  const verPedidos = temNivel(u, 'notas', 'ver');
  const podePrazo = temNivel(u, 'prazos', 'sim');
```

Passe `verPedidos={verPedidos} podePrazo={podePrazo}` para `<DetalheCarregado …>` (linha 165) e acrescente os dois na assinatura de `DetalheCarregado` (linha 206) e no `<DetalheDemanda …>` que ela renderiza; passe `podePrazo={podePrazo}` para `<NovaDemanda …>` (linha 170).

Em `apps/painel/src/app/(painel)/demandas/detalhe-demanda.tsx`:
- assinatura (linhas 39 e 40): acrescente `verPedidos, podePrazo` aos parâmetros e `verPedidos: boolean; podePrazo: boolean;` ao tipo;
- etiqueta (linha 71): `{d.pedidoVenda && verPedidos ? <Badge variant="brand" className="ml-2">Pedido de nota</Badge> : null}`;
- seção (linha 85): `{d.pedidoVenda && verPedidos ? (` no lugar de `{d.pedidoVenda ? (`;
- onde renderiza `<CamposDemanda …>`, acrescente `podePrazo={podePrazo}`.

Em `apps/painel/src/app/(painel)/demandas/acoes-demanda.tsx`:
- `CamposDemanda` (linha 58) recebe `podePrazo`: `export function CamposDemanda({ d, pessoas, agora, podePrazo }: { d: DemandaControles; pessoas: PessoaSetor[]; agora: Date; podePrazo: boolean })`;
- o campo Prazo (linha 107): `disabled={concluida || !podePrazo}`;
- logo depois da linha do `<PrazoTexto …>` (linha 111):

  ```tsx
        {!podePrazo && <p className="text-xs text-muted">Só quem pode alterar prazos escolhe a data. Mudar a prioridade recalcula o prazo.</p>}
  ```

Em `apps/painel/src/app/(painel)/demandas/nova-demanda.tsx`:
- `NovaDemanda` (linha 24) recebe `podePrazo: boolean` (assinatura e tipo);
- no `<Input id={\`${id}-prazo\`} …>` (linha 139): `readOnly={!podePrazo}` e `onChange={(e) => { if (!podePrazo) return; setPrazo(e.target.value); setPrazoTocado(true); }}`;
- logo depois do `{aviso('prazo')}` (linha 141):

  ```tsx
            {!podePrazo && <p className="text-xs text-muted">O prazo sugerido vale. Só quem pode alterar prazos muda a data.</p>}
  ```

  (sem tocar no campo, `prazoTocado` fica falso e a ação manda o prazo vazio: o banco calcula, como antes.)

Em `apps/painel/src/app/(painel)/demandas/acoes.ts`, importe `temNivel` de `@/lib/permissoes` e:
- em `definirPrazo`, antes de `doCampoDataHora`:

  ```ts
    // Prazo à mão exige "Alterar prazos" (P10); o banco também recusa.
    if (!temNivel(await obterUsuario(), 'prazos', 'sim')) return { ok: false, erro: 'Você não tem permissão para alterar prazos.' };
  ```

- em `criarDemanda`, logo depois de calcular `prazo` (linha 105):

  ```ts
    if (d.prazo && !temNivel(await obterUsuario(), 'prazos', 'sim')) return { ok: false, erro: 'Você não tem permissão para alterar prazos.', campo: 'prazo' };
  ```

- [ ] **Passo 5: Configurações**

Em `apps/painel/src/app/(painel)/configuracoes/esquemas.ts`, troque `GeraisForm` por:

```ts
/** Expediente (Configurações: Sim). */
export const ExpedienteForm = z.preprocess((v) => {
  const f = v as FormData;
  return { horario_inicio: f.get('horario_inicio'), horario_fim: f.get('horario_fim'), dias_uteis: f.getAll('dia').map(Number) };
}, z.object({
  horario_inicio: z.string().regex(/^\d{2}:\d{2}$/),
  horario_fim: z.string().regex(/^\d{2}:\d{2}$/),
  dias_uteis: z.array(z.number().int().min(0).max(6)),
}).refine((g) => g.horario_fim > g.horario_inicio, { message: 'O fim do expediente precisa ser depois do início', path: ['horario_fim'] }));

/** Teto de IA e alertas: só o administrador (P12; o banco também segura essas colunas). */
export const TetoAlertasForm = z.preprocess((v) => {
  const f = v as FormData;
  return {
    teto_ia_usd: f.get('teto_ia_usd'), minutos_alerta_fila: f.get('minutos_alerta_fila'),
    email_alertas: f.get('email_alertas') || null, telefone_dono: f.get('telefone_dono') || null,
  };
}, z.object({
  teto_ia_usd: z.coerce.number().positive(),
  minutos_alerta_fila: z.coerce.number().int().min(5),
  email_alertas: z.string().email().nullable(),
  telefone_dono: telefoneOpcional,
}));
```

Em `apps/painel/src/app/(painel)/configuracoes/acoes.ts`:
- import: `import { exigirAdmin, exigirConfiguracoes } from '@/lib/sessao';` e `import { esquemaAvisoLogin, ExpedienteForm, PrazosForm, TetoAlertasForm } from './esquemas';`;
- em `salvarSetor`, `salvarServico`, `salvarResposta`, `removerResposta`, `adicionarFeriado`, `removerFeriado`, `salvarMensagens`, `salvarAvisoLogin` e `salvarPrazos`, troque `await exigirAdmin();` por `await exigirConfiguracoes();`;
- troque `salvarGerais` por:

  ```ts
  export async function salvarExpediente(formData: FormData) {
    await exigirConfiguracoes();
    checar(await (await supabaseServidor()).from('configuracoes').update(ExpedienteForm.parse(formData)).eq('id', 1));
    recarregar();
  }

  export async function salvarTetoAlertas(formData: FormData) {
    await exigirAdmin();
    checar(await (await supabaseServidor()).from('configuracoes').update(TetoAlertasForm.parse(formData)).eq('id', 1));
    recarregar();
  }
  ```

Em `apps/painel/src/app/(painel)/configuracoes/page.tsx`:
- `const u = await exigirAdmin();` (linha 78) vira `const u = await exigirConfiguracoes();` e logo abaixo `const admin = u.papel === 'admin';`;
- no `Promise.all`, a leitura de `sinais_vida` e o `gastoDoMes` só para o administrador: `admin ? sb.from('sinais_vida').select('*') : Promise.resolve({ data: null })` e `admin ? gastoDoMes(sb, u.id, agora) : Promise.resolve(null)`;
- `<NavegacaoSecoes secoes={SECOES} />` vira `<NavegacaoSecoes secoes={admin ? SECOES : SECOES.filter((s) => s.id !== 'teto-ia' && s.id !== 'integracoes')} />`;
- a `descricao` do `PageHeader` (link para Usuários) só para o administrador: `descricao={admin ? <>Usuários e permissões ficam na aba <Link …>Usuários</Link>.</> : undefined}`;
- o `FormularioAlteravel action={salvarGerais}` que embrulhava Expediente e Teto (linhas 109 a 154) vira dois formulários independentes, cada um com o seu Salvar (tire o comentário "são o mesmo formulário" e os `outro={…}` dos dois `RodapeSalvar`):

  ```tsx
          <FormularioAlteravel action={salvarExpediente}>
            <Secao id="expediente" titulo="Expediente" descricao="Horário e dias em que o escritório atende. Os feriados cadastrados abaixo contam como fora do expediente." escopo>
              {/* o mesmo CardContent de hoje (HorarioExpediente e Dias úteis) */}
              <RodapeSalvar />
            </Secao>
          </FormularioAlteravel>

          {admin && (
            <FormularioAlteravel action={salvarTetoAlertas}>
              <Secao id="teto-ia" titulo="Teto de IA e alertas" descricao="Ao chegar no teto do mês, o agente para de responder e as conversas vão para a equipe." escopo>
                {/* o mesmo CardContent de hoje (teto, minutos, e-mail, WhatsApp do dono) */}
                <RodapeSalvar />
              </Secao>
            </FormularioAlteravel>
          )}
  ```

  O conteúdo dos dois `CardContent` é o que já está no arquivo (linhas 112 a 129 e 133 a 151), sem mudança;
- a seção "Integrações" (linha 329) fica dentro de `{admin && ( … )}`.

Antes de trocar, `grep -rn "Salva junto com\|O teto de IA e os alertas também têm alterações" apps/painel/e2e apps/painel/src` e ajuste o teste que conferir essa nota (ela some, porque os formulários se separaram).

- [ ] **Passo 6: arquivar em Clientes e Contatos ("Editar e arquivar")**

- `clientes/(lista)/page.tsx`: ao lado de `const pode = temNivel(u, 'clientes', 'editar');` (linha 30), `const podeArquivar = temNivel(u, 'clientes', 'arquivar');`; `TelaArquivados … pode={podeArquivar}` (linha 32); na coluna de ações (linha 126) `{podeArquivar && <ExcluirCadastro tipo="cliente" id={c.id} nome={c.razao_social} />}`.
- `clientes/[id]/page.tsx`: `const podeArquivar = temNivel(u, 'clientes', 'arquivar');`; `AvisoArquivado … pode={podeArquivar}` (linha 51); `{aba === 'dados' && podeArquivar && c.ativo && <ExcluirCadastro … />}` (linha 62); passe `podeArquivar={podeArquivar}` para `SecaoParceiros` e `SecaoProdutos`.
- `clientes/[id]/secao-parceiros.tsx`: prop nova `podeArquivar: boolean`; linhas 73 e 99 `{podeArquivar && <ExcluirCadastro … />}`; linhas 127 e 128 `ArquivadosRecolhidos … pode={podeArquivar}`.
- `clientes/[id]/secao-produtos.tsx`: prop nova `podeArquivar: boolean`; linha 71 `{podeArquivar && <ExcluirCadastro … />}`; linhas 52 e 83 `ArquivadosRecolhidos … pode={podeArquivar}`.
- `contatos/page.tsx`: `const podeArquivar = temNivel(u, 'clientes', 'arquivar');`; `TelaArquivados … pode={podeArquivar}` (linha 42); na coluna de ações (linha 163) `{podeArquivar && <ExcluirCadastro tipo="contato" … />}`; `<DetalheContato … podeArquivar={podeArquivar} />` (linha 205).
- `contatos/detalhe-contato.tsx`: prop nova `podeArquivar: boolean` (linha 31); `AvisoArquivado … pode={podeArquivar}` (linha 65); `{podeArquivar && c.ativo && ( … ExcluirCadastro … )}` (linha 102).

- [ ] **Passo 7: ver passar**

```bash
pnpm --filter @escritorio/painel test
pnpm --filter @escritorio/painel typecheck
supabase db reset
pnpm --filter @escritorio/painel e2e -- niveis-telas configuracoes demandas arquivar atendimento
```

Expected: tudo verde; os specs de arquivar (Bia com `editar_clientes` vira "Editar e arquivar") e de configurações (administrador) continuam passando.

- [ ] **Passo 8: commit**

```bash
git add "apps/painel/src/app/(painel)" apps/painel/e2e/niveis-telas.spec.ts
git commit -m "feat(painel): Atendimento, pedidos de nota, prazo, Configurações e arquivar pelos níveis

Atendimento Sem acesso não abre; Pedidos de nota Sem acesso esconde o pedido;
sem Alterar prazos o prazo fica travado (a prioridade continua recalculando);
Configurações Sim abre a tela sem teto de IA, integrações e usuários (o
formulário do expediente se separa do teto); arquivar e restaurar exigem
Editar e arquivar.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Acessibilidade, catálogo e manual

**Files:**
- Modify: `apps/painel/e2e/acessibilidade.spec.ts` (já ajustado na Task 12; aqui confira os dois temas)
- Modify: `apps/painel/src/app/(painel)/_design/page.tsx` (amostra da ficha) — se o catálogo tiver seções por padrão
- Modify: `docs/design-system.md`, `docs/operacao.md`

**Interfaces:**
- Consumes: as telas das Tasks 9 a 13.
- Produces: catálogo e manuais atualizados.

- [ ] **Passo 1: acessibilidade nos dois temas**

```bash
supabase db reset
pnpm --filter @escritorio/painel e2e -- acessibilidade horario-acesso usuarios-ficha
```

Expected: `/usuarios`, `/usuarios/novo`, `/usuarios/<id>` e `/fora-do-horario` sem violação séria ou crítica nos temas claro e escuro. Se o axe acusar contraste no "● Permitido / ● Bloqueado" (texto colorido dentro do `select`), troque `text-success`/`text-danger` do `select` por `text-foreground` e mostre o estado num `<span>` ao lado com ponto e texto (`text-success`/`text-danger`), como a coluna Situação da lista.

- [ ] **Passo 2: catálogo**

Abra `apps/painel/src/app/(painel)/_design/page.tsx`. Se ele mostra padrões de formulário, acrescente uma amostra "Ficha em página inteira (Parte D)" com `FichaUsuario` em modo nova pessoa e uma ação que só devolve `{ ok: false, erros: { telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' } }` (para mostrar o erro no campo). Se o catálogo não tiver seção de formulários, não acrescente nada.

- [ ] **Passo 3: `docs/design-system.md`**

Em "Vocabulário oficial da interface", acrescente:

```markdown
- **Pessoa** (usuário da equipe): "Nova pessoa", "Cadastro de <nome>". **Nível** (de uma permissão): "Só as minhas", "Do meu setor", "Todas", "Só ver", "Ver e editar", "Editar e arquivar", "Corrigir e gerar", "Site e WhatsApp". **Horário de acesso**: "Permitido", "Bloqueado", "Fora do seu horário de acesso".
```

e, em "Quando usar ui/, patterns/ ou layout/", um parágrafo:

```markdown
**Ficha em página inteira** (Parte D, `usuarios/ficha-usuario.tsx`): cadastros com muitos campos usam página inteira com trilha, 3 colunas e rodapé com Voltar e Salvar, em vez de painel lateral. Campos que somem por uma escolha (ex.: "Administrador = Sim") ficam num `fieldset` desligado e escondido pela classe `hidden`: não vão no envio e voltam com o valor de antes.
```

- [ ] **Passo 4: `docs/operacao.md`**

Troque a seção "### Convidar alguém" (seção 3) por:

```markdown
### Pessoas, permissões e horário de acesso

Configurações › Usuários e permissões › **Nova pessoa** abre a ficha em página inteira. Ao salvar, a pessoa recebe um convite por e-mail para criar a senha. Na ficha de quem já existe, "reenviar convite" (no rodapé) manda o convite de novo, ou um link para criar senha nova se a pessoa já tinha entrado.

**Administrador = Sim** dá acesso total e esconde as permissões (menos o Assistente, que continua por escolha, porque depende do telefone). Ninguém tira o próprio acesso de administrador.

Cada módulo tem um nível:

| Módulo | Níveis |
|---|---|
| Atendimento | Sem acesso · Conversas dos meus setores · Todas as conversas |
| Demandas | Só as minhas · Do meu setor · Todas |
| Clientes e contatos | Só ver · Ver e editar (inclui produtos) · Editar e arquivar |
| Preços | Só ver · Mudar preços |
| Pedidos de nota e CSV Bling | Sem acesso · Ver · Corrigir e gerar |
| Assistente | Sem acesso · Site · Site e WhatsApp (exige telefone) |
| Treinar o agente | Sem acesso · Sim |
| Alterar prazos de demandas | Não · Sim (escolher o prazo à mão; mudar a prioridade recalcula o prazo para todos) |
| Configurações | Sem acesso · Sim (sem teto de IA, alertas, pausa do agente e usuários, que ficam com o administrador) |

Quando a Parte D entrou, cada pessoa recebeu o nível que reproduz o que ela já fazia: ninguém passou a ver nem a fazer mais ou menos sem você mexer. Quem só tinha o assistente pelo WhatsApp ficou com "Site e WhatsApp".

**Horário de acesso:** seg a sex, sábado e domingo, cada um Permitido (com início e fim) ou Bloqueado. Pessoa nova começa com seg a sex das 08:00 às 18:00 e fim de semana bloqueado; quem já existia ficou sem restrição até você definir. Fora do horário a pessoa não entra, a aba aberta mostra "Fora do seu horário de acesso", nada é lido nem gravado, e o assistente pelo WhatsApp responde o aviso sem gastar IA. Feriado segue o dia da semana. O administrador entra a qualquer hora.

**Último acesso** aparece no topo da ficha e na lista (atualiza no máximo a cada 10 minutos de uso).
```

- [ ] **Passo 5: commit**

```bash
git add docs/design-system.md docs/operacao.md apps/painel/src apps/painel/e2e
git commit -m "docs: ficha em página inteira, níveis e horário de acesso no catálogo e no manual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes:
   - **regressão antes e depois:** mostre ao dono, lado a lado, a linha do `22_regressao_visibilidade.test.sql` guardada na Task 1 (`$SCRATCH/regressao-antes.txt`, 71/71 com o código antigo) e a de agora (71/71 com as cinco migrações). Mostre também `git diff $(cat "$SCRATCH/commit-regressao.txt") -- supabase/tests/22_regressao_visibilidade.test.sql` **vazio** (o teste não mudou);
   - `supabase test db`: todos os arquivos, inclusive `22` 71/71, `23` 25/25, `24` 24/24, `25` 34/34, `26` 16/16, `27` 11/11;
   - `pnpm --filter @escritorio/core test`;
   - `pnpm --filter @escritorio/db test` e `pnpm --filter @escritorio/db typecheck`;
   - `pnpm --filter @escritorio/trabalhador test` e `pnpm --filter @escritorio/trabalhador typecheck`;
   - `pnpm --filter @escritorio/painel test` e `pnpm --filter @escritorio/painel typecheck`;
   - `pnpm --filter @escritorio/painel e2e`: todos os specs, com o `acessibilidade.spec.ts` nos dois temas. Rode `supabase db reset` de novo **antes** desta suíte se o `supabase test db` ou o trabalhador rodaram logo antes no mesmo banco;
   - **cenários com Claude real** (banco local; P18): `pnpm --filter @escritorio/trabalhador cenarios-assistente` (os 3 do assistente, US$ menos de 1). Os 50 do agente de clientes não rodam: o agente não mudou;
   - mostre os números exatos de cada suíte (passaram, falharam, pulados) e a linha final dos cenários. Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `06-usuario-cadastro.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local e uma pessoa parecida com a da imagem (Ana Paula Souza, Analista, Pessoal e Fiscal, telefone, níveis da imagem, seg a sex 08–18, sábado 08–12, domingo bloqueado, observação "Férias de 10 a 24/11");
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**);
   - telas: a ficha da Ana; a ficha com "Administrador = Sim"; a ficha com um erro no telefone; "Nova pessoa"; a lista de usuários com uma pessoa "Fora do horário agora"; a página "Fora do seu horário de acesso"; Configurações vista por quem tem "Configurações: Sim";
   - liste o que ficou diferente da imagem. Já se sabe: setores como etiquetas marcáveis numa caixa, e não lista suspensa (decisão 13); "Restringir o horário?" a mais, acima dos dias (P4: quem já existia está sem restrição); o horário em dois campos de hora ("08:00" "às" "18:00") em vez de um campo só; a "Situação" só mostra Ativo (arquivar e restaurar seguem pelo Excluir… e Arquivados, spec 7.1); o módulo aparece como "Preços" (P1).
3. **Homologação:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Deve listar só `20261004000100_painel_v2_niveis.sql` a `20261004000500_painel_v2_configuracoes.sql` (e as da Parte C e das sobras que ainda não estiverem lá). O `--dry-run` não roda o SQL, então os avisos da P2 não aparecem nele;
   - para o dono ver a conversão antes de aplicar, rode **só leitura**, se o `psql` estiver instalado (`psql --version`; se não estiver, pule e diga isso ao dono): grave em `$SCRATCH/previa-niveis.sql`

     ```sql
     select nome, papel,
       case when 'editar_clientes' = any (permissoes) then 'Editar e arquivar' else 'Só ver' end as clientes,
       case when 'editar_precos' = any (permissoes) then 'Mudar preços' else 'Só ver' end as precos,
       case when 'emitir_notas' = any (permissoes) then 'Corrigir e gerar' else 'Ver' end as pedidos_de_nota,
       case when 'assistente_whatsapp' = any (permissoes) then 'Site e WhatsApp'
            when 'assistente_site' = any (permissoes) then 'Site' else 'Sem acesso' end as assistente,
       case when 'treinar_agente' = any (permissoes) then 'Sim' else 'Sem acesso' end as treinar,
       'Do meu setor' as demandas, 'Conversas dos meus setores' as atendimento, 'Sim' as alterar_prazos,
       case when papel = 'admin' then 'Sim (administrador)' else 'Sem acesso' end as configuracoes
     from public.usuarios where ativo order by nome;
     ```

     e rode `PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -f "$SCRATCH/previa-niveis.sql"`. Mostre a tabela ao dono;
   - explique o que muda para quem já está rodando na homologação:
     - **nada muda no que cada pessoa vê ou faz** (a conversão reproduz o de hoje; teste 22);
     - os painéis antigos (Parte A na 3002 e 3003, Parte B na 3004, sobras na 3005, Parte C na 3006) continuam funcionando: `tem_permissao('editar_clientes')` e as outras marcações viram adaptadores, e salvar uma pessoa por eles grava o array antigo, que o banco converte sem promover ninguém;
     - o trabalhador antigo (3001) continua: ele lê a cópia antiga (`permissoes`), que o banco mantém;
     - ninguém tem horário até o administrador definir no painel novo. Depois disso, o horário vale também nos painéis antigos (é o banco que recusa), mas lá a pessoa vê a tela vazia em vez do aviso;
   - **espere o "ok" dele.** Só então rode o mesmo comando sem `--dry-run`.
4. **Subir para o dono testar (painel e trabalhador desta branch, apontando para a homologação):**
   - **painel** desta worktree numa porta livre. Sugestão: **3007** (3002 e 3003 são da Parte A, 3004 da Parte B, 3005 das sobras, 3006 da Parte C). Antes, `netstat -ano | findstr :3007`. Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal (`C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/ligar-teste.ps1`): variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p 3007` rodando nesta worktree;
   - **trabalhador** (mudou: assistente pelos níveis e pelo horário): o da porta **3001 é o teste do dono** e recebe o webhook da Z-API pelo túnel. **Não desligue nem mate esse processo.** Pergunte ao dono:
     - (a) **recomendado:** ele mesmo fecha a janela do trabalhador da 3001; então suba o desta worktree **na 3001** (o túnel já aponta para ela): em `apps/trabalhador`, `pnpm exec tsx watch "--env-file=<worktree>/.env" "--env-file=C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.env.homologacao" src/principal.ts`;
     - (b) se ele preferir manter o da 3001: suba o desta worktree em outra porta (`PORTA=3012`, conferida com `netstat`) e avise que, enquanto os dois estiverem ligados, o teste do assistente fora do horário pelo WhatsApp não é confiável (a mensagem pode cair no antigo);
   - passe os endereços e um roteiro curto:
     1. Configurações › Usuários e permissões: a lista (Nível de Demandas, Último acesso, Situação); abrir uma pessoa;
     2. ficha: mudar Cargo e Observações; marcar "Administrador = Sim" (somem as permissões, menos Assistente) e voltar; salvar com "Site e WhatsApp" sem telefone (erro no campo, nada se perde);
     3. "Nova pessoa" com um e-mail de teste: convite chega; "reenviar convite";
     4. numa pessoa de teste, "Demandas: Só as minhas" e entrar como ela: só as demandas dela; "Atendimento: Sem acesso": o Atendimento some;
     5. horário: numa pessoa de teste, bloquear o dia de hoje e tentar entrar ("Fora do seu horário de acesso"); com ela logada noutra janela, bloquear e navegar (vai para a página do horário);
     6. Realtime ao vivo: com uma pessoa "Do meu setor" (Fiscal) logada no Atendimento, mandar uma mensagem de um cliente com demanda do Pessoal: não aparece; uma do Fiscal: aparece;
     7. pelo WhatsApp de teste de alguém com "Site e WhatsApp" e o dia bloqueado: vem o aviso de fora do horário;
     8. alguém com "Configurações: Sim": vê Expediente, Mensagens, Prazos, Setores, Feriados; não vê Teto de IA nem Usuários.
5. **Pendências para listar no fim:**
   - as respostas do dono às perguntas P1 a P18 que ainda faltam, e as decisões 1 a 13 que ele ainda não confirmou;
   - o que ficou diferente da imagem 06;
   - a coluna antiga `usuarios.permissoes` sai numa parte futura (P15), quando nenhum painel ou trabalhador antigo estiver ligado;
   - "Acessos de portais" entra na Parte H (P14); "Gastos com IA" fica só do administrador na Parte F;
   - para a Parte G: o redesenho de Configurações deve manter a separação Expediente × Teto de IA e alertas desta parte.
6. **Não juntar** a branch em nada. **Parar** ao fim da Parte D e esperar "próxima parte".

