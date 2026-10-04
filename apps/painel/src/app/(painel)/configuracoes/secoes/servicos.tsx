import { CardContent, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { classeCaixa, classeSelect } from '../../clientes/estilos';
import { salvarServico } from '../acoes';
import { CampoNomeUnico } from '../campos-validados';
import { Cartao } from '../cartao';
import { AcoesLinhaConfig, FormularioConfig, SalvarConfig } from '../formulario-config';

type Servico = { id: string; nome: string; setor_id: string | null; ativo: boolean };

/** Serviços do contrato de cada empresa e o setor que cuida de cada um (Configurações: Sim). */
export function SecaoServicos({ servicos, setores }: { servicos: Servico[]; setores: { id: string; nome: string; ativo: boolean }[] }) {
  const nomes = servicos.map((s) => s.nome);
  const semSetor = servicos.filter((s) => !s.setor_id).length;
  const opcoes = setores.map((x) => <option key={x.id} value={x.id}>{x.nome}{x.ativo ? '' : ' (inativo)'}</option>);
  return (
    <Cartao
      id="servicos"
      titulo="Serviços do escritório"
      descricao={<>Os serviços do contrato de cada empresa e o setor que cuida de cada um.{semSetor > 0 && <strong className="font-semibold text-warning"> {semSetor === 1 ? '1 serviço está sem setor.' : `${semSetor} serviços estão sem setor.`}</strong>}</>}
    >
      <CardContent className="flex flex-col gap-2">
        {servicos.map((s) => (
          <FormularioConfig key={s.id} acao={salvarServico.bind(null, s.id)} rotulo={`Serviço ${s.nome}`} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
            <CampoNomeUnico outros={nomes.filter((n) => n !== s.nome)} mensagem="Já existe um serviço com este nome." name="nome" defaultValue={s.nome} aria-label={`Nome do serviço ${s.nome}`} required maxLength={80} className="sm:flex-1" />
            <select name="setor_id" defaultValue={s.setor_id ?? ''} aria-label={`Setor do serviço ${s.nome}`} className={cn(classeSelect, 'sm:w-48')}>
              <option value="">Sem setor</option>
              {opcoes}
            </select>
            <label className="flex items-center gap-2 text-base text-foreground">
              <input type="checkbox" name="ativo" defaultChecked={s.ativo} className={classeCaixa} /> ativo
            </label>
            <AcoesLinhaConfig rotulo={`Salvar serviço ${s.nome}`} descartar={`Descartar alterações do serviço ${s.nome}`} />
          </FormularioConfig>
        ))}
        {servicos.length === 0 && <p className="text-sm text-muted">Nenhum serviço ainda. Crie o primeiro abaixo.</p>}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={salvarServico.bind(null, null)} rotulo="Novo serviço" limparAoSalvar className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <CampoNomeUnico outros={nomes} mensagem="Já existe um serviço com este nome." name="nome" placeholder="Novo serviço (ex.: Folha de pagamento)" aria-label="Nome do novo serviço" required maxLength={80} className="sm:flex-1" />
          <select name="setor_id" aria-label="Setor do novo serviço" className={cn(classeSelect, 'sm:w-48')}>
            <option value="">Sem setor</option>
            {opcoes}
          </select>
          <SalvarConfig>Criar serviço</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
