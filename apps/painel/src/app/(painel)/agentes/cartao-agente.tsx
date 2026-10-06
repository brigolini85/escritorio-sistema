import Link from 'next/link';
import {
  Bot, BookOpen, Briefcase, Calculator, ChevronRight, CircleUserRound, Clock, FileCheck, ListChecks, MessageCircle, Radar, Receipt, Settings, Users, Wrench,
} from 'lucide-react';
import { ROTULO_ESTADO, ROTULO_TIPO_AGENTE } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Agente, Contagens, NumerosAgente } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarUSD } from '@/lib/formatos';
import { falaComOCliente, percentualSozinho } from './lista';

/** Ícone por agente: os iniciais têm o seu; os criados pela tela, o robô. */
export const ICONE_AGENTE: Record<string, typeof Bot> = {
  atendimento: MessageCircle, radar: Radar, fiscal: Receipt, contabil: Calculator, pessoal: Users, legalizacao: FileCheck, comercial: Briefcase,
};
const COR_ESTADO = { ligado: 'success', teste: 'warning', desligado: 'neutral' } as const;
const FAIXA_ESTADO = { ligado: 'border-t-success', teste: 'border-t-warning', desligado: 'border-t-border' } as const;

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-3">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{rotulo}</span>
      <span className="tabular text-2xl font-extrabold text-foreground">{valor}</span>
    </div>
  );
}

/** Cartão da tela Agentes (spec 7E.2, imagem 00-agentes-lista): estado em destaque, contagens, números do mês e o modo de falar. */
export function CartaoAgente({ agente: a, contagens: c, numeros: n, mostrarNumeros, contatosTeste }: {
  agente: Agente; contagens: Contagens; numeros: NumerosAgente | undefined; mostrarNumeros: boolean; contatosTeste: number;
}) {
  const Icone = ICONE_AGENTE[a.slug] ?? Bot;
  const fala = falaComOCliente(a);
  const configurado = a.portaDeEntrada || c.skills + c.ferramentas + c.orientacoes > 0 || a.modoContato !== null;
  const usado = !!n && (n.atendimentos > 0 || n.custoUsd > 0);
  const pct = percentualSozinho(n);
  return (
    <Card className={cn('flex w-full flex-col gap-3 border-t-4 p-4', FAIXA_ESTADO[a.estado])} data-testid={`agente-${a.slug}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-muted text-brand"><Icone aria-hidden size={20} /></span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-lg font-extrabold text-foreground">
            {a.nome}{a.portaDeEntrada && <span className="font-normal text-muted"> · Atendimento</span>}
          </h2>
          <div className="flex flex-wrap gap-1">
            {a.tipos.map((t) => <Badge key={t} variant="outline">{ROTULO_TIPO_AGENTE[t]}</Badge>)}
          </div>
          <p className="text-sm text-muted">{a.descricao}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={COR_ESTADO[a.estado]} className="uppercase">● {ROTULO_ESTADO[a.estado]}</Badge>
          {a.estado === 'teste' && <span className="text-xs text-muted">{contatosTeste === 1 ? '1 contato' : `${contatosTeste} contatos`}</span>}
        </div>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <span className="inline-flex items-center gap-1"><BookOpen aria-hidden size={14} /><b className="text-foreground">{c.skills}</b> skills</span>
        <span className="inline-flex items-center gap-1"><Wrench aria-hidden size={14} /><b className="text-foreground">{c.ferramentas}</b> ferramentas</span>
        <span className="inline-flex items-center gap-1"><ListChecks aria-hidden size={14} /><b className="text-foreground">{c.orientacoes}</b> orientações</span>
      </p>
      {mostrarNumeros && usado && (
        <div className="grid grid-cols-3 divide-x divide-border rounded-md border border-border">
          <Numero rotulo="Conversas" valor={String(n!.atendimentos)} />
          <Numero rotulo="Sozinho" valor={pct === null ? '—' : `${pct}%`} />
          <Numero rotulo="Custo" valor={formatarUSD(n!.custoUsd + n!.custoTestesUsd)} />
        </div>
      )}
      {!configurado && (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">
          <Settings aria-hidden size={14} />Ainda não configurado
        </p>
      )}
      {/* Marcadores rotulados do que vem depois (D26): nada clicável. */}
      {a.tipos.includes('trabalho') && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">Tarefas de trabalho: pedidas dentro das demandas do setor.</p>
      )}
      {a.slug === 'radar' && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted">Novidades da legislação: chegam na etapa do Radar.</p>
      )}
      <p className="inline-flex items-center gap-1.5 text-sm text-muted">
        <CircleUserRound aria-hidden size={14} />Fala com o cliente: <b className="text-foreground">{fala.modo}</b>{fala.detalhe && <span>({fala.detalhe})</span>}
      </p>
      <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="inline-flex items-center gap-1 text-muted">
          <Clock aria-hidden size={14} />
          {mostrarNumeros && n?.ultimaEm ? `${formatarDataHora(n.ultimaEm)}${n.ultimaEmpresa ? ` · ${n.ultimaEmpresa}` : ''}` : !mostrarNumeros || usado || a.portaDeEntrada ? '—' : 'nunca usado'}
        </span>
        <Link href={`/agentes/${a.slug}`} aria-label={`Abrir ${a.nome}`} className="inline-flex items-center gap-1 font-bold uppercase text-brand">
          {configurado ? 'Abrir' : 'Configurar'}<ChevronRight aria-hidden size={14} />
        </Link>
      </div>
    </Card>
  );
}
