'use server';
import { redirect } from 'next/navigation';
import { painelUrl } from '@/lib/ambiente-servidor';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { destinoDoPedido } from './destino';

/**
 * Manda o e-mail de recuperação; e-mail desconhecido tem a mesma resposta (não revela quem é cadastrado), mas falha de envio é avisada.
 * Segurança do login (item 4): o endereço de volta é o PAINEL_URL conferido, nunca o cabeçalho Origin de quem pede.
 */
export async function pedirNovaSenha(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  let falhou = false;
  if (email) {
    try {
      const destino = `${painelUrl()}/auth/confirm`;
      const { error } = await (await supabaseServidor()).auth.resetPasswordForEmail(email, { redirectTo: destino });
      falhou = !!error;
    } catch (e) {
      console.error('[esqueci-senha] pedido não enviado', e instanceof Error ? e.message : e);
      falhou = true;
    }
  }
  redirect(destinoDoPedido(falhou));
}
