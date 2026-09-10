import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * React 19 renders <title> only when it has a single child. Given several JSX children
 * the server emits an empty <title></title> while the client fills it in, and every
 * hydration of that tree fails, React then discards the prerendered HTML and re-renders
 * the whole page, which on a static host is visible as a flash on first load.
 *
 * The SVG tooltips on the ULB radar broke every route this way. The rule is cheap to
 * hold: build the string first, hand <title> one child.
 */
function titleChildren(body: string): number {
  let children = 0;
  let depth = 0;
  let text = '';
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i];
    if (ch === '{') {
      if (depth === 0) {
        if (text.trim()) children += 1;
        text = '';
        children += 1;
      }
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
    } else if (depth === 0) {
      text += ch;
    }
  }
  if (text.trim()) children += 1;
  return children;
}

describe('SVG titles survive hydration', () => {
  const dir = resolve(process.cwd(), 'app');
  const files = readdirSync(dir).filter((name) => name.endsWith('.tsx'));

  it('gives every <title> exactly one child', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const source = readFileSync(resolve(dir, file), 'utf8');
      for (const match of source.matchAll(/<title>([\s\S]*?)<\/title>/g)) {
        const count = titleChildren(match[1]);
        if (count > 1) offenders.push(`${file}: <title> has ${count} children — ${match[1].slice(0, 70)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('counts children the way JSX does', () => {
    expect(titleChildren('Synthetic operational pulse trend')).toBe(1);
    expect(titleChildren('{`${a} · ${b}`}')).toBe(1);
    expect(titleChildren('{row ? `${row.district}: ${row.detail}` : shape.d}')).toBe(1);
    // The shape that broke: separate expressions with literal text between them.
    // Whitespace-only text between expressions is skipped here, so this is a lower
    // bound on JSX's own count, which is all the rule needs.
    expect(titleChildren('{a}: {b} {c}')).toBeGreaterThan(1);
    expect(titleChildren('{a} · {b} collection')).toBeGreaterThan(1);
    expect(titleChildren('{a}{b}')).toBe(2);
  });
});
