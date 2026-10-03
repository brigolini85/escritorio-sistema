import { MOTIVOS_PASSAGEM } from '@escritorio/core';
import { describe, expect, it } from 'vitest';
import {
  LIMITES_PADRAO, agruparConversas, corDaEspera, iniciais, lerLimites, linhaDeEstado, minutosDeEspera, previaDaUltima,
  rotuloEsperaLeitor, textoEspera, textoNaoLidas, type LinhaAtendimento,
} from './atendimento';

const AGORA = new Date('2026-10-05T14:00:00-03:00');
const linha = (p: Partial<LinhaAtendimento>): LinhaAtendimento => ({
  id: 'c', telefone: '5531999990001', nome_contato: 'Carla Mendes', empresa: 'Rede Bom Preço', estado: 'agente', atendente_id: null,
  ultima_mensagem: 'oi', ultima_em: '2026-10-05T13:50:00-03:00', ultima_tipo: 'texto', ultima_autor: 'cliente', ultima_transcricao: null,
  chamados_abertos: 0, aguardando_pessoa_desde: null, motivo_pessoa: null, concluida_em: null, espera_desde: null,
  esperando_pessoa: false, esperando_voce: false, nao_lidas: 0, contato_pausado: false, empresa_pausada: false, agente_respondendo: false, ...p,
});

describe('grupos (decisão 10, P1)', () => {
  it('esperando primeiro por quem espera há mais tempo; sem cronômetro por último; concluídas hoje à parte', () => {
    const g = agruparConversas([
      linha({ id: 'a', esperando_pessoa: true, espera_desde: '2026-10-05T13:50:00-03:00' }),
      linha({ id: 'b', esperando_pessoa: true, espera_desde: '2026-10-05T13:30:00-03:00' }),
      linha({ id: 'h', esperando_pessoa: true, estado: 'humano', espera_desde: null }),
      linha({ id: 'g' }),
      linha({ id: 'k', concluida_em: '2026-10-05T12:00:00-03:00', ultima_autor: 'atendente', ultima_em: '2026-10-05T11:59:00-03:00' }),
      linha({ id: 'v', concluida_em: '2026-10-05T12:00:00-03:00', ultima_autor: 'cliente', ultima_em: '2026-10-05T12:30:00-03:00' }),
      linha({ id: 'o', concluida_em: '2026-10-04T12:00:00-03:00', ultima_autor: 'agente' }),
    ], AGORA);
    expect(g.esperando.map((l) => l.id)).toEqual(['b', 'a', 'h']);
    expect(g.comAgente.map((l) => l.id)).toEqual(['g', 'v', 'o']);
    expect(g.concluidasHoje.map((l) => l.id)).toEqual(['k']);
  });
});

describe('cronômetro (spec 7A.1)', () => {
  it('cor pelos limites: verde ≤ 5, âmbar ≤ 15, vermelho > 15', () => {
    expect(corDaEspera(5, LIMITES_PADRAO)).toBe('verde');
    expect(corDaEspera(6, LIMITES_PADRAO)).toBe('ambar');
    expect(corDaEspera(15, LIMITES_PADRAO)).toBe('ambar');
    expect(corDaEspera(16, LIMITES_PADRAO)).toBe('vermelho');
    expect(corDaEspera(16, { verde: 10, ambar: 30 })).toBe('ambar');
  });
  it('minutos, texto curto e texto do leitor de tela', () => {
    expect(minutosDeEspera('2026-10-05T13:42:10-03:00', AGORA.getTime())).toBe(17);
    expect(minutosDeEspera('2026-10-05T14:05:00-03:00', AGORA.getTime())).toBe(0);
    expect(textoEspera(0)).toBe('agora');
    expect(textoEspera(18)).toBe('18 min');
    expect(textoEspera(65)).toBe('1 h 05');
    expect(textoEspera(60 * 26)).toBe('1 d');
    expect(rotuloEsperaLeitor(0)).toBe('esperando há menos de 1 minuto');
    expect(rotuloEsperaLeitor(1)).toBe('esperando há 1 minuto');
    expect(rotuloEsperaLeitor(18)).toBe('esperando há 18 minutos');
    expect(rotuloEsperaLeitor(65)).toBe('esperando há 1 hora e 5 minutos');
  });
  it('limites vindos do banco; inválidos viram o padrão', () => {
    expect(lerLimites({ verde: 3, ambar: 10 })).toEqual({ verde: 3, ambar: 10 });
    expect(lerLimites(null)).toEqual(LIMITES_PADRAO);
    expect(lerLimites({ verde: 'x' })).toEqual(LIMITES_PADRAO);
  });
});

describe('linha de estado (decisão 11)', () => {
  const ctx = { usuarioId: 'eu', nomes: new Map([['bruno', 'Bruno']]), pausaGeral: false as boolean | null };
  it('na ordem: assumida, pausa, pedido, passou, respondendo, resolvido, com o agente', () => {
    expect(linhaDeEstado(linha({ estado: 'humano', atendente_id: 'bruno' }), ctx).texto).toBe('com Bruno');
    expect(linhaDeEstado(linha({ estado: 'humano', atendente_id: 'eu' }), ctx).texto).toBe('com você');
    expect(linhaDeEstado(linha({ empresa_pausada: true, aguardando_pessoa_desde: 'x', motivo_pessoa: MOTIVOS_PASSAGEM.pausaEmpresa }), ctx).texto)
      .toBe('agente pausado para esta empresa');
    expect(linhaDeEstado(linha({ contato_pausado: true }), ctx).texto).toBe('agente pausado para este contato');
    expect(linhaDeEstado(linha({}), { ...ctx, pausaGeral: true }).texto).toBe('agente pausado');
    expect(linhaDeEstado(linha({ aguardando_pessoa_desde: 'x', motivo_pessoa: MOTIVOS_PASSAGEM.pedidoCliente }), ctx))
      .toEqual({ tipo: 'pedido', texto: 'pediu para falar com pessoa' });
    expect(linhaDeEstado(linha({ aguardando_pessoa_desde: 'x', motivo_pessoa: MOTIVOS_PASSAGEM.naoEntendeu }), ctx))
      .toEqual({ tipo: 'passou', texto: 'agente passou: não entendeu o pedido duas vezes' });
    expect(linhaDeEstado(linha({ agente_respondendo: true }), ctx).texto).toBe('respondendo');
    expect(linhaDeEstado(linha({ ultima_autor: 'agente', chamados_abertos: 0 }), ctx).texto).toBe('resolvido pelo agente');
    expect(linhaDeEstado(linha({ ultima_autor: 'agente', chamados_abertos: 1 }), ctx).texto).toBe('com o agente');
  });
});

describe('prévia, iniciais e não lidas', () => {
  it('áudio mostra a transcrição; agente leva o prefixo; anexo sem texto', () => {
    expect(previaDaUltima(linha({ ultima_tipo: 'audio', ultima_mensagem: null, ultima_transcricao: 'a funcionária nova' }))).toBe('Áudio: “a funcionária nova”');
    expect(previaDaUltima(linha({ ultima_tipo: 'audio', ultima_mensagem: null, ultima_transcricao: null }))).toBe('Áudio');
    expect(previaDaUltima(linha({ ultima_autor: 'agente', ultima_mensagem: 'Anotado' }))).toBe('Agente: Anotado');
    expect(previaDaUltima(linha({ ultima_tipo: 'documento', ultima_mensagem: null }))).toBe('Anexo');
    expect(previaDaUltima(linha({ ultima_mensagem: null, ultima_em: null }))).toBe('Sem mensagens');
  });
  it('iniciais', () => {
    expect(iniciais('Carla Mendes')).toBe('CM');
    expect(iniciais('rita')).toBe('R');
    expect(iniciais('Paulo de Andrade Souza')).toBe('PS');
    expect(iniciais('5531999990001')).toBe('#');
  });
  it('não lidas até 9+', () => {
    expect(textoNaoLidas(3)).toBe('3');
    expect(textoNaoLidas(12)).toBe('9+');
  });
});
