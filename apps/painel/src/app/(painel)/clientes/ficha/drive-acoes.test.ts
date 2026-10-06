import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ rpcs: [] as { nome: string; args: Record<string, unknown> }[], erro: null as { code?: string; message: string } | null, revalidados: [] as string[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'eu', papel: 'atendente', niveis: { clientes: 'editar' }, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => {
      falso.rpcs.push({ nome, args });
      return falso.erro ? { data: null, error: falso.erro } : { data: (args.p_pasta as string | null) ?? null, error: null };
    },
  }),
}));
import { salvarPastaDrive } from './drive-acoes';

const CLIENTE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ID = '1PastaDaPadariaSolAbcdefghij';

describe('salvarPastaDrive (D8)', () => {
  beforeEach(() => { falso.rpcs = []; falso.erro = null; falso.revalidados = []; });
  it('converte o link no código e grava', async () => {
    expect(await salvarPastaDrive(CLIENTE, `https://drive.google.com/drive/u/0/folders/${ID}?usp=sharing`)).toEqual({ ok: true, pasta: ID });
    expect(falso.rpcs).toEqual([{ nome: 'salvar_pasta_drive', args: { p_cliente: CLIENTE, p_pasta: ID } }]);
    expect(falso.revalidados).toContain(`/clientes/${CLIENTE}`);
  });
  it('aceita o link do celular (F13)', async () => {
    expect(await salvarPastaDrive(CLIENTE, `https://drive.google.com/drive/mobile/folders/${ID}`)).toEqual({ ok: true, pasta: ID });
  });
  it('vazio limpa; link que não é de pasta não vai ao banco', async () => {
    expect(await salvarPastaDrive(CLIENTE, '  ')).toEqual({ ok: true, pasta: null });
    expect(await salvarPastaDrive(CLIENTE, 'https://drive.google.com/file/d/xyz/view')).toEqual({ ok: false, erro: 'Cole o link da pasta do Drive (drive.google.com/drive/folders/…).' });
    expect(falso.rpcs).toHaveLength(1);
  });
  it('frase do banco vai à tela; erro técnico vira frase fixa', async () => {
    falso.erro = { code: 'P0001', message: 'Esta pasta do Drive já é de outro cliente.' };
    expect(await salvarPastaDrive(CLIENTE, ID)).toEqual({ ok: false, erro: 'Esta pasta do Drive já é de outro cliente.' });
    falso.erro = { code: '08006', message: 'connection reset' };
    expect(await salvarPastaDrive(CLIENTE, ID)).toEqual({ ok: false, erro: 'Não consegui salvar a pasta agora. Tente de novo.' });
  });
  it('id de cliente inválido não vai ao banco', async () => {
    expect(await salvarPastaDrive('x', ID)).toEqual({ ok: false, erro: 'Cliente não encontrado.' });
    expect(falso.rpcs).toEqual([]);
  });
});
