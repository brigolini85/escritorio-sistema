import { beforeEach, describe, expect, it } from 'vitest';
import { criarClienteServico, criarRepos } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio, enviarDocumentoDoSistema, enviarDoSistema, enviarMensagemDoPainel, verificarEnviadaPorMim, type DepsEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { criarUsuarioTeste } from './apoio/usuario';
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

// Auditoria 3.11: o limitador em memória (que esperava dentro da vez) deu lugar à contagem no banco; ver envio-incerto.test.ts.

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

describe('revisão 2026-09-28 (envio pelo painel)', () => {
  async function respostaPendente(extra: object = {}) {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente',
      tipo: 'texto', conteudo: 'Segue a guia', status_envio: 'pendente', ...extra }).select().single();
    return { conversa, m: m! };
  }

  it('dois envios da mesma resposta ao mesmo tempo mandam uma vez só', async () => {
    const { m } = await respostaPendente();
    await Promise.all([enviarMensagemDoPainel(d, m.id), enviarMensagemDoPainel(d, m.id), enviarMensagemDoPainel(d, m.id)]);
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', texto: 'Segue a guia' }]);
  });

  it('texto + arquivo: o texto não é reenviado se só o arquivo falhar, e o eco do texto é reconhecido', async () => {
    const { conversa } = await respostaPendente({ conteudo: 'x' });
    await db.from('mensagens').delete().eq('conversa_id', conversa.id);
    const path = `conversas/${conversa.id}/guia.pdf`;
    await db.storage.from('anexos').upload(path, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', upsert: true });
    const { m } = await respostaPendente({ tipo: 'documento', arquivo_path: path, arquivo_nome: 'guia.pdf', arquivo_mime: 'application/pdf' });

    canal.falharArquivo = true;
    await expect(enviarMensagemDoPainel(d, m.id, false)).rejects.toThrow();
    canal.falharArquivo = false;
    await enviarMensagemDoPainel(d, m.id, true);

    expect(canal.enviados).toEqual([
      { telefone: '5531999990001', texto: 'Segue a guia' },
      { telefone: '5531999990001', arquivo: 'guia.pdf' },
    ]);
    const idTexto = 'FALSO-1';
    expect(await verificarEnviadaPorMim(d, { ...canal.interpretarWebhook(f.enviadaPorMim)!, idProvedor: idTexto, texto: 'Segue a guia' })).toBe('do-sistema');
    const { count } = await db.from('mensagens').select('*', { count: 'exact', head: true }).eq('conversa_id', conversa.id);
    expect(count).toBe(2);
  });
});

describe('arquivo vai com o conteúdo (Base64), não como link', () => {
  // A Z-API baixa o link do lado dela; um link do Supabase que ela não alcança (ex.: 127.0.0.1) some sem erro.
  it('documento da empresa enviado pela IA', async () => {
    const { data: cli } = await db.from('clientes').insert({ razao_social: 'Indústria X', cnpj: '11222333000181' }).select().single();
    const path = `clientes/${cli!.id}/contrato.pdf`;
    const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10]);
    await db.storage.from('documentos').upload(path, pdf, { contentType: 'application/pdf', upsert: true });
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    // Documento de verdade: a mensagem guarda o id dele (link auditado no painel, Parte E).
    const { data: doc } = await db.from('documentos_empresa').insert({ cliente_id: cli!.id, nome: 'Contrato social', arquivo_path: path,
      arquivo_nome: 'contrato.pdf', ia_pode_enviar: true }).select('id').single();
    await enviarDocumentoDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: cli!.id,
      documento: { id: doc!.id, nome: 'Contrato social', arquivoPath: path, arquivoNome: 'contrato.pdf', arquivoMime: 'application/pdf', iaPodeEnviar: true } });
    expect(canal.arquivosEnviados).toEqual([{ nome: 'contrato.pdf', url: `data:application/pdf;base64,${Buffer.from(pdf).toString('base64')}` }]);
  });

  it('arquivo anexado pela equipe no painel', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const path = `conversas/${conversa.id}/guia.pdf`;
    await db.storage.from('anexos').upload(path, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', upsert: true });
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente', tipo: 'documento',
      arquivo_path: path, arquivo_nome: 'guia.pdf', arquivo_mime: 'application/pdf', status_envio: 'pendente' }).select().single();
    await enviarMensagemDoPainel(d, m!.id);
    expect(canal.arquivosEnviados).toEqual([{ nome: 'guia.pdf', url: 'data:application/pdf;base64,AQID' }]);
  });

  it('revisão geral I1: caminho fora de "conversas/<id>/" não é baixado nem enviado, e a resposta fica "falhou"', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const path = 'clientes/outra-empresa/contrato.pdf';
    await db.storage.from('anexos').upload(path, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', upsert: true });
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente', tipo: 'documento',
      conteudo: 'Segue', arquivo_path: path, arquivo_nome: 'contrato.pdf', arquivo_mime: 'application/pdf', status_envio: 'pendente' }).select().single();
    await enviarMensagemDoPainel(d, m!.id);
    expect(canal.enviados).toEqual([]);
    expect((await repos.obterMensagem(m!.id)).status_envio).toBe('falhou');
  });
});

describe('auditoria 1.3 e 6.9: documento da empresa só da pasta dela e no tamanho do WhatsApp', () => {
  const docDe = (id: string, arquivoPath: string) =>
    ({ id, nome: 'Contrato social', arquivoPath, arquivoNome: 'contrato.pdf', arquivoMime: 'application/pdf', iaPodeEnviar: true });

  it('caminho fora de "clientes/<empresa>/" lança, não lê o arquivo e não envia', async () => {
    const { data: a } = await db.from('clientes').insert({ razao_social: 'Empresa A', cnpj: '11222333000181' }).select().single();
    const { data: b } = await db.from('clientes').insert({ razao_social: 'Empresa B', cnpj: '11444777000161' }).select().single();
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    let lidos = 0;
    const midia = criarArmazenamento(db);
    d.midia = { ...midia, ler: async (...args) => { lidos++; return midia.ler(...args); } };
    for (const caminho of [`clientes/${b!.id}/contrato.pdf`, `clientes/${a!.id}/../${b!.id}/contrato.pdf`, `${a!.id}/contrato.pdf`]) {
      await expect(enviarDocumentoDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: a!.id,
        documento: docDe('00000000-0000-4000-8000-000000000001', caminho) })).rejects.toThrow(/pasta da empresa/);
    }
    expect(lidos).toBe(0);
    expect(canal.arquivosEnviados).toEqual([]);
    const { count } = await db.from('mensagens').select('*', { count: 'exact', head: true }).eq('conversa_id', conversa.id);
    expect(count).toBe(0);
  });

  it('documento acima de 15 MB: recusa antes de ler, com o aviso ao agente, e não envia', async () => {
    const { data: cli } = await db.from('clientes').insert({ razao_social: 'Indústria X', cnpj: '11222333000181' }).select().single();
    const path = `clientes/${cli!.id}/grande.pdf`;
    await db.storage.from('documentos').upload(path, new Uint8Array(15 * 1024 * 1024 + 1), { contentType: 'application/pdf', upsert: true });
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    let lidos = 0;
    const midia = criarArmazenamento(db);
    d.midia = { ...midia, ler: async (...args) => { lidos++; return midia.ler(...args); } };
    await expect(enviarDocumentoDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: cli!.id,
      documento: docDe('00000000-0000-4000-8000-000000000002', path) })).rejects.toThrow('documento grande demais para o WhatsApp; abra uma demanda');
    expect(lidos).toBe(0);
    expect(canal.arquivosEnviados).toEqual([]);
    await db.storage.from('documentos').remove([path]);
  });

  it('revisão da Task 10: sem tamanho do Storage, o grande é recusado antes de criar a mensagem (nenhum "📎" falhou)', async () => {
    const { data: cli } = await db.from('clientes').insert({ razao_social: 'Indústria X', cnpj: '11222333000181' }).select().single();
    const path = `clientes/${cli!.id}/grande.pdf`;
    await db.storage.from('documentos').upload(path, new Uint8Array(15 * 1024 * 1024 + 1), { contentType: 'application/pdf', upsert: true });
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    d.midia = { ...criarArmazenamento(db), tamanho: async () => null };
    await expect(enviarDocumentoDoSistema(d, { conversaId: conversa.id, telefone: conversa.telefone, clienteId: cli!.id,
      documento: docDe('00000000-0000-4000-8000-000000000003', path) })).rejects.toThrow('documento grande demais para o WhatsApp; abra uma demanda');
    const { count } = await db.from('mensagens').select('*', { count: 'exact', head: true }).eq('conversa_id', conversa.id);
    expect(count).toBe(0);
    expect(canal.arquivosEnviados).toEqual([]);
    await db.storage.from('documentos').remove([path]);
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
  it('resposta pelo celular limpa a espera e grava o marco "assumida" uma vez só (Parte E)', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    expect(await repos.marcarAguardandoPessoa(conversa.id, 'pediu para falar com pessoa')).toBe(true);
    const msg = canal.interpretarWebhook(f.enviadaPorMim)!;
    expect(await verificarEnviadaPorMim(d, msg)).toBe('humano');
    expect(await verificarEnviadaPorMim(d, { ...msg, idProvedor: 'MSG-EU-2', texto: 'Mais uma' })).toBe('humano');
    const c = await repos.obterConversa(conversa.id);
    expect([c.estado, c.aguardando_pessoa_desde, c.motivo_pessoa]).toEqual(['humano', null, null]);
    const eventos = (await db.from('conversa_eventos').select('tipo, usuario_id').eq('conversa_id', conversa.id).order('criado_em')).data!;
    expect(eventos).toEqual([{ tipo: 'passou_para_pessoa', usuario_id: null }, { tipo: 'assumida', usuario_id: null }]);
  });
  it('resposta do assistente ao usuário da equipe não vira mensagem nem muda o estado da conversa', async () => {
    const msg = canal.interpretarWebhook(f.enviadaPorMim)!;
    await criarUsuarioTeste({ email: 'dono@teste-envio.local', permissoes: ['assistente_whatsapp'], telefone: msg.telefone });
    const conversa = await repos.obterOuCriarConversa(msg.telefone, null);
    expect(await verificarEnviadaPorMim(d, { ...msg, idProvedor: 'ASSIST-1' })).toBe('do-sistema');
    expect(await repos.mensagemPorIdProvedor('ASSIST-1')).toBeNull();
    expect(await repos.historico(conversa.id, 10)).toEqual([]);
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
  });
});
