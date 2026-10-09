// Revisão da Task 9 (auditoria 3.2, 3.3, 3.6): eco de arquivo sem nome igual, separação que falha depois de o texto
// sair, aviso de privacidade fora do limite, resposta do painel na fila x frase digitada no celular, alerta por conversa,
// incerta antiga que avisa a equipe, e o eco atrasado depois do "Enviar de novo".
import { createClient } from '@supabase/supabase-js';
import type { Repos } from '@escritorio/db';
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import type { MensagemRecebida } from '../src/canal/tipos';
import { LimitadorEnvio, enviarMensagemDoPainel, verificarEnviadaPorMim, type DepsEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { enviarAvisoLgpd } from '../src/processar-conversa';
import { avisarIncertosAntigos } from '../src/tarefas';
import { db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import { criarUsuarioTeste } from './apoio/usuario';
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
const ecoArquivo = (nomeArquivo: string | null, idProvedor: string, tipo: MensagemRecebida['tipo'] = 'documento') =>
  eco(null, idProvedor, { tipo, midia: { url: 'https://z-api.exemplo/a', mime: null, nomeArquivo } });

async function anexo(conversaId: string, nome: string, extra: object = {}) {
  const path = `conversas/${conversaId}/${nome}`;
  await db.storage.from('anexos').upload(path, new Uint8Array([1, 2, 3]), { contentType: 'application/pdf', upsert: true });
  const { data } = await db.from('mensagens').insert({ conversa_id: conversaId, direcao: 'saida', autor: 'atendente', tipo: 'documento',
    arquivo_path: path, arquivo_nome: nome, arquivo_mime: 'application/pdf', status_envio: 'pendente', ...extra }).select('id').single();
  return data!.id as string;
}

describe('eco de arquivo (revisão, achado importante)', () => {
  it('nome diferente (sem extensão, maiúsculas): casa e a conversa segue com o agente', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const id = await anexo(conversa.id, 'guia.pdf');
    canal.incertoDepoisDeEnviar = true;
    await enviarMensagemDoPainel(d, id, false);
    expect(await verificarEnviadaPorMim(d, ecoArquivo('GUIA', 'ECO-A'), true)).toBe('do-sistema');
    expect((await repos.obterMensagem(id)).status_envio).toBe('enviada');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
  });

  it('imagem sem nome no eco: casa com o arquivo mais antigo da conversa', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const id = await anexo(conversa.id, 'foto.jpg');
    canal.incertoDepoisDeEnviar = true;
    await enviarMensagemDoPainel(d, id, false);
    expect(await verificarEnviadaPorMim(d, ecoArquivo(null, 'ECO-IMG', 'imagem'), true)).toBe('do-sistema');
    expect((await repos.obterMensagem(id)).id_provedor).toBe('ECO-IMG');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
  });

  it('saída incerta sem arquivo conhecido conta para a espera do eco de arquivo', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const id = await repos.criarSaidaPendente({ conversaId: conversa.id, clienteId: null, autor: 'agente', conteudo: '📎 contrato.pdf' });
    await repos.marcarIncerto(id);
    expect(await verificarEnviadaPorMim(d, ecoArquivo('contrato.pdf', 'ECO-ESPERA'), true)).toBe('aguardar');
  });
});

describe('separação do texto que falha depois de o texto sair (revisão, menor 2)', () => {
  it('fica "incerto" com a reserva, sem relançar: o texto não sai de novo', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const id = await anexo(conversa.id, 'guia.pdf', { conteudo: 'Segue a guia' });
    const reposComFalha = Object.assign(Object.create(repos) as Repos, {
      separarTextoEnviado: async () => { throw new Error('banco caiu'); },
    });
    await enviarMensagemDoPainel({ ...d, repos: reposComFalha }, id, false);
    await enviarMensagemDoPainel(d, id, false);
    await enviarMensagemDoPainel(d, id, true);
    expect(canal.enviados).toEqual([{ telefone: '5531999990001', texto: 'Segue a guia' }]);
    const m = await repos.obterMensagem(id);
    expect(m.status_envio).toBe('incerto');
    expect(m.envio_reservado_em).not.toBeNull();
  });
});

describe('aviso de privacidade fora do limite de avisos (revisão, menor 3)', () => {
  it('sem vaga no minuto, o aviso sai na hora (antes da resposta), sem ir para a fila', async () => {
    d = { ...d, limitador: new LimitadorEnvio(1) };
    expect(await repos.reservarVagaEnvioSistema(1)).toBe(true);
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await enviarAvisoLgpd({ repos, envio: d }, conversa, 'Aviso LGPD');
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Aviso LGPD']);
    expect(fila.enviados).toEqual([]);
  });
});

describe('resposta do painel ainda na fila e a mesma frase no celular (revisão, menor 4)', () => {
  it('o eco não casa com a resposta que nunca foi tentada: a conversa vira humano e a resposta ainda sai', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente',
      tipo: 'texto', conteudo: 'Bom dia', status_envio: 'pendente' }).select('id').single();
    expect(await verificarEnviadaPorMim(d, eco('Bom dia', 'CEL-BD'))).toBe('humano');
    expect((await repos.obterConversa(conversa.id)).estado).toBe('humano');
    await enviarMensagemDoPainel(d, m!.id, false);
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Bom dia']);
    expect((await repos.obterMensagem(m!.id)).status_envio).toBe('enviada');
  });
});

describe('alerta da resposta pelo celular por conversa (revisão, menor 6)', () => {
  it('duas conversas com os mesmos 4 últimos dígitos: um alerta para cada uma', async () => {
    await repos.obterOuCriarConversa('5531999990001', null);
    await repos.obterOuCriarConversa('5531888880001', null);
    expect(await verificarEnviadaPorMim(d, eco('Oi', 'CEL-1'))).toBe('humano');
    expect(await verificarEnviadaPorMim(d, eco('Oi', 'CEL-2', { telefone: '5531888880001' }))).toBe('humano');
    const alertas = (await db.from('alertas').select('mensagem')).data!.map((a) => a.mensagem);
    expect(alertas).toEqual([
      'Alguém respondeu pelo celular a …0001; o agente parou nessa conversa.',
      'Alguém respondeu pelo celular a …0001; o agente parou nessa conversa.',
    ]);
  });
});

describe('incerta sem eco há 10 min (revisão, menor 7)', () => {
  it('o batimento avisa a equipe uma vez, só com os 4 últimos dígitos', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'Segue',
      status_envio: 'incerto', criado_em: new Date(Date.now() - 15 * 60_000).toISOString() });
    const avisos: { nivel: string; mensagem: string }[] = [];
    const deps = { repos, alertas: { alertar: async (a: { nivel: string; mensagem: string }) => { avisos.push(a); } } };
    await avisarIncertosAntigos(deps);
    await avisarIncertosAntigos(deps);
    expect(avisos).toEqual([{ nivel: 'aviso', mensagem: 'Mensagem para …0001 não confirmada há 10 min; confira no WhatsApp' }]);
  });
});

describe('"Enviar de novo" e o eco atrasado da primeira tentativa (revisão, menor 8)', () => {
  it('um envio só: o eco atrasado confirma a resposta e a fila não manda de novo', async () => {
    const email = 'ana-reenvio@teste.local';
    await criarUsuarioTeste({ email, nome: 'Ana', papel: 'atendente', permissoes: [], setores: ['Fiscal'] });
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
    await db.from('chamados').insert({ conversa_id: conversa.id, setor_id: setor!.id, titulo: 'Guia' });
    const { data: m } = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'atendente',
      tipo: 'texto', conteudo: 'Segue a guia', status_envio: 'pendente' }).select('id').single();
    canal.incertoDepoisDeEnviar = true;
    await enviarMensagemDoPainel(d, m!.id, false);
    canal.incertoDepoisDeEnviar = false;

    const painel = createClient(process.env.SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, { auth: { persistSession: false } });
    expect((await painel.auth.signInWithPassword({ email, password: 'Senha-teste-123' })).error).toBeNull();
    expect((await painel.rpc('reenviar_resposta', { p_mensagem: m!.id })).error).toBeNull();

    expect(await verificarEnviadaPorMim(d, eco('Segue a guia', 'ECO-PRIMEIRA'))).toBe('do-sistema');
    await enviarMensagemDoPainel(d, m!.id, false);
    expect(canal.enviados).toHaveLength(1);
    const final = await repos.obterMensagem(m!.id);
    expect([final.status_envio, final.id_provedor]).toEqual(['enviada', 'ECO-PRIMEIRA']);
    expect((await repos.obterConversa(conversa.id)).estado).toBe('agente');
  });
});
