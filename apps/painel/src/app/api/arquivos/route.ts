import { NextResponse, type NextRequest } from 'next/server';
import { registrarAuditoria } from '@/lib/auditoria';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Abre um anexo: o RLS do Storage decide se o usuário pode; todo download fica na auditoria. */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const path = req.nextUrl.searchParams.get('path') ?? '';
  const sb = await supabaseServidor();
  const { data, error } = await sb.storage.from('anexos').createSignedUrl(path, 60);
  if (error || !data) return new NextResponse('Arquivo não encontrado ou sem acesso.', { status: 404 });
  await registrarAuditoria(u.id, 'download', 'arquivo', path);
  return NextResponse.redirect(data.signedUrl);
}
