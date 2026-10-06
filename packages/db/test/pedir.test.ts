import { beforeEach, describe, expect, it } from 'vitest';
import { RecusaDoBanco, criarClienteServico, criarRepos } from '../src';
import { configurarAgenteTeste, criarTarefaTeste, limparBanco, nivelTeste, opcoesPedidoTeste, repassarPendenciaTeste, sqlTeste } from './limpar';
import { criarUsuario } from './usuario';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
let claudia: string;
let empresa: string;
const setor = async (nome: string) => (await db.from('setores').select('id').eq('nome', nome).single()).data!.id as string;

beforeEach(async () => {
  await limparBanco();
  await configurarAgenteTeste('contabil', { estado: 'ligado', tipos: ['trabalho'] });
  claudia = await criarUsuario(db, 'claudia@i4db.local', { nome: 'Cláudia', papel: 'atendente', telefone: '5531911110001' });
  await db.from('usuario_setores').insert({ usuario_id: claudia, setor_id: await setor('Contábil') });
  await nivelTeste(claudia, 'assistente', 'site_whatsapp');
  empresa = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!.id;
});

describe('pedir ao agente pelo trabalhador (I4)', () => {
  it('lista os agentes que a pessoa pode pedir e cria a tarefa pelo WhatsApp numa demanda nova', async () => {
    const agentes = await repos.agentesParaPedir(claudia);
    expect(agentes!.map((a) => a.slug)).toEqual(['contabil']);
    expect(agentes![0]!.custo).toEqual({ n: 0, min: null, max: null, limite: 2 });
    const r = await repos.pedirAoAgenteDe({ usuarioId: claudia, origem: 'whatsapp', agenteId: agentes![0]!.id, pedido: 'Fazer o fechamento de outubro',
      clienteId: empresa, chamadoNumero: null, prazo: null });
    expect(r.demandaNova).toBe(true);
    expect(await sqlTeste('select canal, avisar_whatsapp from public.agente_tarefas where id = $1', [r.tarefaId])).toEqual([{ canal: 'whatsapp', avisar_whatsapp: true }]);
    expect(await repos.opcoesDoPedido(r.tarefaId)).toEqual({ prazoDesejado: null, lerDrive: true, subpasta: null, avisarPainel: true, avisarWhatsapp: true });
  });

  it('a recusa do banco chega como RecusaDoBanco com a frase', async () => {
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado' });
    await expect(repos.pedirAoAgenteDe({ usuarioId: claudia, origem: 'whatsapp', agenteId: fiscal, pedido: 'Conferir notas', clienteId: empresa,
      chamadoNumero: null, prazo: null })).rejects.toThrow(new RecusaDoBanco('Você só pede aos agentes dos seus setores.'));
  });

  it('avisos: registra, reserva, marca e as pendências repassadas; a resposta volta a tarefa', async () => {
    const ch = (await db.from('chamados').insert({ cliente_id: empresa, setor_id: await setor('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!.id;
    const t = await criarTarefaTeste({ chamadoId: ch, pedidaPor: claudia, estado: 'aguardando_pendencias',
      pendencias: [{ tipo: 'analista', pergunta: 'PIX para o sócio: o que é?', opcoes: ['lucro', 'empréstimo'] }] });
    await opcoesPedidoTeste(t.id, { avisarWhatsapp: true });
    const ids = await repos.registrarAvisosDaTarefa(t.id);
    expect(ids).toHaveLength(1);
    const reserva = await repos.reservarAvisoTarefa(ids![0]!);
    expect(reserva).toMatchObject({ tarefaId: t.id, tipo: 'pendencias', pendencias: [1], telefone: '5531911110001', pedeNoSetor: true, responsavel: null });
    await repos.marcarAvisoTarefa(ids![0]!, true);
    expect(await repos.pendenciasRepassadas(claudia)).toEqual([{ tarefaId: t.id, tarefaNumero: t.numero, agente: expect.any(String), empresa: 'Padaria Sol ME',
      numero: 1, pergunta: 'PIX para o sócio: o que é?', detalhe: null, opcoes: ['lucro', 'empréstimo'] }]);
    expect(await repos.responderPendenciaDe({ usuarioId: claudia, tarefaNumero: t.numero, pendencia: 1, resposta: 'empréstimo' }))
      .toEqual({ tarefaId: t.id, retomou: true });
    expect(await repos.avisosTarefaParados()).toEqual([]);
  });

  it('repassarPendenciaTeste marca a pendência como repassada (para os cenários)', async () => {
    const ch = (await db.from('chamados').insert({ cliente_id: empresa, setor_id: await setor('Contábil'), titulo: 'X' }).select('id').single()).data!.id;
    const t = await criarTarefaTeste({ chamadoId: ch, pedidaPor: claudia, estado: 'aguardando_pendencias', pendencias: [{ tipo: 'analista', pergunta: 'Qual conta?' }] });
    await repassarPendenciaTeste(t.id, 1);
    expect((await repos.pendenciasRepassadas(claudia))!.map((p) => p.numero)).toEqual([1]);
  });
});
