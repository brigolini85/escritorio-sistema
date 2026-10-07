'use client';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cadastrarAplicativo, prepararCadastro, type CadastroPreparado } from './acoes';
import { FormularioCodigo } from './formulario-codigo';

/** O segredo em grupos de 4 letras, para digitar no aplicativo sem a câmera. */
const emGrupos = (segredo: string) => segredo.replace(/(.{4})/g, '$1 ').trim();

/** Primeiro login com o segundo fator: o QR code fica guardado aqui (não muda se a tela recarregar). */
export function CadastroAplicativo({ depois }: { depois?: string }) {
  const [cadastro, setCadastro] = useState<CadastroPreparado | null>(null);
  const [preparando, iniciar] = useTransition();
  if (!cadastro?.ok) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted">
          Seu acesso pede um segundo passo. Instale no celular um aplicativo autenticador (Google Authenticator, Microsoft
          Authenticator ou outro) e toque no botão abaixo.
        </p>
        {cadastro && !cadastro.ok && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{cadastro.erro}</p>
        )}
        <Button type="button" disabled={preparando} onClick={() => iniciar(async () => setCadastro(await prepararCadastro()))}>
          Mostrar o QR code
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted">No aplicativo, toque em adicionar e aponte a câmera para o código abaixo.</p>
      {/* QR code gerado pelo Supabase (imagem em data:, liberada na CSP). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cadastro.qr} alt="QR code para cadastrar o painel no aplicativo autenticador" width={200} height={200} className="self-center rounded-md bg-white p-2" />
      <p className="text-sm text-muted">
        Sem câmera? Digite esta chave no aplicativo:{' '}
        <code data-testid="segredo-totp" className="break-all font-mono text-foreground">{emGrupos(cadastro.segredo)}</code>
      </p>
      <p className="text-muted">Depois, digite o código de 6 números que o aplicativo mostra.</p>
      <FormularioCodigo acao={cadastrarAplicativo} fator={cadastro.fator} depois={depois} rotulo="Ativar e entrar" />
    </div>
  );
}
