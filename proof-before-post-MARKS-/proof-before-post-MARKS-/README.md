# Proof Before Post

> Pause. Check the evidence. Then post.

Proof Before Post is a bilingual media and information literacy experience that helps young digital creators examine the evidence behind a draft before it reaches an audience. The product guides reflection without asking AI to issue a truth verdict.

**Public site:** [proof-before-post.vercel.app](https://proof-before-post.vercel.app/)

## Why this matters

A UNESCO survey of 500 digital content creators in 45 countries found that 62% did not conduct rigorous and systematic fact-checking before sharing content. Proof Before Post turns that gap into a short, practical learning experience at the moment when a publishing decision can still be changed.

Source: [UNESCO — 2/3 of digital content creators do not check their facts before sharing](https://www.unesco.org/en/articles/2/3-digital-content-creators-do-not-check-their-facts-sharing-want-learn-how-do-so-unesco-survey)

## Product flow

1. Paste a caption, script or post.
2. Select one claim that deserves attention.
3. Examine the source, its scope and its context.
4. Decide whether to correct, contextualize, remove, keep transparently or seek stronger evidence.
5. Revise the draft and generate an Evidence Receipt.

The Evidence Receipt documents the creator's verification process. It does **not** certify that the content is true.

## Features

- Live web research with verifiable source links.
- Guided UNESCO demonstration that remains available without the research service.
- Free-draft review with up to three evidence-sensitive claims.
- Portuguese and English interface.
- Complete localized flow, including demo content, accessibility labels and receipt export.
- Human-controlled evidence assessment and editorial decision.
- Original-versus-revised draft comparison.
- Evidence Receipt download as PNG.
- Copyable receipt summary.
- Language-aware browser narration for questions and research context, with clear feedback when the selected voice is unavailable.
- Unicode-aware 1,500-character counting, including emoji and combined characters.
- Responsive layout, keyboard navigation and reduced-motion support.
- No account or database required for visitors.

## Ethical guardrails

Proof Before Post can organize questions and make possible evidence gaps visible. It does not:

- label content true or false;
- invent or certify sources;
- approve publication;
- replace qualified experts;
- assign artificial confidence scores;
- publish on the creator's behalf.

## Technology

- Next.js 16
- React 19
- TypeScript
- CSS
- Canvas API for receipt export
- Web Speech API for question playback
- OpenAI Responses API with web search for live, sourced research

Drafts are not stored permanently. During live research, the current draft is sent to the server-side analysis route and the configured research service for that request. The repository never contains the API key: the credential is read only by the server route from `OPENAI_API_KEY`.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run check
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Validate the project

```bash
npm run check
```

This command runs TypeScript validation, product guardrail tests and a production build.

## Deploy on Vercel

1. Import this repository into Vercel.
2. Keep the detected framework as **Next.js**.
3. Add `OPENAI_API_KEY` as a server-side environment variable.
4. Optionally set `OPENAI_MODEL`; the default is `gpt-5.5`.
5. Select **Deploy**.

Do not prefix the key with `NEXT_PUBLIC_`. A `NEXT_PUBLIC_` variable would expose the value to visitors' browsers.

## Project structure

```text
proof-before-post/
├── .github/workflows/ci.yml
├── app/
│   ├── api/analyze/route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── hooks/
│   └── useNarrator.ts
├── lib/
│   ├── analysis.ts
│   └── text.ts
├── public/
│   └── favicon.svg
├── tests/
│   └── product-guardrails.test.mjs
├── LICENSE
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Research behavior

The live flow performs web research on the server, requests structured output, and cross-checks every displayed URL against sources returned by the web-search tool. If the research service is missing, times out, or returns no verified sources, the interface shows an explicit error instead of substituting a local or simulated analysis.

The guided UNESCO scenario is clearly labeled as prepared demonstration content. Neither mode certifies that a draft is true.

## Portuguese summary

O Proof Before Post ajuda jovens criadores a revisar as evidências de um conteúdo antes da publicação. A ferramenta orienta perguntas, registra a decisão humana e gera um Evidence Receipt, sem declarar que o conteúdo é verdadeiro ou falso.

Para executar:

```bash
npm install
npm run dev
```

## Team

Developed by:

- [Geovanna Eduarda da Silva](https://github.com/geovannasilva15)
- [Matheus Barcelli Marques de Lima (Matheus Marks)](https://github.com/BRMARKS)

## License

MIT License. See [LICENSE](LICENSE).
