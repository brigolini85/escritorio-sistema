import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AGENTE_ATENDIMENTO_ID } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import { limparBanco } from '@escritorio/db/teste';
import { carregarPerfil, PERFIL_PADRAO_ATENDIMENTO } from '../../src/agente/perfil';
import { repos } from '../apoio/cenario';
import { CASOS_RETRATO, retratoDoPedido } from '../apoio/retrato';

const retrato = (nome: string) => readFileSync(new URL(`./__retratos__/${nome}.json`, import.meta.url), 'utf8');

beforeEach(limparBanco);

// Parte I1 (D2, Foco da revisão 1): no motor, o Thiago manda ao Claude exatamente o pedido de antes (Task 1).
describe('o Thiago no motor', () => {
  for (const nome of Object.keys(CASOS_RETRATO)) {
    it(`${nome}: com o perfil do banco, igual ao retrato`, async () => {
      const agente = await carregarPerfil(repos, 'atendimento');
      expect(agente.id).toBe(AGENTE_ATENDIMENTO_ID);
      expect(await retratoDoPedido({ ...CASOS_RETRATO[nome]!(), agente })).toBe(retrato(nome));
    });
    it(`${nome}: com o perfil do código (banco sem a Parte I), igual ao retrato`, async () => {
      expect(await retratoDoPedido({ ...CASOS_RETRATO[nome]!(), agente: PERFIL_PADRAO_ATENDIMENTO })).toBe(retrato(nome));
    });
  }

  it('sem a Parte I no banco: o Thiago do código, e nenhum outro agente', async () => {
    const semParteI = { perfilDoAgente: async () => null } as unknown as Repos;
    expect(await carregarPerfil(semParteI, 'atendimento')).toBe(PERFIL_PADRAO_ATENDIMENTO);
    await expect(carregarPerfil(semParteI, 'fiscal')).rejects.toThrow('Agente não encontrado: fiscal');
  });
});
