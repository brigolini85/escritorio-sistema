import 'server-only';
import { pedidoVendaBling, problemasPedidoBling, type PedidoVendaBling, type PedidoVendaSalvo } from '@escritorio/core';
import type { FiltrosDemandas } from './demandas';
import { filtrarConsulta } from './demandas-consulta';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Qual conjunto de demandas vira arquivo: uma (botão da demanda), várias (assistente, seleção) ou as do filtro da tela Demandas. */
export type FiltroBling = { id: string } | { ids: string[] } | { filtros: FiltrosDemandas; euId: string; agora: Date };

/** Igual ao max_rows do Supabase (supabase/config.toml): uma página menor que isso é a última. */
const PAGINA_FILTRO = 1000;

/** Parte pedida na URL (?parte=N): sem parâmetro é a 1; inválida ou além da última dá null (recusar, nunca baixar outra parte no lugar). */
export function escolherParte(texto: string | null, total: number): number | null {
  if (texto === null) return 1;
  const n = Number(texto);
  return Number.isInteger(n) && n >= 1 && n <= total ? n : null;
}

/** Uma consulta que falhou não pode virar um arquivo pela metade: lança, e a rota mostra o aviso. */
function dados<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(`Falha ao montar o arquivo do Bling: ${r.error.message}`);
  return r.data ?? ([] as unknown as T);
}

/**
 * Pedidos de venda das demandas, com o comprador lido do cadastro agora (CEP, número... preenchidos depois também valem).
 * O RLS dos chamados decide o que cada pessoa enxerga.
 */
export async function carregarPedidosBling(sb: Sb, filtro: FiltroBling): Promise<{ pedidos: PedidoVendaBling[]; problemas: string[] }> {
  const base = () => sb.from('chamados').select('numero, pedido_venda').not('pedido_venda', 'is', null).order('numero');
  let linhas: { numero: number | string; pedido_venda: unknown }[];
  if ('ids' in filtro) {
    // Em blocos de 100: o filtro vai na URL e uma lista longa estoura o limite dela.
    linhas = [];
    const ids = [...new Set(filtro.ids)];
    for (let i = 0; i < ids.length; i += 100) linhas.push(...dados(await base().in('id', ids.slice(i, i + 100))));
    linhas.sort((a, b) => Number(a.numero) - Number(b.numero));
  } else if ('id' in filtro) {
    linhas = dados(await base().eq('id', filtro.id));
  } else {
    // Os mesmos filtros da tela (pendência 10 do redesign): o arquivo leva exatamente as demandas de venda que a tabela mostra.
    // Em páginas: o servidor devolve no máximo 1000 linhas por consulta (max_rows), e cortar ali repetiria partes do arquivo.
    linhas = [];
    for (let de = 0; ; de += PAGINA_FILTRO) {
      const pagina = dados(await filtrarConsulta(sb.from('demandas_lista').select('numero, pedido_venda').is('tem_pedido', true), filtro.filtros, filtro.euId, filtro.agora)
        .order('numero').range(de, de + PAGINA_FILTRO - 1)) as { numero: number | string; pedido_venda: unknown }[];
      linhas.push(...pagina);
      if (pagina.length < PAGINA_FILTRO) break;
    }
  }
  const salvos = linhas.map((c) => ({ numero: Number(c.numero), salvo: c.pedido_venda as unknown as PedidoVendaSalvo }));

  const ids = [...new Set(salvos.flatMap((s) => (s.salvo.unidade_id ? [s.salvo.unidade_id] : [])))];
  const unidades: Awaited<ReturnType<typeof buscarUnidades>> = [];
  for (let i = 0; i < ids.length; i += 100) unidades.push(...(await buscarUnidades(sb, ids.slice(i, i + 100))));
  const porId = new Map(unidades.map((u) => [u.id, u]));

  const pedidos = salvos.map((s) => pedidoVendaBling(s.numero, s.salvo, s.salvo.unidade_id ? porId.get(s.salvo.unidade_id) ?? null : null));
  return { pedidos, problemas: pedidos.flatMap(problemasPedidoBling) };
}

const buscarUnidades = async (sb: Sb, ids: string[]) =>
  dados(await sb.from('parceiros_unidades').select('id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').in('id', ids));
