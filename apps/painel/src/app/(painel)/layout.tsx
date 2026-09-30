import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { COOKIE_MENU, menuRecolhidoDoCookie } from '@/components/layout/preferencias';
import { COOKIE_TEMA, escolhaDoCookie } from '@/components/tema/tema';
import { rotuloAmbiente } from '@/lib/ambiente';
import { contarConversasAguardando, contarDemandasAbertas, lerAgentePausado } from '@/lib/contadores';
import { itensDoMenu } from '@/lib/menu';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const u = await obterUsuario();
  const sb = await supabaseServidor();
  const loja = await cookies();
  const [atendimento, demandas, pausado] = await Promise.all([
    contarConversasAguardando(sb),
    contarDemandasAbertas(sb),
    lerAgentePausado(sb), // null para quem não é administrador (RLS): o indicador não aparece
  ]);

  return (
    <AppShell
      usuario={{ nome: u.nome, papel: u.papel }}
      itens={itensDoMenu(u)}
      contadores={{ atendimento, demandas }}
      estadoAgente={pausado === null ? null : pausado ? { tipo: 'pausado', motivo: 'Pausa geral' } : { tipo: 'ativo' }}
      ambiente={rotuloAmbiente(process.env.NEXT_PUBLIC_AMBIENTE ?? process.env.AMBIENTE)}
      tema={escolhaDoCookie(loja.get(COOKIE_TEMA)?.value)}
      recolhidoInicial={menuRecolhidoDoCookie(loja.get(COOKIE_MENU)?.value)}
    >
      {children}
    </AppShell>
  );
}
