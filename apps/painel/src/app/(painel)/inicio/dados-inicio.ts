import 'server-only';
import { cache } from 'react';
import { lerLimites } from '@/lib/atendimento';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Um cliente e um "agora" por requisição: as seções do Início leem em paralelo e todas contam do mesmo instante. */
export const paginaInicio = cache(async () => ({ sb: await supabaseServidor(), agora: new Date() }));

/** Avisos ainda não vistos que a pessoa enxerga (RLS de alertas: administrador todos; a equipe os dela e do setor). */
export const lerAvisos = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('alertas').select('*', { count: 'exact' }).is('lido_em', null)
    .order('criado_em', { ascending: false }).limit(20);
  if (error) console.error('[inicio] falha ao ler os avisos', error);
  return error ? null : { alertas: data ?? [], total: count ?? 0 };
});

/** Limites do cronômetro (limites_espera, Parte E; padrão quando não dá para ler). */
export const lerLimitesEspera = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.rpc('limites_espera');
  if (error) console.error('[inicio] falha ao ler os limites de espera', error);
  return lerLimites(data);
});

/** Nomes da equipe para "com Bruno" na linha de estado das conversas (como a lista do Atendimento lê). */
export const lerNomesPessoas = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.from('usuarios').select('id, nome');
  if (error) console.error('[inicio] falha ao ler os nomes da equipe', error);
  return new Map((data ?? []).map((p) => [p.id, p.nome]));
});
