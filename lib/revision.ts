import type { Claim, Language, ResearchSource } from "./analysis";

export type EditorialAction = "correct" | "context" | "remove" | "transparent" | "research";

function cleanAfterRemoval(value: string) {
  return value
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/([.!?])\1+/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function replacementFor(action: EditorialAction, claim: Claim, source: ResearchSource, language: Language) {
  const measured = ensureSentence(source.measuredOrReported);
  const limitation = ensureSentence(source.doesNotEstablish);
  if (action === "correct") return measured;
  if (action === "context") return `${measured} ${limitation}`.trim();
  if (action === "transparent") {
    const bridge = language === "pt" ? "Limitação da evidência:" : "Evidence limitation:";
    return `${ensureSentence(claim.text)} ${bridge} ${limitation}`.trim();
  }
  if (action === "research") {
    const marker = language === "pt" ? "PENDENTE DE EVIDÊNCIA" : "EVIDENCE PENDING";
    return `[${marker}: ${claim.text.trim()}]`;
  }
  return "";
}

export function buildSuggestedRevision(
  draft: string,
  claim: Claim,
  source: ResearchSource,
  action: EditorialAction,
  language: Language,
) {
  const index = draft.indexOf(claim.text);
  if (index < 0) return draft;
  const before = draft.slice(0, index);
  const after = draft.slice(index + claim.text.length);
  if (action === "remove") return cleanAfterRemoval(`${before}${after}`);
  return cleanAfterRemoval(`${before}${replacementFor(action, claim, source, language)}${after}`);
}

export type DiffPart = { text: string; kind: "same" | "removed" | "added" | "pending" };

export function diffDrafts(original: string, revised: string, pending: boolean) {
  let prefix = 0;
  const maxPrefix = Math.min(original.length, revised.length);
  while (prefix < maxPrefix && original[prefix] === revised[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < original.length - prefix &&
    suffix < revised.length - prefix &&
    original[original.length - 1 - suffix] === revised[revised.length - 1 - suffix]
  ) suffix += 1;

  const originalMiddle = original.slice(prefix, original.length - suffix || undefined);
  const revisedMiddle = revised.slice(prefix, revised.length - suffix || undefined);
  const samePrefix = original.slice(0, prefix);
  const sameSuffix = suffix ? original.slice(original.length - suffix) : "";

  return {
    original: [
      { text: samePrefix, kind: "same" },
      { text: originalMiddle, kind: "removed" },
      { text: sameSuffix, kind: "same" },
    ].filter((part) => part.text) as DiffPart[],
    revised: [
      { text: samePrefix, kind: "same" },
      { text: revisedMiddle, kind: pending ? "pending" : "added" },
      { text: sameSuffix, kind: "same" },
    ].filter((part) => part.text) as DiffPart[],
  };
}

