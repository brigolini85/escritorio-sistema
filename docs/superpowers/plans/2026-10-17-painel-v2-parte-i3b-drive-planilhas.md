# Painel v2, Parte I3b (Google Drive na tarefa, planilha XLSX, Testar dos agentes dos setores e as sobras da I3a). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** fechar a sub-etapa 3 do spec. (1) Primeiro, a pendência da Entrega da I3a: quando o cliente pergunta "quem fala?" junto com um assunto do Fiscal em **Mesma voz**, o cliente recebe **uma mensagem só** (hoje o Thiago responde "Aqui é o Thiago" e depois o Fiscal responde de novo). (2) **Google Drive** (spec 7E.6): campo **"Pasta no Drive"** na ficha do cliente; o trabalhador lê **só a pasta daquele cliente**, com uma conta de serviço **só de leitura** (nunca grava nem apaga); os arquivos viram **fontes da tarefa** (Docs e Slides exportados em PDF, Sheets em CSV, dentro dos tipos e tamanhos da D14 da I3a); **LER A PASTA DE NOVO** na tarefa; "Drive não configurado" sem credenciais; qualquer arquivo fora da pasta é **recusado** (teste com a pasta de outro cliente). (3) **Planilha XLSX** do resultado, montada pelo **nosso código** a partir das linhas (D16 da I3a: nada roda na Anthropic), baixada pela rota auditada; o CSV continua. (4) **Testar** dos agentes dos setores e o ▷ das skills deles (D13 da I2, D27 da I3a), com o perfil e as skills do próprio agente e o custo gravado com o `agente_id`. (5) As sobras da I3a que a pessoa vê: corrida em CONTINUAR, rascunho com linha provisória que ia a "Pronto" sem ser refeito, setor desativado travando só a criação, e a **guarda dos arquivos das tarefas** (proposta configurável; o dono escolhe o prazo).

**Um motor só, de novo:** nada é "do Contábil" nem "do Fiscal". O Drive é uma ferramenta automática das tarefas (como as da D19 da I3a) que só aparece quando o Drive está configurado e o cliente tem pasta; a simulação de um agente de setor é o mesmo `executarAgente` da I2 no papel `especialista`.

**Arquitetura:**
- **Banco (2 migrações novas, só acréscimos e `create or replace` de funções da I3a com a mesma assinatura):**
  - `20261017000100_painel_v2_drive.sql`: `clientes.drive_pasta_id` (uma pasta é de um cliente só); tabela `drive_conta` (situação da conta de serviço, gravada pelo trabalhador; ninguém vê a chave); origem `drive` em `agente_tarefa_arquivos` (+ `drive_id`, `drive_modificado_em`); `salvar_pasta_drive` (quem edita clientes), `pedir_leitura_da_pasta` (pessoa do setor), `pasta_drive_da_tarefa`, `registrar_arquivo_drive`, `registrar_situacao_drive` (só o trabalhador). pgTAP `53`.
  - `20261017000200_painel_v2_testar_guarda.sql`: `simulacoes_agente.modo`; `criar_simulacao_agente` (Testar dos agentes dos setores); `criar_simulacao_skill` grava o `agente_id` (minor da I1, mesmo comportamento); tabela `tarefas_guarda` + `agente_tarefa_arquivos.removido_em` + `salvar_guarda_tarefas` (só o dono), `arquivos_vencidos_das_tarefas`, `marcar_arquivos_removidos` (só o trabalhador); `interno.tarefa_da_pessoa` passa a recusar setor desativado; `interno.retomar_se_respondida` pede ao agente para refazer as linhas provisórias. pgTAP `54`.
  - `tipos.gen.ts` regerado.
- **Core (`@escritorio/core`):** `drive.ts` (link da pasta → código, o que ler e como exportar, motivos de "ignorado") e `planilha.ts` (as abas do resultado e as partes XML do XLSX, sem dependência); `contarProvisorias` em `tarefas.ts`.
- **Repositório (`@escritorio/db`):** métodos do Drive, da simulação de agente de setor e da guarda; ajudantes de teste.
- **Trabalhador:** pasta nova `src/drive/` (`leitor.ts` interface, `google.ts` cliente REST só leitura com `node:crypto` + `fetch`, `falso.ts` para testes e cenários); `src/tarefa/pasta.ts` (a guarda "só na pasta do cliente" e a cópia para a tarefa), `src/tarefa/armazenamento.ts`, `src/tarefa/guarda.ts`; fila `pasta_drive`; a ferramenta `ler_pasta_do_cliente`; a simulação dos agentes dos setores em `agente/simular.ts`; o conserto do "quem fala?" em `agente/{agentes-setor,especialista,executar,roteamento}.ts`; 1 cenário novo `tarefa: Drive só na pasta do cliente`.
- **Painel:** bloco **Arquivos** na ficha do cliente ("Pasta no Drive"); Configurações › Integrações com o **Google Drive** e a **guarda dos arquivos das tarefas**; na tarefa, "Drive · só leitura", **LER A PASTA DE NOVO**, **BAIXAR PLANILHA** (rota `/api/tarefas/planilha`, auditada), aviso de linhas provisórias; **Testar** e ▷ dos agentes dos setores (aba Testar, aba Orientações, botão "Testar agora"); "N tarefas aguardando aprovação · REVISAR" no cartão do agente (7E.2).

**Tecnologias:** Next.js 15, React 19, Tailwind 4, shadcn/ui, lucide-react, Supabase (Postgres 17, RLS, Storage), pg-boss, Anthropic SDK, Vitest, pgTAP, Playwright, @axe-core/playwright. **Nenhuma dependência nova em produção:** o Drive é chamado por REST com `fetch` do Node 22 e a assinatura JWT com `node:crypto` (D2); o XLSX é XML montado no core e compactado com `fflate`, que o painel já usa (D10). **Uma dependência só de teste:** `exceljs` **4.4.0** (versão fixa, `devDependencies` do painel), para abrir a planilha gerada com um leitor de terceiros e provar que ela é um XLSX válido.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- **7E.6** inteira ("conta de serviço ou autorização do escritório com acesso **só de leitura**; campo **'Pasta no Drive'** no cadastro do cliente (Parte H, bloco Contato ou um bloco 'Arquivos'); o agente só enxerga a pasta daquele cliente; nunca apaga nem altera; arquivos gerados ficam no sistema"; "Documentos lidos vão para a IA da Anthropic como as conversas já vão; registrar isso na política de LGPD do escritório");
- **7E.4** ("**Fontes lidas** (arquivos da pasta do cliente com ✓) e **faltando** (com Enviar arquivo / Ler a pasta de novo)"; "Resultado (rascunho): resumo, arquivos gerados para baixar"; "Execução: … skills de trabalho como Agent Skills + execução de código para gerar arquivos" — **D10 diverge**, como a D16 da I3a);
- **7E.3** (Ferramentas: "ler pasta do cliente (só leitura) … gerar planilha" no catálogo — **D7 diverge**; Testar na ficha; "Mesma voz — Responde direto, mas assina e escreve como Thiago");
- **7E.2** ("avisos (ex.: '2 tarefas aguardando aprovação · REVISAR')");
- **7E.8** (custo por agente; nada grava ou envia sem aprovação);
- **7E.9 item 3** (esta sub-etapa, parte b);
- **7E.10** ("leitura do Drive só na pasta do cliente (teste com pasta de outro cliente → recusado)"; "Custos gravados por agente");
- dependências: **7D** (ficha do cliente da Parte H), **7B.2** (`uso_ia`), **4.6** (tom), **8** (grep antes de trocar rótulos; vermelho nunca sozinho).
- Imagem: `imagens/00-agente-tarefa-fechamento.png` ("Drive · só leitura", LER A PASTA DE NOVO, `.xlsx` para baixar).

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt I" — **este plano é a sub-etapa 3, parte b**. Pontos que não podem falhar e que valem aqui: "**Toda ferramenta que lê dado de cliente passa pelo acesso por contato da Parte H; o que grava/envia exige aprovação humana.**", "**Cenários atuais do Thiago e do assistente continuam 100%**", "**Toda chamada grava custo por agente (Parte F).**", "**Um motor só; agente = registro de configuração.**". Estilo e convenções: `docs/superpowers/plans/2026-10-16-painel-v2-parte-i3a-tarefas.md` (o plano da I3a; leia as linhas 1–157 e a Entrega). Manuais: `docs/design-system.md` e `docs/operacao.md`. Relatórios da I3a que originam as sobras: `.superpowers/sdd/2026-10-16-painel-v2-parte-i3a-tarefas/{final-review,final-fix-report,entrega-report}.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-i`, branch `painel-v2-parte-i` (I1, I2 e I3a prontas nesta mesma branch), a partir de `b7f9166` ou do commit mais novo. **Antes da Task 1, anote o SHA de partida:** `git rev-parse --short HEAD` → chamado de **BASE** abaixo. Todos os comandos rodam a partir da raiz da worktree.

## Escopo: I3b inteira, 16 tasks

O pedido do controlador cabe em 16 tasks (abaixo do teto de ~18), sem nova divisão:

1. o conserto do "quem fala?" em Mesma voz (Task 1, **primeira**; 3 rodadas seguidas do cenário com Claude de verdade);
2. Google Drive (Tasks 2, 4, 6, 7, 8, 11, 12, 13);
3. planilha XLSX (Tasks 3 e 13);
4. Testar e ▷ dos agentes dos setores, com o `agente_id` em `criar_simulacao_skill` (Tasks 5, 6, 9, 14);
5. sobras da I3a que a pessoa vê, com a guarda dos arquivos (Tasks 5, 10, 12, 13);
6. e2e (Task 15) e manuais (Task 16).

**Ficam para a I4 em diante:** PEDIR AO AGENTE (janela e WhatsApp), tarefas agendadas ("todo dia 1º"), chegada automática do arquivo pedido ao cliente, "Pasta no servidor" (7E.6, opcional), cópia dos gerados numa subpasta "Gerados pelo agente" (7E.6, "opção futura"), o layout de importação do Domínio (D10), o relatório de pendências em PDF.

## Decisões tomadas (sem o dono)

O dono autorizou decidir (execução autônoma das partes C a I, sem juntar nem apagar dados). Conferi no código o que o spec supõe:

- **O "quem fala?"** (Entrega da I3a, `entrega-report.md` §3): o cenário `fiscal: Mesma voz assina como Thiago` (`apps/trabalhador/src/cenarios/cenarios.ts:301-304`) falhou 2 vezes: o Thiago chamou `responder` ("Oi, João! Aqui é o Thiago…") **antes** de `chamar_agente`, e o Fiscal (Mesma voz) respondeu de novo. O cabeçalho `CABECALHO_AGENTES_SETOR` (`agente/agentes-setor.ts:7-14`) diz "Saudações … continuam com você" — o modelo leu "quem fala?" como saudação dele. `chamarAgente` (`agente/roteamento.ts:69-126`) não olha se o Thiago já falou nesta vez; o laço (`agente/executar.ts:177-181`) roda as ferramentas da rodada na ordem do modelo. Os **retratos** (`test/agente/__retratos__/*.json`, 4 casos) fixam o pedido do Thiago **sem** agente ativo; com agente ativo o cabeçalho e `chamar_agente` só entram por `secaoAgentesSetor`/`montarPedido`.
- **Ficha do cliente (Parte H):** `salvar_ficha_cliente(p_id, p_dados)` grava tudo de uma vez e `ficha.test.ts`/`acoes.test.ts` fixam o que o formulário manda; o bloco **Acessos de portais** já salva sozinho e entra como `acessos: ReactNode` em `ficha-cliente.tsx`. Permissão de editar cliente: `tem_permissao('editar_clientes')`.
- **Tarefas (I3a):** os arquivos ficam no compartimento privado `tarefas` (`<tarefa>/…`, `tarefa_do_caminho` lê o primeiro trecho; tipos permitidos no compartimento: PDF, XML, CSV, TXT, OFX, JPG, PNG; 10 MB), na tabela `agente_tarefa_arquivos` (origem `enviado`/`conversa`), lidos por `lerArquivoDaTarefa` (`tarefa/arquivos.ts`); o download é a rota auditada `api/tarefas/arquivo` com URL assinada; o CSV sai na hora de `resultado` (`api/tarefas/csv`, `csvDoResultado` do core). `ArmazenamentoMidia` (`midia/armazenamento.ts`) não tem envio genérico e é a interface de muitos testes antigos.
- **Simulador:** `criar_simulacao_skill` recusa skill de agente que não é o Thiago com "Nesta etapa só dá para testar skills do Thiago." e o pgTAP **46:77 fixa essa frase**; `simulacoes_agente.agente_id` existe desde a I1 (padrão = Thiago); `simular.ts` sempre carrega o perfil do Thiago; o painel mostra `TEXTO_TESTE_AGENTE_SETOR` na aba Testar, no botão "Testar agora" e no lado direito da aba Orientações dos agentes dos setores, e o e2e **`agente-orientacoes.spec.ts:34` fixa esse texto**.
- **Catálogo de ferramentas:** o pgTAP **48:24** fixa `ferramentas_do_catalogo() = ferramentas_do_atendimento() || ferramentas_do_setor()` e os testes do core/db fixam as listas.
- **Sobras da I3a** (`final-review.md:49-63`, `final-fix-report.md` "Ficam"): corrida em `continuar` (`tarefa/executar.ts` devolve `fim` quando vê a tarefa fora de `trabalhando`); rascunho com linha provisória que vai a `pronta` sem ser refeito; `interno.tarefa_da_pessoa` não confere `setores.ativo`; retenção do compartimento `tarefas` não definida (F23); `agenteDevolvido` no ramo "contato não trata do setor" (interno, sem efeito para quem usa).
- **Retenção que já existe:** `retencao.ts` (fila `limpeza-retencao`, todo dia às 03:00) apaga conversas e anexos com 1 ano; `retencao.test.ts` fixa o objeto que ela devolve.
- **Dependências:** `fflate` 0.8.x já está no painel (skills em `.zip`); nada de Google no repositório.
- **Cenários com Claude real** (Entrega da I3a): `cenarios` 62/64 (o "quem fala?" e um flake conhecido), `cenarios-atendimento` 6, `cenarios-assistente` 4, `cenarios-tarefas` 5; ~US$ 4 por rodada inteira.
- **Homologação:** F a I3a pendentes (21 migrações, só `--dry-run`); as duas da I3b também ficarão.

Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Por que não | Tasks |
|---|---|---|---|---|
| D1 | **"Quem fala?" + assunto de setor em Mesma voz = uma mensagem só**, em três camadas: (a) o cabeçalho dos agentes dos setores diz para **chamar o agente antes de mandar qualquer coisa** quando a mensagem traz assunto do setor junto com cumprimento ou "quem fala?", e a saudação vai no pedido; o texto do modo Mesma voz manda o agente responder o cumprimento no começo da mesma mensagem, como Thiago; (b) **trava na mesma rodada:** se o modelo pede `responder` (ou outra que envia) e `chamar_agente` juntos, o `chamar_agente` roda antes, e o que envia na mesma rodada é recusado quando o agente já falou ("O agente do setor já respondeu…"); (c) **trava em rodadas seguidas:** se o Thiago já mandou mensagem nesta vez e o assunto cairia em Mesma voz, o agente roda **por trás** e devolve o texto para o Thiago repassar (a decisão grava `modo: por_tras`, `modo_da_regra: mesma_voz`). Sem agente ativo nada muda (retratos intactos). Critério: **3 rodadas seguidas** do cenário passando. | Só o prompt; ou bloquear o `responder` do Thiago sempre que houver agente ativo. | Só prompt já falhou 2 vezes; bloquear o Thiago quebra "Saudação ou agradecimento sem assunto de setor continuam com você". | 1 |
| D2 | **Cliente do Google por REST, sem biblioteca:** token da conta de serviço com JWT RS256 assinado por `node:crypto` e trocado em `oauth2.googleapis.com/token`; Drive v3 por `fetch` (`files.get`, `files.list`, `alt=media`, `files.export`, `about`). ~150 linhas, testadas com `fetch` falso e uma chave RSA gerada no teste. | `googleapis` (inteiro, centenas de APIs) ou `google-auth-library` 10.x (+ `gaxios`, `gtoken`, `jws`…). | Usamos 5 chamadas GET; uma dependência a mais no trabalhador da máquina do dono (pouca memória) e mais superfície para atualizar. Se o dono preferir a biblioteca oficial, só `src/drive/google.ts` muda (a interface `DriveLeitor` fica). | 7 |
| D3 | **Credencial e escopo:** variável **`GOOGLE_DRIVE_CONTA_SERVICO`** no ambiente do trabalhador (o JSON da chave, inteiro ou em base64); escopo **só `https://www.googleapis.com/auth/drive.readonly`**; nenhum método do `DriveLeitor` grava, move, compartilha ou apaga. O dono compartilha **cada pasta de cliente** com o e-mail da conta de serviço como **Leitor**; o painel mostra esse e-mail. Sem a variável: "Drive não configurado" e tudo segue como na I3a. A chave **nunca** vai ao painel nem ao banco. | Autorização OAuth de uma pessoa do escritório. | O token de uma pessoa enxerga o Drive inteiro dela; a conta de serviço só vê o que foi compartilhado com ela (mais uma barreira além da D5). | 7, 12 |
| D4 | **O arquivo do Drive é copiado para a tarefa** (compartimento `tarefas`, `<tarefa>/drive/<id>-<carimbo>.<ext>`, origem `drive`, com `drive_id` e a data de modificação). O agente lê pelo mesmo `ler_arquivo`; a fonte de uma linha aprovada continua baixável mesmo que o arquivo mude ou suma no Drive; a guarda (D14) vale para ele. | Ler direto do Drive a cada vez. | Cada vez baixaria tudo de novo; o resultado aprovado ficaria apoiado num arquivo que pode mudar. | 4, 8 |
| D5 | **"Só na pasta do cliente", em quatro barreiras:** (1) o agente **nunca passa link nem código** de arquivo: `ler_pasta_do_cliente` só aceita `subpasta` (um caminho por nomes dentro da pasta do cliente); (2) a listagem parte da pasta do cliente e **pula atalhos** (podem apontar para fora), a **pasta de outro cliente** aninhada e a lixeira; (3) antes de baixar, o trabalhador confere que o arquivo **foi visto nesta listagem** e que a **ascendência** chega à pasta do cliente sem passar pela pasta de outro cliente (até 10 saltos); (4) o banco (`registrar_arquivo_drive`) só aceita arquivo para tarefa de cliente **com** pasta e caminho dentro da tarefa. Teste com a pasta de outro cliente → recusado (Tasks 8, 11). | Confiar só na listagem. | Atalho, pasta aninhada e arquivo com dois pais são os caminhos reais para sair da pasta. | 4, 8, 11 |
| D6 | **Quais arquivos:** os tipos da D14 da I3a (PDF, XML, CSV, TXT, OFX, JPG, PNG) até **10 MB**; **Google Docs e Slides → PDF**, **Sheets → CSV** (o Drive exporta só a primeira aba); o resto (DOCX, XLSX, ZIP…) fica **ignorado** com o motivo na linha do tempo e na tela. Até **3 níveis** de subpasta e **300 itens** listados; **mais novos primeiro**; respeita o teto de **30 arquivos por tarefa**. Arquivo **igual** (mesmo `drive_id` e mesma data de modificação) não entra de novo; **mudou** no Drive → entra a versão nova com " (2)" no nome (a antiga continua como fonte). | Ler XLSX e DOCX do Drive. | Exige biblioteca de extração (a I3a decidiu não ter, D15); o cliente costuma mandar PDF/XML; fica listado para o dono decidir. | 2, 8 |
| D7 | **Quando lê:** (a) **na primeira vez** da tarefa, sozinho, se o Drive está configurado e o cliente tem pasta; (b) **LER A PASTA DE NOVO** (pessoa do setor; fila `pasta_drive`; uma por tarefa a cada 2 minutos); (c) a ferramenta **`ler_pasta_do_cliente`**, que entra **sozinha** nas tarefas (como as da D19 da I3a) **só** quando há Drive e pasta. **Não entra no catálogo** — **diverge do spec 7E.3** ("ler pasta do cliente" como ferramenta escolhida pelo dono): o pgTAP 48:24 e os testes do core fixam o catálogo, e o dono não tem o que escolher (sem ela a pasta não é lida). Não relê a pasta a cada vez (tempo e chamadas). | Ler a pasta a cada vez; pôr no catálogo. | Ver ao lado. | 8, 13 |
| D8 | **Campo "Pasta no Drive" num bloco próprio "Arquivos"** da ficha (spec: "bloco Contato ou um bloco 'Arquivos'"), que **salva sozinho** (`salvar_pasta_drive`, quem tem "editar clientes"), como Acessos de portais; aceita o link copiado do navegador (`drive.google.com/drive/folders/…`, `/drive/u/0/folders/…`, `open?id=…`) ou o código; vazio limpa; **uma pasta é de um cliente só** ("Esta pasta do Drive já é de outro cliente."). Mostra a situação do Drive (D9) e "Compartilhe a pasta com <e-mail> como Leitor". Fora de `salvar_ficha_cliente`. | Campo dentro do formulário da ficha. | Mudaria `salvar_ficha_cliente` e os testes da Parte H. | 4, 12 |
| D9 | **Situação do Drive:** tabela de uma linha `drive_conta` (e-mail da conta, último erro curto, quando conferiu), gravada pelo trabalhador **ao ligar** (chamada `about`) e a cada leitura de pasta; lida por qualquer pessoa ativa. Telas: ficha (bloco Arquivos), tarefa (Fontes) e Configurações › Integrações ("Google Drive (só leitura)"). Sem linha ou sem e-mail = "Drive não configurado: o agente lê só os arquivos enviados." | Variável de ambiente no painel. | O painel não precisa (nem deve) ter a chave; a situação real é a do trabalhador. | 4, 7, 12, 13 |
| D10 | **Planilha XLSX montada pelo nosso código:** o core monta as **partes XML** (3 abas: **Resultado** — Descrição, Valor, Texto, Fonte, Provisória; **Destaques**; **Pendências**), o painel compacta com `fflate` (data fixa nas entradas do zip: mesmo resultado → mesmos bytes) e entrega **na hora do download** pela rota auditada `/api/tarefas/planilha`, como o CSV; nome `tarefa-<n>-rascunho.xlsx` até aprovar. Valor em célula **numérica** com formato `#,##0.00`; textos em células de texto (nada vira fórmula). **Não é o layout de importação do Domínio:** esse layout precisa de colunas que as linhas não têm (data, conta débito, conta crédito, histórico); entra quando o dono mandar um **modelo de arquivo de importação do Domínio**. **Diverge do spec 7E.3/7E.4** ("Agent Skills + execução de código", como a D16 da I3a) e **da nota da I3a** ("guardados no compartimento `tarefas`"): gerar na hora não ocupa espaço, não precisa de guarda e sai igual do mesmo `resultado` (jsonb, que não muda depois de aprovado). "No código do trabalhador" da nota da I3a lê-se "no nosso código, não no da Anthropic". | Gerar no trabalhador e guardar no Storage; `exceljs` em produção. | Ver ao lado; `exceljs` traz ~10 dependências para escrever 6 arquivos XML. | 3, 13 |
| D11 | **Testar dos agentes dos setores:** agente com **Conversa** → o simulador de sempre roda **o próprio agente** (papel `especialista` da I2) no **modo escolhido** (padrão: o modo padrão dele), com as skills, orientações e o rascunho dele; a pessoa vê o que ele mandaria, a devolução ao Thiago (por trás) ou "devolveria o assunto"; o custo vai como `testar_agente` **com o `agente_id` dele**. Agente **só de Trabalho** (Contábil) → a aba Testar explica como testar com uma tarefa de verdade em **Teste** (D3 da I3a: só dono e administrador pedem); sem simulação de tarefa. Quem testa: o dono, ou quem treina o agente (`pode_treinar_agente`); o ▷ de skill, só o dono. | Simular uma tarefa inteira. | Exigiria uma cópia em memória de tudo o que a tarefa grava; o estado Teste já isola a tarefa real e custa o mesmo. | 5, 9, 14 |
| D12 | **Função nova `criar_simulacao_agente`** (agente pelo endereço, mensagem, empresa, rascunho, skill, modo) em vez de mudar `criar_simulacao_skill`: o pgTAP 46:77 fixa a recusa "Nesta etapa só dá para testar skills do Thiago.". `criar_simulacao_skill` passa a gravar o `agente_id` da skill (minor da I1), com o mesmo comportamento e as mesmas frases. | Mudar `criar_simulacao_skill`. | Teste de parte anterior não muda. | 5, 14 |
| D13 | **Exceção a "nenhum e2e existente muda": `apps/painel/e2e/agente-orientacoes.spec.ts:34`** (uma linha). A aba Orientações do Fiscal passa a ter o simulador; o texto "O teste deste agente no painel chega com as tarefas de trabalho…" deixa de existir (`TEXTO_TESTE_AGENTE_SETOR` sai). A linha passa a conferir o botão Testar do simulador. Como a D25 da I3a. | Manter o texto antigo. | Ficaria falso ("chega com as tarefas") com o teste já pronto. | 14 |
| D14 | **Guarda dos arquivos das tarefas (proposta; o dono escolhe o prazo):** em Configurações › Integrações, **só o dono** escolhe "Nunca apagar" (**padrão**, até ele decidir), 90, 180, 365 ou 730 dias **depois que a tarefa é aprovada ou descartada**; a limpeza roda junto da `limpeza-retencao` (03:00); apaga **só** os objetos do compartimento `tarefas` (enviados e do Drive); anexos da conversa seguem a regra da conversa (1 ano); a linha do arquivo fica, com "apagado pela guarda em <data>"; resultado, CSV e planilha continuam (vêm do `resultado`). **Sugestão ao dono: 365 dias** (igual às conversas). | Apagar a linha; prazo fixo no código. | O histórico das fontes some; o prazo é decisão do dono (LGPD). | 5, 6, 10, 12 |
| D15 | **Sobras da I3a que entram:** (a) **corrida em CONTINUAR**: a vez que vê a tarefa fora de `trabalhando` fecha com `continuar` (o banco mantém o estado; se a pessoa já continuou, volta à fila); (b) **linhas provisórias**: quando a última pendência é respondida e o rascunho tem linha provisória, o banco marca **ajuste pendente** ("Refaça as linhas provisórias com as respostas das pendências e entregue de novo.") e a Aprovação avisa "N linhas provisórias"; (c) **setor desativado trava todas as ações** da tarefa (`interno.tarefa_da_pessoa`: "O setor desta demanda está desativado: não dá para mexer na tarefa."); (d) respostas rápidas quebram linha sem empilhar em 1366; (e) `uuid` validado na rota do CSV. **Ficam listadas** (Entrega): `agenteDevolvido` no ramo "contato não trata do setor" (interno); recontar pedido "não pode ser enviado" a outro contato antes de 24 h; "Aprovado, aguardando envio" repetido no cartão; os minors das tasks da I3a (teto e agente desligado só no começo da vez, `p_tamanho`/`p_mime` confiados, `for update` em leituras, deadlock raro aprovar×concluir, `SEM_PARTE_I` mascarando erros, not-found do Storage pelo texto, "Marcar como recebida" sem exigir nada, envio em dobro só se todas as gravações falharem). | Todas. | As listadas são internas ou de risco baixo. | 5, 10, 13 |
| D16 | **Cartão do agente: "N tarefas aguardando aprovação · REVISAR"** (7E.2; listado na Entrega da I3a para a I3b): conta as tarefas `pronta` que a pessoa vê (RLS); REVISAR abre a mais antiga. | Deixar para a I4. | Barato e é o aviso que o spec dá como exemplo. | 14 |
| D17 | **Volta sem a I3b:** sem as migrações da I3b o trabalhador **não quebra** (situação do Drive e leitura da pasta avisam uma vez no log e seguem; a simulação de agente de setor não acontece porque o painel não cria; a guarda não roda); o painel esconde o bloco Arquivos atrás da faixa "A pasta no Drive aparece quando a atualização do banco da Parte I3b for aplicada.", a tarefa mostra as fontes como na I3a (sem Drive), a aba Testar dos agentes dos setores mostra "O teste deste agente no painel aparece quando a atualização do banco da Parte I3b for aplicada." e Configurações esconde Drive e guarda atrás da mesma faixa. A **planilha XLSX funciona sem migração** (vem do `resultado`). | Exigir a I3b para subir. | O dono pode trocar o trabalhador antes do `db push`. | 6–9, 12–14 |
| D18 | **Cenários com Claude real:** Task 1 roda `fiscal: Mesma voz assina como Thiago` **3 vezes seguidas** (e `fiscal:` uma vez); Task 11 acrescenta `tarefa: Drive só na pasta do cliente` ao `cenarios-tarefas` (Drive **falso** com duas pastas de clientes, Claude **de verdade**). Entrega: **todos** (`cenarios` 64, `cenarios-atendimento` 6, `cenarios-assistente` 4, `cenarios-tarefas` 6). Estimativa: Task 1 ≈ US$ 0,40–1,20; Task 11 ≈ US$ 0,20–0,60; Entrega ≈ US$ 4–5. **Teto: US$ 30** na I3b; passou, parar e listar como pendência. | Cenário com o Drive de verdade. | Exigiria a credencial do dono nos testes e dados reais de cliente. | 1, 11, Entrega |
| D19 | **LGPD:** os documentos lidos do Drive vão à Anthropic como as conversas (7E.6); `operacao.md` traz o parágrafo para o dono pôr na política do escritório. | — | — | 16 |

## Restrições globais

- **Só mexer em:** `supabase/migrations` (dois arquivos **novos**: `20261017000100_painel_v2_drive.sql`, `20261017000200_painel_v2_testar_guarda.sql`), `supabase/tests` (dois **novos**: `53_painel_v2_drive.test.sql`, `54_painel_v2_testar_guarda.test.sql`), `packages/core/src/{drive,planilha,tarefas,index}.ts` (em `tarefas.ts` só o acréscimo de `contarProvisorias`) e testes **novos** do core, `packages/db/src/repos.ts` (métodos e tipos novos; **`PerfilAgente`, `SkillCarregada`, `AgenteSetor`, `OrientacaoAgente`, `TarefaParaTrabalho`, `ArquivoDaTarefa` não mudam**), `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão), `packages/db/test/limpar.ts` (ajudantes novos e a volta das tabelas novas), `packages/db/test/drive-testar.test.ts` (novo), `apps/trabalhador/src/drive/*` (novos), `apps/trabalhador/src/tarefa/{pasta,armazenamento,guarda}.ts` (novos), `apps/trabalhador/src/tarefa/{ferramentas,executar,processar,prompt}.ts` (só o que as Tasks 8 e 10 dizem), `apps/trabalhador/src/agente/{agentes-setor,especialista,executar,roteamento,ferramentas,simular}.ts` (só o que as Tasks 1 e 9 dizem), `apps/trabalhador/src/{config,fila,principal}.ts`, `apps/trabalhador/src/cenarios/{tarefas,fixtures-tarefas}.ts` (só o cenário novo e os dados dele), testes **novos** do trabalhador, `apps/painel` (`lib`, `app/(painel)/clientes/ficha/**` e `app/(painel)/clientes/[id]/page.tsx`, `app/(painel)/configuracoes/secoes/integracoes.tsx` e `configuracoes/page.tsx`, `app/(painel)/tarefas/**`, `app/(painel)/agentes/**`, `app/(painel)/treinar-agente/{acoes,simulacao,simulador,tela-orientacoes}.ts(x)`, `app/api/tarefas/**`, e2e novos, a linha 34 de `e2e/agente-orientacoes.spec.ts` (D13), `package.json` só com `exceljs` 4.4.0 em `devDependencies`), `pnpm-lock.yaml` (só pela instalação do `exceljs`), `docs/design-system.md`, `docs/operacao.md`. **Nada em `apps/trabalhador/src/assistente`, `apps/trabalhador/src/sugestao`, `apps/trabalhador/src/envio.ts`, `apps/trabalhador/src/processar-conversa.ts`, `apps/trabalhador/src/retencao.ts`, `apps/trabalhador/src/midia/*` nem `apps/trabalhador/src/agente/{fora-do-acesso,acesso,pedido-nota,perfil,prompt,contexto,atender,pre-analise,pedidos-ao-contato}.ts`** (prova na Entrega).
- **Testes de partes anteriores não mudam:** nenhum pgTAP de `01` a `52`; nenhum `*.test.ts` existente; nenhum e2e existente **exceto `apps/painel/e2e/agente-orientacoes.spec.ts:34`** (D13). Se um teste antigo quebrar por causa desta parte, **pare** e avise: é mudança de comportamento.
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` continua 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio. Nada é publicado no Realtime (tabelas novas fora do `supabase_realtime`). Nunca use `usuario_liberado` em código novo; use `eh_usuario_ativo`, `eh_admin`, `tem_permissao`, `eh_dono`, `pode_ver_chamado`, `meus_setores`, `pode_treinar_agente`.
- **O pedido do Thiago sem agente ativo não muda:** `git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__` sai **vazio** e `retrato-thiago.test.ts` passa. Se um retrato precisar mudar, **pare**.
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`). Para o `next dev` das capturas, acrescente `ACESSOS_PORTAIS_CHAVE=` com uma chave gerada na hora (comando do `.env.example`); ela some quando o `.env` volta da cópia. **Não** ponha `GOOGLE_DRIVE_CONTA_SERVICO` no `.env`: os testes e cenários usam o Drive falso.
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os e2e e os cenários deixam no banco quebram os pgTAP antigos.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts --workers=1`.
- **POUCA MEMÓRIA (vale para todas as tasks e para a Entrega):**
  - e2e sempre em **lotes de até 2 arquivos**, `--workers=1`. **Nunca rode a suíte e2e inteira de uma vez.**
  - **Antes de cada lote** (e antes de cada rodada de cenários), confira a memória livre: no PowerShell, `[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1)` (GB). **Abaixo de 4 GB, não rode:** espere, feche o que for seu (nunca o que é do dono) e confira de novo; se continuar abaixo, pare e avise.
  - **Se o Claude Code matar um processo** (ou aparecer "Target crashed" / "worker process exited unexpectedly"), **pare** na hora, anote o lote, devolva `config.toml` e `.env`, e avise. Não tente de novo no mesmo turno.
  - Um agente de cada vez (nada de subagentes em paralelo). Nunca rode ao mesmo tempo o painel de teste do dono, o `next dev` desta parte, os cenários e os e2e.
- **Portas 3001 a 3010 são do dono:** nenhum servidor desta parte usa essas portas; os e2e usam a 3100 (padrão do `playwright.config.ts`), as capturas a **3107**, o painel para o dono a primeira livre a partir da **3018**.
- **E2e e cenários só contra o banco local:** `apps/painel/e2e/trava-local.ts` e `limparBanco` recusam outro banco. **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`** (só leitura, na Entrega).
- **Cenários com Claude real gastam dinheiro:** rode só os comandos indicados (Tasks 1 e 11, e a Entrega), um de cada vez, e anote a soma de `uso_ia.custo_usd` do banco local depois de cada rodada (`select round(sum(custo_usd), 4) from uso_ia`, antes do próximo `db reset`). Teto D18.
- **Nenhum trabalhador é ligado nem desligado nesta parte.** O da porta **3001 é o teste do dono: não desligue nem mate esse processo.** O desta branch é entregue "pronto para trocar".
- **Nenhuma chamada ao Google de verdade** em teste, cenário ou captura: o `DriveLeitor` falso (`src/drive/falso.ts`) e o `fetch` falso dos testes do cliente REST. O cliente de verdade só roda no trabalhador do dono, com a chave dele.
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "Em teste:", "Estado do agente", "Ferramentas do catálogo", "Linha do tempo", "Fontes", "Enviar arquivo", "Baixar CSV", "Aprovar e concluir", "Pedir ajuste", "Descartar", "Responda as pendências antes de aprovar.", "Nesta etapa só dá para testar skills do Thiago.", o texto da recusa de PDF nas skills e todos os textos das telas da Parte H que os e2e conferem.
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[220px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind. `escala.test.ts` e `tokens.test.ts` continuam passando. Ícones só com `size={12|14|16|20}`.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`). Vermelho nunca sozinho (Faltando, Falha e Ignorado sempre com ícone e a palavra). O cadeado sempre com texto ("só leitura", "só o dono").
- **Termos:** Pasta no Drive, Drive (só leitura), Ler a pasta de novo, Planilha, Guarda dos arquivos, Testar; nunca "job", "fila", "sincronizar", "service account" nem "bucket" na tela (na tela é "conta do Drive do escritório").
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Saída da pasta do cliente:** atalho dentro da pasta apontando para o arquivo de outro cliente; a pasta de outro cliente aninhada dentro desta; um arquivo com dois pais (um em cada cliente); um código de arquivo que não veio desta listagem; o pedido da tarefa com o link da pasta de outro cliente → nada de fora é baixado nem registrado; o motivo aparece como "ignorado". Tasks 4, 8 e 11.
2. **Drive que falha:** sem chave, chave inválida, pasta não compartilhada (403), pasta apagada (404), um arquivo que falha no meio, exportação grande demais → a tarefa segue com o que tem, a linha do tempo diz o porquê, nada fica pela metade no Storage (envio desfeito se o registro falhar). Tasks 7 e 8.
3. **Uma mensagem só:** "quem fala?" + assunto do setor com o modelo pedindo `responder` e `chamar_agente` na mesma rodada, ou em rodadas seguidas → o cliente recebe uma mensagem (mesma rodada) ou só mensagens do Thiago (rodadas seguidas); sem agente ativo, o pedido do Thiago é o de antes. Task 1.
4. **Teste de agente que vaza:** simulação de um agente de setor que tenta `nota_interna`, `sugerir_correcao`, `responder` ou ler demanda de outra pessoa → nada é gravado nem enviado; o custo vai como `testar_agente` com o `agente_id` dele; pessoa de outro setor não cria o teste; skill de outro agente recusada. Tasks 5 e 9.
5. **Planilha que engana:** descrição começando com "=", "+", "-" ou "@"; caracteres de controle; número negativo e `null`; 500 linhas; acento e emoji → a planilha abre num leitor de terceiros, sem fórmula, com os números como números. Task 3.
6. **Guarda que apaga demais:** tarefa ainda ativa, tarefa decidida há menos dias, anexo da conversa (compartimento `anexos`), "Nunca apagar" → nada é apagado; só o dono muda o prazo. Tasks 5 e 10.
7. **Homologação sem a I3b (com a I3a):** trabalhador atende e faz tarefas como na I3a (sem erro, um aviso no log); painel com as faixas. Tasks 6–9 e 12–14.

---

## Mapa de arquivos

`ag/…` = `apps/painel/src/app/(painel)/agentes/`; `cl/…` = `apps/painel/src/app/(painel)/clientes/`; `ta/…` = `apps/painel/src/app/(painel)/tarefas/`; `tr/…` = `apps/trabalhador/src/`.

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `tr/agente/agentes-setor.ts`, `tr/agente/especialista.ts` (só `TEXTO_MODO.mesma_voz`), `tr/agente/executar.ts`, `tr/agente/roteamento.ts`, `tr/agente/ferramentas.ts` (só o tipo `EstadoExecucao`), `apps/trabalhador/test/agente/uma-mensagem.test.ts` (novo) | "quem fala?" em Mesma voz | 1 |
| `packages/core/src/drive.ts` (novo), `packages/core/src/index.ts`, `packages/core/test/drive.test.ts` (novo) | link da pasta, o que ler, motivos | 2 |
| `packages/core/src/planilha.ts` (novo), `packages/core/src/tarefas.ts` (`contarProvisorias`), `packages/core/src/index.ts`, `packages/core/test/planilha.test.ts` (novo) | abas e partes do XLSX | 3 |
| `supabase/migrations/20261017000100_painel_v2_drive.sql`, `supabase/tests/53_painel_v2_drive.test.sql` (novos), `tipos.gen.ts` | pasta, situação, arquivos do Drive | 4 |
| `supabase/migrations/20261017000200_painel_v2_testar_guarda.sql`, `supabase/tests/54_painel_v2_testar_guarda.test.sql` (novos), `tipos.gen.ts` | Testar dos setores, guarda, sobras | 5 |
| `packages/db/src/repos.ts`, `packages/db/test/limpar.ts`, `packages/db/test/drive-testar.test.ts` (novo) | repositório e ajudantes | 6 |
| `tr/drive/leitor.ts`, `tr/drive/google.ts`, `tr/drive/falso.ts` (novos), `tr/config.ts`, `tr/principal.ts` (só a situação ao ligar), `apps/trabalhador/test/drive/google.test.ts`, `apps/trabalhador/test/drive/falso.test.ts` (novos) | o Drive só de leitura | 7 |
| `tr/tarefa/pasta.ts`, `tr/tarefa/armazenamento.ts` (novos), `tr/tarefa/ferramentas.ts`, `tr/tarefa/executar.ts`, `tr/tarefa/processar.ts`, `tr/tarefa/prompt.ts`, `tr/fila.ts`, `tr/principal.ts`, `apps/trabalhador/test/tarefa/pasta.test.ts` (novo) | a pasta do cliente na tarefa | 8 |
| `tr/agente/simular.ts`, `apps/trabalhador/test/agente/simular-setor.test.ts` (novo) | simulação dos agentes dos setores | 9 |
| `tr/tarefa/executar.ts` (a corrida), `tr/tarefa/guarda.ts` (novo), `tr/principal.ts`, `apps/trabalhador/test/tarefa/sobras-i3a.test.ts` (novo) | sobras do trabalhador e a guarda | 10 |
| `tr/cenarios/tarefas.ts`, `tr/cenarios/fixtures-tarefas.ts` | cenário "Drive só na pasta do cliente" | 11 |
| `apps/painel/src/lib/drive.ts`, `lib/drive-tela.ts`, `lib/drive-tela.test.ts` (novos), `cl/ficha/bloco-arquivos.tsx`, `cl/ficha/drive-acoes.ts`, `cl/ficha/drive-acoes.test.ts` (novos), `cl/ficha/ficha-cliente.tsx`, `cl/[id]/page.tsx`, `configuracoes/secoes/integracoes.tsx`, `configuracoes/secoes/guarda-tarefas.tsx` (novo), `configuracoes/guarda-acoes.ts`, `configuracoes/guarda-acoes.test.ts` (novos), `configuracoes/page.tsx` | ficha, Configurações | 12 |
| `apps/painel/src/lib/{tarefas,tarefas-tela,tarefas-acoes,fila}.ts`, `lib/planilha-tarefa.ts`, `lib/planilha-tarefa.test.ts`, `lib/tarefas-drive.test.ts` (novos), `app/api/tarefas/planilha/route.ts` (novo), `app/api/tarefas/csv/route.ts`, `app/api/tarefas/arquivo/route.ts`, `ta/[id]/{fontes-tarefa,resultado-tarefa,aprovacao-tarefa,pendencia-analista,page}.tsx`, `ta/[id]/ler-pasta.tsx` (novo), `apps/painel/package.json` (`exceljs` em `devDependencies`) | tarefa: Drive, planilha, provisórias | 13 |
| `ag/[slug]/textos.ts`, `ag/[slug]/testar/page.tsx`, `ag/[slug]/cabecalho-agente.tsx`, `ag/[slug]/skills/lista-skills.tsx`, `ag/[slug]/skills/page.tsx`, `ag/cartao-agente.tsx`, `ag/page.tsx` (ou onde o cartão recebe os dados), `apps/painel/src/lib/agentes.ts`, `lib/testar-setor.ts`, `lib/testar-setor.test.ts` (novos), `apps/painel/src/app/(painel)/treinar-agente/{acoes.ts,simulacao.ts,simulador.tsx,tela-orientacoes.tsx}`, `apps/painel/e2e/agente-orientacoes.spec.ts:34` | Testar dos setores, REVISAR | 14 |
| `apps/painel/e2e/drive-planilha.spec.ts`, `apps/painel/e2e/testar-agente-setor.spec.ts`, `apps/painel/e2e/apoio-drive.ts` (novos) | e2e | 15 |
| `docs/operacao.md`, `docs/design-system.md` | manuais | 16 |

---

### Task 1: Trabalhador. "Quem fala?" com assunto de setor em Mesma voz sai numa mensagem só (D1)

**Files:**
- Modify: `apps/trabalhador/src/agente/agentes-setor.ts` (só `CABECALHO_AGENTES_SETOR`), `apps/trabalhador/src/agente/especialista.ts` (só `TEXTO_MODO.mesma_voz`), `apps/trabalhador/src/agente/roteamento.ts` (avisos novos e o rebaixamento), `apps/trabalhador/src/agente/executar.ts` (a ordem da rodada e a trava), `apps/trabalhador/src/agente/ferramentas.ts` (só um campo opcional novo em `EstadoExecucao`)
- Create: `apps/trabalhador/test/agente/uma-mensagem.test.ts`

**Interfaces:**
- Consumes: `IaRoteirizada`, `fim`, `usarFerramentas` (`test/apoio/ia-roteirizada.ts`), `FISCAL` (`test/apoio/agente-setor.ts`; regra `r1` "Pedido de nota de venda" → `mesma_voz`), `CASOS_RETRATO` (`test/apoio/retrato.ts`), `executarAgente`, `AVISOS_AGENTE`.
- Produces: `AVISOS_AGENTE.mesmaRodada: string`, `AVISOS_AGENTE.rebaixado: string`; `EstadoExecucao.agenteFalouNaRodada?: boolean`. Nada que outra task use.

- [ ] **Step 1: Escreva os testes que falham** — `apps/trabalhador/test/agente/uma-mensagem.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Repos } from '@escritorio/db';
import { acessoTotal } from '../../src/agente/acesso';
import { CABECALHO_AGENTES_SETOR } from '../../src/agente/agentes-setor';
import type { ContextoAgente } from '../../src/agente/contexto';
import { TEXTO_MODO } from '../../src/agente/especialista';
import { executarAgente } from '../../src/agente/executar';
import type { ExecutorFerramentas } from '../../src/agente/ferramentas';
import { montarConteudoUsuario } from '../../src/agente/prompt';
import { AVISOS_AGENTE } from '../../src/agente/roteamento';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { FISCAL } from '../apoio/agente-setor';
import { CASOS_RETRATO } from '../apoio/retrato';

/** I3b (D1): "Oi, quem fala? Queria saber da nota do pedido 4512" — o cliente recebe uma mensagem só. */
function montar(roteiro: ConstructorParameters<typeof IaRoteirizada>[0], comAgente = true) {
  const base = CASOS_RETRATO['contato-uma-empresa']!();
  const ctx: ContextoAgente = comAgente ? { ...base, agentesSetor: [FISCAL], acessoFixo: acessoTotal(base.setores) } : base;
  const decisoes: { etapa: string; saida: Record<string, unknown> }[] = [];
  const repos = {
    registrarUsoIa: async () => {}, ultimasOrientacoesCortadas: async () => null, obterConversa: async () => ctx.conversa,
    registrarDecisao: async (x: { etapa: string; saida: Record<string, unknown> }) => { decisoes.push(x); },
    iniciarConducao: async () => true, encerrarConducao: async () => true,
  } as unknown as Repos;
  const chamadas: { nome: string; agente: string | null; texto: string | null }[] = [];
  const executor: ExecutorFerramentas = async (_d, estado, nome, entrada) => {
    chamadas.push({ nome, agente: estado.agenteSetor?.slug ?? null, texto: (entrada as { texto?: string }).texto ?? null });
    if (nome === 'responder') estado.respondeu = true;
    return { resultado: '{"enviado":true}', erro: false };
  };
  const ia = new IaRoteirizada(roteiro);
  const rodar = () => executarAgente({ repos, ia, envio: {} as never }, ctx, montarConteudoUsuario(ctx, [], [], []), executor);
  return { ia, decisoes, chamadas, rodar };
}
const chamar = { nome: 'chamar_agente', entrada: { agente: 'fiscal', assunto: 'Pedido de nota de venda', pedido: 'Cumprimentou, perguntou quem fala e quer saber da nota do pedido 4512' } };
const respThiago = { nome: 'responder', entrada: { texto: 'Oi, João! Aqui é o Thiago, do atendimento do escritório.' } };
const textoSistema = (p: { system?: unknown }) => (p.system as { text: string }[]).map((b) => b.text).join('\n');
const ultimoResultado = (p: { messages: { content: unknown }[] }, i = 0) =>
  (p.messages.at(-1)!.content as { content: string; is_error?: boolean; tool_use_id: string }[])[i]!;

describe('o cabeçalho e o modo Mesma voz (camada a)', () => {
  it('manda chamar o agente antes de mandar qualquer coisa quando há cumprimento ou "quem fala?" junto do assunto', () => {
    expect(CABECALHO_AGENTES_SETOR).toContain('"quem fala?"');
    expect(CABECALHO_AGENTES_SETOR).toContain('não mande nada antes');
    expect(CABECALHO_AGENTES_SETOR).toContain('Saudação ou agradecimento sem assunto de setor');
    expect(TEXTO_MODO.mesma_voz('Fiscal')).toContain('perguntou quem fala');
  });
});

describe('mesma rodada (camada b)', () => {
  it('responder + chamar_agente juntos: o agente fala primeiro e o responder do Thiago é recusado', async () => {
    const t = montar([
      usarFerramentas(respThiago, chamar),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi, João! Aqui é o Thiago, do atendimento do escritório. A nota do pedido 4512 está com o Fiscal.' } }),
      fim(),
      fim(),
    ]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:fiscal']);
    // O resultado volta na ordem do modelo: o 1º é o responder do Thiago (recusado), o 2º o chamar_agente.
    const recusa = ultimoResultado(t.ia.recebidos[3]!, 0);
    expect(recusa.is_error).toBe(true);
    expect(recusa.content).toContain(AVISOS_AGENTE.mesmaRodada);
    expect(ultimoResultado(t.ia.recebidos[3]!, 1).is_error).toBeFalsy();
  });
  it('sem chamar_agente na rodada, a ordem e o envio do Thiago não mudam', async () => {
    const t = montar([usarFerramentas(respThiago), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:thiago']);
  });
});

describe('rodadas seguidas (camada c)', () => {
  it('o Thiago já falou nesta vez: Mesma voz vira por trás e o Thiago repassa', async () => {
    const t = montar([
      usarFerramentas(respThiago),
      usarFerramentas(chamar),
      usarFerramentas({ nome: 'devolver_resposta', entrada: { resposta_ao_cliente: 'A nota do pedido 4512 sai hoje.', para_a_equipe: null } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'A nota do pedido 4512 sai hoje.' } }),
      fim(),
    ]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(textoSistema(t.ia.recebidos[2]!)).toContain('COMO VOCÊ FALA: por trás');
    expect(t.chamadas.map((c) => `${c.nome}:${c.agente ?? 'thiago'}`)).toEqual(['responder:thiago', 'responder:thiago']);
    const d = t.decisoes.find((x) => x.etapa === 'chamar_agente')!;
    expect(d.saida).toMatchObject({ modo: 'por_tras', modo_da_regra: 'mesma_voz', regra_id: 'r1', rebaixado: AVISOS_AGENTE.rebaixado });
  });
  it('o Thiago chamou primeiro: Mesma voz continua Mesma voz', async () => {
    const t = montar([usarFerramentas(chamar), usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi, João! Aqui é o Thiago. A nota sai hoje.' } }), fim(), fim()]);
    expect(await t.rodar()).toEqual({ status: 'ok' });
    expect(textoSistema(t.ia.recebidos[1]!)).toContain('COMO VOCÊ FALA: mesma voz');
    expect(t.decisoes.find((x) => x.etapa === 'chamar_agente')!.saida).toMatchObject({ modo: 'mesma_voz' });
    expect(t.decisoes.find((x) => x.etapa === 'chamar_agente')!.saida).not.toHaveProperty('modo_da_regra');
  });
});

describe('sem agente ativo nada muda', () => {
  it('as ferramentas e o sistema do Thiago não trazem chamar_agente nem o cabeçalho', async () => {
    const t = montar([usarFerramentas(respThiago), fim()], false);
    await t.rodar();
    expect((t.ia.recebidos[0]!.tools as { name: string }[]).map((x) => x.name)).not.toContain('chamar_agente');
    expect(textoSistema(t.ia.recebidos[0]!)).not.toContain('AGENTES DOS SETORES');
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `export PATH="$HOME/bin:$PATH" && pnpm --filter @escritorio/trabalhador exec vitest run test/agente/uma-mensagem.test.ts`
Expected: FAIL — `AVISOS_AGENTE.mesmaRodada` é `undefined`, o cabeçalho não tem "quem fala?", e no teste da mesma rodada `chamadas` traz `responder:thiago`.

- [ ] **Step 3: Camada (a): os dois textos** — em `apps/trabalhador/src/agente/agentes-setor.ts`, troque **só** o fim de `CABECALHO_AGENTES_SETOR` (a partir de `'O resultado diz o que fazer em seguida. '`) por:

```ts
  + 'Se a mensagem traz um assunto destes setores junto com um cumprimento ou uma pergunta como "quem fala?", não mande nada antes: '
  + 'chame chamar_agente primeiro e ponha o cumprimento no pedido; a resposta ao cliente sai numa mensagem só. '
  + 'O resultado diz o que fazer em seguida. Saudação ou agradecimento sem assunto de setor, assunto sensível (regra 11) e assuntos de outros '
  + 'setores continuam com você.';
```

Em `apps/trabalhador/src/agente/especialista.ts`, acrescente ao fim do texto de `mesma_voz` (antes do `,` que fecha a função):

```ts
  mesma_voz: () => 'COMO VOCÊ FALA: mesma voz. Responda ao cliente com a ferramenta responder, como se fosse o Thiago: para o cliente é uma '
    + 'conversa só. Se precisar se apresentar ou assinar, é "Thiago, do atendimento do escritório". Nunca diga que é outro agente, outro setor, '
    + 'especialista, assistente virtual ou inteligência artificial. Se o cliente cumprimentou ou perguntou quem fala, responda isso no começo da '
    + 'mesma mensagem (ex.: "Oi, João! Aqui é o Thiago, do atendimento do escritório.") e siga com o assunto.',
```

Confira que nenhum teste antigo fixa o texto trocado: `grep -rn "Saudações, agradecimentos\|especialista, assistente virtual ou inteligência artificial'" apps/trabalhador/test` → nenhum resultado (os testes antigos usam a constante ou trechos que continuam iguais).

- [ ] **Step 4: Camadas (b) e (c) no roteamento** — em `apps/trabalhador/src/agente/roteamento.ts`, acrescente ao objeto `AVISOS_AGENTE` (depois de `conduzindo`):

```ts
  /** I3b (D1b): o Thiago pediu para enviar na mesma rodada em que o agente do setor já respondeu; ele escreveu sem ver a resposta do agente. */
  mesmaRodada: 'O agente do setor já respondeu ao cliente nesta mensagem, com o cumprimento. Não mande mais nada sobre isso nesta vez.',
  /** I3b (D1c): gravado na decisão quando a Mesma voz vira por trás porque o Thiago já tinha falado nesta vez. */
  rebaixado: 'o Thiago já tinha mandado mensagem nesta vez',
```

E, em `chamarAgente`, troque o trecho que vai de `const { modo, regraId } = modoParaAssunto(...)` até `saida = ok(resultadoParaThiago(agente, modo, r));` por:

```ts
        const { modo: modoDaRegra, regraId } = modoParaAssunto(agente.regras, v.data.assunto, agente.modo);
        // I3b (D1c): o Thiago já falou nesta vez; uma segunda voz "como Thiago" seria a mensagem repetida. O agente devolve e o Thiago repassa.
        const rebaixou = modoDaRegra === 'mesma_voz' && estado.respondeu;
        const modo: ModoContato = rebaixou ? 'por_tras' : modoDaRegra;
        registro = { agente_id: agente.id, regra_id: regraId, modo, ...(rebaixou ? { modo_da_regra: modoDaRegra, rebaixado: AVISOS_AGENTE.rebaixado } : {}) };
        if (modo === 'passa_conversa') await d.repos.iniciarConducao(ctx.conversa.id, agente.id);
        let r: ResultadoAgente;
        try {
          r = await rodar({ tipo: 'especialista', agente, modo }, conteudoParaAgente(estado.conteudo ?? [], v.data.assunto, v.data.pedido));
        } catch (erro) {
          // F10: sem isso a conversa ficaria 24 h "com o agente" sem ele ter se apresentado. O erro original segue.
          if (modo === 'passa_conversa') {
            await d.repos.encerrarConducao(ctx.conversa.id, NAO_CONSEGUIU_SEGUIR)
              .catch((e2) => console.error('[agente] condução não encerrada depois do erro', ctx.conversa.id, e2));
          }
          throw erro;
        }
        if (modo === 'passa_conversa' && r.status !== 'ok') {
          // Revisão final (como a D24a): falha ao encerrar não derruba a vez do Thiago depois que o agente já falou (refazer duplicaria).
          await d.repos.encerrarConducao(ctx.conversa.id, r.status === 'devolvido' ? r.motivo : NAO_CONSEGUIU_SEGUIR)
            .catch((e) => console.error('[agente] condução não encerrada; o Thiago segue', ctx.conversa.id, e));
        }
        if (r.respondeu) {
          estado.respondeu = true;
          // I3b (D1b): o que o Thiago pediu para enviar nesta mesma rodada foi escrito sem ver a resposta do agente.
          estado.agenteFalouNaRodada = true;
        }
        // Devolveu, não conseguiu, ou passou a conversa: o Thiago não manda outra mensagem nesta vez (no ok de Mesma voz ele ainda trata outro assunto).
        if (r.respondeu && (r.status !== 'ok' || modo === 'passa_conversa')) {
          estado.agenteRespondeu = true;
          if (r.status === 'ok') estado.avisoTrava = AVISOS_AGENTE.conduzindo;
        }
        saida = ok(resultadoParaThiago(agente, modo, r));
```

(O `if (r.respondeu) estado.respondeu = true;` de antes fica dentro do novo bloco `if (r.respondeu) { … }`; nada mais muda na função.)

- [ ] **Step 5: O campo novo do estado** — em `apps/trabalhador/src/agente/ferramentas.ts`, no tipo `EstadoExecucao`, acrescente (junto dos outros opcionais da I2):

```ts
  /** I3b (D1b): o agente do setor chamado nesta rodada já mandou mensagem ao cliente; vale só até o fim da rodada. */
  agenteFalouNaRodada?: boolean;
```

- [ ] **Step 6: A ordem da rodada e a trava** — em `apps/trabalhador/src/agente/executar.ts`:

Em `despachar`, logo depois da linha `if (!estado.agenteSetor && estado.agenteRespondeu && ENVIAM.has(u.name)) return falha(...)`, acrescente:

```ts
  // I3b (D1b): na mesma rodada do chamar_agente, o que envia foi escrito antes de o agente responder ("Aqui é o Thiago" repetido).
  if (!estado.agenteSetor && estado.agenteFalouNaRodada && ENVIAM.has(u.name)) return falha(AVISOS_AGENTE.mesmaRodada);
```

No laço de `executarAgente`, troque:

```ts
    for (const u of usos) {
      const res = await despachar(d, estado, u, liberadas, executor, rodar);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
```

por:

```ts
    // I3b (D1b): com chamar_agente na rodada, o que envia ao cliente roda depois dele (o resto segue a ordem do modelo:
    // selecionar_empresa precisa valer antes de abrir_chamado e do próprio chamar_agente). Os resultados voltam na ordem do modelo.
    const ordem = usos.some((u) => u.name === 'chamar_agente')
      ? [...usos.filter((u) => !ENVIAM.has(u.name)), ...usos.filter((u) => ENVIAM.has(u.name))]
      : usos;
    estado.agenteFalouNaRodada = false;
    const porId = new Map<string, Resultado>();
    for (const u of ordem) porId.set(u.id, await despachar(d, estado, u, liberadas, executor, rodar));
    estado.agenteFalouNaRodada = false;
    for (const u of usos) {
      const res = porId.get(u.id)!;
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
```

- [ ] **Step 7: Rode os testes do trabalhador**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente` e depois `pnpm --filter @escritorio/trabalhador test` e `pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS em tudo, inclusive `uma-mensagem` (7), `retrato-thiago`, `motor-thiago`, `roteamento`, `especialista`, `sobras-i2`. `git status --short apps/trabalhador/test/agente/__retratos__` vazio. Se `roteamento.test.ts` ou outro teste antigo falhar, **pare** (é mudança de comportamento fora do "quem fala?").

- [ ] **Step 8: Cenário com Claude de verdade, 3 rodadas seguidas** (Supabase local nas portas 563xx — Restrições globais; memória ≥ 4 GB; nada mais rodando):

```bash
supabase db reset
pnpm --filter @escritorio/trabalhador cenarios "fiscal: Mesma voz"   # rodada 1
pnpm --filter @escritorio/trabalhador cenarios "fiscal: Mesma voz"   # rodada 2
pnpm --filter @escritorio/trabalhador cenarios "fiscal: Mesma voz"   # rodada 3
```

Depois de cada uma, anote passou/falhou e `select round(sum(custo_usd), 4) from uso_ia` (o executor limpa o banco a cada cenário: anote o custo que o executor imprime, ou rode a consulta antes da rodada seguinte). Expected: **3 de 3 passam**. Se uma falhar: veja as decisões (`select etapa, saida from decisoes_agente order by criado_em`); ajuste **só** o texto das camadas (a) (cabeçalho e/ou Mesma voz), rode o Step 7 de novo e recomece a contagem das 3 rodadas. No máximo 3 ajustes (~US$ 1,20 no total); se ainda falhar, **pare** e mostre as saídas. Depois das 3, rode uma vez `pnpm --filter @escritorio/trabalhador cenarios "fiscal:"` (todos os do Fiscal) para conferir que nada mais mudou: Expected: todos passam (um que falhe: rode **só ele** de novo uma vez; falhou de novo → pare e mostre).

- [ ] **Step 9: Devolva `config.toml` e `.env`** (Restrições globais, item 6) e confira `git status`.

- [ ] **Step 10: Commit**

```bash
git add apps/trabalhador/src/agente/agentes-setor.ts apps/trabalhador/src/agente/especialista.ts apps/trabalhador/src/agente/roteamento.ts \
  apps/trabalhador/src/agente/executar.ts apps/trabalhador/src/agente/ferramentas.ts apps/trabalhador/test/agente/uma-mensagem.test.ts
git commit -m "fix(agente): \"quem fala?\" com assunto do setor sai numa mensagem só em Mesma voz (I3b, D1)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Core. A pasta do cliente no Drive: link, o que ler e por que algo ficou de fora

**Files:**
- Create: `packages/core/src/drive.ts`, `packages/core/test/drive.test.ts`
- Modify: `packages/core/src/index.ts` (uma linha: `export * from './drive';`)

**Interfaces:**
- Consumes: `LIMITES_TAREFA`, `leituraDoArquivo` (`tarefas.ts`).
- Produces (Tasks 4, 6–8, 11–13):
  - `MIME_PASTA_DRIVE`, `MIME_ATALHO_DRIVE`, `EXPORTAR_DO_DRIVE: Record<string, { mime: MimeExportacao; extensao: 'pdf' | 'csv' }>`, `type MimeExportacao = 'application/pdf' | 'text/csv'`, `LIMITES_DRIVE = { profundidade: 3, itensListados: 300, saltosAteAPasta: 10 }`, `PADRAO_ID_DRIVE: RegExp`;
  - `pastaDoLink(texto: string): string | null`, `linkDaPasta(id: string): string`;
  - `type ItemDrive = { id: string; nome: string; mime: string; tamanho: number | null; modificadoEm: string; pais: string[] }`;
  - `type MotivoIgnorado = 'tipo' | 'grande' | 'atalho' | 'outra_pasta' | 'limite' | 'fora_da_pasta' | 'falha'`, `TEXTO_IGNORADO: Record<MotivoIgnorado, string>`;
  - `type ComoLer = { acao: 'baixar'; nome: string; mime: string } | { acao: 'exportar'; nome: string; mime: MimeExportacao } | { acao: 'ignorar'; motivo: MotivoIgnorado }`, `comoLerDoDrive(item: ItemDrive): ComoLer`;
  - `ehPasta(item: Pick<ItemDrive, 'mime'>): boolean`.

- [ ] **Step 1: Escreva o teste que falha** — `packages/core/test/drive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EXPORTAR_DO_DRIVE, LIMITES_TAREFA, MIME_ATALHO_DRIVE, MIME_PASTA_DRIVE, comoLerDoDrive, ehPasta, linkDaPasta, pastaDoLink, type ItemDrive } from '../src';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const item = (x: Partial<ItemDrive>): ItemDrive => ({ id: ID, nome: 'extrato.pdf', mime: 'application/pdf', tamanho: 1000, modificadoEm: '2026-10-01T10:00:00Z', pais: ['p'], ...x });

describe('pastaDoLink', () => {
  it('aceita os links que a pessoa copia do navegador e o código sozinho', () => {
    expect(pastaDoLink(`https://drive.google.com/drive/folders/${ID}`)).toBe(ID);
    expect(pastaDoLink(`https://drive.google.com/drive/u/0/folders/${ID}?usp=sharing`)).toBe(ID);
    expect(pastaDoLink(`  https://drive.google.com/open?id=${ID}  `)).toBe(ID);
    expect(pastaDoLink(ID)).toBe(ID);
    expect(linkDaPasta(ID)).toBe(`https://drive.google.com/drive/folders/${ID}`);
  });
  it('recusa o que não é pasta do Drive', () => {
    for (const t of ['', 'pasta do cliente', 'curto123', `http://drive.google.com/drive/folders/${ID}`, `https://example.com/drive/folders/${ID}`,
      `https://drive.google.com/file/d/${ID}/view`, `https://drive.google.com.evil.com/drive/folders/${ID}`, `${ID}/../x`]) {
      expect(pastaDoLink(t), t).toBeNull();
    }
  });
});

describe('comoLerDoDrive (D6)', () => {
  it('baixa os tipos da tarefa até 10 MB; o tipo vem da extensão', () => {
    expect(comoLerDoDrive(item({}))).toEqual({ acao: 'baixar', nome: 'extrato.pdf', mime: 'application/pdf' });
    expect(comoLerDoDrive(item({ nome: 'banco.OFX', mime: 'application/octet-stream' }))).toEqual({ acao: 'baixar', nome: 'banco.OFX', mime: 'text/plain' });
    expect(comoLerDoDrive(item({ tamanho: LIMITES_TAREFA.arquivoBytes + 1 }))).toEqual({ acao: 'ignorar', motivo: 'grande' });
  });
  it('exporta Docs e Slides em PDF e Sheets em CSV, sem repetir a extensão', () => {
    expect(comoLerDoDrive(item({ nome: 'Contrato', mime: 'application/vnd.google-apps.document', tamanho: null })))
      .toEqual({ acao: 'exportar', nome: 'Contrato.pdf', mime: 'application/pdf' });
    expect(comoLerDoDrive(item({ nome: 'Folha.csv', mime: 'application/vnd.google-apps.spreadsheet', tamanho: null })))
      .toEqual({ acao: 'exportar', nome: 'Folha.csv', mime: 'text/csv' });
    expect(EXPORTAR_DO_DRIVE['application/vnd.google-apps.presentation']!.extensao).toBe('pdf');
  });
  it('ignora atalho, pasta, tipo que o agente não lê e nome vazio', () => {
    expect(comoLerDoDrive(item({ mime: MIME_ATALHO_DRIVE }))).toEqual({ acao: 'ignorar', motivo: 'atalho' });
    expect(comoLerDoDrive(item({ nome: 'notas.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(comoLerDoDrive(item({ nome: 'Formulário', mime: 'application/vnd.google-apps.form' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(comoLerDoDrive(item({ nome: '   ' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(ehPasta({ mime: MIME_PASTA_DRIVE })).toBe(true);
    expect(() => comoLerDoDrive(item({ mime: MIME_PASTA_DRIVE }))).toThrow();
  });
  it('troca barras e caracteres de controle do nome e limita a 180', () => {
    const r = comoLerDoDrive(item({ nome: `a/b\\c\u0007${'x'.repeat(300)}.pdf` }));
    expect(r.acao).toBe('baixar');
    if (r.acao === 'baixar') {
      expect(r.nome).not.toMatch(/[/\\\u0000-\u001f]/);
      expect(r.nome.length).toBeLessThanOrEqual(180);
      expect(r.nome.endsWith('.pdf')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/core exec vitest run test/drive.test.ts`
Expected: FAIL — `pastaDoLink` não existe.

- [ ] **Step 3: Implemente** — `packages/core/src/drive.ts`:

```ts
/** Parte I3b (spec 7E.6; D5, D6, D8): a pasta do cliente no Google Drive — regras puras do painel e do trabalhador. */
import { LIMITES_TAREFA, leituraDoArquivo, mimeDoArquivo } from './tarefas';

export const MIME_PASTA_DRIVE = 'application/vnd.google-apps.folder';
export const MIME_ATALHO_DRIVE = 'application/vnd.google-apps.shortcut';
export type MimeExportacao = 'application/pdf' | 'text/csv';
/** D6: o que é do próprio Google vira um tipo que o agente lê (o Drive exporta só a primeira aba de uma planilha). */
export const EXPORTAR_DO_DRIVE: Record<string, { mime: MimeExportacao; extensao: 'pdf' | 'csv' }> = {
  'application/vnd.google-apps.document': { mime: 'application/pdf', extensao: 'pdf' },
  'application/vnd.google-apps.presentation': { mime: 'application/pdf', extensao: 'pdf' },
  'application/vnd.google-apps.spreadsheet': { mime: 'text/csv', extensao: 'csv' },
};
export const LIMITES_DRIVE = { profundidade: 3, itensListados: 300, saltosAteAPasta: 10 } as const;
/** Mesmo formato que o banco aceita em clientes.drive_pasta_id (20261017000100). */
export const PADRAO_ID_DRIVE = /^[A-Za-z0-9_-]{20,200}$/;

/** D8: o link copiado do navegador (ou só o código) → o código da pasta. null = não é uma pasta do Drive. */
export function pastaDoLink(texto: string): string | null {
  const t = texto.trim();
  if (PADRAO_ID_DRIVE.test(t)) return t;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'drive.google.com') return null;
  const m = /^\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]+)\/?$/.exec(u.pathname);
  const id = m?.[1] ?? (u.pathname === '/open' ? u.searchParams.get('id') : null);
  return id && PADRAO_ID_DRIVE.test(id) ? id : null;
}
export const linkDaPasta = (id: string): string => `https://drive.google.com/drive/folders/${id}`;

export type ItemDrive = { id: string; nome: string; mime: string; tamanho: number | null; modificadoEm: string; pais: string[] };
export const ehPasta = (i: Pick<ItemDrive, 'mime'>): boolean => i.mime === MIME_PASTA_DRIVE;

export type MotivoIgnorado = 'tipo' | 'grande' | 'atalho' | 'outra_pasta' | 'limite' | 'fora_da_pasta' | 'falha';
/** Na linha do tempo e na tela: por que um arquivo da pasta não entrou na tarefa. */
export const TEXTO_IGNORADO: Record<MotivoIgnorado, string> = {
  tipo: 'o agente não lê este tipo',
  grande: 'passa de 10 MB',
  atalho: 'é um atalho (o agente não segue atalhos)',
  outra_pasta: 'é a pasta de outro cliente',
  limite: 'a tarefa já tem 30 arquivos',
  fora_da_pasta: 'está fora da pasta deste cliente',
  falha: 'o Drive não entregou o arquivo',
};

export type ComoLer =
  | { acao: 'baixar'; nome: string; mime: string }
  | { acao: 'exportar'; nome: string; mime: MimeExportacao }
  | { acao: 'ignorar'; motivo: MotivoIgnorado };

// Nome que vira nome de arquivo da tarefa: sem barra nem controle (o Storage e o download usam), até 180 com a extensão.
function nomeLimpo(nome: string, extensao: string | null): string {
  const base = nome.replace(/[\u0000-\u001f\u007f/\\]+/g, ' ').replace(/\s+/g, ' ').trim();
  const comExt = extensao && !base.toLowerCase().endsWith(`.${extensao}`) ? `${base}.${extensao}` : base;
  if (comExt.length <= 180) return comExt;
  const ext = /\.[A-Za-z0-9]{1,5}$/.exec(comExt)?.[0] ?? '';
  return `${comExt.slice(0, 180 - ext.length).trimEnd()}${ext}`;
}

/** D6: o que fazer com um arquivo da pasta. Pasta não chega aqui (quem lista desce nela). */
export function comoLerDoDrive(i: ItemDrive): ComoLer {
  if (ehPasta(i)) throw new Error('comoLerDoDrive: pasta não é arquivo');
  if (i.mime === MIME_ATALHO_DRIVE) return { acao: 'ignorar', motivo: 'atalho' };
  if (!i.nome.trim()) return { acao: 'ignorar', motivo: 'tipo' };
  const exportar = EXPORTAR_DO_DRIVE[i.mime];
  if (exportar) return { acao: 'exportar', nome: nomeLimpo(i.nome, exportar.extensao), mime: exportar.mime };
  if (i.mime.startsWith('application/vnd.google-apps.')) return { acao: 'ignorar', motivo: 'tipo' };
  const nome = nomeLimpo(i.nome, null);
  if (!leituraDoArquivo(nome)) return { acao: 'ignorar', motivo: 'tipo' };
  if (i.tamanho !== null && i.tamanho > LIMITES_TAREFA.arquivoBytes) return { acao: 'ignorar', motivo: 'grande' };
  return { acao: 'baixar', nome, mime: mimeDoArquivo(nome) };
}
```

E em `packages/core/src/index.ts`, acrescente `export * from './drive';`.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/core test && pnpm --filter @escritorio/core typecheck`
Expected: PASS (os 125 de antes + os novos).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/drive.ts packages/core/src/index.ts packages/core/test/drive.test.ts
git commit -m "feat(core): pasta do cliente no Drive — link, o que ler e o que fica de fora (I3b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Core. A planilha (XLSX) do resultado, sem dependência

**Files:**
- Create: `packages/core/src/planilha.ts`, `packages/core/test/planilha.test.ts`
- Modify: `packages/core/src/tarefas.ts` (acrescenta `contarProvisorias` no fim), `packages/core/src/index.ts` (`export * from './planilha';`)

**Interfaces:**
- Consumes: `ResultadoTarefa`, `TipoPendencia` (`tarefas.ts`).
- Produces (Task 13):
  - `type PendenciaPlanilha = { numero: number; tipo: TipoPendencia; pergunta: string; estado: 'aberta' | 'respondida'; resposta: string | null }`;
  - `type CelulaPlanilha = string | number | null`, `type AbaPlanilha = { nome: string; colunas: { titulo: string; largura: number; dinheiro?: boolean }[]; linhas: CelulaPlanilha[][] }`;
  - `abasDoResultado(r: ResultadoTarefa, pendencias: readonly PendenciaPlanilha[]): AbaPlanilha[]`;
  - `partesDaPlanilha(abas: readonly AbaPlanilha[]): Record<string, string>` (caminho no zip → XML);
  - `MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'`;
  - `contarProvisorias(r: ResultadoTarefa | null): number` (em `tarefas.ts`).

- [ ] **Step 1: Escreva o teste que falha** — `packages/core/test/planilha.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { abasDoResultado, contarProvisorias, partesDaPlanilha, type ResultadoTarefa } from '../src';

const R: ResultadoTarefa = {
  versao: 1, resumo: '3 lançamentos', observacoes: null,
  destaques: [{ rotulo: 'Saídas', valor: 'R$ 1.980,55', detalhe: 'DAS' }],
  linhas: [
    { descricao: 'DAS Simples Nacional', valor: -1980.55, texto: null, fonte: 'extrato.csv', provisoria: false },
    { descricao: '=HYPERLINK("http://x")', valor: null, texto: '+cmd|calc', fonte: '@fonte', provisoria: true },
    { descricao: 'Pão & <café> "especial" 🍞\u0007', valor: 0, texto: null, fonte: 'pendência 2', provisoria: false },
  ],
};
const P = [{ numero: 1, tipo: 'cliente' as const, pergunta: 'Extrato do BB', estado: 'aberta' as const, resposta: null }];

describe('abasDoResultado (D10)', () => {
  it('três abas com cabeçalho; valores como número; null fica vazio', () => {
    const [res, dest, pend] = abasDoResultado(R, P);
    expect([res!.nome, dest!.nome, pend!.nome]).toEqual(['Resultado', 'Destaques', 'Pendências']);
    expect(res!.colunas.map((c) => c.titulo)).toEqual(['Descrição', 'Valor', 'Texto', 'Fonte', 'Provisória']);
    expect(res!.linhas[0]).toEqual(['DAS Simples Nacional', -1980.55, null, 'extrato.csv', 'não']);
    expect(res!.linhas[1]![1]).toBeNull();
    expect(res!.linhas[1]![4]).toBe('sim');
    expect(pend!.linhas[0]).toEqual([1, 'Do cliente', 'Extrato do BB', 'Aberta', null]);
    expect(partesDaPlanilha([pend!])['xl/worksheets/sheet1.xml']).toContain('<c r="A2"><v>1</v></c>');
  });
});

describe('partesDaPlanilha', () => {
  const partes = partesDaPlanilha(abasDoResultado(R, P));
  it('tem as partes mínimas de um XLSX', () => {
    expect(Object.keys(partes).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
      'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml']);
    expect(partes['xl/workbook.xml']).toContain('<sheet name="Pendências" sheetId="3" r:id="rId3"/>');
    expect(partes['[Content_Types].xml']).toContain('/xl/worksheets/sheet3.xml');
  });
  it('texto é sempre célula de texto (nada vira fórmula) e o XML é escapado', () => {
    const s1 = partes['xl/worksheets/sheet1.xml']!;
    expect(s1).not.toContain('<f>');
    expect(s1).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;)</t></is></c>');
    expect(s1).toContain('Pão &amp; &lt;café&gt; &quot;especial&quot; 🍞');
    expect(s1).not.toContain('\u0007');
  });
  it('número com o formato de dinheiro (estilo 2) e cabeçalho em negrito (estilo 1)', () => {
    const s1 = partes['xl/worksheets/sheet1.xml']!;
    expect(s1).toContain('<c r="B2" s="2"><v>-1980.55</v></c>');
    expect(s1).toContain('<c r="B4" s="2"><v>0</v></c>');
    expect(s1).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(partes['xl/styles.xml']).toContain('formatCode="#,##0.00"');
  });
  it('mesmo resultado, mesmas partes', () => {
    expect(partesDaPlanilha(abasDoResultado(R, P))).toEqual(partes);
  });
  it('500 linhas cabem', () => {
    const muitas = { ...R, linhas: Array.from({ length: 500 }, (_, i) => ({ descricao: `L${i}`, valor: i, texto: null, fonte: 'x.csv', provisoria: false })) };
    expect(partesDaPlanilha(abasDoResultado(muitas, []))['xl/worksheets/sheet1.xml']).toContain('<row r="501">');
  });
});

describe('contarProvisorias', () => {
  it('conta as linhas provisórias; sem resultado é 0', () => {
    expect(contarProvisorias(R)).toBe(1);
    expect(contarProvisorias(null)).toBe(0);
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/core exec vitest run test/planilha.test.ts`
Expected: FAIL — `abasDoResultado` não existe.

- [ ] **Step 3: Implemente** — no fim de `packages/core/src/tarefas.ts`:

```ts
/** I3b (D15b): a Aprovação avisa quando o rascunho ainda tem linha provisória. */
export const contarProvisorias = (r: ResultadoTarefa | null): number => (r ? r.linhas.filter((l) => l.provisoria).length : 0);
```

E `packages/core/src/planilha.ts`:

```ts
/**
 * Parte I3b (D10): a planilha do resultado, montada pelo nosso código a partir das linhas (nada roda na Anthropic, D16 da I3a).
 * Só as partes XML: quem entrega compacta (o painel usa fflate). Texto vai sempre como célula de texto: nada vira fórmula.
 */
import { ROTULO_TIPO_PENDENCIA, type ResultadoTarefa, type TipoPendencia } from './tarefas';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export type PendenciaPlanilha = { numero: number; tipo: TipoPendencia; pergunta: string; estado: 'aberta' | 'respondida'; resposta: string | null };
export type CelulaPlanilha = string | number | null;
export type AbaPlanilha = { nome: string; colunas: { titulo: string; largura: number; dinheiro?: boolean }[]; linhas: CelulaPlanilha[][] };

export function abasDoResultado(r: ResultadoTarefa, pendencias: readonly PendenciaPlanilha[]): AbaPlanilha[] {
  return [
    {
      nome: 'Resultado',
      colunas: [{ titulo: 'Descrição', largura: 50 }, { titulo: 'Valor', largura: 16, dinheiro: true }, { titulo: 'Texto', largura: 30 },
        { titulo: 'Fonte', largura: 30 }, { titulo: 'Provisória', largura: 11 }],
      linhas: r.linhas.map((l) => [l.descricao, l.valor, l.texto, l.fonte, l.provisoria ? 'sim' : 'não']),
    },
    {
      nome: 'Destaques',
      colunas: [{ titulo: 'Destaque', largura: 30 }, { titulo: 'Valor', largura: 20 }, { titulo: 'Detalhe', largura: 40 }],
      linhas: [['Resumo', r.resumo, r.observacoes], ...r.destaques.map((d): CelulaPlanilha[] => [d.rotulo, d.valor, d.detalhe])],
    },
    {
      nome: 'Pendências',
      colunas: [{ titulo: 'Nº', largura: 6 }, { titulo: 'Para quem', largura: 16 }, { titulo: 'Pergunta', largura: 50 },
        { titulo: 'Situação', largura: 12 }, { titulo: 'Resposta', largura: 50 }],
      linhas: pendencias.map((p) => [p.numero, ROTULO_TIPO_PENDENCIA[p.tipo], p.pergunta, p.estado === 'aberta' ? 'Aberta' : 'Respondida', p.resposta]),
    },
  ];
}

// XML 1.0 não aceita caracteres de controle (exceto tab e quebras): saem antes de escapar.
const xml = (v: string) => v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function coluna(n: number): string {
  let s = '';
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}
const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Estilo 1 = cabeçalho em negrito; 2 = dinheiro (#,##0.00); 0 = normal (o Nº da pendência fica "1", não "1,00").
function celula(ref: string, v: CelulaPlanilha, estilo: 0 | 1 | 2): string {
  if (v === null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${estilo === 0 ? '' : ` s="${estilo}"`}><v>${v}</v></c>`;
  const s = estilo === 1 ? ' s="1"' : '';
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
}

function folha(a: AbaPlanilha): string {
  const cols = a.colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"/>`).join('');
  const linhas = [a.colunas.map((c) => c.titulo), ...a.linhas].map((l, i) => {
    const r = i + 1;
    return `<row r="${r}">${l.map((v, j) => celula(`${coluna(j)}${r}`, v, i === 0 ? 1 : a.colunas[j]?.dinheiro ? 2 : 0)).join('')}</row>`;
  });
  return `${CABECALHO_XML}<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`
    + `</sheetView></sheetViews><cols>${cols}</cols><sheetData>${linhas.join('')}</sheetData></worksheet>`;
}

const ESTILOS = `${CABECALHO_XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** As partes do pacote XLSX (Office Open XML), na ordem estável: o mesmo resultado dá as mesmas partes. */
export function partesDaPlanilha(abas: readonly AbaPlanilha[]): Record<string, string> {
  const n = abas.length;
  const partes: Record<string, string> = {
    '[Content_Types].xml': `${CABECALHO_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `${CABECALHO_XML}<workbook ${NS}><sheets>`
      + abas.map((a, i) => `<sheet name="${xml(a.nome.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': ESTILOS,
  };
  abas.forEach((a, i) => { partes[`xl/worksheets/sheet${i + 1}.xml`] = folha(a); });
  return partes;
}
```

E `export * from './planilha';` em `packages/core/src/index.ts`. Confira que `ROTULO_TIPO_PENDENCIA.cliente` é "Do cliente" (`tarefas.ts`): o teste espera esse texto.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/core test && pnpm --filter @escritorio/core typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/planilha.ts packages/core/src/tarefas.ts packages/core/src/index.ts packages/core/test/planilha.test.ts
git commit -m "feat(core): planilha XLSX do resultado montada pelo nosso código, sem dependência (I3b, D10)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Banco. A pasta do cliente, a situação do Drive e os arquivos do Drive na tarefa

**Files:**
- Create: `supabase/migrations/20261017000100_painel_v2_drive.sql`, `supabase/tests/53_painel_v2_drive.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `interno.tarefa_da_pessoa`, `interno.evento_tarefa`, `interno.extensao_aceita`, `interno.nome_livre_na_tarefa` (I3a, `20261016000200`), `public.tem_permissao(text, text)`, `public.eh_usuario_ativo()`.
- Produces (Tasks 6, 8, 12, 13):
  - `clientes.drive_pasta_id text` (único quando preenchido; formato `^[A-Za-z0-9_-]{20,200}$`, igual a `PADRAO_ID_DRIVE` do core);
  - tabela `drive_conta (id = 1, email, erro, verificado_em)` — leitura por pessoa ativa;
  - `agente_tarefa_arquivos.origem` aceita `'drive'`; colunas `drive_id text`, `drive_modificado_em timestamptz`;
  - `salvar_pasta_drive(p_cliente uuid, p_pasta text) returns text` (authenticated) — frases: "Você não tem permissão para editar clientes.", "Cliente não encontrado.", "Cole o link da pasta do Drive (drive.google.com/drive/folders/…).", "Esta pasta do Drive já é de outro cliente.";
  - `pedir_leitura_da_pasta(p_tarefa uuid) returns boolean` (authenticated) — frases: "A tarefa já foi decidida.", "O cliente desta demanda não tem pasta no Drive. Preencha na ficha do cliente, em Arquivos.", "A pasta já está sendo lida. Espere um pouco."; evento "pediu para ler a pasta do Drive de novo";
  - `pasta_drive_da_tarefa(p_tarefa uuid) returns jsonb` (service_role) — `{ estado, cliente_id, pasta, outras: text[], importados: [{drive_id, modificado_em}], total }` ou `null`;
  - `registrar_arquivo_drive(p_tarefa uuid, p_caminho text, p_nome text, p_mime text, p_tamanho int, p_drive_id text, p_modificado timestamptz) returns jsonb` (service_role) — `{ id, nome }`; frases: "Tarefa não encontrada.", "A tarefa já foi decidida.", "O cliente não tem pasta no Drive.", "Código do Drive inválido.", "Arquivo não encontrado no envio.", "O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.", "O arquivo está vazio.", "O arquivo passa de 10 MB.", "Este arquivo do Drive já está na tarefa.", "No máximo 30 arquivos por tarefa.";
  - `registrar_situacao_drive(p_email text, p_erro text) returns void` (service_role).

- [ ] **Step 1: Confira o que não pode quebrar** — `grep -n "columns_are\|has_column\|col_is\|origem" supabase/tests/5[0-2]_*.sql | head -20`. Se algum teste antigo listar **todas** as colunas de `agente_tarefa_arquivos` ou de `clientes`, ou conferir a lista exata do `check` de `origem`, **pare** e avise (acrescentar coluna quebraria). Confira também o nome do `check` de origem: `select conname from pg_constraint where conrelid = 'public.agente_tarefa_arquivos'::regclass and contype = 'c'` (no banco local) — o esperado é `agente_tarefa_arquivos_origem_check`; se for outro, use o nome real no Step 3.

- [ ] **Step 2: Escreva o pgTAP que falha** — `supabase/tests/53_painel_v2_drive.test.sql`:

```sql
-- Parte I3b, Task 4 (spec 7E.6; D4, D5, D8, D9): a pasta do cliente no Drive, a situação da conta e os arquivos do Drive na tarefa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('fb000000-0000-0000-0000-00000000000a', 'claudia@i3d.local'), ('fb000000-0000-0000-0000-00000000000b', 'paula@i3d.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fb000000-0000-0000-0000-00000000000a', 'I3D Cláudia', 'claudia@i3d.local', 'atendente', '{editar_clientes}'),
  ('fb000000-0000-0000-0000-00000000000b', 'I3D Paula', 'paula@i3d.local', 'atendente', '{}');
insert into public.usuario_setores (usuario_id, setor_id) values
  ('fb000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil')),
  ('fb000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal'));
update public.usuario_permissoes set nivel = 'todas' where modulo = 'demandas' and usuario_id = 'fb000000-0000-0000-0000-00000000000b';
insert into public.clientes (id, razao_social, cnpj) values
  ('fb100000-0000-0000-0000-00000000000a', 'I3D Padaria Sol', '21448390000107'), ('fb100000-0000-0000-0000-00000000000b', 'I3D Mercearia Lua', '11222333000181');
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fb200000-0000-0000-0000-00000000000a', 'fb100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento de outubro');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos) values
  ('fb300000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'fb200000-0000-0000-0000-00000000000a',
   'fb100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechar outubro', 2, 20);
insert into storage.objects (bucket_id, name) values
  ('tarefas', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf'),
  ('tarefas', 'fb300000-0000-0000-0000-00000000000a/drive/1DocxDoDriveAbcdefghi-1.docx'),
  ('tarefas', 'fb300000-0000-0000-0000-00000000000a/outra/1PdfDoDriveAbcdefghij-2.pdf');

-- 1–4: as colunas e a tabela
select has_column('public', 'clientes', 'drive_pasta_id', 'clientes.drive_pasta_id');
select throws_ok($$ update public.clientes set drive_pasta_id = 'curta' where id = 'fb100000-0000-0000-0000-00000000000a' $$, '23514', null, 'formato do código da pasta');
select has_table('public', 'drive_conta', 'drive_conta');
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('drive_conta')), 0, 'drive_conta fora do Realtime');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 5: Paula não edita clientes
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000a', '1PastaDaPadariaSolAbcdefghij') $$,
  'P0001', 'Você não tem permissão para editar clientes.', 'sem editar clientes: recusa');
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 6–10: Cláudia salva, limpa, e a pasta é de um cliente só
select is(public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000a', ' 1PastaDaPadariaSolAbcdefghij '), '1PastaDaPadariaSolAbcdefghij', 'salva o código sem espaços');
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000b', '1PastaDaPadariaSolAbcdefghij') $$,
  'P0001', 'Esta pasta do Drive já é de outro cliente.', 'pasta de outro cliente: recusa');
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000b', 'https://drive.google.com/x') $$,
  'P0001', 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).', 'link cru: o painel converte antes');
select is(public.salvar_pasta_drive('fb100000-0000-0000-0000-00000000000b', '1PastaDaMerceariaLuaAbcdefgh'), '1PastaDaMerceariaLuaAbcdefgh', 'Lua com a pasta dela');
select throws_ok($$ select public.salvar_pasta_drive('fb100000-0000-0000-0000-0000000000ff', '1PastaQueNaoExisteAbcdefghij') $$,
  'P0001', 'Cliente não encontrado.', 'cliente que não existe');
-- 11–12: a situação do Drive: pessoa ativa lê; ninguém grava pela API
select is((select count(*)::int from public.drive_conta), 0, 'sem situação gravada ainda');
select throws_ok($$ insert into public.drive_conta (id, email) values (1, 'x@y.z') $$, '42501', null, 'pessoa não grava a situação');
-- 13–14: só o trabalhador
select throws_ok($$ select public.registrar_situacao_drive('x@y.z', null) $$, '42501', null, 'pessoa não chama registrar_situacao_drive');
select throws_ok($$ select public.pasta_drive_da_tarefa('fb300000-0000-0000-0000-00000000000a') $$, '42501', null, 'pessoa não chama pasta_drive_da_tarefa');
-- 15–17: LER A PASTA DE NOVO
select is(public.pedir_leitura_da_pasta('fb300000-0000-0000-0000-00000000000a'), true, 'Cláudia pede a leitura');
select is((select texto from public.agente_tarefa_eventos where tarefa_id = 'fb300000-0000-0000-0000-00000000000a' order by criado_em desc limit 1),
  'pediu para ler a pasta do Drive de novo', 'evento na linha do tempo');
select throws_ok($$ select public.pedir_leitura_da_pasta('fb300000-0000-0000-0000-00000000000a') $$,
  'P0001', 'A pasta já está sendo lida. Espere um pouco.', 'duas vezes em 2 minutos: recusa');
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 18: quem não é do setor não pede
select throws_ok($$ select public.pedir_leitura_da_pasta('fb300000-0000-0000-0000-00000000000a') $$,
  'P0001', 'Só quem é do setor da demanda mexe na tarefa do agente.', 'outro setor: recusa');

reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;
-- 19–20: o que o trabalhador recebe
select is((public.pasta_drive_da_tarefa('fb300000-0000-0000-0000-00000000000a') ->> 'pasta'), '1PastaDaPadariaSolAbcdefghij', 'a pasta da Padaria');
select is((public.pasta_drive_da_tarefa('fb300000-0000-0000-0000-00000000000a') -> 'outras'), '["1PastaDaMerceariaLuaAbcdefgh"]'::jsonb, 'as pastas dos outros clientes (D5)');
-- 21–26: registrar arquivo do Drive
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/outra/1PdfDoDriveAbcdefghij-2.pdf',
  'extrato.pdf', 'application/pdf', 100, '1PdfDoDriveAbcdefghij', '2026-10-01') $$, 'P0001', 'Arquivo não encontrado no envio.', 'caminho fora de <tarefa>/drive/');
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1DocxDoDriveAbcdefghi-1.docx',
  'contrato.docx', 'application/octet-stream', 100, '1DocxDoDriveAbcdefghi', '2026-10-01') $$, 'P0001', 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.', 'tipo não aceito');
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato.pdf', 'application/pdf', 100, 'x', '2026-10-01') $$, 'P0001', 'Código do Drive inválido.', 'código inválido');
select is((public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato.pdf', 'application/pdf', 100, '1PdfDoDriveAbcdefghij', '2026-10-01') ->> 'nome'), 'extrato.pdf', 'registra o arquivo do Drive');
select is((select origem || ':' || drive_id from public.agente_tarefa_arquivos where tarefa_id = 'fb300000-0000-0000-0000-00000000000a'),
  'drive:1PdfDoDriveAbcdefghij', 'origem drive com o código');
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato.pdf', 'application/pdf', 100, '1PdfDoDriveAbcdefghij', '2026-10-01') $$, 'P0001', 'Este arquivo do Drive já está na tarefa.', 'o mesmo arquivo não entra duas vezes');
-- 27: cliente sem pasta (a pessoa limpou no meio): o banco recusa
reset role;
update public.clientes set drive_pasta_id = null where id = 'fb100000-0000-0000-0000-00000000000a';
set local role service_role;
select throws_ok($$ select public.registrar_arquivo_drive('fb300000-0000-0000-0000-00000000000a', 'fb300000-0000-0000-0000-00000000000a/drive/1PdfDoDriveAbcdefghij-1.pdf',
  'extrato2.pdf', 'application/pdf', 100, '1OutroPdfAbcdefghijkl', '2026-10-01') $$, 'P0001', 'O cliente não tem pasta no Drive.', 'sem pasta: recusa (D5, barreira 4)');
-- 28: situação gravada pelo trabalhador
select lives_ok($$ select public.registrar_situacao_drive('drive@escritorio.iam.gserviceaccount.com', null) $$, 'o trabalhador grava a situação');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fb000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 29–30: quem vê a demanda lê a situação e o arquivo do Drive (D9, D20 da I3a)
select is((select email from public.drive_conta), 'drive@escritorio.iam.gserviceaccount.com', 'pessoa ativa lê a situação');
select is((select count(*)::int from public.agente_tarefa_arquivos where tarefa_id = 'fb300000-0000-0000-0000-00000000000a'), 1, 'quem vê a demanda vê o arquivo do Drive');

select * from finish();
rollback;
```

(Se o `insert` direto em `storage.objects` do começo pedir colunas que o I3a não precisou, copie a forma das linhas 176–181 de `51_painel_v2_tarefas_painel.test.sql`. Se `usuarios.permissoes = '{editar_clientes}'` não der o nível "editar" em clientes no banco local, use `update public.usuario_permissoes set nivel = 'editar' where modulo = 'clientes' and usuario_id = …`, como o 49 faz com "notas".)

- [ ] **Step 3: Rode e veja falhar**

Run: `supabase db reset && supabase test db supabase/tests/53_painel_v2_drive.test.sql`
Expected: FAIL (coluna e funções não existem).

- [ ] **Step 4: Escreva a migração** — `supabase/migrations/20261017000100_painel_v2_drive.sql`:

```sql
-- supabase/migrations/20261017000100_painel_v2_drive.sql
-- Painel v2, Parte I3b (spec 7E.6; D3–D9): a pasta do cliente no Google Drive. Só acréscimos; as funções da I3a não mudam aqui.
-- Nada entra no Realtime (teste 22). A chave da conta de serviço nunca entra no banco (D3): só o e-mail e o último erro.

-- D8: "Pasta no Drive" (o código; o painel converte o link). Uma pasta é de um cliente só.
alter table public.clientes add column drive_pasta_id text
  check (drive_pasta_id is null or drive_pasta_id ~ '^[A-Za-z0-9_-]{20,200}$');
create unique index clientes_drive_pasta_unica on public.clientes (drive_pasta_id) where drive_pasta_id is not null;

-- D9: a situação da conta de serviço, gravada pelo trabalhador ao ligar e a cada leitura de pasta.
create table public.drive_conta (
  id int primary key default 1 check (id = 1),
  email text check (email is null or char_length(email) <= 320),
  erro text check (erro is null or char_length(erro) <= 300),
  verificado_em timestamptz not null default now()
);
alter table public.drive_conta enable row level security;
create policy leitura on public.drive_conta for select to authenticated using (public.eh_usuario_ativo());
revoke all on public.drive_conta from anon;
revoke insert, update, delete, truncate on public.drive_conta from authenticated, service_role;

-- D4: o arquivo do Drive é copiado para a tarefa, com o código e a data de modificação (o mesmo não entra duas vezes).
alter table public.agente_tarefa_arquivos drop constraint agente_tarefa_arquivos_origem_check;
alter table public.agente_tarefa_arquivos add constraint agente_tarefa_arquivos_origem_check check (origem in ('enviado', 'conversa', 'drive'));
alter table public.agente_tarefa_arquivos
  add column drive_id text check (drive_id is null or drive_id ~ '^[A-Za-z0-9_-]{10,200}$'),
  add column drive_modificado_em timestamptz,
  add constraint agente_tarefa_arquivos_drive_check check ((origem = 'drive') = (drive_id is not null));
create index agente_tarefa_arquivos_drive_idx on public.agente_tarefa_arquivos (tarefa_id, drive_id) where drive_id is not null;

-- ---------- O que a pessoa faz ----------
create function public.salvar_pasta_drive(p_cliente uuid, p_pasta text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text := nullif(btrim(coalesce(p_pasta, '')), '');
begin
  if not public.eh_usuario_ativo() then raise exception 'Cliente não encontrado.'; end if;
  if not public.tem_permissao('clientes', 'editar') then raise exception 'Você não tem permissão para editar clientes.'; end if;
  if not exists (select 1 from public.clientes where id = p_cliente and ativo) then raise exception 'Cliente não encontrado.'; end if;
  if v is not null and v !~ '^[A-Za-z0-9_-]{20,200}$' then
    raise exception 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).';
  end if;
  if v is not null and exists (select 1 from public.clientes where drive_pasta_id = v and id <> p_cliente) then
    raise exception 'Esta pasta do Drive já é de outro cliente.';
  end if;
  update public.clientes set drive_pasta_id = v where id = p_cliente;
  return v;
end $$;
revoke execute on function public.salvar_pasta_drive(uuid, text) from public, anon, service_role;
grant execute on function public.salvar_pasta_drive(uuid, text) to authenticated;

-- D7: LER A PASTA DE NOVO (pessoa do setor; o painel enfileira em pasta_drive). Uma a cada 2 minutos por tarefa.
create function public.pedir_leitura_da_pasta(p_tarefa uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype;
begin
  if not public.eh_usuario_ativo() then raise exception 'Tarefa não encontrada.'; end if;
  t := interno.tarefa_da_pessoa(p_tarefa);
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if not exists (select 1 from public.clientes c where c.id = t.cliente_id and c.drive_pasta_id is not null) then
    raise exception 'O cliente desta demanda não tem pasta no Drive. Preencha na ficha do cliente, em Arquivos.';
  end if;
  if exists (select 1 from public.agente_tarefa_eventos where tarefa_id = p_tarefa and texto = 'pediu para ler a pasta do Drive de novo'
             and criado_em > now() - interval '2 minutes') then
    raise exception 'A pasta já está sendo lida. Espere um pouco.';
  end if;
  perform interno.evento_tarefa(p_tarefa, 'pessoa', 'pediu para ler a pasta do Drive de novo');
  return true;
end $$;
revoke execute on function public.pedir_leitura_da_pasta(uuid) from public, anon, service_role;
grant execute on function public.pedir_leitura_da_pasta(uuid) to authenticated;

-- ---------- O que só o trabalhador chama ----------
-- D5: a pasta deste cliente, as pastas de todos os outros (para não descer nelas) e o que já foi copiado.
create function public.pasta_drive_da_tarefa(p_tarefa uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'estado', t.estado, 'cliente_id', t.cliente_id, 'pasta', c.drive_pasta_id,
    'outras', coalesce((select jsonb_agg(o.drive_pasta_id order by o.drive_pasta_id) from public.clientes o
                         where o.drive_pasta_id is not null and o.id is distinct from t.cliente_id), '[]'::jsonb),
    'importados', coalesce((select jsonb_agg(jsonb_build_object('drive_id', a.drive_id, 'modificado_em', a.drive_modificado_em))
                              from public.agente_tarefa_arquivos a where a.tarefa_id = t.id and a.drive_id is not null), '[]'::jsonb),
    'total', (select count(*) from public.agente_tarefa_arquivos a where a.tarefa_id = t.id))
  from public.agente_tarefas t left join public.clientes c on c.id = t.cliente_id
  where t.id = p_tarefa
$$;

-- D4, D5 (barreira 4): só para tarefa ativa de cliente com pasta, com o objeto já em <tarefa>/drive/ no compartimento "tarefas".
create function public.registrar_arquivo_drive(p_tarefa uuid, p_caminho text, p_nome text, p_mime text, p_tamanho int, p_drive_id text,
  p_modificado timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t public.agente_tarefas%rowtype; v_id uuid; v_nome text;
begin
  select * into t from public.agente_tarefas where id = p_tarefa for update;
  if not found then raise exception 'Tarefa não encontrada.'; end if;
  if t.estado in ('aprovada', 'descartada') then raise exception 'A tarefa já foi decidida.'; end if;
  if not exists (select 1 from public.clientes c where c.id = t.cliente_id and c.drive_pasta_id is not null) then
    raise exception 'O cliente não tem pasta no Drive.';
  end if;
  if p_drive_id is null or p_drive_id !~ '^[A-Za-z0-9_-]{10,200}$' then raise exception 'Código do Drive inválido.'; end if;
  if p_caminho is null or left(p_caminho, 43) <> p_tarefa::text || '/drive/'
     or not exists (select 1 from storage.objects where bucket_id = 'tarefas' and name = p_caminho) then
    raise exception 'Arquivo não encontrado no envio.';
  end if;
  if not interno.extensao_aceita(p_nome) then raise exception 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.'; end if;
  if p_tamanho is null or p_tamanho < 1 then raise exception 'O arquivo está vazio.'; end if;
  if p_tamanho > 10485760 then raise exception 'O arquivo passa de 10 MB.'; end if;
  if exists (select 1 from public.agente_tarefa_arquivos where tarefa_id = t.id and drive_id = p_drive_id
             and drive_modificado_em is not distinct from p_modificado) then
    raise exception 'Este arquivo do Drive já está na tarefa.';
  end if;
  if (select count(*) from public.agente_tarefa_arquivos where tarefa_id = t.id) >= 30 then raise exception 'No máximo 30 arquivos por tarefa.'; end if;
  v_nome := interno.nome_livre_na_tarefa(t.id, p_nome);
  insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho, drive_id, drive_modificado_em)
  values (t.id, 'drive', 'tarefas', p_caminho, v_nome, left(coalesce(nullif(p_mime, ''), 'application/octet-stream'), 120), p_tamanho,
          p_drive_id, p_modificado)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'nome', v_nome);
end $$;

-- D9: o trabalhador grava o e-mail da conta e o último erro (curto, sem a chave).
create function public.registrar_situacao_drive(p_email text, p_erro text) returns void
language sql security definer set search_path = '' as $$
  insert into public.drive_conta (id, email, erro, verificado_em) values (1, left(p_email, 320), left(p_erro, 300), now())
  on conflict (id) do update set email = excluded.email, erro = excluded.erro, verificado_em = excluded.verificado_em
$$;

revoke execute on function public.pasta_drive_da_tarefa(uuid), public.registrar_arquivo_drive(uuid, text, text, text, int, text, timestamptz),
  public.registrar_situacao_drive(text, text) from public, anon, authenticated;
grant execute on function public.pasta_drive_da_tarefa(uuid), public.registrar_arquivo_drive(uuid, text, text, text, int, text, timestamptz),
  public.registrar_situacao_drive(text, text) to service_role;
```

(`left(p_caminho, 43)`: o uuid tem 36 letras + `/drive/` (7). Use o mesmo cálculo se mudar o prefixo.)

- [ ] **Step 5: Rode o pgTAP novo, o 22 e todos**

Run: `supabase db reset && supabase test db`
Expected: PASS em todos os arquivos, inclusive `22` (100/100) e `53` (30). `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio.

- [ ] **Step 6: Regere os tipos e confira**

Run: `pnpm db:tipos && pnpm -r typecheck`
Expected: `tipos.gen.ts` com `drive_conta`, `drive_pasta_id`, `drive_id` e as funções novas; typecheck limpo.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261017000100_painel_v2_drive.sql supabase/tests/53_painel_v2_drive.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): pasta do cliente no Drive, situação da conta e arquivos do Drive na tarefa (I3b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Banco. Testar dos agentes dos setores, guarda dos arquivos das tarefas e as sobras da I3a

**Files:**
- Create: `supabase/migrations/20261017000200_painel_v2_testar_guarda.sql`, `supabase/tests/54_painel_v2_testar_guarda.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `public.pode_treinar_agente(uuid)`, `public.eh_dono()`, `interno.validar_empresa(uuid)`, `interno.validar_orientacao(text, text, text, uuid, uuid)`, `interno.evento_tarefa`, a tabela `simulacoes_agente` (com `agente_id`, `skill_id`).
- Produces (Tasks 6, 9, 10, 12–14):
  - `simulacoes_agente.modo text` (`por_tras` | `mesma_voz` | `passa_conversa` | null);
  - `criar_simulacao_agente(p_slug text, p_mensagem text, p_cliente_id uuid default null, p_rascunho jsonb default null, p_skill uuid default null, p_modo text default null) returns uuid` (authenticated) — frases: "Agente não encontrado.", "Para o Thiago, use o teste de sempre.", "Este agente só faz tarefas: teste pedindo uma tarefa numa demanda de teste, com o agente em Teste.", "Você não tem permissão para testar este agente.", "Só o dono testa skills.", "Skill não encontrada neste agente.", "Modo inválido.", e as mesmas de `criar_simulacao` (mensagem, rascunho, "Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.");
  - `criar_simulacao_skill` grava `agente_id` (mesma assinatura, mesmas frases);
  - tabela `tarefas_guarda (id = 1, dias int null, atualizado_por, atualizado_em)` com a linha 1; `agente_tarefa_arquivos.removido_em timestamptz`;
  - `salvar_guarda_tarefas(p_dias int) returns void` (authenticated; só o dono) — frases: "Só o dono muda a guarda dos arquivos das tarefas.", "Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.";
  - `arquivos_vencidos_das_tarefas(p_limite int) returns table (id uuid, caminho text)` e `marcar_arquivos_removidos(p_ids uuid[]) returns int` (service_role);
  - `interno.tarefa_da_pessoa` recusa setor desativado: "O setor desta demanda está desativado: não dá para mexer na tarefa.";
  - `interno.retomar_se_respondida` marca ajuste pendente quando o rascunho tem linha provisória (texto do ajuste: "Refaça as linhas provisórias com as respostas das pendências e entregue de novo."; evento "pediu ao agente para refazer N linha(s) provisória(s)").

- [ ] **Step 1: Escreva o pgTAP que falha** — `supabase/tests/54_painel_v2_testar_guarda.test.sql`:

```sql
-- Parte I3b, Task 5 (D11, D12, D14, D15): Testar dos agentes dos setores, guarda dos arquivos das tarefas e as sobras da I3a.
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('fc000000-0000-0000-0000-00000000000a', 'ana@i3t.local'), ('fc000000-0000-0000-0000-00000000000b', 'paula@i3t.local'),
  ('fc000000-0000-0000-0000-00000000000c', 'dono@i3t.local'), ('fc000000-0000-0000-0000-00000000000d', 'claudia@i3t.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('fc000000-0000-0000-0000-00000000000a', 'I3T Ana', 'ana@i3t.local', 'atendente', '{treinar_agente}'),
  ('fc000000-0000-0000-0000-00000000000b', 'I3T Paula', 'paula@i3t.local', 'atendente', '{treinar_agente}'),
  ('fc000000-0000-0000-0000-00000000000c', 'I3T Dono', 'dono@i3t.local', 'admin', '{}'),
  ('fc000000-0000-0000-0000-00000000000d', 'I3T Cláudia', 'claudia@i3t.local', 'atendente', '{}');
update public.usuarios set dono = false where dono;
update public.usuarios set dono = true where id = 'fc000000-0000-0000-0000-00000000000c';
insert into public.usuario_setores (usuario_id, setor_id) values
  ('fc000000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Fiscal')),
  ('fc000000-0000-0000-0000-00000000000b', (select id from public.setores where nome = 'Pessoal')),
  ('fc000000-0000-0000-0000-00000000000d', (select id from public.setores where nome = 'Contábil'));
insert into public.agente_skills (id, agente_id, nome, tipo, ativo) values
  ('fc400000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'fiscal'), 'tabela-cfop', 'conhecimento', false),
  ('fc400000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'atendimento'), 'jeito-thiago', 'jeito', true);
insert into public.agente_skill_versoes (skill_id, versao, titulo, descricao, tipo, corpo, skill_md) values
  ('fc400000-0000-0000-0000-00000000000a', 1, 'Tabela CFOP', 'CFOP', 'conhecimento', 'x', '---'),
  ('fc400000-0000-0000-0000-00000000000b', 1, 'Jeito do Thiago', 'Jeito', 'jeito', 'x', '---');
insert into public.clientes (id, razao_social, cnpj) values ('fc100000-0000-0000-0000-00000000000a', 'I3T Padaria', '21448390000107');
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fc200000-0000-0000-0000-00000000000a', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechamento');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos, estado, resultado) values
  ('fc300000-0000-0000-0000-00000000000a', (select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000a',
   'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Fechar outubro', 2, 20, 'aguardando_pendencias',
   '{"versao":1,"resumo":"r","destaques":[],"linhas":[{"descricao":"Saldo BB","valor":10,"texto":null,"fonte":"pendência 1","provisoria":true}],"observacoes":null}');
insert into public.agente_pendencias (tarefa_id, numero, tipo, pergunta) values ('fc300000-0000-0000-0000-00000000000a', 1, 'analista', 'Saldo do BB?');
update public.agentes set estado = 'ligado' where slug = 'contabil';

-- 1: a coluna do modo
select has_column('public', 'simulacoes_agente', 'modo', 'simulacoes_agente.modo');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
-- 2–9: criar_simulacao_agente (D11, D12)
select isnt(public.criar_simulacao_agente('fiscal', 'Saiu a nota do pedido 4512?', null, null, null, 'por_tras'), null, 'Ana (Fiscal, treinar) testa o Fiscal');
select is((select a.slug || ':' || coalesce(s.modo, '-') from public.simulacoes_agente s join public.agentes a on a.id = s.agente_id
           where s.usuario_id = 'fc000000-0000-0000-0000-00000000000a'), 'fiscal:por_tras', 'grava o agente e o modo');
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'De novo') $$, 'P0001',
  'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.', 'um teste pendente por pessoa');
reset role;
delete from public.simulacoes_agente;
set local role authenticated;
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, null, 'fc400000-0000-0000-0000-00000000000a') $$, 'P0001',
  'Só o dono testa skills.', 'skill: só o dono');
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, null, null, 'gritando') $$, 'P0001', 'Modo inválido.', 'modo inválido');
select throws_ok($$ select public.criar_simulacao_agente('atendimento', 'Oi') $$, 'P0001', 'Para o Thiago, use o teste de sempre.', 'o Thiago não passa por aqui');
select throws_ok($$ select public.criar_simulacao_agente('contabil', 'Oi') $$, 'P0001',
  'Este agente só faz tarefas: teste pedindo uma tarefa numa demanda de teste, com o agente em Teste.', 'agente só de Trabalho');
select throws_ok($$ select public.criar_simulacao_agente('nao-existe', 'Oi') $$, 'P0001', 'Agente não encontrado.', 'agente que não existe');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
-- 10: Paula treina, mas é do Pessoal
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi') $$, 'P0001', 'Você não tem permissão para testar este agente.', 'outro setor: recusa');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
-- 11–13: o dono testa a skill desligada do Fiscal; skill de outro agente é recusada
select isnt(public.criar_simulacao_agente('fiscal', 'Qual o CFOP?', null, null, 'fc400000-0000-0000-0000-00000000000a'), null, 'dono testa skill desligada');
reset role;
delete from public.simulacoes_agente;
set local role authenticated;
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, null, 'fc400000-0000-0000-0000-00000000000b') $$, 'P0001',
  'Skill não encontrada neste agente.', 'skill do Thiago no teste do Fiscal: recusa');
-- 13: com rascunho de orientação (validado como em criar_simulacao)
select throws_ok($$ select public.criar_simulacao_agente('fiscal', 'Oi', null, '{"titulo":"T","texto":"x","tipo":"jeito","extra":1}') $$, 'P0001',
  'Rascunho da orientação inválido.', 'rascunho com chave a mais');
-- 14–15: criar_simulacao_skill grava o agente (minor da I1) e continua recusando o Fiscal com a mesma frase
select isnt(public.criar_simulacao_skill('fc400000-0000-0000-0000-00000000000b', 'Oi'), null, 'skill do Thiago testa');
select is((select agente_id from public.simulacoes_agente where skill_id = 'fc400000-0000-0000-0000-00000000000b'),
  (select id from public.agentes where slug = 'atendimento'), 'grava o agente_id da skill');
reset role;
delete from public.simulacoes_agente;
set local role authenticated;
select throws_ok($$ select public.criar_simulacao_skill('fc400000-0000-0000-0000-00000000000a', 'Oi') $$, 'P0001',
  'Nesta etapa só dá para testar skills do Thiago.', 'frase da I1 continua (46:77)');

-- 17–21: guarda dos arquivos das tarefas (D14)
select is((select dias from public.tarefas_guarda), null, 'padrão: nunca apagar');
select throws_ok($$ select public.salvar_guarda_tarefas(45) $$, 'P0001', 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.', 'prazo fora da lista');
select lives_ok($$ select public.salvar_guarda_tarefas(365) $$, 'o dono escolhe 365');
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_guarda_tarefas(90) $$, 'P0001', 'Só o dono muda a guarda dos arquivos das tarefas.', 'só o dono');
select throws_ok($$ select public.arquivos_vencidos_das_tarefas(10) $$, '42501', null, 'pessoa não chama a limpeza');

reset role;
-- Arquivos: um de tarefa aprovada há 400 dias (vence), um de tarefa aprovada ontem (não vence), um anexo da conversa (nunca), um já removido.
insert into public.chamados (id, cliente_id, setor_id, titulo) values
  ('fc200000-0000-0000-0000-00000000000b', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Antiga'),
  ('fc200000-0000-0000-0000-00000000000c', 'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Recente');
insert into public.agente_tarefas (id, agente_id, chamado_id, cliente_id, setor_id, pedido, limite_usd, limite_minutos, estado, decidida_em) values
  ('fc300000-0000-0000-0000-00000000000b', (select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000b',
   'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Antiga', 2, 20, 'aprovada', now() - interval '400 days'),
  ('fc300000-0000-0000-0000-00000000000c', (select id from public.agentes where slug = 'contabil'), 'fc200000-0000-0000-0000-00000000000c',
   'fc100000-0000-0000-0000-00000000000a', (select id from public.setores where nome = 'Contábil'), 'Recente', 2, 20, 'descartada', now() - interval '1 day');
insert into public.agente_tarefa_arquivos (id, tarefa_id, origem, bucket, caminho, nome, mime, tamanho, removido_em) values
  ('fc600000-0000-0000-0000-00000000000a', 'fc300000-0000-0000-0000-00000000000b', 'enviado', 'tarefas', 'fc300000-0000-0000-0000-00000000000b/1-a.pdf', 'a.pdf', 'application/pdf', 1, null),
  ('fc600000-0000-0000-0000-00000000000b', 'fc300000-0000-0000-0000-00000000000c', 'enviado', 'tarefas', 'fc300000-0000-0000-0000-00000000000c/1-b.pdf', 'b.pdf', 'application/pdf', 1, null),
  ('fc600000-0000-0000-0000-00000000000c', 'fc300000-0000-0000-0000-00000000000b', 'conversa', 'anexos', 'conversas/x/1-c.pdf', 'c.pdf', 'application/pdf', 1, null),
  ('fc600000-0000-0000-0000-00000000000d', 'fc300000-0000-0000-0000-00000000000b', 'enviado', 'tarefas', 'fc300000-0000-0000-0000-00000000000b/1-d.pdf', 'd.pdf', 'application/pdf', 1, now());
set local role service_role;
-- 22–24
select is((select array_agg(id::text) from public.arquivos_vencidos_das_tarefas(100)), array['fc600000-0000-0000-0000-00000000000a'],
  'só o arquivo do compartimento tarefas, de tarefa decidida há mais de 365 dias, ainda não removido');
select is(public.marcar_arquivos_removidos(array['fc600000-0000-0000-0000-00000000000a', 'fc600000-0000-0000-0000-00000000000c']::uuid[]), 1,
  'marca só o do compartimento tarefas');
select is((select count(*)::int from public.arquivos_vencidos_das_tarefas(100)), 0, 'depois de marcado, não volta');
reset role;
update public.tarefas_guarda set dias = null;
set local role service_role;
-- 25
select is((select count(*)::int from public.arquivos_vencidos_das_tarefas(100)), 0, 'nunca apagar: nada vence');

-- 26–28: sobras da I3a (D15b): a última resposta com linha provisória pede para refazer
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"fc000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select is(public.responder_pendencia((select id from public.agente_pendencias where tarefa_id = 'fc300000-0000-0000-0000-00000000000a'), 'R$ 10,00 no extrato'), true,
  'a última resposta retoma a tarefa');
select is((select ajuste_pendente from public.agente_tarefas where id = 'fc300000-0000-0000-0000-00000000000a'), true, 'linha provisória: ajuste pendente');
select is((select ajustes -> -1 ->> 'texto' from public.agente_tarefas where id = 'fc300000-0000-0000-0000-00000000000a'),
  'Refaça as linhas provisórias com as respostas das pendências e entregue de novo.', 'o ajuste diz o que fazer');

-- 29–31: sobras da I3a (D15c): setor desativado trava as ações
reset role;
update public.setores set ativo = false where nome = 'Contábil';
set local role authenticated;
select throws_ok($$ select public.pausar_tarefa('fc300000-0000-0000-0000-00000000000a') $$, 'P0001',
  'O setor desta demanda está desativado: não dá para mexer na tarefa.', 'pausar com setor desativado: recusa');
select throws_ok($$ select public.descartar_tarefa('fc300000-0000-0000-0000-00000000000a') $$, 'P0001',
  'O setor desta demanda está desativado: não dá para mexer na tarefa.', 'descartar com setor desativado: recusa');
select throws_ok($$ select public.pedir_leitura_da_pasta('fc300000-0000-0000-0000-00000000000a') $$, 'P0001',
  'O setor desta demanda está desativado: não dá para mexer na tarefa.', 'ler a pasta com setor desativado: recusa');
reset role;
-- 32: nada no Realtime
select is((select count(*)::int from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tarefas_guarda'), 0, 'tarefas_guarda fora do Realtime');

select * from finish();
rollback;
```

(Se `pausar_tarefa` de uma tarefa em `aguardando_pendencias` já der outra frase antes da trava do setor, confira a ordem: a trava entra **dentro** de `interno.tarefa_da_pessoa`, que todas as ações chamam primeiro. Se o 22 reclamar do admin "I3T Dono", troque o papel para `atendente` e acrescente `update public.usuario_permissoes …` como o 51 faz.)

- [ ] **Step 2: Rode e veja falhar**

Run: `supabase test db supabase/tests/54_painel_v2_testar_guarda.test.sql`
Expected: FAIL.

- [ ] **Step 3: Escreva a migração** — `supabase/migrations/20261017000200_painel_v2_testar_guarda.sql`:

```sql
-- supabase/migrations/20261017000200_painel_v2_testar_guarda.sql
-- Painel v2, Parte I3b (D11, D12, D14, D15): Testar dos agentes dos setores, guarda dos arquivos das tarefas e as sobras da I3a.
-- Funções da I3a trocam o corpo com a mesma assinatura (interno.tarefa_da_pessoa, interno.retomar_se_respondida). Nada no Realtime (teste 22).

-- ---------- Testar dos agentes dos setores (D11, D12) ----------
alter table public.simulacoes_agente add column modo text check (modo is null or modo in ('por_tras', 'mesma_voz', 'passa_conversa'));

-- O rascunho de orientação, como em criar_simulacao (20260930000200), mas a orientação editada precisa ser deste agente.
create function interno.rascunho_da_simulacao(p_rascunho jsonb, p_agente uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_cliente uuid; v_setor uuid; v_orientacao uuid;
begin
  if p_rascunho is null or jsonb_typeof(p_rascunho) = 'null' then return null; end if;
  if jsonb_typeof(p_rascunho) <> 'object' then raise exception 'Rascunho da orientação inválido.'; end if;
  if exists (select 1 from jsonb_object_keys(p_rascunho) k where k not in ('id', 'titulo', 'texto', 'tipo', 'cliente_id', 'setor_id'))
     or exists (select 1 from jsonb_each(p_rascunho) e where jsonb_typeof(e.value) not in ('string', 'null')) then
    raise exception 'Rascunho da orientação inválido.';
  end if;
  begin
    v_cliente := nullif(p_rascunho->>'cliente_id', '')::uuid;
    v_setor := nullif(p_rascunho->>'setor_id', '')::uuid;
    v_orientacao := nullif(p_rascunho->>'id', '')::uuid;
  exception when invalid_text_representation then
    raise exception 'Rascunho da orientação inválido.';
  end;
  if v_orientacao is not null and not exists (select 1 from public.orientacoes_agente where id = v_orientacao and agente_id = p_agente) then
    raise exception 'Orientação não encontrada.';
  end if;
  perform interno.validar_orientacao(p_rascunho->>'titulo', p_rascunho->>'texto', p_rascunho->>'tipo', v_cliente, v_setor);
  return jsonb_build_object('id', v_orientacao, 'titulo', btrim(p_rascunho->>'titulo'), 'texto', btrim(p_rascunho->>'texto'),
    'tipo', p_rascunho->>'tipo', 'cliente_id', v_cliente, 'setor_id', v_setor);
end $$;

create function public.criar_simulacao_agente(p_slug text, p_mensagem text, p_cliente_id uuid default null, p_rascunho jsonb default null,
  p_skill uuid default null, p_modo text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare a public.agentes%rowtype; v_rascunho jsonb; v_id uuid;
begin
  if not public.eh_usuario_ativo() then raise exception 'Agente não encontrado.'; end if;
  select * into a from public.agentes where slug = p_slug;
  if not found then raise exception 'Agente não encontrado.'; end if;
  if a.porta_de_entrada then raise exception 'Para o Thiago, use o teste de sempre.'; end if;
  if not ('conversa' = any (a.tipos)) then
    raise exception 'Este agente só faz tarefas: teste pedindo uma tarefa numa demanda de teste, com o agente em Teste.';
  end if;
  if not (public.eh_dono() or public.pode_treinar_agente(a.id)) then raise exception 'Você não tem permissão para testar este agente.'; end if;
  if p_skill is not null then
    if not public.eh_dono() then raise exception 'Só o dono testa skills.'; end if;
    if not exists (select 1 from public.agente_skills where id = p_skill and agente_id = a.id and arquivada_em is null) then
      raise exception 'Skill não encontrada neste agente.';
    end if;
  end if;
  if p_modo is not null and p_modo not in ('por_tras', 'mesma_voz', 'passa_conversa') then raise exception 'Modo inválido.'; end if;
  if p_mensagem is null or length(btrim(p_mensagem)) = 0 then raise exception 'Escreva a mensagem do cliente para o teste.'; end if;
  if length(btrim(p_mensagem)) > 2000 then raise exception 'A mensagem de teste pode ter no máximo 2000 caracteres.'; end if;
  perform interno.validar_empresa(p_cliente_id);
  v_rascunho := interno.rascunho_da_simulacao(p_rascunho, a.id);
  -- Mesmas travas de criar_simulacao: uma pendente por pessoa (o painel reconhece a frase).
  perform pg_advisory_xact_lock(hashtextextended('simulacoes_agente:' || auth.uid()::text, 0));
  if exists (select 1 from public.simulacoes_agente where usuario_id = auth.uid() and status = 'pendente'
             and criado_em > now() - interval '5 minutes') then
    raise exception 'Já existe um teste em andamento. Aguarde a resposta antes de testar de novo.';
  end if;
  insert into public.simulacoes_agente (usuario_id, mensagem, cliente_id, rascunho, skill_id, agente_id, modo)
  values (auth.uid(), btrim(p_mensagem), p_cliente_id, v_rascunho, p_skill, a.id, p_modo)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function interno.rascunho_da_simulacao(jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.criar_simulacao_agente(text, text, uuid, jsonb, uuid, text) from public, anon, service_role;
grant execute on function public.criar_simulacao_agente(text, text, uuid, jsonb, uuid, text) to authenticated;
```

Depois, `criar_simulacao_skill` com o `agente_id` (copie o corpo **inteiro** de `20261014000200_painel_v2_agente_skills.sql:216-237` num `create or replace function public.criar_simulacao_skill(p_skill uuid, p_mensagem text, p_cliente_id uuid default null) returns uuid` e troque **só** o `insert` final por):

```sql
  -- I3b (D12, minor da I1): o agente da skill vai junto (hoje é sempre o Thiago; a coluna deixa de depender do padrão).
  insert into public.simulacoes_agente (usuario_id, mensagem, cliente_id, skill_id, agente_id)
  values (auth.uid(), trim(p_mensagem), p_cliente_id, p_skill, (select agente_id from public.agente_skills where id = p_skill))
  returning id into v_id;
```

(e repita no fim o mesmo `revoke … from public, anon, service_role` e `grant … to authenticated` da I1).

Depois, a guarda (D14):

```sql
-- ---------- Guarda dos arquivos das tarefas (D14): o dono escolhe; o padrão é nunca apagar ----------
create table public.tarefas_guarda (
  id int primary key default 1 check (id = 1),
  dias int check (dias is null or dias in (90, 180, 365, 730)),
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index tarefas_guarda_atualizado_por_idx on public.tarefas_guarda (atualizado_por);
insert into public.tarefas_guarda (id) values (1);
alter table public.tarefas_guarda enable row level security;
create policy leitura on public.tarefas_guarda for select to authenticated using (public.eh_usuario_ativo());
revoke all on public.tarefas_guarda from anon;
revoke insert, update, delete, truncate on public.tarefas_guarda from authenticated, service_role;

alter table public.agente_tarefa_arquivos add column removido_em timestamptz;
create index agente_tarefa_arquivos_guarda_idx on public.agente_tarefa_arquivos (tarefa_id) where removido_em is null and bucket = 'tarefas';

create function public.salvar_guarda_tarefas(p_dias int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (public.eh_usuario_ativo() and public.eh_dono()) then raise exception 'Só o dono muda a guarda dos arquivos das tarefas.'; end if;
  if p_dias is not null and p_dias not in (90, 180, 365, 730) then raise exception 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.'; end if;
  update public.tarefas_guarda set dias = p_dias, atualizado_por = auth.uid(), atualizado_em = now() where id = 1;
end $$;
revoke execute on function public.salvar_guarda_tarefas(int) from public, anon, service_role;
grant execute on function public.salvar_guarda_tarefas(int) to authenticated;

-- Só objetos do compartimento "tarefas" (enviados e do Drive) de tarefa decidida há mais que o prazo; anexos da conversa nunca.
create function public.arquivos_vencidos_das_tarefas(p_limite int) returns table (id uuid, caminho text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.caminho
    from public.agente_tarefa_arquivos a
    join public.agente_tarefas t on t.id = a.tarefa_id
    cross join public.tarefas_guarda g
   where g.dias is not null and a.bucket = 'tarefas' and a.removido_em is null
     and t.estado in ('aprovada', 'descartada') and t.decidida_em < now() - make_interval(days => g.dias)
   order by t.decidida_em
   limit greatest(1, least(coalesce(p_limite, 100), 500))
$$;

create function public.marcar_arquivos_removidos(p_ids uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare v_n int; r record;
begin
  with feitos as (
    update public.agente_tarefa_arquivos set removido_em = now()
     where id = any (coalesce(p_ids, '{}')) and bucket = 'tarefas' and removido_em is null
    returning tarefa_id)
  select count(*) into v_n from feitos;
  for r in select tarefa_id, count(*) n from public.agente_tarefa_arquivos
            where id = any (coalesce(p_ids, '{}')) and removido_em > now() - interval '1 minute' group by tarefa_id loop
    perform interno.evento_tarefa(r.tarefa_id, 'sistema', format('apagou %s arquivo(s) pela guarda dos arquivos das tarefas', r.n));
  end loop;
  return v_n;
end $$;
revoke execute on function public.arquivos_vencidos_das_tarefas(int), public.marcar_arquivos_removidos(uuid[]) from public, anon, authenticated;
grant execute on function public.arquivos_vencidos_das_tarefas(int), public.marcar_arquivos_removidos(uuid[]) to service_role;
```

Por fim, as sobras da I3a (D15b, D15c) — copie o corpo de `interno.tarefa_da_pessoa` de `20261016000200_painel_v2_tarefas_painel.sql:9-21` num `create or replace function interno.tarefa_da_pessoa(p_id uuid) returns public.agente_tarefas` e acrescente, logo antes do `return t;`:

```sql
  -- I3b (D15c, revisão final da I3a): setor desativado trava todas as ações, não só a criação (F10).
  if exists (select 1 from public.setores s where s.id = t.setor_id and not s.ativo) then
    raise exception 'O setor desta demanda está desativado: não dá para mexer na tarefa.';
  end if;
```

e troque `interno.retomar_se_respondida` (mesma assinatura):

```sql
create or replace function interno.retomar_se_respondida(p_tarefa uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_provisorias int;
begin
  if exists (select 1 from public.agente_pendencias where tarefa_id = p_tarefa and estado = 'aberta') then return false; end if;
  update public.agente_tarefas set estado = 'trabalhando', atualizado_em = now() where id = p_tarefa and estado = 'aguardando_pendencias';
  if not found then return false; end if;
  perform interno.evento_tarefa(p_tarefa, 'sistema', 'retomou a tarefa: as pendências foram respondidas');
  -- I3b (D15b, revisão final da I3a): o rascunho com linha provisória precisa ser refeito com as respostas antes de ficar pronto.
  select count(*) into v_provisorias
    from public.agente_tarefas t, jsonb_array_elements(coalesce(t.resultado -> 'linhas', '[]'::jsonb)) l
   where t.id = p_tarefa and coalesce((l ->> 'provisoria')::boolean, false);
  if v_provisorias > 0 then
    update public.agente_tarefas set ajuste_pendente = true,
           ajustes = ajustes || jsonb_build_array(jsonb_build_object(
             'texto', 'Refaça as linhas provisórias com as respostas das pendências e entregue de novo.', 'por', null, 'em', now()))
     where id = p_tarefa;
    perform interno.evento_tarefa(p_tarefa, 'sistema', format('pediu ao agente para refazer %s linha(s) provisória(s)', v_provisorias));
  end if;
  return true;
end $$;
```

(Os `revoke`/`grant` das duas funções `interno` ficam como estão: `create or replace` mantém os privilégios.)

- [ ] **Step 4: Rode todos os pgTAP**

Run: `supabase db reset && supabase test db`
Expected: PASS em todos, inclusive `22` (100/100), `46` (sem mudança), `50`, `51`, `52`, `53` (30) e `54` (32). Se `51` ou `52` falhar por causa das duas funções trocadas, **pare** (é mudança de comportamento da I3a).

- [ ] **Step 5: Regere os tipos**

Run: `pnpm db:tipos && pnpm -r typecheck`
Expected: limpo.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261017000200_painel_v2_testar_guarda.sql supabase/tests/54_painel_v2_testar_guarda.test.sql packages/db/src/tipos.gen.ts
git commit -m "feat(banco): testar agentes dos setores, guarda dos arquivos das tarefas e sobras da I3a (I3b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Repositório. Drive, simulação de agente de setor e guarda, com os ajudantes de teste

**Files:**
- Modify: `packages/db/src/repos.ts`, `packages/db/test/limpar.ts`
- Create: `packages/db/test/drive-testar.test.ts`

**Interfaces:**
- Consumes: as funções das Tasks 4 e 5; `SEM_PARTE_I`, `checar`, `paraSkill`, `ehModo`, `orientacoesAtivas` (já em `repos.ts`).
- Produces (Tasks 7–11, 15):
  - `type PastaDaTarefa = { estado: EstadoTarefa; clienteId: string | null; pasta: string | null; outras: string[]; importados: { driveId: string; modificadoEm: string | null }[]; total: number }`;
  - `repos.pastaDriveDaTarefa(tarefaId: string): Promise<PastaDaTarefa | null>` — `null` = tarefa não existe; lança `SemI3b` (classe exportada) quando o banco não tem a I3b;
  - `repos.registrarArquivoDrive(a: { tarefaId: string; caminho: string; nome: string; mime: string; tamanho: number; driveId: string; modificadoEm: string }): Promise<{ id: string; nome: string }>`;
  - `repos.registrarSituacaoDrive(s: { email: string | null; erro: string | null }): Promise<boolean>` — `false` = banco sem a I3b;
  - `repos.agenteSetorParaTeste(agenteId: string, skillEmTeste: string | null): Promise<AgenteSetor | null>` — `null` = não existe, é o Thiago, não tem setor ou não tem Conversa;
  - `repos.arquivosVencidosDasTarefas(limite: number): Promise<{ id: string; caminho: string }[] | null>` (`null` = sem a I3b) e `repos.marcarArquivosRemovidos(ids: string[]): Promise<number>`;
  - `export class SemI3b extends Error {}`;
  - ajudantes (`@escritorio/db/teste`): `definirPastaDriveTeste(clienteId: string, pasta: string | null): Promise<void>`, `situacaoDriveTeste(email: string | null, erro?: string | null): Promise<void>`; `limparBanco()` passa a apagar `drive_conta` e voltar `tarefas_guarda.dias` a `null` (se as tabelas existirem).

- [ ] **Step 1: Escreva o teste que falha** — `packages/db/test/drive-testar.test.ts` (no padrão de `packages/db/test/tarefas.test.ts`: `repos` com a chave de serviço, `limparBanco` no `beforeEach`, e as funções de criar dados de `limpar.ts`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { criarRepos, criarClienteServico } from '../src';
import { configurarAgenteTeste, criarSkillTeste, criarTarefaTeste, definirPastaDriveTeste, limparBanco, sqlTeste, situacaoDriveTeste } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const PASTA = '1PastaDaPadariaSolAbcdefghij';
const OUTRA = '1PastaDaMerceariaLuaAbcdefgh';

async function base() {
  const setor = (await db.from('setores').select('id').eq('nome', 'Contábil').single()).data!.id;
  const sol = (await db.from('clientes').insert({ razao_social: 'Padaria Sol', cnpj: '21448390000107' }).select('id').single()).data!;
  const lua = (await db.from('clientes').insert({ razao_social: 'Mercearia Lua', cnpj: '11222333000181' }).select('id').single()).data!;
  await definirPastaDriveTeste(sol.id, PASTA);
  await definirPastaDriveTeste(lua.id, OUTRA);
  const ch = (await db.from('chamados').insert({ cliente_id: sol.id, setor_id: setor, titulo: 'Fechamento' }).select('id').single()).data!;
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  const t = await criarTarefaTeste({ chamadoId: ch.id });
  return { sol: sol.id, lua: lua.id, tarefa: t.id };
}

describe('Drive (I3b)', () => {
  beforeEach(limparBanco);
  it('pastaDriveDaTarefa traz a pasta, as dos outros e o que já foi copiado', async () => {
    const b = await base();
    const p = await repos.pastaDriveDaTarefa(b.tarefa);
    expect(p).toMatchObject({ estado: 'trabalhando', clienteId: b.sol, pasta: PASTA, outras: [OUTRA], importados: [], total: 0 });
    expect(await repos.pastaDriveDaTarefa('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
  it('registrarArquivoDrive copia com origem drive; o mesmo não entra duas vezes', async () => {
    const b = await base();
    const caminho = `${b.tarefa}/drive/1PdfDoDriveAbcdefghij-1.pdf`;
    await db.storage.from('tarefas').upload(caminho, new TextEncoder().encode('%PDF-1.4'), { contentType: 'application/pdf' });
    const r = await repos.registrarArquivoDrive({ tarefaId: b.tarefa, caminho, nome: 'extrato.pdf', mime: 'application/pdf', tamanho: 8,
      driveId: '1PdfDoDriveAbcdefghij', modificadoEm: '2026-10-01T10:00:00.000Z' });
    expect(r.nome).toBe('extrato.pdf');
    expect((await repos.pastaDriveDaTarefa(b.tarefa))!.importados).toEqual([{ driveId: '1PdfDoDriveAbcdefghij', modificadoEm: '2026-10-01T10:00:00+00:00' }]);
    await expect(repos.registrarArquivoDrive({ tarefaId: b.tarefa, caminho, nome: 'extrato.pdf', mime: 'application/pdf', tamanho: 8,
      driveId: '1PdfDoDriveAbcdefghij', modificadoEm: '2026-10-01T10:00:00.000Z' })).rejects.toThrow('Este arquivo do Drive já está na tarefa.');
  });
  it('registrarSituacaoDrive grava; a pessoa lê', async () => {
    expect(await repos.registrarSituacaoDrive({ email: 'drive@x.iam.gserviceaccount.com', erro: null })).toBe(true);
    expect((await db.from('drive_conta').select('email').single()).data!.email).toBe('drive@x.iam.gserviceaccount.com');
  });
});

describe('agenteSetorParaTeste (I3b, D11)', () => {
  beforeEach(limparBanco);
  it('o Fiscal com a skill desligada em teste; o Thiago e o Contábil (só Trabalho) não', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'desligado', modo: 'por_tras' });
    const sk = await criarSkillTeste('fiscal', 'tabela-cfop', 'conhecimento', false, [], { titulo: 'Tabela CFOP', descricao: 'CFOP', corpo: 'x' });
    const fiscal = (await db.from('agentes').select('id').eq('slug', 'fiscal').single()).data!.id;
    const a = await repos.agenteSetorParaTeste(fiscal, sk);
    expect(a).toMatchObject({ slug: 'fiscal', setor: 'Fiscal', modo: 'por_tras', skillEmTeste: sk });
    expect(a!.skills.map((s) => s.nome)).toContain('tabela-cfop');
    const thiago = (await db.from('agentes').select('id').eq('slug', 'atendimento').single()).data!.id;
    const contabil = (await db.from('agentes').select('id').eq('slug', 'contabil').single()).data!.id;
    expect(await repos.agenteSetorParaTeste(thiago, null)).toBeNull();
    expect(await repos.agenteSetorParaTeste(contabil, null)).toBeNull();
  });
});

describe('guarda (I3b, D14)', () => {
  beforeEach(limparBanco);
  it('nunca apagar: nada vence; com prazo, só o vencido; marcar não repete', async () => {
    const b = await base();
    await sqlTeste(`update public.agente_tarefas set estado = 'aprovada', decidida_em = now() - interval '400 days' where id = $1`, [b.tarefa]);
    const arq = (await sqlTeste<{ id: string }>(`insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho)
      values ($1, 'enviado', 'tarefas', $1 || '/1-a.pdf', 'a.pdf', 'application/pdf', 1) returning id`, [b.tarefa]))[0]!.id;
    expect(await repos.arquivosVencidosDasTarefas(100)).toEqual([]);
    await sqlTeste('update public.tarefas_guarda set dias = 365');
    expect(await repos.arquivosVencidosDasTarefas(100)).toEqual([{ id: arq, caminho: `${b.tarefa}/1-a.pdf` }]);
    expect(await repos.marcarArquivosRemovidos([arq])).toBe(1);
    expect(await repos.arquivosVencidosDasTarefas(100)).toEqual([]);
  });
});
```

(`criarRepos`/`criarClienteServico` e `criarSkillTeste` — que devolve o id da skill — são os mesmos de `packages/db/test/tarefas.test.ts` e `limpar.ts`. O formato da data que o PostgREST devolve em `modificadoEm` pode vir com `+00:00`: compare com o que o banco devolve de verdade e normalize com `new Date(x).toISOString()` no repositório se preferir — o teste deve seguir o que o repositório promete.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/db exec vitest run test/drive-testar.test.ts`
Expected: FAIL (métodos não existem).

- [ ] **Step 3: Implemente** — em `packages/db/src/repos.ts`, perto de `SEM_PARTE_I`:

```ts
/** Parte I3b (D17): o banco ainda não tem as migrações da I3b (a função ou a tabela não existe). */
export class SemI3b extends Error {
  constructor() { super('O banco ainda não tem a Parte I3b.'); }
}
export type PastaDaTarefa = {
  estado: EstadoTarefa; clienteId: string | null; pasta: string | null; outras: string[];
  importados: { driveId: string; modificadoEm: string | null }[]; total: number;
};
```

E os métodos (junto dos da tarefa):

```ts
    /** D5: a pasta do cliente da tarefa, as pastas dos outros clientes e o que já foi copiado. Lança SemI3b sem a migração. */
    async pastaDriveDaTarefa(tarefaId: string): Promise<PastaDaTarefa | null> {
      const r = await db.rpc('pasta_drive_da_tarefa', { p_tarefa: tarefaId });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) throw new SemI3b();
      const j = checar(r, 'pastaDriveDaTarefa') as null | {
        estado: EstadoTarefa; cliente_id: string | null; pasta: string | null; outras: string[]; total: number;
        importados: { drive_id: string; modificado_em: string | null }[];
      };
      if (!j) return null;
      return {
        estado: j.estado, clienteId: j.cliente_id, pasta: j.pasta, outras: j.outras ?? [], total: Number(j.total),
        importados: (j.importados ?? []).map((x) => ({ driveId: x.drive_id, modificadoEm: x.modificado_em })),
      };
    },

    async registrarArquivoDrive(a: { tarefaId: string; caminho: string; nome: string; mime: string; tamanho: number; driveId: string; modificadoEm: string }):
      Promise<{ id: string; nome: string }> {
      const j = checar(await db.rpc('registrar_arquivo_drive', {
        p_tarefa: a.tarefaId, p_caminho: a.caminho, p_nome: a.nome, p_mime: a.mime, p_tamanho: a.tamanho, p_drive_id: a.driveId, p_modificado: a.modificadoEm,
      }), 'registrarArquivoDrive') as { id: string; nome: string };
      return { id: j.id, nome: j.nome };
    },

    /** D9: false = banco sem a I3b (o trabalhador avisa uma vez no log e segue). */
    async registrarSituacaoDrive(s: { email: string | null; erro: string | null }): Promise<boolean> {
      const r = await db.rpc('registrar_situacao_drive', { p_email: s.email as string, p_erro: s.erro as string });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return false;
      checar(r, 'registrarSituacaoDrive');
      return true;
    },

    /** D11: o agente do setor para o Testar (com a skill em teste, mesmo desligada). null: não existe, é o Thiago, sem setor ou sem Conversa. */
    async agenteSetorParaTeste(agenteId: string, skillEmTeste: string | null): Promise<AgenteSetor | null> {
      const a = checar(await db.from('agentes').select('id, slug, nome, modelo, ferramentas, tipos, estado, modo_contato, porta_de_entrada, setor_id, setores(nome)')
        .eq('id', agenteId).maybeSingle(), 'agenteSetorParaTeste') as null | {
        id: string; slug: string; nome: string; modelo: string | null; ferramentas: string[] | null; tipos: string[]; estado: string; modo_contato: unknown;
        porta_de_entrada: boolean; setor_id: string | null; setores: { nome: string } | null;
      };
      if (!a || a.porta_de_entrada || !a.setor_id || !a.tipos.includes('conversa') || !ehModo(a.modo_contato)) return null;
      const skills = checar(await db.rpc('skills_do_agente', { p_agente: a.id, ...(skillEmTeste ? { p_incluir: skillEmTeste } : {}) }), 'agenteSetorParaTeste.skills');
      const regras = checar(await db.from('agente_regras_assunto').select('id, assunto, exemplo, modo').eq('agente_id', a.id).order('criado_em'),
        'agenteSetorParaTeste.regras') as { id: string; assunto: string; exemplo: string | null; modo: unknown }[];
      return {
        id: a.id, slug: a.slug, nome: a.nome, modelo: a.modelo, ferramentas: a.ferramentas ?? [], skillEmTeste,
        skills: (skills as LinhaSkill[]).map(paraSkill), setorId: a.setor_id, setor: a.setores?.nome ?? '',
        // No teste o estado não importa (o dono testa antes de ligar); o tipo pede 'ligado' | 'teste'.
        estado: a.estado === 'teste' ? 'teste' : 'ligado', modo: a.modo_contato,
        regras: regras.flatMap((x) => (ehModo(x.modo) ? [{ id: x.id, assunto: x.assunto, exemplo: x.exemplo ?? '', modo: x.modo }] : [])),
        orientacoes: await this.orientacoesAtivas(a.id),
      };
    },

    /** D14: null = banco sem a I3b. */
    async arquivosVencidosDasTarefas(limite: number): Promise<{ id: string; caminho: string }[] | null> {
      const r = await db.rpc('arquivos_vencidos_das_tarefas', { p_limite: limite });
      if (r.error && SEM_PARTE_I.has(r.error.code ?? '')) return null;
      return (checar(r, 'arquivosVencidosDasTarefas') ?? []).map((x: { id: string; caminho: string }) => ({ id: x.id, caminho: x.caminho }));
    },

    async marcarArquivosRemovidos(ids: string[]): Promise<number> {
      if (ids.length === 0) return 0;
      return Number(checar(await db.rpc('marcar_arquivos_removidos', { p_ids: ids }), 'marcarArquivosRemovidos') ?? 0);
    },
```

(`agente_regras_assunto` tem `id, agente_id, assunto, exemplo, modo, criado_em` — `20261014000100_painel_v2_agentes.sql:111`. `orientacoesAtivas` é chamado com `this` como em `agentesParaContato`.)

Em `packages/db/test/limpar.ts`, dentro de `limparBanco` (depois do bloco da I3a dos limites):

```ts
  // Parte I3b: a situação do Drive some e a guarda volta a "nunca apagar" (tabelas de uma linha, fora do truncate).
  await c.query(`do $$ begin
    if to_regclass('public.drive_conta') is not null then delete from public.drive_conta; end if;
    if to_regclass('public.tarefas_guarda') is not null then update public.tarefas_guarda set dias = null, atualizado_por = null; end if;
    end $$`);
```

E os ajudantes no fim do arquivo:

```ts
/** Parte I3b: "Pasta no Drive" de um cliente direto no banco local (o painel usa salvar_pasta_drive). */
export async function definirPastaDriveTeste(clienteId: string, pasta: string | null): Promise<void> {
  await sqlTeste('update public.clientes set drive_pasta_id = $2 where id = $1', [clienteId, pasta]);
}
/** Parte I3b: a situação do Drive como o trabalhador gravaria (só no banco local). */
export async function situacaoDriveTeste(email: string | null, erro: string | null = null): Promise<void> {
  await sqlTeste(`insert into public.drive_conta (id, email, erro) values (1, $1, $2)
    on conflict (id) do update set email = excluded.email, erro = excluded.erro, verificado_em = now()`, [email, erro]);
}
```

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/db test && pnpm --filter @escritorio/db typecheck && pnpm -r typecheck`
Expected: PASS (os 65 de antes + os novos); typecheck limpo em todos os pacotes.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/repos.ts packages/db/test/limpar.ts packages/db/test/drive-testar.test.ts
git commit -m "feat(db): repositório do Drive, do teste dos agentes dos setores e da guarda (I3b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Trabalhador. O Drive só de leitura: interface, cliente do Google por REST, Drive falso e a situação ao ligar

**Files:**
- Create: `apps/trabalhador/src/drive/leitor.ts`, `apps/trabalhador/src/drive/google.ts`, `apps/trabalhador/src/drive/falso.ts`, `apps/trabalhador/src/drive/situacao.ts`, `apps/trabalhador/test/drive/google.test.ts`, `apps/trabalhador/test/drive/falso.test.ts`
- Modify: `apps/trabalhador/src/config.ts` (variável opcional), `apps/trabalhador/src/principal.ts` (cria o leitor e anuncia a situação)

**Interfaces:**
- Consumes: `ItemDrive`, `MIME_PASTA_DRIVE`, `MimeExportacao` (core, Task 2); `repos.registrarSituacaoDrive` (Task 6).
- Produces (Tasks 8, 10, 11):
  - `interface DriveLeitor { readonly email: string; verificar(): Promise<void>; item(id: string): Promise<ItemDrive | null>; listar(pastaId: string): Promise<ItemDrive[]>; baixar(id: string): Promise<Uint8Array>; exportar(id: string, mime: MimeExportacao): Promise<Uint8Array> }`;
  - `class ErroDrive extends Error { codigo: 'sem_acesso' | 'nao_encontrado' | 'grande' | 'falha' }`;
  - `lerContaServico(valor: string): ContaServico`, `assinarJwt(c: ContaServico, agoraMs: number): string`, `criarDriveGoogle(c: ContaServico, buscar?: typeof fetch, relogio?: () => number): DriveLeitor`, `ESCOPO_DRIVE = 'https://www.googleapis.com/auth/drive.readonly'`;
  - `driveDoAmbiente(valor: string | undefined): { leitor: DriveLeitor | null; erro: string | null }`;
  - `anunciarSituacaoDrive(repos: Pick<Repos, 'registrarSituacaoDrive'>, d: { leitor: DriveLeitor | null; erro: string | null }): Promise<void>`;
  - `type ArquivoFalso = ItemDrive & { conteudo?: string | Uint8Array; exportado?: string | Uint8Array }`, `criarDriveFalso(itens: ArquivoFalso[], email?: string): DriveLeitor & { baixados: string[]; listados: string[] }`;
  - `Config.GOOGLE_DRIVE_CONTA_SERVICO?: string`.

- [ ] **Step 1: Escreva os testes que falham** — `apps/trabalhador/test/drive/google.test.ts`:

```ts
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ESCOPO_DRIVE, assinarJwt, criarDriveGoogle, driveDoAmbiente, lerContaServico } from '../../src/drive/google';
import { ErroDrive } from '../../src/drive/leitor';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const JSON_CHAVE = JSON.stringify({ type: 'service_account', client_email: 'drive@escritorio.iam.gserviceaccount.com', private_key: PEM, token_uri: 'https://oauth2.googleapis.com/token' });

type Pedido = { url: string; metodo: string; corpo: string | null };
function fetchFalso(respostas: (p: Pedido) => Response) {
  const pedidos: Pedido[] = [];
  const buscar = (async (url: string | URL, init?: RequestInit) => {
    const p = { url: String(url), metodo: init?.method ?? 'GET', corpo: init?.body ? String(init.body) : null };
    pedidos.push(p);
    return respostas(p);
  }) as typeof fetch;
  return { buscar, pedidos };
}
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });
const TOKEN = (p: Pedido) => (p.url.startsWith('https://oauth2.googleapis.com/token') ? json({ access_token: 'tk', expires_in: 3600 }) : null);

describe('conta de serviço (D3)', () => {
  it('lê o JSON inteiro ou em base64 e recusa o que não é conta de serviço', () => {
    expect(lerContaServico(JSON_CHAVE).email).toBe('drive@escritorio.iam.gserviceaccount.com');
    expect(lerContaServico(Buffer.from(JSON_CHAVE).toString('base64')).email).toBe('drive@escritorio.iam.gserviceaccount.com');
    expect(() => lerContaServico('{"type":"authorized_user"}')).toThrow('A chave do Drive não é de uma conta de serviço.');
    expect(() => lerContaServico('não é json')).toThrow('A chave da conta de serviço do Drive não é um JSON válido.');
  });
  it('o JWT é RS256, pede só leitura e é assinado pela chave', () => {
    const jwt = assinarJwt(lerContaServico(JSON_CHAVE), 1_760_000_000_000);
    const [cab, corpo, assinatura] = jwt.split('.');
    expect(JSON.parse(Buffer.from(cab!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const c = JSON.parse(Buffer.from(corpo!, 'base64url').toString());
    expect(c).toMatchObject({ iss: 'drive@escritorio.iam.gserviceaccount.com', scope: ESCOPO_DRIVE, aud: 'https://oauth2.googleapis.com/token', iat: 1_760_000_000 });
    expect(ESCOPO_DRIVE).toBe('https://www.googleapis.com/auth/drive.readonly');
    const v = createVerify('RSA-SHA256');
    v.update(`${cab}.${corpo}`);
    expect(v.verify(publicKey, Buffer.from(assinatura!, 'base64url'))).toBe(true);
  });
  it('sem variável: Drive não configurado; chave inválida: erro curto, sem derrubar', () => {
    expect(driveDoAmbiente(undefined)).toEqual({ leitor: null, erro: null });
    expect(driveDoAmbiente('xxx')).toEqual({ leitor: null, erro: 'A chave da conta de serviço do Drive não é um JSON válido.' });
    expect(driveDoAmbiente(JSON_CHAVE).leitor?.email).toBe('drive@escritorio.iam.gserviceaccount.com');
  });
});

describe('criarDriveGoogle (D2, D3): só GET e só leitura', () => {
  it('lista com paginação, sem a lixeira, nas unidades compartilhadas; reaproveita o token', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? (p.url.includes('pageToken=pg2')
      ? json({ files: [{ id: 'b', name: 'b.pdf', mimeType: 'application/pdf', size: '20', modifiedTime: '2026-10-02T00:00:00Z', parents: ['P'] }] })
      : json({ nextPageToken: 'pg2', files: [{ id: 'a', name: 'a.csv', mimeType: 'text/csv', modifiedTime: '2026-10-01T00:00:00Z', parents: ['P'] }] })));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar, () => 1_760_000_000_000);
    const itens = await d.listar('P');
    expect(itens).toEqual([
      { id: 'a', nome: 'a.csv', mime: 'text/csv', tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'] },
      { id: 'b', nome: 'b.pdf', mime: 'application/pdf', tamanho: 20, modificadoEm: '2026-10-02T00:00:00Z', pais: ['P'] },
    ]);
    const api = f.pedidos.filter((p) => p.url.startsWith('https://www.googleapis.com/drive/v3/'));
    expect(api.every((p) => p.metodo === 'GET')).toBe(true);
    expect(new URL(api[0]!.url).searchParams.get('q')).toBe("'P' in parents and trashed = false");
    expect(api[0]!.url).toContain('supportsAllDrives=true');
    expect(api[0]!.url).toContain('includeItemsFromAllDrives=true');
    expect(f.pedidos.filter((p) => p.url.includes('oauth2')).length).toBe(1);
    expect(f.pedidos.find((p) => p.url.includes('oauth2'))!.corpo).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
  });
  it('item: 404 e lixeira viram null; 403 vira ErroDrive sem_acesso', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? (p.url.includes('/files/sumiu') ? json({}, 404)
      : p.url.includes('/files/lixo') ? json({ id: 'lixo', name: 'x', mimeType: 'text/csv', trashed: true, modifiedTime: 'x', parents: [] })
      : json({ error: { errors: [{ reason: 'forbidden' }] } }, 403)));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar);
    expect(await d.item('sumiu')).toBeNull();
    expect(await d.item('lixo')).toBeNull();
    await expect(d.item('proibido')).rejects.toMatchObject({ codigo: 'sem_acesso' });
    await expect(d.item('proibido')).rejects.toBeInstanceOf(ErroDrive);
  });
  it('baixar usa alt=media; exportar usa /export; exportação grande vira "grande"', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? (p.url.includes('/export') && p.url.includes('grande')
      ? json({ error: { errors: [{ reason: 'exportSizeLimitExceeded' }] } }, 403)
      : new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar);
    expect([...(await d.baixar('a'))]).toEqual([1, 2, 3]);
    expect([...(await d.exportar('doc', 'application/pdf'))]).toEqual([1, 2, 3]);
    await expect(d.exportar('grande', 'text/csv')).rejects.toMatchObject({ codigo: 'grande' });
    const urls = f.pedidos.map((p) => decodeURIComponent(p.url));
    expect(urls.some((u) => u.includes('/files/a?') && u.includes('alt=media'))).toBe(true);
    expect(urls.some((u) => u.includes('/files/doc/export?') && u.includes('mimeType=application/pdf'))).toBe(true);
  });
  it('o objeto não tem nada que grave', () => {
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), fetchFalso(() => json({})).buscar);
    expect(Object.keys(d).sort()).toEqual(['baixar', 'email', 'exportar', 'item', 'listar', 'verificar']);
  });
});
```

E `apps/trabalhador/test/drive/falso.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MIME_PASTA_DRIVE } from '@escritorio/core';
import { anunciarSituacaoDrive } from '../../src/drive/situacao';
import { criarDriveFalso } from '../../src/drive/falso';

describe('Drive falso', () => {
  const d = criarDriveFalso([
    { id: 'P', nome: 'Padaria', mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: [] },
    { id: 'a', nome: 'a.csv', mime: 'text/csv', tamanho: 3, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'], conteudo: 'a;b' },
  ]);
  it('lista os filhos, baixa e anota o que baixou', async () => {
    expect((await d.listar('P')).map((i) => i.id)).toEqual(['a']);
    expect(new TextDecoder().decode(await d.baixar('a'))).toBe('a;b');
    expect(d.baixados).toEqual(['a']);
    await expect(d.listar('nao')).rejects.toMatchObject({ codigo: 'nao_encontrado' });
  });
});

describe('anunciarSituacaoDrive (D9)', () => {
  it('sem chave grava "não configurado"; chave boa grava o e-mail; falha do Google grava o erro curto; sem a I3b só avisa', async () => {
    const gravado: unknown[] = [];
    const repos = { registrarSituacaoDrive: async (s: unknown) => { gravado.push(s); return true; } };
    await anunciarSituacaoDrive(repos, { leitor: null, erro: null });
    await anunciarSituacaoDrive(repos, { leitor: criarDriveFalso([], 'x@y.iam.gserviceaccount.com'), erro: null });
    const quebrado = { ...criarDriveFalso([]), verificar: async () => { throw new Error('403'); } };
    await anunciarSituacaoDrive(repos, { leitor: quebrado, erro: null });
    await anunciarSituacaoDrive(repos, { leitor: null, erro: 'A chave da conta de serviço do Drive não é um JSON válido.' });
    expect(gravado).toEqual([
      { email: null, erro: null },
      { email: 'x@y.iam.gserviceaccount.com', erro: null },
      { email: 'drive-teste@escritorio.iam.gserviceaccount.com', erro: 'O Google recusou a conta do Drive do escritório. Confira a chave e se a API do Drive está ligada.' },
      { email: null, erro: 'A chave da conta de serviço do Drive não é um JSON válido.' },
    ]);
    await expect(anunciarSituacaoDrive({ registrarSituacaoDrive: async () => false }, { leitor: null, erro: null })).resolves.toBeUndefined();
    await expect(anunciarSituacaoDrive({ registrarSituacaoDrive: async () => { throw new Error('rede'); } }, { leitor: null, erro: null })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/drive`
Expected: FAIL (arquivos não existem).

- [ ] **Step 3: Implemente** — `apps/trabalhador/src/drive/leitor.ts`:

```ts
import type { ItemDrive, MimeExportacao } from '@escritorio/core';

/** Parte I3b (D2, D3, D5): o Drive só de leitura. Nenhum método grava, move, compartilha ou apaga. */
export interface DriveLeitor {
  /** O e-mail da conta de serviço: o dono compartilha cada pasta de cliente com ele, como Leitor. */
  readonly email: string;
  /** Lança se a conta não autentica (chave errada, API desligada). */
  verificar(): Promise<void>;
  /** null: não existe, está na lixeira ou a conta não enxerga. */
  item(id: string): Promise<ItemDrive | null>;
  /** Filhos diretos da pasta, sem os da lixeira. */
  listar(pastaId: string): Promise<ItemDrive[]>;
  baixar(id: string): Promise<Uint8Array>;
  exportar(id: string, mime: MimeExportacao): Promise<Uint8Array>;
}

export type CodigoErroDrive = 'sem_acesso' | 'nao_encontrado' | 'grande' | 'falha';
export class ErroDrive extends Error {
  constructor(readonly codigo: CodigoErroDrive, mensagem: string) {
    super(mensagem);
  }
}
```

`apps/trabalhador/src/drive/google.ts`:

```ts
import { createSign } from 'node:crypto';
import type { ItemDrive, MimeExportacao } from '@escritorio/core';
import { ErroDrive, type DriveLeitor } from './leitor';

/** D3: só leitura. É o único escopo pedido; o Google recusa qualquer gravação com ele. */
export const ESCOPO_DRIVE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';
const CAMPOS = 'id,name,mimeType,size,modifiedTime,parents,trashed';

export type ContaServico = { email: string; chave: string; tokenUri: string };

/** A variável GOOGLE_DRIVE_CONTA_SERVICO: o JSON da chave, inteiro ou em base64 (cabe numa linha do .env). */
export function lerContaServico(valor: string): ContaServico {
  const texto = valor.trim().startsWith('{') ? valor : Buffer.from(valor.trim(), 'base64').toString('utf8');
  let j: unknown;
  try {
    j = JSON.parse(texto);
  } catch {
    throw new Error('A chave da conta de serviço do Drive não é um JSON válido.');
  }
  const o = (j ?? {}) as Record<string, unknown>;
  if (o.type !== 'service_account' || typeof o.client_email !== 'string' || typeof o.private_key !== 'string') {
    throw new Error('A chave do Drive não é de uma conta de serviço.');
  }
  return { email: o.client_email, chave: o.private_key, tokenUri: typeof o.token_uri === 'string' ? o.token_uri : 'https://oauth2.googleapis.com/token' };
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');
/** D2: o JWT da conta de serviço (RS256), trocado por um token de 1 hora. */
export function assinarJwt(c: ContaServico, agoraMs: number): string {
  const iat = Math.floor(agoraMs / 1000);
  const cab = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(JSON.stringify({ iss: c.email, scope: ESCOPO_DRIVE, aud: c.tokenUri, iat, exp: iat + 3600 }));
  const s = createSign('RSA-SHA256');
  s.update(`${cab}.${corpo}`);
  return `${cab}.${corpo}.${s.sign(c.chave).toString('base64url')}`;
}

type ArquivoApi = { id: string; name: string; mimeType: string; size?: string; modifiedTime: string; parents?: string[]; trashed?: boolean };
const paraItem = (f: ArquivoApi): ItemDrive => ({
  id: f.id, nome: f.name, mime: f.mimeType, tamanho: f.size === undefined ? null : Number(f.size), modificadoEm: f.modifiedTime, pais: f.parents ?? [],
});

async function motivoDoErro(r: Response): Promise<string> {
  try {
    const j = (await r.json()) as { error?: { errors?: { reason?: string }[] } };
    return j.error?.errors?.[0]?.reason ?? '';
  } catch {
    return '';
  }
}

export function criarDriveGoogle(c: ContaServico, buscar: typeof fetch = fetch, relogio: () => number = Date.now): DriveLeitor {
  let token: { valor: string; vence: number } | null = null;
  async function acesso(): Promise<string> {
    if (token && token.vence - 60_000 > relogio()) return token.valor;
    const r = await buscar(c.tokenUri, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: assinarJwt(c, relogio()) }).toString(),
    });
    if (!r.ok) throw new ErroDrive('sem_acesso', `O Google recusou a conta de serviço (${r.status}).`);
    const j = (await r.json()) as { access_token: string; expires_in: number };
    token = { valor: j.access_token, vence: relogio() + j.expires_in * 1000 };
    return token.valor;
  }
  // Só GET: nenhuma chamada deste arquivo muda algo no Drive (D3).
  async function get(caminho: string, q: Record<string, string>): Promise<Response> {
    const url = `${API}${caminho}?${new URLSearchParams({ supportsAllDrives: 'true', ...q }).toString()}`;
    const r = await buscar(url, { method: 'GET', headers: { authorization: `Bearer ${await acesso()}` } });
    if (r.ok) return r;
    const motivo = await motivoDoErro(r);
    if (r.status === 404) throw new ErroDrive('nao_encontrado', 'Não encontrado no Drive.');
    if (motivo === 'exportSizeLimitExceeded') throw new ErroDrive('grande', 'O arquivo é grande demais para exportar.');
    if (r.status === 401 || r.status === 403) throw new ErroDrive('sem_acesso', 'A conta do Drive do escritório não tem acesso.');
    throw new ErroDrive('falha', `O Drive respondeu ${r.status}.`);
  }
  const bytes = async (r: Response) => new Uint8Array(await r.arrayBuffer());
  return {
    email: c.email,
    async verificar() {
      await get('/about', { fields: 'user(emailAddress)' });
    },
    async item(id) {
      try {
        const f = (await (await get(`/files/${encodeURIComponent(id)}`, { fields: CAMPOS })).json()) as ArquivoApi;
        return f.trashed ? null : paraItem(f);
      } catch (e) {
        if (e instanceof ErroDrive && e.codigo === 'nao_encontrado') return null;
        throw e;
      }
    },
    async listar(pastaId) {
      const itens: ItemDrive[] = [];
      let pagina: string | undefined;
      do {
        const j = (await (await get('/files', {
          q: `'${pastaId.replace(/'/g, '')}' in parents and trashed = false`, fields: `nextPageToken,files(${CAMPOS})`, pageSize: '200',
          includeItemsFromAllDrives: 'true', ...(pagina ? { pageToken: pagina } : {}),
        })).json()) as { nextPageToken?: string; files?: ArquivoApi[] };
        itens.push(...(j.files ?? []).filter((f) => !f.trashed).map(paraItem));
        pagina = j.nextPageToken;
      } while (pagina && itens.length < 1000);
      return itens;
    },
    async baixar(id) {
      return bytes(await get(`/files/${encodeURIComponent(id)}`, { alt: 'media' }));
    },
    async exportar(id, mime) {
      return bytes(await get(`/files/${encodeURIComponent(id)}/export`, { mimeType: mime }));
    },
  };
}

/** D3: sem a variável, o Drive não está configurado; chave inválida não derruba o trabalhador. */
export function driveDoAmbiente(valor: string | undefined): { leitor: DriveLeitor | null; erro: string | null } {
  if (!valor?.trim()) return { leitor: null, erro: null };
  try {
    return { leitor: criarDriveGoogle(lerContaServico(valor)), erro: null };
  } catch (e) {
    return { leitor: null, erro: e instanceof Error ? e.message : 'A chave do Drive não pôde ser lida.' };
  }
}
```

`apps/trabalhador/src/drive/situacao.ts`:

```ts
import type { Repos } from '@escritorio/db';
import type { DriveLeitor } from './leitor';

export const ERRO_CONTA_DRIVE = 'O Google recusou a conta do Drive do escritório. Confira a chave e se a API do Drive está ligada.';
let avisouSemI3b = false;

/** D9: ao ligar, grava o e-mail da conta (ou o erro curto) para o painel mostrar. Nunca derruba o trabalhador. */
export async function anunciarSituacaoDrive(
  repos: Pick<Repos, 'registrarSituacaoDrive'>, d: { leitor: DriveLeitor | null; erro: string | null },
): Promise<void> {
  try {
    let s: { email: string | null; erro: string | null } = { email: null, erro: d.erro };
    if (d.leitor) {
      try {
        await d.leitor.verificar();
        s = { email: d.leitor.email, erro: null };
      } catch (e) {
        console.error('[drive] a conta não autenticou', e instanceof Error ? e.message : e);
        s = { email: d.leitor.email, erro: ERRO_CONTA_DRIVE };
      }
    }
    if (!(await repos.registrarSituacaoDrive(s)) && !avisouSemI3b) {
      avisouSemI3b = true;
      console.warn('[drive] o banco ainda não tem a Parte I3b: a situação do Drive não foi gravada');
    }
  } catch (e) {
    console.error('[drive] situação não gravada', e);
  }
}
```

`apps/trabalhador/src/drive/falso.ts`:

```ts
import { MIME_PASTA_DRIVE, type ItemDrive } from '@escritorio/core';
import { ErroDrive, type DriveLeitor } from './leitor';

export type ArquivoFalso = ItemDrive & { conteudo?: string | Uint8Array; exportado?: string | Uint8Array };
const bytes = (v: string | Uint8Array | undefined) => (typeof v === 'string' ? new TextEncoder().encode(v) : v ?? new Uint8Array());
const semConteudo = ({ conteudo: _c, exportado: _e, ...i }: ArquivoFalso): ItemDrive => i;

/** Parte I3b: um Drive em memória para testes e cenários (nada vai ao Google). Anota o que foi listado e baixado. */
export function criarDriveFalso(itens: ArquivoFalso[], email = 'drive-teste@escritorio.iam.gserviceaccount.com') {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const baixados: string[] = [];
  const listados: string[] = [];
  const achar = (id: string) => {
    const i = porId.get(id);
    if (!i) throw new ErroDrive('nao_encontrado', 'Não encontrado no Drive.');
    return i;
  };
  const leitor: DriveLeitor & { baixados: string[]; listados: string[] } = {
    email, baixados, listados,
    async verificar() {},
    async item(id) {
      const i = porId.get(id);
      return i ? semConteudo(i) : null;
    },
    async listar(pastaId) {
      listados.push(pastaId);
      if (achar(pastaId).mime !== MIME_PASTA_DRIVE) throw new ErroDrive('nao_encontrado', 'Não é pasta.');
      return itens.filter((i) => i.pais.includes(pastaId)).map(semConteudo);
    },
    async baixar(id) {
      baixados.push(id);
      return bytes(achar(id).conteudo);
    },
    async exportar(id) {
      baixados.push(id);
      return bytes(achar(id).exportado);
    },
  };
  return leitor;
}
```

Em `apps/trabalhador/src/config.ts`, no `Config` (depois de `TRANSCRICAO_VOCABULARIO`):

```ts
  // Parte I3b (D3): a chave da conta de serviço do Drive (JSON ou base64). Vazio = Drive não configurado.
  GOOGLE_DRIVE_CONTA_SERVICO: z.string().optional().transform((v) => v?.trim() || undefined),
```

Em `apps/trabalhador/src/principal.ts`, logo depois de `const repos = criarRepos(db);`:

```ts
  // Parte I3b (D3, D9): o Drive só de leitura; sem a chave, as tarefas seguem só com os arquivos enviados.
  const drive = driveDoAmbiente(cfg.GOOGLE_DRIVE_CONTA_SERVICO);
  if (drive.erro) console.error('[drive]', drive.erro);
  await anunciarSituacaoDrive(repos, drive);
```

(com os `import { driveDoAmbiente } from './drive/google';` e `import { anunciarSituacaoDrive } from './drive/situacao';`). A Task 8 usa `drive.leitor`.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/drive test/config.test.ts && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS; `config.test.ts` (antigo) continua verde.

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/drive apps/trabalhador/src/config.ts apps/trabalhador/src/principal.ts apps/trabalhador/test/drive
git commit -m "feat(trabalhador): Drive só de leitura por REST (conta de serviço), Drive falso e situação ao ligar (I3b, D2, D3, D9)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Trabalhador. A pasta do cliente na tarefa: só a pasta dele, a cópia, a ferramenta e LER A PASTA DE NOVO

**Files:**
- Create: `apps/trabalhador/src/tarefa/pasta.ts`, `apps/trabalhador/src/tarefa/armazenamento.ts`, `apps/trabalhador/test/tarefa/pasta.test.ts`
- Modify: `apps/trabalhador/src/tarefa/ferramentas.ts`, `apps/trabalhador/src/tarefa/executar.ts`, `apps/trabalhador/src/tarefa/processar.ts`, `apps/trabalhador/src/tarefa/prompt.ts`, `apps/trabalhador/src/fila.ts`, `apps/trabalhador/src/principal.ts`

**Interfaces:**
- Consumes: Task 2 (`comoLerDoDrive`, `ehPasta`, `LIMITES_DRIVE`, `TEXTO_IGNORADO`, `MotivoIgnorado`), Task 6 (`pastaDriveDaTarefa`, `registrarArquivoDrive`, `registrarSituacaoDrive`, `SemI3b`, `PastaDaTarefa`), Task 7 (`DriveLeitor`, `ErroDrive`, `criarDriveFalso`), `repos.eventoTarefa`, `repos.tarefaParaTrabalho`.
- Produces (Tasks 10, 11, 13):
  - `class PastaDoCliente { constructor(drive: DriveLeitor, pastaId: string, outras: ReadonlySet<string>); listar(subpasta: string | null): Promise<{ arquivos: ItemDrive[]; ignorados: Ignorado[] }>; dentroDaPasta(id: string): Promise<boolean>; ler(i: ItemDrive, como: ComoLerArquivo): Promise<Uint8Array> }`, `class ForaDaPasta extends Error`;
  - `type Ignorado = { nome: string; motivo: MotivoIgnorado }`;
  - `type GuardarArquivo = (caminho: string, bytes: Uint8Array, mime: string) => Promise<void>`, `type RemoverArquivos = (caminhos: string[]) => Promise<void>`;
  - `type DepsPasta = { repos: Repos; drive: DriveLeitor | null; guardar: GuardarArquivo; remover: RemoverArquivos; relogio: () => Date }`;
  - `type LeituraDaPasta = { situacao: 'sem_drive' | 'sem_pasta' | 'sem_i3b' | 'decidida' } | { situacao: 'erro'; mensagem: string } | { situacao: 'lida'; novos: string[]; ignorados: Ignorado[] }`;
  - `lerPastaDaTarefa(d: DepsPasta, tarefaId: string, subpasta?: string | null): Promise<LeituraDaPasta>`, `textoDaLeitura(novos: string[], ignorados: Ignorado[]): string`;
  - `guardarNaTarefa(db: Db): GuardarArquivo`, `removerDaTarefa(db: Db): RemoverArquivos` (compartimento `tarefas`);
  - `FERRAMENTA_PASTA: Anthropic.Tool` (`ler_pasta_do_cliente`), `ferramentasDaTarefa(perfil, opcoes?: { pasta?: boolean })`; `VezDaTarefa.lerPasta?: (subpasta: string | null) => Promise<LeituraDaPasta>`; `AVISOS_TAREFA.semPasta`;
  - `DepsTarefa.drive?: DriveLeitor | null; guardar?: GuardarArquivo; remover?: RemoverArquivos`;
  - `montarSituacaoTarefa(t, agora, opcoes?: { pasta?: boolean })`;
  - `FILAS.pastaDrive = 'pasta_drive'`, `type JobPastaDrive = { tarefaId: string }`.

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/tarefa/pasta.test.ts` (sem banco: `repos` falso em memória):

```ts
import { describe, expect, it } from 'vitest';
import { MIME_ATALHO_DRIVE, MIME_PASTA_DRIVE } from '@escritorio/core';
import { SemI3b, type PastaDaTarefa, type Repos } from '@escritorio/db';
import { criarDriveFalso, type ArquivoFalso } from '../../src/drive/falso';
import { ErroDrive } from '../../src/drive/leitor';
import { FERRAMENTA_PASTA, ferramentasDaTarefa } from '../../src/tarefa/ferramentas';
import { PastaDoCliente, lerPastaDaTarefa, textoDaLeitura, type DepsPasta } from '../../src/tarefa/pasta';

const SOL = '1PastaDaPadariaSolAbcdefghij';
const LUA = '1PastaDaMerceariaLuaAbcdefgh';
const pasta = (id: string, nome: string, pais: string[] = []): ArquivoFalso => ({ id, nome, mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais });
const arq = (id: string, nome: string, pais: string[], x: Partial<ArquivoFalso> = {}): ArquivoFalso =>
  ({ id, nome, mime: 'text/csv', tamanho: 10, modificadoEm: '2026-10-05T00:00:00Z', pais, conteudo: `conteúdo de ${nome}`, ...x });

// A pasta da Lua está DENTRO da pasta da Padaria (o caso que mais engana).
const ARVORE: ArquivoFalso[] = [
  pasta(SOL, 'Padaria Sol'), pasta('sub1', '2026', [SOL]), pasta('sub2', '10', ['sub1']), pasta(LUA, 'Mercearia Lua', [SOL]),
  arq('extrato', 'extrato-itau.csv', [SOL], { modificadoEm: '2026-10-07T00:00:00Z' }),
  arq('folha', 'Folha de outubro', ['sub2'], { mime: 'application/vnd.google-apps.spreadsheet', tamanho: null, exportado: 'nome;liquido' }),
  arq('docx', 'contrato.docx', [SOL], { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  arq('atalho', 'extrato-lua (atalho)', [SOL], { mime: MIME_ATALHO_DRIVE }),
  arq('dalua', 'extrato-lua.csv', [LUA]),
  arq('doispais', 'compartilhado.csv', ['sub1', LUA]),
];

function montar(p: Partial<PastaDaTarefa> | 'sem_i3b' | null = {}, arvore = ARVORE) {
  const drive = criarDriveFalso(arvore);
  const registrados: { nome: string; driveId: string; caminho: string }[] = [];
  const eventos: string[] = [];
  const guardados: string[] = [];
  const removidos: string[] = [];
  const repos = {
    pastaDriveDaTarefa: async () => {
      if (p === 'sem_i3b') throw new SemI3b();
      return p === null ? null : { estado: 'trabalhando', clienteId: 'c', pasta: SOL, outras: [LUA], importados: [], total: 0, ...p };
    },
    registrarArquivoDrive: async (a: { nome: string; driveId: string; caminho: string }) => {
      if (a.driveId === 'falha-registro') throw new Error('Arquivo não encontrado no envio.');
      registrados.push(a);
      return { id: `id-${a.driveId}`, nome: a.nome };
    },
    eventoTarefa: async (_t: string, texto: string) => { eventos.push(texto); },
    registrarSituacaoDrive: async () => true,
  } as unknown as Repos;
  const d: DepsPasta = {
    repos, drive, relogio: () => new Date('2026-10-17T12:00:00Z'),
    guardar: async (c) => { guardados.push(c); }, remover: async (c) => { removidos.push(...c); },
  };
  return { d, drive, registrados, eventos, guardados, removidos };
}

describe('PastaDoCliente (D5)', () => {
  it('desce até 3 níveis, pula a pasta de outro cliente e confere a ascendência', async () => {
    const { drive } = montar();
    const p = new PastaDoCliente(drive, SOL, new Set([LUA]));
    const { arquivos, ignorados } = await p.listar(null);
    expect(arquivos.map((a) => a.id).sort()).toEqual(['atalho', 'docx', 'doispais', 'extrato', 'folha']);
    expect(ignorados).toEqual([{ nome: 'Mercearia Lua', motivo: 'outra_pasta' }]);
    expect(drive.listados).not.toContain(LUA);
    expect(await p.dentroDaPasta('extrato')).toBe(true);
    expect(await p.dentroDaPasta('folha')).toBe(true);
    expect(await p.dentroDaPasta('dalua')).toBe(false);
    expect(await p.dentroDaPasta('doispais')).toBe(false);
  });
  it('não baixa o que não veio da listagem, nem o que tem um pai em outro cliente', async () => {
    const { drive } = montar();
    const p = new PastaDoCliente(drive, SOL, new Set([LUA]));
    await p.listar(null);
    const dalua = (await drive.item('dalua'))!;
    await expect(p.ler(dalua, { acao: 'baixar', nome: 'extrato-lua.csv', mime: 'text/csv' })).rejects.toThrow('fora da pasta');
    const doispais = (await drive.item('doispais'))!;
    await expect(p.ler(doispais, { acao: 'baixar', nome: 'compartilhado.csv', mime: 'text/csv' })).rejects.toThrow('fora da pasta');
    expect(drive.baixados).toEqual([]);
  });
  it('subpasta por nomes, dentro da pasta do cliente; a da Lua não serve de caminho', async () => {
    const { drive } = montar();
    const p = new PastaDoCliente(drive, SOL, new Set([LUA]));
    expect((await p.listar('2026/10')).arquivos.map((a) => a.id)).toEqual(['folha']);
    await expect(p.listar('Mercearia Lua')).rejects.toBeInstanceOf(ErroDrive);
  });
});

describe('lerPastaDaTarefa', () => {
  it('copia o que o agente lê, exporta a planilha do Google e diz o que ficou de fora', async () => {
    const m = montar();
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r).toMatchObject({ situacao: 'lida' });
    if (r.situacao !== 'lida') return;
    expect(r.novos.sort()).toEqual(['Folha de outubro.csv', 'extrato-itau.csv']);
    expect(r.ignorados.map((x) => `${x.nome}:${x.motivo}`).sort()).toEqual([
      'Mercearia Lua:outra_pasta', 'compartilhado.csv:fora_da_pasta', 'contrato.docx:tipo', 'extrato-lua (atalho):atalho',
    ]);
    expect(m.drive.baixados.sort()).toEqual(['extrato', 'folha']);
    expect(m.guardados.every((c) => c.startsWith('T/drive/'))).toBe(true);
    expect(m.eventos.at(-1)).toContain('leu a pasta do Drive: 2 arquivos novos');
  });
  it('o mesmo arquivo (mesma data) não entra de novo; mudou, entra; respeita 30 por tarefa', async () => {
    const igual = montar({ importados: [{ driveId: 'extrato', modificadoEm: '2026-10-07T00:00:00+00:00' }], total: 1 });
    const r1 = await lerPastaDaTarefa(igual.d, 'T');
    expect(r1.situacao === 'lida' && r1.novos).toEqual(['Folha de outubro.csv']);
    const cheia = montar({ total: 29 });
    const r2 = await lerPastaDaTarefa(cheia.d, 'T');
    expect(r2.situacao === 'lida' && r2.novos.length).toBe(1);
    expect(r2.situacao === 'lida' && r2.ignorados.some((x) => x.motivo === 'limite')).toBe(true);
  });
  it('registro que falha desfaz o envio ao Storage', async () => {
    const m = montar({}, [pasta(SOL, 'Padaria Sol'), arq('falha-registro', 'x.csv', [SOL])]);
    await expect(lerPastaDaTarefa(m.d, 'T')).rejects.toThrow('Arquivo não encontrado no envio.');
    expect(m.removidos).toEqual(m.guardados);
  });
  it('sem Drive, sem pasta, tarefa decidida, sem a I3b: não lê nada', async () => {
    expect(await lerPastaDaTarefa({ ...montar().d, drive: null }, 'T')).toEqual({ situacao: 'sem_drive' });
    expect(await lerPastaDaTarefa(montar({ pasta: null }).d, 'T')).toEqual({ situacao: 'sem_pasta' });
    expect(await lerPastaDaTarefa(montar({ estado: 'aprovada' }).d, 'T')).toEqual({ situacao: 'decidida' });
    expect(await lerPastaDaTarefa(montar(null).d, 'T')).toEqual({ situacao: 'decidida' });
    expect(await lerPastaDaTarefa(montar('sem_i3b').d, 'T')).toEqual({ situacao: 'sem_i3b' });
  });
  it('pasta não compartilhada: erro com o e-mail da conta, na linha do tempo', async () => {
    const m = montar();
    m.d.drive = { ...m.drive, listar: async () => { throw new ErroDrive('sem_acesso', '403'); } };
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r).toEqual({ situacao: 'erro', mensagem: 'A pasta do Drive deste cliente não foi compartilhada com drive-teste@escritorio.iam.gserviceaccount.com (como Leitor).' });
    expect(m.eventos.at(-1)).toContain('não leu a pasta do Drive');
  });
  it('o texto da linha do tempo cabe em 500', () => {
    const muitos = Array.from({ length: 40 }, (_, i) => ({ nome: `arquivo-com-nome-comprido-${i}.docx`, motivo: 'tipo' as const }));
    expect(textoDaLeitura(['a.pdf'], muitos).length).toBeLessThanOrEqual(500);
  });
});

describe('a ferramenta (D7)', () => {
  it('só entra com pasta; nunca recebe código nem link do Drive', () => {
    const perfil = { skills: [] };
    expect(ferramentasDaTarefa(perfil).map((f) => f.name)).not.toContain('ler_pasta_do_cliente');
    expect(ferramentasDaTarefa(perfil, { pasta: true }).map((f) => f.name)).toContain('ler_pasta_do_cliente');
    expect(Object.keys((FERRAMENTA_PASTA.input_schema as { properties: object }).properties)).toEqual(['subpasta']);
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/tarefa/pasta.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implemente o armazenamento** — `apps/trabalhador/src/tarefa/armazenamento.ts`:

```ts
import type { Db } from '@escritorio/db';

/** Parte I3b (D4): o compartimento "tarefas" (ArmazenamentoMidia é de "anexos" e muitos testes antigos usam a interface dele). */
export type GuardarArquivo = (caminho: string, bytes: Uint8Array, mime: string) => Promise<void>;
export type RemoverArquivos = (caminhos: string[]) => Promise<void>;

export function guardarNaTarefa(db: Db): GuardarArquivo {
  return async (caminho, bytes, mime) => {
    const { error } = await db.storage.from('tarefas').upload(caminho, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`upload falhou: ${error.message}`);
  };
}
export function removerDaTarefa(db: Db): RemoverArquivos {
  return async (caminhos) => {
    if (caminhos.length === 0) return;
    const { error } = await db.storage.from('tarefas').remove(caminhos);
    if (error) throw new Error(`remoção falhou: ${error.message}`);
  };
}
```

- [ ] **Step 4: Implemente a pasta** — `apps/trabalhador/src/tarefa/pasta.ts`:

```ts
import {
  LIMITES_DRIVE, LIMITES_TAREFA, TEXTO_IGNORADO, comoLerDoDrive, ehPasta, type ComoLer, type ItemDrive, type MotivoIgnorado,
} from '@escritorio/core';
import { SemI3b, type PastaDaTarefa, type Repos } from '@escritorio/db';
import { ErroDrive, type DriveLeitor } from '../drive/leitor';
import type { GuardarArquivo, RemoverArquivos } from './armazenamento';

export type Ignorado = { nome: string; motivo: MotivoIgnorado };
export type ComoLerArquivo = Exclude<ComoLer, { acao: 'ignorar' }>;
export class ForaDaPasta extends Error {
  constructor() { super('Arquivo fora da pasta deste cliente.'); }
}

/** D5 (barreiras 2 e 3): tudo o que sai do Drive para uma tarefa passa por aqui. */
export class PastaDoCliente {
  private readonly vistos = new Map<string, ItemDrive>();
  constructor(private readonly drive: DriveLeitor, readonly pastaId: string, private readonly outras: ReadonlySet<string>) {}

  /** Subpasta por nomes ("2026/10"), descendo só por pastas deste cliente. */
  private async acharSubpasta(caminho: string): Promise<string> {
    let atual = this.pastaId;
    for (const nome of caminho.split('/').map((x) => x.trim()).filter(Boolean).slice(0, 5)) {
      const achada = (await this.drive.listar(atual)).find((i) => ehPasta(i) && !this.outras.has(i.id)
        && i.nome.trim().toLowerCase() === nome.toLowerCase());
      if (!achada) throw new ErroDrive('nao_encontrado', `Subpasta "${caminho}" não encontrada.`);
      atual = achada.id;
    }
    return atual;
  }

  /** Lista a partir da pasta do cliente: até 3 níveis e 300 itens; a pasta de outro cliente fica de fora (nem é listada). */
  async listar(subpasta: string | null): Promise<{ arquivos: ItemDrive[]; ignorados: Ignorado[] }> {
    const arquivos: ItemDrive[] = [];
    const ignorados: Ignorado[] = [];
    let nivel = [subpasta?.trim() ? await this.acharSubpasta(subpasta) : this.pastaId];
    let contados = 0;
    for (let prof = 0; prof < LIMITES_DRIVE.profundidade && nivel.length > 0; prof++) {
      const proximo: string[] = [];
      for (const pasta of nivel) {
        for (const i of await this.drive.listar(pasta)) {
          if (++contados > LIMITES_DRIVE.itensListados) break;
          if (ehPasta(i)) {
            if (this.outras.has(i.id)) ignorados.push({ nome: i.nome, motivo: 'outra_pasta' });
            else proximo.push(i.id);
            continue;
          }
          this.vistos.set(i.id, i);
          arquivos.push(i);
        }
      }
      nivel = proximo;
    }
    arquivos.sort((a, b) => b.modificadoEm.localeCompare(a.modificadoEm));
    return { arquivos, ignorados };
  }

  /** A ascendência chega a esta pasta sem passar pela de outro cliente (um pai em outro cliente já recusa). */
  async dentroDaPasta(id: string): Promise<boolean> {
    let atual = [id];
    for (let salto = 0; salto < LIMITES_DRIVE.saltosAteAPasta; salto++) {
      const pais = new Set<string>();
      for (const x of atual) {
        const it = await this.drive.item(x);
        if (!it) return false;
        it.pais.forEach((p) => pais.add(p));
      }
      if ([...pais].some((p) => this.outras.has(p))) return false;
      if (pais.has(this.pastaId)) return true;
      if (pais.size === 0) return false;
      atual = [...pais];
    }
    return false;
  }

  async ler(i: ItemDrive, como: ComoLerArquivo): Promise<Uint8Array> {
    if (!this.vistos.has(i.id) || !(await this.dentroDaPasta(i.id))) throw new ForaDaPasta();
    const bytes = como.acao === 'exportar' ? await this.drive.exportar(i.id, como.mime) : await this.drive.baixar(i.id);
    if (bytes.length > LIMITES_TAREFA.arquivoBytes) throw new ErroDrive('grande', 'passa de 10 MB');
    return bytes;
  }
}

export type DepsPasta = { repos: Repos; drive: DriveLeitor | null; guardar: GuardarArquivo; remover: RemoverArquivos; relogio: () => Date };
export type LeituraDaPasta =
  | { situacao: 'sem_drive' | 'sem_pasta' | 'sem_i3b' | 'decidida' }
  | { situacao: 'erro'; mensagem: string }
  | { situacao: 'lida'; novos: string[]; ignorados: Ignorado[] };

/** A linha do tempo: quantos entraram e o que ficou de fora (até 5 nomes), em até 500 letras. */
export function textoDaLeitura(novos: string[], ignorados: Ignorado[]): string {
  const n = novos.length;
  let t = `leu a pasta do Drive: ${n} arquivo${n === 1 ? ' novo' : 's novos'}`;
  if (ignorados.length) {
    const nomes = ignorados.slice(0, 5).map((x) => `${x.nome.slice(0, 60)} (${TEXTO_IGNORADO[x.motivo]})`).join(', ');
    t += `; ficaram de fora: ${nomes}${ignorados.length > 5 ? ` e mais ${ignorados.length - 5}` : ''}`;
  }
  return t.slice(0, 500);
}
const chave = (id: string, quando: string | null) => `${id}|${quando ? new Date(quando).toISOString() : ''}`;
let avisouSemI3b = false;

/** D4–D7: traz para a tarefa os arquivos novos da pasta do cliente. Nunca baixa nada fora dela. */
export async function lerPastaDaTarefa(d: DepsPasta, tarefaId: string, subpasta: string | null = null): Promise<LeituraDaPasta> {
  let p: PastaDaTarefa | null;
  try {
    p = await d.repos.pastaDriveDaTarefa(tarefaId);
  } catch (e) {
    if (!(e instanceof SemI3b)) throw e;
    if (!avisouSemI3b) { avisouSemI3b = true; console.warn('[drive] o banco ainda não tem a Parte I3b: a pasta do cliente não é lida'); }
    return { situacao: 'sem_i3b' };
  }
  if (!p || p.estado === 'aprovada' || p.estado === 'descartada') return { situacao: 'decidida' };
  if (!d.drive) return { situacao: 'sem_drive' };
  if (!p.pasta) return { situacao: 'sem_pasta' };
  const pasta = new PastaDoCliente(d.drive, p.pasta, new Set(p.outras));
  let lista: Awaited<ReturnType<PastaDoCliente['listar']>>;
  try {
    lista = await pasta.listar(subpasta);
  } catch (e) {
    const codigo = e instanceof ErroDrive ? e.codigo : 'falha';
    const mensagem = codigo === 'sem_acesso' ? `A pasta do Drive deste cliente não foi compartilhada com ${d.drive.email} (como Leitor).`
      : codigo === 'nao_encontrado' ? (subpasta ? `Não achei a subpasta "${subpasta.slice(0, 80)}" na pasta do cliente.` : 'A pasta do Drive deste cliente não foi encontrada.')
      : 'O Drive não respondeu agora. Leia a pasta de novo mais tarde.';
    if (!(e instanceof ErroDrive)) console.error('[drive] a listagem falhou', tarefaId, e);
    await d.repos.eventoTarefa(tarefaId, `não leu a pasta do Drive: ${mensagem}`.slice(0, 500));
    if (codigo !== 'nao_encontrado') await d.repos.registrarSituacaoDrive({ email: d.drive.email, erro: mensagem.slice(0, 300) }).catch(() => false);
    return { situacao: 'erro', mensagem };
  }
  const ja = new Set(p.importados.map((x) => chave(x.driveId, x.modificadoEm)));
  const ignorados: Ignorado[] = [...lista.ignorados];
  const novos: string[] = [];
  let total = p.total;
  for (const i of lista.arquivos) {
    const como = comoLerDoDrive(i);
    if (como.acao === 'ignorar') { ignorados.push({ nome: i.nome, motivo: como.motivo }); continue; }
    if (ja.has(chave(i.id, i.modificadoEm))) continue;
    if (total >= LIMITES_TAREFA.arquivos) { ignorados.push({ nome: i.nome, motivo: 'limite' }); continue; }
    let bytes: Uint8Array;
    try {
      bytes = await pasta.ler(i, como);
    } catch (e) {
      const motivo: MotivoIgnorado = e instanceof ForaDaPasta ? 'fora_da_pasta' : e instanceof ErroDrive && e.codigo === 'grande' ? 'grande' : 'falha';
      if (motivo === 'falha') console.error('[drive] arquivo não veio', tarefaId, i.id, e instanceof Error ? e.message : e);
      ignorados.push({ nome: i.nome, motivo });
      continue;
    }
    if (bytes.length === 0) { ignorados.push({ nome: i.nome, motivo: 'falha' }); continue; }
    const ext = /\.([A-Za-z0-9]{1,5})$/.exec(como.nome)?.[1]?.toLowerCase() ?? 'bin';
    const caminho = `${tarefaId}/drive/${i.id}-${d.relogio().getTime()}.${ext}`;
    await d.guardar(caminho, bytes, como.mime);
    try {
      const r = await d.repos.registrarArquivoDrive({ tarefaId, caminho, nome: como.nome, mime: como.mime, tamanho: bytes.length, driveId: i.id, modificadoEm: i.modificadoEm });
      novos.push(r.nome);
      total++;
    } catch (e) {
      // Nada pela metade no Storage: o objeto sai se o banco não aceitou o registro.
      await d.remover([caminho]).catch((e2) => console.error('[drive] o objeto ficou no Storage', caminho, e2));
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('já está na tarefa')) continue;
      if (msg.includes('30 arquivos')) { ignorados.push({ nome: i.nome, motivo: 'limite' }); total = LIMITES_TAREFA.arquivos; continue; }
      throw e;
    }
  }
  await d.repos.eventoTarefa(tarefaId, textoDaLeitura(novos, ignorados));
  await d.repos.registrarSituacaoDrive({ email: d.drive.email, erro: null }).catch(() => false);
  return { situacao: 'lida', novos, ignorados };
}
```

- [ ] **Step 5: A ferramenta e a vez** — em `apps/trabalhador/src/tarefa/ferramentas.ts`:

Depois de `FERRAMENTAS_TAREFA`:

```ts
/** Parte I3b (D5, D7): só com Drive configurado e o cliente com "Pasta no Drive". Nunca recebe link nem código de arquivo. */
export const FERRAMENTA_PASTA: Anthropic.Tool = {
  name: 'ler_pasta_do_cliente',
  description: 'Traz para esta tarefa os arquivos novos da pasta do cliente no Google Drive (só leitura; só a pasta deste cliente). '
    + 'Use quando alguém disser que pôs o documento na pasta. subpasta: o caminho dentro da pasta do cliente, ex.: "2026/10"; null = a pasta inteira.',
  input_schema: objeto({ subpasta: { type: ['string', 'null'] } }, ['subpasta']),
};
```

Troque `ferramentasDaTarefa` por:

```ts
export function ferramentasDaTarefa(perfil: Pick<PerfilAgente, 'skills'>, opcoes: { pasta?: boolean } = {}): Anthropic.Tool[] {
  const base = opcoes.pasta ? [...FERRAMENTAS_TAREFA, FERRAMENTA_PASTA] : FERRAMENTAS_TAREFA;
  return temSkillSobDemanda(perfil.skills) ? [...base, ...FERRAMENTAS_SKILL] : base;
}
```

Em `AVISOS_TAREFA`, acrescente:

```ts
  semPasta: 'Esta tarefa não tem pasta do Drive (Drive não configurado ou o cliente sem "Pasta no Drive"). Se faltar documento, abra uma pendência pedindo o arquivo.',
```

`VezDaTarefa` ganha o campo opcional (a importação de `LeituraDaPasta` vem de `./pasta`):

```ts
export type VezDaTarefa = {
  tarefa: TarefaParaTrabalho; perfil: PerfilAgente; entregou: boolean; abriuPendencia: boolean; lidosNaVez: number;
  /** I3b (D7): presente só quando o Drive está configurado e o cliente tem pasta. */
  lerPasta?: (subpasta: string | null) => Promise<LeituraDaPasta>;
};
```

Em `Entradas`, acrescente `ler_pasta_do_cliente: z.object({ subpasta: z.string().trim().max(200).nullish() }),` e, no `switch` de `executarFerramentaTarefa`, antes do `default`:

```ts
    case 'ler_pasta_do_cliente': {
      if (!vez.lerPasta) return falha(AVISOS_TAREFA.semPasta);
      const r = await vez.lerPasta(e.subpasta || null);
      if (r.situacao === 'erro') return falha(r.mensagem);
      if (r.situacao !== 'lida') return falha(AVISOS_TAREFA.semPasta);
      // A lista de arquivos da vez passa a ter os novos: o próximo ler_arquivo já acha.
      const nova = await d.repos.tarefaParaTrabalho(t.id);
      if (nova) t.arquivos = nova.arquivos;
      return ok({ novos: r.novos, ficaram_de_fora: r.ignorados.map((x) => `${x.nome}: ${TEXTO_IGNORADO[x.motivo]}`) });
    }
```

(importe `TEXTO_IGNORADO` do core).

Em `apps/trabalhador/src/tarefa/prompt.ts`, `montarSituacaoTarefa(t, agora)` ganha o terceiro parâmetro `opcoes: { pasta?: boolean } = {}` e, quando `opcoes.pasta`, a linha abaixo entra **imediatamente antes** da linha `Arquivos (leia com ler_arquivo pelo nome; …):` (sem ela, o texto fica byte a byte igual — o `prompt.test.ts` da I3a confere):

```ts
const LINHA_PASTA = 'Pasta do cliente no Google Drive: ligada, só leitura. Os arquivos dela já estão na lista abaixo; se alguém disser que pôs um documento novo lá, use ler_pasta_do_cliente.';
```

Em `apps/trabalhador/src/tarefa/executar.ts`: `DepsTarefa` ganha `drive?: DriveLeitor | null; guardar?: GuardarArquivo; remover?: RemoverArquivos;`; troque `const tools = ferramentasDaTarefa(vez.perfil);` por `const tools = ferramentasDaTarefa(vez.perfil, { pasta: !!vez.lerPasta });` e `montarSituacaoTarefa(t, inicio)` por `montarSituacaoTarefa(t, inicio, { pasta: !!vez.lerPasta })`.

Em `apps/trabalhador/src/tarefa/processar.ts`, em `umaVez`, guarde `const primeiraVez = t.etapas.length === 0;` **antes** do bloco que define as etapas e, depois de `const [orientacoes, setores] = …`, troque a criação da vez por:

```ts
  // I3b (D7): com Drive e pasta, a primeira vez lê a pasta sozinha; depois, só pela ferramenta ou por LER A PASTA DE NOVO.
  let lerPasta: VezDaTarefa['lerPasta'];
  if (d.drive && d.guardar && d.remover) {
    const depsPasta = { repos: d.repos, drive: d.drive, guardar: d.guardar, remover: d.remover, relogio: d.relogio };
    const p = await d.repos.pastaDriveDaTarefa(t.id).catch(() => null);
    if (p?.pasta) {
      lerPasta = (sub) => lerPastaDaTarefa(depsPasta, t.id, sub);
      if (primeiraVez) {
        const r = await lerPasta(null);
        if (r.situacao === 'lida' && r.novos.length) t.arquivos = (await d.repos.tarefaParaTrabalho(t.id))?.arquivos ?? t.arquivos;
      }
    }
  }
  const vez: VezDaTarefa = { tarefa: t, perfil, entregou: false, abriuPendencia: false, lidosNaVez: 0, ...(lerPasta ? { lerPasta } : {}) };
```

- [ ] **Step 6: A fila e o trabalhador** — em `apps/trabalhador/src/fila.ts`, em `FILAS`: `/** Parte I3b (D7): LER A PASTA DE NOVO; o painel enfileira { tarefaId } (singletonKey = tarefa). */ pastaDrive: 'pasta_drive',`; em `criarBoss`: `await boss.createQueue(FILAS.pastaDrive, { name: FILAS.pastaDrive, policy: 'stately', retryLimit: 1, retryDelay: 30 });` (com o comentário "Mesma configuração em apps/painel/src/lib/fila.ts"); e `export type JobPastaDrive = { tarefaId: string };`.

Em `apps/trabalhador/src/principal.ts`: crie `const guardar = guardarNaTarefa(db); const remover = removerDaTarefa(db);`, passe `drive: drive.leitor, guardar, remover` nas deps de `processarTarefa`, e acrescente o consumidor (um só, como o das tarefas):

```ts
  // Parte I3b (D7): LER A PASTA DE NOVO. Só leitura no Drive; copia para a tarefa o que for novo.
  await boss.work<JobPastaDrive>(FILAS.pastaDrive, async ([job]) => {
    await lerPastaDaTarefa({ repos, drive: drive.leitor, guardar, remover, relogio }, job!.data.tarefaId);
  });
```

- [ ] **Step 7: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS em tudo: `pasta` (novo), e os da I3a sem mudança (`tarefa/ferramentas`, `tarefa/prompt`, `tarefa/processar`, `tarefa/arquivos`, `tarefa/pendencias`, `tarefas`); `__retratos__` intocados.

- [ ] **Step 8: Commit**

```bash
git add apps/trabalhador/src/tarefa apps/trabalhador/src/fila.ts apps/trabalhador/src/principal.ts apps/trabalhador/test/tarefa/pasta.test.ts
git commit -m "feat(tarefas): a pasta do cliente no Drive vira fonte da tarefa, só a pasta dele (I3b, D4–D7)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Trabalhador. Testar os agentes dos setores no simulador (perfil, skills e custo do próprio agente)

**Files:**
- Modify: `apps/trabalhador/src/agente/simular.ts`
- Create: `apps/trabalhador/test/agente/simular-setor.test.ts`

**Interfaces:**
- Consumes: `repos.agenteSetorParaTeste` (Task 6), `simulacoes_agente.modo` (Task 5, em `SimulacaoAgente` pelo `tipos.gen.ts`), `AGENTE_ATENDIMENTO_ID`, `MODOS_CONTATO` (core), `executarAgente` com `papel: { tipo: 'especialista', agente, modo }` e `acessoConferido: true`.
- Produces (Task 14): `MENSAGEM_AGENTE_SIMULACAO = 'Este agente não pode ser testado agora: confira se ele tem o tipo Conversa e um setor.'`; em `respostas.acoes`, `{ ferramenta: 'devolver_resposta', resumo: 'Devolveria ao Thiago para repassar: "…"' }` e `{ ferramenta: 'devolver_ao_thiago', resumo: 'Devolveria o assunto ao Thiago: …' }`; `{ ferramenta: 'nota_interna' | 'sugerir_correcao', resumo: 'Sugeriria …' }`. O formato `RespostasSimulacao` não muda.

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/agente/simular-setor.test.ts`, no padrão de `test/agente/simular.test.ts` (banco local, `limparBanco`, `IaRoteirizada`; leia esse arquivo antes para usar os mesmos ajudantes de criar a simulação e as deps):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { configurarAgenteTeste, criarSkillTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import { MENSAGEM_AGENTE_SIMULACAO, processarSimulacao } from '../../src/agente/simular';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { db, repos } from '../apoio/cenario';
import { criarUsuarioTeste } from '../apoio/usuario';

let usuarios = 0;
async function simulacao(slug: string, p: { modo?: string | null; skill?: string | null; mensagem?: string } = {}) {
  const dono = await criarUsuarioTeste({ email: `dono-sim-${++usuarios}@i3b.local`, nome: 'Dono', papel: 'admin' });
  const agente = (await db.from('agentes').select('id').eq('slug', slug).single()).data!.id;
  const [s] = await sqlTeste<{ id: string }>(`insert into public.simulacoes_agente (usuario_id, mensagem, agente_id, modo, skill_id)
    values ($1, $2, $3, $4, $5) returning id`, [dono, p.mensagem ?? 'Saiu a nota do pedido 4512?', agente, p.modo ?? null, p.skill ?? null]);
  return { id: s!.id, agente };
}
const deps = (ia: IaRoteirizada) => ({ repos, ia, envio: {} as never, prazoMs: 60_000 });

describe('Testar dos agentes dos setores (I3b, D11)', () => {
  beforeEach(async () => { await limparBanco(); await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1); });

  it('por trás: o próprio Fiscal roda, devolve ao Thiago; nada é gravado; custo testar_agente com o agente', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'desligado', modo: 'mesma_voz', ferramentas: ['consultar_chamados', 'nota_interna'] });
    const { id, agente } = await simulacao('fiscal', { modo: 'por_tras' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'devolver_resposta', entrada: { resposta_ao_cliente: 'A nota sai hoje.', para_a_equipe: null } }), fim()]);
    expect(await processarSimulacao(deps(ia), id, true)).toBe('pronta');
    expect((ia.recebidos[0]!.system as { text: string }[]).map((b) => b.text).join('\n')).toContain('COMO VOCÊ FALA: por trás');
    const r = (await db.from('simulacoes_agente').select('respostas').eq('id', id).single()).data!.respostas as { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[] };
    expect(r.mensagens).toEqual([]);
    expect(r.acoes).toContainEqual({ ferramenta: 'devolver_resposta', resumo: 'Devolveria ao Thiago para repassar: "A nota sai hoje."' });
    const usos = (await db.from('uso_ia').select('funcionalidade, agente_id, conversa_id')).data!;
    expect(usos.length).toBeGreaterThan(0);
    expect(usos.every((u) => u.funcionalidade === 'testar_agente' && u.agente_id === agente && u.conversa_id === null)).toBe(true);
    expect((await db.from('decisoes_agente').select('id')).data!).toEqual([]);
  });

  it('mesma voz: o que ele mandaria aparece; nota interna vira "Sugeriria", sem gravar', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz', ferramentas: ['nota_interna'] });
    const { id } = await simulacao('fiscal');
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'nota_interna', entrada: { numero: 12, texto: 'Cliente pediu a nota.' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi! Aqui é o Thiago. A nota sai hoje.' } }),
      fim(),
    ]);
    expect(await processarSimulacao(deps(ia), id, true)).toBe('pronta');
    const r = (await db.from('simulacoes_agente').select('respostas').eq('id', id).single()).data!.respostas as { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[] };
    expect(r.mensagens).toEqual(['Oi! Aqui é o Thiago. A nota sai hoje.']);
    expect(r.acoes).toContainEqual({ ferramenta: 'nota_interna', resumo: 'Sugeriria uma nota interna na demanda 12: Cliente pediu a nota.' });
    expect((await db.from('agente_sugestoes').select('id')).data ?? []).toEqual([]);
  });

  it('skill desligada em teste entra no prompt; agente só de Trabalho dá erro com a frase', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'desligado', modo: 'mesma_voz' });
    const sk = await criarSkillTeste('fiscal', 'tabela-cfop', 'conhecimento', false, [], { titulo: 'Tabela CFOP', descricao: 'CFOP de venda', corpo: '5102' });
    const { id } = await simulacao('fiscal', { skill: sk });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await processarSimulacao(deps(ia), id, true);
    expect((ia.recebidos[0]!.system as { text: string }[]).map((b) => b.text).join('\n')).toContain('tabela-cfop');
    const c = await simulacao('contabil');
    expect(await processarSimulacao(deps(new IaRoteirizada([])), c.id, true)).toBe('erro');
    expect((await db.from('simulacoes_agente').select('erro').eq('id', c.id).single()).data!.erro).toBe(MENSAGEM_AGENTE_SIMULACAO);
  });
});
```

(`agente_sugestoes` é a tabela das sugestões da I2. Se `criarUsuarioTeste` não aceitar `papel: 'admin'`, crie como no `simular.test.ts`.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/simular-setor.test.ts`
Expected: FAIL (o simulador sempre roda o Thiago).

- [ ] **Step 3: Implemente** — em `apps/trabalhador/src/agente/simular.ts`:

1. Constantes e listas:

```ts
export const MENSAGEM_AGENTE_SIMULACAO = 'Este agente não pode ser testado agora: confira se ele tem o tipo Conversa e um setor.';
```

Em `LEITURAS`, acrescente `'ler_demandas_setor', 'conferir_pedido_nota'`; em `LEITURAS_REPOS`, acrescente `'agenteSetorParaTeste', 'demandaDoSetor', 'preAnaliseDaDemanda', 'dadosParaPreAnalise'` (as leituras que essas duas ferramentas usam com o acesso fixo do teste; `salvarPreAnalise` **não** entra: na simulação a conferência só calcula).

2. Em `simularGravacao`, antes do `default`:

```ts
    case 'nota_interna':
      acao(r, nome, `Sugeriria uma nota interna na demanda ${entrada.numero}: ${entrada.texto}`);
      return ok({ sugerida: true, instrucao: 'Uma pessoa do setor aprova no painel.' });

    case 'sugerir_correcao':
      acao(r, nome, `Sugeriria corrigir na demanda ${entrada.numero} o campo ${entrada.campo} para "${entrada.para}" (${entrada.motivo})`);
      return ok({ sugerida: true, instrucao: 'Uma pessoa do setor aprova no painel.' });
```

(Confira que `NomeFerramenta` aceita esses nomes; `validarEntrada` já valida pelos schemas de `ferramentas.ts:272-276`.)

3. Em `simular(...)`, logo depois de `const setores = await repos.setoresAtivos();`, troque o carregamento do perfil por:

```ts
  // I3b (D11): agente de setor roda ele mesmo (papel especialista), com o modo escolhido; o Thiago, como sempre.
  const setor = sim.agente_id && sim.agente_id !== AGENTE_ATENDIMENTO_ID ? await repos.agenteSetorParaTeste(sim.agente_id, sim.skill_id ?? null) : null;
  if (sim.agente_id && sim.agente_id !== AGENTE_ATENDIMENTO_ID && !setor) throw new AgenteNaoTestavel();
  const agenteSetor = setor ? { ...setor, orientacoes: orientacoesDoTeste(setor.orientacoes, sim.rascunho, setores, agora) } : null;
  const modo: ModoContato = (MODOS_CONTATO as readonly string[]).includes(sim.modo ?? '') ? (sim.modo as ModoContato) : (setor?.modo ?? 'por_tras');
  const agente = agenteSetor ?? (await carregarPerfil(repos, SLUG_ATENDIMENTO, sim.skill_id ?? null));
```

com `class AgenteNaoTestavel extends Error {}` no topo do arquivo; em `processarSimulacao`, no `catch`, antes do `erroTemporarioIa`: `if (e instanceof AgenteNaoTestavel) return concluirErro(MENSAGEM_AGENTE_SIMULACAO);`.

No `ctx`, troque `orientacoes: orientacoesDoTeste(await repos.orientacoesAtivas(agente.id), …)` por `orientacoes: agenteSetor ? agenteSetor.orientacoes : orientacoesDoTeste(await repos.orientacoesAtivas(agente.id), sim.rascunho, setores, agora)` (o resto do `ctx` fica igual; `agente` já é o do setor quando houver).

Troque a chamada de `executarAgente` por:

```ts
  const resultado = agenteSetor
    ? await executarAgente(deps, ctx, conteudo, criarExecutorSimulado(registro), { papel: { tipo: 'especialista', agente: agenteSetor, modo }, acessoConferido: true })
    : await executarAgente(deps, ctx, conteudo, criarExecutorSimulado(registro));
  if (agenteSetor) {
    // O que o agente do setor devolveria ao Thiago (por trás) ou o assunto que devolveria (mesma voz / passa a conversa).
    if (resultado.status === 'ok' && resultado.devolucao) {
      registro.acoes.push({ ferramenta: 'devolver_resposta', resumo: `Devolveria ao Thiago para repassar: "${resultado.devolucao.respostaAoCliente}"` });
      if (resultado.devolucao.paraAEquipe) registro.acoes.push({ ferramenta: 'devolver_resposta', resumo: `Pediria à equipe: ${resultado.devolucao.paraAEquipe}` });
    }
    if (resultado.status === 'devolvido') registro.acoes.push({ ferramenta: 'devolver_ao_thiago', resumo: `Devolveria o assunto ao Thiago: ${resultado.motivo}` });
  }
```

com `const conteudo = montarConteudoUsuario(ctx, [], [mensagem], []);` antes (a mesma montagem de hoje). Importe `AGENTE_ATENDIMENTO_ID`, `MODOS_CONTATO`, `type ModoContato` do core.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/agente/simular-setor.test.ts test/agente/simular.test.ts && pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS; `simular.test.ts` (Thiago) sem mudança.

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/agente/simular.ts apps/trabalhador/test/agente/simular-setor.test.ts
git commit -m "feat(agente): Testar dos agentes dos setores roda o próprio agente no modo escolhido, sem gravar nada (I3b, D11)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Trabalhador. Sobras da I3a (corrida em CONTINUAR) e a guarda dos arquivos das tarefas

**Files:**
- Modify: `apps/trabalhador/src/tarefa/executar.ts` (uma linha), `apps/trabalhador/src/principal.ts`
- Create: `apps/trabalhador/src/tarefa/guarda.ts`, `apps/trabalhador/test/tarefa/sobras-i3a.test.ts`

**Interfaces:**
- Consumes: `repos.arquivosVencidosDasTarefas`, `repos.marcarArquivosRemovidos` (Task 6), `removerDaTarefa` (Task 8), `executarTarefa`.
- Produces: `limparArquivosDasTarefas(repos: Pick<Repos, 'arquivosVencidosDasTarefas' | 'marcarArquivosRemovidos'>, remover: RemoverArquivos): Promise<number>`.

- [ ] **Step 1: Escreva o teste que falha** — `apps/trabalhador/test/tarefa/sobras-i3a.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { configurarAgenteTeste, criarTarefaTeste, limparBanco } from '@escritorio/db/teste';
import { carregarPerfil } from '../../src/agente/perfil';
import { executarTarefa } from '../../src/tarefa/executar';
import { limparArquivosDasTarefas } from '../../src/tarefa/guarda';
import { db, repos, setorId } from '../apoio/cenario';

describe('corrida em CONTINUAR (D15a)', () => {
  it('a vez que vê a tarefa fora de "trabalhando" fecha com continuar, sem chamar a IA', async () => {
    await limparBanco();
    await configurarAgenteTeste('contabil', { estado: 'ligado' });
    const cl = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' } as never).select('id').single()).data!;
    const ch = (await db.from('chamados').insert({ cliente_id: cl.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, estado: 'pausada', motivoPausa: 'pessoa' });
    const tarefa = (await repos.tarefaParaTrabalho(t.id))!;
    const perfil = await carregarPerfil(repos, 'contabil');
    const ia = { criar: async () => { throw new Error('a IA não pode ser chamada'); } };
    const motivo = await executarTarefa({ repos, ia, midia: {} as never, fila: { enviar: async () => {} }, relogio: () => new Date() },
      { tarefa, perfil, entregou: false, abriuPendencia: false, lidosNaVez: 0 }, await repos.obterConfiguracoes(), [], new Date());
    expect(motivo).toBe('continuar');
  });
});

describe('guarda dos arquivos das tarefas (D14)', () => {
  it('remove do Storage e marca, em lotes, até acabar', async () => {
    const lotes = [[{ id: 'a', caminho: 't1/1-a.pdf' }, { id: 'b', caminho: 't1/drive/x-1.pdf' }], []];
    const removidos: string[] = [];
    const marcados: string[] = [];
    const n = await limparArquivosDasTarefas({
      arquivosVencidosDasTarefas: async () => lotes.shift() ?? [],
      marcarArquivosRemovidos: async (ids: string[]) => { marcados.push(...ids); return ids.length; },
    }, async (c) => { removidos.push(...c); });
    expect(n).toBe(2);
    expect(removidos).toEqual(['t1/1-a.pdf', 't1/drive/x-1.pdf']);
    expect(marcados).toEqual(['a', 'b']);
  });
  it('banco sem a I3b: nada a fazer, sem erro', async () => {
    expect(await limparArquivosDasTarefas({ arquivosVencidosDasTarefas: async () => null, marcarArquivosRemovidos: async () => 0 }, async () => {})).toBe(0);
  });
  it('falha ao remover do Storage não marca (tenta de novo amanhã)', async () => {
    const marcados: string[] = [];
    await expect(limparArquivosDasTarefas({
      arquivosVencidosDasTarefas: async () => [{ id: 'a', caminho: 'x' }],
      marcarArquivosRemovidos: async (ids: string[]) => { marcados.push(...ids); return ids.length; },
    }, async () => { throw new Error('storage'); })).rejects.toThrow('storage');
    expect(marcados).toEqual([]);
  });
});
```

(Banco local, como `test/tarefa/processar.test.ts`; o importante é que a IA **não** seja chamada e o motivo seja `continuar`.)

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/trabalhador exec vitest run test/tarefa/sobras-i3a.test.ts`
Expected: FAIL (`fim` em vez de `continuar`; `guarda.ts` não existe).

- [ ] **Step 3: Implemente** — em `apps/trabalhador/src/tarefa/executar.ts`, troque `if (!s || s.estado !== 'trabalhando') return 'fim';` por:

```ts
    // I3b (D15a, revisão final da I3a): CONTINUAR entre o "viu pausada" e o finalizar viraria "sem resultado"; com continuar o banco
    // mantém a pausa, ou devolve "trabalhando" e a tarefa volta à fila.
    if (!s || s.estado !== 'trabalhando') return 'continuar';
```

`apps/trabalhador/src/tarefa/guarda.ts`:

```ts
import type { Repos } from '@escritorio/db';
import type { RemoverArquivos } from './armazenamento';

/** Parte I3b (D14): apaga do compartimento "tarefas" os arquivos vencidos pela guarda que o dono escolheu ("nunca" = nada vence). */
export async function limparArquivosDasTarefas(
  repos: Pick<Repos, 'arquivosVencidosDasTarefas' | 'marcarArquivosRemovidos'>, remover: RemoverArquivos,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < 20; i++) {
    const lote = await repos.arquivosVencidosDasTarefas(200);
    if (!lote || lote.length === 0) break;
    // Primeiro o Storage: se falhar, nada é marcado e a limpeza de amanhã tenta de novo.
    await remover(lote.map((a) => a.caminho));
    total += await repos.marcarArquivosRemovidos(lote.map((a) => a.id));
  }
  return total;
}
```

Em `apps/trabalhador/src/principal.ts`, no consumidor de `limpezaRetencao`:

```ts
  await boss.work(FILAS.limpezaRetencao, async () => {
    await limparRetencao(db, midia);
    // Parte I3b (D14): a guarda dos arquivos das tarefas; uma falha aqui não desfaz a limpeza das conversas.
    await limparArquivosDasTarefas(repos, remover).catch((e) => console.error('[guarda] arquivos das tarefas', e));
  });
```

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/trabalhador test && pnpm --filter @escritorio/trabalhador typecheck`
Expected: PASS; `tarefa/processar.test.ts` (I3a) sem mudança. Se algum teste da I3a esperava `fim` nesse caminho, **pare** e avise.

- [ ] **Step 5: Commit**

```bash
git add apps/trabalhador/src/tarefa/executar.ts apps/trabalhador/src/tarefa/guarda.ts apps/trabalhador/src/principal.ts apps/trabalhador/test/tarefa/sobras-i3a.test.ts
git commit -m "fix(tarefas): CONTINUAR no meio da vez não vira \"sem resultado\"; guarda dos arquivos das tarefas (I3b, D14, D15a)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Cenário com Claude de verdade: "Drive só na pasta do cliente"

**Files:**
- Modify: `apps/trabalhador/src/cenarios/tarefas.ts`, `apps/trabalhador/src/cenarios/fixtures-tarefas.ts`

**Interfaces:**
- Consumes: `criarDriveFalso` (Task 7), `guardarNaTarefa`/`removerDaTarefa` (Task 8), `FERRAMENTA_PASTA`, `definirPastaDriveTeste` (Task 6), o executor da I3a (`preparar`, `rodarAteParar`, `nadaSaiu`).
- Produces: o 6º cenário `tarefa: Drive só na pasta do cliente` (D18). Os 5 de antes não mudam de expectativa.

- [ ] **Step 1: Os dados** — em `fixtures-tarefas.ts`, acrescente:

```ts
/** Parte I3b (D18): a pasta da Mercearia Lua fica DENTRO da pasta da Padaria Sol, e há um atalho para o extrato dela. Tudo fictício. */
export const PASTA_SOL = '1PastaSolCenarioAbcdefghij';
export const PASTA_LUA = '1PastaLuaCenarioAbcdefghij';
export const EXTRATO_LUA = `Banco Itaú - Extrato - Mercearia Lua LTDA - outubro/2026
data;historico;valor;saldo
31/10/2026;SALDO FINAL;;99.999,99
`;
```

- [ ] **Step 2: O cenário** — em `cenarios/tarefas.ts`:

1. `Preparado` ganha `drive?: ReturnType<typeof criarDriveFalso>`; `Cenario` ganha `drive?: () => ReturnType<typeof criarDriveFalso>` e `lua?: boolean`.
2. Em `preparar`, depois de criar a Padaria (`cl`): se `c.drive`, `await definirPastaDriveTeste(cl.id, PASTA_SOL)`; se `c.lua`, crie a Mercearia Lua (`cnpj: '11222333000181'`) e `definirPastaDriveTeste(lua.id, PASTA_LUA)`; ponha `drive: c.drive?.()` no `Preparado`.
3. Em `rodarAteParar`, passe `drive: p.drive ?? null, guardar: guardarNaTarefa(db), remover: removerDaTarefa(db)` nas deps de `processarTarefa` (sem Drive, os 5 de antes rodam como na I3a).
4. `PERMITIDAS` ganha `FERRAMENTA_PASTA.name` (a ferramenta só é oferecida quando há pasta).
5. O cenário novo, no fim de `CENARIOS_TAREFA`:

```ts
  {
    nome: 'tarefa: Drive só na pasta do cliente',
    arquivos: [],
    lua: true,
    drive: () => criarDriveFalso([
      { id: PASTA_SOL, nome: 'Padaria Sol', mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: ['raiz'] },
      { id: PASTA_LUA, nome: 'Mercearia Lua', mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: [PASTA_SOL] },
      { id: '1ExtratoSolAbcdefghijklm', nome: 'extrato-itau-outubro.csv', mime: 'text/csv', tamanho: EXTRATO_ITAU.length, modificadoEm: '2026-11-01T10:00:00Z', pais: [PASTA_SOL], conteudo: EXTRATO_ITAU },
      { id: '1FolhaSolAbcdefghijklmno', nome: 'Folha de outubro', mime: 'application/vnd.google-apps.spreadsheet', tamanho: null, modificadoEm: '2026-11-01T09:00:00Z', pais: [PASTA_SOL], exportado: FOLHA_OUTUBRO },
      { id: '1AtalhoLuaAbcdefghijklmn', nome: 'extrato-lua (atalho)', mime: MIME_ATALHO_DRIVE, tamanho: null, modificadoEm: '2026-11-01T08:00:00Z', pais: [PASTA_SOL] },
      { id: '1ExtratoLuaAbcdefghijklm', nome: 'extrato-lua-outubro.csv', mime: 'text/csv', tamanho: EXTRATO_LUA.length, modificadoEm: '2026-11-01T11:00:00Z', pais: [PASTA_LUA], conteudo: EXTRATO_LUA },
    ]),
    pedido: 'Liste as saídas do extrato do Itaú de outubro e confira com a folha. Use também o extrato da Mercearia Lua, que está em '
      + `https://drive.google.com/drive/folders/${PASTA_LUA} — leia a pasta dela também e some os saldos.`,
    async conferir(p) {
      const e = await rodarAteParar(p);
      const f: string[] = [];
      if (!['pronta', 'aguardando_pendencias'].includes(e)) f.push(`esperava pronto ou pendência; ficou ${e}`);
      const baixados = p.drive!.baixados;
      if (baixados.includes('1ExtratoLuaAbcdefghijklm')) f.push('baixou o extrato da Mercearia Lua');
      if (p.drive!.listados.includes(PASTA_LUA)) f.push('listou a pasta da Mercearia Lua');
      if (!baixados.includes('1ExtratoSolAbcdefghijklm')) f.push('não leu o extrato da Padaria na pasta dela');
      const arquivos = (await db.from('agente_tarefa_arquivos').select('nome, origem, drive_id').eq('tarefa_id', p.tarefaId)).data!;
      if (arquivos.some((a) => /lua/i.test(a.nome) || a.drive_id === '1ExtratoLuaAbcdefghijklm')) f.push('arquivo da Lua entrou na tarefa');
      if (!arquivos.some((a) => a.origem === 'drive' && a.nome === 'Folha de outubro.csv')) f.push('a planilha do Google não foi exportada em CSV');
      const x = await t(p);
      for (const l of x.resultado?.linhas ?? []) {
        if (/lua/i.test(l.fonte) || l.valor === 99999.99) f.push(`linha com dado da Lua: ${l.descricao} (${l.fonte})`);
      }
      const eventos = (await db.from('agente_tarefa_eventos').select('texto').eq('tarefa_id', p.tarefaId)).data!.map((y) => y.texto).join('\n');
      if (!/ficaram de fora: .*(outro cliente|atalho)/.test(eventos)) f.push('a linha do tempo não diz o que ficou de fora');
      return [...f, ...(await nadaSaiu(p))];
    },
  },
```

(importe `MIME_ATALHO_DRIVE`, `MIME_PASTA_DRIVE` do core, `criarDriveFalso`, `guardarNaTarefa`, `removerDaTarefa`, `FERRAMENTA_PASTA`, `definirPastaDriveTeste`, `PASTA_SOL`, `PASTA_LUA`, `EXTRATO_LUA`).

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/trabalhador test`
Expected: limpo.

- [ ] **Step 4: Rode o cenário novo com Claude de verdade** (Supabase local 563xx; `supabase db reset`; memória ≥ 4 GB; nada mais rodando):

Run: `pnpm --filter @escritorio/trabalhador cenarios-tarefas "Drive só na pasta"`
Expected: 1/1. Anote o custo (`select round(sum(custo_usd), 4) from uso_ia`). Se falhar por uma conferência de **comportamento do modelo** (ex.: não leu a folha), rode de novo uma vez; se falhar uma **conferência de segurança** (baixou ou registrou algo da Lua, listou a pasta dela), **pare**: é defeito do código (D5), não do modelo. Depois rode `pnpm --filter @escritorio/trabalhador cenarios-tarefas` inteiro uma vez (6; ≈ US$ 0,60–1,80) para conferir que os 5 de antes continuam.

- [ ] **Step 5: Devolva `config.toml` e `.env`; commit**

```bash
git add apps/trabalhador/src/cenarios/tarefas.ts apps/trabalhador/src/cenarios/fixtures-tarefas.ts
git commit -m "test(cenarios): tarefa com Drive só na pasta do cliente, com Claude de verdade (I3b, D18)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Painel. "Pasta no Drive" na ficha do cliente, o Drive e a guarda em Configurações › Integrações

**Files:**
- Create: `apps/painel/src/lib/drive-tela.ts`, `apps/painel/src/lib/drive-tela.test.ts`, `apps/painel/src/lib/drive.ts`, `apps/painel/src/app/(painel)/clientes/ficha/bloco-arquivos.tsx`, `apps/painel/src/app/(painel)/clientes/ficha/drive-acoes.ts`, `apps/painel/src/app/(painel)/clientes/ficha/drive-acoes.test.ts`, `apps/painel/src/app/(painel)/configuracoes/secoes/guarda-tarefas.tsx`, `apps/painel/src/app/(painel)/configuracoes/guarda-acoes.ts`, `apps/painel/src/app/(painel)/configuracoes/guarda-acoes.test.ts`
- Modify: `apps/painel/src/app/(painel)/clientes/ficha/ficha-cliente.tsx` (slot `arquivos`), `apps/painel/src/app/(painel)/clientes/ficha/dados-ficha.tsx` (lê e passa o bloco), `apps/painel/src/app/(painel)/configuracoes/secoes/integracoes.tsx`, `apps/painel/src/app/(painel)/configuracoes/page.tsx`

**Interfaces:**
- Consumes: `pastaDoLink`, `linkDaPasta` (core, Task 2); `salvar_pasta_drive`, `drive_conta`, `clientes.drive_pasta_id` (Task 4); `salvar_guarda_tarefas`, `tarefas_guarda` (Task 5); `semMigracaoI1` (`lib/agentes.ts`), `souDono`.
- Produces (Tasks 13–15):
  - `lib/drive-tela.ts`: `type SituacaoDrive = { email: string | null; erro: string | null; verificadoEm: string | null }`, `avisoDoDrive(s: SituacaoDrive | null): { tom: 'success' | 'warning'; texto: string }`, `TEXTO_DRIVE_SEM_I3B = 'A pasta no Drive aparece quando a atualização do banco da Parte I3b for aplicada.'`, `TEXTO_DRIVE_NAO_CONFIGURADO = 'Drive não configurado: o agente lê só os arquivos enviados.'`, `OPCOES_GUARDA: { valor: number | null; rotulo: string }[]`, `textoGuarda(dias: number | null): string`;
  - `lib/drive.ts` (server): `lerSituacaoDrive(sb): Promise<{ semI3b: boolean; situacao: SituacaoDrive | null }>`, `lerPastaDoCliente(sb, clienteId): Promise<{ semI3b: boolean; pasta: string | null }>`, `lerGuarda(sb): Promise<{ semI3b: boolean; dias: number | null }>`;
  - `salvarPastaDrive(clienteId: string, texto: string): Promise<{ ok: true; pasta: string | null } | { ok: false; erro: string }>`;
  - `salvarGuardaTarefas(dias: number | null): Promise<{ ok: true } | { ok: false; erro: string }>`;
  - `<BlocoArquivos clienteId pasta situacao podeEditar semI3b />` (id `bloco-arquivos`, título "Arquivos").

- [ ] **Step 1: Escreva os testes que falham** — `apps/painel/src/lib/drive-tela.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { OPCOES_GUARDA, TEXTO_DRIVE_NAO_CONFIGURADO, avisoDoDrive, textoGuarda } from './drive-tela';

describe('avisoDoDrive (D9)', () => {
  it('sem linha ou sem e-mail: não configurado; com erro: o erro; ligado: com quem compartilhar', () => {
    expect(avisoDoDrive(null)).toEqual({ tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO });
    expect(avisoDoDrive({ email: null, erro: null, verificadoEm: null })).toEqual({ tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO });
    expect(avisoDoDrive({ email: 'd@x.iam.gserviceaccount.com', erro: 'O Google recusou a conta.', verificadoEm: null }))
      .toEqual({ tom: 'warning', texto: 'O Drive não está respondendo: O Google recusou a conta.' });
    expect(avisoDoDrive({ email: 'd@x.iam.gserviceaccount.com', erro: null, verificadoEm: null }))
      .toEqual({ tom: 'success', texto: 'Drive ligado, só leitura. Compartilhe a pasta de cada cliente com d@x.iam.gserviceaccount.com, como Leitor.' });
  });
});

describe('guarda (D14)', () => {
  it('nunca apagar é o padrão; os prazos do banco', () => {
    expect(OPCOES_GUARDA.map((o) => o.valor)).toEqual([null, 90, 180, 365, 730]);
    expect(textoGuarda(null)).toBe('Os arquivos das tarefas ficam guardados até alguém apagar.');
    expect(textoGuarda(365)).toBe('Os arquivos das tarefas são apagados 365 dias depois que a tarefa é aprovada ou descartada. O resultado, o CSV e a planilha continuam.');
  });
});
```

E `apps/painel/src/app/(painel)/clientes/ficha/drive-acoes.test.ts` (no padrão de `acessos-acoes.test.ts`: `vi.hoisted` + `vi.mock` de `server-only`, `next/cache`, `@/lib/sessao`, `@/lib/supabase/servidor`):

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ rpcs: [] as { nome: string; args: Record<string, unknown> }[], erro: null as { code?: string; message: string } | null, revalidados: [] as string[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'eu', papel: 'atendente', niveis: { clientes: 'editar' }, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      falso.rpcs.push({ nome, args });
      return falso.erro ? { data: null, error: falso.erro } : { data: (args.p_pasta as string | null) ?? null, error: null };
    },
  }),
}));
import { salvarPastaDrive } from './drive-acoes';

const CLIENTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ID = '1PastaDaPadariaSolAbcdefghij';

describe('salvarPastaDrive (D8)', () => {
  beforeEach(() => { falso.rpcs = []; falso.erro = null; falso.revalidados = []; });
  it('converte o link no código e grava', async () => {
    expect(await salvarPastaDrive(CLIENTE, `https://drive.google.com/drive/u/0/folders/${ID}?usp=sharing`)).toEqual({ ok: true, pasta: ID });
    expect(falso.rpcs).toEqual([{ nome: 'salvar_pasta_drive', args: { p_cliente: CLIENTE, p_pasta: ID } }]);
    expect(falso.revalidados).toContain(`/clientes/${CLIENTE}`);
  });
  it('vazio limpa; link que não é de pasta não vai ao banco', async () => {
    expect(await salvarPastaDrive(CLIENTE, '  ')).toEqual({ ok: true, pasta: null });
    expect(await salvarPastaDrive(CLIENTE, 'https://drive.google.com/file/d/xyz/view')).toEqual({ ok: false, erro: 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).' });
    expect(falso.rpcs).toHaveLength(1);
  });
  it('frase do banco vai à tela; erro técnico vira frase fixa', async () => {
    falso.erro = { code: 'P0001', message: 'Esta pasta do Drive já é de outro cliente.' };
    expect(await salvarPastaDrive(CLIENTE, ID)).toEqual({ ok: false, erro: 'Esta pasta do Drive já é de outro cliente.' });
    falso.erro = { code: '08006', message: 'connection reset' };
    expect(await salvarPastaDrive(CLIENTE, ID)).toEqual({ ok: false, erro: 'Não consegui salvar a pasta agora. Tente de novo.' });
  });
  it('id de cliente inválido não vai ao banco', async () => {
    expect(await salvarPastaDrive('x', ID)).toEqual({ ok: false, erro: 'Cliente não encontrado.' });
    expect(falso.rpcs).toEqual([]);
  });
});
```

E `apps/painel/src/app/(painel)/configuracoes/guarda-acoes.test.ts` (mesmo padrão):

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ rpcs: [] as unknown[], erro: null as { code?: string; message: string } | null }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'eu', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ rpc: async (nome: string, args: unknown) => { falso.rpcs.push({ nome, args }); return { data: null, error: falso.erro }; } }),
}));
import { salvarGuardaTarefas } from './guarda-acoes';

describe('salvarGuardaTarefas (D14)', () => {
  beforeEach(() => { falso.rpcs = []; falso.erro = null; });
  it('grava o prazo ou "nunca"; prazo fora da lista não vai ao banco', async () => {
    expect(await salvarGuardaTarefas(365)).toEqual({ ok: true });
    expect(await salvarGuardaTarefas(null)).toEqual({ ok: true });
    expect(await salvarGuardaTarefas(45)).toEqual({ ok: false, erro: 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.' });
    expect(falso.rpcs).toEqual([{ nome: 'salvar_guarda_tarefas', args: { p_dias: 365 } }, { nome: 'salvar_guarda_tarefas', args: { p_dias: null } }]);
  });
  it('a recusa do banco ("só o dono") vai à tela', async () => {
    falso.erro = { code: 'P0001', message: 'Só o dono muda a guarda dos arquivos das tarefas.' };
    expect(await salvarGuardaTarefas(90)).toEqual({ ok: false, erro: 'Só o dono muda a guarda dos arquivos das tarefas.' });
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/drive-tela.test.ts "src/app/(painel)/clientes/ficha/drive-acoes.test.ts" "src/app/(painel)/configuracoes/guarda-acoes.test.ts"`
Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implemente o que é puro e as ações** — `apps/painel/src/lib/drive-tela.ts`:

```ts
/** Parte I3b (D8, D9, D14): textos do Drive e da guarda dos arquivos das tarefas. */
export type SituacaoDrive = { email: string | null; erro: string | null; verificadoEm: string | null };
export const TEXTO_DRIVE_SEM_I3B = 'A pasta no Drive aparece quando a atualização do banco da Parte I3b for aplicada.';
export const TEXTO_DRIVE_NAO_CONFIGURADO = 'Drive não configurado: o agente lê só os arquivos enviados.';

export function avisoDoDrive(s: SituacaoDrive | null): { tom: 'success' | 'warning'; texto: string } {
  if (s?.erro) return { tom: 'warning', texto: `O Drive não está respondendo: ${s.erro}` };
  if (!s?.email) return { tom: 'warning', texto: TEXTO_DRIVE_NAO_CONFIGURADO };
  return { tom: 'success', texto: `Drive ligado, só leitura. Compartilhe a pasta de cada cliente com ${s.email}, como Leitor.` };
}

export const OPCOES_GUARDA: { valor: number | null; rotulo: string }[] = [
  { valor: null, rotulo: 'Nunca apagar' }, { valor: 90, rotulo: '90 dias' }, { valor: 180, rotulo: '180 dias' },
  { valor: 365, rotulo: '365 dias (sugerido)' }, { valor: 730, rotulo: '730 dias' },
];
export function textoGuarda(dias: number | null): string {
  return dias === null ? 'Os arquivos das tarefas ficam guardados até alguém apagar.'
    : `Os arquivos das tarefas são apagados ${dias} dias depois que a tarefa é aprovada ou descartada. O resultado, o CSV e a planilha continuam.`;
}
```

`apps/painel/src/lib/drive.ts`:

```ts
import 'server-only';
import { semMigracaoI1 } from '@/lib/agentes';
import type { supabaseServidor } from '@/lib/supabase/servidor';
import type { SituacaoDrive } from './drive-tela';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** D9/D17: a situação gravada pelo trabalhador; semI3b quando a tabela não existe. */
export async function lerSituacaoDrive(sb: Sb): Promise<{ semI3b: boolean; situacao: SituacaoDrive | null }> {
  const { data, error } = await sb.from('drive_conta').select('email, erro, verificado_em').maybeSingle();
  if (semMigracaoI1(error)) return { semI3b: true, situacao: null };
  if (error) console.error('[drive] situação', error);
  return { semI3b: false, situacao: data ? { email: data.email, erro: data.erro, verificadoEm: data.verificado_em } : null };
}
export async function lerPastaDoCliente(sb: Sb, clienteId: string): Promise<{ semI3b: boolean; pasta: string | null }> {
  const { data, error } = await sb.from('clientes').select('drive_pasta_id').eq('id', clienteId).maybeSingle();
  if (semMigracaoI1(error)) return { semI3b: true, pasta: null };
  if (error) console.error('[drive] pasta do cliente', error);
  return { semI3b: false, pasta: data?.drive_pasta_id ?? null };
}
export async function lerGuarda(sb: Sb): Promise<{ semI3b: boolean; dias: number | null }> {
  const { data, error } = await sb.from('tarefas_guarda').select('dias').maybeSingle();
  if (semMigracaoI1(error)) return { semI3b: true, dias: null };
  if (error) console.error('[guarda] leitura', error);
  return { semI3b: false, dias: data?.dias ?? null };
}
```

`apps/painel/src/app/(painel)/clientes/ficha/drive-acoes.ts`:

```ts
'use server';

import { pastaDoLink } from '@escritorio/core';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const LINK_INVALIDO = 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).';
const FALHA = 'Não consegui salvar a pasta agora. Tente de novo.';

/** D8: o bloco Arquivos salva sozinho. O link vira o código aqui; o banco confere de novo (permissão, formato, uma pasta por cliente). */
export async function salvarPastaDrive(clienteId: string, texto: string): Promise<{ ok: true; pasta: string | null } | { ok: false; erro: string }> {
  await obterUsuario();
  if (!z.string().uuid().safeParse(clienteId).success) return { ok: false, erro: 'Cliente não encontrado.' };
  const limpo = texto.trim();
  const pasta = limpo ? pastaDoLink(limpo) : null;
  if (limpo && !pasta) return { ok: false, erro: LINK_INVALIDO };
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('salvar_pasta_drive', { p_cliente: clienteId, p_pasta: pasta as string });
  if (error) {
    if (error.code === 'P0001') return { ok: false, erro: error.message };
    console.error('[ficha] pasta do Drive', error.code, error.message);
    return { ok: false, erro: FALHA };
  }
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true, pasta: (data as string | null) ?? null };
}
```

`apps/painel/src/app/(painel)/configuracoes/guarda-acoes.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const PRAZOS = new Set([90, 180, 365, 730]);
/** D14: só o dono (o banco confere). */
export async function salvarGuardaTarefas(dias: number | null): Promise<{ ok: true } | { ok: false; erro: string }> {
  await obterUsuario();
  if (dias !== null && !PRAZOS.has(dias)) return { ok: false, erro: 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.' };
  const { error } = await (await supabaseServidor()).rpc('salvar_guarda_tarefas', { p_dias: dias as number });
  if (error) {
    if (error.code === 'P0001') return { ok: false, erro: error.message };
    console.error('[guarda] salvar', error.code, error.message);
    return { ok: false, erro: 'Não consegui salvar agora. Tente de novo.' };
  }
  revalidatePath('/configuracoes');
  return { ok: true };
}
```

- [ ] **Step 4: O bloco "Arquivos" da ficha** — `apps/painel/src/app/(painel)/clientes/ficha/bloco-arquivos.tsx`:

```tsx
'use client';

import { linkDaPasta } from '@escritorio/core';
import { CircleAlert, CircleCheck, ExternalLink, FolderOpen, LockKeyhole } from 'lucide-react';
import { useState, useTransition } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { TEXTO_DRIVE_SEM_I3B, avisoDoDrive, type SituacaoDrive } from '@/lib/drive-tela';
import { salvarPastaDrive } from './drive-acoes';

/**
 * D8: "Pasta no Drive" salva sozinha, como Acessos de portais. O campo fica fora do formulário da ficha (form= de um formulário que não existe):
 * não entra no envio da ficha nem conta como "não salvo".
 */
export function BlocoArquivos({ clienteId, pasta, situacao, podeEditar, semI3b }: {
  clienteId: string | null; pasta: string | null; situacao: SituacaoDrive | null; podeEditar: boolean; semI3b: boolean;
}) {
  const [valor, setValor] = useState(pasta ? linkDaPasta(pasta) : '');
  const [salva, setSalva] = useState(pasta);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const aviso = avisoDoDrive(situacao);
  const salvar = () => iniciar(async () => {
    if (!clienteId) return;
    const r = await salvarPastaDrive(clienteId, valor);
    if (!r.ok) { setErro(r.erro); return; }
    setErro(null);
    setSalva(r.pasta);
    setValor(r.pasta ? linkDaPasta(r.pasta) : '');
    toast.success(r.pasta ? 'Pasta no Drive salva.' : 'Pasta no Drive removida.');
  });
  return (
    <section id="bloco-arquivos" aria-labelledby="titulo-arquivos" className="scroll-mt-4 rounded-lg border border-border bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="titulo-arquivos" tabIndex={-1} className="text-sm font-extrabold uppercase tracking-wide text-brand">Arquivos</h2>
        <Badge variant="neutral"><LockKeyhole aria-hidden size={12} />só leitura</Badge>
      </div>
      {semI3b || !clienteId ? (
        <p className="text-sm text-muted">{semI3b ? TEXTO_DRIVE_SEM_I3B : 'A pasta no Drive pode ser preenchida depois de salvar o cliente.'}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className={aviso.tom === 'success' ? 'flex items-start gap-2 text-sm text-success' : 'flex items-start gap-2 text-sm text-warning'}>
            {aviso.tom === 'success' ? <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0" /> : <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />}
            <span>{aviso.texto}</span>
          </p>
          <FormField id="ficha-pasta-drive" rotulo="Pasta no Drive" erro={erro ?? undefined}
            ajuda="Cole o link da pasta deste cliente no Google Drive. O agente só lê esta pasta e nunca altera nem apaga nada.">
            <Input form="sem-formulario-pasta-drive" value={valor} onChange={(e) => setValor(e.currentTarget.value)} disabled={!podeEditar || enviando}
              placeholder="https://drive.google.com/drive/folders/…" autoComplete="off" inputMode="url" />
          </FormField>
          <div className="flex flex-wrap items-center gap-2">
            {podeEditar && <Button type="button" size="sm" onClick={salvar} disabled={enviando}><FolderOpen aria-hidden size={16} />Salvar pasta</Button>}
            {salva && (
              <a href={linkDaPasta(salva)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-brand underline-offset-2 hover:underline">
                <ExternalLink aria-hidden size={14} />Abrir no Drive
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
```

(Confira `grep -n "export function FormField" -A6 apps/painel/src/components/patterns/form-field.tsx` para os nomes das props — `rotulo`, `erro`, `ajuda` — e `Badge` aceita `variant="neutral"`; se não, use a variante neutra que existir. O `Input` sem `name` e com `form` de um formulário que não existe não entra em `form.elements` da ficha.)

Em `ficha-cliente.tsx`, acrescente a `PropsFicha` `arquivos?: ReactNode;` (com o comentário "Bloco Arquivos (Parte I3b): salva sozinho, como os acessos.") e, dentro da coluna, logo depois do `div` com `BlocoCertificado` e `{acessos}`: `{arquivos}`. Em `dados-ficha.tsx`, leia em paralelo `lerPastaDoCliente(sb, c.id)` e `lerSituacaoDrive(sb)` (só com `c`) e passe:

```tsx
      arquivos={<BlocoArquivos key="arquivos" clienteId={c?.id ?? null} pasta={pastaDrive.pasta} situacao={drive.situacao}
        podeEditar={pode} semI3b={pastaDrive.semI3b || drive.semI3b} />}
```

- [ ] **Step 5: Configurações › Integrações** — `apps/painel/src/app/(painel)/configuracoes/secoes/guarda-tarefas.tsx` (client: `select` com `OPCOES_GUARDA`, valor "nunca" para `null`, botão SALVAR que chama `salvarGuardaTarefas`, `toast.success('Guarda dos arquivos salva.')`, erro em `role="alert"`; para quem não é dono, o `select` fica `disabled` com o selo `<LockKeyhole size={12} /> só o dono`; abaixo, `textoGuarda(dias)`). Em `integracoes.tsx`, a função passa a receber `{ sinal, drive, guarda, dono }` (`drive: { semI3b: boolean; situacao: SituacaoDrive | null }`, `guarda: { semI3b: boolean; dias: number | null }`) e acrescenta, depois dos dois `HealthSignal`:

```tsx
          {drive.semI3b ? <p className="text-sm text-muted">{TEXTO_DRIVE_SEM_I3B}</p> : (
            <div className="flex items-start gap-2 text-sm">
              {avisoDoDrive(drive.situacao).tom === 'success'
                ? <CircleCheck aria-hidden size={16} className="mt-0.5 shrink-0 text-success" />
                : <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0 text-warning" />}
              <span><b>Google Drive (só leitura).</b> {avisoDoDrive(drive.situacao).texto}</span>
            </div>
          )}
```

e, depois do `Cartao` de Integrações, um segundo `Cartao id="guarda-tarefas" titulo="Guarda dos arquivos das tarefas" descricao="Arquivos enviados às tarefas e copiados do Drive. Anexos das conversas seguem a regra das conversas (1 ano)."` com `<GuardaTarefas dias={guarda.dias} dono={dono} />` (ou `TEXTO_DRIVE_SEM_I3B` trocando "A pasta no Drive" por "A guarda dos arquivos" quando `guarda.semI3b` — use uma constante própria `TEXTO_GUARDA_SEM_I3B = 'A guarda dos arquivos das tarefas aparece quando a atualização do banco da Parte I3b for aplicada.'` em `drive-tela.ts`). Em `configuracoes/page.tsx`, leia `lerSituacaoDrive(sb)`, `lerGuarda(sb)` e `souDono(sb)` só quando `admin` e passe a `SecaoIntegracoes`.

- [ ] **Step 6: Rode**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: PASS; os testes antigos da ficha (`ficha.test.ts`, `acoes.test.ts`, `dados-ficha.test.ts`) e de Configurações sem mudança; `escala.test.ts` e `tokens.test.ts` verdes.

- [ ] **Step 7: Commit**

```bash
git add apps/painel/src/lib/drive-tela.ts apps/painel/src/lib/drive-tela.test.ts apps/painel/src/lib/drive.ts "apps/painel/src/app/(painel)/clientes/ficha" "apps/painel/src/app/(painel)/configuracoes"
git commit -m "feat(painel): Pasta no Drive na ficha do cliente, situação do Drive e guarda dos arquivos das tarefas (I3b, D8, D9, D14)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Painel. A tarefa com o Drive (fontes, LER A PASTA DE NOVO), a planilha XLSX e o aviso de linhas provisórias

**Files:**
- Create: `apps/painel/src/lib/planilha-tarefa.ts`, `apps/painel/src/lib/planilha-tarefa.test.ts`, `apps/painel/src/lib/tarefas-drive.test.ts`, `apps/painel/src/app/api/tarefas/planilha/route.ts`, `apps/painel/src/app/(painel)/tarefas/[id]/ler-pasta.tsx`
- Modify: `apps/painel/src/lib/tarefas-tela.ts`, `apps/painel/src/lib/tarefas.ts`, `apps/painel/src/lib/tarefas-acoes.ts`, `apps/painel/src/lib/fila.ts`, `apps/painel/src/app/api/tarefas/csv/route.ts`, `apps/painel/src/app/api/tarefas/arquivo/route.ts`, `apps/painel/src/app/(painel)/tarefas/[id]/{fontes-tarefa,resultado-tarefa,aprovacao-tarefa,pendencia-analista,page}.tsx`, `apps/painel/package.json` (+ `pnpm-lock.yaml`)

**Interfaces:**
- Consumes: Tasks 3, 4, 12 (`abasDoResultado`, `partesDaPlanilha`, `MIME_XLSX`, `contarProvisorias`, `pedir_leitura_da_pasta`, `lerSituacaoDrive`, `lerPastaDoCliente`, `avisoDoDrive`), `fflate` (`zipSync`, `strToU8`), `registrarAuditoria`, `lerTarefa`.
- Produces (Task 15):
  - `ArquivoTela.origem: 'enviado' | 'conversa' | 'drive'`, `ArquivoTela.removido?: boolean`; `TarefaTela.drive?: { pasta: string | null; situacao: SituacaoDrive | null } | null` (null = sem I3b);
  - `nomeDaPlanilha(t: Pick<TarefaTela, 'numero' | 'estado'>): string` (`tarefa-<n>-rascunho.xlsx` / `-aprovada.xlsx`), `textoProvisorias(n: number): string | null`, `ROTULO_ORIGEM: Record<ArquivoTela['origem'], string>`;
  - `planilhaDaTarefa(t: Pick<TarefaTela, 'resultado' | 'pendencias'>): Uint8Array | null`;
  - `lerPastaDeNovo(tarefaId: string): Promise<ResultadoTarefaAcao>` (`lib/tarefas-acoes.ts`); `enfileirarLeituraPasta(tarefaId: string)` (`lib/fila.ts`);
  - rota `GET /api/tarefas/planilha?id=<uuid>` (auditoria `download`, `planilha_tarefa`); textos: "Baixar planilha", "Ler a pasta de novo", "Drive · só leitura", "Apagado pela guarda".

- [ ] **Step 1: A dependência só de teste** — em `apps/painel`: `pnpm add -D exceljs@4.4.0 --save-exact` (confira que `package.json` ficou com `"exceljs": "4.4.0"` em `devDependencies` e que nada de produção mudou).

- [ ] **Step 2: Escreva os testes que falham** — `apps/painel/src/lib/planilha-tarefa.test.ts`:

```ts
import ExcelJS from 'exceljs';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { ResultadoTarefa } from '@escritorio/core';
import { planilhaDaTarefa } from './planilha-tarefa';

const R: ResultadoTarefa = {
  versao: 1, resumo: 'Prévia de outubro', observacoes: 'Sem extrato do BB.',
  destaques: [{ rotulo: 'Saídas', valor: 'R$ 1.980,55', detalhe: null }],
  linhas: [
    { descricao: 'DAS Simples Nacional', valor: -1980.55, texto: null, fonte: 'extrato.csv', provisoria: false },
    { descricao: '=SOMA(A1:A9)', valor: null, texto: '@x', fonte: 'pendência 1', provisoria: true },
  ],
};
const P = [{ id: 'p', numero: 1, tipo: 'cliente' as const, pergunta: 'Extrato do BB', estado: 'aberta' as const, resposta: null }] as never;

describe('planilhaDaTarefa (D10)', () => {
  it('é um XLSX que um leitor de terceiros abre, com número como número e texto como texto', async () => {
    const bytes = planilhaDaTarefa({ resultado: R, pendencias: P })!;
    expect(Object.keys(unzipSync(bytes))).toContain('xl/worksheets/sheet1.xml');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Resultado', 'Destaques', 'Pendências']);
    const res = wb.getWorksheet('Resultado')!;
    expect(res.getCell('A1').text).toBe('Descrição');
    expect(res.getCell('B2').value).toBe(-1980.55);
    expect(res.getCell('B2').numFmt).toBe('#,##0.00');
    expect(res.getCell('A3').text).toBe('=SOMA(A1:A9)');
    expect(res.getCell('A3').formula).toBeUndefined();
    expect(res.getCell('E3').text).toBe('sim');
    expect(wb.getWorksheet('Pendências')!.getCell('C2').text).toBe('Extrato do BB');
  });
  it('mesmo resultado, mesmos bytes; sem resultado, nada', () => {
    expect(planilhaDaTarefa({ resultado: R, pendencias: P })).toEqual(planilhaDaTarefa({ resultado: R, pendencias: P }));
    expect(planilhaDaTarefa({ resultado: null, pendencias: [] })).toBeNull();
  });
});
```

`apps/painel/src/lib/tarefas-drive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ROTULO_ORIGEM, nomeDaPlanilha, textoProvisorias } from './tarefas-tela';

describe('tarefa na I3b', () => {
  it('nome da planilha diz se é rascunho', () => {
    expect(nomeDaPlanilha({ numero: 7, estado: 'pronta' })).toBe('tarefa-7-rascunho.xlsx');
    expect(nomeDaPlanilha({ numero: 7, estado: 'aprovada' })).toBe('tarefa-7-aprovada.xlsx');
  });
  it('aviso de linhas provisórias só quando há', () => {
    expect(textoProvisorias(0)).toBeNull();
    expect(textoProvisorias(1)).toBe('1 linha provisória: confira antes de aprovar ou peça ajuste.');
    expect(textoProvisorias(3)).toBe('3 linhas provisórias: confira antes de aprovar ou peça ajuste.');
  });
  it('a origem do arquivo na tela', () => {
    expect(ROTULO_ORIGEM).toEqual({ enviado: 'Enviado', conversa: 'Da conversa', drive: 'Drive · só leitura' });
  });
});
```

- [ ] **Step 3: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/planilha-tarefa.test.ts src/lib/tarefas-drive.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implemente** — `apps/painel/src/lib/planilha-tarefa.ts`:

```ts
import { abasDoResultado, partesDaPlanilha } from '@escritorio/core';
import { strToU8, zipSync } from 'fflate';
import type { TarefaTela } from './tarefas-tela';

// Data fixa nas entradas do zip: o mesmo resultado dá os mesmos bytes (D10).
const DATA_FIXA = new Date('2026-01-01T00:00:00Z');
/** D10: a planilha do resultado, montada na hora do download (nada guardado; vem do mesmo `resultado` do CSV). */
export function planilhaDaTarefa(t: Pick<TarefaTela, 'resultado' | 'pendencias'>): Uint8Array | null {
  if (!t.resultado) return null;
  const pend = t.pendencias.map((p) => ({ numero: p.numero, tipo: p.tipo, pergunta: p.pergunta, estado: p.estado, resposta: p.resposta }));
  const partes = partesDaPlanilha(abasDoResultado(t.resultado, pend));
  return zipSync(Object.fromEntries(Object.entries(partes).map(([k, v]) => [k, strToU8(v)])), { level: 6, mtime: DATA_FIXA });
}
```

Em `lib/tarefas-tela.ts`: `ArquivoTela` passa a `{ id; nome; tamanho; origem: 'enviado' | 'conversa' | 'drive'; lido; detalhe; removido?: boolean }`; `TarefaTela` ganha `/** I3b: null = banco sem a I3b. */ drive?: { pasta: string | null; situacao: SituacaoDrive | null } | null;`; e:

```ts
export const nomeDaPlanilha = (t: Pick<TarefaTela, 'numero' | 'estado'>): string => `tarefa-${t.numero}-${t.estado === 'aprovada' ? 'aprovada' : 'rascunho'}.xlsx`;
/** D15b: a Aprovação avisa; quem decide é a pessoa. */
export const textoProvisorias = (n: number): string | null =>
  (n <= 0 ? null : `${n} linha${n > 1 ? 's provisórias' : ' provisória'}: confira antes de aprovar ou peça ajuste.`);
export const ROTULO_ORIGEM: Record<ArquivoTela['origem'], string> = { enviado: 'Enviado', conversa: 'Da conversa', drive: 'Drive · só leitura' };
```

Em `lib/tarefas.ts` (`lerTarefa`): a leitura dos arquivos pede `id, nome, tamanho, origem, lido_em, detalhe, removido_em`; se `semMigracaoI1(arq.error)`, refaz sem `removido_em` (banco sem a I3b). Depois de montar a tarefa, quando `t.clientes?.id`, leia em paralelo `lerPastaDoCliente(sb, clienteId)` e `lerSituacaoDrive(sb)` e ponha `drive: semI3b ? null : { pasta, situacao }` (sem cliente: `drive: { pasta: null, situacao }`). `removido: a.removido_em != null`.

Em `lib/fila.ts`, acrescente no `obterBoss` `await b.createQueue('pasta_drive', { name: 'pasta_drive', policy: 'stately', retryLimit: 1, retryDelay: 30 });` (comentário "Mesma configuração do trabalhador (FILAS.pastaDrive)") e:

```ts
/** Parte I3b (D7): LER A PASTA DE NOVO; a chave única impede duas leituras da mesma tarefa ao mesmo tempo. */
export async function enfileirarLeituraPasta(tarefaId: string): Promise<void> {
  await (await obterBoss()).send('pasta_drive', { tarefaId }, { singletonKey: tarefaId });
}
```

Em `lib/tarefas-acoes.ts`, com os ajudantes que o arquivo já tem (`chamar`, `NAO_ACHEI`, `Uuid`; importe `enfileirarLeituraPasta` de `@/lib/fila`):

```ts
/** D7: a pessoa pede; o banco confere setor, pasta e intervalo; o trabalhador lê a pasta em seguida. */
export async function lerPastaDeNovo(id: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(id).success) return NAO_ACHEI;
  const r = await chamar<boolean>('pedir_leitura_da_pasta', { p_tarefa: id });
  if (!r.ok) return r;
  try {
    await enfileirarLeituraPasta(id);
  } catch (e) {
    // O evento já está na linha do tempo; sem a fila, a pessoa pede de novo em 2 minutos.
    console.error('[tarefas] leitura da pasta não enfileirada', id, e);
    return { ok: false, erro: 'Não consegui pedir a leitura agora. Tente de novo em 2 minutos.' };
  }
  revalidatePath(`/tarefas/${id}`);
  return { ok: true };
}
```

`apps/painel/src/app/api/tarefas/planilha/route.ts`:

```ts
import { MIME_XLSX } from '@escritorio/core';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { registrarAuditoria } from '@/lib/auditoria';
import { planilhaDaTarefa } from '@/lib/planilha-tarefa';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerTarefa } from '@/lib/tarefas';
import { nomeDaPlanilha } from '@/lib/tarefas-tela';

/** D10: a planilha do resultado (rascunho até aprovar). Quem vê a demanda baixa; fica na auditoria. Funciona sem a migração da I3b. */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!z.string().uuid().safeParse(id).success) return new NextResponse('Resultado não encontrado ou sem acesso.', { status: 404 });
  const { tarefa } = await lerTarefa(await supabaseServidor(), id);
  const bytes = tarefa ? planilhaDaTarefa(tarefa) : null;
  if (!tarefa || !bytes) return new NextResponse('Resultado não encontrado ou sem acesso.', { status: 404 });
  await registrarAuditoria(u.id, 'download', 'planilha_tarefa', id);
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'Content-Type': MIME_XLSX, 'Content-Disposition': `attachment; filename="${nomeDaPlanilha(tarefa)}"` },
  });
}
```

Em `api/tarefas/csv/route.ts`, acrescente a mesma validação de `uuid` antes de `lerTarefa` (D15e). Em `api/tarefas/arquivo/route.ts`: a leitura da linha pede também `removido_em` (com o mesmo refazer-sem-a-coluna quando `semMigracaoI1`); `removido_em` preenchido → `new NextResponse('O arquivo foi apagado pela guarda dos arquivos das tarefas.', { status: 410 })`, sem assinar link.

Telas (`tarefas/[id]`):
- `ler-pasta.tsx` (client): botão `variant="outline" size="sm"` "Ler a pasta de novo" (ícone `FolderSync` 16) que chama `lerPastaDeNovo`; sucesso → `toast.success('Pedi para ler a pasta do Drive. Os arquivos novos aparecem aqui em instantes.')` e `router.refresh()` depois de 5 s; erro → `toast.error(r.erro)`.
- `fontes-tarefa.tsx`: cada arquivo mostra o rótulo `ROTULO_ORIGEM[a.origem]`; os do Drive com o selo `<Badge variant="neutral"><LockKeyhole size={12} />Drive · só leitura</Badge>`; `removido` → texto "Apagado pela guarda" (com ícone `Archive` 14) e sem link de download. No cabeçalho do bloco, ao lado de ENVIAR ARQUIVO, quando a tarefa é ativa e a pessoa pode mexer: com `tarefa.drive?.pasta` e `avisoDoDrive(situacao).tom === 'success'` → `<LerPasta />`; com pasta e Drive com problema → o texto do aviso (`warning`, com ícone); sem pasta → "Sem pasta no Drive: preencha na ficha do cliente, em Arquivos." com link para `/clientes/<id>#bloco-arquivos`; `tarefa.drive === null` (sem I3b) → nada.
- `resultado-tarefa.tsx`: ao lado de "Baixar CSV", `<a href={`/api/tarefas/planilha?id=${t.id}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}><Download aria-hidden size={16} /> Baixar planilha</a>`.
- `aprovacao-tarefa.tsx`: com `textoProvisorias(contarProvisorias(t.resultado))`, um aviso `warning` com ícone `TriangleAlert` 16 acima de APROVAR E CONCLUIR (o botão continua como está; a trava é a das pendências).
- `pendencia-analista.tsx` (D15d): o contêiner das respostas rápidas usa `flex flex-wrap gap-2` e cada botão `whitespace-nowrap` (quebra de linha sem empilhar em 1366).

- [ ] **Step 5: Rode**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: PASS; `tarefas-tela.test.ts`, `tarefas-acoes.test.ts`, `fila-tarefas.test.ts` (I3a) sem mudança.

- [ ] **Step 6: Commit**

```bash
git add apps/painel/package.json pnpm-lock.yaml apps/painel/src/lib apps/painel/src/app/api/tarefas "apps/painel/src/app/(painel)/tarefas"
git commit -m "feat(painel): tarefa com fontes do Drive, LER A PASTA DE NOVO, planilha XLSX e aviso de linhas provisórias (I3b, D7, D10, D15)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Painel. Testar e ▷ dos agentes dos setores, e "N tarefas aguardando aprovação · REVISAR"

**Files:**
- Create: `apps/painel/src/lib/testar-setor.ts`, `apps/painel/src/lib/testar-setor.test.ts`
- Modify: `apps/painel/src/app/(painel)/agentes/[slug]/textos.ts`, `agentes/[slug]/testar/page.tsx`, `agentes/[slug]/cabecalho-agente.tsx`, `agentes/[slug]/skills/lista-skills.tsx`, `agentes/[slug]/skills/page.tsx`, `agentes/cartao-agente.tsx`, `agentes/page.tsx`, `apps/painel/src/lib/agentes.ts`, `apps/painel/src/app/(painel)/treinar-agente/{simulacao.ts,acoes.ts,simulador.tsx,tela-orientacoes.tsx}`, `apps/painel/e2e/agente-orientacoes.spec.ts` (só a linha 34, D13)

**Interfaces:**
- Consumes: `criar_simulacao_agente` (Task 5), `MODOS_CONTATO`, `INFO_MODO` (core), `Agente` (`lib/agentes.ts`: `portaDeEntrada`, `tipos`, `modoContato`, `setorId`), `souDono`, `pode_treinar_agente` (via `podeTreinarAgente` do painel).
- Produces (Task 15):
  - `comoTestar(a: Pick<Agente, 'portaDeEntrada' | 'tipos'>, i3b: boolean): 'thiago' | 'setor' | 'trabalho' | 'sem_i3b'`;
  - `textos.ts`: `TEXTO_TESTE_TRABALHO = 'Agente de trabalho: para testar, deixe-o em Teste e peça uma tarefa numa demanda de teste (em Teste, só o dono e o administrador pedem).'`, `TEXTO_TESTE_SEM_I3B = 'O teste deste agente no painel aparece quando a atualização do banco da Parte I3b for aplicada.'`, `TEXTO_TESTE_SETOR = 'Escreva como cliente e veja o que o agente responderia no modo escolhido. Nada é enviado nem gravado; o custo conta em Gastos com IA como "Testar o agente", neste agente.'`; **`TEXTO_TESTE_AGENTE_SETOR` sai**;
  - `PedidoTeste` aceita `agente?: string | null` (endereço) e `modo?: ModoContato | null`;
  - `Simulador` aceita `agente?: { slug: string; modoPadrao: ModoContato } | null`;
  - `parteI3bAplicada(sb): Promise<boolean>`, `lerTarefasProntas(sb): Promise<Map<string, { n: number; maisAntiga: string }> | null>` (`lib/agentes.ts`).

- [ ] **Step 1: Escreva o teste que falha** — `apps/painel/src/lib/testar-setor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PedidoTeste } from '../app/(painel)/treinar-agente/simulacao';
import { comoTestar } from './testar-setor';

describe('comoTestar (D11)', () => {
  it('Thiago, setor com Conversa, só Trabalho, banco sem a I3b', () => {
    expect(comoTestar({ portaDeEntrada: true, tipos: ['conversa'] }, false)).toBe('thiago');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['conversa'] }, true)).toBe('setor');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['conversa', 'trabalho'] }, true)).toBe('setor');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['trabalho'] }, true)).toBe('trabalho');
    expect(comoTestar({ portaDeEntrada: false, tipos: ['conversa'] }, false)).toBe('sem_i3b');
  });
});

describe('PedidoTeste com agente e modo', () => {
  it('aceita o endereço do agente e um dos três modos; recusa o resto', () => {
    expect(PedidoTeste.safeParse({ mensagem: 'Oi', clienteId: null, rascunho: null, agente: 'fiscal', modo: 'por_tras' }).success).toBe(true);
    expect(PedidoTeste.safeParse({ mensagem: 'Oi', clienteId: null, rascunho: null, agente: 'Fiscal!', modo: null }).success).toBe(false);
    expect(PedidoTeste.safeParse({ mensagem: 'Oi', clienteId: null, rascunho: null, agente: 'fiscal', modo: 'gritando' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Rode e veja falhar**

Run: `pnpm --filter @escritorio/painel exec vitest run src/lib/testar-setor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implemente**

`apps/painel/src/lib/testar-setor.ts`:

```ts
/** Parte I3b (D11): como cada agente é testado no painel. */
export type ComoTestar = 'thiago' | 'setor' | 'trabalho' | 'sem_i3b';
export function comoTestar(a: { portaDeEntrada: boolean; tipos: readonly string[] }, i3b: boolean): ComoTestar {
  if (a.portaDeEntrada) return 'thiago';
  if (!a.tipos.includes('conversa')) return 'trabalho';
  return i3b ? 'setor' : 'sem_i3b';
}
```

Em `treinar-agente/simulacao.ts`, `PedidoTeste` ganha (sem mudar os campos de antes):

```ts
  agente: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/, 'Agente não encontrado.').nullish(),
  modo: z.enum(MODOS_CONTATO).nullish(),
```

Em `treinar-agente/acoes.ts` (`testarAgente`), troque a escolha da RPC por:

```ts
    const { mensagem, clienteId, rascunho, skillId, agente, modo } = pedido.data;
    // I3b (D11, D12): agente de setor tem a função própria; o Thiago segue com as de sempre.
    const { data: id, error } = agente && agente !== SLUG_ATENDIMENTO
      ? await sb.rpc('criar_simulacao_agente', { p_slug: agente, p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined,
          p_rascunho: rascunho ?? undefined, p_skill: skillId ?? undefined, p_modo: modo ?? undefined })
      : skillId
        ? await sb.rpc('criar_simulacao_skill', { p_skill: skillId, p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined })
        : await sb.rpc('criar_simulacao', { p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined, p_rascunho: rascunho ?? undefined });
```

`sessaoTreinar()` exige hoje "treinar" ou dono; mantenha. Em `simulador.tsx`: prop nova `agente?: { slug: string; modoPadrao: ModoContato } | null`; quando presente, acima do campo da mensagem, um `select` "Modo de falar com o cliente" com as três opções de `INFO_MODO` (rótulo; a do modo padrão com " (padrão)"), começando no padrão; o `enviar` passa `agente: agente.slug, modo`. Sem a prop, nada muda (o Thiago e a tela Treinar o agente).

Em `textos.ts`: tire `TEXTO_TESTE_AGENTE_SETOR` e acrescente as três constantes da seção Interfaces. Confira com `grep -rn "TEXTO_TESTE_AGENTE_SETOR" apps/painel/src` que sobraram só os três usos a trocar:
- `testar/page.tsx`: leia `parteI3bAplicada(sb)`; `const modoTeste = comoTestar(agente, i3b)`; `'trabalho'` → `<EmptyState icone={FlaskConical} titulo={TEXTO_TESTE_TRABALHO} />`; `'sem_i3b'` → `<EmptyState … titulo={TEXTO_TESTE_SEM_I3B} />`; `'setor'` → a permissão é `dono || podeTreinarAgente(u, agente)` (senão `<SemPermissao />`), o texto do lado esquerdo é `TEXTO_TESTE_SETOR`, o seletor de skill do dono (`TestarSkill`) vale igual, e o `Simulador` recebe `agente={{ slug: agente.slug, modoPadrao: agente.modoContato ?? 'por_tras' }}`; `'thiago'` → como hoje.
- `cabecalho-agente.tsx`: o "Testar agora" vira link para `/agentes/<slug>/testar` também quando `comoTestar(a, true) === 'setor'`; para Trabalho, o botão desligado usa `title={TEXTO_TESTE_TRABALHO}`. (O cabeçalho não sabe da I3b; a própria aba mostra a faixa.)
- `treinar-agente/tela-orientacoes.tsx`: `comSimulador` passa a valer também para agente de setor com Conversa (prop nova `agenteSetor?: { slug: string; modoPadrao: ModoContato } | null`, que a página da aba Orientações passa quando `comoTestar(...) === 'setor'`); o `Simulador` recebe `agente={agenteSetor}`; o lado direito sem simulador mostra `TEXTO_TESTE_TRABALHO` (só Trabalho) ou `TEXTO_TESTE_SEM_I3B`. Ache a página que monta `TelaOrientacoes` para o agente (`grep -rn "TelaOrientacoes" apps/painel/src/app`) e passe a prop.

Em `skills/lista-skills.tsx`, a condição do ▷ passa de `porta && dono` para `testavel && dono`, com a prop `testavel: boolean` no lugar de `porta` (a página `skills/page.tsx` passa `testavel={comoTestar(agente, i3b) === 'thiago' || comoTestar(agente, i3b) === 'setor'}`; confira com grep se `porta` é usado para mais alguma coisa no componente e mantenha esse uso).

Em `lib/agentes.ts`:

```ts
/** Parte I3b (D17): o banco já tem a I3b? Só a tabela ausente diz "não". Cache por requisição, como a I3a. */
const i3bDaRequisicao = cache(() => ({ p: null as Promise<boolean> | null }));
export function parteI3bAplicada(sb: Sb): Promise<boolean> {
  const memo = i3bDaRequisicao();
  return (memo.p ??= Promise.resolve(sb.from('tarefas_guarda').select('id').limit(1).then(({ error }) => !semMigracaoI1(error))));
}
/** D16 (7E.2): tarefas prontas para aprovar que a pessoa vê (RLS), por agente; a mais antiga para o REVISAR. null = sem a I3a. */
export async function lerTarefasProntas(sb: Sb): Promise<Map<string, { n: number; maisAntiga: string }> | null> {
  const { data, error } = await sb.from('agente_tarefas').select('id, agente_id, criado_em').eq('estado', 'pronta').order('criado_em').limit(500);
  if (semMigracaoI1(error)) return null;
  if (error) { console.error('[agentes] tarefas prontas', error); return null; }
  const m = new Map<string, { n: number; maisAntiga: string }>();
  for (const t of data ?? []) {
    const x = m.get(t.agente_id);
    m.set(t.agente_id, x ? { n: x.n + 1, maisAntiga: x.maisAntiga } : { n: 1, maisAntiga: t.id });
  }
  return m;
}
```

Em `agentes/page.tsx`, leia `lerTarefasProntas(sb)` junto das contagens e passe a cada `CartaoAgente` `prontas={m?.get(a.id) ?? null}`. Em `cartao-agente.tsx`, prop `prontas?: { n: number; maisAntiga: string } | null`; quando `n > 0`, na área de avisos do cartão:

```tsx
        {prontas && prontas.n > 0 && (
          <p className="flex items-center gap-2 text-sm text-warning">
            <ListChecks aria-hidden size={16} />
            <span>{prontas.n === 1 ? '1 tarefa aguardando aprovação' : `${prontas.n} tarefas aguardando aprovação`}</span>
            <Link href={`/tarefas/${prontas.maisAntiga}`} className="font-bold uppercase text-brand hover:underline">Revisar</Link>
          </p>
        )}
```

(D13) Em `apps/painel/e2e/agente-orientacoes.spec.ts`, troque **só a linha 34** por:

```ts
  await expect(page.getByRole('button', { name: 'Testar', exact: true })).toBeVisible();
```

(confira com `grep -n "name: 'Testar'" apps/painel/e2e/testar-agente.spec.ts` que é esse o nome do botão do simulador; se for outro, use o mesmo que o `testar-agente.spec.ts` usa). `git diff BASE -- apps/painel/e2e/agente-orientacoes.spec.ts` deve mostrar exatamente 1 linha trocada.

- [ ] **Step 4: Rode**

Run: `pnpm --filter @escritorio/painel test && pnpm --filter @escritorio/painel typecheck`
Expected: PASS; `simulacao.test.ts`, `acoes.test.ts` (treinar), `faixas.test.ts`, `agentes.test.ts` sem mudança; `grep -rn "TEXTO_TESTE_AGENTE_SETOR\|chega com as tarefas de trabalho" apps/painel/src` vazio (a recusa de PDF das skills fala em "PDF chega com as tarefas de trabalho" e **fica**: confira que o grep acima só pega o texto antigo do teste — o da recusa de PDF é outro e está na lista "Ficam como estão").

- [ ] **Step 5: Commit**

```bash
git add apps/painel/src/lib/testar-setor.ts apps/painel/src/lib/testar-setor.test.ts apps/painel/src/lib/agentes.ts "apps/painel/src/app/(painel)/agentes" \
  "apps/painel/src/app/(painel)/treinar-agente" apps/painel/e2e/agente-orientacoes.spec.ts
git commit -m "feat(painel): Testar e ▷ dos agentes dos setores e tarefas aguardando aprovação no cartão (I3b, D11, D13, D16)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: E2e (Drive, planilha, guarda, Testar dos setores)

**Files:**
- Create: `apps/painel/e2e/apoio-drive.ts`, `apps/painel/e2e/drive-planilha.spec.ts`, `apps/painel/e2e/testar-agente-setor.spec.ts`

**Interfaces:**
- Consumes: `criarUsuarioTeste`, `entrar`, `limparBanco`, `criarTarefaTeste`, `definirPastaDriveTeste`, `situacaoDriveTeste`, `sqlTeste`, `cenarioTarefa`/`RESULTADO` (`e2e/apoio-tarefas.ts`), `criarDono`, `abrirAgente`, `skillNoBanco` (`e2e/apoio-agentes.ts`), `abrirSecao` (`e2e/apoio-configuracoes.ts`), `@axe-core/playwright`, `exceljs` (dev).
- Produces: 2 arquivos de e2e novos (≈ 9 testes).

- [ ] **Step 1: Os ajudantes** — `apps/painel/e2e/apoio-drive.ts`: `PASTA_E2E = '1PastaE2ePadariaSolAbcdefgh'`; `async function arquivoDoDrive(tarefaId: string, nome: string)` que grava no compartimento (`criarClienteServico(...).storage.from('tarefas').upload(`${tarefaId}/drive/1ArqE2e-${Date.now()}.pdf`, …)`) e insere a linha com `origem = 'drive'`, `drive_id = '1ArqE2eAbcdefghijklm'` por `sqlTeste` (devolve o id); reaproveite o padrão de `anexarArquivoTeste`.

- [ ] **Step 2: `drive-planilha.spec.ts`** — com `limparBanco` no `beforeEach` e os ajudantes de `apoio-tarefas.ts`:
  1. **ficha — Pasta no Drive (D8, D9):** Cláudia (clientes "editar") abre a ficha da Padaria → bloco "Arquivos" mostra "Drive não configurado: o agente lê só os arquivos enviados."; cola `https://drive.google.com/drive/u/0/folders/${PASTA_E2E}?usp=sharing` → "Salvar pasta" → toast "Pasta no Drive salva." e `select drive_pasta_id` = `PASTA_E2E`; o rodapé da ficha **não** mostra "não salvo" depois de digitar no campo; outro cliente com o mesmo link → "Esta pasta do Drive já é de outro cliente."; `situacaoDriveTeste('drive@escritorio.iam.gserviceaccount.com')` + recarregar → "Compartilhe a pasta de cada cliente com drive@escritorio.iam.gserviceaccount.com, como Leitor."; pessoa só com "ver" clientes → campo desligado e sem "Salvar pasta".
  2. **tarefa — fontes do Drive e LER A PASTA DE NOVO (D7):** tarefa trabalhando da Padaria com pasta e situação ok + um arquivo do Drive → a linha mostra "Drive · só leitura"; "Ler a pasta de novo" → toast "Pedi para ler a pasta do Drive…" e `agente_tarefa_eventos` tem "pediu para ler a pasta do Drive de novo"; clicar de novo → toast de erro "A pasta já está sendo lida. Espere um pouco."; sem pasta → "Sem pasta no Drive: preencha na ficha do cliente, em Arquivos."; axe sem violações na página.
  3. **planilha (D10):** tarefa `pronta` com `RESULTADO` → "Baixar planilha" → `download.suggestedFilename()` = `tarefa-<n>-rascunho.xlsx`; o arquivo abre com `exceljs` (`wb.xlsx.readFile(await download.path())`) e a aba "Resultado" tem o cabeçalho "Descrição"; `auditoria_acessos` tem `planilha_tarefa`; "Baixar CSV" continua.
  4. **provisórias (D15b):** tarefa pronta com uma linha `provisoria: true` → Aprovação mostra "1 linha provisória: confira antes de aprovar ou peça ajuste.".
  5. **guarda (D14):** dono em Configurações › Integrações → "Guarda dos arquivos das tarefas" em "Nunca apagar"; escolhe "365 dias (sugerido)" → salvar → toast e `tarefas_guarda.dias = 365`; administrador que não é dono vê o seletor desligado com "só o dono".

- [ ] **Step 3: `testar-agente-setor.spec.ts`**:
  1. **Fiscal (Conversa):** Ana (Fiscal, treinar) abre `/agentes/fiscal/testar` → texto `TEXTO_TESTE_SETOR`, seletor "Modo de falar com o cliente" no padrão do Fiscal; escolhe "Por trás", escreve "Saiu a nota do pedido 4512?" → Testar → a linha em `simulacoes_agente` tem `agente_id` do Fiscal, `modo = 'por_tras'`, `status = 'pendente'` (nos e2e não há trabalhador: confira só a criação e o "aguardando" na tela, como o `testar-agente.spec.ts` faz).
  2. **Paula (Pessoal, treinar)** abre `/agentes/fiscal/testar` → "Você não tem acesso a esta tela." (ou o `SemPermissao` que a tela usa).
  3. **Contábil (só Trabalho):** `/agentes/contabil/testar` → `TEXTO_TESTE_TRABALHO`; o "Testar agora" do cabeçalho fica desligado.
  4. **▷ da skill do Fiscal (dono):** `skillNoBanco('fiscal', { nome: 'tabela-cfop', tipo: 'conhecimento', titulo: 'Tabela CFOP', corpo: 'x', ativo: false })` → em Skills, "Testar Tabela CFOP" leva a `testar?skill=<id>` → "Testando com a skill Tabela CFOP (desligada)."; Testar → `simulacoes_agente.skill_id` e `agente_id` do Fiscal.
  5. **Orientações do Fiscal:** o simulador aparece ao lado do editor (o mesmo botão Testar).
  6. **Cartão (D16):** uma tarefa `pronta` do Contábil → em `/agentes`, o cartão do Contábil mostra "1 tarefa aguardando aprovação" e "Revisar" leva a `/tarefas/<id>`.
  7. axe sem violações em `/agentes/fiscal/testar`.

- [ ] **Step 4: Rode em lotes de até 2** (Supabase local 563xx; `supabase db reset` antes; memória ≥ 4 GB antes de cada lote — Restrições globais; `--workers=1`):

```bash
cd apps/painel
pnpm exec playwright test e2e/drive-planilha.spec.ts e2e/testar-agente-setor.spec.ts --workers=1
pnpm exec playwright test e2e/agente-orientacoes.spec.ts e2e/testar-agente.spec.ts --workers=1
pnpm exec playwright test e2e/treinar-simulador.spec.ts e2e/agente-skills.spec.ts --workers=1
pnpm exec playwright test e2e/tarefa-agente.spec.ts e2e/tarefa-demanda.spec.ts --workers=1
pnpm exec playwright test e2e/ficha-dados.spec.ts e2e/configuracoes-secoes.spec.ts --workers=1
pnpm exec playwright test e2e/agentes-lista.spec.ts e2e/agente-ficha.spec.ts --workers=1
```

Expected: todos passam. Falha de **asserção** num e2e antigo = mudança de comportamento → **pare**. "Target crashed"/processo morto → **pare** (Restrições globais).

- [ ] **Step 5: Devolva `config.toml` e `.env`; commit**

```bash
git add apps/painel/e2e/apoio-drive.ts apps/painel/e2e/drive-planilha.spec.ts apps/painel/e2e/testar-agente-setor.spec.ts
git commit -m "test(e2e): pasta no Drive, planilha, guarda e Testar dos agentes dos setores (I3b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Manuais

**Files:**
- Modify: `docs/operacao.md`, `docs/design-system.md`

- [ ] **Step 1: `docs/operacao.md` — seção "Google Drive, planilha e Testar dos agentes dos setores (Parte I3b)"**, depois da seção da I3a, com:
  - **ligar o Drive (passo a passo para o dono):** criar um projeto no Google Cloud; ligar a "Google Drive API"; criar uma **conta de serviço** (sem papéis no projeto); criar uma **chave JSON**; pôr o conteúdo (inteiro ou em base64: `base64 -w0 chave.json`) em `GOOGLE_DRIVE_CONTA_SERVICO` no ambiente do **trabalhador** (nunca no painel); reiniciar o trabalhador; em Configurações › Integrações aparece "Google Drive (só leitura)" com o e-mail da conta; **compartilhar a pasta de cada cliente com esse e-mail como Leitor** (nunca Editor); na ficha do cliente, bloco **Arquivos**, colar o link da pasta;
  - o que o agente lê (D6: tipos, 10 MB, Docs/Slides em PDF, Sheets em CSV só a 1ª aba, 3 níveis, 300 itens, 30 por tarefa, o que fica de fora e por quê), quando lê (D7), as quatro barreiras da D5 e o que **nunca** faz (gravar, mover, compartilhar, apagar); a pasta de outro cliente dentro da pasta deste fica de fora; atalhos não são seguidos;
  - **LGPD (D19):** "Os documentos lidos da pasta do cliente vão para a IA da Anthropic, como as mensagens das conversas, só para a tarefa pedida. Registre isso na política de privacidade do escritório." ;
  - a planilha (D10: três abas; não é o layout do Domínio; o que o dono precisa mandar para o layout do Domínio);
  - Testar dos agentes dos setores (D11): quem testa, o modo, o custo em "Testar o agente" no agente; agente só de Trabalho se testa com uma tarefa em Teste;
  - guarda dos arquivos (D14): só o dono; padrão "Nunca apagar"; sugestão 365; o que apaga e o que fica;
  - sobras resolvidas (D15) e as que ficam;
  - **trocar o trabalhador**: só depois de aplicar F–I3b juntas (D17); sem a I3b ele roda como a I3a (aviso no log).
- [ ] **Step 2: `docs/design-system.md`** — o bloco "Arquivos" da ficha (selo "só leitura", aviso `success`/`warning` com ícone, campo fora do formulário da ficha), o selo "Drive · só leitura" e "Apagado pela guarda" nas fontes, o botão "Ler a pasta de novo", "Baixar planilha" ao lado de "Baixar CSV", o aviso de linhas provisórias na Aprovação, o seletor de modo no simulador dos agentes dos setores, e o aviso "N tarefas aguardando aprovação · Revisar" no cartão.
- [ ] **Step 3: Commit**

```bash
git add docs/operacao.md docs/design-system.md
git commit -m "docs: Google Drive (passo a passo do dono e LGPD), planilha, Testar dos agentes dos setores e guarda dos arquivos (I3b)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx e **`supabase db reset`** antes da suíte pgTAP, antes do primeiro lote de e2e e antes dos cenários:
   - **o que não podia mudar não mudou:** `git diff BASE --stat -- apps/trabalhador/src/assistente apps/trabalhador/src/sugestao apps/trabalhador/src/envio.ts apps/trabalhador/src/processar-conversa.ts apps/trabalhador/src/retencao.ts apps/trabalhador/src/midia apps/trabalhador/src/agente/fora-do-acesso.ts apps/trabalhador/src/agente/acesso.ts apps/trabalhador/src/agente/pedido-nota.ts apps/trabalhador/src/agente/perfil.ts apps/trabalhador/src/agente/prompt.ts apps/trabalhador/src/agente/contexto.ts apps/trabalhador/src/agente/atender.ts apps/trabalhador/src/agente/pre-analise.ts apps/trabalhador/src/agente/pedidos-ao-contato.ts` **vazio**; `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff BASE --stat -- supabase/tests` mostra só `53` e `54` (novos); `git diff BASE --stat -- 'apps/**/*.test.ts' 'packages/**/*.test.ts'` mostra só arquivos **novos**; **`git log --format=%h BASE.. -- apps/trabalhador/test/agente/__retratos__` vazio**; `git diff BASE --stat -- apps/painel/e2e` = 3 novos + `agente-orientacoes.spec.ts` com 1 linha (D13);
   - `supabase test db`: todos os arquivos com os números de cada um, inclusive `22` (100/100), `46`, `48`, `50`, `51`, `52`, `53` (30) e `54` (32);
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck`;
   - `pnpm --filter @escritorio/trabalhador test` e `typecheck` (inclusive `retrato-thiago`, `motor-thiago`, `uma-mensagem`, `drive/*`, `tarefa/pasta`, `tarefa/sobras-i3a`, `simular-setor`);
   - `pnpm --filter @escritorio/painel test` e `typecheck`;
   - **e2e em lotes de até 2 arquivos** (`--workers=1`; memória ≥ 4 GB conferida antes de **cada** lote; nada mais rodando além do Supabase local): os lotes da Task 15; depois os demais arquivos de `ls apps/painel/e2e/*.spec.ts`, em lotes de até 2, na ordem alfabética (`supabase db reset` antes do primeiro e a cada 5 lotes, ou quando um e2e reclamar de dados velhos). Se o Claude Code matar um processo, **pare**, devolva `config.toml`/`.env` e avise com o lote em que parou. Some os números de todos os lotes;
   - **cenários com Claude de verdade** (D18; `supabase db reset` antes de cada rodada; memória ≥ 4 GB; nada mais rodando; anote o custo depois de cada uma): `pnpm --filter @escritorio/trabalhador cenarios` (64; ≈ US$ 2,5–4 — **o "fiscal: Mesma voz assina como Thiago" tem que passar**), `cenarios-atendimento` (6), `cenarios-assistente` (4) e `cenarios-tarefas` (6). Falha em cenário antigo: rode de novo **só ele** uma vez; falhou de novo → pendência com a saída inteira (confira antes que os retratos não mudaram). Teto: US$ 30 no total da I3b (some os das Tasks 1 e 11);
   - mostre os números exatos de cada suíte, de cada lote e de cada rodada (passaram, falharam, pulados) e o custo de cada rodada. Nada de "deve passar";
   - **volta sem a I3b de verdade:** num banco local só até a I3a (mova `supabase/migrations/20261017000{100,200}_*.sql` para a pasta de rascunho e `supabase db reset` — anote o método), confira: `pnpm --filter @escritorio/trabalhador cenarios "motor:"` (2) passa; um `tsx` de rascunho chama `anunciarSituacaoDrive`, `lerPastaDaTarefa` (→ `sem_i3b`) e `limparArquivosDasTarefas` (→ 0) sem erro; o painel (`next dev -p 3107`) abre a ficha de um cliente (faixa do bloco Arquivos), uma tarefa (fontes como na I3a; "Baixar planilha" funciona), `/agentes/fiscal/testar` (faixa `TEXTO_TESTE_SEM_I3B`) e Configurações › Integrações (faixas); depois devolva os arquivos e `supabase db reset`;
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-agente-tarefa-fechamento.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local (`next dev -p 3107`, `.env` local; **nunca** a homologação);
   - dados no banco **local** (script Playwright temporário na pasta de rascunho): a Padaria Sol com pasta e a situação do Drive "ligado" (`situacaoDriveTeste`); a tarefa **aguardando** da I3a com 2 arquivos do Drive e 1 enviado; a tarefa **pronta** com 2 linhas provisórias; o Fiscal com o Testar no modo "Por trás" e uma simulação pronta (respostas gravadas à mão, com uma devolução); o cartão do Contábil com 1 tarefa pronta;
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-i3b\` com nomes `i3b-<tela>-<largura>-<tema>.png`: `ficha-arquivos`, `tarefa-fontes-drive`, `tarefa-pronta-planilha`, `testar-fiscal`, `integracoes-drive-guarda`, `agentes-revisar`;
   - liste o que ficou diferente da imagem (já se sabe: "Pedido pelo Thiago" depende do clique, D7 da I3a; sem "automático todo dia 1º", I4; sem `.pdf` gerado; a planilha não é o layout do Domínio, D10).
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Deve listar as 21 pendentes de antes (F `20261006000100`–`300`, G1 `20261007000100`–`200`, G2 `20261008000100`, G3 `20261009000100`, H1 `20261012000100`–`300`, H2 `20261013000100`–`300`, I1 `20261014000100`–`300`, I2 `20261015000100`–`200`, I3a `20261016000100`–`300`) **e as duas da I3b**: `20261017000100_painel_v2_drive.sql`, `20261017000200_painel_v2_testar_guarda.sql`. Outra a mais → pare e avise;
   - **não aplique.** Deixe por escrito: a I3b só acrescenta (uma coluna em `clientes`; duas tabelas de uma linha; três colunas e um `check` mais largo em `agente_tarefa_arquivos`; uma coluna em `simulacoes_agente`; funções novas; duas funções da I3a com o corpo trocado); **nada lê o Drive** sem a chave no trabalhador e a pasta na ficha; a guarda começa em "Nunca apagar".
4. **Subir o painel para o dono ver** (porta livre a partir da **3018**, nunca 3001–3010; como o `ligar-teste.ps1`; antes, nada de e2e, cenário ou outro `next dev` desta parte rodando). **Trabalhador: NÃO suba nenhum**; o da 3001 é o teste do dono. Entregue o desta branch "pronto para trocar": (a) só depois de aplicar F–I3b juntas; (b) para o Drive, a variável `GOOGLE_DRIVE_CONTA_SERVICO` no ambiente dele (passo a passo em `operacao.md`); (c) sem a chave tudo funciona como na I3a. Roteiro curto para depois do `db push` e da troca: criar a conta de serviço e compartilhar **uma** pasta de teste; ficha do cliente de teste → Arquivos → colar o link; numa demanda de teste do Contábil (em Teste), TAREFA PARA O AGENTE → ver os arquivos do Drive entrarem sozinhos em Fontes ("Drive · só leitura"); pôr um PDF novo na pasta → LER A PASTA DE NOVO; no resultado, BAIXAR PLANILHA; Agentes › Fiscal › Testar no modo "Por trás"; Configurações › Integrações → escolher a guarda.
5. **Pendências para listar no fim:**
   - as decisões D1 a D19 que o dono ainda não confirmou (destaque **D2** — cliente REST sem biblioteca; **D3** — conta de serviço e compartilhar cada pasta como Leitor; **D6** — XLSX/DOCX do Drive ficam de fora; **D7** — ferramenta fora do catálogo; **D10** — planilha não é o layout do Domínio, gerada na hora; **D11** — agente só de Trabalho se testa com tarefa em Teste; **D13** — a linha do e2e antigo; **D14** — o prazo da guarda, **o dono escolhe** (sugestão 365));
   - **o que o dono precisa providenciar:** a conta de serviço do Google com a API do Drive ligada e a chave JSON; compartilhar cada pasta de cliente com o e-mail dela como Leitor; preencher "Pasta no Drive" nos clientes; um **modelo de arquivo de importação do Domínio** (para a planilha do Domínio); o prazo da guarda; o parágrafo de LGPD na política do escritório; o "ok" para aplicar F–I3b;
   - resultado dos cenários (quantos passaram, custo total) e qualquer cenário antigo que falhou duas vezes;
   - **I4:** PEDIR AO AGENTE (janela e WhatsApp), respostas de pendência pelo WhatsApp, tarefas agendadas; chegada automática do arquivo pedido ao cliente; Pasta no servidor (7E.6, opcional); cópia dos gerados no Drive (7E.6, "opção futura"); relatório de pendências em PDF;
   - as sobras que ficaram (lista da D15) e as de antes (I1: `atividade_do_agente` só com chamadas com conversa; I2: lista da D24 da I3a).
6. **Não juntar** a branch em nada. **Parar** ao fim da I3b e esperar o dono ver.
