'use client';

import { unstable_rethrow } from 'next/navigation';
import { createContext, useContext, useId, useRef, useState, useTransition, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { toast } from '@/components/ui/toaster';
import { marcacoesDoVinculo, TEXTO_LGPD, type ConsultaContatoArquivado } from '@/lib/contato-arquivado';
import { consultarContatoArquivado } from '@/lib/contato-arquivado-acoes';
import { ConfirmDialog } from './confirm-dialog';
import { BotaoSalvar } from './formulario-alteravel';

type Pergunta = Extract<ConsultaContatoArquivado, { situacao: 'arquivado' }>;
const FALHA = 'Não consegui conferir o telefone agora. Tente de novo.';

/** Diz aos botões do formulário que o telefone está sendo conferido (o botão vem de páginas de servidor, como filho). */
export const ContextoCadastroContato = createContext({ verificando: false });

/** Botão de enviar do cadastro de contato: trava e mostra o ícone girando enquanto o telefone é conferido. */
export function BotaoCadastrarContato(props: Omit<ComponentProps<typeof BotaoSalvar>, 'enviando'>) {
  return <BotaoSalvar {...props} enviando={useContext(ContextoCadastroContato).verificando} />;
}

/**
 * Formulário que cadastra contato (aba Contatos, ficha da empresa e conversa). Antes de enviar, confere se o telefone
 * é de um contato arquivado com empresas de antes; se for, pergunta quais voltam (nenhuma marcada) e manda as
 * marcadas no campo "manter" do mesmo formulário. Sem nada a perguntar, envia como sempre.
 */
export function FormCadastroContato({ action, clienteId, conversaId, className, children }: {
  action: (dados: FormData) => void | Promise<void>;
  /** Empresa da ficha (sempre entra). Na conversa, vem do campo cliente_id do formulário. */
  clienteId?: string;
  /** Na conversa, o telefone é o da conversa. */
  conversaId?: string;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  const [pergunta, setPergunta] = useState<Pergunta | null>(null);
  const [aberto, setAberto] = useState(false);
  const seguir = useRef(false);
  // Conferir o telefone pode demorar: o pending trava o botão e barra o segundo envio.
  const [verificando, iniciar] = useTransition();

  const aoEnviar = (e: FormEvent<HTMLFormElement>) => {
    // Envio que já passou pela conferência (ou o "Trazer de volta" da janela): segue para a ação.
    if (seguir.current || aberto) {
      seguir.current = false;
      return;
    }
    e.preventDefault();
    if (verificando) return;
    const form = e.currentTarget;
    const dados = new FormData(form);
    iniciar(async () => {
      try {
        const r = await consultarContatoArquivado({
          telefone: conversaId ? undefined : String(dados.get('telefone') ?? ''),
          conversaId,
          clienteId: clienteId ?? (String(dados.get('cliente_id') ?? '') || null),
        });
        if (r.situacao === 'anonimizado') { toast.error(TEXTO_LGPD); return; }
        if (r.situacao === 'erro') { toast.error(r.erro); return; }
        if (r.situacao === 'arquivado' && r.vinculos.length > 0) {
          setPergunta(r);
          setAberto(true);
          return;
        }
        seguir.current = true;
        form.requestSubmit();
      } catch (err) {
        unstable_rethrow(err);
        console.error('[contatos] falha ao conferir o telefone', err);
        toast.error(FALHA);
      }
    });
  };

  return (
    <>
      <form id={id} action={action} onSubmit={aoEnviar} className={className}>
        <ContextoCadastroContato.Provider value={{ verificando }}>{children}</ContextoCadastroContato.Provider>
      </form>
      {pergunta && (
        <ConfirmDialog
          aberto={aberto}
          aoMudarAberto={setAberto}
          formulario={id}
          tipo="neutro"
          variante="primary"
          titulo={<>Trazer <strong className="font-extrabold">{pergunta.nome}</strong> de volta?</>}
          descricao={pergunta.empresaNova
            ? `Estava arquivado. ${pergunta.empresaNova} entra com as marcações escolhidas agora. Marque as empresas de antes que voltam.`
            : 'Estava arquivado. Marque as empresas de antes que voltam.'}
          confirmar="Trazer de volta"
        >
          <fieldset className="flex flex-col gap-2 text-left">
            <legend className="sr-only">Empresas de antes</legend>
            {pergunta.vinculos.map((v) => (
              <label key={v.clienteId} className="flex items-start gap-2 rounded-md border border-border p-3 text-base text-foreground">
                {/* form=: a caixa fica na janela, mas é campo do formulário de cadastro. */}
                <input type="checkbox" name="manter" value={v.clienteId} form={id} className="mt-1 size-4 shrink-0 accent-brand" />
                <span>
                  <span className="font-medium">{v.empresa}</span>
                  <span className="block text-sm text-muted">{marcacoesDoVinculo(v)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </ConfirmDialog>
      )}
    </>
  );
}
