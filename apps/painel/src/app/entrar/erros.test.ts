import { describe, expect, it } from 'vitest';
import { mensagemDeErro } from './erros';

describe('mensagemDeErro (tela de entrada)', () => {
  it('sessão vencida (item 7)', () => {
    expect(mensagemDeErro('sessao')).toBe('Sua sessão expirou. Entre de novo.');
  });
  it('códigos de sempre', () => {
    expect(mensagemDeErro('credenciais')).toBe('E-mail ou senha incorretos.');
  });
  it.each(['Ligue para 0800', 'constructor', '__proto__', 'toString', ''])('desconhecido %j vira texto genérico (item 10)', (c) => {
    expect(mensagemDeErro(c)).toBe('Não foi possível entrar.');
  });
});
