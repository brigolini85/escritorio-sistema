import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configurarAgenteTeste, limparBanco } from '@escritorio/db/teste';
import { TEXTO_FORA_DO_ACESSO } from '../../src/agente/acesso';
import { atenderComAgentes } from '../../src/agente/atender';
import { carregarContexto } from '../../src/agente/contexto';
import { montarPedido } from '../../src/agente/executar';
import { carregarAgentesSetor } from '../../src/agente/perfil';
import { montarConteudoUsuario } from '../../src/agente/prompt';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { contatoComEmpresas, db, repos } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';

// Parte I2 (D2, D6, D7, D15): quem atende o contato, a condução e a volta ao Thiago, com o banco de verdade.
const AGORA = new Date('2026-10-05T13:00:00Z');
const TEL = '5531999990001';
let canal: CanalFalso;
const deps = (ia: IaRoteirizada) => ({ repos, ia, envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) } });
const ctxDe = async (conversaId: string, agora = AGORA) =>
  carregarContexto(repos, await repos.obterConversa(conversaId), await repos.buscarContato(TEL), await repos.obterConfiguracoes(), agora);
const semErro = <T extends { error: { message: string } | null }>(r: T): T => { if (r.error) throw new Error(r.error.message); return r; };

beforeEach(async () => { await limparBanco(); canal = new CanalFalso(); });

describe('quem atende o contato (D2) e o Thiago de sempre', () => {
  it('Teste com outro contato, Ligado sem modo, só Trabalho: o pedido do Thiago é igual ao de todos desligados', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const antes = JSON.stringify(montarPedido(await ctxDe(conversa.id), []).pedido);
    const outro = semErro(await db.from('contatos').insert({ nome: 'Beto', telefone: '5531999990009' }).select('id').single()).data!.id;
    await configurarAgenteTeste('fiscal', { contatos: [outro], estado: 'teste', modo: 'mesma_voz' });
    await configurarAgenteTeste('pessoal', { estado: 'ligado', modo: null });
    await configurarAgenteTeste('contabil', { estado: 'ligado', modo: 'mesma_voz' });
    const ctx = await ctxDe(conversa.id);
    expect(ctx.agentesSetor).toEqual([]);
    expect(JSON.stringify(montarPedido(ctx, []).pedido)).toBe(antes);
  });
  it('Teste com o contato na lista: o Fiscal entra na lista do Thiago', async () => {
    const { conversa, contato } = await contatoComEmpresas(['Padaria Sol']);
    await configurarAgenteTeste('fiscal', { contatos: [contato.id], estado: 'teste', modo: 'por_tras' });
    const ctx = await ctxDe(conversa.id);
    expect(ctx.agentesSetor!.map((a) => a.slug)).toEqual(['fiscal']);
    expect((montarPedido(ctx, []).pedido.tools as { name: string }[]).at(-1)!.name).toBe('chamar_agente');
  });
  it('banco sem a I2 (agentesParaContato devolve null): nenhum agente, sem erro (D15)', async () => {
    expect(await carregarAgentesSetor({ agentesParaContato: async () => null } as never, 'qualquer')).toEqual([]);
  });
  it('número desconhecido: nenhum agente, mesmo Ligado', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz' });
    const conversa = await repos.obterOuCriarConversa('5531988887777', null);
    const ctx = await carregarContexto(repos, conversa, null, await repos.obterConfiguracoes(), AGORA);
    expect(ctx.agentesSetor).toEqual([]);
  });
});

describe('falha ao ler os agentes ou ao encerrar a condução (F9): o Thiago segue atendendo', () => {
  it('agentesParaContato com erro: sem agentes e sem condução, com log', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const quebrado = { ...repos, agentesParaContato: async () => { throw new Error('banco fora'); } };
    const ctx = await carregarContexto(quebrado, await repos.obterConversa(conversa.id), await repos.buscarContato(TEL), await repos.obterConfiguracoes(), AGORA);
    expect(ctx.agentesSetor).toEqual([]);
    expect(ctx.conducao).toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it('encerrarConducao com erro: sem condução, com log', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const quebrado = { ...repos, encerrarConducao: async () => { throw new Error('banco fora'); } };
    const ctx = await carregarContexto(quebrado, await repos.obterConversa(conversa.id), await repos.buscarContato(TEL), await repos.obterConfiguracoes(),
      new Date(Date.now() + 25 * 3600_000));
    expect(ctx.agentesSetor!.map((a) => a.slug)).toEqual(['fiscal']);
    expect(ctx.conducao).toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
  it('contato que perdeu o setor e encerrarConducao com erro: o Thiago atende mesmo assim, com log (Task 7, Minor 1)', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol'], TEL, { perfil: 'personalizado', setores: ['Pessoal'] });
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const ctx = await ctxDe(conversa.id);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const quebrado = { ...repos, encerrarConducao: async () => { throw new Error('banco fora'); } };
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()]);
    expect(await atenderComAgentes({ ...deps(ia), repos: quebrado }, ctx, montarConteudoUsuario(ctx, [], [], []))).toEqual({ status: 'ok' });
    expect((ia.recebidos[0]!.system as { text: string }[])[0]!.text).toContain('Seu nome é Thiago');
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Oi!']);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('a condução (D6)', () => {
  it('vale enquanto o agente atende o contato e dentro de 24 h', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    expect((await ctxDe(conversa.id)).conducao?.slug).toBe('fiscal');
    expect((await ctxDe(conversa.id, new Date(Date.now() + 25 * 3600_000))).conducao ?? null).toBeNull();
    const { data } = await db.from('conversa_eventos').select('tipo, texto').eq('conversa_id', conversa.id).eq('tipo', 'agente_devolveu');
    expect(data).toEqual([{ tipo: 'agente_devolveu', texto: 'Agente Fiscal: passaram 24 horas' }]);
  });
  it('agente desligado no meio: volta ao Thiago com o motivo', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    await configurarAgenteTeste('fiscal', { estado: 'desligado' });
    expect((await ctxDe(conversa.id)).conducao ?? null).toBeNull();
    expect((await repos.obterConversa(conversa.id)).agente_conduzindo_id).toBeNull();
  });
  it('as mensagens seguintes vão ao agente; ao devolver, o Thiago trata a mesma mensagem', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const ctx = await ctxDe(conversa.id);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'pediu o boleto' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Já passo pro Financeiro.' } }), fim()]);
    expect(await atenderComAgentes(deps(ia), ctx, montarConteudoUsuario(ctx, [], [], []))).toEqual({ status: 'ok' });
    expect((ia.recebidos[0]!.system as { text: string }[])[0]!.text).toContain('COMO VOCÊ FALA: o Thiago passou a conversa');
    expect((ia.recebidos[1]!.system as { text: string }[])[0]!.text).toContain('Seu nome é Thiago');
    // Ao voltar, o Fiscal sai da lista nesta vez (D16): sem chamar_agente.
    expect((ia.recebidos[1]!.tools as { name: string }[]).map((t) => t.name)).not.toContain('chamar_agente');
    expect((await repos.obterConversa(conversa.id)).agente_conduzindo_id).toBeNull();
    const { data: uso } = await db.from('uso_ia').select('funcionalidade, agente_id').order('criado_em');
    expect(uso).toEqual([{ funcionalidade: 'especialista_setor', agente_id: fiscal },
      { funcionalidade: 'agente_clientes', agente_id: 'a0000000-0000-4000-8000-000000000001' },
      { funcionalidade: 'agente_clientes', agente_id: 'a0000000-0000-4000-8000-000000000001' }]);
  });
  it('o agente respondeu e depois devolveu: o Thiago não roda de novo na mesma mensagem', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const ctx = await ctxDe(conversa.id);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Pronto, a nota saiu.' } }),
      usarFerramentas({ nome: 'devolver_ao_thiago', entrada: { motivo: 'assunto resolvido' } })]);
    expect(await atenderComAgentes(deps(ia), ctx, montarConteudoUsuario(ctx, [], [], []))).toEqual({ status: 'ok' });
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Pronto, a nota saiu.']);
    expect(ia.recebidos).toHaveLength(2);
    expect((await repos.obterConversa(conversa.id)).agente_conduzindo_id).toBeNull();
    const { data } = await db.from('conversa_eventos').select('texto').eq('conversa_id', conversa.id).eq('tipo', 'agente_devolveu');
    expect(data).toEqual([{ texto: 'Agente Fiscal: assunto resolvido' }]);
  });
  it('erro no agente durante a condução: a condução acaba, com o marco, e o erro segue (F10)', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol']);
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const ctx = await ctxDe(conversa.id);
    const quebrada = { criar: async () => { throw new Error('IA fora'); } };
    await expect(atenderComAgentes(deps(quebrada as never), ctx, montarConteudoUsuario(ctx, [], [], []))).rejects.toThrow('IA fora');
    expect((await repos.obterConversa(conversa.id)).agente_conduzindo_id).toBeNull();
    const { data } = await db.from('conversa_eventos').select('texto').eq('conversa_id', conversa.id).eq('tipo', 'agente_devolveu');
    expect(data).toEqual([{ texto: 'Agente Fiscal: não conseguiu seguir' }]);
  });
  it('contato que perdeu o Fiscal no acesso: o agente não roda; o Thiago atende', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol'], TEL, { perfil: 'personalizado', setores: ['Pessoal'] });
    const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'passa_conversa' });
    await repos.iniciarConducao(conversa.id, fiscal);
    const ctx = await ctxDe(conversa.id);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()]);
    await atenderComAgentes(deps(ia), ctx, montarConteudoUsuario(ctx, [], [], []));
    expect((ia.recebidos[0]!.system as { text: string }[])[0]!.text).toContain('Seu nome é Thiago');
    expect((await repos.obterConversa(conversa.id)).agente_conduzindo_id).toBeNull();
  });
});

describe('acesso por contato no chamar_agente (D7)', () => {
  it('contato sem o Fiscal: a recusa neutra da H2 e nenhum custo do agente', async () => {
    const { conversa } = await contatoComEmpresas(['Padaria Sol'], TEL, { perfil: 'personalizado', setores: ['Pessoal'] });
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz' });
    const ctx = await ctxDe(conversa.id);
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'chamar_agente', entrada: { agente: 'fiscal', assunto: 'outro', pedido: 'quanto vai dar o DAS?' } }), fim()]);
    await atenderComAgentes(deps(ia), ctx, montarConteudoUsuario(ctx, [], [], []));
    expect(canal.enviados.map((e) => e.texto)).toEqual([TEXTO_FORA_DO_ACESSO]);
    const { data: ch } = await db.from('chamados').select('titulo, setores(nome)');
    expect(ch).toEqual([{ titulo: 'Fora do acesso: quanto vai dar o DAS?', setores: { nome: 'Fiscal' } }]);
    const { data: uso } = await db.from('uso_ia').select('funcionalidade');
    expect(uso!.every((u) => u.funcionalidade === 'agente_clientes')).toBe(true);
  });
});
