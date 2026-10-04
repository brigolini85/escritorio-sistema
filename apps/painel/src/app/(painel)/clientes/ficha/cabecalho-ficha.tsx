import { FileBadge } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { DocumentText } from '@/components/patterns/document-text';
import { Badge } from '@/components/ui/badge';
import { clienteDesde, etiquetasDoTopo } from './ficha';

type ClienteTopo = {
  razao_social: string; nome_fantasia: string | null; cnpj: string; ativo: boolean; agente_pausado: boolean; regime: string | null;
  criado_em: string; contrato_inicio?: string | null; certificado_tipo?: string | null; certificado_vencimento?: string | null;
  certificado_avisar_dias?: number | null;
};

/** Cabeçalho da ficha (imagem): "Ficha do cliente", nome, razão social e CNPJ, cliente desde, etiquetas. Sem logo (spec 7D.1). */
export function CabecalhoFicha({ c, agora }: { c: ClienteTopo; agora: Date }) {
  const nome = c.nome_fantasia ?? c.razao_social;
  return (
    <PageHeader
      className="mb-0"
      secao="Ficha do cliente"
      titulo={nome}
      migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: nome }]}
      descricao={(
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {c.nome_fantasia && <span>{c.razao_social}</span>}
          <span>CNPJ <DocumentText valor={c.cnpj} tipo="cnpj" /></span>
          <span>· cliente desde {clienteDesde(c.contrato_inicio ?? null, c.criado_em)}</span>
          <span>· <span aria-hidden className="text-danger">*</span> campos obrigatórios (a ficha salva com pendências)</span>
        </span>
      )}
      acoes={(
        <ul aria-label="Situação da empresa" className="flex flex-wrap items-center gap-2">
          {etiquetasDoTopo(c, agora).map((e) => (
            <li key={e.texto}>
              <Badge variant={e.variante}>
                {e.icone === 'ponto' && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
                {e.icone === 'certificado' && <FileBadge aria-hidden size={12} strokeWidth={1.75} />}
                {e.texto}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
