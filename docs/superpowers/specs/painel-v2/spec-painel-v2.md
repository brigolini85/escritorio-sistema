# Painel v2 — identidade própria, cadastros com arquivo e gestão de demandas

Data: 01/10/2026 · Autor: dono do escritório (decisões) + Claude (desenho)
Base: branch `treinar-agente` juntada à `etapa-1` (pré-requisito — o painel redesenhado e o Treinar o agente estão nela).

## 1. Objetivo

1. **Identidade própria.** O painel hoje tem a "cara padrão" de sistema gerado por IA (azul do shadcn, Inter, cinza frio, rótulo pequeno sobre título, etiquetas arredondadas, janelas centralizadas genéricas). Ele deve parecer um produto do escritório: grafite, vinho e champanhe, com navegação inspirada no Acessórias (sistema que a equipe já usa e aprova), **sem copiá-lo**.
2. **Cadastros com exclusão.** Hoje não dá para excluir nem inativar clientes e contatos pela tela. Passa a existir um único "Excluir…" que **arquiva** o que tem histórico e **apaga de vez** só o que nunca foi usado.
3. **Gestão de demandas.** Hoje o painel lateral da demanda não tem nenhuma ação (tudo exige ir ao Atendimento), não há prioridade, prazo, busca, criação manual, edição nem visão em quadro. A tela vira uma "gestão das demandas" completa.

**Critério de sucesso:** a equipe resolve qualquer demanda sem sair da tela Demandas; nenhum cadastro com histórico é perdido; quem vê o painel não reconhece o "visual padrão de IA".

## 2. Fora do escopo

- Regras do agente, prompt, assistente, Bling (só recebem o que for necessário abaixo).
- Avaliação do cliente na demanda e "não lidas primeiro" (exigem rastrear leitura) — fase futura.
- Visão de calendário de prazos — fase futura.
- Trocar o nome "Demandas" por "Solicitações" (decidido manter "Demandas").

## 3. Ordem de entrega

Quatro partes independentes, cada uma com plano, branch e testes próprios, nesta ordem:

| Parte | O quê | Por que nesta ordem |
|---|---|---|
| A | Identidade visual (inclui o login novo) | Toca todas as telas; as telas novas já nascem no visual novo |
| B | Cadastros: arquivar / excluir / restaurar | Pequena, resolve a dor imediata |
| C | Gestão de demandas | A maior; depende do visual e dos padrões de A |
| D | Usuários e permissões por nível + horário de acesso | Mexe nas regras de visibilidade (RLS), com testes de regressão |
| E | Atendimento (seção 7A) | Desenhada depois; usa o visual de A e a Nova demanda de C |

Imagens de referência das telas: pasta `imagens/` ao lado deste arquivo (00 login · 01 menu e clientes/arquivar · 02 excluir de vez · 03 demandas tabela · 04 quadro e nova demanda · 05 painel lateral da demanda · 06 cadastro de usuário). Elas mostram estilo e organização; medidas e textos finais seguem este spec.

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

- **Cores de ícone por módulo** (paleta própria, sóbria, não a do Acessórias): Início `#D6AE5C`, Atendimento `#5DBB8F`, Demandas `#A6C95A`, Clientes `#6E9BC9`, Contatos `#A98BCB`, Assistente `#D6AE5C`, Treinar o agente `#E0894A`, Configurações `#4FB0B8`. Item ativo: ícone e texto brancos.
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
- Configurações vira item com submenu: Usuários e permissões, Setores, Expediente e IA, Mensagens, Respostas prontas, Feriados, Prazos (novo, Parte C).

### 4.4 Login (`app/login`)

Modelo **"Faixa vinho"** (imagens: `imagens/00-login.png` e `imagens/00-login-tela-grande.png`) — escolhido por ser bem diferente do login do Acessórias:

- Fundo **branco**, sem tela dividida; na borda esquerda, **duas faixas verticais**: vinho (28px) e champanhe (10px), como a lombada de uma pasta.
- Coluna esquerda: logo + nome do escritório, rótulo **ACESSO DA EQUIPE** (caixa alta, vinho), título grande "Painel da **equipe**" (300 + 800), e **um recado** com fio champanhe à esquerda.
- Coluna direita: campos **só com linha inferior** (grafite; vinho quando em foco), rótulos E-MAIL / SENHA em caixa alta, link "Esqueci a senha" e botão **retangular grafite** "Entrar" (sem pílula, sem degradê).
- O recado é texto do admin (Configurações → Mensagens, chave `aviso_login`, até 200 caracteres; vazio = não mostra), lido por função pública que devolve só esse texto. Nunca dados de clientes.
- Abaixo de 900px de largura: coluna única, faixas viram uma barra no topo.

### 4.5 Janelas de confirmação (`patterns/confirm-dialog`)

Centralizadas sobre a tela escurecida, com **ícone grande circular** colorido pelo tipo (arquivar: champanhe; excluir: grafite; concluir: verde), pergunta com o nome em negrito, uma frase curta de consequência, e botões pílula em caixa alta ("CANCELAR" contorno / ação cheia).

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

- **Horário de acesso ao painel**: Seg a sex, Sábado, Domingo — cada um Permitido/Bloqueado com hora de início e fim (padrão: seg–sex 08–18, sábado e domingo bloqueados para não-admin). Admin nunca é bloqueado.
- **Situação**: Usuário ativo? (liga com o arquivar da Parte B), Observações.
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

## 8. Riscos e cuidados

- **Testes Playwright existentes** dependem de textos e `data-testid`: grep antes de trocar rótulos (ex.: "Aberta" → "Nova").
- **Arrastar no quadro** precisa de alternativa por teclado (acessibilidade AA já exigida).
- **Vinho × vermelho de perigo**: nunca usar só a cor para urgência/erro (ícone ou texto sempre).
- **Inspiração, não cópia**: nada de logo, ícone, cor exata ou texto do Acessórias; o menu segue a lógica de navegação, com as diferenças da seção 4.3.
- **Produção**: estas mudanças entram depois das correções de confiabilidade do agente (análise de arquitetura, Prompt 1) ou em paralelo, sem bloquear a subida.

## 9. Pendências do dono

- Enviar o **logo** do escritório (SVG ou PNG com fundo transparente).
- Texto inicial do **aviso do login**.
- Confirmar, depois da Parte A, as capturas claro/escuro.
