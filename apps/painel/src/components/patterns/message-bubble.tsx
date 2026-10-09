import { Bot, CircleAlert, CircleHelp, Info, Mic, Paperclip, ShieldOff, Sparkles, StickyNote, UserRound, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatarDataHora, formatarHora, isoOuNulo } from '@/lib/formatos';

/**
 * Autor da mensagem. Conversa com cliente: cliente, agente (robô do WhatsApp), atendente (equipe), sistema, nota interna.
 * Tela do Assistente: pessoa (quem pergunta) e assistente (IA interna, cor própria, diferente do agente).
 */
export type AutorMensagem = 'cliente' | 'agente' | 'atendente' | 'sistema' | 'nota_interna' | 'pessoa' | 'assistente';

type Estilo = { rotulo: string; Icone: LucideIcon | null; lado: 'esquerda' | 'direita' | 'inteira'; balao: string; cabecalho: string; hora: string };

const ESTILO: Record<Exclude<AutorMensagem, 'sistema'>, Estilo> = {
  cliente: { rotulo: 'Cliente', Icone: null, lado: 'esquerda', balao: 'border border-border bg-surface', cabecalho: 'text-muted', hora: 'text-subtle' },
  agente: { rotulo: 'Agente', Icone: Bot, lado: 'direita', balao: 'bg-agent-active-soft', cabecalho: 'text-agent-active', hora: 'text-agent-active' },
  atendente: { rotulo: 'Equipe', Icone: UserRound, lado: 'direita', balao: 'bg-brand-soft', cabecalho: 'text-brand', hora: 'text-brand' },
  nota_interna: {
    rotulo: 'Nota interna', Icone: StickyNote, lado: 'inteira', balao: 'border border-internal-note-border bg-internal-note',
    cabecalho: 'text-internal-note-foreground', hora: 'text-subtle',
  },
  pessoa: { rotulo: 'Você', Icone: null, lado: 'direita', balao: 'bg-brand-soft', cabecalho: 'text-brand', hora: 'text-brand' },
  assistente: { rotulo: 'Assistente', Icone: Sparkles, lado: 'esquerda', balao: 'bg-assistant-soft', cabecalho: 'text-assistant', hora: 'text-assistant' },
};

function Hora({ iso, className }: { iso: string; className?: string }) {
  return (
    <time dateTime={isoOuNulo(iso) ?? undefined} title={`${formatarDataHora(iso)} (horário de Brasília)`} className={cn('tabular', className)}>
      {formatarHora(iso)}
    </time>
  );
}

export function MessageBubble({
  autor,
  nome,
  hora,
  conteudo,
  transcricao,
  arquivo,
  falhou = false,
  incerta = false,
  bloqueada = false,
  acaoFalha,
  acaoIncerta,
  children,
  className,
}: {
  autor: AutorMensagem;
  /** Nome de quem escreveu (atendente) ou do cliente; senão vale o rótulo do autor. */
  nome?: string | null;
  hora: string;
  conteudo?: string | null;
  /** Áudio: o texto transcrito. */
  transcricao?: string | null;
  arquivo?: { nome: string; href: string } | null;
  /** Envio ao WhatsApp falhou. */
  falhou?: boolean;
  /** Auditoria 3.3: a Z-API pode ter entregado (prazo estourado, conexão caída): ninguém sabe se chegou. */
  incerta?: boolean;
  /** Prontidão (D2): o trabalhador de teste barrou o envio (número fora da lista). */
  bloqueada?: boolean;
  /** Ex.: botão "Tentar de novo" ao lado do aviso de falha. */
  acaoFalha?: ReactNode;
  /** Ex.: botão "Enviar de novo" ao lado do aviso de não confirmada. */
  acaoIncerta?: ReactNode;
  /** Conteúdo rico abaixo do texto (DiffPreview, OrderSummary, botão do CSV). */
  children?: ReactNode;
  className?: string;
}) {
  if (autor === 'sistema') {
    return (
      <div className={cn('flex items-center justify-center gap-1.5 px-4 py-1 text-center text-xs text-muted', className)}>
        <Info aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
        <span className="sr-only">Sistema:</span>
        <span className="whitespace-pre-wrap">{conteudo}</span>
        <span aria-hidden>·</span>
        <Hora iso={hora} />
      </div>
    );
  }

  const e = ESTILO[autor];
  const Icone = e.Icone;
  const rotulo = autor === 'nota_interna' ? e.rotulo : nome?.trim() || e.rotulo;

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg px-3 py-2 text-base text-foreground',
        e.lado === 'esquerda' && 'mr-auto max-w-3/4',
        e.lado === 'direita' && 'ml-auto max-w-3/4',
        e.lado === 'inteira' && 'w-full',
        e.balao,
        falhou && 'border border-danger',
        className,
      )}
    >
      <p className={cn('flex flex-wrap items-center gap-1.5 text-xs font-medium', e.cabecalho)}>
        {Icone && <Icone aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />}
        <span>{rotulo}</span>
        {autor === 'nota_interna' && <span className="font-normal">· o cliente não vê</span>}
        {autor === 'atendente' && nome && <span className="sr-only">(equipe)</span>}
        <span aria-hidden>·</span>
        <Hora iso={hora} className={cn('font-normal', e.hora)} />
      </p>

      {transcricao && (
        <div className="flex gap-2">
          <Mic aria-hidden size={16} strokeWidth={1.75} className={cn('mt-0.5 shrink-0', e.cabecalho)} />
          <p>
            <span className={cn('block text-xs font-medium', e.cabecalho)}>Áudio transcrito</span>
            <span className="whitespace-pre-wrap italic">{transcricao}</span>
          </p>
        </div>
      )}
      {conteudo && <p className="whitespace-pre-wrap break-words">{conteudo}</p>}
      {arquivo && (
        <a href={arquivo.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start rounded-sm text-brand underline-offset-4 hover:underline">
          <Paperclip aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
          {arquivo.nome}
        </a>
      )}
      {children}
      {incerta && (
        <p className="flex flex-wrap items-center gap-1.5 self-start rounded-sm bg-warning-soft px-1.5 py-0.5 text-sm font-medium text-warning">
          <CircleHelp aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
          Não confirmada: confira no WhatsApp
          {acaoIncerta}
        </p>
      )}
      {bloqueada && !falhou && (
        <p className="flex flex-wrap items-center gap-1.5 self-start rounded-sm bg-warning-soft px-1.5 py-0.5 text-sm font-medium text-warning">
          <ShieldOff aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
          Não enviada: ambiente de teste
        </p>
      )}
      {falhou && (
        <p className="flex flex-wrap items-center gap-1.5 self-start rounded-sm bg-danger-soft px-1.5 py-0.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
          Falhou ao enviar
          {acaoFalha}
        </p>
      )}
    </div>
  );
}
