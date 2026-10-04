import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { capitalizar, consultarCep, consultarCnpj, formatarCnae, LIMITE_BUSCA_MS } from './consultas-publicas';

const BRASILAPI = {
  razao_social: 'PADARIA SOL COMERCIO DE ALIMENTOS ME', nome_fantasia: 'PADARIA SOL', cnae_fiscal: 1091101,
  cnae_fiscal_descricao: 'Fabricação de produtos de panificação', cep: '36404450', descricao_tipo_de_logradouro: 'RUA',
  logradouro: 'ROSA FIGUEIREDO', numero: '430', complemento: 'LOJA 2', bairro: 'SÃO MARCOS', municipio: 'CONSELHEIRO LAFAIETE', uf: 'MG',
  capital_social: 1000, qsa: [{ nome_socio: 'NÃO VAI PARA A TELA' }],
};
const resposta = (status: number, corpo?: unknown) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status });
function falso(r: () => Response | Promise<Response>) {
  const chamadas: { url: string; init?: RequestInit }[] = [];
  const buscar = (async (url: string | URL, init?: RequestInit) => { chamadas.push({ url: String(url), init }); return r(); }) as unknown as typeof fetch;
  return { buscar, chamadas };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('busca de CNPJ (BrasilAPI pelo servidor, D15)', () => {
  it('só o número vai na chamada, com limite de tempo; volta razão social, CNAE e endereço', async () => {
    const f = falso(() => resposta(200, BRASILAPI));
    const r = await consultarCnpj('12.345.678/0001-95', f.buscar);
    expect(f.chamadas.map((c) => c.url)).toEqual(['https://brasilapi.com.br/api/cnpj/v1/12345678000195']);
    expect(f.chamadas[0]!.init?.signal).toBeInstanceOf(AbortSignal);
    expect(LIMITE_BUSCA_MS).toBe(4000);
    expect(r).toEqual({ ok: true, dados: {
      razao_social: 'PADARIA SOL COMERCIO DE ALIMENTOS ME', nome_fantasia: 'PADARIA SOL',
      cnae_principal: '1091-1/01 · Fabricação de produtos de panificação', cep: '36404450', logradouro: 'Rua Rosa Figueiredo',
      numero: '430', complemento: 'Loja 2', bairro: 'São Marcos', cidade: 'Conselheiro Lafaiete', uf: 'MG',
    } });
  });

  it('não encontrado, fora do ar e sem resposta viram motivo, nunca erro', async () => {
    expect(await consultarCnpj('12345678000195', falso(() => resposta(404, { message: 'x' })).buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await consultarCnpj('12345678000195', falso(() => resposta(500)).buscar)).toEqual({ ok: false, motivo: 'indisponivel' });
    expect(await consultarCnpj('12345678000195', falso(() => { throw new DOMException('tempo', 'TimeoutError'); }).buscar))
      .toEqual({ ok: false, motivo: 'indisponivel' });
  });

  it('número com tamanho errado nem chama', async () => {
    const f = falso(() => resposta(200, BRASILAPI));
    expect(await consultarCnpj('123', f.buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(f.chamadas).toEqual([]);
  });

  it('o endereço da busca vem do ambiente (servidor falso dos e2e, D32)', async () => {
    vi.stubEnv('CONSULTA_CNPJ_URL', 'http://127.0.0.1:3199/api/cnpj/v1');
    const f = falso(() => resposta(404));
    await consultarCnpj('12345678000195', f.buscar);
    expect(f.chamadas[0]!.url).toBe('http://127.0.0.1:3199/api/cnpj/v1/12345678000195');
  });
});

describe('busca de CEP (ViaCEP pelo servidor)', () => {
  it('só o número; volta logradouro, bairro, cidade e UF', async () => {
    const f = falso(() => resposta(200, { cep: '36404-450', logradouro: 'Rua Rosa Figueiredo', bairro: 'São Marcos', localidade: 'Conselheiro Lafaiete', uf: 'MG' }));
    expect(await consultarCep('36.404-450', f.buscar)).toEqual({ ok: true, dados: { logradouro: 'Rua Rosa Figueiredo', bairro: 'São Marcos', cidade: 'Conselheiro Lafaiete', uf: 'MG' } });
    expect(f.chamadas[0]!.url).toBe('https://viacep.com.br/ws/36404450/json/');
  });

  it('CEP que não existe e serviço fora do ar', async () => {
    expect(await consultarCep('99999999', falso(() => resposta(200, { erro: 'true' })).buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await consultarCep('99999999', falso(() => resposta(200, { erro: true })).buscar)).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await consultarCep('99999999', falso(() => resposta(502)).buscar)).toEqual({ ok: false, motivo: 'indisponivel' });
  });
});

describe('formatação', () => {
  it('CNAE com máscara e descrição', () => {
    expect(formatarCnae(1091101, 'Fabricação de produtos de panificação')).toBe('1091-1/01 · Fabricação de produtos de panificação');
    expect(formatarCnae('4711302', null)).toBe('4711-3/02');
    expect(formatarCnae(null, 'x')).toBeNull();
  });
  it('maiúsculas da Receita viram nome próprio', () => {
    expect(capitalizar('RUA DAS FLORES DE MAIO')).toBe('Rua das Flores de Maio');
    expect(capitalizar('  ')).toBeNull();
  });
});
