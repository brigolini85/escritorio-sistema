import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { csvDoResultado } from '@escritorio/core';
import { registrarAuditoria } from '@/lib/auditoria';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerTarefa } from '@/lib/tarefas';
import { nomeDoCsv } from '@/lib/tarefas-tela';

/** D10: o CSV das linhas do resultado (rascunho até aprovar). Quem vê a demanda baixa; fica na auditoria. */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!z.string().uuid().safeParse(id).success) return new NextResponse('Resultado não encontrado ou sem acesso.', { status: 404 });
  const { tarefa } = await lerTarefa(await supabaseServidor(), id);
  if (!tarefa?.resultado) return new NextResponse('Resultado não encontrado ou sem acesso.', { status: 404 });
  await registrarAuditoria(u.id, 'download', 'csv_tarefa', id);
  return new NextResponse(csvDoResultado(tarefa.resultado), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nomeDoCsv(tarefa)}"` },
  });
}
