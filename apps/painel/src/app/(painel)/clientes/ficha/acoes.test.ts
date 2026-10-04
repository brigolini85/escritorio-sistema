import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  papel: 'atendente' as 'admin' | 'atendente',
  clientes: 'editar' as 'ver' | 'editar',
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  erroRpc: null as { code?: string; message: string } | null,
  arquivado: false,
  buscas: [] as string[],
  respostaCnpj: { ok: false, motivo: 'nao_encontrado' } as unknown,
  respostaCep: { ok: true, dados: { logradouro: 'Rua X', bairro: null, cidade: null, uf: 'MG' } } as unknown,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({
  obterUsuario: async () => ({ id: 'eu', papel: falso.papel, niveis: { clientes: falso.clientes }, setores: [] }),
}));
vi.mock('@/lib/permissoes', () => ({
  temNivel: (u: { papel: string; niveis: { clientes: string } }, _m: string, minimo: string) =>
    u.papel === 'admin' || minimo === 'ver' || u.niveis.clientes === 'editar',
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      falso.rpcs.push({ nome, args });
      return falso.erroRpc ? { data: null, error: falso.erroRpc } : { data: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', error: null };
    },
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: falso.arquivado ? { id: 'x' } : null }) }) }) }) }),
  }),
}));
vi.mock('@/lib/consultas-publicas', () => ({
  consultarCnpj: async (n: string) => { falso.buscas.push(n); return falso.respostaCnpj; },
  consultarCep: async (n: string) => { falso.buscas.push(n); return falso.respostaCep; },
}));

import { buscarCep, buscarCnpj, salvarFicha } from './acoes';

function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}
const BASE = { razao_social: 'Padaria Sol ME', cnpj: '12.345.678/0001-95' };

beforeEach(() => {
  Object.assign(falso, {
    papel: 'atendente', clientes: 'editar', rpcs: [], erroRpc: null, arquivado: false, buscas: [],
    respostaCnpj: { ok: false, motivo: 'nao_encontrado' },
    respostaCep: { ok: true, dados: { logradouro: 'Rua X', bairro: null, cidade: null, uf: 'MG' } },
  });
});

describe('salvarFicha', () => {
  it('grava tudo numa chamada de salvar_ficha_cliente e devolve o id', async () => {
    expect(await salvarFicha(null, form({ ...BASE, agente_pausado: 'on' }))).toEqual({ ok: true, id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    expect(falso.rpcs).toHaveLength(1);
    expect(falso.rpcs[0]!.nome).toBe('salvar_ficha_cliente');
    expect(falso.rpcs[0]!.args.p_id).toBeNull();
    expect(falso.rpcs[0]!.args.p_dados).toMatchObject({ razao_social: 'Padaria Sol ME', cnpj: '12345678000195' });
    expect(falso.rpcs[0]!.args.p_dados).not.toHaveProperty('agente_pausado');
  });

  it('administrador manda a pausa do agente', async () => {
    falso.papel = 'admin';
    await salvarFicha(null, form({ ...BASE, agente_pausado: 'on' }));
    expect(falso.rpcs[0]!.args.p_dados).toMatchObject({ agente_pausado: true });
  });

  it('"Só ver" nem chama o banco', async () => {
    falso.clientes = 'ver';
    expect(await salvarFicha(null, form(BASE))).toEqual({ ok: false, erros: { geral: 'Não foi possível salvar: você não tem permissão para editar clientes.' } });
    expect(falso.rpcs).toEqual([]);
  });

  it('erro de validação volta no campo, sem chamar o banco', async () => {
    const r = await salvarFicha(null, form({ razao_social: 'Cliente Com CNPJ Errado', cnpj: '11.222.333/0001-99' }));
    expect(r).toEqual({ ok: false, erros: { cnpj: 'CNPJ inválido', geral: 'Não foi possível salvar: CNPJ inválido. Confira o campo marcado.' } });
    expect(falso.rpcs).toEqual([]);
  });

  it('CNPJ repetido: aponta os arquivados quando é de um cliente arquivado (texto de hoje)', async () => {
    falso.erroRpc = { code: '23505', message: 'duplicate key value violates unique constraint "clientes_cnpj_key"' };
    falso.arquivado = true;
    expect(await salvarFicha(null, form(BASE))).toEqual({ ok: false, erros: {
      cnpj: 'CNPJ já cadastrado', geral: 'Não foi possível salvar: Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.' } });
    falso.arquivado = false;
    expect(await salvarFicha(null, form(BASE))).toEqual({ ok: false, erros: {
      cnpj: 'CNPJ já cadastrado', geral: 'Não foi possível salvar: Já existe cliente com este CNPJ.' } });
  });

  it('recusa conhecida do banco aparece como veio; desconhecida vira aviso fixo', async () => {
    falso.erroRpc = { message: 'UF repetida nas inscrições de substituto tributário.' };
    expect(await salvarFicha('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', form(BASE))).toEqual({ ok: false, erros: {
      geral: 'Não foi possível salvar: UF repetida nas inscrições de substituto tributário.' } });
    falso.erroRpc = { message: 'column "x" does not exist' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await salvarFicha('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', form(BASE))).toEqual({ ok: false, erros: {
      geral: 'Não foi possível salvar: não consegui gravar agora. Tente de novo.' } });
  });

  it('só recusa escrita pela função (P0001) passa para a tela; o mesmo texto vindo de outro erro do Postgres não', async () => {
    falso.erroRpc = { code: 'P0001', message: 'Cliente não encontrado.' };
    expect(await salvarFicha('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', form(BASE))).toEqual({ ok: false, erros: {
      geral: 'Não foi possível salvar: Cliente não encontrado.' } });
    falso.erroRpc = { code: '23514', message: 'Cliente não encontrado.' };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await salvarFicha('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', form(BASE))).toEqual({ ok: false, erros: {
      geral: 'Não foi possível salvar: não consegui gravar agora. Tente de novo.' } });
  });

  it('id fora do formato não chega ao banco', async () => {
    expect((await salvarFicha('1; drop', form(BASE))).ok).toBe(false);
    expect((await salvarFicha({} as never, form(BASE))).ok).toBe(false);
    expect(falso.rpcs).toEqual([]);
  });
});

describe('buscas', () => {
  it('só o número vai para a busca; CNPJ inválido nem sai', async () => {
    expect(await buscarCnpj('12.345.678/0001-95')).toEqual({ ok: false, motivo: 'nao_encontrado' });
    expect(await buscarCnpj('11.222.333/0001-99')).toEqual({ ok: false, motivo: 'invalido' });
    expect(await buscarCep('36.404-450')).toMatchObject({ ok: true });
    expect(await buscarCep('123')).toEqual({ ok: false, motivo: 'invalido' });
    expect(falso.buscas).toEqual(['12345678000195', '36404450']);
  });

  it('"Só ver" não usa a busca', async () => {
    falso.clientes = 'ver';
    expect(await buscarCnpj('12345678000195')).toEqual({ ok: false, motivo: 'sem_permissao' });
    expect(await buscarCep('36404450')).toEqual({ ok: false, motivo: 'sem_permissao' });
    expect(falso.buscas).toEqual([]);
  });

  it('argumento que não é texto (a ação é pública para o navegador) nem sai', async () => {
    expect(await buscarCnpj({ toString: () => '12345678000195' } as never)).toEqual({ ok: false, motivo: 'invalido' });
    expect(await buscarCep(36404450 as never)).toEqual({ ok: false, motivo: 'invalido' });
    expect(falso.buscas).toEqual([]);
  });

  it('o que a busca devolve é conferido antes de ir para a tela: UF de 2 letras, CEP de 8 números, textos no tamanho do campo', async () => {
    falso.respostaCnpj = { ok: true, dados: {
      razao_social: 'R'.repeat(400), nome_fantasia: 'Padaria Sol', cnae_principal: null, cep: '1234', logradouro: 'Rua A', numero: '9'.repeat(50),
      complemento: null, bairro: 'Centro', cidade: 'Lafaiete', uf: 'M1',
    } };
    const r = await buscarCnpj('12345678000195');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dados.razao_social).toHaveLength(150);
    expect(r.dados.numero).toHaveLength(20);
    expect(r.dados).toMatchObject({ nome_fantasia: 'Padaria Sol', cep: null, uf: null, bairro: 'Centro' });

    falso.respostaCep = { ok: true, dados: { logradouro: 'Rua X', bairro: 'B'.repeat(300), cidade: 'Lafaiete', uf: 'mgx' } };
    const c = await buscarCep('36404450');
    expect(c.ok && c.dados).toEqual({ logradouro: 'Rua X', bairro: 'B'.repeat(100), cidade: 'Lafaiete', uf: null });
  });
});
