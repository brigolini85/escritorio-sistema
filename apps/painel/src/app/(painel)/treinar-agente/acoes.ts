'use server';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { SLUG_ATENDIMENTO } from '@escritorio/core';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { enfileirarSimulacao } from '@/lib/fila';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams } from '@/lib/tabela-url';
import { comporTexto } from './ensinar';
import { destinoDaTela, ehUuid, OrientacaoForm, slugDoDestino, type DadosOrientacao } from './esquemas';
import {
  ERRO_BANCO_PENDENTE, MENSAGEM_FALHA_TESTE, MENSAGEM_FILA_FORA, MENSAGEM_TESTE_PENDENTE, PedidoTeste,
} from './simulacao';

const SEM_PERMISSAO = 'Você não tem permissão para treinar o agente.';
const FALHA_SALVAR = 'Não foi possível salvar a orientação. Tente de novo em alguns minutos.';
const FALHA_CRIAR = 'Não foi possível criar a orientação. Tente de novo em alguns minutos.';
const FALHA_ALTERNAR = 'Não foi possível mudar a orientação. Tente de novo em alguns minutos.';
const FALHA_RESTAURAR = 'Não foi possível restaurar a versão. Tente de novo em alguns minutos.';
/** O texto de exigir_segundo_fator() no banco (42501). */
const AVISO_SEGUNDO_FATOR = 'Confirme o código do aplicativo autenticador para continuar.';

/** Erro com texto já pensado para a pessoa (permissão, validação do banco). Os outros viram uma mensagem padrão. */
class AvisoTreinar extends Error {}

/**
 * Erro de uma função do banco: P0001 (raise exception) traz mensagem em português escrita para a pessoa; o resto vai
 * para o log e vira a mensagem padrão da ação.
 */
function avisoDoBanco(error: { code?: string; message: string }, log: string, padrao: string): AvisoTreinar {
  if (error.code === 'P0001') return new AvisoTreinar(mensagemDoBanco(error.message));
  // Auditoria 5.1: treinar pede o segundo fator; sessão sem o código confirmado lê o motivo, não a mensagem padrão.
  if (error.code === '42501' && error.message === AVISO_SEGUNDO_FATOR) return new AvisoTreinar(AVISO_SEGUNDO_FATOR);
  console.error(`[treinar-agente] ${log}`, error);
  return new AvisoTreinar(padrao);
}

/** Sessão de quem pode treinar o agente (a pessoa e o cliente dela). O banco confere de novo nas funções. */
async function sessaoTreinar() {
  const u = await obterUsuario();
  if (!temNivel(u, 'treinar', 'sim')) throw new AvisoTreinar(SEM_PERMISSAO);
  return { u, sb: await supabaseServidor() };
}

/** Cliente de quem pode treinar o agente (funções salvar/alternar/restaurar_orientacao conferem de novo). */
async function exigirTreinar() {
  return (await sessaoTreinar()).sb;
}

/** O mesmo endereço (filtros da lista) com outro painel aberto. */
function comOrientacao(destino: string, mudancas: Record<string, string | null>): string {
  const busca = new URLSearchParams(destino.split('?')[1] ?? '');
  return `${destino.split('?')[0]}${hrefComParams(Object.fromEntries(busca), { ...mudancas, erro: null })}`;
}

/**
 * Cria (id null) ou edita a orientação com o cliente de quem pode treinar o agente (salvar_orientacao confere tudo de
 * novo e grava a versão e a auditoria). Devolve o id. Usada pela tela e pelo "Ensinar o agente" do Atendimento.
 */
async function gravarOrientacao(sb: Awaited<ReturnType<typeof exigirTreinar>>, id: string | null, d: DadosOrientacao, slug = 'atendimento'): Promise<string> {
  if (id !== null && !ehUuid(id)) throw new AvisoTreinar('Orientação não encontrada.');
  const campos = {
    // Para criar, o banco recebe null (o tipo gerado marca p_id como obrigatório por vir antes dos que têm padrão).
    p_id: id as unknown as string,
    p_titulo: d.titulo, p_texto: d.texto, p_tipo: d.tipo,
    p_cliente_id: d.clienteId ?? undefined, p_setor_id: d.setorId ?? undefined, p_ativo: d.ativo,
  };
  const { data, error } = slug === 'atendimento'
    ? await sb.rpc('salvar_orientacao', campos)
    : await sb.rpc('salvar_orientacao_agente', { p_slug: slug, ...campos });
  if (error) throw avisoDoBanco(error, 'falha ao salvar a orientação', FALHA_SALVAR);
  return data;
}

/**
 * Cria (id null) ou edita a orientação (gravarOrientacao).
 * Criou: abre o painel da orientação nova. Erro: volta para `voltar` com ?erro=.
 */
export async function salvarOrientacao(id: string | null, voltar: string, formData: FormData) {
  const destino = destinoDaTela(voltar);
  await comAvisoDeErro(destino, async () => {
    const sb = await exigirTreinar();
    const data = await gravarOrientacao(sb, id, OrientacaoForm.parse(formData), slugDoDestino(destino));
    if (id === null) {
      revalidatePath('/treinar-agente'); revalidatePath('/agentes', 'layout');
      redirect(comOrientacao(destino, { orientacao: data, modelo: null }));
    }
  });
}

/**
 * "Ensinar o agente" (Atendimento): cria a orientação a partir da conversa. Campos do Dialog: situacao, fazer, titulo,
 * tipo, vale, cliente_id, ativo. O texto é composto aqui ("Situação: …\nO que fazer: …", com < e > neutralizados) e
 * segue pelo mesmo caminho da tela (OrientacaoForm + gravarOrientacao). Devolve o id ou o motivo, sem lançar: o
 * Dialog mantém o que foi digitado.
 */
export async function ensinarAgente(formData: FormData): Promise<{ id: string } | { erro: string }> {
  try {
    const sb = await exigirTreinar();
    const fazer = formData.get('fazer');
    if (typeof fazer !== 'string' || !fazer.trim()) return { erro: 'Escreva o que o agente deve fazer.' };
    const situacao = formData.get('situacao');
    const dados = new FormData();
    for (const k of ['titulo', 'tipo', 'vale', 'cliente_id', 'ativo']) {
      const v = formData.get(k);
      if (typeof v === 'string') dados.set(k, v);
    }
    dados.set('texto', comporTexto(typeof situacao === 'string' ? situacao : '', fazer));
    const d = OrientacaoForm.safeParse(dados);
    if (!d.success) return { erro: d.error.issues[0]?.message ?? 'Confira os campos da orientação.' };
    const id = await gravarOrientacao(sb, null, d.data);
    revalidatePath('/treinar-agente'); revalidatePath('/agentes', 'layout');
    return { id };
  } catch (e) {
    unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
    if (e instanceof AvisoTreinar) return { erro: e.message };
    console.error('[treinar-agente] falha ao criar a orientação pelo Atendimento', e);
    return { erro: FALHA_CRIAR };
  }
}

/**
 * Chave da tabela. Devolve o motivo em vez de lançar (em produção o Next esconde a mensagem de um erro lançado):
 * a chave volta ao estado anterior e o aviso mostra o motivo (ex.: empresa arquivada).
 */
export async function alternarOrientacao(id: string, ativo: boolean): Promise<{ erro: string | null }> {
  try {
    const sb = await exigirTreinar();
    if (!ehUuid(id)) throw new AvisoTreinar('Orientação não encontrada.');
    const { error } = await sb.rpc('alternar_orientacao', { p_id: id, p_ativo: ativo });
    if (error) throw avisoDoBanco(error, 'falha ao ligar/desligar a orientação', FALHA_ALTERNAR);
  } catch (e) {
    unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
    if (e instanceof AvisoTreinar) return { erro: e.message };
    console.error('[treinar-agente] falha ao ligar/desligar a orientação', e);
    return { erro: FALHA_ALTERNAR };
  }
  revalidatePath('/treinar-agente'); revalidatePath('/agentes', 'layout');
  return { erro: null };
}

/** Volta título, texto, tipo e "vale para" de uma versão; ligada/desligada continua como está (restaurar_orientacao). */
export async function restaurarVersao(versaoId: string, voltar: string) {
  await comAvisoDeErro(destinoDaTela(voltar), async () => {
    try {
      const sb = await exigirTreinar();
      if (!ehUuid(versaoId)) throw new AvisoTreinar('Versão não encontrada.');
      const { error } = await sb.rpc('restaurar_orientacao', { p_versao_id: versaoId });
      if (error) throw avisoDoBanco(error, 'falha ao restaurar a versão', FALHA_RESTAURAR);
    } catch (e) {
      unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
      if (e instanceof AvisoTreinar) throw e;
      console.error('[treinar-agente] falha ao restaurar a versão', e);
      throw new AvisoTreinar(FALHA_RESTAURAR);
    }
  });
}

export type RespostaTeste = { id: string; aviso: string | null } | { erro: string };

/**
 * "Testar o agente": cria a simulação com o cliente da pessoa (criar_simulacao: uma pendente por pessoa) e põe na fila
 * simular_agente; o trabalhador grava o resultado e o Dialog acompanha por tempo real. Nada é enviado nem gravado
 * além da própria simulação. Devolve o motivo em vez de lançar (em produção o Next esconde a mensagem de um erro lançado).
 * Já há um teste pendente: devolve esse teste (o Dialog passa a acompanhá-lo) e o põe na fila de novo, caso o envio
 * dele tenha falhado (a chave única da fila não deixa rodar duas vezes).
 */
export async function testarAgente(entrada: PedidoTeste): Promise<RespostaTeste> {
  try {
    const { u, sb } = await sessaoTreinar();
    const pedido = PedidoTeste.safeParse(entrada);
    if (!pedido.success) return { erro: pedido.error.issues[0]?.message ?? 'Pedido de teste inválido.' };
    const { mensagem, clienteId, rascunho, skillId, agente, modo } = pedido.data;
    // I3b (D11, D12): agente de setor tem a função própria; o Thiago segue com as de sempre.
    // Teste com uma skill (aba Testar, D21): só o dono; o banco confere. Sem ela, o teste de sempre.
    const { data: id, error } = agente && agente !== SLUG_ATENDIMENTO
      ? await sb.rpc('criar_simulacao_agente', { p_slug: agente, p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined,
        p_rascunho: rascunho ?? undefined, p_skill: skillId ?? undefined, p_modo: modo ?? undefined })
      : skillId
      ? await sb.rpc('criar_simulacao_skill', { p_skill: skillId, p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined })
      : await sb.rpc('criar_simulacao', { p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined, p_rascunho: rascunho ?? undefined });
    let aviso: string | null = null;
    let simulacao: string | null = id;
    if (error) {
      if (!error.message.startsWith(ERRO_BANCO_PENDENTE)) return { erro: error.message };
      // Só as da própria pessoa (o RLS também restringe; o filtro não depende dele).
      const { data: pendente } = await sb.from('simulacoes_agente').select('id').eq('usuario_id', u.id).eq('status', 'pendente')
        .order('criado_em', { ascending: false }).limit(1).maybeSingle();
      if (!pendente) return { erro: error.message };
      simulacao = pendente.id;
      aviso = MENSAGEM_TESTE_PENDENTE;
    }
    if (!simulacao) return { erro: MENSAGEM_FALHA_TESTE };
    try {
      await enfileirarSimulacao(simulacao);
    } catch (e) {
      // A linha fica pendente; criar_simulacao a considera abandonada depois de 5 minutos.
      console.error('[treinar-agente] falha ao pôr o teste na fila', e);
      return { erro: MENSAGEM_FILA_FORA };
    }
    return { id: simulacao, aviso };
  } catch (e) {
    unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
    return { erro: e instanceof Error ? e.message : MENSAGEM_FALHA_TESTE };
  }
}
