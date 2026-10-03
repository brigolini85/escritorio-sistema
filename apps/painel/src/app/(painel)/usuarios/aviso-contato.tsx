import { TriangleAlert } from 'lucide-react';

/** O número também é de um contato (cliente): com o assistente pelo WhatsApp, as mensagens dele vão para o assistente. */
export function AvisoContato({ contato }: { contato: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning">
      <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>Este número também é do contato {contato}. Com o assistente pelo WhatsApp ligado, as mensagens dele vão para o assistente, não para o agente de clientes.</span>
    </p>
  );
}
