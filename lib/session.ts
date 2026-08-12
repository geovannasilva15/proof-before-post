import type { AnalysisResult, Language, ResearchSource } from "./analysis";
import type { EditorialAction } from "./revision";

export type SupportDecision = "supports" | "partial" | "does_not_support" | "insufficient";
export type ReflectionDecision = "narrowed" | "context" | "uncertainty" | "removed" | "research";
export type SessionStatus = "in_progress" | "completed" | "completed_with_pending";

export type ComparisonNotes = {
  convergence: string;
  divergences: string;
  methodologyDifferences: string;
  scopeDifferences: string;
  missingInformation: string;
};

export type RevisionCitation = {
  id: string;
  revisedTextStart: number;
  revisedTextEnd: number;
  sourceId: string;
  citedText: string;
  note?: string;
  broken?: boolean;
};

export type ReviewSession = {
  version: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  language: Language;
  step: number;
  draft: string;
  analysis: AnalysisResult | null;
  selectedClaimId: string;
  selectedSourceIds: string[];
  primarySourceId: string;
  sources: ResearchSource[];
  support: SupportDecision | "";
  supportJustification: string;
  action: EditorialAction | "";
  revised: string;
  translatedDraft: string;
  reflection: ReflectionDecision | "";
  comparisonNotes: ComparisonNotes;
  citations: RevisionCitation[];
  checklist: string[];
  pendingAcknowledged: boolean;
  sourceNotes: string;
  status: SessionStatus;
};

export const EMPTY_COMPARISON_NOTES: ComparisonNotes = {
  convergence: "",
  divergences: "",
  methodologyDifferences: "",
  scopeDifferences: "",
  missingInformation: "",
};

export const SESSION_STORAGE_KEY = "proof-before-post:review-sessions:v1";

export function createSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isReviewSession(value: unknown): value is ReviewSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<ReviewSession>;
  return session.version === 1 && typeof session.id === "string" && typeof session.createdAt === "string" &&
    typeof session.updatedAt === "string" && (session.language === "pt" || session.language === "en") &&
    typeof session.draft === "string" && Array.isArray(session.selectedSourceIds) && Array.isArray(session.citations) &&
    Array.isArray(session.checklist) && ["in_progress", "completed", "completed_with_pending"].includes(session.status ?? "");
}

export function readSessions(storage: Pick<Storage, "getItem">) {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(SESSION_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isReviewSession).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

export function writeSessions(storage: Pick<Storage, "setItem">, sessions: ReviewSession[]) {
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions.slice(0, 50)));
}

export function upsertSession(storage: Pick<Storage, "getItem" | "setItem">, session: ReviewSession) {
  const sessions = readSessions(storage).filter((item) => item.id !== session.id);
  writeSessions(storage, [session, ...sessions]);
  return [session, ...sessions];
}

export function removeSession(storage: Pick<Storage, "getItem" | "setItem">, id: string) {
  const sessions = readSessions(storage).filter((item) => item.id !== id);
  writeSessions(storage, sessions);
  return sessions;
}

export function duplicateSession(session: ReviewSession): ReviewSession {
  const now = new Date().toISOString();
  return { ...session, id: createSessionId(), createdAt: now, updatedAt: now, status: "in_progress" };
}

export function clearSessions(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(SESSION_STORAGE_KEY);
}

export function reanchorCitations(text: string, citations: RevisionCitation[]) {
  return citations.map((citation) => {
    if (!citation.citedText) return { ...citation, broken: true };
    const first = text.indexOf(citation.citedText);
    const unique = first >= 0 && text.indexOf(citation.citedText, first + 1) < 0;
    return unique
      ? { ...citation, revisedTextStart: first, revisedTextEnd: first + citation.citedText.length, broken: false }
      : { ...citation, broken: true };
  });
}
