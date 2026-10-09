// Auditoria 3.2, 3.3, 3.6, 3.10, 3.11, 3.12 e 4.16: o envio cujo resultado não se sabe (prazo, rede, 5xx) ficava "falhou",
// o eco virava "humano", a resposta do painel saía duas vezes, o aviso de privacidade podia sair duas vezes e o limite
// de avisos valia só por processo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { EnvioIncerto, type MensagemRecebida } from '../src/canal/tipos';
import { criarCanalZapi } from '../src/canal/zapi';
import { LimitadorEnvio, enviarDocumentoDoSistema, enviarDoSistema, enviarMensagemDoPainel, verificarEnviadaPorMim, type DepsEnvio } from '../src/envio';
import { FILAS } from '../src/fila';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { enviarAvisoLgpd, processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { contatoComEmpresas, db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from './apoio/ia-roteirizada';
import * as f from './fixtures/zapi/sinteticos';

let canal: CanalFalso;
let fila: FilaFalsa;
let d: DepsEnvio;

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  fila = new FilaFalsa();
  d = { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db), fila };
});

const eco = (texto: string | null, idProvedor: string, extra: Partial<MensagemRecebida> = {}): MensagemRecebida =>
  ({ ...canal.interpretarWebhook(f.enviadaPorMim)!, texto, idProvedor, ...extra });

describe('Z-API: falha certa (4xx) e resultado incerto', () => {
  const cfg = { instancia: 'INST', token: 'TOK', clientToken: 'CT' };
  const responde = (status: number, corpo: object | string) =>
    vi.fn().mockImplementation(async () => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status }));

  it('4xx é falha certa (não é EnvioIncerto)', async () => {
    const e = await criarCanalZapi(cfg, responde(400, { error: 'phone inválido' })).enviarTexto('5531999990001', 'oi').catch((x: unknown) => x);
    expect(e).toBeInstanceOf(Error);
    expect(e).not.toBeInstanceOf(EnvioIncerto);
  });

  it('5xx, prazo estourado, conexão caída e resposta sem id são incertos', async () => {
    await expect(criarCanalZapi(cfg, responde(502, 'bad gateway')).enviarTexto('5531999990001', 'oi')).rejects.toBeInstanceOf(EnvioIncerto);
    await expect(criarCanalZapi(cfg, responde(200, { nada: 1 })).enviarTexto('5531999990001', 'oi')).rejects.toBeInstanceOf(EnvioIncerto);
    const prazo = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => {
      init.signal!.addEventListener('abort', () => rej(init.signal!.reason));
    }));
    await expect(criarCanalZapi(cfg, prazo as never, { texto: 20, arquivo: 20, status: 20 }).enviarTexto('5531999990001', 'oi'))
      .rejects.toBeInstanceOf(EnvioIncerto);
    const caiu = vi.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_SOCKET' } }));
    await expect(criarCanalZapi(cfg, caiu).enviarTexto('5531999990001', 'oi')).rejects.toBeInstanceOf(EnvioIncerto);
  });

  it('conexão recusada (a requisição nem saiu) é falha certa', async () => {
    const recusada = vi.fn().mockRejectedValue(Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }));
    const e = await criarCanalZapi(cfg, recusada).enviarTexto('5531999990001', 'oi').catch((x: unknown) => x);
    expect(e).not.toBeInstanceOf(EnvioIncerto);
  });
});

describe('envio do sistema com resultado incerto (3.2)', () => {
  it('prazo estourado depois de enviar: "incerto"; o eco chega: "enviada" com o id do eco e a conversa segue com o agente', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    canal.incertoDepoisDeEnviar = true;
    const id = await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'Segue a guia' });
    expect((await repos.obterMensagem(id)).status_envio).toBe('incerto');

    expect(await verificarEnviadaPorMim(d, eco('Segue a guia', 'ECO-1'))).toBe('do-sistema');
    const m = await repos.obterMensagem(id);
    expect([m.status_envio, m.id_provedor]).toEqual(['enviada', 'ECO-1']);
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
    const { count } = await db.from('mensagens').select('*', { count: 'exact', head: true }).eq('autor', 'atendente');
    expect(count).toBe(0);
  });

  it('eco com espaços diferentes também casa', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    canal.incertoDepoisDeEnviar = true;
    const id = await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'Linha 1\nLinha 2' });
    expect(await verificarEnviadaPorMim(d, eco('Linha 1 \n Linha 2 ', 'ECO-2'))).toBe('do-sistema');
    expect((await repos.obterMensagem(id)).status_envio).toBe('enviada');
  });

  it('4xx: "falhou" e o erro segue', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    canal.falharEnvio = true;
    await expect(enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'x' })).rejects.toThrow();
    const { data } = await db.from('mensagens').select('status_envio').single();
    expect(data?.status_envio).toBe('falhou');
  });

  it('o eco que chega antes do fim do envio não é desfeito pelo "incerto"', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    let idMensagem = '';
    const enviarTexto = canal.enviarTexto.bind(canal);
    canal.enviarTexto = async (tel, texto) => {
      await enviarTexto(tel, texto);
      idMensagem = (await db.from('mensagens').select('id').eq('conteudo', texto).single()).data!.id;
      expect(await verificarEnviadaPorMim(d, eco(texto, 'ECO-ANTES'))).toBe('do-sistema');
      throw new EnvioIncerto('Z-API sem resposta no prazo');
    };
    await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'Pronto' });
    expect((await repos.obterMensagem(idMensagem)).status_envio).toBe('enviada');
  });

  it('documento da empresa incerto: o eco do arquivo (pelo nome) o confirma', async () => {
    const { data: cli } = await db.from('clientes').insert({ razao_social: 'Indústria X', cnpj: '11222333000181' }).select().single();
    const path = `clientes/${cli!.id}/contrato.pdf`;
    await db.storage.from('documentos').upload(path, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', upsert: true });
    const { data: doc } = await db.from('documentos_empresa').insert({ cliente_id: cli!.id, nome: 'Contrato social', arquivo_path: path,
      arquivo_nome: 'contrato.pdf', ia_pode_enviar: true }).select('id').single();
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    canal.incertoDepoisDeEnviar = true;
    const id = await enviarDocumentoDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: cli!.id,
      documento: { id: doc!.id, nome: 'Contrato social', arquivoPath: path, arquivoNome: 'contrato.pdf', arquivoMime: 'application/pdf', iaPodeEnviar: true } });
    expect((await repos.obterMensagem(id)).status_envio).toBe('incerto');
    const ecoDoc = eco(null, 'ECO-DOC', { tipo: 'documento', midia: { url: 'https://z-api.exemplo/d.pdf', mime: 'application/pdf', nomeArquivo: 'contrato.pdf' } });
    expect(await verificarEnviadaPorMim(d, ecoDoc, true)).toBe('do-sistema');
    expect((await repos.obterMensagem(id)).id_provedor).toBe('ECO-DOC');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
  });
});

describe('na vez do agente (3.2)', () => {
  it('resposta incerta não dispara "IA indisponível" nem passa à equipe', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: 'E1', tipo: 'texto', conteudo: 'oi' });
    canal.incertoDepoisDeEnviar = true;
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    const deps: DepsProcessamento = {
      repos, ia, fila: new FilaFalsa(), envio: d, midia: criarArmazenamento(db),
      transcritor: { modelo: 'x', provedor: 'groq', transcrever: vi.fn() },
      alertas: { alertar: async () => undefined }, relogio: () => new Date('2026-09-28T13:00:00Z'),
    };
    expect(await processarConversa(deps, conversa.id, false)).toBe('agente');
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Olá!']);
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
    expect(await repos.chamadosAbertosDaConversa(conversa.id)).toEqual([]);
    const saidas = (await repos.historico(conversa.id, 10)).filter((m) => m.direcao === 'saida');
    expect(saidas.map((m) => [m.conteudo, m.status_envio])).toEqual([['Olá!', 'incerto']]);
  });
});

describe('resposta do painel com resultado incerto (3.3)', () => {
  async function respostaPendente(extra: object = {}) {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente',
      tipo: 'texto', conteudo: 'Segue a guia', status_envio: 'pendente', ...extra }).select().single();
    return { conversa, m: m! };
  }

  it('texto com prazo estourado: "incerto", não relança e a nova tentativa não manda de novo', async () => {
    const { m } = await respostaPendente();
    canal.incertoDepoisDeEnviar = true;
    await enviarMensagemDoPainel(d, m.id, false);
    canal.incertoDepoisDeEnviar = false;
    await enviarMensagemDoPainel(d, m.id, false);
    await enviarMensagemDoPainel(d, m.id, true);
    expect(canal.enviados).toHaveLength(1);
    expect((await repos.obterMensagem(m.id)).status_envio).toBe('incerto');
    // O batimento não a põe na fila de novo.
    expect(await repos.respostasPendentesAntigas(0)).toEqual([]);
  });

  it('arquivo com prazo estourado: não sai duas vezes; o eco do arquivo confirma', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const path = `conversas/${conversa.id}/guia.pdf`;
    await db.storage.from('anexos').upload(path, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', upsert: true });
    const { m } = await respostaPendente({ conteudo: null, tipo: 'documento', arquivo_path: path, arquivo_nome: 'guia.pdf', arquivo_mime: 'application/pdf' });
    canal.incertoDepoisDeEnviar = true;
    await enviarMensagemDoPainel(d, m.id, false);
    canal.incertoDepoisDeEnviar = false;
    await enviarMensagemDoPainel(d, m.id, true);
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', arquivo: 'guia.pdf' }]);
    const ecoArq = eco(null, 'ECO-ARQ', { tipo: 'documento', midia: { url: 'https://z-api.exemplo/g.pdf', mime: 'application/pdf', nomeArquivo: 'guia.pdf' } });
    expect(await verificarEnviadaPorMim(d, ecoArq, true)).toBe('do-sistema');
    expect((await repos.obterMensagem(m.id)).status_envio).toBe('enviada');
  });

  it('texto + arquivo: texto incerto vira mensagem própria e o arquivo sai uma vez', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const path = `conversas/${conversa.id}/guia.pdf`;
    await db.storage.from('anexos').upload(path, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', upsert: true });
    const { m } = await respostaPendente({ tipo: 'documento', arquivo_path: path, arquivo_nome: 'guia.pdf', arquivo_mime: 'application/pdf' });
    const enviarTexto = canal.enviarTexto.bind(canal);
    canal.enviarTexto = async (tel, texto) => { await enviarTexto(tel, texto); throw new EnvioIncerto('Z-API sem resposta no prazo'); };
    await enviarMensagemDoPainel(d, m.id, false);
    await enviarMensagemDoPainel(d, m.id, true);
    expect(canal.enviados).toEqual([
      { telefone: '5531999990001', texto: 'Segue a guia' },
      { telefone: '5531999990001', arquivo: 'guia.pdf' },
    ]);
    const linhas = (await db.from('mensagens').select('conteudo, arquivo_nome, status_envio').eq('conversa_id', conversa.id).order('criado_em')).data!;
    expect(linhas).toEqual([
      { conteudo: 'Segue a guia', arquivo_nome: null, status_envio: 'incerto' },
      { conteudo: null, arquivo_nome: 'guia.pdf', status_envio: 'enviada' },
    ]);
  });
});

describe('eco que não casa com nada (3.6) e telefone do eco (3.10)', () => {
  it('pessoa no celular: a conversa vira humano e sai um alerta (só os 4 últimos dígitos), uma vez por hora', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    expect(await verificarEnviadaPorMim(d, eco('Oi, aqui é a Ana', 'CEL-1'))).toBe('humano');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('humano');
    await repos.atualizarConversa(conversa.id, { estado: 'agente' });
    expect(await verificarEnviadaPorMim(d, eco('De novo', 'CEL-2'))).toBe('humano');
    const alertas = (await db.from('alertas').select('mensagem')).data!.map((a) => a.mensagem);
    expect(alertas).toEqual(['Alguém respondeu pelo celular a …0001; o agente parou nessa conversa.']);
    expect(alertas[0]).not.toContain('5531999990001');
  });

  it('eco reconhecido não gera alerta', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: 'Já envio' });
    expect(await verificarEnviadaPorMim(d, canal.interpretarWebhook(f.enviadaPorMim)!)).toBe('do-sistema');
    expect((await db.from('alertas').select('id')).data).toEqual([]);
  });

  it('número estrangeiro no eco não cria conversa', async () => {
    expect(await verificarEnviadaPorMim(d, eco('Hello', 'EXT-1', { telefone: '12025550123' }))).toBe('do-sistema');
    expect((await db.from('conversas').select('id')).data).toEqual([]);
  });
});

describe('limite de avisos do sistema no banco (3.11)', () => {
  it('sem vaga no minuto: o aviso fica pendente e vai para a fila de envio, sem esperar; a fila manda depois', async () => {
    d = { ...d, limitador: new LimitadorEnvio(1) };
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto: 'Aviso 1' });
    const id2 = await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto: 'Aviso 2' });
    // Resposta do agente não passa pelo limite.
    await enviarDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'agente', texto: 'Resposta' });
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Aviso 1', 'Resposta']);
    expect((await repos.obterMensagem(id2)).status_envio).toBe('pendente');
    expect(fila.enviados).toEqual([{ nome: FILAS.enviarMensagem, dados: { mensagemId: id2 }, opcoes: { startAfter: 60 } }]);

    // Ainda sem vaga: volta para a fila. Com vaga (minuto seguinte): sai.
    await enviarMensagemDoPainel(d, id2, false);
    expect(fila.enviados).toHaveLength(2);
    await db.from('limite_envio_sistema').delete().gte('total', 0);
    await enviarMensagemDoPainel(d, id2, false);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Aviso 1', 'Resposta', 'Aviso 2']);
    expect((await repos.obterMensagem(id2)).status_envio).toBe('enviada');
  });

  it('dois processos (dois limitadores) dividem a mesma vaga do banco', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const a = { ...d, limitador: new LimitadorEnvio(1) };
    const b = { ...d, limitador: new LimitadorEnvio(1) };
    await Promise.all([
      enviarDoSistema(a, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto: 'A' }),
      enviarDoSistema(b, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: null, autor: 'sistema', texto: 'B' }),
    ]);
    expect(canal.enviados).toHaveLength(1);
    expect(fila.enviados).toHaveLength(1);
  });
});

describe('aviso de privacidade uma vez (3.12, 4.16)', () => {
  it('duas vezes ao mesmo tempo na conversa nova: um aviso só', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const deps = { repos, envio: d };
    await Promise.all([enviarAvisoLgpd(deps, conversa, 'Aviso LGPD'), enviarAvisoLgpd(deps, conversa, 'Aviso LGPD')]);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Aviso LGPD']);
    expect((await repos.obterConversa(conversa.id)).aviso_lgpd_enviado_em).not.toBeNull();
  });

  it('envio incerto: não manda de novo na nova tentativa', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    canal.incertoDepoisDeEnviar = true;
    await enviarAvisoLgpd({ repos, envio: d }, conversa, 'Aviso LGPD');
    canal.incertoDepoisDeEnviar = false;
    await enviarAvisoLgpd({ repos, envio: d }, await repos.obterConversa(conversa.id), 'Aviso LGPD');
    expect(canal.enviados).toHaveLength(1);
  });

  it('falha certa: desmarca (a nova tentativa manda)', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    canal.falharEnvio = true;
    await expect(enviarAvisoLgpd({ repos, envio: d }, conversa, 'Aviso LGPD')).rejects.toThrow();
    expect((await repos.obterConversa(conversa.id)).aviso_lgpd_enviado_em).toBeNull();
    canal.falharEnvio = false;
    await enviarAvisoLgpd({ repos, envio: d }, conversa, 'Aviso LGPD');
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Aviso LGPD']);
  });

  it('aviso vazio: só marca', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await enviarAvisoLgpd({ repos, envio: d }, conversa, '  ');
    expect(canal.enviados).toEqual([]);
    expect((await repos.obterConversa(conversa.id)).aviso_lgpd_enviado_em).not.toBeNull();
  });
});
