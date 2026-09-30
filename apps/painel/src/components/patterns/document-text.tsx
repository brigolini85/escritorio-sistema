import { cn } from '@/lib/cn';
import { mascararCEP, mascararCNPJ, mascararCPF, mascararDocumento, mascararTelefone } from '@/lib/formatos';

const MASCARA = { cnpj: mascararCNPJ, cpf: mascararCPF, documento: mascararDocumento, cep: mascararCEP, telefone: mascararTelefone } as const;

/**
 * CNPJ, CPF, CEP ou telefone mascarados, com números tabulares e sem quebra de linha.
 * `tipo="documento"` escolhe CPF ou CNPJ pelo tamanho. Valor fora do padrão aparece como veio.
 */
export function DocumentText({
  valor,
  tipo = 'documento',
  vazio = '—',
  className,
}: {
  valor: string | null | undefined;
  tipo?: keyof typeof MASCARA;
  vazio?: string;
  className?: string;
}) {
  if (!valor?.trim()) return <span className={cn('text-subtle', className)}>{vazio}</span>;
  return <span className={cn('tabular whitespace-nowrap', className)}>{MASCARA[tipo](valor)}</span>;
}
