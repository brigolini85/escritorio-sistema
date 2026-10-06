import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type PgBoss from 'pg-boss';
import type { Repos } from '@escritorio/db';
import { criarTarefaTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { FILAS, agendarTarefa, criarBoss, filaDe } from '../../src/fila';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { MINUTOS_POR_VEZ } from '../../src/tarefa/executar';
import { enviarPedidoDePendencia } from '../../src/tarefa/pendencias';
import { batimento } from '../../src/tarefas';
import { ACESSO_DE_ANTES, contatoComEmpresas, db, repos, setorId } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';

let canal: CanalFalso;
const envio = () => ({ repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) });
// F22: a reserva confere contatos_procuraveis na hora do envio; o contato precisa poder ser procurado pelo Contábil.
const PROCURAVEL = { ...ACESSO_DE_ANTES, procurado: ['Contábil'] };

beforeEach(async () => { await limparBanco(); canal = new CanalFalso(); });

describe('pedido ao cliente (D7)', () => {
  it('manda na voz do Thiago (autor agente) a mensagem aprovada, uma vez só', async () => {
    const { contato, empresas } = await contatoComEmpresas(['Padaria Sol'], '5531999990501', PROCURAVEL);
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, estado: 'aguardando_pendencias',
      pendencias: [{ tipo: 'cliente', pergunta: 'Extrato do BB', contatoId: contato.id, pedidoTexto: 'Roberto, pode mandar o extrato do BB de outubro?' }] });
    await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
    await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
    expect(canal.enviados).toEqual([{ telefone: '5531999990501', texto: 'Roberto, pode mandar o extrato do BB de outubro?' }]);
    const m = (await db.from('mensagens').select('autor, conteudo').eq('direcao', 'saida')).data!;
    expect(m).toEqual([{ autor: 'agente', conteudo: 'Roberto, pode mandar o extrato do BB de outubro?' }]);
    expect((await sqlTeste('select mensagem_id is not null as ok from public.agente_pendencias where id = $1', [t.pendencias[0]]))[0]).toEqual({ ok: true });
  });

  it('envio que falha: libera para a fila tentar de novo, sem marcar como enviado', async () => {
    const { contato, empresas } = await contatoComEmpresas(['Padaria Sol'], '5531999990502', PROCURAVEL);
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, pendencias: [{ tipo: 'cliente', pergunta: 'Extrato', contatoId: contato.id, pedidoTexto: 'Pode mandar?' }] });
    canal.falharEnvio = true;
    await expect(enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!)).rejects.toThrow();
    expect((await sqlTeste('select pedido_enviado_em from public.agente_pendencias where id = $1', [t.pendencias[0]]))[0]).toEqual({ pedido_enviado_em: null });
    canal.falharEnvio = false;
    await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
    expect(canal.enviados).toHaveLength(1);
  });

  it('a Z-API aceitou e gravar o status falhou: não libera nem relança; nunca manda de novo', async () => {
    const { contato, empresas } = await contatoComEmpresas(['Padaria Sol'], '5531999990505', PROCURAVEL);
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, pendencias: [{ tipo: 'cliente', pergunta: 'Extrato', contatoId: contato.id, pedidoTexto: 'Pode mandar?' }] });
    const reposQueFalha: Repos = Object.assign(Object.create(repos) as Repos, { marcarEnviada: async () => { throw new Error('banco fora'); } });
    const e = { ...envio(), repos: reposQueFalha };
    await enviarPedidoDePendencia({ repos, envio: e }, t.pendencias[0]!);
    await enviarPedidoDePendencia({ repos, envio: e }, t.pendencias[0]!);
    expect(canal.enviados).toHaveLength(1);
    expect((await sqlTeste('select mensagem_id is not null as ok from public.agente_pendencias where id = $1', [t.pendencias[0]]))[0]).toEqual({ ok: true });
  });

  it('marcar a pendência falha sempre: a reserva fica, o job termina sem erro e o batimento não manda de novo', async () => {
    const { contato, empresas } = await contatoComEmpresas(['Padaria Sol'], '5531999990506', PROCURAVEL);
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, pendencias: [{ tipo: 'cliente', pergunta: 'Extrato', contatoId: contato.id, pedidoTexto: 'Pode mandar?' }] });
    const reposQueFalha: Repos = Object.assign(Object.create(repos) as Repos, { marcarPendenciaEnviada: async () => { throw new Error('banco fora'); } });
    await enviarPedidoDePendencia({ repos: reposQueFalha, envio: envio() }, t.pendencias[0]!);
    expect(canal.enviados).toHaveLength(1);
    // Passados 10 min, o banco não solta a reserva: a mensagem do pedido está na conversa.
    await sqlTeste("update public.agente_pendencias set pedido_em = pedido_em - interval '20 minutes', pedido_enviado_em = now() - interval '15 minutes' where id = $1",
      [t.pendencias[0]]);
    await sqlTeste("update public.mensagens set criado_em = criado_em - interval '15 minutes' where direcao = 'saida'");
    expect(await repos.pedidosAoClienteParados(2)).toEqual([]);
    await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
    expect(canal.enviados).toHaveLength(1);
    expect((await sqlTeste('select pedido_enviado_em is not null as ok from public.agente_pendencias where id = $1', [t.pendencias[0]]))[0]).toEqual({ ok: true });
  });

  it('as três pausas do atendimento seguram o pedido sem contar no limite; despausado, o batimento põe na fila e ele sai', async () => {
    const { contato, empresas } = await contatoComEmpresas(['Padaria Sol'], '5531999990507', PROCURAVEL);
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, pendencias: [{ tipo: 'cliente', pergunta: 'Extrato', contatoId: contato.id, pedidoTexto: 'Pode mandar?' }] });
    await sqlTeste("update public.agente_pendencias set pedido_em = now() - interval '5 minutes' where id = $1", [t.pendencias[0]]);
    const semEnvio = async () => (await sqlTeste('select pedido_enviado_em from public.agente_pendencias where id = $1', [t.pendencias[0]]))[0];
    const pausas = [
      ['configuracoes', 1], ['clientes', empresas[0]!.id], ['contatos', contato.id],
    ] as const;
    for (const [tabela, id] of pausas) {
      await sqlTeste(`update public.${tabela} set agente_pausado = true where id = $1`, [id]);
      await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
      expect(canal.enviados).toEqual([]);
      expect(await semEnvio()).toEqual({ pedido_enviado_em: null });
      expect(await repos.pedidosAoClienteParados(2)).toEqual([]);
      await sqlTeste(`update public.${tabela} set agente_pausado = false where id = $1`, [id]);
    }
    const fila = new FilaFalsa();
    await batimento({ repos, canal, alertas: { alertar: async () => {} } as never, envio: envio(), email: {} as never, fila, relogio: () => new Date() });
    expect(fila.enviados).toContainEqual({ nome: FILAS.pendenciaCliente, dados: { pendenciaId: t.pendencias[0] }, opcoes: { singletonKey: `${t.pendencias[0]}:batimento` } });
    await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
    expect(canal.enviados).toEqual([{ telefone: '5531999990507', texto: 'Pode mandar?' }]);
  });

  it('contato que não pode ser procurado pelo setor: nada sai (F22)', async () => {
    const { contato, empresas } = await contatoComEmpresas(['Padaria Sol'], '5531999990503');
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, pendencias: [{ tipo: 'cliente', pergunta: 'Extrato', contatoId: contato.id, pedidoTexto: 'Pode mandar?' }] });
    await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
    expect(canal.enviados).toEqual([]);
    expect((await sqlTeste('select pedido_enviado_em, mensagem_id from public.agente_pendencias where id = $1', [t.pendencias[0]]))[0])
      .toEqual({ pedido_enviado_em: null, mensagem_id: null });
  });
});

describe('batimento (D8)', () => {
  it('tarefa trabalhando parada há mais de 2 minutos volta para a fila', async () => {
    const { empresas } = await contatoComEmpresas(['Padaria Sol']);
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id });
    await sqlTeste("update public.agente_tarefas set atualizado_em = now() - interval '5 minutes' where id = $1", [t.id]);
    const fila = new FilaFalsa();
    const alertas = { alertar: async () => {} };
    await batimento({ repos, canal, alertas: alertas as never, envio: envio(), email: {} as never, fila, relogio: () => new Date() });
    expect(fila.enviados).toContainEqual({ nome: FILAS.agenteTrabalho, dados: { tarefaId: t.id }, opcoes: { singletonKey: t.id } });
  });

  it('pedido aprovado que não saiu (reserva velha solta) volta para a fila do pedido ao cliente (F5)', async () => {
    const { contato, empresas } = await contatoComEmpresas(['Padaria Sol'], '5531999990504', PROCURAVEL);
    const ch = (await db.from('chamados').insert({ cliente_id: empresas[0]!.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, estado: 'aguardando_pendencias',
      pendencias: [{ tipo: 'cliente', pergunta: 'Extrato', contatoId: contato.id, pedidoTexto: 'Pode mandar?' }] });
    // O trabalhador caiu entre reservar e marcar: reserva de 15 min atrás, sem mensagem.
    await sqlTeste("update public.agente_pendencias set pedido_em = now() - interval '20 minutes', pedido_enviado_em = now() - interval '15 minutes' where id = $1",
      [t.pendencias[0]]);
    const fila = new FilaFalsa();
    await batimento({ repos, canal, alertas: { alertar: async () => {} } as never, envio: envio(), email: {} as never, fila, relogio: () => new Date() });
    expect(fila.enviados).toContainEqual({ nome: FILAS.pendenciaCliente, dados: { pendenciaId: t.pendencias[0] }, opcoes: { singletonKey: `${t.pendencias[0]}:batimento` } });
    expect((await sqlTeste('select pedido_enviado_em from public.agente_pendencias where id = $1', [t.pendencias[0]]))[0]).toEqual({ pedido_enviado_em: null });
    // O job que o batimento enfileirou manda o pedido uma vez.
    await enviarPedidoDePendencia({ repos, envio: envio() }, t.pendencias[0]!);
    expect(canal.enviados).toEqual([{ telefone: '5531999990504', texto: 'Pode mandar?' }]);
  });
});

describe('fila agente_trabalho (D6)', () => {
  let boss: PgBoss;
  afterAll(async () => { await boss?.stop({ graceful: false }); });
  it('a mesma tarefa enfileirada duas vezes vira um job só', async () => {
    boss = await criarBoss(process.env.DATABASE_URL!);
    await boss.purgeQueue(FILAS.agenteTrabalho);
    const id = crypto.randomUUID();
    await agendarTarefa(filaDe(boss), id);
    await agendarTarefa(filaDe(boss), id);
    expect(await boss.getQueueSize(FILAS.agenteTrabalho)).toBe(1);
    await boss.purgeQueue(FILAS.agenteTrabalho);
  });

  it('as duas filas existem com a configuração que o painel repete; a vez (20 min, F6) cabe na expiração', async () => {
    boss ??= await criarBoss(process.env.DATABASE_URL!);
    const trabalho = await boss.getQueue(FILAS.agenteTrabalho);
    expect(trabalho).toMatchObject({ policy: 'stately', retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800 });
    expect(trabalho!.expireInSeconds!).toBeGreaterThan(MINUTOS_POR_VEZ * 60);
    expect(await boss.getQueue(FILAS.pendenciaCliente)).toMatchObject({ policy: 'stately', retryLimit: 3, retryDelay: 30, retryBackoff: true });
  });
});
