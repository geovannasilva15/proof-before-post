import assert from "node:assert/strict";
import test from "node:test";
import { loadTsModule } from "./helpers/load-lib.mjs";

const review = await loadTsModule("lib/review.ts");
const analysis = await loadTsModule("lib/analysis.ts");

const {
  reflectionForAction,
  stateAfterClaimSelection,
  stateAfterSourceSelection,
  revisionForNextStep,
  isReceiptCoherent,
  noteForSource,
  updateSourceNote,
} = review;

const {
  normalizeUrl,
  isHttpsUrl,
  isLanguage,
  validateAnalysisResult,
} = analysis;

test("selecting a new claim clears all previous editorial decisions", () => {
  const state = stateAfterClaimSelection("claim-2", "source-2");
  assert.equal(state.selectedClaimId, "claim-2");
  assert.equal(state.selectedSourceId, "source-2");
  assert.equal(state.support, "");
  assert.equal(state.action, "");
  assert.equal(state.revised, "");
  assert.equal(state.reflection, "");
});

test("selecting a different source clears only the support assessment", () => {
  const before = {
    selectedClaimId: "claim-1",
    selectedSourceId: "source-1",
    support: "does_not_support",
    action: "correct",
    revised: "edited version",
    reflection: "narrowed",
  };
  const after = stateAfterSourceSelection(before, "source-2");
  assert.equal(after.selectedSourceId, "source-2");
  assert.equal(after.support, "");
  assert.equal(after.action, "correct");
  assert.equal(after.revised, "edited version");
  assert.equal(after.reflection, "narrowed");
});

test("keeps an existing revision when returning to the revision step", () => {
  assert.equal(revisionForNextStep("original", "my edited version"), "my edited version");
  assert.equal(revisionForNextStep("original", ""), "original");
});

test("maps every editorial decision to exactly one reflection", () => {
  assert.equal(reflectionForAction.correct, "narrowed");
  assert.equal(reflectionForAction.context, "context");
  assert.equal(reflectionForAction.remove, "removed");
  assert.equal(reflectionForAction.transparent, "uncertainty");
  assert.equal(reflectionForAction.research, "research");
});

test("does not produce a receipt when nothing changed", () => {
  const coherent = isReceiptCoherent({
    draft: "Same text",
    revised: "Same text",
    claimText: "a claim",
    action: "correct",
    reflection: "narrowed",
  });
  assert.equal(coherent, false);
});

test("does not produce a receipt when the reflection contradicts the decision", () => {
  const coherent = isReceiptCoherent({
    draft: "original draft",
    revised: "revised draft",
    claimText: "a claim",
    action: "transparent",
    reflection: "removed",
  });
  assert.equal(coherent, false);
});

test("does not produce a receipt when the claim was supposedly removed but still appears", () => {
  const coherent = isReceiptCoherent({
    draft: "Original with a claim.",
    revised: "The same text with a claim still here.",
    claimText: "a claim",
    action: "remove",
    reflection: "removed",
  });
  assert.equal(coherent, false);
});

test("produces a receipt only when the revision changed and reflection matches the decision", () => {
  const coherent = isReceiptCoherent({
    draft: "original draft",
    revised: "revised draft",
    claimText: "a claim",
    action: "context",
    reflection: "context",
  });
  assert.equal(coherent, true);
});

test("accepts a receipt when the claim was actually removed", () => {
  const coherent = isReceiptCoherent({
    draft: "This draft has a claim.",
    revised: "This draft no longer mentions it.",
    claimText: "a claim",
    action: "remove",
    reflection: "removed",
  });
  assert.equal(coherent, true);
});

test("source notes are stored per source", () => {
  const notes = updateSourceNote(
    updateSourceNote({}, "source-1", "note about the first source"),
    "source-2", "note about the second source",
  );
  assert.equal(noteForSource(notes, "source-1"), "note about the first source");
  assert.equal(noteForSource(notes, "source-2"), "note about the second source");
  assert.equal(noteForSource(notes, "source-3"), "");
  assert.equal(noteForSource(notes, ""), "");
});

test("normalizeUrl keeps content parameters so different pages stay distinct", () => {
  const first = normalizeUrl("https://site.example/noticia?id=123&utm_source=x");
  const second = normalizeUrl("https://site.example/noticia?id=999&utm_source=x");
  assert.notEqual(first, second);
  assert.ok(first.includes("id=123"));
  assert.ok(second.includes("id=999"));
  assert.ok(!first.includes("utm_source"));
});

test("normalizeUrl drops only tracking parameters", () => {
  const normalized = normalizeUrl("https://site.example/a?fbclid=abc&gclid=def&keep=1");
  assert.ok(!normalized.includes("fbclid"));
  assert.ok(!normalized.includes("gclid"));
  assert.ok(normalized.includes("keep=1"));
});

test("isHttpsUrl rejects unsafe or local addresses", () => {
  assert.equal(isHttpsUrl("http://site.example/"), false);
  assert.equal(isHttpsUrl("https://localhost/x"), false);
  assert.equal(isHttpsUrl("https://192.168.1.1/x"), false);
  assert.equal(isHttpsUrl("https://example.com/x"), true);
});

test("isLanguage accepts only the supported languages", () => {
  assert.equal(isLanguage("en"), true);
  assert.equal(isLanguage("pt"), true);
  assert.equal(isLanguage("fr"), false);
  assert.equal(isLanguage(undefined), false);
});

test("validateAnalysisResult rejects results without claims or sources", () => {
  assert.equal(validateAnalysisResult(null), false);
  assert.equal(validateAnalysisResult({
    mode: "live",
    language: "en",
    researchSummary: "Summary",
    summarySourceIds: [],
    claims: [],
    sources: [],
    searchedAt: "2024-01-01T00:00:00.000Z",
  }), false);
});

test("validateAnalysisResult accepts a complete live result", () => {
  const valid = {
    mode: "live",
    language: "pt",
    researchSummary: "Resumo da pesquisa.",
    summarySourceIds: ["s1"],
    claims: [{
      id: "c1",
      text: "Afirmação verificável.",
      category: "Categoria",
      reason: "Razão.",
      question: "Pergunta?",
      tone: "amber",
      sourceIds: ["s1"],
    }],
    sources: [{
      id: "s1",
      title: "Título da fonte",
      url: "https://example.com/pagina",
      publisher: "Editora",
      publishedAt: "2024",
      excerpt: "Trecho.",
      relevance: "Relevância.",
    }],
    searchedAt: "2024-01-01T00:00:00.000Z",
  };
  assert.equal(validateAnalysisResult(valid), true);
});
