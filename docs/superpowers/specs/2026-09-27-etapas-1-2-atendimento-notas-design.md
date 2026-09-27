# Etapas 1 e 2: Atendimento pelo WhatsApp e Notas da Indústria

**Data:** 2026-09-27
**Status:** aguardando revisão do dono
**Documento de visão:** `2026-09-27-plataforma-visao-design.md` (princípios, arquitetura e mapa de módulos valem aqui)

---

## 1. Objetivo e critérios de sucesso

**Etapa 1: Base + Atendimento.** Todo contato pelo WhatsApp do escritório é atendido: o agente identifica o cliente e a demanda, resolve o que for simples e encaminha o resto ao setor certo. Os atendentes respondem pelo painel, cada um com seu login.

**Etapa 2: Notas da indústria.** A indústria pede notas de venda e devolução pelo WhatsApp, e o agente conduz tudo do pedido ao PDF: identifica comprador e unidade, aplica o preço da tabela, envia o espelho, recebe a aprovação, emite no Bling e devolve a nota.

**Critérios de sucesso:**
- Nenhuma mensagem de cliente fica sem resposta ou sem dono
- O dono deixa de distribuir demandas manualmente
- A maioria dos pedidos de nota da indústria vira nota autorizada sem ninguém da equipe montar nada
- Nenhuma nota emitida com preço, unidade ou produto errado por decisão do agente, e nenhuma nota duplicada
- Cancelamentos por erro de preço ou destinatário caem a praticamente zero

## 2. Fora do escopo destas etapas

- Documentos, Google Drive e cobrança automática (etapa 3)
- NFS-e de qualquer tipo (etapas 4 e 5)
- Cancelamento e carta de correção pelo agente (viram chamado para a equipe)
- Cadastro de produto novo pelo agente (vira chamado, porque exige decisão fiscal)
- Portal do cliente, POPs, obrigações, financeiro, comercial, indicadores (etapas futuras). A estrutura de dados já os comporta
- Grupos de WhatsApp de clientes. O agente atende apenas conversas individuais e ignora grupos

## 3. Componentes

| Componente | Responsabilidade | Depende de |
|---|---|---|
| **Painel web** (Next.js) | Telas, login, configurações | Supabase (Auth, RLS, Realtime) |
| **Trabalhador** (Node) | Webhooks, agente, fila, tarefas agendadas | Supabase (acesso de serviço), integrações |
| **Canal WhatsApp** | Interface única `enviar/receber mensagem`. Implementação atual: Z-API | Z-API (depois Meta) |
| **Agente** | Conversa, classificação, extração, chamada de ferramentas | Claude, Transcrição |
| **Ferramentas do agente** | Únicas ações possíveis do agente, cada uma com validação em código | Módulos abaixo |
| **Atendimento** | Conversas, estado agente/humano, chamados, roteamento por setor | Banco |
| **Notas** | Pedidos, espelhos, travas, máquina de estados de emissão | Emissor, Cadastros comerciais |
| **Emissor NF-e** | Interface `criar/transmitir/consultar nota`. Implementação atual: Bling API v3 | Bling |
| **Consulta cadastral** | Dados de CNPJ (BrasilAPI) e IE (API paga) | Serviços externos |
| **Alertas** | Painel, WhatsApp do dono, e-mail, resumo diário | Canal WhatsApp, e-mail |

Cada integração externa (WhatsApp, Bling, Claude, transcrição, CNPJ/IE) tem uma implementação falsa usada nos testes.

## 4. Modelo de dados

Todas as tabelas com dado de cliente têm `cliente_id` e RLS habilitado. O trabalhador usa a chave de serviço, que ignora o RLS e existe apenas no servidor, nunca no navegador.

**Usuários e setores**
- `usuarios`: id (auth), nome, email, papel (`admin` | `atendente`), ativo, permissões extras (`editar_precos`, `editar_clientes`)
- `setores`: id, nome, descrição dos assuntos (texto livre, usado pelo agente para rotear), ativo. Iniciais: Pessoal, Contábil, Fiscal, Financeiro, Legalização
- `usuario_setores`: usuário ↔ setor

**Clientes do escritório**
- `clientes`: razão social, fantasia, CNPJ, IE, regime, endereço, ativo, `modo_notas` (`desligado` | `supervisionado` | `automatico`), naturezas de operação do Bling para venda e devolução
- `cliente_responsaveis`: cliente + setor → usuário (opcional)
- `servicos` e `cliente_servicos`: catálogo de serviços do escritório (cada um ligado a um setor) e os contratados por cliente
- `contatos`: nome, telefone (formato internacional), ativo
- `contato_clientes`: contato ↔ cliente, com `pode_pedir_nota` e `pode_atualizar_preco`

**Atendimento**
- `conversas`: contato, cliente em foco, estado (`agente` | `humano` | `encerrada`), setor, atendente
- `mensagens`: conversa, direção, autor (`cliente` | `agente` | `atendente` | `sistema`), tipo (texto, áudio, imagem, documento), conteúdo, transcrição, arquivo (Supabase Storage), id do provedor (único, para não processar duas vezes)
- `chamados`: número sequencial, cliente, conversa, setor, responsável, título, resumo, status (`aberto` | `em_andamento` | `aguardando_cliente` | `concluido`), `fora_do_contrato`, origem
- `chamado_eventos`: histórico (criação, transferência, nota interna, conclusão)

**Cadastros comerciais**
- `compradores_grupos`: cliente, nome, apelidos, status de revisão (`a_revisar` | `aprovado`)
- `compradores_unidades`: grupo, CNPJ, IE, situação da IE, tipo de contribuinte, razão social, endereço, bairro, cidade, UF, e-mail para NF-e, apelidos/referências, id do contato no Bling, status de revisão
- `produtos`: cliente, código, descrição, apelidos, unidade, id no Bling, ativo
- `precos`: cliente, grupo, produto, valor, vigente desde/até, origem (`importacao` | `whatsapp` | `painel`), quem alterou (contato ou usuário). O preço vigente é o registro sem "vigente até"; os anteriores formam o histórico
- `fornecedores`: estrutura criada, sem uso nestas etapas

**Notas**
- `pedidos_nota`: cliente, conversa, contato solicitante, tipo (`venda` | `devolucao`), unidade, nota referenciada (devolução), número do espelho, versão do espelho, chave de idempotência (única), status, travas acionadas, id no Bling, número, chave de acesso, PDF, XML, erro
- `pedido_itens`: produto, quantidade, valor unitário, origem do preço
- `espelhos`: pedido, versão, texto enviado, enviado em, aprovado em, mensagem que aprovou

**Suporte**
- `integracoes`: tipo (`bling`, `zapi`), cliente, credenciais criptografadas (Supabase Vault), expira em, status
- `decisoes_agente`: conversa/pedido, etapa, entrada, saída, justificativa. É o que aparece em "Por que o agente fez isso?"
- `auditoria_acessos`: usuário, ação, entidade, quando (LGPD)
- `configuracoes`: horário de atendimento, feriados (nacionais e municipais), mensagens padrão, limites das travas, tempos de lembrete e expiração, retenção de dados
- Fila persistente de tarefas no Postgres

**Políticas RLS**
- Administrador: tudo
- Atendente: conversas e chamados cujo setor está entre os seus, ou dos quais é responsável. Clientes e cadastros comerciais só leitura, com edição conforme as permissões extras. Configurações, usuários e integrações: sem acesso
- `auditoria_acessos`: somente inserção pelos usuários, leitura pelo administrador

## 5. Painel

**Atendimento** (tela principal)
- Lista de conversas com filtros: minhas, do meu setor, sem responsável, aguardando cliente. Atualização em tempo real
- Conversa completa, incluindo as mensagens do agente, transcrições e anexos
- Ações: Assumir, Responder (texto, arquivo, áudio), Transferir (setor ou pessoa), Nota interna, Concluir
- Ao assumir, a conversa passa ao estado `humano` e o agente silencia. Ao concluir, volta ao estado `agente`
- Painel "Por que o agente fez isso?" com as decisões registradas

**Clientes:** ficha (dados, contatos e permissões, serviços do contrato, responsável por setor, modo de notas), cadastros comerciais (grupos, unidades, apelidos, produtos, preços com histórico, fila de revisão da importação) e notas emitidas.

**Notas:** pedidos em andamento, aguardando liberação da equipe (modo supervisionado), exceções (produto novo, rejeição fiscal), notas emitidas com PDF/XML.

**Início:** chamados abertos por setor, sem responsável, notas do dia, alertas.

**Configurações** (administrador): usuários, setores e descrições de assuntos, serviços, integrações (status e reconexão do WhatsApp e do Bling por cliente), mensagens padrão, horários e feriados, limites das travas, retenção.

**Alerta de fila:** conversa ou chamado sem responsável há mais de X minutos (configurável) gera aviso para o setor e o administrador.

## 6. Fluxo do agente

### 6.1 Recebimento
1. O webhook da Z-API chega ao trabalhador. O trabalhador valida o token, grava a mensagem (descartando o id de provedor repetido) e agenda o processamento da conversa com espera de alguns segundos, para juntar mensagens picadas.
2. Mensagens de grupos são ignoradas.
3. Mensagens enviadas pelo celular do escritório (eventos "enviada por mim" que não partiram do sistema) colocam a conversa no estado `humano`.
4. Áudio → transcrição. Imagem/PDF → leitura pelo Claude.
5. Se a conversa estiver no estado `humano`, a mensagem só é gravada e exibida ao atendente.

### 6.2 Identificação
- Telefone → contato → empresa(s). Com mais de uma empresa, o agente pergunta qual.
- Número desconhecido: o agente pergunta nome e empresa e abre chamado para confirmação do cadastro. Nenhuma nota nem dado sigiloso é tratado até a confirmação.
- No primeiro contato de cada telefone, o agente envia o aviso de LGPD (atendimento com apoio de IA, conversa registrada).

### 6.3 Classificação e ação

| Tipo | Ação |
|---|---|
| Conversa simples | Responde |
| Nota fiscal | Fluxo 6.4 (se o cliente tiver `modo_notas` diferente de `desligado` e o contato puder pedir nota; senão, chamado no setor Fiscal) |
| Reajuste de preço | Fluxo 6.6 |
| Demanda para pessoa | Escolhe o setor pelas descrições de assunto, abre chamado (responsável do cliente naquele setor, se houver, senão fila do setor) e avisa o cliente |
| Fora do contrato | Mesmo caminho, com `fora_do_contrato = true` |
| Documento enviado | Chamado no setor correspondente, com o arquivo anexado (a automação completa vem na etapa 3) |
| Não entendido após 2 tentativas | Chamado para o administrador |

Fora do horário, notas seguem normalmente. Para demandas de pessoa, o agente informa o horário de retorno, e o chamado fica na fila.

### 6.4 Pedido de nota
1. **Comprador:** encontra o grupo pelos nomes e apelidos. Com várias unidades, pergunta qual e usa as referências da resposta (cidade, bairro, endereço, final do CNPJ, apelidos). Continua perguntando até haver uma única unidade compatível. Uma referência nova confirmada é salva como apelido da unidade.
2. **Comprador inexistente:** fluxo 6.5.
3. **Itens:** associa cada item a um produto do catálogo (descrição, código, apelidos). Item ambíguo → pergunta. Produto inexistente → chamado Fiscal ("cadastrar produto"), cliente avisado, e o pedido fica em `aguardando_equipe`, retomado quando o produto for cadastrado.
4. **Preço:** preenchido pelo código a partir da tabela vigente do grupo. A IA não fornece preço. Produto sem preço para o grupo → pergunta ao cliente e segue o fluxo 6.6.
5. **Tipo:** venda ou devolução. Na devolução, o agente localiza a nota original no Bling (pelo número informado ou pela última nota do comprador contendo os itens) e confirma com o cliente.
6. **"Igual à última":** repete os itens da última nota emitida para aquela unidade, com os preços vigentes da tabela.
7. **Travas** (limites configuráveis): valor total acima de N vezes a média do grupo, ou quantidade acima de N vezes o máximo histórico do produto → confirmação extra e aviso à equipe.
8. **Espelho** numerado e versionado:
   ```
   Espelho #17 – confira a nota:
   Destinatário: Hortsul Ltda – Itabira/MG (CNPJ ...)
   10 CX Produto X × R$ 45,00 = R$ 450,00
   Total: R$ 450,00
   Responda SIM 17 para emitir, ou diga o que mudar.
   ```
   Correções geram nova versão do mesmo número.
9. **Aprovação:** detectada pelo código, não pela IA. Vale `SIM <número>` referente à versão mais recente. Um `SIM` sem número só é aceito se houver exatamente um espelho pendente naquela conversa.
10. **Sem resposta:** lembrete após 2h. No fim do dia, o rascunho expira e o cliente é avisado. Nada é emitido sem aprovação.
11. **Vários pedidos em uma mensagem:** um pedido e um espelho para cada.
12. **Após aprovação:**
    - `supervisionado`: vai para "aguardando liberação" no painel, e a emissão ocorre quando alguém da equipe clica em Emitir
    - `automatico`: segue direto para a emissão

### 6.5 Comprador novo
1. O agente pede o CNPJ, caso não tenha vindo no pedido.
2. Consulta os dados na BrasilAPI e a IE na API paga.
3. Se a raiz do CNPJ coincidir com um grupo existente, propõe incluir como nova unidade do grupo (mesmos preços) e confirma com o cliente.
4. Envia a ficha em texto, com o que já foi encontrado marcado como ✅ e o que falta como ❓. A indústria repassa ao comprador e devolve a resposta.
5. O agente interpreta a resposta e pergunta de novo só os campos duvidosos.
6. **Não resolve sozinho:** IE inativa/suspensa (avisa e não emite), comprador isento ou não contribuinte (chamado Fiscal, porque muda a tributação), mais de uma IE sem indicação do cliente (pergunta).
7. Cadastra o contato no Bling e no banco (unidade aprovada) e retoma o pedido.

### 6.6 Reajuste de preço
- Só contatos com `pode_atualizar_preco`.
- O agente confirma: *"Confirma: Produto X para o grupo Hortsul passa de R$ 45,00 para R$ 48,00 a partir de agora?"*
- Variação acima do limite configurado (padrão 20%) → segunda confirmação + aviso à equipe.
- Grava o novo preço vigente, fecha o anterior e registra quem pediu e quando.

### 6.7 Emissão (tarefa na fila)
Estados do pedido:

`rascunho → aguardando_aprovacao → aprovado → [aguardando_liberacao] → emitindo → autorizada`

com os desvios `rejeitada`, `aguardando_equipe` e `expirado`.

1. A chave de idempotência é derivada do pedido e da versão aprovada.
2. Antes de criar a nota no Bling, verifica se já existe uma nota com aquela chave (registrada no Bling ou no banco). Se existir, retoma em vez de criar.
3. Cria a NF-e com o contato, os itens e os valores do pedido e a natureza de operação configurada para o cliente e o tipo.
4. Transmite e consulta o status até a autorização.
5. Baixa o PDF e o XML, guarda no Storage, envia o PDF ao cliente e registra.

### 6.8 Ferramentas do agente
Estas são as únicas ações possíveis do agente. Todas validam no código:
- `identificar_empresa`, `buscar_unidades`, `buscar_produtos`
- `criar_pedido(unidade_id, itens[produto_id, quantidade], tipo, nota_referenciada?)`: o preço é preenchido pelo código
- `enviar_espelho(pedido_id)`: o texto é gerado pelo código a partir do pedido
- `registrar_apelido`
- `consultar_cnpj`, `enviar_ficha_comprador`, `cadastrar_comprador`
- `propor_reajuste`, `confirmar_reajuste`: exigem permissão do contato e confirmação explícita
- `abrir_chamado(setor_id, resumo, fora_do_contrato)`
- `responder(texto)`

Toda chamada de ferramenta e sua justificativa ficam registradas em `decisoes_agente`.

**Modelos:** Haiku para classificação e extração, Sonnet para a condução da conversa. A troca de modelo é configuração.

## 7. Importação inicial do Bling
1. Após o cliente autorizar o Bling, uma tarefa lê as NF-e dos últimos 12 meses.
2. Agrupa os destinatários pela raiz do CNPJ (grupos e unidades), extrai os produtos e o último preço praticado por grupo e produto.
3. Grava tudo como `a_revisar`.
4. O administrador revisa no painel: renomeia grupos, junta ou separa unidades, adiciona apelidos, corrige preços e aprova.
5. Somente dados aprovados são usados pelo agente.

## 8. Erros e falhas

| Falha | Comportamento |
|---|---|
| Bling indisponível | Novas tentativas com intervalo crescente. Cliente avisado da demora. Após ~30 min → chamado + alerta |
| Credencial do Bling expirada | Pedidos do cliente em espera. Alerta ao dono com link de reconexão. Retomada automática |
| Resposta incerta do Bling | Consulta antes de qualquer reenvio (seção 6.7, item 2) |
| Rejeição por dado cadastral | Reconsulta o CNPJ/IE, corrige ou pergunta ao cliente, tenta de novo |
| Rejeição fiscal | Chamado Fiscal com o erro traduzido. Cliente avisado |
| SEFAZ indisponível | Aguarda e tenta de novo. Avisa o cliente e o dono se demorar |
| Claude indisponível | Tenta de novo. Se persistir, resposta padrão ao cliente e conversa para a fila humana |
| WhatsApp desconectado | Alerta por e-mail e painel. Envios ficam na fila |
| Número bloqueado | Alerta imediato. Plano: reconectar outro número ou antecipar a Meta |
| Trabalhador fora | Reinício pelo Easypanel. Monitor externo envia e-mail |
| Banco indisponível | Novas tentativas. Mensagens recebidas preservadas (ver item V2 da seção 11) |

**Canais de alerta:** painel (faixa para o administrador), WhatsApp pessoal do dono (itens que exigem ação), e-mail (quando o WhatsApp ou o sistema estiverem fora).

**Resumo diário às 18h** no WhatsApp do dono: notas emitidas, chamados por setor, exceções pendentes, saúde das integrações.

## 9. Segurança e LGPD
- RLS em todas as tabelas. Chave de serviço apenas no trabalhador
- Credenciais de integração criptografadas no Supabase Vault
- Webhook da Z-API autenticado por token
- Aviso de LGPD no primeiro contato
- Retenção configurável de conversas, áudios e arquivos (padrão: 5 anos)
- Registro de acessos do painel em `auditoria_acessos`
- Contatos só pedem nota ou alteram preço se autorizados no cadastro

## 10. Testes e implantação

**Testes automáticos** (rodam no GitHub antes de qualquer publicação):
- Regras: seleção de unidade, preço vigente, travas, detecção de aprovação, idempotência, máquina de estados da emissão, RLS por perfil
- Integração com as implementações falsas de Z-API, Bling, Claude, transcrição e CNPJ/IE
- **Cenários de conversa:** conjunto de pedidos realistas ("emite pra hortsul itabira 10 cx do A", áudios transcritos, pedidos ambíguos, tentativas de burlar preço), verificando as ferramentas chamadas e o resultado. O conjunto cresce com cada erro encontrado em produção

**Ambientes:**
- Homologação: projeto Supabase separado + serviços separados no Easypanel + número de WhatsApp de teste
- Produção: número do escritório

**Implantação gradual:**
1. Equipe testa em homologação, simulando a indústria
2. Etapa 1 em produção para todos os clientes (atendimento e chamados)
3. Etapa 2 com a indústria em `supervisionado`: o agente faz tudo e a equipe clica em Emitir
4. Após um período sem erros, o dono muda a indústria para `automatico`

## 11. Verificações obrigatórias no início da implementação
Estes pontos foram assumidos no design e precisam ser confirmados na documentação oficial antes do código correspondente:
- **V1. Bling API v3:** fluxo OAuth por conta, endpoints de NF-e (criar, transmitir, consultar, PDF/XML), leitura de notas para a importação, cadastro de contatos, limites de requisição, existência de ambiente de homologação
- **V2. Z-API:** reenvio de webhooks não entregues, eventos de mensagens enviadas pelo celular, identificação de grupos, preço atual
- **V3. Consulta de IE:** escolha do fornecedor com cobertura de todas as UFs e preço por consulta
- **V4. Transcrição de áudio:** escolha do fornecedor (qualidade em português, preço)
- **V5. Supabase:** limites do plano gratuito e preço do Pro
- **V6. Claude:** identificadores e preços atuais dos modelos Haiku e Sonnet

Se alguma verificação contrariar o design, o ponto volta para decisão do dono antes da implementação.
