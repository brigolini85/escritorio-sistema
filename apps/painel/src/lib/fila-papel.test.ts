import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import PgBoss from 'pg-boss';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { exigirBancoLocal } from '../../e2e/trava-local';

// Auditoria 2.9: no banco local de verdade, um login temporário com os grants de painel_fila (o que o dono cria na
// nuvem) enfileira pelo código do painel e não lê public.mensagens. Sem DATABASE_URL (sem Supabase local), pula.
config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)) });
vi.mock('server-only', () => ({}));

const ADMIN = process.env.DATABASE_URL;
const PAPEL = `teste_fila_${randomBytes(4).toString('hex')}`;
const SENHA = randomBytes(16).toString('hex');

describe.skipIf(!ADMIN)('papel painel_fila no banco local', () => {
  let admin: PgBoss;
  let urlFila: string;
  let fila: typeof import('./fila');

  beforeAll(async () => {
    exigirBancoLocal(ADMIN, 'DATABASE_URL');
    admin = new PgBoss({ connectionString: ADMIN!, supervise: false, schedule: false, max: 1 });
    await admin.start();
    await admin.createQueue('enviar-mensagem', { name: 'enviar-mensagem', retryLimit: 5, retryDelay: 10, retryBackoff: true });
    await admin.getDb().executeSql('select public.conceder_fila_painel()', []);
    await admin.getDb().executeSql(`create role ${PAPEL} login password '${SENHA}' in role painel_fila`, []);
    const u = new URL(ADMIN!);
    u.username = PAPEL;
    u.password = SENHA;
    urlFila = u.toString();
    vi.stubEnv('DATABASE_URL_FILA', urlFila);
    // A DATABASE_URL do dono não serve: se o painel caísse nela, o teste falharia em vez de passar por engano.
    vi.stubEnv('DATABASE_URL', 'postgresql://ninguem:x@127.0.0.1:1/postgres');
    fila = await import('./fila');
  }, 30_000);

  afterAll(async () => {
    vi.unstubAllEnvs();
    await fila?.fecharFila();
    if (admin) {
      await admin.getDb().executeSql(`drop role if exists ${PAPEL}`, []);
      await admin.stop({ graceful: false });
    }
  });

  it('o painel enfileira o envio com o papel próprio', async () => {
    const id = randomUUID();
    await fila.enfileirarEnvio(id);
    const { rows } = await admin.getDb().executeSql(
      `select id from pgboss.job where name = 'enviar-mensagem' and data->>'mensagemId' = $1`, [id]);
    expect(rows).toHaveLength(1);
    await admin.getDb().executeSql(`delete from pgboss.job where name = 'enviar-mensagem' and data->>'mensagemId' = $1`, [id]);
  });

  it('o papel não lê public.mensagens nem apaga jobs', async () => {
    const b = new PgBoss({ connectionString: urlFila, supervise: false, schedule: false, migrate: false, max: 1 });
    await b.start();
    try {
      await expect(b.getDb().executeSql('select 1 from public.mensagens limit 1', [])).rejects.toThrow(/permission denied/);
      await expect(b.getDb().executeSql('delete from pgboss.job where false', [])).rejects.toThrow(/permission denied/);
      await expect(b.getDb().executeSql(`select data from pgboss.job limit 1`, [])).rejects.toThrow(/permission denied/);
    } finally {
      await b.stop({ graceful: false });
    }
  });
});
