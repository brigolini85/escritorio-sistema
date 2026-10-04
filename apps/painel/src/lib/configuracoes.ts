// Configurações (spec 7C.4): seções em grupos, o resumo de cada uma no menu, o exemplo de vencimento e o texto da janela de
// impacto de Prazos. Tudo puro; a página e os componentes só desenham.
import { ROTULO_PRIORIDADE, type Prioridade } from './demandas';
import { FUSO } from './formatos';

export type IdSecao = 'expediente' | 'prazos' | 'feriados' | 'mensagens' | 'respostas' | 'espera' | 'ia' | 'setores' | 'servicos' | 'cargos' | 'integracoes';
export type GrupoSecao = 'Escritório' | 'Agente e atendimento' | 'Cadastros' | 'Sistema';
export type SecaoConfig = { id: IdSecao; rotulo: string; grupo: GrupoSecao; soAdmin: boolean };

export const GRUPOS_CONFIG: GrupoSecao[] = ['Escritório', 'Agente e atendimento', 'Cadastros', 'Sistema'];

// D8: o que é só do administrador fica em seção própria (teto, modelos e cotação; integrações).
export const SECOES_CONFIG: SecaoConfig[] = [
  { id: 'expediente', rotulo: 'Expediente', grupo: 'Escritório', soAdmin: false },
  { id: 'prazos', rotulo: 'Prazos', grupo: 'Escritório', soAdmin: false },
  { id: 'feriados', rotulo: 'Feriados', grupo: 'Escritório', soAdmin: false },
  { id: 'mensagens', rotulo: 'Mensagens', grupo: 'Agente e atendimento', soAdmin: false },
  { id: 'respostas', rotulo: 'Respostas prontas', grupo: 'Agente e atendimento', soAdmin: false },
  { id: 'espera', rotulo: 'Limites de espera', grupo: 'Agente e atendimento', soAdmin: false },
  { id: 'ia', rotulo: 'Teto e modelos de IA', grupo: 'Agente e atendimento', soAdmin: true },
  { id: 'setores', rotulo: 'Setores', grupo: 'Cadastros', soAdmin: false },
  { id: 'servicos', rotulo: 'Serviços', grupo: 'Cadastros', soAdmin: false },
  { id: 'cargos', rotulo: 'Cargos', grupo: 'Cadastros', soAdmin: false },
  { id: 'integracoes', rotulo: 'Integrações', grupo: 'Sistema', soAdmin: true },
];

/** Âncoras da página longa de antes (#teto-ia, #atendimento…) → seção de hoje. */
const ANCORAS_ANTIGAS: Record<string, IdSecao> = { 'teto-ia': 'ia', atendimento: 'espera', 'aviso-login': 'mensagens' };
const idCerto = (v: string): string => ANCORAS_ANTIGAS[v] ?? v;

export const secoesDe = (admin: boolean): SecaoConfig[] => SECOES_CONFIG.filter((s) => admin || !s.soAdmin);

/** ?secao= da URL: vazia, desconhecida ou só do administrador para quem não é → Expediente (D12). */
export function secaoDaUrl(valor: string | string[] | undefined, admin: boolean): SecaoConfig {
  const v = Array.isArray(valor) ? valor[0] : valor;
  const id = v ? idCerto(v) : undefined;
  return secoesDe(admin).find((s) => s.id === id) ?? SECOES_CONFIG[0]!;
}

/** "#teto-ia" (link antigo) → "ia"; null quando não é seção (ou o hash está malformado). */
export function secaoDoHash(hash: string): IdSecao | null {
  let v: string;
  // Link colado pela metade ("#%E0%A4%A") faz decodeURIComponent lançar: não é seção.
  try { v = decodeURIComponent(hash.replace(/^#/, '')); } catch { return null; }
  if (!v) return null;
  const id = idCerto(v);
  return SECOES_CONFIG.some((s) => s.id === id) ? (id as IdSecao) : null;
}

export const rotuloDaSecao = (v: string): string | null => SECOES_CONFIG.find((s) => s.id === idCerto(v))?.rotulo ?? null;
export const hrefSecao = (id: IdSecao): string => `/configuracoes?secao=${id}`;

/** Resposta das ações de Configurações: o cartão avisa sem recarregar a página (D21). */
export type Resultado = { ok: true; mensagem: string } | { ok: false; erro: string };

// ---------- Textos ----------

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const pl = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** [1,2,3,4,5] → "seg–sex"; [1,3,5] → "seg, qua, sex". Três dias seguidos ou mais viram faixa. */
export function textoDiasUteis(dias: number[]): string {
  const d = [...new Set(dias)].filter((n) => n >= 0 && n <= 6).sort((a, b) => a - b);
  if (d.length === 0) return 'nenhum dia';
  const partes: string[] = [];
  for (let i = 0; i < d.length;) {
    let j = i;
    while (j + 1 < d.length && d[j + 1] === d[j]! + 1) j++;
    partes.push(j - i >= 2 ? `${DIAS_CURTOS[d[i]!]}–${DIAS_CURTOS[d[j]!]}` : d.slice(i, j + 1).map((n) => DIAS_CURTOS[n]).join(', '));
    i = j + 1;
  }
  return partes.join(', ');
}

/** "08:00" ou "08:00:00" → "08"; "18:30" → "18:30". */
export function horaResumo(h: string): string {
  const [hh = '00', mm = '00'] = h.split(':');
  return mm === '00' ? hh : `${hh}:${mm}`;
}

/** 0 → "mesmo dia (fim do expediente)"; 1 → "1 dia útil"; n → "n dias úteis". */
export const textoDias = (n: number): string => (n === 0 ? 'mesmo dia (fim do expediente)' : pl(n, 'dia útil', 'dias úteis'));

const DIA_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const SEMANA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short' });
const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const DIA_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const semana = (d: Date) => SEMANA.format(d).replace('.', '');

/** "ter 06/10" (Brasília). */
export const diaCurto = (iso: string): string => { const d = new Date(iso); return `${semana(d)} ${DIA_MES.format(d)}`; };
/** "sex 02/10 às 18:00" (Brasília). */
export const vencimentoCurto = (iso: string): string => { const d = new Date(iso); return `${diaCurto(iso)} às ${HORA.format(d)}`; };
/** Hoje em Brasília, AAAA-MM-DD. */
export const hojeSP = (agora: Date): string => DIA_ISO.format(agora);
/** O exemplo da imagem: "aberta hoje às 10:00" de Brasília, mesmo no fim de semana (D17). */
export const inicioExemplo = (agora: Date): string => new Date(`${hojeSP(agora)}T10:00:00-03:00`).toISOString();

/** "claude-haiku-4-5" → "Claude Haiku 4.5" (só para mostrar; o valor gravado é o id). */
export function nomeModelo(id: string): string {
  if (!id.startsWith('claude-')) return id;
  return id.replace(/-(\d+)-(\d+)$/, ' $1.$2').split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
}

// ---------- Resumos do menu ----------

export type DadosResumo = {
  cfg: {
    horario_inicio: string; horario_fim: string; dias_uteis: number[];
    prazo_urgente_dias: number; prazo_alta_dias: number; prazo_normal_dias: number; prazo_baixa_dias: number;
    espera_verde_min: number; espera_ambar_min: number; aviso_login: string; teto_ia_usd: number; cargos: string[];
  };
  feriados: { data: string }[];
  respostas: { ativo: boolean }[];
  setores: { ativo: boolean }[];
  servicos: { setor_id: string | null }[];
  /** Gasto do mês ÷ teto; null para quem não é administrador. */
  fracaoTeto: number | null;
  /** Sinal de vida do WhatsApp e da fila; null para quem não é administrador. */
  integracoesOk: boolean | null;
  /** AAAA-MM-DD de Brasília. */
  hoje: string;
};
export type ResumoSecao = { contagem?: number; resumo: string; atencao?: boolean };

const curto = (n: number) => (n === 0 ? 'mesmo dia' : String(n));
const usd = (v: number) => `US$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(v)}`;

export function resumosDasSecoes(d: DadosResumo): Record<IdSecao, ResumoSecao> {
  const c = d.cfg;
  const proximo = d.feriados.map((f) => f.data).filter((x) => x >= d.hoje).sort()[0];
  const ativos = d.setores.filter((s) => s.ativo).length;
  const inativos = d.setores.length - ativos;
  const semSetor = d.servicos.filter((s) => !s.setor_id).length;
  const teto = `teto ${usd(Number(c.teto_ia_usd))}`;
  return {
    expediente: { resumo: `${textoDiasUteis(c.dias_uteis)} ${horaResumo(c.horario_inicio)}–${horaResumo(c.horario_fim)}` },
    prazos: { resumo: `urgente ${curto(c.prazo_urgente_dias)} · alta ${curto(c.prazo_alta_dias)} · normal ${curto(c.prazo_normal_dias)} · baixa ${curto(c.prazo_baixa_dias)}` },
    feriados: { contagem: d.feriados.length, resumo: proximo ? `próximo: ${proximo.slice(8, 10)}/${proximo.slice(5, 7)}` : 'nenhum à frente' },
    mensagens: { contagem: 4, resumo: c.aviso_login.trim() ? 'aviso do login ligado' : 'aviso do login desligado' },
    respostas: { contagem: d.respostas.length, resumo: pl(d.respostas.filter((r) => r.ativo).length, 'ativa', 'ativas') },
    espera: { resumo: `verde até ${c.espera_verde_min} · âmbar até ${c.espera_ambar_min} min` },
    ia: { resumo: d.fracaoTeto === null ? teto : `${teto} · ${Math.round(d.fracaoTeto * 100)}%`, atencao: (d.fracaoTeto ?? 0) >= 0.8 },
    setores: { contagem: ativos, resumo: inativos ? `${pl(ativos, 'ativo', 'ativos')} · ${pl(inativos, 'inativo', 'inativos')}` : pl(ativos, 'ativo', 'ativos') },
    servicos: semSetor
      ? { contagem: d.servicos.length, resumo: `${semSetor} sem setor`, atencao: true }
      : { contagem: d.servicos.length, resumo: 'todos com setor' },
    cargos: { contagem: c.cargos.length, resumo: c.cargos.join(', ') || 'nenhum' },
    integracoes: { resumo: d.integracoesOk === null ? '' : d.integracoesOk ? 'ok' : 'sem sinal', atencao: d.integracoesOk === false },
  };
}

// ---------- Prazos ----------

export const PRIORIDADES: Prioridade[] = ['urgente', 'alta', 'normal', 'baixa'];
export const COLUNA_PRAZO = {
  urgente: 'prazo_urgente_dias', alta: 'prazo_alta_dias', normal: 'prazo_normal_dias', baixa: 'prazo_baixa_dias',
} as const satisfies Record<Prioridade, string>;
export type ColunaPrazo = (typeof COLUNA_PRAZO)[Prioridade];

/** O que simular_mudanca_prazo devolve (Task 1). */
export type ImpactoPrazo = {
  prioridade: Prioridade; dias_atuais: number; dias_novos: number; abertas: number; pela_regra: number; a_mao: number;
  sem_prazo: number; ganham: number; perdem: number; pausadas: number; passam_a_vencidas: number; ja_vencidas: number;
};
/** O que prazos_resumo devolve (Task 1); exemplos[n] = vencimento com n dias úteis (null sem dia útil configurado). */
export type ResumoPrazos = { abertas: Record<Prioridade, number>; exemplos: (string | null)[] };

const PLURAL_PRIORIDADE: Record<Prioridade, string> = { urgente: 'Urgentes', alta: 'Altas', normal: 'Normais', baixa: 'Baixas' };
const verbo = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Texto de uma prioridade na janela de impacto (spec 7C.4: "14 demandas Normais abertas; 9 ganham prazo; nenhuma fica vencida"). */
export function textoImpacto(i: ImpactoPrazo): { titulo: string; linhas: string[]; alerta: string | null; recalcula: number } {
  const nome = ROTULO_PRIORIDADE[i.prioridade];
  const dif = Math.abs(i.dias_novos - i.dias_atuais);
  const dias = pl(dif, 'dia útil', 'dias úteis');
  const linhas = [i.abertas === 1 ? `1 demanda ${nome} aberta` : `${i.abertas} demandas ${PLURAL_PRIORIDADE[i.prioridade]} abertas`];
  if (i.ganham) linhas.push(`${verbo(i.ganham, 'ganha', 'ganham')} ${dias}`);
  if (i.perdem) linhas.push(`${verbo(i.perdem, 'perde', 'perdem')} ${dias}`);
  if (i.a_mao) linhas.push(`${i.a_mao} com prazo escolhido à mão ${i.a_mao === 1 ? 'fica como está' : 'ficam como estão'}`);
  if (i.sem_prazo) linhas.push(`${i.sem_prazo} sem prazo ${i.sem_prazo === 1 ? 'continua' : 'continuam'} sem prazo`);
  if (i.pausadas) linhas.push(`${i.pausadas} com o cliente ${i.pausadas === 1 ? 'continua pausada' : 'continuam pausadas'}`);
  const alerta = i.dias_novos < i.dias_atuais && i.passam_a_vencidas > 0
    ? `${i.passam_a_vencidas} ${i.passam_a_vencidas === 1 ? 'passaria a vencida' : 'passariam a vencidas'} na hora.`
    : null;
  if (!alerta) linhas.push('Nenhuma fica vencida.');
  return { titulo: `${nome}: de ${textoDias(i.dias_atuais)} para ${textoDias(i.dias_novos)}`, linhas, alerta, recalcula: i.ganham + i.perdem };
}
