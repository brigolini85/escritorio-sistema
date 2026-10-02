# Painel v2 — prompts para colar no Claude Code

Pasta: `docs/superpowers/specs/painel-v2/`

| Arquivo | O que é |
|---|---|
| `spec-painel-v2.md` | O spec aprovado (fonte da verdade) |
| `imagens/` | As telas aprovadas (00 login · 01 menu e arquivar · 02 excluir de vez · 03 demandas tabela · 04 quadro e nova demanda · 05 painel lateral · 06 cadastro de usuário) |
| `fragmentos/` + `gerar-imagens.cjs` | O HTML de cada imagem, para refazer se precisar |
| este arquivo | Os prompts, um por parte |

**Como usar:** abra o Claude Code na pasta do projeto (`C:\Users\Thiago\Desktop\PROJETO\AGENTESDEIA`) numa **conversa nova** e cole **um prompt por vez**. Espere terminar, veja na prática, aprove, e só então cole o próximo. Cada parte fica numa branch própria e nada é juntado à `etapa-1` sem você dizer.

---

## Prompt A — Identidade visual + login (o que você vai ver primeiro)

```
Vamos implementar a PARTE A do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 4: identidade visual "Grafite, vinho e champanhe", menu, login "Faixa vinho", janelas de confirmação, tamanho da letra que acompanha a tela).

Leia antes: o spec inteiro (para contexto) e as imagens em docs/superpowers/specs/painel-v2/imagens/ (00-login, 00-login-tela-grande, 01-menu-e-clientes-arquivar, 02-excluir-de-vez). As imagens mostram estilo e organização; medidas e textos finais seguem o spec. Leia também docs/design-system.md.

Base: crie uma worktree nova com a branch painel-v2-parte-a a partir da branch treinar-agente (ela já tem o painel redesenhado). Traga a pasta do spec para ela com: git checkout etapa-1 -- docs/superpowers/specs/painel-v2

Regras:
- Só apps/painel (tokens.css, globals, layout/casca, patterns de confirmação, tela de login) + a migração mínima do aviso do login (chave aviso_login em configuracoes e função pública que devolve só esse texto) e a coluna usuarios.tamanho_letra.
- Nenhuma regra de negócio, rota, data-testid ou texto usado em teste muda sem grep nos testes.
- Nada de cor, tamanho ou espaçamento solto no JSX: tudo nos tokens. Contraste AA conferido por tokens.test.ts.
- Inspiração no Acessórias sem cópia: siga a tabela da seção 4.3 do spec (faixa vinho + fio champanhe, atalhos quadrados, paleta própria de ícones, "Recolher" no rodapé).

Processo: use a skill writing-plans para escrever o plano da Parte A a partir do spec e me mostre para eu aprovar antes de codar. Depois de aprovado, execute com subagent-driven-development, TDD onde houver regra (tokens, tamanho de letra, aviso do login).

Ao terminar:
1. Rode todas as suítes do painel (test e e2e com axe nos dois temas) e mostre o resultado real.
2. Tire capturas de Login, Início, Atendimento, Demandas, Clientes e Configurações em 1366 e 1920 de largura, tema claro e escuro, e compare com as imagens do spec.
3. Suba o painel desta worktree em uma porta livre (ex.: 3003) apontando para a homologação e me diga o endereço para eu ver na prática.
4. Liste o que ficou pendente. Não junte a branch em nada.
```

---

## Prompt B — Cadastros: arquivar, excluir de vez, restaurar

```
Vamos implementar a PARTE B do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 5). Imagens: imagens/01-menu-e-clientes-arquivar.png e imagens/02-excluir-de-vez.png.

Base: branch painel-v2-parte-b a partir de painel-v2-parte-a (já aprovada), em worktree.

Pontos que não podem falhar:
- Um único "Excluir…": arquiva o que tem histórico, apaga de vez só o que nunca foi usado (só admin, digitando o nome).
- excluir_cadastro_definitivo RECUSA no banco se uso_do_cadastro tiver qualquer contagem > 0, mesmo que a tela deixe passar.
- Arquivar usa ativo = false + arquivado_em/arquivado_por (o trabalhador já filtra ativo em packages/db/src/repos.ts — confirme com teste que o agente deixa de ver).
- Arquivar cliente com demanda aberta AVISA, não bloqueia.
- Usuário arquivado não entra; excluir usuário de vez só se nunca atendeu nada (remove do Auth pelo servidor).
- "Apagar dados (LGPD)" do contato continua separado e igual.

Processo: writing-plans → me mostre o plano → depois de aprovado, subagent-driven-development com TDD. Migrações com testes pgTAP (permissões, recusa com histórico, restaurar). Playwright para os fluxos da tela.

Ao terminar: todas as suítes (painel, trabalhador, db, supabase test db) com resultado real; antes de aplicar a migração na homologação, mostre o --dry-run e espere meu ok; suba o painel numa porta livre para eu testar. Não junte a branch em nada.
```

---

## Prompt C — Gestão das demandas

```
Vamos implementar a PARTE C do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 6). Imagens: imagens/03-demandas-tabela.png, 04-demandas-quadro-e-nova.png, 05-demanda-painel-lateral.png.

Base: branch painel-v2-parte-c a partir de painel-v2-parte-b, em worktree.

Escopo (tudo na seção 6 do spec): tabela "Gestão das demandas" com duas informações por coluna e filtros rápidos com contador (abre primeiro, lembra a escolha); quadro com arrastar (concluir pede confirmação, alternativa por teclado); painel lateral com todas as ações (assumir, responsável, status, prioridade, prazo, nota interna, transferir, concluir, reabrir, editar título/descrição); nova demanda; busca; prioridade e prazo em dias úteis (urgente = mesmo dia, alta = 1, normal = 2, baixa = 5, editáveis em Configurações › Prazos), "Com o cliente" pausa o prazo; linha do tempo com todos os eventos; CSV Bling respeitando todos os filtros; avisos do trabalhador dizendo "Demanda #N".

Mexe também no trabalhador: abrir_chamado e abrir_pedido_nota ganham o parâmetro prioridade (regra no prompt do agente conforme o spec); alerta de vencimento em tarefas.ts.

Processo: writing-plans → me mostre o plano (pode dividir em sub-etapas: banco, trabalhador, tabela, painel lateral, quadro, nova demanda) → depois de aprovado, subagent-driven-development com TDD. pgTAP para prazo com feriado/fim de semana, pausa em "Com o cliente", evento de cada ação, setores. Cenários com Claude real para a prioridade (5 casos do spec).

Ao terminar: todas as suítes e cenários com resultado real; --dry-run da migração antes de aplicar na homologação e espere meu ok; suba painel e trabalhador desta branch em portas livres para eu testar. Não junte a branch em nada.
```

---

## Prompt D — Usuários e permissões por nível + horário de acesso

```
Vamos implementar a PARTE D do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 7). Imagem: imagens/06-usuario-cadastro.png.

Base: branch painel-v2-parte-d a partir de painel-v2-parte-c, em worktree.

ATENÇÃO — esta parte mexe na segurança (pode_ver_chamado, pode_ver_conversa, tem_permissao). Antes de mudar qualquer função, escreva testes pgTAP de regressão que congelem o que cada usuário de teste vê HOJE (demandas, conversas, Realtime). A migração converte as permissões atuais para níveis de forma que NINGUÉM passe a ver mais nem menos do que hoje sem o admin mexer (padrão "Do meu setor"; editar_clientes → "Editar e arquivar"; mudar_precos → "Mudar"; etc.).

Escopo: página inteira de cadastro (/usuarios/novo e /usuarios/[id]) em 3 colunas; cargo, setores, telefone, administrador (esconde permissões), permissões por módulo com níveis (tabela da seção 7.1), horário de acesso por dia (middleware + pode_acessar_agora nas gravações + assistente pelo WhatsApp; admin nunca bloqueado), observações, último acesso, reenviar convite; erro ao salvar não perde o digitado.

Processo: writing-plans → me mostre o plano → depois de aprovado, subagent-driven-development com TDD. Rode os testes de regressão antes e depois da mudança e mostre os dois resultados.

Ao terminar: todas as suítes com resultado real; --dry-run da migração antes de aplicar na homologação e espere meu ok; suba o painel numa porta livre para eu testar. Não junte a branch em nada.
```

---

## Prompt E — Atendimento

```
Vamos implementar a PARTE E do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 7A — Atendimento). Imagem: docs/superpowers/specs/painel-v2/imagens/00-atendimento.png.

Base: branch painel-v2-parte-e a partir da última parte aprovada (painel-v2-parte-d, ou a mais recente que existir), em worktree. Traga a pasta do spec atualizada: git checkout etapa-1 -- docs/superpowers/specs/painel-v2

Escopo (seção 7A): lista com grupos "Esperando pessoa"/"Com o agente", cronômetro de espera colorido, não lidas por pessoa, motivo da passagem e pausas visíveis; conversa com faixa de passagem, "por quê?" nas respostas do agente, cartões de decisão e marcos; trocar empresa; link do documento enviado pela IA; compositor com Anexar e Respostas prontas (já existem), Sugerir resposta (assistente só com leitura, nada é enviado sem clicar ENVIAR) e Abrir demanda (usa o painel de Nova demanda da Parte C); coluna direita com abas CLIENTE / ASSISTENTE / AGENTE.

Pontos que não podem falhar:
- Sugerir resposta nunca envia nem grava nada: teste que falha se a sugestão chamar responder ou qualquer ferramenta que grava.
- Não lidas são por pessoa (conversa_leituras com RLS da própria pessoa).
- Trocar empresa só entre empresas vinculadas ao contato.
- Atalhos J/K/A/N/Esc e os testes atuais do Atendimento continuam passando.

Processo: writing-plans → me mostre o plano → depois de aprovado, subagent-driven-development com TDD. pgTAP para banco, testes do trabalhador para motivo de passagem e sugestão, Playwright para a tela.

Ao terminar: todas as suítes com resultado real; --dry-run da migração antes de aplicar na homologação e espere meu ok; suba painel e trabalhador desta branch em portas livres para eu testar. Não junte a branch em nada.
```

---

## Depois das partes

Quando você aprovar tudo na prática, peça: "junte a última parte na etapa-1" (cada parte contém as anteriores). Depois seguimos com as outras telas (Contatos, Assistente, Configurações, Treinar o agente) no mesmo processo: desenho com imagens aqui → spec → prompt.
