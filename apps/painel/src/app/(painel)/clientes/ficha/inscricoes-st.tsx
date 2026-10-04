'use client';

import { Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { classeSelect } from '../estilos';
import { BlocoFicha } from './campos';
import { UFS } from './ficha';

type Linha = { chave: number; uf: string; inscricao: string };

/** Fiscal · inscrições de substituto tributário: UF + inscrição; linha sem inscrição fica, como pendência (imagem). */
export function BlocoFiscal({ iniciais, erro, pode }: { iniciais: { uf: string; inscricao: string | null }[]; erro?: string; pode: boolean }) {
  const [linhas, setLinhas] = useState<Linha[]>(() => iniciais.map((l, i) => ({ chave: i, uf: l.uf, inscricao: l.inscricao ?? '' })));
  const proxima = useRef(iniciais.length);
  const assinatura = useRef<HTMLInputElement>(null);
  // Linha nova ou removida não muda campo salvo nenhum: este campo escondido avisa o "não salvo" e o índice.
  useEffect(() => {
    const el = assinatura.current;
    const valor = linhas.map((l) => l.chave).join(',');
    if (!el || el.value === valor) return;
    el.value = valor;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [linhas]);
  const mudar = (chave: number, campo: 'uf' | 'inscricao', valor: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));
  const semInscricao = linhas.filter((l) => !l.inscricao.trim()).length;

  return (
    <BlocoFicha id="fiscal" titulo="Fiscal · Inscrições de substituto tributário" pode={pode}
      aside={semInscricao > 0 && (
        <span className="inline-flex items-center gap-1 font-bold text-warning">
          <TriangleAlert aria-hidden size={14} strokeWidth={1.75} />
          {semInscricao === 1 ? '1 linha sem inscrição' : `${semInscricao} linhas sem inscrição`}
        </span>
      )}>
      <input ref={assinatura} type="text" hidden name="st_linhas" defaultValue={iniciais.map((_, i) => i).join(',')} />
      {linhas.length === 0 ? <p className="text-sm text-muted">Nenhuma inscrição de substituto tributário.</p> : (
        <div className="max-w-3xl overflow-hidden rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-xs font-extrabold uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">UF</th>
                <th scope="col" className="px-3 py-2 text-left">Inscrição estadual</th>
                <th scope="col"><span className="sr-only">Remover</span></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={l.chave} className="border-t border-border">
                  <td className="w-32 px-3 py-2">
                    <select name="st_uf" aria-label={`UF da linha ${i + 1}`} defaultValue={l.uf} className={classeSelect}
                      onChange={(e) => mudar(l.chave, 'uf', e.currentTarget.value)}>
                      <option value="">UF</option>
                      {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input name="st_inscricao" aria-label={`Inscrição da linha ${i + 1}`} defaultValue={l.inscricao} placeholder="informe a inscrição"
                      autoComplete="off" className={cn(!l.inscricao.trim() && 'border-warning')}
                      onChange={(e) => mudar(l.chave, 'inscricao', e.currentTarget.value)} />
                  </td>
                  <td className="w-12 px-2 py-2 text-right">
                    {pode && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Remover a linha ${i + 1}`}
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}>
                        <Trash2 aria-hidden size={16} strokeWidth={1.75} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {erro && <p className="mt-2 text-sm text-danger">{erro}</p>}
      {pode && (
        <Button type="button" variant="link" className="mt-3" onClick={() => setLinhas((ls) => [...ls, { chave: proxima.current++, uf: '', inscricao: '' }])}>
          <Plus aria-hidden size={16} strokeWidth={1.75} />
          Adicionar inscrição
        </Button>
      )}
    </BlocoFicha>
  );
}
