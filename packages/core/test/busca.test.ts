import { describe, expect, it } from 'vitest';
import { melhoresCandidatos, palavrasDeBusca } from '../src/busca';

const unidades = [
  { item: 'brasil-efigenia', termos: ['Supermercado Brasil', 'Santa Efigênia', 'Santa Efigênia', 'Belo Horizonte'] },
  { item: 'brasil-matilde', termos: ['Supermercado Brasil', 'Santa Matilde', 'Santa Matilde', 'Belo Horizonte'] },
  { item: 'hortsul-gutierrez', termos: ['Hortsul', 'Gutierrez', 'Gutierrez', 'Belo Horizonte'] },
  { item: 'hortsul-itabira', termos: ['Hortsul', 'Itabira', 'Centro', 'Itabira'] },
];

describe('palavrasDeBusca', () => {
  it('minúsculas, sem acento, sem pontuação e sem palavras de pedido', () => {
    expect(palavrasDeBusca('Tira NF pro Brasil, Santa Efigênia!')).toEqual(['brasil', 'santa', 'efigenia']);
  });
});

describe('melhoresCandidatos', () => {
  it('rede + bairro acha só a unidade certa', () => {
    expect(melhoresCandidatos('Brasil Santa Efigenia', unidades)).toEqual(['brasil-efigenia']);
  });
  it('só o nome da rede devolve todas as unidades dela (empate)', () => {
    expect(melhoresCandidatos('Hortsul', unidades)).toEqual(['hortsul-gutierrez', 'hortsul-itabira']);
  });
  it('palavra parecida não conta: brasa não é brasil', () => {
    expect(melhoresCandidatos('brasa', unidades)).toEqual([]);
  });
  it('palavra comum a duas redes devolve as duas', () => {
    const comCentro = [...unidades, { item: 'brasil-centro', termos: ['Supermercado Brasil', 'Centro'] }];
    expect(melhoresCandidatos('centro', comCentro)).toEqual(['hortsul-itabira', 'brasil-centro']);
  });
  it('respeita o limite', () => {
    expect(melhoresCandidatos('belo horizonte', unidades, 2)).toHaveLength(2);
  });
  it('texto vazio ou só com palavras de pedido não acha nada', () => {
    expect(melhoresCandidatos('uma nota para', unidades)).toEqual([]);
  });
});
