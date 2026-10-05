'use client';

import { Building2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { etiquetasPodeTratar } from '@escritorio/core';
import { BlocoAcesso } from '@/components/patterns/bloco-acesso';
import { SeloPerfil } from '@/components/patterns/selo-perfil';
import type { AcessoNaEmpresa } from '@/lib/acesso-contato';

/**
 * Empresas do contato com o acesso em cada uma (spec 7C.2, último item): o cartão da empresa (nome e link para a ficha) ganha
 * o perfil, o "Pode tratar" e "Acesso", que abre o mesmo bloco da ficha, um por vez (o painel é estreito). Com uma empresa
 * só, já abre. As caixas instantâneas da G3 saíram: nota e preço moram no bloco, com Salvar (D22).
 */
export function AcessoPorEmpresa({ contatoId, nome, acessos, pode, arquivado }: {
  contatoId: string; nome: string; acessos: AcessoNaEmpresa[]; pode: boolean; arquivado: boolean;
}) {
  const [aberta, setAberta] = useState<string | null>(acessos.length === 1 ? acessos[0]!.clienteId : null);
  return (
    <ul className="flex flex-col gap-2">
      {acessos.map((a) => {
        const abrir = aberta === a.clienteId;
        const idBloco = `acesso-${contatoId}-${a.clienteId}`;
        return (
          <li key={a.clienteId} className="flex flex-col rounded-md border border-border">
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-brand">
                  <Building2 aria-hidden size={16} strokeWidth={1.75} className="shrink-0" />
                  <span className="truncate">{a.empresa}</span>
                </span>
                <Link href={`/clientes/${a.clienteId}?aba=contatos&contato=${contatoId}`} aria-label={`Abrir a ficha de ${a.empresa}`} className="text-muted hover:text-foreground">
                  <ExternalLink aria-hidden size={16} strokeWidth={1.75} />
                </Link>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1 text-sm text-muted">
                  <SeloPerfil perfil={a.acesso.perfil} />
                  {etiquetasPodeTratar(a.acesso.perfil, a.acesso.marcas, a.disponiveis).map((e, i) => (
                    <span key={e.texto}>{i > 0 && <span aria-hidden>· </span>}{e.texto}</span>
                  ))}
                </span>
                <button
                  type="button"
                  aria-expanded={abrir}
                  aria-controls={idBloco}
                  aria-label={`Acesso em ${a.empresa}`}
                  onClick={() => setAberta(abrir ? null : a.clienteId)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-brand hover:bg-surface-muted"
                >
                  Acesso
                  {abrir ? <ChevronUp aria-hidden size={16} /> : <ChevronDown aria-hidden size={16} />}
                </button>
              </div>
            </div>
            {abrir && (
              <div id={idBloco} className="border-t border-border p-3">
                {/* key: o estado do bloco é deste contato nesta empresa; nunca passa para outro. */}
                <BlocoAcesso
                  key={`${contatoId}:${a.clienteId}`}
                  variante="painel"
                  rotulo={a.empresa}
                  contatoId={contatoId}
                  clienteId={a.clienteId}
                  nomeContato={nome}
                  inicial={a.acesso}
                  disponiveis={a.disponiveis}
                  semServicoComSetor={a.semServicoComSetor}
                  socios={a.socios}
                  pode={pode}
                  arquivado={arquivado}
                  avisoSoLeitura={false}
                  aoFechar={() => setAberta(null)}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
