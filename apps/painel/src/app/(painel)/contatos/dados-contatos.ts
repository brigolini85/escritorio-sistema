import 'server-only';
import {
  aplicarFiltrosContatos, digitosDaBusca, lerEmpresasDaVisao, lerResumoWhatsapp, nomeEmpresa,
  type ConsultaContatos, type ConversaDoContato, type FiltroRapido, type FiltrosContatos, type LinhaContato, type ResumoWhatsapp, type Vinculo,
} from '@/lib/contatos';
import type { Prioridade } from '@/lib/demandas';
import type { supabaseServidor } from '@/lib/supabase/servidor';
import { faixaDaConsulta, paginar, type Ordem, type Paginacao } from '@/lib/tabela-url';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

export const POR_PAGINA = 50;
const COLUNAS = 'id, nome, telefone, agente_pausado, empresas, conversa_id, ultimo_contato_em, estado_conversa, atendente_id, atendente_nome, espera_desde';

export type Contagens = Record<'todos' | FiltroRapido, number>;
/** `completa` falso: banco sem a visão da G3 (D14) — lista pelo nome, sem filtros rápidos, empresa e período. */
export type ListaContatos = { linhas: LinhaContato[]; paginacao: Paginacao; contagens: Contagens | null; completa: boolean; erro: boolean };

/** A visão da G3 ainda não existe no banco: o PostgREST novo diz PGRST205; o antigo, 42P01. */
export const semVisao = (e: { code?: string } | null | undefined): boolean => e?.code === 'PGRST205' || e?.code === '42P01';

interface Consulta extends ConsultaContatos<Consulta> {}
const filtrar = <T,>(q: T, f: FiltrosContatos, agora: Date, rapido: FiltroRapido | null): T =>
  aplicarFiltrosContatos(q as unknown as Consulta, f, agora, rapido) as unknown as T;

type LinhaVisao = {
  id: string; nome: string; telefone: string; agente_pausado: boolean; empresas: unknown; conversa_id: string | null;
  ultimo_contato_em: string | null; estado_conversa: 'agente' | 'humano' | null; atendente_id: string | null; atendente_nome: string | null;
  espera_desde: string | null;
};

const paraLinha = (r: LinhaVisao): LinhaContato => ({
  id: r.id, nome: r.nome, telefone: r.telefone, agentePausado: r.agente_pausado, vinculos: lerEmpresasDaVisao(r.empresas),
  conversaId: r.conversa_id, ultimoEm: r.ultimo_contato_em, estado: r.estado_conversa, atendenteId: r.atendente_id,
  atendenteNome: r.atendente_nome, esperaDesde: r.espera_desde,
});

const SEM_LISTA = (erro: boolean): ListaContatos => ({ linhas: [], paginacao: paginar(0, 1, POR_PAGINA), contagens: null, completa: true, erro });

/**
 * A lista (spec 7C.2): cinco contagens (Todos e os quatro filtros rápidos, D4) e a página pedida, tudo em contatos_lista,
 * pela regra de leitura de quem consulta. Sem a visão no banco, a leitura de antes (D14).
 */
export async function lerListaContatos(sb: Sb, f: FiltrosContatos, ordem: Ordem, paginaPedida: number, agora: Date): Promise<ListaContatos> {
  const contar = (rapido: FiltroRapido | null) => filtrar(sb.from('contatos_lista').select('id', { count: 'exact', head: true }), f, agora, rapido);
  const [todos, desligado, semEmpresa, nota, preco] = await Promise.all([contar(null), contar('desligado'), contar('sem_empresa'), contar('nota'), contar('preco')]);
  if (semVisao(todos.error)) return lerListaSemVisao(sb, f, paginaPedida);
  const falha = [todos, desligado, semEmpresa, nota, preco].find((r) => r.error)?.error;
  if (falha) {
    console.error('[contatos] falha ao contar a lista', falha);
    return SEM_LISTA(true);
  }
  const contagens: Contagens = {
    todos: todos.count ?? 0, desligado: desligado.count ?? 0, sem_empresa: semEmpresa.count ?? 0, nota: nota.count ?? 0, preco: preco.count ?? 0,
  };
  const total = f.rapido ? contagens[f.rapido] : contagens.todos;
  const ler = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    const base = filtrar(sb.from('contatos_lista').select(COLUNAS), f, agora, f.rapido);
    const ordenada = ordem.coluna === 'nome'
      ? base.order('nome', { ascending: ordem.direcao === 'asc' })
      : base.order('ultimo_contato_em', { ascending: ordem.direcao === 'asc', nullsFirst: false });
    return ordenada.order('nome').order('id').range(de, ate);
  };
  let paginacao = paginar(total, paginaPedida, POR_PAGINA);
  let r = await ler(paginacao);
  // A lista encolheu entre a contagem e a página: volta para a primeira em vez de mostrar erro.
  if (r.error?.code === 'PGRST103') {
    paginacao = paginar(total, 1, POR_PAGINA);
    r = await ler(paginacao);
  }
  if (r.error) console.error('[contatos] falha ao ler a lista', r.error);
  return { linhas: ((r.data ?? []) as unknown as LinhaVisao[]).map(paraLinha), paginacao, contagens, completa: true, erro: Boolean(r.error) };
}

type Basica = { eq(coluna: string, valor: boolean): Basica; or(filtros: string): Basica };

/** A leitura de antes da G3 (D14): contatos pelo nome; último contato e estado da caixa_entrada (Parte E) só para a página. */
async function lerListaSemVisao(sb: Sb, f: FiltrosContatos, paginaPedida: number): Promise<ListaContatos> {
  const basico = <T,>(q: T): T => {
    let r = (q as unknown as Basica).eq('ativo', true);
    if (f.q) {
      const digitos = digitosDaBusca(f.q);
      r = r.or(`nome.ilike.%${f.q}%${digitos ? `,telefone.ilike.%${digitos}%` : ''}`);
    }
    if (f.rapido === 'desligado') r = r.eq('agente_pausado', true);
    return r as unknown as T;
  };
  const contados = await basico(sb.from('contatos').select('id', { count: 'exact', head: true }));
  if (contados.error) {
    console.error('[contatos] falha ao contar a lista', contados.error);
    return { ...SEM_LISTA(true), completa: false };
  }
  const total = contados.count ?? 0;
  const ler = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    return basico(sb.from('contatos')
      .select('id, nome, telefone, agente_pausado, contato_clientes(pode_pedir_nota, pode_atualizar_preco, clientes(id, razao_social, nome_fantasia, ativo))'))
      .order('nome').order('id').range(de, ate);
  };
  let paginacao = paginar(total, paginaPedida, POR_PAGINA);
  let r = await ler(paginacao);
  if (r.error?.code === 'PGRST103') {
    paginacao = paginar(total, 1, POR_PAGINA);
    r = await ler(paginacao);
  }
  if (r.error) {
    console.error('[contatos] falha ao ler a lista', r.error);
    return { linhas: [], paginacao, contagens: null, completa: false, erro: true };
  }
  const contatos = r.data ?? [];
  const telefones = contatos.map((c) => c.telefone);
  const caixa = telefones.length
    ? await sb.from('caixa_entrada').select('id, telefone, ultima_em, estado, atendente_id, espera_desde').in('telefone', telefones)
    : { data: [], error: null };
  if (caixa.error) console.error('[contatos] falha ao ler as conversas da página', caixa.error);
  const porTelefone = new Map((caixa.data ?? []).map((l) => [l.telefone, l]));
  const linhas: LinhaContato[] = contatos.map((c) => {
    const l = porTelefone.get(c.telefone);
    return {
      id: c.id, nome: c.nome, telefone: c.telefone, agentePausado: c.agente_pausado,
      vinculos: c.contato_clientes.flatMap((v) => (v.clientes?.ativo
        ? [{ empresaId: v.clientes.id, empresa: nomeEmpresa(v.clientes), podePedirNota: v.pode_pedir_nota, podeMudarPreco: v.pode_atualizar_preco }]
        : [])),
      conversaId: l?.id ?? null, ultimoEm: l?.ultima_em ?? null, estado: l?.estado ?? null, atendenteId: l?.atendente_id ?? null,
      atendenteNome: null, esperaDesde: l?.espera_desde ?? null,
    };
  });
  return { linhas, paginacao, contagens: null, completa: false, erro: false };
}

/** Empresas ativas para o seletor da barra e o "vincular empresa" (D5, D10). `detalhe` é o CNPJ (a busca do EscolherEmpresa). */
export async function lerEmpresasAtivas(sb: Sb): Promise<{ id: string; nome: string; detalhe: string }[]> {
  const { data, error } = await sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('ativo', true).order('razao_social');
  if (error) console.error('[contatos] falha ao ler as empresas', error);
  return (data ?? []).map((c) => ({ id: c.id, nome: nomeEmpresa(c), detalhe: c.cnpj }));
}

export type ContatoAberto = {
  id: string; nome: string; telefone: string; agentePausado: boolean; ativo: boolean; criadoEm: string;
  arquivadoEm: string | null; arquivadoPor: string | null; vinculos: Vinculo[];
};

/** O contato do painel, só com tabelas que já existem no banco de todos (D14). Empresas arquivadas ficam de fora (D5). */
export async function lerContato(sb: Sb, id: string): Promise<ContatoAberto | null> {
  const { data: c, error } = await sb.from('contatos')
    .select('id, nome, telefone, agente_pausado, ativo, criado_em, arquivado_em, arquivado_por, contato_clientes(pode_pedir_nota, pode_atualizar_preco, clientes(id, razao_social, nome_fantasia, ativo))')
    .eq('id', id).maybeSingle();
  if (error) console.error('[contatos] falha ao ler o contato', error);
  if (!c) return null;
  const vinculos = c.contato_clientes
    .flatMap((v) => (v.clientes?.ativo
      ? [{ empresaId: v.clientes.id, empresa: nomeEmpresa(v.clientes), podePedirNota: v.pode_pedir_nota, podeMudarPreco: v.pode_atualizar_preco }]
      : []))
    .sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'));
  return {
    id: c.id, nome: c.nome, telefone: c.telefone, agentePausado: c.agente_pausado, ativo: c.ativo, criadoEm: c.criado_em,
    arquivadoEm: c.arquivado_em, arquivadoPor: c.arquivado_por, vinculos,
  };
}

export type WhatsappDoContato = ConversaDoContato & { ultimaEm: string | null; resumo: ResumoWhatsapp | null };

/** Bloco WhatsApp do painel: a conversa pela caixa_entrada (regra de leitura) e o resumo novo, que pode faltar (D14). */
export async function lerWhatsappDoContato(sb: Sb, c: { id: string; telefone: string }): Promise<WhatsappDoContato> {
  const [caixa, resumo] = await Promise.all([
    sb.from('caixa_entrada').select('id, ultima_em, estado, atendente_id, espera_desde').eq('telefone', c.telefone).maybeSingle(),
    sb.rpc('contato_whatsapp_resumo', { p_contato: c.id }),
  ]);
  if (caixa.error) console.error('[contatos] falha ao ler a conversa do contato', caixa.error);
  // PGRST202: banco sem a migração da G3 (D14) — esperado, não vai para o log.
  if (resumo.error && resumo.error.code !== 'PGRST202') console.error('[contatos] falha ao ler o resumo do WhatsApp', resumo.error);
  const atendenteId = caixa.data?.atendente_id ?? null;
  const atendenteNome = atendenteId
    ? (await sb.from('usuarios').select('nome').eq('id', atendenteId).maybeSingle()).data?.nome ?? null
    : null;
  return {
    conversaId: caixa.data?.id ?? null, estado: caixa.data?.estado ?? null, atendenteId, atendenteNome,
    esperaDesde: caixa.data?.espera_desde ?? null, ultimaEm: caixa.data?.ultima_em ?? null,
    resumo: resumo.error ? null : lerResumoWhatsapp(resumo.data),
  };
}

export type DemandaDoContato = { id: string; numero: number; titulo: string; prioridade: Prioridade; prazo: string | null; pausadoDesde: string | null };

/** Demandas abertas do contato (D16): demandas_lista (regra de leitura), até 10, pelo prazo. null = falha de leitura. */
export async function lerDemandasDoContato(sb: Sb, contatoId: string): Promise<{ linhas: DemandaDoContato[]; total: number } | null> {
  const { data, count, error } = await sb.from('demandas_lista')
    .select('id, numero, titulo, prioridade, prazo_em, prazo_pausado_desde', { count: 'exact' })
    .eq('contato_id', contatoId).neq('status', 'concluido')
    .order('prazo_em', { ascending: true, nullsFirst: false }).order('numero').limit(10);
  if (error) {
    console.error('[contatos] falha ao ler as demandas do contato', error);
    return null;
  }
  const linhas = (data ?? []).flatMap((d) => (d.id && d.numero !== null && d.titulo !== null && d.prioridade
    ? [{ id: d.id, numero: d.numero, titulo: d.titulo, prioridade: d.prioridade, prazo: d.prazo_em, pausadoDesde: d.prazo_pausado_desde }]
    : []));
  return { linhas, total: count ?? linhas.length };
}
