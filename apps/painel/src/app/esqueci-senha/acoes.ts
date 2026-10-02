'use server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { destinoDoPedido } from './destino';

/** Manda o e-mail de recuperação; e-mail desconhecido tem a mesma resposta (não revela quem é cadastrado), mas falha de envio é avisada. */
export async function pedirNovaSenha(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const origem = (await headers()).get('origin') ?? '';
  let falhou = false;
  if (email) {
    try {
      const { error } = await (await supabaseServidor()).auth.resetPasswordForEmail(email, { redirectTo: `${origem}/auth/confirm` });
      falhou = !!error;
    } catch {
      falhou = true;
    }
  }
  redirect(destinoDoPedido(falhou));
}
