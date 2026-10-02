import 'server-only';
import type { CodigoAviso } from './avisos';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
type Resultado = { id: string; reativado: boolean; vinculos_removidos: number; vinculos_mantidos?: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aviso para a tela: só quando um contato arquivado voltou (o ativo e o novo seguem calados, como antes). */
export function avisoDoCadastro(r: Omit<Resultado, 'id'>, comEmpresa: boolean): CodigoAviso | null {
  if (!r.reativado) return null;
  if ((r.vinculos_mantidos ?? 0) > 0) return r.vinculos_removidos > 0 ? 'contato-voltou-com-empresas-outras-sairam' : 'contato-voltou-com-empresas';
  if (r.vinculos_removidos === 0) return 'contato-voltou';
  return comEmpresa ? 'contato-voltou-vinculos-sairam' : 'contato-voltou-sem-empresas';
}

/** Empresas de antes marcadas na pergunta (campo "manter"); o banco confere de novo quais podem voltar. */
export function lerManter(formData: FormData): string[] {
  return [...new Set(formData.getAll('manter').map(String).filter((v) => UUID.test(v)))];
}

/**
 * Cadastra o contato pelo telefone (aba Contatos, ficha da empresa e conversa usam este mesmo caminho).
 * Telefone de contato arquivado traz o contato de volta só com as empresas de antes escolhidas (`manter`); o banco
 * faz isso numa transação só, com a linha travada. O vínculo com `clienteId` é criado depois pela ação, com as
 * permissões escolhidas agora.
 */
export async function cadastrarContatoPeloTelefone(sb: Sb, dados: {
  nome: string; telefone: string; clienteId?: string | null; agentePausado?: boolean; manter?: string[];
}): Promise<{ id: string; aviso: CodigoAviso | null }> {
  const { data, error } = await sb.rpc('cadastrar_contato', {
    p_nome: dados.nome, p_telefone: dados.telefone, p_cliente: dados.clienteId ?? undefined, p_agente_pausado: dados.agentePausado,
    p_manter: dados.manter?.length ? dados.manter : undefined,
  });
  if (error) throw new Error(error.message);
  const r = data as Resultado;
  return { id: r.id, aviso: avisoDoCadastro(r, Boolean(dados.clienteId)) };
}
