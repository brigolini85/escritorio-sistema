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
  it('produto e preço', () => {
    expect(ProdutoForm.parse({ codigo: '12', descricao: 'Costela com Requeijão', unidade: 'pac', apelidos: 'costela' }))
      .toMatchObject({ codigo: '12', unidade: 'PAC', apelidos: ['costela'] });
    expect(PrecoForm.parse({ valor: '9,50' }).valor).toBe(9.5);
    expect(PrecoForm.safeParse({ valor: '0' }).success).toBe(false);
  });
});
