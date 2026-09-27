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
- `clientes`: razão social, fantasia, CNPJ, IE, regime, endereço, UF, ativo, `modo_notas` (`desligado` | `supervisionado` | `automatico`), `agente_pausado` (botão de pausa imediata), padrões de NF-e (frete, transportadora, forma e prazo de pagamento, informações complementares)
- `regras_natureza`: cliente, tipo (`venda` | `devolucao`), destino (`interna` | `interestadual`), indicador da IE do destinatário (contribuinte | isento | não contribuinte), natureza de operação no Bling. Combinação sem regra cadastrada → a nota não sai e vira chamado Fiscal
- `cliente_responsaveis`: cliente + setor → usuário (opcional)
- `servicos` e `cliente_servicos`: catálogo de serviços do escritório (cada um ligado a um setor) e os contratados por cliente
- `contatos`: nome, telefone (formato internacional), ativo
- `contato_clientes`: contato ↔ cliente, com `pode_pedir_nota` e `pode_atualizar_preco`

**Atendimento**
- `conversas`: contato, cliente em foco, estado (`agente` | `humano`), setor, atendente
- `mensagens`: conversa, **cliente** (a empresa a que aquela mensagem se refere, gravada no momento), direção, autor (`cliente` | `agente` | `atendente` | `sistema`), tipo (texto, áudio, imagem, documento), conteúdo, transcrição, arquivo (Supabase Storage), id do provedor (único, para não processar duas vezes), status de envio (`pendente` | `enviada` | `falhou`)
- `chamados`: número sequencial, cliente, conversa, setor, responsável, título, resumo, status (`aberto` | `em_andamento` | `aguardando_cliente` | `concluido`), `fora_do_contrato`, origem
- `chamado_eventos`: histórico (criação, transferência, nota interna, conclusão)

**Cadastros comerciais**
- `compradores_grupos`: cliente, nome, apelidos, status de revisão (`a_revisar` | `aprovado`)
- `compradores_unidades`: cliente, grupo, CNPJ, IE, situação da IE, tipo de contribuinte, razão social, endereço, bairro, cidade, UF, e-mail para NF-e, apelidos/referências, id do contato no Bling, status de revisão
- `produtos`: cliente, código, descrição, apelidos, unidade, id no Bling, ativo
- `precos`: cliente, grupo, produto, valor, vigente desde/até, origem (`importacao` | `whatsapp` | `painel`), quem alterou (contato ou usuário), status (`vigente` | `aguardando_aprovacao_equipe` | `recusado`). O preço vigente é o registro `vigente` sem "vigente até"; os anteriores formam o histórico

**Notas**
- `pedidos_nota`: cliente, conversa, contato solicitante, tipo (`venda` | `devolucao`), unidade, chave da nota referenciada (devolução), número do espelho, versão do espelho, chave de idempotência (única), status (seção 6.7), travas acionadas, id no Bling, número, chave de acesso, totais com impostos calculados pelo Bling, dados de frete/pagamento, PDF, XML, erro
- `pedido_itens`: cliente, produto, quantidade, valor unitário, origem do preço (`tabela` | `nota_referenciada`)
- `espelhos`: cliente, pedido, versão, texto enviado, id da mensagem de envio, enviado em, aprovado em, mensagem que aprovou

**Suporte**
- `integracoes`: tipo (`bling`, `zapi`), cliente, credenciais criptografadas (Supabase Vault), expira em, status. A renovação do token do Bling usa trava exclusiva, porque o token de renovação é trocado a cada uso e duas renovações simultâneas desconectariam o cliente
- `decisoes_agente`: cliente, conversa/pedido, etapa, entrada, saída, justificativa. É o que aparece em "Por que o agente fez isso?"
- `auditoria_acessos`: usuário, ação, entidade, quando (LGPD). Gravada por gatilho no banco ou pelo servidor, nunca pelo navegador
- `configuracoes`: horário de atendimento, feriados, mensagens padrão, limites das travas, tempos de lembrete e expiração, retenção de dados, teto mensal de gasto com IA
- Fila persistente de tarefas no Postgres, com reserva por tempo limitado: uma tarefa interrompida volta para a fila e é retomada do último estado salvo

**Políticas RLS** (todas as tabelas acima e os buckets do Storage têm política explícita; nenhuma fica aberta por padrão)
- Administrador: tudo
- Atendente:
  - Conversas: as que têm chamado aberto ou concluído em um de seus setores, ou das quais é o atendente. Vê o histórico completo da conversa (a equipe interna é de confiança; a restrição é entre setores, não dentro da conversa)
  - `mensagens`, `espelhos`, `pedidos_nota`, `pedido_itens`, `decisoes_agente` e arquivos do Storage (PDF, XML, áudio, anexos): herdam a regra da conversa ou do chamado a que pertencem
  - Clientes e cadastros comerciais: leitura, com edição conforme as permissões extras
  - Configurações, usuários, integrações e auditoria: sem acesso
- Conversas atendidas apenas pelo agente, sem chamado, ficam visíveis somente ao administrador
- Toda tabela com dado de cliente tem `cliente_id` próprio (não herdado da conversa), para que o futuro perfil Cliente filtre por empresa mesmo quando um contato fala por duas empresas

## 5. Painel

**Atendimento** (tela principal)
- Lista de conversas com filtros: minhas, do meu setor, sem responsável, aguardando cliente. Atualização em tempo real
- Conversa completa, incluindo as mensagens do agente, transcrições e anexos
- Ações: Assumir, Responder (texto, arquivo, áudio), Transferir (setor ou pessoa), Nota interna, Concluir
- Ao assumir, a conversa passa ao estado `humano` e o agente silencia. Ao concluir, volta ao estado `agente`
- Painel "Por que o agente fez isso?" com as decisões registradas

**Clientes:** ficha (dados, contatos e permissões, serviços do contrato, responsável por setor, modo de notas), cadastros comerciais (grupos, unidades, apelidos, produtos, preços com histórico, fila de revisão da importação) e notas emitidas.

**Notas:** pedidos em andamento, aguardando liberação da equipe (modo supervisionado, com botão Emitir), exceções (produto novo, rejeição fiscal, denegada, envio do PDF falhou), reajustes aguardando aprovação, notas emitidas com PDF/XML.

**Início:** chamados abertos por setor, sem responsável, notas do dia, alertas. Botão **Pausar agente** (geral ou por cliente), visível só ao administrador: com o agente pausado, nenhuma nota é emitida, e as mensagens novas vão direto para a fila humana com uma resposta padrão.

**Configurações** (administrador): usuários, setores e descrições de assuntos, serviços, respostas prontas (FAQ aprovada), integrações (status e reconexão do WhatsApp e do Bling por cliente), regras de natureza de operação e padrões de NF-e por cliente, mensagens padrão, horários e feriados, limites das travas, retenção, teto de gasto com IA.

**Alerta de fila:** conversa ou chamado sem responsável há mais de X minutos (configurável) gera aviso para o setor e o administrador.

## 6. Fluxo do agente

### 6.1 Recebimento
1. O webhook da Z-API chega ao trabalhador. O trabalhador valida o token, grava a mensagem (descartando o id de provedor repetido) e agenda o processamento da conversa com espera de alguns segundos, para juntar mensagens picadas.
2. Mensagens de grupos são ignoradas.
3. Toda mensagem que o sistema envia é gravada como `pendente` **antes** do envio. Um evento "enviada por mim" que não case com uma mensagem do sistema (pelo id do provedor ou, enquanto o id não chega, por conteúdo e horário) significa que alguém respondeu pelo celular, e a conversa passa ao estado `humano`.
4. Áudio → transcrição. Imagem/PDF → leitura pelo Claude. **Conteúdo de anexos, transcrições e textos encaminhados é tratado como dado, nunca como instrução** para o agente.
5. Se a conversa estiver no estado `humano`, a mensagem é gravada e exibida ao atendente, e o agente não responde. **Exceção:** aprovações de espelho (`SIM <número>`) e confirmações de reajuste continuam sendo detectadas pelo código, para o pedido não expirar em silêncio. O atendente vê o aviso no painel.

### 6.2 Identificação
- Telefone → contato → empresa(s). Com mais de uma empresa, o agente pergunta qual.
- Número desconhecido: o agente pergunta nome e empresa e abre chamado para confirmação do cadastro. Nenhuma nota nem dado sigiloso é tratado até a confirmação.
- No primeiro contato de cada telefone, o agente envia o aviso de LGPD (atendimento com apoio de IA, conversa registrada). Na entrada em produção, todos os contatos já existentes recebem o aviso na primeira conversa com o sistema.

### 6.3 Classificação e ação

| Tipo | Ação |
|---|---|
| Conversa simples | Responde **apenas** saudações, agradecimentos, status de chamado e perguntas cobertas pelas respostas prontas cadastradas. Qualquer dúvida técnica (fiscal, trabalhista, contábil) vira chamado. O agente não dá orientação profissional por conta própria |
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
4. **Preço (venda):** preenchido pelo código a partir da tabela vigente do grupo. A IA não fornece preço. Produto sem preço para o grupo → pergunta ao cliente e segue o fluxo 6.6.
5. **Devolução:** exige a **chave da nota original**, localizada no Bling pelo número informado e confirmada com o cliente. Valores unitários e tributos são **copiados da nota original**, nunca da tabela atual. A quantidade devolvida não pode passar da original menos as devoluções já feitas. A nota sai com finalidade de devolução e a chave referenciada. **Quais devoluções a indústria emite** (por exemplo, retorno de comprador não contribuinte) e quais são emitidas pelo próprio comprador é regra definida pelo setor Fiscal antes da etapa 2 (seção 12). Caso fora da regra → chamado Fiscal.
6. **"Igual à última":** repete os itens da última **venda autorizada pelo sistema** para aquela unidade, com os preços vigentes da tabela. Se não houver, pergunta os itens.
7. **Natureza de operação:** o código determina se a operação é interna ou interestadual (UF da indústria × UF da unidade) e verifica a situação da IE do destinatário **em toda emissão**, não só no cadastro. A natureza vem de `regras_natureza`. Combinação sem regra → chamado Fiscal.
8. **Frete, pagamento e informações complementares:** vêm dos padrões do cliente, e podem ser alterados no pedido se o cliente informar.
9. **Travas** (limites configuráveis): valor total acima de N vezes a média do grupo, ou quantidade acima de N vezes o máximo histórico do produto → confirmação extra e aviso à equipe. **Sem histórico** (grupo ou produto sem notas anteriores), a trava dispara sempre.
10. **Espelho** numerado e versionado, com o total **incluindo impostos** (ver 6.7):
    ```
    Espelho #17 (versão 1) – confira a nota:
    Destinatário: Hortsul Ltda – Itabira/MG (CNPJ ...)
    10 CX Produto X × R$ 45,00 = R$ 450,00
    IPI: R$ 22,50
    Total da nota: R$ 472,50
    Frete: por conta do destinatário · Pagamento: 28 dias
    Responda SIM 17 para emitir, ou diga o que mudar.
    ```
    Correções geram nova versão do mesmo número.
11. **Aprovação:** detectada pelo código, não pela IA. Regras:
    - Vale apenas `SIM <número>` recebido **depois** do envio da versão vigente (comparando horário e ordem das mensagens). Um SIM que chegou antes de uma nova versão não aprova a nova versão
    - Um `SIM` sem número só é aceito se houver exatamente um espelho pendente na conversa
    - Quem aprova precisa ter `pode_pedir_nota` para o **cliente do pedido**, não para o cliente em foco na conversa
    - Depois de aprovado, o pedido **não pode mais ser editado**. Qualquer mudança exige cancelar e começar outro pedido
12. **Sem resposta:** lembrete após 2h. No fim do dia, um espelho **ainda não aprovado** expira, e o cliente é avisado. Pedidos em `aguardando_liberacao` ou `aguardando_equipe` não expiram; ficam visíveis no painel e entram no resumo diário. Nada é emitido sem aprovação.
13. **Cliente desiste** ("cancela esse pedido") antes da emissão → `cancelado_pelo_cliente`.
14. **Vários pedidos em uma mensagem:** um pedido e um espelho para cada.
15. **Após aprovação:**
    - `supervisionado`: vai para `aguardando_liberacao` no painel, e a emissão ocorre quando alguém da equipe clica em Emitir
    - `automatico`: segue direto para a emissão

### 6.5 Comprador novo
1. O agente pede o CNPJ, caso não tenha vindo no pedido.
2. Consulta os dados na BrasilAPI e a IE na API paga.
3. Se a raiz do CNPJ coincidir com um grupo existente, propõe incluir como nova unidade do grupo (mesmos preços) e confirma com o cliente.
4. Envia a ficha em texto, com o que já foi encontrado marcado como ✅ e o que falta como ❓. A indústria repassa ao comprador e devolve a resposta.
5. O agente interpreta a resposta e pergunta de novo só os campos duvidosos.
6. **Não resolve sozinho:** IE inativa/suspensa (avisa e não emite), comprador isento ou não contribuinte sem regra de natureza correspondente (chamado Fiscal, porque muda a tributação), mais de uma IE sem indicação do cliente (pergunta).
7. Cadastra o contato no Bling e no banco (unidade aprovada) e retoma o pedido.

### 6.6 Reajuste de preço
- Só contatos com `pode_atualizar_preco` para aquele cliente.
- O agente só **propõe**. O código gera a pergunta com um código de confirmação: *"Confirma: Produto X para o grupo Hortsul passa de R$ 45,00 para R$ 48,00 a partir de agora? Responda CONFIRMO R12."*
- A confirmação é detectada **pelo código** (`CONFIRMO <código>`, recebido depois da pergunta, pelo mesmo contato), com as mesmas regras da aprovação de espelho. A IA não consegue confirmar um reajuste.
- Variação acima do limite configurado (padrão 20%) → segunda confirmação + aviso à equipe.
- Cliente em `supervisionado`: o novo preço fica `aguardando_aprovacao_equipe` e só vale depois que a equipe aprova no painel. Em `automatico`, vale após a confirmação.
- Grava o novo preço, fecha o anterior e registra quem pediu e quando.

### 6.7 Emissão
**Estados do pedido e transições permitidas** (qualquer outra transição é recusada pelo código e testada):

| De | Para |
|---|---|
| `rascunho` | `aguardando_aprovacao`, `aguardando_equipe`, `cancelado_pelo_cliente` |
| `aguardando_equipe` | `rascunho` (retomado), `cancelado_pelo_cliente` |
| `aguardando_aprovacao` | `aprovado`, `rascunho` (correção, nova versão), `expirado`, `cancelado_pelo_cliente` |
| `aprovado` | `aguardando_liberacao` (supervisionado), `emitindo` (automático) |
| `aguardando_liberacao` | `emitindo` (equipe clicou), `cancelado_pelo_cliente` |
| `emitindo` | `autorizada`, `rejeitada`, `denegada` |
| `rejeitada` | `emitindo` (após correção cadastral da **mesma** nota no Bling), `aguardando_equipe` |
| `autorizada` | `concluida` (PDF entregue), `autorizada_envio_falhou` |
| `autorizada_envio_falhou` | `concluida` (reenvio bem-sucedido) |

`denegada` (IE irregular do destinatário) gera chamado Fiscal imediato: o número da nota fica queimado e a situação precisa de tratamento humano.

**Cálculo dos impostos para o espelho:**
- **Preferencial:** criar a NF-e no Bling como **pendente (sem transmitir)** logo ao montar o espelho, para que o próprio Bling calcule impostos e total. O id do Bling é gravado na mesma transação da resposta. Correções atualizam essa nota pendente; desistência ou expiração a exclui
- Só é possível se a verificação V1 confirmar que criar, alterar e excluir notas pendentes **não consome numeração nem exige inutilização**
- **Alternativa**, se não for possível: o código calcula os impostos pelas mesmas regras do cadastro do Bling, e a nota só é criada após a aprovação. Se o total calculado pelo Bling divergir do espelho aprovado, a nota não é transmitida: é excluída, e um novo espelho é enviado

**Passos da emissão** (tarefa na fila):
1. A chave de idempotência é derivada do pedido e da versão aprovada. Pedidos aprovados não mudam (6.4, item 11).
2. A retomada é sempre pelo **id do Bling gravado no banco**. O código nunca cria uma segunda nota para um pedido que já tem id. Se a criação no Bling tiver resposta incerta (sem id gravado), o código busca no Bling uma nota pendente com o mesmo destinatário, itens e total criada naquele intervalo antes de qualquer nova criação. Se encontrar mais de uma candidata ou nenhuma certeza, o pedido vai para `aguardando_equipe`.
3. Transmite e consulta o status até a autorização.
4. Rejeição por dado cadastral: corrige a **mesma** nota e retransmite, sem criar outra.
5. Baixa o PDF e o XML, guarda no Storage, envia o PDF ao cliente e registra.

### 6.8 Ferramentas do agente
Estas são as únicas ações possíveis do agente. Todas validam no código:
- `identificar_empresa`, `buscar_unidades`, `buscar_produtos`
- `criar_pedido(unidade_id, itens[produto_id, quantidade], tipo, chave_nota_referenciada?)`: preço, natureza, frete e pagamento são preenchidos pelo código
- `corrigir_pedido(pedido_id, alterações)`: só antes da aprovação; gera nova versão
- `cancelar_pedido(pedido_id)`: só antes da emissão
- `enviar_espelho(pedido_id)`: o texto é gerado pelo código a partir do pedido
- `registrar_apelido`
- `consultar_cnpj`, `enviar_ficha_comprador`, `cadastrar_comprador`
- `propor_reajuste`: exige permissão do contato. Não existe ferramenta de confirmação: a confirmação é detectada pelo código (6.6)
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
| Número bloqueado | Alerta imediato por e-mail. Os clientes conhecem esse número, então trocar de número tem custo alto; a mitigação principal é **iniciar a verificação na Meta no primeiro dia** do projeto e migrar assim que possível |
| Trabalhador fora | Reinício pelo Easypanel. Monitor externo envia e-mail |
| Fila parada ou WhatsApp sem eventos | O trabalhador registra um sinal de vida da fila e da conexão da Z-API a cada minuto. O monitor externo verifica esse sinal, e não só se o servidor responde |
| Banco indisponível | Novas tentativas. Mensagens recebidas preservadas (ver item V2 da seção 11) |
| Publicação de nova versão durante uma emissão | O trabalhador encerra com calma: para de pegar tarefas novas e termina a atual. Tarefa interrompida volta à fila e é retomada pelo id do Bling gravado |
| Gasto com IA perto do teto | Alerta ao dono em 80%. Ao atingir o teto, o agente pausa e as mensagens vão para a fila humana |

**Canais de alerta:** painel (faixa para o administrador), WhatsApp pessoal do dono (itens que exigem ação e não dependem do WhatsApp do escritório) e **e-mail** (sempre para falhas de WhatsApp, número bloqueado ou sistema fora, porque o WhatsApp pode ser justamente o que caiu).

**Limite de envio:** mensagens iniciadas pelo sistema (lembretes, alertas) respeitam um limite por minuto, para reduzir o risco de bloqueio na Z-API.

**Resumo diário às 18h** no WhatsApp do dono: notas emitidas, chamados por setor, exceções pendentes, saúde das integrações.

## 9. Segurança e LGPD
- RLS em todas as tabelas. Chave de serviço apenas no trabalhador
- Credenciais de integração criptografadas no Supabase Vault
- Webhook da Z-API autenticado por token
- Aviso de LGPD no primeiro contato, inclusive para os contatos que já existiam antes do sistema
- Retenção configurável:
  - **Registros fiscais** (pedidos, espelhos aprovados, notas, PDF/XML, histórico de preços): 5 anos
  - **Conversas, áudios e demais anexos**: 1 ano
- **Exclusão a pedido do titular:** remove os dados pessoais das conversas e mantém os registros fiscais pelo prazo legal
- **Operadores de dados registrados:** Anthropic (IA), serviço de transcrição, Z-API, Supabase e consulta de CNPJ/IE, incluindo a transferência internacional de dados à IA e à transcrição. Os dados dos compradores (terceiros) são tratados para a execução do contrato de emissão de notas da indústria
- Registro de acessos do painel em `auditoria_acessos`, gravado pelo servidor
- Contatos só pedem nota ou alteram preço se autorizados no cadastro
- **Backup:** o backup diário do Supabase cobre o banco. Os arquivos do Storage (especialmente XML das notas, que precisam ser guardados por 5 anos) são exportados periodicamente para um segundo local

## 10. Testes e implantação

**Testes automáticos** (rodam no GitHub antes de qualquer publicação):
- Regras: seleção de unidade, preço vigente, natureza de operação por UF e IE, travas (inclusive sem histórico), detecção de aprovação e de confirmação de reajuste (ordem das mensagens, versão, permissão por cliente), devolução (valores da nota original, limite de quantidade), idempotência e retomada, todas as transições da máquina de estados, RLS por perfil em todas as tabelas e buckets
- Integração com as implementações falsas de Z-API, Bling, Claude, transcrição e CNPJ/IE, incluindo falhas simuladas (queda depois de criar a nota e antes de gravar o id, webhook "enviada por mim" chegando antes do id, renovação simultânea do token)
- **Cenários de conversa:** conjunto de pedidos realistas ("emite pra hortsul itabira 10 cx do A", áudios transcritos, pedidos ambíguos, SIM antes de uma correção, instruções escondidas em PDFs e fichas, tentativas de burlar preço), verificando as ferramentas chamadas e o resultado. O conjunto cresce com cada erro encontrado em produção

**Ambientes:**
- Homologação: projeto Supabase separado + serviços separados no Easypanel + número de WhatsApp de teste
- Produção: número do escritório

**Emissão real:** se a verificação V1 confirmar que o Bling não oferece ambiente de homologação de NF-e, nenhum teste automático toca a conta real da indústria. Os testes de emissão rodam apenas contra o Bling falso, e a **primeira emissão real** é feita com supervisão ao vivo do dono.

**Implantação gradual:**
1. Equipe testa em homologação, simulando a indústria
2. Etapa 1 em produção para todos os clientes (atendimento e chamados)
3. Importação do Bling e revisão dos cadastros comerciais, das regras de natureza e dos padrões de NF-e da indústria
4. Etapa 2 com a indústria em `supervisionado`: o agente faz tudo e a equipe clica em Emitir
5. Após um período sem erros, o dono muda a indústria para `automatico`

## 11. Verificações obrigatórias no início da implementação
Estes pontos foram assumidos no design e precisam ser confirmados na documentação oficial antes do código correspondente:
- **V1. Bling API v3:** fluxo OAuth por conta e rotação do token de renovação, endpoints de NF-e (criar, alterar, excluir pendente, transmitir, consultar, PDF/XML), **se nota pendente consome numeração**, campo pesquisável para guardar uma referência do pedido, campos de devolução (finalidade e chave referenciada), como as naturezas de operação tratam UF e indicador de IE, leitura de notas para a importação, cadastro de contatos, limites de requisição, **existência de ambiente de homologação**
- **V2. Z-API:** reenvio de webhooks não entregues, eventos de mensagens enviadas pelo celular, identificação de grupos, preço atual
- **V3. Consulta de IE:** escolha do fornecedor com cobertura de todas as UFs e preço por consulta
- **V4. Transcrição de áudio:** escolha do fornecedor (qualidade em português, preço)
- **V5. Supabase:** limites do plano gratuito e preço do Pro
- **V6. Claude:** identificadores e preços atuais dos modelos Haiku e Sonnet

Se alguma verificação contrariar o design, o ponto volta para decisão do dono antes da implementação.

## 12. Levantamentos com o setor Fiscal e a indústria (antes da etapa 2)
Não são decisões técnicas. Precisam ser preenchidos no painel antes de ligar as notas:
- **Regras de devolução:** em quais situações a indústria emite a nota de devolução e em quais o próprio comprador emite
- **Regras de natureza de operação** da indústria: venda interna e interestadual, para contribuinte, isento e não contribuinte, incluindo ST e DIFAL quando aplicável
- **Padrões de NF-e** da indústria: modalidade de frete, transportadora, forma e prazo de pagamento, informações complementares obrigatórias
- **Revisão da importação:** grupos, unidades, apelidos, produtos e preços
