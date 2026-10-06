'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { lerSubpasta, rotuloTarefa } from '@escritorio/core';
import { enfileirarTarefa } from '@/lib/fila';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { doCampoDataHora } from '@/lib/prazo';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { criarTarefa } from './tarefas-acoes';

const FALHA = 'Não foi possível pedir agora. Tente de novo.';
const Uuid = z.string().uuid();
export type DadosPedido = { agenteId: string; pedido: string; chamadoId: string | null; clienteId: string | null; skill: string | null;
  prazo: string; avisarPainel: boolean; avisarWhatsapp: boolean; lerDrive: boolean; subpasta: string; i4: boolean };
type Resposta = { ok: true; tarefaId: string; rotulo: string; demanda: number | null; demandaNova: boolean } | { ok: false; erro: string };

/** D4, D8: cria a tarefa (a mesma função do WhatsApp) e devolve o id; a janela sobe os arquivos e só depois chama iniciarTarefaPedida. */
export async function pedirAoAgente(d: DadosPedido): Promise<Resposta> {
  if (!Uuid.safeParse(d.agenteId).success) return { ok: false, erro: 'Escolha o agente.' };
  if (d.chamadoId !== null && !Uuid.safeParse(d.chamadoId).success) return { ok: false, erro: 'Demanda não encontrada.' };
  if (d.clienteId !== null && !Uuid.safeParse(d.clienteId).success) return { ok: false, erro: 'Escolha a empresa.' };
  if (!d.i4) {
    // D17: banco sem a I4, a criação da I3a (só a demanda aberta, enfileira na hora).
    if (!d.chamadoId) return { ok: false, erro: 'Escolha uma demanda.' };
    const r = await criarTarefa(d.chamadoId, d.agenteId, d.pedido, d.skill);
    return r.ok ? { ok: true, tarefaId: r.id, rotulo: '', demanda: null, demandaNova: false } : r;
  }
  const sub = lerSubpasta(d.subpasta);
  if (!sub.ok) return { ok: false, erro: sub.erro };
  const prazo = d.prazo ? doCampoDataHora(d.prazo) : null;
  if (d.prazo && !prazo) return { ok: false, erro: 'Prazo inválido.' };
  try {
    await obterUsuario();
    const { data, error } = await (await supabaseServidor()).rpc('pedir_ao_agente', {
      p_agente: d.agenteId, p_pedido: d.pedido, p_chamado: d.chamadoId as string, p_cliente: d.clienteId as string, p_skill: d.skill as string,
      p_prazo: prazo as string, p_avisar_painel: d.avisarPainel, p_avisar_whatsapp: d.avisarWhatsapp, p_ler_drive: d.lerDrive, p_subpasta: sub.valor as string,
    });
    if (error) {
      if (error.code !== 'P0001') console.error('[pedir] pedir_ao_agente', error);
      return { ok: false, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
    }
    const j = data as { tarefa_id: string; tarefa_numero: number; chamado_numero: number; demanda_nova: boolean };
    revalidatePath('/demandas');
    return { ok: true, tarefaId: j.tarefa_id, rotulo: rotuloTarefa(Number(j.tarefa_numero)), demanda: Number(j.chamado_numero), demandaNova: j.demanda_nova };
  } catch (e) {
    unstable_rethrow(e);
    console.error('[pedir] pedir ao agente', e);
    return { ok: false, erro: FALHA };
  }
}

/** D8: depois dos arquivos. Se a fila falhar, o batimento do trabalhador começa a tarefa em 2 minutos. Exige sessão (F12). */
export async function iniciarTarefaPedida(tarefaId: string): Promise<void> {
  if (!Uuid.safeParse(tarefaId).success) return;
  await obterUsuario();
  await enfileirarTarefa(tarefaId).catch((e) => console.error('[pedir] não enfileirada; o batimento começa', tarefaId, e));
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath('/demandas');
}
