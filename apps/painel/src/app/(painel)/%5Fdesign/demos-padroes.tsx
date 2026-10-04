'use client';

import { Archive, CircleCheck, CircleHelp, FileSpreadsheet, Ellipsis, Trash2, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/patterns/confirm-dialog';
import type { TipoConfirmacao } from '@/components/patterns/confirmacao';
import { BarraSelecao, CamposSelecionados, DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { DocumentText } from '@/components/patterns/document-text';
import { FilterBar } from '@/components/patterns/filter-bar';
import { FormField } from '@/components/patterns/form-field';
import { Antes } from '@/components/patterns/formulario-alteravel';
import { MoneyText } from '@/components/patterns/money-text';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge, type StatusDemanda } from '@/components/patterns/status-badge';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { toast } from '@/components/ui/toaster';
import type { Ordem, Paginacao, ParamsBusca } from '@/lib/tabela-url';
import { FormularioConfig, RodapeConfig } from '../configuracoes/formulario-config';
import { SelosContato } from '../contatos/marcacoes';

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
        titulo={<>Concluir a demanda <strong className="font-extrabold">#1042</strong>?</>}
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
        titulo={<>Apagar os dados de <strong className="font-extrabold">João Lima</strong>?</>}
        descricao="Nome, telefone e conversas deste contato serão apagados. Não dá para desfazer."
        confirmar="Apagar dados"
        digitarParaConfirmar="João Lima"
        tipo="excluir"
      />
    </div>
  );
}

// Os 5 tipos do ConfirmDialog lado a lado: cada um tem anel, ícone e botão próprios.
const TIPOS: { tipo: TipoConfirmacao; rotulo: string; Icone: typeof Archive; titulo: string; descricao: string; confirmar: string }[] = [
  { tipo: 'arquivar', rotulo: 'Arquivar', Icone: Archive, titulo: 'Arquivar o cliente Padaria Pão Quente?', descricao: 'Ele sai das listas, mas o histórico fica guardado.', confirmar: 'Arquivar' },
  { tipo: 'excluir', rotulo: 'Excluir', Icone: Trash2, titulo: 'Excluir a resposta pronta "Bom dia"?', descricao: 'A resposta some de vez. Não dá para desfazer.', confirmar: 'Excluir' },
  { tipo: 'concluir', rotulo: 'Concluir', Icone: CircleCheck, titulo: 'Concluir a demanda #1042?', descricao: 'A demanda sai da lista de abertas.', confirmar: 'Concluir' },
  { tipo: 'perigo', rotulo: 'Perigo', Icone: TriangleAlert, titulo: 'Pausar o agente em todas as conversas?', descricao: 'Ninguém será atendido pelo agente até você religar.', confirmar: 'Pausar' },
  { tipo: 'neutro', rotulo: 'Neutro', Icone: CircleHelp, titulo: 'Enviar o lembrete agora?', descricao: 'O cliente recebe a mensagem pelo WhatsApp.', confirmar: 'Enviar' },
];

export function DemoTiposConfirmacao() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {TIPOS.map(({ tipo, rotulo, Icone, titulo, descricao, confirmar }) => (
        <ConfirmDialog
          key={tipo}
          tipo={tipo}
          gatilho={<Button variant="outline"><Icone aria-hidden size={16} strokeWidth={1.75} />{rotulo}</Button>}
          titulo={titulo}
          descricao={descricao}
          confirmar={confirmar}
          acao={async () => { toast.success(`Confirmação do tipo "${tipo}" (exemplo).`); }}
        />
      ))}
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
            opcoes: [{ valor: 'aberto', rotulo: 'Nova' }, { valor: 'em_andamento', rotulo: 'Resolvendo' }, { valor: 'aguardando_cliente', rotulo: 'Com o cliente' }],
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

/** Configurações (Parte G1): cartão que salva sozinho; o exemplo não grava nada. */
export function DemoConfiguracoes() {
  return (
    <FormularioConfig acao={async () => ({ ok: true, mensagem: 'Exemplo salvo.' })} rotulo="Exemplo de configuração">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <FormField id="demo-config-campo" rotulo="Horário de fim (exemplo)">
          <Input name="exemplo" defaultValue="18:00" />
        </FormField>
        <Antes campo="exemplo" texto="18:00" />
        <RodapeConfig />
      </div>
    </FormularioConfig>
  );
}

const EMPRESA_A = { empresaId: 'exemplo-a', empresa: 'Rede Bom Preço Ltda' };
const EMPRESA_B = { empresaId: 'exemplo-b', empresa: 'Mercado Central' };

/** Contatos (Parte G3): selos das marcações por empresa e a chave do agente da linha, com dados fixos (sem banco). */
export function DemoContatos() {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <SelosContato vinculos={[{ ...EMPRESA_A, podePedirNota: true, podeMudarPreco: false }, { ...EMPRESA_B, podePedirNota: false, podeMudarPreco: false }]} />
      <SelosContato vinculos={[{ ...EMPRESA_A, podePedirNota: true, podeMudarPreco: true }]} />
      <SelosContato vinculos={[{ ...EMPRESA_B, podePedirNota: false, podeMudarPreco: false }]} />
      <SwitchAgenteContato acao={async () => {}} desligado={false} nome="Carla Mendes (exemplo)" pode={false} mostrarEstado estadoCurto />
    </div>
  );
}
