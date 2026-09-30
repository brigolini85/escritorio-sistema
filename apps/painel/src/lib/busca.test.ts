import { describe, expect, it } from 'vitest';
import { interpretarBusca, itemContato, itemDemanda, itemEmpresa, linkContato, linkDemanda, linkEmpresa, termoSeguroPostgrest } from './busca';

describe('interpretarBusca', () => {
  it('precisa de pelo menos 2 caracteres', () => {
    expect(interpretarBusca('')).toBeNull();
    expect(interpretarBusca(' a ')).toBeNull();
    expect(interpretarBusca(null)).toBeNull();
    expect(interpretarBusca('ab')).toEqual({ termo: 'ab', digitos: '', numero: null });
  });
  it('"#123" e "123" viram número de demanda', () => {
    expect(interpretarBusca('#123')).toEqual({ termo: '123', digitos: '123', numero: 123 });
    expect(interpretarBusca('# 45')).toMatchObject({ numero: 45 });
    expect(interpretarBusca('42')).toMatchObject({ numero: 42 });
    expect(interpretarBusca('#5')).toMatchObject({ numero: 5, termo: '5' });
  });
  it('texto com números não é número de demanda', () => {
    expect(interpretarBusca('nota 12')).toMatchObject({ numero: null, digitos: '12' });
    expect(interpretarBusca('11.222.333/0001-81')).toMatchObject({ numero: null, digitos: '11222333000181' });
  });
  it('corta textos longos em 80 caracteres', () => {
    expect(interpretarBusca('a'.repeat(5000))?.termo).toHaveLength(80);
  });
  it('tira os caracteres que quebram o filtro do PostgREST', () => {
    expect(interpretarBusca('pão, (queijo)* 100% "x"\\')?.termo).toBe('pão queijo 100 x');
    expect(interpretarBusca('(),')).toBeNull();
  });
});

describe('links', () => {
  it('empresa abre a ficha, contato filtra a lista, demanda abre a conversa ou a lista', () => {
    expect(linkEmpresa('e1')).toBe('/clientes/e1');
    expect(linkContato('5531999990201')).toBe('/contatos?q=5531999990201');
    expect(linkDemanda({ conversa_id: 'c1' })).toBe('/atendimento/c1');
    expect(linkDemanda({ conversa_id: null })).toBe('/demandas');
  });
});

describe('itens', () => {
  it('formata CNPJ com a máscara de formatos.ts (mascararCNPJ)', () => {
    expect(itemEmpresa({ id: 'e', razao_social: 'X', nome_fantasia: null, cnpj: '11222333000181' }).detalhe).toBe('CNPJ 11.222.333/0001-81');
    expect(itemEmpresa({ id: 'e', razao_social: 'X', nome_fantasia: null, cnpj: '123' }).detalhe).toBe('CNPJ 123');
  });
  it('empresa mostra nome fantasia, razão social e CNPJ', () => {
    expect(itemEmpresa({ id: 'e1', razao_social: 'Mercado Teste Ltda', nome_fantasia: 'Mercado Teste', cnpj: '11222333000181' }))
      .toEqual({ id: 'e1', titulo: 'Mercado Teste', detalhe: 'Mercado Teste Ltda · CNPJ 11.222.333/0001-81', href: '/clientes/e1' });
    expect(itemEmpresa({ id: 'e2', razao_social: 'Só Razão', nome_fantasia: null, cnpj: '11222333000181' }).detalhe)
      .toBe('CNPJ 11.222.333/0001-81');
  });
  it('contato e demanda', () => {
    expect(itemContato({ id: 'c1', nome: 'João', telefone: '5531999990201' }))
      .toEqual({ id: 'c1', titulo: 'João', detalhe: '5531999990201', href: '/contatos?q=5531999990201' });
    expect(itemDemanda({ id: 'd1', numero: 7, titulo: 'Guia do DAS', status: 'em_andamento', conversa_id: 'cv', clientes: { razao_social: 'X Ltda', nome_fantasia: null } }))
      .toEqual({ id: 'd1', titulo: '#7 Guia do DAS', detalhe: 'X Ltda · Em andamento', href: '/atendimento/cv' });
    expect(itemDemanda({ id: 'd2', numero: 8, titulo: 'Sem conversa', status: 'aberto', conversa_id: null, clientes: null }))
      .toMatchObject({ detalhe: 'Aberta', href: '/demandas' });
  });
});

describe('termoSeguroPostgrest', () => {
  it('tira o que tem significado no filtro or/ilike, inclusive aspas', () => {
    expect(termoSeguroPostgrest('Mercado "Bom" (Centro), 50%*\\')).toBe('Mercado Bom Centro 50');
  });
  it('vazio, nulo e só símbolos viram texto vazio', () => {
    expect(termoSeguroPostgrest(undefined)).toBe('');
    expect(termoSeguroPostgrest(null)).toBe('');
    expect(termoSeguroPostgrest(' "(),* ')).toBe('');
  });
  it('mantém uma letra só (as listas de clientes e contatos aceitam) e corta textos enormes', () => {
    expect(termoSeguroPostgrest('a')).toBe('a');
    expect(termoSeguroPostgrest('b'.repeat(500))).toHaveLength(80);
  });
});
