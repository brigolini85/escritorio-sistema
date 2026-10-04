import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  clientes: 'editar' as 'ver' | 'editar',
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  guardada: null as string | null,
  erroRpc: null as { code?: string; message: string } | null,
  revelado: undefined as unknown,
  revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'eu', papel: 'atendente', niveis: { clientes: falso.clientes }, setores: [] }) }));
vi.mock('@/lib/permissoes', () => ({ temNivel: (u: { niveis: { clientes: string } }) => u.niveis.clientes === 'editar' }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      falso.rpcs.push({ nome, args });
      if (falso.erroRpc) return { data: null, error: falso.erroRpc };
      if (nome === 'salvar_acesso') { falso.guardada = args.p_senha_cifrada as string; return { data: ACESSO, error: null }; }
      if (nome === 'revelar_acesso') {
        return { data: falso.revelado !== undefined ? falso.revelado : { cliente_id: CLIENTE, senha_cifrada: falso.guardada }, error: null };
      }
      return { data: null, error: null };
    },
  }),
}));

import { FORMATO_CIFRADO } from '@/lib/cofre';
import { copiarAcesso, removerAcesso, revelarAcesso, salvarAcesso } from './acessos-acoes';
import { SEM_CHAVE, SEM_PERMISSAO_MUDAR, SEM_PERMISSAO_VER } from './acessos-textos';

const CLIENTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ACESSO = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const SENHA = 'Portal#Segredo-2026';
function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.stubEnv('ACESSOS_PORTAIS_CHAVE', randomBytes(32).toString('base64'));
  Object.assign(falso, { clientes: 'editar', rpcs: [], guardada: null, erroRpc: null, revelado: undefined, revalidados: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('acessos de portais (D1, D5, D6)', () => {
  it('a senha sai daqui só cifrada; revelar devolve a senha', async () => {
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', usuario: 'padariasol', senha: SENHA }))).toEqual({ ok: true });
    const args = falso.rpcs[0]!.args;
    expect(args).toMatchObject({ p_id: null, p_cliente: CLIENTE, p_portal: 'SEFAZ-MG', p_usuario: 'padariasol' });
    expect(args.p_senha_cifrada).toMatch(FORMATO_CIFRADO);
    expect(JSON.stringify(falso.rpcs)).not.toContain('Segredo');
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: true, senha: SENHA });
    expect(await copiarAcesso(ACESSO)).toEqual({ ok: true, senha: SENHA });
    expect(falso.rpcs.slice(1).map((r) => r.args)).toEqual([{ p_id: ACESSO, p_acao: 'revelar' }, { p_id: ACESSO, p_acao: 'copiar' }]);
  });

  it('editar sem senha manda nulo (mantém); "Sem senha" manda vazio', async () => {
    await salvarAcesso(CLIENTE, ACESSO, form({ portal: 'SEFAZ-MG', usuario: 'novo', senha: '' }));
    await salvarAcesso(CLIENTE, ACESSO, form({ portal: 'e-CAC', usuario: 'via certificado', senha: 'ignorada', sem_senha: 'on' }));
    expect(falso.rpcs.map((r) => r.args.p_senha_cifrada)).toEqual([null, '']);
  });

  it('novo acesso sem senha e sem "Sem senha" pede a senha; portal vazio recusa', async () => {
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG' }))).toEqual({ ok: false, erros: { senha: 'Informe a senha ou marque "Sem senha".' } });
    expect(await salvarAcesso(CLIENTE, null, form({ portal: ' ', senha: 'x' }))).toEqual({ ok: false, erros: { portal: 'Informe o portal (até 80 letras).' } });
    expect(falso.rpcs).toEqual([]);
  });

  it('sem a chave no ambiente: nada sai e o aviso explica (D8)', async () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }))).toEqual({ ok: false, erros: { geral: SEM_CHAVE } });
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: SEM_CHAVE });
    expect(falso.rpcs).toEqual([]);
  });

  it('"Só ver" não cadastra nem remove (o banco confere de novo)', async () => {
    falso.clientes = 'ver';
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }))).toEqual({ ok: false, erros: { geral: SEM_PERMISSAO_MUDAR } });
    expect(await removerAcesso(CLIENTE, ACESSO)).toEqual({ ok: false, erro: SEM_PERMISSAO_MUDAR });
    expect(falso.rpcs).toEqual([]);
  });

  it('sem "Ver acessos de portais" o banco recusa e a tela diz por quê', async () => {
    falso.erroRpc = { message: 'Sem permissão para ver acessos de portais.' };
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: SEM_PERMISSAO_VER });
  });

  it('cifra que não abre (chave trocada) vira aviso, sem detalhe', async () => {
    await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }));
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', randomBytes(32).toString('base64'));
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: 'Não consegui abrir esta senha. Cadastre de novo.' });
  });

  it('o arquivo das ações não escreve no console (a senha nunca vai para log)', () => {
    const fonte = readFileSync(fileURLToPath(new URL('./acessos-acoes.ts', import.meta.url)), 'utf8');
    expect(fonte).not.toMatch(/console\./);
  });
});

describe('acessos de portais: o que mais não pode escapar', () => {
  it('sem a chave, também "Sem senha" e a edição ficam desligados (D8); remover continua', async () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'e-CAC', sem_senha: 'on' }))).toEqual({ ok: false, erros: { geral: SEM_CHAVE } });
    expect(await salvarAcesso(CLIENTE, ACESSO, form({ portal: 'SEFAZ-MG', senha: '' }))).toEqual({ ok: false, erros: { geral: SEM_CHAVE } });
    expect(await copiarAcesso(ACESSO)).toEqual({ ok: false, erro: SEM_CHAVE });
    expect(falso.rpcs).toEqual([]);
    expect(await removerAcesso(CLIENTE, ACESSO)).toEqual({ ok: true });
    expect(falso.rpcs.map((r) => r.nome)).toEqual(['remover_acesso']);
  });

  it('só recusa P0001 conhecida chega à tela; o resto vira aviso fixo, nunca a mensagem do banco', async () => {
    falso.erroRpc = { code: 'P0001', message: 'Sem permissão para mudar acessos de portais.' };
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }))).toEqual({ ok: false, erros: { geral: SEM_PERMISSAO_MUDAR } });
    expect(await removerAcesso(CLIENTE, ACESSO)).toEqual({ ok: false, erro: SEM_PERMISSAO_MUDAR });
    falso.erroRpc = { code: '23514', message: 'new row for relation "cliente_acessos" violates check constraint; Failing row contains (v1.xyz)' };
    expect(await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }))).toEqual({ ok: false, erros: { geral: 'Não consegui salvar agora. Tente de novo.' } });
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: 'Não consegui abrir a senha agora. Tente de novo.' });
    falso.erroRpc = { code: '42501', message: 'Sem permissão para ver acessos de portais.' };
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: 'Não consegui abrir a senha agora. Tente de novo.' });
  });

  it('resposta estranha do banco não quebra nem vaza', async () => {
    falso.revelado = null;
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: 'Não consegui abrir esta senha. Cadastre de novo.' });
    falso.revelado = { cliente_id: CLIENTE, senha_cifrada: 'texto-puro' };
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: 'Não consegui abrir esta senha. Cadastre de novo.' });
  });

  it('a cifra de uma empresa não abre como se fosse de outra (contexto do cliente_id que o banco devolve)', async () => {
    await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }));
    falso.revelado = { cliente_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', senha_cifrada: falso.guardada };
    expect(await revelarAcesso(ACESSO)).toEqual({ ok: false, erro: 'Não consegui abrir esta senha. Cadastre de novo.' });
  });

  it('argumentos fora do formato (a ação é chamável pelo navegador) não chegam ao banco', async () => {
    expect((await salvarAcesso('x', null, form({ portal: 'SEFAZ-MG', senha: SENHA }))).ok).toBe(false);
    expect((await salvarAcesso(CLIENTE, 7 as never, form({ portal: 'SEFAZ-MG', senha: SENHA }))).ok).toBe(false);
    expect((await salvarAcesso(CLIENTE, null, { get: () => 'x' } as never)).ok).toBe(false);
    expect((await removerAcesso(CLIENTE, '1; drop')).ok).toBe(false);
    expect((await revelarAcesso({} as never)).ok).toBe(false);
    expect(falso.rpcs).toEqual([]);
  });

  it('tamanhos: usuário até 120, senha até 200 (a mensagem nunca repete a senha)', async () => {
    const longa = `Segredo${'x'.repeat(200)}`;
    const r = await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', usuario: 'u'.repeat(121), senha: longa }));
    expect(r).toEqual({ ok: false, erros: { usuario: 'Usuário com até 120 letras.', senha: 'Senha com até 200 letras.' } });
    expect(JSON.stringify(r)).not.toContain('Segredo');
    expect(falso.rpcs).toEqual([]);
  });

  it('revelar e copiar não refazem a página (a senha volta só nesta resposta)', async () => {
    await salvarAcesso(CLIENTE, null, form({ portal: 'SEFAZ-MG', senha: SENHA }));
    falso.revalidados = [];
    await revelarAcesso(ACESSO);
    await copiarAcesso(ACESSO);
    expect(falso.revalidados).toEqual([]);
  });
});
