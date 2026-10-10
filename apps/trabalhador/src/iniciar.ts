import type { Repos } from '@escritorio/db';
import type PgBoss from 'pg-boss';
import type { Alertas } from './alertas';
import type { Ambiente } from './canal/trava';
import { ligarConsumidores, type ContextoConsumidores } from './consumidores';
import { pararDeConsumir } from './fila';
import { batimentoInstancia, partida, type EstadoInstancia, type Instancia } from './instancia';

/** Auditoria 4.3: o batimento da instância (cada processo, a cada minuto). */
export const BATIMENTO_INSTANCIA_MS = 60_000;

export type BossMinimo = Pick<PgBoss, 'work' | 'schedule' | 'offWork'>;

/**
 * Auditoria 4.3 (revisão): a ordem da partida de principal.ts, testável.
 *  1. Confere o AMBIENTE contra o banco. Diferente: nada mais (nem o pg-boss é criado, nem o Drive é anunciado); só o
 *     alerta ao dono é gravado.
 *  2. Certo: cria o pg-boss, prepara o contexto (o que escreve no banco vem aqui) e liga os consumidores.
 *  3. Batimento da instância agora e a cada minuto: sai das filas (offWork, o caminho do desligamento) e volta a elas
 *     (ligarConsumidores de novo) sem registrar em dobro.
 */
export async function iniciarConsumo<B extends BossMinimo>(d: {
  repos: Pick<Repos, 'ambienteDoBanco' | 'alertaRecente' | 'registrarInstancia' | 'removerInstancia'>;
  alertas: Alertas; ambiente: Ambiente; eu: Instancia; estado: EstadoInstancia;
  criarBoss: () => Promise<B>;
  preparar: (boss: B) => Promise<ContextoConsumidores>;
  ligar?: (boss: B, c: ContextoConsumidores) => Promise<void>;
  intervaloMs?: number;
  /** Endereços do banco (DATABASE_URL, SUPABASE_URL): com AMBIENTE=local, um remoto não carimba nem consome. */
  enderecosBanco?: string[];
  repetir?: (f: () => void, ms: number) => { parar(): void };
}): Promise<{ consome: boolean; boss: B | null; bater: () => Promise<void>; sair: () => Promise<void> }> {
  const ligar = d.ligar ?? ((boss: B, c: ContextoConsumidores) => ligarConsumidores(boss, c));
  const repetir = d.repetir ?? ((f, ms) => { const h = setInterval(f, ms); return { parar: () => clearInterval(h) }; });
  let boss: B | null = null;
  let contexto: ContextoConsumidores | null = null;
  let ligado = false;
  // Idempotentes: ligar duas vezes não registra consumidor em dobro; parar sem estar ligado não faz nada.
  // Revisão final (T8): dois batimentos sobrepostos (um lento e o seguinte) esperam a mesma ligação em andamento, em vez
  // de os dois verem `ligado = false` e registrarem os consumidores em dobro.
  let ligando: Promise<void> | null = null;
  const ligarConsumo = async (): Promise<void> => {
    if (ligando) return ligando;
    if (ligado || !boss || !contexto) return;
    const b = boss;
    const c = contexto;
    ligando = (async () => {
      try {
        await ligar(b, c);
        ligado = true;
      } catch (e) {
        // Ligou só uma parte: desliga o que entrou, para a próxima tentativa começar do zero.
        await pararDeConsumir(b);
        throw e;
      }
    })().finally(() => { ligando = null; });
    return ligando;
  };
  const pararConsumo = async () => {
    // Uma ligação em andamento termina antes (senão ela marcaria `ligado` depois da parada).
    if (ligando) await ligando.catch(() => {});
    if (!ligado || !boss) return;
    ligado = false;
    await pararDeConsumir(boss);
  };

  const consome = await partida({
    repos: d.repos, alertas: d.alertas, ambiente: d.ambiente, estado: d.estado,
    ligar: async () => {
      boss = await d.criarBoss();
      contexto = await d.preparar(boss);
      await ligarConsumo();
    },
  });
  if (!consome) return { consome, boss: null, bater: async () => {}, sair: async () => {} };

  const bater = () => batimentoInstancia({
    repos: d.repos, alertas: d.alertas, eu: d.eu, estado: d.estado, pararDeConsumir: pararConsumo, voltarAConsumir: ligarConsumo,
  }).catch((e) => console.error('[instancia] batimento', e));
  await bater();
  const pulso = repetir(() => { void bater(); }, d.intervaloMs ?? BATIMENTO_INSTANCIA_MS);
  let saiu = false;
  const sair = async () => {
    if (saiu) return;
    saiu = true;
    pulso.parar();
    // Sai da lista de instâncias logo, para a nova não ver esta por mais 2 min (e não alertar à toa).
    await d.repos.removerInstancia(d.eu.id).catch((e) => console.error('[instancia] não removida', e));
  };
  return { consome, boss, bater, sair };
}
