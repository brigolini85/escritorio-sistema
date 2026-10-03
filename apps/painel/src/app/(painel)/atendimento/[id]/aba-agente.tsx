import { agruparPorTurno, type DecisaoBruta } from '@/lib/conversa-itens';
import { camposLegiveis, rotuloEtapa } from '@/lib/decisoes';
import { formatarDataHora } from '@/lib/formatos';
import { CamposDecisao } from './campos-decisao';

/**
 * Aba AGENTE (spec 7A.1): o motivo da passagem para pessoa (texto fixo do sistema) e a linha do tempo completa
 * das decisões do agente nesta conversa, por turno, a mais nova primeiro. As decisões chegam já sem o pedido para quem não pode vê-lo (P11).
 */
export function AbaAgente({ decisoes, passagem }: { decisoes: DecisaoBruta[]; passagem?: { desde: string; motivo: string | null } | null }) {
  const grupos = agruparPorTurno(decisoes);
  return (
    <div className="flex flex-col text-sm">
      {passagem && (
        <section className="flex flex-col gap-1 border-b border-border p-3" aria-label="Passagem para pessoa">
          <h3 className="text-xs font-bold uppercase tracking-wide text-brand">Passou para pessoa</h3>
          <p className="text-foreground">{passagem.motivo || 'Sem motivo registrado.'}</p>
          <p className="text-xs text-muted"><time dateTime={passagem.desde} className="tabular">{formatarDataHora(passagem.desde)}</time></p>
        </section>
      )}
      {grupos.length === 0 ? <p className="p-3 text-muted">O agente ainda não registrou decisões nesta conversa.</p> : (
        <ol className="flex flex-col divide-y divide-border">
          {grupos.map((g) => (
            <li key={g.turno ?? g.decisoes[0]!.id} id={g.turno ? `agente-turno-${g.turno}` : undefined} className="flex flex-col gap-2 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-brand">
                <time dateTime={g.criado_em} className="tabular">{formatarDataHora(g.criado_em)}</time>
              </p>
              <ol className="flex flex-col gap-2">
                {g.decisoes.map((d) => (
                  <li key={d.id} className="flex flex-col gap-1">
                    <span className="font-medium text-foreground">{rotuloEtapa(d.etapa)}</span>
                    {d.justificativa && <p className="text-muted">{d.justificativa}</p>}
                    <CamposDecisao titulo="Recebeu" campos={camposLegiveis(d.entrada)} />
                    <CamposDecisao titulo="Resultado" campos={camposLegiveis(d.saida)} />
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
