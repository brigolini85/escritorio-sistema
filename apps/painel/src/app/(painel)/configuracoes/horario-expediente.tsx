'use client';

import { useId, useRef, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Início e fim do expediente (mesmos campos horario_inicio / horario_fim). O navegador já avisa no campo quando o
 * fim não é depois do início, a mesma regra do servidor, em vez de a tela de erro aparecer depois de salvar.
 */
export function HorarioExpediente({ inicio, fim, antesInicio, antesFim }: { inicio?: string; fim?: string; antesInicio?: ReactNode; antesFim?: ReactNode }) {
  const id = useId();
  const refInicio = useRef<HTMLInputElement>(null);
  const refFim = useRef<HTMLInputElement>(null);
  const conferir = () => {
    const a = refInicio.current?.value ?? '';
    const b = refFim.current;
    if (!b) return;
    b.setCustomValidity(a && b.value && b.value <= a ? 'O fim do expediente precisa ser depois do início.' : '');
  };
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-inicio`}>Das</Label>
        <Input ref={refInicio} id={`${id}-inicio`} type="time" name="horario_inicio" defaultValue={inicio} required onInput={conferir} className="w-32 tabular" />
        {antesInicio}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-fim`}>às</Label>
        <Input ref={refFim} id={`${id}-fim`} type="time" name="horario_fim" defaultValue={fim} required onInput={conferir} className="w-32 tabular" />
        {antesFim}
      </div>
    </div>
  );
}
