// Auditoria 4.3: um trabalhador só, com o ambiente certo. A partida confere o AMBIENTE do processo contra o do banco; o
// batimento de cada processo registra a instância e, com outra viva de versão ou ambiente diferente, a mais antiga sai das filas.
import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { ligarConsumidores } from '../src/consumidores';
import { FILAS } from '../src/fila';
import {
  batimentoInstancia, falhasDaInstancia, mensagemAmbienteErrado, novoEstadoInstancia, partida, situacaoDoProcesso, type Instancia,
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
const bossFalso = () => ({ work: vi.fn(async (..._a: unknown[]) => 'id'), schedule: vi.fn(async (..._a: unknown[]) => {}) });
const instancia = (hostname: string, versao: string, ambiente = 'local'): Instancia => ({ id: randomUUID(), hostname, ambiente, versao });

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
    expect(boss.work).toHaveBeenCalled();
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
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ok = await partida({ repos, alertas, ambiente: 'homologacao', estado, ligar: () => ligarConsumidores(boss as never, {} as never) });
    erro.mockRestore();
    expect(ok).toBe(false);
    expect(boss.work).not.toHaveBeenCalled();
    expect(boss.schedule).not.toHaveBeenCalled();
    expect(lista).toEqual([{ nivel: 'critico', mensagem: mensagemAmbienteErrado('homologacao', 'producao') }]);
    expect(mensagemAmbienteErrado('homologacao', 'producao'))
      .toBe('O trabalhador foi iniciado com AMBIENTE=homologacao, mas este banco é de producao. Ele não vai atender.');
    expect(falhasDaInstancia(estado)).toEqual(['ambiente']);
    // O banco continua com o seu ambiente.
    const { data } = await db.from('configuracoes').select('ambiente').eq('id', 1).single();
    expect(data!.ambiente).toBe('producao');
    // Reiniciando em laço: o alerta sai uma vez por hora.
    await partida({ repos, alertas, ambiente: 'homologacao', estado: novoEstadoInstancia(), ligar: async () => {} }).catch(() => {});
    expect(lista).toHaveLength(1);
  });
});

describe('registrarInstancia (banco local)', () => {
  it('duas instâncias com versões diferentes: a antiga recebe deveParar = true; a nova, false', async () => {
    const antiga = instancia('antigo', 'v1');
    const nova = instancia('novo', 'v2');
    expect(await repos.registrarInstancia(antiga)).toEqual({ deveParar: false, outras: [] });
    const rNova = await repos.registrarInstancia(nova);
    expect(rNova.deveParar).toBe(false);
    expect(rNova.outras.map((o) => o.hostname)).toEqual(['antigo']);
    const rAntiga = await repos.registrarInstancia(antiga);
    expect(rAntiga.deveParar).toBe(true);
    expect(rAntiga.outras.map((o) => o.hostname)).toEqual(['novo']);
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
  it('a antiga (versão diferente) para de consumir uma vez só; o alerta sai só no segundo batimento seguido, uma vez por hora', async () => {
    const antiga = instancia('antigo', 'v1');
    const nova = instancia('novo', 'v2');
    const { alertas, lista } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const parar = vi.fn(async () => {});
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, pararDeConsumir: parar });
    expect(parar).not.toHaveBeenCalled();
    expect(falhasDaInstancia(estado)).toEqual([]);

    await repos.registrarInstancia(nova);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, pararDeConsumir: parar });
    expect(parar).toHaveBeenCalledTimes(1);
    expect(falhasDaInstancia(estado)).toEqual(['instancias']);
    // Implantação normal: a sobreposição de um batimento não acorda o dono.
    expect(lista).toEqual([]);

    await repos.registrarInstancia(nova);
    await batimentoInstancia({ repos, alertas, eu: antiga, estado, pararDeConsumir: parar });
    expect(parar).toHaveBeenCalledTimes(1);
    expect(lista).toHaveLength(1);
    expect(lista[0]!.nivel).toBe('critico');
    expect(lista[0]!.mensagem).toContain('antigo');
    expect(lista[0]!.mensagem).toContain('novo');

    await batimentoInstancia({ repos, alertas, eu: antiga, estado, pararDeConsumir: parar });
    expect(lista).toHaveLength(1);
    erro.mockRestore();
  });

  it('mesma versão e ambiente (duas réplicas): nenhuma para, mas o alerta e a falha do /saude valem', async () => {
    const a = instancia('a', 'v1');
    const b = instancia('b', 'v1');
    const { alertas, lista } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const parar = vi.fn(async () => {});
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    await repos.registrarInstancia(b);
    await batimentoInstancia({ repos, alertas, eu: a, estado, pararDeConsumir: parar });
    await repos.registrarInstancia(b);
    await batimentoInstancia({ repos, alertas, eu: a, estado, pararDeConsumir: parar });
    erro.mockRestore();
    expect(parar).not.toHaveBeenCalled();
    expect(lista).toHaveLength(1);
    expect(falhasDaInstancia(estado)).toEqual(['instancias']);
  });

  it('a outra some: o estado volta ao normal', async () => {
    const a = instancia('a', 'v1');
    const b = instancia('b', 'v1');
    const { alertas } = alertasFalsos();
    const estado = novoEstadoInstancia();
    await repos.registrarInstancia(b);
    await batimentoInstancia({ repos, alertas, eu: a, estado, pararDeConsumir: async () => {} });
    expect(falhasDaInstancia(estado)).toEqual(['instancias']);
    await repos.removerInstancia(b.id);
    await batimentoInstancia({ repos, alertas, eu: a, estado, pararDeConsumir: async () => {} });
    expect(falhasDaInstancia(estado)).toEqual([]);
  });
});

describe('/saude com duas instâncias', () => {
  it('503 com a falha "instancias"; com uma só, 200', async () => {
    await repos.registrarSinalVida('fila');
    await repos.registrarSinalVida('whatsapp');
    const a = instancia('a', 'v1');
    const b = instancia('b', 'v2');
    const { alertas } = alertasFalsos();
    const estado = novoEstadoInstancia();
    const app = criarServidor({ canal: new CanalFalso(), repos, fila: new FilaFalsa(), segredo: 'segredo-com-16-caracteres',
      relogio: () => new Date(), saudeToken: 'tok-123', situacaoProcesso: () => situacaoDoProcesso(estado) });
    await batimentoInstancia({ repos, alertas, eu: a, estado, pararDeConsumir: async () => {} });
    expect((await app.inject({ url: '/saude' })).statusCode).toBe(200);
    await repos.registrarInstancia(b);
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    await batimentoInstancia({ repos, alertas, eu: a, estado, pararDeConsumir: async () => {} });
    erro.mockRestore();
    const r = await app.inject({ url: '/saude', headers: { 'x-saude-token': 'tok-123' } });
    expect(r.statusCode).toBe(503);
    expect(r.json().falhas).toEqual(['instancias']);
    expect(r.json().instancias).toEqual(['b']);
  });
});
