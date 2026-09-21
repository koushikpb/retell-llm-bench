import { describe, it, expect } from 'vitest';
import { lineDiff } from '../src/bench/diff.js';

describe('lineDiff', () => {
  it('prints only context lines when the transcripts match', () => {
    expect(lineDiff(['a', 'b'], ['a', 'b'])).toBe('--- expected\n+++ actual\n a\n b');
  });
  it('marks removed lines with - and added lines with +, keeping common lines in place', () => {
    expect(lineDiff(['a', 'b', 'c'], ['a', 'x', 'c'])).toBe('--- expected\n+++ actual\n a\n-b\n+x\n c');
  });
  it('handles an empty side', () => {
    expect(lineDiff([], ['Okay.'])).toBe('--- expected\n+++ actual\n+Okay.');
    expect(lineDiff(['Okay.'], [])).toBe('--- expected\n+++ actual\n-Okay.');
  });
});
