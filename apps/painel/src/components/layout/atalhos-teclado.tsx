'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ATALHOS, EVENTO_ABRIR_ATALHOS, ignorarAtalho } from './atalhos';

function Tecla({ children }: { children: string }) {
  return <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-sm border border-border bg-surface-muted px-1.5 font-sans text-xs font-medium text-foreground">{children}</kbd>;
}

/**
 * Janela "Atalhos do teclado": abre com ? (fora de campos de texto, menus e janelas) ou pelo menu da pessoa.
 * O Dialog prende o foco e devolve ao elemento de antes ao fechar.
 */
export function AtalhosTeclado() {
  const [aberta, setAberta] = useState(false);
  // Sem gatilho próprio, o Radix não sabe para onde devolver o foco: guarda quem tinha o foco ao abrir.
  const antes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== '?' || ignorarAtalho(e)) return;
      e.preventDefault();
      abrir();
    };
    // O menu da pessoa manda o próprio botão em detail (o item do menu some ao fechar).
    const abrir = (e?: Event) => {
      const pedido = e instanceof CustomEvent && e.detail instanceof HTMLElement ? e.detail : null;
      const ativo = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      antes.current = pedido ?? ativo;
      setAberta(true);
    };
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener(EVENTO_ABRIR_ATALHOS, abrir);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener(EVENTO_ABRIR_ATALHOS, abrir);
    };
  }, []);

  return (
    <Dialog open={aberta} onOpenChange={setAberta}>
      <DialogContent
        className="max-w-2xl"
        onCloseAutoFocus={(e) => {
          const alvo = antes.current;
          if (alvo?.isConnected) {
            e.preventDefault();
            alvo.focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Atalhos do teclado</DialogTitle>
          <DialogDescription>As letras não funcionam enquanto você digita num campo.</DialogDescription>
        </DialogHeader>
        <table className="w-full text-base">
          <caption className="sr-only">Atalhos do teclado</caption>
          <thead className="sr-only">
            <tr><th scope="col">Teclas</th><th scope="col">O que faz</th><th scope="col">Onde</th></tr>
          </thead>
          <tbody>
            {ATALHOS.map((a) => (
              <tr key={a.descricao} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap py-2 pr-4 align-top">
                  <span className="flex items-center gap-1">
                    {a.teclas.map((combo, i) => (
                      <Fragment key={combo.join('+')}>
                        {i > 0 && <span className="text-xs text-subtle">ou</span>}
                        {combo.map((t, j) => (
                          <Fragment key={t}>
                            {j > 0 && <span aria-hidden className="text-xs text-subtle">+</span>}
                            <Tecla>{t}</Tecla>
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                  </span>
                </td>
                <td className="py-2 pr-4 align-top text-foreground">{a.descricao}</td>
                <td className="whitespace-nowrap py-2 align-top text-sm text-muted">{a.onde}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
