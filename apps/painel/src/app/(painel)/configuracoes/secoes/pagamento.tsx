import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { salvarDadosPagamento } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

const CAMPOS = [
  { chave: 'pix', rotulo: 'Chave Pix' },
  { chave: 'favorecido', rotulo: 'Favorecido' },
  { chave: 'banco', rotulo: 'Banco' },
  { chave: 'agencia', rotulo: 'Agência' },
  { chave: 'conta', rotulo: 'Conta' },
] as const;

/**
 * Dados de pagamento do escritório (auditoria 5.1, D3): a única fonte de Pix e dados bancários que o agente informa ao
 * cliente. Só o administrador (com o segundo fator); cada mudança avisa o dono.
 */
export function SecaoPagamento({ cfg }: { cfg: Config }) {
  const dados = (cfg.dados_pagamento ?? {}) as Record<string, string>;
  return (
    <FormularioConfig acao={salvarDadosPagamento} rotulo="Dados de pagamento do escritório">
      <Cartao
        id="dados-pagamento"
        titulo="Dados de pagamento do escritório"
        descricao="O que o agente informa quando o cliente pergunta como pagar o escritório. Vazio: ele diz que vai confirmar com a equipe."
      >
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {CAMPOS.map((c) => (
            <div key={c.chave}>
              <FormField id={`pagamento-${c.chave}`} rotulo={c.rotulo}>
                <Input name={c.chave} maxLength={120} defaultValue={dados[c.chave] ?? ''} autoComplete="off" />
              </FormField>
              <Antes campo={c.chave} texto={dados[c.chave] || '(vazio)'} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <FormField id="pagamento-observacao" rotulo="Observação" ajuda="Ex.: mandar o comprovante pelo WhatsApp. Até 500 caracteres.">
              <Textarea name="observacao" maxLength={500} rows={2} defaultValue={dados.observacao ?? ''} />
            </FormField>
            <Antes campo="observacao" texto={dados.observacao || '(vazio)'} />
          </div>
        </CardContent>
        <RodapeConfig salvar="Salvar dados de pagamento" aviso="O agente só informa estes dados; orientação não muda isso" />
      </Cartao>
    </FormularioConfig>
  );
}
