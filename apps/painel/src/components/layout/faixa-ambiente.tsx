/** Faixa amarela do topo fora de produção (D10), para ninguém confundir teste com atendimento real. */
export function FaixaAmbiente({ rotulo }: { rotulo: string | null }) {
  if (!rotulo) return null;
  return (
    <div className="bg-warning-soft py-0.5 text-center text-xs font-semibold tracking-wide text-warning">
      <span className="sr-only">Ambiente: </span>
      {rotulo}
    </div>
  );
}
