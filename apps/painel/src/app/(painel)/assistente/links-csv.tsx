import { BlingExportButton } from '@/components/patterns/bling-export-button';
import type { ArquivoBling } from '@/lib/resultados-assistente';

/**
 * Links do CSV do Bling de uma resposta (rota /api/csv-bling?assistente=&parte=, que confere a permissão de novo).
 * Na conversa, os nomes de hoje; no painel, "· parte i de n" (D12: o e2e de hoje procura "(parte N)" e não pode achar dois).
 */
export function LinksCsv({ mensagemId, arquivo, onde, variante = 'outline' }: {
  mensagemId: string; arquivo: ArquivoBling; onde: 'conversa' | 'painel'; variante?: 'primary' | 'outline' | 'link';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: arquivo.partes }, (_, i) => {
        const parte = i + 1;
        const rotulo = arquivo.partes === 1 ? 'Baixar CSV Bling'
          : onde === 'conversa' ? `Baixar CSV Bling (parte ${parte})` : `Baixar CSV Bling · parte ${parte} de ${arquivo.partes}`;
        return <BlingExportButton key={parte} href={`/api/csv-bling?assistente=${mensagemId}&parte=${parte}`} rotulo={rotulo} variante={variante} />;
      })}
    </div>
  );
}
