'use server';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import type { EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { enfileirarSimulacao } from '@/lib/fila';
import { lerEmPaginas } from '@/lib/paginas';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams } from '@/lib/tabela-url';
import { comporTexto } from './ensinar';
import { AVISO_EMPRESAS_INCOMPLETAS, destinoDaTela, ehUuid, opcaoEmpresa, OrientacaoForm, type DadosOrientacao } from './esquemas';
import {
  ERRO_BANCO_PENDENTE, MENSAGEM_FALHA_TESTE, MENSAGEM_FILA_FORA, MENSAGEM_TESTE_PENDENTE, PedidoTeste,
} from './simulacao';

const SEM_PERMISSAO = 'Você não tem permissão para treinar o agente.';
const FALHA_SALVAR = 'Não foi possível salvar a orientação. Tente de novo em alguns minutos.';
const FALHA_CRIAR = 'Não foi possível criar a orientação. Tente de novo em alguns minutos.';

/** Erro com texto já pensado para a pessoa (permissão, validação do banco). Os outros viram uma mensagem padrão. */
class AvisoTreinar extends Error {}

/** Sessão de quem pode treinar o agente (a pessoa e o cliente dela). O banco confere de novo nas funções. */
async function sessaoTreinar() {
  const u = await obterUsuario();
  if (!temPermissao(u, 'treinar_agente')) throw new AvisoTreinar(SEM_PERMISSAO);
  return { u, sb: await supabaseServidor() };
}

/** Cliente de quem pode treinar o agente (funções salvar/alternar/restaurar_orientacao conferem de novo). */
async function exigirTreinar() {
  return (await sessaoTreinar()).sb;
}

/** O mesmo endereço (filtros da lista) com outro painel aberto. */
function comOrientacao(destino: string, mudancas: Record<string, string | null>): string {
  const busca = new URLSearchParams(destino.split('?')[1] ?? '');
  return `/treinar-agente${hrefComParams(Object.fromEntries(busca), { ...mudancas, erro: null })}`;
}

/**
 * Cria (id null) ou edita a orientação com o cliente de quem pode treinar o agente (salvar_orientacao confere tudo de
 * novo e grava a versão e a auditoria). Devolve o id. Usada pela tela e pelo "Ensinar o agente" do Atendimento.
 */
async function gravarOrientacao(sb: Awaited<ReturnType<typeof exigirTreinar>>, id: string | null, d: DadosOrientacao): Promise<string> {
  if (id !== null && !ehUuid(id)) throw new AvisoTreinar('Orientação não encontrada.');
  const { data, error } = await sb.rpc('salvar_orientacao', {
    // Para criar, o banco recebe null (o tipo gerado marca p_id como obrigatório por vir antes dos que têm padrão).
    p_id: id as unknown as string,
    p_titulo: d.titulo, p_texto: d.texto, p_tipo: d.tipo,
    p_cliente_id: d.clienteId ?? undefined, p_setor_id: d.setorId ?? undefined, p_ativo: d.ativo,
  });
  if (error) {
    // P0001 = raise exception das funções do banco: mensagens em português escritas para a pessoa.
    if (error.code === 'P0001') throw new AvisoTreinar(error.message);
    console.error('[treinar-agente] falha ao salvar a orientação', error);
    throw new AvisoTreinar(FALHA_SALVAR);
  }
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
    const data = await gravarOrientacao(sb, id, OrientacaoForm.parse(formData));
    if (id === null) {
      revalidatePath('/treinar-agente');
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
    revalidatePath('/treinar-agente');
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
    const { mensagem, clienteId, rascunho } = pedido.data;
    const { data: id, error } = await sb.rpc('criar_simulacao', {
      p_mensagem: mensagem, p_cliente_id: clienteId ?? undefined, p_rascunho: rascunho ?? undefined,
    });
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

export type EmpresasTeste = { empresas: EmpresaOpcao[]; aviso: string | null };

/**
 * Empresas ativas para o Dialog "Testar o agente", lidas quando ele abre (não pesam na tela nem vão duas vezes na
 * página). Cliente da pessoa, de 1000 em 1000. Falha ou lista cortada: o que veio + aviso discreto.
 */
export async function empresasParaTeste(): Promise<EmpresasTeste> {
  try {
    const sb = await exigirTreinar();
    const { data, error, parcial } = await lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo')
      .eq('ativo', true).order('razao_social').order('id').range(de, ate));
    if (error || parcial) console.error('[treinar-agente] empresas do teste incompletas', error ?? 'limite de páginas');
    return { empresas: data.map(opcaoEmpresa), aviso: error || parcial ? AVISO_EMPRESAS_INCOMPLETAS : null };
  } catch (e) {
    unstable_rethrow(e);
    console.error('[treinar-agente] falha ao ler as empresas do teste', e);
    return { empresas: [], aviso: AVISO_EMPRESAS_INCOMPLETAS };
  }
}
