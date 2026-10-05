import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTE_ATENDIMENTO_ID, FERRAMENTAS_ATENDIMENTO } from '@escritorio/core';
import { criarClienteServico, criarRepos } from '../src';
import { criarSkillTeste as skill, limparBanco, marcarDonoTeste } from './limpar';
import { criarUsuario } from './usuario';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const idDo = async (slug: string) => (await db.from('agentes').select('id').eq('slug', slug).single()).data!.id;

// `skill` (criarSkillTeste) grava direto no banco: o dono sobe pela tela; aqui só o resultado.
// service_role não escreve nas tabelas de skill, por isso o helper usa a conexão do postgres.

beforeEach(limparBanco);

describe('catálogo (D15)', () => {
  it('o banco e o core têm as mesmas 16 ferramentas, na mesma ordem', async () => {
    const { data } = await db.rpc('ferramentas_do_catalogo');
    expect(data).toEqual(FERRAMENTAS_ATENDIMENTO);
  });
});

describe('perfilDoAgente', () => {
  it('o Thiago: id fixo, as 16 ferramentas, modelo do padrão, sem skills', async () => {
    const p = await repos.perfilDoAgente('atendimento');
    expect(p).toMatchObject({ id: AGENTE_ATENDIMENTO_ID, slug: 'atendimento', nome: 'Thiago', modelo: null, skills: [], skillEmTeste: null });
    expect([...p!.ferramentas].sort()).toEqual([...FERRAMENTAS_ATENDIMENTO].sort());
  });
  it('só as skills ligadas do próprio agente; a em teste entra marcada como desligada', async () => {
    await skill('atendimento', 'limite-ligado', 'limites', true);
    const desligada = await skill('atendimento', 'cfop-desligada', 'conhecimento', false);
    const doFiscal = await skill('fiscal', 'jeito-do-fiscal', 'jeito', true);
    expect((await repos.perfilDoAgente('atendimento'))!.skills.map((s) => s.nome)).toEqual(['limite-ligado']);
    const comTeste = await repos.perfilDoAgente('atendimento', desligada);
    expect(comTeste!.skills.map((s) => [s.nome, s.ativa])).toEqual([['limite-ligado', true], ['cfop-desligada', false]]);
    expect(comTeste!.skillEmTeste).toBe(desligada);
    expect((await repos.perfilDoAgente('atendimento', doFiscal))!.skills.map((s) => s.nome)).toEqual(['limite-ligado']);
  });
  it('agente que não existe: null', async () => {
    expect(await repos.perfilDoAgente('nao-existe')).toBeNull();
  });
});

describe('referenciaDaSkill (D5)', () => {
  it('lê arquivo de skill ligada do agente; desligada só como skill em teste', async () => {
    await skill('atendimento', 'procedimento-x', 'procedimento', true, [{ caminho: 'passos.md', conteudo: 'Passo 1.' }]);
    const off = await skill('atendimento', 'conhecimento-x', 'conhecimento', false, [{ caminho: 'tabela.csv', conteudo: 'a;b' }]);
    expect(await repos.referenciaDaSkill(AGENTE_ATENDIMENTO_ID, 'procedimento-x', 'passos.md')).toBe('Passo 1.');
    expect(await repos.referenciaDaSkill(AGENTE_ATENDIMENTO_ID, 'conhecimento-x', 'tabela.csv')).toBeNull();
    expect(await repos.referenciaDaSkill(AGENTE_ATENDIMENTO_ID, 'conhecimento-x', 'tabela.csv', off)).toBe('a;b');
    expect(await repos.referenciaDaSkill(await idDo('fiscal'), 'procedimento-x', 'passos.md')).toBeNull();
  });
});

describe('orientações e custo por agente', () => {
  it('orientacoesAtivas com o id traz só as do agente; sem id, todas (como antes)', async () => {
    // agente_id explícito nas duas: insert em lote manda null na coluna que falta (não usa o padrão do banco).
    const ins = await db.from('orientacoes_agente').insert([
      { titulo: 'Do Thiago', texto: 'x', tipo: 'jeito', ativo: true, agente_id: AGENTE_ATENDIMENTO_ID },
      { titulo: 'Do Fiscal', texto: 'y', tipo: 'jeito', ativo: true, agente_id: await idDo('fiscal') },
    ]);
    expect(ins.error).toBeNull();
    expect((await repos.orientacoesAtivas(AGENTE_ATENDIMENTO_ID)).map((o) => o.titulo)).toEqual(['Do Thiago']);
    expect((await repos.orientacoesAtivas()).map((o) => o.titulo).sort()).toEqual(['Do Fiscal', 'Do Thiago']);
  });
  it('registrarUsoIa grava o agente só quando vem', async () => {
    const base = { funcionalidade: 'agente_clientes' as const, usuarioId: null, conversaId: null, clienteId: null, modelo: 'claude-sonnet-5',
      tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01 };
    await repos.registrarUsoIa({ ...base, agenteId: AGENTE_ATENDIMENTO_ID });
    await repos.registrarUsoIa(base);
    const { data } = await db.from('uso_ia').select('agente_id').order('criado_em');
    expect(data).toEqual([{ agente_id: AGENTE_ATENDIMENTO_ID }, { agente_id: null }]);
  });
});

describe('limparBanco e dono nos testes (D24, D11)', () => {
  it('volta os agentes às sementes e apaga os criados por teste', async () => {
    await db.from('agentes').update({ estado: 'ligado', modelo: 'claude-haiku-4-5' }).eq('slug', 'fiscal');
    await db.from('agentes').insert({ slug: 'de-teste', nome: 'De teste' });
    await skill('atendimento', 'sobra', 'limites', true);
    await limparBanco();
    const { data } = await db.from('agentes').select('slug, estado, modelo').order('ordem');
    expect(data!.map((a) => a.slug)).toEqual(['atendimento', 'radar', 'fiscal', 'contabil', 'pessoal', 'legalizacao', 'comercial']);
    expect(data!.find((a) => a.slug === 'fiscal')).toEqual({ slug: 'fiscal', estado: 'desligado', modelo: null });
    expect((await db.from('agente_skills').select('id')).data).toEqual([]);
  });
  it('marcarDonoTeste marca um só; pela API (chave de serviço) a marcação não muda', async () => {
    const a = await criarUsuario(db, 'a@dono.local', { papel: 'admin' });
    const b = await criarUsuario(db, 'b@dono.local', { papel: 'admin' });
    await marcarDonoTeste(a);
    await marcarDonoTeste(b);
    const { data } = await db.from('usuarios').select('id').eq('dono', true);
    expect(data).toEqual([{ id: b }]);
    const { error } = await db.from('usuarios').update({ dono: false }).eq('id', b);
    expect(error?.message).toContain('A marcação de dono só muda direto no banco (SQL).');
  });
});

describe('criarSkillTeste (F10)', () => {
  it('vem ligada por padrão e com a versão 1; ativo false desliga', async () => {
    const ligada = await skill('atendimento', 'padrao-ligada', 'jeito');
    const { data } = await db.from('agente_skills').select('ativo, versao_atual').eq('id', ligada);
    expect(data).toEqual([{ ativo: true, versao_atual: 1 }]);
  });
});
