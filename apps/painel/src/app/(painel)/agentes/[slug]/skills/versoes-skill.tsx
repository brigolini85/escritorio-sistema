'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { diferencaLinhas } from '@escritorio/core';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import type { SkillTela, VersaoSkill } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarDataHora } from '@/lib/formatos';
import { restaurarVersaoSkill, versoesDaSkill } from '@/lib/skills-acoes';

/** Versões da skill (D9): quem, quando, a diferença para a anterior e RESTAURAR (só o dono). */
export function VersoesSkill({ skill, dono }: { skill: SkillTela; dono: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [versoes, setVersoes] = useState<VersaoSkill[] | null>(null);
  const [vista, setVista] = useState(0);
  const [enviando, iniciar] = useTransition();
  useEffect(() => { if (aberto) versoesDaSkill(skill.id).then((v) => { setVersoes(v); setVista(0); }); }, [aberto, skill.id]);
  const atual = versoes?.[vista];
  const anterior = versoes?.[vista + 1];
  const linhas = atual ? diferencaLinhas(anterior?.skillMd ?? '', atual.skillMd) : [];
  const restaurar = (v: VersaoSkill) => iniciar(async () => {
    const r = await restaurarVersaoSkill(v.id);
    if (r.ok) { toast(`Versão ${v.versao} restaurada.`); setAberto(false); router.refresh(); } else toast.error(r.erro);
  });
  return (
    <Sheet open={aberto} onOpenChange={setAberto}>
      <SheetTrigger asChild><Button size="sm" variant="ghost" aria-label={`Versões de ${skill.titulo}`}><History aria-hidden size={16} /></Button></SheetTrigger>
      <SheetContent>
        <SheetHeader><SheetTitle>Versões de {skill.titulo}</SheetTitle><SheetDescription>Quem subiu, quando e o que mudou.</SheetDescription></SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          {!versoes ? <p className="text-sm text-muted">Carregando…</p> : (
            <>
              <ul className="flex flex-col gap-1">
                {versoes.map((v, i) => (
                  <li key={v.id}>
                    <button type="button" onClick={() => setVista(i)} aria-pressed={i === vista}
                      className={cn('flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm', i === vista ? 'border-brand bg-brand-soft' : 'border-border')}>
                      <span><b>v{v.versao}</b>{i === 0 && ' (atual)'}{v.origem === 'restaurada' && ` · restaurada da v${v.restauradaDe}`}</span>
                      <span className="text-muted">{formatarDataHora(v.criadoEm)}{v.autor ? ` · ${v.autor}` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {atual && (
                <section aria-label={`Diferença da versão ${atual.versao}`} className="flex flex-col gap-2">
                  <p className="text-sm font-bold">{anterior ? `O que mudou da v${anterior.versao} para a v${atual.versao}` : 'Primeira versão'}</p>
                  <pre className="max-h-96 overflow-auto rounded-md border border-border bg-surface-muted p-2 text-xs">
                    {linhas.map((l, i) => (
                      <div key={i} className={cn(l.tipo === 'mais' && 'bg-success-soft text-success', l.tipo === 'menos' && 'bg-danger-soft text-danger line-through', l.tipo === 'igual' && 'text-muted')}>
                        <span aria-hidden>{l.tipo === 'mais' ? '+ ' : l.tipo === 'menos' ? '− ' : '  '}</span>
                        <span className="sr-only">{l.tipo === 'mais' ? 'Adicionado: ' : l.tipo === 'menos' ? 'Removido: ' : ''}</span>{l.texto}
                      </div>
                    ))}
                  </pre>
                  <p className="text-xs text-muted">Arquivos: {atual.arquivos.length ? atual.arquivos.join(', ') : 'nenhum'}</p>
                  {dono && vista > 0 && <Button onClick={() => restaurar(atual)} disabled={enviando}>Restaurar a versão {atual.versao}</Button>}
                </section>
              )}
            </>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
