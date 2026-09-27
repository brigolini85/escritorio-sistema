import { FUSO_HORARIO } from './fuso';

export type ConfigExpediente = { inicio: string; fim: string; diasUteis: number[]; feriados: string[] };

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function partesNoFuso(d: Date) {
  const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_HORARIO, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  });
  const p = Object.fromEntries(formato.formatToParts(d).map((x) => [x.type, x.value]));
  return { data: `${p.year}-${p.month}-${p.day}`, hora: `${p.hour}:${p.minute}`, diaSemana: DIAS[p.weekday ?? ''] ?? -1 };
}

export function estaNoExpediente(agora: Date, cfg: ConfigExpediente): boolean {
  const { data, hora, diaSemana } = partesNoFuso(agora);
  if (!cfg.diasUteis.includes(diaSemana)) return false;
  if (cfg.feriados.includes(data)) return false;
  return hora >= cfg.inicio && hora < cfg.fim;
}

export function mesReferencia(agora: Date): string {
  return partesNoFuso(agora).data.slice(0, 7);
}
