import { Archive } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { variantesBotao } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { descreverArquivamento, type TipoCadastro } from '@/lib/arquivo';
import { lerArquivados, type LinhaArquivada } from '@/lib/arquivados';
import { formatarData } from '@/lib/formatos';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { BotaoRestaurar } from './excluir-cadastro';

/** Tabela de arquivados: nome, quando e quem arquivou, e Restaurar (só com permissão). */
export function ListaArquivados({ rotulo, tipo, linhas, pode, vazio, erro }: {
  rotulo: string; tipo: TipoCadastro; linhas: LinhaArquivada[]; pode: boolean; vazio: string; erro?: boolean;
}) {
  if (erro) return <p role="alert" className="text-danger">Não consegui carregar os arquivados agora.</p>;
  if (linhas.length === 0) return <p className="py-6 text-center text-muted">{vazio}</p>;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <Table aria-label={rotulo}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Nome</TableHead>
            <TableHead>Arquivado em</TableHead>
            <TableHead>Por</TableHead>
            {pode && <TableHead><span className="sr-only">Ações</span></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.id}>
              <TableCell>
                <span className="font-medium text-foreground">{l.nome}</span>
                {l.detalhe && <span className="text-muted"> · {l.detalhe}</span>}
              </TableCell>
              <TableCell className="tabular text-muted">{l.arquivadoEm ? formatarData(l.arquivadoEm) : 'sem registro'}</TableCell>
              <TableCell className="text-muted">{l.arquivadoPor ?? '—'}</TableCell>
              {pode && <TableCell className="text-right"><BotaoRestaurar tipo={tipo} id={l.id} nome={l.nome} /></TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Botão "ARQUIVADOS (n)" do topo das listas (imagem 01). */
export function LinkArquivados({ href, total }: { href: string; total: number }) {
  return (
    <Link href={href} className={variantesBotao({ variant: 'outline', size: 'sm' })}>
      <Archive aria-hidden size={16} strokeWidth={1.75} />
      Arquivados ({total})
    </Link>
  );
}

/** Página "?ver=arquivados" das listas de clientes, contatos e usuários. */
export async function TelaArquivados({ tipo, titulo, voltar, pode }: {
  tipo: 'cliente' | 'contato' | 'usuario'; titulo: string; voltar: { rotulo: string; href: string }; pode: boolean;
}) {
  const sb = await supabaseServidor();
  const { linhas, erro } = await lerArquivados(sb, tipo);
  return (
    <section>
      <PageHeader
        titulo={titulo}
        contagem={linhas.length}
        migalhas={[{ rotulo: voltar.rotulo, href: voltar.href }, { rotulo: 'Arquivados' }]}
        descricao="Saíram das listas e do agente. Restaurar traz de volta como estavam."
      />
      <ListaArquivados rotulo={titulo} tipo={tipo} linhas={linhas} pode={pode} erro={erro} vazio="Nada arquivado." />
    </section>
  );
}

/** Faixa no topo da ficha de um cadastro arquivado, com Restaurar. */
export function AvisoArquivado({ tipo, id, nome, arquivadoEm, arquivadoPor, pode }: {
  tipo: TipoCadastro; id: string; nome: string; arquivadoEm: string | null; arquivadoPor: string | null; pode: boolean;
}) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-champagne bg-surface p-3 text-sm">
      <Archive aria-hidden size={16} strokeWidth={1.75} className="text-champagne-text" />
      <span className="flex-1">{descreverArquivamento(arquivadoEm, arquivadoPor)} Não aparece nas listas nem para o agente.</span>
      {pode && <BotaoRestaurar tipo={tipo} id={id} nome={nome} />}
    </div>
  );
}
