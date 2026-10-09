import type { Repos } from '@escritorio/db';
import type PgBoss from 'pg-boss';
import type { ClienteIa } from './agente/cliente-ia';
import { processarSimulacao } from './agente/simular';
import { processarAssistenteNaVez } from './assistente/processar';
import type { CanalWhatsApp, MensagemRecebida } from './canal/tipos';
import { enviarMensagemDoPainel, tratarEnviadaPorMim, type DepsEnvio } from './envio';
import {
  FILAS, filaDe, type JobAssistente, type JobAviso, type JobPastaDrive, type JobPendencia, type JobSimulacao, type JobSugestao, type JobTarefa,
} from './fila';
import type { DriveLeitor } from './drive/leitor';
import { removerArquivosDoJob } from './midia/remocao';
import { processarConversaNaVez, type DepsProcessamento } from './processar-conversa';
import { cicloRadar, enviosRadar } from './radar/ciclo';
import { limpezaNaVez, limparERegistrar, limparRetencao } from './retencao';
import { canalDaSugestao } from './sugestao/ferramentas';
import { processarSugestao } from './sugestao/processar';
import type { GuardarArquivo, RemoverArquivos } from './tarefa/armazenamento';
import { enviarAvisoTarefa } from './tarefa/avisos';
import { limparArquivosDasTarefas } from './tarefa/guarda';
import { lerPastaPedida } from './tarefa/pasta';
import { enviarPedidoDePendencia } from './tarefa/pendencias';
import { processarTarefa } from './tarefa/processar';
import { alertasPeriodicos, batimento, demandasDeCertificado, resumoDiario, type DepsTarefas } from './tarefas';

const FUSO = { tz: 'America/Sao_Paulo' };

/** O que os consumidores usam (montado na partida, em principal.ts). Só é lido dentro de cada job. */
export type ContextoConsumidores = {
  db: Parameters<typeof limparRetencao>[0];
  repos: Repos;
  canal: CanalWhatsApp;
  envio: DepsEnvio;
  midia: DepsProcessamento['midia'];
  relogio: () => Date;
  deps: DepsProcessamento & { ia: ClienteIa };
  depsTarefas: DepsTarefas;
  drive: DriveLeitor | null;
  guardar: GuardarArquivo;
  remover: RemoverArquivos;
  depsRadar: Parameters<typeof cicloRadar>[0];
};

/**
 * Auditoria 4.3: todos os consumidores e agendamentos do trabalhador num lugar só, ligados só depois que a partida confere
 * o AMBIENTE do banco (instancia.ts). Para sair das filas, o mesmo caminho do desligamento: offWork em cada fila (fila.ts).
 */
export async function ligarConsumidores(boss: Pick<PgBoss, 'work' | 'schedule'>, c: ContextoConsumidores): Promise<void> {
  const fila = () => filaDe(boss as PgBoss);
  await boss.work<{ paths: string[] }>(FILAS.removerArquivos, async ([job]) => {
    await removerArquivosDoJob(job!.data.paths, { anexos: (p) => c.midia.remover(p), tarefas: c.remover });
  });
  // 4 consumidores: conversas diferentes andam em paralelo; a trava do banco (naVez) garante uma execução por conversa.
  for (let i = 0; i < 4; i++) {
    await boss.work<{ conversaId: string }>(FILAS.processarConversa, { includeMetadata: true }, async ([job]) => {
      // Auditoria 4.15: o id do job vai na decisão inicio_vez, junto com o turno.
      await processarConversaNaVez({ ...c.deps, jobId: job!.id }, job!.data.conversaId, job!.retryCount >= job!.retryLimit);
    });
  }
  for (let i = 0; i < 2; i++) {
    await boss.work<JobAssistente>(FILAS.assistente, { includeMetadata: true }, async ([job]) => {
      await processarAssistenteNaVez({ repos: c.repos, ia: c.deps.ia, canal: c.canal, fila: fila() }, job!.data, job!.retryCount >= job!.retryLimit);
    });
  }
  // Testes do Treinar o agente: nada grava nem envia (o envio de `deps` é trocado por um bloqueado dentro da simulação).
  for (let i = 0; i < 2; i++) {
    await boss.work<JobSimulacao>(FILAS.simularAgente, { includeMetadata: true }, async ([job]) => {
      await processarSimulacao(c.deps, job!.data.simulacaoId, job!.retryCount >= job!.retryLimit);
    });
  }
  // Sugerir resposta (Atendimento): só leitura; nada é enviado nem gravado na conversa.
  for (let i = 0; i < 2; i++) {
    await boss.work<JobSugestao>(FILAS.sugerirResposta, { includeMetadata: true }, async ([job]) => {
      await processarSugestao({ repos: c.repos, ia: c.deps.ia, canal: canalDaSugestao() }, job!.data.sugestaoId, job!.retryCount >= job!.retryLimit);
    });
  }
  // Parte I3a: tarefas de trabalho, uma de cada vez (máquina com pouca memória, D6). Nada envia ao cliente.
  await boss.work<JobTarefa>(FILAS.agenteTrabalho, { includeMetadata: true }, async ([job]) => {
    await processarTarefa({ repos: c.repos, ia: c.deps.ia, midia: c.midia, fila: fila(), relogio: c.relogio, drive: c.drive, guardar: c.guardar, remover: c.remover },
      job!.data.tarefaId, job!.retryCount >= job!.retryLimit);
  });
  // Parte I3b (D7): LER A PASTA DE NOVO. Só leitura no Drive; copia para a tarefa o que for novo.
  // A última tentativa não lança (F4): o erro fica na linha do tempo da tarefa; sem Drive ou sem pasta, o motivo também.
  await boss.work<JobPastaDrive>(FILAS.pastaDrive, { includeMetadata: true }, async ([job]) => {
    const depsPasta = { repos: c.repos, drive: c.drive, guardar: c.guardar, remover: c.remover, relogio: c.relogio };
    await lerPastaPedida(depsPasta, job!.data.tarefaId, job!.retryCount >= job!.retryLimit);
  });
  // Parte I3a (D7): o pedido de pendência que uma pessoa aprovou, na voz do Thiago.
  await boss.work<JobPendencia>(FILAS.pendenciaCliente, async ([job]) => {
    await enviarPedidoDePendencia({ repos: c.repos, envio: c.envio }, job!.data.pendenciaId);
  });
  // Parte I4 (D9): aviso de pendência, pronto ou pausa ao WhatsApp de quem pediu (só a equipe; a reserva no banco impede o envio duplo).
  await boss.work<JobAviso>(FILAS.avisoTarefa, async ([job]) => {
    await enviarAvisoTarefa({ repos: c.repos, canal: c.canal }, job!.data.avisoId);
  });
  await boss.work<{ mensagemId: string }>(FILAS.enviarMensagem, { includeMetadata: true }, async ([job]) => {
    await enviarMensagemDoPainel(c.envio, job!.data.mensagemId, job!.retryCount >= job!.retryLimit);
  });
  await boss.work<MensagemRecebida>(FILAS.verificarEnviadaPorMim, async ([job]) => {
    await tratarEnviadaPorMim(c.envio, fila(), job!.data);
  });
  await boss.work(FILAS.batimento, async () => batimento(c.depsTarefas));
  // A cada 5 minutos: demanda sem responsável e demanda vencida.
  await boss.work(FILAS.alertaFila, async () => alertasPeriodicos(c.depsTarefas));
  await boss.work(FILAS.resumoDiario, async () => resumoDiario(c.depsTarefas));
  await boss.schedule(FILAS.batimento, '* * * * *');
  await boss.schedule(FILAS.alertaFila, '*/5 * * * *');
  await boss.schedule(FILAS.resumoDiario, '0 18 * * 1-6', {}, FUSO);
  // Auditoria 4.17: uma limpeza por vez (trava de 2 h, renovada enquanto roda); a segunda sai sem limpar.
  await boss.work(FILAS.limpezaRetencao, async () => {
    await limpezaNaVez(c.repos, async () => {
      // Auditoria 6.5: o resultado (contagens ou erro) fica em alertas; a falha vira alerta crítico e não pula a guarda.
      const falha = await limparERegistrar({ db: c.db, midia: c.midia, repos: c.repos, alertas: c.depsTarefas.alertas })
        .then(() => null, (e: unknown) => ({ e }));
      // Parte I3b (D14): a guarda dos arquivos das tarefas; uma falha aqui não desfaz a limpeza das conversas.
      await limparArquivosDasTarefas(c.repos, c.remover)
        .then((n) => { if (n > 0) console.log(`[guarda] ${n} arquivo(s) das tarefas apagado(s)`); })
        .catch((e) => console.error('[guarda] arquivos das tarefas', e));
      if (falha) throw falha.e;
    });
  });
  await boss.schedule(FILAS.limpezaRetencao, '0 3 * * *', {}, FUSO);
  // Todo dia às 07:00: certificado digital perto de vencer vira demanda no Fiscal (Parte H1).
  await boss.work(FILAS.certificados, async () => { await demandasDeCertificado(c.depsTarefas); });
  await boss.schedule(FILAS.certificados, '0 7 * * *', {}, FUSO);

  // Parte I5: o Radar de legislação. Só lê a web nas fontes do dono e grava sugestões; aos clientes, só o que uma pessoa aprovou.
  await boss.work(FILAS.radar, async () => { await cicloRadar(c.depsRadar); });
  await boss.schedule(FILAS.radar, '* * * * *');
  await boss.work(FILAS.radarEnvios, async () => { await enviosRadar(c.depsRadar); });
  await boss.schedule(FILAS.radarEnvios, '* * * * *');
}
