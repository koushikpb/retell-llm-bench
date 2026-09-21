import { readFileSync, writeFileSync } from 'node:fs';

const text = readFileSync('docs/smoke.txt', 'utf8');
const lines = text.split('\n');
const totalMs = 45000;
const perLine = Math.max(40, Math.floor(totalMs / Math.max(1, lines.length)));
const escaped = JSON.stringify(lines);
const html = `<!doctype html>
<meta charset="utf-8">
<title>retell-llm-bench</title>
<style>
  body { margin: 0; background: #111; color: #e6e6e6; font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
  #out { white-space: pre; padding: 20px; }
  .prompt { color: #7ee787; }
</style>
<div id="out"><span class="prompt">$ npm run smoke</span>
</div>
<script>
  const lines = ${escaped};
  const out = document.getElementById('out');
  let i = 0;
  const tick = () => {
    if (i >= lines.length) return;
    out.appendChild(document.createTextNode(lines[i] + '\\n'));
    window.scrollTo(0, document.body.scrollHeight);
    i += 1;
    setTimeout(tick, ${perLine});
  };
  setTimeout(tick, 800);
</script>
`;
writeFileSync('docs/replay.html', html);
console.log(`wrote docs/replay.html (${lines.length} lines, ${perLine} ms per line)`);
