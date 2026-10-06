import { calcularCustoUsd, type PrecoModelo, type UsoTokens } from './custo';
import { FUSO_HORARIO } from './fuso';

/** Parte I5 (spec 7E.7). Regras puras do Radar; o banco repete as de domínio, selo e critérios (interno.fonte_da_url, D2). */
export const PRECO_BUSCA_WEB_USD = 0.01;   // US$ 10 por 1.000 buscas, além dos tokens (D16)
export const LIMITES_RADAR = {
  buscasPorGiro: 8, leiturasPorGiro: 15, rodadasPorGiro: 12, tokensPorLeitura: 12_000, fontesAtivas: 30, paginasPorFonte: 5,
  pedidosPorDia: 6, minutosTravado: 40, diasRepetida: 30, diasEnvio: 3, clientesPorEnvio: 200, contatosPorEnvio: 300,
  avisosAltoPorDia: 5, mensagemCliente: 1000, resumo: 1200, setoresPorNovidade: 3, lidasPorGiro: 100,
} as const;

export const IMPACTOS = ['alto', 'medio', 'baixo'] as const;
export type Impacto = (typeof IMPACTOS)[number];
export const ROTULO_IMPACTO: Record<Impacto, string> = { alto: 'Alto', medio: 'Médio', baixo: 'Baixo' };
export type Selo = 'oficial' | 'confirmar';
export const ESTADOS_NOVIDADE = ['para_decidir', 'demanda', 'descartada'] as const;
export type EstadoNovidade = (typeof ESTADOS_NOVIDADE)[number];
export const ROTULO_ESTADO_NOVIDADE: Record<EstadoNovidade, string> = { para_decidir: 'Para decidir', demanda: 'Viraram demanda', descartada: 'Descartadas' };

export const REGIMES_RADAR = ['simples', 'mei', 'presumido', 'real', 'imune'] as const;
export type RegimeRadar = (typeof REGIMES_RADAR)[number];
export const ROTULO_REGIME_RADAR: Record<RegimeRadar, string> = {
  simples: 'Simples Nacional', mei: 'MEI', presumido: 'Lucro Presumido', real: 'Lucro Real', imune: 'Imune/Isenta',
};
export const SEGMENTOS_RADAR = ['comercio', 'ecommerce', 'industria', 'servicos'] as const;
export type SegmentoRadar = (typeof SEGMENTOS_RADAR)[number];
export const ROTULO_SEGMENTO_RADAR: Record<SegmentoRadar, string> = { comercio: 'comércio', ecommerce: 'e-commerce', industria: 'indústria', servicos: 'serviços' };
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const unicos = <T,>(xs: T[]) => [...new Set(xs)];

/** Regime da ficha (texto livre, D10) → código do Radar. O banco tem a mesma regra (interno.regime_radar). */
export function regimeDoCliente(texto: string | null | undefined): RegimeRadar | null {
  const t = semAcento(texto ?? '');
  if (/\bmei\b/.test(t)) return 'mei';
  if (t.includes('simples')) return 'simples';
  if (t.includes('presumido')) return 'presumido';
  if (t.includes('real')) return 'real';
  if (t.includes('imune') || t.includes('isent')) return 'imune';
  return null;
}

export type FonteRadar = { id: string; nome: string; dominio: string; caminho: string | null; etiqueta: string; oficial: boolean; ativa: boolean; paginas: string[] };
const DOMINIO = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const TRECHO = /^[a-z0-9._~-]+$/;
const ERRO_ENDERECO = 'Endereço inválido: use o nome do site, como cfc.org.br ou gov.br/receitafederal.';

/** D3: o dono cola o endereço como quiser; fica o domínio (sem www) e até dois trechos de caminho. */
export function lerEnderecoFonte(entrada: string): { ok: true; dominio: string; caminho: string | null } | { ok: false; erro: string } {
  const bruto = entrada.trim();
  if (!bruto) return { ok: false, erro: 'Cole o endereço do site (ex.: gov.br/receitafederal).' };
  // Com esquema ("https://", "ftp:", "javascript:") lê como veio; sem esquema, põe https:// ("cfc.org.br:8080" também cai aqui).
  const temEsquema = /^[a-z][a-z0-9+.-]*:(\/\/|[^\d])/i.test(bruto);
  let u: URL;
  try {
    u = new URL(temEsquema ? bruto : `https://${bruto}`);
  } catch {
    return { ok: false, erro: ERRO_ENDERECO };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, erro: 'Use um endereço que comece com http ou https.' };
  const dominio = u.hostname.toLowerCase().replace(/^www\./, '');
  if (!DOMINIO.test(dominio) || /^[\d.]+$/.test(dominio) || u.username || u.port) return { ok: false, erro: ERRO_ENDERECO };
  const trechos = u.pathname.toLowerCase().split('/').filter(Boolean).slice(0, 2);
  if (trechos.some((t) => !TRECHO.test(t))) return { ok: false, erro: ERRO_ENDERECO };
  return { ok: true, dominio, caminho: trechos.length ? `/${trechos.join('/')}` : null };
}

export const dominiosDeBusca = (fontes: readonly FonteRadar[]): string[] =>
  unicos(fontes.filter((x) => x.ativa).map((x) => `${x.dominio}${x.caminho ?? ''}`));
/** A leitura web só aceita domínio (D3): o caminho fica de fora aqui e vale para o selo. */
export const dominiosDeLeitura = (fontes: readonly FonteRadar[]): string[] => unicos(fontes.filter((x) => x.ativa).map((x) => x.dominio));

/** D1, D22: as duas ferramentas web, sempre com a lista de domínios das fontes ligadas. */
export function ferramentasWeb(fontes: readonly FonteRadar[]) {
  return [
    { type: 'web_search_20250305', name: 'web_search', max_uses: LIMITES_RADAR.buscasPorGiro, allowed_domains: dominiosDeBusca(fontes) },
    { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: LIMITES_RADAR.leiturasPorGiro, max_content_tokens: LIMITES_RADAR.tokensPorLeitura,
      allowed_domains: dominiosDeLeitura(fontes) },
  ] as const;
}

function lerUrl(url: string): URL | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

/** D9: a mesma notícia com outro rastreio, âncora, www ou barra final é a mesma URL. */
export function normalizarUrl(url: string): string | null {
  const u = lerUrl(url);
  if (!u) return null;
  for (const k of [...u.searchParams.keys()]) if (k.toLowerCase().startsWith('utm_')) u.searchParams.delete(k);
  const busca = u.searchParams.toString();
  return `${u.hostname.toLowerCase().replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${busca ? `?${busca}` : ''}`;
}

/** D2: a fonte ligada mais específica que contém a URL (mesmo domínio ou subdomínio; dentro do caminho, se houver). */
export function fonteDaUrl(url: string, fontes: readonly FonteRadar[]): FonteRadar | null {
  const u = lerUrl(url);
  if (!u || u.username) return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const caminho = u.pathname.toLowerCase();
  const casa = (x: FonteRadar) => x.ativa && (host === x.dominio || host.endsWith(`.${x.dominio}`))
    && (!x.caminho || caminho === x.caminho || caminho.startsWith(`${x.caminho}/`));
  const peso = (x: FonteRadar) => x.dominio.length + (x.caminho?.length ?? 0);
  return fontes.filter(casa).sort((a, b) => peso(b) - peso(a))[0] ?? null;
}
export const seloDaUrl = (url: string, fontes: readonly FonteRadar[]): Selo => (fonteDaUrl(url, fontes)?.oficial ? 'oficial' : 'confirmar');

export type CriteriosClientes = {
  regimes: RegimeRadar[]; ufs: string[]; municipios: string[]; cnaes: string[]; segmentos: SegmentoRadar[]; comFuncionarios: boolean;
};
export const SEM_CRITERIO: CriteriosClientes = { regimes: [], ufs: [], municipios: [], cnaes: [], segmentos: [], comFuncionarios: false };

/** D10: o que o modelo mandou vira critérios válidos (o resto é ignorado, nunca vira erro). */
export function lerCriterios(x: unknown): CriteriosClientes {
  const o = (x && typeof x === 'object' && !Array.isArray(x) ? x : {}) as Record<string, unknown>;
  const lista = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean) : []);
  return {
    regimes: unicos(lista(o.regimes).map((s) => s.toLowerCase()).filter((s): s is RegimeRadar => (REGIMES_RADAR as readonly string[]).includes(s))),
    ufs: unicos(lista(o.ufs).map((s) => s.toUpperCase()).filter((s) => UFS.includes(s))),
    municipios: unicos(lista(o.municipios).filter((s) => s.length <= 60)).slice(0, 20),
    cnaes: unicos(lista(o.cnaes).map((s) => s.replace(/\D/g, '')).filter((s) => s.length >= 2 && s.length <= 7)).slice(0, 20),
    segmentos: unicos(lista(o.segmentos).map((s) => s.toLowerCase()).filter((s): s is SegmentoRadar => (SEGMENTOS_RADAR as readonly string[]).includes(s))),
    comFuncionarios: o.com_funcionarios === true || o.comFuncionarios === true,
  };
}
export const criteriosParaBanco = (c: CriteriosClientes) => ({
  regimes: c.regimes, ufs: c.ufs, municipios: c.municipios, cnaes: c.cnaes, segmentos: c.segmentos, com_funcionarios: c.comFuncionarios,
});

const juntarOu = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} ou ${xs.at(-1)}`);
export function fraseCriterios(c: CriteriosClientes): string {
  const partes: string[] = [];
  const r = [...c.regimes].sort();
  if (r.length === 2 && r[0] === 'presumido' && r[1] === 'real') partes.push('regime normal');
  else if (r.length) partes.push(juntarOu(c.regimes.map((x) => ROTULO_REGIME_RADAR[x])));
  if (c.segmentos.length) partes.push(juntarOu(c.segmentos.map((x) => ROTULO_SEGMENTO_RADAR[x])));
  if (c.cnaes.length) partes.push(`CNAE ${c.cnaes.join(', ')}`);
  if (c.municipios.length) partes.push(c.municipios.join(', '));
  if (c.ufs.length) partes.push(c.ufs.join(', '));
  if (c.comFuncionarios) partes.push(partes.length ? 'com funcionário registrado' : 'todos com funcionário registrado');
  return partes.length ? partes.join(' · ') : 'todos os clientes ativos';
}

export type AgendaRadar = { hora: string; dias: number[] };
const NOMES_DIA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function textoHora(h: string): string {
  const [hh = '0', mm = '00'] = h.split(':');
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`;
}
const juntarE = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`);
export function textoAgenda(a: AgendaRadar): string {
  const d = unicos(a.dias).sort((x, y) => x - y);
  const quando = d.length === 7 ? 'todo dia' : d.join() === '1,2,3,4,5' ? 'dias úteis' : juntarE(d.map((i) => NOMES_DIA[i]!));
  return `${quando}, ${textoHora(a.hora)}`;
}

/** Dia (AAAA-MM-DD) em São Paulo: o mesmo dia que o banco usa (interno.dia_sp). */
export const diaSP = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_HORARIO }).format(d);
const horaSP = (d: Date) => new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, hour: '2-digit', minute: '2-digit' }).format(d);
// Sem horário de verão desde 2019 (o mesmo que inicioDoDiaSP do trabalhador).
const noDiaSP = (dia: string, hora: string) => new Date(`${dia}T${hora.slice(0, 5)}:00-03:00`);

/** D5: quando o próximo giro agendado roda (null se a agenda não tem dia). Atrasado e ainda não rodou hoje = agora. */
export function proximoGiro(a: AgendaRadar, agora: Date, jaRodouHoje: boolean): Date | null {
  for (let i = 0; i <= 7; i++) {
    const dia = diaSP(new Date(agora.getTime() + i * 86_400_000));
    const diaDaSemana = new Date(`${dia}T12:00:00-03:00`).getUTCDay();   // meio-dia em SP: nunca muda de dia
    if (!a.dias.includes(diaDaSemana)) continue;
    const quando = noDiaSP(dia, a.hora);
    if (i === 0) {
      if (jaRodouHoje) continue;
      return quando > agora ? quando : agora;
    }
    return quando;
  }
  return null;
}

/** D16: tokens pelo preço do modelo + US$ 0,01 por busca. */
export function custoChamadaRadarUsd(uso: UsoTokens, preco: PrecoModelo, buscas: number): number {
  return Math.round((calcularCustoUsd(uso, preco) + Math.max(0, buscas) * PRECO_BUSCA_WEB_USD) * 1_000_000) / 1_000_000;
}

export type GiroParaFaixa = {
  estado: 'pendente' | 'rodando' | 'concluido' | 'falhou'; iniciadoEm: string | null; terminadoEm: string | null; fontes: number;
  novidades: number; repetidas: number; fontesFora: { nome: string; motivo: string }[]; novaTentativaEm: string | null; erro: string | null;
};
function quandoRelativo(iso: string, agora: Date): string {
  const d = new Date(iso);
  const dia = diaSP(d);
  if (dia === diaSP(agora)) return 'de hoje';
  if (dia === diaSP(new Date(agora.getTime() - 86_400_000))) return 'de ontem';
  return `de ${new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_HORARIO, day: '2-digit', month: '2-digit' }).format(d)}`;
}
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const horaCurta = (iso: string) => textoHora(horaSP(new Date(iso)));

/** A faixa do último giro (imagem 00-agente-radar). */
export function textoFaixaGiro(g: GiroParaFaixa, agora: Date): string {
  if (g.estado === 'pendente') return 'Giro pedido. Começa em até 1 minuto.';
  if (g.estado === 'rodando') return `Procurando nas fontes. Começou às ${horaSP(new Date(g.iniciadoEm ?? agora.toISOString()))}.`;
  const inicio = g.iniciadoEm ?? g.terminadoEm ?? agora.toISOString();
  if (g.estado === 'falhou') return `O giro ${quandoRelativo(inicio, agora)} às ${horaSP(new Date(inicio))} não terminou: ${g.erro ?? 'erro desconhecido.'}`;
  const fim = g.terminadoEm ?? inicio;
  const minutos = Math.max(1, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 60_000));
  const partes = [`${plural(g.fontes, 'fonte', 'fontes')} em ${minutos} min`, plural(g.novidades, 'novidade', 'novidades')];
  if (g.repetidas) partes.push(plural(g.repetidas, 'repetida ignorada', 'repetidas ignoradas'));
  for (const x of g.fontesFora) partes.push(`${x.nome} fora do ar${g.novaTentativaEm ? `, tenta de novo às ${horaCurta(g.novaTentativaEm)}` : ''}`);
  const g1 = `Giro ${quandoRelativo(fim, agora)}`;
  return `${g1} terminou às ${horaSP(new Date(fim))}. ${partes.join(' · ')}.`;
}

/** D13d: resumo do giro agendado, só com novidade. */
export function textoResumoDiario(novidades: { titulo: string; impacto: Impacto; fonte: string }[], fontesFora: string[]): string {
  const linhas = [`Radar de legislação: ${plural(novidades.length, 'novidade', 'novidades')} hoje.`];
  for (const n of novidades.slice(0, 10)) linhas.push(`• [${ROTULO_IMPACTO[n.impacto]}] ${n.titulo} (${n.fonte})`);
  if (novidades.length > 10) linhas.push(`• e mais ${novidades.length - 10}.`);
  if (fontesFora.length) linhas.push(`Fora do ar hoje: ${fontesFora.join(', ')}.`);
  linhas.push('Para decidir no painel: Agentes › Radar de legislação.');
  return linhas.join('\n');
}
/** D13c: aviso na hora para impacto alto. */
export const textoAvisoAlto = (n: { titulo: string; fonte: string; vigencia: string | null }): string =>
  `Radar de legislação: impacto alto.\n${n.titulo}\nFonte: ${n.fonte}${n.vigencia ? ` · ${n.vigencia}` : ''}\nPara decidir no painel: Agentes › Radar de legislação.`;
