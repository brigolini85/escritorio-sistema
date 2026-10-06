import type { Repos, ReposRadar } from '@escritorio/db';
import { describe, expect, it, vi } from 'vitest';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { enviarEnvioRadar } from '../../src/radar/envios';

const ENVIO = { id: 'e1', novidadeId: 'n1', clienteId: 'c1', contatoId: 'ct1', telefone: '5531999990001', texto: 'Roberto, saiu uma regra nova do eSocial.' };

function montar(o: { pausado?: boolean; reserva?: typeof ENVIO | null; estado?: string; falhaGravar?: boolean; falhaMarcarEnvio?: boolean } = {}) {
  const canal = new CanalFalso();
  const saidas: { autor: string; conteudo: string; clienteId: string | null }[] = [];
  const repos = {
    obterConfiguracoes: vi.fn(async () => ({ agentePausado: o.pausado ?? false })),
    obterOuCriarConversa: vi.fn(async (telefone: string) => ({ id: 'conv1', telefone, estado: o.estado ?? 'agente' })),
    criarSaidaPendente: vi.fn(async (m: { autor: string; conteudo: string; clienteId: string | null }) => { saidas.push(m); return 'msg1'; }),
    marcarEnviada: vi.fn(async () => { if (o.falhaGravar) throw new Error('banco fora'); }),
    marcarFalha: vi.fn(async () => undefined),
  };
  const radar = {
    reservarEnvioRadar: vi.fn(async () => (o.reserva === undefined ? ENVIO : o.reserva)),
    liberarEnvioRadar: vi.fn(async () => undefined),
    marcarEnvioRadar: vi.fn(async () => { if (o.falhaMarcarEnvio) throw new Error('banco fora'); }),
  };
  const envio = { repos: repos as unknown as Repos, canal, limitador: new LimitadorEnvio(100), midia: {} as never };
  const run = () => enviarEnvioRadar({ repos: repos as unknown as Repos, radar: radar as unknown as ReposRadar, envio }, 'e1');
  return { canal, saidas, repos, radar, run };
}

describe('envio do Radar ao cliente (D14)', () => {
  it('pausa geral: nada reservado, nada enviado', async () => {
    const t = montar({ pausado: true });
    expect(await t.run()).toBe('nada');
    expect(t.radar.reservarEnvioRadar).not.toHaveBeenCalled();
    expect(t.canal.enviados).toEqual([]);
  });

  it('reserva recusada (impedido ou já reservado): nada', async () => {
    const t = montar({ reserva: null });
    expect(await t.run()).toBe('nada');
    expect(t.canal.enviados).toEqual([]);
  });

  it('conversa com uma pessoa: solta a reserva e espera', async () => {
    const t = montar({ estado: 'humano' });
    expect(await t.run()).toBe('esperando');
    expect(t.radar.liberarEnvioRadar).toHaveBeenCalledWith('e1');
    expect(t.canal.enviados).toEqual([]);
  });

  it('sucesso: uma mensagem com o texto aprovado, autor agente, e marca o envio', async () => {
    const t = montar();
    expect(await t.run()).toBe('enviado');
    expect(t.canal.enviados).toEqual([{ telefone: ENVIO.telefone, texto: ENVIO.texto }]);
    expect(t.saidas).toEqual([expect.objectContaining({ autor: 'agente', conteudo: ENVIO.texto, clienteId: 'c1' })]);
    expect(t.radar.marcarEnvioRadar).toHaveBeenCalledWith('e1', 'msg1');
    expect(t.radar.liberarEnvioRadar).not.toHaveBeenCalled();
  });

  it('Z-API falha: libera a reserva e o erro sobe', async () => {
    const t = montar();
    t.canal.falharEnvio = true;
    await expect(t.run()).rejects.toThrow('falha simulada');
    expect(t.radar.liberarEnvioRadar).toHaveBeenCalledWith('e1');
    expect(t.radar.marcarEnvioRadar).not.toHaveBeenCalled();
  });

  it('Z-API aceitou e a gravação falhou: não libera nem lança; corrige o status e marca o envio', async () => {
    const t = montar({ falhaGravar: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await t.run()).toBe('enviado');
    expect(t.canal.enviados).toHaveLength(1);
    expect(t.radar.liberarEnvioRadar).not.toHaveBeenCalled();
    expect(t.repos.marcarEnviada.mock.calls.length).toBeGreaterThan(1);
    expect(t.radar.marcarEnvioRadar).toHaveBeenCalledWith('e1', 'msg1');
  });

  it('marcar o envio falha sempre: a reserva fica e nada é reenviado', async () => {
    const t = montar({ falhaMarcarEnvio: true });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await t.run()).toBe('enviado');
    expect(t.radar.marcarEnvioRadar).toHaveBeenCalledTimes(3);
    expect(t.radar.liberarEnvioRadar).not.toHaveBeenCalled();
    expect(t.canal.enviados).toHaveLength(1);
  });
});
