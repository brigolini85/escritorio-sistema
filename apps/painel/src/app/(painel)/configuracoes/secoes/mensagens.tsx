import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { salvarAvisoLogin, salvarMensagens } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

const MENSAGENS = [
  { chave: 'aviso_lgpd', rotulo: 'Aviso de privacidade (primeiro contato)' },
  { chave: 'fora_do_horario', rotulo: 'Fora do horário', ajuda: '{inicio} e {fim} viram os horários do expediente.' },
  { chave: 'ia_indisponivel', rotulo: 'IA indisponível' },
];
const resumir = (t: string) => (t.length > 70 ? `${t.slice(0, 70).trimEnd()}…` : t || '(vazio)');

/** Mensagens automáticas ao cliente e o aviso da tela de entrada (spec 7C.4 e 4.4). Configurações: Sim. */
export function SecaoMensagens({ cfg }: { cfg: Config }) {
  const mensagens = (cfg.mensagens ?? {}) as Record<string, string>;
  return (
    <>
      <FormularioConfig acao={salvarMensagens} rotulo="Mensagens automáticas">
        <Cartao id="mensagens" titulo="Mensagens automáticas" descricao="O que o agente manda sozinho ao cliente nestas situações.">
          <CardContent className="flex flex-col gap-4">
            {MENSAGENS.map((m) => (
              <div key={m.chave}>
                <FormField id={`mensagem-${m.chave}`} rotulo={m.rotulo} ajuda={m.ajuda}>
                  <Textarea name={m.chave} defaultValue={mensagens[m.chave] ?? ''} rows={2} className="min-h-16" />
                </FormField>
                <Antes campo={m.chave} texto={resumir(mensagens[m.chave] ?? '')} />
              </div>
            ))}
          </CardContent>
          <RodapeConfig salvar="Salvar mensagens" />
        </Cartao>
      </FormularioConfig>
      <FormularioConfig acao={salvarAvisoLogin} rotulo="Aviso na tela de entrada">
        <Cartao id="aviso-login" titulo="Aviso na tela de entrada" descricao="Um recado curto que a equipe lê antes de entrar no painel. Vazio não mostra nada.">
          <CardContent>
            <FormField id="aviso_login" rotulo="Aviso na tela de entrada" ajuda="Até 200 caracteres. Nunca coloque dados de clientes.">
              <Textarea name="aviso_login" maxLength={200} rows={2} defaultValue={cfg.aviso_login ?? ''} />
            </FormField>
            <Antes campo="aviso_login" texto={resumir(cfg.aviso_login ?? '')} />
          </CardContent>
          <RodapeConfig salvar="Salvar aviso" />
        </Cartao>
      </FormularioConfig>
    </>
  );
}
