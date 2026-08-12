"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import guidedDemo from "../data/guided-demo.json";
import { useNarrator, type NarratorState } from "../hooks/useNarrator";
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
import { buildReceiptSummary, downloadReceiptPng, type ReceiptData } from "../lib/receipt";
import { buildSuggestedRevision, diffDrafts, type EditorialAction } from "../lib/revision";
import { countCharacters, limitCharacters } from "../lib/text";

type SupportId = "supports" | "partial" | "does_not_support" | "insufficient";
type ReflectionId = "narrowed" | "context" | "uncertainty" | "removed" | "research";
type SourceField = keyof Pick<ResearchSource,
  "title" | "authorOrInstitution" | "publishedAt" | "sourceType" | "measuredOrReported" |
  "doesNotEstablish" | "contextLimitations" | "relationSummary" | "url" | "accessedAt"
>;

const MAX_CHARACTERS = 1500;

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
  const [language, setLanguage] = useState<Language>("en");
  const [step, setStep] = useState(0);
  const [guided, setGuided] = useState(false);
  const [draft, setDraft] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
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
  const [researching, setResearching] = useState(false);
  const [analysisError, setAnalysisError] = useState<AnalysisErrorCode | null>(null);
  const [needsResearchRefresh, setNeedsResearchRefresh] = useState(false);
  const [revisionTab, setRevisionTab] = useState<"original" | "revised">("revised");
  const requestController = useRef<AbortController | null>(null);
  const narrator = useNarrator(language);
  const t = (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values);

  useEffect(() => {
    document.documentElement.lang = language === "pt" ? "pt-BR" : "en";
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
  const sourceValid = Boolean(source && source.title.trim() && source.measuredOrReported.trim() && isHttpsUrl(source.url));
  const supportOptions = getSupportOptions(language);
  const actionOptions = getActionOptions(language);
  const reflectionOptions = getReflectionOptions(language);
  const supportLabel = supportOptions.find((item) => item.id === support)?.label ?? "";
  const actionLabel = actionOptions.find((item) => item.id === action)?.title ?? "";
  const reflectionLabel = reflectionOptions.find((item) => item.id === reflection)?.label ?? "";
  const progressLabels = [t("progressDraft"), t("progressClaim"), t("progressEvidence"), t("progressDecision"), t("progressReview")];
  const draftCount = countCharacters(draft, language);
  const revisedCount = countCharacters(revised, language);
  const diff = useMemo(() => diffDrafts(draft, revised, action === "research"), [action, draft, revised]);

  function resetReview() {
    requestController.current?.abort();
    requestController.current = null;
    setResearching(false);
    setSelectedClaimId("");
    setSelectedSourceId("");
    setSupport("");
    setSupportJustification("");
    setAction("");
    setRevisionAction("");
    setRevised("");
    setReflection("");
    setSourceNotes("");
    setCopied(false);
    setCopyError(false);
    setDownloadState("idle");
    setAnalysisError(null);
    setNeedsResearchRefresh(false);
    narrator.stop();
  }

  function start(isGuided: boolean) {
    resetReview();
    setGuided(isGuided);
    setDraft(isGuided ? guidedDemo[language].draft : "");
    setAnalysis(isGuided ? buildDemo(language) : null);
    setStep(1);
  }

  function changeLanguage(nextLanguage: Language) {
    if (nextLanguage === language) return;
    narrator.stop();
    setLanguage(nextLanguage);
    if (guided) {
      setDraft(guidedDemo[nextLanguage].draft);
      setAnalysis(buildDemo(nextLanguage));
      if (revised) setRevised(guidedDemo[nextLanguage].revision);
      setNeedsResearchRefresh(false);
    } else if (analysis?.mode === "live" && analysis.language !== nextLanguage) {
      setNeedsResearchRefresh(true);
    }
  }

  function updateDraft(value: string) {
    setDraft(limitCharacters(value, MAX_CHARACTERS, language));
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
    setSupport("");
    setSupportJustification("");
    setAction("");
    setRevisionAction("");
    setRevised("");
    setReflection("");
  }

  function selectSource(sourceId: string) {
    if (sourceId === selectedSourceId) return;
    setSelectedSourceId(sourceId);
    setSupport("");
    setSupportJustification("");
    setAction("");
    setRevisionAction("");
    setRevised("");
    setReflection("");
  }

  function updateSource(field: SourceField, value: string) {
    if (!analysis || !source) return;
    setAnalysis({ ...analysis, sources: analysis.sources.map((item) => item.id === source.id ? { ...item, [field]: value, provenance: "user" } : item) });
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
      setRevised(buildSuggestedRevision(draft, claim, source, action, language));
      setReflection("");
      setRevisionAction(action);
    }
    setStep(5);
  }

  function receiptData(): ReceiptData | null {
    if (!claim || !source || !support || !action || !reflection) return null;
    return { language, claim: claim.text, source, support: supportLabel, justification: supportJustification, decision: actionLabel, originalDraft: draft, revisedDraft: revised, reflection: reflectionLabel, createdAt: new Date() };
  }

  async function copyReceipt() {
    const data = receiptData();
    if (!data) return;
    setCopyError(false);
    try {
      const text = buildReceiptSummary(data);
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const area = document.createElement("textarea");
        area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
        document.body.appendChild(area); area.select();
        if (!document.execCommand("copy")) throw new Error("Copy failed");
        area.remove();
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

  if (step === 0) return <Landing language={language} setLanguage={changeLanguage} start={start} />;

  return (
    <main className="app-shell editor-page">
      <Header language={language} setLanguage={changeLanguage} home={() => setStep(0)} compact />
      <Progress step={step} labels={progressLabels} language={language} />

      {step === 1 && <>
        <StepIntro eyebrow={t("step1")} title={t("reviewBeforePost")} lead={t("step1Lead")} />
        <section className="editor-grid"><div className="draft-card"><label htmlFor="draft">{t("yourDraft")}</label><textarea id="draft" aria-label={t("draftLabel")} value={draft} placeholder={t("draftPlaceholder")} onChange={(event) => updateDraft(event.target.value)} autoFocus /><div className={`draft-meta ${draftCount >= 1400 ? "near-limit" : ""}`}><span>{t("maxCharacters")}</span><strong aria-live="polite">{formatNumber(language, draftCount)} / {formatNumber(language, MAX_CHARACTERS)}</strong></div></div><InfoCard language={language} /></section>
        {needsResearchRefresh && <div className="translation-notice" role="status"><span>i</span><p>{t("interfaceTranslated")}</p></div>}
        {analysisError && <div className="analysis-error" role="alert"><span>!</span><div><strong>{t("researchFailed")}</strong><p>{analysisErrorMessage(language, analysisError)}</p><button onClick={() => start(true)}>{t("openDemo")}</button></div></div>}
        <Actions back={() => setStep(0)} language={language}><button className="text-button example-link" onClick={() => start(true)}>{t("useDemo")}</button><button className="primary-button" disabled={!draft.trim() || researching} onClick={analyzeDraft} aria-busy={researching}>{researching ? t("researching") : guided ? t("analyzeDemo") : t("researchClaims")}<span>{researching ? "…" : "→"}</span></button></Actions>
      </>}

      {step === 2 && analysis && <>
        <StepIntro eyebrow={t("step2")} title={t("claimAttention")} lead={t("step2Lead")} />
        <ResearchBanner analysis={analysis} language={language} narrator={narrator} />
        <NarrationStatus state={narrator.state} language={language} voiceName={narrator.voiceName} />
        <section className="claims-grid">{claims.map((item, index) => <article role="button" tabIndex={0} aria-pressed={claim?.id === item.id} key={item.id} className={`claim-card ${item.tone} ${claim?.id === item.id ? "selected" : ""}`} onClick={() => chooseClaim(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseClaim(item); } }}><div className="claim-head"><span>{String(index + 1).padStart(2, "0")}</span><b>{item.category}</b><i>{claim?.id === item.id ? "✓" : ""}</i></div><blockquote>“{item.text}”</blockquote><div className="claim-reason"><small>{t("whyAttention")}</small><p>{item.reason}</p></div><div className="claim-question"><span>?</span><p>{item.question}</p><button aria-label={t("listenQuestion")} title={t("listenQuestion")} onClick={(event) => { event.stopPropagation(); narrator.speak(item.question); }}>🔊</button></div></article>)}</section>
        <Actions back={() => setStep(1)} language={language}><button className="primary-button" disabled={!claim} onClick={() => { setSelectedSourceId(claim?.sourceIds[0] ?? ""); setStep(3); }}>{t("examineClaim")}<span>→</span></button></Actions>
      </>}

      {step === 3 && analysis && claim && <>
        <StepIntro eyebrow={t("step3")} title={t("evidenceTitle")} lead={t("evidenceLead")} />
        <section className="evidence-grid"><div className="evidence-panel"><span className="panel-label">{t("selectedClaim")}</span><blockquote>“{claim.text}”</blockquote><div className="source-heading"><div><span className="panel-label">{t("sourcesFound")}</span><p>{t("selectSourceHelp")}</p></div><strong>{relatedSources.length}</strong></div><div className="source-results">{relatedSources.map((item) => <button type="button" key={item.id} className={`source-result ${source?.id === item.id ? "selected" : ""}`} onClick={() => selectSource(item.id)} aria-pressed={source?.id === item.id}><span>{item.authorOrInstitution || t("unidentified")}</span><strong>{item.title}</strong><small>{item.publishedAt || t("notReported")}</small></button>)}</div>{source && <SourceEditor source={source} language={language} onChange={updateSource} />}{!sourceValid && <p className="field-error" role="alert">{t("invalidUrl")}</p>}<label className="source-notes">{t("sourceNotes")}<textarea value={sourceNotes} onChange={(event) => setSourceNotes(event.target.value)} placeholder={t("sourceNotesPlaceholder")} /></label></div>
          <aside className="support-panel"><span className="panel-label">{t("yourAssessment")}</span><h2>{t("supportsQuestion")}</h2><ol className="guided-questions"><li>{t("q1")}</li><li>{t("q2")}</li><li>{t("q3")}</li><li>{t("q4")}</li><li>{t("q5")}</li></ol><div className="support-options">{supportOptions.map((item) => <button type="button" key={item.id} className={support === item.id ? "selected" : ""} onClick={() => setSupport(item.id)} aria-pressed={support === item.id}><i>{support === item.id ? "✓" : ""}</i>{item.label}</button>)}</div><label className="support-justification">{t("justification")}<textarea value={supportJustification} onChange={(event) => setSupportJustification(event.target.value)} placeholder={t("justificationPlaceholder")} /></label><NarrationControls narrator={narrator} language={language} text={`${t("q1")} ${t("q2")} ${t("q3")} ${t("q4")} ${t("q5")} ${source?.relationSummary ?? ""}`} label={t("listenEvidence")} /><NarrationStatus state={narrator.state} language={language} voiceName={narrator.voiceName} compact /><div className="human-note">{t("platformDoesNotChoose")}</div></aside>
        </section>
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
        <section className={`revision-grid tab-${revisionTab}`}><div className="version-card original"><span>{t("originalDraft")}</span><p className="diff-text">{diff.original.map((part, index) => part.kind === "removed" ? <mark className="diff-removed" key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>)}</p></div><div className="version-card revised"><div className="version-label"><span>{t("revisedDraft")}</span>{guided && <button onClick={() => setRevised(guidedDemo[language].revision)}>{t("useDemoRevision")}</button>}</div><p className="diff-text revised-preview" aria-hidden="true">{diff.revised.map((part, index) => part.kind === "same" ? <span key={index}>{part.text}</span> : <mark className={part.kind === "pending" ? "diff-pending" : "diff-added"} key={index}>{part.text}</mark>)}</p><textarea value={revised} onChange={(event) => setRevised(limitCharacters(event.target.value, MAX_CHARACTERS, language))} aria-label={t("revisionLabel")} /><div className={`draft-meta ${revisedCount >= 1400 ? "near-limit" : ""}`}><span>{t("maxCharacters")}</span><strong aria-live="polite">{formatNumber(language, revisedCount)} / {formatNumber(language, MAX_CHARACTERS)} {t("characters")}</strong></div></div></section>
        <div className="traceability-note"><span>↗</span><p>{t("traceability")} <a href={source.url} target="_blank" rel="noreferrer">{t("openSupportingSource")}</a></p></div><div className="diff-legend"><span><i className="removed" />{t("removedLegend")}</span><span><i className="added" />{t("addedLegend")}</span><span><i className="pending" />{t("pendingLegend")}</span></div>
        <section className="reflection-card"><label>{t("whatChanged")}</label><div>{reflectionOptions.map((item) => <button type="button" key={item.id} className={reflection === item.id ? "selected" : ""} onClick={() => setReflection(item.id)} aria-pressed={reflection === item.id}>{reflection === item.id ? "✓ " : ""}{item.label}</button>)}</div></section>
        <Actions back={() => setStep(4)} language={language}><button className="primary-button" disabled={!revised.trim() || !reflection || revisedCount > MAX_CHARACTERS} onClick={() => setStep(6)}>{t("createReceipt")}<span>→</span></button></Actions>
      </>}

      {step === 6 && claim && source && <>
        <StepIntro eyebrow={t("receiptEyebrow")} title={t("receiptPageTitle")} lead={t("receiptPageLead")} />
        <section className="receipt-wrap"><article className="receipt-card" id="receipt"><div className="receipt-header"><div><span className="brand-mark"><span /></span><div><h2>{t("receiptTitle")}</h2><p>{t("receiptSubtitle")}</p></div></div><time>{new Intl.DateTimeFormat(language === "pt" ? "pt-BR" : "en-US").format(new Date())}</time></div><ReceiptSection label={t("claimExamined")} value={`“${claim.text}”`} /><div className="receipt-two"><div><span>{t("sourceConsulted")}</span><strong>{source.authorOrInstitution}</strong><p>{source.title} · {source.publishedAt || "—"}</p><a href={source.url} target="_blank" rel="noreferrer">{t("openOriginal")}</a></div><div><span>{t("relationship")}</span><strong>{supportLabel}</strong><p>{t("creatorAssessment")}</p></div></div><ReceiptSection label={t("measuredReported")} value={source.measuredOrReported} /><ReceiptSection label={t("doesNotEstablish")} value={source.doesNotEstablish} /><div className="receipt-two"><div><span>{t("editorialDecision")}</span><strong>{actionLabel}</strong></div><div><span>{t("reflectionLabel")}</span><strong>{reflectionLabel}</strong></div></div><ReceiptSection label={t("justificationLabel")} value={supportJustification} /><div className="receipt-change"><span>{t("changeMade")}</span><div><p>{draft}</p><i>→</i><p>{revised}</p></div></div><div className="receipt-disclaimer"><span>i</span><p><strong>{t("receiptDisclaimer")}</strong></p></div></article><aside className="receipt-actions"><h3>{t("readyShare")}</h3><p>{t("receiptHelp")}</p><button className="primary-button" disabled={downloadState === "loading"} aria-busy={downloadState === "loading"} onClick={downloadReceipt}>↓ {downloadState === "loading" ? t("preparingDownload") : t("downloadSummary")}</button><p className={`download-status ${downloadState}`} role="status" aria-live="polite">{downloadState === "success" ? t("downloadSuccess") : downloadState === "error" ? t("downloadError") : ""}</p><button className="secondary-button" onClick={copyReceipt}>{copied ? t("copied") : t("copySummary")}</button>{copyError && <p className="field-error" role="alert">{t("copyError")}</p>}<button className="text-button" onClick={() => start(false)}>{t("reviewAnother")}</button></aside></section>
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

function Landing({ language, setLanguage, start }: { language: Language; setLanguage: (value: Language) => void; start: (guided: boolean) => void }) {
  const t = (key: TranslationKey) => translate(language, key);
  return <main className="app-shell home-page"><Header language={language} setLanguage={setLanguage} home={() => undefined} /><section className="hero"><div className="hero-copy"><p className="eyebrow"><span />{t("mediaLiteracy")}</p><h1><span>{t("pause")}</span><br />{t("checkEvidence")}<br /><em>{t("thenPost")}</em></h1><p className="hero-subtitle">{t("heroSubtitle")}</p><div className="hero-actions"><button className="primary-button" onClick={() => start(true)}>{t("tryDemo")}<span>→</span></button><button className="secondary-button" onClick={() => start(false)}>{t("reviewMine")}</button></div><div className="trust-row"><span>✓ {t("noAccount")}</span><span>✓ {t("noPermanentStorage")}</span><span>✓ {t("realSources")}</span></div></div><HeroVisual language={language} /></section><section className="proof-strip" id="why"><div className="stat-block"><strong>62<span>%</span></strong><p>{t("unescoStat")}</p></div><div className="source-block"><span>↗</span><div><strong>{t("unescoSurvey")}</strong><small>{t("humanDecision")}</small></div></div></section><section className="how-section" id="how"><div><p className="eyebrow"><span />{t("howItWorks")}</p><h2>{t("decisionCanChange")}</h2><p>{t("intervention")}</p></div><div className="step-row"><article><span>01</span><div className="step-symbol">“ ”</div><h3>{t("findClaim")}</h3></article><article><span>02</span><div className="step-symbol">⌕</div><h3>{t("examineSources")}</h3></article><article><span>03</span><div className="step-symbol">✓</div><h3>{t("makeDecision")}</h3></article></div></section></main>;
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
  const fields: Array<{ field: SourceField; key: TranslationKey; multiline?: boolean }> = [{ field: "title", key: "sourceTitle" }, { field: "authorOrInstitution", key: "authorInstitution" }, { field: "publishedAt", key: "publishedDate" }, { field: "sourceType", key: "sourceType" }, { field: "measuredOrReported", key: "measuredReported", multiline: true }, { field: "doesNotEstablish", key: "doesNotEstablish", multiline: true }, { field: "contextLimitations", key: "contextLimitations", multiline: true }, { field: "relationSummary", key: "relationSummary", multiline: true }, { field: "url", key: "sourceUrl" }, { field: "accessedAt", key: "accessDate" }];
  return <article className="source-details source-editor"><div><span>{t("selectedSource")}</span><a href={source.url} target="_blank" rel="noreferrer">{t("openOriginal")}</a></div><p className={`source-provenance ${source.provenance}`}>{provenance}</p><div className="source-form">{fields.map(({ field, key, multiline }) => <label key={field}>{t(key)}{multiline ? <textarea value={source[field]} onChange={(event) => onChange(field, event.target.value)} /> : <input type={field === "accessedAt" ? "date" : field === "url" ? "url" : "text"} value={source[field]} onChange={(event) => onChange(field, event.target.value)} placeholder={field === "authorOrInstitution" || field === "sourceType" ? t("unidentified") : undefined} />}</label>)}</div></article>;
}

function ReceiptSection({ label, value }: { label: string; value: string }) { return <div className="receipt-section"><span>{label}</span><p>{value}</p></div>; }

function Actions({ back, children, language }: { back: () => void; children: React.ReactNode; language: Language }) { return <div className="editor-actions"><button className="text-button" onClick={back}>← {translate(language, "back")}</button>{children}</div>; }
