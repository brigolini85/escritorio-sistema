# Design system do painel

Guia curto para mexer na aparência do painel (`apps/painel`) sem espalhar cor, tamanho ou espaçamento solto pelo código.

## Onde mora cada coisa

| O quê | Arquivo |
|---|---|
| Cores, raios, sombras, fontes e larguras fixas (a única fonte de verdade) | `apps/painel/src/styles/tokens.css` |
| Nome dos utilitários do Tailwind que leem os tokens (`bg-brand`, `text-muted`...), escala de texto, animações | `apps/painel/src/app/globals.css` |
| Juntar classes sem conflito | `cn()` em `apps/painel/src/lib/cn.ts` |
| Primitivos (Button, Input, Dialog, Sheet, Table...) | `apps/painel/src/components/ui/` |
| Composições do domínio (DataTable, StatusBadge, MessageBubble...) | `apps/painel/src/components/patterns/` |
| Casca da aplicação (menu, barra do topo, cabeçalho da página, atalhos) | `apps/painel/src/components/layout/` |

## Trocar a cor da marca

Edite **uma linha** em `tokens.css`: `--brand-base`, no topo do bloco `:root`.

```css
--brand-base: hsl(348 55% 31%); /* vinho, a marca padrão; troque só isto: hsl(matiz saturação% luminosidade%) */
```

- Todo o resto da marca deriva dessa linha, nos dois temas, pela sintaxe de cor relativa do CSS (`oklch(from var(--brand-base) ...)`):
  - `--brand`: botão primário, links e item ativo;
  - `--ring`: anel de foco;
  - `--brand-soft`: fundo do item selecionado;
  - no escuro, também `--brand-foreground`: texto sobre a marca.
- Não edite as derivadas.
- **O contraste AA vale para qualquer cor.** As derivadas usam uma luminosidade perceptiva fixa por papel e herdam só o matiz e a saturação:
  - no tema claro, uma cor clara demais para texto branco é escurecida sozinha (luminosidade OKLCH até 0,5);
  - no escuro, a marca fica sempre clara (0,74) e o fundo suave, escuro (0,30).
  - Por isso não existe faixa de luminosidade a evitar. O preço: um amarelo ou verde-limão vivo aparece mais escuro (puxando para oliva) nos botões do tema claro.
- As derivadas ficam num bloco `@supports (color: oklch(from red l c h))` no fim do `tokens.css` e valem nos navegadores atuais (Chrome/Edge 119+, Safari 18+, Firefox 128+).
- Navegador antigo: usa as **reservas fixas** em `hsl()` de `--brand`, `--brand-soft` e `--brand-foreground` nos blocos de tema (a marca padrão, vinho). Botões, links e anel de foco continuam visíveis. Essas reservas só contam para navegador antigo: trocá-las junto com a marca é **opcional** (sem trocar, quem tem navegador antigo vê o vinho padrão). O teste confere o contraste AA delas também.
- Depois rode `pnpm --filter @escritorio/painel test`. O `tokens.test.ts` calcula as derivadas como o navegador e confere o contraste WCAG AA (texto 4,5:1; foco e bordas de campo 3:1) nos dois temas.
  - O teste usa a marca atual e mais 10 cores: vermelho, verde, roxo, laranja, amarelo, ciano, rosa, verde-folha, cinza e um azul claro.
- Só `--brand-base` muda a marca. O menu lateral (grafite), o champanhe de enfeite e as cores dos módulos têm tokens próprios e **não** acompanham a marca; o item ativo do menu usa `--sidebar-active`, vinho nos dois temas.
- Para conferir com os olhos, abra o `/_design` e use o alternador de tema.

## Raio e fonte

- **Raio**: `--radius-sm` 4px (selos, caixas de seleção), `--radius-md` 5px (botões, campos, abas) e `--radius-lg` 8px (cards, tabelas, janelas). Os utilitários `rounded-sm/md/lg` leem daqui. A **pílula** (18px, `rounded-pill`, `--radius-pill` em `globals.css`) vale para botões das janelas de confirmação, selos e campos de busca arredondados. `rounded-full` fica só para círculos e pontos.
- **Fonte**: Plus Jakarta Sans, com a faixa completa de pesos da fonte variável (300 a 800; o `font-semibold` usa o 600). Ela vem do `next/font` em `app/layout.tsx`, pela variável `--font-jakarta`; o `--font-sans` do `tokens.css` monta a pilha a partir dela. Para trocar de fonte, troque o `next/font` e a variável. Para testar rápido, coloque a fonte direto em `--font-sans`.
- **Escala de texto** (fechada, em `globals.css`): 12, 13, 14, 16, 20, 24, 32 e 64 px, na **base 14** e escrita em **rem** (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl` e `text-display`). O espaçamento (`--spacing`) também é rem na base 14. Não crie tamanhos novos.

Para conferir uma troca de marca, raio ou fonte, edite o `tokens.css` e veja o `/_design` nos dois temas. O painel inteiro muda junto.

## Letra que acompanha a tela

O painel não tem zoom: o tamanho da letra sobe sozinho com a tela, e a pessoa ainda pode somar um pouco.

- A letra base mora no `<html>` (`--letra-base` em `globals.css`): **14px** até 1599px de largura, **15px** a partir de 1600px e **16px** a partir de 1920px. Os valores são escritos em rem (`0.875rem`, `0.9375rem`, `1rem`), então valem 14, 15 e 16px na preferência padrão do navegador e acompanham quem aumentou a fonte padrão.
- A preferência "Tamanho da letra" (menu da pessoa: Normal, Grande, Maior) soma `--letra-extra`: a classe `letra-grande` no `<html>` soma 1px e `letra-maior` soma 2px (`calc(1rem / 16)` e `calc(2rem / 16)`). A escolha fica no perfil e no cookie `tamanho_letra`; o login a traz de volta e o "Sair" apaga o cookie.
- **Por que tudo é rem**: o rem é relativo ao `<html>`. Texto, espaçamento, larguras do menu, raios e ícones em rem crescem juntos quando o `<html>` cresce; um `px` solto ficaria pequeno em tela grande.
- Por isso não se usa valor arbitrário em px nas classes (`text-[13px]`, `w-[300px]`). Para um tamanho novo, use a escala ou crie um token em rem (`calc(260rem / 14)`).
- Os ícones do `lucide-react` têm regra de tamanho em rem no `globals.css` (`svg.lucide[width="16"]`...). Se usar um tamanho novo, acrescente a regra.
- **Teste de guarda**: `src/styles/escala.test.ts` falha se a letra base sair do `<html>`, se a escala ou o espaçamento tiverem px, se uma largura de layout não estiver em rem, se um ícone não tiver regra ou se houver `-[Npx]` no JSX. O `e2e/identidade.spec.ts` confere no navegador (14px em 1366, 16px em 1920 e 2560, e a preferência).

## Regras de estilo

- Nada de cor crua (`bg-white`, `text-slate-500`, `#1a2b3c`) nem de valor arbitrário (`text-[13px]`, `mt-[7px]`). Use os tokens (`bg-surface`, `text-muted`, `text-danger`, `bg-warning-soft`...) e a escala do Tailwind (múltiplos de 4px).
- Para um valor novo que o sistema precisa (uma largura fixa, por exemplo), crie um token com comentário em `tokens.css` e exponha em `globals.css`, como `--conversation-list-width` e `w-lista-conversas`.
- Cor sempre com texto ou ícone junto, nunca só a cor (`StatusBadge`, `AgentStateIndicator`).
- **Caixa alta só por CSS** (`uppercase`): botões, rótulos de campo e cabeçalhos de tabela. Nunca escreva o texto em maiúsculas no código, para o leitor de tela e a busca continuarem normais.
- **Rótulos em vinho** e em negrito (`Label`). Rótulo de caixa de seleção ou interruptor é frase comum: use `ROTULO_DE_OPCAO` (`ui/rotulo-de-opcao.ts`).
- **Status com ponto**: o status de demanda é texto colorido com um ponto, sem fundo. A cor sempre vem junto do texto.
- **Sem sombra decorativa**: tabelas e cards não têm sombra; quem desenha a borda é o invólucro. Sombra só em coisa que flutua (menus, janelas).
- Ícones do `lucide-react`: 16px em linhas e botões, 18px no menu lateral e nos atalhos, traço 1.75, `aria-hidden` quando há texto ao lado.
- Animações de até 150ms, e o `prefers-reduced-motion` desliga todas (`globals.css`).

**Gráficos** (Gastos com IA): uma cor por funcionalidade, nos tokens `--gasto-*` (paleta conferida pelo validador da skill dataviz no claro e no escuro); a cor segue a funcionalidade, nunca a posição. Barra de dado só com `style={{ width|height: '<n>%' }}`; o gráfico é `aria-hidden` e sempre há uma tabela equivalente ("Ver em tabela") ou uma legenda visível com o texto. Texto nunca na cor da série. Números grandes em `font-extrabold`.

**Números do Início** (`NumeroInicio`): a variante `situacao` tem faixa colorida no topo, título em caixa alta (CSS), número grande, detalhe e link; a variante `mesa` tem ícone à esquerda e o cartão inteiro é o link. `data-numero`/`data-valor` são o contrato dos testes. A cor nunca fala sozinha: o título e o detalhe dizem o que o número é. **Custo só no Painel de situação:** `dados-situacao.ts` é o único arquivo do Início que lê gasto, `configuracoes` e `sinais_vida`; a Minha mesa nunca o importa (o teste `inicio-travas.spec.ts` confere a página e o pacote RSC).

**Contatos** (G3): a lista conta e pagina no servidor pela visão `contatos_lista` (regra de leitura de quem consulta); os filtros rápidos são exclusivos e levam `data-filtro`/`data-contagem` (contrato dos testes). Empresa arquivada não aparece em lugar nenhum da tela. A chave do agente grava ao clicar (otimista); desde a H2 as marcações da empresa moram no bloco de acesso do cartão de cada empresa, com Salvar (sem a migração da H2, voltam as caixas que gravam ao clicar). O painel é feito de seções (`SecaoPainel`, região com nome); a Parte H acrescenta o bloco de acesso entre Empresas e WhatsApp. "Apagar dados (LGPD)" fica separado, com borda tracejada vermelha e título "· só admin".

**Assistente** (G4): a resposta grande não fica no balão: prévia, tabela e arquivo viram cartões **Ver ao lado** e abrem no painel de resultado, com a aba na URL (`?resultado=`). O painel do pedido mostra a **prévia como veio** (o que o "sim" grava), nunca o pedido atual do banco; a demanda (setor, empresa, origem, histórico) vem do banco pela regra de leitura. "Sim, gravar" e "Mudar outra coisa" só escrevem a resposta pela pessoa e só aparecem na prévia da última mensagem, única e ainda sem selo. Os links do CSV seguem "Pedidos de nota: Corrigir e gerar"; na conversa mantêm "Baixar CSV Bling (parte N)" e no painel "· parte i de n". A conversa tem a largura `w-chat-assistente` (token `--assistant-chat-width`) e o menu abre recolhido, como no Atendimento.

**Treinar o agente** (G5): três colunas com o menu recolhido, como no Atendimento e no Assistente (larguras `w-lista-treinar` e `w-simulador-treinar`, tokens `--training-list-width` e `--training-simulator-width`). A lista tem o medidor compacto, os filtros Todas/Ligadas/Desligadas (`data-filtro`/`data-contagem`, contrato dos testes), a faixa de cor por tipo (Jeito `bg-warning`, Regra `bg-brand`, Situação `bg-info`) sempre com a legenda escrita e o tipo no nome do link, e a chave em cada linha. O editor é um `FormularioAlteravel` com id `form-orientacao`: SALVAR DESLIGADA e SALVAR E LIGAR são o mesmo envio, com `ativo` pelo botão; DESCARTAR remonta o formulário. Rótulos curtos nos botões segmentados levam o resto do nome em `sr-only` ("Jeito" → "Jeito de atender"). O simulador lê o formulário na hora do teste (o rascunho vai sem salvar) e acompanha as mudanças pelo evento `treinar:rascunho`; "Sem o rascunho" é um segundo teste, sob pedido, sem rascunho. Nada no simulador grava além do próprio teste.

**Ficha do cliente** (H1, `clientes/ficha/`): página inteira com o índice "Blocos da ficha" à esquerda (`w-indice-ficha`, token `--client-index-width`; ✓ com "completo" para o leitor de tela, "N pendentes", "vence"/"vencido" e cadeado escritos — a cor nunca fala sozinha) e os blocos como regiões com nome (`BlocoFicha`: título em caixa alta vinho, observação à direita, `fieldset` desligado para quem só vê). Um `FormularioAlteravel` para a aba inteira, com rodapé fixo (última alteração, CANCELAR remonta, SALVAR só ativo depois de hidratar) e o atributo `data-ficha-hidratada` (contrato dos e2e). Campo com lupa (`CampoComLupa`) para busca pública: o nome da lupa nunca repete o rótulo do campo ("Buscar dados públicos da empresa", "Buscar o endereço"). Valor em reais com `CampoDinheiro` ("R$" ao lado). Janelas dentro da ficha (acessos) param o envio no próprio formulário (`stopPropagation`) e o envio da ficha ignora o que não veio dele. Os pares de blocos (Contrato + Responsáveis, Certificado + Acessos) e as 5 colunas do Contato dependem da largura da coluna (container query `@container` + `@5xl:`), não da tela: a 1366 ficam empilhados e o Contato em 3 colunas. O link do índice rola e leva o foco ao título do bloco (`h2` com `tabIndex={-1}`). Botão que espera o servidor (lupas, revelar, copiar) usa `aria-disabled` + `aria-busy` e ignora o clique, nunca `disabled` (o foco cairia no body). **Acessos de portais:** faixa grafite com o escudo champanhe, senha `••••••••` com "senha guardada" para o leitor de tela, revelar (30 s) e copiar sempre pelo servidor; só `acessos-acoes.ts` (e a página, para saber se há chave) importa `lib/cofre.ts` (`cofre-guarda.test.ts`).

**Acesso por contato** (H2, `components/patterns/bloco-acesso.tsx`): o mesmo bloco na ficha (três colunas, borda vinho à esquerda: Dados e perfil · Setores que pode tratar + Permissões especiais · Documentos e avisos + prévia) e no painel de Contatos (uma coluna, `role="group"` com o nome da empresa). No painel de Contatos o bloco mora **dentro do cartão de cada empresa da seção "Empresas"** (no lugar das caixas instantâneas da G3): o cartão mostra o selo do perfil e o "Pode tratar", e o botão "Acesso" (nome acessível "Acesso em <empresa>") abre o bloco, um por vez; a frase de só leitura fica uma vez no fim da seção (prop `avisoSoLeitura={false}`). Perfil num `select` ("Perfil de acesso"); setores com `Checkbox` e, marcados, a chave "Pode ser procurado pelo agente do …"; permissões e avisos com `Switch` (nome acessível = rótulo). A prévia fica numa região grafite com os tokens do menu, `aria-live="polite"`, linhas com ✓ / ✗ / ➤ e o texto escondido "Pode:", "Recusa:", "Procurado:" (a cor nunca fala sozinha). Estado puro em `bloco-acesso-estado.ts`; o perfil mostrado é sempre o das marcações. Atributo `data-acesso-hidratado` (contrato dos e2e). Selos de perfil: Sócio grafite, Básico âmbar "Básico · definir", Personalizado contornado, os outros `info`. Faixa âmbar com ícone para "N contatos aguardando definir acesso". Na aba Documentos, o setor atual do documento (mesmo desativado, "<setor> (desativado)") sempre está entre as opções da linha, para o Salvar nunca o trocar por "da empresa" sozinho.

**Agentes** (I1, `app/(painel)/agentes`): cartões em grade com faixa de cor no topo pelo estado (Ligado `success`, Teste `warning`, Desligado `border`), estado em texto com ponto ("● Ligado"), contagens com ícone e números do mês em três colunas (só dono e administrador); marcadores tracejados para o que vem depois ("Tarefas de trabalho: chegam numa próxima etapa."). Ficha: cabeçalho com o seletor de estado (`role="group"` "Estado do agente", botões com `aria-pressed`), selo "só o dono" com cadeado (o cadeado nunca sozinho), caixas de Modelo/Custo/Conversas; abas como links (`aria-current`); faixas `info` ("Nesta etapa só o Thiago atende…") e `warning` (sem migração). Skills por tipo com o "quando o agente lê" num selo; Limites com fio `danger` à esquerda; diferença de versões com "+"/"−", cor e texto escondido "Adicionado:"/"Removido:". Ferramentas: "só leitura" `success`, "aprovação"/"o cliente confirma" `warning` com cadeado.

## Quando usar ui/, patterns/ ou layout/

- **`ui/`**: peças genéricas, sem regra de negócio, que serviriam em qualquer produto: botão, campo, janela, tabela, selo. Vêm do shadcn/ui (Radix) e são ajustadas aos tokens. Mude aqui só o que deve mudar em todo lugar.
  - Alguns primitivos estão disponíveis sem uso nas telas ainda: `ui/popover.tsx`, `ui/scroll-area.tsx` e `ui/separator.tsx`. Ficam de propósito (demonstrados no `/_design`) para a próxima tela não copiar outro do shadcn; apague se continuarem sem uso depois de algumas fases.
- **`patterns/`**: peças que falam a língua do escritório: DataTable com filtros na URL, StatusBadge (demanda, conversa e tipo de orientação), PrioridadeTexto e PrazoTexto (prioridade e prazo das demandas, sempre escritos), MessageBubble, DiffPreview, OrderSummary, BlingExportButton, ConfirmDialog, PermissionGate, FormField, HistoricoRolante (lista de mensagens que acompanha a rolagem), AvisoErro (`?erro=` das actions), EscolherEmpresa (busca de empresa num formulário, envia o id). Se o mesmo arranjo aparece em duas telas, ele vira um pattern.
- **`layout/`**: a casca que envolve todas as telas: AppShell, Sidebar, Topbar, PageHeader, busca global e lista de atalhos.
  - **Atalhos do menu** (`atalhos-menu.tsx`): os quatro quadrados do topo do menu (Início, Meu perfil, WhatsApp e Sair). Atalho novo entra ali.
  - **Trilha** (`trilha.ts`): o caminho "Cadastros › Clientes" da barra do topo sai da rota. Tela nova entra na tabela da trilha.
  - **Nome e monograma do escritório** (`lib/escritorio.ts`): `NOME_ESCRITORIO` e `MONOGRAMA`, usados no menu e no login. É o único lugar para trocar quando o logo chegar.
- Uma tela (`app/(painel)/...`) monta patterns e primitivos. Ela não recria com classes soltas algo que já é um pattern.

**Cronômetro de espera** (`atendimento/cronometro-espera.tsx`): verde/âmbar/vermelho pelos limites de Configurações › Limites de espera, sempre com o número ("18 min") e, para o leitor de tela, "esperando há 18 minutos". **Marco** (centralizado, cinza) e **cartão de decisão** (tracejado) só aparecem na conversa; texto de pedido de nota nunca entra neles. O catálogo `/_design` mostra três cronômetros e um marco ("Atendimento (Parte E)").

**Ficha em página inteira** (Parte D, `usuarios/ficha-usuario.tsx`): cadastros com muitos campos usam página inteira com trilha, 3 colunas e rodapé com Voltar e Salvar, em vez de painel lateral. Campos que somem por uma escolha (ex.: "Administrador = Sim") ficam num `fieldset` desligado e escondido pela classe `hidden`: não vão no envio e voltam com o valor de antes.

**Cartão de Configurações** (`FormularioConfig` + `RodapeConfig`): cada cartão salva sozinho, sem recarregar a página; o erro aparece no cartão e o que foi digitado fica. Campo alterado fica âmbar (`data-alterado`, CSS em `globals.css`) e ganha "antes: X" em texto (a cor nunca está sozinha); o rodapé diz "N alterações não salvas" e tem DESCARTAR. Sair com alteração abre a janela SALVAR E SAIR · DESCARTAR · CONTINUAR AQUI (`GuardaSaida`; só em Configurações — as outras telas usam a pergunta do navegador).

## Criar um componente novo

1. Veja no catálogo `/_design` se já existe algo parecido.
2. Escolha a pasta pela regra acima. Para um primitivo do shadcn que ainda não existe, rode `pnpm dlx shadcn@latest add <nome>` dentro de `apps/painel` (o `components.json` já aponta para `@/components/ui` e `@/lib/cn`).
3. Troque toda cor do componente por tokens e textos de acessibilidade em português (ex.: "Fechar").
4. Aceite `className` e junte com `cn()`. Variantes com `class-variance-authority` (veja `ui/button.tsx`).
5. Acessibilidade: nome acessível em todo botão só de ícone, foco visível (já vem do `:focus-visible` global; não use `outline-none` sem pôr o anel em outro lugar), teclado completo, e janelas pelo `Dialog`/`Sheet` do Radix, que prendem e devolvem o foco.
6. Coloque um exemplo no `/_design` (`app/(painel)/%5Fdesign/`), com dados realistas em pt-BR.
7. Se tiver lógica pura (formatação, regra de exibição), deixe-a num `.ts` com teste no vitest.

## Catálogo vivo: /_design

- Com o painel em desenvolvimento (`pnpm --filter @escritorio/painel dev`), abra `http://localhost:3000/_design`.
- A página mostra todas as cores por grupo (marca, menu grafite, champanhe, módulos), a tipografia com `text-3xl`, `text-display` e o título "Clientes 124", um recorte do menu lateral, os raios, as sombras, todos os primitivos com seus estados e os padrões de domínio com dados de exemplo (status de demanda com ponto e os 5 tipos de confirmação).
- Tem um alternador de tema para conferir o claro e o escuro.
- Em produção (`NODE_ENV=production`), a rota responde 404.

## Vocabulário oficial da interface

Use sempre estes termos, em português do Brasil:

| Use | Não use |
|---|---|
| Demanda | ticket, chamado |
| Atendimento | inbox, suporte |
| Conversa | chat, thread |
| Empresa | cliente PJ, conta |
| Contato | lead, usuário do WhatsApp |
| Setor | departamento, fila |
| Pedido de nota | pedido de NF, order |
| CSV do Bling | planilha do Bling, export |
| Assumir | pegar, atribuir a mim |
| Devolver ao agente | liberar, soltar |
| Nota interna | comentário, observação privada |
| Concluir | fechar, resolver |

- **Atendimento:** "Esperando pessoa", "Com o agente", "Concluídas hoje", "esperando você", "agente passou: <motivo>", "pediu para falar com pessoa", "com <nome>", "respondendo", "resolvido pelo agente", "agente pausado para esta empresa / este contato", "Ver decisão", "por quê?", "Decisão do agente", "Sugestão do assistente (editável)", "Usar sugestão", "Abrir demanda", "trocar empresa", "Concluir atendimento".
- **Assistente:** "Assistente · Geral" / "Assistente · <contato>"; histórico "Geral", "+n conversas"; cartões "Prévia #N · 1 alteração", "Tabela · N linhas", nome do arquivo, "Ver ao lado"; abas "Pedido #N", "<título da tabela> (n)", "Arquivos (n)", "resultados desta conversa"; painel do pedido "Nota de venda · Setor <setor>", "Destinatário", "Pagamento", "Entrega" ("endereço do cadastro"), "Pedido veio de" ("WhatsApp · dd/mm", "Painel · dd/mm"), "O que mudou" (adicionado, removido, alterado, "antes: …"), "Total do pedido", "Gravado às HH:MM por <pessoa>", "Abrir demanda", "Arquivo para o Bling" ("pronto", "ainda não gerado"), "Histórico do pedido"; botões "Sim, gravar" e "Mudar outra coisa"; vazio "Os resultados aparecem aqui".
- **Pessoa** (usuário da equipe): "Nova pessoa", "Cadastro de <nome>". **Nível** (de uma permissão): "Só as minhas", "Do meu setor", "Todas", "Só ver", "Ver e editar", "Editar e arquivar", "Corrigir e gerar", "Site e WhatsApp". **Horário de acesso**: "Permitido", "Bloqueado", "Fora do seu horário de acesso".

- **Gastos com IA:** "Gastos com IA", "Total do mês × teto", "Previsão até o fim do mês", "Chamadas à IA", "Custo por atendimento", "Áudios transcritos", "Por funcionalidade", "Por dia", "Quem mais gasta na equipe", "Onde gastou", "Gastos por cliente", "Atendimentos", "Resolvidos pelo agente", "passou para pessoa", "resolvido pelo agente", "Não identificado", "Exportar". **Atendimento** nesta tela = as mensagens de um telefone num mesmo dia.
- **Configurações:** grupos "Escritório", "Agente e atendimento", "Cadastros", "Sistema"; "não salvo", "antes: X", "N alterações não salvas", "Sem alterações", "Descartar", "Salvar e sair", "Continuar aqui", "Só para as novas", "Aplicar também às N abertas", "prazo recalculado por mudança de regra (<pessoa>)".
- **Início:** "Situação do escritório" (administrador) e a saudação "Bom dia, <nome>" (quem atende); "Esperando pessoa", "Demandas abertas", "Vencem hoje", "Vencidas", "Sem responsável"; "conversas esperando você", "minhas demandas vencidas", "sem responsável nos meus setores"; "Minhas demandas por prazo" com os grupos "Vencida", "Vencem hoje", "Próximos dias"; "Você concluiu N demandas hoje"; "N com o agente hoje"; "atualizado há N s · recarrega a cada minuto"; no bloco Sistema: "atendendo", "pausado", "pausado: limite de IA do mês", "conectado", "sem sinal".
- **Contatos:** "Nome, telefone ou empresa" (busca); filtros "Todos", "Agente desligado", "Sem empresa", "Pode pedir nota", "Muda preço"; "Empresa: todas", "Último contato: qualquer data" (Hoje, Últimos 7 dias, Últimos 30 dias, Há mais de 30 dias, Sem conversa); "Ordem: último contato"; selos "Pede nota", "Muda preço e cadastra produto", "Só conversa", " · 1 de 2"; chave "atende"/"desligado"; estado "esperando pessoa", "com você", "com <nome>", "com o agente", "sem conversa", "nenhuma conversa visível"; no painel "Abrir conversa", "Editar", "Vincular empresa", "WhatsApp" ("N atendimentos", "Último contato", "Conversa agora", "Resolvidas pelo agente"), "Demandas abertas", "Apagar dados (LGPD) · só admin".
- **Ficha do cliente:** "Ficha do cliente", "Blocos da ficha", "completo", "1 pendente"/"N pendentes", "vence", "vencido", "protegido", "Identificação", "Endereço", "Contato", "Fiscal · Inscrições de substituto tributário", "Contrato e honorários", "Responsáveis por setor", "Certificado digital", "Acessos de portais", "linha sem inscrição", "Outros setores (N)", "Fila do setor", "Preenchido pela busca: …", "Preencha à mão", "Certificado vence em N dias", "cliente desde MM/AAAA", "Última alteração: <pessoa>, dd/mm HH:MM", "senha guardada", "Revelar a senha de <portal>", "Copiar a senha de <portal>", "Senha copiada.", "Ver acessos de portais", "Sem senha (ex.: entra pelo certificado)".
- **Acesso por contato:** "Perfil de acesso", "Sócio", "Administrativo", "Financeiro", "RH/DP", "Compras/Vendas", "Funcionário", "Básico", "Básico · definir", "Personalizado", "Setores que pode tratar", "Pode ser procurado pelo agente do …", "Permissões especiais", "Pedir nota de venda", "Mudar preço e cadastrar produto", "Ver valores", "Documentos e avisos", "Receber documentos dos setores permitidos", "Avisar quando sair documento novo", "Receber alertas de acesso", "O que o agente vai fazer com …", "Pode tratar", "Todos os setores contratados", "Só conversa e abre demanda", "N contatos aguardando definir acesso", "Acesso em <empresa>", "Acesso salvo.", "fora do contrato", "Tem valores (boleto, folha, salários)", "Documento da empresa (todos com acesso)", "<setor> (desativado)", "Fora do acesso: …".
- **Agentes:** "Agentes", "Agente", "Thiago", "Ligado", "Teste", "Desligado", "Em teste", "Por trás", "Mesma voz", "Passa a conversa", "Direto, é a voz do escritório", "Fala com o cliente", "a definir", "Skills", "Jeito de atuar", "Limites", "Procedimentos", "Conhecimento", "Exemplos", "sempre lido", "Subir skill", "Versões", "Restaurar a versão N", "Ferramentas", "só leitura", "aprovação", "Como fala com o cliente", "Regras por assunto", "Nova regra", "Orientações", "Testar", "Atividade e custo", "Histórico", "só o dono", "Por agente".

- **Agentes dos setores (I2):** bloco **Agente <setor>** na demanda (`trabalho-agente.tsx`): a pré-análise do pedido de nota usa ícone mais a palavra **Falta** (`danger`), **Atenção** (`warning`) ou **OK** (`success`), nunca só a cor; cada sugestão tem o selo de estado (**Aguardando aprovação** em `warning`, **Aprovada** em `success`, **Descartada** neutro) e os botões **Aprovar** e **Descartar**. Faixa da ficha do agente (`faixas.tsx`): `info` normal; `warning` para "sem modo" e para "sem a I2" (banco sem a atualização).
- **Tarefa do agente (I3a):** página `/tarefas/<id>` (`app/(painel)/tarefas/[id]/`), com a coluna principal (`lg:col-span-2`) e, à direita, **Aprovação**, **Custo desta tarefa** e **Linha do tempo**. O cartão principal tem a **borda de cima da marca** (`border-t-4 border-t-brand`), como o cartão Aprovação. O cabeçalho mostra os **chips de estado** (Trabalhando, Aguardando pendências, Pronto para aprovar; o atual em `warning`, com `aria-current`) e, nos estados pausada, aprovada e descartada, um selo só com o texto do estado. A **barra de etapas** usa ✓ (feita, `success`), ampulheta (a etapa de agora, `warning`) ou o número; a última etapa, **Aprovação**, é da pessoa do setor. Em **Fontes**, o que falta aparece como **Faltando**, sempre com **ícone e palavra** (nunca só cor), e o aviso **só leitura** vem com cadeado e texto. O resultado leva o selo **rascunho · ainda não vale** (vira **aprovado**) e **cartões de destaque** (rótulo, valor, detalhe); a linha provisória leva o selo **provisória**. O cadeado com texto também aparece na Aprovação: **Só vale depois da aprovação de uma pessoa do <setor>**.
- **Faixa das tarefas na ficha do agente (I3a):** `FaixaTarefas` em `faixas.tsx`: `info` normal ("Desligado: não recebe tarefas.", "Em teste: só o dono e o administrador pedem tarefas.", "Ligado: recebe tarefas das demandas do setor <setor>."); `warning` para **setor inativo** e para **banco sem a I3** ("As tarefas de trabalho aparecem quando a atualização do banco da Parte I3 for aplicada."). Agente com os dois tipos mostra as duas faixas.

- **Drive e planilha (I3b):** bloco **Arquivos** da ficha (`bloco-arquivos.tsx`): selo `neutral` com cadeado **"só leitura"**; aviso da situação do Drive em `success` (ícone de check) ou `warning` (ícone de alerta), nunca só a cor; o campo **Pasta no Drive** fica **fora do formulário da ficha** (`form=` de um formulário que não existe) e salva sozinho em **Salvar pasta**, sem entrar em "não salvo". Nas fontes da tarefa, o selo **"Drive · só leitura"** e, para arquivo removido pela guarda, **"Apagado pela guarda"**; o botão **Ler a pasta de novo** fica ao lado das fontes. No resultado, **Baixar planilha** é um botão `outline` ao lado de **Baixar CSV**. A Aprovação mostra o aviso `warning` com ícone **"N linhas provisórias"** (`role="status"`). No simulador dos agentes dos setores há o seletor **"Modo de falar com o cliente"** (o padrão do agente marcado "(padrão)"). O cartão do agente mostra **"N tarefas aguardando aprovação · Revisar"** (link na cor da marca, abre a mais antiga).
- **Pedir ao agente (I4):** janela `PedirAoAgente` (`app/(painel)/demandas/pedir-ao-agente.tsx`), usada na demanda e no topo do Assistente. Os **cartões de agente** são um `radiogroup` rotulado "Agente" (cada cartão é `role="radio"` com `aria-checked`); o selecionado usa `border-brand bg-brand-soft`, e "em teste" aparece escrito em `warning`. O **destino** é texto antes do envio ("Nesta demanda #N" ou "Demanda nova no <setor>"). Os **chips** de arquivo e do Drive têm um botão de tirar com rótulo ("Tirar <arquivo>", "Não ler a pasta do Drive"); arquivo recusado mostra a frase em `danger` com `role="alert"` e desliga o envio. Os **checkboxes de aviso** (Painel, Meu WhatsApp) deixam o desligado com o **motivo escrito** embaixo, nunca só esmaecido. A **faixa de custo** tem ícone de moeda e texto em `bg-surface-muted`. O botão primário é **"Enviar para o agente"**, com ícone de envio. Na tarefa, o cartão **Pedido** (`role="region"`, "Prazo desejado", "Avisos: painel e WhatsApp") fica na lateral, e na ficha do cliente o índice ganhou o link **Arquivos** (leva o foco ao título do bloco).

Os dois robôs têm nomes e cores diferentes:

- **Agente**: o agente de clientes, que atende no WhatsApp. Estados "Agente ativo" e "Agente pausado" (geral, contato, empresa ou teto de IA), ou "Assumida por Fulano".
- **Assistente**: a IA interna da equipe, na tela Assistente e na aba Assistente da conversa. Tem cor própria (`--assistant`).

## Atalhos do teclado

A lista aparece com `?` em qualquer tela, fora de campos de texto, ou pelo menu da pessoa, em "Atalhos do teclado". Ao criar um atalho, acrescente-o em `ATALHOS` (`components/layout/atalhos.ts`) e use `ignorarAtalho()` para ele não disparar enquanto a pessoa digita. No compositor da conversa, **Enter envia e Shift+Enter quebra a linha** (Ctrl+Enter também envia); com a lista de respostas prontas aberta, Enter escolhe a resposta.

## Testes de acessibilidade

- Rode `pnpm --filter @escritorio/painel e2e acessibilidade`. O spec `apps/painel/e2e/acessibilidade.spec.ts` sobe o painel na porta 3100 com o banco local.
- Ele passa o axe (WCAG 2.0/2.1 A e AA) em todas as telas, no tema claro e no escuro, com painéis laterais, busca, menu e janelas abertos.
- Também confere o teclado: link "Pular para o conteúdo", `?` e a volta do foco.
- O teste falha em violação séria ou crítica. As moderadas aparecem no log como `[a11y]`.
- Tela nova: acrescente a rota na lista do spec.
