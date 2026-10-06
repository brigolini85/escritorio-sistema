import { etapasDoProcedimento, mesReferencia, type MotivoFimVez } from '@escritorio/core';
import { SemI3b, type OpcoesDoPedido, type Repos } from '@escritorio/db';
import { erroTemporarioIa } from '../agente/cliente-ia';
import { carregarPerfil } from '../agente/perfil';
import { agendarTarefa } from '../fila';
import { executarTarefa, type DepsTarefa } from './executar';
import type { VezDaTarefa } from './ferramentas';
import { lerPastaComAviso, type DepsPasta } from './pasta';
import { montarSistemaTarefa } from './prompt';

let avisouSemI3 = false;
let avisouPasta = false;
const segundosDesde = (inicio: Date, agora: Date) => Math.max(0, (agora.getTime() - inicio.getTime()) / 1000);
const DATA_HORA_BRASILIA = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

/** I4 (D7): o prazo desejado vai ao agente numa linha; não muda o prazo da demanda. */
export function linhaDoPedido(o: OpcoesDoPedido): string | null {
  if (!o.prazoDesejado) return null;
  const quando = DATA_HORA_BRASILIA.format(new Date(o.prazoDesejado)).replace(', ', ' ');
  return `Prazo desejado por quem pediu: ${quando} (Brasília). Se não der tempo, diga nas observações.`;
}

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
  // I4 (D7, D17): null = banco sem a I4; a vez segue como na I3b.
  const opcoes = await d.repos.opcoesDoPedido(t.id).catch(() => null);
  const perfil = await carregarPerfil(d.repos, t.agenteSlug);
  const primeiraVez = t.etapas.length === 0;
  if (!t.etapas.length) {
    // D5: as etapas do procedimento escolhido (ligado, do próprio agente); sem ele, as padrão.
    const corpo = t.skillNome ? perfil.skills.find((s) => s.nome === t.skillNome && s.tipo === 'procedimento')?.corpo ?? null : null;
    const nomes = etapasDoProcedimento(corpo);
    await d.repos.definirEtapasTarefa(t.id, nomes);
    t.etapas = nomes.map((nome) => ({ nome, concluida: false, resumo: null }));
    t.etapaAtual = 1;
  }
  const [orientacoes, setores] = await Promise.all([d.repos.orientacoesAtivas(perfil.id), d.repos.setoresAtivos()]);
  // I3b (D7): com Drive e pasta, a primeira vez lê a pasta sozinha; depois, só pela ferramenta ou por LER A PASTA DE NOVO.
  let lerPasta: VezDaTarefa['lerPasta'];
  if (d.drive && d.guardar && d.remover) {
    const depsPasta: DepsPasta = { repos: d.repos, drive: d.drive, guardar: d.guardar, remover: d.remover, relogio: d.relogio };
    const p = await d.repos.pastaDriveDaTarefa(t.id).catch(async (e) => {
      // F4: banco sem a I3b é esperado (lerPastaDaTarefa avisa); qualquer outro erro aparece no log, uma vez.
      if (!(e instanceof SemI3b) && !avisouPasta) {
        avisouPasta = true;
        console.error('[drive] não deu para saber a pasta da tarefa', id, e instanceof Error ? e.message : e);
      }
      // I4 (D19b): a leitura automática que não aconteceu deixa rastro na linha do tempo.
      if (!(e instanceof SemI3b) && primeiraVez) {
        await d.repos.eventoTarefa(id, 'não deu para ler a pasta do Drive agora: use Ler a pasta de novo').catch(() => {});
      }
      return null;
    });
    if (p?.pasta) {
      // F4: lerPastaComAviso nunca lança; o Drive nunca derruba a vez.
      lerPasta = (sub) => lerPastaComAviso(depsPasta, t.id, sub);
      if (primeiraVez && opcoes?.lerDrive !== false) {
        const r = await lerPasta(opcoes?.subpasta ?? null);
        if (r.situacao === 'lida' && r.novos.length) t.arquivos = (await d.repos.tarefaParaTrabalho(t.id).catch(() => null))?.arquivos ?? t.arquivos;
      }
    }
  }
  const vez: VezDaTarefa = { tarefa: t, perfil, entregou: false, abriuPendencia: false, lidosNaVez: 0, ...(lerPasta ? { lerPasta } : {}) };
  const system = montarSistemaTarefa(t, perfil, orientacoes, setores);
  const linha = opcoes ? linhaDoPedido(opcoes) : null;
  if (linha) system.push({ type: 'text', text: linha });
  const motivo = await executarTarefa(d, vez, config, system, inicio);
  if (vez.lidosNaVez) await d.repos.eventoTarefa(t.id, `leu ${vez.lidosNaVez} arquivo${vez.lidosNaVez > 1 ? 's' : ''}`);
  return motivo;
}
