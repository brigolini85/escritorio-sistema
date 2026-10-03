import { afterEach, describe, expect, it, vi } from 'vitest';
import { destinoSemAcesso, lerSituacao } from './situacao-acesso';

afterEach(() => vi.restoreAllMocks());

describe('lerSituacao (erro de banco não é "acesso desativado")', () => {
  it('erro na consulta vira indisponível e vai para o log', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(lerSituacao({ data: null, error: { message: 'timeout' } }, 'entrar')).toBe('indisponivel');
    expect(log).toHaveBeenCalledWith('[entrar] situação de acesso', 'timeout');
  });
  it('sem erro, lê a resposta como antes', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(lerSituacao({ data: { situacao: 'liberado' }, error: null }, 'entrar')).toBe('liberado');
    expect(lerSituacao({ data: { situacao: 'fora_do_horario' }, error: null }, 'entrar')).toBe('fora_do_horario');
    expect(lerSituacao({ data: null, error: null }, 'entrar')).toBe('inativo');
    expect(log).not.toHaveBeenCalled();
  });
});

describe('destinoSemAcesso (sessão aberta sem a própria linha)', () => {
  it('fora do horário vai para a página do horário', () => {
    expect(destinoSemAcesso('fora_do_horario')).toBe('/fora-do-horario');
  });
  it('arquivada ou sem cadastro: acesso desativado', () => {
    expect(destinoSemAcesso('inativo')).toBe('/entrar?erro=inativo');
    expect(destinoSemAcesso('sem_cadastro')).toBe('/entrar?erro=inativo');
  });
  it('banco fora do ar (ou liberado sem achar a linha): tente de novo, nunca "desativado"', () => {
    expect(destinoSemAcesso('indisponivel')).toBe('/entrar?erro=indisponivel');
    expect(destinoSemAcesso('liberado')).toBe('/entrar?erro=indisponivel');
  });
});
