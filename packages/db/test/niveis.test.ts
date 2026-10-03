import { MODULOS, NIVEIS, NIVEIS_PADRAO } from '@escritorio/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';
import { criarUsuario } from './usuario';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

beforeEach(async () => { await limparBanco(); });

describe('níveis (Parte D)', () => {
  it('o catálogo do banco é o mesmo do código, na mesma ordem, com o mesmo padrão', async () => {
    const { data, error } = await db.from('permissao_niveis').select('modulo, nivel, ordem').order('modulo').order('ordem');
    expect(error).toBeNull();
    const doBanco = Object.fromEntries(MODULOS.map((m) => [m, data!.filter((l) => l.modulo === m).map((l) => l.nivel)]));
    expect(doBanco).toEqual(NIVEIS);
    for (const m of MODULOS) expect((await db.rpc('nivel_padrao', { p_modulo: m })).data).toBe(NIVEIS_PADRAO[m]);
  });

  it('o usuário do assistente pelo WhatsApp vem com os níveis', async () => {
    const id = await criarUsuario(db, 'wa@niveis.local', { papel: 'atendente', telefone: '5531944440001', permissoes: ['assistente_whatsapp'] });
    await db.from('usuario_permissoes').update({ nivel: 'minhas' }).eq('usuario_id', id).eq('modulo', 'demandas');
    const u = await repos.usuarioDoAssistente('5531944440001');
    expect(u?.id).toBe(id);
    expect(u?.niveis).toEqual({ ...NIVEIS_PADRAO, assistente: 'site_whatsapp', demandas: 'minhas' });
    await db.from('usuario_permissoes').update({ nivel: 'site' }).eq('usuario_id', id).eq('modulo', 'assistente');
    expect(await repos.usuarioDoAssistente('5531944440001')).toBeNull();
  });

  it('horário: sem restrição entra; tudo bloqueado não entra; administrador sempre', async () => {
    const ana = await criarUsuario(db, 'ana@niveis.local', { papel: 'atendente' });
    const dono = await criarUsuario(db, 'dono@niveis.local', { papel: 'admin' });
    expect(await repos.horarioPermite(ana, new Date())).toBe(true);
    const bloqueado = { semana: null, sabado: null, domingo: null };
    await db.from('usuarios').update({ horario_acesso: bloqueado }).in('id', [ana, dono]);
    expect(await repos.horarioPermite(ana, new Date())).toBe(false);
    expect(await repos.horarioPermite(dono, new Date())).toBe(true);
  });
});
