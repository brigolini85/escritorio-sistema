import type { StatusDemanda } from '@/components/patterns/status-badge';
import type { FiltrosDemandas } from '@/lib/demandas';
import { filtrarConsulta } from '@/lib/demandas-consulta';
import type { supabaseServidor } from '@/lib/supabase/servidor';
import { COLUNAS_LISTA, paraLinhaDemanda } from './colunas-demandas';
import type { ColunaQuadro } from './quadro-demandas';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
const POR_COLUNA = 50;
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/** As 4 colunas do quadro (spec 6.2): os mesmos filtros e busca da tabela, menos os status; Concluída só dos últimos 7 dias. `erro`: alguma coluna falhou. */
export async function lerQuadro(sb: Sb, f: FiltrosDemandas, euId: string, agora: Date): Promise<{ colunas: ColunaQuadro[]; erro: boolean }> {
  const desde = new Date(agora.getTime() - SETE_DIAS_MS).toISOString();
  const coluna = async (status: StatusDemanda, titulo: string): Promise<{ coluna: ColunaQuadro; erro: boolean }> => {
    const base = filtrarConsulta(sb.from('demandas_lista').select(COLUNAS_LISTA, { count: 'exact' }).eq('status', status), f, euId, agora, { semStatus: true });
    const { data, count, error } = status === 'concluido'
      ? await base.gte('concluido_em', desde).order('concluido_em', { ascending: false }).limit(POR_COLUNA)
      : await base.order('prazo_em', { ascending: true, nullsFirst: false }).order('numero', { ascending: false }).limit(POR_COLUNA);
    if (error) console.error('[demandas] falha ao ler a coluna do quadro', status, error);
    return { coluna: { status, titulo, total: count ?? 0, cartoes: (data ?? []).map((d) => paraLinhaDemanda(d, [])) }, erro: Boolean(error) };
  };
  const lidas = await Promise.all([
    coluna('aberto', 'Nova'), coluna('em_andamento', 'Resolvendo'), coluna('aguardando_cliente', 'Com o cliente'), coluna('concluido', 'Concluída · 7 dias'),
  ]);
  return { colunas: lidas.map((l) => l.coluna), erro: lidas.some((l) => l.erro) };
}
