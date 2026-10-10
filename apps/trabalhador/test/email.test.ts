import { createServer, type Server, type Socket } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarEmail } from '../src/email';

// Auditoria 6.13: o nodemailer subiu de major (6 → 10); createTransport + sendMail continuam iguais. Um servidor SMTP
// mínimo, só no computador, recebe a mensagem de verdade (com AUTH), sem internet.
type Recebido = { auth: string | null; de: string; para: string[]; dados: string };
let servidor: Server;
let porta = 0;
const recebidos: Recebido[] = [];

function atender(s: Socket) {
  const atual: Recebido = { auth: null, de: '', para: [], dados: '' };
  let emDados = false;
  let buffer = '';
  s.write('220 teste ESMTP\r\n');
  s.on('data', (pedaco) => {
    buffer += pedaco.toString('utf8');
    let i: number;
    while ((i = buffer.indexOf('\r\n')) >= 0) {
      const linha = buffer.slice(0, i);
      buffer = buffer.slice(i + 2);
      if (emDados) {
        if (linha === '.') { emDados = false; recebidos.push({ ...atual }); s.write('250 ok\r\n'); } else atual.dados += `${linha}\n`;
        continue;
      }
      const cmd = linha.toUpperCase();
      if (cmd.startsWith('EHLO')) s.write('250-teste\r\n250 AUTH PLAIN\r\n');
      else if (cmd.startsWith('AUTH PLAIN')) { atual.auth = Buffer.from(linha.slice(11), 'base64').toString('utf8'); s.write('235 ok\r\n'); }
      else if (cmd.startsWith('MAIL FROM')) { atual.de = linha; s.write('250 ok\r\n'); }
      else if (cmd.startsWith('RCPT TO')) { atual.para.push(linha); s.write('250 ok\r\n'); }
      else if (cmd === 'DATA') { emDados = true; s.write('354 fim com .\r\n'); }
      else if (cmd === 'QUIT') { s.end('221 tchau\r\n'); }
      else s.write('250 ok\r\n');
    }
  });
}

beforeAll(async () => {
  servidor = createServer(atender);
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', () => r()));
  porta = (servidor.address() as { port: number }).port;
});
afterAll(() => new Promise<void>((r) => servidor.close(() => r())));

describe('criarEmail com o nodemailer atual', () => {
  it('manda a mensagem com autenticação, remetente, destinatário, assunto e texto', async () => {
    const email = criarEmail({ host: '127.0.0.1', porta, usuario: 'alertas@teste.local', senha: 'senha-teste', remetente: 'Sistema <alertas@teste.local>' });
    await email.enviar('dono@teste.local', 'WhatsApp desconectado', 'Reconecte o WhatsApp no painel da Z-API.');
    expect(recebidos).toHaveLength(1);
    const m = recebidos[0]!;
    expect(m.auth).toBe('\u0000alertas@teste.local\u0000senha-teste');
    expect(m.de).toContain('alertas@teste.local');
    expect(m.para.join(' ')).toContain('dono@teste.local');
    expect(m.dados).toContain('Subject: WhatsApp desconectado');
    expect(m.dados).toContain('Reconecte o WhatsApp no painel da Z-API.');
  });
});
