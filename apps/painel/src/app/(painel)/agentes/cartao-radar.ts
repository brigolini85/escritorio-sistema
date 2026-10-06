import { formatarHoraOuDia } from '@/lib/formatos';

export type TextoCartaoRadar = { principal: string; giro: string | null };

/** Textos do cartão do Radar. Sem a migração I5 fica a frase de hoje (D19). */
export function textoCartaoRadar({ semI5, paraDecidir, ultimoGiro, agora = new Date() }: {
  semI5: boolean; paraDecidir: number; ultimoGiro: string | null; agora?: Date;
}): TextoCartaoRadar {
  if (semI5) return { principal: 'Novidades da legislação: chegam na etapa do Radar.', giro: null };
  const principal = paraDecidir <= 0 ? 'Nada para decidir' : paraDecidir === 1 ? '1 novidade para decidir' : `${paraDecidir} novidades para decidir`;
  if (!ultimoGiro) return { principal, giro: 'Nenhum giro ainda' };
  const quando = formatarHoraOuDia(ultimoGiro, agora);
  return { principal, giro: `Último giro: ${/^\d{2}:\d{2}$/.test(quando) ? `hoje ${quando}` : quando}` };
}
