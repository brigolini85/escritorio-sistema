import { describe, expect, it } from 'vitest';
import { lerEnderecoFonte } from '@escritorio/core';
import {
  contatosDaEscolha, diasMarcados, NOTA_LIMITE_ENVIO, textoAprovado, diasDosAtalhos, limparAssuntos, podeAprovar, podeDecidir, resumoEscolha, validarAssuntos, validarEtiqueta, validarFonte, validarLimite, validarPaginas,
} from './janelas';

describe('validarFonte', () => {
  it('nome de 2 a 60 letras', () => {
    expect(validarFonte({ nome: 'A', endereco: 'cfc.org.br' })).toBe('O nome da fonte tem de 2 a 60 letras.');
    expect(validarFonte({ nome: 'x'.repeat(61), endereco: 'cfc.org.br' })).toBe('O nome da fonte tem de 2 a 60 letras.');
    expect(validarFonte({ nome: '  CFC  ', endereco: 'cfc.org.br' })).toBeNull();
  });
  it('endereço com a frase do core', () => {
    const r = lerEnderecoFonte('x');
    expect(r.ok).toBe(false);
    expect(validarFonte({ nome: 'CFC', endereco: 'x' })).toBe(r.ok ? '' : r.erro);
  });
});

describe('páginas da fonte', () => {
  it('até 5, cada uma dentro do formato de endereço', () => {
    expect(validarPaginas('')).toEqual({ ok: true, paginas: [] });
    expect(validarPaginas('gov.br/a\n\n gov.br/b ')).toEqual({ ok: true, paginas: ['gov.br/a', 'gov.br/b'] });
    expect(validarPaginas('a\nb\nc\nd\ne\nf')).toEqual({ ok: false, erro: 'No máximo 5 páginas.' });
  });
});

describe('agenda', () => {
  it('diasMarcados', () => {
    expect(diasMarcados([1, 2, 3, 4, 5])).toEqual({ dom: false, seg: true, ter: true, qua: true, qui: true, sex: true, sab: false });
    expect(Object.values(diasMarcados([])).every((x) => !x)).toBe(true);
  });
  it('atalhos', () => {
    expect(diasDosAtalhos('todo')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(diasDosAtalhos('uteis')).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('escolha de clientes', () => {
  it('resumoEscolha', () => {
    expect(resumoEscolha(23, 23)).toBe('Todos os 23 clientes');
    expect(resumoEscolha(5, 23)).toBe('5 de 23 clientes');
    expect(resumoEscolha(1, 1)).toBe('O único cliente');
    expect(resumoEscolha(0, 23)).toBe('Nenhum dos 23 clientes');
  });
  it('contatosDaEscolha soma só os marcados', () => {
    const linhas = [{ id: 'a', nome: 'A', contatos: 2 }, { id: 'b', nome: 'B', contatos: 0 }, { id: 'c', nome: 'C', contatos: 3 }];
    expect(contatosDaEscolha(linhas, ['a', 'c'])).toBe(5);
    expect(contatosDaEscolha(linhas, new Set(['b']))).toBe(0);
    expect(contatosDaEscolha(linhas, [])).toBe(0);
  });
  it('podeAprovar', () => {
    expect(podeAprovar({ texto: '', clientes: 1, contatos: 1 })).toBe('Escreva a mensagem.');
    expect(podeAprovar({ texto: '   ', clientes: 1, contatos: 1 })).toBe('Escreva a mensagem.');
    expect(podeAprovar({ texto: 'Oi', clientes: 201, contatos: 10 })).toBe('Até 200 clientes por envio.');
    expect(podeAprovar({ texto: 'Oi', clientes: 0, contatos: 0 })).toBe('Escolha ao menos um cliente.');
    expect(podeAprovar({ texto: 'Oi', clientes: 3, contatos: 0 })).toBe('Nenhum contato dos clientes escolhidos pode ser procurado.');
    expect(podeAprovar({ texto: 'Oi', clientes: 3, contatos: 301 })).toBe('Até 300 contatos por envio.');
    expect(podeAprovar({ texto: 'x'.repeat(1001), clientes: 1, contatos: 1 })).toBe('A mensagem tem no máximo 1.000 letras.');
    expect(podeAprovar({ texto: 'Oi', clientes: 3, contatos: 4 })).toBeNull();
  });
  it('quem aprova: do setor, administrador ou dono', () => {
    expect(podeDecidir({ dono: false, admin: false, meusSetores: ['s1'], setorId: 's1' })).toBe(true);
    expect(podeDecidir({ dono: false, admin: false, meusSetores: ['s2'], setorId: 's1' })).toBe(false);
    expect(podeDecidir({ dono: false, admin: true, meusSetores: [], setorId: 's1' })).toBe(true);
    expect(podeDecidir({ dono: true, admin: false, meusSetores: [], setorId: 's1' })).toBe(true);
  });
});

describe('assuntos e limite', () => {
  it('limparAssuntos tira vazios e repetidos (sem diferença de maiúsculas)', () => {
    expect(limparAssuntos(['  Simples Nacional ', '', 'simples nacional', 'MEI'])).toEqual(['Simples Nacional', 'MEI']);
  });
  it('validarAssuntos', () => {
    expect(validarAssuntos(['MEI'])).toBeNull();
    expect(validarAssuntos(['A'])).toBe('Cada assunto tem de 2 a 60 letras.');
    expect(validarAssuntos(['x'.repeat(61)])).toBe('Cada assunto tem de 2 a 60 letras.');
    expect(validarAssuntos(Array.from({ length: 21 }, (_, i) => `Assunto ${i}`))).toBe('No máximo 20 assuntos.');
  });
  it('validarLimite de 0,05 a 5,00 (aceita vírgula)', () => {
    expect(validarLimite('0,50')).toEqual({ ok: true, valor: 0.5 });
    expect(validarLimite('5')).toEqual({ ok: true, valor: 5 });
    expect(validarLimite('0.04')).toEqual({ ok: false, erro: 'O limite vai de US$ 0,05 a US$ 5,00.' });
    expect(validarLimite('5,01')).toEqual({ ok: false, erro: 'O limite vai de US$ 0,05 a US$ 5,00.' });
    expect(validarLimite('abc')).toEqual({ ok: false, erro: 'O limite vai de US$ 0,05 a US$ 5,00.' });
  });
});

describe('etiqueta', () => {
  it('2 a 4 letras', () => {
    expect(validarEtiqueta('FED')).toBeNull();
    expect(validarEtiqueta('mg')).toBeNull();
    expect(validarEtiqueta('F')).toBe('A etiqueta tem de 2 a 4 letras (FED, MG, MUN).');
    expect(validarEtiqueta('FED1')).toBe('A etiqueta tem de 2 a 4 letras (FED, MG, MUN).');
  });
});

describe('envio aprovado', () => {
  it('toast e nota do limite diário', () => {
    expect(textoAprovado(12)).toBe('Aprovado: 12 contatos recebem pelo WhatsApp do escritório, na voz do Thiago.');
    expect(textoAprovado(1)).toBe('Aprovado: 1 contato recebe pelo WhatsApp do escritório, na voz do Thiago.');
    expect(NOTA_LIMITE_ENVIO).toContain('no máximo 3 por contato e 30 no escritório por dia');
  });
});
