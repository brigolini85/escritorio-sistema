import Link from 'next/link';
import type { ReactNode } from 'react';
import { sair } from '../entrar/acoes';
import { itensDoMenu } from '@/lib/menu';
import { obterUsuario } from '@/lib/sessao';

export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const u = await obterUsuario();
  return (
    <div className="flex min-h-screen">
      <nav className="w-52 shrink-0 border-r bg-white p-4">
        <p className="mb-6 text-sm text-slate-500">Olá, {u.nome}</p>
        <ul className="space-y-1">
          {itensDoMenu(u.papel).map((i) => (
            <li key={i.href}><Link href={i.href} className="block rounded px-2 py-1 hover:bg-slate-100">{i.rotulo}</Link></li>
          ))}
        </ul>
        <form action={sair} className="mt-8"><button className="text-sm text-slate-500 underline">Sair</button></form>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
