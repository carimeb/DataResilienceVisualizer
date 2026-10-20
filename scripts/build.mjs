// Bundles src/ into two single-file outputs:
//  dist/data-resilience-visualizer.html  full HTML document (open from disk or share as a file)
//  dist/artifact.html                    same page without the document skeleton (for hosted publishing)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const js = await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const css = readFileSync('src/styles.css', 'utf8');
const body = readFileSync('src/template.html', 'utf8')
  .replace('/*STYLE*/', () => css)
  .replace('/*SCRIPT*/', () => js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'));
mkdirSync('dist', { recursive: true });
writeFileSync('dist/artifact.html', body);
writeFileSync('dist/data-resilience-visualizer.html',
  `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${body.replace(/<header/, '</head>\n<body>\n<header')}\n</body>\n</html>\n`);
console.log('built dist/data-resilience-visualizer.html', Math.round(body.length / 1024), 'KB');
