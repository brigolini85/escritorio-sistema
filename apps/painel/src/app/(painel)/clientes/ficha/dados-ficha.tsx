import { cofreConfigurado } from '@/lib/cofre';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { AcessosPortais, type AcessoLinha } from './acessos-portais';
import { textoUltimaAlteracao, type ClienteFicha } from './ficha';
import { FichaCliente } from './ficha-cliente';

/** Aba Dados (spec 7D.1) e Novo cliente (c = null). A senha dos acessos nunca vem: só "tem senha" (D2). */
export async function DadosFicha({ c, u }: { c: ClienteFicha | null; u: UsuarioPainel }) {
  const sb = await supabaseServidor();
  const pode = temNivel(u, 'clientes', 'editar');
  const [{ data: servicos }, { data: setores }, { data: pessoas }, { data: podeVer }] = await Promise.all([
    sb.from('servicos').select('id, nome, setor_id').eq('ativo', true).order('nome'),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    sb.rpc('pode_ver_acessos'),
  ]);

  let contratados: string[] = [];
  let responsaveis: Record<string, string> = {};
  let inscricoesSt: { uf: string; inscricao: string | null }[] = [];
  let acessos: AcessoLinha[] = [];
  let ultima: { pessoa: string; quando: string } | null = null;
  if (c) {
    const [cs, rs, st, ac, ua] = await Promise.all([
      sb.from('cliente_servicos').select('servico_id').eq('cliente_id', c.id),
      sb.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', c.id),
      sb.from('cliente_inscricoes_st').select('uf, inscricao').eq('cliente_id', c.id).order('uf'),
      // Colunas explícitas: a cifra não tem leitura para ninguém (D2); um select('*') seria recusado.
      sb.from('cliente_acessos').select('id, portal, usuario, tem_senha').eq('cliente_id', c.id).order('portal'),
      sb.rpc('ultima_alteracao_cliente', { p_cliente: c.id }),
    ]);
    contratados = (cs.data ?? []).map((s) => s.servico_id);
    responsaveis = Object.fromEntries((rs.data ?? []).map((r) => [r.setor_id, r.usuario_id]));
    inscricoesSt = (st.data ?? []).map((s) => ({ uf: s.uf.trim(), inscricao: s.inscricao }));
    acessos = (ac.data ?? []) as AcessoLinha[];
    ultima = (ua.data as { pessoa: string; quando: string } | null) ?? null;
  }
  const verAcessos = podeVer === true;

  return (
    <FichaCliente
      // Voltou do servidor com dados novos (salvou): a ficha recomeça com eles.
      key={JSON.stringify([c, contratados, responsaveis, inscricoesSt])}
      cliente={c}
      servicos={servicos ?? []}
      contratados={contratados}
      setores={setores ?? []}
      pessoas={pessoas ?? []}
      responsaveis={responsaveis}
      inscricoesSt={inscricoesSt}
      pode={pode}
      admin={u.papel === 'admin'}
      agora={new Date().toISOString()}
      ultimaAlteracao={textoUltimaAlteracao(ultima)}
      acessos={<AcessosPortais clienteId={c?.id ?? null} acessos={acessos} podeVer={verAcessos} podeEditar={pode && verAcessos} cofreOk={cofreConfigurado()} />}
    />
  );
}
