import 'server-only';
import type { CodigoAviso } from './avisos';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
type Resultado = { id: string; reativado: boolean; vinculos_removidos: number };

/** Aviso para a tela: só quando um contato arquivado voltou (o ativo e o novo seguem calados, como antes). */
export function avisoDoCadastro(r: Omit<Resultado, 'id'>, comEmpresa: boolean): CodigoAviso | null {
  if (!r.reativado) return null;
  if (r.vinculos_removidos === 0) return 'contato-voltou';
  return comEmpresa ? 'contato-voltou-vinculos-sairam' : 'contato-voltou-sem-empresas';
}

/**
 * Cadastra o contato pelo telefone (aba Contatos, ficha da empresa e conversa usam este mesmo caminho).
 * Telefone de contato arquivado traz o contato de volta sem os vínculos antigos; o banco faz isso numa transação só,
 * com a linha travada, para dois cadastros ao mesmo tempo não apagarem o vínculo um do outro.
 * O vínculo com `clienteId` (se houver) é criado depois pela ação, com as permissões escolhidas agora.
 */
export async function cadastrarContatoPeloTelefone(sb: Sb, dados: {
  nome: string; telefone: string; clienteId?: string | null; agentePausado?: boolean;
}): Promise<{ id: string; aviso: CodigoAviso | null }> {
  const { data, error } = await sb.rpc('cadastrar_contato', {
    p_nome: dados.nome, p_telefone: dados.telefone, p_cliente: dados.clienteId ?? undefined, p_agente_pausado: dados.agentePausado,
  });
  if (error) throw new Error(error.message);
  const r = data as Resultado;
  return { id: r.id, aviso: avisoDoCadastro(r, Boolean(dados.clienteId)) };
}
