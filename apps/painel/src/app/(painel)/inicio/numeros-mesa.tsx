import { CalendarClock, CircleAlert, MessageCircle, UserRoundSearch } from 'lucide-react';
import { ROTULOS_MESA } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';
import { contarConversasAguardando } from '@/lib/contadores';
import { paginaInicio } from './dados-inicio';
import { contarMinhas, lerSemResponsavelMesa } from './dados-mesa';
import { NumeroInicio } from './numero-inicio';

/** Os quatro números de ação (imagem B). Vencidas e hoje são os grupos da lista (D11) e levam até eles. */
export async function NumerosMesa({ u, podeAtendimento }: { u: UsuarioPainel; podeAtendimento: boolean }) {
  const { sb } = await paginaInicio();
  const [esperando, minhas, sem] = await Promise.all([
    podeAtendimento ? contarConversasAguardando(sb) : Promise.resolve(null), contarMinhas(u.id), lerSemResponsavelMesa(u.setores.join(',')),
  ]);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {podeAtendimento && (
        <NumeroInicio variante="mesa" chave="esperando-voce" icone={MessageCircle} valor={esperando}
          titulo={ROTULOS_MESA.esperando(esperando ?? 0)} tom={(esperando ?? 0) > 0 ? 'ok' : 'neutro'}
          link={{ href: '/atendimento', rotulo: 'abrir o Atendimento' }} />
      )}
      <NumeroInicio variante="mesa" chave="minhas-vencidas" icone={CircleAlert} valor={minhas.vencidas}
        titulo={ROTULOS_MESA.vencidas(minhas.vencidas ?? 0)} tom={(minhas.vencidas ?? 0) > 0 ? 'perigo' : 'neutro'}
        link={{ href: '#vencidas', rotulo: 'ver na lista' }} />
      <NumeroInicio variante="mesa" chave="vencem-hoje" icone={CalendarClock} valor={minhas.hoje}
        titulo={ROTULOS_MESA.hoje(minhas.hoje ?? 0)} tom={(minhas.hoje ?? 0) > 0 ? 'atencao' : 'neutro'}
        link={{ href: '#vencem-hoje', rotulo: 'ver na lista' }} />
      <NumeroInicio variante="mesa" chave="sem-responsavel" icone={UserRoundSearch} valor={sem?.total ?? null}
        titulo={ROTULOS_MESA.semResponsavel(sem?.total ?? 0)} link={{ href: '#sem-responsavel', rotulo: 'ver na lista' }} />
    </div>
  );
}
