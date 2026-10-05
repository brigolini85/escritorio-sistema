'use client';

import { ChevronDown, ChevronUp, UserRoundMinus } from 'lucide-react';
import { useId, useState, type MouseEvent } from 'react';
import { etiquetasPodeTratar } from '@escritorio/core';
import { ApagarDadosContato } from '@/components/patterns/apagar-dados-contato';
import { BlocoAcesso } from '@/components/patterns/bloco-acesso';
import { SeloPerfil } from '@/components/patterns/selo-perfil';
import { ChaveAgenteContato, useAgenteContato } from '@/components/patterns/switch-agente-contato';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ContatoDaFicha, Socio } from '@/lib/acesso-contato';
import { mascararTelefone } from '@/lib/formatos';

/**
 * Um contato na aba Contatos da ficha (imagem 00-cliente-contatos-acesso): a linha fechada (perfil, "Pode tratar", chave do
 * agente) e, aberta, o bloco de acesso com Remover e Apagar dados (LGPD) no rodapé. A chave e o "agente desligado" usam o
 * mesmo estado otimista, então a linha nunca se contradiz enquanto grava.
 */
export function LinhaAcesso({ clienteId, contato, semServicoComSetor, socios, pode, aberta: abertaInicial, acoes }: {
  clienteId: string;
  contato: ContatoDaFicha;
  semServicoComSetor: boolean;
  /** Quem recebe alertas de acesso na empresa (o próprio contato sai daqui). */
  socios: Socio[];
  pode: boolean;
  /** Aberta ao carregar: o contato do ?contato= da URL (link da tela Contatos). */
  aberta: boolean;
  acoes: {
    agente: () => Promise<void>;
    remover?: () => Promise<void>;
    apagar?: (dados: FormData) => Promise<void>;
  };
}) {
  const [aberta, setAberta] = useState(abertaInicial);
  const idBloco = useId();
  const estado = useAgenteContato({ acao: acoes.agente, desligado: contato.agentePausado, nome: contato.nome });
  const { perfil, marcas } = contato.acesso;
  const etiquetas = etiquetasPodeTratar(perfil, marcas, contato.disponiveis);
  // A linha inteira abre o bloco; cliques na chave, nos links e nos botões ficam com eles.
  const clicarLinha = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input, select, [role=switch]')) return;
    setAberta((a) => !a);
  };

  return (
    <>
      <TableRow className="cursor-pointer" onClick={clicarLinha} data-state={aberta ? 'selected' : undefined}>
        <TableCell>
          <span className="flex flex-col">
            <span className="font-semibold text-foreground">{contato.nome}</span>
            {!estado.atende && <span className="text-sm text-agent-paused">agente desligado</span>}
          </span>
        </TableCell>
        <TableCell className="text-muted">{contato.cargo ?? '—'}</TableCell>
        <TableCell className="tabular whitespace-nowrap">{mascararTelefone(contato.telefone)}</TableCell>
        <TableCell className="text-muted">{contato.email ?? '—'}</TableCell>
        <TableCell><SeloPerfil perfil={perfil} /></TableCell>
        <TableCell>
          <span className="flex flex-wrap items-center gap-1">
            {etiquetas.map((e) => {
              if (e.tipo === 'todos') return <span key={e.texto} className="font-semibold text-success">{e.texto}</span>;
              if (e.tipo === 'setor') return <Badge key={e.texto} variant="brand" className="uppercase">{e.texto}</Badge>;
              if (e.tipo === 'extra') return <Badge key={e.texto} variant="neutral">{e.texto}</Badge>;
              return <span key={e.texto} className="text-sm text-muted">{e.texto}</span>;
            })}
          </span>
        </TableCell>
        <TableCell><ChaveAgenteContato nome={contato.nome} pode={pode} {...estado} /></TableCell>
        <TableCell className="w-10 text-right">
          <button
            type="button"
            aria-expanded={aberta}
            aria-controls={idBloco}
            aria-label={`${aberta ? 'Fechar' : 'Abrir'} o acesso de ${contato.nome}`}
            onClick={() => setAberta((a) => !a)}
            className="inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"
          >
            {aberta ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
          </button>
        </TableCell>
      </TableRow>
      {aberta && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={8} id={idBloco} className="p-0">
            {/* key: o estado do bloco é deste contato nesta empresa; nunca passa para outro. */}
            <BlocoAcesso
              key={`${contato.id}:${clienteId}`}
              variante="ficha"
              rotulo={`Acesso de ${contato.nome}`}
              contatoId={contato.id}
              clienteId={clienteId}
              nomeContato={contato.nome}
              pessoa={{ nome: contato.nome, cargo: contato.cargo, email: contato.email, telefone: contato.telefone }}
              inicial={contato.acesso}
              disponiveis={contato.disponiveis}
              semServicoComSetor={semServicoComSetor}
              socios={socios.filter((s) => s.contatoId !== contato.id)}
              pode={pode}
              arquivado={false}
              aoFechar={() => setAberta(false)}
              acoesExtras={(acoes.remover || acoes.apagar) && (
                <>
                  {acoes.remover && (
                    <form action={acoes.remover}>
                      <Button type="submit" variant="ghost" size="sm" title={`Tira ${contato.nome} desta empresa (o contato continua cadastrado)`}>
                        <UserRoundMinus aria-hidden size={16} strokeWidth={1.75} />
                        Remover
                      </Button>
                    </form>
                  )}
                  {acoes.apagar && <ApagarDadosContato nome={contato.nome} acao={acoes.apagar} />}
                </>
              )}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
