// Regras do Início (spec 7C.1): teto de IA, faixa de alertas, cabeçalho, demandas por setor e o estado do sistema.
// Gasto, sinais e configuracoes só o administrador lê (banco e RLS), por lib/leituras-admin.ts; quem atende lê só
// estado_sistema_resumo (sem custos, D3).
import { minutosDeEspera, textoEspera } from './atendimento';
import { FUSO, formatarUSD, tempoRelativo } from './formatos';
import { descreverPrazo, horaCurta } from './prazo';
import { situacaoDoSinal, type LimitesSinal } from './sinal-vida';

/**
 * O trabalhador grava 'fila' a cada batimento (a cada minuto) e 'whatsapp' no mesmo batimento, só quando a Z-API
 * responde conectada. A rota /saude do trabalhador considera ruim depois de 3 min: aqui 3 min é atraso e 5 min é parado.
 */
export const LIMITES_BATIMENTO: LimitesSinal = { atrasadoApos: 180, paradoApos: 300 };

/** "Sem responsável há muito tempo" quando não dá para ler configuracoes.minutos_alerta_fila (padrão do banco). */
export const MINUTOS_SEM_RESPONSAVEL_PADRAO = 30;

/** Mês corrente no horário de Brasília: [início, início do próximo), como o trabalhador soma o gasto (custoIaDoMes). */
export function mesCorrenteSP(agora: Date): { inicio: string; fim: string } {
  const [a, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .format(agora).split('-').map(Number) as [number, number];
  const mes = (ano: number, n: number) => `${ano}-${String(n).padStart(2, '0')}-01T00:00:00-03:00`;
  return { inicio: mes(a, m), fim: m === 12 ? mes(a + 1, 1) : mes(a, m + 1) };
}

export type NivelTeto = 'ok' | 'perto' | 'atingido';
export type SituacaoTeto = { gasto: number; teto: number; /** 0..∞ (1 = 100%) */ fracao: number; nivel: NivelTeto };

/** Perto a partir de 80% (quando o trabalhador manda o alerta); atingido em 100% (o agente para de responder). */
export function situacaoTeto(gasto: number, teto: number): SituacaoTeto {
  const fracao = teto > 0 ? gasto / teto : gasto > 0 ? Infinity : 0;
  const nivel: NivelTeto = teto <= 0 || gasto >= teto ? 'atingido' : fracao >= 0.8 ? 'perto' : 'ok';
  return { gasto, teto, fracao, nivel };
}

/** Percentual do teto para texto; fração infinita (teto 0 com gasto) vira "teto atingido", nunca "Infinity%". */
export const textoFracaoTeto = (fracao: number): string => (Number.isFinite(fracao) ? `${Math.round(fracao * 100)}%` : 'teto atingido');

// Os leitores de gasto e sinais (só o administrador) ficam em lib/leituras-admin.ts: a Minha mesa importa este arquivo.
export type GastoDoMes = { total: number };

export type SinaisVida = { fila: string | null; whatsapp: string | null; ultimo: string | null };

export type AlertaFaixa = {
  id: 'teto' | 'fila' | 'whatsapp'; nivel: 'perigo' | 'atencao'; titulo: string; texto: string; link: { href: string; rotulo: string };
};

const LINK_GASTOS = { href: '/gastos-ia', rotulo: 'Ver Gastos com IA' };
const LINK_SINAIS = { href: '#sinais-de-vida', rotulo: 'Ver sinais de vida' };

/**
 * Faixa do topo do Início: só o que está errado agora. Fila parada (o trabalhador não bate) esconde o aviso do
 * WhatsApp, porque o sinal do WhatsApp também vem do batimento. Fila atrasada é âmbar (D10).
 */
export function alertasDaFaixa({ teto, sinais, agora }: { teto: SituacaoTeto | null; sinais: SinaisVida | null; agora: Date }): AlertaFaixa[] {
  const lista: AlertaFaixa[] = [];
  if (teto?.nivel === 'atingido') {
    lista.push({
      id: 'teto', nivel: 'perigo', titulo: 'Teto de gasto com IA atingido', link: LINK_GASTOS,
      texto: `O gasto do mês chegou a ${formatarUSD(teto.gasto)} de ${formatarUSD(teto.teto)}. O agente e o assistente não respondem: as mensagens dos clientes vão para a equipe até o mês virar ou o teto subir.`,
    });
  } else if (teto?.nivel === 'perto') {
    lista.push({
      id: 'teto', nivel: 'atencao', titulo: 'Gasto com IA perto do teto', link: LINK_GASTOS,
      texto: `${Math.floor(teto.fracao * 100)}% do teto do mês (${formatarUSD(teto.gasto)} de ${formatarUSD(teto.teto)}). Ao chegar a 100%, o agente e o assistente param de responder.`,
    });
  }
  if (sinais) {
    const fila = situacaoDoSinal(sinais.fila, agora, LIMITES_BATIMENTO);
    const whatsapp = situacaoDoSinal(sinais.whatsapp, agora, LIMITES_BATIMENTO);
    if (fila === 'parado' || fila === 'sem_sinal') {
      lista.push({
        id: 'fila', nivel: 'perigo', titulo: 'Fila de tarefas parada', link: LINK_SINAIS,
        texto: 'O trabalhador não dá sinal: mensagens novas não são processadas nem enviadas. Verifique se o trabalhador está rodando.',
      });
      return lista;
    }
    if (fila === 'atrasado') {
      lista.push({
        id: 'fila', nivel: 'atencao', titulo: `Fila de tarefas sem batimento ${tempoRelativo(sinais.fila!, agora)}`, link: LINK_SINAIS,
        texto: 'As mensagens chegam, mas o agente pode demorar a responder. Se passar de 5 min, vira alerta crítico.',
      });
    }
    if (whatsapp === 'parado' || whatsapp === 'sem_sinal') {
      // Não afirma "desconectado": o sinal também some se o batimento falhar antes de consultar a Z-API.
      const quando = sinais.whatsapp ? tempoRelativo(sinais.whatsapp, agora) : '';
      lista.push({
        id: 'whatsapp', nivel: 'perigo', titulo: quando ? `Sem sinal do WhatsApp ${quando}` : 'Sem sinal do WhatsApp', link: LINK_SINAIS,
        texto: 'A fila bate, mas a conexão com a Z-API não foi confirmada. Confira no painel da Z-API se o número está conectado (se não estiver, leia o QR code de novo com o celular do escritório) e, se estiver, os registros do trabalhador.',
      });
    }
  }
  return lista;
}

// ---------- Cabeçalho (D23) ----------

const SEMANA = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long' });
const DIA_MES = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
const HORA = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, hour: 'numeric', hourCycle: 'h23' });
const DIA = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "quinta, 02/10" (Brasília). */
export function dataDoTitulo(agora: Date): string {
  return `${SEMANA.format(agora).replace('-feira', '')}, ${DIA_MES.format(agora)}`;
}

export const capitalizar = (t: string): string => (t ? t[0]!.toLocaleUpperCase('pt-BR') + t.slice(1) : t);

/** 05h–11h Bom dia, 12h–17h Boa tarde, 18h–04h Boa noite, pela hora de Brasília. */
export function saudacao(agora: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const h = Number(HORA.format(agora)) % 24;
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export const primeiroNome = (nome: string): string => nome.trim().split(/\s+/)[0] ?? nome;

/** ["Pessoal", "Fiscal"] → "Pessoal e Fiscal"; três ou mais: "A, B e C". */
export function juntarNomes(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}

/** O "atualizado …" do topo: "agora", "há 12 s", "há 3 min". */
export function textoAtualizado(segundos: number): string {
  if (segundos < 5) return 'agora';
  if (segundos < 60) return `há ${Math.floor(segundos)} s`;
  return `há ${Math.floor(segundos / 60)} min`;
}

/** "2026-10-01": o dia de Brasília (feriados, "hoje"). */
export const diaSP = (agora: Date): string => DIA.format(agora);

/** Primeiro e último dia do mês de Brasília, para as pontas da barra do teto ("01/10" … "31/10"). */
export function diasDoMes(agora: Date): { primeiro: string; ultimo: string } {
  const [ano, mes] = diaSP(agora).split('-').map(Number) as [number, number];
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, '0');
  return { primeiro: `01/${mm}`, ultimo: `${String(ultimo).padStart(2, '0')}/${mm}` };
}

// ---------- Demandas por setor (D5) ----------

export type LinhaSetor = {
  setorId: string | null; setor: string; abertas: number; noPrazo: number; vencemHoje: number; vencidas: number; semResponsavel: number; urgentes: number;
};

const numero = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

/** Linhas de demandas_por_setor (o PostgREST pode mandar número como texto). */
export function lerLinhasSetor(bruto: unknown): LinhaSetor[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.map((r: Record<string, unknown>) => ({
    setorId: typeof r.setor_id === 'string' ? r.setor_id : null, setor: String(r.setor ?? ''),
    abertas: numero(r.abertas), noPrazo: numero(r.no_prazo), vencemHoje: numero(r.vencem_hoje), vencidas: numero(r.vencidas),
    semResponsavel: numero(r.sem_responsavel), urgentes: numero(r.urgentes),
  }));
}

export type TotaisSetores = { abertas: number; vencemHoje: number; vencidas: number; semResponsavel: number; urgentes: number };

/** Os números do topo são a soma da tabela: cartões e tabela sempre batem (D5). */
export function totaisDosSetores(linhas: LinhaSetor[]): TotaisSetores {
  return linhas.reduce((t, l) => ({
    abertas: t.abertas + l.abertas, vencemHoje: t.vencemHoje + l.vencemHoje, vencidas: t.vencidas + l.vencidas,
    semResponsavel: t.semResponsavel + l.semResponsavel, urgentes: t.urgentes + l.urgentes,
  }), { abertas: 0, vencemHoje: 0, vencidas: 0, semResponsavel: 0, urgentes: 0 });
}

/** Linhas com abertas (a Triagem só com abertas) e os setores sem nenhuma, para a nota embaixo da tabela. */
export function separarSetores(linhas: LinhaSetor[]): { visiveis: LinhaSetor[]; semAbertas: string[] } {
  return {
    visiveis: linhas.filter((l) => l.abertas > 0),
    semAbertas: linhas.filter((l) => l.setorId !== null && l.abertas === 0).map((l) => l.setor),
  };
}

export const textoSemAbertas = (nomes: string[]): string | null => (nomes.length ? `${juntarNomes(nomes)} sem demandas abertas` : null);

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export type BarraSetor = { noPrazo: number; venceHoje: number; vencida: number; rotulo: string };

/** Barra "situação": larguras em % do maior setor e a frase que o leitor de tela lê (a cor nunca fala sozinha). */
export function barraDoSetor(l: LinhaSetor, maior: number): BarraSetor {
  const pct = (v: number) => (maior > 0 ? Math.round((v / maior) * 1000) / 10 : 0);
  const partes = [
    l.vencidas > 0 && plural(l.vencidas, 'vencida', 'vencidas'),
    l.vencemHoje > 0 && `${l.vencemHoje} ${l.vencemHoje === 1 ? 'vence' : 'vencem'} hoje`,
    l.noPrazo > 0 && `${l.noPrazo} no prazo`,
  ].filter(Boolean);
  return { noPrazo: pct(l.noPrazo), venceHoje: pct(l.vencemHoje), vencida: pct(l.vencidas), rotulo: partes.join(', ') || 'nenhuma aberta' };
}

export const hrefDoSetor = (setorId: string | null): string => `/demandas?setor=${setorId ?? 'triagem'}`;

// ---------- Detalhes dos números ----------

/** "a mais antiga há 18 min" (a lista vem ordenada por quem espera há mais tempo). */
export function detalheEsperando(maisAntiga: string | null, agora: Date): string {
  if (!maisAntiga) return 'ninguém esperando';
  const min = minutosDeEspera(maisAntiga, agora.getTime());
  return min < 1 ? 'a mais antiga chegou agora' : `a mais antiga há ${textoEspera(min)}`;
}

/** "2 urgentes · até 18h": das que vencem hoje (ainda no prazo). */
export function detalheVencemHoje(lista: { prioridade: string | null; prazo_em: string | null }[]): string | null {
  if (lista.length === 0) return null;
  const urgentes = lista.filter((d) => d.prioridade === 'urgente').length;
  const ultimo = lista.reduce<Date | null>((m, d) => {
    if (!d.prazo_em) return m;
    const x = new Date(d.prazo_em);
    return !m || x > m ? x : m;
  }, null);
  const partes = [urgentes > 0 && plural(urgentes, 'urgente', 'urgentes'), ultimo && `até ${horaCurta(ultimo)}`].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

/** "mais atrasada: venceu 01/10" (D9). */
export function detalheMaisAtrasada(prazo: string | null, agora: Date): string | null {
  if (!prazo) return null;
  return `mais atrasada: ${descreverPrazo({ prazo, pausadoDesde: null, concluidaEm: null }, agora).texto}`;
}

// ---------- Estado do sistema para quem atende (D3, D18) ----------

export type EstadoSistema = { agentePausado: boolean; tetoAtingido: boolean; whatsappConectado: boolean; trabalhadorOk: boolean };

/** estado_sistema_resumo(): só booleanos; qualquer outra coisa (ou null: arquivada, fora do horário, sem migração) é indisponível. */
export function lerEstadoSistema(bruto: unknown): EstadoSistema | null {
  const o = bruto as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const chaves = ['agente_pausado', 'teto_atingido', 'whatsapp_conectado', 'trabalhador_ok'] as const;
  if (!chaves.every((k) => typeof o[k] === 'boolean')) return null;
  return {
    agentePausado: o.agente_pausado as boolean, tetoAtingido: o.teto_atingido as boolean,
    whatsappConectado: o.whatsapp_conectado as boolean, trabalhadorOk: o.trabalhador_ok as boolean,
  };
}

export type LinhaSistema = { id: 'agente' | 'whatsapp' | 'fila'; rotulo: string; valor: string; tom: 'ok' | 'atencao' | 'perigo' };

/** O bloco Sistema da Minha mesa: nunca valores, só o que a pessoa precisa saber para atender (D18). */
export function linhasDoSistema(e: EstadoSistema): LinhaSistema[] {
  const agente: LinhaSistema = e.agentePausado
    ? { id: 'agente', rotulo: 'Agente', valor: 'pausado', tom: 'perigo' }
    : e.tetoAtingido
      ? { id: 'agente', rotulo: 'Agente', valor: 'pausado: limite de IA do mês', tom: 'perigo' }
      : { id: 'agente', rotulo: 'Agente', valor: 'atendendo', tom: 'ok' };
  if (!e.trabalhadorOk) {
    // O sinal do WhatsApp vem do batimento: com a fila parada, não dá para afirmar nada sobre ele.
    return [agente, { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'sem confirmação', tom: 'atencao' },
      { id: 'fila', rotulo: 'Mensagens', valor: 'paradas: avise o administrador', tom: 'perigo' }];
  }
  return [agente, e.whatsappConectado
    ? { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'conectado', tom: 'ok' }
    : { id: 'whatsapp', rotulo: 'WhatsApp', valor: 'sem sinal', tom: 'perigo' }];
}
