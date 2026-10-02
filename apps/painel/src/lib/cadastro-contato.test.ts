// apps/painel/src/lib/cadastro-contato.test.ts
import { describe, expect, it, vi } from 'vitest';
import { comAvisoNaUrl, enderecoSemAviso, textoDoAviso } from './avisos';

vi.mock('server-only', () => ({}));
import { avisoDoCadastro, cadastrarContatoPeloTelefone, lerManter } from './cadastro-contato';

// Revisão final da Parte B: contato arquivado que volta pelo cadastro perde os vínculos antigos, e a tela avisa.
const ID = '22222222-2222-4222-8222-222222222222';
const EMPRESA = '33333333-3333-4333-8333-333333333333';
const OUTRA = '44444444-4444-4444-8444-444444444444';
const sbFalso = (data: unknown, error: { message: string } | null = null) => ({ rpc: vi.fn(async () => ({ data, error })) });

describe('aviso do cadastro de contato', () => {
  it('contato que já estava ativo (ou novo) não gera aviso', () => {
    expect(avisoDoCadastro({ reativado: false, vinculos_removidos: 0, vinculos_mantidos: 0 }, true)).toBeNull();
  });
  it('arquivado que volta: o aviso diz o que aconteceu com os vínculos', () => {
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 0, vinculos_mantidos: 0 }, false)).toBe('contato-voltou');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 2, vinculos_mantidos: 0 }, true)).toBe('contato-voltou-vinculos-sairam');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 1, vinculos_mantidos: 0 }, false)).toBe('contato-voltou-sem-empresas');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 0, vinculos_mantidos: 1 }, true)).toBe('contato-voltou-com-empresas');
    expect(avisoDoCadastro({ reativado: true, vinculos_removidos: 1, vinculos_mantidos: 1 }, false)).toBe('contato-voltou-com-empresas-outras-sairam');
  });
  it('textos curtos e afirmativos; código desconhecido não vira texto', () => {
    expect(textoDoAviso('contato-voltou-vinculos-sairam')).toBe('Contato arquivado voltou. Os vínculos antigos com outras empresas saíram.');
    expect(textoDoAviso('contato-voltou-sem-empresas')).toBe('Contato arquivado voltou, sem empresas. Os vínculos antigos saíram.');
    expect(textoDoAviso('contato-voltou')).toBe('Contato arquivado voltou.');
    expect(textoDoAviso('contato-voltou-com-empresas')).toBe('Contato arquivado voltou com as empresas escolhidas.');
    expect(textoDoAviso('contato-voltou-com-empresas-outras-sairam')).toBe('Contato arquivado voltou com as empresas escolhidas. As outras saíram.');
    expect(textoDoAviso('Ligue para 0800')).toBeNull();
  });
  it('o aviso vai na URL e sai dela sem mexer nos outros parâmetros', () => {
    expect(comAvisoNaUrl('/contatos', 'contato-voltou')).toBe('/contatos?aviso=contato-voltou');
    expect(comAvisoNaUrl(`/clientes/${ID}?aba=contatos`, 'contato-voltou')).toBe(`/clientes/${ID}?aba=contatos&aviso=contato-voltou`);
    expect(enderecoSemAviso(`/clientes/${ID}`, 'aba=contatos&aviso=contato-voltou')).toBe(`/clientes/${ID}?aba=contatos`);
    expect(enderecoSemAviso('/contatos', 'aviso=contato-voltou')).toBe('/contatos');
  });
});

describe('cadastrarContatoPeloTelefone', () => {
  it('chama a função do banco com a empresa da ação e as empresas de antes escolhidas', async () => {
    const sb = sbFalso({ id: ID, reativado: true, vinculos_removidos: 1, vinculos_mantidos: 1 });
    expect(await cadastrarContatoPeloTelefone(sb as never, { nome: 'Zé', telefone: '5531999991702', clienteId: EMPRESA, manter: [OUTRA] }))
      .toEqual({ id: ID, aviso: 'contato-voltou-com-empresas-outras-sairam' });
    expect(sb.rpc).toHaveBeenCalledWith('cadastrar_contato', {
      p_nome: 'Zé', p_telefone: '5531999991702', p_cliente: EMPRESA, p_agente_pausado: undefined, p_manter: [OUTRA],
    });
  });
  it('sem empresa, sem escolhas e com o agente desligado', async () => {
    const sb = sbFalso({ id: ID, reativado: false, vinculos_removidos: 0, vinculos_mantidos: 0 });
    expect(await cadastrarContatoPeloTelefone(sb as never, { nome: 'Zé', telefone: '5531999991702', agentePausado: true }))
      .toEqual({ id: ID, aviso: null });
    expect(sb.rpc).toHaveBeenCalledWith('cadastrar_contato', {
      p_nome: 'Zé', p_telefone: '5531999991702', p_cliente: undefined, p_agente_pausado: true, p_manter: undefined,
    });
  });
  it('erro do banco aparece para a pessoa', async () => {
    await expect(cadastrarContatoPeloTelefone(sbFalso(null, { message: 'Os dados deste contato foram apagados (LGPD). Ele não volta.' }) as never,
      { nome: 'Zé', telefone: '5531999991702' })).rejects.toThrow('Os dados deste contato foram apagados (LGPD). Ele não volta.');
  });
});

describe('lerManter', () => {
  it('só ids válidos, sem repetir', () => {
    const f = new FormData();
    f.append('manter', OUTRA);
    f.append('manter', OUTRA);
    f.append('manter', 'drop table');
    expect(lerManter(f)).toEqual([OUTRA]);
    expect(lerManter(new FormData())).toEqual([]);
  });
});
