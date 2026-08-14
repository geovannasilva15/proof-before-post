"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import guidedDemo from "../data/guided-demo.json";
import { useNarrator, type NarratorState } from "../hooks/useNarrator";
import { useReviewHistory } from "../hooks/useReviewHistory";
import {
  isHttpsUrl,
  validateAnalysisResult,
  type AnalysisErrorCode,
  type AnalysisResult,
  type Claim,
  type Language,
  type ResearchSource,
} from "../lib/analysis";
import { translate, type TranslationKey } from "../lib/i18n";
import { buildReceiptSummary, downloadReceiptPdf, downloadReceiptPng, localizedStatus, type ReceiptData } from "../lib/receipt";
import { buildSuggestedRevision, diffDrafts, type EditorialAction } from "../lib/revision";
import {
  createSessionId, EMPTY_COMPARISON_NOTES, reanchorCitations,
  type ComparisonNotes, type ReviewSession, type RevisionCitation, type SessionStatus,
} from "../lib/session";
import { countCharacters } from "../lib/text";

type SupportId = "supports" | "partial" | "does_not_support" | "insufficient";
type ReflectionId = "narrowed" | "context" | "uncertainty" | "removed" | "research";
type RevisionOrigin = "none" | "generated" | "guided" | "manual";
type SourceField = keyof Pick<ResearchSource,
  "title" | "authorOrInstitution" | "publishedAt" | "sourceType" | "measuredOrReported" |
  "doesNotEstablish" | "contextLimitations" | "relationSummary" | "url" | "accessedAt" |
  "methodology" | "sample" | "geography" | "keyFindings"
>;

const MAX_CHARACTERS = 1500;
const CHECKLIST_IDS = ["opened", "identity", "date", "method", "limitation", "scope", "final"] as const;

function buildDemo(language: Language): AnalysisResult {
  const localized = guidedDemo[language];
  const source = guidedDemo.source;
  return {
    mode: "demo",
    language,
    searchedAt: "2024-11-26T00:00:00.000Z",
    researchSummary: localized.researchSummary,
    sources: [{
      id: source.id,
      title: source.title,
      url: guidedDemo.sourceUrl,
      authorOrInstitution: source.authorOrInstitution,
      publishedAt: source.publishedAt,
      sourceType: source.sourceType[language],
      methodology: source.methodology[language],
      sample: source.sample[language],
      geography: source.geography[language],
      keyFindings: source.keyFindings[language],
      measuredOrReported: source.measuredOrReported[language],
      doesNotEstablish: source.doesNotEstablish[language],
      contextLimitations: source.contextLimitations[language],
      relationSummary: source.relationSummary[language],
      accessedAt: new Date().toISOString().slice(0, 10),
      provenance: "demo",
    }],
    claims: localized.claims.map((claim) => ({
      ...claim,
      tone: claim.tone as Claim["tone"],
      sourceIds: [source.id],
    })),
  };
}

function getSupportOptions(language: Language) {
  return [
    { id: "supports" as const, label: translate(language, "supportSupports") },
    { id: "partial" as const, label: translate(language, "supportPartial") },
    { id: "does_not_support" as const, label: translate(language, "supportNo") },
    { id: "insufficient" as const, label: translate(language, "supportInsufficient") },
  ];
}

function getActionOptions(language: Language) {
  return [
    { id: "correct" as const, title: translate(language, "actionCorrect"), description: translate(language, "actionCorrectDescription"), icon: "✎" },
    { id: "context" as const, title: translate(language, "actionContext"), description: translate(language, "actionContextDescription"), icon: "+" },
    { id: "remove" as const, title: translate(language, "actionRemove"), description: translate(language, "actionRemoveDescription"), icon: "−" },
    { id: "transparent" as const, title: translate(language, "actionTransparent"), description: translate(language, "actionTransparentDescription"), icon: "◌" },
    { id: "research" as const, title: translate(language, "actionResearch"), description: translate(language, "actionResearchDescription"), icon: "⌕" },
  ];
}

function getReflectionOptions(language: Language) {
  return [
    { id: "narrowed" as const, label: translate(language, "reflectionNarrowed") },
    { id: "context" as const, label: translate(language, "reflectionContext") },
    { id: "uncertainty" as const, label: translate(language, "reflectionUncertainty") },
    { id: "removed" as const, label: translate(language, "reflectionRemoved") },
    { id: "research" as const, label: translate(language, "reflectionResearch") },
  ];
}

function analysisErrorMessage(language: Language, code: AnalysisErrorCode | null) {
  const keys: Record<AnalysisErrorCode, TranslationKey> = {
    CONFIGURATION_ERROR: "configurationError",
    NO_VERIFIABLE_CLAIMS: "noClaimsError",
    NO_VERIFIED_SOURCES: "noSourcesError",
    RATE_LIMITED: "rateLimitedError",
    TIMEOUT: "timeoutError",
    INVALID_RESPONSE: "invalidResponseError",
    INVALID_REQUEST: "invalidRequestError",
    UPSTREAM_ERROR: "upstreamError",
  };
  return translate(language, code ? keys[code] : "upstreamError");
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("pt");
  const [step, setStep] = useState(0);
  const [guided, setGuided] = useState(false);
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [sessionCreatedAt, setSessionCreatedAt] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [support, setSupport] = useState<SupportId | "">("");
  const [supportJustification, setSupportJustification] = useState("");
  const [action, setAction] = useState<EditorialAction | "">("");
  const [revisionAction, setRevisionAction] = useState<EditorialAction | "">("");
  const [revised, setRevised] = useState("");
  const [reflection, setReflection] = useState<ReflectionId | "">("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [downloadState, setDownloadState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [researching, setResearching] = useState(false);
  const [analysisError, setAnalysisError] = useState<AnalysisErrorCode | null>(null);
  const [needsResearchRefresh, setNeedsResearchRefresh] = useState(false);
  const [revisionTab, setRevisionTab] = useState<"original" | "revised">("revised");
  const [revisionOrigin, setRevisionOrigin] = useState<RevisionOrigin>("none");
  const [sourceEditedFields, setSourceEditedFields] = useState<SourceField[]>([]);
  const [comparisonNotes, setComparisonNotes] = useState<ComparisonNotes>(EMPTY_COMPARISON_NOTES);
  const [citations, setCitations] = useState<RevisionCitation[]>([]);
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });
  const [citationSourceId, setCitationSourceId] = useState("");
  const [citationNote, setCitationNote] = useState("");
  const [citationError, setCitationError] = useState("");
  const [checklist, setChecklist] = useState<string[]>([]);
  const [pendingAcknowledged, setPendingAcknowledged] = useState(false);
  const [translatedDraft, setTranslatedDraft] = useState("");
  const [translationState, setTranslationState] = useState<"idle" | "loading" | "error">("idle");
  const [inputMode, setInputMode] = useState<"text" | "url">("text");
  const [urlInput, setUrlInput] = useState("");
  const [extractionState, setExtractionState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [extractionPreview, setExtractionPreview] = useState("");
  const [extractionTruncated, setExtractionTruncated] = useState(false);
  const [extractionError, setExtractionError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const requestController = useRef<AbortController | null>(null);
  const revisionRef = useRef<HTMLTextAreaElement | null>(null);
  const { sessions, ready: historyReady, save: saveSession, remove: removeSavedSession, duplicate: duplicateSavedSession, clear: clearSavedSessions } = useReviewHistory();
  const narrator = useNarrator(language);
  const t = (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values);

  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = translate(language, "metaDescription");
  }, [language]);
  useEffect(() => () => requestController.current?.abort(), []);
  useEffect(() => narrator.stop, [step, language, narrator.stop]);

  const claims = analysis?.claims ?? [];
  const claim = claims.find((item) => item.id === selectedClaimId) ?? claims[0];
  const relatedSources = useMemo(() => {
    if (!analysis || !claim) return [];
    return analysis.sources.filter((item) => claim.sourceIds.includes(item.id));
  }, [analysis, claim]);
  const source = relatedSources.find((item) => item.id === selectedSourceId) ?? relatedSources[0];
  const selectedSources = relatedSources.filter((item) => selectedSourceIds.includes(item.id));
  const sourceValid = selectedSources.length > 0 && selectedSources.length <= 3 && selectedSources.every((item) => item.title.trim() && item.measuredOrReported.trim() && isHttpsUrl(item.url));
  const supportOptions = getSupportOptions(language);
  const actionOptions = getActionOptions(language);
  const reflectionOptions = getReflectionOptions(language);
  const supportLabel = supportOptions.find((item) => item.id === support)?.label ?? "";
  const actionLabel = actionOptions.find((item) => item.id === action)?.title ?? "";
  const reflectionLabel = reflectionOptions.find((item) => item.id === reflection)?.label ?? "";
  const progressLabels = [t("progressDraft"), t("progressClaim"), t("progressEvidence"), t("progressDecision"), t("progressReview")];
  const draftCount = countCharacters(draft);
  const revisedCount = countCharacters(revised);
  const draftExcess = Math.max(0, draftCount - MAX_CHARACTERS);
  const revisedExcess = Math.max(0, revisedCount - MAX_CHARACTERS);
  const diff = useMemo(() => diffDrafts(draft, revised, action === "research"), [action, draft, revised]);
  const checklistComplete = CHECKLIST_IDS.every((id) => checklist.includes(id));
  const pending = action === "research";
  const sessionStatus: SessionStatus = step < 6 ? "in_progress" : pending ? "completed_with_pending" : "completed";

  useEffect(() => {
    if (!historyReady || guided || !sessionId || step === 0) return;
    const timer = window.setTimeout(() => {
      const updatedAt = new Date().toISOString();
      saveSession({
      version: 1, id: sessionId, createdAt: sessionCreatedAt || updatedAt, updatedAt,
      language, step, draft, analysis, selectedClaimId, selectedSourceIds, primarySourceId: selectedSourceId,
      sources: analysis?.sources ?? [], support, supportJustification, action, revised, translatedDraft, reflection,
      comparisonNotes, citations, checklist, pendingAcknowledged, sourceNotes, status: sessionStatus,
      });
      setLastSavedAt(updatedAt);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [action, analysis, checklist, citations, comparisonNotes, draft, guided, historyReady, language, pendingAcknowledged, reflection, revised, saveSession, selectedClaimId, selectedSourceId, selectedSourceIds, sessionCreatedAt, sessionId, sessionStatus, sourceNotes, step, support, supportJustification, translatedDraft]);

  function resetReview() {
    requestController.current?.abort();
    requestController.current = null;
    setResearching(false);
    setSelectedClaimId("");
    setSelectedSourceId("");
    setSelectedSourceIds([]);
    setSupport("");
    setSupportJustification("");
    setAction("");
    setRevisionAction("");
    setRevised("");
    setRevisionOrigin("none");
    setSourceEditedFields([]);
    setReflection("");
    setSourceNotes("");
    setCopied(false);
    setCopyError(false);
    setDownloadState("idle");
    setPdfState("idle");
    setAnalysisError(null);
    setNeedsResearchRefresh(false);
    setComparisonNotes(EMPTY_COMPARISON_NOTES);
    setCitations([]);
    setChecklist([]);
    setPendingAcknowledged(false);
    setTranslatedDraft("");
    setTranslationState("idle");
    setExtractionState("idle");
    setExtractionPreview("");
    setExtractionTruncated(false);
    setExtractionError("");
    setLastSavedAt("");
    narrator.stop();
  }

  function start(isGuided: boolean) {
    resetReview();
    const now = new Date().toISOString();
    setSessionId(isGuided ? "" : createSessionId());
    setSessionCreatedAt(now);
    setGuided(isGuided);
    setDraft(isGuided ? guidedDemo[language].draft : "");
    setAnalysis(isGuided ? buildDemo(language) : null);
    setStep(1);
  }

  function saveAndExit() {
    if (guided || !sessionId) {
      setStep(0);
      return;
    }
    const updatedAt = new Date().toISOString();
    saveSession({
      version: 1, id: sessionId, createdAt: sessionCreatedAt || updatedAt, updatedAt,
      language, step, draft, analysis, selectedClaimId, selectedSourceIds, primarySourceId: selectedSourceId,
      sources: analysis?.sources ?? [], support, supportJustification, action, revised, translatedDraft, reflection,
      comparisonNotes, citations, checklist, pendingAcknowledged, sourceNotes, status: sessionStatus,
    });
    setLastSavedAt(updatedAt);
    setStep(0);
  }

  function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    narrator.stop();
    setLanguage(nextLanguage);
    if (guided) {
      const nextDraft = guidedDemo[nextLanguage].draft;
      const nextAnalysis = buildDemo(nextLanguage);
      let nextSource = nextAnalysis.sources[0];
      if (source && sourceEditedFields.length) {
        for (const field of sourceEditedFields) nextSource = { ...nextSource, [field]: source[field] };
        nextSource = { ...nextSource, provenance: "user" };
        nextAnalysis.sources = [nextSource];
      }
      setDraft(nextDraft);
      setAnalysis(nextAnalysis);
      const nextClaim = nextAnalysis.claims.find((item) => item.id === selectedClaimId) ?? nextAnalysis.claims[0];
      if (revisionOrigin === "guided") setRevised(guidedDemo[nextLanguage].revision);
      if (revisionOrigin === "generated" && action) {
        setRevised(buildSuggestedRevision(nextDraft, nextClaim, nextSource, action, nextLanguage));
      }
      setNeedsResearchRefresh(Boolean(
        sourceEditedFields.length || revisionOrigin === "manual" || supportJustification.trim() || sourceNotes.trim(),
      ));
    } else if (analysis?.mode === "live" && analysis.language !== nextLanguage) {
      setNeedsResearchRefresh(true);
    }
  }

  function updateDraft(value: string) {
    setDraft(value);
    if (guided) {
      setGuided(false);
      setAnalysis(null);
      resetReview();
    }
    setAnalysisError(null);
    setNeedsResearchRefresh(false);
  }

  function chooseClaim(item: Claim) {
    setSelectedClaimId(item.id);
    setSelectedSourceId(item.sourceIds[0] ?? "");
    setSelectedSourceIds(item.sourceIds.slice(0, 3));
    setSupport("");
    setSupportJustification("");
    setAction("");
    setRevisionAction("");
    setRevised("");
    setRevisionOrigin("none");
    setReflection("");
  }

  function selectSource(sourceId: string) {
    setSelectedSourceId(sourceId);
    setSelectedSourceIds((ids) => ids.includes(sourceId) ? ids : [...ids, sourceId].slice(0, 3));
    setSupport("");
    setSupportJustification("");
    setAction("");
    setRevisionAction("");
    setRevised("");
    setRevisionOrigin("none");
    setReflection("");
  }

  function toggleSource(sourceId: string) {
    setSelectedSourceIds((ids) => ids.includes(sourceId) ? ids.filter((id) => id !== sourceId) : ids.length < 3 ? [...ids, sourceId] : ids);
    if (!selectedSourceId) setSelectedSourceId(sourceId);
  }

  function updateSource(field: SourceField, value: string) {
    if (!analysis || !source) return;
    setSourceEditedFields((fields) => fields.includes(field) ? fields : [...fields, field]);
    setAnalysis({ ...analysis, sources: analysis.sources.map((item) => item.id === source.id ? { ...item, [field]: value, provenance: "user" } : item) });
  }

  function resumeSession(saved: ReviewSession) {
    resetReview();
    setSessionId(saved.id); setSessionCreatedAt(saved.createdAt); setLanguage(saved.language); setStep(Math.max(1, saved.step));
    setDraft(saved.draft); setAnalysis(saved.analysis ? { ...saved.analysis, sources: saved.sources } : null);
    setSelectedClaimId(saved.selectedClaimId); setSelectedSourceIds(saved.selectedSourceIds); setSelectedSourceId(saved.primarySourceId);
    setSupport(saved.support); setSupportJustification(saved.supportJustification); setAction(saved.action); setRevisionAction(saved.action);
    setRevised(saved.revised); setTranslatedDraft(saved.translatedDraft); setReflection(saved.reflection);
    setComparisonNotes(saved.comparisonNotes); setCitations(saved.citations); setChecklist(saved.checklist);
    setPendingAcknowledged(saved.pendingAcknowledged); setSourceNotes(saved.sourceNotes); setGuided(false);
  }

  async function extractUrl() {
    if (!urlInput.trim() || extractionState === "loading") return;
    setExtractionState("loading"); setExtractionError(""); setExtractionPreview("");
    try {
      const response = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: urlInput.trim(), language }) });
      const result = await response.json().catch(() => null) as { text?: string; code?: string; truncated?: boolean } | null;
      if (!response.ok || !result?.text) {
        const key: TranslationKey = result?.code === "UNSAFE_URL" ? "unsafeExtractionUrl" : result?.code === "INVALID_URL" ? "invalidExtractionUrl" : result?.code === "UNSUPPORTED_CONTENT" ? "unsupportedExtraction" : result?.code === "NO_CONTENT" ? "noExtractedContent" : "extractionUnavailable";
        setExtractionError(t(key)); setExtractionState("error"); return;
      }
      setExtractionPreview(result.text); setExtractionTruncated(Boolean(result.truncated)); setExtractionState("ready");
    } catch { setExtractionError(t("extractionUnavailable")); setExtractionState("error"); }
  }

  function confirmExtraction() {
    setDraft(extractionPreview); setInputMode("text"); setExtractionState("idle"); setExtractionPreview(""); setExtractionTruncated(false); setAnalysis(null);
  }

  async function generateTranslation() {
    if (!revised.trim() || translationState === "loading") return;
    setTranslationState("loading");
    try {
      const response = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: revised, language: language === "pt" ? "en" : "pt" }) });
      const result = await response.json().catch(() => null) as { translatedText?: string } | null;
      if (!response.ok || !result?.translatedText) throw new Error("translation");
      setTranslatedDraft(result.translatedText); setTranslationState("idle");
    } catch { setTranslationState("error"); }
  }

  function addCitation() {
    const { start, end } = selectionRange;
    const citedText = revised.slice(start, end);
    if (!citedText || !citationSourceId) { setCitationError(t("noCitationSelection")); return; }
    setCitations((items) => [...items, { id: createSessionId(), revisedTextStart: start, revisedTextEnd: end, sourceId: citationSourceId, citedText, note: citationNote.trim() || undefined, broken: false }]);
    setCitationNote(""); setCitationError("");
  }

  function returnToResearch() {
    const currentDraft = draft;
    resetReview();
    setGuided(false);
    setAnalysis(null);
    setDraft(currentDraft);
    setStep(1);
  }

  async function analyzeDraft() {
    if (!draft.trim() || researching) return;
    if (guided && analysis?.mode === "demo") {
      chooseClaim(analysis.claims[0]);
      setStep(2);
      return;
    }
    setResearching(true);
    setAnalysisError(null);
    setNeedsResearchRefresh(false);
    const controller = new AbortController();
    requestController.current?.abort();
    requestController.current = controller;
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: draft.trim(), language }), signal: controller.signal });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !validateAnalysisResult(result)) {
        const rawCode = result && typeof result === "object" && "code" in result ? String(result.code) : "UPSTREAM_ERROR";
        const allowed: AnalysisErrorCode[] = ["CONFIGURATION_ERROR", "INVALID_REQUEST", "NO_VERIFIABLE_CLAIMS", "NO_VERIFIED_SOURCES", "RATE_LIMITED", "TIMEOUT", "INVALID_RESPONSE", "UPSTREAM_ERROR"];
        setAnalysisError(allowed.includes(rawCode as AnalysisErrorCode) ? rawCode as AnalysisErrorCode : "UPSTREAM_ERROR");
        return;
      }
      setAnalysis(result);
      chooseClaim(result.claims[0]);
      setStep(2);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAnalysisError("UPSTREAM_ERROR");
    } finally {
      if (requestController.current === controller) { requestController.current = null; setResearching(false); }
    }
  }

  function continueToRevision() {
    if (!action || !claim || !source) return;
    if (revisionAction !== action || !revised) {
      const suggestion = buildSuggestedRevision(draft, claim, source, action, language);
      setRevised(suggestion);
      const changed = diffDrafts(draft, suggestion, action === "research").revised.find((part) => part.kind !== "same")?.text.trim();
      setCitations(changed && action !== "research" ? [{ id: createSessionId(), revisedTextStart: suggestion.indexOf(changed), revisedTextEnd: suggestion.indexOf(changed) + changed.length, sourceId: source.id, citedText: changed, broken: false }] : []);
      setReflection("");
      setRevisionAction(action);
      setRevisionOrigin("generated");
    }
    setStep(5);
  }

  function receiptData(): ReceiptData | null {
    if (!claim || !selectedSources.length || !support || !action || !reflection) return null;
    return { language, claim: claim.text, sources: selectedSources, support: supportLabel, justification: supportJustification, decision: actionLabel, originalDraft: draft, revisedDraft: revised, reflection: reflectionLabel, comparisonNotes, citations, checklist, pending, status: sessionStatus, translatedDraft, createdAt: new Date() };
  }

  async function copyReceipt() {
    const data = receiptData();
    if (!data) return;
    setCopyError(false);
    try {
      const text = buildReceiptSummary(data);
      let copiedWithClipboard = false;
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(text); copiedWithClipboard = true; } catch { copiedWithClipboard = false; }
      }
      if (!copiedWithClipboard) {
        const area = document.createElement("textarea");
        area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.appendChild(area); area.select();
        const copiedWithFallback = document.execCommand("copy");
        area.remove();
        if (!copiedWithFallback) throw new Error("Copy failed");
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch { setCopyError(true); }
  }

  async function downloadReceipt() {
    const data = receiptData();
    if (!data || downloadState === "loading") return;
    setDownloadState("loading");
    try {
      await downloadReceiptPng(data);
      setDownloadState("success");
      window.setTimeout(() => setDownloadState("idle"), 2600);
    } catch { setDownloadState("error"); }
  }

  async function downloadPdf() {
    const data = receiptData();
    if (!data || pdfState === "loading") return;
    setPdfState("loading");
    try { await downloadReceiptPdf(data); setPdfState("success"); window.setTimeout(() => setPdfState("idle"), 2600); }
    catch { setPdfState("error"); }
  }

  if (step === 0) return <Landing language={language} setLanguage={changeLanguage} start={start} sessions={sessions} historyReady={historyReady} resume={resumeSession} duplicate={(saved) => duplicateSavedSession(saved)} remove={(id) => { if (window.confirm(t("confirmDelete"))) removeSavedSession(id); }} clear={() => { if (window.confirm(t("confirmClear"))) clearSavedSessions(); }} />;

  return (
    <main className="app-shell editor-page">
      <Header language={language} setLanguage={changeLanguage} home={() => setStep(0)} compact />
      <Progress step={step} labels={progressLabels} language={language} />
      {!guided && <div className="save-bar" role="status" aria-live="polite">
        <span><i />{lastSavedAt ? t("savedLocally", { time: new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSavedAt)) }) : t("localStorageDetail")}</span>
        <button type="button" onClick={saveAndExit}>{t("saveAndExit")}</button>
      </div>}
      {needsResearchRefresh && <div className="translation-notice global" role="status"><span>i</span><p>{t("interfaceTranslated")}</p>{analysis?.mode === "live" && <button type="button" onClick={returnToResearch}>{t("reviewResearchLanguage")}</button>}</div>}

      {step === 1 && <>
        <StepIntro eyebrow={t("step1")} title={t("reviewBeforePost")} lead={t("step1Lead")} />
        <div className="input-tabs" role="tablist" aria-label={t("inputMethod")}><button role="tab" aria-selected={inputMode === "text"} className={inputMode === "text" ? "active" : ""} onClick={() => setInputMode("text")}>{t("pasteText")}</button><button role="tab" aria-selected={inputMode === "url"} className={inputMode === "url" ? "active" : ""} onClick={() => setInputMode("url")}>{t("importUrl")}</button></div>
        {inputMode === "url" && <section className="url-import-card"><label htmlFor="publication-url">{t("publicationUrl")}</label><div><input id="publication-url" type="url" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} placeholder={t("publicationUrlPlaceholder")} /><button className="secondary-button" disabled={!urlInput.trim() || extractionState === "loading"} onClick={extractUrl}>{extractionState === "loading" ? t("extractingUrl") : t("extractUrl")}</button></div>{extractionError && <p className="field-error" role="alert">{extractionError}</p>}{extractionState === "ready" && <div className="extraction-preview"><strong>{t("extractionPreview")}</strong>{extractionTruncated && <p role="status">{t("extractionTruncated")}</p>}<textarea value={extractionPreview} onChange={(event) => setExtractionPreview(event.target.value)} /><div><button className="primary-button" onClick={confirmExtraction}>{t("confirmExtraction")}</button><button className="text-button" onClick={() => { setExtractionState("idle"); setExtractionPreview(""); setExtractionTruncated(false); }}>{t("cancelExtraction")}</button></div></div>}</section>}
        {inputMode === "text" && <section className="editor-grid"><div className="draft-card"><label htmlFor="draft">{t("yourDraft")}</label><textarea id="draft" aria-label={t("draftLabel")} value={draft} placeholder={t("draftPlaceholder")} onChange={(event) => updateDraft(event.target.value)} autoFocus /><div className={`draft-meta ${draftCount >= 1400 ? "near-limit" : ""}`}><span>{t("maxCharacters")}</span><strong aria-live="polite">{t("characterCounter", { count: formatNumber(language, draftCount), maximum: formatNumber(language, MAX_CHARACTERS) })}</strong><small>{t("characterCountingHelp")}</small>{draftExcess > 0 && <p className="field-error" role="alert">{t("charactersOverLimit", { count: formatNumber(language, draftExcess) })}</p>}</div></div><InfoCard language={language} /></section>}
        {analysisError && <div className="analysis-error" role="alert"><span>!</span><div><strong>{t("researchFailed")}</strong><p>{analysisErrorMessage(language, analysisError)}</p><button onClick={() => start(true)}>{t("openDemo")}</button></div></div>}
        <Actions back={() => setStep(0)} language={language}><button className="text-button example-link" onClick={() => start(true)}>{t("useDemo")}</button><button className="primary-button" disabled={!draft.trim() || draftExcess > 0 || researching} onClick={analyzeDraft} aria-busy={researching}>{researching ? t("researching") : guided ? t("analyzeDemo") : t("researchClaims")}<span>{researching ? "…" : "→"}</span></button></Actions>
      </>}

      {step === 2 && analysis && <>
        <StepIntro eyebrow={t("step2")} title={t("claimAttention")} lead={t("step2Lead")} />
        <ResearchBanner analysis={analysis} language={language} narrator={narrator} />
        <NarrationStatus state={narrator.state} language={language} voiceName={narrator.voiceName} />
        <section className="claims-grid">{claims.map((item, index) => <article role="button" tabIndex={0} aria-pressed={claim?.id === item.id} key={item.id} className={`claim-card ${item.tone} ${claim?.id === item.id ? "selected" : ""}`} onClick={() => chooseClaim(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseClaim(item); } }}><div className="claim-head"><span>{String(index + 1).padStart(2, "0")}</span><b>{item.category}</b><i>{claim?.id === item.id ? "✓" : ""}</i></div><blockquote>“{item.text}”</blockquote><div className="claim-reason"><small>{t("whyAttention")}</small><p>{item.reason}</p></div><div className="claim-question"><span>?</span><p>{item.question}</p><button aria-label={t("listenQuestion")} title={t("listenQuestion")} onClick={(event) => { event.stopPropagation(); narrator.speak(item.question); }}>🔊</button></div></article>)}</section>
        <Actions back={() => setStep(1)} language={language}><button className="primary-button" disabled={!claim} onClick={() => { const ids = claim?.sourceIds.slice(0, 3) ?? []; setSelectedSourceId(ids[0] ?? ""); setSelectedSourceIds(ids); setStep(3); }}>{t("examineClaim")}<span>→</span></button></Actions>
      </>}

      {step === 3 && analysis && claim && <>
        <StepIntro eyebrow={t("step3")} title={t("evidenceTitle")} lead={t("evidenceLead")} />
        <section className="evidence-grid"><div className="evidence-panel"><span className="panel-label">{t("selectedClaim")}</span><blockquote>“{claim.text}”</blockquote><div className="source-heading"><div><span className="panel-label">{t("sourcesFound")}</span><p>{t("selectUpToThree")}</p></div><strong aria-live="polite">{t("selectedSourceCount", { count: selectedSources.length })}</strong></div><div className="source-results">{relatedSources.map((item) => <div key={item.id} className={`source-result ${selectedSourceIds.includes(item.id) ? "selected" : ""}`}><input type="checkbox" aria-label={item.title} checked={selectedSourceIds.includes(item.id)} onChange={() => toggleSource(item.id)} /><button type="button" onClick={() => selectSource(item.id)} aria-pressed={source?.id === item.id}><span>{item.authorOrInstitution || t("unidentified")}</span><strong>{item.title}</strong><small>{item.publishedAt || t("notReported")}</small></button>{selectedSourceIds.includes(item.id) && <button type="button" className="primary-source" onClick={() => setSelectedSourceId(item.id)}>{source?.id === item.id ? t("primarySource") : t("useAsPrimary")}</button>}</div>)}</div>{source && <SourceEditor source={source} language={language} onChange={updateSource} />}{!sourceValid && <p className="field-error" role="alert">{t("invalidUrl")}</p>}<label className="source-notes">{t("sourceNotes")}<textarea value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} placeholder={t("sourceNotesPlaceholder")} /></label></div>
          <aside className="support-panel"><span className="panel-label">{t("yourAssessment")}</span><h2>{t("supportsQuestion")}</h2><ol className="guided-questions"><li>{t("q1")}</li><li>{t("q2")}</li><li>{t("q3")}</li><li>{t("q4")}</li><li>{t("q5")}</li></ol><div className="support-options">{supportOptions.map((item) => <button type="button" key={item.id} className={support === item.id ? "selected" : ""} onClick={() => setSupport(item.id)} aria-pressed={support === item.id}><i>{support === item.id ? "✓" : ""}</i>{item.label}</button>)}</div><label className="support-justification">{t("justification")}<textarea value={supportJustification} onChange={(event) => setSupportJustification(event.target.value)} placeholder={t("justificationPlaceholder")} /></label><NarrationControls narrator={narrator} language={language} text={`${t("q1")} ${t("q2")} ${t("q3")} ${t("q4")} ${t("q5")} ${source?.relationSummary ?? ""}`} label={t("listenEvidence")} /><NarrationStatus state={narrator.state} language={language} voiceName={narrator.voiceName} compact /><div className="human-note">{t("platformDoesNotChoose")}</div></aside>
        </section>
        {selectedSources.length > 1 && <SourceComparison sources={selectedSources} language={language} notes={comparisonNotes} onChange={(field, value) => setComparisonNotes((current) => ({ ...current, [field]: value }))} />}
        <Actions back={() => setStep(2)} language={language}><button className="primary-button" disabled={!sourceValid || !support || supportJustification.trim().length < 3} onClick={() => setStep(4)}>{t("continueDecision")}<span>→</span></button></Actions>
      </>}

      {step === 4 && claim && source && <>
        <StepIntro eyebrow={t("step4")} title={t("decisionTitle")} lead={t("decisionLead")} />
        <section className="decision-grid">{actionOptions.map((item) => <button type="button" key={item.id} className={action === item.id ? "selected" : ""} onClick={() => setAction(item.id)} aria-pressed={action === item.id}><span>{item.icon}</span><div><h3>{item.title}</h3><p>{item.description}</p>{action === item.id && <small><b>{t("consequence")}:</b> {previewRevision(draft, claim, source, item.id, language)}</small>}</div><i>{action === item.id ? "✓" : "→"}</i></button>)}</section>
        <div className="responsibility-note"><span>!</span><p><strong>{t("decisionYours")}</strong> {t("decisionNote")}</p></div>
        <Actions back={() => setStep(3)} language={language}><button className="primary-button" disabled={!action} onClick={continueToRevision}>{t("reviseContent")}<span>→</span></button></Actions>
      </>}

      {step === 5 && claim && source && <>
        <StepIntro eyebrow={t("step5")} title={t("revisionTitle")} lead={t("revisionLead")} />
        <div className="revision-tabs" role="tablist" aria-label={t("revisionTitle")}><button role="tab" aria-selected={revisionTab === "original"} className={revisionTab === "original" ? "active" : ""} onClick={() => setRevisionTab("original")}>{t("originalDraft")}</button><button role="tab" aria-selected={revisionTab === "revised"} className={revisionTab === "revised" ? "active" : ""} onClick={() => setRevisionTab("revised")}>{t("revisedDraft")}</button></div>
        <section className={`revision-grid tab-${revisionTab}`}><div className="version-card original"><span>{t("originalDraft")}</span><p className="diff-text">{diff.original.map((part, index) => part.kind === "removed" ? <mark className="diff-removed" key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>)}</p></div><div className="version-card revised"><div className="version-label"><span>{t("revisedDraft")}</span>{guided && <button onClick={() => { setRevised(guidedDemo[language].revision); setRevisionOrigin("guided"); }}>{t("useDemoRevision")}</button>}</div><p className="diff-text revised-preview" aria-hidden="true">{diff.revised.map((part, index) => part.kind === "same" ? <span key={index}>{part.text}</span> : <mark className={part.kind === "pending" ? "diff-pending" : "diff-added"} key={index}>{part.text}</mark>)}</p><textarea ref={revisionRef} value={revised} onSelect={(event) => setSelectionRange({ start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd })} onChange={(event) => { setRevised(event.target.value); setCitations((items) => reanchorCitations(event.target.value, items)); setRevisionOrigin("manual"); }} aria-label={t("revisionLabel")} /><div className={`draft-meta ${revisedCount >= 1400 ? "near-limit" : ""}`}><span>{t("maxCharacters")}</span><strong aria-live="polite">{t("characterCounter", { count: formatNumber(language, revisedCount), maximum: formatNumber(language, MAX_CHARACTERS) })}</strong><small>{t("characterCountingHelp")}</small>{revisedExcess > 0 && <p className="field-error" role="alert">{t("charactersOverLimit", { count: formatNumber(language, revisedExcess) })}</p>}</div></div></section>
        <div className="traceability-note"><span>↗</span><p>{t("traceability")} <a href={source.url} target="_blank" rel="noreferrer">{t("openSupportingSource")}</a></p></div><div className="diff-legend"><span><i className="removed" />{t("removedLegend")}</span><span><i className="added" />{t("addedLegend")}</span><span><i className="pending" />{t("pendingLegend")}</span></div>
        <CitationPreview language={language} text={revised} sources={selectedSources} citations={citations} />
        <CitationEditor language={language} sources={selectedSources} citations={citations} sourceId={citationSourceId} note={citationNote} error={citationError} onSource={setCitationSourceId} onNote={setCitationNote} onAdd={addCitation} onRemove={(id) => setCitations((items) => items.filter((item) => item.id !== id))} />
        <section className="translation-card"><div><strong>{t("translationCopy")}</strong><p>{t("translationOriginalPreserved")}</p></div><button className="secondary-button" disabled={translationState === "loading"} onClick={generateTranslation}>{translationState === "loading" ? t("generatingTranslation") : t("translationCopy")}</button>{translationState === "error" && <p className="field-error" role="alert">{t("translationFailed")}</p>}{translatedDraft && <label>{t("translatedCopy")}<textarea value={translatedDraft} onChange={(event) => setTranslatedDraft(event.target.value)} /></label>}</section>
        <section className="reflection-card"><label>{t("whatChanged")}</label><div>{reflectionOptions.map((item) => <button type="button" key={item.id} className={reflection === item.id ? "selected" : ""} onClick={() => setReflection(item.id)} aria-pressed={reflection === item.id}>{reflection === item.id ? "✓ " : ""}{item.label}</button>)}</div></section>
        <Checklist language={language} checked={checklist} toggle={(id) => setChecklist((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])} />
        {pending && <section className="pending-card"><h3>{t("pendingReviewTitle")}</h3><p>{t("pendingReviewLead")}</p><label><input type="checkbox" checked={pendingAcknowledged} onChange={(event) => setPendingAcknowledged(event.target.checked)} />{t("pendingAcknowledge")}</label></section>}
        <Actions back={() => setStep(4)} language={language}><button className="primary-button" disabled={!revised.trim() || !reflection || revisedCount > MAX_CHARACTERS || !checklistComplete || (pending && !pendingAcknowledged)} onClick={() => setStep(6)}>{t("createReceipt")}<span>→</span></button></Actions>
      </>}

      {step === 6 && claim && source && <>
        <StepIntro eyebrow={t("receiptEyebrow")} title={t("receiptPageTitle")} lead={t("receiptPageLead")} />
        <section className="receipt-wrap"><article className="receipt-card" id="receipt"><div className="receipt-header"><div><span className="brand-mark"><span /></span><div><h2>{t("receiptTitle")}</h2><p>{t("receiptSubtitle")}</p></div></div><time>{new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US").format(new Date())}</time></div><div className={`receipt-status ${sessionStatus}`}>{localizedStatus(language, sessionStatus)}</div><ReceiptSection label={t("claimExamined")} value={`“${claim.text}”`} />{selectedSources.map((item, index) => <div className="receipt-two" key={item.id}><div><span>{t("sourceConsulted")} {index + 1}</span><strong>{item.authorOrInstitution}</strong><p>{item.title} · {item.publishedAt || "—"}</p><a href={item.url} target="_blank" rel="noreferrer">{t("openOriginal")}</a></div><div><span>{t("relationship")}</span><strong>{supportLabel}</strong><p>{item.relationSummary}</p></div></div>)}<ReceiptSection label={t("measuredReported")} value={source.measuredOrReported} /><ReceiptSection label={t("doesNotEstablish")} value={source.doesNotEstablish} /><div className="receipt-two"><div><span>{t("editorialDecision")}</span><strong>{actionLabel}</strong></div><div><span>{t("reflectionLabel")}</span><strong>{reflectionLabel}</strong></div></div><ReceiptSection label={t("justificationLabel")} value={supportJustification} /><ReceiptSection label={t("receiptComparison")} value={Object.values(comparisonNotes).filter((value) => value.trim()).join(" · ") || "—"} /><ReceiptSection label={t("receiptFieldCitations")} value={citations.map((item) => `“${item.citedText}”`).join("; ") || t("contextWithoutReference")} /><ReceiptSection label={t("receiptFieldPending")} value={pending ? t("pendingRecorded") : t("noPendingRecorded")} /><ReceiptSection label={t("receiptFieldChecklist")} value={checklist.length === CHECKLIST_IDS.length ? t("yes") : t("no")} /><div className="receipt-change"><span>{t("changeMade")}</span><div><p>{draft}</p><i>→</i><p>{revised}</p></div></div><div className="receipt-disclaimer"><span>i</span><p><strong>{t("receiptDisclaimer")}</strong></p></div></article><aside className="receipt-actions"><h3>{t("readyShare")}</h3><p>{t("receiptHelp")}</p><button className="primary-button" disabled={downloadState === "loading" || pdfState === "loading"} aria-busy={downloadState === "loading"} onClick={downloadReceipt}>↓ {downloadState === "loading" ? t("preparingDownload") : t("downloadSummary")}</button><p className={`download-status ${downloadState}`} role="status" aria-live="polite">{downloadState === "success" ? t("downloadSuccess") : downloadState === "error" ? t("downloadError") : ""}</p><button className="secondary-button" disabled={pdfState === "loading" || downloadState === "loading"} aria-busy={pdfState === "loading"} onClick={downloadPdf}>↓ {pdfState === "loading" ? t("preparingPdf") : t("downloadPdf")}</button><p className={`download-status ${pdfState}`} role="status" aria-live="polite">{pdfState === "success" ? t("pdfSuccess") : pdfState === "error" ? t("pdfError") : ""}</p><button className="secondary-button" onClick={copyReceipt}>{copied ? t("copied") : t("copySummary")}</button>{copyError && <p className="field-error" role="alert">{t("copyError")}</p>}<button className="text-button" onClick={() => start(false)}>{t("reviewAnother")}</button></aside></section>
      </>}
    </main>
  );
}

function previewRevision(draft: string, claim: Claim, source: ResearchSource, action: EditorialAction, language: Language) {
  const revised = buildSuggestedRevision(draft, claim, source, action, language);
  const difference = diffDrafts(draft, revised, action === "research").revised.find((part) => part.kind !== "same");
  return difference?.text || revised;
}

function formatNumber(language: Language, value: number) { return new Intl.NumberFormat(language === "pt" ? "pt-BR" : "en-US").format(value); }

function Header({ language, setLanguage, home, compact = false }: { language: Language; setLanguage: (value: Language) => void; home: () => void; compact?: boolean }) {
  const t = (key: TranslationKey) => translate(language, key);
  return <header className={`site-header ${compact ? "compact" : ""}`}><button className="brand" onClick={home} aria-label={t("home")}><span className="brand-mark"><span /></span><span>Proof Before Post</span></button>{!compact && <nav aria-label={t("mainNavigation")}><a href="#how">{t("howItWorks")}</a><a href="#why">{t("whyItMatters")}</a></nav>}<div className="header-actions">{!compact && <span className="privacy-pill"><i />{t("privateByDesign")}</span>}<div className="language-toggle" aria-label={t("language")}><button className={language === "pt" ? "active" : ""} aria-pressed={language === "pt"} onClick={() => setLanguage("pt")}>PT</button><button className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button></div></div></header>;
}

function Landing({ language, setLanguage, start, sessions, historyReady, resume, duplicate, remove, clear }: { language: Language; setLanguage: (value: Language) => void; start: (guided: boolean) => void; sessions: ReviewSession[]; historyReady: boolean; resume: (session: ReviewSession) => void; duplicate: (session: ReviewSession) => void; remove: (id: string) => void; clear: () => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  return <main className="app-shell home-page"><Header language={language} setLanguage={setLanguage} home={() => undefined} /><section className="hero"><div className="hero-copy"><p className="eyebrow"><span />{t("mediaLiteracy")}</p><h1><span>{t("pause")}</span><br />{t("checkEvidence")}<br /><em>{t("thenPost")}</em></h1><p className="hero-subtitle">{t("heroSubtitle")}</p><div className="hero-actions"><button className="primary-button" onClick={() => start(true)}>{t("tryDemo")}<span>→</span></button><button className="secondary-button" onClick={() => start(false)}>{t("reviewMine")}</button></div><div className="trust-row"><span>✓ {t("noAccount")}</span><span>✓ {t("noPermanentStorage")}</span><span>✓ {t("realSources")}</span></div></div><HeroVisual language={language} /></section><section className="review-paths" aria-label={t("inputMethod")}><article className="review-path demo"><span>{t("demoPathLabel")}</span><h2>{t("demoPathTitle")}</h2><p>{t("demoPathDescription")}</p></article><article className="review-path real"><span>{t("realPathLabel")}</span><h2>{t("realPathTitle")}</h2><p>{t("realPathDescription")}</p></article></section><p className="local-storage-note"><span>i</span>{t("localStorageDetail")}</p>{historyReady && <HistoryPanel language={language} sessions={sessions} resume={resume} duplicate={duplicate} remove={remove} clear={clear} />}<section className="proof-strip" id="why"><div className="stat-block"><strong>62<span>%</span></strong><p>{t("unescoStat")}</p></div><div className="source-block"><span>↗</span><div><strong>{t("unescoSurvey")}</strong><small>{t("humanDecision")}</small></div></div></section><section className="how-section" id="how"><div><p className="eyebrow"><span />{t("howItWorks")}</p><h2>{t("decisionCanChange")}</h2><p>{t("intervention")}</p></div><div className="step-row"><article><span>01</span><div className="step-symbol">“ ”</div><h3>{t("findClaim")}</h3></article><article><span>02</span><div className="step-symbol">⌕</div><h3>{t("examineSources")}</h3></article><article><span>03</span><div className="step-symbol">✓</div><h3>{t("makeDecision")}</h3></article></div></section></main>;
}

function HeroVisual({ language }: { language: Language }) {
  const example = guidedDemo[language].claims[0];
  return <div className="hero-visual" aria-label={translate(language, "evidenceTitle")}><div className="visual-glow" /><div className="evidence-card card-back"><div className="fake-lines"><i /><i /><i /></div></div><div className="evidence-card card-main"><div className="card-top"><span className="doc-icon">▤</span><span>{translate(language, "progressDraft")}</span><i>•••</i></div><p>“{example.text}”</p><div className="claim-callout"><span>!</span><div><strong>{example.category}</strong><small>{example.question}</small></div></div><div className="card-status"><span>01</span><i /><b>{translate(language, "progressClaim")}</b></div></div><div className="receipt-mini"><span className="check">✓</span><div><strong>{translate(language, "selectedSource")}</strong><small>{translate(language, "humanDecision")}</small></div></div></div>;
}

function Progress({ step, labels, language }: { step: number; labels: string[]; language: Language }) {
  const current = Math.min(step, 5);
  return <div className="progress-wrap" aria-label={translate(language, "reviewProgress")}>{labels.map((label, index) => <div className="progress-fragment" key={label}><div className={`progress-label ${index + 1 <= current ? "done" : "muted"}`}><strong>{index + 1 < current ? "✓" : String(index + 1).padStart(2, "0")}</strong><span>{label}</span></div>{index < labels.length - 1 && <div className={`progress-line ${index + 1 < current ? "filled" : ""}`} />}</div>)}</div>;
}

function StepIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) { return <section className="editor-intro"><p className="eyebrow"><span />{eyebrow}</p><h1>{title}</h1><p>{lead}</p></section>; }

function InfoCard({ language }: { language: Language }) {
  const t = (key: TranslationKey) => translate(language, key);
  return <aside className="next-card"><div className="orbit-icon"><span>?</span></div><h2>{t("whatNext")}</h2><ol><li><span>1</span>{t("info1")}</li><li><span>2</span>{t("info2")}</li><li><span>3</span>{t("info3")}</li></ol><div className="small-note"><span>i</span>{t("noInventedSource")}</div></aside>;
}

function ResearchBanner({ analysis, language, narrator }: { analysis: AnalysisResult; language: Language; narrator: ReturnType<typeof useNarrator> }) {
  const title = analysis.mode === "live" ? translate(language, "liveResearchDone") : translate(language, "guidedDemo");
  const detail = analysis.mode === "live" ? translate(language, "verifiedSourcesFound", { count: analysis.sources.length }) : translate(language, "preparedNoLive");
  return <section className={`research-banner ${analysis.mode}`}><div><span>{analysis.mode === "live" ? "●" : "◆"}</span><div><strong>{title}</strong><p>{analysis.researchSummary}</p><small>{detail}</small></div></div><NarrationControls narrator={narrator} language={language} text={analysis.researchSummary} label={translate(language, "listenSummary")} /></section>;
}

function NarrationControls({ narrator, language, text, label }: { narrator: ReturnType<typeof useNarrator>; language: Language; text: string; label: string }) {
  return <div className="narration-controls">{narrator.state === "idle" || narrator.state === "unavailable" || narrator.state === "unsupported" || narrator.state === "error" ? <button type="button" onClick={() => narrator.speak(text)}>🔊 {label}</button> : null}{narrator.state === "loading" && <button type="button" disabled>{translate(language, "preparingVoice")}</button>}{narrator.state === "speaking" && <button type="button" onClick={narrator.pause}>Ⅱ {translate(language, "pauseNarration")}</button>}{narrator.state === "paused" && <button type="button" onClick={narrator.resume}>▶ {translate(language, "resumeNarration")}</button>}{(narrator.state === "speaking" || narrator.state === "paused") && <button type="button" onClick={narrator.stop}>■ {translate(language, "stopNarration")}</button>}</div>;
}

function NarrationStatus({ state, language, voiceName, compact = false }: { state: NarratorState; language: Language; voiceName: string | null; compact?: boolean }) {
  if (!(["unsupported", "unavailable", "error"] as NarratorState[]).includes(state)) return null;
  const key: TranslationKey = state === "unsupported" ? "narrationUnsupported" : state === "unavailable" ? "narrationUnavailable" : "narrationError";
  return <p className={`narration-status ${compact ? "compact" : ""}`} role="status" aria-live="polite" title={voiceName ?? undefined}>{translate(language, key)}</p>;
}

function SourceEditor({ source, language, onChange }: { source: ResearchSource; language: Language; onChange: (field: SourceField, value: string) => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  const provenance = source.provenance === "user" ? t("userEdited") : source.provenance === "demo" ? t("guidedSource") : t("researchSource");
  const fields: Array<{ field: SourceField; key: TranslationKey; multiline?: boolean }> = [{ field: "title", key: "sourceTitle" }, { field: "authorOrInstitution", key: "authorInstitution" }, { field: "publishedAt", key: "publishedDate" }, { field: "sourceType", key: "sourceType" }, { field: "methodology", key: "methodology", multiline: true }, { field: "sample", key: "sample", multiline: true }, { field: "geography", key: "geography", multiline: true }, { field: "keyFindings", key: "keyFindings", multiline: true }, { field: "measuredOrReported", key: "measuredReported", multiline: true }, { field: "doesNotEstablish", key: "doesNotEstablish", multiline: true }, { field: "contextLimitations", key: "contextLimitations", multiline: true }, { field: "relationSummary", key: "relationSummary", multiline: true }, { field: "url", key: "sourceUrl" }, { field: "accessedAt", key: "accessDate" }];
  return <article className="source-details source-editor"><div><span>{t("selectedSource")}</span><a href={source.url} target="_blank" rel="noreferrer">{t("openOriginal")}</a></div><p className={`source-provenance ${source.provenance}`}>{provenance}</p><div className="source-form">{fields.map(({ field, key, multiline }) => <label key={field}>{t(key)}{multiline ? <textarea value={source[field]} onChange={(event) => onChange(field, event.target.value)} /> : <input type={field === "accessedAt" ? "date" : field === "url" ? "url" : "text"} value={source[field]} onChange={(event) => onChange(field, event.target.value)} placeholder={field === "authorOrInstitution" || field === "sourceType" ? t("unidentified") : undefined} />}</label>)}</div></article>;
}

function HistoryPanel({ language, sessions, resume, duplicate, remove, clear }: { language: Language; sessions: ReviewSession[]; resume: (session: ReviewSession) => void; duplicate: (session: ReviewSession) => void; remove: (id: string) => void; clear: () => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SessionStatus | "all">("all");
  const status = (value: SessionStatus) => t(value === "in_progress" ? "statusInProgress" : value === "completed" ? "statusCompleted" : "statusPending");
  const normalized = query.trim().toLocaleLowerCase(language === "pt" ? "pt-BR" : "en-US");
  const visible = sessions.filter((session) => {
    const claim = session.analysis?.claims.find((item) => item.id === session.selectedClaimId)?.text ?? "";
    const matchesText = !normalized || `${session.draft} ${claim}`.toLocaleLowerCase(language === "pt" ? "pt-BR" : "en-US").includes(normalized);
    return matchesText && (filter === "all" || session.status === filter);
  });
  return <section className="history-panel"><div className="history-heading"><div><span className="section-icon">▤</span><div><h2>{t("historyTitle")}</h2><p>{t("historyLead")}</p></div></div><span className="local-badge">● {t("privateByDesign")}</span></div>{sessions.length === 0 ? <p className="history-empty">{t("noHistory")}</p> : <><div className="history-tools"><label><span>{t("historySearch")}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("historySearchPlaceholder")} /></label><label><span>{t("historyFilter")}</span><select value={filter} onChange={(event) => setFilter(event.target.value as SessionStatus | "all")}><option value="all">{t("historyAll")}</option><option value="in_progress">{t("statusInProgress")}</option><option value="completed">{t("statusCompleted")}</option><option value="completed_with_pending">{t("statusPending")}</option></select></label></div>{visible.length === 0 ? <p className="history-empty">{t("noHistoryMatch")}</p> : <div className="history-list">{visible.map((session) => <article key={session.id}><div className="history-content"><div className="history-meta"><span className={`status-badge ${session.status}`}>{status(session.status)}</span><span>{session.language.toUpperCase()}</span><span>{translate(language, "historySources", { count: session.sources.length })}</span></div><strong>{session.draft.slice(0, 120) || "—"}</strong><small>{translate(language, "lastUpdated", { date: new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.updatedAt)) })}</small></div><div className="history-actions"><button className="history-primary" onClick={() => resume(session)}>{t("continueSession")} →</button><button onClick={() => duplicate(session)}>{t("duplicateSession")}</button><button className="danger" onClick={() => remove(session.id)}>{t("deleteSession")}</button></div></article>)}</div>}<button className="text-button danger" onClick={clear}>{t("clearHistory")}</button></>}</section>;
}

function SourceComparison({ sources, language, notes, onChange }: { sources: ResearchSource[]; language: Language; notes: ComparisonNotes; onChange: (field: keyof ComparisonNotes, value: string) => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  const fields: Array<{ field: keyof ComparisonNotes; key: TranslationKey }> = [{ field: "convergence", key: "convergence" }, { field: "divergences", key: "divergences" }, { field: "methodologyDifferences", key: "methodologyDifferences" }, { field: "scopeDifferences", key: "scopeDifferences" }, { field: "missingInformation", key: "missingInformation" }];
  const rows: Array<{ key: TranslationKey; value: (source: ResearchSource) => string }> = [
    { key: "sourceTitle", value: (item) => item.title }, { key: "authorInstitution", value: (item) => item.authorOrInstitution },
    { key: "publishedDate", value: (item) => item.publishedAt }, { key: "sourceType", value: (item) => item.sourceType },
    { key: "methodology", value: (item) => item.methodology }, { key: "sample", value: (item) => item.sample },
    { key: "geography", value: (item) => item.geography }, { key: "measuredReported", value: (item) => item.measuredOrReported },
    { key: "keyFindings", value: (item) => item.keyFindings }, { key: "contextLimitations", value: (item) => item.contextLimitations },
    { key: "doesNotEstablish", value: (item) => item.doesNotEstablish }, { key: "relationSummary", value: (item) => item.relationSummary },
    { key: "sourceOrigin", value: (item) => t(item.provenance === "user" ? "userEdited" : item.provenance === "demo" ? "guidedSource" : "researchSource") },
    { key: "accessDate", value: (item) => item.accessedAt },
  ];
  return <section className="comparison-panel"><div className="section-heading"><span className="section-icon">⇄</span><div><h2>{t("comparisonTitle")}</h2><p>{t("comparisonHelp")}</p></div></div><div className="comparison-table" role="region" tabIndex={0} aria-label={t("comparisonTitle")}><table><thead><tr><th>{t("comparisonField")}</th>{sources.map((item, index) => <th key={item.id}><span>{translate(language, "comparisonSource", { count: index + 1 })}</span><a href={item.url} target="_blank" rel="noreferrer">{item.title}</a></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{t(row.key)}</th>{sources.map((item) => <td key={item.id}>{row.value(item) || "—"}</td>)}</tr>)}</tbody></table></div><div className="comparison-mobile">{sources.map((item, index) => <article key={item.id}><span>{translate(language, "comparisonSource", { count: index + 1 })}</span><h3>{item.title}</h3><a href={item.url} target="_blank" rel="noreferrer">{t("openOriginal")}</a>{rows.slice(1).map((row) => <div key={row.key}><strong>{t(row.key)}</strong><p>{row.value(item) || "—"}</p></div>)}</article>)}</div><div className="comparison-notes">{fields.map(({ field, key }) => <label key={field}><span>{t(key)}</span><textarea value={notes[field]} onChange={(event) => onChange(field, event.target.value)} /></label>)}</div></section>;
}

function CitationPreview({ language, text, sources, citations }: { language: Language; text: string; sources: ResearchSource[]; citations: RevisionCitation[] }) {
  const t = (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values);
  const groups = new Map<string, RevisionCitation[]>();
  citations.filter((item) => !item.broken).forEach((item) => {
    const key = `${item.revisedTextStart}:${item.revisedTextEnd}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  const ordered = [...groups.values()].sort((a, b) => a[0].revisedTextStart - b[0].revisedTextStart);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ordered.forEach((group) => {
    const citation = group[0];
    if (citation.revisedTextStart < cursor || citation.revisedTextEnd > text.length) return;
    if (citation.revisedTextStart > cursor) parts.push(<span key={`plain-${cursor}`}>{text.slice(cursor, citation.revisedTextStart)}</span>);
    const names = group.map((item) => sources.find((source) => source.id === item.sourceId)?.title).filter(Boolean).join("; ");
    parts.push(<mark key={`${citation.id}-${citation.revisedTextStart}`} tabIndex={0} title={t("citedBy", { sources: names || "—" })}>{text.slice(citation.revisedTextStart, citation.revisedTextEnd)}</mark>);
    cursor = citation.revisedTextEnd;
  });
  if (cursor < text.length) parts.push(<span key={`plain-${cursor}`}>{text.slice(cursor)}</span>);
  return <div className="citation-preview"><span>{t("citationPreview")}</span><p>{t("citationPreviewHelp")}</p><div>{parts.length ? parts : text}</div>{citations.length === 0 && <small>{t("contextWithoutReference")}</small>}</div>;
}

function CitationEditor({ language, sources, citations, sourceId, note, error, onSource, onNote, onAdd, onRemove }: { language: Language; sources: ResearchSource[]; citations: RevisionCitation[]; sourceId: string; note: string; error: string; onSource: (id: string) => void; onNote: (value: string) => void; onAdd: () => void; onRemove: (id: string) => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  return <section className="citation-card"><h2>{t("citationsTitle")}</h2><p>{t("citationHelp")}</p><div className="citation-form"><label>{t("citationSource")}<select value={sourceId} onChange={(event) => onSource(event.target.value)}><option value="">—</option>{sources.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label>{t("citationNote")}<input value={note} onChange={(event) => onNote(event.target.value)} /></label><button className="secondary-button" onClick={onAdd}>{t("addCitation")}</button></div>{error && <p className="field-error" role="alert">{error}</p>}<ul>{citations.map((item) => <li className={item.broken ? "broken" : ""} key={item.id}><span>“{item.citedText}” — {sources.find((source) => source.id === item.sourceId)?.title || t("citationBroken")}</span><button onClick={() => onRemove(item.id)}>{t("removeCitation")}</button></li>)}</ul>{citations.length === 0 && <p>{t("contextWithoutReference")}</p>}</section>;
}

function Checklist({ language, checked, toggle }: { language: Language; checked: string[]; toggle: (id: string) => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  const items: Array<{ id: typeof CHECKLIST_IDS[number]; key: TranslationKey }> = [{ id: "opened", key: "checklistOpenedSource" }, { id: "identity", key: "checklistIdentity" }, { id: "date", key: "checklistDate" }, { id: "method", key: "checklistMethod" }, { id: "limitation", key: "checklistLimitation" }, { id: "scope", key: "checklistScope" }, { id: "final", key: "checklistFinalText" }];
  return <section className="checklist-card"><h2>{t("checklistTitle")}</h2><p>{t("checklistLead")}</p>{items.map((item) => <label key={item.id}><input type="checkbox" checked={checked.includes(item.id)} onChange={() => toggle(item.id)} />{t(item.key)}</label>)}</section>;
}

function ReceiptSection({ label, value }: { label: string; value: string }) { return <div className="receipt-section"><span>{label}</span><p>{value}</p></div>; }

function Actions({ back, children, language }: { back: () => void; children: React.ReactNode; language: Language }) { return <div className="editor-actions"><button className="text-button" onClick={back}>← {translate(language, "back")}</button>{children}</div>; }
