import { readFileSync, writeFileSync } from 'node:fs';
import { renderMarkdown, type BenchReport } from './report.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: tsx src/bench/results-md.ts <results.json> <results.md>');
  process.exit(1);
}
const report = JSON.parse(readFileSync(input, 'utf8')) as BenchReport;
writeFileSync(output, renderMarkdown(report));
console.log(`wrote ${output}`);
