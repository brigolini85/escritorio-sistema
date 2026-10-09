export type TipoRecebido = 'texto' | 'audio' | 'imagem' | 'documento' | 'outro';

export type MensagemRecebida = {
  idProvedor: string;
  /** Auditoria 3.1: instanceId do corpo (a Z-API manda em todo evento real). */
  instanciaId?: string | null;
  telefone: string;
  enviadaPorMim: boolean;
  ehGrupo: boolean;
  nomeRemetente: string | null;
  tipo: TipoRecebido;
  texto: string | null;
  midia: { url: string; mime: string | null; nomeArquivo: string | null } | null;
};

/**
 * Auditoria 3.2: a requisição saiu e não se sabe se a Z-API entregou (prazo estourado, conexão caída, 5xx, resposta sem
 * id). A mensagem fica "incerto": não é reenviada sozinha e o eco "enviada por mim" a confirma. Qualquer outro erro do
 * canal (4xx, conexão recusada) é falha certa.
 */
export class EnvioIncerto extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'EnvioIncerto';
  }
}

export interface CanalWhatsApp {
  interpretarWebhook(corpo: unknown): MensagemRecebida | null;
  enviarTexto(telefone: string, texto: string): Promise<{ idProvedor: string }>;
  enviarArquivo(telefone: string, arquivo: { url: string; nome: string }): Promise<{ idProvedor: string }>;
  status(): Promise<{ conectado: boolean }>;
}
