import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { FILAS } from '../src/fila';
import { criarServidor } from '../src/servidor';
import { FilaFalsa } from './apoio/fila-falsa';
import * as f from './fixtures/zapi/sinteticos';

const db = criarClienteServico(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const repos = criarRepos(db);
let fila: FilaFalsa;

function servidor() {
  return criarServidor({ canal: new CanalFalso(), repos, fila, segredo: 'segredo-com-16-caracteres', relogio: () => new Date() });
}
const URL_OK = '/webhook/zapi/segredo-com-16-caracteres';

beforeEach(async () => {
  await limparBanco();
  fila = new FilaFalsa();
});

describe('webhook', () => {
  it('recusa segredo errado', async () => {
    const r = await servidor().inject({ method: 'POST', url: '/webhook/zapi/errado', payload: f.texto });
    expect(r.statusCode).toBe(401);
  });

  it('grava a mensagem e agenda o processamento agrupado', async () => {
    const r = await servidor().inject({ method: 'POST', url: URL_OK, payload: f.texto });
    expect(r.statusCode).toBe(200);
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(1);
    expect(fila.enviados).toEqual([{ nome: FILAS.processarConversa, dados: { conversaId: conversa.id },
      opcoes: { singletonKey: conversa.id, startAfter: 8 } }]);
  });

  it('o mesmo webhook entregue duas vezes grava e agenda uma vez só', async () => {
    const app = servidor();
    await app.inject({ method: 'POST', url: URL_OK, payload: f.texto });
    await app.inject({ method: 'POST', url: URL_OK, payload: f.texto });
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(1);
    expect(fila.enviados).toHaveLength(1);
  });

  it('ignora mensagens de grupo', async () => {
    await servidor().inject({ method: 'POST', url: URL_OK, payload: f.grupo });
    expect(fila.enviados).toHaveLength(0);
    const { count } = await db.from('mensagens').select('*', { count: 'exact', head: true });
    expect(count).toBe(0);
  });

  it('mensagem enviada pelo celular do escritório vai para verificação com atraso', async () => {
    await servidor().inject({ method: 'POST', url: URL_OK, payload: f.enviadaPorMim });
    expect(fila.enviados[0]?.nome).toBe(FILAS.verificarEnviadaPorMim);
    expect(fila.enviados[0]?.opcoes).toEqual({ startAfter: 5 });
  });

  it('tipo não suportado é gravado com aviso para a equipe ver', async () => {
    await servidor().inject({ method: 'POST', url: URL_OK, payload: f.figurinha });
    const { data } = await db.from('mensagens').select('conteudo').single();
    expect(data?.conteudo).toBe('[mensagem de tipo não suportado]');
  });
});

describe('/saude', () => {
  it('503 sem sinais de vida recentes e 200 com eles', async () => {
    const app = servidor();
    expect((await app.inject({ method: 'GET', url: '/saude' })).statusCode).toBe(503);
    await repos.registrarSinalVida('fila');
    await repos.registrarSinalVida('whatsapp');
    expect((await app.inject({ method: 'GET', url: '/saude' })).statusCode).toBe(200);
  });
});
