import { NextResponse, type NextRequest } from 'next/server';
import { dividirPedidosBling, montarCsvVendaBling, nomeArquivoVendaBling } from '@escritorio/core';
import { registrarAuditoria } from '@/lib/auditoria';
import { carregarPedidosBling, type FiltroBling } from '@/lib/bling';
import { lerFiltrosDemandas } from '@/lib/demandas';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Aviso em vez do arquivo: diz qual pedido e qual campo falta. */
function aviso(titulo: string, itens: string[], status = 422) {
  const html = `<!doctype html><meta charset="utf-8"><title>Arquivo do Bling</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1 style="font-size:20px">${escapar(titulo)}</h1><ul>${itens.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
<p><a href="javascript:history.back()">Voltar</a></p></body>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const SEM_PERMISSAO_CSV = 'Você não tem permissão para gerar o CSV do Bling. Peça ao administrador na aba Usuários.';
const FALHA_AO_MONTAR = 'Não consegui montar o arquivo agora. Tente de novo.';

/**
 * Arquivo de pedidos de venda para importar no Bling (pedido do dono, 2026-09-29).
 * ?id=<demanda> baixa um pedido; os filtros da tela Demandas (?q=, ?status=, ?vencidas=…)&parte=N exportam as demandas de venda desse filtro, 500 pedidos por arquivo.
 */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  // Vale para todos os caminhos (demanda, exportação e link do assistente); o administrador sempre pode.
  if (!temPermissao(u, 'emitir_notas')) return aviso(SEM_PERMISSAO_CSV, [], 403);
  const q = req.nextUrl.searchParams;
  const id = q.get('id');
  const ids = q.get('ids')?.split(',').filter(Boolean) ?? null;
  const mensagemId = q.get('assistente');
  const sb = await supabaseServidor();
  // Exportação da tela: os mesmos parâmetros da URL de /demandas (busca, status, vencidas, responsável…).
  const params = Object.fromEntries([...new Set(q.keys())].map((k) => {
    const v = q.getAll(k);
    return [k, v.length > 1 ? v : v[0]!];
  }));
  let filtro: FiltroBling = id ? { id } : ids ? { ids } : { filtros: lerFiltrosDemandas(params, u.id), euId: u.id, agora: new Date() };
  if (mensagemId) {
    // Link do assistente: os ids ficam na mensagem (só o dono a lê, pelo RLS), não na URL.
    const { data: msg } = await sb.from('assistente_mensagens').select('papel, arquivo').eq('id', mensagemId).maybeSingle();
    const arquivo = msg?.arquivo as { tipo?: string; chamados?: string[] } | null | undefined;
    if (!msg || msg.papel !== 'assistente' || arquivo?.tipo !== 'csv_bling' || !arquivo.chamados?.length) {
      return aviso('Arquivo não encontrado.', ['Peça de novo ao assistente para gerar o arquivo.']);
    }
    filtro = { ids: arquivo.chamados };
  }
  let carregado: Awaited<ReturnType<typeof carregarPedidosBling>>;
  try {
    carregado = await carregarPedidosBling(sb, filtro);
  } catch (e) {
    // Consulta que falhou no meio: melhor nenhum arquivo do que um arquivo faltando pedidos.
    console.error('[csv-bling]', e);
    return aviso(FALHA_AO_MONTAR, [], 503);
  }
  const { pedidos, problemas } = carregado;
  if (pedidos.length === 0) return aviso('Nenhum pedido de venda para exportar.', ['Nenhuma demanda de venda neste filtro. Só as demandas de pedido de nota geram o arquivo.']);
  if (problemas.length) return aviso('Complete os dados abaixo antes de gerar o arquivo:', problemas);

  const partes = dividirPedidosBling(pedidos);
  const parte = Math.min(Math.max(Number(q.get('parte') ?? 1) || 1, 1), partes.length);
  const nome = nomeArquivoVendaBling(new Date(), partes.length > 1 ? parte : undefined);
  await registrarAuditoria(u.id, 'download', 'csv_bling', id ?? (mensagemId ? `assistente:${mensagemId}` : ids ? ids.join(',') : `exportacao:${q.toString()}`), { pedidos: partes[parte - 1]!.map((p) => p.numero), arquivo: nome });
  return new NextResponse(montarCsvVendaBling(partes[parte - 1]!), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}"` },
  });
}
