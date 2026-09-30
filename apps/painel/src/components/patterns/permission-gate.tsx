'use client';

import { cloneElement, isValidElement, useId, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export const MOTIVO_SEM_PERMISSAO = 'Você não tem permissão para isto. Peça ao administrador na aba Usuários.';

type PropsFilho = {
  disabled?: boolean;
  tabIndex?: number;
  href?: string;
  'aria-disabled'?: boolean;
  onClick?: (e: MouseEvent) => void;
  className?: string;
};

/**
 * Mostra o conteúdo só para quem pode usar (a UI esconde o que falharia; o banco continua sendo a barreira real).
 * - `esconder` (padrão): sem permissão, não renderiza nada (ou o `alternativa`).
 * - `desabilitar`: o elemento (um só: botão ou link) aparece desabilitado, e o motivo aparece no tooltip,
 *   inclusive pelo teclado (o invólucro recebe o foco, já que elemento desabilitado não recebe).
 */
export function PermissionGate({
  permitido,
  modo = 'esconder',
  motivo = MOTIVO_SEM_PERMISSAO,
  alternativa = null,
  children,
}: {
  permitido: boolean;
  modo?: 'esconder' | 'desabilitar';
  motivo?: string;
  alternativa?: ReactNode;
  children: ReactElement<PropsFilho>;
}) {
  const idMotivo = useId();
  if (permitido) return children;
  if (modo === 'esconder' || !isValidElement(children)) return <>{alternativa}</>;

  const desabilitado = cloneElement(children, {
    disabled: true,
    'aria-disabled': true,
    tabIndex: -1,
    // Link não tem "disabled": <a> perde o href; o Link do Next mantém (é obrigatório) e o clique é cancelado.
    ...(children.type === 'a' ? { href: undefined } : {}),
    onClick: (e: MouseEvent) => e.preventDefault(),
    className: [children.props.className, 'pointer-events-none opacity-50'].filter(Boolean).join(' '),
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} aria-describedby={idMotivo} className="inline-flex cursor-not-allowed rounded-md">
          {desabilitado}
          <span id={idMotivo} className="sr-only">{motivo}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{motivo}</TooltipContent>
    </Tooltip>
  );
}
