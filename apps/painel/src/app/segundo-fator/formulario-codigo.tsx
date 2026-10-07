'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { EstadoFator } from './acoes';

/** Campo do código de 6 números; o erro aparece aqui sem recarregar (no cadastro o QR code continua o mesmo). */
export function FormularioCodigo(p: {
  acao: (estado: EstadoFator, formData: FormData) => Promise<EstadoFator>;
  fator?: string;
  depois?: string;
  rotulo: string;
}) {
  const [estado, enviar, enviando] = useActionState(p.acao, { erro: null });
  return (
    <form action={enviar} className="flex flex-col gap-3">
      {p.fator && <input type="hidden" name="fator" value={p.fator} />}
      {p.depois && <input type="hidden" name="depois" value={p.depois} />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="codigo-fator">Código do aplicativo</Label>
        <Input id="codigo-fator" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required
          aria-describedby={estado.erro ? 'codigo-fator-erro' : undefined} aria-invalid={estado.erro ? true : undefined} />
      </div>
      {estado.erro && (
        <p id="codigo-fator-erro" role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{estado.erro}</p>
      )}
      <Button type="submit" disabled={enviando}>{p.rotulo}</Button>
    </form>
  );
}
