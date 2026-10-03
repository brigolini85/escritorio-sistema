'use client';

import { Building2, Check, ChevronsUpDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/cn';

export type EmpresaOpcao = { id: string; nome: string; detalhe?: string | null; inativa?: boolean };

/**
 * Campo de formulário para escolher uma empresa com busca (nome, nome fantasia ou CNPJ em `detalhe`).
 * Envia o id no campo `name`. O campo que vai no formulário é um input de texto escondido e não controlado:
 * o FormularioAlteravel compara o valor com o padrão e percebe a troca (o evento "input" avisa o formulário).
 * `id`, `aria-describedby` e `aria-invalid` (do FormField) vão para o botão, que é o controle rotulado.
 * `ativo` falso (ex.: a pessoa trocou "Uma empresa" por "Todos"): o campo volta ao valor inicial, para não contar como
 * alteração; a escolha fica guardada e volta quando `ativo` volta a ser verdadeiro.
 */
export function EscolherEmpresa({
  name,
  empresas,
  inicial = null,
  placeholder = 'Escolha a empresa',
  aoMudar,
  id,
  className,
  'aria-describedby': descritoPor,
  'aria-invalid': invalido,
  disabled,
  ativo = true,
}: {
  name: string;
  empresas: EmpresaOpcao[];
  inicial?: string | null;
  placeholder?: string;
  aoMudar?: (id: string) => void;
  id?: string;
  className?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  disabled?: boolean;
  ativo?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [valor, setValor] = useState(inicial ?? '');
  const campo = useRef<HTMLInputElement>(null);
  const escolhida = empresas.find((e) => e.id === valor) ?? null;
  const idLista = id ? `${id}-lista` : undefined;

  // O campo do formulário acompanha a escolha (ou o valor inicial, sem `ativo`); o evento avisa o FormularioAlteravel.
  useEffect(() => {
    const el = campo.current;
    const alvo = ativo ? valor : inicial ?? '';
    if (!el || el.value === alvo) return;
    el.value = alvo;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, [ativo, valor, inicial]);

  const escolher = (novo: string) => {
    setValor(novo);
    setAberto(false);
    aoMudar?.(novo);
  };

  return (
    <>
      <input ref={campo} type="text" name={name} defaultValue={inicial ?? ''} hidden readOnly tabIndex={-1} />
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            role="combobox"
            aria-expanded={aberto}
            aria-controls={aberto ? idLista : undefined}
            aria-haspopup="listbox"
            aria-describedby={descritoPor}
            aria-invalid={invalido}
            disabled={disabled}
            className={cn(
              'flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-left text-base shadow-sm',
              'disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger',
              className,
            )}
          >
            <Building2 aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
            <span className={cn('flex-1 truncate', escolhida ? 'text-foreground' : 'text-subtle')}>
              {escolhida ? `${escolhida.nome}${escolhida.inativa ? ' (arquivada)' : ''}` : placeholder}
            </span>
            <ChevronsUpDown aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-0">
          <Command>
            <CommandInput placeholder="Buscar por nome ou CNPJ" aria-label="Buscar empresa" />
            <CommandList id={idLista} aria-label="Empresas">
              <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
              <CommandGroup>
                {empresas.map((e) => (
                  <CommandItem key={e.id} value={`${e.nome} ${e.detalhe ?? ''} ${e.id}`} onSelect={() => escolher(e.id)}>
                    <Check aria-hidden size={16} strokeWidth={1.75} className={cn(e.id === valor ? 'opacity-100' : 'opacity-0')} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate">{e.nome}{e.inativa ? ' (arquivada)' : ''}</span>
                      {e.detalhe && <span className="truncate text-xs text-muted">{e.detalhe}</span>}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
