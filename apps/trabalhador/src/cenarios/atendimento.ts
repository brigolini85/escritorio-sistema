// Cenários com Claude real da Parte E (P19): o motivo da passagem e a sugestão de resposta. Só no banco local; custa centavos.
// `pnpm cenarios-atendimento sensível` roda só os cenários cujo nome contém o texto.
import { MOTIVOS_PASSAGEM } from '@escritorio/core';
import { limparBanco } from '@escritorio/db/teste';
import { contatoComEmpresas, criarCadastrosExemplo, db, repos, setorId } from '../../test/apoio/cenario';
import { FilaFalsa } from '../../test/apoio/fila-falsa';
import { criarUsuarioTeste } from '../../test/apoio/usuario';
import { criarClienteIa, type ClienteIa } from '../agente/cliente-ia';
import { ORIENTACOES_SKILL_DONO } from '../agente/orientacoes-skill-dono';
import { CanalFalso } from '../canal/falso';
import { LimitadorEnvio } from '../envio';
import { criarArmazenamento } from '../midia/armazenamento';
import { processarConversa, type DepsProcessamento } from '../processar-conversa';
import { processarSugestao } from '../sugestao/processar';

const SEGUNDA_10H = new Date('2026-09-28T13:00:00Z');
let seq = 0;

function deps(ia: ClienteIa, canal: CanalFalso): DepsProcessamento {
  return {
    repos, ia, fila: new FilaFalsa(), envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db), transcritor: { transcrever: async () => '' }, alertas: { alertar: async () => {} }, relogio: () => SEGUNDA_10H,
  };
}
const receber = (conversaId: string, conteudo: string) =>
  repos.inserirMensagemEntrada({ conversaId, clienteId: null, idProvedor: `CEN${++seq}`, tipo: 'texto', conteudo, midiaUrlOrigem: null, arquivoMime: null });
const contar = async (t: 'mensagens' | 'decisoes_agente' | 'chamados') => (await db.from(t).select('*', { count: 'exact', head: true })).count ?? 0;

type Cenario = { nome: string; rodar: (ia: ClienteIa) => Promise<string[]> };

const CENARIOS: Cenario[] = [
  {
    nome: 'cliente pede uma pessoa: motivo "pediu para falar com pessoa" e o cliente recebe resposta',
    rodar: async (ia) => {
      const canal = new CanalFalso();
      const { conversa } = await contatoComEmpresas(['Indústria X']);
      await receber(conversa.id, 'Bom dia, quero falar com uma pessoa do escritório, por favor.');
      await processarConversa(deps(ia, canal), conversa.id, true);
      const c = await repos.obterConversa(conversa.id);
      const falhas: string[] = [];
      if (c.motivo_pessoa !== MOTIVOS_PASSAGEM.pedidoCliente) falhas.push(`motivo: ${c.motivo_pessoa}`);
      if (canal.enviados.length === 0) falhas.push('o cliente ficou sem resposta');
      // P4: sem demanda aberta, passar_para_pessoa abre exatamente uma na Triagem (setor nulo).
      const { data: chamados } = await db.from('chamados').select('setor_id').eq('conversa_id', conversa.id);
      const triagem = chamados?.filter((x) => x.setor_id === null).length ?? 0;
      if (triagem !== 1) falhas.push(`esperava 1 demanda na Triagem, obteve ${triagem}`);
      return falhas;
    },
  },
  {
    nome: 'mensagem sem sentido duas vezes: motivo "não entendeu o pedido duas vezes"',
    rodar: async (ia) => {
      const canal = new CanalFalso();
      const { conversa } = await contatoComEmpresas(['Indústria X']);
      await receber(conversa.id, 'kjh qwe zxcv bnm');
      await processarConversa(deps(ia, canal), conversa.id, true);
      await receber(conversa.id, 'pqo wqe rty uio');
      await processarConversa(deps(ia, canal), conversa.id, true);
      const c = await repos.obterConversa(conversa.id);
      return c.motivo_pessoa === MOTIVOS_PASSAGEM.naoEntendeu ? [] : [`motivo: ${c.motivo_pessoa}`];
    },
  },
  {
    nome: 'pedido comum (documento liberado) não passa para pessoa',
    rodar: async (ia) => {
      const canal = new CanalFalso();
      const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
      const cad = await criarCadastrosExemplo(empresas[0]!.id);
      await db.from('documentos_empresa').update({ ia_pode_enviar: true }).eq('id', cad.contrato);
      await receber(conversa.id, 'Oi, me manda o contrato social da empresa?');
      await processarConversa(deps(ia, canal), conversa.id, true);
      const c = await repos.obterConversa(conversa.id);
      return c.aguardando_pessoa_desde === null ? [] : [`passou para pessoa sem precisar: ${c.motivo_pessoa}`];
    },
  },
  {
    // Ledger da Task 6: assunto sensível + pedido de pessoa não pode acabar na Triagem via passar_para_pessoa.
    nome: 'sensível pedindo pessoa: demanda na Direção com prioridade alta e nenhuma na Triagem',
    rodar: async (ia) => {
      const canal = new CanalFalso();
      await db.from('setores').upsert({ nome: 'Direção', descricao_assuntos: 'Reclamação séria, possível erro do escritório, troca de contador, fiscalização, assunto sensível' }, { onConflict: 'nome', ignoreDuplicates: true });
      await db.from('orientacoes_agente').insert(ORIENTACOES_SKILL_DONO.map((o) => ({ titulo: o.titulo, texto: o.texto, tipo: o.tipo, ativo: true })));
      const { conversa } = await contatoComEmpresas(['Indústria X']);
      await repos.atualizarConversa(conversa.id, { aviso_lgpd_enviado_em: new Date().toISOString() });
      await receber(conversa.id, 'Vou contratar uma moça pra produção, quero registrar com o mínimo e pagar o resto por fora. Quero falar com uma pessoa do escritório sobre isso.');
      await processarConversa(deps(ia, canal), conversa.id, true);
      await receber(conversa.id, 'Maria Souza, começa segunda como auxiliar de produção, combinamos 2.500 no total. Prefiro falar com uma pessoa mesmo.');
      await processarConversa(deps(ia, canal), conversa.id, true);
      const { data } = await db.from('chamados').select('setor_id, prioridade, setores(nome)').eq('conversa_id', conversa.id);
      const falhas: string[] = [];
      if (!data?.some((x) => x.setores?.nome === 'Direção' && x.prioridade === 'alta')) falhas.push(`sem demanda na Direção com prioridade alta: ${JSON.stringify(data?.map((x) => [x.setores?.nome ?? 'Triagem', x.prioridade]))}`);
      if (data?.some((x) => x.setor_id === null)) falhas.push('há demanda na Triagem');
      return falhas;
    },
  },
  {
    nome: 'sugestão de preço: traz o valor da tabela e não grava nem envia nada',
    rodar: async (ia) => sugestao(ia, 'Qual o preço da costela pro Supermercado Brasil?', (t) => (/9[,.]50?/.test(t) ? [] : [`sem o preço: ${t}`])),
  },
  {
    nome: 'sugestão de andamento: rascunho curto, sem emoji e sem palavra de sistema',
    rodar: async (ia) => sugestao(ia, 'E a guia do DAS, já saiu?', (t) => {
      const f: string[] = [];
      if (t.length > 1000) f.push('rascunho longo demais');
      return f;
    }),
  },
];

async function sugestao(ia: ClienteIa, pergunta: string, conferir: (texto: string) => string[]): Promise<string[]> {
  const canal = new CanalFalso();
  const pessoa = await criarUsuarioTeste({ email: 'cenario@atendimento.local', nome: 'Ana', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  const { conversa, empresas } = await contatoComEmpresas(['Indústria X']);
  await criarCadastrosExemplo(empresas[0]!.id);
  await repos.abrirChamado({ clienteId: empresas[0]!.id, conversaId: conversa.id, setorId: await setorId('Fiscal'), responsavelId: null,
    titulo: 'Guia DAS de setembro', resumo: 'Cliente pediu a guia do DAS de setembro.', foraDoContrato: false, origem: 'agente' });
  await receber(conversa.id, pergunta);
  const antes = [await contar('mensagens'), await contar('decisoes_agente'), await contar('chamados')];
  const { data } = await db.from('sugestoes_resposta').insert({ usuario_id: pessoa, conversa_id: conversa.id }).select('id').single();
  const r = await processarSugestao({ repos, ia, canal }, data!.id, true);
  const s = (await repos.obterSugestao(data!.id))!;
  const depois = [await contar('mensagens'), await contar('decisoes_agente'), await contar('chamados')];
  const falhas: string[] = [];
  if (r !== 'pronta' || !s.texto) return [`não ficou pronta: ${r} ${s.erro ?? ''}`];
  if (JSON.stringify(antes) !== JSON.stringify(depois)) falhas.push(`gravou algo: antes ${antes} depois ${depois}`);
  if (canal.enviados.length) falhas.push('enviou algo pelo WhatsApp');
  // Vale para toda sugestão: sem emoji, sem palavra de sistema, sem nota interna copiada.
  if (/\p{Extended_Pictographic}/u.test(s.texto)) falhas.push('tem emoji');
  if (/\b(demanda|ticket|chamado|sistema)\b/i.test(s.texto)) falhas.push(`palavra de sistema: ${s.texto}`);
  if (/nota interna/i.test(s.texto)) falhas.push(`marca de nota interna: ${s.texto}`);
  return [...falhas, ...conferir(s.texto)];
}

async function principal() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('Falta a ANTHROPIC_API_KEY no .env.'); process.exit(1); }
  const ia = criarClienteIa(process.env.ANTHROPIC_API_KEY);
  const filtro = process.argv[2]?.trim();
  const lista = filtro ? CENARIOS.filter((c) => c.nome.includes(filtro)) : CENARIOS;
  if (lista.length === 0) { console.error(`Nenhum cenário com "${filtro}" no nome.`); process.exit(1); }
  let falhou = 0;
  for (const c of lista) {
    await limparBanco();
    await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
    const falhas = await c.rodar(ia).catch((e: Error) => [`erro: ${e.message}`]);
    if (falhas.length) falhou++;
    console.log(`${falhas.length ? '❌' : '✅'} ${c.nome}${falhas.length ? `\n   - ${falhas.join('\n   - ')}` : ''}`);
  }
  const custo = (await db.from('uso_ia').select('custo_usd')).data?.reduce((s, u) => s + Number(u.custo_usd), 0) ?? 0;
  console.log(`\n${lista.length - falhou}/${lista.length} cenários do Atendimento passaram (último cenário: US$ ${custo.toFixed(4)})`);
  process.exit(falhou ? 1 : 0);
}

void principal();
