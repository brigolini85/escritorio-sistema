import { Bot, ChevronDown, FileText, Headset, LogOut, Moon, Plus, Search, Settings, Trash2, UserRound } from 'lucide-react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AlternadorTema } from '@/components/tema/alternador-tema';
import { COOKIE_TEMA, escolhaDoCookie } from '@/components/tema/tema';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from '@/components/ui/command';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ROTULO_DE_OPCAO } from '@/components/ui/rotulo-de-opcao';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DemoAvisos } from './demos';
import { Padroes } from './padroes';

// Catálogo vivo do design system: todos os tokens e primitivos. Só em desenvolvimento (D6).

export const metadata = { title: 'Design system | Painel do Escritório' };

const CORES: { grupo: string; tokens: [string, string][] }[] = [
  { grupo: 'Marca', tokens: [['--brand-base', 'a cor da marca (a única linha a editar)'], ['--brand', 'ações primárias, links, foco'], ['--brand-foreground', 'texto sobre a marca'], ['--brand-soft', 'item selecionado']] },
  {
    grupo: 'Superfícies',
    tokens: [
      ['--background', 'fundo da aplicação'], ['--surface', 'cards e painéis'], ['--surface-muted', 'zebra, hover'],
      ['--border', 'divisórias'], ['--border-input', 'contorno de campos'], ['--ring', 'foco'],
    ],
  },
  { grupo: 'Texto', tokens: [['--text', 'principal'], ['--text-muted', 'secundário'], ['--text-subtle', 'metadados']] },
  {
    grupo: 'Semânticas',
    tokens: ['success', 'warning', 'danger', 'info'].flatMap((s): [string, string][] => [[`--${s}`, 'forte'], [`--${s}-soft`, 'fundo suave']]),
  },
  {
    grupo: 'Domínio',
    tokens: [
      ['--agent-active', 'agente respondendo'], ['--agent-active-soft', ''], ['--agent-paused', 'agente pausado'], ['--agent-paused-soft', ''],
      ['--human-owned', 'assumida por atendente'], ['--human-owned-soft', ''], ['--assistant', 'assistente interno'], ['--assistant-soft', ''],
      ['--internal-note', 'fundo de nota interna'], ['--internal-note-foreground', 'rótulo da nota'],
    ],
  },
];

const TIPOGRAFIA: [string, string, string][] = [
  ['text-2xl', '24px', 'Título de página'],
  ['text-xl', '20px', 'Título de seção'],
  ['text-lg', '16px', 'Título de card'],
  ['text-base', '14px', 'Corpo da aplicação'],
  ['text-sm', '13px', 'Rótulos e tabelas'],
  ['text-xs', '12px', 'Metadados e selos'],
];

const SELOS = [
  ['neutral', 'Neutro'], ['outline', 'Contorno'], ['brand', 'Marca'], ['success', 'Concluída'], ['warning', 'Pendente'],
  ['danger', 'Atrasada'], ['info', 'Informação'], ['agent-active', 'Agente ativo'], ['agent-paused', 'Agente pausado'],
  ['human-owned', 'Com atendente'], ['assistant', 'Assistente'],
] as const;

const DEMANDAS = [
  { numero: 1042, empresa: 'Padaria Pão Quente Ltda', setor: 'Fiscal', status: 'Aberta', valor: 'R$ 1.280,00' },
  { numero: 1041, empresa: 'Mercado Bom Preço', setor: 'Pessoal', status: 'Concluída', valor: 'R$ 96,50' },
  { numero: 1039, empresa: 'Auto Peças Irmãos Silva', setor: 'Fiscal', status: 'Atrasada', valor: 'R$ 12.400,00' },
];

function Secao({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">{titulo}</h2>
        {descricao && <p className="text-muted">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

function Exemplo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">{children}</CardContent>
    </Card>
  );
}

export default async function PaginaDesign({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const escolha = escolhaDoCookie((await cookies()).get(COOKIE_TEMA)?.value);
  const params = await searchParams;

  return (
    <div className="max-w-5xl space-y-10 text-foreground">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Design system</h1>
          <p className="text-muted">Catálogo vivo dos tokens e componentes do painel. Valores em src/styles/tokens.css.</p>
        </div>
        <AlternadorTema inicial={escolha} />
      </header>

      <Secao titulo="Cores" descricao="Tokens semânticos. Nunca use cores do Tailwind (slate, red...) direto no JSX.">
        {CORES.map(({ grupo, tokens }) => (
          <div key={grupo} className="space-y-2">
            <h3 className="text-sm font-medium text-muted">{grupo}</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {tokens.map(([token, uso]) => (
                <div key={token} className="overflow-hidden rounded-md border border-border bg-surface">
                  <div className="h-12 border-b border-border" style={{ background: `var(${token})` }} />
                  <div className="p-2">
                    <p className="font-mono text-xs">{token}</p>
                    {uso && <p className="text-xs text-subtle">{uso}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-internal-note-border bg-internal-note p-3">
            <p className="text-xs font-medium text-internal-note-foreground">Nota interna · o cliente não vê</p>
            <p>Cliente pediu para emitir a nota só depois do dia 10.</p>
          </div>
          <div className="rounded-md bg-assistant-soft p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-assistant"><Bot aria-hidden size={16} strokeWidth={1.75} />Assistente</p>
            <p>Encontrei 3 pedidos de nota abertos para esta empresa.</p>
          </div>
        </div>
      </Secao>

      <Secao titulo="Tipografia" descricao="Plus Jakarta Sans. Escala fechada; corpo em 14px. Números com o utilitário tabular.">
        <Card>
          <CardContent className="space-y-3">
            {TIPOGRAFIA.map(([classe, px, uso]) => (
              <div key={classe} className="flex items-baseline gap-4">
                <span className="w-36 shrink-0 font-mono text-xs text-subtle">{classe} · {px}</span>
                <span className={classe}>{uso}</span>
              </div>
            ))}
            <Separator />
            <div className="flex flex-wrap gap-8">
              <div><p className="text-xs text-subtle">Proporcional</p><p className="text-lg">11.111,11<br />98.765,40</p></div>
              <div><p className="text-xs text-subtle">tabular</p><p className="tabular text-lg">11.111,11<br />98.765,40</p></div>
              <div><p className="text-xs text-subtle">CNPJ (tabular)</p><p className="tabular">12.345.678/0001-90</p></div>
              <div><p className="text-xs text-subtle">font-mono</p><p className="font-mono text-sm">pedido_nota.itens[2].qtd</p></div>
            </div>
          </CardContent>
        </Card>
      </Secao>

      <Secao titulo="Forma e profundidade">
        <div className="flex flex-wrap gap-4">
          {(['rounded-sm', 'rounded-md', 'rounded-lg'] as const).map((r) => (
            <div key={r} className={`flex size-24 items-center justify-center border border-border bg-surface-muted font-mono text-xs ${r}`}>{r}</div>
          ))}
          {(['shadow-sm', 'shadow-md'] as const).map((s) => (
            <div key={s} className={`flex size-24 items-center justify-center rounded-lg bg-surface font-mono text-xs ${s}`}>{s}</div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Componentes" descricao="Primitivos em src/components/ui. Use Tab para ver o foco.">
        <div className="grid gap-4 lg:grid-cols-2">
          <Exemplo titulo="Button: variantes">
            <Button>Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Contorno</Button>
            <Button variant="ghost">Fantasma</Button>
            <Button variant="danger">Apagar</Button>
            <Button variant="link">Link</Button>
          </Exemplo>
          <Exemplo titulo="Button: tamanhos e estados">
            <Button size="sm"><Plus aria-hidden size={16} strokeWidth={1.75} />Nova demanda</Button>
            <Button size="md"><Headset aria-hidden size={16} strokeWidth={1.75} />Assumir</Button>
            <Button size="icon" variant="outline" aria-label="Configurações"><Settings aria-hidden size={16} strokeWidth={1.75} /></Button>
            <Button disabled>Desabilitado</Button>
            <Button variant="outline" disabled>Desabilitado</Button>
          </Exemplo>
          <Exemplo titulo="Badge">
            {SELOS.map(([v, t]) => <Badge key={v} variant={v}>{t}</Badge>)}
          </Exemplo>
          <Exemplo titulo="Avatar, Skeleton, Separator">
            <Avatar><AvatarFallback>MS</AvatarFallback></Avatar>
            <Avatar><AvatarFallback><UserRound aria-hidden size={16} strokeWidth={1.75} /></AvatarFallback></Avatar>
            <Separator orientation="vertical" className="h-8" />
            <div className="w-48 space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /></div>
          </Exemplo>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Campos</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="d-nome">Nome da empresa</Label><Input id="d-nome" placeholder="Ex.: Padaria Pão Quente" /></div>
            <div className="space-y-1.5"><Label htmlFor="d-cnpj">CNPJ</Label><Input id="d-cnpj" className="tabular" defaultValue="12.345.678/0001-90" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="d-erro">E-mail</Label>
              <Input id="d-erro" aria-invalid defaultValue="contato@" aria-describedby="d-erro-msg" />
              <p id="d-erro-msg" className="text-sm text-danger">Informe um e-mail válido.</p>
            </div>
            <div className="space-y-1.5"><Label htmlFor="d-desab">Desabilitado</Label><Input id="d-desab" disabled defaultValue="Somente leitura" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="d-setor">Setor</Label>
              <Select defaultValue="fiscal">
                <SelectTrigger id="d-setor"><SelectValue placeholder="Escolha o setor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiscal">Fiscal</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="contabil">Contábil</SelectItem>
                  <SelectItem value="triagem" disabled>Triagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-resp">Responsável</Label>
              <Select>
                <SelectTrigger id="d-resp"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent><SelectItem value="m">Maria Souza</SelectItem><SelectItem value="j">João Lima</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="d-obs">Observação</Label><Textarea id="d-obs" placeholder="Escreva uma nota interna" /></div>
            <div className="flex flex-col gap-3">
              <Label className={ROTULO_DE_OPCAO}><Checkbox defaultChecked />Pode pedir nota</Label>
              <Label className={ROTULO_DE_OPCAO}><Checkbox />Pode mudar preço e cadastrar produto</Label>
              <Label className={ROTULO_DE_OPCAO}><Checkbox disabled />Desabilitado</Label>
            </div>
            <div className="flex flex-col gap-3">
              <Label className={ROTULO_DE_OPCAO}><Switch defaultChecked />O agente atende este contato</Label>
              <Label className={ROTULO_DE_OPCAO}><Switch />Usar o assistente pelo WhatsApp</Label>
              <Label className={ROTULO_DE_OPCAO}><Switch disabled />Desabilitado</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tabs e Table</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="abertas">
              <TabsList>
                <TabsTrigger value="abertas">Abertas</TabsTrigger>
                <TabsTrigger value="minhas">Comigo</TabsTrigger>
                <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
                <TabsTrigger value="off" disabled>Desabilitada</TabsTrigger>
              </TabsList>
              <TabsContent value="abertas">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead className="w-16">Nº</TableHead><TableHead>Empresa</TableHead><TableHead>Setor</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {DEMANDAS.map((d, i) => (
                      <TableRow key={d.numero} data-state={i === 0 ? 'selected' : undefined}>
                        <TableCell className="tabular text-muted">{d.numero}</TableCell>
                        <TableCell className="font-medium">{d.empresa}</TableCell>
                        <TableCell>{d.setor}</TableCell>
                        <TableCell><Badge variant={d.status === 'Concluída' ? 'success' : d.status === 'Atrasada' ? 'danger' : 'info'}>{d.status}</Badge></TableCell>
                        <TableCell className="tabular text-right">{d.valor}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="minhas"><p className="py-6 text-center text-muted">Nenhuma demanda com você.</p></TabsContent>
              <TabsContent value="concluidas"><p className="py-6 text-center text-muted">Nada concluído hoje.</p></TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Exemplo titulo="Sobreposições">
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline" size="icon" aria-label="Buscar"><Search aria-hidden size={16} strokeWidth={1.75} /></Button></TooltipTrigger>
              <TooltipContent>Buscar (Ctrl + K)</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline">Menu<ChevronDown aria-hidden size={16} strokeWidth={1.75} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Maria Souza</DropdownMenuLabel>
                <DropdownMenuItem><Moon aria-hidden size={16} strokeWidth={1.75} />Tema<DropdownMenuShortcut>T</DropdownMenuShortcut></DropdownMenuItem>
                <DropdownMenuItem disabled><FileText aria-hidden size={16} strokeWidth={1.75} />CSV do Bling</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="danger"><LogOut aria-hidden size={16} strokeWidth={1.75} />Sair</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline">Popover</Button></PopoverTrigger>
              <PopoverContent>
                <p className="font-medium">WhatsApp conectado</p>
                <p className="text-sm text-muted">Último sinal há 40 s.</p>
              </PopoverContent>
            </Popover>
            <Dialog>
              <DialogTrigger asChild><Button variant="danger"><Trash2 aria-hidden size={16} strokeWidth={1.75} />Dialog</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Concluir a demanda 1042?</DialogTitle>
                  <DialogDescription>A demanda sai da lista de abertas. Dá para reabrir depois.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
                  <DialogClose asChild><Button>Concluir</Button></DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Sheet>
              <SheetTrigger asChild><Button variant="secondary">Sheet</Button></SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Demanda 1042</SheetTitle>
                  <SheetDescription>Padaria Pão Quente Ltda · Fiscal</SheetDescription>
                </SheetHeader>
                <SheetBody className="space-y-2">
                  <Badge variant="human-owned">Com atendente</Badge>
                  <p>Pedido de nota com 3 itens aguardando conferência.</p>
                </SheetBody>
                <SheetFooter><Button>Baixar CSV Bling</Button></SheetFooter>
              </SheetContent>
            </Sheet>
          </Exemplo>
          <Exemplo titulo="Toaster (sonner)">
            <DemoAvisos />
          </Exemplo>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Command</CardTitle><CardDescription>Base da busca global.</CardDescription></CardHeader>
            <CardContent>
              <Command className="rounded-md border border-border">
                <CommandInput placeholder="Buscar empresa, contato ou demanda" />
                <CommandList>
                  <CommandEmpty>Nada encontrado.</CommandEmpty>
                  <CommandGroup heading="Empresas">
                    <CommandItem>Padaria Pão Quente Ltda<CommandShortcut>Empresa</CommandShortcut></CommandItem>
                    <CommandItem>Mercado Bom Preço<CommandShortcut>Empresa</CommandShortcut></CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Demandas">
                    <CommandItem><span className="tabular">#1042</span> Pedido de nota</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">ScrollArea e Card</CardTitle><CardDescription>Rolagem com barra discreta.</CardDescription></CardHeader>
            <CardContent>
              <ScrollArea className="h-40 rounded-md border border-border">
                <ul className="divide-y divide-border">
                  {Array.from({ length: 12 }, (_, i) => (
                    <li key={i} className="flex h-10 items-center justify-between px-3">
                      <span>Conversa {i + 1}</span>
                      <span className="tabular text-xs text-subtle">há {i + 2} min</span>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
            <CardFooter><Button size="sm" variant="outline">Ver todas</Button></CardFooter>
          </Card>
        </div>
      </Secao>

      <Padroes params={params} />
    </div>
  );
}
