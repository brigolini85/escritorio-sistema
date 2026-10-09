import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { supabaseServico } from './supabase/servico';

/**
 * Auditoria 2.3: login, "esqueci a senha" e código do segundo fator saem do servidor do painel, então para o Supabase
 * Auth todo mundo tem o mesmo IP e o limite dele (por IP) tranca o escritório inteiro. O painel conta antes, por IP de
 * quem pede, por e-mail e por pessoa, no banco (contar_tentativa, vale entre processos) e, acima do limite, recusa sem
 * chamar o Auth.
 *
 * Banco fora (a contagem falhou): deixa passar e registra. O Auth ainda tem o limite dele; trancar todo mundo porque o
 * contador caiu seria pior que o ataque que ele evita.
 */
export { MUITAS_TENTATIVAS } from './textos-login';

export type Regra = { tipo: string; limite: number; janelaSegundos: number };

export const LIMITES = {
  loginIpMinuto: { tipo: 'login-ip-min', limite: 5, janelaSegundos: 60 },
  loginIpHora: { tipo: 'login-ip-hora', limite: 20, janelaSegundos: 60 * 60 },
  loginEmail: { tipo: 'login-email', limite: 5, janelaSegundos: 15 * 60 },
  esqueciEmail: { tipo: 'esqueci-email', limite: 3, janelaSegundos: 60 * 60 },
  esqueciIp: { tipo: 'esqueci-ip', limite: 10, janelaSegundos: 60 * 60 },
  fatorUsuario: { tipo: 'fator-usuario', limite: 5, janelaSegundos: 60 },
} as const satisfies Record<string, Regra>;

/**
 * IP de quem pede: o primeiro valor do x-forwarded-for. Confia no proxy do Easypanel (Traefik), que fica na frente do
 * painel e acrescenta o IP de quem conectou; o painel não é exposto sem ele (docs/operacao.md).
 */
export function ipDe(h: Headers): string {
  const primeiro = (h.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  return primeiro || h.get('x-real-ip')?.trim() || 'sem-ip';
}

export async function ipDoPedido(): Promise<string> {
  return ipDe(await headers());
}

/** Chave com o tipo do limite e o valor resumido: o banco não guarda IP nem e-mail em claro. */
function chave(regra: Regra, valor: string): string {
  return `${regra.tipo}:${createHash('sha256').update(valor.trim().toLowerCase()).digest('hex')}`;
}

/** Conta uma tentativa em cada regra, na ordem; para na primeira acima do limite (false). */
export async function dentroDosLimites(regras: [Regra, string][]): Promise<boolean> {
  for (const [regra, valor] of regras) {
    try {
      const { data, error } = await supabaseServico().rpc('contar_tentativa', { p_chave: chave(regra, valor), p_limite: regra.limite, p_janela_segundos: regra.janelaSegundos });
      if (error) throw new Error(error.message);
      if (data === false) return false;
    } catch (e) {
      console.error(`[limite] contagem de ${regra.tipo} indisponível; seguindo sem o limite`, e instanceof Error ? e.message : e);
    }
  }
  return true;
}
