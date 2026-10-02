// Junta o build do Vite em um único arquivo HTML (dist/criador-de-graficos.html),
// que funciona aberto direto do computador, sem servidor.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/g, (_, file) => {
  const js = readFileSync(join(dist, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/g, (_, file) => {
  const css = readFileSync(join(dist, file), 'utf8');
  return `<style>${css}</style>`;
});
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');

if (/src="\.\/assets|href="\.\/assets/.test(html)) {
  throw new Error('Sobrou referência a arquivo externo no HTML único.');
}
const out = join(dist, 'criador-de-graficos.html');
writeFileSync(out, html);
console.log(`HTML único: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
