import 'server-only';
import { supabaseServico } from './supabase/servico';

export async function registrarAuditoria(usuarioId: string, acao: string, entidade: string, entidadeId: string, detalhes?: object): Promise<void> {
  const { error } = await supabaseServico().from('auditoria_acessos').insert({
    usuario_id: usuarioId, acao, entidade, entidade_id: entidadeId, detalhes: (detalhes ?? null) as never,
  });
  if (error) console.error('[auditoria]', error.message);
}
