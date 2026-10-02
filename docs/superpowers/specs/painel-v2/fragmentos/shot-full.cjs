// Captura páginas completas (00-*.html) em 1440x900. Uso: node shot-full.cjs <playwright> <nome sem .html>...
const { chromium } = require(process.argv[2]); const { pathToFileURL } = require('url'); const path = require('path');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
for (const n of process.argv.slice(3)) { await p.goto(pathToFileURL(path.join(__dirname, n + '.html')).href); await p.waitForTimeout(2000); await p.screenshot({ path: path.join(__dirname, '..', 'imagens', n + '.png'), fullPage: true }); }
await b.close(); })();
