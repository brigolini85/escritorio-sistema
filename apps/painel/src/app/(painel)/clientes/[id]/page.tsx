import { notFound } from 'next/navigation';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { textoDoErro } from '@/lib/erro-na-url-servidor';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { AvisoArquivado } from '@/components/patterns/lista-arquivados';
import { nomeDaPessoa } from '@/lib/arquivados';
import { cn } from '@/lib/cn';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { CabecalhoFicha } from '../ficha/cabecalho-ficha';
import { DadosFicha } from '../ficha/dados-ficha';
import { ABAS, AbasCliente, EscolhaParceiros, type Aba } from './abas';
import { SecaoContatos } from './secao-contatos';
import { SecaoDados } from './secao-dados-antiga';
import { SecaoDocumentos } from './secao-documentos';
import { SecaoParceiros } from './secao-parceiros';
import { SecaoPrecos } from './secao-precos';
import { SecaoProdutos } from './secao-produtos';

/**
 * Ficha da empresa. As abas são links (?aba=); cada seção lê só o que mostra. A aba Dados é a ficha completa (spec 7D.1);
 * sem a migração da Parte H1 no banco (homologação), volta a aba de hoje com um aviso (D23).
 */
export default async function FichaClientePagina({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; historico?: string; erro?: string; contato?: string }>;
}) {
  const { id } = await params;
  const { aba: pedida, historico, erro: erroNaUrl, contato } = await searchParams;
  // Revisão final (T11): só código conhecido ou assinado vira texto.
  const erro = textoDoErro(erroNaUrl);
  const aba: Aba = ABAS.some((a) => a.valor === pedida) ? (pedida as Aba) : 'dados';
  const u = await obterUsuario();
  const pode = temNivel(u, 'clientes', 'editar');
  // Arquivar e restaurar exigem "Editar e arquivar" (Parte D); o banco (exigir_arquivar) recusa de novo.
  const podeArquivar = temNivel(u, 'clientes', 'arquivar');
  const sb = await supabaseServidor();
  const { data: c, error } = await sb.from('clientes').select('*').eq('id', id).maybeSingle();
  // Falha de leitura vai para a tela de erro (tentar de novo), não para "não encontrado": o cliente pode existir.
  // Endereço com id que nem é uuid (22P02) continua "não encontrado".
  if (error && error.code !== '22P02') throw new Error(`Não foi possível ler o cliente: ${error.message}`);
  if (!c) notFound();
  // select('*') devolve só as colunas que existem: sem a migração da H1 a linha não traz logradouro (D23).
  const fichaNova = 'logradouro' in c;
  const arquivadoPor = c.ativo ? null : await nomeDaPessoa(sb, c.arquivado_por);

  return (
    <div className={cn('flex flex-col gap-4', aba !== 'dados' && 'max-w-5xl')}>
      <CabecalhoFicha c={c} agora={new Date()} />
      {!c.ativo && <AvisoArquivado tipo="cliente" id={c.id} nome={c.razao_social} arquivadoEm={c.arquivado_em} arquivadoPor={arquivadoPor} pode={podeArquivar} />}
      <AvisoErro erro={erro} prefixo="Não foi possível salvar: " />
      <AbasCliente id={id} atual={aba} />
      {(aba === 'clientes' || aba === 'fornecedores') && <EscolhaParceiros id={id} atual={aba} />}
      {aba === 'dados' && fichaNova && <DadosFicha c={c} u={u} />}
      {aba === 'dados' && !fichaNova && (
        <>
          <p role="note" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted">
            A ficha completa aparece quando a atualização do banco da Parte H for aplicada.
          </p>
          <SecaoDados id={id} u={u} pode={pode} c={c} erro={erro} />
        </>
      )}
      {aba === 'contatos' && <SecaoContatos id={id} u={u} pode={pode} aberto={contato ?? null} />}
      {aba === 'clientes' && <SecaoParceiros id={id} tipo="cliente" pode={pode} podeArquivar={podeArquivar} />}
      {aba === 'fornecedores' && <SecaoParceiros id={id} tipo="fornecedor" pode={pode} podeArquivar={podeArquivar} />}
      {aba === 'produtos' && <SecaoProdutos id={id} pode={pode} podeArquivar={podeArquivar} />}
      {aba === 'precos' && <SecaoPrecos id={id} podeEditar={temNivel(u, 'precos', 'mudar')} historico={historico} />}
      {aba === 'documentos' && <SecaoDocumentos id={id} pode={pode} admin={u.papel === 'admin'} />}
      {aba === 'dados' && podeArquivar && c.ativo && <ExcluirCadastro tipo="cliente" id={c.id} nome={c.razao_social} variante="area" voltarPara="/clientes" />}
    </div>
  );
}
