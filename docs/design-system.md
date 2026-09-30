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
--brand-base: hsl(221 83% 45%); /* troque só isto: hsl(matiz saturação% luminosidade%) */
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
- A sintaxe de cor relativa pede navegador atual: Chrome/Edge 119+, Safari 18+ e Firefox 128+.
- Depois rode `pnpm --filter @escritorio/painel test`. O `tokens.test.ts` calcula as derivadas como o navegador e confere o contraste WCAG AA (texto 4,5:1; foco e bordas de campo 3:1) nos dois temas.
  - O teste usa a marca atual e mais 10 cores: vermelho, verde, roxo, laranja, amarelo, ciano, rosa, verde-folha, cinza e um azul claro.
- Para conferir com os olhos, abra o `/_design` e use o alternador de tema.

## Raio e fonte

- **Raio**: `--radius-sm` (selos, caixas de seleção), `--radius-md` (botões, campos, abas) e `--radius-lg` (cards, janelas). Os utilitários `rounded-sm/md/lg` leem daqui. `rounded-full` fica só para pílulas e pontos.
- **Fonte**: `--font-sans`. A Inter vem do `next/font` em `app/layout.tsx`, pela variável `--font-inter`. Para trocar de fonte, troque o `next/font` e aponte `--font-sans` para ela. Para testar rápido, coloque a fonte direto em `--font-sans`.
- A escala de texto é fechada (12, 13, 14, 16, 20 e 24 px) e fica em `globals.css`. Não crie tamanhos novos.

Para conferir uma troca de marca, raio ou fonte, edite o `tokens.css` e veja o `/_design` nos dois temas. O painel inteiro muda junto.

## Regras de estilo

- Nada de cor crua (`bg-white`, `text-slate-500`, `#1a2b3c`) nem de valor arbitrário (`text-[13px]`, `mt-[7px]`). Use os tokens (`bg-surface`, `text-muted`, `text-danger`, `bg-warning-soft`...) e a escala do Tailwind (múltiplos de 4px).
- Para um valor novo que o sistema precisa (uma largura fixa, por exemplo), crie um token com comentário em `tokens.css` e exponha em `globals.css`, como `--conversation-list-width` e `w-lista-conversas`.
- Cor sempre com texto ou ícone junto, nunca só a cor (`StatusBadge`, `AgentStateIndicator`).
- Ícones do `lucide-react`: 16px em linhas e botões, 20px na navegação, traço 1.75, `aria-hidden` quando há texto ao lado.
- Animações de até 150ms, e o `prefers-reduced-motion` desliga todas (`globals.css`).

## Quando usar ui/, patterns/ ou layout/

- **`ui/`**: peças genéricas, sem regra de negócio, que serviriam em qualquer produto: botão, campo, janela, tabela, selo. Vêm do shadcn/ui (Radix) e são ajustadas aos tokens. Mude aqui só o que deve mudar em todo lugar.
- **`patterns/`**: peças que falam a língua do escritório: DataTable com filtros na URL, StatusBadge de demanda, MessageBubble, DiffPreview, OrderSummary, BlingExportButton, ConfirmDialog, PermissionGate, FormField... Se o mesmo arranjo aparece em duas telas, ele vira um pattern.
- **`layout/`**: a casca que envolve todas as telas: AppShell, Sidebar, Topbar, PageHeader, busca global e lista de atalhos.
- Uma tela (`app/(painel)/...`) monta patterns e primitivos. Ela não recria com classes soltas algo que já é um pattern.

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
- A página mostra todas as cores por grupo, a tipografia, os raios, as sombras, todos os primitivos com seus estados e os padrões de domínio com dados de exemplo.
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

Os dois robôs têm nomes e cores diferentes:

- **Agente**: o agente de clientes, que atende no WhatsApp. Estados "Agente ativo" e "Agente pausado" (geral, contato, empresa ou teto de IA), ou "Assumida por Fulano".
- **Assistente**: a IA interna da equipe, na tela Assistente e na aba Assistente da conversa. Tem cor própria (`--assistant`).

## Atalhos do teclado

A lista aparece com `?` em qualquer tela, fora de campos de texto, ou pelo menu da pessoa, em "Atalhos do teclado". Ao criar um atalho, acrescente-o em `ATALHOS` (`components/layout/atalhos.ts`) e use `ignorarAtalho()` para ele não disparar enquanto a pessoa digita.

## Testes de acessibilidade

- Rode `pnpm --filter @escritorio/painel e2e acessibilidade`. O spec `apps/painel/e2e/acessibilidade.spec.ts` sobe o painel na porta 3100 com o banco local.
- Ele passa o axe (WCAG 2.0/2.1 A e AA) em todas as telas, no tema claro e no escuro, com painéis laterais, busca, menu e janelas abertos.
- Também confere o teclado: link "Pular para o conteúdo", `?` e a volta do foco.
- O teste falha em violação séria ou crítica. As moderadas aparecem no log como `[a11y]`.
- Tela nova: acrescente a rota na lista do spec.
