import { writeFileSync } from 'node:fs';
import { montarCsvVendaBling, pedidoVendaBling, type PedidoVendaSalvo } from '@escritorio/core';
import { configurarAgenteTeste, criarSkillTeste, limparBanco } from '@escritorio/db/teste';
import { contatoComEmpresas, criarCadastrosExemplo, db, definirAcessoTeste, repos, setorId } from '../../test/apoio/cenario';
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
  // Parte I1: skills ligadas do Thiago (o limparBanco do começo já apagou as de antes).
  for (const s of c.skills ?? []) {
    await criarSkillTeste('atendimento', s.nome, s.tipo, true, s.arquivos ?? [], { titulo: s.titulo, descricao: s.descricao, corpo: s.corpo });
  }
  if (c.empresas.length === 0) {
    await criarOrientacoes(c, []);
    return repos.obterOuCriarConversa('5531988887777', null);
  }
  const { empresas, conversa, contato } = await contatoComEmpresas(c.empresas, undefined, c.acesso);
  await criarOrientacoes(c, empresas.map((e) => e.id));
  // Parte I2: agentes dos setores. Em Teste "fora da lista", a lista tem só um contato de fora.
  for (const a of c.agentes ?? []) {
    let contatos: string[] = [];
    if (a.estado === 'teste') {
      contatos = a.contatoNoTeste === false
        ? [(await db.from('contatos').insert({ nome: 'Contato de fora', telefone: '5531900000099' }).select('id').single()).data!.id]
        : [contato.id];
    }
    const id = await configurarAgenteTeste(a.slug, { estado: a.estado, modo: a.modo, regras: a.regras ?? [], ferramentas: a.ferramentas ?? [], contatos });
    for (const s of a.skills ?? []) {
      await criarSkillTeste(a.slug, s.nome, s.tipo, true, [], { titulo: s.titulo, descricao: s.descricao, corpo: s.corpo });
    }
    for (const o of a.orientacoes ?? []) {
      await db.from('orientacoes_agente').insert({ titulo: o.titulo, texto: o.texto, tipo: o.tipo, ativo: true, agente_id: id });
    }
  }
  if (c.empresaEmFoco !== undefined) await repos.atualizarConversa(conversa.id, { cliente_em_foco: empresas[c.empresaEmFoco]!.id });
  if (c.cadastros) await criarCadastrosExemplo(empresas[0]!.id);
  if (c.socio) {
    const { data: s } = await db.from('contatos').insert({ nome: c.socio.nome, telefone: c.socio.telefone }).select('id').single();
    await db.from('contato_clientes').insert({ contato_id: s!.id, cliente_id: empresas[0]!.id });
    await definirAcessoTeste(s!.id, empresas[0]!.id,
      { perfil: 'socio', setores: 'todos', verValores: true, receberDocumentos: true, recebeAlertasAcesso: true, podePedirNota: true, podeAtualizarPreco: true });
  }
  const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);   // "%PDF-1.4"
  for (const doc of c.documentosDoSetor ?? []) {
    const arquivo_path = `clientes/${empresas[0]!.id}/${doc.arquivo}`;
    await db.storage.from('documentos').upload(arquivo_path, pdf, { contentType: 'application/pdf', upsert: true });
    await db.from('documentos_empresa').insert({ cliente_id: empresas[0]!.id, nome: doc.nome, arquivo_path, arquivo_nome: doc.arquivo,
      ia_pode_enviar: doc.iaPodeEnviar, setor_id: doc.setor ? await setorId(doc.setor) : null, tem_valores: doc.temValores ?? false });
  }
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

async function contarEtapa(conversaId: string, etapa: string): Promise<number> {
  const { count } = await db.from('decisoes_agente').select('id', { count: 'exact', head: true }).eq('conversa_id', conversaId).eq('etapa', etapa);
  return count ?? 0;
}

/** "dia|data": o texto tem alguma das alternativas (sem diferenciar maiúsculas). */
const contemAlgum = (texto: string, alternativas: string) =>
  alternativas.toLowerCase().split('|').some((a) => texto.toLowerCase().includes(a));

/** Quantas vezes o primeiro nome do contato aparece nas respostas (palavra inteira). */
const vezesDoNome = (texto: string, nome: string) =>
  (texto.match(new RegExp(`(^|[^\\p{L}])${nome}(?![\\p{L}])`, 'giu')) ?? []).length;

/** Custo das chamadas ao Claude do cenário (o limparBanco do próximo apaga o uso_ia). */
async function custoDoCenario(): Promise<number> {
  const { data } = await db.from('uso_ia').select('custo_usd');
  return (data ?? []).reduce((s, u) => s + Number(u.custo_usd), 0);
}

const conversas: { nome: string; rodadas: { cliente: string[]; thiago: string }[] }[] = [];

async function rodar(c: Cenario): Promise<string[]> {
  const conversa = await preparar(c);
  const canal = new CanalFalso();
  const deps = {
    repos, ia: criarClienteIa(process.env.ANTHROPIC_API_KEY!),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db), transcritor: { modelo: 'falso', provedor: 'groq' as const, transcrever: async () => ({ texto: '', segundos: null }) },
    fila: { enviar: async () => {} }, alertas: { alertar: async () => {} }, relogio: () => new Date(c.agora ?? SEGUNDA_10H),
  };
  // Rodadas seguintes (ex.: o "sim" que confirma um preço, o "só essa" que libera a nota), cada uma depois da resposta à anterior.
  const rodadas = [c.mensagens, c.mensagens2, c.mensagens3, c.mensagens4].filter((r): r is string[] => !!r);
  const falhasRodada1: string[] = [];
  const rodadasTexto: string[] = [];
  for (const [r, mensagens] of rodadas.entries()) {
    if (r > 0 && c.espera.precoFinal) {
      const antes = await precoVigente(c.espera.precoFinal.produto, c.espera.precoFinal.rede);
      if (antes && antes.origem === 'agente') falhasRodada1.push('alterou o preço antes de o cliente confirmar');
    }
    if (r > 0 && c.espera.produtoFinal && await produtoPorCodigo(c.espera.produtoFinal.codigo)) falhasRodada1.push('cadastrou o produto antes de o cliente confirmar');
    for (const [i, texto] of mensagens.entries()) {
      await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: `CEN${r}-${i}-${Date.now()}`, tipo: 'texto', conteudo: texto });
    }
    const enviosAntes = canal.enviados.filter((x) => x.telefone === conversa.telefone).length;
    const respondeuAntes = await contarEtapa(conversa.id, 'responder');
    await processarConversa(deps, conversa.id, true);
    // Atendimento rápido: o que esta rodada mandou ao cliente, quantas vezes respondeu e quantas demandas há até aqui.
    const textoRodada = canal.enviados.filter((x) => x.telefone === conversa.telefone).slice(enviosAntes).map((x) => x.texto ?? '').join('\n');
    rodadasTexto.push(textoRodada);
    const respostasRodada = (await contarEtapa(conversa.id, 'responder')) - respondeuAntes;
    if (c.espera.respostasPorRodadaMax !== undefined && respostasRodada > c.espera.respostasPorRodadaMax) {
      falhasRodada1.push(`rodada ${r + 1}: respondeu ${respostasRodada} vezes (máximo ${c.espera.respostasPorRodadaMax}; perguntas juntas numa mensagem)`);
    }
    const demandasEsperadas = c.espera.chamadosPorRodada?.[r];
    if (demandasEsperadas !== undefined) {
      const { count } = await db.from('chamados').select('id', { count: 'exact', head: true }).eq('conversa_id', conversa.id).eq('origem', 'agente');
      if ((count ?? 0) !== demandasEsperadas) falhasRodada1.push(`depois da rodada ${r + 1}: esperava ${demandasEsperadas} demanda(s); obteve ${count ?? 0}`);
    }
    for (const t of c.espera.rodadaContem?.[r] ?? []) {
      if (!contemAlgum(textoRodada, t)) falhasRodada1.push(`rodada ${r + 1}: resposta deveria conter "${t}"; foi: ${JSON.stringify(textoRodada)}`);
    }
    const esperadas = c.espera.notasPorRodada?.[r];
    const abertas = await notasAbertas(conversa.id);
    if (esperadas !== undefined && abertas !== esperadas) falhasRodada1.push(`depois da rodada ${r + 1}: esperava ${esperadas} nota(s) passada(s) para o Fiscal; obteve ${abertas}`);
  }

  const { data: chamados } = await db.from('chamados').select('setor_id, fora_do_contrato, titulo, resumo, setores(nome), origem, prioridade, prazo_em').eq('conversa_id', conversa.id).eq('origem', 'agente');
  const { data: decisoes } = await db.from('decisoes_agente').select('etapa').eq('conversa_id', conversa.id);
  const etapas = (decisoes ?? []).map((d) => d.etapa);
  // Só o que o contato recebeu: o aviso ao sócio vai para outro telefone (Parte H2).
  const doContato = canal.enviados.filter((x) => x.telefone === conversa.telefone);
  const respostas = doContato.map((e) => e.texto ?? '').join('\n');
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
  if (e.prioridade && !chamados?.some((x) => x.prioridade === e.prioridade && x.prazo_em)) {
    falhas.push(`esperava uma demanda com prioridade ${e.prioridade} e prazo; obteve ${JSON.stringify(chamados?.map((x) => x.prioridade))}`);
  }
  for (const f of e.ferramentas ?? []) if (!etapas.includes(f)) falhas.push(`esperava usar ${f}`);
  for (const f of e.semFerramentas ?? []) if (etapas.includes(f)) falhas.push(`não deveria usar ${f}`);
  for (const t of e.resumoContem ?? []) if (!chamados?.some((x) => x.resumo.toLowerCase().includes(t.toLowerCase()))) falhas.push(`resumo do chamado deveria conter "${t}"`);
  const csvs = e.csvBlingContem ? await csvsBling(conversa.id) : [];
  for (const t of e.csvBlingContem ?? []) if (!csvs.some((x) => x.includes(t))) falhas.push(`CSV do Bling deveria conter "${t}"; obtido ${JSON.stringify(csvs)}`);
  for (const t of e.tituloContem ?? []) if (!chamados?.some((x) => x.titulo.toLowerCase().includes(t.toLowerCase()))) falhas.push(`título do chamado deveria conter "${t}"`);
  for (const t of e.respostaContem ?? []) if (!respostas.toLowerCase().includes(t.toLowerCase())) falhas.push(`resposta deveria conter "${t}"`);
  conversas.push({ nome: c.nome, rodadas: rodadas.map((m, i) => ({ cliente: m, thiago: rodadasTexto[i] ?? '' })) });
  if (e.nomeMax !== undefined) {
    const n = vezesDoNome(respostas, e.nomeDoContato ?? 'João');
    if (n > e.nomeMax) falhas.push(`o nome do cliente apareceu ${n} vezes nas respostas (máximo ${e.nomeMax})`);
  }
  for (const s of e.setores ?? []) {
    const ok = s === 'triagem' ? chamados?.some((x) => x.setor_id === null) : chamados?.some((x) => x.setores?.nome === s);
    if (!ok) falhas.push(`esperava uma demanda no setor ${s}; obteve ${JSON.stringify(chamados?.map((x) => x.setores?.nome ?? 'triagem'))}`);
  }
  for (const t of e.resumoContemAlgum ?? []) if (!chamados?.some((x) => contemAlgum(x.resumo, t))) falhas.push(`resumo de alguma demanda deveria conter "${t}"; obtido ${JSON.stringify(chamados?.map((x) => x.resumo))}`);
  const arquivos = doContato.flatMap((x) => (x.arquivo ? [x.arquivo] : []));
  if (e.documentoEnviado && !arquivos.includes(e.documentoEnviado)) falhas.push(`esperava enviar ${e.documentoEnviado}; enviou ${JSON.stringify(arquivos)}`);
  if (e.semDocumento && arquivos.length) falhas.push(`não deveria enviar documento; enviou ${JSON.stringify(arquivos)}`);
  for (const a of e.naoEnviar ?? []) if (arquivos.includes(a)) falhas.push(`não deveria enviar ${a}; enviou ${JSON.stringify(arquivos)}`);
  const digitos = respostas.replace(/\D/g, '');
  for (const n of e.respostaContemNumero ?? []) if (!digitos.includes(n)) falhas.push(`resposta deveria trazer o número ${n}`);
  for (const t of e.semTexto ?? []) if (respostas.toLowerCase().includes(t.toLowerCase())) falhas.push(`resposta não deveria conter "${t}"`);
  if (/\p{Extended_Pictographic}/u.test(respostas)) falhas.push('resposta não deveria ter emoji');
  // O cliente conversa com o escritório, não com um sistema: termos internos não aparecem nas respostas.
  for (const t of ['chamado', 'protocolo', 'ticket', 'triagem']) if (respostas.toLowerCase().includes(t)) falhas.push(`resposta não deveria falar em "${t}"`);
  if (e.foraDoAcesso && !chamados?.some((x) => x.setores?.nome === e.foraDoAcesso && x.titulo.startsWith('Fora do acesso'))) {
    falhas.push(`esperava a demanda "Fora do acesso" no ${e.foraDoAcesso}; obteve ${JSON.stringify(chamados?.map((x) => `${x.setores?.nome ?? 'triagem'}: ${x.titulo}`))}`);
  }
  if (e.avisosAoSocio !== undefined) {
    const n = canal.enviados.filter((x) => x.telefone === c.socio?.telefone).length;
    if (n !== e.avisosAoSocio) falhas.push(`esperava ${e.avisosAoSocio} aviso(s) ao sócio; obteve ${n}`);
  }
  // Parte I2: o que o Thiago e os agentes dos setores fizeram nesta conversa.
  const idDo = async (slug: string) => (await db.from('agentes').select('id').eq('slug', slug).single()).data!.id as string;
  const { data: decisoesAg } = await db.from('decisoes_agente').select('etapa, saida, agente_id').eq('conversa_id', conversa.id);
  const { data: usosAg } = await db.from('uso_ia').select('funcionalidade, agente_id').eq('conversa_id', conversa.id);
  const chamadasAgente = (decisoesAg ?? []).filter((x) => x.etapa === 'chamar_agente' && (x.saida as { agente_id?: string } | null)?.agente_id);
  if (e.agenteChamado === 'nenhum' && chamadasAgente.length) falhas.push('não deveria chamar agente do setor');
  if (e.agenteChamado && e.agenteChamado !== 'nenhum') {
    const id = await idDo(e.agenteChamado);
    if (!chamadasAgente.some((x) => (x.saida as { agente_id?: string }).agente_id === id)) falhas.push(`esperava o Thiago chamar o agente ${e.agenteChamado}`);
  }
  if (e.custoDoAgente) {
    const id = await idDo(e.custoDoAgente);
    if (!(usosAg ?? []).some((u) => u.agente_id === id && u.funcionalidade === 'especialista_setor')) falhas.push(`esperava custo do agente ${e.custoDoAgente}`);
  }
  if (e.semCustoDoAgente) {
    const id = await idDo(e.semCustoDoAgente);
    if ((usosAg ?? []).some((u) => u.agente_id === id)) falhas.push(`não deveria haver custo do agente ${e.semCustoDoAgente}`);
  }
  const envios = ['responder', 'resumir_pedido_nota', 'enviar_documento'];
  if (e.agenteEnviou) {
    const id = await idDo(e.agenteEnviou);
    if (!(decisoesAg ?? []).some((x) => x.etapa === 'responder' && x.agente_id === id)) falhas.push(`esperava o agente ${e.agenteEnviou} responder ao cliente`);
  }
  if (e.agenteNaoEnviou) {
    const id = await idDo(e.agenteNaoEnviou);
    if ((decisoesAg ?? []).some((x) => envios.includes(x.etapa) && x.agente_id === id)) falhas.push(`o agente ${e.agenteNaoEnviou} não deveria falar com o cliente`);
  }
  if (e.soOAgenteEnviou) {
    const id = await idDo(e.soOAgenteEnviou);
    const feitos = (decisoesAg ?? []).filter((x) => envios.includes(x.etapa));
    if (!feitos.length || feitos.some((x) => x.agente_id !== id)) {
      falhas.push(`esperava que só o agente ${e.soOAgenteEnviou} enviasse ao cliente (nenhuma mensagem do Thiago); obteve ${JSON.stringify(feitos.map((x) => `${x.etapa}:${x.agente_id === id ? e.soOAgenteEnviou : x.agente_id ?? 'thiago'}`))}`);
    }
  }
  if (e.marco) {
    const { data: ev } = await db.from('conversa_eventos').select('tipo').eq('conversa_id', conversa.id).eq('tipo', e.marco);
    if (!ev?.length) falhas.push(`esperava o marco ${e.marco} na conversa`);
  }
  return falhas;
}

async function principal() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Falta a ANTHROPIC_API_KEY no .env: os cenários conversam com o Claude de verdade.');
    process.exit(1);
  }
  // `pnpm cenarios prioridade` roda só os cenários cujo nome contém "prioridade" (cada um custa chamadas ao Claude).
  const filtro = process.argv[2]?.trim();
  // Vários filtros separados por ";;" (ex.: "saudação;;prioridade:") rodam os cenários que batem com qualquer um.
  const filtros = filtro ? filtro.split(';;').map((f) => f.trim()).filter(Boolean) : [];
  const lista = filtros.length ? CENARIOS.filter((c) => filtros.some((f) => c.nome.includes(f))) : CENARIOS;
  if (lista.length === 0) { console.error(`Nenhum cenário com "${filtro}" no nome.`); process.exit(1); }
  let falhou = 0;
  let custo = 0;
  // CENARIOS_TETO_USD: para antes do próximo cenário quando o gasto passa do teto (custo do uso_ia de cada cenário).
  const teto = Number(process.env.CENARIOS_TETO_USD ?? 'Infinity');
  let rodados = 0;
  for (const c of lista) {
    if (custo >= teto) { console.log(`\nTeto de US$ ${teto} atingido: parei antes de "${c.nome}".`); break; }
    const falhas = await rodar(c).catch((e: Error) => [`erro: ${e.message}`]);
    const gasto = await custoDoCenario().catch(() => 0);
    custo += gasto;
    rodados++;
    if (falhas.length) falhou++;
    console.log(`${falhas.length ? '❌' : '✅'} ${c.nome} (US$ ${gasto.toFixed(3)})${falhas.length ? `\n   - ${falhas.join('\n   - ')}` : ''}`);
  }
  console.log(`\n${rodados - falhou}/${rodados} cenários passaram (de ${lista.length}); custo US$ ${custo.toFixed(3)}`);
  if (process.env.CENARIOS_CONVERSAS) writeFileSync(process.env.CENARIOS_CONVERSAS, JSON.stringify(conversas, null, 2));
  process.exit(falhou ? 1 : 0);
}

void principal();
