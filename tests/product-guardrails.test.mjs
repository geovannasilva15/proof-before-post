import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [page, route, analysis, i18n, narrator, receiptSource, revisionSource, demoText] = await Promise.all([
  read("../app/page.tsx"), read("../app/api/analyze/route.ts"), read("../lib/analysis.ts"),
  read("../lib/i18n.ts"), read("../hooks/useNarrator.ts"), read("../lib/receipt.ts"),
  read("../lib/revision.ts"), read("../data/guided-demo.json"),
]);

async function importTypeScript(source) {
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

const revision = await importTypeScript(revisionSource);
const receipt = await importTypeScript(receiptSource);
const demo = JSON.parse(demoText);

const claim = {
  id: "c1", text: "Coffee cures every headache.", category: "Generalization", reason: "Too broad",
  question: "What was measured?", tone: "amber", sourceIds: ["s1"],
};
const source = {
  id: "s1", title: "A real study", url: "https://example.org/study", authorOrInstitution: "Example Institute",
  publishedAt: "2026-01-01", sourceType: "Study", measuredOrReported: "The study reported an association in a limited sample.",
  doesNotEstablish: "It did not establish a cure for every type of headache.", contextLimitations: "Small sample.",
  relationSummary: "The evidence is narrower than the claim.", accessedAt: "2026-08-12", provenance: "research",
};
const draft = "Opening sentence. Coffee cures every headache. Closing sentence.";

test("uses a complete, editable evidence-source model", () => {
  for (const field of ["authorOrInstitution", "sourceType", "measuredOrReported", "doesNotEstablish", "contextLimitations", "relationSummary", "accessedAt", "provenance"]) {
    assert.match(analysis, new RegExp(field));
    assert.match(page, new RegExp(field));
  }
  assert.match(page, /provenance: "user"/);
});

test("keeps the guided UNESCO data in one dedicated file with exact metadata", () => {
  assert.equal(demo.source.authorOrInstitution, "UNESCO");
  assert.equal(demo.source.publishedAt, "2024-11-26");
  assert.equal(demo.pt.claims.length, 3);
  assert.equal(demo.en.claims.length, 3);
  assert.match(demo.source.title, /2\/3 of digital content creators/);
  assert.match(demo.sourceUrl, /^https:\/\/www\.unesco\.org\//);
  assert.match(page, /guided-demo\.json/);
});

test("performs live web research and only accepts URLs returned by web search", () => {
  assert.match(route, /type: "web_search", external_web_access: true/);
  assert.match(route, /tool_choice: "required"/);
  assert.match(route, /web_search_call\.action\.sources/);
  assert.match(route, /collectVerifiedSources/);
  assert.match(route, /verified\.get\(normalized\)/);
  assert.match(route, /title: webSource\.title/);
  assert.match(route, /store: false/);
});

test("does not silently replace failed research with demo content", () => {
  assert.match(i18n, /Nenhuma resposta simulada foi exibida/);
  assert.match(i18n, /No simulated answer was displayed/);
  assert.match(page, /analysisError/);
  assert.match(page, /start\(true\)/);
});

test("correct action changes only the selected claim", () => {
  const result = revision.buildSuggestedRevision(draft, claim, source, "correct", "en");
  assert.equal(result, "Opening sentence. The study reported an association in a limited sample. Closing sentence.");
});

test("context action includes the measured result and limitation", () => {
  const result = revision.buildSuggestedRevision(draft, claim, source, "context", "en");
  assert.match(result, /reported an association/);
  assert.match(result, /did not establish a cure/);
  assert.match(result, /^Opening sentence\./);
  assert.match(result, /Closing sentence\.$/);
});

test("remove action preserves unrelated draft content", () => {
  const result = revision.buildSuggestedRevision(draft, claim, source, "remove", "en");
  assert.equal(result, "Opening sentence. Closing sentence.");
});

test("find-better-evidence action marks the claim as unresolved", () => {
  const result = revision.buildSuggestedRevision(draft, claim, source, "research", "en");
  assert.match(result, /\[EVIDENCE PENDING: Coffee cures every headache\.\]/);
  assert.ok(revision.diffDrafts(draft, result, true).revised.some((part) => part.kind === "pending"));
});

test("requires a human support choice and justification before continuing", () => {
  assert.match(page, /supportJustification\.trim\(\)\.length < 3/);
  assert.match(page, /aria-pressed=\{support === item\.id\}/);
  assert.doesNotMatch(page, /setSupport\("supports"\)/);
});

test("preserves a manual revision when navigating back without changing the action", () => {
  assert.match(page, /if \(revisionAction !== action \|\| !revised\)/);
  assert.match(page, /setRevisionAction\(action\)/);
  assert.doesNotMatch(page, /setRevised\(draft\)/);
});

test("centralizes Portuguese and English interface copy", () => {
  assert.match(i18n, /const pt =/);
  assert.match(i18n, /const en: Record<keyof typeof pt, string>/);
  assert.match(page, /translate\(language/);
  assert.match(i18n, /Baixar resumo da publicação/);
  assert.match(i18n, /Download publication summary/);
});

test("supports play, pause, resume and stop narration in both locales", () => {
  assert.match(narrator, /pt-BR/);
  assert.match(narrator, /en-US/);
  assert.match(narrator, /speechSynthesis\.pause/);
  assert.match(narrator, /speechSynthesis\.resume/);
  assert.match(narrator, /speechSynthesis\.cancel/);
  assert.match(page, /narrator\.pause/);
  assert.match(page, /narrator\.resume/);
});

test("builds a complete bilingual publication summary", () => {
  const summary = receipt.buildReceiptSummary({
    language: "pt", claim: claim.text, source, support: "Não sustenta", justification: "A conclusão é mais ampla.",
    decision: "Corrigir a afirmação", originalDraft: draft, revisedDraft: "Revisado.", reflection: "Reduzi o alcance.", createdAt: new Date("2026-08-12T12:00:00Z"),
  });
  for (const expected of ["Autor ou instituição", "O que a fonte mediu", "Justificativa", "Trecho original", "Trecho revisado", "não certifica"]) assert.match(summary, new RegExp(expected, "i"));
});

test("downloads a PNG with a stable filename and delayed URL cleanup", () => {
  assert.match(receiptSource, /proof-before-post-resumo-/);
  assert.match(receiptSource, /document\.body\.appendChild\(link\)/);
  assert.match(receiptSource, /setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 1500\)/);
  assert.match(page, /downloadState === "loading"/);
  assert.match(page, /aria-live="polite"/);
});

test("copies the summary with a fallback when Clipboard API is unavailable", () => {
  assert.match(page, /navigator\.clipboard\?\.writeText/);
  assert.match(page, /document\.execCommand\("copy"\)/);
  assert.match(page, /setCopyError\(true\)/);
});

test("keeps the key ethical disclaimer in both languages", () => {
  assert.match(i18n, /Ele não certifica que o conteúdo seja verdadeiro/);
  assert.match(i18n, /It does not certify that the content is true/);
  assert.match(receiptSource, /Ele não certifica que o conteúdo seja verdadeiro/);
  assert.match(receiptSource, /It does not certify that the content is true/);
});
