# Área 3: Webhook Z-API, integridade das mensagens, ecos, envio e trava de ambiente

Commit auditado: `8242a24`. Leitura estática. Também rodei os testes puros `test/producao/trava.test.ts` e `test/canal/zapi.test.ts`: 24 de 24 passaram. Não usei banco, Z-API nem rede.

## Resumo
- O webhook só confere o segredo que vai na URL. A comparação é em tempo constante, sobre o SHA-256 dos dois valores, e o segredo sai mascarado no log normal. Não há segunda conferência: `instanceId`, `fromApi` e cabeçalhos são ignorados. Também não há limite de requisições. Quem tiver o segredo forja qualquer evento: mensagem "de um cliente", mensagem "de alguém da equipe" (que cai no assistente interno) e "enviada por mim" (silencia o agente naquela conversa). Também consegue fazer o trabalhador baixar qualquer URL (SSRF).
- O segredo **vai inteiro para o log** quando a requisição cai no 404 do Fastify: barra no fim, caminho a mais, GET, ou segredo com mais de 100 caracteres.
- A deduplicação da entrada é atômica: `UNIQUE(id_provedor)` com `ON CONFLICT DO NOTHING`. A criação da conversa trata a corrida com `UNIQUE(telefone)` e repete a leitura no erro 23505. Aprovado.
- O ponto mais frágil é o resultado desconhecido do envio. Quando a Z-API demora a responder ou dá erro depois de já ter mandado, `enviarDoSistema` e `enviarDocumentoDoSistema` marcam a mensagem como `falhou`. O eco que chega depois não casa e **a conversa vira "humano" pela mensagem do próprio agente**. O cliente ainda recebe o texto de "IA indisponível". A resposta do painel pode sair duas vezes (timeout, queda do processo, documento).
- A trava de ambiente está sólida no trabalhador: `AMBIENTE` é obrigatório, todo envio passa por `canalComTrava` (inclusive documentos) e o painel não envia nada sozinho. No painel, `AMBIENTE` é só o rótulo da faixa no topo.
- Telefone: um contato pode ser cadastrado duas vezes, com e sem o 9 (o cadastro só confere o número exato). `buscarContato` então escolhe um dos dois sem critério. Número reatribuído pela operadora herda o contato, e a empresa em foco antiga continua marcando as mensagens novas.

## Achados

### 3.1 Webhook protegido só pelo segredo na URL: quem o tiver forja cliente, equipe e "enviada por mim"   [Alta] [Confirmado]
- Onde: `apps/trabalhador/src/servidor.ts:52-91`; `canal/zapi.ts:4-18, 55-74`; `envio.ts:127-147`; `processar-conversa.ts:186-208`.
- Evidência: depois de `segredoConfere` (`servidor.ts:53`), o corpo é aceito como verdade. O esquema `Corpo` não lê `instanceId`, `connectedPhone` nem `fromApi`, que aparecem nas capturas reais (`test/fixtures/zapi/reais/*.json`). Não há rate limit: nenhum `@fastify/rate-limit` no projeto, e o 401 não registra a tentativa. `phone` e `fromMe` vêm do corpo e decidem tudo.
- Pré-condições: o segredo vazou. Caminhos possíveis: log de 404 (3.4), painel da Z-API, proxy do Easypanel, `webhook-zapi.txt` e área de transferência na homologação.
- Como acontece:
  1. Com `fromMe:true` e `phone` de um cliente, o eco não casa com nada (`envio.ts:143-145`). O sistema grava uma linha `autor='atendente'` com **texto escolhido pelo atacante** e chama `assumirPeloCelular`. A conversa passa a `humano` e o Thiago fica calado para aquele cliente. Repetir para todos os telefones silencia o atendimento inteiro. Com qualquer outro número de 12 ou 13 dígitos começando por 55, cria conversa nova (`obterOuCriarConversa`).
  2. Com `fromMe:false` e `phone` de um contato cadastrado, o agente age em nome do contato: abre demanda, pede nota (o "sim" da confirmação também é forjável), altera preço onde for permitido. A resposta vai ao telefone verdadeiro, então o atacante não lê nada, mas a ação acontece.
  3. Com `phone` de alguém da equipe que tem "Assistente: Site e WhatsApp", a mensagem vira pergunta ao assistente interno com os níveis dessa pessoa (`processar-conversa.ts:186-203`).
  4. Volume sem limite: cada POST faz de 3 a 4 consultas e cria conversa e job. Isso gera gasto de IA até o teto mensal e crescimento de `conversas` e `mensagens`.
- Impacto: ações indevidas em nome de clientes e da equipe, silenciamento do atendimento, histórico falso com "fala do escritório" e custo.
- Correção proposta:
  1. Em `servidor.ts`, recusar o corpo cujo `instanceId` seja diferente de `ZAPI_INSTANCIA`. É barato, embora o valor não seja secreto.
  2. Usar `fromApi` no eco. `fromMe && fromApi` só pode ser do sistema, porque só ele usa a API da instância. Nunca marcar "humano" por evento com `fromApi:true`.
  3. Pôr `@fastify/rate-limit` na rota do webhook (por IP e global) e registrar os 401 com IP e contagem.
  4. Antes de `assumirPeloCelular`, opcionalmente confirmar pela API da Z-API que a mensagem existe (GET por `messageId`, se a API oferecer; não verificável aqui).
  5. Planejar a troca do segredo (dois segredos válidos durante a troca).
- Teste de regressão:
  - POST com `instanceId` diferente devolve 200 ou 403 e não grava nada em `mensagens` nem em `conversas`.
  - `fromMe:true, fromApi:true` sem linha correspondente nunca muda `conversas.estado`.
  - 200 POSTs por minuto do mesmo IP recebem 429 a partir do limite.

### 3.2 Resultado desconhecido no envio do agente: a mensagem fica "falhou" e o eco vira "humano"   [Média] [Provável]
- Onde: `envio.ts:40-47` (enviarDoSistema), `envio.ts:67-75` (enviarDocumentoDoSistema), `envio.ts:134-146`; `repos.ts:408-424`; `processar-conversa.ts:294-302`.
- Evidência: em qualquer erro, inclusive o timeout de 30 s ou 120 s de `canal/zapi.ts:41`, o `catch` faz `marcarFalha(id)`. `saidaPendenteComConteudo` e `temSaidaPendenteRecente` só procuram `status_envio='pendente'`. Sem casar, o eco faz `inserirSaidaExterna` seguido de `assumirPeloCelular`.
- Pré-condições: a Z-API aceita e entrega, mas não responde no prazo, cai a conexão ou devolve 5xx. Ou então `marcarEnviada` falha depois do envio (timeout do banco).
- Como acontece (documento):
  1. `criarSaidaPendente`.
  2. O upload em Base64 demora mais de 120 s. A Z-API entrega, mas o `fetch` aborta.
  3. O eco chega e é verificado aos 5 s. A linha ainda está pendente, então `aguardar` (até 6 × 30 s).
  4. Aos 120 s, `marcarFalha` deixa a linha `falhou` e sem id.
  5. Na verificação seguinte a linha não está mais pendente: a mensagem é registrada como "atendente" e a conversa vira `humano` com o marco "assumida".
  6. Em paralelo, a ferramenta lança o erro e `processar-conversa.ts:300` manda `ia_indisponivel` ao cliente e abre chamado na Triagem.
- Para texto, o mesmo acontece se o eco chegar depois do timeout. Se chegar antes, o eco grava `enviada` e logo depois o `catch` sobrescreve com `falhou`.
- Impacto: o cliente recebe o documento e também "IA indisponível". O painel mostra como falha algo que foi entregue, o que leva a equipe a reenviar. A conversa fica "assumida" sem que ninguém tenha assumido. É detectável, porque a Triagem recebe o chamado.
- Correção proposta:
  - Distinguir "falha certa" (4xx antes do envio, erro de rede antes da conexão) de "resultado desconhecido" (timeout, 5xx, `marcarEnviada` falhou). No desconhecido, deixar `pendente` com uma marca `desconhecido_em` e não marcar `falhou`.
  - No eco, casar também com linhas `falhou` ou `desconhecido` sem `id_provedor` da mesma conversa nos últimos 10 min.
  - Preferir `fromApi` (3.1).
- Teste de regressão: com `CanalFalso`, que entrega e depois lança `TimeoutError`, rodar `verificarEnviadaPorMim` depois do `catch`. Afirmar: `conversas.estado='agente'`, nenhuma linha `autor='atendente'` e a saída `enviada` com o id do eco.

### 3.3 Resposta do painel pode chegar duas vezes ao cliente   [Média] [Confirmado]
- Onde: `envio.ts:81-110`; `fila.ts:86` (`retryLimit: 5`); `tarefas.ts:18-20`; `repos.ts:366-372, 382-390, 584-590`.
- Evidência: no `catch`, `liberarEnvio(m.id)` e `throw`, e a próxima tentativa (10 s, 20 s, 40 s...) reenvia. A Z-API não tem chave de idempotência. Se o processo cair depois do envio e antes de `marcarEnviada`, a reserva vence em 5 min e o batimento reenfileira.
- Como acontece:
  - Texto: a Z-API entrega e o retorno estoura os 30 s. O eco só protege quando a linha foi criada há menos de 2 min (`saidaPendenteComConteudo`). Se a primeira tentativa já começou depois disso (fila atrasada, tentativa 4 ou 5), o texto sai de novo.
  - Arquivo: não tem texto, então o eco não protege nunca. Timeout de 120 s seguido de nova tentativa significa documento repetido.
  - `separarTextoEnviado`: se o `insert` passa e o `update conteudo=null` falha, a próxima tentativa repete o texto (M10 da revisão anterior).
  - Na última tentativa a linha vira `falhou` mesmo quando a Z-API entregou. A pessoa vê "falhou" e reenvia na mão.
- Impacto: mensagem ou documento repetido para o cliente. Não vaza para outra pessoa, porque o destino é sempre `conversa.telefone`.
- Correção proposta: guardar `tentativa_enviada_em` antes de chamar a Z-API. Na nova tentativa, se o campo existe e não há `id_provedor`, não reenviar às cegas: esperar o eco por N minutos e casar pelo `fromApi` e pelo tipo, ou marcar `desconhecido` para a equipe decidir. Fazer `separarTextoEnviado` numa RPC transacional.
- Teste de regressão: `CanalFalso` entrega o arquivo e lança timeout. Chamar `enviarMensagemDoPainel` duas vezes (`ultimaTentativa=false`, depois `true`). Afirmar `canal.enviados.length === 1`.

### 3.4 Segredo do webhook (e token do /saude) vai em claro para o log no 404   [Média] [Confirmado]
- Onde: `servidor.ts:44-49` (o serializer só cobre `req`); Fastify 5.12.5 `lib/log-controller.js` `routeNotFound` faz `request.log.info(\`Route ${method}:${url} not found\`)` com a URL crua; `four-oh-four.js:56` devolve a URL no corpo.
- Pré-condições: uma requisição com o segredo que não case com a rota `POST /webhook/zapi/:segredo`. Exemplos: `/webhook/zapi/<segredo>/` (`ignoreTrailingSlash` é false por padrão), `/webhook/zapi/<segredo>/received`, um GET aberto no navegador. Também um `WEBHOOK_SEGREDO` com mais de 100 caracteres: `maxParamLength` padrão 100 e `config.ts:12` só exige no mínimo 16, então **todo** webhook dá 404 e é logado com o segredo.
- Impacto: o segredo fica no log do contêiner (Easypanel) e em quem coleta esses logs, o que abre o caminho do 3.1.
- Extra de higiene: `servidor.ts:68` registra o número estrangeiro bruto em `warn`, um dado pessoal no log.
- Correção proposta: `setNotFoundHandler` próprio que loga só `method` e a URL mascarada; ou `disableRequestLogging` com um log próprio mascarado. `WEBHOOK_SEGREDO: z.string().min(32).max(100)`. Mascarar o número no warn.
- Teste de regressão: com logger em memória, `inject` de `POST /webhook/zapi/<segredo>/` e de `GET /webhook/zapi/<segredo>`. Afirmar que nenhuma linha de log contém o segredo.

### 3.5 Download de mídia sem filtro de endereço (SSRF com o segredo)   [Média] [Confirmado]
- Onde: `servidor.ts:86` grava `m.midia.url` do corpo; `processar-conversa.ts:78` e `midia/armazenamento.ts:55` fazem `fetch(url)` sem lista de domínios, seguindo redirecionamentos.
- Como acontece: um webhook forjado com `document.documentUrl` apontando para um endereço interno (rede do Easypanel, metadados, `localhost:3001`) e `phone` do próprio atacante. O trabalhador baixa e guarda no bucket `anexos`. Se a resposta tiver tipo PDF ou imagem, ela vai ao modelo, e o agente pode descrever o conteúdo ao telefone do atacante.
- Correção proposta: aceitar só `https:` de domínios da Z-API e do WhatsApp (lista fixa), com `redirect: 'error'` ou revalidação a cada salto. Recusar IPs privados.
- Teste de regressão: `baixarESalvar('http://127.0.0.1/...')` e uma URL com redirecionamento para um IP privado lançam erro sem chamar `fetch`, ou sem seguir o salto.

### 3.6 Resposta humana pelo celular pode não ser detectada, sem alerta   [Média] [Provável]
- Onde: `servidor.ts:57-60`; `fila.ts:88-90` (`retryLimit: 2`); `envio.ts:134-140`.
- Como acontece:
  - (a) `fila.enviar` falha (banco instável). O webhook devolve 500, e se a Z-API não reentregar (não verificável), o eco se perde.
  - (b) O job `verificar-enviada-por-mim` falha 3 vezes e é descartado sem alerta.
  - (c) A equipe digita no celular exatamente o texto de uma saída ainda pendente da conversa (criada há menos de 2 min). O sistema trata como dele, e a conversa não vira `humano`.
  - Em todos os casos o agente continua respondendo enquanto a pessoa conversa.
- Correção proposta: no esgotamento do job, registrar alerta e, por segurança, marcar a conversa como `humano`. Na dúvida, falhar para o lado de calar o agente.
- Teste de regressão: um repo que lança erro em `mensagemPorIdProvedor` três vezes. Afirmar que um alerta foi registrado e que a conversa ficou `humano`.

### 3.7 Corpo fora do esquema é descartado em silêncio; campos de tipo de evento ignorados   [Média] [Confirmado (descarte) / Hipótese (casos reais)]
- Onde: `canal/zapi.ts:55-58` (`safeParse` falhou devolve `null`); `servidor.ts:55` (200 sem log).
- Evidência e casos:
  - Se a Z-API mudar `phone` para `null` ou número, ou omitir `messageId`, a mensagem some sem rastro.
  - `messageId: ""` é aceito (`z.string()`). Duas mensagens sem id colidem e a segunda vira "duplicada": perda.
  - Ignorados: `isEdit` (mensagem editada pode virar nova mensagem ou se perder), `broadcast`, `isStatusReply` e `isNewsletter` (status e canais podem chegar como mensagem; hipótese), `waitingMessage` (mensagem ainda não decifrada vira "[tipo não suportado]").
- Correção proposta: logar (sem conteúdo) e contar os descartes por motivo; alertar se o descarte passar de X por hora. `messageId: z.string().min(1).max(128)`. Tratar explicitamente `isEdit`, `broadcast`, `isNewsletter` e `waitingMessage`.
- Teste de regressão: um corpo com `phone:null` gera um registro de descarte. `messageId:""` não grava nada.

### 3.8 Contato duplicado pelo nono dígito: a identidade é escolhida sem critério   [Média] [Provável]
- Onde: `supabase/migrations/20261003000100_painel_v2_contato_volta.sql:17-20` (só `telefone = p_telefone`); `20260927000100_base.sql:74` (`unique` exato); `apps/painel/src/app/(painel)/clientes/esquemas.ts:19-23` (normaliza, mas guarda 12 ou 13 dígitos como foram digitados); `repos.ts:226-229` (`.in(variantes).eq('ativo',true).limit(1).maybeSingle()` sem `order`); `repos.ts:252-258` (troca `contato_id` da conversa a cada mensagem).
- Como acontece: alguém cadastra "(31) 8888-7777" para a empresa A e outro cadastra "(31) 98888-7777" para a empresa B. São dois contatos ativos e a mesma linha de WhatsApp. Cada mensagem pode resolver um contato diferente e trocar `conversas.contato_id`, e com ele as empresas, os níveis e os documentos visíveis.
- Impacto: o acesso fica não determinístico. Se o número de 12 dígitos foi digitado por engano para outra pessoa, essa pessoa ganha os acessos do outro cadastro.
- Correção proposta: no `cadastrar_contato` e na edição, travar e procurar pelas variantes (`interno.variantes_telefone`). Ou guardar sempre a forma de 13 dígitos dos celulares e criar índice único numa coluna canônica.
- Teste de regressão (pgTAP): cadastrar `553188887777` e depois `5531988887777` falha com "telefone já cadastrado".

### 3.9 Número reatribuído ou contato desvinculado: a empresa em foco antiga continua marcando as mensagens   [Média] [Provável]
- Onde: `servidor.ts:79-82` (`clienteId: conversa.cliente_em_foco`); `agente/contexto.ts:38-42` (só atualiza quando acha empresa válida; nunca limpa).
- Como acontece: um contato é arquivado ou desvinculado de A, ou o número dele passa para outra pessoa. As mensagens novas desse telefone continuam gravadas com `cliente_id = A` e aparecem no histórico e nas visões de A. O agente não usa A, porque o contexto valida, mas os dados ficam classificados errado. Em geral, a identidade é só o telefone: o novo dono do número herda o contato enquanto ele estiver ativo.
- Correção proposta: em `carregarContexto`, quando `empresaEmFoco` for `null`, gravar `cliente_em_foco = null`. No webhook, gravar `cliente_id` só se a empresa ainda for do contato. Registrar o risco do número reatribuído (por exemplo, pedir revalidação depois de N meses sem conversa).
- Teste de regressão: desvincular o contato de A e mandar uma mensagem nova. Afirmar `mensagens.cliente_id is null` e `conversas.cliente_em_foco is null`.

### 3.10 Eco ainda usa `normalizarTelefone`   [Baixa] [Confirmado]
- Onde: `envio.ts:129`; `packages/core/src/telefone.ts:1-6`.
- Como acontece: a equipe responde pelo celular a um número estrangeiro de 10 ou 11 dígitos. O sistema cria uma conversa "55+dígitos", que é um número brasileiro inexistente, e a marca como `humano`. Não há envio à pessoa errada, porque não é um celular válido, mas fica uma conversa fantasma.
- Correção proposta: usar `telefoneDoWhatsApp` e, quando der `null`, devolver `do-sistema`.
- Teste de regressão: um eco com `phone:'12025550123'` não cria conversa.

### 3.11 O limitador vale só por processo e só para "sistema", e prende a vez da conversa   [Baixa] [Confirmado]
- Onde: `envio.ts:7-26, 39`; `principal.ts:55`.
- Evidência: o contador fica na memória do processo. Com dois contêineres na implantação, o limite dobra. Respostas do agente, do painel, do assistente e avisos de tarefa não passam por ele. O aviso de LGPD e o "IA indisponível" (`autor:'sistema'`) esperam na mesma fila dos alertas ao dono, dentro da vez da conversa: numa rajada de alertas, a primeira resposta ao cliente atrasa minutos.
- Correção proposta: usar o limitador só para alertas internos. Mensagem ao cliente nunca espera alerta. Se precisar de limite global, usar um contador no banco.

### 3.12 Aviso de LGPD pode sair duas vezes   [Baixa] [Confirmado]
- Onde: `processar-conversa.ts:227-232`. Primeiro envia, depois grava `aviso_lgpd_enviado_em`. Se a gravação falhar, o job relança e o aviso sai de novo. Continua igual ao M6 da revisão anterior.
- Correção proposta: gravar a marca antes (ou numa reserva) e enviar depois.

### 3.13 Painel sem `AMBIENTE` validado: a divergência com o trabalhador não é detectada   [Baixa] [Confirmado]
- Onde: `apps/painel/src/lib/ambiente.ts:5-11` (ausente vira "DESENVOLVIMENTO"); `ambiente-validar.ts:48-76` (não confere `AMBIENTE`).
- Impacto: só cosmético, porque o painel não envia (ver controles). O painel pode mostrar "HOMOLOGAÇÃO" ligado a um banco de produção, ou o contrário.
- Correção proposta: o painel exige `AMBIENTE` no `exigirAmbiente` e mostra o ambiente informado pelo trabalhador (gravado em `sinais_vida` ou `configuracoes`), com alerta se forem diferentes.

## Controles aprovados (com evidência)
- **Comparação do segredo:** SHA-256 dos dois lados e `timingSafeEqual`, sem vazar o tamanho (`servidor.ts:34-39`). O "sai antes se o tamanho difere" da revisão anterior foi corrigido.
- **Máscara no log normal:** o serializer de `req` troca o segredo e o `?token=` (`servidor.ts:48`). Os logs de erro 5xx (`defaultErrorLog`) usam o mesmo serializer. A exceção é o 404 (3.4).
- **Corpo:** `bodyLimit` de 1 MB (`servidor.ts:43`); só JSON e texto são interpretados (Fastify devolve 415 para o resto); zod no formato.
- **/saude:** sem token, só `{ok}`; os detalhes exigem `SAUDE_TOKEN` com comparação constante (`servidor.ts:94-101`); `/vivo` separado.
- **Deduplicação atômica:** `id_provedor text unique` (`20260927000200_atendimento.sql:37`) e `upsert ... onConflict:'id_provedor', ignoreDuplicates` (`repos.ts:295-307`). A reentrega, mesmo simultânea ou depois de reinício, não duplica nem reagenda. Se o primeiro POST gravou e falhou ao agendar, o batimento (C1) recupera a mensagem parada.
- **Conversa única:** `conversas.telefone unique` e nova leitura no 23505 (`repos.ts:252-264`).
- **Pendente antes do envio:** em toda saída do sistema (`envio.ts:38, 65`). O eco nunca chega antes da linha existir.
- **Nenhuma corrida no envio do painel:** `reservarEnvio` é um UPDATE condicional atômico (`repos.ts:366-372`), e o batimento respeita a reserva (`repos.ts:584-590`).
- **Sem reenvio cego no agente:** erro da Z-API não é `erroTemporarioIa` (`agente/cliente-ia.ts:16-20`), então o job não relança ferramentas (`processar-conversa.ts:294-302`).
- **Destino fixo:** todo envio vai a `conversa.telefone` (`envio.ts:97, 102`; `ferramentas.ts` em `responder` e `enviar_documento`). O modelo não escolhe o destinatário.
- **Antes de cada parte enviada,** o agente confere se a conversa foi assumida (`ferramentas.ts:793-806`, mais a conferência em `enviar_documento`).
- **Trava de ambiente:**
  - `AMBIENTE` é um enum obrigatório; ausente ou inválido impede a subida (`config.ts:26`; testes `trava.test.ts`, 9 de 9).
  - `TELEFONES_PERMITIDOS` vazio bloqueia tudo.
  - O canal único é criado só em `principal.ts:47-49` e embrulhado por `canalComTrava`. O painel só enfileira (`apps/painel/src/lib/fila.ts`; `atendimento/acoes.ts:66-74`).
  - Radar, pendências, alertas, assistente e avisos de tarefa usam esse canal. Simulação e sugestão usam canais que sempre recusam (`agente/simular.ts:105-106`, `sugestao/ferramentas.ts:43-44`).
  - Documentos passam por `enviarArquivo` com trava (`trava.ts:34`).
  - O bloqueio é registrado em `decisoes_agente` e aparece no painel como "Não enviada: ambiente de teste".
- **Chamadas à Z-API:** prazo em todas; o erro não inclui a URL com o token (`zapi.ts:41-44`); base fixa `https://api.z-api.io`.
- **Grupo, notificação e reação** são descartados (`servidor.ts:55`; `zapi.ts:60-62`). Número estrangeiro e `@lid` na entrada viram alerta e não viram conversa (`servidor.ts:63-76`).

## Cenários adversariais da área
| Cenário | Dados sintéticos e sequência | Injeção | Invariantes esperados | Situação pela leitura do código |
|---|---|---|---|---|
| 19.1 Cem eventos simultâneos de uma conversa | Telefone novo `55319000000xx`; 100 POSTs paralelos, 90 ids distintos e 10 repetidos | Nenhuma | 1 conversa; 90 mensagens; no máximo 1 job esperando (`policy short` + `singletonKey`); nenhum 500 | Deve passar (3.1: sem rate limit; cada POST faz de 3 a 4 consultas) |
| 19.6 Timeout da Z-API depois do envio | `CanalFalso` que entrega e lança `TimeoutError`; eco entregue antes e depois do timeout | Timeout depois do efeito | Linha `enviada`; nenhum envio repetido; conversa continua `agente` | **Reprova** (3.2, 3.3) |
| 19.24 Configuração ausente ou divergente | Subir o trabalhador sem `AMBIENTE`, com `AMBIENTE=prod` e com homologação sem lista | Variável ausente ou inválida | Não sobe, ou bloqueia todo envio | Aprovado no trabalhador; o painel não confere (3.13) |
| 19.29 Concorrência no envio de mensagens e documentos | 4 conversas mandando PDF de 15 MB, mais respostas do painel com anexo, ao mesmo tempo | Z-API lenta (100 s) | Memória abaixo do limite do contêiner; nenhum duplicado; nenhum "humano" indevido | Base64 completo em memória (cerca de 3× o arquivo por envio: bytes, base64 e JSON); risco de 3.2 e 3.3; limitador local (3.11) |

## Árvores de falha
**C. Não perder mensagens recebidas**
- O POST não chega: Z-API, rede, proxy ou instância desconectada. O batimento alerta "WhatsApp desconectado" só quando `status()` falha. Não verificável: a Z-API reentrega?
- Chega e é descartado:
  - Segredo errado ou 404 (3.4).
  - Esquema inválido: 200 silencioso (3.7).
  - `messageId` vazio que colide (3.7).
  - Grupo, aviso ou reação (proposital).
  - Estrangeiro ou `@lid`: vira alerta e o conteúdo não é guardado (proposital).
- Chega e falha ao gravar: 500, e depende da reentrega da Z-API (não verificável). Sem alerta.
- Gravada e não agendada: o batimento C1 recupera (aprovado).
- Gravada e "processada" sem resposta: fora da área (C1, área de filas).

**E. Não enviar mensagens ou documentos à pessoa errada**
- O destino é sempre `conversa.telefone` (aprovado). A pessoa errada só aparece se a conversa ou o contato apontarem para a pessoa errada:
  - Contato duplicado por variante (3.8).
  - Número reatribuído e empresa em foco antiga (3.9).
  - Webhook forjado com o telefone do contato: a resposta vai ao dono real do número, não ao atacante (3.1).
- Homologação mandando a cliente real: bloqueada por `canalComTrava` (aprovado), a menos que `AMBIENTE=producao` seja posto por engano. O `/saude` com token mostra o ambiente.
- Envio em dobro ao destinatário certo (3.3) não é pessoa errada, mas cai na árvore D.

## Revisão anterior: situação dos itens da área
| Item (07/10) | Situação hoje | Evidência |
|---|---|---|
| Segredo no caminho, sem segunda conferência nem rate limit | **Aberto**, agravado pelo 404 (3.1, 3.4) | `servidor.ts:52-53`; Fastify `routeNotFound` |
| Comparação sai antes com tamanho diferente | **Corrigido** | `servidor.ts:34-39` (hash e `timingSafeEqual`) |
| `/saude` aberto com detalhes | **Corrigido** (6847cc6) | `servidor.ts:94-103` |
| Trabalhador sem `AMBIENTE` e lista de telefones | **Corrigido** (c20eb20) | `config.ts:26-29`; `canal/trava.ts`; `principal.ts:47-49` |
| Download de mídia sem filtro de endereço | **Aberto** (3.5) | `armazenamento.ts:55` |
| Eco usa `normalizarTelefone` | **Aberto** (3.10) | `envio.ts:129` |
| I3 eco de documento calava o agente | **Parcial**: resolvido quando a Z-API responde; reaparece no timeout ou erro depois do envio (3.2) | `envio.ts:142` |
| I7 número estrangeiro ou `@lid` | **Corrigido** na entrada | `servidor.ts:63-76` |
| I9 envio do painel em dobro | **Parcial**: a reserva resolve a corrida; o resultado desconhecido ainda duplica (3.3) | `envio.ts:105-108` |
| M6 aviso LGPD duas vezes | **Aberto** (3.12) | `processar-conversa.ts:227-232` |
| M9 Radar fora do limitador | **Aberto** (o Radar usa `autor:'agente'`; ver 3.11) | `radar/envios.ts:47` |
| M10 separar texto e arquivo | **Aberto** (3.3) | `repos.ts:382-390` |
| Banco I1 caminho do anexo em `registrar_resposta` | **Corrigido**; o trabalhador também confere | `envio.ts:78, 87-92` |
| WhatsApp como login da equipe (assistente) | Continua aceito; com o segredo vazado, vira personificação (3.1) | `processar-conversa.ts:186-203` |

## Não verificável / precisa de acesso
- Se a Z-API assina os webhooks ou envia cabeçalho próprio (por exemplo, client-token) que possa ser validado. O código não valida nenhum.
- Se a Z-API reentrega o webhook depois de 5xx ou timeout, e quantas vezes.
- Se o `messageId` da resposta de `/send-text` e `/send-document` é sempre igual ao `messageId` do eco. Isso sustenta todo o reconhecimento do eco por id.
- Limites de taxa da Z-API e do WhatsApp para a instância.
- Logs de acesso do proxy do Easypanel (Traefik) e do painel da Z-API: se registram a URL completa com o segredo.
- Se homologação e produção usam a mesma instância Z-API ou o mesmo banco (fila de um ambiente consumida no outro). Pelo código, cada ambiente usa o pg-boss do próprio `DATABASE_URL`.
- Entropia real do `WEBHOOK_SEGREDO` em produção (o código só exige 16 caracteres).
- Como a Z-API entrega status e canais (`broadcast`, `isNewsletter`) e mensagens editadas (`isEdit`).
