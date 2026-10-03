import 'server-only';
import { lerNiveis, type Niveis } from '@escritorio/core';
import { redirect } from 'next/navigation';
import { tamanhoDoValor, type TamanhoLetra } from '@/components/layout/tamanho-letra';
import { temNivel } from './permissoes';
import { destinoSemAcesso, lerSituacao } from './situacao-acesso';
import { supabaseServidor } from './supabase/servidor';

export type UsuarioPainel = { id: string; nome: string; papel: 'admin' | 'atendente'; niveis: Niveis; setores: string[]; tamanhoLetra: TamanhoLetra };

export async function obterUsuario(): Promise<UsuarioPainel> {
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar');
  const { data: u, error: erroLinha } = await sb.from('usuarios')
    .select('id, nome, papel, ativo, tamanho_letra, usuario_setores(setor_id), usuario_permissoes(modulo, nivel)')
    .eq('id', auth.user.id).maybeSingle();
  if (!u || !u.ativo) {
    // Fora do horário a RLS também esconde a própria linha: a situação diz qual dos dois casos é.
    // Erro do banco é falha passageira: "tente de novo", nunca "acesso desativado", e ninguém é deslogado.
    if (erroLinha) console.error('[sessao] leitura do usuário', erroLinha.message);
    const situacao = lerSituacao(await sb.rpc('situacao_acesso'), 'sessao');
    redirect(erroLinha && situacao !== 'fora_do_horario' ? '/entrar?erro=indisponivel' : destinoSemAcesso(situacao));
  }
  return {
    id: u.id, nome: u.nome, papel: u.papel,
    niveis: lerNiveis(Object.fromEntries(u.usuario_permissoes.map((p) => [p.modulo, p.nivel]))),
    setores: u.usuario_setores.map((s) => s.setor_id), tamanhoLetra: tamanhoDoValor(u.tamanho_letra),
  };
}

export async function exigirAdmin(): Promise<UsuarioPainel> {
  const u = await obterUsuario();
  if (u.papel !== 'admin') redirect('/inicio');
  return u;
}

/** Configurações (P12): administrador ou "Configurações: Sim". */
export async function exigirConfiguracoes(): Promise<UsuarioPainel> {
  const u = await obterUsuario();
  if (!temNivel(u, 'configuracoes', 'sim')) redirect('/inicio');
  return u;
}
