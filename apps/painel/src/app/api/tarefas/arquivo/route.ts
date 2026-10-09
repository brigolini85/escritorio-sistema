import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { semMigracaoI1 } from '@/lib/agentes';
import { registrarAuditoria } from '@/lib/auditoria';
import { respostaAuditoriaFora } from '@/lib/download-auditado';
import { ehPedidoDeNota } from '@/lib/pedido-nota';
import { temNivel } from '@/lib/permissoes';
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
  const COLUNAS = 'tarefa_id, origem, bucket, caminho, nome, mensagem_id';
  let lido = await sb.from('agente_tarefa_arquivos').select(`${COLUNAS}, removido_em`).eq('id', id).maybeSingle();
  // Banco sem a I3b: sem a coluna, lê como antes.
  if (semMigracaoI1(lido.error)) lido = (await sb.from('agente_tarefa_arquivos').select(COLUNAS).eq('id', id).maybeSingle()) as unknown as typeof lido;
  const a = lido.data as (NonNullable<typeof lido.data> & { removido_em?: string | null }) | null;
  if (!a) return new NextResponse(NAO_ACHEI, { status: 404 });
  const { data: veTarefa } = await sb.rpc('pode_ver_tarefa', { p_tarefa: a.tarefa_id });
  if (veTarefa !== true) return new NextResponse(NAO_ACHEI, { status: 404 });
  // Revisão geral (painel I2): demanda "NF de ..." (ou com pedido salvo) só para quem vê pedidos de nota, como no resto do painel.
  if (!temNivel(u, 'notas', 'ver')) {
    const { data: t } = await sb.from('agente_tarefas').select('chamados(titulo, pedido_venda)').eq('id', a.tarefa_id).maybeSingle();
    const c = (t as { chamados: { titulo: string | null; pedido_venda: unknown } | null } | null)?.chamados;
    if (!c || ehPedidoDeNota(c)) return new NextResponse(NAO_ACHEI, { status: 404 });
  }
  if (a.removido_em != null) return new NextResponse('O arquivo foi apagado pela guarda dos arquivos das tarefas.', { status: 410 });
  if (a.origem === 'conversa') {
    // O anexo da conversa só sai para quem vê aquela conversa (a RLS das mensagens decide); sem a mensagem, ninguém baixa.
    const { data: msg } = a.mensagem_id ? await sb.from('mensagens').select('conversa_id').eq('id', a.mensagem_id).maybeSingle() : { data: null };
    if (!msg) return new NextResponse(NAO_ACHEI, { status: 404 });
    const { data: veConversa } = await sb.rpc('pode_ver_conversa', { p_conversa: msg.conversa_id });
    if (veConversa !== true) return new NextResponse(NAO_ACHEI, { status: 404 });
  }
  // Auditoria 2.10: registra antes de assinar; sem auditoria, 503 e nada assinado.
  try {
    await registrarAuditoria(u.id, 'download', 'arquivo_tarefa', id);
  } catch (e) {
    return respostaAuditoriaFora(e);
  }
  const { data, error } = await supabaseServico().storage.from(a.bucket).createSignedUrl(a.caminho, 60, { download: a.nome });
  if (error || !data) return new NextResponse(NAO_ACHEI, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
