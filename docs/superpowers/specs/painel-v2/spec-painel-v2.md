# Painel v2 — o painel inteiro com identidade própria

Data: 01–02/10/2026 · Autor: dono do escritório (decisões) + Claude (desenho)
Base: branch `treinar-agente` (pré-requisito — o painel redesenhado e o Treinar o agente estão nela; a Parte A parte dela).
**Este arquivo é a fonte da verdade.** Tudo o que foi decidido nas conversas de 01 e 02/10 está aqui; se algo não está aqui, não foi decidido. Prompts de implementação: `prompts-para-colar.md`. Ideias futuras (agentes por setor): `roteiro-agentes-por-setor.md`. Análise de arquitetura e correções antes da produção: `analise-arquitetura.md`.

## 1. Objetivo

1. **Identidade própria (A).** O painel hoje tem a "cara padrão" de sistema gerado por IA (azul do shadcn, Inter, cinza frio, rótulo pequeno sobre título, etiquetas arredondadas, janelas centralizadas genéricas). Ele deve parecer um produto do escritório: grafite, vinho e champanhe, com navegação inspirada no Acessórias (sistema que a equipe já usa e aprova), **sem copiá-lo**; letra que cresce em tela grande.
2. **Cadastros com exclusão (B).** Hoje não dá para excluir nem inativar clientes e contatos pela tela. Passa a existir um único "Excluir…" que **arquiva** o que tem histórico e **apaga de vez** só o que nunca foi usado.
3. **Gestão de demandas (C).** Hoje o painel lateral da demanda não tem nenhuma ação, não há prioridade, prazo, busca, criação manual, edição nem quadro. A tela vira uma "gestão das demandas" completa.
4. **Usuários com permissões por nível e horário de acesso (D).**
5. **Atendimento (E)** que mostra quem precisa de quem, o contexto do cliente, responde mais rápido e explica o que o agente fez.
6. **Gastos com IA (F):** tudo o que gasta, por funcionalidade, por pessoa e por cliente.
7. **Demais telas (G):** Início por papel, Contatos, Assistente, Configurações, Treinar o agente.
8. **Cadastro completo do cliente e acesso por contato (H):** o que cada pessoa da empresa pode tratar com o escritório e com o agente.
9. **Agentes por departamento (I):** um agente por setor com skills próprias, tarefas de trabalho com aprovação, pedir ao agente pelo painel e WhatsApp, e o Radar de legislação.

**Critério de sucesso:** a equipe resolve qualquer demanda sem sair da tela Demandas; nenhum cadastro com histórico é perdido; o agente nunca revela a um contato o que ele não pode saber; o dono sabe quanto cada coisa custa; quem vê o painel não reconhece o "visual padrão de IA".

## 2. Fora do escopo

- Regras do agente, prompt, assistente, Bling (só recebem o que for necessário abaixo).
- Avaliação do cliente na demanda e "não lidas primeiro" na tela Demandas (exigem rastrear leitura) — fase futura. (No Atendimento, as não lidas entram na Parte E.)
- Visão de calendário de prazos — fase futura.
- Trocar o nome "Demandas" por "Solicitações" (decidido manter "Demandas").
- Logo do **cliente** no cadastro (decidido não ter).
- Campanhas ativas grandes por WhatsApp (IRPF, cobrança em massa) — dependem da API oficial do WhatsApp; ficam no roteiro (`roteiro-agentes-por-setor.md`). Os agentes por departamento entraram como Parte I.
- As correções de confiabilidade e de prontidão para produção da análise de arquitetura (Prompts 1 a 5 de `analise-arquitetura.md`) seguem em paralelo; não estão dentro destas partes.

## 3. Ordem de entrega

Nove partes, cada uma com plano, branch e testes próprios, nesta ordem (cada branch parte da anterior):

| Parte | O quê | Por que nesta ordem |
|---|---|---|
| A | Identidade visual (inclui o login novo) | Toca todas as telas; as telas novas já nascem no visual novo |
| B | Cadastros: arquivar / excluir / restaurar | Pequena, resolve a dor imediata |
| C | Gestão de demandas | A maior; depende do visual e dos padrões de A |
| D | Usuários e permissões por nível + horário de acesso | Mexe nas regras de visibilidade (RLS), com testes de regressão |
| E | Atendimento (seção 7A) | Desenhada depois; usa o visual de A e a Nova demanda de C |
| F | Gastos com IA (seção 7B) | Depois da E, porque mede também o "Sugerir resposta" |
| G | Início, Contatos, Assistente, Configurações, Treinar o agente (seção 7C) | Configurações primeiro dentro dela |
| H | Cadastro completo do cliente e acesso por contato (seção 7D) | Antes da produção, porque protege o que o agente revela |
| I | Agentes por departamento (seção 7E) | Por último; depende de E (Atendimento), F (custos) e H (acesso por contato e cadastro) |

Imagens de referência das telas: pasta `imagens/` ao lado deste arquivo. Elas mostram estilo e organização; medidas e textos finais seguem este spec. Dados nas imagens são de exemplo.

| Parte | Imagens que valem |
|---|---|
| A | `00-login`, `00-login-tela-grande`, `01-menu-e-clientes-arquivar` (menu), `02-excluir-de-vez` (janela) |
| B | `01-menu-e-clientes-arquivar`, `02-excluir-de-vez` |
| C | `03-demandas-tabela`, `04-demandas-quadro-e-nova`, `05-demanda-painel-lateral` |
| D | `06-usuario-cadastro` |
| E | `00-atendimento` |
| F | `00-gastos-ia` |
| G | `00-inicio-opcao-a` (admin) e `00-inicio-opcao-b` (quem atende), `00-contatos-opcao-a`, `00-assistente-opcao-b`, `00-configuracoes-opcao-a` (+ resumos de `-opcao-b`), `00-treinar-agente-opcao-b` |
| H | `00-cliente-cadastro`, `00-cliente-contatos-acesso` |
| I | `00-agentes-lista`, `00-agente-ficha`, `00-agente-tarefa-fechamento`, `00-agente-pedir`, `00-agente-radar` |

As outras opções (`00-contatos-opcao-b`, `00-assistente-opcao-a`, `00-treinar-agente-opcao-a`) ficam só como referência — **não implementar**.

### 3.0 Estado em 02/10/2026 (conferido no git e no documento "Arquitetura do sistema do escritório — 02/10/2026")

| Parte | Estado | Branch / teste |
|---|---|---|
| A | **Pronta e revisada** (inclui aviso do login, tamanho da letra por pessoa, testes de tela grande) | `painel-v2-parte-a` (13dde51) · painel em localhost:3002 |
| B | **Pronta e revisada**; migração 20261002000100 aplicada na homologação | `painel-v2-parte-b` (b63a9ed) · painel em localhost:3004 |
| C–H | Só especificação, imagens e prompts | — |

**Não refazer A nem B.** A Parte C parte de `painel-v2-parte-b`.

O que a Parte B fez além deste spec (já vale, considerar nas próximas partes):
- Pessoa da equipe arquivada deixa de receber demandas novas e o telefone dela passa a ser tratado como **contato desconhecido** (com a Parte H, isso significa perfil Básico).
- Contato arquivado cadastrado de novo volta **só com a empresa nova** (`cadastrar_contato`).
- Ninguém arquiva nem exclui o próprio acesso; contato apagado pela LGPD não volta.
- A chave "Ativo" saiu dos formulários (clientes, contatos, produtos, redes, unidades, usuários) — a situação agora é "ativo / arquivado" pelo Excluir… e Restaurar.

**Sobras da Parte B — fazer no começo da Parte C** (pequenas, apontadas na revisão de 02/10):
1. Ícones de editar nas linhas de Contatos e Usuários (spec 5.1).
2. "(inativo)" ainda aparece em Demandas → trocar por "arquivado" ou ocultar conforme o spec 5.1.
3. Restaurar uma unidade cuja rede está arquivada: a unidade volta mas não aparece → avisar na hora ("a rede X está arquivada; restaurar a rede também?") e restaurar as duas se a pessoa aceitar.
4. Mensagem "Este telefone já é de …" quando o dono é pessoa arquivada → dizer que está arquivada e oferecer o caminho (restaurar a pessoa ou usar outro telefone).
5. **Decisão do dono (02/10) — contato arquivado cadastrado de novo:** em vez de voltar só com a empresa nova, o painel **pergunta na hora**: mostra as empresas a que ele estava vinculado antes (com as marcações antigas) e deixa escolher quais voltam; nenhuma marcada por padrão; a empresa nova sempre entra. Ajustar `cadastrar_contato` para receber a lista escolhida e registrar na auditoria. (A outra decisão da Parte B — funcionário arquivado atendido como contato desconhecido — foi **confirmada** como está.)
6. Erro ao salvar em Usuários fecha o painel lateral e o aviso fica no topo (visto em 02/10 com telefone repetido) → mostrar o erro no próprio campo sem fechar (a Parte D troca o painel por página inteira; até lá, corrigir no painel atual).

Operação (não é código): trocar o trabalhador da porta 3001 (ainda na versão da Parte A) pelo da Parte B antes de testar o agente com arquivados.

### 3.1 Decisões gerais (valem para todas as partes)

- Termos da tela: Demanda (nunca "chamado"/"ticket"), Atendimento, Conversa, Empresa, Contato, Setor, Pedido de nota, CSV do Bling, Assumir, Devolver ao agente, Nota interna, Concluir.
- Fonte Plus Jakarta Sans; letra 14/15/16px conforme a largura da tela + preferência por pessoa (seção 4.2).
- Toda IA nova grava custo com funcionalidade e pessoa (Parte F); toda informação sobre cliente que o agente usa passa pelo filtro de acesso do contato (Parte H).
- Mudança no banco: migração incremental, testes pgTAP, `--dry-run` antes de aplicar na homologação e aprovação do dono.
- Nenhuma branch é juntada à `etapa-1` sem pedido do dono.

---

## 4. Parte A — Identidade visual "Grafite, vinho e champanhe"

Mudança só em `apps/painel` (tokens, casca, padrões, telas de login). Nenhuma regra de negócio, rota, `data-testid` ou texto usado por teste muda sem grep nos testes.

### 4.1 Cores (`src/styles/tokens.css`)

| Papel | Valor de referência | Uso |
|---|---|---|
| `--brand-base` (vinho) | `#7A2335` | botão principal, item ativo do menu, contadores de atenção, links |
| `--sidebar-bg` (grafite) | `#262223` | menu lateral e submenus (`#2F2B2C` para submenu / atalho) |
| `--sidebar-text` | `#E6E1E2` | texto do menu; divisórias `#3A3536` |
| `--accent-champagne` | `#C8A97E` (texto: `#A8865A`) | fio do item ativo, aro do logo, linhas decorativas do login, subtítulos, "prazo sugerido" |
| `--background` | `#F1EFEE` (cinza levemente quente) | fundo das telas |
| `--surface` | `#FFFFFF` | tabelas, painéis, janelas |
| `--danger` | `#B23A1E` (vermelho alaranjado) | vencido, urgente, excluir — sempre com ícone ou texto, nunca só cor, e distinto do vinho |
| `--warning` | `#C07A1E` | prioridade alta, atenção |
| `--success` | `#0F5446` | concluído no prazo, agente ativo |

- **Cores de ícone por módulo** (paleta própria, sóbria, não a do Acessórias): Início `#D6AE5C`, Atendimento `#5DBB8F`, Demandas `#A6C95A`, Clientes `#6E9BC9`, Contatos `#A98BCB`, Assistente `#D6AE5C`, Treinar o agente `#E0894A`, Configurações `#4FB0B8`, Gastos com IA (só admin, ícone de moeda) `#C8A97E`. Item ativo: ícone e texto brancos.
- Tema escuro mantido: mesmas variáveis com valores escuros; menu continua grafite.
- `tokens.test.ts` passa a conferir contraste AA das cores novas, incluindo texto do menu sobre grafite e branco sobre vinho.

### 4.2 Tipografia e forma

- **Tamanho que acompanha a tela** (pedido do dono: "em tela grande as letras ficam pequenas"): o tamanho base é definido no `html` e todo o resto (texto, espaçamentos, ícones, alturas de linha de tabela) usa `rem`, então cresce junto:
  - até 1440px de largura: **14px**; de 1600px: **15px**; de 1920px em diante: **16px** (`font-size: clamp(14px, 0.35vw + 9.5px, 16px)` ou degraus por `@media`, o que passar no teste de contraste e layout).
  - **Preferência por pessoa** no menu do usuário: *Tamanho da letra* — Normal / Grande (+1px) / Maior (+2px), guardada no perfil (`usuarios.tamanho_letra`) e aplicada como classe no `html`.
  - Playwright tira capturas em 1366, 1920 e 2560 de largura para conferir que nada quebra.
- **Plus Jakarta Sans** via `next/font` (troca a Inter), pesos 400/500/700/800; títulos de tela com peso 300 + número em 800 vinho ("Clientes **124**").
- Números com `font-variant-numeric: tabular-nums` (valores, CNPJ, nº da demanda, horários).
- **Rótulos de seção em caixa alta, vinho e negrito** (ex.: SETOR FISCAL acima de um título; cabeçalhos de campo em formulário).
- Botões de ação em **caixa alta**, cantos de 5px nas barras de ferramentas e pílula (18px) nas janelas de confirmação. Tabelas com cantos de 4–5px e linhas finas; sem sombras decorativas.
- Status de demanda em **texto colorido com ponto** (● URGENTE), não em etiqueta arredondada.

### 4.3 Casca (`components/layout`)

Menu lateral no **padrão de navegação do Acessórias, com assinatura própria**:

| Elemento | Nosso |
|---|---|
| Topo | logo do escritório (arquivo a fornecer; até lá, monograma "EC" vinho com aro champanhe), centralizado |
| Atalhos | 4 botões **quadrados de canto arredondado** com aro colorido: Início, Meu perfil, WhatsApp (estado da conexão), Sair |
| Itens | largura total, separados por linha fina, ícone colorido 17–19px, contador à direita |
| Ativo | **faixa vinho cheia + fio champanhe de 3px à esquerda**, texto branco |
| Submenu | abre ao lado (desktop) ou expande (recolhido), fundo grafite mais claro, com seta |
| Rodapé | "Recolher" com ícone (não o « em círculo do Acessórias); estado lembrado |

- Barra superior: trilha de navegação (ícone › Seção › **Tela**) à esquerda; busca global Ctrl+K, estado do agente e menu da pessoa à direita.
- Ordem do menu: Início · Atendimento · Demandas · Clientes · Contatos · Assistente · Treinar o agente · (só admin) Gastos com IA · Configurações. Quando a Parte I entrar: "Treinar o agente" sai do menu e entra **Agentes** (entre Assistente e Configurações; orientações viram aba de cada agente).
- Configurações vira item com submenu (seções da Parte G, 7C.4): Expediente, Feriados, Prazos, Teto e IA, Mensagens (inclui o aviso do login), Respostas prontas, Setores, Serviços, Cargos, Usuários e permissões.
- Nas telas de três colunas (Atendimento, Assistente, Treinar o agente, Gastos com IA) o menu abre **recolhido** (só ícones); nas demais, como a pessoa deixou.

### 4.4 Login (`app/login`)

Modelo **"Faixa vinho"** (imagens: `imagens/00-login.png` e `imagens/00-login-tela-grande.png`) — escolhido por ser bem diferente do login do Acessórias:

- Fundo **branco**, sem tela dividida; na borda esquerda, **duas faixas verticais**: vinho (28px) e champanhe (10px), como a lombada de uma pasta.
- Coluna esquerda: logo + nome do escritório, rótulo **ACESSO DA EQUIPE** (caixa alta, vinho), título grande "Painel da **equipe**" (300 + 800), e **um recado** com fio champanhe à esquerda.
- Coluna direita: campos **só com linha inferior** (grafite; vinho quando em foco), rótulos E-MAIL / SENHA em caixa alta, link "Esqueci a senha" e botão **retangular grafite** "Entrar" (sem pílula, sem degradê).
- O recado é texto do admin (Configurações → Mensagens, chave `aviso_login`, até 200 caracteres; vazio = não mostra), lido por função pública que devolve só esse texto. Nunca dados de clientes.
- Abaixo de 900px de largura: coluna única, faixas viram uma barra no topo.

### 4.5 Janelas de confirmação (`patterns/confirm-dialog`)

Centralizadas sobre a tela escurecida, com **ícone grande circular** colorido pelo tipo (arquivar: champanhe; excluir: grafite; concluir: verde), pergunta com o nome em negrito, uma frase curta de consequência, e botões pílula em caixa alta ("CANCELAR" contorno / ação cheia).

**Avisos rápidos (toasts):** toda gravação do painel confirma com um aviso curto ("Demanda transferida", "Cliente arquivado") ou mostra o erro sem perder o que foi digitado (pendência 21 do redesign). Usa o componente de toast que já existe.

### 4.6 Tom dos textos

Frases curtas e afirmativas, sem "Tem certeza?", "por favor", "com sucesso". Ex.: "3 demandas, 14 preços e 47 conversas ficam guardados. Sai das listas e do agente." Termos oficiais mantidos: Demanda, Atendimento, Assumir, Devolver ao agente, Nota interna, Concluir.

### 4.7 Verificação da Parte A

Testes do painel (unitários, `tokens.test.ts`) e Playwright com axe nos dois temas passando; `/_design` atualizado; capturas de todas as telas (claro e escuro) para aprovação do dono.

---

## 5. Parte B — Cadastros: arquivar, excluir de vez, restaurar

### 5.1 Comportamento

- Entidades: **clientes, contatos, produtos, redes (parceiros_grupos), unidades (parceiros_unidades), usuários**.
- Coluna "Ações" em cada linha (ícones editar / arquivar) e uma área "Excluir…" no fim da ficha.
- Um único comando **Excluir…**. Antes de confirmar, o sistema consulta o uso do cadastro:
  - **Tem histórico** → **arquivar**: a janela mostra o que está ligado (ex.: 3 demandas, 14 preços, 47 conversas) e avisa demandas abertas ("1 demanda ainda aberta (#1038)") — **avisa, não bloqueia**.
  - **Nunca usado** → **excluir de vez** (só admin), confirmando ao digitar o nome.
- **Arquivado:** sai das listas, buscas e seleções do painel; **o agente e o assistente deixam de vê-lo** (o trabalhador já filtra `ativo = true` em clientes, contatos, produtos e unidades — `packages/db/src/repos.ts`); botão "ARQUIVADOS (n)" na tela lista com quem arquivou e quando, e **Restaurar**.
- Usuário arquivado não consegue entrar (login bloqueado); excluir de vez só se nunca atendeu nada (remove também do Auth, pelo servidor).
- "Apagar dados (LGPD)" de contato continua separado e inalterado.

### 5.2 Permissões

| Ação | Quem |
|---|---|
| Arquivar / restaurar clientes, contatos, produtos, redes, unidades | permissão `editar_clientes` ou admin |
| Arquivar / restaurar usuários | admin |
| Excluir de vez (qualquer) | admin |

Quando a Parte D entrar, "arquivar / restaurar" passa a exigir o nível **Clientes e contatos: Editar e arquivar** (a migração da Parte D dá esse nível a quem hoje tem `editar_clientes`, para ninguém perder o que já faz).

### 5.3 Banco (migração nova)

- Colunas `arquivado_em timestamptz`, `arquivado_por uuid` nas 6 tabelas; arquivar = `ativo = false` + essas colunas (reaproveita `ativo`, que o trabalhador já respeita).
- `uso_do_cadastro(tipo text, id uuid) returns jsonb` — contagens do que está ligado (cliente: demandas, conversas, mensagens, preços, produtos, unidades, documentos, contatos; contato: conversas, demandas, preços alterados; produto: preços, ocorrências em `pedido_venda`; rede/unidade: preços, unidades, ocorrências em `pedido_venda`; usuário: conversas, mensagens, demandas, eventos, preços).
- `arquivar_cadastro(tipo, id)`, `restaurar_cadastro(tipo, id)`, `excluir_cadastro_definitivo(tipo, id)` — SECURITY DEFINER, fechadas ao público, checam permissão; a exclusão **recusa** se `uso_do_cadastro` tiver qualquer contagem > 0, mesmo que a tela tenha deixado passar. Auditoria pelo gatilho existente + ação explícita.
- Bloqueio de login de usuário arquivado: checagem no `middleware`/sessão do painel e em `meus_setores`/`tem_permissao` (usuário inativo não tem permissões).

### 5.4 Verificação da Parte B

pgTAP: permissões por papel; exclusão recusada com histórico; arquivar some das consultas usadas pelo agente; restaurar volta. Playwright: arquivar com aviso de demanda aberta, restaurar, excluir de vez digitando o nome, atendente sem permissão não vê o comando.

---

## 6. Parte C — Gestão das demandas

### 6.1 Tela (`/demandas`) — tabela "Gestão das demandas" (abre primeiro)

- Trilha: ícone › **Gestão das demandas**; alternância **TABELA / QUADRO** (lembra a escolha por pessoa).
- **Busca** sempre visível: nº, empresa ou texto do assunto/descrição.
- **Filtros rápidos com contador** (multi): Novas · Resolvendo · Com o cliente · Concluídas | Do agente · Da equipe · **Vencidas**.
- **Filtros avançados** como etiquetas removíveis (Setor, Responsável, Prioridade, Tipo, Período) + botões **FILTRAR** (grafite) e **+ NOVA DEMANDA** (vinho). Estado de filtros na URL.
- **Linhas com duas informações por coluna:**

| Coluna (linha 1 / linha 2) |
|---|
| Assunto [nº] / Empresa |
| Status · Prioridade · Prazo / Abertura · Por (agente ou pessoa) |
| Responsável interno / Contato na empresa |
| Última atualização ↓ / Origem (WhatsApp ou Equipe) |
| Setor / Ações rápidas (Assumir quando sem responsável) |

- Faixa colorida à esquerda em urgente/vencida. Ordenação por última atualização (padrão), prazo, prioridade, número. Paginação de 50. Rodapé com contagem, **Imprimir** e **CSV Bling** (respeitando todos os filtros — corrige a pendência 10 do redesign).

### 6.2 Quadro

Colunas por status: **Nova · Resolvendo · Com o cliente · Concluída (últimos 7 dias)**. Cartão: nº · setor, prazo, assunto, empresa, prioridade, avatar do responsável (pontilhado se ninguém). **Arrastar muda o status**; soltar em Concluída abre a confirmação de concluir. Teclado: mover com atalhos (acessível sem mouse). Mesmos filtros e busca da tabela.

### 6.3 Painel lateral da demanda (ações sem sair da tela)

Cabeçalho (nº · setor, assunto, empresa, "aberta pelo agente há 2h"), botão **ASSUMIR**, campos editáveis **Responsável, Status, Prioridade, Prazo**, botões **Nota interna, Transferir, Concluir** (e **Reabrir** quando concluída), edição de título e descrição, resumo do pedido de nota + CSV quando houver, **linha do tempo completa** e "Abrir conversa" quando houver conversa.

### 6.4 Nova demanda

Painel lateral: Empresa (busca), Setor, Título, Descrição, **Prioridade** (Baixa/Normal/Alta/Urgente, padrão Normal), **Prazo** (preenchido com o sugerido, editável, marcado "sugerido"), Responsável (opcional, só pessoas do setor), Contato na empresa (opcional). Origem = equipe.

### 6.5 Prioridade e prazo

- Prioridades: `baixa | normal | alta | urgente`.
- **Prazo sugerido em dias úteis** (expediente e feriados já cadastrados): **Urgente = mesmo dia (fim do expediente) · Alta = 1 · Normal = 2 · Baixa = 5**. Editável em Configurações → Prazos.
- O **agente define a prioridade** ao abrir a demanda (novo parâmetro `prioridade` em `abrir_chamado` / `abrir_pedido_nota`, com regra no prompt: assunto sensível e cobrança repetida = alta; pedido de nota = normal salvo pedido do cliente); prazo calculado pelo banco.
- Quem pode agir na demanda (seus setores) pode mudar prioridade e prazo; quando a Parte D entrar, mudar o **prazo** passa a exigir a permissão "Alterar prazos de demandas" (prioridade continua livre).
- **"Com o cliente" pausa o prazo**: ao sair desse status, o prazo é empurrado pelo tempo pausado (em horas úteis).
- Vencendo hoje / vencidas: na Início (cartões "Vencem hoje" e "Vencidas"), no filtro Vencidas e no alerta periódico do trabalhador (`tarefas.ts`), que passa a avisar o responsável (ou o setor) quando vence.

### 6.6 Banco (migração nova)

- `chamados`: `prioridade` (enum, padrão `normal`), `prazo_em timestamptz`, `prazo_pausado_desde timestamptz`, `contato_id uuid` (contato na empresa), `criado_por uuid`, `ultima_atualizacao_em timestamptz` (gatilho em chamados e chamado_eventos).
- Status: mantém o enum atual (`aberto`=Nova, `em_andamento`=Resolvendo, `aguardando_cliente`=Com o cliente, `concluido`); só muda o rótulo na tela.
- `chamado_eventos.tipo` ganha: `status_alterado`, `prioridade_alterada`, `prazo_alterado`, `responsavel_alterado`, `editado`, `reaberto`.
- Funções (SECURITY DEFINER, checam `pode_ver_chamado` + setores): `criar_demanda`, `editar_demanda` (título, descrição, contato), `definir_responsavel`, `definir_prioridade_prazo`, `alterar_status_chamado` (passa a gravar evento e a pausar/retomar prazo), `reabrir_demanda` (limpa `concluido_em`, volta a `aberto`, evento). Reaproveita `transferir_chamado`, `concluir_chamado`, `nota_interna`. `calcular_prazo(prioridade, inicio)` usa expediente e feriados.
- Busca: índice `pg_trgm` em título e resumo; `numero` e nome da empresa por igualdade/prefixo.
- Tabela `prazos_prioridade` (ou chaves em `configuracoes`) com os 4 valores editáveis pelo admin.
- Textos dos avisos do trabalhador trocam "Chamado #N" por "Demanda #N" (pendência 9 do redesign).

### 6.7 Verificação da Parte C

pgTAP: cálculo de prazo com feriado e fim de semana; pausa/retomada em "Com o cliente"; cada ação gera seu evento; atendente só age nas demandas dos seus setores; reabrir limpa `concluido_em`. Trabalhador: `abrir_chamado` grava prioridade e prazo; alerta de vencimento. Cenários com Claude real: prioridade coerente em 5 casos (nota, cobrança, sensível, dúvida simples, urgência declarada). Playwright: filtros e contadores, busca, arrastar no quadro (e concluir com confirmação), todas as ações do painel lateral, nova demanda com prazo sugerido, CSV respeitando filtros.

---

## 7. Parte D — Usuários e permissões por nível

Inspirada na tela "Cadastro de usuário e suas permissões" do Acessórias, sem copiá-la.

### 7.1 Tela

- **Página inteira** (`/usuarios/novo` e `/usuarios/[id]`), não mais painel lateral. Trilha: Configurações › Usuários e permissões › *Nome*. Topo à direita: último acesso e data de cadastro.
- Formulário em **3 colunas**: Nome, E-mail de acesso, **Cargo** (Auxiliar, Analista, Coordenador, Sócio — informativo, lista editável), **Setores** (multi), **Telefone (WhatsApp)**, **Administrador?**
- **Administrador = Sim** esconde o bloco de permissões (acesso total).
- **Permissões por módulo, com níveis** (lista de seleção com a explicação dos níveis embaixo):

| Módulo | Níveis |
|---|---|
| Atendimento | Sem acesso · Conversas dos meus setores · Todas as conversas |
| Demandas | Só as minhas · Do meu setor · Todas |
| Clientes e contatos | Só ver · Ver e editar · Editar e arquivar |
| Preços e produtos | Só ver · Mudar preços e produtos |
| Pedidos de nota e CSV Bling | Sem acesso · Ver · Corrigir e gerar |
| Assistente | Sem acesso · Site · Site e WhatsApp (exige telefone) |
| Treinar o agente | Sem acesso · Sim |
| Alterar prazos de demandas | Não · Sim |
| Configurações | Sem acesso · Sim |
| Acessos de portais (Parte H) | Sem acesso · Ver (revelar e copiar senhas, sempre com auditoria) |
| Gastos com IA (Parte F) | Só administrador (não é permissão configurável) |

- **Horário de acesso ao painel**: Seg a sex, Sábado, Domingo — cada um Permitido/Bloqueado com hora de início e fim (padrão: seg–sex 08–18, sábado e domingo bloqueados para não-admin). Admin nunca é bloqueado.
- **Situação**: só leitura — "Ativo" ou "Arquivado em <data> por <pessoa>" (a chave "Ativo" saiu na Parte B; arquivar e restaurar são pelo Excluir… / Arquivados, que já existem). Observações.
- Rodapé: "Senha: convite enviado por e-mail · reenviar convite"; botões **VOLTAR** e **SALVAR**. Erro ao salvar mantém tudo o que foi digitado (resolve a pendência 14 do redesign).
- Lista de usuários continua em tabela, com colunas Nome / Cargo, Setores, Nível de Demandas, Último acesso, Situação.

### 7.2 Banco

- `usuarios`: `cargo text`, `observacoes text`, `ultimo_acesso_em timestamptz`, `horario_acesso jsonb` (ex.: `{"semana":{"de":"08:00","ate":"18:00"},"sabado":null,"domingo":null}`).
- Permissões com nível: tabela `usuario_permissoes(usuario_id, modulo, nivel)` (substitui o array de permissões booleanas), com migração que converte as 6 permissões atuais para os níveis equivalentes (ex.: `editar_clientes` → Clientes "Ver e editar"; `mudar_precos` → Preços "Mudar"; ausência → nível mínimo equivalente ao comportamento de hoje).
- `tem_permissao(modulo, nivel_minimo)` substitui a versão booleana (mantendo um adaptador para chamadas antigas até migrar todas).
- **Visibilidade**: `pode_ver_chamado` e `pode_ver_conversa` passam a respeitar o nível — "Só as minhas" (responsável = eu), "Do meu setor" (regra de hoje), "Todas". O padrão de quem já existe é **"Do meu setor"**, idêntico ao comportamento atual (nada muda para ninguém sem o admin mexer).
- **Horário de acesso**: checado no `middleware` do painel e em `pode_acessar_agora()` usada pelas funções de gravação; fora do horário, a sessão mostra "Fora do seu horário de acesso" e as gravações são recusadas. O assistente pelo WhatsApp respeita o mesmo horário.
- `ultimo_acesso_em` atualizado no login.

### 7.3 Verificação da Parte D

pgTAP: cada nível de Demandas e Atendimento vê exatamente o esperado (inclusive Realtime); migração converte as permissões atuais sem mudar o que cada pessoa vê; fora do horário as gravações falham; admin nunca bloqueado. Playwright: criar pessoa, esconder permissões ao marcar admin, erro de salvar sem perder dados, login fora do horário bloqueado.

**Risco principal:** mexer em `pode_ver_*` afeta segurança de tudo. Por isso é a última parte, com testes de regressão de RLS antes e depois.

## 7A. Parte E — Atendimento

Imagem: `imagens/00-atendimento.png` (fonte `fragmentos/00-atendimento.html`). Aprovada pelo dono em 01/10. Criada do zero (sem referência do Acessórias). Base: Parte A pronta; pode ser feita depois da C ou da D.

### 7A.1 Tela (três colunas; menu recolhido só com ícones nesta tela)

**Esquerda — lista ("achar quem precisa de mim")**
- Título "Atendimento **3** esperando você", busca por contato, empresa ou telefone.
- Grupos: **ESPERANDO PESSOA** (no topo, ordenado por quem espera há mais tempo) · **COM O AGENTE** · (recolhido) Concluídas hoje.
- Cada item: iniciais, contato, empresa (vinho), prévia da última mensagem (áudio mostra a transcrição), **cronômetro de espera** (verde ≤ 5 min, âmbar ≤ 15, vermelho > 15; limites em Configurações), **bolinha de não lidas**, e uma linha de estado: *agente passou: <motivo>*, *pediu para falar com pessoa*, *com Fulano*, *respondendo*, *resolvido pelo agente*, *agente pausado para este contato/empresa*.

**Centro — conversa ("ver o que o agente fez")**
- Cabeçalho: contato + telefone, empresa com **trocar empresa** (contato que fala por várias), botões TRANSFERIR, ENSINAR, **ASSUMIR** (vira DEVOLVER AO AGENTE e CONCLUIR depois de assumir).
- **Faixa de passagem** quando o agente passou para pessoa: "O agente passou para uma pessoa há 18 min. Motivo: …" + *Ver decisão*.
- Mensagens: cliente (branco, à esquerda), agente (verde-claro, ícone de robô), pessoa da equipe (vinho-claro, nome), nota interna (fundo próprio `--internal-note`, aviso "o cliente não vê").
- Cada resposta do agente tem **"por quê?"** (expande as ferramentas usadas, de `decisoes_agente`). **Cartões de decisão** (tracejados) e **marcos** centralizados ("Demanda #1042 aberta no Fiscal · urgente", "Ana assumiu", "Devolvido ao agente").
- Documento enviado pela IA aparece com **link** para abrir (passando pela auditoria de download).

**Embaixo — compositor ("responder mais rápido")**
- Abas **Responder ao cliente** / **Nota interna**; Enter envia, Shift+Enter quebra linha.
- Botões: **Anexar** (já existe), **Respostas prontas** com atalho `/` (já existe), **Sugerir resposta**, **Abrir demanda** (abre o painel "Nova demanda" da Parte C já com empresa, contato e conversa ligados).
- **Sugerir resposta:** só ao clicar. O assistente lê a conversa (últimas 20 mensagens), a empresa e as demandas abertas, **só com ferramentas de leitura**, e devolve um rascunho que aparece no campo marcado "SUGESTÃO DO ASSISTENTE (editável)". Nada é enviado sem a pessoa clicar ENVIAR. Respeita o teto de IA, conta em `uso_ia` e exige a permissão de usar o assistente pelo site.

**Direita — abas CLIENTE · ASSISTENTE · AGENTE**
- **CLIENTE:** empresa (nome, CNPJ, regime, serviços, *abrir ficha*), contato (papel, pode pedir nota, pode mudar preço), **demandas abertas** com prioridade e prazo, **últimos pedidos de nota** com valor, **documentos liberados** com download.
- **ASSISTENTE:** a caixa contextualizada que já existe.
- **AGENTE:** linha do tempo completa das decisões do agente nesta conversa.

### 7A.2 Banco e trabalhador

- `conversas.aguardando_pessoa_desde timestamptz` e `conversas.motivo_pessoa text` — preenchidos quando o agente passa para pessoa (`sinalizar_nao_entendido` na segunda vez, pedido do cliente, teto/pausa, modo seguro) e limpos ao assumir/devolver.
- **Não lidas:** tabela `conversa_leituras(usuario_id, conversa_id, lida_ate timestamptz)`; contador = mensagens do cliente depois de `lida_ate`; abrir a conversa marca como lida. RLS: cada pessoa só lê/grava as próprias.
- `caixa_entrada` passa a trazer: espera, motivo, não lidas da pessoa, pausa por contato/empresa (resolve as pendências 7 e 15 do redesign).
- **Trocar empresa:** função `trocar_empresa_conversa(conversa, cliente)` — só entre empresas às quais o contato está vinculado; gera marco na conversa e auditoria (pendência 6).
- **Sugerir resposta:** fila nova `sugerir_resposta` no trabalhador (mesmo padrão da fila `assistente`, só leitura, máximo 3 rodadas, limite 1 sugestão em andamento por pessoa); resultado entregue por Realtime para quem pediu e não gravado na conversa.
- Marcos de assumir/devolver/transferir/abrir demanda viram eventos exibidos na conversa (a partir de `chamado_eventos` e de um registro de eventos da conversa).

### 7A.3 Verificação da Parte E

pgTAP: `conversa_leituras` só da própria pessoa; trocar empresa recusa empresa não vinculada; espera/motivo preenchidos e limpos. Trabalhador: motivo gravado em cada caminho de passagem; sugestão usa só ferramentas de leitura e não envia nada (teste que falha se chamar `responder` ou ferramenta que grava). Playwright: grupos e ordenação por espera, cronômetro, não lidas zerando ao abrir, "por quê?", trocar empresa, sugerir → editar → enviar, abrir demanda a partir da conversa, atalhos J/K/A/N continuam.

## 7B. Parte F — Gastos com IA

Imagem: `imagens/00-gastos-ia.png` (fonte `fragmentos/00-gastos-ia.html`; números de exemplo). Aprovada pelo dono em 02/10. Pedido do dono: "todas as funcionalidades que gastam numa tela, desde o agente até o sugerir resposta, e saber o usuário que mais está gastando" + "ver os gastos de conversas de cada cliente".

### 7B.1 Problema de hoje

`uso_ia` guarda só `conversa_id, modelo, tokens, custo_usd, criado_em`: **não registra a funcionalidade nem a pessoa**, então não dá para separar agente / assistente / testar o agente nem ranquear a equipe. A transcrição de áudio (Groq, `apps/trabalhador/src/midia/transcritor.ts`) **não é registrada**.

### 7B.2 Banco e trabalhador

- `uso_ia` ganha: `funcionalidade` (enum: `agente_clientes`, `assistente_site`, `assistente_whatsapp`, `sugerir_resposta`, `testar_agente`, `transcricao_audio`, `especialista_setor`, `nao_identificado`), `usuario_id` (quem acionou; nulo para o agente), `cliente_id`, `setor_id`, `provedor` (`anthropic` / `groq`), `segundos_audio`. Registros antigos recebem `nao_identificado` (ou `agente_clientes` quando têm `conversa_id`, que é como o agente grava hoje — confirmar no código antes).
- Todo ponto que chama IA passa a gravar funcionalidade e pessoa: agente (`processar-conversa`), assistente (site e WhatsApp), sugerir resposta (Parte E), simular/testar o agente (`agente/simular.ts`), transcrição (`midia/transcritor.ts`, custo por minuto do provedor, valor em `configuracoes`).
- O **teto mensal** passa a somar todas as funcionalidades, inclusive transcrição.
- `configuracoes.cotacao_usd_brl` (editável pelo admin) para mostrar R$; nada busca cotação na internet.
- Funções de leitura só para admin (SECURITY DEFINER com `eh_admin`): `gastos_resumo(de, ate)`, `gastos_por_funcionalidade`, `gastos_por_dia`, `gastos_por_pessoa`, `gastos_por_cliente`, `gastos_atendimentos_do_cliente(cliente, de, ate)`, `gastos_chamadas(filtro)` (detalhe linha a linha) e exportação CSV.
- **"Conversa" nesta tela = atendimento**: as mensagens de um telefone num mesmo dia (a tabela `conversas` é uma por telefone, para sempre). Resultado do atendimento: *resolvido pelo agente* se naquele dia nenhuma pessoa assumiu nem respondeu; senão *passou para pessoa*. O link "abrir" leva à conversa posicionada naquela data.
- Índices em `uso_ia (criado_em)`, `(funcionalidade, criado_em)`, `(usuario_id, criado_em)`, `(cliente_id, criado_em)`.
- **Cache de prompt da Anthropic:** verificar se as chamadas já usam; se não, marcar com `cache_control` o bloco estável (regras fixas + definições de ferramentas + orientações) no agente, no assistente, no sugerir resposta e no testar o agente; registrar em `uso_ia` os tokens de cache (`tokens_cache_leitura` / `tokens_cache_escrita`, colunas que já existem) e calcular o custo corretamente. A tela mostra a economia do mês no cartão do total.

### 7B.3 Tela (`/gastos-ia`, menu do admin, ícone de moeda)

- Filtros: Hoje · 7 dias · Este mês (padrão) · Mês passado · Período; **Exportar** CSV.
- Cartões (faixa colorida no topo, números em negrito): **Total do mês × teto** (barra, marca de aviso em 80%, R$ pela cotação, **previsão de fechamento** = gasto ÷ dias corridos × dias do mês), **Chamadas à IA**, **Custo por atendimento**, **Áudios transcritos** (minutos e custo).
- **Por funcionalidade:** ícone, nome, barra, custo, %, chamadas. "Especialista por setor" só aparece quando existir.
- **Por dia:** barras do período, hoje em vinho, e **alerta automático do dia mais caro** com a combinação funcionalidade + pessoa que mais pesou.
- **Quem mais gasta na equipe:** ranking por pessoa (só ações de pessoas), barra empilhada "onde gastou" por funcionalidade com legenda, chamadas, custo, %. Clique abre o detalhe linha a linha da pessoa.
- **Gastos por cliente:** busca, ordenado por custo; colunas atendimentos, custo, custo por atendimento, % resolvidos pelo agente; ao abrir a empresa, lista de atendimentos (data, contato, mensagens, resultado, custo, abrir).
- Tipografia desta tela segue o pedido do dono: títulos 800, números grandes em 800 (não 300), rótulos e tabelas de 13–15px.

### 7B.4 Verificação da Parte F

Trabalhador: cada caminho grava a funcionalidade certa e a pessoa certa (teste por caminho); transcrição grava segundos e custo; teto soma tudo. pgTAP: funções só para admin; agrupamento por atendimento (mesmo telefone em dois dias = dois atendimentos); resultado "passou para pessoa" quando houve assumir/resposta humana; migração dos registros antigos. Playwright: filtros de período, ranking, abrir pessoa, abrir cliente e seus atendimentos, exportar CSV, atendente sem acesso à tela.

## 7C. Parte G — Demais telas (Início, Contatos, Assistente, Configurações, Treinar o agente)

Aprovadas pelo dono em 02/10, cada uma escolhida entre duas opções. Imagens e HTML em `imagens/` e `fragmentos/` (`00-<tela>-opcao-a|b`). **Vale a opção indicada abaixo**; a outra imagem fica só como referência. Onde a imagem e este texto divergirem, vale este texto. Dados nas imagens são de exemplo.

### 7C.1 Início — as duas opções, escolhidas pelo papel

- **Admin → Opção A "Painel de situação"** (`00-inicio-opcao-a.png`): faixa de alertas (só com problema); 5 números (Esperando pessoa, Demandas abertas, Vencem hoje, Vencidas, Sem responsável); cartão do agente com PAUSAR/RETOMAR e números do dia (conversas, % resolvidas pelo agente, demandas que ele abriu); sinais de vida; gasto × teto com previsão e link para Gastos com IA; tabela "Demandas por setor" (abertas, vencem hoje, vencidas, sem responsável, urgentes, barra de situação, Triagem); listas "Esperando pessoa agora" (cronômetro) e "Vencidas"; avisos.
- **Quem atende → Opção B "Minha mesa"** (`00-inicio-opcao-b.png`): "Bom dia, <nome>"; 4 números de ação (conversas esperando você, minhas vencidas, vencem hoje, sem responsável nos meus setores); "Minhas demandas por prazo" (Vencida / Vencem hoje / Próximos dias) com ABRIR e CONCLUIR; "Sem responsável nos meus setores" com ASSUMIR; conversas esperando com cronômetro e não lidas; atalhos; bloco compacto "Sistema" (agente ativo/pausado, WhatsApp, avisos) — **sem** pausar e **sem** gasto; "Você concluiu N demandas hoje".
- Banco: função `estado_sistema_resumo()` legível por qualquer autenticado (agente pausado, teto atingido, WhatsApp conectado, trabalhador ok — sem valores de custo), a mesma da pendência "estado do agente ao vivo"; Realtime.

### 7C.2 Contatos — Opção A "Tabela + painel lateral" (`00-contatos-opcao-a.png`)

- Tabela: contato + telefone, empresas, marcações como etiquetas ("1 de 2" quando vale só em parte das empresas), último contato + estado da conversa, chave do agente, ações (abrir conversa, arquivar). Ordenada por último contato.
- Busca por nome, telefone **ou empresa**; filtros rápidos com contagem: Agente desligado, Sem empresa, Pode pedir nota, Muda preço; seletor de empresa e período do último contato; ARQUIVADOS (n).
- Painel lateral: ABRIR CONVERSA, EDITAR, chave do agente, empresas com as marcações editáveis por empresa, **vincular empresa**, bloco WhatsApp (último contato, conversa agora, % resolvida pelo agente), demandas abertas do contato, "Excluir…" (Parte B) e, separado com borda tracejada, "Apagar dados (LGPD) · só admin" (inalterado).
- Novo no banco: nada além da Parte B; marcações por empresa já existem em `contato_clientes` (passam a ser editáveis também pelo contato, mesma permissão de hoje).
- Quando a Parte H entrar, esta tela ganha a coluna **Perfil** e, no painel lateral, o mesmo bloco de acesso da ficha do cliente (setores que pode tratar, "pode ser procurado", permissões especiais, documentos e avisos, prévia do agente) — editado em um lugar só (mesmos dados de `contato_clientes`), aparecendo nos dois.

### 7C.3 Assistente — Opção B "Conversa + resultado" (`00-assistente-opcao-b.png`)

- Menu recolhido. Chat enxuto à esquerda (~470px) com o histórico em botões no topo (Geral + conversas ligadas a atendimentos, "+n").
- Respostas curtas; quando há conteúdo grande (prévia de pedido, tabela, arquivo), a resposta traz um cartão **VER AO LADO** e o conteúdo abre no **painel de resultado** à direita, com abas (ex.: Pedido #536 · Pedidos em aberto (4) · Arquivos (1)).
- Painel do pedido: destinatário, pagamento, entrega, origem do pedido (contato e canal), tabela "O que mudou" (adicionado verde, removido vermelho riscado, alterado com valor antigo), total antes/depois, cartão do arquivo do Bling com BAIXAR, histórico do pedido, "Abrir demanda". Após o "sim": selo "Gravado às HH:MM por <pessoa>".
- Botões **SIM, GRAVAR** / **MUDAR OUTRA COISA** embaixo da prévia: só escrevem a resposta pela pessoa (a regra de gravar continua a mesma — grava exatamente a prévia mostrada).
- Regras do assistente **não mudam**. Antes de mostrar "origem do pedido" e o histórico, confirmar no código que esses dados estão gravados; se não estiverem, ficam fora desta parte.

### 7C.4 Configurações — Opção A "Menu por seção" + resumos da B (`00-configuracoes-opcao-a.png`; resumos inspirados em `00-configuracoes-opcao-b.png`)

- Menu interno fixo à esquerda em grupos (Escritório · Agente e atendimento · Cadastros · Sistema), cada item com contagem e **resumo do valor atual em letra pequena** (ex.: "seg–sex 08–18", "teto US$ 100 · 41%"), e "● não salvo" quando há rascunho. Uma seção por vez.
- Cada cartão tem **seu próprio Salvar** (separa Expediente e Teto — pendência 17) e DESCARTAR; campo alterado fica âmbar com "antes: X"; aviso ao sair com alteração não salva (SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI).
- Seções: Expediente · Feriados · Prazos por prioridade · Teto de IA e alertas · Modelos de IA (`modelo_conversa`, `modelo_rapido`) · Cotação US$→R$ e custo por minuto da transcrição · Limites de espera do Atendimento · Mensagens automáticas (inclui o **aviso do login**) · Respostas prontas (**agora com edição**) · Setores · Serviços · Cargos · link para Usuários e permissões.
- **Prazos — regra ao mudar** (decisão do dono, 02/10): ao salvar, se houver demandas abertas daquela prioridade, abre uma janela com o impacto ("14 demandas Normais abertas; 9 ganham prazo; nenhuma fica vencida" — e, ao **diminuir**, aviso em vermelho de quantas passariam a vencidas) e dois botões: **SÓ PARA AS NOVAS** (padrão) e **APLICAR TAMBÉM ÀS N ABERTAS**. Recalcular gera em cada demanda o evento "prazo recalculado por mudança de regra (<pessoa>)". Função `simular_mudanca_prazo(prioridade, dias)` (só leitura) + `aplicar_prazo_abertas(prioridade)`.
- Prazos mostra ao lado o exemplo de vencimento ("aberta hoje 10:00 → vence…") e quantas demandas abertas usam cada prioridade.

### 7C.5 Treinar o agente — Opção B "Editor com simulador" (`00-treinar-agente-opcao-b.png`)

- Três colunas: lista enxuta (medidor compacto dos 12.000 caracteres, faixa de cor por tipo, chave liga/desliga, etiqueta "ensinada no Atendimento"), editor no meio, **simulador de WhatsApp sempre visível** à direita.
- Simulador: escolhe a empresa, escreve como cliente, vê a resposta e **"O que o agente faria"** (ferramentas, com as que gravam/enviam fingidas — mesma regra de hoje), usando o **rascunho** sem salvar; quadro **"Sem o rascunho"** compara com a resposta sem a orientação (custa uma segunda simulação; conta em Gastos com IA como `testar_agente`).
- Editor: título, texto (até 2.000), tipo, vale para; **histórico** em tabela compacta embaixo, com restaurar; botões **SALVAR DESLIGADA** e **SALVAR E LIGAR**.
- Regras fixas, limites (4 min por teste, 1 teste por pessoa) e permissão `treinar_agente` não mudam.

### 7C.6 Verificação da Parte G

Playwright por tela (fluxos principais acima, dois papéis no Início, aviso de não salvo e janela de impacto em Prazos, VER AO LADO no Assistente, simulador com e sem rascunho). pgTAP: `estado_sistema_resumo` sem custos e legível por atendente; `simular_mudanca_prazo` não grava; `aplicar_prazo_abertas` gera evento por demanda e respeita "Com o cliente" (pausado). Capturas 1366/1920, claro e escuro, comparadas às imagens indicadas.

## 7D. Parte H — Cadastro completo do cliente e acesso por contato

Aprovadas pelo dono em 02/10. Imagens: `imagens/00-cliente-cadastro.png` e `imagens/00-cliente-contatos-acesso.png` (fontes em `fragmentos/`; dados de exemplo).

### 7D.1 Ficha do cliente — aba Dados (`00-cliente-cadastro.png`)

Página da ficha, mesma tela para "Novo cliente". Índice à esquerda com ✓ por bloco completo e aviso por bloco com pendência ("1 PENDENTE", "VENCE"); etiquetas no topo (situação, certificado vencendo, regime); rodapé com última alteração, CANCELAR e SALVAR. **Sem logo do cliente** (decisão do dono).

Blocos e campos (`*` obrigatório):
1. **Identificação:** CNPJ* (busca pública preenche razão social, CNAE e endereço), Razão social*, Nome fantasia, Tipo de pessoa, Inscrição estadual (+ "Isento"), Inscrição municipal, CNAE principal, Inscrição Suframa, Regime tributário*, Porte, Faturamento do último ano, Funcionários, Segmento* (Comércio, E-commerce, Indústria, Serviços — múltiplo).
2. **Endereço:** CEP* (busca pública preenche logradouro, bairro, cidade, UF), Logradouro*, Número*, Complemento, Bairro*, Cidade*, UF*.
3. **Contato da empresa:** Telefone, Celular/WhatsApp, E-mail, **E-mail de cobrança**, Site. (Pessoas ficam na aba Contatos.)
4. **Fiscal — inscrições de substituto tributário:** lista UF + inscrição estadual, adicionar/remover; aviso de linha sem inscrição.
5. **Contrato e honorários:** Início do contrato*, Honorário mensal*, Dia de vencimento, Reajuste (periodicidade e mês), 13º honorário, Fim do contrato, Serviços contratados (já existe `cliente_servicos`).
6. **Responsáveis por setor** (já existe `cliente_responsaveis`, entra no formulário).
7. **Certificado digital:** Tipo (e-CNPJ A1/A3, e-CPF…), Vencimento*, Avisar antes (dias). O aviso **cria uma demanda automática** no Fiscal para o responsável (tarefa diária do trabalhador, 1 por certificado/vencimento) e aparece na Início.
8. **Acessos de portais:** Portal, Usuário, Senha. Senha **criptografada** (Supabase Vault/pgsodium ou criptografia no servidor com chave fora do banco), exibida mascarada; revelar (👁) e copiar exigem a **permissão nova "Ver acessos de portais"** e **cada revelação grava auditoria** (quem, quando, qual portal). **Nunca** vai para o agente, o assistente, logs ou exportações.

Banco:
- `clientes` ganha colunas: tipo_pessoa, inscricao_municipal, inscricao_suframa, isento_ie, cnae_principal, porte, faturamento_ultimo_ano, funcionarios, segmentos text[], cep, logradouro, numero, complemento, bairro, cidade (uf já existe), telefone, celular, email, email_cobranca, site, contrato_inicio, contrato_fim, honorario_mensal, dia_vencimento, reajuste, decimo_terceiro, certificado_tipo, certificado_vencimento, certificado_avisar_dias. `endereco` antigo migra para `logradouro`.
- Tabelas novas: `cliente_inscricoes_st(cliente_id, uf, inscricao)`, `cliente_acessos(cliente_id, portal, usuario, senha_cifrada, atualizado_por, atualizado_em)` com RLS e funções `revelar_acesso(id)` (permissão + auditoria).
- Busca de CNPJ e CEP pelo servidor do painel em serviço público gratuito (BrasilAPI / ViaCEP), só com o número; falha ou demora → preenchimento manual, sem bloquear.
- O agente continua lendo só o que já lê (`consultar_cadastro`); honorários, contrato e acessos **não** entram nas ferramentas do agente.

### 7D.2 Ficha do cliente — aba Contatos com acesso por pessoa (`00-cliente-contatos-acesso.png`)

Pedido do dono: limitar o que cada pessoa da empresa pode saber (nem sempre é o sócio; pode ser administrativo, RH, compras…).

- Lista: Nome, Cargo, Celular, E-mail, **Perfil**, **Pode tratar** (setores e permissões em etiquetas). Linha aberta para editar. Faixa "N contatos aguardando definir acesso".
- **Perfil de acesso** (atalho que marca as opções): Sócio · Administrativo · Financeiro · RH/DP · Compras/Vendas · Funcionário · **Básico** · Personalizado. Mudar qualquer marcação vira "Personalizado".
- **Setores que pode tratar** — por contato **e por empresa** (a mesma pessoa pode ter acessos diferentes em empresas diferentes); só aparecem os setores contratados pela empresa. Em cada setor marcado: **"Pode ser procurado pelo agente deste setor"** (lembretes, cobranças, coletas — base dos agentes ativos futuros).
- **Permissões especiais:** Pedir nota de venda (já existe), Mudar preço e cadastrar produto (já existe), **Ver valores** (honorários, boletos, salários).
- **Documentos e avisos:** Receber documentos dos setores permitidos; Avisar quando sair documento novo (WhatsApp / e-mail).
- **Prévia "O que o agente vai fazer com <nome>"**: frase gerada das marcações (pode / recusa / pode ser procurado), para conferência.
- **Contato novo nasce "Básico"**: conversa e abre demanda, mas não consulta dados nem recebe documentos até alguém liberar. (Não há contatos antigos no banco — o dono apagou; se aparecer algum, migra como Básico.)

Regra do agente (aplicada **no código das ferramentas**, não só no prompt):
- `consultar_chamados`, `listar_documentos`, `enviar_documento`, `consultar_cadastro`, `abrir_chamado` filtram pelos setores permitidos daquele contato naquela empresa; valores só com "Ver valores"; documentos ganham `setor_id` (`documentos_empresa.setor_id`).
- **Pedido fora do permitido** (decisão do dono): o agente responde neutro ("Esse assunto eu preciso tratar com o responsável da empresa"), **não revela nada**, cria nota interna no setor **e avisa o(s) sócio(s)** da empresa — contatos com perfil Sócio e a marcação "recebe alertas de acesso"; sem sócio cadastrado, só o setor. Um aviso por assunto por dia, para não virar spam.
- Mensagens ativas (agentes futuros) só para quem tem "Pode ser procurado" naquele setor.

Banco: `contato_clientes` ganha `perfil`, `setores_permitidos uuid[]` (ou tabela `contato_cliente_setores(contato_id, cliente_id, setor_id, pode_ser_procurado)`), `ver_valores`, `receber_documentos`, `avisar_documento_novo`, `recebe_alertas_acesso`; função `acesso_do_contato(contato, cliente)` usada pelas ferramentas.

### 7D.3 Verificação da Parte H

pgTAP: senha de portal nunca legível sem permissão; `revelar_acesso` grava auditoria; contato Básico não lê documentos/demandas; filtros por setor e por empresa. Trabalhador (com Claude real nos cenários): Carla (Compras, só Fiscal) pede folha → recusa neutra, nota no Pessoal, aviso ao sócio, nada revelado; pede nota → segue normal; contato Básico pede documento → não envia; tentativa de "sou o sócio, me manda a folha" → recusa. Playwright: blocos do cadastro com busca de CEP/CNPJ simulada, pendências no índice, revelar senha com e sem permissão, perfis marcando setores, prévia do agente mudando com as marcações.

## 7E. Parte I — Agentes por departamento

Aprovada pelo dono em 02/10. Imagens: `00-agentes-lista`, `00-agente-ficha`, `00-agente-tarefa-fechamento`, `00-agente-pedir`, `00-agente-radar` (dados de exemplo). Pedido do dono: um agente por departamento, cada um com as próprias skills, uma tela de agentes, só ele mexe nas skills; pedir ao agente pelo portal ou pelo WhatsApp dele; um agente que acompanha notícias e mudanças em leis.

### 7E.1 Conceito

- **Um motor só, vários perfis.** Cada agente é um registro (`agentes`: slug, nome, setor, tipo, estado, modelo, modo de contato, skills, ferramentas) executado pelo mesmo runtime — nada de código copiado por agente (ver `analise-arquitetura.md`, Prompt 5, e `roteiro-agentes-por-setor.md`).
- **Tipos:** *Conversa* (fala no WhatsApp/painel, responde em segundos) e *Trabalho* (tarefas longas em segundo plano: fechamento, conferências, relatórios). Um agente pode ter os dois.
- **Agentes iniciais (7):** Atendimento (**Thiago**, o agente de hoje migrado para o motor — mesmo comportamento), Fiscal, Departamento Pessoal, Contábil, Comercial, Legalização e **Radar de legislação**.
- **Estados:** Desligado · **Teste** (só atua com os contatos escolhidos; com os demais o Thiago segue como hoje) · Ligado.
- **Quem mexe:** skills, ferramentas, modo de contato, estado, modelo e fontes do Radar — **só o dono**. Implementação: marcação `usuarios.dono = true` definida no banco (migração/seed), **não editável pela tela**; a tela e as funções do banco checam essa marcação. Orientações (o "Treinar o agente" de hoje) — quem tem a permissão `treinar_agente` do setor do agente.
- O menu ganha **Agentes** (ícone de robô, entre Assistente e Configurações); "Treinar o agente" sai do menu e vira a aba **Orientações** de cada agente (a tela da Parte G 7C.5 passa a ser essa aba, com o simulador na aba **Testar**).

### 7E.2 Tela Agentes (`/agentes`, `00-agentes-lista.png`)

Cartões em grade: ícone e cor do setor, nome, tipo, estado em destaque (Teste mostra quantos contatos), nº de skills/ferramentas/orientações, números do mês (conversas e/ou tarefas, % resolvido sozinho, custo), "Fala com o cliente: <modo>", última atividade, avisos (ex.: "2 tarefas aguardando aprovação · REVISAR"). Filtros por estado e tipo, busca, + NOVO AGENTE, atalho para Gastos com IA. Faixa: "Só você altera skills, ferramentas e modo de contato. Orientações: quem tem permissão."

### 7E.3 Ficha do agente (`/agentes/<slug>`, `00-agente-ficha.png`)

Cabeçalho: nome, setor, tipo, seletor de estado (Teste com lista de contatos + adicionar), modelo de IA, custo e uso do mês, Histórico, Testar agora. Abas: **Visão geral · Skills · Ferramentas · Como fala com o cliente · Orientações · Testar · Atividade e custo**.

**Skills — estrutura definida pelo dono** (cada grupo diz quando o agente lê):

| Tipo | Quando o agente lê | Exemplo (Fiscal) |
|---|---|---|
| 1. Jeito de atuar | Sempre | "Jeito do Fiscal" — tom, como se apresenta, como escreve |
| 2. Limites — o que não pode fazer | Sempre; **vence qualquer outra skill e orientação** | "Nunca calcula imposto sem documento", "Nunca promete prazo de emissão de nota" |
| 3. Procedimentos | Quando a tarefa aparece | "Conferência de pedido de nota", "Obrigações do mês (DAS, DCTFWeb)" |
| 4. Conhecimento | Consultado quando precisa | "Tabela CFOP", "Regras de unidade e preço", "Certificado digital" |
| 5. Exemplos | Consultado quando precisa | "Respostas boas de pedido de nota" |

- **Ordem de prioridade:** Regras fixas do sistema › Limites › Jeito de atuar › Procedimentos › Orientações da equipe. Conhecimento e Exemplos só informam, não dão ordens.
- **Formato:** o mesmo das skills do Claude — pasta com `SKILL.md` (cabeçalho com `name`, `description` e **`tipo`**) + arquivos de referência (`.md`, `.txt`, `.csv`, `.pdf`). SUBIR SKILL aceita pasta, `.zip` ou `.md` e pergunta o tipo se faltar no cabeçalho. Cada skill tem versões (quem, quando, diferença), liga/desliga, Testar e uso no mês.
- **Como o agente carrega:** Jeito de atuar e Limites entram sempre no começo do contexto (bloco estável, com cache de prompt). Das demais, o agente vê sempre só **nome + descrição**; o conteúdo entra quando ele chama a ferramenta `ler_skill(nome)` / `ler_referencia(skill, arquivo)` — o mesmo "só lê quando o assunto aparece" das skills do Claude. Isso também resolve o limite de 12.000 caracteres das orientações (glossário, tabela de prazos e exemplos longos da skill do dono passam a caber como Conhecimento/Exemplos).
- **Scripts dentro de uma skill não rodam** no agente de conversa (skill é texto). No agente de **trabalho**, quando a tarefa precisa gerar arquivo (planilha do Domínio, relatório), a skill é enviada à Anthropic como **Agent Skill** (API de skills) e usada com a ferramenta de execução de código — ver 7E.6.

**Ferramentas:** catálogo do sistema com marca *só leitura* ou *grava/envia* (cadeado + "exige aprovação humana"); o dono escolhe quais o agente tem. Exemplos do Fiscal: ler demandas do setor, conferir pedido de nota, ler pasta do cliente (só leitura), ler XML/PDF, gerar planilha, abrir demanda, nota interna, sugerir correção (prévia). **Toda** ferramenta que lê dado de cliente passa pelo filtro de acesso por contato da Parte H.

**Como fala com o cliente:** modo padrão do agente + regras por assunto (assunto, exemplo do que o cliente diz, modo, uso no mês, + nova regra):

| Modo | Como funciona |
|---|---|
| Por trás | Nunca fala com o cliente; quando precisa de algo, o **Thiago** pede (respeitando "pode ser procurado pelo agente deste setor") |
| Mesma voz | Responde direto, mas assina e escreve como Thiago |
| Passa a conversa | Thiago transfere; o agente se apresenta ("Aqui é do Fiscal") e conduz até o fim; marco na conversa |

O Thiago continua sendo quem recebe toda mensagem: identifica o assunto, aplica a regra do agente do setor (se ele estiver Ligado, ou em Teste e o contato estiver na lista) e decide o modo. Assunto sem regra → modo padrão do agente.

**Atividade e custo:** conversas e tarefas do agente, % resolvido sozinho, passagens para pessoa, custo por dia — comparável entre modos para o dono decidir.

### 7E.4 Tarefas de trabalho (`00-agente-tarefa-fechamento.png`)

Uma tarefa sempre pertence a uma **demanda** e aparece num bloco "TAREFA DO AGENTE <setor>" dentro dela:
- Origem (quem pediu, canal — painel, WhatsApp, automático/agendado), estado (Trabalhando · Aguardando pendências · Pronto para aprovar · Aprovada · Descartada), barra de etapas (definidas pelo Procedimento da skill; ex. fechamento: Coletar documentos → Ler e lançar → Conciliar → Revisar pendências → Aprovação), Pausar.
- **Fontes lidas** (arquivos da pasta do cliente com ✓) e **faltando** (com Enviar arquivo / Ler a pasta de novo).
- **Pendências do cliente:** viram pedido pelo Thiago ao contato com permissão do setor e "pode ser procurado"; mostram a mensagem enviada, Cobrar de novo, Já recebi. **Pendências para o analista:** perguntas com respostas rápidas e campo livre no painel (ou no WhatsApp de quem pediu). O agente **retoma sozinho** quando as pendências são respondidas.
- **Resultado (rascunho):** resumo, arquivos gerados para baixar, regra "nunca inventa valores: o que não tem documento vira pendência".
- **Aprovação obrigatória** por uma pessoa do setor: APROVAR E CONCLUIR (travado enquanto houver pendência), PEDIR AJUSTE ao agente (texto), DESCARTAR. Nada do resultado vale ou é enviado antes.
- Custo da tarefa (por etapa) e linha do tempo.
- Banco: `agente_tarefas` (agente, demanda, pedida_por, canal, estado, etapa, fontes jsonb, resultado jsonb, arquivos, custo), `agente_pendencias` (tarefa, tipo cliente/analista, pergunta, resposta, respondida_por, estado), arquivos no Storage (compartimento privado), tudo com RLS por setor; fila `agente_trabalho` no trabalhador (pg-boss), com retomada por evento de pendência respondida.
- Execução: Claude API com as ferramentas do agente + skills de trabalho como Agent Skills + execução de código para gerar arquivos; limites de tempo e de custo por tarefa (configuráveis; ao estourar, pausa e pergunta).

### 7E.5 Pedir ao agente (`00-agente-pedir.png`)

- **Pelo painel:** botão **PEDIR AO AGENTE** na demanda (e no Assistente: "pede pro agente Fiscal…"). Janela: escolher agente (cartões só dos setores da pessoa; o dono vê todos), empresa (vem da demanda), "O que você quer?", anexar arquivo ou escolher pasta do cliente, prazo desejado, avisar no painel e/ou no WhatsApp, custo estimado. Sem demanda aberta, cria uma no setor do agente.
- **Pelo WhatsApp de quem é da equipe:** o Assistente interno reconhece o pedido ("pede pro contábil fazer o fechamento de outubro da Padaria Sol"), cria a tarefa, responde com o número da tarefa e da demanda, repassa as pendências para o analista na mesma conversa e entrega o resumo e os arquivos no fim ("falta a Cláudia aprovar no painel").
- Os dois caminhos criam a mesma tarefa; quem pode pedir a qual agente segue os setores e permissões da pessoa; tudo registrado; custo em Gastos com IA.

### 7E.6 Pastas dos clientes (Drive)

- **Google Drive** (principal): conta de serviço ou autorização do escritório com acesso **só de leitura**; campo **"Pasta no Drive"** no cadastro do cliente (Parte H, bloco Contato ou um bloco "Arquivos"); o agente só enxerga a pasta daquele cliente; nunca apaga nem altera; arquivos gerados ficam no sistema (opção futura: salvar cópia numa subpasta "Gerados pelo agente").
- **Pasta no servidor** (opcional, o dono liga se precisar): caminho configurado em Configurações › Integrações, mesma regra de só leitura e uma pasta por cliente.
- Documentos lidos vão para a IA da Anthropic como as conversas já vão; registrar isso na política de LGPD do escritório.

### 7E.7 Radar de legislação (`00-agente-radar.png`)

- Agente de **Trabalho**, agendado (padrão: todo dia 7h; o dono muda) + PROCURAR AGORA. Busca **só nas fontes cadastradas pelo dono** (busca e leitura de páginas da web com lista de domínios permitidos): Receita Federal, Diário Oficial da União, Portal do Simples Nacional, eSocial, CFC, CONFAZ, SEFAZ-MG, Prefeitura de Conselheiro Lafaiete, Planalto. Notícia de fora dessas fontes vem marcada **"confirmar"**. Assuntos vigiados editáveis.
- Cada **novidade**: título, fonte + data + link, selo oficial/confirmar, resumo em linguagem simples, impacto (alto/médio/baixo), setores afetados, **clientes possivelmente afetados** (cruzando regime, CNAE/segmento e UF do cadastro da Parte H, com "ver lista"), vigência. Ações: CRIAR DEMANDA para o setor, AVISAR EQUIPE, MANDAR PARA CLIENTES AFETADOS (rascunho que **só sai com aprovação** e só para contatos com permissão do setor e "pode ser procurado"), DESCARTAR. Filtros Para decidir / Viraram demanda / Descartadas.
- Regras: nunca altera nada sozinho; tudo vira sugestão; sempre cita a fonte; avisos: resumo diário no WhatsApp do dono (liga/desliga) e aviso na hora para impacto alto. Giros anteriores com custo. Fonte fora do ar → tenta de novo mais tarde e avisa no resultado do giro.
- Banco: `radar_fontes`, `radar_giros`, `radar_novidades` (com estado e demanda criada).

### 7E.8 Custos e segurança

- Toda chamada de agente grava em `uso_ia` com funcionalidade `agente_<slug>` (conversa) ou `tarefa_<slug>` (trabalho) e a pessoa que pediu (Parte F); Gastos com IA ganha o agrupamento **por agente**.
- Ferramentas que gravam/enviam exigem aprovação humana; acesso por contato (Parte H) em todas; skills e ferramentas só pelo dono, com auditoria de cada versão.
- **Mensagens ativas** (pendências do cliente, avisos do Radar) contam no risco de bloqueio da Z-API: limitar volume por dia e, para campanhas, migrar para a API oficial do WhatsApp antes (roteiro de agentes).

### 7E.9 Ordem dentro da Parte I

1. Motor de agentes + tela Agentes + ficha (skills por tipo, ferramentas, modo de contato, orientações, testar) + **Thiago migrado** para o motor sem mudar comportamento (cenários atuais 100%).
2. Agente **Fiscal** (conversa com regras por assunto + pré-análise de pedido de nota como tarefa).
3. **Tarefas de trabalho** + pendências + aprovação + Google Drive + agente **Contábil** (fechamento).
4. **Pedir ao agente** (painel e WhatsApp).
5. **Radar de legislação**.
6. Pessoal, Legalização e Comercial: só configuração (skills e regras pela tela), sem código novo.

### 7E.10 Verificação da Parte I

Cenários com Claude real por agente (incluindo: Limites vencem orientação contrária; agente em Teste não atua com contato fora da lista; modo Por trás nunca envia ao cliente; contato sem permissão do setor recebe recusa neutra). Teste que `ler_skill` só carrega skills ligadas do próprio agente. Tarefa: pausa em pendência e retoma; aprovação travada com pendência aberta; nada sai antes de aprovar; leitura do Drive só na pasta do cliente (teste com pasta de outro cliente → recusado). Radar: só domínios cadastrados; "confirmar" para fonte não oficial; mensagem a clientes só após aprovação. pgTAP: só `dono` altera skills/ferramentas/estado; tarefas e pendências por setor. Custos gravados por agente.

## 8. Riscos e cuidados

- **Testes Playwright existentes** dependem de textos e `data-testid`: grep antes de trocar rótulos (ex.: "Aberta" → "Nova").
- **Arrastar no quadro** precisa de alternativa por teclado (acessibilidade AA já exigida).
- **Vinho × vermelho de perigo**: nunca usar só a cor para urgência/erro (ícone ou texto sempre).
- **Inspiração, não cópia**: nada de logo, ícone, cor exata ou texto do Acessórias; o menu segue a lógica de navegação, com as diferenças da seção 4.3.
- **Produção**: estas mudanças entram depois das correções de confiabilidade do agente (análise de arquitetura, Prompt 1) ou em paralelo, sem bloquear a subida.

## 9. Pendências do dono

Antes de começar:
- Enviar o **logo** do escritório (SVG ou PNG com fundo transparente). Sem ele entra o monograma "EC" provisório.
- Nome do escritório como deve aparecer no login e no menu.

Durante (o sistema vai perguntar ou o dono preenche pela tela depois):
- Texto do **aviso do login** (Configurações › Mensagens).
- **Cotação US$→R$** e **custo por minuto da transcrição** (Configurações › Teto e IA) — sem eles, Gastos com IA mostra só US$ e a transcrição fica sem custo.
- Lista de **cargos** (Auxiliar, Analista, Coordenador, Sócio… — editável).
- Conferir os **prazos por prioridade** (já definidos: urgente mesmo dia, alta 1, normal 2, baixa 5 dias úteis) e os **limites de espera** do Atendimento (verde ≤ 5 min, âmbar ≤ 15).
- Marcar quem são os **sócios** de cada empresa e quem recebe os alertas de acesso (Parte H).
- Aprovar cada parte vendo na prática (capturas claro/escuro e o painel na porta indicada) antes da próxima.

Antes da produção:
- Partes A–H aprovadas e juntadas, e as correções da análise de arquitetura (confiabilidade do agente, monitor externo, backup, trava de envio fora da produção, integridade de preço/pedido).
