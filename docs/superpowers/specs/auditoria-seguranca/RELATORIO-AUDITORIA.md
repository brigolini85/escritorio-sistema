# Auditoria de segurança da produção: o que precisa ser resolvido

Data: 08/10/2026. Código auditado: `8242a24`, a versão que está no ar.
Como foi feita: 6 auditores trabalharam em paralelo, cada um numa área. Tudo foi feito só lendo o código e rodando testes que não usam banco. Ninguém tocou na produção, nenhuma mensagem foi enviada e nada foi alterado. Os achados altos foram conferidos de novo, um a um, no código. Os relatórios técnicos completos, com arquivo, linha e teste de cada achado, estão na pasta `detalhes/` ao lado deste arquivo.

---

## 1. Resumo para decidir

**Não há nenhum achado crítico.** Nenhuma falha deixa alguém de fora, um cliente no WhatsApp ou um visitante da internet, ler dados de outra empresa ou agir sem permissão de forma direta e imediata.

**O que está bem feito (com evidência):**
- **Isolamento entre empresas no agente.** Todo ID que a IA usa é conferido contra a empresa em foco, e o acesso do contato é relido no banco a cada ferramenta. Um contato da empresa A não chega aos dados da B.
- **Banco.** As 63 tabelas têm regras de acesso (RLS) e nenhuma está aberta a visitante. As 271 funções privilegiadas têm o `search_path` fixo e as 134 que a equipe pode chamar conferem permissão.
- **Mensagem repetida do WhatsApp** é descartada de forma segura, pelo próprio banco.
- **Trava de ambiente.** Fora da produção, só os telefones da lista recebem mensagem, e isso vale para todo tipo de envio.
- **Simulador, Sugerir resposta e assistente interno** não conseguem gravar nem enviar nada indevido.
- **Dois trabalhadores** não atendem a mesma conversa ao mesmo tempo, e as rotinas automáticas não se duplicam.

**O que impede chamar o sistema de "fechado" hoje (9 achados altos):**

| # | Problema, em uma linha | O que pode acontecer |
|---|---|---|
| A1 | O segundo fator só vale na tela do painel, não no banco | Com **só a senha** de um administrador, alguém lê todas as conversas, muda permissões e configurações, cadastra o próprio celular no assistente interno e dispara mensagens em massa, chamando o Supabase direto |
| A2 | Quem tem "Treinar o agente" muda o atendimento de todos os clientes sem segundo fator | Uma orientação falsa ("nosso Pix agora é...") faz o agente confirmar um Pix de golpe a quem perguntar |
| A3 | O webhook do WhatsApp só é protegido por uma senha na URL, e essa senha pode ir para o log | Quem tiver a senha forja mensagens de cliente e da equipe, cala o agente e faz o servidor baixar qualquer endereço |
| A4 | O pedido de nota não exige de verdade o "sim" do cliente | Nota aberta antes da confirmação, em dobro com um segundo "sim", ou com o destinatário de um pedido anterior |
| A5 | Qualquer número pode gastar o teto mensal de IA | Alguém de fora manda PDFs e mensagens até o teto acabar, e o agente para para todos os clientes até o fim do mês |
| A6 | Implantar ou reiniciar no meio de um atendimento | A conversa fica parada até 20 min e depois a resposta e a demanda saem em dobro |
| A7 | Dois trabalhadores vivos com configurações diferentes (o incidente de ontem) | Parte dos clientes fica sem resposta e ninguém é avisado |
| A8 | Não há cópia dos arquivos (anexos e documentos) e a restauração nunca foi testada | Perda definitiva de documentos; restaurar o banco reenvia mensagens aos clientes |
| A9 | O próximo pacote (catálogo) reusa números de migração que já estão na produção | A atualização do catálogo não seria aplicada ou travaria a subida. **Não afeta o que está no ar**, só a próxima versão |

**Contagem:** 74 achados nos relatórios. Tirando os repetidos entre áreas, sobram **68: 0 críticos, 9 altos, 31 médios e 28 baixos.**

---

## 2. O plano: o que eu faço e em que ordem

Todas as correções no código ficam numa branch separada (`seguranca-auditoria`), com um teste para cada problema que mostra a falha antes e a correção depois. Nada vai para a `main` nem para o banco da produção sem você aprovar.

### P0: corrigir já (risco real de invasão, golpe ou ação indevida)

| Item | Achados | O que vou mudar | Como saberemos que resolveu |
|---|---|---|---|
| **1. Segundo fator dentro do banco** | 2.1, 2.4, 2.8, 5.3 | Toda regra de acesso do banco passa a exigir o código do aplicativo para quem é obrigado a usá-lo (administrador, quem vê portais e o **dono**). Pessoas, permissões e configurações só mudam pelas funções do sistema, nunca por escrita direta. Telefone da equipe único e diferente do telefone de qualquer contato | Teste no banco: com só a senha, ler conversas devolve 0 e alterar pessoa, permissão, configuração ou telefone é recusado. Com o código, tudo funciona. O trabalhador não é afetado |
| **2. Treinar e mensagens automáticas protegidos** | 5.1, 6.7 | "Treinar o agente" e as mensagens automáticas (LGPD, fora do horário, IA indisponível) passam a exigir o segundo fator. Dados bancários e Pix saem das orientações e vão para um campo próprio em Configurações, que só o administrador com segundo fator altera. Quando uma orientação geral for ligada, você recebe um alerta | Teste: usuário com "Treinar" e só a senha não grava orientação. Orientação citando Pix não muda o Pix que o agente informa. Alerta registrado ao ligar uma orientação |
| **3. Webhook fechado** | 3.1, 3.4, 3.5 | O segredo nunca mais vai para o log, nem no erro 404. O webhook confere também se o evento é da **nossa** instância da Z-API. O download de mídia só aceita endereços da Z-API e do armazenamento dela. Entra um limite de requisições por minuto | Teste: pedido com barra a mais não deixa o segredo no log. Evento de outra instância é ignorado. Mídia de endereço estranho não é baixada. A requisição 121 no mesmo minuto é recusada |
| **4. Pedido de nota com confirmação de verdade** | 1.1, 5.5 | O resumo vira um registro com número próprio. A nota só abre se o cliente respondeu depois do resumo, numa mensagem nova. Cada resumo só abre uma vez. Se o preço mudou depois do resumo, manda um resumo novo. Acaba o "casamento" pelo jeito parecido | Testes: resumo e abertura na mesma vez → recusado. Dois "sim" → uma nota só. Pedido para Y com resumo antigo de X → recusado. Preço mudou → novo resumo |
| **5. Mudança de preço e cadastro de produto com confirmação de verdade** | 1.2, 5.4 | Funciona em duas etapas. O **sistema** (não a IA) manda "Confirma: Costela, rede Brasil, de R$ 12,00 para R$ 10,00? Responda SIM". A mudança só vale se o cliente responder depois, dentro de 30 min, e se o preço ainda for o antigo | Testes: confirmação na mesma vez → recusada. Depois de 31 min → recusada. Dois "SIM" → uma mudança só |
| **6. Limite de gasto por número** | 4.2, 5.2, 4.5, 5.7 | Limite diário de custo por número, mais baixo para quem não é cliente cadastrado, e limite de anexos e de texto por atendimento. Ao passar do limite, a conversa vai para a equipe com aviso, e o agente continua atendendo os outros clientes | Teste: um número que estoura o limite do dia é passado à equipe, e outro número continua sendo atendido |

### P1: corrigir em seguida (exige uma condição menos comum ou causa erro operacional)

| Item | Achados | O que vou mudar |
|---|---|---|
| **7. Reinício e implantação sem resposta em dobro** | 4.1, 4.4, 4.6, 4.10 | Ao desligar, o trabalhador termina a vez em andamento ou solta a trava. A trava é renovada enquanto a vez roda. Ao refazer um atendimento interrompido, o sistema sabe o que já foi feito (demanda e resposta) e não repete |
| **8. Detectar dois trabalhadores** | 4.3, 3.13 | Cada trabalhador se registra no banco. Se aparecer outro com versão ou ambiente diferente, ele para de pegar trabalho, você recebe alerta crítico e o `/saude` fica vermelho. Na partida, o trabalhador confere se o `AMBIENTE` dele bate com o do banco |
| **9. Envio com resultado incerto** | 3.2, 3.3, 3.6 | Quando a Z-API demora mas entregou, a mensagem fica "incerta", e não "falhou". O eco a reconhece, e a conversa não vira "humano" por engano. A resposta do painel não é enviada duas vezes |
| **10. Documento amarrado à empresa** | 1.3, 6.10 | O banco só aceita o arquivo dentro da pasta da própria empresa, e isso não pode ser trocado depois. O trabalhador confere de novo antes de enviar |
| **11. Empresa em foco antiga** | 1.4, 3.9, 1.5, 1.6 | Quando o contato perde o vínculo, o foco é limpo. Mensagens e demandas não ficam na empresa antiga. A Triagem só é completada se for da mesma empresa |
| **12. Contato duplicado pelo 9º dígito** | 3.8, 3.10 | O cadastro recusa o mesmo número com e sem o 9. A busca do contato deixa de escolher "um qualquer" |
| **13. Login à prova de travamento** | 2.3, 2.6 | Limite de tentativas por IP e por e-mail no próprio painel, com o IP real repassado. Trocar senha só pelo link de recuperação ou informando a senha atual |
| **14. Limites de ações por atendimento** | 5.6 | No máximo N demandas, N mensagens e N documentos por vez. Acima disso, passa à equipe |
| **15. Alerta quando a IA cai de vez** | 4.8, 4.9, 4.7, 4.13 | Chave inválida ou limite da Anthropic gera alerta ao dono, e não só Triagem silenciosa. O `/saude` passa a medir a fila de conversas, a idade da mensagem mais antiga sem resposta e os envios com falha |

### P2: robustez e LGPD

| Item | Achados | O que vou mudar |
|---|---|---|
| 16. Retenção real igual à prometida | 6.3, 6.4, 6.5, 4.17 | A limpeza passa a cobrir o que o manual promete, registra o resultado e alerta quando falha. Entra uma varredura de arquivos órfãos |
| 17. Painel mostrando as mensagens mais novas | 6.6 | A conversa com mais de 1000 mensagens não esconde mais as últimas |
| 18. Cookies e downloads | 2.2 (código), 2.10, 2.7 | Cookies só por https. Downloads com "não guardar em cache". Segredo próprio para o cookie de atividade. A auditoria de download falha fechada |
| 19. Implantação mais segura | 6.8, 2.9 | Cópia do banco antes de cada `db push`, versão fixa da ferramenta do Supabase e conta de banco restrita para a fila do painel |
| 20. Higiene | 6.11, 6.12, 6.13, 6.14, 5.8, 5.9, 5.10, 4.11, 4.12, 4.14, 4.15, 4.16, 3.7, 3.11, 3.12, 1.7, 1.9, 1.10 | Índices, funções antigas, atualizar o `nodemailer`, delimitação de mais campos, alerta de 80% sem duplicar, pool de conexões, rastreio por id, aviso LGPD sem duplicar, funções de preço olhando `ativo` e o perfil coerente com as marcações |

### P3: antes da próxima atualização (catálogo)
- **A9 / 6.1:** renumerar as migrações do plano `atendimento-catalogo` para depois de `20261029000200` e conferir no `db push --dry-run`.

---

## 3. O que depende de você (fora do código)

Faça na ordem. Para os que mexem na produção, eu te passo o passo a passo detalhado na hora.

1. **Trocar o segredo do webhook (urgente, depois do item 3).** Ele pode já ter ido para o log em algum 404. Eu gero um novo, você troca no Easypanel (`WEBHOOK_SEGREDO`) e na Z-API (endereço do webhook).
2. **Supabase da produção → Authentication → Sessions:** confira se "Time-box user sessions" está em 12 h e "Inactivity timeout" em 1 h, e se estão **salvos**. Sem isso, uma sessão roubada vale indefinidamente pela API.
3. **Cópia dos arquivos:** decidir onde guardar a cópia cifrada do banco e dos 3 grupos de arquivos (anexos, documentos, tarefas), por exemplo no Google Drive do escritório ou num armazenamento S3. Eu monto a rotina e o procedimento de restauração.
4. **Guardar a `ACESSOS_PORTAIS_CHAVE` num cofre**, como um gerenciador de senhas, fora do Easypanel. Se ela se perder, todas as senhas de portais ficam ilegíveis.
5. **Um trabalhador só:** depois de cada implantação no Easypanel, confira no log que aparece um hostname só. Até o item 8 ficar pronto, isso é manual.
6. **Teste do segundo aplicativo autenticador** (achado não verificável da Área 2): com uma conta de teste que já tem o aplicativo, entrar só com a senha e tentar cadastrar um segundo aplicativo. Se o Supabase deixar, o problema vira crítico. Eu preparo o teste com você.
7. **Duas consultas de leitura no SQL Editor da produção** (não alteram nada), para medir o tamanho real de dois problemas:
   - documentos com caminho fora da pasta da empresa;
   - contatos "Básico" que ainda têm "pode pedir nota" ou "pode mudar preço".

   Eu te mando o texto pronto.
8. **Anthropic:** confira se o workspace "Producao" tem limite de gasto mensal ligado.

## 4. Decisões que são suas

- **Contato Básico com "pode pedir nota" (achado 1.8):** hoje o Básico ainda consegue pedir nota, ver preço e mudar preço se tiver essas marcações antigas. Recomendo **bloquear até alguém definir o acesso** (mais seguro).
- **Limite diário por número (item 6):** sugestão inicial de US$ 2 por dia para cliente cadastrado e US$ 0,30 para número desconhecido. Dá para ajustar depois em Configurações.
- **Dados bancários e Pix (item 2):** confirme que eles passam a ficar só em Configurações, e não mais em orientações.

---

## 5. O que não foi possível verificar daqui

- **Configuração real do Supabase da produção:** limites de sessão, de e-mail e de login.
- **Logs do Easypanel:** se o segredo já apareceu.
- **Cópias de segurança que existem de fato.**
- **Comportamento real da IA** nos cenários de confirmação: com que frequência ela pularia o "sim". Por isso as correções 4 e 5 tornam a regra obrigatória no código, independentemente do modelo.
- **Testes que usam o banco local:** não foram rodados durante a auditoria, para não interferir com o banco compartilhado. Vão rodar na fase de correção.
