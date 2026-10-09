/** Auditoria 3.13: faixa vermelha quando o AMBIENTE do painel não é o do banco (só o administrador vê). */
export function FaixaAmbienteDivergente({ aviso }: { aviso: string | null }) {
  if (!aviso) return null;
  return (
    <div role="alert" data-faixa-ambiente-divergente="" className="bg-danger py-1 text-center text-xs font-semibold text-danger-foreground">
      {aviso}
    </div>
  );
}

/** Faixa amarela do topo fora de produção (D10), para ninguém confundir teste com atendimento real. */
export function FaixaAmbiente({ rotulo }: { rotulo: string | null }) {
  if (!rotulo) return null;
  return (
    <div data-faixa-ambiente="" className="bg-warning-soft py-0.5 text-center text-xs font-semibold tracking-wide text-warning">
      <span className="sr-only">Ambiente: </span>
      {rotulo}
    </div>
  );
}
