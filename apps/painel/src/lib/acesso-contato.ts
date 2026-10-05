import 'server-only';
import {
  CANAIS_AVISO, PERFIS, setoresDisponiveis, type CanalAviso, type MarcasAcesso, type Perfil, type SetorDisponivel,
} from '@escritorio/core';
import { nomeEmpresa } from '@/lib/contatos';
import type { supabaseServidor } from '@/lib/supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Banco sem a Parte H2 (homologação, D24): coluna, relação ou função que não existem. Só leitura GET ou rpc, nunca head. */
export function semMigracaoH2(e: { code?: string } | null | undefined): boolean {
  return !!e && ['42703', '42P01', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'].includes(e.code ?? '');
}

export type AcessoDoVinculo = { perfil: Perfil; marcas: MarcasAcesso };
export type Socio = { contatoId: string; primeiroNome: string };
type LinhaAcesso = {
  perfil?: unknown; pode_pedir_nota?: unknown; pode_atualizar_preco?: unknown; ver_valores?: unknown; receber_documentos?: unknown;
  avisar_documento_novo?: unknown; recebe_alertas_acesso?: unknown;
  contato_cliente_setores?: { setor_id: string; pode_ser_procurado: boolean }[] | null;
};
const COLUNAS_ACESSO = 'perfil, pode_pedir_nota, pode_atualizar_preco, ver_valores, receber_documentos, avisar_documento_novo, recebe_alertas_acesso, contato_cliente_setores(setor_id, pode_ser_procurado)';

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/** Linha de contato_clientes → perfil e marcações; o que vier estranho fica como "nada marcado". */
export function lerAcesso(l: LinhaAcesso): AcessoDoVinculo {
  return {
    perfil: (PERFIS as readonly string[]).includes(String(l.perfil)) ? (l.perfil as Perfil) : 'basico',
    marcas: {
      setores: (l.contato_cliente_setores ?? []).map((s) => ({ setorId: s.setor_id, podeSerProcurado: s.pode_ser_procurado === true })),
      podePedirNota: l.pode_pedir_nota === true, podeAtualizarPreco: l.pode_atualizar_preco === true,
      verValores: l.ver_valores === true, receberDocumentos: l.receber_documentos === true,
      avisarDocumentoNovo: (Array.isArray(l.avisar_documento_novo) ? l.avisar_documento_novo : [])
        .filter((c): c is CanalAviso => (CANAIS_AVISO as readonly unknown[]).includes(c)),
      recebeAlertasAcesso: l.recebe_alertas_acesso === true,
    },
  };
}

async function setoresAtivos(sb: Sb) {
  const { data, error } = await sb.from('setores').select('id, nome, descricao_assuntos').eq('ativo', true);
  if (error) console.error('[acesso] falha ao ler os setores', error);
  return data ?? [];
}

async function contratadosPorEmpresa(sb: Sb, clienteIds: string[]): Promise<Map<string, string[]>> {
  const mapa = new Map<string, string[]>(clienteIds.map((id) => [id, []]));
  if (!clienteIds.length) return mapa;
  const { data, error } = await sb.from('cliente_servicos').select('cliente_id, servicos(setor_id, ativo)').in('cliente_id', clienteIds);
  if (error) console.error('[acesso] falha ao ler os serviços', error);
  for (const l of data ?? []) if (l.servicos?.ativo && l.servicos.setor_id) mapa.get(l.cliente_id)?.push(l.servicos.setor_id);
  return mapa;
}

/** Setores disponíveis de uma empresa (D5), com os já marcados que saíram do contrato. A ação de salvar usa para o perfil. */
export async function lerDisponiveis(sb: Sb, clienteId: string, marcados: string[]): Promise<SetorDisponivel[]> {
  const [todos, contratados] = await Promise.all([setoresAtivos(sb), contratadosPorEmpresa(sb, [clienteId])]);
  return setoresDisponiveis(todos, contratados.get(clienteId) ?? [], marcados).setores;
}

export type ContatoDaFicha = {
  id: string; nome: string; telefone: string; cargo: string | null; email: string | null; agentePausado: boolean; acesso: AcessoDoVinculo;
  /** Setores do bloco deste contato: os da empresa + os que só ele tem marcados, "fora do contrato". */
  disponiveis: SetorDisponivel[];
};
export type FichaContatos = {
  /** `disponiveis`: só os da empresa (contratados + Financeiro), sem os "fora do contrato" de cada contato. */
  contatos: ContatoDaFicha[]; disponiveis: SetorDisponivel[]; semServicoComSetor: boolean; socios: Socio[]; aguardando: number;
};

/** Aba Contatos da ficha: os contatos ativos da empresa com o acesso de cada um. */
export async function lerContatosDaEmpresa(sb: Sb, clienteId: string): Promise<FichaContatos | 'sem-migracao' | null> {
  const { data, error } = await sb.from('contato_clientes')
    .select(`${COLUNAS_ACESSO}, contatos!inner(id, nome, telefone, cargo, email, agente_pausado, ativo)`)
    .eq('cliente_id', clienteId).eq('contatos.ativo', true);
  if (semMigracaoH2(error)) return 'sem-migracao';
  if (error) {
    console.error('[acesso] falha ao ler os contatos da empresa', error);
    return null;
  }
  const [todos, contratados] = await Promise.all([setoresAtivos(sb), contratadosPorEmpresa(sb, [clienteId])]);
  const daEmpresa = contratados.get(clienteId) ?? [];
  const contatos = (data ?? []).flatMap((l) => {
    if (!l.contatos) return [];
    const acesso = lerAcesso(l);
    // "Fora do contrato" é de cada contato: o setor antigo de um não aparece no bloco do outro.
    const { setores } = setoresDisponiveis(todos, daEmpresa, acesso.marcas.setores.map((s) => s.setorId));
    return [{
      id: l.contatos.id, nome: l.contatos.nome, telefone: l.contatos.telefone, cargo: l.contatos.cargo, email: l.contatos.email,
      agentePausado: l.contatos.agente_pausado, acesso, disponiveis: setores,
    }];
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const { setores, semServicoComSetor } = setoresDisponiveis(todos, daEmpresa, []);
  return {
    contatos, disponiveis: setores, semServicoComSetor,
    socios: contatos.filter((c) => c.acesso.marcas.recebeAlertasAcesso).map((c) => ({ contatoId: c.id, primeiroNome: primeiroNome(c.nome) })),
    aguardando: contatos.filter((c) => c.acesso.perfil === 'basico').length,
  };
}

export type AcessoNaEmpresa = {
  clienteId: string; empresa: string; acesso: AcessoDoVinculo; disponiveis: SetorDisponivel[]; semServicoComSetor: boolean; socios: Socio[];
};

/** Painel lateral de Contatos: o acesso do contato em cada empresa ativa, com os sócios de cada uma (prévia). */
export async function lerAcessosDoContato(sb: Sb, contatoId: string): Promise<AcessoNaEmpresa[] | 'sem-migracao' | null> {
  const { data, error } = await sb.from('contato_clientes')
    .select(`cliente_id, ${COLUNAS_ACESSO}, clientes!inner(id, razao_social, nome_fantasia, ativo)`)
    .eq('contato_id', contatoId).eq('clientes.ativo', true);
  if (semMigracaoH2(error)) return 'sem-migracao';
  if (error) {
    console.error('[acesso] falha ao ler o acesso do contato', error);
    return null;
  }
  const linhas = data ?? [];
  const ids = linhas.map((l) => l.cliente_id);
  const [todos, contratados, alertas] = await Promise.all([
    setoresAtivos(sb), contratadosPorEmpresa(sb, ids),
    ids.length
      ? sb.from('contato_clientes').select('cliente_id, contatos!inner(id, nome, ativo)').in('cliente_id', ids).eq('recebe_alertas_acesso', true).eq('contatos.ativo', true)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (alertas.error) console.error('[acesso] falha ao ler quem recebe alertas', alertas.error);
  return linhas.flatMap((l) => {
    if (!l.clientes) return [];
    const acesso = lerAcesso(l);
    const { setores, semServicoComSetor } = setoresDisponiveis(todos, contratados.get(l.cliente_id) ?? [], acesso.marcas.setores.map((s) => s.setorId));
    const socios = (alertas.data ?? []).filter((a) => a.cliente_id === l.cliente_id && a.contatos && a.contatos.id !== contatoId)
      .map((a) => ({ contatoId: a.contatos!.id, primeiroNome: primeiroNome(a.contatos!.nome) }));
    return [{ clienteId: l.cliente_id, empresa: nomeEmpresa(l.clientes), acesso, disponiveis: setores, semServicoComSetor, socios }];
  }).sort((a, b) => a.empresa.localeCompare(b.empresa, 'pt-BR'));
}

/** Coluna Perfil da tabela de Contatos (D22): perfil de cada contato da página em cada empresa. */
export async function lerPerfisDaPagina(sb: Sb, contatoIds: string[]): Promise<Map<string, Map<string, Perfil>> | 'sem-migracao'> {
  const mapa = new Map<string, Map<string, Perfil>>();
  if (!contatoIds.length) return mapa;
  const { data, error } = await sb.from('contato_clientes').select('contato_id, cliente_id, perfil').in('contato_id', contatoIds);
  if (semMigracaoH2(error)) return 'sem-migracao';
  if (error) console.error('[acesso] falha ao ler os perfis da página', error);
  for (const l of data ?? []) {
    if (!mapa.has(l.contato_id)) mapa.set(l.contato_id, new Map());
    mapa.get(l.contato_id)!.set(l.cliente_id, lerAcesso(l).perfil);
  }
  return mapa;
}
