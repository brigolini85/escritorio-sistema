import 'server-only';
import type { EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import type { PessoaSetor } from '@/app/(painel)/demandas/acoes-demanda';
import { OPCOES_PRIORIDADE, type Prioridade } from './demandas';
import { temNivel } from './permissoes';
import type { UsuarioPainel } from './sessao';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
export type DadosNovaDemanda = {
  empresas: EmpresaOpcao[]; setores: { id: string; nome: string }[]; pessoas: PessoaSetor[];
  sugeridos: Record<Prioridade, string | null>; podePrazo: boolean;
};

/** Nova demanda (spec 6.4): empresas ativas (ou só `so`, as da conversa), setores da pessoa, pessoas ativas e o prazo sugerido. */
export async function lerDadosNovaDemanda(sb: Sb, u: UsuarioPainel, so?: string[]): Promise<DadosNovaDemanda> {
  let clientes = sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('ativo', true).order('razao_social');
  if (so) clientes = clientes.in('id', so.length ? so : ['00000000-0000-0000-0000-000000000000']);
  const [{ data: empresas }, { data: setores }, { data: pessoas }, ...prazos] = await Promise.all([
    clientes,
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome, ativo, usuario_setores(setor_id)').order('nome'),
    ...OPCOES_PRIORIDADE.map((o) => sb.rpc('calcular_prazo', { p_prioridade: o.valor })),
  ]);
  return {
    empresas: (empresas ?? []).map((c) => ({ id: c.id, nome: c.nome_fantasia ?? c.razao_social, detalhe: c.cnpj })),
    setores: u.papel === 'admin' ? setores ?? [] : (setores ?? []).filter((s) => u.setores.includes(s.id)),
    // Arquivada não recebe demanda nova (Parte B): só ativas.
    pessoas: (pessoas ?? []).filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, setores: p.usuario_setores.map((s) => s.setor_id) })),
    sugeridos: Object.fromEntries(OPCOES_PRIORIDADE.map((o, i) => [o.valor, (prazos[i]?.data as string | null) ?? null])) as Record<Prioridade, string | null>,
    podePrazo: temNivel(u, 'prazos', 'sim'),
  };
}
