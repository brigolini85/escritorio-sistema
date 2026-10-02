'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Manda o e-mail de recuperação; a resposta é a mesma exista ou não a conta (não revela quem é cadastrado). */
export async function pedirNovaSenha(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const origem = (await headers()).get('origin') ?? '';
  if (email) await (await supabaseServidor()).auth.resetPasswordForEmail(email, { redirectTo: `${origem}/auth/confirm` });
  redirect('/esqueci-senha?enviado=1');
}
