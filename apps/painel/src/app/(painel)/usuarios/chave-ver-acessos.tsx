'use client';

import { unstable_rethrow } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import { definirVerAcessos } from './ver-acessos';

/** Permissão "Ver acessos de portais" (D3, D4): à parte dos níveis, grava na hora; o administrador sempre vê. */
export function ChaveVerAcessos({ id, nome, inicial, admin }: { id: string; nome: string; inicial: boolean; admin: boolean }) {
  const [ligado, setLigado] = useState(inicial);
  const [salvando, iniciar] = useTransition();
  const mudar = (v: boolean) => iniciar(async () => {
    let r: Awaited<ReturnType<typeof definirVerAcessos>>;
    // Falha da ação (rede, 500): aviso fixo; sem o catch, o React 19 troca a página pela tela de erro.
    try {
      r = await definirVerAcessos(id, v);
    } catch (err) {
      unstable_rethrow(err);
      toast.error('Não consegui gravar agora. Tente de novo.');
      return;
    }
    if (!r.ok) { toast.error(r.erro); return; }
    setLigado(v);
    toast.success(v ? `${nome} agora vê os acessos de portais.` : `${nome} não vê mais os acessos de portais.`);
  });
  return (
    <section aria-labelledby="titulo-acessos-portais" className="mt-6 rounded-lg border border-border bg-surface p-6">
      <h2 id="titulo-acessos-portais" className="border-b border-border pb-2 text-base font-semibold text-foreground">Acessos de portais</h2>
      {admin ? (
        <p className="mt-3 text-sm text-muted">O administrador sempre vê as senhas dos portais. Cada revelação fica na auditoria.</p>
      ) : (
        <div className="mt-3 flex items-start gap-3">
          <Switch id="ver-acessos-portais" checked={ligado} disabled={salvando} onCheckedChange={mudar} />
          <div>
            <Label htmlFor="ver-acessos-portais" className={ROTULO_DE_OPCAO}>Ver acessos de portais</Label>
            <p className="text-sm text-muted">Revelar e copiar as senhas de portais na ficha do cliente. Cada revelação fica na auditoria. Grava na hora.</p>
          </div>
        </div>
      )}
    </section>
  );
}
