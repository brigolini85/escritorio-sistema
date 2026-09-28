'use server';
import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function entrar(formData: FormData) {
  const sb = await supabaseServidor();
  const { error } = await sb.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('senha') ?? ''),
  });
  if (error) redirect('/entrar?erro=credenciais');
  redirect('/inicio');
}

export async function sair() {
  const sb = await supabaseServidor();
  await sb.auth.signOut();
  redirect('/entrar');
}
