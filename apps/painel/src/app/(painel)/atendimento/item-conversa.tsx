import { Bot, CircleCheck, Hand, PauseCircle, UserRound, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { RelativeTime } from '@/components/patterns/relative-time';
import { iniciais, linhaDeEstado, previaDaUltima, textoNaoLidas, type LimitesEspera, type LinhaAtendimento, type TipoEstado } from '@/lib/atendimento';
import { cn } from '@/lib/cn';
import { mascararTelefone } from '@/lib/formatos';
import { CronometroEspera } from './cronometro-espera';

const ICONE: Record<TipoEstado, LucideIcon> = {
  pessoa: UserRound, pausado: PauseCircle, pedido: Hand, passou: Hand, respondendo: Bot, resolvido: CircleCheck, agente: Bot,
};

/** Um item da lista (imagem 00-atendimento): iniciais, contato, empresa, prévia, cronômetro, não lidas e a linha de estado. */
export function ItemConversa({ l, href, ativa, limites, estadoCtx }: {
  l: LinhaAtendimento;
  href: string;
  ativa: boolean;
  limites: LimitesEspera;
  estadoCtx: Parameters<typeof linhaDeEstado>[1];
}) {
  const nome = l.nome_contato && l.nome_contato !== l.telefone ? l.nome_contato : mascararTelefone(l.telefone);
  const estado = linhaDeEstado(l, estadoCtx);
  const Icone = ICONE[estado.tipo];
  const naoLidas = ativa ? 0 : l.nao_lidas ?? 0;
  return (
    <Link
      href={href}
      data-conversa-item=""
      data-realce={l.ultima_em ?? undefined}
      data-realce-proprio={ativa ? '' : undefined}
      aria-current={ativa ? 'page' : undefined}
      scroll={false}
      className={cn(
        'relative flex gap-3 border-l-2 px-3 py-2.5 transition-colors duration-150 ease-out',
        ativa ? 'border-l-brand bg-brand-soft' : 'border-l-transparent hover:bg-surface-muted',
      )}
    >
      <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-bold text-brand">
        {iniciais(nome)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate font-semibold text-foreground">{nome}</span>
          {l.espera_desde
            ? <CronometroEspera desde={l.espera_desde} limites={limites} />
            : l.ultima_em && <RelativeTime data={l.ultima_em} className="shrink-0 text-xs text-subtle" />}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-brand">{l.empresa ?? 'Empresa não definida'}</span>
          {naoLidas > 0 && (
            <span aria-label={`${naoLidas} ${naoLidas === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`}
              className="tabular inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-xs font-bold text-brand-foreground">
              {textoNaoLidas(naoLidas)}
            </span>
          )}
        </span>
        <span className="line-clamp-1 text-sm text-muted">{previaDaUltima(l)}</span>
        <span className="flex items-center gap-1 text-xs text-subtle">
          <Icone aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
          <span className="truncate">{estado.texto}</span>
        </span>
      </span>
    </Link>
  );
}
