'use client';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { APROVACAO_FERRAMENTA, CATALOGO_COMPLETO, FERRAMENTAS_ATENDIMENTO, FERRAMENTAS_AUTOMATICAS, FERRAMENTAS_DO_CATALOGO, ROTULO_APROVACAO } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { salvarAgente } from '@/lib/agentes-acoes';

/** Aba Ferramentas (spec 7E.3, D15): o catálogo com só leitura × grava/envia; o dono escolhe; no Thiago, fixas. */
export function EscolherFerramentas({ slug, porta, escolhidas, editavel }: { slug: string; porta: boolean; escolhidas: string[]; editavel: boolean }) {
  const router = useRouter();
  const [marcadas, setMarcadas] = useState(new Set(escolhidas));
  const [enviando, iniciar] = useTransition();
  const mudou = marcadas.size !== escolhidas.length || escolhidas.some((f) => !marcadas.has(f));
  const salvar = () => iniciar(async () => {
    const r = await salvarAgente(slug, { ferramentas: [...marcadas] });
    if (r.ok) { toast('Ferramentas salvas.'); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Ferramentas do catálogo</h2>
      {porta && <p className="text-sm text-muted">As ferramentas do atendimento são fixas nesta etapa. As que gravam ou enviam valem com o "sim" do cliente no WhatsApp (regras fixas).</p>}
      {!porta && <p className="text-sm text-muted">Abrir demanda, passar para pessoa e enviar documento são do Thiago: o agente devolve a conversa a ele. Responder entra pelo modo de falar com o cliente.</p>}
      <ul className="flex flex-col divide-y divide-border">
        {/* F1: a visão do Thiago tem só as 16 do atendimento; as do setor aparecem para os outros agentes. */}
        {(porta ? FERRAMENTAS_ATENDIMENTO : FERRAMENTAS_DO_CATALOGO).map((f) => {
          const info = CATALOGO_COMPLETO[f];
          const aprovacao = APROVACAO_FERRAMENTA[f];
          // D8: nos agentes dos setores, as "só do Thiago" e o responder (vem pelo modo) ficam travados; F2: marcada, ainda dá para desmarcar.
          const travada = !porta && (aprovacao === 'so_atendimento' || aprovacao === 'conversa');
          const selo = porta ? (aprovacao ? 'o cliente confirma' : null) : aprovacao ? ROTULO_APROVACAO[aprovacao] : null;
          return (
            <li key={f} className="flex items-center gap-3 py-2">
              <Checkbox id={`ferramenta-${f}`} checked={marcadas.has(f)} disabled={!editavel || porta || enviando || (travada && !marcadas.has(f))}
                onCheckedChange={(v) => setMarcadas((m) => { const n = new Set(m); if (v === true) { if (!travada) n.add(f); } else n.delete(f); return n; })} />
              <label htmlFor={`ferramenta-${f}`} className="flex flex-1 flex-col">
                <span className="font-medium">{info.rotulo}</span><span className="text-sm text-muted">{info.descricao}</span>
              </label>
              {selo ? <Badge variant="warning"><LockKeyhole aria-hidden />{selo}</Badge> : <Badge variant="success">só leitura</Badge>}
            </li>
          );
        })}
      </ul>
      <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted">
        <p className="font-bold text-foreground">Entram sozinhas quando há skill sob demanda ligada</p>
        <ul>{Object.values(FERRAMENTAS_AUTOMATICAS).map((i) => <li key={i.rotulo}>{i.rotulo}: {i.descricao}</li>)}</ul>
      </div>
      {editavel && !porta && <Button className="self-end" onClick={salvar} disabled={!mudou || enviando}>Salvar</Button>}
    </Card>
  );
}
