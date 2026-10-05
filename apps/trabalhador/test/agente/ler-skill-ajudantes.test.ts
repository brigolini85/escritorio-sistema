import { describe, expect, it } from 'vitest';
import type { PerfilAgente, Repos, SkillCarregada } from '@escritorio/db';
import { AVISOS_SKILL, TAMANHO_PARTE_REFERENCIA, lerReferenciaDoPerfil, lerSkillDoPerfil } from '../../src/agente/skills';

const skill = (nome: string, arquivos: string[] = []): SkillCarregada =>
  ({ id: `id-${nome}`, nome, tipo: 'procedimento', ativa: true, titulo: `Título ${nome}`, descricao: 'd', corpo: `Texto de ${nome}.`, versao: 3, arquivos });
const perfil: PerfilAgente = { id: 'ag-1', slug: 'contabil', nome: 'Agente Contábil', modelo: null, ferramentas: [], skills: [skill('fechamento', ['plano.csv'])], skillEmTeste: null };

describe('ler_skill e ler_referencia compartilhados (D2)', () => {
  it('ler_skill: só as do perfil, com a mesma saída da conversa', () => {
    expect(lerSkillDoPerfil(perfil, 'fechamento')).toEqual({ ok: true, dados: { nome: 'fechamento', tipo: 'Procedimentos', titulo: 'Título fechamento',
      versao: 3, texto: 'Texto de fechamento.', arquivos: ['plano.csv'] } });
    expect(lerSkillDoPerfil(perfil, 'de-outro')).toEqual({ ok: false, erro: AVISOS_SKILL.naoEncontrada });
    expect(lerSkillDoPerfil(null, 'fechamento')).toEqual({ ok: false, erro: AVISOS_SKILL.naoEncontrada });
  });
  it('ler_referencia: arquivo da lista, em partes', async () => {
    const texto = 'x'.repeat(TAMANHO_PARTE_REFERENCIA + 10);
    const repos = { referenciaDaSkill: async () => texto } as unknown as Repos;
    const r = await lerReferenciaDoPerfil(repos, perfil, 'fechamento', 'plano.csv', 2);
    expect(r).toEqual({ ok: true, dados: { skill: 'fechamento', arquivo: 'plano.csv', parte: 2, partes: 2, texto: 'x'.repeat(10) } });
    expect(await lerReferenciaDoPerfil(repos, perfil, 'fechamento', 'outro.csv')).toEqual({ ok: false, erro: AVISOS_SKILL.arquivoNaoEncontrado });
    expect(await lerReferenciaDoPerfil(repos, perfil, 'fechamento', 'plano.csv', 3)).toEqual({ ok: false, erro: AVISOS_SKILL.parteInvalida });
  });
});
