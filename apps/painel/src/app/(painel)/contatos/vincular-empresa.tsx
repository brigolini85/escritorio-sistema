'use client';

import { Link2 } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import { useId, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { EscolherEmpresa, type EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import type { ResultadoAcao } from './acoes';

/**
 * Seção "Empresas (n)" do painel: o "vincular empresa" no título (imagem A) abre o formulário embaixo da lista (D10).
 * A lista (com as marcações) chega pronta do servidor como `children`.
 */
export function SecaoEmpresas({ titulo, podeVincular, empresas, acao, children }: {
  titulo: string; podeVincular: boolean; empresas: EmpresaOpcao[];
  /** vincularEmpresaAoContato com o contato preso por .bind no servidor. */
  acao: (dados: FormData) => Promise<ResultadoAcao>;
  children: ReactNode;
}) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const fechar = () => { setAberto(false); setErro(null); };
  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio pela própria tela: erro aparece no campo, sem fechar o painel.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await acao(dados);
        if (!r.ok) { setErro(r.erro); return; }
        fechar();
        toast.success('Empresa vinculada.');
      } catch (err) {
        unstable_rethrow(err);
        console.error('[contatos] falha ao vincular a empresa', err);
        setErro('Não consegui vincular agora. Tente de novo.');
      }
    });
  };
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-2 border-b border-border py-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`${id}-titulo`} className="text-xs font-bold uppercase tracking-wide text-brand">{titulo}</h3>
        {podeVincular && !aberto && (
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setAberto(true)}>
            <Link2 aria-hidden size={14} strokeWidth={1.75} />
            Vincular empresa
          </Button>
        )}
      </div>
      {children}
      {aberto && (
        <form aria-label="Vincular empresa" onSubmit={enviar} className="flex flex-col gap-3 rounded-md border border-border p-3">
          {empresas.length === 0 ? (
            <p className="text-sm text-muted">Todas as empresas ativas já estão ligadas a este contato.</p>
          ) : (
            <>
              <FormField id={`${id}-empresa`} rotulo="Empresa" erro={erro}>
                <EscolherEmpresa name="cliente_id" empresas={empresas} />
              </FormField>
              <label className="flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" name="pode_pedir_nota" className="size-4 shrink-0 accent-brand" />Pode pedir nota
              </label>
              <label className="flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" name="pode_atualizar_preco" className="size-4 shrink-0 accent-brand" />Pode mudar preço e cadastrar produto
              </label>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={fechar}>Cancelar</Button>
            {empresas.length > 0 && <Button type="submit" size="sm" disabled={enviando} aria-busy={enviando || undefined}>Vincular</Button>}
          </div>
        </form>
      )}
    </section>
  );
}
