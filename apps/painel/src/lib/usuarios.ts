import { FUSO_HORARIO } from '@escritorio/core';

const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit', year: 'numeric' });

/** "hoje 08:12", "ontem 17:40", "12/08/2026 09:05" ou "nunca entrou" (topo da ficha e coluna da lista). */
export function textoUltimoAcesso(iso: string | null, agora: Date): string {
  if (!iso) return 'nunca entrou';
  const d = new Date(iso);
  if (dia.format(d) === dia.format(agora)) return `hoje ${hora.format(d)}`;
  if (dia.format(d) === dia.format(new Date(agora.getTime() - 86_400_000))) return `ontem ${hora.format(d)}`;
  return `${dia.format(d)} ${hora.format(d)}`;
}

export function dataCadastro(iso: string): string {
  return dia.format(new Date(iso));
}

/** Lista padrão (igual ao padrão de configuracoes.cargos): vale quando o banco ainda não tem a coluna (D25). */
export const CARGOS_SUGERIDOS = ['Auxiliar', 'Analista', 'Coordenador', 'Sócio'];

/** Cargo é informativo (spec 7.1): a lista de Configurações › Cargos (D10) mais os cargos já usados. */
export function sugestoesDeCargo(usados: (string | null)[], lista: string[] = CARGOS_SUGERIDOS): string[] {
  const outros = usados.map((c) => c?.trim() ?? '').filter((c) => c !== '');
  return [...new Set([...lista, ...outros])];
}
