# Verificações da etapa 1

Em andamento desde 2026-09-27.

## V2 — Z-API

Instância `homologacao` conectada a um número de teste.

### Status da instância

`GET /instances/{id}/token/{token}/status` com o header `Client-Token`. Resposta observada:

```json
{"connected":true,"session":false,"created":1790529738849,"error":"You are already connected.","smartphoneConnected":true}
```

- Conectado: `connected` e `smartphoneConnected`.
- O campo `error` vem preenchido mesmo com a instância conectada. **Não** usar `error` para decidir se a instância caiu.

### Webhook "Ao receber"

Fixtures capturadas em `apps/trabalhador/test/fixtures/zapi/reais/`, com os dados trocados por fictícios: `texto.json`, `audio.json`, `imagem.json`, `documento.json`, `grupo.json`, `grupo-notificacao.json`, `enviada-pelo-celular.json` e `enviada-pela-api.json`.

**Atenção:** as quatro primeiras capturas (texto, áudio, imagem e documento) foram copiadas com a tradução automática do navegador ligada. Nelas apareceram `foto` no lugar de `photo` e `moment` no lugar de `momment`. As capturas sem tradução usam `momment` (com dois "m", grafia da própria Z-API). As fixtures foram corrigidas para `photo` e `momment`. Por segurança, o código lê `momment` e, se faltar, `moment`.

| Informação | Campo |
|---|---|
| Id da mensagem | `messageId` |
| Telefone do contato | `phone` (só dígitos, com DDI) |
| Número da instância | `connectedPhone` |
| Enviada por mim | `fromMe` |
| Grupo | `isGroup` |
| Enviada pela API × pelo celular | `fromApi`. Pelo celular do número conectado: `fromMe: true`, `fromApi: false`. Pela API: `fromMe: true`, `fromApi: true`, `status: "SENT"` (ver `enviada-pelo-celular.json` e `enviada-pela-api.json`). |
| Tipo do evento | `type` = `ReceivedCallback` |
| Texto | `text.message` |
| Momento | `momment` (epoch em milissegundos; numa mensagem enviada pelo celular veio com milissegundos quebrados, ex.: `1790530579003`) |

### Grupos e notificações

- Grupo: `isGroup: true`, `phone` termina em `-group` (ex.: `120363000000000000-group`), `chatLid: null`. Quem escreveu vem em `participantPhone` e `participantLid`.
- Eventos que não são mensagem também chegam pelo webhook "Ao receber", com `type: "ReceivedCallback"`. Exemplo: criação de grupo, com `notification: "GROUP_CREATE"`, sem `text`, e com `messageId` numérico curto (`357438184`). **O trabalhador deve descartar qualquer evento com `notification` preenchido**, além dos de grupo.
- A regra "mensagens de grupo são ignoradas" pode usar `isGroup` sozinho; o sufixo `-group` em `phone` serve de segunda checagem.

### Mídia

| Tipo | Objeto | URL do arquivo | Outros campos |
|---|---|---|---|
| Áudio | `audio` | `audioUrl` | `ptt` (`true` = gravado na hora), `seconds`, `mimeType` = `audio/ogg; codecs=opus` |
| Imagem | `image` | `imageUrl` | `caption` (vem `""` quando não tem legenda), `thumbnailUrl`, `mimeType`, `width`, `height`, `downloadError` |
| Documento | `document` | `documentUrl` | `fileName`, `title`, `caption` (vem `null` quando não tem legenda), `mimeType`, `pageCount` |

- As URLs apontam para `f004.backblazeb2.com/file/temp-file-download/...`, que é armazenamento **temporário**. O trabalhador precisa baixar o arquivo e guardar no Storage logo ao receber, não depois.
- A legenda vazia vem como `""` na imagem e como `null` no documento. O código tem que tratar os dois casos.
- Só o documento trouxe `adContext` e `messageExpirationSeconds`. Tratar esses campos como opcionais.

Outros campos observados: `chatLid` (identificador `@lid` do contato), `isNewsletter`, `broadcast`, `isEdit`, `isStatusReply`, `participantPhone`/`participantLid` (nulos fora de grupo), `forwarded`, `status` (`RECEIVED`).

### Envio (`send-text`)

`POST /instances/{id}/token/{token}/send-text` com header `Client-Token` e corpo `{"phone":"55DDDNUMERO","message":"..."}`. Resposta observada (HTTP 200):

```json
{"zaapId":"01A0E3F24B427CCBBE9503F4B37E8C99","messageId":"7E024FF55AF3DF1A1995","id":"7E024FF55AF3DF1A1995"}
```

- O id da mensagem no WhatsApp é `messageId` (`id` repete o mesmo valor). É esse que casa com o `messageId` do webhook.
- Confirmado: o webhook da mensagem enviada pela API chega com o **mesmo** `messageId` devolvido pelo `send-text` e com `fromApi: true`.
- `zaapId` é o id interno da fila da Z-API; não usar para casar mensagens.

### Preço

R$ 99,90 por mês por instância (valor pago pelo dono em 2026-09-27). Com homologação e produção serão duas instâncias, se as duas ficarem ativas ao mesmo tempo.

### Pendente

- Uma imagem **com** legenda. A foto capturada veio sem legenda. Não trava nada: o campo `image.caption` já é conhecido.
- Uma mensagem enviada pelo celular numa conversa **individual**. A capturada foi num grupo; o formato deve ser o mesmo.
- Se a Z-API reenvia webhooks quando o servidor responde erro, quantas vezes e em que intervalo.

## V4 — Transcrição

Fornecedor testado: **Groq**, com API compatível com `POST {base}/audio/transcriptions` (multipart: `file`, `model`, `language`, `prompt`).

- URL base: `https://api.groq.com/openai/v1`
- Áudio de teste: 16,5 s de áudio `.ogg` (opus) gravado no WhatsApp, com um pedido típico de cliente (guia do DAS, guia do INSS, folhas de pagamento, nota).

| Modelo | Sem vocabulário | Com vocabulário (`prompt`) | Tempo |
|---|---|---|---|
| `whisper-large-v3` | Errou só "INSS" (saiu "NSS") | **Tudo certo** | ~0,7 s |
| `whisper-large-v3-turbo` | Errou só "INSS" (saiu "NSS") | **Tudo certo**, mas troca "pra" por "para" | ~0,4 s |

Vocabulário usado no `prompt`: "Conversa com escritório de contabilidade: DAS, INSS, FGTS, pró-labore, folha de pagamento, nota fiscal, extrato, Simples Nacional, DCTFWeb, eSocial."

**Escolha:** Groq `whisper-large-v3`, sempre com `language=pt` e o vocabulário no `prompt`. É o mais fiel ao que foi falado, e a diferença de velocidade não importa para o atendimento.

Preço: a Groq cobra por hora de áudio, com valor de centavos de dólar por hora. Com o volume de um escritório, o custo mensal fica irrelevante. Conferir o valor atual em https://groq.com/pricing antes de entrar em produção.

Observações:
- O vocabulário no `prompt` faz diferença real. Sem ele, siglas como INSS saem erradas.
- No Windows, o `curl` quebra os acentos do `prompt` ("prompt must be valid UTF-8"). No código (Node, `fetch` + `FormData`) funcionou normalmente.

## V5 — Supabase

Projeto `escritorio-homologacao` criado. Limites do plano gratuito e preço do Pro: pendente.

## V6 — Claude

Pendente.

## Impacto no plano

- **V2 (Z-API):** confirma o spec. Ajustes para a Task 7: ler `momment` (e `moment` se faltar); descartar eventos com `notification` preenchido; tratar legenda vazia como `""` ou `null`; não usar o campo `error` do status para decidir se a instância caiu.
- **V2 (Z-API), Task 8:** as URLs de mídia são temporárias; baixar e guardar no Storage assim que a mensagem chegar.
- **V4 (transcrição):** confirma o spec, com um acréscimo para a Task 8: enviar `language=pt` e o vocabulário contábil no campo `prompt`. O vocabulário fica em configuração (`TRANSCRICAO_VOCABULARIO` ou em `configuracoes`), para o dono poder acrescentar termos.
- **V5 e V6:** pendentes.
