// Auditoria 4.3: um trabalhador só, com o ambiente certo. A partida confere o AMBIENTE do processo contra o do banco; o
// batimento de cada processo registra a instância e, com outra viva de versão ou ambiente diferente, a de build mais antigo
// sai das filas (e volta se a outra sumir).
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { ligarConsumidores } from '../src/consumidores';
import { FILAS } from '../src/fila';
import { iniciarConsumo } from '../src/iniciar';
import {
  batimentoInstancia, falhasDaInstancia, lerBuild, mensagemAmbienteErrado, novoEstadoInstancia, partida, situacaoDoProcesso, type Instancia,
} from '../src/instancia';
import { criarServidor } from '../src/servidor';
import { db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';

type Alerta = { nivel: string; mensagem: string };
function alertasFalsos() {
  const lista: Alerta[] = [];
  return {
    lista,
    // Como o de verdade: registra no banco (o alertaRecente da deduplicação lê de lá).
    alertas: { alertar: async (a: Alerta) => { lista.push(a); await repos.registrarAlerta(a as never); } },
  };
}
const bossFalso = () => ({
  work: vi.fn(async (..._a: unknown[]) => 'id'), schedule: vi.fn(async (..._a: unknown[]) => {}), offWork: vi.fn(async (..._a: unknown[]) => {}),
});
const instancia = (hostname: string, versao: string, buildEm: string | null = null, ambiente = 'local'): Instancia =>
  ({ id: randomUUID(), hostname, ambiente, versao, buildEm });
const semAcao = { pararDeConsumir: async () => {}, voltarAConsumir: async () => {} };
const calar = () => vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(async () => {
  await limparBanco();
});

describe('partida: AMBIENTE do processo contra o do banco', () => {
  it('banco sem ambiente: a primeira partida grava o seu e liga os consumidores', async () => {
    const boss = bossFalso();
    const { alertas, lista } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const ok = await partida({ repos, alertas, ambiente: 'local', estado, ligar: () => ligarConsumidores(boss as never, {} as never) });
    expect(ok).toBe(true);
    expect(boss.work.mock.calls.map((c) => c[0])).toContain(FILAS.processarConversa);
    const { data } = await db.from('configuracoes').select('ambiente').eq('id', 1).single();
    expect(data!.ambiente).toBe('local');
    expect(lista).toEqual([]);
    expect(falhasDaInstancia(estado)).toEqual([]);
  });

  it('AMBIENTE diferente do banco: não chama boss.work, alerta crítico ao dono e o /saude falha com "ambiente"', async () => {
    await repos.ambienteDoBanco('producao');
    const boss = bossFalso();
    const { alertas, lista } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const erro = calar();
    const ok = await partida({ repos, alertas, ambiente: 'homologacao', estado, ligar: () => ligarConsumidores(boss as never, {} as never) });
    expect(ok).toBe(false);
    expect(boss.work).not.toHaveBeenCalled();
    expect(boss.schedule).not.toHaveBeenCalled();
    expect(lista).toEqual([{ nivel: 'critico', mensagem: mensagemAmbienteErrado('homologacao', 'producao') }]);
    expect(mensagemAmbienteErrado('homologacao', 'producao'))
      .toBe('O trabalhador foi iniciado com AMBIENTE=homologacao, mas este banco é de producao. Ele não vai atender.');
    expect(falhasDaInstancia(estado)).toEqual(['ambiente']);
    const { data } = await db.from('configuracoes').select('ambiente').eq('id', 1).single();
    expect(data!.ambiente).toBe('producao');
    // Reiniciando em laço: o alerta sai uma vez por hora.
    await partida({ repos, alertas, ambiente: 'homologacao', estado: novoEstadoInstancia(), ligar: async () => {} });
    erro.mockRestore();
    expect(lista).toHaveLength(1);
  });
});

describe('registrarInstancia (banco local)', () => {
  it('duas instâncias com versões diferentes: a de build mais antigo recebe deveParar = true; a nova, false', async () => {
    const antiga = instancia('antigo', 'v1', '2026-10-01T10:00:00Z');
    const nova = instancia('novo', 'v2', '2026-10-02T10:00:00Z');
    expect((await repos.registrarInstancia(antiga)).outras).toEqual([]);
    const rNova = await repos.registrarInstancia(nova);
    expect(rNova.deveParar).toBe(false);
    expect(rNova.outras.map((o) => o.hostname)).toEqual(['antigo']);
    const rAntiga = await repos.registrarInstancia(antiga);
    expect(rAntiga.deveParar).toBe(true);
    expect(rAntiga.todas.map((t) => [t.hostname, t.para])).toEqual([['antigo', true], ['novo', false]]);
  });
  it('contêiner antigo que reinicia depois (processo mais novo, build mais antigo): é ele que para, não o novo', async () => {
    const nova = instancia('novo', 'v2', '2026-10-02T10:00:00Z');
    const antigaReiniciada = instancia('antigo', 'v1', '2026-10-01T10:00:00Z');
    await repos.registrarInstancia(nova);
    expect((await repos.registrarInstancia(antigaReiniciada)).deveParar).toBe(true);
    expect((await repos.registrarInstancia(nova)).deveParar).toBe(false);
  });
  it('no desligamento, a instância sai da lista', async () => {
    const a = instancia('a', 'v1');
    const b = instancia('b', 'v1');
    await repos.registrarInstancia(a);
    await repos.removerInstancia(a.id);
    expect((await repos.registrarInstancia(b)).outras).toEqual([]);
  });
});

describe('batimentoInstancia', () => {
  it('a de build antigo para uma vez só; o alerta sai só no segundo batimento seguido, uma vez por hora, dizendo quem ficou', async () => {
    const antiga = instancia('antigo', 'v1', '2026-10-01T10:00:00Z');
    const nova = instancia('novo', 'v2', '2026-10-02T10:00:00Z');
    const { alertas, lista } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const parar = vi.fn(async () => {});
    const erro = calar();
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, pararDeConsumir: parar });
    expect(parar).not.toHaveBeenCalled();
    expect(falhasDaInstancia(estado)).toEqual([]);

    await repos.registrarInstancia(nova);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, pararDeConsumir: parar });
    expect(parar).toHaveBeenCalledTimes(1);
    // Parada: o /saude diz (senão ficaria 200 sem atender ninguém).
    expect(falhasDaInstancia(estado)).toEqual(['instancias', 'parado']);
    // Implantação normal: a sobreposição de um batimento não acorda o dono.
    expect(lista).toEqual([]);

    await repos.registrarInstancia(nova);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, pararDeConsumir: parar });
    expect(parar).toHaveBeenCalledTimes(1);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.nivel).toBe('critico');
    expect(lista[0]!.mensagem).toContain('Continua atendendo: novo (versão v2, build 2026-10-02');
    expect(lista[0]!.mensagem).toContain('Parou de atender: antigo (versão v1, build 2026-10-01');

    // A nova vê a mesma situação: a mesma mensagem (um alerta só por hora, não um de cada).
    const deNova = alertasFalsos();
    const estadoNova = novoEstadoInstancia();
    await batimentoInstancia({ repos, alertas: deNova.alertas, eu: nova, estado: estadoNova, ...semAcao });
    await batimentoInstancia({ repos, alertas: deNova.alertas, eu: nova, estado: estadoNova, ...semAcao });
    expect(deNova.lista).toEqual([]);

    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, pararDeConsumir: parar });
    expect(lista).toHaveLength(1);
    erro.mockRestore();
  });

  it('a nova some: depois de dois batimentos sem motivo, a parada volta a consumir uma vez e avisa', async () => {
    const antiga = instancia('antigo', 'v1', '2026-10-01T10:00:00Z');
    const nova = instancia('novo', 'v2', '2026-10-02T10:00:00Z');
    const { alertas, lista } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const voltar = vi.fn(async () => {});
    const erro = calar();
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await repos.registrarInstancia(nova);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, voltarAConsumir: voltar });
    expect(estado.parado).toBe(true);
    await repos.removerInstancia(nova.id);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, voltarAConsumir: voltar });
    expect(voltar).not.toHaveBeenCalled();
    expect(falhasDaInstancia(estado)).toEqual(['parado']);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, voltarAConsumir: voltar });
    expect(voltar).toHaveBeenCalledTimes(1);
    expect(estado.parado).toBe(false);
    expect(falhasDaInstancia(estado)).toEqual([]);
    expect(lista.map((a) => a.mensagem)).toEqual([expect.stringContaining('antigo (versão v1) voltou a atender')]);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, ...semAcao, voltarAConsumir: voltar });
    expect(voltar).toHaveBeenCalledTimes(1);
    erro.mockRestore();
    log.mockRestore();
  });

  it('mesma versão e ambiente (duas réplicas): nenhuma para, mas o alerta e a falha do /saude valem', async () => {
    const a = instancia('a', 'v1');
    const b = instancia('b', 'v1');
    const { alertas, lista } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const parar = vi.fn(async () => {});
    const erro = calar();
    await repos.registrarInstancia(b);
    await batimentoInstancia({ repos, alertas, eu: a, estado, ...semAcao, pararDeConsumir: parar });
    await repos.registrarInstancia(b);
    await batimentoInstancia({ repos, alertas, eu: a, estado, ...semAcao, pararDeConsumir: parar });
    erro.mockRestore();
    expect(parar).not.toHaveBeenCalled();
    expect(lista).toHaveLength(1);
    expect(lista[0]!.mensagem).toContain('todos atendendo');
    expect(falhasDaInstancia(estado)).toEqual(['instancias']);
  });
});

describe('lerBuild', () => {
  it('lê versao e build_em da imagem; VERSAO do ambiente sobrepõe; sem nada, "dev" e sem data', () => {
    const dir = mkdtempSync(join(tmpdir(), 'build-'));
    writeFileSync(join(dir, 'versao'), 'abc123def456\n');
    writeFileSync(join(dir, 'build_em'), '2026-10-09T12:00:00Z\n');
    expect(lerBuild(dir, {})).toEqual({ versao: 'abc123def456', buildEm: '2026-10-09T12:00:00.000Z' });
    expect(lerBuild(dir, { VERSAO: 'manual' })).toEqual({ versao: 'manual', buildEm: '2026-10-09T12:00:00.000Z' });
    expect(lerBuild(mkdtempSync(join(tmpdir(), 'vazio-')), {})).toEqual({ versao: 'dev', buildEm: null });
    writeFileSync(join(dir, 'build_em'), 'lixo');
    expect(lerBuild(dir, {}).buildEm).toBeNull();
  });
});

describe('iniciarConsumo: a ligação de principal.ts', () => {
  const reposFalsos = (ambienteBanco: string, respostas: boolean[] = []) => ({
    ambienteDoBanco: vi.fn(async () => ambienteBanco),
    alertaRecente: vi.fn(async () => false),
    registrarInstancia: vi.fn(async () => ({ deveParar: respostas.shift() ?? false, outras: [], todas: [] })),
    removerInstancia: vi.fn(async () => {}),
  });
  const alertasMudos = { alertar: vi.fn(async () => {}) };
  const relogioManual = () => {
    const chamadas: (() => void)[] = [];
    return { chamadas, repetir: (f: () => void) => { chamadas.push(f); return { parar: () => chamadas.splice(0) } } };
  };

  it('ambiente errado: não cria o boss, não prepara (nada escrito), sem batimento e sem removerInstancia', async () => {
    const r = reposFalsos('producao');
    const criarBoss = vi.fn(async () => bossFalso());
    const preparar = vi.fn(async () => ({}) as never);
    const rel = relogioManual();
    const erro = calar();
    const c = await iniciarConsumo({ repos: r, alertas: alertasMudos, ambiente: 'homologacao', eu: instancia('x', 'v1'), estado: novoEstadoInstancia(),
      criarBoss, preparar, repetir: rel.repetir });
    erro.mockRestore();
    expect(c.consome).toBe(false);
    expect(c.boss).toBeNull();
    expect(criarBoss).not.toHaveBeenCalled();
    expect(preparar).not.toHaveBeenCalled();
    expect(r.registrarInstancia).not.toHaveBeenCalled();
    expect(rel.chamadas).toHaveLength(0);
    await c.sair();
    expect(r.removerInstancia).not.toHaveBeenCalled();
  });

  it('ambiente certo: liga; o batimento usa pararDeConsumir (offWork) e volta com ligarConsumidores, sem registrar em dobro', async () => {
    // 1º (partida): segue; 2º: outra mais nova (para); 3º e 4º: sumiu (volta no 4º); 5º: segue.
    const r = reposFalsos('local', [false, true, false, false, false]);
    const boss = bossFalso();
    const rel = relogioManual();
    const estado = novoEstadoInstancia();
    const erro = calar();
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const c = await iniciarConsumo({ repos: r, alertas: alertasMudos, ambiente: 'local', eu: instancia('x', 'v1'), estado,
      criarBoss: async () => boss, preparar: async () => ({}) as never, repetir: rel.repetir });
    expect(c.consome).toBe(true);
    expect(r.registrarInstancia).toHaveBeenCalledTimes(1);
    expect(rel.chamadas).toHaveLength(1);
    const ligados = boss.work.mock.calls.length;
    expect(ligados).toBeGreaterThan(0);

    await c.bater();
    expect(boss.offWork.mock.calls.map((x) => x[0]).sort()).toEqual(Object.values(FILAS).sort());
    expect(estado.parado).toBe(true);
    await c.bater();
    await c.bater();
    expect(boss.work.mock.calls.length).toBe(2 * ligados);
    expect(estado.parado).toBe(false);
    await c.bater();
    expect(boss.work.mock.calls.length).toBe(2 * ligados);

    await c.sair();
    expect(r.removerInstancia).toHaveBeenCalledTimes(1);
    expect(rel.chamadas).toHaveLength(0);
    erro.mockRestore();
    aviso.mockRestore();
  });
});

describe('/saude e /webhook', () => {
  it('/saude com duas instâncias: 503 com a falha "instancias"; com uma só, 200', async () => {
    await repos.registrarSinalVida('fila');
    await repos.registrarSinalVida('whatsapp');
    // Mesma versão (réplicas): ninguém para; só a falha "instancias" (a parada tem a sua, "parado").
    const a = instancia('a', 'v1');
    const b = instancia('b', 'v1');
    const { alertas } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const app = criarServidor({ canal: new CanalFalso(), repos, fila: new FilaFalsa(), segredo: 'segredo-com-16-caracteres',
      relogio: () => new Date(), saudeToken: 'tok-123', situacaoProcesso: () => situacaoDoProcesso(estado) });
    await batimentoInstancia({ repos, alertas, eu: a, estado, ...semAcao });
    expect((await app.inject({ url: '/saude' })).statusCode).toBe(200);
    await repos.registrarInstancia(b);
    const erro = calar();
    await batimentoInstancia({ repos, alertas, eu: a, estado, ...semAcao });
    erro.mockRestore();
    const r = await app.inject({ url: '/saude', headers: { 'x-saude-token': 'tok-123' } });
    expect(r.statusCode).toBe(503);
    expect(r.json().falhas).toEqual(['instancias']);
    expect(r.json().instancias).toEqual(['b']);
  });

  it('ambiente errado: o webhook responde 503 (a Z-API tenta de novo) e não grava nada; o log sai uma vez', async () => {
    const fila = new FilaFalsa();
    const linhas: string[] = [];
    const logStream = { write: (l: string) => { linhas.push(l); return true; } };
    const app = criarServidor({ canal: new CanalFalso(), repos, fila, segredo: 'segredo-com-16-caracteres', relogio: () => new Date(),
      webhookAberto: () => false, logStream: logStream as never });
    const corpo = { type: 'ReceivedCallback', phone: '5531999990001', messageId: 'm-amb-1', fromMe: false, text: { message: 'oi' } };
    const r1 = await app.inject({ method: 'POST', url: '/webhook/zapi/segredo-com-16-caracteres', payload: corpo });
    const r2 = await app.inject({ method: 'POST', url: '/webhook/zapi/segredo-com-16-caracteres', payload: { ...corpo, messageId: 'm-amb-2' } });
    expect([r1.statusCode, r2.statusCode]).toEqual([503, 503]);
    expect(fila.enviados).toEqual([]);
    const { count } = await db.from('mensagens').select('id', { count: 'exact', head: true });
    expect(count).toBe(0);
    expect(linhas.filter((l) => l.includes('webhook_recusado_ambiente'))).toHaveLength(1);
    // Segredo errado continua 401 (a recusa não revela nada a quem não tem o segredo).
    expect((await app.inject({ method: 'POST', url: '/webhook/zapi/errado', payload: corpo })).statusCode).toBe(401);
  });
});
