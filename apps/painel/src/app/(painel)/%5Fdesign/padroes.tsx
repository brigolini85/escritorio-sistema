import type { CompradorCadastrado, PedidoVendaSalvo } from '@escritorio/core';
import { FileText, Inbox, Plus, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { AgentStateIndicator } from '@/components/patterns/agent-state-indicator';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { DataTable, DataTableCarregando } from '@/components/patterns/data-table';
import { DiffPreview } from '@/components/patterns/diff-preview';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { EscolherEmpresa } from '@/components/patterns/escolher-empresa';
import { FormField } from '@/components/patterns/form-field';
import { HealthSignal } from '@/components/patterns/health-signal';
import { HistoricoRolante } from '@/components/patterns/historico-rolante';
import { MessageBubble } from '@/components/patterns/message-bubble';
import { MoneyText } from '@/components/patterns/money-text';
import { OrderSummary } from '@/components/patterns/order-summary';
import { PageHeader } from '@/components/patterns/page-header';
import { PermissionGate } from '@/components/patterns/permission-gate';
import { RelativeTime } from '@/components/patterns/relative-time';
import { PrazoTexto, PrioridadeTexto } from '@/components/patterns/prioridade-prazo';
import { StatusBadge, STATUS_CONVERSA, STATUS_DEMANDA, TIPO_ORIENTACAO, type StatusConversa, type StatusDemanda, type TipoOrientacaoSelo } from '@/components/patterns/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { LIMITES_PADRAO } from '@/lib/atendimento';
import { lerOrdem, lerPagina, ordenarLinhas, paginar, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { CronometroEspera } from '../atendimento/cronometro-espera';
import { MarcoConversa } from '../atendimento/[id]/itens-historico';
import { DemoConfirmacoes, DemoTabela, DemoTiposConfirmacao, type DemandaExemplo } from './demos-padroes';

// Seção "Padrões de domínio" do /_design (fase 3): cada padrão de components/patterns com dados de exemplo.

const PREVIA_REAL = [
  'Prévia do pedido #1042:', 'Antes:', 'Destinatário: Supermercado Brasil / Santa Efigênia',
  '• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00', 'Total: R$ 95,00',
  'Depois:', 'Destinatário: Supermercado Brasil / Santa Efigênia',
  '• 15 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 142,50', 'Total: R$ 142,50',
].join('\n');

const PREVIA_COMPLETA = [
  'Prévia do pedido #1043:', 'Antes:', 'Destinatário: Padaria Pão Quente / Centro',
  '• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00', '• 5 UN Pão de alho (cód. 7) × R$ 6,00 = R$ 30,00',
  '• 2 KG Queijo minas (cód. 40) – sem preço', 'Total: R$ 125,00', 'Pagamento: Boleto 28 dias',
  'Depois:', 'Destinatário: Padaria Pão Quente / Centro',
  '• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00', '• 2 KG Queijo minas (cód. 40) × R$ 42,00 = R$ 84,00',
  '• 3 FD Guaraná 2L (cód. 30) × R$ 25,00 = R$ 75,00', 'Total: R$ 254,00', 'Pagamento: Pix · Entrega: 02/10/2026',
  'Posso gravar?',
].join('\n');

const PEDIDO: PedidoVendaSalvo = {
  unidade_id: 'u-1', texto_destinatario: 'Supermercado Brasil Santa Efigênia', data: '30/09/2026',
  itens: [
    { produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 15, valor_unitario: 9.5 },
    { produto: 'Pão de alho', sku: '7', un: 'UN', quantidade: 20, valor_unitario: 6 },
    { produto: 'Queijo minas', sku: '40', un: 'KG', quantidade: 2.5, valor_unitario: null },
    { produto: 'Guaraná 2L', sku: '30', un: 'FD', quantidade: 3, valor_unitario: null },
  ],
  data_prevista: '02/10/2026', forma_pagamento: 'Boleto 28 dias', valor_frete: 15, tipo_frete: 'D', transportadora: null,
  observacoes: 'Entregar pela manhã, doca 2.', entrega: null,
};

const COMPRADOR: CompradorCadastrado = {
  razao_social: 'Supermercado Brasil Ltda', nome_unidade: 'Santa Efigênia', cnpj: '11222333000181', endereco: 'Rua Pouso Alegre',
  numero: '1200', complemento: 'Loja 1', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG', cep: '30260000', telefone: '3132221100',
};

const EMPRESAS: [string, string][] = [
  ['Supermercado Brasil Ltda', '11222333000181'], ['Padaria Pão Quente Ltda', '22333444000172'], ['Mercado Bom Preço', '33444555000163'],
  ['Auto Peças Irmãos Silva', '44555666000154'], ['Ótica Central', '55666777000145'], ['Açougue Boi Gordo', '66777888000136'],
];
const ASSUNTOS = ['Pedido de nota de venda', 'Guia de DAS de setembro', 'Folha de pagamento', 'Alteração contratual', 'Pedido de nota de devolução', 'Certidão negativa'];
const SETORES = ['Fiscal', 'Pessoal', 'Contábil'];
const STATUS: StatusDemanda[] = ['aberto', 'em_andamento', 'aguardando_cliente'];
const RESPONSAVEIS = ['Maria Souza', null, 'João Lima', 'Ana Paula'];

function demandas(agora: number): DemandaExemplo[] {
  return Array.from({ length: 13 }, (_, i) => {
    const [empresa, cnpj] = EMPRESAS[i % EMPRESAS.length]!;
    return {
      id: `d-${1042 - i}`, numero: 1042 - i, empresa, cnpj, assunto: ASSUNTOS[(i * 5) % ASSUNTOS.length]!, setor: SETORES[i % 3]!,
      responsavel: RESPONSAVEIS[i % RESPONSAVEIS.length]!, aberta: new Date(agora - (i * 97 + 3) * 60_000).toISOString(),
      status: STATUS[i % 3]!, valor: i % 4 === 3 ? null : Math.round((95 + i * 137.35) * 100) / 100,
    };
  });
}

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{titulo}</h2>
        {descricao && <p className="text-muted">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

function Exemplo({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className={className ?? 'flex flex-wrap items-center gap-3'}>{children}</CardContent>
    </Card>
  );
}

export function Padroes({ params }: { params: ParamsBusca }) {
  const agora = Date.now();
  const ha = (s: number) => new Date(agora - s * 1000).toISOString();

  // Tabela: a mesma leitura que uma tela de lista faz no servidor (filtro, ordem e página vindos da URL).
  const q = (valorParam(params, 'q') ?? '').toLocaleLowerCase('pt-BR');
  const setor = valorParam(params, 'setor');
  const status = valorParam(params, 'status');
  const filtradas = demandas(agora).filter((d) =>
    (!q || `${d.empresa} ${d.assunto}`.toLocaleLowerCase('pt-BR').includes(q)) && (!setor || d.setor === setor) && (!status || d.status === status));
  const ordem = lerOrdem(params, ['numero', 'empresa', 'setor', 'aberta', 'valor'], { coluna: 'aberta', direcao: 'desc' });
  const valor = (d: DemandaExemplo) => (ordem?.coluna === 'aberta' ? new Date(d.aberta) : ordem ? (d[ordem.coluna as keyof DemandaExemplo] as string | number | null) : null);
  const ordenadas = ordem ? ordenarLinhas(filtradas, valor, ordem.direcao) : filtradas;
  const pag = paginar(ordenadas.length, lerPagina(params), 5);

  return (
    <Secao titulo="Padrões de domínio" descricao="Composições de src/components/patterns, com dados de exemplo. Formatadores em src/lib/formatos.ts.">
      <Exemplo titulo="PageHeader" className="block">
        <PageHeader
          migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Supermercado Brasil Ltda' }]}
          titulo="Supermercado Brasil Ltda"
          descricao="CNPJ 11.222.333/0001-81 · Fiscal"
          acoes={<><Button variant="outline" size="sm">Editar</Button><Button size="sm"><Plus aria-hidden size={16} strokeWidth={1.75} />Nova demanda</Button></>}
          className="mb-0"
        />
      </Exemplo>

      <div className="grid gap-4 lg:grid-cols-2">
        <Exemplo titulo="StatusBadge">
          {(Object.keys(STATUS_DEMANDA) as StatusDemanda[]).map((s) => <StatusBadge key={s} tipo="demanda" status={s} />)}
          {(Object.keys(STATUS_CONVERSA) as StatusConversa[]).map((s) => <StatusBadge key={s} tipo="conversa" status={s} />)}
          {(Object.keys(TIPO_ORIENTACAO) as TipoOrientacaoSelo[]).map((s) => <StatusBadge key={s} tipo="orientacao" status={s} />)}
        </Exemplo>
        <Exemplo titulo="Status de demanda (texto colorido + ponto)">
          {(Object.keys(STATUS_DEMANDA) as StatusDemanda[]).map((s) => <StatusBadge key={s} tipo="demanda" status={s} />)}
        </Exemplo>
        <Exemplo titulo="Prioridade e prazo (sempre escritos)" className="flex flex-wrap items-center gap-4 text-sm">
          {(['urgente', 'alta', 'normal', 'baixa'] as const).map((p) => <PrioridadeTexto key={p} prioridade={p} />)}
          <PrazoTexto prazo={new Date(Date.now() + 2 * 3600_000).toISOString()} pausadoDesde={null} concluidaEm={null} agora={new Date()} />
          <PrazoTexto prazo={new Date(Date.now() - 3600_000).toISOString()} pausadoDesde={null} concluidaEm={null} agora={new Date()} />
          <PrazoTexto prazo={null} pausadoDesde={new Date().toISOString()} concluidaEm={null} agora={new Date()} />
        </Exemplo>
        <Exemplo titulo="HealthSignal"className="flex flex-col items-start gap-2">
          <HealthSignal rotulo="WhatsApp (Z-API)" ultimoSinal={ha(40)} detalhe="Conectado ao número (31) 3222-1100" />
          <HealthSignal rotulo="Fila (pg-boss)" ultimoSinal={ha(4 * 60)} />
          <HealthSignal rotulo="Trabalhador" ultimoSinal={ha(25 * 60)} />
          <HealthSignal rotulo="Batimento" ultimoSinal={null} />
        </Exemplo>
      </div>

      <Exemplo titulo="AgentStateIndicator" className="grid gap-3">
        <div className="flex flex-wrap gap-2">
          <AgentStateIndicator estado={{ tipo: 'ativo' }} />
          <AgentStateIndicator estado={{ tipo: 'com_agente' }} />
          <AgentStateIndicator estado={{ tipo: 'pausado', motivo: 'geral' }} />
          <AgentStateIndicator estado={{ tipo: 'pausado', motivo: 'contato', detalhe: 'João Lima' }} />
          <AgentStateIndicator estado={{ tipo: 'pausado', motivo: 'empresa', detalhe: 'Padaria Pão Quente' }} />
          <AgentStateIndicator estado={{ tipo: 'pausado', motivo: 'teto_ia' }} />
          <AgentStateIndicator estado={{ tipo: 'assumido', por: 'Maria Souza' }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <AgentStateIndicator variante="completo" estado={{ tipo: 'ativo' }} />
          <AgentStateIndicator variante="completo" estado={{ tipo: 'pausado', motivo: 'teto_ia' }} />
          <AgentStateIndicator variante="completo" estado={{ tipo: 'pausado', motivo: 'empresa', detalhe: 'Padaria Pão Quente' }} />
          <AgentStateIndicator variante="completo" estado={{ tipo: 'assumido', por: 'Maria Souza' }} />
        </div>
      </Exemplo>

      <div className="grid gap-4 lg:grid-cols-2">
        <Exemplo titulo="MoneyText, DocumentText, RelativeTime" className="grid gap-1 text-base">
          <p>Total: <MoneyText valor={1280} /> · Frete: <MoneyText valor={15} /> · Sem valor: <MoneyText valor={null} /></p>
          <p>CNPJ <DocumentText valor="11222333000181" tipo="cnpj" /> · CPF <DocumentText valor="12345678909" tipo="cpf" /></p>
          <p>CEP <DocumentText valor="30260000" tipo="cep" /> · Telefone <DocumentText valor="5531998765432" tipo="telefone" /></p>
          <p className="text-muted">
            Última mensagem <RelativeTime data={ha(40)} focavel /> · <RelativeTime data={ha(3 * 60)} focavel /> · <RelativeTime data={ha(5 * 3600)} /> · <RelativeTime data={ha(9 * 86400)} />
          </p>
        </Exemplo>
        <Exemplo titulo="PermissionGate" className="flex flex-wrap items-center gap-3">
          <PermissionGate permitido>
            <Button variant="outline" size="sm">Editar (permitido)</Button>
          </PermissionGate>
          <PermissionGate permitido={false} modo="desabilitar" motivo="Só quem tem “Editar cadastro de clientes” pode editar. Peça ao administrador na aba Usuários.">
            <Button variant="outline" size="sm">Editar</Button>
          </PermissionGate>
          <PermissionGate permitido={false} alternativa={<span className="text-sm text-muted">(escondido: sem permissão)</span>}>
            <Button size="sm">Baixar CSV Bling</Button>
          </PermissionGate>
        </Exemplo>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Exemplo titulo="ConfirmDialog">
          <DemoConfirmacoes />
        </Exemplo>
        <Exemplo titulo="Confirmações: os 5 tipos">
          <DemoTiposConfirmacao />
        </Exemplo>
        <Exemplo titulo="BlingExportButton" className="flex flex-col items-start gap-3">
          <BlingExportButton href="#csv-bling-exemplo" />
          <BlingExportButton href="#csv-bling-exemplo" rotulo="Exportar CSV Bling (parte 1)" variante="primary" />
          <BlingExportButton
            href="#csv-bling-exemplo"
            problemas={['Pedido 1043, item 3 (Queijo minas): falta Valor Unitário. Confira o preço na tabela da rede ou a unidade pedida', 'Pedido 1045: falta Nome Comprador']}
          />
        </Exemplo>
      </div>

      <Exemplo titulo="FormField" className="grid gap-4 sm:grid-cols-2">
        <FormField id="p-cnpj" rotulo="CNPJ" ajuda="Só números ou com pontuação." obrigatorio>
          <Input name="cnpj" className="tabular" defaultValue="11.222.333/0001-81" />
        </FormField>
        <FormField id="p-email" rotulo="E-mail" erro="Informe um e-mail válido.">
          <Input name="email" type="email" defaultValue="contato@" />
        </FormField>
        <FormField id="p-obs" rotulo="Observação" ajuda="Aparece para a equipe, não para o cliente." className="sm:col-span-2">
          <Textarea name="observacao" placeholder="Ex.: emitir a nota só depois do dia 10" />
        </FormField>
        <FormField id="p-empresa" rotulo="Empresa (EscolherEmpresa)" ajuda="Busca por nome ou CNPJ; envia o id da empresa." className="sm:col-span-2">
          <EscolherEmpresa
            name="cliente_id"
            empresas={[
              { id: 'e1', nome: 'Supermercado Brasil Ltda', detalhe: 'Brasil · 11.222.333/0001-81' },
              { id: 'e2', nome: 'Padaria Pão Quente Ltda', detalhe: 'Pão Quente · 44.555.666/0001-72' },
              { id: 'e3', nome: 'Mercado Bom Preço Ltda', detalhe: '77.888.999/0001-63', inativa: true },
            ]}
            inicial="e1"
          />
        </FormField>
      </Exemplo>

      <Exemplo titulo="EmptyState" className="grid gap-4 sm:grid-cols-2">
        <EmptyState titulo="Nenhuma conversa aguardando" descricao="Quando o agente passar uma conversa para a equipe, ela aparece aqui." />
        <EmptyState icone={SearchX} titulo="Nada encontrado para “costela”" descricao="Confira a grafia ou limpe os filtros." acao={<Button variant="outline" size="sm">Limpar filtros</Button>} />
      </Exemplo>

      <div className="grid gap-4 lg:grid-cols-2">
        <Exemplo titulo="HistoricoRolante (abre no fim; mensagem nova desce ou mostra “Novas mensagens ↓”)" className="flex h-64 flex-col">
          <HistoricoRolante ultima="exemplo-3" compositor="[data-compositor-exemplo]" rotulo="Exemplo de histórico" role="log" className="min-h-0 flex-1" classNameLista="h-full">
            <div className="flex flex-col gap-3 p-2">
              <MessageBubble autor="cliente" nome="João Lima" hora={ha(3500)} conteudo="Bom dia! Preciso da nota do pedido de ontem." />
              <MessageBubble autor="agente" hora={ha(3490)} conteudo="Bom dia, João! Já encaminhei para o Fiscal." />
              <MessageBubble autor="atendente" nome="Maria Souza" hora={ha(600)} conteudo="Anotado, João. A nota sai amanhã cedo." />
            </div>
          </HistoricoRolante>
        </Exemplo>
        <Exemplo titulo="AvisoErro (?erro= das actions; com limparDaUrl ganha o botão de fechar)" className="flex flex-col gap-3">
          <AvisoErro erro="CNPJ inválido." prefixo="Não foi possível salvar: " />
        </Exemplo>
      </div>

      <Exemplo titulo="MessageBubble" className="flex flex-col gap-3">
        <MessageBubble autor="sistema" hora={ha(3600)} conteudo="Conversa assumida por Maria Souza" />
        <MessageBubble autor="cliente" nome="João Lima" hora={ha(3500)} conteudo="Bom dia! Preciso da nota do pedido de ontem." />
        <MessageBubble autor="agente" hora={ha(3490)} conteudo="Bom dia, João! Já encaminhei para o Fiscal. Assim que a nota sair, envio por aqui." />
        <MessageBubble autor="cliente" nome="João Lima" hora={ha(3000)} transcricao="Ah, e coloca também três fardos de guaraná, por favor." />
        <MessageBubble autor="nota_interna" nome="Maria Souza" hora={ha(2000)} conteudo="Cliente pediu para emitir a nota só depois do dia 10." />
        <MessageBubble autor="cliente" nome="João Lima" hora={ha(1900)} arquivo={{ nome: 'pedido-setembro.pdf', href: '#arquivo-exemplo' }} />
        <MessageBubble autor="atendente" nome="Maria Souza" hora={ha(600)} conteudo="Anotado, João. A nota sai amanhã cedo." falhou acaoFalha={<Button variant="link" size="sm">Tentar de novo</Button>} />
        <MessageBubble autor="pessoa" hora={ha(300)} conteudo="Corrige o pedido #1042: eram 15 costelas." />
        <MessageBubble autor="assistente" hora={ha(290)}>
          <DiffPreview texto={PREVIA_REAL} />
        </MessageBubble>
      </Exemplo>

      <div className="grid gap-4 lg:grid-cols-2">
        <Exemplo titulo="DiffPreview" className="flex flex-col gap-4">
          <DiffPreview texto={PREVIA_COMPLETA} />
          <div>
            <p className="mb-1 text-xs text-subtle">Duas prévias na mesma resposta (uma por pedido):</p>
            <DiffPreview texto={[PREVIA_REAL, PREVIA_REAL.replace('#1042', '#1044').replace('15 PAC', '12 PAC').replace('142,50', '114,00').replace('142,50', '114,00')].join('\n\n')} />
          </div>
          <div>
            <p className="mb-1 text-xs text-subtle">Texto fora do formato (mostra como veio):</p>
            <DiffPreview texto="Pronto, gravei o pedido #1042. Quer que eu gere o CSV do Bling?" />
          </div>
        </Exemplo>
        <Exemplo titulo="OrderSummary" className="block">
          <OrderSummary pedido={PEDIDO} comprador={COMPRADOR} />
        </Exemplo>
      </div>

      <Exemplo titulo="DataTable + FilterBar (ordem, filtros e página na URL; clique na linha abre o Sheet)" className="block">
        <DemoTabela
          linhas={ordenadas.slice(pag.inicio, pag.fim)}
          params={params}
          ordem={ordem}
          paginacao={pag}
          total={ordenadas.length}
          setores={SETORES}
        />
      </Exemplo>

      <div className="grid gap-4 lg:grid-cols-2">
        <Exemplo titulo="DataTable: carregando" className="block">
          <DataTableCarregando colunas={['Nº', 'Empresa', 'Setor', 'Status']} linhas={3} />
        </Exemplo>
        <Exemplo titulo="DataTable: erro e vazio" className="flex flex-col gap-4">
          <DataTable rotulo="Com erro" linhas={[]} colunas={[{ id: 'a', titulo: 'Empresa', celula: () => null }]} chave={() => ''} erro="Não foi possível carregar as demandas." />
          <DataTable
            rotulo="Vazia"
            linhas={[]}
            colunas={[{ id: 'a', titulo: 'Empresa', celula: () => null }]}
            chave={() => ''}
            vazio={<EmptyState icone={Inbox} titulo="Nenhuma demanda aberta" descricao="Tudo em dia no seu setor." acao={<Button variant="outline" size="sm"><FileText aria-hidden size={16} strokeWidth={1.75} />Ver concluídas</Button>} />}
          />
        </Exemplo>
      </div>

      <Exemplo titulo="Atendimento (Parte E): CronometroEspera (verde, âmbar, vermelho) e MarcoConversa">
        <CronometroEspera desde={ha(3 * 60)} limites={LIMITES_PADRAO} />
        <CronometroEspera desde={ha(10 * 60)} limites={LIMITES_PADRAO} />
        <CronometroEspera desde={ha(20 * 60)} limites={LIMITES_PADRAO} />
        <MarcoConversa texto="Demanda #1042 aberta no Fiscal · urgente" criadoEm={ha(60)} />
      </Exemplo>
    </Secao>
  );
}
