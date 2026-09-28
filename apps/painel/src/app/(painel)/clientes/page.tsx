import Link from 'next/link';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export default async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await obterUsuario();
  // Vírgula, parênteses e * têm significado no filtro `or` do PostgREST: tirar para a busca não quebrar.
  const q = ((await searchParams).q ?? '').replace(/[,()*%\\]/g, ' ').trim();
  const sb = await supabaseServidor();
  let consulta = sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').order('razao_social');
  if (q) consulta = consulta.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,cnpj.ilike.%${q.replace(/\D/g, '') || q}%`);
  const { data } = await consulta;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        {temPermissao(u, 'editar_clientes') && <Link href="/clientes/novo" className="rounded bg-slate-900 px-3 py-1 text-white">Novo cliente</Link>}
      </div>
      <form className="mb-4"><input name="q" defaultValue={q} placeholder="Buscar por nome ou CNPJ" className="w-80 rounded border p-2" /></form>
      <ul className="divide-y rounded-lg border bg-white">
        {(data ?? []).map((c) => (
          <li key={c.id}><Link href={`/clientes/${c.id}`} className="block p-3 hover:bg-slate-50">
            <span className="font-medium">{c.nome_fantasia ?? c.razao_social}</span>
            <span className="ml-2 text-sm text-slate-500">{c.cnpj}{c.ativo ? '' : ' · inativo'}</span>
          </Link></li>
        ))}
      </ul>
    </section>
  );
}
