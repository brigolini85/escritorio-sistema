import { Lightbulb, Link2, Lock, MessageSquareText, ShieldQuestion } from 'lucide-react';
import { Card } from '@/components/ui/card';

const REGRAS = [
  { Icone: Lock, negrito: 'Nunca altera nada sozinho', resto: ' — não mexe em cliente, demanda, calendário nem skill.' },
  { Icone: Lightbulb, negrito: 'Tudo vira sugestão', resto: ': uma pessoa decide criar demanda, avisar ou descartar.' },
  { Icone: Link2, negrito: 'Cita sempre a fonte', resto: ', com data e link do ato.' },
  { Icone: ShieldQuestion, negrito: 'Marca "confirmar"', resto: ' quando a notícia não vem de fonte oficial.' },
  { Icone: MessageSquareText, negrito: 'Mensagem para cliente só sai com aprovação', resto: ' de uma pessoa.' },
] as const;

/** As cinco regras fixas do Radar (imagem 00). Texto fixo: não há o que configurar. */
export function RegrasRadar() {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Regras do agente</h2>
        <span className="text-xs text-muted">valem sempre</span>
      </div>
      <ul className="flex flex-col gap-3 text-sm">
        {REGRAS.map(({ Icone, negrito, resto }) => (
          <li key={negrito} className="flex items-start gap-3">
            <Icone aria-hidden size={16} className="mt-0.5 shrink-0 text-brand" />
            <span><b>{negrito}</b>{resto}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
