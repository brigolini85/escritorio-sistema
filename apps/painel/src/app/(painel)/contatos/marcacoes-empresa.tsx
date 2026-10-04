'use client';

import { unstable_rethrow } from 'next/navigation';
import { useOptimistic, useTransition } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/toaster';
import type { CampoMarcacao, ResultadoAcao } from './acoes';

const CAMPOS: { campo: CampoMarcacao; rotulo: string }[] = [
  { campo: 'pode_pedir_nota', rotulo: 'Pode pedir nota' },
  { campo: 'pode_atualizar_preco', rotulo: 'Pode mudar preço e cadastrar produto' },
];

/**
 * As duas marcações de uma empresa do contato (D9). Cada caixa grava ao clicar, otimista: muda na hora e volta, com aviso, se
 * a ação recusar. Enquanto grava, não aceita outro clique.
 */
export function MarcacoesEmpresa({ empresa, nota, preco, pode, acao }: {
  empresa: string; nota: boolean; preco: boolean; pode: boolean;
  /** marcarEmpresaDoContato com contato e empresa presos por .bind no servidor. */
  acao: (campo: CampoMarcacao, valor: boolean) => Promise<ResultadoAcao>;
}) {
  const [valores, setValores] = useOptimistic<Record<CampoMarcacao, boolean>>({ pode_pedir_nota: nota, pode_atualizar_preco: preco });
  const [pendente, iniciar] = useTransition();
  const mudar = (campo: CampoMarcacao, valor: boolean) => {
    if (pendente) return;
    iniciar(async () => {
      setValores((v) => ({ ...v, [campo]: valor }));
      try {
        const r = await acao(campo, valor);
        if (!r.ok) toast.error(r.erro);
      } catch (e) {
        unstable_rethrow(e);
        console.error('[contatos] falha ao gravar a marcação', e);
        toast.error(`Não consegui gravar a marcação em ${empresa}. Tente de novo.`);
      }
    });
  };
  return (
    <div role="group" aria-label={empresa} aria-busy={pendente || undefined} className="flex flex-col gap-1">
      {CAMPOS.map((c) => (
        <label key={c.campo} className="flex items-center gap-2 text-base text-foreground">
          <Checkbox checked={valores[c.campo]} disabled={!pode || pendente} onCheckedChange={(v) => mudar(c.campo, v === true)} />
          {c.rotulo}
        </label>
      ))}
    </div>
  );
}
