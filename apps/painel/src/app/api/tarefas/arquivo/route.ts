import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { registrarAuditoria } from '@/lib/auditoria';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';

const NAO_ACHEI = 'Arquivo não encontrado ou sem acesso.';

/**
 * Baixa um arquivo da tarefa (D14, F7): o bucket "tarefas" não tem política de leitura; só esta rota assina o link, com o serviço,
 * DEPOIS de conferir com a sessão da pessoa que ela vê a tarefa e (F3) a conversa de onde veio o anexo; tudo na auditoria.
 */
export async function GET(req: NextRequest) {
  const u = await obterUsuario();
  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!z.string().uuid().safeParse(id).success) return new NextResponse(NAO_ACHEI, { status: 404 });
  const sb = await supabaseServidor();
  const { data: a } = await sb.from('agente_tarefa_arquivos').select('tarefa_id, origem, bucket, caminho, nome, mensagem_id').eq('id', id).maybeSingle();
  if (!a) return new NextResponse(NAO_ACHEI, { status: 404 });
  const { data: veTarefa } = await sb.rpc('pode_ver_tarefa', { p_tarefa: a.tarefa_id });
  if (veTarefa !== true) return new NextResponse(NAO_ACHEI, { status: 404 });
  if (a.origem === 'conversa') {
    // O anexo da conversa só sai para quem vê aquela conversa (a RLS das mensagens decide); sem a mensagem, ninguém baixa.
    const { data: msg } = a.mensagem_id ? await sb.from('mensagens').select('conversa_id').eq('id', a.mensagem_id).maybeSingle() : { data: null };
    if (!msg) return new NextResponse(NAO_ACHEI, { status: 404 });
    const { data: veConversa } = await sb.rpc('pode_ver_conversa', { p_conversa: msg.conversa_id });
    if (veConversa !== true) return new NextResponse(NAO_ACHEI, { status: 404 });
  }
  const { data, error } = await supabaseServico().storage.from(a.bucket).createSignedUrl(a.caminho, 60, { download: a.nome });
  if (error || !data) return new NextResponse(NAO_ACHEI, { status: 404 });
  await registrarAuditoria(u.id, 'download', 'arquivo_tarefa', id);
  return NextResponse.redirect(data.signedUrl);
}
