import 'server-only';
import { cache } from 'react';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Um cliente e um "agora" por requisição: as seções do Início leem em paralelo e todas contam do mesmo instante. */
export const paginaInicio = cache(async () => ({ sb: await supabaseServidor(), agora: new Date() }));

/** Avisos ainda não vistos que a pessoa enxerga (RLS de alertas: administrador todos; a equipe os dela e do setor). */
export const lerAvisos = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('alertas').select('*', { count: 'exact' }).is('lido_em', null)
    .order('criado_em', { ascending: false }).limit(20);
  return error ? null : { alertas: data ?? [], total: count ?? 0 };
});
