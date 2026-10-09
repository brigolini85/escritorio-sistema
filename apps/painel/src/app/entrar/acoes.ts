'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_LETRA, OPCOES_COOKIE_LETRA, tamanhoDoValor } from '@/components/layout/tamanho-letra';
import { dentroDosLimites, ipDoPedido, LIMITES } from '@/lib/limite-tentativas';
import { TELA_SEGUNDO_FATOR } from '@/lib/segundo-fator';
import { COOKIE_ATIVIDADE } from '@/lib/sessao-limites';
import { lerSituacao } from '@/lib/situacao-acesso';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function entrar(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  // Auditoria 2.3: limite próprio antes do Auth (IP 5/min e 20/h, e-mail 5 em 15 min); acima dele, o Auth nem é chamado.
  const ip = await ipDoPedido();
  const liberado = await dentroDosLimites([[LIMITES.loginIpMinuto, ip], [LIMITES.loginIpHora, ip], [LIMITES.loginEmail, email]]);
  if (!liberado) redirect('/entrar?erro=tentativas');
  const sb = await supabaseServidor();
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password: String(formData.get('senha') ?? ''),
  });
  if (error) redirect('/entrar?erro=credenciais');
  // Arquivada, sem cadastro ou fora do horário não entra; a mesma função do middleware decide (e marca o último acesso).
  const situacao = lerSituacao(await sb.rpc('situacao_acesso'), 'entrar');
  // Erro do banco não é "acesso desativado": pede para tentar de novo e não desloga quem pode estar ativo.
  if (situacao === 'indisponivel') redirect('/entrar?erro=indisponivel');
  if (situacao !== 'liberado') {
    await sb.auth.signOut();
    redirect(situacao === 'fora_do_horario' ? '/entrar?erro=fora_do_horario' : '/entrar?erro=inativo');
  }
  // O tamanho da letra segue a pessoa, mesmo noutro computador.
  const { data: perfil } = await sb.from('usuarios').select('tamanho_letra').eq('id', data.user.id).maybeSingle();
  (await cookies()).set(COOKIE_LETRA, tamanhoDoValor(perfil?.tamanho_letra), OPCOES_COOKIE_LETRA);
  // Segurança do login (item 8): administrador e quem vê acessos de portais confirmam o código do aplicativo antes.
  const { data: exige } = await sb.rpc('exige_segundo_fator');
  redirect(exige === true ? TELA_SEGUNDO_FATOR : '/inicio');
}

export async function sair() {
  const sb = await supabaseServidor();
  await sb.auth.signOut();
  // A próxima pessoa neste navegador não herda o tamanho de letra de quem saiu.
  const loja = await cookies();
  loja.delete(COOKIE_LETRA);
  loja.delete(COOKIE_ATIVIDADE);
  redirect('/entrar');
}
