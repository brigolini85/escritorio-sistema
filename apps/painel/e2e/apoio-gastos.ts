import { criarUsuarioTeste, db } from './apoio';

// Dados da tela Gastos com IA. Só no banco local (o db vem da trava-local).
const ADMIN = { email: 'thiago-gastos@teste.com', senha: 'senha-forte-123' };
const ANA = { email: 'ana-gastos@teste.com', senha: 'senha-forte-123' };
const CNPJ = '19190000000155';
const TELEFONE = '5531999992901';
const MODELO = 'e2e-gastos';

const FUSO = 'America/Sao_Paulo';
const diaSP = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/** Quando gravar "ontem": 24 h atrás se ainda for este mês (Brasília); senão o dia 1º. */
function ontemNoMes(agora: Date): string {
  const ontem = new Date(agora.getTime() - 86_400_000);
  if (diaSP(ontem).slice(0, 7) === diaSP(agora).slice(0, 7)) return ontem.toISOString();
  return `${diaSP(agora).slice(0, 8)}01T00:30:00-03:00`;
}

async function ok<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}
async function idInserido(p: PromiseLike<{ data: { id: string } | null; error: { message: string } | null }>): Promise<string> {
  const data = await ok(p);
  if (!data) throw new Error('inserção não devolveu a linha');
  return data.id;
}

async function apagarPessoa(email: string) {
  const { data } = await db.auth.admin.listUsers();
  for (const u of data.users.filter((x) => x.email === email)) await db.auth.admin.deleteUser(u.id);
  await db.from('usuarios').delete().eq('email', email);
}

export async function limparGastos(): Promise<void> {
  await db.from('uso_ia').delete().eq('modelo', MODELO);
  await db.from('conversas').delete().eq('telefone', TELEFONE);
  await db.from('contatos').delete().eq('telefone', TELEFONE);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
  await apagarPessoa(ADMIN.email);
  await apagarPessoa(ANA.email);
}

export async function semearGastos(): Promise<{
  admin: { email: string; senha: string }; ana: { email: string; senha: string; id: string }; rede: string; conversa: string;
}> {
  // Outros specs podem ter gravado uso_ia no mesmo mês: a tela soma tudo, então começa do zero (banco local).
  await ok(db.from('uso_ia').delete().not('id', 'is', null));
  await limparGastos();

  const admin = await criarUsuarioTeste({ ...ADMIN, nome: 'Thiago Gastos', papel: 'admin' });
  const ana = await criarUsuarioTeste({ ...ANA, nome: 'Ana Gastos', papel: 'atendente', permissoes: ['assistente_site'] });
  const rede = await idInserido(db.from('clientes').insert({ razao_social: 'Rede Bom Preço Gastos', cnpj: CNPJ }).select('id').single());
  const carla = await idInserido(db.from('contatos').insert({ nome: 'Carla Mendes', telefone: TELEFONE }).select('id').single());
  await ok(db.from('contato_clientes').insert({ contato_id: carla, cliente_id: rede, pode_pedir_nota: true }));
  const conversa = await idInserido(db.from('conversas').insert({ telefone: TELEFONE, contato_id: carla, cliente_em_foco: rede }).select('id').single());

  const agora = new Date();
  const hoje = agora.toISOString();
  const ontem = ontemNoMes(agora);
  await ok(db.from('mensagens').insert([
    { conversa_id: conversa, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'Preciso da nota de ontem.', cliente_id: rede, criado_em: ontem, processada_em: ontem },
    { conversa_id: conversa, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'Bom dia, e a nota?', cliente_id: rede, criado_em: hoje, processada_em: hoje },
    { conversa_id: conversa, direcao: 'saida', autor: 'atendente', tipo: 'texto', conteudo: 'Bom dia, Carla. Já envio.', atendente_id: ana, criado_em: hoje, status_envio: 'enviada' },
  ]));

  // Inserção em lote: coluna ausente numa linha vira nulo (não o padrão), então provedor vai em todas.
  const base = { modelo: MODELO, provedor: 'anthropic', tokens_entrada: 1000, tokens_saida: 100 };
  await ok(db.from('uso_ia').insert([
    { ...base, funcionalidade: 'agente_clientes', conversa_id: conversa, cliente_id: rede, custo_usd: 0.4, criado_em: hoje },
    { ...base, funcionalidade: 'agente_clientes', conversa_id: conversa, cliente_id: rede, custo_usd: 0.2, criado_em: ontem },
    { ...base, funcionalidade: 'transcricao_audio', provedor: 'groq', tokens_entrada: 0, tokens_saida: 0, segundos_audio: 90, conversa_id: conversa, cliente_id: rede, custo_usd: 0.01, criado_em: hoje },
    { ...base, funcionalidade: 'sugerir_resposta', usuario_id: ana, conversa_id: conversa, cliente_id: rede, custo_usd: 0.3, criado_em: hoje },
    { ...base, funcionalidade: 'assistente_site', usuario_id: ana, custo_usd: 0.5, criado_em: hoje },
    { ...base, funcionalidade: 'testar_agente', usuario_id: admin, custo_usd: 0.9, criado_em: hoje },
  ]));

  return { admin: ADMIN, ana: { ...ANA, id: ana }, rede, conversa };
}
