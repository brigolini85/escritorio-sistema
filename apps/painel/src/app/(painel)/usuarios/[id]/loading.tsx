import { Skeleton } from '@/components/ui/skeleton';

export default function Carregando() {
  return (
    <section role="status" aria-label="Carregando a pessoa" className="flex flex-col gap-6">
      <Skeleton className="h-8 w-1/3" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    </section>
  );
}
