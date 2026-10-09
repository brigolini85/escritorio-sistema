'use client';

import {
  BriefcaseBusiness, CalendarOff, Clock, Cpu, ExternalLink, Hourglass, IdCard, Landmark, MessageSquareText, MessagesSquare, Network, Plug, Timer, Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAlgumAlterado } from '@/components/patterns/formulario-alteravel';
import { cn } from '@/lib/cn';
import { GRUPOS_CONFIG, hrefSecao, secaoDoHash, type GrupoSecao, type IdSecao } from '@/lib/configuracoes';

export type ItemMenuConfig = { id: IdSecao; rotulo: string; grupo: GrupoSecao; contagem?: number; resumo: string; atencao?: boolean };

const ICONE: Record<IdSecao, LucideIcon> = {
  expediente: Clock, prazos: Hourglass, feriados: CalendarOff, mensagens: MessageSquareText, pagamento: Landmark, respostas: MessagesSquare,
  espera: Timer, ia: Cpu, setores: Network, servicos: BriefcaseBusiness, cargos: IdCard, integracoes: Plug,
};
const ITEM = 'flex items-start gap-3 border-l-2 px-4 py-2 text-base text-foreground transition-colors duration-150 ease-out hover:bg-surface-muted';

/**
 * Menu de Configurações (spec 7C.4, imagem 00-configuracoes-opcao-a): grupos, contagem, resumo do valor de hoje em letra
 * pequena (ideia da B) e "não salvo" na seção aberta quando há alteração pendente (D13). Uma seção por vez (?secao=).
 */
export function MenuSecoes({ itens, atual, linkUsuarios }: { itens: ItemMenuConfig[]; atual: IdSecao; linkUsuarios: boolean }) {
  const naoSalvo = useAlgumAlterado();
  const router = useRouter();
  // data-hidratado: os e2e esperam o React tomar a página antes de digitar (o menu e a seção hidratam juntos).
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);
  // Link de antes com âncora (/configuracoes#teto-ia, atalho do WhatsApp antigo): abre a seção certa (D12).
  useEffect(() => {
    const id = secaoDoHash(window.location.hash);
    if (id && id !== atual && !new URLSearchParams(window.location.search).has('secao')) router.replace(hrefSecao(id));
  }, [atual, router]);
  return (
    <nav
      aria-label="Seções das configurações"
      data-hidratado={hidratado ? '' : undefined}
      className="rounded-lg border border-border bg-surface py-1 lg:sticky lg:abaixo-cabecalho lg:w-64 lg:shrink-0"
    >
      {GRUPOS_CONFIG.map((grupo) => {
        const doGrupo = itens.filter((i) => i.grupo === grupo);
        const comUsuarios = grupo === 'Sistema' && linkUsuarios;
        if (doGrupo.length === 0 && !comUsuarios) return null;
        return (
          <div key={grupo} className="border-b border-border py-2 last:border-b-0">
            <h2 className="px-4 pb-1 pt-2 text-xs font-extrabold uppercase tracking-wider text-brand">{grupo}</h2>
            <ul>
              {doGrupo.map((i) => {
                const Icone = ICONE[i.id];
                const aqui = i.id === atual;
                return (
                  <li key={i.id}>
                    <Link
                      href={hrefSecao(i.id)}
                      aria-current={aqui ? 'page' : undefined}
                      className={cn(ITEM, aqui ? 'border-brand bg-brand-soft font-bold text-brand hover:bg-brand-soft' : 'border-transparent')}
                    >
                      <Icone aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block">{i.rotulo}</span>
                        {i.resumo && (
                          <span title={i.resumo} className={cn('hidden truncate text-xs font-normal lg:block', i.atencao ? 'text-warning' : 'text-muted')}>{i.resumo}</span>
                        )}
                      </span>
                      {aqui && naoSalvo ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-warning">
                          <span aria-hidden className="size-2 rounded-full bg-warning" />
                          não salvo
                        </span>
                      ) : i.contagem !== undefined ? (
                        <span className="tabular shrink-0 text-sm font-normal text-muted">{i.contagem}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
              {comUsuarios && (
                <li>
                  <Link href="/usuarios" className={cn(ITEM, 'border-transparent')}>
                    <Users aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                    <span className="flex-1">Usuários e permissões</span>
                    <ExternalLink aria-hidden size={14} strokeWidth={1.75} className="mt-1 shrink-0 text-muted" />
                  </Link>
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
