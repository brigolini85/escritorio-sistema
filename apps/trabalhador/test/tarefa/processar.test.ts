import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repos } from '@escritorio/db';
import { anexarArquivoTeste, configurarAgenteTeste, criarSkillTeste, criarTarefaTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import type { ClienteIa, ParametrosIa } from '../../src/agente/cliente-ia';
import { FILAS } from '../../src/fila';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { LEMBRETE_TAREFA } from '../../src/tarefa/executar';
import { processarTarefa } from '../../src/tarefa/processar';
import { db, repos, setorId } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada, fim, textoSolto, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

const PROC = '# Fechamento\n\n## Etapas\n1. Coletar documentos\n2. Ler e lançar\n3. Revisar pendências';
let chamadoId: string;
let fila: FilaFalsa;
const deps = (ia: ClienteIa, relogio = () => new Date()) => ({ repos, ia, midia: criarArmazenamento(db), fila, relogio });
const estado = async (id: string) => (await repos.tarefaParaTrabalho(id))!;

beforeEach(async () => {
  await limparBanco();
  fila = new FilaFalsa();
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  const cl = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!;
  chamadoId = (await db.from('chamados').insert({ cliente_id: cl.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento de outubro' })
    .select('id').single()).data!.id;
});

describe('a vez da tarefa (D5, D6, D8, D12, D13)', () => {
  it('primeira vez: etapas do procedimento, lê, conclui etapa, entrega com fonte → pronta; custo com a tarefa e quem pediu', async () => {
    await criarSkillTeste('contabil', 'fechamento-mensal', 'procedimento', true, [], { titulo: 'Fechamento', descricao: 'Fechar o mês.', corpo: PROC });
    const pessoa = await criarUsuarioTeste({ email: 'claudia@tarefa.local', papel: 'atendente', setores: ['Contábil'] });
    const t = await criarTarefaTeste({ chamadoId, skill: 'fechamento-mensal', pedidaPor: pessoa });
    await anexarArquivoTeste(t.id, { nome: 'extrato.csv', conteudo: 'data;historico;valor\n01/10;Tarifa;-12,50' });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'ler_arquivo', entrada: { nome: 'extrato.csv' } }),
      usarFerramentas({ nome: 'concluir_etapa', entrada: { etapa: 1, resumo: 'leu 1 arquivo' } }),
      usarFerramentas({ nome: 'entregar_resultado', entrada: { resumo: 'Prévia de outubro.', destaques: [{ rotulo: 'Lançamentos', valor: '1', detalhe: null }],
        linhas: [{ descricao: 'Tarifa bancária', valor: 12.5, texto: null, fonte: 'extrato.csv', provisoria: false }], observacoes: null } }),
      fim(),
    ]);
    await processarTarefa(deps(ia), t.id, false);
    const x = await estado(t.id);
    expect(x.estado).toBe('pronta');
    expect(x.etapas.map((e) => e.nome)).toEqual(['Coletar documentos', 'Ler e lançar', 'Revisar pendências', 'Aprovação']);
    expect(x.etapaAtual).toBe(4);
    expect(ia.recebidos[0]!.tools!.map((f) => (f as Anthropic.Tool).name)).toContain('ler_skill');
    const usos = (await db.from('uso_ia').select('funcionalidade, tarefa_id, usuario_id, agente_id')).data!;
    expect(usos).toHaveLength(4);
    expect(usos.every((u) => u.funcionalidade === 'especialista_setor' && u.tarefa_id === t.id && u.usuario_id === pessoa)).toBe(true);
    const custo = (await sqlTeste<{ e: Record<string, number> }>('select custo_etapas as e from public.agente_tarefas where id = $1', [t.id]))[0]!.e;
    expect(Object.keys(custo).sort()).toEqual(['1', '2']);
    expect(fila.enviados).toEqual([]);
  });

  it('abre pendência para o analista e para → aguardando pendências (sem voltar à fila)', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Fazer', 'Aprovação'] });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_pendencia', entrada: { tipo: 'analista', pergunta: 'PIX de R$ 3.200 é pró-labore?', detalhe: null,
        opcoes: ['Pró-labore', 'Distribuição de lucro'], mensagem_ao_cliente: null } }),
      fim(),
    ]);
    await processarTarefa(deps(ia), t.id, false);
    expect((await estado(t.id)).estado).toBe('aguardando_pendencias');
    expect(fila.enviados).toEqual([]);
  });

  it('limite de custo já alcançado: pausa antes de chamar a IA (nenhuma chamada a mais)', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'], limiteUsd: 0.5, custoUsd: 0.5 });
    const ia = new IaRoteirizada([]);
    await processarTarefa(deps(ia), t.id, false);
    expect(ia.recebidos).toHaveLength(0);
    expect(await sqlTeste('select estado, motivo_pausa from public.agente_tarefas where id = $1', [t.id])).toEqual([{ estado: 'pausada', motivo_pausa: 'limite_custo' }]);
  });

  it('limite de tempo no meio da vez: pausa com o motivo', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'], limiteMinutos: 1 });
    let agora = new Date('2026-10-01T12:00:00Z').getTime();
    const relogio = () => new Date((agora += 40_000));
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'anotar', entrada: { texto: 'começando' } })]);
    await processarTarefa(deps(ia, relogio), t.id, false);
    expect(ia.recebidos).toHaveLength(1);
    expect((await sqlTeste('select motivo_pausa from public.agente_tarefas where id = $1', [t.id]))[0]).toEqual({ motivo_pausa: 'limite_tempo' });
  });

  it('teto do mês e agente desligado: pausam sem chamar a IA', async () => {
    const t1 = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'] });
    await db.from('configuracoes').update({ teto_ia_usd: 0 }).eq('id', 1);
    await processarTarefa(deps(new IaRoteirizada([])), t1.id, false);
    expect((await sqlTeste('select motivo_pausa from public.agente_tarefas where id = $1', [t1.id]))[0]).toEqual({ motivo_pausa: 'teto' });
    await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
    await sqlTeste("update public.agente_tarefas set estado = 'trabalhando', motivo_pausa = null where id = $1", [t1.id]);
    await configurarAgenteTeste('contabil', { estado: 'desligado' });
    await processarTarefa(deps(new IaRoteirizada([])), t1.id, false);
    expect((await sqlTeste('select motivo_pausa from public.agente_tarefas where id = $1', [t1.id]))[0]).toEqual({ motivo_pausa: 'agente_desligado' });
  });

  it('pessoa pausa no meio: a vez para na rodada seguinte e o estado fica o da pessoa', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'] });
    let n = 0;
    const ia: ClienteIa = { criar: async (_p: ParametrosIa) => {
      if (n++ === 0) await sqlTeste("update public.agente_tarefas set estado = 'pausada', motivo_pausa = 'pessoa' where id = $1", [t.id]);
      return usarFerramentas({ nome: 'anotar', entrada: { texto: 'x' } });
    } };
    await processarTarefa(deps(ia), t.id, false);
    expect(n).toBe(1);
    expect((await sqlTeste('select estado, motivo_pausa from public.agente_tarefas where id = $1', [t.id]))[0]).toEqual({ estado: 'pausada', motivo_pausa: 'pessoa' });
    expect(fila.enviados).toEqual([]);
  });

  it('resposta que chega no meio da vez: não vai para aprovar sem o agente ver; volta à fila (D8)', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'], resultado: { versao: 1, resumo: 'Prévia.', destaques: [], linhas: [], observacoes: null },
      pendencias: [{ tipo: 'analista', pergunta: 'PIX é pró-labore?' }] });
    const ia: ClienteIa = { criar: async () => {
      await sqlTeste("update public.agente_pendencias set estado = 'respondida', resposta = 'Pró-labore', respondida_em = now() where id = $1", [t.pendencias[0]]);
      return fim();
    } };
    await processarTarefa(deps(ia), t.id, false);
    expect((await estado(t.id)).estado).toBe('trabalhando');
    expect(fila.enviados).toEqual([{ nome: FILAS.agenteTrabalho, dados: { tarefaId: t.id }, opcoes: { singletonKey: t.id } }]);
  });

  it('parou sem resultado nem pendência: um lembrete e depois pausa', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'] });
    const ia = new IaRoteirizada([textoSolto('Vou começar.'), textoSolto('Pronto.')]);
    await processarTarefa(deps(ia), t.id, false);
    expect(JSON.stringify(ia.recebidos[1]!.messages.at(-1))).toContain(LEMBRETE_TAREFA);
    expect((await sqlTeste('select motivo_pausa from public.agente_tarefas where id = $1', [t.id]))[0]).toEqual({ motivo_pausa: 'sem_resultado' });
  });

  it('30 rodadas: fecha a vez e volta à fila (continua)', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'] });
    const ia = new IaRoteirizada(Array.from({ length: 30 }, () => usarFerramentas({ nome: 'listar_arquivos', entrada: {} })));
    await processarTarefa(deps(ia), t.id, false);
    expect((await estado(t.id)).estado).toBe('trabalhando');
    expect(fila.enviados).toHaveLength(1);
  });

  it('erro temporário da IA: solta a vez sem mudar o estado e deixa a fila tentar; na última tentativa, pausa com falha', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'] });
    const temporario = () => new Anthropic.APIConnectionError({ message: 'sem rede' });
    await expect(processarTarefa(deps(new IaRoteirizada([temporario()])), t.id, false)).rejects.toThrow();
    expect(await sqlTeste('select estado, executando_desde from public.agente_tarefas where id = $1', [t.id])).toEqual([{ estado: 'trabalhando', executando_desde: null }]);
    await processarTarefa(deps(new IaRoteirizada([temporario()])), t.id, true);
    expect((await sqlTeste('select motivo_pausa from public.agente_tarefas where id = $1', [t.id]))[0]).toEqual({ motivo_pausa: 'falha' });
  });

  it('20 minutos na mesma vez: não abre rodada nova, solta a marca e volta à fila (F6)', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'], limiteMinutos: 240 });
    let agora = new Date('2026-10-01T12:00:00Z').getTime();
    const relogio = () => new Date((agora += 11 * 60_000));
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'anotar', entrada: { texto: 'começando' } })]);
    await processarTarefa(deps(ia, relogio), t.id, false);
    expect(ia.recebidos).toHaveLength(1);
    expect(await sqlTeste('select estado, executando_desde from public.agente_tarefas where id = $1', [t.id])).toEqual([{ estado: 'trabalhando', executando_desde: null }]);
    expect(fila.enviados).toEqual([{ nome: FILAS.agenteTrabalho, dados: { tarefaId: t.id }, opcoes: { singletonKey: t.id } }]);
  });

  it('banco sem a I3: não quebra e avisa uma vez (D22)', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const semI3 = { iniciarExecucaoTarefa: async () => null } as unknown as Repos;
    await processarTarefa({ ...deps(new IaRoteirizada([])), repos: semI3 }, 'qualquer', false);
    await processarTarefa({ ...deps(new IaRoteirizada([])), repos: semI3 }, 'qualquer', false);
    expect(aviso).toHaveBeenCalledTimes(1);
  });
});
