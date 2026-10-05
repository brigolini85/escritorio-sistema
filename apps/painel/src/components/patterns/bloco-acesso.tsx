'use client';

import { Check, Send, X } from 'lucide-react';
import { unstable_rethrow } from 'next/navigation';
import { useEffect, useId, useReducer, useState, useTransition, type ReactNode } from 'react';
import { PERFIS, ROTULO_PERFIL, setorComArtigo, type Perfil, type SetorDisponivel } from '@escritorio/core';
import { FormField } from '@/components/patterns/form-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/toaster';
import type { AcessoDoVinculo, Socio } from '@/lib/acesso-contato';
import { salvarAcessoContato } from '@/lib/acesso-contato-acoes';
import { cn } from '@/lib/cn';
import { mascararTelefone } from '@/lib/formatos';
import { perfilDoBloco, previaDoBloco, reduzirBloco, type AcaoBloco, type EstadoBloco } from './bloco-acesso-estado';

type PropsBloco = {
  contatoId: string; clienteId: string;
  /** Nome do grupo (leitor de tela e e2e): o nome da empresa no painel de Contatos; "Acesso de <nome>" na ficha. */
  rotulo: string;
  nomeContato: string;
  inicial: AcessoDoVinculo;
  disponiveis: SetorDisponivel[]; semServicoComSetor: boolean;
  /** Quem recebe alertas de acesso na empresa, já sem o próprio contato. */
  socios: Socio[];
  pode: boolean; arquivado: boolean;
  variante: 'ficha' | 'painel';
  /** Só na ficha: a coluna "Dados e perfil" com nome, cargo, celular (só leitura) e e-mail. */
  pessoa?: { nome: string; cargo: string | null; email: string | null; telefone: string };
  /** Remover, Apagar dados (LGPD): ficam no rodapé do bloco, na ficha. */
  acoesExtras?: ReactNode;
  aoFechar?: () => void;
};

const classeSelect = 'h-9 w-full rounded-md border border-input bg-surface px-2 text-base text-foreground shadow-sm disabled:cursor-not-allowed disabled:opacity-60';
const FALHA = 'Não foi possível salvar agora. Tente de novo.';

/** Título de coluna do bloco, como na imagem: caixa alta pelo CSS, vinho. */
function Titulo({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return <h4 id={id} className={cn('text-xs font-bold uppercase tracking-wide text-brand', className)}>{children}</h4>;
}

/** Uma chave com rótulo e ajuda curta embaixo (o nome acessível é o rótulo). */
function Chave({ rotulo, ajuda, marcado, desligado, mudar }: { rotulo: string; ajuda?: string; marcado: boolean; desligado: boolean; mudar: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-base text-foreground">
      <Switch checked={marcado} onCheckedChange={mudar} disabled={desligado} aria-label={rotulo} className="mt-0.5" />
      <span className="flex flex-col">
        <span>{rotulo}</span>
        {ajuda && <span className="text-sm text-muted">{ajuda}</span>}
      </span>
    </label>
  );
}

/**
 * Bloco de acesso de um contato numa empresa (spec 7D.2, imagem 00-cliente-contatos-acesso): perfil, setores que pode tratar
 * (com "pode ser procurado"), permissões especiais, documentos e avisos e a prévia do agente. O mesmo na ficha (três colunas)
 * e no painel de Contatos (uma coluna), gravando no mesmo lugar (D22, D23).
 */
export function BlocoAcesso(p: PropsBloco) {
  const id = useId();
  const desligado = !p.pode || p.arquivado;
  const [estado, despachar] = useReducer(
    (e: EstadoBloco, a: AcaoBloco) => reduzirBloco(e, a, p.disponiveis), { marcas: p.inicial.marcas });
  const [pessoa, setPessoa] = useState({ nome: p.pessoa?.nome ?? '', cargo: p.pessoa?.cargo ?? '', email: p.pessoa?.email ?? '' });
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, iniciar] = useTransition();
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);
  const m = estado.marcas;
  const perfil = perfilDoBloco(estado, p.disponiveis);
  // O próprio contato nunca é avisado do pedido dele (D7), mesmo que a tela mande a lista inteira.
  const socios = p.socios.filter((s) => s.contatoId !== p.contatoId).map((s) => s.primeiroNome);
  const previa = previaDoBloco(m, p.disponiveis, socios);
  const primeiro = p.nomeContato.trim().split(/\s+/)[0] ?? p.nomeContato;
  const marcado = (setorId: string) => m.setores.find((s) => s.setorId === setorId);

  const salvar = () => iniciar(async () => {
    setErro(null);
    try {
      const r = await salvarAcessoContato(p.contatoId, p.clienteId, { marcas: m, ...(p.pessoa ? { contato: pessoa } : {}) });
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success('Acesso salvo.');
      p.aoFechar?.();
    } catch (e) {
      unstable_rethrow(e);
      console.error('[acesso] falha ao salvar o bloco', e);
      setErro(FALHA);
      toast.error(FALHA);
    }
  });
  const cancelar = () => {
    despachar({ tipo: 'voltar', marcas: p.inicial.marcas });
    setPessoa({ nome: p.pessoa?.nome ?? '', cargo: p.pessoa?.cargo ?? '', email: p.pessoa?.email ?? '' });
    setErro(null);
    p.aoFechar?.();
  };

  const seletorPerfil = (
    <FormField
      id={`${id}-perfil`}
      rotulo="Perfil de acesso"
      ajuda='Sócio · Administrativo · Financeiro · RH/DP · Compras/Vendas · Funcionário · Básico · Personalizado. Mudar uma marcação vira "Personalizado".'
    >
      <select
        value={perfil}
        onChange={(e) => despachar({ tipo: 'perfil', perfil: e.target.value as Perfil })}
        disabled={desligado}
        className={classeSelect}
      >
        {PERFIS.map((x) => <option key={x} value={x}>{ROTULO_PERFIL[x]}</option>)}
      </select>
    </FormField>
  );

  const dados = p.variante === 'ficha' && p.pessoa ? (
    <div className="flex flex-col gap-3">
      <Titulo>Dados e perfil</Titulo>
      <FormField id={`${id}-nome`} rotulo="Nome">
        <Input value={pessoa.nome} onChange={(e) => setPessoa({ ...pessoa, nome: e.target.value })} disabled={desligado} />
      </FormField>
      <FormField id={`${id}-cargo`} rotulo="Cargo">
        <Input value={pessoa.cargo} onChange={(e) => setPessoa({ ...pessoa, cargo: e.target.value })} disabled={desligado} />
      </FormField>
      <FormField id={`${id}-celular`} rotulo="Celular (WhatsApp)" ajuda="Para trocar o número, cadastre o contato novo.">
        <Input value={mascararTelefone(p.pessoa.telefone)} readOnly />
      </FormField>
      <FormField id={`${id}-email`} rotulo="E-mail">
        <Input type="email" value={pessoa.email} onChange={(e) => setPessoa({ ...pessoa, email: e.target.value })} disabled={desligado} />
      </FormField>
      {seletorPerfil}
    </div>
  ) : seletorPerfil;

  const setores = (
    <div className="flex flex-col gap-3">
      <Titulo>Setores que pode tratar</Titulo>
      <ul className="flex flex-col gap-2">
        {p.disponiveis.map((s) => {
          const marca = marcado(s.id);
          return (
            <li key={s.id} className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-center gap-2 text-base text-foreground">
                  <Checkbox
                    checked={!!marca}
                    aria-label={s.nome}
                    disabled={desligado}
                    onCheckedChange={(v) => despachar({ tipo: 'setor', setorId: s.id, marcado: v === true })}
                  />
                  {s.nome}
                  {!s.contratado && <Badge variant="outline">fora do contrato</Badge>}
                </label>
                <span className="text-sm text-muted">{s.dica}</span>
              </div>
              {marca && (
                <div className="pl-7">
                  <Chave
                    rotulo={`Pode ser procurado pelo agente ${setorComArtigo(s.nome)}`}
                    ajuda="lembretes, cobranças e coletas"
                    marcado={marca.podeSerProcurado}
                    desligado={desligado}
                    mudar={(v) => despachar({ tipo: 'procurado', setorId: s.id, marcado: v })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted">
        {p.semServicoComSetor ? 'A empresa não tem serviço ligado a setor: aparecem todos.' : 'Só aparecem os setores que a empresa contrata.'}
      </p>
    </div>
  );

  const permissoes = (
    <div className="flex flex-col gap-3">
      <Titulo>Permissões especiais</Titulo>
      <Chave rotulo="Pedir nota de venda" marcado={m.podePedirNota} desligado={desligado}
        mudar={(v) => despachar({ tipo: 'chave', campo: 'podePedirNota', valor: v })} />
      <Chave rotulo="Mudar preço e cadastrar produto" marcado={m.podeAtualizarPreco} desligado={desligado}
        mudar={(v) => despachar({ tipo: 'chave', campo: 'podeAtualizarPreco', valor: v })} />
      <Chave rotulo="Ver valores" ajuda="honorários, boletos, salários" marcado={m.verValores} desligado={desligado}
        mudar={(v) => despachar({ tipo: 'chave', campo: 'verValores', valor: v })} />
    </div>
  );

  const documentos = (
    <div className="flex flex-col gap-3">
      <Titulo>Documentos e avisos</Titulo>
      <Chave rotulo="Receber documentos dos setores permitidos" marcado={m.receberDocumentos} desligado={desligado}
        mudar={(v) => despachar({ tipo: 'chave', campo: 'receberDocumentos', valor: v })} />
      <Chave rotulo="Avisar quando sair documento novo" ajuda="pelo WhatsApp · e-mail" marcado={m.avisarDocumentoNovo.length > 0}
        desligado={desligado} mudar={(v) => despachar({ tipo: 'avisar', ligado: v })} />
      {m.avisarDocumentoNovo.length > 0 && (
        <div className="flex gap-4 pl-12">
          {([['whatsapp', 'WhatsApp'], ['email', 'E-mail']] as const).map(([canal, rotulo]) => (
            <label key={canal} className="flex items-center gap-2 text-base text-foreground">
              <Checkbox
                checked={m.avisarDocumentoNovo.includes(canal)}
                aria-label={rotulo}
                disabled={desligado}
                onCheckedChange={(v) => despachar({ tipo: 'canal', canal, marcado: v === true })}
              />
              {rotulo}
            </label>
          ))}
        </div>
      )}
      <Chave rotulo="Receber alertas de acesso" ajuda="quando alguém da empresa pedir algo fora do permitido" marcado={m.recebeAlertasAcesso}
        desligado={desligado} mudar={(v) => despachar({ tipo: 'chave', campo: 'recebeAlertasAcesso', valor: v })} />
    </div>
  );

  const previaBloco = (
    <section aria-labelledby={`${id}-previa`} aria-live="polite" className="flex flex-col gap-2 rounded-md bg-sidebar p-4 text-sidebar-foreground">
      <Titulo id={`${id}-previa`} className="text-sidebar-foreground">O que o agente vai fazer com {primeiro}</Titulo>
      <p className="flex items-start gap-2 text-sm">
        <Check size={14} aria-hidden className="mt-0.5 shrink-0" />
        <span><span className="sr-only">Pode: </span>{previa.pode}</span>
      </p>
      {previa.recusa && (
        <p className="flex items-start gap-2 text-sm">
          <X size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span><span className="sr-only">Recusa: </span>{previa.recusa}</span>
        </p>
      )}
      {previa.procurado && (
        <p className="flex items-start gap-2 text-sm">
          <Send size={14} aria-hidden className="mt-0.5 shrink-0" />
          <span><span className="sr-only">Procurado: </span>{previa.procurado}</span>
        </p>
      )}
    </section>
  );

  const rodape = (
    <div className="flex flex-col gap-2">
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">{p.acoesExtras}</div>
        {!p.pode ? (
          <p className="text-sm text-muted">Só quem pode editar clientes muda as marcações.</p>
        ) : p.arquivado ? (
          <p className="text-sm text-muted">Contato arquivado: restaure para mudar as marcações.</p>
        ) : (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={cancelar} disabled={salvando}>Cancelar</Button>
            <Button type="button" onClick={salvar} disabled={!hidratado || salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      role="group"
      aria-label={p.rotulo}
      aria-busy={salvando || undefined}
      data-acesso-hidratado={hidratado ? '' : undefined}
      className={cn('flex flex-col gap-4', p.variante === 'ficha' && 'border-l-4 border-brand bg-surface px-5 py-4')}
    >
      {p.variante === 'ficha' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {dados}
          <div className="flex flex-col gap-6">{setores}{permissoes}</div>
          <div className="flex flex-col gap-6">{documentos}{previaBloco}</div>
        </div>
      ) : (
        <>
          {dados}
          {setores}
          {permissoes}
          {documentos}
          {previaBloco}
        </>
      )}
      {rodape}
    </div>
  );
}
