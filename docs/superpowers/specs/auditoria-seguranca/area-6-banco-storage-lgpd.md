# Área 6: Banco (RLS, SECURITY DEFINER, grants), Storage, migrações, retenção/LGPD, implantação e cadeia de suprimentos

Commit auditado: `8242a24` (etapa-1). Leitura estática das 69 migrações, de `apps/*`, `packages/db`, `.github/workflows`, Dockerfiles, `docs/operacao.md` e do plano do ramo `atendimento-catalogo`. Nada foi executado contra banco, Supabase, Docker ou serviços externos. Script de varredura próprio (Node, só leitura) sobre `supabase/migrations` para listar tabelas, políticas, funções `security definer` e o estado final de `grant/revoke` de cada função.

## Resumo

O banco está bem fechado no que é sistemático: as **63 tabelas** de `public` têm RLS; nenhuma política é dada a `anon`/`public`; as 3 visões são `security_invoker`; as **271 funções `security definer`** (última versão de cada) têm `search_path` fixo; todas as 134 executáveis por `authenticated` têm guarda (conferi uma a uma pela primeira linha de checagem); as cerca de 120 funções do trabalhador e as variantes `*_de(p_usuario…)` estão revogadas de `authenticated`; o esquema `interno` não tem USAGE para os papéis da API. Os buracos estão no **ciclo de vida dos dados e na operação**:
1. o plano `atendimento-catalogo` reutiliza as versões `20261029000100`/`000200`, que já existem em produção (segundo fator). Com isso, a migração do catálogo e a extensão da anonimização provavelmente **não são aplicadas** ou travam o `db push`;
2. **o Storage não tem cópia nenhuma**, a restauração do Postgres nunca foi testada e, se for feita, reprocessa jobs e manda mensagens de novo;
3. a retenção declarada ("apaga conversas…") não corresponde à real: conversas, demandas, eventos, tarefas, auditoria, alertas e jobs ficam para sempre. A limpeza falha em silêncio e deixa arquivos órfãos sem varredura;
4. o painel trunca o histórico em 1000 mensagens e esconde as **mais novas**;
5. quem tem "Configurações: Sim" (sem ser administrador) reescreve as mensagens automáticas enviadas a todos os clientes.

O segundo fator ignorado pela RLS já está na Área 2 (2.1). Aqui só registro o complemento do lado do banco e do Storage.

## Achados

### 6.1 O plano do catálogo reutiliza as versões 20261029000100 e 20261029000200, que já estão aplicadas em produção   [Alta] [Provável]
- **Onde:** `supabase/migrations/20261029000100_seguranca_segundo_fator.sql` e `20261029000200_seguranca_arquivar_encerra_sessoes.sql` (já no `main`/etapa-1, commits `add9461` e `4ace61b`). Plano no ramo `atendimento-catalogo`, `docs/superpowers/plans/2026-10-27-atendimento-catalogo-aprendizado.md` (commit `c6fc1ad`), linhas 93-97: cria `20261029000100_atendimento_catalogo.sql`, `20261029000200_atendimento_catalogo_anonimizar.sql`, `…000300` a `…000500`.
- **Evidência:** o Supabase CLI usa o prefixo numérico como chave em `supabase_migrations.schema_migrations`. As versões 000100 e 000200 já estão registradas no banco que recebeu a segurança do login. Além disso, o ramo do plano saiu de `db10f73`, antes dessas migrações (`git diff etapa-1 atendimento-catalogo -- supabase/migrations` mostra as duas como "removidas").
- **Pré-condições:** executar o plano como está escrito, fazer merge no `main` e rodar `supabase db push` (deploy.yml:27 e :50).
- **Como acontece:**
  1. Depois do merge, o repositório tem dois arquivos com a versão 20261029000100 (e dois com 000200).
  2. No `db push`, a versão já consta como aplicada. O resultado provável é que o arquivo do catálogo seja ignorado, ou que o CLI recuse por versão duplicada ou fora de ordem. Os dois desfechos são ruins.
  3. Se for ignorado, o trabalhador novo sobe esperando as tabelas do catálogo e a anonimização estendida (000200), que não existem. A LGPD do catálogo fica sem efeito em silêncio.
  4. No banco local (`db reset`), os dois arquivos de mesma versão quebram a montagem dos testes.
- **Impacto:** deploy do Atendimento (etapa 1 da produção) parcial ou travado. A anonimização dos dados novos não é aplicada.
- **Correção proposta:** renumerar no plano para versões maiores que a última aplicada (ex.: `20261030000100…000500`). Acrescentar ao CI um passo que falhe com prefixos duplicados (`ls supabase/migrations | cut -c1-14 | sort | uniq -d`) e com arquivo novo cuja versão seja menor ou igual à maior já presente no `main`.
- **Teste de regressão:** um teste em CI (shell ou vitest) que lê `supabase/migrations`, afirma que os prefixos são únicos e estritamente crescentes e que nenhum arquivo novo do PR tem versão menor ou igual à maior do ramo de destino.
- **Nota relacionada:** as migrações estão datadas no futuro (até 29/10/2026; hoje é 08/10). Qualquer `supabase migration new` feito hoje gera `20261008…`, que fica **antes** das já aplicadas. O CLI então recusa sem `--include-all` ou aplica fora de ordem. Mesmo risco, causa comum.

### 6.2 Sem cópia do Storage, restauração não testada e restaurar o banco reenvia mensagens   [Alta] [Confirmado (ausência no código) / Provável (efeito da restauração)]
- **Onde:** `docs/operacao.md:20` (a única cópia citada é a diária do plano Pro); `scripts/` só tem `env-local.sh`; não há rotina, workflow nem documento de restauração. `deploy.yml:27,50` roda `supabase db push` sem cópia antes. `ARQUITETURA-ATENDIMENTO.md:331` lista "cópia semanal cifrada e monitor externo" como ainda não feitos. A chave `ACESSOS_PORTAIS_CHAVE` existe só no Easypanel (`docs/operacao.md:43,527`).
- **Evidência:**
  - Os buckets `anexos`, `documentos` e `tarefas` (`20260927000200:258`, `20260928000500:129`, `20261016000100:161`) não aparecem em nenhuma rotina de cópia. A cópia diária do Supabase cobre o Postgres, não os objetos do Storage (comportamento do Supabase, não do código; não verificável aqui).
  - O estado da fila pg-boss mora no mesmo Postgres (`apps/trabalhador/src/fila.ts:63`).
- **Pré-condições:** perda ou corrupção (exclusão acidental, bug de limpeza, conta comprometida) ou indisponibilidade prolongada.
- **Como acontece (restauração):**
  1. O banco volta à cópia de até 24 h atrás (RPO de até 24 h, sem PITR).
  2. As mensagens `saida` com `status_envio='pendente'` e as `entrada` com `processada_em is null` naquele instante voltam junto com os jobs `enviar-mensagem`/`processar-conversa` em estado `created`/`active`.
  3. O trabalhador reprocessa: o cliente recebe de novo respostas já mandadas e o agente responde de novo. As reservas (`envio_reservado_em`, `reservar_envio_radar`, `reservar_aviso_tarefa`) também voltam ao estado antigo, e envios do Radar e avisos podem sair outra vez.
  4. Mensagens recebidas entre a cópia e a falha se perdem: a Z-API não reentrega o histórico.
  5. Os arquivos do Storage não voltam. Se forem apagados por engano, a perda é definitiva.
  6. Perder a `ACESSOS_PORTAIS_CHAVE` deixa todas as senhas de portais ilegíveis.
- **Impacto:** perda irreversível de anexos e documentos dos clientes. Mensagens duplicadas aos clientes depois de qualquer restauração. Ninguém sabe quanto tempo leva para voltar (RTO).
- **Correção proposta:**
  - Cópia periódica cifrada do Postgres **e** dos 3 buckets, guardada fora do Supabase.
  - `db push` de produção só depois de uma cópia (`pg_dump` no workflow, antes da linha 50).
  - Procedimento de restauração escrito em `docs/operacao.md`, com um passo que, depois de restaurar, marca como `falhou` as saídas `pendente` mais antigas que a cópia, esvazia a fila (`pgboss.job` em `created/retry`) e só então liga o trabalhador.
  - Guardar a `ACESSOS_PORTAIS_CHAVE` em cofre separado, com dono definido.
- **Teste de regressão:** um ensaio de restauração (num projeto descartável) com uma conversa com saída `pendente` e job `enviar-mensagem` criado. Depois do procedimento, o envio não pode acontecer, e o anexo de teste precisa ser baixável com hash igual.

### 6.3 Retenção declarada diferente da real e anonimização que não alcança tudo   [Média] [Confirmado]
- **Onde:** `apps/trabalhador/src/retencao.ts:10-41`; `docs/operacao.md:526` ("conversas, arquivos e registros do agente são apagados automaticamente depois de 1 ano"); `ARQUITETURA-ATENDIMENTO.md:243` ("Apaga conversas…"); `20261027000500_revisao_anonimizar_contato.sql:14-73`.
- **Evidência:**
  - `limparRetencao` apaga só `mensagens` (com os arquivos), `decisoes_agente`, `assistente_mensagens`, `simulacoes_agente` e `sugestoes_resposta`. Nunca apaga:
    - `conversas` (telefone, `motivo_pessoa`);
    - `chamados.titulo`/`resumo`, `chamado_eventos.texto` (notas);
    - `conversa_eventos.texto`;
    - `agente_tarefas` (pedido, resultado), `agente_pendencias` (pergunta, resposta), `agente_sugestoes`, `pre_analises_nota`;
    - `agente_tarefa_avisos.mensagem`, `radar_envios.texto`, `pedidos_fora_do_acesso`, `alertas.mensagem` (com telefone);
    - `auditoria_acessos` (guarda "antes/depois" de cadastros e orientações, `20260927000400:3-12`);
    - `uso_ia`;
    - os jobs do pg-boss (7 dias no padrão, com o eco "enviada por mim", que traz telefone e texto, `servidor.ts:59`).
  - `anonimizar_contato` também não alcança `alertas`, `radar_envios.texto`, `agente_tarefa_avisos.mensagem`, `orientacoes_agente` criadas a partir da conversa nem os jobs da fila. O aviso de privacidade é marcado como "enviado" mesmo quando o texto está vazio (`processar-conversa.ts:227-231`), então as conversas abertas antes de o dono preencher o texto nunca recebem o aviso.
- **Pré-condições:** nenhuma (é o comportamento normal).
- **Como acontece:** depois de 1 ano, a conversa, o resumo da demanda e o pedido da tarefa continuam legíveis no painel para quem tem acesso, contra o que o manual declara ao titular e ao escritório.
- **Impacto:** divergência entre o declarado e o real. Dados pessoais guardados sem prazo. Exposição maior em caso de vazamento. Ponto técnico demonstrável; a consequência jurídica precisa de avaliação especializada.
- **Correção proposta:** estender `limparRetencao` (em lotes) a `chamados` concluídos há mais de 1 ano (`titulo`/`resumo` anonimizados), `chamado_eventos`, `conversa_eventos`, `agente_*` das demandas antigas, `alertas` lidos com mais de 90 dias, `pedidos_fora_do_acesso`, `radar_envios` enviados e `auditoria_acessos` de cadastros (ou mascarar o telefone/nome em `detalhes`). Configurar `deleteAfterDays`/`archiveCompletedAfterSeconds` do pg-boss explicitamente. Alternativa: corrigir o manual para dizer o que realmente é apagado. Fazer `anonimizar_contato` limpar também `alertas` (por `like '%'||v_tel||'%'`), `radar_envios.texto` e `agente_tarefa_avisos.mensagem` das tarefas dele. Só gravar `aviso_lgpd_enviado_em` quando o aviso for de fato enviado.
- **Teste de regressão:** um teste do trabalhador semeia uma linha antiga em cada tabela listada, roda `limparRetencao(agora + 1 ano + 1 dia)` e afirma que não sobra texto pessoal. Um pgTAP de `anonimizar_contato` com alerta, envio do Radar e aviso de tarefa contendo o telefone afirma que nenhum deles contém o telefone depois.

### 6.4 Arquivos órfãos sem varredura: a limpeza só encontra o que a linha ainda aponta   [Média] [Confirmado]
- **Onde:** `retencao.ts:18-24` (acha arquivos só por `mensagens.arquivo_path`); `20261027000500:33-34` (`anonimizar_contato` zera `arquivo_path` e devolve os caminhos); `apps/painel/src/app/(painel)/clientes/acoes.ts:96-111` (se a fila e a remoção imediata falham, só grava `remocao_pendente` na auditoria, sem reprocessamento); `clientes/cadastros-acoes.ts:116-122` (`excluirDocumento` apaga a linha e ignora o erro do `remove`); `cadastros-acoes.ts:80-82` (upload antes do insert; se o insert falha, o objeto fica sem dono).
- **Evidência / como acontece:**
  1. O administrador anonimiza o contato e a linha perde `arquivo_path`.
  2. O Storage está fora do ar: a fila e a remoção imediata falham, e só fica o registro de auditoria.
  3. Nenhuma rotina volta a esse registro, e a retenção anual não encontra mais o arquivo, porque nenhuma linha o referencia.
  4. Resultado: o anexo do titular fica para sempre.
  - O mesmo acontece com o upload de documento cujo insert falhou e com o documento excluído quando o Storage falhou.
  - Na retenção, o arquivo da mensagem é apagado, mas `agente_tarefa_arquivos` (bucket `anexos`, mesmo caminho) não recebe `removido_em`. O download da tarefa passa a responder 404 em vez de 410.
- **Impacto:** retenção e eliminação LGPD incompletas, sem que ninguém perceba.
- **Correção proposta:**
  - Rotina semanal que lista os objetos de cada bucket e apaga os que não têm linha correspondente (`mensagens.arquivo_path`, `documentos_empresa.arquivo_path`, `agente_tarefa_arquivos.caminho`) e têm mais de 24 h.
  - Reprocessar automaticamente as auditorias `remocao_pendente`.
  - Em `excluirDocumento`, remover o objeto primeiro (ou enfileirar em `remover-arquivos`) e checar o erro.
- **Teste de regressão:**
  - Criar um objeto sem linha e rodar a varredura: o objeto sai.
  - Criar um registro `remocao_pendente` e rodar o reprocessamento: os objetos saem e o registro é marcado como resolvido.

### 6.5 Limpeza diária falha em silêncio e uma falha trava todas as etapas   [Média] [Confirmado (sem registro, sequência) / Hipótese (URL longa)]
- **Onde:** `apps/trabalhador/src/principal.ts:125-132`; `retencao.ts:17-41`.
- **Evidência:**
  - O retorno de `limparRetencao` (contagens) é descartado (`principal.ts:126`) e nada é gravado (nem `sinais_vida`, nem auditoria, nem log de sucesso).
  - As etapas são sequenciais: se `midia.remover` ou o `delete` das mensagens lança erro, as de `decisoes_agente`, `assistente_mensagens`, `simulacoes_agente` e `sugestoes_resposta` não rodam.
  - A fila `limpeza-retencao` tem `retryLimit: 2` (`fila.ts:85-87`) e o job falhado não gera alerta.
  - `delete().in('id', <500 UUIDs>)` monta uma URL de cerca de 19 KB no PostgREST. Se o gateway da nuvem limitar o tamanho da URL, todo lote dá erro. Hipótese: não verificável sem o ambiente; o teste `apps/trabalhador/test/retencao.test.ts` usa poucas linhas.
  - `decisoes_agente` é apagada num único `delete` sem lote, devolvendo todos os ids.
- **Impacto:** a retenção pode parar por meses sem ninguém saber (14: "se o sistema registra os resultados das rotinas de limpeza": **reprovado**).
- **Correção proposta:**
  - Gravar o resultado (contagens e duração) em `sinais_vida` (`componente='retencao'`) e em log; falha vira `alertas` crítico.
  - Separar as etapas em `try` independentes.
  - Lotes de 100 ids (ou apagar via RPC `limpar_mensagens_antigas(p_corte, p_lote)` que devolve os caminhos), e lote também em `decisoes_agente`.
- **Teste de regressão:** com 1.200 mensagens antigas com arquivo, a limpeza apaga todas e grava o sinal com a contagem certa. Com `remover` simulando falha, as outras etapas ainda rodam e um alerta crítico é criado.

### 6.6 O painel mostra só as 1000 primeiras mensagens da conversa e esconde as mais novas   [Média] [Provável]
- **Onde:** `apps/painel/src/app/(painel)/atendimento/[id]/conversa-aberta.tsx:75` (`sb.from('mensagens')…eq('conversa_id', id).order('criado_em')`, sem `range`/`limit`); `supabase/config.toml:18` (`max_rows = 1000`, que é também o padrão da nuvem; a configuração de produção não está no repositório).
- **Evidência / como acontece:**
  1. `conversas.telefone` é único (`20260927000200:12`): cada contato tem **uma** conversa para sempre, e as mensagens ficam 1 ano.
  2. Um cliente ativo passa de 1000 mensagens (texto, áudios e ecos).
  3. O PostgREST corta em `max_rows` **na ordem ascendente**, então vêm as 1000 mais antigas.
  4. A equipe não vê as mensagens mais recentes, inclusive a que precisa responder, e não aparece nenhum aviso.
- **Impacto:** conversa sem resposta ou resposta errada sem que ninguém perceba (objetivo F). Carga desnecessária de até 1000 linhas a cada abertura.
- **Correção proposta:** buscar `order('criado_em', { ascending: false }).limit(200)` e inverter no servidor, com "carregar anteriores" por cursor (`criado_em < x`). O índice `mensagens_conversa_idx (conversa_id, criado_em)` já atende.
- **Teste de regressão:** um e2e semeia 1.100 mensagens numa conversa e afirma que a última aparece na tela e que "carregar anteriores" traz a primeira.

### 6.7 "Configurações: Sim" (sem ser administrador) reescreve as mensagens automáticas enviadas aos clientes   [Média] [Confirmado]
- **Onde:** `20261004000500_painel_v2_configuracoes.sql:6-9` (UPDATE em `configuracoes` com `tem_permissao('configuracoes','sim')`); `20261006000100_painel_v2_gastos_colunas.sql:52-64` (o gatilho `configuracoes_so_admin` protege teto, alertas, modelos e pausa, mas **não** a coluna `mensagens`, `aviso_login` nem horários); `docs/operacao.md:439`.
- **Evidência:** `mensagens` guarda `aviso_lgpd`, `fora_do_horario`, `agente_pausado` e `ia_indisponivel` (`20260927000100:103-108`), enviadas pelo trabalhador sem revisão.
- **Pré-condições:** usuário interno com "Configurações: Sim", ou a sessão dele roubada (sem segundo fator, que não se aplica a não administradores).
- **Como acontece:** `PATCH /rest/v1/configuracoes?id=eq.1` com `{"mensagens": {..., "fora_do_horario": "Pague o boleto atualizado em <link>"}}`. A partir daí, todo cliente que escreve fora do expediente recebe o texto pelo número oficial do escritório.
- **Impacto:** mensagem em massa com efeito externo, a partir de um privilégio que o manual descreve como "não é o mesmo que ser administrador". Há trilha em `auditoria_acessos` (gatilho em `configuracoes`), mas não há bloqueio.
- **Correção proposta:** incluir `mensagens` (ou pelo menos `aviso_lgpd`, `fora_do_horario`, `ia_indisponivel`, `agente_pausado`) na lista do gatilho `configuracoes_so_admin`, ou exigir administrador com aal2 para essas chaves. Avisar o administrador por alerta quando alguma mudar.
- **Teste de regressão:** um pgTAP como usuário com `configuracoes=sim` (não administrador) tenta mudar `mensagens->fora_do_horario` e deve receber erro. Mudar `horario_fim` continua permitido.

### 6.8 Implantação: `db push` sem cópia, CLI "latest", ramo livre no disparo manual e ordem esquema→contêiner sem conferência   [Média] [Confirmado]
- **Onde:** `.github/workflows/deploy.yml:24-27,45-50` (`supabase/setup-cli@v1` com `version: latest`; o `checkout` de produção sem `ref`, ou seja, o ramo escolhido no `workflow_dispatch`); `deploy.yml:28,51` (os webhooks do Easypanel reconstroem a imagem pelo ramo configurado lá, não pelo SHA testado; não verificável no repositório); `.github/workflows/cenarios.yml:23` (`echo "ANTHROPIC_API_KEY=${{ secrets… }}" >> .env`, interpolação direta do segredo); ações por etiqueta (`@v4`, `@v1`), não por hash; `FROM node:22-slim` sem digest.
- **Como acontece (cenário 25):**
  1. `db push` aplica a migração nova (ex.: `20261029000100`) e só depois os contêineres são trocados.
  2. Na janela entre um e outro, ou se um dos dois webhooks falhar (`curl … && curl …`: se o primeiro falha, o painel não é publicado), o painel antigo, que não tem a tela de segundo fator, chama `salvar_usuario` e `arquivar_cadastro` com aal1 e recebe "Confirme o código…". O administrador perde a gestão de pessoas até o painel novo subir.
  3. No sentido contrário, uma versão de CLI nova e não testada aplica as migrações de produção.
- **Impacto:** falha operacional no deploy e possibilidade de aplicar código não revisado (de outro ramo) em produção, se a aprovação do ambiente `producao` for dada sem olhar o ramo.
- **Correção proposta:**
  - Fixar a versão do CLI e as ações por SHA.
  - Fazer `checkout` com `ref: main` (ou recusar `github.ref != 'refs/heads/main'`).
  - `pg_dump` antes do `db push`.
  - Publicar trabalhador e painel por imagem marcada com o SHA testado.
  - Migrações sempre "expandir antes, contrair depois" (sem remover o que o contêiner antigo usa).
  - Em `cenarios.yml`, passar o segredo por `env:` e `printf '%s' "$ANTHROPIC_API_KEY"`.
- **Teste de regressão:** um job de CI "compatibilidade" sobe o banco com as migrações do PR e roda a suíte e2e do painel e o teste de fumaça do trabalhador **da versão anterior** (tag do último deploy). Tem de passar.

### 6.9 Buckets `anexos` e `documentos` sem limite de tamanho e de tipo; o envio de documento carrega o arquivo inteiro em Base64   [Média] [Provável]
- **Onde:** `20260927000200:258` e `20260928000500:129` (sem `file_size_limit` nem `allowed_mime_types`; só `tarefas` tem, `20261016000100:161-162`); `apps/trabalhador/src/envio.ts:53-56,68` (`ler` do arquivo inteiro e `Buffer.toString('base64')`); `apps/painel/next.config.ts:16` (15 MB só na Server Action). As políticas `documentos_envio`/`anexos_envio` deixam enviar direto pela API do Storage, sem passar pelo limite do painel.
- **Como acontece:** um usuário com "Clientes: editar" sobe pela API um PDF de cerca de 50 MB (limite global padrão; o de produção não está no repositório) em `documentos/clientes/<id>/…` e marca `ia_pode_enviar`. Quando o agente envia, o trabalhador guarda os bytes, a string Base64 (+33%) e o JSON da Z-API ao mesmo tempo. Com 4 conversas em paralelo na máquina pequena, a memória pode estourar e o contêiner reinicia.
- **Correção proposta:** `update storage.buckets set file_size_limit = 15728640, allowed_mime_types = array[...]` para `anexos` e `documentos`; recusar no trabalhador um documento acima de X MB antes de ler.
- **Teste de regressão:** um pgTAP afirma `file_size_limit` e `allowed_mime_types` não nulos nos 3 buckets. Um vitest de `enviarDocumentoDoSistema` com objeto grande deve recusar sem chamar `ler`.

### 6.10 `documentos_empresa.arquivo_path` livre: além do envio errado (1.3), a exclusão apaga o arquivo de outra empresa   [Média] [Confirmado]
- **Onde:** `20260928000500:66-76,88-92` (INSERT/UPDATE com `editar_clientes`, sem amarrar `arquivo_path` a `clientes/<cliente_id>/`); `apps/painel/src/app/(painel)/clientes/cadastros-acoes.ts:116-122`.
- **Evidência / como acontece:** o envio indevido ao contato de A já está na Área 1 (1.3). O complemento do lado do Storage:
  1. O editor faz `PATCH documentos_empresa` de A com `arquivo_path='clientes/<B>/contrato.pdf'`.
  2. Mais tarde, o administrador exclui "o documento de A" pela tela.
  3. `excluirDocumento` remove `clientes/<B>/contrato.pdf` do bucket.
  4. Como não há cópia do Storage (6.2), o documento de B se perde para sempre, e duas linhas que apontam para o mesmo objeto se quebram juntas.
- **Correção proposta:**
  - Usar `check (arquivo_path like 'clientes/' || cliente_id || '/%')`, aplicado com `NOT VALID` seguido de `validate`.
  - Revogar `update (arquivo_path, cliente_id)` de `authenticated`.
  - Fazer o upload por RPC que confira que o objeto existe no prefixo da empresa.
- **Teste de regressão:** um pgTAP faz insert e update com caminho de outra empresa, que devem falhar. Com o caminho correto, a operação passa.

### 6.11 Índices que faltam para o crescimento (`chamado_eventos`, `decisoes_agente`) e RLS por linha cara   [Baixa] [Confirmado]
- **Onde:** não existe índice em `chamado_eventos(chamado_id)`, usado pela política `pode_ver_chamado(chamado_id)` (`20260927000200:155`) e pelas junções do painel (`conversa-aberta.tsx:76-79,90`). `decisoes_agente` só tem `(conversa_id, turno) where turno is not null` (`20261005000200`), que não serve para `eq('conversa_id')` sem filtro de turno (`conversa-aberta.tsx:81`), para o `delete` por `conversa_id` da anonimização nem para o `lt('criado_em')` da retenção. Também faltam `assistente_mensagens(criado_em)` e `alertas(setor_id/usuario_id)`.
- **Impacto:** leitura sequencial das maiores tabelas a cada conversa aberta e na limpeza. As políticas `using (pode_ver_conversa(conversa_id))` chamam uma função `security definer` por linha (nível, horário, admin). Isso pesa no Realtime (cada mudança é avaliada para cada assinante) e com históricos longos.
- **Correção proposta:** `create index on chamado_eventos (chamado_id, criado_em)`, `create index on decisoes_agente (conversa_id, criado_em)`, `create index on decisoes_agente (criado_em)`, `create index on assistente_mensagens (criado_em)`. Avaliar envolver as funções em `(select …)` quando o argumento não depende da linha.
- **Teste de regressão:** um pgTAP com `explain (format json)` das consultas do painel sobre 50 mil linhas afirma "Index Scan" em `chamado_eventos` e `decisoes_agente`.

### 6.12 Funções antigas ainda executáveis por `anon` e com `search_path = public`   [Baixa] [Confirmado]
- **Onde:** sem `revoke … from anon`, e portanto com o EXECUTE padrão do Supabase (`supabase/config.toml:19-23`, `auto_expose_new_tables`):
  - 15 funções: `eh_usuario_ativo`, `eh_admin`, `meus_setores`, `pode_ver_chamado`, `pode_ver_conversa`, `marcar_alerta_lido`, `assumir_conversa`, `devolver_ao_agente`, `registrar_resposta`, `nota_interna`, `transferir_chamado`, `concluir_chamado`, `anonimizar_contato`, `definir_preco`, `vincular_contato_conversa`;
  - os gatilhos `registrar_auditoria`, `usuarios_niveis_depois_inserir`, `usuarios_permissoes_antes_alterar`, `usuario_permissoes_espelhar`, `configuracoes_so_admin`.
  - Todas recusam ou não fazem nada com `auth.uid()` nulo: conferi a guarda de cada uma, e funções de gatilho não podem ser chamadas fora de gatilho.
  - 20 funções antigas usam `search_path = public` em vez de `''`.
  - `eh_telefone_do_assistente(text)` é executável por qualquer `authenticated` sem checar pessoa ativa (`20260929000400:35-36`), o que funciona como oráculo de telefone da equipe. Hoje é inócuo, porque o cadastro aberto está desligado (`config.toml:175`).
- **Correção proposta:** uma migração com `revoke execute … from public, anon` para essas 21 funções, `alter function … set search_path = ''` (qualificando os nomes) e `revoke execute on eh_telefone_do_assistente from authenticated` (só `service_role`).
- **Teste de regressão:** um pgTAP que lista `pg_proc` de `public` com `prosecdef` e `has_function_privilege('anon', oid, 'execute')`, com allowlist só `{aviso_login}`.

### 6.13 Dependência vulnerável conhecida: `nodemailer 6.10.1`   [Baixa] [Provável]
- **Onde:** `pnpm-lock.yaml:2352` (`nodemailer@6.10.1`), `apps/trabalhador/package.json` (`^6.9.0`).
- **Evidência:** o aviso GHSA-mm7p-fcc7-pg87 (endereço com parte local entre aspas contendo `@` pode ir para outro domínio) atinge versões abaixo de 7.0.7, segundo o que eu conheço; não verificado sem internet. Os destinatários vêm de `configuracoes.email_alertas` e do cadastro de pessoas (dados internos), então a exploração é improvável. As demais versões do lockfile (`next@15.5.26`, `react@19.3.0`, `fastify@5.12.5`, `pg-boss@10.4.2`) estão depois das correções que conheço (CVE-2025-29927 e RSC/"React2Shell", dez/2025).
- **Correção proposta:** atualizar para `nodemailer@^7.0.11`, rodar `pnpm audit` no CI e quebrar o build em alta/crítica.
- **Teste de regressão:** passo de CI `pnpm audit --prod --audit-level high` sem achados.

### 6.14 Higiene de repositório e grants amplos   [Baixa] [Confirmado / Hipótese (introspecção)]
- `.gitignore` ainda não cobre `.playwright-mcp/` (capturas do painel de teste, possivelmente com dados de clientes), `*.bat`, `*.ps1` nem `.vez-supabase.txt`. Hoje estão fora do índice (`git status`), mas um `git add .` os publicaria. O `.dockerignore` já cobre tudo isso (commit `7aff1a5`).
- As tabelas de base e do Radar mantêm os grants padrão de `anon`/`authenticated` (SELECT, e em várias também INSERT/UPDATE/TRUNCATE); a RLS nega. Funciona, mas qualquer política permissiva criada por engano no futuro abriria a tabela. O PostgREST (`/rest/v1/`) e o `graphql_public` podem expor o esquema a quem tem a chave pública (hipótese: depende da configuração da nuvem).
- **Correção:** completar o `.gitignore`. `revoke insert, update, delete, truncate on all tables in schema public from anon` e `alter default privileges … revoke … from anon`.
- **Teste:** um pgTAP com allowlist do que `anon` pode em `public` (nada além de `aviso_login`).

### 6.15 Remissões (já relatadas por outras áreas, conferidas do lado do banco)
- **Área 2, 2.1 (Alta):** a RLS e quase todas as RPCs ignoram o `aal`. Complemento do banco:
  - as políticas do Storage `anexos_leitura`/`documentos_leitura` (`20260927000200:260-261`, `20260928000500:130-131`) também valem com aal1, então a sessão só com senha de administrador baixa **todos** os anexos e documentos;
  - `anonimizar_contato` (`20261027000500:21`, só `eh_admin()`) e `excluir_cadastro_definitivo` (`20261002000100:164`) são destrutivas e irreversíveis sem aal2, e não há cópia do Storage (6.2);
  - a política `escrita_admin` de `usuarios`/`usuario_setores`/`usuario_permissoes` (`20260927000100:166,170`; `20261004000100:59`) permite contornar o fator de `salvar_usuario` e `definir_ver_acessos` com PATCH direto. O comentário em `20261029000100:6-7` confirma que a escolha foi deliberada.
- **Área 2, 2.9:** o painel continua com a `DATABASE_URL` do dono do banco para o pg-boss (`apps/painel/src/lib/fila.ts:9`; `deploy/painel.env.example`). As chaves do trabalhador saíram do painel (`9fe0974`), mas esta ficou.
- **Área 1, 1.3:** `documentos_empresa.arquivo_path` (ver 6.10 para o efeito no Storage).

## Tabela-resumo: tabela → RLS → políticas (estado final das 69 migrações)

"ativos" = `eh_usuario_ativo()` (ativo e no horário). "revogado" = `revoke insert, update, delete` de `authenticated`/`anon` (às vezes também de `service_role`). Nenhuma política para `anon` ou `public`. Nenhum `disable`/`force row level security`.

| Tabela | RLS | SELECT | Escrita pelo navegador | Observação |
|---|---|---|---|---|
| usuarios | sim | ativos (todos veem e-mail, telefone, observações) | ALL `eh_admin()` | sem aal2 (2.1); gatilhos dono, permissões, arquivar→sessões |
| usuario_setores, usuario_permissoes | sim | ativos | ALL `eh_admin()` | idem |
| permissao_niveis | sim | `true` (authenticated) | revogado | catálogo, sem dado pessoal |
| setores, servicos | sim | ativos | ALL admin; INS/UPD `configuracoes=sim` | excluir só admin |
| feriados, respostas_prontas | sim | ativos | ALL admin ou `configuracoes=sim` | |
| configuracoes | sim | `configuracoes=sim` (+ admin) | UPD `configuracoes=sim`; gatilho limita colunas | `mensagens` livre (6.7) |
| clientes, contatos | sim | ativos | INS/UPD `editar_clientes`; DEL admin | `ativo` só por função (`20261027000300`) |
| cliente_responsaveis, cliente_servicos, contato_clientes | sim | ativos | INS/UPD/DEL `editar_clientes` | |
| parceiros_grupos, parceiros_unidades, produtos | sim | ativos | INS/UPD `editar_clientes`; DEL admin | |
| documentos_empresa | sim | ativos (todas as empresas) | INS/UPD `editar_clientes`; DEL admin | `arquivo_path` livre (6.10) |
| precos | sim | ativos | revogado (`definir_preco`) | |
| cliente_inscricoes_st | sim | ativos | INS/UPD/DEL `editar_clientes` | |
| cliente_acessos | sim | ativos, só colunas sem a cifra | revogado (funções com aal2) | `revoke all … service_role` + grant por coluna |
| contato_cliente_setores | sim | ativos | revogado | |
| conversas, mensagens, decisoes_agente, conversa_eventos | sim | `pode_ver_conversa` | revogado | Realtime: conversas, mensagens |
| chamados, chamado_eventos | sim | `pode_ver_chamado` | revogado | Realtime: chamados |
| conversa_leituras | sim | própria + ativo | INS/UPD própria + `pode_ver_conversa`; DEL revogado | |
| sugestoes_resposta | sim | própria + `pode_ver_conversa` | revogado | apagada em 1 dia |
| assistente_mensagens | sim | própria + ativo | INSERT própria + `tem_nivel('assistente','site')` | Realtime |
| uso_ia, auditoria_acessos, sinais_vida | sim | admin | revogado | nunca limpas |
| alertas | sim | admin / própria / setor com nível | revogado | |
| orientacoes_agente, orientacoes_agente_versoes | sim | `treinar_agente` | revogado (funções + gatilho) | |
| simulacoes_agente | sim | própria + `treinar_agente` | revogado | Realtime; 30 dias |
| agentes, agente_contatos_teste, agente_regras_assunto, agente_mudancas, agente_skills, agente_skill_versoes, agente_skill_arquivos | sim | `pode_ver_agentes` | revogado (skills também de `service_role`) | |
| pre_analises_nota | sim | `pode_ver_chamado` + `notas>=ver` | revogado (+ `service_role`) | |
| agente_sugestoes, agente_tarefas | sim | `pode_ver_sugestoes_do_chamado` | revogado (+ `service_role`) | |
| agente_tarefa_arquivos, agente_pendencias, agente_tarefa_eventos | sim | `pode_ver_tarefa` | revogado (+ `service_role`) | |
| agente_tarefa_avisos | sim | admin ou própria | revogado (+ `service_role`) | |
| pedidos_fora_do_acesso | sim | admin | revogado | |
| certificado_avisos, drive_conta, tarefas_guarda | sim | ativos | revogado | |
| radar_config, radar_fontes, radar_giros, radar_novidades, radar_envios, radar_avisos | sim | `pode_ver_agentes` | sem política de escrita (RLS nega; grants padrão ficam, 6.14) | |
| travas_trabalhador | sim | nenhuma | `revoke all` de anon/authenticated | só `service_role` |

**Storage (`storage.objects`):**

| Bucket | Público | Leitura | Envio | Excluir/alterar | Limites |
|---|---|---|---|---|---|
| anexos | não | `pode_ver_conversa(pasta[2])`: o caminho é ligado à conversa | idem | sem política (só serviço) | nenhum (6.9) |
| documentos | não | **qualquer ativo** (todas as empresas) | `pasta[1]='clientes'` + `editar_clientes` (a pasta[2] não é conferida) | DEL admin; sem UPDATE (sem sobrescrita) | nenhum (6.9) |
| tarefas | não | **sem política**: só URL assinada pela rota do servidor depois de `pode_ver_tarefa` | `pode_mexer_na_tarefa(tarefa_do_caminho)` | só serviço | 10 MB + lista de tipos |

URLs assinadas: 60 s em `api/arquivos/route.ts:11` (com a sessão, então o RLS decide), `api/documentos/route.ts:13` (com a sessão) e `api/tarefas/arquivo/route.ts:44` (serviço, depois de conferir tarefa, nota e conversa). No trabalhador, `urlAssinada` não é chamada por ninguém: os documentos vão em Base64.

**Realtime:** `mensagens`, `conversas`, `chamados` (`20260927000300:32`), `assistente_mensagens` (`20260929000400:22`) e `simulacoes_agente` (`20260930000100:71`). Todas têm política de SELECT, que o Realtime avalia por assinante. Os eventos DELETE (retenção de `mensagens`) levam só o id para quem escuta `event:'*'` (comportamento do Supabase; observação já registrada antes). Nada vaza conteúdo entre empresas pelo Realtime.

**pg-boss:** esquema `pgboss` no mesmo banco. Localmente, a API expõe só `public` e `graphql_public` (`config.toml:13`), e o Supabase não dá USAGE de esquemas novos a `anon`/`authenticated`. Na nuvem, não é verificável (ver final).

## Tabela-resumo: funções SECURITY DEFINER (271, última versão de cada)

| Grupo | Qtde | search_path | revoke anon | Executável por authenticated | Confere auth / permissão |
|---|---|---|---|---|---|
| RPCs e auxiliares do painel com guarda (`pode_ver_*`, `tem_*`, `eh_*`, `exigir_acesso`, `demanda_para_agir`, `interno.tarefa_da_pessoa`, `interno.novidade_da_pessoa`, `eh_dono`, `exigir_segundo_fator`) | 113 | todas fixas (`''`, exceto as antigas) | sim | sim | **sim**: conferido nas 134 (guarda na primeira linha ou no auxiliar) |
| RPCs antigas sem `revoke` de anon (6.12) | 15 | `public` | **não** | sim | sim (recusam com `auth.uid()` nulo) |
| Gatilhos (`registrar_auditoria`, permissões, `configuracoes_so_admin`, `chamados_*`, `encerrar_sessoes_ao_arquivar`…) | cerca de 20 | fixas | parte não | não chamáveis fora de gatilho | n/a |
| `aviso_login` | 1 | `''` | concedida a anon de propósito | sim | devolve só o recado público |
| Do trabalhador / só serviço (`pegar_trava`, `marcar_reenfileirada`, `conversas_com_mensagem_parada`, `*_tarefa` do trabalhador, Radar, `salvar_pre_analise`, `iniciar_conducao`, `definir_preco_agente`, `cadastrar_produto_agente`, `contato_respondeu_pendencias`…) | cerca de 100 | fixas | sim | **não** (revogada) | confiam nos IDs, mas só a chave de serviço chama |
| Recebem `p_usuario` (`eh_admin_de`, `usuario_liberado`, `tem_nivel_de`, `nivel_de`, `pode_ver_*_de`, `horario_permite`, `agentes_para_pedir_de`, `pedir_ao_agente_de`, `responder_pendencia_de`, `pendencias_repassadas_de`, `eh_dono_de`) | 14 | fixas | sim | **não** | só serviço; a única com `p_usuario` aberta a authenticated é `definir_ver_acessos` (admin + aal2) |
| Esquema `interno` | cerca de 45 | fixas | sim (sem USAGE no esquema) | não | n/a |

Nenhuma função `security definer` está sem `set search_path` (contagem própria: 271/271; 42 ocorrências de `search_path = public`, das quais 20 nas versões finais).

## Controles aprovados (com evidência)
- **RLS em 100% das tabelas:** 63 `create table` × 63 `enable row level security` (varredura das migrações; nenhum `disable`). Testes pontuais: `28_painel_v2_leituras.test.sql:30`, `70_painel_v2_radar.test.sql:42`, `71_…:89`.
- **Nenhuma política para `anon`/`public`.** A única `using (true)` é `permissao_niveis` (catálogo, `20261004000100:28`).
- **Visões `security_invoker`:** `caixa_entrada` (`20261005000200:127`), `demandas_lista` (`20261003000500:31`), `contatos_lista` (`20261009000100:6`).
- **Guarda das funções de gravação:** o teste congelado `supabase/tests/25_painel_v2_horario.test.sql:83-91` falha se alguma função `security definer` executável por `authenticated` que grava não citar uma das travas. Conferi manualmente as 134 executáveis por `authenticated`: todas têm guarda.
- **Funções do trabalhador fechadas:** ex. `20261028000100:28-29,36-37,47-48` (`revoke … from public, anon, authenticated`). Variantes `*_de` só para `service_role` (`20261004000100:76-77,210-212`; `20261004000200:44-45`).
- **Escrita direta proibida nas tabelas críticas**, inclusive para `service_role` em tarefas, agentes, skills e sugestões (`20261016000100:156-157`; `20261014000200:53`; `20261015000200:54`).
- **Senhas de portais:** coluna cifrada fora de todos os papéis, inclusive `service_role` (`20261012000200:48-49`); revelar exige aal2 e grava auditoria (`20261029000100:46-60`).
- **`registrar_resposta` só aceita anexo de conversa visível e existente** (`20261027000100:17-25`), com segunda trava no trabalhador (`envio.ts:79,87-92`) e teste `91_revisao_registrar_resposta.test.sql`.
- **Bucket `tarefas`** sem política de leitura; o download passa pela rota que confere tarefa, nota e conversa (`api/tarefas/arquivo/route.ts:22-46`); bucket com limite e lista de tipos.
- **Integridade:** `mensagens.id_provedor unique` (`20260927000200:38`), `conversas.telefone unique + check` (`:12`), `contatos.telefone unique`, `contato_clientes` com PK composta, `chamados.numero identity unique`, `precos_um_vigente`, `agente_tarefas_uma_ativa`, `radar_um_giro_por_vez`. As FKs para `mensagens` usam `on delete set null` (a retenção não trava por FK). Nenhuma migração destrutiva (sem `drop table`/`drop column`/troca de tipo); `restaurar_radar_inicial` está revogada de todos.
- **Arquivar encerra sessões** (gatilho `20261029000200`, revogado de todos os papéis).
- **Imagens:** `.dockerignore` tira todos os `.env*`, `.claude`, `pedidos-do-dono`, `conversas-reais`, `*.bat`, `*.ps1` e `webhook-zapi.txt` (commit `7aff1a5`); as duas imagens rodam como `USER node` com `HEALTHCHECK`; o build usa `pnpm install --frozen-lockfile` com `packageManager: pnpm@9.15.0`; o estágio final copia só `dist`/`standalone` (sem o contexto).
- **`NEXT_PUBLIC_*`:** só URL e chave publicável no build (`Dockerfile.painel:6-8`); `ambiente-validar.ts:67-71` recusa `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` e chave `sb_secret_` no lugar da pública.
- **Segredos no histórico do git:** `git log --all -S` para `sk-ant-api`, JWT HS256, `sb_secret_`, `client-token`, `BEGIN PRIVATE KEY`, `AKIA` e `git log -p` nos `*.env.example`: só valores de teste (`sb_secret_abc`, JWT `{"sub":"x","role":"authenticated"}`, chave privada `SEGREDO123`), o padrão local `postgres:postgres@127.0.0.1` e o marcador `segredo…` num plano. Nenhum segredo real encontrado com esses padrões.
- **Painel sem as chaves do trabalhador** (`deploy/painel.env.example`, commit `9fe0974`).
- **Download de mídia limitado a 20 MB** com corte durante a leitura (`midia/armazenamento.ts:11,24-48`).

## Revisão anterior: situação dos itens da área
| Item (07/10) | Situação agora | Evidência |
|---|---|---|
| Banco I1 `registrar_resposta` com qualquer caminho | Corrigido | `20261027000100` + `envio.ts:87-92` |
| Banco I2 `transferir_chamado` | Corrigido | `20261027000200` |
| Banco I3 arquivar por PATCH | Corrigido (exceto `usuarios`, de propósito) | `20261027000300:10-26` |
| Banco I4 índices | Corrigido em parte; faltam `chamado_eventos` e `decisoes_agente` | 6.11 |
| Banco I5 anonimização | Corrigido em parte; ainda faltam alertas, Radar, avisos, orientações e fila | 6.3 |
| Banco M1 admin comum mexe no dono | Aberto (`salvar_usuario` em `20261029000100:127-185` não protege o dono) | |
| Banco M3 buckets sem limite | Aberto | 6.9 |
| Banco M4 `documentos_empresa.arquivo_path` | Aberto | 6.10 / Área 1, 1.3 |
| Banco M6 ficha de pessoas visível a todos | Aberto | `20260927000100:165` |
| Banco M7 textos sem limite (`nota_interna`, `registrar_resposta.p_texto`) | Aberto | `20260927000200:221-227`; `20261027000100` |
| Banco M9 funções antigas executáveis por anon | Aberto | 6.12 |
| Banco M10 retenção não alcança as tabelas novas | Aberto (e a lista cresceu) | 6.3 |
| Banco M11 testes de Storage | Parcial: `91_` cobre o caminho de `registrar_resposta`; ainda faltam testes das políticas `anexos_*`/`documentos_*` | `supabase/tests/` |
| `remocao_pendente` não reprocessada | Aberto | `clientes/acoes.ts:106-111`; 6.4 |
| `DATABASE_URL` no painel | Aberto | `fila.ts:9`; Área 2, 2.9 |
| `pgboss` exposto na nuvem | Não verificável | |
| `search_path = public` em 20 funções | Aberto | 6.12 |
| Realtime DELETE leva o id | Aberto (observação, comportamento do Supabase) | |
| `.dockerignore` incompleto | **Corrigido** | `7aff1a5` |
| Imagens como root e sem healthcheck | **Corrigido** | `7aff1a5`; Dockerfiles |
| Chaves do trabalhador no painel | **Corrigido** (exceto `DATABASE_URL`) | `9fe0974` |
| Cópia de segurança semanal e teste de restauração | Aberto | 6.2 |
| `workflow_dispatch` de qualquer ramo; ações e CLI sem versão fixa | Aberto | 6.8 |
| `cenarios.yml` interpola o segredo no `echo` | Aberto | `cenarios.yml:23` |
| `.playwright-mcp/`, scripts fora do `.gitignore` | Aberto | 6.14 |
| Pg-boss guarda payloads 7 dias | Aberto (observação) | 6.3 |
| Aviso de privacidade desligado | Aceito pelo dono; e o aviso nunca chega às conversas existentes quando for ligado | 6.3 |

## Cenários adversariais da seção 19 (os da área)

**Cenário 23: falha durante a limpeza e exclusão parcial de anexos.**
- Dados: 3 conversas com 600 mensagens de mais de 1 ano, 200 com arquivo em `anexos`; 1 tarefa com `agente_tarefa_arquivos` apontando para um desses anexos; 1 auditoria `remocao_pendente`.
- Sequência e injeção:
  - (a) `midia.remover` falha no 2º lote;
  - (b) o `delete` das mensagens falha depois do `remove` bem-sucedido;
  - (c) o processo é morto entre o `remove` e o `delete`;
  - (d) o Storage fica fora durante `anonimizar_contato`.
- Invariantes esperados:
  1. A rotina seguinte termina a limpeza sem erro (remover um caminho já ausente não pode falhar).
  2. Nenhuma linha fica apontando para um objeto inexistente por mais de um ciclo.
  3. Nenhum objeto fica sem linha (varredura de órfãos).
  4. As etapas seguintes (`decisoes_agente`…) rodam mesmo com falha em (a).
  5. O resultado e a falha ficam registrados e geram alerta.
  6. `agente_tarefa_arquivos` do anexo apagado recebe `removido_em`.
- Evidência de aprovação: contagens de `storage.objects` e das tabelas antes e depois, o sinal `retencao` e o alerta. **Hoje reprova** nos invariantes 3, 4, 5 e 6 (6.4, 6.5).

**Cenário 25: implantação com esquema novo e contêiner antigo.**
- Dados: banco com as migrações do PR aplicadas; trabalhador e painel na tag anterior.
- Sequência: `db push`; mensagens chegando (webhook) e respostas do painel durante a janela; depois, só o trabalhador atualizado (o webhook do painel falha).
- Injeção: falha do segundo `curl` em `deploy.yml:28/51`; migração que revoga escrita ou cria trava usada só pela versão nova.
- Invariantes esperados: nenhuma mensagem recebida sem `mensagens` gravada; nenhuma resposta duplicada; o painel antigo continua conseguindo as funções que tinha (ou recebe erro claro); nenhum job da fila fica em formato que a versão antiga não entende.
- Evidência: suíte e2e e fumaça da versão N-1 contra o esquema N (job de CI proposto em 6.8). Exemplo concreto que reprova hoje: `20261029000100` com painel N-1 bloqueia `salvar_usuario` para administradores.

## Árvores de falha (parte da área)

**A. Vazamento entre empresas (lado banco)**
- RLS de tabela: todas com RLS, nenhuma política para anon → **fechado**. Mas `documentos_empresa` e o bucket `documentos` são legíveis por qualquer pessoa ativa (por desenho: "Clientes: ver" é o mínimo).
- Funções `security definer` com ID controlável → **fechado** para `authenticated` (guarda conferida). As que confiam em IDs são só da chave de serviço, e a segurança passa a depender do trabalhador (Áreas 1/5).
- Caminho de arquivo controlável → `registrar_resposta` **fechado**; `documentos_empresa.arquivo_path` **aberto** (6.10, 1.3).
- Sessão: senha de administrador sem segundo fator → **aberto** (2.1; Storage incluído, 6.15).
- Realtime → **fechado** (RLS por assinante; só o id em DELETE).
- Retenção e cópias → dados antigos ficam (6.3) e aumentam o que vaza num incidente.
- Causa comum: a confiança está na RLS por `auth.uid()` sem `aal`, e nos caminhos de arquivo guardados como texto livre.

**H. Recuperar o sistema depois de falhas e reinicializações**
- Perda de banco → cópia diária (Pro, não verificável), sem PITR, sem ensaio, e a restauração reenvia jobs (6.2).
- Perda de Storage → **sem cópia** (6.2).
- Perda de chave (`ACESSOS_PORTAIS_CHAVE`) → senhas irrecuperáveis (6.2).
- Deploy quebrado → sem cópia antes do `db push`; sem conferir compatibilidade N-1; ramo livre (6.8). Versões de migração duplicadas ou no futuro (6.1).
- Rotinas → limpeza sem registro (6.5); mensagens recentes escondidas no painel (6.6).
- Reinício do trabalhador → travas por chave e fila persistente (controle aprovado, `20261028000100`); o reprocessamento depende da idempotência (Área 3).
- Causa comum: não existe um "ciclo de restauração" pensado. Fila, reservas e Storage são tratados como se nunca precisassem voltar no tempo.

## Desempenho e escala (seção 21, análise estática)
- **Crescimento sem limite:** `uso_ia`, `auditoria_acessos`, `chamado_eventos`, `conversa_eventos`, `agente_tarefa_eventos`, `alertas`, `radar_*`. `mensagens` e `decisoes_agente` ficam limitadas a 1 ano. A fila do pg-boss usa o padrão (arquivo 12 h, apagado em 7 dias).
- **Consultas sem índice:** `chamado_eventos(chamado_id)`; `decisoes_agente(conversa_id)` sem turno; `decisoes_agente(criado_em)` (6.11).
- **Painel:** histórico sem paginação, com corte silencioso em 1000 (6.6); `decisoes_agente` com `limit(300)`; o painel carrega 10 consultas em paralelo por conversa aberta.
- **Memória:** Base64 de documentos sem limite de bucket (6.9); download de mídia limitado a 20 MB.
- **Plano de carga progressivo**, num projeto descartável com dados sintéticos e nunca na produção:
  - etapa 1: 10 mil mensagens e 30 mil decisões;
  - etapa 2: 10× isso;
  - etapa 3: um ano projetado (a estimar com o dono: mensagens/dia × 365).
  - Métricas: p95/p99 de abrir a conversa, da caixa de entrada, do Realtime (atraso do evento), da limpeza (duração e linhas por minuto) e memória do trabalhador ao enviar documento de 10/25/50 MB com 4 conversas em paralelo.
  - Parar se a CPU do banco passar de 80% por 5 min, se a memória do contêiner passar de 85% ou se aparecer erro 5xx.
  - As metas (ex.: abrir a conversa com p95 abaixo de 800 ms) precisam ser combinadas com o dono; nenhuma capacidade é afirmada aqui sem medição.

## Não verificável / precisa de acesso
- Configuração do projeto Supabase de produção (`xexinbtbzrjfgdxaaxla`): esquemas expostos (se `pgboss` está fora), `max_rows`, limite global de arquivos, retenção e tipo da cópia diária, PITR, `enable_signup`, OpenAPI e GraphQL para anon.
- Se a cópia diária do Supabase inclui o Storage (pela documentação do Supabase, não inclui; não conferido no projeto).
- De qual ramo ou SHA o Easypanel constrói as imagens, e o que acontece quando só um dos webhooks de deploy funciona.
- Proteções do GitHub (aprovadores do ambiente `producao`, proteção do `main`); não há remoto configurado nesta cópia além de `origin/main`.
- Tamanho máximo de URL aceito pelo gateway da nuvem (hipótese de 6.5).
- Guarda dos logs do Easypanel (telefones e ids no console).
- Vulnerabilidades de dependências além das listadas: sem acesso à internet para `pnpm audit`.
