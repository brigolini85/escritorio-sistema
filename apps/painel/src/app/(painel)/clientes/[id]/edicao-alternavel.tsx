'use client';

import { Pencil } from 'lucide-react';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { PermissionGate } from '@/components/patterns/permission-gate';
import { Button } from '@/components/ui/button';

const Contexto = createContext<{ cancelar: () => void; terminou: () => void } | null>(null);

/**
 * Cartão em modo leitura por padrão; "Editar" (só com permissão, via PermissionGate) mostra o formulário.
 * O formulário fica montado (só escondido). Salvou sem erro: volta para a leitura com os dados novos.
 * Falhou (a ação volta com ?erro=): o formulário continua aberto, com o aviso em cima. O React limpa o formulário
 * depois de cada envio, como antes do redesenho: os campos voltam ao que está gravado.
 */
export function EdicaoAlternavel({
  titulo,
  pode,
  erro,
  motivo,
  leitura,
  children,
}: {
  titulo: ReactNode;
  pode: boolean;
  erro?: string;
  motivo?: string;
  leitura: ReactNode;
  /** O <form> de edição; dentro dele, use <BotoesEdicao> no lugar do botão de salvar. */
  children: ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [aguardando, setAguardando] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  // Terminou de salvar: sem aviso de erro, volta para a leitura (com os dados novos que o servidor mandou).
  // Com erro, continua aberto; se o aviso sumir depois (o salvamento seguinte deu certo), fecha.
  useEffect(() => {
    if (!aguardando || erro) return;
    setAguardando(false);
    setEditando(false);
  }, [aguardando, erro]);
  // O aviso de erro chegou depois: reabre o formulário.
  useEffect(() => {
    if (erro) setEditando(true);
  }, [erro]);

  const cancelar = () => {
    caixa.current?.querySelector('form')?.reset();
    setAguardando(false);
    setEditando(false);
  };

  return (
    <Contexto.Provider value={{ cancelar, terminou: () => setAguardando(true) }}>
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
        {!editando && (
          <PermissionGate permitido={pode} modo="desabilitar" motivo={motivo}>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
              Editar
            </Button>
          </PermissionGate>
        )}
      </div>
      {!editando && <div className="p-4">{leitura}</div>}
      <div ref={caixa} hidden={!editando}>{children}</div>
    </Contexto.Provider>
  );
}

/** Rodapé do formulário de edição: Cancelar + salvar (mostra "Salvando…" e avisa o cartão quando termina). */
export function BotoesEdicao({ salvar }: { salvar: string }) {
  const ctx = useContext(Contexto);
  const { pending } = useFormStatus();
  const antes = useRef(false);
  useEffect(() => {
    if (antes.current && !pending) ctx?.terminou();
    antes.current = pending;
  }, [pending, ctx]);
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
      <Button type="button" variant="outline" onClick={() => ctx?.cancelar()} disabled={pending}>Cancelar</Button>
      <Button type="submit" disabled={pending} aria-disabled={pending}>{pending ? 'Salvando…' : salvar}</Button>
    </div>
  );
}
