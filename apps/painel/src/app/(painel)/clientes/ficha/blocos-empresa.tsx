'use client';

import { useState } from 'react';
import { FormField } from '@/components/patterns/form-field';
import { Input } from '@/components/ui/input';
import { mascararCEP, mascararCNPJ, mascararTelefone } from '@/lib/formatos';
import { classeSelect } from '../estilos';
import { BlocoFicha, CampoComLupa, CampoDinheiro, Caixa, classeLegenda } from './campos';
import { dinheiroNoCampo, opcoesRegime, PORTES, SEGMENTOS, UFS, type ClienteFicha, type ErrosFicha } from './ficha';

export type Busca = { buscando: boolean; mensagem: string | null; buscar: () => void; aoSair: () => void };
type Props = { c: ClienteFicha | null; erros: ErrosFicha; pode: boolean };

export function BlocoIdentificacao({ c, erros, pode, admin, busca }: Props & { admin: boolean; busca: Busca }) {
  const [isento, setIsento] = useState(c?.isento_ie ?? false);
  const segmentos = new Set(c?.segmentos ?? []);
  return (
    <BlocoFicha id="identificacao" titulo="Identificação" pode={pode} aside="busca automática pelo CNPJ preenche razão social, CNAE e endereço">
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-4">
        <FormField id="ficha-cnpj" rotulo="CNPJ" obrigatorio erro={erros.cnpj}>
          <CampoComLupa name="cnpj" defaultValue={c ? mascararCNPJ(c.cnpj) : ''} inputMode="numeric" autoComplete="off" placeholder="00.000.000/0000-00"
            rotuloLupa="Buscar dados públicos da empresa" mostrarLupa={pode} buscando={busca.buscando} aoBuscar={busca.buscar} onBlur={busca.aoSair} />
        </FormField>
        <FormField id="ficha-razao" rotulo="Razão social" obrigatorio erro={erros.razao_social}>
          <Input name="razao_social" defaultValue={c?.razao_social ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-fantasia" rotulo="Nome fantasia" erro={erros.nome_fantasia}>
          <Input name="nome_fantasia" defaultValue={c?.nome_fantasia ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-tipo-pessoa" rotulo="Tipo de pessoa" ajuda="Pessoa jurídica (CNPJ).">
          <Input defaultValue="Jurídica" readOnly className="bg-surface-muted text-muted" />
        </FormField>
        <div className="flex flex-col gap-1.5">
          <FormField id="ficha-ie" rotulo="Inscrição estadual" erro={erros.inscricao_estadual}>
            <Input name="inscricao_estadual" defaultValue={c?.inscricao_estadual ?? ''} disabled={isento} placeholder={isento ? 'isento' : undefined} autoComplete="off" />
          </FormField>
          <Caixa name="isento_ie" rotulo="Isento" defaultChecked={c?.isento_ie ?? false} onChange={(e) => setIsento(e.currentTarget.checked)} />
        </div>
        <FormField id="ficha-im" rotulo="Inscrição municipal" erro={erros.inscricao_municipal}>
          <Input name="inscricao_municipal" defaultValue={c?.inscricao_municipal ?? ''} placeholder="não informada" autoComplete="off" />
        </FormField>
        <FormField id="ficha-cnae" rotulo="CNAE principal" erro={erros.cnae_principal}>
          <Input name="cnae_principal" defaultValue={c?.cnae_principal ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-suframa" rotulo="Inscrição Suframa" erro={erros.inscricao_suframa}>
          <Input name="inscricao_suframa" defaultValue={c?.inscricao_suframa ?? ''} placeholder="—" autoComplete="off" />
        </FormField>
        <FormField id="ficha-regime" rotulo="Regime tributário" obrigatorio erro={erros.regime}>
          <select name="regime" defaultValue={c?.regime ?? ''} required={false} aria-required className={classeSelect}>
            <option value="">Escolha o regime</option>
            {opcoesRegime(c?.regime ?? null).map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-porte" rotulo="Porte" erro={erros.porte}>
          <select name="porte" defaultValue={c?.porte ?? ''} className={classeSelect}>
            <option value="">Não informado</option>
            {PORTES.map((p) => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
        </FormField>
        <FormField id="ficha-faturamento" rotulo="Faturamento do último ano" erro={erros.faturamento_ultimo_ano}>
          <CampoDinheiro name="faturamento_ultimo_ano" defaultValue={dinheiroNoCampo(c?.faturamento_ultimo_ano ?? null)} />
        </FormField>
        <FormField id="ficha-funcionarios" rotulo="Funcionários" erro={erros.funcionarios}>
          <Input name="funcionarios" inputMode="numeric" defaultValue={c?.funcionarios ?? ''} autoComplete="off" />
        </FormField>
        <fieldset className="md:col-span-2 xl:col-span-4">
          <legend className={classeLegenda}>Segmento <span aria-hidden className="text-danger">*</span><span className="sr-only"> (obrigatório)</span></legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SEGMENTOS.map((s) => <Caixa key={s.valor} name="segmentos" value={s.valor} rotulo={s.rotulo} defaultChecked={segmentos.has(s.valor)} />)}
          </div>
        </fieldset>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-muted">{busca.mensagem}</p>
      {admin && (
        <div className="mt-3 border-t border-border pt-3">
          <Caixa name="agente_pausado" rotulo="Pausar o agente para este cliente" defaultChecked={c?.agente_pausado ?? false} />
        </div>
      )}
    </BlocoFicha>
  );
}

export function BlocoEndereco({ c, erros, pode, busca }: Props & { busca: Busca }) {
  return (
    <BlocoFicha id="endereco" titulo="Endereço" pode={pode} aside="CEP preenche rua, bairro, cidade e UF">
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-6 xl:grid-cols-12">
        <FormField id="ficha-cep" rotulo="CEP" obrigatorio erro={erros.cep} className="md:col-span-2 xl:col-span-3">
          <CampoComLupa name="cep" required={false} aria-required defaultValue={c?.cep ? mascararCEP(c.cep) : ''} inputMode="numeric" autoComplete="off"
            placeholder="00000-000" rotuloLupa="Buscar o endereço" mostrarLupa={pode} buscando={busca.buscando} aoBuscar={busca.buscar} onBlur={busca.aoSair} />
        </FormField>
        <FormField id="ficha-logradouro" rotulo="Logradouro" obrigatorio erro={erros.logradouro} className="md:col-span-4 xl:col-span-5">
          <Input name="logradouro" required={false} aria-required defaultValue={c?.logradouro ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-numero" rotulo="Número" obrigatorio erro={erros.numero} className="md:col-span-2 xl:col-span-2">
          <Input name="numero" required={false} aria-required defaultValue={c?.numero ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-complemento" rotulo="Complemento" erro={erros.complemento} className="md:col-span-4 xl:col-span-2">
          <Input name="complemento" defaultValue={c?.complemento ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-bairro" rotulo="Bairro" obrigatorio erro={erros.bairro} className="md:col-span-2 xl:col-span-3">
          <Input name="bairro" required={false} aria-required defaultValue={c?.bairro ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-cidade" rotulo="Cidade" obrigatorio erro={erros.cidade} className="md:col-span-3 xl:col-span-5">
          <Input name="cidade" required={false} aria-required defaultValue={c?.cidade ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-uf" rotulo="UF" obrigatorio erro={erros.uf} className="md:col-span-1 xl:col-span-2">
          <select name="uf" required={false} aria-required defaultValue={c?.uf?.trim() ?? ''} className={classeSelect}>
            <option value="">UF</option>
            {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </FormField>
      </div>
      <p role="status" className="mt-2 min-h-5 text-sm text-muted">{busca.mensagem}</p>
    </BlocoFicha>
  );
}

export function BlocoContato({ c, erros, pode }: Props) {
  return (
    <BlocoFicha id="contato" titulo="Contato" pode={pode} aside="as pessoas que falam pela empresa ficam na aba Contatos">
      <div className="grid gap-x-4 gap-y-3 md:grid-cols-2 xl:grid-cols-5">
        <FormField id="ficha-telefone" rotulo="Telefone" erro={erros.telefone}>
          <Input name="telefone" inputMode="tel" defaultValue={c?.telefone ? mascararTelefone(c.telefone) : ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-celular" rotulo="Celular / WhatsApp" erro={erros.celular}>
          <Input name="celular" inputMode="tel" defaultValue={c?.celular ? mascararTelefone(c.celular) : ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-email" rotulo="E-mail" erro={erros.email}>
          <Input name="email" type="email" defaultValue={c?.email ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-email-cobranca" rotulo="E-mail de cobrança" ajuda="Para onde vão os boletos de honorários." erro={erros.email_cobranca}>
          <Input name="email_cobranca" type="email" defaultValue={c?.email_cobranca ?? ''} autoComplete="off" />
        </FormField>
        <FormField id="ficha-site" rotulo="Site" erro={erros.site}>
          <Input name="site" defaultValue={c?.site ?? ''} placeholder="https://" autoComplete="off" />
        </FormField>
      </div>
    </BlocoFicha>
  );
}
