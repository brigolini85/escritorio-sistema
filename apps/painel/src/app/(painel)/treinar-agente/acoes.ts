'use server';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams } from '@/lib/tabela-url';
import { destinoDaTela, ehUuid, OrientacaoForm } from './esquemas';

const SEM_PERMISSAO = 'Você não tem permissão para treinar o agente.';

/** Sessão de quem pode treinar o agente. O banco confere de novo (funções salvar/alternar/restaurar_orientacao). */
async function exigirTreinar() {
  const u = await obterUsuario();
  if (!temPermissao(u, 'treinar_agente')) throw new Error(SEM_PERMISSAO);
  return supabaseServidor();
}

/** O mesmo endereço (filtros da lista) com outro painel aberto. */
function comOrientacao(destino: string, mudancas: Record<string, string | null>): string {
  const busca = new URLSearchParams(destino.split('?')[1] ?? '');
  return `/treinar-agente${hrefComParams(Object.fromEntries(busca), { ...mudancas, erro: null })}`;
}

/**
 * Cria (id null) ou edita a orientação com o cliente da pessoa (salvar_orientacao grava a versão e a auditoria).
 * Criou: abre o painel da orientação nova. Erro: volta para `voltar` com ?erro=.
 */
export async function salvarOrientacao(id: string | null, voltar: string, formData: FormData) {
  const destino = destinoDaTela(voltar);
  await comAvisoDeErro(destino, async () => {
    const sb = await exigirTreinar();
    const d = OrientacaoForm.parse(formData);
    if (id !== null && !ehUuid(id)) throw new Error('Orientação não encontrada.');
    const { data, error } = await sb.rpc('salvar_orientacao', {
      // Para criar, o banco recebe null (o tipo gerado marca p_id como obrigatório por vir antes dos que têm padrão).
      p_id: id as unknown as string,
      p_titulo: d.titulo, p_texto: d.texto, p_tipo: d.tipo,
      p_cliente_id: d.clienteId ?? undefined, p_setor_id: d.setorId ?? undefined, p_ativo: d.ativo,
    });
    if (error) throw new Error(error.message);
    if (id === null) {
      revalidatePath('/treinar-agente');
      redirect(comOrientacao(destino, { orientacao: data, modelo: null }));
    }
  });
}

/**
 * Chave da tabela. Devolve o motivo em vez de lançar (em produção o Next esconde a mensagem de um erro lançado):
 * a chave volta ao estado anterior e o aviso mostra o motivo (ex.: empresa inativa).
 */
export async function alternarOrientacao(id: string, ativo: boolean): Promise<{ erro: string | null }> {
  try {
    const sb = await exigirTreinar();
    if (!ehUuid(id)) throw new Error('Orientação não encontrada.');
    const { error } = await sb.rpc('alternar_orientacao', { p_id: id, p_ativo: ativo });
    if (error) throw new Error(error.message);
  } catch (e) {
    unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
    return { erro: e instanceof Error ? e.message : 'Não foi possível mudar a orientação.' };
  }
  revalidatePath('/treinar-agente');
  return { erro: null };
}

/** Volta título, texto, tipo e "vale para" de uma versão; ligada/desligada continua como está (restaurar_orientacao). */
export async function restaurarVersao(versaoId: string, voltar: string) {
  await comAvisoDeErro(destinoDaTela(voltar), async () => {
    const sb = await exigirTreinar();
    if (!ehUuid(versaoId)) throw new Error('Versão não encontrada.');
    const { error } = await sb.rpc('restaurar_orientacao', { p_versao_id: versaoId });
    if (error) throw new Error(error.message);
  });
}
