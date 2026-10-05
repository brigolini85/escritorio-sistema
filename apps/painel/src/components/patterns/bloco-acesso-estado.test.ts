import { describe, expect, it } from 'vitest';
import { marcasBasicas, marcasDoPerfil, setoresDisponiveis } from '@escritorio/core';
import { perfilDoBloco, previaDoBloco, reduzirBloco } from './bloco-acesso-estado';

// Parte H2 (D3, D30): escolher perfil marca as opções; mudar uma marcação recalcula o perfil.
const D = setoresDisponiveis([
  { id: 'fis', nome: 'Fiscal', descricao_assuntos: '' }, { id: 'pes', nome: 'Pessoal', descricao_assuntos: '' }, { id: 'fin', nome: 'Financeiro', descricao_assuntos: '' },
], ['fis', 'pes'], []).setores;
const inicio = { marcas: marcasBasicas() };

describe('reduzirBloco', () => {
  it('escolher Compras/Vendas marca o Fiscal com "procurado"', () => {
    const e = reduzirBloco(inicio, { tipo: 'perfil', perfil: 'compras_vendas' }, D);
    expect(e.marcas.setores).toEqual([{ setorId: 'fis', podeSerProcurado: true }]);
    expect(perfilDoBloco(e, D)).toBe('compras_vendas');
  });
  it('marcar o Pessoal vira Personalizado; desmarcar volta', () => {
    const compras = reduzirBloco(inicio, { tipo: 'perfil', perfil: 'compras_vendas' }, D);
    const com = reduzirBloco(compras, { tipo: 'setor', setorId: 'pes', marcado: true }, D);
    expect(perfilDoBloco(com, D)).toBe('personalizado');
    expect(perfilDoBloco(reduzirBloco(com, { tipo: 'setor', setorId: 'pes', marcado: false }, D), D)).toBe('compras_vendas');
  });
  it('desmarcar um setor tira o "procurado" dele (D30)', () => {
    const compras = reduzirBloco(inicio, { tipo: 'perfil', perfil: 'compras_vendas' }, D);
    const sem = reduzirBloco(compras, { tipo: 'setor', setorId: 'fis', marcado: false }, D);
    const de_novo = reduzirBloco(sem, { tipo: 'setor', setorId: 'fis', marcado: true }, D);
    expect(de_novo.marcas.setores).toEqual([{ setorId: 'fis', podeSerProcurado: false }]);
  });
  it('"Personalizado" no seletor não muda nada', () => {
    const compras = reduzirBloco(inicio, { tipo: 'perfil', perfil: 'compras_vendas' }, D);
    expect(reduzirBloco(compras, { tipo: 'perfil', perfil: 'personalizado' }, D)).toEqual(compras);
  });
  it('avisar documento novo: ligar começa pelo WhatsApp; os canais mudam um por um', () => {
    const lig = reduzirBloco(inicio, { tipo: 'avisar', ligado: true }, D);
    expect(lig.marcas.avisarDocumentoNovo).toEqual(['whatsapp']);
    expect(reduzirBloco(lig, { tipo: 'canal', canal: 'email', marcado: true }, D).marcas.avisarDocumentoNovo).toEqual(['whatsapp', 'email']);
    expect(reduzirBloco(lig, { tipo: 'avisar', ligado: false }, D).marcas.avisarDocumentoNovo).toEqual([]);
  });
  it('as chaves simples', () => {
    const e = reduzirBloco(inicio, { tipo: 'chave', campo: 'verValores', valor: true }, D);
    expect(e.marcas.verValores).toBe(true);
  });
});

// Revisão das Tasks 3–4: quem recebe documentos sem "Ver valores" não recebe boleto nem folha; a prévia diz isso.
describe('previaDoBloco', () => {
  it('documentos sem "Ver valores" → "(sem valores)"', () => {
    expect(previaDoBloco(marcasDoPerfil('compras_vendas', D), D, ['Roberto']).pode)
      .toBe('Abre e consulta demandas do Fiscal, pede nota, ajusta preços e produtos, envia documentos do Fiscal (sem valores).');
  });
  it('com "Ver valores" ou sem documentos, a frase do core fica como está', () => {
    expect(previaDoBloco(marcasDoPerfil('rh_dp', D), D, []).pode).toBe('Abre e consulta demandas do Pessoal, envia documentos do Pessoal, vê valores.');
    expect(previaDoBloco(marcasDoPerfil('funcionario', D), D, []).pode).toBe('Abre e consulta demandas do Fiscal, pede nota.');
    expect(previaDoBloco(marcasBasicas(), D, []).pode).toBe('Conversa e abre demandas para a equipe.');
  });
  it('documentos da empresa sem setor também', () => {
    const m = { ...marcasBasicas(), receberDocumentos: true };
    expect(previaDoBloco(m, D, []).pode).toBe('Conversa e abre demandas para a equipe, envia os documentos da empresa (sem valores).');
  });
});

// Entrega H2 (captura): contato com o número como nome mostrava "O que o agente vai fazer com (11)".
describe('nomeDaPrevia', () => {
  it('primeiro nome; número inteiro quando o nome é o número', async () => {
    const { nomeDaPrevia } = await import('./bloco-acesso-estado');
    expect(nomeDaPrevia('Carla Mendes')).toBe('Carla');
    expect(nomeDaPrevia('(11) 95555-7788')).toBe('(11) 95555-7788');
  });
});
