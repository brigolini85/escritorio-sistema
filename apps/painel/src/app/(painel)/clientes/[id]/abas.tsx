import Link from 'next/link';

export const ABAS = [
  { valor: 'dados', rotulo: 'Dados' },
  { valor: 'contatos', rotulo: 'Contatos' },
  { valor: 'clientes', rotulo: 'Clientes da empresa' },
  { valor: 'fornecedores', rotulo: 'Fornecedores' },
  { valor: 'produtos', rotulo: 'Produtos' },
  { valor: 'precos', rotulo: 'Preços' },
  { valor: 'documentos', rotulo: 'Documentos' },
] as const;
export type Aba = (typeof ABAS)[number]['valor'];

export function AbasCliente({ id, atual }: { id: string; atual: Aba }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b">
      {ABAS.map((a) => (
        <Link key={a.valor} href={`/clientes/${id}?aba=${a.valor}`}
          className={`rounded-t px-3 py-2 text-sm ${a.valor === atual ? 'border border-b-white bg-white font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}>
          {a.rotulo}
        </Link>
      ))}
    </nav>
  );
}
