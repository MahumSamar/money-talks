import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function fontDataUri(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return `data:font/woff2;base64,${bytes.toString('base64')}`;
}

const [instrument, manrope] = await Promise.all([
  fontDataUri('https://fonts.gstatic.com/s/instrumentserif/v5/jizBRFtNs2ka5fXjeivQ4LroWlx-6zUTjg.woff2'),
  fontDataUri('https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2'),
]);

function rewriteFonts(css) {
  return css
    .replaceAll("url('/fonts/instrument-serif-latin.woff2')", `url('${instrument}')`)
    .replaceAll("url('/fonts/manrope-latin.woff2')", `url('${manrope}')`);
}

const bundled = await esbuild.build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src/main.js')],
  bundle: true,
  format: 'esm',
  minify: true,
  write: false,
  loader: { '.css': 'empty' },
  legalComments: 'none',
});

const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = rewriteFonts(readFileSync(join(root, 'src/style.css'), 'utf8'));
const favicon = readFileSync(join(root, 'public/favicon.svg'), 'utf8').replaceAll('#', '%23').replaceAll('"', "'");
const js = bundled.outputFiles[0].text.replaceAll('</script>', '<\\/script>');

const standalone = rewriteFonts(html)
  .replace(
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    `<link rel="icon" href="data:image/svg+xml,${favicon}" type="image/svg+xml" />`,
  )
  .replace(
    '<link rel="preload" href="/fonts/instrument-serif-latin.woff2" as="font" type="font/woff2" crossorigin />\n    <link rel="preload" href="/fonts/manrope-latin.woff2" as="font" type="font/woff2" crossorigin />',
    '',
  )
  .replace('    <script type="module" src="/src/main.js"></script>\n', () => `    <style>\n${css}\n    </style>\n    <script type="module">\n${js}\n    </script>\n`);

const out = join(root, 'money-talks.html');
writeFileSync(out, standalone);
console.log(`Wrote ${out} (${(Buffer.byteLength(standalone) / 1024 / 1024).toFixed(2)} MB)`);
