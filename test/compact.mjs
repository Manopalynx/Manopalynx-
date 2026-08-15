/* A copy of matchbox.html with the commentary stripped, for pasting into a chat.
 *
 * The file is already self-contained — unlike the game in docs/, it needs no bundling —
 * so this is not a build step, it is a diet. Comments are 63% of it: ~300kB and ~75k
 * tokens whole, ~115kB and ~29k stripped.
 *
 * Which one to hand over depends on the question being asked of it. The comments are the
 * design history — why a number is that number, what was measured, what was tried and
 * removed — so a chat reasoning about *why* wants the whole file. A chat that only needs
 * to see and run the thing wants this.
 *
 * The output is deliberately NOT committed. A second copy of a file with nothing comparing
 * them is two files, which is the whole reason test/published.mjs exists; a stale stripped
 * copy sitting in the repo would be that mistake with the check taken off. Regenerate it.
 *
 * Stripping comments from JavaScript with a regex is wrong — `//` lives inside strings and
 * URLs, and `/*` inside regex literals — so this walks the file tracking whether it is
 * inside a string, a template literal or a regex. That is enough to be careful and not
 * enough to be trusted, which is why the only thing that makes the output usable is:
 *
 *   node test/compact.mjs && <point the suites at it and run them>
 *
 * Done that way this copy passed all 96 sim checks and all 50 UI checks unchanged.
 *
 * Run:  node test/compact.mjs [outfile]
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src  = readFileSync(resolve(ROOT, 'matchbox.html'), 'utf8');
const dest = process.argv[2] || resolve(ROOT, 'matchbox-compact.html');

const out = [];
let i = 0, mode = null;          // null | ' | " | ` | regex
while (i < src.length){
  const c = src[i];
  if (mode === null){
    if (c === '/' && src[i+1] === '*'){ i = src.indexOf('*/', i+2) + 2; continue; }
    if (c === '/' && src[i+1] === '/'){ const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    if (c === '/'){
      // A regex literal, but only where a value may start — otherwise it is division.
      let k = out.length - 1;
      while (k >= 0 && ' \t\n'.includes(out[k])) k--;
      if (k < 0 || '(,=:[!&|?{};+-*%<>~^'.includes(out[k])) mode = 'regex';
      out.push(c); i++; continue;
    }
    if (c === "'" || c === '"' || c === '`') mode = c;
    out.push(c); i++; continue;
  }
  if (c === '\\'){ out.push(c, src[i+1] ?? ''); i += 2; continue; }
  if (mode === 'regex'){ if (c === '\n' || c === '/') mode = null; }
  else if (c === mode) mode = null;
  out.push(c); i++;
}

const text = out.join('')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n');

writeFileSync(dest, text);
const kb = n => (n/1024).toFixed(0) + 'kB';
console.log(`${kb(src.length)} → ${kb(text.length)}  ·  ~${Math.round(text.length/4/1000)}k tokens  ·  ${dest}`);
console.log('Verify it before handing it over: point the two suites at this file and run them.');
