'use client';

import { somenteDigitos, validarCnpj } from '@escritorio/core';
import { CircleAlert } from 'lucide-react';
import { unstable_rethrow, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from 'react';
import { FormularioAlteravel } from '@/components/patterns/formulario-alteravel';
import { toast } from '@/components/ui/toaster';
import { mascararCEP } from '@/lib/formatos';
import { buscarCep, buscarCnpj, salvarFicha } from './acoes';
import { BlocoCertificado, BlocoContrato, BlocoResponsaveis } from './blocos-contrato';
import { BlocoContato, BlocoEndereco, BlocoIdentificacao, type Busca } from './blocos-empresa';
import {
  estadoDosBlocos, mensagemBusca, textoPreenchido, valoresDe, valoresDoCliente, type ClienteFicha, type EstadoFicha, type EstadoBloco, type ValoresFicha,
} from './ficha';
import { IndiceFicha } from './indice-ficha';
import { BlocoFiscal } from './inscricoes-st';
import { RodapeFicha } from './rodape-ficha';

export type PropsFicha = {
  cliente: ClienteFicha | null;
  servicos: { id: string; nome: string; setor_id: string | null }[];
  contratados: string[];
  setores: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
  responsaveis: Record<string, string>;
  inscricoesSt: { uf: string; inscricao: string | null }[];
  pode: boolean;
  admin: boolean;
  /** Bloco Acessos de portais: salva sozinho, a senha nunca vai junto da ficha (D13). */
  acessos: ReactNode;
  /** Bloco Arquivos (Parte I3b): salva sozinho, como os acessos. */
  arquivos?: ReactNode;
  /** Estado do bloco Arquivos no índice (pasta do Drive ligada ou não). */
  estadoArquivos?: EstadoBloco;
  ultimaAlteracao: string | null;
  /** "Agora" do servidor: as pendências saem iguais no servidor e no navegador. */
  agora: string;
};

const FALHA = 'Não foi possível salvar: não consegui gravar agora. Tente de novo.';
type Status = { buscando: boolean; mensagem: string | null };
const PARADO: Status = { buscando: false, mensagem: null };

/** Ficha do cliente, aba Dados (spec 7D.1). CANCELAR remonta o formulário com o que está salvo. */
export function FichaCliente(props: PropsFicha) {
  const [versao, setVersao] = useState(0);
  return <Formulario key={versao} {...props} aoCancelar={() => setVersao((v) => v + 1)} />;
}

function Formulario({ cliente, servicos, contratados, setores, pessoas, responsaveis, inscricoesSt, pode, admin, acessos, arquivos, estadoArquivos, ultimaAlteracao, agora, aoCancelar }:
  PropsFicha & { aoCancelar: () => void }) {
  const router = useRouter();
  const caixa = useRef<HTMLDivElement>(null);
  const form = () => caixa.current?.querySelector('form') ?? null;
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);
  const [estado, setEstado] = useState<EstadoFicha | null>(null);
  const [enviando, iniciar] = useTransition();
  const [valores, setValores] = useState<ValoresFicha>(() => valoresDoCliente(cliente, inscricoesSt, Object.keys(responsaveis).length));
  const quando = useMemo(() => new Date(agora), [agora]);
  const estadosBase = estadoDosBlocos(valores, quando);
  const estados = { ...estadosBase, arquivos: estadoArquivos ?? estadosBase.arquivos };
  const erros = estado && !estado.ok ? estado.erros : {};
  const [cnpj, setCnpj] = useState<Status>(PARADO);
  const [cep, setCep] = useState<Status>(PARADO);
  const buscados = useRef(new Set<string>());
  // Sair do campo e clicar na lupa disparam juntos: uma busca por vez em cada campo.
  const emCurso = useRef({ cnpj: false, cep: false });

  // "Só ver": os campos estão desligados (fora do FormData); o índice fica com o que está salvo.
  const reler = () => {
    const f = form();
    if (pode && f) setValores(valoresDe(new FormData(f)));
  };
  const digitos = (nome: string) => {
    const el = form()?.elements.namedItem(nome);
    return el instanceof HTMLInputElement ? somenteDigitos(el.value) : '';
  };

  /** Escreve nos campos e avisa o formulário (não salvo, índice). soVazios: a busca de CNPJ não apaga o que já foi escrito (D15). */
  function preencher(campos: Record<string, string | null>, soVazios: boolean): string[] {
    const f = form();
    if (!f) return [];
    const mudou: string[] = [];
    for (const [nome, valor] of Object.entries(campos)) {
      const el = f.elements.namedItem(nome);
      if (!valor || !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement) || el.disabled) continue;
      if (soVazios && el.value.trim()) continue;
      el.value = valor;
      el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
      mudou.push(nome);
    }
    return mudou;
  }

  async function buscarPeloCnpj() {
    if (emCurso.current.cnpj) return;
    emCurso.current.cnpj = true;
    const numero = digitos('cnpj');
    buscados.current.add(numero);
    setCnpj({ buscando: true, mensagem: null });
    const r = await buscarCnpj(numero).catch(() => ({ ok: false as const, motivo: 'indisponivel' as const }));
    emCurso.current.cnpj = false;
    if (!r.ok) {
      setCnpj({ buscando: false, mensagem: mensagemBusca('cnpj', r.motivo) });
      return;
    }
    const d = r.dados;
    const mudou = preencher({
      razao_social: d.razao_social, nome_fantasia: d.nome_fantasia, cnae_principal: d.cnae_principal, cep: d.cep && mascararCEP(d.cep),
      logradouro: d.logradouro, numero: d.numero, complemento: d.complemento, bairro: d.bairro, cidade: d.cidade, uf: d.uf,
    }, true);
    setCnpj({ buscando: false, mensagem: textoPreenchido(mudou) });
    reler();
  }

  async function buscarPeloCep() {
    if (emCurso.current.cep) return;
    emCurso.current.cep = true;
    const numero = digitos('cep');
    buscados.current.add(`cep:${numero}`);
    setCep({ buscando: true, mensagem: null });
    const r = await buscarCep(numero).catch(() => ({ ok: false as const, motivo: 'indisponivel' as const }));
    emCurso.current.cep = false;
    if (!r.ok) {
      setCep({ buscando: false, mensagem: mensagemBusca('cep', r.motivo) });
      return;
    }
    preencher({ logradouro: r.dados.logradouro, bairro: r.dados.bairro, cidade: r.dados.cidade, uf: r.dados.uf }, false);
    setCep({ buscando: false, mensagem: 'Endereço preenchido pelo CEP. Confira o número e o complemento.' });
    reler();
  }

  // Ao sair do campo: só número completo, diferente do salvo e ainda não buscado (D15). A lupa busca sempre.
  const buscaCnpj: Busca = {
    ...cnpj,
    buscar: () => void buscarPeloCnpj(),
    aoSair: () => {
      const n = digitos('cnpj');
      if (n.length === 14 && n !== cliente?.cnpj && validarCnpj(n) && !buscados.current.has(n)) void buscarPeloCnpj();
    },
  };
  const buscaCep: Busca = {
    ...cep,
    buscar: () => void buscarPeloCep(),
    aoSair: () => {
      const n = digitos('cep');
      if (n.length === 8 && n !== (cliente?.cep ?? '') && !buscados.current.has(`cep:${n}`)) void buscarPeloCep();
    },
  };

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio de uma janela (acesso, remover) sobe pela árvore do React até aqui: não é a ficha, e não pode ser barrado.
    if (e.target !== e.currentTarget) return;
    // Envio pela própria tela: o React não limpa os campos, então o erro aparece no campo com tudo o que foi digitado.
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        const r = await salvarFicha(cliente?.id ?? null, dados);
        setEstado(r);
        if (!r.ok) {
          requestAnimationFrame(() => form()?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
          return;
        }
        toast.success('Ficha salva.');
        if (cliente) router.refresh();
        else router.push(`/clientes/${r.id}`);
      } catch (err) {
        unstable_rethrow(err);
        console.error('[ficha do cliente] falha ao salvar', err);
        setEstado({ ok: false, erros: { geral: FALHA } });
      }
    });
  };

  return (
    <div ref={caixa}>
      <FormularioAlteravel onSubmit={enviar} onInput={reler} onChange={reler} className="flex flex-col gap-4"
        aria-label={cliente ? `Ficha de ${cliente.nome_fantasia ?? cliente.razao_social}` : 'Novo cliente'}
        data-ficha-hidratada={hidratado ? '' : undefined}>
        {erros.geral && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft p-3 text-sm text-danger">
            <CircleAlert aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" />
            <span>{erros.geral}</span>
          </p>
        )}
        <div className="flex items-start gap-5">
          <IndiceFicha estados={estados} ocultar={arquivos ? [] : ['arquivos']} />
          {/* Container: os pares de blocos só ficam lado a lado quando a coluna tem largura para os campos (não cabem a 1366). */}
          <div className="@container flex min-w-0 flex-1 flex-col gap-4">
            <BlocoIdentificacao c={cliente} erros={erros} pode={pode} admin={admin} busca={buscaCnpj} />
            <BlocoEndereco c={cliente} erros={erros} pode={pode} busca={buscaCep} />
            <BlocoContato c={cliente} erros={erros} pode={pode} />
            <BlocoFiscal iniciais={inscricoesSt} erro={erros.inscricoes_st} pode={pode} />
            <div className="grid items-start gap-4 @5xl:grid-cols-2">
              <BlocoContrato c={cliente} erros={erros} pode={pode} servicos={servicos} contratados={contratados}
                setorPessoal={setores.find((s) => s.nome === 'Pessoal')?.id ?? null} />
              <BlocoResponsaveis setores={setores} servicos={servicos} contratados={contratados} pessoas={pessoas} responsaveis={responsaveis} pode={pode} />
            </div>
            <div className="grid items-start gap-4 @5xl:grid-cols-2">
              <BlocoCertificado c={cliente} erros={erros} pode={pode} estado={estados.certificado} />
              {acessos}
            </div>
            {arquivos}
          </div>
        </div>
        <RodapeFicha ultima={ultimaAlteracao} pode={pode} novo={!cliente} hidratado={hidratado} enviando={enviando} aoCancelar={aoCancelar} />
      </FormularioAlteravel>
    </div>
  );
}
