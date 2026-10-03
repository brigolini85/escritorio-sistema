import { variantesTelefone } from '@escritorio/core';
import { Pencil, SearchX, TriangleAlert, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { AvisoArquivado, LinkArquivados, TelaArquivados } from '@/components/patterns/lista-arquivados';
import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams, lerOrdem, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { convidarUsuario, salvarUsuario } from './acoes';
import { ConviteUsuario } from './convite-usuario';
import { FormularioUsuario, type DadosUsuario, type SetorOpcao } from './formulario-usuario';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAPEL = { admin: 'Administrador', atendente: 'Atendente' } as const;
/** Selos curtos da coluna "Pode editar" (as permissões do assistente aparecem no resumo da pessoa). */
const SELO_EDICAO = [
  { valor: 'editar_clientes', rotulo: 'Clientes' },
  { valor: 'editar_precos', rotulo: 'Preços' },
  { valor: 'emitir_notas', rotulo: 'Notas e CSV do Bling' },
] as const;

type Linha = DadosUsuario & { id: string; contatoDoTelefone: string | null; arquivadoEm: string | null; arquivadoPor: string | null };

/** "Administrador · desativado · assistente no site · assistente no WhatsApp": o resumo de sempre, depois do nome. */
function resumo(u: Linha): string {
  return `${PAPEL[u.papel]}${u.ativo ? '' : ' · desativado'}`
    + `${u.permissoes.includes('assistente_site') ? ' · assistente no site' : ''}`
    + `${u.permissoes.includes('assistente_whatsapp') ? ' · assistente no WhatsApp' : ''}`;
}

function AvisoContato({ contato }: { contato: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft p-3 text-sm text-warning">
      <TriangleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <span>Este número também é do contato {contato}. Com o assistente pelo WhatsApp ligado, as mensagens dele vão para o assistente, não para o agente de clientes.</span>
    </p>
  );
}

function EsqueletoUsuario() {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Carregando a pessoa</SheetTitle>
        <SheetDescription className="sr-only">Os dados aparecem em instantes.</SheetDescription>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-48" />
      </SheetHeader>
      <SheetBody role="status" aria-label="Carregando a pessoa" className="flex flex-col gap-4 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
        <Skeleton className="h-8 w-2/3" />
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
      </SheetBody>
    </>
  );
}

/**
 * Pessoas do escritório (só o administrador). Tabela com papel, setores, telefone e permissões;
 * ?usuario=<id> abre o painel lateral com o formulário de sempre (salvarUsuario); "Convidar pessoa" abre a janela
 * do convite (convidarUsuario). Os erros das duas ações aparecem no próprio formulário.
 */
export default async function Usuarios({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const eu = await exigirAdmin();
  const params = await searchParams;
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="usuario" titulo="Usuários arquivados" voltar={{ rotulo: 'Usuários e permissões', href: '/usuarios' }} pode />;
  }
  const pedido = valorParam(params, 'usuario');
  const usuarioAberto = pedido && UUID.test(pedido) ? pedido : null;
  const ordem = lerOrdem(params, ['nome'], { coluna: 'nome', direcao: 'asc' })!;
  const sb = await supabaseServidor();
  const [{ data: usuarios, error: erroLista }, { data: setores }, { data: contatos }] = await Promise.all([
    sb.from('usuarios').select('*, usuario_setores(setor_id)').order('nome', { ascending: ordem.direcao === 'asc' }),
    // Todos os setores, inclusive os inativos: senão salvar o usuário apagaria a ligação dele com um setor desativado.
    sb.from('setores').select('id, nome, ativo').order('nome'),
    sb.from('contatos').select('nome, telefone'),
  ]);
  if (erroLista) console.error('[usuarios] falha ao ler a lista', erroLista);
  /** Número que também é de um contato (cliente): com o assistente pelo WhatsApp, as mensagens vão para o assistente. */
  const contatoDoTelefone = (tel: string | null) =>
    tel ? (contatos ?? []).find((c) => variantesTelefone(tel).includes(c.telefone))?.nome ?? null : null;

  const opcoesSetor: SetorOpcao[] = setores ?? [];
  const nomeSetor = new Map(opcoesSetor.map((s) => [s.id, s]));
  const linhas: Linha[] = (usuarios ?? []).map((u) => ({
    id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, papel: u.papel, ativo: u.ativo, permissoes: u.permissoes,
    setores: u.usuario_setores.map((x) => x.setor_id),
    contatoDoTelefone: u.permissoes.includes('assistente_whatsapp') ? contatoDoTelefone(u.telefone) : null,
    arquivadoEm: u.arquivado_em, arquivadoPor: u.arquivado_por,
  }));
  // A lista traz todas as pessoas (arquivadas também: o convite e o telefone conferem contra elas); a tabela mostra só quem está ativo.
  const ativos = linhas.filter((l) => l.ativo);
  const arquivados = linhas.length - ativos.length;
  const aberto = usuarioAberto ? linhas.find((l) => l.id === usuarioAberto) ?? null : null;
  // Erro agora aparece no formulário; tirar o ?erro= só limpa link antigo guardado nos favoritos.
  const hrefUsuario = (id: string | null) => `/usuarios${hrefComParams(params, id ? { usuario: id, erro: null } : { usuario: null })}`;

  const colunas: ColunaTabela<Linha>[] = [
    {
      id: 'nome', titulo: 'Pessoa', ordenavel: true, className: 'min-w-64',
      celula: (u) => (
        <span className="block truncate">
          <span className="font-medium text-foreground">{u.nome}</span>
          <span className="text-muted"> · {resumo(u)}</span>
        </span>
      ),
    },
    { id: 'email', titulo: 'E-mail', className: 'max-w-56', celula: (u) => <span className="block truncate text-muted">{u.email}</span> },
    {
      id: 'setores', titulo: 'Setores',
      celula: (u) => {
        if (u.setores.length === 0) return <span className="text-subtle">nenhum</span>;
        const mostrar = u.setores.slice(0, 2);
        return (
          <span className="flex items-center gap-1" title={u.setores.map((s) => nomeSetor.get(s)?.nome ?? '').join(', ')}>
            {mostrar.map((s) => {
              const setor = nomeSetor.get(s);
              return <Badge key={s} variant={setor?.ativo === false ? 'outline' : 'neutral'}>{setor?.nome ?? 'setor removido'}</Badge>;
            })}
            {u.setores.length > mostrar.length && <span className="text-xs text-muted">+{u.setores.length - mostrar.length}</span>}
          </span>
        );
      },
    },
    {
      id: 'telefone', titulo: 'Telefone',
      celula: (u) => (
        <span className="flex items-center gap-1.5">
          <DocumentText valor={u.telefone} tipo="telefone" className="text-muted" />
          {u.contatoDoTelefone && (
            <span title={`Também é o telefone do contato ${u.contatoDoTelefone}`} className="inline-flex text-warning">
              <TriangleAlert aria-hidden size={16} strokeWidth={1.75} />
              <span className="sr-only">Também é o telefone do contato {u.contatoDoTelefone}</span>
            </span>
          )}
        </span>
      ),
    },
    {
      id: 'permissoes', titulo: 'Pode editar',
      celula: (u) => {
        if (u.papel === 'admin') return <Badge variant="brand">Tudo</Badge>;
        const selos = SELO_EDICAO.filter((p) => u.permissoes.includes(p.valor));
        if (selos.length === 0) return <span className="text-subtle">só leitura</span>;
        return <span className="flex items-center gap-1">{selos.map((p) => <Badge key={p.valor} variant="info">{p.rotulo}</Badge>)}</span>;
      },
    },
  ];

  return (
    <section>
      <PageHeader
        titulo="Usuários e permissões"
        contagem={ativos.length}
        descricao="O administrador pode tudo no painel. As marcações do assistente valem para todos, inclusive o administrador."
        acoes={(
          <>
            <LinkArquivados href="/usuarios?ver=arquivados" total={arquivados} />
            <ConviteUsuario acao={convidarUsuario} setores={opcoesSetor} />
          </>
        )}
      />
      <DataTable
        rotulo="Usuários"
        linhas={ativos}
        colunas={colunas}
        chave={(u) => u.id}
        params={params}
        ordem={ordem}
        hrefLinha={(u) => hrefUsuario(u.id)}
        // Lápis abre o painel da pessoa; ninguém arquiva nem exclui o próprio acesso.
        acoesLinha={(u) => (
          <span className="flex items-center justify-end gap-1">
            <Link href={hrefUsuario(u.id)} scroll={false} aria-label={`Editar ${u.nome}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            {u.id !== eu.id && <ExcluirCadastro tipo="usuario" id={u.id} nome={u.nome} />}
          </span>
        )}
        linhaAtiva={usuarioAberto}
        erro={erroLista ? 'Não consegui carregar as pessoas agora.' : undefined}
        vazio={<EmptyState icone={UsersRound} titulo="Nenhuma pessoa cadastrada." descricao="Convide a equipe pelo botão Convidar pessoa." />}
      />

      <PainelLateralUrl param="usuario" id={usuarioAberto} hrefFechar={hrefUsuario(null)} esqueleto={<EsqueletoUsuario />} className="sm:max-w-xl" protegerAlteracoes>
        {usuarioAberto && (aberto ? (
          <>
            <SheetHeader>
              <SheetTitle>{aberto.nome}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <span>{aberto.email}</span>
                <Badge variant={aberto.papel === 'admin' ? 'brand' : 'neutral'}>{PAPEL[aberto.papel]}</Badge>
              </SheetDescription>
            </SheetHeader>
            {aberto.ativo ? (
              <>
                <FormularioUsuario
                  // Voltou do servidor com dados novos (salvou): o formulário recomeça com eles.
                  key={JSON.stringify(aberto)}
                  acao={salvarUsuario.bind(null, aberto.id)}
                  usuario={aberto}
                  setores={opcoesSetor}
                  enviar="Salvar usuário"
                  aviso={aberto.contatoDoTelefone && <AvisoContato contato={aberto.contatoDoTelefone} />}
                />
                {aberto.id !== eu.id && (
                  <div className="px-4 pb-4"><ExcluirCadastro tipo="usuario" id={aberto.id} nome={aberto.nome} variante="area" voltarPara="/usuarios" /></div>
                )}
              </>
            ) : (
              <SheetBody className="py-4">
                <AvisoArquivado tipo="usuario" id={aberto.id} nome={aberto.nome} arquivadoEm={aberto.arquivadoEm} arquivadoPor={linhas.find((l) => l.id === aberto.arquivadoPor)?.nome ?? null} pode />
              </SheetBody>
            )}
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Pessoa não encontrada</SheetTitle>
              <SheetDescription className="sr-only">A pessoa do endereço não existe mais.</SheetDescription>
            </SheetHeader>
            <SheetBody><EmptyState icone={SearchX} titulo="Não encontrei esta pessoa." descricao="Ela pode ter sido removida." /></SheetBody>
          </>
        ))}
      </PainelLateralUrl>
    </section>
  );
}
