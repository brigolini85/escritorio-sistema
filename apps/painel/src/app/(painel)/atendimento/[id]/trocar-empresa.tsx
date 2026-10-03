'use client';

import { ChevronDown } from 'lucide-react';
import { useTransition } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toaster';
import { trocarEmpresa } from '../acoes';

/** "trocar empresa" (spec 7A.1): só as outras empresas ativas do contato. O banco confere de novo (foco da revisão 3). */
export function TrocarEmpresa({ conversaId, outras }: { conversaId: string; outras: { id: string; nome: string }[] }) {
  const [pendente, iniciar] = useTransition();
  if (outras.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pendente}
        aria-label="Trocar empresa"
        className="inline-flex items-center gap-0.5 rounded-sm text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        {pendente ? 'trocando…' : 'trocar empresa'}
        <ChevronDown aria-hidden size={14} strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {/* A troca não move as demandas abertas da empresa de antes (Task 3). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="max-w-64 font-normal text-muted">As demandas abertas continuam na empresa de antes.</DropdownMenuLabel>
        </DropdownMenuGroup>
        {outras.map((e) => (
          <DropdownMenuItem
            key={e.id}
            onSelect={() => iniciar(async () => {
              const r = await trocarEmpresa(conversaId, e.id);
              if (r.ok) toast.success(r.mensagem); else toast.error(r.erro);
            })}
          >
            {e.nome}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
