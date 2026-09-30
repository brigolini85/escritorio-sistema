import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';

type PropsCampo = { id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false'; required?: boolean };

/**
 * Rótulo, campo, ajuda e erro em vermelho logo abaixo (padrão do sistema).
 * O campo (um único elemento: Input, Textarea, select...) recebe id, aria-describedby e aria-invalid;
 * `name` e o resto das props do campo não mudam, então o formulário envia o mesmo de antes.
 */
export function FormField({
  id,
  rotulo,
  ajuda,
  erro,
  obrigatorio = false,
  className,
  children,
}: {
  id: string;
  rotulo: ReactNode;
  ajuda?: ReactNode;
  erro?: ReactNode;
  obrigatorio?: boolean;
  className?: string;
  children: ReactElement<PropsCampo>;
}) {
  const idAjuda = ajuda ? `${id}-ajuda` : undefined;
  const idErro = erro ? `${id}-erro` : undefined;
  const descritos = [children.props['aria-describedby'], idAjuda, idErro].filter(Boolean).join(' ') || undefined;
  const campo = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': descritos,
        ...(erro ? { 'aria-invalid': true } : {}),
        ...(obrigatorio ? { required: children.props.required ?? true } : {}),
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {rotulo}
        {obrigatorio && <span aria-hidden className="text-danger">*</span>}
      </Label>
      {campo}
      {ajuda && <p id={idAjuda} className="text-sm text-muted">{ajuda}</p>}
      {erro && <p id={idErro} className="text-sm text-danger">{erro}</p>}
    </div>
  );
}
