'use server';
import { redirect } from 'next/navigation';
import { dentroDosLimites, LIMITES } from '@/lib/limite-tentativas';
import { senhaCurta } from '@/lib/senha';
import { senhaAtualConfere } from '@/lib/senha-atual';
import { lerClaims, veioDeLinkRecente } from '@/lib/sessao-limites';
import { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * Grava a senha nova. Auditoria 2.6: a rota é pública só para o fluxo do link (convite ou nova senha). Sessão aberta
 * pelo link há menos de 15 min troca direto; qualquer outra (login comum, mesmo vencida pela regra de 1 h do painel
 * mas ainda válida no Auth) precisa da senha atual, conferida antes do updateUser.
 */
export async function definirSenha(formData: FormData) {
  const senha = String(formData.get('senha') ?? '');
  if (senhaCurta(senha)) redirect('/definir-senha?erro=curta');
  const sb = await supabaseServidor();
  // O token é conferido pelo getUser antes de o amr ser lido.
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar?erro=link');
  const { data: sessao } = await sb.auth.getSession();
  const claims = sessao.session ? lerClaims(sessao.session.access_token) : null;
  if (!veioDeLinkRecente(claims, Date.now())) {
    const atual = String(formData.get('senha_atual') ?? '');
    if (!atual) redirect('/definir-senha?erro=atual');
    const email = auth.user.email ?? '';
    // A conferência é um login: entra no mesmo limite do e-mail (auditoria 2.3).
    if (!(await dentroDosLimites([[LIMITES.loginEmail, email]]))) redirect('/definir-senha?erro=tentativas');
    if (!(await senhaAtualConfere(email, atual))) redirect('/definir-senha?erro=atual_errada');
  }
  const { error } = await sb.auth.updateUser({ password: senha });
  // Segurança do login (item 8): quem já tem o aplicativo autenticador confirma o código antes de trocar a senha.
  if (error?.code === 'insufficient_aal') redirect('/segundo-fator?depois=senha');
  if (error) redirect('/definir-senha?erro=falha');
  redirect('/inicio');
}
