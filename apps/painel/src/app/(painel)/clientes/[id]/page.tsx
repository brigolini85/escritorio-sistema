import { notFound } from 'next/navigation';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ABAS, AbasCliente, type Aba } from './abas';
import { SecaoContatos } from './secao-contatos';
import { SecaoDados } from './secao-dados';
import { SecaoParceiros } from './secao-parceiros';
import { SecaoPrecos } from './secao-precos';
import { SecaoProdutos } from './secao-produtos';

export default async function FichaCliente({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; historico?: string }>;
}) {
  const { id } = await params;
  const { aba: pedida, historico } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? (pedida as Aba) : 'dados';
  const u = await obterUsuario();
  const pode = temPermissao(u, 'editar_clientes');
  const sb = await supabaseServidor();
  const { data: c } = await sb.from('clientes').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-xl font-semibold">{c.nome_fantasia ?? c.razao_social}</h1>
      <AbasCliente id={id} atual={aba} />
      {aba === 'dados' && <SecaoDados id={id} u={u} pode={pode} c={c} />}
      {aba === 'contatos' && <SecaoContatos id={id} u={u} pode={pode} />}
      {aba === 'clientes' && <SecaoParceiros id={id} tipo="cliente" pode={pode} />}
      {aba === 'fornecedores' && <SecaoParceiros id={id} tipo="fornecedor" pode={pode} />}
      {aba === 'produtos' && <SecaoProdutos id={id} pode={pode} />}
      {aba === 'precos' && <SecaoPrecos id={id} podeEditar={temPermissao(u, 'editar_precos')} historico={historico} />}
    </div>
  );
}
