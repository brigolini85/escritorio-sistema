import 'server-only';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { supabaseServico } from './supabase/servico';

/**
 * Auditoria 2.3: login, "esqueci a senha" e código do segundo fator saem do servidor do painel, então para o Supabase
 * Auth todo mundo tem o mesmo IP e o limite dele (por IP) tranca o escritório inteiro. O painel conta antes, por IP de
 * quem pede, por e-mail e por pessoa, no banco (contar_tentativa, vale entre processos) e, acima do limite, recusa sem
 * chamar o Auth. O acerto devolve a sua tentativa (devolverTentativas): só os erros enchem o limite.
 *
 * Banco fora (a contagem falhou): deixa passar e registra. O Auth ainda tem o limite dele; trancar todo mundo porque o
 * contador caiu seria pior que o ataque que ele evita.
 *
 * Janela fixa: na virada de uma janela cabem até 2 vezes o limite (o fim de uma e o começo da seguinte).
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
 * IP de quem pede, contado da direita no x-forwarded-for. O cliente pode mandar o cabeçalho já preenchido (os valores da
 * esquerda são forjáveis); cada proxy confiável acrescenta, no fim, o IP de quem falou com ele. Só com o proxy do
 * Easypanel (Traefik) na frente, vale o último valor; com um CDN na frente dele, PAINEL_PROXIES_CONFIAVEIS=2 (o segundo
 * da direita), e assim por diante. Padrão 1. O painel não pode ficar exposto sem o proxy (docs/operacao.md).
 */
export function ipDe(h: Headers, proxies: string | undefined = process.env.PAINEL_PROXIES_CONFIAVEIS): string {
  const valores = (h.get('x-forwarded-for') ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  const texto = (proxies ?? '').trim();
  const n = /^[1-9]\d?$/.test(texto) ? Number(texto) : 1;
  const ip = valores.length ? valores[Math.max(valores.length - n, 0)] : undefined;
  return ip || h.get('x-real-ip')?.trim() || 'sem-ip';
}

export async function ipDoPedido(): Promise<string> {
  return ipDe(await headers());
}

/** Chave com o tipo do limite e o valor resumido: o banco não guarda IP nem e-mail em claro. */
function chave(regra: Regra, valor: string): string {
  return `${regra.tipo}:${createHash('sha256').update(valor.trim().toLowerCase()).digest('hex')}`;
}

/**
 * Uma tentativa contada (para o acerto devolver). Revisão final (T12): `janela` é a da contagem, devolvida pelo banco; o
 * acerto devolve nela, mesmo que a janela tenha virado no meio do login.
 */
export type Contada = { chave: string; janela: string };

/**
 * Conta uma tentativa em cada regra, na ordem; para na primeira acima do limite (ok: false). Devolve as que contou: a
 * contagem vem antes do Auth (sem corrida entre pedidos ao mesmo tempo) e o acerto devolve as suas.
 */
export async function dentroDosLimites(regras: [Regra, string][]): Promise<{ ok: boolean; contadas: Contada[] }> {
  const contadas: Contada[] = [];
  for (const [regra, valor] of regras) {
    const k = chave(regra, valor);
    try {
      const { data, error } = await supabaseServico().rpc('contar_tentativa_janela', { p_chave: k, p_limite: regra.limite, p_janela_segundos: regra.janelaSegundos });
      if (error) throw new Error(error.message);
      // Nulo: passou do limite (não contou).
      if (!data) return { ok: false, contadas };
      contadas.push({ chave: k, janela: data });
    } catch (e) {
      console.error(`[limite] contagem de ${regra.tipo} indisponível; seguindo sem o limite`, e instanceof Error ? e.message : e);
    }
  }
  return { ok: true, contadas };
}

/**
 * Revisão (auditoria 2.3): o acerto (senha ou código certo) devolve as tentativas que contou, na mesma janela. Melhor
 * esforço: o login já deu certo, então a falha só vai para o log.
 */
export async function devolverTentativas(contadas: Contada[]): Promise<void> {
  for (const c of contadas) {
    try {
      const { error } = await supabaseServico().rpc('devolver_tentativa', { p_chave: c.chave, p_janela: c.janela });
      if (error) throw new Error(error.message);
    } catch (e) {
      console.error('[limite] tentativa não devolvida', e instanceof Error ? e.message : e);
    }
  }
}
