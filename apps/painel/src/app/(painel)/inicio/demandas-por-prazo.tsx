import { CalendarDays, CircleAlert, CircleCheck, Clock } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { agruparPorPrazo, detalheDaDemanda, subtituloMinhas, textoConcluidasHoje, type DemandaMesa } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';
import { BotaoConcluirInicio } from './botoes-demanda-inicio';
import { paginaInicio } from './dados-inicio';
import { contarConcluidasHoje, contarMinhas, lerMinhasDemandas } from './dados-mesa';

/** "Minhas demandas por prazo" (imagem B): Vencida · Vencem hoje · Próximos dias, cada linha com ABRIR e CONCLUIR (D12). */
export async function DemandasPorPrazo({ u }: { u: UsuarioPainel }) {
  const [minhas, contagem, concluidas, { agora }] = await Promise.all([
    lerMinhasDemandas(u.id), contarMinhas(u.id), contarConcluidasHoje(u.id), paginaInicio(),
  ]);
  const g = minhas ? agruparPorPrazo(minhas.lista, agora) : null;
  return (
    <section aria-labelledby="titulo-minhas">
      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-minhas" className="text-sm font-bold uppercase tracking-wide text-brand">Minhas demandas por prazo</h2>
          {minhas && <span className="text-sm text-subtle">{subtituloMinhas(minhas.total)}</span>}
        </div>
        {!g ? (
          <p className="text-sm text-muted">As suas demandas não puderam ser lidas agora.</p>
        ) : minhas!.total === 0 ? (
          <p className="text-sm text-muted">Nenhuma demanda com você agora.</p>
        ) : (
          <>
            <Grupo id="vencidas" titulo="Vencida" total={contagem.vencidas ?? g.vencidas.length} icone={<CircleAlert aria-hidden size={14} strokeWidth={2} />} cor="text-danger" borda="border-l-danger" lista={g.vencidas} agora={agora} />
            <Grupo id="vencem-hoje" titulo="Vencem hoje" total={contagem.hoje ?? g.hoje.length} icone={<Clock aria-hidden size={14} strokeWidth={2} />} cor="text-warning" borda="border-l-warning" lista={g.hoje} agora={agora} />
            <Grupo id="proximos" titulo="Próximos dias" total={g.proximos.length} icone={<CalendarDays aria-hidden size={14} strokeWidth={2} />} cor="text-foreground" borda="border-l-transparent" lista={g.proximos} agora={agora} />
            {minhas!.total > minhas!.lista.length && <p className="text-sm text-muted">Mostrando {minhas!.lista.length} de {minhas!.total}.</p>}
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
          <p className="flex items-center gap-1 text-muted">
            <CircleCheck aria-hidden size={14} strokeWidth={1.75} className="text-success" />
            {concluidas === null ? 'Não foi possível contar as concluídas de hoje.' : textoConcluidasHoje(concluidas)}
          </p>
          <Link href="/demandas?responsavel=eu" className="font-semibold text-brand underline-offset-4 hover:underline">
            Ver todas as minhas na Gestão das demandas <span aria-hidden>→</span>
          </Link>
        </div>
      </Card>
    </section>
  );
}

function Grupo({ id, titulo, total, icone, cor, borda, lista, agora }: {
  id: string; titulo: string; total: number; icone: ReactNode; cor: string; borda: string; lista: DemandaMesa[]; agora: Date;
}) {
  if (lista.length === 0) return null;
  return (
    <div id={id} className="scroll-mt-4">
      <h3 id={`${id}-titulo`} className={cn('flex items-center gap-1 border-b border-current pb-1 text-xs font-bold uppercase tracking-wide', cor)}>
        {icone}{titulo} <span className="tabular text-muted">{total}</span>
      </h3>
      <ul aria-labelledby={`${id}-titulo`} className="divide-y divide-border">
        {lista.map((d) => <LinhaMinha key={d.id} d={d} borda={borda} agora={agora} />)}
      </ul>
    </div>
  );
}

function LinhaMinha({ d, borda, agora }: { d: DemandaMesa; borda: string; agora: Date }) {
  const [empresa, setor, status] = detalheDaDemanda(d);
  return (
    <li className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 border-l-4 py-3 pl-3', borda)}>
      <span className="tabular w-16 shrink-0 font-bold text-foreground">#{d.numero}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">{d.titulo}</p>
        <p className="truncate text-sm text-muted"><span className="font-semibold text-brand">{empresa}</span> · {setor} · {status}</p>
      </div>
      <PrioridadeTexto prioridade={d.prioridade} caixaAlta className="w-20" />
      <PrazoTexto prazo={d.prazo_em} pausadoDesde={d.prazo_pausado_desde} concluidaEm={null} agora={agora} className="w-28 text-sm" />
      <div className="flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/demandas?demanda=${d.id}`} aria-label={`Abrir a demanda #${d.numero}`}>Abrir</Link>
        </Button>
        <BotaoConcluirInicio id={d.id} numero={d.numero} titulo={d.titulo} />
      </div>
    </li>
  );
}
