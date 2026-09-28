import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio, enviarDoSistema, enviarMensagemDoPainel, verificarEnviadaPorMim, type DepsEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import * as f from './fixtures/zapi/sinteticos';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
let canal: CanalFalso;
let d: DepsEnvio;

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  d = { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) };
});

describe('LimitadorEnvio', () => {
  it('espera quando passa do limite por minuto', async () => {
    let agora = 0;
    const esperas: number[] = [];
    const l = new LimitadorEnvio(2, () => agora, async (ms) => { esperas.push(ms); agora += ms; });
    await l.aguardar(); await l.aguardar(); await l.aguardar();
    expect(esperas).toEqual([60_000]);
  });
});

describe('enviarDoSistema', () => {
  it('registra antes, envia e grava o id do provedor', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const id = await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'Olá!' });
    const m = await repos.obterMensagem(id);
    expect(m.status_envio).toBe('enviada');
    expect(m.id_provedor).toBe('FALSO-1');
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', texto: 'Olá!' }]);
  });
  it('falha no envio marca a mensagem e repassa o erro', async () => {
    canal.falharEnvio = true;
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await expect(enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'x' })).rejects.toThrow();
    const { data } = await db.from('mensagens').select('status_envio').single();
    expect(data?.status_envio).toBe('falhou');
  });
});

describe('enviarMensagemDoPainel', () => {
  it('envia a resposta pendente do atendente uma única vez', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente',
      tipo: 'texto', conteudo: 'Segue a guia', status_envio: 'pendente' }).select().single();
    await enviarMensagemDoPainel(d, m!.id);
    await enviarMensagemDoPainel(d, m!.id);
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', texto: 'Segue a guia' }]);
    expect((await repos.obterMensagem(m!.id)).status_envio).toBe('enviada');
  });
  it('falha antes da última tentativa continua pendente e a nova tentativa envia', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente',
      tipo: 'texto', conteudo: 'Segue a guia', status_envio: 'pendente' }).select().single();
    canal.falharEnvio = true;
    await expect(enviarMensagemDoPainel(d, m!.id, false)).rejects.toThrow();
    expect((await repos.obterMensagem(m!.id)).status_envio).toBe('pendente');
    canal.falharEnvio = false;
    await enviarMensagemDoPainel(d, m!.id, true);
    expect((await repos.obterMensagem(m!.id)).status_envio).toBe('enviada');
  });
});

describe('verificarEnviadaPorMim', () => {
  it('mensagem que o próprio sistema enviou não muda nada', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'Olá!' });
    const r = await verificarEnviadaPorMim(d, { ...canal.interpretarWebhook(f.enviadaPorMim)!, idProvedor: 'FALSO-1' });
    expect(r).toBe('do-sistema');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
  });
  it('envio do sistema ainda pendente com o mesmo texto é reconhecido', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: 'Já envio' });
    expect(await verificarEnviadaPorMim(d, canal.interpretarWebhook(f.enviadaPorMim)!)).toBe('do-sistema');
  });
  it('resposta digitada no celular coloca a conversa como humano e fica no histórico', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    expect(await verificarEnviadaPorMim(d, canal.interpretarWebhook(f.enviadaPorMim)!)).toBe('humano');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('humano');
    expect((await repos.mensagemPorIdProvedor('MSG-EU-1'))?.conteudo).toBe('Já envio');
  });
});
