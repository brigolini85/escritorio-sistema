// Prazo das demandas como a equipe lê (imagens 03, 04 e 05), sempre no horário de Brasília.
import { FUSO } from './formatos';

const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const DIA_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const HORA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const UM_DIA_MS = 24 * 60 * 60 * 1000;

const diaSP = (d: Date) => DIA.format(d);
/** Data válida ou null: um texto estranho no banco não pode derrubar a tela. */
const lerData = (iso: string | null | undefined): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export type TomPrazo = 'vencido' | 'hoje' | 'pausado' | 'normal' | 'sem' | 'no-prazo';

/** "17h" ou "17h30". */
export function horaCurta(d: Date): string {
  const [h, m] = HORA.format(d).split(':');
  return m === '00' ? `${Number(h)}h` : `${Number(h)}h${m}`;
}

/** "13/10 18h": o prazo nos eventos da linha do tempo (fixo, não muda com o dia em que se lê). */
export function prazoAbsoluto(iso: string): string {
  const d = lerData(iso);
  return d ? `${DIA_MES.format(d)} ${horaCurta(d)}` : 'sem prazo';
}

/** Prazo na tabela e no quadro: hoje 18h, amanhã, 13/10, venceu…, pausado, no prazo. */
export function descreverPrazo(p: { prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null }, agora: Date): { texto: string; tom: TomPrazo } {
  const prazo = lerData(p.prazo);
  const concluida = lerData(p.concluidaEm);
  if (p.concluidaEm) {
    if (!prazo || !concluida) return { texto: 'concluída', tom: 'normal' };
    return concluida <= prazo ? { texto: 'no prazo', tom: 'no-prazo' } : { texto: 'fora do prazo', tom: 'vencido' };
  }
  if (p.pausadoDesde) return { texto: 'pausado', tom: 'pausado' };
  if (!prazo) return { texto: 'sem prazo', tom: 'sem' };
  const mesmoDia = diaSP(prazo) === diaSP(agora);
  if (prazo < agora) return { texto: mesmoDia ? `venceu ${horaCurta(prazo)}` : `venceu ${DIA_MES.format(prazo)}`, tom: 'vencido' };
  if (mesmoDia) return { texto: `hoje ${horaCurta(prazo)}`, tom: 'hoje' };
  if (diaSP(prazo) === diaSP(new Date(agora.getTime() + UM_DIA_MS))) return { texto: 'amanhã', tom: 'normal' };
  return { texto: DIA_MES.format(prazo), tom: 'normal' };
}

/** Valor do <input type="datetime-local"> no horário de Brasília. */
export function paraCampoDataHora(iso: string | null): string {
  const d = lerData(iso);
  if (!d) return '';
  return `${diaSP(d)}T${HORA.format(d)}`;
}

/** ISO a partir do campo (Brasília, sem horário de verão desde 2019). null se não for data e hora. */
export function doCampoDataHora(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
  const d = new Date(`${valor}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
