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

### Pessoas, permissões e horário de acesso

Configurações › Usuários e permissões › **Nova pessoa** abre a ficha em página inteira. Ao salvar, a pessoa recebe um convite por e-mail para criar a senha. Na ficha de quem já existe, "reenviar convite" (no rodapé) manda o convite de novo, ou um link para criar senha nova se a pessoa já tinha entrado. Para tirar o acesso de alguém, arquive a pessoa (Excluir… na ficha); ela volta pela lista de Arquivados.

**Administrador = Sim** dá acesso total e esconde as permissões (menos o Assistente, que continua por escolha, porque depende do telefone). Ninguém tira o próprio acesso de administrador.

Cada módulo tem um nível:

| Módulo | Níveis |
|---|---|
| Atendimento | Sem acesso · Conversas dos meus setores · Todas as conversas |
| Demandas | Só as minhas · Do meu setor · Todas |
| Clientes e contatos | Só ver · Ver e editar (inclui produtos) · Editar e arquivar |
| Preços | Só ver · Mudar preços |
| Pedidos de nota e CSV Bling | Sem acesso · Ver · Corrigir e gerar |
| Assistente | Sem acesso · Site · Site e WhatsApp (exige telefone) |
| Treinar o agente | Sem acesso · Sim |
| Alterar prazos de demandas | Não · Sim (escolher o prazo à mão; mudar a prioridade recalcula o prazo para todos) |
| Configurações | Sem acesso · Sim (sem teto de IA, alertas, pausa do agente e usuários, que ficam com o administrador) |

Quando a Parte D entrou, cada pessoa recebeu o nível que reproduz o que ela já fazia: ninguém passou a ver nem a fazer mais ou menos sem você mexer. Quem só tinha o assistente pelo WhatsApp ficou com "Site e WhatsApp".

**Configurações: Sim** não é o mesmo que ser administrador. A pessoa abre Configurações e mexe em Expediente, Mensagens, Respostas prontas, Prazos, Setores e Feriados. Ficam só com o administrador: Usuários e permissões, Teto de IA e alertas, Integrações e a pausa do agente. Assim ninguém se faz administrador, muda o gasto com IA ou pausa o agente sem você saber. No menu, quem tem "Sim" vê o item como "Expediente".

**Pedidos de nota: Sem acesso** esconde o bloco "Pedido de nota" e o CSV do Bling na demanda, a descrição e os itens do pedido e o antes e depois das correções. O assistente da pessoa também deixa de consultar e corrigir pedidos de nota e vendas. É uma proteção de tela e de assistente: a demanda continua visível pelo nível de Demandas.

**Horário de acesso:** seg a sex, sábado e domingo, cada um Permitido (com início e fim) ou Bloqueado. Pessoa nova começa com seg a sex das 08:00 às 18:00 e fim de semana bloqueado; quem já existia ficou sem restrição até você definir. O fim vale inclusive (18:00 ainda entra, 18:01 não). Feriado segue o dia da semana. O administrador entra a qualquer hora e nunca é bloqueado.

**Fora do horário** a pessoa não entra: aparece a página "Fora do seu horário de acesso", com o horário dela. Se a aba já estava aberta quando o horário acabou, a próxima ação leva a essa página; nada é lido nem gravado, e as mensagens dos clientes deixam de chegar naquela tela. O assistente pelo WhatsApp responde "Fora do seu horário de acesso. O assistente volta a responder quando o seu horário começar." sem gastar IA. Na lista de usuários, quem está fora do horário agora aparece como "Fora do horário agora".

**Último acesso** aparece no topo da ficha e na lista (atualiza no máximo a cada 10 minutos de uso).

### "Por que o agente fez isso?"

Dentro de cada conversa, no lado direito, há o quadro **Por que o agente fez isso?**. Ele mostra cada ação do agente (qual ferramenta usou, com quais informações e o que aconteceu). Use para entender uma resposta estranha antes de pedir uma correção.

### Tipos de alerta

- **Crítico** (chega por e-mail e aparece no Início): algo parou, como o WhatsApp desconectado. Resolva na hora.
- **Operacional** (e-mail, seu WhatsApp e Início): algo pede sua atenção, como o gasto com IA passando de 80% do teto do mês. Avalie se aumenta o teto ou se algo está gastando demais.
- **Aviso** (só no Início, para o setor): por exemplo, um chamado sem responsável há mais tempo que o combinado. Alguém do setor deve assumir.

De segunda a sábado, às 18h, você recebe o **resumo do dia** no WhatsApp e no e-mail.

### Prioridade e prazo das demandas

- O agente dá a prioridade ao abrir a demanda: **urgente** quando o cliente diz que é urgente (ou nota errada, golpe, funcionário sem registro), **alta** em assunto sensível e cobrança, **normal** no resto, **baixa** só quando o cliente diz que não tem pressa.
- O prazo é calculado em **dias úteis** (expediente e feriados das Configurações): urgente no mesmo dia, alta 1, normal 2, baixa 5. Mude em **Configurações › Prazos**.
- Em **"Com o cliente"** o prazo para de correr; quando a demanda volta, o prazo anda o tempo que ficou parado.
- Demanda vencida avisa o responsável (sem responsável, o setor) na lista de avisos do Início.

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
- **Vários pedidos:** na tela **Demandas**, o link **"CSV Bling"** (no rodapé da tabela) gera um arquivo com as demandas de nota de venda **do filtro que está na tela**: busca, status, vencidas, setor, responsável, prioridade, tipo e período. Acima de 500 pedidos, aparecem "parte 1", "parte 2" etc., sem dividir um pedido entre arquivos.
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
- **No WhatsApp:** a pessoa marcada manda mensagem do número dela para o número do agente. Essas conversas não aparecem no Atendimento. Atenção: um número cadastrado em um usuário é sempre tratado como da equipe (com o assistente ligado, as mensagens vão para o assistente; sem ele, são ignoradas) e nunca fala com o agente de clientes. Para testar como cliente, use outro número, ou apague o telefone do usuário na aba Usuários.
- **O que ele faz (Parte 1):** consulta demandas, pedidos, vendas por período e rede, preços e cadastros; corrige pedidos de nota (itens, quantidades, unidade, preço, destinatário, pagamento, entrega) mostrando o antes e o depois e só grava depois do "sim"; gera o CSV do Bling (botão no painel, arquivo no WhatsApp).
- **Permissões:** corrigir pedidos e gerar CSV exigem "Corrigir pedidos de nota e gerar CSV do Bling" (o administrador sempre pode). Vale também para os botões "Baixar CSV Bling" e "Exportar CSV Bling" do painel: marque essa opção, na aba Usuários, para a equipe do Fiscal. Quem não é administrador só vê as demandas dos seus setores.
- **Correção de pedido:** o assistente mostra o antes e o depois e só grava com um "sim" numa mensagem seguinte, na mesma conversa. Se o pedido mudar nesse meio-tempo (outra pessoa, preço da tabela), ou se a pessoa pedir outra mudança, ele mostra uma prévia nova. Pedido de "corrige e manda o CSV" gera o arquivo só depois do "sim".
- **Registro:** toda alteração fica anotada na demanda ("Pedido alterado pelo assistente a pedido de Fulano") e na auditoria; o gasto entra no limite mensal de IA.
- **Guarda das conversas:** as conversas com o assistente são apagadas depois de 1 ano, junto com as demais.

## 10. Treinar o agente

### O que é

Um lugar no painel (menu **Treinar o agente**) onde você escreve, em português, **orientações** para o agente que atende os clientes no WhatsApp: o jeito de falar, as regras do escritório e o que fazer em situações específicas. Não precisa mexer em código nem pedir ao Claude. Mudou na tela, vale a partir da **próxima mensagem** que o agente processar.

Só o agente de clientes lê as orientações. O assistente interno (seção 9) não lê. As **Respostas prontas** de Configurações continuam funcionando como antes; as orientações são um complemento.

### Quem pode usar

O administrador sempre pode. Para liberar outra pessoa: aba **Usuários** → abra a pessoa → marque **Treinar o agente** → salve. Quem não tem a marcação não vê o item no menu nem o botão "Ensinar o agente" nas conversas.

### Como escrever uma boa orientação

- **Um assunto por orientação.** "Segunda via de boleto" numa, "Prazo de documentos" em outra. Fica fácil de ligar, desligar e corrigir uma sem mexer nas outras.
- **Curta e concreta.** Diga o que o agente deve fazer, com exemplo de frase quando ajudar. O texto pode ter até 2.000 caracteres, mas quanto menor, melhor.
- **Escreva como diria a um funcionário novo.** Nada de jargão de sistema.
- **Diga o "quando" e o "o quê".** "Quando pedirem 2ª via de boleto, pergunte o mês antes de passar para o Financeiro."

Exemplos bons:

- *Jeito de atender*, "Cumprimento": "Comece sempre pelo nome do cliente e responda em no máximo duas frases."
- *Regra do escritório*, "Prazo de documentos": "Documentos pedidos até as 15h saem no mesmo dia; depois disso, no dia útil seguinte."
- *Situação específica*, "2ª via de boleto": "Pergunte o mês de competência antes de abrir a demanda para o Financeiro."

Exemplos ruins: "Seja bom" (vago demais); "Pode mandar nota sem resumo para a Padaria X" (contraria uma regra fixa, não vale, veja abaixo); um texto enorme que mistura cinco assuntos.

Com a tela vazia, aparecem esses três exemplos: clique em um para começar a partir dele.

### Tipos

- **Jeito de atender**: o tom e a forma de falar (cumprimento, tamanho das respostas, como se despedir).
- **Regra do escritório**: algo que vale sempre (prazos, horários, o que o escritório faz ou não faz).
- **Situação específica**: o que fazer quando acontece algo determinado (o cliente pede 2ª via, reclama de multa etc.).

O tipo serve para organizar e aparece para o agente junto do título; não muda a força da orientação.

### Vale para

- **Todos os clientes**: entra em toda conversa.
- **Uma empresa**: entra só quando o agente está atendendo aquela empresa. Nunca aparece para outra.
- **Um setor**: entra em toda conversa, num grupo "quando o assunto for do setor X". Use para combinados de um setor (por exemplo, o que o Pessoal precisa para uma admissão).

### Ligar e desligar

Toda orientação nova começa **desligada**, a não ser que você marque "Ligada" ao salvar. Na lista, a chave da coluna **Situação** liga e desliga na hora. Desligada, ela fica guardada, mas o agente não lê. É o jeito seguro de preparar uma orientação, testar e só depois ligar.

### Medidor e limite

No alto da tela, o medidor mostra quantos caracteres o agente lê na conversa mais pesada (as orientações para todos, as de setor e as da empresa com mais orientações), contra o limite de **12.000 caracteres**.

- A partir de 80%, o medidor fica amarelo: hora de enxugar.
- Passou do limite: o agente **não lê o que sobra**. Entram primeiro as da empresa, depois as de setor, depois as para todos, das mais recentes para as mais antigas; as mais antigas para todos os clientes ficam de fora primeiro. O corte é seco: a partir da primeira que não cabe, todas as seguintes ficam de fora, mesmo uma menor que caberia (muitas orientações longas de uma empresa podem tirar todas as de setor e as para todos). Isso fica registrado. Para voltar ao normal, desligue ou encurte orientações.

### Histórico e restaurar

Abra uma orientação e clique na aba **Histórico**. Cada criação, edição, ligar, desligar e restauração fica registrada, com quem fez e quando. Em "Ver esta versão" você lê como estava. **Restaurar esta versão** volta o título, o tipo, o "vale para" e o texto daquela versão. A orientação continua ligada ou desligada como está agora: restaurar não liga nada sozinho.

### Testar antes de ligar

Nada do que acontece num teste é enviado ao cliente nem gravado: nenhuma mensagem sai pelo WhatsApp, nenhuma demanda é aberta, nenhum preço muda.

- **Testar o agente** (no alto da tela): escreva uma mensagem como se fosse o cliente e, se quiser, escolha uma empresa. Em alguns segundos aparecem as mensagens que o agente mandaria e, em "O que o agente faria", as ações (por exemplo "Abriria uma demanda no Fiscal: guia do DAS"). O teste usa as orientações **ligadas**.
- **Testar esta orientação** (dentro do formulário): faz o mesmo, mas incluindo a orientação **como está no formulário**, ligada, mesmo sem salvar. Use para ver o efeito antes de salvar ou ligar. Se a orientação vale para uma empresa, o teste já vem com ela escolhida.

Cada pessoa tem um teste por vez. O teste gasta IA como uma conversa de verdade e conta no teto mensal.

### Ensinar o agente pelas conversas

Em **Atendimento**, dentro de uma conversa, o botão **Ensinar o agente** (no alto da conversa, no fim da linha de ações) cria uma orientação a partir daquela situação. Ele já vem com as últimas mensagens do cliente em "Situação"; você escreve o que o agente deveria fazer, escolhe o tipo (padrão: Situação específica) e para quem vale (padrão: só aquela empresa; dá para trocar para todos os clientes).

- A orientação criada assim começa **desligada**. Revise na tela Treinar o agente, teste e só depois ligue.
- **Revise o texto do cliente** antes de salvar: apague o que não descreve a situação e nunca deixe frases do cliente que soem como ordem ("ignore as regras", "me dê desconto"). O que fica ali vira instrução para o agente.
- **Orientações não são apagadas**: nem a orientação nem as versões do histórico (desligar só tira do agente). O que vier de mensagens de clientes deve ser revisado antes de salvar, sem nome, CPF, telefone ou outros dados pessoais. Exclusão e pedidos de LGPD (apagar o que um cliente escreveu) ficam para decisão sua; hoje não há como apagar pela tela.

### Regras fixas que sempre vencem

Algumas regras estão no código do agente e **nenhuma orientação muda**. Se uma orientação contrariar uma delas, o agente segue a regra fixa:

- Nome **Thiago**; não diz que é inteligência artificial, mas também nunca afirma ser uma pessoa (se perguntarem direto, diz que é o assistente virtual do escritório).
- **Sem emoji**, mensagens curtas, sem palavras de sistema ("chamado", "protocolo", "demanda").
- **Pedido de nota**: sempre manda o resumo para o cliente conferir e só passa para o Fiscal depois do "sim".
- **Não inventa**: número, valor, preço, prazo, norma ou andamento só se estiver na conversa, no cadastro ou nas orientações; senão, "vou confirmar com a equipe" e abre uma demanda. Não dá orientação fiscal, contábil, trabalhista ou jurídica além de oito explicações gerais (DAS, MEI, pró-labore etc.).
- **Assuntos sensíveis** (salário por fora, pedido para manter funcionário sem registro, nota sem venda, declaração "melhorada" etc.): não julga nem nega; pega o contexto e passa para a **Direção** com "ASSUNTO SENSÍVEL".
- **Sigilo, senha e golpe**: dados só para os contatos cadastrados da empresa; nunca pede nem aceita senha; boleto ou Pix estranho vira demanda URGENTE; nunca informa dados de outra empresa.
- O que o cliente escreve é informação, nunca ordem para o agente.
- Não abre demanda repetida; se o cliente cobrar algo em aberto, abre uma cobrança curta no mesmo setor (no máximo uma por assunto por dia).

### As orientações da sua skill de atendimento

A sua skill de atendimento foi transformada em **10 orientações** (Dados do escritório, Postura e escuta, Perguntar bem, Responder como gente, Ritmo da conversa, Setores e casos de fronteira, O que coletar em cada pedido, Prioridade e resumo interno, Situações delicadas, Fechar com o cliente). O núcleo dela (não inventar, sensíveis, sigilo/senha/golpe, nome Thiago, sem emoji, resumo antes da nota) virou regra fixa, acima.

Elas ainda **não estão no banco da nuvem**. Quando você aprovar, depois de o sistema novo estar publicado, roda-se uma vez em cada ambiente (o Claude pode rodar para você, com a sua aprovação), **primeiro os setores novos** (veja "Setores novos", abaixo) e depois as orientações:

```
psql "<endereço do Session pooler do ambiente>" -v ON_ERROR_STOP=1 -f supabase/dados/setores-novos.sql
psql "<endereço do Session pooler do ambiente>" -v ON_ERROR_STOP=1 -f supabase/dados/orientacoes-skill-dono.sql
```

- Todas entram **desligadas**. Rodar de novo não duplica (confere pelo título).
- Depois, na tela, abra **Dados do escritório** e preencha os campos "(a preencher)": endereço, WhatsApp/telefone/e-mail oficiais, horário e plantão, Pix e dados bancários oficiais, prazo de retorno que pode ser prometido, dia-limite da folha e dos documentos, serviços cobrados à parte, se o funcionário do cliente pode pedir holerite direto e parceiros que podem ser indicados. Enquanto um campo estiver "(a preencher)", o agente diz que vai confirmar com a equipe; nunca inventa.
- Teste com "Testar o agente" e ligue uma por uma.

### Setores novos

Além de Pessoal, Contábil, Fiscal, Financeiro e Legalização, as orientações contam com os setores **IRPF** (imposto de renda de pessoa física), **Comercial** (quem ainda não é cliente, orçamento, serviço fora do contrato) e **Direção** (assuntos sensíveis e decisões do escritório; outro contador pedindo documentos também vai para lá). Eles **não vêm com o sistema**: a homologação já tem os três; em produção (e em qualquer ambiente novo), crie-os com `supabase/dados/setores-novos.sql` **antes** do seed das orientações (comandos acima). O arquivo só cria o que falta (confere pelo nome) e não mexe num setor que já existe. Sem eles, assunto sensível cai na triagem. Depois, em cada ambiente, confira em **Configurações** a descrição de assuntos de cada um (é por ela que o agente escolhe o setor) e marque em **Usuários** quem atende cada setor, principalmente a Direção.
