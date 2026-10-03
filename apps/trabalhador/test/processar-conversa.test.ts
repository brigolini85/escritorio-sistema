import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../src/canal/falso';
import { LimitadorEnvio } from '../src/envio';
import { criarArmazenamento } from '../src/midia/armazenamento';
import { processarConversa, type DepsProcessamento } from '../src/processar-conversa';
import { contatoComEmpresas, db, repos } from './apoio/cenario';
import { FilaFalsa } from './apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from './apoio/ia-roteirizada';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let canal: CanalFalso;
let alertas: { nivel: string; mensagem: string }[];

function deps(ia: IaRoteirizada, extra: Partial<DepsProcessamento> = {}): DepsProcessamento {
  const baixar = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/ogg' } }));
  return {
    repos, ia, fila: new FilaFalsa(),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db, baixar),
    transcritor: { modelo: 'whisper-large-v3-turbo', provedor: 'groq', transcrever: vi.fn().mockResolvedValue({ texto: 'preciso do holerite', segundos: 30 }) },
    alertas: { alertar: async (a) => { alertas.push(a); } },
    relogio: () => SEGUNDA_10H,
    ...extra,
  };
}
async function receber(conversaId: string, idProvedor: string, conteudo: string, tipo: 'texto' | 'audio' = 'texto') {
  await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor, tipo, conteudo,
    midiaUrlOrigem: tipo === 'audio' ? 'https://z-api.exemplo/a.ogg' : null, arquivoMime: tipo === 'audio' ? 'audio/ogg' : null });
}
// Uso de IA gravado no mês do relógio do teste (o banco grava now(); sem isto o teste quebra quando o mês real muda).
async function registrarUsoNoMesDoRelogio(custoUsd: number) {
  await repos.registrarUsoIa({ funcionalidade: 'testar_agente', usuarioId: null, conversaId: null, clienteId: null, modelo: 'claude-sonnet-5', tokensEntrada: 1, tokensSaida: 1, tokensCacheLeitura: 0, tokensCacheEscrita: 0, custoUsd });
  const { error } = await db.from('uso_ia').update({ criado_em: SEGUNDA_10H.toISOString() }).is('conversa_id', null);
  if (error) throw error;
}
const respondeOi = () => new IaRoteirizada([usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } }), fim()]);

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  alertas = [];
});

describe('processarConversa', () => {
  it('sem mensagens novas não faz nada', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('sem-mensagens');
    expect(ia.recebidos).toHaveLength(0);
  });

  it('com aviso configurado: envia na primeira mensagem uma única vez e responde', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const { data: cfg } = await db.from('configuracoes').select('mensagens').eq('id', 1).single();
    await db.from('configuracoes').update({ mensagens: { ...(cfg!.mensagens as object), aviso_lgpd: 'Aviso de privacidade de teste.' } }).eq('id', 1);
    await receber(conversa.id, 'M1', 'oi');
    expect(await processarConversa(deps(respondeOi()), conversa.id, false)).toBe('agente');
    await receber(conversa.id, 'M2', 'tudo bem?');
    await processarConversa(deps(respondeOi()), conversa.id, false);
    const textos = canal.enviados.map((e) => e.texto!);
    expect(textos.filter((t) => t === 'Aviso de privacidade de teste.')).toHaveLength(1);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
    await db.from('configuracoes').update({ mensagens: cfg!.mensagens }).eq('id', 1);
  });

  it('aviso de privacidade vazio nas configurações: não envia aviso e responde normalmente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    const { data: cfg } = await db.from('configuracoes').select('mensagens').eq('id', 1).single();
    await db.from('configuracoes').update({ mensagens: { ...(cfg!.mensagens as object), aviso_lgpd: '  ' } }).eq('id', 1);
    await receber(conversa.id, 'M1', 'oi');
    expect(await processarConversa(deps(respondeOi()), conversa.id, false)).toBe('agente');
    expect(canal.enviados.map((e) => e.texto)).toEqual(['Olá!']);
    expect((await repos.obterConversa(conversa.id)).aviso_lgpd_enviado_em).not.toBeNull();
    await db.from('configuracoes').update({ mensagens: cfg!.mensagens }).eq('id', 1);
  });

  it('revisão: nova tentativa depois de falha da IA ainda manda a imagem ao agente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: 'IMG1', tipo: 'imagem', conteudo: 'segue o pedido',
      midiaUrlOrigem: 'https://z-api.exemplo/f.jpg', arquivoMime: 'image/jpeg' });
    const baixar = vi.fn().mockImplementation(async () => new Response(new Uint8Array([9, 9, 9]), { headers: { 'content-type': 'image/jpeg' } }));
    const erro = new Anthropic.APIConnectionError({ message: 'sem rede' });
    await expect(processarConversa(deps(new IaRoteirizada([erro]), { midia: criarArmazenamento(db, baixar) }), conversa.id, false)).rejects.toThrow();
    const ia = respondeOi();
    await processarConversa(deps(ia, { midia: criarArmazenamento(db, baixar) }), conversa.id, false);
    expect(ia.recebidos[0]!.messages[0]!.content).toContainEqual(expect.objectContaining({ type: 'image' }));
  });

  it('revisão: resposta antiga do agente não conta como resposta deste turno', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1', 'bom dia');
    await processarConversa(deps(respondeOi()), conversa.id, false);
    await receber(conversa.id, 'M2', 'preciso da guia do DAS');
    expect(await processarConversa(deps(new IaRoteirizada([fim()])), conversa.id, false)).toBe('escalado');
    expect(canal.enviados.at(-1)?.texto).toBe('Recebemos sua mensagem, já vamos te atender.');
  });

  it('revisão: anexo que não baixa avisa o agente e o aviso não se repete na nova tentativa', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: 'IMG2', tipo: 'imagem', conteudo: 'foto do pedido',
      midiaUrlOrigem: 'https://z-api.exemplo/expirou.jpg', arquivoMime: 'image/jpeg' });
    const expirado = vi.fn().mockImplementation(async () => new Response('não existe', { status: 404 }));
    const erro = new Anthropic.APIConnectionError({ message: 'sem rede' });
    await expect(processarConversa(deps(new IaRoteirizada([erro]), { midia: criarArmazenamento(db, expirado) }), conversa.id, false)).rejects.toThrow();
    const ia = respondeOi();
    await processarConversa(deps(ia, { midia: criarArmazenamento(db, expirado) }), conversa.id, false);
    const texto = (ia.recebidos[0]!.messages[0]!.content as { text: string }[])[0]!.text;
    expect(texto).toContain('[anexo não pôde ser baixado]');
    const { data } = await db.from('mensagens').select('conteudo').eq('id_provedor', 'IMG2').single();
    expect(data!.conteudo!.match(/não pôde ser baixado/g)).toHaveLength(1);
  });

  it('mensagens picadas vão juntas numa única chamada ao agente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'M1', 'oi');
    await receber(conversa.id, 'M2', 'tudo bem?');
    await receber(conversa.id, 'M3', 'preciso da guia do DAS');
    const ia = respondeOi();
    await processarConversa(deps(ia), conversa.id, false);
    const texto = (ia.recebidos[0]!.messages[0]!.content as { type: string; text: string }[])[0]!.text;
    expect(texto).toContain('oi\ntudo bem?\npreciso da guia do DAS');
  });

  it('conversa assumida por humano: grava e não responde', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { estado: 'humano', aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1', 'oi');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('humano');
    expect(ia.recebidos).toHaveLength(0);
    expect(canal.enviados).toHaveLength(0);
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
  });

  it('telefone interno (dono) é ignorado', async () => {
    await db.from('configuracoes').update({ telefone_dono: '5531977770000' }).eq('id', 1);
    const conversa = await repos.obterOuCriarConversa('5531977770000', null);
    await receber(conversa.id, 'M1', 'ok');
    expect(await processarConversa(deps(respondeOi()), conversa.id, false)).toBe('interno');
    expect(canal.enviados).toHaveLength(0);
  });

  it('agente pausado: não manda nada ao cliente, abre uma triagem e não chama a IA (decisão do dono)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('configuracoes').update({ agente_pausado: true }).eq('id', 1);
    const ia = respondeOi();
    for (const [i, texto] of ['oi', 'tem alguém aí?', 'preciso da guia'].entries()) {
      await receber(conversa.id, `M${i}`, texto);
      expect(await processarConversa(deps(ia), conversa.id, false)).toBe('pausado');
    }
    expect(ia.recebidos).toHaveLength(0);
    expect(canal.enviados).toEqual([]);
    expect((await db.from('chamados').select('setor_id')).data).toEqual([{ setor_id: null }]);
  });

  it('contato com o agente desligado: nada é enviado, abre triagem e não chama a IA, mesmo com o agente ligado', async () => {
    const { conversa, contato } = await contatoComEmpresas(['Indústria X']);
    await db.from('contatos').update({ agente_pausado: true }).eq('id', contato.id);
    await receber(conversa.id, 'M1', 'oi, tudo bem?');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('pausado');
    expect(ia.recebidos).toHaveLength(0);
    expect(canal.enviados).toEqual([]);
    expect((await db.from('chamados').select('setor_id, titulo').single()).data).toEqual({ setor_id: null, titulo: 'Agente desligado para este contato: atender manualmente' });
  });

  it('teto de gasto com IA atingido: não chama a IA e encaminha para humano', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('configuracoes').update({ teto_ia_usd: 1 }).eq('id', 1);
    await registrarUsoNoMesDoRelogio(1);
    await receber(conversa.id, 'M1', 'oi');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('teto');
    expect(ia.recebidos).toHaveLength(0);
  });

  it('áudio é transcrito e a transcrição vai para o agente', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'M1', '', 'audio');
    const ia = respondeOi();
    await processarConversa(deps(ia), conversa.id, false);
    const texto = (ia.recebidos[0]!.messages[0]!.content as { text: string }[])[0]!.text;
    expect(texto).toContain('[áudio transcrito] preciso do holerite');
    const { data } = await db.from('mensagens').select('transcricao, arquivo_path').eq('id_provedor', 'M1').single();
    expect(data?.transcricao).toBe('preciso do holerite');
    expect(data?.arquivo_path).toMatch(/^conversas\//);
  });

  it('transcrição grava uso: transcricao_audio, groq, segundos, conversa, empresa e o custo por minuto de Configurações', async () => {
    const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
    await db.from('conversas').update({ cliente_em_foco: empresas[0]!.id }).eq('id', conversa.id);
    await db.from('configuracoes').update({ custo_minuto_transcricao_usd: 0.002 }).eq('id', 1);
    await receber(conversa.id, 'M1', '', 'audio');
    await processarConversa(deps(respondeOi()), conversa.id, false);
    const t = (await db.from('uso_ia').select('funcionalidade, provedor, segundos_audio, custo_usd, conversa_id, cliente_id, usuario_id, modelo')
      .eq('funcionalidade', 'transcricao_audio').single()).data!;
    expect(t).toEqual({ funcionalidade: 'transcricao_audio', provedor: 'groq', segundos_audio: 30, custo_usd: 0.001,
      conversa_id: conversa.id, cliente_id: empresas[0]!.id, usuario_id: null, modelo: 'whisper-large-v3-turbo' });
  });

  it('transcrição que falha não grava uso (o fornecedor não cobra) e o agente recebe o aviso', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'M1', '', 'audio');
    await processarConversa(deps(respondeOi(), {
      transcritor: { modelo: 'w', provedor: 'groq', transcrever: vi.fn().mockRejectedValue(new Error('transcrição falhou: 429')) },
    }), conversa.id, false);
    expect((await db.from('uso_ia').select('id').eq('funcionalidade', 'transcricao_audio')).data).toEqual([]);
    expect((await db.from('mensagens').select('transcricao').eq('id_provedor', 'M1').single()).data!.transcricao).toBe('[áudio não pôde ser transcrito]');
  });

  it('o teto soma tudo: só transcrição já no teto faz o agente parar (spec 7B.2)', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('configuracoes').update({ teto_ia_usd: 1 }).eq('id', 1);
    await repos.registrarUsoIa({ funcionalidade: 'transcricao_audio', usuarioId: null, conversaId: conversa.id, clienteId: null, modelo: 'w', provedor: 'groq',
      tokensEntrada: 0, tokensSaida: 0, tokensCacheLeitura: 0, tokensCacheEscrita: 0, segundosAudio: 60, custoUsd: 1 });
    await db.from('uso_ia').update({ criado_em: SEGUNDA_10H.toISOString() }).eq('funcionalidade', 'transcricao_audio');
    await receber(conversa.id, 'M2', 'oi');
    const ia = respondeOi();
    expect(await processarConversa(deps(ia), conversa.id, false)).toBe('teto');
    expect(ia.recebidos).toHaveLength(0);
  });

  it('falha temporária da IA é relançada, exceto na última tentativa', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await receber(conversa.id, 'M1', 'oi');
    const erro = new Anthropic.APIConnectionError({ message: 'sem rede' });
    await expect(processarConversa(deps(new IaRoteirizada([erro])), conversa.id, false)).rejects.toThrow();
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(1);
    expect(await processarConversa(deps(new IaRoteirizada([erro])), conversa.id, true)).toBe('escalado');
    expect(canal.enviados.at(-1)?.texto).toBe('Recebemos sua mensagem, já vamos te atender.');
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(0);
  });

  it('orientações acima do limite não impedem a nova tentativa em falha temporária da IA', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    for (let i = 0; i < 7; i++) {
      await db.from('orientacoes_agente').insert({ titulo: `O${i}`, texto: `${i}`.repeat(1990), tipo: 'jeito', ativo: true });
    }
    await receber(conversa.id, 'M1', 'oi');
    const erro = new Anthropic.APIConnectionError({ message: 'sem rede' });
    await expect(processarConversa(deps(new IaRoteirizada([erro])), conversa.id, false)).rejects.toThrow();
    // O corte só é registrado depois de a IA responder.
    expect((await db.from('decisoes_agente').select('id').eq('etapa', 'orientacoes_cortadas')).data).toEqual([]);
    // E, mesmo registrado, não conta como ação do agente.
    await repos.registrarDecisao({ conversaId: conversa.id, clienteId: null, etapa: 'orientacoes_cortadas', entrada: {}, saida: { cortadas: ['x'] } });
    await expect(processarConversa(deps(new IaRoteirizada([erro])), conversa.id, false)).rejects.toThrow();
    expect(await repos.mensagensNaoProcessadas(conversa.id)).toHaveLength(1);
    expect(canal.enviados).toHaveLength(0);
  });

  it('atendente assume enquanto o agente processa: o sistema não manda aviso nem abre triagem', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
    await receber(conversa.id, 'M1', 'oi');
    const iaQueAssume = {
      recebidos: [] as unknown[],
      async criar() {
        await repos.atualizarConversa(conversa.id, { estado: 'humano' });   // atendente clicou em Assumir
        return usarFerramentas({ nome: 'responder', entrada: { texto: 'Olá!' } });
      },
    };
    const d = { ...deps(respondeOi()), ia: iaQueAssume as never };
    expect(await processarConversa(d, conversa.id, false)).toBe('humano');
    expect(canal.enviados).toHaveLength(0);
    expect((await db.from('chamados').select('*')).data).toHaveLength(0);
  });

  it('avisa o dono uma vez por mês quando o gasto passa de 80% do teto', async () => {
    const { conversa } = await contatoComEmpresas(['Indústria X']);
    await db.from('configuracoes').update({ teto_ia_usd: 1 }).eq('id', 1);
    await registrarUsoNoMesDoRelogio(0.81);
    await receber(conversa.id, 'M1', 'oi');
    await processarConversa(deps(respondeOi()), conversa.id, false);
    await receber(conversa.id, 'M2', 'e aí?');
    await processarConversa(deps(respondeOi()), conversa.id, false);
    expect(alertas.filter((a) => a.mensagem.includes('80%'))).toHaveLength(1);
  });
});
