import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { situacaoTeto } from '@/lib/inicio';
import { hojeSP } from '@/lib/configuracoes';
import { exigirConfiguracoes } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { gastoDoMes } from '../inicio/gasto-do-mes';
import { NavegacaoSecoes, type SecaoConfiguracao } from './navegacao-secoes';
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

const SECOES: SecaoConfiguracao[] = [
  { id: 'expediente', rotulo: 'Expediente' },
  { id: 'prazos', rotulo: 'Prazos' },
  { id: 'espera', rotulo: 'Limites de espera' },
  { id: 'teto-ia', rotulo: 'Teto de IA' },
  { id: 'mensagens', rotulo: 'Mensagens automáticas' },
  { id: 'setores', rotulo: 'Setores' },
  { id: 'servicos', rotulo: 'Serviços' },
  { id: 'cargos', rotulo: 'Cargos' },
  { id: 'respostas', rotulo: 'Respostas prontas' },
  { id: 'feriados', rotulo: 'Feriados' },
  { id: 'integracoes', rotulo: 'Integrações' },
];

export default async function Configuracoes() {
  const u = await exigirConfiguracoes();
  // "Configurações: Sim" (P12): teto de IA, alertas, integrações e usuários continuam só do administrador.
  const admin = u.papel === 'admin';
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
  const sinal = (c: string) => sinais?.find((s) => s.componente === c)?.visto_em ?? null;
  const teto = cfg && gasto ? situacaoTeto(gasto.total, Number(cfg.teto_ia_usd)) : null;

  return (
    <section>
      <PageHeader
        titulo="Configurações"
        descricao={admin ? <>Usuários e permissões ficam na aba <Link href="/usuarios" className="text-brand underline underline-offset-4">Usuários</Link>.</> : undefined}
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <NavegacaoSecoes secoes={admin ? SECOES : SECOES.filter((s) => s.id !== 'teto-ia' && s.id !== 'integracoes')} />

        <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-6">
          {/* Expediente e Teto de IA são formulários separados (Parte D): o teto e os alertas são só do administrador. */}
          <SecaoExpediente cfg={cfg} />

          {admin && <SecaoIa cfg={cfg} teto={teto} parcial={gasto?.parcial ?? false} />}

          <SecaoPrazos cfg={cfg} feriados={feriados ?? []} hoje={hoje} admin={admin} agora={agora} />

          <SecaoEspera cfg={cfg} />

          <SecaoMensagens cfg={cfg} />

          <SecaoSetores setores={setores ?? []} />

          <SecaoServicos servicos={servicos ?? []} setores={setores ?? []} />

          <SecaoCargos cfg={cfg} admin={admin} />

          <SecaoRespostas respostas={respostas ?? []} />

          <SecaoFeriados feriados={feriados ?? []} hoje={hoje} />

          {/* Integrações recarrega a cada minuto só aqui (D20): os campos digitados das outras seções continuam. */}
          {admin && <SecaoIntegracoes sinal={sinal} />}
        </div>
      </div>
    </section>
  );
}
