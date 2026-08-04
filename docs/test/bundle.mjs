// Builds the whole game as ONE self-contained .html file.
//
//   node docs/test/bundle.mjs            -> docs/grandiose.html
//   node docs/test/bundle.mjs out.html
//
// It lands in docs/ so Pages serves it too: one URL that hands over the entire
// game in a single response, for anything that can read a page but not clone a
// repository. index.html is still the thing to play.
//
// This is for handing the game to somebody — a chat that can read one file but
// cannot clone a repository, or a phone that wants to open it from a download.
// The game itself still has no build step and is not built this way to run:
// docs/index.html loads the modules directly, as it always has, and that is what
// Pages serves. Nothing here is imported by anything that ships.
//
// The modules are not concatenated. Four top-level names exist in both engine.js
// and ui.js — build, money, raiseCitadel, setTithe — because the interface wraps
// engine calls of the same name, so pasting the files together would silently
// redefine three engine functions with their own wrappers. Each module is
// wrapped in its own scope instead and its exports handed on, which is what the
// module system was doing anyway.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = join(HERE, '..');

// Dependency order. data has none; ui depends on all of them.
const ORDER = ['data', 'engine', 'score', 'galaxy', 'audio', 'ui'];

const read = name => readFileSync(join(DOCS, name), 'utf8');

// `export const NAME` and `export function NAME` are the only two forms in this
// codebase — there are no default exports and no `export { ... }` blocks. If one
// ever appears this throws rather than quietly dropping it.
function exportsOf(src, name) {
  if (/^export\s+(default|\{)/m.test(src)) {
    throw new Error(`${name}.js uses an export form this bundler does not read`);
  }
  return [...src.matchAll(/^export\s+(?:const|function)\s+([A-Za-z_$][\w$]*)/gm)]
    .map(m => m[1]);
}

function rewrite(src, name) {
  const names = exportsOf(src, name);
  let out = src
    // import * as E from './engine.js'  ->  const E = __m.engine;
    .replace(/^import\s+\*\s+as\s+([\w$]+)\s+from\s+'\.\/([\w-]+)\.js';?$/gm,
      (_, alias, mod) => `const ${alias} = __m.${mod};`)
    // import { a, b } from './data.js'  ->  const { a, b } = __m.data;
    // Written across several lines in ui.js, so this has to span them.
    .replace(/^import\s*\{([\s\S]*?)\}\s*from\s*'\.\/([\w-]+)\.js';?$/gm,
      (_, spec, mod) => `const {${spec}} = __m.${mod};`)
    // and drop the `export` keyword, leaving the declaration itself
    .replace(/^export\s+(const|function|let|var|class)\s/gm, '$1 ');

  if (/^import\s/m.test(out)) {
    throw new Error(`${name}.js has an import this bundler did not rewrite`);
  }
  // 'use strict' because a module is always strict and an IIFE is not — without
  // it the bundled copy would run under different rules from the real thing.
  return `__m.${name} = (function () {\n'use strict';\n${out}\n`
       + `return { ${names.join(', ')} };\n})();`;
}

const bundle = ORDER.map(n => rewrite(read(n + '.js'), n)).join('\n\n');

let html = read('index.html');
const before = html.length;

// The page loads ui.js as a module and registers a service worker. One file has
// neither: the modules are inlined here and a worker has nothing to cache.
html = html.replace(/<script type="module" src="\.\/ui\.js"><\/script>/,
  `<script type="module">\nconst __m = {};\n${bundle}\n</script>`);
if (html.length === before) throw new Error('the module script tag was not found in index.html');

html = html.replace(/<script>[\s\S]*?serviceWorker[\s\S]*?<\/script>/, '');
html = html.replace(/<link rel="manifest"[^>]*>/, '');

// The icon is the last thing on disk the page reaches for. Inlined rather than
// dropped: the tab and the Home Screen still get it, and "self-contained" has to
// mean no requests at all — a single missing file is the difference between a
// file somebody can open from their downloads and one that half works.
const icon = 'data:image/png;base64,' + readFileSync(join(DOCS, 'icon-180.png')).toString('base64');
html = html.replace(/href="icon-180\.png"/g, `href="${icon}"`);
if (/href="[^"]*\.(png|js|webmanifest)"/.test(html)) {
  throw new Error('something is still loaded from disk: ' + RegExp.lastMatch);
}

const out = resolve(process.argv[2] || join(DOCS, 'grandiose.html'));
writeFileSync(out, html);

const { BUILD } = await import(join(DOCS, 'data.js'));
console.log(`${out}\n${BUILD} · ${(html.length / 1024).toFixed(0)}KB · ` +
  `${ORDER.length} modules inlined`);
