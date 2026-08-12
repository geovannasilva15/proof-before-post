export type Language = "en" | "pt";

export type ClaimTone = "amber" | "violet" | "teal";

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  authorOrInstitution: string;
  publishedAt: string;
  sourceType: string;
  measuredOrReported: string;
  doesNotEstablish: string;
  contextLimitations: string;
  relationSummary: string;
  accessedAt: string;
  provenance: "research" | "user" | "demo";
};

export type Claim = {
  id: string;
  text: string;
  category: string;
  reason: string;
  question: string;
  tone: ClaimTone;
  sourceIds: string[];
};

export type AnalysisResult = {
  mode: "live" | "demo";
  language: Language;
  researchSummary: string;
  claims: Claim[];
  sources: ResearchSource[];
  searchedAt: string;
};

export type AnalysisErrorCode =
  | "CONFIGURATION_ERROR"
  | "INVALID_REQUEST"
  | "NO_VERIFIABLE_CLAIMS"
  | "NO_VERIFIED_SOURCES"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "UPSTREAM_ERROR";

export type AnalysisErrorPayload = {
  error: string;
  code: AnalysisErrorCode;
};

const tones: ClaimTone[] = ["amber", "violet", "teal"];

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "pt";
}

export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".local") || hostname === "::1") return false;
    if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return false;
    const private172 = hostname.match(/^172\.(\d{1,3})\./);
    if (private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  url.search = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString().replace(/\/$/, "");
}

export function validateAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<AnalysisResult>;
  if (result.mode !== "live" && result.mode !== "demo") return false;
  if (!isLanguage(result.language) || typeof result.researchSummary !== "string") return false;
  if (typeof result.searchedAt !== "string") return false;
  if (!Array.isArray(result.claims) || result.claims.length < 1 || result.claims.length > 3) return false;
  if (!Array.isArray(result.sources) || result.sources.length < 1 || result.sources.length > 6) return false;

  const sourceIds = new Set<string>();
  for (const source of result.sources) {
    if (!source || typeof source !== "object") return false;
    if (
      typeof source.id !== "string" ||
      typeof source.title !== "string" ||
      !isHttpsUrl(source.url) ||
      typeof source.authorOrInstitution !== "string" ||
      typeof source.publishedAt !== "string" ||
      typeof source.sourceType !== "string" ||
      typeof source.measuredOrReported !== "string" ||
      typeof source.doesNotEstablish !== "string" ||
      typeof source.contextLimitations !== "string" ||
      typeof source.relationSummary !== "string" ||
      typeof source.accessedAt !== "string" ||
      !["research", "user", "demo"].includes(source.provenance)
    ) return false;
    sourceIds.add(source.id);
  }

  return result.claims.every((claim) =>
    Boolean(claim) &&
    typeof claim.id === "string" &&
    typeof claim.text === "string" &&
    typeof claim.category === "string" &&
    typeof claim.reason === "string" &&
    typeof claim.question === "string" &&
    tones.includes(claim.tone) &&
    Array.isArray(claim.sourceIds) &&
    claim.sourceIds.every((id) => sourceIds.has(id)),
  );
}
