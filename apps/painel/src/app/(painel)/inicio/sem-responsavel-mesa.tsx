import { PrazoTexto } from '@/components/patterns/prioridade-prazo';
import { Card } from '@/components/ui/card';
import { detalheDaDemanda } from '@/lib/minha-mesa';
import type { UsuarioPainel } from '@/lib/sessao';
import { BotaoAssumirInicio } from './botoes-demanda-inicio';
import { paginaInicio } from './dados-inicio';
import { lerSemResponsavelMesa } from './dados-mesa';

/** "Sem responsável nos meus setores" (imagem B, D13): quem assumir vira responsável; a função do banco confere. */
export async function SemResponsavelMesa({ u }: { u: UsuarioPainel }) {
  const [dados, { agora }] = await Promise.all([lerSemResponsavelMesa(u.setores.join(',')), paginaInicio()]);
  return (
    <section id="sem-responsavel" aria-labelledby="titulo-sem-responsavel" className="scroll-mt-4">
      <Card className="gap-2 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="titulo-sem-responsavel" className="text-sm font-bold uppercase tracking-wide text-brand">Sem responsável nos meus setores</h2>
          <span className="text-sm text-subtle">quem assumir vira responsável</span>
        </div>
        {u.setores.length === 0 ? (
          <p className="text-sm text-muted">Você não tem setor marcado. O administrador marca os setores em Usuários e permissões.</p>
        ) : dados === null ? (
          <p className="text-sm text-muted">As demandas sem responsável não puderam ser lidas agora.</p>
        ) : dados.lista.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma demanda sem responsável nos seus setores.</p>
        ) : (
          <ul className="divide-y divide-border">
            {dados.lista.map((d) => {
              const [empresa, setor] = detalheDaDemanda(d);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="tabular w-16 shrink-0 font-bold text-foreground">#{d.numero}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{d.titulo}</p>
                    <p className="truncate text-sm text-muted">
                      <span className="font-semibold text-brand">{empresa}</span> · {setor} ·{' '}
                      <PrazoTexto prazo={d.prazo_em} pausadoDesde={d.prazo_pausado_desde} concluidaEm={null} agora={agora} />
                    </p>
                  </div>
                  <BotaoAssumirInicio id={d.id} numero={d.numero} />
                </li>
              );
            })}
          </ul>
        )}
        {dados && dados.total > dados.lista.length && (
          <p className="text-sm text-muted">Mostrando {dados.lista.length} de {dados.total}. As outras estão na Gestão das demandas.</p>
        )}
      </Card>
    </section>
  );
}
