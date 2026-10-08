# Área 4: Filas, concorrência, idempotência, recuperação, rotinas agendadas, disponibilidade e custos

Commit auditado: `8242a24`. Somente leitura: nenhum teste com banco foi rodado, e nenhum ambiente remoto foi acessado. pg-boss: `^10.1.0` no package.json, **10.4.2** resolvido no lockfile (`pnpm-lock.yaml:2385`); o código da biblioteca foi lido em `node_modules/.pnpm/pg-boss@10.4.2`.

## Resumo (5 a 10 linhas)

A trava `conversa:<id>` é atômica e fica no banco (`INSERT … ON CONFLICT … WHERE ate < now() OR dono = …`, usando o relógio do banco). Só o dono solta a trava. A política `short` do pg-boss nunca descarta um job novo enquanto outro roda. O lote marca como processadas apenas as mensagens que leu. Os agendamentos (cron) são deduplicados no banco, então dois trabalhadores não duplicam batimento, resumo nem certificados. Essas partes estão sólidas.

O ponto fraco é a **recuperação depois de uma interrupção**. A trava não é renovada e só vence em 20 min. Uma implantação ou queda no meio de uma vez deixa a conversa parada por até 20 min e depois **refaz o lote inteiro**, repetindo resposta e demanda. A regra "só repete se nenhuma decisão foi gravada" vale apenas para exceção da IA. Ela não cobre queda do processo nem erro no caminho de escalada.

No custo, o teto é **global** (padrão US$ 50/mês), e nada limita o gasto por número ou conversa. Qualquer número de WhatsApp, inclusive desconhecido, pode esgotar o mês e desligar o agente para todos os clientes. O lote não tem limite de anexos nem de texto.

Em observabilidade, `/saude` mede só dois sinais de vida. O sinal `fila` é gravado antes das recuperações, e uma falha geral da IA não gera alerta ao dono.

São 17 achados: 0 críticos, 3 altos, 7 médios e 7 baixos.

## Achados

### 4.1 Implantação ou queda no meio de uma vez: conversa parada até 20 min e lote refeito (resposta e demanda em dobro)   [Alta] [Confirmado]
- Onde: `apps/trabalhador/src/principal.ts:310-320` (encerrar); `apps/trabalhador/src/fila.ts:148-162` (naVez, sem renovação); `fila.ts:56-58` (job 900 s, trava 1200 s); `node_modules/.pnpm/pg-boss@10.4.2/.../src/index.js:147-210` e `manager.js:113-120` (stop → failWip); `processar-conversa.ts:178-183, 295, 305-306`.
- Evidência: `encerrar` chama `boss.stop({ graceful: true, timeout: 30_000 })` e depois `process.exit(0)`. Passados 30 s, o pg-boss marca os jobs ativos como falhos ("pg-boss shut down while active"). O `finally` de `naVez`, que solta a trava, nunca roda, porque o processo sai com `fazer()` ainda pendente. A trava (`ate = now() + 20 min`) continua valendo. A vez do agente pode levar 7 min ou mais (ver 4.4), muito acima dos 30 s. Com SIGKILL do orquestrador (o Docker usa 10 s por padrão, e o Easypanel não foi verificado), nem o `failWip` roda: o job fica "active" até expirar aos 15 min.
- Pré-condições: implantação, reinício ou OOM com uma conversa em atendimento. Implantações são frequentes, e já houve duas no dia 08/10.
- Como acontece:
  1. O cliente manda a mensagem M. O job pega a trava. O agente chama `responder` (o cliente recebe a resposta) e `abrir_chamado` (a demanda é criada no setor).
  2. Chega o SIGTERM. Em 30 s, o pg-boss falha o job e o processo sai. A trava fica, e M continua com `processada_em = null` (o `marcarProcessadas` da linha 306 não rodou).
  3. O contêiner novo pega a nova tentativa (retryDelay 20 s). `pegarTrava` falha e cai em `ocupada`, que reenfileira a cada 15 s por até 20 min. Mensagens novas dessa conversa também ficam paradas. O `mensagensParadas` também ignora a conversa, porque `conversas_com_mensagem_parada` exclui conversa com trava válida.
  4. A trava vence. O job novo lê M de novo (`mensagensNaoProcessadas`) e roda o agente do zero. **Nada consulta `contarDecisoesDesde` nesse caminho**, porque a linha 295 só roda dentro do `catch` de exceção da IA. O resultado é uma segunda resposta ao cliente, em outro texto. O `abrir_chamado` de setor abre **outra demanda**, porque só a Triagem é complementada (`agente/ferramentas.ts:479-494`). Um `enviar_documento` repetido manda o documento de novo.
- Impacto: o cliente fica até 20 min sem resposta e depois recebe resposta duplicada, às vezes contraditória. A demanda sai em dobro e o custo de IA também. Acontece a cada implantação que pega uma conversa no meio.
- Correção proposta:
  - (a) Usar trava com batimento próprio: renovar `pegar_trava(chave, dono, 120)` a cada 30 s enquanto `fazer()` roda (setInterval em `naVez`) e baixar a validade para 2 a 3 min. Um processo morto libera a conversa em minutos, e um vivo nunca perde a trava.
  - (b) Gravar o início da tentativa no lote (ex.: `mensagens.tentativa_em`). Na partida de `processarConversaSemProtecao`, se alguma mensagem do lote já tem `tentativa_em` **e** `contarDecisoesDesde(conversa, tentativa_em) > 0`, não rodar o agente: chamar `passarAEquipeSemResposta` com o motivo "execução interrompida, resultado desconhecido".
  - (c) Subir o timeout do `boss.stop` e o *stop grace period* do Easypanel para pelo menos o prazo da vez, ou fazer a parada recusar rodadas novas (prazoVez = agora) e esperar a rodada atual terminar.
- Teste de regressão:
  - Com o banco local e o trabalhador em teste, rodar `processarConversaNaVez` com uma IA falsa que responde `responder` + `abrir_chamado` e depois pendura.
  - Matar o processo, ou simular abandonando a promise sem soltar a trava, e rodar outro `processarConversaNaVez` depois de vencida a trava.
  - Afirmar: 1 só mensagem de saída do agente, 1 só chamado, e a conversa em "esperando pessoa" com o motivo "interrompida".
  - Com a renovação: afirmar que a trava de um dono morto vence em menos de 3 min e a de um dono vivo nunca vence.

### 4.2 Abuso econômico externo: qualquer número de WhatsApp esgota o teto mensal global e desliga o agente para todos   [Alta] [Provável]
- Onde: `processar-conversa.ts:252-259` (teto global por mês); `:261-274` (limite de volume conta só saídas do agente: 15 em 10 min); `:63-97, 276, 281` (lote sem limite de mensagens nem de anexos); `agente/prompt.ts:172-203` (todos os anexos em base64 no bloco do usuário, sem `cache_control`); `agente/executar.ts:151-158` (até 6 rodadas, cada uma reenviando tudo); `agente/roteamento.ts:107` (o especialista recebe o mesmo conteúdo); `supabase/migrations/20260927000100_base.sql:93` (`teto_ia_usd` padrão 50).
- Evidência: número desconhecido também é atendido pelo agente ("Número desconhecido: … (não cadastrado)", `prompt.ts:178`). Cada lote vai inteiro ao modelo: até 20 mensagens de histórico, todas as novas (texto de WhatsApp com até ~65 mil caracteres cada) e todas as imagens e PDFs de até 5 MB. Isso se repete em cada rodada, porque só o `system` tem `cache_control` (`prompt.ts:47`). Não há limite de custo por conversa, contato ou número, nem limite de tamanho do lote.
- Pré-condições: um número de WhatsApp qualquer. O valor do teto em produção não foi verificado (o padrão é US$ 50).
- Como acontece:
  - A cada ~1 min, o atacante manda um lote de ~10 textos longos e PDFs de várias páginas (~100–150 mil tokens).
  - Cada vez custa de 2 a 7 chamadas × ~US$ 0,20–0,40 de entrada (preço padrão de `claude-sonnet-5`: US$ 2/M de entrada). Dá aproximadamente US$ 1–3 por vez.
  - O limite de volume deixa até 15 respostas do agente a cada 10 min, ou seja, até ~90 vezes por hora por número.
  - Com isso, US$ 50 acabam em menos de 1 h. Daí até o fim do mês, **todas** as conversas de clientes caem em `teto` (linha 253): Triagem e o aviso "IA indisponível".
- Impacto: negação de serviço do agente para o escritório inteiro até o dono subir o teto, além de gasto real. Os números exatos dependem de preço e modelo e são estimativa. O caminho no código está confirmado.
- Correção proposta:
  - (1) Teto por conversa ou contato em 24 h (soma de `uso_ia.custo_usd` por `conversa_id`) e teto menor para número desconhecido. Ao passar, ir para a equipe sem IA.
  - (2) Limitar o lote: no máximo N mensagens novas (ex.: 15), M caracteres no total (ex.: 20 mil) e K anexos (ex.: 3, até 10 MB somados). O resto vira "[anexo não aberto: excesso no lote]".
  - (3) Pôr `cache_control` no bloco de conteúdo do usuário, para as rodadas 2 a 6 lerem do cache.
  - (4) Reservar parte do teto para clientes cadastrados.
- Teste de regressão: com uma IA falsa que registra o custo, montar um lote com 30 PDFs e 20 textos de 60 mil caracteres. Afirmar que o pedido à IA tem no máximo K blocos de documento e no máximo M caracteres. Com `uso_ia` da conversa acima do teto por conversa, afirmar que o desfecho é "teto da conversa" sem chamar a IA.

### 4.3 Contêiner antigo vivo depois da implantação (incidente de 08/10): o banco serializa a vez, mas não a configuração do processo   [Alta] [Provável]
- Onde: `principal.ts:209-212` (trava de ambiente por processo); `canal/trava.ts:21-35` (bloqueado devolve id falso "bloqueado-…" e segue **sem erro**); `envio.ts:7-26, 217` (`LimitadorEnvio` em memória); `principal.ts:233-237` (4 consumidores por processo).
- Evidência:
  - **Protegido pelo banco:** busca de job (SKIP LOCKED do pg-boss), trava da conversa (4.x Controles), cron (`timekeeper.js:119-150`: `trySetCronTime` + `singletonKey` + `singletonSeconds: 60`, índice `job_i4`), certificados (on conflict) e reserva de envio do painel.
  - **Duplica ou diverge:**
    - o limitador do "sistema" vira 2 × 20/min;
    - os consumidores viram 8 vezes simultâneas, o que dobra o estouro de teto (4.11) e a memória;
    - cada processo usa **suas** variáveis.
  - Pela arquitetura (`ARQUITETURA-ATENDIMENTO.md:58`), o incidente aconteceu "depois de trocar o Ambiente".
- Pré-condições: dois contêineres com variáveis diferentes ligados ao mesmo banco, ou atrás do mesmo domínio.
- Como acontece:
  - (a) Mesmo banco, o antigo com `AMBIENTE=homologacao`: ~metade dos jobs de conversa cai no antigo. O agente "responde", o canal bloqueia sem erro, a mensagem fica marcada como enviada com id `bloqueado-…` e o lote como processado. O cliente não recebe nada, e o batimento não vê, porque a mensagem está processada. Só sobra a decisão `envio_bloqueado`.
  - (b) Banco diferente (o antigo ainda na homologação) e o mesmo domínio: o Easypanel/Swarm divide os webhooks entre os dois, e parte das mensagens de clientes é gravada **no banco da homologação**. **Hipótese:** depende do roteamento do Easypanel.
  - (c) Código diferente: o contêiner antigo interpreta estados novos com regras antigas (árvore H).
- Impacto: mensagens de clientes sem resposta e sem alerta, durante todo o tempo em que os dois ficarem vivos.
- Correção proposta:
  - Registrar instância: tabela `instancias_trabalhador(id, hostname, ambiente, versao, iniciado_em, visto_em)`, gravada no batimento.
  - O processo que vê outra instância viva com `ambiente`/`versao` diferente para de consumir (`boss.offWork`) e gera alerta crítico.
  - O `/saude` passa a falhar com mais de uma instância viva.
  - Fazer o envio bloqueado em produção (banco com `configuracoes.ambiente = 'producao'`) lançar erro em vez de fingir sucesso: conferir na partida que `AMBIENTE` do processo é igual ao valor gravado no banco.
- Teste de regressão: subir dois trabalhadores de teste contra o mesmo banco local com `AMBIENTE` diferente. Afirmar que o segundo a ver o outro se desliga das filas, que existe alerta crítico e que `/saude` dá 503. Com `AMBIENTE` divergente do banco, afirmar que a partida falha.

### 4.4 Vez longa (mídia sem limite de itens) passa da trava de 20 min: duas execuções da mesma conversa   [Média] [Provável]
- Onde: `processar-conversa.ts:63-97` (mídias em sequência, antes do agente e sem orçamento próprio); `midia/armazenamento.ts:13, 55, 60` (download 60 s; upload ao Storage sem prazo); `midia/transcritor.ts:35` (120 s); `packages/db/src/cliente.ts:8` (supabase-js sem timeout de fetch); `agente/executar.ts:151-158` (prazo só no início de cada rodada); `agente/cliente-ia.ts:277` (60 s × 3 tentativas, mais as esperas do SDK).
- Evidência: o prazo de 7 min conta desde o início do job, mas só é conferido no começo de cada rodada.
  - **Caminho do agente, pior caso:** rodada do Thiago aberta pouco antes dos 7 min (até ~3–5 min na chamada) + `chamar_agente` (o especialista abre uma rodada se ainda estiver dentro do prazo: mais ~3–5 min) + ferramentas (responder: até 3 × 30 s; `enviar_documento`: até 120 s cada) + escalada. Total de ~15–18 min. Isso **passa do `expireInSeconds` de 900 s**: o pg-boss falha o job com a vez ainda rodando, a nova tentativa cai em "ocupada" e o slot do consumidor é liberado (`manager.js:212-219`). Dentro dos 20 min da trava sobra pouca folga.
  - **Caminho da mídia:** sem limite. São N áudios × (60 s de download + upload + 120 s de transcrição) ≈ 3 min cada. Com 7 ou mais áudios e o fornecedor lento, passa de 20 min.
- Pré-condições: fornecedor de transcrição ou Storage lento, e lote com vários áudios. Ou a Anthropic lenta perto do prazo.
- Como acontece:
  1. Aos 20 min, a trava do job A vence com A ainda na mídia.
  2. O job B (reenfileirado por "ocupada") pega a trava, lê as mesmas mensagens (`processada_em` nulo), pula as mídias já salvas e roda o agente.
  3. A chega ao agente, vê o prazo vencido na rodada 0 e escala com o aviso "IA indisponível", abrindo Triagem.
  4. O cliente recebe a resposta de B **e** o aviso de A. A `soltarTrava` de A não apaga a trava de B, porque confere o dono, e isso está correto.
- Impacto: mensagens conflitantes, Triagem desnecessária e custo de transcrição/IA em dobro.
- Correção proposta: a renovação da trava de 4.1(a) resolve a exclusão mútua. Além disso:
  - limitar o tempo total de mídia (ex.: parar de baixar e transcrever aos 3 min e marcar o resto como "[anexo não aberto: tempo]");
  - dar timeout ao fetch do supabase-js (`global.fetch` com `AbortSignal.timeout(30_000)`);
  - abrir rodada nova só se `prazoVez - agora > 60 s + prazo da chamada`;
  - subir `expireInSeconds` para acima do pior caso, ou ligá-lo ao prazo real.
- Teste de regressão: transcritor falso que demora 200 s, 8 áudios no lote, relógio falso. Afirmar que o agente começa antes de 4 min, que a trava é renovada e que um segundo `processarConversaNaVez` concorrente recebe "ocupada" durante toda a execução.

### 4.5 Lote sem limite de anexos estoura o limite de requisição da Anthropic: falha permanente e uso de memória   [Média] [Provável]
- Onde: `processar-conversa.ts:22, 29-36, 63-97`; `agente/prompt.ts:195-201`.
- Evidência: cada imagem ou PDF de até 5 MB vira base64 (+33%) e entra no pedido sem limite de quantidade. Pela documentação pública, a Messages API recusa requisições acima de ~32 MB (fato externo, não verificado aqui). Cinco PDFs de 5 MB já dão ~33 MB em base64. O erro é 4xx, que `erroTemporarioIa` não trata como temporário, então o lote vai para a equipe com "Falha no agente de IA".
- Pré-condições: um cliente legítimo mandando 5 ou mais PDFs grandes (notas, extratos), o que é comum num escritório contábil.
- Como acontece: os documentos chegam juntos, todos são anexados, a requisição é recusada e o cliente recebe só "Recebemos sua mensagem…". Nas 4 vagas, cada job guarda as strings base64, e o SDK serializa o corpo inteiro a cada rodada (~2× o base64). Com dezenas de anexos, o heap do Node cresce para centenas de MB por job (OOM possível, o que cai em 4.1).
- Impacto: o atendimento não funciona para o caso mais comum de documento e há risco de OOM.
- Correção proposta: o limite de lote de 4.2(2). Os anexos que sobrarem ficam salvos e são citados por nome no texto. Uma ferramenta `ver_anexo(id)` permite ao agente abrir um por vez.
- Teste de regressão: lote com 8 PDFs de 4,9 MB e IA falsa que mede o corpo. Afirmar que o corpo tem menos de 20 MB e que o texto cita os 8 nomes.

### 4.6 Erro no caminho de escalada depois que o agente agiu relança o job inteiro e repete as ferramentas   [Média] [Provável]
- Onde: `processar-conversa.ts:280-304` (try/catch), `:154-171` (só `ErroDepoisDoAgente` não relança), `:99-116` (encaminharParaHumano).
- Evidência: depois que `atenderComAgentes` retorna (`agenteAgiu = true`), o bloco `r.status === 'escalar'` chama `assumidaPorHumano` e `encaminharParaHumano`, que leem e gravam no banco. Se um deles lança, o `catch` da linha 293 tenta de novo `assumidaPorHumano`/`encaminharParaHumano`. Uma segunda falha sai do `catch` como erro comum, sem o `ErroDepoisDoAgente`. Em `processarConversa` (linha 161), fora da última tentativa, o erro é relançado, o pg-boss tenta de novo e o lote é processado do zero.
- Pré-condições: falha passageira do PostgREST ou da rede por alguns segundos, logo depois de o agente responder com status `escalar` (refusal/max_tokens/limite de iterações depois de `responder`, ou erro da IA depois de ferramentas).
- Como acontece: o agente responde ao cliente e termina em `escalar`. `abrirChamado` falha duas vezes, o job é relançado e roda o agente de novo: segunda resposta e possível segunda demanda.
- Impacto: duplicação ao cliente com uma condição de falha comum de rede.
- Correção proposta: envolver em `ErroDepoisDoAgente` **tudo** o que vem depois de `agenteAgiu = true` ou de `contarDecisoesDesde > 0`. Em outras palavras, depois que o agente agiu, nenhum erro relança o job. A conversa fica para o batimento escalar (com as mensagens marcadas e a passagem pendente registrada).
- Teste de regressão: IA falsa que chama `responder` e termina com `max_tokens`. `repos.abrirChamado` lança duas vezes. Afirmar que `processarConversa` não relança (ou relança `ErroDepoisDoAgente`), que existe só 1 mensagem do agente e que as mensagens ficam marcadas.

### 4.7 Batimento grava o sinal de vida "fila" antes das recuperações: falha anterior pula mensagens paradas e WhatsApp com sinal verde   [Média] [Confirmado]
- Onde: `apps/trabalhador/src/tarefas.ts:336-363`.
- Evidência: a linha 337 grava `registrarSinalVida('fila')`. Nas linhas 339-352, cinco consultas (respostas do painel, assistente, tarefas, pendências, avisos) rodam **sem** try/catch, e só `mensagensParadas` (354) é protegida. Se `tarefasParadas` ou `avisosTarefaParados` lança (ex.: migração da Parte I3/I4 que falta no banco de produção, ou RPC com erro), o batimento termina com erro antes de tratar as mensagens de clientes paradas e antes de conferir o WhatsApp. O sinal `fila` fica verde, e só o `whatsapp` envelhece, o que aponta a causa errada.
- Pré-condições: qualquer erro persistente numa dessas consultas.
- Como acontece: com uma consulta falhando sempre, a recuperação C1 (mensagem de cliente sem resposta) para em silêncio. O `/saude` mostra "whatsapp" como falha, e o alerta de WhatsApp desconectado não sai, porque a função termina antes.
- Impacto: o mecanismo que garante "nenhuma conversa sem resposta" fica desligado sem aviso correto.
- Correção proposta: cada passo do batimento num `try` próprio (como em `alertasPeriodicos`, `tarefas.ts:394-405`), com o erro acumulado e relançado no fim. Gravar o sinal `fila` **no fim**, ou gravar sinais separados: `fila` (cron), `recuperacao` (mensagensParadas ok) e `whatsapp`.
- Teste de regressão: `repos.tarefasParadas` lança. Afirmar que `mensagensParadas` foi chamada, que `canal.status` foi chamado e que o job termina com erro.

### 4.8 Falha geral da IA (chave inválida, limite do workspace, 4xx) não alerta ninguém: cada conversa vira Triagem em silêncio   [Média] [Confirmado]
- Onde: `processar-conversa.ts:293-303` (só `console.error` e escalada); `agente/cliente-ia.ts:282-286`; `servidor.ts:302-318` (a saúde não olha a IA).
- Evidência: um erro não temporário (401, 400 de crédito ou limite do workspace, 404 de modelo inexistente) escala a conversa, manda "IA indisponível" e abre Triagem. Não há alerta `operacional` nem `critico` ao dono, nem contador. O limite de gasto do workspace da Anthropic, que é o freio externo declarado, cai exatamente nesse caminho.
- Pré-condições: chave revogada, workspace no limite, modelo removido ou preço trocado para um modelo inválido.
- Impacto: o atendimento automático para por completo e o dono só descobre pela Triagem cheia.
- Correção proposta: no `catch`, classificar o erro (`APIError.status` 401/403/400 com `type` de cobrança/limite, 404). Gerar um alerta `critico` deduplicado por 30 min (`alertaRecente`) e gravar o sinal de vida `ia` só em sucesso. O `/saude` passa a falhar se `ia` tiver mais de 30 min **e** houver mensagem de cliente nesse período.
- Teste de regressão: IA falsa lança `AuthenticationError` em 3 conversas. Afirmar 1 alerta crítico (não 3) e `/saude` em 503 com a falha `ia`.

### 4.9 `/saude` não mede o que importa (fila de conversas, backlog, IA, envios) e não há monitor externo; os alertas dependem do próprio trabalhador   [Média] [Confirmado]
- Onde: `servidor.ts:302-318, 380-389`; `tarefas.ts:337, 357`; `alertas.ts:447-460` (nível `aviso` só grava no painel); `ARQUITETURA-ATENDIMENTO.md:331` (monitor externo não implantado).
- Evidência: `avaliarSaude` só confere `sinais_vida.fila` e `whatsapp` (menos de 3 min). Não detecta:
  - consumidores de `processar-conversa` travados (o batimento é outra fila);
  - backlog de mensagens não processadas;
  - jobs `failed` acumulando;
  - mensagens com `status_envio = falhou`;
  - IA fora (4.8);
  - SMTP fora;
  - dois trabalhadores (4.3).
  O `/vivo` responde ok mesmo com o pg-boss sem conectar, o que está correto para liveness, mas não há prontidão. Se o processo morre, nenhum alerta sai, porque quem alerta é ele. Sobra a faixa do painel (`estado_sistema_resumo`), que só aparece se alguém estiver olhando. O alerta de mensagem parada é `aviso` (`tarefas.ts:460`) e não sai por e-mail nem WhatsApp.
- Impacto: fora do expediente, uma parada total fica invisível até alguém abrir o painel.
- Correção proposta: em `/saude` (com token), acrescentar:
  - `backlog`: mensagens de entrada não processadas há mais de 5 min em conversas `agente` (limite: 3 ou mais = falha);
  - `idade_mais_antiga`: mais de 10 min = falha;
  - `jobs_falhos_1h` de `processar-conversa` (mais de 3 = falha);
  - `envios_falhos_1h` (mais de 3 = aviso);
  - `ia` (4.8);
  - `instancias` (4.3).
  Também: implantar o monitor externo a cada 1–5 min com aviso fora do e-mail (Telegram/SMS) e subir o alerta de mensagem parada para `operacional`.
- Teste de regressão: com 3 mensagens paradas há 6 min, afirmar que `/saude` dá 503 com `falhas` contendo `backlog`. Com os sinais em dia e sem backlog, 200.

### 4.10 Batimento passa a conversa à equipe sem a trava: corrida com a vez que está começando e passagem não atômica   [Média] [Provável]
- Onde: `tarefas.ts:443-468` (chama `passarAEquipeSemResposta` sem `naVez`); `processar-conversa.ts:133-152` (relê **todas** as não processadas e marca); `:99-116` (verifica e depois insere, sem atomicidade); SQL `conversas_com_mensagem_parada` (`20261028000100_revisao_trabalhador_fila.sql:52-62`, que confere a trava só no instante da consulta).
- Evidência: entre a consulta (sem trava) e `passarAEquipeSemResposta`, um job da mesma conversa pode pegar a trava e começar. Isso é plausível: a segunda devolução enfileirou um job, e as tentativas com backoff de 20/40/80 s mais o "ocupada" podem atrasá-lo. O batimento então marca como processadas mensagens que o agente está lendo, ou outras que acabaram de chegar e ninguém viu. Ele também abre Triagem, manda "IA indisponível" e marca "esperando pessoa" enquanto o agente responde. Não há índice único de "Triagem aberta por conversa". Com dois batimentos sobrepostos (dois contêineres, ou um batimento lento por causa do limitador ou dos 15 s do status), saem duas Triagens e dois avisos, e `marcar_reenfileirada` passa de 2. Esse excesso só adianta a escalada, sem outro dano.
- Impacto: mensagens conflitantes ao cliente, mensagem marcada sem ter sido lida e Triagem duplicada. É raro.
- Correção proposta:
  - Rodar `passarAEquipeSemResposta` do batimento dentro de `naVez('conversa:'+id, …)` (ocupada = pular).
  - Passar a ela os ids da consulta (`array_agg(m.id)` em `conversas_com_mensagem_parada`) em vez de reler tudo.
  - Criar um índice único parcial `chamados(conversa_id) where setor_id is null and status <> 'concluido' and origem in ('sistema','agente')` com `on conflict do nothing`.
- Teste de regressão: com a trava da conversa pega por outro dono, rodar `mensagensParadas` com `reenvios = 2`. Afirmar que nada foi marcado e nenhum chamado foi aberto. Duas chamadas concorrentes de `passarAEquipeSemResposta` resultam em 1 chamado.

### 4.11 Teto conferido só na entrada; estouro limitado aos jobs em andamento; custos que não entram na conta   [Baixa] [Confirmado]
- Onde: `processar-conversa.ts:252-253`; `assistente/processar.ts:70`; `tarefa/processar.ts:76`; `sugestao/processar.ts:44`; `radar/giro.ts:31`; `agente/simular.ts:363`; `agente/executar.ts:35-46, 158-159`; `processar-conversa.ts:43-61`; `packages/core/src/custo.ts:36-38`.
- Evidência e estimativa:
  - **Paralelismo:** 4 conversas + 2 assistente + 2 simulações + 2 sugestões + 1 tarefa + 1 Radar, o que dá 12 jobs que podem ter passado pela conferência antes de o teto ser atingido. Uma vez de conversa faz até ~6 rodadas do Thiago mais as do especialista dentro de 7 min.
  - **Estouro:** com contexto grande, isso dá alguns dólares por job. O estouro realista fica em US$ 10–50, e o dobro com dois contêineres. Não há reserva nem soma atômica, mas o efeito é limitado, e por isso a severidade é baixa.
  - **Ficam fora de `uso_ia`:**
    - (a) chamadas que a Anthropic cobrou mas que terminaram em timeout de 60 s, 5xx depois de processar ou resposta descartada, porque `registrarUso` só roda em sucesso (`executar.ts:158-159`). Nesse caso, a nova tentativa da fila paga de novo.
    - (b) modelo sem preço custa 0 (`executar.ts:39`). O gatilho `preco_em_uso` protege `agentes.modelo`, mas não `configuracoes.modelo_conversa`/`modelo_rapido` (`20261014000100_painel_v2_agentes.sql:82-99`).
    - (c) a transcrição custa 0 enquanto `custo_minuto_transcricao_usd` for nulo, que é o padrão da coluna (`20261006000100_painel_v2_gastos_colunas.sql:50`).
    - (d) falha ao gravar o custo da transcrição só gera log (`processar-conversa.ts:57-59`).
- Correção proposta: conferir o teto também a cada rodada (`custoIaDoMes` antes de `ia.criar`, com cache de 30 s). Estender `preco_em_uso` a `modelo_conversa`/`modelo_rapido`. Exigir o custo da transcrição antes de ligar o áudio, ou usar um preço padrão não nulo. Registrar em `uso_ia` uma linha "estimada" quando a chamada falha depois de enviada (tokens de entrada estimados).
- Teste de regressão: com o teto a US$ 0,01 de ser atingido, a IA falsa grava US$ 0,02 na rodada 1. Afirmar que a rodada 2 não acontece. Tentar remover do `precos_modelos` o preço do `modelo_conversa` e afirmar a exceção.

### 4.12 Alerta de 80%: duplicável, só no atendimento e marcado como enviado mesmo sem e-mail ou WhatsApp   [Baixa] [Confirmado]
- Onde: `processar-conversa.ts:225, 307-310`; `alertas.ts:447-460`.
- Evidência:
  - `config.alertaIa80Mes` é lido no início do job, até ~15 min antes. Quatro consumidores que terminam juntos podem mandar 4 alertas (e-mail e WhatsApp ao dono), porque não há `UPDATE … WHERE alerta_ia_80_mes IS DISTINCT FROM mes RETURNING`.
  - Gasto de assistente, tarefas, Radar e sugestões não dispara o alerta (item já registrado na revisão anterior).
  - O e-mail e o WhatsApp falham só com log, e mesmo assim `marcarAlertaIa80` grava, então o alerta não se repete.
  - Se `registrarAlerta` lança, o job é relançado e volta como `sem-mensagens` (as mensagens já foram marcadas), e o alerta fica para a próxima conversa. Isso é aceitável.
- Correção proposta: `marcar_alerta_ia80(p_mes)` atômico, que devolve se foi esta chamada que marcou, chamado **antes** de alertar. Levar a conferência para o batimento (a cada 5 min, cobre todas as funções).
- Teste de regressão: 4 chamadas concorrentes da conferência com o custo em 81%. Afirmar 1 alerta.

### 4.13 Mensagem órfã por mais de 24 h sai do batimento sem alerta; alerta de mensagem parada só no painel   [Baixa] [Confirmado]
- Onde: `tarefas.ts:436, 446` (`ateMin = 24*60`); SQL `conversas_com_mensagem_parada` (`having … > now() - p_ate_min`), que também exige `c.estado = 'agente'`.
- Evidência: uma mensagem que não foi resolvida em 24 h (trabalhador fora no fim de semana, `passarAEquipeSemResposta` falhando sempre) deixa de aparecer na consulta e não gera alerta.
- Correção proposta: consulta diária "entrada não processada há mais de 24 h" que gera alerta `operacional` com a contagem. Com isso, o `ateMin` vira só um filtro de reenfileiramento.
- Teste de regressão: mensagem parada há 25 h. Afirmar 1 alerta na verificação diária.

### 4.14 Pool de conexões: 10 por processo (padrão do `pg`) contra o session pooler   [Baixa] [Hipótese]
- Onde: `fila.ts:63` (sem `max`); `apps/painel/src/lib/fila.ts:16`; pg-boss `db.js:17-20` (`new pg.Pool(config)`, com `max` padrão de 10); `ARQUITETURA-ATENDIMENTO.md:302` (session pooler, porta 5432).
- Evidência: o trabalhador tem até 10 conexões, o painel até 10, e um contêiner a mais (4.3) acrescenta 10. No modo sessão do Supavisor, cada cliente ocupa uma conexão do `pool_size` do projeto, que não foi verificado. Com o pool cheio, o `send` do webhook falha, mas a mensagem já está gravada e o batimento recupera (controle aprovado). Já a busca de jobs e a manutenção do pg-boss falham em laço.
- Correção proposta: `new PgBoss({ connectionString, max: 4 })` no trabalhador e `max: 2` no painel, mantendo a soma abaixo do `pool_size` com folga. Conferir o `pool_size` no painel do Supabase.
- Teste de regressão: teste de configuração afirmando que `criarBoss` passa `max` menor ou igual a 4.

### 4.15 Rastreabilidade incompleta: id do job não é gravado, `uso_ia` não tem turno e o pg-boss apaga em 7 dias   [Baixa] [Confirmado]
- Onde: `principal.ts:234-236` (o `job.id` não é passado adiante); `agente/executar.ts:42-46` (`uso_ia` sem `turno`); `ferramentas.ts:835-838` (decisão com `turno`); `envio.ts:38` (saída com `turnoAgente`); pg-boss: arquivamento em 12 h e exclusão em 7 dias, os padrões (`attorney.js:199`).
- Evidência: não dá para ligar job → tentativa → chamada ao modelo → ferramenta com um identificador comum. O `turno` liga decisões e saídas, mas não `uso_ia` nem o job. Os logs são `console.*` sem estrutura (sem conversaId em todos). Tentativa e sucesso não são distinguidos em `uso_ia`.
- Correção proposta: gerar `execucao_id` por job (= `job.id` + `retryCount`), propagar em `DepsAgente` e gravá-lo em `decisoes_agente`, `uso_ia`, `mensagens` (saída) e `chamados` (origem agente). Usar logs JSON com `{conversaId, jobId, turno}`. Indicadores: latência p95 do recebimento até a primeira saída (meta < 2 min), taxa de escalada por falha/h e jobs falhos/h por fila.
- Teste de regressão: depois de uma vez com IA falsa, afirmar que todas as linhas de `uso_ia`, `decisoes_agente` e `mensagens` de saída têm o mesmo `execucao_id`.

### 4.16 Aviso de privacidade pode sair duas vezes (M6) e o prazo de 60 s corta respostas longas (M8)   [Baixa] [Confirmado]
- Onde: `processar-conversa.ts:227-232` (envia e depois grava `aviso_lgpd_enviado_em`); `agente/cliente-ia.ts:277` (`timeout: 60_000`, `max_tokens: 16000`, `effort: 'medium'`).
- Evidência: Z-API em timeout depois de entregar, ou falha ao gravar a data, faz a nova tentativa mandar o aviso de novo. Uma resposta que leva mais de 60 s para gerar é abortada e repetida 2 vezes: até 3 cobranças, nenhuma registrada (4.11a).
- Correção proposta: gravar a data antes de enviar, com o aviso no máximo uma vez, e aceitar perder o aviso numa falha rara. Usar timeout de 120–180 s ou streaming.
- Teste de regressão: Z-API falsa que lança depois de "entregar". Afirmar que a segunda tentativa não reenvia o aviso.

### 4.17 Limpeza de retenção sem prazo próprio: a primeira limpeza grande pode rodar duas vezes em paralelo   [Baixa] [Provável]
- Onde: `fila.ts:88-90` (`limpeza-retencao` só com `retryLimit: 2`, `expireInSeconds` padrão de 900 s); `retencao.ts:402-433` (lotes de 500, primeiro o Storage e depois as linhas).
- Evidência: depois do primeiro ano, milhares de mensagens com arquivos podem passar de 15 min. O pg-boss falha o job com a limpeza ainda rodando e uma nova tentativa roda junto (duas remoções do mesmo lote). Remover duas vezes é inócuo, e não há competição perigosa com a vez do agente, porque só apaga dados com mais de 1 ano.
- Correção proposta: `expireInSeconds: 3600` e policy `stately` sem chave, como no Radar, ou um teto de lotes por execução.
- Teste de regressão: afirmar a configuração da fila em `criarBoss`.

## Controles aprovados (com evidência)

- **Trava atômica e exclusiva entre processos:** `pegar_trava` usa `insert … on conflict (chave) do update … where t.ate < now() or t.dono = excluded.dono returning true` (`20261028000100_revisao_trabalhador_fila.sql:19-30`). A hora é a do banco (`now()`), sem depender do relógio dos contêineres. `soltar_trava` apaga só o dono (`:32-36`), então uma vez antiga não solta a trava da nova. A ressalva é a falta de renovação (4.1, 4.4).
- **Política `short` não descarta job novo com outro rodando:** o índice único vale só para `state = 'created'` (`pg-boss plans.js:336`). A mensagem que chega durante a vez gera um job novo, que cai em "ocupada" e se reenfileira a cada 15 s até a trava sair (`processar-conversa.ts:318-321`). A deduplicação só junta jobs **esperando**, e o job que sobra lê todas as não processadas.
- **O lote marca só o que leu:** os ids são fixados em `processar-conversa.ts:183` e marcados na `:306`. Mensagens que chegam depois ficam para o próximo job. A exceção está em `passarAEquipeSemResposta` (4.10).
- **Nova tentativa só sem ação do agente:** retry só com erro temporário da IA, fora da última tentativa e com 0 decisões desde a primeira mensagem do lote (`:295`). Cada ferramenta grava a decisão logo depois de executar (`ferramentas.ts:829-840`), e `chamar_agente`/`devolver_*` também gravam (`roteamento.ts:136-160`). Funciona para **exceções**. Não cobre queda do processo (4.1) nem erro na escalada (4.6).
- **Webhook grava antes de enfileirar:** `inserirMensagemEntrada` é idempotente por `id_provedor` (`repos.ts:300-306`). Uma falha no `send` é recuperada pelo batimento em 3 min (`tarefas.ts:443-454`).
- **Rotinas agendadas não duplicam com dois trabalhadores:** `onCron` usa `trySetCronTime` (um verificador por intervalo, no banco) e insere com `singletonKey: name, singletonSeconds: 60` (`timekeeper.js:119-150`; índice `job_i4`, `plans.js:348`). O painel não agenda (`apps/painel/src/lib/fila.ts:16`, `schedule: false`).
- **Certificados idempotentes e atômicos:** o aviso é gravado antes com `on conflict do nothing; if not found then continue` (`20261012000300_painel_v2_certificado.sql:42-44`).
- **Resumo diário sem duplicação por retry:** as falhas de WhatsApp e e-mail não relançam (`tarefas.ts:420-426`). O cron usa o fuso de São Paulo (`principal.ts:197, 286, 294, 297`). O mês do teto usa o fuso de SP nos dois lados: `mesReferencia` (`core/expediente.ts:23`) e `inicioDoMes` com `-03:00` (`repos.ts:177-183`), consistentes com o painel (`20261008000100_painel_v2_inicio.sql:20`). O Brasil não tem horário de verão desde 2019.
- **Simulação e sugestão não enviam nem gravam:** o canal bloqueado, a mídia bloqueada e o repositório por lista de leitura (`agente/simular.ts:93-112, 394`; `sugestao/ferramentas.ts:25-40`).
- **Prazos de rede:** Z-API 30/120/15 s (`canal/zapi.ts:21`), download 60 s e 20 MB (`midia/armazenamento.ts:11-13`), transcrição 120 s (`transcritor.ts:35`), IA 60 s (`cliente-ia.ts:277`).
- **Laço de robôs contido:** 15 saídas em 10 min passam a conversa à equipe, sem custo de IA (`processar-conversa.ts:261-274`).
- **Saúde e vida separadas:** `/saude` sem token responde só `{ok}`. O `HEALTHCHECK` usa `/vivo`, o que evita reinício em laço (`servidor.ts:380-389`; `Dockerfile.trabalhador:17-18`; commits `6847cc6`, `7aff1a5`).
- **Envio do painel com reserva no banco:** `reservarEnvio` antes de enviar (`envio.ts:85`). `respostasPendentesAntigas` respeita a reserva (`repos.ts:584-590`).

## Revisão anterior: situação dos itens da área

| Item (07/10) | Situação no código `8242a24` |
|---|---|
| C1: mensagem sem resposta e sem alerta | **Corrigido**, com sobras: `tarefas.ts:435-468`. Ficam 4.7 (passo anterior pula o C1), 4.10 (sem trava) e 4.13 (mais de 24 h, alerta só no painel) |
| I1: "stately" travava a fila | **Corrigido**: `fila.ts:66-70` (`short`) + `pegar_trava` atômico. Conferido no SQL e no pg-boss |
| I2: vez vencida repetida em paralelo | **Parcial**: a ordem vez (7 min) < job (15 min) < trava (20 min) existe (`fila.ts:56-58`, `processar-conversa.ts:19`), mas o pior caso do agente passa de 15 min e o da mídia não tem limite. Sem renovação (4.4). Queda do processo não está coberta (4.1) |
| I9: envio do painel em dobro | **Corrigido** com a reserva. Fica o resultado desconhecido da Z-API, sem chave de idempotência (área 3) |
| M6: aviso de privacidade em dobro | **Aberto** (4.16) |
| M7: teto só no início; vezes em paralelo passam do teto | **Aberto** (4.11, com estimativa), e ainda maior por abuso externo (4.2) |
| M8: prazo de 60 s em respostas longas | **Aberto** (4.16) |
| M9: Radar e avisos fora do limitador | Fora do foco desta área. O limitador continua em memória por processo (4.3) |
| Modelo sem preço custa zero (`modelo_conversa`/`modelo_rapido` sem proteção) | **Aberto** (4.11b) |
| Alerta de 80% só no atendimento | **Aberto** (4.12), e ainda duplicável |
| `/saude` aberto com detalhes | **Corrigido** (`servidor.ts:380-386`, commit `6847cc6`) |
| Imagens como root e sem HEALTHCHECK | **Corrigido** (`Dockerfile.trabalhador:15-19`, commit `7aff1a5`) |
| Cópia de segurança semanal cifrada | **Aberto** (não implantado, conforme `ARQUITETURA-ATENDIMENTO.md:331`). Não verificável no código |
| Monitor externo do `/saude` | **Aberto** (4.9) |
| Jobs do pg-boss guardam telefone e texto por 7 dias | **Aberto** (área LGPD). Relevante aqui só para a investigação forense (4.15) |

## Cenários da seção 19 (dados, sequência, injeção, invariante, evidência)

| # | Cenário | Situação pelo código | Invariante a afirmar no teste isolado |
|---|---|---|---|
| 2 | Mensagens de várias conversas durante a implantação | A mensagem é gravada antes de enfileirar, então com o webhook fora do ar depende da reentrega da Z-API (não verificável). As conversas no meio da vez caem em 4.1 | Toda mensagem gravada é processada **uma vez** em menos de 2 min depois da subida. Contar saídas do agente por lote igual a 1 |
| 3 | Dois trabalhadores na mesma conversa | A vez é serializada pela trava (aprovado). A configuração diverge (4.3) | 1 execução ativa por conversa, `count(travas)` ≤ 1. Com `AMBIENTE` divergente, uma instância se desliga |
| 4 | Trava vence durante chamada lenta | Possível com mídia ou Storage lentos (4.4) | Com transcritor de 200 s × 8, nenhum segundo `pegarTrava` dá true durante a execução |
| 5 | Reinício logo depois de uma ferramenta com efeito | **Reprova** (4.1) | Depois de matar entre `responder` e `marcarProcessadas`: 1 saída do agente, 1 chamado, passagem "interrompida" |
| 7 | Timeout do banco depois de uma escrita | Na escalada pós-agente, **reprova** (4.6). Em `marcarProcessadas`, aprova (`ErroDepoisDoAgente`) | Repos falso que grava e depois lança: nenhuma ferramenta repetida |
| 8 | Retry com resultado anterior desconhecido | Coberto só para exceção da IA (`:295`). Não há estado "em execução" persistido | Estado `tentativa_em` mais decisões impede a reexecução (correção 4.1b) |
| 16 | Cliente aciona várias criações de demanda | `abrir_chamado` de setor não deduplica. `sinalizar_nao_entendido` abre Triagem sem conferir se já existe (`ferramentas.ts:515-530`). Só o limite de volume (15 saídas/10 min) freia | 10 pedidos iguais em 10 min resultam em no máximo 1 demanda aberta por setor e assunto (precisa de chave: conversa + setor + título normalizado em 24 h) |
| 17 | Anthropic 429/5xx/timeout/recusa/truncada | 429/5xx/conexão: retry da fila (3×, backoff 20 s) e escalada na última tentativa. Recusa ou `max_tokens`: escalada (`executar.ts:166`). 4xx: escalada sem alerta (4.8) | Depois de 4 falhas 529: exatamente 1 aviso ao cliente e 1 Triagem. Com 401: 1 alerta crítico |
| 19 | WhatsApp desconectado com banco saudável | O batimento alerta como `critico` só por e-mail, a cada 30 min (`tarefas.ts:355-362`). Se o SMTP também falhar, fica só no painel. O agente "responde" e o envio falha, então a conversa é escalada | Alerta em até 2 min; `/saude` 503 com `whatsapp` |
| 20 | Banco saudável, fila parada | Se o pg-boss inteiro parar, o sinal `fila` envelhece (bom). Se só os consumidores de conversa estiverem presos, o sinal fica verde e o backlog é invisível (4.9) | Com 3 mensagens paradas, `/saude` 503 com `backlog` |
| 21 | Job preso mais de 2 min com outra execução ativa | `perguntasAssistenteParadas(2)` e `tarefasParadas(2)` reenfileiram, e a trava ou a reserva barra a duplicação (aprovado). A conversa fica de fora enquanto a trava vale (aprovado), mas 4.10 vale | Nenhuma execução dupla, `count(saídas)` por lote igual a 1 |
| 22 | Teto atingido por várias execuções simultâneas | Estouro limitado a 12 jobs em andamento (4.11). Abuso externo (4.2) | Com o teto a 1 centavo, nenhuma rodada nova abre (conferência por rodada) |
| 25 | Schema novo com contêiner antigo | As migrações são aditivas, mas o código antigo continua consumindo (4.3). Não há verificação de versão na partida | O trabalhador recusa partir se `schema_version` do banco for maior que a esperada, ou se outra instância de versão diferente estiver viva |
| 30 | Filas crescendo com recuperação parcial e terceiros intermitentes | Com Anthropic intermitente, cada conversa leva até ~4 tentativas × (60 s × 3) antes de escalar. As 4 vagas ficam ocupadas, o backlog cresce sem métrica e o batimento só age 3 min depois sem trava | Indicador de backlog e idade; escalada antecipada quando a taxa de erro da IA passar de 50% em 5 min (circuit breaker) |

## Árvores de falha (seção 20)

**C. Não perder mensagens recebidas**
- Webhook fora do ar ou recusado → depende da reentrega da Z-API [não verificável]
- Gravou e o enfileiramento falhou → batimento em 3 min [aprovado]
- Job falhou nas tentativas → batimento (2 devoluções) e depois a equipe [aprovado]
  - Batimento interrompido antes do passo C1 → **4.7**
  - Mais de 24 h → sai da consulta → **4.13**
- Mensagem marcada sem ser lida → `passarAEquipeSemResposta` relê tudo → **4.10**
- Contêiner antigo com ambiente diferente → resposta bloqueada e lote marcado → **4.3**
- Webhook roteado ao contêiner ligado ao outro banco → **4.3(b)** [hipótese]

**D. Não executar duas vezes operações não idempotentes**
- Exceção da IA depois de ferramenta → `contarDecisoesDesde` [aprovado]
- Queda do processo ou implantação depois de ferramenta → reexecução completa → **4.1**
- Erro de banco na escalada pós-agente → relança → **4.6**
- Trava vencida com a vez viva (mídia lenta) → duas vezes → **4.4**
- Batimento sem trava → Triagem e aviso em dobro → **4.10**
- Ferramentas sem chave de idempotência (`abrir_chamado` de setor, `responder`, `enviar_documento`) → causa comum de D

**F. Não deixar conversas sem resposta sem detecção**
- Trabalhador morto → só a faixa do painel; não há monitor externo → **4.9**
- IA fora (4xx) → Triagem silenciosa → **4.8**
- Recuperação quebrada com sinal verde → **4.7**
- Alerta de mensagem parada só no painel; mais de 24 h sem alerta → **4.13**
- Duas instâncias → **4.3**

**G. Não exceder limites de custo sem controle**
- Execuções simultâneas passam do teto → **4.11** (limitado)
- Abuso externo esgota o teto global → **4.2**
- Custo não registrado (falhas, modelo sem preço, transcrição nula) → **4.11**
- Retries pagos 3 vezes (timeout de 60 s) → **4.16**
- Alerta de 80% falha ou duplica → **4.12**
- Limite do workspace atingido → cai em 4xx sem alerta → **4.8**

**H. Recuperar o sistema depois de falhas e reinicializações**
- Reinício → trava presa 20 min + reexecução → **4.1**
- Contêiner antigo + migração nova → sem conferência de versão → **4.3** / cenário 25
- Restauração de cópia: `processada_em` volta ao estado da cópia. Mensagens não processadas nas 24 h anteriores à cópia seriam reprocessadas pelo batimento, com resposta atrasada e possivelmente repetida. A cópia restaurada também traz o esquema `pgboss` com jobs antigos [hipótese; não há procedimento de restauração no código]
- Pool de conexões esgotado na volta (dois contêineres) → **4.14**

## Não verificável / precisa de acesso

- Política de reentrega de webhook da Z-API quando o trabalhador responde 5xx ou fica fora (define se o cenário 2 perde mensagens).
- *Stop grace period* e estratégia de atualização do Easypanel/Swarm (start-first ou stop-first; se dois contêineres recebem o mesmo domínio). Isso define a frequência real de 4.1 e 4.3(b).
- `pool_size` do Supavisor do projeto de produção (4.14).
- Valor real de `teto_ia_usd`, preços configurados e limite de gasto do workspace "Producao" na Anthropic (4.2, 4.8).
- Cobrança pela Anthropic de requisições abortadas por timeout do cliente (4.11a, 4.16).
- Backups existentes (plano Pro: diários de 7 dias, segundo o manual; PITR?) e teste de restauração. Nada disso está no código.
- Retenção dos logs do Easypanel (investigação forense).
- Não rodei os testes com banco (`fila-vez.test.ts`, `mensagem-parada.test.ts`, `prazo-vez.test.ts`) por regra do briefing. As conclusões vêm da leitura do código e do código do pg-boss 10.4.2.
