import { describe, expect, it } from 'vitest';
import { MIME_ATALHO_DRIVE, MIME_PASTA_DRIVE } from '@escritorio/core';
import { SemI3b, type PastaDaTarefa, type Repos, type TarefaParaTrabalho } from '@escritorio/db';
import { criarDriveFalso, type ArquivoFalso } from '../../src/drive/falso';
import { ErroDrive } from '../../src/drive/leitor';
import { FERRAMENTA_PASTA, executarFerramentaTarefa, ferramentasDaTarefa, type VezDaTarefa } from '../../src/tarefa/ferramentas';
import {
  FALHA_LEITURA_PASTA, PastaDoCliente, TEXTO_PEDIDO_SEM_DRIVE, TEXTO_PEDIDO_SEM_PASTA, lerPastaComAviso, lerPastaDaTarefa, lerPastaPedida, textoDaLeitura, type DepsPasta,
} from '../../src/tarefa/pasta';

const SOL = '1PastaDaPadariaSolAbcdefghij';
const LUA = '1PastaDaMerceariaLuaAbcdefgh';
const pasta = (id: string, nome: string, pais: string[] = []): ArquivoFalso => ({ id, nome, mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais });
const arq = (id: string, nome: string, pais: string[], x: Partial<ArquivoFalso> = {}): ArquivoFalso =>
  ({ id, nome, mime: 'text/csv', tamanho: 10, modificadoEm: '2026-10-05T00:00:00Z', pais, conteudo: `conteúdo de ${nome}`, ...x });

// A pasta da Lua está DENTRO da pasta da Padaria (o caso que mais engana).
const ARVORE: ArquivoFalso[] = [
  pasta(SOL, 'Padaria Sol'), pasta('sub1', '2026', [SOL]), pasta('sub2', '10', ['sub1']), pasta(LUA, 'Mercearia Lua', [SOL]),
  arq('extrato', 'extrato-itau.csv', [SOL], { modificadoEm: '2026-10-07T00:00:00Z' }),
  arq('folha', 'Folha de outubro', ['sub2'], { mime: 'application/vnd.google-apps.spreadsheet', tamanho: null, exportado: 'nome;liquido' }),
  arq('docx', 'contrato.docx', [SOL], { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
  arq('atalho', 'extrato-lua (atalho)', [SOL], { mime: MIME_ATALHO_DRIVE }),
  arq('dalua', 'extrato-lua.csv', [LUA]),
  arq('doispais', 'compartilhado.csv', ['sub1', LUA]),
];

function montar(p: Partial<PastaDaTarefa> | 'sem_i3b' | null = {}, arvore = ARVORE) {
  const drive = criarDriveFalso(arvore);
  const registrados: { nome: string; driveId: string; caminho: string }[] = [];
  const eventos: string[] = [];
  const guardados: string[] = [];
  const removidos: string[] = [];
  const situacoes: { email: string | null; erro: string | null }[] = [];
  const repos = {
    pastaDriveDaTarefa: async () => {
      if (p === 'sem_i3b') throw new SemI3b();
      return p === null ? null : { estado: 'trabalhando', clienteId: 'c', pasta: SOL, outras: [LUA], importados: [], total: 0, ...p };
    },
    registrarArquivoDrive: async (a: { nome: string; driveId: string; caminho: string }) => {
      if (a.driveId === 'falha-registro') throw new Error('Arquivo não encontrado no envio.');
      registrados.push(a);
      return { id: `id-${a.driveId}`, nome: a.nome };
    },
    eventoTarefa: async (_t: string, texto: string) => { eventos.push(texto); },
    registrarSituacaoDrive: async (s: { email: string | null; erro: string | null }) => { situacoes.push(s); return true; },
  } as unknown as Repos;
  const d: DepsPasta = {
    repos, drive, relogio: () => new Date('2026-10-17T12:00:00Z'),
    guardar: async (c) => { guardados.push(c); }, remover: async (c) => { removidos.push(...c); },
  };
  return { d, drive, registrados, eventos, guardados, removidos, situacoes };
}

describe('PastaDoCliente (D5)', () => {
  it('desce até 3 níveis, pula a pasta de outro cliente e confere a ascendência', async () => {
    const { drive } = montar();
    const p = new PastaDoCliente(drive, SOL, new Set([LUA]));
    const { arquivos, ignorados } = await p.listar(null);
    expect(arquivos.map((a) => a.id).sort()).toEqual(['atalho', 'docx', 'doispais', 'extrato', 'folha']);
    // Revisão final (minor 5): o nome da pasta de outro cliente não vaza para esta tarefa.
    expect(ignorados).toEqual([{ nome: 'subpasta', motivo: 'outra_pasta' }]);
    expect(drive.listados).not.toContain(LUA);
    expect(await p.dentroDaPasta('extrato')).toBe(true);
    expect(await p.dentroDaPasta('folha')).toBe(true);
    expect(await p.dentroDaPasta('dalua')).toBe(false);
    expect(await p.dentroDaPasta('doispais')).toBe(false);
  });
  it('não baixa o que não veio da listagem, nem o que tem um pai em outro cliente', async () => {
    const { drive } = montar();
    const p = new PastaDoCliente(drive, SOL, new Set([LUA]));
    await p.listar(null);
    const dalua = (await drive.item('dalua'))!;
    await expect(p.ler(dalua, { acao: 'baixar', nome: 'extrato-lua.csv', mime: 'text/csv' })).rejects.toThrow('fora da pasta');
    const doispais = (await drive.item('doispais'))!;
    await expect(p.ler(doispais, { acao: 'baixar', nome: 'compartilhado.csv', mime: 'text/csv' })).rejects.toThrow('fora da pasta');
    expect(drive.baixados).toEqual([]);
  });
  it('subpasta por nomes, dentro da pasta do cliente; a da Lua não serve de caminho', async () => {
    const { drive } = montar();
    const p = new PastaDoCliente(drive, SOL, new Set([LUA]));
    expect((await p.listar('2026/10')).arquivos.map((a) => a.id)).toEqual(['folha']);
    await expect(p.listar('Mercearia Lua')).rejects.toBeInstanceOf(ErroDrive);
  });
  it('F7: no item 301 para em todos os níveis e avisa uma vez ("muitos")', async () => {
    const arvore = [pasta(SOL, 'Padaria Sol'), pasta('sub-a', 'antes', [SOL]),
      ...Array.from({ length: 300 }, (_, i) => arq(`f${i}`, `f${i}.csv`, [SOL])), arq('dentro', 'dentro.csv', ['sub-a'])];
    const { drive } = montar({}, arvore);
    const p = new PastaDoCliente(drive, SOL, new Set());
    const { arquivos, ignorados } = await p.listar(null);
    expect(arquivos).toHaveLength(299);
    expect(ignorados).toEqual([{ nome: 'pasta do cliente', motivo: 'muitos' }]);
    expect(drive.listados).toEqual([SOL]);
  });
});

describe('lerPastaDaTarefa', () => {
  it('copia o que o agente lê, exporta a planilha do Google e diz o que ficou de fora', async () => {
    const m = montar();
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r).toMatchObject({ situacao: 'lida' });
    if (r.situacao !== 'lida') return;
    expect(r.novos.sort()).toEqual(['Folha de outubro.csv', 'extrato-itau.csv']);
    expect(r.ignorados.map((x) => `${x.nome}:${x.motivo}`).sort()).toEqual([
      'compartilhado.csv:fora_da_pasta', 'contrato.docx:tipo', 'extrato-lua (atalho):atalho', 'subpasta:outra_pasta',
    ]);
    expect(m.drive.baixados.sort()).toEqual(['extrato', 'folha']);
    expect(m.guardados.every((c) => c.startsWith('T/drive/'))).toBe(true);
    expect(m.eventos.at(-1)).toContain('leu a pasta do Drive: 2 arquivos novos');
    expect(m.eventos.at(-1)).not.toContain('Mercearia');
    // F1: leitura bem-sucedida limpa o erro da conta.
    expect(m.situacoes).toEqual([{ email: 'drive-teste@escritorio.iam.gserviceaccount.com', erro: null }]);
  });
  it('o mesmo arquivo (mesma data) não entra de novo; mudou, entra; respeita 30 por tarefa', async () => {
    const igual = montar({ importados: [{ driveId: 'extrato', modificadoEm: '2026-10-07T00:00:00+00:00' }], total: 1 });
    const r1 = await lerPastaDaTarefa(igual.d, 'T');
    expect(r1.situacao === 'lida' && r1.novos).toEqual(['Folha de outubro.csv']);
    const cheia = montar({ total: 29 });
    const r2 = await lerPastaDaTarefa(cheia.d, 'T');
    expect(r2.situacao === 'lida' && r2.novos.length).toBe(1);
    expect(r2.situacao === 'lida' && r2.ignorados.some((x) => x.motivo === 'limite')).toBe(true);
  });
  it('registro que falha desfaz o envio ao Storage', async () => {
    const m = montar({}, [pasta(SOL, 'Padaria Sol'), arq('falha-registro', 'x.csv', [SOL])]);
    await expect(lerPastaDaTarefa(m.d, 'T')).rejects.toThrow('Arquivo não encontrado no envio.');
    expect(m.removidos).toEqual(m.guardados);
  });
  it('F4: Storage que falha deixa só aquele arquivo de fora ("falha")', async () => {
    const m = montar({}, [pasta(SOL, 'Padaria Sol'), arq('a', 'a.csv', [SOL]), arq('b', 'b.csv', [SOL])]);
    m.d.guardar = async (c) => { if (c.includes('/a-')) throw new Error('upload falhou: 500'); m.guardados.push(c); };
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r).toEqual({ situacao: 'lida', novos: ['b.csv'], ignorados: [{ nome: 'a.csv', motivo: 'falha' }] });
  });
  it('F5: arquivo .pdf que não é PDF fica de fora ("tipo") e não vai ao Storage', async () => {
    const m = montar({}, [pasta(SOL, 'Padaria Sol'), arq('p', 'nota.pdf', [SOL], { mime: 'application/pdf', conteudo: '<html>não é pdf' }),
      arq('ok', 'boa.pdf', [SOL], { mime: 'application/pdf', conteudo: '%PDF-1.7 ...' })]);
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r).toEqual({ situacao: 'lida', novos: ['boa.pdf'], ignorados: [{ nome: 'nota.pdf', motivo: 'tipo' }] });
    expect(m.guardados).toHaveLength(1);
  });
  it('sem Drive, sem pasta, tarefa decidida, sem a I3b: não lê nada', async () => {
    expect(await lerPastaDaTarefa({ ...montar().d, drive: null }, 'T')).toEqual({ situacao: 'sem_drive' });
    expect(await lerPastaDaTarefa(montar({ pasta: null }).d, 'T')).toEqual({ situacao: 'sem_pasta' });
    expect(await lerPastaDaTarefa(montar({ estado: 'aprovada' }).d, 'T')).toEqual({ situacao: 'decidida' });
    expect(await lerPastaDaTarefa(montar(null).d, 'T')).toEqual({ situacao: 'decidida' });
    expect(await lerPastaDaTarefa(montar('sem_i3b').d, 'T')).toEqual({ situacao: 'sem_i3b' });
  });
  it('pasta não compartilhada: erro com o e-mail da conta, na linha do tempo', async () => {
    const m = montar();
    m.d.drive = { ...m.drive, listar: async () => { throw new ErroDrive('sem_acesso', '403'); } };
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r).toEqual({ situacao: 'erro', mensagem: 'A pasta do Drive deste cliente não foi compartilhada com drive-teste@escritorio.iam.gserviceaccount.com (como Leitor).' });
    expect(m.eventos.at(-1)).toContain('não leu a pasta do Drive');
    // F1: erro de pasta não vai para a situação da conta (o painel inteiro diria "Drive com problema").
    expect(m.situacoes).toEqual([]);
  });
  it('F6: pasta que o Drive não acha (404) diz as duas causas', async () => {
    const m = montar({}, [arq('solto', 'solto.csv', [SOL])]);
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r).toEqual({ situacao: 'erro', mensagem: 'A pasta do Drive deste cliente não foi encontrada ou não foi compartilhada com drive-teste@escritorio.iam.gserviceaccount.com (como Leitor).' });
    expect(m.situacoes).toEqual([]);
  });
  it('F1: só a conta recusada grava o erro da conta', async () => {
    const m = montar();
    m.d.drive = { ...m.drive, listar: async () => { throw new ErroDrive('conta', 'O Google recusou a conta do Drive do escritório (401).') } };
    const r = await lerPastaDaTarefa(m.d, 'T');
    expect(r.situacao).toBe('erro');
    expect(m.situacoes).toHaveLength(1);
    expect(m.situacoes[0]!.erro).toContain('O Google recusou a conta do Drive');
  });
  it('o texto da linha do tempo cabe em 500', () => {
    const muitos = Array.from({ length: 40 }, (_, i) => ({ nome: `arquivo-com-nome-comprido-${i}.docx`, motivo: 'tipo' as const }));
    expect(textoDaLeitura(['a.pdf'], muitos).length).toBeLessThanOrEqual(500);
  });
  it('F16: até 20 nomes de até 100 letras, limpos, com "e mais N"', () => {
    const muitos = Array.from({ length: 25 }, (_, i) => ({ nome: `n${i}\u0007/${'x'.repeat(200)}`, motivo: 'tipo' as const }));
    const t = textoDaLeitura([], muitos);
    expect(t.length).toBeLessThanOrEqual(500);
    expect(t).not.toMatch(/[\u0000-\u001f/]/);
    expect(t).toMatch(/e mais \d+$/);
  });
});

describe('a ferramenta (D7)', () => {
  it('só entra com pasta; nunca recebe código nem link do Drive', () => {
    const perfil = { skills: [] };
    expect(ferramentasDaTarefa(perfil).map((f) => f.name)).not.toContain('ler_pasta_do_cliente');
    expect(ferramentasDaTarefa(perfil, { pasta: true }).map((f) => f.name)).toContain('ler_pasta_do_cliente');
    expect(Object.keys((FERRAMENTA_PASTA.input_schema as { properties: object }).properties)).toEqual(['subpasta']);
  });

  const tarefa = { id: 'T', arquivos: [] } as unknown as TarefaParaTrabalho;
  function deps() {
    const eventos: string[] = [];
    const repos = {
      eventoTarefa: async (_t: string, texto: string) => { eventos.push(texto); },
      tarefaParaTrabalho: async () => ({ ...tarefa, arquivos: [{ id: 'a', nome: 'extrato-itau.csv' }] }),
    } as unknown as Repos;
    return { d: { repos, midia: { ler: async () => new Uint8Array() } }, eventos };
  }
  const vezCom = (lerPasta?: VezDaTarefa['lerPasta']): VezDaTarefa =>
    ({ tarefa: { ...tarefa, arquivos: [] }, perfil: { skills: [] } as never, entregou: false, abriuPendencia: false, lidosNaVez: 0, ...(lerPasta ? { lerPasta } : {}) });

  it('traz os novos, diz o que ficou de fora e a próxima ler_arquivo já acha', async () => {
    const { d } = deps();
    const vez = vezCom(async () => ({ situacao: 'lida', novos: ['extrato-itau.csv'], ignorados: [{ nome: 'c.docx', motivo: 'tipo' }] }));
    const r = await executarFerramentaTarefa(d, vez, 'ler_pasta_do_cliente', { subpasta: null });
    expect(r.erro).toBe(false);
    expect(JSON.parse(r.conteudo as string)).toEqual({ novos: ['extrato-itau.csv'], ficaram_de_fora: ['c.docx: o agente não lê este tipo'] });
    expect(vez.tarefa.arquivos.map((a) => a.nome)).toEqual(['extrato-itau.csv']);
  });
  it('sem pasta: o aviso; F4: o Drive que lança não derruba a vez (evento e mensagem fixa)', async () => {
    const { d, eventos } = deps();
    expect((await executarFerramentaTarefa(d, vezCom(), 'ler_pasta_do_cliente', { subpasta: null })).erro).toBe(true);
    const r = await executarFerramentaTarefa(d, vezCom(async () => { throw new Error('rede caiu'); }), 'ler_pasta_do_cliente', { subpasta: '2026' });
    expect(r).toEqual({ conteudo: JSON.stringify({ erro: FALHA_LEITURA_PASTA }), erro: true });
    expect(eventos).toEqual([`não leu a pasta do Drive: ${FALHA_LEITURA_PASTA}`]);
  });
  it('LER A PASTA DE NOVO (job): sem Drive ou sem pasta deixa o motivo na linha do tempo (revisão final, Important 1)', async () => {
    const semDrive = montar();
    expect(await lerPastaPedida({ ...semDrive.d, drive: null }, 'T', false)).toEqual({ situacao: 'sem_drive' });
    expect(semDrive.eventos).toEqual([TEXTO_PEDIDO_SEM_DRIVE]);
    const semPasta = montar({ pasta: null });
    expect(await lerPastaPedida(semPasta.d, 'T', true)).toEqual({ situacao: 'sem_pasta' });
    expect(semPasta.eventos).toEqual([TEXTO_PEDIDO_SEM_PASTA]);
    expect(TEXTO_PEDIDO_SEM_DRIVE).toBe('não leu a pasta do Drive: o Drive não está configurado no escritório. O agente lê só os arquivos enviados.');
    expect(TEXTO_PEDIDO_SEM_PASTA).toBe('não leu a pasta do Drive: o cliente desta tarefa não tem pasta no Drive. Preencha na ficha do cliente, em Arquivos.');
    // Decidida e sem a I3b: nada a dizer; a leitura normal segue gravando o próprio evento.
    const decidida = montar({ estado: 'aprovada' });
    expect(await lerPastaPedida(decidida.d, 'T', false)).toEqual({ situacao: 'decidida' });
    expect(decidida.eventos).toEqual([]);
    const lida = montar();
    expect((await lerPastaPedida(lida.d, 'T', false)).situacao).toBe('lida');
    expect(lida.eventos).toHaveLength(1);
    // Evento que não grava não derruba o job.
    const quebrado = montar({ pasta: null });
    (quebrado.d.repos as unknown as { eventoTarefa: () => Promise<void> }).eventoTarefa = async () => { throw new Error('banco fora'); };
    expect(await lerPastaPedida(quebrado.d, 'T', true)).toEqual({ situacao: 'sem_pasta' });
  });
  it('LER A PASTA DE NOVO (job): só a última tentativa engole o erro', async () => {
    const m = montar({}, [pasta(SOL, 'Padaria Sol'), arq('falha-registro', 'x.csv', [SOL])]);
    await expect(lerPastaPedida(m.d, 'T', false)).rejects.toThrow('Arquivo não encontrado no envio.');
    expect(await lerPastaPedida(m.d, 'T', true)).toEqual({ situacao: 'erro', mensagem: FALHA_LEITURA_PASTA });
  });
  it('F4: lerPastaComAviso nunca lança (a primeira vez lê a pasta sem risco para a vez)', async () => {
    const m = montar({}, [pasta(SOL, 'Padaria Sol'), arq('falha-registro', 'x.csv', [SOL])]);
    expect(await lerPastaComAviso(m.d, 'T', null)).toEqual({ situacao: 'erro', mensagem: FALHA_LEITURA_PASTA });
    expect(m.eventos.at(-1)).toBe(`não leu a pasta do Drive: ${FALHA_LEITURA_PASTA}`);
  });
});
