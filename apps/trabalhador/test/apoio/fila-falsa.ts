import type { Fila } from '../../src/fila';

export class FilaFalsa implements Fila {
  enviados: { nome: string; dados: any; opcoes?: object }[] = [];
  async enviar(nome: string, dados: object, opcoes?: object) {
    this.enviados.push({ nome, dados, opcoes });
  }
}
