/**
 * Build a fully static site for GitHub Pages (or any static host).
 *
 *   node scripts/build-static.mjs [--base /repo-name]
 *
 * vinext targets a server (Cloudflare Workers) by default, but this app has no
 * request-time server features, so `--prerender-all` emits real HTML for every
 * route. This script runs that build and assembles the output Pages needs:
 *
 *  - directory-style routes (foo/index.html), so /foo and /foo/ both resolve on
 *    any host, not only ones that map /foo -> foo.html;
 *  - the client assets (_next, /assets, geojson) beside them;
 *  - app/icon.svg, which the prerender references but does not copy;
 *  - .nojekyll — without it GitHub Pages runs Jekyll and drops _next/ (leading
 *    underscore), which silently 404s every script and stylesheet.
 *
 * Pass --base when hosting under a project subpath (username.github.io/repo). It
 * is written to a marker file for the deploy step; asset rewriting for a subpath
 * is handled by next.config basePath, set separately.
 */
import { cp, mkdir, readdir, rename, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const OUT = resolve(process.cwd(), 'dist-static');
const CLIENT = resolve(process.cwd(), 'dist/client');
const ROUTES = resolve(process.cwd(), 'dist/server/prerendered-routes');

async function main() {
  const baseArg = process.argv.indexOf('--base');
  const basePath = baseArg >= 0 ? (process.argv[baseArg + 1] ?? '').replace(/\/$/, '') : '';
  console.log('[1/4] vinext build --prerender-all' + (basePath ? ` (assetPrefix ${basePath})` : ''));
  execSync('npx vinext build --prerender-all', { stdio: 'inherit', env: { ...process.env, PAGES_BASE_PATH: basePath } });
  if (!existsSync(ROUTES)) throw new Error('prerendered-routes not found — did the build fail?');

  console.log('[2/4] assembling dist-static');
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  await cp(CLIENT, OUT, { recursive: true });
  await cp(ROUTES, OUT, { recursive: true });
  // Host-irrelevant / Cloudflare-only artifacts.
  for (const junk of ['_headers', '.assetsignore', 'vinext-client-entry-manifest.json', '.vite']) {
    await rm(resolve(OUT, junk), { recursive: true, force: true });
  }
  if (existsSync(resolve(process.cwd(), 'app/icon.svg'))) {
    await cp(resolve(process.cwd(), 'app/icon.svg'), resolve(OUT, 'icon.svg'));
  }

  console.log('[3/4] directory-style routes');
  await directoryStyle(OUT);
  await directoryStyle(resolve(OUT, 'diagnostics'), true);

  // assetPrefix makes vinext nest client assets under OUT/<base>/_next. dist-static is
  // itself served AT <base>, so hoist that _next up to OUT/_next or every chunk 404s.
  if (basePath) {
    const nested = resolve(OUT, basePath.replace(/^\//, ''), '_next');
    if (existsSync(nested)) {
      await cp(nested, resolve(OUT, '_next'), { recursive: true });
      await rm(resolve(OUT, basePath.replace(/^\//, '')), { recursive: true, force: true });
    }
  }

  const base = basePath;
  if (base) {
    console.log(`[4/5] rewriting absolute paths for subpath ${base}`);
    await rewriteBase(OUT, base);
  }

  console.log(`[${base ? 5 : 4}/${base ? 5 : 4}] .nojekyll`);
  await writeFile(resolve(OUT, '.nojekyll'), '');

  const pages = (await readdir(OUT, { recursive: true })).filter((f) => f.endsWith('index.html')).length;
  console.log(`\nDone. ${pages} pages in dist-static/${base ? ` (base ${base})` : ''}. Publish that folder to GitHub Pages.`);
}

/**
 * Prefix every root-absolute reference with the Pages project subpath.
 *
 * vinext's prerender does not honour Next basePath (it errors out), so the site is
 * built at root and the known absolute tokens are rewritten here instead. Each token
 * is specific enough to prefix blindly — none contains another, and the base is added
 * exactly once because the build is fresh. This covers HTML, the CSS url() references
 * a runtime helper could never reach, the route strings baked into the JS chunks, and
 * the RSC payloads used for client navigation.
 */
async function rewriteBase(dir, base) {
  // Order matters only in that longer, unambiguous tokens are safe to replace globally.
  // '/_next/' is intentionally NOT here: assetPrefix already prefixes those and the
  // webpack runtime publicPath, which a text rewrite cannot reach for lazy chunks.
  const tokens = ['/assets/', '/icon.svg', '/ap-districts.geojson',
    '/data-readiness', '/gap-radar', '/operational-analytics', '/diagnostics'];
  const files = (await readdir(dir, { recursive: true }))
    .filter((f) => /\.(html|js|rsc|json|txt|css)$/.test(f));
  let changed = 0;
  for (const rel of files) {
    const path = resolve(dir, rel);
    let text = await readFile(path, 'utf8');
    const before = text;
    if (rel.endsWith('.css')) {
      // assetPrefix rewrites public url(/assets/..) to base/_next/static/assets, but the
      // files live at base/assets. No real bundled assets sit under _next/static/assets,
      // so redirect them back. Nothing else in CSS needs the base.
      text = text.split(`${base}/_next/static/assets/`).join(`${base}/assets/`);
      if (text !== before) { await writeFile(path, text); changed += 1; }
      continue;
    }
    for (const token of tokens) {
      // Only prefix a token that is not already under the base.
      text = text.split(token).join(base + token);
      // Undo any double-prefix introduced when base + token itself contained the token.
      text = text.split(base + base + token).join(base + token);
    }
    // The home link: href="/?..." and a bare href="/".
    text = text.split('="/?').join(`="${base}/?`).split('="/"').join(`="${base}/"`);
    if (text !== before) { await writeFile(path, text); changed += 1; }
  }
  console.log(`   rewrote ${changed} files`);
}

async function directoryStyle(dir, isLeaf = false) {
  for (const f of await readdir(dir)) {
    if (!f.endsWith('.html')) continue;
    if (!isLeaf && (f === 'index.html' || f === '404.html')) continue;
    const name = f.slice(0, -5);
    await mkdir(resolve(dir, name), { recursive: true });
    await rename(resolve(dir, f), resolve(dir, name, 'index.html'));
    const rsc = resolve(dir, `${name}.rsc`);
    if (existsSync(rsc)) await rename(rsc, resolve(dir, name, 'index.rsc'));
  }
}

await main();
