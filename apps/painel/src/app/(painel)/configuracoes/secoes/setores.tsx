import { CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { classeCaixa } from '../../clientes/estilos';
import { salvarSetor } from '../acoes';
import { CampoNomeUnico } from '../campos-validados';
import { Cartao } from '../cartao';
import { AcoesLinhaConfig, FormularioConfig, SalvarConfig } from '../formulario-config';

type Setor = { id: string; nome: string; descricao_assuntos: string; ativo: boolean };

/** Setores (Configurações: Sim): cadastra, altera e desativa; excluir de vez continua só do administrador (Parte B). */
export function SecaoSetores({ setores }: { setores: Setor[] }) {
  const nomes = setores.map((s) => s.nome);
  return (
    <Cartao id="setores" titulo="Setores" descricao="O agente usa a descrição dos assuntos para decidir para qual setor mandar cada demanda.">
      <CardContent className="flex flex-col gap-2">
        {setores.map((s) => (
          <FormularioConfig key={s.id} acao={salvarSetor.bind(null, s.id)} rotulo={`Setor ${s.nome}`} className="flex flex-col gap-2 rounded-md border border-border p-2 sm:flex-row sm:items-center">
            <CampoNomeUnico outros={nomes.filter((n) => n !== s.nome)} mensagem="Já existe um setor com este nome." name="nome" defaultValue={s.nome} aria-label={`Nome do setor ${s.nome}`} required maxLength={60} className="sm:w-40" />
            <Input name="descricao_assuntos" defaultValue={s.descricao_assuntos} aria-label={`Assuntos do setor ${s.nome}`} placeholder="Assuntos deste setor" maxLength={500} className="sm:flex-1" />
            <label className="flex items-center gap-2 text-base text-foreground">
              <input type="checkbox" name="ativo" defaultChecked={s.ativo} className={classeCaixa} /> ativo
            </label>
            <AcoesLinhaConfig rotulo={`Salvar setor ${s.nome}`} descartar={`Descartar alterações do setor ${s.nome}`} />
          </FormularioConfig>
        ))}
        {setores.length === 0 && <p className="text-sm text-muted">Nenhum setor ainda. Crie o primeiro abaixo.</p>}
      </CardContent>
      <CardFooter className="border-t border-border">
        <FormularioConfig acao={salvarSetor.bind(null, null)} rotulo="Novo setor" limparAoSalvar className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <CampoNomeUnico outros={nomes} mensagem="Já existe um setor com este nome." name="nome" placeholder="Novo setor" aria-label="Nome do novo setor" required maxLength={60} className="sm:w-40" />
          <Input name="descricao_assuntos" placeholder="Assuntos deste setor" aria-label="Assuntos do novo setor" maxLength={500} className="sm:flex-1" />
          <SalvarConfig>Criar setor</SalvarConfig>
        </FormularioConfig>
      </CardFooter>
    </Cartao>
  );
}
