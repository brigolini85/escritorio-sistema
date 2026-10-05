import { redirect } from 'next/navigation';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';

/** "Treinar o agente" virou as abas Orientações e Testar do Thiago (spec 7E.1, D20): o endereço antigo leva para lá, com a mesma consulta. */
export default async function TreinarAgente({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  redirect(`/agentes/atendimento/orientacoes${hrefComParams(await searchParams, {})}`);
}
