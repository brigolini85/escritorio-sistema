export type TipoRecebido = 'texto' | 'audio' | 'imagem' | 'documento' | 'outro';

export type MensagemRecebida = {
  idProvedor: string;
  telefone: string;
  enviadaPorMim: boolean;
  ehGrupo: boolean;
  nomeRemetente: string | null;
  tipo: TipoRecebido;
  texto: string | null;
  midia: { url: string; mime: string | null; nomeArquivo: string | null } | null;
};

export interface CanalWhatsApp {
  interpretarWebhook(corpo: unknown): MensagemRecebida | null;
  enviarTexto(telefone: string, texto: string): Promise<{ idProvedor: string }>;
  enviarArquivo(telefone: string, arquivo: { url: string; nome: string }): Promise<{ idProvedor: string }>;
  status(): Promise<{ conectado: boolean }>;
}
