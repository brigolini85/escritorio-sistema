# Cadastros comerciais por empresa (clientes, fornecedores, produtos, preços e documentos)

Data: 2026-09-28. Complementa `2026-09-27-etapas-1-2-atendimento-notas-design.md` e adianta a parte de "cadastros comerciais" da etapa 2, antes da emissão automática no Bling.

## 1. Objetivo e critérios de sucesso

Hoje, quando uma empresa atendida (ex.: uma indústria de alimentos) pede "nota pro Brasil Santa Efigênia, 20 PAC costela", a demanda chega ao Fiscal só com o texto do cliente. A equipe tem que descobrir qual CNPJ é aquela filial, qual produto é "costela" e qual preço vale para aquela rede. Nas conversas reais, pedidos de nota são o assunto mais frequente, e o risco principal é a nota sair para a filial errada.

Com esta entrega:

- Cada empresa atendida tem, na própria ficha do painel, seus **clientes** (redes e unidades/filiais), **fornecedores**, **produtos**, **preços por rede** e **documentos**.
- O agente identifica destinatário e produtos **por uma busca feita pelo código** nesses cadastros. A IA só conversa: não escolhe CNPJ sozinha nem informa preço.
- A demanda de nota chega ao Fiscal **pronta para emitir**: destinatário com CNPJ/IE, itens com código, quantidade, preço da tabela e total, e o pedido original do cliente copiado para conferência.
- Documentos marcados como "a IA pode enviar" (ex.: contrato social) são enviados na hora ao contato autorizado da empresa. Os demais viram demanda.

Critérios de sucesso:

- Nenhuma demanda de nota com destinatário escolhido pelo agente quando havia mais de um candidato. Nesse caso ele pergunta.
- Nenhum preço na demanda que não venha da tabela vigente.
- Nenhuma busca retorna cadastro de outra empresa.
- Nenhum pedido se perde: se a busca ou a montagem falhar, a demanda sai com o texto original.

## 2. Decisões do dono (2026-09-28)

1. **Contratos** são documentos da empresa (PDF do contrato social etc.), guardados na ficha. Não têm relação com fornecedores.
2. **Fornecedores** servem para controle e para nota de devolução. São identificados como os destinatários, inclusive por palavras-chave.
3. **Documentos:** cada um tem a marcação "a IA pode enviar sozinha". Os marcados vão na hora para o contato autorizado; os outros viram demanda.
4. **Preço por rede:** o mesmo valor vale para todas as unidades da rede. Não há exceção por filial nesta entrega.
5. **Carga inicial manual** pelo painel. A importação por planilha ou pelo Bling fica para depois.
6. **Na dúvida, perguntar ao cliente.** Destinatário ou produto não cadastrado não trava o pedido: a demanda sai marcada "não cadastrado" para a equipe resolver.
7. **Abordagem A:** cadastros estruturados, busca feita pelo código e preço preenchido pelo código.

## 3. Fora do escopo desta entrega

- Emissão no Bling, espelho da nota e confirmação do cliente (restante da etapa 2).
- Importação por planilha ou pelo Bling.
- Reajuste de preço pelo WhatsApp (fluxo 6.6 do spec da etapa 2). Preço só muda pelo painel.
- Preço de exceção por unidade.
- "Repete a última nota" automático: continua virando demanda com o texto do cliente.
- Regras de natureza de operação e padrões de NF-e.

## 4. Modelo de dados

Todas as tabelas têm `cliente_id` (a empresa atendida dona do cadastro) e RLS habilitado. A consistência entre tabelas é garantida no banco: uma unidade só pertence a uma rede da mesma empresa, e um preço só liga rede e produto da mesma empresa (chaves estrangeiras compostas `(id, cliente_id)`).

- **`parceiros_grupos`** (a "rede"): id, cliente_id, tipo (`cliente` | `fornecedor`), nome (ex.: "Supermercado Brasil"), palavras_chave (lista de textos), ativo, criado_em. Único por (cliente_id, tipo, nome).
- **`parceiros_unidades`** (a filial): id, cliente_id, grupo_id, nome_unidade (ex.: "Santa Efigênia"), razão social, CNPJ (14 dígitos, validado; único por empresa), inscrição estadual, endereço, bairro, cidade, UF, palavras_chave, ativo, criado_em. Um fornecedor com um único endereço tem uma única unidade.
- **`produtos`**: id, cliente_id, código, descrição, unidade (texto curto: PAC, KG, UN, CX…), apelidos (lista de textos), ativo, criado_em. Código único por empresa.
- **`precos`**: id, cliente_id, grupo_id (somente redes do tipo `cliente`), produto_id, valor (maior que zero, 2 casas), vigente_desde, vigente_ate (vazio = vigente), alterado_por (usuário), criado_em. No máximo um preço vigente por rede e produto (índice único parcial). Mudar o preço fecha o anterior (`vigente_ate = agora`) e cria o novo, formando o histórico.
- **`documentos_empresa`**: id, cliente_id, nome (ex.: "Contrato social"), arquivo_path, arquivo_nome, arquivo_mime, ia_pode_enviar (padrão falso), enviado_por (usuário), criado_em. Os arquivos ficam no bucket privado `documentos`, no caminho `clientes/{cliente_id}/{arquivo}`.

**Funções do banco**
- `definir_preco(p_grupo, p_produto, p_valor)`: exige a permissão `editar_precos` (ou administrador). Confere se rede e produto são da mesma empresa e se a rede é do tipo `cliente`, fecha o preço vigente e grava o novo. É a **única** forma de gravar preço pelo navegador.

**Auditoria:** as tabelas novas entram no gatilho de auditoria que já existe para os cadastros.

**Anonimização (LGPD):** esses cadastros são dados de pessoa jurídica e não entram em `anonimizar_contato`.

## 5. Permissões (RLS)

- **Leitura:** todo usuário ativo lê os cadastros e os documentos, como já acontece com clientes e contatos.
- **Criar e editar** redes, unidades, produtos e documentos: permissão `editar_clientes`. **Excluir:** só administrador. Na prática, "desativar" (`ativo = falso`) é o caminho do dia a dia.
- **Preços:** o navegador não escreve direto na tabela; só pela função `definir_preco`, que exige `editar_precos`.
- **Storage `documentos`:** leitura por usuário ativo; envio de arquivo com `editar_clientes`. Download pelo painel é registrado na auditoria, como os anexos de conversa.
- O trabalhador usa a chave de serviço, mas **toda consulta do agente filtra pelo `cliente_id` da empresa em foco**. Isso é garantido no código e coberto por teste.

## 6. Painel

A lista de **Clientes** não muda. A ficha de cada empresa ganha **abas** (endereço `/clientes/{id}?aba=…`):

| Aba | Conteúdo |
|---|---|
| Dados | o que já existe (dados cadastrais, pausar agente) |
| Contatos | contatos autorizados e permissões (já existe) |
| Clientes da empresa | redes do tipo `cliente` e, em cada uma, as unidades (nome da unidade, razão social, CNPJ, IE, endereço, bairro, cidade, UF, palavras-chave). Criar, editar e desativar |
| Fornecedores | igual à aba anterior, com tipo `fornecedor` |
| Produtos | código, descrição, unidade, apelidos. Criar, editar e desativar |
| Preços | tabela rede × produto com o valor vigente. Editar um valor chama `definir_preco`. Link "histórico" por rede e produto mostra os valores anteriores com data e quem alterou |
| Documentos | enviar PDF, marcar ou desmarcar "a IA pode enviar sozinha", baixar, excluir (admin) |

Palavras-chave e apelidos são digitados separados por vírgula. Os botões de edição só aparecem para quem tem a permissão (o RLS garante de qualquer forma).

## 7. Agente

### 7.1 Busca (feita pelo código)

A busca normaliza o texto: minúsculas, sem acentos e sem pontuação, dividido em palavras. Descarta palavras de ligação e termos do pedido ("nf", "nota", "pro", "para", "a", "o", "da", "do", "de", "unidade", "loja"…).

- **Parceiros** (`tipo` = cliente ou fornecedor): para cada unidade ativa da empresa em foco, junta os termos pesquisáveis (nome da rede, palavras-chave da rede, nome da unidade, palavras-chave da unidade, bairro, cidade, razão social). A pontuação é quantas palavras do texto são **iguais** a alguma palavra desses termos, depois da mesma normalização. Assim, "efigenia" casa com "Efigênia", mas "brasa" não casa com "Brasil". Devolve as unidades com a maior pontuação (acima de zero), no máximo 5.
- **Produtos:** mesma lógica sobre descrição, código e apelidos, para cada item citado.
- Resultado da busca de parceiro: um candidato, vários candidatos (empate) ou nenhum.

Exemplos que viram testes: "Brasil Santa Efigênia" encontra só a unidade Santa Efigênia do Supermercado Brasil; "Hortsul" com três unidades devolve as três; "costela" encontra "Costela com Requeijão"; o texto de uma empresa nunca encontra cadastro de outra.

### 7.2 Ferramentas novas

- `buscar_parceiros(texto, tipo)`: devolve candidatos com id, rede, unidade, bairro e cidade (sem CNPJ, para a conversa não expor dados à toa).
- `buscar_produtos(textos[])`: para cada texto, devolve candidatos com id, código, descrição e unidade.
- `abrir_pedido_nota(tipo, unidade_id | null, texto_destinatario, itens[{produto_id | null, texto, quantidade, unidade}], pedido_original)`, com tipo `venda` ou `devolucao`. O código:
  1. confere se a unidade (quando informada) é da empresa em foco e do tipo certo (`cliente` para venda, `fornecedor` para devolução) e se cada produto é da empresa em foco. Qualquer id de fora é recusado como erro;
  2. na venda, busca o preço vigente da rede para cada produto e calcula os totais. Produto sem preço aparece como "sem preço cadastrado". Devolução não leva preço de tabela;
  3. monta o resumo no formato da seção 7.4 e abre a demanda no setor **Fiscal** (se o setor não existir, em triagem);
  4. se o contato não tiver `pode_pedir_nota` para a empresa, abre a demanda assim mesmo, com a observação "contato sem permissão para pedir nota".
- `listar_documentos()`: nomes dos documentos da empresa em foco e se a IA pode enviar cada um.
- `enviar_documento(documento_id)`: só aceita documento da empresa em foco com `ia_pode_enviar`. Envia o PDF pelo WhatsApp (URL assinada de curta duração) e grava a mensagem de saída com o arquivo. Documento não liberado → erro orientando a abrir demanda.

Todas as ferramentas exigem **empresa em foco definida** (as regras atuais de "qual empresa?" continuam valendo).

### 7.3 Regras novas no prompt

- Pedido de nota (venda ou devolução): usar `buscar_parceiros` e `buscar_produtos`.
  - Um candidato de destinatário: segue.
  - Vários: pergunta ao cliente qual, citando as unidades pelo nome.
  - Nenhum: segue com `unidade_id` vazio (vira "destinatário não cadastrado").
  - Com os produtos vale o mesmo: se um apelido tiver mais de um candidato, pergunta.
  - Depois chama `abrir_pedido_nota` com o texto original do cliente.
- Nunca informar preços ao cliente pelo WhatsApp.
- Pedido de documento: `listar_documentos`. Se estiver liberado, `enviar_documento`; senão, abrir demanda comum.
- A regra atual 3a (pedido de nota por `abrir_chamado`) é substituída por esta.

### 7.4 Formato da demanda de nota

Título: `NF de venda – Supermercado Brasil / Santa Efigênia` (ou `NF de devolução – <fornecedor>`). Se faltar destinatário: `NF de venda – destinatário não cadastrado`.

Resumo:
```
Destinatário: Supermercado Brasil / Santa Efigênia – <razão social> – CNPJ <cnpj> – IE <ie>
20 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 190,00
15 PAC Frango com Requeijão (cód. 14) × R$ 9,00 = R$ 135,00
3 PAC Lasanha – PRODUTO NÃO CADASTRADO
Total (itens com preço): R$ 325,00

Pedido original: "<texto do cliente>"
```
Pedido de correção ou cancelamento de nota continua indo para o Fiscal com título iniciado por "URGENTE:" (regra atual).

### 7.5 Falhas

Se a busca, o cálculo ou a gravação falharem, o agente recebe o erro e abre a demanda com `abrir_chamado` no Fiscal, copiando o pedido original. O processamento atual (escalar para humano em caso de falha do agente) continua valendo.

## 8. Testes

- **Banco (pgTAP):**
  - o atendente lê os cadastros;
  - sem `editar_clientes` não cria rede, unidade, produto nem documento;
  - `definir_preco` recusa quem não tem `editar_precos`, fecha o preço anterior e mantém um único vigente;
  - unidade de uma empresa não aceita rede de outra (chave composta);
  - as alterações aparecem na auditoria.
- **Trabalhador (Vitest, banco local):**
  - busca de parceiros (os exemplos da 7.1, empate, nenhum resultado, isolamento entre empresas);
  - busca de produtos por apelido e código;
  - `abrir_pedido_nota`: preço da tabela e total, produto sem preço, produto e destinatário não cadastrados, id de outra empresa recusado, devolução sem preço, contato sem `pode_pedir_nota`;
  - `enviar_documento`: liberado envia, não liberado é recusado, documento de outra empresa é recusado.
- **Cenários com o Claude real (dados inventados):** filial certa pelo bairro; filial ambígua (pergunta); produto por apelido; produto não cadastrado (demanda marcada); nota de devolução para fornecedor; contrato social liberado (envia); documento não liberado (demanda); a resposta não informa preço.
- **Painel (Playwright):** cadastrar rede, unidade, produto e preço; alterar o preço e ver o histórico; atendente sem permissão não vê botões de edição; enviar documento e marcar "a IA pode enviar".

## 9. Relação com a etapa 2

Esta entrega implementa os "cadastros comerciais" da seção 4 do spec da etapa 2, com três ajustes de nome e escopo que o plano da etapa 2 deve adotar:

- `compradores_grupos`/`compradores_unidades` passam a ser `parceiros_grupos`/`parceiros_unidades`, com o campo `tipo` para incluir fornecedores. "Apelidos/referências" passam a se chamar `palavras_chave`.
- `precos` segue igual, por rede (grupo). Os campos de origem e status de aprovação (reajuste pelo WhatsApp) entram na etapa 2.
- `documentos_empresa` é novo.

O status de revisão da importação (`a_revisar` | `aprovado`) entra junto com a importação.
