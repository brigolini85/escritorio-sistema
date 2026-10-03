import { CalendarOff, Clock, ExternalLink, Pause, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { CardContent } from '@/components/ui/card';
import { COLUNA_PRAZO, hrefSecao, inicioExemplo, PRIORIDADES, textoDiasUteis, diaCurto, type ResumoPrazos } from '@/lib/configuracoes';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { salvarPrazos } from '../acoes';
import { Cartao } from '../cartao';
import { FormularioConfig, RodapeConfig } from '../formulario-config';
import type { Config } from '../tipos';
import { TabelaPrazos } from './prazos-tabela';

const LINK = 'font-semibold text-brand underline-offset-4 hover:underline';

/** Prazos por prioridade (spec 6.5 e 7C.4): tabela com exemplo e abertas, como o prazo é contado e quem pode mudá-lo. */
export async function SecaoPrazos({ cfg, feriados, hoje, admin, agora }: {
  cfg: Config; feriados: { data: string; descricao: string }[]; hoje: string; admin: boolean; agora: Date;
}) {
  const sb = await supabaseServidor();
  const inicio = inicioExemplo(agora);
  const [{ data, error }, pessoas] = await Promise.all([
    sb.rpc('prazos_resumo', { p_inicio: inicio }),
    admin
      ? sb.from('usuarios').select('nome, papel, usuario_permissoes(modulo, nivel)').eq('ativo', true).order('nome')
      : Promise.resolve({ data: null }),
  ]);
  // Homologação sem a migração (D25): a tabela continua editável, sem exemplo nem contagem.
  const resumo = error ? null : (data as unknown as ResumoPrazos);
  const linhas = PRIORIDADES.map((p) => ({ prioridade: p, dias: cfg[COLUNA_PRAZO[p]], abertas: resumo ? resumo.abertas[p] ?? 0 : null }));
  const total = resumo ? PRIORIDADES.reduce((n, p) => n + (resumo.abertas[p] ?? 0), 0) : null;
  const podem = (pessoas.data ?? [])
    .filter((u) => u.papel === 'admin' || u.usuario_permissoes.some((x) => x.modulo === 'prazos' && x.nivel === 'sim'))
    .map((u) => u.nome);
  const proximo = feriados.find((f) => f.data >= hoje);

  return (
    <>
      <FormularioConfig acao={salvarPrazos} rotulo="Prazos por prioridade">
        <Cartao id="prazos" titulo="Prazos por prioridade" descricao="Quando a demanda é aberta (pelo agente ou pela equipe), o prazo é calculado em dias úteis a partir destes valores. Quem atende pode mudar o prazo de cada demanda depois.">
          <CardContent className="flex flex-col gap-3">
            {!resumo && (
              <p role="status" className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">
                Exemplo de vencimento e contagem indisponíveis: falta a atualização do banco desta versão.
              </p>
            )}
            <TabelaPrazos linhas={linhas} exemplos={resumo?.exemplos ?? []} inicio={inicio} />
          </CardContent>
          <RodapeConfig
            salvar="Salvar prazos"
            aviso={total === null ? 'Vale para as demandas novas.' : `Vale para as novas. As ${total} abertas mantêm o prazo, a menos que você escolha aplicar.`}
          />
        </Cartao>
      </FormularioConfig>

      <div className="grid gap-5 xl:grid-cols-5">
        <Cartao id="prazo-como" titulo="Como o prazo é contado" className="xl:col-span-3">
          <CardContent>
            <ul className="flex flex-col divide-y divide-border text-base">
              <li className="flex gap-3 py-3">
                <Clock aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>Conta só o <strong className="font-semibold">expediente</strong>: {textoDiasUteis(cfg.dias_uteis)}, {cfg.horario_inicio.slice(0, 5)} às {cfg.horario_fim.slice(0, 5)}. <Link href={hrefSecao('expediente')} className={LINK}>Expediente</Link></p>
              </li>
              <li className="flex gap-3 py-3">
                <CalendarOff aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>Pula os <strong className="font-semibold">feriados cadastrados</strong>. {proximo ? `Próximo: ${diaCurto(`${proximo.data}T12:00:00-03:00`)}, ${proximo.descricao}.` : 'Nenhum à frente.'} <Link href={hrefSecao('feriados')} className={LINK}>Feriados</Link></p>
              </li>
              <li className="flex gap-3 py-3">
                <Pause aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>Status <strong className="font-semibold">Com o cliente</strong> pausa o prazo; ao sair dele, o prazo anda o tempo pausado.</p>
              </li>
              <li className="flex gap-3 py-3">
                <Sparkles aria-hidden size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                <p>O <strong className="font-semibold">agente escolhe a prioridade</strong> ao abrir: assunto sensível ou cobrança repetida = alta; pedido de nota = normal.</p>
              </li>
            </ul>
          </CardContent>
        </Cartao>
        <Cartao id="prazo-quem" titulo="Quem pode mudar o prazo" className="xl:col-span-2">
          <CardContent className="flex flex-col gap-3 text-base">
            <p>Na demanda, só quem tem a permissão <strong className="font-semibold">Alterar prazos de demandas</strong> escolhe a data. A prioridade continua livre para quem atende o setor.</p>
            {admin && (
              <>
                <p className="rounded-md border border-dashed border-border p-3 text-sm">
                  <strong className="font-semibold text-success">{podem.length === 1 ? '1 pessoa' : `${podem.length} pessoas`}</strong> com a permissão: {podem.join(', ') || 'ninguém'}.
                </p>
                <Link href="/usuarios" className={`inline-flex items-center gap-1 ${LINK}`}>Abrir Usuários e permissões <ExternalLink aria-hidden size={14} strokeWidth={1.75} /></Link>
              </>
            )}
          </CardContent>
        </Cartao>
      </div>
    </>
  );
}
