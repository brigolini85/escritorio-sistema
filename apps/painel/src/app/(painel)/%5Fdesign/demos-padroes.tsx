'use client';

import { CircleCheck, FileSpreadsheet, Ellipsis, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import { BarraSelecao, CamposSelecionados, DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { DocumentText } from '@/components/patterns/document-text';
import { FilterBar } from '@/components/patterns/filter-bar';
import { MoneyText } from '@/components/patterns/money-text';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge, type StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toaster';
import type { Ordem, Paginacao, ParamsBusca } from '@/lib/tabela-url';

// Exemplos interativos dos padrões de domínio no /_design (ações falsas: só mostram um aviso).

export type DemandaExemplo = {
  id: string; numero: number; empresa: string; cnpj: string; assunto: string; setor: string; responsavel: string | null;
  aberta: string; status: StatusDemanda; valor: number | null;
};

export function DemoConfirmacoes() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ConfirmDialog
        gatilho={<Button><CircleCheck aria-hidden size={16} strokeWidth={1.75} />Concluir</Button>}
        titulo="Concluir a demanda #1042?"
        descricao="A demanda sai da lista de abertas. Dá para reabrir depois."
        confirmar="Concluir"
        enviando="Concluindo…"
        variante="primary"
        tipo="concluir"
        acao={async (dados) => {
          await new Promise((r) => setTimeout(r, 800));
          toast.success(`Demanda concluída (campo enviado: chamado_id=${String(dados.get('chamado_id'))}).`);
        }}
      >
        <input type="hidden" name="chamado_id" value="1042" />
      </ConfirmDialog>

      {/* Formulário que já existe na página: o botão da janela é o submit dele (form=). */}
      <form
        id="demo-lgpd"
        action={(dados) => { toast.success(`Dados apagados (contato_id=${String(dados.get('contato_id'))}).`); }}
      >
        <input type="hidden" name="contato_id" value="c-77" />
      </form>
      <ConfirmDialog
        formulario="demo-lgpd"
        gatilho={<Button variant="danger"><Trash2 aria-hidden size={16} strokeWidth={1.75} />Apagar dados (LGPD)</Button>}
        titulo="Apagar os dados de João Lima?"
        descricao="Nome, telefone e conversas deste contato serão apagados. Não dá para desfazer."
        confirmar="Apagar dados"
        digitarParaConfirmar="João Lima"
        tipo="excluir"
      />
    </div>
  );
}

/** DataTable usado dentro de componente client: aqui dá para usar aoClicarLinha (abre um Sheet). */
export function DemoTabela({
  linhas, params, ordem, paginacao, total, setores,
}: {
  linhas: DemandaExemplo[]; params: ParamsBusca; ordem: Ordem | null; paginacao: Paginacao; total: number; setores: string[];
}) {
  const [aberta, setAberta] = useState<DemandaExemplo | null>(null);

  const colunas: ColunaTabela<DemandaExemplo>[] = [
    { id: 'numero', titulo: 'Nº', ordenavel: true, className: 'w-16', celula: (d) => <span className="tabular text-muted">#{d.numero}</span> },
    { id: 'empresa', titulo: 'Empresa', ordenavel: true, celula: (d) => <span className="font-medium">{d.empresa}</span> },
    { id: 'assunto', titulo: 'Assunto', celula: (d) => d.assunto },
    { id: 'setor', titulo: 'Setor', ordenavel: true, celula: (d) => d.setor },
    { id: 'responsavel', titulo: 'Responsável', celula: (d) => d.responsavel ?? <Badge variant="warning">Sem responsável</Badge> },
    { id: 'aberta', titulo: 'Aberta há', ordenavel: true, celula: (d) => <RelativeTime data={d.aberta} className="text-muted" /> },
    { id: 'valor', titulo: 'Valor', ordenavel: true, alinhar: 'direita', celula: (d) => <MoneyText valor={d.valor} /> },
    { id: 'status', titulo: 'Status', celula: (d) => <StatusBadge tipo="demanda" status={d.status} /> },
  ];

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        busca={{ placeholder: 'Buscar empresa ou assunto' }}
        filtros={[
          { param: 'setor', rotulo: 'Setor', todos: 'Todos os setores', opcoes: setores.map((s) => ({ valor: s, rotulo: s })) },
          {
            param: 'status', rotulo: 'Status', todos: 'Todos',
            opcoes: [{ valor: 'aberto', rotulo: 'Aberta' }, { valor: 'em_andamento', rotulo: 'Em andamento' }, { valor: 'aguardando_cliente', rotulo: 'Aguardando cliente' }],
          },
        ]}
        total={total}
      />
      <DataTable
        rotulo="Demandas de exemplo"
        linhas={linhas}
        colunas={colunas}
        chave={(d) => d.id}
        params={params}
        ordem={ordem}
        paginacao={paginacao}
        selecionavel
        rotuloSelecao={(d) => `Selecionar demanda #${d.numero}`}
        acoesEmMassa={
          <BarraSelecao>
            <form
              action={(dados) => { toast.success(`Exportar CSV Bling: ids=${String(dados.get('ids'))} (o mesmo formato de /api/csv-bling?ids=).`); }}
              className="flex"
            >
              <CamposSelecionados name="ids" />
              <Button type="submit" size="sm" variant="outline"><FileSpreadsheet aria-hidden size={16} strokeWidth={1.75} />Exportar CSV Bling</Button>
            </form>
          </BarraSelecao>
        }
        acoesLinha={(d) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Ações da demanda #${d.numero}`} className="size-8">
                <Ellipsis aria-hidden size={16} strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAberta(d)}>Abrir detalhes</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast(`Demanda #${d.numero} assumida.`)}>Assumir</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        aoClicarLinha={setAberta}
        linhaAtiva={aberta?.id ?? null}
      />
      <Sheet open={aberta !== null} onOpenChange={(v) => { if (!v) setAberta(null); }}>
        <SheetContent>
          {aberta && (
            <>
              <SheetHeader>
                <SheetTitle>Demanda #{aberta.numero}</SheetTitle>
                <SheetDescription>{aberta.empresa} · CNPJ <DocumentText valor={aberta.cnpj} tipo="cnpj" /> · {aberta.setor}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-2">
                <StatusBadge tipo="demanda" status={aberta.status} />
                <p>{aberta.assunto}</p>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
