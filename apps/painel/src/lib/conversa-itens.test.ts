import { describe, expect, it } from 'vitest';
import {
  agruparPorTurno, cartoesDeDecisao, marcosDaConversa, ocultarPedidoDasDecisoes, juntarDecisoes, porQueDasMensagens, resumoPorQue, turnoDaPassagem, documentosAbertos, type DecisaoBruta,
} from './conversa-itens';
import { AVISO_SEM_ACESSO_PEDIDO } from './pedido-nota';

const d = (id: string, etapa: string, turno: string | null, criado_em: string, saida: unknown = {}): DecisaoBruta =>
  ({ id, etapa, entrada: { x: 1 }, saida, justificativa: null, criado_em, turno });

const DECISOES = [
  d('1', 'buscar_produtos', 'T1', '2026-10-05T14:31:00Z'),
  d('2', 'responder', 'T1', '2026-10-05T14:31:05Z'),
  d('3', 'sinalizar_nao_entendido', 'T2', '2026-10-05T14:32:00Z'),
  d('4', 'abrir_chamado', 'T2', '2026-10-05T14:32:01Z', { numero: 1042, setor: 'Fiscal' }),
  d('5', 'responder', 'T2', '2026-10-05T14:32:02Z'),
  d('6', 'consultar_preco', null, '2026-10-04T10:00:00Z'),
];

describe('"por quê?" (decisão 5)', () => {
  it('fica na última mensagem do turno, sem o responder', () => {
    const msgs = [
      { id: 'm1', autor: 'agente', turno_agente: 'T1', criado_em: '2026-10-05T14:31:04Z' },
      { id: 'm2', autor: 'agente', turno_agente: 'T2', criado_em: '2026-10-05T14:32:02Z' },
      { id: 'm3', autor: 'agente', turno_agente: 'T2', criado_em: '2026-10-05T14:32:03Z' },
      { id: 'm4', autor: 'agente', turno_agente: null, criado_em: '2026-10-04T10:00:01Z' },
      { id: 'm5', autor: 'cliente', turno_agente: null, criado_em: '2026-10-05T14:30:00Z' },
    ];
    const pq = porQueDasMensagens(msgs, DECISOES);
    expect(pq.get('m1')!.map((x) => x.etapa)).toEqual(['buscar_produtos']);
    expect(pq.has('m2')).toBe(false);
    expect(pq.get('m3')!.map((x) => x.etapa)).toEqual(['sinalizar_nao_entendido', 'abrir_chamado']);
    expect(pq.has('m4')).toBe(false); // antiga, sem turno (P20)
    expect(pq.has('m5')).toBe(false);
  });
  it('resumo curto, sem repetir', () => {
    expect(resumoPorQue([d('a', 'buscar_produtos', 'T', 'x'), d('b', 'buscar_produtos', 'T', 'x'), d('c', 'consultar_preco', 'T', 'x')]))
      .toBe('buscou produtos · consultou um preço');
  });
});

describe('cartões de decisão', () => {
  it('um por turno com ação, com o número e o setor da demanda', () => {
    const c = cartoesDeDecisao(DECISOES);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ turno: 'T2', criado_em: '2026-10-05T14:32:00Z' });
    expect(c[0]!.linha).toBe('Não entendeu a mensagem → Abriu uma demanda (#1042 no Fiscal)');
  });
});

describe('P11: sem acesso a pedidos de nota', () => {
  it('etapas de pedido perdem entrada e saída; as outras ficam', () => {
    const r = ocultarPedidoDasDecisoes([d('p', 'abrir_pedido_nota', 'T', 'x', { numero: 9 }), d('q', 'buscar_produtos', 'T', 'x')], false);
    expect(r[0]).toMatchObject({ entrada: null, saida: { aviso: AVISO_SEM_ACESSO_PEDIDO } });
    expect(r[1]!.entrada).toEqual({ x: 1 });
    expect(ocultarPedidoDasDecisoes(DECISOES, true)).toEqual(DECISOES);
  });
});

describe('marcos (decisão 6)', () => {
  it('eventos da conversa e das demandas, em texto', () => {
    const m = marcosDaConversa({
      eventos: [
        { id: 'e1', tipo: 'passou_para_pessoa', texto: 'pediu para falar com pessoa', criado_em: '1', usuario: null },
        { id: 'e2', tipo: 'assumida', texto: null, criado_em: '2', usuario: 'Ana' },
        { id: 'e3', tipo: 'devolvida', texto: null, criado_em: '3', usuario: 'Ana' },
        { id: 'e4', tipo: 'concluida', texto: null, criado_em: '4', usuario: null },
        { id: 'e5', tipo: 'empresa_trocada', texto: 'Rede Um → Padaria Dois', criado_em: '5', usuario: 'Ana' },
      ],
      demandas: [{ id: 'd1', numero: 1042, setor: 'Fiscal', prioridade: 'urgente', criado_em: '6', concluido_em: '8' }, { id: 'd2', numero: 7, setor: null, prioridade: 'normal', criado_em: '7', concluido_em: null }],
      transferencias: [{ id: 't1', numero: 7, setor: 'Pessoal', criado_em: '9' }],
    });
    expect(m.map((x) => x.texto)).toEqual([
      'O agente passou para uma pessoa: pediu para falar com pessoa', 'Ana assumiu', 'Devolvido ao agente por Ana', 'Atendimento concluído',
      'Empresa trocada: Rede Um → Padaria Dois', 'Demanda #1042 aberta no Fiscal · urgente', 'Demanda #7 aberta na Triagem · normal',
      'Demanda #1042 concluída', 'Demanda #7 transferida para Pessoal',
    ]);
  });
});

describe('turnos', () => {
  it('agrupa por turno (sem turno: cada uma sozinha), o mais novo primeiro', () => {
    expect(agruparPorTurno(DECISOES).map((g) => [g.turno, g.decisoes.length])).toEqual([['T2', 3], ['T1', 2], [null, 1]]);
  });
});

describe('Ver decisão da passagem', () => {
  const msgs = [
    { autor: 'cliente', criado_em: '2026-10-05T14:30:00Z' },
    { autor: 'cliente', criado_em: '2026-10-05T14:31:59Z' },
  ];
  it('escalação: aponta o turno que passou para pessoa', () => {
    expect(turnoDaPassagem(DECISOES, msgs, '2026-10-05T14:32:30Z')).toBe('T2');
  });
  it('pausa ou teto (agente não rodou depois da última mensagem do cliente): sem turno, sem botão', () => {
    const depois = [...msgs, { autor: 'cliente', criado_em: '2026-10-05T15:00:00Z' }];
    expect(turnoDaPassagem(DECISOES, depois, '2026-10-05T15:00:01Z')).toBeNull();
  });
  it('turno sem ação (só consulta) não vira alvo; sem passagem, null', () => {
    expect(turnoDaPassagem(DECISOES.filter((x) => x.turno !== 'T2'), msgs, '2026-10-05T14:32:30Z')).toBeNull();
    expect(turnoDaPassagem(DECISOES, msgs, null)).toBeNull();
  });
});

describe('juntarDecisoes (P11: pedido lido sem conteúdo)', () => {
  it('junta as duas leituras, mais novas primeiro, no limite, e as de pedido ficam sem entrada/saida', () => {
    const completas = [d('a', 'consultar', 'T1', '2026-10-05T10:00:03Z'), d('b', 'consultar', 'T1', '2026-10-05T10:00:01Z')];
    const pedido = [{ id: 'p', etapa: 'abrir_pedido_nota', justificativa: null, criado_em: '2026-10-05T10:00:02Z', turno: 'T1' }];
    const r = juntarDecisoes(completas, pedido, 2);
    expect(r.map((x) => x.id)).toEqual(['a', 'p']);
    expect(r[1]?.entrada).toBeNull();
    expect(r[1]?.saida).toBeNull();
  });
});

describe('link do documento', () => {
  const docs = [{ id: 'a', cliente_id: 'E1' }, { id: 'b', cliente_id: 'E2' }, { id: 'c', cliente_id: 'E3' }];
  it('só da empresa da conversa ou de outra empresa ativa do contato', () => {
    expect([...documentosAbertos(docs, 'E1', ['E2', null])].sort()).toEqual(['a', 'b']);
    expect([...documentosAbertos(docs, null, [])]).toEqual([]);
  });
});
