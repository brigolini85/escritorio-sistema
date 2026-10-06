'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { LIMITES_RADAR, lerEnderecoFonte } from '@escritorio/core';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export type ResultadoRadarAcao = { ok: true } | { ok: false; erro: string };
const FALHA = 'Não foi possível salvar agora. Tente de novo.';
const Uuid = z.string().uuid();
const NAO_ACHEI = { ok: false as const, erro: 'Novidade não encontrada.' };
const FONTE_NAO_ACHEI = { ok: false as const, erro: 'Fonte não encontrada.' };
const TELA = '/agentes/radar';

/** Chama a função do banco com a sessão; P0001 é a frase para a pessoa (o banco confere quem pode, estado e limites). */
async function chamar<T>(nome: string, args: Record<string, unknown>): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try {
    await obterUsuario();
    const { data, error } = await (await supabaseServidor()).rpc(nome as never, args as never);
    if (error) {
      if (error.code !== 'P0001') console.error(`[radar] ${nome}`, error);
      return { ok: false, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
    }
    return { ok: true, dados: data as T };
  } catch (e) {
    unstable_rethrow(e);
    console.error(`[radar] ${nome}`, e);
    return { ok: false, erro: FALHA };
  }
}
/** Chama, atualiza a tela e devolve só ok/erro. */
async function simples(nome: string, args: Record<string, unknown>): Promise<ResultadoRadarAcao> {
  const r = await chamar(nome, args);
  if (!r.ok) return r;
  revalidatePath(TELA);
  return { ok: true };
}

/** D7: só registra o pedido; o trabalhador pega no minuto seguinte. */
export async function pedirGiroRadar(): Promise<ResultadoRadarAcao> {
  return simples('pedir_giro_radar', {});
}
export async function procurarFonteOficial(novidadeId: string): Promise<ResultadoRadarAcao> {
  if (!Uuid.safeParse(novidadeId).success) return NAO_ACHEI;
  return simples('procurar_fonte_oficial_radar', { p_novidade: novidadeId });
}

export type DadosFonte = { nome: string; endereco: string; etiqueta: string; oficial: boolean; ativa: boolean; paginas: string[] };
export async function salvarFonteRadar(id: string | null, dados: DadosFonte): Promise<ResultadoRadarAcao> {
  if (id !== null && !Uuid.safeParse(id).success) return FONTE_NAO_ACHEI;
  const e = lerEnderecoFonte(dados.endereco);
  if (!e.ok) return e;
  return simples('salvar_fonte_radar', {
    p_id: id,
    p_dados: { nome: dados.nome, dominio: e.dominio, caminho: e.caminho, etiqueta: dados.etiqueta, oficial: dados.oficial, ativa: dados.ativa, paginas: dados.paginas },
  });
}
export async function removerFonteRadar(id: string): Promise<ResultadoRadarAcao> {
  if (!Uuid.safeParse(id).success) return FONTE_NAO_ACHEI;
  return simples('remover_fonte_radar', { p_id: id });
}

export type DadosConfigRadar = Partial<{
  hora: string; dias: number[]; assuntos: string[]; resumo_whatsapp: boolean; aviso_alto: boolean; avisar_painel: boolean; limite_usd_giro: number;
}>;
export async function salvarConfigRadar(dados: DadosConfigRadar): Promise<ResultadoRadarAcao> {
  return simples('salvar_config_radar', { p_dados: dados });
}
/** Ligar e desligar é o estado do agente (só o dono; o banco confere). */
export async function ligarRadar(ligado: boolean): Promise<ResultadoRadarAcao> {
  return simples('salvar_agente', { p_slug: 'radar', p_dados: { estado: ligado ? 'ligado' : 'desligado' } });
}

export async function criarDemandaRadar(novidadeId: string, setorId: string): Promise<{ ok: true; id: string; numero: number } | { ok: false; erro: string }> {
  if (!Uuid.safeParse(novidadeId).success || !Uuid.safeParse(setorId).success) return NAO_ACHEI;
  const r = await chamar<{ id: string; numero: number }>('criar_demanda_radar', { p_novidade: novidadeId, p_setor: setorId });
  if (!r.ok) return r;
  revalidatePath(TELA);
  revalidatePath('/demandas');
  return { ok: true, id: r.dados.id, numero: Number(r.dados.numero) };
}
export async function avisarEquipeRadar(novidadeId: string): Promise<ResultadoRadarAcao> {
  if (!Uuid.safeParse(novidadeId).success) return NAO_ACHEI;
  return simples('avisar_equipe_radar', { p_novidade: novidadeId });
}
export async function descartarNovidadeRadar(novidadeId: string): Promise<ResultadoRadarAcao> {
  if (!Uuid.safeParse(novidadeId).success) return NAO_ACHEI;
  return simples('descartar_novidade_radar', { p_novidade: novidadeId });
}
export async function salvarMensagemRadar(novidadeId: string, texto: string): Promise<ResultadoRadarAcao> {
  if (!Uuid.safeParse(novidadeId).success) return NAO_ACHEI;
  return simples('salvar_mensagem_radar', { p_novidade: novidadeId, p_texto: texto });
}
export async function aprovarEnvioRadar(novidadeId: string, setorId: string, clientes: string[], texto: string): Promise<{ ok: true; contatos: number } | { ok: false; erro: string }> {
  if (!Uuid.safeParse(novidadeId).success || !Uuid.safeParse(setorId).success) return NAO_ACHEI;
  if (clientes.length > LIMITES_RADAR.clientesPorEnvio) return { ok: false, erro: `Até ${LIMITES_RADAR.clientesPorEnvio} clientes por envio.` };
  if (!clientes.every((c) => Uuid.safeParse(c).success)) return { ok: false, erro: 'Cliente não encontrado.' };
  const r = await chamar<number>('aprovar_envio_radar', { p_novidade: novidadeId, p_setor: setorId, p_clientes: clientes, p_texto: texto });
  if (!r.ok) return r;
  revalidatePath(TELA);
  return { ok: true, contatos: Number(r.dados) };
}

export type ClienteAfetado = { id: string; nome: string; regime: string | null; uf: string | null; cidade: string | null };
export type ClienteParaEnvio = { id: string; nome: string; contatos: number };
export async function lerClientesAfetados(novidadeId: string): Promise<{ ok: true; clientes: ClienteAfetado[] } | { ok: false; erro: string }> {
  if (!Uuid.safeParse(novidadeId).success) return NAO_ACHEI;
  const r = await chamar<Record<string, unknown>[] | null>('clientes_afetados_radar', { p_novidade: novidadeId });
  if (!r.ok) return r;
  return {
    ok: true,
    clientes: (r.dados ?? []).map((c) => ({
      id: String(c.cliente_id), nome: String(c.nome), regime: (c.regime as string | null) ?? null, uf: (c.uf as string | null) ?? null, cidade: (c.cidade as string | null) ?? null,
    })),
  };
}
export async function lerContatosParaEnvio(novidadeId: string, setorId: string): Promise<{ ok: true; clientes: ClienteParaEnvio[] } | { ok: false; erro: string }> {
  if (!Uuid.safeParse(novidadeId).success || !Uuid.safeParse(setorId).success) return NAO_ACHEI;
  const r = await chamar<Record<string, unknown>[] | null>('contatos_para_envio_radar', { p_novidade: novidadeId, p_setor: setorId });
  if (!r.ok) return r;
  return { ok: true, clientes: (r.dados ?? []).map((c) => ({ id: String(c.cliente_id), nome: String(c.nome), contatos: Number(c.contatos) })) };
}
