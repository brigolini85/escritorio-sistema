// Auditoria 4.2, 4.5, 4.11, 4.12, 5.2 e 5.7 (decisão D2): limite diário de IA por telefone, limites do lote e da
// transcrição, parada entre rodadas e o alerta de 80% do mês uma vez só.
import { MOTIVOS_PASSAGEM, mesReferencia, motivoDaEscalada } from '@escritorio/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { criarAlertas } from '../src/alertas';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { conferirAlertaIa80, processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { alertasPeriodicos } from '../src/tarefas';
import { contatoComEmpresas, db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from './apoio/ia-roteirizada';

const DESCONHECIDO = '5531988887777';
let canal: CanalFalso;
let alertas: { nivel: string; mensagem: string }[];

const imagem = () => new Response(new Uint8Array([9, 9, 9]), { headers: { 'content-type': 'image/jpeg' } });
function deps(ia: IaRoteirizada, extra: Partial<DepsProcessamento> = {}): DepsProcessamento {
  return {
    repos, ia, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db, vi.fn().mockImplementation(async () => imagem())),
    transcritor: { modelo: 'whisper-large-v3-turbo', provedor: 'groq', transcrever: vi.fn().mockResolvedValue({ texto: 'oi', segundos: 3 }) },
    alertas: { alertar: async (a) => { alertas.push(a); } },
    // O banco soma o dia e o mês pelo relógio dele: o teste usa o mesmo.
    relogio: () => new Date(),
    ...extra,
  };
}
const respondeOi = () => new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
async function conversaDesconhecida() {
  const c = await repos.obterOuCriarConversa(DESCONHECIDO, null);
  await repos.atualizarConversa(c.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
  return c;
}
async function gastoHoje(conversaId: string, custoUsd: number) {
  await repos.registrarUsoIa({ funcionalidade: 'agente_clientes', usuarioId: null, conversaId, clienteId: null, modelo: 'claude-sonnet-5',
    tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd });
}
async function receber(conversaId: string, idProvedor: string, conteudo: string, extra: { tipo?: 'texto' | 'imagem' | 'audio'; nome?: string } = {}) {
  const tipo = extra.tipo ?? 'texto';
  await repos.inserirMensagemEntrada({
    conversaId, clienteId: null, idProvedor, tipo, conteudo,
    midiaUrlOrigem: tipo === 'texto' ? null : `https://f004.backblazeb2.com/${idProvedor}`,
    arquivoMime: tipo === 'imagem' ? 'image/jpeg' : tipo === 'audio' ? 'audio/ogg' : null, arquivoNome: extra.nome ?? null,
  });
}
const textoDoPedido = (ia: IaRoteirizada, i = 0) => (ia.recebidos[i]!.messages[0]!.content as { type: string; text?: string }[])[0]!.text!;
const blocos = (ia: IaRoteirizada, tipo: string, i = 0) => (ia.recebidos[i]!.messages[0]!.content as { type: string }[]).filter((b) => b.type === tipo);

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  alertas = [];
});

describe('limite diário de IA por telefone (D2, auditoria 4.2 e 5.2)', () => {
  it('número desconhecido com US$ 0,31 hoje: passa à equipe sem chamar a IA nem falar com o cliente, e avisa o dono uma vez', async () => {
    const c = await conversaDesconhecida();
    await gastoHoje(c.id, 0.31);
    await receber(c.id, 'M1', 'oi');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), c.id, false)).toBe('limite');
    expect(ia.recebidos).toHaveLength(0);
    expect(canal.enviados).toEqual([]);
    expect((await repos.obterConversa(c.id)).motivo_pessoa).toBe(MOTIVOS_PASSAGEM.limiteDia);
    expect((await db.from('chamados').select('setor_id').eq('conversa_id', c.id)).data).toEqual([{ setor_id: null }]);
    expect(await repos.mensagensNaoProcessadas(c.id)).toHaveLength(0);
    const aviso = 'O número …7777 passou do limite diário de IA e foi passado à equipe.';
    expect(alertas).toEqual([{ nivel: 'operacional', mensagem: aviso }]);
    await receber(c.id, 'M2', 'alô?');
    expect(await processarConversa(deps(respondeOi()), c.id, false)).toBe('limite');
    expect(alertas).toHaveLength(1);
  });

  it('revisão: dois números com o mesmo final no mesmo dia geram um aviso cada', async () => {
    const outro = await repos.obterOuCriarConversa('5531966667777', null);
    await repos.atualizarConversa(outro.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    const c = await conversaDesconhecida();
    for (const [conv, id] of [[c, 'M1'], [outro, 'M2']] as const) {
      await gastoHoje(conv.id, 0.31);
      await receber(conv.id, id, 'oi');
      expect(await processarConversa(deps(respondeOi()), conv.id, false)).toBe('limite');
    }
    expect(alertas).toHaveLength(2);
  });

  it('revisão: número acima do limite manda áudio; o transcritor não é chamado e o arquivo fica salvo', async () => {
    const c = await conversaDesconhecida();
    await gastoHoje(c.id, 0.31);
    await receber(c.id, 'A1', '', { tipo: 'audio' });
    await receber(c.id, 'IMG1', '', { tipo: 'imagem', nome: 'foto.jpg' });
    const transcritor = { modelo: 'w', provedor: 'groq' as const, transcrever: vi.fn().mockResolvedValue({ texto: 'oi', segundos: 3 }) };
    expect(await processarConversa(deps(respondeOi(), { transcritor }), c.id, false)).toBe('limite');
    expect(transcritor.transcrever).not.toHaveBeenCalled();
    const { data } = await db.from('mensagens').select('id_provedor, transcricao, arquivo_path').in('id_provedor', ['A1', 'IMG1']).order('id_provedor');
    expect(data).toEqual([
      { id_provedor: 'A1', transcricao: '[áudio não transcrito: limite diário]', arquivo_path: expect.stringMatching(/^conversas\//) },
      { id_provedor: 'IMG1', transcricao: null, arquivo_path: expect.stringMatching(/^conversas\//) },
    ]);
  });

  it('contato cadastrado com US$ 0,31 hoje: atende (o limite dele é US$ 2,00)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await gastoHoje(conversa.id, 0.31);
    await receber(conversa.id, 'M1', 'oi');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('agente');
    expect(ia.recebidos.length).toBeGreaterThan(0);
  });

  it('Review Focus 5: desconhecido com US$ 0,40 que vira contato no meio do dia passa a ter o limite maior', async () => {
    const c = await conversaDesconhecida();
    await gastoHoje(c.id, 0.40);
    await receber(c.id, 'M1', 'oi');
    expect(await processarConversa(deps(respondeOi()), c.id, false)).toBe('limite');
    // A equipe cadastra o número e devolve a conversa ao agente.
    const { data: empresa } = await db.from('clientes').insert({ razao_social: 'Empresa Nova', cnpj: '11222333000181' }).select().single();
    const { data: contato } = await db.from('contatos').insert({ nome: 'Ana', telefone: DESCONHECIDO }).select().single();
    await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: empresa!.id });
    await db.from('conversas').update({ contato_id: contato!.id, estado: 'agente' }).eq('id', c.id);
    await receber(c.id, 'M2', 'sou a Ana, da Empresa Nova');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), c.id, false)).toBe('agente');
    expect(ia.recebidos.length).toBeGreaterThan(0);
  });

  it('auditoria 4.11: passou do limite no meio da vez, não abre rodada nova e passa à equipe', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    // Qualquer rodada custa mais que isto.
    await db.from('configuracoes').update({ limite_dia_contato_usd: 0.000001 }).eq('id', 1);
    await receber(conversa.id, 'M1', 'oi');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('escalado');
    expect(ia.recebidos).toHaveLength(1);
    expect((await repos.obterConversa(conversa.id)).motivo_pessoa).toBe(motivoDaEscalada('limite de custo'));
    expect(motivoDaEscalada('limite de custo')).not.toBe(motivoDaEscalada('desconhecido'));
  });

  it('auditoria 4.11: o teto do mês atingido no meio da vez também para entre as rodadas', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    // O teto guarda 2 casas: o mês fica a um milionésimo dele (gasto sem conversa: não conta no limite do número).
    await db.from('configuracoes').update({ teto_ia_usd: 1 }).eq('id', 1);
    await repos.registrarUsoIa({ funcionalidade: 'assistente_whatsapp', usuarioId: null, conversaId: null, clienteId: null, modelo: 'claude-sonnet-5',
      tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.999999 });
    await receber(conversa.id, 'M1', 'oi');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('escalado');
    expect(ia.recebidos).toHaveLength(1);
  });
});

describe('limites do lote (auditoria 4.5 e 5.2)', () => {
  it('7 imagens de uma vez: o modelo recebe 5 e o texto avisa das outras', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    for (let i = 1; i <= 7; i++) await receber(conversa.id, `IMG${i}`, '', { tipo: 'imagem', nome: `foto${i}.jpg` });
    const ia = respondeOi();
    await processarConversa(deps(ia), conversa.id, false);
    expect(blocos(ia, 'image')).toHaveLength(5);
    expect(textoDoPedido(ia).match(/\[anexo não aberto: muitos arquivos de uma vez\]/g)).toHaveLength(2);
  });

  it('texto das mensagens novas cortado em 8.000 caracteres: fica o fim (a mensagem mais nova)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1', 'a'.repeat(6000));
    await receber(conversa.id, 'M2', 'b'.repeat(6000));
    const ia = respondeOi();
    await processarConversa(deps(ia), conversa.id, false);
    const novas = textoDoPedido(ia).split('<mensagens_do_cliente>\n')[1]!.split('\n</mensagens_do_cliente>')[0]!;
    expect(novas.length).toBe('[início cortado]\n'.length + 8000);
    expect(novas.startsWith('[início cortado]\n')).toBe(true);
    expect(novas.endsWith('b'.repeat(6000))).toBe(true);
  });

  it('imagem de uma vez anterior não vai de novo ao modelo: no histórico só o nome', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'IMG1', 'segue', { tipo: 'imagem', nome: 'pedido.jpg' });
    await processarConversa(deps(respondeOi()), conversa.id, false);
    await receber(conversa.id, 'M2', 'viu?');
    const ia = respondeOi();
    await processarConversa(deps(ia), conversa.id, false);
    expect(blocos(ia, 'image')).toHaveLength(0);
    expect(textoDoPedido(ia)).toContain('[imagem enviada antes: pedido.jpg]');
  });
});

describe('transcrição (auditoria 5.7)', () => {
  it('transcrição de 10.000 caracteres é gravada com 4.000 e o aviso', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'A1', '', { tipo: 'audio' });
    const transcritor = { modelo: 'w', provedor: 'groq' as const, transcrever: vi.fn().mockResolvedValue({ texto: 'x'.repeat(10_000), segundos: 60 }) };
    const audio = vi.fn().mockImplementation(async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/ogg' } }));
    await processarConversa(deps(respondeOi(), { transcritor, midia: criarArmazenamento(db, audio) }), conversa.id, false);
    const { data } = await db.from('mensagens').select('transcricao').eq('id_provedor', 'A1').single();
    expect(data!.transcricao).toBe(`${'x'.repeat(4000)} [áudio longo: transcrição cortada]`);
  });

  it('áudio acima de 10 MB nem vai ao transcritor', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'A1', '', { tipo: 'audio' });
    const transcritor = { modelo: 'w', provedor: 'groq' as const, transcrever: vi.fn().mockResolvedValue({ texto: 'oi', segundos: 1 }) };
    const grande = vi.fn().mockImplementation(async () => new Response(new Uint8Array(11 * 1024 * 1024), { headers: { 'content-type': 'audio/mpeg' } }));
    await processarConversa(deps(respondeOi(), { transcritor, midia: criarArmazenamento(db, grande) }), conversa.id, false);
    expect(transcritor.transcrever).not.toHaveBeenCalled();
    const { data } = await db.from('mensagens').select('transcricao').eq('id_provedor', 'A1').single();
    expect(data!.transcricao).toBe('[áudio longo demais: não foi transcrito]');
  });
});

describe('alerta de 80% do mês (auditoria 4.12)', () => {
  it('duas chamadas simultâneas: um só alerta', async () => {
    await db.from('configuracoes').update({ teto_ia_usd: 1 }).eq('id', 1);
    await gastoHoje((await conversaDesconhecida()).id, 0.81);
    const d = deps(respondeOi());
    await Promise.all([conferirAlertaIa80(d), conferirAlertaIa80(d)]);
    expect(alertas.filter((a) => a.mensagem.includes('80%'))).toHaveLength(1);
  });

  it('a soma cobre todas as funcionalidades: gasto só do assistente dispara pelo batimento', async () => {
    await db.from('configuracoes').update({ teto_ia_usd: 1 }).eq('id', 1);
    await repos.registrarUsoIa({ funcionalidade: 'assistente_whatsapp', usuarioId: null, conversaId: null, clienteId: null, modelo: 'claude-sonnet-5',
      tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd: 0.9 });
    const d = deps(respondeOi());
    await alertasPeriodicos({ ...d, canal, email: { enviar: async () => {} } });
    expect(alertas.filter((a) => a.mensagem.includes('80%'))).toHaveLength(1);
  });

  it('canais falhando: registra no painel uma vez só, tenta de novo depois de 1 h e só então marca o mês', async () => {
    await db.from('configuracoes').update({ teto_ia_usd: 1, email_alertas: 'dono@t.local' }).eq('id', 1);
    await gastoHoje((await conversaDesconhecida()).id, 0.81);
    const email = { enviar: vi.fn().mockRejectedValue(new Error('smtp fora')) };
    const d = deps(respondeOi());
    const reais = criarAlertas({ repos, email, envio: d.envio });
    const mes = mesReferencia(new Date());
    const linhas80 = async () => (await db.from('alertas').select('id').like('mensagem', '%80%')).data!.length;
    await conferirAlertaIa80({ ...d, alertas: reais });
    expect((await repos.obterConfiguracoes()).alertaIa80Mes).not.toBe(mes);
    // Logo depois (outro atendimento, outro batimento): nem tenta, nem grava outra linha.
    await conferirAlertaIa80({ ...d, alertas: reais });
    expect(email.enviar).toHaveBeenCalledTimes(1);
    expect(await linhas80()).toBe(1);
    // Passada 1 h, tenta de novo; o e-mail volta, o mês fica marcado e o painel continua com uma linha.
    email.enviar.mockResolvedValue(undefined);
    const depois = { ...d, alertas: reais, relogio: () => new Date(Date.now() + 61 * 60_000) };
    await conferirAlertaIa80(depois);
    expect(email.enviar).toHaveBeenCalledTimes(2);
    expect((await repos.obterConfiguracoes()).alertaIa80Mes).toBe(mesReferencia(depois.relogio()));
    expect(await linhas80()).toBe(1);
    await db.from('configuracoes').update({ email_alertas: null }).eq('id', 1);
  });
});
