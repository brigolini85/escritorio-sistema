import { describe, expect, it } from 'vitest';
import { custoPorEtapa, nomeDoCsv, pendenciasAbertas, podeAprovar, podeCobrarDeNovo, rotuloQuem, situacaoPedido, situacaoPedidoNaTela, textoDoEstado, textoDoPedido, podeMandarPedido, type PendenciaTela, type TarefaTela } from './tarefas-tela';

const AGORA = new Date('2026-10-02T12:00:00Z');
const pend = (p: Partial<PendenciaTela>): PendenciaTela => ({
  id: 'p', numero: 1, tipo: 'cliente', pergunta: 'Extrato do BB', detalhe: null, opcoes: [], mensagem: 'Pode mandar?', estado: 'aberta', resposta: null,
  respondidaPor: null, respondidaEm: null, contato: null, pedidoTexto: null, pedidoEm: null, pedidoEnviadoEm: null, pedidos: 0, ...p,
});
const tarefa = (t: Partial<TarefaTela>): TarefaTela => ({
  id: 't', numero: 3, estado: 'pronta', motivoPausa: null, agente: 'Agente Contábil', setorId: 's', setor: 'Contábil',
  demanda: { id: 'd', numero: 1088, titulo: 'Fechamento' }, empresa: null, pedido: 'x', pedidaPor: 'Cláudia', canal: 'painel', criadoEm: '2026-10-01T11:12:00Z',
  etapas: [{ nome: 'Ler', concluida: true, resumo: null }, { nome: 'Aprovação', concluida: false, resumo: null }], etapaAtual: 2, resultado: null,
  ajustePendente: false, custoUsd: 0.86, custoEtapas: { '1': 0.52, '2': 0.34 }, limiteUsd: 2, limiteMinutos: 20, segundosTrabalhando: 300,
  pendencias: [], arquivos: [], eventos: [], decididaPor: null, decididaEm: null, ...t,
});

describe('tela da tarefa (D7, D11, D12)', () => {
  it('aprovar só pronto e sem pendência aberta', () => {
    expect(podeAprovar(tarefa({}))).toBe(true);
    expect(podeAprovar(tarefa({ pendencias: [pend({})] }))).toBe(false);
    expect(podeAprovar(tarefa({ estado: 'aguardando_pendencias' }))).toBe(false);
    expect(pendenciasAbertas(tarefa({ pendencias: [pend({}), pend({ estado: 'respondida' })] }))).toBe(1);
  });
  it('estado com o motivo da pausa', () => {
    expect(textoDoEstado(tarefa({ estado: 'pausada', motivoPausa: 'limite_custo' }))).toBe('Pausada: chegou ao limite de custo desta tarefa.');
    expect(textoDoEstado(tarefa({}))).toBe('Pronto para aprovar');
  });
  it('pedido ao cliente: a pedir, enviando, aguardando, recebida; cobrar de novo só depois de 24 h e até 5 vezes', () => {
    expect(situacaoPedido(pend({}))).toBe('a_pedir');
    expect(situacaoPedido(pend({ pedidoEm: '2026-10-02T11:59:00Z' }))).toBe('enviando');
    expect(situacaoPedido(pend({ pedidoEm: '2026-10-02T10:00:00Z', pedidoEnviadoEm: '2026-10-02T10:00:05Z' }))).toBe('aguardando');
    expect(situacaoPedido(pend({ estado: 'respondida' }))).toBe('recebida');
    expect(podeCobrarDeNovo(pend({ pedidoEm: '2026-10-02T10:00:00Z', pedidos: 1 }), AGORA)).toBe(false);
    expect(podeCobrarDeNovo(pend({ pedidoEm: '2026-10-01T10:00:00Z', pedidos: 1 }), AGORA)).toBe(true);
    expect(podeCobrarDeNovo(pend({ pedidoEm: '2026-09-01T10:00:00Z', pedidos: 5 }), AGORA)).toBe(false);
  });
  it('custo por etapa na ordem das etapas; quem fez cada evento; nome do CSV', () => {
    expect(custoPorEtapa(tarefa({}))).toEqual([{ nome: 'Ler', custo: 0.52 }, { nome: 'Aprovação', custo: 0.34 }]);
    expect(rotuloQuem({ quem: 'agente', nome: '', texto: '', criadoEm: '' }, 'Agente Contábil')).toBe('Agente Contábil');
    expect(rotuloQuem({ quem: 'sistema', nome: '', texto: '', criadoEm: '' }, 'x')).toBe('Sistema');
    expect(rotuloQuem({ quem: 'pessoa', nome: 'Cláudia', texto: '', criadoEm: '' }, 'x')).toBe('Cláudia');
    expect(nomeDoCsv(tarefa({}))).toBe('tarefa-3-rascunho.csv');
    expect(nomeDoCsv(tarefa({ estado: 'aprovada' }))).toBe('tarefa-3-aprovada.csv');
  });
});

describe('situação do pedido na tela (Task 4: pedido sem envio há mais de 24 h)', () => {
  it('"enviando" vira "não enviado" depois de 24 h; antes disso segue enviando', () => {
    expect(situacaoPedidoNaTela(pend({ pedidoEm: '2026-10-02T11:00:00Z' }), AGORA)).toBe('enviando');
    expect(situacaoPedidoNaTela(pend({ pedidoEm: '2026-10-01T11:00:00Z' }), AGORA)).toBe('nao_enviado');
    expect(situacaoPedidoNaTela(pend({ pedidoEm: '2026-10-01T11:00:00Z', pedidoEnviadoEm: '2026-10-01T11:01:00Z' }), AGORA)).toBe('aguardando');
    expect(situacaoPedidoNaTela(pend({}), AGORA)).toBe('a_pedir');
  });
});

describe('texto do pedido (nunca diz que foi enviado sem pedidoEnviadoEm) e botão Mandar', () => {
  it('textos por situação', () => {
    expect(textoDoPedido(pend({}), AGORA)).toBeNull();
    expect(textoDoPedido(pend({ contato: 'Roberto', pedidoEm: '2026-10-02T11:00:00Z' }), AGORA)).toBe('Aprovado, aguardando envio');
    expect(textoDoPedido(pend({ contato: 'Roberto', pedidoEm: '2026-10-01T11:00:00Z' }), AGORA)).toBe('Não enviado');
    expect(textoDoPedido(pend({ contato: 'Roberto', pedidoEm: '2026-10-01T11:00:00Z', pedidoEnviadoEm: '2026-10-01T11:05:00Z' }), AGORA)).toMatch(/^Pedido pelo Thiago ao contato Roberto em /);
  });
  it('pedido segurado (revisão final): a tela diz por que ainda não saiu', () => {
    const aprovado = { contato: 'Roberto', pedidoEm: '2026-10-02T11:00:00Z' };
    expect(textoDoPedido(pend({ ...aprovado, segurado: 'atendimento_humano' }), AGORA)).toBe('Aguardando a conversa voltar para o Thiago');
    expect(textoDoPedido(pend({ ...aprovado, segurado: 'pausado' }), AGORA)).toBe('Aguardando o atendimento automático voltar (está pausado)');
    expect(textoDoPedido(pend({ ...aprovado, segurado: 'limite_dia' }), AGORA)).toBe('Aguardando: o limite de pedidos do dia foi atingido');
    expect(textoDoPedido(pend({ ...aprovado, segurado: 'nao_procuravel' }), AGORA))
      .toBe('Não pode ser enviado: o contato não pode mais ser procurado por este setor');
    // Passadas as 24 h, vale o "não enviado" de sempre.
    expect(textoDoPedido(pend({ contato: 'Roberto', pedidoEm: '2026-10-01T11:00:00Z', segurado: 'atendimento_humano' }), AGORA)).toBe('Não enviado');
  });
  it('Mandar pelo Thiago fica desabilitado sem contato escolhido', () => {
    expect(podeMandarPedido('', 'Pode mandar o extrato?')).toBe(false);
    expect(podeMandarPedido('c1', 'ok')).toBe(false);
    expect(podeMandarPedido('c1', 'Pode mandar o extrato?')).toBe(true);
  });
});
