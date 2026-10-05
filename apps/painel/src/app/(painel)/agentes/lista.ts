import { ESTADOS_AGENTE, INFO_MODO, TEXTO_FALA_THIAGO, TIPOS_AGENTE, type EstadoAgente, type TipoAgente } from '@escritorio/core';
import type { Agente, NumerosAgente } from '@/lib/agentes';
import { valorParam, type ParamsBusca } from '@/lib/tabela-url';

export type FiltrosAgentes = { estado: EstadoAgente | null; tipo: TipoAgente | null; q: string };
const semAcento = (v: string) => v.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function lerFiltrosAgentes(params: ParamsBusca): FiltrosAgentes {
  const estado = valorParam(params, 'estado');
  const tipo = valorParam(params, 'tipo');
  return {
    estado: (ESTADOS_AGENTE as readonly string[]).includes(estado ?? '') ? (estado as EstadoAgente) : null,
    tipo: (TIPOS_AGENTE as readonly string[]).includes(tipo ?? '') ? (tipo as TipoAgente) : null,
    q: (valorParam(params, 'q') ?? '').trim().slice(0, 60),
  };
}

export function filtrarAgentes(agentes: Agente[], f: FiltrosAgentes): Agente[] {
  const q = semAcento(f.q);
  return agentes.filter((a) => (!f.estado || a.estado === f.estado) && (!f.tipo || a.tipos.includes(f.tipo))
    && (!q || semAcento(`${a.nome} ${a.setor ?? ''} ${a.descricao}`).includes(q)));
}

export function contarPorEstado(agentes: Agente[]): Record<'todos' | EstadoAgente, number> {
  return { todos: agentes.length, ...Object.fromEntries(ESTADOS_AGENTE.map((e) => [e, agentes.filter((a) => a.estado === e).length])) } as Record<'todos' | EstadoAgente, number>;
}

/** "Fala com o cliente" do cartão (D13): o Thiago é a voz; o resto, o modo escolhido ou "a definir". */
export function falaComOCliente(a: Pick<Agente, 'portaDeEntrada' | 'modoContato'>): { modo: string; detalhe: string | null } {
  if (a.portaDeEntrada) return { modo: TEXTO_FALA_THIAGO, detalhe: null };
  if (!a.modoContato) return { modo: 'a definir', detalhe: null };
  const detalhe = { por_tras: 'Thiago repassa', mesma_voz: 'responde como Thiago', passa_conversa: 'Thiago passa a conversa' }[a.modoContato];
  return { modo: INFO_MODO[a.modoContato].rotulo, detalhe };
}

export function percentualSozinho(n: NumerosAgente | undefined): number | null {
  if (!n || n.atendimentos === 0) return null;
  return Math.round((n.resolvidos / n.atendimentos) * 100);
}
