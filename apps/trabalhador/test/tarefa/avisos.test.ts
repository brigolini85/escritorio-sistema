import { unzipSync, strFromU8 } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { criarTarefaTeste, limparBanco, nivelTeste, opcoesPedidoTeste, sqlTeste } from '@escritorio/db/teste';
import { CanalFalso } from '../../src/canal/falso';
import { enviarAvisoTarefa, registrarAvisos } from '../../src/tarefa/avisos';
import { db, repos, setorId } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { criarUsuarioTeste } from '../apoio/usuario';

// Parte I4 (D9, D10, D12): pendência, pronto e pausa avisam quem pediu, no painel e no WhatsApp; cada aviso sai uma vez só.
const RESULTADO = { versao: 1, resumo: '214 lançamentos, 96% conciliado.', destaques: [], observacoes: null,
  linhas: [{ descricao: 'Tarifa', valor: 12.5, texto: null, fonte: 'extrato.csv', provisoria: true }] };
let claudia: string;
let chamadoId: string;
const avisoDa = (fila: FilaFalsa, i = 0) => (fila.enviados[i]!.dados as { avisoId: string }).avisoId;

beforeEach(async () => {
  await limparBanco();
  claudia = await criarUsuarioTeste({ email: 'claudia@i4av.local', nome: 'Cláudia', papel: 'atendente', setores: ['Contábil'], telefone: '5531911110001' });
  await nivelTeste(claudia, 'assistente', 'site_whatsapp');
  const cliente = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!.id;
  chamadoId = (await db.from('chamados').insert({ cliente_id: cliente, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!.id;
});

describe('avisos da tarefa (I4)', () => {
  it('pendências: um aviso, mensagem com a pergunta e as opções, no histórico do Assistente; a pendência fica repassada', async () => {
    const t = await criarTarefaTeste({ chamadoId, pedidaPor: claudia, estado: 'aguardando_pendencias',
      pendencias: [{ tipo: 'analista', pergunta: 'PIX para o sócio: o que é?', opcoes: ['lucro', 'empréstimo'] }, { tipo: 'cliente', pergunta: 'Extrato do BB', mensagem: 'Manda o extrato?' }] });
    await opcoesPedidoTeste(t.id, { avisarWhatsapp: true });
    const fila = new FilaFalsa();
    await registrarAvisos({ repos, fila }, t.id);
    expect(fila.enviados.map((e) => e.nome)).toEqual(['aviso_tarefa']);
    const canal = new CanalFalso();
    expect(await enviarAvisoTarefa({ repos, canal }, avisoDa(fila))).toBe('enviado');
    expect(canal.enviados).toHaveLength(1);
    expect(canal.enviados[0]).toMatchObject({ telefone: '5531911110001' });
    expect(canal.enviados[0]!.texto).toContain('1. PIX para o sócio: o que é? (lucro / empréstimo)');
    expect(canal.enviados[0]!.texto).toContain('E 1 pendência do cliente: o pedido ao cliente só sai quando alguém do Contábil aprovar no painel.');
    expect(await sqlTeste("select papel, conteudo like '% · T-%' as ok from public.assistente_mensagens where usuario_id = $1", [claudia]))
      .toEqual([{ papel: 'assistente', ok: true }]);
    expect(await sqlTeste('select numero from public.agente_pendencias where tarefa_id = $1 and repassada_em is not null', [t.id])).toEqual([{ numero: 1 }]);
    // De novo: nada sai em dobro.
    expect(await enviarAvisoTarefa({ repos, canal }, avisoDa(fila))).toBe('nada');
    expect(canal.enviados).toHaveLength(1);
  });

  it('pronta: a planilha XLSX vai antes do texto, e o texto diz quem falta aprovar', async () => {
    const t = await criarTarefaTeste({ chamadoId, pedidaPor: claudia, estado: 'pronta', resultado: RESULTADO });
    await opcoesPedidoTeste(t.id, { avisarWhatsapp: true });
    const fila = new FilaFalsa();
    await registrarAvisos({ repos, fila }, t.id);
    const canal = new CanalFalso();
    await enviarAvisoTarefa({ repos, canal }, avisoDa(fila));
    expect(canal.arquivosEnviados.map((a) => a.nome)).toEqual([`tarefa-${t.numero}-rascunho.xlsx`]);
    expect(canal.enviados.map((e) => (e.arquivo ? 'arquivo' : 'texto'))).toEqual(['arquivo', 'texto']);
    const bytes = Buffer.from(canal.arquivosEnviados[0]!.url.split(',')[1]!, 'base64');
    expect(Object.keys(unzipSync(bytes))).toContain('xl/workbook.xml');
    expect(strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']!)).toContain('Tarifa');
    expect(canal.enviados.at(-1)!.texto).toContain('1 linha no rascunho, 1 provisória. A planilha vai anexa.');
    expect(canal.enviados.at(-1)!.texto).toContain('Falta você ou alguém do Contábil aprovar no painel.');
  });

  it('o WhatsApp que falha marca "não enviado" e o painel recebe (D9)', async () => {
    const t = await criarTarefaTeste({ chamadoId, pedidaPor: claudia, estado: 'pronta', resultado: RESULTADO });
    await opcoesPedidoTeste(t.id, { avisarWhatsapp: true, avisarPainel: false });
    const fila = new FilaFalsa();
    await registrarAvisos({ repos, fila }, t.id);
    const canal = new CanalFalso();
    canal.enviarArquivo = async () => { throw new Error('Z-API fora'); };
    expect(await enviarAvisoTarefa({ repos, canal }, avisoDa(fila))).toBe('falhou');
    expect(await sqlTeste('select count(*)::int as n from public.alertas where usuario_id = $1', [claudia])).toEqual([{ n: 1 }]);
  });

  it('o texto que saiu e a marca que falhou: nada sai de novo nem vira "não enviado"', async () => {
    const t = await criarTarefaTeste({ chamadoId, pedidaPor: claudia, estado: 'pausada', motivoPausa: 'falha' });
    await opcoesPedidoTeste(t.id, { avisarWhatsapp: true, avisarPainel: false });
    const fila = new FilaFalsa();
    await registrarAvisos({ repos, fila }, t.id);
    const marcas: boolean[] = [];
    const semMarca = new Proxy(repos, { get: (alvo, k) =>
      k === 'marcarAvisoTarefa' ? async (_id: string, ok: boolean) => { marcas.push(ok); throw new Error('banco caiu'); } : Reflect.get(alvo, k) });
    const canal = new CanalFalso();
    expect(await enviarAvisoTarefa({ repos: semMarca, canal }, avisoDa(fila))).toBe('enviado');
    expect(canal.enviados).toHaveLength(1);
    expect(marcas.every((m) => m)).toBe(true);
    expect(await sqlTeste('select estado from public.agente_tarefa_avisos where id = $1', [avisoDa(fila)])).toEqual([{ estado: 'enviando' }]);
    expect(await enviarAvisoTarefa({ repos, canal }, avisoDa(fila))).toBe('nada');
    expect(canal.enviados).toHaveLength(1);
  }, 15000);

  it('sem pedida_por, sem avisos ou banco sem a I4: nada, sem lançar', async () => {
    const t = await criarTarefaTeste({ chamadoId, estado: 'pronta', resultado: RESULTADO });
    const fila = new FilaFalsa();
    await registrarAvisos({ repos, fila }, t.id);
    const semI4 = new Proxy(repos, { get: (alvo, k) => (k === 'registrarAvisosDaTarefa' ? async () => null : Reflect.get(alvo, k)) });
    await registrarAvisos({ repos: semI4, fila }, t.id);
    const quebrado = new Proxy(repos, { get: (alvo, k) => (k === 'registrarAvisosDaTarefa' ? async () => { throw new Error('x'); } : Reflect.get(alvo, k)) });
    await expect(registrarAvisos({ repos: quebrado, fila }, t.id)).resolves.toBeUndefined();
    expect(fila.enviados).toEqual([]);
  });
});
