'use client';

import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { lerSugestao, pedirSugestao, type LeituraSugestao } from '../acoes';

/** A tabela não está no Realtime: pergunta a cada INTERVALO_MS (≤ 3 s) até sair de "pendente" ou passar ESPERA_MAXIMA_MS. */
const INTERVALO_MS = 2_500;
const ESPERA_MAXIMA_MS = 120_000;

/**
 * Sugerir resposta (spec 7A.1): só ao clicar; o resultado entra no campo, marcado como sugestão, e só se o campo estiver vazio.
 * Nada é enviado sem a pessoa clicar ENVIAR. Campo já escrito não é sobrescrito (P12): aparece "Usar sugestão".
 */
export function SugerirResposta({ conversaId, campo, aoUsar }: {
  conversaId: string;
  campo: RefObject<HTMLTextAreaElement | null>;
  aoUsar: () => void;
}) {
  const [pedido, setPedido] = useState<string | null>(null);
  const [pronta, setPronta] = useState<string | null>(null);
  const [pedindo, setPedindo] = useState(false);
  const tratado = useRef<string | null>(null);

  useEffect(() => {
    if (!pedido) return;
    let ativo = true;
    let tempo: ReturnType<typeof setTimeout> | undefined;
    const inicio = Date.now();
    const tratar = (l: LeituraSugestao | null) => {
      if (!ativo || tratado.current === pedido) return;
      if (l?.status !== 'pronta' && l?.status !== 'falhou') {
        if (Date.now() - inicio >= ESPERA_MAXIMA_MS) l = { status: 'falhou', texto: null, erro: 'Demorou demais. Tente de novo.' };
        else return;
      }
      tratado.current = pedido;
      setPedido(null);
      if (l.status === 'falhou' || !l.texto) {
        toast.error(l.erro ?? 'Não consegui sugerir agora.');
        return;
      }
      const el = campo.current;
      if (el && el.value.trim() === '') {
        el.value = l.texto;
        el.focus();
        aoUsar();
      } else {
        setPronta(l.texto);
      }
    };
    const perguntar = async () => {
      const l = await lerSugestao(pedido).catch(() => null);
      if (!ativo) return;
      tratar(l);
      if (ativo && tratado.current !== pedido) tempo = setTimeout(() => void perguntar(), INTERVALO_MS);
    };
    tempo = setTimeout(() => void perguntar(), 1_000);
    return () => {
      ativo = false;
      clearTimeout(tempo);
    };
  }, [pedido, campo, aoUsar]);

  const pedir = async () => {
    setPronta(null);
    setPedindo(true);
    const r = await pedirSugestao(conversaId).finally(() => setPedindo(false));
    if (!r.ok) {
      toast.error(r.erro);
      return;
    }
    tratado.current = null;
    setPedido(r.id);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" disabled={Boolean(pedido) || pedindo} onClick={() => void pedir()}>
        <Sparkles aria-hidden size={16} strokeWidth={1.75} />
        Sugerir resposta
      </Button>
      <span aria-live="polite" className="text-xs text-muted">{pedido || pedindo ? 'Preparando sugestão…' : ''}</span>
      {pronta && (
        <span role="status" className="flex w-full flex-wrap items-center gap-2 rounded-md bg-assistant-soft px-2 py-1.5 text-sm text-foreground">
          <span className="font-medium">Sugestão pronta</span>
          <span className="line-clamp-1 min-w-0 flex-1 text-muted">{pronta}</span>
          <Button type="button" size="sm" onClick={() => {
            if (campo.current) { campo.current.value = pronta; campo.current.focus(); }
            setPronta(null);
            aoUsar();
          }}>Usar sugestão</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPronta(null)}>Descartar</Button>
        </span>
      )}
    </>
  );
}
