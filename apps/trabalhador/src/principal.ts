import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { criarClienteServico, criarRepos, criarReposRadar } from '@escritorio/db';
import { criarClienteIa } from './agente/cliente-ia';
import { criarAlertas } from './alertas';
import { canalComTrava } from './canal/trava';
import { criarCanalZapi } from './canal/zapi';
import { lerConfig } from './config';
import { driveDoAmbiente } from './drive/google';
import { anunciarSituacaoDrive } from './drive/situacao';
import { criarEmail } from './email';
import { LimitadorEnvio, type DepsEnvio } from './envio';
import { criarBoss, encerrarComCalma, filaDe, type Fila } from './fila';
import { iniciarConsumo } from './iniciar';
import { lerBuild, novoEstadoInstancia, situacaoDoProcesso, type Instancia } from './instancia';
import { criarArmazenamento } from './midia/armazenamento';
import { criarTranscritor } from './midia/transcritor';
import { criarClienteIaRadar } from './radar/cliente';
import { criarServidor } from './servidor';
import { guardarNaTarefa, removerDaTarefa } from './tarefa/armazenamento';

/** Ambiente errado: não há pg-boss; o servidor nunca enfileira (o webhook responde 503 antes). */
const FILA_FECHADA: Fila = { enviar: async () => { throw new Error('fila fechada: o AMBIENTE deste trabalhador não é o do banco'); } };

async function principal() {
  const cfg = lerConfig();
  const relogio = () => new Date();
  const db = criarClienteServico(cfg.SUPABASE_URL, cfg.SUPABASE_SERVICE_ROLE_KEY);
  const repos = criarRepos(db);
  // Parte I3b (D3, D9): o Drive só de leitura; sem a chave, as tarefas seguem só com os arquivos enviados.
  const drive = driveDoAmbiente(cfg.GOOGLE_DRIVE_CONTA_SERVICO);
  if (drive.erro) console.error('[drive]', drive.erro);
  // Plano de prontidão (D1, D2): fora da produção, só os telefones da lista recebem mensagem (vale para todo envio, inclusive alertas ao dono).
  const canal = canalComTrava(criarCanalZapi({ instancia: cfg.ZAPI_INSTANCIA, token: cfg.ZAPI_TOKEN, clientToken: cfg.ZAPI_CLIENT_TOKEN }),
    { ambiente: cfg.AMBIENTE, permitidos: cfg.TELEFONES_PERMITIDOS },
    (b) => repos.registrarDecisao({ conversaId: null, clienteId: null, etapa: 'envio_bloqueado', entrada: b, saida: { ambiente: cfg.AMBIENTE } }));
  if (cfg.AMBIENTE !== 'producao') console.warn(`[trava] ${cfg.AMBIENTE}: só ${cfg.TELEFONES_PERMITIDOS.length} telefone(s) da lista recebem mensagem.`);
  const midia = criarArmazenamento(db, fetch, cfg.MIDIA_HOSTS_PERMITIDOS);
  // Parte I3b (D4): os arquivos da pasta do cliente vão para o compartimento "tarefas".
  const guardar = guardarNaTarefa(db);
  const remover = removerDaTarefa(db);
  // Auditoria 3.11: o limite de avisos do sistema conta no banco; sem vaga, o aviso vai para a fila (posta ao preparar).
  const envio: DepsEnvio = { repos, canal, limitador: new LimitadorEnvio(20), midia };
  const email = criarEmail({ host: cfg.SMTP_HOST, porta: cfg.SMTP_PORTA, usuario: cfg.SMTP_USUARIO, senha: cfg.SMTP_SENHA, remetente: cfg.SMTP_REMETENTE });
  const alertas = criarAlertas({ repos, email, envio });
  // Auditoria 4.3: a partida confere o AMBIENTE do processo contra o do banco antes de qualquer escrita (pg-boss, Drive).
  // Diferente: nenhuma fila é consumida e o webhook responde 503; o servidor sobe assim mesmo, para o /saude dizer "ambiente".
  // A versão e a data do build vêm da imagem (Dockerfile.trabalhador); fora do contêiner, "dev".
  const estado = novoEstadoInstancia();
  const eu: Instancia = { id: randomUUID(), hostname: hostname(), ambiente: cfg.AMBIENTE, ...lerBuild(process.cwd()) };
  const inicio = await iniciarConsumo({
    repos, alertas, ambiente: cfg.AMBIENTE, eu, estado,
    criarBoss: () => criarBoss(cfg.DATABASE_URL),
    preparar: async (boss) => {
      await anunciarSituacaoDrive(repos, drive);
      envio.fila = filaDe(boss);
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
      return { db, repos, canal, envio, midia, relogio, deps, depsTarefas, drive: drive.leitor, guardar, remover, depsRadar };
    },
  });
  const boss = inicio.boss;
  if (!inicio.consome) console.error('[instancia] este trabalhador não atende: o AMBIENTE dele não é o do banco.');

  const app = criarServidor({ canal, repos, fila: boss ? filaDe(boss) : FILA_FECHADA, segredo: cfg.WEBHOOK_SEGREDO, relogio, instancia: cfg.ZAPI_INSTANCIA,
    saudeToken: cfg.SAUDE_TOKEN, ambiente: cfg.AMBIENTE, build: { versao: eu.versao, buildEm: eu.buildEm }, situacaoProcesso: () => situacaoDoProcesso(estado),
    webhookAberto: () => !estado.ambienteDoBanco });
  await app.listen({ host: '0.0.0.0', port: cfg.PORTA });

  let encerrando = false;
  const encerrar = async () => {
    if (encerrando) return;
    encerrando = true;
    app.log.info('Encerrando com calma: termina o que está em andamento e para de pegar tarefas novas.');
    // Auditoria 4.3: sai da lista de instâncias logo, para a nova não ver esta por mais 2 min (e não alertar à toa).
    await inicio.sair();
    await app.close();
    // Auditoria 4.1: espera as vezes em andamento (até 90 s) e solta as travas que ficarem; sem isso, a conversa ficava
    // parada até a trava vencer. O "stop grace period" do Easypanel precisa ser de 120 s (docs/operacao.md).
    const r = boss ? await encerrarComCalma(boss, repos) : { terminaram: true, soltas: 0 };
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
