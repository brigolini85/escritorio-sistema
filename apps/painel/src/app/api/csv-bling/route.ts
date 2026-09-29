import { NextResponse, type NextRequest } from 'next/server';
import { dividirPedidosBling, montarCsvVendaBling, nomeArquivoVendaBling } from '@escritorio/core';
import { registrarAuditoria } from '@/lib/auditoria';
import { carregarPedidosBling, type FiltroBling } from '@/lib/bling';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const escapar = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Aviso em vez do arquivo: diz qual pedido e qual campo falta. */
function aviso(titulo: string, itens: string[]) {
  const html = `<!doctype html><meta charset="utf-8"><title>Arquivo do Bling</title>
<body style="font-family:system-ui;max-width:640px;margin:40px auto;padding:0 16px">
<h1 style="font-size:20px">${escapar(titulo)}</h1><ul>${itens.map((i) => `<li>${escapar(i)}</li>`).join('')}</ul>
<p><a href="javascript:history.back()">Voltar</a></p></body>`;
  return new NextResponse(html, { status: 422, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

/**
 * Arquivo de pedidos de venda para importar no Bling (pedido do dono, 2026-09-29).
 * ?id=<demanda> baixa um pedido; ?setor=<filtro da tela Demandas>&parte=N exporta as demandas abertas, 500 pedidos por arquivo.
 */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const q = req.nextUrl.searchParams;
  const id = q.get('id');
  const ids = q.get('ids')?.split(',').filter(Boolean) ?? null;
  const filtro: FiltroBling = id ? { id } : ids ? { ids } : { setor: q.get('setor') ?? 'todos' };
  const { pedidos, problemas } = await carregarPedidosBling(await supabaseServidor(), filtro);
  if (pedidos.length === 0) return aviso('Nenhum pedido de venda para exportar.', ['Só as demandas de nota de venda abertas pelo agente geram o arquivo.']);
  if (problemas.length) return aviso('Complete os dados abaixo antes de gerar o arquivo:', problemas);

  const partes = dividirPedidosBling(pedidos);
  const parte = Math.min(Math.max(Number(q.get('parte') ?? 1) || 1, 1), partes.length);
  const nome = nomeArquivoVendaBling(new Date(), partes.length > 1 ? parte : undefined);
  await registrarAuditoria(u.id, 'download', 'csv_bling', id ?? (ids ? ids.join(',') : `exportacao:${q.get('setor') ?? 'todos'}`), { pedidos: partes[parte - 1]!.map((p) => p.numero), arquivo: nome });
  return new NextResponse(montarCsvVendaBling(partes[parte - 1]!), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}"` },
  });
}
