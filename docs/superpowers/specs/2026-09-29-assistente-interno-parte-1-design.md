# Assistente interno — Parte 1 (desenho)

Data: 2026-09-29 · Pedido do dono · Branch `etapa-1`

## Objetivo

O dono e a equipe conversam com a IA para **consultar** o sistema e **corrigir pedidos de nota / gerar o CSV do Bling**, pelo **painel** (tela própria e dentro de cada atendimento) e pelo **WhatsApp** (do número de um usuário autorizado para o mesmo número do agente). Quem pode usar, e por onde, é controlado numa **aba Usuários**.

A Parte 2 (depois) acrescenta: falar com o cliente em nome do escritório e mexer em cadastros (preço, produto, endereço, status de demanda). Nada da Parte 2 entra aqui.

## Decisões do dono

- Canais: painel **e** WhatsApp.
- Poderes (todos, em duas partes): consultar, corrigir pedido e CSV (Parte 1); falar com o cliente, mexer em cadastros (Parte 2).
- Permissões: o administrador cadastra a equipe numa **aba Usuários** e marca, por pessoa, as permissões e se ela pode falar com o assistente **pelo site** e/ou **pelo WhatsApp** (com o número).

## Visão geral

```
WhatsApp (usuário autorizado) ─► webhook ─► processarConversa ─┐
Painel /assistente ou caixa no atendimento ─► server action ────┼─► assistente_mensagens + fila "assistente"
                                                                 │
                                    trabalhador: processarAssistente (Claude + ferramentas internas)
                                                                 │
                         resposta ─► assistente_mensagens (painel atualiza ao vivo)
                                  └► WhatsApp (texto; CSV como arquivo)
```

A inteligência fica só no **trabalhador**, como o agente de clientes. O painel só grava a pergunta e publica o job (o painel já publica jobs com pg-boss em `lib/fila.ts`).

## 1. Aba Usuários

- Nova rota `/usuarios`, só para administrador; item **Usuários** no menu do administrador. A seção "Usuários" sai de Configurações (mesmo código de convite e edição, movido).
- Campos por usuário: nome, e-mail (no convite), telefone, papel (administrador/atendente), ativo, setores, permissões.
- Permissões (lista `PERMISSOES`, guardadas em `usuarios.permissoes`):
  - `editar_clientes` — Editar clientes e contatos (já existe).
  - `editar_precos` — Editar preços (já existe; usado na Parte 2).
  - `emitir_notas` — passa a se chamar **"Corrigir pedidos de nota e gerar CSV do Bling"** (já existe no banco, sem uso até agora).
  - **`assistente_site`** — Pode usar o assistente pelo site (novo).
  - **`assistente_whatsapp`** — Pode usar o assistente pelo WhatsApp (novo; exige telefone).
- As marcações do assistente valem **também para o administrador** (ele marca a si mesmo). Assim o dono pode desligar o próprio número para testar como cliente.
- Validações ao salvar: `assistente_whatsapp` sem telefone → erro na tela ("Informe o telefone para usar o assistente pelo WhatsApp"); telefone já usado por outro usuário → erro; telefone que também é de um **contato** (cliente) → aviso na tela: "Este número também é de um contato. Com o assistente pelo WhatsApp ligado, as mensagens dele vão para o assistente, não para o agente de clientes."
- Menu: **Assistente** aparece para quem tem `assistente_site`.

## 2. Dados

Migration nova `…_assistente_interno.sql`:

- Tabela `assistente_mensagens`:
  - `id uuid pk`, `usuario_id uuid not null → usuarios`, `canal text check in ('site','whatsapp')`,
  - `conversa_id uuid null → conversas` (contexto: a caixa dentro de um atendimento; `null` na tela Assistente e no WhatsApp),
  - `papel text check in ('usuario','assistente')`, `conteudo text not null`,
  - `arquivo jsonb null` — arquivo gerado para baixar: `{ "tipo": "csv_bling", "chamados": [uuid...], "nome": "pedidos_venda_bling_….csv" }`,
  - `processada_em timestamptz null` (mensagens do usuário ainda não respondidas), `criado_em timestamptz default now()`.
  - Índice `(usuario_id, canal, conversa_id, criado_em)`.
  - RLS: o usuário lê as próprias linhas (`usuario_id = auth.uid()`); insere só `papel = 'usuario'`, `canal = 'site'` e com `tem_permissao('assistente_site')`. O trabalhador usa a chave de serviço.
  - Entra na publicação do Realtime (para a tela atualizar ao vivo).
- `caixa_entrada`: passa a **excluir conversas de telefones de usuários com `assistente_whatsapp`** (as conversas internas não aparecem no Atendimento).
- `chamado_eventos`: a alteração de pedido pelo assistente usa o tipo existente `nota_interna`, com o texto "Pedido alterado pelo assistente a pedido de Fulano: …" e `usuario_id` de quem pediu.

## 3. Entrada pelo WhatsApp

Em `processarConversa`, antes da regra de telefone interno:

1. `repos.usuarioDoAssistente(telefone)` → usuário **ativo** com `assistente_whatsapp` e aquele telefone (comparando variantes com/sem 9).
2. Se houver: copia as mensagens novas para `assistente_mensagens` (`canal = 'whatsapp'`; áudio vai com a transcrição, imagem/documento como "[imagem]" / "[documento: nome]"), marca as `mensagens` como processadas e publica o job `assistente` `{ usuarioId, canal: 'whatsapp', conversaId: null }`. Desfecho novo `'assistente'`.
3. Sem usuário autorizado: segue como hoje (telefone interno é ignorado; cliente vai para o agente).

O aviso de privacidade e as regras de pausa do agente de clientes **não** se aplicam ao assistente. O limite mensal de gasto com IA **se aplica** (acima dele, responde "Limite mensal de gasto com IA atingido; fale com o administrador.").

## 4. Entrada pelo painel

- Tela **`/assistente`**: histórico do usuário no canal site sem contexto (`conversa_id is null`), caixa de texto e botão Enviar.
- **Dentro do atendimento** (`/atendimento/[id]`): card "Assistente" na coluna da direita, com o histórico daquele contexto (`conversa_id = id`) e a caixa de texto.
- Server action `perguntarAoAssistente(texto, conversaId | null)`: exige `assistente_site`; grava a linha (`papel = 'usuario'`) e publica o job `assistente` `{ usuarioId, canal: 'site', conversaId }` com `singletonKey` por usuário+contexto.
- Atualização ao vivo: `AtualizarAoVivo` passa a ouvir `assistente_mensagens` do usuário. Enquanto a última mensagem é do usuário e não foi respondida, aparece "Pensando…".
- Mensagem do assistente com `arquivo` mostra o link **"Baixar CSV Bling"** → `/api/csv-bling?ids=<ids dos chamados>` (a rota ganha o parâmetro `ids`).

## 5. Processamento (trabalhador)

Fila `assistente` (pg-boss, política `stately`, `singletonKey` usuário+canal+contexto, 3 tentativas). `processarAssistente(deps, { usuarioId, canal, conversaId })`:

1. Carrega o usuário (papel, permissões, setores). Se inativo ou sem a permissão do canal → marca processadas e não responde.
2. Checa o teto de gasto.
3. Monta o contexto: nome e papel do usuário, data de hoje, permissões em palavras; com `conversaId`: contato, empresa em foco, demandas abertas da conversa (número, título, status) e as últimas 20 mensagens da conversa com o cliente (só como informação).
4. Histórico: últimas 30 linhas de `assistente_mensagens` daquele usuário+canal+contexto.
5. Laço de ferramentas com o Claude (mesmo modelo e cliente de IA do agente; máx. 8 voltas), registrando o uso em `uso_ia` e cada ferramenta em `decisoes_agente` com `etapa = 'assistente:<ferramenta>'`.
6. Resposta final (ferramenta `responder`): grava `assistente_mensagens` (`papel = 'assistente'`) e, no WhatsApp, envia o texto (e o arquivo, se houver). Marca as perguntas como processadas.

Prompt do assistente (separado do agente de clientes): fala com gente do escritório, direto e curto; usa só as ferramentas; nunca inventa número de demanda, preço ou cadastro; **antes de gravar qualquer alteração mostra o antes/depois e pede confirmação**; respeita as permissões (se a ferramenta recusar por permissão, explica e não insiste); no WhatsApp, respostas curtas e sem tabelas largas.

## 6. Ferramentas da Parte 1

Todas conferem, no código, as permissões do usuário (o trabalhador usa a chave de serviço, então o RLS não protege aqui). **Visibilidade de demandas**: administrador vê todas; os outros veem só as dos seus setores e as em que são responsáveis (a triagem, sem setor, é só do administrador) — igual a `pode_ver_chamado` do banco.

Consultar:
- `listar_demandas({ status?, setor?, empresa_texto?, de?, ate?, so_notas? })` → até 30: número, título, status, setor, empresa, criada em, total do pedido (quando houver).
- `ver_demanda({ numero })` → título, resumo, status, setor, responsável, eventos recentes, pedido de venda (itens, valores, total) e pendências para o CSV (`problemasPedidoBling`).
- `buscar_empresas({ texto })` → clientes do escritório (id, nome, CNPJ).
- `buscar_parceiros({ cliente_id, texto, tipo })`, `buscar_produtos({ cliente_id, textos })`, `consultar_preco({ cliente_id, unidade_id, produto_id })`, `dados_cadastro({ cliente_id, unidade_id? })` → reaproveitam as funções do agente de clientes, mas com a empresa escolhida pelo usuário.
- `resumo_vendas({ de, ate, cliente_id?, rede? })` → pedidos de venda no período: quantidade de pedidos, total geral e total por rede.

Corrigir pedido e CSV (exigem `emitir_notas` ou administrador, e a demanda visível ao usuário):
- `alterar_pedido_venda({ numero, unidade_id?, itens?, forma_pagamento?, data_prevista?, valor_frete?, tipo_frete?, transportadora?, observacoes?, entrega?, confirmado })`:
  - `itens` substitui a lista inteira: `{ produto_id | null, texto, quantidade, unidade, valor_unitario? }`. Sem `valor_unitario`, usa o preço da tabela da rede (mesma regra de unidades do agente, `mesmaUnidade`). Com `valor_unitario`, vale o informado.
  - Sem `confirmado = true`: **não grava**; devolve o antes/depois (itens, valores, total) para o assistente mostrar e pedir confirmação.
  - Com `confirmado = true`: grava `pedido_venda`, refaz o `resumo` da demanda (`montarPedidoNota`), registra em `chamado_eventos` (tipo `nota_interna`, "Pedido alterado pelo assistente a pedido de Fulano: …") e na auditoria.
  - Só demandas de **venda** abertas pelo agente (com `pedido_venda`); demanda concluída não muda.
- `gerar_csv_bling({ numeros? , abertas? })` → valida (`problemasPedidoBling`); com pendência, devolve a lista para o assistente explicar. Sem pendência:
  - site: grava a resposta com `arquivo` (o painel mostra "Baixar CSV Bling");
  - WhatsApp: envia o CSV como documento (`canal.enviarArquivo`, `data:text/csv;base64,…`, nome `pedidos_venda_bling_AAAAMMDD_HHMM.csv`); acima de 500 pedidos, um arquivo por parte.
  - Registra na auditoria (`acao = 'download'`, `entidade = 'csv_bling'`, com quem pediu e o canal).
- `responder({ texto })` → a resposta ao usuário.

## 7. Erros e limites

- Ferramenta com erro de validação → o assistente recebe a mensagem e explica em palavras simples.
- Falha da API do Claude → o job tenta de novo (3 vezes); na última, responde "Não consegui responder agora, tente de novo em alguns minutos."
- Mensagens do assistente no WhatsApp não entram em `mensagens` (não aparecem no Atendimento) — ficam só em `assistente_mensagens`.
- Retenção: `assistente_mensagens` segue a mesma limpeza de 1 ano das mensagens.

## 8. Testes

- Painel (vitest): esquema do usuário (telefone obrigatório com `assistente_whatsapp`, permissões novas), menu (Assistente/Usuários).
- Banco (pgTAP): RLS de `assistente_mensagens` (lê só as próprias; insere só com `assistente_site`); `caixa_entrada` sem as conversas internas.
- Trabalhador (vitest, IA roteirizada): roteamento do WhatsApp (usuário autorizado → assistente; sem marcação → ignorado como hoje; cliente → agente); visibilidade de demandas por setor; `alterar_pedido_venda` (sem confirmação não grava; com confirmação grava, refaz resumo, registra evento; sem permissão recusa; demanda de outro setor recusa; concluída recusa); `gerar_csv_bling` (pendência devolve lista; site grava `arquivo`; WhatsApp envia arquivo pelo canal falso); teto de gasto.
- Cenários com o Claude real (novo `cenarios-assistente`): "quais notas estão abertas?", "quanto vendi pro Supermercado Brasil esta semana?", "o pedido 21 era 15 PAC, corrige e manda o CSV" (duas rodadas: mostra antes/depois → "pode" → grava e manda arquivo), pedido de alteração sem permissão.

## Fora da Parte 1

Falar com o cliente pelo assistente; alterar preço, produto, endereço ou status pelo assistente; anexos (fotos/PDF) enviados ao assistente além do texto/transcrição.
