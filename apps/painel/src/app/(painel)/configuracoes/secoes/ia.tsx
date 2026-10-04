import Link from 'next/link';
import { Antes } from '@/components/patterns/formulario-alteravel';
import { FormField } from '@/components/patterns/form-field';
import { CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { nomeModelo } from '@/lib/configuracoes';
import { formatarUSD } from '@/lib/formatos';
import { textoFracaoTeto, type situacaoTeto } from '@/lib/inicio';
import { classeSelect } from '../../clientes/estilos';
import { salvarCotacao, salvarModelos, salvarTetoAlertas } from '../acoes';
import { CampoEmail } from '../campos-validados';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';

type Preco = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };
const LINK = 'text-brand underline underline-offset-4';
/** Decimal do banco na grafia daqui (5,55); vazio quando não configurado. O esquema aceita vírgula ou ponto. */
const decimalBr = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(Number(v)).replace('.', ','));
const preco = (v: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

/** Só o administrador (D8): teto e alertas, modelos e cotação, cada um com seu Salvar (pendência 17). */
export function SecaoIa({ cfg, teto, parcial }: { cfg: Config; teto: ReturnType<typeof situacaoTeto> | null; parcial: boolean }) {
  const precos = (cfg.precos_modelos ?? {}) as Record<string, Preco>;
  const modelos = Object.keys(precos);
  const opcoes = (atual: string) => [...new Set([...modelos, atual])].map((m) => (
    <option key={m} value={m}>{nomeModelo(m)}{precos[m] ? '' : ' (sem preço)'}</option>
  ));
  return (
    <>
      <FormularioConfig acao={salvarTetoAlertas} rotulo="Teto de IA e alertas">
        <Cartao id="teto-ia" titulo="Teto de IA e alertas" descricao="Ao chegar no teto do mês, o agente para de responder e as conversas vão para a equipe.">
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <FormField
                id="teto_ia_usd"
                rotulo="Teto mensal de gasto com IA (US$)"
                ajuda={<>{teto && `Gasto neste mês: ${formatarUSD(teto.gasto)} (${textoFracaoTeto(teto.fracao)}${Number.isFinite(teto.fracao) ? ' do teto' : ''})${parcial ? ', valor parcial' : ''}. `}<Link href="/gastos-ia" className={LINK}>Ver gastos com IA</Link></>}
              >
                <Input name="teto_ia_usd" type="number" step="1" min="1" required defaultValue={Number(cfg.teto_ia_usd)} className="tabular sm:w-40" />
              </FormField>
              <Antes campo="teto_ia_usd" texto={formatarUSD(Number(cfg.teto_ia_usd))} />
            </div>
            <div>
              <FormField id="minutos_alerta_fila" rotulo="Demanda sem responsável: avisar após (minutos)">
                <Input name="minutos_alerta_fila" type="number" step="1" min="5" required defaultValue={cfg.minutos_alerta_fila} className="tabular sm:w-40" />
              </FormField>
              <Antes campo="minutos_alerta_fila" texto={`${cfg.minutos_alerta_fila} min`} />
            </div>
            <div>
              <FormField id="email_alertas" rotulo="E-mail para alertas">
                <CampoEmail name="email_alertas" defaultValue={cfg.email_alertas ?? ''} />
              </FormField>
              <Antes campo="email_alertas" texto={cfg.email_alertas || '(vazio)'} />
            </div>
            <div>
              <FormField id="telefone_dono" rotulo="Seu WhatsApp (recebe avisos e o resumo diário)">
                <Input name="telefone_dono" inputMode="tel" defaultValue={cfg.telefone_dono ?? ''} />
              </FormField>
              <Antes campo="telefone_dono" texto={cfg.telefone_dono || '(vazio)'} />
            </div>
          </CardContent>
          <RodapeConfig salvar="Salvar teto e alertas" />
        </Cartao>
      </FormularioConfig>

      <div className="grid gap-5 xl:grid-cols-2">
        <FormularioConfig acao={salvarModelos} rotulo="Modelos de IA">
          <Cartao id="modelos-ia" titulo="Modelos de IA" descricao="Qual modelo o agente usa em cada tipo de trabalho. Preço por milhão de tokens, em US$.">
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FormField id="modelo_conversa" rotulo="Conversas com clientes" ajuda="Respostas e decisões do agente, do assistente e da sugestão.">
                    <select name="modelo_conversa" defaultValue={cfg.modelo_conversa} className={classeSelect}>{opcoes(cfg.modelo_conversa)}</select>
                  </FormField>
                  <Antes campo="modelo_conversa" texto={nomeModelo(cfg.modelo_conversa)} />
                </div>
                <div>
                  <FormField id="modelo_rapido" rotulo="Tarefas rápidas" ajuda="Classificar e resumir.">
                    <select name="modelo_rapido" defaultValue={cfg.modelo_rapido} className={classeSelect}>{opcoes(cfg.modelo_rapido)}</select>
                  </FormField>
                  <Antes campo="modelo_rapido" texto={nomeModelo(cfg.modelo_rapido)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Preço por milhão de tokens, em US$</caption>
                  <thead>
                    <tr className="text-xs font-extrabold uppercase tracking-wide text-muted">
                      <th scope="col" className="pb-2 text-left">Modelo</th>
                      <th scope="col" className="pb-2 text-right">Entrada</th>
                      <th scope="col" className="pb-2 text-right">Saída</th>
                      <th scope="col" className="pb-2 text-right">Cache leitura</th>
                      <th scope="col" className="pb-2 text-right">Cache escrita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelos.map((m) => (
                      <tr key={m} className="border-t border-border">
                        <th scope="row" className="py-2 text-left font-semibold">{nomeModelo(m)}</th>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.entrada)}</td>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.saida)}</td>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.cacheLeitura)}</td>
                        <td className="tabular py-2 text-right">{preco(precos[m]!.cacheEscrita)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <RodapeConfig salvar="Salvar modelos" />
          </Cartao>
        </FormularioConfig>

        <FormularioConfig acao={salvarCotacao} rotulo="Cotação e custo da transcrição">
          <Cartao id="cotacao" titulo="Cotação e custo da transcrição" descricao="Valores digitados por você. Nada é buscado na internet.">
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <FormField id="cotacao_usd_brl" rotulo="Cotação do dólar (R$ por US$ 1)" ajuda="Só para mostrar os gastos em reais. Vazio: tudo em US$.">
                  <Input name="cotacao_usd_brl" inputMode="decimal" defaultValue={decimalBr(cfg.cotacao_usd_brl)} className="tabular sm:w-40" />
                </FormField>
                <Antes campo="cotacao_usd_brl" texto={decimalBr(cfg.cotacao_usd_brl) || '(vazio)'} />
              </div>
              <div>
                <FormField id="custo_minuto_transcricao_usd" rotulo="Custo por minuto da transcrição de áudio (US$)" ajuda="Veja no painel do fornecedor (Groq). Vazio: a transcrição fica sem custo em Gastos com IA.">
                  <Input name="custo_minuto_transcricao_usd" inputMode="decimal" defaultValue={decimalBr(cfg.custo_minuto_transcricao_usd)} className="tabular sm:w-40" />
                </FormField>
                <Antes campo="custo_minuto_transcricao_usd" texto={decimalBr(cfg.custo_minuto_transcricao_usd) || '(vazio)'} />
              </div>
            </CardContent>
            <RodapeConfig salvar="Salvar valores" />
          </Cartao>
        </FormularioConfig>
      </div>
    </>
  );
}
