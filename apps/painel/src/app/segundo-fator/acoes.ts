'use server';
import { redirect } from 'next/navigation';
import { NOME_ESCRITORIO } from '@/lib/escritorio';
import { codigoDoFormulario, destinoDepoisDoFator, TELA_SEGUNDO_FATOR } from '@/lib/segundo-fator';
import { supabaseServidor } from '@/lib/supabase/servidor';

export type EstadoFator = { erro: string | null };

const CODIGO_INVALIDO = 'Digite os 6 números que aparecem no aplicativo.';
const CODIGO_ERRADO = 'Código incorreto ou vencido. Confira se a hora do celular está certa e digite o código novo.';

/** Confere o código no Supabase; certo, a sessão sobe para aal2 (cookies novos) e segue para o destino fixo. */
async function verificar(factorId: string, formData: FormData, cadastro = false): Promise<EstadoFator> {
  const codigo = codigoDoFormulario(formData.get('codigo'));
  if (!codigo) return { erro: CODIGO_INVALIDO };
  const sb = await supabaseServidor();
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: codigo });
  if (error) {
    console.error('[segundo-fator] código recusado', error.message);
    return { erro: CODIGO_ERRADO };
  }
  if (cadastro) {
    // Auditoria 2.5: aplicativo novo vira aviso ao dono e linha na auditoria. Falha aqui não impede a entrada.
    const { error: erroRegistro } = await sb.rpc('registrar_fator_cadastrado');
    if (erroRegistro) console.error('[segundo-fator] registro do cadastro', erroRegistro.message);
  }
  redirect(destinoDepoisDoFator(formData.get('depois')));
}

/** Primeiro uso: confirma o aplicativo recém-cadastrado (o fator que está na tela). */
export async function cadastrarAplicativo(_: EstadoFator, formData: FormData): Promise<EstadoFator> {
  const fator = String(formData.get('fator') ?? '');
  if (!fator) redirect(TELA_SEGUNDO_FATOR);
  return verificar(fator, formData, true);
}

/** Login de quem já tem o aplicativo: confere com o fator cadastrado da própria pessoa. */
export async function conferirCodigo(_: EstadoFator, formData: FormData): Promise<EstadoFator> {
  const sb = await supabaseServidor();
  const { data } = await sb.auth.mfa.listFactors();
  const fator = data?.totp?.find((f) => f.status === 'verified');
  if (!fator) redirect(TELA_SEGUNDO_FATOR);
  return verificar(fator.id, formData);
}

export type CadastroPreparado = { ok: true; fator: string; qr: string; segredo: string } | { ok: false; erro: string };

/**
 * Prepara o cadastro do aplicativo (QR code e chave). É uma ação chamada pelo botão, não parte da tela: assim a tela
 * pode recarregar (código errado, por exemplo) sem trocar o QR code que a pessoa já leu.
 */
export async function prepararCadastro(): Promise<CadastroPreparado> {
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect('/entrar');
  const { data: exige, error: erroExige } = await sb.rpc('exige_segundo_fator');
  if (erroExige) return { ok: false, erro: 'Não consegui conferir seu acesso agora. Tente de novo em instantes.' };
  if (!exige) redirect('/inicio');
  const { data: fatores } = await sb.auth.mfa.listFactors();
  if (fatores?.totp?.some((f) => f.status === 'verified')) redirect(TELA_SEGUNDO_FATOR);
  // Cadastros que ficaram pela metade saem antes (o Supabase limita quantos cada pessoa tem).
  for (const f of fatores?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', issuer: NOME_ESCRITORIO, friendlyName: `Aplicativo ${new Date().toISOString()}` });
  if (error || !data) {
    console.error('[segundo-fator] cadastro', error?.message);
    return { ok: false, erro: 'Não consegui preparar o aplicativo. Tente de novo em instantes; se continuar, fale com o administrador.' };
  }
  return { ok: true, fator: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
}
