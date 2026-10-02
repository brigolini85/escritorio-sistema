import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { COOKIE_MENU, menuRecolhidoDoCookie } from '@/components/layout/preferencias';
import { estadoPelaPausaGeral } from '@/components/patterns/estado-agente';
import { COOKIE_TEMA, escolhaDoCookie } from '@/components/tema/tema';
import { rotuloAmbiente } from '@/lib/ambiente';
import { contarConversasAguardando, contarDemandasAbertas, lerAgentePausado } from '@/lib/contadores';
import { lerSinaisVida } from '@/lib/inicio';
import { itensDoMenu } from '@/lib/menu';
import { obterUsuario } from '@/lib/sessao';
import { situacaoDoSinal } from '@/lib/sinal-vida';
import { supabaseServidor } from '@/lib/supabase/servidor';

export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const u = await obterUsuario();
  const sb = await supabaseServidor();
  const loja = await cookies();
  const [atendimento, demandas, pausado, sinais] = await Promise.all([
    contarConversasAguardando(sb),
    contarDemandasAbertas(sb),
    lerAgentePausado(sb), // null para quem não é administrador (RLS): o indicador não aparece
    lerSinaisVida(sb), // idem: o atalho do WhatsApp fica sem ponto para quem não é administrador
  ]);

  return (
    <AppShell
      usuario={{ nome: u.nome, papel: u.papel }}
      itens={itensDoMenu(u)}
      contadores={{ atendimento, demandas }}
      estadoAgente={estadoPelaPausaGeral(pausado)}
      ambiente={rotuloAmbiente(process.env.NEXT_PUBLIC_AMBIENTE ?? process.env.AMBIENTE)}
      tamanhoLetra={u.tamanhoLetra}
      whatsapp={sinais ? situacaoDoSinal(sinais.whatsapp) : null}
      tema={escolhaDoCookie(loja.get(COOKIE_TEMA)?.value)}
      recolhidoInicial={menuRecolhidoDoCookie(loja.get(COOKIE_MENU)?.value)}
    >
      {children}
    </AppShell>
  );
}
