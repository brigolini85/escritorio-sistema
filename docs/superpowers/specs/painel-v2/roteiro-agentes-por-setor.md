# Roteiro — agentes por setor (ideias aprovadas pelo dono em 02/10)

> **Atualização 02/10:** os agentes por departamento entraram no spec como **Parte I** (seção 7E de `spec-painel-v2.md`), com os 7 agentes escolhidos pelo dono: Atendimento (Thiago), Fiscal, Departamento Pessoal, Contábil, Comercial, Legalização e Radar de legislação. Este roteiro fica como histórico das ideias; o que vale é a Parte I.

Ideias de 02/10 que deram origem à Parte I. O que ainda não está na Parte I (campanhas ativas grandes, Financeiro, IRPF, Direção) segue aqui para depois.

## Organização

| Papel | Quem | O que faz |
|---|---|---|
| Porta de entrada | Thiago (já existe) | Único que conversa com o cliente; entende, identifica o setor, abre a demanda |
| Especialistas internos | Um por setor | Trabalham dentro da demanda: conferem, preparam, juntam documentos, deixam pronto para a pessoa do setor (sugerem; quem grava é uma pessoa) |
| Agentes ativos | Por setor, em campanhas | Procuram o cliente no dia certo (cobrar documentos, lembrar prazos, coletar informações); a mensagem sai pela voz do Thiago |

Base técnica (já desenhada): um motor só de agente com **perfis configuráveis** (`perfis_agente`, Prompt 5 da análise de arquitetura); orientações por setor na tela Treinar o agente; custo medido em Gastos com IA; e o **acesso por contato da Parte H** como filtro de segurança de todos eles — inclusive "Pode ser procurado pelo agente deste setor" para mensagens ativas.

## Ideias por setor

- **Fiscal:** pré-análise do pedido de nota (já desenhada); lembrete de obrigações (DAS, DCTFWeb); certificado digital vencendo.
- **Pessoal (DP):** coleta das variáveis da folha (todo mês, ex. dia 20: horas extras, faltas, admissões, desligamentos); checklist de admissão (RG, CPF, CTPS, comprovante) com conferência do que chegou; férias e rescisão com informações reunidas na demanda.
- **Contábil:** cobrança dos documentos do mês (extratos, notas) com lista de quem mandou e quem falta; envio do balancete pronto.
- **Financeiro (honorários do escritório):** 2ª via de boleto, lembrete de vencimento, aviso de atraso — só para quem tem "Ver valores".
- **Legalização:** checklist de abertura e alteração contratual; acompanhamento do processo na junta; alvarás vencendo.
- **IRPF:** campanha anual — pedir informes a cada pessoa física, acompanhar quem enviou, cobrar quem falta.
- **Comercial:** número desconhecido pedindo orçamento → qualifica (porte, regime, serviços) e agenda conversa com o sócio.
- **Direção:** resumo do dia, assuntos sensíveis, indicadores (ex.: clientes que mais demandam × honorário, cruzando com Gastos com IA).

## Ordem recomendada

1. Fiscal (pré-análise) · 2. Pessoal (coleta da folha) · 3. Contábil (cobrança de documentos) · 4. IRPF (campanha) · 5. os demais.

## Cuidados

- **Mensagens ativas pelo WhatsApp:** a Z-API não é a API oficial; mandar muitas mensagens sem o cliente ter escrito primeiro aumenta o risco de bloqueio do número. Para campanhas grandes (IRPF, cobrança de documentos), migrar antes para a **API oficial da Meta** (WhatsApp Cloud API) com modelos de mensagem aprovados, mantendo `envio.ts` como adaptador único.
- Começar por **um** agente, medir em Gastos com IA e na Início (quanto ele resolve sozinho), e só então replicar.
- Especialista nunca fala direto com o cliente na primeira versão e nunca grava sem uma pessoa aprovar.
