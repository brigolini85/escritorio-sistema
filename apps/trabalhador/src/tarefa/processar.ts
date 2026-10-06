import { etapasDoProcedimento, mesReferencia, type MotivoFimVez } from '@escritorio/core';
import type { Repos } from '@escritorio/db';
import { erroTemporarioIa } from '../agente/cliente-ia';
import { carregarPerfil } from '../agente/perfil';
import { agendarTarefa } from '../fila';
import { executarTarefa, type DepsTarefa } from './executar';
import type { VezDaTarefa } from './ferramentas';
import { montarSistemaTarefa } from './prompt';

let avisouSemI3 = false;
const segundosDesde = (inicio: Date, agora: Date) => Math.max(0, (agora.getTime() - inicio.getTime()) / 1000);

/** D22: null em iniciarExecucaoTarefa também é "não pegou"; só a falta da tabela (a leitura falha) é banco sem a I3. */
async function bancoSemI3(repos: Repos, id: string): Promise<boolean> {
  try {
    await repos.situacaoTarefa(id);
    return false;
  } catch {
    return true;
  }
}

/**
 * Parte I3a: uma vez da tarefa (fila agente_trabalho). O banco decide o estado seguinte (finalizar_vez_tarefa); se a tarefa continua
 * trabalhando (30 rodadas, 20 min, ou resposta que chegou no meio, D8), volta à fila.
 */
export async function processarTarefa(d: DepsTarefa, tarefaId: string, ultimaTentativa: boolean): Promise<void> {
  // F6: a marca desta vez; volta no finalizar para uma vez zumbi não apagar a marca de uma vez nova.
  const desde = await d.repos.iniciarExecucaoTarefa(tarefaId);
  if (desde === null) {
    if (!avisouSemI3 && (await bancoSemI3(d.repos, tarefaId))) {
      avisouSemI3 = true;
      console.warn('[tarefa] as tarefas ainda não estão no banco (Parte I3): nada a fazer');
    }
    return;
  }
  const inicio = d.relogio();
  let motivo: MotivoFimVez;
  try {
    motivo = await umaVez(d, tarefaId, inicio);
  } catch (e) {
    if (erroTemporarioIa(e) && !ultimaTentativa) {
      // A fila tenta de novo: só solta a vez, sem mudar o estado.
      await d.repos.finalizarVezTarefa(tarefaId, segundosDesde(inicio, d.relogio()), 'continuar', desde);
      throw e;
    }
    console.error('[tarefa] a vez falhou', tarefaId, e);
    motivo = 'falha';
  }
  const estado = await d.repos.finalizarVezTarefa(tarefaId, segundosDesde(inicio, d.relogio()), motivo, desde);
  if (estado === 'trabalhando') await agendarTarefa(d.fila, tarefaId);
}

async function umaVez(d: DepsTarefa, id: string, inicio: Date): Promise<MotivoFimVez> {
  // D8/F4: marca as respostas vistas ANTES do retrato; o que for respondido depois fica não visto e a tarefa volta à fila.
  await d.repos.marcarPendenciasVistas(id);
  const t = await d.repos.tarefaParaTrabalho(id);
  if (!t) return 'falha';
  if (t.agenteEstado === 'desligado' || !t.agenteTipos.includes('trabalho')) return 'agente_desligado';
  const config = await d.repos.obterConfiguracoes();
  if ((await d.repos.custoIaDoMes(mesReferencia(inicio))) >= config.tetoIaUsd) return 'teto';
  const perfil = await carregarPerfil(d.repos, t.agenteSlug);
  if (!t.etapas.length) {
    // D5: as etapas do procedimento escolhido (ligado, do próprio agente); sem ele, as padrão.
    const corpo = t.skillNome ? perfil.skills.find((s) => s.nome === t.skillNome && s.tipo === 'procedimento')?.corpo ?? null : null;
    const nomes = etapasDoProcedimento(corpo);
    await d.repos.definirEtapasTarefa(t.id, nomes);
    t.etapas = nomes.map((nome) => ({ nome, concluida: false, resumo: null }));
    t.etapaAtual = 1;
  }
  const [orientacoes, setores] = await Promise.all([d.repos.orientacoesAtivas(perfil.id), d.repos.setoresAtivos()]);
  const vez: VezDaTarefa = { tarefa: t, perfil, entregou: false, abriuPendencia: false, lidosNaVez: 0 };
  const motivo = await executarTarefa(d, vez, config, montarSistemaTarefa(t, perfil, orientacoes, setores), inicio);
  if (vez.lidosNaVez) await d.repos.eventoTarefa(t.id, `leu ${vez.lidosNaVez} arquivo${vez.lidosNaVez > 1 ? 's' : ''}`);
  return motivo;
}
