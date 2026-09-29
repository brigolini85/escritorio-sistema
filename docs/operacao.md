# Manual do dono: como o sistema funciona e como cuidar dele

Este manual explica, sem termos técnicos, o que é cada parte do sistema, como deixar tudo no ar pela primeira vez e o que fazer no dia a dia. Sempre que um passo parecer difícil, você pode abrir o Claude Code no VS Code e pedir: "me ajuda a fazer o passo X do manual de operação".

## 1. O que é cada peça

- **Painel**: é o site que você e a equipe acessam para ver as conversas, assumir atendimentos, cadastrar clientes e mudar configurações. Cada pessoa entra com o próprio e-mail e senha.
- **Trabalhador**: é o "robô" que fica ligado o tempo todo. Ele recebe as mensagens do WhatsApp, entende o que o cliente quer, responde o que é simples e abre chamados para a equipe. Também manda os alertas e o resumo do dia.
- **Supabase**: é onde ficam guardados os dados (clientes, conversas, chamados, arquivos) e os logins da equipe. Existem dois projetos: **homologação** (para testes) e **produção** (o de verdade).
- **Z-API**: é a ponte entre o número de WhatsApp do escritório e o sistema. O celular do escritório fica conectado a ela por um QR code, como no WhatsApp Web.
- **Easypanel**: é o servidor onde o painel e o trabalhador ficam rodando, dia e noite.
- **GitHub**: é onde fica guardado o código. Toda mudança passa pelos testes automáticos lá antes de ir para o ar.

## 2. Configuração inicial (uma vez)

Faça tudo primeiro em **homologação**, com o número de teste. Só depois de conferir que está tudo certo, repita em **produção**.

### 2.1 Supabase

1. Entre em supabase.com e crie dois projetos, na região São Paulo: `escritorio-homologacao` (plano gratuito) e `escritorio-producao` (plano **Pro**, para ter cópia de segurança diária).
2. Em cada projeto, anote:
   - **Project Settings → API**: a URL do projeto, a chave `anon` (pública) e a chave `service_role` (secreta).
   - **Project Settings → Database**: a senha do banco. Em **Connect → Session pooler**, copie o endereço de conexão (porta 5432) e troque `[YOUR-PASSWORD]` pela senha.
   - **Project Settings → General**: o "Reference ID" do projeto.
3. Em **Account → Access Tokens**, crie um token de acesso. Ele é o `SUPABASE_ACCESS_TOKEN` do GitHub.

### 2.2 Easypanel

Para cada ambiente (homologação e produção), crie dois apps a partir do repositório do GitHub:

1. **Trabalhador**: em "Build", escolha **Dockerfile** e informe `Dockerfile.trabalhador`. Porta: **3001**.
2. **Painel**: em "Build", escolha **Dockerfile** e informe `Dockerfile.painel`. Porta: **3000**. Em "Build arguments", informe `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA` do projeto Supabase daquele ambiente.
3. Em cada app, **desligue a publicação automática** ("Auto deploy"). Quem publica é o GitHub, e só depois que os testes passam.
4. Em cada app, copie a URL de **Deploy webhook**. Ela vai para os segredos do GitHub (passo 2.3).
5. Em "Environment", cole as variáveis do arquivo `.env.example`, preenchidas com os valores daquele ambiente:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA`, `DATABASE_URL` (o endereço do Session pooler);
   - `ANTHROPIC_API_KEY` (a chave do Claude);
   - `ZAPI_INSTANCIA`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` (da instância da Z-API daquele ambiente);
   - `WEBHOOK_SEGREDO`: invente uma sequência longa de letras e números (pelo menos 16), diferente em cada ambiente;
   - `TRANSCRICAO_BASE_URL`, `TRANSCRICAO_API_KEY`, `TRANSCRICAO_MODELO` (Groq, `whisper-large-v3`). `TRANSCRICAO_VOCABULARIO` é opcional: termos que ajudam a transcrição a acertar siglas;
   - `SMTP_HOST`, `SMTP_PORTA`, `SMTP_USUARIO`, `SMTP_SENHA`, `SMTP_REMETENTE` (o e-mail que manda os alertas);
   - `PAINEL_URL`: o endereço do painel, por exemplo `https://painel.seuescritorio.com.br`.
6. Em "Domains", configure o domínio do painel (ex.: `painel.seuescritorio.com.br`) e o do trabalhador (ex.: `robo.seuescritorio.com.br`).

### 2.3 GitHub

1. No repositório, abra **Settings → Environments** e crie dois ambientes: `homologacao` e `producao`. No `producao`, marque **Required reviewers** e coloque você. Assim nada vai para produção sem a sua aprovação.
2. **Dentro de cada ambiente** (Settings → Environments → homologacao ou producao → Environment secrets), cadastre, com os valores daquele ambiente:
   - `SUPABASE_ACCESS_TOKEN`
   - `SUPABASE_DB_PASSWORD`
   - `SUPABASE_PROJECT_REF` (o "Reference ID")
   - `EASYPANEL_DEPLOY_TRABALHADOR` e `EASYPANEL_DEPLOY_PAINEL` (as URLs de Deploy webhook)

   **Atenção:** não cadastre esses cinco como segredos do repositório. Se ficarem no repositório, a publicação de produção usaria os dados de homologação.
3. Em **Settings → Secrets and variables → Actions → Repository secrets**, cadastre só a `ANTHROPIC_API_KEY`. Ela é usada nos testes de conversa com o Claude antes de cada publicação em produção.

### 2.4 Login da equipe (Supabase Auth)

Em cada projeto do Supabase:

1. **Authentication → URL Configuration**: em "Site URL", coloque o domínio do painel (ex.: `https://painel.seuescritorio.com.br`). Em "Redirect URLs", acrescente `https://painel.seuescritorio.com.br/auth/confirm`.
2. **Authentication → Email Templates → Invite user**: no assunto, escreva "Seu acesso ao painel do escritório"; no corpo, cole o conteúdo do arquivo `supabase/templates/convite.html`.
3. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**. Só entra quem for convidado.

### 2.5 Z-API

Na instância de cada ambiente, abra **Webhooks**:

1. No campo **Ao receber**, cole `https://<domínio do trabalhador>/webhook/zapi/<WEBHOOK_SEGREDO>`, usando o mesmo segredo que você colocou no Easypanel.
2. Na mesma tela, ligue a opção de **notificar também as mensagens enviadas por mim** (na documentação da Z-API ela se chama `notifySentByMe`). É assim que o sistema percebe quando alguém respondeu o cliente direto pelo celular do escritório; nesse caso o agente para de responder aquela conversa. Não é preciso configurar o webhook "Ao enviar": o sistema não usa esse aviso.

### 2.6 Aviso de sistema fora do ar (UptimeRobot)

Crie uma conta gratuita em uptimerobot.com e um monitor **HTTP(s)** para `https://<domínio do trabalhador>/saude`, conferindo a cada 5 minutos e avisando no seu e-mail. Se o servidor inteiro cair, é esse monitor que avisa, porque o próprio sistema não consegue mandar alerta estando parado.

### 2.7 Primeiro administrador

O primeiro acesso ao painel é criado por um comando. Peça ao Claude: "crie o primeiro administrador em produção com meu nome e e-mail". Ele vai rodar:

```
pnpm --filter @escritorio/painel exec tsx --env-file=<arquivo com as chaves do ambiente> scripts/criar-admin.ts "Seu Nome" seu@email.com.br
```

Você recebe um e-mail "Seu acesso ao painel do escritório". Clique no link e defina uma senha com pelo menos 10 caracteres.

### 2.8 No painel

Entre no painel e, em **Configurações**:

1. Convide a equipe (cada pessoa recebe um e-mail para definir a senha) e marque os setores de cada um.
2. Confira os setores (já vêm cinco: Pessoal, Contábil, Fiscal, Financeiro e Legalização). A descrição dos assuntos é o que o agente usa para decidir para onde mandar cada pedido: quanto mais clara, melhor.
3. Cadastre os serviços que o escritório presta e as respostas prontas (perguntas que o agente pode responder sozinho, como horário de atendimento).
4. Cadastre os feriados, o horário de expediente, seu WhatsApp, o e-mail de alertas e o teto mensal de gasto com IA.

Depois, em **Clientes**, cadastre as empresas e, em cada uma, os contatos autorizados a falar pelo WhatsApp.

### 2.9 Teste final em homologação

Com o número de teste conectado, mande mensagens do seu celular pessoal e confira no painel: o aviso de privacidade chega na primeira mensagem, o agente responde, o chamado cai no setor certo, e um atendente consegue assumir e responder. Só então repita tudo em produção e conecte o número do escritório na instância de produção da Z-API.

## 3. Dia a dia

### Pausar o agente

Em **Início**, clique em **Pausar agente**. A partir daí, o cliente **não recebe nenhuma resposta automática**: as mensagens aparecem para a equipe no painel (Atendimento) e viram uma demanda de triagem, e alguém da equipe responde. Use quando o agente estiver respondendo algo errado, em época de muito movimento em que você prefira atendimento só humano, ou enquanto pede uma correção ao Claude. Para voltar, clique em **Retomar agente**. Também dá para pausar só para um cliente, na ficha dele (Clientes → cliente → "Pausar o agente para este cliente"), ou só para um contato: na conversa (Atendimento → conversa → "Desligar o agente para este contato") ou na aba Contatos da ficha. Número que não está cadastrado pode ser cadastrado direto na conversa, no quadro "Contato não cadastrado", com ou sem empresa. A aba **Contatos** do menu mostra todos os contatos, com as empresas de cada um e se o agente atende; para ligar um contato já cadastrado a uma empresa, abra a empresa em Clientes → aba Contatos → "Vincular contato já cadastrado".

### Quando chegar o e-mail "WhatsApp desconectado"

O celular do escritório perdeu a conexão com a Z-API. Entre no painel da Z-API, abra a instância de produção e leia o QR code de novo com o celular do escritório (WhatsApp → Aparelhos conectados → Conectar aparelho). Em até um minuto o sistema percebe e volta a funcionar.

### Convidar alguém

Configurações → Usuários → preencha nome e e-mail, marque os setores e clique em **Enviar convite**. Para tirar o acesso de alguém, abra o usuário e desmarque **Ativo**.

### "Por que o agente fez isso?"

Dentro de cada conversa, no lado direito, há o quadro **Por que o agente fez isso?**. Ele mostra cada ação do agente (qual ferramenta usou, com quais informações e o que aconteceu). Use para entender uma resposta estranha antes de pedir uma correção.

### Tipos de alerta

- **Crítico** (chega por e-mail e aparece no Início): algo parou, como o WhatsApp desconectado. Resolva na hora.
- **Operacional** (e-mail, seu WhatsApp e Início): algo pede sua atenção, como o gasto com IA passando de 80% do teto do mês. Avalie se aumenta o teto ou se algo está gastando demais.
- **Aviso** (só no Início, para o setor): por exemplo, um chamado sem responsável há mais tempo que o combinado. Alguém do setor deve assumir.

De segunda a sábado, às 18h, você recebe o **resumo do dia** no WhatsApp e no e-mail.

## 4. Pedir mudanças ao Claude

1. Abra o Claude Code no VS Code e descreva em português o que quer mudar (por exemplo: "quero que o agente também responda sobre o prazo do IR").
2. O Claude altera o sistema, e os testes rodam sozinhos no GitHub.
3. Se os testes passarem, a **homologação é atualizada automaticamente**. Teste com o número de teste.
4. Para ir à **produção**: no GitHub, abra **Actions → Publicação → Run workflow**, escolha `producao` e confirme. Os testes de conversa com o Claude rodam antes; se passarem, o GitHub pede a sua aprovação. Aprove e a produção é atualizada.

## 5. Segurança e LGPD

- **Nunca compartilhe as chaves** (Supabase, Claude, Z-API, Groq, e-mail) por WhatsApp, e-mail ou print. Elas ficam só no Easypanel, no GitHub e no arquivo `.env` do seu computador.
- **Apagar os dados de um contato a pedido dele**: Clientes → abra a empresa → na linha do contato, marque **confirmo** e clique em **Apagar dados (LGPD)**. As mensagens, transcrições, arquivos e registros do agente daquele contato são apagados, e o nome e o telefone são trocados por dados fictícios. Só administradores veem esse botão.
- **Prazo de guarda**: conversas, arquivos e registros do agente são apagados automaticamente depois de **1 ano**.
- **Quem recebe dados dos clientes** (para constar no registro de tratamento de dados do escritório):
  - **Anthropic** (a IA Claude, que lê as mensagens para responder), com transferência internacional (Estados Unidos);
  - **Groq** (transcrição dos áudios), com transferência internacional (Estados Unidos);
  - **Z-API** (a ponte com o WhatsApp);
  - **Supabase** (guarda os dados; projetos na região São Paulo);
  - o **provedor de e-mail (SMTP)** que envia os alertas e o resumo.

## 6. Plano de saída da Z-API

A Z-API é uma solução não oficial. O caminho definitivo é a **API oficial do WhatsApp, da Meta**, que exige a verificação da empresa no Meta Business. Acompanhe essa verificação; quando ela for aprovada, peça ao Claude: "migrar o WhatsApp para a API oficial da Meta". Só a peça do canal muda: o painel, o agente, os chamados e os dados continuam os mesmos.

## 7. Preços pelo WhatsApp

- **Consultar:** se um contato perguntar o preço de um produto para um cliente dele (por exemplo, "quanto está a costela pro Supermercado Brasil?"), o agente responde com o valor da tabela de preços da empresa (Clientes → empresa → aba Preços).
- **Alterar:** só contatos com a marcação **"Pode mudar preço e cadastrar produto"** (Clientes → empresa → aba Contatos) podem pedir alteração. O agente confirma com a pessoa ("passa de R$ 9,50 para R$ 10,00?") e só grava depois do "sim". Quem não tem a marcação recebe um aviso, e o pedido vira uma demanda para a equipe decidir.
- **Histórico:** no link "histórico" de cada preço aparece quem mudou: o nome da pessoa da equipe ou **"alterado pelo agente IA (a pedido de Fulano)"**.
- **Cadastrar produto:** contatos com a mesma marcação podem pedir o cadastro de um produto novo ("cadastra o produto 30, Lasanha Bolonhesa, pacote"). O agente pede o que faltar (código, descrição e unidade), confirma com a pessoa e só grava depois do "sim". Se ela informar o preço para uma rede, o agente grava o preço também. Quem não tem a marcação recebe um aviso, e o pedido vira uma demanda para a equipe cadastrar.
- **Emoji:** o agente não usa emoji nas mensagens.

## 8. Pedidos de venda para o Bling

O arquivo segue o modelo de **pedido de venda** do Bling: 41 colunas separadas por vírgula, UTF-8 sem BOM e uma linha por produto. O número do pedido é o número da demanda.

- **Um pedido:** na demanda de nota de venda (tela Demandas ou ao lado da conversa), clique em **"Baixar CSV Bling"**.
- **Vários pedidos:** na tela **Demandas**, o botão **"Exportar CSV Bling"** gera um arquivo com todas as demandas de nota de venda abertas do filtro escolhido. Acima de 500 pedidos, aparecem os botões "parte 1", "parte 2" etc., sem dividir um pedido entre arquivos.
- **Nome do arquivo:** `pedidos_venda_bling_AAAAMMDD_HHMM.csv`, com a data e a hora em que foi gerado (horário de Brasília).
- **Comprador:** vem do cadastro do cliente (Clientes → empresa → aba Clientes): razão social, CNPJ, endereço, número, complemento, bairro, cidade, UF, CEP e telefone. Preencha esses campos uma vez; o arquivo sempre usa o cadastro atual. Sem endereço de entrega combinado na conversa, a entrega vai para o endereço do comprador.
- **Pedido:** produtos, quantidades e preço da tabela vêm do que o agente organizou. Data de entrega, forma de pagamento, frete, transportadora, observações e endereço de entrega diferente só vão preenchidos se o cliente falar deles; o agente não pergunta.
- **Faltou algo:** se faltar o nome do comprador, o produto, a quantidade ou o valor de algum item, o painel mostra qual pedido e qual item em vez de gerar o arquivo (o Bling recusa venda sem total).
- **Sem valor:** produto não cadastrado, produto sem preço na tabela da rede, ou pedido numa unidade que muda o preço (kg, litro, caixa, fardo) de um produto cadastrado em outra. UN, PC, PAC, PCT, pacote e peça contam como a mesma unidade e usam o preço do cadastro.
- Nota de devolução não gera pedido de venda. O cliente nunca recebe nem ouve falar do arquivo, e todo download fica registrado na auditoria.

**Resumo para o cliente conferir.** Antes de passar um pedido de nota para o Fiscal, o agente manda ao cliente um resumo de cada nota: destinatário com CNPJ e endereço (do cadastro), produtos com código, quantidade, preço da tabela, total e o que foi combinado (pagamento, entrega). Junto, pergunta se está certo e se tem mais alguma nota. Se o cliente corrigir, sai um resumo novo. Só depois de o cliente confirmar a nota vai para o Fiscal, uma demanda por nota; o sistema não deixa passar um pedido diferente do resumo conferido. Se o cliente voltar depois pedindo outra, vira uma demanda nova.

## 9. Assistente interno (dono e equipe)

- **Quem usa:** na aba **Usuários** (menu do administrador), marque em cada pessoa "Usar o assistente pelo site" e/ou "Usar o assistente pelo WhatsApp (pelo telefone acima)". Vale também para o administrador.
- **No painel:** menu **Assistente** (perguntas gerais) ou a caixa **Assistente** dentro de cada atendimento (já sabe do cliente e das demandas daquela conversa).
- **No WhatsApp:** a pessoa marcada manda mensagem do número dela para o número do agente. Essas conversas não aparecem no Atendimento. Atenção: um número com o assistente ligado deixa de falar com o agente de clientes; para testar como cliente, desmarque ou use outro número.
- **O que ele faz (Parte 1):** consulta demandas, pedidos, vendas por período e rede, preços e cadastros; corrige pedidos de nota (itens, quantidades, unidade, preço, destinatário, pagamento, entrega) mostrando o antes e o depois e só grava depois do "sim"; gera o CSV do Bling (botão no painel, arquivo no WhatsApp).
- **Permissões:** corrigir pedidos e gerar CSV exigem "Corrigir pedidos de nota e gerar CSV do Bling" (o administrador sempre pode). Quem não é administrador só vê as demandas dos seus setores.
- **Registro:** toda alteração fica anotada na demanda ("Pedido alterado pelo assistente a pedido de Fulano") e na auditoria; o gasto entra no limite mensal de IA.
- **Guarda das conversas:** as conversas com o assistente são apagadas depois de 1 ano, junto com as demais.
