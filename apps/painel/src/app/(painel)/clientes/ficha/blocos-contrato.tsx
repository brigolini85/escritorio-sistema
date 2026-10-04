'use client';

import { FormField } from '@/components/patterns/form-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import { classeSelect } from '../estilos';
import { BlocoFicha, CampoDinheiro, Caixa, classeLegenda } from './campos';
import {
  AVISAR_DIAS, dinheiroNoCampo, OPCOES_REAJUSTE, separarSetores, TIPOS_CERTIFICADO, valorReajuste,
  type ClienteFicha, type ErrosFicha, type EstadoBloco,
} from './ficha';

type Servico = { id: string; nome: string; setor_id: string | null };
type Setor = { id: string; nome: string };

export function BlocoContrato({ c, erros, pode, servicos, contratados, setorPessoal }: {
  c: ClienteFicha | null; erros: ErrosFicha; pode: boolean; servicos: Servico[]; contratados: string[]; setorPessoal: string | null;
}) {
  const marcados = new Set(contratados);
  const decimo = c?.decimo_terceiro == null ? '' : c.decimo_terceiro ? 'sim' : 'nao';
  return (
    <BlocoFicha id="contrato" titulo="Contrato e honorários" pode={pode}>
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
        <FormField id="ficha-contrato-inicio" rotulo="Início do contrato" obrigatorio erro={erros.contrato_inicio}>
          <Input type="date" name="contrato_inicio" required={false} aria-required defaultValue={c?.contrato_inicio ?? ''} />
        </FormField>
        <FormField id="ficha-honorario" rotulo="Honorário mensal" obrigatorio erro={erros.honorario_mensal}>
          <CampoDinheiro name="honorario_mensal" required={false} aria-required defaultValue={dinheiroNoCampo(c?.honorario_mensal ?? null)} />
        </FormField>
        <FormField id="ficha-dia-vencimento" rotulo="Dia de vencimento" erro={erros.dia_vencimento}>
          <Input name="dia_vencimento" inputMode="numeric" defaultValue={c?.dia_vencimento ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-reajuste" rotulo="Reajuste" erro={erros.reajuste}>
          <select name="reajuste" defaultValue={valorReajuste(c?.reajuste ?? null, c?.reajuste_mes ?? null)} className={classeSelect}>
            <option value="">Não informado</option>
            {OPCOES_REAJUSTE.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-decimo" rotulo="13º honorário">
          <select name="decimo_terceiro" defaultValue={decimo} className={classeSelect}>
            <option value="">Não informado</option>
            <option value="nao">Não</option>
            <option value="sim">Sim, em dezembro</option>
          </select>
        </FormField>
        <FormField id="ficha-contrato-fim" rotulo="Fim do contrato" ajuda="Vazio: em vigor." erro={erros.contrato_fim}>
          <Input type="date" name="contrato_fim" defaultValue={c?.contrato_fim ?? ''} />
        </FormField>
      </div>
      <fieldset className="mt-4">
        <legend className={classeLegenda}>Serviços contratados</legend>
        {servicos.length === 0 ? <p className="text-sm text-muted">Nenhum serviço ativo. Cadastre em Configurações.</p> : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {servicos.map((s) => (
              <Caixa key={s.id} name="servico" value={s.id} defaultChecked={marcados.has(s.id)}
                rotulo={s.setor_id && s.setor_id === setorPessoal && c?.funcionarios ? `${s.nome} (${c.funcionarios} func.)` : s.nome} />
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-muted">O agente usa esta lista: assunto fora dela vira demanda marcada &quot;Fora do contrato&quot;.</p>
      </fieldset>
    </BlocoFicha>
  );
}

export function BlocoResponsaveis({ setores, servicos, contratados, pessoas, responsaveis, pode }: {
  setores: Setor[]; servicos: Servico[]; contratados: string[]; pessoas: { id: string; nome: string }[];
  responsaveis: Record<string, string>; pode: boolean;
}) {
  const { principais, outros } = separarSetores(setores, servicos, contratados, responsaveis);
  const linha = (s: Setor) => (
    <div key={s.id} className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 first:border-t-0">
      <label htmlFor={`resp-${s.id}`} className="text-sm font-bold text-foreground">
        <span className="sr-only">Responsável pelo setor </span>{s.nome}
      </label>
      <select id={`resp-${s.id}`} name={`responsavel:${s.id}`} defaultValue={responsaveis[s.id] ?? ''} className={cn(classeSelect, 'max-w-56')}>
        <option value="">Fila do setor</option>
        {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
      </select>
    </div>
  );
  return (
    <BlocoFicha id="responsaveis" titulo="Responsáveis por setor" pode={pode} aside="sem responsável, a demanda cai na fila do setor">
      <div className="rounded-md border border-border">{principais.map(linha)}</div>
      {outros.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold text-brand">Outros setores ({outros.length})</summary>
          {/* Recolhido, mas no formulário: salvar não apaga o responsável de um setor escondido (D16). */}
          <div className="mt-2 rounded-md border border-border">{outros.map(linha)}</div>
        </details>
      )}
    </BlocoFicha>
  );
}

export function BlocoCertificado({ c, erros, pode, estado }: { c: ClienteFicha | null; erros: ErrosFicha; pode: boolean; estado: EstadoBloco }) {
  const dias = [...new Set<number>([...AVISAR_DIAS, c?.certificado_avisar_dias ?? 30])].sort((a, b) => a - b);
  const aviso = estado.tipo === 'vence'
    ? <span className="font-bold text-warning">{estado.dias === 0 ? 'vence hoje' : `vence em ${estado.dias} ${estado.dias === 1 ? 'dia' : 'dias'}`}</span>
    : estado.tipo === 'vencido'
      ? <span className="font-bold text-danger">vencido há {estado.dias} {estado.dias === 1 ? 'dia' : 'dias'}</span>
      : undefined;
  return (
    <BlocoFicha id="certificado" titulo="Certificado digital" pode={pode} aside={aviso} destaque={estado.tipo === 'vence' || estado.tipo === 'vencido'}>
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-3">
        <FormField id="ficha-cert-tipo" rotulo="Tipo" erro={erros.certificado_tipo}>
          <select name="certificado_tipo" defaultValue={c?.certificado_tipo ?? ''} className={classeSelect}>
            <option value="">Escolha o tipo</option>
            {TIPOS_CERTIFICADO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-cert-vencimento" rotulo="Vencimento" obrigatorio erro={erros.certificado_vencimento}>
          <Input type="date" name="certificado_vencimento" required={false} aria-required defaultValue={c?.certificado_vencimento ?? ''} />
        </FormField>
        <FormField id="ficha-cert-avisar" rotulo="Avisar antes">
          <select name="certificado_avisar_dias" defaultValue={String(c?.certificado_avisar_dias ?? 30)} className={classeSelect}>
            {dias.map((d) => <option key={d} value={d}>{d} dias</option>)}
          </select>
        </FormField>
      </div>
      <p className="mt-3 text-xs text-muted">O aviso vira uma demanda automática para o responsável do Fiscal e aparece no Início.</p>
    </BlocoFicha>
  );
}
