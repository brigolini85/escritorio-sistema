'use server';
import { revalidatePath } from 'next/cache';
import { ROTULO_PRIORIDADE, ROTULO_STATUS, type Prioridade, type Visao } from '@/lib/demandas';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { doCampoDataHora } from '@/lib/prazo';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Resultado das ações do painel lateral, do quadro e da linha: vira aviso rápido (toast) na tela. */
export type Resultado = { ok: true; mensagem: string } | { ok: false; erro: string };
type StatusAberto = 'aberto' | 'em_andamento' | 'aguardando_cliente';

/** Chama a função do banco (que confere acesso e grava o evento) e devolve a mensagem dele na língua da tela. */
async function acao(nome: string, args: Record<string, unknown>, mensagem: string): Promise<Resultado> {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { error } = await sb.rpc(nome as never, args as never);
  if (error) return { ok: false, erro: mensagemDoBanco(error.message) };
  revalidatePath('/demandas');
  return { ok: true, mensagem };
}

export async function assumirDemanda(id: string): Promise<Resultado> {
  return acao('assumir_demanda', { p_chamado: id }, 'Demanda assumida.');
}

export async function definirResponsavel(id: string, responsavel: string | null): Promise<Resultado> {
  return acao('definir_responsavel', { p_chamado: id, p_responsavel: responsavel }, responsavel ? 'Responsável alterado.' : 'Demanda sem responsável.');
}

export async function alterarStatusDemanda(id: string, status: StatusAberto): Promise<Resultado> {
  return acao('alterar_status_chamado', { p_chamado: id, p_status: status }, `Status: ${ROTULO_STATUS[status]}.`);
}

/** Prioridade nova recalcula o prazo a partir de agora (P4). */
export async function definirPrioridade(id: string, prioridade: Prioridade): Promise<Resultado> {
  return acao('definir_prioridade_prazo', { p_chamado: id, p_prioridade: prioridade }, `Prioridade ${ROTULO_PRIORIDADE[prioridade]}. Prazo recalculado.`);
}

/** `campo`: valor do <input type="datetime-local">, no horário de Brasília. */
export async function definirPrazo(id: string, campo: string): Promise<Resultado> {
  const iso = doCampoDataHora(campo);
  if (!iso) return { ok: false, erro: 'Escolha a data e a hora do prazo.' };
  return acao('definir_prioridade_prazo', { p_chamado: id, p_prazo: iso }, 'Prazo alterado.');
}

export async function notaInternaDemanda(id: string, texto: string): Promise<Resultado> {
  const t = texto.trim();
  if (!t) return { ok: false, erro: 'Escreva a nota.' };
  return acao('nota_interna', { p_chamado: id, p_texto: t }, 'Nota interna registrada.');
}

export async function transferirDemanda(id: string, setor: string, responsavel: string | null): Promise<Resultado> {
  if (!setor) return { ok: false, erro: 'Escolha o setor.' };
  return acao('transferir_chamado', { p_chamado: id, p_setor: setor, p_responsavel: responsavel }, 'Demanda transferida.');
}

export async function concluirDemanda(id: string): Promise<Resultado> {
  return acao('concluir_chamado', { p_chamado: id }, 'Demanda concluída.');
}

export async function reabrirDemanda(id: string): Promise<Resultado> {
  return acao('reabrir_demanda', { p_chamado: id }, 'Demanda reaberta.');
}

/**
 * Título, descrição e contato. Campo que não veio é lido do banco na hora: o painel pode estar com dados de antes da última
 * gravação e não pode desfazê-la. O banco trata p_contato nulo como "remover o contato", então o contato SEMPRE vai
 * (o atual, ou a escolha da pessoa; `null` explícito remove).
 */
export async function editarDemanda(id: string, dados: { titulo?: string; descricao?: string; contato?: string | null }): Promise<Resultado> {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { data: atual, error: erroLeitura } = await sb.from('chamados').select('titulo, resumo, contato_id').eq('id', id).maybeSingle();
  if (erroLeitura) {
    console.error('[demandas] falha ao ler a demanda para editar', erroLeitura);
    return { ok: false, erro: 'Não consegui salvar agora. Tente de novo.' };
  }
  if (!atual) return { ok: false, erro: mensagemDoBanco('sem acesso a este chamado') };
  const args = {
    p_chamado: id,
    p_titulo: dados.titulo ?? atual.titulo,
    p_descricao: dados.descricao ?? atual.resumo,
    p_contato: dados.contato === undefined ? atual.contato_id : dados.contato,
  };
  return acao('editar_demanda', args, 'Demanda alterada.');
}

/** Tabela ou Quadro fica no perfil da pessoa (decisão 16). */
export async function definirVisaoDemandas(visao: Visao): Promise<Resultado> {
  return acao('definir_visao_demandas', { p_visao: visao }, visao === 'quadro' ? 'Quadro.' : 'Tabela.');
}
