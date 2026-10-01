// Gera as imagens das telas a partir de fragmentos/*.html. Uso: node gerar-imagens.cjs <caminho do pacote playwright>
const { chromium } = require(process.argv[2]); const fs = require('fs'); const path = require('path');
const head = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css">
<style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#fff;width:860px}p{margin:0}</style></head><body>`;
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 860, height: 600 }, deviceScaleFactor: 2 });
for (const f of fs.readdirSync(path.join(__dirname, 'fragmentos')).filter(n => n.endsWith('.html') && !n.startsWith('00-'))) {
  await p.setContent(head + fs.readFileSync(path.join(__dirname, 'fragmentos', f), 'utf8') + '</body></html>', { waitUntil: 'networkidle' });
  await p.waitForTimeout(800); await p.screenshot({ path: path.join(__dirname, 'imagens', f.replace('.html', '.png')), fullPage: true }); }
await b.close(); })();
