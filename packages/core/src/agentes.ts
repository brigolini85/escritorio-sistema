/** Parte I1 (spec 7E): agentes por departamento — constantes e regras puras do painel e do trabalhador. */

export const AGENTE_ATENDIMENTO_ID = 'a0000000-0000-4000-8000-000000000001';
export const SLUG_ATENDIMENTO = 'atendimento';

export const ESTADOS_AGENTE = ['desligado', 'teste', 'ligado'] as const;
export type EstadoAgente = (typeof ESTADOS_AGENTE)[number];
export const ROTULO_ESTADO: Record<EstadoAgente, string> = { desligado: 'Desligado', teste: 'Teste', ligado: 'Ligado' };

export const MODOS_CONTATO = ['por_tras', 'mesma_voz', 'passa_conversa'] as const;
export type ModoContato = (typeof MODOS_CONTATO)[number];
/** Os três modos de falar com o cliente (spec 7E.3, textos da imagem 00-agente-ficha). */
export const INFO_MODO: Record<ModoContato, { rotulo: string; explicacao: string; bomPara: string }> = {
  por_tras: {
    rotulo: 'Por trás',
    explicacao: 'O cliente só fala com o Thiago. O agente trabalha nos bastidores e devolve a resposta para o Thiago repassar.',
    bomPara: 'conferências e tarefas em que o cliente não precisa saber quem fez.',
  },
  mesma_voz: {
    rotulo: 'Mesma voz',
    explicacao: 'O agente responde direto na conversa, com o mesmo nome e o tom do escritório. Para o cliente, é uma conversa só.',
    bomPara: 'pedidos do dia a dia que o agente resolve sozinho, como nota de venda.',
  },
  passa_conversa: {
    rotulo: 'Passa a conversa',
    explicacao: 'O Thiago avisa o cliente e passa a conversa; o agente se apresenta pelo setor e segue até o fim.',
    bomPara: 'assuntos longos ou delicados, com várias perguntas e idas e voltas.',
  },
};
/** O Thiago não tem modo: ele é quem fala (D13). */
export const TEXTO_FALA_THIAGO = 'Direto, é a voz do escritório';

export const TIPOS_AGENTE = ['conversa', 'trabalho'] as const;
export type TipoAgente = (typeof TIPOS_AGENTE)[number];
export const ROTULO_TIPO_AGENTE: Record<TipoAgente, string> = { conversa: 'Conversa', trabalho: 'Trabalho' };

export const TIPOS_SKILL = ['jeito', 'limites', 'procedimento', 'conhecimento', 'exemplos'] as const;
export type TipoSkill = (typeof TIPOS_SKILL)[number];
/** Grupos da aba Skills (spec 7E.3): cada grupo diz quando o agente lê. */
export const INFO_TIPO_SKILL: Record<TipoSkill, { ordem: number; rotulo: string; titulo: string; quando: string; explicacao: string; sempre: boolean }> = {
  jeito: { ordem: 1, rotulo: 'Jeito de atuar', titulo: 'Jeito de atuar', quando: 'sempre lido',
    explicacao: 'Tom, como se apresenta, como escreve.', sempre: true },
  limites: { ordem: 2, rotulo: 'Limites', titulo: 'Limites — o que não pode fazer', quando: 'sempre lido · vence qualquer outra skill e orientação',
    explicacao: 'Proibições. Se um procedimento ou orientação disser o contrário, o limite vale.', sempre: true },
  procedimento: { ordem: 3, rotulo: 'Procedimentos', titulo: 'Procedimentos', quando: 'lido quando a tarefa aparece',
    explicacao: 'Passo a passo de uma tarefa. O agente vê nome e descrição; abre o resto quando precisa.', sempre: false },
  conhecimento: { ordem: 4, rotulo: 'Conhecimento', titulo: 'Conhecimento', quando: 'consultado sob demanda',
    explicacao: 'Referências que o agente busca quando o assunto pede.', sempre: false },
  exemplos: { ordem: 5, rotulo: 'Exemplos', titulo: 'Exemplos', quando: 'consultado sob demanda',
    explicacao: 'Casos bons e ruins de conversas reais, para o agente imitar ou evitar.', sempre: false },
};
export const ORDEM_PRIORIDADE = ['Regras fixas do sistema', 'Limites', 'Jeito de atuar', 'Procedimentos', 'Orientações da equipe'] as const;

export type EfeitoFerramenta = 'leitura' | 'grava' | 'envia';
export type InfoFerramenta = { rotulo: string; descricao: string; efeito: EfeitoFerramenta };
/** Catálogo (D15): as 16 ferramentas do Thiago, na ordem de FERRAMENTAS do trabalhador. O banco tem a mesma lista (ferramentas_do_catalogo). */
export const CATALOGO_FERRAMENTAS = {
  selecionar_empresa: { rotulo: 'Escolher a empresa da conversa', descricao: 'Quando o contato fala por mais de uma empresa.', efeito: 'grava' },
  abrir_chamado: { rotulo: 'Abrir demanda', descricao: 'Passa o pedido para o setor certo.', efeito: 'grava' },
  consultar_chamados: { rotulo: 'Ler demandas da empresa', descricao: 'Andamento do que já foi pedido (pelo acesso do contato).', efeito: 'leitura' },
  sinalizar_nao_entendido: { rotulo: 'Avisar que não entendeu', descricao: 'Na segunda vez, passa para uma pessoa.', efeito: 'grava' },
  passar_para_pessoa: { rotulo: 'Passar para uma pessoa', descricao: 'Quando o cliente pede para falar com alguém.', efeito: 'grava' },
  buscar_parceiros: { rotulo: 'Buscar clientes e fornecedores da empresa', descricao: 'Para nota e preço.', efeito: 'leitura' },
  buscar_produtos: { rotulo: 'Buscar produtos', descricao: 'Para nota e preço.', efeito: 'leitura' },
  resumir_pedido_nota: { rotulo: 'Mandar o resumo do pedido de nota', descricao: 'O cliente confere antes de passar ao Fiscal.', efeito: 'envia' },
  abrir_pedido_nota: { rotulo: 'Passar o pedido de nota ao Fiscal', descricao: 'Só depois de o cliente confirmar o resumo.', efeito: 'grava' },
  listar_documentos: { rotulo: 'Listar documentos da empresa', descricao: 'Os liberados para o contato.', efeito: 'leitura' },
  enviar_documento: { rotulo: 'Enviar documento ao cliente', descricao: 'Só documento liberado para a IA e para o contato.', efeito: 'envia' },
  consultar_cadastro: { rotulo: 'Ler dados cadastrais', descricao: 'CNPJ, razão social, endereço, regime.', efeito: 'leitura' },
  consultar_preco: { rotulo: 'Consultar preço da tabela', descricao: 'Preço vigente de um produto para uma rede.', efeito: 'leitura' },
  alterar_preco: { rotulo: 'Mudar preço', descricao: 'Só com o "sim" do cliente e a permissão dele.', efeito: 'grava' },
  cadastrar_produto: { rotulo: 'Cadastrar produto', descricao: 'Só com o "sim" do cliente e a permissão dele.', efeito: 'grava' },
  responder: { rotulo: 'Responder ao cliente', descricao: 'Manda a mensagem no WhatsApp.', efeito: 'envia' },
} as const satisfies Record<string, InfoFerramenta>;
export type NomeFerramentaCatalogo = keyof typeof CATALOGO_FERRAMENTAS;
export const FERRAMENTAS_ATENDIMENTO = Object.keys(CATALOGO_FERRAMENTAS) as NomeFerramentaCatalogo[];
/** Entram sozinhas quando o agente tem skill sob demanda ligada (D5). */
export const FERRAMENTAS_AUTOMATICAS: Record<'ler_skill' | 'ler_referencia', InfoFerramenta> = {
  ler_skill: { rotulo: 'Ler uma skill', descricao: 'Abre o texto de um procedimento, conhecimento ou exemplo.', efeito: 'leitura' },
  ler_referencia: { rotulo: 'Ler arquivo de apoio de uma skill', descricao: 'Abre um arquivo de referência da skill.', efeito: 'leitura' },
};
export const exigeAprovacao = (f: InfoFerramenta): boolean => f.efeito !== 'leitura';

export const LIMITES_SKILL = {
  skillMd: 25_000, corpo: 20_000, descricao: 1_024, titulo: 120, arquivo: 200_000, arquivos: 20, total: 1_000_000, sempre: 10_000,
} as const;
/** Teto de um envio de skill (pasta, .zip ou .md): o servidor recusa acima disso e a tela avisa antes de mandar. */
export const LIMITE_ENVIO_SKILL = 10 * 1024 * 1024;
/** A frase da recusa pela extensão (D7), ou null para .md, .txt e .csv. A tela usa a mesma frase ao tirar o arquivo antes de enviar. */
export function recusaPelaExtensao(caminho: string): string | null {
  if (/\.pdf$/i.test(caminho)) return 'PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho).';
  if (!/\.(md|txt|csv)$/i.test(caminho)) return `O arquivo "${caminho}" não é .md, .txt nem .csv.`;
  return null;
}
export type ArquivoSkill = { caminho: string; conteudo: string };
export type PacoteSkill = { nome: string; titulo: string; descricao: string; tipo: TipoSkill; corpo: string; skill_md: string; arquivos: ArquivoSkill[] };
export type SkillMdLida = { nome: string; descricao: string; tipo: TipoSkill | null; titulo: string; corpo: string };
export type ResultadoSkillMd = { ok: true; skill: SkillMdLida } | { ok: false; erro: string };
export type ResultadoPacote =
  | { ok: true; pacote: PacoteSkill }
  | { ok: false; erro: string }
  | { ok: false; precisaTipo: true; nome: string; titulo: string };

const NOME_SKILL = /^[a-z0-9][a-z0-9-]{0,63}$/;
const semAcento = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '');
const erro = (e: string) => ({ ok: false as const, erro: e });

const SINONIMOS: Record<string, TipoSkill> = {
  jeito: 'jeito', 'jeito-de-atuar': 'jeito', '1': 'jeito',
  limites: 'limites', limite: 'limites', 'o-que-nao-pode-fazer': 'limites', '2': 'limites',
  procedimento: 'procedimento', procedimentos: 'procedimento', '3': 'procedimento',
  conhecimento: 'conhecimento', conhecimentos: 'conhecimento', '4': 'conhecimento',
  exemplos: 'exemplos', exemplo: 'exemplos', '5': 'exemplos',
};
/** Tipo escrito no cabeçalho (D8): com ou sem acento, singular ou plural. */
export function tipoDoTexto(v: string): TipoSkill | null {
  return SINONIMOS[semAcento(v).toLowerCase().trim().replace(/[\s_]+/g, '-')] ?? null;
}

const tirarAspas = (v: string) => (/^(["']).*\1$/.test(v) ? v.slice(1, -1) : v);

/** Subconjunto do YAML das skills do Claude: "chave: valor", aspas opcionais, linhas recuadas continuam o valor, ">" e "|" aceitos. */
function lerCabecalho(bloco: string): Record<string, string> {
  const campos: Record<string, string> = {};
  let atual: string | null = null;
  for (const linha of bloco.split('\n')) {
    const c = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(linha);
    if (c) {
      atual = c[1]!.toLowerCase();
      const v = c[2]!.trim();
      campos[atual] = ['>', '|', '>-', '|-'].includes(v) ? '' : tirarAspas(v);
      continue;
    }
    if (atual && /^\s+\S/.test(linha)) campos[atual] = tirarAspas(`${campos[atual] ?? ''} ${linha.trim()}`.trim());
  }
  return campos;
}

/** SKILL.md no formato das skills do Claude (spec 7E.3): cabeçalho com name, description e tipo; o resto é o texto. */
export function lerSkillMd(texto: string): ResultadoSkillMd {
  const t = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(t);
  if (!m) return erro('O SKILL.md precisa começar com o cabeçalho entre linhas "---" (name, description e tipo).');
  const campos = lerCabecalho(m[1]!);
  const corpo = t.slice(m[0].length).trim();
  const nome = (campos.name ?? '').trim();
  if (!nome) return erro('Falta "name" no cabeçalho do SKILL.md.');
  if (!NOME_SKILL.test(nome)) return erro('O "name" usa só letras minúsculas, números e hífen (até 64), como nas skills do Claude.');
  const descricao = (campos.description ?? '').trim();
  if (!descricao) return erro('Falta "description" no cabeçalho do SKILL.md.');
  if (descricao.length > LIMITES_SKILL.descricao) return erro('A "description" tem mais de 1.024 caracteres.');
  if (!corpo) return erro('O SKILL.md não tem texto depois do cabeçalho.');
  if (corpo.length > LIMITES_SKILL.corpo) return erro('O texto do SKILL.md passa de 20.000 caracteres.');
  if (t.length > LIMITES_SKILL.skillMd) return erro('O SKILL.md passa de 25.000 caracteres.');
  let tipo: TipoSkill | null = null;
  if (campos.tipo?.trim()) {
    tipo = tipoDoTexto(campos.tipo);
    if (!tipo) return erro(`Tipo desconhecido no cabeçalho: "${campos.tipo.trim()}". Use jeito, limites, procedimento, conhecimento ou exemplos.`);
  }
  const titulo = (/^#\s+(.+)$/m.exec(corpo)?.[1] ?? nome).trim().slice(0, LIMITES_SKILL.titulo);
  return { ok: true, skill: { nome, descricao, tipo, titulo, corpo } };
}

/**
 * Arquivos subidos (pasta, .zip ou .md) → pacote que o banco grava (subir_skill). Tira a pasta de fora, o lixo do macOS e os
 * ocultos; um .md solto é o SKILL.md; referências só .md, .txt e .csv (D7). Tipo: o do cabeçalho; senão o escolhido; senão pergunta.
 */
export function montarPacoteSkill(arquivos: ArquivoSkill[], tipoEscolhido: TipoSkill | null): ResultadoPacote {
  const uteis = arquivos
    .map((a) => ({ ...a, caminho: a.caminho.replace(/\\/g, '/').replace(/^(\.\/)+/, '') }))
    .filter((a) => a.caminho && !a.caminho.endsWith('/') && !a.caminho.split('/').some((p) => p === '__MACOSX' || (p.startsWith('.') && p !== '.' && p !== '..')));
  if (!uteis.length) return erro('Nenhum arquivo para subir.');
  for (const a of uteis) {
    if (a.caminho.split('/').some((p) => p === '' || p === '.' || p === '..') || /^[A-Za-z]:/.test(a.caminho)) {
      return erro(`Nome de arquivo inválido: "${a.caminho}".`);
    }
  }
  const partes = uteis.map((a) => a.caminho.split('/'));
  const raiz = partes.every((p) => p.length > 1 && p[0] === partes[0]![0]) ? partes[0]![0]! : null;
  const sem = raiz ? uteis.map((a) => ({ ...a, caminho: a.caminho.slice(raiz.length + 1) })) : uteis;
  const vistos = new Set<string>();
  for (const a of sem) {
    const chave = a.caminho.toLowerCase();
    if (vistos.has(chave)) return erro(`Arquivo repetido no pacote: ${a.caminho}.`);
    vistos.add(chave);
  }
  let principal = sem.find((a) => a.caminho.toLowerCase() === 'skill.md');
  if (!principal && sem.length === 1 && /\.md$/i.test(sem[0]!.caminho)) principal = sem[0];
  if (!principal) return erro('Não achei o SKILL.md (na raiz da pasta ou do .zip).');
  const referencias = sem.filter((a) => a !== principal);
  for (const r of referencias) {
    const recusa = recusaPelaExtensao(r.caminho);
    if (recusa) return erro(recusa);
    // eslint-disable-next-line no-control-regex
    if (r.caminho.length > 200 || r.caminho.split('/').includes('..') || /[\u0000-\u001f\u007f]/.test(r.caminho)) {
      return erro(`Nome de arquivo inválido: "${r.caminho}".`);
    }
    if (r.conteudo.includes('\u0000')) return erro(`O arquivo "${r.caminho}" não é texto.`);
    if (r.conteudo.length > LIMITES_SKILL.arquivo) return erro(`O arquivo "${r.caminho}" passa de 200.000 caracteres.`);
  }
  if (referencias.length > LIMITES_SKILL.arquivos) return erro('No máximo 20 arquivos de referência por skill.');
  if (referencias.reduce((s, r) => s + r.conteudo.length, 0) > LIMITES_SKILL.total) {
    return erro('Os arquivos de referência passam de 1.000.000 de caracteres somados.');
  }
  const lida = lerSkillMd(principal.conteudo);
  if (!lida.ok) return lida;
  const tipo = lida.skill.tipo ?? tipoEscolhido;
  if (!tipo) return { ok: false, precisaTipo: true, nome: lida.skill.nome, titulo: lida.skill.titulo };
  return {
    ok: true,
    pacote: {
      nome: lida.skill.nome, titulo: lida.skill.titulo, descricao: lida.skill.descricao, tipo, corpo: lida.skill.corpo,
      skill_md: principal.conteudo.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'),
      arquivos: referencias.map((r) => ({ caminho: r.caminho, conteudo: r.conteudo })).sort((a, b) => a.caminho.localeCompare(b.caminho)),
    },
  };
}

export type LinhaDiferenca = { tipo: 'igual' | 'mais' | 'menos'; texto: string };
/** Diferença linha a linha entre duas versões (D9). Texto grande demais para comparar: tudo tirado e tudo posto. */
export function diferencaLinhas(antes: string, depois: string): LinhaDiferenca[] {
  const a = antes.replace(/\r\n?/g, '\n').split('\n');
  const b = depois.replace(/\r\n?/g, '\n').split('\n');
  const menos = (texto: string): LinhaDiferenca => ({ tipo: 'menos', texto });
  const mais = (texto: string): LinhaDiferenca => ({ tipo: 'mais', texto });
  if (a.length * b.length > 4_000_000) return [...a.map(menos), ...b.map(mais)];
  const t = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      t[i]![j] = a[i] === b[j] ? t[i + 1]![j + 1]! + 1 : Math.max(t[i + 1]![j]!, t[i]![j + 1]!);
    }
  }
  const r: LinhaDiferenca[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { r.push({ tipo: 'igual', texto: a[i]! }); i++; j++; }
    else if (t[i + 1]![j]! >= t[i]![j + 1]!) r.push(menos(a[i++]!));
    else r.push(mais(b[j++]!));
  }
  while (i < a.length) r.push(menos(a[i++]!));
  while (j < b.length) r.push(mais(b[j++]!));
  return r;
}

/** Endereço do agente a partir do nome (D25): sem acento, minúsculo, hífen, até 40, começando por letra. */
export function slugDoNome(nome: string): string {
  const s = semAcento(nome).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) return 'agente';
  return (/^[a-z]/.test(s) ? s : `agente-${s}`).slice(0, 40).replace(/-+$/, '');
}
