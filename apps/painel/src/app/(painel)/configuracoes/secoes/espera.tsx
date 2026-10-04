import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { salvarLimitesEspera } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

/** Cores do cronômetro de espera do Atendimento (spec 7A.1, P18 da Parte E). Configurações: Sim. */
export function SecaoEspera({ cfg }: { cfg: Config }) {
  return (
    <FormularioConfig acao={salvarLimitesEspera} rotulo="Limites de espera">
      <Cartao id="espera" titulo="Limites de espera" descricao="Cores do cronômetro de espera na lista do Atendimento. Depois do âmbar, vermelho, sempre com os minutos escritos.">
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormField id="espera_verde_min" rotulo="Verde até (minutos)">
              <Input name="espera_verde_min" type="number" step="1" min="1" max="240" required defaultValue={cfg.espera_verde_min} className="tabular" />
            </FormField>
            <Antes campo="espera_verde_min" texto={`${cfg.espera_verde_min} min`} />
          </div>
          <div>
            <FormField id="espera_ambar_min" rotulo="Âmbar até (minutos)" ajuda="Depois disso, vermelho.">
              <Input name="espera_ambar_min" type="number" step="1" min="2" max="480" required defaultValue={cfg.espera_ambar_min} className="tabular" />
            </FormField>
            <Antes campo="espera_ambar_min" texto={`${cfg.espera_ambar_min} min`} />
          </div>
        </CardContent>
        <RodapeConfig salvar="Salvar limites" />
      </Cartao>
    </FormularioConfig>
  );
}
