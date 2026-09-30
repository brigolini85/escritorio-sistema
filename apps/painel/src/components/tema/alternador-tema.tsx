'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { RadioGroup } from 'radix-ui';
import { useState } from 'react';
import { cn } from '@/lib/cn';
import { cookieDaEscolha, dataThemeDoCookie, escolhaDoCookie, type EscolhaTema } from './tema';

const OPCOES: { valor: EscolhaTema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
  { valor: 'sistema', rotulo: 'Sistema', Icone: Monitor },
];

/**
 * Alternância manual do tema (claro, escuro ou seguir o sistema). Aplica na hora e grava no cookie.
 * Grupo de rádio do Radix: uma parada de Tab, setas trocam a opção.
 */
export function AlternadorTema({ inicial, className }: { inicial: EscolhaTema; className?: string }) {
  const router = useRouter();
  const [escolha, setEscolha] = useState(inicial);

  function escolher(texto: string) {
    const valor = escolhaDoCookie(texto);
    setEscolha(valor);
    document.cookie = cookieDaEscolha(valor);
    const tema = dataThemeDoCookie(valor);
    if (tema) document.documentElement.dataset.theme = tema;
    else delete document.documentElement.dataset.theme;
    router.refresh();
  }

  return (
    <RadioGroup.Root
      aria-label="Tema"
      value={escolha}
      onValueChange={escolher}
      orientation="horizontal"
      className={cn('inline-flex rounded-md border border-border bg-surface-muted p-0.5', className)}
    >
      {OPCOES.map(({ valor, rotulo, Icone }) => (
        <RadioGroup.Item
          key={valor}
          value={valor}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-sm px-2.5 text-sm text-muted transition-colors duration-150 ease-out hover:text-foreground',
            'data-[state=checked]:bg-surface data-[state=checked]:text-foreground data-[state=checked]:shadow-sm',
          )}
        >
          <Icone aria-hidden size={16} strokeWidth={1.75} />
          {rotulo}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
