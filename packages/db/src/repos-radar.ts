import { lerCriterios, type FonteRadar, type Impacto } from '@escritorio/core';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';
import type { Db } from './cliente';

/** Parte I5: o banco ainda não tem as migrações do Radar (o trabalhador avisa uma vez e segue, D19). */
export class SemI5 extends Error {
  constructor() { super('O banco ainda não tem a Parte I5 (Radar).'); }
}
// Os mesmos códigos de "não existe" que repos.ts usa para as partes anteriores.
const SEM_MIGRACAO = new Set(['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205']);
function checar<T>(r: PostgrestSingleResponse<T>, contexto: string): T {
  if (r.error && SEM_MIGRACAO.has(r.error.code ?? '')) throw new SemI5();
  if (r.error) throw new Error(`${contexto}: ${r.error.message}`);
  return r.data;
}

export type ConfigRadar = { hora: string; dias: number[]; assuntos: string[]; resumoWhatsapp: boolean; avisoAlto: boolean; avisarPainel: boolean; limiteUsdGiro: number };
export type OrigemGiro = 'agenda' | 'pedido' | 'nova_tentativa' | 'confirmar';
export type GiroParaRodar = {
  id: string; origem: OrigemGiro; pedidoPor: string | null; novidade: { id: string; titulo: string; url: string; resumo: string } | null;
  config: ConfigRadar; fontes: FonteRadar[]; setores: { id: string; nome: string }[]; recentes: string[];
};
export type NovidadeNova = {
  titulo: string; url: string; urlNormalizada: string; publicadoEm: string | null; resumo: string; impacto: Impacto; setores: string[];
  criterios: Record<string, unknown>; vigenciaInicio: string | null; vigenciaTexto: string | null; mensagemCliente: string | null; assunto: string | null;
};
export type RegistroNovidade =
  | { situacao: 'nova'; id: string; selo: 'oficial' | 'confirmar'; clientes: number }
  | { situacao: 'repetida' } | { situacao: 'confirmada'; id: string } | { situacao: 'nao_oficial' };
export type FimDoGiro = {
  estado: 'concluido' | 'falhou'; fontes: number; paginas: number; buscas: number;
  fontesFora: { fonteId: string | null; nome: string; motivo: string }[]; lidas: { url: string; titulo: string }[]; resumo: string | null; erro: string | null;
};
export type EnvioRadar = { id: string; novidadeId: string; clienteId: string; contatoId: string; telefone: string; texto: string };
export type AvisoNovidade = { whatsapp: boolean; avisoId: string | null; titulo: string; fonte: string; vigencia: string | null };
export type ResumoReservado = { avisoId: string; novidades: { titulo: string; impacto: Impacto; fonte: string }[]; fontesFora: string[] };

type LinhaFonte = { id: string; nome: string; dominio: string; caminho: string | null; etiqueta: string; oficial: boolean; ativa: boolean; paginas: string[] | null };
type JsonGiro = {
  giro: { id: string; origem: OrigemGiro; pedido_por: string | null; novidade_id: string | null };
  config: { hora: string; dias: number[]; assuntos: string[]; resumo_whatsapp: boolean; aviso_alto: boolean; avisar_painel: boolean; limite_usd_giro: number | string };
  fontes: LinhaFonte[]; setores: { id: string; nome: string }[]; recentes: string[];
  novidade: { id: string; titulo: string; url: string; resumo: string } | null;
};

export function criarReposRadar(db: Db) {
  const rpc = (nome: string, args?: Record<string, unknown>) => db.rpc(nome as never, args as never) as unknown as Promise<PostgrestSingleResponse<unknown>>;
  return {
    async abrirGirosRadar(agora: Date): Promise<string | null> {
      return checar(await rpc('abrir_giros_radar', { p_agora: agora.toISOString() }), 'abrirGirosRadar') as string | null;
    },
    async pegarGiroRadar(): Promise<GiroParaRodar | null> {
      const j = checar(await rpc('pegar_giro_radar'), 'pegarGiroRadar') as JsonGiro | null;
      if (!j) return null;
      return {
        id: j.giro.id, origem: j.giro.origem, pedidoPor: j.giro.pedido_por, novidade: j.novidade,
        config: { hora: j.config.hora, dias: j.config.dias, assuntos: j.config.assuntos, resumoWhatsapp: j.config.resumo_whatsapp,
          avisoAlto: j.config.aviso_alto, avisarPainel: j.config.avisar_painel, limiteUsdGiro: Number(j.config.limite_usd_giro) },
        fontes: j.fontes.map((f) => ({ ...f, paginas: f.paginas ?? [] })), setores: j.setores, recentes: j.recentes,
      };
    },
    async registrarNovidadeRadar(giroId: string, n: NovidadeNova): Promise<RegistroNovidade> {
      return checar(await rpc('registrar_novidade_radar', { p_giro: giroId, p_dados: {
        titulo: n.titulo, url: n.url, url_normalizada: n.urlNormalizada, publicado_em: n.publicadoEm, resumo: n.resumo, impacto: n.impacto,
        setores: n.setores, criterios: n.criterios, vigencia_inicio: n.vigenciaInicio, vigencia_texto: n.vigenciaTexto,
        mensagem_cliente: n.mensagemCliente, assunto: n.assunto,
      } }), 'registrarNovidadeRadar') as RegistroNovidade;
    },
    async somarCustoGiro(giroId: string, usd: number): Promise<void> {
      checar(await rpc('somar_custo_giro', { p_giro: giroId, p_usd: usd }), 'somarCustoGiro');
    },
    async concluirGiroRadar(giroId: string, f: FimDoGiro): Promise<void> {
      checar(await rpc('concluir_giro_radar', { p_giro: giroId, p_dados: {
        estado: f.estado, fontes: f.fontes, paginas: f.paginas, buscas: f.buscas, resumo: f.resumo, erro: f.erro, lidas: f.lidas,
        fontes_fora: f.fontesFora.map((x) => ({ fonte_id: x.fonteId, nome: x.nome, motivo: x.motivo })),
      } }), 'concluirGiroRadar');
    },
    async avisarNovidadeNova(id: string): Promise<AvisoNovidade> {
      const j = checar(await rpc('avisar_novidade_nova', { p_novidade: id }), 'avisarNovidadeNova') as
        { whatsapp: boolean; aviso_id?: string | null; titulo?: string; fonte?: string; vigencia?: string | null };
      return { whatsapp: j.whatsapp, avisoId: j.aviso_id ?? null, titulo: j.titulo ?? '', fonte: j.fonte ?? '', vigencia: j.vigencia ?? null };
    },
    async reservarResumoRadar(giroId: string): Promise<ResumoReservado | null> {
      const j = checar(await rpc('reservar_resumo_radar', { p_giro: giroId }), 'reservarResumoRadar') as
        { aviso_id: string; novidades: { titulo: string; impacto: Impacto; fonte: string }[]; fontes_fora: string[] } | null;
      return j ? { avisoId: j.aviso_id, novidades: j.novidades, fontesFora: j.fontes_fora } : null;
    },
    async marcarAvisoRadar(avisoId: string, mensagemId: string): Promise<void> {
      checar(await rpc('marcar_aviso_radar', { p_aviso: avisoId, p_mensagem: mensagemId }), 'marcarAvisoRadar');
    },
    async enviosRadarParaEnviar(limite: number): Promise<string[]> {
      return (checar(await rpc('envios_radar_para_enviar', { p_limite: limite }), 'enviosRadarParaEnviar') as string[] | null) ?? [];
    },
    async reservarEnvioRadar(id: string): Promise<EnvioRadar | null> {
      const [e] = (checar(await rpc('reservar_envio_radar', { p_id: id }), 'reservarEnvioRadar') as
        { id: string; novidade_id: string; cliente_id: string; contato_id: string; telefone: string; texto: string }[] | null) ?? [];
      return e ? { id: e.id, novidadeId: e.novidade_id, clienteId: e.cliente_id, contatoId: e.contato_id, telefone: e.telefone, texto: e.texto } : null;
    },
    async liberarEnvioRadar(id: string): Promise<void> {
      checar(await rpc('liberar_envio_radar', { p_id: id }), 'liberarEnvioRadar');
    },
    async marcarEnvioRadar(id: string, mensagemId: string): Promise<void> {
      checar(await rpc('marcar_envio_radar', { p_id: id, p_mensagem: mensagemId }), 'marcarEnvioRadar');
    },
  };
}
export type ReposRadar = ReturnType<typeof criarReposRadar>;
/** Para o trabalhador ler os critérios gravados com a mesma regra do core. */
export const criteriosDoBanco = (x: unknown) => lerCriterios(x);
