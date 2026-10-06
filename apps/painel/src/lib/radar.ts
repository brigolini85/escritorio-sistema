import 'server-only';
import { z } from 'zod';
import {
  ESTADOS_NOVIDADE, IMPACTOS, diaSP, lerCriterios, proximoGiro,
  type CriteriosClientes, type EstadoNovidade, type FonteRadar, type Impacto,
} from '@escritorio/core';
import { semMigracaoI1 } from '@/lib/agentes';
import type { supabaseServidor } from '@/lib/supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
type Linha = Record<string, unknown>;

export type FiltroRadar = { estado: EstadoNovidade; setor: string | null; impacto: Impacto | null; q: string };
export type ConfigTela = {
  hora: string; dias: number[]; assuntos: string[]; resumoWhatsapp: boolean; avisoAlto: boolean; avisarPainel: boolean; limiteUsdGiro: number;
  estado: 'ligado' | 'teste' | 'desligado'; proximoGiro: string | null;
};
export type NovidadeTela = {
  id: string; titulo: string; url: string; fonteNome: string; selo: 'oficial' | 'confirmar'; publicadoEm: string | null; achadoEm: string;
  resumo: string; impacto: Impacto; setores: { id: string; nome: string }[]; criterios: CriteriosClientes; clientesAfetados: number;
  vigenciaTexto: string | null; mensagemCliente: string | null; estado: EstadoNovidade; chamado: { id: string; numero: number | null; setorId: string | null } | null;
  decididaPor: string | null; decididaEm: string | null;
  envios: { enviado: number; aguardando: number; naoEnviado: number; motivos: string[] };
};
export type GiroTela = {
  id: string; origem: string; estado: string; criadoEm: string; iniciadoEm: string | null; terminadoEm: string | null; fontes: number; paginas: number;
  buscas: number; novidades: number; repetidas: number; fontesFora: { nome: string; motivo: string }[]; lidas: { url: string; titulo: string }[];
  resumo: string | null; erro: string | null; custoUsd: number; novaTentativaEm: string | null; pedidoPor: string | null;
};
export type TelaRadar = {
  semI5: boolean; erro: boolean; config: ConfigTela; fontes: FonteRadar[]; giros: GiroTela[]; novidades: NovidadeTela[]; contagem: Record<EstadoNovidade, number>;
  mes: { custoUsd: number; novidades: number; demandas: number }; setores: { id: string; nome: string }[]; telefoneDono: boolean;
};

const Uuid = z.string().uuid();
const PESO: Record<Impacto, number> = { alto: 0, medio: 1, baixo: 2 };
const CONFIG_PADRAO: ConfigTela = {
  hora: '07:00', dias: [0, 1, 2, 3, 4, 5, 6], assuntos: [], resumoWhatsapp: true, avisoAlto: true, avisarPainel: false, limiteUsdGiro: 0.5,
  estado: 'desligado', proximoGiro: null,
};
const VAZIA = (): TelaRadar => ({
  semI5: false, erro: false, config: CONFIG_PADRAO, fontes: [], giros: [], novidades: [], contagem: { para_decidir: 0, demanda: 0, descartada: 0 },
  mes: { custoUsd: 0, novidades: 0, demandas: 0 }, setores: [], telefoneDono: false,
});

const um = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] : v) ?? '';
/** Filtros da URL; qualquer valor estranho volta ao padrão (estado "Para decidir"). */
export function lerFiltroRadar(sp: Record<string, string | string[] | undefined>): FiltroRadar {
  const estado = um(sp.estado);
  const impacto = um(sp.impacto);
  const setor = um(sp.setor);
  return {
    estado: (ESTADOS_NOVIDADE as readonly string[]).includes(estado) ? (estado as EstadoNovidade) : 'para_decidir',
    impacto: (IMPACTOS as readonly string[]).includes(impacto) ? (impacto as Impacto) : null,
    setor: Uuid.safeParse(setor).success ? setor : null,
    q: um(sp.q).trim().slice(0, 100),
  };
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
const textoOuNulo = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const numero = (v: unknown): number => Number(v ?? 0) || 0;
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Primeiro dia do mês corrente em São Paulo (meia-noite, sem horário de verão). */
const inicioDoMes = (agora: Date): string => new Date(`${diaSP(agora).slice(0, 8)}01T00:00:00-03:00`).toISOString();

function lerGiro(l: Linha): GiroTela {
  return {
    id: texto(l.id), origem: texto(l.origem), estado: texto(l.estado), criadoEm: texto(l.criado_em), iniciadoEm: textoOuNulo(l.iniciado_em),
    terminadoEm: textoOuNulo(l.terminado_em), fontes: numero(l.fontes), paginas: numero(l.paginas), buscas: numero(l.buscas), novidades: numero(l.novidades),
    repetidas: numero(l.repetidas),
    fontesFora: lista(l.fontes_fora).map((x) => x as Linha).map((x) => ({ nome: texto(x.nome), motivo: texto(x.motivo) })),
    lidas: lista(l.lidas).map((x) => x as Linha).map((x) => ({ url: texto(x.url), titulo: texto(x.titulo) })),
    resumo: textoOuNulo(l.resumo), erro: textoOuNulo(l.erro), custoUsd: numero(l.custo_usd), novaTentativaEm: textoOuNulo(l.nova_tentativa_em),
    pedidoPor: textoOuNulo(l.pedido_por),
  };
}

function lerFonte(l: Linha): FonteRadar {
  return {
    id: texto(l.id), nome: texto(l.nome), dominio: texto(l.dominio), caminho: textoOuNulo(l.caminho), etiqueta: texto(l.etiqueta),
    oficial: l.oficial === true, ativa: l.ativa === true, paginas: lista(l.paginas).filter((p): p is string => typeof p === 'string'),
  };
}

/** Uma consulta que não pode derrubar a tela: erro vai para o log e a parte volta vazia. */
function ou<T>(r: { data: T | null; error: { code?: string } | null }, nome: string, vazio: T): T {
  if (r.error) {
    console.error(`[radar] ${nome}`, r.error);
    return vazio;
  }
  return r.data ?? vazio;
}

export async function lerTelaRadar(sb: Sb, filtro: FiltroRadar, agora: Date): Promise<TelaRadar> {
  const mes = inicioDoMes(agora);
  const contar = (estado: EstadoNovidade) => sb.from('radar_novidades').select('id', { count: 'exact', head: true }).eq('estado', estado);
  const [config, fontes, giros, girosMes, novidades, c1, c2, c3, novMes, demMes, setores, agente, conf, agendadoHoje] = await Promise.all([
    sb.from('radar_config').select('*').eq('id', 1).maybeSingle(),
    sb.from('radar_fontes').select('*').order('ordem'),
    sb.from('radar_giros').select('*').order('criado_em', { ascending: false }).limit(20),
    sb.from('radar_giros').select('custo_usd').gte('criado_em', mes),
    sb.from('radar_novidades').select('*').eq('estado', filtro.estado).order('achado_em', { ascending: false }).limit(100),
    contar('para_decidir'), contar('demanda'), contar('descartada'),
    sb.from('radar_novidades').select('id', { count: 'exact', head: true }).gte('achado_em', mes),
    sb.from('radar_novidades').select('id', { count: 'exact', head: true }).eq('estado', 'demanda').gte('decidida_em', mes),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('agentes').select('estado').eq('slug', 'radar').maybeSingle(),
    sb.from('configuracoes').select('telefone_dono').limit(1).maybeSingle(),
    sb.from('radar_giros').select('id').eq('origem', 'agenda').eq('dia', diaSP(agora)).limit(1),
  ]);
  if (semMigracaoI1(config.error)) return { ...VAZIA(), semI5: true };
  let erro = false;
  const ler = <T,>(r: { data: T | null; error: unknown }, nome: string, vazio: T): T => {
    if (r.error) erro = true;
    return ou(r as never, nome, vazio);
  };
  if (config.error) { erro = true; console.error('[radar] config', config.error); }
  if (agente.error) { erro = true; console.error('[radar] agente', agente.error); }
  for (const c of [c1, c2, c3, novMes, demMes]) if (c.error) { erro = true; console.error('[radar] contagem', c.error); }

  const todosSetores = ler(setores as never as { data: Linha[] | null; error: unknown }, 'setores', []).map((s) => ({ id: texto(s.id), nome: texto(s.nome) }));
  const nomeDoSetor = new Map(todosSetores.map((s) => [s.id, s.nome]));
  const linhasNov = ler(novidades as never as { data: Linha[] | null; error: unknown }, 'novidades', []);
  const ids = linhasNov.map((n) => texto(n.id));
  const chamadoIds = linhasNov.map((n) => textoOuNulo(n.chamado_id)).filter((x): x is string => !!x);
  const [enviosRpc, chamados] = await Promise.all([
    Promise.all(ids.map((id) => sb.rpc('envios_da_novidade' as never, { p_novidade: id } as never))),
    chamadoIds.length ? sb.from('chamados').select('id, numero, setor_id').in('id', chamadoIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const enviosPor = new Map<string, NovidadeTela['envios']>();
  enviosRpc.forEach((r, i) => {
    const acc: NovidadeTela['envios'] = { enviado: 0, aguardando: 0, naoEnviado: 0, motivos: [] };
    for (const e of ler(r as never as { data: Linha[] | null; error: unknown }, 'envios', [])) {
      const n = numero(e.total);
      if (e.estado === 'enviado') acc.enviado += n;
      else if (e.estado === 'aguardando') acc.aguardando += n;
      else if (e.estado === 'nao_enviado') {
        acc.naoEnviado += n;
        const m = textoOuNulo(e.motivo);
        if (m && !acc.motivos.includes(m)) acc.motivos.push(m);
      }
    }
    enviosPor.set(ids[i]!, acc);
  });
  const dadosChamado = new Map(ler(chamados as never as { data: Linha[] | null; error: unknown }, 'chamados', []).map((c) => [texto(c.id), { numero: numero(c.numero), setorId: textoOuNulo(c.setor_id) }]));

  const q = semAcento(filtro.q);
  const lidas: NovidadeTela[] = linhasNov
    .filter((n) => !filtro.impacto || n.impacto === filtro.impacto)
    .filter((n) => !filtro.setor || lista(n.setores).includes(filtro.setor))
    .filter((n) => !q || semAcento(`${texto(n.titulo)} ${texto(n.resumo)}`).includes(q))
    .map((n) => {
      const chamadoId = textoOuNulo(n.chamado_id);
      return {
        id: texto(n.id), titulo: texto(n.titulo), url: texto(n.url), fonteNome: texto(n.fonte_nome), selo: n.selo === 'oficial' ? ('oficial' as const) : ('confirmar' as const),
        publicadoEm: textoOuNulo(n.publicado_em), achadoEm: texto(n.achado_em), resumo: texto(n.resumo),
        impacto: (IMPACTOS as readonly string[]).includes(texto(n.impacto)) ? (n.impacto as Impacto) : 'baixo',
        setores: lista(n.setores).filter((s): s is string => typeof s === 'string' && nomeDoSetor.has(s)).map((s) => ({ id: s, nome: nomeDoSetor.get(s)! })),
        criterios: lerCriterios(n.criterios), clientesAfetados: numero(n.clientes_afetados), vigenciaTexto: textoOuNulo(n.vigencia_texto),
        mensagemCliente: textoOuNulo(n.mensagem_cliente), estado: n.estado as EstadoNovidade,
        chamado: chamadoId ? { id: chamadoId, numero: dadosChamado.get(chamadoId)?.numero ?? null, setorId: dadosChamado.get(chamadoId)?.setorId ?? null } : null,
        decididaPor: textoOuNulo(n.decidida_por), decididaEm: textoOuNulo(n.decidida_em),
        envios: enviosPor.get(texto(n.id)) ?? { enviado: 0, aguardando: 0, naoEnviado: 0, motivos: [] },
      };
    })
    .sort((a, b) => PESO[a.impacto] - PESO[b.impacto] || b.achadoEm.localeCompare(a.achadoEm));

  const cfg = (config.data ?? {}) as Linha;
  const girosTela = ler(giros as never as { data: Linha[] | null; error: unknown }, 'giros', []).map(lerGiro);
  const hora = texto(cfg.hora).slice(0, 5) || CONFIG_PADRAO.hora;
  const dias = lista(cfg.dias).map(Number).filter((d) => Number.isInteger(d));
  const diasOk = dias.length ? dias : CONFIG_PADRAO.dias;
  const jaRodouHoje = ler(agendadoHoje as never as { data: Linha[] | null; error: unknown }, 'giro de hoje', []).length > 0;
  const estadoAgente = texto((agente.data as Linha | null)?.estado);
  return {
    semI5: false, erro,
    config: {
      hora, dias: diasOk, assuntos: lista(cfg.assuntos).filter((a): a is string => typeof a === 'string'),
      resumoWhatsapp: cfg.resumo_whatsapp !== false, avisoAlto: cfg.aviso_alto !== false, avisarPainel: cfg.avisar_painel === true,
      limiteUsdGiro: cfg.limite_usd_giro === undefined ? CONFIG_PADRAO.limiteUsdGiro : numero(cfg.limite_usd_giro),
      estado: estadoAgente === 'ligado' || estadoAgente === 'teste' ? estadoAgente : 'desligado',
      proximoGiro: proximoGiro({ hora, dias: diasOk }, agora, jaRodouHoje)?.toISOString() ?? null,
    },
    fontes: ler(fontes as never as { data: Linha[] | null; error: unknown }, 'fontes', []).map(lerFonte),
    giros: girosTela,
    novidades: lidas,
    contagem: { para_decidir: c1.count ?? 0, demanda: c2.count ?? 0, descartada: c3.count ?? 0 },
    mes: {
      custoUsd: ler(girosMes as never as { data: Linha[] | null; error: unknown }, 'custo do mês', []).reduce((s, g) => s + numero(g.custo_usd), 0),
      novidades: novMes.count ?? 0, demandas: demMes.count ?? 0,
    },
    setores: todosSetores,
    telefoneDono: !!(conf.data as Linha | null)?.telefone_dono,
  };
}
