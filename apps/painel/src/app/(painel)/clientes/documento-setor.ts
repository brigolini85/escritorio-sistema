import type { supabaseServidor } from '@/lib/supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
export type SetorDeDocumento = { id: string; nome: string; ativo: boolean };

/**
 * Setor e "Tem valores" de um documento, do formulário (D11). null = o formulário não tem o campo (banco sem a H2).
 * `setorAtual`: o setor que o documento já tem passa mesmo fora da lista (desativado, Direção), para um Salvar só da caixa
 * "Tem valores" não trocar o setor por "da empresa" (que iria para todos os contatos com documentos). Escolher um novo fora
 * da lista continua recusado.
 */
export function lerSetorDoDocumento(
  f: FormData, setoresValidos: string[], setorAtual: string | null = null,
): { setor_id: string | null; tem_valores: boolean } | { erro: string } | null {
  if (!f.has('setor_id')) return null;
  const setor = String(f.get('setor_id') ?? '');
  if (setor && setor !== setorAtual && !setoresValidos.includes(setor)) return { erro: 'Escolha um setor da lista.' };
  return { setor_id: setor || null, tem_valores: f.get('tem_valores') === 'on' };
}

/** Setores que se escolhem para um documento: os ativos, menos Direção (D5). */
export const setoresEscolhiveis = (todos: SetorDeDocumento[]) => todos.filter((s) => s.ativo && s.nome !== 'Direção');

/** Todos os setores (inclusive desativados, para mostrar o atual pelo nome). Erro na leitura lança: nunca vira lista vazia. */
export async function lerSetoresDeDocumento(sb: Sb): Promise<SetorDeDocumento[]> {
  const { data, error } = await sb.from('setores').select('id, nome, ativo').order('nome');
  if (error || !data) throw new Error('Não foi possível ler os setores agora. Tente de novo.');
  return data;
}
