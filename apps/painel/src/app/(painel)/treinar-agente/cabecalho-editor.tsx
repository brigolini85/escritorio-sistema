import { LockKeyhole } from 'lucide-react';
import { RelativeTime } from '@/components/patterns/relative-time';
import { ROTULO_TIPO, type TipoOrientacao } from '@/lib/orientacoes';
import { ChaveOrientacao } from './chave-orientacao';
import { textoCriacao } from './tela';

/**
 * Alto do editor (imagem B): tipo (· ensinada no Atendimento), título, a chave que grava na hora (a mesma da lista, D12),
 * para quem vale e quem criou.
 */
export function CabecalhoEditor({ id, titulo, tipo, ativo, ensinada, valePara, criadaPor, criadaEm }: {
  id: string;
  titulo: string;
  tipo: TipoOrientacao;
  ativo: boolean;
  ensinada: boolean;
  valePara: string;
  criadaPor: string | null;
  criadaEm: string;
}) {
  return (
    <header className="flex flex-col gap-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-info">{ROTULO_TIPO[tipo]}{ensinada ? ' · ensinada no Atendimento' : ''}</p>
          <h2 className="break-words text-2xl font-extrabold text-foreground">{titulo}</h2>
        </div>
        <ChaveOrientacao id={id} titulo={titulo} ligada={ativo} />
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
        <span>{valePara}</span>
        <span aria-hidden>·</span>
        <span>{textoCriacao(criadaPor, ensinada)}</span>
        <span aria-hidden>·</span>
        <RelativeTime data={criadaEm} />
      </p>
    </header>
  );
}

/** Lembrete fixo embaixo do editor (imagem B): nenhuma orientação muda as regras fixas do agente. */
export function RegrasFixas() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
      <LockKeyhole aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-brand" />
      <span>
        <span className="font-bold uppercase text-brand">Regras fixas sempre vencem:</span>{' '}
        sem emoji · resumo conferido antes da nota · não inventar · assunto sensível para a Direção · sigilo.
      </span>
    </p>
  );
}
