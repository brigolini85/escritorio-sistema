# Painel v2, Parte I1 (Motor de agentes, tela Agentes, ficha e o Thiago no motor). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** criar o **motor de agentes** (um runtime só; cada agente é uma linha de `agentes` com setor, tipo, estado, modelo, modo de contato, skills e ferramentas), a tela **Agentes** (`/agentes`, imagem `00-agentes-lista.png`) e a **ficha do agente** (`/agentes/<slug>`, imagem `00-agente-ficha.png`) com as abas **Visão geral · Skills · Ferramentas · Como fala com o cliente · Orientações · Testar · Atividade e custo**, e **migrar o Thiago (Atendimento) para o motor sem mudar o comportamento**: o pedido que ele manda ao Claude continua **idêntico byte a byte** (retrato tirado antes de mexer, Task 1) e todos os cenários de hoje continuam 100%. As 7 linhas iniciais nascem na migração (Thiago **Ligado**; Fiscal, Departamento Pessoal, Contábil, Comercial, Legalização e Radar de legislação **Desligados**, sem comportamento). Skills no formato das skills do Claude (`SKILL.md` com `name`, `description` e `tipo` + arquivos de referência), subidas por pasta, `.zip` ou `.md`, com versões (quem, quando, diferença), liga/desliga e teste; **Jeito de atuar e Limites** entram sempre no bloco estável (com cache); as outras só com nome e descrição, lidas pelas ferramentas `ler_skill` / `ler_referencia`, restritas às skills **ligadas do próprio agente**. Ordem: regras fixas › Limites › Jeito de atuar › Procedimentos › Orientações. Só o **dono** (`usuarios.dono`, marcado só por SQL) muda skills, ferramentas, estado, modelo e modo; orientações seguem "Treinar o agente" do setor do agente. "Treinar o agente" sai do menu e vira as abas **Orientações** e **Testar** (o endereço antigo redireciona). Menu ganha **Agentes** (robô, entre Assistente e Configurações). Custo por agente em `uso_ia` e o bloco **Por agente** em Gastos com IA.

**Nesta sub-etapa o único agente que atende é o Thiago, como "Ligado, mesma voz".** Estado (Desligado / Teste com lista de contatos / Ligado), modo de contato (Por trás / Mesma voz / Passa a conversa) e regras por assunto dos outros agentes são **guardados e editáveis**, mas **não mudam nada no atendimento**: o Thiago ainda não chama nenhum outro agente (isso é a I2). A ficha diz isso em todas as abas desses agentes.

**Arquitetura:**
- **Banco (3 migrações novas, só acréscimos):**
  - `20261014000100_painel_v2_agentes.sql`: `usuarios.dono` (+ gatilho que recusa mudança pela API, índice de um dono só, `marcar_dono_inicial()`, `eh_dono()`); `agentes`, `agente_contatos_teste`, `agente_regras_assunto`, `agente_mudancas`; `restaurar_agentes_iniciais()` (as 7 linhas, Thiago com id fixo); `ferramentas_do_catalogo()` / `ferramentas_do_atendimento()`; `salvar_agente`, `definir_contatos_teste`, `salvar_regra_assunto`, `excluir_regra_assunto`, `criar_agente` (só o dono); `orientacoes_agente.agente_id` (padrão: o Thiago) com `pode_treinar_agente()` e `salvar_orientacao_agente`; `simulacoes_agente.agente_id`; `uso_ia.agente_id`.
  - `20261014000200_painel_v2_agente_skills.sql`: `agente_skills`, `agente_skill_versoes`, `agente_skill_arquivos`; `subir_skill`, `alternar_skill`, `restaurar_versao_skill`, `arquivar_skill` (só o dono); `skills_do_agente`, `referencia_da_skill` (só o trabalhador); `simulacoes_agente.skill_id` e `criar_simulacao_skill`.
  - `20261014000300_painel_v2_agentes_leituras.sql`: `agentes_numeros`, `atividade_do_agente`, `uso_skills` (dono e administrador) e `gastos_por_agente` (administrador).
  - pgTAP novos `45`, `46`, `47`; `tipos.gen.ts` regerado.
- **Core (`@escritorio/core`, `agentes.ts`):** id e slug do Thiago, estados, modos, tipos de skill, catálogo de ferramentas com efeito (leitura / grava / envia), leitura do `SKILL.md`, montagem do pacote de skill, diferença linha a linha, endereço a partir do nome.
- **Repositório (`@escritorio/db`):** `perfilDoAgente`, `referenciaDaSkill`, `orientacoesAtivas(agenteId?)`, `registrarUsoIa` com `agenteId`; `limparBanco` volta os agentes às sementes; `marcarDonoTeste`.
- **Trabalhador ("pronto para trocar", nunca ligado):** `agente/perfil.ts` (perfil do banco ou o padrão do código), `agente/skills.ts` (seções do prompt e ferramentas de skill), `executar.ts` (pedido montado pelo perfil: modelo, ferramentas, `agente_id` no custo), `prompt.ts` (seção de skills entre RESPOSTAS PRONTAS e ORIENTAÇÕES; vazia = texto de hoje), `contexto.ts`, `ferramentas.ts` (`ler_skill`, `ler_referencia`), `simular.ts` (teste com uma skill, mesmo desligada), 2 cenários `motor:` com Claude de verdade.
- **Painel:** `lib/agentes.ts` (leituras com volta sem migração), `lib/agentes-acoes.ts`, `lib/pacote-skill.ts`, `lib/skills-acoes.ts`; telas em `app/(painel)/agentes/…`; a tela do Treinar o agente vira o componente `treinar-agente/tela-orientacoes.tsx` usado pela aba Orientações; `/treinar-agente` redireciona; menu, trilha e menu recolhido; bloco "Por agente" em Gastos com IA.

**Tecnologias:** Next.js 15 (App Router, server components, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (Postgres 17, RLS), pg-boss, Anthropic SDK, Vitest, pgTAP, Playwright e @axe-core/playwright, `fflate` (novo, só no painel, para ler `.zip`).

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- **7E.1** (motor único; tipos Conversa/Trabalho; os 7 agentes iniciais; estados; "Quem mexe" com `usuarios.dono = true` **não editável pela tela**; menu Agentes e "Treinar o agente" virando as abas Orientações e Testar);
- **7E.2** inteira (cartões, filtros por estado e tipo, busca, + NOVO AGENTE, atalho para Gastos com IA, faixa "Só você altera…");
- **7E.3** inteira (cabeçalho com seletor de estado, Teste com lista de contatos, modelo, custo e uso do mês, Histórico, Testar agora; as 7 abas; skills por tipo com "quando o agente lê"; ordem de prioridade; formato `SKILL.md`; carregamento sob demanda; ferramentas com *só leitura* × *grava/envia*; os três modos e as regras por assunto; Atividade e custo). **Fica para depois:** "Scripts dentro de uma skill" e Agent Skills (7E.6, trabalho); o roteamento descrito em "O Thiago continua sendo quem recebe toda mensagem…" (I2);
- **7E.8** (custo por agente e agrupamento em Gastos com IA; skills e ferramentas só pelo dono, com auditoria de cada versão);
- **7E.9 item 1** (esta sub-etapa) e **7E.10** na parte da I1 ("Limites vencem orientação contrária"; "Teste que `ler_skill` só carrega skills ligadas do próprio agente"; "pgTAP: só `dono` altera skills/ferramentas/estado"; "Custos gravados por agente");
- dependências: **7C.5** (Treinar o agente: lista, editor, simulador, regras fixas, limites de teste e permissão `treinar_agente` não mudam), **7B.2** (`uso_ia`, funcionalidades, cache de prompt), **7D.2** (o acesso por contato continua valendo em todas as ferramentas; nada aqui muda as ferramentas do Thiago), **3.1**, **4.3** (ordem do menu), **4.6** (tom), **8** (grep antes de trocar rótulos; vermelho nunca sozinho).
- Imagens: `imagens/00-agentes-lista.png` e `imagens/00-agente-ficha.png` (**a implementar**; dados de exemplo; onde imagem e spec divergem, vale o spec e as decisões abaixo).

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt I" — **este plano é a sub-etapa 1**. Pontos que não podem falhar e que valem aqui: "**Um motor só; agente = registro de configuração. Nada de código duplicado por agente.**", "**Só o dono (usuarios.dono, definido no banco, não pela tela) altera skills, ferramentas, modo de contato, estado…**", "**Skills no formato das skills do Claude… Jeito de atuar e Limites sempre carregados; o resto só via ler_skill/ler_referencia. Ordem: regras fixas › Limites › Jeito de atuar › Procedimentos › Orientações.**", "**Cenários atuais do Thiago e do assistente continuam 100% depois da migração para o motor.**", "**Toda chamada grava custo por agente (Parte F).**" Ao terminar: suítes e cenários com resultado real, `--dry-run` antes de aplicar na homologação e esperar o ok, subir o painel desta branch numa porta livre, trabalhador entregue "pronto para trocar", não juntar nada. Leia também `analise-arquitetura.md` (Prompt 5: "Especialista = registro de configuração, não código copiado"; "Extrair do agente atual um runtime genérico… Agente Thiago e assistente continuam funcionando igual") e `roteiro-agentes-por-setor.md`. Estilo e convenções: `docs/superpowers/plans/2026-10-13-painel-v2-parte-h2-acesso-contato.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-i`, branch `painel-v2-parte-i`, a partir de `3bf3791` (Parte H pronta) ou do commit mais novo da branch. **Antes da Task 1, anote o SHA de partida:** `git rev-parse --short HEAD` → chamado de **BASE** abaixo. Todos os comandos rodam a partir da raiz da worktree. Confira `git diff etapa-1 -- docs/superpowers/specs/painel-v2`: se não sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso.

## Decisões tomadas (sem o dono)

O dono está fora e autorizou decidir (execução autônoma das partes C a I, sem juntar nem apagar dados). O controlador desta parte decidiu D11, D12 (parte), D26 e D27. Conferi no código o que o spec supõe:

- **O Thiago hoje** (`apps/trabalhador/src/agente/`): `prompt.ts` monta o sistema em até dois blocos — bloco 1 (com `cache_control`) = regras fixas + SETORES + RESPOSTAS PRONTAS + ORIENTAÇÕES gerais e de setor; bloco 2 = orientações da empresa em foco. `executar.ts` chama `d.ia.criar({ model: ctx.config.modeloConversa, max_tokens: 16000, system, tools: FERRAMENTAS, messages, output_config: { effort: 'medium' } })` (nesta ordem de chaves), no máximo 6 rodadas, e grava `uso_ia` com `funcionalidade: 'agente_clientes'`. `FERRAMENTAS` tem **16** ferramentas, nesta ordem: `selecionar_empresa, abrir_chamado, consultar_chamados, sinalizar_nao_entendido, passar_para_pessoa, buscar_parceiros, buscar_produtos, resumir_pedido_nota, abrir_pedido_nota, listar_documentos, enviar_documento, consultar_cadastro, consultar_preco, alterar_preco, cadastrar_produto, responder`. `simular.ts` (Treinar o agente) usa o mesmo `executarAgente` com um executor que finge gravações e um repositório que só libera leituras listadas.
- **Orientações** (`20260930000100`): `orientacoes_agente` sem dono de agente; `salvar_orientacao`, `alternar_orientacao`, `restaurar_orientacao`, `criar_simulacao` checam só `tem_permissao('treinar_agente')`. A tela `app/(painel)/treinar-agente/page.tsx` monta lista, editor e simulador; as ações (`acoes.ts`) aceitam só destinos `/treinar-agente…` (`destinoDaTela`) e voltam para `/treinar-agente…` (`comOrientacao`).
- **Custo** (`20261005000400`, `20261006000100`): `uso_ia.funcionalidade` tem uma regra de banco com 8 valores (inclusive `especialista_setor`, ainda sem uso); `packages/core/test/passagem.test.ts` compara `FUNCIONALIDADES_IA` com `toEqual` e `apps/trabalhador/test/gastos/caminhos.test.ts` confere `agente_clientes` no caminho do agente — **testes de partes anteriores, que não mudam**.
- **Testes que dependem de hoje:** `apps/painel/src/lib/menu.test.ts` (linhas 15, 30, 35 listam "Treinar o agente" no menu); `e2e/treinar-agente.spec.ts` (linhas 45 e 159 clicam no link "Treinar o agente" do menu; 140–143 esperam o link ausente e o texto de "sem acesso"); `e2e/ensinar-agente.spec.ts` (linhas 106, 112–113: link "Abrir na tela Treinar o agente" e URL `/treinar-agente?orientacao=<id>`); `e2e/apoio-treinar.ts` abre `/treinar-agente…` e espera `[data-treinar-hidratado]` e as regiões "Orientações", "Editor da orientação", "Simulador"; `e2e/acessibilidade.spec.ts:143-146,255,261,350` visita `/treinar-agente…`; `src/components/layout/trilha.test.ts:15` e `menu-tela-treinar.test.ts` conferem `/treinar-agente`.
- **`limparBanco`** (`packages/db/test/limpar.ts`) trunca `orientacoes_agente`, `simulacoes_agente`, `uso_ia`, `contatos` etc. com `cascade` e apaga `auth.users` dos testes; não conhece tabelas novas.
- **Cenários com Claude real:** `pnpm --filter @escritorio/trabalhador cenarios` (56: 48 + 8 `acesso:`), `cenarios-atendimento` (6), `cenarios-assistente` (4); rodam contra o Supabase local com `ANTHROPIC_API_KEY` do `.env`. Medido nas partes C, E e H2: os 56 custam US$ 11–15.
- **Homologação:** migrações F, G1–G3, H1 e H2 continuam pendentes (só `--dry-run`); as da I1 também ficarão. O trabalhador da porta 3001 é o teste do dono.

Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Por que não | Tasks |
|---|---|---|---|---|
| D1 | **Os 7 agentes iniciais**, criados pela migração por `restaurar_agentes_iniciais()`: `atendimento` **Thiago** ("porta de entrada no WhatsApp", sem setor, Conversa, **Ligado**, Mesma voz, as 16 ferramentas, `porta_de_entrada = true`, id fixo `a0000000-0000-4000-8000-000000000001`); `radar` Radar de legislação (sem setor, Trabalho); `fiscal` Agente Fiscal (Fiscal, Conversa + Trabalho); `contabil` Agente Contábil (Contábil, Trabalho); `pessoal` Departamento Pessoal (Pessoal, Conversa + Trabalho); `legalizacao` Agente de Legalização (Legalização, Conversa + Trabalho); `comercial` Agente Comercial (Comercial, Conversa). Os 6 últimos **Desligados**, sem modo ("a definir"), sem ferramentas. Setor pelo nome; setor que não existe no banco fica vazio. | Criar os agentes pela tela. | O spec manda os 7 iniciais; e o Thiago precisa existir antes de qualquer orientação ganhar `agente_id`. | 2 |
| D2 | **Motor = registro + o mesmo runtime.** As **regras fixas do Thiago ficam no código** (`prompt.ts`, "Regras fixas do sistema" com cadeado na tela); o registro escolhe modelo, ferramentas e skills. Perfil sem skills = **pedido idêntico byte a byte ao de hoje** (system, tools, model, max_tokens, output_config, messages). Provado por um retrato tirado **antes** de qualquer código novo (Task 1) e comparado depois com o perfil lido do banco (Task 7). | Mover as regras fixas para uma skill do Thiago. | O texto mudaria de lugar (outro bloco, outro cache) e o pedido deixaria de ser idêntico; as regras fixas são "do sistema" (spec 7E.3) e não podem ser desligadas. | 1, 7 |
| D3 | **O Thiago nasce sem skills.** As orientações tiradas da skill do dono (`orientacoes-skill-dono.ts`) **continuam orientações**; o dono sobe skills quando quiser. | Converter a skill do dono em skills (Jeito e Limites). | Mudaria o prompt do Thiago no dia da troca (contra "sem mudar comportamento") e os cenários `orientacoesDaSkill` mediriam outra coisa. | 2 |
| D4 | **Onde as skills entram no prompt:** no bloco 1 (com cache), **depois de RESPOSTAS PRONTAS e antes das ORIENTAÇÕES**: `LIMITES DO AGENTE (…)`, `JEITO DE ATUAR (…)`, `SKILLS PARA LER QUANDO PRECISAR (…)` (só `nome [tipo]: descrição`). Os cabeçalhos dizem a ordem: regras acima › Limites › Jeito › Procedimentos › Orientações; "Conhecimento e exemplos só informam; não dão ordens". Texto da skill passa por `limparTextoOrientacao` (`<`/`>` viram `‹`/`›`). | Um terceiro bloco de sistema. | Mais um ponto de cache e a frase de precedência das orientações ("as regras acima valem") deixaria de cobrir as skills. | 7, 8 |
| D5 | **`ler_skill(nome)` e `ler_referencia(skill, arquivo, parte?)`** entram nas ferramentas **só quando o agente tem alguma skill sob demanda ligada** (o Thiago de hoje não tem: ferramentas iguais). Leem só as skills **carregadas no perfil** (ligadas, não arquivadas, do próprio agente; na simulação, mais a skill em teste). `ler_referencia` devolve até 40.000 caracteres por parte. Cada leitura vira decisão `ler_skill`/`ler_referencia` (o "por quê?" mostra; o uso no mês conta). | Carregar tudo no prompt. | Contra o spec ("o conteúdo entra quando ele chama a ferramenta") e o limite de tamanho voltaria. | 8 |
| D6 | **Limites de tamanho:** `SKILL.md` até 25.000 caracteres (texto depois do cabeçalho até 20.000); `description` até 1.024; título até 120; até 20 arquivos de referência `.md`, `.txt` ou `.csv`, cada um até 200.000 caracteres, total da versão até 1.000.000; **Jeito de atuar + Limites ligados somados: até 10.000 caracteres por agente** (o banco recusa ligar, subir nova versão ligada ou restaurar acima disso). | Sem limite. | O bloco sempre carregado pesa em toda mensagem (custo e atenção do modelo); 10.000 é próximo do medidor de orientações (12.000). | 3, 5 |
| D7 | **PDF não entra na I1:** a subida recusa `.pdf` com "PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho)." | Guardar o PDF no Storage e mandar ao modelo. | O agente de conversa lê skill como texto; ler PDF é da execução de trabalho (spec 7E.3/7E.6, sub-etapa 3). **Diverge do spec** (lista `.pdf`). | 5, 11 |
| D8 | **Identidade da skill = `name` do cabeçalho** (só minúsculas, números e hífen, até 64 — o formato das skills do Claude). **Título mostrado** = o primeiro `# Título` do texto (senão o `name`). Subir de novo com o mesmo `name` no mesmo agente = **nova versão**. **Tipo:** o do cabeçalho (`tipo: jeito | limites | procedimento | conhecimento | exemplos`, aceita também "jeito de atuar", "procedimentos", "exemplo", com ou sem acento); sem tipo no cabeçalho, vale o escolhido na tela; sem nenhum dos dois, a tela pergunta. Cabeçalho vence a escolha da tela. Skill nova nasce **desligada** ("rascunho, nunca testada"). | Nome livre como identificador. | `ler_skill(nome)` precisa de um nome estável e sem espaços, igual ao das skills do Claude. | 3, 5, 11, 15 |
| D9 | **Versões:** cada subida e cada restauração gravam uma versão inteira (cabeçalho, texto e arquivos) com autor e data; a **diferença** é calculada na tela (linha a linha, `diferencaLinhas` do core) contra a versão anterior. Ligar, desligar e arquivar não criam versão: vão para "Últimas mudanças"/Histórico do agente. **Restaurar** = nova versão com o conteúdo antigo. **Arquivar** tira a skill da lista e do agente (as versões ficam). | Guardar só o texto atual com auditoria genérica. | O spec pede "versões (quem, quando, diferença)" e restaurar. | 3, 15 |
| D10 | **"Uso no mês" da skill** = quantas vezes o agente a leu (`ler_skill`) no mês; Jeito e Limites mostram "em toda conversa". "Barrou N vezes" (imagem) **não é mostrado**: não há como medir. Nesta etapa a contagem é pelo nome da skill (só o Thiago lê skills). | — | — | 4, 15 |
| D11 | **Dono (decisão do controlador):** coluna nova `usuarios.dono boolean not null default false`, com índice único (no máximo um dono). **Nenhum caminho da API muda a marcação** (gatilho: com `request.jwt.claims` preenchido — qualquer chamada do PostgREST, inclusive com a chave de serviço e dentro de funções `security definer` — recusa); só SQL direto (migração, editor do Supabase). A migração marca **exatamente uma pessoa — o administrador ativo mais antigo — quando ninguém é dono**, e avisa (`raise notice`) quem foi. O manual dá a linha de SQL para trocar. **Custo se errar:** a pessoa errada poderia mexer em skills e agentes até o dono rodar a linha. Funções e RLS checam `eh_dono()` em skills, ferramentas, estado, modelo, modo, regras, contatos em teste e criação de agente; **orientações** seguem `treinar_agente` do setor do agente (D12). | Marcar pela tela de usuários. | Contra o spec ("não editável pela tela") e a decisão do controlador. | 2, 18 |
| D12 | **Quem vê e quem mexe:** a tela Agentes e as fichas aparecem para **administrador, dono e quem tem "Treinar o agente: Sim"** (`pode_ver_agentes()`); os **números do mês e custos** só para **dono e administrador** (a imagem diz "Só dono e administrador"); **gravar** agentes, skills, ferramentas, regras e contatos em teste: **só o dono**. **Orientações:** do Thiago, quem tem "Treinar o agente" (como hoje); dos outros, quem tem "Treinar o agente" **e** é do setor do agente (ou administrador) — `pode_treinar_agente()` num gatilho de `orientacoes_agente`, que vale para salvar, ligar, desligar e restaurar. O menu mostra **Agentes** para administrador e "Treinar o agente: Sim" (o dono é administrador, D11). | Tela só para dono e administrador. | Quem treina o Thiago hoje (a permissão do G5) perderia a tela, já que "Treinar o agente" sai do menu. | 2, 4, 10, 12–16 |
| D13 | **O Thiago fica travado como "Ligado, mesma voz":** o banco recusa mudar o estado ("O Thiago fica sempre ligado: para parar o atendimento, use PAUSAR no Início."), o modo, o setor, a lista de teste, as regras por assunto e tirar qualquer uma das 16 ferramentas ("As ferramentas do atendimento são fixas nesta etapa."). A tela mostra "Fala com o cliente: **Direto, é a voz do escritório**" (texto da imagem) e o cadeado. O **modelo** do Thiago o dono pode escolher (vazio = o de Configurações, como hoje). | Deixar o dono desligar o Thiago pela ficha. | Desligar a porta de entrada deixaria clientes sem resposta, e já existe a pausa geral (`configuracoes.agente_pausado`, Início) com aviso à equipe. | 2, 14 |
| D14 | **Os outros agentes guardam, não agem:** estado (Teste exige ao menos 1 contato, até 20), modo, regras por assunto (até 30; assunto até 80, exemplo até 200), ferramentas, modelo, nome, descrição, setor e tipos são gravados e editáveis pelo dono; **nada disso muda o atendimento na I1**. Faixa em todas as abas desses agentes: "Nesta etapa só o Thiago atende. O que você configurar aqui fica guardado e passa a valer quando o Thiago começar a chamar os agentes dos setores (próxima etapa)." "Uso no mês" das regras mostra "—". | Esconder estado e modo até a I2. | O controlador pediu guardar e editar já; o dono configura antes de ligar. | 2, 14 |
| D15 | **Catálogo de ferramentas** no core (`CATALOGO_FERRAMENTAS`: rótulo, descrição, efeito `leitura` / `grava` / `envia`) e no banco (`ferramentas_do_catalogo()`, conferidos iguais por teste). Na I1 o catálogo = as 16 do Thiago (as do Fiscal da imagem — pasta no Drive, XML/PDF, planilha, sugerir correção — chegam com quem as usa). `ler_skill`/`ler_referencia` são **automáticas** (aparecem como "entram sozinhas quando há skill sob demanda"). Ferramenta que grava/envia aparece com cadeado e "exige aprovação humana"; **no Thiago** a linha diz "o cliente confirma no WhatsApp (regras fixas)", porque ele grava sem aprovação de uma pessoa a cada vez, como hoje. O executor recusa ferramenta conhecida que não está liberada no perfil (nunca acontece no Thiago). **Diverge do spec** ("Ferramentas que gravam/enviam exigem aprovação humana" vale para os agentes novos; a aprovação entra com as tarefas, sub-etapa 3). | Exigir aprovação também no Thiago. | Mudaria o comportamento (pedido de nota, preço, envio de documento) — contra o centro desta sub-etapa. | 2, 5, 7, 14 |
| D16 | **Custo por agente = coluna nova `uso_ia.agente_id`**, preenchida em toda chamada do motor (atendimento e teste). A `funcionalidade` **não muda**: o Thiago continua `agente_clientes`, o teste continua `testar_agente`; os agentes novos (I2 em diante) usarão `especialista_setor` (já está na lista). Registros antigos `agente_clientes`/`testar_agente` sem `agente_id` contam como do Thiago nas leituras (`agente_do_uso`). **Diverge do spec** (7E.8: "funcionalidade `agente_<slug>`"). | Funcionalidade `agente_<slug>`. | A regra do banco e dois testes congelados (`passagem.test.ts`, `caminhos.test.ts`) fixam a lista e o `agente_clientes`; um valor por agente criado pela tela exigiria mudar a regra do banco a cada agente novo. | 2, 4, 6, 7, 16 |
| D17 | **Gastos com IA ganha "Por agente"** (`gastos_por_agente`, só administrador, mesmo período da tela), entre "Por funcionalidade"/"Por dia" e "Quem mais gasta". Banco sem a migração: o bloco não aparece. | — | — | 4, 16 |
| D18 | **Atividade e custo** (dono e administrador): no período (padrão: este mês; mesmos filtros de Gastos com IA), por dia: atendimentos, resolvidos sozinho, passagens para pessoa, custo do atendimento e custo dos testes; com totais e % resolvido sozinho. "Atendimento" e "passou para pessoa" seguem a regra de `gastos_atendimentos_base` (Parte F). Tarefas: "—" (sub-etapa 3). | — | — | 4, 16 |
| D19 | **Menu:** "Agentes" (`Bot`) entra **no lugar** de "Treinar o agente" — Assistente · **Agentes** · Gastos com IA · Configurações — com a cor de módulo que era do Treinar (`text-modulo-treinar`, sem token novo). **`menu.test.ts` muda só nas linhas 15, 30 e 35** ("Treinar o agente" → "Agentes"): é o próprio spec mudando o menu (7E.1, 4.3) e é a única mudança em teste unitário de parte anterior. | Manter os dois itens. | Contra o spec ("Treinar o agente sai do menu"). | 12 |
| D20 | **Rotas:** `/agentes` (lista); `/agentes/<slug>` (Visão geral); `/agentes/<slug>/skills`, `/ferramentas`, `/como-fala`, `/orientacoes`, `/testar`, `/atividade`; um `layout.tsx` com cabeçalho e abas (links com `aria-current`). `/treinar-agente…` **redireciona** para `/agentes/atendimento/orientacoes…` com a mesma consulta. Menu **recolhido** em `/agentes/*/orientacoes` e `/agentes/*/testar` (três colunas, como o Treinar). | Abas por `?aba=`. | `menuRecolhido` só olha o caminho; e cada aba tem os próprios parâmetros (a de Orientações usa `?orientacao=`, `?ativo=`, `?q=`). | 12–16 |
| D21 | **Orientações = a tela do G5 inteira** (lista, editor e o simulador com o rascunho e "Sem o rascunho"), movida para o componente `TelaOrientacoes` com o endereço-base como parâmetro; **Testar** = o simulador sem rascunho, com "Testar com a skill…" (o dono escolhe uma skill do Thiago, mesmo desligada). **Outros agentes:** Orientações lista e edita só as deles (`salvar_orientacao_agente`), sem simulador ("O teste deste agente chega quando ele começar a atender."); Testar mostra o mesmo aviso. As ações de hoje (`acoes.ts`) passam a aceitar o destino `/agentes/<slug>/orientacoes…` e só usam a função nova quando o agente não é o Thiago. | Separar lista/editor (Orientações) e simulador (Testar) já. | O "Sem o rascunho" precisa do rascunho do editor ao lado; separar exigiria reescrever o G5, e o controlador pediu reaproveitar. | 12, 16 |
| D22 | **E2e antigos adaptados — só estas linhas:** `treinar-agente.spec.ts:45` e `:159` (o clique no menu "Treinar o agente" vira "Agentes" → "Abrir Thiago" → aba "Orientações"); `ensinar-agente.spec.ts:106`, `:112` (nome do link vira "Abrir nas orientações do Thiago") e `:113` (URL `/agentes/atendimento/orientacoes?orientacao=<id>`). Todo o resto (inclusive `apoio-treinar.ts`, as regiões, `[data-treinar-hidratado]`, o heading "Treinar o agente", a tela "Você não tem acesso a esta tela." com o mesmo texto, e as rotas `/treinar-agente…` de `acessibilidade.spec.ts`, que redirecionam) fica igual. | Manter o link do menu. | Contra o spec. | 12, 17 |
| D23 | **Homologação sem a migração** (o painel é ligado lá antes do `db push`): toda leitura nova percebe o código (`42P01`, `42703`, `42883`, `PGRST200/202/204/205`). `/agentes` mostra só o cartão do Thiago (dados do código) e a faixa "Os agentes aparecem quando a atualização do banco da Parte I for aplicada."; na ficha do Thiago, **Orientações e Testar funcionam como hoje** (sem filtro por agente) e as outras abas mostram a faixa; Gastos sem "Por agente". **Sempre leitura GET ou `rpc`, nunca contagem `head`.** O trabalhador também tem volta (perfil padrão do código, sem `agente_id` no custo), mas é entregue para trocar **depois** das migrações (D30). | Exigir a migração. | O painel desta branch quebraria a tela do Treinar o agente na homologação. | 6, 7, 10, 12–16 |
| D24 | **`limparBanco`** também esvazia as tabelas novas dos agentes e chama `restaurar_agentes_iniciais()` (os 7 voltam às sementes, apaga agentes criados por teste), para cada teste e cenário começar do mesmo Thiago. `marcarDonoTeste(usuarioId)` (pelo `pg`, só banco local) marca o dono nos testes — a API não consegue (D11). | — | — | 6, 17 |
| D25 | **+ NOVO AGENTE** (só o dono): nome, setor, tipos e descrição; o endereço (`slug`) sai do nome (`slugDoNome`, até 40); nasce Desligado, sem modo, sem ferramentas e sem skills. Endereço repetido: "Já existe um agente com este endereço: mude o nome." | Deixar para a I6. | O spec põe o botão na tela (7E.2) e a I6 é "só configuração". | 2, 13 |
| D26 | **Fora da I1 (decisão do controlador):** Drive, tarefas de trabalho, Pedir ao agente e Radar. Onde a imagem pede, só **marcadores desligados e rotulados**: nos cartões de agentes do tipo Trabalho, a linha tracejada "Tarefas de trabalho: chegam numa próxima etapa"; no cartão do Radar, "Novidades da legislação: chegam na etapa do Radar". Nada clicável. | — | — | 13 |
| D27 | **Reaproveitar o G5** (decisão do controlador): `lista-orientacoes.tsx`, `editor-orientacao.tsx`, `historico-tabela.tsx`, `simulador.tsx`, `acoes.ts`, `simulacao.ts` continuam os mesmos arquivos; mudam só o endereço-base (parâmetro novo, padrão `/treinar-agente`), a escolha da função do banco para os outros agentes e o pedido de teste com skill. | — | — | 12, 16 |
| D28 | **Histórico do agente** (`agente_mudancas`): toda função do dono grava uma frase ("Estado: Desligado → Teste", "Skill Tabela CFOP: versão 2", "Regra "Dúvida sobre imposto": Passa a conversa"). "Últimas mudanças" (5) na coluna da aba Skills e na Visão geral; **HISTÓRICO** abre a lista inteira (até 200) num painel lateral. | Auditoria genérica (`auditoria_acessos`). | Ela guarda linhas, não frases; o dono quer ler "o que mudou". | 2, 3, 14 |
| D29 | **Modelo por agente:** lista com "Padrão de Configurações (<modelo_conversa>)" + os modelos que têm preço em `configuracoes.precos_modelos`; o banco recusa modelo sem preço ("Modelo sem preço em Configurações › Teto e modelos de IA."). | Campo livre. | Modelo sem preço gravaria custo zero e furaria o teto. | 2, 14 |
| D30 | **Trabalhador entregue "pronto para trocar"**; só trocar **depois** de aplicar as migrações F–I1. Nenhum trabalhador é ligado nem desligado. | Ligar um segundo trabalhador. | Dois trabalhadores no mesmo banco dividem a fila e os dois responderiam. | Entrega |
| D31 | **Cenários com Claude real:** 2 novos (`motor:` — Limites vencem orientação contrária; procedimento sob demanda lido quando o assunto aparece) na Task 9; na Entrega, **todos**: `cenarios` (56 + 2 = 58), `cenarios-atendimento` (6) e `cenarios-assistente` (4: o repositório e o custo mudaram para todos). Custo estimado: Task 9 ≈ US$ 0,50–1 (com uma segunda rodada); Entrega ≈ US$ 14–19. **Teto: US$ 30** na parte; passou, parar e listar como pendência. | Rodar só os novos. | O motor muda o caminho de todo pedido do Thiago; só a suíte inteira prova "cenários atuais 100%". | 9, Entrega |

## Restrições globais

- **Só mexer em:** `supabase/migrations` (três arquivos **novos**), `supabase/tests` (três arquivos **novos**: `45`, `46`, `47`), `packages/core/src/{agentes,index}.ts` e `packages/core/test/agentes.test.ts` (novo), `packages/db/src/repos.ts` (métodos novos; **`OrientacaoAgente`, `EmpresaDoContato`, `ContatoEncontrado` não mudam**), `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão), `packages/db/test/limpar.ts` (D24), `packages/db/test/agentes.test.ts` (novo), `apps/trabalhador/src/agente/{perfil,skills}.ts` (novos), `apps/trabalhador/src/agente/{executar,prompt,contexto,ferramentas,simular}.ts`, `apps/trabalhador/src/cenarios/{cenarios,rodar}.ts`, `apps/trabalhador/test/apoio/{cenario,retrato}.ts` e testes **novos** do trabalhador (com a pasta `test/agente/__retratos__/`), `apps/painel` (lib, `app/(painel)/agentes/**`, `app/(painel)/treinar-agente/**`, `app/(painel)/gastos-ia/**`, `app/(painel)/atendimento/[id]/ensinar-agente.tsx`, layout/menu/trilha, e2e, `package.json` com `fflate`), `pnpm-lock.yaml` (só o `fflate`), `docs/design-system.md`, `docs/operacao.md`. **Nada em `apps/trabalhador/src/assistente` nem em `apps/trabalhador/src/sugestao`** (prova na Entrega).
- **Testes de partes anteriores não mudam:** nenhum pgTAP existente (`supabase/tests/**` de `01` a `44`), nenhum `*.test.ts` existente **exceto as três linhas de `apps/painel/src/lib/menu.test.ts` (D19)**. **E2e existentes:** só as linhas listadas em D22. Nenhuma conferência no banco desses arquivos muda.
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` continua 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio (ele fixa a lista do `supabase_realtime`: **nada é publicado** nesta parte). Nunca use `usuario_liberado` em código novo fora de `eh_dono_de` (é só do `service_role`); use `eh_usuario_ativo`, `eh_admin`, `tem_permissao`, `eh_dono`.
- **O pedido do Thiago não muda:** `git diff BASE -- apps/trabalhador/test/agente/__retratos__` só mostra os arquivos criados na Task 1; nenhuma task depois dela regrava um retrato. Se um retrato precisar mudar, **pare**: é mudança de comportamento.
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`). Para o `next dev` das capturas, acrescente `ACESSOS_PORTAIS_CHAVE=` com uma chave gerada na hora (comando do `.env.example`); ela some quando o `.env` volta da cópia.
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os e2e e os cenários deixam no banco quebram os pgTAP antigos.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts`.
- **A máquina tem pouca memória:** e2e sempre em **lotes de até 4 arquivos**. **Nunca rode a suíte e2e inteira de uma vez.** Um agente de cada vez (nada de subagentes em paralelo). Nunca rode o painel de teste do dono, o `next dev` desta parte, os cenários e os e2e ao mesmo tempo.
- **Portas 3001 a 3010 são do dono:** nenhum servidor desta parte usa essas portas; os e2e usam a 3100 (padrão do `playwright.config.ts`), as capturas a **3107**, o painel para o dono a primeira livre a partir da **3018**.
- **E2e e cenários só contra o banco local:** `apps/painel/e2e/trava-local.ts` e `limparBanco` recusam outro banco. **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`** (só leitura, na Entrega).
- **Cenários com Claude real gastam dinheiro:** rode só os comandos indicados (Task 9 e Entrega), um de cada vez, e anote a soma de `uso_ia.custo_usd` do banco local depois de cada rodada (`select round(sum(custo_usd), 2) from uso_ia`). Teto D31.
- **Nenhum trabalhador é ligado nem desligado nesta parte.** O da porta **3001 é o teste do dono: não desligue nem mate esse processo.** O desta branch é entregue "pronto para trocar" (D30).
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "Treinar o agente" (heading da lista, rótulo do módulo de permissão, trilha de `/treinar-agente`), "Você não tem acesso a esta tela.", o texto "Quem libera é o administrador: na tela Usuários, ele escolhe "Sim" em "Treinar o agente" no seu cadastro.", "Nova orientação", "Salvar desligada", "Salvar e ligar", "Orientações", "Editor da orientação", "Simulador", "Sem o rascunho", `data-treinar-hidratado`, "Gastos com IA", "Configurações", "Assistente".
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[220px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind. `escala.test.ts` e `tokens.test.ts` continuam passando. Ícones só com `size={12|14|16|20}` (no menu, 18, como os outros itens).
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`). Vermelho nunca sozinho; o cadeado sempre com texto ("só o dono", "aprovação").
- **Termos:** Agente, Skill, Ferramenta, Orientação, Demanda, Setor, Contato; estados "Desligado", "Teste", "Ligado"; modos "Por trás", "Mesma voz", "Passa a conversa"; tipos de skill "Jeito de atuar", "Limites", "Procedimentos", "Conhecimento", "Exemplos".
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Thiago mudou sem ninguém ver:** o pedido ao Claude (texto do sistema, ferramentas, modelo, ordem das chaves, mensagens) igual ao retrato de antes, lido com o perfil **do banco** e com o perfil **padrão** (banco sem a migração). Tasks 1 e 7.
2. **Skill alheia ou desligada no prompt:** `ler_skill` de outro agente, de skill desligada ou arquivada → "não encontrada"; `ler_referencia` de arquivo que não é da skill → recusa; skill em teste só entra na simulação de quem pediu. Tasks 3 (pgTAP sobre `skills_do_agente`/`referencia_da_skill`) e 8.
3. **Alguém além do dono mexendo:** administrador não-dono, atendente com "Treinar o agente" e a própria chave de serviço tentando mudar `dono`, estado, ferramentas ou skills → recusa; orientação de outro setor → recusa (inclusive ligar/desligar/restaurar). Tasks 2, 3 e 10/11 (as ações repetem a recusa do banco sem quebrar a tela).
4. **Pacote de skill estranho:** sem cabeçalho, `name` com espaço, tipo desconhecido, `.zip` com pasta raiz, `__MACOSX`, PDF, arquivo binário, caminho com `..`, tamanho acima dos limites, Jeito+Limites ligados passando de 10.000 → mensagem clara, nada gravado pela metade. Tasks 3, 5 e 11.
5. **Homologação sem as migrações:** `/agentes`, a ficha do Thiago (Orientações e Testar funcionando), `/treinar-agente` redirecionando e Gastos com IA abrem sem erro; o trabalhador com o perfil padrão grava custo sem `agente_id`. Tasks 7, 10, 12 e 16.
6. **Custo no agente errado:** chamada do atendimento e do teste gravam `agente_id` do Thiago; registros antigos contam para o Thiago; `especialista_setor` com `agente_id` do Fiscal vai para o Fiscal. Tasks 4 e 7.

---

## Mapa de arquivos

`ag/…` = `apps/painel/src/app/(painel)/agentes/`; `tr/…` = `apps/painel/src/app/(painel)/treinar-agente/`.

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `apps/trabalhador/test/apoio/retrato.ts`, `test/agente/retrato-thiago.test.ts`, `test/agente/__retratos__/*.json` (novos) | retrato do pedido do Thiago antes do motor | 1 |
| `supabase/migrations/20261014000100_painel_v2_agentes.sql`, `supabase/tests/45_painel_v2_agentes.test.sql` (novos), `tipos.gen.ts` | dono, agentes, sementes, funções do dono, orientações por agente, `agente_id` no custo e no teste | 2 |
| `supabase/migrations/20261014000200_painel_v2_agente_skills.sql`, `supabase/tests/46_painel_v2_agente_skills.test.sql` (novos), `tipos.gen.ts` | skills, versões, arquivos, leitura do trabalhador, teste de skill | 3 |
| `supabase/migrations/20261014000300_painel_v2_agentes_leituras.sql`, `supabase/tests/47_painel_v2_agentes_leituras.test.sql` (novos), `tipos.gen.ts` | números do mês, atividade, uso de skills, gastos por agente | 4 |
| `packages/core/src/agentes.ts`, `packages/core/src/index.ts`, `packages/core/test/agentes.test.ts` (novo) | constantes, catálogo, `SKILL.md`, pacote, diferença, endereço | 5 |
| `packages/db/src/repos.ts`, `packages/db/test/limpar.ts`, `packages/db/test/agentes.test.ts` (novo) | perfil, referência, orientações e custo por agente; limpeza e dono nos testes | 6 |
| `apps/trabalhador/src/agente/perfil.ts`, `skills.ts` (novos), `executar.ts`, `prompt.ts`, `contexto.ts`, `simular.ts`; `test/agente/motor-thiago.test.ts`, `test/agente/motor.test.ts` (novos) | o motor e a prova de igualdade | 7 |
| `apps/trabalhador/src/agente/skills.ts`, `ferramentas.ts`, `simular.ts`; `test/apoio/cenario.ts`; `test/agente/ler-skill.test.ts` (novo) | skills sob demanda, `ler_skill`/`ler_referencia`, teste de skill | 8 |
| `apps/trabalhador/src/cenarios/cenarios.ts`, `rodar.ts` | 2 cenários `motor:` | 9 |
| `apps/painel/src/lib/agentes.ts`, `agentes.test.ts`, `agentes-acoes.ts`, `agentes-acoes.test.ts` (novos) | leituras (com volta sem migração), acesso e ações | 10 |
| `apps/painel/src/lib/pacote-skill.ts`, `pacote-skill.test.ts`, `skills-acoes.ts`, `skills-acoes.test.ts` (novos), `apps/painel/package.json` | arquivos da subida (pasta, `.zip`, `.md`) e ações de skill | 11 |
| `apps/painel/src/lib/menu.ts`, `menu.test.ts` (3 linhas), `components/layout/{sidebar.tsx,trilha.ts,menu-tela.ts}`, `components/layout/menu-tela-agentes.test.ts` (novo), `tr/page.tsx` (redireciona), `tr/tela-orientacoes.tsx` (novo, corpo da página de hoje), `tr/lista-orientacoes.tsx`, `tr/acoes.ts`, `tr/esquemas.ts`, `tr/esquemas-agente.test.ts` (novo), `ag/[slug]/orientacoes/page.tsx` (novo), `atendimento/[id]/ensinar-agente.tsx`, `configuracoes/acoes.ts` | menu, rotas, redirecionamento e a tela do G5 com endereço-base | 12 |
| `ag/page.tsx`, `ag/cartao-agente.tsx`, `ag/filtros-agentes.tsx`, `ag/novo-agente.tsx`, `ag/lista.ts`, `ag/lista.test.ts` (novos) | tela Agentes | 13 |
| `ag/[slug]/ficha.ts`, `ag/[slug]/ficha.test.ts`, `ag/[slug]/layout.tsx`, `ag/[slug]/cabecalho-agente.tsx`, `ag/[slug]/abas-agente.tsx`, `ag/[slug]/faixas.tsx`, `ag/[slug]/historico-agente.tsx`, `ag/[slug]/coluna-lateral.tsx`, `ag/[slug]/page.tsx`, `ag/[slug]/ferramentas/page.tsx`, `ag/[slug]/ferramentas/escolher-ferramentas.tsx`, `ag/[slug]/como-fala/page.tsx`, `ag/[slug]/como-fala/modo-contato.tsx`, `ag/[slug]/como-fala/regras-assunto.tsx` (novos) | ficha: cabeçalho, Visão geral, Ferramentas, Como fala | 14 |
| `ag/[slug]/skills/page.tsx`, `lista-skills.tsx`, `subir-skill.tsx`, `versoes-skill.tsx`, `uso.ts`, `uso.test.ts` (novos) | aba Skills | 15 |
| `ag/[slug]/testar/page.tsx`, `ag/[slug]/testar/testar-skill.tsx`, `ag/[slug]/atividade/page.tsx`, `ag/[slug]/atividade/resumo.ts`, `ag/[slug]/atividade/resumo.test.ts` (novos), `tr/simulador.tsx`, `tr/simulacao.ts`, `tr/acoes.ts`, `gastos-ia/page.tsx`, `gastos-ia/por-agente.tsx` (novo) | Orientações, Testar, Atividade e custo, Gastos por agente | 16 |
| `apps/painel/e2e/apoio-agentes.ts`, `e2e/agentes-lista.spec.ts`, `e2e/agente-ficha.spec.ts`, `e2e/agente-skills.spec.ts`, `e2e/agente-orientacoes.spec.ts` (novos); `e2e/treinar-agente.spec.ts`, `e2e/ensinar-agente.spec.ts` (D22) | e2e | 17 |
| `docs/design-system.md`, `docs/operacao.md` | manuais (inclui a linha de SQL do dono) | 18 |

---
### Task 1: Trabalhador. Retrato do pedido do Thiago antes do motor

**Files:**
- Create: `apps/trabalhador/test/apoio/retrato.ts`
- Create: `apps/trabalhador/test/agente/retrato-thiago.test.ts`
- Create (gerados pelo teste): `apps/trabalhador/test/agente/__retratos__/{contato-uma-empresa,orientacoes-geral-setor-empresa,numero-desconhecido,duas-empresas-com-direcao}.json`

**Interfaces:**
- Consumes: `executarAgente`, `montarConteudoUsuario`, `ExecutorFerramentas`, `IaRoteirizada` (de hoje, sem mudança).
- Produces: `CASOS_RETRATO: Record<string, () => ContextoAgente>` e `retratoDoPedido(ctx: ContextoAgente): Promise<string>` (o JSON do primeiro pedido à IA, com as chaves na ordem em que o código monta, e `\n` no fim). A Task 7 compara o pedido do motor com estes arquivos.

**Esta task vem antes de qualquer outra e não mexe em código de produção.** Os arquivos `.json` são a prova de "sem mudar comportamento" (D2): nenhuma task depois desta pode regravá-los.

- [ ] **Passo 0:** anote o BASE (`git rev-parse --short HEAD`). Esta task não precisa do banco.

- [ ] **Passo 1: o apoio do retrato**

`apps/trabalhador/test/apoio/retrato.ts`:

```ts
import type { Mensagem, Repos } from '@escritorio/db';
import type { ContextoAgente } from '../../src/agente/contexto';
import { executarAgente } from '../../src/agente/executar';
import type { ExecutorFerramentas } from '../../src/agente/ferramentas';
import { montarConteudoUsuario } from '../../src/agente/prompt';
import { IaRoteirizada, fim, usarFerramentas } from './ia-roteirizada';

// Parte I1 (D2): dados fixos — o retrato não pode depender do banco, do relógio nem de ids gerados.
const AGORA = new Date('2026-09-28T13:00:00Z');
const FISCAL = { id: '10000000-0000-4000-8000-000000000001', nome: 'Fiscal', descricao_assuntos: 'Notas fiscais, guias de impostos (DAS, DARF)' };
const PESSOAL = { id: '10000000-0000-4000-8000-000000000002', nome: 'Pessoal', descricao_assuntos: 'Folha de pagamento, férias, admissão' };
const DIRECAO = { id: '10000000-0000-4000-8000-000000000003', nome: 'Direção', descricao_assuntos: 'Reclamação séria, assunto sensível' };
const SOL = { id: '20000000-0000-4000-8000-000000000001', nome: 'Padaria Sol ME', podePedirNota: true, agentePausado: false };
const REDE = { id: '20000000-0000-4000-8000-000000000002', nome: 'Rede Bom Preço', podePedirNota: false, agentePausado: false };
const CONVERSA = {
  id: '30000000-0000-4000-8000-000000000001', telefone: '5531999990001', contato_id: '40000000-0000-4000-8000-000000000001',
  cliente_em_foco: SOL.id, estado: 'agente', atendente_id: null, aviso_lgpd_enviado_em: '2026-09-01T12:00:00Z', tentativas_nao_entendido: 0,
  criado_em: '2026-09-01T12:00:00Z', atualizado_em: '2026-09-01T12:00:00Z', aguardando_pessoa_desde: null, motivo_pessoa: null, concluida_em: null,
} as unknown as ContextoAgente['conversa'];
const CONFIG = {
  modeloConversa: 'claude-sonnet-5', precosModelos: {}, mensagens: {}, agentePausado: false, tetoIaUsd: 1000,
} as unknown as ContextoAgente['config'];

const orientacao = (id: string, extra: object) => ({
  id, titulo: `Título ${id}`, texto: `Texto ${id}.`, tipo: 'jeito' as const, clienteId: null, setorId: null, setorNome: null,
  atualizadoEm: new Date('2026-09-01T12:00:00Z'), ...extra,
});

function contexto(parcial: Partial<ContextoAgente>): ContextoAgente {
  return {
    conversa: CONVERSA, contato: { id: CONVERSA.contato_id!, nome: 'João', agentePausado: false, empresas: [SOL] }, empresaEmFoco: SOL,
    setores: [FISCAL, PESSOAL], respostasProntas: [], orientacoes: [], servicosContratados: ['Contabilidade completa'],
    noExpediente: true, config: CONFIG, agora: AGORA, ...parcial,
  };
}

/** Os quatro jeitos de o Thiago montar o pedido: empresa única, orientações dos três tipos, número desconhecido e Direção. */
export const CASOS_RETRATO: Record<string, () => ContextoAgente> = {
  'contato-uma-empresa': () => contexto({}),
  'orientacoes-geral-setor-empresa': () => contexto({
    respostasProntas: [{ pergunta: 'Qual o horário?', resposta: 'Das 8h às 18h.' }],
    orientacoes: [
      orientacao('G1', { titulo: 'Cumprimento', texto: 'Chame o cliente pelo primeiro nome.' }),
      orientacao('F1', { tipo: 'regra', setorId: FISCAL.id, setorNome: 'Fiscal', titulo: 'Notas', texto: 'Notas até as 16h.' }),
      orientacao('S1', { tipo: 'situacao', clienteId: SOL.id, titulo: 'Entrega', texto: 'A Padaria Sol entrega às terças.\nSó de manhã.' }),
      orientacao('R1', { clienteId: REDE.id, titulo: 'Outra empresa', texto: 'Não pode aparecer aqui.' }),
    ],
  }),
  'numero-desconhecido': () => contexto({
    conversa: { ...CONVERSA, contato_id: null, cliente_em_foco: null }, contato: null, empresaEmFoco: null, servicosContratados: [],
    noExpediente: false,
  }),
  'duas-empresas-com-direcao': () => contexto({
    contato: { id: CONVERSA.contato_id!, nome: 'João', agentePausado: false, empresas: [SOL, REDE] }, empresaEmFoco: null,
    setores: [FISCAL, PESSOAL, DIRECAO], servicosContratados: [],
  }),
};

const msg = (autor: string, conteudo: string, criado_em: string) =>
  ({ autor, conteudo, criado_em, tipo: 'texto', transcricao: null, arquivo_nome: null }) as unknown as Mensagem;
const HISTORICO = [msg('cliente', 'Bom dia', '2026-09-27T12:00:00Z'), msg('agente', 'Bom dia, João!', '2026-09-27T12:00:30Z')];
const NOVAS = [msg('cliente', 'Preciso da guia do DAS de setembro', '2026-09-28T12:59:00Z')];

/** O primeiro pedido que o agente manda à IA, como sai para a API (JSON com as chaves na ordem em que o código monta). */
export async function retratoDoPedido(ctx: ContextoAgente): Promise<string> {
  const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
  const repos = {
    registrarUsoIa: async () => {}, registrarDecisao: async () => {}, ultimasOrientacoesCortadas: async () => null,
    obterConversa: async () => ctx.conversa,
  } as unknown as Repos;
  // Sem banco: a ferramenta só marca que respondeu.
  const executor: ExecutorFerramentas = async (_d, estado) => { estado.respondeu = true; return { resultado: '{"enviado":true}', erro: false }; };
  await executarAgente({ repos, ia, envio: {} as never }, ctx, montarConteudoUsuario(ctx, HISTORICO, NOVAS, []), executor);
  return `${JSON.stringify(ia.recebidos[0], null, 2)}\n`;
}
```

- [ ] **Passo 2: o teste**

`apps/trabalhador/test/agente/retrato-thiago.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CASOS_RETRATO, retratoDoPedido } from '../apoio/retrato';

// Parte I1, Task 1 (D2): o pedido do Thiago tirado ANTES do motor. Nenhuma task depois desta regrava estes arquivos;
// o motor tem de produzir o mesmo pedido (motor-thiago.test.ts). Arquivo diferente = comportamento diferente.
describe('retrato do pedido do Thiago', () => {
  for (const [nome, ctx] of Object.entries(CASOS_RETRATO)) {
    it(nome, async () => {
      await expect(await retratoDoPedido(ctx())).toMatchFileSnapshot(`./__retratos__/${nome}.json`);
    });
  }

  it('o retrato tem o que se espera do Thiago (conferência de sanidade)', async () => {
    const pedido = JSON.parse(await retratoDoPedido(CASOS_RETRATO['contato-uma-empresa']!()));
    expect(Object.keys(pedido)).toEqual(['model', 'max_tokens', 'system', 'tools', 'messages', 'output_config']);
    expect(pedido.tools.map((t: { name: string }) => t.name)).toEqual([
      'selecionar_empresa', 'abrir_chamado', 'consultar_chamados', 'sinalizar_nao_entendido', 'passar_para_pessoa', 'buscar_parceiros',
      'buscar_produtos', 'resumir_pedido_nota', 'abrir_pedido_nota', 'listar_documentos', 'enviar_documento', 'consultar_cadastro',
      'consultar_preco', 'alterar_preco', 'cadastrar_produto', 'responder',
    ]);
    expect(pedido.system[0].text).toContain('Seu nome é Thiago.');
    expect(pedido.system[0].cache_control).toEqual({ type: 'ephemeral' });
  });
});
```

- [ ] **Passo 3: rodar (grava os retratos)**

Run: `export PATH="$HOME/bin:$PATH" && pnpm --filter @escritorio/trabalhador exec vitest run test/agente/retrato-thiago.test.ts`
Expected: `5 passed` e 4 arquivos novos em `test/agente/__retratos__/` (o Vitest diz "written").

- [ ] **Passo 4: rodar de novo (agora compara)**

Run: o mesmo comando.
Expected: `5 passed`, nada escrito. Confira à mão: `grep -c '"name"' apps/trabalhador/test/agente/__retratos__/contato-uma-empresa.json` → 16 ou mais (16 ferramentas + nomes de propriedade); `grep -n 'ORIENTAÇÕES PARA A EMPRESA Padaria Sol ME' apps/trabalhador/test/agente/__retratos__/orientacoes-geral-setor-empresa.json` acha o bloco 2; `grep -c 'Não pode aparecer aqui' …/orientacoes-geral-setor-empresa.json` → 0; `grep -n 'abra no setor Direção' …/duas-empresas-com-direcao.json` acha a linha.

- [ ] **Passo 5: commit**

```bash
git add apps/trabalhador/test/apoio/retrato.ts apps/trabalhador/test/agente/retrato-thiago.test.ts apps/trabalhador/test/agente/__retratos__
git commit -m "$(cat <<'EOF'
test(agente): retrato do pedido do Thiago antes do motor de agentes (4 casos, chaves na ordem de hoje)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Banco. Dono, agentes, sementes, orientações por agente e custo por agente

**Files:**
- Create: `supabase/migrations/20261014000100_painel_v2_agentes.sql`
- Create: `supabase/tests/45_painel_v2_agentes.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `usuarios`, `setores`, `contatos`, `configuracoes.precos_modelos`, `orientacoes_agente`, `simulacoes_agente`, `uso_ia`, `salvar_orientacao(...)`, `usuario_liberado`, `eh_admin`, `eh_usuario_ativo`, `tem_permissao(text, text)`, `meus_setores`.
- Produces:
  - `usuarios.dono boolean not null default false` (+ índice único `usuarios_um_dono`, gatilho `dono_so_por_sql`);
  - `eh_dono() → boolean` (authenticated), `eh_dono_de(uuid)` (service_role), `marcar_dono_inicial() → text` (só SQL);
  - tabelas `agentes`, `agente_contatos_teste`, `agente_regras_assunto`, `agente_mudancas` (leitura: `pode_ver_agentes()`; escrita só pelas funções);
  - `ferramentas_do_atendimento() → text[]`, `ferramentas_do_catalogo() → text[]` (authenticated, service_role);
  - `restaurar_agentes_iniciais() → void` (só SQL; `limparBanco` usa);
  - `pode_ver_agentes() → boolean`, `pode_treinar_agente(uuid) → boolean` (authenticated);
  - `salvar_agente(p_slug text, p_dados jsonb) → void` (chaves: `nome, descricao, setor_id, tipos, estado, modelo, modo_contato, ferramentas`), `definir_contatos_teste(p_slug text, p_contatos uuid[]) → void`, `salvar_regra_assunto(p_slug text, p_id uuid, p_assunto text, p_exemplo text, p_modo text) → uuid`, `excluir_regra_assunto(p_id uuid) → void`, `criar_agente(p_dados jsonb) → text` (chaves: `slug, nome, setor_id, tipos, descricao`; devolve o slug) — todas só do dono;
  - `orientacoes_agente.agente_id uuid not null` (padrão: o Thiago, ou o de `app.agente_orientacao`), gatilho `agente_certo` (`pode_treinar_agente`), `salvar_orientacao_agente(p_slug text, p_id uuid, p_titulo text, p_texto text, p_tipo text, p_cliente_id uuid default null, p_setor_id uuid default null, p_ativo boolean default null) → uuid`;
  - `simulacoes_agente.agente_id uuid not null` (padrão: o Thiago); `uso_ia.agente_id uuid null`.

- [ ] **Passo 0: banco local nas portas 563xx** (Restrições globais, itens 1–4) e `supabase db reset`.

- [ ] **Passo 1: escrever o pgTAP que falha**

`supabase/tests/45_painel_v2_agentes.test.sql`:

```sql
-- Parte I1, Task 2 (spec 7E.1, 7E.3, 7E.8; D1, D11–D16, D25, D28): só o dono muda os agentes; a marcação de dono só muda
-- por SQL; os 7 agentes iniciais; o Thiago travado como "Ligado, mesma voz"; orientações pelo setor do agente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(44);

update public.usuarios set dono = false where dono;   -- outro teste ou e2e pode ter deixado um dono
insert into auth.users (id, email) values
  ('f5000000-0000-0000-0000-00000000000a', 'antigo@i1a.local'), ('f5000000-0000-0000-0000-00000000000b', 'novo@i1a.local'),
  ('f5000000-0000-0000-0000-00000000000c', 'ana@i1a.local'), ('f5000000-0000-0000-0000-00000000000d', 'ze@i1a.local'),
  ('f5000000-0000-0000-0000-00000000000e', 'paula@i1a.local'), ('f5000000-0000-0000-0000-00000000000f', 'intruso@i1a.local');
insert into public.usuarios (id, nome, email, papel, permissoes, criado_em) values
  ('f5000000-0000-0000-0000-00000000000a', 'I1 Admin Antigo', 'antigo@i1a.local', 'admin', '{}', '2000-01-01'),
  ('f5000000-0000-0000-0000-00000000000b', 'I1 Admin Novo', 'novo@i1a.local', 'admin', '{}', '2000-06-01'),
  ('f5000000-0000-0000-0000-00000000000c', 'I1 Ana', 'ana@i1a.local', 'atendente', '{treinar_agente}', now()),
  ('f5000000-0000-0000-0000-00000000000d', 'I1 Zé', 'ze@i1a.local', 'atendente', '{}', now()),
  ('f5000000-0000-0000-0000-00000000000e', 'I1 Paula', 'paula@i1a.local', 'atendente', '{treinar_agente}', now());
insert into public.usuario_setores (usuario_id, setor_id) values
  ('f5000000-0000-0000-0000-00000000000c', (select id from public.setores where nome = 'Fiscal')),
  ('f5000000-0000-0000-0000-00000000000e', (select id from public.setores where nome = 'Pessoal'));
insert into public.contatos (id, nome, telefone) values
  ('f5100000-0000-0000-0000-00000000000a', 'I1 Carla', '5531977770001'),
  ('f5100000-0000-0000-0000-00000000000b', 'I1 Arquivado', '5531977770002');
update public.contatos set ativo = false where id = 'f5100000-0000-0000-0000-00000000000b';

-- 1–5: a marcação de dono
select has_column('public', 'usuarios', 'dono', 'usuarios.dono existe');
select is(public.marcar_dono_inicial(), 'I1 Admin Antigo', 'sem dono, marca o administrador ativo mais antigo');
select is((select count(*)::int from public.usuarios where dono), 1, 'um dono só');
select is(public.marcar_dono_inicial(), null::text, 'com dono, não marca outro');
select throws_ok($$ update public.usuarios set dono = true where id = 'f5000000-0000-0000-0000-00000000000b' $$,
  '23505', null, 'dois donos: o índice recusa');

-- 6–7: pela API (qualquer papel, inclusive o de serviço) a marcação não muda
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select throws_ok($$ update public.usuarios set dono = false where id = 'f5000000-0000-0000-0000-00000000000a' $$,
  'P0001', 'A marcação de dono só muda direto no banco (SQL).', 'a chave de serviço não desmarca o dono');
select throws_ok($$ insert into public.usuarios (id, nome, email, papel, dono) values
  ('f5000000-0000-0000-0000-00000000000f', 'I1 Intruso', 'intruso@i1a.local', 'admin', true) $$,
  'P0001', 'A marcação de dono só muda direto no banco (SQL).', 'ninguém nasce dono pela API');
select set_config('request.jwt.claims', '', true);

-- 8–14: os 7 agentes iniciais (D1)
select is((select count(*)::int from public.agentes), 7, '7 agentes iniciais');
select results_eq($$ select slug from public.agentes order by ordem $$,
  $$ values ('atendimento'), ('radar'), ('fiscal'), ('contabil'), ('pessoal'), ('legalizacao'), ('comercial') $$, 'na ordem da tela');
select is((select (id, nome, estado, modo_contato, porta_de_entrada, setor_id is null)::text from public.agentes where slug = 'atendimento'),
  '(a0000000-0000-4000-8000-000000000001,Thiago,ligado,mesma_voz,t,t)', 'o Thiago: id fixo, Ligado, mesma voz, porta de entrada, sem setor');
select is((select array(select unnest(ferramentas) order by 1) from public.agentes where slug = 'atendimento'),
  array(select unnest(public.ferramentas_do_catalogo()) order by 1), 'o Thiago tem as 16 ferramentas');
select ok((select bool_and(estado = 'desligado' and modo_contato is null and ferramentas = '{}' and not porta_de_entrada)
  from public.agentes where slug <> 'atendimento'), 'os outros 6 desligados, sem modo e sem ferramentas');
select is((select setor_id from public.agentes where slug = 'fiscal'), (select id from public.setores where nome = 'Fiscal'), 'Fiscal no setor Fiscal');
insert into public.orientacoes_agente (titulo, texto, tipo) values ('I1 Antiga', 'Orientação de antes.', 'jeito');
select is((select agente_id from public.orientacoes_agente where titulo = 'I1 Antiga'), 'a0000000-0000-4000-8000-000000000001'::uuid,
  'orientação sem agente é do Thiago (como todas as de hoje)');

-- 15–33: o dono
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select ok(public.eh_dono(), 'o administrador mais antigo é o dono');
select lives_ok($$ select public.salvar_agente('fiscal', '{"modo_contato":"mesma_voz","ferramentas":["consultar_chamados","responder"]}') $$,
  'o dono escolhe modo e ferramentas do Fiscal');
select throws_ok($$ select public.salvar_agente('fiscal', '{"estado":"teste"}') $$,
  'P0001', 'Em teste, escolha pelo menos um contato.', 'Teste sem contato não passa');
select lives_ok($$ select public.definir_contatos_teste('fiscal', array['f5100000-0000-0000-0000-00000000000a']::uuid[]) $$, 'escolhe a Carla');
select lives_ok($$ select public.salvar_agente('fiscal', '{"estado":"teste"}') $$, 'agora fica em Teste');
select throws_ok($$ select public.definir_contatos_teste('fiscal', '{}') $$,
  'P0001', 'Em teste, escolha pelo menos um contato (ou desligue o agente).', 'não esvazia a lista em Teste');
select throws_ok($$ select public.definir_contatos_teste('fiscal', array['f5100000-0000-0000-0000-00000000000b']::uuid[]) $$,
  'P0001', 'Contato não encontrado ou arquivado.', 'contato arquivado não entra');
select throws_ok($$ select public.salvar_agente('atendimento', '{"estado":"desligado"}') $$,
  'P0001', 'O Thiago fica sempre ligado: para parar o atendimento, use PAUSAR no Início.', 'o Thiago não desliga (D13)');
select throws_ok($$ select public.salvar_agente('atendimento', '{"modo_contato":"por_tras"}') $$,
  'P0001', 'O Thiago é a voz do escritório: o modo dele não muda.', 'nem muda de modo');
select throws_ok($$ select public.salvar_agente('atendimento', '{"ferramentas":["responder"]}') $$,
  'P0001', 'As ferramentas do atendimento são fixas nesta etapa.', 'nem perde ferramenta');
select throws_ok($$ select public.salvar_agente('fiscal', '{"ferramentas":["apagar_tudo"]}') $$,
  'P0001', 'Ferramenta fora do catálogo.', 'ferramenta inventada não entra');
select throws_ok($$ select public.salvar_agente('atendimento', '{"modelo":"modelo-sem-preco"}') $$,
  'P0001', 'Modelo sem preço em Configurações › Teto e modelos de IA.', 'modelo sem preço não entra (D29)');
select lives_ok($$ select public.salvar_agente('atendimento', '{"modelo":"claude-haiku-4-5"}') $$, 'o modelo do Thiago o dono escolhe');
select throws_ok($$ select public.salvar_regra_assunto('atendimento', null, 'Nota', '', 'mesma_voz') $$,
  'P0001', 'O Thiago não tem regras por assunto: ele é quem recebe toda mensagem.', 'o Thiago não tem regras');
select lives_ok($$ select public.salvar_regra_assunto('fiscal', null, 'Dúvida sobre imposto', 'Por que o DAS veio mais alto?', 'passa_conversa') $$,
  'regra por assunto do Fiscal');
select is(public.criar_agente('{"slug":"irpf","nome":"Agente do IRPF","tipos":["conversa"]}'), 'irpf', 'o dono cria um agente (D25)');
select throws_ok($$ select public.criar_agente('{"slug":"irpf","nome":"Outro IRPF","tipos":["conversa"]}') $$,
  'P0001', 'Já existe um agente com este endereço: mude o nome.', 'endereço repetido não passa');
select bag_eq($$ select descricao from public.agente_mudancas where agente_id = (select id from public.agentes where slug = 'fiscal') $$,
  $$ values ('Fala com o cliente: a definir → Mesma voz'), ('Ferramentas: +consultar_chamados, +responder'), ('Contatos em teste: 1'),
            ('Estado: Desligado → Teste'), ('Nova regra "Dúvida sobre imposto": Passa a conversa') $$, 'cada mudança vira uma frase (D28)');
select throws_ok($$ update public.agentes set estado = 'ligado' where slug = 'fiscal' $$, '42501', null, 'direto na tabela, não');

-- 34–35: administrador que não é dono
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_agente('fiscal', '{"estado":"ligado"}') $$, 'P0001', 'Só o dono altera os agentes.', 'administrador não-dono não altera');
select is((select count(*)::int from public.agentes), 8, 'administrador vê os agentes');

-- 36–37: atendente sem "Treinar o agente"
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.agentes), 0, 'sem Treinar o agente, não vê os agentes');
select throws_ok($$ select public.criar_agente('{"slug":"teste-ze","nome":"Do Zé","tipos":["conversa"]}') $$, 'P0001', 'Só o dono altera os agentes.', 'nem cria');

-- 38–42: orientações pelo setor do agente (D12)
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is((select count(*)::int from public.agentes), 8, 'com Treinar o agente, vê os agentes');
select lives_ok($$ select public.salvar_orientacao_agente('fiscal', null, 'Prazo', 'Notas até as 16h.', 'regra') $$, 'Ana (Fiscal) orienta o Fiscal');
select is((select a.slug from public.orientacoes_agente o join public.agentes a on a.id = o.agente_id where o.titulo = 'Prazo'), 'fiscal',
  'a orientação é do Fiscal');
select throws_ok($$ select public.salvar_orientacao_agente('pessoal', null, 'Folha', 'Folha até dia 20.', 'regra') $$,
  'P0001', 'Você não tem permissão para as orientações deste agente.', 'Ana não orienta o Pessoal');
select lives_ok($$ select public.salvar_orientacao(null, 'Cumprimento', 'Chame pelo nome.', 'jeito') $$, 'o Thiago, como hoje');

-- 43: Paula (Pessoal) não liga a orientação do Fiscal, nem pela função de hoje
select set_config('request.jwt.claims', '{"sub":"f5000000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.alternar_orientacao((select id from public.orientacoes_agente where titulo = 'Prazo'), true) $$,
  'P0001', 'Você não tem permissão para as orientações deste agente.', 'ligar orientação de outro setor, não');
reset role;
select set_config('request.jwt.claims', '', true);

-- 44: o custo ganha o agente
select has_column('public', 'uso_ia', 'agente_id', 'uso_ia.agente_id existe');

select * from finish();
rollback;
```

Conte: 5 + 2 + 7 + 19 + 2 + 2 + 5 + 1 + 1 = 44.

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db supabase/tests/45_painel_v2_agentes.test.sql`
Expected: FAIL (`column "dono" does not exist` ou parecido).

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261014000100_painel_v2_agentes.sql`:

```sql
-- supabase/migrations/20261014000100_painel_v2_agentes.sql
-- Painel v2, Parte I1 (spec 7E.1, 7E.3, 7E.8): um motor só, vários perfis. Cada agente é uma linha de `agentes`; o
-- Thiago (porta de entrada) nasce Ligado e igual ao de hoje (D1, D13). Só o dono (usuarios.dono, marcado só por SQL, D11)
-- muda os agentes; orientações seguem "Treinar o agente" do setor do agente (D12). Nada entra no Realtime (teste 22).

-- ---------- Dono (D11) ----------
alter table public.usuarios add column dono boolean not null default false;
-- No máximo um dono. Trocar = desmarcar e marcar na mesma transação (docs/operacao.md).
create unique index usuarios_um_dono on public.usuarios ((true)) where dono;

-- Pela API (PostgREST: qualquer papel, mesmo a chave de serviço e dentro de função security definer) a marcação não muda:
-- o PostgREST sempre preenche request.jwt.claims; migração e editor SQL não preenchem.
create function public.usuarios_dono_so_por_sql() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.dono) or (tg_op = 'UPDATE' and new.dono is distinct from old.dono) then
    if coalesce(current_setting('request.jwt.claims', true), '') <> '' then
      raise exception 'A marcação de dono só muda direto no banco (SQL).';
    end if;
  end if;
  return new;
end $$;
create trigger dono_so_por_sql before insert or update on public.usuarios
  for each row execute function public.usuarios_dono_so_por_sql();

create function public.eh_dono_de(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.usuario_liberado(p_usuario) and exists (select 1 from public.usuarios where id = p_usuario and dono)
$$;
revoke execute on function public.eh_dono_de(uuid) from public, anon, authenticated;
grant execute on function public.eh_dono_de(uuid) to service_role;

create function public.eh_dono() returns boolean
language sql stable security definer set search_path = '' as $$ select public.eh_dono_de(auth.uid()) $$;
revoke execute on function public.eh_dono() from public, anon;
grant execute on function public.eh_dono() to authenticated, service_role;

-- Ninguém é dono: marca o administrador ativo mais antigo e diz quem foi. Devolve o nome (null se não marcou).
create function public.marcar_dono_inicial() returns text
language plpgsql security definer set search_path = '' as $$
declare v record;
begin
  if exists (select 1 from public.usuarios where dono) then return null; end if;
  select id, nome, email into v from public.usuarios where papel = 'admin' and ativo order by criado_em, id limit 1;
  if not found then
    raise notice 'Nenhum administrador ativo: ninguém foi marcado como dono. Marque com: update public.usuarios set dono = true where email = ''<e-mail>'';';
    return null;
  end if;
  update public.usuarios set dono = true where id = v.id;
  raise notice 'Dono marcado: % (%). Para trocar: update public.usuarios set dono = false where dono; update public.usuarios set dono = true where email = ''<e-mail>'';',
    v.nome, v.email;
  return v.nome;
end $$;
revoke execute on function public.marcar_dono_inicial() from public, anon, authenticated, service_role;
select public.marcar_dono_inicial();

-- ---------- Agentes (spec 7E.1) ----------
create table public.agentes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9-]{1,39}$'),
  nome text not null check (char_length(trim(nome)) between 2 and 60),
  descricao text not null default '' check (char_length(descricao) <= 120),
  setor_id uuid references public.setores (id) on delete set null,
  tipos text[] not null default '{conversa}' check (tipos <@ array['conversa', 'trabalho'] and cardinality(tipos) between 1 and 2),
  estado text not null default 'desligado' check (estado in ('desligado', 'teste', 'ligado')),
  modelo text check (modelo is null or char_length(modelo) between 3 and 100),
  modo_contato text check (modo_contato in ('por_tras', 'mesma_voz', 'passa_conversa')),
  ferramentas text[] not null default '{}',
  porta_de_entrada boolean not null default false,
  ordem smallint not null default 100,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id) on delete set null
);
-- Uma porta de entrada só (o Thiago): é ela que recebe toda mensagem (spec 7E.3).
create unique index agentes_uma_porta on public.agentes ((true)) where porta_de_entrada;
create index agentes_setor_idx on public.agentes (setor_id);
create index agentes_atualizado_por_idx on public.agentes (atualizado_por);

create table public.agente_contatos_teste (
  agente_id uuid not null references public.agentes (id) on delete cascade,
  contato_id uuid not null references public.contatos (id) on delete cascade,
  incluido_por uuid references public.usuarios (id) on delete set null,
  incluido_em timestamptz not null default now(),
  primary key (agente_id, contato_id)
);
create index agente_contatos_teste_contato_idx on public.agente_contatos_teste (contato_id);
create index agente_contatos_teste_por_idx on public.agente_contatos_teste (incluido_por);

create table public.agente_regras_assunto (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agentes (id) on delete cascade,
  assunto text not null check (char_length(trim(assunto)) between 2 and 80),
  exemplo text not null default '' check (char_length(exemplo) <= 200),
  modo text not null check (modo in ('por_tras', 'mesma_voz', 'passa_conversa')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index agente_regras_agente_idx on public.agente_regras_assunto (agente_id, criado_em);

-- Histórico em frases (D28): "Estado: Desligado → Teste".
create table public.agente_mudancas (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agentes (id) on delete cascade,
  usuario_id uuid references public.usuarios (id) on delete set null,
  descricao text not null check (char_length(descricao) between 1 and 300),
  criado_em timestamptz not null default clock_timestamp()
);
create index agente_mudancas_agente_idx on public.agente_mudancas (agente_id, criado_em desc);
create index agente_mudancas_usuario_idx on public.agente_mudancas (usuario_id);

-- ---------- Catálogo de ferramentas (D15) ----------
-- As 16 do Thiago, na ordem de FERRAMENTAS (apps/trabalhador/src/agente/ferramentas.ts). O core tem a mesma lista
-- (CATALOGO_FERRAMENTAS); packages/db/test/agentes.test.ts confere as duas.
create function public.ferramentas_do_atendimento() returns text[]
language sql immutable set search_path = '' as $$
  select array['selecionar_empresa', 'abrir_chamado', 'consultar_chamados', 'sinalizar_nao_entendido', 'passar_para_pessoa',
    'buscar_parceiros', 'buscar_produtos', 'resumir_pedido_nota', 'abrir_pedido_nota', 'listar_documentos', 'enviar_documento',
    'consultar_cadastro', 'consultar_preco', 'alterar_preco', 'cadastrar_produto', 'responder']::text[]
$$;
-- Na I1 o catálogo é o do Thiago; as ferramentas novas entram aqui com quem as usa.
create function public.ferramentas_do_catalogo() returns text[]
language sql immutable set search_path = '' as $$ select public.ferramentas_do_atendimento() $$;
revoke execute on function public.ferramentas_do_atendimento(), public.ferramentas_do_catalogo() from public, anon;
grant execute on function public.ferramentas_do_atendimento(), public.ferramentas_do_catalogo() to authenticated, service_role;

-- ---------- Os 7 agentes iniciais (D1) ----------
-- Também usada por limparBanco (D24): volta os 7 às sementes e apaga os criados por teste (sem orientação nem teste).
create function public.restaurar_agentes_iniciais() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.agentes a
  where a.slug not in ('atendimento', 'radar', 'fiscal', 'contabil', 'pessoal', 'legalizacao', 'comercial')
    and not exists (select 1 from public.orientacoes_agente o where o.agente_id = a.id)
    and not exists (select 1 from public.simulacoes_agente s where s.agente_id = a.id);
  insert into public.agentes as g (id, slug, nome, descricao, setor_id, tipos, estado, modelo, modo_contato, ferramentas, porta_de_entrada, ordem)
  select coalesce(s.id, gen_random_uuid()), s.slug, s.nome, s.descricao, (select t.id from public.setores t where t.nome = s.setor),
         s.tipos, s.estado, null, s.modo, s.ferramentas, s.porta, s.ordem
  from (values
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'atendimento', 'Thiago', 'porta de entrada no WhatsApp', null::text,
       '{conversa}'::text[], 'ligado', 'mesma_voz'::text, public.ferramentas_do_atendimento(), true, 1),
    (null, 'radar', 'Radar de legislação', 'leis contábeis, fiscais, trabalhistas e societárias', null, '{trabalho}', 'desligado', null, '{}', false, 2),
    (null, 'fiscal', 'Agente Fiscal', 'notas e guias', 'Fiscal', '{conversa,trabalho}', 'desligado', null, '{}', false, 3),
    (null, 'contabil', 'Agente Contábil', 'fechamento e conferências', 'Contábil', '{trabalho}', 'desligado', null, '{}', false, 4),
    (null, 'pessoal', 'Departamento Pessoal', 'folha e admissões', 'Pessoal', '{conversa,trabalho}', 'desligado', null, '{}', false, 5),
    (null, 'legalizacao', 'Agente de Legalização', 'aberturas e alterações', 'Legalização', '{conversa,trabalho}', 'desligado', null, '{}', false, 6),
    (null, 'comercial', 'Agente Comercial', 'orçamentos de novos clientes', 'Comercial', '{conversa}', 'desligado', null, '{}', false, 7)
  ) as s (id, slug, nome, descricao, setor, tipos, estado, modo, ferramentas, porta, ordem)
  on conflict (slug) do update set nome = excluded.nome, descricao = excluded.descricao, setor_id = excluded.setor_id,
    tipos = excluded.tipos, estado = excluded.estado, modelo = null, modo_contato = excluded.modo_contato,
    ferramentas = excluded.ferramentas, porta_de_entrada = excluded.porta_de_entrada, ordem = excluded.ordem,
    atualizado_por = null, atualizado_em = now();
end $$;
revoke execute on function public.restaurar_agentes_iniciais() from public, anon, authenticated, service_role;
-- As linhas nascem no fim desta migração, depois das colunas agente_id de orientações e testes (a função as consulta).

-- ---------- Quem vê e quem treina (D12) ----------
create function public.pode_ver_agentes() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_usuario_ativo() and (public.eh_admin() or public.eh_dono() or public.tem_permissao('treinar', 'sim'))
$$;
-- Thiago (porta de entrada) e agente sem setor: "Treinar o agente", como hoje. Os outros: também ser do setor (ou administrador).
create function public.pode_treinar_agente(p_agente uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.tem_permissao('treinar', 'sim') and exists (
    select 1 from public.agentes a where a.id = p_agente
      and (a.porta_de_entrada or a.setor_id is null or public.eh_admin() or a.setor_id in (select public.meus_setores())))
$$;
revoke execute on function public.pode_ver_agentes(), public.pode_treinar_agente(uuid) from public, anon;
grant execute on function public.pode_ver_agentes(), public.pode_treinar_agente(uuid) to authenticated, service_role;

alter table public.agentes enable row level security;
alter table public.agente_contatos_teste enable row level security;
alter table public.agente_regras_assunto enable row level security;
alter table public.agente_mudancas enable row level security;
create policy leitura on public.agentes for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_contatos_teste for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_regras_assunto for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_mudancas for select to authenticated using (public.pode_ver_agentes());
revoke all on public.agentes, public.agente_contatos_teste, public.agente_regras_assunto, public.agente_mudancas from anon;
revoke insert, update, delete, truncate on public.agentes, public.agente_contatos_teste, public.agente_regras_assunto, public.agente_mudancas
  from authenticated;

-- ---------- Funções do dono (D11, D13, D14, D25, D28, D29) ----------
create function public.rotulo_agente(p_campo text, p_valor text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_valor is null then case p_campo when 'modelo' then 'padrão de Configurações' else 'a definir' end
    when p_campo = 'estado' then case p_valor when 'desligado' then 'Desligado' when 'teste' then 'Teste' when 'ligado' then 'Ligado' else p_valor end
    when p_campo = 'modo' then case p_valor when 'por_tras' then 'Por trás' when 'mesma_voz' then 'Mesma voz'
                                            when 'passa_conversa' then 'Passa a conversa' else p_valor end
    else p_valor end
$$;
revoke execute on function public.rotulo_agente(text, text) from public, anon, authenticated;

create function public.mudanca_agente(p_agente uuid, p_texto text) returns void
language sql security definer set search_path = '' as $$
  insert into public.agente_mudancas (agente_id, usuario_id, descricao) values (p_agente, auth.uid(), left(p_texto, 300))
$$;
revoke execute on function public.mudanca_agente(uuid, text) from public, anon, authenticated;

create function public.salvar_agente(p_slug text, p_dados jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; n public.agentes%rowtype; k text; m text[] := '{}'; v_mais text[]; v_menos text[];
begin
  if not public.eh_dono() then raise exception 'Só o dono altera os agentes.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do agente inválidos.'; end if;
  for k in select jsonb_object_keys(p_dados) loop
    if k not in ('nome', 'descricao', 'setor_id', 'tipos', 'estado', 'modelo', 'modo_contato', 'ferramentas') then
      raise exception 'Dados do agente inválidos.';
    end if;
  end loop;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  n := a;
  begin
    if p_dados ? 'nome' then n.nome := trim(p_dados ->> 'nome'); end if;
    if p_dados ? 'descricao' then n.descricao := coalesce(trim(p_dados ->> 'descricao'), ''); end if;
    if p_dados ? 'setor_id' then n.setor_id := nullif(p_dados ->> 'setor_id', '')::uuid; end if;
    if p_dados ? 'tipos' then n.tipos := array(select distinct jsonb_array_elements_text(p_dados -> 'tipos') order by 1); end if;
    if p_dados ? 'estado' then n.estado := p_dados ->> 'estado'; end if;
    if p_dados ? 'modelo' then n.modelo := nullif(trim(p_dados ->> 'modelo'), ''); end if;
    if p_dados ? 'modo_contato' then n.modo_contato := nullif(p_dados ->> 'modo_contato', ''); end if;
    if p_dados ? 'ferramentas' then n.ferramentas := array(select distinct jsonb_array_elements_text(p_dados -> 'ferramentas') order by 1); end if;
  exception when invalid_text_representation or invalid_parameter_value then
    raise exception 'Dados do agente inválidos.';
  end;
  if n.nome is null or char_length(n.nome) not between 2 and 60 then raise exception 'O nome do agente tem de 2 a 60 letras.'; end if;
  if char_length(n.descricao) > 120 then raise exception 'A descrição tem até 120 letras.'; end if;
  if n.setor_id is not null and not exists (select 1 from public.setores where id = n.setor_id and ativo) then
    raise exception 'Setor não encontrado ou inativo.';
  end if;
  if cardinality(n.tipos) not between 1 and 2 or not (n.tipos <@ array['conversa', 'trabalho']) then
    raise exception 'Escolha Conversa, Trabalho ou os dois.';
  end if;
  if n.estado is null or n.estado not in ('desligado', 'teste', 'ligado') then raise exception 'Estado inválido.'; end if;
  if n.modo_contato is not null and n.modo_contato not in ('por_tras', 'mesma_voz', 'passa_conversa') then
    raise exception 'Modo de falar com o cliente inválido.';
  end if;
  if not (n.ferramentas <@ public.ferramentas_do_catalogo()) then raise exception 'Ferramenta fora do catálogo.'; end if;
  if n.modelo is not null and not exists (select 1 from public.configuracoes c where c.id = 1 and c.precos_modelos ? n.modelo) then
    raise exception 'Modelo sem preço em Configurações › Teto e modelos de IA.';
  end if;
  if a.porta_de_entrada then
    if n.estado <> 'ligado' then raise exception 'O Thiago fica sempre ligado: para parar o atendimento, use PAUSAR no Início.'; end if;
    if n.modo_contato is distinct from 'mesma_voz' then raise exception 'O Thiago é a voz do escritório: o modo dele não muda.'; end if;
    if n.setor_id is not null then raise exception 'O Thiago atende todos os setores.'; end if;
    if not (public.ferramentas_do_atendimento() <@ n.ferramentas) then raise exception 'As ferramentas do atendimento são fixas nesta etapa.'; end if;
  end if;
  if n.estado = 'teste' and not exists (select 1 from public.agente_contatos_teste where agente_id = a.id) then
    raise exception 'Em teste, escolha pelo menos um contato.';
  end if;

  if n.nome is distinct from a.nome then m := m || format('Nome: %s → %s', a.nome, n.nome); end if;
  if n.descricao is distinct from a.descricao then m := m || 'Descrição alterada'::text; end if;
  if n.setor_id is distinct from a.setor_id then
    m := m || format('Setor: %s → %s', coalesce((select nome from public.setores where id = a.setor_id), 'sem setor'),
                                        coalesce((select nome from public.setores where id = n.setor_id), 'sem setor'));
  end if;
  if n.tipos is distinct from array(select x from unnest(a.tipos) x order by 1) then
    m := m || format('Tipo: %s', replace(replace(array_to_string(n.tipos, ' e '), 'conversa', 'Conversa'), 'trabalho', 'Trabalho'));
  end if;
  if n.estado is distinct from a.estado then
    m := m || format('Estado: %s → %s', public.rotulo_agente('estado', a.estado), public.rotulo_agente('estado', n.estado));
  end if;
  if n.modelo is distinct from a.modelo then
    m := m || format('Modelo: %s → %s', public.rotulo_agente('modelo', a.modelo), public.rotulo_agente('modelo', n.modelo));
  end if;
  if n.modo_contato is distinct from a.modo_contato then
    m := m || format('Fala com o cliente: %s → %s', public.rotulo_agente('modo', a.modo_contato), public.rotulo_agente('modo', n.modo_contato));
  end if;
  v_mais := array(select x from unnest(n.ferramentas) x except select y from unnest(a.ferramentas) y order by 1);
  v_menos := array(select y from unnest(a.ferramentas) y except select x from unnest(n.ferramentas) x order by 1);
  if cardinality(v_mais) + cardinality(v_menos) > 0 then
    m := m || concat_ws(' ', 'Ferramentas:',
      case when cardinality(v_mais) > 0 then '+' || array_to_string(v_mais, ', +') end
        || case when cardinality(v_mais) > 0 and cardinality(v_menos) > 0 then ',' else '' end,
      case when cardinality(v_menos) > 0 then '−' || array_to_string(v_menos, ', −') end);
  end if;
  if cardinality(m) = 0 then return; end if;
  update public.agentes set nome = n.nome, descricao = n.descricao, setor_id = n.setor_id, tipos = n.tipos, estado = n.estado,
    modelo = n.modelo, modo_contato = n.modo_contato, ferramentas = n.ferramentas, atualizado_em = now(), atualizado_por = auth.uid()
  where id = a.id;
  perform public.mudanca_agente(a.id, x) from unnest(m) x;
end $$;

create function public.definir_contatos_teste(p_slug text, p_contatos uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v uuid[] := array(select distinct x from unnest(coalesce(p_contatos, '{}')) x where x is not null);
begin
  if not public.eh_dono() then raise exception 'Só o dono altera os agentes.'; end if;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if a.porta_de_entrada then raise exception 'O Thiago atende todos os contatos.'; end if;
  if cardinality(v) > 20 then raise exception 'Em teste, no máximo 20 contatos.'; end if;
  if exists (select 1 from unnest(v) x where not exists (select 1 from public.contatos c where c.id = x and c.ativo)) then
    raise exception 'Contato não encontrado ou arquivado.';
  end if;
  if a.estado = 'teste' and cardinality(v) = 0 then raise exception 'Em teste, escolha pelo menos um contato (ou desligue o agente).'; end if;
  if (select count(*) from public.agente_contatos_teste where agente_id = a.id) = cardinality(v)
     and not exists (select 1 from unnest(v) x where not exists (
       select 1 from public.agente_contatos_teste t where t.agente_id = a.id and t.contato_id = x)) then
    return;
  end if;
  delete from public.agente_contatos_teste where agente_id = a.id and contato_id <> all (v);
  insert into public.agente_contatos_teste (agente_id, contato_id, incluido_por)
  select a.id, x, auth.uid() from unnest(v) x on conflict do nothing;
  perform public.mudanca_agente(a.id, format('Contatos em teste: %s', cardinality(v)));
end $$;

create function public.salvar_regra_assunto(p_slug text, p_id uuid, p_assunto text, p_exemplo text, p_modo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v_id uuid; v_assunto text := trim(coalesce(p_assunto, '')); v_exemplo text := trim(coalesce(p_exemplo, ''));
begin
  if not public.eh_dono() then raise exception 'Só o dono altera os agentes.'; end if;
  select * into a from public.agentes where slug = p_slug for update;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if a.porta_de_entrada then raise exception 'O Thiago não tem regras por assunto: ele é quem recebe toda mensagem.'; end if;
  if char_length(v_assunto) not between 2 and 80 then raise exception 'O assunto tem de 2 a 80 letras.'; end if;
  if char_length(v_exemplo) > 200 then raise exception 'O exemplo tem até 200 letras.'; end if;
  if p_modo is null or p_modo not in ('por_tras', 'mesma_voz', 'passa_conversa') then
    raise exception 'Escolha como o agente fala com o cliente nesse assunto.';
  end if;
  if p_id is null then
    if (select count(*) from public.agente_regras_assunto where agente_id = a.id) >= 30 then raise exception 'No máximo 30 regras por agente.'; end if;
    insert into public.agente_regras_assunto (agente_id, assunto, exemplo, modo) values (a.id, v_assunto, v_exemplo, p_modo) returning id into v_id;
    perform public.mudanca_agente(a.id, format('Nova regra "%s": %s', v_assunto, public.rotulo_agente('modo', p_modo)));
  else
    update public.agente_regras_assunto set assunto = v_assunto, exemplo = v_exemplo, modo = p_modo, atualizado_em = now()
    where id = p_id and agente_id = a.id returning id into v_id;
    if v_id is null then raise exception 'Regra não encontrada.'; end if;
    perform public.mudanca_agente(a.id, format('Regra "%s": %s', v_assunto, public.rotulo_agente('modo', p_modo)));
  end if;
  return v_id;
end $$;

create function public.excluir_regra_assunto(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.agente_regras_assunto%rowtype;
begin
  if not public.eh_dono() then raise exception 'Só o dono altera os agentes.'; end if;
  delete from public.agente_regras_assunto where id = p_id returning * into r;
  if not found then raise exception 'Regra não encontrada.'; end if;
  perform public.mudanca_agente(r.agente_id, format('Regra "%s" removida', r.assunto));
end $$;

create function public.criar_agente(p_dados jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare v_slug text; v_nome text; v_descricao text; v_setor uuid; v_tipos text[]; v_id uuid;
begin
  if not public.eh_dono() then raise exception 'Só o dono altera os agentes.'; end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then raise exception 'Dados do agente inválidos.'; end if;
  v_slug := p_dados ->> 'slug'; v_nome := trim(p_dados ->> 'nome'); v_descricao := coalesce(trim(p_dados ->> 'descricao'), '');
  if v_slug is null or v_slug !~ '^[a-z][a-z0-9-]{1,39}$' then raise exception 'Endereço do agente inválido.'; end if;
  if v_nome is null or char_length(v_nome) not between 2 and 60 then raise exception 'O nome do agente tem de 2 a 60 letras.'; end if;
  if char_length(v_descricao) > 120 then raise exception 'A descrição tem até 120 letras.'; end if;
  if exists (select 1 from public.agentes where slug = v_slug) then raise exception 'Já existe um agente com este endereço: mude o nome.'; end if;
  begin
    v_setor := nullif(p_dados ->> 'setor_id', '')::uuid;
    v_tipos := array(select distinct jsonb_array_elements_text(coalesce(p_dados -> 'tipos', '["conversa"]')) order by 1);
  exception when invalid_text_representation or invalid_parameter_value then
    raise exception 'Dados do agente inválidos.';
  end;
  if v_setor is not null and not exists (select 1 from public.setores where id = v_setor and ativo) then
    raise exception 'Setor não encontrado ou inativo.';
  end if;
  if cardinality(v_tipos) not between 1 and 2 or not (v_tipos <@ array['conversa', 'trabalho']) then
    raise exception 'Escolha Conversa, Trabalho ou os dois.';
  end if;
  insert into public.agentes (slug, nome, descricao, setor_id, tipos, ordem, atualizado_por)
  values (v_slug, v_nome, v_descricao, v_setor, v_tipos, (select coalesce(max(ordem), 0) + 1 from public.agentes), auth.uid())
  returning id into v_id;
  perform public.mudanca_agente(v_id, 'Agente criado');
  return v_slug;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.salvar_agente(text, jsonb)', 'public.definir_contatos_teste(text, uuid[])',
    'public.salvar_regra_assunto(text, uuid, text, text, text)', 'public.excluir_regra_assunto(uuid)', 'public.criar_agente(jsonb)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- Orientações por agente (D12, D21) ----------
-- As de hoje são do Thiago. salvar_orientacao_agente põe o agente pelo padrão da coluna (app.agente_orientacao), sem
-- copiar salvar_orientacao (20260930000100), que continua igual.
alter table public.orientacoes_agente add column agente_id uuid not null
  default coalesce(nullif(current_setting('app.agente_orientacao', true), '')::uuid, 'a0000000-0000-4000-8000-000000000001'::uuid);
create index orientacoes_agente_agente_idx on public.orientacoes_agente (agente_id);

-- Vale para salvar, ligar, desligar e restaurar (as funções de hoje passam por aqui). Sem pessoa (trabalhador, testes): passa.
create function public.orientacoes_do_agente_certo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.agente_id is distinct from old.agente_id then raise exception 'A orientação não muda de agente.'; end if;
  if auth.uid() is not null and not public.pode_treinar_agente(new.agente_id) then
    raise exception 'Você não tem permissão para as orientações deste agente.';
  end if;
  return new;
end $$;
create trigger agente_certo before insert or update on public.orientacoes_agente
  for each row execute function public.orientacoes_do_agente_certo();

create function public.salvar_orientacao_agente(p_slug text, p_id uuid, p_titulo text, p_texto text, p_tipo text,
  p_cliente_id uuid default null, p_setor_id uuid default null, p_ativo boolean default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v_id uuid;
begin
  select * into a from public.agentes where slug = p_slug;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if not public.pode_treinar_agente(a.id) then raise exception 'Você não tem permissão para as orientações deste agente.'; end if;
  if p_id is not null and not exists (select 1 from public.orientacoes_agente where id = p_id and agente_id = a.id) then
    raise exception 'Orientação não encontrada.';
  end if;
  perform set_config('app.agente_orientacao', a.id::text, true);
  v_id := public.salvar_orientacao(p_id, p_titulo, p_texto, p_tipo, p_cliente_id, p_setor_id, p_ativo);
  perform set_config('app.agente_orientacao', '', true);
  return v_id;
end $$;
revoke execute on function public.salvar_orientacao_agente(text, uuid, text, text, text, uuid, uuid, boolean) from public, anon;
grant execute on function public.salvar_orientacao_agente(text, uuid, text, text, text, uuid, uuid, boolean) to authenticated, service_role;

-- ---------- Teste e custo por agente (D16) ----------
alter table public.simulacoes_agente add column agente_id uuid not null default 'a0000000-0000-4000-8000-000000000001';
create index simulacoes_agente_agente_idx on public.simulacoes_agente (agente_id);
alter table public.uso_ia add column agente_id uuid references public.agentes (id) on delete set null;
create index uso_ia_agente_idx on public.uso_ia (agente_id, criado_em);

-- ---------- Os 7 agentes (D1) e as chaves estrangeiras que dependem do Thiago ----------
-- Agora: as linhas de hoje de orientações e testes já apontam para o id fixo do Thiago, que nasce aqui.
select public.restaurar_agentes_iniciais();
alter table public.orientacoes_agente add constraint orientacoes_agente_agente_id_fkey foreign key (agente_id) references public.agentes (id);
alter table public.simulacoes_agente add constraint simulacoes_agente_agente_id_fkey foreign key (agente_id) references public.agentes (id);
```

- [ ] **Passo 4: aplicar e ver passar**

Run: `supabase db reset && supabase test db supabase/tests/45_painel_v2_agentes.test.sql`
Expected: `ok 1` … `ok 44`, `All tests successful`. Na saída do `db reset`, a migração avisa "Nenhum administrador ativo: ninguém foi marcado como dono…" (o banco local nasce sem usuários).

Run: `supabase test db`
Expected: todos os arquivos passam, inclusive `12_orientacoes_agente`, `13_simulacao_rascunho_id`, `22_regressao_visibilidade` (100/100), `23`–`26b` (níveis e horário) e `32`–`34` (gastos).

- [ ] **Passo 5: tipos e commit** (volte `supabase/config.toml` e `.env` antes, Restrições item 6)

Run: `pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: `tipos.gen.ts` com `agentes`, `agente_*`, as colunas novas e as funções; sem erros de tipo.

```bash
git add supabase/migrations/20261014000100_painel_v2_agentes.sql supabase/tests/45_painel_v2_agentes.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(banco): agentes por departamento (dono só por SQL, 7 agentes iniciais, Thiago travado, orientações pelo setor do agente, custo por agente)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Banco. Skills (versões, arquivos, liga/desliga, leitura do trabalhador, teste de skill)

**Files:**
- Create: `supabase/migrations/20261014000200_painel_v2_agente_skills.sql`
- Create: `supabase/tests/46_painel_v2_agente_skills.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: Task 2 (`agentes`, `eh_dono`, `pode_ver_agentes`, `mudanca_agente`); `interno.validar_empresa` (20260930000100); `simulacoes_agente`.
- Produces:
  - tabelas `agente_skills(id, agente_id, nome, tipo, ativo, versao_atual, arquivada_em, …)`, `agente_skill_versoes(id, skill_id, versao, titulo, descricao, tipo, corpo, skill_md, origem, restaurada_de, autor_id, criado_em)`, `agente_skill_arquivos(versao_id, caminho, conteudo)` (leitura: `pode_ver_agentes()`);
  - `subir_skill(p_slug text, p_pacote jsonb) → jsonb {skill_id, versao, nova}` — pacote `{nome, titulo, descricao, tipo, corpo, skill_md, arquivos: [{caminho, conteudo}]}` (o core monta, Task 5);
  - `alternar_skill(p_skill uuid, p_ativo boolean) → boolean`, `restaurar_versao_skill(p_versao uuid) → int`, `arquivar_skill(p_skill uuid) → void` (só o dono);
  - `skills_do_agente(p_agente uuid, p_incluir uuid default null) → table (id, nome, tipo, ativo, titulo, descricao, corpo, versao, arquivos text[])` e `referencia_da_skill(p_agente uuid, p_nome text, p_caminho text, p_incluir uuid default null) → text` (só `service_role`);
  - `simulacoes_agente.skill_id uuid null`; `criar_simulacao_skill(p_skill uuid, p_mensagem text, p_cliente_id uuid default null) → uuid` (só o dono; só skill do Thiago na I1).

- [ ] **Passo 1: escrever o pgTAP que falha**

`supabase/tests/46_painel_v2_agente_skills.test.sql`:

```sql
-- Parte I1, Task 3 (spec 7E.3, 7E.10; D5–D9): só o dono sobe, liga, restaura e arquiva skills; nome no formato das skills do
-- Claude; .md/.txt/.csv; Jeito+Limites ligados até 10.000; o trabalhador lê só as ligadas do próprio agente.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);

update public.usuarios set dono = false where dono;
insert into auth.users (id, email) values
  ('f5200000-0000-0000-0000-00000000000a', 'dono@i1b.local'), ('f5200000-0000-0000-0000-00000000000b', 'admin@i1b.local'),
  ('f5200000-0000-0000-0000-00000000000c', 'ana@i1b.local'), ('f5200000-0000-0000-0000-00000000000d', 'ze@i1b.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f5200000-0000-0000-0000-00000000000a', 'I1B Dono', 'dono@i1b.local', 'admin', '{}'),
  ('f5200000-0000-0000-0000-00000000000b', 'I1B Admin', 'admin@i1b.local', 'admin', '{}'),
  ('f5200000-0000-0000-0000-00000000000c', 'I1B Ana', 'ana@i1b.local', 'atendente', '{treinar_agente}'),
  ('f5200000-0000-0000-0000-00000000000d', 'I1B Zé', 'ze@i1b.local', 'atendente', '{}');
update public.usuarios set dono = true where id = 'f5200000-0000-0000-0000-00000000000a';

create temp table pac (nome text primary key, p jsonb) on commit drop;
grant all on pac to authenticated;
insert into pac values
  ('limites', '{"nome":"nunca-prometer-prazo","titulo":"Nunca promete prazo","descricao":"O que nunca prometer.","tipo":"limites","corpo":"# Nunca promete prazo\nNunca prometa prazo de emissão.","skill_md":"---\nname: nunca-prometer-prazo\n---"}'),
  ('limites-v2', '{"nome":"nunca-prometer-prazo","titulo":"Nunca promete prazo","descricao":"O que nunca prometer.","tipo":"limites","corpo":"# Nunca promete prazo\nNunca prometa prazo nenhum.","skill_md":"---\nname: nunca-prometer-prazo\n---"}'),
  ('jeito-longo', jsonb_build_object('nome', 'jeito-longo', 'titulo', 'Jeito longo', 'descricao', 'Muito texto.', 'tipo', 'jeito',
     'corpo', repeat('x', 9990), 'skill_md', '---')),
  ('procedimento', '{"nome":"conferencia-certidao","titulo":"Certidão","descricao":"Quando pedirem certidão negativa.","tipo":"procedimento","corpo":"Pergunte a finalidade antes.","skill_md":"---","arquivos":[{"caminho":"checklist.md","conteudo":"Pergunte a finalidade."}]}'),
  ('conhecimento', '{"nome":"tabela-cfop","titulo":"Tabela CFOP","descricao":"CFOPs mais usados.","tipo":"conhecimento","corpo":"Veja cfop.csv.","skill_md":"---","arquivos":[{"caminho":"cfop.csv","conteudo":"5102;Venda"}]}'),
  ('fiscal', '{"nome":"jeito-do-fiscal","titulo":"Jeito do Fiscal","descricao":"Tom do Fiscal.","tipo":"jeito","corpo":"Assine Fiscal do escritório.","skill_md":"---","arquivos":[{"caminho":"frases.md","conteudo":"Bom dia!"}]}'),
  ('nome-ruim', '{"nome":"Nome Com Espaço","titulo":"x","descricao":"x","tipo":"limites","corpo":"x","skill_md":"---"}'),
  ('pdf', '{"nome":"com-pdf","titulo":"x","descricao":"x","tipo":"conhecimento","corpo":"x","skill_md":"---","arquivos":[{"caminho":"guia.pdf","conteudo":"x"}]}'),
  ('fuga', '{"nome":"com-fuga","titulo":"x","descricao":"x","tipo":"conhecimento","corpo":"x","skill_md":"---","arquivos":[{"caminho":"../segredo.md","conteudo":"x"}]}'),
  ('muitos', jsonb_build_object('nome', 'muitos', 'titulo', 'x', 'descricao', 'x', 'tipo', 'conhecimento', 'corpo', 'x', 'skill_md', '---',
     'arquivos', (select jsonb_agg(jsonb_build_object('caminho', 'a' || i || '.md', 'conteudo', 'x')) from generate_series(1, 21) i)));

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1–8: subir
select is(public.subir_skill('atendimento', (select p from pac where nome = 'limites')) ->> 'versao', '1', 'skill nova é a versão 1');
select is((select ativo from public.agente_skills where nome = 'nunca-prometer-prazo'), false, 'nasce desligada (D8)');
select is(public.subir_skill('atendimento', (select p from pac where nome = 'limites-v2')) ->> 'versao', '2', 'mesmo name = versão nova');
select is((select count(*)::int from public.agente_skill_versoes v join public.agente_skills s on s.id = v.skill_id where s.nome = 'nunca-prometer-prazo'),
  2, 'as duas versões ficam');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'nome-ruim')) $$, 'P0001',
  'O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.', 'name fora do formato');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'pdf')) $$, 'P0001',
  'Arquivo de referência inválido: guia.pdf. Use .md, .txt ou .csv.', 'PDF não entra na I1 (D7)');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'fuga')) $$, 'P0001',
  'Arquivo de referência inválido: ../segredo.md. Use .md, .txt ou .csv.', 'caminho com .. não entra');
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'muitos')) $$, 'P0001',
  'No máximo 20 arquivos de referência por skill.', 'até 20 arquivos');

-- 9–11: ligar e o limite do bloco sempre carregado (D6)
select is(public.alternar_skill((select id from public.agente_skills where nome = 'nunca-prometer-prazo'), true), true, 'liga o Limite');
select lives_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'jeito-longo')) $$, 'sobe um Jeito longo (desligado)');
select throws_like($$ select public.alternar_skill((select id from public.agente_skills where nome = 'jeito-longo'), true) $$,
  '%passam de 10.000 caracteres%', 'Jeito + Limites ligados acima de 10.000 não ligam');

-- 12–17: as outras (um comando por teste: o pgTAP executa um só)
select is((select ativo from public.agente_skills where nome = 'jeito-longo'), false, 'a tentativa não deixou nada ligado');
select lives_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'procedimento')) $$, 'sobe o procedimento');
select lives_ok($$ select public.alternar_skill((select id from public.agente_skills where nome = 'conferencia-certidao'), true) $$,
  'procedimento ligado');
select lives_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'conhecimento')) $$, 'conhecimento (desligado)');
select lives_ok($$ select public.subir_skill('fiscal', (select p from pac where nome = 'fiscal')) $$, 'Jeito do Fiscal');
select lives_ok($$ select public.alternar_skill((select id from public.agente_skills where nome = 'jeito-do-fiscal'), true) $$,
  'Jeito do Fiscal ligado');

-- 18: restaurar = versão nova com o texto antigo (D9)
select is(public.restaurar_versao_skill((select v.id from public.agente_skill_versoes v join public.agente_skills s on s.id = v.skill_id
  where s.nome = 'nunca-prometer-prazo' and v.versao = 1)), 3, 'restaurar a versão 1 vira a versão 3');

-- 19–21: teste de skill (só o dono; só do Thiago na I1)
select lives_ok($$ select public.criar_simulacao_skill((select id from public.agente_skills where nome = 'tabela-cfop'), 'Qual o CFOP de venda?') $$,
  'o dono testa a skill desligada');
select is((select s.nome from public.simulacoes_agente m join public.agente_skills s on s.id = m.skill_id
  where m.usuario_id = 'f5200000-0000-0000-0000-00000000000a'), 'tabela-cfop', 'o teste leva a skill');
select throws_ok($$ select public.criar_simulacao_skill((select id from public.agente_skills where nome = 'jeito-do-fiscal'), 'Oi') $$,
  'P0001', 'Nesta etapa só dá para testar skills do Thiago.', 'skill de outro agente não testa na I1');

-- 22–23: arquivar
select lives_ok($$ select public.arquivar_skill((select id from public.agente_skills where nome = 'conferencia-certidao')) $$, 'arquiva');
select ok(exists (select 1 from public.agente_mudancas m where m.agente_id = 'a0000000-0000-4000-8000-000000000001'
  and m.descricao = 'Skill Nunca promete prazo ligada'), 'ligar vira frase no histórico (D28)');

-- 24–26: administrador não-dono
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select public.subir_skill('atendimento', (select p from pac where nome = 'conhecimento')) $$, 'P0001',
  'Só o dono altera as skills.', 'administrador não-dono não sobe');
select throws_ok($$ select public.alternar_skill((select id from public.agente_skills where nome = 'tabela-cfop'), true) $$, 'P0001',
  'Só o dono altera as skills.', 'nem liga');
select ok((select count(*) from public.agente_skills) > 0, 'administrador vê as skills');

-- 27–28: atendente com Treinar o agente lê, mas não chama as leituras do trabalhador
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select ok((select count(*) from public.agente_skill_versoes) > 0, 'quem treina vê as versões');
select throws_ok($$ select * from public.skills_do_agente('a0000000-0000-4000-8000-000000000001') $$, '42501', null,
  'skills_do_agente é só do trabalhador');

-- 29–30: atendente sem Treinar o agente
select set_config('request.jwt.claims', '{"sub":"f5200000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is((select count(*)::int from public.agente_skills), 0, 'sem Treinar o agente, não vê skills');
select throws_ok($$ insert into public.agente_skills (agente_id, nome, tipo) values ('a0000000-0000-4000-8000-000000000001', 'x', 'jeito') $$,
  '42501', null, 'direto na tabela, não');
reset role;
select set_config('request.jwt.claims', '', true);

-- 31–36: o que o trabalhador lê (D5)
select results_eq($$ select nome from public.skills_do_agente('a0000000-0000-4000-8000-000000000001') $$,
  $$ values ('nunca-prometer-prazo') $$, 'só as ligadas e não arquivadas do Thiago (sem a desligada, a arquivada e a do Fiscal)');
select results_eq($$ select nome from public.skills_do_agente('a0000000-0000-4000-8000-000000000001',
  (select id from public.agente_skills where nome = 'tabela-cfop')) $$,
  $$ values ('nunca-prometer-prazo'), ('tabela-cfop') $$, 'a skill em teste entra mesmo desligada');
select results_eq($$ select nome from public.skills_do_agente('a0000000-0000-4000-8000-000000000001',
  (select id from public.agente_skills where nome = 'jeito-do-fiscal')) $$,
  $$ values ('nunca-prometer-prazo') $$, 'skill de outro agente não entra nem como teste');
select is(public.referencia_da_skill('a0000000-0000-4000-8000-000000000001', 'tabela-cfop', 'cfop.csv'), null::text, 'arquivo de skill desligada: nada');
select is(public.referencia_da_skill('a0000000-0000-4000-8000-000000000001', 'tabela-cfop', 'cfop.csv',
  (select id from public.agente_skills where nome = 'tabela-cfop')), '5102;Venda', 'na simulação da skill, lê');
select is(public.referencia_da_skill('a0000000-0000-4000-8000-000000000001', 'jeito-do-fiscal', 'frases.md'), null::text,
  'arquivo de skill de outro agente: nada');

select * from finish();
rollback;
```

Conte: 8 + 3 + 6 + 1 + 3 + 2 + 3 + 2 + 2 + 6 = 36.

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db supabase/tests/46_painel_v2_agente_skills.test.sql`
Expected: FAIL (`function public.subir_skill(...) does not exist`).

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261014000200_painel_v2_agente_skills.sql`:

```sql
-- supabase/migrations/20261014000200_painel_v2_agente_skills.sql
-- Painel v2, Parte I1 (spec 7E.3): skills no formato das skills do Claude (SKILL.md com name, description e tipo +
-- arquivos de referência), com versões, liga/desliga e teste. Só o dono grava (D11); o trabalhador lê só as ligadas do
-- próprio agente (skills_do_agente, referencia_da_skill). Nada entra no Realtime (teste 22).

create table public.agente_skills (
  id uuid primary key default gen_random_uuid(),
  agente_id uuid not null references public.agentes (id) on delete cascade,
  nome text not null check (nome ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  tipo text not null check (tipo in ('jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos')),
  ativo boolean not null default false,
  versao_atual int not null default 1 check (versao_atual >= 1),
  arquivada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (agente_id, nome)
);

create table public.agente_skill_versoes (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references public.agente_skills (id) on delete cascade,
  versao int not null check (versao >= 1),
  titulo text not null check (char_length(titulo) between 1 and 120),
  descricao text not null check (char_length(descricao) between 1 and 1024),
  tipo text not null check (tipo in ('jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos')),
  corpo text not null check (char_length(corpo) between 1 and 20000),
  skill_md text not null check (char_length(skill_md) <= 25000),
  origem text not null default 'subida' check (origem in ('subida', 'restaurada')),
  restaurada_de int,
  autor_id uuid references public.usuarios (id) on delete set null,
  criado_em timestamptz not null default clock_timestamp(),
  unique (skill_id, versao)
);
create index agente_skill_versoes_autor_idx on public.agente_skill_versoes (autor_id);

create table public.agente_skill_arquivos (
  versao_id uuid not null references public.agente_skill_versoes (id) on delete cascade,
  caminho text not null check (char_length(caminho) between 1 and 200 and caminho !~ '(^/|\\|\.\.|[[:cntrl:]])'
                               and caminho ~* '\.(md|txt|csv)$'),
  conteudo text not null check (char_length(conteudo) <= 200000),
  primary key (versao_id, caminho)
);

alter table public.agente_skills enable row level security;
alter table public.agente_skill_versoes enable row level security;
alter table public.agente_skill_arquivos enable row level security;
create policy leitura on public.agente_skills for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_skill_versoes for select to authenticated using (public.pode_ver_agentes());
create policy leitura on public.agente_skill_arquivos for select to authenticated using (public.pode_ver_agentes());
revoke all on public.agente_skills, public.agente_skill_versoes, public.agente_skill_arquivos from anon;
revoke insert, update, delete, truncate on public.agente_skills, public.agente_skill_versoes, public.agente_skill_arquivos from authenticated;

-- Pacote montado pelo core (montarPacoteSkill); o banco confere tudo de novo (D6–D8). Mensagens vão para a pessoa.
create function interno.validar_pacote_skill(p jsonb) returns void
language plpgsql stable security definer set search_path = '' as $$
declare k text; x jsonb; v_c text; v_caminhos text[] := '{}'; v_total bigint := 0;
begin
  if jsonb_typeof(p) is distinct from 'object' then raise exception 'Pacote da skill inválido.'; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('nome', 'titulo', 'descricao', 'tipo', 'corpo', 'skill_md', 'arquivos') then raise exception 'Pacote da skill inválido.'; end if;
  end loop;
  if coalesce(p ->> 'nome', '') !~ '^[a-z0-9][a-z0-9-]{0,63}$' then
    raise exception 'O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.';
  end if;
  if char_length(coalesce(p ->> 'titulo', '')) not between 1 and 120 then raise exception 'O título da skill tem até 120 letras.'; end if;
  if char_length(coalesce(p ->> 'descricao', '')) not between 1 and 1024 then raise exception 'A "description" tem de 1 a 1.024 caracteres.'; end if;
  if coalesce(p ->> 'tipo', '') not in ('jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos') then
    raise exception 'Escolha o tipo da skill.';
  end if;
  if char_length(coalesce(p ->> 'corpo', '')) not between 1 and 20000 then raise exception 'O texto do SKILL.md tem de 1 a 20.000 caracteres.'; end if;
  if char_length(coalesce(p ->> 'skill_md', '')) > 25000 then raise exception 'O SKILL.md passa de 25.000 caracteres.'; end if;
  if jsonb_typeof(coalesce(p -> 'arquivos', '[]')) <> 'array' then raise exception 'Pacote da skill inválido.'; end if;
  if jsonb_array_length(coalesce(p -> 'arquivos', '[]')) > 20 then raise exception 'No máximo 20 arquivos de referência por skill.'; end if;
  for x in select * from jsonb_array_elements(coalesce(p -> 'arquivos', '[]')) loop
    v_c := x ->> 'caminho';
    if v_c is null or char_length(v_c) not between 1 and 200 or v_c ~ '(^/|\\|\.\.|[[:cntrl:]])' or v_c !~* '\.(md|txt|csv)$' then
      raise exception 'Arquivo de referência inválido: %. Use .md, .txt ou .csv.', coalesce(v_c, '(sem nome)');
    end if;
    if v_c = any (v_caminhos) then raise exception 'Arquivo repetido: %.', v_c; end if;
    if char_length(coalesce(x ->> 'conteudo', '')) > 200000 then raise exception 'O arquivo % passa de 200.000 caracteres.', v_c; end if;
    v_caminhos := v_caminhos || v_c;
    v_total := v_total + char_length(coalesce(x ->> 'conteudo', ''));
  end loop;
  if v_total > 1000000 then raise exception 'Os arquivos de referência passam de 1.000.000 de caracteres somados.'; end if;
end $$;

-- Jeito de atuar + Limites ligados entram em toda mensagem: até 10.000 caracteres por agente (D6).
create function interno.conferir_limite_sempre(p_agente uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare v_total int;
begin
  select coalesce(sum(char_length(v.corpo)), 0) into v_total
  from public.agente_skills s join public.agente_skill_versoes v on v.skill_id = s.id and v.versao = s.versao_atual
  where s.agente_id = p_agente and s.ativo and s.arquivada_em is null and s.tipo in ('jeito', 'limites');
  if v_total > 10000 then
    raise exception 'Jeito de atuar e Limites ligados passam de 10.000 caracteres (ficariam %): desligue ou encurte uma skill.', v_total;
  end if;
end $$;
revoke execute on all functions in schema interno from public, anon, authenticated;

create function public.subir_skill(p_slug text, p_pacote jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; s public.agente_skills%rowtype; v_versao int; v_versao_id uuid; v_nova boolean := false;
begin
  if not public.eh_dono() then raise exception 'Só o dono altera as skills.'; end if;
  select * into a from public.agentes where slug = p_slug;
  if not found then raise exception 'Agente não encontrado.'; end if;
  perform interno.validar_pacote_skill(p_pacote);
  select * into s from public.agente_skills where agente_id = a.id and nome = p_pacote ->> 'nome' for update;
  if not found then
    insert into public.agente_skills (agente_id, nome, tipo) values (a.id, p_pacote ->> 'nome', p_pacote ->> 'tipo') returning * into s;
    v_versao := 1; v_nova := true;
  else
    v_versao := s.versao_atual + 1;
    update public.agente_skills set tipo = p_pacote ->> 'tipo', versao_atual = v_versao, arquivada_em = null, atualizado_em = now()
    where id = s.id;
  end if;
  insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md, autor_id)
  values (s.id, v_versao, p_pacote ->> 'titulo', p_pacote ->> 'descricao', p_pacote ->> 'tipo', p_pacote ->> 'corpo', p_pacote ->> 'skill_md', auth.uid())
  returning id into v_versao_id;
  insert into public.agente_skill_arquivos (versao_id, caminho, conteudo)
  select v_versao_id, x ->> 'caminho', x ->> 'conteudo' from jsonb_array_elements(coalesce(p_pacote -> 'arquivos', '[]')) x;
  -- Nova versão de uma skill ligada vale na hora: confere o limite com o texto novo.
  if s.ativo then perform interno.conferir_limite_sempre(a.id); end if;
  perform public.mudanca_agente(a.id, case when v_nova then format('Skill %s subida (desligada)', p_pacote ->> 'titulo')
                                           else format('Skill %s: versão %s', p_pacote ->> 'titulo', v_versao) end);
  return jsonb_build_object('skill_id', s.id, 'versao', v_versao, 'nova', v_nova);
end $$;

create function public.alternar_skill(p_skill uuid, p_ativo boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
declare s public.agente_skills%rowtype; v_titulo text;
begin
  if not public.eh_dono() then raise exception 'Só o dono altera as skills.'; end if;
  if p_ativo is null then raise exception 'Informe se a skill fica ligada ou desligada.'; end if;
  select * into s from public.agente_skills where id = p_skill for update;
  if not found or s.arquivada_em is not null then raise exception 'Skill não encontrada.'; end if;
  if s.ativo = p_ativo then return s.ativo; end if;
  update public.agente_skills set ativo = p_ativo, atualizado_em = now() where id = s.id;
  if p_ativo then perform interno.conferir_limite_sempre(s.agente_id); end if;
  select titulo into v_titulo from public.agente_skill_versoes where skill_id = s.id and versao = s.versao_atual;
  perform public.mudanca_agente(s.agente_id, format('Skill %s %s', v_titulo, case when p_ativo then 'ligada' else 'desligada' end));
  return p_ativo;
end $$;

create function public.restaurar_versao_skill(p_versao uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare v public.agente_skill_versoes%rowtype; s public.agente_skills%rowtype; v_nova int; v_id uuid;
begin
  if not public.eh_dono() then raise exception 'Só o dono altera as skills.'; end if;
  select * into v from public.agente_skill_versoes where id = p_versao;
  if not found then raise exception 'Versão não encontrada.'; end if;
  select * into s from public.agente_skills where id = v.skill_id for update;
  v_nova := s.versao_atual + 1;
  insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md, origem, restaurada_de, autor_id)
  values (s.id, v_nova, v.titulo, v.descricao, v.tipo, v.corpo, v.skill_md, 'restaurada', v.versao, auth.uid()) returning id into v_id;
  insert into public.agente_skill_arquivos (versao_id, caminho, conteudo)
  select v_id, caminho, conteudo from public.agente_skill_arquivos where versao_id = v.id;
  update public.agente_skills set tipo = v.tipo, versao_atual = v_nova, arquivada_em = null, atualizado_em = now() where id = s.id;
  if s.ativo then perform interno.conferir_limite_sempre(s.agente_id); end if;
  perform public.mudanca_agente(s.agente_id, format('Skill %s: versão %s restaurada (vira a %s)', v.titulo, v.versao, v_nova));
  return v_nova;
end $$;

create function public.arquivar_skill(p_skill uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare s public.agente_skills%rowtype; v_titulo text;
begin
  if not public.eh_dono() then raise exception 'Só o dono altera as skills.'; end if;
  select * into s from public.agente_skills where id = p_skill for update;
  if not found or s.arquivada_em is not null then raise exception 'Skill não encontrada.'; end if;
  update public.agente_skills set ativo = false, arquivada_em = now(), atualizado_em = now() where id = s.id;
  select titulo into v_titulo from public.agente_skill_versoes where skill_id = s.id and versao = s.versao_atual;
  perform public.mudanca_agente(s.agente_id, format('Skill %s arquivada', v_titulo));
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.subir_skill(text, jsonb)', 'public.alternar_skill(uuid, boolean)',
                           'public.restaurar_versao_skill(uuid)', 'public.arquivar_skill(uuid)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- O que o trabalhador lê (D5) ----------
-- Ligadas e não arquivadas do próprio agente; `p_incluir`: a skill em teste (mesmo desligada), só se for deste agente.
create function public.skills_do_agente(p_agente uuid, p_incluir uuid default null)
returns table (id uuid, nome text, tipo text, ativo boolean, titulo text, descricao text, corpo text, versao int, arquivos text[])
language sql stable security definer set search_path = '' as $$
  select s.id, s.nome, s.tipo, s.ativo, v.titulo, v.descricao, v.corpo, v.versao,
         array(select a.caminho from public.agente_skill_arquivos a where a.versao_id = v.id order by a.caminho)
  from public.agente_skills s join public.agente_skill_versoes v on v.skill_id = s.id and v.versao = s.versao_atual
  where s.agente_id = p_agente and s.arquivada_em is null and (s.ativo or s.id = p_incluir)
  order by array_position(array['limites', 'jeito', 'procedimento', 'conhecimento', 'exemplos'], s.tipo), s.nome
$$;
create function public.referencia_da_skill(p_agente uuid, p_nome text, p_caminho text, p_incluir uuid default null) returns text
language sql stable security definer set search_path = '' as $$
  select a.conteudo from public.agente_skills s
  join public.agente_skill_versoes v on v.skill_id = s.id and v.versao = s.versao_atual
  join public.agente_skill_arquivos a on a.versao_id = v.id and a.caminho = p_caminho
  where s.agente_id = p_agente and s.nome = p_nome and s.arquivada_em is null and (s.ativo or s.id = p_incluir)
$$;
revoke execute on function public.skills_do_agente(uuid, uuid), public.referencia_da_skill(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.skills_do_agente(uuid, uuid), public.referencia_da_skill(uuid, text, text, uuid) to service_role;

-- ---------- Testar uma skill (D21) ----------
alter table public.simulacoes_agente add column skill_id uuid references public.agente_skills (id) on delete set null;
create index simulacoes_agente_skill_idx on public.simulacoes_agente (skill_id);

-- Mesmas travas de criar_simulacao (20260930000200): uma pendente por pessoa; a mensagem de "já existe" é a mesma (o painel a reconhece).
create function public.criar_simulacao_skill(p_skill uuid, p_mensagem text, p_cliente_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not eh_dono() then raise exception 'Só o dono testa skills.'; end if;
  if not exists (select 1 from agente_skills s join agentes a on a.id = s.agente_id
                 where s.id = p_skill and s.arquivada_em is null and a.porta_de_entrada) then
    raise exception 'Nesta etapa só dá para testar skills do Thiago.';
  end if;
  if p_mensagem is null or length(trim(p_mensagem)) = 0 then raise exception 'Escreva a mensagem do cliente para o teste.'; end if;
  if length(trim(p_mensagem)) > 2000 then raise exception 'A mensagem de teste pode ter no máximo 2000 caracteres.'; end if;
  perform interno.validar_empresa(p_cliente_id);
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  insert into simulacoes_agente (usuario_id, mensagem, cliente_id, skill_id)
  values (auth.uid(), trim(p_mensagem), p_cliente_id, p_skill) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.criar_simulacao_skill(uuid, text, uuid) from public, anon;
grant execute on function public.criar_simulacao_skill(uuid, text, uuid) to authenticated, service_role;
```

- [ ] **Passo 4: aplicar e ver passar**

Run: `supabase db reset && supabase test db supabase/tests/46_painel_v2_agente_skills.test.sql`
Expected: `ok 1` … `ok 36`, `All tests successful`.

Run: `supabase test db`
Expected: todos passam, inclusive `13_simulacao_rascunho_id`, `22` (100/100) e `45`.

- [ ] **Passo 5: tipos e commit** (volte `supabase/config.toml` e `.env` antes)

Run: `pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: sem erros.

```bash
git add supabase/migrations/20261014000200_painel_v2_agente_skills.sql supabase/tests/46_painel_v2_agente_skills.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(banco): skills dos agentes (formato das skills do Claude, versões, liga/desliga, limite do bloco sempre lido, leitura só das ligadas do próprio agente, teste de skill)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Banco. Números do mês, atividade, uso de skills e gastos por agente

**Files:**
- Create: `supabase/migrations/20261014000300_painel_v2_agentes_leituras.sql`
- Create: `supabase/tests/47_painel_v2_agentes_leituras.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: Tasks 2–3; `uso_ia`, `mensagens`, `conversa_eventos`, `decisoes_agente`, `gastos_checar` (20261006000300).
- Produces:
  - `agente_do_uso(p_agente uuid, p_funcionalidade text) → uuid` (interna: registro antigo `agente_clientes`/`testar_agente` = Thiago, D16);
  - `agentes_numeros(p_de timestamptz, p_ate timestamptz) → table (agente_id uuid, atendimentos bigint, resolvidos bigint, custo_usd numeric, custo_testes_usd numeric, ultima_em timestamptz, ultima_empresa text)` (dono e administrador);
  - `atividade_do_agente(p_slug text, p_de timestamptz, p_ate timestamptz) → table (dia date, atendimentos bigint, resolvidos bigint, custo_usd numeric, custo_testes_usd numeric)` (dono e administrador);
  - `uso_skills(p_slug text, p_de timestamptz, p_ate timestamptz) → table (nome text, vezes bigint)` (`pode_ver_agentes`);
  - `gastos_por_agente(p_de timestamptz, p_ate timestamptz) → table (agente_id uuid, slug text, nome text, custo_usd numeric, chamadas bigint)` (administrador, via `gastos_checar`).

- [ ] **Passo 1: escrever o pgTAP que falha**

`supabase/tests/47_painel_v2_agentes_leituras.test.sql`:

```sql
-- Parte I1, Task 4 (spec 7E.2, 7E.3 "Atividade e custo", 7E.8; D10, D16–D18): custo e atendimentos por agente; registro
-- antigo do agente conta para o Thiago; números só para dono e administrador; Gastos por agente só para o administrador.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

update public.usuarios set dono = false where dono;
insert into auth.users (id, email) values
  ('f5300000-0000-0000-0000-00000000000a', 'dono@i1c.local'), ('f5300000-0000-0000-0000-00000000000b', 'admin@i1c.local'),
  ('f5300000-0000-0000-0000-00000000000c', 'ana@i1c.local'), ('f5300000-0000-0000-0000-00000000000d', 'ze@i1c.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('f5300000-0000-0000-0000-00000000000a', 'I1C Dono', 'dono@i1c.local', 'admin', '{}'),
  ('f5300000-0000-0000-0000-00000000000b', 'I1C Admin', 'admin@i1c.local', 'admin', '{}'),
  ('f5300000-0000-0000-0000-00000000000c', 'I1C Ana', 'ana@i1c.local', 'atendente', '{treinar_agente}'),
  ('f5300000-0000-0000-0000-00000000000d', 'I1C Zé', 'ze@i1c.local', 'atendente', '{}');
update public.usuarios set dono = true where id = 'f5300000-0000-0000-0000-00000000000a';
insert into public.clientes (id, razao_social, nome_fantasia, cnpj) values
  ('f5400000-0000-0000-0000-00000000000a', 'I1C Padaria Sol ME', 'I1C Padaria Sol', '11444777000161');
insert into public.conversas (id, telefone) values
  ('f5500000-0000-0000-0000-00000000000a', '5531966660001'), ('f5500000-0000-0000-0000-00000000000b', '5531966660002');
-- 01/10 (Brasília): conversa A só com o agente (antigo sem agente_id + novo com); 02/10: conversa B passa para pessoa; teste do dono.
insert into public.uso_ia (funcionalidade, agente_id, conversa_id, cliente_id, usuario_id, modelo, tokens_entrada, tokens_saida, custo_usd, criado_em) values
  ('agente_clientes', null, 'f5500000-0000-0000-0000-00000000000a', 'f5400000-0000-0000-0000-00000000000a', null, 'm', 1, 1, 0.4, '2026-10-01 13:00Z'),
  ('agente_clientes', 'a0000000-0000-4000-8000-000000000001', 'f5500000-0000-0000-0000-00000000000a', null, null, 'm', 1, 1, 0.2, '2026-10-01 14:00Z'),
  ('agente_clientes', 'a0000000-0000-4000-8000-000000000001', 'f5500000-0000-0000-0000-00000000000b', 'f5400000-0000-0000-0000-00000000000a', null, 'm', 1, 1, 0.3, '2026-10-02 13:00Z'),
  ('testar_agente', null, null, null, 'f5300000-0000-0000-0000-00000000000a', 'm', 1, 1, 0.1, '2026-10-02 15:00Z'),
  ('especialista_setor', (select id from public.agentes where slug = 'fiscal'), null, null, null, 'm', 1, 1, 0.05, '2026-10-03 13:00Z'),
  ('assistente_site', null, null, null, 'f5300000-0000-0000-0000-00000000000b', 'm', 1, 1, 1.0, '2026-10-03 13:00Z');
insert into public.mensagens (conversa_id, direcao, autor, tipo, conteudo, criado_em) values
  ('f5500000-0000-0000-0000-00000000000b', 'saida', 'atendente', 'texto', 'Oi, aqui é a Ana.', '2026-10-02 13:30Z');
insert into public.agente_skills (id, agente_id, nome, tipo, ativo) values
  ('f5600000-0000-0000-0000-00000000000a', 'a0000000-0000-4000-8000-000000000001', 'conferencia-certidao', 'procedimento', true);
insert into public.decisoes_agente (conversa_id, etapa, entrada, criado_em) values
  ('f5500000-0000-0000-0000-00000000000a', 'ler_skill', '{"nome":"conferencia-certidao"}', '2026-10-01 13:00Z'),
  ('f5500000-0000-0000-0000-00000000000b', 'ler_skill', '{"nome":"conferencia-certidao"}', '2026-10-02 13:00Z'),
  ('f5500000-0000-0000-0000-00000000000b', 'ler_skill', '{"nome":"de-outro-agente"}', '2026-10-02 13:00Z');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

-- 1–6: o dono
select results_eq($$ select atendimentos, resolvidos, custo_usd, custo_testes_usd from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z')
  where agente_id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (2::bigint, 1::bigint, 0.9::numeric, 0.1::numeric) $$, 'Thiago: 2 atendimentos, 1 sozinho, custo com o registro antigo, teste à parte');
select results_eq($$ select atendimentos, custo_usd from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z') n
  join public.agentes a on a.id = n.agente_id where a.slug = 'fiscal' $$, $$ values (0::bigint, 0.05::numeric) $$, 'o Fiscal tem o custo dele');
select is((select ultima_empresa from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z')
  where agente_id = 'a0000000-0000-4000-8000-000000000001'), 'I1C Padaria Sol', 'última atividade com a empresa');
select results_eq($$ select dia, atendimentos, resolvidos, custo_usd, custo_testes_usd
  from public.atividade_do_agente('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('2026-10-01'::date, 1::bigint, 1::bigint, 0.6::numeric, 0::numeric), ('2026-10-02'::date, 1::bigint, 0::bigint, 0.3::numeric, 0.1::numeric) $$,
  'atividade por dia (D18)');
select bag_eq($$ select slug, custo_usd, chamadas from public.gastos_por_agente('2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('atendimento', 1.0::numeric, 4::bigint), ('fiscal', 0.05::numeric, 1::bigint) $$, 'Gastos por agente: assistente fica de fora (D17)');
select throws_ok($$ select * from public.agentes_numeros('2026-11-01 03:00Z', '2026-10-01 03:00Z') $$, 'P0001', 'Período inválido.',
  'período invertido: recusa');

-- 7: administrador que não é dono
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z')), 7, 'administrador vê os números');

-- 8–10: quem treina vê o uso das skills, não os números
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select * from public.agentes_numeros('2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Só o dono e o administrador veem os números dos agentes.', 'quem treina não vê custos');
select results_eq($$ select nome, vezes from public.uso_skills('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$,
  $$ values ('conferencia-certidao', 2::bigint) $$, 'uso no mês só das skills do agente (D10)');
select throws_ok($$ select * from public.atividade_do_agente('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Só o dono e o administrador veem os números dos agentes.', 'nem a atividade');

-- 11–13: sem Treinar o agente
select set_config('request.jwt.claims', '{"sub":"f5300000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select throws_ok($$ select * from public.gastos_por_agente('2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Só o administrador vê os gastos com IA.', 'Gastos por agente só do administrador');
select throws_ok($$ select * from public.uso_skills('atendimento', '2026-10-01 03:00Z', '2026-11-01 03:00Z') $$, 'P0001',
  'Você não tem acesso aos agentes.', 'uso das skills só de quem vê os agentes');
select throws_ok($$ select public.agente_do_uso(null, 'agente_clientes') $$, '42501', null, 'a regra interna não é da API');
reset role;
select set_config('request.jwt.claims', '', true);

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db supabase/tests/47_painel_v2_agentes_leituras.test.sql`
Expected: FAIL (`function public.agentes_numeros(...) does not exist`).

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261014000300_painel_v2_agentes_leituras.sql`:

```sql
-- supabase/migrations/20261014000300_painel_v2_agentes_leituras.sql
-- Painel v2, Parte I1 (spec 7E.2, 7E.3 "Atividade e custo", 7E.8): números do mês por agente (dono e administrador),
-- atividade por dia, uso das skills e o bloco "Por agente" de Gastos com IA (só administrador). Antes da Parte I todo gasto
-- de agente era do Thiago (D16).

create function public.agente_do_uso(p_agente uuid, p_funcionalidade text) returns uuid
language sql immutable set search_path = '' as $$
  select coalesce(p_agente, case when p_funcionalidade in ('agente_clientes', 'testar_agente')
                                 then 'a0000000-0000-4000-8000-000000000001'::uuid end)
$$;
revoke execute on function public.agente_do_uso(uuid, text) from public, anon, authenticated;

create function public.agentes_checar_numeros(p_de timestamptz, p_ate timestamptz) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (public.eh_admin() or public.eh_dono()) then raise exception 'Só o dono e o administrador veem os números dos agentes.'; end if;
  if p_de is null or p_ate is null or p_ate <= p_de or p_ate - p_de > interval '367 days' then raise exception 'Período inválido.'; end if;
end $$;
revoke execute on function public.agentes_checar_numeros(timestamptz, timestamptz) from public, anon, authenticated;

-- A mesma regra de gastos_atendimentos_base (20261006000300): um atendimento por (conversa, dia de Brasília); passou para
-- pessoa = resposta humana ou assumir no dia. Só as chamadas do agente, sem os testes.
create function public.agente_atendimentos_base(p_agente uuid, p_de timestamptz, p_ate timestamptz)
returns table (conversa_id uuid, dia date, cliente_id uuid, custo_usd numeric, passou_para_pessoa boolean, ultima_em timestamptz)
language sql stable security definer set search_path = '' as $$
  with a as (
    select u.conversa_id, (u.criado_em at time zone 'America/Sao_Paulo')::date as dia,
           (array_agg(u.cliente_id order by u.criado_em desc, u.id desc) filter (where u.cliente_id is not null))[1] as cliente_id,
           sum(u.custo_usd) as custo_usd, max(u.criado_em) as ultima_em
    from public.uso_ia u
    where u.conversa_id is not null and u.funcionalidade <> 'testar_agente'
      and public.agente_do_uso(u.agente_id, u.funcionalidade) = p_agente
      and u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2
  )
  select a.conversa_id, a.dia, a.cliente_id, a.custo_usd,
         exists (select 1 from public.mensagens m
                  where m.conversa_id = a.conversa_id and m.autor = 'atendente'
                    and m.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and m.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo'))
         or exists (select 1 from public.conversa_eventos e
                  where e.conversa_id = a.conversa_id and e.tipo = 'assumida'
                    and e.criado_em >= (a.dia::timestamp at time zone 'America/Sao_Paulo')
                    and e.criado_em < ((a.dia + 1)::timestamp at time zone 'America/Sao_Paulo')),
         a.ultima_em
  from a
$$;
revoke execute on function public.agente_atendimentos_base(uuid, timestamptz, timestamptz) from public, anon, authenticated;

create function public.agentes_numeros(p_de timestamptz, p_ate timestamptz)
returns table (agente_id uuid, atendimentos bigint, resolvidos bigint, custo_usd numeric, custo_testes_usd numeric,
               ultima_em timestamptz, ultima_empresa text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.agentes_checar_numeros(p_de, p_ate);
  return query
    with b as (
      select g.id as agente, x.* from public.agentes g, lateral public.agente_atendimentos_base(g.id, p_de, p_ate) x
    ), c as (
      select public.agente_do_uso(u.agente_id, u.funcionalidade) as agente,
             sum(u.custo_usd) filter (where u.funcionalidade <> 'testar_agente') as custo,
             sum(u.custo_usd) filter (where u.funcionalidade = 'testar_agente') as testes
      from public.uso_ia u where u.criado_em >= p_de and u.criado_em < p_ate group by 1
    )
    select g.id,
           (select count(*) from b where b.agente = g.id),
           (select count(*) from b where b.agente = g.id and not b.passou_para_pessoa),
           coalesce((select c.custo from c where c.agente = g.id), 0),
           coalesce((select c.testes from c where c.agente = g.id), 0),
           (select max(b.ultima_em) from b where b.agente = g.id),
           (select coalesce(e.nome_fantasia, e.razao_social) from b join public.clientes e on e.id = b.cliente_id
             where b.agente = g.id order by b.ultima_em desc limit 1)
    from public.agentes g order by g.ordem;
end $$;

create function public.atividade_do_agente(p_slug text, p_de timestamptz, p_ate timestamptz)
returns table (dia date, atendimentos bigint, resolvidos bigint, custo_usd numeric, custo_testes_usd numeric)
language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  perform public.agentes_checar_numeros(p_de, p_ate);
  select id into v from public.agentes where slug = p_slug;
  if v is null then raise exception 'Agente não encontrado.'; end if;
  return query
    with b as (select * from public.agente_atendimentos_base(v, p_de, p_ate)),
    t as (
      select (u.criado_em at time zone 'America/Sao_Paulo')::date as dia, sum(u.custo_usd) as custo from public.uso_ia u
      where u.funcionalidade = 'testar_agente' and public.agente_do_uso(u.agente_id, u.funcionalidade) = v
        and u.criado_em >= p_de and u.criado_em < p_ate group by 1
    ),
    dias as (select b.dia from b union select t.dia from t)
    select d.dia, count(b.conversa_id), count(b.conversa_id) filter (where not b.passou_para_pessoa),
           coalesce(sum(b.custo_usd), 0), coalesce(max(t.custo), 0)
    from dias d left join b on b.dia = d.dia left join t on t.dia = d.dia
    group by d.dia order by d.dia;
end $$;

-- "Uso no mês" das skills (D10): leituras pelo nome das skills deste agente.
create function public.uso_skills(p_slug text, p_de timestamptz, p_ate timestamptz) returns table (nome text, vezes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_ver_agentes() then raise exception 'Você não tem acesso aos agentes.'; end if;
  if p_de is null or p_ate is null or p_ate <= p_de or p_ate - p_de > interval '367 days' then raise exception 'Período inválido.'; end if;
  return query
    select d.entrada ->> 'nome', count(*) from public.decisoes_agente d
    where d.etapa = 'ler_skill' and d.criado_em >= p_de and d.criado_em < p_ate
      and d.entrada ->> 'nome' in (select s.nome from public.agente_skills s join public.agentes a on a.id = s.agente_id where a.slug = p_slug)
    group by 1;
end $$;

create function public.gastos_por_agente(p_de timestamptz, p_ate timestamptz)
returns table (agente_id uuid, slug text, nome text, custo_usd numeric, chamadas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.gastos_checar(p_de, p_ate);
  return query
    select g.id, g.slug, g.nome, sum(u.custo_usd), count(*)
    from public.uso_ia u join public.agentes g on g.id = public.agente_do_uso(u.agente_id, u.funcionalidade)
    where u.criado_em >= p_de and u.criado_em < p_ate
    group by 1, 2, 3 order by 4 desc, 3;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.agentes_numeros(timestamptz, timestamptz)', 'public.atividade_do_agente(text, timestamptz, timestamptz)',
    'public.uso_skills(text, timestamptz, timestamptz)', 'public.gastos_por_agente(timestamptz, timestamptz)'] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
```

- [ ] **Passo 4: aplicar e ver passar**

Run: `supabase db reset && supabase test db supabase/tests/47_painel_v2_agentes_leituras.test.sql`
Expected: `ok 1` … `ok 13`, `All tests successful`.

Run: `supabase test db`
Expected: todos passam (`22` 100/100, `32`–`34`, `45`, `46`).

- [ ] **Passo 5: tipos e commit** (volte `supabase/config.toml` e `.env` antes)

Run: `pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck`
Expected: sem erros.

```bash
git add supabase/migrations/20261014000300_painel_v2_agentes_leituras.sql supabase/tests/47_painel_v2_agentes_leituras.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(banco): números e atividade por agente, uso das skills e gastos por agente (registro antigo conta para o Thiago)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 5: Core. Constantes dos agentes, catálogo, `SKILL.md`, pacote, diferença e endereço

**Files:**
- Create: `packages/core/src/agentes.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/test/agentes.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces (todos exportados por `@escritorio/core`):
  - `AGENTE_ATENDIMENTO_ID = 'a0000000-0000-4000-8000-000000000001'`, `SLUG_ATENDIMENTO = 'atendimento'`;
  - `ESTADOS_AGENTE`, `type EstadoAgente`, `ROTULO_ESTADO`; `MODOS_CONTATO`, `type ModoContato`, `INFO_MODO` (`rotulo`, `explicacao`, `bomPara`), `TEXTO_FALA_THIAGO`; `TIPOS_AGENTE`, `type TipoAgente`, `ROTULO_TIPO_AGENTE`;
  - `TIPOS_SKILL`, `type TipoSkill`, `INFO_TIPO_SKILL` (`ordem`, `rotulo`, `titulo`, `quando`, `explicacao`, `sempre`), `ORDEM_PRIORIDADE`;
  - `type EfeitoFerramenta = 'leitura' | 'grava' | 'envia'`, `type InfoFerramenta`, `CATALOGO_FERRAMENTAS`, `FERRAMENTAS_ATENDIMENTO: string[]` (as 16, na ordem do trabalhador), `FERRAMENTAS_AUTOMATICAS` (`ler_skill`, `ler_referencia`), `exigeAprovacao(info)`;
  - `LIMITES_SKILL`, `type ArquivoSkill = { caminho: string; conteudo: string }`, `type PacoteSkill = { nome; titulo; descricao; tipo: TipoSkill; corpo; skill_md; arquivos: ArquivoSkill[] }`, `tipoDoTexto(v: string): TipoSkill | null`, `lerSkillMd(texto)`, `montarPacoteSkill(arquivos: ArquivoSkill[], tipoEscolhido: TipoSkill | null): ResultadoPacote`;
  - `type LinhaDiferenca = { tipo: 'igual' | 'mais' | 'menos'; texto: string }`, `diferencaLinhas(antes: string, depois: string): LinhaDiferenca[]`;
  - `slugDoNome(nome: string): string`.

- [ ] **Passo 1: escrever os testes que falham**

`packages/core/test/agentes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  CATALOGO_FERRAMENTAS, FERRAMENTAS_ATENDIMENTO, INFO_TIPO_SKILL, TIPOS_SKILL, diferencaLinhas, exigeAprovacao, lerSkillMd,
  montarPacoteSkill, slugDoNome, tipoDoTexto,
} from '../src';

const md = (cabecalho: string, corpo = '# Título da skill\nTexto.') => `---\n${cabecalho}\n---\n${corpo}`;

describe('catálogo de ferramentas (D15)', () => {
  it('as 16 do Thiago, na ordem de FERRAMENTAS do trabalhador', () => {
    expect(FERRAMENTAS_ATENDIMENTO).toEqual([
      'selecionar_empresa', 'abrir_chamado', 'consultar_chamados', 'sinalizar_nao_entendido', 'passar_para_pessoa', 'buscar_parceiros',
      'buscar_produtos', 'resumir_pedido_nota', 'abrir_pedido_nota', 'listar_documentos', 'enviar_documento', 'consultar_cadastro',
      'consultar_preco', 'alterar_preco', 'cadastrar_produto', 'responder',
    ]);
  });
  it('só leitura × grava/envia (aprovação)', () => {
    expect(exigeAprovacao(CATALOGO_FERRAMENTAS.consultar_chamados)).toBe(false);
    expect(exigeAprovacao(CATALOGO_FERRAMENTAS.responder)).toBe(true);
    expect(CATALOGO_FERRAMENTAS.enviar_documento.efeito).toBe('envia');
    expect(CATALOGO_FERRAMENTAS.alterar_preco.efeito).toBe('grava');
  });
});

describe('tipos de skill (spec 7E.3)', () => {
  it('ordem da tela e só Jeito e Limites sempre lidos', () => {
    expect([...TIPOS_SKILL].sort((a, b) => INFO_TIPO_SKILL[a].ordem - INFO_TIPO_SKILL[b].ordem))
      .toEqual(['jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos']);
    expect(TIPOS_SKILL.filter((t) => INFO_TIPO_SKILL[t].sempre)).toEqual(['jeito', 'limites']);
  });
  it('tipo escrito de vários jeitos (D8)', () => {
    expect(tipoDoTexto('Jeito de atuar')).toBe('jeito');
    expect(tipoDoTexto('LIMITES')).toBe('limites');
    expect(tipoDoTexto('Procedimentos')).toBe('procedimento');
    expect(tipoDoTexto('exemplo')).toBe('exemplos');
    expect(tipoDoTexto('Conhecimentos')).toBe('conhecimento');
    expect(tipoDoTexto('qualquer')).toBeNull();
  });
});

describe('lerSkillMd', () => {
  it('lê name, description (com aspas e continuação), tipo e o título do texto', () => {
    const r = lerSkillMd(md('name: tabela-cfop\ndescription: "CFOPs de venda,\n  devolução e remessa."\ntipo: conhecimento'));
    expect(r).toEqual({ ok: true, skill: { nome: 'tabela-cfop', descricao: 'CFOPs de venda, devolução e remessa.', tipo: 'conhecimento',
      titulo: 'Título da skill', corpo: '# Título da skill\nTexto.' } });
  });
  it('sem tipo: tipo null; sem # título: o name', () => {
    const r = lerSkillMd(md('name: jeito-do-fiscal\ndescription: Tom.', 'Fala curta.'));
    expect(r).toMatchObject({ ok: true, skill: { tipo: null, titulo: 'jeito-do-fiscal' } });
  });
  it('arquivo do Windows (CRLF e BOM)', () => {
    expect(lerSkillMd(`﻿---\r\nname: a\r\ndescription: b\r\n---\r\nTexto.`)).toMatchObject({ ok: true, skill: { nome: 'a', corpo: 'Texto.' } });
  });
  it('recusas com a frase para a pessoa', () => {
    expect(lerSkillMd('# Sem cabeçalho')).toEqual({ ok: false, erro: 'O SKILL.md precisa começar com o cabeçalho entre linhas "---" (name, description e tipo).' });
    expect(lerSkillMd(md('description: x'))).toEqual({ ok: false, erro: 'Falta "name" no cabeçalho do SKILL.md.' });
    expect(lerSkillMd(md('name: Tabela CFOP\ndescription: x'))).toEqual({ ok: false,
      erro: 'O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.' });
    expect(lerSkillMd(md('name: a'))).toEqual({ ok: false, erro: 'Falta "description" no cabeçalho do SKILL.md.' });
    expect(lerSkillMd(md('name: a\ndescription: b\ntipo: regra'))).toEqual({ ok: false,
      erro: 'Tipo desconhecido no cabeçalho: "regra". Use jeito, limites, procedimento, conhecimento ou exemplos.' });
    expect(lerSkillMd(md('name: a\ndescription: b', 'x'.repeat(20_001)))).toEqual({ ok: false, erro: 'O texto do SKILL.md passa de 20.000 caracteres.' });
  });
});

describe('montarPacoteSkill (pasta, .zip e .md)', () => {
  const skill = md('name: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento');
  it('pasta (ou .zip) com uma pasta em volta, lixo do macOS e arquivo oculto', () => {
    const r = montarPacoteSkill([
      { caminho: 'tabela-cfop/SKILL.md', conteudo: skill }, { caminho: 'tabela-cfop/refs/cfop.csv', conteudo: '5102;Venda' },
      { caminho: '__MACOSX/tabela-cfop/._SKILL.md', conteudo: 'x' }, { caminho: 'tabela-cfop/.DS_Store', conteudo: 'x' },
    ], null);
    expect(r).toEqual({ ok: true, pacote: { nome: 'tabela-cfop', titulo: 'Título da skill', descricao: 'CFOPs.', tipo: 'conhecimento',
      corpo: '# Título da skill\nTexto.', skill_md: skill, arquivos: [{ caminho: 'refs/cfop.csv', conteudo: '5102;Venda' }] } });
  });
  it('um .md solto é o SKILL.md; sem tipo, vale o escolhido; sem nenhum, pergunta', () => {
    const solto = md('name: limite-x\ndescription: Limite.');
    expect(montarPacoteSkill([{ caminho: 'limite.md', conteudo: solto }], 'limites')).toMatchObject({ ok: true, pacote: { tipo: 'limites', arquivos: [] } });
    expect(montarPacoteSkill([{ caminho: 'limite.md', conteudo: solto }], null)).toEqual({ ok: false, precisaTipo: true, nome: 'limite-x', titulo: 'Título da skill' });
  });
  it('o tipo do cabeçalho vence o escolhido na tela', () => {
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }], 'limites')).toMatchObject({ ok: true, pacote: { tipo: 'conhecimento' } });
  });
  it('recusas: sem SKILL.md, PDF, outro formato, binário, caminho com .., arquivos demais', () => {
    expect(montarPacoteSkill([{ caminho: 'a.txt', conteudo: 'x' }, { caminho: 'b.txt', conteudo: 'y' }], null))
      .toEqual({ ok: false, erro: 'Não achei o SKILL.md (na raiz da pasta ou do .zip).' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'guia.pdf', conteudo: '%PDF' }], null))
      .toEqual({ ok: false, erro: 'PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho).' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'planilha.xlsx', conteudo: 'x' }], null))
      .toEqual({ ok: false, erro: 'O arquivo "planilha.xlsx" não é .md, .txt nem .csv.' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'a.txt', conteudo: 'a\u0000b' }], null))
      .toEqual({ ok: false, erro: 'O arquivo "a.txt" não é texto.' });
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, { caminho: 'x/../y.md', conteudo: 'a' }], null))
      .toEqual({ ok: false, erro: 'Nome de arquivo inválido: "x/../y.md".' });
    const muitos = Array.from({ length: 21 }, (_, i) => ({ caminho: `r${i}.md`, conteudo: 'x' }));
    expect(montarPacoteSkill([{ caminho: 'SKILL.md', conteudo: skill }, ...muitos], null))
      .toEqual({ ok: false, erro: 'No máximo 20 arquivos de referência por skill.' });
    expect(montarPacoteSkill([], null)).toEqual({ ok: false, erro: 'Nenhum arquivo para subir.' });
  });
});

describe('diferencaLinhas (D9)', () => {
  it('linhas iguais, tiradas e postas', () => {
    expect(diferencaLinhas('a\nb\nc', 'a\nB\nc\nd')).toEqual([
      { tipo: 'igual', texto: 'a' }, { tipo: 'menos', texto: 'b' }, { tipo: 'mais', texto: 'B' }, { tipo: 'igual', texto: 'c' },
      { tipo: 'mais', texto: 'd' },
    ]);
  });
});

describe('slugDoNome (D25)', () => {
  it('sem acento, minúsculo, com hífen, até 40, começando por letra', () => {
    expect(slugDoNome('Agente de Legalização')).toBe('agente-de-legalizacao');
    expect(slugDoNome('  IRPF 2027!! ')).toBe('irpf-2027');
    expect(slugDoNome('123')).toBe('agente-123');
    expect(slugDoNome('!!!')).toBe('agente');
    expect(slugDoNome('x'.repeat(60))).toHaveLength(40);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/core exec vitest run test/agentes.test.ts`
Expected: FAIL (os nomes não existem em `../src`).

- [ ] **Passo 3: implementar**

`packages/core/src/agentes.ts`:

```ts
/** Parte I1 (spec 7E): agentes por departamento — constantes e regras puras do painel e do trabalhador. */

export const AGENTE_ATENDIMENTO_ID = 'a0000000-0000-4000-8000-000000000001';
export const SLUG_ATENDIMENTO = 'atendimento';

export const ESTADOS_AGENTE = ['desligado', 'teste', 'ligado'] as const;
export type EstadoAgente = (typeof ESTADOS_AGENTE)[number];
export const ROTULO_ESTADO: Record<EstadoAgente, string> = { desligado: 'Desligado', teste: 'Teste', ligado: 'Ligado' };

export const MODOS_CONTATO = ['por_tras', 'mesma_voz', 'passa_conversa'] as const;
export type ModoContato = (typeof MODOS_CONTATO)[number];
/** Os três modos de falar com o cliente (spec 7E.3, textos da imagem 00-agente-ficha). */
export const INFO_MODO: Record<ModoContato, { rotulo: string; explicacao: string; bomPara: string }> = {
  por_tras: {
    rotulo: 'Por trás',
    explicacao: 'O cliente só fala com o Thiago. O agente trabalha nos bastidores e devolve a resposta para o Thiago repassar.',
    bomPara: 'conferências e tarefas em que o cliente não precisa saber quem fez.',
  },
  mesma_voz: {
    rotulo: 'Mesma voz',
    explicacao: 'O agente responde direto na conversa, com o mesmo nome e o tom do escritório. Para o cliente, é uma conversa só.',
    bomPara: 'pedidos do dia a dia que o agente resolve sozinho, como nota de venda.',
  },
  passa_conversa: {
    rotulo: 'Passa a conversa',
    explicacao: 'O Thiago avisa o cliente e passa a conversa; o agente se apresenta pelo setor e segue até o fim.',
    bomPara: 'assuntos longos ou delicados, com várias perguntas e idas e voltas.',
  },
};
/** O Thiago não tem modo: ele é quem fala (D13). */
export const TEXTO_FALA_THIAGO = 'Direto, é a voz do escritório';

export const TIPOS_AGENTE = ['conversa', 'trabalho'] as const;
export type TipoAgente = (typeof TIPOS_AGENTE)[number];
export const ROTULO_TIPO_AGENTE: Record<TipoAgente, string> = { conversa: 'Conversa', trabalho: 'Trabalho' };

export const TIPOS_SKILL = ['jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos'] as const;
export type TipoSkill = (typeof TIPOS_SKILL)[number];
/** Grupos da aba Skills (spec 7E.3): cada grupo diz quando o agente lê. */
export const INFO_TIPO_SKILL: Record<TipoSkill, { ordem: number; rotulo: string; titulo: string; quando: string; explicacao: string; sempre: boolean }> = {
  jeito: { ordem: 1, rotulo: 'Jeito de atuar', titulo: 'Jeito de atuar', quando: 'sempre lido',
    explicacao: 'Tom, como se apresenta, como escreve.', sempre: true },
  limites: { ordem: 2, rotulo: 'Limites', titulo: 'Limites — o que não pode fazer', quando: 'sempre lido · vence qualquer outra skill e orientação',
    explicacao: 'Proibições. Se um procedimento ou orientação disser o contrário, o limite vale.', sempre: true },
  procedimento: { ordem: 3, rotulo: 'Procedimentos', titulo: 'Procedimentos', quando: 'lido quando a tarefa aparece',
    explicacao: 'Passo a passo de uma tarefa. O agente vê nome e descrição; abre o resto quando precisa.', sempre: false },
  conhecimento: { ordem: 4, rotulo: 'Conhecimento', titulo: 'Conhecimento', quando: 'consultado sob demanda',
    explicacao: 'Referências que o agente busca quando o assunto pede.', sempre: false },
  exemplos: { ordem: 5, rotulo: 'Exemplos', titulo: 'Exemplos', quando: 'consultado sob demanda',
    explicacao: 'Casos bons e ruins de conversas reais, para o agente imitar ou evitar.', sempre: false },
};
export const ORDEM_PRIORIDADE = ['Regras fixas do sistema', 'Limites', 'Jeito de atuar', 'Procedimentos', 'Orientações da equipe'] as const;

export type EfeitoFerramenta = 'leitura' | 'grava' | 'envia';
export type InfoFerramenta = { rotulo: string; descricao: string; efeito: EfeitoFerramenta };
/** Catálogo (D15): as 16 ferramentas do Thiago, na ordem de FERRAMENTAS do trabalhador. O banco tem a mesma lista (ferramentas_do_catalogo). */
export const CATALOGO_FERRAMENTAS = {
  selecionar_empresa: { rotulo: 'Escolher a empresa da conversa', descricao: 'Quando o contato fala por mais de uma empresa.', efeito: 'grava' },
  abrir_chamado: { rotulo: 'Abrir demanda', descricao: 'Passa o pedido para o setor certo.', efeito: 'grava' },
  consultar_chamados: { rotulo: 'Ler demandas da empresa', descricao: 'Andamento do que já foi pedido (pelo acesso do contato).', efeito: 'leitura' },
  sinalizar_nao_entendido: { rotulo: 'Avisar que não entendeu', descricao: 'Na segunda vez, passa para uma pessoa.', efeito: 'grava' },
  passar_para_pessoa: { rotulo: 'Passar para uma pessoa', descricao: 'Quando o cliente pede para falar com alguém.', efeito: 'grava' },
  buscar_parceiros: { rotulo: 'Buscar clientes e fornecedores da empresa', descricao: 'Para nota e preço.', efeito: 'leitura' },
  buscar_produtos: { rotulo: 'Buscar produtos', descricao: 'Para nota e preço.', efeito: 'leitura' },
  resumir_pedido_nota: { rotulo: 'Mandar o resumo do pedido de nota', descricao: 'O cliente confere antes de passar ao Fiscal.', efeito: 'envia' },
  abrir_pedido_nota: { rotulo: 'Passar o pedido de nota ao Fiscal', descricao: 'Só depois de o cliente confirmar o resumo.', efeito: 'grava' },
  listar_documentos: { rotulo: 'Listar documentos da empresa', descricao: 'Os liberados para o contato.', efeito: 'leitura' },
  enviar_documento: { rotulo: 'Enviar documento ao cliente', descricao: 'Só documento liberado para a IA e para o contato.', efeito: 'envia' },
  consultar_cadastro: { rotulo: 'Ler dados cadastrais', descricao: 'CNPJ, razão social, endereço, regime.', efeito: 'leitura' },
  consultar_preco: { rotulo: 'Consultar preço da tabela', descricao: 'Preço vigente de um produto para uma rede.', efeito: 'leitura' },
  alterar_preco: { rotulo: 'Mudar preço', descricao: 'Só com o "sim" do cliente e a permissão dele.', efeito: 'grava' },
  cadastrar_produto: { rotulo: 'Cadastrar produto', descricao: 'Só com o "sim" do cliente e a permissão dele.', efeito: 'grava' },
  responder: { rotulo: 'Responder ao cliente', descricao: 'Manda a mensagem no WhatsApp.', efeito: 'envia' },
} as const satisfies Record<string, InfoFerramenta>;
export type NomeFerramentaCatalogo = keyof typeof CATALOGO_FERRAMENTAS;
export const FERRAMENTAS_ATENDIMENTO = Object.keys(CATALOGO_FERRAMENTAS) as NomeFerramentaCatalogo[];
/** Entram sozinhas quando o agente tem skill sob demanda ligada (D5). */
export const FERRAMENTAS_AUTOMATICAS: Record<'ler_skill' | 'ler_referencia', InfoFerramenta> = {
  ler_skill: { rotulo: 'Ler uma skill', descricao: 'Abre o texto de um procedimento, conhecimento ou exemplo.', efeito: 'leitura' },
  ler_referencia: { rotulo: 'Ler arquivo de apoio de uma skill', descricao: 'Abre um arquivo de referência da skill.', efeito: 'leitura' },
};
export const exigeAprovacao = (f: InfoFerramenta): boolean => f.efeito !== 'leitura';

export const LIMITES_SKILL = {
  skillMd: 25_000, corpo: 20_000, descricao: 1_024, titulo: 120, arquivo: 200_000, arquivos: 20, total: 1_000_000, sempre: 10_000,
} as const;
export type ArquivoSkill = { caminho: string; conteudo: string };
export type PacoteSkill = { nome: string; titulo: string; descricao: string; tipo: TipoSkill; corpo: string; skill_md: string; arquivos: ArquivoSkill[] };
export type SkillMdLida = { nome: string; descricao: string; tipo: TipoSkill | null; titulo: string; corpo: string };
export type ResultadoSkillMd = { ok: true; skill: SkillMdLida } | { ok: false; erro: string };
export type ResultadoPacote =
  | { ok: true; pacote: PacoteSkill }
  | { ok: false; erro: string }
  | { ok: false; precisaTipo: true; nome: string; titulo: string };

const NOME_SKILL = /^[a-z0-9][a-z0-9-]{0,63}$/;
const semAcento = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '');
const erro = (e: string) => ({ ok: false as const, erro: e });

const SINONIMOS: Record<string, TipoSkill> = {
  jeito: 'jeito', 'jeito-de-atuar': 'jeito', '1': 'jeito',
  limites: 'limites', limite: 'limites', 'o-que-nao-pode-fazer': 'limites', '2': 'limites',
  procedimento: 'procedimento', procedimentos: 'procedimento', '3': 'procedimento',
  conhecimento: 'conhecimento', conhecimentos: 'conhecimento', '4': 'conhecimento',
  exemplos: 'exemplos', exemplo: 'exemplos', '5': 'exemplos',
};
/** Tipo escrito no cabeçalho (D8): com ou sem acento, singular ou plural. */
export function tipoDoTexto(v: string): TipoSkill | null {
  return SINONIMOS[semAcento(v).toLowerCase().trim().replace(/[\s_]+/g, '-')] ?? null;
}

const tirarAspas = (v: string) => (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);

/** Subconjunto do YAML das skills do Claude: "chave: valor", aspas opcionais, linhas recuadas continuam o valor, ">" e "|" aceitos. */
function lerCabecalho(bloco: string): Record<string, string> {
  const campos: Record<string, string> = {};
  let atual: string | null = null;
  for (const linha of bloco.split('\n')) {
    const c = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(linha);
    if (c) {
      atual = c[1]!.toLowerCase();
      const v = c[2]!.trim();
      campos[atual] = ['>', '|', '>-', '|-'].includes(v) ? '' : tirarAspas(v);
      continue;
    }
    if (atual && /^\s+\S/.test(linha)) campos[atual] = tirarAspas(`${campos[atual] ?? ''} ${linha.trim()}`.trim());
  }
  return campos;
}

/** SKILL.md no formato das skills do Claude (spec 7E.3): cabeçalho com name, description e tipo; o resto é o texto. */
export function lerSkillMd(texto: string): ResultadoSkillMd {
  const t = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(t);
  if (!m) return erro('O SKILL.md precisa começar com o cabeçalho entre linhas "---" (name, description e tipo).');
  const campos = lerCabecalho(m[1]!);
  const corpo = t.slice(m[0].length).trim();
  const nome = (campos.name ?? '').trim();
  if (!nome) return erro('Falta "name" no cabeçalho do SKILL.md.');
  if (!NOME_SKILL.test(nome)) return erro('O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.');
  const descricao = (campos.description ?? '').trim();
  if (!descricao) return erro('Falta "description" no cabeçalho do SKILL.md.');
  if (descricao.length > LIMITES_SKILL.descricao) return erro('A "description" tem mais de 1.024 caracteres.');
  if (!corpo) return erro('O SKILL.md não tem texto depois do cabeçalho.');
  if (corpo.length > LIMITES_SKILL.corpo) return erro('O texto do SKILL.md passa de 20.000 caracteres.');
  if (t.length > LIMITES_SKILL.skillMd) return erro('O SKILL.md passa de 25.000 caracteres.');
  let tipo: TipoSkill | null = null;
  if (campos.tipo?.trim()) {
    tipo = tipoDoTexto(campos.tipo);
    if (!tipo) return erro(`Tipo desconhecido no cabeçalho: "${campos.tipo.trim()}". Use jeito, limites, procedimento, conhecimento ou exemplos.`);
  }
  const titulo = (/^#\s+(.+)$/m.exec(corpo)?.[1] ?? nome).trim().slice(0, LIMITES_SKILL.titulo);
  return { ok: true, skill: { nome, descricao, tipo, titulo, corpo } };
}

/**
 * Arquivos subidos (pasta, .zip ou .md) → pacote que o banco grava (subir_skill). Tira a pasta de fora, o lixo do macOS e os
 * ocultos; um .md solto é o SKILL.md; referências só .md, .txt e .csv (D7). Tipo: o do cabeçalho; senão o escolhido; senão pergunta.
 */
export function montarPacoteSkill(arquivos: ArquivoSkill[], tipoEscolhido: TipoSkill | null): ResultadoPacote {
  const uteis = arquivos
    .map((a) => ({ ...a, caminho: a.caminho.replace(/\\/g, '/').replace(/^\.?\//, '') }))
    .filter((a) => a.caminho && !a.caminho.endsWith('/') && !a.caminho.split('/').some((p) => p === '__MACOSX' || p.startsWith('.')));
  if (!uteis.length) return erro('Nenhum arquivo para subir.');
  const partes = uteis.map((a) => a.caminho.split('/'));
  const raiz = partes.every((p) => p.length > 1 && p[0] === partes[0]![0]) ? partes[0]![0]! : null;
  const sem = raiz ? uteis.map((a) => ({ ...a, caminho: a.caminho.slice(raiz.length + 1) })) : uteis;
  let principal = sem.find((a) => a.caminho.toLowerCase() === 'skill.md');
  if (!principal && sem.length === 1 && /\.md$/i.test(sem[0]!.caminho)) principal = sem[0];
  if (!principal) return erro('Não achei o SKILL.md (na raiz da pasta ou do .zip).');
  const referencias = sem.filter((a) => a !== principal);
  for (const r of referencias) {
    if (/\.pdf$/i.test(r.caminho)) return erro('PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho).');
    if (!/\.(md|txt|csv)$/i.test(r.caminho)) return erro(`O arquivo "${r.caminho}" não é .md, .txt nem .csv.`);
    // eslint-disable-next-line no-control-regex
    if (r.caminho.length > 200 || r.caminho.split('/').includes('..') || /[\u0000-\u001f\u007f]/.test(r.caminho)) {
      return erro(`Nome de arquivo inválido: "${r.caminho}".`);
    }
    if (r.conteudo.includes('\u0000')) return erro(`O arquivo "${r.caminho}" não é texto.`);
    if (r.conteudo.length > LIMITES_SKILL.arquivo) return erro(`O arquivo "${r.caminho}" passa de 200.000 caracteres.`);
  }
  if (referencias.length > LIMITES_SKILL.arquivos) return erro('No máximo 20 arquivos de referência por skill.');
  if (referencias.reduce((s, r) => s + r.conteudo.length, 0) > LIMITES_SKILL.total) {
    return erro('Os arquivos de referência passam de 1.000.000 de caracteres somados.');
  }
  const lida = lerSkillMd(principal.conteudo);
  if (!lida.ok) return lida;
  const tipo = lida.skill.tipo ?? tipoEscolhido;
  if (!tipo) return { ok: false, precisaTipo: true, nome: lida.skill.nome, titulo: lida.skill.titulo };
  return {
    ok: true,
    pacote: {
      nome: lida.skill.nome, titulo: lida.skill.titulo, descricao: lida.skill.descricao, tipo, corpo: lida.skill.corpo,
      skill_md: principal.conteudo.replace(/^﻿/, '').replace(/\r\n?/g, '\n'),
      arquivos: referencias.map((r) => ({ caminho: r.caminho, conteudo: r.conteudo })).sort((a, b) => a.caminho.localeCompare(b.caminho)),
    },
  };
}

export type LinhaDiferenca = { tipo: 'igual' | 'mais' | 'menos'; texto: string };
/** Diferença linha a linha entre duas versões (D9). Texto grande demais para comparar: tudo tirado e tudo posto. */
export function diferencaLinhas(antes: string, depois: string): LinhaDiferenca[] {
  const a = antes.replace(/\r\n?/g, '\n').split('\n');
  const b = depois.replace(/\r\n?/g, '\n').split('\n');
  const menos = (texto: string): LinhaDiferenca => ({ tipo: 'menos', texto });
  const mais = (texto: string): LinhaDiferenca => ({ tipo: 'mais', texto });
  if (a.length * b.length > 4_000_000) return [...a.map(menos), ...b.map(mais)];
  const t = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
    }
  }
  const r: LinhaDiferenca[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { r.push({ tipo: 'igual', texto: a[i]! }); i++; j++; }
    else if (t[i + 1]![j]! >= t[i]![j + 1]!) r.push(menos(a[i++]!));
    else r.push(mais(b[j++]!));
  }
  while (i < a.length) r.push(menos(a[i++]!));
  while (j < b.length) r.push(mais(b[j++]!));
  return r;
}

/** Endereço do agente a partir do nome (D25): sem acento, minúsculo, hífen, até 40, começando por letra. */
export function slugDoNome(nome: string): string {
  const s = semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) return 'agente';
  return (/^[a-z]/.test(s) ? s : `agente-${s}`).slice(0, 40).replace(/-+$/, '');
}
```

Em `packages/core/src/index.ts`, acrescente no fim: `export * from './agentes';`.

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/core test && pnpm --filter @escritorio/core typecheck`
Expected: tudo passa (inclusive `passagem.test.ts`, que confere `FUNCIONALIDADES_IA` sem mudança).

- [ ] **Passo 5: commit**

```bash
git add packages/core/src/agentes.ts packages/core/src/index.ts packages/core/test/agentes.test.ts
git commit -m "$(cat <<'EOF'
feat(core): agentes (estados, modos, tipos de skill, catálogo de ferramentas, SKILL.md, pacote de skill, diferença e endereço)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Repositório. Perfil do agente, referência de skill, orientações e custo por agente; limpeza e dono nos testes

**Files:**
- Modify: `packages/db/src/repos.ts`
- Modify: `packages/db/test/limpar.ts`
- Create: `packages/db/test/agentes.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5 (`agentes`, `skills_do_agente`, `referencia_da_skill`, `restaurar_agentes_iniciais`, `ferramentas_do_catalogo`, `TipoSkill`, `AGENTE_ATENDIMENTO_ID`, `FERRAMENTAS_ATENDIMENTO`).
- Produces:
  - `type SkillCarregada = { id: string; nome: string; tipo: TipoSkill; ativa: boolean; titulo: string; descricao: string; corpo: string; versao: number; arquivos: string[] }`;
  - `type PerfilAgente = { id: string | null; slug: string; nome: string; modelo: string | null; ferramentas: string[]; skills: SkillCarregada[]; skillEmTeste: string | null }` (`id` null = perfil do código, banco sem a Parte I);
  - `repos.perfilDoAgente(slug: string, skillEmTeste?: string | null): Promise<PerfilAgente | null>` (null: não existe **ou** banco sem a Parte I);
  - `repos.referenciaDaSkill(agenteId: string, nome: string, caminho: string, skillEmTeste?: string | null): Promise<string | null>`;
  - `repos.orientacoesAtivas(agenteId?: string | null)` (com id, só as do agente; sem, todas, como antes);
  - `NovoUsoIa.agenteId?: string | null` (vai para `uso_ia.agente_id` só quando preenchido);
  - `limparBanco()` (também volta os agentes às sementes, D24) e `marcarDonoTeste(usuarioId: string): Promise<void>` em `@escritorio/db/teste`.

- [ ] **Passo 1: o teste que falha**

`packages/db/test/agentes.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTE_ATENDIMENTO_ID, FERRAMENTAS_ATENDIMENTO } from '@escritorio/core';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco, marcarDonoTeste } from './limpar';
import { criarUsuario } from './usuario';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const idDo = async (slug: string) => (await db.from('agentes').select('id').eq('slug', slug).single()).data!.id;

/** Skill direto no banco (o dono sobe pela tela; aqui só o resultado). */
async function skill(slug: string, nome: string, tipo: string, ativo: boolean, arquivos: { caminho: string; conteudo: string }[] = []) {
  const { data: s } = await db.from('agente_skills').insert({ agente_id: await idDo(slug), nome, tipo, ativo }).select('id').single();
  const { data: v } = await db.from('agente_skill_versoes').insert({ skill_id: s!.id, versao: 1, titulo: `Título ${nome}`, descricao: `Quando ${nome}.`,
    tipo, corpo: `Texto de ${nome}.`, skill_md: '---' }).select('id').single();
  if (arquivos.length) await db.from('agente_skill_arquivos').insert(arquivos.map((a) => ({ versao_id: v!.id, ...a })));
  return s!.id;
}

beforeEach(limparBanco);

describe('catálogo (D15)', () => {
  it('o banco e o core têm as mesmas 16 ferramentas, na mesma ordem', async () => {
    const { data } = await db.rpc('ferramentas_do_catalogo');
    expect(data).toEqual(FERRAMENTAS_ATENDIMENTO);
  });
});

describe('perfilDoAgente', () => {
  it('o Thiago: id fixo, as 16 ferramentas, modelo do padrão, sem skills', async () => {
    const p = await repos.perfilDoAgente('atendimento');
    expect(p).toMatchObject({ id: AGENTE_ATENDIMENTO_ID, slug: 'atendimento', nome: 'Thiago', modelo: null, skills: [], skillEmTeste: null });
    expect([...p!.ferramentas].sort()).toEqual([...FERRAMENTAS_ATENDIMENTO].sort());
  });
  it('só as skills ligadas do próprio agente; a em teste entra marcada como desligada', async () => {
    await skill('atendimento', 'limite-ligado', 'limites', true);
    const desligada = await skill('atendimento', 'cfop-desligada', 'conhecimento', false);
    const doFiscal = await skill('fiscal', 'jeito-do-fiscal', 'jeito', true);
    expect((await repos.perfilDoAgente('atendimento'))!.skills.map((s) => s.nome)).toEqual(['limite-ligado']);
    const comTeste = await repos.perfilDoAgente('atendimento', desligada);
    expect(comTeste!.skills.map((s) => [s.nome, s.ativa])).toEqual([['limite-ligado', true], ['cfop-desligada', false]]);
    expect(comTeste!.skillEmTeste).toBe(desligada);
    expect((await repos.perfilDoAgente('atendimento', doFiscal))!.skills.map((s) => s.nome)).toEqual(['limite-ligado']);
  });
  it('agente que não existe: null', async () => {
    expect(await repos.perfilDoAgente('nao-existe')).toBeNull();
  });
});

describe('referenciaDaSkill (D5)', () => {
  it('lê arquivo de skill ligada do agente; desligada só como skill em teste', async () => {
    await skill('atendimento', 'procedimento-x', 'procedimento', true, [{ caminho: 'passos.md', conteudo: 'Passo 1.' }]);
    const off = await skill('atendimento', 'conhecimento-x', 'conhecimento', false, [{ caminho: 'tabela.csv', conteudo: 'a;b' }]);
    expect(await repos.referenciaDaSkill(AGENTE_ATENDIMENTO_ID, 'procedimento-x', 'passos.md')).toBe('Passo 1.');
    expect(await repos.referenciaDaSkill(AGENTE_ATENDIMENTO_ID, 'conhecimento-x', 'tabela.csv')).toBeNull();
    expect(await repos.referenciaDaSkill(AGENTE_ATENDIMENTO_ID, 'conhecimento-x', 'tabela.csv', off)).toBe('a;b');
    expect(await repos.referenciaDaSkill(await idDo('fiscal'), 'procedimento-x', 'passos.md')).toBeNull();
  });
});

describe('orientações e custo por agente', () => {
  it('orientacoesAtivas com o id traz só as do agente; sem id, todas (como antes)', async () => {
    await db.from('orientacoes_agente').insert([
      { titulo: 'Do Thiago', texto: 'x', tipo: 'jeito', ativo: true },
      { titulo: 'Do Fiscal', texto: 'y', tipo: 'jeito', ativo: true, agente_id: await idDo('fiscal') },
    ]);
    expect((await repos.orientacoesAtivas(AGENTE_ATENDIMENTO_ID)).map((o) => o.titulo)).toEqual(['Do Thiago']);
    expect((await repos.orientacoesAtivas()).map((o) => o.titulo).sort()).toEqual(['Do Fiscal', 'Do Thiago']);
  });
  it('registrarUsoIa grava o agente só quando vem', async () => {
    const base = { funcionalidade: 'agente_clientes' as const, usuarioId: null, conversaId: null, clienteId: null, modelo: 'claude-sonnet-5',
      tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01 };
    await repos.registrarUsoIa({ ...base, agenteId: AGENTE_ATENDIMENTO_ID });
    await repos.registrarUsoIa(base);
    const { data } = await db.from('uso_ia').select('agente_id').order('criado_em');
    expect(data).toEqual([{ agente_id: AGENTE_ATENDIMENTO_ID }, { agente_id: null }]);
  });
});

describe('limparBanco e dono nos testes (D24, D11)', () => {
  it('volta os agentes às sementes e apaga os criados por teste', async () => {
    await db.from('agentes').update({ estado: 'ligado', modelo: 'claude-haiku-4-5' }).eq('slug', 'fiscal');
    await db.from('agentes').insert({ slug: 'de-teste', nome: 'De teste' });
    await skill('atendimento', 'sobra', 'limites', true);
    await limparBanco();
    const { data } = await db.from('agentes').select('slug, estado, modelo').order('ordem');
    expect(data!.map((a) => a.slug)).toEqual(['atendimento', 'radar', 'fiscal', 'contabil', 'pessoal', 'legalizacao', 'comercial']);
    expect(data!.find((a) => a.slug === 'fiscal')).toEqual({ slug: 'fiscal', estado: 'desligado', modelo: null });
    expect((await db.from('agente_skills').select('id')).data).toEqual([]);
  });
  it('marcarDonoTeste marca um só; pela API (chave de serviço) a marcação não muda', async () => {
    const a = await criarUsuario(db, 'a@dono.local', { papel: 'admin' });
    const b = await criarUsuario(db, 'b@dono.local', { papel: 'admin' });
    await marcarDonoTeste(a);
    await marcarDonoTeste(b);
    const { data } = await db.from('usuarios').select('id').eq('dono', true);
    expect(data).toEqual([{ id: b }]);
    const { error } = await db.from('usuarios').update({ dono: false }).eq('id', b);
    expect(error?.message).toContain('A marcação de dono só muda direto no banco (SQL).');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar** (banco local nas portas 563xx, `supabase db reset` antes)

Run: `pnpm --filter @escritorio/db exec vitest run test/agentes.test.ts`
Expected: FAIL (`repos.perfilDoAgente is not a function`, `marcarDonoTeste` não exportado).

- [ ] **Passo 3: implementar**

1. Em `packages/db/src/repos.ts`, no import de `@escritorio/core` acrescente `type TipoSkill`. Depois de `NovoUsoIa`, acrescente o campo e os tipos novos:

```ts
/** Uma chamada à IA (spec 7B.2). Tudo obrigatório: caminho novo que esquecer a funcionalidade não compila (Prompt F). */
export type NovoUsoIa = {
  funcionalidade: FuncionalidadeGravavel; usuarioId: string | null; conversaId: string | null; clienteId: string | null;
  modelo: string; provedor?: ProvedorIa; tokensEntrada: number; tokensSaida: number; tokensCacheLeitura: number; tokensCacheEscrita: number;
  segundosAudio?: number | null; custoUsd: number;
  /** Agente que gastou (Parte I1, D16). Vazio: banco sem a Parte I ou gasto que não é de agente. */
  agenteId?: string | null;
};
```

e, perto de `OrientacaoAgente`:

```ts
/** Skill como o motor usa (Parte I1): a versão atual, com os nomes dos arquivos de apoio. */
export type SkillCarregada = {
  id: string; nome: string; tipo: TipoSkill; ativa: boolean; titulo: string; descricao: string; corpo: string; versao: number; arquivos: string[];
};
/** Agente como o motor usa (Parte I1). `id` null: o perfil do código (banco sem a Parte I). `skillEmTeste`: a skill que a simulação inclui. */
export type PerfilAgente = {
  id: string | null; slug: string; nome: string; modelo: string | null; ferramentas: string[]; skills: SkillCarregada[]; skillEmTeste: string | null;
};
/** Banco sem as migrações da Parte I (homologação, D23): tabela, coluna ou função que não existem. */
const SEM_PARTE_I = new Set(['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']);
```

2. Em `registrarUsoIa`, no objeto do `insert`, depois de `custo_usd: u.custoUsd,` acrescente: `...(u.agenteId ? { agente_id: u.agenteId } : {}),` (sem agente, o insert é o de antes: o trabalhador novo funciona num banco sem a coluna).

3. Troque `orientacoesAtivas` por:

```ts
    /** Orientações ligadas. Com o agente (Parte I1), só as dele; sem (banco sem a Parte I), todas, como antes. */
    async orientacoesAtivas(agenteId: string | null = null): Promise<OrientacaoAgente[]> {
      let consulta = db.from('orientacoes_agente')
        .select('id, titulo, texto, tipo, cliente_id, setor_id, atualizado_em, setores(nome)')
        .eq('ativo', true);
      if (agenteId) consulta = consulta.eq('agente_id', agenteId);
      const linhas = checar(await consulta.order('atualizado_em', { ascending: false }).order('id').limit(PAGINA), 'orientacoesAtivas');
      return linhas.map((o) => ({
        id: o.id, titulo: o.titulo, texto: o.texto, tipo: o.tipo as TipoOrientacao, clienteId: o.cliente_id, setorId: o.setor_id,
        setorNome: o.setores?.nome ?? null, atualizadoEm: new Date(o.atualizado_em),
      }));
    },

    /** Agente pelo endereço, com as skills ligadas (e a em teste). null: não existe ou o banco ainda não tem a Parte I (D23). */
    async perfilDoAgente(slug: string, skillEmTeste: string | null = null): Promise<PerfilAgente | null> {
      const r = await db.from('agentes').select('id, slug, nome, modelo, ferramentas').eq('slug', slug).maybeSingle();
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      const a = checar(r, 'perfilDoAgente');
      if (!a) return null;
      const skills = checar(await db.rpc('skills_do_agente', { p_agente: a.id, ...(skillEmTeste ? { p_incluir: skillEmTeste } : {}) }),
        'perfilDoAgente.skills');
      return {
        id: a.id, slug: a.slug, nome: a.nome, modelo: a.modelo, ferramentas: a.ferramentas, skillEmTeste,
        skills: skills.map((s) => ({
          id: s.id, nome: s.nome, tipo: s.tipo as TipoSkill, ativa: s.ativo, titulo: s.titulo, descricao: s.descricao, corpo: s.corpo,
          versao: s.versao, arquivos: s.arquivos ?? [],
        })),
      };
    },

    /** Arquivo de apoio de uma skill ligada do agente (ou da em teste). null: não é dele, está desligada ou não existe (D5). */
    async referenciaDaSkill(agenteId: string, nome: string, caminho: string, skillEmTeste: string | null = null): Promise<string | null> {
      const texto = checar(await db.rpc('referencia_da_skill', {
        p_agente: agenteId, p_nome: nome, p_caminho: caminho, ...(skillEmTeste ? { p_incluir: skillEmTeste } : {}),
      }), 'referenciaDaSkill');
      return texto ?? null;
    },
```

4. Em `packages/db/test/limpar.ts`, troque o arquivo por:

```ts
import pg from 'pg';

/** Endereço do banco dos testes. Recusa qualquer banco que não seja o local. */
function urlLocal(): string {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.includes('127.0.0.1') && !url.includes('localhost')) throw new Error('limparBanco só roda no banco local');
  return url;
}

/** Apaga os dados de teste. Recusa rodar fora do banco local. */
export async function limparBanco(): Promise<void> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  await c.query(`truncate public.simulacoes_agente, public.orientacoes_agente_versoes, public.orientacoes_agente,
    public.assistente_mensagens, public.mensagens, public.chamado_eventos, public.chamados, public.decisoes_agente,
    public.auditoria_acessos, public.uso_ia, public.alertas, public.sinais_vida, public.conversas, public.contato_clientes,
    public.contatos, public.cliente_responsaveis, public.cliente_servicos, public.clientes,
    public.respostas_prontas, public.feriados cascade`);
  // Parte I1 (D24): skills, regras, contatos em teste e histórico somem; os 7 agentes voltam às sementes.
  await c.query(`truncate public.agente_skill_arquivos, public.agente_skill_versoes, public.agente_skills, public.agente_regras_assunto,
    public.agente_contatos_teste, public.agente_mudancas cascade`);
  await c.query('select public.restaurar_agentes_iniciais()');
  await c.query("delete from auth.users where email like '%.local'");
  await c.query(`update public.configuracoes set agente_pausado = false, alerta_ia_80_mes = null, teto_ia_usd = 50, telefone_dono = null,
    espera_verde_min = 5, espera_ambar_min = 15`);
  await c.end();
}

/** Marca a pessoa como dono (Parte I1, D11): só SQL direto muda a marcação; a API recusa. Só no banco local. */
export async function marcarDonoTeste(usuarioId: string): Promise<void> {
  const c = new pg.Client({ connectionString: urlLocal() });
  await c.connect();
  try {
    await c.query('begin');
    await c.query('update public.usuarios set dono = false where dono');
    await c.query('update public.usuarios set dono = true where id = $1', [usuarioId]);
    await c.query('commit');
  } finally {
    await c.end();
  }
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/db exec vitest run test/agentes.test.ts`
Expected: `9 passed`.

Run: `pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/painel typecheck`
Expected: tudo passa (inclusive `repos.test.ts` e `orientacoes.test.ts`, que chamam `orientacoesAtivas()` sem argumento).

- [ ] **Passo 5: commit** (volte `supabase/config.toml` e `.env` antes)

```bash
git add packages/db/src/repos.ts packages/db/test/limpar.ts packages/db/test/agentes.test.ts
git commit -m "$(cat <<'EOF'
feat(db): perfil do agente, arquivo de apoio da skill, orientações e custo por agente; limpeza volta os agentes às sementes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Trabalhador. O motor (perfil, modelo, ferramentas, skills sempre lidas, custo por agente) e a prova de igualdade

**Files:**
- Create: `apps/trabalhador/src/agente/perfil.ts`
- Create: `apps/trabalhador/src/agente/skills.ts`
- Modify: `apps/trabalhador/src/agente/executar.ts`, `prompt.ts`, `contexto.ts`, `ferramentas.ts` (só `NOMES_FERRAMENTAS`), `simular.ts`
- Create: `apps/trabalhador/test/agente/motor-thiago.test.ts`, `apps/trabalhador/test/agente/motor.test.ts`

**Interfaces:**
- Consumes: Task 1 (`CASOS_RETRATO`, `retratoDoPedido`, os retratos), Task 5 (`SLUG_ATENDIMENTO`, `FERRAMENTAS_ATENDIMENTO`, `AGENTE_ATENDIMENTO_ID`), Task 6 (`PerfilAgente`, `SkillCarregada`, `perfilDoAgente`, `orientacoesAtivas(id)`, `NovoUsoIa.agenteId`).
- Produces:
  - `perfil.ts`: `PERFIL_PADRAO_ATENDIMENTO: PerfilAgente`, `carregarPerfil(repos, slug, skillEmTeste = null): Promise<PerfilAgente>`, `perfilDoContexto(ctx)`, `modeloDoPerfil(perfil, config)`, `ferramentasDoPerfil(perfil): Anthropic.Tool[]`;
  - `skills.ts`: `secaoSkills(skills): string` (Limites e Jeito nesta task; a Task 8 acrescenta o índice sob demanda), `CABECALHO_LIMITES`, `CABECALHO_JEITO`;
  - `ContextoAgente.agente?: PerfilAgente` (sem ele, o perfil do código);
  - `executar.ts`: `montarPedido(ctx, messages): { pedido: ParametrosIa; cortadas: string[] }`; `uso_ia.agente_id` = `perfil.id`;
  - `ferramentas.ts`: `NOMES_FERRAMENTAS: ReadonlySet<string>`;
  - `prompt.ts`: `montarSistema(setores, respostas, orientacoes, skills = [])`.

**O que não pode acontecer:** nenhum retrato da Task 1 muda; nenhuma frase do `montarSistema` muda (`git diff BASE -- apps/trabalhador/src/agente/prompt.ts | grep '^-' | grep -v '^---'` só mostra a linha da assinatura e a linha do `${listaRespostas}…`).

- [ ] **Passo 1: escrever os testes que falham**

`apps/trabalhador/test/agente/motor-thiago.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTE_ATENDIMENTO_ID } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { carregarPerfil, PERFIL_PADRAO_ATENDIMENTO } from '../../src/agente/perfil';
import { repos } from '../apoio/cenario';
import { CASOS_RETRATO, retratoDoPedido } from '../apoio/retrato';

const retrato = (nome: string) => readFileSync(new URL(`./__retratos__/${nome}.json`, import.meta.url), 'utf8');

beforeEach(limparBanco);

// Parte I1 (D2, Foco da revisão 1): no motor, o Thiago manda ao Claude exatamente o pedido de antes (Task 1).
describe('o Thiago no motor', () => {
  for (const nome of Object.keys(CASOS_RETRATO)) {
    it(`${nome}: com o perfil do banco, igual ao retrato`, async () => {
      const agente = await carregarPerfil(repos, 'atendimento');
      expect(agente.id).toBe(AGENTE_ATENDIMENTO_ID);
      expect(await retratoDoPedido({ ...CASOS_RETRATO[nome]!(), agente })).toBe(retrato(nome));
    });
    it(`${nome}: com o perfil do código (banco sem a Parte I), igual ao retrato`, async () => {
      expect(await retratoDoPedido({ ...CASOS_RETRATO[nome]!(), agente: PERFIL_PADRAO_ATENDIMENTO })).toBe(retrato(nome));
    });
  }

  it('sem a Parte I no banco: o Thiago do código, e nenhum outro agente', async () => {
    const semParteI = { perfilDoAgente: async () => null } as unknown as Repos;
    expect(await carregarPerfil(semParteI, 'atendimento')).toBe(PERFIL_PADRAO_ATENDIMENTO);
    await expect(carregarPerfil(semParteI, 'fiscal')).rejects.toThrow('Agente não encontrado: fiscal');
  });
});
```

`apps/trabalhador/test/agente/motor.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTE_ATENDIMENTO_ID } from '@escritorio/core';
import type { PerfilAgente, Repos, SkillCarregada } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto, type ContextoAgente } from '../../src/agente/contexto';
import { executarAgente, montarPedido } from '../../src/agente/executar';
import type { ExecutorFerramentas } from '../../src/agente/ferramentas';
import { PERFIL_PADRAO_ATENDIMENTO } from '../../src/agente/perfil';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { CASOS_RETRATO } from '../apoio/retrato';

const skill = (tipo: SkillCarregada['tipo'], nome: string, corpo: string): SkillCarregada =>
  ({ id: nome, nome, tipo, ativa: true, titulo: `Título ${nome}`, descricao: `Quando ${nome}.`, corpo, versao: 1, arquivos: [] });
const comPerfil = (p: Partial<PerfilAgente>): ContextoAgente =>
  ({ ...CASOS_RETRATO['contato-uma-empresa']!(), agente: { ...PERFIL_PADRAO_ATENDIMENTO, ...p } });
const sistema = (ctx: ContextoAgente) => (montarPedido(ctx, []).pedido.system as { text: string }[])[0]!.text;
const stub = (ctx: ContextoAgente) => ({
  registrarUsoIa: async () => {}, registrarDecisao: async () => {}, ultimasOrientacoesCortadas: async () => null, obterConversa: async () => ctx.conversa,
}) as unknown as Repos;

describe('skills sempre lidas no prompt (D4)', () => {
  it('Limites e Jeito depois das RESPOSTAS PRONTAS e antes das ORIENTAÇÕES, Limites primeiro, no bloco com cache', () => {
    const ctx = comPerfil({ skills: [skill('limites', 'limite-x', 'Nunca prometa prazo <b>.'), skill('jeito', 'jeito-x', 'Fale curto.')] });
    ctx.orientacoes = [{ id: 'G1', titulo: 'Cumprimento', texto: 'Chame pelo nome.', tipo: 'jeito', clienteId: null, setorId: null, setorNome: null,
      atualizadoEm: new Date('2026-09-01') }];
    const s = sistema(ctx);
    const ordem = ['RESPOSTAS PRONTAS:', 'LIMITES DO AGENTE', 'JEITO DE ATUAR', 'ORIENTAÇÕES DO ESCRITÓRIO'].map((t) => s.indexOf(t));
    expect(ordem.every((p, i) => p > 0 && (i === 0 || p > ordem[i - 1]!))).toBe(true);
    expect(s).toContain('### Título limite-x\nNunca prometa prazo ‹b›.');
    expect(montarPedido(ctx, []).pedido.system).toMatchObject([{ cache_control: { type: 'ephemeral' } }]);
  });
  it('sem skill, nenhum cabeçalho novo', () => {
    const s = sistema(comPerfil({}));
    expect(s).not.toContain('LIMITES DO AGENTE');
    expect(s).not.toContain('JEITO DE ATUAR');
  });
});

describe('ferramentas e modelo do perfil (D15, D29)', () => {
  it('só as liberadas, na ordem de sempre; o modelo do perfil', () => {
    const { pedido } = montarPedido(comPerfil({ ferramentas: ['responder', 'consultar_chamados'], modelo: 'claude-haiku-4-5' }), []);
    expect(pedido.tools!.map((t) => (t as { name: string }).name)).toEqual(['consultar_chamados', 'responder']);
    expect(pedido.model).toBe('claude-haiku-4-5');
  });
  it('ferramenta conhecida fora do perfil não roda; o modelo recebe a recusa', async () => {
    const ctx = comPerfil({ ferramentas: ['responder'] });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'abrir_chamado', entrada: {} }), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    const chamadas: string[] = [];
    const executor: ExecutorFerramentas = async (_d, estado, nome) => {
      chamadas.push(nome);
      if (nome === 'responder') estado.respondeu = true;
      return { resultado: '{}', erro: false };
    };
    await executarAgente({ repos: stub(ctx), ia, envio: {} as never }, ctx, [{ type: 'text', text: 'oi' }], executor);
    expect(chamadas).toEqual(['responder']);
    const volta = ia.recebidos[1]!.messages.at(-1)!.content as { content: string; is_error?: boolean }[];
    expect(volta[0]).toMatchObject({ is_error: true });
    expect(volta[0]!.content).toContain('Ferramenta não liberada para este agente: abrir_chamado.');
  });
});

describe('custo e orientações do Thiago no banco (D16, D12)', () => {
  beforeEach(limparBanco);
  async function contexto() {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const c = await repos.obterConversa(conversa.id);
    return carregarContexto(repos, c, await repos.buscarContato(c.telefone), await repos.obterConfiguracoes(), new Date('2026-09-28T13:00:00Z'));
  }
  it('o atendimento grava o agente do Thiago e o preço do modelo de sempre', async () => {
    const ctx = await contexto();
    expect(ctx.agente?.id).toBe(AGENTE_ATENDIMENTO_ID);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await executarAgente({ repos, ia, envio: { repos, canal: new CanalFalso(), limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } },
      ctx, [{ type: 'text', text: 'oi' }]);
    const { data } = await db.from('uso_ia').select('funcionalidade, agente_id, modelo');
    expect(data).toEqual([
      { funcionalidade: 'agente_clientes', agente_id: AGENTE_ATENDIMENTO_ID, modelo: 'claude-sonnet-5' },
      { funcionalidade: 'agente_clientes', agente_id: AGENTE_ATENDIMENTO_ID, modelo: 'claude-sonnet-5' },
    ]);
  });
  it('o Thiago só lê as orientações dele', async () => {
    const { data: fiscal } = await db.from('agentes').select('id').eq('slug', 'fiscal').single();
    await db.from('orientacoes_agente').insert([
      { titulo: 'Do Thiago', texto: 'x', tipo: 'jeito', ativo: true },
      { titulo: 'Do Fiscal', texto: 'y', tipo: 'jeito', ativo: true, agente_id: fiscal!.id },
    ]);
    expect((await contexto()).orientacoes.map((o) => o.titulo)).toEqual(['Do Thiago']);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/motor-thiago.test.ts test/agente/motor.test.ts`
Expected: FAIL (`Cannot find module '../../src/agente/perfil'`).

- [ ] **Passo 3: o perfil e as skills sempre lidas**

`apps/trabalhador/src/agente/skills.ts`:

```ts
import type { SkillCarregada } from '@escritorio/db';
import { limparTextoOrientacao } from './orientacoes';

// Parte I1 (D4): as skills entram no bloco 1 (com cache), entre RESPOSTAS PRONTAS e ORIENTAÇÕES. Os cabeçalhos dizem a ordem.
export const CABECALHO_LIMITES =
  'LIMITES DO AGENTE (o que você nunca faz; valem mais que qualquer outra skill e que as orientações da equipe; só as regras acima valem mais):';
export const CABECALHO_JEITO = 'JEITO DE ATUAR (siga sempre; se algo aqui contrariar as regras ou os limites acima, eles valem):';

/** Texto do dono vai para o prompt com as marcas neutralizadas, como as orientações. */
const bloco = (s: SkillCarregada) => `### ${limparTextoOrientacao(s.titulo).replace(/\s+/g, ' ')}\n${limparTextoOrientacao(s.corpo)}`;

/** Seção das skills do perfil. Sem skill, texto vazio: o prompt de antes, byte a byte (D2). */
export function secaoSkills(skills: readonly SkillCarregada[]): string {
  const limites = skills.filter((s) => s.tipo === 'limites');
  const jeito = skills.filter((s) => s.tipo === 'jeito');
  const partes: string[] = [];
  if (limites.length) partes.push(`${CABECALHO_LIMITES}\n${limites.map(bloco).join('\n\n')}`);
  if (jeito.length) partes.push(`${CABECALHO_JEITO}\n${jeito.map(bloco).join('\n\n')}`);
  return partes.length ? `\n\n${partes.join('\n\n')}` : '';
}
```

`apps/trabalhador/src/agente/perfil.ts`:

```ts
import type Anthropic from '@anthropic-ai/sdk';
import { FERRAMENTAS_ATENDIMENTO, SLUG_ATENDIMENTO } from '@escritorio/core';
import type { Configuracoes, PerfilAgente, Repos } from '@escritorio/db';
import type { ContextoAgente } from './contexto';
import { FERRAMENTAS } from './ferramentas';

/** O Thiago como era antes da Parte I (D23): sem o banco novo, o motor monta exatamente o pedido de antes. */
export const PERFIL_PADRAO_ATENDIMENTO: PerfilAgente = {
  id: null, slug: SLUG_ATENDIMENTO, nome: 'Thiago', modelo: null, ferramentas: [...FERRAMENTAS_ATENDIMENTO], skills: [], skillEmTeste: null,
};

let avisouSemParteI = false;

/** Perfil pelo endereço. O Thiago sem a Parte I no banco usa o perfil do código; outro agente sem linha é erro. */
export async function carregarPerfil(repos: Repos, slug: string, skillEmTeste: string | null = null): Promise<PerfilAgente> {
  const perfil = await repos.perfilDoAgente(slug, skillEmTeste);
  if (perfil) return perfil;
  if (slug !== SLUG_ATENDIMENTO) throw new Error(`Agente não encontrado: ${slug}`);
  if (!avisouSemParteI) {
    avisouSemParteI = true;
    console.warn('[motor] os agentes ainda não estão no banco (Parte I): usando o Thiago do código');
  }
  return PERFIL_PADRAO_ATENDIMENTO;
}

export const perfilDoContexto = (ctx: Pick<ContextoAgente, 'agente'>): PerfilAgente => ctx.agente ?? PERFIL_PADRAO_ATENDIMENTO;
export const modeloDoPerfil = (p: PerfilAgente, config: Pick<Configuracoes, 'modeloConversa'>): string => p.modelo ?? config.modeloConversa;

/** As ferramentas liberadas no perfil, na ordem de FERRAMENTAS (o pedido do Thiago não muda). */
export function ferramentasDoPerfil(p: PerfilAgente): Anthropic.Tool[] {
  return FERRAMENTAS.filter((f) => p.ferramentas.includes(f.name));
}
```

- [ ] **Passo 4: o contexto, o prompt, as ferramentas conhecidas e o pedido**

1. `contexto.ts`: no import de `@escritorio/core` acrescente `SLUG_ATENDIMENTO`; no de `@escritorio/db`, `PerfilAgente`; importe `import { carregarPerfil } from './perfil';`. No tipo, depois de `acessoFixo`:

```ts
  /** Perfil do agente no motor (Parte I1). Sem ele, o Thiago do código (o pedido de antes). */
  agente?: PerfilAgente;
```

Em `carregarContexto`, antes do `return`: `const agente = await carregarPerfil(repos, SLUG_ATENDIMENTO);`; no objeto, troque `orientacoes: await repos.orientacoesAtivas(),` por `orientacoes: await repos.orientacoesAtivas(agente.id),` e acrescente `agente,` depois de `agora,`.

2. `prompt.ts`: importe `import type { SkillCarregada } from '@escritorio/db';` (junto do `Mensagem`) e `import { secaoSkills } from './skills';`. Em `montarBlocosSistema`, troque `montarSistema(ctx.setores, ctx.respostasProntas, o)` por `montarSistema(ctx.setores, ctx.respostasProntas, o, ctx.agente?.skills ?? [])`. Em `montarSistema`, acrescente o quarto parâmetro e troque só a última linha do texto:

```ts
export function montarSistema(
  setores: ContextoAgente['setores'], respostas: ContextoAgente['respostasProntas'],
  orientacoes: Pick<OrientacoesDaConversa, 'gerais' | 'porSetor'> = { gerais: [], porSetor: [] },
  skills: readonly SkillCarregada[] = [],
): string {
```

e, no fim do texto: `${listaRespostas}${secaoSkills(skills)}${secaoOrientacoes(orientacoes)}\`;` (no lugar de `${listaRespostas}${secaoOrientacoes(orientacoes)}\`;`). **Nenhuma outra linha do texto muda.**

3. `ferramentas.ts`: logo depois do objeto `Entradas`, acrescente:

```ts
/** Nomes que o motor conhece: ferramenta conhecida fora do perfil é recusada antes de rodar (D15). */
export const NOMES_FERRAMENTAS: ReadonlySet<string> = new Set(Object.keys(Entradas));
```

4. `executar.ts`: troque os imports e `registrarUso`, crie `montarPedido` e use-o no laço:

```ts
import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { calcularCustoUsd, usoDaResposta } from '@escritorio/core';
import type { ParametrosIa } from './cliente-ia';
import type { ContextoAgente } from './contexto';
import { FERRAMENTAS, NOMES_FERRAMENTAS, executarFerramenta, falha, type DepsAgente, type EstadoExecucao, type ExecutorFerramentas } from './ferramentas';
import { LIMITE_ORIENTACOES } from './orientacoes';
import { ferramentasDoPerfil, modeloDoPerfil, perfilDoContexto } from './perfil';
import { montarBlocosSistema } from './prompt';
```

(se `FERRAMENTAS` deixar de ser usado no arquivo, tire-o do import.)

```ts
async function registrarUso(d: DepsAgente, ctx: ContextoAgente, r: Anthropic.Message): Promise<void> {
  const perfil = perfilDoContexto(ctx);
  const modelo = modeloDoPerfil(perfil, ctx.config);
  const preco = ctx.config.precosModelos[modelo] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const uso = usoDaResposta(r.usage);
  // A simulação troca o repositório e grava como testar_agente (agente/simular.ts). O agente vai junto (D16).
  await d.repos.registrarUsoIa({
    funcionalidade: 'agente_clientes', usuarioId: null, conversaId: ctx.conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null, modelo, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
    tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco), agenteId: perfil.id,
  });
}

/** O pedido de uma rodada (Parte I1): o de antes, com o modelo e as ferramentas do perfil. Mesma ordem de chaves (D2). */
export function montarPedido(ctx: ContextoAgente, messages: Anthropic.MessageParam[]): { pedido: ParametrosIa; cortadas: string[] } {
  const perfil = perfilDoContexto(ctx);
  const { system, cortadas } = montarBlocosSistema(ctx);
  return {
    pedido: { model: modeloDoPerfil(perfil, ctx.config), max_tokens: 16000, system, tools: ferramentasDoPerfil(perfil), messages, output_config: { effort: 'medium' } },
    cortadas,
  };
}
```

No laço de `executarAgente`, troque as duas primeiras linhas e a execução das ferramentas:

```ts
    // A cada rodada: selecionar_empresa pode ter trocado a empresa em foco (e com ela as orientações da empresa).
    const { pedido, cortadas } = montarPedido(ctx, messages);
    const r = await d.ia.criar(pedido);
```

```ts
    const liberadas = new Set((pedido.tools ?? []).map((t) => (t as Anthropic.Tool).name));
    // Em ordem: selecionar_empresa precisa valer antes de abrir_chamado na mesma rodada.
    for (const u of usos) {
      // Ferramenta conhecida fora do perfil não roda (D15); nome desconhecido segue o caminho de sempre (o executor recusa).
      const res = NOMES_FERRAMENTAS.has(u.name) && !liberadas.has(u.name)
        ? falha(`Ferramenta não liberada para este agente: ${u.name}.`)
        : await executor(d, estado, u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
```

5. `simular.ts`: no import de `@escritorio/core` acrescente `SLUG_ATENDIMENTO`; importe `import { carregarPerfil } from './perfil';`. Em `LEITURAS_REPOS`, acrescente `'perfilDoAgente'`. Em `simular`, depois de `const setores = await repos.setoresAtivos();`: `const agente = await carregarPerfil(repos, SLUG_ATENDIMENTO);`; no `ctx`, troque `orientacoes: orientacoesDoTeste(await repos.orientacoesAtivas(), …)` por `orientacoes: orientacoesDoTeste(await repos.orientacoesAtivas(agente.id), sim.rascunho, setores, agora),` e acrescente `agente,` depois de `acessoFixo: acessoTotal(setores),`.

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/retrato-thiago.test.ts test/agente/motor-thiago.test.ts test/agente/motor.test.ts`
Expected: tudo passa; **nenhum retrato escrito** (o Vitest não diz "written"; `git status apps/trabalhador/test/agente/__retratos__` limpo).

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: tudo passa (inclusive `prompt.test.ts`, `executar.test.ts`, `simular.test.ts`, `gastos/caminhos.test.ts` com `agente_clientes`).

Run: `git diff BASE -- apps/trabalhador/src/agente/prompt.ts | grep '^-' | grep -v '^---'`
Expected: só as duas linhas trocadas (a chamada de `montarSistema` em `montarBlocosSistema`, o fechamento `): string {` da assinatura, se o diff o mostrar, e a linha `${listaRespostas}${secaoOrientacoes(orientacoes)}`).

- [ ] **Passo 6: commit** (volte `supabase/config.toml` e `.env` antes)

```bash
git add apps/trabalhador/src/agente/perfil.ts apps/trabalhador/src/agente/skills.ts apps/trabalhador/src/agente/executar.ts apps/trabalhador/src/agente/prompt.ts apps/trabalhador/src/agente/contexto.ts apps/trabalhador/src/agente/ferramentas.ts apps/trabalhador/src/agente/simular.ts apps/trabalhador/test/agente/motor-thiago.test.ts apps/trabalhador/test/agente/motor.test.ts
git commit -m "$(cat <<'EOF'
feat(agente): motor de agentes — o Thiago vira um perfil (modelo, ferramentas e skills do registro), pedido idêntico ao de antes, custo por agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Trabalhador. Skills sob demanda (`ler_skill`, `ler_referencia`) e o teste com uma skill

**Files:**
- Modify: `apps/trabalhador/src/agente/skills.ts`, `perfil.ts`, `ferramentas.ts`, `simular.ts`
- Modify: `apps/trabalhador/test/apoio/cenario.ts` (`criarSkillTeste`)
- Create: `apps/trabalhador/test/agente/ler-skill.test.ts`

**Interfaces:**
- Consumes: Task 7; `repos.referenciaDaSkill`, `PerfilAgente.skillEmTeste`; `simulacoes_agente.skill_id` (Task 3); `INFO_TIPO_SKILL` (Task 5).
- Produces:
  - `skills.ts`: `CABECALHO_SOB_DEMANDA`, `temSkillSobDemanda(skills)`, `FERRAMENTAS_SKILL: Anthropic.Tool[]` (`ler_skill { nome }`, `ler_referencia { skill, arquivo, parte? }`), `TAMANHO_PARTE_REFERENCIA = 40_000`, `AVISOS_SKILL`; `secaoSkills` com o índice;
  - `ferramentasDoPerfil` acrescenta `FERRAMENTAS_SKILL` no fim só com skill sob demanda;
  - `ferramentas.ts`: `Entradas.ler_skill`, `Entradas.ler_referencia` e os dois casos; a decisão guarda `(N caracteres)` no lugar do texto lido;
  - `simular.ts`: teste com `sim.skill_id` (a skill entra mesmo desligada), ação "Leria a skill …" e as observações da skill;
  - `test/apoio/cenario.ts`: `criarSkillTeste(slug, s): Promise<string>` (id da skill).

- [ ] **Passo 1: o apoio dos testes**

Em `apps/trabalhador/test/apoio/cenario.ts`, acrescente (no import de `@escritorio/core`, `type TipoSkill`):

```ts
/** Skill de um agente direto no banco (Parte I1), como o dono deixaria pela tela: versão 1, ligada salvo `ativo: false`. */
export async function criarSkillTeste(slug: string, s: {
  nome: string; tipo: TipoSkill; titulo?: string; descricao: string; corpo: string; ativo?: boolean; arquivos?: { caminho: string; conteudo: string }[];
}): Promise<string> {
  const { data: a } = await db.from('agentes').select('id').eq('slug', slug).single();
  const { data: skill, error } = await db.from('agente_skills').insert({ agente_id: a!.id, nome: s.nome, tipo: s.tipo, ativo: s.ativo ?? true }).select('id').single();
  if (error) throw new Error(`criarSkillTeste: ${error.message}`);
  const { data: v, error: e2 } = await db.from('agente_skill_versoes').insert({
    skill_id: skill!.id, versao: 1, titulo: s.titulo ?? s.nome, descricao: s.descricao, tipo: s.tipo, corpo: s.corpo,
    skill_md: `---\nname: ${s.nome}\ndescription: ${s.descricao}\ntipo: ${s.tipo}\n---\n${s.corpo}`,
  }).select('id').single();
  if (e2) throw new Error(`criarSkillTeste: ${e2.message}`);
  if (s.arquivos?.length) await db.from('agente_skill_arquivos').insert(s.arquivos.map((x) => ({ versao_id: v!.id, ...x })));
  return skill!.id;
}
```

- [ ] **Passo 2: escrever o teste que falha**

`apps/trabalhador/test/agente/ler-skill.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { PerfilAgente, Repos, SkillCarregada } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import type { ContextoAgente } from '../../src/agente/contexto';
import { executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { carregarPerfil, ferramentasDoPerfil, PERFIL_PADRAO_ATENDIMENTO } from '../../src/agente/perfil';
import { montarSistema } from '../../src/agente/prompt';
import { processarSimulacao } from '../../src/agente/simular';
import { AVISOS_SKILL, TAMANHO_PARTE_REFERENCIA } from '../../src/agente/skills';
import { criarSkillTeste, db, repos } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { CASOS_RETRATO } from '../apoio/retrato';
import { criarUsuarioTeste } from '../apoio/usuario';

const skill = (tipo: SkillCarregada['tipo'], nome: string, arquivos: string[] = []): SkillCarregada =>
  ({ id: `id-${nome}`, nome, tipo, ativa: true, titulo: `Título ${nome}`, descricao: `Quando ${nome}.`, corpo: `Texto de ${nome}.`, versao: 2, arquivos });
const perfil = (skills: SkillCarregada[]): PerfilAgente => ({ ...PERFIL_PADRAO_ATENDIMENTO, id: 'agente-x', skills });

function rodar(p: PerfilAgente, nome: string, entrada: object, texto: string | null = null) {
  const decisoes: { etapa: string; saida: unknown }[] = [];
  const pedidas: unknown[][] = [];
  const reposFalso = {
    registrarDecisao: async (d: { etapa: string; saida: unknown }) => { decisoes.push(d); },
    referenciaDaSkill: async (...a: unknown[]) => { pedidas.push(a); return texto; },
  } as unknown as Repos;
  const ctx = { ...CASOS_RETRATO['contato-uma-empresa']!(), agente: p } as ContextoAgente;
  const estado: EstadoExecucao = { ctx, respondeu: false };
  return { r: executarFerramenta({ repos: reposFalso, ia: {} as never, envio: {} as never }, estado, nome, entrada), decisoes, pedidas };
}

describe('índice e ferramentas de skill (D4, D5)', () => {
  it('só com skill sob demanda: índice com nome, tipo e descrição; ler_skill e ler_referencia no fim das ferramentas', () => {
    const p = perfil([skill('limites', 'limite-x'), skill('procedimento', 'certidao'), skill('exemplos', 'boas-respostas')]);
    const s = montarSistema([], [], { gerais: [], porSetor: [] }, p.skills);
    expect(s).toContain('SKILLS PARA LER QUANDO PRECISAR');
    expect(s).toContain('- certidao [Procedimentos]: Quando certidao.\n- boas-respostas [Exemplos]: Quando boas-respostas.');
    expect(s).not.toContain('- limite-x [');
    expect(ferramentasDoPerfil(p).slice(-2).map((t) => t.name)).toEqual(['ler_skill', 'ler_referencia']);
    expect(ferramentasDoPerfil(perfil([skill('limites', 'limite-x')])).map((t) => t.name)).not.toContain('ler_skill');
  });
});

describe('ler_skill e ler_referencia (spec 7E.10: só skills ligadas do próprio agente)', () => {
  it('ler_skill devolve o texto da skill do perfil; a decisão guarda só o tamanho', async () => {
    const { r, decisoes } = rodar(perfil([skill('procedimento', 'certidao', ['passos.md'])]), 'ler_skill', { nome: 'certidao' });
    expect(JSON.parse((await r).resultado)).toEqual({ nome: 'certidao', tipo: 'Procedimentos', titulo: 'Título certidao', versao: 2,
      texto: 'Texto de certidao.', arquivos: ['passos.md'] });
    expect(decisoes[0]).toMatchObject({ etapa: 'ler_skill', saida: { texto: '(18 caracteres)' } });
  });
  it('skill que não está no perfil (de outro agente, desligada ou arquivada): não encontrada', async () => {
    const { r } = rodar(perfil([skill('procedimento', 'certidao')]), 'ler_skill', { nome: 'jeito-do-fiscal' });
    expect(await r).toEqual({ resultado: JSON.stringify({ erro: AVISOS_SKILL.naoEncontrada }), erro: true });
  });
  it('ler_referencia só de arquivo listado na skill; texto grande em partes', async () => {
    const p = perfil([skill('conhecimento', 'cfop', ['tabela.csv'])]);
    expect(await rodar(p, 'ler_referencia', { skill: 'cfop', arquivo: 'outro.csv' }).r)
      .toEqual({ resultado: JSON.stringify({ erro: AVISOS_SKILL.arquivoNaoEncontrado }), erro: true });
    const grande = 'a'.repeat(TAMANHO_PARTE_REFERENCIA * 2 + 10);
    const { r, pedidas } = rodar(p, 'ler_referencia', { skill: 'cfop', arquivo: 'tabela.csv', parte: 3 }, grande);
    expect(JSON.parse((await r).resultado)).toMatchObject({ parte: 3, partes: 3, texto: 'a'.repeat(10) });
    expect(pedidas).toEqual([['agente-x', 'cfop', 'tabela.csv', null]]);
    expect(await rodar(p, 'ler_referencia', { skill: 'cfop', arquivo: 'tabela.csv', parte: 4 }, grande).r)
      .toEqual({ resultado: JSON.stringify({ erro: AVISOS_SKILL.parteInvalida }), erro: true });
  });
});

describe('no banco', () => {
  beforeEach(limparBanco);
  it('o perfil do Thiago carrega só as ligadas dele; a em teste entra desligada', async () => {
    await criarSkillTeste('atendimento', { nome: 'certidao', tipo: 'procedimento', descricao: 'Certidão.', corpo: 'Pergunte a finalidade.' });
    const off = await criarSkillTeste('atendimento', { nome: 'cfop', tipo: 'conhecimento', descricao: 'CFOP.', corpo: 'Tabela.', ativo: false });
    await criarSkillTeste('fiscal', { nome: 'jeito-do-fiscal', tipo: 'jeito', descricao: 'Tom.', corpo: 'Assine Fiscal.' });
    expect((await carregarPerfil(repos, 'atendimento')).skills.map((s) => s.nome)).toEqual(['certidao']);
    expect((await carregarPerfil(repos, 'atendimento', off)).skills.map((s) => [s.nome, s.ativa])).toEqual([['certidao', true], ['cfop', false]]);
  });

  it('teste de skill (Testar): a skill desligada entra, a leitura aparece e a observação avisa', async () => {
    const usuario = await criarUsuarioTeste({ email: 'dono@skill.local', papel: 'admin', permissoes: ['treinar_agente'] });
    const off = await criarSkillTeste('atendimento', { nome: 'cfop', tipo: 'conhecimento', titulo: 'Tabela CFOP', descricao: 'CFOP de venda.',
      corpo: 'Venda dentro do estado: 5102.', ativo: false });
    const { data: sim } = await db.from('simulacoes_agente').insert({ usuario_id: usuario, mensagem: 'Qual o CFOP de venda?', skill_id: off }).select('id').single();
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'ler_skill', entrada: { nome: 'cfop' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'É o 5102.' } }), fim(),
    ]);
    expect(await processarSimulacao({ repos, ia, envio: {} as never }, sim!.id, true)).toBe('pronta');
    expect(ia.recebidos[0]!.tools!.map((t) => (t as { name: string }).name)).toContain('ler_skill');
    const { data } = await db.from('simulacoes_agente').select('respostas').eq('id', sim!.id).single();
    const respostas = data!.respostas as { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[]; observacoes: string[] };
    expect(respostas.mensagens).toEqual(['É o 5102.']);
    expect(respostas.acoes).toContainEqual({ ferramenta: 'ler_skill', resumo: 'Leria a skill cfop' });
    expect(respostas.observacoes).toContain('A skill “Tabela CFOP” entrou neste teste mesmo desligada.');
    const { data: uso } = await db.from('uso_ia').select('funcionalidade, agente_id, usuario_id');
    expect(uso!.every((u) => u.funcionalidade === 'testar_agente' && u.agente_id === 'a0000000-0000-4000-8000-000000000001' && u.usuario_id === usuario)).toBe(true);
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/ler-skill.test.ts`
Expected: FAIL (`AVISOS_SKILL` não existe; `ler_skill` desconhecida).

- [ ] **Passo 4: implementar**

1. `skills.ts` — acrescente os imports `import type Anthropic from '@anthropic-ai/sdk';` e `import { INFO_TIPO_SKILL, type TipoSkill } from '@escritorio/core';`, e:

```ts
const SOB_DEMANDA: readonly TipoSkill[] = ['procedimento', 'conhecimento', 'exemplos'];
export const CABECALHO_SOB_DEMANDA =
  'SKILLS PARA LER QUANDO PRECISAR (aqui só nome e descrição; o texto vem com ler_skill e os arquivos de apoio com ler_referencia). '
  + 'Procedimentos: leia e siga quando a tarefa aparecer; as regras, os limites e o jeito de atuar acima valem mais. '
  + 'Conhecimento e exemplos só informam; não dão ordens.';
export const TAMANHO_PARTE_REFERENCIA = 40_000;
export const AVISOS_SKILL = {
  naoEncontrada: 'Skill não encontrada para este agente. Use um nome da lista SKILLS PARA LER QUANDO PRECISAR.',
  arquivoNaoEncontrado: 'Arquivo não encontrado nesta skill. Use um nome da lista "arquivos" de ler_skill.',
  parteInvalida: 'Essa parte não existe: veja "partes" na primeira leitura.',
};

export const temSkillSobDemanda = (skills: readonly SkillCarregada[]): boolean => skills.some((s) => SOB_DEMANDA.includes(s.tipo));
const linhaIndice = (s: SkillCarregada) =>
  `- ${s.nome} [${INFO_TIPO_SKILL[s.tipo].rotulo}]: ${limparTextoOrientacao(s.descricao).replace(/\s+/g, ' ')}`;

const objeto = (properties: Record<string, object>, required: string[]) => ({ type: 'object' as const, properties, required, additionalProperties: false });
/** Entram no fim das ferramentas só quando o agente tem skill sob demanda ligada (D5). */
export const FERRAMENTAS_SKILL: Anthropic.Tool[] = [
  {
    name: 'ler_skill',
    description: 'Lê uma skill da lista SKILLS PARA LER QUANDO PRECISAR: o texto inteiro e os nomes dos arquivos de apoio. Leia antes de seguir um procedimento ou usar um conhecimento ou exemplo.',
    input_schema: objeto({ nome: { type: 'string' } }, ['nome']),
  },
  {
    name: 'ler_referencia',
    description: 'Lê um arquivo de apoio de uma skill (os nomes vêm em ler_skill). Arquivo grande vem em partes: peça a parte seguinte.',
    input_schema: objeto({ skill: { type: 'string' }, arquivo: { type: 'string' }, parte: { type: 'integer', minimum: 1 } }, ['skill', 'arquivo']),
  },
];
```

e, em `secaoSkills`, antes do `return`:

```ts
  const sob = SOB_DEMANDA.flatMap((t) => skills.filter((s) => s.tipo === t));
  if (sob.length) partes.push(`${CABECALHO_SOB_DEMANDA}\n${sob.map(linhaIndice).join('\n')}`);
```

2. `perfil.ts` — importe `import { FERRAMENTAS_SKILL, temSkillSobDemanda } from './skills';` e troque `ferramentasDoPerfil`:

```ts
/** As ferramentas liberadas no perfil, na ordem de FERRAMENTAS; as de skill no fim, só com skill sob demanda (D5). */
export function ferramentasDoPerfil(p: PerfilAgente): Anthropic.Tool[] {
  const base = FERRAMENTAS.filter((f) => p.ferramentas.includes(f.name));
  return temSkillSobDemanda(p.skills) ? [...base, ...FERRAMENTAS_SKILL] : base;
}
```

3. `ferramentas.ts` — importe `import { INFO_TIPO_SKILL } from '@escritorio/core';` (junto dos outros do core) e `import { AVISOS_SKILL, TAMANHO_PARTE_REFERENCIA } from './skills';`. Em `Entradas`, antes de `responder`:

```ts
  ler_skill: z.object({ nome: z.string().trim().min(1).max(64) }),
  ler_referencia: z.object({ skill: z.string().trim().min(1).max(64), arquivo: z.string().trim().min(1).max(200), parte: z.number().int().min(1).max(100).catch(1) }),
```

Em `executarValidada`, antes de `case 'responder'`:

```ts
    case 'ler_skill': {
      // Só as skills do perfil: ligadas do próprio agente (e a em teste, na simulação). D5.
      const s = ctx.agente?.skills.find((x) => x.nome === entrada.nome);
      if (!s) return falha(AVISOS_SKILL.naoEncontrada);
      return ok({ nome: s.nome, tipo: INFO_TIPO_SKILL[s.tipo].rotulo, titulo: s.titulo, versao: s.versao, texto: s.corpo, arquivos: s.arquivos });
    }

    case 'ler_referencia': {
      const s = ctx.agente?.skills.find((x) => x.nome === entrada.skill);
      if (!s || !ctx.agente?.id) return falha(AVISOS_SKILL.naoEncontrada);
      if (!s.arquivos.includes(entrada.arquivo)) return falha(AVISOS_SKILL.arquivoNaoEncontrado);
      const texto = await d.repos.referenciaDaSkill(ctx.agente.id, s.nome, entrada.arquivo, ctx.agente.skillEmTeste);
      if (texto === null) return falha(AVISOS_SKILL.arquivoNaoEncontrado);
      const partes = Math.max(1, Math.ceil(texto.length / TAMANHO_PARTE_REFERENCIA));
      if (entrada.parte > partes) return falha(AVISOS_SKILL.parteInvalida);
      const inicio = (entrada.parte - 1) * TAMANHO_PARTE_REFERENCIA;
      return ok({ skill: s.nome, arquivo: entrada.arquivo, parte: entrada.parte, partes, texto: texto.slice(inicio, inicio + TAMANHO_PARTE_REFERENCIA) });
    }
```

Em `executarFerramenta`, troque o `registrarDecisao` por:

```ts
  const saida = JSON.parse(r.resultado) as Record<string, unknown>;
  // Leitura de skill: a decisão guarda o que foi lido, não o texto (ele está na versão da skill).
  if ((nome === 'ler_skill' || nome === 'ler_referencia') && typeof saida.texto === 'string') saida.texto = `(${saida.texto.length} caracteres)`;
  await d.repos.registrarDecisao({
    conversaId: estado.ctx.conversa.id, clienteId: estado.ctx.empresaEmFoco?.id ?? null,
    etapa: nome, entrada, saida, turno: estado.turno ?? null,
  });
  return r;
```

4. `simular.ts`:
   - em `LEITURAS`, acrescente `'ler_skill', 'ler_referencia'`; em `LEITURAS_REPOS`, `'referenciaDaSkill'`;
   - em `simular`, troque a linha da Task 7 por `const agente = await carregarPerfil(repos, SLUG_ATENDIMENTO, sim.skill_id ?? null);`;
   - em `criarExecutorSimulado`, antes de `if (LEITURAS.has(v.nome))`: `if (v.nome === 'ler_skill') acao(r, 'ler_skill', \`Leria a skill ${v.dados.nome}\`);`
   - no fim de `observar`:

```ts
  // Teste de skill (aba Testar, D21): avisa se ela entrou desligada e se o agente nem chegou a ler.
  const emTeste = sim.skill_id ? ctx.agente?.skills.find((s) => s.id === sim.skill_id) : undefined;
  if (emTeste && !emTeste.ativa) r.observacoes.push(`A skill “${emTeste.titulo}” entrou neste teste mesmo desligada.`);
  if (emTeste && !['jeito', 'limites'].includes(emTeste.tipo) && !r.acoes.some((a) => a.ferramenta === 'ler_skill' && a.resumo.endsWith(` ${emTeste.nome}`))) {
    r.observacoes.push(`O agente não leu a skill “${emTeste.titulo}” neste teste: ele só lê quando o assunto aparece. Escreva uma mensagem sobre o assunto dela.`);
  }
```

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/ler-skill.test.ts test/agente/motor-thiago.test.ts test/agente/retrato-thiago.test.ts`
Expected: tudo passa; nenhum retrato escrito.

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: tudo passa (inclusive `simular.test.ts`, `sem-emoji.test.ts`).

- [ ] **Passo 6: commit** (volte `supabase/config.toml` e `.env` antes)

```bash
git add apps/trabalhador/src/agente/skills.ts apps/trabalhador/src/agente/perfil.ts apps/trabalhador/src/agente/ferramentas.ts apps/trabalhador/src/agente/simular.ts apps/trabalhador/test/apoio/cenario.ts apps/trabalhador/test/agente/ler-skill.test.ts
git commit -m "$(cat <<'EOF'
feat(agente): skills sob demanda (índice no prompt, ler_skill e ler_referencia só das ligadas do próprio agente) e teste com uma skill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Cenários com Claude de verdade (`motor:`)

**Files:**
- Modify: `apps/trabalhador/src/cenarios/cenarios.ts`, `apps/trabalhador/src/cenarios/rodar.ts`

**Interfaces:**
- Consumes: Tasks 7–8; `criarSkillTeste` (Task 8).
- Produces: campo novo em `Cenario`: `skills?: { tipo: TipoSkill; nome: string; titulo: string; descricao: string; corpo: string; arquivos?: { caminho: string; conteudo: string }[] }[]` (skills **ligadas do Thiago**).

- [ ] **Passo 1: o executor**

Em `rodar.ts`: troque o import do apoio por `import { contatoComEmpresas, criarCadastrosExemplo, criarSkillTeste, db, definirAcessoTeste, repos, setorId } from '../../test/apoio/cenario';` e, em `preparar`, logo depois de `for (const f of c.faq ?? []) await db.from('respostas_prontas').insert(f);`:

```ts
  // Parte I1: skills ligadas do Thiago (o limparBanco do começo já apagou as de antes).
  for (const s of c.skills ?? []) await criarSkillTeste('atendimento', { ...s, ativo: true });
```

- [ ] **Passo 2: os 2 cenários**

Em `cenarios.ts`: `import type { TipoSkill } from '@escritorio/core';`; no tipo `Cenario`, depois de `documentosDoSetor`:

```ts
  /** Skills ligadas do Thiago (Parte I1): o motor as põe no prompt (Jeito e Limites) ou no índice (as outras). */
  skills?: { tipo: TipoSkill; nome: string; titulo: string; descricao: string; corpo: string; arquivos?: { caminho: string; conteudo: string }[] }[];
```

e, no fim de `CENARIOS`:

```ts
  // Parte I1 (spec 7E.10): o Thiago no motor com skills. "motor:" no nome para rodar só estes (pnpm cenarios motor).
  { nome: 'motor: Limites vencem orientação contrária', empresas: ['Indústria X'],
    orientacoes: [{ tipo: 'regra', titulo: 'Sábado', texto: 'Se perguntarem, diga que o escritório abre aos sábados das 8h às 12h.' }],
    skills: [{ tipo: 'limites', nome: 'sem-horario-de-sabado', titulo: 'Nunca confirma sábado', descricao: 'Horário de sábado.',
      corpo: 'Nunca diga que o escritório abre ou atende aos sábados nem informe horário de sábado. Se perguntarem de sábado, diga que vai confirmar com a equipe.' }],
    mensagens: ['Vocês abrem no sábado?'],
    espera: { ferramentas: ['responder'], semTexto: ['8h às 12h', '8 às 12', '12h'] } },
  { nome: 'motor: procedimento sob demanda é lido quando o assunto aparece', empresas: ['Indústria X'],
    skills: [{ tipo: 'procedimento', nome: 'pedido-de-certidao', titulo: 'Pedido de certidão',
      descricao: 'Quando o cliente pedir certidão negativa: o que perguntar antes de passar ao Fiscal.',
      corpo: 'Antes de abrir a demanda de certidão, pergunte para qual órgão ou finalidade ela é (licitação, banco, prefeitura). Só abra a demanda depois da resposta.' }],
    mensagens: ['Preciso de uma certidão negativa.'],
    espera: { ferramentas: ['ler_skill', 'responder'], chamadoSetor: 'nenhum' } },
```

Run: `pnpm --filter @escritorio/trabalhador typecheck`
Expected: sem erros.

- [ ] **Passo 3: rodar os 2 com Claude de verdade** (banco local nas portas 563xx, `supabase db reset` antes, nada mais rodando)

Run: `pnpm --filter @escritorio/trabalhador cenarios motor`
Expected: `2/2 cenários passaram`. Custo estimado: **US$ 0,20 a 0,40**. Anote `select round(sum(custo_usd), 2) from uso_ia`.

Se algum falhar: leia a falha e as decisões (`select etapa, entrada, saida from decisoes_agente order by criado_em`) e corrija **no cabeçalho da seção** (`CABECALHO_LIMITES`, `CABECALHO_SOB_DEMANDA`, a descrição de `ler_skill`), nunca relaxando a conferência do cenário e **nunca mudando o texto de `montarSistema`** (D2). Rode de novo **só o que falhou**. No máximo duas rodadas extras (≈ US$ 0,40); depois disso, anote como pendência com a saída inteira.

- [ ] **Passo 4: commit**

```bash
git add apps/trabalhador/src/cenarios/cenarios.ts apps/trabalhador/src/cenarios/rodar.ts
git commit -m "$(cat <<'EOF'
test(agente): cenários com Claude real do motor (Limites vencem orientação contrária; procedimento lido quando o assunto aparece)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 10: Painel. Leituras dos agentes (com a volta sem a migração), acesso e ações do dono

**Files:**
- Create: `apps/painel/src/lib/agentes.ts`, `apps/painel/src/lib/agentes.test.ts`
- Create: `apps/painel/src/lib/agentes-acoes.ts`, `apps/painel/src/lib/agentes-acoes.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5 (tabelas, funções, `@escritorio/core`); `temNivel`, `obterUsuario`, `UsuarioPainel`, `supabaseServidor`, `mensagemDoBanco`.
- Produces (`lib/agentes.ts`, server-only):
  - `semMigracaoI1(e)`; `type Agente = { id; slug; nome; descricao; setorId: string | null; setor: string | null; tipos: TipoAgente[]; estado: EstadoAgente; modelo: string | null; modoContato: ModoContato | null; ferramentas: string[]; portaDeEntrada: boolean; criadoEm: string; atualizadoEm: string; atualizadoPor: string | null }`; `lerLinhaAgente(linha)`; `THIAGO_SEM_MIGRACAO: Agente`;
  - `lerAgentes(sb) → { agentes: Agente[]; semMigracao: boolean; erro: boolean }`, `lerAgente(sb, slug) → { agente: Agente | null; semMigracao: boolean }`, `souDono(sb) → boolean`;
  - `type AcessoAgentes = { ver: boolean; dono: boolean; numeros: boolean }`, `acessoAosAgentes(u, dono)`, `podeTreinarAgente(u, agente)`;
  - `type Contagens = { skills: number; ferramentas: number; orientacoes: number }`, `lerContagens(sb, agentes) → Map<string, Contagens>`;
  - `type NumerosAgente = { atendimentos; resolvidos; custoUsd; custoTestesUsd; ultimaEm: string | null; ultimaEmpresa: string | null }`, `lerNumeros(sb, de, ate) → Map<string, NumerosAgente> | null`;
  - `type Mudanca = { id; descricao; quem: string | null; quando: string }`, `lerMudancas(sb, agenteId, limite)`;
  - `type SkillTela = { id; nome; tipo: TipoSkill; ativo: boolean; versao: number; titulo; descricao; arquivos: string[]; atualizadaEm: string; autor: string | null }`, `lerSkills(sb, agenteId)`;
  - `type VersaoSkill = { id; versao; titulo; descricao; tipo: TipoSkill; corpo; skillMd; origem: 'subida' | 'restaurada'; restauradaDe: number | null; autor: string | null; criadoEm: string; arquivos: string[] }`, `lerVersoesSkill(sb, skillId)`;
  - `type RegraAssunto = { id; assunto; exemplo; modo: ModoContato }`, `lerRegras(sb, agenteId)`; `type ContatoTeste = { id; nome; telefone }`, `lerContatosTeste(sb, agenteId)`; `lerUsoSkills(sb, slug, de, ate) → Map<string, number>`; `lerModelos(sb) → { padrao: string; comPreco: string[] }`.
- Produces (`lib/agentes-acoes.ts`, `'use server'`): `type ResultadoAcao = { ok: true } | { ok: false; erro: string }`; `salvarAgente(slug, dados: DadosAgente)`; `definirContatosTeste(slug, contatoIds: string[])`; `salvarRegraAssunto(slug, id: string | null, dados: { assunto; exemplo; modo })`; `excluirRegraAssunto(id)`; `criarAgente(dados: { nome; setorId: string | null; tipos: TipoAgente[]; descricao }) → { ok: true; slug } | { ok: false; erro }`; `buscarContatosParaTeste(q: string) → ContatoTeste[]`.

- [ ] **Passo 1: testes que falham**

`apps/painel/src/lib/agentes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { NIVEIS_PADRAO } from '@escritorio/core';

vi.mock('server-only', () => ({}));
const { THIAGO_SEM_MIGRACAO, acessoAosAgentes, lerAgentes, lerLinhaAgente, podeTreinarAgente, semMigracaoI1 } = await import('./agentes');

const FIS = '33333333-3333-4333-8333-333333333333';
const u = (papel: 'admin' | 'atendente', treinar: 'nao' | 'sim', setores: string[] = []) =>
  ({ papel, niveis: { ...NIVEIS_PADRAO, treinar }, setores });
const linha = {
  id: 'a1', slug: 'fiscal', nome: 'Agente Fiscal', descricao: 'notas e guias', setor_id: FIS, tipos: ['conversa', 'trabalho'], estado: 'teste',
  modelo: null, modo_contato: 'mesma_voz', ferramentas: ['responder'], porta_de_entrada: false, criado_em: '2026-09-12T12:00:00Z',
  atualizado_em: '2026-09-30T12:00:00Z', setores: { nome: 'Fiscal' }, atualizador: { nome: 'Thiago' },
};

describe('leitura dos agentes (D23)', () => {
  it('linha do banco vira Agente; valores estranhos viram o mais seguro', () => {
    expect(lerLinhaAgente(linha)).toEqual({ id: 'a1', slug: 'fiscal', nome: 'Agente Fiscal', descricao: 'notas e guias', setorId: FIS, setor: 'Fiscal',
      tipos: ['conversa', 'trabalho'], estado: 'teste', modelo: null, modoContato: 'mesma_voz', ferramentas: ['responder'], portaDeEntrada: false,
      criadoEm: '2026-09-12T12:00:00Z', atualizadoEm: '2026-09-30T12:00:00Z', atualizadoPor: 'Thiago' });
    expect(lerLinhaAgente({ ...linha, estado: 'xyz', modo_contato: 'outro', tipos: ['nada'] })).toMatchObject({ estado: 'desligado', modoContato: null, tipos: ['conversa'] });
  });
  it('banco sem a Parte I: só o Thiago do código, sem erro', async () => {
    const sb = { from: () => ({ select: () => ({ order: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) }) }) };
    expect(await lerAgentes(sb as never)).toEqual({ agentes: [THIAGO_SEM_MIGRACAO], semMigracao: true, erro: false });
    expect(semMigracaoI1({ code: 'PGRST205' })).toBe(true);
    expect(semMigracaoI1({ code: '23505' })).toBe(false);
  });
  it('outro erro: lista vazia com erro (a tela avisa), nunca "sem migração"', async () => {
    const sb = { from: () => ({ select: () => ({ order: async () => ({ data: null, error: { code: '57014', message: 'timeout' } }) }) }) };
    expect(await lerAgentes(sb as never)).toEqual({ agentes: [], semMigracao: false, erro: true });
  });
});

describe('quem vê e quem mexe (D12)', () => {
  it('ver: administrador, dono ou Treinar o agente; números: dono e administrador', () => {
    expect(acessoAosAgentes(u('atendente', 'nao'), false)).toEqual({ ver: false, dono: false, numeros: false });
    expect(acessoAosAgentes(u('atendente', 'sim'), false)).toEqual({ ver: true, dono: false, numeros: false });
    expect(acessoAosAgentes(u('admin', 'nao'), false)).toEqual({ ver: true, dono: false, numeros: true });
    expect(acessoAosAgentes(u('admin', 'nao'), true)).toEqual({ ver: true, dono: true, numeros: true });
  });
  it('orientações: o Thiago com Treinar o agente; os outros também pelo setor', () => {
    const fiscal = { portaDeEntrada: false, setorId: FIS };
    expect(podeTreinarAgente(u('atendente', 'sim'), THIAGO_SEM_MIGRACAO)).toBe(true);
    expect(podeTreinarAgente(u('atendente', 'sim'), fiscal)).toBe(false);
    expect(podeTreinarAgente(u('atendente', 'sim', [FIS]), fiscal)).toBe(true);
    expect(podeTreinarAgente(u('admin', 'nao'), fiscal)).toBe(true);
    expect(podeTreinarAgente(u('atendente', 'nao', [FIS]), fiscal)).toBe(false);
  });
});
```

`apps/painel/src/lib/agentes-acoes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const C1 = '11111111-1111-4111-8111-111111111111';
const FIS = '33333333-3333-4333-8333-333333333333';
const falso = vi.hoisted(() => ({
  erroRpc: null as { code: string; message: string } | null,
  dados: 'irpf' as unknown,
  chamadas: [] as [string, unknown][],
  revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: unknown) => { falso.chamadas.push([nome, args]); return { data: falso.dados, error: falso.erroRpc }; },
  }),
}));
const { criarAgente, definirContatosTeste, salvarAgente, salvarRegraAssunto } = await import('./agentes-acoes');

beforeEach(() => { Object.assign(falso, { erroRpc: null, dados: 'irpf', chamadas: [], revalidados: [] }); });

describe('ações do dono (D11, D14)', () => {
  it('salvarAgente manda só as chaves que mudaram, com os nomes do banco', async () => {
    expect(await salvarAgente('fiscal', { estado: 'teste', modoContato: 'mesma_voz', setorId: FIS })).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['salvar_agente', { p_slug: 'fiscal', p_dados: { estado: 'teste', modo_contato: 'mesma_voz', setor_id: FIS } }]]);
    expect(falso.revalidados).toContain('/agentes');
  });
  it('dado inválido não chega ao banco', async () => {
    expect(await salvarAgente('fiscal', { estado: 'quase' as never })).toEqual({ ok: false, erro: 'Estado inválido.' });
    expect(await definirContatosTeste('fiscal', ['nao-e-uuid'])).toEqual({ ok: false, erro: 'Contato inválido.' });
    expect(await definirContatosTeste('fiscal', Array.from({ length: 21 }, () => C1))).toEqual({ ok: false, erro: 'Em teste, no máximo 20 contatos.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('recusa do banco (P0001) vira a frase para a pessoa', async () => {
    falso.erroRpc = { code: 'P0001', message: 'Só o dono altera os agentes.' };
    expect(await salvarRegraAssunto('fiscal', null, { assunto: 'Nota', exemplo: '', modo: 'mesma_voz' })).toEqual({ ok: false, erro: 'Só o dono altera os agentes.' });
  });
  it('criarAgente tira o endereço do nome (D25)', async () => {
    expect(await criarAgente({ nome: 'Agente do IRPF', setorId: null, tipos: ['conversa'], descricao: '' })).toEqual({ ok: true, slug: 'irpf' });
    expect(falso.chamadas[0]).toEqual(['criar_agente', { p_dados: { slug: 'agente-do-irpf', nome: 'Agente do IRPF', setor_id: null, tipos: ['conversa'], descricao: '' } }]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/agentes.test.ts src/lib/agentes-acoes.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Passo 3: implementar a leitura**

`apps/painel/src/lib/agentes.ts`:

```ts
import 'server-only';
import {
  AGENTE_ATENDIMENTO_ID, ESTADOS_AGENTE, FERRAMENTAS_ATENDIMENTO, MODOS_CONTATO, SLUG_ATENDIMENTO, TIPOS_AGENTE, TIPOS_SKILL,
  type EstadoAgente, type ModoContato, type TipoAgente, type TipoSkill,
} from '@escritorio/core';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import type { supabaseServidor } from '@/lib/supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Banco sem a Parte I (homologação, D23): tabela, coluna ou função que não existem. Só leitura GET ou rpc, nunca head. */
export function semMigracaoI1(e: { code?: string } | null | undefined): boolean {
  return !!e && ['42703', '42P01', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'].includes(e.code ?? '');
}

export type Agente = {
  id: string; slug: string; nome: string; descricao: string; setorId: string | null; setor: string | null; tipos: TipoAgente[];
  estado: EstadoAgente; modelo: string | null; modoContato: ModoContato | null; ferramentas: string[]; portaDeEntrada: boolean;
  criadoEm: string; atualizadoEm: string; atualizadoPor: string | null;
};
type LinhaAgente = {
  id: string; slug: string; nome: string; descricao: string; setor_id: string | null; tipos: string[]; estado: string; modelo: string | null;
  modo_contato: string | null; ferramentas: string[]; porta_de_entrada: boolean; criado_em: string; atualizado_em: string;
  setores?: { nome: string } | null; atualizador?: { nome: string } | null;
};
export const COLUNAS_AGENTE = 'id, slug, nome, descricao, setor_id, tipos, estado, modelo, modo_contato, ferramentas, porta_de_entrada, criado_em, atualizado_em, setores(nome), atualizador:usuarios!agentes_atualizado_por_fkey(nome)';

const de = <T extends string>(lista: readonly T[], v: unknown): v is T => (lista as readonly unknown[]).includes(v);

/** Linha do banco → Agente; valor que não se reconhece vira o mais seguro (desligado, sem modo). */
export function lerLinhaAgente(l: LinhaAgente): Agente {
  const tipos = (l.tipos ?? []).filter((t): t is TipoAgente => de(TIPOS_AGENTE, t));
  return {
    id: l.id, slug: l.slug, nome: l.nome, descricao: l.descricao ?? '', setorId: l.setor_id, setor: l.setores?.nome ?? null,
    tipos: tipos.length ? tipos : ['conversa'], estado: de(ESTADOS_AGENTE, l.estado) ? l.estado : 'desligado', modelo: l.modelo,
    modoContato: de(MODOS_CONTATO, l.modo_contato) ? l.modo_contato : null, ferramentas: l.ferramentas ?? [], portaDeEntrada: l.porta_de_entrada === true,
    criadoEm: l.criado_em, atualizadoEm: l.atualizado_em, atualizadoPor: l.atualizador?.nome ?? null,
  };
}

/** O Thiago sem o banco novo (D23): o bastante para a lista e para as abas Orientações e Testar. */
export const THIAGO_SEM_MIGRACAO: Agente = {
  id: AGENTE_ATENDIMENTO_ID, slug: SLUG_ATENDIMENTO, nome: 'Thiago', descricao: 'porta de entrada no WhatsApp', setorId: null, setor: null,
  tipos: ['conversa'], estado: 'ligado', modelo: null, modoContato: 'mesma_voz', ferramentas: [...FERRAMENTAS_ATENDIMENTO], portaDeEntrada: true,
  criadoEm: '', atualizadoEm: '', atualizadoPor: null,
};

export async function lerAgentes(sb: Sb): Promise<{ agentes: Agente[]; semMigracao: boolean; erro: boolean }> {
  const { data, error } = await sb.from('agentes').select(COLUNAS_AGENTE).order('ordem');
  if (semMigracaoI1(error)) return { agentes: [THIAGO_SEM_MIGRACAO], semMigracao: true, erro: false };
  if (error) {
    console.error('[agentes] falha ao ler os agentes', error);
    return { agentes: [], semMigracao: false, erro: true };
  }
  return { agentes: ((data ?? []) as unknown as LinhaAgente[]).map(lerLinhaAgente), semMigracao: false, erro: false };
}

export async function lerAgente(sb: Sb, slug: string): Promise<{ agente: Agente | null; semMigracao: boolean }> {
  const { data, error } = await sb.from('agentes').select(COLUNAS_AGENTE).eq('slug', slug).maybeSingle();
  if (semMigracaoI1(error)) return { agente: slug === SLUG_ATENDIMENTO ? THIAGO_SEM_MIGRACAO : null, semMigracao: true };
  if (error) console.error('[agentes] falha ao ler o agente', slug, error);
  return { agente: data ? lerLinhaAgente(data as unknown as LinhaAgente) : null, semMigracao: false };
}

export async function souDono(sb: Sb): Promise<boolean> {
  const { data, error } = await sb.rpc('eh_dono');
  if (error) {
    if (!semMigracaoI1(error)) console.error('[agentes] falha ao conferir o dono', error);
    return false;
  }
  return data === true;
}

export type AcessoAgentes = { ver: boolean; dono: boolean; numeros: boolean };
/** D12: a tela para administrador, dono e "Treinar o agente"; números e custos para dono e administrador. */
export function acessoAosAgentes(u: Pick<UsuarioPainel, 'papel' | 'niveis'>, dono: boolean): AcessoAgentes {
  const admin = u.papel === 'admin';
  return { ver: admin || dono || temNivel(u, 'treinar', 'sim'), dono, numeros: admin || dono };
}

/** Orientações (D12): do Thiago e de agente sem setor, "Treinar o agente"; dos outros, também ser do setor (ou administrador). */
export function podeTreinarAgente(u: Pick<UsuarioPainel, 'papel' | 'niveis' | 'setores'>, a: Pick<Agente, 'portaDeEntrada' | 'setorId'>): boolean {
  if (!temNivel(u, 'treinar', 'sim')) return false;
  return a.portaDeEntrada || a.setorId === null || u.papel === 'admin' || u.setores.includes(a.setorId);
}

export type Contagens = { skills: number; ferramentas: number; orientacoes: number };
export async function lerContagens(sb: Sb, agentes: Agente[]): Promise<Map<string, Contagens>> {
  const [skills, orientacoes] = await Promise.all([
    sb.from('agente_skills').select('agente_id').is('arquivada_em', null),
    sb.from('orientacoes_agente').select('agente_id'),
  ]);
  if (skills.error && !semMigracaoI1(skills.error)) console.error('[agentes] contagem de skills', skills.error);
  const conta = (linhas: { agente_id: string }[] | null, id: string) => (linhas ?? []).filter((l) => l.agente_id === id).length;
  return new Map(agentes.map((a) => [a.id, {
    skills: conta(skills.data, a.id), ferramentas: a.ferramentas.length,
    // Sem a migração (D23) não há agente_id: as orientações são todas do Thiago.
    orientacoes: orientacoes.error ? 0 : conta(orientacoes.data as { agente_id: string }[] | null, a.id),
  }]));
}

export type NumerosAgente = { atendimentos: number; resolvidos: number; custoUsd: number; custoTestesUsd: number; ultimaEm: string | null; ultimaEmpresa: string | null };
export async function lerNumeros(sb: Sb, de: string, ate: string): Promise<Map<string, NumerosAgente> | null> {
  const { data, error } = await sb.rpc('agentes_numeros', { p_de: de, p_ate: ate });
  if (error) {
    if (!semMigracaoI1(error)) console.error('[agentes] números do mês', error);
    return null;
  }
  return new Map((data ?? []).map((n) => [n.agente_id, {
    atendimentos: Number(n.atendimentos) || 0, resolvidos: Number(n.resolvidos) || 0, custoUsd: Number(n.custo_usd) || 0,
    custoTestesUsd: Number(n.custo_testes_usd) || 0, ultimaEm: n.ultima_em, ultimaEmpresa: n.ultima_empresa,
  }]));
}

export type Mudanca = { id: string; descricao: string; quem: string | null; quando: string };
export async function lerMudancas(sb: Sb, agenteId: string, limite: number): Promise<Mudanca[]> {
  const { data, error } = await sb.from('agente_mudancas').select('id, descricao, criado_em, usuarios(nome)')
    .eq('agente_id', agenteId).order('criado_em', { ascending: false }).limit(limite);
  if (error && !semMigracaoI1(error)) console.error('[agentes] mudanças', error);
  return (data ?? []).map((m) => ({ id: m.id, descricao: m.descricao, quem: m.usuarios?.nome ?? null, quando: m.criado_em }));
}

export type SkillTela = {
  id: string; nome: string; tipo: TipoSkill; ativo: boolean; versao: number; titulo: string; descricao: string; arquivos: string[];
  atualizadaEm: string; autor: string | null;
};
export async function lerSkills(sb: Sb, agenteId: string): Promise<SkillTela[]> {
  const { data: skills, error } = await sb.from('agente_skills').select('id, nome, tipo, ativo, versao_atual, atualizado_em')
    .eq('agente_id', agenteId).is('arquivada_em', null).order('nome');
  if (error) {
    if (!semMigracaoI1(error)) console.error('[agentes] skills', error);
    return [];
  }
  if (!skills?.length) return [];
  const { data: versoes } = await sb.from('agente_skill_versoes')
    .select('skill_id, versao, titulo, descricao, criado_em, usuarios(nome), agente_skill_arquivos(caminho)').in('skill_id', skills.map((s) => s.id));
  return skills.map((s) => {
    const v = (versoes ?? []).find((x) => x.skill_id === s.id && x.versao === s.versao_atual);
    return {
      id: s.id, nome: s.nome, tipo: (de(TIPOS_SKILL, s.tipo) ? s.tipo : 'conhecimento'), ativo: s.ativo, versao: s.versao_atual,
      titulo: v?.titulo ?? s.nome, descricao: v?.descricao ?? '', arquivos: (v?.agente_skill_arquivos ?? []).map((a) => a.caminho).sort(),
      atualizadaEm: v?.criado_em ?? s.atualizado_em, autor: v?.usuarios?.nome ?? null,
    };
  });
}

export type VersaoSkill = {
  id: string; versao: number; titulo: string; descricao: string; tipo: TipoSkill; corpo: string; skillMd: string; origem: 'subida' | 'restaurada';
  restauradaDe: number | null; autor: string | null; criadoEm: string; arquivos: string[];
};
export async function lerVersoesSkill(sb: Sb, skillId: string): Promise<VersaoSkill[]> {
  const { data, error } = await sb.from('agente_skill_versoes')
    .select('id, versao, titulo, descricao, tipo, corpo, skill_md, origem, restaurada_de, criado_em, usuarios(nome), agente_skill_arquivos(caminho)')
    .eq('skill_id', skillId).order('versao', { ascending: false });
  if (error) console.error('[agentes] versões da skill', error);
  return (data ?? []).map((v) => ({
    id: v.id, versao: v.versao, titulo: v.titulo, descricao: v.descricao, tipo: (de(TIPOS_SKILL, v.tipo) ? v.tipo : 'conhecimento'), corpo: v.corpo,
    skillMd: v.skill_md, origem: v.origem === 'restaurada' ? 'restaurada' : 'subida', restauradaDe: v.restaurada_de, autor: v.usuarios?.nome ?? null,
    criadoEm: v.criado_em, arquivos: (v.agente_skill_arquivos ?? []).map((a) => a.caminho).sort(),
  }));
}

export type RegraAssunto = { id: string; assunto: string; exemplo: string; modo: ModoContato };
export async function lerRegras(sb: Sb, agenteId: string): Promise<RegraAssunto[]> {
  const { data, error } = await sb.from('agente_regras_assunto').select('id, assunto, exemplo, modo').eq('agente_id', agenteId).order('criado_em');
  if (error && !semMigracaoI1(error)) console.error('[agentes] regras', error);
  return (data ?? []).filter((r) => de(MODOS_CONTATO, r.modo)).map((r) => ({ id: r.id, assunto: r.assunto, exemplo: r.exemplo, modo: r.modo as ModoContato }));
}

export type ContatoTeste = { id: string; nome: string; telefone: string };
export async function lerContatosTeste(sb: Sb, agenteId: string): Promise<ContatoTeste[]> {
  const { data, error } = await sb.from('agente_contatos_teste').select('contatos(id, nome, telefone)').eq('agente_id', agenteId);
  if (error && !semMigracaoI1(error)) console.error('[agentes] contatos em teste', error);
  return (data ?? []).flatMap((l) => (l.contatos ? [{ id: l.contatos.id, nome: l.contatos.nome, telefone: l.contatos.telefone }] : []));
}

export async function lerUsoSkills(sb: Sb, slug: string, de: string, ate: string): Promise<Map<string, number>> {
  const { data, error } = await sb.rpc('uso_skills', { p_slug: slug, p_de: de, p_ate: ate });
  if (error && !semMigracaoI1(error)) console.error('[agentes] uso das skills', error);
  return new Map((data ?? []).map((u) => [u.nome, Number(u.vezes) || 0]));
}

/** Modelos com preço (D29): o padrão de Configurações e os que têm preço em precos_modelos. */
export async function lerModelos(sb: Sb): Promise<{ padrao: string; comPreco: string[] }> {
  const { data } = await sb.from('configuracoes').select('modelo_conversa, precos_modelos').eq('id', 1).maybeSingle();
  return { padrao: data?.modelo_conversa ?? '', comPreco: Object.keys((data?.precos_modelos ?? {}) as Record<string, unknown>).sort() };
}
```

(Se o `select` com relação de `atualizador:usuarios!agentes_atualizado_por_fkey` não bater com o nome da chave estrangeira gerado, confira em `tipos.gen.ts` — `Relationships` de `agentes` — e use o nome que estiver lá.)

- [ ] **Passo 4: implementar as ações**

`apps/painel/src/lib/agentes-acoes.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { ESTADOS_AGENTE, MODOS_CONTATO, TIPOS_AGENTE, slugDoNome, type TipoAgente } from '@escritorio/core';
import type { ContatoTeste } from '@/lib/agentes';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export type ResultadoAcao = { ok: true } | { ok: false; erro: string };
const FALHA = 'Não foi possível salvar agora. Tente de novo.';
const Slug = z.string().regex(/^[a-z][a-z0-9-]{1,39}$/, 'Agente não encontrado.');
const Uuid = z.string().uuid('Contato inválido.');

const DadosAgente = z.object({
  nome: z.string().trim().min(2, 'O nome do agente tem de 2 a 60 letras.').max(60, 'O nome do agente tem de 2 a 60 letras.'),
  descricao: z.string().trim().max(120, 'A descrição tem até 120 letras.'),
  setorId: z.string().uuid('Setor não encontrado ou inativo.').nullable(),
  tipos: z.array(z.enum(TIPOS_AGENTE)).min(1, 'Escolha Conversa, Trabalho ou os dois.').max(2, 'Escolha Conversa, Trabalho ou os dois.'),
  estado: z.enum(ESTADOS_AGENTE, { message: 'Estado inválido.' }),
  modelo: z.string().trim().max(100).nullable(),
  modoContato: z.enum(MODOS_CONTATO, { message: 'Modo de falar com o cliente inválido.' }).nullable(),
  ferramentas: z.array(z.string().max(60)).max(60),
}).partial().strict();
export type DadosAgente = z.input<typeof DadosAgente>;

/** Chama a função do banco; P0001 é a frase para a pessoa (D11: o banco confere o dono de novo). */
async function chamar(rodar: (sb: Awaited<ReturnType<typeof supabaseServidor>>) => PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<ResultadoAcao> {
  try {
    await obterUsuario();
    const { error } = await rodar(await supabaseServidor());
    if (error) {
      if (error.code !== 'P0001') console.error('[agentes] falha ao salvar', error);
      return { ok: false, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
    }
    revalidatePath('/agentes', 'layout');
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
    console.error('[agentes] falha ao salvar', e);
    return { ok: false, erro: FALHA };
  }
}

export async function salvarAgente(slug: string, dados: DadosAgente): Promise<ResultadoAcao> {
  const s = Slug.safeParse(slug);
  const v = DadosAgente.safeParse(dados);
  if (!s.success) return { ok: false, erro: 'Agente não encontrado.' };
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? 'Dados do agente inválidos.' };
  const d = v.data;
  // Só as chaves que vieram: o banco mexe só nelas (e registra uma frase por mudança, D28).
  const p_dados = {
    ...(d.nome !== undefined ? { nome: d.nome } : {}), ...(d.descricao !== undefined ? { descricao: d.descricao } : {}),
    ...(d.setorId !== undefined ? { setor_id: d.setorId } : {}), ...(d.tipos !== undefined ? { tipos: d.tipos } : {}),
    ...(d.estado !== undefined ? { estado: d.estado } : {}), ...(d.modelo !== undefined ? { modelo: d.modelo } : {}),
    ...(d.modoContato !== undefined ? { modo_contato: d.modoContato } : {}), ...(d.ferramentas !== undefined ? { ferramentas: d.ferramentas } : {}),
  };
  return chamar((sb) => sb.rpc('salvar_agente', { p_slug: s.data, p_dados }));
}

export async function definirContatosTeste(slug: string, contatoIds: string[]): Promise<ResultadoAcao> {
  if (!Slug.safeParse(slug).success) return { ok: false, erro: 'Agente não encontrado.' };
  if (contatoIds.length > 20) return { ok: false, erro: 'Em teste, no máximo 20 contatos.' };
  if (!contatoIds.every((id) => Uuid.safeParse(id).success)) return { ok: false, erro: 'Contato inválido.' };
  return chamar((sb) => sb.rpc('definir_contatos_teste', { p_slug: slug, p_contatos: [...new Set(contatoIds)] }));
}

const Regra = z.object({
  assunto: z.string().trim().min(2, 'O assunto tem de 2 a 80 letras.').max(80, 'O assunto tem de 2 a 80 letras.'),
  exemplo: z.string().trim().max(200, 'O exemplo tem até 200 letras.'),
  modo: z.enum(MODOS_CONTATO, { message: 'Escolha como o agente fala com o cliente nesse assunto.' }),
});
export async function salvarRegraAssunto(slug: string, id: string | null, dados: z.input<typeof Regra>): Promise<ResultadoAcao> {
  const v = Regra.safeParse(dados);
  if (!Slug.safeParse(slug).success) return { ok: false, erro: 'Agente não encontrado.' };
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? 'Regra inválida.' };
  if (id !== null && !Uuid.safeParse(id).success) return { ok: false, erro: 'Regra não encontrada.' };
  return chamar((sb) => sb.rpc('salvar_regra_assunto', {
    p_slug: slug, p_id: id as unknown as string, p_assunto: v.data.assunto, p_exemplo: v.data.exemplo, p_modo: v.data.modo,
  }));
}

export async function excluirRegraAssunto(id: string): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(id).success) return { ok: false, erro: 'Regra não encontrada.' };
  return chamar((sb) => sb.rpc('excluir_regra_assunto', { p_id: id }));
}

/** + NOVO AGENTE (D25): o endereço sai do nome. */
export async function criarAgente(dados: { nome: string; setorId: string | null; tipos: TipoAgente[]; descricao: string }): Promise<{ ok: true; slug: string } | { ok: false; erro: string }> {
  const v = DadosAgente.pick({ nome: true, setorId: true, tipos: true, descricao: true }).required().safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0]?.message ?? 'Dados do agente inválidos.' };
  let slug = '';
  const r = await chamar(async (sb) => {
    const resposta = await sb.rpc('criar_agente', { p_dados: {
      slug: slugDoNome(v.data.nome), nome: v.data.nome, setor_id: v.data.setorId, tipos: v.data.tipos, descricao: v.data.descricao,
    } });
    slug = typeof resposta.data === 'string' ? resposta.data : '';
    return resposta;
  });
  return r.ok ? { ok: true, slug } : r;
}

/** Busca para "+ ADICIONAR CONTATO" do Teste: nome ou telefone, só contatos ativos, até 10. */
export async function buscarContatosParaTeste(q: string): Promise<ContatoTeste[]> {
  const termo = q.trim().slice(0, 60);
  if (termo.length < 2) return [];
  try {
    await obterUsuario();
    const sb = await supabaseServidor();
    const digitos = termo.replace(/\D/g, '');
    const consulta = sb.from('contatos').select('id, nome, telefone').eq('ativo', true).order('nome').limit(10);
    const { data } = await (digitos.length >= 4 ? consulta.like('telefone', `%${digitos}%`) : consulta.ilike('nome', `%${termo.replace(/[%_]/g, '')}%`));
    return data ?? [];
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}
```

(O teste de `criarAgente` espera `{ ok: true, slug: 'irpf' }` porque o banco falso devolve `'irpf'`: o endereço que vale é o que o banco gravou.)

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/agentes.test.ts src/lib/agentes-acoes.test.ts && pnpm --filter @escritorio/painel typecheck`
Expected: tudo passa; sem erros de tipo.

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/lib/agentes.ts apps/painel/src/lib/agentes.test.ts apps/painel/src/lib/agentes-acoes.ts apps/painel/src/lib/agentes-acoes.test.ts
git commit -m "$(cat <<'EOF'
feat(painel): leituras dos agentes (com a volta sem a migração), quem vê e quem treina, e as ações do dono

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Painel. Subida de skill (pasta, `.zip`, `.md`) e ações de skill

**Files:**
- Modify: `apps/painel/package.json` (dependência `fflate`)
- Create: `apps/painel/src/lib/pacote-skill.ts`, `apps/painel/src/lib/pacote-skill.test.ts`
- Create: `apps/painel/src/lib/skills-acoes.ts`, `apps/painel/src/lib/skills-acoes.test.ts`

**Interfaces:**
- Consumes: Task 5 (`montarPacoteSkill`, `TIPOS_SKILL`, `ArquivoSkill`), Task 10 (`souDono`, `lerVersoesSkill`, `ResultadoAcao`, `VersaoSkill`), Task 3 (`subir_skill`, `alternar_skill`, `restaurar_versao_skill`, `arquivar_skill`, `criar_simulacao_skill`); `enfileirarSimulacao` (`lib/fila`); `RespostaTeste` e `ERRO_BANCO_PENDENTE`/`MENSAGEM_*` de `treinar-agente/simulacao.ts`.
- Produces:
  - `arquivosDoFormulario(form: FormData): Promise<{ ok: true; arquivos: ArquivoSkill[] } | { ok: false; erro: string }>` — campo `arquivos` (vários; o nome do arquivo é o caminho relativo, a tela manda `webkitRelativePath`);
  - `subirSkill(slug, formData) → ResultadoSubida` (`{ ok: true; skillId; versao; nova; titulo } | { ok: false; erro } | { ok: false; precisaTipo: true; nome; titulo }`); `alternarSkill(skillId, ativo)`, `restaurarVersaoSkill(versaoId)`, `arquivarSkill(skillId)` → `ResultadoAcao`; `versoesDaSkill(skillId) → VersaoSkill[]`.

- [ ] **Passo 1: a dependência**

Run: `pnpm --filter @escritorio/painel add fflate@^0.8.2`
Expected: `fflate` em `dependencies` de `apps/painel/package.json` e o `pnpm-lock.yaml` atualizado.

- [ ] **Passo 2: testes que falham**

`apps/painel/src/lib/pacote-skill.test.ts`:

```ts
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { arquivosDoFormulario } = await import('./pacote-skill');

const SKILL = '---\nname: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento\n---\n# Tabela CFOP\nTexto.';
const form = (...arquivos: File[]) => { const f = new FormData(); for (const a of arquivos) f.append('arquivos', a, a.name); return f; };

describe('arquivos da subida (D7, D8)', () => {
  it('pasta: o caminho relativo vem no nome do arquivo', async () => {
    const r = await arquivosDoFormulario(form(new File([SKILL], 'tabela-cfop/SKILL.md'), new File(['5102;Venda'], 'tabela-cfop/cfop.csv')));
    expect(r).toEqual({ ok: true, arquivos: [{ caminho: 'tabela-cfop/SKILL.md', conteudo: SKILL }, { caminho: 'tabela-cfop/cfop.csv', conteudo: '5102;Venda' }] });
  });
  it('.zip: abre por dentro, sem as pastas', async () => {
    const zip = zipSync({ 'tabela-cfop/': new Uint8Array(), 'tabela-cfop/SKILL.md': strToU8(SKILL), 'tabela-cfop/refs/cfop.csv': strToU8('a;b') });
    const r = await arquivosDoFormulario(form(new File([zip], 'tabela-cfop.zip')));
    expect(r).toEqual({ ok: true, arquivos: [{ caminho: 'tabela-cfop/SKILL.md', conteudo: SKILL }, { caminho: 'tabela-cfop/refs/cfop.csv', conteudo: 'a;b' }] });
  });
  it('PDF e outros formatos seguem sem conteúdo (o core recusa com a frase certa); .md fora do UTF-8 é recusado aqui', async () => {
    const r = await arquivosDoFormulario(form(new File([SKILL], 'SKILL.md'), new File(['%PDF'], 'guia.pdf')));
    expect(r).toEqual({ ok: true, arquivos: [{ caminho: 'SKILL.md', conteudo: SKILL }, { caminho: 'guia.pdf', conteudo: '' }] });
    expect(await arquivosDoFormulario(form(new File([new Uint8Array([0xff, 0xfe, 0x00])], 'SKILL.md'))))
      .toEqual({ ok: false, erro: 'O arquivo "SKILL.md" não é texto em UTF-8.' });
  });
  it('nada escolhido', async () => {
    expect(await arquivosDoFormulario(new FormData())).toEqual({ ok: false, erro: 'Escolha uma pasta, um .zip ou um .md.' });
  });
});
```

`apps/painel/src/lib/skills-acoes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  dono: true, erroRpc: null as { code: string; message: string } | null, chamadas: [] as [string, unknown][], revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/fila', () => ({ enfileirarSimulacao: async () => {} }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: unknown) => {
      falso.chamadas.push([nome, args]);
      if (nome === 'eh_dono') return { data: falso.dono, error: null };
      return { data: { skill_id: 's1', versao: 1, nova: true }, error: falso.erroRpc };
    },
  }),
}));
const { subirSkill } = await import('./skills-acoes');

const md = (cab: string) => new File([`---\n${cab}\n---\n# Tabela CFOP\nTexto.`], 'SKILL.md');
const form = (arquivo: File, tipo = '') => { const f = new FormData(); f.append('arquivos', arquivo, arquivo.name); f.append('tipo', tipo); return f; };

beforeEach(() => { Object.assign(falso, { dono: true, erroRpc: null, chamadas: [], revalidados: [] }); });

describe('subirSkill', () => {
  it('monta o pacote e grava; volta o título para o aviso', async () => {
    expect(await subirSkill('atendimento', form(md('name: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento'))))
      .toEqual({ ok: true, skillId: 's1', versao: 1, nova: true, titulo: 'Tabela CFOP' });
    expect(falso.chamadas[1]).toEqual(['subir_skill', { p_slug: 'atendimento', p_pacote: expect.objectContaining({ nome: 'tabela-cfop', tipo: 'conhecimento' }) }]);
    expect(falso.revalidados).toContain('/agentes');
  });
  it('sem tipo no cabeçalho nem na tela: pergunta, sem gravar', async () => {
    expect(await subirSkill('atendimento', form(md('name: tabela-cfop\ndescription: CFOPs.'))))
      .toEqual({ ok: false, precisaTipo: true, nome: 'tabela-cfop', titulo: 'Tabela CFOP' });
    expect(falso.chamadas.map((c) => c[0])).toEqual(['eh_dono']);
  });
  it('quem não é dono não sobe', async () => {
    falso.dono = false;
    expect(await subirSkill('atendimento', form(md('name: a\ndescription: b\ntipo: limites')))).toEqual({ ok: false, erro: 'Só o dono sobe skills.' });
  });
  it('recusa do banco vira a frase', async () => {
    falso.erroRpc = { code: 'P0001', message: 'Jeito de atuar e Limites ligados passam de 10.000 caracteres (ficariam 10039): desligue ou encurte uma skill.' };
    expect(await subirSkill('atendimento', form(md('name: a\ndescription: b\ntipo: limites')))).toEqual({ ok: false,
      erro: 'Jeito de atuar e Limites ligados passam de 10.000 caracteres (ficariam 10039): desligue ou encurte uma skill.' });
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/pacote-skill.test.ts src/lib/skills-acoes.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Passo 4: implementar**

`apps/painel/src/lib/pacote-skill.ts`:

```ts
import 'server-only';
import { unzipSync } from 'fflate';
import type { ArquivoSkill } from '@escritorio/core';

const LIMITE_ENVIO = 10 * 1024 * 1024;
const LIMITE_ZIP_ABERTO = 3 * 1024 * 1024;
const MAX_ENTRADAS_ZIP = 60;
const TEXTO = /\.(md|txt|csv)$/i;

export type ArquivosLidos = { ok: true; arquivos: ArquivoSkill[] } | { ok: false; erro: string };
const erro = (e: string) => ({ ok: false as const, erro: e });

/** Texto em UTF-8 ou null. Só .md/.txt/.csv são lidos; os outros seguem vazios e o core recusa pela extensão (D7). */
function lerTexto(caminho: string, bytes: Uint8Array): string | null {
  if (!TEXTO.test(caminho)) return '';
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Arquivos do formulário de subida (D8): vários (pasta, com o caminho no nome), um .zip ou um .md. */
export async function arquivosDoFormulario(form: FormData): Promise<ArquivosLidos> {
  const escolhidos = form.getAll('arquivos').filter((f): f is File => f instanceof File && f.size > 0);
  if (!escolhidos.length) return erro('Escolha uma pasta, um .zip ou um .md.');
  if (escolhidos.reduce((s, f) => s + f.size, 0) > LIMITE_ENVIO) return erro('Os arquivos passam de 10 MB.');
  const brutos: { caminho: string; bytes: Uint8Array }[] = [];
  if (escolhidos.length === 1 && /\.zip$/i.test(escolhidos[0]!.name)) {
    let entradas = 0;
    let aberto = 0;
    // Trava contra .zip que "explode" ao abrir: conta e soma antes de descompactar cada arquivo.
    const conteudo = unzipSync(new Uint8Array(await escolhidos[0]!.arrayBuffer()), {
      filter: (f) => {
        if (f.name.endsWith('/')) return false;
        entradas += 1;
        aberto += f.originalSize;
        return entradas <= MAX_ENTRADAS_ZIP && aberto <= LIMITE_ZIP_ABERTO;
      },
    });
    if (entradas > MAX_ENTRADAS_ZIP) return erro('O .zip tem arquivos demais (até 60).');
    if (aberto > LIMITE_ZIP_ABERTO) return erro('O .zip aberto passa de 3 MB.');
    for (const [caminho, bytes] of Object.entries(conteudo)) brutos.push({ caminho, bytes });
  } else {
    for (const f of escolhidos) brutos.push({ caminho: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
  }
  const arquivos: ArquivoSkill[] = [];
  for (const b of brutos) {
    const conteudo = lerTexto(b.caminho, b.bytes);
    if (conteudo === null) return erro(`O arquivo "${b.caminho.split('/').at(-1)}" não é texto em UTF-8.`);
    arquivos.push({ caminho: b.caminho, conteudo });
  }
  return { ok: true, arquivos };
}
```

`apps/painel/src/lib/skills-acoes.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { montarPacoteSkill, TIPOS_SKILL, type TipoSkill } from '@escritorio/core';
import type { Json } from '@escritorio/db';
import { lerVersoesSkill, souDono, type VersaoSkill } from '@/lib/agentes';
import type { ResultadoAcao } from '@/lib/agentes-acoes';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { arquivosDoFormulario } from '@/lib/pacote-skill';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export type ResultadoSubida =
  | { ok: true; skillId: string; versao: number; nova: boolean; titulo: string }
  | { ok: false; erro: string }
  | { ok: false; precisaTipo: true; nome: string; titulo: string };

const FALHA = 'Não foi possível salvar a skill agora. Tente de novo.';
const Uuid = z.string().uuid();
const doBanco = (error: { code?: string; message: string }) => {
  if (error.code !== 'P0001') console.error('[skills] falha', error);
  return { ok: false as const, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
};

/** SUBIR SKILL (spec 7E.3): pasta, .zip ou .md; o tipo do cabeçalho vence o escolhido na tela; sem nenhum, pergunta (D8). */
export async function subirSkill(slug: string, formData: FormData): Promise<ResultadoSubida> {
  try {
    await obterUsuario();
    const sb = await supabaseServidor();
    if (!(await souDono(sb))) return { ok: false, erro: 'Só o dono sobe skills.' };
    const lidos = await arquivosDoFormulario(formData);
    if (!lidos.ok) return lidos;
    const tipoTela = String(formData.get('tipo') ?? '');
    const tipo = (TIPOS_SKILL as readonly string[]).includes(tipoTela) ? (tipoTela as TipoSkill) : null;
    const r = montarPacoteSkill(lidos.arquivos, tipo);
    if (!r.ok) return r;
    const { data, error } = await sb.rpc('subir_skill', { p_slug: slug, p_pacote: r.pacote as unknown as Json });
    if (error) return doBanco(error);
    revalidatePath('/agentes', 'layout');
    const d = data as { skill_id: string; versao: number; nova: boolean };
    return { ok: true, skillId: d.skill_id, versao: d.versao, nova: d.nova, titulo: r.pacote.titulo };
  } catch (e) {
    unstable_rethrow(e);
    console.error('[skills] falha ao subir', e);
    return { ok: false, erro: FALHA };
  }
}

async function chamar(rodar: (sb: Awaited<ReturnType<typeof supabaseServidor>>) => PromiseLike<{ error: { code?: string; message: string } | null }>): Promise<ResultadoAcao> {
  try {
    await obterUsuario();
    const { error } = await rodar(await supabaseServidor());
    if (error) return doBanco(error);
    revalidatePath('/agentes', 'layout');
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);
    console.error('[skills] falha', e);
    return { ok: false, erro: FALHA };
  }
}

export async function alternarSkill(skillId: string, ativo: boolean): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(skillId).success) return { ok: false, erro: 'Skill não encontrada.' };
  return chamar((sb) => sb.rpc('alternar_skill', { p_skill: skillId, p_ativo: ativo }));
}
export async function restaurarVersaoSkill(versaoId: string): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(versaoId).success) return { ok: false, erro: 'Versão não encontrada.' };
  return chamar((sb) => sb.rpc('restaurar_versao_skill', { p_versao: versaoId }));
}
export async function arquivarSkill(skillId: string): Promise<ResultadoAcao> {
  if (!Uuid.safeParse(skillId).success) return { ok: false, erro: 'Skill não encontrada.' };
  return chamar((sb) => sb.rpc('arquivar_skill', { p_skill: skillId }));
}

/** Versões para o painel de versões (D9): carregadas quando a pessoa abre. */
export async function versoesDaSkill(skillId: string): Promise<VersaoSkill[]> {
  if (!Uuid.safeParse(skillId).success) return [];
  try {
    await obterUsuario();
    return await lerVersoesSkill(await supabaseServidor(), skillId);
  } catch (e) {
    unstable_rethrow(e);
    return [];
  }
}
```

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/pacote-skill.test.ts src/lib/skills-acoes.test.ts && pnpm --filter @escritorio/painel typecheck`
Expected: `8 passed`; sem erros.

- [ ] **Passo 6: commit**

```bash
git add apps/painel/package.json pnpm-lock.yaml apps/painel/src/lib/pacote-skill.ts apps/painel/src/lib/pacote-skill.test.ts apps/painel/src/lib/skills-acoes.ts apps/painel/src/lib/skills-acoes.test.ts
git commit -m "$(cat <<'EOF'
feat(painel): subida de skill por pasta, .zip ou .md (tipo do cabeçalho ou da tela, PDF recusado) e ações de skill do dono

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Painel. Menu, rotas, redirecionamento e a tela do Treinar o agente como aba Orientações

**Files:**
- Modify: `apps/painel/src/lib/menu.ts`, `apps/painel/src/lib/menu.test.ts` (só as linhas 15, 30 e 35 — D19)
- Modify: `apps/painel/src/components/layout/sidebar.tsx`, `trilha.ts`, `menu-tela.ts`
- Create: `apps/painel/src/components/layout/menu-tela-agentes.test.ts`
- Create: `apps/painel/src/app/(painel)/treinar-agente/tela-orientacoes.tsx` (o corpo da `page.tsx` de hoje)
- Modify: `apps/painel/src/app/(painel)/treinar-agente/page.tsx` (redireciona), `lista-orientacoes.tsx`, `acoes.ts`, `esquemas.ts`
- Create: `apps/painel/src/app/(painel)/treinar-agente/esquemas-agente.test.ts`
- Create: `apps/painel/src/app/(painel)/agentes/[slug]/orientacoes/page.tsx`
- Modify: `apps/painel/src/app/(painel)/atendimento/[id]/ensinar-agente.tsx`, `apps/painel/src/app/(painel)/configuracoes/acoes.ts` (só a lista de `revalidatePath`)

**Interfaces:**
- Consumes: Task 10 (`lerAgente`, `podeTreinarAgente`); Task 2 (`salvar_orientacao_agente`).
- Produces:
  - menu: item `{ rotulo: 'Agentes', href: '/agentes' }` no lugar de "Treinar o agente";
  - `telaComMenuRecolhido('/agentes/<slug>/orientacoes' | '/agentes/<slug>/testar') === true`; trilha `/agentes` → "Administração › Agentes", `/agentes/<slug>` → "… › Agentes (link) › Agente";
  - `TelaOrientacoes({ params, base, agenteId, comSimulador })` e `SemPermissao({ descricao? })` exportados de `tela-orientacoes.tsx`;
  - `destinoDaTela` aceita `/agentes/<slug>/orientacoes…`; `slugDoDestino(destino): string` (padrão `'atendimento'`);
  - `ListaOrientacoes` com `base` (padrão `/treinar-agente`);
  - ações `salvarOrientacao`/`ensinarAgente`/`alternarOrientacao`/`restaurarVersao` também revalidam `/agentes` (layout); `salvarOrientacao` usa `salvar_orientacao_agente` quando o destino é de outro agente.

- [ ] **Passo 1: testes que falham**

`apps/painel/src/components/layout/menu-tela-agentes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { telaComMenuRecolhido } from './menu-tela';
import { trilhaDaRota } from './trilha';

describe('Agentes no menu e na trilha (spec 7E.1, D20)', () => {
  it('Orientações e Testar abrem com o menu recolhido (três colunas); as outras abas, não', () => {
    expect(telaComMenuRecolhido('/agentes/atendimento/orientacoes')).toBe(true);
    expect(telaComMenuRecolhido('/agentes/fiscal/testar')).toBe(true);
    expect(telaComMenuRecolhido('/agentes/fiscal/skills')).toBe(false);
    expect(telaComMenuRecolhido('/agentes')).toBe(false);
  });
  it('trilha: Administração › Agentes; na ficha, Agentes vira link', () => {
    expect(trilhaDaRota('/agentes')).toEqual([{ rotulo: 'Administração' }, { rotulo: 'Agentes' }]);
    expect(trilhaDaRota('/agentes/fiscal/skills')).toEqual([{ rotulo: 'Administração' }, { rotulo: 'Agentes', href: '/agentes' }, { rotulo: 'Agente' }]);
  });
});
```

`apps/painel/src/app/(painel)/treinar-agente/esquemas-agente.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { destinoDaTela, slugDoDestino } from './esquemas';

describe('orientações por agente (D21)', () => {
  it('a tela de cada agente é destino válido; o resto volta para /treinar-agente', () => {
    expect(destinoDaTela('/agentes/fiscal/orientacoes?orientacao=nova')).toBe('/agentes/fiscal/orientacoes?orientacao=nova');
    expect(destinoDaTela('/agentes/fiscal/skills')).toBe('/treinar-agente');
    expect(destinoDaTela('https://outro.site/agentes/fiscal/orientacoes')).toBe('/treinar-agente');
  });
  it('o agente das orientações sai do endereço; /treinar-agente é o Thiago', () => {
    expect(slugDoDestino('/agentes/fiscal/orientacoes?ativo=ligadas')).toBe('fiscal');
    expect(slugDoDestino('/treinar-agente?orientacao=nova')).toBe('atendimento');
  });
});
```

Em `apps/painel/src/lib/menu.test.ts`, **só estas três linhas** (D19): na linha 15, `'Assistente', 'Treinar o agente']` → `'Assistente', 'Agentes']`; nas linhas 30 e 35, `'Contatos', 'Treinar o agente', 'Gastos com IA'` → `'Contatos', 'Agentes', 'Gastos com IA'`.

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/components/layout/menu-tela-agentes.test.ts "src/app/(painel)/treinar-agente/esquemas-agente.test.ts" src/lib/menu.test.ts`
Expected: FAIL (menu ainda com "Treinar o agente"; `slugDoDestino` não existe).

- [ ] **Passo 3: menu, ícone, trilha e menu recolhido**

1. `lib/menu.ts`, troque a linha do Treinar por:

```ts
  // Parte I1 (spec 7E.1, D19): "Treinar o agente" virou as abas Orientações e Testar; Agentes entra no mesmo lugar.
  if (admin || u.niveis.treinar === 'sim') itens.push({ rotulo: 'Agentes', href: '/agentes' });
```

2. `components/layout/sidebar.tsx`: importe `Bot` de `lucide-react` e acrescente `'/agentes': Bot,` em `ICONES` e `'/agentes': 'text-modulo-treinar',` em `COR_MODULO` (as entradas de `/treinar-agente` ficam: a rota ainda existe).

3. `components/layout/trilha.ts`, em `SECOES`: `{ prefixo: '/agentes', trilha: [{ rotulo: 'Administração' }, { rotulo: 'Agentes' }], detalhe: 'Agente' },`.

4. `components/layout/menu-tela.ts`:

```ts
// Telas de três colunas abrem com o menu recolhido (spec 4.3; Assistente, 7C.3; Treinar o agente, 7C.5; abas Orientações e Testar, 7E.1). Abrir o menu ali vale só até sair da tela (P17).
export function telaComMenuRecolhido(caminho: string): boolean {
  return caminho === '/atendimento' || caminho.startsWith('/atendimento/') || caminho === '/assistente' || caminho === '/treinar-agente'
    || /^\/agentes\/[^/]+\/(orientacoes|testar)$/.test(caminho);
}
```

- [ ] **Passo 4: a tela do G5 com endereço-base**

1. Crie `treinar-agente/tela-orientacoes.tsx` **movendo** o conteúdo de `treinar-agente/page.tsx` de hoje, com estas mudanças (e só estas):
   - `SemPermissao` vira `export function SemPermissao({ descricao = 'Quem libera é o administrador: na tela Usuários, ele escolhe "Sim" em "Treinar o agente" no seu cadastro.' }: { descricao?: string })` e usa `descricao` no `EmptyState` (o texto padrão é o de hoje, que o e2e confere);
   - a função `TreinarAgente` vira `export async function TelaOrientacoes({ params, base, agenteId, comSimulador }: { params: ParamsBusca; base: string; agenteId: string | null; comSimulador: boolean })`; saem as linhas `const u = await obterUsuario();`, `if (!temNivel(u, 'treinar', 'sim')) return <SemPermissao />;` e `const params = await searchParams;` (quem chama confere a permissão) e os imports que ficarem sem uso;
   - na leitura das orientações, depois de `.select(...)`, acrescente o filtro do agente quando houver (sem migração, `agenteId` é null e a lista é a de hoje):

```ts
    lerEmPaginas((de, ate) => {
      const q = sb.from('orientacoes_agente')
        .select('id, titulo, texto, tipo, cliente_id, setor_id, ativo, atualizado_em, criado_em, clientes(razao_social, nome_fantasia, ativo), setores(nome, ativo), criador:usuarios!orientacoes_agente_criado_por_fkey(nome)');
      // Parte I1 (D21): cada agente vê só as orientações dele.
      return (agenteId ? q.eq('agente_id', agenteId) : q).order('atualizado_em', { ascending: false }).order('id').range(de, ate);
    }),
```

   - `const href = (mudancas) => \`/treinar-agente${…}\`` vira `` `${base}${hrefComParams(params, { erro: null, ...mudancas })}` ``;
   - `<ListaOrientacoes … />` ganha `base={base}`;
   - a `div` raiz troca `-m-6 flex flex-col lg:altura-trabalho lg:flex-row` por `flex flex-col overflow-hidden rounded-md border border-border lg:altura-trabalho lg:flex-row` (ela passa a ficar dentro da ficha do agente, abaixo do cabeçalho e das abas — Task 14; cada coluna continua rolando por dentro);
   - o `<Simulador … />` só aparece com `comSimulador`; sem ele, no mesmo lugar:

```tsx
      {comSimulador ? (
        <Simulador /* as mesmas props de hoje */ />
      ) : (
        <section aria-label="Teste do agente" className="flex flex-col gap-2 bg-background p-6 lg:w-simulador-treinar lg:shrink-0 lg:border-l lg:border-border">
          <p className="text-sm text-muted">O teste deste agente chega quando ele começar a atender (próxima etapa).</p>
        </section>
      )}
```

   - no comentário do topo da função, troque "Admin ou quem tem Treinar o agente." por "Quem chama confere a permissão (podeTreinarAgente). `base`: /agentes/<slug>/orientacoes; `agenteId` null = banco sem a Parte I (todas, como antes)."

2. `treinar-agente/page.tsx` passa a ser só o redirecionamento:

```tsx
import { redirect } from 'next/navigation';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';

/** "Treinar o agente" virou as abas Orientações e Testar do Thiago (spec 7E.1, D20): o endereço antigo leva para lá, com a mesma consulta. */
export default async function TreinarAgente({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  redirect(`/agentes/atendimento/orientacoes${hrefComParams(await searchParams, {})}`);
}
```

3. `treinar-agente/lista-orientacoes.tsx`: nova prop `base = '/treinar-agente'` (tipo `base?: string`); use-a no `action` do `<form role="search">` e no `href` de "Limpar filtros".

4. `treinar-agente/esquemas.ts`:

```ts
/** Destinos das ações da tela: /treinar-agente (redireciona) ou a aba Orientações de um agente (D21). */
export function destinoDaTela(voltar: unknown): string {
  const v = typeof voltar === 'string' ? voltar : '';
  return /^\/(treinar-agente|agentes\/[a-z][a-z0-9-]{1,39}\/orientacoes)(\?[^\s]*)?$/.test(v) ? v : '/treinar-agente';
}

/** Agente das orientações pelo endereço da tela: /treinar-agente é o Thiago. */
export function slugDoDestino(destino: string): string {
  return /^\/agentes\/([a-z][a-z0-9-]{1,39})\/orientacoes/.exec(destino)?.[1] ?? 'atendimento';
}
```

5. `treinar-agente/acoes.ts`:
   - importe `slugDoDestino` de `./esquemas`;
   - `comOrientacao` mantém o caminho do destino: `return \`${destino.split('?')[0]}${hrefComParams(Object.fromEntries(busca), { ...mudancas, erro: null })}\`;`
   - `gravarOrientacao(sb, id, d, slug = 'atendimento')`: o Thiago continua com a função de hoje; os outros, com a nova (o banco põe o agente e confere o setor):

```ts
async function gravarOrientacao(sb: Awaited<ReturnType<typeof exigirTreinar>>, id: string | null, d: DadosOrientacao, slug = 'atendimento'): Promise<string> {
  if (id !== null && !ehUuid(id)) throw new AvisoTreinar('Orientação não encontrada.');
  const campos = {
    // Para criar, o banco recebe null (o tipo gerado marca p_id como obrigatório por vir antes dos que têm padrão).
    p_id: id as unknown as string,
    p_titulo: d.titulo, p_texto: d.texto, p_tipo: d.tipo,
    p_cliente_id: d.clienteId ?? undefined, p_setor_id: d.setorId ?? undefined, p_ativo: d.ativo,
  };
  const { data, error } = slug === 'atendimento'
    ? await sb.rpc('salvar_orientacao', campos)
    : await sb.rpc('salvar_orientacao_agente', { p_slug: slug, ...campos });
  if (error) throw avisoDoBanco(error, 'falha ao salvar a orientação', FALHA_SALVAR);
  return data;
}
```

   - em `salvarOrientacao`: `const data = await gravarOrientacao(sb, id, OrientacaoForm.parse(formData), slugDoDestino(destino));`
   - depois de **cada** `revalidatePath('/treinar-agente');` acrescente `revalidatePath('/agentes', 'layout');` (três lugares).

6. `app/(painel)/agentes/[slug]/orientacoes/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { lerAgente, podeTreinarAgente } from '@/lib/agentes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { ParamsBusca } from '@/lib/tabela-url';
import { SemPermissao, TelaOrientacoes } from '../../../treinar-agente/tela-orientacoes';

/** Aba Orientações (spec 7E.1, 7C.5, D21): a tela do Treinar o agente, só com as orientações deste agente. */
export default async function OrientacoesDoAgente({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ParamsBusca> }) {
  const [{ slug }, busca, u] = await Promise.all([params, searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const { agente, semMigracao } = await lerAgente(sb, slug);
  if (!agente) notFound();
  if (!podeTreinarAgente(u, agente)) {
    return <SemPermissao descricao={agente.portaDeEntrada ? undefined
      : `Só quem tem "Treinar o agente" e é do setor ${agente.setor ?? 'do agente'} muda estas orientações.`} />;
  }
  return <TelaOrientacoes params={busca} base={`/agentes/${agente.slug}/orientacoes`} agenteId={semMigracao ? null : agente.id} comSimulador={agente.portaDeEntrada} />;
}
```

7. `atendimento/[id]/ensinar-agente.tsx`: o link do fim vira `<Link ref={link} href={\`/agentes/atendimento/orientacoes?orientacao=${id}\`}>Abrir nas orientações do Thiago</Link>`; "Ela aparece em Treinar o agente." → "Ela aparece nas orientações do Thiago (Agentes)."; "…até alguém revisar e ligar em Treinar o agente." → "…até alguém revisar e ligar nas orientações do Thiago.".

8. `configuracoes/acoes.ts:36`: acrescente `'/agentes'` à lista de caminhos revalidados.

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo passa — inclusive `menu.test.ts` (as 3 linhas), `menu-tela-treinar.test.ts`, `trilha.test.ts`, `treinar-agente/*.test.ts` (`acoes.test.ts` confere `revalidatePath('/treinar-agente')`, que continua), `escala.test.ts` e `tokens.test.ts`.

Run: `git diff BASE -- apps/painel/src/lib/menu.test.ts | grep '^[-+]' | grep -v '^[-+][-+]' | wc -l`
Expected: `6` (3 linhas trocadas).

- [ ] **Passo 6: conferir à mão** (banco local, `next dev -p 3107` com o `.env` local): `/treinar-agente?orientacao=nova` abre `/agentes/atendimento/orientacoes?orientacao=nova` com a tela de hoje (lista, editor, simulador); o menu mostra **Agentes** com o robô no lugar do Treinar; salvar uma orientação volta para a aba. Desligue o `next dev`.

- [ ] **Passo 7: commit**

```bash
git add apps/painel/src/lib/menu.ts apps/painel/src/lib/menu.test.ts apps/painel/src/components/layout apps/painel/src/app/\(painel\)/treinar-agente apps/painel/src/app/\(painel\)/agentes/\[slug\]/orientacoes apps/painel/src/app/\(painel\)/atendimento/\[id\]/ensinar-agente.tsx apps/painel/src/app/\(painel\)/configuracoes/acoes.ts
git commit -m "$(cat <<'EOF'
feat(painel): menu Agentes no lugar do Treinar o agente; a tela do Treinar vira a aba Orientações de cada agente (endereço antigo redireciona)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Painel. Tela Agentes (`/agentes`)

**Files:**
- Create: `apps/painel/src/app/(painel)/agentes/page.tsx`, `cartao-agente.tsx`, `filtros-agentes.tsx`, `novo-agente.tsx`, `lista.ts`, `lista.test.ts`

**Interfaces:**
- Consumes: Task 10 (`lerAgentes`, `lerContagens`, `lerNumeros`, `souDono`, `acessoAosAgentes`, `criarAgente`), Task 12 (`SemPermissao`), `lerPeriodo` (`lib/gastos`), `INFO_MODO`, `ROTULO_ESTADO`, `ROTULO_TIPO_AGENTE`, `TEXTO_FALA_THIAGO`.
- Produces: `lista.ts` (puro): `type FiltrosAgentes = { estado: EstadoAgente | null; tipo: TipoAgente | null; q: string }`, `lerFiltrosAgentes(params)`, `filtrarAgentes(agentes, f)`, `contarPorEstado(agentes)`, `falaComOCliente(agente): { modo: string; detalhe: string | null }`, `percentualSozinho(n: NumerosAgente | undefined): number | null`; `CartaoAgente`; `NovoAgente`.

- [ ] **Passo 1: teste que falha**

`apps/painel/src/app/(painel)/agentes/lista.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { THIAGO_SEM_MIGRACAO } = await import('@/lib/agentes');
const { contarPorEstado, falaComOCliente, filtrarAgentes, lerFiltrosAgentes, percentualSozinho } = await import('./lista');

const fiscal = { ...THIAGO_SEM_MIGRACAO, id: 'f', slug: 'fiscal', nome: 'Agente Fiscal', portaDeEntrada: false, estado: 'teste' as const,
  tipos: ['conversa', 'trabalho'] as ('conversa' | 'trabalho')[], modoContato: 'mesma_voz' as const, setor: 'Fiscal', descricao: 'notas e guias' };
const radar = { ...fiscal, id: 'r', slug: 'radar', nome: 'Radar de legislação', estado: 'desligado' as const, tipos: ['trabalho'] as 'trabalho'[], modoContato: null, setor: null };

describe('tela Agentes (spec 7E.2)', () => {
  it('filtros pela URL; lixo é ignorado', () => {
    expect(lerFiltrosAgentes({ estado: 'teste', tipo: 'trabalho', q: ' fis ' })).toEqual({ estado: 'teste', tipo: 'trabalho', q: 'fis' });
    expect(lerFiltrosAgentes({ estado: 'xyz', tipo: ['conversa'] })).toEqual({ estado: null, tipo: 'conversa', q: '' });
  });
  it('filtra por estado, tipo e busca (nome, setor, descrição, sem acento)', () => {
    const todos = [THIAGO_SEM_MIGRACAO, fiscal, radar];
    expect(filtrarAgentes(todos, { estado: 'teste', tipo: null, q: '' }).map((a) => a.slug)).toEqual(['fiscal']);
    expect(filtrarAgentes(todos, { estado: null, tipo: 'trabalho', q: '' }).map((a) => a.slug)).toEqual(['fiscal', 'radar']);
    expect(filtrarAgentes(todos, { estado: null, tipo: null, q: 'legislacao' }).map((a) => a.slug)).toEqual(['radar']);
    expect(contarPorEstado(todos)).toEqual({ todos: 3, ligado: 1, teste: 1, desligado: 1 });
  });
  it('"Fala com o cliente": o Thiago é direto; sem modo, a definir', () => {
    expect(falaComOCliente(THIAGO_SEM_MIGRACAO)).toEqual({ modo: 'Direto, é a voz do escritório', detalhe: null });
    expect(falaComOCliente(fiscal)).toEqual({ modo: 'Mesma voz', detalhe: 'responde como Thiago' });
    expect(falaComOCliente(radar)).toEqual({ modo: 'a definir', detalhe: null });
  });
  it('% resolvido sozinho', () => {
    expect(percentualSozinho({ atendimentos: 438, resolvidos: 324, custoUsd: 0, custoTestesUsd: 0, ultimaEm: null, ultimaEmpresa: null })).toBe(74);
    expect(percentualSozinho({ atendimentos: 0, resolvidos: 0, custoUsd: 0, custoTestesUsd: 0, ultimaEm: null, ultimaEmpresa: null })).toBeNull();
    expect(percentualSozinho(undefined)).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/lista.test.ts"`
Expected: FAIL (módulo não existe).

- [ ] **Passo 3: regras puras**

`agentes/lista.ts`:

```ts
import { ESTADOS_AGENTE, INFO_MODO, TEXTO_FALA_THIAGO, TIPOS_AGENTE, type EstadoAgente, type TipoAgente } from '@escritorio/core';
import type { Agente, NumerosAgente } from '@/lib/agentes';
import { valorParam, type ParamsBusca } from '@/lib/tabela-url';

export type FiltrosAgentes = { estado: EstadoAgente | null; tipo: TipoAgente | null; q: string };
const semAcento = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function lerFiltrosAgentes(params: ParamsBusca): FiltrosAgentes {
  const estado = valorParam(params, 'estado');
  const tipo = valorParam(params, 'tipo');
  return {
    estado: (ESTADOS_AGENTE as readonly string[]).includes(estado ?? '') ? (estado as EstadoAgente) : null,
    tipo: (TIPOS_AGENTE as readonly string[]).includes(tipo ?? '') ? (tipo as TipoAgente) : null,
    q: (valorParam(params, 'q') ?? '').trim().slice(0, 60),
  };
}

export function filtrarAgentes(agentes: Agente[], f: FiltrosAgentes): Agente[] {
  const q = semAcento(f.q);
  return agentes.filter((a) => (!f.estado || a.estado === f.estado) && (!f.tipo || a.tipos.includes(f.tipo))
    && (!q || semAcento(`${a.nome} ${a.setor ?? ''} ${a.descricao}`).includes(q)));
}

export function contarPorEstado(agentes: Agente[]): Record<'todos' | EstadoAgente, number> {
  return { todos: agentes.length, ...Object.fromEntries(ESTADOS_AGENTE.map((e) => [e, agentes.filter((a) => a.estado === e).length])) } as Record<'todos' | EstadoAgente, number>;
}

/** "Fala com o cliente" do cartão (D13): o Thiago é a voz; o resto, o modo escolhido ou "a definir". */
export function falaComOCliente(a: Pick<Agente, 'portaDeEntrada' | 'modoContato'>): { modo: string; detalhe: string | null } {
  if (a.portaDeEntrada) return { modo: TEXTO_FALA_THIAGO, detalhe: null };
  if (!a.modoContato) return { modo: 'a definir', detalhe: null };
  const detalhe = { por_tras: 'Thiago repassa', mesma_voz: 'responde como Thiago', passa_conversa: 'Thiago passa a conversa' }[a.modoContato];
  return { modo: INFO_MODO[a.modoContato].rotulo, detalhe };
}

export function percentualSozinho(n: NumerosAgente | undefined): number | null {
  if (!n || n.atendimentos === 0) return null;
  return Math.round((n.resolvidos / n.atendimentos) * 100);
}
```

- [ ] **Passo 4: o cartão, os filtros, o novo agente e a página**

`agentes/cartao-agente.tsx` (servidor):

```tsx
import Link from 'next/link';
import {
  Bot, BookOpen, Briefcase, Calculator, ChevronRight, CircleUserRound, Clock, FileCheck, ListChecks, MessageCircle, Radar, Receipt, Settings, Users, Wrench,
} from 'lucide-react';
import { ROTULO_ESTADO, ROTULO_TIPO_AGENTE } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Agente, Contagens, NumerosAgente } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarUSD } from '@/lib/formatos';
import { falaComOCliente, percentualSozinho } from './lista';

/** Ícone por agente: os iniciais têm o seu; os criados pela tela, o robô. */
export const ICONE_AGENTE: Record<string, typeof Bot> = {
  atendimento: MessageCircle, radar: Radar, fiscal: Receipt, contabil: Calculator, pessoal: Users, legalizacao: FileCheck, comercial: Briefcase,
};
const COR_ESTADO = { ligado: 'success', teste: 'warning', desligado: 'neutral' } as const;
const FAIXA_ESTADO = { ligado: 'border-t-success', teste: 'border-t-warning', desligado: 'border-t-border' } as const;

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{rotulo}</span>
      <span className="tabular text-2xl font-extrabold text-foreground">{valor}</span>
    </div>
  );
}

/** Cartão da tela Agentes (spec 7E.2, imagem 00-agentes-lista): estado em destaque, contagens, números do mês e o modo de falar. */
export function CartaoAgente({ agente: a, contagens: c, numeros: n, mostrarNumeros, contatosTeste }: {
  agente: Agente; contagens: Contagens; numeros: NumerosAgente | undefined; mostrarNumeros: boolean; contatosTeste: number;
}) {
  const Icone = ICONE_AGENTE[a.slug] ?? Bot;
  const fala = falaComOCliente(a);
  const configurado = a.portaDeEntrada || c.skills + c.ferramentas + c.orientacoes > 0 || a.modoContato !== null;
  const usado = !!n && (n.atendimentos > 0 || n.custoUsd > 0);
  const pct = percentualSozinho(n);
  return (
    <Card className={cn('flex flex-col gap-3 border-t-4 p-4', FAIXA_ESTADO[a.estado])} data-testid={`agente-${a.slug}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-brand"><Icone aria-hidden size={20} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-extrabold text-foreground">
            {a.nome}{a.portaDeEntrada && <span className="font-normal text-muted"> · Atendimento</span>}
          </h2>
          <div className="flex flex-wrap gap-1">
            {a.tipos.map((t) => <Badge key={t} variant="outline">{ROTULO_TIPO_AGENTE[t]}</Badge>)}
          </div>
          <p className="text-sm text-muted">{a.descricao}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={COR_ESTADO[a.estado]} className="uppercase">● {ROTULO_ESTADO[a.estado]}</Badge>
          {a.estado === 'teste' && <span className="text-xs text-muted">{contatosTeste === 1 ? '1 contato' : `${contatosTeste} contatos`}</span>}
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1"><BookOpen aria-hidden size={14} /><b className="text-foreground">{c.skills}</b> skills</span>
        <span className="inline-flex items-center gap-1"><Wrench aria-hidden size={14} /><b className="text-foreground">{c.ferramentas}</b> ferramentas</span>
        <span className="inline-flex items-center gap-1"><ListChecks aria-hidden size={14} /><b className="text-foreground">{c.orientacoes}</b> orientações</span>
      </p>
      {mostrarNumeros && usado && (
        <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border">
          <Numero rotulo="Conversas" valor={String(n!.atendimentos)} />
          <Numero rotulo="Sozinho" valor={pct === null ? '—' : `${pct}%`} />
          <Numero rotulo="Custo" valor={formatarUSD(n!.custoUsd + n!.custoTestesUsd)} />
        </div>
      )}
      {!configurado && (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">
          <Settings aria-hidden size={14} />Ainda não configurado
        </p>
      )}
      {/* Marcadores rotulados do que vem depois (D26): nada clicável. */}
      {a.tipos.includes('trabalho') && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">Tarefas de trabalho: chegam numa próxima etapa.</p>
      )}
      {a.slug === 'radar' && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">Novidades da legislação: chegam na etapa do Radar.</p>
      )}
      <p className="inline-flex items-center gap-1.5 text-sm text-muted">
        <CircleUserRound aria-hidden size={14} />Fala com o cliente: <b className="text-foreground">{fala.modo}</b>{fala.detalhe && <span>({fala.detalhe})</span>}
      </p>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="inline-flex items-center gap-1 text-muted">
          <Clock aria-hidden size={14} />
          {mostrarNumeros && n?.ultimaEm ? `${formatarDataHora(n.ultimaEm)}${n.ultimaEmpresa ? ` · ${n.ultimaEmpresa}` : ''}` : usado || a.portaDeEntrada ? '—' : 'nunca usado'}
        </span>
        <Link href={`/agentes/${a.slug}`} aria-label={`Abrir ${a.nome}`} className="inline-flex items-center gap-1 font-bold uppercase text-brand">
          {configurado ? 'Abrir' : 'Configurar'}<ChevronRight aria-hidden size={14} />
        </Link>
      </div>
    </Card>
  );
}
```

`agentes/filtros-agentes.tsx` (servidor):

```tsx
import Link from 'next/link';
import { Search } from 'lucide-react';
import { ROTULO_TIPO_AGENTE, TIPOS_AGENTE, type EstadoAgente } from '@escritorio/core';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';
import type { FiltrosAgentes } from './lista';

const chip = (ativo: boolean) => cn('inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-bold',
  ativo ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-muted');

/** Filtros por estado (com contagem) e tipo, e a busca (spec 7E.2). Links simples: a tela recarrega no servidor. */
export function FiltrosAgentes({ params, f, contagem }: { params: ParamsBusca; f: FiltrosAgentes; contagem: Record<'todos' | EstadoAgente, number> }) {
  const estados: { valor: EstadoAgente | null; rotulo: string; n: number }[] = [
    { valor: null, rotulo: 'Todos', n: contagem.todos }, { valor: 'ligado', rotulo: 'Ligados', n: contagem.ligado },
    { valor: 'teste', rotulo: 'Em teste', n: contagem.teste }, { valor: 'desligado', rotulo: 'Desligados', n: contagem.desligado },
  ];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        {estados.map((e) => (
          <Link key={e.rotulo} href={`/agentes${hrefComParams(params, { estado: e.valor })}`} aria-current={f.estado === e.valor ? 'page' : undefined} className={chip(f.estado === e.valor)}>
            {e.valor && <span aria-hidden>●</span>}{e.rotulo} <span className="tabular">{e.n}</span>
          </Link>
        ))}
      </nav>
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Tipo" className="flex gap-1">
          {[null, ...TIPOS_AGENTE].map((t) => (
            <Link key={t ?? 'todos'} href={`/agentes${hrefComParams(params, { tipo: t })}`} aria-current={f.tipo === t ? 'page' : undefined} className={chip(f.tipo === t)}>
              {t ? ROTULO_TIPO_AGENTE[t] : 'Tipo: todos'}
            </Link>
          ))}
        </nav>
        <form role="search" action="/agentes" className="relative">
          {f.estado && <input type="hidden" name="estado" value={f.estado} />}
          {f.tipo && <input type="hidden" name="tipo" value={f.tipo} />}
          <Search aria-hidden size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input name="q" defaultValue={f.q} aria-label="Buscar agente" placeholder="Buscar agente" className="h-9 w-56 pl-8" />
        </form>
      </div>
    </div>
  );
}

```

`agentes/novo-agente.tsx` (cliente):

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ROTULO_TIPO_AGENTE, TIPOS_AGENTE, type TipoAgente } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { criarAgente } from '@/lib/agentes-acoes';

/** + NOVO AGENTE (D25), só para o dono: nasce Desligado, sem skills nem ferramentas. */
export function NovoAgente({ setores }: { setores: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [setorId, setSetorId] = useState('');
  const [tipos, setTipos] = useState<TipoAgente[]>(['conversa']);
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const alternar = (t: TipoAgente, sim: boolean) => setTipos((atual) => (sim ? [...new Set([...atual, t])] : atual.filter((x) => x !== t)));
  const salvar = () => iniciar(async () => {
    const r = await criarAgente({ nome, setorId: setorId || null, tipos, descricao });
    if (!r.ok) { setErro(r.erro); return; }
    toast(`Agente ${nome.trim()} criado.`);
    setAberto(false);
    router.push(`/agentes/${r.slug}`);
  });
  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); setErro(null); }}>
      <DialogTrigger asChild><Button><Plus aria-hidden size={16} />Novo agente</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo agente</DialogTitle>
          <DialogDescription>Nasce desligado. Depois você sobe as skills e escolhe as ferramentas.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Label className="flex flex-col gap-1">Nome<Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} /></Label>
          <Label className="flex flex-col gap-1">Setor
            <select value={setorId} onChange={(e) => setSetorId(e.target.value)} className="h-9 rounded-md border border-input bg-surface px-2 text-sm">
              <option value="">Sem setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </Label>
          <fieldset className="flex gap-4"><legend className="mb-1 text-sm font-medium">Tipo</legend>
            {TIPOS_AGENTE.map((t) => (
              <Label key={t} className="flex items-center gap-2 font-normal">
                <Checkbox checked={tipos.includes(t)} onCheckedChange={(v) => alternar(t, v === true)} />{ROTULO_TIPO_AGENTE[t]}
              </Label>
            ))}
          </fieldset>
          <Label className="flex flex-col gap-1">Descrição curta<Input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} /></Label>
          {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={enviando}>Criar agente</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

`agentes/page.tsx`:

```tsx
import Link from 'next/link';
import { Bot, CircleDollarSign, LockKeyhole } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/patterns/empty-state';
import { variantesBotao } from '@/components/ui/button';
import { acessoAosAgentes, lerAgentes, lerContagens, lerNumeros, souDono } from '@/lib/agentes';
import { lerPeriodo } from '@/lib/gastos';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { ParamsBusca } from '@/lib/tabela-url';
import { SemPermissao } from '../treinar-agente/tela-orientacoes';
import { CartaoAgente } from './cartao-agente';
import { FiltrosAgentes } from './filtros-agentes';
import { contarPorEstado, filtrarAgentes, lerFiltrosAgentes } from './lista';
import { NovoAgente } from './novo-agente';

/** Tela Agentes (spec 7E.2, imagem 00-agentes-lista): um cartão por agente, filtros, busca e + NOVO AGENTE (só o dono). */
export default async function Agentes({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const [params, u] = await Promise.all([searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const acesso = acessoAosAgentes(u, await souDono(sb));
  if (!acesso.ver) return <SemPermissao />;
  const mes = lerPeriodo({}, new Date());
  const [{ agentes, semMigracao, erro }, { data: setores }, { data: emTeste }] = await Promise.all([
    lerAgentes(sb), sb.from('setores').select('id, nome').eq('ativo', true).order('nome'), sb.from('agente_contatos_teste').select('agente_id'),
  ]);
  const [contagens, numeros] = await Promise.all([
    semMigracao ? Promise.resolve(new Map()) : lerContagens(sb, agentes),
    acesso.numeros && !semMigracao ? lerNumeros(sb, mes.de, mes.ate) : Promise.resolve(null),
  ]);
  const f = lerFiltrosAgentes(params);
  const visiveis = filtrarAgentes(agentes, f);
  return (
    <section className="flex flex-col gap-4">
      <PageHeader
        titulo={<>Agentes <span className="tabular font-extrabold text-brand">{agentes.length}</span></>}
        descricao="Um agente por departamento, mais o Radar de legislação. O Thiago atende no WhatsApp e chama os outros quando precisa."
        acoes={<div className="flex gap-2">
          {u.papel === 'admin' && <Link href="/gastos-ia" className={variantesBotao({ variant: 'outline' })}><CircleDollarSign aria-hidden size={16} />Gastos com IA</Link>}
          {acesso.dono && !semMigracao && <NovoAgente setores={setores ?? []} />}
        </div>}
      />
      <p className="flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-3 text-sm">
        <LockKeyhole aria-hidden size={16} className="text-brand" />
        <span><b>{acesso.dono ? 'Só você altera' : 'Só o dono altera'} skills, ferramentas e modo de contato.</b> Orientações: quem tem permissão.</span>
      </p>
      {semMigracao && <p className="rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">Os agentes aparecem quando a atualização do banco da Parte I for aplicada.</p>}
      {erro && <p role="alert" className="text-sm text-danger">Não consegui carregar os agentes agora.</p>}
      <FiltrosAgentes params={params} f={f} contagem={contarPorEstado(agentes)} />
      {visiveis.length === 0 ? (
        <EmptyState icone={Bot} titulo="Nenhum agente com esses filtros." />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visiveis.map((a) => (
            <li key={a.id} className="flex">
              <CartaoAgente agente={a} contagens={contagens.get(a.id) ?? { skills: 0, ferramentas: a.ferramentas.length, orientacoes: 0 }}
                numeros={numeros?.get(a.id)} mostrarNumeros={acesso.numeros} contatosTeste={(emTeste ?? []).filter((t) => t.agente_id === a.id).length} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-muted">
        <b className="text-foreground">Conversa</b>: fala no WhatsApp ou no painel. <b className="text-foreground">Trabalho</b>: tarefas longas em segundo plano (fechamento, conferências, relatórios).{' '}
        <b className="text-foreground">Teste</b>: só atende os contatos escolhidos. <b className="text-foreground">Sozinho</b>: resolvido sem passar para uma pessoa.
      </p>
    </section>
  );
}
```

(O `select` de `agente_contatos_teste` num banco sem a migração devolve erro e `data` nulo: o `?? []` cobre — D23.)

- [ ] **Passo 5: typecheck, testes e as regras de estilo**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/lista.test.ts" && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo passa (inclusive `escala.test.ts`: nada de cor ou tamanho solto).

- [ ] **Passo 6: conferir à mão** (banco local, `next dev -p 3107`): com um administrador marcado dono (`marcarDonoTeste` num script temporário na pasta de rascunho ou `update public.usuarios set dono = true where email = '…'` no `psql` local), `/agentes` mostra os 7 cartões, o Thiago "● LIGADO", os outros "● DESLIGADO" com "Ainda não configurado", os filtros contam 7/1/0/6, "+ NOVO AGENTE" cria e abre a ficha. Desligue o `next dev`.

- [ ] **Passo 7: commit**

```bash
git add apps/painel/src/app/\(painel\)/agentes/page.tsx apps/painel/src/app/\(painel\)/agentes/cartao-agente.tsx apps/painel/src/app/\(painel\)/agentes/filtros-agentes.tsx apps/painel/src/app/\(painel\)/agentes/novo-agente.tsx apps/painel/src/app/\(painel\)/agentes/lista.ts apps/painel/src/app/\(painel\)/agentes/lista.test.ts
git commit -m "$(cat <<'EOF'
feat(painel): tela Agentes (cartões com estado, contagens e números do mês, filtros, busca e novo agente do dono)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 14: Painel. Ficha do agente — cabeçalho, abas, Visão geral, Ferramentas e Como fala com o cliente

**Files:**
- Create em `apps/painel/src/app/(painel)/agentes/[slug]/`: `ficha.ts`, `ficha.test.ts`, `layout.tsx`, `cabecalho-agente.tsx`, `abas-agente.tsx`, `faixas.tsx`, `historico-agente.tsx`, `coluna-lateral.tsx`, `page.tsx`, `ferramentas/page.tsx`, `ferramentas/escolher-ferramentas.tsx`, `como-fala/page.tsx`, `como-fala/modo-contato.tsx`, `como-fala/regras-assunto.tsx`

**Interfaces:**
- Consumes: Task 10 (leituras e ações), Task 12 (`SemPermissao`), Task 5 (`INFO_MODO`, `CATALOGO_FERRAMENTAS`, `FERRAMENTAS_ATENDIMENTO`, `FERRAMENTAS_AUTOMATICAS`, `exigeAprovacao`, `ORDEM_PRIORIDADE`, `INFO_TIPO_SKILL`, `ROTULO_ESTADO`, `ESTADOS_AGENTE`, `TEXTO_FALA_THIAGO`), `lerPeriodo`, `formatarUSD`, `formatarData`, `formatarDataHora`.
- Produces:
  - `ficha.ts` (puro): `ABAS_AGENTE: { segmento: string; rotulo: string }[]` (Visão geral `''`, `skills`, `ferramentas`, `como-fala`, `orientacoes`, `testar`, `atividade`), `abaAtual(pathname, slug): string`, `hrefAba(slug, segmento)`;
  - layout com o cabeçalho (estado, Teste com contatos, modelo, custo e conversas do mês, HISTÓRICO, TESTAR AGORA), as abas e as faixas (`FaixaSoThiago`, `FaixaSemMigracao`) em todas as abas;
  - `OrdemPrioridade`, `ResumoFerramentas`, `UltimasMudancas` (`coluna-lateral.tsx`, usados também na aba Skills).

- [ ] **Passo 1: teste que falha**

`agentes/[slug]/ficha.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ABAS_AGENTE, abaAtual, hrefAba } from './ficha';

describe('abas da ficha do agente (spec 7E.3, D20)', () => {
  it('as 7 abas, na ordem da imagem', () => {
    expect(ABAS_AGENTE.map((a) => a.rotulo)).toEqual(['Visão geral', 'Skills', 'Ferramentas', 'Como fala com o cliente', 'Orientações', 'Testar', 'Atividade e custo']);
  });
  it('aba pelo caminho; o endereço de cada uma', () => {
    expect(abaAtual('/agentes/fiscal', 'fiscal')).toBe('');
    expect(abaAtual('/agentes/fiscal/skills', 'fiscal')).toBe('skills');
    expect(abaAtual('/agentes/fiscal/coisa', 'fiscal')).toBe('');
    expect(hrefAba('fiscal', '')).toBe('/agentes/fiscal');
    expect(hrefAba('fiscal', 'como-fala')).toBe('/agentes/fiscal/como-fala');
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/[slug]/ficha.test.ts"`
Expected: FAIL (módulo não existe).

- [ ] **Passo 2: as regras puras e as peças de servidor**

`agentes/[slug]/ficha.ts`:

```ts
/** Abas da ficha (spec 7E.3), cada uma uma rota (D20): o menu recolhido e os parâmetros de cada aba dependem do caminho. */
export const ABAS_AGENTE = [
  { segmento: '', rotulo: 'Visão geral' }, { segmento: 'skills', rotulo: 'Skills' }, { segmento: 'ferramentas', rotulo: 'Ferramentas' },
  { segmento: 'como-fala', rotulo: 'Como fala com o cliente' }, { segmento: 'orientacoes', rotulo: 'Orientações' },
  { segmento: 'testar', rotulo: 'Testar' }, { segmento: 'atividade', rotulo: 'Atividade e custo' },
] as const;

export const hrefAba = (slug: string, segmento: string) => `/agentes/${slug}${segmento ? `/${segmento}` : ''}`;

export function abaAtual(pathname: string, slug: string): string {
  const resto = pathname.slice(`/agentes/${slug}`.length).replace(/^\//, '').split('/')[0] ?? '';
  return ABAS_AGENTE.some((a) => a.segmento === resto) ? resto : '';
}
```

`agentes/[slug]/faixas.tsx`:

```tsx
import { Info, TriangleAlert } from 'lucide-react';

/** D14: os outros agentes guardam a configuração, mas nesta etapa só o Thiago atende. */
export function FaixaSoThiago() {
  return (
    <p className="flex items-start gap-2 rounded-md border border-info bg-info-soft px-4 py-3 text-sm text-info">
      <Info aria-hidden size={16} className="mt-0.5 shrink-0" />
      Nesta etapa só o Thiago atende. O que você configurar aqui fica guardado e passa a valer quando o Thiago começar a chamar os agentes dos setores (próxima etapa).
    </p>
  );
}

/** D23: homologação sem a migração. */
export function FaixaSemMigracao() {
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
      <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
      Os agentes aparecem quando a atualização do banco da Parte I for aplicada. Até lá, só as orientações e o teste do Thiago funcionam.
    </p>
  );
}
```

`agentes/[slug]/coluna-lateral.tsx`:

```tsx
import Link from 'next/link';
import { Lock, LockKeyhole } from 'lucide-react';
import { CATALOGO_FERRAMENTAS, ORDEM_PRIORIDADE, exigeAprovacao, type NomeFerramentaCatalogo } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Agente, Mudanca } from '@/lib/agentes';
import { formatarData } from '@/lib/formatos';

const titulo = 'text-sm font-bold uppercase tracking-wide text-brand';

/** Quem vence em conflito (spec 7E.3). */
export function OrdemPrioridade() {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between"><h2 className={titulo}>Ordem de prioridade</h2><span className="text-xs text-muted">quem vence em conflito</span></div>
      <ol className="flex flex-col gap-1.5">
        {ORDEM_PRIORIDADE.map((p, i) => (
          <li key={p} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span className="tabular flex size-5 items-center justify-center rounded-full bg-grafite text-xs font-bold text-grafite-foreground">{i + 1}</span>
            <span className="flex-1">{p}</span>
            {i === 0 && <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock aria-hidden size={12} />fixas</span>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">Conhecimento e exemplos só informam; não mandam.</p>
    </Card>
  );
}

/** Ferramentas liberadas com a marca de só leitura ou aprovação (D15). */
export function ResumoFerramentas({ agente }: { agente: Pick<Agente, 'slug' | 'ferramentas' | 'portaDeEntrada'> }) {
  const liberadas = agente.ferramentas.filter((f): f is NomeFerramentaCatalogo => f in CATALOGO_FERRAMENTAS);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className={titulo}>Ferramentas</h2>
        <span className="text-xs text-muted">{liberadas.length} liberadas · <Link href={`/agentes/${agente.slug}/ferramentas`} className="font-bold text-brand">ver aba</Link></span>
      </div>
      <ul className="flex flex-col gap-1">
        {liberadas.map((f) => (
          <li key={f} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
            <span>{CATALOGO_FERRAMENTAS[f].rotulo}</span>
            {exigeAprovacao(CATALOGO_FERRAMENTAS[f])
              ? <Badge variant="warning"><LockKeyhole aria-hidden />{agente.portaDeEntrada ? 'o cliente confirma' : 'aprovação'}</Badge>
              : <Badge variant="success">só leitura</Badge>}
          </li>
        ))}
      </ul>
      {!agente.portaDeEntrada && <p className="text-xs text-muted">Grava ou envia algo: exige aprovação humana antes de valer.</p>}
    </Card>
  );
}

export function UltimasMudancas({ mudancas }: { mudancas: Mudanca[] }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h2 className={titulo}>Últimas mudanças</h2>
      {mudancas.length === 0 ? <p className="text-sm text-muted">Nenhuma mudança ainda.</p> : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {mudancas.map((m) => <li key={m.id}><b className="tabular">{formatarData(m.quando)}</b> · {m.descricao}{m.quem && <span className="text-muted"> ({m.quem})</span>}</li>)}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Passo 3: o layout, o cabeçalho, as abas e o histórico**

`agentes/[slug]/abas-agente.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { ABAS_AGENTE, abaAtual, hrefAba } from './ficha';

/** Abas como links (cada uma uma rota, D20); a atual com aria-current. */
export function AbasAgente({ slug, contagem }: { slug: string; contagem: Record<string, number> }) {
  const atual = abaAtual(usePathname(), slug);
  return (
    <nav aria-label="Seções do agente" className="-mx-1 overflow-x-auto border-b border-border px-1">
      <ul className="flex gap-1">
        {ABAS_AGENTE.map((a) => {
          const ativa = a.segmento === atual;
          return (
            <li key={a.segmento}>
              <Link href={hrefAba(slug, a.segmento)} aria-current={ativa ? 'page' : undefined} scroll={false}
                className={cn('-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150 ease-out',
                  ativa ? 'border-brand text-foreground' : 'border-transparent text-muted hover:border-border hover:text-foreground')}>
                {a.rotulo}
                {contagem[a.segmento] !== undefined && <span className="tabular rounded-sm bg-surface-muted px-1 text-xs text-muted">{contagem[a.segmento]}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

`agentes/[slug]/historico-agente.tsx`:

```tsx
'use client';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { Mudanca } from '@/lib/agentes';
import { formatarDataHora } from '@/lib/formatos';

/** HISTÓRICO (D28): todas as mudanças do agente, em frases, da mais nova para a mais antiga. */
export function HistoricoAgente({ nome, mudancas }: { nome: string; mudancas: Mudanca[] }) {
  return (
    <Sheet>
      <SheetTrigger asChild><Button variant="outline"><History aria-hidden size={16} />Histórico</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Histórico de {nome}</SheetTitle><SheetDescription>Quem mudou o quê, e quando.</SheetDescription></SheetHeader>
        <SheetBody>
          {mudancas.length === 0 ? <p className="text-sm text-muted">Nenhuma mudança ainda.</p> : (
            <ol className="flex flex-col gap-2 text-sm">
              {mudancas.map((m) => (
                <li key={m.id} className="border-b border-border pb-2">
                  <p>{m.descricao}</p>
                  <p className="text-xs text-muted">{formatarDataHora(m.quando)}{m.quem ? ` · ${m.quem}` : ''}</p>
                </li>
              ))}
            </ol>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
```

`agentes/[slug]/cabecalho-agente.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Bot, FlaskConical, LockKeyhole, Play, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { ESTADOS_AGENTE, ROTULO_ESTADO, ROTULO_TIPO_AGENTE, type EstadoAgente } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button, variantesBotao } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Agente, ContatoTeste, Mudanca, NumerosAgente } from '@/lib/agentes';
import { buscarContatosParaTeste, definirContatosTeste, salvarAgente } from '@/lib/agentes-acoes';
import { cn } from '@/lib/cn';
import { formatarData, formatarUSD } from '@/lib/formatos';
import { ICONE_AGENTE } from '../cartao-agente';
import { HistoricoAgente } from './historico-agente';

const caixa = 'flex flex-col gap-0.5 rounded-md border border-border px-3 py-2';
const rotuloCaixa = 'text-xs font-bold uppercase tracking-wide text-muted';

/** Cabeçalho da ficha (spec 7E.3, imagem 00-agente-ficha): estado (só o dono), Teste com contatos, modelo, números do mês. */
export function CabecalhoAgente({ agente: a, dono, numeros, mostrarNumeros, contatosTeste, modelos, mudancas }: {
  agente: Agente; dono: boolean; numeros: NumerosAgente | null; mostrarNumeros: boolean; contatosTeste: ContatoTeste[];
  modelos: { padrao: string; comPreco: string[] }; mudancas: Mudanca[];
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [escolhendo, setEscolhendo] = useState(false);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<ContatoTeste[]>([]);
  const Icone = ICONE_AGENTE[a.slug] ?? Bot;
  const podeEstado = dono && !a.portaDeEntrada;
  const avisar = (r: { ok: true } | { ok: false; erro: string }, texto: string) => {
    if (r.ok) { toast(texto); router.refresh(); } else toast.error(r.erro);
    return r.ok;
  };

  useEffect(() => {
    if (busca.trim().length < 2) { setAchados([]); return; }
    const t = setTimeout(() => { buscarContatosParaTeste(busca).then(setAchados).catch(() => setAchados([])); }, 250);
    return () => clearTimeout(t);
  }, [busca]);

  const mudarEstado = (estado: EstadoAgente) => {
    // Teste sem contato: primeiro escolher quem (o banco recusa Teste vazio).
    if (estado === 'teste' && contatosTeste.length === 0) { setEscolhendo(true); return; }
    iniciar(async () => { avisar(await salvarAgente(a.slug, { estado }), `Estado: ${ROTULO_ESTADO[estado]}.`); });
  };
  const adicionar = (c: ContatoTeste) => iniciar(async () => {
    const ok = avisar(await definirContatosTeste(a.slug, [...contatosTeste.map((x) => x.id), c.id]), `${c.nome} entrou no teste.`);
    if (ok && escolhendo && a.estado !== 'teste') avisar(await salvarAgente(a.slug, { estado: 'teste' }), 'Estado: Teste.');
    setBusca(''); setEscolhendo(false);
  });
  const remover = (c: ContatoTeste) => iniciar(async () => {
    avisar(await definirContatosTeste(a.slug, contatosTeste.filter((x) => x.id !== c.id).map((x) => x.id)), `${c.nome} saiu do teste.`);
  });
  const mudarModelo = (modelo: string) => iniciar(async () => {
    avisar(await salvarAgente(a.slug, { modelo: modelo || null }), 'Modelo salvo.');
  });

  return (
    <header className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-md bg-surface-muted text-brand"><Icone aria-hidden size={20} /></span>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold text-brand">{a.nome}</h1>
            <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              <Badge variant="neutral">{a.setor ? `Setor ${a.setor}` : a.portaDeEntrada ? 'Atendimento' : 'Sem setor'}</Badge>
              <Badge variant="success">{a.tipos.map((t) => ROTULO_TIPO_AGENTE[t]).join(' + ')}</Badge>
              {a.criadoEm && <span>· criado em {formatarData(a.criadoEm)}</span>}
              {a.atualizadoEm && <span>· última mudança {formatarData(a.atualizadoEm)}{a.atualizadoPor ? ` por ${a.atualizadoPor}` : ''}</span>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className={caixa}>
            <span className={rotuloCaixa}>Modelo de IA</span>
            {dono ? (
              <select aria-label="Modelo de IA" value={a.modelo ?? ''} disabled={enviando} onChange={(e) => mudarModelo(e.target.value)}
                className="h-8 rounded-md border border-input bg-surface px-2 text-sm font-bold">
                <option value="">Padrão de Configurações ({modelos.padrao})</option>
                {modelos.comPreco.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : <span className="font-bold">{a.modelo ?? modelos.padrao}</span>}
            <span className="text-xs text-muted">{a.modelo ? 'escolhido para este agente' : 'troca em Configurações'}</span>
          </div>
          {mostrarNumeros && (
            <>
              <div className={caixa}><span className={rotuloCaixa}>Custo do mês</span><span className="tabular text-xl font-extrabold">{formatarUSD((numeros?.custoUsd ?? 0) + (numeros?.custoTestesUsd ?? 0))}</span></div>
              <div className={caixa}><span className={rotuloCaixa}>Conversas no mês</span><span className="tabular text-xl font-extrabold">{numeros?.atendimentos ?? 0}</span></div>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Estado do agente" className="flex flex-wrap items-center gap-2">
          <span className={rotuloCaixa}>Estado</span>
          <div className="inline-flex overflow-hidden rounded-md border border-border">
            {ESTADOS_AGENTE.map((e) => (
              <button key={e} type="button" aria-pressed={a.estado === e} disabled={!podeEstado || enviando} onClick={() => mudarEstado(e)}
                className={cn('h-8 px-3 text-sm font-bold uppercase disabled:cursor-not-allowed',
                  a.estado === e ? (e === 'teste' ? 'bg-warning-soft text-warning' : e === 'ligado' ? 'bg-success-soft text-success' : 'bg-grafite text-grafite-foreground') : 'bg-surface text-muted')}>
                {ROTULO_ESTADO[e]}
              </button>
            ))}
          </div>
          <Badge variant="brand"><LockKeyhole aria-hidden />só o dono</Badge>
          {a.portaDeEntrada && <span className="text-sm text-muted">O Thiago fica sempre ligado. Para parar o atendimento, use PAUSAR no Início.</span>}
        </div>
        <div className="flex gap-2">
          <HistoricoAgente nome={a.nome} mudancas={mudancas} />
          {a.portaDeEntrada
            ? <Link href={`/agentes/${a.slug}/testar`} className={variantesBotao()}><Play aria-hidden size={16} />Testar agora</Link>
            : <Button disabled title="O teste deste agente chega quando ele começar a atender."><Play aria-hidden size={16} />Testar agora</Button>}
        </div>
      </div>
      {!a.portaDeEntrada && (a.estado === 'teste' || escolhendo) && (
        <div className="flex flex-col gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical aria-hidden size={16} className="text-warning" />
            <b>Em teste:</b> só atende estes contatos; os outros seguem com o Thiago.
            <span className="font-bold">Testando com:</span>
            {contatosTeste.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5">
                {c.nome}
                {dono && <button type="button" aria-label={`Tirar ${c.nome} do teste`} onClick={() => remover(c)} disabled={enviando}><X aria-hidden size={12} /></button>}
              </span>
            ))}
          </div>
          {dono && (
            <div className="flex flex-col gap-1">
              <label className="inline-flex items-center gap-2 font-bold uppercase text-brand"><Plus aria-hidden size={14} />Adicionar contato
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome ou telefone" className="h-8 w-64 font-normal normal-case" />
              </label>
              {achados.length > 0 && (
                <ul aria-label="Contatos encontrados" className="flex flex-wrap gap-1">
                  {achados.map((c) => (
                    <li key={c.id}><Button size="sm" variant="outline" onClick={() => adicionar(c)} disabled={enviando}>{c.nome} · {c.telefone}</Button></li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
```

`agentes/[slug]/layout.tsx`:

```tsx
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { acessoAosAgentes, lerAgente, lerContagens, lerContatosTeste, lerModelos, lerMudancas, lerNumeros, souDono } from '@/lib/agentes';
import { lerPeriodo } from '@/lib/gastos';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { SemPermissao } from '../../treinar-agente/tela-orientacoes';
import { AbasAgente } from './abas-agente';
import { CabecalhoAgente } from './cabecalho-agente';
import { FaixaSemMigracao, FaixaSoThiago } from './faixas';

/** Ficha do agente (spec 7E.3): cabeçalho e abas em todas as abas. Quem não vê os agentes recebe a tela de sempre do Treinar (D22). */
export default async function FichaDoAgente({ params, children }: { params: Promise<{ slug: string }>; children: ReactNode }) {
  const [{ slug }, u] = await Promise.all([params, obterUsuario()]);
  const sb = await supabaseServidor();
  const acesso = acessoAosAgentes(u, await souDono(sb));
  if (!acesso.ver) return <SemPermissao />;
  const { agente, semMigracao } = await lerAgente(sb, slug);
  if (!agente) notFound();
  const mes = lerPeriodo({}, new Date());
  const [contagens, numeros, contatosTeste, modelos, mudancas] = await Promise.all([
    semMigracao ? Promise.resolve(null) : lerContagens(sb, [agente]),
    acesso.numeros && !semMigracao ? lerNumeros(sb, mes.de, mes.ate) : Promise.resolve(null),
    semMigracao ? Promise.resolve([]) : lerContatosTeste(sb, agente.id),
    lerModelos(sb),
    semMigracao ? Promise.resolve([]) : lerMudancas(sb, agente.id, 200),
  ]);
  const c = contagens?.get(agente.id);
  return (
    <div className="flex flex-col gap-4">
      <CabecalhoAgente agente={agente} dono={acesso.dono && !semMigracao} numeros={numeros?.get(agente.id) ?? null} mostrarNumeros={acesso.numeros}
        contatosTeste={contatosTeste} modelos={modelos} mudancas={mudancas} />
      <AbasAgente slug={agente.slug} contagem={c ? { skills: c.skills, ferramentas: c.ferramentas } : {}} />
      {semMigracao && <FaixaSemMigracao />}
      {!agente.portaDeEntrada && <FaixaSoThiago />}
      {children}
    </div>
  );
}
```

- [ ] **Passo 4: Visão geral, Ferramentas e Como fala com o cliente**

`agentes/[slug]/page.tsx` (Visão geral):

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { INFO_MODO, INFO_TIPO_SKILL, TEXTO_FALA_THIAGO, TIPOS_SKILL } from '@escritorio/core';
import { Card } from '@/components/ui/card';
import { lerAgente, lerMudancas, lerRegras, lerSkills } from '@/lib/agentes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { OrdemPrioridade, ResumoFerramentas, UltimasMudancas } from './coluna-lateral';

/** Visão geral: skills por tipo, como fala com o cliente, ferramentas, prioridade e últimas mudanças. */
export default async function VisaoGeral({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const { agente, semMigracao } = await lerAgente(sb, slug);
  if (!agente) notFound();
  const [skills, regras, mudancas] = semMigracao ? [[], [], []] : await Promise.all([lerSkills(sb, agente.id), lerRegras(sb, agente.id), lerMudancas(sb, agente.id, 5)]);
  const fala = agente.portaDeEntrada ? TEXTO_FALA_THIAGO : agente.modoContato ? INFO_MODO[agente.modoContato].rotulo : 'a definir';
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Skills por tipo</h2>
            <Link href={`/agentes/${slug}/skills`} className="text-sm font-bold text-brand">abrir aba</Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {[...TIPOS_SKILL].sort((x, y) => INFO_TIPO_SKILL[x].ordem - INFO_TIPO_SKILL[y].ordem).map((t) => {
              const doTipo = skills.filter((s) => s.tipo === t);
              return (
                <li key={t} className="rounded-md border border-border px-3 py-2 text-sm">
                  <p className="font-bold">{INFO_TIPO_SKILL[t].ordem} · {INFO_TIPO_SKILL[t].rotulo}</p>
                  <p className="text-muted">{INFO_TIPO_SKILL[t].quando} · {doTipo.filter((s) => s.ativo).length} ligada(s) de {doTipo.length}</p>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Como fala com o cliente</h2>
            <Link href={`/agentes/${slug}/como-fala`} className="text-sm font-bold text-brand">abrir aba</Link>
          </div>
          <p className="text-sm">Modo padrão: <b>{fala}</b>{!agente.portaDeEntrada && <> · {regras.length} regra(s) por assunto</>}</p>
        </Card>
        <ResumoFerramentas agente={agente} />
      </div>
      <div className="flex flex-col gap-4">
        <OrdemPrioridade />
        <UltimasMudancas mudancas={mudancas} />
      </div>
    </div>
  );
}
```

`agentes/[slug]/ferramentas/escolher-ferramentas.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { CATALOGO_FERRAMENTAS, FERRAMENTAS_ATENDIMENTO, FERRAMENTAS_AUTOMATICAS, exigeAprovacao } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { salvarAgente } from '@/lib/agentes-acoes';

/** Aba Ferramentas (spec 7E.3, D15): o catálogo com só leitura × grava/envia; o dono escolhe; no Thiago, fixas. */
export function EscolherFerramentas({ slug, porta, escolhidas, editavel }: { slug: string; porta: boolean; escolhidas: string[]; editavel: boolean }) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState(new Set(escolhidas));
  const [enviando, iniciar] = useTransition();
  const mudou = marcadas.size !== escolhidas.length || escolhidas.some((f) => !marcadas.has(f));
  const salvar = () => iniciar(async () => {
    const r = await salvarAgente(slug, { ferramentas: [...marcadas] });
    if (r.ok) { toast('Ferramentas salvas.'); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Ferramentas do catálogo</h2>
      {porta && <p className="text-sm text-muted">As ferramentas do atendimento são fixas nesta etapa. As que gravam ou enviam valem com o "sim" do cliente no WhatsApp (regras fixas).</p>}
      <ul className="flex flex-col divide-y divide-border">
        {FERRAMENTAS_ATENDIMENTO.map((f) => {
          const info = CATALOGO_FERRAMENTAS[f];
          return (
            <li key={f} className="flex items-center gap-3 py-2">
              <Checkbox id={`ferramenta-${f}`} checked={marcadas.has(f)} disabled={!editavel || porta || enviando}
                onCheckedChange={(v) => setMarcadas((m) => { const n = new Set(m); if (v === true) n.add(f); else n.delete(f); return n; })} />
              <label htmlFor={`ferramenta-${f}`} className="flex flex-1 flex-col">
                <span className="font-medium">{info.rotulo}</span><span className="text-sm text-muted">{info.descricao}</span>
              </label>
              {exigeAprovacao(info)
                ? <Badge variant="warning"><LockKeyhole aria-hidden />{porta ? 'o cliente confirma' : 'exige aprovação humana'}</Badge>
                : <Badge variant="success">só leitura</Badge>}
            </li>
          );
        })}
      </ul>
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted">
        <p className="font-bold text-foreground">Entram sozinhas quando há skill sob demanda ligada</p>
        <ul>{Object.values(FERRAMENTAS_AUTOMATICAS).map((i) => <li key={i.rotulo}>{i.rotulo}: {i.descricao}</li>)}</ul>
      </div>
      {editavel && !porta && <Button className="self-end" onClick={salvar} disabled={!mudou || enviando}>Salvar</Button>}
    </Card>
  );
}
```

`agentes/[slug]/ferramentas/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { lerAgente, souDono } from '@/lib/agentes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { EscolherFerramentas } from './escolher-ferramentas';

export default async function Ferramentas({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  return <EscolherFerramentas slug={agente.slug} porta={agente.portaDeEntrada} escolhidas={agente.ferramentas} editavel={dono && !semMigracao} />;
}
```

`agentes/[slug]/como-fala/modo-contato.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { INFO_MODO, MODOS_CONTATO, type ModoContato } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { salvarAgente } from '@/lib/agentes-acoes';
import { cn } from '@/lib/cn';

/** Modo padrão (spec 7E.3): Por trás · Mesma voz · Passa a conversa. Só o dono escolhe. */
export function ModoContatoEscolha({ slug, atual, editavel }: { slug: string; atual: ModoContato | null; editavel: boolean }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const escolher = (modo: ModoContato) => iniciar(async () => {
    const r = await salvarAgente(slug, { modoContato: modo });
    if (r.ok) { toast(`Modo padrão: ${INFO_MODO[modo].rotulo}.`); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <fieldset className="grid gap-3 md:grid-cols-3" disabled={!editavel || enviando}>
      <legend className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Modo padrão</legend>
      {MODOS_CONTATO.map((m) => (
        <label key={m} className={cn('flex cursor-pointer flex-col gap-2 rounded-md border p-3 text-sm', atual === m ? 'border-brand bg-brand-soft' : 'border-border bg-surface')}>
          <span className="flex items-center gap-2 font-bold">
            <input type="radio" name="modo" value={m} checked={atual === m} onChange={() => escolher(m)} />{INFO_MODO[m].rotulo}
            {atual === m && <Badge variant="brand" className="ml-auto uppercase">padrão</Badge>}
          </span>
          <span>{INFO_MODO[m].explicacao}</span>
          <span className="text-muted"><b>Bom para:</b> {INFO_MODO[m].bomPara}</span>
        </label>
      ))}
    </fieldset>
  );
}
```

`agentes/[slug]/como-fala/regras-assunto.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { INFO_MODO, MODOS_CONTATO, type ModoContato } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RegraAssunto } from '@/lib/agentes';
import { excluirRegraAssunto, salvarRegraAssunto } from '@/lib/agentes-acoes';

type Edicao = { id: string | null; assunto: string; exemplo: string; modo: ModoContato };

/** Regras por assunto (spec 7E.3): valem antes do modo padrão. Uso no mês: "—" até o Thiago chamar os agentes (D14). */
export function RegrasAssunto({ slug, regras, editavel }: { slug: string; regras: RegraAssunto[]; editavel: boolean }) {
  const router = useRouter();
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [enviando, iniciar] = useTransition();
  const salvar = () => edicao && iniciar(async () => {
    const r = await salvarRegraAssunto(slug, edicao.id, { assunto: edicao.assunto, exemplo: edicao.exemplo, modo: edicao.modo });
    if (r.ok) { toast('Regra salva.'); setEdicao(null); router.refresh(); } else toast.error(r.erro);
  });
  const excluir = (r: RegraAssunto) => iniciar(async () => {
    const x = await excluirRegraAssunto(r.id);
    if (x.ok) { toast('Regra removida.'); router.refresh(); } else toast.error(x.erro);
  });
  const formulario = edicao && (
    <tr>
      <td className="py-2 pr-2"><Input aria-label="Quando o assunto for" value={edicao.assunto} maxLength={80} onChange={(e) => setEdicao({ ...edicao, assunto: e.target.value })} /></td>
      <td className="py-2 pr-2"><Input aria-label="Exemplo do que o cliente diz" value={edicao.exemplo} maxLength={200} onChange={(e) => setEdicao({ ...edicao, exemplo: e.target.value })} /></td>
      <td className="py-2 pr-2">
        <select aria-label="Modo" value={edicao.modo} onChange={(e) => setEdicao({ ...edicao, modo: e.target.value as ModoContato })} className="h-9 rounded-md border border-input bg-surface px-2 text-sm">
          {MODOS_CONTATO.map((m) => <option key={m} value={m}>{INFO_MODO[m].rotulo}</option>)}
        </select>
      </td>
      <td colSpan={2} className="py-2 text-right">
        <Button size="sm" variant="outline" onClick={() => setEdicao(null)}>Cancelar</Button>{' '}
        <Button size="sm" onClick={salvar} disabled={enviando}>Salvar regra</Button>
      </td>
    </tr>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Regras por assunto <span className="font-normal normal-case">· valem antes do modo padrão</span></h2>
        {editavel && !edicao && <Button variant="outline" onClick={() => setEdicao({ id: null, assunto: '', exemplo: '', modo: 'mesma_voz' })}><Plus aria-hidden size={16} />Nova regra</Button>}
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-xs uppercase text-muted">
          <th className="py-2">Quando o assunto for</th><th>Exemplo do que o cliente diz</th><th>Modo</th><th>Usada no mês</th><th><span className="sr-only">Ações</span></th>
        </tr></thead>
        <tbody className="divide-y divide-border">
          {regras.map((r) => (edicao?.id === r.id ? null : (
            <tr key={r.id}>
              <td className="py-2 font-bold">{r.assunto}</td>
              <td className="text-muted">{r.exemplo ? `"${r.exemplo}"` : '—'}</td>
              <td><Badge variant="outline">{INFO_MODO[r.modo].rotulo}</Badge></td>
              <td className="text-muted">—</td>
              <td className="text-right">{editavel && (
                <>
                  <Button size="icon" variant="ghost" aria-label={`Editar a regra ${r.assunto}`} onClick={() => setEdicao({ id: r.id, assunto: r.assunto, exemplo: r.exemplo, modo: r.modo })}><Pencil aria-hidden size={16} /></Button>
                  <Button size="icon" variant="ghost" aria-label={`Remover a regra ${r.assunto}`} onClick={() => excluir(r)} disabled={enviando}><Trash2 aria-hidden size={16} /></Button>
                </>
              )}</td>
            </tr>
          )))}
          {formulario}
          {!regras.length && !edicao && <tr><td colSpan={5} className="py-3 text-muted">Nenhuma regra: vale o modo padrão.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
```

`agentes/[slug]/como-fala/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { TEXTO_FALA_THIAGO } from '@escritorio/core';
import { Card } from '@/components/ui/card';
import { lerAgente, lerRegras, souDono } from '@/lib/agentes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ModoContatoEscolha } from './modo-contato';
import { RegrasAssunto } from './regras-assunto';

/** Aba Como fala com o cliente (spec 7E.3). O Thiago é a voz (D13); os outros guardam modo e regras (D14). */
export default async function ComoFala({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  const editavel = dono && !semMigracao;
  if (agente.portaDeEntrada) {
    return (
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Como fala com o cliente</h2>
        <p className="text-lg font-bold">{TEXTO_FALA_THIAGO}</p>
        <p className="text-sm text-muted">O Thiago recebe toda mensagem. Os agentes dos setores falam pelo modo escolhido na ficha de cada um (próxima etapa).</p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Como fala com o cliente</h2>
      <ModoContatoEscolha slug={agente.slug} atual={agente.modoContato} editavel={editavel} />
      <RegrasAssunto slug={agente.slug} regras={semMigracao ? [] : await lerRegras(sb, agente.id)} editavel={editavel} />
      <p className="flex items-start gap-2 rounded-md border border-success bg-success-soft px-3 py-2 text-sm text-success">
        <ShieldCheck aria-hidden size={16} className="mt-0.5 shrink-0" />
        O acesso por contato vale sempre: só trata de {agente.setor ?? 'assuntos do setor'} com quem pode tratar de {agente.setor ?? 'assuntos do setor'}. Quem não tem acesso continua com o Thiago, seja qual for o modo.
      </p>
    </Card>
  );
}
```

- [ ] **Passo 5: typecheck, testes e as regras de estilo**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/[slug]/ficha.test.ts" && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo passa (inclusive `escala.test.ts`).

- [ ] **Passo 6: conferir à mão** (banco local, `next dev -p 3107`, dono marcado): `/agentes/fiscal` mostra a faixa "Nesta etapa só o Thiago atende…", o seletor de estado; TESTE sem contato abre a busca; escolher um contato põe em Teste; HISTÓRICO lista as frases; Ferramentas salva; Como fala grava modo e regra. `/agentes/atendimento`: estado travado em LIGADO com a frase, ferramentas fixas, "Direto, é a voz do escritório". `/agentes/atendimento/orientacoes`: a tela do Treinar dentro da ficha, menu recolhido. Desligue o `next dev`.

- [ ] **Passo 7: commit**

```bash
git add apps/painel/src/app/\(painel\)/agentes/\[slug\]
git commit -m "$(cat <<'EOF'
feat(painel): ficha do agente (cabeçalho com estado e Teste, modelo, números do mês, histórico; Visão geral, Ferramentas e Como fala com o cliente)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

(O `git add` da pasta inteira leva também `orientacoes/page.tsx`, já commitada na Task 12, sem mudança.)

---

### Task 15: Painel. Aba Skills (por tipo, subir, versões com diferença, liga/desliga)

**Files:**
- Create em `apps/painel/src/app/(painel)/agentes/[slug]/skills/`: `page.tsx`, `lista-skills.tsx`, `subir-skill.tsx`, `versoes-skill.tsx`, `uso.ts`, `uso.test.ts`

**Interfaces:**
- Consumes: Task 10 (`lerSkills`, `lerUsoSkills`, `lerMudancas`, `souDono`, `SkillTela`), Task 11 (`subirSkill`, `alternarSkill`, `arquivarSkill`, `restaurarVersaoSkill`, `versoesDaSkill`), Task 5 (`INFO_TIPO_SKILL`, `TIPOS_SKILL`, `diferencaLinhas`), Task 14 (`OrdemPrioridade`, `ResumoFerramentas`, `UltimasMudancas`).
- Produces: `uso.ts`: `textoDeUso(skill: Pick<SkillTela, 'tipo' | 'ativo' | 'nome'>, uso: Map<string, number>): string`, `gruposDeSkills(skills): { tipo: TipoSkill; skills: SkillTela[] }[]` (os 5 tipos, sempre, na ordem da tela).

- [ ] **Passo 1: teste que falha**

`skills/uso.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gruposDeSkills, textoDeUso } from './uso';

const s = (tipo: 'jeito' | 'limites' | 'procedimento' | 'conhecimento' | 'exemplos', nome: string, ativo = true) =>
  ({ id: nome, nome, tipo, ativo, versao: 1, titulo: nome, descricao: '', arquivos: [], atualizadaEm: '2026-10-01T12:00:00Z', autor: null });

describe('aba Skills (spec 7E.3, D10)', () => {
  it('os 5 grupos na ordem da tela, mesmo vazios', () => {
    const g = gruposDeSkills([s('exemplos', 'boas'), s('jeito', 'tom'), s('procedimento', 'nota'), s('procedimento', 'certidao')]);
    expect(g.map((x) => [x.tipo, x.skills.map((y) => y.nome)])).toEqual([
      ['jeito', ['tom']], ['limites', []], ['procedimento', ['certidao', 'nota']], ['conhecimento', []], ['exemplos', ['boas']],
    ]);
  });
  it('uso: sempre lidas, vezes no mês, nunca usada, desligada', () => {
    const uso = new Map([['nota', 19]]);
    expect(textoDeUso(s('limites', 'x'), uso)).toBe('em toda conversa');
    expect(textoDeUso(s('procedimento', 'nota'), uso)).toBe('usada 19× no mês');
    expect(textoDeUso(s('conhecimento', 'cfop'), uso)).toBe('ainda não usada');
    expect(textoDeUso(s('conhecimento', 'cfop', false), uso)).toBe('desligada');
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/[slug]/skills/uso.test.ts"`
Expected: FAIL.

- [ ] **Passo 2: as regras puras**

`skills/uso.ts`:

```ts
import { INFO_TIPO_SKILL, TIPOS_SKILL, type TipoSkill } from '@escritorio/core';
import type { SkillTela } from '@/lib/agentes';

export function gruposDeSkills(skills: SkillTela[]): { tipo: TipoSkill; skills: SkillTela[] }[] {
  return [...TIPOS_SKILL].sort((a, b) => INFO_TIPO_SKILL[a].ordem - INFO_TIPO_SKILL[b].ordem)
    .map((tipo) => ({ tipo, skills: skills.filter((x) => x.tipo === tipo).sort((a, b) => a.nome.localeCompare(b.nome)) }));
}

/** "Uso no mês" (D10): Jeito e Limites entram em toda conversa; as outras contam as leituras. */
export function textoDeUso(s: Pick<SkillTela, 'tipo' | 'ativo' | 'nome'>, uso: Map<string, number>): string {
  if (!s.ativo) return 'desligada';
  if (INFO_TIPO_SKILL[s.tipo].sempre) return 'em toda conversa';
  const n = uso.get(s.nome) ?? 0;
  return n ? `usada ${n}× no mês` : 'ainda não usada';
}
```

- [ ] **Passo 3: os componentes**

`skills/versoes-skill.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { diferencaLinhas } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { SkillTela, VersaoSkill } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarDataHora } from '@/lib/formatos';
import { restaurarVersaoSkill, versoesDaSkill } from '@/lib/skills-acoes';

/** Versões da skill (D9): quem, quando, a diferença para a anterior e RESTAURAR (só o dono). */
export function VersoesSkill({ skill, dono }: { skill: SkillTela; dono: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [versoes, setVersoes] = useState<VersaoSkill[] | null>(null);
  const [vista, setVista] = useState(0);
  const [enviando, iniciar] = useTransition();
  useEffect(() => { if (aberto) versoesDaSkill(skill.id).then((v) => { setVersoes(v); setVista(0); }); }, [aberto, skill.id]);
  const atual = versoes?.[vista];
  const anterior = versoes?.[vista + 1];
  const linhas = atual ? diferencaLinhas(anterior?.skillMd ?? '', atual.skillMd) : [];
  const restaurar = (v: VersaoSkill) => iniciar(async () => {
    const r = await restaurarVersaoSkill(v.id);
    if (r.ok) { toast(`Versão ${v.versao} restaurada.`); setAberto(false); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild><Button size="sm" variant="ghost" aria-label={`Versões de ${skill.titulo}`}><History aria-hidden size={16} /></Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Versões de {skill.titulo}</SheetTitle><SheetDescription>Quem subiu, quando e o que mudou.</SheetDescription></SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          {!versoes ? <p className="text-sm text-muted">Carregando…</p> : (
            <>
              <ul className="flex flex-col gap-1">
                {versoes.map((v, i) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => setVista(i)} aria-pressed={i === vista}
                      className={cn('flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm', i === vista ? 'border-brand bg-brand-soft' : 'border-border')}>
                      <span><b>v{v.versao}</b>{i === 0 && ' (atual)'}{v.origem === 'restaurada' && ` · restaurada da v${v.restauradaDe}`}</span>
                      <span className="text-muted">{formatarDataHora(v.criadoEm)}{v.autor ? ` · ${v.autor}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {atual && (
                <section aria-label={`Diferença da versão ${atual.versao}`} className="flex flex-col gap-2">
                  <p className="text-sm font-bold">{anterior ? `O que mudou da v${anterior.versao} para a v${atual.versao}` : 'Primeira versão'}</p>
                  <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface-muted p-2 text-xs">
                    {linhas.map((l, i) => (
                      <div key={i} className={cn(l.tipo === 'mais' && 'bg-success-soft text-success', l.tipo === 'menos' && 'bg-danger-soft text-danger line-through', l.tipo === 'igual' && 'text-muted')}>
                        <span aria-hidden>{l.tipo === 'mais' ? '+ ' : l.tipo === 'menos' ? '− ' : '  '}</span>
                        <span className="sr-only">{l.tipo === 'mais' ? 'Adicionado: ' : l.tipo === 'menos' ? 'Removido: ' : ''}</span>{l.texto}
                      </div>
                    ))}
                  </pre>
                  <p className="text-xs text-muted">Arquivos: {atual.arquivos.length ? atual.arquivos.join(', ') : 'nenhum'}</p>
                  {dono && vista > 0 && <Button onClick={() => restaurar(atual)} disabled={enviando}>Restaurar a versão {atual.versao}</Button>}
                </section>
              )}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
```

`skills/lista-skills.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Archive, Play } from 'lucide-react';
import { toast } from 'sonner';
import { INFO_TIPO_SKILL } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import type { SkillTela } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarData } from '@/lib/formatos';
import { alternarSkill, arquivarSkill } from '@/lib/skills-acoes';
import { gruposDeSkills, textoDeUso } from './uso';
import { VersoesSkill } from './versoes-skill';

/** Skills por tipo (spec 7E.3, imagem 00-agente-ficha): cada grupo diz quando o agente lê. */
export function ListaSkills({ slug, porta, skills, uso, dono }: { slug: string; porta: boolean; skills: SkillTela[]; uso: Record<string, number>; dono: boolean }) {
  const router = useRouter();
  const [arquivando, setArquivando] = useState<SkillTela | null>(null);
  const [enviando, iniciar] = useTransition();
  const mapaUso = new Map(Object.entries(uso));
  const alternar = (s: SkillTela, ativo: boolean) => iniciar(async () => {
    const r = await alternarSkill(s.id, ativo);
    if (r.ok) { toast(`${s.titulo} ${ativo ? 'ligada' : 'desligada'}.`); router.refresh(); } else toast.error(r.erro);
  });
  const arquivar = (s: SkillTela) => iniciar(async () => {
    const r = await arquivarSkill(s.id);
    setArquivando(null);
    if (r.ok) { toast(`${s.titulo} arquivada.`); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <div className="flex flex-col gap-4">
      {gruposDeSkills(skills).map(({ tipo, skills: doTipo }) => {
        const info = INFO_TIPO_SKILL[tipo];
        return (
          <section key={tipo} aria-label={info.rotulo} className="flex flex-col">
            <header className="flex items-start justify-between gap-2 border-b border-border pb-2">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">{info.ordem} · {info.titulo}{' '}
                  <Badge variant={info.sempre ? (tipo === 'limites' ? 'danger' : 'brand') : 'info'} className="normal-case">{info.quando}</Badge></h3>
                <p className="text-sm text-muted">{info.explicacao}</p>
              </div>
              <span className="text-xs text-muted">{doTipo.length === 1 ? '1 skill' : `${doTipo.length} skills`}</span>
            </header>
            <ul>
              {doTipo.map((s) => (
                <li key={s.id} className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border py-3', tipo === 'limites' && 'border-l-4 border-l-danger pl-3', !s.ativo && 'opacity-80')}>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">{s.titulo}
                      <Badge variant="warning">v{s.versao} · {formatarData(s.atualizadaEm)}</Badge>
                      {!s.ativo && <Badge variant="outline">desligada</Badge>}
                    </p>
                    <p className="text-sm text-muted">{s.descricao}</p>
                    <ul className="flex flex-wrap gap-1" aria-label={`Arquivos de ${s.titulo}`}>
                      {['SKILL.md', ...s.arquivos].map((a) => <li key={a}><code className="rounded-sm border border-border bg-surface-muted px-1.5 text-xs">{a}</code></li>)}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{textoDeUso(s, mapaUso)}</span>
                    <Switch checked={s.ativo} disabled={!dono || enviando} onCheckedChange={(v) => alternar(s, v)} aria-label={`Ligar ${s.titulo}`} />
                    <VersoesSkill skill={s} dono={dono} />
                    {porta && dono && (
                      <Link href={`/agentes/${slug}/testar?skill=${s.id}`} aria-label={`Testar ${s.titulo}`} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-surface-muted"><Play aria-hidden size={16} /></Link>
                    )}
                    {dono && <Button size="sm" variant="ghost" aria-label={`Arquivar ${s.titulo}`} onClick={() => setArquivando(s)}><Archive aria-hidden size={16} /></Button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Dialog open={arquivando !== null} onOpenChange={(v) => { if (!v) setArquivando(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Arquivar <b>{arquivando?.titulo}</b>?</DialogTitle>
            <DialogDescription>Sai da lista e do agente. As versões ficam guardadas; subir de novo com o mesmo nome traz a skill de volta.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArquivando(null)}>Cancelar</Button>
            <Button variant="grafite" onClick={() => arquivando && arquivar(arquivando)} disabled={enviando}>Arquivar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

`skills/subir-skill.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { INFO_TIPO_SKILL, TIPOS_SKILL, type TipoSkill } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { subirSkill } from '@/lib/skills-acoes';

type Escolhido = { arquivo: File; caminho: string };

/** SUBIR SKILL (spec 7E.3, D8): pasta, .zip ou .md; o tipo do cabeçalho vence; sem ele, vale o escolhido aqui. */
export function SubirSkill({ slug }: { slug: string }) {
  const router = useRouter();
  const pasta = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState<TipoSkill | null>(null);
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  // webkitdirectory não é atributo conhecido do React: liga direto no elemento.
  useEffect(() => { pasta.current?.setAttribute('webkitdirectory', ''); }, []);
  const escolher = (lista: FileList | null) => {
    setEscolhidos([...(lista ?? [])].map((f) => ({ arquivo: f, caminho: f.webkitRelativePath || f.name })));
    setAviso(null);
  };
  const subir = () => iniciar(async () => {
    const fd = new FormData();
    for (const e of escolhidos) fd.append('arquivos', e.arquivo, e.caminho);
    fd.append('tipo', tipo ?? '');
    const r = await subirSkill(slug, fd);
    if (r.ok) {
      toast(r.nova ? `Skill ${r.titulo} subida (desligada).` : `Skill ${r.titulo}: versão ${r.versao}.`);
      setEscolhidos([]); setAviso(null); router.refresh();
      return;
    }
    setAviso('precisaTipo' in r ? `O SKILL.md de "${r.titulo}" não diz o tipo: escolha um abaixo e clique em Subir skill de novo.` : r.erro);
  });
  return (
    <section id="subir" aria-label="Subir skill" className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-border p-4 text-center text-sm"
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); escolher(e.dataTransfer.files); }}>
      <p className="flex items-center gap-2"><CloudUpload aria-hidden size={16} />Arraste aqui um <b>.zip</b> ou um <b>.md</b>, ou escolha uma <b>pasta</b>:</p>
      <div className="flex gap-2">
        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 font-bold">Escolher pasta
          <input ref={pasta} type="file" multiple className="sr-only" onChange={(e) => escolher(e.target.files)} /></label>
        <label className="cursor-pointer rounded-md border border-border px-3 py-1.5 font-bold">Escolher .zip ou .md
          <input type="file" accept=".zip,.md" className="sr-only" onChange={(e) => escolher(e.target.files)} /></label>
      </div>
      <div role="radiogroup" aria-label="Tipo da skill" className="flex flex-wrap justify-center gap-1">
        {[...TIPOS_SKILL].sort((a, b) => INFO_TIPO_SKILL[a].ordem - INFO_TIPO_SKILL[b].ordem).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => setTipo(tipo === t ? null : t)}
            className={cn('rounded-md border px-3 py-1 text-xs font-bold uppercase', tipo === t ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-surface')}>
            {INFO_TIPO_SKILL[t].rotulo}
          </button>
        ))}
      </div>
      {escolhidos.length > 0 && <p className="text-muted">{escolhidos.length === 1 ? escolhidos[0]!.caminho : `${escolhidos.length} arquivos escolhidos`}</p>}
      {aviso && <p role="alert" className="text-danger">{aviso}</p>}
      <Button onClick={subir} disabled={!escolhidos.length || enviando}>Subir skill</Button>
      <p className="text-xs text-muted">Mesmo formato das skills do Claude (SKILL.md + referências); o tipo vai no cabeçalho do arquivo (<code>tipo: limites</code>). Referências: .md, .txt ou .csv.</p>
    </section>
  );
}
```

`skills/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { LockKeyhole, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { lerAgente, lerMudancas, lerSkills, lerUsoSkills, souDono } from '@/lib/agentes';
import { lerPeriodo } from '@/lib/gastos';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { OrdemPrioridade, ResumoFerramentas, UltimasMudancas } from '../coluna-lateral';
import { ListaSkills } from './lista-skills';
import { SubirSkill } from './subir-skill';

/** Aba Skills (spec 7E.3): os 5 tipos, subir, versões e liga/desliga (só o dono); à direita, prioridade, ferramentas e mudanças. */
export default async function Skills({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  if (semMigracao) return null;
  const mes = lerPeriodo({}, new Date());
  const [skills, uso, mudancas] = await Promise.all([lerSkills(sb, agente.id), lerUsoSkills(sb, slug, mes.de, mes.ate), lerMudancas(sb, agente.id, 5)]);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="flex flex-col gap-4 p-4 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand">Skills do {agente.nome}
            <Badge variant="brand" className="normal-case"><LockKeyhole aria-hidden />só o dono</Badge></h2>
          {dono && <a href="#subir" className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-bold uppercase text-brand-foreground"><Upload aria-hidden size={14} />Subir skill</a>}
        </div>
        <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-muted">Organizadas por <b>tipo</b>. O tipo diz <b>quando</b> o agente lê: umas sempre, outras só quando a tarefa ou o assunto aparece.</p>
        <ListaSkills slug={agente.slug} porta={agente.portaDeEntrada} skills={skills} uso={Object.fromEntries(uso)} dono={dono} />
        {dono && <SubirSkill slug={agente.slug} />}
      </Card>
      <div className="flex flex-col gap-4">
        <OrdemPrioridade />
        <ResumoFerramentas agente={agente} />
        <UltimasMudancas mudancas={mudancas} />
      </div>
    </div>
  );
}
```

- [ ] **Passo 4: typecheck, testes e as regras de estilo**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/[slug]/skills/uso.test.ts" && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo passa.

- [ ] **Passo 5: conferir à mão** (banco local, `next dev -p 3107`, dono): subir um `.md` sem tipo → aviso para escolher; escolher Limites → "subida (desligada)"; ligar; subir de novo com outro texto → "versão 2"; Versões mostra a diferença; Restaurar a v1 → "versão 3". Desligue o `next dev`.

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/app/\(painel\)/agentes/\[slug\]/skills
git commit -m "$(cat <<'EOF'
feat(painel): aba Skills (5 tipos com quando o agente lê, subir pasta/.zip/.md, versões com diferença e restaurar, liga/desliga e arquivar)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: Painel. Testar, Atividade e custo, e "Por agente" em Gastos com IA

**Files:**
- Modify: `apps/painel/src/app/(painel)/treinar-agente/simulacao.ts`, `acoes.ts`, `simulador.tsx`
- Create em `agentes/[slug]/`: `testar/page.tsx`, `testar/testar-skill.tsx`, `atividade/page.tsx`, `atividade/resumo.ts`, `atividade/resumo.test.ts`
- Modify: `apps/painel/src/app/(painel)/gastos-ia/page.tsx`; Create: `gastos-ia/por-agente.tsx`

**Interfaces:**
- Consumes: Tasks 3, 4, 10, 12; `Simulador`, `PedidoTeste`, `testarAgente`, `opcaoEmpresa`, `lerEmPaginas`, `lerPeriodo`, `percentual`.
- Produces: `PedidoTeste.skillId?: string | null`; `Simulador` com `skillId?: string | null`; `resumirAtividade(linhas) → { atendimentos; resolvidos; passagens; custoUsd; custoTestesUsd; sozinho: number | null }`; `PorAgente({ linhas })`.

- [ ] **Passo 1: teste que falha**

`atividade/resumo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resumirAtividade } from './resumo';

describe('Atividade e custo (D18)', () => {
  it('soma os dias; passagens = atendimentos − resolvidos; % sozinho', () => {
    expect(resumirAtividade([
      { dia: '2026-10-01', atendimentos: 1, resolvidos: 1, custo_usd: 0.6, custo_testes_usd: 0 },
      { dia: '2026-10-02', atendimentos: 3, resolvidos: 2, custo_usd: '0.3', custo_testes_usd: '0.1' },
    ])).toEqual({ atendimentos: 4, resolvidos: 3, passagens: 1, custoUsd: 0.9, custoTestesUsd: 0.1, sozinho: 75 });
    expect(resumirAtividade([])).toEqual({ atendimentos: 0, resolvidos: 0, passagens: 0, custoUsd: 0, custoTestesUsd: 0, sozinho: null });
  });
});
```

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/[slug]/atividade/resumo.test.ts"`
Expected: FAIL.

- [ ] **Passo 2: o teste com uma skill**

1. `treinar-agente/simulacao.ts`, em `PedidoTeste`, depois de `rascunho`: `skillId: z.string().nullish().refine((v) => !v || ehUuid(v), 'Skill não encontrada.'),` (sem ela, o pedido é o de hoje).
2. `treinar-agente/acoes.ts`, em `testarAgente`: troque `const { mensagem, clienteId, rascunho } = pedido.data;` e a chamada:

```ts
    const { mensagem, clienteId, rascunho, skillId } = pedido.data;
    // Teste com uma skill (aba Testar, D21): só o dono; o banco confere. Sem ela, o teste de sempre.
    const { data: id, error } = skillId
      ? await sb.rpc('criar_simulacao_skill', { p_skill: skillId, p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined })
      : await sb.rpc('criar_simulacao', { p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined, p_rascunho: rascunho ?? undefined });
```

3. `treinar-agente/simulador.tsx`: nova prop `skillId = null` (`skillId?: string | null` no tipo das props de `Simulador`) e, onde o componente monta o pedido para `pedirTeste({ mensagem, clienteId, rascunho … })` (inclusive o do "Sem o rascunho"), acrescente `skillId`.

- [ ] **Passo 3: as abas Testar e Atividade e custo**

`testar/testar-skill.tsx`:

```tsx
'use client';
import { useRouter } from 'next/navigation';
import type { SkillTela } from '@/lib/agentes';

/** Escolha da skill do teste (D21): até as desligadas ("rascunho"), só para o dono. */
export function TestarSkill({ slug, skills, atual }: { slug: string; skills: SkillTela[]; atual: string | null }) {
  const router = useRouter();
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">Testar com a skill
      <select value={atual ?? ''} onChange={(e) => router.push(`/agentes/${slug}/testar${e.target.value ? `?skill=${e.target.value}` : ''}`)}
        className="h-9 rounded-md border border-input bg-surface px-2 text-sm font-normal">
        <option value="">Só as ligadas (como o Thiago está agora)</option>
        {skills.map((s) => <option key={s.id} value={s.id}>{s.titulo}{s.ativo ? '' : ' (desligada)'}</option>)}
      </select>
    </label>
  );
}
```

`testar/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { FlaskConical } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { lerAgente, lerSkills, souDono } from '@/lib/agentes';
import { lerEmPaginas } from '@/lib/paginas';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { AVISO_EMPRESAS_INCOMPLETAS, opcaoEmpresa } from '../../../treinar-agente/esquemas';
import { Simulador } from '../../../treinar-agente/simulador';
import { SemPermissao } from '../../../treinar-agente/tela-orientacoes';
import { TestarSkill } from './testar-skill';

/** Aba Testar (spec 7E.1, 7C.5, D21): o simulador sem rascunho; o dono pode incluir uma skill (mesmo desligada). */
export default async function Testar({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ParamsBusca> }) {
  const [{ slug }, busca, u] = await Promise.all([params, searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  if (!agente.portaDeEntrada) return <EmptyState icone={FlaskConical} titulo="O teste deste agente chega quando ele começar a atender (próxima etapa)." />;
  if (!temNivel(u, 'treinar', 'sim') && !dono) return <SemPermissao />;
  const skills = dono && !semMigracao ? await lerSkills(sb, agente.id) : [];
  const skill = skills.find((s) => s.id === valorParam(busca, 'skill')) ?? null;
  const empresas = await lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').eq('ativo', true)
    .order('razao_social').order('id').range(de, ate));
  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border lg:altura-trabalho lg:flex-row">
      <section aria-label="Sobre o teste" className="flex flex-col gap-3 bg-surface p-4 lg:flex-1">
        <p className="text-sm">Escreva como cliente e veja a resposta e o que o agente faria. Nada é enviado nem gravado; o custo conta em Gastos com IA como "Testar o agente".</p>
        {dono && skills.length > 0 && <TestarSkill slug={agente.slug} skills={skills} atual={skill?.id ?? null} />}
        {skill && <p className="text-sm">Testando com a skill <b>{skill.titulo}</b>{skill.ativo ? '' : ' (desligada)'}.</p>}
      </section>
      <Simulador key={skill?.id ?? 'sem-skill'} aberta={null} idOrientacao={null} salva={null} empresas={empresas.data.map(opcaoEmpresa)}
        avisoEmpresas={empresas.error || empresas.parcial ? AVISO_EMPRESAS_INCOMPLETAS : null} skillId={skill?.id ?? null} />
    </div>
  );
}
```

`atividade/resumo.ts`:

```ts
import { percentual } from '@/lib/gastos';

export type LinhaAtividade = { dia: string; atendimentos: number | string; resolvidos: number | string; custo_usd: number | string; custo_testes_usd: number | string };

export function resumirAtividade(linhas: LinhaAtividade[]) {
  const soma = (f: (l: LinhaAtividade) => number | string) => linhas.reduce((s, l) => s + (Number(f(l)) || 0), 0);
  const atendimentos = soma((l) => l.atendimentos);
  const resolvidos = soma((l) => l.resolvidos);
  return {
    atendimentos, resolvidos, passagens: atendimentos - resolvidos,
    custoUsd: Math.round(soma((l) => l.custo_usd) * 1e6) / 1e6, custoTestesUsd: Math.round(soma((l) => l.custo_testes_usd) * 1e6) / 1e6,
    sozinho: atendimentos ? percentual(resolvidos, atendimentos) : null,
  };
}
```

`atividade/page.tsx`:

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { Card } from '@/components/ui/card';
import { acessoAosAgentes, lerAgente, semMigracaoI1, souDono } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarUSD } from '@/lib/formatos';
import { lerPeriodo } from '@/lib/gastos';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { resumirAtividade, type LinhaAtividade } from './resumo';

const PERIODOS = [{ p: 'mes', rotulo: 'Este mês' }, { p: 'mes-passado', rotulo: 'Mês passado' }, { p: '7d', rotulo: '7 dias' }] as const;

/** Atividade e custo (spec 7E.3, D18): por dia, atendimentos, sozinho, passagens e custo — só dono e administrador. */
export default async function Atividade({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ParamsBusca> }) {
  const [{ slug }, busca, u] = await Promise.all([params, searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  if (!acessoAosAgentes(u, dono).numeros) return <EmptyState icone={BarChart3} titulo="Só o dono e o administrador veem os números." />;
  if (semMigracao) return null;
  const periodo = lerPeriodo({ p: valorParam(busca, 'p') }, new Date());
  const { data, error } = await sb.rpc('atividade_do_agente', { p_slug: slug, p_de: periodo.de, p_ate: periodo.ate });
  if (error && !semMigracaoI1(error)) console.error('[agentes] atividade', error);
  const linhas = (data ?? []) as LinhaAtividade[];
  const r = resumirAtividade(linhas);
  const cartao = (rotulo: string, valor: string) => (
    <Card className="flex flex-col gap-1 p-4"><span className="text-xs font-bold uppercase tracking-wide text-muted">{rotulo}</span><span className="tabular text-2xl font-extrabold">{valor}</span></Card>
  );
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Período" className="flex gap-2">
        {PERIODOS.map((x) => (
          <Link key={x.p} href={`/agentes/${slug}/atividade?p=${x.p}`} aria-current={periodo.filtro === x.p ? 'page' : undefined}
            className={cn('inline-flex h-9 items-center rounded-md border px-3 text-sm font-bold', periodo.filtro === x.p ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-border bg-surface')}>{x.rotulo}</Link>
        ))}
      </nav>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cartao('Atendimentos', String(r.atendimentos))}
        {cartao('Resolvidos sozinho', r.sozinho === null ? '—' : `${r.sozinho}%`)}
        {cartao('Passaram para pessoa', String(r.passagens))}
        {cartao('Custo', formatarUSD(r.custoUsd + r.custoTestesUsd))}
      </div>
      <Card className="p-4">
        {linhas.length === 0 ? <EmptyState icone={BarChart3} titulo={`Nada neste período (${periodo.rotulo}).`} className="py-6" /> : (
          <table className="w-full text-sm">
            <caption className="sr-only">Atividade por dia</caption>
            <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-2">Dia</th><th>Atendimentos</th><th>Sozinho</th><th>Passaram para pessoa</th><th className="text-right">Custo</th><th className="text-right">Testes</th></tr></thead>
            <tbody className="divide-y divide-border">
              {linhas.map((l) => (
                <tr key={l.dia}>
                  {/* dia vem como AAAA-MM-DD (Brasília): formatarData leria como UTC e voltaria um dia. */}
                  <td className="tabular py-2">{`${l.dia.slice(8, 10)}/${l.dia.slice(5, 7)}`}</td><td className="tabular">{Number(l.atendimentos)}</td><td className="tabular">{Number(l.resolvidos)}</td>
                  <td className="tabular">{Number(l.atendimentos) - Number(l.resolvidos)}</td>
                  <td className="tabular text-right">{formatarUSD(Number(l.custo_usd))}</td><td className="tabular text-right text-muted">{formatarUSD(Number(l.custo_testes_usd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-sm text-muted">Tarefas de trabalho: chegam numa próxima etapa.{u.papel === 'admin' && <> Todos os gastos em <Link href="/gastos-ia" className="font-bold text-brand">Gastos com IA</Link>.</>}</p>
    </div>
  );
}
```


- [ ] **Passo 4: "Por agente" em Gastos com IA**

`gastos-ia/por-agente.tsx`:

```tsx
import Link from 'next/link';
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { Card } from '@/components/ui/card';
import { formatarNumero, formatarUSD } from '@/lib/formatos';
import { percentual } from '@/lib/gastos';

export type LinhaPorAgente = { agente_id: string; slug: string; nome: string; custo_usd: number | string; chamadas: number | string };

/** Gastos por agente (spec 7E.8, D17). `null`: banco sem a Parte I — o bloco não aparece. */
export function PorAgente({ linhas }: { linhas: LinhaPorAgente[] | null }) {
  if (linhas === null) return null;
  const itens = linhas.map((l) => ({ ...l, custo: Number(l.custo_usd) || 0, n: Number(l.chamadas) || 0 }));
  const total = itens.reduce((s, i) => s + i.custo, 0);
  const maior = Math.max(0, ...itens.map((i) => i.custo));
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Por agente</h2>
        <span className="text-sm text-subtle">custo · % · chamadas</span>
      </div>
      {itens.length === 0 ? <EmptyState icone={Bot} titulo="Nenhum gasto de agente neste período." className="py-6" /> : (
        <table className="w-full text-base">
          <caption className="sr-only">Gasto por agente</caption>
          <thead className="sr-only"><tr><th scope="col">Agente</th><th scope="col">Proporção</th><th scope="col">Custo</th><th scope="col">%</th><th scope="col">Chamadas</th></tr></thead>
          <tbody className="divide-y divide-border">
            {itens.map((i) => (
              <tr key={i.agente_id} data-testid={`gastos-agente-${i.slug}`}>
                <th scope="row" className="py-2 pr-3 text-left font-semibold"><Link href={`/agentes/${i.slug}/atividade`} className="text-foreground hover:text-brand">{i.nome}</Link></th>
                <td className="w-1/4 py-2 pr-3"><div aria-hidden className="h-3"><div className="h-full min-w-0.5 rounded-sm bg-gasto-agente" style={{ width: `${maior > 0 ? (i.custo / maior) * 100 : 0}%` }} /></div></td>
                <td className="tabular whitespace-nowrap py-2 pr-3 text-right">{formatarUSD(i.custo)}</td>
                <td className="tabular py-2 pr-3 text-right text-muted">{percentual(i.custo, total)}%</td>
                <td className="tabular py-2 text-right text-muted">{formatarNumero(i.n, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
```

Em `gastos-ia/page.tsx`: acrescente `sb.rpc('gastos_por_agente', intervalo)` no fim do `Promise.all` e `porAgente` no fim da desestruturação; importe `PorAgente`; depois do bloco que tem `<PorFuncionalidade … />` e `<PorDia … />`, antes de `<RankingEquipe … />`: `<PorAgente linhas={porAgente.error ? null : porAgente.data ?? []} />` (erro de função ausente = banco sem a Parte I: some; outro erro também some, e vai para o log: `if (porAgente.error && !semMigracaoI1(porAgente.error)) console.error('[gastos] por agente', porAgente.error);`).

- [ ] **Passo 5: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel exec vitest run "src/app/(painel)/agentes/[slug]/atividade/resumo.test.ts" && pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: tudo passa (inclusive `treinar-agente/simulacao.test.ts` e `acoes.test.ts`: o pedido sem `skillId` é o de hoje).

- [ ] **Passo 6: commit**

```bash
git add apps/painel/src/app/\(painel\)/treinar-agente/simulacao.ts apps/painel/src/app/\(painel\)/treinar-agente/acoes.ts apps/painel/src/app/\(painel\)/treinar-agente/simulador.tsx apps/painel/src/app/\(painel\)/agentes/\[slug\]/testar apps/painel/src/app/\(painel\)/agentes/\[slug\]/atividade apps/painel/src/app/\(painel\)/gastos-ia/page.tsx apps/painel/src/app/\(painel\)/gastos-ia/por-agente.tsx
git commit -m "$(cat <<'EOF'
feat(painel): abas Testar (com skill, mesmo desligada) e Atividade e custo; Gastos com IA ganha "Por agente"

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: E2e (agentes, ficha, skills, orientações e gastos) e as adaptações dos antigos

**Files:**
- Create: `apps/painel/e2e/apoio-agentes.ts`, `e2e/agentes-lista.spec.ts`, `e2e/agente-ficha.spec.ts`, `e2e/agente-skills.spec.ts`, `e2e/agente-orientacoes.spec.ts`
- Modify: `apps/painel/e2e/treinar-agente.spec.ts` (linhas 45 e 159), `apps/painel/e2e/ensinar-agente.spec.ts` (linhas 106, 112, 113) — D22

**Interfaces:**
- Consumes: tudo acima; `criarUsuarioTeste`, `entrar`, `db` (`e2e/apoio.ts`); `esperarTreinar`, `lista`, `editor`, `simulador` (`e2e/apoio-treinar.ts`); `limparBanco`, `marcarDonoTeste` (`@escritorio/db/teste`).
- Produces: `apoio-agentes.ts`: `SENHA`, `criarDono(email?, nome?) → id`, `abrirAgente(page, slug, aba?)`, `skillNoBanco(slug, s) → id`.

- [ ] **Passo 1: apoio**

`apps/painel/e2e/apoio-agentes.ts`:

```ts
import type { Page } from '@playwright/test';
import { marcarDonoTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, db } from './apoio';

export const SENHA = 'Senha-e2e-agentes-1';

/** Administrador marcado como dono pelo SQL (a API não muda a marcação, D11). */
export async function criarDono(email = 'dono@agentes.local', nome = 'Thiago Dono'): Promise<string> {
  const id = await criarUsuarioTeste({ email, senha: SENHA, nome, papel: 'admin' });
  await marcarDonoTeste(id);
  return id;
}

export async function abrirAgente(page: Page, slug: string, aba = ''): Promise<void> {
  await page.goto(`/agentes/${slug}${aba ? `/${aba}` : ''}`);
}

/** Skill direto no banco (como se o dono tivesse subido), versão 1. */
export async function skillNoBanco(slug: string, s: { nome: string; tipo: string; titulo: string; corpo: string; ativo?: boolean }): Promise<string> {
  const { data: a } = await db.from('agentes').select('id').eq('slug', slug).single();
  const { data: skill } = await db.from('agente_skills').insert({ agente_id: a!.id, nome: s.nome, tipo: s.tipo, ativo: s.ativo ?? false }).select('id').single();
  await db.from('agente_skill_versoes').insert({ skill_id: skill!.id, versao: 1, titulo: s.titulo, descricao: `Quando ${s.nome}.`, tipo: s.tipo, corpo: s.corpo,
    skill_md: `---\nname: ${s.nome}\ndescription: Quando ${s.nome}.\ntipo: ${s.tipo}\n---\n${s.corpo}` });
  return skill!.id;
}
```

- [ ] **Passo 2: e2e da tela Agentes**

`apps/painel/e2e/agentes-lista.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, criarDono } from './apoio-agentes';

// Parte I1 (spec 7E.2, D12, D25): tela Agentes.
test.beforeEach(async () => { await limparBanco(); });

test('dono vê os 7 agentes, filtra, busca e cria um agente desligado', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.getByRole('link', { name: 'Agentes' }).click();
  await expect(page).toHaveURL(/\/agentes$/);
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(7);
  const thiago = page.getByTestId('agente-atendimento');
  await expect(thiago).toContainText('Ligado');
  await expect(thiago).toContainText('Direto, é a voz do escritório');
  await expect(page.getByText('Só você altera skills, ferramentas e modo de contato.')).toBeVisible();
  await page.getByRole('link', { name: /Desligados\s*6/ }).click();
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(6);
  await page.getByLabel('Buscar agente').fill('legislacao');
  await page.getByLabel('Buscar agente').press('Enter');
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(1);
  await page.goto('/agentes');
  await page.getByRole('button', { name: 'Novo agente' }).click();
  await page.getByLabel('Nome').fill('Agente do IRPF');
  await page.getByRole('button', { name: 'Criar agente' }).click();
  await expect(page).toHaveURL(/\/agentes\/agente-do-irpf$/);
  const { data } = await db.from('agentes').select('estado, modo_contato, ferramentas').eq('slug', 'agente-do-irpf').single();
  expect(data).toEqual({ estado: 'desligado', modo_contato: null, ferramentas: [] });
});

test('quem treina vê os agentes sem números nem + NOVO AGENTE; sem a marcação, nem o menu', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana@agentes.local', senha: SENHA, nome: 'Ana Treina', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'ze@agentes.local', senha: SENHA, nome: 'Zé Sem', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana@agentes.local', SENHA);
  await page.getByRole('link', { name: 'Agentes' }).click();
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'Novo agente' })).toHaveCount(0);
  await expect(page.getByText('Conversas', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Só o dono altera skills, ferramentas e modo de contato.')).toBeVisible();
  await page.context().clearCookies();
  await entrar(page, 'ze@agentes.local', SENHA);
  await expect(page.getByRole('link', { name: 'Agentes' })).toHaveCount(0);
  await page.goto('/agentes');
  await expect(page.getByText('Você não tem acesso a esta tela.')).toBeVisible();
});
```

- [ ] **Passo 3: e2e da ficha**

`apps/painel/e2e/agente-ficha.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono } from './apoio-agentes';

// Parte I1 (spec 7E.3, D13, D14, D15, D28, D29): ficha do agente.
test.beforeEach(async () => { await limparBanco(); });
const fiscal = async () => (await db.from('agentes').select('id, estado, modo_contato, ferramentas').eq('slug', 'fiscal').single()).data!;

test('dono põe o Fiscal em Teste com um contato, escolhe o modo, cria uma regra e libera uma ferramenta', async ({ page }) => {
  await criarDono();
  await db.from('contatos').insert({ nome: 'Carla Teste', telefone: '5531977771111' });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal');
  await expect(page.getByText('Nesta etapa só o Thiago atende.')).toBeVisible();
  await page.getByRole('group', { name: 'Estado do agente' }).getByRole('button', { name: 'Teste' }).click();
  await page.getByPlaceholder('Nome ou telefone').fill('Carla');
  await page.getByRole('list', { name: 'Contatos encontrados' }).getByRole('button', { name: /Carla Teste/ }).click();
  await expect.poll(async () => (await fiscal()).estado).toBe('teste');
  await expect(page.getByText('Em teste:')).toBeVisible();
  await page.getByRole('navigation', { name: 'Seções do agente' }).getByRole('link', { name: 'Como fala com o cliente' }).click();
  await page.getByRole('radio', { name: 'Mesma voz' }).check();
  await expect.poll(async () => (await fiscal()).modo_contato).toBe('mesma_voz');
  await page.getByRole('button', { name: 'Nova regra' }).click();
  await page.getByLabel('Quando o assunto for').fill('Dúvida sobre imposto');
  await page.getByRole('combobox', { name: 'Modo' }).selectOption('passa_conversa');
  await page.getByRole('button', { name: 'Salvar regra' }).click();
  await expect(page.getByRole('cell', { name: 'Dúvida sobre imposto' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Seções do agente' }).getByRole('link', { name: /Ferramentas/ }).click();
  await page.getByLabel(/Ler demandas da empresa/).check();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await fiscal()).ferramentas).toEqual(['consultar_chamados']);
  await page.getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByText('Estado: Desligado → Teste')).toBeVisible();
});

test('o Thiago fica travado (Ligado, mesma voz, ferramentas fixas); o modelo o dono escolhe', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento');
  const estado = page.getByRole('group', { name: 'Estado do agente' });
  await expect(estado.getByRole('button', { name: 'Desligado' })).toBeDisabled();
  await expect(estado.getByRole('button', { name: 'Ligado' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('O Thiago fica sempre ligado. Para parar o atendimento, use PAUSAR no Início.')).toBeVisible();
  await page.getByLabel('Modelo de IA').selectOption('claude-haiku-4-5');
  await expect.poll(async () => (await db.from('agentes').select('modelo').eq('slug', 'atendimento').single()).data!.modelo).toBe('claude-haiku-4-5');
  await abrirAgente(page, 'atendimento', 'ferramentas');
  await expect(page.getByRole('checkbox')).toHaveCount(16);
  for (const c of await page.getByRole('checkbox').all()) await expect(c).toBeDisabled();
  await abrirAgente(page, 'atendimento', 'como-fala');
  await expect(page.getByText('Direto, é a voz do escritório')).toBeVisible();
});

test('administrador que não é dono vê a ficha, mas não muda', async ({ page }) => {
  await criarDono();
  await criarUsuarioTeste({ email: 'admin2@agentes.local', senha: SENHA, nome: 'Outro Admin', papel: 'admin' });
  await entrar(page, 'admin2@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal');
  await expect(page.getByRole('group', { name: 'Estado do agente' }).getByRole('button', { name: 'Ligado' })).toBeDisabled();
  await abrirAgente(page, 'fiscal', 'ferramentas');
  await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
});
```

- [ ] **Passo 4: e2e das skills**

`apps/painel/e2e/agente-skills.spec.ts`:

```ts
import { strToU8, zipSync } from 'fflate';
import { expect, test } from '@playwright/test';
import { limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono } from './apoio-agentes';

// Parte I1 (spec 7E.3, D7–D10): subir, ligar, versões e restaurar; só o dono.
test.beforeEach(async () => { await limparBanco(); });
const md = (texto: string, tipo = '') => `---\nname: nunca-prometer-prazo\ndescription: O que nunca prometer.${tipo ? `\ntipo: ${tipo}` : ''}\n---\n# Nunca promete prazo\n${texto}`;
const arquivo = (name: string, conteudo: string | Uint8Array) => ({ name, mimeType: 'application/octet-stream', buffer: Buffer.from(conteudo) });
const skill = async () => (await db.from('agente_skills').select('ativo, versao_atual').eq('nome', 'nunca-prometer-prazo').single()).data;

test('.md sem tipo: escolhe Limites, liga, sobe versão 2, vê a diferença e restaura', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'skills');
  const subir = page.getByRole('region', { name: 'Subir skill' });
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('limite.md', md('Nunca prometa prazo de emissão.')));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(subir.getByRole('alert')).toContainText('não diz o tipo');
  await subir.getByRole('radio', { name: 'Limites' }).click();
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(page.getByText('Skill Nunca promete prazo subida (desligada).')).toBeVisible();
  await page.getByRole('switch', { name: 'Ligar Nunca promete prazo' }).click();
  await expect.poll(async () => (await skill())!.ativo).toBe(true);
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('limite.md', md('Nunca prometa prazo nenhum.', 'limites')));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(page.getByText('Skill Nunca promete prazo: versão 2.')).toBeVisible();
  await page.getByRole('button', { name: 'Versões de Nunca promete prazo' }).click();
  const diferenca = page.getByRole('region', { name: 'Diferença da versão 2' });
  await expect(diferenca).toContainText('Removido: Nunca prometa prazo de emissão.');
  await expect(diferenca).toContainText('Adicionado: Nunca prometa prazo nenhum.');
  await page.getByRole('button', { name: /^v1/ }).click();
  await page.getByRole('button', { name: 'Restaurar a versão 1' }).click();
  await expect.poll(async () => (await skill())!.versao_atual).toBe(3);
});

test('.zip com pasta e referência; PDF recusado', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'skills');
  const subir = page.getByRole('region', { name: 'Subir skill' });
  const cfop = '---\nname: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento\n---\n# Tabela CFOP\nVeja cfop.csv.';
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('cfop.zip', zipSync({ 'tabela-cfop/SKILL.md': strToU8(cfop), 'tabela-cfop/cfop.csv': strToU8('5102;Venda') })));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(page.getByRole('list', { name: 'Arquivos de Tabela CFOP' })).toContainText('cfop.csv');
  await subir.getByLabel('Escolher .zip ou .md').setInputFiles(arquivo('pdf.zip', zipSync({ 'SKILL.md': strToU8(cfop), 'guia.pdf': strToU8('%PDF') })));
  await subir.getByRole('button', { name: 'Subir skill' }).click();
  await expect(subir.getByRole('alert')).toHaveText('PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho).');
});

test('quem treina vê as skills, mas não sobe nem liga', async ({ page }) => {
  await criarDono();
  await criarUsuarioTeste({ email: 'ana@agentes.local', senha: SENHA, nome: 'Ana Treina', papel: 'atendente', permissoes: ['treinar_agente'] });
  const { data: a } = await db.from('agentes').select('id').eq('slug', 'atendimento').single();
  const { data: s } = await db.from('agente_skills').insert({ agente_id: a!.id, nome: 'tom', tipo: 'jeito', ativo: true }).select('id').single();
  await db.from('agente_skill_versoes').insert({ skill_id: s!.id, versao: 1, titulo: 'Tom do escritório', descricao: 'Tom.', tipo: 'jeito', corpo: 'Curto.', skill_md: '---' });
  await entrar(page, 'ana@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'skills');
  await expect(page.getByText('Tom do escritório')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Ligar Tom do escritório' })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Subir skill' })).toHaveCount(0);
});
```

- [ ] **Passo 5: e2e das orientações, do teste e dos gastos**

`apps/painel/e2e/agente-orientacoes.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono, skillNoBanco } from './apoio-agentes';
import { editor, esperarTreinar, lista, simulador } from './apoio-treinar';

// Parte I1 (spec 7E.1, D12, D16–D18, D20–D22).
test.beforeEach(async () => { await limparBanco(); });

test('/treinar-agente leva à aba Orientações do Thiago, com a mesma tela', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.goto('/treinar-agente?orientacao=nova');
  await expect(page).toHaveURL(/\/agentes\/atendimento\/orientacoes\?orientacao=nova$/);
  await esperarTreinar(page);
  await expect(lista(page)).toBeVisible();
  await expect(simulador(page)).toBeVisible();
  await editor(page).getByLabel('Título').fill('Cumprimento');
  await editor(page).getByRole('radio', { name: /Jeito de atender/ }).locator('xpath=..').check();
  await editor(page).getByLabel('O que o agente deve fazer').fill('Chame o cliente pelo primeiro nome.');
  await editor(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(page).toHaveURL(/\/agentes\/atendimento\/orientacoes\?orientacao=[0-9a-f-]{36}$/);
  const { data } = await db.from('orientacoes_agente').select('agente_id').eq('titulo', 'Cumprimento').single();
  expect(data!.agente_id).toBe('a0000000-0000-4000-8000-000000000001');
});

test('orientações do Fiscal: Ana (Fiscal) escreve, sem simulador; Paula (Pessoal) não', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana@agentes.local', senha: SENHA, nome: 'Ana Fiscal', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'paula@agentes.local', senha: SENHA, nome: 'Paula Pessoal', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Pessoal'] });
  await entrar(page, 'ana@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'orientacoes?orientacao=nova');
  await esperarTreinar(page);
  await expect(page.getByText('O teste deste agente chega quando ele começar a atender (próxima etapa).')).toBeVisible();
  await editor(page).getByLabel('Título').fill('Prazo');
  await editor(page).getByRole('radio', { name: /Regra do escritório/ }).locator('xpath=..').check();
  await editor(page).getByLabel('O que o agente deve fazer').fill('Notas até as 16h.');
  await editor(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(page).toHaveURL(/\/agentes\/fiscal\/orientacoes\?orientacao=/);
  const { data } = await db.from('orientacoes_agente').select('agentes(slug)').eq('titulo', 'Prazo').single();
  expect(data!.agentes).toEqual({ slug: 'fiscal' });
  await page.context().clearCookies();
  await entrar(page, 'paula@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'orientacoes');
  await expect(page.getByText('Só quem tem "Treinar o agente" e é do setor Fiscal muda estas orientações.')).toBeVisible();
});

test('Testar com uma skill desligada (dono)', async ({ page }) => {
  await criarDono();
  const id = await skillNoBanco('atendimento', { nome: 'tabela-cfop', tipo: 'conhecimento', titulo: 'Tabela CFOP', corpo: 'Venda: 5102.' });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', `testar?skill=${id}`);
  await expect(page.getByText('Testando com a skill')).toContainText('Tabela CFOP (desligada)');
  await expect(simulador(page)).toBeVisible();
});

test('Atividade e custo e "Por agente" em Gastos com IA', async ({ page }) => {
  await criarDono();
  const { data: conversa } = await db.from('conversas').insert({ telefone: '5531966661234' }).select('id').single();
  await db.from('uso_ia').insert({ funcionalidade: 'agente_clientes', agente_id: 'a0000000-0000-4000-8000-000000000001', conversa_id: conversa!.id,
    modelo: 'claude-sonnet-5', tokens_entrada: 1, tokens_saida: 1, custo_usd: 0.25 });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'atividade');
  await expect(page.getByRole('table', { name: 'Atividade por dia' })).toBeVisible();
  await page.goto('/gastos-ia');
  await expect(page.getByTestId('gastos-agente-atendimento')).toContainText('Thiago');
});
```

- [ ] **Passo 6: adaptar os e2e antigos (D22) — só estas linhas**

1. `e2e/treinar-agente.spec.ts`, linhas 45 e 159: cada `await page.getByRole('link', { name: 'Treinar o agente' }).click();` vira

```ts
  await page.getByRole('link', { name: 'Agentes' }).click();
  await page.getByRole('link', { name: 'Abrir Thiago' }).click();
  await page.getByRole('navigation', { name: 'Seções do agente' }).getByRole('link', { name: 'Orientações' }).click();
```

2. `e2e/ensinar-agente.spec.ts`, linhas 106 e 112: `'Abrir na tela Treinar o agente'` → `'Abrir nas orientações do Thiago'`; linha 113: `` new RegExp(`/treinar-agente\\?orientacao=${criada!.id}$`) `` → `` new RegExp(`/agentes/atendimento/orientacoes\\?orientacao=${criada!.id}$`) ``.

Nenhuma outra linha desses arquivos muda; as conferências no banco ficam iguais.

Run: `git diff BASE --stat -- apps/painel/e2e`
Expected: os 5 arquivos novos e os 2 adaptados; `git diff BASE -- apps/painel/e2e/treinar-agente.spec.ts apps/painel/e2e/ensinar-agente.spec.ts` = 2 linhas trocadas por 6 + 3 linhas trocadas.

- [ ] **Passo 7: rodar (lotes de até 4, `supabase db reset` antes do primeiro, nada mais rodando)**

Run (dentro de `apps/painel`): `pnpm exec playwright test e2e/agentes-lista.spec.ts e2e/agente-ficha.spec.ts e2e/agente-skills.spec.ts e2e/agente-orientacoes.spec.ts`
Expected: `12 passed`.

Run: `pnpm exec playwright test e2e/treinar-agente.spec.ts e2e/ensinar-agente.spec.ts e2e/treinar-simulador.spec.ts e2e/testar-agente.spec.ts`
Expected: todos passam (as rotas `/treinar-agente…` redirecionam; regiões, heading e textos de sempre).

Run: `pnpm exec playwright test e2e/acessibilidade.spec.ts e2e/menu.spec.ts e2e/gastos-ia.spec.ts e2e/niveis-telas.spec.ts`
Expected: todos passam (a ficha do agente sem violação grave nas rotas `/treinar-agente…`; Gastos com IA com o bloco novo).

- [ ] **Passo 8: commit**

```bash
git add apps/painel/e2e/apoio-agentes.ts apps/painel/e2e/agentes-lista.spec.ts apps/painel/e2e/agente-ficha.spec.ts apps/painel/e2e/agente-skills.spec.ts apps/painel/e2e/agente-orientacoes.spec.ts apps/painel/e2e/treinar-agente.spec.ts apps/painel/e2e/ensinar-agente.spec.ts
git commit -m "$(cat <<'EOF'
test(painel): e2e dos agentes (lista, ficha, skills, orientações por setor, teste com skill, atividade e gastos) e adaptação do caminho do Treinar o agente

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Manuais

**Files:**
- Modify: `docs/operacao.md`, `docs/design-system.md`

- [ ] **Passo 1: `docs/operacao.md`**

1. Em **3. Dia a dia**, nova subseção depois de "Acesso por contato":

```markdown
### Agentes (menu Agentes)

Um agente por departamento, mais o Radar de legislação. **Nesta etapa só o Thiago atende**; os outros guardam a configuração para quando o Thiago começar a chamá-los.

- **Quem mexe:** skills, ferramentas, estado, modelo, modo de falar com o cliente e regras por assunto, **só o dono**. Orientações: quem tem "Treinar o agente" (do Thiago) ou "Treinar o agente" e é do setor do agente (dos outros). Os números e custos do mês: dono e administrador.
- **O Thiago** fica sempre **Ligado** e é a voz do escritório. Para parar o atendimento, use **PAUSAR** no Início. O modelo dele o dono pode trocar na ficha (vazio = o de Configurações).
- **Skills** (aba Skills): no formato das skills do Claude — uma pasta com `SKILL.md` (cabeçalho `name`, `description` e `tipo`) e arquivos de apoio `.md`, `.txt` ou `.csv` (PDF ainda não). Suba a pasta, um `.zip` ou um `.md`; sem `tipo` no cabeçalho, escolha na tela. Toda skill nova nasce **desligada**: teste (botão ▷ ou aba Testar) e ligue. **Jeito de atuar** e **Limites** entram em toda conversa (somados até 10.000 caracteres); **Procedimentos**, **Conhecimento** e **Exemplos** o agente só lê quando o assunto aparece. Quem vence em conflito: regras fixas › Limites › Jeito de atuar › Procedimentos › Orientações.
- **Versões:** subir de novo com o mesmo `name` cria a versão seguinte; **Versões** mostra o que mudou e **Restaurar** volta uma versão antiga (como versão nova). **Histórico** (no topo da ficha) lista toda mudança do agente.
- **Treinar o agente** virou as abas **Orientações** e **Testar** de cada agente (o endereço antigo continua levando para lá).
- **Custos:** cada chamada do agente grava o agente; **Gastos com IA** tem o bloco **Por agente** e cada ficha tem **Atividade e custo**.

**Quem é o dono.** A migração da Parte I marca como dono o administrador ativo mais antigo e avisa quem foi. Para trocar (no editor SQL do Supabase, nunca pela tela):

    update public.usuarios set dono = false where dono; update public.usuarios set dono = true where email = 'email-do-dono@exemplo.com';
```

2. Na seção **10. Treinar o agente**, primeira linha de "O que é": acrescente "Desde a Parte I, fica em **Agentes › Thiago › Orientações** (e Testar)."

3. Em **5. Segurança e LGPD**, nova linha: `- **Agentes:** a marcação de dono só muda por SQL (a API recusa até com a chave de serviço); skills e ferramentas só pelo dono, com cada versão e mudança registradas; o agente só lê skills ligadas dele.`

- [ ] **Passo 2: `docs/design-system.md`**

1. Depois do parágrafo **Acesso por contato** (H2):

```markdown
**Agentes** (I1, `app/(painel)/agentes`): cartões em grade com faixa de cor no topo pelo estado (Ligado `success`, Teste `warning`, Desligado `border`), estado em texto com ponto ("● Ligado"), contagens com ícone e números do mês em três colunas (só dono e administrador); marcadores tracejados para o que vem depois ("Tarefas de trabalho: chegam numa próxima etapa."). Ficha: cabeçalho com o seletor de estado (`role="group"` "Estado do agente", botões com `aria-pressed`), selo "só o dono" com cadeado (o cadeado nunca sozinho), caixas de Modelo/Custo/Conversas; abas como links (`aria-current`); faixas `info` ("Nesta etapa só o Thiago atende…") e `warning` (sem migração). Skills por tipo com o "quando o agente lê" num selo; Limites com fio `danger` à esquerda; diferença de versões com "+"/"−", cor e texto escondido "Adicionado:"/"Removido:". Ferramentas: "só leitura" `success`, "aprovação"/"o cliente confirma" `warning` com cadeado.
```

2. No **Vocabulário oficial**, nova linha: `- **Agentes:** "Agentes", "Agente", "Thiago", "Ligado", "Teste", "Desligado", "Em teste", "Por trás", "Mesma voz", "Passa a conversa", "Direto, é a voz do escritório", "Fala com o cliente", "a definir", "Skills", "Jeito de atuar", "Limites", "Procedimentos", "Conhecimento", "Exemplos", "sempre lido", "Subir skill", "Versões", "Restaurar a versão N", "Ferramentas", "só leitura", "aprovação", "Como fala com o cliente", "Regras por assunto", "Nova regra", "Orientações", "Testar", "Atividade e custo", "Histórico", "só o dono", "Por agente".`

- [ ] **Passo 3: commit**

```bash
git add docs/design-system.md docs/operacao.md
git commit -m "$(cat <<'EOF'
docs: agentes por departamento (quem mexe, skills e versões, o Thiago travado, custos por agente, como trocar o dono por SQL)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx e **`supabase db reset`** antes da suíte pgTAP, antes do primeiro lote de e2e e antes dos cenários:
   - **o que não podia mudar não mudou:** `git diff BASE --stat -- apps/trabalhador/src/assistente apps/trabalhador/src/sugestao` **vazio**; `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff BASE --stat -- supabase/tests` só mostra `45`, `46` e `47` (novos); `git diff BASE --stat -- 'apps/**/*.test.ts' 'packages/**/*.test.ts'` só mostra arquivos **novos** e `apps/painel/src/lib/menu.test.ts` (3 linhas, D19); **`git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__` mostra só o commit da Task 1** (o pedido do Thiago não mudou); `git diff BASE --stat -- apps/painel/e2e` = 5 novos + os 2 da D22;
   - `supabase test db`: todos os arquivos com os números de cada um, inclusive `22` (100/100), `45` (44), `46` (36) e `47` (13);
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`;
   - `pnpm --filter @escritorio/trabalhador test` e `typecheck` (inclusive `retrato-thiago`, `motor-thiago`, `motor`, `ler-skill`);
   - `pnpm --filter @escritorio/painel test` e `typecheck`;
   - **e2e em lotes de até 4** (pouca memória; nada mais rodando além do Supabase local): os 3 lotes da Task 17; depois os demais arquivos de `ls apps/painel/e2e/*.spec.ts`, em lotes de até 4, na ordem alfabética (`supabase db reset` entre lotes se um pgTAP ou e2e reclamar de dados velhos). Some os números de todos os lotes;
   - **cenários com Claude de verdade** (D31; `supabase db reset` antes; nada mais rodando; anote o custo depois de cada um): `pnpm --filter @escritorio/trabalhador cenarios` (os 56 de antes + os 2 `motor:` = 58; ≈ US$ 11–15), `pnpm --filter @escritorio/trabalhador cenarios-atendimento` (6; ≈ US$ 1–2) e `pnpm --filter @escritorio/trabalhador cenarios-assistente` (4; ≈ US$ 1). Falha em cenário antigo: rode de novo **só ele** uma vez (o modelo varia); se falhar de novo, vira pendência com a saída inteira — e confira primeiro que os retratos não mudaram (se não mudaram, o pedido é o mesmo de antes e a falha é variação do modelo). Teto: US$ 30 no total da parte (some o da Task 9);
   - mostre os números exatos de cada suíte, de cada lote e de cada rodada de cenários (passaram, falharam, pulados) e o custo de cada rodada. Nada de "deve passar";
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-agentes-lista.png` e `00-agente-ficha.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local (`next dev -p 3107`, com o `.env` local do item 1; **nunca** o banco da homologação);
   - dados no banco **local**, montados **pela própria tela** (script Playwright temporário na pasta de rascunho, fora do repositório): dono marcado (`marcarDonoTeste`); o Fiscal em Teste com 2 contatos, modo Mesma voz, 3 regras por assunto (as da imagem), 4 ferramentas; skills do Fiscal como na imagem (Jeito do Fiscal; 2 Limites; 2 Procedimentos; Tabela CFOP e Regras de unidade e preço, mais Certificado digital desligada; Respostas boas de pedido de nota), com arquivos de referência; alguns `uso_ia` do Thiago para os números;
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-i1\` com nomes `i1-<tela>-<largura>-<tema>.png`: `agentes` (a lista), `ficha-skills` (Fiscal, aba Skills, como a imagem), `ficha-como-fala`, `ficha-ferramentas`, `ficha-visao-geral`, `thiago-orientacoes` (a tela do Treinar dentro da ficha), `thiago-testar`, `atividade`, `gastos-por-agente`;
   - liste o que ficou diferente da imagem. Já se sabe: o Fiscal **não atende** nesta etapa (faixa azul em todas as abas, D14); o cartão do Radar e do Contábil mostram os marcadores "chegam numa próxima etapa" em vez de novidades e tarefas (D26); ferramentas do Fiscal da imagem que ainda não existem (pasta no Drive, XML/PDF, planilha, sugerir correção) não aparecem (D15); "barrou N vezes" não aparece (D10); "desde 14/08" (ligado desde) não aparece; não há BUSCAR na aba Skills (a lista é curta); o Thiago tem "Fala com o cliente: Direto, é a voz do escritório" e o estado travado (D13); a coluna da direita da aba Skills fica embaixo abaixo de 1024px.
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Ela deve listar as pendentes de antes (anote quais: até a H2 eram F `20261006000100`–`300`, G1 `20261007000100`–`200`, G2 `20261008000100`, G3 `20261009000100`, H1 `20261012000100`–`300`, H2 `20261013000100`–`300`) **e as três da I1**: `20261014000100_painel_v2_agentes.sql`, `20261014000200_painel_v2_agente_skills.sql`, `20261014000300_painel_v2_agentes_leituras.sql`. Se aparecer outra, pare e avise;
   - **não aplique.** Deixe para o dono, por escrito: a I1 só acrescenta (tabelas novas, colunas novas com padrão, funções novas e um gatilho que só bloqueia orientações de outro setor); **a migração marca como dono o administrador ativo mais antigo** e o aviso (`NOTICE`) diz quem — se não for ele, a linha de SQL para trocar está em `docs/operacao.md` (D11); todas as orientações de hoje ficam do Thiago; para aplicar tudo junto, depois do "ok": `supabase db push --db-url "$DATABASE_URL"`.
4. **Subir o painel para o dono ver:**
   - **painel** desta worktree numa **porta livre** (comece pela **3018**: `netstat -ano | findstr :3018`; se ocupada, a próxima livre; **nunca 3001–3010**), do mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal (variáveis do `.env.homologacao`, `pnpm --filter @escritorio/painel exec next dev -p <porta>` nesta worktree). Antes, confira que nenhum e2e, cenário ou outro `next dev` desta parte está rodando (memória);
   - avise: **com as migrações pendentes, Agentes mostra só o cartão do Thiago com a faixa "Os agentes aparecem quando a atualização do banco da Parte I for aplicada."**; na ficha do Thiago, **Orientações e Testar funcionam como o Treinar o agente de hoje** (o endereço antigo leva para lá); Gastos com IA sem "Por agente" (D23). O resto aparece na homologação depois do "ok" e do `db push`; até lá, o dono vê pelas capturas (item 2);
   - **trabalhador: NÃO suba nenhum.** O da porta **3001 é o teste do dono**; não o desligue nem o mate. Entregue o desta branch **"pronto para trocar"** (D30), com estas instruções: (a) só troque **depois** de aplicar as migrações F–I1 (ele também funciona sem a I1, com o Thiago do código, mas sem custo por agente); (b) pare o da 3001 e, nesta worktree, rode o trabalhador do mesmo jeito do `ligar-teste.ps1`; (c) o que muda para o cliente: **nada** — o pedido do Thiago ao Claude é o mesmo (retratos da Task 1); o que muda por dentro: o Thiago lê o perfil e as skills do banco (nenhuma até o dono subir) e grava o custo com o agente;
   - roteiro curto (para depois do `db push`):
     1. **Agentes**: os 7 cartões; o Thiago Ligado; os outros Desligados;
     2. ficha do Thiago › **Skills**: suba um `.md` de Limites (ex.: "Nunca promete prazo de emissão de nota"), teste pelo ▷ e ligue; pelo WhatsApp de teste, peça prazo de nota e veja a resposta respeitar o limite;
     3. **Orientações** do Thiago: as de sempre, no mesmo lugar;
     4. ficha do **Fiscal**: ponha em Teste com um contato, escolha o modo e uma regra — e confira que **nada muda no atendimento** (faixa azul);
     5. **Gastos com IA › Por agente** e **Atividade e custo** do Thiago.
5. **Pendências para listar no fim:**
   - as decisões D1 a D31 que o dono ainda não confirmou (destaque **D3** — a skill do dono continua orientação; **D7** — PDF fora das skills; **D11** — dono = administrador mais antigo, troca por SQL; **D12** — quem vê a tela e quem mexe; **D13** — Thiago travado em Ligado/mesma voz e ferramentas fixas; **D14** — os outros guardam e não agem; **D15** — aprovação humana só a partir das tarefas; **D16** — custo por agente em coluna própria, funcionalidade sem `agente_<slug>`; **D19/D22** — `menu.test.ts` e os 2 e2e antigos adaptados; **D21** — Orientações com o simulador junto, Testar à parte);
   - o que ficou diferente das imagens (item 2);
   - resultado dos cenários (quantos passaram, custo total) e qualquer cenário antigo que falhou duas vezes;
   - aplicar na homologação as migrações da F, G1–G3, H1, H2 e I1 (item 3), depois do "ok"; conferir quem ficou marcado como dono;
   - **I2 (Agente Fiscal):** o Thiago passar a aplicar estado, modo, regras por assunto e lista de teste; uso no mês das regras; ferramentas novas do Fiscal no catálogo (banco e core juntos); funcionalidade `especialista_setor` com `agente_id`; aprovação humana das ferramentas que gravam/enviam; contar o uso das skills também pelo agente (hoje pelo nome, D10);
   - numa parte futura: tirar a rota `/treinar-agente` (só redireciona) e as entradas dela no menu lateral e na trilha.
6. **Não juntar** a branch em nada. **Parar** ao fim da I1 e esperar o dono ver.
