import { mensagemPendencias } from '@escritorio/core';
import { configurarAgenteTeste, criarTarefaTeste, limparBanco, nivelTeste, repassarPendenciaTeste, sqlTeste } from '@escritorio/db/teste';
import { db, repos, setorId } from '../../test/apoio/cenario';
import { criarUsuarioTeste } from '../../test/apoio/usuario';
import { criarClienteIa } from '../agente/cliente-ia';
import { processarAssistente } from '../assistente/processar';
import { CanalFalso } from '../canal/falso';

/** Parte I4 (D18): pedir ao agente pelo WhatsApp e pelo Assistente do painel, com o Claude de verdade, no banco local. A tarefa só é criada (sem fila). */
type Quem = 'claudia' | 'paula' | 'admin';
type Preparado = { empresa: string; usuarios: Record<Quem, string>; telefones: Record<Quem, string | null> };
type Cenario = {
  nome: string; quem: Quem; canal: 'site' | 'whatsapp'; texto: string;
  antes?: (p: Preparado) => Promise<void>;
  conferir: (p: Preparado, respostas: string) => Promise<string[]>;
};

type Tarefa = { id: string; canal: string; agente: string; empresa: string | null; numero: number; pedida_por: string | null; chamado_numero: number };
const tarefas = () => sqlTeste<Tarefa>(`select t.id, t.canal, a.slug as agente, c.razao_social as empresa, t.numero, t.pedida_por, ch.numero as chamado_numero
  from public.agente_tarefas t join public.agentes a on a.id = t.agente_id left join public.clientes c on c.id = t.cliente_id
  join public.chamados ch on ch.id = t.chamado_id order by t.numero`);

const PEDIDO = 'pede pro contábil fazer o fechamento de outubro da Padaria Sol';
const CENARIOS: Cenario[] = [
  { nome: 'whatsapp: pede pro contábil o fechamento de outubro da Padaria Sol', quem: 'claudia', canal: 'whatsapp', texto: PEDIDO,
    conferir: async (_p, respostas) => {
      const f: string[] = [];
      const ts = await tarefas();
      if (ts.length !== 1) return [`esperava 1 tarefa, achei ${ts.length}`];
      const t = ts[0]!;
      if (t.canal !== 'whatsapp') f.push(`canal ${t.canal}`);
      if (t.agente !== 'contabil') f.push(`agente ${t.agente}`);
      if (t.empresa !== 'Padaria Sol ME') f.push(`empresa ${t.empresa}`);
      if (!respostas.includes('T-')) f.push('a resposta deveria conter "T-"');
      if (!respostas.includes('#')) f.push('a resposta deveria conter "#"');
      return f;
    } },
  { nome: 'whatsapp: outro setor recusa', quem: 'paula', canal: 'whatsapp', texto: PEDIDO,
    conferir: async (_p, respostas) => {
      const f: string[] = [];
      const n = (await tarefas()).length;
      if (n !== 0) f.push(`esperava 0 tarefas, achei ${n}`);
      if (respostas.includes('T-0')) f.push('a resposta não deveria conter "T-0"');
      return f;
    } },
  { nome: 'whatsapp: pergunta com verbo não vira tarefa', quem: 'claudia', canal: 'whatsapp',
    texto: 'o agente contábil consegue fazer o fechamento da Padaria Sol? só quero saber, não pede ainda',
    conferir: async () => { const n = (await tarefas()).length; return n === 0 ? [] : [`esperava 0 tarefas, achei ${n}`]; } },
  { nome: 'whatsapp: responde a pendência repassada', quem: 'claudia', canal: 'whatsapp', texto: 'empréstimo',
    antes: async (p) => {
      const ch = (await db.from('chamados').insert({ cliente_id: p.empresa, setor_id: await setorId('Contábil'), titulo: 'Fechamento de outubro' }).select('id, numero').single()).data!;
      const pergunta = 'O PIX de R$ 3.200 em 12/10 para o sócio é pró-labore, lucro ou empréstimo?';
      const opcoes = ['pró-labore', 'lucro', 'empréstimo'];
      const t = await criarTarefaTeste({ chamadoId: ch.id, pedidaPor: p.usuarios.claudia, estado: 'aguardando_pendencias',
        pendencias: [{ tipo: 'analista', pergunta, opcoes }] });
      await repassarPendenciaTeste(t.id, 1);
      await repos.registrarMensagemAssistente({ usuarioId: p.usuarios.claudia, canal: 'whatsapp', conversaId: null, papel: 'assistente', processada: true,
        conteudo: mensagemPendencias({ tarefa: t.numero, agente: 'Agente Contábil', demanda: ch.numero, empresa: 'Padaria Sol ME', setor: 'Contábil',
          analista: [{ numero: 1, pergunta, detalhe: null, opcoes }], cliente: 0 }) });
    },
    conferir: async (p) => {
      const ps = await sqlTeste<{ estado: string; resposta: string | null; respondida_por: string | null }>('select estado, resposta, respondida_por from public.agente_pendencias');
      const x = ps[0];
      if (!x) return ['a pendência sumiu'];
      const f: string[] = [];
      if (x.estado !== 'respondida') f.push(`estado ${x.estado}`);
      if (!x.resposta?.toLowerCase().includes('empréstimo')) f.push(`resposta ${x.resposta}`);
      if (x.respondida_por !== p.usuarios.claudia) f.push(`respondida_por ${x.respondida_por}`);
      return f;
    } },
  { nome: 'site: pede pelo Assistente do painel', quem: 'admin', canal: 'site', texto: 'pede pro agente contábil conferir os extratos de outubro da Padaria Sol',
    conferir: async () => {
      const ts = await tarefas();
      if (ts.length !== 1) return [`esperava 1 tarefa, achei ${ts.length}`];
      const f: string[] = [];
      if (ts[0]!.canal !== 'painel') f.push(`canal ${ts[0]!.canal}`);
      const ev = await sqlTeste('select 1 from public.agente_tarefa_eventos where tarefa_id = $1 and texto = $2', [ts[0]!.id, 'pediu a tarefa pelo Assistente']);
      if (!ev.length) f.push('falta o evento "pediu a tarefa pelo Assistente"');
      return f;
    } },
];

async function rodar(c: Cenario): Promise<string[]> {
  await limparBanco();
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  await configurarAgenteTeste('contabil', { estado: 'ligado', tipos: ['trabalho'] });
  const empresa = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!.id;
  const perm = ['assistente_site', 'assistente_whatsapp'];
  const claudia = await criarUsuarioTeste({ email: 'claudia@pedir.local', nome: 'Cláudia', papel: 'atendente', setores: ['Contábil'], permissoes: perm, telefone: '5531911110001' });
  const paula = await criarUsuarioTeste({ email: 'paula@pedir.local', nome: 'Paula', papel: 'atendente', setores: ['Pessoal'], permissoes: perm, telefone: '5531911110002' });
  const admin = await criarUsuarioTeste({ email: 'admin@pedir.local', nome: 'Dono', papel: 'admin', permissoes: perm, telefone: '5531911110003' });
  for (const u of [claudia, paula, admin]) await nivelTeste(u, 'assistente', 'site_whatsapp');
  const p: Preparado = { empresa, usuarios: { claudia, paula, admin }, telefones: { claudia: '5531911110001', paula: '5531911110002', admin: null } };
  await c.antes?.(p);

  const usuarioId = p.usuarios[c.quem];
  await repos.registrarMensagemAssistente({ usuarioId, canal: c.canal, conversaId: null, papel: 'usuario', conteudo: c.texto });
  const antes = new Date();
  const deps = { repos, ia: criarClienteIa(process.env.ANTHROPIC_API_KEY!), canal: new CanalFalso() };
  const resultado = await processarAssistente(deps, { usuarioId, canal: c.canal, conversaId: null, telefone: c.canal === 'whatsapp' ? p.telefones[c.quem] : null }, true);
  const respostas = (await repos.historicoAssistente(usuarioId, c.canal, null, 50)).filter((m) => m.papel === 'assistente' && new Date(m.criado_em) >= antes)
    .map((m) => m.conteudo).join('\n');
  const falhas = await c.conferir(p, respostas);
  if (falhas.length) {
    const linhas = await tarefas();
    falhas.push(`resultado: ${resultado}; resposta do assistente: ${respostas}; tarefas: ${JSON.stringify(linhas)}`);
  }
  return falhas;
}

async function principal() {
  if (!process.env.ANTHROPIC_API_KEY) { console.error('Falta a ANTHROPIC_API_KEY no .env.'); process.exit(1); }
  // `pnpm cenarios-pedir "outro setor"` roda só os cenários cujo nome contém o texto.
  const filtro = process.argv[2]?.trim();
  const lista = filtro ? CENARIOS.filter((c) => c.nome.includes(filtro)) : CENARIOS;
  if (lista.length === 0) { console.error(`Nenhum cenário com "${filtro}" no nome.`); process.exit(1); }
  let falhou = 0;
  for (const c of lista) {
    const falhas = await rodar(c).catch((e: Error) => [`erro: ${e.message}`]);
    if (falhas.length) falhou++;
    console.log(`${falhas.length ? '❌' : '✅'} ${c.nome}${falhas.length ? `\n   - ${falhas.join('\n   - ')}` : ''}`);
  }
  console.log(`\n${lista.length - falhou}/${lista.length} cenários do pedir ao agente passaram`);
  process.exit(falhou ? 1 : 0);
}

void principal();
