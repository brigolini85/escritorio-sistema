// Auditoria 4.7, 4.8, 4.9, 4.13, 4.15 e 6.5: o monitoramento mostra o que importa. O batimento faz todas as recuperações
// mesmo com uma falhando e grava o sinal "fila" no fim; a falha geral da IA avisa o dono; o /saude mede mensagens atrasadas,
// envios com falha e a IA; mensagem esquecida há 24 h vira alerta diário; o job fica ligado ao turno; a limpeza registra
// o resultado e uma etapa com falha não trava as outras.
import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import type { Db, Repos } from '@escritorio/db';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { FILAS } from '../src/fila';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { MSG_IA_RECUSANDO, processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { falhaGeralIa } from '../src/agente/cliente-ia';
import { limparERegistrar } from '../src/retencao';
import { criarServidor } from '../src/servidor';
import { alertaEntradasEsquecidas, alertasPeriodicos, avisarIncertosAntigos, batimento, type DepsTarefas } from '../src/tarefas';
import { contatoComEmpresas, db, repos } from './apoio/cenario';
import { EmailFalso } from './apoio/email-falso';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from './apoio/ia-roteirizada';
import { criarUsuarioTeste } from './apoio/usuario';

let canal: CanalFalso;
let fila: FilaFalsa;
let alertados: { nivel: string; mensagem: string }[];

const minutosAtras = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

function depsTarefas(r: Repos = repos): DepsTarefas {
  return {
    repos: r, canal, email: new EmailFalso(), fila, relogio: () => new Date(),
    envio: { repos: r, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    alertas: { alertar: async (a) => { alertados.push(a); } },
  };
}

function depsProc(ia: IaRoteirizada, extra: Partial<DepsProcessamento> = {}): DepsProcessamento {
  return {
    repos, ia, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db, vi.fn()),
    transcritor: { modelo: 'w', provedor: 'groq', transcrever: vi.fn() },
    alertas: { alertar: async (a) => { alertados.push(a); } },
    relogio: () => new Date(),
    ...extra,
  };
}

async function entrada(conversaId: string, idProvedor: string, minutos = 0) {
  await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor, tipo: 'texto', conteudo: 'preciso da guia' });
  if (minutos) await db.from('mensagens').update({ criado_em: minutosAtras(minutos) }).eq('id_provedor', idProvedor);
}

const erro401 = () => new Anthropic.AuthenticationError(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } },
  undefined, new Headers());
const erroCredito = () => new Anthropic.BadRequestError(400,
  { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }, undefined, new Headers());
const semRede = () => new Anthropic.APIConnectionError({ message: 'sem rede' });
const erroImagem = () => new Anthropic.BadRequestError(400,
  { type: 'error', error: { type: 'invalid_request_error', message: 'messages.0.content.1.image.source.base64: image exceeds 5 MB maximum' } },
  undefined, new Headers());
const calar = () => vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  fila = new FilaFalsa();
  alertados = [];
});

describe('batimento (auditoria 4.7)', () => {
  it('a primeira recuperação falha: as outras rodam, o WhatsApp é conferido, o sinal "fila" é gravado no fim e o erro volta', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'P1', 10);
    const ordem: string[] = [];
    const r = {
      ...repos,
      respostasPendentesAntigas: async () => { ordem.push('painel'); throw new Error('painel caiu'); },
      tarefasParadas: async (m: number) => { ordem.push('tarefas'); return repos.tarefasParadas(m); },
      avisosTarefaParados: async () => { ordem.push('avisos'); return repos.avisosTarefaParados(); },
      conversasComMensagemParada: async (a: number, b: number) => { ordem.push('paradas'); return repos.conversasComMensagemParada(a, b); },
      registrarSinalVida: async (c: string) => { ordem.push(`sinal:${c}`); return repos.registrarSinalVida(c); },
    } as Repos;
    const erro = calar();
    await expect(batimento(depsTarefas(r))).rejects.toThrow('painel caiu');
    erro.mockRestore();
    expect(ordem).toEqual(['painel', 'tarefas', 'avisos', 'paradas', 'sinal:fila', 'sinal:whatsapp']);
    // A mensagem parada voltou à fila mesmo com a primeira recuperação caída.
    expect(fila.enviados.filter((e) => e.nome === FILAS.processarConversa)).toHaveLength(1);
    expect(Object.keys(await repos.sinaisVida()).sort()).toEqual(['fila', 'whatsapp']);
  });
});

describe('falha geral da IA (auditoria 4.8)', () => {
  it('401 em duas conversas: um alerta crítico só, o sinal ia_falha e as conversas vão à equipe', async () => {
    const a = await contatoComEmpresas(['Indústria A'], '5531999990001');
    const b = { conversa: await repos.obterOuCriarConversa('5531999990002', null) };
    await entrada(a.conversa.id, 'A1');
    await entrada(b.conversa.id, 'B1');
    const erro = calar();
    expect(await processarConversa(depsProc(new IaRoteirizada([erro401()])), a.conversa.id, false)).toBe('escalado');
    expect(await processarConversa(depsProc(new IaRoteirizada([erro401()])), b.conversa.id, false)).toBe('escalado');
    erro.mockRestore();
    expect(alertados).toEqual([{ nivel: 'critico', mensagem: MSG_IA_RECUSANDO('chave da API recusada') }]);
    expect(MSG_IA_RECUSANDO('x')).toBe('A IA está recusando os pedidos: x. As conversas estão indo para a equipe.');
    expect(Object.keys(await repos.sinaisVida())).toContain('ia_falha');
  });

  it('400 de limite de gasto da conta: alerta crítico com o motivo', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'C1');
    const erro = calar();
    await processarConversa(depsProc(new IaRoteirizada([erroCredito()])), conversa.id, false);
    erro.mockRestore();
    expect(alertados).toEqual([{ nivel: 'critico', mensagem: MSG_IA_RECUSANDO('limite de gasto da conta atingido') }]);
  });

  it('falhas de rede em 3 conversas diferentes seguidas: falha geral; com um sucesso no meio, nada', async () => {
    const conversas = [];
    for (const [i, t] of ['5531999990001', '5531999990002', '5531999990003', '5531999990004'].entries()) {
      conversas.push(i === 0 ? (await contatoComEmpresas(['Indústria X'], t)).conversa : await repos.obterOuCriarConversa(t, null));
    }
    const erro = calar();
    const falhar = async (id: string, p: string) => { await entrada(id, p); await processarConversa(depsProc(new IaRoteirizada([semRede()])), id, true); };
    await falhar(conversas[0]!.id, 'X1');
    await falhar(conversas[1]!.id, 'X2');
    // Um sucesso no meio zera a conta.
    await entrada(conversas[3]!.id, 'OK1');
    expect(await processarConversa(depsProc(new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()])), conversas[3]!.id, false)).toBe('agente');
    await falhar(conversas[2]!.id, 'X3');
    expect(alertados.filter((a) => a.nivel === 'critico').map((a) => a.mensagem)).toEqual([]);
    expect(Object.keys(await repos.sinaisVida())).not.toContain('ia_falha');
    await falhar(conversas[0]!.id, 'X4');
    await falhar(conversas[1]!.id, 'X5');
    erro.mockRestore();
    expect(alertados.filter((a) => a.nivel === 'critico')).toEqual([
      { nivel: 'critico', mensagem: MSG_IA_RECUSANDO('falhas seguidas em conversas diferentes') }]);
    expect(Object.keys(await repos.sinaisVida())).toContain('ia_falha');
  });

  // Revisão (fix round 1): só rede, 429 e 5xx contam na sequência; um 400 de uma conversa (imagem ruim, prompt longo) não.
  it('400 próprio de cada conversa em 3 conversas: não é falha geral', async () => {
    const erro = calar();
    for (const [i, t] of ['5531999990001', '5531999990002', '5531999990003'].entries()) {
      const c = await repos.obterOuCriarConversa(t, null);
      await entrada(c.id, `I${i}`);
      await processarConversa(depsProc(new IaRoteirizada([erroImagem()])), c.id, true);
    }
    erro.mockRestore();
    expect(alertados.filter((a) => a.nivel === 'critico')).toEqual([]);
    expect(Object.keys(await repos.sinaisVida())).not.toContain('ia_falha');
  });

  it('vez que para antes de chamar o modelo (tempo esgotado) não zera a sequência', async () => {
    const erro = calar();
    const falhar = async (t: string, p: string) => {
      const c = await repos.obterOuCriarConversa(t, null);
      await entrada(c.id, p);
      await processarConversa(depsProc(new IaRoteirizada([semRede()])), c.id, true);
    };
    await falhar('5531999990001', 'X1');
    await falhar('5531999990002', 'X2');
    // A vez passa do prazo logo depois de registrar o começo: o agente para sem chamar o modelo.
    const real = Date.now.bind(Date);
    let adiantar = false;
    const relogio = vi.spyOn(Date, 'now').mockImplementation(() => real() + (adiantar ? 8 * 60_000 : 0));
    const r = { ...repos, registrarDecisao: async (x: Parameters<Repos['registrarDecisao']>[0]) => {
      if (x.etapa === 'inicio_vez') adiantar = true;
      return repos.registrarDecisao(x);
    } } as Repos;
    const c = await repos.obterOuCriarConversa('5531999990004', null);
    await entrada(c.id, 'T1');
    const ia = new IaRoteirizada([]);
    expect(await processarConversa(depsProc(ia, { repos: r }), c.id, false)).toBe('escalado');
    relogio.mockRestore();
    expect(ia.recebidos).toHaveLength(0);
    await falhar('5531999990003', 'X3');
    erro.mockRestore();
    expect(alertados.filter((a) => a.nivel === 'critico').map((a) => a.mensagem)).toEqual([
      MSG_IA_RECUSANDO('falhas seguidas em conversas diferentes')]);
  });

  it('cobrança: 402, billing_error e limite de uso em outro status também são falha geral', () => {
    expect(falhaGeralIa(new Anthropic.APIError(402, { type: 'error', error: { type: 'billing_error', message: 'pagamento' } }, undefined, new Headers())))
      .toBe('limite de gasto da conta atingido');
    expect(falhaGeralIa(new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'billing_error', message: 'x' } }, undefined, new Headers())))
      .toBe('limite de gasto da conta atingido');
    expect(falhaGeralIa(new Anthropic.RateLimitError(429,
      { type: 'error', error: { type: 'rate_limit_error', message: 'You have reached your specified workspace API usage limits.' } }, undefined, new Headers())))
      .toBe('limite de gasto da conta atingido');
    expect(falhaGeralIa(erroImagem())).toBeNull();
    expect(falhaGeralIa(semRede())).toBeNull();
  });

  it('402 numa conversa: alerta crítico', async () => {
    const c = await repos.obterOuCriarConversa('5531999990001', null);
    await entrada(c.id, 'B1');
    const erro = calar();
    await processarConversa(depsProc(new IaRoteirizada([
      new Anthropic.APIError(402, { type: 'error', error: { type: 'billing_error', message: 'pagamento' } }, undefined, new Headers())])), c.id, false);
    erro.mockRestore();
    expect(alertados).toEqual([{ nivel: 'critico', mensagem: MSG_IA_RECUSANDO('limite de gasto da conta atingido') }]);
  });

  it('janela de 60 min (não a hora do relógio): 59 min depois não repete; 61 min depois, sim', async () => {
    const erro = calar();
    const falhar401 = async (t: string, p: string) => {
      const c = await repos.obterOuCriarConversa(t, null);
      await entrada(c.id, p);
      await processarConversa(depsProc(new IaRoteirizada([erro401()])), c.id, false);
    };
    await falhar401('5531999990001', 'K1');
    await db.from('avisos_unicos').update({ criado_em: minutosAtras(59) }).like('chave', 'ia-falha%');
    await falhar401('5531999990002', 'K2');
    expect(alertados).toHaveLength(1);
    await db.from('avisos_unicos').update({ criado_em: minutosAtras(61) }).like('chave', 'ia-falha%');
    await falhar401('5531999990003', 'K3');
    erro.mockRestore();
    expect(alertados).toHaveLength(2);
  });

  it('o alerta falhou: a marca é desfeita e a próxima falha avisa', async () => {
    const erro = calar();
    let falhaAlerta = true;
    const alertas = { alertar: async (a: { nivel: 'critico' | 'operacional' | 'aviso'; mensagem: string }) => {
      if (falhaAlerta) throw new Error('e-mail fora');
      alertados.push(a);
    } };
    for (const [i, t] of ['5531999990001', '5531999990002'].entries()) {
      const c = await repos.obterOuCriarConversa(t, null);
      await entrada(c.id, `L${i}`);
      await processarConversa(depsProc(new IaRoteirizada([erro401()]), { alertas }), c.id, false);
      falhaAlerta = false;
    }
    erro.mockRestore();
    expect(alertados).toEqual([{ nivel: 'critico', mensagem: MSG_IA_RECUSANDO('chave da API recusada') }]);
  });
});

describe('/saude (auditoria 4.9)', () => {
  const app = () => criarServidor({ canal: new CanalFalso(), repos, fila: new FilaFalsa(), segredo: 'segredo-com-16-caracteres',
    relogio: () => new Date(), saudeToken: 'tok-123' });
  const detalhe = async () => {
    const r = await app().inject({ url: '/saude', headers: { 'x-saude-token': 'tok-123' } });
    return { status: r.statusCode, corpo: r.json() };
  };
  beforeEach(async () => {
    await repos.registrarSinalVida('fila');
    await repos.registrarSinalVida('whatsapp');
  });

  it('mensagem de cliente parada há 6 min: 503 com conversas_atrasadas; sem token, só o ok', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'P1', 2);
    expect((await detalhe()).status).toBe(200);
    await entrada(conversa.id, 'P2', 6);
    const r = await detalhe();
    expect(r.status).toBe(503);
    expect(r.corpo.falhas).toEqual(['conversas_atrasadas']);
    expect(r.corpo.indicadores).toEqual({ conversas_atrasadas: 1, envios_com_falha: 0 });
    const semToken = await app().inject({ url: '/saude' });
    expect(semToken.statusCode).toBe(503);
    expect(semToken.json()).toEqual({ ok: false });
  });

  it('conversa com pessoa (atendente assumiu ou esperando pessoa) não conta', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'P1', 20);
    await db.from('conversas').update({ estado: 'humano' }).eq('id', conversa.id);
    expect((await detalhe()).status).toBe(200);
    await db.from('conversas').update({ estado: 'agente', aguardando_pessoa_desde: new Date().toISOString() }).eq('id', conversa.id);
    expect((await detalhe()).status).toBe(200);
  });

  // Revisão (fix round 1): conta conversas, não mensagens: um número ruim com novas tentativas não segura o 503 por horas.
  it('envios com falha ou incertos na última hora em mais de 5 conversas: 503 com envios_com_falha', async () => {
    const saida = async (telefone: string, status: 'falhou' | 'incerto') => {
      const conversa = await repos.obterOuCriarConversa(telefone, null);
      const r = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'x', status_envio: status });
      expect(r.error).toBeNull();
    };
    for (let i = 0; i < 3; i++) await saida(`553199999001${i}`, 'falhou');
    for (let i = 3; i < 5; i++) await saida(`553199999001${i}`, 'incerto');
    expect((await detalhe()).status).toBe(200);
    await saida('5531999990015', 'falhou');
    const r = await detalhe();
    expect(r.status).toBe(503);
    expect(r.corpo.falhas).toEqual(['envios_com_falha']);
    expect(r.corpo.indicadores.envios_com_falha).toBe(6);
  });

  it('6 falhas numa conversa só: 200', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990009', null);
    for (let i = 0; i < 6; i++) {
      const r = await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'x', status_envio: 'falhou' });
      expect(r.error).toBeNull();
    }
    const r = await detalhe();
    expect(r.status).toBe(200);
    expect(r.corpo.indicadores.envios_com_falha).toBe(1);
  });

  it('IA com falha geral nos últimos 15 min: 503 com ia', async () => {
    await repos.registrarSinalVida('ia_falha');
    const r = await detalhe();
    expect(r.status).toBe(503);
    expect(r.corpo.falhas).toEqual(['ia']);
    await db.from('sinais_vida').update({ visto_em: minutosAtras(16) }).eq('componente', 'ia_falha');
    expect((await detalhe()).status).toBe(200);
  });
});

describe('mensagem esquecida há mais de 24 h (auditoria 4.13)', () => {
  it('alerta diário ao dono com a quantidade, uma vez por dia; sem telefone no texto', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'E1', 25 * 60);
    await entrada(conversa.id, 'E2', 26 * 60);
    await alertasPeriodicos(depsTarefas(), [alertaEntradasEsquecidas]);
    await alertasPeriodicos(depsTarefas(), [alertaEntradasEsquecidas]);
    expect(alertados).toEqual([{ nivel: 'operacional',
      mensagem: '2 mensagens de cliente estão sem resposta há mais de 24 h. Abra o Atendimento e assuma essas conversas.' }]);
  });
  it('o alerta falhou: a marca do dia é desfeita e a próxima rodada avisa', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'E1', 25 * 60);
    const d = depsTarefas();
    const alertar = d.alertas.alertar;
    d.alertas = { alertar: async () => { throw new Error('e-mail fora'); } };
    await expect(alertaEntradasEsquecidas(d)).rejects.toThrow('e-mail fora');
    d.alertas = { alertar };
    await alertaEntradasEsquecidas(d);
    expect(alertados).toHaveLength(1);
  });

  it('sem mensagem esquecida: nada', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'E1', 60);
    expect(await alertaEntradasEsquecidas(depsTarefas())).toBe(0);
    expect(alertados).toEqual([]);
  });
});

describe('rastreio do job ao turno (auditoria 4.15)', () => {
  it('a vez grava inicio_vez com o job e o turno; uso_ia e a resposta levam o mesmo turno', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await entrada(conversa.id, 'T1');
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);
    expect(await processarConversa(depsProc(ia, { jobId: 'job-123' }), conversa.id, false)).toBe('agente');
    const { data: inicio } = await db.from('decisoes_agente').select('entrada').eq('conversa_id', conversa.id).eq('etapa', 'inicio_vez').single();
    const { turno, job_id: jobId } = inicio!.entrada as { turno: string; job_id: string };
    expect(jobId).toBe('job-123');
    const { data: usos } = await db.from('uso_ia').select('turno').eq('conversa_id', conversa.id);
    expect(usos!.length).toBeGreaterThan(0);
    expect(usos!.every((u) => u.turno === turno)).toBe(true);
    const { data: saida } = await db.from('mensagens').select('turno_agente').eq('conversa_id', conversa.id).eq('autor', 'agente').single();
    expect(saida!.turno_agente).toBe(turno);
  });
});

describe('limpeza diária (auditoria 6.5)', () => {
  /** O banco de verdade, com a etapa das decisões (a 2ª) falhando. */
  function dbComFalhaNasDecisoes(): Db {
    return new Proxy(db, {
      get(alvo, p, rec) {
        if (p === 'from') return (t: string) => (t === 'decisoes_agente' ? { delete: () => { throw new Error('decisões fora'); } } : alvo.from(t as never));
        return Reflect.get(alvo, p, rec);
      },
    }) as Db;
  }

  it('a etapa 2 falha: a 3 roda, o resultado fica em alertas (operacional) e sai um alerta crítico; o job falha', async () => {
    const id = await criarUsuarioTeste({ email: 'dono@teste-limpeza.local' });
    await db.from('assistente_mensagens').insert({ usuario_id: id, canal: 'site', papel: 'usuario', conteudo: 'antiga', criado_em: '2024-01-01T00:00:00Z' });
    const criticos: string[] = [];
    const alertas = { alertar: async (a: { nivel: string; mensagem: string }) => { if (a.nivel === 'critico') criticos.push(a.mensagem); } };
    const erro = calar();
    await expect(limparERegistrar({ db: dbComFalhaNasDecisoes(), midia: criarArmazenamento(db), repos, alertas }, new Date('2026-09-29T12:00:00Z')))
      .rejects.toThrow(/decisões fora/);
    erro.mockRestore();
    expect((await db.from('assistente_mensagens').select('conteudo')).data).toEqual([]);
    const { data: linhas } = await db.from('alertas').select('nivel, mensagem').eq('nivel', 'operacional');
    expect(linhas).toHaveLength(1);
    expect(linhas![0]!.mensagem).toMatch(/^Limpeza diária com falha/);
    expect(linhas![0]!.mensagem).toContain('decisoes');
    expect(linhas![0]!.mensagem).toContain('assistente: 1');
    expect(criticos).toHaveLength(1);
    expect(criticos[0]).toContain('limpeza diária');
  });

  it('o alerta crítico falhou: a marca do dia é desfeita e a nova tentativa do job avisa', async () => {
    let falhaAlerta = true;
    const criticos: string[] = [];
    const alertas = { alertar: async (a: { nivel: string; mensagem: string }) => {
      if (falhaAlerta) throw new Error('e-mail fora');
      if (a.nivel === 'critico') criticos.push(a.mensagem);
    } };
    const erro = calar();
    const agora = new Date('2026-09-29T12:00:00Z');
    await expect(limparERegistrar({ db: dbComFalhaNasDecisoes(), midia: criarArmazenamento(db), repos, alertas }, agora)).rejects.toThrow();
    falhaAlerta = false;
    await expect(limparERegistrar({ db: dbComFalhaNasDecisoes(), midia: criarArmazenamento(db), repos, alertas }, agora)).rejects.toThrow();
    erro.mockRestore();
    expect(criticos).toHaveLength(1);
  });

  it('tudo certo: o resultado com as contagens fica em alertas (operacional), sem alerta crítico', async () => {
    const criticos: string[] = [];
    const alertas = { alertar: async (a: { nivel: string; mensagem: string }) => { if (a.nivel === 'critico') criticos.push(a.mensagem); } };
    const r = await limparERegistrar({ db, midia: criarArmazenamento(db), repos, alertas });
    expect(r.mensagens).toBe(0);
    const { data: linhas } = await db.from('alertas').select('nivel, mensagem');
    expect(linhas).toEqual([{ nivel: 'operacional',
      // Auditoria 6.3 (Task 15): as etapas novas entram na contagem.
      mensagem: 'Limpeza diária feita: mensagens: 0, arquivos: 0, decisoes: 0, assistente: 0, simulacoes: 0, sugestoes: 0, '
        + 'conversas: 0, eventosConversa: 0, demandas: 0, alertas: 0, auditoria: 0, foraDoAcesso: 0, radar: 0.' }]);
    expect(criticos).toEqual([]);
  });
});

describe('mensagem incerta sem eco (Task 9, revisão desta task)', () => {
  it('o aviso falhou: a marca é desfeita e o próximo batimento avisa', async () => {
    const conversa = await repos.obterOuCriarConversa('5531999990001', null);
    await db.from('mensagens').insert({ conversa_id: conversa.id, direcao: 'saida', autor: 'agente', tipo: 'texto', conteudo: 'Segue',
      status_envio: 'incerto', criado_em: minutosAtras(15) });
    const erro = calar();
    await expect(avisarIncertosAntigos({ repos, alertas: { alertar: async () => { throw new Error('painel fora'); } } })).rejects.toThrow('painel fora');
    erro.mockRestore();
    const avisos: string[] = [];
    await avisarIncertosAntigos({ repos, alertas: { alertar: async (a) => { avisos.push(a.mensagem); } } });
    await avisarIncertosAntigos({ repos, alertas: { alertar: async (a) => { avisos.push(a.mensagem); } } });
    expect(avisos).toEqual(['Mensagem para …0001 não confirmada há 10 min; confira no WhatsApp']);
  });
});
