# Ask the evidence: optional Claude worker

The app answers evidence questions on its own, in the browser, from the retained records. This
worker is optional. When it is deployed and its URL is given to the build, Claude adds one framing
sentence to each answer and chooses the order of the records. The figures a reader sees are still
the retained records, shown verbatim; the page discards any framing that carries a figure or a
judgement and falls back to the assembled answer.

## What it does

- Accepts `POST {question, records: [{id, text}]}` from the one origin in `ALLOWED_ORIGIN`.
- Calls Claude Opus 5.5 (`claude-opus-5-5`) at low effort with a JSON schema, so the reply is
  always `{covered, framing, citations}`.
- Server-side fallback is on (`fallbacks: "default"`): if a request is declined, the API retries it
  on a fallback model instead of returning nothing. Remove the two lines marked in `src/index.ts`
  to turn it off.
- Returns only citations that name a record the page sent.
- Sees only what the page sends. It has no data lake access and keeps nothing.

## Deploy

You need a Cloudflare account and an Anthropic API key. Run these yourself; the key is entered
at the prompt and never stored in the repository.

```bash
cd worker/ask-evidence
```

```bash
npm install
```

```bash
npx wrangler secret put ANTHROPIC_API_KEY
```

```bash
npx wrangler deploy
```

Then set a repository variable named `ASK_EVIDENCE_URL` to the worker's URL (GitHub: Settings →
Secrets and variables → Actions → Variables). The next Pages deploy passes it to the build as
`NEXT_PUBLIC_ASK_EVIDENCE_URL`. Without it, the app keeps answering from the browser alone.

## Limits worth setting

- A Cloudflare rate-limiting binding named `RATE_LIMITER` (optional; the worker uses it when present).
- A monthly spend limit on the Anthropic workspace that owns the key.
