import { Bell, Bot, CircleAlert, CircleDot, MessageCircle, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { linhasDoSistema, type LinhaSistema } from '@/lib/inicio';
import { lerAvisos } from './dados-inicio';
import { lerEstadoSistemaMesa } from './dados-mesa';

const ICONE_LINHA = { agente: Bot, whatsapp: MessageCircle, fila: TriangleAlert } as const;
const TOM: Record<LinhaSistema['tom'], { cor: string; Icone: typeof CircleDot }> = {
  ok: { cor: 'text-success', Icone: CircleDot },
  atencao: { cor: 'text-warning', Icone: TriangleAlert },
  perigo: { cor: 'text-danger', Icone: CircleAlert },
};

/**
 * Sistema (imagem B, D18): agente, WhatsApp e, se parou, as mensagens — de estado_sistema_resumo, sem nenhum valor de
 * custo e sem PAUSAR. Muda sozinho pela recarga periódica (D2).
 */
export async function BlocoSistema() {
  const [estado, avisos] = await Promise.all([lerEstadoSistemaMesa(), lerAvisos()]);
  const total = avisos?.total ?? 0;
  return (
    <Card data-testid="inicio-sistema" className="gap-2 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Sistema</h2>
      {estado ? (
        <ul className="flex flex-col gap-1.5 text-sm">
          {linhasDoSistema(estado).map((l) => {
            const IconeLinha = ICONE_LINHA[l.id];
            const { cor, Icone } = TOM[l.tom];
            return (
              <li key={l.id} data-sistema={l.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-foreground"><IconeLinha aria-hidden size={14} strokeWidth={1.75} />{l.rotulo}</span>
                <span className={cn('flex items-center gap-1 font-semibold', cor)}><Icone aria-hidden size={12} strokeWidth={2} />{l.valor}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted">Estado indisponível agora.</p>
      )}
      <p className="flex items-center justify-between gap-2 border-t border-border pt-2 text-sm">
        <span className="flex items-center gap-1 text-foreground"><Bell aria-hidden size={14} strokeWidth={1.75} />Avisos para você</span>
        {total > 0
          ? <a href="#avisos" className="font-semibold text-brand underline-offset-4 hover:underline">{total} · ver</a>
          : <span className="tabular text-muted">0</span>}
      </p>
    </Card>
  );
}
