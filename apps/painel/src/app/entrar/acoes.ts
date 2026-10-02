'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_LETRA, OPCOES_COOKIE_LETRA, tamanhoDoValor } from '@/components/layout/tamanho-letra';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function entrar(formData: FormData) {
  const sb = await supabaseServidor();
  const { data, error } = await sb.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('senha') ?? ''),
  });
  if (error) redirect('/entrar?erro=credenciais');
  // Pessoa arquivada (ou sem cadastro no painel) não entra: a RLS nem deixa ler a própria linha, então perfil vem vazio.
  const { data: perfil } = await sb.from('usuarios').select('tamanho_letra, ativo').eq('id', data.user.id).maybeSingle();
  if (!perfil?.ativo) {
    await sb.auth.signOut();
    redirect('/entrar?erro=inativo');
  }
  // O tamanho da letra segue a pessoa, mesmo noutro computador.
  (await cookies()).set(COOKIE_LETRA, tamanhoDoValor(perfil.tamanho_letra), OPCOES_COOKIE_LETRA);
  redirect('/inicio');
}

export async function sair() {
  const sb = await supabaseServidor();
  await sb.auth.signOut();
  // A próxima pessoa neste navegador não herda o tamanho de letra de quem saiu.
  (await cookies()).delete(COOKIE_LETRA);
  redirect('/entrar');
}
