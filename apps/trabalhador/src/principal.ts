import { criarClienteServico, criarRepos } from '@escritorio/db';
import { criarClienteIa } from './agente/cliente-ia';
import { processarSimulacao } from './agente/simular';
import { criarAlertas } from './alertas';
import type { MensagemRecebida } from './canal/tipos';
import { criarCanalZapi } from './canal/zapi';
import { lerConfig } from './config';
import { criarEmail } from './email';
import { LimitadorEnvio, enviarMensagemDoPainel, verificarEnviadaPorMim } from './envio';
import { processarAssistente } from './assistente/processar';
import { FILAS, criarBoss, filaDe, type JobAssistente, type JobSimulacao } from './fila';
import { criarArmazenamento } from './midia/armazenamento';
import { criarTranscritor } from './midia/transcritor';
import { processarConversa } from './processar-conversa';
import { limparRetencao } from './retencao';
import { criarServidor } from './servidor';
import { alertaFila, batimento, resumoDiario } from './tarefas';

const FUSO = { tz: 'America/Sao_Paulo' };

async function principal() {
  const cfg = lerConfig();
  const relogio = () => new Date();
  const db = criarClienteServico(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
  const repos = criarRepos(db);
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
  await boss.work<{ mensagemId: string }>(FILAS.enviarMensagem, { includeMetadata: true }, async ([job]) => {
    await enviarMensagemDoPainel(envio, job!.data.mensagemId, job!.retryCount >= job!.retryLimit);
  });
  await boss.work<MensagemRecebida>(FILAS.verificarEnviadaPorMim, async ([job]) => {
    await verificarEnviadaPorMim(envio, job!.data);
  });
  await boss.work(FILAS.batimento, async () => batimento(depsTarefas));
  await boss.work(FILAS.alertaFila, async () => { await alertaFila(depsTarefas); });
  await boss.work(FILAS.resumoDiario, async () => resumoDiario(depsTarefas));
  await boss.schedule(FILAS.batimento, '* * * * *');
  await boss.schedule(FILAS.alertaFila, '*/5 * * * *');
  await boss.schedule(FILAS.resumoDiario, '0 18 * * 1-6', {}, FUSO);
  await boss.work(FILAS.limpezaRetencao, async () => { await limparRetencao(db, midia); });
  await boss.schedule(FILAS.limpezaRetencao, '0 3 * * *', {}, FUSO);

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
