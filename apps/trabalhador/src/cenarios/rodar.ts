import { limparBanco } from '@escritorio/db/teste';
import { contatoComEmpresas, db, repos, setorId } from '../../test/apoio/cenario';
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

async function rodar(c: Cenario): Promise<string[]> {
  const conversa = await preparar(c);
  for (const [i, texto] of c.mensagens.entries()) {
    await repos.inserirMensagemEntrada({ conversaId: conversa.id, clienteId: null, idProvedor: `CEN-${i}-${Date.now()}`, tipo: 'texto', conteudo: texto });
  }
  const canal = new CanalFalso();
  await processarConversa({
    repos, ia: criarClienteIa(process.env.ANTHROPIC_API_KEY!),
    envio: { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db) },
    midia: criarArmazenamento(db), transcritor: { transcrever: async () => '' },
    alertas: { alertar: async () => {} }, relogio: () => new Date(c.agora ?? SEGUNDA_10H),
  }, conversa.id, true);

  const { data: chamados } = await db.from('chamados').select('setor_id, fora_do_contrato, setores(nome), origem').eq('conversa_id', conversa.id).eq('origem', 'agente');
  const { data: decisoes } = await db.from('decisoes_agente').select('etapa').eq('conversa_id', conversa.id);
  const etapas = (decisoes ?? []).map((d) => d.etapa);
  const respostas = canal.enviados.map((e) => e.texto ?? '').join('\n');
  const falhas: string[] = [];
  const e = c.espera;
  if (e.chamadoSetor === 'nenhum' && chamados?.length) falhas.push(`não deveria abrir chamado (abriu ${chamados.length})`);
  if (e.chamadoSetor === 'triagem' && !chamados?.some((x) => x.setor_id === null)) falhas.push('esperava chamado de triagem');
  if (e.chamadoSetor && !['nenhum', 'triagem'].includes(e.chamadoSetor) && !chamados?.some((x) => x.setores?.nome === e.chamadoSetor)) {
    falhas.push(`esperava chamado no setor ${e.chamadoSetor}; obteve ${JSON.stringify(chamados?.map((x) => x.setores?.nome ?? 'triagem'))}`);
  }
  if (e.foraDoContrato !== undefined && !chamados?.some((x) => x.fora_do_contrato === e.foraDoContrato)) falhas.push(`esperava fora_do_contrato=${e.foraDoContrato}`);
  for (const f of e.ferramentas ?? []) if (!etapas.includes(f)) falhas.push(`esperava usar ${f}`);
  for (const f of e.semFerramentas ?? []) if (etapas.includes(f)) falhas.push(`não deveria usar ${f}`);
  for (const t of e.respostaContem ?? []) if (!respostas.toLowerCase().includes(t.toLowerCase())) falhas.push(`resposta deveria conter "${t}"`);
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
