// Revisão geral I3: o eco "enviada por mim" de um documento (sem texto) chegava antes de o envio gravar o id da Z-API
// (arquivo grande em Base64 demora mais que os 5 s de espera) e a conversa virava "humano": o agente se calava.
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import type { MensagemRecebida } from '../src/canal/tipos';
import { ESPERAS_ECO, LimitadorEnvio, tratarEnviadaPorMim, verificarEnviadaPorMim, type DepsEnvio } from '../src/envio';
import { FILAS } from '../src/fila';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import * as f from './fixtures/zapi/sinteticos';

let canal: CanalFalso;
let d: DepsEnvio;
let eco: MensagemRecebida;

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  d = { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) };
  eco = { ...canal.interpretarWebhook(f.enviadaPorMim)!, tipo: 'documento', texto: null, idProvedor: 'ECO-DOC-1',
    midia: { url: 'https://z-api.exemplo/d.pdf', mime: 'application/pdf', nomeArquivo: 'contrato.pdf' } };
});

describe('eco de documento do próprio sistema', () => {
  it('com envio do sistema ainda pendente na conversa: espera em vez de concluir "humano"', async () => {
    const conversa = await repos.obterOuCriarConversa(eco.telefone, null);
    await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: '📎 contrato.pdf' });
    expect(await verificarEnviadaPorMim(d, eco, true)).toBe('aguardar');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
    expect(await repos.mensagemPorIdProvedor('ECO-DOC-1')).toBeNull();
  });

  it('depois que o envio grava o id, o mesmo eco é reconhecido como do sistema', async () => {
    const conversa = await repos.obterOuCriarConversa(eco.telefone, null);
    const id = await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: '📎 contrato.pdf' });
    expect(await verificarEnviadaPorMim(d, eco, true)).toBe('aguardar');
    await repos.marcarEnviada(id, 'ECO-DOC-1');
    expect(await verificarEnviadaPorMim(d, eco, true)).toBe('do-sistema');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
  });

  it('resposta do painel com arquivo, ainda sendo enviada (reservada), também espera', async () => {
    const conversa = await repos.obterOuCriarConversa(eco.telefone, null);
    const { data } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente', tipo: 'documento',
      conteudo: null, status_envio: 'pendente', envio_reservado_em: new Date().toISOString(),
      criado_em: new Date(Date.now() - 30 * 60_000).toISOString() }).select('id').single();
    expect(data).not.toBeNull();
    expect(await verificarEnviadaPorMim(d, eco, true)).toBe('aguardar');
  });

  it('sem envio pendente: é uma pessoa no celular (como antes)', async () => {
    const conversa = await repos.obterOuCriarConversa(eco.telefone, null);
    expect(await verificarEnviadaPorMim(d, eco, true)).toBe('humano');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('humano');
  });

  it('esgotadas as esperas: conclui como antes ("humano")', async () => {
    const conversa = await repos.obterOuCriarConversa(eco.telefone, null);
    await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: '📎 contrato.pdf' });
    expect(await verificarEnviadaPorMim(d, eco, false)).toBe('humano');
  });

  it('o job da fila reagenda a verificação com o contador de esperas, até o limite', async () => {
    const conversa = await repos.obterOuCriarConversa(eco.telefone, null);
    await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: '📎 contrato.pdf' });
    const fila = new FilaFalsa();
    expect(await tratarEnviadaPorMim(d, fila, eco)).toBe('aguardar');
    expect(fila.enviados).toEqual([{ nome: FILAS.verificarEnviadaPorMim, dados: { ...eco, esperas: 1 }, opcoes: { startAfter: 30 } }]);
    expect(await tratarEnviadaPorMim(d, fila, { ...eco, esperas: ESPERAS_ECO })).toBe('humano');
    expect(fila.enviados).toHaveLength(1);
  });
});

describe('eco de texto digitado no celular', () => {
  it('com arquivo do sistema pendente, o texto que não casa é de uma pessoa: não espera', async () => {
    const conversa = await repos.obterOuCriarConversa(eco.telefone, null);
    await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: '📎 contrato.pdf' });
    expect(await verificarEnviadaPorMim(d, { ...eco, tipo: 'texto', texto: 'Oi, aqui é a Ana', midia: null, idProvedor: 'ECO-TXT' }, true)).toBe('humano');
  });
});
