'use client';
import { useId, useState, useTransition, type ReactNode } from 'react';
import { Info, Plus, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import type { FonteRadar } from '@escritorio/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { GiroTela } from '@/lib/radar';
import { removerFonteRadar, salvarFonteRadar } from '@/lib/radar-acoes';
import { SoDono } from './cabecalho-radar';
import { validarEtiqueta, validarFonte, validarPaginas } from './janelas';

type Erros = { nome?: string; endereco?: string; etiqueta?: string; paginas?: string; geral?: string };

/** Campo com rótulo, dica e erro ao lado; quem usa liga o controle pelos ids `<id>-dica` e `<id>-erro`. */
export function Campo({ id, rotulo, dica, erro, children }: { id: string; rotulo: string; dica?: string; erro?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-brand">{rotulo}</label>
      {children}
      {dica && <p id={`${id}-dica`} className="text-xs text-muted">{dica}</p>}
      {erro && <p id={`${id}-erro`} role="alert" className="text-xs font-bold text-danger">{erro}</p>}
    </div>
  );
}
export const ligar = (id: string, dica: boolean, erro?: string): string => `${dica ? `${id}-dica` : ''} ${erro ? `${id}-erro` : ''}`.trim();

function JanelaNovaFonte({ aberta, aoMudar }: { aberta: boolean; aoMudar: (a: boolean) => void }) {
  const base = useId();
  const [ocupado, iniciar] = useTransition();
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [etiqueta, setEtiqueta] = useState('FED');
  const [oficial, setOficial] = useState(true);
  const [paginas, setPaginas] = useState('');
  const [erros, setErros] = useState<Erros>({});

  const salvar = () => {
    const e: Erros = {};
    const f = validarFonte({ nome, endereco });
    if (f) { if (f.startsWith('O nome')) e.nome = f; else e.endereco = f; }
    const et = validarEtiqueta(etiqueta);
    if (et) e.etiqueta = et;
    const p = validarPaginas(paginas);
    if (!p.ok) e.paginas = p.erro;
    setErros(e);
    if (Object.keys(e).length || !p.ok) return;
    iniciar(async () => {
      const r = await salvarFonteRadar(null, { nome: nome.trim(), endereco, etiqueta: etiqueta.trim().toUpperCase(), oficial, ativa: true, paginas: p.paginas });
      if (!r.ok) { setErros({ geral: r.erro }); return; }
      toast('Fonte adicionada.');
      setNome(''); setEndereco(''); setEtiqueta('FED'); setOficial(true); setPaginas(''); setErros({});
      aoMudar(false);
    });
  };

  const idNome = `${base}-nome`, idEnd = `${base}-end`, idEt = `${base}-et`, idPg = `${base}-pg`, idOf = `${base}-of`;
  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar fonte</DialogTitle>
          <DialogDescription>O Radar só busca nas fontes desta lista.</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(ev) => { ev.preventDefault(); salvar(); }} className="flex flex-col gap-3">
          <Campo id={idNome} rotulo="Nome" erro={erros.nome}>
            <Input id={idNome} value={nome} onChange={(x) => setNome(x.target.value)} maxLength={60} aria-invalid={!!erros.nome} aria-describedby={ligar(idNome, false, erros.nome) || undefined} />
          </Campo>
          <Campo id={idEnd} rotulo="Endereço" dica="Cole o endereço do site, como gov.br/receitafederal." erro={erros.endereco}>
            <Input id={idEnd} value={endereco} onChange={(x) => setEndereco(x.target.value)} inputMode="url" autoComplete="off" aria-invalid={!!erros.endereco} aria-describedby={ligar(idEnd, true, erros.endereco)} />
          </Campo>
          <Campo id={idEt} rotulo="Etiqueta" dica="FED para federal, a sigla do estado (MG) ou MUN para municipal." erro={erros.etiqueta}>
            <Input id={idEt} value={etiqueta} onChange={(x) => setEtiqueta(x.target.value.toUpperCase())} maxLength={4} className="w-24" aria-invalid={!!erros.etiqueta} aria-describedby={ligar(idEt, true, erros.etiqueta)} />
          </Campo>
          <div className="flex items-start gap-3">
            <Switch id={idOf} checked={oficial} onCheckedChange={setOficial} aria-describedby={`${idOf}-dica`} />
            <div className="flex flex-col gap-0.5">
              <label htmlFor={idOf} className="text-sm font-bold">Fonte oficial</label>
              <p id={`${idOf}-dica`} className="text-xs text-muted">{oficial ? 'O que vier daqui é marcado oficial.' : 'Site de notícias: o que vier daqui é marcado confirmar.'}</p>
            </div>
          </div>
          <Campo id={idPg} rotulo="Páginas de novidades (opcional, até 5)" dica="Uma por linha, dentro da própria fonte." erro={erros.paginas}>
            <Textarea id={idPg} value={paginas} onChange={(x) => setPaginas(x.target.value)} rows={3} aria-invalid={!!erros.paginas} aria-describedby={ligar(idPg, true, erros.paginas)} />
          </Campo>
          {erros.geral && <p role="alert" className="flex items-start gap-2 text-sm font-bold text-danger"><TriangleAlert aria-hidden size={14} className="mt-0.5 shrink-0" />{erros.geral}</p>}
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button type="submit" size="sm" disabled={ocupado}>Adicionar fonte</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Fontes do Radar (imagem 00): selo, nome, aviso de fora do ar e o X para tirar. Só o dono muda. */
export function FontesRadar({ fontes, giro, dono }: { fontes: FonteRadar[]; giro: GiroTela | null; dono: boolean }) {
  const [adicionando, setAdicionando] = useState(false);
  const [tirando, setTirando] = useState<FonteRadar | null>(null);
  const [ocupado, iniciar] = useTransition();
  const fora = new Set((giro?.fontesFora ?? []).map((f) => f.nome));
  const titulo = giro
    ? `Fontes · ${giro.fontes} ${giro.fontes === 1 ? 'site' : 'sites'} · ${giro.paginas} ${giro.paginas === 1 ? 'página lida' : 'páginas lidas'}`
    : `Fontes · ${fontes.length} ${fontes.length === 1 ? 'site' : 'sites'}`;

  const tirar = () => {
    if (!tirando) return;
    const alvo = tirando;
    iniciar(async () => {
      const r = await removerFonteRadar(alvo.id);
      if (r.ok) { toast(`${alvo.nome} saiu das fontes.`); setTirando(null); } else toast.error(r.erro);
    });
  };

  return (
    <Card data-testid="radar-fontes" className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">{titulo}</h2>
        {!dono && <SoDono />}
      </div>
      {fontes.length === 0 ? <p className="text-sm text-muted">Nenhuma fonte. Sem fonte, o Radar não procura.</p> : (
        <ul className="flex flex-wrap gap-2">
          {fontes.map((f) => (
            <li key={f.id} className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-sm">
              <Badge variant="neutral" className="uppercase">{f.etiqueta}</Badge>
              <span className={f.ativa ? 'font-medium' : 'font-medium text-muted'}>{f.nome}</span>
              {!f.ativa && <span className="text-xs text-muted">desligada</span>}
              {!f.oficial && <span className="text-xs text-muted">notícias</span>}
              {fora.has(f.nome) && (
                <span className="inline-flex items-center text-warning">
                  <TriangleAlert aria-hidden size={12} /><span className="sr-only">fora do ar no último giro</span>
                </span>
              )}
              {dono && (
                <button type="button" onClick={() => setTirando(f)} aria-label={`Tirar ${f.nome} das fontes`}
                  className="inline-flex size-5 cursor-pointer items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground">
                  <X aria-hidden size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {dono && <div><Button type="button" variant="outline" size="sm" onClick={() => setAdicionando(true)}><Plus aria-hidden size={14} />Adicionar fonte</Button></div>}
      <p className="flex items-start gap-2 rounded-md border border-warning bg-warning-soft px-3 py-2 text-sm">
        <Info aria-hidden size={16} className="mt-0.5 shrink-0 text-warning" />
        <span><b>Só busca nessas fontes.</b> Notícia sem fonte oficial vem marcada <b className="uppercase">confirmar</b> e o Radar tenta achar o ato oficial.</span>
      </p>
      {dono && <JanelaNovaFonte aberta={adicionando} aoMudar={setAdicionando} />}
      <Dialog open={!!tirando} onOpenChange={(a) => { if (!a) setTirando(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tirar {tirando?.nome} das fontes?</DialogTitle>
            <DialogDescription>O Radar deixa de buscar nela. As novidades já achadas ficam.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline" size="sm">Cancelar</Button></DialogClose>
            <Button type="button" variant="danger" size="sm" disabled={ocupado} onClick={tirar}>Tirar fonte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
