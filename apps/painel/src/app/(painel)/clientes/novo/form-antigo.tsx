import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { FormField } from '@/components/patterns/form-field';
import { Button, variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { salvarCliente } from '../acoes';

/** Novo cliente de antes da Parte H1: só quando o banco ainda não tem a migração (D23); some numa parte futura. */
export function NovoClienteAntigo({ erro }: { erro?: string }) {
  return (
    <section className="max-w-xl">
      <PageHeader
        titulo="Novo cliente"
        descricao="Depois de salvar, a ficha da empresa abre para cadastrar contatos, produtos e preços."
        migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }]}
      />
      <p role="note" className="rounded-md border border-border bg-surface-muted p-3 text-sm text-muted">
        A ficha completa aparece quando a atualização do banco da Parte H for aplicada.
      </p>
      <AvisoErro erro={erro} prefixo="Não foi possível salvar: " />
      <Card className="mt-4">
        <form action={salvarCliente.bind(null, null)}>
          <CardContent className="flex flex-col gap-4">
            <FormField id="novo-razao" rotulo="Razão social" obrigatorio>
              <Input name="razao_social" required autoComplete="off" />
            </FormField>
            <FormField id="novo-fantasia" rotulo="Nome fantasia" ajuda="Como a empresa é conhecida, se for diferente da razão social.">
              <Input name="nome_fantasia" autoComplete="off" />
            </FormField>
            <FormField id="novo-cnpj" rotulo="CNPJ" obrigatorio>
              <Input name="cnpj" required inputMode="numeric" placeholder="00.000.000/0000-00" autoComplete="off" />
            </FormField>
          </CardContent>
          <CardFooter className="justify-end">
            <Link href="/clientes" className={variantesBotao({ variant: 'outline' })}>Voltar</Link>
            <Button type="submit">Salvar</Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  );
}
