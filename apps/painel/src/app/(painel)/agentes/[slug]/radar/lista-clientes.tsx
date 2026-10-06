'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { lerClientesAfetados, type ClienteAfetado } from '@/lib/radar-acoes';

const MAXIMO = 500;

/** VER LISTA: a lista é calculada na hora pelo cadastro dos clientes (nada fica salvo). */
export function ListaClientes({ novidadeId }: { novidadeId: string }) {
  const [aberta, setAberta] = useState(false);
  const [clientes, setClientes] = useState<ClienteAfetado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    let vivo = true;
    setClientes(null); setErro(null);
    lerClientesAfetados(novidadeId).then((r) => {
      if (!vivo) return;
      if (r.ok) setClientes(r.clientes); else setErro(r.erro);
    });
    return () => { vivo = false; };
  }, [aberta, novidadeId]);

  return (
    <>
      <button type="button" onClick={() => setAberta(true)} className="cursor-pointer text-sm font-bold uppercase text-brand underline-offset-4 hover:underline">Ver lista</button>
      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="max-h-screen max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes possivelmente afetados</DialogTitle>
            <DialogDescription>Lista calculada agora pelo cadastro dos clientes (regime, CNAE/segmento, UF).</DialogDescription>
          </DialogHeader>
          {erro && <p role="alert" className="text-sm font-bold text-danger">{erro}</p>}
          {!erro && clientes === null && <p role="status" className="text-sm text-muted">Lendo a lista…</p>}
          {clientes && clientes.length === 0 && <p className="text-sm text-muted">Nenhum cliente bate com os critérios agora.</p>}
          {clientes && clientes.length > 0 && (
            <>
              <p className="text-sm text-muted">{clientes.length > MAXIMO ? `Mostrando ${MAXIMO} de ${clientes.length} clientes.` : `${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}.`}</p>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Cliente</TableHead><TableHead>Regime</TableHead><TableHead>UF / cidade</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.slice(0, MAXIMO).map((c) => (
                    <TableRow key={c.id}>
                      <TableCell><Link href={`/clientes/${c.id}`} className="font-medium text-foreground hover:underline">{c.nome}</Link></TableCell>
                      <TableCell>{c.regime ?? '—'}</TableCell>
                      <TableCell>{[c.uf, c.cidade].filter(Boolean).join(' · ') || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
