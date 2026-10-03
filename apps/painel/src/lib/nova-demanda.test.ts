import { describe, expect, it } from 'vitest';
import { campoDoErro, validarNovaDemanda } from './nova-demanda';

const base = { cliente: 'c1', setor: 's1', titulo: 'Férias da Joana', descricao: '' };

describe('validarNovaDemanda', () => {
  it('empresa, setor e título de 3 a 120 caracteres', () => {
    expect(validarNovaDemanda(base)).toEqual({ ok: true });
    expect(validarNovaDemanda({ ...base, cliente: '' })).toEqual({ ok: false, erro: 'Escolha a empresa.', campo: 'cliente' });
    expect(validarNovaDemanda({ ...base, setor: '' })).toEqual({ ok: false, erro: 'Escolha o setor.', campo: 'setor' });
    expect(validarNovaDemanda({ ...base, titulo: ' ab ' })).toEqual({ ok: false, erro: 'O título precisa ter de 3 a 120 caracteres.', campo: 'titulo' });
    expect(validarNovaDemanda({ ...base, descricao: 'x'.repeat(4001) })).toEqual({ ok: false, erro: 'A descrição pode ter até 4000 caracteres.', campo: 'descricao' });
  });
});

describe('campoDoErro', () => {
  it('a mensagem do banco aponta o campo certo', () => {
    expect(campoDoErro('Escolha uma pessoa ativa do setor da demanda.')).toBe('responsavel');
    expect(campoDoErro('Escolha um contato desta empresa.')).toBe('contato');
    expect(campoDoErro('Escolha uma empresa ativa.')).toBe('cliente');
    expect(campoDoErro('Escolha um dos seus setores.')).toBe('setor');
    expect(campoDoErro('O prazo precisa ser depois de agora.')).toBe('prazo');
    expect(campoDoErro('Acesso desativado.')).toBeUndefined();
  });
});
