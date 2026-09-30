import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);

async function usuario(email: string) {
  const antigo = (await db.from('usuarios').select('id').eq('email', email).maybeSingle()).data;
  if (antigo) await db.auth.admin.deleteUser(antigo.id);
  const { data } = await db.auth.admin.createUser({ email, password: 'Senha-teste-123', email_confirm: true });
  await db.from('usuarios').insert({ id: data.user!.id, nome: 'Marcada', email, permissoes: ['treinar_agente'] });
  return data.user!.id;
}

beforeEach(async () => { await limparBanco(); });

describe('repositório de Treinar o agente (pedido do dono, 2026-09-30)', () => {
  it('orientacoesAtivas traz só as ligadas, mais recentes primeiro, com o nome do setor', async () => {
    const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
    const { data: c } = await db.from('clientes').insert({ razao_social: 'Indústria O', cnpj: '44555666000177' }).select().single();
    const base = { texto: 'x', tipo: 'jeito', ativo: true };
    const r = await db.from('orientacoes_agente').insert([
      { ...base, titulo: 'Geral', atualizado_em: '2026-09-01T10:00:00Z' },
      { ...base, titulo: 'Do setor', tipo: 'situacao', setor_id: fiscal!.id, atualizado_em: '2026-09-03T10:00:00Z' },
      { ...base, titulo: 'Da empresa', tipo: 'regra', cliente_id: c!.id, atualizado_em: '2026-09-02T10:00:00Z' },
      { ...base, titulo: 'Desligada', ativo: false, atualizado_em: '2026-09-04T10:00:00Z' },
    ]);
    expect(r.error).toBeNull();

    const ativas = await repos.orientacoesAtivas();
    expect(ativas.map((o) => o.titulo)).toEqual(['Do setor', 'Da empresa', 'Geral']);
    expect(ativas[0]).toMatchObject({ tipo: 'situacao', setorId: fiscal!.id, setorNome: 'Fiscal', clienteId: null });
    expect(ativas[1]).toMatchObject({ tipo: 'regra', clienteId: c!.id, setorId: null, setorNome: null });
    expect(ativas[2]!.atualizadoEm).toEqual(new Date('2026-09-01T10:00:00Z'));
  });

  it('lê a simulação e grava o resultado só uma vez', async () => {
    const id = await usuario('marcada@teste-orientacoes.local');
    const rascunho = { titulo: 'R', texto: 'Peça o CNPJ.', tipo: 'regra', cliente_id: null, setor_id: null };
    const { data: s } = await db.from('simulacoes_agente').insert({ usuario_id: id, mensagem: 'oi', rascunho }).select('id').single();

    expect(await repos.simulacaoPorId(s!.id)).toMatchObject({ usuario_id: id, mensagem: 'oi', status: 'pendente', rascunho });
    const respostas = { mensagens: ['Olá!'], ferramentas: [{ nome: 'abrir_chamado', entrada: { setor: 'Fiscal' } }] };
    expect(await repos.concluirSimulacao(s!.id, { status: 'pronta', respostas })).toBe(true);
    expect(await repos.concluirSimulacao(s!.id, { status: 'erro', erro: 'de novo' })).toBe(false);
    expect(await repos.simulacaoPorId(s!.id)).toMatchObject({ status: 'pronta', respostas, erro: null });
    expect(await repos.simulacaoPorId('99999999-0000-0000-0000-000000000000')).toBeNull();
  });
});
