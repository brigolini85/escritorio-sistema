import type { Database } from '@escritorio/db';

/** A linha única de configuracoes (id = 1). */
export type Config = Database['public']['Tables']['configuracoes']['Row'];
