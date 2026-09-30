import 'server-only';
import { lerGastoIaDoMes, mesCorrenteSP, type GastoDoMes } from '@/lib/inicio';
import type { supabaseServidor } from '@/lib/supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** O Início recarrega pelo tempo real (até a cada 3 s) e a cada minuto; a soma do mês (várias páginas de uso_ia) vale por este tempo. */
const VALIDADE_MS = 60_000;
const memoria = new Map<string, { ate: number; valor: GastoDoMes }>();

/**
 * Gasto de IA do mês com memória curta no servidor, por pessoa e mês. A leitura é sempre feita com o cliente da
 * própria pessoa (RLS: só o administrador lê uso_ia), e a memória nunca serve o valor de uma pessoa para outra.
 * Erro não é guardado.
 */
export async function gastoDoMes(sb: Sb, usuarioId: string, agora: Date): Promise<GastoDoMes | null> {
  const chave = `${usuarioId}:${mesCorrenteSP(agora).inicio}`;
  const guardado = memoria.get(chave);
  if (guardado && guardado.ate > agora.getTime()) return guardado.valor;
  const valor = await lerGastoIaDoMes(sb, agora);
  if (valor) {
    if (memoria.size > 100) memoria.clear();
    memoria.set(chave, { ate: agora.getTime() + VALIDADE_MS, valor });
  }
  return valor;
}
