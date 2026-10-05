import type { Perfil } from '@escritorio/core';
import { FilterX, UserPlus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { BotaoCadastrarContato, FormCadastroContato } from '@/components/patterns/form-cadastro-contato';
import { LinkArquivados, TelaArquivados } from '@/components/patterns/lista-arquivados';
import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';
import { variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { lerPerfisDaPagina } from '@/lib/acesso-contato';
import { contarArquivados } from '@/lib/arquivados';
import { lerFiltrosContatos, ORDEM_PADRAO_CONTATOS, ORDENS_CONTATOS, temFiltroContatos } from '@/lib/contatos';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams, lerOrdem, lerPagina, PARAM_PAGINA, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { cadastrarContato } from './acoes';
import { AcoesLinhaContato } from './acoes-linha';
import { BarraContatos } from './barra-contatos';
import { colunasContatos } from './colunas-contatos';
import { lerEmpresasAtivas, lerListaContatos } from './dados-contatos';
import { DetalheContato, EsqueletoContato } from './detalhe-contato';
import { Hidratado } from './hidratado';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Contatos (spec 7C.2, imagem A): tabela pelo último contato, busca por nome, telefone ou empresa, filtros rápidos com contagem,
 * empresa e período — na URL e no servidor (visão contatos_lista, pela regra de leitura de cada pessoa).
 * ?contato=<id> abre o painel lateral; ?ver=arquivados, os arquivados.
 */
export default async function Contatos({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const params = await searchParams;
  const u = await obterUsuario();
  const pode = temNivel(u, 'clientes', 'editar');
  // Arquivar e restaurar exigem "Editar e arquivar" (Parte D); o banco (exigir_arquivar) recusa de novo.
  const podeArquivar = temNivel(u, 'clientes', 'arquivar');
  // Abrir conversa: a tela do Atendimento não abre com "Sem acesso"; a conversa ainda passa pela regra de leitura (D8).
  const podeConversa = temNivel(u, 'atendimento', 'meus_setores');
  const veTodas = temNivel(u, 'atendimento', 'todas');
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="contato" titulo="Contatos arquivados" voltar={{ rotulo: 'Contatos', href: '/contatos' }} pode={podeArquivar} />;
  }
  const f = lerFiltrosContatos(params);
  const ordem = lerOrdem(params, ORDENS_CONTATOS, ORDEM_PADRAO_CONTATOS)!;
  const aberto = valorParam(params, 'contato');
  const contatoAberto = aberto && UUID.test(aberto) ? aberto : null;
  const agora = new Date();
  const sb = await supabaseServidor();
  // As empresas só servem ao filtro "Empresa", que some sem a visão da G3 (D14): nem são lidas nesse caso.
  const [[lista, empresas], arquivados] = await Promise.all([
    lerListaContatos(sb, f, ordem, lerPagina(params), agora)
      .then(async (l) => [l, l.completa ? await lerEmpresasAtivas(sb) : []] as const),
    contarArquivados(sb, 'contato'),
  ]);
  // Coluna Perfil (H2): sem a migração no banco, a tabela fica como antes (D24).
  const perfisLidos = lista.linhas.length ? await lerPerfisDaPagina(sb, lista.linhas.map((l) => l.id)) : new Map<string, Map<string, Perfil>>();
  // Os links de ordem e de página da tabela não reabrem o painel em edição.
  const paramsTabela = { ...params, editar: undefined };

  // Abrir e fechar o painel mantém a página da tabela.
  const pagina = lista.paginacao.pagina > 1 ? lista.paginacao.pagina : null;
  const hrefContato = (id: string | null) => `/contatos${hrefComParams(params, { contato: id, editar: null, [PARAM_PAGINA]: pagina })}`;
  const filtrando = temFiltroContatos(f);

  return (
    <section>
      <Hidratado />
      <PageHeader
        titulo="Contatos"
        contagem={lista.paginacao.total}
        descricao="Quem fala pelas empresas no WhatsApp."
        acoes={(
          <>
            <LinkArquivados href="/contatos?ver=arquivados" total={arquivados} />
            {pode && (
              // D7: o cadastro continua no cartão do fim da página (a pergunta do contato arquivado da Parte B vem junto).
              <a href="#novo-contato" className={variantesBotao({ size: 'sm' })}>
                <UserPlus aria-hidden size={16} strokeWidth={1.75} />
                Novo contato
              </a>
            )}
          </>
        )}
      />
      <BarraContatos params={params} f={f} contagens={lista.contagens} empresas={empresas} ordem={lista.ordem} completa={lista.completa} />
      <DataTable
        rotulo="Contatos"
        linhas={lista.linhas}
        colunas={colunasContatos({ euId: u.id, veTodas, pode, agora, ordenaUltimo: lista.completa, perfis: perfisLidos === 'sem-migracao' ? null : perfisLidos })}
        chave={(c) => c.id}
        params={paramsTabela}
        ordem={lista.ordem}
        paginacao={lista.paginacao}
        acoesLinha={(c) => <AcoesLinhaContato id={c.id} nome={c.nome} conversaId={c.conversaId} podeConversa={podeConversa} podeArquivar={podeArquivar} />}
        hrefLinha={(c) => hrefContato(c.id)}
        linhaAtiva={contatoAberto}
        erro={lista.erro ? 'Não consegui carregar os contatos agora.' : undefined}
        vazio={filtrando ? (
          <EmptyState
            icone={FilterX}
            titulo="Nenhum contato encontrado."
            descricao="Confira o nome, o telefone ou a empresa, ou limpe os filtros."
            acao={<Link href="/contatos" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>}
          />
        ) : (
          <EmptyState icone={UsersRound} titulo="Nenhum contato cadastrado." descricao="Os contatos aparecem aqui quando alguém os cadastra pela conversa, pela ficha da empresa ou abaixo." />
        )}
      />

      {pode && (
        <Card id="novo-contato" className="mt-6 scroll-mt-20">
          <CardHeader>
            <CardTitle>Cadastrar contato</CardTitle>
            <CardDescription>Com ou sem empresa. Para ligar a uma empresa, abra o contato na lista e use &quot;Vincular empresa&quot;.</CardDescription>
          </CardHeader>
          <FormCadastroContato action={cadastrarContato}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Input name="nome" required placeholder="Nome" aria-label="Nome do contato" autoComplete="off" className="sm:w-56" />
              <Input name="telefone" required placeholder="Telefone (com DDD)" aria-label="Telefone (com DDD)" inputMode="tel" autoComplete="off" className="sm:w-56" />
              <label className="flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" name="agente_atende" defaultChecked className="size-4 shrink-0 accent-brand" />
                O agente atende
              </label>
              <BotaoCadastrarContato size="sm" className="sm:ml-auto">Cadastrar contato</BotaoCadastrarContato>
            </CardContent>
          </FormCadastroContato>
        </Card>
      )}

      {/* Sempre montado: abre na hora com esqueleto ao clicar na linha; o detalhe chega à parte (Suspense). */}
      <PainelLateralUrl param="contato" id={contatoAberto} hrefFechar={hrefContato(null)} esqueleto={<EsqueletoContato />} className="sm:max-w-lg">
        {contatoAberto && (
          <Suspense key={contatoAberto} fallback={<EsqueletoContato />}>
            <DetalheContato
              id={contatoAberto}
              u={u}
              editar={valorParam(params, 'editar') === '1'}
              hrefEditar={`/contatos${hrefComParams(params, { contato: contatoAberto, editar: '1', [PARAM_PAGINA]: pagina })}`}
              hrefFecharEdicao={hrefContato(contatoAberto)}
            />
          </Suspense>
        )}
      </PainelLateralUrl>
    </section>
  );
}
