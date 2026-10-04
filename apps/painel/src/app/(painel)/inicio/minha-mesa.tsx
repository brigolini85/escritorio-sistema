import { MessageCircle } from 'lucide-react';
import { RecarregarPeriodico } from '@/components/layout/recarregar-periodico';
import { contarConversasAguardando } from '@/lib/contadores';
import { capitalizar, dataDoTitulo, primeiroNome, saudacao } from '@/lib/inicio';
import { ROTULOS_MESA } from '@/lib/minha-mesa';
import { temNivel } from '@/lib/permissoes';
import type { UsuarioPainel } from '@/lib/sessao';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { CabecalhoInicio } from './cabecalho-inicio';
import { paginaInicio } from './dados-inicio';
import { NumeroInicio } from './numero-inicio';

/** Minha mesa (imagem B), para quem não é administrador. Nunca lê custo nem configuracoes. As Tasks 7 e 8 completam. */
export async function MinhaMesa({ u }: { u: UsuarioPainel }) {
  const { sb, agora } = await paginaInicio();
  const podeAtendimento = temNivel(u, 'atendimento', 'meus_setores');
  const esperando = podeAtendimento ? await contarConversasAguardando(sb) : null;
  return (
    <div data-inicio="mesa" className="flex max-w-7xl flex-col gap-6">
      <AtualizarAoVivo />
      <RecarregarPeriodico />
      <CabecalhoInicio
        titulo={<>{saudacao(agora)}, <span className="text-brand">{primeiroNome(u.nome)}</span></>}
        subtitulo={capitalizar(dataDoTitulo(agora))}
        atualizadoEm={agora.toISOString()}
      />
      {podeAtendimento && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <NumeroInicio variante="mesa" chave="esperando-voce" icone={MessageCircle} valor={esperando}
            titulo={ROTULOS_MESA.esperando(esperando ?? 0)} tom={(esperando ?? 0) > 0 ? 'ok' : 'neutro'}
            link={{ href: '/atendimento', rotulo: 'abrir o Atendimento' }} />
        </div>
      )}
    </div>
  );
}
