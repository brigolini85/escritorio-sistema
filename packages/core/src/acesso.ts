/**
 * Acesso por contato e por empresa (spec 7D.2, Parte H2). O perfil é atalho; o que vale são as marcações (D3).
 * O painel monta o bloco de acesso com isto; o trabalhador lê o acesso pronto (AcessoContato) do banco.
 */
export const PERFIS = ['socio', 'administrativo', 'financeiro', 'rh_dp', 'compras_vendas', 'funcionario', 'basico', 'personalizado'] as const;
export type Perfil = (typeof PERFIS)[number];
export type PerfilPronto = Exclude<Perfil, 'personalizado'>;

export const ROTULO_PERFIL: Record<Perfil, string> = {
  socio: 'Sócio', administrativo: 'Administrativo', financeiro: 'Financeiro', rh_dp: 'RH/DP', compras_vendas: 'Compras/Vendas',
  funcionario: 'Funcionário', basico: 'Básico', personalizado: 'Personalizado',
};

export const CANAIS_AVISO = ['whatsapp', 'email'] as const;
export type CanalAviso = (typeof CANAIS_AVISO)[number];

/** O que a pessoa marca no bloco de acesso de uma empresa. */
export type MarcasAcesso = {
  setores: { setorId: string; podeSerProcurado: boolean }[];
  podePedirNota: boolean;
  podeAtualizarPreco: boolean;
  verValores: boolean;
  receberDocumentos: boolean;
  avisarDocumentoNovo: CanalAviso[];
  recebeAlertasAcesso: boolean;
};

/** O acesso que as ferramentas do agente leem (acesso_do_contato). */
export type AcessoContato = Omit<MarcasAcesso, 'setores'> & {
  perfil: Perfil;
  setores: { id: string; nome: string; podeSerProcurado: boolean }[];
};

export type SetorDisponivel = { id: string; nome: string; contratado: boolean; dica: string };

type Preset = {
  setores: 'todos' | readonly string[]; procurado: boolean; nota: boolean; preco: boolean; valores: boolean; documentos: boolean;
  avisar: readonly CanalAviso[]; alertas: boolean;
};

// D4: o que cada perfil marca. Mudar aqui muda o atalho; o que já foi salvo continua como está.
const PRESETS: Record<PerfilPronto, Preset> = {
  socio: { setores: 'todos', procurado: true, nota: true, preco: true, valores: true, documentos: true, avisar: ['whatsapp'], alertas: true },
  administrativo: { setores: ['Fiscal', 'Contábil', 'Financeiro', 'Legalização'], procurado: true, nota: true, preco: false, valores: true, documentos: true, avisar: ['whatsapp'], alertas: false },
  financeiro: { setores: ['Financeiro', 'Contábil'], procurado: true, nota: false, preco: false, valores: true, documentos: true, avisar: ['whatsapp'], alertas: false },
  rh_dp: { setores: ['Pessoal'], procurado: true, nota: false, preco: false, valores: true, documentos: true, avisar: ['whatsapp'], alertas: false },
  compras_vendas: { setores: ['Fiscal'], procurado: true, nota: true, preco: true, valores: false, documentos: true, avisar: ['whatsapp'], alertas: false },
  funcionario: { setores: ['Fiscal'], procurado: false, nota: true, preco: false, valores: false, documentos: false, avisar: [], alertas: false },
  basico: { setores: [], procurado: false, nota: false, preco: false, valores: false, documentos: false, avisar: [], alertas: false },
};

/** A ordem da imagem; os outros setores vêm depois, pelo nome. */
export const ORDEM_SETORES = ['Fiscal', 'Pessoal', 'Contábil', 'Financeiro', 'Legalização'] as const;
/** Assunto sensível vai para a Direção (regra 11 do agente): ela nunca é um setor "que a pessoa trata" (D5). */
const SETOR_FORA_DA_LISTA = 'Direção';
/** Financeiro (honorários e boletos do escritório) vale para todo cliente, mesmo sem serviço ligado a ele (D5). */
const SETOR_SEMPRE = 'Financeiro';
const DICAS: Record<string, string> = {
  Fiscal: 'notas, impostos', Pessoal: 'folha, férias, admissão', Contábil: 'balanço, balancete', Financeiro: 'honorários, boletos', Legalização: 'contrato, alvarás',
};
const FEMININOS = new Set(['Legalização', 'Direção']);

export function dicaDoSetor(nome: string, descricao: string): string {
  return DICAS[nome] ?? descricao.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean).slice(0, 3).join(', ');
}

/** "do Fiscal", "da Legalização". */
export function setorComArtigo(nome: string): string {
  return `${FEMININOS.has(nome) ? 'da' : 'do'} ${nome}`;
}

function juntar(itens: readonly string[], conjuncao: 'e' | 'ou'): string {
  return itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} ${conjuncao} ${itens.at(-1)}`;
}

/** Setores que aparecem no bloco de uma empresa (D5). `contratados` e `marcados` são ids. */
export function setoresDisponiveis(
  todos: readonly { id: string; nome: string; descricao_assuntos: string }[], contratados: readonly string[], marcados: readonly string[],
): { setores: SetorDisponivel[]; semServicoComSetor: boolean } {
  const validos = todos.filter((s) => s.nome !== SETOR_FORA_DA_LISTA);
  const semServicoComSetor = !validos.some((s) => contratados.includes(s.id));
  const contratado = (s: { id: string; nome: string }) => semServicoComSetor || contratados.includes(s.id) || s.nome === SETOR_SEMPRE;
  const pos = (nome: string) => { const i = (ORDEM_SETORES as readonly string[]).indexOf(nome); return i === -1 ? ORDEM_SETORES.length : i; };
  const setores = validos
    .filter((s) => contratado(s) || marcados.includes(s.id))
    .map((s) => ({ id: s.id, nome: s.nome, contratado: contratado(s), dica: dicaDoSetor(s.nome, s.descricao_assuntos) }))
    .sort((a, b) => pos(a.nome) - pos(b.nome) || a.nome.localeCompare(b.nome, 'pt-BR'));
  return { setores, semServicoComSetor };
}

export function marcasBasicas(): MarcasAcesso {
  return { setores: [], podePedirNota: false, podeAtualizarPreco: false, verValores: false, receberDocumentos: false, avisarDocumentoNovo: [], recebeAlertasAcesso: false };
}

/** Escolher um perfil marca as opções dele, só entre os setores contratados da empresa. */
export function marcasDoPerfil(perfil: PerfilPronto, disponiveis: readonly SetorDisponivel[]): MarcasAcesso {
  const p = PRESETS[perfil];
  const base = disponiveis.filter((s) => s.contratado);
  const escolhidos = p.setores === 'todos' ? base : base.filter((s) => (p.setores as readonly string[]).includes(s.nome));
  return {
    setores: escolhidos.map((s) => ({ setorId: s.id, podeSerProcurado: p.procurado })),
    podePedirNota: p.nota, podeAtualizarPreco: p.preco, verValores: p.valores, receberDocumentos: p.documentos,
    avisarDocumentoNovo: [...p.avisar], recebeAlertasAcesso: p.alertas,
  };
}

/** Básico = nenhum setor, sem valores e sem documentos; nota e preço não contam (D3). */
function semAcesso(m: MarcasAcesso): boolean {
  return m.setores.length === 0 && !m.verValores && !m.receberDocumentos;
}

// Avisos ficam de fora da comparação: são preferência (D3).
function mesmasMarcas(a: MarcasAcesso, b: MarcasAcesso): boolean {
  const chave = (m: MarcasAcesso) => m.setores.map((s) => `${s.setorId}:${s.podeSerProcurado}`).sort().join('|');
  return chave(a) === chave(b) && a.podePedirNota === b.podePedirNota && a.podeAtualizarPreco === b.podeAtualizarPreco
    && a.verValores === b.verValores && a.receberDocumentos === b.receberDocumentos;
}

/** O perfil que as marcações mostram: um perfil pronto se batem com ele, senão Personalizado. */
export function perfilDasMarcas(m: MarcasAcesso, disponiveis: readonly SetorDisponivel[]): Perfil {
  if (semAcesso(m)) return 'basico';
  for (const p of PERFIS) {
    if (p === 'personalizado' || p === 'basico') continue;
    if (mesmasMarcas(m, marcasDoPerfil(p, disponiveis))) return p;
  }
  return 'personalizado';
}

export type Etiqueta = { tipo: 'basico' | 'todos' | 'setor' | 'extra'; texto: string };

/** Coluna "Pode tratar" (D27). */
export function etiquetasPodeTratar(perfil: Perfil, m: MarcasAcesso, disponiveis: readonly SetorDisponivel[]): Etiqueta[] {
  const extras: Etiqueta[] = [
    ...(m.podePedirNota ? [{ tipo: 'extra' as const, texto: 'pede nota' }] : []),
    ...(m.podeAtualizarPreco ? [{ tipo: 'extra' as const, texto: 'muda preço' }] : []),
    ...(m.verValores ? [{ tipo: 'extra' as const, texto: 'vê valores' }] : []),
  ];
  if (perfil === 'basico' || semAcesso(m)) return [{ tipo: 'basico', texto: 'Só conversa e abre demanda' }, ...extras];
  const marcados = new Set(m.setores.map((s) => s.setorId));
  const contratados = disponiveis.filter((s) => s.contratado);
  if (contratados.length > 0 && contratados.every((s) => marcados.has(s.id))) {
    const todos: Etiqueta = { tipo: 'todos', texto: 'Todos os setores contratados' };
    return perfil === 'socio' ? [todos] : [todos, ...extras];
  }
  return [...disponiveis.filter((s) => marcados.has(s.id)).map((s) => ({ tipo: 'setor' as const, texto: s.nome })), ...extras];
}

export type Previa = { pode: string; recusa: string | null; procurado: string | null };

/** "O que o agente vai fazer com <nome>" (D26): a mesma regra das ferramentas do agente, em palavras. */
export function previaDoAgente(p: { marcas: MarcasAcesso; disponiveis: readonly SetorDisponivel[]; socios: readonly string[] }): Previa {
  const m = p.marcas;
  if (semAcesso(m)) {
    return {
      pode: `Conversa e abre demandas para a equipe${m.podePedirNota ? ', pede nota' : ''}.`,
      recusa: 'Não consulta demandas, dados nem documentos: até alguém liberar o acesso, tudo vira demanda para a equipe conferir.',
      procurado: null,
    };
  }
  const marcados = new Set(m.setores.map((s) => s.setorId));
  const nomes = p.disponiveis.filter((s) => marcados.has(s.id)).map((s) => s.nome);
  const contratados = p.disponiveis.filter((s) => s.contratado);
  const todos = contratados.length > 0 && contratados.every((s) => marcados.has(s.id));
  const deSetores = todos ? 'de todos os setores contratados' : juntar(nomes.map(setorComArtigo), 'e');
  const partes = [nomes.length ? `Abre e consulta demandas ${deSetores}` : 'Conversa e abre demandas para a equipe'];
  if (m.podePedirNota) partes.push('pede nota');
  if (m.podeAtualizarPreco) partes.push('ajusta preços e produtos');
  if (m.receberDocumentos) partes.push(nomes.length ? `envia documentos ${deSetores}` : 'envia os documentos da empresa');
  if (m.verValores) partes.push('vê valores');

  const fora = contratados.filter((s) => !marcados.has(s.id)).map((s) => s.nome);
  const motivos = [...(fora.length ? [`pedir algo de ${juntar(fora, 'ou')}`] : []), ...(m.verValores ? [] : ['perguntar valores'])];
  const aviso = p.socios.length
    ? ` e avisa ${p.socios.length > 1 ? 'os sócios' : 'o sócio'} (${juntar(p.socios, 'e')})`
    : ' (a empresa não tem ninguém marcado para receber alertas de acesso)';
  const procurados = p.disponiveis.filter((s) => m.setores.some((x) => x.setorId === s.id && x.podeSerProcurado)).map((s) => setorComArtigo(s.nome));
  return {
    pode: `${partes.join(', ')}.`,
    recusa: motivos.length
      ? `Se ${motivos.join(', ou ')}: responde que vai tratar com o responsável da empresa, não revela nada, deixa uma nota para o setor${aviso}.`
      : null,
    procurado: procurados.length ? `Pode receber lembretes e cobranças ${juntar(procurados, 'e')}.` : null,
  };
}
