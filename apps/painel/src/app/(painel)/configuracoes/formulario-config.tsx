'use client';

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { BotaoDescartar, BotaoSalvar, FormularioAlteravel, IndicadorAlteracoes } from '@/components/patterns/formulario-alteravel';
import type { ButtonProps } from '@/components/ui/button';
import { CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import type { Resultado } from '@/lib/configuracoes';

type Estado = { enviando: boolean; erro: string | null };
const ContextoConfig = createContext<Estado>({ enviando: false, erro: null });

/**
 * Formulário de um cartão de Configurações (spec 7C.4, D21): envia pela ação do servidor sem recarregar a página, avisa o
 * resultado, mantém o que foi digitado se der erro (onSubmit, não <form action>, que o React 19 limpa) e sabe "salvar para
 * sair" (janela de saída). Campo alterado fica âmbar.
 */
export function FormularioConfig({ acao, rotulo, antesDeEnviar, limparAoSalvar = false, className, children }: {
  acao: (dados: FormData) => Promise<Resultado>;
  /** Nome do formulário para o leitor de tela (ex.: "Expediente", "Setor Fiscal"). */
  rotulo: string;
  /** Prazos: mostra o impacto e decide (false cancela; pode acrescentar campos, como aplicar=sim). */
  antesDeEnviar?: (dados: FormData) => Promise<boolean>;
  /** Formulário de criar (novo setor, nova resposta): volta vazio depois de salvar. */
  limparAoSalvar?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [estado, setEstado] = useState<Estado>({ enviando: false, erro: null });
  const emAndamento = useRef(false);
  const enviar = useCallback(async (form: HTMLFormElement): Promise<boolean> => {
    if (emAndamento.current || !form.reportValidity()) return false;
    emAndamento.current = true;
    setEstado({ enviando: true, erro: null });
    try {
      const dados = new FormData(form);
      if (antesDeEnviar && !(await antesDeEnviar(dados))) {
        setEstado({ enviando: false, erro: null });
        return false;
      }
      const r = await acao(dados);
      setEstado({ enviando: false, erro: r.ok ? null : r.erro });
      if (!r.ok) {
        toast.error(r.erro);
        return false;
      }
      toast.success(r.mensagem);
      if (limparAoSalvar) {
        form.reset();
        form.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    } catch {
      const erro = 'Não consegui salvar. Tente de novo.';
      setEstado({ enviando: false, erro });
      toast.error(erro);
      return false;
    } finally {
      emAndamento.current = false;
    }
  }, [acao, antesDeEnviar, limparAoSalvar]);

  return (
    <ContextoConfig.Provider value={estado}>
      <FormularioAlteravel
        marcarAlterados
        aria-label={rotulo}
        className={className}
        onSubmit={(e) => { e.preventDefault(); void enviar(e.currentTarget); }}
        salvarParaSair={enviar}
      >
        {children}
      </FormularioAlteravel>
    </ContextoConfig.Provider>
  );
}

/** Erro do último envio deste cartão (o aviso some ao salvar). */
function ErroConfig() {
  const { erro } = useContext(ContextoConfig);
  return erro ? <p role="alert" className="text-sm text-danger">{erro}</p> : null;
}

/** Botão de salvar do cartão, girando enquanto envia. */
export function SalvarConfig({ children, ...props }: Omit<ButtonProps, 'type' | 'variant'> & { destacar?: boolean }) {
  const { enviando } = useContext(ContextoConfig);
  return <BotaoSalvar size="sm" enviando={enviando} {...props}>{children}</BotaoSalvar>;
}

/** Rodapé do cartão (imagem A): aviso à esquerda, "N alterações não salvas", DESCARTAR e o Salvar do cartão. */
export function RodapeConfig({ salvar = 'Salvar', aviso }: { salvar?: string; aviso?: ReactNode }) {
  return (
    <CardFooter className="flex-wrap items-center justify-end gap-3 border-t border-border">
      {aviso && <p className="mr-auto text-sm text-muted">{aviso}</p>}
      <ErroConfig />
      <IndicadorAlteracoes contar />
      <BotaoDescartar size="sm" />
      <SalvarConfig>{salvar}</SalvarConfig>
    </CardFooter>
  );
}

/** Linha de lista (setor, serviço, resposta pronta): "Não salvo", erro e os dois botões, compactos. */
export function AcoesLinhaConfig({ salvar = 'Salvar', rotulo, descartar }: { salvar?: string; rotulo?: string; descartar?: string }) {
  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      <ErroConfig />
      <IndicadorAlteracoes compacto />
      <BotaoDescartar size="sm" aria-label={descartar} />
      <SalvarConfig destacar aria-label={rotulo}>{salvar}</SalvarConfig>
    </div>
  );
}
