// Revisão geral I1: com a política "stately" do pg-boss 10.4.2, um job esperando da conversa X (enquanto outro de X roda)
// travava a busca de TODOS os consumidores (o UPDATE para "active" estoura o índice único e o pg-boss devolve []).
// Agora a fila não trava e a vez por conversa fica numa trava do banco (pegar_trava).
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type PgBoss from 'pg-boss';
import { limparBanco } from '@escritorio/db/teste';
import { ESPERA_OCUPADA_SEGUNDOS, FILAS, chaveAssistente, criarBoss, naVez } from '../src/fila';
import { processarAssistenteNaVez } from '../src/assistente/processar';
import { processarConversaNaVez, type DepsProcessamento } from '../src/processar-conversa';
import { FilaFalsa } from './apoio/fila-falsa';
import { repos } from './apoio/cenario';

let boss: PgBoss;
beforeAll(async () => { boss = await criarBoss(process.env.DATABASE_URL!); });
afterAll(async () => { await boss.stop({ graceful: false }); });

describe.each([FILAS.processarConversa, FILAS.assistente])('fila %s sem bloqueio de cabeça de fila', (nome) => {
  it('com X rodando e outro X esperando, as outras chaves continuam saindo da fila', async () => {
    await boss.purgeQueue(nome);
    const x = crypto.randomUUID();
    await boss.send(nome, { conversaId: x }, { singletonKey: x });
    const [ativo] = await boss.fetch(nome);
    expect(ativo).toBeDefined();
    await boss.send(nome, { conversaId: x }, { singletonKey: x });
    const y = crypto.randomUUID();
    await boss.send(nome, { conversaId: y }, { singletonKey: y });
    const pegos = [...(await boss.fetch<{ conversaId: string }>(nome)), ...(await boss.fetch<{ conversaId: string }>(nome))];
    expect(pegos.map((j) => j.data.conversaId)).toContain(y);
    await boss.purgeQueue(nome);
  });

  it('a mesma chave esperando continua sendo um job só (mensagens picadas)', async () => {
    await boss.purgeQueue(nome);
    const x = crypto.randomUUID();
    await boss.send(nome, { conversaId: x }, { singletonKey: x });
    await boss.send(nome, { conversaId: x }, { singletonKey: x });
    expect(await boss.getQueueSize(nome)).toBe(1);
    await boss.purgeQueue(nome);
  });
});

describe('naVez', () => {
  beforeEach(async () => { await limparBanco(); });

  it('duas execuções da mesma chave: a segunda não roda e chama "ocupada"; outra chave roda junto', async () => {
    let soltar!: () => void;
    const segura = new Promise<void>((r) => { soltar = r; });
    const ordem: string[] = [];
    const primeira = naVez(repos, 'conversa:a', 60, async () => { ordem.push('a1'); await segura; return 'ok'; }, async () => { ordem.push('a1-ocupada'); });
    await new Promise((r) => setTimeout(r, 200));
    const segunda = await naVez(repos, 'conversa:a', 60, async () => { ordem.push('a2'); return 'ok'; }, async () => { ordem.push('a2-ocupada'); });
    const outra = await naVez(repos, 'conversa:b', 60, async () => { ordem.push('b'); return 'ok'; }, async () => { ordem.push('b-ocupada'); });
    soltar();
    expect(await primeira).toBe('ok');
    expect(segunda).toBe('ocupada');
    expect(outra).toBe('ok');
    expect(ordem).toEqual(['a1', 'a2-ocupada', 'b']);
    // Terminou: a trava sai e a próxima roda.
    expect(await naVez(repos, 'conversa:a', 60, async () => 'ok', async () => {})).toBe('ok');
  });

  it('erro dentro da vez também solta a trava', async () => {
    await expect(naVez(repos, 'conversa:c', 60, async () => { throw new Error('falhou'); }, async () => {})).rejects.toThrow('falhou');
    expect(await naVez(repos, 'conversa:c', 60, async () => 'ok', async () => {})).toBe('ok');
  });
});

describe('processarConversaNaVez e processarAssistenteNaVez', () => {
  beforeEach(async () => { await limparBanco(); });

  it('conversa com a vez em andamento: não processa e volta para a fila mais tarde (mesma chave)', async () => {
    const fila = new FilaFalsa();
    const conversaId = crypto.randomUUID();
    expect(await repos.pegarTrava(`conversa:${conversaId}`, crypto.randomUUID(), 60)).toBe(true);
    const d = { repos, fila } as unknown as DepsProcessamento;
    expect(await processarConversaNaVez(d, conversaId, false)).toBe('ocupada');
    expect(fila.enviados).toEqual([{ nome: FILAS.processarConversa, dados: { conversaId },
      opcoes: { singletonKey: conversaId, startAfter: ESPERA_OCUPADA_SEGUNDOS } }]);
  });

  it('conversa livre: processa (sem mensagens, nada a fazer) e solta a trava', async () => {
    const d = { repos, fila: new FilaFalsa() } as unknown as DepsProcessamento;
    const conversaId = crypto.randomUUID();
    expect(await processarConversaNaVez(d, conversaId, false)).toBe('sem-mensagens');
    expect(await repos.pegarTrava(`conversa:${conversaId}`, crypto.randomUUID(), 60)).toBe(true);
  });

  it('pergunta do assistente com a vez em andamento: volta para a fila mais tarde', async () => {
    const fila = new FilaFalsa();
    const j = { usuarioId: crypto.randomUUID(), canal: 'site' as const, conversaId: null, telefone: null };
    expect(await repos.pegarTrava(`assistente:${chaveAssistente(j)}`, crypto.randomUUID(), 60)).toBe(true);
    expect(await processarAssistenteNaVez({ repos, fila } as never, j, false)).toBe('ocupada');
    expect(fila.enviados).toEqual([{ nome: FILAS.assistente, dados: j,
      opcoes: { singletonKey: `${j.usuarioId}:site:-`, startAfter: ESPERA_OCUPADA_SEGUNDOS } }]);
  });
});
