import { afterEach, describe, expect, it, vi } from 'vitest';

// Auditoria 2.9 e 4.14: com DATABASE_URL_FILA o painel enfileira com o papel painel_fila (sem criar filas nem migrar o
// esquema, que o papel não pode); sem ela, usa DATABASE_URL como antes. O pool tem no máximo 3 conexões.
const falso = vi.hoisted(() => ({ opcoes: [] as Record<string, unknown>[], filasCriadas: [] as string[], existentes: new Set<string>() }));
vi.mock('server-only', () => ({}));
vi.mock('pg-boss', () => ({
  default: class {
    constructor(o: Record<string, unknown>) { falso.opcoes.push(o); }
    on() {}
    async start() {}
    async createQueue(nome: string) { falso.filasCriadas.push(nome); }
    async getQueue(nome: string) { return falso.existentes.has(nome) ? { name: nome } : null; }
    async send() { return 'job-1'; }
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  falso.opcoes.length = 0;
  falso.filasCriadas.length = 0;
  falso.existentes.clear();
});

describe('conexão da fila do painel', () => {
  it('sem DATABASE_URL_FILA: DATABASE_URL, cria as filas e o pool tem no máximo 3', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:x@127.0.0.1:54322/postgres');
    vi.stubEnv('DATABASE_URL_FILA', '');
    const { enfileirarEnvio } = await import('./fila');
    await enfileirarEnvio('m1');
    expect(falso.opcoes[0]).toMatchObject({ connectionString: 'postgresql://postgres:x@127.0.0.1:54322/postgres', max: 3 });
    expect(falso.filasCriadas).toContain('enviar-mensagem');
  });

  it('com DATABASE_URL_FILA: usa o papel próprio, não migra nem cria filas', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://postgres:x@127.0.0.1:54322/postgres');
    vi.stubEnv('DATABASE_URL_FILA', 'postgresql://painel_fila:y@127.0.0.1:54322/postgres');
    ['enviar-mensagem', 'remover-arquivos', 'assistente', 'simular_agente', 'sugerir_resposta', 'agente_trabalho', 'pendencia_cliente', 'pasta_drive']
      .forEach((f) => falso.existentes.add(f));
    const { enfileirarEnvio } = await import('./fila');
    await enfileirarEnvio('m1');
    expect(falso.opcoes[0]).toMatchObject({ connectionString: 'postgresql://painel_fila:y@127.0.0.1:54322/postgres', migrate: false, max: 3 });
    expect(falso.filasCriadas).toEqual([]);
  });

  it('com DATABASE_URL_FILA e fila que o trabalhador ainda não criou: avisa no log com o nome', async () => {
    vi.stubEnv('DATABASE_URL_FILA', 'postgresql://painel_fila:y@127.0.0.1:54322/postgres');
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { enfileirarEnvio } = await import('./fila');
    await enfileirarEnvio('m1');
    expect(erro.mock.calls.flat().join(' ')).toContain('enviar-mensagem');
    expect(erro.mock.calls.flat().join(' ')).not.toContain('painel_fila:y');
    erro.mockRestore();
  });
});
