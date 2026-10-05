import { Building2, ExternalLink, Pencil, SearchX, ShieldAlert, X } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ApagarDadosContato } from '@/components/patterns/apagar-dados-contato';
import { EmptyState } from '@/components/patterns/empty-state';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { AvisoArquivado } from '@/components/patterns/lista-arquivados';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { variantesBotao } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { NOME_ANONIMIZADO } from '@/lib/arquivo';
import { nomeDaPessoa } from '@/lib/arquivados';
import { iniciais } from '@/lib/atendimento';
import { textoCadastro } from '@/lib/contatos';
import { mascararTelefone } from '@/lib/formatos';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { alternarAgenteContato } from '../atendimento/acoes';
import { anonimizarContato } from '../clientes/acoes';
import { marcarEmpresaDoContato, renomearContato, vincularEmpresaAoContato } from './acoes';
import { BotaoAbrirConversa } from './acoes-linha';
import { BlocoWhatsapp } from './bloco-whatsapp';
import { lerContato, lerEmpresasAtivas, lerWhatsappDoContato } from './dados-contatos';
import { DemandasDoContato, EsqueletoDemandasDoContato } from './demandas-do-contato';
import { EditarNomeContato } from './editar-nome-contato';
import { comoMostrarEmpresas, lerAcessosDoContato } from '@/lib/acesso-contato';
import { AcessoPorEmpresa } from './acesso-por-empresa';
import { MarcacoesEmpresa } from './marcacoes-empresa';
import { SecaoPainel } from './secao-painel';
import { SecaoEmpresas } from './vincular-empresa';

/**
 * Painel lateral do contato (?contato=<id>, imagem A): ABRIR CONVERSA e EDITAR no topo, agente, empresas com as marcações
 * por empresa e o vincular, WhatsApp, demandas abertas, Excluir… (Parte B) e Apagar dados (LGPD, só admin, inalterado). Lê só
 * o que já está no banco de todos (D14). As permissões são as de hoje e as ações conferem de novo no servidor.
 */
export async function DetalheContato({ id, u, editar, hrefEditar, hrefFecharEdicao }: {
  id: string; u: UsuarioPainel; editar: boolean; hrefEditar: string; hrefFecharEdicao: string;
}) {
  const pode = temNivel(u, 'clientes', 'editar');
  const podeArquivar = temNivel(u, 'clientes', 'arquivar');
  const podeConversa = temNivel(u, 'atendimento', 'meus_setores');
  const veTodas = temNivel(u, 'atendimento', 'todas');
  const admin = u.papel === 'admin';
  const sb = await supabaseServidor();
  const c = await lerContato(sb, id);

  if (!c) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Contato não encontrado</SheetTitle>
          <SheetDescription className="sr-only">O contato do endereço não existe mais.</SheetDescription>
        </SheetHeader>
        <SheetBody><EmptyState icone={SearchX} titulo="Não encontrei este contato." descricao="Ele pode ter sido apagado." /></SheetBody>
      </>
    );
  }

  const editavel = pode && c.ativo;
  const [whats, arquivadoPor, empresas, acessos] = await Promise.all([
    lerWhatsappDoContato(sb, c),
    c.ativo ? Promise.resolve(null) : nomeDaPessoa(sb, c.arquivadoPor),
    editavel ? lerEmpresasAtivas(sb) : Promise.resolve([]),
    lerAcessosDoContato(sb, c.id),
  ]);
  const ligadas = new Set(c.vinculos.map((v) => v.empresaId));
  const modoEmpresas = comoMostrarEmpresas(acessos);
  const anonimizado = c.nome === NOME_ANONIMIZADO && !c.ativo;
  const agora = new Date();

  return (
    <>
      <SheetHeader className="gap-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-base font-bold text-brand">{iniciais(c.nome)}</span>
          <div className="flex min-w-0 flex-col">
            <SheetTitle className="truncate">{c.nome}</SheetTitle>
            <SheetDescription className="tabular">{mascararTelefone(c.telefone)} · {textoCadastro(c.criadoEm, agora)}</SheetDescription>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <BotaoAbrirConversa conversaId={whats.conversaId} nome={c.nome} podeConversa={podeConversa} grande />
          {/* Com a edição aberta, o mesmo lugar fecha (link sem ?editar). */}
          {editavel && !editar && (
            <Link href={hrefEditar} scroll={false} aria-label={`Editar ${c.nome}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
              Editar
            </Link>
          )}
          {editavel && editar && (
            <Link href={hrefFecharEdicao} scroll={false} aria-label={`Fechar edição de ${c.nome}`} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
              <X aria-hidden size={16} strokeWidth={1.75} />
              Fechar edição
            </Link>
          )}
        </div>
      </SheetHeader>
      <SheetBody>
        {!c.ativo && !anonimizado && (
          <div className="py-4"><AvisoArquivado tipo="contato" id={c.id} nome={c.nome} arquivadoEm={c.arquivadoEm} arquivadoPor={arquivadoPor} pode={podeArquivar} /></div>
        )}
        {editavel && editar && (
          <SecaoPainel titulo="Dados">
            {/* key: depois de salvar, o campo recomeça com o nome novo. */}
            <EditarNomeContato key={c.nome} nome={c.nome} acao={renomearContato.bind(null, c.id)} />
          </SecaoPainel>
        )}
        <SecaoPainel titulo="Agente">
          <SwitchAgenteContato acao={alternarAgenteContato.bind(null, c.id, null, c.agentePausado)} desligado={c.agentePausado} nome={c.nome} pode={pode} mostrarEstado />
          <p className="text-sm text-muted">Desligado, nada é respondido automaticamente para este contato: a conversa vai para a equipe.</p>
        </SecaoPainel>

        <SecaoEmpresas
          titulo={`Empresas (${c.vinculos.length})`}
          podeVincular={editavel}
          empresas={empresas.filter((e) => !ligadas.has(e.id))}
          acao={vincularEmpresaAoContato.bind(null, c.id)}
        >
          {c.vinculos.length === 0 ? (
            <p className="text-sm text-muted">Sem empresa.{editavel ? ' Use "Vincular empresa".' : ''}</p>
          ) : modoEmpresas === 'acesso' && Array.isArray(acessos) ? (
            // Banco com a H2: o acesso por empresa (perfil, setores, permissões, prévia) no cartão de cada empresa (D22).
            <AcessoPorEmpresa contatoId={c.id} nome={c.nome} acessos={acessos} pode={pode} arquivado={!c.ativo} />
          ) : modoEmpresas === 'erro' ? (
            // Erro ao ler o acesso: nunca as caixas antigas da G3 (gravam na hora, sem a prévia do acesso).
            <p role="alert" className="text-sm text-danger">Não consegui carregar o acesso. Recarregue a página.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {c.vinculos.map((v) => (
                <li key={v.empresaId} className="flex flex-col gap-2 rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-semibold text-brand">
                      <Building2 aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
                      <span className="truncate">{v.empresa}</span>
                    </span>
                    <Link href={`/clientes/${v.empresaId}?aba=contatos`} aria-label={`Abrir a ficha de ${v.empresa}`} className="text-muted hover:text-foreground">
                      <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
                    </Link>
                  </div>
                  <MarcacoesEmpresa empresa={v.empresa} nota={v.podePedirNota} preco={v.podeMudarPreco} pode={editavel}
                    acao={marcarEmpresaDoContato.bind(null, c.id, v.empresaId)} />
                </li>
              ))}
            </ul>
          )}
          {!pode && c.vinculos.length > 0 && modoEmpresas !== 'erro' && <p className="text-sm text-muted">Só quem pode editar clientes muda as marcações.</p>}
          {pode && !c.ativo && c.vinculos.length > 0 && modoEmpresas !== 'erro' && <p className="text-sm text-muted">Contato arquivado: restaure para mudar as marcações.</p>}
        </SecaoEmpresas>

        {/* Parte H2: o acesso por empresa mora nos cartões da seção Empresas (acima): uma lista só com o nome de cada empresa. */}
        <BlocoWhatsapp w={whats} euId={u.id} veTodas={veTodas} agora={agora} />
        <Suspense fallback={<EsqueletoDemandasDoContato />}>
          <DemandasDoContato contatoId={c.id} agora={agora} />
        </Suspense>

        {podeArquivar && c.ativo && (
          <div className="py-4"><ExcluirCadastro tipo="contato" id={c.id} nome={c.nome} variante="area" voltarPara="/contatos" /></div>
        )}
        {admin && !anonimizado && (
          <section aria-labelledby="apagar-dados" className="my-4 flex flex-col gap-2 rounded-md border border-dashed border-danger p-4">
            <h3 id="apagar-dados" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-danger">
              <ShieldAlert aria-hidden size={16} strokeWidth={1.75} />
              Apagar dados (LGPD) · só admin
            </h3>
            <p className="text-sm text-foreground">
              Apagar os dados a pedido do titular (LGPD): nome, telefone, mensagens, áudios e arquivos deste contato somem de vez, em todas as empresas. Não dá para desfazer.
            </p>
            <ApagarDadosContato variante="destaque" nome={c.nome} acao={anonimizarContato.bind(null, c.vinculos[0]?.empresaId ?? '', c.id)} />
          </section>
        )}
        {admin && anonimizado && <p className="my-4 text-sm text-muted">Os dados deste contato já foram apagados a pedido do titular.</p>}
      </SheetBody>
    </>
  );
}

export function EsqueletoContato() {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Carregando o contato</SheetTitle>
        <SheetDescription className="sr-only">Os detalhes aparecem em instantes.</SheetDescription>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-32" />
      </SheetHeader>
      <SheetBody role="status" aria-label="Carregando o contato" className="flex flex-col gap-4 py-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </SheetBody>
    </>
  );
}
