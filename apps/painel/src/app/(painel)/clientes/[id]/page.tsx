import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { DocumentText } from '@/components/patterns/document-text';
import { Badge } from '@/components/ui/badge';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AvisoErro } from '../aviso-erro';
import { ABAS, AbasCliente, EscolhaParceiros, type Aba } from './abas';
import { SecaoContatos } from './secao-contatos';
import { SecaoDados } from './secao-dados';
import { SecaoDocumentos } from './secao-documentos';
import { SecaoParceiros } from './secao-parceiros';
import { SecaoPrecos } from './secao-precos';
import { SecaoProdutos } from './secao-produtos';

/**
 * Ficha da empresa. As abas são links (?aba=); cada seção lê só o que mostra.
 * Quem não tem "Editar clientes" vê tudo em modo leitura (campos desabilitados ou texto), sem os botões de salvar.
 */
export default async function FichaCliente({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; historico?: string; erro?: string }>;
}) {
  const { id } = await params;
  const { aba: pedida, historico, erro } = await searchParams;
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? (pedida as Aba) : 'dados';
  const u = await obterUsuario();
  const pode = temPermissao(u, 'editar_clientes');
  const sb = await supabaseServidor();
  const { data: c } = await sb.from('clientes').select('*').eq('id', id).maybeSingle();
  if (!c) notFound();
  const nome = c.nome_fantasia ?? c.razao_social;

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        className="mb-0"
        titulo={nome}
        migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: nome }]}
        descricao={(
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {c.nome_fantasia && <span>{c.razao_social}</span>}
            <span>CNPJ <DocumentText valor={c.cnpj} tipo="cnpj" /></span>
            {!c.ativo && <Badge variant="neutral">Inativa</Badge>}
            {c.agente_pausado && <Badge variant="agent-paused">Agente pausado para esta empresa</Badge>}
          </span>
        )}
      />
      <AvisoErro erro={erro} />
      <AbasCliente id={id} atual={aba} />
      {(aba === 'clientes' || aba === 'fornecedores') && <EscolhaParceiros id={id} atual={aba} />}
      {aba === 'dados' && <SecaoDados id={id} u={u} pode={pode} c={c} erro={erro} />}
      {aba === 'contatos' && <SecaoContatos id={id} u={u} pode={pode} />}
      {aba === 'clientes' && <SecaoParceiros id={id} tipo="cliente" pode={pode} />}
      {aba === 'fornecedores' && <SecaoParceiros id={id} tipo="fornecedor" pode={pode} />}
      {aba === 'produtos' && <SecaoProdutos id={id} pode={pode} />}
      {aba === 'precos' && <SecaoPrecos id={id} podeEditar={temPermissao(u, 'editar_precos')} historico={historico} />}
      {aba === 'documentos' && <SecaoDocumentos id={id} pode={pode} admin={u.papel === 'admin'} />}
    </div>
  );
}
