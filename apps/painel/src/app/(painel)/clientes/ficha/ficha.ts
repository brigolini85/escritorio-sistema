import { somenteDigitos, validarCnpj } from '@escritorio/core';
import { FUSO, formatarBRL, NBSP } from '@/lib/formatos';

/** Regras puras da ficha do cliente (spec 7D.1): opções, leitura do formulário, pendências do índice e textos. */

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

/** Data que existe no calendário (2030-13-45 e 2030-02-30 não), num intervalo que o Postgres guarda sem surpresa. */
export function dataReal(v: string): boolean {
  if (!DATA.test(v)) return false;
  const [a, m, d] = v.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(a, m - 1, d));
  return a >= 1900 && a <= 2199 && t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Tamanho máximo dos textos da ficha (a tela usa no maxLength; a ação confere de novo). */
export const LIMITES = {
  razao_social: 150, nome_fantasia: 150, inscricao_estadual: 30, inscricao_municipal: 30, inscricao_suframa: 30, cnae_principal: 300,
  regime: 60, logradouro: 150, numero: 20, complemento: 100, bairro: 100, cidade: 100, site: 200, email: 254, email_cobranca: 254,
} as const;
/** numeric(12,2) e numeric(14,2) em clientes: acima disso o banco recusaria com erro cru. */
export const MAXIMO_DINHEIRO = { honorario_mensal: 9_999_999_999.99, faturamento_ultimo_ano: 999_999_999_999.99 } as const;
const TAMANHO_INSCRICAO_ST = 30;

/** Valor do FormData como texto; arquivo enviado no lugar de texto vira vazio (nunca "[object File]"). */
const textoDe = (v: FormDataEntryValue | null | undefined): string => (typeof v === 'string' ? v : '');

export const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;
export const REGIMES = ['Simples Nacional', 'MEI', 'Lucro Presumido', 'Lucro Real', 'Imune/Isenta'] as const;
export const PORTES = [{ valor: 'mei', rotulo: 'MEI' }, { valor: 'me', rotulo: 'ME' }, { valor: 'epp', rotulo: 'EPP' }, { valor: 'demais', rotulo: 'Demais' }] as const;
export const SEGMENTOS = [
  { valor: 'comercio', rotulo: 'Comércio' }, { valor: 'ecommerce', rotulo: 'E-commerce' },
  { valor: 'industria', rotulo: 'Indústria' }, { valor: 'servicos', rotulo: 'Serviços' },
] as const;
export const TIPOS_CERTIFICADO = [
  { valor: 'e_cnpj_a1', rotulo: 'e-CNPJ A1' }, { valor: 'e_cnpj_a3', rotulo: 'e-CNPJ A3' }, { valor: 'e_cpf_a1', rotulo: 'e-CPF A1' },
  { valor: 'e_cpf_a3', rotulo: 'e-CPF A3' }, { valor: 'sem', rotulo: 'Sem certificado' },
] as const;
export const AVISAR_DIAS = [15, 30, 45, 60, 90] as const;
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const OPCOES_REAJUSTE = [
  { valor: 'sem', rotulo: 'Sem reajuste' },
  ...MESES.map((m, i) => ({ valor: `anual:${i + 1}`, rotulo: `Anual · ${m}` })),
  ...MESES.slice(0, 6).map((m, i) => ({ valor: `semestral:${i + 1}`, rotulo: `Semestral · ${m} e ${MESES[i + 6]}` })),
];

/** Regime da lista; o antigo escrito à mão continua como opção (D18). */
export function opcoesRegime(atual: string | null): { valor: string; rotulo: string }[] {
  const lista = REGIMES.map((r) => ({ valor: r, rotulo: r }));
  return atual && !(REGIMES as readonly string[]).includes(atual) ? [...lista, { valor: atual, rotulo: `${atual} (antigo)` }] : lista;
}

export function valorReajuste(reajuste: string | null, mes: number | null): string {
  if (!reajuste) return '';
  if (reajuste === 'sem') return 'sem';
  return mes ? `${reajuste}:${mes}` : '';
}

/** Os campos da ficha que a tela usa (a linha de clientes depois da migração 20261012000100). */
export type ClienteFicha = {
  id: string; razao_social: string; nome_fantasia: string | null; cnpj: string; ativo: boolean; agente_pausado: boolean; criado_em: string;
  inscricao_estadual: string | null; isento_ie: boolean; inscricao_municipal: string | null; cnae_principal: string | null;
  inscricao_suframa: string | null; regime: string | null; porte: string | null; faturamento_ultimo_ano: number | null;
  funcionarios: number | null; segmentos: string[]; cep: string | null; logradouro: string | null; numero: string | null;
  complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; telefone: string | null; celular: string | null;
  email: string | null; email_cobranca: string | null; site: string | null; contrato_inicio: string | null; contrato_fim: string | null;
  honorario_mensal: number | null; dia_vencimento: number | null; reajuste: string | null; reajuste_mes: number | null;
  decimo_terceiro: boolean | null; certificado_tipo: string | null; certificado_vencimento: string | null; certificado_avisar_dias: number;
};

export type ErrosFicha = { [campo: string]: string | undefined; geral?: string };
export type EstadoFicha = { ok: true; id: string } | { ok: false; erros: ErrosFicha };
export type DadosBanco = Record<string, unknown> & { cnpj: string };
export type LeituraFicha = { ok: true; dados: DadosBanco } | { ok: false; erros: ErrosFicha };

/** "R$ 1.250,00", "1250,5", "1250" → número; vazio → null; outro jeito → 'invalido'. */
export function lerDinheiro(texto: string): number | null | 'invalido' {
  const t = texto.replace(/R\$/g, '').replace(/[\s ]/g, '');
  if (!t) return null;
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(t)) return 'invalido';
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

export function dinheiroNoCampo(valor: number | null): string {
  return valor === null ? '' : formatarBRL(valor).replace(`R$${NBSP}`, '');
}

function inteiro(t: string, min: number, max: number): number | null | 'invalido' {
  if (!t) return null;
  if (!/^\d+$/.test(t)) return 'invalido';
  const n = Number(t);
  return n >= min && n <= max ? n : 'invalido';
}

function lerReajuste(v: string): { reajuste: string | null; reajuste_mes: number | null } | 'invalido' {
  if (!v) return { reajuste: null, reajuste_mes: null };
  if (v === 'sem') return { reajuste: 'sem', reajuste_mes: null };
  const m = /^(anual|semestral):(\d{1,2})$/.exec(v);
  if (!m) return 'invalido';
  const mes = Number(m[2]);
  return mes >= 1 && mes <= (m[1] === 'anual' ? 12 : 6) ? { reajuste: m[1]!, reajuste_mes: mes } : 'invalido';
}

/** Linhas de substituto tributário do formulário; a linha toda em branco (adicionada e não usada) é ignorada. */
function linhasSt(f: FormData): { uf: string; inscricao: string }[] {
  const ies = f.getAll('st_inscricao');
  return f.getAll('st_uf')
    .map((u, i) => ({ uf: textoDe(u).trim(), inscricao: textoDe(ies[i]).trim() }))
    .filter((l) => l.uf || l.inscricao);
}

/** O formulário da ficha → o p_dados de salvar_ficha_cliente. Só razão social e CNPJ travam (D9); o resto vazio vira nulo. */
export function lerFicha(f: FormData, opcoes: { admin: boolean }): LeituraFicha {
  const t = (k: string) => textoDe(f.get(k)).trim();
  const ou = (k: string) => t(k) || null;
  const erros: ErrosFicha = {};

  const razao = t('razao_social');
  if (razao.length < 2) erros.razao_social = 'Informe a razão social';
  for (const [k, max] of Object.entries(LIMITES)) if (t(k).length > max) erros[k] = `Até ${max} letras`;
  const cnpj = somenteDigitos(t('cnpj'));
  if (!validarCnpj(cnpj)) erros.cnpj = 'CNPJ inválido';
  const cep = somenteDigitos(t('cep'));
  if (cep && cep.length !== 8) erros.cep = 'O CEP tem 8 números';
  const fone = (k: string) => {
    const d = somenteDigitos(t(k));
    if (d && (d.length < 10 || d.length > 13)) erros[k] = 'Telefone com DDD';
    return d || null;
  };
  const telefone = fone('telefone');
  const celular = fone('celular');
  const email = (k: string) => {
    const v = t(k).toLowerCase();
    if (v && !EMAIL.test(v)) erros[k] = 'E-mail inválido';
    return v || null;
  };
  const emailEmpresa = email('email');
  const emailCobranca = email('email_cobranca');
  const dinheiro = (k: keyof typeof MAXIMO_DINHEIRO) => {
    const v = lerDinheiro(t(k));
    if (v === 'invalido') { erros[k] = 'Valor inválido (ex.: 1.250,00)'; return null; }
    if (v !== null && v > MAXIMO_DINHEIRO[k]) { erros[k] = 'Valor acima do limite'; return null; }
    return v;
  };
  const faturamento = dinheiro('faturamento_ultimo_ano');
  const honorario = dinheiro('honorario_mensal');
  const numero = (k: string, min: number, max: number, msg: string) => {
    const v = inteiro(t(k), min, max);
    if (v !== 'invalido') return v;
    erros[k] = msg;
    return null;
  };
  const funcionarios = numero('funcionarios', 0, 1_000_000, 'Número inválido');
  const dia = numero('dia_vencimento', 1, 31, 'Dia de 1 a 31');
  const avisar = numero('certificado_avisar_dias', 1, 180, 'Dias inválidos');
  const data = (k: string) => {
    const v = t(k);
    if (v && !dataReal(v)) { erros[k] = 'Data inválida'; return null; }
    return v || null;
  };
  const inicio = data('contrato_inicio');
  const fim = data('contrato_fim');
  const vencimento = data('certificado_vencimento');
  if (inicio && fim && fim < inicio) erros.contrato_fim = 'O fim vem depois do início';
  const uf = t('uf').toUpperCase();
  if (uf && !(UFS as readonly string[]).includes(uf)) erros.uf = 'UF inválida';
  const porte = t('porte');
  if (porte && !PORTES.some((p) => p.valor === porte)) erros.porte = 'Porte inválido';
  const tipoCert = t('certificado_tipo');
  if (tipoCert && !TIPOS_CERTIFICADO.some((c) => c.valor === tipoCert)) erros.certificado_tipo = 'Tipo inválido';
  const reajuste = lerReajuste(t('reajuste'));
  if (reajuste === 'invalido') erros.reajuste = 'Reajuste inválido';
  const decimo = t('decimo_terceiro');
  const segmentos = [...new Set(f.getAll('segmentos').map(textoDe))].filter((s) => SEGMENTOS.some((x) => x.valor === s));

  const inscricoes = linhasSt(f).map((l) => ({ uf: l.uf.toUpperCase(), inscricao: l.inscricao || null }));
  if (inscricoes.some((i) => !(UFS as readonly string[]).includes(i.uf))) erros.inscricoes_st = 'Escolha a UF de cada linha';
  else if (inscricoes.some((i) => (i.inscricao?.length ?? 0) > TAMANHO_INSCRICAO_ST)) {
    erros.inscricoes_st = `Inscrição com até ${TAMANHO_INSCRICAO_ST} letras`;
  } else {
    const repetida = inscricoes.find((x, i) => inscricoes.findIndex((y) => y.uf === x.uf) !== i);
    if (repetida) erros.inscricoes_st = `UF repetida: ${repetida.uf}`;
  }

  const servicos = f.getAll('servico').map(textoDe).filter((s) => UUID.test(s));
  const responsaveis: Record<string, string | null> = {};
  for (const [k, v] of f.entries()) {
    if (!k.startsWith('responsavel:')) continue;
    const setor = k.slice('responsavel:'.length);
    if (UUID.test(setor)) responsaveis[setor] = UUID.test(textoDe(v)) ? textoDe(v) : null;
  }
  const isento = f.get('isento_ie') === 'on';

  const campos = Object.keys(erros);
  if (campos.length) {
    const resto = campos.length > 1 ? ` Confira os ${campos.length} campos marcados.` : ' Confira o campo marcado.';
    return { ok: false, erros: { ...erros, geral: `Não foi possível salvar: ${erros[campos[0]!]}.${resto}` } };
  }
  return {
    ok: true,
    dados: {
      razao_social: razao, nome_fantasia: ou('nome_fantasia'), cnpj, tipo_pessoa: 'juridica', isento_ie: isento,
      inscricao_estadual: isento ? null : ou('inscricao_estadual'), inscricao_municipal: ou('inscricao_municipal'),
      cnae_principal: ou('cnae_principal'), inscricao_suframa: ou('inscricao_suframa'), regime: ou('regime'), porte: porte || null,
      faturamento_ultimo_ano: faturamento, funcionarios, segmentos, cep: cep || null, logradouro: ou('logradouro'), numero: ou('numero'),
      complemento: ou('complemento'), bairro: ou('bairro'), cidade: ou('cidade'), uf: uf || null, telefone, celular,
      email: emailEmpresa, email_cobranca: emailCobranca, site: ou('site'), contrato_inicio: inicio, contrato_fim: fim,
      honorario_mensal: honorario, dia_vencimento: dia,
      reajuste: reajuste === 'invalido' ? null : reajuste.reajuste, reajuste_mes: reajuste === 'invalido' ? null : reajuste.reajuste_mes,
      decimo_terceiro: decimo === 'sim' ? true : decimo === 'nao' ? false : null,
      certificado_tipo: tipoCert || null, certificado_vencimento: vencimento, certificado_avisar_dias: avisar ?? 30,
      servicos, responsaveis, inscricoes_st: inscricoes,
      ...(opcoes.admin ? { agente_pausado: f.get('agente_pausado') === 'on' } : {}),
    },
  };
}

// ---------- Índice (D28) ----------

export type Bloco = 'identificacao' | 'endereco' | 'contato' | 'fiscal' | 'contrato' | 'responsaveis' | 'certificado' | 'acessos';
export const BLOCOS: { id: Bloco; rotulo: string }[] = [
  { id: 'identificacao', rotulo: 'Identificação' }, { id: 'endereco', rotulo: 'Endereço' }, { id: 'contato', rotulo: 'Contato' },
  { id: 'fiscal', rotulo: 'Fiscal' }, { id: 'contrato', rotulo: 'Contrato e honorários' }, { id: 'responsaveis', rotulo: 'Responsáveis' },
  { id: 'certificado', rotulo: 'Certificado digital' }, { id: 'acessos', rotulo: 'Acessos de portais' },
];
export type EstadoBloco =
  | { tipo: 'completo' } | { tipo: 'pendente'; n: number } | { tipo: 'vence'; dias: number }
  | { tipo: 'vencido'; dias: number } | { tipo: 'neutro' } | { tipo: 'protegido' };
export type ValoresFicha = { campos: Record<string, string>; segmentos: number; st: { uf: string; inscricao: string }[]; responsaveis: number };

const OBRIGATORIOS = {
  identificacao: ['cnpj', 'razao_social', 'regime'],
  endereco: ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'],
  contrato: ['contrato_inicio', 'honorario_mensal'],
} as const;

/** O que está no formulário agora (a tela relê a cada digitação). */
export function valoresDe(f: FormData): ValoresFicha {
  const campos: Record<string, string> = {};
  for (const [k, v] of f.entries()) if (typeof v === 'string' && !(k in campos)) campos[k] = v.trim();
  return {
    campos,
    segmentos: f.getAll('segmentos').length,
    st: linhasSt(f),
    responsaveis: [...f.entries()].filter(([k, v]) => k.startsWith('responsavel:') && String(v)).length,
  };
}

/** O que está salvo (para quem só vê: os campos desligados não vão no FormData). */
export function valoresDoCliente(c: ClienteFicha | null, st: { uf: string; inscricao: string | null }[], nResponsaveis: number): ValoresFicha {
  const campos: Record<string, string> = {};
  if (c) {
    for (const [k, v] of Object.entries(c)) if (v !== null && typeof v !== 'object' && typeof v !== 'boolean') campos[k] = String(v);
  }
  return { campos, segmentos: c?.segmentos.length ?? 0, st: st.map((s) => ({ uf: s.uf, inscricao: s.inscricao ?? '' })), responsaveis: nResponsaveis };
}

export function hojeSP(agora: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(agora);
}

/** Dias corridos de hoje (em São Paulo) até a data (AAAA-MM-DD); negativo = já passou; data que não existe = NaN. */
export function diasAte(data: string, agora: Date): number {
  if (!dataReal(data)) return Number.NaN;
  const [a, m, d] = data.split('-').map(Number) as [number, number, number];
  const [x, y, z] = hojeSP(agora).split('-').map(Number) as [number, number, number];
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(x, y - 1, z)) / 86_400_000);
}

export function estadoCertificado(tipo: string | undefined, vencimento: string | undefined, avisar: number, agora: Date): EstadoBloco {
  if (tipo === 'sem') return { tipo: 'completo' };
  if (!vencimento) return { tipo: 'pendente', n: 1 };
  const dias = diasAte(vencimento, agora);
  // Data que não existe não pode passar por "completo" (NaN falha todas as comparações abaixo).
  if (!Number.isFinite(dias)) return { tipo: 'pendente', n: 1 };
  if (dias < 0) return { tipo: 'vencido', dias: -dias };
  if (dias <= avisar) return { tipo: 'vence', dias };
  return { tipo: 'completo' };
}

export function estadoDosBlocos(v: ValoresFicha, agora: Date): Record<Bloco, EstadoBloco> {
  const faltam = (ks: readonly string[]) => ks.filter((k) => !v.campos[k]).length;
  const pend = (n: number): EstadoBloco => (n ? { tipo: 'pendente', n } : { tipo: 'completo' });
  const algum = ['telefone', 'celular', 'email', 'email_cobranca', 'site'].some((k) => v.campos[k]);
  return {
    identificacao: pend(faltam(OBRIGATORIOS.identificacao) + (v.segmentos ? 0 : 1)),
    endereco: pend(faltam(OBRIGATORIOS.endereco)),
    contato: algum ? { tipo: 'completo' } : { tipo: 'neutro' },
    fiscal: v.st.length === 0 ? { tipo: 'neutro' } : pend(v.st.filter((s) => !s.inscricao).length),
    contrato: pend(faltam(OBRIGATORIOS.contrato)),
    responsaveis: v.responsaveis ? { tipo: 'completo' } : { tipo: 'neutro' },
    certificado: estadoCertificado(v.campos.certificado_tipo, v.campos.certificado_vencimento, Number(v.campos.certificado_avisar_dias) || 30, agora),
    acessos: { tipo: 'protegido' },
  };
}

export function textoEstado(e: EstadoBloco): string {
  switch (e.tipo) {
    case 'completo': return 'completo';
    case 'pendente': return e.n === 1 ? '1 pendente' : `${e.n} pendentes`;
    case 'vence': return 'vence';
    case 'vencido': return 'vencido';
    case 'protegido': return 'protegido';
    default: return '';
  }
}

// ---------- Cabeçalho e rodapé ----------

export type Etiqueta = { texto: string; variante: 'success' | 'neutral' | 'warning' | 'danger' | 'agent-paused'; icone?: 'ponto' | 'certificado' };

export function etiquetasDoTopo(c: {
  ativo: boolean; agente_pausado: boolean; regime: string | null; certificado_tipo?: string | null;
  certificado_vencimento?: string | null; certificado_avisar_dias?: number | null;
}, agora: Date): Etiqueta[] {
  const e: Etiqueta[] = [c.ativo ? { texto: 'Ativo', variante: 'success', icone: 'ponto' } : { texto: 'Arquivado', variante: 'neutral' }];
  if (c.agente_pausado) e.push({ texto: 'Agente pausado para esta empresa', variante: 'agent-paused' });
  if (c.certificado_vencimento && c.certificado_tipo !== 'sem') {
    const dias = diasAte(c.certificado_vencimento, agora);
    const plural = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`;
    if (dias < 0) e.push({ texto: `Certificado vencido há ${plural(-dias)}`, variante: 'danger', icone: 'certificado' });
    else if (dias === 0) e.push({ texto: 'Certificado vence hoje', variante: 'warning', icone: 'certificado' });
    else if (dias <= (c.certificado_avisar_dias ?? 30)) e.push({ texto: `Certificado vence em ${plural(dias)}`, variante: 'warning', icone: 'certificado' });
  }
  if (c.regime) e.push({ texto: c.regime, variante: 'neutral' });
  return e;
}

/** "03/2022": início do contrato ou, sem ele, o cadastro. */
export function clienteDesde(contratoInicio: string | null, criadoEm: string): string {
  if (contratoInicio) return `${contratoInicio.slice(5, 7)}/${contratoInicio.slice(0, 4)}`;
  const [a, m] = hojeSP(new Date(criadoEm)).split('-');
  return `${m}/${a}`;
}

/** "Ana, 28/09 16:20" (D24). */
export function textoUltimaAlteracao(u: { pessoa: string; quando: string } | null): string | null {
  if (!u) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(u.quando)).map((x) => [x.type, x.value]));
  return `${u.pessoa}, ${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

// ---------- Busca e responsáveis ----------

export function mensagemBusca(tipo: 'cnpj' | 'cep', motivo: 'nao_encontrado' | 'indisponivel' | 'invalido' | 'sem_permissao'): string {
  if (motivo === 'indisponivel') return 'Não consegui buscar agora. Preencha à mão.';
  if (motivo === 'sem_permissao') return 'Só quem pode editar clientes usa a busca.';
  if (motivo === 'invalido') return tipo === 'cnpj' ? 'Confira os 14 números do CNPJ.' : 'O CEP tem 8 números.';
  return tipo === 'cnpj' ? 'Não achei este CNPJ na busca pública. Preencha à mão.' : 'Não achei este CEP. Preencha à mão.';
}

const GRUPOS_BUSCA: [string, string[]][] = [
  ['razão social', ['razao_social']], ['nome fantasia', ['nome_fantasia']], ['CNAE', ['cnae_principal']],
  ['endereço', ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']],
];
export function textoPreenchido(campos: string[]): string {
  const grupos = GRUPOS_BUSCA.filter(([, ks]) => ks.some((k) => campos.includes(k))).map(([g]) => g);
  if (!grupos.length) return 'A busca não trouxe nada novo: os campos já estavam preenchidos.';
  const lista = grupos.length === 1 ? grupos[0] : `${grupos.slice(0, -1).join(', ')} e ${grupos.at(-1)}`;
  return `Preenchido pela busca: ${lista}.`;
}

/** D16: setores dos serviços marcados e os que já têm responsável primeiro; os outros em "Outros setores". */
export function separarSetores<S extends { id: string }>(setores: S[], servicos: { id: string; setor_id: string | null }[],
  contratados: string[], responsaveis: Record<string, string>): { principais: S[]; outros: S[] } {
  const ligados = new Set(servicos.filter((s) => contratados.includes(s.id) && s.setor_id).map((s) => s.setor_id!));
  for (const setor of Object.keys(responsaveis)) ligados.add(setor);
  if (!ligados.size) return { principais: setores, outros: [] };
  return { principais: setores.filter((s) => ligados.has(s.id)), outros: setores.filter((s) => !ligados.has(s.id)) };
}
