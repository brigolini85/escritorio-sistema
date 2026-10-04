import { FileSpreadsheet, PanelRight, Receipt, Table2 } from 'lucide-react';
import Link from 'next/link';
import { DiffPreview } from '@/components/patterns/diff-preview';
import { EmptyState } from '@/components/patterns/empty-state';
import { cn } from '@/lib/cn';
import type { LadoPrevia } from '@/lib/previa-pedido';
import { abasVisiveis, hrefResultado, type LeituraConversa, type Resultado } from '@/lib/resultados-assistente';
import { PainelArquivos } from './painel-arquivos';
import { PainelTabela } from './painel-tabela';

const ICONE = { pedido: Receipt, tabela: Table2, arquivos: FileSpreadsheet } as const;

// Provisório (Task 6 troca pelo painel do pedido): reescreve o lado da prévia para o DiffPreview de hoje.
const ladoComoTexto = (l: LadoPrevia) =>
  l.linhas.map((x) => (x.tipo === 'item' ? `• ${x.item.texto}` : x.tipo === 'campo' ? `${x.campo.rotulo}: ${x.campo.valor}` : x.texto)).join('\n');

function Abas({ abas, selecionada, conversaId }: { abas: Resultado[]; selecionada: string; conversaId: string | null }) {
  return (
    <nav aria-label="Resultados desta conversa" className="flex items-end gap-2 border-b border-border">
      <ul className="flex min-w-0 flex-1 flex-wrap">
        {abas.map((r) => {
          const Icone = ICONE[r.tipo];
          const ativa = r.chave === selecionada;
          const contagem = r.tipo === 'arquivos' ? r.arquivos.length : r.tipo === 'tabela' ? r.tabela.linhas.length : null;
          return (
            <li key={r.chave}>
              <Link
                href={hrefResultado(conversaId, r.chave)}
                scroll={false}
                aria-current={ativa ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide',
                  ativa ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-foreground',
                )}
              >
                <Icone aria-hidden size={16} strokeWidth={1.75} />
                {r.tipo === 'tabela' ? r.titulo : r.rotulo}
                {contagem !== null && (
                  <>
                    <span aria-hidden className="rounded-full bg-surface-muted px-1.5 text-xs text-foreground">{contagem}</span>
                    {/* O espaço fica dentro do sr-only: o nome lido é "Arquivos (n)" / "Pedidos em aberto (n)". */}
                    <span className="sr-only"> ({contagem})</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <span className="hidden pb-2.5 text-sm text-subtle xl:inline">resultados desta conversa</span>
    </nav>
  );
}

/** Painel de resultado à direita (spec 7C.3): abas com o que as respostas desta conversa trouxeram. */
export function PainelResultado({ leitura, selecionado, conversaId }: { leitura: LeituraConversa; selecionado: Resultado | null; conversaId: string | null }) {
  return (
    <section aria-label="Resultado" className="flex min-w-0 flex-1 flex-col gap-4 bg-background p-4 lg:overflow-y-auto lg:px-6">
      {!selecionado ? (
        <EmptyState
          icone={PanelRight}
          titulo="Os resultados aparecem aqui"
          descricao="Prévias de pedido, tabelas e arquivos desta conversa abrem deste lado quando você clica em VER AO LADO."
          className="my-auto"
        />
      ) : (
        <>
          <Abas abas={abasVisiveis(leitura, selecionado.chave)} selecionada={selecionado.chave} conversaId={conversaId} />
          {/* Provisório: a Task 6 troca este bloco pelo painel do pedido. */}
          {selecionado.tipo === 'pedido' && (
            <article aria-label={selecionado.rotulo} className="rounded-lg border border-border bg-surface p-4">
              <DiffPreview texto={`Antes:\n${ladoComoTexto(selecionado.previa.antes)}\nDepois:\n${ladoComoTexto(selecionado.previa.depois)}`} />
            </article>
          )}
          {selecionado.tipo === 'tabela' && <PainelTabela resultado={selecionado} />}
          {selecionado.tipo === 'arquivos' && <PainelArquivos resultado={selecionado} />}
        </>
      )}
    </section>
  );
}
