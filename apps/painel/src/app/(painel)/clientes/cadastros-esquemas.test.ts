import { describe, expect, it } from 'vitest';
import { GrupoForm, PrecoForm, ProdutoForm, UnidadeForm, listaDeTexto } from './cadastros-esquemas';

describe('listaDeTexto', () => {
  it('separa por vírgula, tira espaços e vazios', () => {
    expect(listaDeTexto(' brasil, loja sete ,, ')).toEqual(['brasil', 'loja sete']);
    expect(listaDeTexto(null)).toEqual([]);
  });
});

describe('esquemas', () => {
  it('rede com palavras-chave', () => {
    expect(GrupoForm.parse({ nome: ' Supermercado Brasil ', palavras_chave: 'brasil, sb', ativo: 'on' }))
      .toEqual({ nome: 'Supermercado Brasil', palavras_chave: ['brasil', 'sb'], ativo: true });
  });
  it('unidade: CNPJ opcional, mas válido se informado; UF em maiúsculas', () => {
    expect(UnidadeForm.parse({ nome_unidade: 'Santa Efigênia', cnpj: '11.222.333/0001-81', uf: 'mg', palavras_chave: 'efigenia' }))
      .toMatchObject({ nome_unidade: 'Santa Efigênia', cnpj: '11222333000181', uf: 'MG', palavras_chave: ['efigenia'], ativo: false });
    expect(UnidadeForm.parse({ nome_unidade: 'Matriz', cnpj: '' }).cnpj).toBeNull();
    expect(UnidadeForm.safeParse({ nome_unidade: 'X', cnpj: '11222333000182' }).success).toBe(false);
  });
  it('unidade: número, complemento, CEP e telefone para o arquivo do Bling (pedido do dono, 2026-09-29)', () => {
    expect(UnidadeForm.parse({ nome_unidade: 'Matriz', numero: ' 111 ', complemento: '', cep: '35.900-000', telefone: '(31) 99999-0000' }))
      .toMatchObject({ numero: '111', complemento: null, cep: '35900000', telefone: '(31) 99999-0000' });
    expect(UnidadeForm.parse({ nome_unidade: 'Matriz', cep: '' }).cep).toBeNull();
    expect(UnidadeForm.safeParse({ nome_unidade: 'Matriz', cep: '3590' }).success).toBe(false);
  });
  it('produto e preço', () => {
    expect(ProdutoForm.parse({ codigo: '12', descricao: 'Costela com Requeijão', unidade: 'pac', apelidos: 'costela' }))
      .toMatchObject({ codigo: '12', unidade: 'PAC', apelidos: ['costela'] });
    expect(PrecoForm.parse({ valor: '9,50' }).valor).toBe(9.5);
    expect(PrecoForm.safeParse({ valor: '0' }).success).toBe(false);
  });
});

describe('revisão final: preço digitado com ponto', () => {
  it('ponto decimal não multiplica o preço; ponto de milhar só com vírgula', () => {
    expect(PrecoForm.parse({ valor: '9.50' }).valor).toBe(9.5);
    expect(PrecoForm.parse({ valor: '9.5' }).valor).toBe(9.5);
    expect(PrecoForm.parse({ valor: '9,50' }).valor).toBe(9.5);
    expect(PrecoForm.parse({ valor: '1.234,56' }).valor).toBe(1234.56);
    expect(PrecoForm.parse({ valor: '1234.5' }).valor).toBe(1234.5);
  });
});
