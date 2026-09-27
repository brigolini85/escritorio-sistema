# Plataforma do Escritório: Documento de Visão

**Data:** 2026-09-27
**Status:** aguardando revisão do dono
**Spec detalhada da primeira entrega:** `2026-09-27-etapas-1-2-atendimento-notas-design.md`

---

## 1. Contexto

Escritório de contabilidade com cerca de 30 clientes. A maioria emite nota de serviço, e uma indústria concentra o maior volume de NF-e de venda. Hoje o dono e um funcionário atendem todas as demandas pelo WhatsApp Business do escritório. O dono faz quase tudo e repassa parte ao funcionário.

**Dores atuais:**
- Emissão de notas manual. O preço de cada comprador é descoberto consultando a última nota no Bling, e compradores com matriz e filiais exigem identificar a unidade certa a partir de referências informais ("emite pra Hortsul Itabira")
- A nota é emitida primeiro e conferida pelo cliente depois. Erros viram cancelamento ou reemissão
- Duas pessoas no mesmo WhatsApp: conversas se misturam, demandas são esquecidas e o dono atua como distribuidor manual
- Cobrança manual e repetitiva de documentos mensais dos clientes

**Sistemas atuais:**
- NF-e: Bling (a indústria) e Emissor Sebrae
- NFS-e: portais de cada prefeitura e Portal Nacional da NFS-e
- Domínio: demandas internas de todos os departamentos (não emite nota)
- Google Drive: `Clientes / <Cliente> / DEP PESSOAL | DEP CONTABIL | DEP FISCAL | DEP FINANCEIRO | DEP LEGALIZACAO / <Obrigação> / <Ano> / <Mês>`

## 2. Objetivo

Uma plataforma única do escritório, em que um agente de IA atende os clientes pelo WhatsApp e resolve sozinho tudo o que conseguir. O que ele não consegue vai para a pessoa certa, organizado por setor. Com o tempo, a plataforma cobre todos os processos internos do escritório.

## 3. Princípios

1. **O agente faz o que consegue; o resto vai para uma pessoa.** À medida que os processos amadurecem (e os POPs ficam prontos), mais tipos de demanda passam para o agente.
2. **A IA entende, o código valida.** Preço, destinatário, permissões e aprovações são verificados por regras fixas de código. A IA nunca é a última palavra em nada que gere efeito fiscal.
3. **Em dúvida, pergunta.** O agente nunca chuta preço, unidade, produto ou mês de referência.
4. **Peças trocáveis.** WhatsApp (Z-API → Meta), emissores de nota (Bling, Portal Nacional, prefeituras) e serviços externos ficam atrás de interfaces próprias. Trocar um não afeta o resto.
5. **Operação sem código.** O dono não programa. Tudo o que é do dia a dia (usuários, setores, regras, clientes, preços, mensagens) é configurável no painel. Mudanças estruturais são feitas via Claude Code, protegidas por testes automáticos.
6. **Dados separados por cliente desde o primeiro dia.** Toda tabela com dado de cliente carrega `cliente_id` e é protegida por RLS, o que permite construir o portal do cliente sem reestruturar nada.
7. **Nada se perde, nada duplica.** Filas persistentes, idempotência nas emissões e retomada automática após falhas.

## 4. Módulos da plataforma

| # | Módulo | Escopo |
|---|---|---|
| 1 | Atendimento | WhatsApp, agente de triagem, chamados, atendimento humano pelo painel (vários atendentes, um número) |
| 2 | Usuários e acessos | Logins, perfis (administrador, atendente, futuro cliente), setores, permissões por pessoa |
| 3 | Clientes do escritório | Dados cadastrais, contatos autorizados e suas permissões, serviços do contrato, responsável por setor, certificados digitais com aviso de vencimento, procurações |
| 4 | Cadastros comerciais dos clientes | Clientes deles (grupos, matriz/filiais, apelidos), fornecedores, produtos, tabelas de preço por grupo com histórico |
| 5 | Notas fiscais | NF-e via Bling (venda, devolução), NFS-e via Portal Nacional, NFS-e via prefeituras (plataforma intermediária), cancelamento, carta de correção |
| 6 | Documentos | Recebimento pelo WhatsApp, identificação do tipo e do mês de referência, salvamento no Google Drive na estrutura existente, documentos esperados por cliente, cobrança automática escalonada |
| 7 | Obrigações e prazos | Calendário de obrigações por cliente, controle do que foi entregue e do que está atrasado |
| 8 | Fiscal, contábil e pessoal | Informações e rotinas de cada área por cliente, com integração ao Domínio no que for viável |
| 9 | POPs / base de conhecimento | Procedimentos por tipo de demanda, anexados aos chamados, consultáveis pela equipe e pelo agente |
| 10 | Financeiro do escritório | Honorários, cobrança dos clientes, reajustes de contrato |
| 11 | Comercial | Leads, propostas, serviços extras. Demandas fora do contrato já chegam marcadas como oportunidade |
| 12 | Portal do cliente | Login por cliente, dashboards, documentos e chamados da própria empresa |
| 13 | Indicadores internos | Volume de demandas, tempo de resposta, produtividade, notas emitidas |

## 5. Como os módulos se conectam

```
                 WhatsApp (Z-API → Meta)
                          │
                    ┌─────▼─────┐
                    │  AGENTE   │── consulta ──► Clientes (3), Cadastros comerciais (4), POPs (9)
                    └─┬───┬───┬─┘
         nota fiscal  │   │   │ documento
              ┌───────▼┐  │  ┌▼──────────┐
              │ Notas  │  │  │ Documentos│──► Google Drive
              │  (5)   │  │  │    (6)    │◄── Obrigações (7): o que é esperado e quando
              └───┬────┘  │  └───────────┘
      Bling / Portal Nac. │ precisa de pessoa
      / Prefeituras   ┌───▼─────────┐
                      │ Chamados (1)│──► Setores e usuários (2)
                      └───┬─────────┘
                          │ fora do contrato ──► Comercial (11)
                          ▼
                 Indicadores (13) · Portal do cliente (12) leem tudo, filtrado por RLS
```

## 6. Arquitetura técnica (comum a todos os módulos)

- **Linguagem:** TypeScript em todo o sistema
- **Painel web:** Next.js
- **Banco, login, tempo real e arquivos:** Supabase na nuvem (Postgres com RLS, Auth, Realtime, Storage). Plano gratuito no desenvolvimento, plano Pro antes de entrar dado real (backups diários, sem pausa por inatividade)
- **Trabalhador:** serviço Node separado do painel. Recebe webhooks, roda o agente, executa a fila e as tarefas agendadas
- **Fila:** persistente dentro do Postgres
- **IA:** Claude. Modelo menor (Haiku) para classificar e extrair, modelo mais capaz (Sonnet) para conversar e decidir
- **Hospedagem:** Easypanel na VPS Hostinger do escritório (painel e trabalhador como serviços separados)
- **Código:** GitHub. Publicação automática no Easypanel apenas se os testes passarem
- **Monitoramento:** monitor externo de disponibilidade + alertas por WhatsApp do dono, e-mail e painel

**Perfis de acesso (RLS):**
- **Administrador:** acesso total
- **Atendente:** conversas e chamados dos seus setores, consulta de clientes, permissões extras concedidas por pessoa
- **Cliente** (módulo 12): apenas registros com o próprio `cliente_id`

## 7. Ordem de construção

| Etapa | Conteúdo | Spec |
|---|---|---|
| 1 | Base + Atendimento (módulos 1, 2 e núcleo do 3) | Detalhada em `2026-09-27-etapas-1-2-atendimento-notas-design.md` |
| 2 | Notas da indústria: módulo 4 + NF-e via Bling (módulo 5) | Mesmo arquivo acima |
| 3 | Documentos: recebimento, Drive, documentos esperados, cobrança automática (módulo 6 + parte do 7) | Própria, a escrever |
| 4 | NFS-e via Portal Nacional | Própria, a escrever |
| 5 | NFS-e via prefeituras (plataforma intermediária) | Própria, a escrever |
| 6+ | POPs, obrigações completo, indicadores, financeiro, comercial, fiscal/contábil/pessoal, portal do cliente | Uma spec por módulo |
| Paralelo | Migração Z-API → API oficial da Meta. A verificação da empresa na Meta começa **no primeiro dia** do projeto, porque o número usado na Z-API é o que os clientes conhecem e um bloqueio teria custo alto | Própria, curta |

**Decisão de negócio pendente, fora do software:** clientes que emitem pelo Emissor Sebrae não têm API. Precisam migrar para um emissor com API (ex.: Bling) ou continuar manuais.

## 8. Custos estimados (etapas 1 e 2)

| Item | Estimativa mensal |
|---|---|
| VPS Hostinger + Easypanel | já contratada |
| Supabase Pro | ~R$ 140 (a partir da produção) |
| Z-API | ~R$ 100 a 200 |
| Claude | ~R$ 50 a 150 |
| Transcrição de áudio | poucos reais |
| Consulta de CNPJ/IE | poucos reais |
| **Total** | **~R$ 300 a 500** |

Os valores são estimativas e serão confirmados na implementação.
