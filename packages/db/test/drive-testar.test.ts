import { beforeEach, describe, expect, it } from 'vitest';
import { criarRepos, criarClienteServico } from '../src';
import { configurarAgenteTeste, criarSkillTeste, criarTarefaTeste, definirPastaDriveTeste, limparBanco, sqlTeste, situacaoDriveTeste } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const PASTA = '1PastaDaPadariaSolAbcdefghij';
const OUTRA = '1PastaDaMerceariaLuaAbcdefgh';

async function base() {
  const setor = (await db.from('setores').select('id').eq('nome', 'Contábil').single()).data!.id;
  const sol = (await db.from('clientes').insert({ razao_social: 'Padaria Sol', cnpj: '21448390000107' }).select('id').single()).data!;
  const lua = (await db.from('clientes').insert({ razao_social: 'Mercearia Lua', cnpj: '11222333000181' }).select('id').single()).data!;
  await definirPastaDriveTeste(sol.id, PASTA);
  await definirPastaDriveTeste(lua.id, OUTRA);
  const ch = (await db.from('chamados').insert({ cliente_id: sol.id, setor_id: setor, titulo: 'Fechamento' }).select('id').single()).data!;
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  const t = await criarTarefaTeste({ chamadoId: ch.id });
  return { sol: sol.id, lua: lua.id, tarefa: t.id };
}

describe('Drive (I3b)', () => {
  beforeEach(limparBanco);
  it('pastaDriveDaTarefa traz a pasta, as dos outros e o que já foi copiado', async () => {
    const b = await base();
    const p = await repos.pastaDriveDaTarefa(b.tarefa);
    expect(p).toMatchObject({ estado: 'trabalhando', clienteId: b.sol, pasta: PASTA, outras: [OUTRA], importados: [], total: 0 });
    expect(await repos.pastaDriveDaTarefa('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
  it('registrarArquivoDrive copia com origem drive; o mesmo não entra duas vezes (data em ISO, F20)', async () => {
    const b = await base();
    const caminho = `${b.tarefa}/drive/1PdfDoDriveAbcdefghij-1.pdf`;
    await db.storage.from('tarefas').upload(caminho, new TextEncoder().encode('%PDF-1.4'), { contentType: 'application/pdf' });
    const r = await repos.registrarArquivoDrive({ tarefaId: b.tarefa, caminho, nome: 'extrato.pdf', mime: 'application/pdf', tamanho: 8,
      driveId: '1PdfDoDriveAbcdefghij', modificadoEm: '2026-10-01T10:00:00.000Z' });
    expect(r.nome).toBe('extrato.pdf');
    expect((await repos.pastaDriveDaTarefa(b.tarefa))!.importados).toEqual([{ driveId: '1PdfDoDriveAbcdefghij', modificadoEm: '2026-10-01T10:00:00.000Z' }]);
    await expect(repos.registrarArquivoDrive({ tarefaId: b.tarefa, caminho, nome: 'extrato.pdf', mime: 'application/pdf', tamanho: 8,
      driveId: '1PdfDoDriveAbcdefghij', modificadoEm: '2026-10-01T10:00:00.000Z' })).rejects.toThrow('Este arquivo do Drive já está na tarefa.');
  });
  it('registrarSituacaoDrive grava e limpa o erro de conta (F1); a pessoa lê', async () => {
    expect(await repos.registrarSituacaoDrive({ email: 'drive@x.iam.gserviceaccount.com', erro: null })).toBe(true);
    expect((await db.from('drive_conta').select('email').single()).data!.email).toBe('drive@x.iam.gserviceaccount.com');
    expect(await repos.registrarSituacaoDrive({ email: null, erro: 'A conta do Drive foi recusada.' })).toBe(true);
    const c = (await db.from('drive_conta').select('email, erro').single()).data!;
    expect(c).toEqual({ email: 'drive@x.iam.gserviceaccount.com', erro: 'A conta do Drive foi recusada.' });
    expect(await repos.registrarSituacaoDrive({ email: null, erro: null })).toBe(true);
    expect((await db.from('drive_conta').select('erro').single()).data!.erro).toBeNull();
    // Revisão final (Important 1): sem leitor (chave tirada), o e-mail antigo some.
    expect(await repos.registrarSituacaoDrive({ email: null, erro: null, semLeitor: true })).toBe(true);
    expect((await db.from('drive_conta').select('email, erro').single()).data).toEqual({ email: null, erro: null });
  });
  it('situacaoDriveTeste grava direto (ajudante)', async () => {
    await situacaoDriveTeste('a@b.c', 'x');
    expect((await db.from('drive_conta').select('email, erro').single()).data).toEqual({ email: 'a@b.c', erro: 'x' });
  });
});

describe('agenteSetorParaTeste (I3b, D11)', () => {
  beforeEach(limparBanco);
  it('o Fiscal com a skill desligada em teste; o Thiago e o Contábil (só Trabalho) não', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'desligado', modo: 'por_tras' });
    const sk = await criarSkillTeste('fiscal', 'tabela-cfop', 'conhecimento', false, [], { titulo: 'Tabela CFOP', descricao: 'CFOP', corpo: 'x' });
    const fiscal = (await db.from('agentes').select('id').eq('slug', 'fiscal').single()).data!.id;
    const a = await repos.agenteSetorParaTeste(fiscal, sk);
    expect(a).toMatchObject({ slug: 'fiscal', setor: 'Fiscal', modo: 'por_tras', skillEmTeste: sk });
    expect(a!.skills.map((s) => s.nome)).toContain('tabela-cfop');
    const thiago = (await db.from('agentes').select('id').eq('slug', 'atendimento').single()).data!.id;
    const contabil = (await db.from('agentes').select('id').eq('slug', 'contabil').single()).data!.id;
    expect(await repos.agenteSetorParaTeste(thiago, null)).toBeNull();
    expect(await repos.agenteSetorParaTeste(contabil, null)).toBeNull();
    expect(await repos.agenteSetorParaTeste('00000000-0000-4000-8000-000000000000', null)).toBeNull();
  });
});

describe('guarda (I3b, D14)', () => {
  beforeEach(limparBanco);
  it('nunca apagar: nada vence; com prazo, só o vencido; marcar não repete', async () => {
    const b = await base();
    await sqlTeste(`update public.agente_tarefas set estado = 'aprovada', decidida_em = now() - interval '400 days' where id = $1`, [b.tarefa]);
    const arq = (await sqlTeste<{ id: string }>(`insert into public.agente_tarefa_arquivos (tarefa_id, origem, bucket, caminho, nome, mime, tamanho)
      values ($1::uuid, 'enviado', 'tarefas', $1::text || '/1-a.pdf', 'a.pdf', 'application/pdf', 1) returning id`, [b.tarefa]))[0]!.id;
    expect(await repos.arquivosVencidosDasTarefas(100)).toEqual([]);
    await sqlTeste('update public.tarefas_guarda set dias = 365');
    expect(await repos.arquivosVencidosDasTarefas(100)).toEqual([{ id: arq, caminho: `${b.tarefa}/1-a.pdf` }]);
    expect(await repos.marcarArquivosRemovidos([arq])).toBe(1);
    expect(await repos.arquivosVencidosDasTarefas(100)).toEqual([]);
    expect(await repos.marcarArquivosRemovidos([])).toBe(0);
    await limparBanco();
    expect((await sqlTeste<{ dias: number | null }>('select dias from public.tarefas_guarda'))[0]!.dias).toBeNull();
  });
});
