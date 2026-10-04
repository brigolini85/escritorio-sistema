import { MINUTOS_SEM_RESPONSAVEL_PADRAO, detalheEsperando, detalheMaisAtrasada, detalheVencemHoje, totaisDosSetores } from '@/lib/inicio';
import { paginaInicio } from './dados-inicio';
import {
  contarSemResponsavelAntigas, lerConfigSituacao, lerDemandasDoDia, lerEsperandoSituacao, lerSetoresSituacao, lerVencemHojeSituacao, lerVencidasSituacao,
} from './dados-situacao';
import { NumeroInicio } from './numero-inicio';

/** Os cinco números da imagem A. Demandas = soma da tabela por setor (D5); sem a migração, "—" (D21). */
export async function NumerosSituacao() {
  const [setores, esperando, vencidas, hoje, doDia, cfg, { agora }] = await Promise.all([
    lerSetoresSituacao(), lerEsperandoSituacao(), lerVencidasSituacao(), lerVencemHojeSituacao(), lerDemandasDoDia(), lerConfigSituacao(), paginaInicio(),
  ]);
  const minutos = cfg?.minutos_alerta_fila ?? MINUTOS_SEM_RESPONSAVEL_PADRAO;
  const antigas = await contarSemResponsavelAntigas(minutos);
  const t = setores ? totaisDosSetores(setores) : null;
  const indisponivel = 'indisponível: falta a atualização do banco';
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <NumeroInicio chave="esperando-pessoa" titulo="Esperando pessoa" valor={esperando?.total ?? null}
        tom={(esperando?.total ?? 0) > 0 ? 'atencao' : 'ok'}
        detalhe={esperando ? detalheEsperando(esperando.linhas[0]?.espera_desde ?? null, agora) : undefined}
        link={{ href: '/atendimento', rotulo: 'Ver no Atendimento' }} />
      <NumeroInicio chave="demandas-abertas" titulo="Demandas abertas" valor={t?.abertas ?? null}
        detalhe={!t ? indisponivel : doDia ? `${doDia.abertasHoje} abertas hoje · ${doDia.doAgente} do agente` : undefined}
        link={{ href: '/demandas', rotulo: 'Ver todas' }} />
      <NumeroInicio chave="vencem-hoje" titulo="Vencem hoje" valor={t?.vencemHoje ?? null} tom={(t?.vencemHoje ?? 0) > 0 ? 'atencao' : 'neutro'}
        detalhe={detalheVencemHoje(hoje ?? []) ?? undefined}
        link={{ href: '/demandas?prazo=hoje', rotulo: 'Ver na lista' }} />
      <NumeroInicio chave="vencidas" titulo="Vencidas" valor={t?.vencidas ?? null} tom={(t?.vencidas ?? 0) > 0 ? 'perigo' : 'neutro'}
        detalhe={detalheMaisAtrasada(vencidas?.[0]?.prazo_em ?? null, agora) ?? undefined}
        link={{ href: '/demandas?vencidas=1', rotulo: 'Ver na lista' }} />
      <NumeroInicio chave="sem-responsavel" titulo="Sem responsável" valor={t?.semResponsavel ?? null}
        tom={(antigas ?? 0) > 0 ? 'perigo' : 'neutro'}
        detalhe={antigas === null ? undefined : `${antigas} há mais de ${minutos} min`}
        link={{ href: '/demandas?responsavel=sem', rotulo: 'Ver na lista' }} />
    </div>
  );
}
