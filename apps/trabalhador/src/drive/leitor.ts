import type { ItemDrive, MimeExportacao } from '@escritorio/core';

/** Parte I3b (D2, D3, D5): o Drive só de leitura. Nenhum método grava, move, compartilha ou apaga. */
export interface DriveLeitor {
  /** O e-mail da conta de serviço: o dono compartilha cada pasta de cliente com ele, como Leitor. */
  readonly email: string;
  /** Lança se a conta não autentica (chave errada, API desligada). */
  verificar(): Promise<void>;
  /** null: não existe, está na lixeira ou a conta não enxerga. */
  item(id: string): Promise<ItemDrive | null>;
  /** Filhos diretos da pasta, sem os da lixeira. */
  listar(pastaId: string): Promise<ItemDrive[]>;
  baixar(id: string): Promise<Uint8Array>;
  exportar(id: string, mime: MimeExportacao): Promise<Uint8Array>;
}

/**
 * F1: 'conta' é a conta do escritório que não autentica (token recusado, 401, API desligada): só ela vai para
 * drive_conta.erro. Os outros são da pasta ou do arquivo e ficam na linha do tempo da tarefa.
 */
/** F6: o Google responde 404 também para a pasta que não foi compartilhada com a conta; o texto diz as duas coisas. */
export const textoPastaNaoEncontrada = (email: string): string =>
  `A pasta não foi encontrada no Drive ou não foi compartilhada com ${email} (como Leitor).`;

export type CodigoErroDrive = 'conta' | 'sem_acesso' | 'nao_encontrado' | 'grande' | 'falha';
export class ErroDrive extends Error {
  constructor(readonly codigo: CodigoErroDrive, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDrive';
  }
}
