import type { UsuarioAssistente } from '@escritorio/db';

/** Igual a pode_ver_chamado do banco: admin vê tudo; os demais, os setores deles e o que são responsáveis. */
export function podeVerChamado(u: UsuarioAssistente, c: { setor_id: string | null; responsavel_id: string | null }): boolean {
  return u.papel === 'admin' || c.responsavel_id === u.id || (c.setor_id !== null && u.setores.includes(c.setor_id));
}

export function podeCorrigirPedidos(u: UsuarioAssistente): boolean {
  return u.papel === 'admin' || u.permissoes.includes('emitir_notas');
}
