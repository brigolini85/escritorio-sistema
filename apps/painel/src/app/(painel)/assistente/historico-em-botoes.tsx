'use client';

import { ChevronDown, History, MessageCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/cn';
import { botoesDoHistorico } from '@/lib/conversas-assistente';
import { formatarDataHora } from '@/lib/formatos';
import type { ConversaDoHistorico } from './dados-assistente';

const VISIVEIS = 2;

function Botao({ href, ativo, Icone, titulo, detalhe }: { href: string; ativo: boolean; Icone: typeof Sparkles; titulo: string; detalhe: string }) {
  return (
    <Link
      href={href}
      title={detalhe}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'inline-flex h-8 max-w-48 items-center gap-1.5 rounded-md border px-2.5 text-sm font-bold transition-colors duration-150 ease-out',
        ativo ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-input bg-surface text-foreground hover:bg-surface-muted',
      )}
    >
      <Icone aria-hidden size={14} strokeWidth={2} className="shrink-0" />
      <span className="truncate">{titulo}</span>
    </Link>
  );
}

/** Histórico em botões no topo da conversa (D14): Geral, as 2 conversas mais recentes (a aberta sempre aparece) e "+n". */
export function HistoricoEmBotoes({ conversaId, ultimaGeral, conversas, aberta }: {
  conversaId: string | null; ultimaGeral: string | null; conversas: ConversaDoHistorico[]; aberta: ConversaDoHistorico | null;
}) {
  const { botoes: visiveis, resto } = botoesDoHistorico(conversas, aberta, VISIVEIS);
  const detalhe = (c: ConversaDoHistorico) => `${c.empresa ?? 'Empresa não definida'} · ${c.mensagens === 0 ? 'nenhuma mensagem recente'
    : c.mensagens === 1 ? '1 mensagem recente' : `${c.mensagens} mensagens recentes`}`;
  return (
    <nav aria-label="Histórico do assistente">
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          <Botao href="/assistente" ativo={!conversaId} Icone={Sparkles} titulo="Geral"
            detalhe={ultimaGeral ? `Suas perguntas pela tela Assistente · última em ${formatarDataHora(ultimaGeral)}` : 'Suas perguntas pela tela Assistente'} />
        </li>
        {visiveis.map((c) => (
          <li key={c.id}>
            <Botao href={`/assistente?conversa=${c.id}`} ativo={c.id === conversaId} Icone={MessageCircle} titulo={c.nome} detalhe={detalhe(c)} />
          </li>
        ))}
        {resto.length > 0 && (
          <li>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="normal-case">
                  <History aria-hidden size={14} strokeWidth={2} />
                  +{resto.length}<span className="sr-only"> conversas</span>
                  <ChevronDown aria-hidden size={14} strokeWidth={2} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                {resto.map((c) => (
                  <DropdownMenuItem key={c.id} asChild className="h-auto py-1.5">
                    <Link href={`/assistente?conversa=${c.id}`} className="flex flex-col items-start gap-0.5">
                      <span className="font-medium text-foreground">{c.nome}</span>
                      <span className="text-xs text-muted">{detalhe(c)}</span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        )}
      </ul>
    </nav>
  );
}
