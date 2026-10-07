import { randomUUID } from 'node:crypto';
import { normalizarTelefone, variantesTelefone } from '@escritorio/core';
import type { CanalWhatsApp } from './tipos';

/** Plano de prontidão (D2): fora da produção, só a lista recebe mensagem. */
export type Ambiente = 'producao' | 'homologacao' | 'local';
export type RegraEnvio = { ambiente: Ambiente; permitidos: string[] };

export function envioPermitido(regra: RegraEnvio, telefone: string): boolean {
  if (regra.ambiente === 'producao') return true;
  const n = normalizarTelefone(telefone);
  if (!n) return false;
  const lista = new Set(regra.permitidos.flatMap((p) => variantesTelefone(p)));
  return variantesTelefone(n).some((v) => lista.has(v));
}

/**
 * D1: a trava fica no canal para valer em todo caminho que manda mensagem (agente, painel, alertas ao dono, assistente, avisos).
 * Bloqueado: devolve um id "bloqueado-…" (o painel mostra "Não enviada: ambiente de teste"), registra e segue sem erro.
 */
export function canalComTrava(
  canal: CanalWhatsApp, regra: RegraEnvio, registrar: (b: { telefoneFinal: string; tipo: 'texto' | 'arquivo' }) => Promise<void>,
): CanalWhatsApp {
  const bloquear = async (telefone: string, tipo: 'texto' | 'arquivo') => {
    const telefoneFinal = `…${telefone.replace(/\D/g, '').slice(-4)}`;
    console.warn(`[trava] envio bloqueado fora da produção (${tipo}) para ${telefoneFinal}`);
    await registrar({ telefoneFinal, tipo }).catch((e) => console.error('[trava] bloqueio não registrado', e));
    return { idProvedor: `bloqueado-${randomUUID()}` };
  };
  return {
    interpretarWebhook: (corpo) => canal.interpretarWebhook(corpo),
    status: () => canal.status(),
    enviarTexto: (telefone, texto) => (envioPermitido(regra, telefone) ? canal.enviarTexto(telefone, texto) : bloquear(telefone, 'texto')),
    enviarArquivo: (telefone, a) => (envioPermitido(regra, telefone) ? canal.enviarArquivo(telefone, a) : bloquear(telefone, 'arquivo')),
  };
}
