import { NextResponse, type NextRequest } from 'next/server';
import { registrarAuditoria } from '@/lib/auditoria';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Baixa um documento da empresa: o RLS decide o acesso; todo download fica na auditoria. */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  const sb = await supabaseServidor();
  const { data: doc } = await sb.from('documentos_empresa').select('arquivo_path').eq('id', id).maybeSingle();
  if (!doc) return new NextResponse('Documento não encontrado ou sem acesso.', { status: 404 });
  const { data, error } = await sb.storage.from('documentos').createSignedUrl(doc.arquivo_path, 60);
  if (error || !data) return new NextResponse('Documento não encontrado ou sem acesso.', { status: 404 });
  await registrarAuditoria(u.id, 'download', 'documento', id);
  return NextResponse.redirect(data.signedUrl);
}
