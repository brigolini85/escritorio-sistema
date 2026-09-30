import Link from 'next/link';
import { cn } from '@/lib/cn';

/** Valores de ?aba= (não mudam: as server actions voltam para eles). */
export const ABAS = [
  { valor: 'dados', rotulo: 'Dados' },
  { valor: 'contatos', rotulo: 'Contatos' },
  { valor: 'clientes', rotulo: 'Clientes da empresa' },
  { valor: 'fornecedores', rotulo: 'Fornecedores' },
  { valor: 'produtos', rotulo: 'Produtos' },
  { valor: 'precos', rotulo: 'Preços' },
  { valor: 'documentos', rotulo: 'Documentos' },
] as const;
export type Aba = (typeof ABAS)[number]['valor'];

/** Abas visíveis da ficha. "Clientes e fornecedores" junta ?aba=clientes e ?aba=fornecedores (escolha logo abaixo). */
const ABAS_VISIVEIS: { rotulo: string; aba: Aba; ativas: readonly Aba[] }[] = [
  { rotulo: 'Dados', aba: 'dados', ativas: ['dados'] },
  { rotulo: 'Contatos', aba: 'contatos', ativas: ['contatos'] },
  { rotulo: 'Clientes e fornecedores', aba: 'clientes', ativas: ['clientes', 'fornecedores'] },
  { rotulo: 'Produtos', aba: 'produtos', ativas: ['produtos'] },
  { rotulo: 'Preços por rede', aba: 'precos', ativas: ['precos'] },
  { rotulo: 'Documentos', aba: 'documentos', ativas: ['documentos'] },
];

const classeAba = (ativa: boolean) => cn(
  'inline-flex h-9 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors duration-150 ease-out',
  ativa ? 'border-brand text-foreground' : 'border-transparent text-muted hover:border-border hover:text-foreground',
);

/**
 * Abas da ficha com cara de abas, mas são links (?aba=), como antes: o endereço de cada aba pode ser
 * compartilhado e as server actions voltam para a aba certa. A aba atual tem aria-current="page".
 */
export function AbasCliente({ id, atual }: { id: string; atual: Aba }) {
  return (
    <nav aria-label="Seções da empresa" className="-mx-1 overflow-x-auto border-b border-border px-1">
      <ul className="flex gap-1">
        {ABAS_VISIVEIS.map((a) => {
          const ativa = a.ativas.includes(atual);
          return (
            <li key={a.aba}>
              <Link href={`/clientes/${id}?aba=${a.aba}`} aria-current={ativa ? 'page' : undefined} scroll={false} className={cn(classeAba(ativa), '-mb-px')}>
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Dentro de "Clientes e fornecedores": qual lista mostrar (segmentos, também links). */
export function EscolhaParceiros({ id, atual }: { id: string; atual: 'clientes' | 'fornecedores' }) {
  const opcoes = [
    { aba: 'clientes', rotulo: 'Clientes da empresa' },
    { aba: 'fornecedores', rotulo: 'Fornecedores' },
  ] as const;
  return (
    <nav aria-label="Clientes ou fornecedores" className="inline-flex h-9 items-center gap-0.5 rounded-md bg-surface-muted p-0.5">
      {opcoes.map((o) => {
        const ativa = o.aba === atual;
        return (
          <Link
            key={o.aba}
            href={`/clientes/${id}?aba=${o.aba}`}
            aria-current={ativa ? 'page' : undefined}
            scroll={false}
            className={cn(
              'inline-flex h-8 items-center rounded-sm px-3 text-sm font-medium transition-colors duration-150 ease-out',
              ativa ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
            )}
          >
            {o.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
