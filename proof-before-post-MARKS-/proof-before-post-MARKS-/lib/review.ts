export type SupportId = "supports" | "partial" | "does_not_support" | "insufficient";
export type ActionId = "correct" | "context" | "remove" | "transparent" | "research";
export type ReflectionId = "narrowed" | "context" | "uncertainty" | "removed" | "research";

export type ReviewDecisionState = {
  selectedClaimId: string;
  selectedSourceId: string;
  support: SupportId | "";
  action: ActionId | "";
  revised: string;
  reflection: ReflectionId | "";
};

export const reflectionForAction: Record<ActionId, ReflectionId> = {
  correct: "narrowed",
  context: "context",
  remove: "removed",
  transparent: "uncertainty",
  research: "research",
};

export function stateAfterClaimSelection(claimId: string, sourceId: string): ReviewDecisionState {
  return {
    selectedClaimId: claimId,
    selectedSourceId: sourceId,
    support: "",
    action: "",
    revised: "",
    reflection: "",
  };
}

export function stateAfterSourceSelection(state: ReviewDecisionState, sourceId: string): ReviewDecisionState {
  return { ...state, selectedSourceId: sourceId, support: "" };
}

export function revisionForNextStep(draft: string, currentRevision: string) {
  return currentRevision.trim() ? currentRevision : draft;
}

function comparable(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

export function isReceiptCoherent({
  draft,
  revised,
  claimText,
  action,
  reflection,
}: {
  draft: string;
  revised: string;
  claimText: string;
  action: ActionId | "";
  reflection: ReflectionId | "";
}) {
  if (!action || action === "research" || !reflection || reflectionForAction[action] !== reflection) return false;
  const normalizedDraft = comparable(draft);
  const normalizedRevision = comparable(revised);
  if (!normalizedRevision || normalizedRevision === normalizedDraft) return false;
  if (action === "remove" && normalizedRevision.includes(comparable(claimText))) return false;
  return true;
}

export function noteForSource(notes: Record<string, string>, sourceId: string) {
  return sourceId ? notes[sourceId] ?? "" : "";
}

export function updateSourceNote(notes: Record<string, string>, sourceId: string, note: string) {
  return sourceId ? { ...notes, [sourceId]: note } : notes;
}
