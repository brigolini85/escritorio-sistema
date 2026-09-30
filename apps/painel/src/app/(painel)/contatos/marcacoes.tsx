import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

export type Vinculo = { empresaId: string; empresa: string; podePedirNota: boolean; podeMudarPreco: boolean };

/** Nome da empresa como a equipe conhece (fantasia, senão razão social). */
export const nomeEmpresa = (c: { razao_social: string; nome_fantasia: string | null }) => c.nome_fantasia ?? c.razao_social;

/**
 * Marcações do contato como selos. As permissões valem por empresa: quando só algumas empresas do contato
 * têm a marcação, o selo diz quantas (e o title diz quais).
 */
export function MarcacoesContato({ vinculos, vazio = null }: { vinculos: Vinculo[]; vazio?: ReactNode }) {
  const selos = [
    { rotulo: 'Pode pedir nota', empresas: vinculos.filter((v) => v.podePedirNota) },
    { rotulo: 'Pode mudar preço e cadastrar produto', empresas: vinculos.filter((v) => v.podeMudarPreco) },
  ].filter((s) => s.empresas.length > 0);
  if (selos.length === 0) return <>{vazio}</>;
  return (
    <span className="flex flex-wrap gap-1">
      {selos.map((s) => {
        const parcial = s.empresas.length < vinculos.length;
        const quais = s.empresas.map((v) => v.empresa).join(', ');
        return (
          <Badge key={s.rotulo} variant="brand" title={`Em: ${quais}`}>
            {s.rotulo}{parcial ? ` · ${s.empresas.length} de ${vinculos.length}` : ''}
          </Badge>
        );
      })}
    </span>
  );
}
