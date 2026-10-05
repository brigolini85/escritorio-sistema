import type { supabaseServidor } from '@/lib/supabase/servidor';
import { semMigracaoH2 } from '@/lib/acesso-contato';

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

export type DocumentoDaEmpresa = { id: string; nome: string; arquivo_nome: string; ia_pode_enviar: boolean; setor_id?: string | null; tem_valores?: boolean };

/**
 * Documentos com setor e "Tem valores" (H2, D11); banco sem a migração (código do erro, D24): como antes, sem setor.
 * Erro de verdade: null. A tela avisa e esconde o envio (um envio sem o campo de setor viraria "da empresa").
 */
export async function lerDocumentosDaEmpresa(sb: Sb, id: string): Promise<{ lista: DocumentoDaEmpresa[]; comSetor: boolean } | null> {
  const novo = await sb.from('documentos_empresa').select('id, nome, arquivo_nome, ia_pode_enviar, setor_id, tem_valores').eq('cliente_id', id).order('nome');
  if (!novo.error) return { lista: novo.data ?? [], comSetor: true };
  if (!semMigracaoH2(novo.error)) {
    console.error('[documentos] falha ao ler os documentos', novo.error);
    return null;
  }
  const antigo = await sb.from('documentos_empresa').select('id, nome, arquivo_nome, ia_pode_enviar').eq('cliente_id', id).order('nome');
  if (antigo.error) {
    console.error('[documentos] falha ao ler os documentos', antigo.error);
    return null;
  }
  return { lista: antigo.data ?? [], comSetor: false };
}
