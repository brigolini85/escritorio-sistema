import type { CompradorCadastrado } from '@escritorio/core';
import { MessageSquare, SearchX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { LinhaDoTempoDemanda, type EventoDemanda } from '@/components/patterns/linha-do-tempo-demanda';
import { OrderSummary } from '@/components/patterns/order-summary';
import { RelativeTime } from '@/components/patterns/relative-time';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { SheetBody, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Prioridade } from '@/lib/demandas';
import { pendenciasCsvBling } from '@/lib/resumo-pedido';
import { BotaoAssumir, BotoesDemanda, CamposDemanda, EditarDescricao, EditarTitulo, type PessoaSetor } from './acoes-demanda';
import { abertaPor } from './colunas-demandas';

export type DemandaAberta = {
  id: string; numero: number; titulo: string; descricao: string; status: StatusDemanda; prioridade: Prioridade;
  prazo: string | null; pausadoDesde: string | null; concluidaEm: string | null; criadoEm: string; origem: string; criadoPorNome: string | null;
  conversaId: string | null; foraDoContrato: boolean; pedidoVenda: unknown;
  setorId: string | null; setor: string | null; responsavelId: string | null; contatoId: string | null;
  empresa: { id: string; nome: string; cnpj: string } | null;
  eventos: EventoDemanda[];
};

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-b border-border py-4 last:border-b-0">
      <h3 className="text-xs font-bold uppercase tracking-wide text-brand">{titulo}</h3>
      {children}
    </section>
  );
}

/** Painel lateral da demanda (spec 6.3, imagem 05): tudo se resolve aqui, sem sair da tela. */
export function DetalheDemanda({ demanda: d, comprador, podeCsv, pessoas, setores, contatos, agora }: {
  demanda: DemandaAberta | null; comprador: CompradorCadastrado | null; podeCsv: boolean;
  pessoas: PessoaSetor[]; setores: { id: string; nome: string }[]; contatos: { id: string; nome: string }[]; agora: Date;
}) {
  if (!d) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Demanda não encontrada</SheetTitle>
          <SheetDescription className="sr-only">A demanda do endereço não existe ou é de outro setor.</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <EmptyState icone={SearchX} titulo="Não encontrei esta demanda." descricao="Ela pode ter sido apagada ou ser de um setor que você não atende." />
        </SheetBody>
      </>
    );
  }
  const controles = {
    id: d.id, numero: d.numero, titulo: d.titulo, descricao: d.descricao, status: d.status, prioridade: d.prioridade, prazo: d.prazo,
    pausadoDesde: d.pausadoDesde, concluidaEm: d.concluidaEm, setorId: d.setorId, responsavelId: d.responsavelId, contatoId: d.contatoId,
  };
  const quem = abertaPor(d);
  const problemas = pendenciasCsvBling(d.numero, d.pedidoVenda, comprador);
  return (
    <>
      <SheetHeader className="gap-1">
        {/* O nome da janela é o número e o setor (imagem 05): editar o título não muda o nome que o leitor de tela anuncia. */}
        <SheetTitle className="text-sm font-normal uppercase tracking-wide text-muted"><span className="tabular">Nº {d.numero}</span> · {d.setor ?? 'Triagem'}</SheetTitle>
        <EditarTitulo d={controles} />
        <SheetDescription className="text-base">
          {d.empresa ? <Link href={`/clientes/${d.empresa.id}`} className="text-brand underline-offset-4 hover:underline">{d.empresa.nome}</Link> : 'Empresa não identificada'}
          {' · '}aberta {quem === 'Agente' ? 'pelo agente' : `por ${quem}`} <RelativeTime data={d.criadoEm} />
          {d.pedidoVenda ? <Badge variant="brand" className="ml-2">Pedido de nota</Badge> : null}
          {d.foraDoContrato && <Badge variant="warning" className="ml-2">Fora do contrato</Badge>}
        </SheetDescription>
      </SheetHeader>
      <SheetBody>
        <section className="flex flex-col gap-3 border-b border-border py-4">
          {!d.responsavelId && d.status !== 'concluido' && <BotaoAssumir id={d.id} cheio />}
          <CamposDemanda d={controles} pessoas={pessoas} agora={agora} />
          <BotoesDemanda d={controles} setores={setores} pessoas={pessoas} />
        </section>
        <Secao titulo="Descrição">
          <EditarDescricao d={controles} contatos={contatos} />
          {d.empresa?.cnpj && <DocumentText tipo="cnpj" valor={d.empresa.cnpj} className="text-xs text-muted" />}
        </Secao>
        {d.pedidoVenda ? (
          <Secao titulo="Pedido de nota">
            <OrderSummary pedido={d.pedidoVenda} comprador={comprador} />
            {podeCsv && <BlingExportButton href={`/api/csv-bling?id=${d.id}`} problemas={problemas} />}
          </Secao>
        ) : null}
        <Secao titulo="Linha do tempo">
          {d.eventos.length > 0
            ? <LinhaDoTempoDemanda numero={d.numero} eventos={d.eventos} origem={d.origem} />
            : <p className="text-sm text-muted">Nenhum evento registrado.</p>}
        </Secao>
      </SheetBody>
      {d.conversaId && (
        <SheetFooter>
          <Link href={`/atendimento/${d.conversaId}`} className={variantesBotao({ variant: 'link' })}>
            <MessageSquare aria-hidden size={16} strokeWidth={1.75} />
            Abrir conversa
          </Link>
        </SheetFooter>
      )}
    </>
  );
}
