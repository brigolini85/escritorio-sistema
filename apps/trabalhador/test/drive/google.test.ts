import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { ESCOPO_DRIVE, assinarJwt, criarDriveGoogle, driveDoAmbiente, lerContaServico } from '../../src/drive/google';
import { ErroDrive } from '../../src/drive/leitor';
import { lerConfig } from '../../src/config';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const JSON_CHAVE = JSON.stringify({ type: 'service_account', client_email: 'drive@escritorio.iam.gserviceaccount.com', private_key: PEM, token_uri: 'https://oauth2.googleapis.com/token' });

type Pedido = { url: string; metodo: string; corpo: string | null };
function fetchFalso(respostas: (p: Pedido) => Response) {
  const pedidos: Pedido[] = [];
  const buscar = (async (url: string | URL, init?: RequestInit) => {
    const p = { url: String(url), metodo: init?.method ?? 'GET', corpo: init?.body ? String(init.body) : null };
    pedidos.push(p);
    return respostas(p);
  }) as typeof fetch;
  return { buscar, pedidos };
}
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });
const TOKEN = (p: Pedido) => (p.url.startsWith('https://oauth2.googleapis.com/token') ? json({ access_token: 'tk', expires_in: 3600 }) : null);

describe('conta de serviço (D3)', () => {
  it('lê o JSON inteiro ou em base64 e recusa o que não é conta de serviço', () => {
    expect(lerContaServico(JSON_CHAVE).email).toBe('drive@escritorio.iam.gserviceaccount.com');
    expect(lerContaServico(Buffer.from(JSON_CHAVE).toString('base64')).email).toBe('drive@escritorio.iam.gserviceaccount.com');
    expect(() => lerContaServico('{"type":"authorized_user"}')).toThrow('A chave do Drive não é de uma conta de serviço.');
    expect(() => lerContaServico('não é json')).toThrow('A chave da conta de serviço do Drive não é um JSON válido.');
  });
  it('o JWT é RS256, pede só leitura e é assinado pela chave', () => {
    const jwt = assinarJwt(lerContaServico(JSON_CHAVE), 1_760_000_000_000);
    const [cab, corpo, assinatura] = jwt.split('.');
    expect(JSON.parse(Buffer.from(cab!, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    const c = JSON.parse(Buffer.from(corpo!, 'base64url').toString());
    expect(c).toMatchObject({ iss: 'drive@escritorio.iam.gserviceaccount.com', scope: ESCOPO_DRIVE, aud: 'https://oauth2.googleapis.com/token', iat: 1_760_000_000 });
    expect(ESCOPO_DRIVE).toBe('https://www.googleapis.com/auth/drive.readonly');
    const v = createVerify('RSA-SHA256');
    v.update(`${cab}.${corpo}`);
    expect(v.verify(publicKey, Buffer.from(assinatura!, 'base64url'))).toBe(true);
  });
  it('Config: a variável é opcional e vazia conta como não informada', () => {
    const base = {
      SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'k', DATABASE_URL: 'postgresql://x', ANTHROPIC_API_KEY: 'k', ZAPI_INSTANCIA: 'i',
      ZAPI_TOKEN: 't', ZAPI_CLIENT_TOKEN: 'c', WEBHOOK_SEGREDO: 'segredo-com-16-caracteres', TRANSCRICAO_BASE_URL: 'https://api.groq.com/openai/v1',
      TRANSCRICAO_API_KEY: 'k', TRANSCRICAO_MODELO: 'w', SMTP_HOST: 'smtp', SMTP_USUARIO: 'u', SMTP_SENHA: 's', SMTP_REMETENTE: 'avisos@escritorio.com.br',
    };
    expect(lerConfig(base).GOOGLE_DRIVE_CONTA_SERVICO).toBeUndefined();
    expect(lerConfig({ ...base, GOOGLE_DRIVE_CONTA_SERVICO: '  ' }).GOOGLE_DRIVE_CONTA_SERVICO).toBeUndefined();
    expect(lerConfig({ ...base, GOOGLE_DRIVE_CONTA_SERVICO: ` ${JSON_CHAVE} ` }).GOOGLE_DRIVE_CONTA_SERVICO).toBe(JSON_CHAVE);
  });
  it('sem variável: Drive não configurado; chave inválida: erro curto, sem derrubar', () => {
    expect(driveDoAmbiente(undefined)).toEqual({ leitor: null, erro: null });
    expect(driveDoAmbiente('xxx')).toEqual({ leitor: null, erro: 'A chave da conta de serviço do Drive não é um JSON válido.' });
    expect(driveDoAmbiente(JSON_CHAVE).leitor?.email).toBe('drive@escritorio.iam.gserviceaccount.com');
  });
});

describe('criarDriveGoogle (D2, D3): só GET e só leitura', () => {
  it('lista com paginação, sem a lixeira, nas unidades compartilhadas; reaproveita o token', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? (p.url.includes('pageToken=pg2')
      ? json({ files: [{ id: 'b', name: 'b.pdf', mimeType: 'application/pdf', size: '20', modifiedTime: '2026-10-02T00:00:00Z', parents: ['P'] }] })
      : json({ nextPageToken: 'pg2', files: [{ id: 'a', name: 'a.csv', mimeType: 'text/csv', modifiedTime: '2026-10-01T00:00:00Z', parents: ['P'] }] })));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar, () => 1_760_000_000_000);
    const itens = await d.listar('P');
    expect(itens).toEqual([
      { id: 'a', nome: 'a.csv', mime: 'text/csv', tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'] },
      { id: 'b', nome: 'b.pdf', mime: 'application/pdf', tamanho: 20, modificadoEm: '2026-10-02T00:00:00Z', pais: ['P'] },
    ]);
    const api = f.pedidos.filter((p) => p.url.startsWith('https://www.googleapis.com/drive/v3/'));
    expect(api.every((p) => p.metodo === 'GET')).toBe(true);
    expect(new URL(api[0]!.url).searchParams.get('q')).toBe("'P' in parents and trashed = false");
    expect(api[0]!.url).toContain('supportsAllDrives=true');
    expect(api[0]!.url).toContain('includeItemsFromAllDrives=true');
    expect(f.pedidos.filter((p) => p.url.includes('oauth2')).length).toBe(1);
    expect(f.pedidos.find((p) => p.url.includes('oauth2'))!.corpo).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
  });
  it('item: 404 e lixeira viram null; 403 vira ErroDrive sem_acesso', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? (p.url.includes('/files/sumiu') ? json({}, 404)
      : p.url.includes('/files/lixo') ? json({ id: 'lixo', name: 'x', mimeType: 'text/csv', trashed: true, modifiedTime: 'x', parents: [] })
      : json({ error: { errors: [{ reason: 'forbidden' }] } }, 403)));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar);
    expect(await d.item('sumiu')).toBeNull();
    expect(await d.item('lixo')).toBeNull();
    await expect(d.item('proibido')).rejects.toMatchObject({ codigo: 'sem_acesso' });
    await expect(d.item('proibido')).rejects.toBeInstanceOf(ErroDrive);
  });
  it('baixar usa alt=media; exportar usa /export; exportação grande vira "grande"', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? (p.url.includes('/export') && p.url.includes('grande')
      ? json({ error: { errors: [{ reason: 'exportSizeLimitExceeded' }] } }, 403)
      : new Response(new Uint8Array([1, 2, 3]), { status: 200 })));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar);
    expect([...(await d.baixar('a'))]).toEqual([1, 2, 3]);
    expect([...(await d.exportar('doc', 'application/pdf'))]).toEqual([1, 2, 3]);
    await expect(d.exportar('grande', 'text/csv')).rejects.toMatchObject({ codigo: 'grande' });
    const urls = f.pedidos.map((p) => decodeURIComponent(p.url));
    expect(urls.some((u) => u.includes('/files/a?') && u.includes('alt=media'))).toBe(true);
    expect(urls.some((u) => u.includes('/files/doc/export?') && u.includes('mimeType=application/pdf'))).toBe(true);
  });
  it('o objeto não tem nada que grave', () => {
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), fetchFalso(() => json({})).buscar);
    expect(Object.keys(d).sort()).toEqual(['baixar', 'email', 'exportar', 'item', 'listar', 'verificar']);
  });
});

// Rulings do pré-voo (F1, F2, F3, F9, F12) e a segurança da chave.
describe('criarDriveGoogle: rulings do pré-voo e a chave', () => {
  it('F1: token recusado e 401 viram "conta"; o 401 descarta o token guardado', async () => {
    const recusado = fetchFalso((p) => (p.url.includes('oauth2') ? json({ error: 'invalid_grant' }, 400) : json({})));
    await expect(criarDriveGoogle(lerContaServico(JSON_CHAVE), recusado.buscar).listar('P')).rejects.toMatchObject({ codigo: 'conta' });
    let n401 = 0;
    const f = fetchFalso((p) => TOKEN(p) ?? (n401++ === 0 ? json({}, 401) : json({ files: [] })));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar);
    await expect(d.listar('P')).rejects.toMatchObject({ codigo: 'conta' });
    expect(await d.listar('P')).toEqual([]);
    expect(f.pedidos.filter((p) => p.url.includes('oauth2')).length).toBe(2);
  });
  it('F1: token com o Google fora do ar (5xx) é "falha", não "conta"', async () => {
    const f = fetchFalso((p) => (p.url.includes('oauth2') ? json({}, 503) : json({})));
    await expect(criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar).item('a')).rejects.toMatchObject({ codigo: 'falha' });
  });
  it('F2: o Drive que não responde vira "falha" no tempo-limite', async () => {
    const buscar = ((_u: string | URL, init?: RequestInit) => new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(init.signal!.reason));
    })) as typeof fetch;
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), buscar, Date.now, { curto: 20, longo: 40 });
    await expect(d.listar('P')).rejects.toMatchObject({ codigo: 'falha', message: 'O Drive não respondeu a tempo.' });
    const semRede = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;
    await expect(criarDriveGoogle(lerContaServico(JSON_CHAVE), semRede).baixar('a')).rejects.toMatchObject({ codigo: 'falha' });
  });
  it('F2: download e exportação usam o tempo longo; token e lista, o curto', async () => {
    const sinais: { url: string; signal: AbortSignal | null | undefined }[] = [];
    const buscar = (async (u: string | URL, init?: RequestInit) => {
      sinais.push({ url: String(u), signal: init?.signal });
      return String(u).includes('oauth2') ? json({ access_token: 'tk', expires_in: 3600 }) : String(u).includes('alt=media') ? new Response('x') : json({ files: [] });
    }) as typeof fetch;
    const espiao = vi.spyOn(AbortSignal, 'timeout');
    try {
      const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), buscar);
      await d.listar('P');
      await d.baixar('a');
      expect(espiao.mock.calls.map((c) => c[0])).toEqual([30_000, 30_000, 120_000]);
      expect(sinais.every((s) => s.signal instanceof AbortSignal)).toBe(true);
    } finally {
      espiao.mockRestore();
    }
  });
  it('F3: content-length acima de 10 MB vira "grande" sem ler o corpo; corpo em fluxo acima de 10 MB também', async () => {
    let puxados = 0;
    const corpoQueNaoDeveSerLido = new ReadableStream<Uint8Array>({ pull(c) { puxados++; c.enqueue(new Uint8Array(1)); } });
    const f1 = fetchFalso((p) => TOKEN(p) ?? new Response(corpoQueNaoDeveSerLido, { headers: { 'content-length': String(11 * 1024 * 1024) } }));
    await expect(criarDriveGoogle(lerContaServico(JSON_CHAVE), f1.buscar).baixar('a')).rejects.toMatchObject({ codigo: 'grande' });
    expect(puxados).toBeLessThanOrEqual(1); // o ReadableStream puxa um pedaço sozinho ao nascer; nós não lemos nada
    let enviados = 0;
    const semFim = new ReadableStream<Uint8Array>({ pull(c) { enviados += 1024 * 1024; c.enqueue(new Uint8Array(1024 * 1024)); } });
    const f2 = fetchFalso((p) => TOKEN(p) ?? new Response(semFim));
    await expect(criarDriveGoogle(lerContaServico(JSON_CHAVE), f2.buscar).exportar('doc', 'application/pdf')).rejects.toMatchObject({ codigo: 'grande' });
    expect(enviados).toBeLessThanOrEqual(13 * 1024 * 1024);
    const exatos = fetchFalso((p) => TOKEN(p) ?? new Response(new Uint8Array(10 * 1024 * 1024)));
    expect((await criarDriveGoogle(lerContaServico(JSON_CHAVE), exatos.buscar).baixar('a')).length).toBe(10 * 1024 * 1024);
  });
  it('F9: o token vai sempre ao Google, mesmo que a chave diga outro endereço; sem expires_in vale 1 hora', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const outra = JSON.stringify({ ...JSON.parse(JSON_CHAVE), token_uri: 'https://atacante.example/token' });
      let agora = 1_760_000_000_000;
      const f = fetchFalso((p) => (p.url.includes('oauth2') ? json({ access_token: 'tk' }) : json({ files: [] })));
      const d = criarDriveGoogle(lerContaServico(outra), f.buscar, () => agora);
      await d.listar('P');
      agora += 3_000_000; // 50 minutos: ainda vale
      await d.listar('P');
      expect(f.pedidos.some((p) => p.url.includes('atacante'))).toBe(false);
      expect(f.pedidos.filter((p) => p.url === 'https://oauth2.googleapis.com/token').length).toBe(1);
      agora += 600_000; // 60 minutos: renova (a menos de 60 s do vencimento)
      await d.listar('P');
      expect(f.pedidos.filter((p) => p.url === 'https://oauth2.googleapis.com/token').length).toBe(2);
      const jwt = f.pedidos.find((p) => p.url.includes('oauth2'))!.corpo!;
      const corpo = JSON.parse(Buffer.from(new URLSearchParams(jwt).get('assertion')!.split('.')[1]!, 'base64url').toString());
      expect(corpo.aud).toBe('https://oauth2.googleapis.com/token');
    } finally {
      aviso.mockRestore();
    }
  });
  it('F12: a lista pede corpora=allDrives; o /about não leva os parâmetros das unidades compartilhadas', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? json({ files: [], user: { emailAddress: 'x' } }));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar);
    await d.verificar();
    await d.listar('P');
    await d.item('a');
    const [about, lista, item] = f.pedidos.filter((p) => p.url.includes('/drive/v3/')).map((p) => new URL(p.url));
    expect(about!.pathname).toBe('/drive/v3/about');
    expect(about!.searchParams.has('supportsAllDrives')).toBe(false);
    expect(lista!.searchParams.get('corpora')).toBe('allDrives');
    expect(lista!.searchParams.get('supportsAllDrives')).toBe('true');
    expect(item!.searchParams.get('supportsAllDrives')).toBe('true');
    expect(item!.searchParams.has('includeItemsFromAllDrives')).toBe(false);
  });
  it('código estranho não vira consulta: nada vai ao Drive', async () => {
    const f = fetchFalso((p) => TOKEN(p) ?? json({ files: [] }));
    const d = criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar);
    await expect(d.listar("P' or name contains 'x")).rejects.toMatchObject({ codigo: 'nao_encontrado' });
    expect(await d.item('../about')).toBeNull();
    await expect(d.baixar('a/b')).rejects.toMatchObject({ codigo: 'nao_encontrado' });
    expect(f.pedidos.filter((p) => p.url.includes('/drive/v3/'))).toEqual([]);
  });
  it('a chave privada nunca aparece em erro nem em log', async () => {
    const quebrada = JSON.stringify({ type: 'service_account', client_email: 'x@y.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\nSEGREDO123\n-----END PRIVATE KEY-----\n' });
    const r = driveDoAmbiente(quebrada);
    expect(r).toEqual({ leitor: null, erro: 'A chave privada da conta de serviço do Drive é inválida.' });
    const logs: string[] = [];
    const espioes = (['log', 'warn', 'error'] as const).map((m) => vi.spyOn(console, m).mockImplementation((...a) => { logs.push(a.map(String).join(' ')); }));
    try {
      const f = fetchFalso((p) => (p.url.includes('oauth2') ? json({ error: 'invalid_grant', error_description: PEM }, 400) : json({})));
      const e = await criarDriveGoogle(lerContaServico(JSON_CHAVE), f.buscar).listar('P').catch((x: unknown) => x);
      expect(e).toBeInstanceOf(ErroDrive);
      const tudo = `${(e as Error).message} ${(e as Error).stack} ${JSON.stringify(e)} ${logs.join(' ')}`;
      expect(tudo).not.toContain('PRIVATE KEY');
      expect(tudo).not.toContain(PEM.split('\n')[1]!);
      expect(JSON.stringify(driveDoAmbiente(JSON_CHAVE))).not.toContain('PRIVATE KEY');
    } finally {
      espioes.forEach((s) => s.mockRestore());
    }
  });
});
