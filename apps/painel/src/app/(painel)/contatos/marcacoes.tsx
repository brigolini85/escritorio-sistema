import { Badge } from '@/components/ui/badge';
import { selosDoContato, type Vinculo } from '@/lib/contatos';

const VARIANTE = { nota: 'success', preco: 'brand', conversa: 'neutral' } as const;

/** Marcações do contato como selos (imagem A, D11): " · 1 de 2" quando vale só em parte das empresas; o title diz em quais. */
export function SelosContato({ vinculos }: { vinculos: Vinculo[] }) {
  const selos = selosDoContato(vinculos);
  if (selos.length === 0) return <span className="text-subtle">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {selos.map((s) => <Badge key={s.tom} variant={VARIANTE[s.tom]} title={s.titulo}>{s.rotulo}</Badge>)}
    </span>
  );
}
