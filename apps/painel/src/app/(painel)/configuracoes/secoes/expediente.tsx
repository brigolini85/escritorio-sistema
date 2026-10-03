import { Antes } from '@/components/patterns/formulario-alteravel';
import { CardContent } from '@/components/ui/card';
import { textoDiasUteis } from '@/lib/configuracoes';
import { classeCaixa } from '../../clientes/estilos';
import { salvarExpediente } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import { HorarioExpediente } from '../horario-expediente';
import type { Config } from '../tipos';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_EXTENSO = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/** Expediente (Configurações: Sim). Separado do teto de IA desde a Parte D (pendência 17). */
export function SecaoExpediente({ cfg }: { cfg: Pick<Config, 'horario_inicio' | 'horario_fim' | 'dias_uteis'> }) {
  const inicio = cfg.horario_inicio.slice(0, 5);
  const fim = cfg.horario_fim.slice(0, 5);
  return (
    <FormularioConfig acao={salvarExpediente} rotulo="Expediente">
      <Cartao id="expediente" titulo="Expediente" descricao="Horário e dias em que o escritório atende. Os feriados cadastrados contam como fora do expediente.">
        <CardContent className="flex flex-col gap-4">
          <HorarioExpediente
            inicio={inicio}
            fim={fim}
            antesInicio={<Antes campo="horario_inicio" texto={inicio} />}
            antesFim={<Antes campo="horario_fim" texto={fim} />}
          />
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-foreground">Dias úteis</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS.map((d, i) => (
                <label
                  key={d}
                  className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-input bg-surface px-3 text-base text-foreground has-checked:border-brand has-checked:bg-brand-soft"
                >
                  <input type="checkbox" name="dia" value={i} defaultChecked={cfg.dias_uteis.includes(i)} aria-label={DIAS_EXTENSO[i]} className={classeCaixa} />
                  <span aria-hidden>{d}</span>
                </label>
              ))}
            </div>
            <Antes campo="dia" texto={textoDiasUteis(cfg.dias_uteis)} />
          </fieldset>
        </CardContent>
        <RodapeConfig salvar="Salvar expediente" aviso={'Usado pelo agente ("fora do horário") e no cálculo dos prazos das demandas.'} />
      </Cartao>
    </FormularioConfig>
  );
}
