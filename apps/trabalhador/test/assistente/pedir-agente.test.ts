import type Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { configurarAgenteTeste, criarTarefaTeste, limparBanco, nivelTeste, repassarPendenciaTeste, sqlTeste } from '@escritorio/db/teste';
import type { Repos } from '@escritorio/db';
import { prepararPedidoAoAgente } from '../../src/assistente/agentes';
import { processarAssistente } from '../../src/assistente/processar';
import { CanalFalso } from '../../src/canal/falso';
import { CASOS_RETRATO_ASSISTENTE, retratoDoAssistente } from '../apoio/retrato-assistente';
import { db, repos, setorId } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

const nomes = (p: { tools?: unknown[] }) => (p.tools ?? []).map((t) => (t as Anthropic.Tool).name);
/** Ruling F1: o resultado da ferramenta vai na 2ª requisição (a 3ª leva o do responder). Padrão de csv.test.ts. */
const resultadoDaFerramenta = (ia: IaRoteirizada) =>
  (ia.recebidos[1]!.messages.at(-1)!.content as { type: string; content: string; is_error?: boolean }[]).filter((b) => b.type === 'tool_result')[0]!;

describe('D1/D2: sem gatilho o pedido à IA é o do retrato', () => {
  for (const [nome, caso] of Object.entries(CASOS_RETRATO_ASSISTENTE)) {
    it(`${nome}: prepararPedidoAoAgente devolve null e o pedido continua igual`, async () => {
      const c = caso();
      // Repositório que ofereceria agentes e pendências: o gatilho tem de barrar antes (site) ou não achar nada (WhatsApp).
      const chamadas: string[] = [];
      const reposFalso = {
        agentesParaPedir: async () => { chamadas.push('agentes'); return [{ id: 'a', slug: 'contabil', nome: 'Agente Contábil', setor: 'Contábil' }]; },
        pendenciasRepassadas: async () => { chamadas.push('pendencias'); return []; },
      } as unknown as Repos;
      expect(await prepararPedidoAoAgente({ repos: reposFalso, ia: {} as never, canal: {} as never }, c.ctx, c.historico)).toBeNull();
      expect(chamadas).not.toContain('agentes');
      if (c.ctx.canal === 'site') expect(chamadas).toEqual([]);
      await expect(await retratoDoAssistente(c)).toMatchFileSnapshot(`./__retratos_assistente__/${nome}.json`);
    });
  }
});

describe('pedir ao agente pelo Assistente (banco local)', () => {
  let claudia: string;
  let empresa: string;
  beforeEach(async () => {
    await limparBanco();
    await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
    await configurarAgenteTeste('contabil', { estado: 'ligado', tipos: ['trabalho'] });
    claudia = await criarUsuarioTeste({ email: 'claudia@i4ass.local', nome: 'Cláudia', papel: 'atendente', setores: ['Contábil'],
      permissoes: ['assistente_site', 'assistente_whatsapp'], telefone: '5531911110001' });
    await nivelTeste(claudia, 'assistente', 'site_whatsapp');
    empresa = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!.id;
  });
  const pergunta = (texto: string, canal: 'site' | 'whatsapp' = 'whatsapp') =>
    repos.registrarMensagemAssistente({ usuarioId: claudia, canal, conversaId: null, papel: 'usuario', conteudo: texto });

  it('WhatsApp: "pede pro contábil…" oferece as ferramentas, cria a tarefa, enfileira e registra a decisão', async () => {
    await pergunta('pede pro contábil fazer o fechamento de outubro da Padaria Sol');
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'pedir_ao_agente', entrada: { agente: 'contábil', empresa_id: empresa, pedido: 'Fazer o fechamento de outubro' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Encaminhei.' } }), fim(),
    ]);
    const fila = new FilaFalsa();
    const canal = new CanalFalso();
    await processarAssistente({ repos, ia, canal, fila }, { usuarioId: claudia, canal: 'whatsapp', conversaId: null, telefone: '5531911110001' }, true);
    expect(nomes(ia.recebidos[0]!)).toEqual(expect.arrayContaining(['pedir_ao_agente', 'responder']));
    expect(ia.recebidos[0]!.system).toHaveLength(2);
    expect(JSON.stringify(ia.recebidos[0]!.system![1])).toContain('Agente Contábil (Contábil)');
    const [t] = await sqlTeste<{ id: string; numero: number; canal: string }>('select id, numero, canal from public.agente_tarefas');
    expect(t!.canal).toBe('whatsapp');
    const r = resultadoDaFerramenta(ia);
    expect(r.is_error).toBe(false);
    expect(JSON.parse(r.content)).toMatchObject({ tarefa: `T-${String(t!.numero).padStart(4, '0')}`, demanda_nova: true });
    expect(fila.enviados.map((e) => e.nome)).toContain('agente_trabalho');
    expect(await sqlTeste("select count(*)::int as n from public.decisoes_agente where etapa = 'assistente:pedir_ao_agente'")).toEqual([{ n: 1 }]);
  });

  it('nova tentativa do job (IA falha depois da ferramenta): a mesma tarefa volta como já criada, sem 2ª tarefa nem 2ª demanda', async () => {
    await pergunta('pede pro contábil fazer o fechamento de outubro da Padaria Sol');
    const job = { usuarioId: claudia, canal: 'whatsapp' as const, conversaId: null, telefone: '5531911110001' };
    const pedir = () => usarFerramentas({ nome: 'pedir_ao_agente', entrada: { agente: 'contábil', empresa_id: empresa, pedido: 'Fazer o fechamento de outubro' } });
    const ia1 = new IaRoteirizada([pedir(), new Error('529 overloaded')]);
    await expect(processarAssistente({ repos, ia: ia1, canal: new CanalFalso(), fila: new FilaFalsa() }, job, false)).rejects.toThrow('529');
    const [t] = await sqlTeste<{ numero: number }>('select numero from public.agente_tarefas');
    const ia2 = new IaRoteirizada([pedir(), usarFerramentas({ nome: 'responder', entrada: { texto: 'Já estava pedido.' } }), fim()]);
    const fila2 = new FilaFalsa();
    await processarAssistente({ repos, ia: ia2, canal: new CanalFalso(), fila: fila2 }, job, true);
    expect(await sqlTeste('select count(*)::int as n from public.agente_tarefas')).toEqual([{ n: 1 }]);
    expect(await sqlTeste("select count(*)::int as n from public.chamados where titulo like 'Agente Contábil:%'")).toEqual([{ n: 1 }]);
    const r = resultadoDaFerramenta(ia2);
    expect(r.is_error).toBe(false);
    expect(JSON.parse(r.content)).toMatchObject({ tarefa: `T-${String(t!.numero).padStart(4, '0')}`, ja_criada: expect.stringContaining('já foi criada') });
    expect(fila2.enviados.map((e) => e.nome)).not.toContain('agente_trabalho');
  });

  it('agente fora da lista: a ferramenta devolve a frase e nada é criado', async () => {
    await pergunta('pede pro fiscal conferir as notas da Padaria Sol');
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'pedir_ao_agente', entrada: { agente: 'fiscal', empresa_id: empresa, pedido: 'Conferir as notas' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Não deu.' } }), fim(),
    ]);
    await processarAssistente({ repos, ia, canal: new CanalFalso() }, { usuarioId: claudia, canal: 'whatsapp', conversaId: null, telefone: '5531911110001' }, true);
    expect(resultadoDaFerramenta(ia)).toMatchObject({ is_error: true });
    expect(resultadoDaFerramenta(ia).content).toContain('Não achei esse agente entre os que você pode pedir: Agente Contábil.');
    expect(await sqlTeste('select count(*)::int as n from public.agente_tarefas')).toEqual([{ n: 0 }]);
  });

  it('prazo inválido não chega ao banco', async () => {
    await pergunta('pede pro contábil fechar outubro da Padaria Sol até ontem');
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'pedir_ao_agente', entrada: { agente: 'contábil', empresa_id: empresa, pedido: 'Fechar outubro', prazo: '01/01/2020' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'x' } }), fim(),
    ]);
    await processarAssistente({ repos, ia, canal: new CanalFalso() }, { usuarioId: claudia, canal: 'whatsapp', conversaId: null, telefone: '5531911110001' }, true);
    expect(resultadoDaFerramenta(ia).content).toContain('O prazo desejado precisa ser depois de agora e em até 90 dias.');
    expect(await sqlTeste('select count(*)::int as n from public.agente_tarefas')).toEqual([{ n: 0 }]);
  });

  it('WhatsApp com pendência repassada: "empréstimo" responde pela ferramenta (D11), sem verbo de pedido', async () => {
    const ch = (await db.from('chamados').insert({ cliente_id: empresa, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!.id;
    const t = await criarTarefaTeste({ chamadoId: ch, pedidaPor: claudia, estado: 'aguardando_pendencias',
      pendencias: [{ tipo: 'analista', pergunta: 'PIX para o sócio: o que é?', opcoes: ['lucro', 'empréstimo'] }] });
    await repassarPendenciaTeste(t.id, 1);
    await pergunta('empréstimo');
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'responder_pendencia_tarefa', entrada: { tarefa: t.numero, pendencia: 1, resposta: 'empréstimo' } }),
      usarFerramentas({ nome: 'responder', entrada: { texto: 'Anotado.' } }), fim(),
    ]);
    const fila = new FilaFalsa();
    await processarAssistente({ repos, ia, canal: new CanalFalso(), fila }, { usuarioId: claudia, canal: 'whatsapp', conversaId: null, telefone: '5531911110001' }, true);
    expect(nomes(ia.recebidos[0]!)).toContain('responder_pendencia_tarefa');
    expect(nomes(ia.recebidos[0]!)).not.toContain('pedir_ao_agente');
    expect(JSON.stringify(ia.recebidos[0]!.system![1])).toContain('<pendencias_do_agente>');
    expect(resultadoDaFerramenta(ia)).toMatchObject({ is_error: false });
    expect(await sqlTeste('select estado, resposta from public.agente_pendencias where tarefa_id = $1', [t.id])).toEqual([{ estado: 'respondida', resposta: 'empréstimo' }]);
    expect(fila.enviados.map((e) => e.nome)).toContain('agente_trabalho');
    expect(await sqlTeste("select count(*)::int as n from public.decisoes_agente where etapa = 'assistente:responder_pendencia_tarefa'")).toEqual([{ n: 1 }]);
  });

  it('site (Assistente do painel): sem pendências repassadas e sem gatilho, nenhuma leitura nova no banco', async () => {
    await pergunta('quais notas estão abertas?', 'site');
    const reposEspiao = new Proxy(repos, { get: (alvo, k) => {
      if (k === 'pendenciasRepassadas' || k === 'agentesParaPedir') throw new Error(`não devia chamar ${String(k)}`);
      return Reflect.get(alvo, k);
    } });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Nenhuma.' } }), fim()]);
    await processarAssistente({ repos: reposEspiao, ia, canal: new CanalFalso() }, { usuarioId: claudia, canal: 'site', conversaId: null, telefone: null }, true);
    expect(nomes(ia.recebidos[0]!)).not.toContain('pedir_ao_agente');
    expect(ia.recebidos[0]!.system).toHaveLength(1);
  });

  it('banco sem a I4: o Assistente responde como hoje (D17)', async () => {
    await pergunta('pede pro contábil fazer o fechamento');
    const semI4 = new Proxy(repos, { get: (alvo, k) =>
      k === 'agentesParaPedir' || k === 'pendenciasRepassadas' ? async () => null : Reflect.get(alvo, k) });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'ok' } }), fim()]);
    await processarAssistente({ repos: semI4, ia, canal: new CanalFalso() }, { usuarioId: claudia, canal: 'whatsapp', conversaId: null, telefone: '5531911110001' }, true);
    expect(ia.recebidos[0]!.system).toHaveLength(1);
    expect(nomes(ia.recebidos[0]!)).not.toContain('pedir_ao_agente');
  });
});
