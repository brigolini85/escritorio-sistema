import { cofreConfigurado } from '@/lib/cofre';
import { lerPastaDoCliente, lerSituacaoDrive } from '@/lib/drive';
import type { SituacaoDrive } from '@/lib/drive-tela';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { BlocoArquivos } from './bloco-arquivos';
import { AcessosPortais, type AcessoLinha } from './acessos-portais';
import { textoUltimaAlteracao, type ClienteFicha } from './ficha';
import { FichaCliente } from './ficha-cliente';

/**
 * Leitura que falhou vai para a tela de erro: mostrar a lista vazia faria o próximo SALVAR apagar serviços,
 * responsáveis e inscrições ST (salvar_ficha_cliente troca o conjunto inteiro).
 */
function lido<T>(r: { data: T | null; error: { message: string } | null }, oQue: string): T {
  if (r.error) throw new Error(`Não consegui ler ${oQue}: ${r.error.message}`);
  return r.data as T;
}

/** Aba Dados (spec 7D.1) e Novo cliente (c = null). A senha dos acessos nunca vem: só "tem senha" (D2). */
export async function DadosFicha({ c, u }: { c: ClienteFicha | null; u: UsuarioPainel }) {
  const sb = await supabaseServidor();
  const pode = temNivel(u, 'clientes', 'editar');
  const [sv, se, ps, { data: podeVer }] = await Promise.all([
    sb.from('servicos').select('id, nome, setor_id').eq('ativo', true).order('nome'),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    // Falha aqui fecha (sem revelar), não derruba a página.
    sb.rpc('pode_ver_acessos'),
  ]);
  const servicos = lido(sv, 'servicos');
  const setores = lido(se, 'setores');
  const pessoas = lido(ps, 'usuarios');

  let contratados: string[] = [];
  let responsaveis: Record<string, string> = {};
  let inscricoesSt: { uf: string; inscricao: string | null }[] = [];
  let acessos: AcessoLinha[] = [];
  let ultima: { pessoa: string; quando: string } | null = null;
  let pastaDrive: { semI3b: boolean; pasta: string | null } = { semI3b: false, pasta: null };
  let drive: { semI3b: boolean; situacao: SituacaoDrive | null } = { semI3b: false, situacao: null };
  if (c) {
    const [cs, rs, st, ac, ua, pd, dr] = await Promise.all([
      sb.from('cliente_servicos').select('servico_id').eq('cliente_id', c.id),
      sb.from('cliente_responsaveis').select('setor_id, usuario_id').eq('cliente_id', c.id),
      sb.from('cliente_inscricoes_st').select('uf, inscricao').eq('cliente_id', c.id).order('uf'),
      // Colunas explícitas: a cifra não tem leitura para ninguém (D2); um select('*') seria recusado.
      sb.from('cliente_acessos').select('id, portal, usuario, tem_senha').eq('cliente_id', c.id).order('portal'),
      sb.rpc('ultima_alteracao_cliente', { p_cliente: c.id }),
      // Parte I3b: sem a atualização do banco vira aviso, nunca erro (código real, sem head:true).
      lerPastaDoCliente(sb, c.id),
      lerSituacaoDrive(sb),
    ]);
    pastaDrive = pd;
    drive = dr;
    contratados = (lido(cs, 'cliente_servicos') ?? []).map((s) => s.servico_id);
    responsaveis = Object.fromEntries((lido(rs, 'cliente_responsaveis') ?? []).map((r) => [r.setor_id, r.usuario_id]));
    inscricoesSt = (lido(st, 'cliente_inscricoes_st') ?? []).map((s) => ({ uf: s.uf.trim(), inscricao: s.inscricao }));
    acessos = (lido(ac, 'cliente_acessos') ?? []) as AcessoLinha[];
    // Só o rodapé: sem ela, a ficha abre sem "Última alteração".
    ultima = ua.error ? null : (ua.data as { pessoa: string; quando: string } | null) ?? null;
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
      // key: o elemento vem do servidor e entra ao lado do bloco Certificado no Formulario; sem ela o React avisa "unique key".
      acessos={<AcessosPortais key="acessos" clienteId={c?.id ?? null} acessos={acessos} podeVer={verAcessos} podeEditar={pode && verAcessos} cofreOk={cofreConfigurado()} />}
      arquivos={<BlocoArquivos key="arquivos" clienteId={c?.id ?? null} pasta={pastaDrive.pasta} situacao={drive.situacao}
        podeEditar={pode} semI3b={pastaDrive.semI3b || drive.semI3b} />}
    />
  );
}
