import { describe, expect, it } from 'vitest';
import {
  camposAPreencher, contarSituacao, ehEnsinada, empresaDoFormulario, empresaDoTeste, lerRascunho, linhasHistorico,
  podeCompararSemRascunho, quandoHistorico, rotuloSimulador, textoCriacao, textoMedidor,
} from './tela';
import type { Versao } from './versoes';

const ID = '4f1c2b7e-8a9d-4e3f-9b1a-2c3d4e5f6a7b';
const EMPRESA = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

describe('ehEnsinada (D8)', () => {
  it('o formato do "Ensinar o agente", com e sem situação (CRLF conta como uma quebra)', () => {
    expect(ehEnsinada('Situação: Cliente: “quero nota”\nO que fazer: Confirme com a equipe.')).toBe(true);
    expect(ehEnsinada('Situação: linha 1\nlinha 2\r\nO que fazer: x')).toBe(true);
    expect(ehEnsinada('O que fazer: Mande pelo WhatsApp.')).toBe(true);
  });
  it('texto escrito na tela não é', () => {
    expect(ehEnsinada('Comece sempre pelo nome do cliente.')).toBe(false);
    expect(ehEnsinada('Situação: sem o que fazer')).toBe(false);
    expect(ehEnsinada('Quando pedirem, O que fazer: x')).toBe(false);
  });
});

describe('camposAPreencher (D17) e contarSituacao (D16)', () => {
  it('conta "(a preencher)" sem diferenciar maiúsculas', () => {
    expect(camposAPreencher('Endereço: (a preencher)\nPix: (A preencher)')).toBe(2);
    expect(camposAPreencher('Tudo preenchido.')).toBe(0);
  });
  it('todas, ligadas e desligadas', () => {
    expect(contarSituacao([{ ativo: true }, { ativo: false }, { ativo: false }])).toEqual({ todas: 3, ligadas: 1, desligadas: 2 });
    expect(contarSituacao([])).toEqual({ todas: 0, ligadas: 0, desligadas: 0 });
  });
});

describe('textoMedidor', () => {
  it('zerado, sem aviso', () => {
    expect(textoMedidor({ total: 0, nivel: 'ok' }, null)).toEqual({ valor: '0 / 12.000', percentual: '0%', descricao: '0 de 12.000 caracteres', aviso: null });
  });
  it('perto do limite, com a empresa que pesa', () => {
    expect(textoMedidor({ total: 9940, nivel: 'aviso' }, 'Rede Bom Preço')).toEqual({
      valor: '9.940 / 12.000', percentual: '83%', descricao: '9.940 de 12.000 caracteres', aviso: 'Perto do limite (conta com Rede Bom Preço)',
    });
  });
  // Auditoria 5.9: o corte é parcial (não são mais "as gerais mais antigas"); o aviso diz quais ficam de fora.
  it('passou do limite: o percentual passa de 100 no texto e o aviso diz quais ficam de fora', () => {
    expect(textoMedidor({ total: 12500, nivel: 'excesso', cortadas: [{ titulo: 'Boleto' }, { titulo: 'Férias' }] }, null)).toMatchObject({
      percentual: '104%', aviso: 'Passou do limite: ficam de fora "Boleto" e "Férias".',
    });
    expect(textoMedidor({ total: 12500, nivel: 'excesso', cortadas: [{ titulo: 'Boleto' }] }, 'Rede Bom Preço').aviso)
      .toBe('Passou do limite (conta com Rede Bom Preço): fica de fora "Boleto".');
    expect(textoMedidor({ total: 12000, nivel: 'excesso', cortadas: [] }, null).aviso).toBe('No limite: a próxima orientação ligada pode ficar de fora.');
    // Revisão da Task 16: cada corte diz em que empresa acontece (null = conversa sem empresa).
    expect(textoMedidor({ total: 12500, nivel: 'excesso', cortadas: [{ titulo: 'Boleto', empresas: ['Rede Bom Preço'] }, { titulo: 'Férias', empresas: ['Sol', null] }] }, 'Rede Bom Preço').aviso)
      .toBe('Passou do limite (conta com Rede Bom Preço): ficam de fora "Boleto" (com Rede Bom Preço) e "Férias" (com Sol e sem empresa).');
  });
});

describe('histórico (D15)', () => {
  const agora = new Date('2026-10-11T20:00:00Z');
  it('"hoje HH:MM" ou "dd/mm HH:MM", no horário de Brasília', () => {
    expect(quandoHistorico('2026-10-11T18:10:00Z', agora)).toBe('hoje 15:10');
    expect(quandoHistorico('2026-09-29T17:52:00Z', agora)).toBe('29/09 14:52');
  });

  const v = (id: string, acao: Versao['acao'], texto: string, ativo: boolean, criadoEm: string, usuario: string | null = 'Ana'): Versao => ({
    id, acao, titulo: 'Prazo', texto, tipo: 'regra', clienteId: null, setorId: null, ativo, usuario, criadoEm,
  });
  const versoes = [
    v('3', 'ligar', 'B', true, '2026-10-11T18:10:00Z'),
    v('2', 'editar', 'B', false, '2026-10-11T17:58:00Z'),
    v('1', 'criar', 'A', false, '2026-09-29T17:52:00Z', null),
  ];
  const atual = { titulo: 'Prazo', texto: 'B', tipo: 'regra' as const, clienteId: null, setorId: null };

  it('resumo de hoje + "por", "atual" na mais nova, restaurar só onde o conteúdo difere; a criação ensinada diz "no Atendimento"', () => {
    expect(linhasHistorico(versoes, atual, true, agora)).toEqual([
      { id: '3', quando: 'hoje 15:10', resumo: 'Ligou', por: 'por Ana', atual: true, podeRestaurar: false },
      { id: '2', quando: 'hoje 14:58', resumo: 'Editou: texto', por: 'por Ana', atual: false, podeRestaurar: false },
      { id: '1', quando: '29/09 14:52', resumo: 'Criou (desligada) no Atendimento', por: 'por pessoa removida', atual: false, podeRestaurar: true },
    ]);
    expect(linhasHistorico(versoes, atual, false, agora)[2]!.resumo).toBe('Criou (desligada)');
  });

  it('textoCriacao', () => {
    expect(textoCriacao('Ana', true)).toBe('Criada por Ana no Atendimento');
    expect(textoCriacao('Ana', false)).toBe('Criada por Ana');
    expect(textoCriacao(null, true)).toBe('Criada no Atendimento');
  });
});

describe('simulador', () => {
  it('rótulo do que entra no teste (D10)', () => {
    expect(rotuloSimulador({ aberta: null, alterado: false })).toBe('orientações ligadas, sem rascunho');
    expect(rotuloSimulador({ aberta: 'nova', alterado: false })).toBe('usando o rascunho, ligado');
    expect(rotuloSimulador({ aberta: 'salva', alterado: true })).toBe('usando o rascunho, ligado');
    expect(rotuloSimulador({ aberta: 'salva', alterado: false })).toBe('usando esta orientação, ligada');
  });

  const rascunho = { id: ID, titulo: 'Prazo', texto: 'Até as 15h.', tipo: 'regra' as const, cliente_id: null, setor_id: null };
  const salva = { titulo: 'Prazo', texto: 'Até as 15h.', tipo: 'regra' as const, clienteId: null, setorId: null, ativo: true };

  it('"Sem o rascunho" só quando o teste usou algo diferente do que o agente já lê (D4)', () => {
    expect(podeCompararSemRascunho(null, salva)).toBe(false);
    expect(podeCompararSemRascunho(rascunho, null)).toBe(true);
    expect(podeCompararSemRascunho(rascunho, { ...salva, ativo: false })).toBe(true);
    expect(podeCompararSemRascunho(rascunho, salva)).toBe(false);
    expect(podeCompararSemRascunho({ ...rascunho, texto: 'Até as 16h.' }, salva)).toBe(true);
    expect(podeCompararSemRascunho({ ...rascunho, cliente_id: EMPRESA }, salva)).toBe(true);
  });

  it('empresa do teste: a do rascunho (se ativa) até a pessoa escolher (D11)', () => {
    const ativas = new Set([EMPRESA]);
    expect(empresaDoTeste({ manual: false }, EMPRESA, ativas)).toBe(EMPRESA);
    expect(empresaDoTeste({ manual: false }, ID, ativas)).toBeNull();
    expect(empresaDoTeste({ manual: false }, null, ativas)).toBeNull();
    expect(empresaDoTeste({ manual: true, id: null }, EMPRESA, ativas)).toBeNull();
    expect(empresaDoTeste({ manual: true, id: EMPRESA }, null, ativas)).toBe(EMPRESA);
  });

  it('empresaDoFormulario: só com "Uma empresa" e um id', () => {
    expect(empresaDoFormulario(form({ vale: 'empresa', cliente_id: EMPRESA }))).toBe(EMPRESA);
    expect(empresaDoFormulario(form({ vale: 'todos', cliente_id: EMPRESA }))).toBeNull();
    expect(empresaDoFormulario(form({ vale: 'empresa', cliente_id: '' }))).toBeNull();
  });

  it('lerRascunho: o formulário como está vira o rascunho do teste (D9)', () => {
    expect(lerRascunho(form({ titulo: ' Prazo ', texto: 'Até as 15h.\r\nDepois, amanhã.', tipo: 'regra', vale: 'empresa', cliente_id: EMPRESA, setor_id: '' }), ID)).toEqual({
      ok: true, clienteId: EMPRESA,
      rascunho: { id: ID, titulo: 'Prazo', texto: 'Até as 15h.\nDepois, amanhã.', tipo: 'regra', cliente_id: EMPRESA, setor_id: null },
    });
    expect(lerRascunho(form({ titulo: '', texto: 'x', tipo: 'regra', vale: 'todos' }), null))
      .toEqual({ ok: false, erro: 'Informe o título da orientação.', campo: 'titulo' });
    expect(lerRascunho(form({ titulo: 'Prazo', texto: ' ', tipo: 'regra', vale: 'todos' }), null))
      .toEqual({ ok: false, erro: 'Escreva o texto da orientação.', campo: 'texto' });
    expect(lerRascunho(form({ titulo: 'Prazo', texto: 'x', tipo: 'regra', vale: 'empresa', cliente_id: '' }), null))
      .toEqual({ ok: false, erro: 'Escolha a empresa.', campo: 'empresa' });
  });
});
