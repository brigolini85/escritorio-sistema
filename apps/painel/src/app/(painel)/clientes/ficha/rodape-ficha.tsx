'use client';

import { Save } from 'lucide-react';
import Link from 'next/link';
import { BotaoSalvar, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import { Button, variantesBotao } from '@/components/ui/button';

/** Rodapé fixo da ficha (imagem): última alteração à esquerda; CANCELAR e SALVAR à direita. */
export function RodapeFicha({ ultima, pode, novo, hidratado, enviando, aoCancelar }: {
  ultima: string | null; pode: boolean; novo: boolean; hidratado: boolean; enviando: boolean; aoCancelar: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 border-t-2 border-brand bg-surface px-4 py-3">
      <p className="text-sm text-muted">
        {ultima ? `Última alteração: ${ultima}` : novo ? 'Cliente novo: preencha e salve.' : 'Nenhuma alteração registrada por pessoas.'}
        {!pode && ' · Só quem pode editar clientes altera estes dados.'}
      </p>
      {pode && (
        <div className="flex items-center gap-3">
          <IndicadorAlteracoes />
          {novo
            ? <Link href="/clientes" className={variantesBotao({ variant: 'outline' })}>Cancelar</Link>
            : <Button type="button" variant="outline" onClick={aoCancelar}>Cancelar</Button>}
          {/* Desligado até hidratar: o clique (de gente ou do Playwright) nunca cai no envio nativo sem o onSubmit (D26). */}
          <BotaoSalvar enviando={enviando} disabled={!hidratado || enviando}>
            <Save aria-hidden size={16} strokeWidth={1.75} />
            Salvar
          </BotaoSalvar>
        </div>
      )}
    </div>
  );
}
