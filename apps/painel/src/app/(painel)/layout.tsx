import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { MarcarUso } from '@/components/layout/marcar-uso';
import { COOKIE_MENU, menuRecolhidoDoCookie } from '@/components/layout/preferencias';
import { estadoPelaPausaGeral } from '@/components/patterns/estado-agente';
import { COOKIE_TEMA, escolhaDoCookie } from '@/components/tema/tema';
import { souDono } from '@/lib/agentes';
import { rotuloAmbiente } from '@/lib/ambiente';
import { contarConversasAguardando, contarDemandasAbertas } from '@/lib/contadores';
import { lerAgentePausado, lerSinaisVida } from '@/lib/leituras-admin';
import { itensDoMenu } from '@/lib/menu';
import { obterUsuario } from '@/lib/sessao';
import { situacaoDoSinal } from '@/lib/sinal-vida';
import { supabaseServidor } from '@/lib/supabase/servidor';

export default async function LayoutPainel({ children }: { children: ReactNode }) {
  const u = await obterUsuario();
  const sb = await supabaseServidor();
  const loja = await cookies();
  const [atendimento, demandas, pausado, sinais, dono] = await Promise.all([
    contarConversasAguardando(sb),
    contarDemandasAbertas(sb),
    lerAgentePausado(sb), // null para quem não é administrador (RLS): o indicador não aparece
    // A RLS só filtra linhas (atendente lê lista vazia = "sem sinal" falso): o estado do WhatsApp só é lido para o administrador.
    u.papel === 'admin' ? lerSinaisVida(sb) : Promise.resolve(null),
    // D12: o dono que não é administrador nem treina também vê Agentes (só pergunta ao banco quando isso muda o menu).
    u.papel === 'admin' || u.niveis.treinar === 'sim' ? Promise.resolve(false) : souDono(sb),
  ]);

  return (
    <AppShell
      usuario={{ nome: u.nome, papel: u.papel }}
      itens={itensDoMenu({ ...u, dono })}
      contadores={{ atendimento, demandas }}
      estadoAgente={estadoPelaPausaGeral(pausado)}
      ambiente={rotuloAmbiente(process.env.NEXT_PUBLIC_AMBIENTE ?? process.env.AMBIENTE)}
      tamanhoLetra={u.tamanhoLetra}
      whatsapp={sinais ? situacaoDoSinal(sinais.whatsapp) : null}
      tema={escolhaDoCookie(loja.get(COOKIE_TEMA)?.value)}
      recolhidoInicial={menuRecolhidoDoCookie(loja.get(COOKIE_MENU)?.value)}
    >
      {/* Regra de 1 h sem uso: só toque de verdade conta (sessao-limites.ts). */}
      <MarcarUso agoraServidor={Date.now()} />
      {children}
    </AppShell>
  );
}
