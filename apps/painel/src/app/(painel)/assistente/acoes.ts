'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { enfileirarAssistente } from '@/lib/fila';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const Pergunta = z.string().trim().min(1, 'Escreva a pergunta').max(4000, 'Pergunta longa demais');

export async function perguntarAoAssistente(conversaId: string | null, formData: FormData) {
  const destino = conversaId ? `/atendimento/${conversaId}` : '/assistente';
  await comAvisoDeErro(destino, async () => {
    const u = await obterUsuario();
    if (!u.permissoes.includes('assistente_site')) throw new Error('Você não tem acesso ao assistente. Peça ao administrador na aba Usuários.');
    const conteudo = Pergunta.parse(formData.get('pergunta'));
    const sb = await supabaseServidor();
    const { error } = await sb.from('assistente_mensagens').insert({ usuario_id: u.id, canal: 'site', conversa_id: conversaId, papel: 'usuario', conteudo });
    if (error) {
      console.error('[assistente] falha ao gravar a pergunta', error);
      throw new Error(error.code === '42501' || error.code === '22P02' ? 'Sem acesso a esta conversa.' : 'Não foi possível enviar a pergunta. Tente de novo.');
    }
    await enfileirarAssistente({ usuarioId: u.id, conversaId });
  });
  revalidatePath(destino);
}
