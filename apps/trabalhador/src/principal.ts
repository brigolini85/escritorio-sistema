import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { criarClienteServico, criarRepos, criarReposRadar } from '@escritorio/db';
import { criarClienteIa } from './agente/cliente-ia';
import { criarAlertas } from './alertas';
import { canalComTrava } from './canal/trava';
import { criarCanalZapi } from './canal/zapi';
import { lerConfig } from './config';
import { ligarConsumidores } from './consumidores';
import { driveDoAmbiente } from './drive/google';
import { anunciarSituacaoDrive } from './drive/situacao';
import { criarEmail } from './email';
import { LimitadorEnvio } from './envio';
import { criarBoss, encerrarComCalma, filaDe, pararDeConsumir } from './fila';
import { batimentoInstancia, novoEstadoInstancia, partida, situacaoDoProcesso, type Instancia } from './instancia';
import { criarArmazenamento } from './midia/armazenamento';
import { criarTranscritor } from './midia/transcritor';
import { criarClienteIaRadar } from './radar/cliente';
import { criarServidor } from './servidor';
import { guardarNaTarefa, removerDaTarefa } from './tarefa/armazenamento';

/** Auditoria 4.3: o batimento da instância (cada processo, a cada minuto). */
const BATIMENTO_INSTANCIA_MS = 60_000;

async function principal() {
  const cfg = lerConfig();
  const relogio = () => new Date();
  const db = criarClienteServico(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
  const repos = criarRepos(db);
  // Parte I3b (D3, D9): o Drive só de leitura; sem a chave, as tarefas seguem só com os arquivos enviados.
  const drive = driveDoAmbiente(cfg.GOOGLE_DRIVE_CONTA_SERVICO);
  if (drive.erro) console.error('[drive]', drive.erro);
  await anunciarSituacaoDrive(repos, drive);
  // Plano de prontidão (D1, D2): fora da produção, só os telefones da lista recebem mensagem (vale para todo envio, inclusive alertas ao dono).
  const canal = canalComTrava(criarCanalZapi({ instancia: cfg.ZAPI_INSTANCIA, token: cfg.ZAPI_TOKEN, clientToken: cfg.ZAPI_CLIENT_TOKEN }),
    { ambiente: cfg.AMBIENTE, permitidos: cfg.TELEFONES_PERMITIDOS },
    (b) => repos.registrarDecisao({ conversaId: null, clienteId: null, etapa: 'envio_bloqueado', entrada: b, saida: { ambiente: cfg.AMBIENTE } }));
  if (cfg.AMBIENTE !== 'producao') console.warn(`[trava] ${cfg.AMBIENTE}: só ${cfg.TELEFONES_PERMITIDOS.length} telefone(s) da lista recebem mensagem.`);
  const midia = criarArmazenamento(db, fetch, cfg.MIDIA_HOSTS_PERMITIDOS);
  // Parte I3b (D4): os arquivos da pasta do cliente vão para o compartimento "tarefas".
  const guardar = guardarNaTarefa(db);
  const remover = removerDaTarefa(db);
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
  // Parte I5: o Radar de legislação.
  const depsRadar = { repos, radar: criarReposRadar(db), ia: criarClienteIaRadar(cfg.ANTHROPIC_API_KEY), envio, relogio };

  // Auditoria 4.3: a partida confere o AMBIENTE do processo contra o do banco; diferente, nenhuma fila é consumida (o
  // servidor sobe assim mesmo, para o /saude dizer "ambiente").
  const estado = novoEstadoInstancia();
  const consome = await partida({
    repos, alertas, ambiente: cfg.AMBIENTE, estado,
    ligar: () => ligarConsumidores(boss, { db, repos, canal, envio, midia, relogio, deps, depsTarefas, drive: drive.leitor, guardar, remover, depsRadar }),
  });

  const app = criarServidor({ canal, repos, fila: filaDe(boss), segredo: cfg.WEBHOOK_SEGREDO, relogio, instancia: cfg.ZAPI_INSTANCIA,
    saudeToken: cfg.SAUDE_TOKEN, ambiente: cfg.AMBIENTE, situacaoProcesso: () => situacaoDoProcesso(estado) });
  await app.listen({ host: '0.0.0.0', port: cfg.PORTA });

  // Auditoria 4.3: cada processo se registra a cada minuto (o job "batimento" do pg-boss roda numa instância só). O processo
  // com o ambiente errado não se registra: ele já não consome, e a instância certa (mais antiga) não deve parar por causa dele.
  // VERSAO vem do build (Dockerfile.trabalhador, ARG VERSAO).
  const eu: Instancia = { id: randomUUID(), hostname: hostname(), ambiente: cfg.AMBIENTE, versao: process.env.VERSAO?.trim() || 'dev' };
  let pulso: ReturnType<typeof setInterval> | undefined;
  if (consome) {
    const bater = () => batimentoInstancia({ repos, alertas, eu, estado, pararDeConsumir: () => pararDeConsumir(boss) })
      .catch((e) => console.error('[instancia] batimento', e));
    await bater();
    pulso = setInterval(bater, BATIMENTO_INSTANCIA_MS);
  }

  let encerrando = false;
  const encerrar = async () => {
    if (encerrando) return;
    encerrando = true;
    app.log.info('Encerrando com calma: termina o que está em andamento e para de pegar tarefas novas.');
    // Auditoria 4.3: sai da lista de instâncias logo, para a nova não ver esta por mais 2 min (e não alertar à toa).
    clearInterval(pulso);
    if (consome) await repos.removerInstancia(eu.id).catch((e) => console.error('[instancia] não removida', e));
    await app.close();
    // Auditoria 4.1: espera as vezes em andamento (até 90 s) e solta as travas que ficarem; sem isso, a conversa ficava
    // parada até a trava vencer. O "stop grace period" do Easypanel precisa ser de 120 s (docs/operacao.md).
    const r = await encerrarComCalma(boss, repos);
    if (!r.terminaram) console.warn(`[fila] desligou com vez em andamento; ${r.soltas} trava(s) solta(s).`);
    process.exit(0);
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

principal().catch((e) => {
  console.error('Falha ao iniciar o trabalhador:', e);
  process.exit(1);
});
