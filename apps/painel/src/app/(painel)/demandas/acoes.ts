'use server';
import { revalidatePath } from 'next/cache';
import { ROTULO_PRIORIDADE, ROTULO_STATUS, type Prioridade, type Visao } from '@/lib/demandas';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { campoDoErro, validarNovaDemanda, type CampoNova } from '@/lib/nova-demanda';
import { ehPedidoDeNota } from '@/lib/pedido-nota';
import { temNivel } from '@/lib/permissoes';
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
  // Prazo à mão exige "Alterar prazos" (P10); o banco também recusa.
  if (!temNivel(await obterUsuario(), 'prazos', 'sim')) return { ok: false, erro: 'Você não tem permissão para alterar prazos.' };
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
  const u = await obterUsuario();
  const sb = await supabaseServidor();
  const { data: atual, error: erroLeitura } = await sb.from('chamados').select('titulo, resumo, contato_id, pedido_venda').eq('id', id).maybeSingle();
  if (erroLeitura) {
    console.error('[demandas] falha ao ler a demanda para editar', erroLeitura);
    return { ok: false, erro: 'Não consegui salvar agora. Tente de novo.' };
  }
  if (!atual) return { ok: false, erro: mensagemDoBanco('sem acesso a este chamado') };
  // "Pedidos de nota: Sem acesso" (P11): a tela não mostra a descrição do pedido, então também não a troca.
  if (dados.descricao !== undefined && !temNivel(u, 'notas', 'ver') && ehPedidoDeNota(atual)) return { ok: false, erro: 'Você não tem acesso a pedidos de nota.' };
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

export type NovaDemandaDados = {
  cliente: string; setor: string; titulo: string; descricao: string; prioridade: Prioridade;
  /** Valor do datetime-local; vazio = o prazo sugerido pelo banco. */
  prazo: string; responsavel: string; contato: string;
  /** Abrir demanda a partir do Atendimento (spec 7A.1). */
  conversa?: string;
};

/** Nova demanda pela equipe (origem equipe). Erro volta com o campo, para aparecer nele sem perder o que foi digitado. */
export async function criarDemanda(d: NovaDemandaDados): Promise<{ ok: true; mensagem: string; id: string } | { ok: false; erro: string; campo?: CampoNova }> {
  const v = validarNovaDemanda(d);
  if (!v.ok) return v;
  const prazo = d.prazo ? doCampoDataHora(d.prazo) : null;
  if (d.prazo && !prazo) return { ok: false, erro: 'Escolha a data e a hora do prazo.', campo: 'prazo' };
  const u = await obterUsuario();
  if (d.prazo && !temNivel(u, 'prazos', 'sim')) return { ok: false, erro: 'Você não tem permissão para alterar prazos.', campo: 'prazo' };
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('criar_demanda' as never, {
    p_cliente: d.cliente, p_setor: d.setor, p_titulo: d.titulo, p_descricao: d.descricao, p_prioridade: d.prioridade,
    p_prazo: prazo, p_responsavel: d.responsavel || null, p_contato: d.contato || null,
    // A função de 9 parâmetros não tem defaults: as 9 chaves vão sempre.
    p_conversa: d.conversa || null,
  } as never);
  if (error) {
    const erro = mensagemDoBanco(error.message);
    return { ok: false, erro, campo: campoDoErro(erro) };
  }
  const nova = data as unknown as { id: string; numero: number };
  revalidatePath('/demandas');
  return { ok: true, mensagem: `Demanda #${nova.numero} aberta.`, id: nova.id };
}

/** Contatos ativos da empresa escolhida na nova demanda (RLS: qualquer pessoa ativa lê contatos). */
export async function contatosDaEmpresa(clienteId: string): Promise<{ id: string; nome: string }[]> {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { data } = await sb.from('contato_clientes').select('contatos!inner(id, nome, ativo)').eq('cliente_id', clienteId).eq('contatos.ativo', true);
  return (data ?? []).map((v) => ({ id: v.contatos.id, nome: v.contatos.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
