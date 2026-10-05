import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '../src';
import { anexarArquivoTeste, comoPessoa, criarTarefaTeste, limparBanco } from './limpar';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
const semErro = <T extends { error: { message: string } | null }>(r: T): T => { if (r.error) throw new Error(r.error.message); return r; };

async function demandaContabil(): Promise<{ chamadoId: string; clienteId: string }> {
  const cl = semErro(await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!;
  const setor = semErro(await db.from('setores').select('id').eq('nome', 'Contábil').single()).data!;
  const ch = semErro(await db.from('chamados').insert({ cliente_id: cl.id, setor_id: setor.id, titulo: 'Fechamento de outubro' }).select('id').single()).data!;
  return { chamadoId: ch.id, clienteId: cl.id };
}

beforeEach(limparBanco);

describe('tarefa para o trabalhador (Parte I3a)', () => {
  it('pega a vez uma vez só e lê a tarefa com agente, demanda, empresa, pendências e arquivos', async () => {
    const { chamadoId } = await demandaContabil();
    const t = await criarTarefaTeste({ chamadoId, pedido: 'Fechar outubro', skill: 'fechamento-mensal',
      pendencias: [{ tipo: 'analista', pergunta: 'PIX é pró-labore?', opcoes: ['Pró-labore', 'Lucro'] }] });
    await anexarArquivoTeste(t.id, { nome: 'extrato.csv', conteudo: 'data;valor\n01/10;10,00' });
    const desde = await repos.iniciarExecucaoTarefa(t.id);
    expect(typeof desde).toBe('string');
    expect(await repos.iniciarExecucaoTarefa(t.id)).toBeNull();
    const x = (await repos.tarefaParaTrabalho(t.id))!;
    expect(x).toMatchObject({ agenteSlug: 'contabil', agenteNome: 'Agente Contábil', setor: 'Contábil', chamadoTitulo: 'Fechamento de outubro',
      empresa: 'Padaria Sol ME', pedido: 'Fechar outubro', skillNome: 'fechamento-mensal', estado: 'trabalhando', etapas: [], limiteUsd: 2, limiteMinutos: 20 });
    expect(x.pendencias).toEqual([expect.objectContaining({ numero: 1, tipo: 'analista', opcoes: ['Pró-labore', 'Lucro'], estado: 'aberta', vista: false })]);
    expect(x.arquivos).toEqual([expect.objectContaining({ nome: 'extrato.csv', bucket: 'tarefas', lido: false })]);
  });

  it('pendência, resultado e o fim da vez decidem o estado (D8)', async () => {
    const { chamadoId } = await demandaContabil();
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Fazer', 'Aprovação'] });
    const desde = await repos.iniciarExecucaoTarefa(t.id);
    expect(await repos.abrirPendenciaTarefa({ tarefaId: t.id, tipo: 'cliente', pergunta: 'Extrato do BB', detalhe: null, opcoes: [],
      mensagem: 'Pode mandar o extrato do BB?' })).toBe(1);
    await repos.entregarResultadoTarefa(t.id, { versao: 1, resumo: 'Prévia.', destaques: [], linhas: [], observacoes: null });
    await repos.somarCustoTarefa(t.id, 0.25);
    expect(await repos.finalizarVezTarefa(t.id, 12, 'fim', desde!)).toBe('aguardando_pendencias');
    expect(await repos.situacaoTarefa(t.id)).toEqual({ estado: 'aguardando_pendencias', custoUsd: 0.25, segundosTrabalhando: 12, limiteUsd: 2, limiteMinutos: 20 });
  });

  it('custo da IA com a tarefa (D12)', async () => {
    const { chamadoId, clienteId } = await demandaContabil();
    const t = await criarTarefaTeste({ chamadoId });
    const agente = semErro(await db.from('agentes').select('id').eq('slug', 'contabil').single()).data!.id;
    await repos.registrarUsoIa({ funcionalidade: 'especialista_setor', usuarioId: null, conversaId: null, clienteId, modelo: 'm', tokensEntrada: 1,
      tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.01, agenteId: agente, tarefaId: t.id });
    const u = semErro(await db.from('uso_ia').select('tarefa_id, agente_id').single()).data!;
    expect(u).toEqual({ tarefa_id: t.id, agente_id: agente });
  });

  it('tarefas paradas, pedidos ao contato e a pessoa respondendo pela função (comoPessoa)', async () => {
    const { chamadoId } = await demandaContabil();
    const t = await criarTarefaTeste({ chamadoId, estado: 'aguardando_pendencias', pendencias: [{ tipo: 'analista', pergunta: 'PIX é pró-labore?' }] });
    expect(await repos.tarefasParadas(2)).toEqual([]);
    expect(await repos.pedidosAoClienteParados(2)).toEqual([]);
    expect(await repos.pendenciasPedidasAoContato('00000000-0000-4000-8000-000000000000')).toEqual([]);
    const { data: u } = await db.auth.admin.createUser({ email: 'claudia@tarefa.local', password: 'Senha-teste-123', email_confirm: true });
    const setor = semErro(await db.from('setores').select('id').eq('nome', 'Contábil').single()).data!;
    semErro(await db.from('usuarios').insert({ id: u.user!.id, nome: 'Cláudia', email: 'claudia@tarefa.local', papel: 'atendente', permissoes: [] }));
    semErro(await db.from('usuario_setores').insert({ usuario_id: u.user!.id, setor_id: setor.id }));
    const [r] = await comoPessoa<{ retomar: boolean }>(u.user!.id, 'select public.responder_pendencia($1, $2) as retomar', [t.pendencias[0], 'Pró-labore']);
    expect(r!.retomar).toBe(true);
    expect((await repos.situacaoTarefa(t.id))!.estado).toBe('trabalhando');
  });
});
