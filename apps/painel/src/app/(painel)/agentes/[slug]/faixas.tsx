import { Info, TriangleAlert } from 'lucide-react';

/** D14: os outros agentes guardam a configuração, mas nesta etapa só o Thiago atende. */
export function FaixaSoThiago() {
  return (
    <p className="flex items-start gap-2 rounded-md border border-info bg-info-soft px-4 py-3 text-sm text-info">
      <Info aria-hidden size={16} className="mt-0.5 shrink-0" />
      Nesta etapa só o Thiago atende. O que você configurar aqui fica guardado e passa a valer quando o Thiago começar a chamar os agentes dos setores (próxima etapa).
    </p>
  );
}

/** D23: homologação sem a migração. */
export function FaixaSemMigracao() {
  return (
    <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">
      <TriangleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
      Os agentes aparecem quando a atualização do banco da Parte I for aplicada. Até lá, só as orientações e o teste do Thiago funcionam.
    </p>
  );
}
