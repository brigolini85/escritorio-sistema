import { montarCsvVendaBling, pedidoVendaBling, type PedidoVendaSalvo } from '@escritorio/core';
import { limparBanco } from '@escritorio/db/teste';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../../test/apoio/cenario';
import { criarClienteIa } from '../agente/cliente-ia';
import { ORIENTACOES_SKILL_DONO } from '../agente/orientacoes-skill-dono';
import { CanalFalso } from '../canal/falso';
import { LimitadorEnvio } from '../envio';
import { criarArmazenamento } from '../midia/armazenamento';
import { processarConversa } from '../processar-conversa';
import { CENARIOS, type Cenario } from './cenarios';

const SEGUNDA_10H = '2026-09-28T13:00:00Z';

/** Orientações ligadas do cenário, gerais ou de uma das empresas do contato. */
async function criarOrientacoes(c: Cenario, empresas: string[]) {
  for (const o of c.orientacoes ?? []) {
    const clienteId = o.empresa === 'primeira' ? empresas[0]! : o.empresa === 'segunda' ? empresas[1]! : null;
    await db.from('orientacoes_agente').insert({ titulo: o.titulo, texto: o.texto, tipo: o.tipo, cliente_id: clienteId, ativo: true });
  }
  if (c.orientacoesDaSkill) {
    await db.from('orientacoes_agente').insert(ORIENTACOES_SKILL_DONO.map((o) => ({ titulo: o.titulo, texto: o.texto, tipo: o.tipo, ativo: true })));
  }
}

async function preparar(c: Cenario) {
  await limparBanco();
  await db.from('servicos').delete().neq('nome', '');
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  for (const s of c.setoresExtras ?? []) {
    await db.from('setores').upsert({ nome: s.nome, descricao_assuntos: s.descricao }, { onConflict: 'nome', ignoreDuplicates: true });
  }
  for (const f of c.faq ?? []) await db.from('respostas_prontas').insert(f);
  if (c.empresas.length === 0) {
    await criarOrientacoes(c, []);
    return repos.obterOuCriarConversa('5531988887777', null);
  }
  const { empresas, conversa } = await contatoComEmpresas(c.empresas);
  await criarOrientacoes(c, empresas.map((e) => e.id));
  if (c.empresaEmFoco !== undefined) await repos.atualizarConversa(conversa.id, { cliente_em_foco: empresas[c.empresaEmFoco]!.id });
  if (c.cadastros) await criarCadastrosExemplo(empresas[0]!.id);
  if (c.podeAtualizarPreco) await db.from('contato_clientes').update({ pode_atualizar_preco: true }).eq('cliente_id', empresas[0]!.id);
  for (const nome of c.servicos ?? []) {
    const { data: s } = await db.from('servicos').insert({ nome }).select().single();
    await db.from('cliente_servicos').insert({ cliente_id: empresas[0]!.id, servico_id: s!.id });
  }
  if (c.chamadoExistente) {
    await db.from('chamados').insert({ cliente_id: empresas[0]!.id, conversa_id: conversa.id, setor_id: await setorId(c.chamadoExistente.setor), titulo: c.chamadoExistente.titulo });
  }
  await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
  return conversa;
}

/** Preço vigente de um produto (pelo código) para uma rede (pelo nome). */
async function precoVigente(codigo: string, rede: string) {
  const { data } = await db.from('precos').select('valor, origem, produtos!inner(codigo), parceiros_grupos!inner(nome)')
    .is('vigente_ate', null).eq('produtos.codigo', codigo).eq('parceiros_grupos.nome', rede).maybeSingle();
  return data ? { valor: Number(data.valor), origem: data.origem } : null;
}

async function produtoPorCodigo(codigo: string) {
  const { data } = await db.from('produtos').select('descricao, unidade').eq('codigo', codigo).maybeSingle();
  return data;
}

/** Demandas de nota abertas pelo agente na conversa (título "NF de venda" ou "NF de devolução"). */
async function notasAbertas(conversaId: string): Promise<number> {
  const { data } = await db.from('chamados').select('id').eq('conversa_id', conversaId).like('titulo', 'NF de %');
  return data?.length ?? 0;
}

/** Arquivo do Bling de cada demanda de venda, montado como o painel monta (comprador vindo do cadastro). */
async function csvsBling(conversaId: string): Promise<string[]> {
  const { data } = await db.from('chamados').select('numero, pedido_venda').eq('conversa_id', conversaId).not('pedido_venda', 'is', null);
  const csvs: string[] = [];
  for (const ch of data ?? []) {
    const salvo = ch.pedido_venda as unknown as PedidoVendaSalvo;
    const { data: u } = salvo.unidade_id
      ? await db.from('parceiros_unidades').select('razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').eq('id', salvo.unidade_id).maybeSingle()
      : { data: null };
    csvs.push(montarCsvVendaBling([pedidoVendaBling(Number(ch.numero), salvo, u)]));
  }
  return csvs;
}

async function rodar(c: Cenario): Promise<string[]> {
  const conversa = await preparar(c);
  const canal = new CanalFalso();
  const deps = {
    repos, ia: criarClienteIa(process.env.ANTHROPIC_API_KEY!),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db), transcritor: { transcrever: async () => '' },
    fila: { enviar: async () => {} }, alertas: { alertar: async () => {} }, relogio: () => new Date(c.agora ?? SEGUNDA_10H),
  };
  // Rodadas seguintes (ex.: o "sim" que confirma um preço, o "só essa" que libera a nota), cada uma depois da resposta à anterior.
  const rodadas = [c.mensagens, c.mensagens2, c.mensagens3, c.mensagens4].filter((r): r is string[] => !!r);
  const falhasRodada1: string[] = [];
  for (const [r, mensagens] of rodadas.entries()) {
    if (r > 0 && c.espera.precoFinal) {
      const antes = await precoVigente(c.espera.precoFinal.produto, c.espera.precoFinal.rede);
      if (antes && antes.origem === 'agente') falhasRodada1.push('alterou o preço antes de o cliente confirmar');
    }
    if (r > 0 && c.espera.produtoFinal && await produtoPorCodigo(c.espera.produtoFinal.codigo)) falhasRodada1.push('cadastrou o produto antes de o cliente confirmar');
    for (const [i, texto] of mensagens.entries()) {
      await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: `CEN${r}-${i}-${Date.now()}`, tipo: 'texto', conteudo: texto });
    }
    await processarConversa(deps, conversa.id, true);
    const esperadas = c.espera.notasPorRodada?.[r];
    const abertas = await notasAbertas(conversa.id);
    if (esperadas !== undefined && abertas !== esperadas) falhasRodada1.push(`depois da rodada ${r + 1}: esperava ${esperadas} nota(s) passada(s) para o Fiscal; obteve ${abertas}`);
  }

  const { data: chamados } = await db.from('chamados').select('setor_id, fora_do_contrato, titulo, resumo, setores(nome), origem').eq('conversa_id', conversa.id).eq('origem', 'agente');
  const { data: decisoes } = await db.from('decisoes_agente').select('etapa').eq('conversa_id', conversa.id);
  const etapas = (decisoes ?? []).map((d) => d.etapa);
  const respostas = canal.enviados.map((e) => e.texto ?? '').join('\n');
  const falhas: string[] = [...falhasRodada1];
  const e = c.espera;
  if (e.precoFinal) {
    const p = await precoVigente(e.precoFinal.produto, e.precoFinal.rede);
    if (!p || p.valor !== e.precoFinal.valor || p.origem !== e.precoFinal.origem) {
      falhas.push(`preço final esperado ${JSON.stringify(e.precoFinal)}; obtido ${JSON.stringify(p)}`);
    }
  }
  if (e.produtoFinal) {
    const p = await produtoPorCodigo(e.produtoFinal.codigo);
    if (!!p !== e.produtoFinal.existe) falhas.push(`produto ${e.produtoFinal.codigo} ${e.produtoFinal.existe ? 'deveria' : 'não deveria'} estar cadastrado`);
    if (p && e.produtoFinal.descricao && !p.descricao.toLowerCase().includes(e.produtoFinal.descricao)) falhas.push(`descrição cadastrada: "${p.descricao}"`);
    if (p && e.produtoFinal.unidade && p.unidade !== e.produtoFinal.unidade) falhas.push(`unidade cadastrada: "${p.unidade}"`);
  }
  if (e.chamadoSetor === 'nenhum' && chamados?.length) falhas.push(`não deveria abrir chamado (abriu ${chamados.length})`);
  if (e.chamadoSetor === 'triagem' && !chamados?.some((x) => x.setor_id === null)) falhas.push('esperava chamado de triagem');
  if (e.chamadoSetor === 'qualquer' && !chamados?.length) falhas.push('esperava alguma demanda aberta');
  if (e.chamadoSetor && !['nenhum', 'triagem', 'qualquer'].includes(e.chamadoSetor) && !chamados?.some((x) => x.setores?.nome === e.chamadoSetor)) {
    falhas.push(`esperava chamado no setor ${e.chamadoSetor}; obteve ${JSON.stringify(chamados?.map((x) => x.setores?.nome ?? 'triagem'))}`);
  }
  if (e.foraDoContrato !== undefined && !chamados?.some((x) => x.fora_do_contrato === e.foraDoContrato)) falhas.push(`esperava fora_do_contrato=${e.foraDoContrato}`);
  for (const f of e.ferramentas ?? []) if (!etapas.includes(f)) falhas.push(`esperava usar ${f}`);
  for (const f of e.semFerramentas ?? []) if (etapas.includes(f)) falhas.push(`não deveria usar ${f}`);
  for (const t of e.resumoContem ?? []) if (!chamados?.some((x) => x.resumo.toLowerCase().includes(t.toLowerCase()))) falhas.push(`resumo do chamado deveria conter "${t}"`);
  const csvs = e.csvBlingContem ? await csvsBling(conversa.id) : [];
  for (const t of e.csvBlingContem ?? []) if (!csvs.some((x) => x.includes(t))) falhas.push(`CSV do Bling deveria conter "${t}"; obtido ${JSON.stringify(csvs)}`);
  for (const t of e.tituloContem ?? []) if (!chamados?.some((x) => x.titulo.toLowerCase().includes(t.toLowerCase()))) falhas.push(`título do chamado deveria conter "${t}"`);
  for (const t of e.respostaContem ?? []) if (!respostas.toLowerCase().includes(t.toLowerCase())) falhas.push(`resposta deveria conter "${t}"`);
  const arquivos = canal.enviados.flatMap((x) => (x.arquivo ? [x.arquivo] : []));
  if (e.documentoEnviado && !arquivos.includes(e.documentoEnviado)) falhas.push(`esperava enviar ${e.documentoEnviado}; enviou ${JSON.stringify(arquivos)}`);
  if (e.semDocumento && arquivos.length) falhas.push(`não deveria enviar documento; enviou ${JSON.stringify(arquivos)}`);
  const digitos = respostas.replace(/\D/g, '');
  for (const n of e.respostaContemNumero ?? []) if (!digitos.includes(n)) falhas.push(`resposta deveria trazer o número ${n}`);
  for (const t of e.semTexto ?? []) if (respostas.toLowerCase().includes(t.toLowerCase())) falhas.push(`resposta não deveria conter "${t}"`);
  if (/\p{Extended_Pictographic}/u.test(respostas)) falhas.push('resposta não deveria ter emoji');
  // O cliente conversa com o escritório, não com um sistema: termos internos não aparecem nas respostas.
  for (const t of ['chamado', 'protocolo', 'ticket', 'triagem']) if (respostas.toLowerCase().includes(t)) falhas.push(`resposta não deveria falar em "${t}"`);
  return falhas;
}

async function principal() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Falta a ANTHROPIC_API_KEY no .env: os cenários conversam com o Claude de verdade.');
    process.exit(1);
  }
  let falhou = 0;
  for (const c of CENARIOS) {
    const falhas = await rodar(c).catch((e: Error) => [`erro: ${e.message}`]);
    if (falhas.length) falhou++;
    console.log(`${falhas.length ? '❌' : '✅'} ${c.nome}${falhas.length ? `\n   - ${falhas.join('\n   - ')}` : ''}`);
  }
  console.log(`\n${CENARIOS.length - falhou}/${CENARIOS.length} cenários passaram`);
  process.exit(falhou ? 1 : 0);
}

void principal();
