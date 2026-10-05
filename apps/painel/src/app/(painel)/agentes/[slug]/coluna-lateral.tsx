import Link from 'next/link';
import { Lock, LockKeyhole } from 'lucide-react';
import { CATALOGO_FERRAMENTAS, ORDEM_PRIORIDADE, exigeAprovacao, type NomeFerramentaCatalogo } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Agente, Mudanca } from '@/lib/agentes';
import { formatarData } from '@/lib/formatos';

const titulo = 'text-sm font-bold uppercase tracking-wide text-brand';

/** Quem vence em conflito (spec 7E.3). */
export function OrdemPrioridade() {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between"><h2 className={titulo}>Ordem de prioridade</h2><span className="text-xs text-muted">quem vence em conflito</span></div>
      <ol className="flex flex-col gap-1.5">
        {ORDEM_PRIORIDADE.map((p, i) => (
          <li key={p} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <span className="tabular flex size-5 items-center justify-center rounded-full bg-grafite text-xs font-bold text-grafite-foreground">{i + 1}</span>
            <span className="flex-1">{p}</span>
            {i === 0 && <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock aria-hidden size={12} />fixas</span>}
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">Conhecimento e exemplos só informam; não mandam.</p>
    </Card>
  );
}

/** Ferramentas liberadas com a marca de só leitura ou aprovação (D15). */
export function ResumoFerramentas({ agente }: { agente: Pick<Agente, 'slug' | 'ferramentas' | 'portaDeEntrada'> }) {
  const liberadas = agente.ferramentas.filter((f): f is NomeFerramentaCatalogo => f in CATALOGO_FERRAMENTAS);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className={titulo}>Ferramentas</h2>
        <span className="text-xs text-muted">{liberadas.length} liberadas · <Link href={`/agentes/${agente.slug}/ferramentas`} className="font-bold text-brand">ver aba</Link></span>
      </div>
      <ul className="flex flex-col gap-1">
        {liberadas.map((f) => (
          <li key={f} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
            <span>{CATALOGO_FERRAMENTAS[f].rotulo}</span>
            {exigeAprovacao(CATALOGO_FERRAMENTAS[f])
              ? <Badge variant="warning"><LockKeyhole aria-hidden />{agente.portaDeEntrada ? 'o cliente confirma' : 'aprovação'}</Badge>
              : <Badge variant="success">só leitura</Badge>}
          </li>
        ))}
      </ul>
      {!agente.portaDeEntrada && <p className="text-xs text-muted">Grava ou envia algo: exige aprovação humana antes de valer.</p>}
    </Card>
  );
}

export function UltimasMudancas({ mudancas }: { mudancas: Mudanca[] }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h2 className={titulo}>Últimas mudanças</h2>
      {mudancas.length === 0 ? <p className="text-sm text-muted">Nenhuma mudança ainda.</p> : (
        <ul className="flex flex-col gap-1.5 text-sm">
          {mudancas.map((m) => <li key={m.id}><b className="tabular">{formatarData(m.quando)}</b> · {m.descricao}{m.quem && <span className="text-muted"> ({m.quem})</span>}</li>)}
        </ul>
      )}
    </Card>
  );
}
