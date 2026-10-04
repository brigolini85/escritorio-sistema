import Link from 'next/link';
import type { ColunaTabela } from '@/components/patterns/data-table';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { iniciais } from '@/lib/atendimento';
import { cn } from '@/lib/cn';
import { estadoDaConversa, textoUltimoContato, type LinhaContato, type TomConversa } from '@/lib/contatos';
import { mascararTelefone } from '@/lib/formatos';
import { alternarAgenteContato } from '../atendimento/acoes';
import { SelosContato } from './marcacoes';

// Esperando pessoa num fundo âmbar claro: na linha ativa (fundo mais escuro) o âmbar puro fica abaixo do contraste AA.
const TOM: Record<TomConversa, string> = { espera: 'self-start rounded-sm bg-warning-soft px-1.5 font-semibold text-warning', pessoa: 'text-human-owned', agente: 'text-muted', sem: 'text-subtle' };
const MAX_EMPRESAS = 3;

/** Colunas da imagem A: contato + telefone, empresas, marcações, último contato + estado, agente. */
export function colunasContatos({ euId, veTodas, pode, agora }: { euId: string; veTodas: boolean; pode: boolean; agora: Date }): ColunaTabela<LinhaContato>[] {
  return [
    {
      id: 'nome', titulo: 'Contato', ordenavel: true, className: 'max-w-60',
      celula: (c) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{iniciais(c.nome)}</span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-semibold text-foreground">{c.nome}</span>
            <span className="tabular text-sm text-muted">{mascararTelefone(c.telefone)}</span>
          </span>
        </span>
      ),
    },
    {
      id: 'empresas', titulo: 'Empresas', className: 'w-full min-w-48 max-w-0', quebrar: true,
      celula: (c) => (c.vinculos.length === 0 ? <span className="italic text-subtle">sem empresa</span> : (
        <span className="flex min-w-0 flex-col">
          {c.vinculos.slice(0, MAX_EMPRESAS).map((v) => (
            <Link key={v.empresaId} href={`/clientes/${v.empresaId}?aba=contatos`} className="truncate font-semibold text-brand hover:underline">{v.empresa}</Link>
          ))}
          {c.vinculos.length > MAX_EMPRESAS && <span className="text-sm text-muted">+{c.vinculos.length - MAX_EMPRESAS}</span>}
        </span>
      )),
    },
    { id: 'marcacoes', titulo: 'Marcações', quebrar: true, celula: (c) => <SelosContato vinculos={c.vinculos} /> },
    {
      id: 'ultimo', titulo: 'Último contato', ordenavel: true,
      celula: (c) => {
        const e = estadoDaConversa(c, { euId, veTodas });
        return (
          <span className="flex flex-col">
            <span className="tabular text-foreground">{textoUltimoContato(c.ultimoEm, agora)}</span>
            <span className={cn('text-sm', TOM[e.tom])}>{e.texto}</span>
          </span>
        );
      },
    },
    {
      id: 'agente', titulo: 'Agente',
      celula: (c) => (
        <SwitchAgenteContato acao={alternarAgenteContato.bind(null, c.id, null, c.agentePausado)} desligado={c.agentePausado} nome={c.nome}
          pode={pode} mostrarEstado estadoCurto className="flex-col items-start gap-1" />
      ),
    },
  ];
}
