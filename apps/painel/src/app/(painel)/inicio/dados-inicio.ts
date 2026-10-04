import 'server-only';
import { cache } from 'react';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Um cliente e um "agora" por requisição: as seções do Início leem em paralelo e todas contam do mesmo instante. */
export const paginaInicio = cache(async () => ({ sb: await supabaseServidor(), agora: new Date() }));
