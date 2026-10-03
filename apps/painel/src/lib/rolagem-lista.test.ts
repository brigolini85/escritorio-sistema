import { describe, expect, it } from 'vitest';
import { decidirRolagem, estaNoFim, JANELA_ENVIO_MS, PERTO_DO_FIM } from './rolagem-lista';

const longe = JANELA_ENVIO_MS + 1;

describe('decidirRolagem', () => {
  it('primeira exibição vai para o fim', () => {
    expect(decidirRolagem({ anterior: null, ultima: 'a-false', noFim: false, desdeEnvioMs: longe })).toBe('inicio');
  });
  it('nada novo: mantém o fim só de quem está no fim', () => {
    expect(decidirRolagem({ anterior: 'a-false', ultima: 'a-false', noFim: true, desdeEnvioMs: longe })).toBe('manter-fim');
    expect(decidirRolagem({ anterior: 'a-false', ultima: 'a-false', noFim: false, desdeEnvioMs: longe })).toBe('nada');
  });
  it('algo novo: desce no fim ou logo depois de perguntar; senão avisa', () => {
    expect(decidirRolagem({ anterior: 'a-true', ultima: 'b-false', noFim: true, desdeEnvioMs: longe })).toBe('descer');
    expect(decidirRolagem({ anterior: 'a-false', ultima: 'a-true', noFim: false, desdeEnvioMs: 2000 })).toBe('descer');
    expect(decidirRolagem({ anterior: 'a-true', ultima: 'b-false', noFim: false, desdeEnvioMs: longe })).toBe('avisar');
  });
});

describe('estaNoFim', () => {
  it('conta como fim até PERTO_DO_FIM px antes do fim', () => {
    expect(estaNoFim({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 })).toBe(true);
    expect(estaNoFim({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - PERTO_DO_FIM + 1 })).toBe(true);
    expect(estaNoFim({ scrollHeight: 1000, clientHeight: 400, scrollTop: 600 - PERTO_DO_FIM })).toBe(false);
  });
  it('lista menor que a área visível está sempre no fim', () => {
    expect(estaNoFim({ scrollHeight: 300, clientHeight: 400, scrollTop: 0 })).toBe(true);
  });
});

describe('decidirRolagem por identidade', () => {
  it('troca da última mensagem com a mesma quantidade ainda é novidade', () => {
    expect(decidirRolagem({ anterior: 'm1', ultima: 'm2', noFim: false, desdeEnvioMs: longe })).toBe('avisar');
  });
});

describe('decidirRolagem com alvo inicial', () => {
  it('com alvo inicial, não desce ao fim na abertura', () => {
    expect(decidirRolagem({ anterior: null, ultima: 'a', noFim: true, desdeEnvioMs: longe, alvoInicial: true })).toBe('alvo');
    expect(decidirRolagem({ anterior: null, ultima: 'a', noFim: true, desdeEnvioMs: longe, alvoInicial: false })).toBe('inicio');
  });
  it('depois da abertura, o alvo não muda nada: mensagem nova segue a regra de sempre', () => {
    expect(decidirRolagem({ anterior: 'a', ultima: 'b', noFim: false, desdeEnvioMs: longe, alvoInicial: true })).toBe('avisar');
    expect(decidirRolagem({ anterior: 'a', ultima: 'b', noFim: true, desdeEnvioMs: longe, alvoInicial: true })).toBe('descer');
  });
});
