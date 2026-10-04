# Painel v2, Parte H1 (Ficha do cliente — aba Dados). Plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para implementar este plano task por task. Cada task tem commit próprio e testes próprios. Os passos usam `- [ ]`.

**Objetivo:** a aba **Dados** da ficha do cliente vira a ficha completa da imagem `00-cliente-cadastro.png`, e a mesma tela serve para o **Novo cliente**. À esquerda, um **índice** com um item por bloco, ✓ quando o bloco está completo e o aviso quando falta algo ("1 PENDENTE", "VENCE"). No topo, as **etiquetas** (situação, certificado vencendo, regime). Os oito blocos: **Identificação** (CNPJ com busca pública que preenche razão social, CNAE e endereço; inscrições; regime; porte; faturamento; funcionários; segmentos), **Endereço** (CEP com busca pública), **Contato da empresa** (com e-mail de cobrança), **Fiscal — inscrições de substituto tributário** (lista UF + inscrição), **Contrato e honorários** (com os serviços contratados), **Responsáveis por setor**, **Certificado digital** (o aviso **cria uma demanda automática no Fiscal**, uma por certificado e vencimento, por uma tarefa diária do trabalhador) e **Acessos de portais** (senha **cifrada**, mostrada mascarada; revelar e copiar só com a permissão nova **"Ver acessos de portais"**, e **cada revelação grava auditoria**; a senha **nunca** vai para o agente, o assistente, logs ou exportações). No rodapé, a última alteração, CANCELAR e SALVAR. **Sem logo do cliente.**

**Arquitetura:**
- **Banco (3 migrações novas, só acréscimos):**
  - `20261012000100_painel_v2_ficha_cliente.sql`: colunas novas em `clientes` (todas aceitam vazio), `cliente_inscricoes_st`, cópia do `endereco` antigo para `logradouro` (sem apagar nem reescrever), `endereco` passa a ser o endereço por extenso montado pelo banco quando há logradouro (o agente continua lendo `endereco`), `salvar_ficha_cliente(p_id, p_dados)` (uma transação para a aba inteira) e `ultima_alteracao_cliente(p_cliente)`.
  - `20261012000200_painel_v2_acessos_portais.sql`: `usuarios.ver_acessos_portais`, `pode_ver_acessos()`, `definir_ver_acessos()`, `cliente_acessos` (a coluna `senha_cifrada` **sem leitura para `anon`, `authenticated` e `service_role`**, só pelas funções), `salvar_acesso`, `remover_acesso`, `revelar_acesso(id, acao)` com permissão + auditoria.
  - `20261012000300_painel_v2_certificado.sql`: `certificado_avisos` + `gerar_demandas_certificado(p_hoje)` (só `service_role`).
  - pgTAP novos `39`, `40`, `41`; `tipos.gen.ts` regerado.
- **Cifra da senha no servidor do painel** (AES-256-GCM, Node `crypto`), com a chave **fora do banco** na variável `ACESSOS_PORTAIS_CHAVE` (D1). O banco só guarda e devolve o texto cifrado (`v1.<iv>.<etiqueta>.<cifra>`), e só por `revelar_acesso`, que confere a permissão e grava a auditoria antes de devolver.
- **Trabalhador ("pronto para trocar", nunca ligado):** fila diária `certificados-vencendo` (07:00) chama `gerar_demandas_certificado`; teste novo que prova que `consultar_cadastro` (agente e assistente) continua com as mesmas 7 informações e que nenhum código do trabalhador toca acessos, contrato ou honorários. `consultar_cadastro`, o prompt e o que o modelo vê **não mudam**.
- **Painel:** `lib/cofre.ts` (cifra), `lib/consultas-publicas.ts` (BrasilAPI e ViaCEP pelo servidor, só com o número, 4 s de limite), regras puras em `clientes/ficha/ficha.ts`, ações em `clientes/ficha/acoes.ts` e `clientes/ficha/acessos-acoes.ts`, componentes da ficha em `clientes/ficha/*.tsx`, páginas `clientes/[id]/page.tsx` e `clientes/novo/page.tsx` reescritas (com volta para a aba de hoje quando a migração não está aplicada, D23), chave "Ver acessos de portais" na ficha da pessoa (`usuarios/`). E2e com **servidor falso local** para as buscas (nenhuma chamada externa nos testes).

**Tecnologias:** Next.js 15 (App Router, server components, server actions), React 19, Tailwind 4, shadcn/ui sobre Radix, lucide-react, Supabase (Postgres 17, RLS, privilégios por coluna), Node `crypto` (AES-256-GCM), pg-boss, Vitest, pgTAP, Playwright e @axe-core/playwright.

**Spec:** `docs/superpowers/specs/painel-v2/spec-painel-v2.md`:
- seção **7D.1** inteira (blocos e campos com `*`, índice com ✓ e pendências, etiquetas, rodapé, sem logo; certificado com demanda automática no Fiscal "1 por certificado/vencimento" e "aparece na Início"; acessos com senha cifrada, mascarada, permissão nova, auditoria por revelação, nunca para agente/assistente/logs/exportações; colunas e tabelas do "Banco"; busca de CNPJ e CEP pelo servidor do painel em BrasilAPI/ViaCEP, "só com o número; falha ou demora → preenchimento manual, sem bloquear"; "O agente continua lendo só o que já lê (`consultar_cadastro`); honorários, contrato e acessos **não** entram nas ferramentas do agente");
- **7D.3** (pgTAP: "senha de portal nunca legível sem permissão; `revelar_acesso` grava auditoria"; Playwright: "blocos do cadastro com busca de CEP/CNPJ simulada, pendências no índice, revelar senha com e sem permissão"). O resto da 7D.3 (contato Básico, filtros por setor, cenários com Claude) é da **H2**;
- **7C.2**, último item (Contatos ganha a coluna Perfil e o bloco de acesso): **H2, fora deste plano**;
- **3.1** (termos; "toda informação sobre cliente que o agente usa passa pelo filtro de acesso do contato (Parte H)" — o filtro é H2; migração incremental com pgTAP, `--dry-run` e aprovação do dono; nada é juntado), **4.3/4.6** (casca e tom), **8** (vermelho nunca sozinho; grep antes de trocar rótulos).
- Imagem: `imagens/00-cliente-cadastro.png` (**a implementar**); HTML de origem `fragmentos/00-cliente-cadastro.html`. Dados da imagem são de exemplo (o CNPJ `12.345.678/0001-90` da imagem nem é válido); onde imagem e spec divergem, vale o spec.

Prompt: `docs/superpowers/specs/painel-v2/prompts-para-colar.md`, "## Prompt H" — duas sub-etapas, **este plano é a sub-etapa 1 (aba Dados)**. Pontos que não podem falhar e que valem aqui: "**Senhas de portais: criptografadas, só com a permissão "Ver acessos de portais", cada revelação na auditoria, e NUNCA chegam ao agente, ao assistente, a logs ou exportações (teste que procura a senha nesses lugares).**" Os outros (filtro nas ferramentas, pedido fora do permitido, contato Básico, cenários com Claude) são da sub-etapa 2. Ao terminar: suítes com resultado real, `--dry-run` antes de aplicar na homologação e esperar o ok, subir o painel desta branch numa porta livre, não juntar nada. Estilo e convenções: `docs/superpowers/plans/2026-10-11-painel-v2-parte-g5-treinar-agente.md`. Manuais: `docs/design-system.md` e `docs/operacao.md`.

**Onde trabalhar:** worktree `C:/Users/Thiago/Desktop/PROJETO/AGENTESDEIA/.claude/worktrees/painel-v2-parte-h`, branch `painel-v2-parte-h`, a partir de `bfd18ab` (G5 pronta) ou do commit mais novo da branch. **Antes da Task 1, anote o SHA de partida:** `git rev-parse --short HEAD` → chamado de **BASE** abaixo. Todos os comandos rodam a partir da raiz da worktree. Confira `git diff etapa-1 -- docs/superpowers/specs/painel-v2`: se não sair vazio, traga com `git checkout etapa-1 -- docs/superpowers/specs/painel-v2` e faça um commit só disso.

## Decisões tomadas (sem o dono)

O dono está fora e autorizou decidir. Conferi no código o que o spec supõe:

- **`clientes` hoje** (`20260927000100_base.sql`): `razao_social`, `nome_fantasia`, `cnpj` (único, `^\d{14}$`), `inscricao_estadual`, `regime` (texto livre), `endereco` (texto livre), `uf char(2)` (sem checagem), `ativo`, `agente_pausado`, `criado_em`; a Parte B acrescentou `arquivado_em`/`arquivado_por`. RLS: leitura para qualquer pessoa ativa (`eh_usuario_ativo`), inserir/alterar com `editar_clientes` (= Clientes "Ver e editar" ou mais, pelo adaptador da Parte D), excluir só admin. `cliente_servicos` e `cliente_responsaveis` têm as mesmas regras, com excluir também por `editar_clientes` (`20260928000400`). Auditoria genérica (`registrar_auditoria`) em `clientes`, `cliente_servicos`, `cliente_responsaveis`: grava a linha inteira (antes/depois) em `auditoria_acessos` (leitura só do admin). **Testes antigos inserem clientes só com razão social e CNPJ** (`22_regressao_visibilidade` e vários `packages/db/test`, e2e): toda coluna nova precisa aceitar vazio.
- **A aba Dados de hoje** (`clientes/[id]/secao-dados.tsx`): cartão "Dados cadastrais" em modo leitura com "Editar" (`EdicaoAlternavel`), cartões "Serviços do contrato" (botão "Salvar serviços") e "Responsável por setor" ("Salvar responsáveis"), ações `salvarCliente`/`salvarServicos`/`salvarResponsaveis` (`clientes/acoes.ts`), erro por `?erro=` (`comAvisoDeErro`). "Pausar o agente para este cliente" (só admin) fica no formulário de dados. Novo cliente (`clientes/novo/page.tsx`): razão social, nome fantasia, CNPJ e "Salvar", com `salvarCliente(null, …)` e os avisos "Já existe cliente com este CNPJ." / "Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.".
- **E2e que dependem disso:** `clientes.spec.ts` (Novo cliente por "Razão social", "CNPJ", botão "Salvar"; "Salvar dados" ausente para quem só vê), `cadastros.spec.ts` (Novo cliente com CNPJ errado → `/Não foi possível salvar: .*CNPJ inválido/`), `arquivar-clientes.spec.ts` (CNPJ de arquivado → o aviso acima; "Excluir…" na aba Dados), `revisao.spec.ts` item 6 ("Salvar serviços" por quem tem "Editar clientes"), `acessibilidade.spec.ts` (rota `/clientes/<id>` e a janela do "Excluir…"). **Nenhum espera a hidratação.**
- **Permissões da Parte D:** níveis por módulo em `permissao_niveis` (**23 níveis em 9 módulos**), conferidos por `supabase/tests/23_painel_v2_niveis.test.sql` ("catálogo: 23 níveis em 9 módulos", "pessoa nova ganha os 9 módulos") e por `packages/db/test/niveis.test.ts` (o catálogo do banco igual a `NIVEIS` do `@escritorio/core`). `salvar_usuario(p_id, p_dados)` grava ficha, setores e níveis; `usuarios/acoes.test.ts` confere as chamadas. **Um módulo novo mudaria esses três testes de partes anteriores** (D3).
- **Agente e assistente:** `consultar_cadastro` (agente, `ferramentas.ts`) e o do assistente (`assistente/ferramentas.ts`) usam `repos.dadosDaEmpresa`, que lê **colunas explícitas** (`razao_social, nome_fantasia, cnpj, inscricao_estadual, regime, endereco, uf, ativo`). Colunas novas **não** chegam ao modelo sem mudar código. O trabalhador da porta 3001 (código da Parte A) lê `endereco`.
- **Demandas:** `chamados` tem `origem` texto livre (o painel já filtra `agente|sistema`), `prioridade`, `prazo_em`; o gatilho `chamados_antes_inserir` calcula o prazo pela prioridade quando vem vazio e `chamados_depois_inserir` grava os eventos iniciais. O setor "Fiscal" existe desde a base (e cuida de certificado digital desde `20260928000100`).
- **Trabalhador:** tarefas periódicas por pg-boss em `principal.ts` (`boss.work` + `boss.schedule(..., FUSO)`), filas criadas em `criarBoss` (`fila.ts`). O da porta 3001 é o teste do dono.
- **Criptografia disponível:** o projeto usa Postgres 17 (`supabase/config.toml`, `major_version = 17`); nenhuma migração usa `vault`, `pgsodium` ou `pgcrypto`. No Supabase, o pgsodium está obsoleto e não é oferecido no Postgres 17; o Supabase Vault existe local e na nuvem, mas decifra **dentro do banco**. A Task 2 registra o que o banco local tem (`pg_extension`), só como evidência; a decisão (D1) não depende disso.
- **Homologação:** as migrações da F e da G (`20261006*`–`20261009*`) continuam pendentes e as da H1 também ficarão (só `--dry-run`). A tela precisa abrir sem elas (D23). Nada da H1 depende de objeto da F ou da G.

Onde o spec é ambíguo ou não bate com o código, o plano segue a decisão abaixo. Se o dono decidir diferente, ajuste a task indicada antes de executá-la.

| # | Decisão (o que o plano faz) | Alternativa | Custo da alternativa | Task |
|---|---|---|---|---|
| D1 | **Senha cifrada no servidor do painel** (AES-256-GCM, chave de 32 bytes em `ACESSOS_PORTAIS_CHAVE`, fora do banco; contexto autenticado = `acesso:<cliente_id>`, a cifra não serve em outra empresa). A senha em claro nunca entra no Postgres: nem argumento de função, nem linha, nem log de comando, nem cópia de segurança. O trabalhador (que usa `service_role`) não tem a chave. | Supabase Vault (`vault.create_secret` / `vault.decrypted_secrets`) ou pgsodium. | A senha em claro passa pelo banco (argumentos das funções; log de comandos se alguém ligar); quem tiver leitura de `vault.decrypted_secrets` ou uma função definer com bug decifra; pgsodium está obsoleto e fora do Postgres 17. **Custo desta escolha:** o dono configura a chave em cada ambiente (gerar com o comando da Task 14) e guarda uma cópia; perder a chave = recadastrar as senhas. | 2, 5, 9 |
| D2 | **O banco nunca entrega a cifra fora de `revelar_acesso`:** `senha_cifrada` sem privilégio de leitura para `anon`, `authenticated` **e `service_role`** (privilégio por coluna); escrita só pelas funções (`salvar_acesso`/`remover_acesso`); uma checagem de formato (`^v1\.…`) recusa texto puro na coluna; `revelar_acesso`, `salvar_acesso` e `remover_acesso` sem execução para `anon` e `service_role`. | RLS só por linha. | A RLS não esconde coluna: quem lê a linha leria a cifra. | 2 |
| D3 | **"Ver acessos de portais" é uma permissão à parte, não um módulo de nível:** coluna `usuarios.ver_acessos_portais` (padrão desligada), `pode_ver_acessos()` (admin sempre; pessoa ativa e no horário com a marcação) e `definir_ver_acessos(p_usuario, p_pode)` (só admin; a auditoria de `usuarios` registra quem deu). | Módulo `acessos` (Não/Sim) em `permissao_niveis`. | Muda três testes de partes anteriores (`23_painel_v2_niveis`: "23 níveis em 9 módulos"; `packages/db/test/niveis.test.ts`; `NIVEIS` do core) e `salvar_usuario`. | 2, 9, 12 |
| D4 | **A chave "Ver acessos de portais" grava na hora**, num cartão próprio abaixo da ficha da pessoa (`ChaveVerAcessos`), separada do Salvar da ficha. Administrador: o cartão diz "O administrador sempre vê." | Dentro de `salvar_usuario`. | Substituir a função da Parte D e mudar `usuarios/acoes.test.ts`. | 9, 12 |
| D5 | **Revelar e copiar passam pela mesma `revelar_acesso(id, acao)`**: auditoria `revelar_acesso` ou `copiar_acesso` com quem, quando, empresa e portal (nunca a senha nem a cifra). A senha revelada some sozinha em 30 s (e ao clicar "Esconder"); copiar não mostra a senha. | Copiar sem auditoria. | Contra "cada revelação grava auditoria". | 2, 9, 11 |
| D6 | **Cadastrar, editar e remover acesso exige "Ver e editar" em Clientes e "Ver acessos de portais".** Senha em branco ao editar mantém a atual; "Sem senha" (ex.: e-CAC pelo certificado) grava sem senha. | Só "Ver e editar". | Quem não pode ver poderia trocar a senha de um portal sem ninguém notar. | 2, 9, 11 |
| D7 | **Portal e usuário ficam visíveis para quem vê a ficha**; só a senha é protegida (como na imagem). | Esconder o bloco de quem não tem a permissão. | Contra a imagem; a equipe não saberia que o acesso existe. | 11 |
| D8 | **Sem a chave no ambiente**, o bloco mostra portal e usuário e o aviso "Guardar e revelar senhas precisa da chave do escritório neste ambiente (ACESSOS_PORTAIS_CHAVE)."; adicionar, editar, revelar e copiar ficam desligados (remover continua). **Nunca há chave padrão no código;** só o `playwright.config.ts` fixa uma chave de teste para os e2e locais. | Chave padrão de desenvolvimento. | Uma chave conhecida acabaria em produção por esquecimento. | 5, 11 |
| D9 | **Os `*` não travam o SALVAR, exceto Razão social e CNPJ** (como hoje): o resto vira pendência no índice ("N PENDENTES") e no cabeçalho "* campos obrigatórios · a ficha salva com pendências". | Travar até tudo estar preenchido. | Cliente antigo (só razão e CNPJ) não salvaria nada sem completar a ficha inteira; os e2e de Novo cliente quebrariam. | 1, 7, 10 |
| D10 | **Toda coluna nova aceita vazio**; o banco só confere formato e faixa (CEP com 8 números, e-mail, dia 1–31, segmentos conhecidos…). A checagem de UF de `clientes.uf` entra como `NOT VALID` (vale para o que for gravado daqui em diante; dado antigo fora do padrão não trava a migração). | Colunas `not null`. | Quebra `22_regressao_visibilidade` e os testes que criam clientes só com razão e CNPJ. | 1 |
| D11 | **`endereco` antigo:** a migração **copia** para `logradouro` onde ele está vazio e **não apaga nem reescreve** `endereco`. Depois, um gatilho mantém `endereco` como **endereço por extenso** ("Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450") sempre que um campo do endereço é gravado com logradouro preenchido. Assim `consultar_cadastro` (agente, assistente e o trabalhador da 3001) segue lendo `endereco`, sem mudar código. O texto anterior fica na auditoria. | Trabalhador lê os campos novos. | O trabalhador da 3001 (Parte A) informaria endereço velho até ser trocado; muda o que o modelo vê (cenários com Claude). | 1, 4 |
| D12 | **O endereço antigo vai inteiro para Logradouro**, sem tentar separar número, bairro e cidade; o índice mostra as pendências para a pessoa completar. | Separar por expressão regular. | Separação errada e silenciosa. | 1 |
| D13 | **Um SALVAR para a aba inteira** (identificação, endereço, contato, inscrições ST, contrato, serviços, responsáveis, certificado e a pausa do agente), por `salvar_ficha_cliente(p_id, p_dados)` numa transação só. Acessos têm salvamento próprio (a senha nunca vai junto do formulário). Saem o modo leitura com "Editar", "Salvar dados", "Salvar serviços" e "Salvar responsáveis". | Um botão por bloco. | Contra a imagem (rodapé único) e o "não salvo" da ficha. | 1, 8, 10 |
| D14 | **`salvar_ficha_cliente` roda com a regra de quem chama** (`security invoker`: a RLS de hoje continua valendo) e ainda confere `editar_clientes` por escrito (sem isso, um UPDATE barrado pela RLS passaria calado). `agente_pausado` só muda quando a chave vem no pedido (o painel só manda para o admin, como hoje). | `security definer`. | Pularia a RLS; toda regra teria de ser reescrita na função. | 1, 8 |
| D15 | **Busca pública:** CNPJ preenche **só os campos vazios** (razão social, nome fantasia, CNAE e endereço); não mexe em regime nem porte. CEP preenche logradouro, bairro, cidade e UF (é para isso que serve) e mantém número e complemento. Dispara pela lupa e ao sair do campo com o número completo e diferente do salvo. Respostas: "Preenchido pela busca: …", "Não achei este CNPJ na busca pública. Preencha à mão.", "Não achei este CEP. Preencha à mão.", "Não consegui buscar agora. Preencha à mão." — nunca trava. Limite de 4 s. Os endereços das buscas vêm de `CONSULTA_CNPJ_URL` e `CONSULTA_CEP_URL` (padrão BrasilAPI e ViaCEP), para os e2e usarem o servidor falso. | Sobrescrever tudo com a busca. | Apagaria o que a pessoa já tinha escrito. | 6, 8, 10 |
| D16 | **Responsáveis:** todos os setores ativos (como hoje); os ligados aos serviços marcados aparecem primeiro e os outros ficam em "Outros setores (N)", recolhido, **mas sempre enviados** (nada se apaga por estar escondido). | Só os setores contratados. | Perderia responsável de setor sem serviço (ex.: Financeiro). | 10 |
| D17 | **Tipo de pessoa fixo "Jurídica"** (campo só leitura, como na imagem). A coluna aceita `juridica`/`fisica` para o futuro. | Escolher. | CPF pediria outra regra de documento e de CNPJ único. | 1, 10 |
| D18 | **Regime:** lista (Simples Nacional, MEI, Lucro Presumido, Lucro Real, Imune/Isenta); valor antigo fora da lista aparece como "<valor> (antigo)" e continua válido. Sem checagem no banco (o agente lê `regime` como texto). | Checagem no banco. | Quebraria clientes com regime antigo escrito à mão. | 7, 10 |
| D19 | **Reajuste em duas colunas** (`reajuste`: sem/anual/semestral; `reajuste_mes`), num seletor só ("Anual · março", "Semestral · março e setembro"); **13º honorário** booleano ("Não" / "Sim, em dezembro"). O spec listava uma coluna `reajuste`. | Texto livre. | Nada para avisar reajuste no futuro. | 1, 7, 10 |
| D20 | **Certificado:** "Sem certificado" no Tipo dispensa o vencimento; sem tipo e sem vencimento = 1 pendência. Índice e etiqueta: "vence" quando faltam até `certificado_avisar_dias` (padrão 30), "vencido" depois do dia. | — | — | 1, 7 |
| D21 | **Demanda automática do certificado:** `gerar_demandas_certificado(p_hoje)` cria **uma demanda por empresa e vencimento** (tabela `certificado_avisos`), no setor Fiscal, para o responsável do Fiscal daquela empresa (sem ele, a fila do setor), origem `sistema`, prioridade **alta** com 7 dias ou menos (ou vencido), senão normal; prazo às 18:00 do dia anterior ao vencimento (se esse dia já passou, o prazo da prioridade). Trabalhador: todo dia às 07:00. **"Aparece na Início"** = a demanda aparece nas listas de demandas do Início (Minhas demandas por prazo, Sem responsável, Demandas por setor); nada novo no Início. | Aviso próprio no Início. | Mexe no Início (G2) e nos testes dele. | 3, 4 |
| D22 | **Trabalhador entregue "pronto para trocar"** (fila nova). Enquanto o da 3001 (Parte A) roda, nenhuma demanda de certificado é criada; o dono fica sabendo. Nenhum trabalhador é ligado nem desligado. | Ligar um segundo trabalhador. | Dois trabalhadores no mesmo banco dividem a fila. | 4, Entrega |
| D23 | **Homologação sem a migração da H1:** a página percebe pela falta de `logradouro` na linha do cliente e mostra a aba Dados **de hoje** (arquivos atuais renomeados para `*-antiga`), com o aviso "A ficha completa aparece quando a atualização do banco da Parte H for aplicada."; Novo cliente idem. Na ficha da pessoa, o cartão "Acessos de portais" some se a coluna não existe. | Exigir a migração. | O painel desta branch quebraria na homologação até o dono aplicar. | 12 |
| D24 | **Rodapé "Última alteração: <pessoa>, dd/mm HH:MM"** por `ultima_alteracao_cliente` (security definer, devolve só nome e hora, considera só mudanças feitas por pessoas em `clientes`, serviços, responsáveis, inscrições ST e acessos — revelar não conta). **"ver registro de alterações" fica fora** (não existe tela de auditoria). | Tela de registro. | Tela nova fora do spec. | 1, 10 |
| D25 | **Novo cliente = a mesma ficha**, vazia; as outras abas não aparecem até salvar; Acessos mostra "Salve a ficha para cadastrar acessos."; "Excluir…" só na ficha salva. | Formulário curto à parte. | Contra o spec ("mesma tela para Novo cliente"). | 12 |
| D26 | **SALVAR só fica ativo depois da hidratação** (o clique do Playwright espera o botão ativo): os e2e de Novo cliente (`clientes`, `cadastros`, `arquivar-clientes`) passam **sem mudança**. Só `revisao.spec.ts` muda **uma linha** ("Salvar serviços" → "Salvar", o único botão que o spec tirou). Os novos e2e esperam `data-ficha-hidratada`. | Adaptar todos os e2e antigos. | Mais arquivos de partes anteriores mexidos. | 10, 13 |
| D27 | **Cabeçalho:** sobrelinha "Ficha do cliente" (`PageHeader secao`), título = nome fantasia ou razão social (o heading de hoje), linha "razão social · CNPJ · cliente desde MM/AAAA · * campos obrigatórios", etiquetas à direita, **sem logo**. As abas continuam com os rótulos de hoje ("Preços por rede"…). "Pausar o agente para este cliente" (só admin) fica no fim de Identificação, com o mesmo rótulo. | Abas com os rótulos da imagem. | Mexer em abas e e2e de partes anteriores sem pedido. | 12 |
| D28 | **Índice:** navegação "Blocos da ficha" com links para as âncoras; o item do bloco na tela fica marcado (rolagem); estado recalculado a cada digitação; ✓ com "completo" para leitor de tela, "1 pendente"/"N pendentes", "vence", "vencido" escritos (a cor nunca fala sozinha); Acessos com cadeado e "protegido". Largura `w-indice-ficha` (token `--client-index-width: calc(220rem / 14)`). | — | — | 7, 10, 12 |
| D29 | **Contrato e honorários ficam em `clientes`**, legíveis por quem vê a ficha (como os outros dados do cliente hoje). O agente e o assistente não leem (colunas explícitas em `dadosDaEmpresa`; teste novo no trabalhador). "Ver valores" é permissão de **contato** (H2). | Só o admin vê honorários. | Tabela separada e RLS nova, fora do spec. | 1, 4 |
| D30 | **Duas pessoas salvando a mesma ficha:** vale o último SALVAR (como hoje). | Trava otimista. | Coluna de versão e tela de conflito. | 1 |
| D31 | **Fora da H1:** aba Contatos com acesso por pessoa, coluna Perfil em Contatos, filtro nas ferramentas do agente, contato Básico, cenários com Claude (todos H2). | — | — | — |
| D32 | **E2e de busca contra um servidor falso local** (`e2e/consultas-falsas.mjs`, porta 3199), ligado pelo `playwright.config.ts`, que também força `CONSULTA_CNPJ_URL`, `CONSULTA_CEP_URL` e a chave de teste. Nenhuma chamada externa nos testes. | Interceptar no navegador (`page.route`). | A busca é feita pelo servidor do painel; o navegador nem vê a chamada. | 6, 13 |
| D33 | **Cenários com Claude de verdade não rodam na H1:** nada do que o modelo vê muda (mesmas 7 informações em `consultar_cadastro`; o endereço por extenso é o mesmo campo `endereco`). Prova: `git diff BASE --stat -- apps/trabalhador/src/agente apps/trabalhador/src/assistente` vazio e o teste novo das chaves. | Rodar mesmo assim. | Gasto de API sem nada novo para medir. | 4, Entrega |

## Restrições globais

- **Só mexer em:** `supabase/migrations` (três arquivos **novos**), `supabase/tests` (três arquivos **novos**), `packages/db/src/repos.ts` (um método) e `packages/db/src/tipos.gen.ts` (regerado com `pnpm db:tipos`, nunca à mão), `apps/trabalhador/src/{fila,tarefas,principal}.ts` e testes **novos** do trabalhador, `apps/painel` (ficha, usuários, tokens, `playwright.config.ts`, e2e), `.env.example`, `docs/design-system.md`, `docs/operacao.md`. **Nada em `apps/trabalhador/src/agente` nem `apps/trabalhador/src/assistente`** (D33).
- **Testes de partes anteriores não mudam:** nenhum pgTAP existente (`supabase/tests/**` de `01` a `38`), nenhum `*.test.ts` existente. **E2e existentes:** só `revisao.spec.ts` (uma linha, D26) e `acessibilidade.spec.ts` (acrescentar a rota `/clientes/novo` à lista, como pede `docs/design-system.md` para tela nova). Nenhuma conferência no banco desses arquivos muda.
- **O teste congelado `supabase/tests/22_regressao_visibilidade.test.sql` continua 100/100** e `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` sai vazio (ele também fixa a lista do `supabase_realtime`: **nada é publicado** nesta parte; a ficha não precisa de tempo real). Nunca use `usuario_liberado` em código novo (é só do `service_role`); use `eh_usuario_ativo`, `eh_admin`, `tem_permissao`.
- **Senha de portal:** nunca em `console.*`, nunca em mensagem de erro, nunca em `auditoria_acessos`, nunca em `revalidatePath`/URL/`?erro=`, nunca no HTML antes de "Revelar". Só `lib/cofre.ts` cifra e decifra, e só `clientes/ficha/acessos-acoes.ts` importa `lib/cofre.ts` (teste de guarda, Task 5). Nada de `ACESSOS_PORTAIS_CHAVE` em arquivo do git além do `.env.example` (vazio) e do `playwright.config.ts` (chave de teste, D8).
- **Banco local só para testes, em portas temporárias.** Depois de reiniciar, o Windows reserva as portas 54287 a 54586, então o Supabase local roda nas portas **563xx** enquanto durar o trabalho:
  1. Antes de ligar, guarde cópias: `cp supabase/config.toml "$SCRATCH/config.toml.bak"` e `cp .env "$SCRATCH/.env.bak"`. `$SCRATCH` é a pasta de rascunho da sessão; o `.env` não está no git.
  2. Em `supabase/config.toml`, troque: `port = 54321` (api) por `56321`; `port = 54322` (db) por `56322`; `shadow_port = 54320` por `56320`; `port = 54329` (pooler) por `56329`; `port = 54323` (studio) por `56323`; `port = 54324` (inbucket) por `56324`; `port = 54327` (analytics) por `56327`.
  3. No `.env`, troque `127.0.0.1:54321` por `127.0.0.1:56321` (em `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`) e `127.0.0.1:54322` por `127.0.0.1:56322` (em `DATABASE_URL`). Para o `next dev` das capturas (Entrega), acrescente no `.env` local `ACESSOS_PORTAIS_CHAVE=` com uma chave gerada na hora (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`); ela some quando o `.env` volta da cópia.
  4. Antes de ligar, confira com `supabase status` se já há um Supabase local rodando, de outra worktree com o mesmo projeto. Se houver, use esse e **não o desligue**. Não ligue nem desligue nenhum banco ou servidor além do Supabase local de testes desta worktree.
  5. **Antes de rodar uma suíte inteira, `supabase db reset`.** Os dados que os e2e deixam no banco quebram os pgTAP antigos.
  6. Ao terminar, e antes de qualquer commit: `cp "$SCRATCH/config.toml.bak" supabase/config.toml` e `cp "$SCRATCH/.env.bak" .env`. Depois, `git status` não pode mostrar `supabase/config.toml` alterado. **Nenhum commit leva as portas temporárias.**
- **`pnpm` está em `~/bin`.** No Git Bash, comece cada sessão com `export PATH="$HOME/bin:$PATH"`.
- **Para filtrar e2e**, rode dentro de `apps/painel`: `cd apps/painel && pnpm exec playwright test e2e/<arquivo>.spec.ts`.
- **A máquina tem pouca memória:** e2e sempre em **lotes pequenos** (os arquivos novos sozinhos, um por vez, na Task 13; a suíte inteira em lotes de até 6 arquivos, só na Entrega). **Nunca rode a suíte e2e inteira de uma vez dentro de uma task.** Nunca rode o painel de teste do dono, o `next dev` desta parte e e2e ao mesmo tempo.
- **E2e só contra o banco local:** `apps/painel/e2e/trava-local.ts` recusa outro banco. **Nunca rode teste contra a homologação, e nunca altere `.env.homologacao`** (só leitura, na Entrega, para o `--dry-run` e o painel do dono). **Nenhum teste chama BrasilAPI ou ViaCEP de verdade** (D32).
- **Esperar a hidratação nos e2e novos:** abra a ficha por `abrirFicha(page, url)` (`e2e/apoio-ficha.ts`, Task 13), que espera `[data-ficha-hidratada]`. Localize os blocos por `bloco(page, '<título>')` (região com nome) e o índice por `indice(page)` (navegação "Blocos da ficha").
- **Nenhum trabalhador é ligado nem desligado nesta parte.** O da porta **3001 é o teste do dono: não desligue nem mate esse processo.** O desta branch é entregue "pronto para trocar" (D22).
- **Antes de mudar texto ou `data-testid` usado em teste,** rode `grep -rn "<texto>" apps/painel/e2e apps/painel/src`. **Ficam como estão:** "Razão social", "CNPJ", "Nome fantasia", "Inscrição estadual", "Salvar" (nome do botão da ficha), "Não foi possível salvar: ", "Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.", "Já existe cliente com este CNPJ.", "CNPJ inválido", "Excluir…", "Pausar o agente para este cliente", "Agente pausado para esta empresa", "Seções da empresa", "Dados", "Contatos", "Clientes e fornecedores", "Produtos", "Preços por rede", "Documentos", "Novo cliente". **Nenhum nome acessível novo pode conter "CNPJ" ou "Razão social"** além dos próprios campos (o `getByLabel('CNPJ')` dos e2e antigos não é exato): a lupa do CNPJ chama-se "Buscar dados públicos da empresa" e a do CEP, "Buscar o endereço".
- **Nada de cor, tamanho ou espaçamento solto no JSX:** nada de `#hex`, `bg-white`, `text-[13px]`, `w-[220px]`, `grid-cols-[...]` nem `shadow-[...]`. Só tokens e a escala do Tailwind (a largura do índice vira token, Task 12). `escala.test.ts` e `tokens.test.ts` continuam passando. Ícones só com `size={12|14|16|20}`.
- **Tom dos textos (spec 4.6):** frases curtas e afirmativas, sem "Tem certeza?", "por favor" ou "com sucesso". Caixa alta só pelo CSS (`uppercase`). Vermelho nunca sozinho.
- **Termos (spec 3.1):** Demanda, Empresa, Contato, Setor. "Pessoa" para usuário da equipe.
- **Comentários no código:** estilo da casa, em português, uma linha dizendo o porquê.
- **Um commit por task**, mensagem em português no estilo convencional, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nada é juntado a outra branch.

## Foco da revisão

Situações que o spec implica e que nenhum teste antigo cobre. Cada uma tem teste na task dona:

1. **Senha legível sem permissão:** `senha_cifrada` sem leitura para `anon`, `authenticated` e `service_role`; `revelar_acesso` recusa quem não tem a permissão, quem está arquivado e `service_role`; texto puro é recusado na coluna. Tasks 2 (pgTAP) e 13 (e2e: o cliente de serviço do teste recebe "permission denied" ao pedir `senha_cifrada`).
2. **Revelar sem auditoria / auditoria com segredo:** cada revelar e cada copiar gravam uma linha (quem, empresa, portal); nenhuma linha de `auditoria_acessos` contém a cifra (`v1.`) nem a senha. Tasks 2 e 13.
3. **Senha chegando ao agente, ao assistente, a logs ou exportações:** o trabalhador e os repositórios não citam `cliente_acessos`/`senha_cifrada`/`revelar_acesso`; `consultar_cadastro` continua com as 7 chaves; só `acessos-acoes.ts` importa o cofre; o HTML da ficha antes de revelar não contém a senha. Tasks 4, 5 e 13.
4. **Endereço antigo perdido ou sobrescrito:** a cópia só preenche `logradouro` vazio; `endereco` não muda na migração; salvar sem mexer no endereço mantém `endereco` igual. Tasks 1 e 13.
5. **Busca que trava ou sobrescreve:** CNPJ preenche só os vazios; CEP lento, CEP desconhecido, CNPJ fora da busca e serviço fora do ar viram aviso e os campos continuam editáveis; só o número sai na chamada. Tasks 6 (unidade) e 13 (e2e).
6. **Salvar pela metade:** inscrições ST, serviços e responsáveis saem na mesma transação; UF repetida recusa tudo; "Só ver" não grava nada (nem pela função). Tasks 1 e 13.
7. **Demanda de certificado repetida ou no lugar errado:** uma por empresa e vencimento, nunca para empresa arquivada nem "Sem certificado"; Fiscal + responsável do Fiscal; vencimento novo gera outra. Tasks 3 e 4.
8. **Pendência enganosa:** índice recalculado ao digitar; "1 linha sem inscrição"; "vence"/"vencido" pela data de São Paulo. Tasks 7 e 13.
9. **Agente sem mudança:** `git diff BASE --stat -- apps/trabalhador/src/agente apps/trabalhador/src/assistente` vazio. Entrega.

---

## Mapa de arquivos

Todos os caminhos `ficha/…` são `apps/painel/src/app/(painel)/clientes/ficha/…`; `[id]/…` e `novo/…` ficam em `apps/painel/src/app/(painel)/clientes/`.

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/20261012000100_painel_v2_ficha_cliente.sql`, `supabase/tests/39_painel_v2_ficha_cliente.test.sql` (novos), `packages/db/src/tipos.gen.ts` | colunas, inscrições ST, endereço copiado e por extenso, `salvar_ficha_cliente`, `ultima_alteracao_cliente` | 1 |
| `supabase/migrations/20261012000200_painel_v2_acessos_portais.sql`, `supabase/tests/40_painel_v2_acessos_portais.test.sql` (novos), `tipos.gen.ts` | permissão, `cliente_acessos`, funções com auditoria | 2 |
| `supabase/migrations/20261012000300_painel_v2_certificado.sql`, `supabase/tests/41_painel_v2_certificado.test.sql` (novos), `tipos.gen.ts` | `certificado_avisos`, `gerar_demandas_certificado` | 3 |
| `packages/db/src/repos.ts`; `apps/trabalhador/src/{fila,tarefas,principal}.ts`; `apps/trabalhador/test/certificado.test.ts`, `apps/trabalhador/test/agente/cadastro-sem-contrato.test.ts` (novos) | fila diária do certificado; guarda do agente | 4 |
| `apps/painel/src/lib/cofre.ts`, `cofre.test.ts`, `cofre-guarda.test.ts` (novos) | cifra AES-256-GCM e guarda de importação | 5 |
| `apps/painel/src/lib/consultas-publicas.ts`, `consultas-publicas.test.ts` (novos), `apps/painel/e2e/consultas-falsas.mjs` (novo), `apps/painel/playwright.config.ts` | busca de CNPJ e CEP; servidor falso dos e2e | 6 |
| `ficha/ficha.ts`, `ficha/ficha.test.ts` (novos) | regras puras: opções, leitura do formulário, dinheiro, pendências, etiquetas, textos | 7 |
| `ficha/acoes.ts`, `ficha/acoes.test.ts` (novos) | salvar a ficha, buscar CNPJ e CEP | 8 |
| `ficha/acessos-acoes.ts`, `ficha/acessos-acoes.test.ts`, `ficha/acessos-textos.ts`, `usuarios/ver-acessos.ts`, `usuarios/ver-acessos.test.ts` (novos) | salvar, remover, revelar e copiar acesso; dar a permissão | 9 |
| `ficha/campos.tsx`, `ficha/indice-ficha.tsx`, `ficha/blocos-empresa.tsx`, `ficha/blocos-contrato.tsx`, `ficha/inscricoes-st.tsx`, `ficha/rodape-ficha.tsx`, `ficha/ficha-cliente.tsx` (novos) | a ficha (formulário, índice, blocos, rodapé) | 10 |
| `ficha/acessos-portais.tsx` (novo) | bloco Acessos de portais | 11 |
| `ficha/dados-ficha.tsx`, `ficha/cabecalho-ficha.tsx` (novos); `[id]/page.tsx`, `[id]/loading.tsx`, `novo/page.tsx` (reescritos); `[id]/secao-dados.tsx` → `[id]/secao-dados-antiga.tsx`, `novo/form-antigo.tsx` (D23); `usuarios/chave-ver-acessos.tsx` (novo), `usuarios/[id]/page.tsx`; `src/styles/tokens.css`, `src/app/globals.css`, `src/styles/largura-ficha.test.ts` (novo) | páginas, volta sem migração, cartão da permissão, largura do índice | 12 |
| `apps/painel/e2e/apoio-ficha.ts`, `e2e/ficha-dados.spec.ts`, `e2e/ficha-acessos.spec.ts` (novos); `e2e/revisao.spec.ts` (1 linha); `e2e/acessibilidade.spec.ts` (1 rota) | e2e | 13 |
| `docs/design-system.md`, `docs/operacao.md`, `.env.example` | manuais e variável nova | 14 |

---
### Task 1: Banco. Ficha completa do cliente (colunas, inscrições ST, endereço, salvar numa transação)

**Files:**
- Create: `supabase/migrations/20261012000100_painel_v2_ficha_cliente.sql`
- Create: `supabase/tests/39_painel_v2_ficha_cliente.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `clientes` (base + Parte B), `cliente_servicos`, `cliente_responsaveis`, `setores`, `usuarios`, `auditoria_acessos`, `registrar_auditoria()`, `tem_permissao(text)` (adaptador da Parte D), `eh_usuario_ativo()`.
- Produces:
  - colunas novas em `clientes`: `tipo_pessoa, inscricao_municipal, inscricao_suframa, isento_ie, cnae_principal, porte, faturamento_ultimo_ano, funcionarios, segmentos text[], cep, logradouro, numero, complemento, bairro, cidade, telefone, celular, email, email_cobranca, site, contrato_inicio, contrato_fim, honorario_mensal, dia_vencimento, reajuste, reajuste_mes, decimo_terceiro, certificado_tipo, certificado_vencimento, certificado_avisar_dias` (todas aceitam vazio, D10);
  - tabela `cliente_inscricoes_st(cliente_id, uf, inscricao)` (chave `(cliente_id, uf)`, RLS e auditoria como `cliente_servicos`);
  - `montar_endereco(...) returns text` (imutável) e o gatilho `endereco_por_extenso` (D11);
  - `copiar_endereco_para_logradouro() returns int` (só `postgres`; a migração chama uma vez, D11/D12);
  - `salvar_ficha_cliente(p_id uuid, p_dados jsonb) returns uuid` (**security invoker**, D13/D14);
  - `ultima_alteracao_cliente(p_cliente uuid) returns jsonb` (`{pessoa, quando}` ou nulo; security definer, D24).

- [ ] **Passo 0: guardar a regressão de antes**

Com o Supabase local nas portas 563xx (Restrições globais): `supabase db reset && supabase test db 2>&1 | grep -E "22_regressao|23_painel|Result" | tee "$SCRATCH/regressao-antes.txt"`.
Expected: `22_regressao_visibilidade.test.sql .. ok` (100/100), `23_painel_v2_niveis.test.sql .. ok` e `Result: PASS`.

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/39_painel_v2_ficha_cliente.test.sql`:

```sql
-- Parte H1, Task 1 (spec 7D.1): ficha completa do cliente. Só acréscimos: o endereço antigo continua, a cópia não
-- sobrescreve nada, a aba inteira salva numa chamada com a regra de quem chama, e "Só ver" não grava.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('e8100000-0000-0000-0000-00000000000a', 'admin@h1.local'),
  ('e8100000-0000-0000-0000-00000000000b', 'bia@h1.local'),
  ('e8100000-0000-0000-0000-00000000000c', 'ana@h1.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e8100000-0000-0000-0000-00000000000a', 'Admin H1', 'admin@h1.local', 'admin', '{}'),
  ('e8100000-0000-0000-0000-00000000000b', 'Bia H1', 'bia@h1.local', 'atendente', '{editar_clientes}'),
  ('e8100000-0000-0000-0000-00000000000c', 'Ana H1', 'ana@h1.local', 'atendente', '{}');
insert into public.setores (id, nome) values ('e8400000-0000-0000-0000-000000000001', 'H1 Fiscal');
insert into public.servicos (id, nome) values ('e8200000-0000-0000-0000-000000000001', 'H1 Contábil');
-- Antigo: só o endereço de hoje. Já Tem: já tem logradouro (o gatilho monta o endereço por extenso).
insert into public.clientes (id, razao_social, cnpj, endereco) values
  ('e8300000-0000-0000-0000-00000000000a', 'H1 Antigo Ltda', '11222333000181', 'Rua Antiga, 10 - Centro, Belo Horizonte');
insert into public.clientes (id, razao_social, cnpj, endereco, logradouro) values
  ('e8300000-0000-0000-0000-00000000000b', 'H1 Já Tem Ltda', '11444777000161', 'Texto velho', 'Rua Nova');

-- 1–7: estrutura, cópia do endereço e endereço por extenso
select has_table('public', 'cliente_inscricoes_st', 'tabela de inscrições de substituto tributário');
select has_column('public', 'clientes', 'endereco', 'o endereço antigo continua (nada sai)');
select is((select endereco from public.clientes where id = 'e8300000-0000-0000-0000-00000000000b'), 'Rua Nova',
  'com logradouro, endereco vira o endereço por extenso (D11)');
select ok(public.copiar_endereco_para_logradouro() >= 1, 'a cópia preenche quem só tinha o endereço antigo');
select results_eq(
  $$ select logradouro, endereco from public.clientes where id = 'e8300000-0000-0000-0000-00000000000a' $$,
  $$ values ('Rua Antiga, 10 - Centro, Belo Horizonte'::text, 'Rua Antiga, 10 - Centro, Belo Horizonte'::text) $$,
  'antigo: copiado inteiro para Logradouro (D12) e o endereço continua igual');
select is((select logradouro from public.clientes where id = 'e8300000-0000-0000-0000-00000000000b'), 'Rua Nova',
  'logradouro já preenchido não é sobrescrito');
select is(public.montar_endereco('Rua Rosa Figueiredo', '430', 'loja 2', 'São Marcos', 'Conselheiro Lafaiete', 'MG', '36404450'),
  'Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450', 'endereço por extenso como na imagem');

-- 8–13: gatilho e checagens de formato (só valem quando há valor)
update public.clientes set logradouro = 'Rua Antiga', numero = '10', bairro = 'Centro', cidade = 'Belo Horizonte', uf = 'MG', cep = '30110000'
 where id = 'e8300000-0000-0000-0000-00000000000a';
select is((select endereco from public.clientes where id = 'e8300000-0000-0000-0000-00000000000a'),
  'Rua Antiga, 10 - Centro, Belo Horizonte/MG, CEP 30110-000', 'mudou o endereço: o por extenso acompanha');
select throws_ok($$ update public.clientes set cep = '3011' where id = 'e8300000-0000-0000-0000-00000000000a' $$, '23514', null, 'CEP precisa de 8 números');
select throws_ok($$ update public.clientes set segmentos = '{atacado}' where id = 'e8300000-0000-0000-0000-00000000000a' $$, '23514', null, 'segmento desconhecido é recusado');
select throws_ok($$ update public.clientes set uf = 'XX' where id = 'e8300000-0000-0000-0000-00000000000a' $$, '23514', null, 'UF nova fora da lista é recusada');
select ok(not has_function_privilege('anon', 'public.salvar_ficha_cliente(uuid, jsonb)', 'execute'), 'visitante não salva ficha');
select ok(not has_function_privilege('authenticated', 'public.copiar_endereco_para_logradouro()', 'execute'), 'a cópia é só da migração');

-- 14–16: Ana ("Só ver") não grava nada, nem pela função
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e8100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.salvar_ficha_cliente(null, '{"razao_social":"X Ltda","cnpj":"12345678000195"}') $$,
  'P0001', 'Você não tem permissão para editar clientes.', '"Só ver" não salva a ficha (D14)');
select throws_ok($$ insert into public.cliente_inscricoes_st (cliente_id, uf, inscricao) values ('e8300000-0000-0000-0000-00000000000a', 'SP', '1') $$,
  '42501', null, '"Só ver" não grava inscrição ST');
select is(public.ultima_alteracao_cliente('e8300000-0000-0000-0000-00000000000a'), null, 'mudança sem pessoa (migração, testes) não conta');

-- 17–21: Bia ("Ver e editar") cria a ficha completa numa chamada
select set_config('request.jwt.claims', '{"sub":"e8100000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_ficha_cliente(null, '{
  "razao_social": "H1 Padaria Sol Comércio de Alimentos ME", "nome_fantasia": "H1 Padaria Sol", "cnpj": "12345678000195",
  "tipo_pessoa": "juridica", "isento_ie": false, "inscricao_estadual": "0037486930064", "regime": "Simples Nacional", "porte": "me",
  "faturamento_ultimo_ano": 820000, "funcionarios": 8, "segmentos": ["industria", "comercio"],
  "cep": "36404450", "logradouro": "Rua Rosa Figueiredo", "numero": "430", "complemento": "loja 2", "bairro": "São Marcos",
  "cidade": "Conselheiro Lafaiete", "uf": "MG", "telefone": "31987800133", "email": "contato@padariasol.com.br",
  "email_cobranca": "financeiro@padariasol.com.br", "contrato_inicio": "2022-03-01", "honorario_mensal": 1250, "dia_vencimento": 10,
  "reajuste": "anual", "reajuste_mes": 3, "decimo_terceiro": true, "certificado_tipo": "e_cnpj_a1", "certificado_vencimento": "2030-10-25",
  "certificado_avisar_dias": 30, "servicos": ["e8200000-0000-0000-0000-000000000001"],
  "responsaveis": {"e8400000-0000-0000-0000-000000000001": "e8100000-0000-0000-0000-00000000000b"},
  "inscricoes_st": [{"uf": "SP", "inscricao": "123456789110"}, {"uf": "rj", "inscricao": null}]}') $$,
  'Bia cria a ficha completa numa chamada');
select results_eq(
  $$ select razao_social, honorario_mensal, segmentos, contrato_inicio, reajuste, reajuste_mes, decimo_terceiro, certificado_tipo, email_cobranca
     from public.clientes where cnpj = '12345678000195' $$,
  $$ values ('H1 Padaria Sol Comércio de Alimentos ME'::text, 1250.00::numeric(12, 2), '{comercio,industria}'::text[], '2022-03-01'::date,
             'anual'::text, 3::smallint, true, 'e_cnpj_a1'::text, 'financeiro@padariasol.com.br'::text) $$,
  'campos novos gravados (segmentos em ordem, sem repetir)');
select is((select endereco from public.clientes where cnpj = '12345678000195'),
  'Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450', 'o agente lê o endereço por extenso');
select results_eq(
  $$ select uf::text, inscricao from public.cliente_inscricoes_st
     where cliente_id = (select id from public.clientes where cnpj = '12345678000195') order by uf $$,
  $$ values ('RJ'::text, null::text), ('SP'::text, '123456789110'::text) $$,
  'inscrições ST: UF em maiúsculas; linha sem inscrição fica (vira pendência na tela)');
select results_eq(
  $$ select (select count(*)::int from public.cliente_servicos where cliente_id = c.id),
            (select usuario_id from public.cliente_responsaveis where cliente_id = c.id and setor_id = 'e8400000-0000-0000-0000-000000000001')
     from public.clientes c where c.cnpj = '12345678000195' $$,
  $$ values (1, 'e8100000-0000-0000-0000-00000000000b'::uuid) $$,
  'serviços e responsáveis na mesma chamada');

-- 22–25: salvar de novo troca as listas; a pausa do agente só muda quando vem; UF repetida e razão vazia recusam
reset role;
update public.clientes set agente_pausado = true where cnpj = '12345678000195';
set local role authenticated;
select lives_ok($$ select public.salvar_ficha_cliente((select id from public.clientes where cnpj = '12345678000195'), '{
  "razao_social": "H1 Padaria Sol Comércio de Alimentos ME", "cnpj": "12345678000195", "segmentos": ["comercio"],
  "servicos": [], "responsaveis": {"e8400000-0000-0000-0000-000000000001": null},
  "inscricoes_st": [{"uf": "SP", "inscricao": "123456789110"}]}') $$,
  'Bia salva de novo, sem serviços, sem responsável e só SP');
select results_eq(
  $$ select (select count(*)::int from public.cliente_inscricoes_st where cliente_id = c.id),
            (select count(*)::int from public.cliente_servicos where cliente_id = c.id),
            (select count(*)::int from public.cliente_responsaveis where cliente_id = c.id),
            c.agente_pausado
     from public.clientes c where c.cnpj = '12345678000195' $$,
  $$ values (1, 0, 0, true) $$,
  'as listas trocam inteiras; sem a chave agente_pausado, a pausa fica como estava (D14)');
select throws_ok($$ select public.salvar_ficha_cliente(null, '{"razao_social":"H1 Repetida","cnpj":"17170000000132",
  "inscricoes_st":[{"uf":"SP","inscricao":"1"},{"uf":"sp","inscricao":"2"}]}') $$,
  'P0001', 'UF repetida nas inscrições de substituto tributário.', 'UF repetida recusa a ficha inteira');
select throws_ok($$ select public.salvar_ficha_cliente(null, '{"razao_social":" ","cnpj":"17170000000132"}') $$,
  'P0001', 'Informe a razão social.', 'razão social continua obrigatória (D9)');

-- 26–27: última alteração (só nome e hora) para quem vê a ficha
select set_config('request.jwt.claims', '{"sub":"e8100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.ultima_alteracao_cliente((select id from public.clientes where cnpj = '12345678000195')) ->> 'pessoa', 'Bia H1',
  'Ana ("Só ver") lê quem mudou por último');
reset role;
select ok(not has_function_privilege('anon', 'public.ultima_alteracao_cliente(uuid)', 'execute'), 'visitante não lê a última alteração');

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db supabase/tests/39_painel_v2_ficha_cliente.test.sql`
Expected: FAIL (`relation "public.cliente_inscricoes_st" does not exist` / `function public.copiar_endereco_para_logradouro() does not exist`).

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261012000100_painel_v2_ficha_cliente.sql`:

```sql
-- supabase/migrations/20261012000100_painel_v2_ficha_cliente.sql
-- Painel v2, Parte H1 (spec 7D.1): ficha completa do cliente. Só acrescenta: nenhuma coluna sai, nenhum dado é apagado
-- nem reescrito. Toda coluna nova aceita vazio (clientes antigos e testes têm só razão social e CNPJ, D10).

alter table public.clientes
  add column tipo_pessoa text not null default 'juridica' check (tipo_pessoa in ('juridica', 'fisica')),
  add column inscricao_municipal text,
  add column inscricao_suframa text,
  add column isento_ie boolean not null default false,
  add column cnae_principal text,
  add column porte text check (porte in ('mei', 'me', 'epp', 'demais')),
  add column faturamento_ultimo_ano numeric(14, 2) check (faturamento_ultimo_ano >= 0),
  add column funcionarios int check (funcionarios >= 0),
  add column segmentos text[] not null default '{}' check (segmentos <@ array['comercio', 'ecommerce', 'industria', 'servicos']),
  add column cep text check (cep ~ '^\d{8}$'),
  add column logradouro text,
  add column numero text,
  add column complemento text,
  add column bairro text,
  add column cidade text,
  add column telefone text check (telefone ~ '^\d{10,13}$'),
  add column celular text check (celular ~ '^\d{10,13}$'),
  add column email text check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column email_cobranca text check (email_cobranca ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  add column site text,
  add column contrato_inicio date,
  add column contrato_fim date,
  add column honorario_mensal numeric(12, 2) check (honorario_mensal >= 0),
  add column dia_vencimento smallint check (dia_vencimento between 1 and 31),
  add column reajuste text check (reajuste in ('sem', 'anual', 'semestral')),
  add column reajuste_mes smallint check (reajuste_mes between 1 and 12),
  add column decimo_terceiro boolean,
  add column certificado_tipo text check (certificado_tipo in ('e_cnpj_a1', 'e_cnpj_a3', 'e_cpf_a1', 'e_cpf_a3', 'sem')),
  add column certificado_vencimento date,
  add column certificado_avisar_dias smallint not null default 30 check (certificado_avisar_dias between 1 and 180),
  add constraint clientes_contrato_datas check (contrato_fim is null or contrato_inicio is null or contrato_fim >= contrato_inicio);

-- UF de hoje é texto livre de duas letras: a checagem vale para o que for gravado daqui em diante (NOT VALID, D10).
alter table public.clientes add constraint clientes_uf_valida check (uf in (
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR',
  'SC', 'SP', 'SE', 'TO')) not valid;

-- ---------- Inscrições de substituto tributário (UF + inscrição; linha sem inscrição é pendência na tela) ----------

create table public.cliente_inscricoes_st (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  uf char(2) not null check (uf in (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR',
    'SC', 'SP', 'SE', 'TO')),
  inscricao text check (inscricao is null or char_length(inscricao) between 1 and 30),
  primary key (cliente_id, uf)
);
alter table public.cliente_inscricoes_st enable row level security;
-- Mesmas regras de cliente_servicos (base + 20260928000400): ler ativo; gravar e desfazer com editar_clientes.
create policy leitura on public.cliente_inscricoes_st for select to authenticated using (public.eh_usuario_ativo());
create policy inserir on public.cliente_inscricoes_st for insert to authenticated with check (public.tem_permissao('editar_clientes'));
create policy alterar on public.cliente_inscricoes_st for update to authenticated
  using (public.tem_permissao('editar_clientes')) with check (public.tem_permissao('editar_clientes'));
create policy excluir on public.cliente_inscricoes_st for delete to authenticated using (public.tem_permissao('editar_clientes'));
create trigger auditoria after insert or update or delete on public.cliente_inscricoes_st
  for each row execute function public.registrar_auditoria();

-- ---------- Endereço: o antigo vai para Logradouro; endereco vira o por extenso (D11, D12) ----------

-- "Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450"; partes vazias somem.
create function public.montar_endereco(p_logradouro text, p_numero text, p_complemento text, p_bairro text, p_cidade text,
                                       p_uf text, p_cep text) returns text
language sql immutable set search_path = '' as $$
  select concat_ws(', ',
    nullif(concat_ws(' - ', nullif(concat_ws(', ', p_logradouro, p_numero, p_complemento), ''), p_bairro), ''),
    case when p_cidade is not null then p_cidade || coalesce('/' || btrim(p_uf), '') end,
    case when p_cep is not null then 'CEP ' || substr(p_cep, 1, 5) || '-' || substr(p_cep, 6) end)
$$;

-- Só quem não tem logradouro; o endereco antigo fica como estava. A migração chama uma vez (o teste 39 chama de novo).
create function public.copiar_endereco_para_logradouro() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  update public.clientes set logradouro = btrim(endereco)
  where logradouro is null and nullif(btrim(endereco), '') is not null;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.copiar_endereco_para_logradouro() from public, anon, authenticated, service_role;

do $$
begin
  raise notice 'Parte H1: % cliente(s) com o endereço antigo copiado para Logradouro (o endereço antigo continua guardado).',
    public.copiar_endereco_para_logradouro();
end $$;

-- Depois da cópia: com logradouro, endereco (o que o agente lê em consultar_cadastro) acompanha os campos novos.
create function public.clientes_endereco_por_extenso() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.logradouro is not null then
    new.endereco := public.montar_endereco(new.logradouro, new.numero, new.complemento, new.bairro, new.cidade, new.uf, new.cep);
  end if;
  return new;
end $$;
create trigger endereco_por_extenso before insert or update of logradouro, numero, complemento, bairro, cidade, uf, cep
  on public.clientes for each row execute function public.clientes_endereco_por_extenso();

-- ---------- Salvar a aba inteira numa transação (D13, D14) ----------

create function public.texto_da_ficha(p jsonb, k text) returns text
language sql immutable set search_path = '' as $$ select nullif(btrim(p ->> k), '') $$;

-- Roda com a regra de quem chama (a RLS de hoje vale); a permissão é conferida por escrito para um UPDATE barrado
-- pela RLS não passar calado. Listas (serviços, inscrições ST) trocam inteiras; responsáveis só nos setores enviados.
create function public.salvar_ficha_cliente(p_id uuid, p_dados jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_razao text := btrim(coalesce(p_dados ->> 'razao_social', ''));
  v_isento boolean := coalesce((p_dados ->> 'isento_ie')::boolean, false);
  v_st jsonb := coalesce(nullif(p_dados -> 'inscricoes_st', 'null'::jsonb), '[]'::jsonb);
  v_servicos uuid[] := coalesce((select array_agg(x::uuid)
    from jsonb_array_elements_text(coalesce(nullif(p_dados -> 'servicos', 'null'::jsonb), '[]'::jsonb)) x), '{}');
  r record;
begin
  if not public.tem_permissao('editar_clientes') then raise exception 'Você não tem permissão para editar clientes.'; end if;
  if char_length(v_razao) < 2 then raise exception 'Informe a razão social.'; end if;
  if (select count(*) <> count(distinct upper(e ->> 'uf')) from jsonb_array_elements(v_st) e) then
    raise exception 'UF repetida nas inscrições de substituto tributário.';
  end if;

  if v_id is null then
    insert into public.clientes (razao_social, cnpj) values (v_razao, p_dados ->> 'cnpj') returning id into v_id;
  elsif not exists (select 1 from public.clientes where id = v_id) then
    raise exception 'Cliente não encontrado.';
  end if;

  update public.clientes set
    razao_social = v_razao,
    nome_fantasia = public.texto_da_ficha(p_dados, 'nome_fantasia'),
    cnpj = p_dados ->> 'cnpj',
    tipo_pessoa = coalesce(public.texto_da_ficha(p_dados, 'tipo_pessoa'), 'juridica'),
    isento_ie = v_isento,
    inscricao_estadual = case when v_isento then null else public.texto_da_ficha(p_dados, 'inscricao_estadual') end,
    inscricao_municipal = public.texto_da_ficha(p_dados, 'inscricao_municipal'),
    cnae_principal = public.texto_da_ficha(p_dados, 'cnae_principal'),
    inscricao_suframa = public.texto_da_ficha(p_dados, 'inscricao_suframa'),
    regime = public.texto_da_ficha(p_dados, 'regime'),
    porte = public.texto_da_ficha(p_dados, 'porte'),
    faturamento_ultimo_ano = public.texto_da_ficha(p_dados, 'faturamento_ultimo_ano')::numeric,
    funcionarios = public.texto_da_ficha(p_dados, 'funcionarios')::int,
    segmentos = coalesce((select array_agg(distinct s order by s)
      from jsonb_array_elements_text(coalesce(nullif(p_dados -> 'segmentos', 'null'::jsonb), '[]'::jsonb)) s), '{}'),
    cep = public.texto_da_ficha(p_dados, 'cep'),
    logradouro = public.texto_da_ficha(p_dados, 'logradouro'),
    numero = public.texto_da_ficha(p_dados, 'numero'),
    complemento = public.texto_da_ficha(p_dados, 'complemento'),
    bairro = public.texto_da_ficha(p_dados, 'bairro'),
    cidade = public.texto_da_ficha(p_dados, 'cidade'),
    uf = upper(public.texto_da_ficha(p_dados, 'uf')),
    telefone = public.texto_da_ficha(p_dados, 'telefone'),
    celular = public.texto_da_ficha(p_dados, 'celular'),
    email = public.texto_da_ficha(p_dados, 'email'),
    email_cobranca = public.texto_da_ficha(p_dados, 'email_cobranca'),
    site = public.texto_da_ficha(p_dados, 'site'),
    contrato_inicio = public.texto_da_ficha(p_dados, 'contrato_inicio')::date,
    contrato_fim = public.texto_da_ficha(p_dados, 'contrato_fim')::date,
    honorario_mensal = public.texto_da_ficha(p_dados, 'honorario_mensal')::numeric,
    dia_vencimento = public.texto_da_ficha(p_dados, 'dia_vencimento')::smallint,
    reajuste = public.texto_da_ficha(p_dados, 'reajuste'),
    reajuste_mes = public.texto_da_ficha(p_dados, 'reajuste_mes')::smallint,
    decimo_terceiro = (p_dados ->> 'decimo_terceiro')::boolean,
    certificado_tipo = public.texto_da_ficha(p_dados, 'certificado_tipo'),
    certificado_vencimento = public.texto_da_ficha(p_dados, 'certificado_vencimento')::date,
    certificado_avisar_dias = coalesce(public.texto_da_ficha(p_dados, 'certificado_avisar_dias')::smallint, 30),
    agente_pausado = case when p_dados ? 'agente_pausado'
                          then coalesce((p_dados ->> 'agente_pausado')::boolean, false) else agente_pausado end
  where id = v_id;

  delete from public.cliente_inscricoes_st s
  where s.cliente_id = v_id and not exists (select 1 from jsonb_array_elements(v_st) e where upper(e ->> 'uf') = s.uf::text);
  insert into public.cliente_inscricoes_st as s (cliente_id, uf, inscricao)
  select v_id, upper(e ->> 'uf'), nullif(btrim(e ->> 'inscricao'), '') from jsonb_array_elements(v_st) e
  on conflict (cliente_id, uf) do update set inscricao = excluded.inscricao where s.inscricao is distinct from excluded.inscricao;

  delete from public.cliente_servicos where cliente_id = v_id and not (servico_id = any (v_servicos));
  insert into public.cliente_servicos (cliente_id, servico_id)
  select distinct v_id, x from unnest(v_servicos) x
  where not exists (select 1 from public.cliente_servicos where cliente_id = v_id and servico_id = x);

  for r in select key, nullif(value, '') as usuario
           from jsonb_each_text(coalesce(nullif(p_dados -> 'responsaveis', 'null'::jsonb), '{}'::jsonb)) loop
    if r.usuario is null then
      delete from public.cliente_responsaveis where cliente_id = v_id and setor_id = r.key::uuid;
    else
      insert into public.cliente_responsaveis as cr (cliente_id, setor_id, usuario_id) values (v_id, r.key::uuid, r.usuario::uuid)
      on conflict (cliente_id, setor_id) do update set usuario_id = excluded.usuario_id where cr.usuario_id is distinct from excluded.usuario_id;
    end if;
  end loop;

  return v_id;
end $$;
revoke execute on function public.salvar_ficha_cliente(uuid, jsonb) from public, anon;
grant execute on function public.salvar_ficha_cliente(uuid, jsonb) to authenticated;

-- ---------- Rodapé "Última alteração" (D24): só nome e hora, só mudanças feitas por pessoas ----------

create index if not exists auditoria_acessos_entidade_idx on public.auditoria_acessos (entidade, entidade_id, criado_em desc);

create function public.ultima_alteracao_cliente(p_cliente uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when public.eh_usuario_ativo() then (
    select jsonb_build_object('pessoa', u.nome, 'quando', a.criado_em)
    from public.auditoria_acessos a
    join public.usuarios u on u.id = a.usuario_id
    where a.usuario_id is not null
      and ((a.entidade in ('clientes', 'cliente_servicos', 'cliente_responsaveis', 'cliente_inscricoes_st')
            and a.entidade_id = p_cliente::text)
           -- Acessos de portais (Task 2): cadastrar e remover contam; revelar e copiar não são alteração.
           or (a.entidade = 'cliente_acessos' and a.acao in ('salvar_acesso', 'remover_acesso')
               and a.detalhes ->> 'cliente_id' = p_cliente::text))
    order by a.criado_em desc
    limit 1) end
$$;
revoke execute on function public.ultima_alteracao_cliente(uuid) from public, anon;
grant execute on function public.ultima_alteracao_cliente(uuid) to authenticated;
```

- [ ] **Passo 4: rodar e ver passar**

Run: `supabase db reset && supabase test db supabase/tests/39_painel_v2_ficha_cliente.test.sql`
Expected: `39_painel_v2_ficha_cliente.test.sql .. ok` (27/27). Se `results_eq` reclamar de tipo, confira o `::smallint`/`::numeric(12, 2)` da linha esperada (não mude a migração para casar com o teste).

- [ ] **Passo 5: regressão, tipos e typecheck**

Run: `supabase test db && pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: todos os arquivos `ok`, `22_regressao_visibilidade` 100/100 e `23_painel_v2_niveis` iguais a `$SCRATCH/regressao-antes.txt`, `Result: PASS`; `git diff --stat packages/db/src/tipos.gen.ts` mostra `cliente_inscricoes_st`, `salvar_ficha_cliente`, `ultima_alteracao_cliente` e as colunas novas de `clientes`; os três typecheck verdes.

- [ ] **Passo 6: devolver portas e commit**

Devolva `supabase/config.toml` e `.env` das cópias (Restrições globais, item 6) e confira `git status`.

```bash
git add supabase/migrations/20261012000100_painel_v2_ficha_cliente.sql supabase/tests/39_painel_v2_ficha_cliente.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(banco): ficha completa do cliente — colunas novas, inscrições ST, endereço antigo copiado sem sobrescrever e salvar a aba numa transação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Banco. Acessos de portais (cifra só pela função, permissão nova, auditoria)

**Files:**
- Create: `supabase/migrations/20261012000200_painel_v2_acessos_portais.sql`
- Create: `supabase/tests/40_painel_v2_acessos_portais.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `usuarios`, `clientes`, `auditoria_acessos`, `eh_admin()`, `eh_usuario_ativo()`, `tem_permissao(text)`, `ultima_alteracao_cliente` (Task 1, já lê as linhas `salvar_acesso`/`remover_acesso`).
- Produces:
  - `usuarios.ver_acessos_portais boolean not null default false`;
  - `pode_ver_acessos() returns boolean` (admin; ou pessoa ativa, no horário, com a marcação);
  - `definir_ver_acessos(p_usuario uuid, p_pode boolean) returns void` (só admin);
  - tabela `cliente_acessos(id, cliente_id, portal, usuario, senha_cifrada, tem_senha (gerada), atualizado_por, atualizado_em)`, leitura **por coluna** sem `senha_cifrada` (D2);
  - `salvar_acesso(p_id uuid, p_cliente uuid, p_portal text, p_usuario text, p_senha_cifrada text) returns uuid` (nulo = mantém a senha; `''` = sem senha);
  - `remover_acesso(p_id uuid) returns void`;
  - `revelar_acesso(p_id uuid, p_acao text default 'revelar') returns jsonb` (`{cliente_id, senha_cifrada}`; `p_acao` em `revelar|copiar`).

- [ ] **Passo 0: registrar o que o banco local oferece (evidência para D1)**

Com o banco local ligado: `psql "$DATABASE_URL" -c "select extname, extversion from pg_extension where extname in ('supabase_vault', 'pgsodium', 'pgcrypto') order by 1" | tee "$SCRATCH/cripto-local.txt"` e `psql "$DATABASE_URL" -c "select to_regclass('vault.decrypted_secrets') is not null as tem_vault" | tee -a "$SCRATCH/cripto-local.txt"` (o `DATABASE_URL` do `.env` **local**). Guarde a saída para o relatório da Entrega. A decisão D1 não muda com o resultado.

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/40_painel_v2_acessos_portais.test.sql`:

```sql
-- Parte H1, Task 2 (spec 7D.1 item 8 e 7D.3): a cifra da senha nunca é lida sem a permissão, nem pela chave de serviço;
-- cada revelação (e cada cópia) grava auditoria sem o segredo; cadastrar exige "Ver e editar" e "Ver acessos de portais".
begin;
create extension if not exists pgtap with schema extensions;
select plan(34);

insert into auth.users (id, email) values
  ('e9100000-0000-0000-0000-00000000000a', 'admin@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000b', 'bia@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000c', 'ze@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000d', 'duda@h1b.local'),
  ('e9100000-0000-0000-0000-00000000000e', 'ex@h1b.local');
insert into public.usuarios (id, nome, email, papel, permissoes) values
  ('e9100000-0000-0000-0000-00000000000a', 'Admin H1B', 'admin@h1b.local', 'admin', '{}'),
  ('e9100000-0000-0000-0000-00000000000b', 'Bia H1B', 'bia@h1b.local', 'atendente', '{editar_clientes}'),
  ('e9100000-0000-0000-0000-00000000000c', 'Zé H1B', 'ze@h1b.local', 'atendente', '{}'),
  ('e9100000-0000-0000-0000-00000000000d', 'Duda H1B', 'duda@h1b.local', 'atendente', '{editar_clientes}'),
  ('e9100000-0000-0000-0000-00000000000e', 'Ex H1B', 'ex@h1b.local', 'atendente', '{}');
update public.usuarios set ver_acessos_portais = true
 where id in ('e9100000-0000-0000-0000-00000000000c', 'e9100000-0000-0000-0000-00000000000d', 'e9100000-0000-0000-0000-00000000000e');
update public.usuarios set ativo = false where id = 'e9100000-0000-0000-0000-00000000000e';
insert into public.clientes (id, razao_social, cnpj) values ('e9300000-0000-0000-0000-00000000000a', 'H1B Padaria Ltda', '11222333000181');
-- Cifra de mentira no formato do painel (o banco nunca decifra; D1).
insert into public.cliente_acessos (id, cliente_id, portal, usuario, senha_cifrada) values
  ('e9400000-0000-0000-0000-000000000001', 'e9300000-0000-0000-0000-00000000000a', 'SEFAZ-MG', 'padariasol',
   'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.c2VncmVkbw');

-- 1–8: privilégios (D2)
select ok(not has_column_privilege('authenticated', 'public.cliente_acessos', 'senha_cifrada', 'select'), 'a equipe não lê a cifra');
select ok(not has_column_privilege('anon', 'public.cliente_acessos', 'senha_cifrada', 'select'), 'visitante não lê a cifra');
select ok(not has_column_privilege('service_role', 'public.cliente_acessos', 'senha_cifrada', 'select'),
  'nem a chave de serviço (trabalhador, agente, assistente) lê a cifra');
select ok(has_column_privilege('authenticated', 'public.cliente_acessos', 'tem_senha', 'select'), 'a equipe vê se tem senha');
select ok(not has_table_privilege('authenticated', 'public.cliente_acessos', 'insert'), 'escrita só pelas funções');
select ok(not has_function_privilege('service_role', 'public.revelar_acesso(uuid, text)', 'execute'), 'o trabalhador não revela');
select ok(not has_function_privilege('anon', 'public.revelar_acesso(uuid, text)', 'execute'), 'visitante não revela');
select throws_ok(
  $$ insert into public.cliente_acessos (cliente_id, portal, senha_cifrada) values ('e9300000-0000-0000-0000-00000000000a', 'Prefeitura', 'minhasenha123') $$,
  '23514', null, 'texto puro na coluna é recusado');

-- 9–13: Bia ("Ver e editar", sem a permissão)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$ select senha_cifrada from public.cliente_acessos $$, '42501', null, 'Bia: pedir a cifra é recusado');
select results_eq(
  $$ select portal, usuario, tem_senha from public.cliente_acessos where cliente_id = 'e9300000-0000-0000-0000-00000000000a' $$,
  $$ values ('SEFAZ-MG'::text, 'padariasol'::text, true) $$, 'Bia vê portal, usuário e que tem senha (D7)');
select is(public.pode_ver_acessos(), false, 'Bia: sem a permissão');
select throws_ok($$ select public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'revelar') $$,
  'P0001', 'Sem permissão para ver acessos de portais.', 'Bia não revela');
select throws_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'Prefeitura', 'x', null) $$,
  'P0001', 'Sem permissão para mudar acessos de portais.', 'Bia não cadastra acesso (D6)');

-- 14–17: Zé (só "Ver acessos de portais")
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.pode_ver_acessos(), true, 'Zé: com a permissão');
select is(public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'revelar') ->> 'senha_cifrada',
  'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.c2VncmVkbw', 'Zé revela (a cifra vai para o painel decifrar)');
select is(public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'copiar') ->> 'cliente_id',
  'e9300000-0000-0000-0000-00000000000a', 'copiar passa pela mesma função (D5)');
select throws_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'Prefeitura', 'x', null) $$,
  'P0001', 'Sem permissão para mudar acessos de portais.', 'Zé não cadastra sem "Ver e editar" (D6)');

-- 18: a auditoria das revelações (Bia, recusada, não deixou linha)
reset role;
select results_eq(
  $$ select acao, usuario_id, detalhes ->> 'portal', detalhes ->> 'cliente_id' from public.auditoria_acessos
     where entidade = 'cliente_acessos' and entidade_id = 'e9400000-0000-0000-0000-000000000001' order by acao desc $$,
  $$ values ('revelar_acesso'::text, 'e9100000-0000-0000-0000-00000000000c'::uuid, 'SEFAZ-MG'::text, 'e9300000-0000-0000-0000-00000000000a'::text),
            ('copiar_acesso'::text, 'e9100000-0000-0000-0000-00000000000c'::uuid, 'SEFAZ-MG'::text, 'e9300000-0000-0000-0000-00000000000a'::text) $$,
  'cada revelação e cada cópia na auditoria: quem, empresa e portal');

-- 19–26: Duda ("Ver e editar" + permissão) cadastra, edita sem senha, grava "sem senha" e remove
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
select lives_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'Prefeitura (NFS-e)', '12345678000190',
  'v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDDDDDDDD.b3V0cmE') $$, 'Duda cadastra acesso');
select lives_ok($$ select public.salvar_acesso('e9400000-0000-0000-0000-000000000001', 'e9300000-0000-0000-0000-00000000000a',
  'SEFAZ-MG', 'novo-usuario', null) $$, 'Duda edita sem mandar senha');
select lives_ok($$ select public.salvar_acesso(null, 'e9300000-0000-0000-0000-00000000000a', 'e-CAC', 'via certificado', '') $$,
  '"Sem senha" grava sem senha');
reset role;
select results_eq(
  $$ select portal, usuario, senha_cifrada from public.cliente_acessos
     where cliente_id = 'e9300000-0000-0000-0000-00000000000a' order by portal collate "C" $$,
  $$ values ('Prefeitura (NFS-e)'::text, '12345678000190'::text, 'v1.CCCCCCCCCCCCCCCC.DDDDDDDDDDDDDDDDDDDDDD.b3V0cmE'::text),
            ('SEFAZ-MG'::text, 'novo-usuario'::text, 'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.c2VncmVkbw'::text),
            ('e-CAC'::text, 'via certificado'::text, null::text) $$,
  'editar sem senha mantém a cifra; "sem senha" fica vazio');
set local role authenticated;
select lives_ok($$ select public.remover_acesso((select id from public.cliente_acessos where portal = 'e-CAC')) $$, 'Duda remove');
reset role;
select is((select count(*)::int from public.cliente_acessos where portal = 'e-CAC'), 0, 'removido');
select is((select array_agg(acao order by acao) from public.auditoria_acessos
           where entidade = 'cliente_acessos' and usuario_id = 'e9100000-0000-0000-0000-00000000000d'),
  array['remover_acesso', 'salvar_acesso', 'salvar_acesso', 'salvar_acesso'], 'cadastrar e remover também na auditoria');
select ok(not exists (select 1 from public.auditoria_acessos where detalhes::text like '%v1.%' or detalhes::text like '%senha_cifrada%'),
  'nenhuma linha da auditoria guarda a cifra');

-- 27: última alteração conta acessos cadastrados e removidos; revelar não conta
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select is(public.ultima_alteracao_cliente('e9300000-0000-0000-0000-00000000000a') ->> 'pessoa', 'Duda H1B',
  'última alteração: quem mudou acessos (revelar do Zé não conta)');

-- 28: arquivada não revela, mesmo com a marcação
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000e","role":"authenticated"}', true);
select throws_ok($$ select public.revelar_acesso('e9400000-0000-0000-0000-000000000001', 'revelar') $$,
  'P0001', 'Sem permissão para ver acessos de portais.', 'pessoa arquivada não revela');

-- 29–33: o administrador sempre vê e é quem dá a permissão (D3)
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is(public.pode_ver_acessos(), true, 'administrador sempre vê');
select lives_ok($$ select public.definir_ver_acessos('e9100000-0000-0000-0000-00000000000b', true) $$, 'admin dá a permissão à Bia');
select set_config('request.jwt.claims', '{"sub":"e9100000-0000-0000-0000-00000000000c","role":"authenticated"}', true);
select throws_ok($$ select public.definir_ver_acessos('e9100000-0000-0000-0000-00000000000b', false) $$,
  'P0001', 'Só o administrador muda pessoas.', 'só o administrador dá ou tira a permissão');
reset role;
select is((select ver_acessos_portais from public.usuarios where id = 'e9100000-0000-0000-0000-00000000000b'), true, 'Bia agora tem a permissão');
select ok(exists (select 1 from public.auditoria_acessos where entidade = 'usuarios' and acao = 'update'
                  and entidade_id = 'e9100000-0000-0000-0000-00000000000b' and usuario_id = 'e9100000-0000-0000-0000-00000000000a'),
  'quem deu a permissão fica na auditoria');

-- 34: excluir a empresa (Parte B) leva os acessos junto
delete from public.clientes where id = 'e9300000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.cliente_acessos where cliente_id = 'e9300000-0000-0000-0000-00000000000a'), 0,
  'excluir a empresa leva os acessos');

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db supabase/tests/40_painel_v2_acessos_portais.test.sql`
Expected: FAIL (`column "ver_acessos_portais" of relation "usuarios" does not exist`).

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261012000200_painel_v2_acessos_portais.sql`:

```sql
-- supabase/migrations/20261012000200_painel_v2_acessos_portais.sql
-- Painel v2, Parte H1 (spec 7D.1 item 8): acessos de portais. A senha é cifrada no servidor do painel (AES-256-GCM, chave
-- fora do banco, D1); aqui só se guarda o texto cifrado, que nenhum papel lê direto (nem a chave de serviço, D2):
-- sai só por revelar_acesso, que confere a permissão e grava a auditoria antes de devolver.

-- ---------- Permissão "Ver acessos de portais" (à parte dos módulos de nível, D3) ----------

alter table public.usuarios add column ver_acessos_portais boolean not null default false;

-- Administrador sempre; os outros, ativos e no horário (eh_usuario_ativo), com a marcação.
create function public.pode_ver_acessos() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.eh_admin()
      or (public.eh_usuario_ativo() and exists (select 1 from public.usuarios where id = auth.uid() and ver_acessos_portais))
$$;
revoke execute on function public.pode_ver_acessos() from public, anon;
grant execute on function public.pode_ver_acessos() to authenticated;

-- Só o administrador dá ou tira; a auditoria de usuarios registra quem e quando (antes/depois).
create function public.definir_ver_acessos(p_usuario uuid, p_pode boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.eh_admin() then raise exception 'Só o administrador muda pessoas.'; end if;
  update public.usuarios set ver_acessos_portais = coalesce(p_pode, false) where id = p_usuario and ativo;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
end $$;
revoke execute on function public.definir_ver_acessos(uuid, boolean) from public, anon, service_role;
grant execute on function public.definir_ver_acessos(uuid, boolean) to authenticated;

-- ---------- Acessos ----------

create table public.cliente_acessos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  portal text not null check (char_length(btrim(portal)) between 1 and 80),
  usuario text check (usuario is null or char_length(usuario) <= 120),
  -- Formato do painel (lib/cofre.ts): v1.<iv 12 bytes>.<etiqueta 16 bytes>.<cifra>, em base64url. Texto puro não entra.
  senha_cifrada text check (senha_cifrada ~ '^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$'),
  tem_senha boolean generated always as (senha_cifrada is not null) stored,
  atualizado_por uuid references public.usuarios (id) on delete set null,
  atualizado_em timestamptz not null default now()
);
create index cliente_acessos_cliente_idx on public.cliente_acessos (cliente_id, portal);
alter table public.cliente_acessos enable row level security;
create policy leitura on public.cliente_acessos for select to authenticated using (public.eh_usuario_ativo());
-- Leitura por coluna: a cifra fica de fora para todos os papéis da API, inclusive a chave de serviço (D2).
-- Sem auditoria genérica aqui: ela copiaria a linha inteira (com a cifra) para auditoria_acessos.
revoke all on public.cliente_acessos from public, anon, authenticated, service_role;
grant select (id, cliente_id, portal, usuario, tem_senha, atualizado_por, atualizado_em) on public.cliente_acessos
  to authenticated, service_role;

-- Cadastrar ou editar. p_senha_cifrada: nulo = mantém a atual; '' = sem senha (ex.: e-CAC pelo certificado).
create function public.salvar_acesso(p_id uuid, p_cliente uuid, p_portal text, p_usuario text, p_senha_cifrada text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
  v_portal text := btrim(coalesce(p_portal, ''));
  v_senha text := nullif(p_senha_cifrada, '');
begin
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
  if char_length(v_portal) not between 1 and 80 then raise exception 'Informe o portal.'; end if;
  if v_id is null then
    if not exists (select 1 from public.clientes where id = p_cliente) then raise exception 'Cliente não encontrado.'; end if;
    insert into public.cliente_acessos (cliente_id, portal, usuario, senha_cifrada, atualizado_por)
    values (p_cliente, v_portal, nullif(btrim(p_usuario), ''), v_senha, auth.uid())
    returning id into v_id;
  else
    update public.cliente_acessos
    set portal = v_portal, usuario = nullif(btrim(p_usuario), ''),
        senha_cifrada = case when p_senha_cifrada = '' then null else coalesce(v_senha, senha_cifrada) end,
        atualizado_por = auth.uid(), atualizado_em = now()
    where id = v_id and cliente_id = p_cliente;
    if not found then raise exception 'Acesso não encontrado.'; end if;
  end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'salvar_acesso', 'cliente_acessos', v_id::text,
          jsonb_build_object('cliente_id', p_cliente, 'portal', v_portal, 'senha_trocada', p_senha_cifrada is not null));
  return v_id;
end $$;

create function public.remover_acesso(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v public.cliente_acessos%rowtype;
begin
  if not (public.tem_permissao('editar_clientes') and public.pode_ver_acessos()) then
    raise exception 'Sem permissão para mudar acessos de portais.';
  end if;
  delete from public.cliente_acessos where id = p_id returning * into v;
  if v.id is null then raise exception 'Acesso não encontrado.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), 'remover_acesso', 'cliente_acessos', v.id::text, jsonb_build_object('cliente_id', v.cliente_id, 'portal', v.portal));
end $$;

-- Única saída da cifra: confere a permissão, grava a auditoria (quem, quando, empresa, portal; nunca o segredo) e devolve.
create function public.revelar_acesso(p_id uuid, p_acao text default 'revelar') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.cliente_acessos%rowtype;
begin
  if not public.pode_ver_acessos() then raise exception 'Sem permissão para ver acessos de portais.'; end if;
  if p_acao is null or p_acao not in ('revelar', 'copiar') then raise exception 'Ação inválida.'; end if;
  select * into v from public.cliente_acessos where id = p_id;
  if v.id is null or v.senha_cifrada is null then raise exception 'Este acesso não tem senha guardada.'; end if;
  insert into public.auditoria_acessos (usuario_id, acao, entidade, entidade_id, detalhes)
  values (auth.uid(), p_acao || '_acesso', 'cliente_acessos', v.id::text, jsonb_build_object('cliente_id', v.cliente_id, 'portal', v.portal));
  return jsonb_build_object('cliente_id', v.cliente_id, 'senha_cifrada', v.senha_cifrada);
end $$;

revoke execute on function public.salvar_acesso(uuid, uuid, text, text, text), public.remover_acesso(uuid),
  public.revelar_acesso(uuid, text) from public, anon, service_role;
grant execute on function public.salvar_acesso(uuid, uuid, text, text, text), public.remover_acesso(uuid),
  public.revelar_acesso(uuid, text) to authenticated;
```

- [ ] **Passo 4: rodar e ver passar**

Run: `supabase db reset && supabase test db supabase/tests/40_painel_v2_acessos_portais.test.sql`
Expected: `40_painel_v2_acessos_portais.test.sql .. ok` (34/34).

- [ ] **Passo 5: regressão, tipos e typecheck**

Run: `supabase test db && pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: todos `ok`; `22` 100/100 e `23` iguais a `$SCRATCH/regressao-antes.txt` (a Parte D não mudou: nenhum módulo novo, D3); `Result: PASS`; `tipos.gen.ts` com `cliente_acessos`, `ver_acessos_portais`, `pode_ver_acessos`, `definir_ver_acessos`, `salvar_acesso`, `remover_acesso`, `revelar_acesso`; typecheck verdes. Rode também `pnpm --filter @escritorio/db test -- niveis` (o catálogo continua igual ao core).

- [ ] **Passo 6: devolver portas e commit**

```bash
git add supabase/migrations/20261012000200_painel_v2_acessos_portais.sql supabase/tests/40_painel_v2_acessos_portais.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(banco): acessos de portais — cifra sem leitura para nenhum papel da API, permissão "Ver acessos de portais" e auditoria a cada revelação

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Banco. Demanda automática do certificado digital

**Files:**
- Create: `supabase/migrations/20261012000300_painel_v2_certificado.sql`
- Create: `supabase/tests/41_painel_v2_certificado.test.sql`
- Modify: `packages/db/src/tipos.gen.ts` (regerado)

**Interfaces:**
- Consumes: `clientes.{ativo, razao_social, certificado_tipo, certificado_vencimento, certificado_avisar_dias}` (Task 1), `setores` ("Fiscal"), `cliente_responsaveis`, `usuarios.ativo`, `chamados` (+ gatilhos `chamados_antes_inserir`/`chamados_depois_inserir` da Parte C), tipo `prioridade_demanda`.
- Produces: tabela `certificado_avisos(cliente_id, vencimento, chamado_id, criado_em)` (chave `(cliente_id, vencimento)`); `rotulo_certificado(text) returns text`; `gerar_demandas_certificado(p_hoje date default <hoje em São Paulo>) returns int` (só `service_role`, D21).

- [ ] **Passo 1: escrever o teste que falha**

`supabase/tests/41_painel_v2_certificado.test.sql`:

```sql
-- Parte H1, Task 3 (spec 7D.1 item 7): o aviso do certificado vira uma demanda no Fiscal, para o responsável do Fiscal,
-- uma por empresa e vencimento; nunca para empresa arquivada nem "Sem certificado"; só o trabalhador dispara (D21).
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values
  ('ea100000-0000-0000-0000-00000000000a', 'admin@h1c.local'),
  ('ea100000-0000-0000-0000-00000000000b', 'fe@h1c.local'),
  ('ea100000-0000-0000-0000-00000000000c', 'velho@h1c.local');
insert into public.usuarios (id, nome, email, papel) values
  ('ea100000-0000-0000-0000-00000000000a', 'Admin H1C', 'admin@h1c.local', 'admin'),
  ('ea100000-0000-0000-0000-00000000000b', 'Fê H1C', 'fe@h1c.local', 'atendente'),
  ('ea100000-0000-0000-0000-00000000000c', 'Velho H1C', 'velho@h1c.local', 'atendente');
insert into public.usuario_setores (usuario_id, setor_id)
select u, s.id from public.setores s, unnest(array['ea100000-0000-0000-0000-00000000000b', 'ea100000-0000-0000-0000-00000000000c']::uuid[]) u
where s.nome = 'Fiscal';
insert into public.clientes (id, razao_social, cnpj, ativo, certificado_tipo, certificado_vencimento, certificado_avisar_dias) values
  ('ea300000-0000-0000-0000-00000000000a', 'H1C Alfa', '11222333000181', true, 'e_cnpj_a1', '2030-01-20', 30),
  ('ea300000-0000-0000-0000-00000000000b', 'H1C Beta', '11444777000161', true, 'e_cnpj_a3', '2030-01-25', 30),
  ('ea300000-0000-0000-0000-00000000000c', 'H1C Sem', '17170000000132', true, 'sem', '2030-01-15', 30),
  ('ea300000-0000-0000-0000-00000000000d', 'H1C Longe', '12345678000195', true, 'e_cnpj_a1', '2030-06-01', 30),
  ('ea300000-0000-0000-0000-00000000000e', 'H1C Arquivada', '55566677000183', false, 'e_cnpj_a1', '2030-01-20', 30),
  ('ea300000-0000-0000-0000-00000000000f', 'H1C Vencida', '12121212000106', true, null, '2030-01-05', 30),
  ('ea300000-0000-0000-0000-000000000010', 'H1C Quinze', '99888777000166', true, 'e_cpf_a1', '2030-02-01', 15);
-- Alfa: Fê responde pelo Fiscal. Beta: o responsável do Fiscal foi arquivado (a demanda cai na fila do setor).
insert into public.cliente_responsaveis (cliente_id, setor_id, usuario_id)
select c, s.id, u from public.setores s,
  (values ('ea300000-0000-0000-0000-00000000000a'::uuid, 'ea100000-0000-0000-0000-00000000000b'::uuid),
          ('ea300000-0000-0000-0000-00000000000b'::uuid, 'ea100000-0000-0000-0000-00000000000c'::uuid)) v(c, u)
where s.nome = 'Fiscal';
update public.usuarios set ativo = false where id = 'ea100000-0000-0000-0000-00000000000c';

-- 1–3: estrutura e quem dispara
select col_is_pk('public', 'certificado_avisos', array['cliente_id', 'vencimento'], 'um aviso por empresa e vencimento');
select ok(not has_function_privilege('authenticated', 'public.gerar_demandas_certificado(date)', 'execute'), 'a equipe não dispara');
select ok(has_function_privilege('service_role', 'public.gerar_demandas_certificado(date)', 'execute'), 'o trabalhador dispara');

-- 4–10: o dia 10/01/2030
select is(public.gerar_demandas_certificado('2030-01-10'), 3, 'Alfa, Beta e Vencida (dentro do aviso ou já vencidas)');
select is((select count(*)::int from public.chamados where cliente_id in ('ea300000-0000-0000-0000-00000000000c',
  'ea300000-0000-0000-0000-00000000000d', 'ea300000-0000-0000-0000-00000000000e', 'ea300000-0000-0000-0000-000000000010')), 0,
  'Sem certificado, longe do vencimento, arquivada e fora dos 15 dias: nada');
select results_eq(
  $$ select s.nome, c.responsavel_id, c.origem, c.prioridade::text, c.titulo, c.prazo_em
     from public.chamados c join public.setores s on s.id = c.setor_id where c.cliente_id = 'ea300000-0000-0000-0000-00000000000a' $$,
  $$ values ('Fiscal'::text, 'ea100000-0000-0000-0000-00000000000b'::uuid, 'sistema'::text, 'normal'::text,
             'Certificado digital vence em 20/01/2030'::text, '2030-01-19 18:00-03'::timestamptz) $$,
  'Alfa: Fiscal, responsável do Fiscal, origem sistema, prazo às 18:00 da véspera');
select is((select responsavel_id from public.chamados where cliente_id = 'ea300000-0000-0000-0000-00000000000b'), null,
  'Beta: responsável arquivado, a demanda fica na fila do Fiscal');
select results_eq(
  $$ select prioridade::text, titulo, prazo_em is not null from public.chamados where cliente_id = 'ea300000-0000-0000-0000-00000000000f' $$,
  $$ values ('alta'::text, 'Certificado digital vencido em 05/01/2030'::text, true) $$,
  'vencido: alta, com o prazo da prioridade');
select ok((select resumo from public.chamados where cliente_id = 'ea300000-0000-0000-0000-00000000000a')
          like 'Renovar o certificado digital (e-CNPJ A1) de H1C Alfa.%', 'o resumo diz o tipo e a empresa');
select is((select count(*)::int from public.chamado_eventos e join public.chamados c on c.id = e.chamado_id
           where c.cliente_id = 'ea300000-0000-0000-0000-00000000000a' and e.tipo = 'criacao'), 1,
  'a demanda tem a linha do tempo de sempre (gatilhos da Parte C)');

-- 11–14: sem repetir; 15 dias; certificado renovado
select is(public.gerar_demandas_certificado('2030-01-10'), 0, 'rodar de novo no mesmo dia não repete');
select is(public.gerar_demandas_certificado('2030-01-17'), 1, 'Quinze entra 15 dias antes');
update public.clientes set certificado_vencimento = '2031-01-20' where id = 'ea300000-0000-0000-0000-00000000000a';
select is(public.gerar_demandas_certificado('2030-12-25'), 2, 'Alfa renovado (novo vencimento) e Longe (já vencido)');
select is((select count(*)::int from public.certificado_avisos where cliente_id = 'ea300000-0000-0000-0000-00000000000a' and chamado_id is not null), 2,
  'uma linha por vencimento, cada uma com a sua demanda');

-- 15–16: nunca "Sem certificado" nem arquivada; nem o administrador dispara pelo painel
select is((select count(*)::int from public.chamados where cliente_id in ('ea300000-0000-0000-0000-00000000000c', 'ea300000-0000-0000-0000-00000000000e')), 0,
  '"Sem certificado" e arquivada continuam sem demanda');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"ea100000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$ select public.gerar_demandas_certificado('2030-01-10') $$, '42501', null, 'nem o administrador dispara pelo painel');

select * from finish();
rollback;
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `supabase test db supabase/tests/41_painel_v2_certificado.test.sql`
Expected: FAIL (`relation "public.certificado_avisos" does not exist`).

- [ ] **Passo 3: escrever a migração**

`supabase/migrations/20261012000300_painel_v2_certificado.sql`:

```sql
-- supabase/migrations/20261012000300_painel_v2_certificado.sql
-- Painel v2, Parte H1 (spec 7D.1 item 7): certificado perto de vencer vira demanda automática no Fiscal, para o responsável
-- do Fiscal da empresa, uma por certificado e vencimento. O trabalhador chama todo dia (fila certificados-vencendo, D21).

create table public.certificado_avisos (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  vencimento date not null,
  chamado_id uuid references public.chamados (id) on delete set null,
  criado_em timestamptz not null default now(),
  primary key (cliente_id, vencimento)
);
alter table public.certificado_avisos enable row level security;
create policy leitura on public.certificado_avisos for select to authenticated using (public.eh_usuario_ativo());
revoke insert, update, delete on public.certificado_avisos from anon, authenticated;

create function public.rotulo_certificado(p_tipo text) returns text
language sql immutable set search_path = '' as $$
  select case p_tipo when 'e_cnpj_a1' then 'e-CNPJ A1' when 'e_cnpj_a3' then 'e-CNPJ A3'
                     when 'e_cpf_a1' then 'e-CPF A1' when 'e_cpf_a3' then 'e-CPF A3' end
$$;

-- p_hoje: o dia em São Paulo (o trabalhador manda; os testes fixam). Devolve quantas demandas criou.
create function public.gerar_demandas_certificado(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_fiscal uuid := (select id from public.setores where nome = 'Fiscal' and ativo);
  v_resp uuid;
  v_chamado uuid;
  v_dias int;
  v_prazo timestamptz;
  n int := 0;
begin
  for r in
    select c.id, c.razao_social, c.certificado_tipo, c.certificado_vencimento
    from public.clientes c
    where c.ativo and c.certificado_vencimento is not null and coalesce(c.certificado_tipo, '') <> 'sem'
      and c.certificado_vencimento - c.certificado_avisar_dias <= p_hoje
      and not exists (select 1 from public.certificado_avisos a where a.cliente_id = c.id and a.vencimento = c.certificado_vencimento)
  loop
    -- A linha do aviso vem primeiro: duas execuções ao mesmo tempo não criam duas demandas.
    insert into public.certificado_avisos (cliente_id, vencimento) values (r.id, r.certificado_vencimento) on conflict do nothing;
    if not found then continue; end if;
    v_dias := r.certificado_vencimento - p_hoje;
    v_resp := (select cr.usuario_id from public.cliente_responsaveis cr join public.usuarios u on u.id = cr.usuario_id
               where cr.cliente_id = r.id and cr.setor_id = v_fiscal and u.ativo);
    -- Prazo: 18:00 da véspera do vencimento; se a véspera já passou, fica o prazo da prioridade (gatilho da Parte C).
    v_prazo := case when r.certificado_vencimento - 1 >= p_hoje
                    then ((r.certificado_vencimento - 1)::timestamp + time '18:00') at time zone 'America/Sao_Paulo' end;
    insert into public.chamados (cliente_id, setor_id, responsavel_id, titulo, resumo, prioridade, prazo_em, origem)
    values (r.id, v_fiscal, v_resp,
            case when v_dias < 0 then 'Certificado digital vencido em ' else 'Certificado digital vence em ' end
              || to_char(r.certificado_vencimento, 'DD/MM/YYYY'),
            'Renovar o certificado digital' || coalesce(' (' || public.rotulo_certificado(r.certificado_tipo) || ')', '')
              || ' de ' || r.razao_social || '. Aviso automático da ficha do cliente.',
            (case when v_dias <= 7 then 'alta' else 'normal' end)::public.prioridade_demanda, v_prazo, 'sistema')
    returning id into v_chamado;
    update public.certificado_avisos set chamado_id = v_chamado where cliente_id = r.id and vencimento = r.certificado_vencimento;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.gerar_demandas_certificado(date) from public, anon, authenticated;
grant execute on function public.gerar_demandas_certificado(date) to service_role;
```

- [ ] **Passo 4: rodar e ver passar**

Run: `supabase db reset && supabase test db supabase/tests/41_painel_v2_certificado.test.sql`
Expected: `41_painel_v2_certificado.test.sql .. ok` (16/16).

- [ ] **Passo 5: regressão, tipos e typecheck**

Run: `supabase test db && pnpm db:tipos && pnpm --filter @escritorio/db typecheck && pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/trabalhador typecheck`
Expected: todos `ok`, `22` 100/100, `Result: PASS`; `tipos.gen.ts` com `certificado_avisos`, `gerar_demandas_certificado`, `rotulo_certificado`; typecheck verdes.

- [ ] **Passo 6: devolver portas e commit**

```bash
git add supabase/migrations/20261012000300_painel_v2_certificado.sql supabase/tests/41_painel_v2_certificado.test.sql packages/db/src/tipos.gen.ts
git commit -m "$(cat <<'EOF'
feat(banco): certificado digital perto de vencer vira demanda no Fiscal, uma por empresa e vencimento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 4: Trabalhador ("pronto para trocar"). Tarefa diária do certificado e guarda do agente

**Files:**
- Modify: `packages/db/src/repos.ts` (um método)
- Modify: `apps/trabalhador/src/fila.ts`, `apps/trabalhador/src/tarefas.ts`, `apps/trabalhador/src/principal.ts`
- Create: `apps/trabalhador/test/certificado.test.ts`, `apps/trabalhador/test/agente/cadastro-sem-contrato.test.ts`

**Interfaces:**
- Consumes: `gerar_demandas_certificado(p_hoje)` (Task 3); `executarFerramenta`, `carregarContexto` (agente, sem mudança); `contatoComEmpresas`, `db`, `repos` (`test/apoio/cenario.ts`); `limparBanco` (`@escritorio/db/teste`, trunca `clientes` em cascata).
- Produces: `repos.gerarDemandasCertificado(hoje: string): Promise<number>`; `FILAS.certificados = 'certificados-vencendo'`; `demandasDeCertificado(d: Pick<DepsTarefas, 'repos' | 'relogio'>): Promise<number>`; agenda `0 7 * * *` em São Paulo.

- [ ] **Passo 1: escrever os testes que falham**

`apps/trabalhador/test/certificado.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { FILAS } from '../src/fila';
import { demandasDeCertificado } from '../src/tarefas';
import { db, repos } from './apoio/cenario';

// Parte H1 (spec 7D.1 item 7, D21): certificado perto de vencer vira demanda no Fiscal, uma por vencimento.
const DIA_10 = new Date('2030-01-10T10:00:00Z'); // 07:00 em São Paulo
const deps = (agora: Date) => ({ repos, relogio: () => agora });

beforeEach(async () => {
  await limparBanco();
});

describe('demanda automática do certificado', () => {
  it('tem fila própria', () => {
    expect(FILAS.certificados).toBe('certificados-vencendo');
  });

  it('cria uma demanda no Fiscal por vencimento e não repete', async () => {
    const { data: c, error } = await db.from('clientes').insert({
      razao_social: 'Certificado Ltda', cnpj: '11222333000181', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-01-20',
    }).select('id').single();
    expect(error).toBeNull();
    expect(await demandasDeCertificado(deps(DIA_10))).toBe(1);
    expect(await demandasDeCertificado(deps(DIA_10))).toBe(0);
    const { data: demandas } = await db.from('chamados').select('titulo, origem, setores(nome)').eq('cliente_id', c!.id);
    expect(demandas).toEqual([{ titulo: 'Certificado digital vence em 20/01/2030', origem: 'sistema', setores: { nome: 'Fiscal' } }]);
  });

  it('conta o dia de São Paulo, não o de Greenwich', async () => {
    await db.from('clientes').insert({
      razao_social: 'Fuso Ltda', cnpj: '11444777000161', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-01-20',
    });
    // 21/12 02:30 UTC = 20/12 23:30 em São Paulo: faltam 31 dias, ainda fora do aviso de 30.
    expect(await demandasDeCertificado(deps(new Date('2029-12-21T02:30:00Z')))).toBe(0);
    expect(await demandasDeCertificado(deps(new Date('2029-12-21T03:30:00Z')))).toBe(1);
  });
});
```

`apps/trabalhador/test/agente/cadastro-sem-contrato.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { carregarContexto } from '../../src/agente/contexto';
import { executarFerramenta, type EstadoExecucao } from '../../src/agente/ferramentas';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos } from '../apoio/cenario';
import { IaRoteirizada } from '../apoio/ia-roteirizada';

// Parte H1 (spec 7D.1): "O agente continua lendo só o que já lê (consultar_cadastro); honorários, contrato e acessos
// não entram nas ferramentas do agente". O assistente usa o mesmo repos.dadosDaEmpresa.
const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
const FORA_DO_AGENTE = ['1234.56', 'financeiro@padariasol.com.br', '2022-03-01', '2031-10-25', 'e_cnpj_a1', 'IM-998877', '1091-1/01'];
let canal: CanalFalso;
let estado: EstadoExecucao;

const d = () => ({ repos, ia: new IaRoteirizada([]), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const usar = async (nome: string, entrada: object) => JSON.parse((await executarFerramenta(d(), estado, nome, entrada)).resultado);

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : p.endsWith('.ts') ? [p] : [];
  });
}

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  const { empresas, conversa } = await contatoComEmpresas(['Padaria Sol']);
  const { error } = await db.from('clientes').update({
    honorario_mensal: 1234.56, contrato_inicio: '2022-03-01', email_cobranca: 'financeiro@padariasol.com.br',
    certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2031-10-25', inscricao_municipal: 'IM-998877',
    cnae_principal: '1091-1/01 · Fabricação de produtos de panificação',
    cep: '36404450', logradouro: 'Rua Rosa Figueiredo', numero: '430', complemento: 'loja 2', bairro: 'São Marcos',
    cidade: 'Conselheiro Lafaiete', uf: 'MG',
  }).eq('id', empresas[0]!.id);
  expect(error).toBeNull();
  const contato = await repos.buscarContato(conversa.telefone);
  estado = { ctx: await carregarContexto(repos, conversa, contato, await repos.obterConfiguracoes(), SEGUNDA_10H), respondeu: false };
});

describe('ficha nova do cliente fora do agente', () => {
  it('consultar_cadastro devolve as mesmas 7 informações de antes, com o endereço por extenso', async () => {
    const r = await usar('consultar_cadastro', {});
    expect(Object.keys(r.empresa).sort()).toEqual(['cnpj', 'endereco', 'inscricao_estadual', 'nome_fantasia', 'razao_social', 'regime', 'uf']);
    expect(r.empresa.endereco).toBe('Rua Rosa Figueiredo, 430, loja 2 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450');
    const texto = JSON.stringify(r);
    for (const x of FORA_DO_AGENTE) expect(texto).not.toContain(x);
  });

  it('o contexto do agente não carrega contrato, honorários, certificado nem cobrança', () => {
    const texto = JSON.stringify(estado.ctx);
    for (const x of FORA_DO_AGENTE) expect(texto).not.toContain(x);
  });

  it('nenhum código do trabalhador nem dos repositórios toca acessos de portais, contrato ou honorários', () => {
    const arquivos = [
      ...listar(fileURLToPath(new URL('../../src', import.meta.url))),
      fileURLToPath(new URL('../../../../packages/db/src/repos.ts', import.meta.url)),
    ];
    const proibido = /cliente_acessos|senha_cifrada|revelar_acesso|ACESSOS_PORTAIS_CHAVE|honorario_mensal|contrato_inicio|email_cobranca/;
    expect(arquivos.filter((f) => proibido.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Com o Supabase local nas portas 563xx e `supabase db reset` (as três migrações aplicadas):
Run: `pnpm --filter @escritorio/trabalhador test -- certificado cadastro-sem-contrato`
Expected: FAIL em `certificado.test.ts` (`demandasDeCertificado` não existe; `FILAS.certificados` indefinido). `cadastro-sem-contrato.test.ts` já passa (prova de que nada do agente precisou mudar: colunas explícitas em `dadosDaEmpresa` e o endereço por extenso vem do banco, D11/D33).

- [ ] **Passo 3: implementar**

`packages/db/src/repos.ts` — logo depois de `dadosDaEmpresa(...)`:

```ts
    /** Certificado digital perto de vencer vira demanda no Fiscal (Parte H1, D21). `hoje` = dia em São Paulo; devolve quantas criou. */
    async gerarDemandasCertificado(hoje: string): Promise<number> {
      return checar(await db.rpc('gerar_demandas_certificado', { p_hoje: hoje }), 'gerarDemandasCertificado');
    },
```

`apps/trabalhador/src/fila.ts` — em `FILAS`, depois de `removerArquivos`:

```ts
  /** Todo dia às 07:00: certificado digital perto de vencer vira demanda no Fiscal (Parte H1). */
  certificados: 'certificados-vencendo',
```

e na lista de `criarBoss`:

```ts
  for (const nome of [FILAS.verificarEnviadaPorMim, FILAS.batimento, FILAS.alertaFila, FILAS.resumoDiario, FILAS.limpezaRetencao, FILAS.certificados]) {
```

`apps/trabalhador/src/tarefas.ts` — no fim do arquivo:

```ts
/** Todo dia de manhã: certificado perto de vencer vira demanda no Fiscal (spec 7D.1, D21). O dia é o de São Paulo. */
export async function demandasDeCertificado(d: Pick<DepsTarefas, 'repos' | 'relogio'>): Promise<number> {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d.relogio());
  return d.repos.gerarDemandasCertificado(hoje);
}
```

`apps/trabalhador/src/principal.ts` — import `demandasDeCertificado` junto de `alertasPeriodicos, batimento, resumoDiario`, e depois do agendamento da limpeza:

```ts
  // Todo dia às 07:00: certificado digital perto de vencer vira demanda no Fiscal (Parte H1).
  await boss.work(FILAS.certificados, async () => { await demandasDeCertificado(depsTarefas); });
  await boss.schedule(FILAS.certificados, '0 7 * * *', {}, FUSO);
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/trabalhador test -- certificado cadastro-sem-contrato tarefas fila && pnpm --filter @escritorio/trabalhador typecheck && pnpm --filter @escritorio/db typecheck`
Expected: os 6 testes novos passam; `tarefas.test.ts` e `fila.test.ts` (sem mudança) passam; typecheck verdes. Confira `git diff BASE --stat -- apps/trabalhador/src/agente apps/trabalhador/src/assistente` **vazio** (D33).

- [ ] **Passo 5: devolver portas e commit**

```bash
git add packages/db/src/repos.ts apps/trabalhador/src/fila.ts apps/trabalhador/src/tarefas.ts apps/trabalhador/src/principal.ts apps/trabalhador/test/certificado.test.ts apps/trabalhador/test/agente/cadastro-sem-contrato.test.ts
git commit -m "$(cat <<'EOF'
feat(trabalhador): tarefa diária que transforma certificado perto de vencer em demanda no Fiscal; teste que prova que o agente não vê contrato, honorários nem acessos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Painel. Cofre das senhas (AES-256-GCM com a chave fora do banco)

**Files:**
- Create: `apps/painel/src/lib/cofre.ts`, `apps/painel/src/lib/cofre.test.ts`, `apps/painel/src/lib/cofre-guarda.test.ts`

**Interfaces:**
- Consumes: `process.env.ACESSOS_PORTAIS_CHAVE` (base64 de 32 bytes), Node `crypto`.
- Produces: `FORMATO_CIFRADO` (igual à checagem da coluna, Task 2), `ErroCofre`, `cofreConfigurado()`, `contextoAcesso(clienteId)`, `cifrar(texto, contexto)`, `decifrar(cifrado, contexto)`.

- [ ] **Passo 1: escrever os testes que falham**

`apps/painel/src/lib/cofre.test.ts`:

```ts
import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { cifrar, cofreConfigurado, contextoAcesso, decifrar, ErroCofre, FORMATO_CIFRADO } from './cofre';

const CHAVE = randomBytes(32).toString('base64');

beforeEach(() => {
  vi.stubEnv('ACESSOS_PORTAIS_CHAVE', CHAVE);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cofre dos acessos de portais (D1)', () => {
  it('cifra no formato que o banco aceita e decifra de volta', () => {
    const c = cifrar('Portal#Segredo-2026', contextoAcesso('cli-1'));
    expect(c).toMatch(FORMATO_CIFRADO);
    expect(c).not.toContain('Segredo');
    expect(decifrar(c, contextoAcesso('cli-1'))).toBe('Portal#Segredo-2026');
  });

  it('a mesma senha sai diferente a cada vez', () => {
    expect(cifrar('a', 'x')).not.toBe(cifrar('a', 'x'));
  });

  it('a cifra de uma empresa não abre em outra', () => {
    const c = cifrar('segredo', contextoAcesso('cli-1'));
    expect(() => decifrar(c, contextoAcesso('cli-2'))).toThrow(ErroCofre);
  });

  it('cifra mexida não abre', () => {
    const partes = cifrar('segredo', 'x').split('.');
    partes[3] = (partes[3]!.startsWith('A') ? 'B' : 'A') + partes[3]!.slice(1);
    expect(() => decifrar(partes.join('.'), 'x')).toThrow(ErroCofre);
  });

  it('outra chave não abre', () => {
    const c = cifrar('segredo', 'x');
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', randomBytes(32).toString('base64'));
    expect(() => decifrar(c, 'x')).toThrow(ErroCofre);
  });

  it('sem chave, ou com tamanho errado, o cofre fica desligado (D8)', () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(cofreConfigurado()).toBe(false);
    expect(() => cifrar('a', 'x')).toThrow(ErroCofre);
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', Buffer.from('curta').toString('base64'));
    expect(cofreConfigurado()).toBe(false);
  });

  it('a mensagem de erro nunca leva a senha', () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(() => cifrar('Portal#Segredo-2026', 'x')).toThrow(/^(?!.*Segredo).*$/);
  });
});
```

`apps/painel/src/lib/cofre-guarda.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Spec 7D.1: a senha nunca vai para logs nem exportações. Só quem precisa importa o cofre.
const SRC = fileURLToPath(new URL('..', import.meta.url));
const PERMITIDOS = new Set([
  'lib/cofre.test.ts',
  'app/(painel)/clientes/ficha/acessos-acoes.ts',
  'app/(painel)/clientes/ficha/acessos-acoes.test.ts',
  // A página só pergunta se há chave (cofreConfigurado), para o aviso do D8.
  'app/(painel)/clientes/ficha/dados-ficha.tsx',
]);

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? listar(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}

describe('guarda do cofre', () => {
  it('só a ação dos acessos (e a página, para saber se há chave) importa o cofre', () => {
    const quem = listar(SRC)
      .filter((f) => /from ['"](@\/lib\/cofre|\.\/cofre)['"]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f).split(sep).join('/'));
    expect(quem.filter((f) => !PERMITIDOS.has(f))).toEqual([]);
  });

  it('o cofre não escreve no console', () => {
    expect(readFileSync(join(SRC, 'lib/cofre.ts'), 'utf8')).not.toMatch(/console\./);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel test -- cofre`
Expected: FAIL (`Cannot find module './cofre'`; o teste de guarda falha ao ler `lib/cofre.ts`).

- [ ] **Passo 3: implementar**

`apps/painel/src/lib/cofre.ts`:

```ts
import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Cofre das senhas de portais (spec 7D.1 item 8, D1): AES-256-GCM no servidor do painel, com a chave fora do banco
 * (ACESSOS_PORTAIS_CHAVE, base64 de 32 bytes). O banco só guarda o texto cifrado e nunca decifra.
 */

/** Formato guardado no banco (a coluna recusa outro, migração 20261012000200): v1.<iv>.<etiqueta>.<cifra>, em base64url. */
export const FORMATO_CIFRADO = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/;

export class ErroCofre extends Error {}

/** Ausente ou com tamanho errado: o cofre fica desligado (D8). Nunca há chave padrão. */
function chave(): Buffer | null {
  const bruta = process.env.ACESSOS_PORTAIS_CHAVE?.trim();
  if (!bruta) return null;
  const k = Buffer.from(bruta, 'base64');
  return k.length === 32 ? k : null;
}

export function cofreConfigurado(): boolean {
  return chave() !== null;
}

/** Contexto autenticado da cifra: a senha de uma empresa não abre como se fosse de outra. */
export const contextoAcesso = (clienteId: string) => `acesso:${clienteId}`;

export function cifrar(texto: string, contexto: string): string {
  const k = chave();
  if (!k) throw new ErroCofre('Chave dos acessos não configurada.');
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  c.setAAD(Buffer.from(contexto, 'utf8'));
  const cifra = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), cifra.toString('base64url')].join('.');
}

export function decifrar(cifrado: string, contexto: string): string {
  const k = chave();
  if (!k) throw new ErroCofre('Chave dos acessos não configurada.');
  if (!FORMATO_CIFRADO.test(cifrado)) throw new ErroCofre('Formato desconhecido.');
  const [, iv, etiqueta, cifra] = cifrado.split('.') as [string, string, string, string];
  try {
    const d = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64url'));
    d.setAAD(Buffer.from(contexto, 'utf8'));
    d.setAuthTag(Buffer.from(etiqueta, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(cifra, 'base64url')), d.final()]).toString('utf8');
  } catch {
    // Etiqueta errada (chave, empresa ou cifra trocada): erro genérico, sem nada do conteúdo.
    throw new ErroCofre('Não foi possível abrir a senha.');
  }
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel test -- cofre && pnpm --filter @escritorio/painel typecheck`
Expected: 9 testes passam (7 + 2); typecheck verde.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/lib/cofre.ts apps/painel/src/lib/cofre.test.ts apps/painel/src/lib/cofre-guarda.test.ts
git commit -m "$(cat <<'EOF'
feat(painel): cofre das senhas de portais (AES-256-GCM, chave fora do banco) e guarda de quem pode importá-lo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Painel. Busca pública de CNPJ e CEP (e o servidor falso dos e2e)

**Files:**
- Create: `apps/painel/src/lib/consultas-publicas.ts`, `apps/painel/src/lib/consultas-publicas.test.ts`
- Create: `apps/painel/e2e/consultas-falsas.mjs`
- Modify: `apps/painel/playwright.config.ts`

**Interfaces:**
- Consumes: `fetch` (padrão do Next), `CONSULTA_CNPJ_URL` (padrão `https://brasilapi.com.br/api/cnpj/v1`), `CONSULTA_CEP_URL` (padrão `https://viacep.com.br/ws`).
- Produces: `LIMITE_BUSCA_MS = 4000`; tipos `DadosCnpj`, `DadosCep`, `ResultadoBusca<T>` (`{ok: true, dados} | {ok: false, motivo: 'nao_encontrado' | 'indisponivel'}`); `capitalizar`, `formatarCnae`, `consultarCnpj(cnpj, buscar?)`, `consultarCep(cep, buscar?)`. Servidor falso na porta 3199: CNPJ `12345678000195` → Padaria Sol; `55566677000183` → 500; outros → 404; CEP `36404450` → Rua Rosa Figueiredo; `11111111` → responde depois de 6 s; outros → `{erro: "true"}`.

- [ ] **Passo 1: escrever o teste que falha**

`apps/painel/src/lib/consultas-publicas.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { capitalizar, consultarCep, consultarCnpj, formatarCnae, LIMITE_BUSCA_MS } from './consultas-publicas';

const BRASILAPI = {
  razao_social: 'PADARIA SOL COMERCIO DE ALIMENTOS ME', nome_fantasia: 'PADARIA SOL', cnae_fiscal: 1091101,
  cnae_fiscal_descricao: 'Fabricação de produtos de panificação', cep: '36404450', descricao_tipo_de_logradouro: 'RUA',
  logradouro: 'ROSA FIGUEIREDO', numero: '430', complemento: 'LOJA 2', bairro: 'SÃO MARCOS', municipio: 'CONSELHEIRO LAFAIETE', uf: 'MG',
  capital_social: 1000, qsa: [{ nome_socio: 'NÃO VAI PARA A TELA' }],
};
const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });
function falso(r: () => Response | Promise<Response>) {
  const chamadas: { url: string; init?: RequestInit }[] = [];
  const buscar = (async (url: string | URL, init?: RequestInit) => { chamadas.push({ url: String(url), init }); return r(); }) as unknown as typeof fetch;
  return { buscar, chamadas };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('busca de CNPJ (BrasilAPI pelo servidor, D15)', () => {
  it('só o número vai na chamada, com limite de tempo; volta razão social, CNAE e endereço', async () => {
    const f = falso(() => resposta(200, BRASILAPI));
    const r = await consultarCnpj('12.345.678/0001-95', f.buscar);
    expect(f.chamadas.map((c) => c.url)).toEqual(['https://brasilapi.com.br/api/cnpj/v1/12345678000195']);
    expect(f.chamadas[0]!.init?.signal).toBeInstanceOf(AbortSignal);
    expect(LIMITE_BUSCA_MS).toBe(4000);
    expect(r).toEqual({ ok: true, dados: {
      razao_social: 'PADARIA SOL COMERCIO DE ALIMENTOS ME', nome_fantasia: 'PADARIA SOL',
      cnae_principal: '1091-1/01 · Fabricação de produtos de panificação', cep: '36404450', logradouro: 'Rua Rosa Figueiredo',
      numero: '430', complemento: 'Loja 2', bairro: 'São Marcos', cidade: 'Conselheiro Lafaiete', uf: 'MG',
    } });
  });

  it('não encontrado, fora do ar e sem resposta viram motivo, nunca erro', async () => {
    expect(await consultarCnpj('12345678000195', falso(() => resposta(404, { message: 'x' })).buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await consultarCnpj('12345678000195', falso(() => resposta(500)).buscar)).toEqual({ ok: false, motivo: 'indisponivel' });
    expect(await consultarCnpj('12345678000195', falso(() => { throw new DOMException('tempo', 'TimeoutError'); }).buscar))
      .toEqual({ ok: false, motivo: 'indisponivel' });
  });

  it('número com tamanho errado nem chama', async () => {
    const f = falso(() => resposta(200, BRASILAPI));
    expect(await consultarCnpj('123', f.buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(f.chamadas).toEqual([]);
  });

  it('o endereço da busca vem do ambiente (servidor falso dos e2e, D32)', async () => {
    vi.stubEnv('CONSULTA_CNPJ_URL', 'http://127.0.0.1:3199/api/cnpj/v1');
    const f = falso(() => resposta(404));
    await consultarCnpj('12345678000195', f.buscar);
    expect(f.chamadas[0]!.url).toBe('http://127.0.0.1:3199/api/cnpj/v1/12345678000195');
  });
});

describe('busca de CEP (ViaCEP pelo servidor)', () => {
  it('só o número; volta logradouro, bairro, cidade e UF', async () => {
    const f = falso(() => resposta(200, { cep: '36404-450', logradouro: 'Rua Rosa Figueiredo', bairro: 'São Marcos', localidade: 'Conselheiro Lafaiete', uf: 'MG' }));
    expect(await consultarCep('36.404-450', f.buscar)).toEqual({ ok: true, dados: { logradouro: 'Rua Rosa Figueiredo', bairro: 'São Marcos', cidade: 'Conselheiro Lafaiete', uf: 'MG' } });
    expect(f.chamadas[0]!.url).toBe('https://viacep.com.br/ws/36404450/json/');
  });

  it('CEP que não existe e serviço fora do ar', async () => {
    expect(await consultarCep('99999999', falso(() => resposta(200, { erro: 'true' })).buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await consultarCep('99999999', falso(() => resposta(200, { erro: true })).buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await consultarCep('99999999', falso(() => resposta(502)).buscar)).toEqual({ ok: false, motivo: 'indisponivel' });
  });
});

describe('formatação', () => {
  it('CNAE com máscara e descrição', () => {
    expect(formatarCnae(1091101, 'Fabricação de produtos de panificação')).toBe('1091-1/01 · Fabricação de produtos de panificação');
    expect(formatarCnae('4711302', null)).toBe('4711-3/02');
    expect(formatarCnae(null, 'x')).toBeNull();
  });
  it('maiúsculas da Receita viram nome próprio', () => {
    expect(capitalizar('RUA DAS FLORES DE MAIO')).toBe('Rua das Flores de Maio');
    expect(capitalizar('  ')).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel test -- consultas-publicas`
Expected: FAIL (`Cannot find module './consultas-publicas'`).

- [ ] **Passo 3: implementar**

`apps/painel/src/lib/consultas-publicas.ts`:

```ts
import 'server-only';

/**
 * Busca pública pelo servidor do painel (spec 7D.1): BrasilAPI para CNPJ, ViaCEP para CEP. Só o número sai daqui;
 * demora (4 s) ou falha vira um motivo para a tela pedir o preenchimento à mão, sem travar nada (D15).
 */
export const LIMITE_BUSCA_MS = 4000;

export type DadosCnpj = {
  razao_social: string | null; nome_fantasia: string | null; cnae_principal: string | null; cep: string | null;
  logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null;
};
export type DadosCep = { logradouro: string | null; bairro: string | null; cidade: string | null; uf: string | null };
export type ResultadoBusca<T> = { ok: true; dados: T } | { ok: false; motivo: 'nao_encontrado' | 'indisponivel' };

const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().replace(/\s+/g, ' ') : null);
const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "RUA DAS FLORES" → "Rua das Flores" (endereço da Receita vem todo em maiúsculas). */
export function capitalizar(t: string | null | undefined): string | null {
  const s = texto(t);
  if (!s) return null;
  return s.toLowerCase().split(' ')
    .map((p, i) => (i > 0 && PEQUENAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** 1091101 → "1091-1/01 · <descrição>". */
export function formatarCnae(codigo: unknown, descricao: unknown): string | null {
  const d = String(codigo ?? '').replace(/\D/g, '');
  if (d.length !== 7) return null;
  const desc = texto(descricao);
  return `${d.slice(0, 4)}-${d[4]}/${d.slice(5)}${desc ? ` · ${desc}` : ''}`;
}

async function pegar(url: string, buscar: typeof fetch): Promise<{ status: number; corpo: unknown } | null> {
  try {
    const r = await buscar(url, { signal: AbortSignal.timeout(LIMITE_BUSCA_MS), cache: 'no-store', headers: { accept: 'application/json' } });
    return { status: r.status, corpo: r.ok ? await r.json() : null };
  } catch {
    return null;
  }
}

export async function consultarCnpj(cnpj: string, buscar: typeof fetch = fetch): Promise<ResultadoBusca<DadosCnpj>> {
  const numero = cnpj.replace(/\D/g, '');
  if (numero.length !== 14) return { ok: false, motivo: 'nao_encontrado' };
  const base = process.env.CONSULTA_CNPJ_URL || 'https://brasilapi.com.br/api/cnpj/v1';
  const r = await pegar(`${base}/${numero}`, buscar);
  if (!r) return { ok: false, motivo: 'indisponivel' };
  if (r.status === 400 || r.status === 404) return { ok: false, motivo: 'nao_encontrado' };
  if (r.status !== 200 || !r.corpo || typeof r.corpo !== 'object') return { ok: false, motivo: 'indisponivel' };
  const c = r.corpo as Record<string, unknown>;
  const tipo = texto(c.descricao_tipo_de_logradouro);
  const rua = texto(c.logradouro);
  const logradouro = rua && tipo && !rua.toUpperCase().startsWith(tipo.toUpperCase()) ? `${tipo} ${rua}` : rua;
  const cep = String(c.cep ?? '').replace(/\D/g, '');
  return {
    ok: true,
    dados: {
      razao_social: texto(c.razao_social), nome_fantasia: texto(c.nome_fantasia),
      cnae_principal: formatarCnae(c.cnae_fiscal, c.cnae_fiscal_descricao),
      cep: cep.length === 8 ? cep : null, logradouro: capitalizar(logradouro), numero: texto(c.numero),
      complemento: capitalizar(texto(c.complemento)), bairro: capitalizar(texto(c.bairro)), cidade: capitalizar(texto(c.municipio)),
      uf: texto(c.uf)?.toUpperCase() ?? null,
    },
  };
}

export async function consultarCep(cep: string, buscar: typeof fetch = fetch): Promise<ResultadoBusca<DadosCep>> {
  const numero = cep.replace(/\D/g, '');
  if (numero.length !== 8) return { ok: false, motivo: 'nao_encontrado' };
  const base = process.env.CONSULTA_CEP_URL || 'https://viacep.com.br/ws';
  const r = await pegar(`${base}/${numero}/json/`, buscar);
  if (!r) return { ok: false, motivo: 'indisponivel' };
  if (r.status === 400 || r.status === 404) return { ok: false, motivo: 'nao_encontrado' };
  if (r.status !== 200 || !r.corpo || typeof r.corpo !== 'object') return { ok: false, motivo: 'indisponivel' };
  const c = r.corpo as Record<string, unknown>;
  if (c.erro === true || c.erro === 'true') return { ok: false, motivo: 'nao_encontrado' };
  return { ok: true, dados: { logradouro: texto(c.logradouro), bairro: texto(c.bairro), cidade: texto(c.localidade), uf: texto(c.uf)?.toUpperCase() ?? null } };
}
```

`apps/painel/e2e/consultas-falsas.mjs`:

```js
// Servidor falso das buscas públicas para os e2e (D32): o playwright.config.ts aponta CONSULTA_CNPJ_URL e CONSULTA_CEP_URL
// para cá. Nenhum teste chama BrasilAPI nem ViaCEP de verdade.
import { createServer } from 'node:http';

const PORTA = Number(process.env.CONSULTAS_FALSAS_PORTA ?? 3199);
const CNPJS = {
  '12345678000195': {
    razao_social: 'PADARIA SOL COMERCIO DE ALIMENTOS ME', nome_fantasia: 'PADARIA SOL', cnae_fiscal: 1091101,
    cnae_fiscal_descricao: 'Fabricação de produtos de panificação', cep: '36404450', descricao_tipo_de_logradouro: 'RUA',
    logradouro: 'ROSA FIGUEIREDO', numero: '430', complemento: '', bairro: 'SÃO MARCOS', municipio: 'CONSELHEIRO LAFAIETE', uf: 'MG',
  },
};
const CEPS = {
  '36404450': { cep: '36404-450', logradouro: 'Rua Rosa Figueiredo', complemento: '', bairro: 'São Marcos', localidade: 'Conselheiro Lafaiete', uf: 'MG' },
};
const json = (res, status, corpo) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(corpo));
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORTA}`);
  if (url.pathname === '/saude') return json(res, 200, { ok: true });
  const cnpj = url.pathname.match(/^\/api\/cnpj\/v1\/(\d{14})$/)?.[1];
  if (cnpj) {
    if (cnpj === '55566677000183') return json(res, 500, { message: 'fora do ar' });
    return CNPJS[cnpj] ? json(res, 200, CNPJS[cnpj]) : json(res, 404, { message: 'CNPJ não encontrado' });
  }
  const cep = url.pathname.match(/^\/ws\/(\d{8})\/json\/$/)?.[1];
  if (cep) {
    // CEP lento: passa do limite de 4 s do painel (a tela pede o preenchimento à mão).
    if (cep === '11111111') return void setTimeout(() => json(res, 200, CEPS['36404450']), 6000);
    return CEPS[cep] ? json(res, 200, CEPS[cep]) : json(res, 200, { erro: 'true' });
  }
  return json(res, 404, {});
}).listen(PORTA, '127.0.0.1', () => console.log(`[consultas falsas] ouvindo em ${PORTA}`));
```

`apps/painel/playwright.config.ts` — depois do `config({ path: … })` e da `porta`:

```ts
// Os e2e nunca chamam BrasilAPI/ViaCEP (servidor falso local) e usam uma chave de cifra só de teste (D8, D32).
// Atribuição direta (não ??=): nem um valor de verdade no terminal escapa para os testes.
const PORTA_CONSULTAS = 3199;
process.env.CONSULTA_CNPJ_URL = `http://127.0.0.1:${PORTA_CONSULTAS}/api/cnpj/v1`;
process.env.CONSULTA_CEP_URL = `http://127.0.0.1:${PORTA_CONSULTAS}/ws`;
process.env.ACESSOS_PORTAIS_CHAVE = 'ZTJlLXNvLXBhcmEtdGVzdGVzLWxvY2Fpcy0zMmJ5dGU='; // "e2e-so-para-testes-locais-32byte"
```

e troque o `webServer` por:

```ts
  webServer: [
    { command: 'node e2e/consultas-falsas.mjs', url: `http://127.0.0.1:${PORTA_CONSULTAS}/saude`, reuseExistingServer: true, timeout: 30_000 },
    { command: `pnpm dev -p ${porta}`, url: `http://localhost:${porta}/entrar`, reuseExistingServer: true, timeout: 120_000 },
  ],
```

(O `next dev` herda o `process.env` do Playwright; por isso **nenhum `next dev` desta parte pode estar ligado antes do e2e** — ele seria reaproveitado sem essas variáveis. Está nas Restrições globais.)

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel test -- consultas-publicas && pnpm --filter @escritorio/painel typecheck && node apps/painel/e2e/consultas-falsas.mjs & sleep 1; curl -s http://127.0.0.1:3199/api/cnpj/v1/12345678000195 | head -c 80; curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3199/api/cnpj/v1/11222333000181; kill %1`
Expected: 8 testes passam; typecheck verde; o `curl` mostra `{"razao_social":"PADARIA SOL…` e depois `404`.

- [ ] **Passo 5: commit**

```bash
git add apps/painel/src/lib/consultas-publicas.ts apps/painel/src/lib/consultas-publicas.test.ts apps/painel/e2e/consultas-falsas.mjs apps/painel/playwright.config.ts
git commit -m "$(cat <<'EOF'
feat(painel): busca pública de CNPJ e CEP pelo servidor, só com o número e limite de 4 s; servidor falso para os e2e

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 7: Painel. Regras puras da ficha

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/ficha/ficha.ts`, `apps/painel/src/app/(painel)/clientes/ficha/ficha.test.ts`

**Interfaces:**
- Consumes: `somenteDigitos`, `validarCnpj` (`@escritorio/core`); `FUSO`, `formatarBRL`, `NBSP` (`@/lib/formatos`).
- Produces:
  - opções: `UFS`, `REGIMES`, `opcoesRegime(atual)`, `PORTES`, `SEGMENTOS`, `TIPOS_CERTIFICADO`, `AVISAR_DIAS`, `OPCOES_REAJUSTE`, `valorReajuste(reajuste, mes)`;
  - `UUID`; tipos `ClienteFicha`, `ErrosFicha`, `EstadoFicha`, `DadosBanco`, `LeituraFicha`;
  - `lerDinheiro(texto)`, `dinheiroNoCampo(valor)`, `lerFicha(formData, { admin })`;
  - `BLOCOS`, tipos `Bloco`, `EstadoBloco`, `ValoresFicha`; `valoresDe(formData)`, `valoresDoCliente(c, st, nResponsaveis)`, `estadoDosBlocos(v, agora)`, `estadoCertificado(...)`, `textoEstado(e)`;
  - `hojeSP(agora)`, `diasAte(data, agora)`; tipo `Etiqueta`; `etiquetasDoTopo(c, agora)`; `clienteDesde(contratoInicio, criadoEm)`; `textoUltimaAlteracao(u)`;
  - `mensagemBusca(tipo, motivo)`, `textoPreenchido(campos)`; `separarSetores(setores, servicos, contratados, responsaveis)` (D16).

- [ ] **Passo 1: escrever o teste que falha**

`apps/painel/src/app/(painel)/clientes/ficha/ficha.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clienteDesde, diasAte, dinheiroNoCampo, estadoDosBlocos, etiquetasDoTopo, lerDinheiro, lerFicha, mensagemBusca, opcoesRegime,
  separarSetores, textoEstado, textoPreenchido, textoUltimaAlteracao, valorReajuste, valoresDe, valoresDoCliente,
} from './ficha';

const SETOR_FISCAL = '11111111-1111-4111-8111-111111111111';
const BIA = '22222222-2222-4222-8222-222222222222';
const SERVICO = '33333333-3333-4333-8333-333333333333';

function form(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
// 10/10/2030 12:00 em São Paulo.
const AGORA = new Date('2030-10-10T15:00:00Z');

describe('lerFicha (D9, D13)', () => {
  it('lê a ficha inteira no formato de salvar_ficha_cliente', () => {
    const r = lerFicha(form({
      razao_social: ' Padaria Sol Comércio de Alimentos ME ', cnpj: '12.345.678/0001-95', nome_fantasia: 'Padaria Sol',
      inscricao_estadual: '0037486930064', regime: 'Simples Nacional', porte: 'me', faturamento_ultimo_ano: 'R$ 820.000,00', funcionarios: '8',
      segmentos: ['comercio', 'industria', 'atacado'], cep: '36.404-450', logradouro: 'Rua Rosa Figueiredo', numero: '430', uf: 'mg',
      telefone: '(31) 98780-0133', email: 'Contato@PadariaSol.com.br', contrato_inicio: '2022-03-01', honorario_mensal: '1.250,00',
      dia_vencimento: '10', reajuste: 'anual:3', decimo_terceiro: 'sim', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-10-25',
      certificado_avisar_dias: '30', st_uf: ['SP', 'rj'], st_inscricao: ['123.456.789.110', ''], servico: [SERVICO, 'lixo'],
      [`responsavel:${SETOR_FISCAL}`]: BIA, agente_pausado: 'on',
    }), { admin: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados).toMatchObject({
      razao_social: 'Padaria Sol Comércio de Alimentos ME', cnpj: '12345678000195', tipo_pessoa: 'juridica', faturamento_ultimo_ano: 820000,
      funcionarios: 8, segmentos: ['comercio', 'industria'], cep: '36404450', uf: 'MG', telefone: '31987800133', email: 'contato@padariasol.com.br',
      honorario_mensal: 1250, dia_vencimento: 10, reajuste: 'anual', reajuste_mes: 3, decimo_terceiro: true, certificado_avisar_dias: 30,
      inscricoes_st: [{ uf: 'SP', inscricao: '123.456.789.110' }, { uf: 'RJ', inscricao: null }], servicos: [SERVICO],
      responsaveis: { [SETOR_FISCAL]: BIA }, complemento: null, contrato_fim: null,
    });
    expect(r.dados).not.toHaveProperty('agente_pausado');
  });

  it('pausa do agente só vai quando quem salva é o administrador (D14)', () => {
    const base = { razao_social: 'X Ltda', cnpj: '12345678000195' };
    const admin = lerFicha(form({ ...base, agente_pausado: 'on' }), { admin: true });
    expect(admin.ok && admin.dados.agente_pausado).toBe(true);
    const adminDesligou = lerFicha(form(base), { admin: true });
    expect(adminDesligou.ok && adminDesligou.dados.agente_pausado).toBe(false);
  });

  it('só razão social e CNPJ travam; o resto vazio vira nulo (pendência, não erro)', () => {
    const r = lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195' }), { admin: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.dados).toMatchObject({ regime: null, cep: null, segmentos: [], certificado_avisar_dias: 30, inscricoes_st: [], decimo_terceiro: null });
  });

  it('CNPJ inválido: erro no campo e o aviso de sempre ("Não foi possível salvar: … CNPJ inválido")', () => {
    const r = lerFicha(form({ razao_social: 'Cliente Com CNPJ Errado', cnpj: '11.222.333/0001-99' }), { admin: false });
    expect(r).toEqual({ ok: false, erros: { cnpj: 'CNPJ inválido', geral: 'Não foi possível salvar: CNPJ inválido. Confira o campo marcado.' } });
  });

  it('vários erros: o primeiro no aviso e a contagem', () => {
    const r = lerFicha(form({ razao_social: 'X', cnpj: '1', cep: '123', email_cobranca: 'sem-arroba', honorario_mensal: '12,345', dia_vencimento: '40' }), { admin: false });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toMatchObject({
      razao_social: 'Informe a razão social', cnpj: 'CNPJ inválido', cep: 'O CEP tem 8 números', email_cobranca: 'E-mail inválido',
      honorario_mensal: 'Valor inválido (ex.: 1.250,00)', dia_vencimento: 'Dia de 1 a 31',
    });
    expect(r.erros.geral).toBe('Não foi possível salvar: Informe a razão social. Confira os 6 campos marcados.');
  });

  it('inscrições ST: UF repetida ou sem UF recusam', () => {
    expect(lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', st_uf: ['SP', 'sp'], st_inscricao: ['1', '2'] }), { admin: false }))
      .toMatchObject({ ok: false, erros: { inscricoes_st: 'UF repetida: SP' } });
    expect(lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', st_uf: [''], st_inscricao: ['1'] }), { admin: false }))
      .toMatchObject({ ok: false, erros: { inscricoes_st: 'Escolha a UF de cada linha' } });
  });

  it('isento de IE não grava a inscrição; fim do contrato antes do início recusa', () => {
    const r = lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', isento_ie: 'on', inscricao_estadual: '123' }), { admin: false });
    expect(r.ok && r.dados).toMatchObject({ isento_ie: true, inscricao_estadual: null });
    expect(lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', contrato_inicio: '2022-03-01', contrato_fim: '2021-01-01' }), { admin: false }))
      .toMatchObject({ ok: false, erros: { contrato_fim: 'O fim vem depois do início' } });
  });

  it('responsável vazio vai como nulo (tira o responsável daquele setor)', () => {
    const r = lerFicha(form({ razao_social: 'X Ltda', cnpj: '12345678000195', [`responsavel:${SETOR_FISCAL}`]: '' }), { admin: false });
    expect(r.ok && r.dados.responsaveis).toEqual({ [SETOR_FISCAL]: null });
  });
});

describe('dinheiro e reajuste', () => {
  it('lê o jeito brasileiro', () => {
    expect(lerDinheiro('R$ 1.250,00')).toBe(1250);
    expect(lerDinheiro('1250,5')).toBe(1250.5);
    expect(lerDinheiro('1250')).toBe(1250);
    expect(lerDinheiro('')).toBeNull();
    expect(lerDinheiro('12,345')).toBe('invalido');
    expect(lerDinheiro('abc')).toBe('invalido');
  });
  it('mostra no campo sem o "R$" (ele fica ao lado)', () => {
    expect(dinheiroNoCampo(1250)).toBe('1.250,00');
    expect(dinheiroNoCampo(null)).toBe('');
  });
  it('reajuste do banco volta para o seletor', () => {
    expect(valorReajuste('anual', 3)).toBe('anual:3');
    expect(valorReajuste('sem', null)).toBe('sem');
    expect(valorReajuste(null, null)).toBe('');
  });
  it('regime antigo fora da lista continua como opção (D18)', () => {
    expect(opcoesRegime('Simples').at(-1)).toEqual({ valor: 'Simples', rotulo: 'Simples (antigo)' });
    expect(opcoesRegime('Lucro Real').some((o) => o.rotulo.includes('antigo'))).toBe(false);
  });
});

describe('índice: estado de cada bloco (D28)', () => {
  it('ficha vazia: pendências contadas, contato e fiscal neutros, acessos protegido', () => {
    const e = estadoDosBlocos(valoresDoCliente(null, [], 0), AGORA);
    expect(e.identificacao).toEqual({ tipo: 'pendente', n: 4 });
    expect(e.endereco).toEqual({ tipo: 'pendente', n: 6 });
    expect(e.contato).toEqual({ tipo: 'neutro' });
    expect(e.fiscal).toEqual({ tipo: 'neutro' });
    expect(e.contrato).toEqual({ tipo: 'pendente', n: 2 });
    expect(e.responsaveis).toEqual({ tipo: 'neutro' });
    expect(e.certificado).toEqual({ tipo: 'pendente', n: 1 });
    expect(e.acessos).toEqual({ tipo: 'protegido' });
  });

  it('lê do formulário: linha ST sem inscrição é pendência; certificado perto vence; "Sem certificado" completa', () => {
    const v = valoresDe(form({
      cnpj: '12.345.678/0001-95', razao_social: 'X', regime: 'MEI', segmentos: 'comercio', st_uf: ['SP', 'RJ'], st_inscricao: ['1', ''],
      certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-11-02', certificado_avisar_dias: '30', telefone: '3133334444',
      [`responsavel:${SETOR_FISCAL}`]: BIA,
    }));
    const e = estadoDosBlocos(v, AGORA);
    expect(e.identificacao).toEqual({ tipo: 'completo' });
    expect(e.fiscal).toEqual({ tipo: 'pendente', n: 1 });
    expect(e.contato).toEqual({ tipo: 'completo' });
    expect(e.responsaveis).toEqual({ tipo: 'completo' });
    expect(e.certificado).toEqual({ tipo: 'vence', dias: 23 });
    expect(estadoDosBlocos(valoresDe(form({ certificado_tipo: 'sem' })), AGORA).certificado).toEqual({ tipo: 'completo' });
    expect(estadoDosBlocos(valoresDe(form({ certificado_vencimento: '2030-10-01' })), AGORA).certificado).toEqual({ tipo: 'vencido', dias: 9 });
  });

  it('textos do índice (a cor nunca fala sozinha)', () => {
    expect(textoEstado({ tipo: 'pendente', n: 1 })).toBe('1 pendente');
    expect(textoEstado({ tipo: 'pendente', n: 2 })).toBe('2 pendentes');
    expect(textoEstado({ tipo: 'vence', dias: 23 })).toBe('vence');
    expect(textoEstado({ tipo: 'vencido', dias: 2 })).toBe('vencido');
    expect(textoEstado({ tipo: 'completo' })).toBe('completo');
    expect(textoEstado({ tipo: 'protegido' })).toBe('protegido');
    expect(textoEstado({ tipo: 'neutro' })).toBe('');
  });
});

describe('datas pelo dia de São Paulo', () => {
  it('23:30 em São Paulo ainda é o mesmo dia', () => {
    expect(diasAte('2030-10-11', new Date('2030-10-11T02:30:00Z'))).toBe(1);
    expect(diasAte('2030-10-11', new Date('2030-10-11T03:30:00Z'))).toBe(0);
  });
});

describe('cabeçalho e rodapé', () => {
  const c = { ativo: true, agente_pausado: false, regime: 'Simples Nacional', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-11-02', certificado_avisar_dias: 30 };
  it('etiquetas: situação, certificado e regime (sempre com texto)', () => {
    expect(etiquetasDoTopo(c, AGORA)).toEqual([
      { texto: 'Ativo', variante: 'success', icone: 'ponto' },
      { texto: 'Certificado vence em 23 dias', variante: 'warning', icone: 'certificado' },
      { texto: 'Simples Nacional', variante: 'neutral' },
    ]);
    expect(etiquetasDoTopo({ ...c, ativo: false, agente_pausado: true, certificado_vencimento: '2030-10-09', regime: null }, AGORA)).toEqual([
      { texto: 'Arquivado', variante: 'neutral' },
      { texto: 'Agente pausado para esta empresa', variante: 'agent-paused' },
      { texto: 'Certificado vencido há 1 dia', variante: 'danger', icone: 'certificado' },
    ]);
    expect(etiquetasDoTopo({ ...c, certificado_tipo: 'sem' }, AGORA).some((e) => e.texto.startsWith('Certificado'))).toBe(false);
  });
  it('cliente desde: início do contrato ou data do cadastro', () => {
    expect(clienteDesde('2022-03-01', '2026-09-27T10:00:00Z')).toBe('03/2022');
    expect(clienteDesde(null, '2026-09-27T10:00:00Z')).toBe('09/2026');
  });
  it('última alteração em São Paulo', () => {
    expect(textoUltimaAlteracao({ pessoa: 'Ana', quando: '2026-09-28T19:20:00Z' })).toBe('Ana, 28/09 16:20');
    expect(textoUltimaAlteracao(null)).toBeNull();
  });
});

describe('busca e responsáveis', () => {
  it('mensagens da busca (nunca travam)', () => {
    expect(mensagemBusca('cnpj', 'nao_encontrado')).toBe('Não achei este CNPJ na busca pública. Preencha à mão.');
    expect(mensagemBusca('cep', 'nao_encontrado')).toBe('Não achei este CEP. Preencha à mão.');
    expect(mensagemBusca('cep', 'indisponivel')).toBe('Não consegui buscar agora. Preencha à mão.');
    expect(textoPreenchido(['razao_social', 'nome_fantasia', 'cnae_principal', 'cep', 'logradouro'])).toBe(
      'Preenchido pela busca: razão social, nome fantasia, CNAE e endereço.');
    expect(textoPreenchido([])).toBe('A busca não trouxe nada novo: os campos já estavam preenchidos.');
  });
  it('setores dos serviços marcados (e os que já têm responsável) primeiro; o resto em "Outros setores" (D16)', () => {
    const setores = [{ id: 'f', nome: 'Fiscal' }, { id: 'p', nome: 'Pessoal' }, { id: 'n', nome: 'Financeiro' }, { id: 'l', nome: 'Legalização' }];
    const servicos = [{ id: 's1', nome: 'Fiscal', setor_id: 'f' }, { id: 's2', nome: 'Folha', setor_id: 'p' }];
    expect(separarSetores(setores, servicos, ['s1'], { n: BIA })).toEqual({ principais: [setores[0], setores[2]], outros: [setores[1], setores[3]] });
    expect(separarSetores(setores, servicos, [], {})).toEqual({ principais: setores, outros: [] });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel test -- ficha/ficha`
Expected: FAIL (`Cannot find module './ficha'`).

- [ ] **Passo 3: implementar**

`apps/painel/src/app/(painel)/clientes/ficha/ficha.ts`:

```ts
import { somenteDigitos, validarCnpj } from '@escritorio/core';
import { FUSO, formatarBRL, NBSP } from '@/lib/formatos';

/** Regras puras da ficha do cliente (spec 7D.1): opções, leitura do formulário, pendências do índice e textos. */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;
export const REGIMES = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'] as const;
export const PORTES = [{ valor: 'mei', rotulo: 'MEI' }, { valor: 'me', rotulo: 'ME' }, { valor: 'epp', rotulo: 'EPP' }, { valor: 'demais', rotulo: 'Demais' }] as const;
export const SEGMENTOS = [
  { valor: 'comercio', rotulo: 'Comércio' }, { valor: 'ecommerce', rotulo: 'E-commerce' },
  { valor: 'industria', rotulo: 'Indústria' }, { valor: 'servicos', rotulo: 'Serviços' },
] as const;
export const TIPOS_CERTIFICADO = [
  { valor: 'e_cnpj_a1', rotulo: 'e-CNPJ A1' }, { valor: 'e_cnpj_a3', rotulo: 'e-CNPJ A3' }, { valor: 'e_cpf_a1', rotulo: 'e-CPF A1' },
  { valor: 'e_cpf_a3', rotulo: 'e-CPF A3' }, { valor: 'sem', rotulo: 'Sem certificado' },
] as const;
export const AVISAR_DIAS = [15, 30, 45, 60, 90] as const;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const OPCOES_REAJUSTE = [
  { valor: 'sem', rotulo: 'Sem reajuste' },
  ...MESES.map((m, i) => ({ valor: `anual:${i + 1}`, rotulo: `Anual · ${m}` })),
  ...MESES.slice(0, 6).map((m, i) => ({ valor: `semestral:${i + 1}`, rotulo: `Semestral · ${m} e ${MESES[i + 6]}` })),
];

/** Regime da lista; o antigo escrito à mão continua como opção (D18). */
export function opcoesRegime(atual: string | null): { valor: string; rotulo: string }[] {
  const lista = REGIMES.map((r) => ({ valor: r, rotulo: r }));
  return atual && !(REGIMES as readonly string[]).includes(atual) ? [...lista, { valor: atual, rotulo: `${atual} (antigo)` }] : lista;
}

export function valorReajuste(reajuste: string | null, mes: number | null): string {
  if (!reajuste) return '';
  if (reajuste === 'sem') return 'sem';
  return mes ? `${reajuste}:${mes}` : '';
}

/** Os campos da ficha que a tela usa (a linha de clientes depois da migração 20261012000100). */
export type ClienteFicha = {
  id: string; razao_social: string; nome_fantasia: string | null; cnpj: string; ativo: boolean; agente_pausado: boolean; criado_em: string;
  inscricao_estadual: string | null; isento_ie: boolean; inscricao_municipal: string | null; cnae_principal: string | null;
  inscricao_suframa: string | null; regime: string | null; porte: string | null; faturamento_ultimo_ano: number | null;
  funcionarios: number | null; segmentos: string[]; cep: string | null; logradouro: string | null; numero: string | null;
  complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; telefone: string | null; celular: string | null;
  email: string | null; email_cobranca: string | null; site: string | null; contrato_inicio: string | null; contrato_fim: string | null;
  honorario_mensal: number | null; dia_vencimento: number | null; reajuste: string | null; reajuste_mes: number | null;
  decimo_terceiro: boolean | null; certificado_tipo: string | null; certificado_vencimento: string | null; certificado_avisar_dias: number;
};

export type ErrosFicha = { [campo: string]: string | undefined; geral?: string };
export type EstadoFicha = { ok: true; id: string } | { ok: false; erros: ErrosFicha };
export type DadosBanco = Record<string, unknown> & { cnpj: string };
export type LeituraFicha = { ok: true; dados: DadosBanco } | { ok: false; erros: ErrosFicha };

/** "R$ 1.250,00", "1250,5", "1250" → número; vazio → null; outro jeito → 'invalido'. */
export function lerDinheiro(texto: string): number | null | 'invalido' {
  const t = texto.replace(/R\$/g, '').replace(/[\s ]/g, '');
  if (!t) return null;
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) return 'invalido';
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

export function dinheiroNoCampo(valor: number | null): string {
  return valor === null ? '' : formatarBRL(valor).replace(`R$${NBSP}`, '');
}

function inteiro(t: string, min: number, max: number): number | null | 'invalido' {
  if (!t) return null;
  if (!/^\d+$/.test(t)) return 'invalido';
  const n = Number(t);
  return n >= min && n <= max ? n : 'invalido';
}

function lerReajuste(v: string): { reajuste: string | null; reajuste_mes: number | null } | 'invalido' {
  if (!v) return { reajuste: null, reajuste_mes: null };
  if (v === 'sem') return { reajuste: 'sem', reajuste_mes: null };
  const m = /^(anual|semestral):(\d{1,2})$/.exec(v);
  if (!m) return 'invalido';
  const mes = Number(m[2]);
  return mes >= 1 && mes <= (m[1] === 'anual' ? 12 : 6) ? { reajuste: m[1]!, reajuste_mes: mes } : 'invalido';
}

/** O formulário da ficha → o p_dados de salvar_ficha_cliente. Só razão social e CNPJ travam (D9); o resto vazio vira nulo. */
export function lerFicha(f: FormData, opcoes: { admin: boolean }): LeituraFicha {
  const t = (k: string) => String(f.get(k) ?? '').trim();
  const ou = (k: string) => t(k) || null;
  const erros: ErrosFicha = {};

  const razao = t('razao_social');
  if (razao.length < 2) erros.razao_social = 'Informe a razão social';
  const cnpj = somenteDigitos(t('cnpj'));
  if (!validarCnpj(cnpj)) erros.cnpj = 'CNPJ inválido';
  const cep = somenteDigitos(t('cep'));
  if (cep && cep.length !== 8) erros.cep = 'O CEP tem 8 números';
  const fone = (k: string) => {
    const d = somenteDigitos(t(k));
    if (d && (d.length < 10 || d.length > 13)) erros[k] = 'Telefone com DDD';
    return d || null;
  };
  const telefone = fone('telefone');
  const celular = fone('celular');
  const email = (k: string) => {
    const v = t(k).toLowerCase();
    if (v && !EMAIL.test(v)) erros[k] = 'E-mail inválido';
    return v || null;
  };
  const emailEmpresa = email('email');
  const emailCobranca = email('email_cobranca');
  const dinheiro = (k: string) => {
    const v = lerDinheiro(t(k));
    if (v !== 'invalido') return v;
    erros[k] = 'Valor inválido (ex.: 1.250,00)';
    return null;
  };
  const faturamento = dinheiro('faturamento_ultimo_ano');
  const honorario = dinheiro('honorario_mensal');
  const numero = (k: string, min: number, max: number, msg: string) => {
    const v = inteiro(t(k), min, max);
    if (v !== 'invalido') return v;
    erros[k] = msg;
    return null;
  };
  const funcionarios = numero('funcionarios', 0, 1_000_000, 'Número inválido');
  const dia = numero('dia_vencimento', 1, 31, 'Dia de 1 a 31');
  const avisar = numero('certificado_avisar_dias', 1, 180, 'Dias inválidos');
  const data = (k: string) => {
    const v = t(k);
    if (v && !DATA.test(v)) { erros[k] = 'Data inválida'; return null; }
    return v || null;
  };
  const inicio = data('contrato_inicio');
  const fim = data('contrato_fim');
  const vencimento = data('certificado_vencimento');
  if (inicio && fim && fim < inicio) erros.contrato_fim = 'O fim vem depois do início';
  const uf = t('uf').toUpperCase();
  if (uf && !(UFS as readonly string[]).includes(uf)) erros.uf = 'UF inválida';
  const porte = t('porte');
  if (porte && !PORTES.some((p) => p.valor === porte)) erros.porte = 'Porte inválido';
  const tipoCert = t('certificado_tipo');
  if (tipoCert && !TIPOS_CERTIFICADO.some((c) => c.valor === tipoCert)) erros.certificado_tipo = 'Tipo inválido';
  const reajuste = lerReajuste(t('reajuste'));
  if (reajuste === 'invalido') erros.reajuste = 'Reajuste inválido';
  const decimo = t('decimo_terceiro');
  const segmentos = [...new Set(f.getAll('segmentos').map(String))].filter((s) => SEGMENTOS.some((x) => x.valor === s));

  const ufsSt = f.getAll('st_uf').map((v) => String(v).trim().toUpperCase());
  const iesSt = f.getAll('st_inscricao').map((v) => String(v).trim());
  const inscricoes = ufsSt.map((u, i) => ({ uf: u, inscricao: iesSt[i] || null }));
  if (inscricoes.some((i) => !(UFS as readonly string[]).includes(i.uf))) erros.inscricoes_st = 'Escolha a UF de cada linha';
  else {
    const repetida = inscricoes.find((x, i) => inscricoes.findIndex((y) => y.uf === x.uf) !== i);
    if (repetida) erros.inscricoes_st = `UF repetida: ${repetida.uf}`;
  }

  const servicos = f.getAll('servico').map(String).filter((s) => UUID.test(s));
  const responsaveis: Record<string, string | null> = {};
  for (const [k, v] of f.entries()) {
    if (!k.startsWith('responsavel:')) continue;
    const setor = k.slice('responsavel:'.length);
    if (UUID.test(setor)) responsaveis[setor] = UUID.test(String(v)) ? String(v) : null;
  }
  const isento = f.get('isento_ie') === 'on';

  const campos = Object.keys(erros);
  if (campos.length) {
    const resto = campos.length > 1 ? ` Confira os ${campos.length} campos marcados.` : ' Confira o campo marcado.';
    return { ok: false, erros: { ...erros, geral: `Não foi possível salvar: ${erros[campos[0]!]}.${resto}` } };
  }
  return {
    ok: true,
    dados: {
      razao_social: razao, nome_fantasia: ou('nome_fantasia'), cnpj, tipo_pessoa: 'juridica', isento_ie: isento,
      inscricao_estadual: isento ? null : ou('inscricao_estadual'), inscricao_municipal: ou('inscricao_municipal'),
      cnae_principal: ou('cnae_principal'), inscricao_suframa: ou('inscricao_suframa'), regime: ou('regime'), porte: porte || null,
      faturamento_ultimo_ano: faturamento, funcionarios, segmentos, cep: cep || null, logradouro: ou('logradouro'), numero: ou('numero'),
      complemento: ou('complemento'), bairro: ou('bairro'), cidade: ou('cidade'), uf: uf || null, telefone, celular,
      email: emailEmpresa, email_cobranca: emailCobranca, site: ou('site'), contrato_inicio: inicio, contrato_fim: fim,
      honorario_mensal: honorario, dia_vencimento: dia,
      reajuste: reajuste === 'invalido' ? null : reajuste.reajuste, reajuste_mes: reajuste === 'invalido' ? null : reajuste.reajuste_mes,
      decimo_terceiro: decimo === 'sim' ? true : decimo === 'nao' ? false : null,
      certificado_tipo: tipoCert || null, certificado_vencimento: vencimento, certificado_avisar_dias: avisar ?? 30,
      servicos, responsaveis, inscricoes_st: inscricoes,
      ...(opcoes.admin ? { agente_pausado: f.get('agente_pausado') === 'on' } : {}),
    },
  };
}

// ---------- Índice (D28) ----------

export type Bloco = 'identificacao' | 'endereco' | 'contato' | 'fiscal' | 'contrato' | 'responsaveis' | 'certificado' | 'acessos';
export const BLOCOS: { id: Bloco; rotulo: string }[] = [
  { id: 'identificacao', rotulo: 'Identificação' }, { id: 'endereco', rotulo: 'Endereço' }, { id: 'contato', rotulo: 'Contato' },
  { id: 'fiscal', rotulo: 'Fiscal' }, { id: 'contrato', rotulo: 'Contrato e honorários' }, { id: 'responsaveis', rotulo: 'Responsáveis' },
  { id: 'certificado', rotulo: 'Certificado digital' }, { id: 'acessos', rotulo: 'Acessos de portais' },
];
export type EstadoBloco =
  | { tipo: 'completo' } | { tipo: 'pendente'; n: number } | { tipo: 'vence'; dias: number }
  | { tipo: 'vencido'; dias: number } | { tipo: 'neutro' } | { tipo: 'protegido' };
export type ValoresFicha = { campos: Record<string, string>; segmentos: number; st: { uf: string; inscricao: string }[]; responsaveis: number };

const OBRIGATORIOS = {
  identificacao: ['cnpj', 'razao_social', 'regime'],
  endereco: ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'],
  contrato: ['contrato_inicio', 'honorario_mensal'],
} as const;

/** O que está no formulário agora (a tela relê a cada digitação). */
export function valoresDe(f: FormData): ValoresFicha {
  const campos: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === 'string' && !(k in campos)) campos[k] = v.trim();
  const ies = f.getAll('st_inscricao');
  return {
    campos,
    segmentos: f.getAll('segmentos').length,
    st: f.getAll('st_uf').map((u, i) => ({ uf: String(u), inscricao: String(ies[i] ?? '').trim() })),
    responsaveis: [...f.entries()].filter(([k, v]) => k.startsWith('responsavel:') && String(v)).length,
  };
}

/** O que está salvo (para quem só vê: os campos desligados não vão no FormData). */
export function valoresDoCliente(c: ClienteFicha | null, st: { uf: string; inscricao: string | null }[], nResponsaveis: number): ValoresFicha {
  const campos: Record<string, string> = {};
  if (c) {
    for (const [k, v] of Object.entries(c)) if (v !== null && typeof v !== 'object' && typeof v !== 'boolean') campos[k] = String(v);
  }
  return { campos, segmentos: c?.segmentos.length ?? 0, st: st.map((s) => ({ uf: s.uf, inscricao: s.inscricao ?? '' })), responsaveis: nResponsaveis };
}

export function hojeSP(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

/** Dias corridos de hoje (em São Paulo) até a data (AAAA-MM-DD); negativo = já passou. */
export function diasAte(data: string, agora: Date): number {
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const [x, y, z] = hojeSP(agora).split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(x, y - 1, z)) / 86_400_000);
}

export function estadoCertificado(tipo: string | undefined, vencimento: string | undefined, avisar: number, agora: Date): EstadoBloco {
  if (tipo === 'sem') return { tipo: 'completo' };
  if (!vencimento) return { tipo: 'pendente', n: 1 };
  const dias = diasAte(vencimento, agora);
  if (dias < 0) return { tipo: 'vencido', dias: -dias };
  if (dias <= avisar) return { tipo: 'vence', dias };
  return { tipo: 'completo' };
}

export function estadoDosBlocos(v: ValoresFicha, agora: Date): Record<Bloco, EstadoBloco> {
  const faltam = (ks: readonly string[]) => ks.filter((k) => !v.campos[k]).length;
  const pend = (n: number): EstadoBloco => (n ? { tipo: 'pendente', n } : { tipo: 'completo' });
  const algum = ['telefone', 'celular', 'email', 'email_cobranca', 'site'].some((k) => v.campos[k]);
  return {
    identificacao: pend(faltam(OBRIGATORIOS.identificacao) + (v.segmentos ? 0 : 1)),
    endereco: pend(faltam(OBRIGATORIOS.endereco)),
    contato: algum ? { tipo: 'completo' } : { tipo: 'neutro' },
    fiscal: v.st.length === 0 ? { tipo: 'neutro' } : pend(v.st.filter((s) => !s.inscricao).length),
    contrato: pend(faltam(OBRIGATORIOS.contrato)),
    responsaveis: v.responsaveis ? { tipo: 'completo' } : { tipo: 'neutro' },
    certificado: estadoCertificado(v.campos.certificado_tipo, v.campos.certificado_vencimento, Number(v.campos.certificado_avisar_dias) || 30, agora),
    acessos: { tipo: 'protegido' },
  };
}

export function textoEstado(e: EstadoBloco): string {
  switch (e.tipo) {
    case 'completo': return 'completo';
    case 'pendente': return e.n === 1 ? '1 pendente' : `${e.n} pendentes`;
    case 'vence': return 'vence';
    case 'vencido': return 'vencido';
    case 'protegido': return 'protegido';
    default: return '';
  }
}

// ---------- Cabeçalho e rodapé ----------

export type Etiqueta = { texto: string; variante: 'success' | 'neutral' | 'warning' | 'danger' | 'agent-paused'; icone?: 'ponto' | 'certificado' };

export function etiquetasDoTopo(c: {
  ativo: boolean; agente_pausado: boolean; regime: string | null; certificado_tipo?: string | null;
  certificado_vencimento?: string | null; certificado_avisar_dias?: number | null;
}, agora: Date): Etiqueta[] {
  const e: Etiqueta[] = [c.ativo ? { texto: 'Ativo', variante: 'success', icone: 'ponto' } : { texto: 'Arquivado', variante: 'neutral' }];
  if (c.agente_pausado) e.push({ texto: 'Agente pausado para esta empresa', variante: 'agent-paused' });
  if (c.certificado_vencimento && c.certificado_tipo !== 'sem') {
    const dias = diasAte(c.certificado_vencimento, agora);
    const plural = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
    if (dias < 0) e.push({ texto: `Certificado vencido há ${plural(-dias)}`, variante: 'danger', icone: 'certificado' });
    else if (dias === 0) e.push({ texto: 'Certificado vence hoje', variante: 'warning', icone: 'certificado' });
    else if (dias <= (c.certificado_avisar_dias ?? 30)) e.push({ texto: `Certificado vence em ${plural(dias)}`, variante: 'warning', icone: 'certificado' });
  }
  if (c.regime) e.push({ texto: c.regime, variante: 'neutral' });
  return e;
}

/** "03/2022": início do contrato ou, sem ele, o cadastro. */
export function clienteDesde(contratoInicio: string | null, criadoEm: string): string {
  if (contratoInicio) return `${contratoInicio.slice(5, 7)}/${contratoInicio.slice(0, 4)}`;
  const [a, m] = hojeSP(new Date(criadoEm)).split('-');
  return `${m}/${a}`;
}

/** "Ana, 28/09 16:20" (D24). */
export function textoUltimaAlteracao(u: { pessoa: string; quando: string } | null): string | null {
  if (!u) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(u.quando)).map((x) => [x.type, x.value]));
  return `${u.pessoa}, ${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

// ---------- Busca e responsáveis ----------

export function mensagemBusca(tipo: 'cnpj' | 'cep', motivo: 'nao_encontrado' | 'indisponivel' | 'invalido' | 'sem_permissao'): string {
  if (motivo === 'indisponivel') return 'Não consegui buscar agora. Preencha à mão.';
  if (motivo === 'sem_permissao') return 'Só quem pode editar clientes usa a busca.';
  if (motivo === 'invalido') return tipo === 'cnpj' ? 'Confira os 14 números do CNPJ.' : 'O CEP tem 8 números.';
  return tipo === 'cnpj' ? 'Não achei este CNPJ na busca pública. Preencha à mão.' : 'Não achei este CEP. Preencha à mão.';
}

const GRUPOS_BUSCA: [string, string[]][] = [
  ['razão social', ['razao_social']], ['nome fantasia', ['nome_fantasia']], ['CNAE', ['cnae_principal']],
  ['endereço', ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']],
];
export function textoPreenchido(campos: string[]): string {
  const grupos = GRUPOS_BUSCA.filter(([, ks]) => ks.some((k) => campos.includes(k))).map(([g]) => g);
  if (!grupos.length) return 'A busca não trouxe nada novo: os campos já estavam preenchidos.';
  const lista = grupos.length === 1 ? grupos[0] : `${grupos.slice(0, -1).join(', ')} e ${grupos.at(-1)}`;
  return `Preenchido pela busca: ${lista}.`;
}

/** D16: setores dos serviços marcados e os que já têm responsável primeiro; os outros em "Outros setores". */
export function separarSetores<S extends { id: string }>(setores: S[], servicos: { id: string; setor_id: string | null }[],
  contratados: string[], responsaveis: Record<string, string>): { principais: S[]; outros: S[] } {
  const ligados = new Set(servicos.filter((s) => contratados.includes(s.id) && s.setor_id).map((s) => s.setor_id!));
  for (const setor of Object.keys(responsaveis)) ligados.add(setor);
  if (!ligados.size) return { principais: setores, outros: [] };
  return { principais: setores.filter((s) => ligados.has(s.id)), outros: setores.filter((s) => !ligados.has(s.id)) };
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel test -- ficha/ficha && pnpm --filter @escritorio/painel typecheck`
Expected: todos os testes de `ficha.test.ts` passam; typecheck verde. (Se o `toEqual` das etiquetas pegar uma chave `icone: undefined`, a implementação está criando a chave sem valor: não crie.)

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/clientes/ficha/ficha.ts" "apps/painel/src/app/(painel)/clientes/ficha/ficha.test.ts"
git commit -m "$(cat <<'EOF'
feat(painel): regras da ficha do cliente — leitura do formulário, pendências do índice, etiquetas e textos da busca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Painel. Ações da ficha (salvar numa chamada; buscar CNPJ e CEP)

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/ficha/acoes.ts`, `apps/painel/src/app/(painel)/clientes/ficha/acoes.test.ts`

**Interfaces:**
- Consumes: `lerFicha`, `UUID`, `EstadoFicha`, `ErrosFicha` (Task 7); `consultarCnpj`, `consultarCep`, `DadosCnpj`, `DadosCep`, `ResultadoBusca` (Task 6); `obterUsuario`, `temNivel`, `supabaseServidor`; RPC `salvar_ficha_cliente` (Task 1).
- Produces (server actions): `salvarFicha(id: string | null, formData): Promise<EstadoFicha>`; `buscarCnpj(cnpj): Promise<RespostaBusca<DadosCnpj>>`; `buscarCep(cep): Promise<RespostaBusca<DadosCep>>`; tipo `RespostaBusca<T> = ResultadoBusca<T> | { ok: false; motivo: 'invalido' | 'sem_permissao' }`.

- [ ] **Passo 1: escrever o teste que falha**

`apps/painel/src/app/(painel)/clientes/ficha/acoes.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  papel: 'atendente' as 'admin' | 'atendente',
  clientes: 'editar' as 'ver' | 'editar',
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  erroRpc: null as { code?: string; message: string } | null,
  arquivado: false,
  buscas: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({
  obterUsuario: async () => ({ id: 'eu', papel: falso.papel, niveis: { clientes: falso.clientes }, setores: [] }),
}));
vi.mock('@/lib/permissoes', () => ({
  temNivel: (u: { papel: string; niveis: { clientes: string } }, _m: string, minimo: string) =>
    u.papel === 'admin' || minimo === 'ver' || u.niveis.clientes === 'editar',
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      falso.rpcs.push({ nome, args });
      return falso.erroRpc ? { data: null, error: falso.erroRpc } : { data: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', error: null };
    },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: falso.arquivado ? { id: 'x' } : null }) }) }) }) }),
  }),
}));
vi.mock('@/lib/consultas-publicas', () => ({
  consultarCnpj: async (n: string) => { falso.buscas.push(n); return { ok: false, motivo: 'nao_encontrado' }; },
  consultarCep: async (n: string) => { falso.buscas.push(n); return { ok: true, dados: { logradouro: 'Rua X', bairro: null, cidade: null, uf: 'MG' } }; },
}));

import { buscarCep, buscarCnpj, salvarFicha } from './acoes';

function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}
const BASE = { razao_social: 'Padaria Sol ME', cnpj: '12.345.678/0001-95' };

beforeEach(() => {
  Object.assign(falso, { papel: 'atendente', clientes: 'editar', rpcs: [], erroRpc: null, arquivado: false, buscas: [] });
});

describe('salvarFicha', () => {
  it('grava tudo numa chamada de salvar_ficha_cliente e devolve o id', async () => {
    expect(await salvarFicha(null, form({ ...BASE, agente_pausado: 'on' }))).toEqual({ ok: true, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(falso.rpcs).toHaveLength(1);
    expect(falso.rpcs[0]!.nome).toBe('salvar_ficha_cliente');
    expect(falso.rpcs[0]!.args.p_id).toBeNull();
    expect(falso.rpcs[0]!.args.p_dados).toMatchObject({ razao_social: 'Padaria Sol ME', cnpj: '12345678000195' });
    expect(falso.rpcs[0]!.args.p_dados).not.toHaveProperty('agente_pausado');
  });

  it('administrador manda a pausa do agente', async () => {
    falso.papel = 'admin';
    await salvarFicha(null, form({ ...BASE, agente_pausado: 'on' }));
    expect(falso.rpcs[0]!.args.p_dados).toMatchObject({ agente_pausado: true });
  });

  it('"Só ver" nem chama o banco', async () => {
    falso.clientes = 'ver';
    expect(await salvarFicha(null, form(BASE))).toEqual({ ok: false, erros: { geral: 'Não foi possível salvar: você não tem permissão para editar clientes.' } });
    expect(falso.rpcs).toEqual([]);
  });

  it('erro de validação volta no campo, sem chamar o banco', async () => {
    const r = await salvarFicha(null, form({ razao_social: 'Cliente Com CNPJ Errado', cnpj: '11.222.333/0001-99' }));
    expect(r).toEqual({ ok: false, erros: { cnpj: 'CNPJ inválido', geral: 'Não foi possível salvar: CNPJ inválido. Confira o campo marcado.' } });
    expect(falso.rpcs).toEqual([]);
  });

  it('CNPJ repetido: aponta os arquivados quando é de um cliente arquivado (texto de hoje)', async () => {
    falso.erroRpc = { code: '23505', message: 'duplicate key value violates unique constraint "clientes_cnpj_key"' };
    falso.arquivado = true;
    expect(await salvarFicha(null, form(BASE))).toEqual({ ok: false, erros: {
      cnpj: 'CNPJ já cadastrado', geral: 'Não foi possível salvar: Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.' } });
    falso.arquivado = false;
    expect(await salvarFicha(null, form(BASE))).toEqual({ ok: false, erros: {
      cnpj: 'CNPJ já cadastrado', geral: 'Não foi possível salvar: Já existe cliente com este CNPJ.' } });
  });

  it('recusa conhecida do banco aparece como veio; desconhecida vira aviso fixo', async () => {
    falso.erroRpc = { message: 'UF repetida nas inscrições de substituto tributário.' };
    expect(await salvarFicha('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', form(BASE))).toEqual({ ok: false, erros: {
      geral: 'Não foi possível salvar: UF repetida nas inscrições de substituto tributário.' } });
    falso.erroRpc = { message: 'column "x" does not exist' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await salvarFicha('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', form(BASE))).toEqual({ ok: false, erros: {
      geral: 'Não foi possível salvar: não consegui gravar agora. Tente de novo.' } });
  });

  it('id fora do formato não chega ao banco', async () => {
    expect((await salvarFicha('1; drop', form(BASE))).ok).toBe(false);
    expect(falso.rpcs).toEqual([]);
  });
});

describe('buscas', () => {
  it('só o número vai para a busca; CNPJ inválido nem sai', async () => {
    expect(await buscarCnpj('12.345.678/0001-95')).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await buscarCnpj('11.222.333/0001-99')).toEqual({ ok: false, motivo: 'invalido' });
    expect(await buscarCep('36.404-450')).toMatchObject({ ok: true });
    expect(await buscarCep('123')).toEqual({ ok: false, motivo: 'invalido' });
    expect(falso.buscas).toEqual(['12345678000195', '36404450']);
  });

  it('"Só ver" não usa a busca', async () => {
    falso.clientes = 'ver';
    expect(await buscarCnpj('12345678000195')).toEqual({ ok: false, motivo: 'sem_permissao' });
    expect(falso.buscas).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel test -- ficha/acoes`
Expected: FAIL (`Cannot find module './acoes'`).

- [ ] **Passo 3: implementar**

`apps/painel/src/app/(painel)/clientes/ficha/acoes.ts`:

```ts
'use server';
import { somenteDigitos, validarCnpj } from '@escritorio/core';
import { revalidatePath } from 'next/cache';
import { consultarCep, consultarCnpj, type DadosCep, type DadosCnpj, type ResultadoBusca } from '@/lib/consultas-publicas';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerFicha, UUID, type ErrosFicha, type EstadoFicha } from './ficha';

const SEM_PERMISSAO = 'Não foi possível salvar: você não tem permissão para editar clientes.';
const FALHA = 'Não foi possível salvar: não consegui gravar agora. Tente de novo.';
// Recusas de salvar_ficha_cliente que já falam com a pessoa; o resto vira aviso fixo (o original fica no log).
const RECUSAS = new Set([
  'Você não tem permissão para editar clientes.', 'Informe a razão social.', 'Cliente não encontrado.',
  'UF repetida nas inscrições de substituto tributário.',
]);

/** A aba Dados inteira numa chamada (D13). O erro volta para a tela, no campo, sem perder o que foi digitado. */
export async function salvarFicha(id: string | null, formData: FormData): Promise<EstadoFicha> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erros: { geral: SEM_PERMISSAO } };
  if (id !== null && !UUID.test(id)) return { ok: false, erros: { geral: FALHA } };
  const lido = lerFicha(formData, { admin: u.papel === 'admin' });
  if (!lido.ok) return lido;
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('salvar_ficha_cliente', { p_id: id as string, p_dados: lido.dados as never });
  if (error) return { ok: false, erros: await errosDoBanco(sb, error, lido.dados.cnpj) };
  revalidatePath('/clientes');
  revalidatePath(`/clientes/${data}`);
  return { ok: true, id: data as string };
}

async function errosDoBanco(sb: Awaited<ReturnType<typeof supabaseServidor>>, error: { code?: string; message: string }, cnpj: string): Promise<ErrosFicha> {
  if (error.code === '23505' || error.message.includes('duplicate')) {
    // CNPJ é único também entre os arquivados: aponta o caminho em vez de um "já existe" sem saída (texto de hoje).
    const { data: arquivado } = await sb.from('clientes').select('id').eq('cnpj', cnpj).eq('ativo', false).maybeSingle();
    return {
      cnpj: 'CNPJ já cadastrado',
      geral: `Não foi possível salvar: ${arquivado ? 'Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.' : 'Já existe cliente com este CNPJ.'}`,
    };
  }
  if (RECUSAS.has(error.message)) return { geral: `Não foi possível salvar: ${error.message}` };
  console.error('[ficha do cliente] salvar recusado', error.message);
  return { geral: FALHA };
}

export type RespostaBusca<T> = ResultadoBusca<T> | { ok: false; motivo: 'invalido' | 'sem_permissao' };

/** Busca pública pelo servidor (spec 7D.1, D15): só para quem edita, só com o número. */
export async function buscarCnpj(cnpj: string): Promise<RespostaBusca<DadosCnpj>> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, motivo: 'sem_permissao' };
  const numero = somenteDigitos(cnpj);
  if (!validarCnpj(numero)) return { ok: false, motivo: 'invalido' };
  return consultarCnpj(numero);
}

export async function buscarCep(cep: string): Promise<RespostaBusca<DadosCep>> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, motivo: 'sem_permissao' };
  const numero = somenteDigitos(cep);
  if (numero.length !== 8) return { ok: false, motivo: 'invalido' };
  return consultarCep(numero);
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel test -- ficha/acoes && pnpm --filter @escritorio/painel typecheck`
Expected: 9 testes passam; typecheck verde (se reclamar de `p_id: id as string`, o tipo gerado exige `string`: mantenha o `as string`, o PostgREST envia `null`).

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/clientes/ficha/acoes.ts" "apps/painel/src/app/(painel)/clientes/ficha/acoes.test.ts"
git commit -m "$(cat <<'EOF'
feat(painel): salvar a ficha do cliente numa chamada e buscar CNPJ/CEP pelo servidor, com os avisos de hoje para CNPJ repetido

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Painel. Ações dos acessos de portais e da permissão "Ver acessos de portais"

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/ficha/acessos-acoes.ts`, `apps/painel/src/app/(painel)/clientes/ficha/acessos-acoes.test.ts`, `apps/painel/src/app/(painel)/clientes/ficha/acessos-textos.ts`
- Create: `apps/painel/src/app/(painel)/usuarios/ver-acessos.ts`, `apps/painel/src/app/(painel)/usuarios/ver-acessos.test.ts`

**Interfaces:**
- Consumes: `cifrar`, `decifrar`, `cofreConfigurado`, `contextoAcesso`, `ErroCofre` (Task 5); RPCs `salvar_acesso`, `remover_acesso`, `revelar_acesso`, `definir_ver_acessos` (Task 2); `obterUsuario`, `exigirAdmin`, `temNivel`, `supabaseServidor`; `UUID` (Task 7).
- Produces:
  - `salvarAcesso(clienteId, acessoId | null, formData): Promise<EstadoAcesso>` (campos `portal`, `usuario`, `senha`, `sem_senha`);
  - `removerAcesso(clienteId, acessoId): Promise<{ ok: true } | { ok: false; erro: string }>`;
  - `revelarAcesso(acessoId)` / `copiarAcesso(acessoId)`: `Promise<{ ok: true; senha: string } | { ok: false; erro: string }>`;
  - `acessos-textos.ts`: `SEM_CHAVE`, `SEM_PERMISSAO_VER`, `SEM_PERMISSAO_MUDAR` (num arquivo à parte: um arquivo `'use server'` só exporta funções);
  - `definirVerAcessos(id, pode): Promise<{ ok: true } | { ok: false; erro: string }>`.

- [ ] **Passo 1: escrever os testes que falham**

`apps/painel/src/app/(painel)/clientes/ficha/acessos-acoes.test.ts`:

```ts
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  clientes: 'editar' as 'ver' | 'editar',
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  guardada: null as string | null,
  erroRpc: null as { message: string } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'eu', papel: 'atendente', niveis: { clientes: falso.clientes }, setores: [] }) }));
vi.mock('@/lib/permissoes', () => ({ temNivel: (u: { niveis: { clientes: string } }) => u.niveis.clientes === 'editar' }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      falso.rpcs.push({ nome, args });
      if (falso.erroRpc) return { data: null, error: falso.erroRpc };
      if (nome === 'salvar_acesso') { falso.guardada = args.p_senha_cifrada as string; return { data: ACESSO, error: null }; }
      if (nome === 'revelar_acesso') return { data: { cliente_id: CLIENTE, senha_cifrada: falso.guardada }, error: null };
      return { data: null, error: null };
    },
  }),
}));

import { FORMATO_CIFRADO } from '@/lib/cofre';
import { copiarAcesso, removerAcesso, revelarAcesso, salvarAcesso } from './acessos-acoes';
import { SEM_CHAVE, SEM_PERMISSAO_MUDAR, SEM_PERMISSAO_VER } from './acessos-textos';

const CLIENTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACESSO = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SENHA = 'Portal#Segredo-2026';
function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.stubEnv('ACESSOS_PORTAIS_CHAVE', randomBytes(32).toString('base64'));
  Object.assign(falso, { clientes: 'editar', rpcs: [], guardada: null, erroRpc: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('acessos de portais (D1, D5, D6)', () => {
  it('a senha sai daqui só cifrada; revelar devolve a senha', async () => {
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', usuario: 'padariasol', senha: SENHA }))).toEqual({ ok: true });
    const args = falso.rpcs[0]!.args;
    expect(args).toMatchObject({ p_id: null, p_cliente: CLIENTE, p_portal: 'SEFAZ-MG', p_usuario: 'padariasol' });
    expect(args.p_senha_cifrada).toMatch(FORMATO_CIFRADO);
    expect(JSON.stringify(falso.rpcs)).not.toContain('Segredo');
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: true, senha: SENHA });
    expect(await copiarAcesso(ACESSO)).toEqual({ ok: true, senha: SENHA });
    expect(falso.rpcs.slice(1).map((r) => r.args)).toEqual([{ p_id: ACESSO, p_acao: 'revelar' }, { p_id: ACESSO, p_acao: 'copiar' }]);
  });

  it('editar sem senha manda nulo (mantém); "Sem senha" manda vazio', async () => {
    await salvarAcesso(CLIENTE, ACESSO, form({ portal: 'SEFAZ-MG', usuario: 'novo', senha: '' }));
    await salvarAcesso(CLIENTE, ACESSO, form({ portal: 'e-CAC', usuario: 'via certificado', senha: 'ignorada', sem_senha: 'on' }));
    expect(falso.rpcs.map((r) => r.args.p_senha_cifrada)).toEqual([null, '']);
  });

  it('novo acesso sem senha e sem "Sem senha" pede a senha; portal vazio recusa', async () => {
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG' }))).toEqual({ ok: false, erros: { senha: 'Informe a senha ou marque "Sem senha".' } });
    expect(await salvarAcesso(CLIENTE, null, form({ portal: ' ', senha: 'x' }))).toEqual({ ok: false, erros: { portal: 'Informe o portal (até 80 letras).' } });
    expect(falso.rpcs).toEqual([]);
  });

  it('sem a chave no ambiente: nada sai e o aviso explica (D8)', async () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }))).toEqual({ ok: false, erros: { geral: SEM_CHAVE } });
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: SEM_CHAVE });
    expect(falso.rpcs).toEqual([]);
  });

  it('"Só ver" não cadastra nem remove (o banco confere de novo)', async () => {
    falso.clientes = 'ver';
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }))).toEqual({ ok: false, erros: { geral: SEM_PERMISSAO_MUDAR } });
    expect(await removerAcesso(CLIENTE, ACESSO)).toEqual({ ok: false, erro: SEM_PERMISSAO_MUDAR });
    expect(falso.rpcs).toEqual([]);
  });

  it('sem "Ver acessos de portais" o banco recusa e a tela diz por quê', async () => {
    falso.erroRpc = { message: 'Sem permissão para ver acessos de portais.' };
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: SEM_PERMISSAO_VER });
  });

  it('cifra que não abre (chave trocada) vira aviso, sem detalhe', async () => {
    await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }));
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', randomBytes(32).toString('base64'));
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: 'Não consegui abrir esta senha. Cadastre de novo.' });
  });

  it('o arquivo das ações não escreve no console (a senha nunca vai para log)', () => {
    const fonte = readFileSync(fileURLToPath(new URL('./acessos-acoes.ts', import.meta.url)), 'utf8');
    expect(fonte).not.toMatch(/console\./);
  });
});
```

`apps/painel/src/app/(painel)/usuarios/ver-acessos.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ rpcs: [] as { nome: string; args: Record<string, unknown> }[], erro: null as { message: string } | null }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ rpc: async (nome: string, args: Record<string, unknown>) => { falso.rpcs.push({ nome, args }); return { error: falso.erro }; } }),
}));

import { definirVerAcessos } from './ver-acessos';

const BIA = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { falso.rpcs = []; falso.erro = null; });

describe('permissão "Ver acessos de portais" (D3, D4)', () => {
  it('grava na hora pela função do banco', async () => {
    expect(await definirVerAcessos(BIA, true)).toEqual({ ok: true });
    expect(falso.rpcs).toEqual([{ nome: 'definir_ver_acessos', args: { p_usuario: BIA, p_pode: true } }]);
  });
  it('id fora do formato não chega ao banco; erro desconhecido vira aviso fixo', async () => {
    expect(await definirVerAcessos('x', true)).toEqual({ ok: false, erro: 'Pessoa não encontrada.' });
    expect(falso.rpcs).toEqual([]);
    falso.erro = { message: 'qualquer coisa do banco' };
    expect(await definirVerAcessos(BIA, false)).toEqual({ ok: false, erro: 'Não consegui salvar agora. Tente de novo.' });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `pnpm --filter @escritorio/painel test -- acessos-acoes ver-acessos`
Expected: FAIL (`Cannot find module './acessos-acoes'` e `'./ver-acessos'`).

- [ ] **Passo 3: implementar**

`apps/painel/src/app/(painel)/clientes/ficha/acessos-textos.ts` (textos usados pela ação e pela tela; arquivo sem `'use server'`, porque um arquivo de ações só exporta funções):

```ts
export const SEM_CHAVE = 'Guardar e revelar senhas precisa da chave do escritório neste ambiente (ACESSOS_PORTAIS_CHAVE).';
export const SEM_PERMISSAO_VER = 'Só com a permissão "Ver acessos de portais".';
export const SEM_PERMISSAO_MUDAR = 'Cadastrar acesso precisa de "Ver e editar" em Clientes e da permissão "Ver acessos de portais".';
```

`apps/painel/src/app/(painel)/clientes/ficha/acessos-acoes.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { cifrar, cofreConfigurado, contextoAcesso, decifrar } from '@/lib/cofre';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { SEM_CHAVE, SEM_PERMISSAO_MUDAR, SEM_PERMISSAO_VER } from './acessos-textos';
import { UUID } from './ficha';

// Spec 7D.1 item 8: a senha entra aqui em claro, sai cifrada para o banco e só volta decifrada para quem revelou.
// Nada deste arquivo escreve no console nem põe a senha em mensagem de erro (teste de guarda).

export type EstadoAcesso = { ok: true } | { ok: false; erros: { portal?: string; usuario?: string; senha?: string; geral?: string } };
const FALHA = 'Não consegui salvar agora. Tente de novo.';
const RECUSAS = new Map([
  ['Sem permissão para mudar acessos de portais.', SEM_PERMISSAO_MUDAR],
  ['Sem permissão para ver acessos de portais.', SEM_PERMISSAO_VER],
  ['Este acesso não tem senha guardada.', 'Este acesso não tem senha guardada.'],
  ['Acesso não encontrado.', 'Acesso não encontrado.'],
]);

export async function salvarAcesso(clienteId: string, acessoId: string | null, formData: FormData): Promise<EstadoAcesso> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erros: { geral: SEM_PERMISSAO_MUDAR } };
  if (!UUID.test(clienteId) || (acessoId !== null && !UUID.test(acessoId))) return { ok: false, erros: { geral: FALHA } };
  const portal = String(formData.get('portal') ?? '').trim();
  const usuario = String(formData.get('usuario') ?? '').trim();
  const semSenha = formData.get('sem_senha') === 'on';
  const senha = String(formData.get('senha') ?? '');
  const erros: { portal?: string; usuario?: string; senha?: string } = {};
  if (!portal || portal.length > 80) erros.portal = 'Informe o portal (até 80 letras).';
  if (usuario.length > 120) erros.usuario = 'Usuário com até 120 letras.';
  if (!semSenha && senha.length > 200) erros.senha = 'Senha com até 200 letras.';
  if (!semSenha && !senha && acessoId === null) erros.senha = 'Informe a senha ou marque "Sem senha".';
  if (Object.keys(erros).length) return { ok: false, erros };

  // nulo = mantém a senha guardada; '' = sem senha (D6).
  let cifrada: string | null = null;
  if (semSenha) cifrada = '';
  else if (senha) {
    if (!cofreConfigurado()) return { ok: false, erros: { geral: SEM_CHAVE } };
    cifrada = cifrar(senha, contextoAcesso(clienteId));
  }
  const { error } = await (await supabaseServidor()).rpc('salvar_acesso', {
    p_id: acessoId as string, p_cliente: clienteId, p_portal: portal, p_usuario: usuario, p_senha_cifrada: cifrada as string,
  });
  if (error) return { ok: false, erros: { geral: RECUSAS.get(error.message) ?? FALHA } };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

export async function removerAcesso(clienteId: string, acessoId: string): Promise<{ ok: true } | { ok: false; erro: string }> {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) return { ok: false, erro: SEM_PERMISSAO_MUDAR };
  if (!UUID.test(clienteId) || !UUID.test(acessoId)) return { ok: false, erro: FALHA };
  const { error } = await (await supabaseServidor()).rpc('remover_acesso', { p_id: acessoId });
  if (error) return { ok: false, erro: RECUSAS.get(error.message) ?? FALHA };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}

type SenhaAberta = { ok: true; senha: string } | { ok: false; erro: string };

/** Revelar e copiar passam pelo banco (permissão + auditoria, D5) e só depois a senha é decifrada aqui. */
async function abrir(acessoId: string, acao: 'revelar' | 'copiar'): Promise<SenhaAberta> {
  if (!UUID.test(acessoId)) return { ok: false, erro: 'Acesso não encontrado.' };
  if (!cofreConfigurado()) return { ok: false, erro: SEM_CHAVE };
  const { data, error } = await (await supabaseServidor()).rpc('revelar_acesso', { p_id: acessoId, p_acao: acao });
  if (error) return { ok: false, erro: RECUSAS.get(error.message) ?? 'Não consegui abrir a senha agora. Tente de novo.' };
  const r = data as { cliente_id: string; senha_cifrada: string };
  try {
    return { ok: true, senha: decifrar(r.senha_cifrada, contextoAcesso(r.cliente_id)) };
  } catch {
    return { ok: false, erro: 'Não consegui abrir esta senha. Cadastre de novo.' };
  }
}

export async function revelarAcesso(acessoId: string): Promise<SenhaAberta> {
  return abrir(acessoId, 'revelar');
}

export async function copiarAcesso(acessoId: string): Promise<SenhaAberta> {
  return abrir(acessoId, 'copiar');
}
```

`apps/painel/src/app/(painel)/usuarios/ver-acessos.ts`:

```ts
'use server';
import { revalidatePath } from 'next/cache';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Ver acessos de portais" (D3, D4): só o administrador; grava na hora e a auditoria de usuarios registra quem deu. */
export async function definirVerAcessos(id: string, pode: boolean): Promise<{ ok: true } | { ok: false; erro: string }> {
  await exigirAdmin();
  if (!UUID.test(id)) return { ok: false, erro: 'Pessoa não encontrada.' };
  const { error } = await (await supabaseServidor()).rpc('definir_ver_acessos', { p_usuario: id, p_pode: pode });
  if (error) return { ok: false, erro: error.message === 'Pessoa não encontrada.' ? error.message : 'Não consegui salvar agora. Tente de novo.' };
  revalidatePath(`/usuarios/${id}`);
  return { ok: true };
}
```

A lista do `cofre-guarda.test.ts` não muda: `acessos-textos.ts` não importa o cofre.

- [ ] **Passo 4: rodar e ver passar**

Run: `pnpm --filter @escritorio/painel test -- acessos-acoes ver-acessos cofre && pnpm --filter @escritorio/painel typecheck`
Expected: 8 + 2 testes novos passam; os do cofre (inclusive a guarda: só `acessos-acoes.ts` e o teste dele importam o cofre até aqui) continuam passando; typecheck verde.

- [ ] **Passo 5: commit**

```bash
git add "apps/painel/src/app/(painel)/clientes/ficha/acessos-acoes.ts" "apps/painel/src/app/(painel)/clientes/ficha/acessos-acoes.test.ts" "apps/painel/src/app/(painel)/clientes/ficha/acessos-textos.ts" "apps/painel/src/app/(painel)/usuarios/ver-acessos.ts" "apps/painel/src/app/(painel)/usuarios/ver-acessos.test.ts"
git commit -m "$(cat <<'EOF'
feat(painel): ações dos acessos de portais (senha cifrada antes de sair, revelar e copiar pelo banco com auditoria) e a permissão "Ver acessos de portais"

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 10: Painel. A ficha (formulário, índice, blocos, rodapé)

**Files:**
- Create (todos em `apps/painel/src/app/(painel)/clientes/ficha/`): `campos.tsx`, `indice-ficha.tsx`, `blocos-empresa.tsx`, `inscricoes-st.tsx`, `blocos-contrato.tsx`, `rodape-ficha.tsx`, `ficha-cliente.tsx`

**Interfaces:**
- Consumes: Task 7 (`ficha.ts`), Task 8 (`salvarFicha`, `buscarCnpj`, `buscarCep`); `FormField`, `FormularioAlteravel`, `IndicadorAlteracoes`, `BotaoSalvar`; `Input`, `Button`, `variantesBotao`, `toast`; `classeSelect`, `classeCaixa` (`../estilos`); `mascararCNPJ`, `mascararCEP`, `mascararTelefone` (`@/lib/formatos`).
- Produces:
  - `campos.tsx`: `BlocoFicha({ id, titulo, aside?, pode?, destaque?, className?, children })` (região com nome = título, âncora `#bloco-<id>`, `fieldset disabled` quando `!pode`), `CampoComLupa`, `CampoDinheiro`, `Caixa`;
  - `indice-ficha.tsx`: `IndiceFicha({ estados })` (navegação "Blocos da ficha");
  - `blocos-empresa.tsx`: tipo `Busca`; `BlocoIdentificacao`, `BlocoEndereco`, `BlocoContato`;
  - `inscricoes-st.tsx`: `BlocoFiscal({ iniciais, erro, pode })`;
  - `blocos-contrato.tsx`: `BlocoContrato`, `BlocoResponsaveis`, `BlocoCertificado`;
  - `rodape-ficha.tsx`: `RodapeFicha({ ultima, pode, novo, hidratado, enviando, aoCancelar })`;
  - `ficha-cliente.tsx`: tipo `PropsFicha`; `FichaCliente(props)` com `data-ficha-hidratada` no `<form>`.
- Nomes acessíveis (contrato dos e2e): campos pelos rótulos da imagem ("CNPJ", "Razão social", "Nome fantasia", "Tipo de pessoa", "Inscrição estadual", "Isento", "Inscrição municipal", "CNAE principal", "Inscrição Suframa", "Regime tributário", "Porte", "Faturamento do último ano", "Funcionários", "Comércio"/"E-commerce"/"Indústria"/"Serviços", "CEP", "Logradouro", "Número", "Complemento", "Bairro", "Cidade", "UF", "Telefone", "Celular / WhatsApp", "E-mail", "E-mail de cobrança", "Site", "Início do contrato", "Honorário mensal", "Dia de vencimento", "Reajuste", "13º honorário", "Fim do contrato", "Tipo", "Vencimento", "Avisar antes"); lupas "Buscar dados públicos da empresa" e "Buscar o endereço"; linhas ST "UF da linha N", "Inscrição da linha N", "Remover a linha N", botão "Adicionar inscrição"; responsáveis "Responsável pelo setor <setor>" e "Outros setores (N)"; regiões com os títulos dos blocos; botões do rodapé "Cancelar" e "Salvar".

- [ ] **Passo 1: `campos.tsx` e `indice-ficha.tsx`**

`campos.tsx`:

```tsx
import { LoaderCircle, Search } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { classeCaixa } from '../estilos';
import type { Bloco } from './ficha';

/** Cartão de um bloco da ficha (imagem 00-cliente-cadastro): região com nome e âncora para o índice. */
export function BlocoFicha({ id, titulo, aside, pode = true, destaque = false, className, children }: {
  id: Bloco; titulo: string; aside?: ReactNode; pode?: boolean; destaque?: boolean; className?: string; children: ReactNode;
}) {
  return (
    <section id={`bloco-${id}`} data-bloco={id} aria-labelledby={`titulo-${id}`}
      className={cn('scroll-mt-4 rounded-lg border border-border bg-surface p-5', destaque && 'border-l-4 border-l-warning', className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={`titulo-${id}`} className="text-sm font-extrabold uppercase tracking-wide text-brand">{titulo}</h2>
        {aside && <div className="text-sm text-muted">{aside}</div>}
      </div>
      {/* "Só ver": os campos ficam à vista e desligados (não vão no envio). */}
      <fieldset disabled={!pode} className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
    </section>
  );
}

/** Campo com lupa à direita (busca pública). Recebe id/aria do FormField e repassa ao input. */
export function CampoComLupa({ rotuloLupa, aoBuscar, buscando, mostrarLupa, className, ...props }: ComponentProps<'input'> & {
  rotuloLupa: string; aoBuscar: () => void; buscando: boolean; mostrarLupa: boolean;
}) {
  return (
    <div className="relative">
      <Input {...props} className={cn(mostrarLupa && 'pr-10', className)} />
      {mostrarLupa && (
        <button type="button" onClick={aoBuscar} disabled={buscando} aria-label={rotuloLupa} title={rotuloLupa}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center rounded-r-md text-muted hover:text-foreground disabled:opacity-50">
          {buscando ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Search aria-hidden size={16} strokeWidth={1.75} />}
        </button>
      )}
    </div>
  );
}

/** Valor em reais: o "R$" fica ao lado, o campo guarda "1.250,00". */
export function CampoDinheiro({ className, ...props }: ComponentProps<'input'>) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">R$</span>
      <Input inputMode="decimal" autoComplete="off" {...props} className={cn('tabular pl-9', className)} />
    </div>
  );
}

export function Caixa({ rotulo, ...props }: Omit<ComponentProps<'input'>, 'type'> & { rotulo: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 text-base font-medium text-foreground">
      <input type="checkbox" className={classeCaixa} {...props} />
      {rotulo}
    </label>
  );
}

/** Rótulo de grupo (legend) no mesmo visual do Label dos campos. */
export const classeLegenda = 'mb-1.5 text-xs font-bold uppercase tracking-wider text-brand';
```

`indice-ficha.tsx`:

```tsx
'use client';

import { Check, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { BLOCOS, textoEstado, type Bloco, type EstadoBloco } from './ficha';

/** Índice da ficha (D28): um link por bloco, o da tela marcado, e o estado sempre escrito (a cor nunca fala sozinha). */
export function IndiceFicha({ estados }: { estados: Record<Bloco, EstadoBloco> }) {
  const [ativo, setAtivo] = useState<Bloco>('identificacao');
  useEffect(() => {
    const secoes = BLOCOS.map((b) => document.getElementById(`bloco-${b.id}`)).filter((s): s is HTMLElement => s !== null);
    const observador = new IntersectionObserver((entradas) => {
      const primeira = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      const id = primeira?.target.getAttribute('data-bloco') as Bloco | null | undefined;
      if (id) setAtivo(id);
    }, { rootMargin: '0px 0px -60% 0px' });
    secoes.forEach((s) => observador.observe(s));
    return () => observador.disconnect();
  }, []);

  return (
    <nav aria-label="Blocos da ficha" className="sticky top-4 hidden w-indice-ficha shrink-0 self-start rounded-lg border border-border bg-surface p-2 lg:block">
      <ul className="flex flex-col gap-0.5">
        {BLOCOS.map((b) => (
          <li key={b.id}>
            <a href={`#bloco-${b.id}`} onClick={() => setAtivo(b.id)} aria-current={ativo === b.id ? 'true' : undefined}
              className={cn('flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-surface-muted',
                ativo === b.id && 'bg-brand-soft font-bold text-brand')}>
              <span>{b.rotulo}</span>
              <Marca estado={estados[b.id]} />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Marca({ estado }: { estado: EstadoBloco }) {
  const texto = textoEstado(estado);
  switch (estado.tipo) {
    case 'completo':
      return <span className="flex items-center text-success"><Check aria-hidden size={14} strokeWidth={2} /><span className="sr-only">{texto}</span></span>;
    case 'protegido':
      return <span className="flex items-center text-muted"><Lock aria-hidden size={14} strokeWidth={1.75} /><span className="sr-only">{texto}</span></span>;
    case 'vencido':
      return <span className="text-xs font-extrabold uppercase text-danger">{texto}</span>;
    case 'pendente':
    case 'vence':
      return <span className="text-xs font-extrabold uppercase text-warning">{texto}</span>;
    default:
      return null;
  }
}
```

- [ ] **Passo 2: `blocos-empresa.tsx` (Identificação, Endereço, Contato)**

```tsx
'use client';

import { useState } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { Input } from '@/components/ui/input';
import { mascararCEP, mascararCNPJ, mascararTelefone } from '@/lib/formatos';
import { classeSelect } from '../estilos';
import { BlocoFicha, CampoComLupa, CampoDinheiro, Caixa, classeLegenda } from './campos';
import { dinheiroNoCampo, opcoesRegime, PORTES, SEGMENTOS, UFS, type ClienteFicha, type ErrosFicha } from './ficha';

export type Busca = { buscando: boolean; mensagem: string | null; buscar: () => void; aoSair: () => void };
type Props = { c: ClienteFicha | null; erros: ErrosFicha; pode: boolean };

export function BlocoIdentificacao({ c, erros, pode, admin, busca }: Props & { admin: boolean; busca: Busca }) {
  const [isento, setIsento] = useState(c?.isento_ie ?? false);
  const segmentos = new Set(c?.segmentos ?? []);
  return (
    <BlocoFicha id="identificacao" titulo="Identificação" pode={pode} aside="busca automática pelo CNPJ preenche razão social, CNAE e endereço">
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
        <FormField id="ficha-cnpj" rotulo="CNPJ" obrigatorio erro={erros.cnpj}>
          <CampoComLupa name="cnpj" defaultValue={c ? mascararCNPJ(c.cnpj) : ''} inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00"
            rotuloLupa="Buscar dados públicos da empresa" mostrarLupa={pode} buscando={busca.buscando} aoBuscar={busca.buscar} onBlur={busca.aoSair} />
        </FormField>
        <FormField id="ficha-razao" rotulo="Razão social" obrigatorio erro={erros.razao_social}>
          <Input name="razao_social" defaultValue={c?.razao_social ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-fantasia" rotulo="Nome fantasia" erro={erros.nome_fantasia}>
          <Input name="nome_fantasia" defaultValue={c?.nome_fantasia ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-tipo-pessoa" rotulo="Tipo de pessoa" ajuda="Pessoa jurídica (CNPJ).">
          <Input defaultValue="Jurídica" readOnly className="bg-surface-muted text-muted" />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <FormField id="ficha-ie" rotulo="Inscrição estadual" erro={erros.inscricao_estadual}>
            <Input name="inscricao_estadual" defaultValue={c?.inscricao_estadual ?? ''} disabled={isento} placeholder={isento ? 'isento' : undefined} autoComplete="off" />
          </FormField>
          <Caixa name="isento_ie" rotulo="Isento" defaultChecked={c?.isento_ie ?? false} onChange={(e) => setIsento(e.currentTarget.checked)} />
        </div>
        <FormField id="ficha-im" rotulo="Inscrição municipal" erro={erros.inscricao_municipal}>
          <Input name="inscricao_municipal" defaultValue={c?.inscricao_municipal ?? ''} placeholder="não informada" autoComplete="off" />
        </FormField>
        <FormField id="ficha-cnae" rotulo="CNAE principal" erro={erros.cnae_principal}>
          <Input name="cnae_principal" defaultValue={c?.cnae_principal ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-suframa" rotulo="Inscrição Suframa" erro={erros.inscricao_suframa}>
          <Input name="inscricao_suframa" defaultValue={c?.inscricao_suframa ?? ''} placeholder="—" autoComplete="off" />
        </FormField>
        <FormField id="ficha-regime" rotulo="Regime tributário" obrigatorio erro={erros.regime}>
          <select name="regime" defaultValue={c?.regime ?? ''} required={false} className={classeSelect}>
            <option value="">Escolha o regime</option>
            {opcoesRegime(c?.regime ?? null).map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-porte" rotulo="Porte" erro={erros.porte}>
          <select name="porte" defaultValue={c?.porte ?? ''} className={classeSelect}>
            <option value="">Não informado</option>
            {PORTES.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-faturamento" rotulo="Faturamento do último ano" erro={erros.faturamento_ultimo_ano}>
          <CampoDinheiro name="faturamento_ultimo_ano" defaultValue={dinheiroNoCampo(c?.faturamento_ultimo_ano ?? null)} />
        </FormField>
        <FormField id="ficha-funcionarios" rotulo="Funcionários" erro={erros.funcionarios}>
          <Input name="funcionarios" inputMode="numeric" defaultValue={c?.funcionarios ?? ''} autoComplete="off" />
        </FormField>
        <fieldset className="md:col-span-2 xl:col-span-4">
          <legend className={classeLegenda}>Segmento <span aria-hidden className="text-danger">*</span></legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SEGMENTOS.map((s) => <Caixa key={s.valor} name="segmentos" value={s.valor} rotulo={s.rotulo} defaultChecked={segmentos.has(s.valor)} />)}
          </div>
        </fieldset>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-muted">{busca.mensagem}</p>
      {admin && (
        <div className="mt-3 border-t border-border pt-3">
          <Caixa name="agente_pausado" rotulo="Pausar o agente para este cliente" defaultChecked={c?.agente_pausado ?? false} />
        </div>
      )}
    </BlocoFicha>
  );
}

export function BlocoEndereco({ c, erros, pode, busca }: Props & { busca: Busca }) {
  return (
    <BlocoFicha id="endereco" titulo="Endereço" pode={pode} aside="CEP preenche rua, bairro, cidade e UF">
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-6 xl:grid-cols-12">
        <FormField id="ficha-cep" rotulo="CEP" obrigatorio erro={erros.cep} className="md:col-span-2 xl:col-span-3">
          <CampoComLupa name="cep" required={false} defaultValue={c?.cep ? mascararCEP(c.cep) : ''} inputMode="numeric" autoComplete="off"
            placeholder="00000-000" rotuloLupa="Buscar o endereço" mostrarLupa={pode} buscando={busca.buscando} aoBuscar={busca.buscar} onBlur={busca.aoSair} />
        </FormField>
        <FormField id="ficha-logradouro" rotulo="Logradouro" obrigatorio erro={erros.logradouro} className="md:col-span-4 xl:col-span-5">
          <Input name="logradouro" required={false} defaultValue={c?.logradouro ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-numero" rotulo="Número" obrigatorio erro={erros.numero} className="md:col-span-2 xl:col-span-2">
          <Input name="numero" required={false} defaultValue={c?.numero ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-complemento" rotulo="Complemento" erro={erros.complemento} className="md:col-span-4 xl:col-span-2">
          <Input name="complemento" defaultValue={c?.complemento ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-bairro" rotulo="Bairro" obrigatorio erro={erros.bairro} className="md:col-span-2 xl:col-span-3">
          <Input name="bairro" required={false} defaultValue={c?.bairro ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-cidade" rotulo="Cidade" obrigatorio erro={erros.cidade} className="md:col-span-3 xl:col-span-5">
          <Input name="cidade" required={false} defaultValue={c?.cidade ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-uf" rotulo="UF" obrigatorio erro={erros.uf} className="md:col-span-1 xl:col-span-2">
          <select name="uf" required={false} defaultValue={c?.uf?.trim() ?? ''} className={classeSelect}>
            <option value="">UF</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </FormField>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-muted">{busca.mensagem}</p>
    </BlocoFicha>
  );
}

export function BlocoContato({ c, erros, pode }: Props) {
  return (
    <BlocoFicha id="contato" titulo="Contato" pode={pode} aside="as pessoas que falam pela empresa ficam na aba Contatos">
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-5">
        <FormField id="ficha-telefone" rotulo="Telefone" erro={erros.telefone}>
          <Input name="telefone" inputMode="tel" defaultValue={c?.telefone ? mascararTelefone(c.telefone) : ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-celular" rotulo="Celular / WhatsApp" erro={erros.celular}>
          <Input name="celular" inputMode="tel" defaultValue={c?.celular ? mascararTelefone(c.celular) : ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-email" rotulo="E-mail" erro={erros.email}>
          <Input name="email" type="email" defaultValue={c?.email ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-email-cobranca" rotulo="E-mail de cobrança" ajuda="Para onde vão os boletos de honorários." erro={erros.email_cobranca}>
          <Input name="email_cobranca" type="email" defaultValue={c?.email_cobranca ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-site" rotulo="Site" erro={erros.site}>
          <Input name="site" defaultValue={c?.site ?? ''} placeholder="https://" autoComplete="off" />
        </FormField>
      </div>
    </BlocoFicha>
  );
}
```

(`type="email"` no navegador recusa e-mail sem "@" antes de enviar; isso é o mesmo erro da regra do servidor, só mais cedo. "UF" do endereço é o único rótulo exato "UF" da tela: as linhas de inscrição ST usam "UF da linha N".)

- [ ] **Passo 3: `inscricoes-st.tsx` (bloco Fiscal)**

```tsx
'use client';

import { Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { classeSelect } from '../estilos';
import { BlocoFicha } from './campos';
import { UFS } from './ficha';

type Linha = { chave: number; uf: string; inscricao: string };

/** Fiscal · inscrições de substituto tributário: UF + inscrição; linha sem inscrição fica, como pendência (imagem). */
export function BlocoFiscal({ iniciais, erro, pode }: { iniciais: { uf: string; inscricao: string | null }[]; erro?: string; pode: boolean }) {
  const [linhas, setLinhas] = useState<Linha[]>(() => iniciais.map((l, i) => ({ chave: i, uf: l.uf, inscricao: l.inscricao ?? '' })));
  const proxima = useRef(iniciais.length);
  const assinatura = useRef<HTMLInputElement>(null);
  // Linha nova ou removida não muda campo salvo nenhum: este campo escondido avisa o "não salvo" e o índice.
  useEffect(() => {
    const el = assinatura.current;
    const valor = linhas.map((l) => l.chave).join(',');
    if (!el || el.value === valor) return;
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [linhas]);
  const mudar = (chave: number, campo: 'uf' | 'inscricao', valor: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  const semInscricao = linhas.filter((l) => !l.inscricao.trim()).length;

  return (
    <BlocoFicha id="fiscal" titulo="Fiscal · Inscrições de substituto tributário" pode={pode}
      aside={semInscricao > 0 && (
        <span className="inline-flex items-center gap-1 font-bold text-warning">
          <TriangleAlert aria-hidden size={14} strokeWidth={1.75} />
          {semInscricao === 1 ? '1 linha sem inscrição' : `${semInscricao} linhas sem inscrição`}
        </span>
      )}>
      <input ref={assinatura} type="text" hidden name="st_linhas" defaultValue={iniciais.map((_, i) => i).join(',')} />
      {linhas.length === 0 ? <p className="text-sm text-muted">Nenhuma inscrição de substituto tributário.</p> : (
        <div className="max-w-3xl overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs font-extrabold uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">UF</th>
                <th scope="col" className="px-3 py-2 text-left">Inscrição estadual</th>
                <th scope="col"><span className="sr-only">Remover</span></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.chave} className="border-t border-border">
                  <td className="w-32 px-3 py-2">
                    <select name="st_uf" aria-label={`UF da linha ${i + 1}`} defaultValue={l.uf} className={classeSelect}
                      onChange={(e) => mudar(l.chave, 'uf', e.currentTarget.value)}>
                      <option value="">UF</option>
                      {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input name="st_inscricao" aria-label={`Inscrição da linha ${i + 1}`} defaultValue={l.inscricao} placeholder="informe a inscrição"
                      autoComplete="off" className={cn(!l.inscricao.trim() && 'border-warning')}
                      onChange={(e) => mudar(l.chave, 'inscricao', e.currentTarget.value)} />
                  </td>
                  <td className="w-12 px-2 py-2 text-right">
                    {pode && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover a linha ${i + 1}`}
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}>
                        <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
      {pode && (
        <Button type="button" variant="link" className="mt-3" onClick={() => setLinhas((ls) => [...ls, { chave: proxima.current++, uf: '', inscricao: '' }])}>
          <Plus aria-hidden size={16} strokeWidth={1.75} />
          Adicionar inscrição
        </Button>
      )}
    </BlocoFicha>
  );
}
```

- [ ] **Passo 4: `blocos-contrato.tsx` (Contrato e honorários, Responsáveis, Certificado)**

```tsx
'use client';

import { FormField } from '@/components/patterns/form-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { classeSelect } from '../estilos';
import { BlocoFicha, CampoDinheiro, Caixa, classeLegenda } from './campos';
import {
  AVISAR_DIAS, dinheiroNoCampo, OPCOES_REAJUSTE, separarSetores, TIPOS_CERTIFICADO, valorReajuste,
  type ClienteFicha, type ErrosFicha, type EstadoBloco,
} from './ficha';

type Servico = { id: string; nome: string; setor_id: string | null };
type Setor = { id: string; nome: string };

export function BlocoContrato({ c, erros, pode, servicos, contratados, setorPessoal }: {
  c: ClienteFicha | null; erros: ErrosFicha; pode: boolean; servicos: Servico[]; contratados: string[]; setorPessoal: string | null;
}) {
  const marcados = new Set(contratados);
  const decimo = c?.decimo_terceiro == null ? '' : c.decimo_terceiro ? 'sim' : 'nao';
  return (
    <BlocoFicha id="contrato" titulo="Contrato e honorários" pode={pode}>
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
        <FormField id="ficha-contrato-inicio" rotulo="Início do contrato" obrigatorio erro={erros.contrato_inicio}>
          <Input type="date" name="contrato_inicio" required={false} defaultValue={c?.contrato_inicio ?? ''} />
        </FormField>
        <FormField id="ficha-honorario" rotulo="Honorário mensal" obrigatorio erro={erros.honorario_mensal}>
          <CampoDinheiro name="honorario_mensal" required={false} defaultValue={dinheiroNoCampo(c?.honorario_mensal ?? null)} />
        </FormField>
        <FormField id="ficha-dia-vencimento" rotulo="Dia de vencimento" erro={erros.dia_vencimento}>
          <Input name="dia_vencimento" inputMode="numeric" defaultValue={c?.dia_vencimento ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-reajuste" rotulo="Reajuste" erro={erros.reajuste}>
          <select name="reajuste" defaultValue={valorReajuste(c?.reajuste ?? null, c?.reajuste_mes ?? null)} className={classeSelect}>
            <option value="">Não informado</option>
            {OPCOES_REAJUSTE.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-decimo" rotulo="13º honorário">
          <select name="decimo_terceiro" defaultValue={decimo} className={classeSelect}>
            <option value="">Não informado</option>
            <option value="nao">Não</option>
            <option value="sim">Sim, em dezembro</option>
          </select>
        </FormField>
        <FormField id="ficha-contrato-fim" rotulo="Fim do contrato" ajuda="Vazio: em vigor." erro={erros.contrato_fim}>
          <Input type="date" name="contrato_fim" defaultValue={c?.contrato_fim ?? ''} />
        </FormField>
      </div>
      <fieldset className="mt-4">
        <legend className={classeLegenda}>Serviços contratados</legend>
        {servicos.length === 0 ? <p className="text-sm text-muted">Nenhum serviço ativo. Cadastre em Configurações.</p> : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {servicos.map((s) => (
              <Caixa key={s.id} name="servico" value={s.id} defaultChecked={marcados.has(s.id)}
                rotulo={s.setor_id && s.setor_id === setorPessoal && c?.funcionarios ? `${s.nome} (${c.funcionarios} func.)` : s.nome} />
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-muted">O agente usa esta lista: assunto fora dela vira demanda marcada &quot;Fora do contrato&quot;.</p>
      </fieldset>
    </BlocoFicha>
  );
}

export function BlocoResponsaveis({ setores, servicos, contratados, pessoas, responsaveis, pode }: {
  setores: Setor[]; servicos: Servico[]; contratados: string[]; pessoas: { id: string; nome: string }[];
  responsaveis: Record<string, string>; pode: boolean;
}) {
  const { principais, outros } = separarSetores(setores, servicos, contratados, responsaveis);
  const linha = (s: Setor) => (
    <div key={s.id} className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 first:border-t-0">
      <label htmlFor={`resp-${s.id}`} className="text-sm font-bold text-foreground">
        <span className="sr-only">Responsável pelo setor </span>{s.nome}
      </label>
      <select id={`resp-${s.id}`} name={`responsavel:${s.id}`} defaultValue={responsaveis[s.id] ?? ''} className={cn(classeSelect, 'max-w-56')}>
        <option value="">Fila do setor</option>
        {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </div>
  );
  return (
    <BlocoFicha id="responsaveis" titulo="Responsáveis por setor" pode={pode} aside="sem responsável, a demanda cai na fila do setor">
      <div className="rounded-md border border-border">{principais.map(linha)}</div>
      {outros.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold text-brand">Outros setores ({outros.length})</summary>
          {/* Recolhido, mas no formulário: salvar não apaga o responsável de um setor escondido (D16). */}
          <div className="mt-2 rounded-md border border-border">{outros.map(linha)}</div>
        </details>
      )}
    </BlocoFicha>
  );
}

export function BlocoCertificado({ c, erros, pode, estado }: { c: ClienteFicha | null; erros: ErrosFicha; pode: boolean; estado: EstadoBloco }) {
  const dias = [...new Set<number>([...AVISAR_DIAS, c?.certificado_avisar_dias ?? 30])].sort((a, b) => a - b);
  const aviso = estado.tipo === 'vence'
    ? <span className="font-bold text-warning">{estado.dias === 0 ? 'vence hoje' : `vence em ${estado.dias} ${estado.dias === 1 ? 'dia' : 'dias'}`}</span>
    : estado.tipo === 'vencido'
      ? <span className="font-bold text-danger">vencido há {estado.dias} {estado.dias === 1 ? 'dia' : 'dias'}</span>
      : undefined;
  return (
    <BlocoFicha id="certificado" titulo="Certificado digital" pode={pode} aside={aviso} destaque={estado.tipo === 'vence' || estado.tipo === 'vencido'}>
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
        <FormField id="ficha-cert-tipo" rotulo="Tipo" erro={erros.certificado_tipo}>
          <select name="certificado_tipo" defaultValue={c?.certificado_tipo ?? ''} className={classeSelect}>
            <option value="">Escolha o tipo</option>
            {TIPOS_CERTIFICADO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-cert-vencimento" rotulo="Vencimento" obrigatorio erro={erros.certificado_vencimento}>
          <Input type="date" name="certificado_vencimento" required={false} defaultValue={c?.certificado_vencimento ?? ''} />
        </FormField>
        <FormField id="ficha-cert-avisar" rotulo="Avisar antes">
          <select name="certificado_avisar_dias" defaultValue={String(c?.certificado_avisar_dias ?? 30)} className={classeSelect}>
            {dias.map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </FormField>
      </div>
      <p className="mt-3 text-xs text-muted">O aviso vira uma demanda automática para o responsável do Fiscal e aparece no Início.</p>
    </BlocoFicha>
  );
}
```

- [ ] **Passo 5: `rodape-ficha.tsx` e `ficha-cliente.tsx`**

`rodape-ficha.tsx`:

```tsx
'use client';

import { Save } from 'lucide-react';
import Link from 'next/link';
import { BotaoSalvar, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Button, variantesBotao } from '@/components/ui/button';

/** Rodapé fixo da ficha (imagem): última alteração à esquerda; CANCELAR e SALVAR à direita. */
export function RodapeFicha({ ultima, pode, novo, hidratado, enviando, aoCancelar }: {
  ultima: string | null; pode: boolean; novo: boolean; hidratado: boolean; enviando: boolean; aoCancelar: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 border-t-2 border-brand bg-surface px-4 py-3">
      <p className="text-sm text-muted">
        {ultima ? `Última alteração: ${ultima}` : novo ? 'Cliente novo: preencha e salve.' : 'Nenhuma alteração registrada por pessoas.'}
        {!pode && ' · Só quem pode editar clientes altera estes dados.'}
      </p>
      {pode && (
        <div className="flex items-center gap-3">
          <IndicadorAlteracoes />
          {novo
            ? <Link href="/clientes" className={variantesBotao({ variant: 'outline' })}>Cancelar</Link>
            : <Button type="button" variant="outline" onClick={aoCancelar}>Cancelar</Button>}
          {/* Desligado até hidratar: o clique (de gente ou do Playwright) nunca cai no envio nativo sem o onSubmit (D26). */}
          <BotaoSalvar enviando={enviando} disabled={!hidratado || enviando}>
            <Save aria-hidden size={16} strokeWidth={1.75} />
            Salvar
          </BotaoSalvar>
        </div>
      )}
    </div>
  );
}
```

`ficha-cliente.tsx`:

```tsx
'use client';

import { somenteDigitos, validarCnpj } from '@escritorio/core';
import { CircleAlert } from 'lucide-react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { FormularioAlteravel } from '@/components/patterns/formulario-alteravel';
import { toast } from '@/components/ui/toaster';
import { mascararCEP } from '@/lib/formatos';
import { buscarCep, buscarCnpj, salvarFicha } from './acoes';
import { BlocoCertificado, BlocoContrato, BlocoResponsaveis } from './blocos-contrato';
import { BlocoContato, BlocoEndereco, BlocoIdentificacao, type Busca } from './blocos-empresa';
import {
  estadoDosBlocos, mensagemBusca, textoPreenchido, valoresDe, valoresDoCliente, type ClienteFicha, type EstadoFicha, type ValoresFicha,
} from './ficha';
import { IndiceFicha } from './indice-ficha';
import { BlocoFiscal } from './inscricoes-st';
import { RodapeFicha } from './rodape-ficha';

export type PropsFicha = {
  cliente: ClienteFicha | null;
  servicos: { id: string; nome: string; setor_id: string | null }[];
  contratados: string[];
  setores: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  responsaveis: Record<string, string>;
  inscricoesSt: { uf: string; inscricao: string | null }[];
  pode: boolean;
  admin: boolean;
  /** Bloco Acessos de portais: salva sozinho, a senha nunca vai junto da ficha (D13). */
  acessos: ReactNode;
  ultimaAlteracao: string | null;
  /** "Agora" do servidor: as pendências saem iguais no servidor e no navegador. */
  agora: string;
};

const FALHA = 'Não foi possível salvar: não consegui gravar agora. Tente de novo.';
type Status = { buscando: boolean; mensagem: string | null };
const PARADO: Status = { buscando: false, mensagem: null };

/** Ficha do cliente, aba Dados (spec 7D.1). CANCELAR remonta o formulário com o que está salvo. */
export function FichaCliente(props: PropsFicha) {
  const [versao, setVersao] = useState(0);
  return <Formulario key={versao} {...props} aoCancelar={() => setVersao((v) => v + 1)} />;
}

function Formulario({ cliente, servicos, contratados, setores, pessoas, responsaveis, inscricoesSt, pode, admin, acessos, ultimaAlteracao, agora, aoCancelar }:
  PropsFicha & { aoCancelar: () => void }) {
  const router = useRouter();
  const caixa = useRef<HTMLDivElement>(null);
  const form = () => caixa.current?.querySelector('form') ?? null;
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);
  const [estado, setEstado] = useState<EstadoFicha | null>(null);
  const [enviando, iniciar] = useTransition();
  const [valores, setValores] = useState<ValoresFicha>(() => valoresDoCliente(cliente, inscricoesSt, Object.keys(responsaveis).length));
  const quando = useMemo(() => new Date(agora), [agora]);
  const estados = estadoDosBlocos(valores, quando);
  const erros = estado && !estado.ok ? estado.erros : {};
  const [cnpj, setCnpj] = useState<Status>(PARADO);
  const [cep, setCep] = useState<Status>(PARADO);
  const buscados = useRef(new Set<string>());
  // Sair do campo e clicar na lupa disparam juntos: uma busca por vez em cada campo.
  const emCurso = useRef({ cnpj: false, cep: false });

  // "Só ver": os campos estão desligados (fora do FormData); o índice fica com o que está salvo.
  const reler = () => {
    const f = form();
    if (pode && f) setValores(valoresDe(new FormData(f)));
  };
  const digitos = (nome: string) => {
    const el = form()?.elements.namedItem(nome);
    return el instanceof HTMLInputElement ? somenteDigitos(el.value) : '';
  };

  /** Escreve nos campos e avisa o formulário (não salvo, índice). soVazios: a busca de CNPJ não apaga o que já foi escrito (D15). */
  function preencher(campos: Record<string, string | null>, soVazios: boolean): string[] {
    const f = form();
    if (!f) return [];
    const mudou: string[] = [];
    for (const [nome, valor] of Object.entries(campos)) {
      const el = f.elements.namedItem(nome);
      if (!valor || !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || el.disabled) continue;
      if (soVazios && el.value.trim()) continue;
      el.value = valor;
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      mudou.push(nome);
    }
    return mudou;
  }

  async function buscarPeloCnpj() {
    if (emCurso.current.cnpj) return;
    emCurso.current.cnpj = true;
    const numero = digitos('cnpj');
    buscados.current.add(numero);
    setCnpj({ buscando: true, mensagem: null });
    const r = await buscarCnpj(numero).catch(() => ({ ok: false as const, motivo: 'indisponivel' as const }));
    emCurso.current.cnpj = false;
    if (!r.ok) {
      setCnpj({ buscando: false, mensagem: mensagemBusca('cnpj', r.motivo) });
      return;
    }
    const d = r.dados;
    const mudou = preencher({
      razao_social: d.razao_social, nome_fantasia: d.nome_fantasia, cnae_principal: d.cnae_principal, cep: d.cep && mascararCEP(d.cep),
      logradouro: d.logradouro, numero: d.numero, complemento: d.complemento, bairro: d.bairro, cidade: d.cidade, uf: d.uf,
    }, true);
    setCnpj({ buscando: false, mensagem: textoPreenchido(mudou) });
    reler();
  }

  async function buscarPeloCep() {
    if (emCurso.current.cep) return;
    emCurso.current.cep = true;
    const numero = digitos('cep');
    buscados.current.add(`cep:${numero}`);
    setCep({ buscando: true, mensagem: null });
    const r = await buscarCep(numero).catch(() => ({ ok: false as const, motivo: 'indisponivel' as const }));
    emCurso.current.cep = false;
    if (!r.ok) {
      setCep({ buscando: false, mensagem: mensagemBusca('cep', r.motivo) });
      return;
    }
    preencher({ logradouro: r.dados.logradouro, bairro: r.dados.bairro, cidade: r.dados.cidade, uf: r.dados.uf }, false);
    setCep({ buscando: false, mensagem: 'Endereço preenchido pelo CEP. Confira o número e o complemento.' });
    reler();
  }

  // Ao sair do campo: só número completo, diferente do salvo e ainda não buscado (D15). A lupa busca sempre.
  const buscaCnpj: Busca = {
    ...cnpj,
    buscar: () => void buscarPeloCnpj(),
    aoSair: () => {
      const n = digitos('cnpj');
      if (n.length === 14 && n !== cliente?.cnpj && validarCnpj(n) && !buscados.current.has(n)) void buscarPeloCnpj();
    },
  };
  const buscaCep: Busca = {
    ...cep,
    buscar: () => void buscarPeloCep(),
    aoSair: () => {
      const n = digitos('cep');
      if (n.length === 8 && n !== (cliente?.cep ?? '') && !buscados.current.has(`cep:${n}`)) void buscarPeloCep();
    },
  };

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio de uma janela (acesso, remover) sobe pela árvore do React até aqui: não é a ficha, e não pode ser barrado.
    if (e.target !== e.currentTarget) return;
    // Envio pela própria tela: o React não limpa os campos, então o erro aparece no campo com tudo o que foi digitado.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await salvarFicha(cliente?.id ?? null, dados);
        setEstado(r);
        if (!r.ok) {
          requestAnimationFrame(() => form()?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
          return;
        }
        toast.success('Ficha salva.');
        if (cliente) router.refresh();
        else router.push(`/clientes/${r.id}`);
      } catch (err) {
        unstable_rethrow(err);
        console.error('[ficha do cliente] falha ao salvar', err);
        setEstado({ ok: false, erros: { geral: FALHA } });
      }
    });
  };

  return (
    <div ref={caixa}>
      <FormularioAlteravel onSubmit={enviar} onInput={reler} onChange={reler} className="flex flex-col gap-4"
        aria-label={cliente ? `Ficha de ${cliente.nome_fantasia ?? cliente.razao_social}` : 'Novo cliente'}
        data-ficha-hidratada={hidratado ? '' : undefined}>
        {erros.geral && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
            <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span>{erros.geral}</span>
          </p>
        )}
        <div className="flex items-start gap-5">
          <IndiceFicha estados={estados} />
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <BlocoIdentificacao c={cliente} erros={erros} pode={pode} admin={admin} busca={buscaCnpj} />
            <BlocoEndereco c={cliente} erros={erros} pode={pode} busca={buscaCep} />
            <BlocoContato c={cliente} erros={erros} pode={pode} />
            <BlocoFiscal iniciais={inscricoesSt} erro={erros.inscricoes_st} pode={pode} />
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <BlocoContrato c={cliente} erros={erros} pode={pode} servicos={servicos} contratados={contratados}
                setorPessoal={setores.find((s) => s.nome === 'Pessoal')?.id ?? null} />
              <BlocoResponsaveis setores={setores} servicos={servicos} contratados={contratados} pessoas={pessoas} responsaveis={responsaveis} pode={pode} />
            </div>
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <BlocoCertificado c={cliente} erros={erros} pode={pode} estado={estados.certificado} />
              {acessos}
            </div>
          </div>
        </div>
        <RodapeFicha ultima={ultimaAlteracao} pode={pode} novo={!cliente} hidratado={hidratado} enviando={enviando} aoCancelar={aoCancelar} />
      </FormularioAlteravel>
    </div>
  );
}
```

- [ ] **Passo 6: conferir**

Run: `pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel test -- escala tokens formulario-alteravel ficha`
Expected: verdes. (A ficha ainda não está ligada a nenhuma página; a Task 12 liga. `escala.test.ts` pega qualquer `-[Npx]` ou ícone sem regra: só `size={12|14|16|20}` aqui.)

- [ ] **Passo 7: commit**

```bash
git add "apps/painel/src/app/(painel)/clientes/ficha/campos.tsx" "apps/painel/src/app/(painel)/clientes/ficha/indice-ficha.tsx" "apps/painel/src/app/(painel)/clientes/ficha/blocos-empresa.tsx" "apps/painel/src/app/(painel)/clientes/ficha/inscricoes-st.tsx" "apps/painel/src/app/(painel)/clientes/ficha/blocos-contrato.tsx" "apps/painel/src/app/(painel)/clientes/ficha/rodape-ficha.tsx" "apps/painel/src/app/(painel)/clientes/ficha/ficha-cliente.tsx"
git commit -m "$(cat <<'EOF'
feat(painel): ficha do cliente com índice de pendências, oito blocos, busca de CNPJ/CEP que só preenche o vazio e um Salvar para a aba inteira

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```


---

### Task 11: Painel. Bloco Acessos de portais

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/ficha/acessos-portais.tsx`

**Interfaces:**
- Consumes: `salvarAcesso`, `removerAcesso`, `revelarAcesso`, `copiarAcesso`, `EstadoAcesso` (Task 9); `SEM_CHAVE`, `SEM_PERMISSAO_VER` (`acessos-textos.ts`); `BlocoFicha` (Task 10); `ConfirmDialog`, `FormField`, `Dialog*`, `Button`, `Input`, `toast`; `classeCaixa`.
- Produces: tipo `AcessoLinha = { id; portal; usuario; tem_senha }`; `AcessosPortais({ clienteId, acessos, podeVer, podeEditar, cofreOk })`. Nomes acessíveis: "Revelar a senha de <portal>" / "Esconder a senha de <portal>", "Copiar a senha de <portal>", "Editar o acesso <portal>", "Remover o acesso <portal>", "Adicionar acesso"; janela "Novo acesso de portal" / "Editar acesso: <portal>" com "Portal", "Usuário", "Senha", "Sem senha (ex.: entra pelo certificado)" e "Salvar acesso".

- [ ] **Passo 1: implementar**

`acessos-portais.tsx`:

```tsx
'use client';

import { Copy, Eye, EyeOff, Lock, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, useTransition, type FormEvent, type ReactElement } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { classeCaixa } from '../estilos';
import { copiarAcesso, removerAcesso, revelarAcesso, salvarAcesso, type EstadoAcesso } from './acessos-acoes';
import { SEM_CHAVE, SEM_PERMISSAO_VER } from './acessos-textos';
import { BlocoFicha } from './campos';

export type AcessoLinha = { id: string; portal: string; usuario: string | null; tem_senha: boolean };
/** A senha revelada some sozinha (D5). */
const MOSTRAR_POR_MS = 30_000;

/**
 * Acessos de portais (spec 7D.1 item 8). Portal e usuário à vista de quem vê a ficha (D7); a senha só chega à tela por
 * "Revelar" (some em 30 s) ou vai direto para a área de transferência por "Copiar" — as duas passam pela auditoria (D5).
 */
export function AcessosPortais({ clienteId, acessos, podeVer, podeEditar, cofreOk }: {
  clienteId: string | null; acessos: AcessoLinha[]; podeVer: boolean; podeEditar: boolean; cofreOk: boolean;
}) {
  return (
    <BlocoFicha id="acessos" titulo="Acessos de portais"
      aside={<span className="inline-flex items-center gap-1"><Lock aria-hidden size={12} strokeWidth={1.75} />só com a permissão &quot;Ver acessos de portais&quot;</span>}>
      <p className="mb-3 flex items-start gap-3 rounded-lg bg-grafite px-4 py-3 text-sm text-grafite-foreground">
        <ShieldCheck aria-hidden size={20} strokeWidth={1.75} className="shrink-0 text-champagne" />
        Guardado criptografado. Revelar uma senha fica registrado na auditoria. O agente e o assistente nunca recebem estes dados.
      </p>
      {!clienteId ? <p className="text-sm text-muted">Salve a ficha para cadastrar acessos.</p> : (
        <>
          {!cofreOk && <p className="mb-3 text-sm font-bold text-warning">{SEM_CHAVE}</p>}
          {!podeVer && acessos.some((a) => a.tem_senha) && (
            <p className="mb-3 text-sm text-muted">Revelar e copiar só com a permissão &quot;Ver acessos de portais&quot;.</p>
          )}
          {acessos.length === 0 ? <p className="text-sm text-muted">Nenhum acesso cadastrado.</p> : (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface-muted text-xs font-extrabold uppercase tracking-wide text-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left">Portal</th>
                    <th scope="col" className="px-3 py-2 text-left">Usuário</th>
                    <th scope="col" className="px-3 py-2 text-left">Senha</th>
                    <th scope="col"><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {acessos.map((a) => <LinhaAcesso key={a.id} clienteId={clienteId} a={a} podeVer={podeVer} podeEditar={podeEditar} cofreOk={cofreOk} />)}
                </tbody>
              </table>
            </div>
          )}
          {podeEditar && cofreOk && (
            <JanelaAcesso clienteId={clienteId} gatilho={(
              <Button type="button" variant="link" className="mt-3"><Plus aria-hidden size={16} strokeWidth={1.75} />Adicionar acesso</Button>
            )} />
          )}
        </>
      )}
    </BlocoFicha>
  );
}

function LinhaAcesso({ clienteId, a, podeVer, podeEditar, cofreOk }: {
  clienteId: string; a: AcessoLinha; podeVer: boolean; podeEditar: boolean; cofreOk: boolean;
}) {
  const router = useRouter();
  const [senha, setSenha] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, iniciar] = useTransition();
  useEffect(() => {
    if (senha === null) return;
    const t = setTimeout(() => setSenha(null), MOSTRAR_POR_MS);
    return () => clearTimeout(t);
  }, [senha]);
  const motivo = !podeVer ? SEM_PERMISSAO_VER : !cofreOk ? SEM_CHAVE : null;

  const revelar = () => iniciar(async () => {
    const r = await revelarAcesso(a.id);
    if (r.ok) { setSenha(r.senha); setErro(null); } else setErro(r.erro);
  });
  const copiar = () => iniciar(async () => {
    const r = await copiarAcesso(a.id);
    if (!r.ok) { setErro(r.erro); return; }
    try {
      await navigator.clipboard.writeText(r.senha);
      setErro(null);
      toast.success('Senha copiada.');
    } catch {
      setErro('Não consegui copiar. Use Revelar.');
    }
  });

  return (
    <tr className="border-t border-border align-middle">
      <th scope="row" className="px-3 py-2 text-left font-bold text-foreground">{a.portal}</th>
      <td className="px-3 py-2 text-foreground">{a.usuario ?? '—'}</td>
      <td className="px-3 py-2">
        {!a.tem_senha ? <span className="text-muted">—<span className="sr-only">sem senha</span></span>
          : senha !== null ? <code className="rounded-sm bg-surface-muted px-1.5 py-0.5 font-mono text-foreground">{senha}</code>
            : <span className="tracking-widest text-foreground"><span aria-hidden>••••••••</span><span className="sr-only">senha guardada</span></span>}
        {erro && <p role="alert" className="mt-1 text-xs text-danger">{erro}</p>}
      </td>
      <td className="whitespace-nowrap px-2 py-1 text-right">
        {a.tem_senha && (
          <>
            <Button type="button" variant="ghost" size="icon" disabled={Boolean(motivo) || ocupado} title={motivo ?? undefined}
              aria-label={senha !== null ? `Esconder a senha de ${a.portal}` : `Revelar a senha de ${a.portal}`}
              onClick={senha !== null ? () => setSenha(null) : revelar}>
              {senha !== null ? <EyeOff aria-hidden size={16} strokeWidth={1.75} /> : <Eye aria-hidden size={16} strokeWidth={1.75} />}
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={Boolean(motivo) || ocupado} title={motivo ?? undefined}
              aria-label={`Copiar a senha de ${a.portal}`} onClick={copiar}>
              <Copy aria-hidden size={16} strokeWidth={1.75} />
            </Button>
          </>
        )}
        {podeEditar && cofreOk && (
          <JanelaAcesso clienteId={clienteId} acesso={a} gatilho={(
            <Button type="button" variant="ghost" size="icon" aria-label={`Editar o acesso ${a.portal}`}><Pencil aria-hidden size={16} strokeWidth={1.75} /></Button>
          )} />
        )}
        {podeEditar && (
          <ConfirmDialog tipo="excluir" titulo={`Remover o acesso ${a.portal}?`} descricao="A senha guardada sai junto. Fica registrado na auditoria." confirmar="Remover"
            gatilho={<Button type="button" variant="ghost" size="icon" aria-label={`Remover o acesso ${a.portal}`}><Trash2 aria-hidden size={16} strokeWidth={1.75} /></Button>}
            acao={async () => {
              const r = await removerAcesso(clienteId, a.id);
              if (r.ok) { toast.success('Acesso removido.'); router.refresh(); } else toast.error(r.erro);
            }} />
        )}
      </td>
    </tr>
  );
}

function JanelaAcesso({ clienteId, acesso, gatilho }: { clienteId: string; acesso?: AcessoLinha; gatilho: ReactElement }) {
  const router = useRouter();
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [estado, setEstado] = useState<EstadoAcesso | null>(null);
  const [semSenha, setSemSenha] = useState(acesso ? !acesso.tem_senha : false);
  const [salvando, iniciar] = useTransition();
  const erros = estado && !estado.ok ? estado.erros : {};

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // A janela é um portal dentro do formulário da ficha: este envio não sobe até ele (D13).
    e.stopPropagation();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      const r = await salvarAcesso(clienteId, acesso?.id ?? null, dados);
      setEstado(r);
      if (!r.ok) return;
      setAberto(false);
      toast.success('Acesso salvo.');
      router.refresh();
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={(v) => { setAberto(v); if (!v) setEstado(null); }}>
      <DialogTrigger asChild>{gatilho}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{acesso ? `Editar acesso: ${acesso.portal}` : 'Novo acesso de portal'}</DialogTitle>
          <DialogDescription>A senha é guardada cifrada. O agente e o assistente nunca recebem estes dados.</DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="grid gap-4" autoComplete="off">
          {erros.geral && <p role="alert" className="text-sm text-danger">{erros.geral}</p>}
          <FormField id={`${id}-portal`} rotulo="Portal" obrigatorio erro={erros.portal}>
            <Input name="portal" defaultValue={acesso?.portal ?? ''} maxLength={80} placeholder="Ex.: SEFAZ-MG" />
          </FormField>
          <FormField id={`${id}-usuario`} rotulo="Usuário" erro={erros.usuario}>
            <Input name="usuario" defaultValue={acesso?.usuario ?? ''} maxLength={120} />
          </FormField>
          <FormField id={`${id}-senha`} rotulo="Senha" erro={erros.senha} ajuda={acesso?.tem_senha ? 'Em branco: continua a senha guardada.' : undefined}>
            <Input name="senha" type="password" autoComplete="new-password" maxLength={200} disabled={semSenha} />
          </FormField>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
            <input type="checkbox" name="sem_senha" className={classeCaixa} checked={semSenha} onChange={(e) => setSemSenha(e.currentTarget.checked)} />
            Sem senha (ex.: entra pelo certificado)
          </label>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={salvando}>Salvar acesso</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Passo 2: conferir**

Run: `pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel test -- escala cofre-guarda`
Expected: verdes (a guarda do cofre continua: este arquivo **não** importa o cofre).

- [ ] **Passo 3: commit**

```bash
git add "apps/painel/src/app/(painel)/clientes/ficha/acessos-portais.tsx"
git commit -m "$(cat <<'EOF'
feat(painel): bloco Acessos de portais — senha mascarada, revelar por 30 s e copiar com auditoria, cadastro em janela própria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Painel. Páginas (ficha, Novo cliente, volta sem a migração), permissão na ficha da pessoa e largura do índice

**Files:**
- Create: `apps/painel/src/app/(painel)/clientes/ficha/dados-ficha.tsx`, `apps/painel/src/app/(painel)/clientes/ficha/cabecalho-ficha.tsx`
- Rename: `apps/painel/src/app/(painel)/clientes/[id]/secao-dados.tsx` → `[id]/secao-dados-antiga.tsx` (`git mv`, conteúdo igual)
- Create: `apps/painel/src/app/(painel)/clientes/novo/form-antigo.tsx` (o formulário de hoje, movido)
- Modify: `apps/painel/src/app/(painel)/clientes/[id]/page.tsx`, `[id]/loading.tsx`, `novo/page.tsx`
- Create: `apps/painel/src/app/(painel)/usuarios/chave-ver-acessos.tsx`; Modify: `apps/painel/src/app/(painel)/usuarios/[id]/page.tsx`
- Modify: `apps/painel/src/styles/tokens.css`, `apps/painel/src/app/globals.css`; Create: `apps/painel/src/styles/largura-ficha.test.ts`

**Interfaces:**
- Consumes: Tasks 7–11; `cofreConfigurado` (Task 5); `PageHeader`, `DocumentText`, `Badge`, `AvisoArquivado`, `ExcluirCadastro`, `AvisoErro`, `Switch`, `Label`, `ROTULO_DE_OPCAO`, `toast`; RPCs `ultima_alteracao_cliente`, `pode_ver_acessos`; `definirVerAcessos` (Task 9).
- Produces: `DadosFicha({ c, u })` (server component); `CabecalhoFicha({ c, agora })`; `NovoClienteAntigo({ erro })`; `ChaveVerAcessos({ id, nome, inicial, admin })`; utilitário `w-indice-ficha`.

- [ ] **Passo 1: teste da largura (falha)**

`apps/painel/src/styles/largura-ficha.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const globais = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

describe('largura do índice da ficha do cliente (imagem 00-cliente-cadastro, D28)', () => {
  it('token em rem (acompanha a letra) e utilitário w-indice-ficha', () => {
    expect(tokens).toMatch(/--client-index-width:\s*calc\(220rem \/ 14\)/);
    expect(globais).toMatch(/--spacing-indice-ficha:\s*var\(--client-index-width\)/);
  });
});
```

Run: `pnpm --filter @escritorio/painel test -- largura-ficha` → FAIL.

- [ ] **Passo 2: token e utilitário**

`apps/painel/src/styles/tokens.css`, depois de `--training-simulator-width`:

```css
  --client-index-width: calc(220rem / 14); /* índice de blocos da ficha do cliente (utilitário w-indice-ficha) */
```

`apps/painel/src/app/globals.css`, depois de `--spacing-simulador-treinar`:

```css
  --spacing-indice-ficha: var(--client-index-width);
```

Run: `pnpm --filter @escritorio/painel test -- largura-ficha escala tokens` → PASS.

- [ ] **Passo 3: guardar a aba de hoje para a homologação sem migração (D23)**

```bash
git mv "apps/painel/src/app/(painel)/clientes/[id]/secao-dados.tsx" "apps/painel/src/app/(painel)/clientes/[id]/secao-dados-antiga.tsx"
```

No topo do comentário de `SecaoDados` (dentro de `secao-dados-antiga.tsx`), acrescente uma linha: ` * Só aparece quando o banco ainda não tem a migração da Parte H1 (D23); some numa parte futura.` (nada mais muda no arquivo).

`apps/painel/src/app/(painel)/clientes/novo/form-antigo.tsx` — o `return` de hoje de `novo/page.tsx`, movido:

```tsx
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { FormField } from '@/components/patterns/form-field';
import { Button, variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { salvarCliente } from '../acoes';

/** Novo cliente de antes da Parte H1: só quando o banco ainda não tem a migração (D23); some numa parte futura. */
export function NovoClienteAntigo({ erro }: { erro?: string }) {
  return (
    <section className="max-w-xl">
      <PageHeader
        titulo="Novo cliente"
        descricao="Depois de salvar, a ficha da empresa abre para cadastrar contatos, produtos e preços."
        migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }]}
      />
      <p role="note" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted">
        A ficha completa aparece quando a atualização do banco da Parte H for aplicada.
      </p>
      <AvisoErro erro={erro} prefixo="Não foi possível salvar: " />
      <Card className="mt-4">
        <form action={salvarCliente.bind(null, null)}>
          <CardContent className="flex flex-col gap-4">
            <FormField id="novo-razao" rotulo="Razão social" obrigatorio>
              <Input name="razao_social" required autoComplete="off" />
            </FormField>
            <FormField id="novo-fantasia" rotulo="Nome fantasia" ajuda="Como a empresa é conhecida, se for diferente da razão social.">
              <Input name="nome_fantasia" autoComplete="off" />
            </FormField>
            <FormField id="novo-cnpj" rotulo="CNPJ" obrigatorio>
              <Input name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" autoComplete="off" />
            </FormField>
          </CardContent>
          <CardFooter className="justify-end">
            <Link href="/clientes" className={variantesBotao({ variant: 'outline' })}>Voltar</Link>
            <Button type="submit">Salvar</Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
```

- [ ] **Passo 4: cabeçalho e dados da ficha**

`ficha/cabecalho-ficha.tsx`:

```tsx
import { FileBadge } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DocumentText } from '@/components/patterns/document-text';
import { Badge } from '@/components/ui/badge';
import { clienteDesde, etiquetasDoTopo } from './ficha';

type ClienteTopo = {
  razao_social: string; nome_fantasia: string | null; cnpj: string; ativo: boolean; agente_pausado: boolean; regime: string | null;
  criado_em: string; contrato_inicio?: string | null; certificado_tipo?: string | null; certificado_vencimento?: string | null;
  certificado_avisar_dias?: number | null;
};

/** Cabeçalho da ficha (imagem): "Ficha do cliente", nome, razão social e CNPJ, cliente desde, etiquetas. Sem logo (spec 7D.1). */
export function CabecalhoFicha({ c, agora }: { c: ClienteTopo; agora: Date }) {
  const nome = c.nome_fantasia ?? c.razao_social;
  return (
    <PageHeader
      className="mb-0"
      secao="Ficha do cliente"
      titulo={nome}
      migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: nome }]}
      descricao={(
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {c.nome_fantasia && <span>{c.razao_social}</span>}
          <span>CNPJ <DocumentText valor={c.cnpj} tipo="cnpj" /></span>
          <span>· cliente desde {clienteDesde(c.contrato_inicio ?? null, c.criado_em)}</span>
          <span>· <span aria-hidden className="text-danger">*</span> campos obrigatórios (a ficha salva com pendências)</span>
        </span>
      )}
      acoes={(
        <ul aria-label="Situação da empresa" className="flex flex-wrap items-center gap-2">
          {etiquetasDoTopo(c, agora).map((e) => (
            <li key={e.texto}>
              <Badge variant={e.variante}>
                {e.icone === 'ponto' && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
                {e.icone === 'certificado' && <FileBadge aria-hidden size={12} strokeWidth={1.75} />}
                {e.texto}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
```

`ficha/dados-ficha.tsx`:

```tsx
import { cofreConfigurado } from '@/lib/cofre';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AcessosPortais, type AcessoLinha } from './acessos-portais';
import { textoUltimaAlteracao, type ClienteFicha } from './ficha';
import { FichaCliente } from './ficha-cliente';

/** Aba Dados (spec 7D.1) e Novo cliente (c = null). A senha dos acessos nunca vem: só "tem senha" (D2). */
export async function DadosFicha({ c, u }: { c: ClienteFicha | null; u: UsuarioPainel }) {
  const sb = await supabaseServidor();
  const pode = temNivel(u, 'clientes', 'editar');
  const [{ data: servicos }, { data: setores }, { data: pessoas }, { data: podeVer }] = await Promise.all([
    sb.from('servicos').select('id, nome, setor_id').eq('ativo', true).order('nome'),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    sb.rpc('pode_ver_acessos'),
  ]);

  let contratados: string[] = [];
  let responsaveis: Record<string, string> = {};
  let inscricoesSt: { uf: string; inscricao: string | null }[] = [];
  let acessos: AcessoLinha[] = [];
  let ultima: { pessoa: string; quando: string } | null = null;
  if (c) {
    const [cs, rs, st, ac, ua] = await Promise.all([
      sb.from('cliente_servicos').select('servico_id').eq('cliente_id', c.id),
      sb.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', c.id),
      sb.from('cliente_inscricoes_st').select('uf, inscricao').eq('cliente_id', c.id).order('uf'),
      // Colunas explícitas: a cifra não tem leitura para ninguém (D2); um select('*') seria recusado.
      sb.from('cliente_acessos').select('id, portal, usuario, tem_senha').eq('cliente_id', c.id).order('portal'),
      sb.rpc('ultima_alteracao_cliente', { p_cliente: c.id }),
    ]);
    contratados = (cs.data ?? []).map((s) => s.servico_id);
    responsaveis = Object.fromEntries((rs.data ?? []).map((r) => [r.setor_id, r.usuario_id]));
    inscricoesSt = (st.data ?? []).map((s) => ({ uf: s.uf.trim(), inscricao: s.inscricao }));
    acessos = (ac.data ?? []) as AcessoLinha[];
    ultima = (ua.data as { pessoa: string; quando: string } | null) ?? null;
  }
  const verAcessos = podeVer === true;

  return (
    <FichaCliente
      // Voltou do servidor com dados novos (salvou): a ficha recomeça com eles.
      key={JSON.stringify([c, contratados, responsaveis, inscricoesSt])}
      cliente={c}
      servicos={servicos ?? []}
      contratados={contratados}
      setores={setores ?? []}
      pessoas={pessoas ?? []}
      responsaveis={responsaveis}
      inscricoesSt={inscricoesSt}
      pode={pode}
      admin={u.papel === 'admin'}
      agora={new Date().toISOString()}
      ultimaAlteracao={textoUltimaAlteracao(ultima)}
      acessos={<AcessosPortais clienteId={c?.id ?? null} acessos={acessos} podeVer={verAcessos} podeEditar={pode && verAcessos} cofreOk={cofreConfigurado()} />}
    />
  );
}
```

- [ ] **Passo 5: páginas**

`[id]/page.tsx` — reescreva assim (as outras abas ficam iguais):

```tsx
import { notFound } from 'next/navigation';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { AvisoArquivado } from '@/components/patterns/lista-arquivados';
import { nomeDaPessoa } from '@/lib/arquivados';
import { cn } from '@/lib/cn';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { CabecalhoFicha } from '../ficha/cabecalho-ficha';
import { DadosFicha } from '../ficha/dados-ficha';
import { ABAS, AbasCliente, EscolhaParceiros, type Aba } from './abas';
import { SecaoContatos } from './secao-contatos';
import { SecaoDados } from './secao-dados-antiga';
import { SecaoDocumentos } from './secao-documentos';
import { SecaoParceiros } from './secao-parceiros';
import { SecaoPrecos } from './secao-precos';
import { SecaoProdutos } from './secao-produtos';

/**
 * Ficha da empresa. As abas são links (?aba=); cada seção lê só o que mostra. A aba Dados é a ficha completa (spec 7D.1);
 * sem a migração da Parte H1 no banco (homologação), volta a aba de hoje com um aviso (D23).
 */
export default async function FichaClientePagina({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; historico?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { aba: pedida, historico, erro } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? (pedida as Aba) : 'dados';
  const u = await obterUsuario();
  const pode = temNivel(u, 'clientes', 'editar');
  // Arquivar e restaurar exigem "Editar e arquivar" (Parte D); o banco (exigir_arquivar) recusa de novo.
  const podeArquivar = temNivel(u, 'clientes', 'arquivar');
  const sb = await supabaseServidor();
  const { data: c } = await sb.from('clientes').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const fichaNova = 'logradouro' in c;
  const arquivadoPor = c.ativo ? null : await nomeDaPessoa(sb, c.arquivado_por);

  return (
    <div className={cn('flex flex-col gap-4', aba !== 'dados' && 'max-w-5xl')}>
      <CabecalhoFicha c={c} agora={new Date()} />
      {!c.ativo && <AvisoArquivado tipo="cliente" id={c.id} nome={c.razao_social} arquivadoEm={c.arquivado_em} arquivadoPor={arquivadoPor} pode={podeArquivar} />}
      <AvisoErro erro={erro} prefixo="Não foi possível salvar: " />
      <AbasCliente id={id} atual={aba} />
      {(aba === 'clientes' || aba === 'fornecedores') && <EscolhaParceiros id={id} atual={aba} />}
      {aba === 'dados' && fichaNova && <DadosFicha c={c} u={u} />}
      {aba === 'dados' && !fichaNova && (
        <>
          <p role="note" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted">
            A ficha completa aparece quando a atualização do banco da Parte H for aplicada.
          </p>
          <SecaoDados id={id} u={u} pode={pode} c={c} erro={erro} />
        </>
      )}
      {aba === 'contatos' && <SecaoContatos id={id} u={u} pode={pode} />}
      {aba === 'clientes' && <SecaoParceiros id={id} tipo="cliente" pode={pode} podeArquivar={podeArquivar} />}
      {aba === 'fornecedores' && <SecaoParceiros id={id} tipo="fornecedor" pode={pode} podeArquivar={podeArquivar} />}
      {aba === 'produtos' && <SecaoProdutos id={id} pode={pode} podeArquivar={podeArquivar} />}
      {aba === 'precos' && <SecaoPrecos id={id} podeEditar={temNivel(u, 'precos', 'mudar')} historico={historico} />}
      {aba === 'documentos' && <SecaoDocumentos id={id} pode={pode} admin={u.papel === 'admin'} />}
      {aba === 'dados' && podeArquivar && c.ativo && <ExcluirCadastro tipo="cliente" id={c.id} nome={c.razao_social} variante="area" voltarPara="/clientes" />}
    </div>
  );
}
```

(Se o `typecheck` reclamar que `c` não casa com `ClienteFicha` em `<DadosFicha c={c} …>`, a linha de `clientes` do `tipos.gen.ts` está diferente do tipo da Task 7: ajuste **o tipo `ClienteFicha`** para o que o banco devolve, nunca o banco.)

`novo/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { DadosFicha } from '../ficha/dados-ficha';
import { NovoClienteAntigo } from './form-antigo';

/** Novo cliente = a mesma ficha, vazia (spec 7D.1, D25). Sem a migração da Parte H1 no banco, o formulário de hoje (D23). */
export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) redirect('/clientes');
  const sb = await supabaseServidor();
  const { error: semFicha } = await sb.from('clientes').select('logradouro').limit(1);
  if (semFicha) return <NovoClienteAntigo erro={erro} />;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        secao="Ficha do cliente"
        titulo="Novo cliente"
        migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }]}
        descricao={<>Depois de salvar, abrem as abas de contatos, produtos e preços. <span aria-hidden className="text-danger">*</span> campos obrigatórios (a ficha salva com pendências).</>}
      />
      <DadosFicha c={null} u={u} />
    </div>
  );
}
```

`[id]/loading.tsx`:

```tsx
import { Skeleton } from '@/components/ui/skeleton';

/** Abrindo a ficha: trilha, título, abas, o índice e os primeiros blocos. */
export default function CarregandoFicha() {
  return (
    <div role="status" aria-label="Carregando a empresa" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        {['w-16', 'w-20', 'w-36', 'w-20', 'w-28', 'w-24'].map((w, i) => <Skeleton key={i} className={`h-6 ${w}`} />)}
      </div>
      <div className="flex items-start gap-5">
        <div className="hidden w-indice-ficha shrink-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3 lg:flex">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {[0, 1].map((b) => (
            <div key={b} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="flex flex-col gap-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-full" /></div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Passo 6: cartão "Acessos de portais" na ficha da pessoa (D4)**

`apps/painel/src/app/(painel)/usuarios/chave-ver-acessos.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { definirVerAcessos } from './ver-acessos';

/** Permissão "Ver acessos de portais" (D3, D4): à parte dos níveis, grava na hora; o administrador sempre vê. */
export function ChaveVerAcessos({ id, nome, inicial, admin }: { id: string; nome: string; inicial: boolean; admin: boolean }) {
  const [ligado, setLigado] = useState(inicial);
  const [salvando, iniciar] = useTransition();
  const mudar = (v: boolean) => iniciar(async () => {
    const r = await definirVerAcessos(id, v);
    if (!r.ok) { toast.error(r.erro); return; }
    setLigado(v);
    toast.success(v ? `${nome} agora vê os acessos de portais.` : `${nome} não vê mais os acessos de portais.`);
  });
  return (
    <section aria-labelledby="titulo-acessos-portais" className="mt-6 rounded-lg border border-border bg-surface p-6">
      <h2 id="titulo-acessos-portais" className="border-b border-border pb-2 text-base font-semibold text-foreground">Acessos de portais</h2>
      {admin ? (
        <p className="mt-3 text-sm text-muted">O administrador sempre vê as senhas dos portais. Cada revelação fica na auditoria.</p>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          <Switch id="ver-acessos-portais" checked={ligado} disabled={salvando} onCheckedChange={mudar} />
          <div>
            <Label htmlFor="ver-acessos-portais" className={ROTULO_DE_OPCAO}>Ver acessos de portais</Label>
            <p className="text-sm text-muted">Revelar e copiar as senhas de portais na ficha do cliente. Cada revelação fica na auditoria. Grava na hora.</p>
          </div>
        </div>
      )}
    </section>
  );
}
```

`apps/painel/src/app/(painel)/usuarios/[id]/page.tsx` — import `ChaveVerAcessos` e, logo depois do `<FichaUsuario … />` (antes do `ExcluirCadastro`):

```tsx
      {/* Sem a migração da Parte H1 a coluna não existe e o cartão some (D23). */}
      {'ver_acessos_portais' in u && <ChaveVerAcessos id={u.id} nome={u.nome} inicial={Boolean(u.ver_acessos_portais)} admin={u.papel === 'admin'} />}
```

- [ ] **Passo 7: conferir no navegador (fumaça, sem e2e)**

Com o Supabase local (563xx, `supabase db reset`), a chave de teste no `.env` local (Restrições globais, item 3) e nenhum outro `next dev` desta parte ligado: `pnpm --filter @escritorio/painel exec next dev -p 3105`. Entre como um admin local, abra `/clientes/novo`, salve uma ficha com razão social e CNPJ válidos, abra a ficha, cadastre um acesso, revele e confira o toast/auditoria (`psql "$DATABASE_URL" -c "select acao, detalhes from auditoria_acessos where entidade = 'cliente_acessos'"`). **Desligue o `next dev`** antes de seguir.

Run: `pnpm --filter @escritorio/painel typecheck && pnpm --filter @escritorio/painel test`
Expected: typecheck verde; a suíte de unidade inteira do painel passa (inclusive `cofre-guarda`: `dados-ficha.tsx` está na lista; nenhum outro arquivo importa o cofre).

- [ ] **Passo 8: commit**

```bash
git add "apps/painel/src/app/(painel)/clientes" "apps/painel/src/app/(painel)/usuarios/chave-ver-acessos.tsx" "apps/painel/src/app/(painel)/usuarios/[id]/page.tsx" apps/painel/src/styles/tokens.css apps/painel/src/app/globals.css apps/painel/src/styles/largura-ficha.test.ts
git commit -m "$(cat <<'EOF'
feat(painel): ficha do cliente na aba Dados e no Novo cliente, com volta para a aba de hoje sem a migração; chave "Ver acessos de portais" na ficha da pessoa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---
### Task 13: E2e (ficha, acessos) e as duas adaptações pequenas

**Files:**
- Create: `apps/painel/e2e/apoio-ficha.ts`, `apps/painel/e2e/ficha-dados.spec.ts`, `apps/painel/e2e/ficha-acessos.spec.ts`
- Modify: `apps/painel/e2e/revisao.spec.ts` (**uma linha**, D26), `apps/painel/e2e/acessibilidade.spec.ts` (**uma rota** na lista)

**Interfaces:**
- Consumes: `criarUsuarioTeste`, `db`, `entrar` (`e2e/apoio.ts`); `exigirBancoLocal` (`e2e/trava-local.ts`); servidor falso (Task 6); nomes acessíveis das Tasks 10–12.
- Produces: `CNPJ_SOL`, `SENHA`, `abrirFicha(page, url)`, `bloco(page, titulo)`, `indice(page)`, `diaDaqui(n)`, `empresa(cnpj, extra?)`, `acessoDeMentira(clienteId, portal, email)`.

- [ ] **Passo 1: apoio**

`apps/painel/e2e/apoio-ficha.ts`:

```ts
import { expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { db } from './apoio';
import { exigirBancoLocal } from './trava-local';

/** CNPJ que o servidor falso (consultas-falsas.mjs) devolve como Padaria Sol. */
export const CNPJ_SOL = '12345678000195';
export const SENHA = 'senha-forte-123';

/** Abre a ficha e espera a hidratação (antes dela o Salvar fica desligado e a busca não responde, D26). */
export async function abrirFicha(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('form[data-ficha-hidratada]')).toBeVisible();
}
export const bloco = (page: Page, titulo: string) => page.getByRole('region', { name: titulo, exact: true });
export const indice = (page: Page) => page.getByRole('navigation', { name: 'Blocos da ficha' });

/** Dia em São Paulo daqui a N dias (AAAA-MM-DD). */
export function diaDaqui(n: number): string {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [a, m, d] = hoje.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Empresa de teste (apaga a de antes com o mesmo CNPJ; inscrições, acessos e avisos saem em cascata). */
export async function empresa(cnpj: string, extra: Record<string, unknown> = {}): Promise<string> {
  await db.from('clientes').delete().eq('cnpj', cnpj);
  const { data, error } = await db.from('clientes').insert({ razao_social: 'Ficha H1 Ltda', cnpj, ...extra }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Acesso cadastrado pela função do banco, com a sessão de um administrador (nem a chave de serviço grava a senha, D2).
 * A cifra é de mentira, no formato certo: serve para testar quem revela, não para abrir a senha.
 */
export async function acessoDeMentira(clienteId: string, portal: string, email: string): Promise<string> {
  exigirBancoLocal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, { auth: { persistSession: false } });
  const { error: erroLogin } = await sb.auth.signInWithPassword({ email, password: SENHA });
  if (erroLogin) throw erroLogin;
  const { data, error } = await sb.rpc('salvar_acesso', {
    p_id: null, p_cliente: clienteId, p_portal: portal, p_usuario: 'padariasol', p_senha_cifrada: 'v1.AAAAAAAAAAAAAAAA.BBBBBBBBBBBBBBBBBBBBBB.Zm9v',
  });
  if (error) throw error;
  return data as string;
}
```

- [ ] **Passo 2: e2e da ficha**

`apps/painel/e2e/ficha-dados.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirFicha, bloco, CNPJ_SOL, diaDaqui, empresa, indice, SENHA } from './apoio-ficha';

// Parte H1 (spec 7D.1 e 7D.3): blocos do cadastro com busca de CNPJ/CEP simulada (servidor falso, D32) e pendências no índice.
const ADMIN = 'admin-ficha@e2e.local';
const CNPJ_TESTE = '12121212000106';

async function comoAdmin(page: Page): Promise<string> {
  const id = await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  await entrar(page, ADMIN, SENHA);
  return id;
}

test('Novo cliente: o CNPJ busca razão social, CNAE e endereço; o resto vira pendência e a ficha salva assim mesmo', async ({ page }) => {
  await db.from('clientes').delete().eq('cnpj', CNPJ_SOL);
  await comoAdmin(page);
  await abrirFicha(page, '/clientes/novo');
  await page.getByLabel('CNPJ').fill('12.345.678/0001-95');
  await page.getByRole('button', { name: 'Buscar dados públicos da empresa' }).click();
  await expect(page.getByText('Preenchido pela busca: razão social, nome fantasia, CNAE e endereço.')).toBeVisible();
  await expect(page.getByLabel('Razão social')).toHaveValue('PADARIA SOL COMERCIO DE ALIMENTOS ME');
  await expect(page.getByLabel('CNAE principal')).toHaveValue('1091-1/01 · Fabricação de produtos de panificação');
  await expect(page.getByLabel('CEP', { exact: true })).toHaveValue('36404-450');
  await expect(page.getByLabel('Logradouro')).toHaveValue('Rua Rosa Figueiredo');
  await expect(page.getByLabel('Cidade')).toHaveValue('Conselheiro Lafaiete');
  await expect(page.getByLabel('UF', { exact: true })).toHaveValue('MG');
  // Faltam regime e segmento; o endereço veio inteiro da busca.
  await expect(indice(page).getByRole('link', { name: /Identificação.*2 pendentes/ })).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Endereço.*completo/ })).toBeVisible();
  await page.getByLabel('Regime tributário').selectOption('Simples Nacional');
  await page.getByLabel('Comércio').check();
  await expect(indice(page).getByRole('link', { name: /Identificação.*completo/ })).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Contrato e honorários.*2 pendentes/ })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'PADARIA SOL', level: 1 })).toBeVisible();
  await expect.poll(async () => (await db.from('clientes')
    .select('regime, segmentos, cnae_principal, logradouro, numero, bairro, cidade, uf, cep, endereco, contrato_inicio').eq('cnpj', CNPJ_SOL).single()).data)
    .toEqual({
      regime: 'Simples Nacional', segmentos: ['comercio'], cnae_principal: '1091-1/01 · Fabricação de produtos de panificação',
      logradouro: 'Rua Rosa Figueiredo', numero: '430', bairro: 'São Marcos', cidade: 'Conselheiro Lafaiete', uf: 'MG', cep: '36404450',
      endereco: 'Rua Rosa Figueiredo, 430 - São Marcos, Conselheiro Lafaiete/MG, CEP 36404-450', contrato_inicio: null,
    });
});

test('busca que falha não trava: CEP desconhecido, CEP lento e CNPJ fora da busca viram aviso', async ({ page }) => {
  test.setTimeout(60_000);
  await comoAdmin(page);
  await abrirFicha(page, '/clientes/novo');
  const endereco = bloco(page, 'Endereço');
  await page.getByLabel('CEP', { exact: true }).fill('99999-999');
  await endereco.getByRole('button', { name: 'Buscar o endereço' }).click();
  await expect(endereco.getByText('Não achei este CEP. Preencha à mão.')).toBeVisible();
  await page.getByLabel('CEP', { exact: true }).fill('11111-111');
  await endereco.getByRole('button', { name: 'Buscar o endereço' }).click();
  await expect(endereco.getByText('Não consegui buscar agora. Preencha à mão.')).toBeVisible({ timeout: 10_000 });
  await page.getByLabel('Logradouro').fill('Rua Escrita à Mão');
  await expect(page.getByLabel('Logradouro')).toHaveValue('Rua Escrita à Mão');
  const identificacao = bloco(page, 'Identificação');
  await page.getByLabel('CNPJ').fill('11.222.333/0001-81');
  await identificacao.getByRole('button', { name: 'Buscar dados públicos da empresa' }).click();
  await expect(identificacao.getByText('Não achei este CNPJ na busca pública. Preencha à mão.')).toBeVisible();
  await page.getByLabel('CNPJ').fill('55.566.677/0001-83');
  await identificacao.getByRole('button', { name: 'Buscar dados públicos da empresa' }).click();
  await expect(identificacao.getByText('Não consegui buscar agora. Preencha à mão.')).toBeVisible();
});

test('cliente existente: contrato, honorários, inscrições ST, serviços e responsáveis num Salvar só', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE);
  await db.from('servicos').delete().eq('nome', 'Serviço Ficha E2E');
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: servico } = await db.from('servicos').insert({ nome: 'Serviço Ficha E2E', setor_id: fiscal!.id }).select('id').single();
  const bia = await criarUsuarioTeste({ email: 'bia-ficha@e2e.local', senha: SENHA, nome: 'Bia Ficha', papel: 'atendente', setores: ['Fiscal'] });
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  await page.getByLabel('Início do contrato').fill('2022-03-01');
  await page.getByLabel('Honorário mensal').fill('1.250,00');
  await page.getByLabel('Dia de vencimento').fill('10');
  await page.getByLabel('Reajuste').selectOption({ label: 'Anual · março' });
  await page.getByLabel('13º honorário').selectOption({ label: 'Sim, em dezembro' });
  const fiscalBloco = bloco(page, 'Fiscal · Inscrições de substituto tributário');
  await fiscalBloco.getByRole('button', { name: 'Adicionar inscrição' }).click();
  await fiscalBloco.getByRole('button', { name: 'Adicionar inscrição' }).click();
  await page.getByLabel('UF da linha 1').selectOption('SP');
  await page.getByLabel('Inscrição da linha 1').fill('123.456.789.110');
  await page.getByLabel('UF da linha 2').selectOption('RJ');
  await expect(fiscalBloco.getByText('1 linha sem inscrição')).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Fiscal.*1 pendente/ })).toBeVisible();
  await page.getByLabel('Serviço Ficha E2E').check();
  await page.getByLabel('Responsável pelo setor Fiscal').selectOption({ label: 'Bia Ficha' });
  await expect(page.getByText('Alterações não salvas')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Ficha salva.')).toBeVisible();
  await expect.poll(async () => (await db.from('clientes')
    .select('honorario_mensal, contrato_inicio, dia_vencimento, reajuste, reajuste_mes, decimo_terceiro').eq('id', id).single()).data)
    .toEqual({ honorario_mensal: 1250, contrato_inicio: '2022-03-01', dia_vencimento: 10, reajuste: 'anual', reajuste_mes: 3, decimo_terceiro: true });
  expect((await db.from('cliente_inscricoes_st').select('uf, inscricao').eq('cliente_id', id).order('uf')).data)
    .toEqual([{ uf: 'RJ', inscricao: null }, { uf: 'SP', inscricao: '123.456.789.110' }]);
  expect((await db.from('cliente_servicos').select('servico_id').eq('cliente_id', id)).data).toEqual([{ servico_id: servico!.id }]);
  expect((await db.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', id)).data).toEqual([{ setor_id: fiscal!.id, usuario_id: bia }]);

  // A ficha volta com os dados novos e quem mudou por último (D24).
  await abrirFicha(page, `/clientes/${id}`);
  await expect(page.getByText(/Última alteração: Admin Ficha, \d{2}\/\d{2} \d{2}:\d{2}/)).toBeVisible();
  // Tirar a linha sem inscrição (RJ, a primeira pela UF) também é um Salvar.
  await bloco(page, 'Fiscal · Inscrições de substituto tributário').getByRole('button', { name: 'Remover a linha 1' }).click();
  await expect(page.getByText('Alterações não salvas')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(async () => (await db.from('cliente_inscricoes_st').select('uf').eq('cliente_id', id)).data).toEqual([{ uf: 'SP' }]);
});

test('certificado perto de vencer: etiqueta no topo e "vence" no índice; "Sem certificado" completa na hora', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE, { certificado_tipo: 'e_cnpj_a1', certificado_vencimento: diaDaqui(23), certificado_avisar_dias: 30, regime: 'Simples Nacional' });
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  const situacao = page.getByRole('list', { name: 'Situação da empresa' });
  await expect(situacao.getByText('Ativo', { exact: true })).toBeVisible();
  await expect(situacao.getByText('Certificado vence em 23 dias')).toBeVisible();
  await expect(situacao.getByText('Simples Nacional')).toBeVisible();
  await expect(indice(page).getByRole('link', { name: /Certificado digital.*vence/ })).toBeVisible();
  await expect(bloco(page, 'Certificado digital').getByText('vence em 23 dias')).toBeVisible();
  await page.getByLabel('Tipo', { exact: true }).selectOption({ label: 'Sem certificado' });
  await expect(indice(page).getByRole('link', { name: /Certificado digital.*completo/ })).toBeVisible();
});

test('endereço antigo: aparece em Logradouro, vira pendência e salvar outra coisa não mexe nele', async ({ page }) => {
  const antigo = 'Rua Antiga, 10 - Centro, Belo Horizonte';
  const id = await empresa(CNPJ_TESTE, { endereco: antigo, logradouro: antigo });
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  await expect(page.getByLabel('Logradouro')).toHaveValue(antigo);
  await expect(indice(page).getByRole('link', { name: /Endereço.*5 pendentes/ })).toBeVisible();
  await page.getByLabel('Telefone').fill('(31) 3333-4444');
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Ficha salva.')).toBeVisible();
  await expect.poll(async () => (await db.from('clientes').select('telefone, endereco, logradouro').eq('id', id).single()).data)
    .toEqual({ telefone: '3133334444', endereco: antigo, logradouro: antigo });
});

test('"Só ver": a ficha aparece com os campos desligados, sem busca e sem Salvar', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE, { regime: 'MEI' });
  await criarUsuarioTeste({ email: 'ana-ficha@e2e.local', senha: SENHA, nome: 'Ana Ficha', papel: 'atendente' });
  await entrar(page, 'ana-ficha@e2e.local', SENHA);
  await abrirFicha(page, `/clientes/${id}`);
  await expect(page.getByLabel('Razão social')).toBeDisabled();
  await expect(page.getByLabel('Regime tributário')).toHaveValue('MEI');
  await expect(page.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
  await expect(page.getByText('Só quem pode editar clientes altera estes dados.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buscar dados públicos da empresa' })).toHaveCount(0);
  // Sem segmento: 1 pendência, calculada pelo que está salvo.
  await expect(indice(page).getByRole('link', { name: /Identificação.*1 pendente/ })).toBeVisible();
});

test('administrador pausa o agente pela ficha (mesmo rótulo de hoje)', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE);
  await comoAdmin(page);
  await abrirFicha(page, `/clientes/${id}`);
  await page.getByLabel('Pausar o agente para este cliente').check();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect.poll(async () => (await db.from('clientes').select('agente_pausado').eq('id', id).single()).data?.agente_pausado).toBe(true);
  await expect(page.getByRole('list', { name: 'Situação da empresa' }).getByText('Agente pausado para esta empresa')).toBeVisible();
});
```

- [ ] **Passo 3: e2e dos acessos**

`apps/painel/e2e/ficha-acessos.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirFicha, acessoDeMentira, bloco, empresa, SENHA } from './apoio-ficha';

// Parte H1 (spec 7D.1 item 8 e 7D.3): revelar senha com e sem permissão; a senha nunca aparece antes de revelar,
// nunca vai para a auditoria e nem a chave de serviço (a do trabalhador) lê a cifra.
const ADMIN = 'admin-acessos@e2e.local';
const CNPJ_TESTE = '12121212000106';
const SENHA_PORTAL = 'Portal#Segredo-2026';

test('administrador cadastra o acesso: cifrado, mascarado, e revelar e copiar vão para a auditoria sem o segredo', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const id = await empresa(CNPJ_TESTE);
  const admin = await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Acessos', papel: 'admin' });
  await entrar(page, ADMIN, SENHA);
  await abrirFicha(page, `/clientes/${id}`);
  const acessos = bloco(page, 'Acessos de portais');
  await acessos.getByRole('button', { name: 'Adicionar acesso' }).click();
  const janela = page.getByRole('dialog', { name: 'Novo acesso de portal' });
  await janela.getByLabel('Portal').fill('SEFAZ-MG');
  await janela.getByLabel('Usuário').fill('padariasol');
  await janela.getByLabel('Senha', { exact: true }).fill(SENHA_PORTAL);
  await janela.getByRole('button', { name: 'Salvar acesso' }).click();
  await expect(janela).toHaveCount(0);
  const linha = acessos.getByRole('row', { name: /SEFAZ-MG/ });
  await expect(linha).toContainText('padariasol');
  await expect(linha.getByText('senha guardada')).toBeAttached();
  expect(await page.content()).not.toContain(SENHA_PORTAL);

  // Nem a chave de serviço lê a cifra (D2); portal, usuário e "tem senha" ela lê.
  const cifra = await db.from('cliente_acessos').select('senha_cifrada').eq('cliente_id', id);
  expect(cifra.error?.message ?? '').toMatch(/permission denied/);
  const { data: linhas } = await db.from('cliente_acessos').select('id, portal, usuario, tem_senha').eq('cliente_id', id);
  expect(linhas!.map(({ portal, usuario, tem_senha }) => ({ portal, usuario, tem_senha }))).toEqual([{ portal: 'SEFAZ-MG', usuario: 'padariasol', tem_senha: true }]);
  const acesso = linhas![0]!.id;

  await linha.getByRole('button', { name: 'Revelar a senha de SEFAZ-MG' }).click();
  await expect(linha.getByText(SENHA_PORTAL)).toBeVisible();
  await linha.getByRole('button', { name: 'Esconder a senha de SEFAZ-MG' }).click();
  await expect(linha.getByText(SENHA_PORTAL)).toHaveCount(0);
  await linha.getByRole('button', { name: 'Copiar a senha de SEFAZ-MG' }).click();
  await expect(page.getByText('Senha copiada.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SENHA_PORTAL);
  await expect(linha.getByText(SENHA_PORTAL)).toHaveCount(0);

  await expect.poll(async () => (await db.from('auditoria_acessos').select('acao, usuario_id, detalhes').eq('entidade_id', acesso).order('acao')).data
    ?.map((a) => [a.acao, a.usuario_id, (a.detalhes as { portal?: string } | null)?.portal]))
    .toEqual([['copiar_acesso', admin, 'SEFAZ-MG'], ['revelar_acesso', admin, 'SEFAZ-MG'], ['salvar_acesso', admin, 'SEFAZ-MG']]);
  // A senha e a cifra nunca entram na auditoria.
  const auditoria = JSON.stringify((await db.from('auditoria_acessos').select('detalhes')).data);
  expect(auditoria).not.toContain(SENHA_PORTAL);
  expect(auditoria).not.toContain('v1.');
});

test('sem "Ver acessos de portais": vê portal e usuário, não revela nem copia, e nada vai para a auditoria', async ({ page }) => {
  const id = await empresa(CNPJ_TESTE);
  await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Acessos', papel: 'admin' });
  const acesso = await acessoDeMentira(id, 'SEFAZ-MG', ADMIN);
  await criarUsuarioTeste({ email: 'bia-acessos@e2e.local', senha: SENHA, nome: 'Bia Acessos', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia-acessos@e2e.local', SENHA);
  await abrirFicha(page, `/clientes/${id}`);
  const acessos = bloco(page, 'Acessos de portais');
  const linha = acessos.getByRole('row', { name: /SEFAZ-MG/ });
  await expect(linha).toContainText('padariasol');
  await expect(linha.getByRole('button', { name: 'Revelar a senha de SEFAZ-MG' })).toBeDisabled();
  await expect(linha.getByRole('button', { name: 'Copiar a senha de SEFAZ-MG' })).toBeDisabled();
  await expect(acessos.getByText('Revelar e copiar só com a permissão "Ver acessos de portais".')).toBeVisible();
  // "Ver e editar" sozinho não cadastra, não edita e não remove (D6).
  await expect(acessos.getByRole('button', { name: 'Adicionar acesso' })).toHaveCount(0);
  await expect(linha.getByRole('button', { name: /Editar o acesso|Remover o acesso/ })).toHaveCount(0);
  expect((await db.from('auditoria_acessos').select('acao').eq('entidade_id', acesso).neq('acao', 'salvar_acesso')).data).toEqual([]);
});

test('o administrador dá "Ver acessos de portais" na ficha da pessoa e ela passa a revelar', async ({ page, context }) => {
  const id = await empresa(CNPJ_TESTE);
  await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Acessos', papel: 'admin' });
  const ze = await criarUsuarioTeste({ email: 'ze-acessos@e2e.local', senha: SENHA, nome: 'Zé Acessos', papel: 'atendente' });
  await entrar(page, ADMIN, SENHA);
  // Acesso com senha de verdade (cifrada pelo painel), cadastrado pela tela.
  await abrirFicha(page, `/clientes/${id}`);
  await bloco(page, 'Acessos de portais').getByRole('button', { name: 'Adicionar acesso' }).click();
  const janela = page.getByRole('dialog', { name: 'Novo acesso de portal' });
  await janela.getByLabel('Portal').fill('Prefeitura (NFS-e)');
  await janela.getByLabel('Senha', { exact: true }).fill(SENHA_PORTAL);
  await janela.getByRole('button', { name: 'Salvar acesso' }).click();
  await expect(janela).toHaveCount(0);
  await page.goto(`/usuarios/${ze}`);
  const chave = page.getByRole('switch', { name: 'Ver acessos de portais' });
  await expect(chave).not.toBeChecked();
  await chave.click();
  await expect(page.getByText('Zé Acessos agora vê os acessos de portais.')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('ver_acessos_portais').eq('id', ze).single()).data?.ver_acessos_portais).toBe(true);

  await context.clearCookies();
  await entrar(page, 'ze-acessos@e2e.local', SENHA);
  await abrirFicha(page, `/clientes/${id}`);
  const linha = bloco(page, 'Acessos de portais').getByRole('row', { name: /Prefeitura/ });
  await linha.getByRole('button', { name: 'Revelar a senha de Prefeitura (NFS-e)' }).click();
  await expect(linha.getByText(SENHA_PORTAL)).toBeVisible();
  const { data: acesso } = await db.from('cliente_acessos').select('id').eq('cliente_id', id).single();
  await expect.poll(async () => (await db.from('auditoria_acessos').select('acao, usuario_id').eq('entidade_id', acesso!.id).eq('acao', 'revelar_acesso')).data)
    .toEqual([{ acao: 'revelar_acesso', usuario_id: ze }]);
});
```

- [ ] **Passo 4: as duas adaptações (D26)**

`apps/painel/e2e/revisao.spec.ts`, item 6 — troque **só** esta linha:

```ts
  await page.getByRole('button', { name: 'Salvar serviços' }).click();
```

por:

```ts
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
```

`apps/painel/e2e/acessibilidade.spec.ts` — na lista `rotas`, logo depois de `'/clientes?ver=arquivados',`, acrescente `'/clientes/novo',` (tela nova, regra de `docs/design-system.md`). Nada mais muda.

Prova: `git diff BASE -- apps/painel/e2e/revisao.spec.ts apps/painel/e2e/acessibilidade.spec.ts` mostra exatamente uma linha trocada e uma acrescentada.

- [ ] **Passo 5: rodar em lotes pequenos (nunca a suíte inteira aqui)**

Com o Supabase local (563xx) e `supabase db reset`, **nenhum `next dev` desta parte ligado** (o Playwright sobe o seu, com o servidor falso e a chave de teste):

1. `cd apps/painel && pnpm exec playwright test e2e/ficha-dados.spec.ts` → 7 passam.
2. `pnpm exec playwright test e2e/ficha-acessos.spec.ts` → 3 passam.
3. `pnpm exec playwright test e2e/clientes.spec.ts e2e/cadastros.spec.ts e2e/arquivar-clientes.spec.ts e2e/revisao.spec.ts` → todos passam **sem mudança** nos três primeiros (D26).
4. `pnpm exec playwright test e2e/acessibilidade.spec.ts` → passa nos dois temas (inclusive `/clientes/<id>` com a ficha nova e `/clientes/novo`).

Se o lote 3 falhar em `getByLabel('CNPJ')` por "strict mode violation", algum nome acessível novo contém "CNPJ": troque o nome novo, nunca o teste antigo.

- [ ] **Passo 6: devolver portas e commit**

```bash
git add apps/painel/e2e/apoio-ficha.ts apps/painel/e2e/ficha-dados.spec.ts apps/painel/e2e/ficha-acessos.spec.ts apps/painel/e2e/revisao.spec.ts apps/painel/e2e/acessibilidade.spec.ts
git commit -m "$(cat <<'EOF'
test(painel): e2e da ficha do cliente (busca simulada, pendências, um Salvar) e dos acessos de portais (com e sem permissão, auditoria sem segredo)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Manuais e variável nova

**Files:**
- Modify: `docs/design-system.md`, `docs/operacao.md`, `.env.example`

- [ ] **Passo 1: `.env.example`**

No bloco `# Painel`, depois de `PAINEL_URL=…`:

```bash
# Chave das senhas de portais (ficha do cliente): base64 de 32 bytes, diferente em cada ambiente e fora do banco.
# Gere com: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Sem ela, a ficha mostra os acessos, mas não guarda nem revela senhas. Perder a chave = cadastrar as senhas de novo.
ACESSOS_PORTAIS_CHAVE=
# Opcional (testes): endereços da busca pública de CNPJ e CEP. Vazio = BrasilAPI e ViaCEP.
CONSULTA_CNPJ_URL=
CONSULTA_CEP_URL=
```

- [ ] **Passo 2: `docs/operacao.md`**

1. Em **2.2 Easypanel**, item 5, depois da linha do `PAINEL_URL`, acrescente:
   `   - `ACESSOS_PORTAIS_CHAVE` (só no app **Painel**): a chave das senhas de portais da ficha do cliente. Gere uma por ambiente com o comando do `.env.example` e guarde uma cópia num lugar seguro (gerenciador de senhas). Sem ela, as senhas não abrem; trocar ou perder a chave obriga a cadastrar as senhas de novo.`
2. Em **Pessoas, permissões e horário de acesso**, depois da tabela de módulos, acrescente o parágrafo:
   `**Ver acessos de portais** é uma permissão à parte, no cartão "Acessos de portais" embaixo da ficha da pessoa (grava na hora). Ela deixa revelar e copiar as senhas dos portais na ficha do cliente; cadastrar ou trocar uma senha pede também "Ver e editar" em Clientes. O administrador sempre vê. Cada revelação e cada cópia ficam na auditoria (quem, quando, empresa e portal).`
3. Em **3. Dia a dia**, nova subseção depois de "Contatos: lista e painel":

```markdown
### Ficha do cliente (aba Dados)

A ficha tem um índice à esquerda: ✓ quando o bloco está completo, "N pendentes" quando falta um campo com `*`, "vence"/"vencido" no certificado. Os `*` não impedem salvar (só razão social e CNPJ): o que faltar fica como pendência para completar depois. Um **Salvar** no rodapé grava a aba inteira (dados, endereço, contato, inscrições de substituto tributário, contrato, serviços, responsáveis e certificado); **Cancelar** volta ao que está salvo.

- **Busca pública:** a lupa do CNPJ (ou sair do campo com o número completo) preenche razão social, nome fantasia, CNAE e endereço **só nos campos vazios**; a lupa do CEP preenche rua, bairro, cidade e UF. Só o número sai do escritório (BrasilAPI e ViaCEP). Se a busca não achar ou demorar, a tela avisa e você preenche à mão.
- **Endereço antigo:** quem tinha o endereço num campo só ficou com ele inteiro em "Logradouro"; complete CEP, número, bairro, cidade e UF quando abrir a ficha. O agente continua informando o endereço por extenso, montado dos campos.
- **Certificado digital:** com o vencimento e o "Avisar antes" (padrão 30 dias), o sistema abre sozinho, todo dia às 7h, uma demanda no Fiscal para o responsável do Fiscal da empresa (sem responsável, vai para a fila do setor) — uma por certificado e vencimento. Ela aparece no Início como as outras demandas. "Sem certificado" desliga o aviso.
- **Acessos de portais:** portal, usuário e senha. A senha é guardada cifrada e aparece mascarada; revelar (some em 30 segundos) e copiar exigem a permissão "Ver acessos de portais" e ficam na auditoria. O agente, o assistente, os registros do sistema e as exportações nunca recebem as senhas.
- **Honorários e contrato** ficam na ficha para a equipe; o agente e o assistente não leem.
```

4. Em **5. Segurança e LGPD**, nova linha da lista: `- **Senhas de portais dos clientes** ficam cifradas com a chave ACESSOS_PORTAIS_CHAVE, que mora só no Easypanel (fora do banco): nem uma cópia do banco nem a chave de serviço do Supabase abrem as senhas.`

- [ ] **Passo 3: `docs/design-system.md`**

1. Depois do parágrafo **Treinar o agente (G5)**:

```markdown
**Ficha do cliente** (H1, `clientes/ficha/`): página inteira com o índice "Blocos da ficha" à esquerda (`w-indice-ficha`, token `--client-index-width`; ✓ com "completo" para o leitor de tela, "N pendentes", "vence"/"vencido" e cadeado escritos — a cor nunca fala sozinha) e os blocos como regiões com nome (`BlocoFicha`: título em caixa alta vinho, observação à direita, `fieldset` desligado para quem só vê). Um `FormularioAlteravel` para a aba inteira, com rodapé fixo (última alteração, CANCELAR remonta, SALVAR só ativo depois de hidratar) e o atributo `data-ficha-hidratada` (contrato dos e2e). Campo com lupa (`CampoComLupa`) para busca pública: o nome da lupa nunca repete o rótulo do campo ("Buscar dados públicos da empresa", "Buscar o endereço"). Valor em reais com `CampoDinheiro` ("R$" ao lado). Janelas dentro da ficha (acessos) param o envio no próprio formulário (`stopPropagation`) e o envio da ficha ignora o que não veio dele. **Acessos de portais:** faixa grafite com o escudo champanhe, senha `••••••••` com "senha guardada" para o leitor de tela, revelar (30 s) e copiar sempre pelo servidor; só `acessos-acoes.ts` (e a página, para saber se há chave) importa `lib/cofre.ts` (`cofre-guarda.test.ts`).
```

2. No **Vocabulário oficial**, nova linha depois de **Contatos**:
   `- **Ficha do cliente:** "Ficha do cliente", "Blocos da ficha", "completo", "1 pendente"/"N pendentes", "vence", "vencido", "protegido", "Identificação", "Endereço", "Contato", "Fiscal · Inscrições de substituto tributário", "Contrato e honorários", "Responsáveis por setor", "Certificado digital", "Acessos de portais", "linha sem inscrição", "Outros setores (N)", "Fila do setor", "Preenchido pela busca: …", "Preencha à mão", "Certificado vence em N dias", "cliente desde MM/AAAA", "Última alteração: <pessoa>, dd/mm HH:MM", "senha guardada", "Revelar a senha de <portal>", "Copiar a senha de <portal>", "Senha copiada.", "Ver acessos de portais", "Sem senha (ex.: entra pelo certificado)".`

- [ ] **Passo 4: commit**

```bash
git add docs/design-system.md docs/operacao.md .env.example
git commit -m "$(cat <<'EOF'
docs: ficha do cliente (índice de pendências, busca pública, certificado com demanda automática, acessos de portais cifrados) e a chave ACESSOS_PORTAIS_CHAVE

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

## Entrega (depois da revisão final do branch)

1. **Resultado real de todas as suítes,** com o Supabase local nas portas 563xx (Restrições globais) e **`supabase db reset`** antes da suíte pgTAP e antes do primeiro lote de e2e:
   - **o que não podia mudar não mudou:** `git diff BASE --stat -- apps/trabalhador/src/agente apps/trabalhador/src/assistente` **vazio** (D33); `git diff 8f5eb71 -- supabase/tests/22_regressao_visibilidade.test.sql` vazio; `git diff BASE --stat -- supabase/tests` só mostra `39`, `40` e `41` (novos); `git diff BASE --stat -- 'apps/**/*.test.ts' 'packages/**/*.test.ts'` só mostra arquivos **novos**; `git diff BASE -- apps/painel/e2e/revisao.spec.ts apps/painel/e2e/acessibilidade.spec.ts` = uma linha trocada e uma acrescentada (D26); `git diff BASE --stat -- apps/painel/e2e/clientes.spec.ts apps/painel/e2e/cadastros.spec.ts apps/painel/e2e/arquivar-clientes.spec.ts` vazio;
   - `supabase test db`: todos os arquivos com os números de cada um, inclusive `22` (100/100), `23`, `39` (27), `40` (34) e `41` (16);
   - `pnpm --filter @escritorio/core test`; `pnpm --filter @escritorio/db test` e `typecheck` (inclusive `niveis.test.ts`: o catálogo da Parte D igual, D3);
   - `pnpm --filter @escritorio/trabalhador test` e `typecheck` (inclusive `certificado.test.ts` e `agente/cadastro-sem-contrato.test.ts`);
   - `pnpm --filter @escritorio/painel test` e `typecheck`;
   - **e2e em lotes** (pouca memória; nada mais rodando além do Supabase local): lote 1 `e2e/ficha-dados.spec.ts e2e/ficha-acessos.spec.ts`; lote 2 `e2e/clientes.spec.ts e2e/cadastros.spec.ts e2e/arquivar-clientes.spec.ts e2e/revisao.spec.ts e2e/niveis-telas.spec.ts e2e/usuarios-ficha.spec.ts`; lote 3 `e2e/acessibilidade.spec.ts`; depois os demais arquivos de `ls apps/painel/e2e/*.spec.ts`, em lotes de até 6, na ordem alfabética (`supabase db reset` entre lotes se um pgTAP ou e2e reclamar de dados velhos). Some os números de todos os lotes;
   - **cenários com Claude de verdade (`cenarios`, `cenarios-atendimento`, `cenarios-assistente`): não rodar** — nada do que o modelo vê mudou (D33; prova: o primeiro `git diff` e o teste das 7 chaves). Os cenários da 7D.3 ("Carla", contato Básico, "sou o sócio…") são da **H2**;
   - mostre os números exatos de cada suíte e de cada lote (passaram, falharam, pulados). Nada de "deve passar";
   - anexe a saída de `$SCRATCH/cripto-local.txt` (Task 2, Passo 0);
   - ao terminar, devolva `supabase/config.toml` e `.env` às portas originais, a partir das cópias, e confira com `git status`.
2. **Capturas para o dono comparar com `00-cliente-cadastro.png`:**
   - larguras **1366 e 1920**, tema **claro e escuro**, com o painel local (`next dev` na 3105, com `ACESSOS_PORTAIS_CHAVE` de teste no `.env` local e o servidor falso ligado: `node apps/painel/e2e/consultas-falsas.mjs` + `CONSULTA_CNPJ_URL=http://127.0.0.1:3199/api/cnpj/v1` e `CONSULTA_CEP_URL=http://127.0.0.1:3199/ws` no ambiente do `next dev`; **nunca** a busca de verdade, **nunca** o banco da homologação);
   - dados parecidos com os da imagem, no banco **local**: Ana (admin); Bruno e Cláudia (atendentes); setores da base; serviços Contábil, Fiscal, Pessoal, Legalização e IRPF sócios; a Padaria Sol ME (CNPJ `12345678000195`, razão "Padaria Sol Comércio de Alimentos ME", fantasia "Padaria Sol", IE `0037486930064`, CNAE "1091-1/01 · Fabricação de produtos de panificação", Simples Nacional, ME, R$ 820.000,00, 8 funcionários, Comércio + Indústria, endereço da imagem, telefones e e-mails da imagem, inscrições ST SP `123.456.789.110` e RJ sem inscrição, contrato desde 01/03/2022, R$ 1.250,00, dia 10, anual · março, 13º sim, serviços Contábil/Fiscal/Pessoal, responsáveis Fiscal Ana / Pessoal Bruno / Contábil Cláudia, certificado e-CNPJ A1 vencendo em 23 dias) gravada pela própria ficha (script Playwright) e três acessos cadastrados pela janela (Prefeitura (NFS-e) `12345678000190`, SEFAZ-MG `padariasol`, e-CAC "via certificado" sem senha);
   - use o Playwright (navegador do MCP ou um script temporário na pasta de rascunho da sessão, **fora do repositório**);
   - salve em `C:\Users\Thiago\Desktop\CAPTURAS-PAINEL-V2\parte-h1\` com nomes `h1-<tela>-<largura>-<tema>.png`: `ficha` (página inteira, rolada do topo ao rodapé, como a imagem), `ficha-topo` (só a primeira tela: cabeçalho, abas, índice, Identificação), `ficha-novo` (`/clientes/novo` depois da busca do CNPJ, com as pendências no índice), `ficha-acesso-revelado` (SEFAZ-MG revelada), `ficha-janela-acesso` ("Novo acesso de portal" aberta), `ficha-so-ver` (atendente "Só ver", sem a permissão), `usuario-acessos` (ficha do Bruno com o cartão "Acessos de portais");
   - liste o que ficou diferente da imagem. Já se sabe: abas com os rótulos de hoje ("Preços por rede", D27); título é o nome fantasia (ou a razão social), com a razão social e o CNPJ embaixo; sem "ver registro de alterações" no rodapé (D24); "Tipo de pessoa" fixo em Jurídica (D17); "Outros setores (N)" recolhido em Responsáveis (D16); a linha "* campos obrigatórios · cliente desde 03/2022" fica embaixo do título, não na barra do topo; razão social da busca vem em maiúsculas (como a Receita devolve).
3. **Homologação — só `--dry-run`, sem aplicar:**
   - com as variáveis do `.env.homologacao` carregadas (só leitura, sem alterar o arquivo), rode `supabase db push --db-url "$DATABASE_URL" --dry-run` e **mostre a saída ao dono**. Ela deve listar as pendentes de antes — Parte F (`20261006000100` a `20261006000300`), G1 (`20261007000100`, `20261007000200`), G2 (`20261008000100`), G3 (`20261009000100`) — **e as três da H1**: `20261012000100_painel_v2_ficha_cliente.sql`, `20261012000200_painel_v2_acessos_portais.sql`, `20261012000300_painel_v2_certificado.sql`. Se aparecer outra, pare e avise;
   - **não aplique.** Deixe para o dono, por escrito: a H1 só acrescenta (nenhuma coluna sai; o endereço antigo é copiado para Logradouro sem ser apagado; o aviso da migração diz quantos clientes foram copiados); nada da H1 depende da F ou da G; para aplicar tudo junto, depois do "ok": `supabase db push --db-url "$DATABASE_URL"`; **antes de usar os acessos de portais na homologação**, acrescentar `ACESSOS_PORTAIS_CHAVE` (gerada com o comando do `.env.example`) ao ambiente do painel da homologação — quem altera o `.env.homologacao` é o dono.
4. **Subir o painel para o dono ver:**
   - **painel** desta worktree numa **porta livre** (comece pela **3015**: `netstat -ano | findstr :3015`; se ocupada, a próxima livre). Mesmo jeito do `ligar-teste.ps1` da raiz do repositório principal: variáveis do `.env.homologacao` carregadas e `pnpm --filter @escritorio/painel exec next dev -p <porta>` rodando nesta worktree. Antes, confira que nenhum e2e nem outro `next dev` desta parte está rodando (memória);
   - avise: **com as migrações da H1 pendentes, a aba Dados abre como hoje, com o aviso "A ficha completa aparece quando a atualização do banco da Parte H for aplicada."**, o Novo cliente também, e o cartão de acessos não aparece na ficha da pessoa (D23). A ficha nova só aparece na homologação depois do "ok" e do `db push`; até lá, o dono vê a ficha pelas capturas (item 2);
   - **trabalhador: NÃO suba nenhum.** O da porta **3001 é o teste do dono**; não o desligue nem o mate. Entregue o desta branch **"pronto para trocar"**, com estas instruções para o dono: (a) só troque **depois** de aplicar as migrações (sem `gerar_demandas_certificado`, a tarefa das 07:00 falha e o pg-boss tenta de novo; o resto funciona); (b) pare o da 3001 e, nesta worktree, rode o trabalhador do mesmo jeito do `ligar-teste.ps1`; (c) o que muda: só a fila `certificados-vencendo` (07:00); o atendimento e o agente são os mesmos (D33). Enquanto o da 3001 roda, nenhuma demanda de certificado é criada (D22);
   - passe o endereço e um roteiro curto (para depois do `db push`):
     1. abra um cliente: o índice mostra o que falta em cada bloco; quem tinha endereço antigo vê tudo em "Logradouro" e completa o resto;
     2. em **Novo cliente**, digite um CNPJ e toque a lupa: razão social, CNAE e endereço chegam sozinhos; o resto vira pendência e a ficha salva assim mesmo;
     3. preencha contrato, honorário, serviços, responsáveis e uma inscrição ST e toque **Salvar** uma vez: tudo grava junto;
     4. ponha o vencimento do certificado para daqui a 20 dias: a etiqueta "Certificado vence em…" aparece no topo; com o trabalhador trocado, a demanda do Fiscal aparece no dia seguinte às 7h;
     5. em Configurações › Usuários, abra uma pessoa e ligue **Ver acessos de portais**; na ficha do cliente, cadastre um acesso, revele e copie: cada um fica na auditoria.
5. **Pendências para listar no fim:**
   - as decisões D1 a D33 que o dono ainda não confirmou (destaque **D1** — cifra no painel com a chave fora do banco, e o cuidado de guardar a chave; **D3** — permissão à parte dos níveis; **D9** — `*` não travam o salvar; **D11** — `endereco` vira o endereço por extenso; **D21** — regra da demanda do certificado e do prazo; **D23** — volta para a aba de hoje enquanto a migração não é aplicada);
   - o que ficou diferente da imagem (item 2);
   - aplicar na homologação as migrações da F, G1, G2, G3 e H1 (item 3), depois do "ok", e configurar `ACESSOS_PORTAIS_CHAVE` no painel da homologação (e depois na produção);
   - trocar o trabalhador da 3001 pelo desta branch depois das migrações (item 4);
   - numa parte futura, depois de tudo aplicado: tirar `secao-dados-antiga.tsx`, `novo/form-antigo.tsx` e as ações antigas `salvarCliente`/`salvarServicos`/`salvarResponsaveis` (D23);
   - próxima: **H2** (aba Contatos com acesso por pessoa e o filtro nas ferramentas do agente, com os cenários com Claude de verdade da 7D.3).
6. **Não juntar** a branch em nada. **Parar** ao fim da H1 e esperar o dono ver.
