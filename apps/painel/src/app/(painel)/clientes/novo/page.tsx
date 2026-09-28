import { redirect } from 'next/navigation';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { salvarCliente } from '../acoes';

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) redirect('/clientes');
  return (
    <section className="max-w-xl">
      <h1 className="mb-4 text-xl font-semibold">Novo cliente</h1>
      {erro && <p role="alert" className="mb-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">Não foi possível salvar: {erro}</p>}
      <form action={salvarCliente.bind(null, null)} className="space-y-3 rounded-lg border bg-white p-4">
        <label className="block text-sm">Razão social<input name="razao_social" required className="mt-1 w-full rounded border p-2" /></label>
        <label className="block text-sm">Nome fantasia<input name="nome_fantasia" className="mt-1 w-full rounded border p-2" /></label>
        <label className="block text-sm">CNPJ<input name="cnpj" required className="mt-1 w-full rounded border p-2" /></label>
        <button className="rounded bg-slate-900 px-4 py-2 text-white">Salvar</button>
      </form>
    </section>
  );
}
