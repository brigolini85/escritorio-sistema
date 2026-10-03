import { nivelAtinge } from '@escritorio/core';
import type { UsuarioAssistente } from '@escritorio/db';

type DemandaVisivel = { setor_id: string | null; responsavel_id: string | null };

/** Igual a pode_ver_chamado_de do banco (Parte D): admin vê tudo; responsável vê a sua; o resto pelo nível de Demandas. */
export function podeVerChamado(u: UsuarioAssistente, c: DemandaVisivel): boolean {
  if (!u.ativo) return false;
  if (u.papel === 'admin' || c.responsavel_id === u.id) return true;
  if (u.niveis.demandas === 'todas') return true;
  return u.niveis.demandas === 'meu_setor' && c.setor_id !== null && u.setores.includes(c.setor_id);
}

/**
 * Igual a pode_ver_conversa_de: pelo nível de Atendimento (quem assumiu; demandas da conversa no setor ou com a pessoa).
 * `interna` = WhatsApp de colega com o assistente: fica fora de "Todas as conversas", como no banco.
 */
export function podeVerConversaPelo(
  u: UsuarioAssistente, conversa: { atendente_id: string | null }, demandas: DemandaVisivel[], interna = false,
): boolean {
  if (!u.ativo) return false;
  if (u.papel === 'admin') return true;
  if (u.niveis.atendimento === 'todas') return !interna;
  if (u.niveis.atendimento === 'sem_acesso') return false;
  return conversa.atendente_id === u.id
    || demandas.some((c) => c.responsavel_id === u.id || (c.setor_id !== null && u.setores.includes(c.setor_id)));
}

/** Pedidos de nota (P11): "Ver" lê pedidos e vendas. */
export function podeVerPedidos(u: UsuarioAssistente): boolean {
  return u.papel === 'admin' || nivelAtinge('notas', u.niveis.notas, 'ver');
}

/** "Corrigir e gerar": corrige pedido e gera o CSV do Bling. */
export function podeCorrigirPedidos(u: UsuarioAssistente): boolean {
  return u.papel === 'admin' || u.niveis.notas === 'corrigir';
}

/** Canal do assistente: sem passe livre do administrador, como antes (P3). */
export function usaAssistentePor(u: UsuarioAssistente, canal: 'site' | 'whatsapp'): boolean {
  return u.ativo && nivelAtinge('assistente', u.niveis.assistente, canal === 'site' ? 'site' : 'site_whatsapp');
}

/** Demanda de pedido de nota (P11): tem pedido salvo ou o título "NF de ..." (o mesmo critério do filtro so_notas). */
export function ehPedidoDeNota(c: { titulo: string; pedido_venda?: unknown }): boolean {
  return (c.pedido_venda !== null && c.pedido_venda !== undefined) || c.titulo.startsWith('NF de ');
}

/** Título que não nomeia o pedido para quem tem "Pedidos de nota: Sem acesso". */
export const TITULO_SEM_ACESSO_PEDIDO = 'Pedido de nota (sem acesso)';
