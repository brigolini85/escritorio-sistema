import { FUSO_HORARIO } from '@escritorio/core';

export type Faixa = { de: string; ate: string };
export type DiaHorario = 'semana' | 'sabado' | 'domingo';
/** null = sem restrição; null num dia = bloqueado (o mesmo formato de usuarios.horario_acesso). */
export type HorarioAcesso = Record<DiaHorario, Faixa | null>;
export { situacaoDe, type SituacaoAcesso } from './situacao-acesso';

export const DIAS_HORARIO: { chave: DiaHorario; rotulo: string }[] = [
  { chave: 'semana', rotulo: 'Seg a sex' }, { chave: 'sabado', rotulo: 'Sábado' }, { chave: 'domingo', rotulo: 'Domingo' },
];
/** Padrão de pessoa nova (spec 7.1). Quem já existia fica sem restrição até o administrador definir (P4). */
export const HORARIO_PADRAO: HorarioAcesso = { semana: { de: '08:00', ate: '18:00' }, sabado: null, domingo: null };
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function descreverHorario(h: HorarioAcesso | null): string {
  if (!h) return 'sem restrição de horário';
  return DIAS_HORARIO.map(({ chave, rotulo }) => {
    const f = h[chave];
    return f ? `${rotulo.toLowerCase()} ${f.de} às ${f.ate}` : `${rotulo.toLowerCase()} bloqueado`;
  }).join(' · ');
}

/** Campos horario_restrito, horario_<dia> (permitido|bloqueado), horario_<dia>_de e horario_<dia>_ate. */
export function lerHorarioAcesso(f: FormData): { ok: true; valor: HorarioAcesso | null } | { ok: false; erro: string } {
  if (f.get('horario_restrito') !== 'sim') return { ok: true, valor: null };
  const valor: HorarioAcesso = { semana: null, sabado: null, domingo: null };
  for (const { chave, rotulo } of DIAS_HORARIO) {
    if (f.get(`horario_${chave}`) !== 'permitido') continue;
    const de = String(f.get(`horario_${chave}_de`) ?? '');
    const ate = String(f.get(`horario_${chave}_ate`) ?? '');
    if (!HORA.test(de) || !HORA.test(ate)) return { ok: false, erro: `${rotulo}: informe o início e o fim.` };
    if (de >= ate) return { ok: false, erro: `${rotulo}: o fim precisa ser depois do início.` };
    valor[chave] = { de, ate };
  }
  return { ok: true, valor };
}

/** O banco já validou o formato (check horario_valido); aqui só dá o tipo. */
export function lerHorarioDoBanco(bruto: unknown): HorarioAcesso | null {
  if (!bruto || typeof bruto !== 'object') return null;
  const h = bruto as Partial<HorarioAcesso>;
  return { semana: h.semana ?? null, sabado: h.sabado ?? null, domingo: h.domingo ?? null };
}

const partesBrasilia = new Intl.DateTimeFormat('en-US', { timeZone: FUSO_HORARIO, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** Para mostrar ("Fora do horário agora" na lista). Quem decide de verdade é o banco (horario_permite). */
export function horarioPermiteEm(h: HorarioAcesso | null, quando: Date): boolean {
  if (!h) return true;
  const partes = partesBrasilia.formatToParts(quando);
  const pegar = (t: string) => partes.find((p) => p.type === t)?.value ?? '';
  const dia = pegar('weekday');
  const faixa = dia === 'Sat' ? h.sabado : dia === 'Sun' ? h.domingo : h.semana;
  const hora = `${pegar('hour')}:${pegar('minute')}`;
  return faixa !== null && hora >= faixa.de && hora <= faixa.ate;
}
