import { describe, expect, it } from 'vitest';
import {
  linhaFonte, MOTIVO_ENVIO, rotuloSelo, setoresDaDemanda, textoCustoMes, textoDescartada, textoEnvios, textoProximoGiro, textoVigencia, textoVirouDemanda,
} from './textos';

const sp = (s: string) => s.replaceAll(String.fromCharCode(0xa0), ' ');
const agora = new Date('2026-10-06T13:00:00Z'); // 10:00 em São Paulo

describe('textos da tela do Radar', () => {
  it('selo', () => {
    expect(rotuloSelo('oficial')).toBe('oficial');
    expect(rotuloSelo('confirmar')).toBe('confirmar');
  });

  it('linha da fonte: publicado só com data, "achado" hoje, ontem ou dia', () => {
    const n = { fonteNome: 'eSocial', publicadoEm: '2026-10-01', achadoEm: '2026-10-06T10:02:00Z' };
    expect(linhaFonte(n, agora)).toBe('eSocial · publicado 01/10/2026 · achado hoje 07:02');
    expect(linhaFonte({ ...n, publicadoEm: null }, agora)).toBe('eSocial · achado hoje 07:02');
    expect(linhaFonte({ ...n, achadoEm: '2026-10-05T10:02:00Z' }, agora)).toBe('eSocial · publicado 01/10/2026 · achado ontem 07:02');
    expect(linhaFonte({ ...n, publicadoEm: '2026-10-01T03:00:00Z', achadoEm: '2026-09-29T10:02:00Z' }, agora)).toBe('eSocial · publicado 01/10/2026 · achado 29/09 07:02');
  });

  it('virou demanda', () => {
    const base = { numero: 482, setor: 'Legalização', pessoa: 'Ana', em: '2026-09-29T15:00:00Z' };
    expect(textoVirouDemanda(base)).toBe('Virou demanda #482 · Legalização · por Ana, 29/09');
    expect(textoVirouDemanda({ ...base, numero: null })).toBe('Virou demanda · Legalização · por Ana, 29/09');
    expect(textoVirouDemanda({ ...base, pessoa: null })).toBe('Virou demanda #482 · Legalização · 29/09');
  });

  it('descartada', () => {
    expect(textoDescartada({ pessoa: 'Ana', em: '2026-09-29T15:00:00Z' })).toBe('Descartada por Ana, 29/09');
    expect(textoDescartada({ pessoa: null, em: null })).toBe('Descartada');
  });

  it('envios', () => {
    expect(textoEnvios({ enviado: 12, aguardando: 3, naoEnviado: 1, motivos: ['limite_dia'] })).toBe('Enviado a 12 · 3 esperando (limite do dia) · 1 não enviado');
    expect(textoEnvios({ enviado: 0, aguardando: 0, naoEnviado: 2, motivos: ['nao_procuravel'] })).toBe('2 não enviados (não pode mais ser procurado)');
    expect(textoEnvios({ enviado: 5, aguardando: 0, naoEnviado: 0, motivos: [] })).toBe('Enviado a 5');
    expect(textoEnvios({ enviado: 0, aguardando: 0, naoEnviado: 0, motivos: [] })).toBeNull();
    expect(MOTIVO_ENVIO.limite_dia).toBe('limite do dia');
  });

  it('vigência e custo', () => {
    expect(textoVigencia(null)).toBe('sem data ainda');
    expect(textoVigencia('a partir de 01/11/2026')).toBe('a partir de 01/11/2026');
    expect(sp(textoCustoMes(1.92, 5.2))).toBe('US$ 1,92 · ≈ R$ 9,98');
    expect(sp(textoCustoMes(1.92, null))).toBe('US$ 1,92');
  });

  it('próximo giro', () => {
    const cfg = { estado: 'ligado' as const, proximoGiro: '2026-10-07T10:00:00Z' };
    expect(textoProximoGiro(cfg, agora)).toBe('amanhã 07:00 · automático');
    expect(textoProximoGiro({ ...cfg, proximoGiro: '2026-10-06T21:30:00Z' }, agora)).toBe('hoje 18:30 · automático');
    // Atrasado e ainda não rodou: o próximo é "agora", e a hora mostrada é a dele, não a da agenda.
    expect(textoProximoGiro({ ...cfg, proximoGiro: '2026-10-06T13:00:00Z' }, agora)).toBe('hoje 10:00 · automático');
    expect(textoProximoGiro({ ...cfg, proximoGiro: '2026-10-09T10:00:00Z' }, agora)).toBe('09/10 07:00 · automático');
    expect(textoProximoGiro({ ...cfg, proximoGiro: null }, agora)).toBe('sem agenda');
    expect(textoProximoGiro({ ...cfg, estado: 'teste' }, agora)).toBe('sem agenda');
    expect(textoProximoGiro({ ...cfg, estado: 'desligado' }, agora)).toBe('Radar desligado');
  });
});

describe('setor da demanda', () => {
  const setores = [{ id: 's1', nome: 'Legalização' }, { id: 's2', nome: 'Fiscal' }];
  it('usa o setor da própria demanda; sem ele, todos os da novidade', () => {
    expect(setoresDaDemanda({ setores, chamado: { setorId: 's2' } })).toBe('Fiscal');
    expect(setoresDaDemanda({ setores, chamado: { setorId: null } })).toBe('Legalização, Fiscal');
    expect(setoresDaDemanda({ setores, chamado: { setorId: 'x' } })).toBe('Legalização, Fiscal');
    expect(setoresDaDemanda({ setores, chamado: null })).toBe('Legalização, Fiscal');
  });
});
