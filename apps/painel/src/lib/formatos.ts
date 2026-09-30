/**
 * Formatadores puros da interface (pt-BR, horário de Brasília).
 * Usados por MoneyText, DocumentText, RelativeTime, HealthSignal e OrderSummary.
 */

export const FUSO = 'America/Sao_Paulo';

/** Espaço que não quebra: "R$ 9,50" nunca se parte no fim da linha. */
const NBSP = ' ';

const agrupar = (inteiro: string) => inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 1280 → "R$ 1.280,00"; -9.5 → "-R$ 9,50". Arredonda para centavos. */
export function formatarBRL(valor: number): string {
  const centavos = Math.round(Math.abs(valor) * 100);
  const inteiro = Math.floor(centavos / 100).toString();
  const resto = (centavos % 100).toString().padStart(2, '0');
  return `${valor < 0 && centavos > 0 ? '-' : ''}R$${NBSP}${agrupar(inteiro)},${resto}`;
}

/** Quantidade: 15 → "15"; 1.5 → "1,5"; 1234.25 → "1.234,25" (até 3 casas). */
export function formatarNumero(valor: number, casas = 3): string {
  const fator = 10 ** casas;
  const arredondado = Math.round(Math.abs(valor) * fator) / fator;
  const [inteiro, decimal] = arredondado.toString().split('.') as [string, string | undefined];
  return `${valor < 0 && arredondado > 0 ? '-' : ''}${agrupar(inteiro)}${decimal ? `,${decimal}` : ''}`;
}

export const somenteDigitos = (texto: string | null | undefined) => (texto ?? '').replace(/\D/g, '');

/** "11222333000181" → "11.222.333/0001-81". Tamanho diferente de 14 volta como veio. */
export function mascararCNPJ(texto: string): string {
  const d = somenteDigitos(texto);
  if (d.length !== 14) return texto.trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** "12345678909" → "123.456.789-09". */
export function mascararCPF(texto: string): string {
  const d = somenteDigitos(texto);
  if (d.length !== 11) return texto.trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** CPF (11 dígitos) ou CNPJ (14), pelo tamanho. */
export function mascararDocumento(texto: string): string {
  const d = somenteDigitos(texto);
  if (d.length === 14) return mascararCNPJ(d);
  if (d.length === 11) return mascararCPF(d);
  return texto.trim();
}

/** "30110000" → "30110-000". */
export function mascararCEP(texto: string): string {
  const d = somenteDigitos(texto);
  if (d.length !== 8) return texto.trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Telefone brasileiro, com ou sem o 55 do país (como o banco guarda):
 * "5531998765432" → "(31) 99876-5432"; "3132221100" → "(31) 3222-1100".
 */
export function mascararTelefone(texto: string): string {
  let d = somenteDigitos(texto);
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return texto.trim();
}

type Data = Date | string | number;
const paraData = (d: Data) => (d instanceof Date ? d : new Date(d));

function partes(d: Date): Record<'day' | 'month' | 'year' | 'hour' | 'minute', string> {
  const p = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const valor = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? '';
  return { day: valor('day'), month: valor('month'), year: valor('year'), hour: valor('hour'), minute: valor('minute') };
}

/** "30/09/2026" no horário de Brasília. */
export function formatarData(data: Data): string {
  const p = partes(paraData(data));
  return `${p.day}/${p.month}/${p.year}`;
}

/** "14:05" no horário de Brasília (hora das mensagens). */
export function formatarHora(data: Data): string {
  const p = partes(paraData(data));
  return `${p.hour}:${p.minute}`;
}

/** "30/09/2026 às 14:05" no horário de Brasília (tooltip do RelativeTime). */
export function formatarDataHora(data: Data): string {
  const p = partes(paraData(data));
  return `${p.day}/${p.month}/${p.year} às ${p.hour}:${p.minute}`;
}

/**
 * Tempo relativo em pt-BR: "agora", "há 40s", "há 3 min", "há 2 h", "há 1 dia", "há 5 dias";
 * a partir de 7 dias, a data ("12/09/2026"). No futuro (relógio adiantado), até 1 min vira "agora".
 */
export function tempoRelativo(data: Data, agora: Data = Date.now()): string {
  const segundos = Math.round((paraData(agora).getTime() - paraData(data).getTime()) / 1000);
  if (Number.isNaN(segundos)) return '';
  const futuro = segundos < 0;
  const s = Math.abs(segundos);
  if (s < 5 || (futuro && s < 60)) return 'agora';
  const texto = (n: number, unidade: string) => (futuro ? `em ${n}${unidade}` : `há ${n}${unidade}`);
  if (s < 60) return texto(s, 's');
  const min = Math.floor(s / 60);
  if (min < 60) return texto(min, ' min');
  const h = Math.floor(min / 60);
  if (h < 24) return texto(h, ' h');
  const dias = Math.floor(h / 24);
  if (dias < 7) return texto(dias, dias === 1 ? ' dia' : ' dias');
  return formatarData(data);
}
