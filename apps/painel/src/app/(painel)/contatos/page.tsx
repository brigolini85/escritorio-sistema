import Link from 'next/link';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato } from '../atendimento/acoes';
import { cadastrarContato } from './acoes';

/** Todos os contatos cadastrados, com as empresas a que estão ligados e se o agente atende cada um. */
export default async function Contatos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const u = await obterUsuario();
  const pode = temPermissao(u, 'editar_clientes');
  // Vírgula, parênteses e * têm significado no filtro `or` do PostgREST.
  const q = ((await searchParams).q ?? '').replace(/[,()*%\\]/g, ' ').trim();
  const sb = await supabaseServidor();
  let consulta = sb.from('contatos')
    .select('id, nome, telefone, agente_pausado, ativo, contato_clientes(clientes(id, razao_social, nome_fantasia))')
    .order('nome');
  if (q) consulta = consulta.or(`nome.ilike.%${q}%,telefone.ilike.%${q.replace(/\D/g, '') || q}%`);
  const { data: contatos } = await consulta;

  return (
    <section className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">Contatos</h1>
      <p className="text-sm text-slate-500">Para ligar um contato a uma empresa, abra a empresa em Clientes → aba Contatos → "Vincular contato já cadastrado".</p>
      <form><input name="q" defaultValue={q} placeholder="Buscar por nome ou telefone" className="w-80 rounded border p-2" /></form>
      {(contatos ?? []).length === 0 && <p className="text-slate-500">Nenhum contato encontrado.</p>}
      <ul className="divide-y rounded-lg border bg-white text-sm">
        {(contatos ?? []).map((c) => {
          const empresas = c.contato_clientes.flatMap((v) => (v.clientes ? [v.clientes] : []));
          return (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{c.nome} · {c.telefone}{c.ativo ? '' : ' · inativo'}</p>
                <p className="text-slate-500">
                  {empresas.length === 0 ? 'sem empresa' : empresas.map((e, i) => (
                    <span key={e.id}>{i > 0 ? ', ' : ''}<Link href={`/clientes/${e.id}?aba=contatos`} className="underline">{e.nome_fantasia ?? e.razao_social}</Link></span>
                  ))}
                  {' · '}
                  <span className={c.agente_pausado ? 'text-amber-700' : 'text-emerald-700'}>{c.agente_pausado ? 'agente desligado' : 'agente atende'}</span>
                </p>
              </div>
              {pode && (
                <form action={alternarAgenteContato.bind(null, c.id, null, c.agente_pausado)}>
                  <button className="rounded border px-2 py-1">{c.agente_pausado ? 'Ligar o agente' : 'Desligar o agente'}</button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      {pode && (
        <form action={cadastrarContato} className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 text-sm">
          <input name="nome" required placeholder="Nome" className="rounded border p-2" />
          <input name="telefone" required placeholder="Telefone (com DDD)" className="rounded border p-2" />
          <label className="flex items-center gap-1"><input type="checkbox" name="agente_atende" defaultChecked /> O agente atende</label>
          <button className="rounded bg-slate-900 px-3 py-2 text-white">Cadastrar contato</button>
        </form>
      )}
    </section>
  );
}
