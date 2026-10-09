import 'server-only';
import { supabaseServico } from './supabase/servico';

/**
 * Grava uma linha em auditoria_acessos. Auditoria 2.10: a falha lança (antes só ia para o log e o download saía sem
 * rastro). Download responde 503 sem o arquivo; quem não pode desfazer o que já fez pega o erro e segue.
 */
export async function registrarAuditoria(usuarioId: string, acao: string, entidade: string, entidadeId: string, detalhes?: object): Promise<void> {
  const { error } = await supabaseServico().from('auditoria_acessos').insert({
    usuario_id: usuarioId, acao, entidade, entidade_id: entidadeId, detalhes: (detalhes ?? null) as never,
  });
  if (error) {
    console.error('[auditoria]', error.message);
    throw new Error(`Auditoria não gravada: ${error.message}`);
  }
}
