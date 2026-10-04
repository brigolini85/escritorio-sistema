import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { FILAS } from '../src/fila';
import { demandasDeCertificado } from '../src/tarefas';
import { db, repos } from './apoio/cenario';

// Parte H1 (spec 7D.1 item 7, D21): certificado perto de vencer vira demanda no Fiscal, uma por vencimento.
const DIA_10 = new Date('2030-01-10T10:00:00Z'); // 07:00 em São Paulo
const deps = (agora: Date) => ({ repos, relogio: () => agora });

beforeEach(async () => {
  await limparBanco();
});

describe('demanda automática do certificado', () => {
  it('tem fila própria', () => {
    expect(FILAS.certificados).toBe('certificados-vencendo');
  });

  it('cria uma demanda no Fiscal por vencimento e não repete', async () => {
    const { data: c, error } = await db.from('clientes').insert({
      razao_social: 'Certificado Ltda', cnpj: '11222333000181', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-01-20',
    }).select('id').single();
    expect(error).toBeNull();
    expect(await demandasDeCertificado(deps(DIA_10))).toBe(1);
    expect(await demandasDeCertificado(deps(DIA_10))).toBe(0);
    const { data: demandas } = await db.from('chamados').select('titulo, origem, setores(nome)').eq('cliente_id', c!.id);
    expect(demandas).toEqual([{ titulo: 'Certificado digital vence em 20/01/2030', origem: 'sistema', setores: { nome: 'Fiscal' } }]);
  });

  it('conta o dia de São Paulo, não o de Greenwich', async () => {
    await db.from('clientes').insert({
      razao_social: 'Fuso Ltda', cnpj: '11444777000161', certificado_tipo: 'e_cnpj_a1', certificado_vencimento: '2030-01-20',
    });
    // 21/12 02:30 UTC = 20/12 23:30 em São Paulo: faltam 31 dias, ainda fora do aviso de 30.
    expect(await demandasDeCertificado(deps(new Date('2029-12-21T02:30:00Z')))).toBe(0);
    expect(await demandasDeCertificado(deps(new Date('2029-12-21T03:30:00Z')))).toBe(1);
  });
});
