import { limparBanco } from '@escritorio/db/teste';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../../test/apoio/cenario';
import { criarClienteIa } from '../agente/cliente-ia';
import { CanalFalso } from '../canal/falso';
import { LimitadorEnvio } from '../envio';
import { criarArmazenamento } from '../midia/armazenamento';
import { processarConversa } from '../processar-conversa';
import { CENARIOS, type Cenario } from './cenarios';

const SEGUNDA_10H = '2026-09-28T13:00:00Z';

async function preparar(c: Cenario) {
  await limparBanco();
  await db.from('servicos').delete().neq('nome', '');
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  for (const f of c.faq ?? []) await db.from('respostas_prontas').insert(f);
  if (c.empresas.length === 0) return repos.obterOuCriarConversa('5531988887777', null);
  const { empresas, conversa } = await contatoComEmpresas(c.empresas);
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

async function rodar(c: Cenario): Promise<string[]> {
  const conversa = await preparar(c);
  for (const [i, texto] of c.mensagens.entries()) {
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: `CEN-${i}-${Date.now()}`, tipo: 'texto', conteudo: texto });
  }
  const canal = new CanalFalso();
  const deps = {
    repos, ia: criarClienteIa(process.env.ANTHROPIC_API_KEY!),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db), transcritor: { transcrever: async () => '' },
    alertas: { alertar: async () => {} }, relogio: () => new Date(c.agora ?? SEGUNDA_10H),
  };
  await processarConversa(deps, conversa.id, true);
  // Segunda rodada (ex.: o "sim" que confirma uma alteração de preço).
  const falhasRodada1: string[] = [];
  if (c.mensagens2) {
    if (c.espera.precoFinal) {
      const antes = await precoVigente(c.espera.precoFinal.produto, c.espera.precoFinal.rede);
      if (antes && antes.origem === 'agente') falhasRodada1.push('alterou o preço antes de o cliente confirmar');
    }
    for (const [i, texto] of c.mensagens2.entries()) {
      await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: `CEN2-${i}-${Date.now()}`, tipo: 'texto', conteudo: texto });
    }
    await processarConversa(deps, conversa.id, true);
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
  for (const t of e.tituloContem ?? []) if (!chamados?.some((x) => x.titulo.toLowerCase().includes(t.toLowerCase()))) falhas.push(`título do chamado deveria conter "${t}"`);
  for (const t of e.respostaContem ?? []) if (!respostas.toLowerCase().includes(t.toLowerCase())) falhas.push(`resposta deveria conter "${t}"`);
  const arquivos = canal.enviados.flatMap((x) => (x.arquivo ? [x.arquivo] : []));
  if (e.documentoEnviado && !arquivos.includes(e.documentoEnviado)) falhas.push(`esperava enviar ${e.documentoEnviado}; enviou ${JSON.stringify(arquivos)}`);
  if (e.semDocumento && arquivos.length) falhas.push(`não deveria enviar documento; enviou ${JSON.stringify(arquivos)}`);
  const digitos = respostas.replace(/\D/g, '');
  for (const n of e.respostaContemNumero ?? []) if (!digitos.includes(n)) falhas.push(`resposta deveria trazer o número ${n}`);
  for (const t of e.semTexto ?? []) if (respostas.includes(t)) falhas.push(`resposta não deveria conter "${t}"`);
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
