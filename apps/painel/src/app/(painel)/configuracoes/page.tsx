import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { hojeSP, hrefSecao, resumosDasSecoes, secaoDaUrl, secoesDe, type IdSecao } from '@/lib/configuracoes';
import { LIMITES_BATIMENTO, situacaoTeto } from '@/lib/inicio';
import { exigirConfiguracoes } from '@/lib/sessao';
import { situacaoDoSinal } from '@/lib/sinal-vida';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { gastoDoMes } from '../inicio/gasto-do-mes';
import { GuardaSaida } from './guarda-saida';
import { MenuSecoes } from './menu-secoes';
import { SecaoCargos } from './secoes/cargos';
import { SecaoEspera } from './secoes/espera';
import { SecaoExpediente } from './secoes/expediente';
import { SecaoFeriados } from './secoes/feriados';
import { SecaoIa } from './secoes/ia';
import { SecaoIntegracoes } from './secoes/integracoes';
import { SecaoMensagens } from './secoes/mensagens';
import { SecaoPrazos } from './secoes/prazos';
import { SecaoRespostas } from './secoes/respostas';
import { SecaoServicos } from './secoes/servicos';
import { SecaoSetores } from './secoes/setores';

/** Configurações (spec 7C.4): menu por seção à esquerda e uma seção por vez (?secao=). */
export default async function Configuracoes({ searchParams }: { searchParams: Promise<{ secao?: string | string[] }> }) {
  const { secao: pedida } = await searchParams;
  const u = await exigirConfiguracoes();
  // "Configurações: Sim" (P12 da Parte D): teto e modelos de IA, integrações e usuários continuam só do administrador.
  const admin = u.papel === 'admin';
  const secao = secaoDaUrl(pedida, admin);
  // A URL sempre diz o que está na tela (D12): seção pedida que não vale para a pessoa vira Expediente.
  if (pedida !== undefined && (Array.isArray(pedida) ? pedida[0] : pedida) !== secao.id) redirect(hrefSecao(secao.id));
  const sb = await supabaseServidor();
  const agora = new Date();
  const [{ data: cfg }, { data: setores }, { data: servicos }, { data: respostas }, { data: feriados }, { data: sinais }, gasto] = await Promise.all([
    sb.from('configuracoes').select('*').eq('id', 1).single(),
    sb.from('setores').select('*').order('nome'),
    sb.from('servicos').select('*').order('nome'),
    sb.from('respostas_prontas').select('*').order('pergunta'),
    sb.from('feriados').select('*').order('data'),
    admin ? sb.from('sinais_vida').select('*') : Promise.resolve({ data: null }),
    admin ? gastoDoMes(sb, u.id, agora) : Promise.resolve(null),
  ]);
  if (!cfg) throw new Error('Não consegui ler as configurações.');
  const hoje = hojeSP(agora);
  const teto = gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)) : null;
  const sinal = (c: string) => sinais?.find((s) => s.componente === c)?.visto_em ?? null;
  const resumos = resumosDasSecoes({
    cfg: { ...cfg, teto_ia_usd: Number(cfg.teto_ia_usd), cargos: cfg.cargos ?? [] },
    feriados: feriados ?? [], respostas: respostas ?? [], setores: setores ?? [], servicos: servicos ?? [],
    fracaoTeto: teto?.fracao ?? null,
    integracoesOk: admin ? ['whatsapp', 'fila'].every((c) => situacaoDoSinal(sinal(c), agora, LIMITES_BATIMENTO) === 'ok') : null,
    hoje,
  });
  const itens = secoesDe(admin).map((s) => ({ ...s, ...resumos[s.id] }));
  // Só a seção aberta é desenhada; Integrações recarrega a cada minuto só quando é ela que está na tela (D20).
  const conteudo: Record<IdSecao, () => ReactNode> = {
    expediente: () => <SecaoExpediente cfg={cfg} />,
    prazos: () => <SecaoPrazos cfg={cfg} feriados={feriados ?? []} hoje={hoje} admin={admin} agora={agora} />,
    feriados: () => <SecaoFeriados feriados={feriados ?? []} hoje={hoje} />,
    mensagens: () => <SecaoMensagens cfg={cfg} />,
    respostas: () => <SecaoRespostas respostas={respostas ?? []} />,
    espera: () => <SecaoEspera cfg={cfg} />,
    ia: () => <SecaoIa cfg={cfg} teto={teto} parcial={gasto?.parcial ?? false} />,
    setores: () => <SecaoSetores setores={setores ?? []} />,
    servicos: () => <SecaoServicos servicos={servicos ?? []} setores={setores ?? []} />,
    cargos: () => <SecaoCargos cfg={cfg} admin={admin} />,
    integracoes: () => <SecaoIntegracoes sinal={sinal} />,
  };

  return (
    <section>
      <GuardaSaida secao={secao.rotulo} />
      <PageHeader
        titulo={<>Configurações · <span className="font-extrabold text-brand">{secao.rotulo}</span></>}
        descricao="Uma seção por vez. Cada cartão salva sozinho; sair com alteração não salva pede confirmação."
      />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <MenuSecoes itens={itens} atual={secao.id} linkUsuarios={admin} />
        <div className="flex min-w-0 flex-1 flex-col gap-5">{conteudo[secao.id]()}</div>
      </div>
    </section>
  );
}
