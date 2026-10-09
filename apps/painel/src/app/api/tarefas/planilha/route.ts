import { MIME_XLSX } from '@escritorio/core';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { registrarAuditoria } from '@/lib/auditoria';
import { respostaAuditoriaFora } from '@/lib/download-auditado';
import { planilhaDaTarefa } from '@/lib/planilha-tarefa';
import { tarefaDoPedidoEscondida } from '@/lib/pedido-nota';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerTarefa } from '@/lib/tarefas';
import { nomeDaPlanilha } from '@/lib/tarefas-tela';

/** D10: a planilha do resultado (rascunho até aprovar). Quem vê a demanda baixa; fica na auditoria. Funciona sem a migração da I3b. */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!z.string().uuid().safeParse(id).success) return new NextResponse('Resultado não encontrado ou sem acesso.', { status: 404 });
  const { tarefa } = await lerTarefa(await supabaseServidor(), id);
  const bytes = tarefa && !tarefaDoPedidoEscondida(u, tarefa) ? planilhaDaTarefa(tarefa) : null;
  if (!tarefa || !bytes) return new NextResponse('Resultado não encontrado ou sem acesso.', { status: 404 });
  // Auditoria 2.10: sem auditoria, o arquivo não sai.
  try {
    await registrarAuditoria(u.id, 'download', 'planilha_tarefa', id);
  } catch (e) {
    return respostaAuditoriaFora(e);
  }
  return new NextResponse(Buffer.from(bytes), {
    headers: { 'Content-Type': MIME_XLSX, 'Content-Disposition': `attachment; filename="${nomeDaPlanilha(tarefa)}"` },
  });
}
