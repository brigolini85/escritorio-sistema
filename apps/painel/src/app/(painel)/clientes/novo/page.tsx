import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { FormField } from '@/components/patterns/form-field';
import { Button, variantesBotao } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { salvarCliente } from '../acoes';

export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) redirect('/clientes');
  return (
    <section className="max-w-xl">
      <PageHeader
        titulo="Novo cliente"
        descricao="Depois de salvar, a ficha da empresa abre para cadastrar contatos, produtos e preços."
        migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }]}
      />
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
