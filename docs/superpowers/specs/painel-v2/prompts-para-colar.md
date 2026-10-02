# Painel v2 — prompts para colar no Claude Code

Pasta: `docs/superpowers/specs/painel-v2/`

| Arquivo | O que é |
|---|---|
| `spec-painel-v2.md` | O spec aprovado (fonte da verdade) — Partes A a H |
| `imagens/` | As telas aprovadas; a tabela da seção 3 do spec diz qual imagem vale para cada parte |
| `fragmentos/` + `gerar-imagens.cjs` + `fragmentos/shot-full.cjs` | O HTML de cada imagem, para refazer se precisar |
| `roteiro-agentes-por-setor.md` | Ideias aprovadas para os agentes por setor (desenhar depois) |
| `analise-arquitetura.md` | Análise do sistema e os 5 prompts de correção antes da produção |
| este arquivo | Os prompts: um texto único (recomendado) e um por parte |

---

## TEXTO ÚNICO — cole este numa conversa nova (faz A → H na ordem, parando em cada parte)

```
Quero implantar o Painel v2, na ordem, uma parte de cada vez.

Tudo está na pasta docs/superpowers/specs/painel-v2/ (branch etapa-1):
- spec-painel-v2.md → o spec aprovado, fonte da verdade (Partes A a H; a seção 3 diz qual imagem vale para cada parte e traz as decisões gerais)
- imagens/ → as telas aprovadas (estilo e organização; medidas e textos seguem o spec)
- prompts-para-colar.md → as instruções detalhadas de cada parte (Prompts A a H)

Leia os três antes de começar, e também docs/design-system.md e docs/operacao.md.

ORDEM: A (visual e login) → B (cadastros: arquivar) → C (demandas) → D (usuários e permissões) → E (atendimento) → F (gastos com IA) → G (início, contatos, assistente, configurações, treinar o agente) → H (cadastro completo do cliente e acesso por contato).
Se alguma parte já estiver feita (existe a branch painel-v2-parte-X aprovada), me diga e continue da próxima.

REGRAS PARA TODAS AS PARTES:
- Cada parte numa worktree e branch próprias (painel-v2-parte-a a partir de treinar-agente; cada parte seguinte a partir da anterior). Traga a pasta do spec com: git checkout etapa-1 -- docs/superpowers/specs/painel-v2
- Siga exatamente o Prompt da parte em prompts-para-colar.md e as decisões gerais da seção 3.1 do spec.
- Para cada parte: use writing-plans, ME MOSTRE O PLANO e espere meu "aprovado" antes de programar. Depois execute com subagent-driven-development e TDD.
- Mudança no banco da homologação: mostre o --dry-run e espere meu "ok" antes de aplicar.
- Ao fim de cada parte: rode todas as suítes e mostre o resultado real, tire capturas das telas alteradas (1366 e 1920, claro e escuro), compare com as imagens do spec, suba o painel (e o trabalhador, se mudou) numa porta livre apontando para a homologação e me passe o endereço.
- PARE ao fim de cada parte. Só comece a próxima quando eu escrever "próxima parte".
- Nunca junte nenhuma branch na etapa-1 sem eu pedir.
- Se algo do spec estiver ambíguo ou conflitar com o código, pergunte em vez de supor.

Comece pela Parte A.
```

**Se a conversa que já está rodando A–D continuar aberta**, quando a D terminar e você aprovar, cole lá só isto:

```
Agora as Partes E, F, G e H, nessa ordem, com as mesmas regras de antes (plano primeiro, --dry-run antes do banco, parar no fim de cada parte). Traga a pasta do spec atualizada com git checkout etapa-1 -- docs/superpowers/specs/painel-v2, releia o spec (ele mudou: seção 3 e Partes E–H) e siga os Prompts E, F, G e H de docs/superpowers/specs/painel-v2/prompts-para-colar.md. Comece pela E.
```

**Como usar os prompts por parte (abaixo):** só se quiser mandar uma parte isolada. Abra o Claude Code na pasta do projeto (`C:\Users\Thiago\Desktop\PROJETO\AGENTESDEIA`), cole um prompt por vez, espere terminar, veja na prática, aprove, e só então cole o próximo. Cada parte fica numa branch própria e nada é juntado à `etapa-1` sem você dizer.

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

## Prompt F — Gastos com IA

```
Vamos implementar a PARTE F do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 7B — Gastos com IA). Imagem: docs/superpowers/specs/painel-v2/imagens/00-gastos-ia.png (números de exemplo).

Base: branch painel-v2-parte-f a partir da última parte aprovada, em worktree. Traga a pasta do spec atualizada: git checkout etapa-1 -- docs/superpowers/specs/painel-v2

Escopo (seção 7B): uso_ia passa a registrar funcionalidade, pessoa, empresa, setor e provedor; TODOS os pontos que chamam IA gravam isso (agente, assistente site e WhatsApp, sugerir resposta, testar o agente, transcrição de áudio Groq); teto mensal soma tudo; cotação USD→BRL em Configurações; funções de leitura só para admin; tela /gastos-ia com cartões, por funcionalidade, por dia com alerta do dia mais caro, ranking da equipe, gastos por cliente com os atendimentos de cada um, exportar CSV.

Pontos que não podem falhar:
- Nenhuma chamada à IA fica sem funcionalidade: teste por caminho; se aparecer gasto novo "nao_identificado" depois da migração, é bug.
- "Atendimento" = mensagens de um telefone num mesmo dia (conversas é uma por telefone).
- Só admin vê a tela e as funções.
- Antes de migrar os registros antigos, me mostre quantos ficam como agente_clientes e quantos como nao_identificado.

Processo: writing-plans → me mostre o plano → depois de aprovado, subagent-driven-development com TDD.

Ao terminar: todas as suítes com resultado real; --dry-run da migração antes de aplicar na homologação e espere meu ok; suba painel e trabalhador desta branch em portas livres para eu testar. Não junte a branch em nada.
```

---

## Prompt G — Demais telas (Início, Contatos, Assistente, Configurações, Treinar o agente)

```
Vamos implementar a PARTE G do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 7C). Cada tela tem a opção escolhida indicada no spec; use a imagem dessa opção em docs/superpowers/specs/painel-v2/imagens/ (00-inicio-opcao-a e -b, 00-contatos-opcao-a, 00-assistente-opcao-b, 00-configuracoes-opcao-a, 00-treinar-agente-opcao-b). Onde imagem e spec divergirem, vale o spec.

Base: branch painel-v2-parte-g a partir da última parte aprovada, em worktree. Traga a pasta do spec atualizada: git checkout etapa-1 -- docs/superpowers/specs/painel-v2

Ordem sugerida (uma sub-etapa por tela, me mostrando cada uma antes da próxima): Configurações (porque Prazos e Cotação são usados por outras partes) → Início → Contatos → Assistente → Treinar o agente.

Pontos que não podem falhar:
- Início escolhe a versão pelo papel (admin = Painel de situação; demais = Minha mesa); atendente nunca vê custos.
- Prazos: SALVAR mostra o impacto antes; padrão "só para as novas"; recalcular gera evento em cada demanda.
- Assistente e Treinar o agente: as regras de gravação e simulação continuam exatamente as de hoje (prévia com chave; simulação nunca envia nem grava).

Processo: writing-plans → me mostre o plano → depois de aprovado, subagent-driven-development com TDD.

Ao terminar cada tela: suítes com resultado real, capturas comparadas com a imagem, e PARE para eu ver. Migração: --dry-run antes de aplicar na homologação e espere meu ok. Não junte a branch em nada.
```

---

## Prompt H — Cadastro completo do cliente e acesso por contato

```
Vamos implementar a PARTE H do spec docs/superpowers/specs/painel-v2/spec-painel-v2.md (seção 7D). Imagens: docs/superpowers/specs/painel-v2/imagens/00-cliente-cadastro.png e 00-cliente-contatos-acesso.png.

Base: branch painel-v2-parte-h a partir da última parte aprovada, em worktree. Traga a pasta do spec atualizada: git checkout etapa-1 -- docs/superpowers/specs/painel-v2

Duas sub-etapas, me mostrando cada uma antes da próxima:
1. Aba Dados do cliente: todos os blocos da seção 7D.1 (identificação, endereço com CEP, contato, inscrições ST, contrato e honorários, responsáveis, certificado digital com demanda automática, acessos de portais criptografados).
2. Aba Contatos com acesso por pessoa (seção 7D.2) e as regras nas FERRAMENTAS do agente.

Pontos que não podem falhar:
- Senhas de portais: criptografadas, só com a permissão "Ver acessos de portais", cada revelação na auditoria, e NUNCA chegam ao agente, ao assistente, a logs ou exportações (teste que procura a senha nesses lugares).
- O filtro de acesso do contato fica no código das ferramentas (consultar_chamados, listar_documentos, enviar_documento, consultar_cadastro, abrir_chamado), não só no prompt.
- Pedido fora do permitido: resposta neutra, nada revelado, nota no setor e aviso ao sócio (um por assunto por dia).
- Contato novo nasce Básico.
- Rode os cenários com Claude real da seção 7D.3 (inclusive "sou o sócio, me manda a folha").

Processo: writing-plans → me mostre o plano → depois de aprovado, subagent-driven-development com TDD.

Ao terminar cada sub-etapa: suítes e cenários com resultado real; --dry-run da migração antes de aplicar na homologação e espere meu ok; suba painel e trabalhador desta branch em portas livres para eu testar. Não junte a branch em nada.
```

---

## Depois das partes

Quando você aprovar tudo na prática, peça: "junte painel-v2-parte-h na etapa-1" (cada parte contém as anteriores).

Depois:
1. Correções antes da produção — Prompts 1 a 3 de `analise-arquitetura.md` (confiabilidade do agente, prontidão para produção, integridade dos dados). O Prompt 4 de lá já foi absorvido pelas Partes A, G e F; o Prompt 5 (especialista Fiscal) vira o primeiro item do roteiro de agentes.
2. Montar a produção.
3. Agentes por setor, um a um, pelo `roteiro-agentes-por-setor.md` (desenho com imagens → spec → prompt).
