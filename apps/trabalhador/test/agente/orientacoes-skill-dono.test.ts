import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { OrientacaoAgente } from '@escritorio/db';
import { describe, expect, it } from 'vitest';
import { LIMITE_ORIENTACOES, linhaOrientacao, orientacoesDaConversa } from '../../src/agente/orientacoes';
import { ORIENTACOES_SKILL_DONO, sqlOrientacoesSkillDono } from '../../src/agente/orientacoes-skill-dono';
import { montarSistema } from '../../src/agente/prompt';

const arquivoSql = fileURLToPath(new URL('../../../../supabase/dados/orientacoes-skill-dono.sql', import.meta.url));
const comoOrientacao = (i: number): OrientacaoAgente => ({
  id: `O${i}`, ...ORIENTACOES_SKILL_DONO[i]!, clienteId: null, setorId: null, setorNome: null, atualizadoEm: new Date(2026, 8, 30, 12, 0, 60 - i),
});
const todas = ORIENTACOES_SKILL_DONO.map((_, i) => comoOrientacao(i));

describe('orientações da skill do dono (seed)', () => {
  it('cada uma respeita os limites da tabela e os títulos não se repetem', () => {
    for (const o of ORIENTACOES_SKILL_DONO) {
      expect(o.titulo.length, o.titulo).toBeLessThanOrEqual(120);
      expect(o.texto.length, o.titulo).toBeLessThanOrEqual(2000);
      expect(o.texto, o.titulo).toBe(o.texto.trim());
    }
    expect(new Set(ORIENTACOES_SKILL_DONO.map((o) => o.titulo)).size).toBe(ORIENTACOES_SKILL_DONO.length);
  });

  it('juntas cabem no limite de 12.000 caracteres pela mesma conta do prompt', () => {
    const total = todas.reduce((soma, o) => soma + linhaOrientacao(o).length + 1, 0);
    // Folga para a equipe preencher os "(a preencher)" de Dados do escritório sem cortar nada.
    expect(total).toBeLessThanOrEqual(LIMITE_ORIENTACOES - 400);
    const r = orientacoesDaConversa(todas, { clienteId: null, setores: [] });
    expect(r.cortadas).toEqual([]);
    expect(r.gerais).toHaveLength(ORIENTACOES_SKILL_DONO.length);
  });

  it('nenhuma tem emoji nem as marcas < > (que o prompt troca)', () => {
    for (const o of ORIENTACOES_SKILL_DONO) {
      // Mesma classe de caracteres que semEmoji tira das respostas.
      expect(o.texto + o.titulo, o.titulo).not.toMatch(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}<>]/u);
    }
  });

  it('não contrariam as regras fixas: nada de emoji liberado nem nota sem resumo', () => {
    const tudo = ORIENTACOES_SKILL_DONO.map((o) => o.texto).join('\n').toLowerCase();
    expect(tudo).not.toContain('emoji');
    expect(tudo).toContain('pedido de nota fiscal não usa este formato');
    expect(tudo).toContain('"urgente:"');
  });

  it('dados do escritório: campos a preencher e a instrução de não inventar', () => {
    const dados = ORIENTACOES_SKILL_DONO.find((o) => o.titulo === 'Dados do escritório')!;
    expect(dados.tipo).toBe('regra');
    expect(dados.texto).toContain('(a preencher)');
    expect(dados.texto).toContain('Campo a preencher = diga que vai confirmar com a equipe; nunca invente.');
  });

  it('usam os nomes reais dos setores', () => {
    const setores = ORIENTACOES_SKILL_DONO.find((o) => o.titulo === 'Setores e casos de fronteira')!.texto;
    for (const nome of ['Comercial', 'Contábil', 'Direção', 'Financeiro', 'Fiscal', 'IRPF', 'Legalização', 'Pessoal']) {
      expect(setores).toContain(`${nome}:`);
    }
    expect(ORIENTACOES_SKILL_DONO.map((o) => o.texto).join('\n')).not.toMatch(/Societário|Departamento Pessoal/);
  });

  it('entram no prompt depois das regras fixas', () => {
    const s = montarSistema([], [], { gerais: todas, porSetor: [] });
    expect(s.indexOf('Dados do escritório')).toBeGreaterThan(s.indexOf('ORIENTAÇÕES DO ESCRITÓRIO'));
  });

  it('o SQL em supabase/dados está em dia com a fonte (rode seed-orientacoes-dono se falhar)', () => {
    expect(readFileSync(arquivoSql, 'utf8').replace(/\r\n/g, '\n')).toBe(sqlOrientacoesSkillDono());
  });

  it('o SQL é idempotente, insere desligadas e grava a versão criar', () => {
    const sql = sqlOrientacoesSkillDono();
    expect(sql.match(/where not exists \(select 1 from public\.orientacoes_agente where titulo = /g)).toHaveLength(ORIENTACOES_SKILL_DONO.length);
    expect(sql.match(/, false, autor\.id, autor\.id,/g)).toHaveLength(ORIENTACOES_SKILL_DONO.length);
    expect(sql.match(/select id, 'criar', titulo, texto, tipo, cliente_id, setor_id, ativo, criado_por from nova;/g)).toHaveLength(ORIENTACOES_SKILL_DONO.length);
    expect(sql).not.toMatch(/\bativo\)?\s*=\s*true|, true, autor/);
  });
});
