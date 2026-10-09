import { NextResponse, type NextRequest } from 'next/server';
import { registrarAuditoria } from '@/lib/auditoria';
import { respostaAuditoriaFora } from '@/lib/download-auditado';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * Abre um anexo: o RLS do Storage decide se o usuário pode; todo download fica na auditoria. Auditoria 2.10: registra antes
 * de assinar (o pedido fica registrado mesmo que o Storage recuse); sem auditoria, 503 e nada assinado.
 */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const path = req.nextUrl.searchParams.get('path') ?? '';
  try {
    await registrarAuditoria(u.id, 'download', 'arquivo', path);
  } catch (e) {
    return respostaAuditoriaFora(e);
  }
  const sb = await supabaseServidor();
  const { data, error } = await sb.storage.from('anexos').createSignedUrl(path, 60);
  if (error || !data) return new NextResponse('Arquivo não encontrado ou sem acesso.', { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
