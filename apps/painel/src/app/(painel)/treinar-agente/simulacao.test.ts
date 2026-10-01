import { describe, expect, it } from 'vitest';
import {
  lerRespostas, MENSAGEM_FALHA_TESTE, PedidoTeste, PRAZO_ESPERA_MS, prazoDoTeste, rascunhoDoFormulario, resultadoDaLinha,
} from './simulacao';

const ID = '4f1c2b7e-8a9d-4e3f-9b1a-2c3d4e5f6a7b';

describe('PedidoTeste', () => {
  it('limpa a mensagem e aceita sem empresa e sem rascunho', () => {
    expect(PedidoTeste.parse({ mensagem: '  Oi,\r\nquero a guia  ', clienteId: null, rascunho: null }))
      .toEqual({ mensagem: 'Oi,\nquero a guia', clienteId: null, rascunho: null });
  });

  it('recusa mensagem vazia ou longa demais com as mensagens do banco', () => {
    expect(PedidoTeste.safeParse({ mensagem: '   ', clienteId: null, rascunho: null }).error?.issues[0]?.message)
      .toBe('Escreva a mensagem do cliente para o teste.');
    expect(PedidoTeste.safeParse({ mensagem: 'a'.repeat(2001), clienteId: null, rascunho: null }).error?.issues[0]?.message)
      .toBe('A mensagem de teste pode ter no máximo 2000 caracteres.');
    // CRLF conta como um caractere.
    expect(PedidoTeste.safeParse({ mensagem: `${'a'.repeat(1998)}\r\nb`, clienteId: null, rascunho: null }).success).toBe(true);
  });

  it('empresa e ids do rascunho precisam ser uuid; chaves a mais no rascunho não passam', () => {
    expect(PedidoTeste.safeParse({ mensagem: 'oi', clienteId: 'x', rascunho: null }).error?.issues[0]?.message).toBe('Empresa não encontrada.');
    const rascunho = { id: null, titulo: 't', texto: 'x', tipo: 'jeito', cliente_id: null, setor_id: null };
    expect(PedidoTeste.safeParse({ mensagem: 'oi', clienteId: ID, rascunho }).success).toBe(true);
    expect(PedidoTeste.safeParse({ mensagem: 'oi', clienteId: null, rascunho: { ...rascunho, id: 'nova' } }).success).toBe(false);
    expect(PedidoTeste.safeParse({ mensagem: 'oi', clienteId: null, rascunho: { ...rascunho, ativo: true } }).success).toBe(false);
  });
});

describe('rascunhoDoFormulario', () => {
  it('leva os campos do formulário com os nomes do banco e o id da orientação editada', () => {
    expect(rascunhoDoFormulario({ titulo: 'T', texto: 'X', tipo: 'regra', clienteId: ID, setorId: null, ativo: false }, ID))
      .toEqual({ id: ID, titulo: 'T', texto: 'X', tipo: 'regra', cliente_id: ID, setor_id: null });
  });
});

describe('lerRespostas', () => {
  it('lê o formato do trabalhador', () => {
    const r = { mensagens: ['Oi!', 'Já vejo.'], acoes: [{ ferramenta: 'abrir_chamado', resumo: 'Abriria uma demanda no Fiscal: Guia' }], observacoes: ['Aviso'] };
    expect(lerRespostas(r)).toEqual(r);
  });

  it('ignora o que não for texto e aceita nulo', () => {
    expect(lerRespostas(null)).toEqual({ mensagens: [], acoes: [], observacoes: [] });
    expect(lerRespostas({ mensagens: ['a', 3, '  '], acoes: [{ resumo: 'b' }, { ferramenta: 'x' }, 'c'], observacoes: 'd' }))
      .toEqual({ mensagens: ['a'], acoes: [{ ferramenta: '', resumo: 'b' }], observacoes: [] });
  });
});

describe('resultadoDaLinha', () => {
  it('pendente pensa, pronta mostra as respostas e erro sem texto usa a mensagem padrão', () => {
    expect(resultadoDaLinha({ status: 'pendente', respostas: null, erro: null })).toEqual({ fase: 'pensando' });
    expect(resultadoDaLinha({ status: 'pronta', respostas: { mensagens: ['Oi'] }, erro: null }))
      .toEqual({ fase: 'pronta', respostas: { mensagens: ['Oi'], acoes: [], observacoes: [] } });
    expect(resultadoDaLinha({ status: 'erro', respostas: null, erro: 'Limite' })).toEqual({ fase: 'erro', erro: 'Limite' });
    expect(resultadoDaLinha({ status: 'erro', respostas: null, erro: null })).toEqual({ fase: 'erro', erro: MENSAGEM_FALHA_TESTE });
  });
});

describe('prazoDoTeste', () => {
  const agora = Date.parse('2026-09-30T12:00:00Z');
  it('conta do criado_em, com pelo menos 30 s e no máximo o prazo inteiro', () => {
    expect(prazoDoTeste('2026-09-30T11:58:00Z', agora)).toBe(agora + 3 * 60_000);
    expect(prazoDoTeste('2026-09-30T11:50:00Z', agora)).toBe(agora + 30_000);
    expect(prazoDoTeste('2026-09-30T12:10:00Z', agora)).toBe(agora + PRAZO_ESPERA_MS);
    expect(prazoDoTeste('quebrado', agora)).toBe(agora + PRAZO_ESPERA_MS);
  });
});
