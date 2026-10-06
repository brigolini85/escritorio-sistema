import { criarClienteServico, criarRepos } from '@escritorio/db';
import { criarClienteIa } from './agente/cliente-ia';
import { processarSimulacao } from './agente/simular';
import { criarAlertas } from './alertas';
import type { MensagemRecebida } from './canal/tipos';
import { criarCanalZapi } from './canal/zapi';
import { lerConfig } from './config';
import { driveDoAmbiente } from './drive/google';
import { anunciarSituacaoDrive } from './drive/situacao';
import { criarEmail } from './email';
import { LimitadorEnvio, enviarMensagemDoPainel, verificarEnviadaPorMim } from './envio';
import { processarAssistente } from './assistente/processar';
import { FILAS, criarBoss, filaDe, type JobAssistente, type JobPendencia, type JobSimulacao, type JobSugestao, type JobTarefa } from './fila';
import { criarArmazenamento } from './midia/armazenamento';
import { criarTranscritor } from './midia/transcritor';
import { processarConversa } from './processar-conversa';
import { limparRetencao } from './retencao';
import { canalDaSugestao } from './sugestao/ferramentas';
import { processarSugestao } from './sugestao/processar';
import { criarServidor } from './servidor';
import { enviarPedidoDePendencia } from './tarefa/pendencias';
import { processarTarefa } from './tarefa/processar';
import { alertasPeriodicos, batimento, demandasDeCertificado, resumoDiario } from './tarefas';

const FUSO = { tz: 'America/Sao_Paulo' };

async function principal() {
  const cfg = lerConfig();
  const relogio = () => new Date();
  const db = criarClienteServico(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
  const repos = criarRepos(db);
  // Parte I3b (D3, D9): o Drive só de leitura; sem a chave, as tarefas seguem só com os arquivos enviados.
  const drive = driveDoAmbiente(cfg.GOOGLE_DRIVE_CONTA_SERVICO);
  if (drive.erro) console.error('[drive]', drive.erro);
  await anunciarSituacaoDrive(repos, drive);
  const canal = criarCanalZapi({ instancia: cfg.ZAPI_INSTANCIA, token: cfg.ZAPI_TOKEN, clientToken: cfg.ZAPI_CLIENT_TOKEN });
  const midia = criarArmazenamento(db);
  const envio = { repos, canal, limitador: new LimitadorEnvio(20), midia };
  const email = criarEmail({ host: cfg.SMTP_HOST, porta: cfg.SMTP_PORTA, usuario: cfg.SMTP_USUARIO, senha: cfg.SMTP_SENHA, remetente: cfg.SMTP_REMETENTE });
  const alertas = criarAlertas({ repos, email, envio });
  const boss = await criarBoss(cfg.DATABASE_URL);
  const deps = {
    repos, envio, midia, alertas, relogio, fila: filaDe(boss),
    ia: criarClienteIa(cfg.ANTHROPIC_API_KEY),
    transcritor: criarTranscritor({
      baseUrl: cfg.TRANSCRICAO_BASE_URL, apiKey: cfg.TRANSCRICAO_API_KEY, modelo: cfg.TRANSCRICAO_MODELO, vocabulario: cfg.TRANSCRICAO_VOCABULARIO,
    }),
  };
  const depsTarefas = { repos, canal, alertas, envio, email, relogio, fila: filaDe(boss) };
  await boss.work<{ paths: string[] }>(FILAS.removerArquivos, async ([job]) => { await midia.remover(job!.data.paths); });
  // 4 consumidores: conversas diferentes andam em paralelo; a política "stately" garante uma execução por conversa.
  for (let i = 0; i < 4; i++) {
    await boss.work<{ conversaId: string }>(FILAS.processarConversa, { includeMetadata: true }, async ([job]) => {
      await processarConversa(deps, job!.data.conversaId, job!.retryCount >= job!.retryLimit);
    });
  }
  for (let i = 0; i < 2; i++) {
    await boss.work<JobAssistente>(FILAS.assistente, { includeMetadata: true }, async ([job]) => {
      await processarAssistente({ repos, ia: deps.ia, canal }, job!.data, job!.retryCount >= job!.retryLimit);
    });
  }
  // Testes do Treinar o agente: nada grava nem envia (o envio de `deps` é trocado por um bloqueado dentro da simulação).
  for (let i = 0; i < 2; i++) {
    await boss.work<JobSimulacao>(FILAS.simularAgente, { includeMetadata: true }, async ([job]) => {
      await processarSimulacao(deps, job!.data.simulacaoId, job!.retryCount >= job!.retryLimit);
    });
  }
  // Sugerir resposta (Atendimento): só leitura; nada é enviado nem gravado na conversa.
  for (let i = 0; i < 2; i++) {
    await boss.work<JobSugestao>(FILAS.sugerirResposta, { includeMetadata: true }, async ([job]) => {
      await processarSugestao({ repos, ia: deps.ia, canal: canalDaSugestao() }, job!.data.sugestaoId, job!.retryCount >= job!.retryLimit);
    });
  }
  // Parte I3a: tarefas de trabalho, uma de cada vez (máquina com pouca memória, D6). Nada envia ao cliente.
  await boss.work<JobTarefa>(FILAS.agenteTrabalho, { includeMetadata: true }, async ([job]) => {
    await processarTarefa({ repos, ia: deps.ia, midia, fila: filaDe(boss), relogio }, job!.data.tarefaId, job!.retryCount >= job!.retryLimit);
  });
  // Parte I3a (D7): o pedido de pendência que uma pessoa aprovou, na voz do Thiago.
  await boss.work<JobPendencia>(FILAS.pendenciaCliente, async ([job]) => {
    await enviarPedidoDePendencia({ repos, envio }, job!.data.pendenciaId);
  });
  await boss.work<{ mensagemId: string }>(FILAS.enviarMensagem, { includeMetadata: true }, async ([job]) => {
    await enviarMensagemDoPainel(envio, job!.data.mensagemId, job!.retryCount >= job!.retryLimit);
  });
  await boss.work<MensagemRecebida>(FILAS.verificarEnviadaPorMim, async ([job]) => {
    await verificarEnviadaPorMim(envio, job!.data);
  });
  await boss.work(FILAS.batimento, async () => batimento(depsTarefas));
  // A cada 5 minutos: demanda sem responsável e demanda vencida.
  await boss.work(FILAS.alertaFila, async () => alertasPeriodicos(depsTarefas));
  await boss.work(FILAS.resumoDiario, async () => resumoDiario(depsTarefas));
  await boss.schedule(FILAS.batimento, '* * * * *');
  await boss.schedule(FILAS.alertaFila, '*/5 * * * *');
  await boss.schedule(FILAS.resumoDiario, '0 18 * * 1-6', {}, FUSO);
  await boss.work(FILAS.limpezaRetencao, async () => { await limparRetencao(db, midia); });
  await boss.schedule(FILAS.limpezaRetencao, '0 3 * * *', {}, FUSO);
  // Todo dia às 07:00: certificado digital perto de vencer vira demanda no Fiscal (Parte H1).
  await boss.work(FILAS.certificados, async () => { await demandasDeCertificado(depsTarefas); });
  await boss.schedule(FILAS.certificados, '0 7 * * *', {}, FUSO);

  const app = criarServidor({ canal, repos, fila: filaDe(boss), segredo: cfg.WEBHOOK_SEGREDO, relogio });
  await app.listen({ host: '0.0.0.0', port: cfg.PORTA });

  let encerrando = false;
  const encerrar = async () => {
    if (encerrando) return;
    encerrando = true;
    app.log.info('Encerrando com calma: termina o que está em andamento e para de pegar tarefas novas.');
    await app.close();
    await boss.stop({ graceful: true, timeout: 30_000 });
    process.exit(0);
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

principal().catch((e) => {
  console.error('Falha ao iniciar o trabalhador:', e);
  process.exit(1);
});
