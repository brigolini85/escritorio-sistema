import { NextResponse, type NextRequest } from 'next/server';
import { LIMITE_POR_GRUPO, RESULTADO_VAZIO, interpretarBusca, itemContato, itemDemanda, itemEmpresa } from '@/lib/busca';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Busca global (Ctrl/Cmd + K): empresas, contatos e demandas. Só leitura, com o cliente do usuário (RLS). */
export async function GET(req: NextRequest) {
  const sb = await supabaseServidor();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ erro: 'sessão expirada' }, { status: 401 });

  const c = interpretarBusca(req.nextUrl.searchParams.get('q'));
  if (!c) return NextResponse.json(RESULTADO_VAZIO);
  const { termo, digitos, numero } = c;

  const [empresas, contatos, demandas] = await Promise.all([
    sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj')
      .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%,cnpj.ilike.%${digitos || termo}%`)
      .order('razao_social').limit(LIMITE_POR_GRUPO),
    sb.from('contatos').select('id, nome, telefone')
      .or(`nome.ilike.%${termo}%,telefone.ilike.%${digitos || termo}%`)
      .order('nome').limit(LIMITE_POR_GRUPO),
    sb.from('chamados').select('id, numero, titulo, status, conversa_id, clientes(razao_social, nome_fantasia)')
      .or(numero !== null ? `numero.eq.${numero},titulo.ilike.%${termo}%` : `titulo.ilike.%${termo}%`)
      .order('criado_em', { ascending: false }).limit(LIMITE_POR_GRUPO),
  ]);

  if (empresas.error || contatos.error || demandas.error) {
    return NextResponse.json({ erro: 'Não foi possível buscar agora.' }, { status: 500 });
  }
  return NextResponse.json({
    empresas: empresas.data.map(itemEmpresa),
    contatos: contatos.data.map(itemContato),
    demandas: demandas.data.map(itemDemanda),
  });
}
