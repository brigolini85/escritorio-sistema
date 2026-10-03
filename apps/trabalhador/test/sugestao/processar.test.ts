import Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import type { Repos } from '@escritorio/db';
import { novoEstado } from '../../src/assistente/ferramentas';
import { carregarContextoAssistente } from '../../src/assistente/contexto';
import { CanalFalso } from '../../src/canal/falso';
import { BloqueadoNaSugestao, LEITURAS_REPOS_SUGESTAO, LEITURAS_SUGESTAO, executarLeituraSugestao, reposDaSugestao } from '../../src/sugestao/ferramentas';
import {
  SUGESTAO_FORA_DO_HORARIO, SUGESTAO_SEM_ACESSO, SUGESTAO_SEM_ASSISTENTE, SUGESTAO_TETO, processarSugestao,
} from '../../src/sugestao/processar';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../apoio/cenario';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';
import { criarUsuarioTeste } from '../apoio/usuario';

let canal: CanalFalso;
let ana: string;
let conversaId: string;
let clienteId: string;

/** Tabelas que a sugestão nunca pode mudar (spec 7A.1: nada é enviado nem gravado). */
const TABELAS = ['mensagens', 'chamados', 'chamado_eventos', 'decisoes_agente', 'assistente_mensagens', 'precos', 'conversas', 'conversa_eventos'] as const;
async function contagens(): Promise<Record<string, number>> {
  const r: Record<string, number> = {};
  for (const t of TABELAS) r[t] = (await db.from(t).select('*', { count: 'exact', head: true })).count!;
  return r;
}
async function novaSugestao(usuario = ana): Promise<string> {
  const { data, error } = await db.from('sugestoes_resposta').insert({ usuario_id: usuario, conversa_id: conversaId }).select('id').single();
  if (error) throw error;
  return data.id;
}
const sugestao = async (id: string) => (await repos.obterSugestao(id))!;

beforeEach(async () => {
  await limparBanco();
  canal = new CanalFalso();
  ana = await criarUsuarioTeste({ email: 'ana@sugestao.local', nome: 'Ana', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
  conversaId = conversa.id;
  clienteId = empresas[0]!.id;
  await criarCadastrosExemplo(clienteId);
  await repos.abrirChamado({ clienteId, conversaId, setorId: await setorId('Fiscal'), responsavelId: null, titulo: 'Guia DAS', resumo: 'x', foraDoContrato: false, origem: 'agente' });
  await repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor: 'S1', tipo: 'texto', conteudo: 'Qual o preço da costela pro Brasil?', midiaUrlOrigem: null, arquivoMime: null });
});

describe('Sugerir resposta (spec 7A.1): só lê, nunca envia nem grava', () => {
  it('pronta: consulta, entrega o rascunho, grava só o resultado e o custo da pessoa', async () => {
    const id = await novaSugestao();
    const antes = await contagens();
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'listar_demandas', entrada: { abertas: true } }),
      usarFerramentas({ nome: 'entregar_rascunho', entrada: { texto: 'Oi! A costela para o Brasil sai a R$ 9,50.' } }),
    ]);
    expect(await processarSugestao({ repos, ia, canal }, id, true)).toBe('pronta');
    expect(await sugestao(id)).toMatchObject({ status: 'pronta', texto: 'Oi! A costela para o Brasil sai a R$ 9,50.' });
    expect(await contagens()).toEqual(antes);
    expect(canal.enviados).toEqual([]);
    expect(canal.arquivosEnviados).toEqual([]);
    const uso = (await db.from('uso_ia').select('funcionalidade, usuario_id, conversa_id')).data!;
    expect(uso).toEqual([
      { funcionalidade: 'sugerir_resposta', usuario_id: ana, conversa_id: conversaId },
      { funcionalidade: 'sugerir_resposta', usuario_id: ana, conversa_id: conversaId },
    ]);
    // Só ferramentas de leitura e a entrega do rascunho foram oferecidas à IA.
    expect(ia.recebidos[0]!.tools!.map((t) => (t as { name: string }).name).sort()).toEqual([...LEITURAS_SUGESTAO, 'entregar_rascunho'].sort());
  });

  it('bloqueio: responder, gravar pedido, CSV e ferramentas do agente voltam erro e nada muda (foco da revisão 1)', async () => {
    const id = await novaSugestao();
    const antes = await contagens();
    const ia = new IaRoteirizada([
      usarFerramentas(
        { nome: 'responder', entrada: { texto: 'Enviado!' } },
        { nome: 'alterar_pedido_venda', entrada: { numero: 1, confirmado: true } },
        { nome: 'gerar_csv_bling', entrada: { numeros: [1] } },
        { nome: 'abrir_chamado', entrada: { setor_id: 'triagem', titulo: 'x', resumo: 'x', fora_do_contrato: false, prioridade: 'normal' } },
        { nome: 'enviar_documento', entrada: { documento_id: '00000000-0000-0000-0000-000000000000' } },
      ),
      usarFerramentas({ nome: 'entregar_rascunho', entrada: { texto: 'Rascunho.' } }),
    ]);
    expect(await processarSugestao({ repos, ia, canal }, id, true)).toBe('pronta');
    const resultados = ia.recebidos[1]!.messages.at(-1)!.content as { is_error?: boolean; content: string }[];
    expect(resultados).toHaveLength(5);
    for (const r of resultados) {
      expect(r.is_error).toBe(true);
      expect(r.content).toContain('não está disponível na sugestão');
    }
    expect(await contagens()).toEqual(antes);
    expect(canal.enviados).toEqual([]);
  });

  it('cada ferramenta de leitura só chama leituras do repositório, e todas estão liberadas na sugestão', async () => {
    const chamados: string[] = [];
    // Espião que registra cada método chamado (na hora da chamada) e repassa ao repositório de verdade.
    const espiao = new Proxy(repos, {
      get(alvo, nome) {
        const v = (alvo as unknown as Record<string | symbol, unknown>)[nome];
        if (typeof nome !== 'string' || typeof v !== 'function') return v;
        return (...a: unknown[]) => { chamados.push(nome); return (v as (...x: unknown[]) => unknown).apply(alvo, a); };
      },
    }) as Repos;
    const usuario = (await repos.obterUsuarioAssistente(ana))!;
    const ctx = await carregarContextoAssistente(repos, usuario, 'site', conversaId, new Date());
    const estado = { ...novoEstado(ctx), rascunho: null };
    // Entradas válidas para cada leitura (esquemas em `Entradas`, apps/trabalhador/src/assistente/ferramentas.ts).
    const entradas: Record<string, object> = {
      listar_demandas: { abertas: true }, ver_demanda: { numero: 1 }, buscar_empresas: { texto: 'Indústria' },
      buscar_parceiros: { cliente_id: clienteId, texto: 'Brasil', tipo: 'cliente' }, buscar_produtos: { cliente_id: clienteId, textos: ['costela'] },
      consultar_preco: { cliente_id: clienteId, unidade_id: clienteId, produto_id: clienteId }, dados_cadastro: { cliente_id: clienteId },
      resumo_vendas: { de: '01/09/2026', ate: '30/09/2026' },
    };
    for (const nome of LEITURAS_SUGESTAO) {
      chamados.length = 0;
      const r = await executarLeituraSugestao({ repos: espiao, ia: new IaRoteirizada([]), canal }, estado, nome, entradas[nome] ?? {});
      // Entrada inválida não chamaria nada e o teste passaria à toa: ajuste a entrada ao esquema até não sair este erro.
      expect({ ferramenta: nome, invalida: r.resultado.includes('Entrada inválida') }).toEqual({ ferramenta: nome, invalida: false });
      const fora = chamados.filter((m) => !(LEITURAS_REPOS_SUGESTAO as readonly string[]).includes(m));
      expect({ ferramenta: nome, fora }).toEqual({ ferramenta: nome, fora: [] });
    }
  });

  it('o repositório da sugestão recusa toda gravação', async () => {
    const id = await novaSugestao();
    const r = reposDaSugestao(repos, (await repos.obterSugestao(id))!);
    const gravacoes: [keyof Repos, unknown[]][] = [
      ['criarSaidaPendente', [{ conversaId, clienteId: null, autor: 'agente', conteudo: 'x' }]],
      ['abrirChamado', [{ clienteId: null, conversaId, setorId: null, responsavelId: null, titulo: 'x', resumo: 'x', foraDoContrato: false, origem: 'agente' }]],
      ['registrarDecisao', [{ conversaId, clienteId: null, etapa: 'x', entrada: {}, saida: {} }]],
      ['registrarMensagemAssistente', [{ usuarioId: ana, canal: 'site', conversaId, papel: 'assistente', conteudo: 'x' }]],
      ['atualizarConversa', [conversaId, { estado: 'humano' }]],
      ['marcarAguardandoPessoa', [conversaId, 'x']],
      ['atualizarPedidoVenda', ['00000000-0000-0000-0000-000000000000', {}]],
      ['registrarNotaInterna', ['00000000-0000-0000-0000-000000000000', 'x']],
    ];
    for (const [nome, args] of gravacoes) {
      expect(() => (r[nome] as (...a: unknown[]) => unknown)(...args)).toThrow(BloqueadoNaSugestao);
    }
  });

  it('sem o assistente pelo site: falha sem chamar a IA', async () => {
    await db.from('usuarios').update({ permissoes: [] }).eq('id', ana);
    const id = await novaSugestao();
    const ia = new IaRoteirizada([]);
    expect(await processarSugestao({ repos, ia, canal }, id, true)).toBe('falhou');
    expect(await sugestao(id)).toMatchObject({ status: 'falhou', erro: SUGESTAO_SEM_ASSISTENTE });
    expect(ia.recebidos).toHaveLength(0);
  });

  it('sem ver a conversa: falha sem chamar a IA', async () => {
    const duda = await criarUsuarioTeste({ email: 'duda@sugestao.local', nome: 'Duda', papel: 'atendente', setores: ['Pessoal'], permissoes: ['assistente_site'] });
    const id = await novaSugestao(duda);
    const ia = new IaRoteirizada([]);
    expect(await processarSugestao({ repos, ia, canal }, id, true)).toBe('falhou');
    expect(await sugestao(id)).toMatchObject({ erro: SUGESTAO_SEM_ACESSO });
    expect(ia.recebidos).toHaveLength(0);
  });

  it('"Todas as conversas" não alcança o WhatsApp de colega com o assistente: falha sem chamar a IA (regra do banco)', async () => {
    const todas = await criarUsuarioTeste({ email: 'todas@sugestao.local', nome: 'Tadeu', papel: 'atendente', setores: ['Pessoal'], permissoes: ['assistente_site'] });
    await db.from('usuario_permissoes').update({ nivel: 'todas' }).eq('usuario_id', todas).eq('modulo', 'atendimento');
    const id1 = await novaSugestao(todas);
    const ia1 = new IaRoteirizada([usarFerramentas({ nome: 'entregar_rascunho', entrada: { texto: 'Oi.' } })]);
    expect(await processarSugestao({ repos, ia: ia1, canal }, id1, true)).toBe('pronta');
    const telefone = (await repos.obterConversa(conversaId)).telefone;
    await criarUsuarioTeste({ email: 'colega@sugestao.local', nome: 'Colega', papel: 'atendente', permissoes: ['assistente_whatsapp'], telefone });
    const id2 = await novaSugestao(todas);
    const ia2 = new IaRoteirizada([]);
    expect(await processarSugestao({ repos, ia: ia2, canal }, id2, true)).toBe('falhou');
    expect((await sugestao(id2)).erro).toBe(SUGESTAO_SEM_ACESSO);
    expect(ia2.recebidos).toHaveLength(0);
  });

  it('fora do horário e teto: falha sem chamar a IA', async () => {
    await db.from('usuarios').update({ horario_acesso: { semana: null, sabado: null, domingo: null } }).eq('id', ana);
    const id1 = await novaSugestao();
    expect(await processarSugestao({ repos, ia: new IaRoteirizada([]), canal }, id1, true)).toBe('falhou');
    expect((await sugestao(id1)).erro).toBe(SUGESTAO_FORA_DO_HORARIO);
    await db.from('usuarios').update({ horario_acesso: null }).eq('id', ana);
    await db.from('configuracoes').update({ teto_ia_usd: 0 }).eq('id', 1);
    const id2 = await novaSugestao();
    expect(await processarSugestao({ repos, ia: new IaRoteirizada([]), canal }, id2, true)).toBe('falhou');
    expect((await sugestao(id2)).erro).toBe(SUGESTAO_TETO);
  });

  it('no máximo 3 rodadas: a terceira obriga a entregar o rascunho', async () => {
    const id = await novaSugestao();
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'listar_demandas', entrada: {} }),
      usarFerramentas({ nome: 'buscar_empresas', entrada: { texto: 'Indústria' } }),
      usarFerramentas({ nome: 'entregar_rascunho', entrada: { texto: 'Pronto.' } }),
    ]);
    expect(await processarSugestao({ repos, ia, canal }, id, true)).toBe('pronta');
    expect(ia.recebidos).toHaveLength(3);
    expect(ia.recebidos[2]!.tool_choice).toEqual({ type: 'tool', name: 'entregar_rascunho' });
    expect(ia.recebidos[0]!.tool_choice).toBeUndefined();
  });

  it('IA que não entrega nada: falha com aviso', async () => {
    const id = await novaSugestao();
    expect(await processarSugestao({ repos, ia: new IaRoteirizada([fim(), fim(), fim()]), canal }, id, true)).toBe('falhou');
    expect((await sugestao(id)).status).toBe('falhou');
  });

  it('já concluída: ignora (nova tentativa da fila)', async () => {
    const id = await novaSugestao();
    await repos.concluirSugestao(id, { status: 'pronta', texto: 'x' });
    expect(await processarSugestao({ repos, ia: new IaRoteirizada([]), canal }, id, false)).toBe('ignorada');
  });

  it('falha temporária da IA relança antes da última tentativa; na última, falha', async () => {
    const id = await novaSugestao();
    const temporario = () => new Anthropic.APIConnectionError({ message: 'sem rede' });
    await expect(processarSugestao({ repos, ia: new IaRoteirizada([temporario()]), canal }, id, false)).rejects.toThrow('sem rede');
    expect((await sugestao(id)).status).toBe('pendente');
    expect(await processarSugestao({ repos, ia: new IaRoteirizada([temporario()]), canal }, id, true)).toBe('falhou');
  });
});
