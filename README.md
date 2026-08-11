# Proof Before Post

> Pause. Check the evidence. Then post.

Proof Before Post is a bilingual media and information literacy experience that helps young digital creators examine the evidence behind a draft before it reaches an audience. The product guides reflection without asking AI to issue a truth verdict.

**Live demo:** [proof-before-post.corujarh-3863.chatgpt.site](https://proof-before-post.corujarh-3863.chatgpt.site)

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

- Guided UNESCO demonstration that works without an API.
- Free-draft review with up to three claims.
- Portuguese and English interface.
- Human-controlled evidence assessment and editorial decision.
- Original-versus-revised draft comparison.
- Evidence Receipt download as PNG.
- Copyable receipt summary.
- Browser text-to-speech for guiding questions.
- Responsive layout, keyboard navigation and reduced-motion support.
- No account, database or secret key required.

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

All draft data stays in the current browser state. The repository contains no API key and requires no `.env` file.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
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
3. Leave environment variables empty.
4. Select **Deploy**.

## Project structure

```text
proof-before-post/
├── .github/workflows/ci.yml
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── public/
│   └── favicon.svg
├── tests/
│   └── product-guardrails.test.mjs
├── LICENSE
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Current MVP limits

The free-draft flow uses transparent, local sentence-based prompts instead of claiming automated fact verification. The guided demonstration uses a controlled UNESCO scenario. A future model integration should use structured outputs and preserve the same human-decision guardrails.

## Portuguese summary

O Proof Before Post ajuda jovens criadores a revisar as evidências de um conteúdo antes da publicação. A ferramenta orienta perguntas, registra a decisão humana e gera um Evidence Receipt, sem declarar que o conteúdo é verdadeiro ou falso.

Para executar:

```bash
npm install
npm run dev
```

## Author

Developed by [Geovanna Eduarda da Silva](https://github.com/geovannasilva15).

## License

MIT License. See [LICENSE](LICENSE).
