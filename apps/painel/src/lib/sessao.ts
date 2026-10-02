import 'server-only';
import { redirect } from 'next/navigation';
import { tamanhoDoValor, type TamanhoLetra } from '@/components/layout/tamanho-letra';
import { supabaseServidor } from './supabase/servidor';

export type UsuarioPainel = { id: string; nome: string; papel: 'admin' | 'atendente'; permissoes: string[]; setores: string[]; tamanhoLetra: TamanhoLetra };

export async function obterUsuario(): Promise<UsuarioPainel> {
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar');
  const { data: u } = await sb.from('usuarios').select('id, nome, papel, permissoes, ativo, tamanho_letra, usuario_setores(setor_id)').eq('id', auth.user.id).maybeSingle();
  if (!u || !u.ativo) redirect('/entrar?erro=inativo');
  return { id: u.id, nome: u.nome, papel: u.papel, permissoes: u.permissoes, setores: u.usuario_setores.map((s) => s.setor_id), tamanhoLetra: tamanhoDoValor(u.tamanho_letra) };
}

export async function exigirAdmin(): Promise<UsuarioPainel> {
  const u = await obterUsuario();
  if (u.papel !== 'admin') redirect('/inicio');
  return u;
}

export function temPermissao(u: UsuarioPainel, p: string): boolean {
  return u.papel === 'admin' || u.permissoes.includes(p);
}
