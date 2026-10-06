import 'server-only';
import { semMigracaoI1 } from '@/lib/agentes';
import type { supabaseServidor } from '@/lib/supabase/servidor';
import type { SituacaoDrive } from './drive-tela';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Sem maybeSingle: linhas em lista, a mesma leitura dos outros blocos da ficha (e dos testes dela).
 * D9/D17: a situação gravada pelo trabalhador; semI3b quando a tabela não existe. */
export async function lerSituacaoDrive(sb: Sb): Promise<{ semI3b: boolean; erro: boolean; situacao: SituacaoDrive | null }> {
  const { data, error } = await sb.from('drive_conta').select('email, erro, verificado_em');
  if (semMigracaoI1(error)) return { semI3b: true, erro: false, situacao: null };
  // Erro real (não é falta de migração) não vira "Drive não configurado": a tela diz que não conseguiu ler.
  if (error) { console.error('[drive] situação', error); return { semI3b: false, erro: true, situacao: null }; }
  const l = data?.[0];
  return { semI3b: false, erro: false, situacao: l ? { email: l.email, erro: l.erro, verificadoEm: l.verificado_em } : null };
}
export async function lerPastaDoCliente(sb: Sb, clienteId: string): Promise<{ semI3b: boolean; erro: boolean; pasta: string | null }> {
  const { data, error } = await sb.from('clientes').select('drive_pasta_id').eq('id', clienteId);
  if (semMigracaoI1(error)) return { semI3b: true, erro: false, pasta: null };
  // Campo vazio por falha de leitura deixaria SALVAR apagar a pasta gravada.
  if (error) { console.error('[drive] pasta do cliente', error); return { semI3b: false, erro: true, pasta: null }; }
  return { semI3b: false, erro: false, pasta: data?.[0]?.drive_pasta_id ?? null };
}
export async function lerGuarda(sb: Sb): Promise<{ semI3b: boolean; erro: boolean; dias: number | null }> {
  const { data, error } = await sb.from('tarefas_guarda').select('dias');
  if (semMigracaoI1(error)) return { semI3b: true, erro: false, dias: null };
  if (error) { console.error('[guarda] leitura', error); return { semI3b: false, erro: true, dias: null }; }
  return { semI3b: false, erro: false, dias: data?.[0]?.dias ?? null };
}
