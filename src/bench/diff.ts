// Unified-style line diff of two transcripts: "--- expected", "+++ actual", then one line per entry
// prefixed with " " (common), "-" (only in expected) or "+" (only in actual).
export function lineDiff(expected: string[], actual: string[]): string {
  const n = expected.length;
  const m = actual.length;
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = expected[i] === actual[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const out = ['--- expected', '+++ actual'];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && expected[i] === actual[j]) {
      out.push(` ${expected[i]}`);
      i += 1;
      j += 1;
    } else if (j < m && (i >= n || lcs[i][j + 1] > lcs[i + 1][j])) {
      out.push(`+${actual[j]}`);
      j += 1;
    } else {
      out.push(`-${expected[i]}`);
      i += 1;
    }
  }
  return out.join('\n');
}
