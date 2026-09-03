import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('claim language', () => {
  it('does not ship unsupported claim phrases in the interface', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/lab-app.tsx'), 'utf8').toLowerCase();
    const forbidden = ['root cause', 'optimal action', 'underutilized', 'real-time', 'will improve', 'ai has proven'];
    for (const phrase of forbidden) expect(source).not.toContain(phrase);
  });
});
