'use server';

import { pastaDoLink } from '@escritorio/core';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const LINK_INVALIDO = 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).';
const FALHA = 'Não consegui salvar a pasta agora. Tente de novo.';

/** D8: o bloco Arquivos salva sozinho. O link vira o código aqui; o banco confere de novo (permissão, formato, uma pasta por cliente). */
export async function salvarPastaDrive(clienteId: string, texto: string): Promise<{ ok: true; pasta: string | null } | { ok: false; erro: string }> {
  await obterUsuario();
  if (!z.string().uuid().safeParse(clienteId).success) return { ok: false, erro: 'Cliente não encontrado.' };
  const limpo = texto.trim();
  const pasta = limpo ? pastaDoLink(limpo) : null;
  if (limpo && !pasta) return { ok: false, erro: LINK_INVALIDO };
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('salvar_pasta_drive', { p_cliente: clienteId, p_pasta: pasta as string });
  if (error) {
    if (error.code === 'P0001') return { ok: false, erro: error.message };
    console.error('[ficha] pasta do Drive', error.code, error.message);
    return { ok: false, erro: FALHA };
  }
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true, pasta: (data as string | null) ?? null };
}
