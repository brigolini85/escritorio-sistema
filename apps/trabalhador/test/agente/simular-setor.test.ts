import { beforeEach, describe, expect, it } from 'vitest';
import { configurarAgenteTeste, criarSkillTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import { MENSAGEM_AGENTE_SIMULACAO, processarSimulacao } from '../../src/agente/simular';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { db, repos } from '../apoio/cenario';
import { criarUsuarioTeste } from '../apoio/usuario';

let usuarios = 0;
async function simulacao(slug: string, p: { modo?: string | null; skill?: string | null; mensagem?: string } = {}) {
  const dono = await criarUsuarioTeste({ email: `dono-sim-${++usuarios}@i3b.local`, nome: 'Dono', papel: 'admin' });
  const agente = (await db.from('agentes').select('id').eq('slug', slug).single()).data!.id;
  const [s] = await sqlTeste<{ id: string }>(`insert into public.simulacoes_agente (usuario_id, mensagem, agente_id, modo, skill_id)
    values ($1, $2, $3, $4, $5) returning id`, [dono, p.mensagem ?? 'Saiu a nota do pedido 4512?', agente, p.modo ?? null, p.skill ?? null]);
  return { id: s!.id, agente };
}
const deps = (ia: IaRoteirizada) => ({ repos, ia, envio: {} as never, prazoMs: 60_000 });

describe('Testar dos agentes dos setores (I3b, D11)', () => {
  beforeEach(async () => { await limparBanco(); await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1); });

  it('por trás: o próprio Fiscal roda, devolve ao Thiago; nada é gravado; custo testar_agente com o agente', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'desligado', modo: 'mesma_voz', ferramentas: ['consultar_chamados', 'nota_interna'] });
    const { id, agente } = await simulacao('fiscal', { modo: 'por_tras' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'devolver_resposta', entrada: { resposta_ao_cliente: 'A nota sai hoje.', para_a_equipe: null } }), fim()]);
    expect(await processarSimulacao(deps(ia), id, true)).toBe('pronta');
    expect((ia.recebidos[0]!.system as { text: string }[]).map((b) => b.text).join('\n')).toContain('COMO VOCÊ FALA: por trás');
    const r = (await db.from('simulacoes_agente').select('respostas').eq('id', id).single()).data!.respostas as { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[] };
    expect(r.mensagens).toEqual([]);
    expect(r.acoes).toContainEqual({ ferramenta: 'devolver_resposta', resumo: 'Devolveria ao Thiago para repassar: "A nota sai hoje."' });
    const usos = (await db.from('uso_ia').select('funcionalidade, agente_id, conversa_id')).data!;
    expect(usos.length).toBeGreaterThan(0);
    expect(usos.every((u) => u.funcionalidade === 'testar_agente' && u.agente_id === agente && u.conversa_id === null)).toBe(true);
    expect((await db.from('decisoes_agente').select('id')).data!).toEqual([]);
  });

  it('mesma voz: o que ele mandaria aparece; nota interna vira "Sugeriria", sem gravar', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz', ferramentas: ['nota_interna'] });
    const { id } = await simulacao('fiscal');
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'nota_interna', entrada: { numero: 12, texto: 'Cliente pediu a nota.' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi! Aqui é o Thiago. A nota sai hoje.' } }),
      fim(),
    ]);
    expect(await processarSimulacao(deps(ia), id, true)).toBe('pronta');
    const r = (await db.from('simulacoes_agente').select('respostas').eq('id', id).single()).data!.respostas as { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[] };
    expect(r.mensagens).toEqual(['Oi! Aqui é o Thiago. A nota sai hoje.']);
    expect(r.acoes).toContainEqual({ ferramenta: 'nota_interna', resumo: 'Sugeriria uma nota interna na demanda 12: Cliente pediu a nota.' });
    expect((await db.from('agente_sugestoes').select('id')).data ?? []).toEqual([]);
  });

  it('F11: conferir_pedido_nota e sugerir_correcao são só simulados (nada da pré-análise é lido nem gravado)', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz', ferramentas: ['conferir_pedido_nota', 'sugerir_correcao'] });
    const { id } = await simulacao('fiscal', { modo: 'por_tras' });
    const ia = new IaRoteirizada([
      usarFerramentas(
        { nome: 'conferir_pedido_nota', entrada: { numero: 7 } },
        { nome: 'sugerir_correcao', entrada: { numero: 7, campo: 'CFOP', de: '5101', para: '5102', motivo: 'Revenda' } },
      ),
      usarFerramentas({ nome: 'devolver_resposta', entrada: { resposta_ao_cliente: 'Vou conferir.', para_a_equipe: 'Conferir o CFOP.' } }),
      fim(),
    ]);
    expect(await processarSimulacao(deps(ia), id, true)).toBe('pronta');
    const r = (await db.from('simulacoes_agente').select('respostas').eq('id', id).single()).data!.respostas as { acoes: { ferramenta: string; resumo: string }[] };
    expect(r.acoes).toEqual([
      { ferramenta: 'conferir_pedido_nota', resumo: 'Conferiria o pedido de nota da demanda 7' },
      { ferramenta: 'sugerir_correcao', resumo: 'Sugeriria corrigir na demanda 7 o campo CFOP para "5102" (Revenda)' },
      { ferramenta: 'devolver_resposta', resumo: 'Devolveria ao Thiago para repassar: "Vou conferir."' },
      { ferramenta: 'devolver_resposta', resumo: 'Pediria à equipe: Conferir o CFOP.' },
    ]);
    expect((await db.from('agente_sugestoes').select('id')).data ?? []).toEqual([]);
    expect((await db.from('pre_analises_nota').select('chamado_id')).data ?? []).toEqual([]);
  });

  it('skill desligada em teste entra no prompt; agente só de Trabalho dá erro com a frase', async () => {
    await configurarAgenteTeste('fiscal', { estado: 'desligado', modo: 'mesma_voz' });
    const sk = await criarSkillTeste('fiscal', 'tabela-cfop', 'conhecimento', false, [], { titulo: 'Tabela CFOP', descricao: 'CFOP de venda', corpo: '5102' });
    const { id } = await simulacao('fiscal', { skill: sk });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi' } }), fim()]);
    await processarSimulacao(deps(ia), id, true);
    expect((ia.recebidos[0]!.system as { text: string }[]).map((b) => b.text).join('\n')).toContain('tabela-cfop');
    const c = await simulacao('contabil');
    expect(await processarSimulacao(deps(new IaRoteirizada([])), c.id, true)).toBe('erro');
    expect((await db.from('simulacoes_agente').select('erro').eq('id', c.id).single()).data!.erro).toBe(MENSAGEM_AGENTE_SIMULACAO);
  });
});
