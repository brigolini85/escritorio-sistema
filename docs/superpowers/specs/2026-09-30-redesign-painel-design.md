# Redesign do painel — especificação

Data: 2026-09-30. Origem: pedido do dono (texto integral abaixo, seções 1–10), aprovado com as decisões da seção 0.

## 0. Decisões tomadas com o dono (2026-09-30)

- D1. Consultas novas **só de leitura** no painel estão autorizadas para: contadores do menu (conversas aguardando atendente; demandas abertas nos setores da pessoa), sinais de vida (tabela `sinais_vida`), gasto de IA do mês vs. teto (tabela `uso_ia` + `configuracoes.teto_ia_usd`), busca global (empresas, contatos, demandas), lista de conversas ao lado da conversa aberta, histórico de conversas do assistente. Sempre pelo cliente Supabase do usuário (RLS vale). Nenhuma escrita nova, nenhuma server action nova com efeito, nada fora de `apps/painel`.
- D2. "Não lidas" fica **fora** (exigiria mudança de banco). No lugar, "aguardando atendente" em destaque no topo da lista.
- D3. Dependências novas autorizadas no painel: Radix (via shadcn/ui copiado para o repo), `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`, fonte Inter via `next/font/google`, e as que o shadcn exigir para os primitivos listados (ex.: `sonner` para toasts, `cmdk` para a busca). Nada de outra biblioteca de UI.
- D4. Textos que os testes E2E procuram: manter o texto exato visível (pode ser discreto) ou, quando o layout novo separar o texto de verdade, ajustar **só o seletor** do teste sem enfraquecer o que ele verifica. Toda mudança em `apps/painel/e2e` é listada no relatório da fase.
- D5. Não existe `pnpm lint` no projeto. A verificação de cada fase é: `pnpm --filter @escritorio/painel typecheck`, `pnpm --filter @escritorio/painel test` (32+) e Playwright (`pnpm --filter @escritorio/painel e2e`, 37, porta 3100, banco local). Adicionar ESLint fica como pendência para decisão do dono.
- D6. Rota `/_design`: pastas com `_` são privadas no App Router; usar a pasta `%5Fdesign` para servir `/_design`. Fora de desenvolvimento (`NODE_ENV === 'production'`) responde `notFound()`.
- D7. O caminho do painel é `apps/painel/src/…` (tokens em `apps/painel/src/styles/tokens.css`, componentes em `apps/painel/src/components/{ui,patterns,layout}`).
- D8. Tailwind é v4 (`@tailwindcss/postcss`). Os tokens ficam em CSS e são expostos ao Tailwind por `@theme inline`; os valores dos tokens são cores completas (ex.: `hsl(221 83% 45%)`), para que trocar a marca seja uma linha.
- D9. Tema: padrão pelo sistema (`prefers-color-scheme`), alternância manual guardada em cookie e aplicada como `data-theme` no `<html>` no servidor (sem piscar).
- D10. Faixa "HOMOLOGAÇÃO": aparece quando a variável `NEXT_PUBLIC_AMBIENTE` (ou `AMBIENTE`) for diferente de `producao`; se ausente, mostra "DESENVOLVIMENTO".
- D11. Trabalho em fases (seção 9), cada fase implementada por uma IA e revisada pelo code review; ao fim de cada fase, resultado dos testes e capturas (claro e escuro) mostrados ao dono.


1. Papel e objetivo
Você é um designer de produto sênior e engenheiro front-end especialista em Next.js 15 (App Router), React Server Components, Tailwind CSS e sistemas de design para ferramentas internas de alta densidade (estilo Linear, Front, Intercom, Height).

Sua missão é redesenhar a interface do painel (apps/painel) para que ele fique:

Profissional: sóbrio, consistente, confiável. Parece um produto comercial, não um projeto interno.
Fácil de usar: a equipe do escritório passa o dia nele. Cada tela deve deixar óbvio o que precisa da minha atenção agora e qual é a próxima ação.
Fácil de mexer (manutenção): cor, fonte, espaçamento, raio e componentes definidos em um único lugar. Trocar a cor principal do sistema tem que ser editar uma linha.
O sistema já funciona. Isto é um trabalho de camada visual e experiência, não de regra de negócio.

2. Contexto do sistema (leia antes de qualquer coisa)
Monorepo pnpm, TypeScript. Apps: apps/painel (Next.js 15, com login) e apps/trabalhador (Fastify). Pacotes: packages/core (regras puras) e packages/db (repositório + tipos do banco).
Supabase: Postgres + Auth + Storage + Realtime. O painel se atualiza ao vivo quando chegam mensagens, demandas ou respostas do assistente.
Segurança por RLS: cada pessoa só vê o que o banco permite (pode_ver_chamado, pode_ver_conversa). A UI nunca é a única barreira, mas deve esconder o que a pessoa não pode usar, em vez de mostrar botão que falha.
Dois "robôs" diferentes, que o design precisa distinguir visualmente:
Agente de clientes: atende clientes no WhatsApp. Pode estar ativo, pausado (geral, por contato, por empresa), ou a conversa pode ter sido assumida por um atendente.
Assistente interno: a IA da equipe (tela Assistente e caixa lateral no Atendimento). Mostra prévias antes/depois de correções de pedido e só grava após confirmação.
Vocabulário da interface (use sempre estes termos, em português do Brasil): "Demanda" (nunca "ticket"/"chamado" na UI), "Atendimento", "Conversa", "Empresa", "Contato", "Setor", "Pedido de nota", "CSV do Bling", "Assumir", "Devolver ao agente", "Nota interna", "Concluir".
Telas existentes (manter todas, mesmas rotas)
Tela	Função	Quem vê
Início	Avisos, pausar/retomar agente, sinais de vida (WhatsApp, fila)	Todos (pausar: admin)
Atendimento	Conversas: assumir, responder, devolver ao agente, notas internas, transferir, concluir; caixa do Assistente à direita	Setores da pessoa; admin tudo
Demandas	Demandas abertas por setor, "Baixar CSV Bling", "Exportar CSV Bling"	Setores; CSV com permissão
Clientes	Ficha da empresa em abas: dados, contatos, clientes/fornecedores (unidades), produtos, preços por rede, documentos	Todos leem; editar com permissão
Contatos	Pessoas, vínculos com empresas, agente ligado/desligado por contato	Idem
Assistente	Conversa com o assistente interno	Permissão "Usar o assistente pelo site"
Usuários	Convidar, papel, setores, telefone, permissões	Admin
Configurações	Expediente, teto de IA, mensagens automáticas, setores, serviços, respostas prontas, feriados	Admin
3. Regras invioláveis
Não altere packages/core, packages/db, apps/trabalhador, supabase/migrations nem a lógica de server actions / consultas. Se um componente precisar de um dado novo, pare e me pergunte.
Não altere rotas, nomes de parâmetros, contratos de formulário, nem o fluxo de permissões.
Não quebre os testes. Os 37 testes Playwright (porta 3100) e os 32 unitários do painel devem continuar passando. Preserve data-testid, aria-label, textos de botão e role usados pelos seletores. Antes de mudar qualquer texto visível, faça grep nos testes.
Nada de cor, tamanho ou espaçamento "solto" no JSX (#1a2b3c, text-[13px], mt-[7px]). Tudo vem dos tokens.
Acessibilidade WCAG 2.1 AA: contraste ≥ 4.5:1 em texto, foco visível em todo elemento interativo, navegação completa por teclado, prefers-reduced-motion respeitado.
Trabalhe em fases (seção 9). Ao fim de cada fase: rode lint, typecheck e testes, e me mostre o resultado antes de seguir.
4. Direção visual
Personalidade: calmo, preciso, confiável — é um escritório contábil/fiscal lidando com dados de clientes. Nada de gradientes chamativos, glassmorphism, ilustrações infantis ou emoji.

Densidade: média-alta. A equipe trabalha com listas longas; prefira linhas compactas (altura 40–44px) com boa hierarquia tipográfica a cards gigantes.
Cor: base neutra (cinzas levemente frios), uma cor de marca para ações primárias e foco, e cores semânticas usadas só com significado.
Tipografia: Inter (ou Geist) via next/font, com font-feature-settings: "tnum" em números (valores, CNPJ, quantidades, horários) para alinhamento tabular.
Tema claro e escuro, com alternância manual e padrão pelo sistema.
Ícones: lucide-react, tamanho 16px em linhas e 20px em navegação, traço 1.75.
5. Arquitetura do design system (o "fácil de mexer")
5.1 Stack
Tailwind CSS (v4 se o projeto já estiver nele; senão mantenha a versão atual) + shadcn/ui (componentes copiados para o repo, sobre Radix) + class-variance-authority + tailwind-merge via helper cn().
Se o painel já usa outra biblioteca de UI, me avise antes e proponha a migração, não misture.
5.2 Tokens — uma fonte de verdade
Crie apps/painel/src/styles/tokens.css com variáveis CSS semânticas (não nomes de cor). O Tailwind lê essas variáveis. Estrutura mínima:

:root {
  /* Marca — trocar aqui muda o sistema inteiro */
  --brand: 221 83% 45%;
  --brand-foreground: 0 0% 100%;

  /* Superfícies */
  --background: ...;      /* fundo da aplicação */
  --surface: ...;         /* cards, painéis */
  --surface-muted: ...;   /* zebra, hover, áreas secundárias */
  --border: ...;
  --ring: var(--brand);

  /* Texto */
  --text: ...; --text-muted: ...; --text-subtle: ...;

  /* Semânticas */
  --success: ...; --warning: ...; --danger: ...; --info: ...;

  /* Domínio — estados que a equipe precisa reconhecer de relance */
  --agent-active: ...;    /* agente de clientes respondendo */
  --agent-paused: ...;    /* agente pausado */
  --human-owned: ...;     /* conversa assumida por atendente */
  --assistant: ...;       /* assistente interno (distinto do agente) */
  --internal-note: ...;   /* fundo de nota interna */

  /* Forma e ritmo */
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 10px;
  --shadow-sm: ...; --shadow-md: ...;
  --font-sans: ...; --font-mono: ...;
}
[data-theme="dark"] { /* mesmas variáveis, valores escuros */ }
Regras:

Escala de espaçamento 4px (usar só a escala padrão do Tailwind).
Escala tipográfica fechada: xs 12 / sm 13 / base 14 / lg 16 / xl 20 / 2xl 24. Corpo da aplicação em 14px.
Documente cada token com um comentário de uma linha dizendo onde ele é usado.
5.3 Organização de componentes
apps/painel/src/
  styles/tokens.css
  components/
    ui/          ← primitivos shadcn (Button, Input, Select, Dialog, Sheet,
                   Tabs, Table, Badge, Tooltip, DropdownMenu, Toast, Skeleton…)
    patterns/    ← composições reutilizáveis do domínio (lista abaixo)
    layout/      ← AppShell, Sidebar, Topbar, PageHeader
Nenhuma tela importa de ui/ e estiliza por conta própria algo que deveria ser um pattern. Se o mesmo arranjo aparece duas vezes, vira pattern.

5.4 Padrões de domínio (criar em components/patterns/)
Componente	Uso
PageHeader	Título, descrição curta, ações da página à direita, breadcrumbs opcionais
DataTable	Tabela com ordenação, filtros, seleção, paginação, estado vazio/carregando/erro, ações por linha. Base de Demandas, Clientes, Contatos, Usuários
FilterBar	Busca + filtros (setor, status, responsável) + contagem de resultados; estado refletido na URL
StatusBadge	Status de demanda e de conversa, com cor + ícone + texto (nunca só cor)
AgentStateIndicator	Mostra de relance: agente ativo / pausado (e por quê: geral, contato, empresa, teto de IA) / assumido por Fulano
HealthSignal	Sinal de vida (WhatsApp, fila): ponto colorido + "há 40s" + tooltip com detalhe
EmptyState	Ícone, frase curta e ação sugerida
ConfirmDialog	Toda ação destrutiva ou irreversível (concluir, apagar dados LGPD, pausar agente)
PermissionGate	Esconde/desabilita conteúdo conforme papel e marcações; desabilitado mostra tooltip com o motivo
FormField	Label, input, ajuda e erro em vermelho abaixo do campo (padrão atual do sistema)
MoneyText / DocumentText	Formatação BRL e CNPJ/CPF/CEP mascarados, fonte tabular
RelativeTime	"há 3 min", com data completa no tooltip, horário de Brasília
MessageBubble	Mensagem de cliente, do agente, de atendente, nota interna, arquivo/áudio transcrito — cada um visualmente distinto
DiffPreview	Prévia antes → depois do assistente para correção de pedido (itens adicionados em verde, removidos em vermelho riscado, alterados com o valor antigo ao lado)
OrderSummary	Resumo do pedido de nota: destinatário (CNPJ, endereço), itens (código, unidade, qtd, preço, subtotal), total, pagamento/entrega. Itens sem valor (kg, litro, caixa, fardo) destacados como "a conferir pelo Fiscal"
BlingExportButton	Botão de CSV com estado de carregamento e, em caso de pendência, lista qual pedido e qual campo está faltando
6. Estrutura global (AppShell)
Sidebar fixa à esquerda (240px, recolhível para 64px só com ícones; estado lembrado). Itens na ordem: Início, Atendimento, Demandas, Clientes, Contatos, Assistente — separador — Usuários, Configurações (só admin). Contadores ao lado de Atendimento (conversas aguardando humano) e Demandas (abertas nos meus setores), atualizados em tempo real.
Topbar: busca global (Ctrl/⌘ + K) por empresa, contato, demanda; indicador do estado geral do agente (AgentStateIndicator compacto); ambiente (faixa "HOMOLOGAÇÃO" amarela visível quando não for produção); menu do usuário (tema, sair).
Toasts para confirmação de ações e para eventos em tempo real relevantes ("Nova conversa aguardando atendimento").
Responsivo: pensado para desktop 1280–1920px; em tablet a sidebar vira gaveta; celular não é prioridade, mas nada pode quebrar.
7. Especificação por tela
Início
Painel de situação, não de vaidade. Em ordem:

Faixa de alertas (teto de IA próximo/atingido, WhatsApp desconectado, fila parada) — só aparece se houver algo.
Card Agente: estado atual grande e claro, botão Pausar/Retomar (admin) com ConfirmDialog.
Sinais de vida: WhatsApp (Z-API), fila (pg-boss), último batimento.
Números do dia: conversas aguardando humano, demandas abertas por setor, demandas sem responsável há muito tempo, gasto de IA do mês vs. teto (barra de progresso).
Avisos.
Atendimento (a tela mais importante)
Layout de três colunas, estilo caixa de entrada:

Esquerda (320px): lista de conversas com filtros rápidos (Aguardando humano · Comigo · Com o agente · Concluídas), busca, e por item: nome do contato, empresa, prévia da última mensagem, RelativeTime, AgentStateIndicator compacto, contador de não lidas. Conversas aguardando humano ficam no topo e destacadas.
Centro: cabeçalho com contato, empresa (trocável se o contato fala por várias), estado do agente e ações (Assumir em destaque quando aplicável, Devolver ao agente, Transferir, Concluir). Histórico com MessageBubble, separadores de data, áudios mostrando a transcrição, anexos com pré-visualização. Compositor com alternância clara Responder ao cliente / Nota interna (nota interna com fundo --internal-note e aviso "o cliente não vê"), respostas prontas por atalho /.
Direita (360px, recolhível): abas Assistente (caixa do assistente já contextualizada) e Detalhes (dados da empresa, demandas abertas, botão "Baixar CSV Bling" quando houver pedido).
Demandas
DataTable com FilterBar (setor, status, responsável, tipo, período). Colunas: número, empresa, assunto, setor, responsável, aberta há, status. Linha abre um Sheet lateral com detalhes, eventos (linha do tempo), OrderSummary quando for nota de venda e "Baixar CSV Bling". Seleção múltipla + "Exportar CSV Bling" (respeitando o filtro) no PageHeader.

Clientes
Lista em DataTable → ficha da empresa com abas: Dados · Contatos · Clientes e fornecedores (grupos/redes com unidades: CNPJ, endereço, CEP, telefone) · Produtos · Preços por rede (com histórico e origem painel/agente) · Documentos (indicando "liberado para IA"). Modo leitura por padrão; botão Editar só com permissão, via PermissionGate.

Contatos
DataTable com empresas vinculadas, marcações ("Pode pedir nota", "Pode mudar preço e cadastrar produto") como badges e switch do agente por contato. Ação "Apagar dados (LGPD)" isolada numa zona de perigo, com ConfirmDialog que exige digitar o nome.

Assistente
Chat em largura de leitura (máx. ~760px), histórico à esquerda (conversas). Respostas renderizam DiffPreview, OrderSummary, tabelas e o botão de CSV. Estado "pensando" claro. Sugestões de perguntas no estado vazio.

Usuários
DataTable + Sheet de edição: papel, setores (multi-select), telefone, e as cinco permissões como switches com descrição de uma linha cada. Aviso quando "Usar o assistente pelo WhatsApp" for ligado sem telefone.

Configurações
Navegação lateral interna por seções (Expediente, Teto de IA, Mensagens automáticas, Setores, Serviços, Respostas prontas, Feriados). Cada seção é um card com o botão Salvar próprio e indicação de alterações não salvas.

8. Estados e microinterações (obrigatório em toda tela)
Carregando: Skeleton com o formato real do conteúdo (nada de spinner no meio da página).
Vazio: EmptyState com ação.
Erro: mensagem humana + "Tentar de novo"; nunca stack trace.
Sem permissão: explicação curta de quem pode liberar.
Tempo real: item novo entra com destaque suave (fade de fundo 1.5s); nunca pular a rolagem do usuário se ele estiver lendo o histórico — mostrar "Novas mensagens ↓".
Ações otimistas onde seguro, com rollback e toast de erro.
Atalhos de teclado: ⌘K busca, J/K navegar lista, A assumir, N nota interna, Esc fechar painel. Listar em ?.
Transições ≤ 150ms, ease-out; desligadas com prefers-reduced-motion.
9. Plano de execução em fases
Antes de começar, analise o código atual do painel e me entregue um diagnóstico curto: stack de UI atual, componentes existentes, inconsistências encontradas, e riscos para os testes. Espere meu OK.

Fundação: tokens, tema claro/escuro, fontes, cn(), primitivos shadcn, página interna /_design (só em desenvolvimento) mostrando todos os tokens e componentes — o catálogo vivo do sistema.
AppShell: sidebar, topbar, busca global, faixa de ambiente, toasts.
Padrões de domínio (seção 5.4), cada um com exemplo no /_design.
Atendimento (maior impacto).
Demandas e Início.
Clientes e Contatos.
Assistente.
Usuários e Configurações.
Polimento: auditoria de acessibilidade (axe), contraste, teclado, tema escuro em todas as telas, remoção de estilos órfãos.
Ao fim de cada fase: pnpm lint, pnpm typecheck, testes do painel e Playwright. Mostre os resultados reais e capturas das telas alteradas (claro e escuro).

10. Entregáveis finais
Código do painel redesenhado, sem mudanças fora de apps/painel.
apps/painel/src/styles/tokens.css comentado.
Página /_design com todos os tokens e componentes.
docs/design-system.md curto com: como trocar a cor da marca, como criar um componente novo, quando usar ui/ vs patterns/, e o vocabulário oficial da interface.
Lista do que ficou pendente ou que precisa de decisão minha.
Critério de pronto: um desenvolvedor novo consegue mudar a cor principal, o raio das bordas e a fonte do sistema inteiro editando só tokens.css, e todos os testes existentes continuam passando.